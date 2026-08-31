import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import { requireActionUserId, requireUserId } from "./integrations/authz";
import { scoreSignalMatch, type MatchSignal } from "./matchingCore";
import { createOpenAIEmbedding, OPENAI_EMBEDDING_MODEL } from "./openaiEmbeddings";

const matchStatus = v.union(
  v.literal("new"),
  v.literal("seen"),
  v.literal("saved"),
  v.literal("dismissed"),
  v.literal("contacted"),
);

function embeddingInputForNeed(need: {
  title: string;
  city: string;
  districts: string[];
  maxBudgetEur?: number;
  arrangement: string[];
  schedule: string[];
  requirements: string[];
  genres?: string[];
  instruments?: string[];
}) {
  return [
    need.title,
    `City: ${need.city}`,
    need.districts.length ? `Areas: ${need.districts.join(", ")}` : undefined,
    need.maxBudgetEur === undefined ? undefined : `Maximum budget: EUR ${need.maxBudgetEur}`,
    `Arrangements: ${need.arrangement.join(", ")}`,
    `Schedule: ${need.schedule.join(", ")}`,
    `Requirements: ${need.requirements.join(", ")}`,
    need.genres?.length ? `Genres: ${need.genres.join(", ")}` : undefined,
    need.instruments?.length ? `Instruments: ${need.instruments.join(", ")}` : undefined,
  ].filter(Boolean).join(". ");
}

function embeddingInputForSignal(signal: {
  side: string;
  title: string;
  city: string;
  district?: string;
  summary: string;
  arrangement: string;
  requirements: string[];
  genres?: string[];
  instruments?: string[];
}) {
  return [
    `${signal.side} signal: ${signal.title}`,
    `Location: ${signal.district ? `${signal.district}, ` : ""}${signal.city}`,
    signal.summary,
    `Arrangement: ${signal.arrangement}`,
    `Requirements: ${signal.requirements.join(", ")}`,
    signal.genres?.length ? `Genres: ${signal.genres.join(", ")}` : undefined,
    signal.instruments?.length ? `Instruments: ${signal.instruments.join(", ")}` : undefined,
  ].filter(Boolean).join(". ");
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const getNeedForMatching = internalQuery({
  args: { savedNeedId: v.id("savedNeeds"), ownerId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("savedNeeds"),
      ownerId: v.id("users"),
      title: v.string(),
      city: v.string(),
      districts: v.array(v.string()),
      maxBudgetEur: v.optional(v.number()),
      arrangement: v.array(v.union(v.literal("permanent"), v.literal("shared"), v.literal("hourly"))),
      schedule: v.array(v.string()),
      requirements: v.array(v.string()),
      openToSharing: v.optional(v.boolean()),
      collaborationOpen: v.optional(v.boolean()),
      genres: v.optional(v.array(v.string())),
      instruments: v.optional(v.array(v.string())),
      radiusKm: v.optional(v.number()),
      centerLatitude: v.optional(v.number()),
      centerLongitude: v.optional(v.number()),
      status: v.union(v.literal("draft"), v.literal("active"), v.literal("paused"), v.literal("archived")),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (need === null || need.ownerId !== args.ownerId) return null;
    const area = await ctx.db.query("marketAreas").withIndex("by_city_key", (q) => q.eq("cityKey", need.city.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim())).unique();
    return {
      _id: need._id,
      ownerId: need.ownerId,
      title: need.title,
      city: need.city,
      districts: need.districts,
      maxBudgetEur: need.maxBudgetEur,
      arrangement: need.arrangement,
      schedule: need.schedule,
      requirements: need.requirements,
      openToSharing: need.openToSharing,
      collaborationOpen: need.collaborationOpen,
      genres: need.genres,
      instruments: need.instruments,
      radiusKm: need.radiusKm,
      centerLatitude: area?.latitude,
      centerLongitude: area?.longitude,
      status: need.status,
      updatedAt: need.updatedAt,
    };
  },
});

const candidateSignal = v.object({
  _id: v.id("signals"),
  side: v.union(v.literal("supply"), v.literal("demand")),
  title: v.string(),
  city: v.string(),
  district: v.optional(v.string()),
  summary: v.string(),
  arrangement: v.union(v.literal("permanent"), v.literal("shared"), v.literal("hourly"), v.literal("unknown")),
  priceEur: v.optional(v.number()),
  requirements: v.array(v.string()),
  genres: v.optional(v.array(v.string())),
  instruments: v.optional(v.array(v.string())),
  facets: v.optional(v.array(v.object({
    namespace: v.string(),
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean(), v.array(v.string())),
    confidence: v.number(),
  }))),
  lastSeenAt: v.number(),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
});

