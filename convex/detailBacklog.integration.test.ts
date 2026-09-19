/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("source target detail backlog", () => {
  it("defers changed processed rows beyond the five-slot queue and refills them later", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const sourceId = await ctx.db.insert("sources", {
        slug: "changed-details", name: "Changed details", baseUrl: "https://example.test/listings",
        side: "supply", status: "active", health: "healthy", accessMode: "public",
        automationReview: "approved", adapterKey: "generic-list-v1", publicDisplay: true,
        createdAt: now, updatedAt: now,
      });
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId, url: "https://example.test/listings", mode: "scrape", changeTrackingTag: "changed:v1",
        scheduleMinutes: 1_440, nextRunAt: now, paused: false, monitorStatus: "active",
        successfulSnapshotCount: 1, backlogCount: 0, createdAt: now, updatedAt: now,
      });
      const eventId = await ctx.db.insert("ingestionEvents", {
        provider: "firecrawl", providerEventId: "changed-details-event", sourceTargetId: targetId,
        eventType: "monitor", status: "received", payloadHash: "changed-details", receivedAt: now,
      });
      const entryIds = [];
      for (let index = 0; index < 7; index += 1) {
        entryIds.push(await ctx.db.insert("sourceEntries", {
          sourceId, sourceTargetId: targetId, externalId: `changed-${index}`,
          canonicalUrl: `https://example.test/listing-${index}`, detailUrl: `https://example.test/listing-${index}`,
          title: `Room ${index}`, excerpt: "Old detail", side: "supply", city: "Berlin",
          contentFingerprint: `old-${index}`, status: "active", detailState: "processed", detailAttempts: 2,
          firstSeenAt: now, lastSeenAt: now, updatedAt: now,
        }));
      }
      return { eventId, targetId, entryIds };
    });

    await t.mutation(internal.ingestion.upsertSourceEntries, {
      eventId: seeded.eventId,
      sourceTargetId: seeded.targetId,
      pageUrl: "https://example.test/listings",
      entries: seeded.entryIds.map((_, index) => ({
        externalId: `changed-${index}`,
        canonicalUrl: `https://example.test/listing-${index}`,
        detailUrl: `https://example.test/listing-${index}`,
        title: `Room ${index}`,
        excerpt: "Changed detail",
        side: "supply" as const,
        city: "Berlin",
        contentFingerprint: `new-${index}`,
        contactDataPresent: false,
        summary: "Changed detail",
        arrangement: "shared" as const,
        requirements: [],
        unknowns: [],
      })),
    });

    let rows = await t.run((ctx) => Promise.all(seeded.entryIds.map((id) => ctx.db.get(id))));
    expect(rows.filter((row) => row?.detailState === "queued")).toHaveLength(5);
    expect(rows.filter((row) => row?.detailState === "none")).toHaveLength(2);
    expect(rows.every((row) => row?.detailAttempts === 0)).toBe(true);

    await t.run((ctx) => ctx.db.patch(rows.find((row) => row?.detailState === "queued")!._id, { detailState: "processed" }));
    expect(await t.mutation(internal.ingestion.continueTargetDetailBacklog, {
      sourceTargetId: seeded.targetId,
    })).toEqual({ promoted: 1, backlogCount: 5 });
    rows = await t.run((ctx) => Promise.all(seeded.entryIds.map((id) => ctx.db.get(id))));
    expect(rows.filter((row) => row?.detailState === "queued")).toHaveLength(5);
    expect(rows.filter((row) => row?.detailState === "none")).toHaveLength(1);
  });

  it("refills the bounded queue from deferred detail rows until the target drains", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const sourceId = await ctx.db.insert("sources", {
        slug: "backlog-refill", name: "Backlog refill", baseUrl: "https://example.test/listings",
        side: "supply", status: "active", health: "healthy", accessMode: "public",
        automationReview: "approved", adapterKey: "generic-list-v1", publicDisplay: true,
        createdAt: now, updatedAt: now,
      });
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId, url: "https://example.test/listings", mode: "scrape", changeTrackingTag: "backlog-refill:v1",
        scheduleMinutes: 1_440, nextRunAt: now, paused: false, monitorStatus: "active",
        successfulSnapshotCount: 1, backlogCount: 4, createdAt: now, updatedAt: now,
      });
      const detailIds = [];
      for (let index = 0; index < 6; index += 1) {
        detailIds.push(await ctx.db.insert("sourceEntries", {
          sourceId, sourceTargetId: targetId, externalId: `detail-${index}`,
          canonicalUrl: `https://example.test/listing-${index}`, detailUrl: `https://example.test/listing-${index}`,
          title: `Room ${index}`, excerpt: `Room ${index}`, side: "supply", city: "Berlin",
          status: "active", detailState: index < 4 ? "queued" : "none", detailAttempts: 0,
          nextDetailAttemptAt: index < 4 ? now : undefined,
          firstSeenAt: now, lastSeenAt: now, updatedAt: now,
        }));
      }
      const pageEntryId = await ctx.db.insert("sourceEntries", {
        sourceId, sourceTargetId: targetId, externalId: "index-page",
        canonicalUrl: "https://example.test/listings", detailUrl: "https://example.test/listings",
        title: "Listings", excerpt: "Index page", side: "supply", city: "Berlin",
        status: "active", detailState: "none", detailAttempts: 0,
        firstSeenAt: now, lastSeenAt: now, updatedAt: now,
      });
      return { targetId, detailIds, pageEntryId };
    });

    expect(await t.mutation(internal.ingestion.continueTargetDetailBacklog, {
      sourceTargetId: seeded.targetId,
    })).toEqual({ promoted: 1, backlogCount: 5 });
    let rows = await t.run((ctx) => Promise.all(seeded.detailIds.map((id) => ctx.db.get(id))));
    expect(rows.filter((row) => row?.detailState === "queued")).toHaveLength(5);
    expect(rows.filter((row) => row?.detailState === "none")).toHaveLength(1);
    expect((await t.run((ctx) => ctx.db.get(seeded.pageEntryId)))?.detailState).toBe("none");

    const completing = rows.find((row) => row?.detailState === "queued")!;
    await t.run((ctx) => ctx.db.patch(completing._id, {
      detailState: "fetching", detailAttempts: 1, detailLeaseId: "refill-lease",
      detailLeaseExpiresAt: Date.now() + 60_000,
    }));
    expect(await t.mutation(internal.ingestion.completeDetailNormalization, {
      sourceEntryId: completing._id, leaseId: "refill-lease", title: completing.title, city: "Berlin",
      summary: "Detailed room", arrangement: "shared", requirements: [], unknowns: [], genres: [], instruments: [],
      facets: [], contacts: [], excerpt: "Detailed room", contentFingerprint: "detail-complete", contactDataPresent: false,
    })).toBe(true);

    rows = await t.run((ctx) => Promise.all(seeded.detailIds.map((id) => ctx.db.get(id))));
    expect(rows.filter((row) => row?.detailState === "queued")).toHaveLength(5);
    expect(rows.filter((row) => row?.detailState === "processed")).toHaveLength(1);
    expect(rows.filter((row) => row?.detailState === "none")).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(seeded.targetId)))?.backlogCount).toBe(5);
  });

  it("drops the target backlog after successful normalization without touching another target", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const sourceId = await ctx.db.insert("sources", {
        slug: "backlog-success",
        name: "Backlog success",
        baseUrl: "https://example.test",
        side: "supply",
        status: "active",
        health: "healthy",
        accessMode: "public",
        automationReview: "approved",
        adapterKey: "generic-list-v1",
        publicDisplay: true,
        createdAt: now,
        updatedAt: now,
      });
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId,
        url: "https://example.test/listings",
        mode: "scrape",
        changeTrackingTag: "backlog-success:v1",
        scheduleMinutes: 1_440,
        nextRunAt: now,
        paused: false,
        monitorStatus: "active",
        successfulSnapshotCount: 1,
        backlogCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      const otherTargetId = await ctx.db.insert("sourceTargets", {
        sourceId,
        url: "https://example.test/other",
        mode: "scrape",
        changeTrackingTag: "backlog-other:v1",
        scheduleMinutes: 1_440,
        nextRunAt: now,
        paused: false,
        monitorStatus: "active",
        successfulSnapshotCount: 1,
        backlogCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      const entryId = await ctx.db.insert("sourceEntries", {
        sourceId,
        sourceTargetId: targetId,
        externalId: "listing-1",
        canonicalUrl: "https://example.test/listing-1",
        detailUrl: "https://example.test/listing-1",
        title: "Room one",
        excerpt: "Room one",
        side: "supply",
        city: "Stuttgart",
        status: "active",
        detailState: "fetching",
        detailAttempts: 1,
        detailLeaseId: "lease-1",
        detailLeaseExpiresAt: now + 60_000,
        firstSeenAt: now,
        lastSeenAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("sourceEntries", {
        sourceId,
        sourceTargetId: otherTargetId,
        externalId: "listing-2",
        canonicalUrl: "https://example.test/listing-2",
        detailUrl: "https://example.test/listing-2",
        title: "Room two",
        excerpt: "Room two",
        side: "supply",
        city: "Berlin",
        status: "active",
        detailState: "queued",
        detailAttempts: 0,
        nextDetailAttemptAt: now,
        firstSeenAt: now,
        lastSeenAt: now,
        updatedAt: now,
      });
      return { entryId, targetId, otherTargetId };
    });

    await t.mutation(internal.ingestion.completeDetailNormalization, {
      sourceEntryId: seeded.entryId,
      leaseId: "lease-1",
      title: "Room one",
      city: "Stuttgart",
      summary: "A controlled rehearsal room.",
      arrangement: "shared",
      priceEur: 200,
      pricePeriod: "month",
      requirements: [],
      unknowns: [],
      genres: [],
      instruments: [],
      facets: [{
        namespace: "location",
        key: "approximate_fictional_coordinates",
        value: "48.7712, 9.1845",
        confidence: 1,
      }],
      contacts: [],
      excerpt: "A controlled rehearsal room.",
      contentFingerprint: "fingerprint-1",
      contactDataPresent: false,
    });

    const result = await t.run(async (ctx) => ({
      entry: await ctx.db.get(seeded.entryId),
      target: await ctx.db.get(seeded.targetId),
      otherTarget: await ctx.db.get(seeded.otherTargetId),
    }));
    expect(result.entry?.detailState).toBe("processed");
    const signal = result.entry?.signalId
      ? await t.run((ctx) => ctx.db.get(result.entry!.signalId!))
      : null;
    expect(signal).toMatchObject({
      latitude: 48.7712,
      longitude: 9.1845,
      locationPrecision: "unknown",
    });
    expect(result.target?.backlogCount).toBe(0);
    expect(result.otherTarget?.backlogCount).toBe(1);
  });

  it("reconciles valid coordinates already extracted into detail facets", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const sourceId = await ctx.db.insert("sources", {
        slug: "coordinate-reconciliation", name: "Coordinate reconciliation",
        baseUrl: "https://example.test", side: "supply", status: "active",
        health: "healthy", accessMode: "public", automationReview: "approved",
        adapterKey: "generic-list-v1", publicDisplay: true, createdAt: now, updatedAt: now,
      });
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId, url: "https://example.test/listings", mode: "scrape",
        changeTrackingTag: "coordinates:v1", scheduleMinutes: 1_440, nextRunAt: now,
        paused: false, monitorStatus: "active", successfulSnapshotCount: 1,
        backlogCount: 0, createdAt: now, updatedAt: now,
      });
      const validSignalId = await ctx.db.insert("signals", {
        side: "supply", title: "Published coordinate room", city: "Berlin",
        summary: "Room", arrangement: "shared", requirements: [], unknowns: [],
        status: "published", verification: "observed", sourceCount: 1,
        firstSeenAt: now, lastSeenAt: now, publishedAt: now,
        latitude: 52.5, longitude: 13.4, locationPrecision: "district",
        facets: [{ namespace: "location", key: "approximate_coordinates", value: "52.4890, 13.4070", confidence: 1 }],
      });
      const invalidSignalId = await ctx.db.insert("signals", {
        side: "supply", title: "Invalid coordinate room", city: "Berlin",
        summary: "Room", arrangement: "shared", requirements: [], unknowns: [],
        status: "published", verification: "observed", sourceCount: 1,
        firstSeenAt: now, lastSeenAt: now, publishedAt: now,
        latitude: 52.51, longitude: 13.41, locationPrecision: "district",
        facets: [{ namespace: "location", key: "coordinates", value: "95.0000, 13.4070", confidence: 1 }],
      });
      for (const [index, signalId] of [validSignalId, invalidSignalId].entries()) {
        await ctx.db.insert("sourceEntries", {
          sourceId, sourceTargetId: targetId, externalId: `coordinate-${index}`,
          canonicalUrl: `https://example.test/listing-${index}`,
          detailUrl: `https://example.test/listing-${index}`, title: `Room ${index}`,
          excerpt: "Published detail", side: "supply", city: "Berlin", status: "active",
          detailState: "processed", detailAttempts: 1, signalId,
          firstSeenAt: now, lastSeenAt: now, updatedAt: now,
        });
      }
      return { targetId, validSignalId, invalidSignalId };
    });

    expect(await t.mutation(internal.ingestion.reconcileTargetDetailCoordinates, {
      sourceTargetId: seeded.targetId,
    })).toEqual({ scanned: 2, updated: 1, invalidOrMissing: 1 });
    expect(await t.run((ctx) => ctx.db.get(seeded.validSignalId))).toMatchObject({
      latitude: 52.489,
      longitude: 13.407,
      locationPrecision: "unknown",
    });
    expect(await t.run((ctx) => ctx.db.get(seeded.invalidSignalId))).toMatchObject({
      latitude: 52.51,
      longitude: 13.41,
      locationPrecision: "district",
    });
  });

  it("keeps retries in the backlog and removes terminal failures", async () => {
    const t = convexTest(schema, modules);
    const seeded = await t.run(async (ctx) => {
      const now = Date.now();
      const sourceId = await ctx.db.insert("sources", {
        slug: "backlog-failure",
        name: "Backlog failure",
        baseUrl: "https://example.test",
        side: "supply",
        status: "active",
        health: "healthy",
        accessMode: "public",
        automationReview: "approved",
        adapterKey: "generic-list-v1",
        publicDisplay: true,
        createdAt: now,
        updatedAt: now,
      });
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId,
        url: "https://example.test/listings",
        mode: "scrape",
        changeTrackingTag: "backlog-failure:v1",
        scheduleMinutes: 1_440,
        nextRunAt: now,
        paused: false,
        monitorStatus: "active",
        successfulSnapshotCount: 1,
        backlogCount: 1,
        createdAt: now,
        updatedAt: now,
      });
      const entryId = await ctx.db.insert("sourceEntries", {
        sourceId,
        sourceTargetId: targetId,
        externalId: "listing-failure",
        canonicalUrl: "https://example.test/listing-failure",
        detailUrl: "https://example.test/listing-failure",
        title: "Retry room",
        excerpt: "Retry room",
        side: "supply",
        city: "Stuttgart",
        status: "active",
        detailState: "fetching",
        detailAttempts: 1,
        detailLeaseId: "lease-retry",
        detailLeaseExpiresAt: now + 60_000,
        firstSeenAt: now,
        lastSeenAt: now,
        updatedAt: now,
      });
      return { entryId, targetId };
    });

    await t.mutation(internal.ingestion.failDetailNormalization, {
      sourceEntryId: seeded.entryId,
      leaseId: "lease-retry",
      error: "Temporary failure",
    });
    let result = await t.run(async (ctx) => ({
      entry: await ctx.db.get(seeded.entryId),
      target: await ctx.db.get(seeded.targetId),
    }));
    expect(result.entry?.detailState).toBe("queued");
    expect(result.target?.backlogCount).toBe(1);
    expect((await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()))
      .some((row) => row.name.includes("firecrawlDetails:processDetailBacklog"))).toBe(true);

    await t.run(async (ctx) => {
      await ctx.db.patch(seeded.entryId, {
        detailState: "fetching",
        detailAttempts: 3,
        detailLeaseId: "lease-terminal",
        detailLeaseExpiresAt: Date.now() + 60_000,
      });
    });
    await t.mutation(internal.ingestion.failDetailNormalization, {
      sourceEntryId: seeded.entryId,
      leaseId: "lease-terminal",
      error: "Terminal failure",
    });
    result = await t.run(async (ctx) => ({
      entry: await ctx.db.get(seeded.entryId),
      target: await ctx.db.get(seeded.targetId),
    }));
    expect(result.entry?.detailState).toBe("failed");
    expect(result.target?.backlogCount).toBe(0);
  });
});
