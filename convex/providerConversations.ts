import { createTool, saveMessage } from "@convex-dev/agent";
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ROOMSCOUT_MODEL_ID } from "./ai";
import { contentHash } from "./integrations/contentHash";
import { requireUserId } from "./integrations/authz";
import { signalMatchRevision, opportunityMatchIsCurrent } from "./lib/matchValidity";
import { delimitUntrustedData } from "./lib/privacy";
import { listingEvidence } from "./lib/matchAssessment";
import {
  assessmentCitations, offerConstraints, offerEvidenceValidator, offerReadiness,
  providerAssessmentSchema, providerAssessmentValidator, providerCaseInstructions,
  providerAssessmentContextInstructions, providerAssessmentValidationIssue,
  PROVIDER_ASSESSMENT_VERSION, validateProviderAssessment,
  type OfferEvidence,
} from "./lib/providerAssessment";
import { OFFER_OPTIONS, OFFER_READY_QUESTION, raiseDecision, musicianQuestionRoundStatement } from "./lib/decisions";
import { savedNeedLocationLabel } from "./lib/savedNeedLocation";
import { resolveProviderIdentity } from "./lib/musicianIdentity";
import { hasExecutedProviderDecline, hasPersistedProviderExchange } from "./providerActions";
import { runScoutTurn, scoutAgent, SCOUT_PROMPT_VERSION } from "./scoutRuntime";
import { scoutWorkpool } from "./workpools";

const needValidator = v.object({
  title: v.string(), city: v.string(), requirements: v.array(v.string()), schedule: v.array(v.string()),
  maxBudgetEur: v.optional(v.number()), arrangement: v.array(v.string()),
  /** Search centre and radius, so an address inside the radius is not mistaken for a wrong district. */
  searchCenter: v.optional(v.string()), searchRadiusKm: v.optional(v.number()),
});
const inputValidator = v.object({
  ownerId: v.id("users"), conversationId: v.id("providerConversations"),
  threadId: v.string(), promptMessageId: v.optional(v.string()), revision: v.number(),
  needRevision: v.number(), signalRevision: v.string(), need: needValidator,
  evidence: v.array(offerEvidenceValidator),
  /** Recent messages sent to the provider, oldest first. Context only; never provider evidence. */
  recentOutboundMessages: v.array(v.string()),
  previousAssessment: v.union(providerAssessmentValidator, v.null()),
  kind: v.union(v.literal("opportunity"), v.literal("mail_reply"), v.literal("portal_reply"), v.literal("musician_input")),
  /** Trusted statements of the musician (answers to Scout questions), oldest first. */
  musicianStatements: v.array(v.string()),
  clarificationScope: v.optional(v.object({ previousAssessment: providerAssessmentValidator, answeredConstraintKeys: v.array(v.string()), retainedConstraintKeys: v.optional(v.array(v.string())) })),
  musicianIdentity: v.object({
    complete: v.literal(true), providerDisplayName: v.string(), representedName: v.string(),
    actKind: v.union(v.literal("band"), v.literal("solo")), firstName: v.string(),
    dataFields: v.array(v.union(v.literal("band_name"), v.literal("member_first_names"))),
  }),
  providerContext: v.object({ controlledAiSimulation: v.boolean() }),
});

const processResultValidator = v.object({
  outcome: v.union(v.literal("recorded"), v.literal("validation_failed"), v.literal("stale")),
  errorCode: v.optional(v.string()),
});

async function ensureConversation(ctx: MutationCtx, args: {
  ownerId: Id<"users">; savedNeedId: Id<"savedNeeds">; signalId: Id<"signals">;
  conversationKey: string;
  opportunityId?: Id<"opportunities">;
}) {
  const [need, signal] = await Promise.all([ctx.db.get(args.savedNeedId), ctx.db.get(args.signalId)]);
  if (need?.ownerId !== args.ownerId || !signal) throw new ConvexError({ code: "CONVERSATION_CONTEXT_NOT_FOUND" });
  const existing = await ctx.db.query("providerConversations").withIndex("by_owner_and_key", (q) =>
    q.eq("ownerId", args.ownerId).eq("conversationKey", args.conversationKey),
  ).unique();
  if (existing) {
    if (existing.ownerId !== args.ownerId || existing.savedNeedId !== args.savedNeedId || existing.signalId !== args.signalId) throw new ConvexError({ code: "CONVERSATION_OWNER_MISMATCH" });
    return existing;
  }
  const { threadId } = await scoutAgent.createThread(ctx, { userId: args.ownerId, title: "Private room-provider conversation" });
  const now = Date.now();
  const id = await ctx.db.insert("providerConversations", {
    ...args, agentThreadId: threadId, revision: 0, state: "waiting", createdAt: now, updatedAt: now,
  });
  return (await ctx.db.get(id))!;
}

/** The pool owns retries/delivery; this pointer serializes the domain's turns.
 * New messages invalidate old offers immediately, even while AI is running. */
async function startNext(ctx: MutationCtx, conversationId: Id<"providerConversations">) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.activeEventId || conversation.state === "closed") return;
  const next = await ctx.db.query("providerTurns").withIndex("by_conversation_and_status_and_revision", (q) =>
    q.eq("conversationId", conversationId).eq("status", "pending"),
  ).first();
  if (!next) return;
  await ctx.db.patch(next._id, { status: "processing" });
  await ctx.db.patch(conversationId, { activeEventId: next._id, state: "thinking", lastErrorCode: undefined, updatedAt: Date.now() });
  await scoutWorkpool.enqueueAction(ctx, internal.providerConversations.processEvent, { eventId: next._id }, {
    onComplete: internal.providerConversations.turnCompleted, context: { eventId: next._id },
  });
}

async function enqueue(ctx: MutationCtx, conversation: Doc<"providerConversations">, args: {
  sourceKey: string; kind: Doc<"providerTurns">["kind"];
  mailMessageId?: Id<"mailMessages">; platformMessageId?: Id<"platformMessages">;
  input?: string; decisionId?: Id<"decisions">;
}) {
  if (conversation.state === "closed") return null;
  const existing = await ctx.db.query("providerTurns").withIndex("by_conversation_and_source", (q) =>
    q.eq("conversationId", conversation._id).eq("sourceKey", args.sourceKey),
  ).unique();
  if (existing) return existing._id;
  const revision = conversation.revision + 1;
  const id = await ctx.db.insert("providerTurns", {
    ...args, conversationId: conversation._id, revision, status: "pending", createdAt: Date.now(),
  });
  await ctx.db.patch(conversation._id, { revision, state: "thinking", updatedAt: Date.now() });
  await startNext(ctx, conversation._id);
  return id;
}

export type FailedAssessmentRetryReason =
  | "conversation_missing"
  | "conversation_not_failed"
  | "conversation_busy"
  | "turn_missing"
  | "turn_not_failed"
  | "offer_exists"
  | "action_exists"
  | "thread_exists"
  | "context_mismatch";

export type FailedAssessmentRetryEligibility =
  | { eligible: true; conversationId: Id<"providerConversations">; failedEventId: Id<"providerTurns"> }
  | { eligible: false; reason: FailedAssessmentRetryReason };

