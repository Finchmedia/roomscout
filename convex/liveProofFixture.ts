/**
 * Temporary, internal-only data fixture for the isolated GPT Live proof
 * deployment. It creates UI-readable synthetic state and no executable target.
 */

import { ConvexError, v } from "convex/values";
import { internalMutation } from "./_generated/server";
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
