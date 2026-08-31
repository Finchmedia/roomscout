import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { stableFingerprint } from "./integrations/fingerprints";
import { redactContactData } from "./integrations/piiRedaction";
import {
  canonicalDomain,
  canonicalizeUrl,
} from "./integrations/urlCanonicalization";

const sourceSide = v.union(
  v.literal("supply"),
  v.literal("demand"),
  v.literal("both"),
);
const discoveryMethod = v.union(
  v.literal("manual"),
  v.literal("firecrawl_search"),
  v.literal("source_link"),
  v.literal("operator_seed"),
);

function boundedText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export const beginBatch = internalMutation({
  args: {
    batchKey: v.string(),
    geoAreaId: v.optional(v.id("geoAreas")),
    side: sourceSide,
    query: v.string(),
  },
  returns: v.object({
    batchId: v.id("sourceDiscoveryBatches"),
    duplicate: v.boolean(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
  }),
  handler: async (ctx, args) => {
    const batchKey = boundedText(args.batchKey, 200);
    const existing = await ctx.db
      .query("sourceDiscoveryBatches")
      .withIndex("by_batch_key", (q) => q.eq("batchKey", batchKey))
      .unique();
    if (existing !== null) {
      return {
        batchId: existing._id,
        duplicate: true,
        status: existing.status,
      };
    }

    if (args.geoAreaId !== undefined && (await ctx.db.get(args.geoAreaId)) === null) {
      throw new ConvexError({ code: "GEO_AREA_NOT_FOUND" });
    }
    const now = Date.now();
    const batchId = await ctx.db.insert("sourceDiscoveryBatches", {
      batchKey,
      geoAreaId: args.geoAreaId,
      side: args.side,
      query: boundedText(args.query, 500),
      status: "running",
      candidateCount: 0,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { batchId, duplicate: false, status: "running" as const };
  },
});

export const upsertCandidate = internalMutation({
  args: {
    batchId: v.id("sourceDiscoveryBatches"),
    url: v.string(),
    name: v.string(),
    snippet: v.string(),
    confidence: v.number(),
    discoveryMethod,
    geoAreaId: v.optional(v.id("geoAreas")),
    side: sourceSide,
    discoveredFromPlatformId: v.optional(v.id("sourcePlatforms")),
  },
  returns: v.object({
    candidateId: v.id("sourceCandidates"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (batch === null || batch.status !== "running") {
      throw new ConvexError({ code: "DISCOVERY_BATCH_NOT_RUNNING" });
    }
    const canonicalUrl = canonicalizeUrl(args.url);
    const domain = canonicalDomain(args.url);
    if (canonicalUrl === null || domain === null) {
      throw new ConvexError({ code: "INVALID_SOURCE_URL" });
    }
    if (args.confidence < 0 || args.confidence > 1) {
      throw new ConvexError({ code: "INVALID_CONFIDENCE" });
    }
    if (args.geoAreaId !== undefined && (await ctx.db.get(args.geoAreaId)) === null) {
      throw new ConvexError({ code: "GEO_AREA_NOT_FOUND" });
    }
    if (
      args.discoveredFromPlatformId !== undefined &&
      (await ctx.db.get(args.discoveredFromPlatformId)) === null
    ) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    }

    const canonicalKey = stableFingerprint(canonicalUrl);
    const existing = await ctx.db
      .query("sourceCandidates")
      .withIndex("by_canonical_key", (q) => q.eq("canonicalKey", canonicalKey))
      .unique();
    const now = Date.now();
    const snippet = redactContactData(boundedText(args.snippet, 1_500)).redacted;
    const name = redactContactData(boundedText(args.name, 180)).redacted;
    if (existing !== null) {
      await ctx.db.patch(existing._id, {
        name: name || existing.name,
        snippet: snippet || existing.snippet,
        geoAreaId: args.geoAreaId ?? existing.geoAreaId,
        confidence: Math.max(existing.confidence, args.confidence),
        lastSeenAt: now,
        updatedAt: now,
      });
      return { candidateId: existing._id, created: false };
    }

    const candidateId = await ctx.db.insert("sourceCandidates", {
      canonicalKey,
      canonicalUrl,
      canonicalDomain: domain,
      name: name || domain,
      geoAreaId: args.geoAreaId,
      side: args.side,
      discoveryMethod: args.discoveryMethod,
      snippet,
      confidence: args.confidence,
      status: "new",
      discoveredFromPlatformId: args.discoveredFromPlatformId,
      firstSeenAt: now,
      lastSeenAt: now,
      updatedAt: now,
    });
    return { candidateId, created: true };
  },
});

export const completeBatch = internalMutation({
  args: {
    batchId: v.id("sourceDiscoveryBatches"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    candidateCount: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.batchId);
    if (batch === null) {
      throw new ConvexError({ code: "DISCOVERY_BATCH_NOT_FOUND" });
    }
    if (batch.status !== "running") return null;
    if (!Number.isInteger(args.candidateCount) || args.candidateCount < 0) {
      throw new ConvexError({ code: "INVALID_CANDIDATE_COUNT" });
    }
    const now = Date.now();
    await ctx.db.patch(batch._id, {
      status: args.status,
      candidateCount: args.candidateCount,
      error:
        args.status === "failed"
          ? boundedText(args.error ?? "Discovery failed", 1_000)
          : undefined,
      completedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const resolveGermanGeoArea = internalQuery({
  args: { normalizedName: v.string() },
  returns: v.union(v.id("geoAreas"), v.null()),
  handler: async (ctx, args) => {
    const normalizedName = boundedText(args.normalizedName, 160).toLowerCase();
    const row = await ctx.db
      .query("geoAreas")
      .withIndex("by_country_code_and_normalized_name", (q) =>
        q.eq("countryCode", "DE").eq("normalizedName", normalizedName),
      )
      .first();
    return row?._id ?? null;
  },
});
