import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const regionValidator = v.union(
  v.literal("us-west-2"), v.literal("us-east-1"),
  v.literal("eu-central-1"), v.literal("ap-southeast-1"),
);

export default defineSchema({
  sessions: defineTable({
    sessionId: v.string(),
    region: regionValidator,
    contextId: v.optional(v.string()),
    persistContext: v.optional(v.boolean()),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("error")),
    lastUrl: v.optional(v.string()),
    error: v.optional(v.string()),
  }).index("by_session_id", ["sessionId"]),
});