/** Read-only recovery guard shared with matching. It deliberately treats any
 * action ledger row as evidence that retrying could duplicate provider work. */
export async function failedAssessmentRetryEligibility(
  ctx: Pick<QueryCtx, "db">,
  args: {
    ownerId: Id<"users">;
    savedNeedId: Id<"savedNeeds">;
    signalId: Id<"signals">;
    opportunityId: Id<"opportunities">;
  },
): Promise<FailedAssessmentRetryEligibility> {
  const conversation = await ctx.db.query("providerConversations").withIndex("by_owner_and_key", (q) =>
    q.eq("ownerId", args.ownerId).eq("conversationKey", `opportunity:${args.opportunityId}`),
  ).unique();
  if (!conversation) return { eligible: false, reason: "conversation_missing" };
  if (conversation.savedNeedId !== args.savedNeedId || conversation.signalId !== args.signalId ||
    conversation.opportunityId !== args.opportunityId) return { eligible: false, reason: "context_mismatch" };
  if (conversation.mailThreadId || conversation.platformThreadId) return { eligible: false, reason: "thread_exists" };
  if (conversation.currentOfferId) return { eligible: false, reason: "offer_exists" };
  const priorActions = await ctx.db.query("actionRequests").withIndex("by_opportunity", (q) =>
    q.eq("opportunityId", args.opportunityId),
  ).take(1);
  if (priorActions.length) return { eligible: false, reason: "action_exists" };
  if (conversation.activeEventId) return { eligible: false, reason: "conversation_busy" };
  if (conversation.state !== "needs_attention" || !conversation.lastErrorCode) {
    return { eligible: false, reason: "conversation_not_failed" };
  }
  const failed = await ctx.db.query("providerTurns").withIndex("by_conversation_and_status_and_revision", (q) =>
    q.eq("conversationId", conversation._id).eq("status", "failed"),
  ).order("desc").first();
  if (!failed) return { eligible: false, reason: "turn_missing" };
  if (failed.kind !== "opportunity" || failed.revision !== conversation.revision || failed.offerId) {
    return { eligible: false, reason: failed.offerId ? "offer_exists" : "turn_not_failed" };
  }
  return { eligible: true, conversationId: conversation._id, failedEventId: failed._id };
}

const inquiryResultValidator = v.object({
  status: v.union(v.literal("queued"), v.literal("already_queued"), v.literal("not_eligible")),
  conversationId: v.optional(v.id("providerConversations")),
  eventId: v.optional(v.id("providerTurns")),
  reason: v.optional(v.string()),
});

async function controlledCandidateSource(ctx: Pick<QueryCtx, "db">, savedNeedId: Id<"savedNeeds">, signal: Doc<"signals">) {
  const entry = signal.sourceEntryId ? await ctx.db.get(signal.sourceEntryId) : null;
  const source = entry ? await ctx.db.get(entry.sourceId) : null;
  const platform = source?.platformId ? await ctx.db.get(source.platformId) : null;
  if (!entry || !source || source.status !== "active" ||
    !platform || platform.status !== "active" || platform.canonicalDomain !== "roomscout.dev") return false;
  const preference = await ctx.db.query("searchSourcePreferences").withIndex("by_saved_need_and_platform", (q) =>
    q.eq("savedNeedId", savedNeedId).eq("platformId", platform._id),
  ).unique();
  if (preference?.preference === "exclude") return false;
  try {
    return new URL(source.baseUrl).origin === "https://roomscout.dev" &&
      new URL(entry.detailUrl).origin === "https://roomscout.dev";
  } catch {
    return false;
  }
}

async function currentInquiryContext(ctx: MutationCtx, args: {
  ownerId: Id<"users">; savedNeedId: Id<"savedNeeds">; signalId: Id<"signals">;
}) {
  const [need, signal, match, opportunity] = await Promise.all([
    ctx.db.get(args.savedNeedId),
    ctx.db.get(args.signalId),
    ctx.db.query("signalMatches").withIndex("by_saved_need_and_signal", (q) =>
      q.eq("savedNeedId", args.savedNeedId).eq("signalId", args.signalId),
    ).unique(),
    ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) =>
      q.eq("savedNeedId", args.savedNeedId).eq("fingerprint", `match:${args.savedNeedId}:${args.signalId}`),
    ).unique(),
  ]);
  if (!need || need.ownerId !== args.ownerId || need.status !== "active" || !signal || signal.status !== "published" ||
    !match || match.ownerId !== args.ownerId || ["dismissed", "contacted"].includes(match.status) || match.contactEligible !== true ||
    !opportunity || opportunity.ownerId !== args.ownerId || opportunity.signalId !== args.signalId ||
    opportunity.kind !== "supply_match" || ["dismissed", "contacted", "converted", "expired"].includes(opportunity.status) ||
    !await opportunityMatchIsCurrent(ctx, opportunity, true) || !await controlledCandidateSource(ctx, args.savedNeedId, signal)) return null;
  const actions = await ctx.db.query("actionRequests").withIndex("by_opportunity", (q) => q.eq("opportunityId", opportunity._id)).take(1);
  if (actions.length) return null;
  return { need, signal, opportunity };
}

/** Reopens only an automatic listing assessment invalidated by newer search or
 * listing data. Any persisted exchange, ledger action, or user-visible outcome
 * keeps the closed conversation terminal. */
async function reopenRevisedInitialNoFit(
  ctx: MutationCtx,
  conversation: Doc<"providerConversations">,
  need: Doc<"savedNeeds">,
  signal: Doc<"signals">,
): Promise<Doc<"providerConversations">> {
  if (conversation.state !== "closed" || conversation.activeEventId || conversation.acceptedOfferId || conversation.acceptanceRequestId) {
    return conversation;
  }
  const offer = conversation.currentOfferId ? await ctx.db.get(conversation.currentOfferId) : null;
  const event = offer ? await ctx.db.get(offer.eventId) : null;
  if (!offer || event?.kind !== "opportunity" || !["decline", "stop"].includes(offer.assessment.nextAction)) return conversation;
  const currentSignalRevision = await signalMatchRevision(signal);
  if (offer.needRevision === (need.matchingRevision ?? 0) && offer.signalRevision === currentSignalRevision) return conversation;
  const [providerExchange, actions] = await Promise.all([
    hasPersistedProviderExchange(ctx, conversation),
    ctx.db.query("actionRequests").withIndex("by_provider_conversation_and_updated_at", (q) =>
      q.eq("providerConversationId", conversation._id),
    ).take(1),
  ]);
  if (providerExchange || actions.length) return conversation;
  await ctx.db.patch(conversation._id, { state: "waiting", lastErrorCode: undefined, updatedAt: Date.now() });
  return (await ctx.db.get(conversation._id))!;
}

/** Candidate-panel action: queue only this exact eligible opportunity. The
 * server derives all provider context; callers cannot supply message text. */
