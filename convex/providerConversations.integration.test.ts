/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { MockLanguageModelV4 } from "ai/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { scoutAgent } from "./scoutRuntime";
import { offerConstraints, type ProviderAssessment } from "./lib/providerAssessment";
import { signalMatchRevision } from "./lib/matchValidity";
import { failedAssessmentRetryEligibility } from "./providerConversations";

const modules = import.meta.glob("./**/*.ts");
const originalModel = scoutAgent.options.languageModel;
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", ""); });
afterEach(() => { scoutAgent.options.languageModel = originalModel; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });

const body = "Room available. Monthly total including all charges: EUR 220. Drums and storage allowed, Monday evenings available.";
function declineAssessment(input: Awaited<ReturnType<typeof fixture>>["input"]): ProviderAssessment {
  return {
    summary: "The fixed slot conflicts with the musician's schedule.",
    availability: { status: "unknown", evidence: [] },
    monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] },
    terms: [],
    constraints: offerConstraints(input.need).map(({ key }) => ({
      key, verdict: "unknown", explanation: key === "schedule" ? "The fixed slot conflicts with the requested days." : "Not established.", evidence: [],
    })),
    uncertainties: ["The fixed slot conflicts with the requested days."],
    contradictions: [],
    nextAction: "decline",
    suggestedReply: { subject: "Rehearsal room", body: "Thanks, but the fixed slot does not fit our schedule." },
  };
}
async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "offer-owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "offer-other", role: "musician", createdAt: now, lastSeenAt: now });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Band search", city: "Stuttgart", districts: [], arrangement: ["shared"],
      schedule: ["Monday evenings"], requirements: ["Drums and storage"], maxBudgetEur: 250,
      status: "active", matchingRevision: 1, createdAt: now, updatedAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply", title: "Controlled room", city: "Stuttgart", summary: "Shared room",
      arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed",
      sourceCount: 1, firstSeenAt: now, lastSeenAt: now,
    });
    const draftId = await ctx.db.insert("outreachDrafts", {
      ownerId, signalId, savedNeedId, recipientName: "Test provider", recipientEmail: "provider@example.test",
      subject: "Room inquiry", body: "Is this available?", contentVersion: 1, contentHash: "draft-hash", status: "sent", createdAt: now, updatedAt: now,
    });
    const mailboxId = await ctx.db.insert("userMailboxes", {
      ownerId, provider: "agentmail", providerInboxId: "private-inbox", emailAddress: "scout@example.test", clientId: "test-client", status: "active", createdAt: now, updatedAt: now,
    });
    const threadId = await ctx.db.insert("mailThreads", {
      ownerId, draftId, mailboxId, providerThreadId: "provider-thread", subject: "Room inquiry", status: "awaiting_reply", lastMessageAt: now, createdAt: now,
    });
    return { ownerId, otherId, savedNeedId, signalId, threadId, mailboxId };
  });
  const inbound = {
    mailboxId: ids.mailboxId, providerThreadId: "provider-thread", providerMessageId: "message-1", providerEventId: "event-1",
    from: "provider@example.test", to: ["scout@example.test"], subject: "Room reply", body,
    htmlAvailable: false, receivedAt: Date.now(),
  };
  const messageId = (await t.mutation(internal.inbox.storeInboundMessage, inbound))!;
  const eventId = (await t.mutation(internal.providerConversations.enqueueMailReply, { messageId }))!;
  const input = (await t.mutation(internal.providerConversations.prepareTurn, { eventId }))!;
  const citation = { sourceId: `mail:${messageId}`, quote: body };
  const assessment: ProviderAssessment = {
    summary: "Provider confirms the room matches the search.",
    availability: { status: "available", evidence: [citation] },
    monthlyPrice: { totalEur: 220, allRecurringCostsKnown: true, evidence: [citation] },
    terms: [{ key: "equipment", label: "Equipment", value: "Drums and storage allowed", evidence: [citation] }],
    constraints: offerConstraints(input.need).map(({ key }) => ({ key, verdict: "satisfied", explanation: "Confirmed by provider", evidence: [citation] })),
    uncertainties: [], contradictions: [], nextAction: "present_offer", suggestedReply: null,
  };
  const recordArgs = { eventId, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment };
  return { t, ...ids, inbound, messageId, eventId, input, assessment, recordArgs };
}

