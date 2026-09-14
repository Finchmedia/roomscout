/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { AUTO_CHECK_COOLDOWN_MS } from "./demoSourceChecks";

afterEach(() => vi.unstubAllEnvs());

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const operatorId = await ctx.db.insert("users", { username: "operator", role: "operator", createdAt: now, lastSeenAt: now });
    const musicianId = await ctx.db.insert("users", { username: "musician", role: "musician", createdAt: now, lastSeenAt: now });
    return { operatorId, musicianId };
  });
  return { t, ids, operator: t.withIdentity({ subject: ids.operatorId }), musician: t.withIdentity({ subject: ids.musicianId }) };
}

it("starts one bounded operator demo, deduplicates request ids, and stops it", async () => {
  const { operator, musician } = await fixture();
  const requestId = "demo-request-0001";
  expect(await operator.mutation(api.demoSourceChecks.startDemo, { requestId }))
    .toEqual({ accepted: true, status: "queued" });
  expect(await operator.mutation(api.demoSourceChecks.startDemo, { requestId }))
    .toEqual({ accepted: true, status: "queued" });
  expect(await musician.mutation(api.demoSourceChecks.requestNow, { requestId: "manual-request-0002" }))
    .toEqual({ accepted: false, status: "queued" });

  expect(await operator.query(api.demoSourceChecks.status, {})).toMatchObject({
    status: "queued", mode: "demo", checksCompleted: 0,
    maxChecks: 10, detailPagesUsed: 0, maxDetailPages: 50,
  });
  expect(await operator.mutation(api.demoSourceChecks.stopDemo, {}))
    .toEqual({ accepted: true, status: "stopped" });
  expect(await operator.query(api.demoSourceChecks.status, {})).toMatchObject({ status: "stopped" });
  expect(await operator.mutation(api.demoSourceChecks.stopDemo, {}))
    .toEqual({ accepted: false, status: "stopped" });
});

it("allows an authenticated manual check but keeps demo start operator-only", async () => {
  const { musician } = await fixture();
  await expect(musician.mutation(api.demoSourceChecks.startDemo, { requestId: "demo-request-0003" }))
    .rejects.toThrow("FORBIDDEN");
  expect(await musician.mutation(api.demoSourceChecks.requestNow, { requestId: "manual-request-0004" }))
    .toEqual({ accepted: true, status: "queued" });
  expect(await musician.query(api.demoSourceChecks.status, {})).toMatchObject({ mode: "manual", maxChecks: 1, maxDetailPages: 5 });
});

it("claims only never-attempted roomscout.dev details within the per-check bound", async () => {
  const { t, ids } = await fixture();
  const data = await t.run(async (ctx) => {
    const now = Date.now();
    const sourceId = await ctx.db.insert("sources", { slug: "roomscout-dev-public", name: "demo", baseUrl: "https://roomscout.dev", side: "both", status: "active", health: "healthy", accessMode: "public", automationReview: "approved", publicDisplay: true, createdAt: now, updatedAt: now });
    const targetId = await ctx.db.insert("sourceTargets", { sourceId, url: "https://roomscout.dev", mode: "scrape", changeTrackingTag: "demo", scheduleMinutes: 1440, nextRunAt: now, paused: false, createdAt: now, updatedAt: now });
    await ctx.db.insert("demoSourceChecks", { singletonKey: "global", generation: "generation-0001", mode: "manual", status: "processing", requestedBy: ids.musicianId, checksCompleted: 0, maxChecks: 1, detailPagesUsed: 0, maxDetailPages: 5, startedAt: now, expiresAt: now + 600_000, updatedAt: now });
    for (let index = 0; index < 7; index++) await ctx.db.insert("sourceEntries", { sourceId, sourceTargetId: targetId, canonicalUrl: `https://roomscout.dev/listings/${index}`, detailUrl: index === 6 ? "https://example.com/not-allowed" : `https://roomscout.dev/listings/${index}`, title: `Listing ${index}`, excerpt: "Public", side: "supply", status: "active", detailState: "queued", detailAttempts: index === 5 ? 1 : 0, nextDetailAttemptAt: now, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    return { targetId };
  });
  const jobs = await t.mutation(internal.demoSourceChecks.claimDetails, { generation: "generation-0001", sourceTargetId: data.targetId, leaseId: "lease-0001", limit: 99 });
  expect(jobs).toHaveLength(5);
  expect(jobs.every((job) => job.detailUrl.startsWith("https://roomscout.dev/"))).toBe(true);
});

it("starts one bounded automatic check per trigger, never interrupts a run, and honours the cooldown", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "firecrawl-test-key");
  const { t, ids, musician } = await fixture();
  expect(await t.mutation(internal.demoSourceChecks.requestAutomatic, { ownerId: ids.musicianId, requestId: "auto:need:0001" }))
    .toEqual({ accepted: true, status: "queued" });
  expect(await musician.query(api.demoSourceChecks.status, {}))
    .toMatchObject({ status: "queued", mode: "manual", maxChecks: 1, maxDetailPages: 5 });
  const scheduled = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(scheduled.map((row) => row.name)).toContain("demoSourceCheckActions:runCheck");

  expect(await t.mutation(internal.demoSourceChecks.requestAutomatic, { ownerId: ids.musicianId, requestId: "auto:need:0002" }))
    .toEqual({ accepted: false, status: "queued", reason: "busy" });

  await t.run(async (ctx) => {
    const run = await ctx.db.query("demoSourceChecks").withIndex("by_singleton_key", (q) => q.eq("singletonKey", "global")).unique();
    await ctx.db.patch(run!._id, { status: "completed", checksCompleted: 1, lastCompletedAt: Date.now(), updatedAt: Date.now() });
  });
  expect(await t.mutation(internal.demoSourceChecks.requestAutomatic, { ownerId: ids.musicianId, requestId: "auto:run:0003" }))
    .toEqual({ accepted: false, status: "completed", reason: "cooldown" });

  await t.run(async (ctx) => {
    const run = await ctx.db.query("demoSourceChecks").withIndex("by_singleton_key", (q) => q.eq("singletonKey", "global")).unique();
    await ctx.db.patch(run!._id, { lastCompletedAt: Date.now() - AUTO_CHECK_COOLDOWN_MS - 1 });
  });
  expect(await t.mutation(internal.demoSourceChecks.requestAutomatic, { ownerId: ids.musicianId, requestId: "auto:run:0003" }))
    .toEqual({ accepted: true, status: "queued" });
});

it("skips the automatic check without a Firecrawl key or a known owner", async () => {
  vi.stubEnv("FIRECRAWL_API_KEY", "");
  const { t, ids } = await fixture();
  expect(await t.mutation(internal.demoSourceChecks.requestAutomatic, { ownerId: ids.musicianId, requestId: "auto:need:0004" }))
    .toEqual({ accepted: false, status: "idle", reason: "unconfigured" });
  vi.stubEnv("FIRECRAWL_API_KEY", "firecrawl-test-key");
  const missingOwner = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { username: "gone", role: "musician", createdAt: 1, lastSeenAt: 1 });
    await ctx.db.delete(id);
    return id;
  });
  expect(await t.mutation(internal.demoSourceChecks.requestAutomatic, { ownerId: missingOwner, requestId: "auto:need:0005" }))
    .toEqual({ accepted: false, status: "idle", reason: "owner_missing" });
  expect(await t.run(async (ctx) => ctx.db.query("demoSourceChecks").take(1))).toEqual([]);
});
