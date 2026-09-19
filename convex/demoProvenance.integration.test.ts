/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { isControlledDemoOrigin } from "./lib/demoProvenance";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

const baseSignal = {
  side: "supply" as const,
  title: "Rehearsal room",
  city: "Berlin",
  summary: "Shared room",
  arrangement: "shared" as const,
  requirements: [],
  unknowns: [],
  status: "published" as const,
  verification: "observed" as const,
  sourceCount: 1,
};

it("derives demo provenance only from the exact HTTPS roomscout.dev origin", () => {
  expect(isControlledDemoOrigin("https://roomscout.dev/listings/one")).toBe(true);
  expect(isControlledDemoOrigin("http://roomscout.dev/listings/one")).toBe(false);
  expect(isControlledDemoOrigin("https://roomscout.dev.evil.example/listings/one")).toBe(false);
  expect(isControlledDemoOrigin("https://lookalike-roomscout.dev/listings/one")).toBe(false);
});

it("stamps ingestion provenance and never corroborates demo evidence with a real source", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "proof-platform", name: "Proof", canonicalDomain: "example.test", kind: "community",
      status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now,
    });
    const make = async (suffix: string, baseUrl: string) => {
      const sourceId = await ctx.db.insert("sources", {
        platformId, slug: `source-${suffix}`, name: suffix, baseUrl, side: "supply", status: "active",
        health: "healthy", accessMode: "public", automationReview: "approved", createdAt: now, updatedAt: now,
      });
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId, url: baseUrl, mode: "scrape", changeTrackingTag: suffix, scheduleMinutes: 60,
        nextRunAt: now, paused: false, createdAt: now, updatedAt: now,
      });
      const eventId = await ctx.db.insert("ingestionEvents", {
        provider: "firecrawl", providerEventId: `event-${suffix}`, sourceTargetId: targetId,
        eventType: "crawl", status: "received", payloadHash: suffix, receivedAt: now,
      });
      return { targetId, eventId };
    };
    return {
      demo: await make("demo", "https://roomscout.dev/listings"),
      real: await make("real", "https://real.example/listings"),
    };
  });
  const upsert = async (target: typeof fixture.demo, sourceUrl: string, fingerprint: string) =>
    await t.mutation(internal.ingestion.upsertNormalizedSignal, {
      eventId: target.eventId, sourceTargetId: target.targetId, sourceUrl, sourceTitle: "Listing",
      excerpt: "Public rehearsal room", fingerprint, title: "Same room", city: "Berlin",
      summary: "Shared rehearsal room", arrangement: "shared", requirements: [], unknowns: [],
      ...(sourceUrl.includes("roomscout.dev") ? { imageUrl: "https://roomscout.dev/demo-rooms/one.webp" } : {}),
    });
  const demoId = await upsert(fixture.demo, "https://roomscout.dev/listings/one", "demo-fingerprint");
  const realId = await upsert(fixture.real, "https://real.example/listings/one", "real-fingerprint");
  expect(demoId).not.toBeNull();
  expect(realId).not.toBeNull();
  expect(realId).not.toBe(demoId);
  const rows = await t.run((ctx) => ctx.db.query("signals").collect());
  expect(rows).toHaveLength(2);
  expect(rows.find((row) => row._id === demoId)).toMatchObject({ isDemo: true, providerSimulation: "ai_simulated" });
  expect(rows.find((row) => row._id === realId)?.isDemo).toBe(false);
  expect(rows.find((row) => row._id === realId)?.providerSimulation).toBeUndefined();
  expect((await t.query(api.signals.get, { signalId: demoId! }))?.signal)
    .toMatchObject({ isDemo: true, providerSimulation: "ai_simulated", imageUrl: "https://roomscout.dev/demo-rooms/one.webp" });

  const projectionFixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "provenance-owner", role: "musician", createdAt: now, lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Berlin room", city: "Berlin", districts: [], arrangement: [], schedule: [],
      requirements: [], status: "active", matchingRevision: 1, createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("providerConversations", {
      ownerId, savedNeedId, signalId: demoId!, conversationKey: "provenance-demo",
      agentThreadId: "provider-provenance-thread", revision: 0, state: "waiting",
      createdAt: now, updatedAt: now,
    });
    return { ownerId, savedNeedId };
  });
  expect(await t.withIdentity({ subject: projectionFixture.ownerId }).query(api.providerConversations.listMine, {
    savedNeedId: projectionFixture.savedNeedId,
  })).toMatchObject([{
    isDemo: true,
    providerSimulation: "ai_simulated",
    imageUrl: "https://roomscout.dev/demo-rooms/one.webp",
  }]);
});

