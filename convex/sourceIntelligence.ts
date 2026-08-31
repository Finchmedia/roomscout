import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";

const platformKind = v.union(
  v.literal("classifieds"),
  v.literal("community"),
  v.literal("marketplace"),
  v.literal("directory"),
  v.literal("studio_network"),
  v.literal("other"),
);
const platformStatus = v.union(
  v.literal("candidate"),
  v.literal("reviewing"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("restricted"),
);
const candidateStatus = v.union(
  v.literal("new"),
  v.literal("reviewing"),
  v.literal("promoted"),
  v.literal("ignored"),
  v.literal("merged"),
);
const signalSide = v.union(v.literal("supply"), v.literal("demand"));
const sourceSide = v.union(
  v.literal("supply"),
  v.literal("demand"),
  v.literal("both"),
);

const platformItem = v.object({
  id: v.id("sourcePlatforms"),
  slug: v.string(),
  name: v.string(),
  canonicalDomain: v.string(),
  kind: platformKind,
  status: platformStatus,
  firstSeenAt: v.number(),
  lastObservedAt: v.number(),
  updatedAt: v.number(),
});
const candidateItem = v.object({
  id: v.id("sourceCandidates"),
  canonicalUrl: v.string(),
  canonicalDomain: v.string(),
  name: v.string(),
  geoAreaId: v.optional(v.id("geoAreas")),
  side: sourceSide,
  snippet: v.string(),
  confidence: v.number(),
  status: candidateStatus,
  promotedPlatformId: v.optional(v.id("sourcePlatforms")),
  mergedIntoCandidateId: v.optional(v.id("sourceCandidates")),
  firstSeenAt: v.number(),
  lastSeenAt: v.number(),
});

function cleanSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export const listPlatforms = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(platformItem),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const result = await ctx.db
      .query("sourcePlatforms")
      .withIndex("by_status_and_last_observed_at")
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((platform) => ({
        id: platform._id,
        slug: platform.slug,
        name: platform.name,
        canonicalDomain: platform.canonicalDomain,
        kind: platform.kind,
        status: platform.status,
        firstSeenAt: platform.firstSeenAt,
        lastObservedAt: platform.lastObservedAt,
        updatedAt: platform.updatedAt,
      })),
    };
  },
});

export const listCandidates = query({
  args: {
    status: candidateStatus,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(candidateItem),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const result = await ctx.db
      .query("sourceCandidates")
      .withIndex("by_status_and_last_seen_at", (q) => q.eq("status", args.status))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((candidate) => ({
        id: candidate._id,
        canonicalUrl: candidate.canonicalUrl,
        canonicalDomain: candidate.canonicalDomain,
        name: candidate.name,
        geoAreaId: candidate.geoAreaId,
        side: candidate.side,
        snippet: candidate.snippet,
        confidence: candidate.confidence,
        status: candidate.status,
        promotedPlatformId: candidate.promotedPlatformId,
        mergedIntoCandidateId: candidate.mergedIntoCandidateId,
        firstSeenAt: candidate.firstSeenAt,
        lastSeenAt: candidate.lastSeenAt,
      })),
    };
  },
});

