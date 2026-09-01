/// <reference types="vite/client" />
import agentmailTest from "@agentmail/convex/test";
import workpoolTest from "@convex-dev/workpool/test";
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const agentmailModules = import.meta.glob(
  "../node_modules/@agentmail/convex/src/component/**/*.{ts,js}",
);

function registerAgentMail(t: ReturnType<typeof convexTest>) {
  t.registerComponent("agentmail", agentmailTest.schema, agentmailModules);
  workpoolTest.register(t, "agentmail/sendPool");
  workpoolTest.register(t, "agentmail/callbackPool");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

it("reuses one durable component outbound for the same approved send", async () => {
  vi.stubEnv("AGENTMAIL_API_KEY", "agentmail-test-key");
  const t = convexTest(schema, modules);
  registerAgentMail(t);

  const seeded = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "component-owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "Test room",
      city: "Stuttgart",
      summary: "A test signal",
      arrangement: "shared",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Band room",
      city: "Stuttgart",
      districts: [],
      arrangement: ["shared"],
      schedule: [],
      requirements: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const mailboxId = await ctx.db.insert("userMailboxes", {
      ownerId,
      provider: "agentmail",
      providerInboxId: "inbox-test",
      emailAddress: "rs-test@agentmail.to",
      clientId: "roomscout-user-test",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const draftId = await ctx.db.insert("outreachDrafts", {
      ownerId,
      signalId,
      savedNeedId,
      recipientName: "Room owner",
      recipientEmail: "owner@example.com",
      subject: "Rehearsal room",
      body: "Is the room available?",
      contentVersion: 1,
      contentHash: "content-hash",
      status: "sending",
      sendIdempotencyKey: "approval-key",
      createdAt: now,
      updatedAt: now,
    });
    return { draftId, mailboxId };
  });

  const args = {
    ...seeded,
    idempotencyKey: "approval-key",
    recipientEmail: "owner@example.com",
    subject: "Rehearsal room",
    body: "Is the room available?",
  };
  const first = await t.mutation(
    internal.agentmailComponent.enqueueApprovedSend,
    args,
  );
  const second = await t.mutation(
    internal.agentmailComponent.enqueueApprovedSend,
    args,
  );

  expect(first.reused).toBe(false);
  expect(second).toEqual({ outboundId: first.outboundId, reused: true });
  expect(
    await t.run(async (ctx) =>
      (await ctx.db.get(seeded.draftId))?.agentmailComponentOutboundId,
    ),
  ).toBe(first.outboundId);
});

it("rejects enqueue when the persisted approved envelope changed", async () => {
  vi.stubEnv("AGENTMAIL_API_KEY", "agentmail-test-key");
  const t = convexTest(schema, modules);
  registerAgentMail(t);

  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "component-owner-2",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "Test room",
      city: "Hamburg",
      summary: "A test signal",
      arrangement: "shared",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Band room",
      city: "Hamburg",
      districts: [],
      arrangement: ["shared"],
      schedule: [],
      requirements: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const mailboxId = await ctx.db.insert("userMailboxes", {
      ownerId,
      provider: "agentmail",
      providerInboxId: "inbox-test-2",
      emailAddress: "rs-test-2@agentmail.to",
      clientId: "roomscout-user-test-2",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const draftId = await ctx.db.insert("outreachDrafts", {
      ownerId,
      signalId,
      savedNeedId,
      recipientName: "Room owner",
      recipientEmail: "owner@example.com",
      subject: "Rehearsal room",
      body: "Persisted approved body",
      contentVersion: 1,
      contentHash: "content-hash",
      status: "sending",
      sendIdempotencyKey: "approval-key-2",
      createdAt: now,
      updatedAt: now,
    });
    return { draftId, mailboxId };
  });

  await expect(
    t.mutation(internal.agentmailComponent.enqueueApprovedSend, {
      ...ids,
      idempotencyKey: "approval-key-2",
      recipientEmail: "owner@example.com",
      subject: "Rehearsal room",
      body: "Changed after approval",
    }),
  ).rejects.toThrow("Approved AgentMail envelope is no longer valid");
});

it("keeps RoomScout webhook auditing idempotent behind component callbacks", async () => {
  const t = convexTest(schema, modules);
  registerAgentMail(t);
  const event = {
    type: "event" as const,
    event_type: "message.received" as const,
    event_id: "evt-component-callback",
    message: {
      inbox_id: "inbox-test",
      thread_id: "thread-test",
      message_id: "message-test",
      from: "owner@example.com",
      to: ["rs-test@agentmail.to"],
      subject: "Re: rehearsal room",
      text: "Still available",
      timestamp: "2026-08-28T12:00:00.000Z",
    },
  };

  await t.mutation(internal.agentmailComponent.receiveEvent, { event });
  await t.mutation(internal.agentmailComponent.receiveEvent, { event });

  const rows = await t.run(async (ctx) =>
    ctx.db
      .query("providerEvents")
      .withIndex("by_provider_and_provider_event_id", (q) =>
        q.eq("provider", "agentmail").eq("providerEventId", event.event_id),
      )
      .collect(),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    provider: "agentmail",
    eventType: "message.received",
    status: "received",
  });
});
