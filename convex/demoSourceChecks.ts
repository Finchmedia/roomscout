import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireOperatorId, requireUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import { isControlledDemoOrigin } from "./lib/demoProvenance";

export const DEMO_CHECK_INTERVAL_MS = 60_000;
export const DEMO_DURATION_MS = 10 * 60_000;
export const DEMO_MAX_CHECKS = 10;
export const DEMO_DETAILS_PER_CHECK = 5;
export const DEMO_MAX_DETAIL_PAGES = 50;
/** An automatic check is not repeated while the last completed run is this recent. */
export const AUTO_CHECK_COOLDOWN_MS = 15 * 60_000;

const runStatus = v.union(
  v.literal("queued"), v.literal("scraping"), v.literal("processing"),
  v.literal("waiting"), v.literal("completed"), v.literal("stopped"),
  v.literal("failed"),
);
const publicStatus = v.union(v.literal("idle"), runStatus);
const resultValidator = v.object({ accepted: v.boolean(), status: publicStatus });
const statusValidator = v.object({
  status: publicStatus,
  mode: v.union(v.literal("manual"), v.literal("demo"), v.null()),
  checksCompleted: v.number(), maxChecks: v.number(),
  detailPagesUsed: v.number(), maxDetailPages: v.number(),
  startedAt: v.union(v.number(), v.null()), expiresAt: v.union(v.number(), v.null()),
  nextCheckAt: v.union(v.number(), v.null()), lastCompletedAt: v.union(v.number(), v.null()),
  error: v.union(v.string(), v.null()),
});

function effectiveStatus(run: { status: string; expiresAt: number }, now: number) {
  const active = ["queued", "scraping", "processing", "waiting"].includes(run.status);
  return active && now >= run.expiresAt ? "failed" as const : run.status;
}

async function singleton(ctx: Pick<MutationCtx, "db">) {
  return await ctx.db.query("demoSourceChecks")
    .withIndex("by_singleton_key", (q) => q.eq("singletonKey", "global"))
    .unique();
}

function validateRequestId(requestId: string) {
  if (!/^[A-Za-z0-9:_-]{8,100}$/.test(requestId)) {
    throw new ConvexError({ code: "INVALID_REQUEST_ID" });
  }
}

export const status = query({
  args: {}, returns: statusValidator,
  handler: async (ctx) => {
    await requireUserId(ctx);
    const run = await ctx.db.query("demoSourceChecks")
      .withIndex("by_singleton_key", (q) => q.eq("singletonKey", "global"))
      .unique();
    if (!run) return { status: "idle" as const, mode: null, checksCompleted: 0, maxChecks: DEMO_MAX_CHECKS, detailPagesUsed: 0, maxDetailPages: DEMO_MAX_DETAIL_PAGES, startedAt: null, expiresAt: null, nextCheckAt: null, lastCompletedAt: null, error: null };
    const currentStatus = effectiveStatus(run, Date.now());
    return {
      status: currentStatus as typeof run.status,
      mode: run.mode, checksCompleted: run.checksCompleted, maxChecks: run.maxChecks,
      detailPagesUsed: run.detailPagesUsed, maxDetailPages: run.maxDetailPages,
      startedAt: run.startedAt, expiresAt: run.expiresAt,
      nextCheckAt: run.nextCheckAt ?? null, lastCompletedAt: run.lastCompletedAt ?? null,
      error: currentStatus === "failed" && run.status !== "failed"
        ? "Demo source check expired before the active action completed."
        : run.error ?? null,
    };
  },
});

async function request(ctx: MutationCtx, args: { requestId: string; kind: "manual" | "demo"; userId: Id<"users"> }) {
  validateRequestId(args.requestId);
  const previous = await ctx.db.query("demoSourceCheckRequests")
    .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId)).unique();
  if (previous) return { accepted: previous.accepted, status: previous.status as "queued" | "failed" };

  const now = Date.now();
  const current = await singleton(ctx);
  const busy = current && ["queued", "scraping", "processing", "waiting"].includes(effectiveStatus(current, now));
  if (busy) {
    await ctx.db.insert("demoSourceCheckRequests", { requestId: args.requestId, requestedBy: args.userId, kind: args.kind, accepted: false, status: current.status, createdAt: now });
    return { accepted: false, status: current.status };
  }
  const run = {
    singletonKey: "global" as const, generation: args.requestId, mode: args.kind,
    status: "queued" as const, requestedBy: args.userId, checksCompleted: 0,
    maxChecks: args.kind === "demo" ? DEMO_MAX_CHECKS : 1, detailPagesUsed: 0,
    maxDetailPages: args.kind === "demo" ? DEMO_MAX_DETAIL_PAGES : DEMO_DETAILS_PER_CHECK,
    startedAt: now, expiresAt: now + DEMO_DURATION_MS, updatedAt: now,
  };
  if (current) await ctx.db.replace(current._id, run); else await ctx.db.insert("demoSourceChecks", run);
  await ctx.db.insert("demoSourceCheckRequests", { requestId: args.requestId, requestedBy: args.userId, kind: args.kind, accepted: true, status: "queued", createdAt: now });
  await ctx.scheduler.runAfter(0, internal.demoSourceCheckActions.runCheck, { generation: args.requestId, checkNumber: 1 });
  await ctx.scheduler.runAfter(DEMO_DURATION_MS, internal.demoSourceChecks.expireRun, { generation: args.requestId });
  return { accepted: true, status: "queued" as const };
}

