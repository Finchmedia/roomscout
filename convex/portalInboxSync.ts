import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { browserWorkpool } from "./workpools";
import {
  portalBrowserProviderValidator,
  resolvePortalBrowserProvider,
  storedPortalBrowserProvider,
  type PortalBrowserProvider,
} from "./integrations/portalBrowserEngine";

const reasonValidator = v.union(v.literal("notification"), v.literal("poll"), v.literal("manual"));
const resultValidator = v.object({ status: v.union(v.literal("queued"), v.literal("coalesced"), v.literal("ignored")) });
const ACTIVE_DEADLINE_MS = 10 * 60_000;
const FAILURE_RETRY_MS = 5 * 60_000;
const MAX_REQUESTED_THREAD_IDS = 10;
const providerThreadIdValidator = v.string();

function validProviderThreadId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,160}$/.test(value);
}

async function eligibleConnection(ctx: MutationCtx, ownerId: Id<"users">, connectionId: Id<"portalConnections">, now: number) {
  const maintenance = await ctx.db.query("portalBrowserMaintenance")
    .withIndex("by_key", (q) => q.eq("key", "controlled_portal"))
    .unique();
  if (maintenance?.paused) return null;
  const connection = await ctx.db.get(connectionId);
  if (!connection || connection.ownerId !== ownerId || connection.status !== "active" ||
    connection.policyDecision !== "allowed" || !connection.allowInboxPolling || !connection.inboxPath ||
    (connection.adapterKey !== "roomscout-fixture-v1" && connection.adapterKey !== "roomscout-dev-v1") ||
    (connection.activeWriteExecutionId !== undefined && (connection.activeWriteDeadlineAt ?? 0) > now)) return null;
  const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).order("desc").first();
  const selectedProvider = resolvePortalBrowserProvider();
  const connectionProvider = storedPortalBrowserProvider(connection.browserProvider);
  if (!context || context.status !== "ready" || connectionProvider !== selectedProvider ||
    storedPortalBrowserProvider(context.browserProvider) !== selectedProvider) return null;
  if (context.activeRunId) {
    const activeRun = await ctx.db.get(context.activeRunId);
    if (activeRun && activeRun.kind === "authenticate" && ["queued", "running", "human_required"].includes(activeRun.status)) return null;
    if (activeRun && ["queued", "running", "human_required"].includes(activeRun.status) && connection.inboxSyncActiveGeneration === undefined) return null;
  }
  return { connection, browserProvider: connectionProvider };
}

type SyncGeneration = { ownerId: Id<"users">; connectionId: Id<"portalConnections">; generation: number; browserProvider: PortalBrowserProvider };

async function enqueueGeneration(ctx: MutationCtx, input: SyncGeneration) {
  const worker = input.browserProvider === "firecrawl"
    ? internal.firecrawlPortal.syncInboxCoordinatedWorker
    : internal.browserbasePortal.syncInboxCoordinatedWorker;
  await browserWorkpool.enqueueAction(ctx, worker, {
    ownerId: input.ownerId,
    connectionId: input.connectionId,
    generation: input.generation,
  }, {
    retry: true,
    onComplete: internal.portalInboxSync.syncCompleted,
    context: input,
  });
}

async function finishGeneration(ctx: MutationCtx, input: SyncGeneration & { failed: boolean }) {
  const now = Date.now();
  const connection = await ctx.db.get(input.connectionId);
  if (!connection || connection.ownerId !== input.ownerId || connection.inboxSyncActiveGeneration !== input.generation) return;
  const currentGeneration = connection.inboxSyncGeneration ?? input.generation;
  if (storedPortalBrowserProvider(connection.browserProvider) !== input.browserProvider) {
    await ctx.db.patch(connection._id, { inboxSyncActiveGeneration: undefined, inboxSyncDeadlineAt: undefined, updatedAt: now });
    return;
  }
  const eligible = await eligibleConnection(ctx, input.ownerId, input.connectionId, now);
  if (eligible && currentGeneration > input.generation) {
    await ctx.db.patch(connection._id, { inboxSyncActiveGeneration: currentGeneration, inboxSyncDeadlineAt: now + ACTIVE_DEADLINE_MS, updatedAt: now });
    await enqueueGeneration(ctx, { ownerId: input.ownerId, connectionId: input.connectionId, generation: currentGeneration, browserProvider: input.browserProvider });
    return;
  }
  await ctx.db.patch(connection._id, {
    inboxSyncActiveGeneration: undefined,
    inboxSyncDeadlineAt: undefined,
    ...(input.failed && connection.status === "active" && connection.allowInboxPolling
      ? { nextPollAt: Math.max(connection.nextPollAt ?? 0, now + FAILURE_RETRY_MS) } : {}),
    updatedAt: now,
  });
}

