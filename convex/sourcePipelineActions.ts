"use node";

/**
 * One-time collection for the CLI.
 *
 * RoomScout's recurring path is a Firecrawl native monitor. These actions are
 * the deliberate alternative: a single scrape of a reviewed target, ingested
 * through the same extraction and detail pipeline the monitor webhook uses, so
 * an index can be built once without any recurring checks being provisioned.
 */

import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import { envValue } from "./integrations/env";
import { stableFingerprint } from "./integrations/fingerprints";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

type ScrapeOutcome = {
  scraped: boolean;
  discovered: number;
  queuedDetails: number;
  skipped?: string;
};

async function scrapeAndIngest(
  ctx: ActionCtx,
  args: {
    sourceTargetId: Id<"sourceTargets">;
    url: string;
    maxEntries?: number;
    force?: boolean;
  },
): Promise<ScrapeOutcome> {
  const document = await firecrawl.scrape(ctx, args.url, {
    formats: ["markdown"],
    onlyMainContent: true,
    maxAge: 0,
  });
  const markdown = document.markdown ?? "";
  if (markdown.trim().length === 0) {
    return { scraped: true, discovered: 0, queuedDetails: 0, skipped: "EMPTY_MARKDOWN" };
  }
  const pageUrl =
    document.metadata?.sourceURL ?? document.metadata?.url ?? args.url;

  // The event id is content-addressed so re-running the same scrape is a
  // no-op, matching how monitor webhooks dedupe. `force` opts out.
  const providerEventId = args.force
    ? `oneshot:${args.sourceTargetId}:${Date.now()}`
    : `oneshot:${args.sourceTargetId}:${stableFingerprint(markdown)}`;
  const receipt = await ctx.runMutation(
    internal.ingestion.recordFirecrawlEvent,
    {
      providerEventId,
      sourceTargetId: args.sourceTargetId,
      eventType: "roomscout.oneshot.scrape",
      payloadHash: stableFingerprint(markdown),
      changeStatus: "changed",
      pageUrl,
    },
  );
  if (receipt.duplicate) {
    return {
      scraped: true,
      discovered: 0,
      queuedDetails: 0,
      skipped: "ALREADY_INGESTED",
    };
  }
  if (!receipt.sourceTargetId) {
    return {
      scraped: true,
      discovered: 0,
      queuedDetails: 0,
      skipped: "TARGET_NOT_RESOLVED",
    };
  }

  const outcome: { discovered: number; queuedDetails: number } =
    await ctx.runAction(internal.ingestion.ingestPageDocument, {
      eventId: receipt.eventId,
      sourceTargetId: receipt.sourceTargetId,
      pageUrl,
      markdown,
      maxEntries: args.maxEntries,
    });
  if (outcome.queuedDetails > 0) {
    await ctx.runMutation(internal.sourcePipeline.continueDetailBacklog, {});
  }
  return {
    scraped: true,
    discovered: outcome.discovered,
    queuedDetails: outcome.queuedDetails,
  };
}