export const startInitialInquiry = mutation({
  args: { savedNeedId: v.id("savedNeeds"), signalId: v.id("signals") },
  returns: inquiryResultValidator,
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const current = await currentInquiryContext(ctx, { ownerId, ...args });
    if (!current) return { status: "not_eligible" as const, reason: "candidate_not_contact_eligible" };
    const owner = await ctx.db.get(ownerId);
    const musicianIdentity = owner ? resolveProviderIdentity(owner) : { complete: false as const };
    const sourceKey = `opportunity:${current.opportunity._id}:${current.need.matchingRevision ?? 0}:${await signalMatchRevision(current.signal)}`;
    const existingConversation = await ctx.db.query("providerConversations").withIndex("by_owner_and_key", (q) =>
      q.eq("ownerId", ownerId).eq("conversationKey", `opportunity:${current.opportunity._id}`),
    ).unique();
    if (existingConversation && (existingConversation.savedNeedId !== current.need._id ||
      existingConversation.signalId !== current.signal._id ||
      existingConversation.opportunityId !== current.opportunity._id)) {
      return { status: "not_eligible" as const, conversationId: existingConversation._id, reason: "conversation_context_mismatch" };
    }
    if (!musicianIdentity.complete) {
      const conversation = existingConversation ?? await ensureConversation(ctx, {
        ownerId, savedNeedId: current.need._id, signalId: current.signal._id,
        opportunityId: current.opportunity._id, conversationKey: `opportunity:${current.opportunity._id}`,
      });
      await ctx.db.patch(conversation._id, { state: "needs_attention", lastErrorCode: "MUSICIAN_PROFILE_REQUIRED", updatedAt: Date.now() });
      return { status: "not_eligible" as const, conversationId: conversation._id, reason: "MUSICIAN_PROFILE_REQUIRED" };
    }
    const existingEvent = existingConversation
      ? await ctx.db.query("providerTurns").withIndex("by_conversation_and_source", (q) =>
        q.eq("conversationId", existingConversation._id).eq("sourceKey", sourceKey),
      ).unique()
      : null;
    if (existingEvent) {
      return existingEvent.status === "failed"
        ? { status: "not_eligible" as const, conversationId: existingConversation!._id, eventId: existingEvent._id, reason: "assessment_failed_use_retry" }
        : { status: "already_queued" as const, conversationId: existingConversation!._id, eventId: existingEvent._id };
    }
    let conversation = existingConversation ?? await ensureConversation(ctx, {
      ownerId, savedNeedId: current.need._id, signalId: current.signal._id,
      opportunityId: current.opportunity._id, conversationKey: `opportunity:${current.opportunity._id}`,
    });
    conversation = await reopenRevisedInitialNoFit(ctx, conversation, current.need, current.signal);
    if (conversation.state === "closed") return { status: "not_eligible" as const, conversationId: conversation._id, reason: "conversation_closed" };
    const eventId = await enqueue(ctx, conversation, { sourceKey, kind: "opportunity" });
    if (!eventId) return { status: "not_eligible" as const, conversationId: conversation._id, reason: "conversation_closed" };
    await ctx.db.patch(current.opportunity._id, { status: "reviewing", updatedAt: Date.now() });
    return { status: "queued" as const, conversationId: conversation._id, eventId };
  },
});

/** Candidate-panel recovery: one idempotent repair event for a failed initial
 * assessment. It never accepts provider message text from the client. */
export const retryFailedAssessment = mutation({
  args: { conversationId: v.id("providerConversations") },
  returns: inquiryResultValidator,
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.ownerId !== ownerId || !conversation.opportunityId) {
      return { status: "not_eligible" as const, reason: "conversation_not_found" };
    }
    const current = await currentInquiryContext(ctx, {
      ownerId, savedNeedId: conversation.savedNeedId, signalId: conversation.signalId,
    });
    if (!current || current.opportunity._id !== conversation.opportunityId) {
      return { status: "not_eligible" as const, conversationId: conversation._id, reason: "candidate_not_contact_eligible" };
    }
    const failed = await ctx.db.query("providerTurns").withIndex("by_conversation_and_status_and_revision", (q) =>
      q.eq("conversationId", conversation._id).eq("status", "failed"),
    ).order("desc").first();
    if (!failed || failed.kind !== "opportunity") {
      return { status: "not_eligible" as const, conversationId: conversation._id, reason: "failed_assessment_not_found" };
    }
    const sourceKey = `assessment-repair:${failed._id}:${PROVIDER_ASSESSMENT_VERSION}`;
    const existing = await ctx.db.query("providerTurns").withIndex("by_conversation_and_source", (q) =>
      q.eq("conversationId", conversation._id).eq("sourceKey", sourceKey),
    ).unique();
    if (existing) return { status: "already_queued" as const, conversationId: conversation._id, eventId: existing._id };
    const eligibility = await failedAssessmentRetryEligibility(ctx, {
      ownerId, savedNeedId: conversation.savedNeedId, signalId: conversation.signalId,
      opportunityId: conversation.opportunityId,
    });
    if (!eligibility.eligible) {
      return { status: "not_eligible" as const, conversationId: conversation._id, reason: eligibility.reason };
    }
    const eventId = await enqueue(ctx, conversation, { sourceKey, kind: "opportunity" });
    if (!eventId) return { status: "not_eligible" as const, conversationId: conversation._id, reason: "conversation_closed" };
    await ctx.db.patch(current.opportunity._id, { status: "reviewing", updatedAt: Date.now() });
    return { status: "queued" as const, conversationId: conversation._id, eventId };
  },
});

export const enqueueOpportunity = internalMutation({
  args: { opportunityId: v.id("opportunities") }, returns: v.union(v.id("providerTurns"), v.null()),
  handler: async (ctx, { opportunityId }) => {
    const opportunity = await ctx.db.get(opportunityId);
    if (!opportunity?.signalId || opportunity.kind !== "supply_match" || ["dismissed", "expired", "converted"].includes(opportunity.status)) return null;
    if (!await opportunityMatchIsCurrent(ctx, opportunity, true)) return null;
    const need = await ctx.db.get(opportunity.savedNeedId);
    const signal = await ctx.db.get(opportunity.signalId);
    if (!need || !signal) return null;
    let conversation = await ensureConversation(ctx, {
      ownerId: opportunity.ownerId, savedNeedId: need._id, signalId: signal._id, opportunityId,
      conversationKey: `opportunity:${opportunityId}`,
    });
    conversation = await reopenRevisedInitialNoFit(ctx, conversation, need, signal);
    return await enqueue(ctx, conversation, {
      sourceKey: `opportunity:${opportunityId}:${need.matchingRevision ?? 0}:${await signalMatchRevision(signal)}`, kind: "opportunity",
    });
  },
});

/** Reassesses the small set of current candidates that were paused solely
 * because provider identity was not confirmed. Every candidate passes the
 * same controlled-source/current-revision gate as a fresh panel request. */
