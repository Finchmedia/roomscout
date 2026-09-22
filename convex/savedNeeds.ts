import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { widenArrangementForSharing } from "./lib/needArrangement";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { requireUserId } from "./integrations/authz";
import { refreshNeedMatching, setNeedStatus } from "./lib/needLifecycle";
import {
  MAX_SEARCH_RADIUS_KM,
  MIN_SEARCH_RADIUS_KM,
  getSavedNeedActivationReadiness,
  savedNeedLocationLabel,
  savedNeedLocationQuery,
} from "./lib/savedNeedLocation";
import { assertVoiceClaim, voiceClaimValidator, voiceNeedSnapshot } from "./lib/voiceClaim";

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
  locationQuery: v.optional(v.string()),
  locationLabel: v.optional(v.string()),
  maxBudgetEur: v.optional(v.number()),
  arrangement: v.array(arrangementValidator),
  schedule: v.array(v.string()),
  requirements: v.array(v.string()),
  openToSharing: v.optional(v.boolean()),
  radiusKm: v.optional(v.number()),
  centerLatitude: v.optional(v.number()),
  centerLongitude: v.optional(v.number()),
  locationPrecision: v.optional(v.union(v.literal("exact"), v.literal("postal_code"), v.literal("district"), v.literal("city"), v.literal("unknown"))),
  geocodeId: v.optional(v.id("geocodes")),
  genres: v.optional(v.array(v.string())),
  instruments: v.optional(v.array(v.string())),
  collaborationOpen: v.optional(v.boolean()),
  facets: v.optional(v.array(facetValidator)),
  status: statusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
  matchingRevision: v.optional(v.number()),
  matchingRunId: v.optional(v.string()),
});

function projectNeed(need: Doc<"savedNeeds">) {
  const locationQuery = savedNeedLocationQuery(need);
  const locationLabel = savedNeedLocationLabel(need);
  return {
    _id: need._id,
    _creationTime: need._creationTime,
    ownerId: need.ownerId,
    title: need.title,
    ...(locationQuery ? { locationQuery } : {}),
    ...(locationLabel ? { locationLabel } : {}),
    maxBudgetEur: need.maxBudgetEur,
    arrangement: need.arrangement,
    schedule: need.schedule,
    requirements: need.requirements,
    openToSharing: need.openToSharing,
    radiusKm: need.radiusKm,
    centerLatitude: need.centerLatitude,
    centerLongitude: need.centerLongitude,
    locationPrecision: need.locationPrecision,
    geocodeId: need.geocodeId,
    genres: need.genres,
    instruments: need.instruments,
    collaborationOpen: need.collaborationOpen,
    facets: need.facets,
    status: need.status,
    createdAt: need.createdAt,
    updatedAt: need.updatedAt,
    matchingRevision: need.matchingRevision,
    matchingRunId: need.matchingRunId,
  };
}

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

function validRadius(value: number | undefined): number | undefined {
  if (value !== undefined && (!Number.isFinite(value) || value < MIN_SEARCH_RADIUS_KM || value > MAX_SEARCH_RADIUS_KM)) {
    throw new ConvexError({ code: "INVALID_RADIUS" });
  }
  return value;
}

export const listMine = query({
  args: { status: v.optional(statusValidator), limit: v.optional(v.number()) },
  returns: v.array(needValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 30), 50));
    const needs = args.status === undefined
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
    return needs.map(projectNeed);
  },
});

