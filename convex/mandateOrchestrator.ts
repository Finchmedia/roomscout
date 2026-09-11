import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { requireUserId } from "./integrations/authz";
import { opportunityMatchIsCurrent } from "./lib/matchValidity";

const resultValidator = v.object({ checked: v.number(), created: v.number(), scheduled: v.number(), skipped: v.number(), expired: v.number() });
type Result = { checked: number; created: number; scheduled: number; skipped: number; expired: number };
const emptyResult = (): Result => ({ checked: 0, created: 0, scheduled: 0, skipped: 0, expired: 0 });

const CONTROLLED_DOMAIN = "roomscout.dev";
const CONTROLLED_SOURCE_SLUG = "roomscout-dev-connected";
const CONTROLLED_ADAPTER_KEY = "roomscout-dev-v1";

type ReadCtx = Pick<QueryCtx, "db">;

async function platformIsExcluded(
  ctx: ReadCtx,
  savedNeedId: Id<"savedNeeds">,
  platformId: Id<"sourcePlatforms">,
) {
  const preference = await ctx.db
    .query("searchSourcePreferences")
    .withIndex("by_saved_need_and_platform", (q) =>
      q.eq("savedNeedId", savedNeedId).eq("platformId", platformId),
    )
    .unique();
  return preference?.preference === "exclude";
}

async function controlledNeedsAuthConnection(
  ctx: ReadCtx,
  ownerId: Id<"users">,
): Promise<{ connection: Doc<"portalConnections">; source: Doc<"sources">; platform: Doc<"sourcePlatforms"> } | null> {
  const source = await ctx.db.query("sources").withIndex("by_slug", (q) =>
    q.eq("slug", CONTROLLED_SOURCE_SLUG),
  ).unique();
  if (
    !source || source.status !== "active" || source.accessMode !== "authenticated" ||
    source.automationReview !== "approved" || source.adapterKey !== CONTROLLED_ADAPTER_KEY
  ) return null;
  let sourceUrl: URL;
  try { sourceUrl = new URL(source.baseUrl); } catch { return null; }
  if (sourceUrl.protocol !== "https:" || sourceUrl.hostname !== CONTROLLED_DOMAIN || sourceUrl.port || sourceUrl.pathname !== "/") return null;
  const platform = source.platformId ? await ctx.db.get(source.platformId) : null;
  if (!platform || platform.status !== "active" || platform.canonicalDomain !== CONTROLLED_DOMAIN) return null;
  const connection = await ctx.db.query("portalConnections").withIndex("by_owner_and_source", (q) =>
    q.eq("ownerId", ownerId).eq("sourceId", source._id),
  ).unique();
  if (
    !connection || connection.platformId !== platform._id || connection.status !== "needs_auth" ||
    connection.policyDecision !== "allowed" || connection.adapterKey !== CONTROLLED_ADAPTER_KEY ||
    connection.allowedDomains.length !== 1 || connection.allowedDomains[0] !== CONTROLLED_DOMAIN ||
    !connection.allowedPaths.includes("/sign-up") || !connection.allowedPaths.includes("/sign-in")
  ) return null;
  return { connection, source, platform };
}

async function eligibleControlledRegistration(
  ctx: ReadCtx,
  mandate: Doc<"searchMandates">,
  expectedConnectionId?: Id<"portalConnections">,
): Promise<Id<"portalConnections"> | null> {
  const now = Date.now();
  if (
    mandate.status !== "active" ||
    mandate.stoppedAt !== undefined ||
    mandate.expiresAt <= now ||
    (mandate.mode !== "outreach_autopilot" && mandate.mode !== "negotiation_autopilot") ||
    !mandate.allowedActionTypes.includes("create_portal_account") ||
    mandate.commitmentBoundary !== "non_binding_outreach_only"
  ) return null;
  const need = await ctx.db.get(mandate.savedNeedId);
  if (!need || need.ownerId !== mandate.ownerId || need.status !== "active") return null;
  const controlled = await controlledNeedsAuthConnection(ctx, mandate.ownerId);
  if (!controlled || controlled.connection._id !== (expectedConnectionId ?? controlled.connection._id)) return null;
  const { connection, source, platform } = controlled;
  if (!mandate.platformIds.includes(platform._id)) return null;
  if (await platformIsExcluded(ctx, mandate.savedNeedId, platform._id)) return null;
  const mailbox = await ctx.db.query("userMailboxes").withIndex("by_owner", (q) =>
    q.eq("ownerId", mandate.ownerId),
  ).unique();
  if (!mailbox || mailbox.status !== "active" || !mailbox.providerInboxId || !mailbox.emailAddress) return null;
  const policies = await ctx.db.query("sourceFlowPolicies").withIndex("by_platform_and_status_and_next_review_at", (q) =>
    q.eq("platformId", platform._id).eq("status", "approved"),
  ).take(20);
  const policy = policies.find((candidate) =>
    candidate.sourceId === source._id && candidate.decision === "allowed" &&
    candidate.maxAutomationLevel === "approved_execute" && candidate.accountCreationAllowed &&
    !candidate.humanPresenceRequired && candidate.robotsDecision === "allowed" &&
    candidate.termsDecision === "allowed" && (candidate.nextReviewAt === undefined || candidate.nextReviewAt > now),
  );
  if (!policy) return null;
  const bindings = await ctx.db.query("sourceAdapterBindings").withIndex("by_platform_and_flow_and_status", (q) =>
    q.eq("platformId", platform._id).eq("flow", policy.flow).eq("status", "active"),
  ).take(10);
  if (!bindings.some((binding) =>
    binding.sourceId === source._id && binding.adapterKey === CONTROLLED_ADAPTER_KEY &&
    binding.executor === "browserbase" && binding.config.kind === "browserbase" &&
    binding.policyVersionId === policy._id,
  )) return null;
  return connection._id;
}

async function scheduleControlledRegistration(
  ctx: MutationCtx,
  mandate: Doc<"searchMandates">,
): Promise<boolean> {
  const connectionId = await eligibleControlledRegistration(ctx, mandate);
  if (!connectionId) return false;
  let runId: Id<"browserRuns">;
  try {
    runId = await ctx.runMutation(internal.portalConnections.reserveRun, {
      ownerId: mandate.ownerId,
      connectionId,
      kind: "authenticate",
    });
  } catch {
    // An already queued/running onboarding run is the idempotent success case.
    return false;
  }
  await ctx.scheduler.runAfter(0, internal.browserbasePortal.runScheduledAgentRegistration, {
    ownerId: mandate.ownerId,
    mandateId: mandate._id,
    connectionId,
    runId,
  });
  return true;
}

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
  if (await platformIsExcluded(ctx, mandate.savedNeedId, platform._id)) return false;
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
  if (await controlledNeedsAuthConnection(ctx, mandate.ownerId)) {
    if (await scheduleControlledRegistration(ctx, mandate)) result.scheduled = 1;
    return result;
  }
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

export const validateScheduledRegistration = internalQuery({
  args: {
    ownerId: v.id("users"),
    mandateId: v.id("searchMandates"),
    connectionId: v.id("portalConnections"),
    runId: v.id("browserRuns"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const [mandate, run] = await Promise.all([
      ctx.db.get(args.mandateId),
      ctx.db.get(args.runId),
    ]);
    if (
      !mandate || mandate.ownerId !== args.ownerId ||
      !run || run.ownerId !== args.ownerId || run.connectionId !== args.connectionId ||
      run.kind !== "authenticate" || run.status !== "queued"
    ) return false;
    return await eligibleControlledRegistration(ctx, mandate, args.connectionId) !== null;
  },
});

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
