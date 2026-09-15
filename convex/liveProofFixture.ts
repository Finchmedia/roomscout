/**
 * Temporary, internal-only data fixture for the isolated GPT Live proof
 * deployment. It creates UI-readable synthetic state and no executable target.
 */

import { listMessages } from "@convex-dev/agent";
import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { contentHash } from "./integrations/contentHash";
import { OFFER_OPTIONS, OFFER_READY_QUESTION, raiseDecision } from "./lib/decisions";
import { signalMatchRevision } from "./lib/matchValidity";
import {
  offerConstraints,
  offerReadiness,
  providerAssessmentSchema,
  PROVIDER_ASSESSMENT_VERSION,
} from "./lib/providerAssessment";

const FIXTURE_PREFIX = "gpt-live-proof-";
const FIXTURE_CONFIRMATION = "CREATE_ISOLATED_GPT_LIVE_FIXTURE";
const EXPLICIT_ISOLATED_TEST_USER = "live-scout-check-0915";
const CURRENT_ISOLATED_TEST_USER = "gpt-live-proof-0915-b";
const inspectUsernameValidator = v.union(
  v.literal(EXPLICIT_ISOLATED_TEST_USER),
  v.literal(CURRENT_ISOLATED_TEST_USER),
);

const resultValidator = v.object({
  ownerId: v.id("users"),
  savedNeedId: v.id("savedNeeds"),
  needRevision: v.number(),
  nonbindingDecisionId: v.id("decisions"),
  bindingDecisionId: v.id("decisions"),
  conversationId: v.id("providerConversations"),
  providerMessageId: v.id("platformMessages"),
  offerId: v.id("offerRevisions"),
  offerHash: v.string(),
});

const facetValidator = v.object({
  namespace: v.string(),
  key: v.string(),
  value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
  confidence: v.number(),
});

const inspectionValidator = v.object({
  ownerId: v.id("users"),
  savedNeedId: v.id("savedNeeds"),
  need: v.object({
    status: v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived")),
    maxBudgetEur: v.optional(v.number()),
    schedule: v.array(v.string()),
    revision: v.number(),
    facets: v.array(facetValidator),
  }),
  openDecisions: v.array(v.object({
    decisionId: v.id("decisions"),
    kind: v.string(),
    status: v.literal("open"),
  })),
  fixture: v.object({
    conversationId: v.id("providerConversations"),
    conversationState: v.string(),
    conversationRevision: v.number(),
    activeEvent: v.boolean(),
    offerId: v.optional(v.id("offerRevisions")),
    offerReady: v.boolean(),
    offerRevision: v.optional(v.number()),
    offerNeedRevision: v.optional(v.number()),
    offerCurrent: v.boolean(),
    acceptanceRequestId: v.optional(v.id("actionRequests")),
    acceptedOfferId: v.optional(v.id("offerRevisions")),
    acceptedAt: v.optional(v.number()),
  }),
  ledgers: v.object({
    ownerActionRequests: v.number(),
    ownerApprovals: v.number(),
    ownerExecutions: v.number(),
    fixtureActionRequests: v.number(),
    fixtureApprovals: v.number(),
    fixtureExecutions: v.number(),
    fixtureExecutedRequests: v.number(),
    fixtureSucceededExecutions: v.number(),
  }),
  voice: v.object({
    sessions: v.number(),
    activeClaims: v.number(),
    knownRequests: v.number(),
    cachedResults: v.number(),
  }),
  agent: v.object({
    recentMessages: v.number(),
    recentUserMessages: v.number(),
    recentPageComplete: v.boolean(),
  }),
});

/**
 * Creates one fresh proof fixture for an explicitly named synthetic musician.
 * A fixture key is single-use, preventing an accidental rerun from duplicating
 * the provider conversation.
 */
