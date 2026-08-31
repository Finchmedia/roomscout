import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";

const precision = v.union(
  v.literal("exact"),
  v.literal("postal_code"),
  v.literal("district"),
  v.literal("city"),
  v.literal("unknown"),
);

function queryKey(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

type MapboxFeature = {
  id?: string;
  geometry?: { coordinates?: unknown };
};

type MapboxResponse = { features?: MapboxFeature[] };

export const getSignalLocation = internalQuery({
  args: { signalId: v.id("signals") },
  returns: v.union(
    v.object({
      query: v.string(),
      queryKey: v.string(),
      precision,
      city: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (!signal || (signal.status !== "published" && signal.status !== "stale")) return null;
    if (signal.latitude !== undefined && signal.longitude !== undefined) return null;
    const location = signal.locationLabel?.trim() || [signal.district, signal.city].filter(Boolean).join(", ");
    if (!location) return null;
    return {
      query: `${location}, Germany`,
      queryKey: queryKey(`${location}, Germany`),
      precision: signal.locationPrecision ?? (signal.district ? "district" : "city"),
      city: signal.city,
    };
  },
});

export const getCachedGeocode = internalQuery({
  args: { queryKey: v.string() },
  returns: v.union(
    v.object({
      geocodeId: v.id("geocodes"),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      status: v.union(v.literal("ready"), v.literal("not_found"), v.literal("failed")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.query("geocodes").withIndex("by_query_key", (q) => q.eq("queryKey", args.queryKey)).unique();
    return row ? { geocodeId: row._id, latitude: row.latitude, longitude: row.longitude, status: row.status } : null;
  },
});

export const storeGeocode = internalMutation({
  args: {
    signalId: v.id("signals"),
    queryKey: v.string(),
    query: v.string(),
    precision,
    status: v.union(v.literal("ready"), v.literal("not_found"), v.literal("failed")),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    providerFeatureId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (!signal) return null;
    const existing = await ctx.db.query("geocodes").withIndex("by_query_key", (q) => q.eq("queryKey", args.queryKey)).unique();
    const now = Date.now();
    const values = {
      query: args.query,
      precision: args.precision,
      provider: "mapbox" as const,
      status: args.status,
      latitude: args.latitude,
      longitude: args.longitude,
      providerFeatureId: args.providerFeatureId,
      error: args.error?.slice(0, 500),
      updatedAt: now,
    };
    const geocodeId = existing
      ? (await ctx.db.patch(existing._id, values), existing._id)
      : await ctx.db.insert("geocodes", { ...values, queryKey: args.queryKey, createdAt: now });
    if (args.status === "ready" && args.latitude !== undefined && args.longitude !== undefined) {
      await ctx.db.patch(signal._id, {
        geocodeId,
        latitude: args.latitude,
        longitude: args.longitude,
        locationPrecision: args.precision,
      });
      await ctx.scheduler.runAfter(0, internal.map.rebuildArea, { city: signal.city });
    }
    return null;
  },
});

export const geocodeSignal = internalAction({
  args: { signalId: v.id("signals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const location = await ctx.runQuery(internal.map.getSignalLocation, args);
    if (!location) return null;
    const cached = await ctx.runQuery(internal.map.getCachedGeocode, { queryKey: location.queryKey });
    if (cached) {
      await ctx.runMutation(internal.map.storeGeocode, {
        signalId: args.signalId,
        queryKey: location.queryKey,
        query: location.query,
        precision: location.precision,
        status: cached.status,
        latitude: cached.latitude,
        longitude: cached.longitude,
      });
      return null;
    }
    const token = process.env.MAPBOX_SECRET_TOKEN;
    if (!token) return null;
    const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
    url.searchParams.set("q", location.query.slice(0, 256));
    url.searchParams.set("access_token", token);
    url.searchParams.set("country", "de");
    url.searchParams.set("limit", "1");
    url.searchParams.set("autocomplete", "false");
    url.searchParams.set("permanent", "true");
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Mapbox geocoding returned ${response.status}`);
      const payload = await response.json() as MapboxResponse;
      const feature = payload.features?.[0];
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2 || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") {
        await ctx.runMutation(internal.map.storeGeocode, { signalId: args.signalId, ...location, status: "not_found" });
        return null;
      }
      await ctx.runMutation(internal.map.storeGeocode, {
        signalId: args.signalId,
        ...location,
        status: "ready",
        longitude: coordinates[0],
        latitude: coordinates[1],
        providerFeatureId: feature?.id,
      });
    } catch (error) {
      await ctx.runMutation(internal.map.storeGeocode, {
        signalId: args.signalId,
        ...location,
        status: "failed",
        error: error instanceof Error ? error.message : "Geocoding failed",
      });
    }
    return null;
  },
});

export const rebuildArea = internalMutation({
  args: { city: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const signals = [];
    for (const status of ["published", "stale"] as const) {
      signals.push(...await ctx.db.query("signals").withIndex("by_city_and_status", (q) => q.eq("city", args.city).eq("status", status)).take(500));
    }
    const positioned = signals.filter((signal) => signal.latitude !== undefined && signal.longitude !== undefined);
    if (positioned.length === 0) return null;
    const cityKey = queryKey(args.city);
    const existing = await ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", cityKey)).unique();
    const values = {
      city: args.city,
      countryCode: "DE",
      latitude: positioned.reduce((sum, signal) => sum + signal.latitude!, 0) / positioned.length,
      longitude: positioned.reduce((sum, signal) => sum + signal.longitude!, 0) / positioned.length,
      supplyCount: signals.filter((signal) => signal.side === "supply").length,
      demandCount: signals.filter((signal) => signal.side === "demand").length,
      verifiedCount: signals.filter((signal) => signal.verification === "verified").length,
      freshCount: signals.filter((signal) => signal.status === "published").length,
      lastSignalAt: Math.max(...signals.map((signal) => signal.lastSeenAt)),
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, values);
    else await ctx.db.insert("marketAreas", { ...values, cityKey });
    return null;
  },
});

export const listAreas = query({
  args: {},
  returns: v.array(v.object({
    city: v.string(), latitude: v.number(), longitude: v.number(), supplyCount: v.number(), demandCount: v.number(), verifiedCount: v.number(), freshCount: v.number(), lastSignalAt: v.optional(v.number()),
  })),
  handler: async (ctx) => {
    const rows = await ctx.db.query("marketAreas").take(100);
    return rows.map((row) => ({ city: row.city, latitude: row.latitude, longitude: row.longitude, supplyCount: row.supplyCount, demandCount: row.demandCount, verifiedCount: row.verifiedCount, freshCount: row.freshCount, lastSignalAt: row.lastSignalAt }));
  },
});

export const listPins = query({
  args: {
    city: v.string(),
    side: v.optional(v.union(v.literal("supply"), v.literal("demand"))),
    arrangement: v.optional(v.union(v.literal("permanent"), v.literal("shared"), v.literal("hourly"), v.literal("unknown"))),
    freshOnly: v.optional(v.boolean()),
    verifiedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    signalId: v.id("signals"), side: v.union(v.literal("supply"), v.literal("demand")), title: v.string(), city: v.string(), district: v.optional(v.string()), latitude: v.number(), longitude: v.number(), precision, status: v.union(v.literal("published"), v.literal("stale")), verification: v.union(v.literal("observed"), v.literal("verified"), v.literal("conflicting")), arrangement: v.union(v.literal("permanent"), v.literal("shared"), v.literal("hourly"), v.literal("unknown")), lastSeenAt: v.number(), sourceUrl: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(300, Math.floor(args.limit ?? 200)));
    const statuses = args.freshOnly ? ["published" as const] : ["published" as const, "stale" as const];
    const candidates = [];
    for (const status of statuses) {
      candidates.push(...await ctx.db.query("signals").withIndex("by_city_and_status", (q) => q.eq("city", args.city).eq("status", status)).order("desc").take(limit));
    }
    const result = [];
    for (const signal of candidates) {
      if (signal.latitude === undefined || signal.longitude === undefined) continue;
      if (args.side && signal.side !== args.side) continue;
      if (args.arrangement && signal.arrangement !== args.arrangement) continue;
      if (args.verifiedOnly && signal.verification !== "verified") continue;
      const evidence = await ctx.db.query("signalEvidence").withIndex("by_signal", (q) => q.eq("signalId", signal._id)).order("desc").first();
      result.push({ signalId: signal._id, side: signal.side, title: signal.title, city: signal.city, district: signal.district, latitude: signal.latitude, longitude: signal.longitude, precision: signal.locationPrecision ?? "unknown" as const, status: signal.status as "published" | "stale", verification: signal.verification, arrangement: signal.arrangement, lastSeenAt: signal.lastSeenAt, sourceUrl: evidence?.sourceUrl });
      if (result.length >= limit) break;
    }
    return result;
  },
});
