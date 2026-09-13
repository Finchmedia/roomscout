import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";
import { portalBrowserProviderValidator, resolvePortalBrowserProvider } from "./integrations/portalBrowserEngine";

const key = "controlled_portal" as const;

export const getStatus = query({
  args: {},
  returns: v.object({ paused: v.boolean(), drainingProvider: v.optional(portalBrowserProviderValidator), drainedAt: v.optional(v.number()) }),
  handler: async (ctx) => {
    await requireOperatorId(ctx);
    const state = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", key)).unique();
    return { paused: state?.paused ?? false, drainingProvider: state?.drainingProvider, drainedAt: state?.drainedAt };
  },
});

export const pauseForDrain = mutation({
  args: { drainingProvider: portalBrowserProviderValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const state = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", key)).unique();
    const now = Date.now();
    if (state) await ctx.db.patch(state._id, { paused: true, drainingProvider: args.drainingProvider, pausedBy: operatorId, pausedAt: now, drainedAt: undefined, updatedAt: now });
    else await ctx.db.insert("portalBrowserMaintenance", { key, paused: true, drainingProvider: args.drainingProvider, pausedBy: operatorId, pausedAt: now, updatedAt: now });
    return null;
  },
});

export const drainBatch = mutation({
  args: { drainingProvider: portalBrowserProviderValidator, limit: v.optional(v.number()) },
  returns: v.object({ terminalizedRuns: v.number(), terminalizedUnstartedWrites: v.number(), activeRuns: v.number(), activeWrites: v.number(), unknownWrites: v.number(), remainingQueued: v.number(), readyToSwitch: v.boolean() }),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const state = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!state?.paused || state.drainingProvider !== args.drainingProvider) throw new ConvexError({ code: "PORTAL_BROWSER_DRAIN_NOT_PAUSED" });
    if (args.limit !== undefined && (!Number.isFinite(args.limit) || !Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)) {
      throw new ConvexError({ code: "PORTAL_BROWSER_DRAIN_LIMIT_INVALID" });
    }
    const limit = args.limit ?? 50;
    const now = Date.now();
    const runBatch = async (status: "queued" | "running" | "human_required", take: number) => {
      const tagged = await ctx.db.query("browserRuns").withIndex("by_browser_provider_and_status", (q) => q.eq("browserProvider", args.drainingProvider).eq("status", status)).take(take);
      if (args.drainingProvider !== "browserbase" || tagged.length >= take) return tagged;
      const legacy = await ctx.db.query("browserRuns").withIndex("by_browser_provider_and_status", (q) => q.eq("browserProvider", undefined).eq("status", status)).take(take - tagged.length);
      return [...tagged, ...legacy];
    };
    const executionBatch = async (status: "claimed" | "running" | "unknown", take: number) => {
      const tagged = await ctx.db.query("actionExecutions").withIndex("by_browser_provider_and_status", (q) => q.eq("browserProvider", args.drainingProvider).eq("status", status)).take(take);
      if (args.drainingProvider !== "browserbase" || tagged.length >= take) return tagged;
      const legacy = await ctx.db.query("actionExecutions").withIndex("by_browser_provider_and_status", (q) => q.eq("browserProvider", undefined).eq("status", status)).take(take - tagged.length);
      return [...tagged, ...legacy];
    };
    const controlledExecutions = async (status: "claimed" | "running" | "unknown", take: number) => {
      const candidates = await executionBatch(status, take);
      const controlled = [];
      for (const execution of candidates) {
        if (!execution.connectionId) continue;
        const connection = await ctx.db.get(execution.connectionId);
        if (!connection || connection.ownerId !== execution.ownerId ||
          (connection.browserProvider ?? (args.drainingProvider === "browserbase" ? "browserbase" : undefined)) !== args.drainingProvider ||
          connection.adapterKey !== "roomscout-dev-v1") continue;
        controlled.push({ execution, connection });
      }
      return controlled;
    };
    const queued = await runBatch("queued", limit);
    for (const run of queued) {
      await ctx.db.patch(run._id, { status: "failed", errorCode: "PORTAL_PROVIDER_DRAINED", endedAt: now, updatedAt: now });
      await ctx.db.insert("browserRunEvents", { runId: run._id, ownerId: run.ownerId, kind: "failed", message: "PORTAL_PROVIDER_DRAINED", createdAt: now });
      if (run.contextId) {
        const context = await ctx.db.get(run.contextId);
        if (context?.activeRunId === run._id) await ctx.db.patch(context._id, { activeRunId: undefined, updatedAt: now });
      }
    }
    const claimedBatch = await controlledExecutions("claimed", limit);
    const claimed = claimedBatch.filter(({ execution, connection }) => !execution.providerActionId && connection.activeWriteExecutionId !== execution._id);
    const claimedActive = claimedBatch.filter(({ execution, connection }) => Boolean(execution.providerActionId) || connection.activeWriteExecutionId === execution._id);
    for (const { execution, connection } of claimed) {
      const request = await ctx.db.get(execution.requestId);
      await ctx.db.patch(execution._id, { status: "failed", completedAt: now, error: "PORTAL_PROVIDER_DRAINED_BEFORE_START", updatedAt: now });
      if (request?.status === "executing") await ctx.db.patch(request._id, { status: "failed", error: "PORTAL_PROVIDER_DRAINED_BEFORE_START", updatedAt: now });
      if (connection.activeWriteExecutionId === execution._id) await ctx.db.patch(connection._id, { activeWriteExecutionId: undefined, activeWriteDeadlineAt: undefined, updatedAt: now });
    }
    const [runs, humanRuns, runningWrites, unknown, remaining] = await Promise.all([
      runBatch("running", 400), runBatch("human_required", 400), controlledExecutions("running", 400), controlledExecutions("unknown", 400), runBatch("queued", 400),
    ]);
    const activeRuns = runs.length + humanRuns.length;
    const activeWrites = runningWrites.length + claimedActive.length;
    const unknownWrites = unknown.length;
    const remainingQueued = remaining.length;
    const readyToSwitch = activeRuns === 0 && activeWrites === 0 && unknownWrites === 0 && remainingQueued === 0 && claimedBatch.length < limit;
    if (readyToSwitch) await ctx.db.patch(state._id, { drainedAt: now, updatedAt: now });
    await ctx.db.insert("auditEvents", { eventKey: `portal-drain:${args.drainingProvider}:${now}`, actorType: "operator", actorUserId: operatorId, entityKey: `portal-maintenance:${key}`, eventType: "portal.provider_drain_batch", summary: `runs=${queued.length};unstarted=${claimed.length};activeRuns=${activeRuns};activeWrites=${activeWrites};unknown=${unknownWrites};remaining=${remainingQueued}`, occurredAt: now });
    return { terminalizedRuns: queued.length, terminalizedUnstartedWrites: claimed.length, activeRuns, activeWrites, unknownWrites, remainingQueued, readyToSwitch };
  },
});

export const resumeAfterSwitch = mutation({
  args: { drainedProvider: portalBrowserProviderValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const state = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!state?.paused || state.drainingProvider !== args.drainedProvider || state.drainedAt === undefined) throw new ConvexError({ code: "PORTAL_BROWSER_DRAIN_INCOMPLETE" });
    if (resolvePortalBrowserProvider() === args.drainedProvider) throw new ConvexError({ code: "PORTAL_BROWSER_ENGINE_NOT_SWITCHED" });
    const now = Date.now();
    await ctx.db.patch(state._id, { paused: false, pausedBy: operatorId, updatedAt: now });
    return null;
  },
});

export const cancelDrain = mutation({
  args: { drainingProvider: portalBrowserProviderValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const state = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!state?.paused || state.drainingProvider !== args.drainingProvider || resolvePortalBrowserProvider() !== args.drainingProvider) {
      throw new ConvexError({ code: "PORTAL_BROWSER_DRAIN_CANCEL_REJECTED" });
    }
    await ctx.db.patch(state._id, { paused: false, pausedBy: operatorId, drainedAt: undefined, updatedAt: Date.now() });
    return null;
  },
});