export const getMine = query({
  args: { needId: v.id("savedNeeds") },
  returns: v.union(needValidator, v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.needId);
    return need?.ownerId === ownerId ? projectNeed(need) : null;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    locationQuery: v.string(),
    locationLabel: v.optional(v.string()),
    maxBudgetEur: v.optional(v.number()),
    arrangement: v.array(arrangementValidator),
    schedule: v.array(v.string()),
    requirements: v.array(v.string()),
    openToSharing: v.optional(v.boolean()),
    radiusKm: v.number(),
    genres: v.optional(v.array(v.string())),
    instruments: v.optional(v.array(v.string())),
    collaborationOpen: v.optional(v.boolean()),
    facets: v.optional(v.array(facetValidator)),
  },
  returns: v.id("savedNeeds"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const now = Date.now();
    const locationQuery = requiredText(args.locationQuery, "locationQuery");
    const locationLabel = args.locationLabel === undefined
      ? locationQuery
      : requiredText(args.locationLabel, "locationLabel");
    const needId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: requiredText(args.title, "title"),
      city: locationLabel,
      locationQuery,
      locationLabel,
      maxBudgetEur: validBudget(args.maxBudgetEur),
      arrangement: widenArrangementForSharing(
        args.arrangement,
        args.openToSharing,
      ),
      schedule: normalizedList(args.schedule),
      requirements: normalizedList(args.requirements),
      openToSharing: args.openToSharing,
      radiusKm: validRadius(args.radiusKm),
      genres: args.genres ? normalizedList(args.genres) : undefined,
      instruments: args.instruments ? normalizedList(args.instruments) : undefined,
      collaborationOpen: args.collaborationOpen,
      facets: args.facets,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.map.geocodeNeed, { savedNeedId: needId });
    return needId;
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
    const needId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "My rehearsal-room search",
      city: "",
      arrangement: [],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.map.geocodeNeed, { savedNeedId: needId });
    return needId;
  },
});

export const update = mutation({
  args: {
    needId: v.id("savedNeeds"),
    expectedRevision: v.optional(v.number()),
    title: v.optional(v.string()),
    locationQuery: v.optional(v.string()),
    locationLabel: v.optional(v.string()),
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
    if (args.expectedRevision !== undefined && (need.matchingRevision ?? 0) !== args.expectedRevision) {
      throw new ConvexError({
        code: "NEED_REVISION_CONFLICT",
        expectedRevision: args.expectedRevision,
        currentRevision: need.matchingRevision ?? 0,
      });
    }

    const locationQuery = args.locationQuery === undefined
      ? undefined
      : requiredText(args.locationQuery, "locationQuery");
    const locationChanged = locationQuery !== undefined &&
      locationQuery !== savedNeedLocationQuery(need);

    await ctx.db.patch(need._id, {
      ...(args.title !== undefined
        ? { title: requiredText(args.title, "title") }
        : {}),
      ...(locationQuery !== undefined ? {
        city: args.locationLabel === undefined
          ? locationQuery
          : requiredText(args.locationLabel, "locationLabel"),
        locationQuery,
        locationLabel: args.locationLabel === undefined
          ? locationQuery
          : requiredText(args.locationLabel, "locationLabel"),
      } : args.locationLabel !== undefined
        ? { locationLabel: requiredText(args.locationLabel, "locationLabel") }
        : {}),
      ...(args.maxBudgetEur !== undefined
        ? { maxBudgetEur: validBudget(args.maxBudgetEur) }
        : {}),
      ...(args.arrangement !== undefined || args.openToSharing !== undefined
        ? {
            arrangement: widenArrangementForSharing(
              args.arrangement ?? need.arrangement,
              args.openToSharing ?? need.openToSharing,
            ),
          }
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
      ...(args.radiusKm !== undefined ? { radiusKm: validRadius(args.radiusKm) } : {}),
      ...(locationChanged ? { centerLatitude: undefined, centerLongitude: undefined, locationPrecision: undefined, geocodeId: undefined } : {}),
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
    await refreshNeedMatching(ctx, need);
    if (locationChanged) await ctx.scheduler.runAfter(0, internal.map.geocodeNeed, { savedNeedId: need._id });
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
    await setNeedStatus(ctx, need, args.status);
    return null;
  },
});

export async function activateNeed(
  ctx: MutationCtx,
  ownerId: Doc<"savedNeeds">["ownerId"],
  need: Doc<"savedNeeds">,
) {
  const activation = getSavedNeedActivationReadiness(need);
  if (!activation.canActivate) {
    throw new ConvexError({ code: "INCOMPLETE_NEED", missingFields: activation.missingFields });
  }
  const wasActive = need.status === "active";
  await setNeedStatus(ctx, need, "active");
  const now = Date.now();
  await ctx.db.insert("auditEvents", {
    eventKey: `need:${need._id}:activated:${now}`,
    actorType: "user",
    actorUserId: ownerId,
    entityKey: `need:${need._id}`,
    eventType: "search.activated",
    summary: "Suche aktiviert",
    occurredAt: now,
  });
  if (wasActive) {
    await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, { ownerId, savedNeedId: need._id });
  }
  await ctx.scheduler.runAfter(0, internal.scoutOrchestrator.runForOwner, { ownerId });
  await ctx.scheduler.runAfter(0, internal.demoSourceChecks.requestAutomatic, {
    ownerId, requestId: `auto:need:${need._id}:${now}`,
  });
}

/**
 * "Schick mich los": the Suchauftrag becomes active and the Scout starts
 * working within the owner's Handlungsspielraum (ADR 0001). Pausing and
 * stopping stay with `setStatus`.
 */
export const activate = mutation({
  args: { savedNeedId: v.id("savedNeeds") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.savedNeedId);
    if (need === null || need.ownerId !== ownerId || need.status === "archived") {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    await activateNeed(ctx, ownerId, need);
    return null;
  },
});

export const getOwnedInternal = internalQuery({
  args: { needId: v.id("savedNeeds"), ownerId: v.id("users") },
  returns: v.union(needValidator, v.null()),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId);
    return need?.ownerId === args.ownerId ? projectNeed(need) : null;
  },
});

