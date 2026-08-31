import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { redactPublicText } from "./lib/privacy";

const MIGRATION_NAME = "redact_evidence_and_backfill_signal_location_v1";
const BATCH_SIZE = 50;

export const backfillEvidenceAndSignals = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    migrationRunId: v.optional(v.id("migrationRuns")),
  },
  returns: v.object({ processed: v.number(), complete: v.boolean() }),
  handler: async (ctx, args): Promise<{ processed: number; complete: boolean }> => {
    let migrationRunId = args.migrationRunId;
    if (migrationRunId === undefined) {
      const existing = await ctx.db
        .query("migrationRuns")
        .withIndex("by_name", (q) => q.eq("name", MIGRATION_NAME))
        .unique();
      if (existing?.status === "completed") {
        return { processed: 0, complete: true };
      }
      const now = Date.now();
      migrationRunId = existing?._id ?? await ctx.db.insert("migrationRuns", {
        name: MIGRATION_NAME,
        status: "running",
        processed: 0,
        startedAt: now,
        updatedAt: now,
      });
      if (existing !== null) {
        await ctx.db.patch(existing._id, {
          status: "running",
          error: undefined,
          updatedAt: now,
        });
      }
    }

    const page = await ctx.db.query("signalEvidence").paginate({
      cursor: args.cursor ?? null,
      numItems: BATCH_SIZE,
    });
    let processed = 0;
    for (const evidence of page.page) {
      const excerpt = redactPublicText(evidence.excerpt);
      if (excerpt !== evidence.excerpt) {
        await ctx.db.patch(evidence._id, { excerpt });
      }
      const signal = await ctx.db.get(evidence.signalId);
      if (signal !== null && signal.locationPrecision === undefined) {
        await ctx.db.patch(signal._id, {
          locationLabel: [signal.district, signal.city].filter(Boolean).join(", "),
          locationPrecision: signal.district ? "district" : "city",
        });
      }
      processed += 1;
    }

    const run = await ctx.db.get(migrationRunId);
    if (run !== null) {
      await ctx.db.patch(migrationRunId, {
        cursor: page.isDone ? undefined : page.continueCursor,
        processed: run.processed + processed,
        status: page.isDone ? "completed" : "running",
        completedAt: page.isDone ? Date.now() : undefined,
        updatedAt: Date.now(),
      });
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillEvidenceAndSignals, {
        cursor: page.continueCursor,
        migrationRunId,
      });
    }
    return { processed, complete: page.isDone };
  },
});

const PILOT_GEOS = [
  { key: "de", name: "Germany", normalizedName: "germany", type: "country" as const, latitude: 51.1657, longitude: 10.4515 },
  { key: "de:stuttgart", name: "Stuttgart", normalizedName: "stuttgart", type: "city" as const, latitude: 48.7758, longitude: 9.1829 },
  { key: "de:berlin", name: "Berlin", normalizedName: "berlin", type: "city" as const, latitude: 52.52, longitude: 13.405 },
  { key: "de:hamburg", name: "Hamburg", normalizedName: "hamburg", type: "city" as const, latitude: 53.5511, longitude: 9.9937 },
] as const;

const PILOT_PLATFORMS = [
  { slug: "musiker-in-deiner-stadt", name: "Musiker in deiner Stadt", domain: "musiker-in-deiner-stadt.de", sourceSlugs: ["musiker-in-deiner-stadt-room-demand"], geoKey: "de:stuttgart", sides: ["demand"] as const },
  { slug: "musiker-sucht", name: "Musiker-sucht.de", domain: "musiker-sucht.de", sourceSlugs: ["musiker-sucht-berlin"], geoKey: "de:berlin", sides: ["supply", "demand"] as const },
  { slug: "bandnet-hamburg", name: "Bandnet Hamburg", domain: "bandnet.hamburg", sourceSlugs: ["bandnet-hamburg-room-supply", "bandnet-hamburg-room-demand"], geoKey: "de:hamburg", sides: ["supply", "demand"] as const },
] as const;

export const seedPilotSourceIntelligence = internalMutation({
  args: {},
  returns: v.object({ geoAreas: v.number(), platforms: v.number(), links: v.number(), coverage: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    let geoAreas = 0;
    let platforms = 0;
    let links = 0;
    let coverage = 0;
    const geoIds = new Map<string, import("./_generated/dataModel").Id<"geoAreas">>();
    for (const geo of PILOT_GEOS) {
      let row = await ctx.db.query("geoAreas").withIndex("by_key", (q) => q.eq("key", geo.key)).unique();
      if (row === null) {
        const id = await ctx.db.insert("geoAreas", { ...geo, countryCode: "DE", status: "active", createdAt: now, updatedAt: now });
        row = await ctx.db.get(id);
        geoAreas += 1;
      }
      if (row !== null) geoIds.set(geo.key, row._id);
    }
    for (const seed of PILOT_PLATFORMS) {
      let platform = await ctx.db.query("sourcePlatforms").withIndex("by_canonical_domain", (q) => q.eq("canonicalDomain", seed.domain)).unique();
      if (platform === null) {
        const id = await ctx.db.insert("sourcePlatforms", { slug: seed.slug, name: seed.name, canonicalDomain: seed.domain, kind: "community", status: "reviewing", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
        platform = await ctx.db.get(id);
        platforms += 1;
      }
      const geoAreaId = geoIds.get(seed.geoKey);
      if (platform === null || geoAreaId === undefined) continue;
      for (const sourceSlug of seed.sourceSlugs) {
        const source = await ctx.db.query("sources").withIndex("by_slug", (q) => q.eq("slug", sourceSlug)).unique();
        if (source !== null && source.platformId !== platform._id) {
          await ctx.db.patch(source._id, { platformId: platform._id, updatedAt: now });
          links += 1;
        }
        for (const side of seed.sides) {
          const existing = await ctx.db.query("sourceCoverage").withIndex("by_platform_and_geo_area_and_side", (q) => q.eq("platformId", platform!._id).eq("geoAreaId", geoAreaId).eq("side", side)).first();
          if (existing === null) {
            await ctx.db.insert("sourceCoverage", { platformId: platform._id, sourceId: source?._id, geoAreaId, side, mode: "explicit_page", status: "inferred", confidence: 0.5, lastObservedAt: now, createdAt: now, updatedAt: now });
            coverage += 1;
          }
        }
      }
    }
    return { geoAreas, platforms, links, coverage };
  },
});