export const requestNow = mutation({
  args: { requestId: v.string() }, returns: resultValidator,
  handler: async (ctx, args) => request(ctx, { ...args, kind: "manual", userId: await requireUserId(ctx) }),
});

export const startDemo = mutation({
  args: { requestId: v.string() }, returns: resultValidator,
  handler: async (ctx, args) => request(ctx, { ...args, kind: "demo", userId: await requireOperatorId(ctx) }),
});

export const stopDemo = mutation({
  args: {}, returns: resultValidator,
  handler: async (ctx) => {
    await requireOperatorId(ctx);
    const run = await singleton(ctx);
    if (!run || !["queued", "scraping", "processing", "waiting"].includes(run.status)) return { accepted: false, status: (run?.status ?? "idle") as "idle" | "completed" | "stopped" | "failed" };
    await ctx.db.patch(run._id, { status: "stopped", nextCheckAt: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.demoSourceCheckActions.cleanup, { generation: run.generation });
    return { accepted: true, status: "stopped" as const };
  },
});

const automaticSkipReason = v.union(
  v.literal("unconfigured"), v.literal("owner_missing"), v.literal("cooldown"), v.literal("busy"),
);

/**
 * Automatic counterpart of `requestNow`, scheduled when a standing mandate is
 * activated and when a controlled portal registration completes, so the Scout
 * starts looking at roomscout.dev without an operator click. It reuses the
 * bounded manual run (one check, five detail pages). The run is global, so a
 * check that completed inside the cooldown already serves every active need,
 * and an active run is never interrupted. Without a Firecrawl key the request
 * is skipped silently instead of recording a failed run.
 */
export const requestAutomatic = internalMutation({
  args: { ownerId: v.id("users"), requestId: v.string() },
  returns: v.object({ accepted: v.boolean(), status: publicStatus, reason: v.optional(automaticSkipReason) }),
  handler: async (ctx, args) => {
    validateRequestId(args.requestId);
    if (!envValue("FIRECRAWL_API_KEY")) return { accepted: false, status: "idle" as const, reason: "unconfigured" as const };
    if ((await ctx.db.get(args.ownerId)) === null) return { accepted: false, status: "idle" as const, reason: "owner_missing" as const };
    const current = await singleton(ctx);
    if (
      current && current.status === "completed" && current.lastCompletedAt !== undefined &&
      Date.now() - current.lastCompletedAt < AUTO_CHECK_COOLDOWN_MS
    ) {
      return { accepted: false, status: "completed" as const, reason: "cooldown" as const };
    }
    const result = await request(ctx, { requestId: args.requestId, kind: "manual", userId: args.ownerId });
    return result.accepted ? result : { ...result, reason: "busy" as const };
  },
});

export const claimRun = internalMutation({
  args: { generation: v.string(), checkNumber: v.number() },
  returns: v.union(v.object({ remainingDetailBudget: v.number() }), v.null()),
  handler: async (ctx, args) => {
    const run = await singleton(ctx); const now = Date.now();
    if (!run || run.generation !== args.generation || args.checkNumber !== run.checksCompleted + 1 || !["queued", "waiting"].includes(run.status)) return null;
    if (now >= run.expiresAt || run.checksCompleted >= run.maxChecks) {
      await ctx.db.patch(run._id, { status: now >= run.expiresAt ? "failed" : "completed", error: now >= run.expiresAt ? "Demo source check reached its ten-minute limit." : undefined, nextCheckAt: undefined, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.demoSourceCheckActions.cleanup, { generation: run.generation });
      return null;
    }
    await ctx.db.patch(run._id, { status: "scraping", nextCheckAt: undefined, error: undefined, updatedAt: now });
    return { remainingDetailBudget: Math.max(0, run.maxDetailPages - run.detailPagesUsed) };
  },
});

export const markProcessing = internalMutation({
  args: { generation: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => { const run = await singleton(ctx); if (!run || run.generation !== args.generation || run.status !== "scraping" || Date.now() >= run.expiresAt) return false; await ctx.db.patch(run._id, { status: "processing", updatedAt: Date.now() }); return true; },
});

export const claimDetails = internalMutation({
  args: { generation: v.string(), sourceTargetId: v.id("sourceTargets"), leaseId: v.string(), limit: v.number() },
  returns: v.array(v.object({ sourceEntryId: v.id("sourceEntries"), detailUrl: v.string(), leaseId: v.string() })),
  handler: async (ctx, args) => {
    const run = await singleton(ctx); if (!run || run.generation !== args.generation || run.status !== "processing" || Date.now() >= run.expiresAt) return [];
    const limit = Math.max(0, Math.min(DEMO_DETAILS_PER_CHECK, Math.floor(args.limit), run.maxDetailPages - run.detailPagesUsed));
    const rows = await ctx.db.query("sourceEntries").withIndex("by_target_and_detail_state", (q) => q.eq("sourceTargetId", args.sourceTargetId).eq("detailState", "queued")).take(20);
    const selected = rows.filter((row) => row.detailAttempts === 0 && isControlledDemoOrigin(row.detailUrl)).slice(0, limit); const now = Date.now();
    for (const row of selected) await ctx.db.patch(row._id, { detailState: "fetching", detailAttempts: 1, detailLeaseId: args.leaseId, detailLeaseExpiresAt: now + 2 * 60_000, updatedAt: now });
    return selected.map((row) => ({ sourceEntryId: row._id, detailUrl: row.detailUrl, leaseId: args.leaseId }));
  },
});

export const failDetailPermanently = internalMutation({
  args: { sourceEntryId: v.id("sourceEntries"), leaseId: v.string(), error: v.string() }, returns: v.null(),
  handler: async (ctx, args) => { const row = await ctx.db.get(args.sourceEntryId); if (row?.detailLeaseId === args.leaseId || (row?.detailState === "queued" && row.detailAttempts > 0)) await ctx.db.patch(args.sourceEntryId, { detailState: "failed", nextDetailAttemptAt: undefined, detailLeaseId: undefined, detailLeaseExpiresAt: undefined, error: args.error.slice(0, 500), updatedAt: Date.now() }); return null; },
});

export const finishRun = internalMutation({
  args: { generation: v.string(), checkNumber: v.number(), detailPagesUsed: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const run = await singleton(ctx); if (!run || run.generation !== args.generation || run.status !== "processing") return null;
    const now = Date.now(); const checksCompleted = run.checksCompleted + 1; const detailPagesUsed = Math.min(run.maxDetailPages, run.detailPagesUsed + Math.max(0, args.detailPagesUsed));
    const done = run.mode === "manual" || checksCompleted >= run.maxChecks || now >= run.expiresAt;
    const nextCheckAt = done ? undefined : now + DEMO_CHECK_INTERVAL_MS;
    await ctx.db.patch(run._id, { checksCompleted, detailPagesUsed, status: done ? "completed" : "waiting", lastCompletedAt: now, nextCheckAt, updatedAt: now });
    if (done) await ctx.scheduler.runAfter(0, internal.demoSourceCheckActions.cleanup, { generation: run.generation });
    else await ctx.scheduler.runAfter(DEMO_CHECK_INTERVAL_MS, internal.demoSourceCheckActions.runCheck, { generation: args.generation, checkNumber: args.checkNumber + 1 });
    return null;
  },
});

export const failRun = internalMutation({
  args: { generation: v.string(), error: v.string() }, returns: v.null(),
  handler: async (ctx, args) => { const run = await singleton(ctx); if (run?.generation === args.generation && ["queued", "scraping", "processing", "waiting"].includes(run.status)) { await ctx.db.patch(run._id, { status: "failed", error: args.error.slice(0, 500), nextCheckAt: undefined, updatedAt: Date.now() }); await ctx.scheduler.runAfter(0, internal.demoSourceCheckActions.cleanup, { generation: run.generation }); } return null; },
});

export const expireRun = internalMutation({
  args: { generation: v.string() }, returns: v.null(),
  handler: async (ctx, args) => {
    const run = await singleton(ctx);
    if (run?.generation === args.generation && ["queued", "scraping", "processing", "waiting"].includes(run.status)) {
      await ctx.db.patch(run._id, { status: "failed", error: "Demo source check reached its ten-minute limit.", nextCheckAt: undefined, updatedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.demoSourceCheckActions.cleanup, { generation: run.generation });
    }
    return null;
  },
});

export const canCleanup = internalQuery({
  args: { generation: v.string() }, returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await ctx.db.query("demoSourceChecks").withIndex("by_singleton_key", (q) => q.eq("singletonKey", "global")).unique();
    return Boolean(run && run.generation === args.generation && ["completed", "stopped", "failed"].includes(run.status));
  },
});
