/**
 * Nachrichten — the musician's own view of one Anbieter conversation: what the
 * Anbieter wrote, what the Scout sent on their behalf, what is still waiting
 * for a Freigabeprüfung, and the musician's own replies.
 *
 * Deep module: the surface is two queries (`listMine`, `getMine`) and two
 * mutations (`reply`, `markRead`). Everything else — channel resolution,
 * attribution of an outgoing message to the request that produced it, the
 * Entscheidung that must be answered instead of staging a fresh reply — stays
 * behind them. Staging itself is never duplicated here: `reply` goes through
 * `stageCustomReplyForOwner` (the one musician-reply path) or through
 * `answerDecision` when an Entscheidung about an outgoing message is open.
 */

import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import schema from "./schema";
import { requireUserId } from "./integrations/authz";
import { gateReasonText, type GateReason } from "./lib/autonomyGate";
import {
  decisionKindValidator, decisionPublic, decisionPublicValidator, MESSAGE_DECISION_KINDS,
} from "./lib/decisions";
import { providerAssessmentValidator } from "./lib/providerAssessment";
import { conversationProgress, conversationProgressValidator, conversationViewingValidator, messageOutcomeUnknown } from "./lib/conversationProgress";
import { candidateDisposition, candidateDispositionValidator, candidateExclusionReasonValidator } from "./lib/candidateDisposition";
import { signalMatchRevision } from "./lib/matchValidity";
import { failedAssessmentRetryEligibility } from "./providerConversations";
import { answerDecision } from "./decisions";
import { replyChannelReady, stageCustomReplyForOwner } from "./providerActions";

// ---------------------------------------------------------------------------
// Validators — derived from the schema instead of re-declared.
// ---------------------------------------------------------------------------

const conversationStateValidator = schema.tables.providerConversations.validator.fields.state;
const requestStatusValidator = schema.tables.actionRequests.validator.fields.status;
const mailDeliveryStatusValidator = schema.tables.mailMessages.validator.fields.deliveryStatus;

const channelValidator = v.union(v.literal("platform"), v.literal("mail"), v.literal("none"));
/** Who put a row on the surface: the Anbieter, the Scout, or the musician themselves. */
const previewAuthorValidator = v.union(v.literal("provider"), v.literal("scout"), v.literal("musician"));
const sentAuthorValidator = v.union(v.literal("scout"), v.literal("musician"), v.literal("acceptance"));
const composerReasonValidator = v.union(
  v.literal("thinking"), v.literal("closed"), v.literal("channel_not_ready"), v.literal("assessment_required"),
);

const pendingValidator = v.object({
  requestId: v.id("actionRequests"),
  status: requestStatusValidator,
  outcomeUnknown: v.optional(v.boolean()),
  author: v.union(v.literal("scout"), v.literal("musician")),
  gateReason: v.optional(v.string()),
  gateText: v.optional(v.string()),
});

const listRowValidator = v.object({
  conversationId: v.id("providerConversations"),
  savedNeedId: v.id("savedNeeds"),
  signalId: v.id("signals"),
  /** Listing title; empty when the listing is gone — the surface names the Anbieter then. */
  title: v.string(),
  subtitle: v.string(),
  channel: channelValidator,
  state: conversationStateValidator,
  progress: conversationProgressValidator,
  /** Present exactly when a viewing is arranged; the surfaces label the row with it. */
  viewing: v.optional(conversationViewingValidator),
  disposition: candidateDispositionValidator,
  exclusionReason: v.optional(candidateExclusionReasonValidator),
  hasProviderReply: v.boolean(),
  canRetryAssessment: v.boolean(),
  revision: v.number(),
  lastActivityAt: v.number(),
  lastReadAt: v.optional(v.number()),
  unread: v.boolean(),
  preview: v.optional(v.object({ author: previewAuthorValidator, text: v.string(), at: v.number() })),
  providerLabel: v.string(),
  openDecision: v.optional(v.object({
    decisionId: v.id("decisions"), kind: decisionKindValidator, question: v.string(),
  })),
  pending: v.optional(pendingValidator),
  offer: v.optional(v.object({ offerId: v.id("offerRevisions"), ready: v.boolean(), contentHash: v.string() })),
});

