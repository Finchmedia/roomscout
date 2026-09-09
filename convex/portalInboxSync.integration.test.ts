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
      context: { ownerId: f.ownerId, connectionId, generation: 1 }, result: { kind: "success", returnValue: null } });
    expect(await f.t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ inboxSyncGeneration: 2, inboxSyncActiveGeneration: 2 });
  });

  it("retains a bounded poll retry after the final worker failure", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!; const before = Date.now();
    await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "poll" });
    await f.t.mutation(internal.portalInboxSync.syncCompleted, { workId: "work-1" as never,
      context: { ownerId: f.ownerId, connectionId, generation: 1 }, result: { kind: "failed", error: "sanitized" } });
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

  it("rechecks pause, policy, generation, and deadline immediately before browser work", async () => {
    const f = await fixture(); const connectionId = f.connectionIds[0]!;
    await f.t.mutation(internal.portalInboxSync.requestSync, { ownerId: f.ownerId, connectionId, reason: "poll" });
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1 })).toBe(true);
    await f.t.run((ctx) => ctx.db.patch(connectionId, { status: "paused" }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1 })).toBe(false);
    await f.t.run((ctx) => ctx.db.patch(connectionId, { status: "active", policyDecision: "restricted" }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1 })).toBe(false);
    await f.t.run((ctx) => ctx.db.patch(connectionId, { policyDecision: "allowed", inboxSyncActiveGeneration: 2 }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 1 })).toBe(false);
    await f.t.run((ctx) => ctx.db.patch(connectionId, { inboxSyncActiveGeneration: 2, inboxSyncDeadlineAt: 1 }));
    expect(await f.t.mutation(internal.portalInboxSync.claimWorker, { ownerId: f.ownerId, connectionId, generation: 2 })).toBe(false);
  });

  it("atomically excludes write-after-read and read-after-write on the same connection", async () => {
    const readFirst = await fixture(); const readConnectionId = readFirst.connectionIds[0]!;
    const readFirstExecution = await insertClaimedWrite(readFirst);
    await readFirst.t.mutation(internal.portalInboxSync.requestSync, { ownerId: readFirst.ownerId, connectionId: readConnectionId, reason: "poll" });
    expect(await readFirst.t.mutation(internal.portalConnections.claimWriteSession, { ownerId: readFirst.ownerId, connectionId: readConnectionId, executionId: readFirstExecution })).toBe(false);

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
