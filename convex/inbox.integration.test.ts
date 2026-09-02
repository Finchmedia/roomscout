/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("stores unmatched portal verification mail once and isolates it by owner", async () => {
  const t = convexTest(schema, modules);
  const { ownerId, otherId, mailboxId } = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "owner", role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "other", role: "musician", createdAt: now, lastSeenAt: now });
    const mailboxId = await ctx.db.insert("userMailboxes", { ownerId, provider: "agentmail", providerInboxId: "inbox-1", emailAddress: "owner@agentmail.to", clientId: "owner-client", status: "active", createdAt: now, updatedAt: now });
    return { ownerId, otherId, mailboxId };
  });
  const input = {
    mailboxId,
    providerThreadId: "provider-thread",
    providerMessageId: "provider-message",
    providerEventId: "provider-event",
    from: "portal@example.com",
    to: ["owner@agentmail.to"],
    subject: "Confirm your portal account",
    body: "Use this verification link to activate your account.",
    htmlAvailable: false,
    receivedAt: Date.now(),
  };
  const first = await t.mutation(internal.inbox.storeMailboxMessage, input);
  const duplicate = await t.mutation(internal.inbox.storeMailboxMessage, input);
  expect(duplicate).toBe(first);

  const owner = t.withIdentity({ subject: ownerId });
  const other = t.withIdentity({ subject: otherId });
  const ownerRows = await owner.query(api.inbox.listMailboxMessagesMine, { limit: 10 });
  expect(ownerRows).toHaveLength(1);
  expect(ownerRows[0]?.kind).toBe("portal_verification");
  expect(await other.query(api.inbox.listMailboxMessagesMine, { limit: 10 })).toEqual([]);
});

it("does not let a late delivered event downgrade an already replied outreach", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "delivery-owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "Controlled rehearsal-room listing",
      city: "Stuttgart",
      summary: "Controlled test signal",
      arrangement: "shared",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      publishedAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Controlled search",
      city: "Stuttgart",
      districts: [],
      arrangement: ["shared"],
      schedule: [],
      requirements: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const draftId = await ctx.db.insert("outreachDrafts", {
      ownerId,
      signalId,
      savedNeedId,
      recipientName: "Controlled recipient",
      recipientEmail: "recipient@example.test",
      subject: "Controlled inquiry",
      body: "Controlled message",
      contentVersion: 1,
      contentHash: "controlled-hash",
      status: "replied",
      providerThreadId: "provider-thread-replied",
      providerMessageId: "provider-message-outbound",
      deliveryStatus: "sent",
      createdAt: now,
      updatedAt: now,
    });
    const mailboxId = await ctx.db.insert("userMailboxes", {
      ownerId,
      provider: "agentmail",
      providerInboxId: "provider-inbox",
      emailAddress: "controlled@agentmail.test",
      clientId: "controlled-client",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const threadId = await ctx.db.insert("mailThreads", {
      ownerId,
      draftId,
      providerThreadId: "provider-thread-replied",
      subject: "Controlled inquiry",
      status: "replied",
      lastMessageAt: now,
      createdAt: now,
      mailboxId,
      lastDeliveryStatus: "sent",
    });
    const messageId = await ctx.db.insert("mailMessages", {
      threadId,
      providerMessageId: "provider-message-outbound",
      direction: "outbound",
      from: "controlled@agentmail.test",
      to: ["recipient@example.test"],
      subject: "Controlled inquiry",
      body: "Controlled message",
      receivedAt: now,
      deliveryStatus: "sent",
      providerEventAt: now,
    });
    return { draftId, mailboxId, messageId, threadId, now };
  });

  expect(await t.mutation(internal.inbox.applyDeliveryEvent, {
    mailboxId: fixture.mailboxId,
    providerThreadId: "provider-thread-replied",
    providerMessageId: "provider-message-outbound",
    status: "delivered",
    eventAt: fixture.now + 1,
  })).toBe(true);

  const state = await t.run(async (ctx) => ({
    draft: await ctx.db.get(fixture.draftId),
    message: await ctx.db.get(fixture.messageId),
    thread: await ctx.db.get(fixture.threadId),
  }));
  expect(state.message?.deliveryStatus).toBe("delivered");
  expect(state.thread?.lastDeliveryStatus).toBe("delivered");
  expect(state.thread?.status).toBe("replied");
  expect(state.draft?.deliveryStatus).toBe("delivered");
  expect(state.draft?.status).toBe("replied");
});
