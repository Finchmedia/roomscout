import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUserId } from "./integrations/authz";
import { savedNeedLocationLabel, savedNeedLocationQuery } from "./lib/savedNeedLocation";

const preferenceValidator = v.union(
  v.literal("include"), v.literal("prefer"), v.literal("neutral"), v.literal("exclude"),
);
const portalPreferenceValidator = v.union(v.literal("include"), v.literal("exclude"));
const sourceItemValidator = v.object({
  platformId: v.id("sourcePlatforms"),
  name: v.string(),
  domain: v.string(),
  platformStatus: v.string(),
  supplyStatus: v.optional(v.string()),
  demandStatus: v.optional(v.string()),
  confidence: v.number(),
  lastObservedAt: v.optional(v.number()),
  hasIndexedEvidence: v.boolean(),
  preference: preferenceValidator,
});

async function hasPublicIndexedEvidence(
  ctx: QueryCtx,
  sourceIds: Id<"sources">[],
  sourceTargetIds: Id<"sourceTargets">[],
) {
  const targetIds = new Set(sourceTargetIds.map(String));
  const targets = [...sourceTargetIds];
  for (const sourceId of sourceIds) {
    for (const target of await ctx.db.query("sourceTargets").withIndex("by_source", (q) => q.eq("sourceId", sourceId)).take(20)) {
      if (targetIds.has(String(target._id))) continue;
      targetIds.add(String(target._id));
      targets.push(target._id);
    }
  }
  for (const targetId of targets.slice(0, 40)) {
    const entries = await ctx.db.query("sourceEntries")
      .withIndex("by_target_and_status", (q) => q.eq("sourceTargetId", targetId).eq("status", "active"))
      .take(20);
    for (const entry of entries) {
      if (entry.detailState !== "processed") continue;
      const signal = entry.signalId
        ? await ctx.db.get(entry.signalId)
        : await ctx.db.query("signals").withIndex("by_source_entry", (q) => q.eq("sourceEntryId", entry._id)).first();
      if (signal?.status === "published") return true;
    }
  }
  return false;
}

export const listForNeed = query({
  args: { savedNeedId: v.id("savedNeeds"), limit: v.optional(v.number()) },
  returns: v.object({
    city: v.string(),
    areaResolved: v.boolean(),
    sources: v.array(sourceItemValidator),
    disclosure: v.string(),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.savedNeedId);
    if (need === null || need.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" });
    const location = savedNeedLocationQuery(need);
    const label = savedNeedLocationLabel(need);
    const normalizedCity = location.toLowerCase().replace(/\s+/g, " ");
    const area = normalizedCity
      ? await ctx.db.query("geoAreas").withIndex("by_country_code_and_normalized_name", (q) => q.eq("countryCode", "DE").eq("normalizedName", normalizedCity)).first()
      : null;
    if (area === null) {
      return { city: label, areaResolved: false, sources: [], disclosure: "No reviewed source coverage has been mapped to this search center yet." };
    }
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 50)));
    const [supply, demand, preferences] = await Promise.all([
      ctx.db.query("sourceCoverage").withIndex("by_geo_area_and_side_and_status", (q) => q.eq("geoAreaId", area._id).eq("side", "supply")).take(limit),
      ctx.db.query("sourceCoverage").withIndex("by_geo_area_and_side_and_status", (q) => q.eq("geoAreaId", area._id).eq("side", "demand")).take(limit),
      ctx.db.query("searchSourcePreferences").withIndex("by_saved_need_and_platform", (q) => q.eq("savedNeedId", need._id)).take(limit),
    ]);
    const preferenceByPlatform = new Map(preferences.map((row) => [String(row.platformId), row.preference]));
    const byPlatform = new Map<string, { supply?: (typeof supply)[number]; demand?: (typeof demand)[number] }>();
    for (const row of supply) byPlatform.set(String(row.platformId), { ...(byPlatform.get(String(row.platformId)) ?? {}), supply: row });
    for (const row of demand) byPlatform.set(String(row.platformId), { ...(byPlatform.get(String(row.platformId)) ?? {}), demand: row });
    const sources = [];
    for (const [platformKey, coverage] of byPlatform) {
      const platformId = (coverage.supply ?? coverage.demand)!.platformId;
      const platform = await ctx.db.get(platformId);
      if (platform === null) continue;
      const observed = [coverage.supply?.lastObservedAt, coverage.demand?.lastObservedAt].filter((value): value is number => value !== undefined);
      const coverageRows = [];
      if (coverage.supply) coverageRows.push(coverage.supply);
      if (coverage.demand) coverageRows.push(coverage.demand);
      const hasIndexedEvidence = await hasPublicIndexedEvidence(
        ctx,
        coverageRows.flatMap((row) => row.sourceId ? [row.sourceId] : []),
        coverageRows.flatMap((row) => row.sourceTargetId ? [row.sourceTargetId] : []),
      );
      sources.push({
        platformId,
        name: platform.name,
        domain: platform.canonicalDomain,
        platformStatus: platform.status,
        supplyStatus: coverage.supply?.status,
        demandStatus: coverage.demand?.status,
        confidence: Math.max(coverage.supply?.confidence ?? 0, coverage.demand?.confidence ?? 0),
        lastObservedAt: observed.length ? Math.max(...observed) : undefined,
        hasIndexedEvidence,
        preference: platform.status === "restricted"
          ? "exclude" as const
          : preferenceByPlatform.get(platformKey) ?? "neutral" as const,
      });
    }
    return {
      city: label,
      areaResolved: true,
      sources: sources.sort((a, b) => b.confidence - a.confidence).slice(0, limit),
      disclosure: "Coverage describes reviewed public sources RoomScout knows about; it is not a claim that the whole market is indexed.",
    };
  },
});

