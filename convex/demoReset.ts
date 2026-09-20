import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./integrations/authz";
import { isDemoResetStalled, latestDemoReset } from "./lib/demoReset";

/**
 * Demo reset: the musician wipes their own search and every interaction so a
 * demo run starts from a clean slate, without a new account. Kept untouched:
 * users, portalConnections, browserContexts, browserRuns, browserRunEvents,
 * userMailboxes, mailboxMessages, scoutAutonomy, searchSourcePreferences,
 * auditEvents, demoSourceCheck* and every table not listed in `stages`.
 *
 * Deletion runs in owner-indexed pages of DELETE_BATCH_SIZE rows, one stage at
 * a time, rescheduling itself until a stage is empty; the pattern mirrors
 * devUserReset.ts, which is the development-only FULL account deletion.
 */
const DELETE_BATCH_SIZE = 50;

const stages = [
  "decisions",
  "providerConversations",
  "messageSafetyAssessments",
  "actionExecutions",
  "actionApprovals",
  "actionRequests",
  "handoffs",
  "offerRevisions",
  "platformMessages",
  "platformThreads",
  "mailThreads",
  "outreachApprovals",
  "outreachDrafts",
  "notifications",
  "voiceTranscriptEvents",
  "voiceSessions",
  "savedNeedEmbeddings",
  "matchAssessments",
  "signalMatches",
  "opportunities",
  "scoutContexts",
  "memoryEvents",
  "memoryFacts",
  "memoryProfiles",
  "memoryEntities",
  "savedNeeds",
] as const;

type DemoResetStage = (typeof stages)[number];

export const DEMO_RESET_STAGE_COUNT = stages.length;

const statusValidator = v.union(
  v.literal("scheduled"),
  v.literal("running"),
  v.literal("completed"),
);

const summaryValidator = v.object({
  resetId: v.id("demoResets"),
  status: statusValidator,
  stage: v.number(),
  stageCount: v.number(),
  deletedDocumentCount: v.number(),
  updatedAt: v.number(),
  completedAt: v.optional(v.number()),
});

export const startMine = mutation({
  args: {},
  returns: v.id("demoResets"),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const latest = await latestDemoReset(ctx, ownerId);
    const now = Date.now();
    if (latest && latest.status !== "completed") {
      // A pager whose scheduled chain died leaves the row pending forever and the
      // owner's workers paused with it. Resume it; `runPage` re-reads the row, so
      // a second pager on a healthy reset would only duplicate work, which the
      // staleness check avoids. The patch marks the resume.
      if (isDemoResetStalled(latest, now)) {
        await ctx.db.patch(latest._id, { updatedAt: now });
        await ctx.scheduler.runAfter(0, internal.demoReset.runPage, { resetId: latest._id });
      }
      return latest._id;
    }
    const resetId = await ctx.db.insert("demoResets", {
      ownerId,
      status: "scheduled",
      stage: 0,
      deletedDocumentCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.demoReset.runPage, { resetId });
    return resetId;
  },
});

export const statusMine = query({
  args: {},
  returns: v.union(v.null(), summaryValidator),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const latest = await latestDemoReset(ctx, ownerId);
    if (!latest) return null;
    return {
      resetId: latest._id,
      status: latest.status,
      stage: latest.stage,
      stageCount: stages.length,
      deletedDocumentCount: latest.deletedDocumentCount,
      updatedAt: latest.updatedAt,
      ...(latest.completedAt !== undefined ? { completedAt: latest.completedAt } : {}),
    };
  },
});

async function eraseRows(
  ctx: MutationCtx,
  rows: Array<{ _id: Id<TableNames> }>,
): Promise<number> {
  for (const row of rows) await ctx.db.delete(row._id);
  return rows.length;
}

/**
 * Workers that are not gated by userMayRunWork (scoutOrchestrator.runBatch,
 * matches.rematchAllActive, ...) pick needs by status "active" and would keep
 * creating matches, opportunities, notifications and decisions behind the wipe,
 * orphaned once savedNeeds go in the last stage. Pausing every active need
 * before the first deletion closes that window; the needs are deleted anyway.
 */
async function pauseActiveNeedsBatch(ctx: MutationCtx, ownerId: Id<"users">): Promise<number> {
  const needs = await ctx.db
    .query("savedNeeds")
    .withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", "active"))
    .take(DELETE_BATCH_SIZE);
  const now = Date.now();
  for (const need of needs) await ctx.db.patch(need._id, { status: "paused", updatedAt: now });
  return needs.length;
}

/**
 * Deletes an Agent component thread with everything it contains. The component
 * continues page by page on its own scheduler, so completion is not awaited.
 * A malformed or foreign thread id is ignored: it is a subtransaction, so the
 * caught failure leaves this mutation's own writes intact.
 */
async function deleteAgentThread(ctx: MutationCtx, threadId: string): Promise<void> {
  try {
    await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
      threadId: threadId as never,
    });
  } catch {
    // Unknown thread id: nothing to delete in the component.
  }
}

async function eraseMailThreadBatch(ctx: MutationCtx, ownerId: Id<"users">): Promise<number> {
  const thread = await ctx.db
    .query("mailThreads")
    .withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", ownerId))
    .first();
  if (!thread) return 0;
  const messages = await ctx.db
    .query("mailMessages")
    .withIndex("by_thread_and_received_at", (q) => q.eq("threadId", thread._id))
    .take(DELETE_BATCH_SIZE);
  if (messages.length > 0) return await eraseRows(ctx, messages);
  await ctx.db.delete(thread._id);
  return 1;
}

