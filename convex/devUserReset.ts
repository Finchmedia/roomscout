import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import schema from "./schema";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { envValue } from "./integrations/env";
import { hasActiveDemoReset } from "./lib/demoReset";
import {
  portalBrowserProviderValidator,
  storedPortalBrowserProvider,
} from "./integrations/portalBrowserEngine";

export const DEV_RESET_CONFIRMATION =
  "DELETE_EXACT_DEVELOPMENT_TEST_USER_AND_PROVIDER_DATA" as const;
export const FLEET_RESET_CONFIRMATION =
  "DELETE_EXACT_FLEET_TEST_USERS_KEEP_FINCHLANDLORD" as const;
const DEV_CLOUD_URL =
  "https://perceptive-antelope-445.eu-west-1.convex.cloud";
const DEV_SITE_URL =
  "https://perceptive-antelope-445.eu-west-1.convex.site";
const PROD_CLOUD_URL = "https://fleet-jackal-83.eu-west-1.convex.cloud";
const PROD_SITE_URL = "https://fleet-jackal-83.eu-west-1.convex.site";
const MAX_PROVIDER_CONTEXTS = 8;
const DELETE_BATCH_SIZE = 50;
const PROTECTED_RESET_USERNAME = "finchlandlord";

const confirmationValidator = v.literal(DEV_RESET_CONFIRMATION);
const providerInboxResultValidator = v.union(
  v.literal("not_present"),
  v.literal("deleted"),
  v.literal("already_absent"),
);
const providerContextValidator = v.object({
  providerContextId: v.string(),
  browserProvider: portalBrowserProviderValidator,
});

const stages = [
  "demoSourceCheckRequests",
  "demoSourceChecks",
  "mailThreads",
  "providerConversations",
  "messageSafetyAssessments",
  "actionExecutions",
  "actionApprovals",
  "actionRequests",
  "handoffs",
  "viewings",
  "offerRevisions",
  "platformMessages",
  "platformThreads",
  "browserRunEvents",
  "browserRuns",
  "browserContexts",
  "portalConnections",
  "mailboxMessages",
  "userMailboxes",
  "outreachApprovals",
  "outreachDrafts",
  "notifications",
  "voiceTranscriptEvents",
  "voiceSessions",
  "savedNeedEmbeddings",
  "matchAssessments",
  "signalMatches",
  "searchSourcePreferences",
  "opportunities",
  "scoutAutonomy",
  "scoutContexts",
  "memoryEvents",
  "memoryFacts",
  "memoryProfiles",
  "memoryEntities",
  "savedNeeds",
  "auditEvents",
] as const;

type ResetStage = (typeof stages)[number];

export function assertDevelopmentReset(input: {
  cloudUrl?: string;
  siteUrl?: string;
}): void {
  if (input.cloudUrl !== DEV_CLOUD_URL && input.siteUrl !== DEV_SITE_URL) {
    throw new ConvexError({ code: "DEV_USER_RESET_DEVELOPMENT_ONLY" });
  }
}

function developmentGuard(): void {
  assertDevelopmentReset({
    cloudUrl: envValue("CONVEX_CLOUD_URL"),
    siteUrl: envValue("CONVEX_SITE_URL"),
  });
}

export function assertFleetReset(input: { cloudUrl?: string; siteUrl?: string }): void {
  const allowed = (input.cloudUrl === DEV_CLOUD_URL && input.siteUrl === DEV_SITE_URL) ||
    (input.cloudUrl === PROD_CLOUD_URL && input.siteUrl === PROD_SITE_URL);
  if (!allowed) {
    throw new ConvexError({ code: "FLEET_USER_RESET_DEPLOYMENT_FORBIDDEN" });
  }
}

function fleetGuard(): void {
  assertFleetReset({ cloudUrl: envValue("CONVEX_CLOUD_URL"), siteUrl: envValue("CONVEX_SITE_URL") });
}

