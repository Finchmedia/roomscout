import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./integrations/authz";

const preferenceValidator = v.union(
  v.literal("include"), v.literal("prefer"), v.literal("neutral"), v.literal("exclude"),
);
const sourceItemValidator = v.object({
  platformId: v.id("sourcePlatforms"),
  name: v.string(),
  domain: v.string(),
  platformStatus: v.string(),
  supplyStatus: v.optional(v.string()),
  demandStatus: v.optional(v.string()),
  confidence: v.number(),
  lastObservedAt: v.optional(v.number()),
  preference: preferenceValidator,
});

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
    const normalizedCity = need.city.trim().toLowerCase().replace(/\s+/g, " ");
    const area = normalizedCity
      ? await ctx.db.query("geoAreas").withIndex("by_country_code_and_normalized_name", (q) => q.eq("countryCode", "DE").eq("normalizedName", normalizedCity)).first()
      : null;
    if (area === null) {
      return { city: need.city, areaResolved: false, sources: [], disclosure: "No reviewed source coverage has been mapped to this city yet." };
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
      if (platform === null || platform.status === "restricted") continue;
      const observed = [coverage.supply?.lastObservedAt, coverage.demand?.lastObservedAt].filter((value): value is number => value !== undefined);
      sources.push({
        platformId,
        name: platform.name,
        domain: platform.canonicalDomain,
        platformStatus: platform.status,
        supplyStatus: coverage.supply?.status,
        demandStatus: coverage.demand?.status,
        confidence: Math.max(coverage.supply?.confidence ?? 0, coverage.demand?.confidence ?? 0),
        lastObservedAt: observed.length ? Math.max(...observed) : undefined,
        preference: preferenceByPlatform.get(platformKey) ?? "neutral" as const,
      });
    }
    return {
      city: need.city,
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
    const [need, platform] = await Promise.all([ctx.db.get(args.savedNeedId), ctx.db.get(args.platformId)]);
    if (need === null || need.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" });
    if (platform === null || platform.status === "restricted") throw new ConvexError({ code: "PLATFORM_NOT_AVAILABLE" });
    const existing = await ctx.db.query("searchSourcePreferences").withIndex("by_saved_need_and_platform", (q) => q.eq("savedNeedId", need._id).eq("platformId", platform._id)).unique();
    const now = Date.now();
    if (existing !== null) {
      if (existing.ownerId !== ownerId) throw new ConvexError({ code: "FORBIDDEN" });
      await ctx.db.patch(existing._id, { preference: args.preference, reason: args.reason?.trim().slice(0, 300), updatedAt: now });
    } else {
      await ctx.db.insert("searchSourcePreferences", { ownerId, savedNeedId: need._id, platformId: platform._id, preference: args.preference, reason: args.reason?.trim().slice(0, 300), createdAt: now, updatedAt: now });
    }
    return null;
  },
});
