/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("filters provider conversations and action requests by need before limiting", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { username: "scoped-owner", role: "musician", createdAt: 1, lastSeenAt: 1 });
    const otherOwnerId = await ctx.db.insert("users", { username: "scoped-other", role: "musician", createdAt: 1, lastSeenAt: 1 });
    const targetNeedId = await ctx.db.insert("savedNeeds", { ownerId, title: "Target", city: "Berlin", arrangement: [], schedule: [], requirements: [], status: "active", createdAt: 1, updatedAt: 1 });
    const noisyNeedId = await ctx.db.insert("savedNeeds", { ownerId, title: "Noise", city: "Hamburg", arrangement: [], schedule: [], requirements: [], status: "active", createdAt: 1, updatedAt: 1 });
    const otherNeedId = await ctx.db.insert("savedNeeds", { ownerId: otherOwnerId, title: "Private", city: "Cologne", arrangement: [], schedule: [], requirements: [], status: "active", createdAt: 1, updatedAt: 1 });
    const signalId = await ctx.db.insert("signals", { side: "supply", title: "Room", city: "Berlin", summary: "Room", arrangement: "unknown", requirements: [], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: 1, lastSeenAt: 1 });
    const insertConversation = async (savedNeedId: typeof targetNeedId, suffix: string, updatedAt: number) => await ctx.db.insert("providerConversations", { ownerId, savedNeedId, signalId, conversationKey: suffix, agentThreadId: suffix, revision: 0, state: "waiting", createdAt: updatedAt, updatedAt });
    const insertRequest = async (savedNeedId: typeof targetNeedId, updatedAt: number) => await ctx.db.insert("actionRequests", { ownerId, savedNeedId, automationMode: "exact_once", requestedActionType: "send_email", personalDataScopes: [], payload: { kind: "email_message", recipientName: "Provider", recipientEmail: "provider@example.test", subject: "Room", body: "Hello" }, contentVersion: 1, contentHash: `hash-${updatedAt}`, status: "drafted", createdAt: updatedAt, updatedAt });
    const targetConversationId = await insertConversation(targetNeedId, "target", 1);
    const targetRequestId = await insertRequest(targetNeedId, 1);
    for (let index = 0; index < 3; index += 1) {
      await insertConversation(noisyNeedId, `noise-${index}`, 10 + index);
      await insertRequest(noisyNeedId, 10 + index);
    }
    return { ownerId, otherOwnerId, targetNeedId, otherNeedId, targetConversationId, targetRequestId };
  });
  const owner = t.withIdentity({ subject: ids.ownerId });
  expect(await owner.query(api.providerConversations.listMine, { savedNeedId: ids.targetNeedId, limit: 1 })).toMatchObject([{ conversationId: ids.targetConversationId, assessmentFromProviderReply: false }]);
  expect(await owner.query(api.externalActions.listMine, { savedNeedId: ids.targetNeedId, limit: 1 })).toMatchObject([{ _id: ids.targetRequestId }]);
  await expect(owner.query(api.providerConversations.listMine, { savedNeedId: ids.otherNeedId })).rejects.toThrow("NEED_NOT_FOUND");
  await expect(owner.query(api.externalActions.listMine, { savedNeedId: ids.otherNeedId })).rejects.toThrow("NEED_NOT_FOUND");
});