export const getCandidateSignals = internalQuery({
  args: { city: v.string(), signalIds: v.array(v.id("signals")) },
  returns: v.array(candidateSignal),
  handler: async (ctx, args) => {
    const selected = new Map<Id<"signals">, Doc<"signals">>();
    for (const signalId of args.signalIds.slice(0, 100)) {
      const signal = await ctx.db.get(signalId);
      if (signal && (signal.status === "published" || signal.status === "stale")) {
        selected.set(signal._id, signal);
      }
    }
    for (const status of ["published", "stale"] as const) {
      const local = await ctx.db
        .query("signals")
        .withIndex("by_city_and_status", (q) => q.eq("city", args.city).eq("status", status))
        .order("desc")
        .take(75);
      for (const signal of local) selected.set(signal._id, signal);
    }
    return [...selected.values()].slice(0, 150).map((signal) => ({
      _id: signal._id,
      side: signal.side,
      title: signal.title,
      city: signal.city,
      district: signal.district,
      summary: signal.summary,
      arrangement: signal.arrangement,
      priceEur: signal.priceEur,
      requirements: signal.requirements,
      genres: signal.genres,
      instruments: signal.instruments,
      facets: signal.facets,
      lastSeenAt: signal.lastSeenAt,
      latitude: signal.latitude,
      longitude: signal.longitude,
    }));
  },
});

export const saveNeedEmbedding = internalMutation({
  args: {
    savedNeedId: v.id("savedNeeds"),
    ownerId: v.id("users"),
    inputHash: v.string(),
    embedding: v.array(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("savedNeedEmbeddings")
      .withIndex("by_saved_need", (q) => q.eq("savedNeedId", args.savedNeedId))
      .unique();
    const value = {
      ownerId: args.ownerId,
      model: OPENAI_EMBEDDING_MODEL,
      inputHash: args.inputHash,
      embedding: args.embedding,
      updatedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("savedNeedEmbeddings", { ...value, savedNeedId: args.savedNeedId, createdAt: Date.now() });
    return null;
  },
});

export const applyMatches = internalMutation({
  args: {
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    matches: v.array(v.object({
      signalId: v.id("signals"),
      kind: v.union(v.literal("need_supply"), v.literal("demand_demand")),
      score: v.number(),
      structuredScore: v.number(),
      semanticScore: v.number(),
      reasons: v.array(v.string()),
      uncertainties: v.array(v.string()),
      fingerprint: v.string(),
    })),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (need === null || need.ownerId !== args.ownerId || need.status !== "active") return 0;
    let created = 0;
    for (const match of args.matches.slice(0, 100)) {
      const existing = await ctx.db
        .query("signalMatches")
        .withIndex("by_saved_need_and_signal", (q) => q.eq("savedNeedId", args.savedNeedId).eq("signalId", match.signalId))
        .unique();
      const now = Date.now();
      if (existing) {
        if (existing.fingerprint !== match.fingerprint) {
          await ctx.db.patch(existing._id, { ...match, updatedAt: now });
        }
        const opportunityFingerprint = `match:${args.savedNeedId}:${match.signalId}`;
        const opportunity = await ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) => q.eq("savedNeedId", args.savedNeedId).eq("fingerprint", opportunityFingerprint)).unique();
        if (opportunity !== null && opportunity.status !== "dismissed" && opportunity.status !== "converted") {
          await ctx.db.patch(opportunity._id, { score: match.score, reasons: match.reasons, uncertainties: match.uncertainties, lastSeenAt: now, updatedAt: now });
        }
        continue;
      }
      const signalMatchId = await ctx.db.insert("signalMatches", {
        ownerId: args.ownerId,
        savedNeedId: args.savedNeedId,
        ...match,
        status: "new",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("notifications", {
        ownerId: args.ownerId,
        kind: "new_match",
        title: "RoomScout found a new match",
        body: match.reasons.slice(0, 2).join(" · "),
        signalMatchId,
        createdAt: now,
      });
      const opportunityFingerprint = `match:${args.savedNeedId}:${match.signalId}`;
      const opportunity = await ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) => q.eq("savedNeedId", args.savedNeedId).eq("fingerprint", opportunityFingerprint)).unique();
      if (opportunity === null) {
        await ctx.db.insert("opportunities", {
          ownerId: args.ownerId,
          savedNeedId: args.savedNeedId,
          kind: match.kind === "need_supply" ? "supply_match" : "demand_collaboration",
          status: "new",
          signalId: match.signalId,
          score: match.score,
          reasons: match.reasons,
          uncertainties: match.uncertainties,
          fingerprint: opportunityFingerprint,
          firstSeenAt: now,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        });
      }
      created += 1;
    }
    return created;
  },
});