async function requireExactTarget(
  ctx: MutationCtx,
  userId: Id<"users">,
  username: string,
) {
  const user = await ctx.db.get(userId);
  if (user === null || user.username !== username) {
    throw new ConvexError({ code: "DEV_USER_RESET_TARGET_MISMATCH" });
  }
  if (user.role === "operator") {
    throw new ConvexError({ code: "DEV_USER_RESET_OPERATOR_FORBIDDEN" });
  }
  if (user.username.toLocaleLowerCase() === PROTECTED_RESET_USERNAME) {
    throw new ConvexError({ code: "DEV_USER_RESET_PROTECTED_USER" });
  }
  return user;
}

export async function isUserResetTombstoned(
  ctx: Pick<QueryCtx, "db">,
  userId: Id<"users">,
): Promise<boolean> {
  return await ctx.db.query("devUserResets").withIndex("by_target_user", (q) => q.eq("targetUserId", userId)).first() !== null;
}

export const userMayRunWork = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  // Tombstoned (full dev reset) users never run work again; a scheduled or
  // running demo reset pauses their workers until it completes.
  handler: async (ctx, args) =>
    (await ctx.db.get(args.userId)) !== null &&
    !await isUserResetTombstoned(ctx, args.userId) &&
    !await hasActiveDemoReset(ctx, args.userId),
});

export const listCandidates = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(schema.doc("users")),
  handler: async (ctx, args) => {
    fleetGuard();
    const result = await ctx.db.query("users").paginate(args.paginationOpts);
    return { ...result, page: result.page.filter((user) => user.role !== "operator" && user.username.toLocaleLowerCase() !== PROTECTED_RESET_USERNAME) };
  },
});

export const fleetResetStatus = internalQuery({
  args: { resetIds: v.array(v.id("devUserResets")) },
  returns: v.array(v.object({ resetId: v.id("devUserResets"), userId: v.id("users"), status: v.string(), phase: v.string(), deletedDocumentCount: v.number() })),
  handler: async (ctx, args) => {
    fleetGuard();
    const rows = [];
    for (const resetId of args.resetIds) { const row = await ctx.db.get(resetId); if (row) rows.push({ resetId, userId: row.targetUserId, status: row.status, phase: row.phase ?? "legacy", deletedDocumentCount: row.deletedDocumentCount }); }
    return rows;
  },
});

const exactTargetValidator = v.object({ userId: v.id("users"), username: v.string() });

export const previewExactTargets = internalQuery({
  args: { targets: v.array(exactTargetValidator), confirmation: v.union(confirmationValidator, v.literal(FLEET_RESET_CONFIRMATION)) },
  returns: v.array(v.object({ userId: v.id("users"), username: v.string(), providerInboxId: v.optional(v.string()), providerContextIds: v.array(v.string()), providerContexts: v.array(providerContextValidator), agentThreadIds: v.array(v.string()), inFlightBrowserRuns: v.number() })),
  handler: async (ctx, args) => {
    fleetGuard();
    if (args.targets.length === 0 || args.targets.length > 20) throw new ConvexError({ code: "DEV_USER_RESET_INVALID_TARGET_COUNT" });
    if (new Set(args.targets.map((target) => String(target.userId))).size !== args.targets.length) throw new ConvexError({ code: "DEV_USER_RESET_DUPLICATE_TARGET" });
    const result = [];
    for (const target of args.targets) {
      const user = await ctx.db.get(target.userId);
      if (!user || user.username !== target.username) throw new ConvexError({ code: "DEV_USER_RESET_TARGET_MISMATCH" });
      if (user.role === "operator" || user.username.toLocaleLowerCase() === PROTECTED_RESET_USERNAME) throw new ConvexError({ code: "DEV_USER_RESET_PROTECTED_USER" });
      const [mailbox, contexts, runs, scoutContext, conversations] = await Promise.all([
        ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", target.userId)).unique(),
        ctx.db.query("browserContexts").withIndex("by_owner", (q) => q.eq("ownerId", target.userId)).take(MAX_PROVIDER_CONTEXTS + 1),
        ctx.db.query("browserRuns").withIndex("by_owner", (q) => q.eq("ownerId", target.userId)).take(101),
        ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", target.userId)).first(),
        ctx.db.query("providerConversations").withIndex("by_owner_and_updated_at", (q) => q.eq("ownerId", target.userId)).take(101),
      ]);
      if (contexts.length > MAX_PROVIDER_CONTEXTS) throw new ConvexError({ code: "DEV_USER_RESET_TOO_MANY_CONTEXTS" });
      if (runs.length > 100 || conversations.length > 100) throw new ConvexError({ code: "FLEET_USER_RESET_PREFLIGHT_OVERFLOW" });
      result.push({ ...target, providerInboxId: mailbox?.providerInboxId, providerContextIds: contexts.map((row) => row.providerContextId), providerContexts: contexts.map((row) => ({ providerContextId: row.providerContextId, browserProvider: storedPortalBrowserProvider(row.browserProvider) })), agentThreadIds: [...new Set([scoutContext?.threadId, ...conversations.map((row) => row.agentThreadId)].filter((value): value is string => Boolean(value)))], inFlightBrowserRuns: runs.filter((run) => ["queued", "running", "human_required"].includes(run.status)).length });
    }
    return result;
  },
});

