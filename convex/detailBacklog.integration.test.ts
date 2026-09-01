/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("source target detail backlog", () => {
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
      facets: [],
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
    expect(result.target?.backlogCount).toBe(0);
    expect(result.otherTarget?.backlogCount).toBe(1);
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
