/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const operatorId = await ctx.db.insert("users", { username: "drain-operator", role: "operator", createdAt: now, lastSeenAt: now });
    const ownerId = await ctx.db.insert("users", { username: "drain-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const sourceId = await ctx.db.insert("sources", { slug: "drain-source", name: "Drain", baseUrl: "https://roomscout.dev", side: "both", status: "active", health: "healthy", accessMode: "authenticated", automationReview: "approved", createdAt: now, updatedAt: now });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, label: "Drain", allowedDomains: ["roomscout.dev"], allowedPaths: ["/"], adapterKey: "roomscout-dev-v1", browserProvider: "firecrawl", status: "needs_auth", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    return { operatorId, ownerId, connectionId };
  });
  return { t, operator: t.withIdentity({ subject: ids.operatorId }), ...ids };
}

it("pauses admission, terminalizes queued work, and cannot revive it after switchback", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const f = await fixture();
  const runId = await f.t.mutation(internal.portalConnections.reserveRun, { ownerId: f.ownerId, connectionId: f.connectionId, kind: "authenticate", browserProvider: "firecrawl" });
  await f.operator.mutation(api.portalBrowserMaintenance.pauseForDrain, { drainingProvider: "firecrawl" });
  await expect(f.t.mutation(internal.portalConnections.reserveRun, { ownerId: f.ownerId, connectionId: f.connectionId, kind: "authenticate", browserProvider: "firecrawl" })).rejects.toThrow("PORTAL_BROWSER_MAINTENANCE_PAUSED");
  await expect(f.operator.mutation(api.portalBrowserMaintenance.drainBatch, { drainingProvider: "firecrawl" })).resolves.toMatchObject({ terminalizedRuns: 1, readyToSwitch: true });
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
  await f.operator.mutation(api.portalBrowserMaintenance.resumeAfterSwitch, { drainedProvider: "firecrawl" });
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  expect(await f.t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "failed", errorCode: "PORTAL_PROVIDER_DRAINED" });
});

it("refuses switch readiness while an old-provider run is active", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("browserRuns", { connectionId: f.connectionId, ownerId: f.ownerId, browserProvider: "firecrawl", browserEngine: "firecrawl", kind: "authenticate", status: "running", expiresAt: now + 60_000, createdAt: now, updatedAt: now });
  });
  await f.operator.mutation(api.portalBrowserMaintenance.pauseForDrain, { drainingProvider: "firecrawl" });
  const result = await f.operator.mutation(api.portalBrowserMaintenance.drainBatch, { drainingProvider: "firecrawl" });
  expect(result).toMatchObject({ activeRuns: 1, readyToSwitch: false });
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
  await expect(f.operator.mutation(api.portalBrowserMaintenance.resumeAfterSwitch, { drainedProvider: "firecrawl" })).rejects.toThrow("PORTAL_BROWSER_DRAIN_INCOMPLETE");
});

it("refuses switch readiness until an unknown write is explicitly reconciled", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const now = Date.now();
    const payload = { kind: "platform_message" as const, recipients: ["recipient"], body: "approved body" };
    const requestId = await ctx.db.insert("actionRequests", { ownerId: f.ownerId, connectionId: f.connectionId, automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: [], payload, contentVersion: 1, contentHash: "hash", status: "executing", executionIdempotencyKey: "drain-unknown", createdAt: now, updatedAt: now });
    const approvalId = await ctx.db.insert("actionApprovals", { requestId, ownerId: f.ownerId, contentVersion: 1, contentHash: "hash", payloadSnapshot: payload, decision: "approved", decidedAt: now });
    await ctx.db.insert("actionExecutions", { requestId, ownerId: f.ownerId, approvalId, connectionId: f.connectionId, browserProvider: "firecrawl", status: "unknown", idempotencyKey: "drain-unknown", startedAt: now, completedAt: now, error: "SUBMIT_RESULT_UNKNOWN", createdAt: now, updatedAt: now });
  });
  await f.operator.mutation(api.portalBrowserMaintenance.pauseForDrain, { drainingProvider: "firecrawl" });
  const result = await f.operator.mutation(api.portalBrowserMaintenance.drainBatch, { drainingProvider: "firecrawl" });
  expect(result).toMatchObject({ unknownWrites: 1, readyToSwitch: false });
  await f.operator.mutation(api.portalBrowserMaintenance.cancelDrain, { drainingProvider: "firecrawl" });
  expect(await f.operator.query(api.portalBrowserMaintenance.getStatus, {})).toMatchObject({ paused: false });
});