async function recompute(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  savedNeedId: Id<"savedNeeds">,
): Promise<number> {
  const need = await ctx.runQuery(internal.matches.getNeedForMatching, { ownerId, savedNeedId });
  if (need === null || need.status !== "active") return 0;
  const input = embeddingInputForNeed(need);
  const embedding = await createOpenAIEmbedding(input);
  let semanticMatches: Array<{ _id: Id<"signalEmbeddings">; _score: number }> = [];
  if (embedding) {
    await ctx.runMutation(internal.matches.saveNeedEmbedding, {
      savedNeedId,
      ownerId,
      inputHash: stableHash(input),
      embedding,
    });
    semanticMatches = await ctx.vectorSearch("signalEmbeddings", "by_embedding", {
      vector: embedding,
      limit: 100,
    });
  }
  const embeddingRows: Array<{ signalId: Id<"signals">; score: number }> = await ctx.runQuery(internal.matches.resolveSignalEmbeddingIds, {
    matches: semanticMatches.map((item) => ({
      embeddingId: item._id,
      score: item._score,
    })),
  });
  const semanticBySignal = new Map<Id<"signals">, number>();
  embeddingRows.forEach((row) => semanticBySignal.set(row.signalId, row.score));
  const candidates: Array<MatchSignal & { _id: Id<"signals">; lastSeenAt: number }> = await ctx.runQuery(internal.matches.getCandidateSignals, {
    city: need.city,
    signalIds: [...semanticBySignal.keys()],
  });
  const matches = candidates.flatMap((signal) => {
    const score = scoreSignalMatch(need, signal, semanticBySignal.get(signal._id) ?? 0);
    if (!score.eligible) return [];
    return [{
      signalId: signal._id,
      kind: score.kind,
      score: score.score,
      structuredScore: score.structuredScore,
      semanticScore: score.semanticScore,
      reasons: score.reasons,
      uncertainties: score.uncertainties,
      fingerprint: stableHash(`${need.updatedAt}:${signal.lastSeenAt}:${score.score.toFixed(5)}`),
    }];
  });
  return await ctx.runMutation(internal.matches.applyMatches, { ownerId, savedNeedId, matches });
}

export const resolveSignalEmbeddingIds = internalQuery({
  args: {
    matches: v.array(v.object({
      embeddingId: v.id("signalEmbeddings"),
      score: v.number(),
    })),
  },
  returns: v.array(v.object({ signalId: v.id("signals"), score: v.number() })),
  handler: async (ctx, args) => {
    const rows = [];
    for (const match of args.matches) {
      const row = await ctx.db.get(match.embeddingId);
      if (row) rows.push({ signalId: row.signalId, score: match.score });
    }
    return rows;
  },
});

export const recomputeNeed = internalAction({
  args: { ownerId: v.id("users"), savedNeedId: v.id("savedNeeds") },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => await recompute(ctx, args.ownerId, args.savedNeedId),
});