export const requestSync = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), reason: reasonValidator, receiptKey: v.optional(v.string()), providerThreadId: v.optional(providerThreadIdValidator) },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const connection = await eligibleConnection(ctx, args.ownerId, args.connectionId, now);
    if (!connection || (args.receiptKey && args.receiptKey === connection.connection.inboxSyncLastReceiptKey)) return { status: "ignored" as const };
    if (args.providerThreadId && !validProviderThreadId(args.providerThreadId)) {
      return { status: "ignored" as const };
    }
    const generation = (connection.connection.inboxSyncGeneration ?? 0) + 1;
    const active = connection.connection.inboxSyncActiveGeneration !== undefined && (connection.connection.inboxSyncDeadlineAt ?? 0) > now;
    await ctx.db.patch(connection.connection._id, {
      inboxSyncGeneration: generation,
      ...(args.receiptKey ? { inboxSyncLastReceiptKey: args.receiptKey.slice(0, 300) } : {}),
      ...(args.providerThreadId
        ? { inboxSyncRequestedThreadIds: [...new Set([
            args.providerThreadId,
            ...(connection.connection.inboxSyncRequestedThreadIds ?? []),
          ])].slice(0, MAX_REQUESTED_THREAD_IDS) }
        : {}),
      updatedAt: now,
    });
    if (active) return { status: "coalesced" as const };
    await ctx.db.patch(connection.connection._id, { inboxSyncActiveGeneration: generation, inboxSyncDeadlineAt: now + ACTIVE_DEADLINE_MS });
    await enqueueGeneration(ctx, { ownerId: args.ownerId, connectionId: connection.connection._id, generation, browserProvider: connection.browserProvider });
    return { status: "queued" as const };
  },
});

export const syncCompleted = internalMutation({
  args: vOnCompleteArgs(v.object({ ownerId: v.id("users"), connectionId: v.id("portalConnections"), generation: v.number(), browserProvider: portalBrowserProviderValidator }), v.null()),
  returns: v.null(),
  handler: async (ctx, { context, result }) => {
    await finishGeneration(ctx, { ...context, failed: result.kind === "failed" });
    return null;
  },
});

export const beginManualSync = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections") },
  returns: v.union(v.object({ generation: v.number(), browserProvider: portalBrowserProviderValidator }), v.null()),
  handler: async (ctx, args) => {
    const now = Date.now();
    const connection = await eligibleConnection(ctx, args.ownerId, args.connectionId, now);
    if (!connection || (connection.connection.inboxSyncActiveGeneration !== undefined && (connection.connection.inboxSyncDeadlineAt ?? 0) > now)) return null;
    const generation = (connection.connection.inboxSyncGeneration ?? 0) + 1;
    await ctx.db.patch(connection.connection._id, { inboxSyncGeneration: generation, inboxSyncActiveGeneration: generation,
      inboxSyncDeadlineAt: now + ACTIVE_DEADLINE_MS, updatedAt: now });
    return { generation, browserProvider: connection.browserProvider };
  },
});

export const claimWorker = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), generation: v.number(), browserProvider: portalBrowserProviderValidator },
  returns: v.union(v.object({
    requestedThreadIds: v.array(v.string()),
    startOffset: v.number(),
  }), v.null()),
  handler: async (ctx, args) => {
    const now = Date.now();
    const connection = await eligibleConnection(ctx, args.ownerId, args.connectionId, now);
    if (!connection || connection.browserProvider !== args.browserProvider ||
      connection.connection.inboxSyncActiveGeneration !== args.generation ||
      (connection.connection.inboxSyncDeadlineAt ?? 0) <= now) return null;
    return {
      requestedThreadIds: (connection.connection.inboxSyncRequestedThreadIds ?? [])
        .filter(validProviderThreadId)
        .slice(0, MAX_REQUESTED_THREAD_IDS),
      startOffset: Math.max(0, Math.floor(connection.connection.inboxSyncCursor ?? 0)),
    };
  },
});

export const recordReadProgress = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    generation: v.number(),
    browserProvider: portalBrowserProviderValidator,
    nextOffset: v.number(),
    remainingRequestedThreadIds: v.array(v.string()),
    partial: v.boolean(),
    truncated: v.boolean(),
    timedOut: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.nextOffset) || args.nextOffset < 0 || args.nextOffset > 10_000 ||
      args.remainingRequestedThreadIds.length > MAX_REQUESTED_THREAD_IDS ||
      args.remainingRequestedThreadIds.some((id) => !validProviderThreadId(id))) return false;
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.ownerId !== args.ownerId ||
      connection.inboxSyncActiveGeneration !== args.generation ||
      storedPortalBrowserProvider(connection.browserProvider) !== args.browserProvider ||
      resolvePortalBrowserProvider() !== args.browserProvider) return false;
    await ctx.db.patch(connection._id, {
      inboxSyncCursor: args.nextOffset,
      inboxSyncRequestedThreadIds: [...new Set(args.remainingRequestedThreadIds)],
      inboxSyncLastPartial: args.partial,
      inboxSyncLastTruncated: args.truncated,
      inboxSyncLastTimedOut: args.timedOut,
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const finishManualSync = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), generation: v.number(), browserProvider: portalBrowserProviderValidator, failed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await finishGeneration(ctx, args);
    return null;
  },
});