const itemValidator = v.union(
  v.object({
    kind: v.literal("provider_message"), id: v.string(), at: v.number(),
    label: v.string(), text: v.string(), subject: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("sent_message"), id: v.string(), at: v.number(), author: sentAuthorValidator,
    text: v.string(), subject: v.optional(v.string()), deliveryStatus: mailDeliveryStatusValidator,
  }),
  v.object({
    kind: v.literal("pending_message"), id: v.id("actionRequests"), at: v.number(), author: sentAuthorValidator,
    text: v.string(), subject: v.optional(v.string()), status: requestStatusValidator,
    outcomeUnknown: v.optional(v.boolean()),
    gateReason: v.optional(v.string()), gateText: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("scout_note"), id: v.id("offerRevisions"), at: v.number(),
    revision: v.number(), summary: v.string(), nextAction: v.string(),
  }),
  v.object({
    kind: v.literal("musician_input"), id: v.id("providerTurns"), at: v.number(), text: v.string(),
    decisionId: v.optional(v.id("decisions")),
  }),
  v.object({ kind: v.literal("decision"), id: v.id("decisions"), at: v.number(), decision: decisionPublicValidator }),
);

const headerValidator = v.object({
  conversationId: v.id("providerConversations"),
  savedNeedId: v.id("savedNeeds"),
  signalId: v.id("signals"),
  title: v.string(),
  subtitle: v.string(),
  channel: channelValidator,
  state: conversationStateValidator,
  progress: conversationProgressValidator,
  /** Present exactly when a viewing is arranged; the surfaces label the row with it. */
  viewing: v.optional(conversationViewingValidator),
  hasProviderReply: v.boolean(),
  canRetryAssessment: v.boolean(),
  providerLabel: v.string(),
  lastReadAt: v.optional(v.number()),
  offer: v.union(v.object({
    offerId: v.id("offerRevisions"), revision: v.number(), ready: v.boolean(), contentHash: v.string(),
    assessment: providerAssessmentValidator, blockers: v.array(v.string()),
  }), v.null()),
  composer: v.object({ enabled: v.boolean(), reason: v.optional(composerReasonValidator) }),
});

const replyResultValidator = v.object({
  requestId: v.id("actionRequests"),
  status: requestStatusValidator,
  /** True only when the request was handed to an executor; never evidence of delivery. */
  dispatched: v.boolean(),
  sent: v.literal(false),
  gateReason: v.optional(v.string()),
  decisionId: v.optional(v.id("decisions")),
});

// ---------------------------------------------------------------------------
// Shared reading helpers
// ---------------------------------------------------------------------------

const PREVIEW_LENGTH = 160;
const MESSAGE_LIMIT = 100;
const REQUEST_LIMIT = 50;
/** Requests that can no longer turn into an outgoing message. `failed` stays:
 * the musician must see that their text never went out. */
const TERMINAL_REQUEST_STATUS: ReadonlySet<Doc<"actionRequests">["status"]> =
  new Set(["executed", "rejected", "expired", "cancelled"]);
const MESSAGE_PAYLOAD_KINDS: ReadonlySet<Doc<"actionRequests">["payload"]["kind"]> =
  new Set(["platform_message", "email_message"]);

