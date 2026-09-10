/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function tombstonedUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      username: "reset-worker-target",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    await ctx.db.insert("devUserResets", {
      targetUserId: userId,
      targetUsername: "reset-worker-target",
      status: "scheduled",
      stage: 0,
      deletedDocumentCount: 0,
      providerInboxResult: "not_present",
      providerContextCount: 0,
      authUsernameReleased: false,
      createdAt: now,
      updatedAt: now,
    });
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId: userId,
      automationMode: "exact_once",
      requestedActionType: "send_platform_dm",
      personalDataScopes: [],
      payload: { kind: "platform_message", recipients: ["Provider"], body: "Queued before reset" },
      contentVersion: 1,
      contentHash: "queued-before-reset",
      status: "approved",
      createdAt: now,
      updatedAt: now,
    });
    return { userId, requestId };
  });
}

it("prevents queued signup callbacks from recreating data for a reset user", async () => {
  const t = convexTest(schema, modules);
  const { userId } = await tombstonedUser(t);

  await expect(t.mutation(internal.demoSourceBootstrap.bootstrapControlledDemoForOwner, {
    ownerId: userId,
  })).rejects.toThrow("USER_NOT_FOUND");
  await expect(t.action(internal.mailboxes.ensureForOwner, {
    ownerId: userId,
  })).resolves.toEqual({ status: "disabled" });

  const state = await t.run(async (ctx) => ({
    connections: await ctx.db.query("portalConnections").withIndex("by_owner", (q) => q.eq("ownerId", userId)).take(1),
    mailboxes: await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", userId)).take(1),
  }));
  expect(state).toEqual({ connections: [], mailboxes: [] });
});

it("prevents stale auth callbacks and browser workers from touching a reset user", async () => {
  const t = convexTest(schema, modules);
  const { userId, requestId } = await tombstonedUser(t);

  await expect(t.mutation(internal.users.onSignInPassword, {
    provider: "password",
    providerAccountId: "stale-provider-account",
    profile: { username: "reset-worker-target" },
    userId,
  })).rejects.toThrow("USER_NOT_FOUND");
  await expect(t.action(internal.browserbasePortal.executeApprovedWriteWorker, {
    ownerId: userId,
    requestId,
  })).rejects.toThrow("USER_RESET_IN_PROGRESS");
});