export const resumeProfileBlockedForOwner = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.number(),
  handler: async (ctx, { ownerId }) => {
    const owner = await ctx.db.get(ownerId);
    if (!owner || !resolveProviderIdentity(owner).complete) return 0;
    const blocked = await ctx.db.query("providerConversations")
      .withIndex("by_owner_and_state_and_updated_at", (q) =>
        q.eq("ownerId", ownerId).eq("state", "needs_attention"),
      )
      .order("desc")
      .take(10);
    let resumed = 0;
    for (const conversation of blocked) {
      if (conversation.lastErrorCode !== "MUSICIAN_PROFILE_REQUIRED" ||
        !conversation.opportunityId || conversation.activeEventId) continue;
      const current = await currentInquiryContext(ctx, {
        ownerId,
        savedNeedId: conversation.savedNeedId,
        signalId: conversation.signalId,
      });
      if (!current || current.opportunity._id !== conversation.opportunityId) continue;
      const sourceKey = `opportunity:${current.opportunity._id}:${current.need.matchingRevision ?? 0}:${await signalMatchRevision(current.signal)}`;
      const existing = await ctx.db.query("providerTurns").withIndex("by_conversation_and_source", (q) =>
        q.eq("conversationId", conversation._id).eq("sourceKey", sourceKey),
      ).unique();
      if (existing) continue;
      const eventId = await enqueue(ctx, conversation, { sourceKey, kind: "opportunity" });
      if (!eventId) continue;
      await ctx.db.patch(current.opportunity._id, { status: "reviewing", updatedAt: Date.now() });
      resumed++;
    }
    return resumed;
  },
});

export const enqueueMailReply = internalMutation({
  args: { messageId: v.id("mailMessages") }, returns: v.union(v.id("providerTurns"), v.null()),
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.direction !== "inbound") return null;
    const thread = await ctx.db.get(message.threadId);
    const draft = thread ? await ctx.db.get(thread.draftId) : null;
    if (!thread || !draft || draft.ownerId !== thread.ownerId) return null;
    const need = await ctx.db.get(draft.savedNeedId);
    if (need?.ownerId !== thread.ownerId) return null;
    const linked = await ctx.db.query("providerConversations").withIndex("by_mail_thread", (q) => q.eq("mailThreadId", thread._id)).unique();
    const conversation = linked ?? await ensureConversation(ctx, {
      ownerId: thread.ownerId, savedNeedId: draft.savedNeedId, signalId: draft.signalId,
      conversationKey: `mail:${thread._id}`,
    });
    if (conversation.ownerId !== thread.ownerId || conversation.savedNeedId !== draft.savedNeedId || conversation.signalId !== draft.signalId) return null;
    await ctx.db.patch(conversation._id, { mailThreadId: thread._id });
    return await enqueue(ctx, conversation, { sourceKey: `mail:${messageId}`, kind: "mail_reply", mailMessageId: messageId });
  },
});

export const attachPlatformThread = internalMutation({
  args: { conversationId: v.id("providerConversations"), requestId: v.id("actionRequests"), threadId: v.id("platformThreads") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [conversation, request, thread] = await Promise.all([
      ctx.db.get(args.conversationId), ctx.db.get(args.requestId), ctx.db.get(args.threadId),
    ]);
    if (!conversation || !request || !thread || request.status !== "executed" ||
      request.ownerId !== conversation.ownerId || request.savedNeedId !== conversation.savedNeedId ||
      request.providerConversationId !== conversation._id ||
      request.matchingSignalId !== conversation.signalId || thread.ownerId !== conversation.ownerId ||
      thread.connectionId !== request.connectionId ||
      (conversation.platformThreadId && conversation.platformThreadId !== thread._id)) {
      throw new ConvexError({ code: "PROVIDER_THREAD_BINDING_REJECTED" });
    }
    const existing = await ctx.db.query("providerConversations").withIndex("by_platform_thread", (q) => q.eq("platformThreadId", thread._id)).unique();
    if (existing && existing._id !== conversation._id) throw new ConvexError({ code: "PROVIDER_THREAD_ALREADY_BOUND" });
    await ctx.db.patch(conversation._id, { platformThreadId: thread._id, updatedAt: Date.now() });
    await ctx.runMutation(internal.providerConversations.enqueueBoundThreadMessages, { threadId: thread._id, cursor: null });
    return null;
  },
});

// A reply may have been read just before the outbound receipt bound its thread.
// Walk it once in pages; source-key dedup makes repeats harmless.
export const enqueueBoundThreadMessages = internalMutation({
  args: { threadId: v.id("platformThreads"), cursor: v.union(v.string(), v.null()) }, returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) => q.eq("threadId", args.threadId)).paginate({ cursor: args.cursor, numItems: 40 });
    for (const row of rows.page) if (row.direction === "inbound") {
      await ctx.runMutation(internal.providerConversations.enqueuePlatformReply, { messageId: row._id });
    }
    if (!rows.isDone) await ctx.scheduler.runAfter(0, internal.providerConversations.enqueueBoundThreadMessages, { threadId: args.threadId, cursor: rows.continueCursor });
    return null;
  },
});

/**
 * The musician answered a Scout question (Entscheidung scout_question). Their
 * words enter the conversation as a trusted turn so the Scout re-assesses the
 * offer with that decision in hand; `stageReply` may follow as for any turn.
 */
export async function enqueueMusicianInputTurn(ctx: MutationCtx, args: {
  conversationId: Id<"providerConversations">; decisionId: Id<"decisions">; input: string;
}): Promise<Id<"providerTurns"> | null> {
  const conversation = await ctx.db.get(args.conversationId);
  if (!conversation) return null;
  return await enqueue(ctx, conversation, {
    sourceKey: `decision:${args.decisionId}`, kind: "musician_input", input: args.input.slice(0, 4_000), decisionId: args.decisionId,
  });
}

export const enqueuePlatformReply = internalMutation({
  args: { messageId: v.id("platformMessages") }, returns: v.union(v.id("providerTurns"), v.null()),
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message || message.direction !== "inbound") return null;
    const conversation = await ctx.db.query("providerConversations").withIndex("by_platform_thread", (q) => q.eq("platformThreadId", message.threadId)).unique();
    if (!conversation || conversation.ownerId !== message.ownerId) return null;
    return await enqueue(ctx, conversation, { sourceKey: `portal:${messageId}`, kind: "portal_reply", platformMessageId: messageId });
  },
});

