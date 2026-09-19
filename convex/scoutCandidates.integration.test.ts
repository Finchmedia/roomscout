/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { signalMatchRevision } from "./lib/matchValidity";

const modules = import.meta.glob("./**/*.ts");

const inspectCandidate = makeFunctionReference<"query", {
  ownerId: Id<"users">;
  savedNeedId: Id<"savedNeeds">;
  signalId?: Id<"signals">;
  url?: string;
}, string>("scoutCandidates:inspect");

const openCandidate = makeFunctionReference<"mutation", {
  ownerId: Id<"users">;
  threadId: string;
  savedNeedId: Id<"savedNeeds">;
  signalId: Id<"signals">;
}, { opened: boolean; signalId: Id<"signals">; reason?: string; sent: false }>("scoutCandidates:open");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", { username: "candidate-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const otherOwnerId = await ctx.db.insert("users", { username: "candidate-other", role: "musician", createdAt: now, lastSeenAt: now });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Berlin room", city: "Berlin", maxBudgetEur: 300,
      arrangement: ["shared"], schedule: [], requirements: [], status: "active",
      matchingRevision: 2, createdAt: now, updatedAt: now,
    });
    const otherNeedId = await ctx.db.insert("savedNeeds", {
      ownerId: otherOwnerId, title: "Private search", city: "Hamburg",
      arrangement: ["shared"], schedule: [], requirements: [], status: "active",
      matchingRevision: 1, createdAt: now, updatedAt: now,
    });
    const threadId = "candidate-scout-thread";
    const contextId = await ctx.db.insert("scoutContexts", {
      ownerId, threadId, activeNeedId: savedNeedId, mode: "search_discovery", updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      slug: "candidate-source", name: "Candidate source", baseUrl: "https://example.test/rooms",
      side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now,
    });
    const sourceTargetId = await ctx.db.insert("sourceTargets", {
      sourceId, url: "https://example.test/rooms", mode: "scrape", changeTrackingTag: "candidate-test",
      scheduleMinutes: 1_440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now,
    });
    const sourceEntryId = await ctx.db.insert("sourceEntries", {
      sourceId, sourceTargetId, canonicalUrl: "https://example.test/rooms/known",
      detailUrl: "https://example.test/rooms/known", title: "Known room", excerpt: "Public room",
      side: "supply", city: "Berlin", status: "active", detailState: "processed", detailAttempts: 1,
      firstSeenAt: now, lastSeenAt: now, updatedAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      sourceEntryId, side: "supply", title: "Known room", city: "Berlin", district: "Neukölln",
      imageUrl: "https://cdn.example.com/rooms/known.webp",
      summary: "Shared rehearsal room", arrangement: "shared", priceEur: 280, pricePeriod: "month",
      requirements: [], unknowns: ["Availability"], status: "published", verification: "observed",
      sourceCount: 1, firstSeenAt: now, lastSeenAt: now,
    });
    await ctx.db.patch(sourceEntryId, { signalId });
    const signalRevision = await signalMatchRevision((await ctx.db.get(signalId))!);
    const matchId = await ctx.db.insert("signalMatches", {
      ownerId, savedNeedId, signalId, kind: "need_supply", score: 0.85,
      structuredScore: 0.8, semanticScore: 0.95, reasons: ["Same city: Berlin"], uncertainties: ["Availability"],
      status: "new", fingerprint: "candidate-fit", eligible: true, eligibility: "fit", contactEligible: false,
      monthlyCostBasis: "listed_monthly_base", monthlyCostEur: 280, budgetDeltaEur: -20,
      needRevision: 2, signalRevision, matchingRunId: "candidate-run", createdAt: now, updatedAt: now,
    });
    const conversationSignalId = await ctx.db.insert("signals", {
      side: "supply", title: "Existing conversation room", city: "Berlin", summary: "Older indexed room",
      arrangement: "shared", requirements: [], unknowns: [], status: "stale", verification: "observed",
      sourceCount: 1, firstSeenAt: now, lastSeenAt: now,
    });
    const conversationId = await ctx.db.insert("providerConversations", {
      ownerId, savedNeedId, signalId: conversationSignalId, conversationKey: "existing-candidate",
      agentThreadId: "existing-provider-thread", revision: 0, state: "waiting", createdAt: now, updatedAt: now,
    });
    return {
      ownerId, otherOwnerId, savedNeedId, otherNeedId, threadId, contextId,
      signalId, matchId, conversationSignalId, conversationId,
    };
  });
  return { t, ...ids };
}