async function candidateFixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "candidate-owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "candidate-other", role: "musician", createdAt: now, lastSeenAt: now });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Controlled candidate", city: "Berlin", districts: [], arrangement: ["shared"],
      schedule: ["Tuesday"], requirements: ["Storage"], maxBudgetEur: 400,
      status: "active", matchingRevision: 1, createdAt: now, updatedAt: now,
    });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "roomscout-dev", name: "RoomScout.dev", canonicalDomain: "roomscout.dev", kind: "marketplace",
      status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId, slug: "roomscout-dev-listings", name: "RoomScout.dev listings", baseUrl: "https://roomscout.dev/listings",
      side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now,
    });
    const targetId = await ctx.db.insert("sourceTargets", {
      sourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: "controlled",
      scheduleMinutes: 1_440, nextRunAt: now, paused: false, createdAt: now, updatedAt: now,
    });
    const entryId = await ctx.db.insert("sourceEntries", {
      sourceId, sourceTargetId: targetId, externalId: "candidate-1",
      canonicalUrl: "https://roomscout.dev/listings/candidate-1", detailUrl: "https://roomscout.dev/listings/candidate-1",
      title: "Controlled room", excerpt: "EUR 350, storage", side: "supply", city: "Berlin",
      status: "active", detailState: "processed", detailAttempts: 1,
      firstSeenAt: now, lastSeenAt: now, updatedAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply", title: "Controlled room", city: "Berlin", summary: "EUR 350, storage",
      arrangement: "shared", priceEur: 350, pricePeriod: "month", requirements: ["Storage"], unknowns: [],
      status: "published", verification: "observed", sourceCount: 1, sourceEntryId: entryId,
      firstSeenAt: now, lastSeenAt: now,
    });
    await ctx.db.patch(entryId, { signalId });
    const signal = (await ctx.db.get(signalId))!;
    const matchId = await ctx.db.insert("signalMatches", {
      ownerId, savedNeedId, signalId, kind: "need_supply", score: 0.9, structuredScore: 0.9, semanticScore: 0.9,
      reasons: ["fits"], uncertainties: [], status: "new", fingerprint: "candidate-match", eligible: true,
      eligibility: "fit", contactEligible: true, needRevision: 1, signalRevision: await signalMatchRevision(signal),
      createdAt: now, updatedAt: now,
    });
    const opportunityId = await ctx.db.insert("opportunities", {
      ownerId, savedNeedId, kind: "supply_match", status: "new", signalId, platformId, score: 0.9,
      reasons: ["fits"], uncertainties: [], fingerprint: `match:${savedNeedId}:${signalId}`,
      firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now,
    });
    return { ownerId, otherId, savedNeedId, signalId, matchId, opportunityId };
  });
  return { t, ...ids };
}

async function completeInitialNoFit(f: Awaited<ReturnType<typeof candidateFixture>>, nextAction: "decline" | "stop" = "decline") {
  const started = await f.t.withIdentity({ subject: f.ownerId }).mutation(api.providerConversations.startInitialInquiry, {
    savedNeedId: f.savedNeedId, signalId: f.signalId,
  });
  const input = (await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: started.eventId! }))!;
  const assessment = nextAction === "decline"
    ? declineAssessment(input)
    : { ...declineAssessment(input), nextAction: "stop" as const, suggestedReply: null };
  const offerId = await f.t.mutation(internal.providerConversations.recordAssessment, {
    eventId: started.eventId!, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment,
  });
  await f.t.mutation(internal.providerConversations.turnCompleted, {
    workId: "test-work" as never, context: { eventId: started.eventId! }, result: { kind: "success", returnValue: { outcome: "recorded" } },
  });
  return { ...started, input, offerId };
}

