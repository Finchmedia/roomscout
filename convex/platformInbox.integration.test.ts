/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const data = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const otherOwnerId = await ctx.db.insert("users", {
      username: "other",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      slug: "fixture-portal",
      name: "Fixture Portal",
      baseUrl: "https://portal.example",
      side: "both",
      status: "active",
      health: "healthy",
      accessMode: "authenticated",
      automationReview: "approved",
      createdAt: now,
      updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId,
      sourceId,
      label: "My portal",
      allowedDomains: ["portal.example"],
      allowedPaths: ["/roomscout-fixture/messages"],
      status: "active",
      policyDecision: "allowed",
      allowReadOnlyRecon: true,
      allowInboxPolling: true,
      pollIntervalMinutes: 60,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, otherOwnerId, connectionId };
  });
  return { t, ...data };
}

it("records one provider-confirmed outbound platform message idempotently", async () => {
  const { t, ownerId, connectionId } = await fixture();
  const input = {
    ownerId,
    connectionId,
    providerThreadId: "provider-thread-1",
    providerMessageId: "provider-message-1",
    participants: ["Robin"],
    subject: "Room inquiry",
    bodyText: "Is the room still available?",
    sentAt: Date.now(),
  };
  const first = await t.mutation(internal.platformInbox.recordOutboundWrite, input);
  const second = await t.mutation(internal.platformInbox.recordOutboundWrite, input);
  expect(first.created).toBe(true);
  expect(second).toEqual({ ...first, created: false });
  const stored = await t.run(async (ctx) => ({
    threads: await ctx.db.query("platformThreads").collect(),
    messages: await ctx.db.query("platformMessages").collect(),
  }));
  expect(stored.threads).toHaveLength(1);
  expect(stored.messages).toHaveLength(1);
  expect(stored.messages[0]?.direction).toBe("outbound");
});

it("will not resolve or record a platform thread for another owner", async () => {
  const { t, ownerId, otherOwnerId, connectionId } = await fixture();
  const recorded = await t.mutation(internal.platformInbox.recordOutboundWrite, {
    ownerId,
    connectionId,
    providerThreadId: "provider-thread-1",
    providerMessageId: "provider-message-1",
    participants: ["Robin"],
    bodyText: "Hello",
    sentAt: Date.now(),
  });
  expect(
    await t.query(internal.platformInbox.getThreadForWrite, {
      ownerId: otherOwnerId,
      connectionId,
      threadId: recorded.threadId,
    }),
  ).toBeNull();
  await expect(
    t.mutation(internal.platformInbox.recordOutboundWrite, {
      ownerId: otherOwnerId,
      connectionId,
      providerThreadId: "provider-thread-2",
      providerMessageId: "provider-message-2",
      participants: ["Robin"],
      bodyText: "Hello",
      sentAt: Date.now(),
    }),
  ).rejects.toThrow();
});

async function insertUnknownPlatformWrite(
  f: Awaited<ReturnType<typeof fixture>>,
  input: { ownerId?: Id<"users">; threadId?: Id<"platformThreads">; targetPath?: string; matchingSignalId?: Id<"signals">; body: string; key: string },
) {
  return await f.t.run(async (ctx) => {
    const now = Date.now() - 1_000;
    const ownerId = input.ownerId ?? f.ownerId;
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId,
      connectionId: f.connectionId,
      matchingSignalId: input.matchingSignalId,
      automationMode: "exact_once",
      requestedActionType: "send_platform_dm",
      personalDataScopes: [],
      payload: { kind: "platform_message", threadId: input.threadId, targetPath: input.targetPath, recipients: ["Robin"], body: input.body },
      contentVersion: 1,
      contentHash: `hash-${input.key}`,
      status: "executing",
      executionIdempotencyKey: `execution-${input.key}`,
      error: "SUBMIT_RESULT_UNKNOWN",
      createdAt: now,
      updatedAt: now,
    });
    const approvalId = await ctx.db.insert("actionApprovals", {
      requestId,
      ownerId,
      contentVersion: 1,
      contentHash: `hash-${input.key}`,
      payloadSnapshot: { kind: "platform_message", threadId: input.threadId, targetPath: input.targetPath, recipients: ["Robin"], body: input.body },
      decision: "approved",
      decidedAt: now,
    });
    const executionId = await ctx.db.insert("actionExecutions", {
      requestId,
      ownerId,
      approvalId,
      connectionId: f.connectionId,
      status: "unknown",
      idempotencyKey: `execution-${input.key}`,
      startedAt: now,
      error: "SUBMIT_RESULT_UNKNOWN",
      createdAt: now,
      updatedAt: now,
    });
    return { requestId, executionId };
  });
}

it("reconciles one exact ordinary outgoing receipt and deduplicates its replay", async () => {
  const f = await fixture();
  const threadId = await f.t.run((ctx) => ctx.db.insert("platformThreads", {
    connectionId: f.connectionId, ownerId: f.ownerId, providerThreadId: "thread-exact",
    participants: ["Robin"], lastMessageAt: Date.now(), status: "open",
    createdAt: Date.now(), updatedAt: Date.now(),
  }));
  const unknown = await insertUnknownPlatformWrite(f, { threadId, body: "Exact approved body", key: "exact" });
  const batch = { ownerId: f.ownerId, connectionId: f.connectionId, threads: [{
    providerThreadId: "thread-exact", participants: ["Robin"], lastMessageAt: Date.now(), messages: [{
      providerMessageId: "receipt-exact", direction: "outbound" as const,
      bodyText: "Exact approved body", sentAt: Date.now(),
    }],
  }] };
  await f.t.mutation(internal.platformInbox.upsertReadOnlyBatch, batch);
  expect(await f.t.run((ctx) => ctx.db.get(unknown.executionId))).toMatchObject({
    status: "succeeded", providerThreadId: "thread-exact", providerMessageId: "receipt-exact",
  });
  expect(await f.t.run((ctx) => ctx.db.get(unknown.requestId))).toMatchObject({ status: "executed" });
  await expect(f.t.mutation(internal.platformInbox.upsertReadOnlyBatch, batch)).resolves.toMatchObject({ messagesCreated: 0 });
  expect(await f.t.run((ctx) => ctx.db.query("platformMessages").collect())).toHaveLength(1);
});

