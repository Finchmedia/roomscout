/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
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
