/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("maps one existing scoped inbox idempotently to the selected owner", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      username: "controlled-mailbox-owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
  });
  const args = {
    ownerId,
    providerInboxId: "inbox-controlled",
    emailAddress: "controlled@agentmail.to",
    clientId: "roomscout-controlled-test",
  };

  const first = await t.mutation(
    internal.mailboxes.assignControlledScopedInbox,
    args,
  );
  const second = await t.mutation(
    internal.mailboxes.assignControlledScopedInbox,
    args,
  );

  expect(first).toMatchObject({ status: "active", reused: false });
  expect(second).toMatchObject({
    status: "active",
    mailboxId: first.mailboxId,
    reused: true,
  });
  const mailboxes = await t.run(async (ctx) =>
    ctx.db.query("userMailboxes").collect(),
  );
  expect(mailboxes).toHaveLength(1);
});

it("rejects assigning one provider inbox to a second owner", async () => {
  const t = convexTest(schema, modules);
  const owners = await t.run(async (ctx) => {
    const now = Date.now();
    const first = await ctx.db.insert("users", {
      username: "controlled-mailbox-first",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const second = await ctx.db.insert("users", {
      username: "controlled-mailbox-second",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    return { first, second };
  });
  const common = {
    providerInboxId: "inbox-controlled",
    emailAddress: "controlled@agentmail.to",
    clientId: "roomscout-controlled-test",
  };
  await t.mutation(internal.mailboxes.assignControlledScopedInbox, {
    ownerId: owners.first,
    ...common,
  });

  await expect(
    t.mutation(internal.mailboxes.assignControlledScopedInbox, {
      ownerId: owners.second,
      ...common,
    }),
  ).rejects.toThrow("PROVIDER_INBOX_ALREADY_ASSIGNED");
});
