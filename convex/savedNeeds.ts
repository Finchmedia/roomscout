import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireUserId } from "./integrations/authz";

const arrangementValidator = v.union(
  v.literal("permanent"),
  v.literal("shared"),
  v.literal("hourly"),
);
const statusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("archived"),
);
const facetValidator = v.object({
  namespace: v.string(),
  key: v.string(),
  value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
  confidence: v.number(),
});
const needValidator = v.object({
  _id: v.id("savedNeeds"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  title: v.string(),
  city: v.string(),
  districts: v.array(v.string()),
  maxBudgetEur: v.optional(v.number()),
  arrangement: v.array(arrangementValidator),
  schedule: v.array(v.string()),
  requirements: v.array(v.string()),
  openToSharing: v.optional(v.boolean()),
  radiusKm: v.optional(v.number()),
  genres: v.optional(v.array(v.string())),
  instruments: v.optional(v.array(v.string())),
  collaborationOpen: v.optional(v.boolean()),
  facets: v.optional(v.array(facetValidator)),
  status: statusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ConvexError({ code: "INVALID_FIELD", field });
  }
  return normalized;
}

function normalizedList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function validBudget(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isFinite(value) || value < 0)) {
    throw new ConvexError({ code: "INVALID_BUDGET" });
  }
  return value;
}

export const listMine = query({
  args: { status: v.optional(statusValidator), limit: v.optional(v.number()) },
  returns: v.array(needValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 30), 50));
    return args.status === undefined
      ? await ctx.db
          .query("savedNeeds")
          .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("savedNeeds")
          .withIndex("by_owner_and_status", (q) =>
            q.eq("ownerId", ownerId).eq("status", args.status!),
          )
          .order("desc")
          .take(limit);
  },
});

