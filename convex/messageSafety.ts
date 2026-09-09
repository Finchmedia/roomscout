import { v } from "convex/values";
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { generateRoomScoutObject, ROOMSCOUT_MODEL_ID } from "./ai";
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
      await ctx.db.patch(request._id, { status: "expired", error: "MESSAGE_CONTEXT_CHANGED", updatedAt: Date.now() });
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
    if (result.authorizedByMandate) {
      const binding = request.adapterBindingId ? await ctx.db.get(request.adapterBindingId) : null;
      // Enqueue one provider attempt transactionally with authorization. No AI
      // workpool retries enclose an external write or an ambiguous browser result.
      if (binding?.executor === "browserbase") await ctx.scheduler.runAfter(0, internal.browserbasePortal.executeApprovedWriteWorker, { ownerId: request.ownerId, requestId: request._id });
      else if (binding?.executor === "firecrawl") await ctx.scheduler.runAfter(0, internal.firecrawlInteract.executeApprovedWorker, { ownerId: request.ownerId, requestId: request._id });
      else if (binding?.executor === "agentmail" && binding.config.kind === "agentmail" && binding.config.purpose === "reply") await ctx.scheduler.runAfter(0, internal.agentmail.executeApprovedReply, { ownerId: request.ownerId, requestId: request._id });
    }
    return result.authorizedByMandate;
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

export const assessmentCompleted = internalMutation({
  args: vOnCompleteArgs(v.object({ requestId: v.id("actionRequests"), contentVersion: v.number() }), v.null()),
  returns: v.null(),
  handler: async (ctx, { context }) => {
    const request = await ctx.db.get(context.requestId);
    if (request?.status === "queued" && request.contentVersion === context.contentVersion) {
      await ctx.db.patch(request._id, { status: "awaiting_approval", error: "FINAL_MESSAGE_CHECK_UNAVAILABLE", updatedAt: Date.now() });
      await ctx.db.insert("notifications", { ownerId: request.ownerId, kind: "system", title: "Scout needs your review", body: "The final-message check could not complete. Nothing was sent.", createdAt: Date.now() });
    }
    return null;
  },
});