async function inputForEvent(ctx: QueryCtx, eventId: Id<"providerTurns">) {
  const event = await ctx.db.get(eventId);
  if (!event || event.status !== "processing") return null;
  const conversation = await ctx.db.get(event.conversationId);
  if (!conversation || conversation.activeEventId !== event._id || event.revision !== conversation.revision || conversation.state === "closed") return null;
  const [need, signal, owner] = await Promise.all([ctx.db.get(conversation.savedNeedId), ctx.db.get(conversation.signalId), ctx.db.get(conversation.ownerId)]);
  const musicianIdentity = owner ? resolveProviderIdentity(owner) : { complete: false as const };
  if (!need || need.ownerId !== conversation.ownerId || need.status !== "active" || !signal || !["published", "stale"].includes(signal.status) || !musicianIdentity.complete) return null;
  const evidence: OfferEvidence[] = [{ sourceId: "listing", text: listingEvidence(signal) }];
  const outboundMessages: Array<{ at: number; text: string }> = [];
  if (conversation.mailThreadId) {
    const rows = await ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) => q.eq("threadId", conversation.mailThreadId!)).order("desc").take(40);
    for (const row of rows) if (row.direction === "outbound") outboundMessages.push({ at: row.receivedAt, text: row.body.slice(0, 4_000) });
    for (const row of rows.reverse()) if (row.direction === "inbound") evidence.push({ sourceId: `mail:${row._id}`, text: `${row.subject}\n${row.body.slice(0, 16_000)}` });
  }
  if (conversation.platformThreadId) {
    const rows = await ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) => q.eq("threadId", conversation.platformThreadId!)).order("desc").take(40);
    for (const row of rows) if (row.direction === "outbound" && row.ownerId === conversation.ownerId) outboundMessages.push({ at: row.sentAt, text: row.bodyText.slice(0, 4_000) });
    for (const row of rows.reverse()) if (row.direction === "inbound" && row.ownerId === conversation.ownerId) evidence.push({ sourceId: `portal:${row._id}`, text: row.bodyText.slice(0, 16_000) });
  }
  const previous = conversation.currentOfferId ? await ctx.db.get(conversation.currentOfferId) : null;
  // Retain cited older facts without reloading unlimited conversation history.
  // The cited message must still belong to this exact provider thread.
  const citedIds = new Set(previous ? assessmentCitations(previous.assessment).map((item) => item.sourceId) : []);
  for (const sourceId of citedIds) {
    if (evidence.some((source) => source.sourceId === sourceId)) continue;
    const [kind, rawId] = sourceId.split(":");
    if (kind === "mail") {
      const id = ctx.db.normalizeId("mailMessages", rawId ?? "");
      const row = id ? await ctx.db.get(id) : null;
      if (row && row.threadId === conversation.mailThreadId && row.direction === "inbound") evidence.push({ sourceId, text: `${row.subject}\n${row.body.slice(0, 16_000)}` });
    } else if (kind === "portal") {
      const id = ctx.db.normalizeId("platformMessages", rawId ?? "");
      const row = id ? await ctx.db.get(id) : null;
      if (row && row.threadId === conversation.platformThreadId && row.ownerId === conversation.ownerId && row.direction === "inbound") evidence.push({ sourceId, text: row.bodyText.slice(0, 16_000) });
    }
  }
  if (JSON.stringify(evidence).length > 160_000) throw new Error("PROVIDER_CONTEXT_TOO_LARGE");
  // The musician's answers to Scout questions are trusted statements, distinct from provider evidence.
  const musicianTurns = await ctx.db.query("providerTurns").withIndex("by_conversation_and_kind_and_revision", (q) =>
    q.eq("conversationId", conversation._id).eq("kind", "musician_input"),
  ).order("desc").take(10);
  const musicianStatements = await Promise.all(musicianTurns.reverse()
    .filter((turn) => turn.input && (turn._id === event._id || turn.status === "completed" || turn.status === "superseded"))
    .map(async (turn) => {
      const decision = turn.decisionId ? await ctx.db.get(turn.decisionId) : null;
      return decision?.conversationId === conversation._id && decision.status === "answered" && decision.questions
        ? musicianQuestionRoundStatement(decision.questions) : turn.input!.slice(0, 4_000);
    }));
  const answeredDecision = event.kind === "musician_input" && event.decisionId ? await ctx.db.get(event.decisionId) : null;
  const signalRevision = await signalMatchRevision(signal);
  // Only compare concessions against the exact offer/search the round asked
  // about. New provider evidence or changed search constraints need a fresh assessment.
  const clarificationScope = answeredDecision?.conversationId === conversation._id && answeredDecision.status === "answered" &&
    answeredDecision.questions?.every((question) => question.answer) && previous &&
    answeredDecision.refs.offerId === previous._id && previous.needRevision === (need.matchingRevision ?? 0) && previous.signalRevision === signalRevision
      ? {
        previousAssessment: previous.assessment,
        answeredConstraintKeys: [...new Set(answeredDecision.questions.flatMap((question) => question.constraintKeys))],
        retainedConstraintKeys: [...new Set(answeredDecision.questions.flatMap((question) =>
          !question.answer?.text && question.options.find((option) => option.id === question.answer?.choice)?.constraintEffect === "keep_requirement" ? question.constraintKeys : []))],
      }
      : undefined;
  return {
    ownerId: conversation.ownerId, conversationId: conversation._id, threadId: conversation.agentThreadId,
    promptMessageId: event.promptMessageId, revision: conversation.revision, needRevision: need.matchingRevision ?? 0,
    signalRevision,
    need: {
      title: need.title, city: need.city, requirements: need.requirements, schedule: need.schedule, maxBudgetEur: need.maxBudgetEur, arrangement: need.arrangement,
      searchCenter: savedNeedLocationLabel(need) || undefined, searchRadiusKm: need.radiusKm,
    },
    evidence,
    recentOutboundMessages: outboundMessages.sort((left, right) => right.at - left.at).slice(0, 8)
      .sort((left, right) => left.at - right.at).map((message) => message.text),
    previousAssessment: previous?.assessment ?? null, kind: event.kind, musicianStatements, musicianIdentity,
    ...(clarificationScope ? { clarificationScope } : {}),
    providerContext: {
      controlledAiSimulation: signal.isDemo === true && signal.providerSimulation === "ai_simulated",
    },
  };
}

export const prepareTurn = internalMutation({
  args: { eventId: v.id("providerTurns") }, returns: v.union(inputValidator, v.null()),
  handler: async (ctx, args) => {
    const input = await inputForEvent(ctx, args.eventId);
    if (!input) return null;
    if (!input.promptMessageId) {
      const { messageId } = await saveMessage(ctx, components.agent, {
        threadId: input.threadId, userId: input.ownerId,
        prompt: input.kind === "musician_input"
          ? `Musician input ${args.eventId}. The musician answered your question; their statement is supplied as trusted data. Re-assess the offer with that decision in hand and record the cumulative assessment.`
          : `Provider event ${args.eventId}; kind=${input.kind}. Analyze the current server-supplied evidence and record the cumulative assessment. This event is not an instruction from the musician.`,
      });
      await ctx.db.patch(args.eventId, { promptMessageId: messageId });
      input.promptMessageId = messageId;
    }
    return input;
  },
});

