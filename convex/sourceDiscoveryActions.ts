"use node";

import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import { normalizeDiscoveryHit } from "./lib/sourceCandidate";
import {
  namedVenueQuery,
  namedVenueSlice,
  pickVenueMatch,
} from "./lib/berlinStudyVenues";
import { discoveryQuerySlice } from "./lib/sourceDiscoveryQueries";
import { TOS_REVIEW_SNIPPET_PREFIX } from "./lib/sourceHostPolicy";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

/** Confidence a plain search hit carries into review. */
const DISCOVERY_CONFIDENCE = 0.45;
/** Domains that restrict automated access sort last in the review queue. */
const TOS_REVIEW_CONFIDENCE = 0.2;

type SliceResult = {
  queriesAttempted: number;
  candidatesSeen: number;
  candidatesCreated: number;
  nextCursor: number | null;
  totalQueries: number;
};

async function runDiscoverySlice(
  ctx: ActionCtx,
  args: { cursor: number; queryLimit: number; resultsPerQuery: number },
): Promise<SliceResult> {
  const slice = discoveryQuerySlice({
    cursor: args.cursor,
    limit: args.queryLimit,
  });
  const resultsPerQuery = Math.min(
    10,
    Math.max(1, Math.floor(args.resultsPerQuery)),
  );
  let candidatesSeen = 0;
  let candidatesCreated = 0;

  for (const discovery of slice.queries) {
    const geoAreaId = await ctx.runQuery(
      internal.sourceDiscovery.resolveGermanGeoArea,
      { normalizedName: discovery.location },
    );
    const batchDate = new Date().toISOString().slice(0, 10);
    const batchKey = `firecrawl:germany:v1:${batchDate}:${discovery.key}`;
    const batch = await ctx.runMutation(internal.sourceDiscovery.beginBatch, {
      batchKey,
      geoAreaId: geoAreaId ?? undefined,
      side: discovery.side,
      query: discovery.query,
    });
    if (batch.duplicate) continue;
    try {
      const response = await firecrawl.search(ctx, discovery.query, {
        sources: ["web"],
        limit: resultsPerQuery,
        location: "Germany",
        ignoreInvalidURLs: true,
        highlights: false,
      });
      const unique = new Map<
        string,
        NonNullable<ReturnType<typeof normalizeDiscoveryHit>>
      >();
      for (const hit of response.web ?? []) {
        const metadata =
          "metadata" in hit &&
          typeof hit.metadata === "object" &&
          hit.metadata !== null
            ? (hit.metadata as Record<string, unknown>)
            : undefined;
        const directUrl =
          "url" in hit && typeof hit.url === "string" ? hit.url : undefined;
        const sourceUrl =
          typeof metadata?.sourceURL === "string"
            ? metadata.sourceURL
            : typeof metadata?.url === "string"
              ? metadata.url
              : undefined;
        const url = directUrl ?? sourceUrl;
        if (!url) continue;
        const normalized = normalizeDiscoveryHit({
          url,
          title:
            "title" in hit && typeof hit.title === "string"
              ? hit.title
              : typeof metadata?.title === "string"
                ? metadata.title
                : undefined,
          description:
            "description" in hit && typeof hit.description === "string"
              ? hit.description
              : typeof metadata?.description === "string"
                ? metadata.description
                : undefined,
        });
        if (normalized !== null) unique.set(normalized.canonicalKey, normalized);
      }
      for (const candidate of unique.values()) {
        candidatesSeen += 1;
        const stored = await ctx.runMutation(
          internal.sourceDiscovery.upsertCandidate,
          {
            batchId: batch.batchId,
            url: candidate.canonicalUrl,
            name: candidate.title,
            snippet: candidate.tosReviewRequired
              ? `${TOS_REVIEW_SNIPPET_PREFIX}${candidate.snippet}`
              : candidate.snippet,
            confidence: candidate.tosReviewRequired
              ? TOS_REVIEW_CONFIDENCE
              : DISCOVERY_CONFIDENCE,
            discoveryMethod: "firecrawl_search",
            geoAreaId: geoAreaId ?? undefined,
            side: discovery.side,
          },
        );
        if (stored.created) candidatesCreated += 1;
      }
      await ctx.runMutation(internal.sourceDiscovery.completeBatch, {
        batchId: batch.batchId,
        status: "completed",
        candidateCount: unique.size,
      });
    } catch (error) {
      await ctx.runMutation(internal.sourceDiscovery.completeBatch, {
        batchId: batch.batchId,
        status: "failed",
        candidateCount: 0,
        error:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Discovery failed",
      });
    }
  }

  return {
    queriesAttempted: slice.queries.length,
    candidatesSeen,
    candidatesCreated,
    nextCursor: slice.nextCursor,
    totalQueries: slice.total,
  };
}

