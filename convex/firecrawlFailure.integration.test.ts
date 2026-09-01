/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("persists a monitor creation failure before a provider monitor exists", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const sourceId = await ctx.db.insert("sources", {
      slug: "controlled-monitor-failure",
      name: "Controlled monitor failure",
      baseUrl: "https://example.test",
      side: "supply",
      status: "active",
      health: "unknown",
      accessMode: "public",
      automationReview: "approved",
      adapterKey: "generic-list-v1",
      publicDisplay: true,
      createdAt: now,
      updatedAt: now,
    });
    const sourceTargetId = await ctx.db.insert("sourceTargets", {
      sourceId,
      url: "https://example.test/listings",
      mode: "scrape",
      changeTrackingTag: "controlled-monitor-failure:v1",
      scheduleMinutes: 1_440,
      nextRunAt: now,
      paused: false,
      monitorStatus: "unconfigured",
      successfulSnapshotCount: 0,
      backlogCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { sourceId, sourceTargetId };
  });

  await t.mutation(internal.firecrawl.recordMonitorFailure, {
    sourceTargetId: ids.sourceTargetId,
    error: "Provider rejected the monitor definition",
  });

  const result = await t.run(async (ctx) => ({
    source: await ctx.db.get(ids.sourceId),
    target: await ctx.db.get(ids.sourceTargetId),
  }));
  expect(result.source?.health).toBe("degraded");
  expect(result.target).toMatchObject({
    monitorStatus: "error",
    monitorError: "Provider rejected the monitor definition",
  });
});

it("clears the prior failure after a successful reconciliation", async () => {
  const t = convexTest(schema, modules);
  const sourceTargetId = await t.run(async (ctx) => {
    const now = Date.now();
    const sourceId = await ctx.db.insert("sources", {
      slug: "controlled-monitor-recovery",
      name: "Controlled monitor recovery",
      baseUrl: "https://example.test",
      side: "supply",
      status: "active",
      health: "degraded",
      accessMode: "public",
      automationReview: "approved",
      adapterKey: "generic-list-v1",
      publicDisplay: true,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.insert("sourceTargets", {
      sourceId,
      url: "https://example.test/listings",
      mode: "scrape",
      changeTrackingTag: "controlled-monitor-recovery:v1",
      scheduleMinutes: 1_440,
      nextRunAt: now,
      paused: false,
      monitorStatus: "error",
      monitorError: "Prior provider failure",
      successfulSnapshotCount: 0,
      backlogCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  });

  await t.mutation(internal.firecrawl.saveMonitorReconciliation, {
    sourceTargetId,
    providerMonitorId: "monitor_123",
    providerTargetId: "target_123",
    state: "active",
    configFingerprint: "fingerprint",
  });

  const target = await t.run(async (ctx) => await ctx.db.get(sourceTargetId));
  expect(target).toMatchObject({
    monitorStatus: "active",
    providerMonitorId: "monitor_123",
  });
  expect(target?.monitorError).toBeUndefined();
});
