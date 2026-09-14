import { v } from "convex/values";
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { generateRoomScoutObject, ROOMSCOUT_MODEL_ID } from "./ai";
import { loadAutonomyForOwner } from "./autonomy";
import { recordOutcome } from "./autonomyGate";
import { dispatchApproved } from "./externalActions";
import { SAFETY_RETRY_MS } from "./lib/autonomyGate";
import { delimitUntrustedData } from "./lib/privacy";
import { MESSAGE_SAFETY_VERSION, messageSafetyContext, messageSafetyInstructions, messageSafetySchema, messageSafetyValidator } from "./lib/messageSafety";

export const getInput = internalQuery({
  args: { requestId: v.id("actionRequests") },
  returns: v.union(v.object({ snapshotHash: v.string(), data: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "queued") return null;
    const input = await messageSafetyContext(ctx, request);
    return input;
  },
});

export const recordAndAuthorize = internalMutation({
  args: { requestId: v.id("actionRequests"), snapshotHash: v.string(), assessment: messageSafetyValidator },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "queued") return false;
    const input = await messageSafetyContext(ctx, request);
    if (!input || input.snapshotHash !== args.snapshotHash) {
      const autonomy = await loadAutonomyForOwner(ctx, request.ownerId);
      await recordOutcome(ctx, request, {
        outcome: "stop", reason: "context_changed", phase: "submit",
        autonomyVersion: autonomy.version, autonomyHash: autonomy.contentHash, attempts: request.gate?.attempts,
      });
      return false;
    }
    const assessment = messageSafetySchema.parse(args.assessment);
    const existing = await ctx.db.query("messageSafetyAssessments").withIndex("by_request_and_snapshot", (q) =>
      q.eq("requestId", request._id).eq("snapshotHash", args.snapshotHash),
    ).unique();
    if (!existing) await ctx.db.insert("messageSafetyAssessments", {
      requestId: request._id, ownerId: request.ownerId, snapshotHash: args.snapshotHash,
      contentHash: request.contentHash, contentVersion: request.contentVersion,
      assessment, model: ROOMSCOUT_MODEL_ID, version: MESSAGE_SAFETY_VERSION, createdAt: Date.now(),
    });
    await ctx.db.patch(request._id, { status: "drafted", updatedAt: Date.now() });
    const result = await ctx.runMutation(internal.externalActions.submitChecked, { ownerId: request.ownerId, requestId: request._id });
    if (result.authorizedByAutonomy) {
      const approved = await ctx.db.get(request._id);
      if (approved !== null && approved.status === "approved") await dispatchApproved(ctx, approved);
    }
    return result.authorizedByAutonomy;
  },
});

export const assessAndAuthorize = internalAction({
  args: { requestId: v.id("actionRequests") }, returns: v.null(),
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(internal.messageSafety.getInput, args);
    if (!input) return null;
    const assessment = await generateRoomScoutObject({
      schema: messageSafetySchema, instructions: messageSafetyInstructions,
      prompt: delimitUntrustedData("outgoing_message_and_context", input.data), timeoutMs: 90_000,
    });
    await ctx.runMutation(internal.messageSafety.recordAndAuthorize, { ...args, snapshotHash: input.snapshotHash, assessment });
    return null;
  },
});

/**
 * Workpool exhaustion: the verdict is still missing. Park the request and
 * re-submit in five minutes; the gate turns the third such wait into an
 * Entscheidung (safety_unavailable). Nothing is sent, nobody is nagged.
 */
export const assessmentCompleted = internalMutation({
  args: vOnCompleteArgs(v.object({ requestId: v.id("actionRequests"), contentVersion: v.number() }), v.null()),
  returns: v.null(),
  handler: async (ctx, { context, result }) => {
    if (result.kind === "success") return null;
    const request = await ctx.db.get(context.requestId);
    if (request?.status === "queued" && request.contentVersion === context.contentVersion) {
      const autonomy = await loadAutonomyForOwner(ctx, request.ownerId);
      await recordOutcome(ctx, request, {
        outcome: "wait", reason: "safety_pending", retryAt: Date.now() + SAFETY_RETRY_MS, phase: "submit",
        autonomyVersion: autonomy.version, autonomyHash: autonomy.contentHash,
        attempts: (request.gate?.attempts ?? 0) + 1,
      });
    }
    return null;
  },
});
