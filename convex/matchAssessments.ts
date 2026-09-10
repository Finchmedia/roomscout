import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";
import { MATCH_ASSESSMENT_VERSION, matchAssessmentValidator, validateMatchAssessment } from "./lib/matchAssessment";
import { signalMatchRevision } from "./lib/matchValidity";
import { ROOMSCOUT_MODEL_ID } from "./ai";
import { internal } from "./_generated/api";

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
    return { status: row.status, ...(row.status === "ready" ? { assessment: row.assessment } : {}) };
  },
});

export const save = internalMutation({
  args: { ...keyArgs, assessment: v.optional(matchAssessmentValidator), errorCode: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [need, signal] = await Promise.all([ctx.db.get(args.savedNeedId), ctx.db.get(args.signalId)]);
    if (!need || need.status !== "active" || need.ownerId !== args.ownerId || (need.matchingRevision ?? 0) !== args.needRevision ||
      !signal || await signalMatchRevision(signal) !== args.signalRevision) return null;
    if (args.assessment) validateMatchAssessment(args.assessment, need, signal);
    const existing = await ctx.db.query("matchAssessments").withIndex("by_need_and_signal", (q) => q.eq("savedNeedId", args.savedNeedId).eq("signalId", args.signalId)).unique();
    const sameInput = existing?.needRevision === args.needRevision && existing.signalRevision === args.signalRevision && existing.promptVersion === MATCH_ASSESSMENT_VERSION;
    if (sameInput && existing.status === "ready" && !args.assessment) return null;
    const attempts = (sameInput ? existing.attempts ?? 0 : 0) + 1;
    const now = Date.now();
    const row = { ...args, assessment: args.assessment, errorCode: args.assessment ? undefined : args.errorCode,
      attempts, status: args.assessment ? "ready" as const : "failed" as const,
      model: ROOMSCOUT_MODEL_ID, promptVersion: MATCH_ASSESSMENT_VERSION, retryAfter: now + 5_000 * attempts, updatedAt: now };
    if (existing) await ctx.db.patch(existing._id, row);
    else await ctx.db.insert("matchAssessments", row);
    if (!args.assessment && attempts < 3) {
      const key = { ownerId: args.ownerId, savedNeedId: args.savedNeedId, signalId: args.signalId,
        needRevision: args.needRevision, signalRevision: args.signalRevision };
      await ctx.scheduler.runAt(row.retryAfter, internal.matchAssessments.retryFailed, { ...key, failedAt: now });
    } else if (!args.assessment && attempts === 3) {
      await ctx.db.insert("notifications", { ownerId: args.ownerId, kind: "system", title: "Raumprüfung fehlgeschlagen",
        body: "Scout konnte die Bedingungen der Anzeige nach drei Versuchen nicht prüfen. Der Anbieter wurde noch nicht kontaktiert. Bitte die Suche aktualisieren, um erneut zu versuchen.", createdAt: now });
    }
    return null;
  },
});

export const retryFailed = internalMutation({
  args: { ...keyArgs, failedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    const signal = await ctx.db.get(args.signalId);
    const row = await ctx.db.query("matchAssessments").withIndex("by_need_and_signal", q => q.eq("savedNeedId", args.savedNeedId).eq("signalId", args.signalId)).unique();
    if (!need || need.status !== "active" || need.ownerId !== args.ownerId || need.matchingRevision !== args.needRevision ||
      !signal || await signalMatchRevision(signal) !== args.signalRevision || !row || row.status !== "failed" ||
      row.updatedAt !== args.failedAt || row.signalRevision !== args.signalRevision || row.needRevision !== args.needRevision) return null;
    await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, { ownerId: args.ownerId, savedNeedId: args.savedNeedId });
    return null;
  },
});
