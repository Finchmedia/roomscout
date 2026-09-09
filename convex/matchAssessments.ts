import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { MATCH_ASSESSMENT_VERSION, matchAssessmentValidator, validateMatchAssessment } from "./lib/matchAssessment";
import { signalMatchRevision } from "./lib/matchValidity";
import { ROOMSCOUT_MODEL_ID } from "./ai";

const keyArgs = { ownerId: v.id("users"), savedNeedId: v.id("savedNeeds"), signalId: v.id("signals"), needRevision: v.number(), signalRevision: v.string() };
export const getCached = internalQuery({
  args: keyArgs,
  returns: v.union(v.object({ status: v.union(v.literal("ready"), v.literal("failed")), assessment: v.optional(matchAssessmentValidator) }), v.null()),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (!need || need.ownerId !== args.ownerId || (need.matchingRevision ?? 0) !== args.needRevision) return null;
    const row = await ctx.db.query("matchAssessments").withIndex("by_need_and_signal", (q) => q.eq("savedNeedId", args.savedNeedId).eq("signalId", args.signalId)).unique();
    if (!row || row.ownerId !== args.ownerId || row.needRevision !== args.needRevision || row.signalRevision !== args.signalRevision ||
      row.model !== ROOMSCOUT_MODEL_ID || row.promptVersion !== MATCH_ASSESSMENT_VERSION ||
      (row.status === "failed" && row.retryAfter <= Date.now())) return null;
    return { status: row.status, assessment: row.assessment };
  },
});

export const save = internalMutation({
  args: { ...keyArgs, assessment: v.optional(matchAssessmentValidator) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [need, signal] = await Promise.all([ctx.db.get(args.savedNeedId), ctx.db.get(args.signalId)]);
    if (!need || need.ownerId !== args.ownerId || (need.matchingRevision ?? 0) !== args.needRevision ||
      !signal || await signalMatchRevision(signal) !== args.signalRevision) return null;
    if (args.assessment) validateMatchAssessment(args.assessment, need, signal);
    const existing = await ctx.db.query("matchAssessments").withIndex("by_need_and_signal", (q) => q.eq("savedNeedId", args.savedNeedId).eq("signalId", args.signalId)).unique();
    const row = { ...args, status: args.assessment ? "ready" as const : "failed" as const,
      model: ROOMSCOUT_MODEL_ID, promptVersion: MATCH_ASSESSMENT_VERSION, retryAfter: Date.now() + 60_000, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("matchAssessments", row);
    return null;
  },
});