export const updateFromScout = internalMutation({
  args: {
    needId: v.id("savedNeeds"),
    ownerId: v.id("users"),
    title: v.optional(v.string()),
    locationQuery: v.optional(v.string()),
    locationLabel: v.optional(v.string()),
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
    voiceClaim: v.optional(voiceClaimValidator),
  },
  returns: v.object({ revision: v.number(), changedFields: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.needId);
    if (need === null || need.ownerId !== args.ownerId || need.status === "archived") {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    if (args.voiceClaim) {
      const { claim } = await assertVoiceClaim(ctx, args.ownerId, args.voiceClaim, { savedNeedId: need._id });
      let snapshot: Record<string, unknown> = {};
      try {
        snapshot = claim.needSnapshotJson ? JSON.parse(claim.needSnapshotJson) : {};
      } catch {
        throw new ConvexError({ code: "VOICE_TARGET_SUPERSEDED" });
      }
      const input = args as Record<string, unknown>;
      const current = {
        ...need,
        locationQuery: savedNeedLocationQuery(need),
        locationLabel: savedNeedLocationLabel(need),
      } as Record<string, unknown>;
      const guardedFields = [
        "title", "locationQuery", "locationLabel", "maxBudgetEur", "arrangement",
        "schedule", "requirements", "openToSharing", "radiusKm", "genres",
        "instruments", "collaborationOpen", "facets",
      ];
      const conflicts = guardedFields.filter(
        (field) => input[field] !== undefined &&
          JSON.stringify(current[field]) !== JSON.stringify(snapshot[field]),
      );
      if (conflicts.length > 0) {
        throw new ConvexError({ code: "VOICE_FIELD_CONFLICT", fields: conflicts });
      }
    }
    const locationQuery = args.locationQuery === undefined
      ? undefined
      : requiredText(args.locationQuery, "locationQuery");
    const locationChanged = locationQuery !== undefined &&
      locationQuery !== savedNeedLocationQuery(need);
    const desired: Record<string, unknown> = {
      ...(args.title !== undefined ? { title: requiredText(args.title, "title") } : {}),
      ...(locationQuery !== undefined ? {
        locationQuery,
        locationLabel: args.locationLabel === undefined
          ? locationQuery
          : requiredText(args.locationLabel, "locationLabel"),
      } : args.locationLabel !== undefined
        ? { locationLabel: requiredText(args.locationLabel, "locationLabel") }
        : {}),
      ...(args.maxBudgetEur !== undefined ? { maxBudgetEur: validBudget(args.maxBudgetEur) } : {}),
      ...(args.arrangement !== undefined || args.openToSharing !== undefined
        ? {
            arrangement: widenArrangementForSharing(
              args.arrangement ?? need.arrangement,
              args.openToSharing ?? need.openToSharing,
            ),
          }
        : {}),
      ...(args.schedule !== undefined ? { schedule: normalizedList(args.schedule) } : {}),
      ...(args.requirements !== undefined ? { requirements: normalizedList(args.requirements) } : {}),
      ...(args.openToSharing !== undefined ? { openToSharing: args.openToSharing } : {}),
      ...(args.radiusKm !== undefined ? { radiusKm: validRadius(args.radiusKm) } : {}),
      ...(args.genres !== undefined ? { genres: normalizedList(args.genres) } : {}),
      ...(args.instruments !== undefined ? { instruments: normalizedList(args.instruments) } : {}),
      ...(args.collaborationOpen !== undefined ? { collaborationOpen: args.collaborationOpen } : {}),
      ...(args.facets !== undefined ? { facets: args.facets } : {}),
    };
    const current: Record<string, unknown> = {
      ...need,
      locationQuery: savedNeedLocationQuery(need),
      locationLabel: savedNeedLocationLabel(need),
    };
    const changedFields = Object.keys(desired).filter(
      (field) => JSON.stringify(current[field]) !== JSON.stringify(desired[field]),
    );
    if (changedFields.length === 0) {
      return { revision: need.matchingRevision ?? 0, changedFields: [] };
    }
    await ctx.db.patch(need._id, {
      ...(args.title !== undefined
        ? { title: requiredText(args.title, "title") }
        : {}),
      ...(locationQuery !== undefined ? {
        city: args.locationLabel === undefined
          ? locationQuery
          : requiredText(args.locationLabel, "locationLabel"),
        locationQuery,
        locationLabel: args.locationLabel === undefined
          ? locationQuery
          : requiredText(args.locationLabel, "locationLabel"),
      } : args.locationLabel !== undefined
        ? { locationLabel: requiredText(args.locationLabel, "locationLabel") }
        : {}),
      ...(args.maxBudgetEur !== undefined
        ? { maxBudgetEur: validBudget(args.maxBudgetEur) }
        : {}),
      ...(args.arrangement !== undefined || args.openToSharing !== undefined
        ? {
            arrangement: widenArrangementForSharing(
              args.arrangement ?? need.arrangement,
              args.openToSharing ?? need.openToSharing,
            ),
          }
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
      ...(args.radiusKm !== undefined ? { radiusKm: validRadius(args.radiusKm) } : {}),
      ...(locationChanged ? { centerLatitude: undefined, centerLongitude: undefined, locationPrecision: undefined, geocodeId: undefined } : {}),
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
    const revision = await refreshNeedMatching(ctx, need);
    if (args.voiceClaim) {
      const [session, updatedNeed] = await Promise.all([
        ctx.db.get(args.voiceClaim.voiceSessionId),
        ctx.db.get(need._id),
      ]);
      if (
        session?.activeClaim && updatedNeed &&
        session.activeClaim.requestId === args.voiceClaim.requestId &&
        session.activeClaim.generation === args.voiceClaim.generation
      ) {
        const previousSnapshot = JSON.parse(session.activeClaim.needSnapshotJson ?? "{}") as Record<string, unknown>;
        const updatedSnapshot = JSON.parse(voiceNeedSnapshot(updatedNeed)) as Record<string, unknown>;
        for (const field of changedFields) previousSnapshot[field] = updatedSnapshot[field];
        await ctx.db.patch(session._id, {
          activeClaim: {
            ...session.activeClaim,
            needRevision: revision,
            needSnapshotJson: JSON.stringify(previousSnapshot),
          },
        });
      }
    }
    if (locationChanged) await ctx.scheduler.runAfter(0, internal.map.geocodeNeed, { savedNeedId: need._id });
    return { revision, changedFields };
  },
});