export const promoteCandidate = mutation({
  args: {
    candidateId: v.id("sourceCandidates"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    kind: platformKind,
  },
  returns: v.object({
    platformId: v.id("sourcePlatforms"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const candidate = await ctx.db.get(args.candidateId);
    if (candidate === null) {
      throw new ConvexError({ code: "SOURCE_CANDIDATE_NOT_FOUND" });
    }
    if (candidate.status === "merged" || candidate.status === "ignored") {
      throw new ConvexError({ code: "SOURCE_CANDIDATE_NOT_PROMOTABLE" });
    }
    if (candidate.promotedPlatformId !== undefined) {
      return { platformId: candidate.promotedPlatformId, created: false };
    }

    const existing = await ctx.db
      .query("sourcePlatforms")
      .withIndex("by_canonical_domain", (q) =>
        q.eq("canonicalDomain", candidate.canonicalDomain),
      )
      .unique();
    const now = Date.now();
    if (existing !== null) {
      await ctx.db.patch(candidate._id, {
        status: "promoted",
        promotedPlatformId: existing._id,
        updatedAt: now,
      });
      await ctx.db.patch(existing._id, {
        lastObservedAt: Math.max(existing.lastObservedAt, candidate.lastSeenAt),
        updatedAt: now,
      });
      return { platformId: existing._id, created: false };
    }

    const slug = cleanSlug(args.slug ?? candidate.name);
    if (slug.length < 2) throw new ConvexError({ code: "INVALID_PLATFORM_SLUG" });
    const slugConflict = await ctx.db
      .query("sourcePlatforms")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (slugConflict !== null) {
      throw new ConvexError({ code: "PLATFORM_SLUG_ALREADY_EXISTS" });
    }
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug,
      name: (args.name ?? candidate.name).trim().slice(0, 180),
      canonicalDomain: candidate.canonicalDomain,
      kind: args.kind,
      status: "reviewing",
      firstSeenAt: candidate.firstSeenAt,
      lastObservedAt: candidate.lastSeenAt,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(candidate._id, {
      status: "promoted",
      promotedPlatformId: platformId,
      updatedAt: now,
    });
    return { platformId, created: true };
  },
});

export const ensureSourceForPlatform = mutation({
  args: {
    platformId: v.id("sourcePlatforms"),
    side: sourceSide,
    accessMode: v.union(v.literal("public"), v.literal("authenticated")),
    geographicScope: v.optional(v.string()),
  },
  returns: v.object({ sourceId: v.id("sources"), created: v.boolean() }),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const platform = await ctx.db.get(args.platformId);
    if (platform === null) throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    const existing = await ctx.db.query("sources").withIndex("by_platform", (q) => q.eq("platformId", platform._id)).first();
    if (existing) return { sourceId: existing._id, created: false };
    const baseSlug = cleanSlug(platform.slug || platform.name);
    let slug = baseSlug;
    for (let suffix = 2; await ctx.db.query("sources").withIndex("by_slug", (q) => q.eq("slug", slug)).unique(); suffix += 1) {
      slug = `${baseSlug}-${suffix}`.slice(0, 80);
    }
    const now = Date.now();
    const sourceId = await ctx.db.insert("sources", {
      platformId: platform._id,
      slug,
      name: platform.name,
      baseUrl: `https://${platform.canonicalDomain}`,
      side: args.side,
      status: "reviewing",
      health: "unknown",
      geographicScope: args.geographicScope?.trim().slice(0, 200),
      accessMode: args.accessMode,
      automationReview: "pending",
      policyNotes: "Created from the reviewed platform directory. Review terms, allowed paths, and each flow before connecting users or starting collection.",
      publicDisplay: false,
      createdAt: now,
      updatedAt: now,
    });
    return { sourceId, created: true };
  },
});

export const mergeCandidates = mutation({
  args: {
    sourceCandidateId: v.id("sourceCandidates"),
    targetCandidateId: v.id("sourceCandidates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    if (args.sourceCandidateId === args.targetCandidateId) {
      throw new ConvexError({ code: "CANNOT_MERGE_CANDIDATE_INTO_ITSELF" });
    }
    const [source, target] = await Promise.all([
      ctx.db.get(args.sourceCandidateId),
      ctx.db.get(args.targetCandidateId),
    ]);
    if (source === null || target === null) {
      throw new ConvexError({ code: "SOURCE_CANDIDATE_NOT_FOUND" });
    }
    if (target.status === "merged" || target.status === "ignored") {
      throw new ConvexError({ code: "INVALID_MERGE_TARGET" });
    }
    if (source.status === "promoted") {
      throw new ConvexError({ code: "PROMOTED_CANDIDATE_CANNOT_BE_MERGED" });
    }
    const now = Date.now();
    await ctx.db.patch(target._id, {
      confidence: Math.max(target.confidence, source.confidence),
      firstSeenAt: Math.min(target.firstSeenAt, source.firstSeenAt),
      lastSeenAt: Math.max(target.lastSeenAt, source.lastSeenAt),
      updatedAt: now,
    });
    await ctx.db.patch(source._id, {
      status: "merged",
      mergedIntoCandidateId: target._id,
      updatedAt: now,
    });
    return null;
  },
});

export const linkSourcePlatform = mutation({
  args: {
    sourceId: v.id("sources"),
    platformId: v.id("sourcePlatforms"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const [source, platform] = await Promise.all([
      ctx.db.get(args.sourceId),
      ctx.db.get(args.platformId),
    ]);
    if (source === null) throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    if (platform === null) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    }
    await ctx.db.patch(source._id, {
      platformId: platform._id,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const upsertGeoArea = mutation({
  args: {
    key: v.string(),
    name: v.string(),
    countryCode: v.string(),
    type: v.union(
      v.literal("country"),
      v.literal("region"),
      v.literal("city"),
      v.literal("district"),
      v.literal("postal_code"),
    ),
    parentId: v.optional(v.id("geoAreas")),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  returns: v.id("geoAreas"),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const key = args.key.trim().toLowerCase().slice(0, 160);
    const existing = await ctx.db
      .query("geoAreas")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const now = Date.now();
    const fields = {
      name: args.name.trim().slice(0, 160),
      normalizedName: args.name.trim().toLowerCase().replace(/\s+/g, " "),
      countryCode: args.countryCode.trim().toUpperCase().slice(0, 2),
      type: args.type,
      parentId: args.parentId,
      latitude: args.latitude,
      longitude: args.longitude,
      status: "reviewing" as const,
      updatedAt: now,
    };
    if (existing !== null) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("geoAreas", {
      key,
      ...fields,
      createdAt: now,
    });
  },
});

export const seedConservativeCoverage = mutation({
  args: {
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    geoAreaId: v.id("geoAreas"),
    side: signalSide,
    evidenceUrl: v.optional(v.string()),
  },
  returns: v.object({
    coverageId: v.id("sourceCoverage"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const [platform, geoArea] = await Promise.all([
      ctx.db.get(args.platformId),
      ctx.db.get(args.geoAreaId),
    ]);
    if (platform === null) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    }
    if (geoArea === null) throw new ConvexError({ code: "GEO_AREA_NOT_FOUND" });
    const candidates = await ctx.db
      .query("sourceCoverage")
      .withIndex("by_platform_and_geo_area_and_side", (q) =>
        q
          .eq("platformId", args.platformId)
          .eq("geoAreaId", args.geoAreaId)
          .eq("side", args.side),
      )
      .take(20);
    const existing = candidates.find(
      (coverage) =>
        coverage.sourceId === args.sourceId &&
        coverage.sourceTargetId === args.sourceTargetId,
    );
    const now = Date.now();
    if (existing !== undefined) {
      if (existing.status === "inferred") {
        await ctx.db.patch(existing._id, {
          evidenceUrl: args.evidenceUrl?.slice(0, 1_000),
          lastObservedAt: now,
          updatedAt: now,
        });
      }
      return { coverageId: existing._id, created: false };
    }
    const coverageId = await ctx.db.insert("sourceCoverage", {
      platformId: args.platformId,
      sourceId: args.sourceId,
      sourceTargetId: args.sourceTargetId,
      geoAreaId: args.geoAreaId,
      side: args.side,
      mode: "inferred",
      status: "inferred",
      confidence: 0.35,
      lastObservedAt: now,
      evidenceUrl: args.evidenceUrl?.slice(0, 1_000),
      createdAt: now,
      updatedAt: now,
    });
    return { coverageId, created: true };
  },
});