function collapse(text: string, limit: number): string {
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

/** "Anna Meier <anna@example.test>" → "Anna Meier"; a bare address stays itself. */
function mailFromLabel(from: string): string {
  const match = /^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$/.exec(from);
  const name = match?.[1]?.trim();
  return (name && name.length > 0 ? name : from.trim()).slice(0, 160);
}

function channelOf(conversation: Doc<"providerConversations">, requests: Doc<"actionRequests">[] = []): "platform" | "mail" | "none" {
  if (conversation.platformThreadId) return "platform";
  if (conversation.mailThreadId) return "mail";
  const request = requests.find(row => row.ownerId === conversation.ownerId && MESSAGE_PAYLOAD_KINDS.has(row.payload.kind));
  if (request?.payload.kind === "platform_message") return "platform";
  if (request?.payload.kind === "email_message") return "mail";
  return "none";
}

function gateOf(request: Doc<"actionRequests">): { gateReason?: string; gateText?: string } {
  const reason = request.gate?.reason;
  if (!reason) return {};
  const text = gateReasonText(reason as GateReason);
  return { gateReason: reason, ...(text ? { gateText: text } : {}) };
}

/** The payload text the musician would recognise: subject and body of the outgoing message. */
function requestBody(payload: Doc<"actionRequests">["payload"]): { text: string; subject?: string } {
  if (payload.kind === "email_message") return { text: payload.body, subject: payload.subject };
  if (payload.kind === "platform_message") {
    return { text: payload.body, ...(payload.subject ? { subject: payload.subject } : {}) };
  }
  return { text: "" };
}

/** Who dictated this request: the musician's own words, an Angebot acceptance, or the Scout. */
function requestAuthor(request: Doc<"actionRequests">): "scout" | "musician" | "acceptance" {
  if (request.humanDraft) return "musician";
  if (request.providerActionKind === "acceptance") return "acceptance";
  return "scout";
}

async function ownedConversation(
  ctx: QueryCtx, ownerId: Id<"users">, conversationId: Id<"providerConversations">,
): Promise<Doc<"providerConversations"> | null> {
  const conversation = await ctx.db.get(conversationId);
  return conversation && conversation.ownerId === ownerId ? conversation : null;
}

/** The conversation's requests, newest first. Bounded: the surface never pages them. */
async function conversationRequests(
  ctx: QueryCtx, conversationId: Id<"providerConversations">, limit: number,
): Promise<Doc<"actionRequests">[]> {
  return await ctx.db.query("actionRequests").withIndex("by_provider_conversation_and_updated_at", (q) =>
    q.eq("providerConversationId", conversationId),
  ).order("desc").take(limit);
}

async function openDecisionOf(
  ctx: QueryCtx, conversationId: Id<"providerConversations">,
): Promise<Doc<"decisions"> | null> {
  return await ctx.db.query("decisions").withIndex("by_conversation_and_status", (q) =>
    q.eq("conversationId", conversationId).eq("status", "open"),
  ).first();
}

/**
 * The composer's answer, in the order the musician experiences it: a closed
 * conversation first, then current work, missing channel and outdated assessment.
 */
async function composerState(ctx: QueryCtx, args: {
  conversation: Doc<"providerConversations">;
  offer: Doc<"offerRevisions"> | null;
  signal: Doc<"signals"> | null;
}): Promise<{ enabled: boolean; reason?: "thinking" | "closed" | "channel_not_ready" | "assessment_required" }> {
  const { conversation, offer, signal } = args;
  if (conversation.state === "closed") return { enabled: false, reason: "closed" };
  if (conversation.state === "thinking" || conversation.activeEventId) return { enabled: false, reason: "thinking" };
  if (channelOf(conversation) === "none") return { enabled: false, reason: "channel_not_ready" };
  if (!offer || offer.revision !== conversation.revision) return { enabled: false, reason: "assessment_required" };
  if (!signal) return { enabled: false, reason: "channel_not_ready" };
  // Queries must not read the wall clock; the conversation's own timestamp is
  // the newest deterministic moment this row knows about.
  const channel = await replyChannelReady(ctx, {
    conversation, signal, ownerId: conversation.ownerId, now: conversation.updatedAt,
  });
  if (channel.kind === "unavailable") return { enabled: false, reason: "channel_not_ready" };
  return { enabled: true };
}

async function progressFor(ctx: QueryCtx, conversation: Doc<"providerConversations">, requests: Doc<"actionRequests">[]) {
  const status = await conversationProgress(ctx, conversation, requests);
  const retry = conversation.opportunityId && status.progress === "assessment_failed"
    ? await failedAssessmentRetryEligibility(ctx, {
      ownerId: conversation.ownerId, savedNeedId: conversation.savedNeedId,
      signalId: conversation.signalId, opportunityId: conversation.opportunityId,
    }) : null;
  return { ...status, canRetryAssessment: retry?.eligible === true };
}

// ---------------------------------------------------------------------------
// listMine
// ---------------------------------------------------------------------------

export const listMine = query({
  args: { limit: v.optional(v.number()), savedNeedId: v.optional(v.id("savedNeeds")) },
  returns: v.array(listRowValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.floor(args.limit ?? 30);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ConvexError({ code: "INVALID_LIMIT" });
    if (args.savedNeedId) {
      const need = await ctx.db.get(args.savedNeedId);
      if (need?.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    const conversations = args.savedNeedId
      ? await ctx.db.query("providerConversations").withIndex("by_need_and_updated_at", q =>
        q.eq("savedNeedId", args.savedNeedId!)).order("desc").take(limit)
      : await ctx.db.query("providerConversations").withIndex("by_owner_and_updated_at", q =>
        q.eq("ownerId", ownerId)).order("desc").take(limit);

    const rows = await Promise.all(conversations.map(async (conversation) => {
      if (conversation.ownerId !== ownerId) return null;
      const [signal, offer, decision, requests, need, match] = await Promise.all([
        ctx.db.get(conversation.signalId),
        conversation.currentOfferId ? ctx.db.get(conversation.currentOfferId) : null,
        openDecisionOf(ctx, conversation._id),
        conversationRequests(ctx, conversation._id, 5),
        ctx.db.get(conversation.savedNeedId),
        ctx.db.query("signalMatches").withIndex("by_saved_need_and_signal", q =>
          q.eq("savedNeedId", conversation.savedNeedId).eq("signalId", conversation.signalId)).unique(),
      ]);
      const signalRevision = signal ? await signalMatchRevision(signal) : undefined;
      const currentOffer = offer?.ownerId === ownerId && offer.conversationId === conversation._id &&
        !conversation.activeEventId && offer.revision === conversation.revision && need?.ownerId === ownerId &&
        offer.needRevision === (need.matchingRevision ?? 0) && signalRevision === offer.signalRevision;
      const indexedAboveBudget = match?.ownerId === ownerId && match.status !== "dismissed" &&
        match.eligibility === "near_budget" && match.needRevision === (need?.matchingRevision ?? 0) &&
        signalRevision === match.signalRevision;

      // Exactly one message body per row: the newest one, for the preview.
      const newest = conversation.platformThreadId
        ? await ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) =>
          q.eq("threadId", conversation.platformThreadId!)).order("desc").first()
        : conversation.mailThreadId
          ? await ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) =>
            q.eq("threadId", conversation.mailThreadId!)).order("desc").first()
          : null;

      let providerLabel = "";
      let preview: { author: "provider" | "scout" | "musician"; text: string; at: number } | undefined;
      if (newest !== null && "bodyText" in newest) {
        const inbound = newest.direction !== "outbound";
        if (inbound) providerLabel = (newest.senderLabel ?? "").slice(0, 160);
        preview = {
          // Outgoing rows are attributed by body: the request ledger of this
          // row is already loaded, so no extra read is needed for a preview.
          author: inbound ? "provider" : outboundPreviewAuthor(requests, newest.bodyText),
          text: collapse(newest.bodyText, PREVIEW_LENGTH), at: newest.sentAt,
        };
      } else if (newest !== null) {
        const inbound = newest.direction === "inbound";
        if (inbound) providerLabel = mailFromLabel(newest.from);
        preview = {
          author: inbound ? "provider" : outboundPreviewAuthor(requests, newest.body),
          text: collapse(newest.parsedSummary ?? newest.body, PREVIEW_LENGTH), at: newest.receivedAt,
        };
      }
      if (!providerLabel && conversation.platformThreadId) {
        const thread = await ctx.db.get(conversation.platformThreadId);
        providerLabel = (thread?.participants[0] ?? "").slice(0, 160);
      }

      const pendingRequest = requests.find((request) =>
        request.ownerId === ownerId && request.providerActionKind !== "acceptance" &&
        MESSAGE_PAYLOAD_KINDS.has(request.payload.kind) && !TERMINAL_REQUEST_STATUS.has(request.status));
      const lastActivityAt = Math.max(conversation.updatedAt, preview?.at ?? 0);

      return {
        conversationId: conversation._id,
        savedNeedId: conversation.savedNeedId,
        signalId: conversation.signalId,
        title: signal?.title ?? "",
        subtitle: signal?.city ?? "",
        channel: channelOf(conversation, requests),
        state: conversation.state,
        ...candidateDisposition({ closed: conversation.state === "closed", assessment: currentOffer ? offer.assessment : undefined,
          maxBudgetEur: need?.maxBudgetEur, indexedAboveBudget }),
        ...await progressFor(ctx, conversation, requests),
        revision: conversation.revision,
        lastActivityAt,
        ...(conversation.lastReadAt !== undefined ? { lastReadAt: conversation.lastReadAt } : {}),
        unread: lastActivityAt > (conversation.lastReadAt ?? 0),
        ...(preview ? { preview } : {}),
        providerLabel,
        ...(decision && decision.ownerId === ownerId
          ? { openDecision: { decisionId: decision._id, kind: decision.kind, question: decision.question } }
          : {}),
        ...(pendingRequest
          ? {
            pending: {
              requestId: pendingRequest._id, status: pendingRequest.status,
              ...(messageOutcomeUnknown(pendingRequest) ? { outcomeUnknown: true } : {}),
              author: pendingRequest.humanDraft ? ("musician" as const) : ("scout" as const),
              ...gateOf(pendingRequest),
            },
          }
          : {}),
        ...(offer && offer.ownerId === ownerId
          ? {
            offer: {
              offerId: offer._id,
              ready: offer.ready && offer.revision === conversation.revision && conversation.state !== "closed",
              contentHash: offer.contentHash,
            },
          }
          : {}),
      };
    }));
    return rows.filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => right.lastActivityAt - left.lastActivityAt);
  },
});