export const pauseExactTarget = internalMutation({
  args: { ...exactTargetValidator.fields, confirmation: v.union(confirmationValidator, v.literal(FLEET_RESET_CONFIRMATION)) },
  returns: v.object({ ready: v.boolean() }),
  handler: async (ctx, args) => {
    fleetGuard();
    await requireExactTarget(ctx, args.userId, args.username);
    const [needs, connections, runs, executions, sendingDrafts] = await Promise.all([
      ctx.db.query("savedNeeds").withIndex("by_owner", (q) => q.eq("ownerId", args.userId)).take(101),
      ctx.db.query("portalConnections").withIndex("by_owner", (q) => q.eq("ownerId", args.userId)).take(21),
      ctx.db.query("browserRuns").withIndex("by_owner", (q) => q.eq("ownerId", args.userId)).take(101),
      ctx.db.query("actionExecutions").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", args.userId)).order("desc").take(501),
      ctx.db.query("outreachDrafts").withIndex("by_owner_and_status", (q) => q.eq("ownerId", args.userId).eq("status", "sending")).take(21),
    ]);
    if (needs.length > 100 || connections.length > 20 || runs.length > 100 || executions.length > 500 || sendingDrafts.length > 20) throw new ConvexError({ code: "FLEET_USER_RESET_QUIESCENCE_OVERFLOW" });
    const now = Date.now();
    for (const need of needs) if (need.status === "active") await ctx.db.patch(need._id, { status: "paused", updatedAt: now });
    for (const connection of connections) if (connection.status !== "disabled") await ctx.db.patch(connection._id, { status: "paused", nextPollAt: undefined, inboxSyncActiveGeneration: undefined, inboxSyncDeadlineAt: undefined, updatedAt: now });
    const portalBusy = connections.some((connection) => connection.activeWriteExecutionId !== undefined);
    const executionBusy = executions.some((execution) => execution.status === "claimed" || execution.status === "running");
    return { ready: !portalBusy && !executionBusy && sendingDrafts.length === 0 && !runs.some((run) => ["queued", "running", "human_required"].includes(run.status)) };
  },
});

