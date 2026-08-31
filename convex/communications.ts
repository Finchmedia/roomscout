import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUserId } from "./integrations/authz";

const unifiedThreadValidator = v.union(
  v.object({
    channel: v.literal("email"),
    threadId: v.id("mailThreads"),
    subject: v.string(),
    participants: v.array(v.string()),
    status: v.string(),
    lastMessageAt: v.number(),
    lastDeliveryStatus: v.optional(v.string()),
  }),
  v.object({
    channel: v.literal("platform"),
    threadId: v.id("platformThreads"),
    connectionId: v.id("portalConnections"),
    subject: v.string(),
    participants: v.array(v.string()),
    status: v.string(),
    lastMessageAt: v.number(),
  }),
);

export const listThreadsMine = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(unifiedThreadValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 30)));
    const [email, platform] = await Promise.all([
      ctx.db.query("mailThreads").withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(limit),
      ctx.db.query("platformThreads").withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(limit),
    ]);
    return [
      ...email.map((thread) => ({
        channel: "email" as const,
        threadId: thread._id,
        subject: thread.subject,
        participants: [] as string[],
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
        lastDeliveryStatus: thread.lastDeliveryStatus,
      })),
      ...platform.map((thread) => ({
        channel: "platform" as const,
        threadId: thread._id,
        connectionId: thread.connectionId,
        subject: thread.subject ?? "Platform conversation",
        participants: thread.participants,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
      })),
    ].sort((left, right) => right.lastMessageAt - left.lastMessageAt).slice(0, limit);
  },
});
