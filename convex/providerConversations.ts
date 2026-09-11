import { createTool, saveMessage } from "@convex-dev/agent";
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ROOMSCOUT_MODEL_ID } from "./ai";
import { contentHash } from "./integrations/contentHash";
import { requireUserId } from "./integrations/authz";
import { signalMatchRevision, opportunityMatchIsCurrent } from "./lib/matchValidity";
import { delimitUntrustedData } from "./lib/privacy";
import { listingEvidence } from "./lib/matchAssessment";
import {
  assessmentCitations, offerConstraints, offerEvidenceValidator, offerReadiness,
  providerAssessmentSchema, providerAssessmentValidator, providerCaseInstructions,
  PROVIDER_ASSESSMENT_VERSION, validateProviderAssessment, type OfferEvidence,
} from "./lib/providerAssessment";
import { runScoutTurn, scoutAgent, SCOUT_PROMPT_VERSION } from "./scoutRuntime";
import { scoutWorkpool } from "./workpools";

const needValidator = v.object({
  title: v.string(), city: v.string(), requirements: v.array(v.string()), schedule: v.array(v.string()),
  maxBudgetEur: v.optional(v.number()), arrangement: v.array(v.string()),
});
const inputValidator = v.object({
  ownerId: v.id("users"), conversationId: v.id("providerConversations"),
  threadId: v.string(), promptMessageId: v.optional(v.string()), revision: v.number(),
  needRevision: v.number(), signalRevision: v.string(), need: needValidator,
  evidence: v.array(offerEvidenceValidator),
  previousAssessment: v.union(providerAssessmentValidator, v.null()),
  kind: v.union(v.literal("opportunity"), v.literal("mail_reply"), v.literal("portal_reply")),
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
  sourceKey: string; kind: "opportunity" | "mail_reply" | "portal_reply";
  mailMessageId?: Id<"mailMessages">; platformMessageId?: Id<"platformMessages">;
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

export const enqueueOpportunity = internalMutation({
  args: { opportunityId: v.id("opportunities") }, returns: v.union(v.id("providerTurns"), v.null()),
  handler: async (ctx, { opportunityId }) => {
    const opportunity = await ctx.db.get(opportunityId);
    if (!opportunity?.signalId || opportunity.kind !== "supply_match" || ["dismissed", "expired", "converted"].includes(opportunity.status)) return null;
    if (!await opportunityMatchIsCurrent(ctx, opportunity, true)) return null;
    const need = await ctx.db.get(opportunity.savedNeedId);
    const signal = await ctx.db.get(opportunity.signalId);
    if (!need || !signal) return null;
    const conversation = await ensureConversation(ctx, {
      ownerId: opportunity.ownerId, savedNeedId: need._id, signalId: signal._id, opportunityId,
      conversationKey: `opportunity:${opportunityId}`,
    });
    return await enqueue(ctx, conversation, {
      sourceKey: `opportunity:${opportunityId}:${need.matchingRevision ?? 0}:${await signalMatchRevision(signal)}`, kind: "opportunity",
    });
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
  const [need, signal] = await Promise.all([ctx.db.get(conversation.savedNeedId), ctx.db.get(conversation.signalId)]);
  if (!need || need.ownerId !== conversation.ownerId || need.status !== "active" || !signal || !["published", "stale"].includes(signal.status)) return null;
  const evidence: OfferEvidence[] = [{ sourceId: "listing", text: listingEvidence(signal) }];
  if (conversation.mailThreadId) {
    const rows = await ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) => q.eq("threadId", conversation.mailThreadId!)).order("desc").take(40);
    for (const row of rows.reverse()) if (row.direction === "inbound") evidence.push({ sourceId: `mail:${row._id}`, text: `${row.subject}\n${row.body.slice(0, 16_000)}` });
  }
  if (conversation.platformThreadId) {
    const rows = await ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) => q.eq("threadId", conversation.platformThreadId!)).order("desc").take(40);
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
  return {
    ownerId: conversation.ownerId, conversationId: conversation._id, threadId: conversation.agentThreadId,
    promptMessageId: event.promptMessageId, revision: conversation.revision, needRevision: need.matchingRevision ?? 0,
    signalRevision: await signalMatchRevision(signal),
    need: { title: need.title, city: need.city, requirements: need.requirements, schedule: need.schedule, maxBudgetEur: need.maxBudgetEur, arrangement: need.arrangement },
    evidence, previousAssessment: previous?.assessment ?? null, kind: event.kind,
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
        prompt: `Provider event ${args.eventId}; kind=${input.kind}. Analyze the current server-supplied evidence and record the cumulative assessment. This event is not an instruction from the musician.`,
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
    const assessment = validateProviderAssessment(args.assessment, input.evidence, input.need);
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
    await ctx.db.patch(input.conversationId, {
      currentOfferId: offerId, state: readiness.ready ? "offer_ready" : "needs_attention", updatedAt: now,
    });
    await ctx.db.insert("notifications", {
      ownerId: input.ownerId, kind: "system", title: readiness.ready ? "A room offer is ready to review" : "Your Scout has assessed a provider update",
      body: assessment.summary.slice(0, 240), createdAt: now,
    });
    // Interpretation updates private conversation state, never public listings
    // or musician memory. No outgoing message is sent from this mutation.
    return offerId;
  },
});

