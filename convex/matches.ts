import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
} from "./_generated/server";
import { requireActionUserId, requireUserId } from "./integrations/authz";
import { scoreSignalMatch } from "./matchingCore";
import { createOpenAIEmbedding, OPENAI_EMBEDDING_MODEL } from "./openaiEmbeddings";
import { isCurrentMatch, signalMatchRevision } from "./lib/matchValidity";
import { generateRoomScoutObject } from "./ai";
import { listingEvidence, matchAssessmentSchema, validateMatchAssessment, MATCH_ASSESSMENT_INSTRUCTIONS, type MatchAssessment } from "./lib/matchAssessment";
import { projectSignal, signalProjectionValidator } from "./signals";
import { roomScoutRateLimiter } from "./rateLimits";

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
      matchingRevision: v.number(),
      matchingRunId: v.optional(v.string()),
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
      matchingRevision: need.matchingRevision ?? 0,
      matchingRunId: need.matchingRunId,
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
  pricePeriod: v.optional(v.union(v.literal("month"), v.literal("hour"), v.literal("unknown"))),
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
  revision: v.string(),
  embedding: v.optional(v.array(v.number())),
});

export const getCandidateSignals = internalQuery({
  args: { city: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.object({ page: v.array(candidateSignal), continueCursor: v.string(), isDone: v.boolean() }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("signals")
      .withIndex("by_city_and_status", (q) => q.eq("city", args.city).eq("status", "published"))
      .paginate({ cursor: args.cursor, numItems: 25 });
    const page = await Promise.all(result.page.map(async (signal) => {
      const stored = await ctx.db.query("signalEmbeddings").withIndex("by_signal", (q) => q.eq("signalId", signal._id)).unique();
      return {
      _id: signal._id,
      side: signal.side,
      title: signal.title,
      city: signal.city,
      district: signal.district,
      summary: signal.summary,
      arrangement: signal.arrangement,
      priceEur: signal.priceEur,
      pricePeriod: signal.pricePeriod,
      requirements: signal.requirements,
      genres: signal.genres,
      instruments: signal.instruments,
      facets: signal.facets,
      lastSeenAt: signal.lastSeenAt,
      latitude: signal.latitude,
      longitude: signal.longitude,
      revision: await signalMatchRevision(signal),
      embedding: stored?.inputHash === stableHash(embeddingInputForSignal(signal)) && stored.model === OPENAI_EMBEDDING_MODEL
        ? stored.embedding : undefined,
      };
    }));
    return { page, continueCursor: result.continueCursor, isDone: result.isDone };
  },
});

export const beginMatching = internalMutation({
  args: { ownerId: v.id("users"), savedNeedId: v.id("savedNeeds") },
  returns: v.union(v.object({ needRevision: v.number(), matchingRunId: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (!need || need.ownerId !== args.ownerId || need.status !== "active") return null;
    const matchingRunId = crypto.randomUUID();
    await ctx.db.patch(need._id, { matchingRunId });
    return { needRevision: need.matchingRevision ?? 0, matchingRunId };
  },
});

export const getNeedEmbedding = internalQuery({
  args: { ownerId: v.id("users"), savedNeedId: v.id("savedNeeds"), inputHash: v.string() },
  returns: v.union(v.array(v.number()), v.null()),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (!need || need.ownerId !== args.ownerId) return null;
    const row = await ctx.db.query("savedNeedEmbeddings").withIndex("by_saved_need", (q) => q.eq("savedNeedId", args.savedNeedId)).unique();
    return row?.ownerId === args.ownerId && row.inputHash === args.inputHash && row.model === OPENAI_EMBEDDING_MODEL ? row.embedding : null;
  },
});

export const saveNeedEmbedding = internalMutation({
  args: {
    savedNeedId: v.id("savedNeeds"),
    ownerId: v.id("users"),
    inputHash: v.string(),
    needRevision: v.number(),
    embedding: v.array(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (!need || need.ownerId !== args.ownerId || (need.matchingRevision ?? 0) !== args.needRevision) return null;
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
    needRevision: v.number(),
    matchingRunId: v.string(),
    matches: v.array(v.object({
      signalId: v.id("signals"),
      signalRevision: v.string(),
      eligible: v.boolean(),
      contactEligible: v.optional(v.boolean()),
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
    if (need === null || need.ownerId !== args.ownerId || need.status !== "active" ||
      (need.matchingRevision ?? 0) !== args.needRevision || need.matchingRunId !== args.matchingRunId) return 0;
    if (args.matches.length > 25) throw new ConvexError({ code: "MATCH_BATCH_TOO_LARGE" });
    let created = 0;
    for (const match of args.matches) {
      const signal = await ctx.db.get(match.signalId);
      if (!signal || signal.status !== "published" || await signalMatchRevision(signal) !== match.signalRevision) continue;
      const existing = await ctx.db
        .query("signalMatches")
        .withIndex("by_saved_need_and_signal", (q) => q.eq("savedNeedId", args.savedNeedId).eq("signalId", match.signalId))
        .unique();
      const now = Date.now();
      const value = { ...match, needRevision: args.needRevision, matchingRunId: args.matchingRunId, updatedAt: now };
      const opportunityFingerprint = `match:${args.savedNeedId}:${match.signalId}`;
      const opportunity = await ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) => q.eq("savedNeedId", args.savedNeedId).eq("fingerprint", opportunityFingerprint)).unique();
      if (!match.eligible) {
        if (existing) await ctx.db.patch(existing._id, value);
        if (opportunity && !["contacted", "dismissed", "converted"].includes(opportunity.status)) {
          await ctx.db.patch(opportunity._id, { status: "expired", updatedAt: now });
        }
        continue;
      }
      if (existing) {
        await ctx.db.patch(existing._id, value);
        if (opportunity !== null && opportunity.status !== "dismissed" && opportunity.status !== "converted") {
          await ctx.db.patch(opportunity._id, {
            score: match.score, reasons: match.reasons, uncertainties: match.uncertainties, lastSeenAt: now, updatedAt: now,
            status: opportunity.status === "expired" && existing.status !== "dismissed" ? "new" : opportunity.status,
          });
        }
        continue;
      }
      const signalMatchId = await ctx.db.insert("signalMatches", {
        ownerId: args.ownerId,
        savedNeedId: args.savedNeedId,
        ...value,
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

const matchingRunArgs = {
  ownerId: v.id("users"), savedNeedId: v.id("savedNeeds"), needRevision: v.number(),
  matchingRunId: v.string(), cursor: v.union(v.string(), v.null()),
};
type MatchingRun = { ownerId: Id<"users">; savedNeedId: Id<"savedNeeds">; needRevision: number; matchingRunId: string; cursor: string | null };

async function retireMatch(ctx: MutationCtx, match: { _id: Id<"signalMatches">; savedNeedId: Id<"savedNeeds">; signalId: Id<"signals"> }) {
  await ctx.db.patch(match._id, { eligible: false, contactEligible: false, updatedAt: Date.now() });
  const opportunity = await ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) =>
    q.eq("savedNeedId", match.savedNeedId).eq("fingerprint", `match:${match.savedNeedId}:${match.signalId}`)).unique();
  if (opportunity && !["contacted", "dismissed", "converted"].includes(opportunity.status)) {
    await ctx.db.patch(opportunity._id, { status: "expired", updatedAt: Date.now() });
  }
}

export const retireNeedMatches = internalMutation({
  args: { ownerId: v.id("users"), savedNeedId: v.id("savedNeeds"), needRevision: v.number(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (!need || need.ownerId !== args.ownerId || (need.matchingRevision ?? 0) !== args.needRevision) return null;
    const result = await ctx.db.query("signalMatches").withIndex("by_saved_need_and_signal", (q) => q.eq("savedNeedId", need._id))
      .paginate({ cursor: args.cursor, numItems: 25 });
    for (const match of result.page) if (!await isCurrentMatch(ctx, match)) await retireMatch(ctx, match);
    if (!result.isDone) await ctx.scheduler.runAfter(0, internal.matches.retireNeedMatches, { ...args, cursor: result.continueCursor });
    return null;
  },
});

export const retireSignalMatches = internalMutation({
  args: { signalId: v.id("signals"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("signalMatches").withIndex("by_signal", (q) => q.eq("signalId", args.signalId))
      .paginate({ cursor: args.cursor, numItems: 25 });
    for (const match of result.page) if (!await isCurrentMatch(ctx, match)) await retireMatch(ctx, match);
    if (!result.isDone) await ctx.scheduler.runAfter(0, internal.matches.retireSignalMatches, { ...args, cursor: result.continueCursor });
    return null;
  },
});

// Retirement is paginated too: old rows stay as history, but cannot drive outreach.
export const finishMatching = internalMutation({
  args: matchingRunArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const need = await ctx.db.get(args.savedNeedId);
    if (!need || need.ownerId !== args.ownerId || need.status !== "active" ||
      (need.matchingRevision ?? 0) !== args.needRevision || need.matchingRunId !== args.matchingRunId) return null;
    const result = await ctx.db.query("signalMatches").withIndex("by_saved_need_and_signal", (q) => q.eq("savedNeedId", need._id))
      .paginate({ cursor: args.cursor, numItems: 25 });
    for (const match of result.page) {
      if (match.matchingRunId === args.matchingRunId && await isCurrentMatch(ctx, match)) continue;
      await retireMatch(ctx, match);
    }
    if (!result.isDone) {
      await ctx.scheduler.runAfter(0, internal.matches.finishMatching, { ...args, cursor: result.continueCursor });
    } else {
      await ctx.scheduler.runAfter(0, internal.mandateOrchestrator.runForOwner, { ownerId: args.ownerId });
    }
    return null;
  },
});

function cosine(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  let dot = 0, a = 0, b = 0;
  for (let i = 0; i < left.length; i++) {
    const x = left[i]!, y = right[i]!;
    dot += x * y; a += x ** 2; b += y ** 2;
  }
  return a && b ? Math.max(0, Math.min(1, dot / Math.sqrt(a * b))) : 0;
}

async function processPage(ctx: ActionCtx, args: MatchingRun): Promise<number> {
  const need = await ctx.runQuery(internal.matches.getNeedForMatching, argsForNeed(args));
  if (!need || need.status !== "active" || need.matchingRevision !== args.needRevision || need.matchingRunId !== args.matchingRunId) return 0;
  const embedding = await ctx.runQuery(internal.matches.getNeedEmbedding, { ...argsForNeed(args), inputHash: stableHash(embeddingInputForNeed(need)) });
  const result = await ctx.runQuery(internal.matches.getCandidateSignals, { city: need.city, cursor: args.cursor });
  const evaluate = async (signal: (typeof result.page)[number]) => {
    const similarity = embedding && signal.embedding ? cosine(embedding, signal.embedding) : 0;
    let assessment: MatchAssessment | undefined;
    // Cheap deterministic exclusions precede model calls; a lower ranking is not
    // an exclusion because interpretation can establish previously unknown facts.
    const sameCity = need.city.normalize("NFKC").toLocaleLowerCase().trim() === signal.city.normalize("NFKC").toLocaleLowerCase().trim();
    const priceConflict = signal.side === "supply" && signal.pricePeriod === "month" && signal.priceEur !== undefined && need.maxBudgetEur !== undefined && signal.priceEur > need.maxBudgetEur;
    const arrangementConflict = signal.arrangement !== "unknown" && need.arrangement.length > 0 && !need.arrangement.includes(signal.arrangement);
    if (sameCity && !priceConflict && !arrangementConflict) {
      const cacheKey = { ...argsForNeed(args), needRevision: args.needRevision, signalId: signal._id, signalRevision: signal.revision };
      const cached = await ctx.runQuery(internal.matchAssessments.getCached, cacheKey);
      if (cached?.assessment) assessment = cached.assessment;
      else if (!cached) {
        try {
          const output = await generateRoomScoutObject({
            schema: matchAssessmentSchema, instructions: MATCH_ASSESSMENT_INSTRUCTIONS, timeoutMs: 45_000,
            prompt: JSON.stringify({ need: { requirements: need.requirements, schedule: need.schedule, maxMonthlyBudgetEur: need.maxBudgetEur, genres: need.genres, instruments: need.instruments },
              listingEvidence: listingEvidence(signal) }),
          });
          assessment = validateMatchAssessment(output, need, signal);
        } catch {
          // Provider failures and ungrounded outputs never authorize first contact.
          console.warn("Match semantic assessment unavailable; outreach held pending retry");
        }
        await ctx.runMutation(internal.matchAssessments.save, { ...cacheKey, assessment });
      }
    }
    const score = scoreSignalMatch(need, signal, similarity, assessment);
    if (score.eligible && !assessment) score.uncertainties.push("AI condition check is pending; automatic contact is on hold");
    return { ...score, contactEligible: score.eligible && assessment !== undefined, signalId: signal._id, signalRevision: signal.revision,
      fingerprint: stableHash(`${args.needRevision}:${signal.revision}:${JSON.stringify(score)}`) };
  };
  const matches = [];
  // Bound each page to two simultaneous model calls. Global scheduling is added
  // by the Workpool delivery milestone, not implicitly claimed here.
  for (let offset = 0; offset < result.page.length; offset += 2) {
    matches.push(...await Promise.all(result.page.slice(offset, offset + 2).map(evaluate)));
  }
  const created = await ctx.runMutation(internal.matches.applyMatches, { ...argsForNeed(args), needRevision: args.needRevision, matchingRunId: args.matchingRunId, matches });
  if (result.isDone) await ctx.runMutation(internal.matches.finishMatching, { ...args, cursor: null });
  else await ctx.scheduler.runAfter(0, internal.matches.continueMatching, { ...args, cursor: result.continueCursor });
  return created;
}

function argsForNeed(args: { ownerId: Id<"users">; savedNeedId: Id<"savedNeeds"> }) {
  return { ownerId: args.ownerId, savedNeedId: args.savedNeedId };
}

export const continueMatching = internalAction({
  args: matchingRunArgs,
  returns: v.number(),
  handler: processPage,
});

async function recompute(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  savedNeedId: Id<"savedNeeds">,
): Promise<number> {
  const run = await ctx.runMutation(internal.matches.beginMatching, { ownerId, savedNeedId });
  if (!run) return 0;
  const need = await ctx.runQuery(internal.matches.getNeedForMatching, { ownerId, savedNeedId });
  if (need === null || need.status !== "active" || need.matchingRunId !== run.matchingRunId) return 0;
  const input = embeddingInputForNeed(need);
  const inputHash = stableHash(input);
  const cached = await ctx.runQuery(internal.matches.getNeedEmbedding, { ownerId, savedNeedId, inputHash });
  if (!cached) {
    try {
      const embedding = await createOpenAIEmbedding(input);
      if (embedding) await ctx.runMutation(internal.matches.saveNeedEmbedding, { savedNeedId, ownerId, inputHash, needRevision: run.needRevision, embedding });
    } catch {
      // Availability of embeddings must not suppress exact constraint matching.
      console.warn("Need embedding unavailable; continuing without semantic ranking");
    }
  }
  return await processPage(ctx, { ownerId, savedNeedId, ...run, cursor: null });
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
    await roomScoutRateLimiter.limit(ctx, "matchRefresh", { key: ownerId, throws: true });
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
    const signal = await ctx.db.get(args.signalId);
    if (!signal || signal.status !== "published" || stableHash(embeddingInputForSignal(signal)) !== args.inputHash) return null;
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
    await ctx.runMutation(internal.matches.retireSignalMatches, { ...args, cursor: null });
    const input = await ctx.runQuery(internal.matches.getSignalEmbeddingInput, args);
    if (!input) return null;
    try {
      const embedding = await createOpenAIEmbedding(input.text);
      if (embedding) await ctx.runMutation(internal.matches.saveSignalEmbedding, { signalId: args.signalId, inputHash: stableHash(input.text), embedding });
    } catch {
      console.warn("Signal embedding unavailable; continuing exact constraint matching");
    }
    await ctx.runMutation(internal.matches.rematchCity, { city: input.city, cursor: null });
    return null;
  },
});

export const rematchCity = internalMutation({
  args: { city: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const result = await ctx.db.query("savedNeeds").withIndex("by_status_and_city", (q) => q.eq("status", "active").eq("city", args.city))
      .paginate({ cursor: args.cursor, numItems: 25 });
    for (const need of result.page) await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, { ownerId: need.ownerId, savedNeedId: need._id });
    if (!result.isDone) await ctx.scheduler.runAfter(0, internal.matches.rematchCity, { ...args, cursor: result.continueCursor });
    return null;
  },
});

export const listMine = query({
  args: { status: v.optional(matchStatus), limit: v.optional(v.number()), savedNeedId: v.optional(v.id("savedNeeds")) },
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
    signal: signalProjectionValidator,
    contactEligible: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 30)));
    const need = args.savedNeedId ? await ctx.db.get(args.savedNeedId) : null;
    if (args.savedNeedId && (!need || need.ownerId !== ownerId || need.status !== "active")) return [];
    const matches = need ? await ctx.db.query("signalMatches")
      .withIndex("by_need_revision_and_eligible_score", (q) => q.eq("savedNeedId", need._id).eq("needRevision", need.matchingRevision ?? 0).eq("eligible", true))
      .order("desc").take(200) : await ctx.db
      .query("signalMatches")
      .withIndex("by_owner_and_eligible_and_updated_at", (q) => q.eq("ownerId", ownerId).eq("eligible", true))
      .order("desc")
      .take(200);
    const result = [];
    for (const match of matches) {
      if ((args.status && match.status !== args.status) || (!args.status && match.status === "dismissed") ||
        (args.savedNeedId && match.savedNeedId !== args.savedNeedId) || !await isCurrentMatch(ctx, match)) continue;
      const signal = await ctx.db.get(match.signalId);
      if (!signal) continue;
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
        signal: projectSignal(signal),
        contactEligible: match.contactEligible === true,
      });
      if (result.length >= limit) break;
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
    if (args.status !== "dismissed" && !await isCurrentMatch(ctx, match)) throw new ConvexError({ code: "MATCH_NO_LONGER_CURRENT" });
    await ctx.db.patch(match._id, { status: args.status, updatedAt: Date.now() });
    return null;
  },
});
