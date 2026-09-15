/// <reference types="vite/client" />
import agentTest from "@convex-dev/agent/test";
import { saveMessages } from "@convex-dev/agent";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { scoutAgent } from "./scoutRuntime";

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

const inspectFixture = makeFunctionReference<"query", {
  username: "live-scout-check-0915";
  fixtureKey: string;
  confirmation: "CREATE_ISOLATED_GPT_LIVE_FIXTURE";
}, {
  savedNeedId: Id<"savedNeeds">;
  need: { status: string; maxBudgetEur?: number; schedule: string[]; revision: number; facets: unknown[] };
  openDecisions: Array<{ decisionId: Id<"decisions">; kind: string; status: "open" }>;
  fixture: { conversationId: Id<"providerConversations">; offerId?: Id<"offerRevisions">; offerCurrent: boolean; acceptanceRequestId?: Id<"actionRequests"> };
  ledgers: { ownerActionRequests: number; ownerApprovals: number; ownerExecutions: number; fixtureActionRequests: number; fixtureApprovals: number; fixtureExecutions: number; fixtureExecutedRequests: number; fixtureSucceededExecutions: number };
  voice: { sessions: number; activeClaims: number; knownRequests: number; cachedResults: number };
  agent: { recentMessages: number; recentUserMessages: number; recentPageComplete: boolean };
}>("liveProofFixture:inspect");

it("creates inert synthetic decision and provider-offer UI state without changing the current need", async () => {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  const seeded = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", {
      username: "live-scout-check-0915",
      role: "musician",
      conversationLocale: "en",
      createdAt: now,
      lastSeenAt: now,
    });
    const { threadId } = await scoutAgent.createThread(ctx, { userId: ownerId, title: "Live fixture test" });
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
      threadId,
      activeNeedId: savedNeedId,
      mode: "search_discovery",
      readyNeedRevision: 7,
      updatedAt: now,
    });
    await saveMessages(ctx, components.agent, {
      threadId,
      userId: ownerId,
      messages: [
        { role: "user", content: "Synthetic persisted user turn." },
        { role: "assistant", content: "Synthetic persisted assistant turn." },
      ],
    });
    return { ownerId, savedNeedId, contextId };
  });

  const before = await t.run(async (ctx) => ({
    need: await ctx.db.get(seeded.savedNeedId),
    context: await ctx.db.get(seeded.contextId),
  }));
  const result = await t.mutation(createFixture, {
    username: "live-scout-check-0915",
    fixtureKey: "gpt-live-proof-p1-p2",
    confirmation: "CREATE_ISOLATED_GPT_LIVE_FIXTURE",
  });
  const musician = t.withIdentity({ subject: seeded.ownerId });
  const visibleDecisions = await musician.query(api.decisions.listOpenMine, {});
  const visibleConversations = await musician.query(api.conversations.listMine, {});
  const visibleConversation = await musician.query(api.conversations.getMine, {
    conversationId: result.conversationId,
  });
  const inspection = await t.query(inspectFixture, {
    username: "live-scout-check-0915",
    fixtureKey: "gpt-live-proof-p1-p2",
    confirmation: "CREATE_ISOLATED_GPT_LIVE_FIXTURE",
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
  expect(inspection).toMatchObject({
    savedNeedId: seeded.savedNeedId,
    need: {
      status: "active",
      maxBudgetEur: 250,
      schedule: ["Tuesday evening"],
      revision: 7,
      facets: [],
    },
    fixture: {
      conversationId: result.conversationId,
      offerId: result.offerId,
      offerCurrent: true,
    },
    ledgers: {
      ownerActionRequests: 0,
      ownerApprovals: 0,
      ownerExecutions: 0,
      fixtureActionRequests: 0,
      fixtureApprovals: 0,
      fixtureExecutions: 0,
      fixtureExecutedRequests: 0,
      fixtureSucceededExecutions: 0,
    },
    voice: { sessions: 0, activeClaims: 0, knownRequests: 0, cachedResults: 0 },
    agent: { recentMessages: 2, recentUserMessages: 1, recentPageComplete: true },
  });
  expect(inspection.fixture).not.toHaveProperty("acceptanceRequestId");
  expect(inspection.openDecisions.map((decision) => decision.decisionId)).toEqual(expect.arrayContaining([
    result.nonbindingDecisionId,
    result.bindingDecisionId,
  ]));
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
