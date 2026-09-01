"use node";

import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import { normalizeDiscoveryHit } from "./lib/sourceCandidate";
import { discoveryQuerySlice } from "./lib/sourceDiscoveryQueries";
import { roomScoutRateLimiter } from "./rateLimits";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

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
  handler: async (ctx, args) => {
    const userId = await requireActionUserId(ctx);
    if (!(await ctx.runQuery(internal.users.isOperatorInternal, { userId }))) {
      throw new ConvexError({ code: "FORBIDDEN" });
    }
    await roomScoutRateLimiter.limit(ctx, "sourceDiscoveryOperator", {
      key: userId,
      throws: true,
    });
    const apiKey = envValue("FIRECRAWL_API_KEY");
    if (!apiKey) throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
    const slice = discoveryQuerySlice({
      cursor: args.cursor,
      limit: Math.min(3, Math.max(1, Math.floor(args.queryLimit ?? 1))),
    });
    const resultsPerQuery = Math.min(10, Math.max(1, Math.floor(args.resultsPerQuery ?? 5)));
    let candidatesSeen = 0;
    let candidatesCreated = 0;
    for (const discovery of slice.queries) {
      const geoAreaId = await ctx.runQuery(internal.sourceDiscovery.resolveGermanGeoArea, {
        normalizedName: discovery.location,
      });
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
        const unique = new Map<string, ReturnType<typeof normalizeDiscoveryHit>>();
        for (const hit of response.web ?? []) {
          const metadata =
            "metadata" in hit &&
            typeof hit.metadata === "object" &&
            hit.metadata !== null
              ? (hit.metadata as Record<string, unknown>)
              : undefined;
          const directUrl = "url" in hit && typeof hit.url === "string"
            ? hit.url
            : undefined;
          const sourceUrl = typeof metadata?.sourceURL === "string"
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
          if (candidate === null) continue;
          candidatesSeen += 1;
          const stored = await ctx.runMutation(internal.sourceDiscovery.upsertCandidate, {
            batchId: batch.batchId,
            url: candidate.canonicalUrl,
            name: candidate.title,
            snippet: candidate.snippet,
            confidence: 0.45,
            discoveryMethod: "firecrawl_search",
            geoAreaId: geoAreaId ?? undefined,
            side: discovery.side,
          });
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
          error: error instanceof Error ? error.message.slice(0, 500) : "Discovery failed",
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
  },
});