it("does not reconcile ambiguous, different-body, or wrong-owner unknown writes", async () => {
  const f = await fixture();
  const threadId = await f.t.run((ctx) => ctx.db.insert("platformThreads", {
    connectionId: f.connectionId, ownerId: f.ownerId, providerThreadId: "thread-guarded",
    participants: ["Robin"], lastMessageAt: Date.now(), status: "open",
    createdAt: Date.now(), updatedAt: Date.now(),
  }));
  const first = await insertUnknownPlatformWrite(f, { threadId, body: "Ambiguous body", key: "ambiguous-a" });
  const second = await insertUnknownPlatformWrite(f, { threadId, body: "Ambiguous body", key: "ambiguous-b" });
  const different = await insertUnknownPlatformWrite(f, { threadId, body: "Different approved body", key: "different" });
  await f.t.mutation(internal.platformInbox.upsertReadOnlyBatch, { ownerId: f.ownerId, connectionId: f.connectionId, threads: [{
    providerThreadId: "thread-guarded", participants: ["Robin"], lastMessageAt: Date.now(), messages: [{
      providerMessageId: "receipt-ambiguous", direction: "outbound", bodyText: "Ambiguous body", sentAt: Date.now(),
    }, { providerMessageId: "receipt-other", direction: "outbound", bodyText: "Other body", sentAt: Date.now() }],
  }] });
  for (const id of [first.executionId, second.executionId, different.executionId]) {
    expect(await f.t.run((ctx) => ctx.db.get(id))).toMatchObject({ status: "unknown" });
  }
  expect(await f.t.mutation(internal.externalActions.reconcileObservedPortalMessage, {
    ownerId: f.otherOwnerId, connectionId: f.connectionId, threadId, providerMessageId: "receipt-ambiguous",
  })).toBe(false);
});

it("reconciles an initial-contact receipt only through exact listing and thread provenance", async () => {
  const f = await fixture();
  const provenance = await f.t.run(async (ctx) => {
    const connection = await ctx.db.get(f.connectionId);
    if (!connection) throw new Error("fixture connection missing");
    const now = Date.now();
    const targetId = await ctx.db.insert("sourceTargets", { sourceId: connection.sourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: "fixture", scheduleMinutes: 60, nextRunAt: now, paused: false, createdAt: now, updatedAt: now });
    const entryId = await ctx.db.insert("sourceEntries", { sourceId: connection.sourceId, sourceTargetId: targetId, externalId: "listing_exact", canonicalUrl: "https://roomscout.dev/listings/listing_exact", detailUrl: "https://roomscout.dev/listings/listing_exact", title: "Exact Listing", excerpt: "Room", side: "supply", status: "active", detailState: "processed", detailAttempts: 0, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { sourceEntryId: entryId, side: "supply", title: "Exact Listing", city: "Berlin", summary: "Room", arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    await ctx.db.insert("platformThreads", { connectionId: f.connectionId, ownerId: f.ownerId, providerThreadId: "thread-initial-exact", subject: "Re: Exact Listing", participants: ["Robin"], lastMessageAt: now, status: "open", createdAt: now, updatedAt: now });
    await ctx.db.insert("platformThreads", { connectionId: f.connectionId, ownerId: f.ownerId, providerThreadId: "thread-wrong-listing", subject: "Re: Different Listing", participants: ["Robin"], lastMessageAt: now, status: "open", createdAt: now, updatedAt: now });
    return { signalId };
  });
  const exact = await insertUnknownPlatformWrite(f, { targetPath: "/listings/listing_exact", matchingSignalId: provenance.signalId, body: "Initial exact body", key: "initial-exact" });
  const wrong = await insertUnknownPlatformWrite(f, { targetPath: "/listings/listing_exact", matchingSignalId: provenance.signalId, body: "Wrong-thread body", key: "initial-wrong" });
  await f.t.mutation(internal.platformInbox.upsertReadOnlyBatch, { ownerId: f.ownerId, connectionId: f.connectionId, threads: [{
    providerThreadId: "thread-initial-exact", subject: "Re: Exact Listing", participants: ["Robin"], lastMessageAt: Date.now(), messages: [{ providerMessageId: "receipt-initial", direction: "outbound", bodyText: "Initial exact body", sentAt: Date.now() }],
  }, {
    providerThreadId: "thread-wrong-listing", subject: "Re: Different Listing", participants: ["Robin"], lastMessageAt: Date.now(), messages: [{ providerMessageId: "receipt-wrong-listing", direction: "outbound", bodyText: "Wrong-thread body", sentAt: Date.now() }],
  }] });
  expect(await f.t.run((ctx) => ctx.db.get(exact.executionId))).toMatchObject({ status: "succeeded", providerThreadId: "thread-initial-exact", providerMessageId: "receipt-initial" });
  expect(await f.t.run((ctx) => ctx.db.get(wrong.executionId))).toMatchObject({ status: "unknown" });
});
