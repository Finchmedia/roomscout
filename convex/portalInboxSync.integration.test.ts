/// <reference types="vite/client" />
import workpoolTest from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function fixture(count = 1) {
  const t = convexTest(schema, modules);
  workpoolTest.register(t, "browserWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "sync-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const otherOwnerId = await ctx.db.insert("users", { username: "other-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "sync-platform", name: "Sync platform", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const connectionIds = [];
    for (let index = 0; index < count; index += 1) {
      const sourceId = await ctx.db.insert("sources", { platformId, slug: `sync-source-${index}`, name: `Sync source ${index}`, baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", automationReview: "approved", adapterKey: "roomscout-dev-v1", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
      const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, platformId, label: `Controlled ${index}`, allowedDomains: ["roomscout.dev"], allowedPaths: ["/inbox"], inboxPath: "/inbox", adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, nextPollAt: now - 1, failureCount: 0, createdAt: now, updatedAt: now });
      await ctx.db.insert("browserContexts", { connectionId, ownerId, providerContextId: `context-${index}`, status: "ready", createdAt: now, updatedAt: now });
      connectionIds.push(connectionId);
    }
    return { ownerId, otherOwnerId, connectionIds };
  });
  return { t, ...ids };
}

describe("portal inbox sync coordinator", () => {
  it("accepts repeated notifications without hourly quotas or legacy circuit cooldowns", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    await f.t.run((ctx) => ctx.db.patch(connectionId, {
      circuitOpenUntil: Date.now() + 24 * 60 * 60_000, failureCount: 3,
    }));
    for (let generation = 1; generation <= 6; generation += 1) {
      expect(await f.t.mutation(internal.portalInboxSync.requestSync, {
        ownerId: f.ownerId, connectionId, reason: "notification", receiptKey: `fresh-${generation}`,
      })).toEqual({ status: "queued" });
      await f.t.mutation(internal.portalInboxSync.syncCompleted, {
        workId: `work-${generation}` as never,
        context: { ownerId: f.ownerId, connectionId, generation, browserProvider: "browserbase" },
        result: { kind: "success", returnValue: null },
      });
    }
    expect(await f.t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ inboxSyncGeneration: 6 });
  });

  async function insertClaimedWrite(f: Awaited<ReturnType<typeof fixture>>) {
    return await f.t.run(async (ctx) => {
      const now = Date.now(); const connectionId = f.connectionIds[0]!;
      const requestId = await ctx.db.insert("actionRequests", { ownerId: f.ownerId, connectionId,
        automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: [],
        payload: { kind: "platform_message", recipients: ["provider"], body: "Synthetic approved write" },
        contentVersion: 1, contentHash: "hash", status: "executing", createdAt: now, updatedAt: now });
      const approvalId = await ctx.db.insert("actionApprovals", { requestId, ownerId: f.ownerId, contentVersion: 1,
        contentHash: "hash", payloadSnapshot: { kind: "platform_message", recipients: ["provider"], body: "Synthetic approved write" },
        decision: "approved", decidedAt: now });
      return await ctx.db.insert("actionExecutions", { requestId, ownerId: f.ownerId, approvalId, connectionId,
        status: "claimed", idempotencyKey: `write-${now}`, startedAt: now, createdAt: now, updatedAt: now });
    });
  }

  it("deduplicates receipt replays and coalesces concurrent hints", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    expect(await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "notification", receiptKey: "receipt-1" })).toEqual({ status: "queued" });
    expect(await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "notification", receiptKey: "receipt-1" })).toEqual({ status: "ignored" });
    expect(await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "notification", receiptKey: "receipt-2" })).toEqual({ status: "coalesced" });
    expect(await f.t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ inboxSyncGeneration: 2, inboxSyncActiveGeneration: 1 });
  });

  it("turns a hint arriving during a read into exactly one follow-up generation", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "poll" });
    await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "notification", receiptKey: "new-hint" });
    await f.t.mutation(internal.portalInboxSync.syncCompleted, { workId: "work-1" as never,
      context: { ownerId: f.ownerId, connectionId, generation: 1, browserProvider: "browserbase" }, result: { kind: "success", returnValue: null } });
    expect(await f.t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ inboxSyncGeneration: 2, inboxSyncActiveGeneration: 2 });
  });

  it("retains a bounded poll retry after the final worker failure", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!; const before = Date.now();
    await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "poll" });
    await f.t.mutation(internal.portalInboxSync.syncCompleted, { workId: "work-1" as never,
      context: { ownerId: f.ownerId, connectionId, generation: 1, browserProvider: "browserbase" }, result: { kind: "failed", error: "sanitized" } });
    const connection = await f.t.run((ctx) => ctx.db.get(connectionId));
    expect(connection?.inboxSyncActiveGeneration).toBeUndefined();
    expect(connection?.nextPollAt).toBeGreaterThanOrEqual(before + 5 * 60_000);
  });

  it("ignores wrong-owner, paused, reauth, and active-auth-session requests", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    expect(await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.otherOwnerId, connectionId, reason: "manual" })).toEqual({ status: "ignored" });
    for (const status of ["paused", "reauth_required"] as const) {
      await f.t.run((ctx) => ctx.db.patch(connectionId, { status }));
      expect(await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "manual" })).toEqual({ status: "ignored" });
    }
    await f.t.run(async (ctx) => {
      await ctx.db.patch(connectionId, { status: "active" });
      const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", connectionId)).unique();
      const runId = await ctx.db.insert("browserRuns", { ownerId: f.ownerId, connectionId, contextId: context!._id, kind: "authenticate", status: "running", expiresAt: Date.now() + 60_000, createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.patch(context!._id, { activeRunId: runId });
    });
    expect(await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "manual" })).toEqual({ status: "ignored" });
  });

  it("blocks new, manual, and already-queued worker admission during provider maintenance", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    await f.t.run(async (ctx) => {
      await ctx.db.insert("portalBrowserMaintenance", {
        key: "controlled_portal", paused: true, drainingProvider: "browserbase",
        pausedBy: f.ownerId, pausedAt: Date.now(), updatedAt: Date.now(),
      });
      await ctx.db.patch(connectionId, {
        inboxSyncGeneration: 7, inboxSyncActiveGeneration: 7,
        inboxSyncDeadlineAt: Date.now() + 60_000,
      });
    });
    await expect(f.t.mutation(internal.portalInboxSync.requestSync, {
      ownerId: f.ownerId, connectionId, reason: "poll",
    })).resolves.toEqual({ status: "ignored" });
    await expect(f.t.mutation(internal.portalInboxSync.beginManualSync, {
      ownerId: f.ownerId, connectionId,
    })).resolves.toBeNull();
    await expect(f.t.mutation(internal.portalInboxSync.claimWorker, {
      ownerId: f.ownerId, connectionId, generation: 7, browserProvider: "browserbase",
    })).resolves.toBeNull();
  });

  it("rechecks pause, policy, generation, and deadline immediately before browser work", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "poll" });
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1, browserProvider: "browserbase" })).toEqual({ requestedThreadIds: [], startOffset: 0 });
    await f.t.run((ctx) => ctx.db.patch(connectionId, { status: "paused" }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1, browserProvider: "browserbase" })).toBeNull();
    await f.t.run((ctx) => ctx.db.patch(connectionId, { status: "active", policyDecision: "restricted" }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1, browserProvider: "browserbase" })).toBeNull();
    await f.t.run((ctx) => ctx.db.patch(connectionId, { policyDecision: "allowed", inboxSyncActiveGeneration: 2 }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1, browserProvider: "browserbase" })).toBeNull();
    await f.t.run((ctx) => ctx.db.patch(connectionId, { inboxSyncActiveGeneration: 2, inboxSyncDeadlineAt: 1 }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 2, browserProvider: "browserbase" })).toBeNull();
  });

  it("rejects stale-provider claims after an engine switch", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    await f.t.mutation(internal.portalInboxSync.requestSync, {
      ownerId: f.ownerId, connectionId, reason: "poll",
    });
    vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, {
      ownerId: f.ownerId, connectionId, generation: 1,
      browserProvider: "browserbase",
    })).toBeNull();
    await f.t.run(async (ctx) => {
      const context = await ctx.db.query("browserContexts")
        .withIndex("by_connection", (q) => q.eq("connectionId", connectionId)).unique();
      await ctx.db.patch(connectionId, { browserProvider: "firecrawl" });
      await ctx.db.patch(context!._id, { browserProvider: "firecrawl" });
    });
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, {
      ownerId: f.ownerId, connectionId, generation: 1,
      browserProvider: "browserbase",
    })).toBeNull();
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, {
      ownerId: f.ownerId, connectionId, generation: 1,
      browserProvider: "firecrawl",
    })).toEqual({ requestedThreadIds: [], startOffset: 0 });
  });

  it("prioritizes bounded notification hints and advances the persisted cursor", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    const existingThreadId = await f.t.run((ctx) => ctx.db.insert("platformThreads", {
      connectionId, ownerId: f.ownerId, providerThreadId: "thread_existing",
      subject: "Existing thread", participants: ["Owner"], lastMessageAt: 1,
      status: "open", createdAt: Date.now(), updatedAt: Date.now(),
    }));
    await f.t.mutation(internal.portalInboxSync.requestSync, {
      ownerId: f.ownerId, connectionId, reason: "notification",
      receiptKey: "receipt-priority", providerThreadId: "thread_17",
    });
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, {
      ownerId: f.ownerId, connectionId, generation: 1,
      browserProvider: "browserbase",
    })).toEqual({ requestedThreadIds: ["thread_17"], startOffset: 0 });
    expect(await f.t.mutation(internal.portalInboxSync.recordReadProgress, {
      ownerId: f.ownerId, connectionId, generation: 1,
      browserProvider: "browserbase", nextOffset: 10,
      remainingRequestedThreadIds: [], partial: true, truncated: true,
      timedOut: false,
    })).toBe(true);
    expect(await f.t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({
      inboxSyncCursor: 10,
      inboxSyncRequestedThreadIds: [],
      inboxSyncLastPartial: true,
      inboxSyncLastTruncated: true,
      inboxSyncLastTimedOut: false,
    });
    expect(await f.t.run((ctx) => ctx.db.get(existingThreadId))).toMatchObject({
      providerThreadId: "thread_existing",
      status: "open",
    });
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, {
      ownerId: f.ownerId, connectionId, generation: 1,
      browserProvider: "browserbase",
    })).toEqual({ requestedThreadIds: [], startOffset: 10 });
  });

  it("atomically excludes write-after-read and read-after-write on the same connection", async () => {
    const readFirst = await fixture(); const readConnectionId = readFirst.connectionIds[0]!;
    const readFirstExecution = await insertClaimedWrite(readFirst);
    const claimWrite = () => readFirst.t.mutation(internal.portalConnections.claimWriteSession, { ownerId: readFirst.ownerId, connectionId: readConnectionId, executionId: readFirstExecution });
    // A merely queued read (inbox lease) no longer blocks the write: the shared pool serializes both.
    expect(await readFirst.t.mutation(internal.portalInboxSync.requestSync, { ownerId: readFirst.ownerId, connectionId: readConnectionId, reason: "poll" })).toEqual({ status: "queued" });
    expect(await claimWrite()).toBe(true);
    // A read that actually started (its run owns the context) still does.
    await readFirst.t.run(async (ctx) => {
      const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", readConnectionId)).unique();
      const runId = await ctx.db.insert("browserRuns", { ownerId: readFirst.ownerId, connectionId: readConnectionId, contextId: context!._id, kind: "inbox_sync", status: "running", expiresAt: Date.now() + 60_000, createdAt: Date.now(), updatedAt: Date.now() });
      await ctx.db.patch(context!._id, { activeRunId: runId });
    });
    expect(await claimWrite()).toBe(false);

    const writeFirst = await fixture(); const writeConnectionId = writeFirst.connectionIds[0]!;
    const writeFirstExecution = await insertClaimedWrite(writeFirst);
    expect(await writeFirst.t.mutation(internal.portalConnections.claimWriteSession, { ownerId: writeFirst.ownerId, connectionId: writeConnectionId, executionId: writeFirstExecution })).toBe(true);
    expect(await writeFirst.t.mutation(internal.portalInboxSync.requestSync, { ownerId: writeFirst.ownerId, connectionId: writeConnectionId, reason: "poll" })).toEqual({ status: "ignored" });
  });

  it("paginates every due eligible connection beyond the old first-five boundary", async () => {
    const f = await fixture(8);
    const page = await f.t.query(internal.portalConnections.listDueInboxSyncs, { now: Date.now(), cursor: null, limit: 50 });
    expect(page.rows).toHaveLength(8);
    expect(page.isDone).toBe(true);
  });
});
