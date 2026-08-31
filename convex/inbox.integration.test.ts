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