async function applyRevisedEligibleCandidate(f: Awaited<ReturnType<typeof candidateFixture>>) {
  const signalRevision = await f.t.run(async (ctx) => signalMatchRevision((await ctx.db.get(f.signalId))!));
  await f.t.run((ctx) => ctx.db.patch(f.savedNeedId, {
    schedule: ["Wednesday"], matchingRevision: 2, matchingRunId: "revised-run", updatedAt: Date.now(),
  }));
  await f.t.mutation(internal.matches.applyMatches, {
    ownerId: f.ownerId, savedNeedId: f.savedNeedId, needRevision: 2, matchingRunId: "revised-run",
    matches: [{
      signalId: f.signalId, signalRevision, eligible: true, eligibility: "fit", contactEligible: true,
      monthlyCostBasis: "listed_monthly_base", monthlyCostEur: 350, budgetDeltaEur: 50,
      kind: "need_supply", score: 0.95, structuredScore: 0.95, semanticScore: 0.95,
      reasons: ["The revised schedule fits"], uncertainties: [], fingerprint: "candidate-match-revised",
    }],
  });
}

describe("provider conversation and offer lifecycle", () => {
  it.each(["decline", "stop"] as const)("closes a listing-only no-fit assessed as %s without creating first contact", async (nextAction) => {
    const f = await candidateFixture();
    const started = await completeInitialNoFit(f, nextAction);
    expect(started.offerId).toBeTruthy();

    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.get(started.conversationId!))).toMatchObject({ state: "closed" });
    expect(await f.t.run((ctx) => ctx.db.get(f.opportunityId))).toMatchObject({ status: "expired" });
    expect(await f.t.withIdentity({ subject: f.ownerId }).mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    })).toMatchObject({ status: "not_eligible" });
    expect(await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).toHaveLength(1);
  });

  it("reevaluates a listing-only no-fit after a newer eligible need revision", async () => {
    const f = await candidateFixture();
    const first = await completeInitialNoFit(f);
    await applyRevisedEligibleCandidate(f);
    expect(await f.t.run((ctx) => ctx.db.get(f.opportunityId))).toMatchObject({ status: "new" });

    const secondEventId = await f.t.mutation(internal.providerConversations.enqueueOpportunity, { opportunityId: f.opportunityId });
    expect(secondEventId).toBeTruthy();
    expect(secondEventId).not.toBe(first.eventId);
    expect(await f.t.run((ctx) => ctx.db.get(first.conversationId!))).toMatchObject({ state: "thinking", revision: 2 });
  });

  it("lets the candidate action reevaluate a listing-only no-fit after a newer eligible revision", async () => {
    const f = await candidateFixture();
    const first = await completeInitialNoFit(f);
    await applyRevisedEligibleCandidate(f);

    const restarted = await f.t.withIdentity({ subject: f.ownerId }).mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    });
    expect(restarted).toMatchObject({ status: "queued", conversationId: first.conversationId });
    expect(restarted.eventId).not.toBe(first.eventId);
    expect(await f.t.run((ctx) => ctx.db.get(first.conversationId!))).toMatchObject({ state: "thinking", revision: 2 });
  });

  it("keeps an actually declined conversation closed after a newer eligible revision", async () => {
    const f = await candidateFixture();
    const first = await completeInitialNoFit(f);
    await f.t.run(async (ctx) => {
      const now = Date.now();
      await ctx.db.insert("actionRequests", {
        ownerId: f.ownerId, providerConversationId: first.conversationId, providerOfferId: first.offerId!,
        savedNeedId: f.savedNeedId, matchingSignalId: f.signalId, opportunityId: f.opportunityId,
        automationMode: "autopilot", requestedActionType: "send_platform_dm", personalDataScopes: [],
        payload: { kind: "platform_message", recipients: ["Listing owner"], body: "Thanks, but this does not fit." },
        contentVersion: 1, contentHash: "executed-decline", status: "executed", createdAt: now, updatedAt: now,
      });
    });
    await applyRevisedEligibleCandidate(f);

    expect(await f.t.mutation(internal.providerConversations.enqueueOpportunity, { opportunityId: f.opportunityId })).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.get(first.conversationId!))).toMatchObject({ state: "closed", revision: 1 });
  });

  it("closes when an acknowledgment stops after an executed decline without creating a second request", async () => {
    const f = await fixture();
    const assessment = declineAssessment(f.input);
    const firstOfferId = (await f.t.mutation(internal.providerConversations.recordAssessment, {
      ...f.recordArgs, assessment,
    }))!;
    await f.t.run((ctx) => ctx.db.insert("actionRequests", {
      ownerId: f.ownerId, savedNeedId: f.savedNeedId, providerConversationId: f.input.conversationId,
      providerOfferId: firstOfferId, matchingNeedRevision: f.input.needRevision,
      matchingSignalId: f.signalId, matchingSignalRevision: f.input.signalRevision,
      automationMode: "autopilot", requestedActionType: "send_email", personalDataScopes: ["reply_email"],
      payload: {
        kind: "email_message", recipientName: "Test provider", recipientEmail: "provider@example.test",
        subject: "Rehearsal room", body: assessment.suggestedReply!.body,
        mailThreadId: f.threadId, parentMessageId: "message-1",
      },
      contentVersion: 1, contentHash: "first-decline", status: "executed",
      createdAt: Date.now(), updatedAt: Date.now(),
    }));

    const acknowledgmentAssessment: ProviderAssessment = {
      ...assessment,
      summary: "The provider acknowledged the decline; the conversation is complete.",
      nextAction: "stop",
      suggestedReply: null,
    };
    const second = await f.t.run(async (ctx) => {
      const eventId = await ctx.db.insert("providerTurns", {
        conversationId: f.input.conversationId, sourceKey: "mail:ack", kind: "mail_reply", revision: 2,
        status: "completed", createdAt: Date.now(), completedAt: Date.now(),
      });
      const offerId = await ctx.db.insert("offerRevisions", {
        ownerId: f.ownerId, savedNeedId: f.savedNeedId, conversationId: f.input.conversationId,
        eventId, revision: 2, needRevision: f.input.needRevision, signalRevision: f.input.signalRevision,
        assessment: acknowledgmentAssessment, ready: false, blockers: acknowledgmentAssessment.uncertainties, contentHash: "decline-ack",
        model: "test", promptVersion: "test", schemaVersion: "test", createdAt: Date.now(),
      });
      await ctx.db.patch(eventId, { offerId });
      await ctx.db.patch(f.input.conversationId, { revision: 2, currentOfferId: offerId, state: "needs_attention", updatedAt: Date.now() });
      return offerId;
    });

    const acknowledgmentEventId = (await f.t.run((ctx) => ctx.db.get(second)))!.eventId;
    await f.t.run((ctx) => ctx.db.patch(f.input.conversationId, { activeEventId: acknowledgmentEventId }));
    await f.t.mutation(internal.providerConversations.turnCompleted, {
      workId: "ack-work" as never,
      context: { eventId: acknowledgmentEventId },
      result: { kind: "success", returnValue: { outcome: "recorded" } },
    });
    expect(await f.t.run((ctx) => ctx.db.get(f.input.conversationId))).toMatchObject({ state: "closed" });
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toHaveLength(1);
  });

  it("keeps a provider stop open when no executed decline exists", async () => {
    const f = await fixture();
    const assessment: ProviderAssessment = {
      ...f.assessment,
      summary: "There is no next provider action yet.",
      nextAction: "stop",
      suggestedReply: null,
    };
    await f.t.mutation(internal.providerConversations.recordAssessment, { ...f.recordArgs, assessment });
    await f.t.mutation(internal.providerConversations.turnCompleted, {
      workId: "stop-work" as never,
      context: { eventId: f.eventId },
      result: { kind: "success", returnValue: { outcome: "recorded" } },
    });

    expect(await f.t.run((ctx) => ctx.db.get(f.input.conversationId))).toMatchObject({ state: "needs_attention" });
  });

  it("supplies recent outbound questions separately from provider evidence", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.insert("mailMessages", {
      threadId: f.threadId,
      providerMessageId: "outbound-follow-up",
      direction: "outbound",
      from: "scout@example.test",
      to: ["provider@example.test"],
      subject: "Room inquiry",
      body: "Could you confirm the cancellation period?",
      receivedAt: Date.now() + 1,
      deliveryStatus: "sent",
    }));

    const refreshed = (await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: f.eventId }))!;
    expect(refreshed.recentOutboundMessages).toEqual(["Could you confirm the cancellation period?"]);
    expect(refreshed.evidence.map((item) => item.text).join("\n")).not.toContain("cancellation period");
  });

  it("supplies the server-computed listing location instead of leaving the address open", async () => {
    const f = await fixture();
    // A listing without an address, half a kilometre from the search centre:
    // the model must see that it is already inside the radius.
    await f.t.run(async (ctx) => {
      await ctx.db.patch(f.savedNeedId, {
        locationQuery: "Berlin Marzahn", radiusKm: 15, centerLatitude: 52.54289, centerLongitude: 13.564462,
      });
      await ctx.db.patch(f.signalId, {
        city: "Berlin", district: "Marzahn \u00b7 Alt-Marzahn",
        latitude: 52.545, longitude: 13.558, locationPrecision: "unknown",
      });
    });

    const refreshed = (await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: f.eventId }))!;
    expect(refreshed.listingLocation).toContain("Listing location: Berlin, Marzahn \u00b7 Alt-Marzahn.");
    expect(refreshed.listingLocation).toContain("0.5 km");
    expect(refreshed.listingLocation).toContain("inside the 15 km search radius");
    expect(refreshed.listingLocation).toContain("no house number");
    // It is context, never a citable provider/listing evidence source.
    expect(refreshed.evidence.map((item) => item.text).join("\n")).not.toContain("search radius");
  });

  it("deduplicates receipt and Agent prompts, and keeps private offers owner-scoped", async () => {
    const f = await fixture();
    expect(await f.t.mutation(internal.inbox.storeInboundMessage, f.inbound)).toBe(f.messageId);
    const again = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: f.eventId });
    expect(again?.promptMessageId).toBe(f.input.promptMessageId);
    const offerId = await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs);
    expect(await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).toBe(offerId);
    const duringTurn = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(duringTurn[0]?.offer).toMatchObject({ offerId, current: false, ready: false });
    expect(duringTurn[0]?.assessmentFromProviderReply).toBe(true);
    await f.t.run((ctx) => ctx.db.patch(f.eventId, { kind: "opportunity" }));
    expect((await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {}))[0]?.assessmentFromProviderReply).toBe(false);
    await f.t.run((ctx) => ctx.db.patch(f.eventId, { kind: "mail_reply" }));
    await f.t.mutation(internal.providerConversations.turnCompleted, {
      workId: "test-work" as never, context: { eventId: f.eventId }, result: { kind: "success", returnValue: null },
    });
    const mine = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]?.offer).toMatchObject({ offerId, current: true, ready: true });
    expect(await f.t.withIdentity({ subject: f.otherId }).query(api.providerConversations.listMine, {})).toEqual([]);
    expect(await f.t.run(async (ctx) => (await ctx.db.query("offerRevisions").collect()).length)).toBe(1);
  });

  it("marks only exact AI demo signals as controlled context without removing negative listing evidence", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.signalId, {
      isDemo: true,
      facets: [
        { namespace: "listing", key: "demo_status", value: "Fictional AI-simulated provider; no real booking.", confidence: 1 },
        { namespace: "availability", key: "status", value: "This scenario is explicitly withdrawn.", confidence: 1 },
      ],
    }));
    const incompleteMarker = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: f.eventId });
    expect(incompleteMarker?.providerContext).toEqual({ controlledAiSimulation: false });

    await f.t.run((ctx) => ctx.db.patch(f.signalId, { providerSimulation: "ai_simulated" }));
    const controlled = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: f.eventId });
    expect(controlled?.providerContext).toEqual({ controlledAiSimulation: true });
    expect(controlled?.evidence[0]?.text).toContain("listing.demo_status: \"Fictional AI-simulated provider; no real booking.\"");
    expect(controlled?.evidence[0]?.text).toContain("availability.status: \"This scenario is explicitly withdrawn.\"");
  });

  it("new inbound mail immediately invalidates the prior offer and serializes its next turn", async () => {
    const f = await fixture();
    await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs);
    const newMessageId = await f.t.mutation(internal.inbox.storeInboundMessage, {
      ...f.inbound, providerMessageId: "message-2", providerEventId: "event-2", body: "Correction: monthly total is EUR 320.", receivedAt: Date.now() + 1,
    });
    const newEventId = await f.t.mutation(internal.providerConversations.enqueueMailReply, { messageId: newMessageId! });
    expect(await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).toBeNull();
    expect(await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: newEventId! })).toBeNull();
    const [mine] = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(mine?.offer).toMatchObject({ current: false, ready: false });
    await f.t.mutation(internal.providerConversations.turnCompleted, {
      workId: "test-work" as never, context: { eventId: f.eventId }, result: { kind: "success", returnValue: null },
    });
    const next = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: newEventId! });
    expect(next?.revision).toBe(2);
    expect(next?.threadId).toBe(f.input.threadId);
    expect(next?.previousAssessment?.monthlyPrice.totalEur).toBe(220);
    expect(await f.t.run(async (ctx) => (await ctx.db.get(f.eventId))?.status)).toBe("superseded");
  });

  it("rejects stale model results after the musician changes constraints", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.savedNeedId, { maxBudgetEur: 150, matchingRevision: 2 }));
    expect(await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.query("offerRevisions").collect())).toEqual([]);
  });

  it("does not accept evidence from a different provider or write public facts", async () => {
    const f = await fixture();
    f.assessment.terms[0]!.evidence = [{ sourceId: "mail:unrelated", quote: body }];
    await expect(f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).rejects.toThrow("OFFER_EVIDENCE_NOT_FOUND");
    const signal = await f.t.run((ctx) => ctx.db.get(f.signalId));
    expect(signal?.summary).toBe("Shared room");
    expect(signal?.priceEur).toBeUndefined();
  });

  it("runs the real Convex Agent tool loop with only its model replaced", async () => {
    const f = await fixture();
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
    const model = new MockLanguageModelV4({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "assessment-1", toolName: "recordProviderAssessment", input: JSON.stringify(f.assessment) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "text", text: "The offer is ready for your review; nothing has been sent." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ] });
    scoutAgent.options.languageModel = model;
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0]?.tools?.map((tool) => tool.name)).toEqual(["recordProviderAssessment"]);
    const mine = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(mine[0]?.offer).toMatchObject({ ready: true });
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
    const message = await f.t.run((ctx) => ctx.db.get(f.messageId));
    expect(message?.parsedSummary).toBe(f.assessment.summary);
    const event = await f.t.run((ctx) => ctx.db.get(f.eventId));
    expect(event?.status).toBe("completed");
  });

  it("repairs one rejected stitched citation inside the same Agent turn", async () => {
    const f = await fixture();
    const invalid = structuredClone(f.assessment);
    invalid.terms[0]!.evidence = [{
      sourceId: `mail:${f.messageId}`,
      quote: "Room available. Drums and storage allowed",
    }];
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
    const model = new MockLanguageModelV4({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "assessment-invalid", toolName: "recordProviderAssessment", input: JSON.stringify(invalid) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "tool-call", toolCallId: "assessment-corrected", toolName: "recordProviderAssessment", input: JSON.stringify(f.assessment) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "text", text: "Assessment recorded." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ] });
    scoutAgent.options.languageModel = model;

    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(model.doGenerateCalls).toHaveLength(3);
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain("OFFER_EVIDENCE_NOT_CONTIGUOUS");
    expect(JSON.stringify(model.doGenerateCalls[1]?.prompt)).toContain("terms[0].evidence[0]");
    expect(await f.t.run((ctx) => ctx.db.query("offerRevisions").collect())).toHaveLength(1);
    expect(await f.t.run((ctx) => ctx.db.get(f.eventId))).toMatchObject({ status: "completed" });
  });

  it("records a bounded semantic failure without replaying the Workpool action or staging a message", async () => {
    const f = await fixture();
    const invalid = structuredClone(f.assessment);
    invalid.terms[0]!.evidence = [{
      sourceId: `mail:${f.messageId}`,
      quote: "Room available. Drums and storage allowed",
    }];
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
    const model = new MockLanguageModelV4({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "assessment-invalid-1", toolName: "recordProviderAssessment", input: JSON.stringify(invalid) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "tool-call", toolCallId: "assessment-invalid-2", toolName: "recordProviderAssessment", input: JSON.stringify(invalid) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "text", text: "The evidence could not be recorded." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ] });
    scoutAgent.options.languageModel = model;

    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect(model.doGenerateCalls).toHaveLength(3);
    expect(await f.t.run((ctx) => ctx.db.query("offerRevisions").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.get(f.eventId))).toMatchObject({
      status: "failed",
      errorCode: "OFFER_EVIDENCE_NOT_CONTIGUOUS",
    });
  });

  it("keeps different provider threads separate even for the same matched room", async () => {
    const f = await fixture();
    const secondThread = await f.t.run(async (ctx) => {
      const first = (await ctx.db.get(f.threadId))!;
      return await ctx.db.insert("mailThreads", {
        ownerId: f.ownerId, draftId: first.draftId, mailboxId: f.mailboxId,
        providerThreadId: "another-provider", subject: "Second provider", status: "awaiting_reply", lastMessageAt: Date.now(), createdAt: Date.now(),
      });
    });
    const secondMessage = await f.t.mutation(internal.inbox.storeInboundMessage, {
      ...f.inbound, providerThreadId: "another-provider", providerMessageId: "second-provider-message", providerEventId: "second-provider-event", body: "Our room is unavailable.",
    });
    const secondEvent = await f.t.mutation(internal.providerConversations.enqueueMailReply, { messageId: secondMessage! });
    const input = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: secondEvent! });
    expect(input?.threadId).not.toBe(f.input.threadId);
    expect(input?.previousAssessment).toBeNull();
    expect(input?.evidence.some((source) => source.text.includes(body))).toBe(false);
    const rows = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(rows.map((row) => row.mailThreadId)).toContain(secondThread);
    expect(rows).toHaveLength(2);
  });

  it("queues only the authenticated current candidate and deduplicates the request", async () => {
    const f = await candidateFixture();
    const owner = f.t.withIdentity({ subject: f.ownerId });
    const first = await owner.mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    });
    expect(first).toMatchObject({ status: "queued" });
    const second = await owner.mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    });
    expect(second).toEqual({ status: "already_queued", conversationId: first.conversationId, eventId: first.eventId });
    expect(await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).toHaveLength(1);
    expect(await f.t.run((ctx) => ctx.db.get(f.opportunityId))).toMatchObject({ status: "reviewing" });

    const foreign = await f.t.withIdentity({ subject: f.otherId }).mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    });
    expect(foreign).toMatchObject({ status: "not_eligible" });
    await f.t.run((ctx) => ctx.db.patch(f.savedNeedId, { matchingRevision: 2, updatedAt: Date.now() }));
    expect(await owner.mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    })).toMatchObject({ status: "not_eligible", reason: "candidate_not_contact_eligible" });
  });

  it("stops before creating provider work when the musician identity is incomplete", async () => {
    const f = await candidateFixture();
    await f.t.run((ctx) => ctx.db.patch(f.ownerId, { firstName: undefined, providerIdentityConfirmedAt: undefined }));
    const result = await f.t.withIdentity({ subject: f.ownerId }).mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    });
    expect(result).toMatchObject({ status: "not_eligible", reason: "MUSICIAN_PROFILE_REQUIRED" });
    expect(await f.t.run((ctx) => ctx.db.get(result.conversationId!))).toMatchObject({ state: "needs_attention", lastErrorCode: "MUSICIAN_PROFILE_REQUIRED" });
    expect(await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
  });

  it("resumes one profile-blocked current candidate after profile confirmation without duplicating or sending", async () => {
    const f = await candidateFixture();
    const owner = f.t.withIdentity({ subject: f.ownerId });
    await f.t.run((ctx) => ctx.db.patch(f.ownerId, {
      firstName: undefined,
      actKind: undefined,
      actName: undefined,
      providerIdentityConfirmedAt: undefined,
    }));
    const blocked = await owner.mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId,
      signalId: f.signalId,
    });
    expect(blocked).toMatchObject({ status: "not_eligible", reason: "MUSICIAN_PROFILE_REQUIRED" });

    await owner.mutation(api.musicianProfile.saveMine, {
      firstName: "Mina",
      actKind: "band",
      actName: "Night Owls",
      expectedProviderDisplayName: "RoomScout for Night Owls",
    });
    const scheduled = await f.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.some((row) => row.name.includes("providerConversations:resumeProfileBlockedForOwner"))).toBe(true);

    expect(await f.t.mutation(internal.providerConversations.resumeProfileBlockedForOwner, { ownerId: f.ownerId })).toBe(1);
    expect(await f.t.mutation(internal.providerConversations.resumeProfileBlockedForOwner, { ownerId: f.ownerId })).toBe(0);
    const turns = await f.t.run((ctx) => ctx.db.query("providerTurns").collect());
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ kind: "opportunity" });
    expect("input" in turns[0]!).toBe(false);
    const resumedConversation = await f.t.run((ctx) => ctx.db.get(blocked.conversationId!));
    expect(resumedConversation).toMatchObject({ state: "thinking" });
    expect("lastErrorCode" in resumedConversation!).toBe(false);
    expect(await f.t.run((ctx) => ctx.db.get(f.opportunityId))).toMatchObject({ status: "reviewing" });
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
  });

  it("queues one repair for the latest failed no-action assessment and fails closed afterward", async () => {
    const f = await candidateFixture();
    const owner = f.t.withIdentity({ subject: f.ownerId });
    const started = await owner.mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    });
    await f.t.run(async (ctx) => {
      await ctx.db.patch(started.eventId!, { status: "failed", errorCode: "OFFER_EVIDENCE_NOT_CONTIGUOUS", completedAt: Date.now() });
      await ctx.db.patch(started.conversationId!, {
        activeEventId: undefined, state: "needs_attention", lastErrorCode: "OFFER_EVIDENCE_NOT_CONTIGUOUS", updatedAt: Date.now(),
      });
    });
    expect(await f.t.run((ctx) => failedAssessmentRetryEligibility(ctx, {
      ownerId: f.ownerId, savedNeedId: f.savedNeedId, signalId: f.signalId, opportunityId: f.opportunityId,
    }))).toMatchObject({ eligible: true, failedEventId: started.eventId });

    const first = await owner.mutation(api.providerConversations.retryFailedAssessment, { conversationId: started.conversationId! });
    expect(first).toMatchObject({ status: "queued", conversationId: started.conversationId });
    const second = await owner.mutation(api.providerConversations.retryFailedAssessment, { conversationId: started.conversationId! });
    expect(second).toEqual({ status: "already_queued", conversationId: first.conversationId, eventId: first.eventId });
    expect(await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).toHaveLength(2);

    expect(await f.t.withIdentity({ subject: f.otherId }).mutation(api.providerConversations.retryFailedAssessment, {
      conversationId: started.conversationId!,
    })).toMatchObject({ status: "not_eligible" });
  });

  it("refuses repair after context revision or any outbound ledger exists", async () => {
    const f = await candidateFixture();
    const owner = f.t.withIdentity({ subject: f.ownerId });
    const started = await owner.mutation(api.providerConversations.startInitialInquiry, {
      savedNeedId: f.savedNeedId, signalId: f.signalId,
    });
    await f.t.run(async (ctx) => {
      await ctx.db.patch(started.eventId!, { status: "failed", errorCode: "SCOUT_ASSESSMENT_FAILED", completedAt: Date.now() });
      await ctx.db.patch(started.conversationId!, {
        activeEventId: undefined, state: "needs_attention", lastErrorCode: "SCOUT_ASSESSMENT_FAILED", updatedAt: Date.now(),
      });
      const now = Date.now();
      await ctx.db.insert("actionRequests", {
        ownerId: f.ownerId, providerConversationId: started.conversationId, savedNeedId: f.savedNeedId,
        matchingSignalId: f.signalId, opportunityId: f.opportunityId,
        automationMode: "autopilot", requestedActionType: "send_platform_dm", personalDataScopes: [],
        payload: { kind: "platform_message", recipients: ["Listing owner"], body: "Synthetic prior draft" },
        contentVersion: 1, contentHash: "synthetic-ledger", status: "failed", createdAt: now, updatedAt: now,
      });
    });
    expect(await owner.mutation(api.providerConversations.retryFailedAssessment, {
      conversationId: started.conversationId!,
    })).toMatchObject({ status: "not_eligible", reason: "candidate_not_contact_eligible" });
    expect(await f.t.run((ctx) => failedAssessmentRetryEligibility(ctx, {
      ownerId: f.ownerId, savedNeedId: f.savedNeedId, signalId: f.signalId, opportunityId: f.opportunityId,
    }))).toEqual({ eligible: false, reason: "action_exists" });

    await f.t.run(async (ctx) => {
      const requests = await ctx.db.query("actionRequests").collect();
      for (const request of requests) await ctx.db.delete(request._id);
      await ctx.db.patch(f.savedNeedId, { matchingRevision: 2, updatedAt: Date.now() });
    });
    expect(await owner.mutation(api.providerConversations.retryFailedAssessment, {
      conversationId: started.conversationId!,
    })).toMatchObject({ status: "not_eligible", reason: "candidate_not_contact_eligible" });
  });
});