it("resolves a canonical indexed URL and rejects another owner's search", async () => {
  const f = await fixture();
  const result = JSON.parse(await f.t.query(inspectCandidate, {
    ownerId: f.ownerId,
    savedNeedId: f.savedNeedId,
    url: "https://EXAMPLE.test/rooms/known/?utm_source=scout#details",
  }));

  expect(result).toMatchObject({
    status: "indexed",
    signal: { _id: f.signalId, title: "Known room", imageUrl: "https://cdn.example.com/rooms/known.webp" },
    match: { eligible: true, contactEligible: false, dismissed: false },
    conversation: null,
    manualContact: "candidate_panel_only",
  });
  await expect(f.t.query(inspectCandidate, {
    ownerId: f.ownerId,
    savedNeedId: f.otherNeedId,
    signalId: f.signalId,
  })).rejects.toThrow("NEED_NOT_FOUND");
});

it("lists persisted provider progress for every named conversation without relying on UI focus", async () => {
  const f = await fixture();
  const result = JSON.parse(await f.t.query(inspectCandidate, {
    ownerId: f.ownerId,
    savedNeedId: f.savedNeedId,
  }));

  expect(result).toMatchObject({
    status: "indexed_candidates",
    conversations: [{
      conversationId: f.conversationId,
      signalId: f.conversationSignalId,
      title: "Existing conversation room",
      progress: "checking",
      hasProviderReply: false,
    }],
    manualContact: "candidate_panel_only",
  });
});

it("opens only a current fit or near-budget row and changes only Scout focus", async () => {
  const f = await fixture();
  const before = await f.t.run(async (ctx) => ({
    actions: await ctx.db.query("actionRequests").collect(),
    conversations: await ctx.db.query("providerConversations").collect(),
    turns: await ctx.db.query("providerTurns").collect(),
    scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
  }));

  expect(await f.t.mutation(openCandidate, {
    ownerId: f.ownerId, threadId: f.threadId, savedNeedId: f.savedNeedId, signalId: f.signalId,
  })).toEqual({ opened: true, signalId: f.signalId, sent: false });
  expect(await f.t.run((ctx) => ctx.db.get(f.contextId))).toMatchObject({
    mode: "signal_advisor", focusedSignalId: f.signalId,
  });

  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.contextId, { mode: "search_discovery", focusedSignalId: undefined });
    await ctx.db.patch(f.matchId, { eligible: false, eligibility: "ineligible", contactEligible: false });
  });
  expect(await f.t.mutation(openCandidate, {
    ownerId: f.ownerId, threadId: f.threadId, savedNeedId: f.savedNeedId, signalId: f.signalId,
  })).toEqual({ opened: false, signalId: f.signalId, reason: "not_current_candidate", sent: false });
  const unchangedContext = await f.t.run((ctx) => ctx.db.get(f.contextId));
  expect(unchangedContext?.mode).toBe("search_discovery");
  expect(unchangedContext?.focusedSignalId).toBeUndefined();

  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.matchId, { eligibility: "near_budget", budgetDeltaEur: 25 });
  });
  await f.t.run(async (ctx) => { await ctx.db.patch(f.matchId, { needRevision: 1 }); });
  expect(await f.t.mutation(openCandidate, {
    ownerId: f.ownerId, threadId: f.threadId, savedNeedId: f.savedNeedId, signalId: f.signalId,
  })).toEqual({ opened: false, signalId: f.signalId, reason: "not_current_candidate", sent: false });
  await f.t.run(async (ctx) => { await ctx.db.patch(f.matchId, { needRevision: 2 }); });
  expect(await f.t.mutation(openCandidate, {
    ownerId: f.ownerId, threadId: f.threadId, savedNeedId: f.savedNeedId, signalId: f.signalId,
  })).toEqual({ opened: true, signalId: f.signalId, sent: false });

  expect(await f.t.run(async (ctx) => ({
    actions: await ctx.db.query("actionRequests").collect(),
    conversations: await ctx.db.query("providerConversations").collect(),
    turns: await ctx.db.query("providerTurns").collect(),
    scheduled: await ctx.db.system.query("_scheduled_functions").collect(),
  }))).toEqual(before);
});

it("keeps an existing owned provider conversation readable without a current match", async () => {
  const f = await fixture();
  const result = JSON.parse(await f.t.query(inspectCandidate, {
    ownerId: f.ownerId,
    savedNeedId: f.savedNeedId,
    signalId: f.conversationSignalId,
  }));

  expect(result).toMatchObject({
    status: "indexed",
    match: null,
    conversation: { conversationId: f.conversationId },
  });
  expect(await f.t.mutation(openCandidate, {
    ownerId: f.ownerId,
    threadId: f.threadId,
    savedNeedId: f.savedNeedId,
    signalId: f.conversationSignalId,
  })).toEqual({ opened: true, signalId: f.conversationSignalId, sent: false });
});