export const create = internalMutation({
  args: {
    username: v.string(),
    fixtureKey: v.string(),
    confirmation: v.literal(FIXTURE_CONFIRMATION),
  },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const username = args.username.trim();
    const fixtureKey = args.fixtureKey.trim();
    if (!username || !fixtureKey.startsWith(FIXTURE_PREFIX) || !/^[a-z0-9-]{8,80}$/.test(fixtureKey)) {
      throw new ConvexError({ code: "INVALID_LIVE_PROOF_FIXTURE_TARGET" });
    }

    const owner = await ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", username)).unique();
    if (!owner || owner.role !== "musician" ||
      (owner.controlledProofActorKey === undefined && owner.username !== EXPLICIT_ISOLATED_TEST_USER &&
        !owner.username.startsWith(FIXTURE_PREFIX))) {
      throw new ConvexError({ code: "SYNTHETIC_LIVE_PROOF_USER_REQUIRED" });
    }

    const context = await ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", owner._id)).unique();
    const activeNeed = context?.activeNeedId
      ? await ctx.db.get(context.activeNeedId)
      : await ctx.db.query("savedNeeds").withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", owner._id).eq("status", "active"),
      ).unique();
    if (!activeNeed || activeNeed.ownerId !== owner._id || activeNeed.status !== "active") {
      throw new ConvexError({ code: "ACTIVE_LIVE_PROOF_NEED_REQUIRED" });
    }

    const conversationKey = `fixture:${fixtureKey}`;
    const existing = await ctx.db.query("providerConversations").withIndex("by_owner_and_key", (q) =>
      q.eq("ownerId", owner._id).eq("conversationKey", conversationKey),
    ).unique();
    if (existing) throw new ConvexError({ code: "LIVE_PROOF_FIXTURE_ALREADY_EXISTS", conversationId: existing._id });

    const needRevision = activeNeed.matchingRevision ?? 0;
    const now = Date.now();
    const sourceId = await ctx.db.insert("sources", {
      slug: fixtureKey,
      name: "GPT Live synthetic proof source",
      baseUrl: "https://gpt-live-proof.invalid",
      side: "both",
      status: "paused",
      health: "unknown",
      accessMode: "restricted",
      automationReview: "restricted",
      policyNotes: "Synthetic isolated-cloud proof fixture; no external provider exists.",
      publicDisplay: false,
      createdAt: now,
      updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId: owner._id,
      sourceId,
      label: "SYNTHETIC GPT Live proof — disabled",
      allowedDomains: ["gpt-live-proof.invalid"],
      allowedPaths: [],
      status: "disabled",
      policyDecision: "prohibited",
      allowReadOnlyRecon: false,
      allowInboxPolling: false,
      pollIntervalMinutes: 1_440,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const threadId = await ctx.db.insert("platformThreads", {
      connectionId,
      ownerId: owner._id,
      providerThreadId: `synthetic:${fixtureKey}`,
      subject: "SYNTHETIC GPT Live binding-review proof",
      participants: ["Synthetic Provider — no external account"],
      lastMessageAt: now,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    const priceEur = Math.max(0, Math.min(activeNeed.maxBudgetEur ?? 180, 180));
    const constraintEvidence = offerConstraints(activeNeed).map((constraint) => ({
      ...constraint,
      quote: `Confirmed synthetic constraint ${constraint.key}: ${constraint.text}`,
    }));
    const availabilityQuote = "The synthetic rehearsal room is available.";
    const priceQuote = `The synthetic total recurring price is EUR ${priceEur} per month.`;
    const providerText = [
      "SYNTHETIC TEST DATA ONLY. No provider sent this message.",
      availabilityQuote,
      priceQuote,
      ...constraintEvidence.map((item) => item.quote),
      "This fixture is for UI and voice-boundary verification only.",
    ].join("\n");
    if (providerText.length > 12_000) throw new ConvexError({ code: "LIVE_PROOF_NEED_TOO_LARGE" });

    const platformMessageId = await ctx.db.insert("platformMessages", {
      connectionId,
      ownerId: owner._id,
      threadId,
      providerMessageId: `synthetic-reply:${fixtureKey}`,
      direction: "inbound",
      senderLabel: "Synthetic Provider — no external account",
      bodyText: providerText,
      sentAt: now,
      createdAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "SYNTHETIC offer for GPT Live proof",
      city: activeNeed.city,
      summary: "Synthetic current offer used only to verify UI/voice authority boundaries.",
      arrangement: activeNeed.arrangement[0] ?? "unknown",
      priceEur,
      pricePeriod: "month",
      requirements: [],
      unknowns: [],
      // Current-offer guards accept stale signals; keeping this synthetic row
      // stale prevents it from joining normal published-supply surfaces.
      status: "stale",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      publishedAt: now,
      isDemo: true,
    });
    const signalRevision = await signalMatchRevision((await ctx.db.get(signalId))!);
    const conversationId = await ctx.db.insert("providerConversations", {
      ownerId: owner._id,
      conversationKey,
      savedNeedId: activeNeed._id,
      signalId,
      agentThreadId: `synthetic-no-agent-thread:${fixtureKey}`,
      platformThreadId: threadId,
      revision: 1,
      state: "offer_ready",
      createdAt: now,
      updatedAt: now,
    });
    const turnId = await ctx.db.insert("providerTurns", {
      conversationId,
      sourceKey: `portal:${platformMessageId}`,
      kind: "portal_reply",
      platformMessageId,
      revision: 1,
      status: "completed",
      createdAt: now,
      completedAt: now,
    });
    const sourceRef = `portal:${platformMessageId}`;
    const assessment = providerAssessmentSchema.parse({
      summary: "SYNTHETIC ready offer. No provider interaction occurred.",
      availability: { status: "available", evidence: [{ sourceId: sourceRef, quote: availabilityQuote }] },
      monthlyPrice: {
        totalEur: priceEur,
        allRecurringCostsKnown: true,
        evidence: [{ sourceId: sourceRef, quote: priceQuote }],
      },
      terms: [],
      constraints: constraintEvidence.map((constraint) => ({
        key: constraint.key,
        verdict: "satisfied" as const,
        explanation: constraint.text,
        evidence: [{ sourceId: sourceRef, quote: constraint.quote }],
      })),
      uncertainties: [],
      contradictions: [],
      nextAction: "present_offer",
      suggestedReply: null,
    });
    const readiness = offerReadiness(assessment, activeNeed);
    if (!readiness.ready) throw new ConvexError({ code: "LIVE_PROOF_OFFER_NOT_READY", blockers: readiness.blockers });
    const offerHash = await contentHash([fixtureKey, String(needRevision), signalRevision, providerText]);
    const offerId = await ctx.db.insert("offerRevisions", {
      ownerId: owner._id,
      savedNeedId: activeNeed._id,
      conversationId,
      eventId: turnId,
      revision: 1,
      needRevision,
      signalRevision,
      assessment,
      ready: true,
      blockers: [],
      contentHash: offerHash,
      model: "synthetic-fixture",
      promptVersion: "synthetic-fixture-v1",
      schemaVersion: PROVIDER_ASSESSMENT_VERSION,
      createdAt: now,
    });
    await ctx.db.patch(turnId, { offerId });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });

    const bindingDecisionId = await raiseDecision(ctx, {
      ownerId: owner._id,
      savedNeedId: activeNeed._id,
      conversationId,
      kind: "offer_ready",
      question: OFFER_READY_QUESTION,
      detail: "SYNTHETIC TEST DATA ONLY. Review remains a binding UI action.",
      options: OFFER_OPTIONS,
      refs: { offerId },
    });
    const nonbindingDecisionId = await raiseDecision(ctx, {
      ownerId: owner._id,
      savedNeedId: activeNeed._id,
      kind: "scout_question",
      question: "Synthetic voice proof: should Scout keep Tuesday as a preferred rehearsal day?",
      detail: "SYNTHETIC TEST DATA ONLY. This answer changes no search field or external state.",
      options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
      refs: {},
    });

    const unchangedNeed = await ctx.db.get(activeNeed._id);
    const unchangedContext = context ? await ctx.db.get(context._id) : null;
    if (!unchangedNeed || (unchangedNeed.matchingRevision ?? 0) !== needRevision ||
      unchangedNeed.updatedAt !== activeNeed.updatedAt ||
      (context && (!unchangedContext || unchangedContext.activeNeedId !== context.activeNeedId ||
        unchangedContext.readyNeedRevision !== context.readyNeedRevision ||
        unchangedContext.focusedSignalId !== context.focusedSignalId))) {
      throw new ConvexError({ code: "LIVE_PROOF_CURRENT_NEED_CHANGED" });
    }

    return {
      ownerId: owner._id,
      savedNeedId: activeNeed._id,
      needRevision,
      nonbindingDecisionId,
      bindingDecisionId,
      conversationId,
      providerMessageId: platformMessageId,
      offerId,
      offerHash,
    };
  },
});