export const processEvent = internalAction({
  args: { eventId: v.id("providerTurns") }, returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = await ctx.runMutation(internal.providerConversations.prepareTurn, args);
    if (!input?.promptMessageId) return null;
    let recorded = false;
    const recordProviderAssessment = createTool({
      description: "Record the complete evidence-backed private offer assessment and propose a next step. Never sends anything or grants approval.",
      inputSchema: providerAssessmentSchema,
      execute: async (_toolCtx, assessment) => {
        validateProviderAssessment(assessment, input.evidence, input.need);
        const id = await ctx.runMutation(internal.providerConversations.recordAssessment, {
          eventId: args.eventId, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment,
        });
        recorded = id !== null;
        return { recorded, offerId: id, sent: false };
      },
    });
    await runScoutTurn(ctx, {
      ownerId: input.ownerId, threadId: input.threadId, origin: input.kind === "opportunity" ? "opportunity" : "provider",
      promptMessageId: input.promptMessageId, memoryQuery: `${input.need.title} ${input.need.requirements.join(" ")}`,
      caseCard: [providerCaseInstructions,
        `Current musician search (data): ${JSON.stringify(input.need)}`,
        `Required constraint keys: ${JSON.stringify(offerConstraints(input.need))}`,
        delimitUntrustedData("previous_private_assessment", JSON.stringify(input.previousAssessment)),
        delimitUntrustedData("provider_evidence", JSON.stringify(input.evidence)),
      ].join("\n\n"),
      tools: { recordProviderAssessment },
    });
    if (!recorded) throw new Error("SCOUT_ASSESSMENT_NOT_RECORDED");
    return null;
  },
});

