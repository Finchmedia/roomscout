import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./integrations/authz";

const statusValidator = v.union(
  v.literal("new"), v.literal("reviewing"), v.literal("saved"),
  v.literal("dismissed"), v.literal("contacted"), v.literal("converted"),
  v.literal("expired"),
);
const opportunityValidator = v.object({
  _id: v.id("opportunities"),
  savedNeedId: v.id("savedNeeds"),
  mandateId: v.optional(v.id("searchMandates")),
  kind: v.union(v.literal("supply_match"), v.literal("demand_collaboration"), v.literal("source_lead")),
  status: statusValidator,
  signalId: v.optional(v.id("signals")),
  platformId: v.optional(v.id("sourcePlatforms")),
  sourceCandidateId: v.optional(v.id("sourceCandidates")),
  score: v.number(),
  reasons: v.array(v.string()),
  uncertainties: v.array(v.string()),
  firstSeenAt: v.number(),
  lastSeenAt: v.number(),
  updatedAt: v.number(),
});

export const listMine = query({
  args: { savedNeedId: v.optional(v.id("savedNeeds")), status: v.optional(statusValidator), limit: v.optional(v.number()) },
  returns: v.array(opportunityValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 30)));
    const rows = args.savedNeedId && args.status
      ? await ctx.db.query("opportunities").withIndex("by_saved_need_and_status_and_updated_at", (q) => q.eq("savedNeedId", args.savedNeedId!).eq("status", args.status!)).order("desc").take(limit)
      : args.status
        ? await ctx.db.query("opportunities").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId).eq("status", args.status!)).order("desc").take(limit)
        : await ctx.db.query("opportunities").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(limit);
    return rows.filter((row) => row.ownerId === ownerId).map((row) => ({
      _id: row._id,
      savedNeedId: row.savedNeedId,
      mandateId: row.mandateId,
      kind: row.kind,
      status: row.status,
      signalId: row.signalId,
      platformId: row.platformId,
      sourceCandidateId: row.sourceCandidateId,
      score: row.score,
      reasons: row.reasons,
      uncertainties: row.uncertainties,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const updateStatus = mutation({
  args: { opportunityId: v.id("opportunities"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const row = await ctx.db.get(args.opportunityId);
    if (row === null || row.ownerId !== ownerId) throw new ConvexError({ code: "OPPORTUNITY_NOT_FOUND" });
    await ctx.db.patch(row._id, { status: args.status, updatedAt: Date.now() });
    return null;
  },
});

export const createHandoff = mutation({
  args: { opportunityId: v.id("opportunities"), channel: v.union(v.literal("platform"), v.literal("email"), v.literal("manual")), summary: v.string() },
  returns: v.id("handoffs"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const opportunity = await ctx.db.get(args.opportunityId);
    if (opportunity === null || opportunity.ownerId !== ownerId) throw new ConvexError({ code: "OPPORTUNITY_NOT_FOUND" });
    const summary = args.summary.trim().replace(/\s+/g, " ").slice(0, 2_000);
    if (!summary) throw new ConvexError({ code: "INVALID_SUMMARY" });
    const now = Date.now();
    const id = await ctx.db.insert("handoffs", {
      ownerId,
      savedNeedId: opportunity.savedNeedId,
      mandateId: opportunity.mandateId,
      opportunityId: opportunity._id,
      channel: args.channel,
      status: "ready",
      summary,
      contextHash: opportunity.fingerprint,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(opportunity._id, { status: "reviewing", updatedAt: now });
    return id;
  },
});
