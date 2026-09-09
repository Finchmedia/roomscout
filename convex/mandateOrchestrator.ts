import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./integrations/authz";
import { opportunityMatchIsCurrent } from "./lib/matchValidity";

const resultValidator = v.object({ checked: v.number(), created: v.number(), scheduled: v.number(), skipped: v.number(), expired: v.number() });
type Result = { checked: number; created: number; scheduled: number; skipped: number; expired: number };
const emptyResult = (): Result => ({ checked: 0, created: 0, scheduled: 0, skipped: 0, expired: 0 });

function boundedLimit(limit = 3) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new ConvexError({ code: "INVALID_ORCHESTRATION_LIMIT" });
  return limit;
}

async function queueOpportunity(ctx: MutationCtx, mandate: Doc<"searchMandates">, opportunity: Doc<"opportunities">) {
  if (!opportunity.signalId || opportunity.ownerId !== mandate.ownerId || opportunity.savedNeedId !== mandate.savedNeedId ||
    opportunity.kind !== "supply_match" || !await opportunityMatchIsCurrent(ctx, opportunity, true)) return false;
  const signal = await ctx.db.get(opportunity.signalId);
  const entry = signal?.sourceEntryId ? await ctx.db.get(signal.sourceEntryId) : null;
  const source = entry ? await ctx.db.get(entry.sourceId) : null;
  const platform = source?.platformId ? await ctx.db.get(source.platformId) : null;
  // This delivery block is explicitly a controlled-portal demo. Public sources
  // may be researched and indexed, never contacted by fictional demo bands.
  if (!source || source.status !== "active" || !platform || platform.status !== "active" ||
    platform.canonicalDomain !== "roomscout.dev" || !mandate.platformIds.includes(platform._id)) return false;
  try {
    if (new URL(source.baseUrl).origin !== "https://roomscout.dev" ||
      new URL(entry!.detailUrl).origin !== "https://roomscout.dev") return false;
  } catch { return false; }
  const eventId: Id<"providerTurns"> | null = await ctx.runMutation(internal.providerConversations.enqueueOpportunity, { opportunityId: opportunity._id });
  if (!eventId) return false;
  await ctx.db.patch(opportunity._id, { status: "reviewing", mandateId: mandate._id, updatedAt: Date.now() });
  return true;
}

async function processNeed(ctx: MutationCtx, mandate: Doc<"searchMandates">, budget: number, cursor: string | null = null): Promise<Result> {
  const result = emptyResult();
  if (mandate.status !== "active" || mandate.stoppedAt !== undefined) return result;
  if (mandate.expiresAt <= Date.now()) {
    await ctx.db.patch(mandate._id, { status: "expired", stoppedAt: Date.now(), updatedAt: Date.now() });
    result.expired = 1; return result;
  }
  if (mandate.mode !== "outreach_autopilot" && mandate.mode !== "negotiation_autopilot") return result;
  const need = await ctx.db.get(mandate.savedNeedId);
  if (need?.ownerId !== mandate.ownerId || need.status !== "active") return result;
  const page = await ctx.db.query("opportunities").withIndex("by_saved_need_and_status_and_updated_at", (q) =>
    q.eq("savedNeedId", mandate.savedNeedId).eq("status", "new"),
  ).order("desc").paginate({ cursor, numItems: 25 });
  for (const opportunity of page.page) {
    result.checked++;
    if (await queueOpportunity(ctx, mandate, opportunity)) {
      result.created++; result.scheduled++; budget--;
      if (budget === 0) break;
    } else result.skipped++;
  }
  if (budget > 0 && !page.isDone) await ctx.scheduler.runAfter(0, internal.mandateOrchestrator.continueNeed, {
    mandateId: mandate._id, cursor: page.continueCursor, limit: budget,
  });
  return result;
}

export const continueNeed = internalMutation({
  args: { mandateId: v.id("searchMandates"), cursor: v.optional(v.string()), limit: v.number() }, returns: resultValidator,
  handler: async (ctx, args) => {
    const mandate = await ctx.db.get(args.mandateId);
    return mandate ? await processNeed(ctx, mandate, boundedLimit(args.limit), args.cursor ?? null) : emptyResult();
  },
});

async function orchestrateOwner(ctx: MutationCtx, ownerId: Id<"users">, limit: number, cursor: string | null = null): Promise<Result> {
  const result = emptyResult();
  const page = await ctx.db.query("searchMandates").withIndex("by_owner_and_status", (q) => q.eq("ownerId", ownerId).eq("status", "active")).paginate({ cursor, numItems: 10 });
  for (const mandate of page.page) {
    const current: Result = await ctx.runMutation(internal.mandateOrchestrator.continueNeed, { mandateId: mandate._id, limit });
    for (const key of Object.keys(result) as (keyof Result)[]) result[key] += current[key];
  }
  if (!page.isDone) await ctx.scheduler.runAfter(0, internal.mandateOrchestrator.runForOwner, { ownerId, limit, cursor: page.continueCursor });
  return result;
}

export const runNowMine = mutation({
  args: { limit: v.optional(v.number()) }, returns: resultValidator,
  handler: async (ctx, args) => await orchestrateOwner(ctx, await requireUserId(ctx), boundedLimit(args.limit)),
});

export const runForOwner = internalMutation({
  args: { ownerId: v.id("users"), limit: v.optional(v.number()), cursor: v.optional(v.string()) }, returns: resultValidator,
  handler: async (ctx, args): Promise<Result> => await orchestrateOwner(ctx, args.ownerId, boundedLimit(args.limit), args.cursor ?? null),
});

export const runBatch = internalMutation({
  args: { limit: v.optional(v.number()), cursor: v.optional(v.string()) }, returns: resultValidator,
  handler: async (ctx, args): Promise<Result> => {
    const result = emptyResult();
    const limit = args.limit ?? 8;
    if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new ConvexError({ code: "INVALID_ORCHESTRATION_LIMIT" });
    const page = await ctx.db.query("searchMandates").withIndex("by_status_and_expires_at", (q) => q.eq("status", "active")).paginate({ cursor: args.cursor ?? null, numItems: limit });
    for (const mandate of page.page) {
      const current: Result = await ctx.runMutation(internal.mandateOrchestrator.continueNeed, { mandateId: mandate._id, limit: 3 });
      for (const key of Object.keys(result) as (keyof Result)[]) result[key] += current[key];
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.mandateOrchestrator.runBatch, { limit, cursor: page.continueCursor });
    return result;
  },
});
