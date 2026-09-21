import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const conversationProgressValidator = v.union(
  v.literal("checking"), v.literal("preparing_inquiry"), v.literal("assessment_failed"),
  v.literal("inquiry_sent"), v.literal("reply_received"), v.literal("reviewing_reply"),
  v.literal("needs_attention"), v.literal("viewing_arranged"), v.literal("closed"),
);

/** The arranged slot in Berlin wall-clock time, surfaced next to the progress value. */
export const conversationViewingValidator = v.object({ date: v.string(), time: v.string() });

const PROVIDER_REPLY_EXCERPT_CHARS = 400;

/** Whitespace-normalised, capped provider text; the caller wraps it as untrusted data. */
export function providerReplyExcerpt(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, PROVIDER_REPLY_EXCERPT_CHARS);
}

/**
 * The provider's own latest words for "what did they say", separate from
 * conversationProgress() whose shape is pinned by the listMine returns validator.
 */
export async function latestProviderReplyExcerpt(ctx: QueryCtx, conversation: Doc<"providerConversations">): Promise<string | null> {
  const inbound = conversation.platformThreadId
    ? await ctx.db.query("platformMessages").withIndex("by_thread_and_direction_and_sent_at", q =>
      q.eq("threadId", conversation.platformThreadId!).eq("direction", "inbound")).order("desc").first()
    : conversation.mailThreadId
      ? await ctx.db.query("mailMessages").withIndex("by_thread_and_direction_and_received_at", q =>
        q.eq("threadId", conversation.mailThreadId!).eq("direction", "inbound")).order("desc").first()
      : null;
  if (!inbound) return null;
  return providerReplyExcerpt("bodyText" in inbound ? inbound.bodyText : inbound.body);
}

export function messageOutcomeUnknown(request: Pick<Doc<"actionRequests">, "status" | "error">): boolean {
  return request.status === "executing" &&
    ["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"].includes(request.error ?? "");
}

/**
 * Read actual inbound messages: needs_attention also covers failures before
 * first contact. An arranged viewing is the goal state of a run, so it
 * outranks every other in-flight label while the conversation stays open.
 */
export async function conversationProgress(ctx: QueryCtx, conversation: Doc<"providerConversations">,
  requests: Doc<"actionRequests">[]) {
  const arranged = await ctx.db.query("viewings").withIndex("by_conversation", (q) =>
    q.eq("conversationId", conversation._id)).first();
  const viewing = arranged && arranged.ownerId === conversation.ownerId
    ? { date: arranged.date, time: arranged.time }
    : null;
  const [inbound, outbound] = conversation.platformThreadId
    ? await Promise.all([
      ctx.db.query("platformMessages").withIndex("by_thread_and_direction_and_sent_at", q =>
        q.eq("threadId", conversation.platformThreadId!).eq("direction", "inbound")).order("desc").first(),
      ctx.db.query("platformMessages").withIndex("by_thread_and_direction_and_sent_at", q =>
        q.eq("threadId", conversation.platformThreadId!).eq("direction", "outbound")).order("desc").first(),
    ])
    : conversation.mailThreadId
      ? await Promise.all([
        ctx.db.query("mailMessages").withIndex("by_thread_and_direction_and_received_at", q =>
          q.eq("threadId", conversation.mailThreadId!).eq("direction", "inbound")).order("desc").first(),
        ctx.db.query("mailMessages").withIndex("by_thread_and_direction_and_received_at", q =>
          q.eq("threadId", conversation.mailThreadId!).eq("direction", "outbound")).order("desc").first(),
      ])
      : [null, null];
  const hasProviderReply = inbound !== null;
  const inboundAt = inbound && ("sentAt" in inbound ? inbound.sentAt : inbound.receivedAt);
  const outboundAt = outbound && ("sentAt" in outbound ? outbound.sentAt : outbound.receivedAt);
  const awaitingProviderReply = outboundAt !== null && (inboundAt === null || outboundAt > inboundAt);
  const active = conversation.activeEventId ? await ctx.db.get(conversation.activeEventId) : null;
  const evaluatingReply = active?.kind === "mail_reply" || active?.kind === "portal_reply";
  const messageRequests = requests.filter(r => r.payload.kind === "platform_message" || r.payload.kind === "email_message");
  const progress = conversation.state === "closed" ? "closed" as const
    : viewing ? "viewing_arranged" as const
    : conversation.lastErrorCode ? "assessment_failed" as const
    : active || conversation.state === "thinking"
      ? hasProviderReply && evaluatingReply ? "reviewing_reply" as const : "checking" as const
    : messageRequests.some(r => messageOutcomeUnknown(r) || r.status === "failed" || r.status === "blocked" || r.status === "awaiting_approval")
      ? "needs_attention" as const
    : messageRequests.some(r => ["queued", "approved", "executing"].includes(r.status))
      ? "preparing_inquiry" as const
    : hasProviderReply && !awaitingProviderReply ? "reply_received" as const
    : messageRequests.some(r => r.status === "executed") ? "inquiry_sent" as const
    : conversation.currentOfferId ? "needs_attention" as const : "checking" as const;
  return { progress, hasProviderReply, ...(viewing ? { viewing } : {}) };
}