/** Read-only post-proof assertions. No message, request payload, or secret text is returned. */
export const inspect = internalQuery({
  args: {
    username: inspectUsernameValidator,
    fixtureKey: v.string(),
    confirmation: v.literal(FIXTURE_CONFIRMATION),
  },
  returns: inspectionValidator,
  handler: async (ctx, args) => {
    const fixtureKey = args.fixtureKey.trim();
    if (!fixtureKey.startsWith(FIXTURE_PREFIX) || !/^[a-z0-9-]{8,80}$/.test(fixtureKey)) {
      throw new ConvexError({ code: "INVALID_LIVE_PROOF_FIXTURE_TARGET" });
    }
    const owner = await ctx.db.query("users").withIndex("by_username", (q) =>
      q.eq("username", args.username),
    ).unique();
    if (!owner || owner.role !== "musician" || owner.username !== args.username) {
      throw new ConvexError({ code: "SYNTHETIC_LIVE_PROOF_USER_REQUIRED" });
    }
    const [context, conversation, openDecisions, ownerRequests, ownerApprovals, ownerExecutions, voiceSessions] = await Promise.all([
      ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", owner._id)).unique(),
      ctx.db.query("providerConversations").withIndex("by_owner_and_key", (q) =>
        q.eq("ownerId", owner._id).eq("conversationKey", `fixture:${fixtureKey}`),
      ).unique(),
      ctx.db.query("decisions").withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", owner._id).eq("status", "open"),
      ).collect(),
      ctx.db.query("actionRequests").withIndex("by_owner_and_saved_need_and_updated_at", (q) =>
        q.eq("ownerId", owner._id),
      ).collect(),
      ctx.db.query("actionApprovals").withIndex("by_owner_and_decided_at", (q) =>
        q.eq("ownerId", owner._id),
      ).collect(),
      ctx.db.query("actionExecutions").withIndex("by_owner_and_created_at", (q) =>
        q.eq("ownerId", owner._id),
      ).collect(),
      ctx.db.query("voiceSessions").withIndex("by_owner_and_started_at", (q) =>
        q.eq("ownerId", owner._id),
      ).collect(),
    ]);
    if (!context?.activeNeedId || !conversation) {
      throw new ConvexError({ code: "LIVE_PROOF_FIXTURE_NOT_FOUND" });
    }
    const [need, offer, signal, agentMessages] = await Promise.all([
      ctx.db.get(context.activeNeedId),
      conversation.currentOfferId ? ctx.db.get(conversation.currentOfferId) : null,
      ctx.db.get(conversation.signalId),
      listMessages(ctx, components.agent, {
        threadId: context.threadId,
        paginationOpts: { cursor: null, numItems: 100 },
      }),
    ]);
    if (!need || need.ownerId !== owner._id || conversation.savedNeedId !== need._id) {
      throw new ConvexError({ code: "ACTIVE_LIVE_PROOF_NEED_REQUIRED" });
    }

    const fixtureRequestIds = new Set(ownerRequests
      .filter((request) => request.providerConversationId === conversation._id)
      .map((request) => request._id));
    const fixtureApprovals = ownerApprovals.filter((approval) => fixtureRequestIds.has(approval.requestId));
    const fixtureExecutions = ownerExecutions.filter((execution) => fixtureRequestIds.has(execution.requestId));
    const currentSignalRevision = signal ? await signalMatchRevision(signal) : undefined;
    const offerCurrent = !!offer && offer.ownerId === owner._id && !conversation.activeEventId &&
      conversation.state !== "closed" && conversation.currentOfferId === offer._id &&
      offer.revision === conversation.revision && offer.needRevision === (need.matchingRevision ?? 0) &&
      !!signal && ["published", "stale"].includes(signal.status) && offer.signalRevision === currentSignalRevision;

    return {
      ownerId: owner._id,
      savedNeedId: need._id,
      need: {
        status: need.status,
        ...(need.maxBudgetEur !== undefined ? { maxBudgetEur: need.maxBudgetEur } : {}),
        schedule: need.schedule,
        revision: need.matchingRevision ?? 0,
        facets: need.facets ?? [],
      },
      openDecisions: openDecisions.map((decision) => ({
        decisionId: decision._id,
        kind: decision.kind,
        status: "open" as const,
      })),
      fixture: {
        conversationId: conversation._id,
        conversationState: conversation.state,
        conversationRevision: conversation.revision,
        activeEvent: conversation.activeEventId !== undefined,
        ...(offer ? {
          offerId: offer._id,
          offerReady: offer.ready,
          offerRevision: offer.revision,
          offerNeedRevision: offer.needRevision,
        } : { offerReady: false }),
        offerCurrent,
        ...(conversation.acceptanceRequestId !== undefined
          ? { acceptanceRequestId: conversation.acceptanceRequestId }
          : {}),
        ...(conversation.acceptedOfferId !== undefined ? { acceptedOfferId: conversation.acceptedOfferId } : {}),
        ...(conversation.acceptedAt !== undefined ? { acceptedAt: conversation.acceptedAt } : {}),
      },
      ledgers: {
        ownerActionRequests: ownerRequests.length,
        ownerApprovals: ownerApprovals.length,
        ownerExecutions: ownerExecutions.length,
        fixtureActionRequests: fixtureRequestIds.size,
        fixtureApprovals: fixtureApprovals.length,
        fixtureExecutions: fixtureExecutions.length,
        fixtureExecutedRequests: ownerRequests.filter((request) =>
          fixtureRequestIds.has(request._id) && request.status === "executed",
        ).length,
        fixtureSucceededExecutions: fixtureExecutions.filter((execution) => execution.status === "succeeded").length,
      },
      voice: {
        sessions: voiceSessions.length,
        activeClaims: voiceSessions.filter((session) => session.activeClaim !== undefined).length,
        knownRequests: voiceSessions.reduce((count, session) => count + (session.requestTombstones?.length ?? 0), 0),
        cachedResults: voiceSessions.reduce((count, session) => count + (session.recentResults?.length ?? 0), 0),
      },
      agent: {
        recentMessages: agentMessages.page.length,
        recentUserMessages: agentMessages.page.filter((message) => message.message?.role === "user").length,
        recentPageComplete: agentMessages.isDone,
      },
    };
  },
});