/** Scrapes one reviewed target exactly once and ingests what it finds. */
export const scrapeTargetOnce = internalAction({
  args: {
    sourceTargetId: v.id("sourceTargets"),
    maxEntries: v.optional(v.number()),
    force: v.optional(v.boolean()),
  },
  returns: v.object({
    scraped: v.boolean(),
    discovered: v.number(),
    queuedDetails: v.number(),
    skipped: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<ScrapeOutcome> => {
    if (!envValue("FIRECRAWL_API_KEY")) {
      return {
        scraped: false,
        discovered: 0,
        queuedDetails: 0,
        skipped: "FIRECRAWL_NOT_CONFIGURED",
      };
    }
    const targets: Array<{
      sourceTargetId: Id<"sourceTargets">;
      sourceSlug: string;
      sourceName: string;
      url: string;
    }> = await ctx.runQuery(internal.sourcePipeline.listScrapeTargets, {
      limit: 200,
    });
    const target = targets.find(
      (row) => row.sourceTargetId === args.sourceTargetId,
    );
    if (target === undefined) {
      return {
        scraped: false,
        discovered: 0,
        queuedDetails: 0,
        skipped: "TARGET_NOT_ACTIVE",
      };
    }
    return await scrapeAndIngest(ctx, {
      sourceTargetId: target.sourceTargetId,
      url: target.url,
      maxEntries: args.maxEntries,
      force: args.force,
    });
  },
});

/**
 * Scrapes every target of every active source once. Targets are processed
 * sequentially so the Firecrawl concurrency budget stays available for the
 * detail backlog that this run queues.
 */
export const scrapeAllOnce = internalAction({
  args: {
    slug: v.optional(v.string()),
    limit: v.optional(v.number()),
    maxEntries: v.optional(v.number()),
    force: v.optional(v.boolean()),
    /** Total targets this run may collect before stopping. */
    maxTargets: v.optional(v.number()),
    /** Only collect targets not already scraped in this sweep. */
    since: v.optional(v.number()),
    chain: v.optional(v.boolean()),
  },
  returns: v.object({
    targets: v.number(),
    scraped: v.number(),
    discovered: v.number(),
    queuedDetails: v.number(),
    remainingBudget: v.number(),
    chained: v.boolean(),
    failures: v.array(v.object({ url: v.string(), error: v.string() })),
  }),
  handler: async (ctx, args): Promise<{
    targets: number;
    scraped: number;
    discovered: number;
    queuedDetails: number;
    remainingBudget: number;
    chained: boolean;
    failures: Array<{ url: string; error: string }>;
  }> => {
    if (!envValue("FIRECRAWL_API_KEY")) {
      return {
        targets: 0,
        scraped: 0,
        discovered: 0,
        queuedDetails: 0,
        remainingBudget: 0,
        chained: false,
        failures: [{ url: "", error: "FIRECRAWL_NOT_CONFIGURED" }],
      };
    }
    if (await ctx.runQuery(internal.sourcePipeline.isStopRequested, {})) {
      throw new ConvexError({ code: "STOP_REQUESTED" });
    }
    // One timestamp identifies the sweep; targets collected at or after it are
    // skipped, so each chained run moves on instead of paying twice.
    const since = args.since ?? Date.now();
    const maxTargets = Math.max(1, Math.floor(args.maxTargets ?? 10_000));
    const targets: Array<{
      sourceTargetId: Id<"sourceTargets">;
      sourceSlug: string;
      sourceName: string;
      url: string;
    }> = await ctx.runQuery(internal.sourcePipeline.listScrapeTargets, {
      limit: Math.max(1, Math.min(100, Math.floor(args.limit ?? 25))),
      slug: args.slug,
    });
    let scraped = 0;
    let discovered = 0;
    let queuedDetails = 0;
    const failures: Array<{ url: string; error: string }> = [];
    // Targets run a few at a time: each costs a scrape plus a model
    // extraction, so serial runs approach the action deadline, and the
    // provider's own concurrency budget caps how wide this can safely go.
    const CONCURRENCY = 4;
    for (let start = 0; start < targets.length; start += CONCURRENCY) {
      const wave = targets.slice(start, start + CONCURRENCY);
      const outcomes = await Promise.all(
        wave.map(async (target) => {
          try {
            const outcome = await scrapeAndIngest(ctx, {
              sourceTargetId: target.sourceTargetId,
              url: target.url,
              maxEntries: args.maxEntries,
              force: args.force,
            });
            await ctx.runMutation(internal.sourcePipeline.markTargetScraped, {
              sourceTargetId: target.sourceTargetId,
              succeeded: outcome.discovered > 0,
            });
            return { target, outcome, error: null as string | null };
          } catch (error) {
            // A failed target is still marked so the chain does not retry it.
            await ctx.runMutation(internal.sourcePipeline.markTargetScraped, {
              sourceTargetId: target.sourceTargetId,
              succeeded: false,
            });
            return {
              target,
              outcome: null,
              error:
                error instanceof Error
                  ? error.message.slice(0, 300)
                  : "Scrape failed",
            };
          }
        }),
      );
      for (const result of outcomes) {
        if (result.outcome === null) {
          failures.push({ url: result.target.url, error: result.error ?? "" });
          continue;
        }
        if (result.outcome.scraped) scraped += 1;
        discovered += result.outcome.discovered;
        queuedDetails += result.outcome.queuedDetails;
      }
    }
    const remainingBudget = Math.max(0, maxTargets - targets.length);
    const stopRequested: boolean = await ctx.runQuery(
      internal.sourcePipeline.isStopRequested,
      {},
    );
    const chained =
      (args.chain ?? true) &&
      targets.length > 0 &&
      remainingBudget > 0 &&
      !stopRequested;
    if (chained) {
      await ctx.scheduler.runAfter(
        2_000,
        internal.sourcePipelineActions.scrapeAllOnce,
        {
          slug: args.slug,
          limit: args.limit,
          maxEntries: args.maxEntries,
          force: args.force,
          maxTargets: remainingBudget,
          since,
          chain: true,
        },
      );
    }
    return {
      targets: targets.length,
      scraped,
      discovered,
      queuedDetails,
      remainingBudget,
      chained,
      failures,
    };
  },
});