/** A sent row is the musician's own when one of this conversation's dictated requests carries the same text. */
function outboundPreviewAuthor(requests: Doc<"actionRequests">[], body: string): "scout" | "musician" {
  const text = body.replace(/\s+/g, " ").trim();
  const dictated = requests.some((request) =>
    request.humanDraft === true && requestBody(request.payload).text.replace(/\s+/g, " ").trim() === text);
  return dictated ? "musician" : "scout";
}

// ---------------------------------------------------------------------------
// getMine
// ---------------------------------------------------------------------------

type Item =
  | { kind: "provider_message"; id: string; at: number; label: string; text: string; subject?: string }
  | {
    kind: "sent_message"; id: string; at: number; author: "scout" | "musician" | "acceptance";
    text: string; subject?: string; deliveryStatus?: Doc<"mailMessages">["deliveryStatus"];
  }
  | {
    kind: "pending_message"; id: Id<"actionRequests">; at: number; author: "scout" | "musician" | "acceptance";
    text: string; subject?: string; status: Doc<"actionRequests">["status"]; gateReason?: string; gateText?: string;
    outcomeUnknown?: boolean;
  }
  | { kind: "scout_note"; id: Id<"offerRevisions">; at: number; revision: number; summary: string; nextAction: string }
  | { kind: "musician_input"; id: Id<"providerTurns">; at: number; text: string; decisionId?: Id<"decisions"> }
  | { kind: "decision"; id: Id<"decisions">; at: number; decision: ReturnType<typeof decisionPublic> };