it("marks every exact controlled-host listing as AI-simulated without per-listing prose", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const sourceId = await ctx.db.insert("sources", {
      slug: "controlled-listings", name: "Controlled listings", baseUrl: "https://roomscout.dev/listings",
      side: "supply", status: "active", health: "healthy", accessMode: "public",
      automationReview: "approved", createdAt: now, updatedAt: now,
    });
    const targetId = await ctx.db.insert("sourceTargets", {
      sourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: "controlled:v1",
      scheduleMinutes: 60, nextRunAt: now, paused: false, createdAt: now, updatedAt: now,
    });
    const eventId = await ctx.db.insert("ingestionEvents", {
      provider: "firecrawl", providerEventId: "controlled-list-event", sourceTargetId: targetId,
      eventType: "crawl", status: "received", payloadHash: "controlled-list", receivedAt: now,
    });
    const detailEntryId = await ctx.db.insert("sourceEntries", {
      sourceId, sourceTargetId: targetId, externalId: "detail-ai",
      canonicalUrl: "https://roomscout.dev/listings/detail-ai", detailUrl: "https://roomscout.dev/listings/detail-ai",
      title: "Detail room", excerpt: "Pending detail", side: "supply", city: "Hamburg",
      status: "active", detailState: "fetching", detailAttempts: 1, detailLeaseId: "detail-lease",
      detailLeaseExpiresAt: now + 60_000, firstSeenAt: now, lastSeenAt: now, updatedAt: now,
    });
    return { eventId, targetId, detailEntryId };
  });

  await t.mutation(internal.ingestion.upsertSourceEntries, {
    eventId: fixture.eventId,
    sourceTargetId: fixture.targetId,
    pageUrl: "https://roomscout.dev/listings",
    entries: [
      {
        externalId: "list-ai", canonicalUrl: "https://roomscout.dev/listings/list-ai",
        detailUrl: "https://roomscout.dev/listings", title: "AI disclosed room",
        imageUrl: "https://roomscout.dev/demo-rooms/list-ai.webp",
        excerpt: "Public room listing", side: "supply", city: "Berlin",
        contentFingerprint: "list-ai-v1", contactDataPresent: false, summary: "Controlled room",
        arrangement: "shared", requirements: [], unknowns: [],
      },
      {
        externalId: "list-generic", canonicalUrl: "https://roomscout.dev/listings/list-generic",
        detailUrl: "https://roomscout.dev/listings", title: "Generic controlled room",
        excerpt: "Controlled demonstration listing", side: "supply", city: "Potsdam",
        contentFingerprint: "list-generic-v1", contactDataPresent: false, summary: "Controlled room",
        arrangement: "shared", requirements: [], unknowns: [],
      },
    ],
  });
  expect(await t.mutation(internal.ingestion.completeDetailNormalization, {
    sourceEntryId: fixture.detailEntryId,
    leaseId: "detail-lease",
    title: "Detailed AI room",
    city: "Hamburg",
    summary: "Controlled detail room",
    arrangement: "shared",
    requirements: [],
    unknowns: [],
    genres: [],
    instruments: [],
    facets: [],
    contacts: [],
    excerpt: "Public room detail",
    contentFingerprint: "detail-ai-v1",
    contactDataPresent: false,
  })).toBe(true);

  const projected = await t.run(async (ctx) => {
    const entries = await ctx.db.query("sourceEntries").collect();
    const readSignal = async (externalId: string) => {
      const entry = entries.find((row) => row.externalId === externalId);
      return entry?.signalId ? await ctx.db.get(entry.signalId) : null;
    };
    return {
      listAi: await readSignal("list-ai"),
      listGeneric: await readSignal("list-generic"),
      detailAi: await readSignal("detail-ai"),
    };
  });
  expect(projected.listAi).toMatchObject({
    isDemo: true,
    providerSimulation: "ai_simulated",
    imageUrl: "https://roomscout.dev/demo-rooms/list-ai.webp",
  });
  expect(projected.listGeneric).toMatchObject({ isDemo: true, providerSimulation: "ai_simulated" });
  expect(projected.detailAi).toMatchObject({ isDemo: true, providerSimulation: "ai_simulated" });
});