it("never terminalizes a claimed Firecrawl execution that owns the active write lock", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const f = await fixture();
  const executionId = await f.t.run(async (ctx) => {
    const now = Date.now();
    const payload = { kind: "platform_message" as const, recipients: ["recipient"], body: "approved body" };
    const requestId = await ctx.db.insert("actionRequests", { ownerId: f.ownerId, connectionId: f.connectionId, automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: [], payload, contentVersion: 1, contentHash: "active-hash", status: "executing", executionIdempotencyKey: "active-write", createdAt: now, updatedAt: now });
    const approvalId = await ctx.db.insert("actionApprovals", { requestId, ownerId: f.ownerId, contentVersion: 1, contentHash: "active-hash", payloadSnapshot: payload, decision: "approved", decidedAt: now });
    const id = await ctx.db.insert("actionExecutions", { requestId, ownerId: f.ownerId, approvalId, connectionId: f.connectionId, browserProvider: "firecrawl", status: "claimed", idempotencyKey: "active-write", startedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.patch(f.connectionId, { activeWriteExecutionId: id, activeWriteDeadlineAt: now + 60_000 });
    return id;
  });
  await f.operator.mutation(api.portalBrowserMaintenance.pauseForDrain, { drainingProvider: "firecrawl" });
  const result = await f.operator.mutation(api.portalBrowserMaintenance.drainBatch, { drainingProvider: "firecrawl" });
  expect(result).toMatchObject({ terminalizedUnstartedWrites: 0, activeWrites: 1, readyToSwitch: false });
  expect(await f.t.run((ctx) => ctx.db.get(executionId))).toMatchObject({ status: "claimed" });
});

it("ignores unrelated legacy email executions and rejects invalid limits", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
  const f = await fixture();
  const ids = await f.t.run(async (ctx) => {
    const now = Date.now();
    const payload = { kind: "email_message" as const, recipientName: "R", recipientEmail: "r@example.test", subject: "S", body: "B" };
    const requestId = await ctx.db.insert("actionRequests", { ownerId: f.ownerId, automationMode: "exact_once", requestedActionType: "send_email", personalDataScopes: [], payload, contentVersion: 1, contentHash: "email-hash", status: "executing", executionIdempotencyKey: "email-legacy", createdAt: now, updatedAt: now });
    const approvalId = await ctx.db.insert("actionApprovals", { requestId, ownerId: f.ownerId, contentVersion: 1, contentHash: "email-hash", payloadSnapshot: payload, decision: "approved", decidedAt: now });
    const claimedId = await ctx.db.insert("actionExecutions", { requestId, ownerId: f.ownerId, approvalId, status: "claimed", idempotencyKey: "email-legacy", startedAt: now, createdAt: now, updatedAt: now });
    const unknownId = await ctx.db.insert("actionExecutions", { requestId, ownerId: f.ownerId, approvalId, status: "unknown", idempotencyKey: "email-legacy-unknown", startedAt: now, completedAt: now, error: "UNKNOWN", createdAt: now, updatedAt: now });
    return { claimedId, unknownId };
  });
  await f.operator.mutation(api.portalBrowserMaintenance.pauseForDrain, { drainingProvider: "browserbase" });
  await expect(f.operator.mutation(api.portalBrowserMaintenance.drainBatch, { drainingProvider: "browserbase", limit: Number.NaN })).rejects.toThrow("PORTAL_BROWSER_DRAIN_LIMIT_INVALID");
  const result = await f.operator.mutation(api.portalBrowserMaintenance.drainBatch, { drainingProvider: "browserbase" });
  expect(result).toMatchObject({ terminalizedUnstartedWrites: 0, unknownWrites: 0, readyToSwitch: true });
  expect(await f.t.run((ctx) => Promise.all([ctx.db.get(ids.claimedId), ctx.db.get(ids.unknownId)]))).toMatchObject([{ status: "claimed" }, { status: "unknown" }]);
});
