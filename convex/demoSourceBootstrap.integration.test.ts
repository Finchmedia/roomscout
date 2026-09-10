/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("keeps the public source global while bootstrapping one pending portal connection per user", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const operatorId = await ctx.db.insert("users", {
      username: "bootstrap-operator",
      role: "operator",
      createdAt: now,
      lastSeenAt: now,
    });
    const firstOwnerId = await ctx.db.insert("users", {
      username: "bootstrap-owner-1",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const secondOwnerId = await ctx.db.insert("users", {
      username: "bootstrap-owner-2",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    return { operatorId, firstOwnerId, secondOwnerId };
  });

  const firstRecords = await t.mutation(
    internal.demoSourceBootstrap.ensureGlobalRecords,
    {},
  );
  const secondRecords = await t.mutation(
    internal.demoSourceBootstrap.ensureGlobalRecords,
    {},
  );
  expect(secondRecords).toEqual(firstRecords);

  const firstConnection = await t.mutation(
    internal.demoSourceBootstrap.bootstrapControlledDemoForOwner,
    { ownerId: ids.firstOwnerId },
  );
  expect(firstConnection.created).toBe(true);
  expect(
    await t.mutation(
      internal.demoSourceBootstrap.bootstrapControlledDemoForOwner,
      {
        ownerId: ids.firstOwnerId,
      },
    ),
  ).toEqual({ connectionId: firstConnection.connectionId, created: false });

  const reconciliation = await t.mutation(
    internal.demoSourceBootstrap.reconcileDefaultConnections,
    { cursor: null },
  );
  expect(reconciliation.usersVisited).toBe(3);
  expect(reconciliation.connectionsCreated).toBe(2);

  await t.run(async (ctx) => {
    const publicSource = await ctx.db.get(firstRecords.publicSourceId);
    const authenticatedSource = await ctx.db.get(
      firstRecords.authenticatedSourceId,
    );
    const target = await ctx.db.get(firstRecords.publicTargetId);
    const connections = await ctx.db
      .query("portalConnections")
      .withIndex("by_source", (q) =>
        q.eq("sourceId", firstRecords.authenticatedSourceId),
      )
      .take(10);
    expect(publicSource).toMatchObject({
      slug: "roomscout-dev-public",
      accessMode: "public",
      status: "active",
      publicDisplay: true,
    });
    expect(authenticatedSource).toMatchObject({
      slug: "roomscout-dev-connected",
      accessMode: "authenticated",
      status: "active",
      publicDisplay: false,
    });
    expect(target).toMatchObject({
      sourceId: firstRecords.publicSourceId,
      paused: false,
      scheduleMinutes: 1440,
    });
    expect(connections).toHaveLength(3);
    expect(
      connections.every((connection) => connection.status === "needs_auth"),
    ).toBe(true);
    expect(
      connections.every(
        (connection) => connection.policyDecision === "allowed",
      ),
    ).toBe(true);
    expect(
      connections.every(
        (connection) => connection.sourceId !== firstRecords.publicSourceId,
      ),
    ).toBe(true);
  });

  await t.mutation(internal.firecrawl.saveMonitorReconciliation, {
    sourceTargetId: firstRecords.publicTargetId,
    providerMonitorId: "roomscout-dev-monitor",
    providerTargetId: "roomscout-dev-target",
    state: "active",
    configFingerprint: "known-config",
  });
  await t.mutation(internal.firecrawl.recordMonitorCheck, {
    sourceTargetId: firstRecords.publicTargetId,
    providerMonitorId: "roomscout-dev-monitor",
    providerCheckId: "roomscout-dev-check",
    status: "completed",
  });
  const status = await t
    .withIdentity({ subject: ids.operatorId })
    .query(api.demoSourceBootstrap.globalStatus, { now: Date.now() });
  expect(status).toMatchObject({
    ready: true,
    publicSourceActive: true,
    publicIndexIndependentOfConnections: true,
    authenticatedSourceReady: true,
    targetActive: true,
    scheduleMinutes: 1440,
    monitorConfigured: true,
    monitorState: "active",
    lastCheckStatus: "completed",
    checkOverdue: false,
  });
});