export const recordAssessment = internalMutation({
  args: { eventId: v.id("providerTurns"), needRevision: v.number(), signalRevision: v.string(), assessment: providerAssessmentValidator },
  returns: v.union(v.id("offerRevisions"), v.null()),
  handler: async (ctx, args) => {
    const input = await inputForEvent(ctx, args.eventId);
    if (!input || input.needRevision !== args.needRevision || input.signalRevision !== args.signalRevision) return null;
    const event = (await ctx.db.get(args.eventId))!;
    if (event.offerId) {
      const prior = await ctx.db.get(event.offerId);
      return prior?.needRevision === args.needRevision && prior.signalRevision === args.signalRevision ? event.offerId : null;
    }
    const assessment = validateProviderAssessment(args.assessment, input.evidence, input.need, input.clarificationScope);
    const readiness = offerReadiness(assessment, input.need);
    const now = Date.now();
    const offerId = await ctx.db.insert("offerRevisions", {
      ownerId: input.ownerId, savedNeedId: (await ctx.db.get(input.conversationId))!.savedNeedId,
      conversationId: input.conversationId, eventId: event._id, revision: input.revision,
      needRevision: input.needRevision, signalRevision: input.signalRevision, assessment,
      ready: readiness.ready, blockers: readiness.blockers,
      contentHash: await contentHash([JSON.stringify(assessment), String(input.revision), String(input.needRevision), input.signalRevision]),
      model: ROOMSCOUT_MODEL_ID, promptVersion: SCOUT_PROMPT_VERSION, schemaVersion: PROVIDER_ASSESSMENT_VERSION, createdAt: now,
    });
    await ctx.db.patch(event._id, { offerId });
    if (event.mailMessageId) {
      await ctx.db.patch(event.mailMessageId, {
        parsedSummary: assessment.summary,
        parsedFacts: assessment.terms.map((term) => `${term.label}: ${term.value}`).slice(0, 20),
      });
    }
    const conversation = (await ctx.db.get(input.conversationId))!;
    await ctx.db.patch(input.conversationId, {
      currentOfferId: offerId, state: readiness.ready ? "offer_ready" : "needs_attention", updatedAt: now,
    });
    // present_offer with only the band's own open points left is a question to the musician, not a dead end.
    const asksMusician = !readiness.ready &&
      (assessment.nextAction === "ask_musician" || (assessment.nextAction === "present_offer" && readiness.hardBlockers.length === 0));
    // A new offer assessment invalidates an unanswered round about the old
    // terms even when the new next step does not raise a replacement question.
    const oldQuestions = await ctx.db.query("decisions").withIndex("by_conversation_and_status", (q) =>
      q.eq("conversationId", conversation._id).eq("status", "open")).take(50);
    for (const decision of oldQuestions) if (decision.kind === "scout_question") {
      await ctx.db.patch(decision._id, { status: "superseded", updatedAt: now });
    }
    if (readiness.ready) {
      // Ein Angebot liegt vor: the Entscheidung appears in the Scout chat; the notification stays.
      await raiseDecision(ctx, {
        ownerId: input.ownerId, savedNeedId: conversation.savedNeedId, conversationId: conversation._id,
        kind: "offer_ready", question: OFFER_READY_QUESTION, detail: assessment.summary.slice(0, 1_500),
        options: OFFER_OPTIONS, refs: { offerId },
      });
    } else if (asksMusician) {
      // The question is formulated by one Scout round in the musician's chat thread.
      const decisionId = await raiseDecision(ctx, {
        ownerId: input.ownerId, savedNeedId: conversation.savedNeedId, conversationId: conversation._id,
        kind: "scout_question", question: "", options: [], refs: { offerId },
      });
      await ctx.scheduler.runAfter(0, internal.decisions.formulateQuestion, { decisionId });
    }
    if (!asksMusician) {
      await ctx.db.insert("notifications", {
        ownerId: input.ownerId, kind: "system", title: readiness.ready ? "A room offer is ready to review" : "Your Scout has assessed a provider update",
        body: assessment.summary.slice(0, 240), createdAt: now,
      });
    }
    // Interpretation updates private conversation state, never public listings
    // or musician memory. No outgoing message is sent from this mutation.
    return offerId;
  },
});

export const processEvent = internalAction({
  args: { eventId: v.id("providerTurns") }, returns: processResultValidator,
  handler: async (ctx, args) => {
    const input = await ctx.runMutation(internal.providerConversations.prepareTurn, args);
    if (!input?.promptMessageId) return { outcome: "stale" as const };
    let recorded = false;
    let stale = false;
    let validationAttempts = 0;
    let lastErrorCode: string | undefined;
    const recordProviderAssessment = createTool({
      description: "Record the complete evidence-backed private offer assessment and propose a next step. Never sends anything or grants approval.",
      inputSchema: providerAssessmentSchema,
      execute: async (_toolCtx, assessment) => {
        if (recorded) return { recorded: true, sent: false, alreadyRecorded: true };
        if (stale) return { recorded: false, sent: false, errorCode: "ASSESSMENT_CONTEXT_STALE", correctionRemaining: false };
        if (validationAttempts >= 2) {
          return { recorded: false, sent: false, errorCode: lastErrorCode ?? "SCOUT_ASSESSMENT_NOT_RECORDED", correctionRemaining: false };
        }
        validationAttempts++;
        try {
          validateProviderAssessment(assessment, input.evidence, input.need, input.clarificationScope);
        } catch (error) {
          const issue = providerAssessmentValidationIssue(error);
          if (!issue) throw error;
          lastErrorCode = issue.code;
          return {
            recorded: false, sent: false, errorCode: issue.code,
            fieldPath: issue.fieldPath, sourceId: issue.sourceId,
            correctionRemaining: validationAttempts < 2,
            repairGuidance: issue.code === "OFFER_EVIDENCE_NOT_CONTIGUOUS"
              ? "Replace this quote with one exact contiguous substring from the named source. Use separate citations for separate excerpts."
              : issue.code === "OFFER_EVIDENCE_SOURCE_NOT_FOUND"
                ? "Use only a sourceId supplied in provider_evidence."
                : "Correct the identified assessment field using only supplied evidence and constraint keys.",
          };
        }
        const id = await ctx.runMutation(internal.providerConversations.recordAssessment, {
          eventId: args.eventId, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment,
        });
        if (id === null) stale = true;
        recorded = id !== null;
        return { recorded, offerId: id, sent: false };
      },
    });
    try {
      await runScoutTurn(ctx, {
        ownerId: input.ownerId, threadId: input.threadId, origin: input.kind === "opportunity" ? "opportunity" : "provider",
        promptMessageId: input.promptMessageId, memoryQuery: `${input.need.title} ${input.need.requirements.join(" ")}`,
        caseCard: [providerCaseInstructions,
          `Canonical musician identity (trusted data): ${JSON.stringify(input.musicianIdentity)}`,
          providerAssessmentContextInstructions(input.providerContext),
          input.kind === "opportunity" ? "For the first provider inquiry, write only the specific unanswered question and useful body details. Do not add a greeting or introduction; the server adds the canonical transparent introduction." : "",
          `Current musician search (data): ${JSON.stringify(input.need)}`,
          `Required constraint keys: ${JSON.stringify(offerConstraints(input.need))}`,
          delimitUntrustedData("previous_private_assessment", JSON.stringify(input.previousAssessment)),
          delimitUntrustedData("provider_evidence", JSON.stringify(input.evidence)),
          input.recentOutboundMessages.length
            ? `RECENT OUTBOUND MESSAGES (context only): These are questions already sent to the provider. Use them to avoid repeating a question. They are not provider statements, not evidence, and must never support a confirmed fact.\n${delimitUntrustedData("outgoing_messages", JSON.stringify(input.recentOutboundMessages))}`
            : "",
          input.musicianStatements.length
            ? `TRUSTED MUSICIAN STATEMENT (oldest first, each answer applies only to the question and constraintKeys explicitly asked for this room. An accepted schedule never waives a drum restriction or another unanswered requirement. A negative answer keeps that conflict. These are not provider evidence and must not be cited as such): ${JSON.stringify(input.musicianStatements)}`
            : "",
        ].filter(Boolean).join("\n\n"),
        tools: { recordProviderAssessment },
        saveMessages: "none",
        prepareStep: () => ({
          toolChoice: recorded || stale || validationAttempts >= 2
            ? "none"
            : { type: "tool" as const, toolName: "recordProviderAssessment" },
        }),
      });
    } catch (error) {
      // Once both deterministic correction attempts were consumed, a failed
      // finalization must not replay the same semantic failure through Workpool.
      if (!lastErrorCode || validationAttempts < 2) throw error;
    }
    if (recorded) return { outcome: "recorded" as const };
    if (stale) return { outcome: "stale" as const };
    return {
      outcome: "validation_failed" as const,
      errorCode: lastErrorCode ?? "SCOUT_ASSESSMENT_NOT_RECORDED",
    };
  },
});