async function eraseProviderConversationBatch(ctx: MutationCtx, ownerId: Id<"users">): Promise<number> {
  const conversation = await ctx.db
    .query("providerConversations")
    .withIndex("by_owner_and_updated_at", (q) => q.eq("ownerId", ownerId))
    .first();
  if (!conversation) return 0;
  const turns = await ctx.db
    .query("providerTurns")
    .withIndex("by_conversation_and_status_and_revision", (q) => q.eq("conversationId", conversation._id))
    .take(DELETE_BATCH_SIZE);
  if (turns.length > 0) return await eraseRows(ctx, turns);
  await deleteAgentThread(ctx, conversation.agentThreadId);
  await ctx.db.delete(conversation._id);
  return 1;
}

/** The Scout chat lives in the Agent component; its thread goes with the scoutContexts row that points at it. */
async function eraseScoutContextBatch(ctx: MutationCtx, ownerId: Id<"users">): Promise<number> {
  const contexts = await ctx.db
    .query("scoutContexts")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(DELETE_BATCH_SIZE);
  for (const context of contexts) {
    await deleteAgentThread(ctx, context.threadId);
    await ctx.db.delete(context._id);
  }
  return contexts.length;
}

async function eraseStage(ctx: MutationCtx, ownerId: Id<"users">, stage: DemoResetStage): Promise<number> {
  switch (stage) {
    case "decisions": return await eraseRows(ctx, await ctx.db.query("decisions").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "providerConversations": return await eraseProviderConversationBatch(ctx, ownerId);
    case "messageSafetyAssessments": return await eraseRows(ctx, await ctx.db.query("messageSafetyAssessments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "actionExecutions": return await eraseRows(ctx, await ctx.db.query("actionExecutions").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "actionApprovals": return await eraseRows(ctx, await ctx.db.query("actionApprovals").withIndex("by_owner_and_decided_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "actionRequests": return await eraseRows(ctx, await ctx.db.query("actionRequests").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "handoffs": return await eraseRows(ctx, await ctx.db.query("handoffs").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "offerRevisions": return await eraseRows(ctx, await ctx.db.query("offerRevisions").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "platformMessages": return await eraseRows(ctx, await ctx.db.query("platformMessages").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "platformThreads": return await eraseRows(ctx, await ctx.db.query("platformThreads").withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "mailThreads": return await eraseMailThreadBatch(ctx, ownerId);
    case "outreachApprovals": return await eraseRows(ctx, await ctx.db.query("outreachApprovals").withIndex("by_owner_and_decided_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "outreachDrafts": return await eraseRows(ctx, await ctx.db.query("outreachDrafts").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "notifications": return await eraseRows(ctx, await ctx.db.query("notifications").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "voiceTranscriptEvents": return await eraseRows(ctx, await ctx.db.query("voiceTranscriptEvents").withIndex("by_owner_and_finalized_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "voiceSessions": return await eraseRows(ctx, await ctx.db.query("voiceSessions").withIndex("by_owner_and_started_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "savedNeedEmbeddings": return await eraseRows(ctx, await ctx.db.query("savedNeedEmbeddings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "matchAssessments": return await eraseRows(ctx, await ctx.db.query("matchAssessments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "signalMatches": return await eraseRows(ctx, await ctx.db.query("signalMatches").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "opportunities": return await eraseRows(ctx, await ctx.db.query("opportunities").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "scoutContexts": return await eraseScoutContextBatch(ctx, ownerId);
    case "memoryEvents": return await eraseRows(ctx, await ctx.db.query("memoryEvents").withIndex("by_owner_and_occurred_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "memoryFacts": return await eraseRows(ctx, await ctx.db.query("memoryFacts").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "memoryProfiles": return await eraseRows(ctx, await ctx.db.query("memoryProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "memoryEntities": return await eraseRows(ctx, await ctx.db.query("memoryEntities").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "savedNeeds": return await eraseRows(ctx, await ctx.db.query("savedNeeds").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
  }
}

export const runPage = internalMutation({
  args: { resetId: v.id("demoResets") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const reset = await ctx.db.get(args.resetId);
    if (reset === null || reset.status === "completed") return null;
    const stage = stages[reset.stage];
    const now = Date.now();
    if (stage === undefined) {
      await ctx.db.patch(reset._id, { status: "completed", completedAt: now, updatedAt: now });
      return null;
    }
    // Still "scheduled": nothing has been deleted yet, so quiesce the owner's
    // needs first, one page per run; the first deletion flips the row to "running".
    if (reset.status === "scheduled" && await pauseActiveNeedsBatch(ctx, reset.ownerId) > 0) {
      await ctx.db.patch(reset._id, { updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.demoReset.runPage, { resetId: reset._id });
      return null;
    }
    const deleted = await eraseStage(ctx, reset.ownerId, stage);
    await ctx.db.patch(reset._id, {
      status: "running",
      stage: deleted === 0 ? reset.stage + 1 : reset.stage,
      deletedDocumentCount: reset.deletedDocumentCount + deleted,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.demoReset.runPage, { resetId: reset._id });
    return null;
  },
});