/** Operator-driven single slice behind the /ops review surface. */
export const runGermanySlice = action({
  args: {
    cursor: v.number(),
    queryLimit: v.optional(v.number()),
    resultsPerQuery: v.optional(v.number()),
  },
  returns: v.object({
    queriesAttempted: v.number(),
    candidatesSeen: v.number(),
    candidatesCreated: v.number(),
    nextCursor: v.union(v.number(), v.null()),
    totalQueries: v.number(),
  }),
  handler: async (ctx, args): Promise<SliceResult> => {
    const userId = await requireActionUserId(ctx);
    if (!(await ctx.runQuery(internal.users.isOperatorInternal, { userId }))) {
      throw new ConvexError({ code: "FORBIDDEN" });
    }
    if (!envValue("FIRECRAWL_API_KEY")) {
      throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
    }
    return await runDiscoverySlice(ctx, {
      cursor: args.cursor,
      queryLimit: Math.min(3, Math.max(1, Math.floor(args.queryLimit ?? 1))),
      resultsPerQuery: args.resultsPerQuery ?? 5,
    });
  },
});

/**
 * CLI-driven sweep over the whole city list. Each invocation runs a bounded
 * batch of queries and then schedules itself for the next batch, so a sweep
 * survives the action time limit and needs no cron. It stops on its own at the
 * end of the query list or when `maxQueries` is spent. Discovery only ever
 * writes candidate rows; nothing here activates a source or fetches a page.
 */