/**
 * Which request produced which outgoing message. `actionExecutions` is the
 * only link between the ledger and the message the Anbieter received, so an
 * unattributed outgoing row is the Scout's by default — never the musician's.
 */
async function attributionByProviderMessageId(
  ctx: QueryCtx, requests: Doc<"actionRequests">[],
): Promise<Map<string, "scout" | "musician" | "acceptance">> {
  const attribution = new Map<string, "scout" | "musician" | "acceptance">();
  const dispatched = requests.filter((request) => ["executed", "executing", "failed"].includes(request.status));
  await Promise.all(dispatched.map(async (request) => {
    const executions = await ctx.db.query("actionExecutions").withIndex("by_request", (q) =>
      q.eq("requestId", request._id)).take(5);
    for (const execution of executions) {
      if (execution.providerMessageId) attribution.set(execution.providerMessageId, requestAuthor(request));
    }
  }));
  return attribution;
}

export const getMine = query({
  args: { conversationId: v.id("providerConversations") },
  returns: v.union(v.object({ header: headerValidator, items: v.array(itemValidator) }), v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const conversation = await ownedConversation(ctx, ownerId, args.conversationId);
    if (!conversation) return null;

    const [signal, offer, requests, notes, inputs, openDecisions, answeredDecisions] = await Promise.all([
      ctx.db.get(conversation.signalId),
      conversation.currentOfferId ? ctx.db.get(conversation.currentOfferId) : null,
      conversationRequests(ctx, conversation._id, REQUEST_LIMIT),
      ctx.db.query("offerRevisions").withIndex("by_conversation_and_revision", (q) =>
        q.eq("conversationId", conversation._id)).take(REQUEST_LIMIT),
      ctx.db.query("providerTurns").withIndex("by_conversation_and_kind_and_revision", (q) =>
        q.eq("conversationId", conversation._id).eq("kind", "musician_input")).take(REQUEST_LIMIT),
      ctx.db.query("decisions").withIndex("by_conversation_and_status", (q) =>
        q.eq("conversationId", conversation._id).eq("status", "open")).take(20),
      ctx.db.query("decisions").withIndex("by_conversation_and_status", (q) =>
        q.eq("conversationId", conversation._id).eq("status", "answered")).take(20),
    ]);

    const attribution = await attributionByProviderMessageId(ctx, requests);
    const items: Item[] = [];
    let providerLabel = "";

    if (conversation.platformThreadId) {
      const messages = await ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) =>
        q.eq("threadId", conversation.platformThreadId!)).order("desc").take(MESSAGE_LIMIT);
      for (const message of messages) {
        if (message.ownerId !== ownerId) continue;
        // `unknown` comes from read-only reconnaissance: it is not ours to claim.
        if (message.direction === "outbound") {
          items.push({
            kind: "sent_message", id: message._id, at: message.sentAt,
            author: attribution.get(message.providerMessageId) ?? "scout", text: message.bodyText,
          });
        } else {
          providerLabel = (message.senderLabel ?? providerLabel).slice(0, 160);
          items.push({
            kind: "provider_message", id: message._id, at: message.sentAt,
            label: (message.senderLabel ?? "").slice(0, 160), text: message.bodyText,
          });
        }
      }
      if (!providerLabel) {
        const thread = await ctx.db.get(conversation.platformThreadId);
        providerLabel = (thread?.participants[0] ?? "").slice(0, 160);
      }
    } else if (conversation.mailThreadId) {
      const messages = await ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) =>
        q.eq("threadId", conversation.mailThreadId!)).order("desc").take(MESSAGE_LIMIT);
      for (const message of messages) {
        if (message.direction === "outbound") {
          items.push({
            kind: "sent_message", id: message._id, at: message.receivedAt,
            author: attribution.get(message.providerMessageId) ?? "scout",
            text: message.body, subject: message.subject,
            ...(message.deliveryStatus !== undefined ? { deliveryStatus: message.deliveryStatus } : {}),
          });
        } else {
          providerLabel = mailFromLabel(message.from);
          items.push({
            kind: "provider_message", id: message._id, at: message.receivedAt,
            label: mailFromLabel(message.from), text: message.body, subject: message.subject,
          });
        }
      }
    }

    for (const request of requests) {
      if (request.ownerId !== ownerId) continue;
      if (!MESSAGE_PAYLOAD_KINDS.has(request.payload.kind)) continue;
      if (TERMINAL_REQUEST_STATUS.has(request.status)) continue;
      const { text, subject } = requestBody(request.payload);
      if (!text) continue;
      items.push({
        kind: "pending_message", id: request._id, at: request.updatedAt, author: requestAuthor(request),
        text, ...(subject ? { subject } : {}), status: request.status, ...gateOf(request),
        ...(messageOutcomeUnknown(request) ? { outcomeUnknown: true } : {}),
      });
    }

    for (const note of notes) {
      if (note.ownerId !== ownerId) continue;
      items.push({
        kind: "scout_note", id: note._id, at: note.createdAt, revision: note.revision,
        summary: note.assessment.summary, nextAction: note.assessment.nextAction,
      });
    }

    for (const turn of inputs) {
      if (!turn.input) continue;
      items.push({
        kind: "musician_input", id: turn._id, at: turn.createdAt, text: turn.input,
        ...(turn.decisionId !== undefined ? { decisionId: turn.decisionId } : {}),
      });
    }

    for (const decision of [...openDecisions, ...answeredDecisions]) {
      if (decision.ownerId !== ownerId) continue;
      items.push({ kind: "decision", id: decision._id, at: decision.createdAt, decision: decisionPublic(decision) });
    }

    items.sort((left, right) => left.at - right.at);

    return {
      header: {
        conversationId: conversation._id,
        savedNeedId: conversation.savedNeedId,
        signalId: conversation.signalId,
        title: signal?.title ?? "",
        subtitle: signal?.city ?? "",
        channel: channelOf(conversation, requests),
        state: conversation.state,
        ...await progressFor(ctx, conversation, requests),
        providerLabel,
        ...(conversation.lastReadAt !== undefined ? { lastReadAt: conversation.lastReadAt } : {}),
        offer: offer && offer.ownerId === ownerId
          ? {
            offerId: offer._id, revision: offer.revision,
            ready: offer.ready && offer.revision === conversation.revision && conversation.state !== "closed",
            contentHash: offer.contentHash, assessment: offer.assessment, blockers: offer.blockers,
          }
          : null,
        composer: await composerState(ctx, { conversation, offer, signal }),
      },
      items,
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export const reply = mutation({
  args: { conversationId: v.id("providerConversations"), body: v.string() },
  returns: replyResultValidator,
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.ownerId !== ownerId) throw new ConvexError({ code: "CONVERSATION_NOT_FOUND" });
    const body = args.body.trim();
    if (body.length < 1 || body.length > 20_000) throw new ConvexError({ code: "INVALID_REPLY_BODY" });

    // An open Entscheidung about an outgoing message owns this conversation's
    // next word: the musician's text answers it (the Scout's draft is rejected
    // first) instead of queueing a second message next to it.
    const open = await ctx.db.query("decisions").withIndex("by_conversation_and_status", (q) =>
      q.eq("conversationId", args.conversationId).eq("status", "open"),
    ).take(5);
    const messageDecision = open.find((row) => row.ownerId === ownerId && MESSAGE_DECISION_KINDS.has(row.kind));

    const staged = messageDecision
      ? await answerDecision(ctx, { ownerId, decisionId: messageDecision._id, choice: "custom", text: body, dictated: true })
      : await stageCustomReplyForOwner(ctx, { ownerId, conversationId: args.conversationId, body });
    const requestId = staged.requestId;
    if (!requestId) throw new ConvexError({ code: "REPLY_CHANNEL_NOT_READY" });
    const request = await ctx.db.get(requestId);
    const status = request?.status ?? "drafted";
    return {
      requestId, status, dispatched: staged.dispatched ?? false, sent: false as const,
      // The musician must learn why their own text is waiting instead of going out.
      ...(["awaiting_approval", "blocked"].includes(status) && request?.gate?.reason
        ? { gateReason: request.gate.reason }
        : {}),
      ...(messageDecision ? { decisionId: messageDecision._id } : {}),
    };
  },
});

export const markRead = mutation({
  args: { conversationId: v.id("providerConversations") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.ownerId !== ownerId) return null;
    await ctx.db.patch(conversation._id, { lastReadAt: Date.now() });
    return null;
  },
});