export const preflight = internalQuery({
  args: {
    userId: v.id("users"),
    username: v.string(),
    confirmation: confirmationValidator,
  },
  returns: v.object({
    userId: v.id("users"),
    username: v.string(),
    providerInboxId: v.optional(v.string()),
    providerContextIds: v.array(v.string()),
    providerContexts: v.array(providerContextValidator),
    portalConnectionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    developmentGuard();
    const user = await ctx.db.get(args.userId);
    if (user === null || user.username !== args.username) {
      throw new ConvexError({ code: "DEV_USER_RESET_TARGET_MISMATCH" });
    }
    if (user.role === "operator") {
      throw new ConvexError({ code: "DEV_USER_RESET_OPERATOR_FORBIDDEN" });
    }
    const [mailbox, contexts, connections] = await Promise.all([
      ctx.db
        .query("userMailboxes")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .unique(),
      ctx.db
        .query("browserContexts")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .take(MAX_PROVIDER_CONTEXTS + 1),
      ctx.db
        .query("portalConnections")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.userId))
        .take(MAX_PROVIDER_CONTEXTS + 1),
    ]);
    if (contexts.length > MAX_PROVIDER_CONTEXTS) {
      throw new ConvexError({ code: "DEV_USER_RESET_TOO_MANY_CONTEXTS" });
    }
    if (connections.length > MAX_PROVIDER_CONTEXTS) {
      throw new ConvexError({ code: "DEV_USER_RESET_TOO_MANY_CONNECTIONS" });
    }
    return {
      userId: args.userId,
      username: user.username,
      providerInboxId: mailbox?.providerInboxId,
      providerContextIds: contexts.map((context) => context.providerContextId),
      providerContexts: contexts.map((context) => ({
        providerContextId: context.providerContextId,
        browserProvider: storedPortalBrowserProvider(context.browserProvider),
      })),
      portalConnectionCount: connections.length,
    };
  },
});