export const turnCompleted = internalMutation({
  args: vOnCompleteArgs(v.object({ eventId: v.id("providerTurns") }), v.union(processResultValidator, v.null())), returns: v.null(),
  handler: async (ctx, { context, result }) => {
    const event = await ctx.db.get(context.eventId);
    const conversation = event ? await ctx.db.get(event.conversationId) : null;
    if (!event || !conversation || conversation.activeEventId !== event._id) return null;
    if (conversation.state === "closed") {
      await ctx.db.patch(event._id, { status: "superseded", completedAt: Date.now() });
      await ctx.db.patch(conversation._id, { activeEventId: undefined });
      return null;
    }
    const need = await ctx.db.get(conversation.savedNeedId);
    const offer = event.offerId ? await ctx.db.get(event.offerId) : null;
    const processResult = result.kind === "success" ? result.returnValue : null;
    const obsolete = processResult?.outcome === "stale" || event.revision !== conversation.revision || need?.status !== "active" || (offer && offer.needRevision !== (need?.matchingRevision ?? 0));
    const status = obsolete ? "superseded" : offer ? "completed" : "failed";
    const initialNoFit = status === "completed" && event.kind === "opportunity" && offer !== null &&
      ["decline", "stop"].includes(offer.assessment.nextAction);
    const acknowledgedDecline = status === "completed" &&
      (event.kind === "mail_reply" || event.kind === "portal_reply") &&
      offer?.assessment.nextAction === "stop" &&
      await hasExecutedProviderDecline(ctx, conversation._id, offer._id);
    const terminal = initialNoFit || acknowledgedDecline;
    const errorCode = status === "failed"
      ? processResult?.outcome === "validation_failed"
        ? processResult.errorCode ?? "SCOUT_ASSESSMENT_VALIDATION_FAILED"
        : "SCOUT_ASSESSMENT_FAILED"
      : undefined;
    await ctx.db.patch(event._id, { status, errorCode, completedAt: Date.now() });
    await ctx.db.patch(conversation._id, {
      activeEventId: undefined,
      state: terminal ? "closed" : status === "completed" && offer?.ready ? "offer_ready" : "needs_attention",
      lastErrorCode: errorCode, updatedAt: Date.now(),
    });
    if (terminal && conversation.opportunityId) {
      const opportunity = await ctx.db.get(conversation.opportunityId);
      if (opportunity?.ownerId === conversation.ownerId && !["converted", "dismissed"].includes(opportunity.status)) {
        await ctx.db.patch(opportunity._id, { status: initialNoFit ? "expired" : "dismissed", updatedAt: Date.now() });
      }
    } else if (status === "completed" && offer?.assessment.suggestedReply) {
      await ctx.runMutation(internal.providerActions.stageReply, { offerId: offer._id });
    }
    await startNext(ctx, conversation._id);
    return null;
  },
});

/** The newest non-acceptance request for an offer; a dictated reply may share the offer with the Scout's draft. */
async function latestReplyRequest(ctx: QueryCtx, offerId: Id<"offerRevisions">): Promise<Doc<"actionRequests"> | null> {
  const rows = await ctx.db.query("actionRequests").withIndex("by_provider_offer", (q) => q.eq("providerOfferId", offerId)).order("desc").take(10);
  return rows.find((row) => row.providerActionKind !== "acceptance") ?? null;
}

export const listMine = query({
  args: {
    limit: v.optional(v.number()),
    savedNeedId: v.optional(v.id("savedNeeds")),
  },
  returns: v.array(v.object({
    conversationId: v.id("providerConversations"), savedNeedId: v.id("savedNeeds"), signalId: v.id("signals"),
    mailThreadId: v.optional(v.id("mailThreads")), platformThreadId: v.optional(v.id("platformThreads")),
    state: v.string(), revision: v.number(), updatedAt: v.number(), errorCode: v.optional(v.string()),
    assessmentFromProviderReply: v.boolean(),
    isDemo: v.boolean(),
    providerSimulation: v.optional(v.literal("ai_simulated")),
    imageUrl: v.optional(v.string()),
    replyStatus: v.optional(v.string()),
    acceptanceStatus: v.optional(v.string()), acceptanceRequestId: v.optional(v.id("actionRequests")),
    acceptedOfferId: v.optional(v.id("offerRevisions")), acceptedAt: v.optional(v.number()),
    offer: v.union(v.object({
      offerId: v.id("offerRevisions"), revision: v.number(), current: v.boolean(), ready: v.boolean(),
      contentHash: v.string(), assessment: providerAssessmentValidator, blockers: v.array(v.string()),
    }), v.null()),
  })),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = args.limit ?? 30;
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ConvexError({ code: "INVALID_LIMIT" });
    if (args.savedNeedId !== undefined) {
      const need = await ctx.db.get(args.savedNeedId);
      if (need?.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    const conversations = args.savedNeedId === undefined
      ? await ctx.db.query("providerConversations").withIndex("by_owner_and_updated_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(limit)
      : await ctx.db.query("providerConversations").withIndex("by_need_and_updated_at", (q) => q.eq("savedNeedId", args.savedNeedId!)).order("desc").take(limit);
    return await Promise.all(conversations.map(async (conversation) => {
      if (conversation.ownerId !== ownerId) return null;
      const [offer, need, signal, latestMessage] = await Promise.all([
        conversation.currentOfferId ? ctx.db.get(conversation.currentOfferId) : null,
        ctx.db.get(conversation.savedNeedId), ctx.db.get(conversation.signalId),
        conversation.platformThreadId
          ? ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) =>
            q.eq("threadId", conversation.platformThreadId!)).order("desc").first()
          : conversation.mailThreadId
            ? ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) =>
              q.eq("threadId", conversation.mailThreadId!)).order("desc").first()
            : null,
      ]);
      const assessmentEvent = offer ? await ctx.db.get(offer.eventId) : null;
      const current = !!offer && !conversation.activeEventId && conversation.state !== "closed" && need?.ownerId === ownerId && need.status === "active" &&
        offer.ownerId === ownerId && offer.revision === conversation.revision &&
        offer.needRevision === (need.matchingRevision ?? 0) && !!signal && ["published", "stale"].includes(signal.status) && offer.signalRevision === await signalMatchRevision(signal);
      const reply = offer ? await latestReplyRequest(ctx, offer._id) : null;
      const acceptance = conversation.acceptanceRequestId ? await ctx.db.get(conversation.acceptanceRequestId) : null;
      return {
        conversationId: conversation._id, savedNeedId: conversation.savedNeedId, signalId: conversation.signalId,
        mailThreadId: conversation.mailThreadId, platformThreadId: conversation.platformThreadId,
        state: conversation.state, revision: conversation.revision, updatedAt: conversation.updatedAt, errorCode: conversation.lastErrorCode,
        assessmentFromProviderReply:
          (assessmentEvent?.kind === "mail_reply" || assessmentEvent?.kind === "portal_reply") &&
          latestMessage?.direction === "inbound",
        isDemo: signal?.isDemo === true,
        providerSimulation: signal?.providerSimulation,
        imageUrl: signal?.imageUrl,
        replyStatus: reply?.ownerId === ownerId && reply.providerActionKind !== "acceptance" ? reply.status : undefined,
        acceptanceStatus: acceptance?.ownerId === ownerId
          ? acceptance.status === "executing" && ["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"].includes(acceptance.error ?? "")
            ? "unknown"
            : acceptance.status
          : undefined,
        acceptanceRequestId: conversation.acceptanceRequestId, acceptedOfferId: conversation.acceptedOfferId, acceptedAt: conversation.acceptedAt,
        offer: offer?.ownerId === ownerId ? {
          offerId: offer._id, revision: offer.revision, current, ready: current && offer.ready,
          contentHash: offer.contentHash, assessment: offer.assessment,
          blockers: current ? offer.blockers : ["The search, listing or provider conversation has changed. Reassessment is required.", ...offer.blockers],
        } : null,
      };
    })).then((rows) => rows.filter((row): row is NonNullable<typeof row> => row !== null));
  },
});

