import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { browserWorkpool } from "./workpools";

const reasonValidator = v.union(v.literal("notification"), v.literal("poll"), v.literal("manual"));
const resultValidator = v.object({ status: v.union(v.literal("queued"), v.literal("coalesced"), v.literal("ignored")) });
const ACTIVE_DEADLINE_MS = 10 * 60_000;
const FAILURE_RETRY_MS = 5 * 60_000;

async function eligibleConnection(ctx: MutationCtx, ownerId: Id<"users">, connectionId: Id<"portalConnections">, now: number) {
  const connection = await ctx.db.get(connectionId);
  if (!connection || connection.ownerId !== ownerId || connection.status !== "active" ||
    connection.policyDecision !== "allowed" || !connection.allowInboxPolling || !connection.inboxPath ||
    (connection.adapterKey !== "roomscout-fixture-v1" && connection.adapterKey !== "roomscout-dev-v1") ||
    (connection.activeWriteExecutionId !== undefined && (connection.activeWriteDeadlineAt ?? 0) > now) ||
    (connection.circuitOpenUntil !== undefined && connection.circuitOpenUntil > now)) return null;
  const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).order("desc").first();
  if (!context || context.status !== "ready") return null;
  if (context.activeRunId) {
    const activeRun = await ctx.db.get(context.activeRunId);
    if (activeRun && activeRun.kind === "authenticate" && ["queued", "running", "human_required"].includes(activeRun.status)) return null;
    if (activeRun && ["queued", "running", "human_required"].includes(activeRun.status) && connection.inboxSyncActiveGeneration === undefined) return null;
  }
  return connection;
}

async function enqueueGeneration(ctx: MutationCtx, input: { ownerId: Id<"users">; connectionId: Id<"portalConnections">; generation: number }) {
  await browserWorkpool.enqueueAction(ctx, internal.browserbasePortal.syncInboxCoordinatedWorker, input, {
    onComplete: internal.portalInboxSync.syncCompleted,
    context: input,
  });
}

async function finishGeneration(ctx: MutationCtx, input: { ownerId: Id<"users">; connectionId: Id<"portalConnections">; generation: number; failed: boolean }) {
  const now = Date.now();
  const connection = await ctx.db.get(input.connectionId);
  if (!connection || connection.ownerId !== input.ownerId || connection.inboxSyncActiveGeneration !== input.generation) return;
  const currentGeneration = connection.inboxSyncGeneration ?? input.generation;
  const eligible = await eligibleConnection(ctx, input.ownerId, input.connectionId, now);
  if (eligible && currentGeneration > input.generation) {
    await ctx.db.patch(connection._id, { inboxSyncActiveGeneration: currentGeneration, inboxSyncDeadlineAt: now + ACTIVE_DEADLINE_MS, updatedAt: now });
    await enqueueGeneration(ctx, { ownerId: input.ownerId, connectionId: input.connectionId, generation: currentGeneration });
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
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), reason: reasonValidator, receiptKey: v.optional(v.string()) },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const connection = await eligibleConnection(ctx, args.ownerId, args.connectionId, now);
    if (!connection || (args.receiptKey && args.receiptKey === connection.inboxSyncLastReceiptKey)) return { status: "ignored" as const };
    const generation = (connection.inboxSyncGeneration ?? 0) + 1;
    const active = connection.inboxSyncActiveGeneration !== undefined && (connection.inboxSyncDeadlineAt ?? 0) > now;
    await ctx.db.patch(connection._id, {
      inboxSyncGeneration: generation,
      ...(args.receiptKey ? { inboxSyncLastReceiptKey: args.receiptKey.slice(0, 300) } : {}),
      updatedAt: now,
    });
    if (active) return { status: "coalesced" as const };
    await ctx.db.patch(connection._id, { inboxSyncActiveGeneration: generation, inboxSyncDeadlineAt: now + ACTIVE_DEADLINE_MS });
    await enqueueGeneration(ctx, { ownerId: args.ownerId, connectionId: connection._id, generation });
    return { status: "queued" as const };
  },
});

export const syncCompleted = internalMutation({
  args: vOnCompleteArgs(v.object({ ownerId: v.id("users"), connectionId: v.id("portalConnections"), generation: v.number() }), v.null()),
  returns: v.null(),
  handler: async (ctx, { context, result }) => {
    await finishGeneration(ctx, { ...context, failed: result.kind === "failed" });
    return null;
  },
});

export const beginManualSync = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const now = Date.now();
    const connection = await eligibleConnection(ctx, args.ownerId, args.connectionId, now);
    if (!connection || (connection.inboxSyncActiveGeneration !== undefined && (connection.inboxSyncDeadlineAt ?? 0) > now)) return null;
    const generation = (connection.inboxSyncGeneration ?? 0) + 1;
    await ctx.db.patch(connection._id, { inboxSyncGeneration: generation, inboxSyncActiveGeneration: generation,
      inboxSyncDeadlineAt: now + ACTIVE_DEADLINE_MS, updatedAt: now });
    return generation;
  },
});

export const claimWorker = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), generation: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const connection = await eligibleConnection(ctx, args.ownerId, args.connectionId, now);
    return Boolean(connection && connection.inboxSyncActiveGeneration === args.generation &&
      (connection.inboxSyncDeadlineAt ?? 0) > now);
  },
});

export const finishManualSync = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), generation: v.number(), failed: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await finishGeneration(ctx, args);
    return null;
  },
});