it("backfills legacy demo evidence conservatively and counts every paginated real market signal", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "legacy-platform", name: "Legacy", canonicalDomain: "example.test", kind: "community",
      status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId, slug: "legacy-source", name: "Legacy", baseUrl: "https://real.example", side: "supply",
      status: "active", health: "healthy", accessMode: "public", automationReview: "approved", createdAt: now, updatedAt: now,
    });
    let demoSignalId;
    for (let index = 0; index < 251; index += 1) {
      const signalId = await ctx.db.insert("signals", {
        ...baseSignal, title: `Signal ${index}`, verification: index === 250 ? "verified" : "observed",
        sourceCount: index === 250 ? 2 : 1, firstSeenAt: now, lastSeenAt: now + index,
        latitude: 52.5, longitude: 13.4,
      });
      if (index === 250) {
        demoSignalId = signalId;
        await ctx.db.insert("signalEvidence", {
          signalId, sourceId, sourceUrl: "https://roomscout.dev/listings/legacy", sourceTitle: "Demo",
          excerpt: "Synthetic", fingerprint: "legacy-demo", observedAt: now,
        });
      }
    }
    await ctx.db.insert("marketAreas", {
      cityKey: "berlin", city: "Berlin", countryCode: "DE", latitude: 52.5, longitude: 13.4,
      supplyCount: 251, demandCount: 0, verifiedCount: 1, freshCount: 251,
      lastSignalAt: now + 250, updatedAt: now,
    });
    const munichSignalId = await ctx.db.insert("signals", {
      ...baseSignal, city: "Munich", title: "New city during migration", firstSeenAt: now,
      lastSeenAt: now, latitude: 48.14, longitude: 11.58, isDemo: false,
    });
    return { demoSignalId: demoSignalId!, munichSignalId };
  });
  await t.mutation(internal.map.rebuildArea, { city: "Berlin" });
  const preMigrationCoordination = await t.run((ctx) => ctx.db.query("marketAreaRebuilds").withIndex("by_city_key", (q) => q.eq("cityKey", "berlin")).unique());
  vi.setSystemTime(Date.now() + 1);
  await t.mutation(internal.ingestion.backfillDemoProvenance, { cursor: null });
  await t.mutation(internal.map.rebuildArea, { city: "Berlin" });
  await t.mutation(internal.map.rebuildArea, { city: "Munich" });
  await t.mutation(internal.map.rebuildAreaPage, {
    city: "Berlin", cityKey: "berlin", generation: preMigrationCoordination!.generation,
    startedAt: preMigrationCoordination!.updatedAt, status: "stale", cursor: null,
    supplyCount: 999, demandCount: 999, verifiedCount: 999, freshCount: 999,
    latitudeSum: 1, longitudeSum: 1, positionedCount: 1, lastSignalAt: 1,
  });
  expect(await t.run((ctx) => ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", "berlin")).unique()))
    .toMatchObject({ supplyCount: 251, freshCount: 251 });
  expect(await t.run((ctx) => ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", "munich")).unique())).toBeNull();
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  const demo = await t.run((ctx) => ctx.db.get(fixture.demoSignalId));
  expect(demo).toMatchObject({ isDemo: true, verification: "observed", sourceCount: 2 });
  const area = await t.run((ctx) => ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", "berlin")).unique());
  expect(area).toMatchObject({ supplyCount: 250, demandCount: 0, freshCount: 250, verifiedCount: 0 });
  expect(await t.run((ctx) => ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", "munich")).unique()))
    .toMatchObject({ supplyCount: 1, freshCount: 1 });
  const pins = await t.query(api.map.listPins, { city: "Berlin", limit: 300 });
  expect(pins.find((pin) => pin.signalId === fixture.demoSignalId)?.isDemo).toBe(true);

  await t.mutation(internal.map.rebuildArea, { city: "Berlin" });
  await t.mutation(internal.map.rebuildArea, { city: "Berlin" });
  const coordination = await t.run((ctx) => ctx.db.query("marketAreaRebuilds").withIndex("by_city_key", (q) => q.eq("cityKey", "berlin")).unique());
  await t.mutation(internal.map.rebuildAreaPage, {
    city: "Berlin", cityKey: "berlin", generation: coordination!.generation - 1, status: "stale", cursor: null,
    startedAt: coordination!.updatedAt,
    supplyCount: 999, demandCount: 999, verifiedCount: 999, freshCount: 999,
    latitudeSum: 1, longitudeSum: 1, positionedCount: 1, lastSignalAt: 1,
  });
  expect(await t.run((ctx) => ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", "berlin")).unique()))
    .toMatchObject({ supplyCount: 250 });
});

it("stores geocodes during a running provenance migration", async () => {
  const t = convexTest(schema, modules);
  const signalId = await t.run(async (ctx) => {
    const now = Date.now();
    const id = await ctx.db.insert("signals", {
      ...baseSignal, city: "Cologne", firstSeenAt: now, lastSeenAt: now, isDemo: false,
    });
    await ctx.db.insert("migrationRuns", {
      name: "backfill_signal_demo_provenance_v1", status: "running", processed: 0,
      startedAt: now, updatedAt: now,
    });
    return id;
  });
  await t.mutation(internal.map.storeGeocode, {
    signalId, queryKey: "cologne-germany", query: "Cologne, Germany", precision: "city",
    status: "ready", latitude: 50.94, longitude: 6.96,
  });
  expect(await t.run((ctx) => ctx.db.get(signalId))).toMatchObject({ latitude: 50.94, longitude: 6.96 });
  expect(await t.run((ctx) => ctx.db.query("geocodes").withIndex("by_query_key", (q) => q.eq("queryKey", "cologne-germany")).unique()))
    .toMatchObject({ status: "ready", latitude: 50.94, longitude: 6.96 });
});

it("retains the city center and reports real unpositioned counts before zeroing an all-demo area", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("signals", {
      ...baseSignal, city: "Hamburg", firstSeenAt: now, lastSeenAt: now,
      latitude: 53.55, longitude: 9.99, isDemo: false,
    });
    await ctx.db.insert("marketAreas", {
      cityKey: "hamburg", city: "Hamburg", countryCode: "DE", latitude: 53.55, longitude: 9.99,
      supplyCount: 1, demandCount: 0, verifiedCount: 0, freshCount: 1, lastSignalAt: now, updatedAt: now,
    });
  });
  await t.mutation(internal.map.rebuildArea, { city: "Hamburg" });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  await t.run(async (ctx) => {
    const signal = await ctx.db.query("signals").withIndex("by_city_and_status", (q) => q.eq("city", "Hamburg").eq("status", "published")).unique();
    await ctx.db.patch(signal!._id, { isDemo: true });
    const now = Date.now();
    await ctx.db.insert("signals", {
      ...baseSignal, title: "Unpositioned real", city: "Hamburg", firstSeenAt: now, lastSeenAt: now,
      isDemo: false,
    });
  });
  await t.mutation(internal.map.rebuildArea, { city: "Hamburg" });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await t.run((ctx) => ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", "hamburg")).unique()))
    .toMatchObject({ latitude: 53.55, longitude: 9.99, supplyCount: 1, demandCount: 0, verifiedCount: 0, freshCount: 1 });
  await t.run(async (ctx) => {
    const signals = await ctx.db.query("signals").withIndex("by_city_and_status", (q) => q.eq("city", "Hamburg").eq("status", "published")).collect();
    for (const signal of signals) await ctx.db.patch(signal._id, { isDemo: true });
  });
  await t.mutation(internal.map.rebuildArea, { city: "Hamburg" });
  await t.finishAllScheduledFunctions(() => vi.runAllTimers());
  expect(await t.run((ctx) => ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", "hamburg")).unique()))
    .toMatchObject({ latitude: 53.55, longitude: 9.99, supplyCount: 0, demandCount: 0, verifiedCount: 0, freshCount: 0 });
});
