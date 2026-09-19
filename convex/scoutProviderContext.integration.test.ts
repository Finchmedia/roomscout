/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import { signalMatchRevision } from "./lib/matchValidity";
import type { ProviderAssessment } from "./lib/providerAssessment";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", { username: "context-musician", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Stuttgart", districts: [], arrangement: ["shared"], schedule: ["Tuesday"], requirements: ["Drums"], maxBudgetEur: 300, matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { side: "supply", title: "Provider room", city: "Stuttgart", summary: "A real provider room", arrangement: "shared", requirements: ["Drums"], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    const signal = (await ctx.db.get(signalId))!;
    const conversationId = await ctx.db.insert("providerConversations", { ownerId, savedNeedId: needId, signalId, conversationKey: "provider-room", agentThreadId: "provider-agent", revision: 1, state: "offer_ready", createdAt: now, updatedAt: now });
    const eventId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "portal:reply", kind: "portal_reply", revision: 1, status: "completed", completedAt: now, createdAt: now });
    const evidence = [{ sourceId: "portal:reply", quote: "Available Tuesday for EUR 240 monthly." }];
    const assessment: ProviderAssessment = {
      summary: "Provider confirmed availability and the monthly price.",
      availability: { status: "available", evidence },
      monthlyPrice: { totalEur: 240, allRecurringCostsKnown: true, evidence },
      terms: [], constraints: [], uncertainties: [], contradictions: [],
      nextAction: "present_offer", suggestedReply: null,
    };
    const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId, revision: 1, needRevision: 1, signalRevision: await signalMatchRevision(signal), assessment, ready: true, blockers: [], contentHash: "offer-hash", model: "test", promptVersion: "test", schemaVersion: "test", createdAt: now });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });
    await ctx.db.insert("scoutContexts", { ownerId, threadId: "scout-thread", activeNeedId: needId, mode: "search_discovery", updatedAt: now });
    return { ownerId, needId, conversationId, offerId };
  });
  return { t, ...ids };
}

it("includes the current provider offer in Scout chat context without requiring a focused signal", async () => {
  const f = await fixture();
  const actionContext = await f.t.query(internal.scout.getActionContext, {
    ownerId: f.ownerId,
    threadId: "scout-thread",
  });
  if (actionContext === null) throw new Error("Expected Scout action context");
  expect(actionContext.caseCard).toContain("TRUSTED SEARCH LIFECYCLE STATUS: active");
  expect(actionContext.caseCard).toContain("no signal is focused in chat");
  expect(actionContext.caseCard).toContain("does not mean there are no matches or offers");
  expect(actionContext.caseCard).not.toContain("Provider confirmed availability");

  const context = await f.t.query(internal.providerConversations.getProgressContext, { ownerId: f.ownerId, savedNeedId: f.needId });
  expect(context).toContain('"signalTitle":"Provider room"');
  expect(context).toContain('"signalSummary":"A real provider room"');
  expect(context).toContain('"readyForReview":true');
  expect(context).toContain('"currentAssessment"');
  expect(context).toContain("Provider confirmed availability and the monthly price.");
  expect(context).toContain("TRUSTED ACCEPTANCE RULE:");

  const focused = await f.t.query(internal.providerConversations.getProgressContext, {
    ownerId: f.ownerId, savedNeedId: f.needId, focusedSignalId: (await f.t.run(async (ctx) => (await ctx.db.get(f.conversationId))!)).signalId,
  });
  expect(focused).toContain('"focused":true');
});

it("reports a completed acceptance as sent even after the search is paused and conversation closed", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.needId, { status: "paused" });
    await ctx.db.patch(f.conversationId, { acceptedOfferId: f.offerId, acceptedAt: 2_000, state: "closed" });
  });
  const actionContext = await f.t.query(internal.scout.getActionContext, {
    ownerId: f.ownerId,
    threadId: "scout-thread",
  });
  if (actionContext === null) throw new Error("Expected Scout action context");
  expect(actionContext.caseCard).toContain("TRUSTED SEARCH LIFECYCLE STATUS: paused");
  expect(actionContext.caseCard).toContain("An active or paused search is not a draft");
  expect(actionContext.caseCard).toContain("do not restart onboarding");

  const context = await f.t.query(internal.providerConversations.getProgressContext, { ownerId: f.ownerId, savedNeedId: f.needId });
  expect(context).toContain('"acceptanceStatus":"sent"');
  expect(context).toContain('"nextStep":"acceptance_message_sent_search_paused"');
  expect(context).toContain("TRUSTED ACCEPTANCE RULE:");
});

it.each(["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"])(
  "reports %s as an unknown outcome rather than executing or sent",
  async (errorCode) => {
    const f = await fixture();
    await f.t.run(async (ctx) => {
      const requestId = await ctx.db.insert("actionRequests", {
        ownerId: f.ownerId,
        providerConversationId: f.conversationId,
        providerOfferId: f.offerId,
        providerActionKind: "acceptance",
        automationMode: "exact_once",
        requestedActionType: "send_platform_dm",
        personalDataScopes: [],
        payload: { kind: "platform_message", recipients: ["Provider"], subject: "", body: "Reviewed acceptance" },
        contentVersion: 1,
        contentHash: "acceptance-hash",
        status: "executing",
        error: errorCode,
        createdAt: 1_500,
        updatedAt: 1_500,
      });
      await ctx.db.patch(f.conversationId, { acceptanceRequestId: requestId });
    });
    const progress = await f.t.query(internal.providerConversations.getProgressContext, { ownerId: f.ownerId, savedNeedId: f.needId });
    expect(progress).toContain('"acceptanceStatus":"unknown_outcome"');
    expect(progress).not.toContain('"acceptanceStatus":"executing"');
    expect(progress).not.toContain(errorCode);
    expect(progress).toContain("never claim it was sent and never accept, resend, or retry it from chat");
  },
);

it("does not call an offer current while a newer provider turn is active", async () => {
  const f = await fixture();
  const activeEventId = await f.t.run((ctx) => ctx.db.insert("providerTurns", { conversationId: f.conversationId,
    sourceKey: "portal:new-reply", kind: "portal_reply", revision: 1, status: "pending", createdAt: 2_000 }));
  await f.t.run((ctx) => ctx.db.patch(f.conversationId, { activeEventId }));
  const progress = await f.t.query(internal.providerConversations.getProgressContext, { ownerId: f.ownerId, savedNeedId: f.needId });
  expect(progress).toContain('"readyForReview":false');
  expect(progress).toContain('"currentAssessment":null');
});