export const getMine = query({
  args: { needId: v.id("savedNeeds") },
  returns: v.union(needValidator, v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.needId);
    return need?.ownerId === ownerId ? need : null;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    city: v.string(),
    districts: v.array(v.string()),
    maxBudgetEur: v.optional(v.number()),
    arrangement: v.array(arrangementValidator),
    schedule: v.array(v.string()),
    requirements: v.array(v.string()),
    openToSharing: v.optional(v.boolean()),
    radiusKm: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    instruments: v.optional(v.array(v.string())),
    collaborationOpen: v.optional(v.boolean()),
    facets: v.optional(v.array(facetValidator)),
  },
  returns: v.id("savedNeeds"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const now = Date.now();
    return await ctx.db.insert("savedNeeds", {
      ownerId,
      title: requiredText(args.title, "title"),
      city: requiredText(args.city, "city"),
      districts: normalizedList(args.districts),
      maxBudgetEur: validBudget(args.maxBudgetEur),
      arrangement: [...new Set(args.arrangement)],
      schedule: normalizedList(args.schedule),
      requirements: normalizedList(args.requirements),
      openToSharing: args.openToSharing,
      radiusKm: args.radiusKm,
      genres: args.genres ? normalizedList(args.genres) : undefined,
      instruments: args.instruments ? normalizedList(args.instruments) : undefined,
      collaborationOpen: args.collaborationOpen,
      facets: args.facets,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getOrCreateDraft = mutation({
  args: {},
  returns: v.id("savedNeeds"),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const candidates = await ctx.db
      .query("savedNeeds")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(20);
    const existing = candidates.find((need) => need.status !== "archived");
    if (existing !== undefined) return existing._id;

    const now = Date.now();
    return await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "My rehearsal-room search",
      city: "",
      districts: [],
      arrangement: [],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    needId: v.id("savedNeeds"),
    title: v.optional(v.string()),
    city: v.optional(v.string()),
    districts: v.optional(v.array(v.string())),
    maxBudgetEur: v.optional(v.number()),
    arrangement: v.optional(v.array(arrangementValidator)),
    schedule: v.optional(v.array(v.string())),
    requirements: v.optional(v.array(v.string())),
    openToSharing: v.optional(v.boolean()),
    radiusKm: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    instruments: v.optional(v.array(v.string())),
    collaborationOpen: v.optional(v.boolean()),
    facets: v.optional(v.array(facetValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.needId);
    if (need === null || need.ownerId !== ownerId) {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    if (need.status === "archived") {
      throw new ConvexError({ code: "NEED_ARCHIVED" });
    }

    await ctx.db.patch(need._id, {
      ...(args.title !== undefined
        ? { title: requiredText(args.title, "title") }
        : {}),
      ...(args.city !== undefined
        ? { city: requiredText(args.city, "city") }
        : {}),
      ...(args.districts !== undefined
        ? { districts: normalizedList(args.districts) }
        : {}),
      ...(args.maxBudgetEur !== undefined
        ? { maxBudgetEur: validBudget(args.maxBudgetEur) }
        : {}),
      ...(args.arrangement !== undefined
        ? { arrangement: [...new Set(args.arrangement)] }
        : {}),
      ...(args.schedule !== undefined
        ? { schedule: normalizedList(args.schedule) }
        : {}),
      ...(args.requirements !== undefined
        ? { requirements: normalizedList(args.requirements) }
        : {}),
      ...(args.openToSharing !== undefined
        ? { openToSharing: args.openToSharing }
        : {}),
      ...(args.radiusKm !== undefined ? { radiusKm: args.radiusKm } : {}),
      ...(args.genres !== undefined ? { genres: normalizedList(args.genres) } : {}),
      ...(args.instruments !== undefined
        ? { instruments: normalizedList(args.instruments) }
        : {}),
      ...(args.collaborationOpen !== undefined
        ? { collaborationOpen: args.collaborationOpen }
        : {}),
      ...(args.facets !== undefined ? { facets: args.facets } : {}),
      updatedAt: Date.now(),
    });
    if (need.status === "active") {
      await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, {
        ownerId,
        savedNeedId: need._id,
      });
    }
    return null;
  },
});

export const setStatus = mutation({
  args: { needId: v.id("savedNeeds"), status: statusValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.needId);
    if (need === null || need.ownerId !== ownerId) {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    if (need.status === "archived" && args.status !== "archived") {
      throw new ConvexError({ code: "NEED_ARCHIVED" });
    }
    if (args.status === "active" && need.city.trim().length === 0) {
      throw new ConvexError({ code: "INCOMPLETE_NEED" });
    }
    await ctx.db.patch(need._id, { status: args.status, updatedAt: Date.now() });
    if (args.status === "active") {
      await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, {
        ownerId,
        savedNeedId: need._id,
      });
    }
    return null;
  },
});

export const getOwnedInternal = internalQuery({
  args: { needId: v.id("savedNeeds"), ownerId: v.id("users") },
  returns: v.union(needValidator, v.null()),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId);
    return need?.ownerId === args.ownerId ? need : null;
  },
});

export const updateFromScout = internalMutation({
  args: {
    needId: v.id("savedNeeds"),
    ownerId: v.id("users"),
    title: v.optional(v.string()),
    city: v.optional(v.string()),
    districts: v.optional(v.array(v.string())),
    maxBudgetEur: v.optional(v.number()),
    arrangement: v.optional(v.array(arrangementValidator)),
    schedule: v.optional(v.array(v.string())),
    requirements: v.optional(v.array(v.string())),
    openToSharing: v.optional(v.boolean()),
    radiusKm: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    instruments: v.optional(v.array(v.string())),
    collaborationOpen: v.optional(v.boolean()),
    facets: v.optional(v.array(facetValidator)),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId);
    if (need === null || need.ownerId !== args.ownerId || need.status === "archived") {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    await ctx.db.patch(need._id, {
      ...(args.title !== undefined
        ? { title: requiredText(args.title, "title") }
        : {}),
      ...(args.city !== undefined
        ? { city: args.city.trim() }
        : {}),
      ...(args.districts !== undefined
        ? { districts: normalizedList(args.districts) }
        : {}),
      ...(args.maxBudgetEur !== undefined
        ? { maxBudgetEur: validBudget(args.maxBudgetEur) }
        : {}),
      ...(args.arrangement !== undefined
        ? { arrangement: [...new Set(args.arrangement)] }
        : {}),
      ...(args.schedule !== undefined
        ? { schedule: normalizedList(args.schedule) }
        : {}),
      ...(args.requirements !== undefined
        ? { requirements: normalizedList(args.requirements) }
        : {}),
      ...(args.openToSharing !== undefined
        ? { openToSharing: args.openToSharing }
        : {}),
      ...(args.radiusKm !== undefined ? { radiusKm: args.radiusKm } : {}),
      ...(args.genres !== undefined ? { genres: normalizedList(args.genres) } : {}),
      ...(args.instruments !== undefined
        ? { instruments: normalizedList(args.instruments) }
        : {}),
      ...(args.collaborationOpen !== undefined
        ? { collaborationOpen: args.collaborationOpen }
        : {}),
      ...(args.facets !== undefined ? { facets: args.facets } : {}),
      updatedAt: Date.now(),
    });
    if (need.status === "active") {
      await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, {
        ownerId: args.ownerId,
        savedNeedId: need._id,
      });
    }
    return null;
  },
});
