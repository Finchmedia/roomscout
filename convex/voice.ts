import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";
import { requireUserId } from "./integrations/authz";

const MAX_SESSION_MS = 15 * 60 * 1_000;

/**
 * Legacy scheduled jobs and the Live runtime both use this stable lifecycle
 * function name. Provider transport and tools live exclusively in voiceLive.
 */
export const expireSession = internalMutation({
  args: { voiceSessionId: v.id("voiceSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.voiceSessionId);
    if (!session || session.status === "ended" || session.status === "error") return null;
    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "ended",
      endedAt: now,
      durationMs: Math.min(MAX_SESSION_MS, now - session.startedAt),
      updatedAt: now,
    });
    return null;
  },
});

/** End the authenticated owner's current voice session without domain effects. */
export const endMine = mutation({
  args: { voiceSessionId: v.id("voiceSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const session = await ctx.db.get(args.voiceSessionId);
    if (!session || session.ownerId !== ownerId) {
      throw new ConvexError({ code: "VOICE_SESSION_NOT_FOUND" });
    }
    if (session.status === "ended") return null;
    const now = Date.now();
    await ctx.db.patch(session._id, {
      status: "ended",
      endedAt: now,
      durationMs: now - session.startedAt,
      updatedAt: now,
    });
    return null;
  },
});
