/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); });

/**
 * The controlled portal has no automatic poll (`CONTROLLED_PORTAL_POLL_MINUTES`
 * is 0). The webhook is the primary path; a poll interval of 0 must never turn
 * into a scheduled `nextPollAt`, and a connection without one is never due.
 */
async function fixture(pollIntervalMinutes: number, nextPollAt?: number) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "poll-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const sourceId = await ctx.db.insert("sources", {
      slug: "poll-source", name: "Poll source", baseUrl: "https://roomscout.dev", side: "both",
      status: "active", health: "healthy", accessMode: "authenticated", automationReview: "approved",
      createdAt: now, updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId, sourceId, label: "Poll", allowedDomains: ["roomscout.dev"], allowedPaths: ["/inbox"],
      inboxPath: "/inbox", browserProvider: "firecrawl", adapterKey: "roomscout-dev-v1",
      status: "active", policyDecision: "allowed", allowReadOnlyRecon: false, allowInboxPolling: true,
      pollIntervalMinutes, nextPollAt, failureCount: 0, createdAt: now, updatedAt: now,
    });
    const contextId = await ctx.db.insert("browserContexts", {
      connectionId, ownerId, providerContextId: "profile", browserProvider: "firecrawl",
      status: "ready", lastVerifiedAt: now, createdAt: now, updatedAt: now,
    });
    const runId = await ctx.db.insert("browserRuns", {
      connectionId, ownerId, contextId, browserProvider: "firecrawl", kind: "inbox_sync",
      status: "running", startedAt: now, expiresAt: now + 60_000, createdAt: now, updatedAt: now,
    });
    return { ownerId, sourceId, connectionId, runId };
  });
  return { t, ...ids };
}

it("schedules no poll after a completed run when the interval is 0", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, connectionId, runId } = await fixture(0, Date.now() + 60_000);
  await t.mutation(internal.portalConnections.finishRun, { runId, status: "completed", resultCount: 1 });
  const connection = await t.run((ctx) => ctx.db.get(connectionId));
  expect(connection?.nextPollAt).toBeUndefined();
});

it("schedules no failure backoff poll when the interval is 0", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, connectionId, runId } = await fixture(0, Date.now() + 60_000);
  await t.mutation(internal.portalConnections.finishRun, { runId, status: "failed", errorCode: "FIRECRAWL_INBOX_SYNC_FAILED" });
  const connection = await t.run((ctx) => ctx.db.get(connectionId));
  expect(connection?.nextPollAt).toBeUndefined();
  expect(connection?.lastErrorCode).toBe("FIRECRAWL_INBOX_SYNC_FAILED");
});

it("keeps scheduling a poll for a connection that still has a positive interval", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, connectionId, runId } = await fixture(30);
  const before = Date.now();
  await t.mutation(internal.portalConnections.finishRun, { runId, status: "completed", resultCount: 1 });
  const connection = await t.run((ctx) => ctx.db.get(connectionId));
  expect(connection?.nextPollAt).toBeGreaterThanOrEqual(before + 30 * 60_000);
});

it("never reports a connection without a scheduled poll as due", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t } = await fixture(0);
  const due = await t.query(internal.portalConnections.listDueInboxSyncs, {
    now: Date.now(), cursor: null, limit: 50,
  });
  expect(due.rows).toEqual([]);
});

it("still runs a failure-backoff retry that a sync scheduled", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture(0, Date.now() - 1);
  const due = await t.query(internal.portalConnections.listDueInboxSyncs, {
    now: Date.now(), cursor: null, limit: 50,
  });
  expect(due.rows).toEqual([{ ownerId, connectionId }]);
});

it("disableAutomaticPolling clears the interval and the pending poll of controlled connections", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, connectionId } = await fixture(5, Date.now() + 60_000);
  expect(await t.mutation(internal.portalConnections.disableAutomaticPolling, {})).toEqual({ updated: 1 });
  expect(await t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ pollIntervalMinutes: 0 });
  expect(await t.run((ctx) => ctx.db.get(connectionId))).not.toHaveProperty("nextPollAt");
  // Idempotent: a second run changes nothing.
  expect(await t.mutation(internal.portalConnections.disableAutomaticPolling, {})).toEqual({ updated: 0 });
});

it("setPollIntervalInternal accepts 0 and drops the pending poll", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, connectionId } = await fixture(5, Date.now() + 60_000);
  await t.mutation(internal.portalConnections.setPollIntervalInternal, { connectionId, minutes: 0 });
  expect(await t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ pollIntervalMinutes: 0 });
  expect(await t.run((ctx) => ctx.db.get(connectionId))).not.toHaveProperty("nextPollAt");
  await expect(t.mutation(internal.portalConnections.setPollIntervalInternal, { connectionId, minutes: -1 }))
    .rejects.toThrow("POLL_INTERVAL_INVALID");
});