export const recomputeMine = action({
  args: { savedNeedId: v.id("savedNeeds") },
  returns: v.object({ created: v.number() }),
  handler: async (ctx, args): Promise<{ created: number }> => {
    const ownerId = await requireActionUserId(ctx);
    return { created: await recompute(ctx, ownerId, args.savedNeedId) };
  },
});

export const getSignalEmbeddingInput = internalQuery({
  args: { signalId: v.id("signals") },
  returns: v.union(v.object({ text: v.string(), city: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (!signal || (signal.status !== "published" && signal.status !== "stale")) return null;
    return { text: embeddingInputForSignal(signal), city: signal.city };
  },
});

export const saveSignalEmbedding = internalMutation({
  args: { signalId: v.id("signals"), inputHash: v.string(), embedding: v.array(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("signalEmbeddings").withIndex("by_signal", (q) => q.eq("signalId", args.signalId)).unique();
    const value = { model: OPENAI_EMBEDDING_MODEL, inputHash: args.inputHash, embedding: args.embedding, updatedAt: Date.now() };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("signalEmbeddings", { ...value, signalId: args.signalId, createdAt: Date.now() });
    return null;
  },
});

export const embedSignal = internalAction({
  args: { signalId: v.id("signals") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(internal.matches.getSignalEmbeddingInput, args);
    if (!input) return null;
    const embedding = await createOpenAIEmbedding(input.text);
    if (embedding) await ctx.runMutation(internal.matches.saveSignalEmbedding, { signalId: args.signalId, inputHash: stableHash(input.text), embedding });
    const needs = await ctx.runQuery(internal.matches.listActiveNeedOwnersInCity, { city: input.city });
    for (const need of needs) {
      await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, need);
    }
    return null;
  },
});

export const listActiveNeedOwnersInCity = internalQuery({
  args: { city: v.string() },
  returns: v.array(v.object({ ownerId: v.id("users"), savedNeedId: v.id("savedNeeds") })),
  handler: async (ctx, args) => {
    const needs = await ctx.db.query("savedNeeds").withIndex("by_status_and_city", (q) => q.eq("status", "active").eq("city", args.city)).take(50);
    return needs.map((need) => ({ ownerId: need.ownerId, savedNeedId: need._id }));
  },
});

export const listMine = query({
  args: { status: v.optional(matchStatus), limit: v.optional(v.number()) },
  returns: v.array(v.object({
    _id: v.id("signalMatches"),
    savedNeedId: v.id("savedNeeds"),
    signalId: v.id("signals"),
    kind: v.union(v.literal("need_supply"), v.literal("demand_demand")),
    score: v.number(),
    reasons: v.array(v.string()),
    uncertainties: v.array(v.string()),
    status: matchStatus,
    updatedAt: v.number(),
    signalTitle: v.string(),
    signalCity: v.string(),
    signalSide: v.union(v.literal("supply"), v.literal("demand")),
  })),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 30)));
    const matches = await ctx.db
      .query("signalMatches")
      .withIndex("by_owner_and_status_and_updated_at", (q) =>
        args.status ? q.eq("ownerId", ownerId).eq("status", args.status) : q.eq("ownerId", ownerId),
      )
      .order("desc")
      .take(limit);
    const result = [];
    for (const match of matches) {
      const signal = await ctx.db.get(match.signalId);
      if (!signal || (signal.status !== "published" && signal.status !== "stale")) continue;
      result.push({
        _id: match._id,
        savedNeedId: match.savedNeedId,
        signalId: match.signalId,
        kind: match.kind,
        score: match.score,
        reasons: match.reasons,
        uncertainties: match.uncertainties,
        status: match.status,
        updatedAt: match.updatedAt,
        signalTitle: signal.title,
        signalCity: signal.city,
        signalSide: signal.side,
      });
    }
    return result;
  },
});

export const updateStatus = mutation({
  args: { matchId: v.id("signalMatches"), status: matchStatus },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const match = await ctx.db.get(args.matchId);
    if (!match || match.ownerId !== ownerId) throw new ConvexError({ code: "MATCH_NOT_FOUND" });
    await ctx.db.patch(match._id, { status: args.status, updatedAt: Date.now() });
    return null;
  },
});