export const authorizeCleanup = internalMutation({
  args: {
    userId: v.id("users"),
    username: v.string(),
    confirmation: confirmationValidator,
    providerInboxResult: providerInboxResultValidator,
    providerContextCount: v.number(),
  },
  returns: v.id("devUserResets"),
  handler: async (ctx, args) => {
    developmentGuard();
    await requireExactTarget(ctx, args.userId, args.username);
    if (
      !Number.isInteger(args.providerContextCount) ||
      args.providerContextCount < 0 ||
      args.providerContextCount > MAX_PROVIDER_CONTEXTS
    ) {
      throw new ConvexError({ code: "DEV_USER_RESET_INVALID_CONTEXT_COUNT" });
    }
    const existing = await ctx.db
      .query("devUserResets")
      .withIndex("by_target_user", (q) => q.eq("targetUserId", args.userId))
      .order("desc")
      .first();
    if (existing && existing.status !== "completed") {
      await ctx.scheduler.runAfter(0, internal.devUserReset.runCleanupPage, {
        resetId: existing._id,
        confirmation: DEV_RESET_CONFIRMATION,
      });
      return existing._id;
    }
    const usernameRelease = await ctx.runMutation(
      components.authUsername.public.deleteUsername,
      { userId: String(args.userId) },
    );
    const now = Date.now();
    const resetId = await ctx.db.insert("devUserResets", {
      targetUserId: args.userId,
      targetUsername: args.username,
      status: "scheduled",
      stage: 0,
      deletedDocumentCount: 0,
      providerInboxResult: args.providerInboxResult,
      providerContextCount: args.providerContextCount,
      authUsernameReleased: usernameRelease.deleted,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.devUserReset.runCleanupPage, {
      resetId,
      confirmation: DEV_RESET_CONFIRMATION,
    });
    return resetId;
  },
});

async function eraseRows(
  ctx: MutationCtx,
  rows: Array<{ _id: string }>,
): Promise<number> {
  for (const row of rows) await ctx.db.delete(row._id as never);
  return rows.length;
}

async function eraseMailThreadBatch(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<number> {
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

async function eraseProviderConversationBatch(
  ctx: MutationCtx,
  ownerId: Id<"users">,
): Promise<number> {
  const conversation = await ctx.db
    .query("providerConversations")
    .withIndex("by_owner_and_updated_at", (q) => q.eq("ownerId", ownerId))
    .first();
  if (!conversation) return 0;
  const turns = await ctx.db
    .query("providerTurns")
    .withIndex("by_conversation_and_status_and_revision", (q) =>
      q.eq("conversationId", conversation._id),
    )
    .take(DELETE_BATCH_SIZE);
  if (turns.length > 0) return await eraseRows(ctx, turns);
  await ctx.db.delete(conversation._id);
  return 1;
}

async function eraseStage(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  stage: ResetStage,
): Promise<number> {
  if (stage === "mailThreads") return await eraseMailThreadBatch(ctx, ownerId);
  if (stage === "providerConversations") {
    return await eraseProviderConversationBatch(ctx, ownerId);
  }
  switch (stage) {
    case "demoSourceCheckRequests": return await eraseRows(ctx, await ctx.db.query("demoSourceCheckRequests").withIndex("by_requested_by", (q) => q.eq("requestedBy", ownerId)).take(DELETE_BATCH_SIZE));
    case "demoSourceChecks": return await eraseRows(ctx, await ctx.db.query("demoSourceChecks").withIndex("by_requested_by", (q) => q.eq("requestedBy", ownerId)).take(DELETE_BATCH_SIZE));
    case "messageSafetyAssessments": return await eraseRows(ctx, await ctx.db.query("messageSafetyAssessments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "actionExecutions": return await eraseRows(ctx, await ctx.db.query("actionExecutions").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "actionApprovals": return await eraseRows(ctx, await ctx.db.query("actionApprovals").withIndex("by_owner_and_decided_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "actionRequests": return await eraseRows(ctx, await ctx.db.query("actionRequests").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "handoffs": return await eraseRows(ctx, await ctx.db.query("handoffs").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "viewings": return await eraseRows(ctx, await ctx.db.query("viewings").withIndex("by_owner_and_date", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "offerRevisions": return await eraseRows(ctx, await ctx.db.query("offerRevisions").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "platformMessages": return await eraseRows(ctx, await ctx.db.query("platformMessages").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "platformThreads": return await eraseRows(ctx, await ctx.db.query("platformThreads").withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "browserRunEvents": return await eraseRows(ctx, await ctx.db.query("browserRunEvents").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "browserRuns": return await eraseRows(ctx, await ctx.db.query("browserRuns").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "browserContexts": return await eraseRows(ctx, await ctx.db.query("browserContexts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "portalConnections": return await eraseRows(ctx, await ctx.db.query("portalConnections").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "mailboxMessages": return await eraseRows(ctx, await ctx.db.query("mailboxMessages").withIndex("by_owner_and_received_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "userMailboxes": return await eraseRows(ctx, await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "outreachApprovals": return await eraseRows(ctx, await ctx.db.query("outreachApprovals").withIndex("by_owner_and_decided_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "outreachDrafts": return await eraseRows(ctx, await ctx.db.query("outreachDrafts").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "notifications": return await eraseRows(ctx, await ctx.db.query("notifications").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "voiceTranscriptEvents": return await eraseRows(ctx, await ctx.db.query("voiceTranscriptEvents").withIndex("by_owner_and_finalized_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "voiceSessions": return await eraseRows(ctx, await ctx.db.query("voiceSessions").withIndex("by_owner_and_started_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "savedNeedEmbeddings": return await eraseRows(ctx, await ctx.db.query("savedNeedEmbeddings").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "matchAssessments": return await eraseRows(ctx, await ctx.db.query("matchAssessments").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "signalMatches": return await eraseRows(ctx, await ctx.db.query("signalMatches").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "searchSourcePreferences": return await eraseRows(ctx, await ctx.db.query("searchSourcePreferences").withIndex("by_owner_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "opportunities": return await eraseRows(ctx, await ctx.db.query("opportunities").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "scoutAutonomy": return await eraseRows(ctx, await ctx.db.query("scoutAutonomy").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "scoutContexts": return await eraseRows(ctx, await ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "memoryEvents": return await eraseRows(ctx, await ctx.db.query("memoryEvents").withIndex("by_owner_and_occurred_at", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "memoryFacts": return await eraseRows(ctx, await ctx.db.query("memoryFacts").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "memoryProfiles": return await eraseRows(ctx, await ctx.db.query("memoryProfiles").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "memoryEntities": return await eraseRows(ctx, await ctx.db.query("memoryEntities").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "savedNeeds": return await eraseRows(ctx, await ctx.db.query("savedNeeds").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).take(DELETE_BATCH_SIZE));
    case "auditEvents": return await eraseRows(ctx, await ctx.db.query("auditEvents").withIndex("by_actor_user_id", (q) => q.eq("actorUserId", ownerId)).take(DELETE_BATCH_SIZE));
  }
}

export const runCleanupPage = internalMutation({
  args: {
    resetId: v.id("devUserResets"),
    confirmation: confirmationValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    developmentGuard();
    const reset = await ctx.db.get(args.resetId);
    if (reset === null || reset.status === "completed") return null;
    await requireExactTarget(ctx, reset.targetUserId, reset.targetUsername);
    const stage = stages[reset.stage];
    if (stage === undefined) {
      await ctx.db.delete(reset.targetUserId);
      await ctx.db.patch(reset._id, {
        status: "completed",
        completedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return null;
    }
    const deleted = await eraseStage(ctx, reset.targetUserId, stage);
    await ctx.db.patch(reset._id, {
      status: "running",
      stage: deleted === 0 ? reset.stage + 1 : reset.stage,
      deletedDocumentCount: reset.deletedDocumentCount + deleted,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.devUserReset.runCleanupPage, {
      resetId: reset._id,
      confirmation: DEV_RESET_CONFIRMATION,
    });
    return null;
  },
});

export const authorizeFleetCleanup = internalMutation({
  args: { userId: v.id("users"), username: v.string(), confirmation: v.literal(FLEET_RESET_CONFIRMATION), providerInboxResult: providerInboxResultValidator, providerContextCount: v.number() },
  returns: v.id("devUserResets"),
  handler: async (ctx, args) => {
    fleetGuard();
    await requireExactTarget(ctx, args.userId, args.username);
    const existing = await ctx.db.query("devUserResets").withIndex("by_target_user", (q) => q.eq("targetUserId", args.userId)).order("desc").first();
    if (existing && existing.status !== "completed") {
      await ctx.db.patch(existing._id, { providerInboxResult: args.providerInboxResult, providerContextCount: args.providerContextCount, phase: "provider_cleanup_completed", updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.devUserReset.runFleetCleanupPage, { resetId: existing._id, confirmation: FLEET_RESET_CONFIRMATION });
      return existing._id;
    }
    const now = Date.now();
    const resetId = await ctx.db.insert("devUserResets", { targetUserId: args.userId, targetUsername: args.username, status: "scheduled", phase: "provider_cleanup_completed", stage: 0, deletedDocumentCount: 0, providerInboxResult: args.providerInboxResult, providerContextCount: args.providerContextCount, authUsernameReleased: false, createdAt: now, updatedAt: now });
    await ctx.scheduler.runAfter(0, internal.devUserReset.runFleetCleanupPage, { resetId, confirmation: FLEET_RESET_CONFIRMATION });
    return resetId;
  },
});

export const createFleetResetIntent = internalMutation({
  args: { userId: v.id("users"), username: v.string(), confirmation: v.literal(FLEET_RESET_CONFIRMATION) },
  returns: v.id("devUserResets"),
  handler: async (ctx, args) => {
    fleetGuard();
    await requireExactTarget(ctx, args.userId, args.username);
    const existing = await ctx.db.query("devUserResets").withIndex("by_target_user", (q) => q.eq("targetUserId", args.userId)).order("desc").first();
    if (existing) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("devUserResets", { targetUserId: args.userId, targetUsername: args.username, status: "scheduled", phase: "quiescing", stage: 0, deletedDocumentCount: 0, providerInboxResult: "not_present", providerContextCount: 0, authUsernameReleased: false, createdAt: now, updatedAt: now });
  },
});

export const startExactFleetReset = internalMutation({
  args: { targets: v.array(exactTargetValidator), confirmation: v.literal(FLEET_RESET_CONFIRMATION) },
  returns: v.array(v.object({ userId: v.id("users"), resetId: v.id("devUserResets"), status: v.union(v.literal("scheduled"), v.literal("waiting_for_quiescence"), v.literal("completed")) })),
  handler: async (ctx, args) => {
    fleetGuard();
    if (!args.targets.length || args.targets.length > 20 || new Set(args.targets.map((target) => String(target.userId))).size !== args.targets.length) throw new ConvexError({ code: "FLEET_USER_RESET_INVALID_TARGETS" });
    const prior: Array<Doc<"devUserResets"> | null> = [];
    for (const target of args.targets) {
      const reset = await ctx.db.query("devUserResets").withIndex("by_target_user", (q) => q.eq("targetUserId", target.userId)).order("desc").first();
      if (!reset) await requireExactTarget(ctx, target.userId, target.username);
      else if (reset.targetUsername !== target.username) throw new ConvexError({ code: "DEV_USER_RESET_TARGET_MISMATCH" });
      prior.push(reset);
    }
    const jobs = [];
    for (let index = 0; index < args.targets.length; index++) {
      const target = args.targets[index]!;
      if (prior[index]?.status === "completed") { jobs.push({ userId: target.userId, resetId: prior[index]!._id, status: "completed" as const }); continue; }
      const resetId: Id<"devUserResets"> = await ctx.runMutation(internal.devUserReset.createFleetResetIntent, { ...target, confirmation: args.confirmation });
      jobs.push({ userId: target.userId, resetId, status: "scheduled" as const });
    }
    let ready = true;
    for (const target of args.targets) {
      const completed = prior.find((reset) => reset?.targetUserId === target.userId)?.status === "completed";
      if (completed) continue;
      const state: { ready: boolean } = await ctx.runMutation(internal.devUserReset.pauseExactTarget, { ...target, confirmation: args.confirmation });
      if (!state.ready) ready = false;
    }
    const pendingTargets = args.targets.filter((_, index) => prior[index]?.status !== "completed");
    if (ready && pendingTargets.length > 0) await ctx.scheduler.runAfter(0, internal.devUserResetActions.beginExactFleetUserReset, { targets: pendingTargets, confirmation: args.confirmation });
    return jobs.map((job) => job.status === "completed" || ready ? job : { ...job, status: "waiting_for_quiescence" as const });
  },
});

export const runFleetCleanupPage = internalMutation({
  args: { resetId: v.id("devUserResets"), confirmation: v.literal(FLEET_RESET_CONFIRMATION) },
  returns: v.null(),
  handler: async (ctx, args) => {
    fleetGuard();
    const reset = await ctx.db.get(args.resetId);
    if (!reset || reset.status === "completed") return null;
    if (reset.phase !== "provider_cleanup_completed" && reset.phase !== "deleting_app_data") throw new ConvexError({ code: "FLEET_USER_RESET_PROVIDER_CLEANUP_REQUIRED" });
    await requireExactTarget(ctx, reset.targetUserId, reset.targetUsername);
    const stage = stages[reset.stage];
    if (stage === undefined) {
      await ctx.db.delete(reset.targetUserId);
      await ctx.db.patch(reset._id, { status: "completed", phase: "completed", completedAt: Date.now(), updatedAt: Date.now() });
      return null;
    }
    const deleted = await eraseStage(ctx, reset.targetUserId, stage);
    await ctx.db.patch(reset._id, { status: "running", phase: "deleting_app_data", stage: deleted === 0 ? reset.stage + 1 : reset.stage, deletedDocumentCount: reset.deletedDocumentCount + deleted, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.devUserReset.runFleetCleanupPage, { resetId: reset._id, confirmation: FLEET_RESET_CONFIRMATION });
    return null;
  },
});