export const getProgressContext = internalQuery({
  args: {
    ownerId: v.id("users"),
    savedNeedId: v.optional(v.id("savedNeeds")),
    focusedSignalId: v.optional(v.id("signals")),
  }, returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    if (args.savedNeedId) {
      const need = await ctx.db.get(args.savedNeedId);
      if (need?.ownerId !== args.ownerId) return "";
    }
    const rows = args.savedNeedId
      ? await ctx.db.query("providerConversations").withIndex("by_need_and_updated_at", (q) => q.eq("savedNeedId", args.savedNeedId!)).order("desc").take(10)
      : await ctx.db.query("providerConversations").withIndex("by_owner_and_updated_at", (q) => q.eq("ownerId", args.ownerId)).order("desc").take(10);
    const scopedRows = args.focusedSignalId
      ? rows.filter((row) => row.signalId === args.focusedSignalId)
      : rows;
    const progress = await Promise.all(scopedRows.map(async (row) => {
      if (row.ownerId !== args.ownerId) return null;
      const [offer, need, signal, latestMessage, latestInbound] = await Promise.all([
        row.currentOfferId ? ctx.db.get(row.currentOfferId) : null, ctx.db.get(row.savedNeedId), ctx.db.get(row.signalId),
        row.platformThreadId
          ? ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) => q.eq("threadId", row.platformThreadId!)).order("desc").first()
          : row.mailThreadId
            ? ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) => q.eq("threadId", row.mailThreadId!)).order("desc").first()
            : null,
        row.platformThreadId
          ? ctx.db.query("platformMessages").withIndex("by_thread_and_direction_and_sent_at", (q) =>
            q.eq("threadId", row.platformThreadId!).eq("direction", "inbound")).order("desc").first()
          : row.mailThreadId
            ? ctx.db.query("mailMessages").withIndex("by_thread_and_direction_and_received_at", (q) =>
              q.eq("threadId", row.mailThreadId!).eq("direction", "inbound")).order("desc").first()
            : null,
      ]);
      const current = !!offer && !row.activeEventId && row.state !== "closed" && offer.ownerId === args.ownerId && need?.status === "active" &&
        offer.revision === row.revision && offer.needRevision === (need.matchingRevision ?? 0) &&
        !!signal && ["published", "stale"].includes(signal.status) && offer.signalRevision === await signalMatchRevision(signal);
      const reply = offer ? await latestReplyRequest(ctx, offer._id) : null;
      const acceptance = row.acceptanceRequestId ? await ctx.db.get(row.acceptanceRequestId) : null;
      const acceptanceStatus = row.acceptedOfferId && row.acceptedAt !== undefined
        ? "sent"
        : acceptance?.ownerId === args.ownerId && acceptance.providerActionKind === "acceptance"
          ? acceptance.status === "executing" && ["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"].includes(acceptance.error ?? "")
            ? "unknown_outcome"
            : acceptance.status
          : "not_requested";
      const assessmentEvent = offer ? await ctx.db.get(offer.eventId) : null;
      const latestMessageDirection = latestMessage?.direction === "inbound" || latestMessage?.direction === "outbound"
        ? latestMessage.direction
        : "unknown";
      const latestMessageAt = latestMessage
        ? "sentAt" in latestMessage ? latestMessage.sentAt : latestMessage.receivedAt
        : null;
      const latestProviderReplyAt = latestInbound
        ? "sentAt" in latestInbound ? latestInbound.sentAt : latestInbound.receivedAt
        : null;
      return {
        conversationId: row._id, signalId: row.signalId, state: row.state,
        focused: args.focusedSignalId === row.signalId,
        signalTitle: current && signal ? signal.title : null,
        signalSummary: current && signal ? signal.summary : null,
        currentAssessment: current ? offer.assessment.summary : null,
        currentAssessmentSource: assessmentEvent?.kind === "mail_reply" || assessmentEvent?.kind === "portal_reply"
          ? "provider_reply"
          : assessmentEvent?.kind === "musician_input" ? "musician_input" : "listing_or_opportunity",
        latestMessageDirection,
        latestMessageAt,
        latestProviderReplyAt,
        awaitingProviderReply: latestMessageDirection === "outbound",
        readyForReview: current && offer.ready,
        nextStep: row.acceptedOfferId && row.acceptedAt !== undefined ? "acceptance_message_sent_search_paused" : current ? offer.assessment.nextAction : "reassessment_needed",
        // A proposal is never evidence of a sent message.
        outboundMessageStatus: reply?.ownerId === args.ownerId && reply.providerActionKind !== "acceptance" ? reply.status : "not_drafted",
        acceptanceStatus,
      };
    }));
    return progress.length ? `${delimitUntrustedData("recent_provider_progress", JSON.stringify(progress.filter(Boolean)))}\nTRUSTED MESSAGE DIRECTION RULE: An outbound latest message is the musician/Scout asking the provider. When awaitingProviderReply is true, do not describe that outbound question or its assessment as a new provider reply. currentAssessmentSource says which event produced the assessment; an older provider assessment may remain visible while a newer outbound follow-up awaits an answer.\nTRUSTED ACCEPTANCE RULE: Treat sent only as confirmed when acceptanceStatus is sent. For unknown_outcome, tell the user delivery needs checking; never claim it was sent and never accept, resend, or retry it from chat.` : "";
  },
});
