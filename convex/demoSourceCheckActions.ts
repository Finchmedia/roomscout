"use node";

import { randomUUID } from "node:crypto";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import {
  CONTROLLED_SOURCE_PROOF_CONFIRMATION,
  CONTROLLED_SOURCE_URL,
} from "./integrations/controlledSourceProofConfig";
import { envValue } from "./integrations/env";
import { stableFingerprint } from "./integrations/fingerprints";
import { DEMO_DETAILS_PER_CHECK } from "./demoSourceChecks";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

/** Best-effort automatic shutdown; it never retries a provider mutation. */
export const cleanup = internalAction({
  args: { generation: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!(await ctx.runQuery(internal.demoSourceChecks.canCleanup, args)))
      return null;
    // The global source and Native Monitor outlive this bounded check. Cleanup
    // intentionally has no provider mutation to avoid coupling public indexing
    // to a user-triggered demo run.
    return null;
  },
});

export const runCheck = internalAction({
  args: { generation: v.string(), checkNumber: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const claim: { remainingDetailBudget: number } | null =
      await ctx.runMutation(internal.demoSourceChecks.claimRun, args);
    if (!claim) return null;
    try {
      if (!envValue("FIRECRAWL_API_KEY"))
        throw new Error("FIRECRAWL_NOT_CONFIGURED");
      const prepared: { sourceTargetId: Id<"sourceTargets"> } =
        await ctx.runMutation(internal.controlledSourceProof.prepare, {
          confirmation: CONTROLLED_SOURCE_PROOF_CONFIRMATION,
        });
      const document = await firecrawl.scrapeOnce(ctx, CONTROLLED_SOURCE_URL, {
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 0,
      });
      if (!document.markdown)
        throw new Error("Firecrawl returned no markdown for roomscout.dev");
      if (
        !(await ctx.runMutation(internal.demoSourceChecks.markProcessing, {
          generation: args.generation,
        }))
      )
        return null;

      const providerEventId = `demo-source:${args.generation}:${args.checkNumber}`;
      const receipt: {
        eventId: Id<"ingestionEvents">;
        sourceTargetId?: Id<"sourceTargets">;
        duplicate: boolean;
      } = await ctx.runMutation(internal.ingestion.recordFirecrawlEvent, {
        providerEventId,
        sourceTargetId: prepared.sourceTargetId,
        eventType: "demo.source.scrape",
        payloadHash: stableFingerprint(document.markdown),
        changeStatus: "changed",
        pageUrl: CONTROLLED_SOURCE_URL,
      });
      if (!receipt.sourceTargetId)
        throw new Error("Controlled source target was not recognized");
      await ctx.runAction(internal.ingestion.ingestPageDocument, {
        eventId: receipt.eventId,
        sourceTargetId: receipt.sourceTargetId,
        pageUrl: CONTROLLED_SOURCE_URL,
        markdown: document.markdown,
        maxEntries: DEMO_DETAILS_PER_CHECK,
      });

      const leaseId = randomUUID();
      const jobs: Array<{
        sourceEntryId: Id<"sourceEntries">;
        detailUrl: string;
        leaseId: string;
      }> = await ctx.runMutation(internal.demoSourceChecks.claimDetails, {
        generation: args.generation,
        sourceTargetId: receipt.sourceTargetId,
        leaseId,
        limit: Math.min(DEMO_DETAILS_PER_CHECK, claim.remainingDetailBudget),
      });
      const outcomes = await Promise.all(
        jobs.map(async (job) => {
          try {
            const detail = await firecrawl.scrapeOnce(ctx, job.detailUrl, {
              formats: ["markdown"],
              onlyMainContent: true,
              maxAge: 0,
            });
            if (!detail.markdown)
              throw new Error("Firecrawl returned no detail markdown");
            const ok = await ctx.runAction(
              internal.ingestion.normalizeDetailDocument,
              {
                sourceEntryId: job.sourceEntryId,
                leaseId: job.leaseId,
                markdown: detail.markdown,
              },
            );
            if (!ok)
              await ctx.runMutation(
                internal.demoSourceChecks.failDetailPermanently,
                {
                  sourceEntryId: job.sourceEntryId,
                  leaseId: job.leaseId,
                  error:
                    "Detail normalization failed; demo retries are disabled.",
                },
              );
            return ok;
          } catch (error) {
            await ctx.runMutation(
              internal.demoSourceChecks.failDetailPermanently,
              {
                sourceEntryId: job.sourceEntryId,
                leaseId: job.leaseId,
                error:
                  error instanceof Error
                    ? error.message
                    : "Detail scrape failed",
              },
            );
            return false;
          }
        }),
      );
      await ctx.runMutation(internal.demoSourceChecks.finishRun, {
        generation: args.generation,
        checkNumber: args.checkNumber,
        detailPagesUsed: outcomes.length,
      });
    } catch (error) {
      await ctx.runMutation(internal.demoSourceChecks.failRun, {
        generation: args.generation,
        error:
          error instanceof Error ? error.message : "Demo source check failed",
      });
    }
    return null;
  },
});
