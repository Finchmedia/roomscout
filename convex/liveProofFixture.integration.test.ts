/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const createFixture = makeFunctionReference<"mutation", {
  username: string;
  fixtureKey: string;
  confirmation: "CREATE_ISOLATED_GPT_LIVE_FIXTURE";
}, {
  ownerId: Id<"users">;
  savedNeedId: Id<"savedNeeds">;
  needRevision: number;
  nonbindingDecisionId: Id<"decisions">;
  bindingDecisionId: Id<"decisions">;
  conversationId: Id<"providerConversations">;
  providerMessageId: Id<"platformMessages">;
  offerId: Id<"offerRevisions">;
  offerHash: string;
}>("liveProofFixture:create");

it("creates inert synthetic decision and provider-offer UI state without changing the current need", async () => {
  const t = convexTest(schema, modules);
  const seeded = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", {
      username: "gpt-live-proof-musician",
      role: "musician",
      conversationLocale: "en",
      createdAt: now,
      lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Current proof search",
      city: "Berlin",
      locationQuery: "Berlin",
      locationLabel: "Berlin",
      maxBudgetEur: 250,
      arrangement: ["shared"],
      schedule: ["Tuesday evening"],
      requirements: ["drum kit allowed"],
      status: "active",
      matchingRevision: 7,
      createdAt: now,
      updatedAt: now,
    });
    const contextId = await ctx.db.insert("scoutContexts", {
      ownerId,
      threadId: "existing-scout-thread",
      activeNeedId: savedNeedId,
      mode: "search_discovery",
      readyNeedRevision: 7,
      updatedAt: now,
    });
    return { ownerId, savedNeedId, contextId };
  });

  const before = await t.run(async (ctx) => ({
    need: await ctx.db.get(seeded.savedNeedId),
    context: await ctx.db.get(seeded.contextId),
  }));
  const result = await t.mutation(createFixture, {
    username: "gpt-live-proof-musician",
    fixtureKey: "gpt-live-proof-p1-p2",
    confirmation: "CREATE_ISOLATED_GPT_LIVE_FIXTURE",
  });
  const musician = t.withIdentity({ subject: seeded.ownerId });
  const visibleDecisions = await musician.query(api.decisions.listOpenMine, {});
  const visibleConversations = await musician.query(api.conversations.listMine, {});
  const visibleConversation = await musician.query(api.conversations.getMine, {
    conversationId: result.conversationId,
  });

  const after = await t.run(async (ctx) => ({
    need: await ctx.db.get(seeded.savedNeedId),
    context: await ctx.db.get(seeded.contextId),
    decisions: await ctx.db.query("decisions").withIndex("by_owner_and_status", (q) =>
      q.eq("ownerId", seeded.ownerId).eq("status", "open"),
    ).collect(),
    conversation: await ctx.db.get(result.conversationId),
    message: await ctx.db.get(result.providerMessageId),
    offer: await ctx.db.get(result.offerId),
    actionRequests: await ctx.db.query("actionRequests").collect(),
    approvals: await ctx.db.query("actionApprovals").collect(),
    executions: await ctx.db.query("actionExecutions").collect(),
    autonomy: await ctx.db.query("scoutAutonomy").collect(),
    scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
  }));

  expect(after.need).toEqual(before.need);
  expect(after.context).toEqual(before.context);
  expect(result).toMatchObject({ ownerId: seeded.ownerId, savedNeedId: seeded.savedNeedId, needRevision: 7 });
  expect(visibleDecisions.map((row) => row._id)).toEqual(expect.arrayContaining([
    result.nonbindingDecisionId,
    result.bindingDecisionId,
  ]));
  expect(visibleConversations[0]).toMatchObject({
    conversationId: result.conversationId,
    state: "offer_ready",
    preview: { author: "provider" },
    offer: { offerId: result.offerId, ready: true },
  });
  expect(visibleConversation?.header).toMatchObject({
    conversationId: result.conversationId,
    state: "offer_ready",
    offer: { offerId: result.offerId, ready: true },
  });
  expect(visibleConversation?.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "provider_message", text: expect.stringContaining("SYNTHETIC TEST DATA ONLY") }),
  ]));
  expect(after.decisions.find((row) => row._id === result.nonbindingDecisionId)).toMatchObject({
    kind: "scout_question",
    status: "open",
  });
  expect(after.decisions.find((row) => row._id === result.nonbindingDecisionId)).not.toHaveProperty("conversationId");
  expect(after.decisions.find((row) => row._id === result.bindingDecisionId)).toMatchObject({
    kind: "offer_ready",
    status: "open",
    conversationId: result.conversationId,
  });
  expect(after.conversation).toMatchObject({
    currentOfferId: result.offerId,
    platformThreadId: expect.any(String),
    revision: 1,
    state: "offer_ready",
  });
  expect(after.message).toMatchObject({
    direction: "inbound",
    senderLabel: "Synthetic Provider — no external account",
  });
  expect(after.message?.bodyText).toContain("SYNTHETIC TEST DATA ONLY");
  expect(after.offer).toMatchObject({ ready: true, needRevision: 7, revision: 1, blockers: [] });
  expect(after.actionRequests).toEqual([]);
  expect(after.approvals).toEqual([]);
  expect(after.executions).toEqual([]);
  expect(after.autonomy).toEqual([]);
  expect(after.scheduled).toEqual([]);
});

it("rejects a normal musician username before writing anything", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = 1_000;
    await ctx.db.insert("users", { username: "normal-musician", role: "musician", createdAt: now, lastSeenAt: now });
  });

  await expect(t.mutation(createFixture, {
    username: "normal-musician",
    fixtureKey: "gpt-live-proof-rejected",
    confirmation: "CREATE_ISOLATED_GPT_LIVE_FIXTURE",
  })).rejects.toThrow("SYNTHETIC_LIVE_PROOF_USER_REQUIRED");
  expect(await t.run((ctx) => ctx.db.query("providerConversations").collect())).toEqual([]);
});