export const setPreference = mutation({
  args: { savedNeedId: v.id("savedNeeds"), platformId: v.id("sourcePlatforms"), preference: preferenceValidator, reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    await setPlatformPreference(ctx, { ...args, ownerId });
    return null;
  },
});

async function setPlatformPreference(
  ctx: MutationCtx,
  args: {
    ownerId: Id<"users">;
    savedNeedId: Id<"savedNeeds">;
    platformId: Id<"sourcePlatforms">;
    preference: "include" | "prefer" | "neutral" | "exclude";
    reason?: string;
  },
) {
  const [need, platform] = await Promise.all([
    ctx.db.get(args.savedNeedId),
    ctx.db.get(args.platformId),
  ]);
  if (need === null || need.ownerId !== args.ownerId) {
    throw new ConvexError({ code: "NEED_NOT_FOUND" });
  }
  if (platform === null || platform.status === "restricted") {
    throw new ConvexError({ code: "PLATFORM_NOT_AVAILABLE" });
  }
  const existing = await ctx.db
    .query("searchSourcePreferences")
    .withIndex("by_saved_need_and_platform", (q) =>
      q.eq("savedNeedId", need._id).eq("platformId", platform._id),
    )
    .unique();
  const now = Date.now();
  if (existing !== null) {
    if (existing.ownerId !== args.ownerId) throw new ConvexError({ code: "FORBIDDEN" });
    await ctx.db.patch(existing._id, {
      preference: args.preference,
      reason: args.reason?.trim().slice(0, 300),
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("searchSourcePreferences", {
      ownerId: args.ownerId,
      savedNeedId: need._id,
      platformId: platform._id,
      preference: args.preference,
      reason: args.reason?.trim().slice(0, 300),
      createdAt: now,
      updatedAt: now,
    });
  }
}

export const getPortalPreferences = query({
  args: { savedNeedId: v.id("savedNeeds") },
  returns: v.array(v.object({
    sourceId: v.id("sources"),
    preference: portalPreferenceValidator,
  })),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.savedNeedId);
    if (need === null || need.ownerId !== ownerId) {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    const connections = await ctx.db
      .query("portalConnections")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(100);
    const result: Array<{ sourceId: Id<"sources">; preference: "include" | "exclude" }> = [];
    const seen = new Set<string>();
    for (const connection of connections) {
      if (seen.has(String(connection.sourceId))) continue;
      const source = await ctx.db.get(connection.sourceId);
      const platformId = connection.platformId ?? source?.platformId;
      if (!platformId || (connection.platformId && source?.platformId && connection.platformId !== source.platformId)) continue;
      const platform = await ctx.db.get(platformId);
      if (platform === null) continue;
      const stored = await ctx.db
        .query("searchSourcePreferences")
        .withIndex("by_saved_need_and_platform", (q) =>
          q.eq("savedNeedId", need._id).eq("platformId", platformId),
        )
        .unique();
      seen.add(String(connection.sourceId));
      result.push({
        sourceId: connection.sourceId,
        preference: platform.status === "restricted" || stored?.preference === "exclude" ? "exclude" : "include",
      });
    }
    return result;
  },
});

export const setPortalPreference = mutation({
  args: {
    savedNeedId: v.id("savedNeeds"),
    sourceId: v.id("sources"),
    preference: portalPreferenceValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const connection = await ctx.db
      .query("portalConnections")
      .withIndex("by_owner_and_source", (q) =>
        q.eq("ownerId", ownerId).eq("sourceId", args.sourceId),
      )
      .unique();
    if (connection === null) throw new ConvexError({ code: "PORTAL_NOT_FOUND" });
    const source = await ctx.db.get(connection.sourceId);
    const platformId = connection.platformId ?? source?.platformId;
    if (!platformId || (connection.platformId && source?.platformId && connection.platformId !== source.platformId)) {
      throw new ConvexError({ code: "PLATFORM_NOT_AVAILABLE" });
    }
    await setPlatformPreference(ctx, {
      ownerId,
      savedNeedId: args.savedNeedId,
      platformId,
      preference: args.preference,
    });
    return null;
  },
});