export const sweepGermany = internalAction({
  args: {
    cursor: v.optional(v.number()),
    queriesPerBatch: v.optional(v.number()),
    resultsPerQuery: v.optional(v.number()),
    /** Total query budget for this sweep; each query costs ~2 credits. */
    maxQueries: v.optional(v.number()),
    /** False runs a single batch and stops, for a cheap dry run. */
    chain: v.optional(v.boolean()),
    delayMs: v.optional(v.number()),
  },
  returns: v.object({
    cursor: v.number(),
    queriesAttempted: v.number(),
    candidatesSeen: v.number(),
    candidatesCreated: v.number(),
    nextCursor: v.union(v.number(), v.null()),
    totalQueries: v.number(),
    remainingBudget: v.number(),
    chained: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{
    cursor: number;
    queriesAttempted: number;
    candidatesSeen: number;
    candidatesCreated: number;
    nextCursor: number | null;
    totalQueries: number;
    remainingBudget: number;
    chained: boolean;
  }> => {
    if (!envValue("FIRECRAWL_API_KEY")) {
      throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
    }
    if (await ctx.runQuery(internal.sourcePipeline.isStopRequested, {})) {
      // A stop stays in force until an operator clears it, so a restart is
      // always deliberate rather than an accidental resume.
      throw new ConvexError({ code: "STOP_REQUESTED" });
    }
    const cursor = Math.max(0, Math.floor(args.cursor ?? 0));
    const queriesPerBatch = Math.max(
      1,
      Math.min(25, Math.floor(args.queriesPerBatch ?? 10)),
    );
    const maxQueries = Math.max(1, Math.floor(args.maxQueries ?? 10_000));
    const chain = args.chain ?? true;
    const delayMs = Math.max(0, Math.min(60_000, args.delayMs ?? 2_000));
    const batchSize = Math.min(queriesPerBatch, maxQueries);

    const result = await runDiscoverySlice(ctx, {
      cursor,
      queryLimit: batchSize,
      resultsPerQuery: args.resultsPerQuery ?? 5,
    });
    const remainingBudget = Math.max(0, maxQueries - result.queriesAttempted);
    const stopRequested: boolean = await ctx.runQuery(
      internal.sourcePipeline.isStopRequested,
      {},
    );
    const chained =
      chain &&
      result.nextCursor !== null &&
      remainingBudget > 0 &&
      !stopRequested;
    if (chained) {
      await ctx.scheduler.runAfter(
        delayMs,
        internal.sourceDiscoveryActions.sweepGermany,
        {
          cursor: result.nextCursor ?? 0,
          queriesPerBatch,
          resultsPerQuery: args.resultsPerQuery,
          maxQueries: remainingBudget,
          chain: true,
          delayMs,
        },
      );
    }
    return {
      cursor,
      queriesAttempted: result.queriesAttempted,
      candidatesSeen: result.candidatesSeen,
      candidatesCreated: result.candidatesCreated,
      nextCursor: result.nextCursor,
      totalQueries: result.totalQueries,
      remainingBudget,
      chained,
    };
  },
});

/** Confidence for a venue an operator named from a study. */
const NAMED_VENUE_CONFIDENCE = 0.7;
/** Descriptive entries are not brand names, so the name match is weaker. */
const DESCRIPTIVE_VENUE_CONFIDENCE = 0.5;

/**
 * Resolves operator-supplied venue names to their official sites.
 *
 * A study gives names, not URLs, so each name is searched once and the first
 * result that survives the host policy becomes a candidate. These enter review
 * above search-discovered candidates because a human already vouched for the
 * venue; they are still candidates, and still need promotion and activation.
 */
export const resolveNamedVenues = internalAction({
  args: {
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
    chain: v.optional(v.boolean()),
    delayMs: v.optional(v.number()),
  },
  returns: v.object({
    cursor: v.number(),
    attempted: v.number(),
    resolved: v.number(),
    created: v.number(),
    unresolved: v.array(v.string()),
    nextCursor: v.union(v.number(), v.null()),
    total: v.number(),
    chained: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{
    cursor: number;
    attempted: number;
    resolved: number;
    created: number;
    unresolved: string[];
    nextCursor: number | null;
    total: number;
    chained: boolean;
  }> => {
    if (!envValue("FIRECRAWL_API_KEY")) {
      throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
    }
    if (await ctx.runQuery(internal.sourcePipeline.isStopRequested, {})) {
      // A stop stays in force until an operator clears it, so a restart is
      // always deliberate rather than an accidental resume.
      throw new ConvexError({ code: "STOP_REQUESTED" });
    }
    const cursor = Math.max(0, Math.floor(args.cursor ?? 0));
    const slice = namedVenueSlice({
      cursor,
      limit: Math.max(1, Math.min(30, Math.floor(args.limit ?? 10))),
    });
    const geoAreaId = await ctx.runQuery(
      internal.sourceDiscovery.resolveGermanGeoArea,
      { normalizedName: "berlin" },
    );
    const batchDate = new Date().toISOString().slice(0, 10);
    const batch = await ctx.runMutation(internal.sourceDiscovery.beginBatch, {
      batchKey: `operator:berlin-study:v1:${batchDate}:${cursor}`,
      geoAreaId: geoAreaId ?? undefined,
      side: "supply",
      query: `Berlin study venues ${cursor}-${cursor + slice.venues.length}`,
    });

    let resolved = 0;
    let created = 0;
    const unresolved: string[] = [];

    if (!batch.duplicate) {
      for (const venue of slice.venues) {
        try {
          const response = await firecrawl.search(ctx, namedVenueQuery(venue), {
            sources: ["web"],
            limit: 3,
            location: "Germany",
            ignoreInvalidURLs: true,
            highlights: false,
          });
          const options = [];
          for (const hit of response.web ?? []) {
            const url =
              "url" in hit && typeof hit.url === "string" ? hit.url : undefined;
            if (!url) continue;
            const normalized = normalizeDiscoveryHit({
              url,
              title:
                "title" in hit && typeof hit.title === "string"
                  ? hit.title
                  : venue.name,
              description:
                "description" in hit && typeof hit.description === "string"
                  ? hit.description
                  : undefined,
            });
            if (normalized !== null) options.push(normalized);
          }
          const match = pickVenueMatch(venue, options);
          if (match === null) {
            unresolved.push(venue.name);
            continue;
          }
          const chosen = options.find(
            (option) => option.canonicalUrl === match.canonicalUrl,
          );
          if (chosen === undefined) {
            unresolved.push(venue.name);
            continue;
          }
          const outcome = await ctx.runMutation(
            internal.sourceDiscovery.upsertCandidate,
            {
              batchId: batch.batchId,
              url: chosen.canonicalUrl,
              // The study's name is the reviewable identity, not the page title.
              name: venue.name,
              snippet: chosen.tosReviewRequired
                ? `${TOS_REVIEW_SNIPPET_PREFIX}${chosen.snippet}`
                : chosen.snippet,
              confidence: chosen.tosReviewRequired
                ? TOS_REVIEW_CONFIDENCE
                : venue.descriptive
                  ? DESCRIPTIVE_VENUE_CONFIDENCE
                  : NAMED_VENUE_CONFIDENCE,
              discoveryMethod: "operator_seed",
              geoAreaId: geoAreaId ?? undefined,
              side: "supply",
            },
          );
          if (outcome.created) created += 1;
          resolved += 1;
        } catch {
          unresolved.push(venue.name);
        }
      }
      await ctx.runMutation(internal.sourceDiscovery.completeBatch, {
        batchId: batch.batchId,
        status: "completed",
        candidateCount: created,
      });
    }

    const chain = args.chain ?? true;
    const stopRequested: boolean = await ctx.runQuery(
      internal.sourcePipeline.isStopRequested,
      {},
    );
    const chained = chain && slice.nextCursor !== null && !stopRequested;
    if (chained) {
      await ctx.scheduler.runAfter(
        Math.max(0, Math.min(60_000, args.delayMs ?? 2_000)),
        internal.sourceDiscoveryActions.resolveNamedVenues,
        {
          cursor: slice.nextCursor ?? 0,
          limit: args.limit,
          chain: true,
          delayMs: args.delayMs,
        },
      );
    }
    return {
      cursor,
      attempted: slice.venues.length,
      resolved,
      created,
      unresolved,
      nextCursor: slice.nextCursor,
      total: slice.total,
      chained,
    };
  },
});
