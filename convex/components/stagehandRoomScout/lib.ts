import { v } from "convex/values";
import { mutation, query } from "./_generated/server.js";
import schema, { regionValidator } from "./schema.js";

/** Internal metadata lookup for sessions executed by the app-owned Stagehand v4 runtime. */
export const getSession = query({
  args: { sessionId: v.string() },
  returns: v.union(schema.doc("sessions"), v.null()),
  handler: async (ctx, args) =>
    await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique(),
});

/** Idempotently records provider identifiers and non-sensitive lifecycle metadata. */
export const recordSession = mutation({
  args: {
    sessionId: v.string(),
    region: regionValidator,
    contextId: v.optional(v.string()),
    persistContext: v.optional(v.boolean()),
    lastUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (existing) {
      const patch: {
        region: "us-west-2" | "us-east-1" | "eu-central-1" | "ap-southeast-1";
        status: "active";
        contextId?: string;
        persistContext?: boolean;
        lastUrl?: string;
      } = { region: args.region, status: "active" };
      if (args.contextId !== undefined) patch.contextId = args.contextId;
      if (args.persistContext !== undefined) patch.persistContext = args.persistContext;
      if (args.lastUrl !== undefined) patch.lastUrl = args.lastUrl;
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("sessions", {
        ...args,
        startedAt: Date.now(),
        status: "active",
      });
    }
    return null;
  },
});

/** Updates lifecycle metadata without owning or releasing the provider session. */
export const updateSession = mutation({
  args: {
    sessionId: v.string(),
    status: v.optional(
      v.union(v.literal("active"), v.literal("completed"), v.literal("error")),
    ),
    lastUrl: v.optional(v.string()),
    error: v.optional(v.string()),
    endedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sessions")
      .withIndex("by_session_id", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (row) {
      const patch: {
        status?: "active" | "completed" | "error";
        lastUrl?: string;
        error?: string;
        endedAt?: number;
      } = {};
      if (args.status !== undefined) patch.status = args.status;
      if (args.lastUrl !== undefined) patch.lastUrl = args.lastUrl;
      if (args.error !== undefined) patch.error = args.error;
      if (args.endedAt !== undefined) patch.endedAt = args.endedAt;
      await ctx.db.patch(row._id, patch);
    }
    return null;
  },
});