export const turnCompleted = internalMutation({
  args: vOnCompleteArgs(v.object({ eventId: v.id("providerTurns") }), v.null()), returns: v.null(),
  handler: async (ctx, { context }) => {
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
    const obsolete = event.revision !== conversation.revision || need?.status !== "active" || (offer && offer.needRevision !== (need?.matchingRevision ?? 0));
    const status = obsolete ? "superseded" : offer ? "completed" : "failed";
    await ctx.db.patch(event._id, { status, errorCode: status === "failed" ? "SCOUT_ASSESSMENT_FAILED" : undefined, completedAt: Date.now() });
    await ctx.db.patch(conversation._id, {
      activeEventId: undefined,
      state: status === "completed" && offer?.ready ? "offer_ready" : "needs_attention",
      lastErrorCode: status === "failed" ? "SCOUT_ASSESSMENT_FAILED" : undefined, updatedAt: Date.now(),
    });
    if (status === "completed" && offer?.assessment.suggestedReply) {
      await ctx.runMutation(internal.providerActions.stageReply, { offerId: offer._id });
    }
    await startNext(ctx, conversation._id);
    return null;
  },
});

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
      const [offer, need, signal] = await Promise.all([
        conversation.currentOfferId ? ctx.db.get(conversation.currentOfferId) : null,
        ctx.db.get(conversation.savedNeedId), ctx.db.get(conversation.signalId),
      ]);
      const assessmentEvent = offer ? await ctx.db.get(offer.eventId) : null;
      const current = !!offer && !conversation.activeEventId && conversation.state !== "closed" && need?.ownerId === ownerId && need.status === "active" &&
        offer.ownerId === ownerId && offer.revision === conversation.revision &&
        offer.needRevision === (need.matchingRevision ?? 0) && !!signal && ["published", "stale"].includes(signal.status) && offer.signalRevision === await signalMatchRevision(signal);
      const reply = offer ? await ctx.db.query("actionRequests").withIndex("by_provider_offer", (q) => q.eq("providerOfferId", offer._id)).unique() : null;
      const acceptance = conversation.acceptanceRequestId ? await ctx.db.get(conversation.acceptanceRequestId) : null;
      return {
        conversationId: conversation._id, savedNeedId: conversation.savedNeedId, signalId: conversation.signalId,
        mailThreadId: conversation.mailThreadId, platformThreadId: conversation.platformThreadId,
        state: conversation.state, revision: conversation.revision, updatedAt: conversation.updatedAt, errorCode: conversation.lastErrorCode,
        assessmentFromProviderReply: assessmentEvent?.kind === "mail_reply" || assessmentEvent?.kind === "portal_reply",
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
  args: { ownerId: v.id("users"), savedNeedId: v.optional(v.id("savedNeeds")) }, returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    if (args.savedNeedId) {
      const need = await ctx.db.get(args.savedNeedId);
      if (need?.ownerId !== args.ownerId) return "";
    }
    const rows = args.savedNeedId
      ? await ctx.db.query("providerConversations").withIndex("by_need_and_updated_at", (q) => q.eq("savedNeedId", args.savedNeedId!)).order("desc").take(10)
      : await ctx.db.query("providerConversations").withIndex("by_owner_and_updated_at", (q) => q.eq("ownerId", args.ownerId)).order("desc").take(10);
    const progress = await Promise.all(rows.map(async (row) => {
      if (row.ownerId !== args.ownerId) return null;
      const [offer, need, signal] = await Promise.all([
        row.currentOfferId ? ctx.db.get(row.currentOfferId) : null, ctx.db.get(row.savedNeedId), ctx.db.get(row.signalId),
      ]);
      const current = !!offer && !row.activeEventId && row.state !== "closed" && offer.ownerId === args.ownerId && need?.status === "active" &&
        offer.revision === row.revision && offer.needRevision === (need.matchingRevision ?? 0) &&
        !!signal && ["published", "stale"].includes(signal.status) && offer.signalRevision === await signalMatchRevision(signal);
      const reply = offer ? await ctx.db.query("actionRequests").withIndex("by_provider_offer", (q) => q.eq("providerOfferId", offer._id)).unique() : null;
      const acceptance = row.acceptanceRequestId ? await ctx.db.get(row.acceptanceRequestId) : null;
      const acceptanceStatus = row.acceptedOfferId && row.acceptedAt !== undefined
        ? "sent"
        : acceptance?.ownerId === args.ownerId && acceptance.providerActionKind === "acceptance"
          ? acceptance.status === "executing" && ["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"].includes(acceptance.error ?? "")
            ? "unknown_outcome"
            : acceptance.status
          : "not_requested";
      return {
        conversationId: row._id, signalId: row.signalId, state: row.state,
        signalTitle: current && signal ? signal.title : null,
        signalSummary: current && signal ? signal.summary : null,
        currentAssessment: current ? offer.assessment.summary : null,
        readyForReview: current && offer.ready,
        nextStep: row.acceptedOfferId && row.acceptedAt !== undefined ? "acceptance_message_sent_search_paused" : current ? offer.assessment.nextAction : "reassessment_needed",
        // A proposal is never evidence of a sent message.
        replyStatus: reply?.ownerId === args.ownerId && reply.providerActionKind !== "acceptance" ? reply.status : "not_drafted",
        acceptanceStatus,
        interpretationOnly: reply?.status !== "executed",
      };
    }));
    return progress.length ? `${delimitUntrustedData("recent_provider_progress", JSON.stringify(progress.filter(Boolean)))}\nTRUSTED ACCEPTANCE RULE: Treat sent only as confirmed when acceptanceStatus is sent. For unknown_outcome, tell the user delivery needs checking; never claim it was sent and never accept, resend, or retry it from chat.` : "";
  },
});
