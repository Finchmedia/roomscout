import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export const conversationProgressValidator = v.union(
  v.literal("checking"), v.literal("preparing_inquiry"), v.literal("assessment_failed"),
  v.literal("inquiry_sent"), v.literal("reply_received"), v.literal("reviewing_reply"),
  v.literal("needs_attention"), v.literal("closed"),
);

export function messageOutcomeUnknown(request: Pick<Doc<"actionRequests">, "status" | "error">): boolean {
  return request.status === "executing" &&
    ["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"].includes(request.error ?? "");
}

/** Read actual inbound messages: needs_attention also covers failures before first contact. */
export async function conversationProgress(ctx: QueryCtx, conversation: Doc<"providerConversations">,
  requests: Doc<"actionRequests">[]) {
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
  return { progress, hasProviderReply };
}
