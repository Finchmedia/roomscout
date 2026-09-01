import { ConvexError, v } from "convex/values";
import { z } from "zod";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { generateRoomScoutObject } from "./ai";
import { requireActionUserId, requireUserId } from "./integrations/authz";
import {
  createOpenAIEmbedding,
  OPENAI_EMBEDDING_MODEL,
} from "./openaiEmbeddings";
import { roomScoutRateLimiter } from "./rateLimits";

const entityKinds = [
  "person",
  "band",
  "place",
  "equipment",
  "organization",
  "project",
  "other",
] as const;
const factCategories = [
  "identity",
  "music",
  "location",
  "mobility",
  "schedule",
  "equipment",
  "goal",
  "preference",
  "constraint",
  "relationship",
  "collaboration",
  "room_need",
  "other",
] as const;
const sensitivities = ["normal", "personal", "sensitive"] as const;

const entityKindValidator = v.union(
  v.literal("person"),
  v.literal("band"),
  v.literal("place"),
  v.literal("equipment"),
  v.literal("organization"),
  v.literal("project"),
  v.literal("other"),
);
const factCategoryValidator = v.union(
  v.literal("identity"),
  v.literal("music"),
  v.literal("location"),
  v.literal("mobility"),
  v.literal("schedule"),
  v.literal("equipment"),
  v.literal("goal"),
  v.literal("preference"),
  v.literal("constraint"),
  v.literal("relationship"),
  v.literal("collaboration"),
  v.literal("room_need"),
  v.literal("other"),
);
const factSourceValidator = v.union(
  v.literal("conversation"),
  v.literal("context_import"),
  v.literal("user_edit"),
  v.literal("agentmail"),
  v.literal("observed"),
);
const factVerificationValidator = v.union(
  v.literal("user_stated"),
  v.literal("user_confirmed"),
  v.literal("inferred"),
  v.literal("external"),
);
const sensitivityValidator = v.union(
  v.literal("normal"),
  v.literal("personal"),
  v.literal("sensitive"),
);

const factCandidateValidator = v.object({
  subject: v.string(),
  subjectKind: entityKindValidator,
  predicate: v.string(),
  value: v.string(),
  objectName: v.optional(v.string()),
  objectKind: v.optional(entityKindValidator),
  category: factCategoryValidator,
  confidence: v.number(),
  sensitivity: sensitivityValidator,
  relevance: v.string(),
});

type EntityKind = (typeof entityKinds)[number];
type FactCategory = (typeof factCategories)[number];
type FactSource =
  | "conversation"
  | "context_import"
  | "user_edit"
  | "agentmail"
  | "observed";
type FactVerification =
  | "user_stated"
  | "user_confirmed"
  | "inferred"
  | "external";
type Sensitivity = (typeof sensitivities)[number];

type FactInput = {
  subject: string;
  subjectKind: EntityKind;
  predicate: string;
  value: string;
  objectName?: string;
  objectKind?: EntityKind;
  category: FactCategory;
  confidence: number;
  source: FactSource;
  verification: FactVerification;
  sensitivity: Sensitivity;
  replaceExisting: boolean;
  importBatchId?: string;
};

function cleanText(value: string, maxLength: number, field: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0 || cleaned.length > maxLength) {
    throw new ConvexError({ code: "INVALID_MEMORY_FIELD", field });
  }
  return cleaned;
}

function normalizeEntityName(value: string): string {
  return cleanText(value, 160, "entity").normalize("NFKC").toLocaleLowerCase();
}

function normalizePredicate(value: string): string {
  const normalized = cleanText(value, 100, "predicate")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  if (normalized.length === 0) {
    throw new ConvexError({ code: "INVALID_MEMORY_FIELD", field: "predicate" });
  }
  return normalized;
}

async function getOrCreateEntity(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  kind: EntityKind,
  inputName: string,
): Promise<Id<"memoryEntities">> {
  const name = cleanText(inputName, 160, "entity");
  const normalizedName = normalizeEntityName(name);
  const existing = await ctx.db
    .query("memoryEntities")
    .withIndex("by_owner_and_kind_and_normalized_name", (q) =>
      q.eq("ownerId", ownerId).eq("kind", kind).eq("normalizedName", normalizedName),
    )
    .unique();
  if (existing !== null) return existing._id;

  const now = Date.now();
  return await ctx.db.insert("memoryEntities", {
    ownerId,
    kind,
    name,
    normalizedName,
    createdAt: now,
    updatedAt: now,
  });
}

async function ensureProfile(
  ctx: MutationCtx,
  ownerId: Id<"users">,
) {
  const existing = await ctx.db
    .query("memoryProfiles")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
  if (existing !== null) return existing;

  const now = Date.now();
  const profileId = await ctx.db.insert("memoryProfiles", {
    ownerId,
    factVersion: 0,
    contextVersion: 0,
    hardConstraints: [],
    softPreferences: [],
    openQuestions: [],
    createdAt: now,
    updatedAt: now,
  });
  const profile = await ctx.db.get(profileId);
  if (profile === null) throw new Error("Memory profile insert failed");
  return profile;
}

async function insertFact(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  input: FactInput,
): Promise<{ factId: Id<"memoryFacts">; created: boolean }> {
  const subjectEntityId = await getOrCreateEntity(
    ctx,
    ownerId,
    input.subjectKind,
    input.subject,
  );
  const objectEntityId = input.objectName
    ? await getOrCreateEntity(
        ctx,
        ownerId,
        input.objectKind ?? "other",
        input.objectName,
      )
    : undefined;
  const predicate = normalizePredicate(input.predicate);
  const value = cleanText(input.value, 1_000, "value");
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const activeFacts = await ctx.db
    .query("memoryFacts")
    .withIndex("by_subject_and_status", (q) =>
      q.eq("subjectEntityId", subjectEntityId).eq("status", "active"),
    )
    .take(100);
  const duplicate = activeFacts.find(
    (fact) =>
      fact.predicate === predicate &&
      fact.value.toLocaleLowerCase() === value.toLocaleLowerCase() &&
      fact.objectEntityId === objectEntityId,
  );
  if (duplicate) return { factId: duplicate._id, created: false };

  const now = Date.now();
  const factsToSupersede = input.replaceExisting
    ? activeFacts.filter((fact) => fact.predicate === predicate)
    : [];
  if (factsToSupersede.length === 0) {
    const activeOwnerFacts = await ctx.db
      .query("memoryFacts")
      .withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", ownerId).eq("status", "active"),
      )
      .take(500);
    if (activeOwnerFacts.length >= 500) {
      throw new ConvexError({ code: "MEMORY_FACT_LIMIT", limit: 500 });
    }
  }
  await Promise.all(
    factsToSupersede.map(async (fact) => {
      await ctx.db.patch(fact._id, { status: "superseded", updatedAt: now });
      await ctx.db.insert("memoryEvents", {
        ownerId,
        eventType: "fact_superseded",
        entityId: subjectEntityId,
        factId: fact._id,
        summary: `Superseded ${predicate}`,
        occurredAt: now,
      });
    }),
  );

  const factId = await ctx.db.insert("memoryFacts", {
    ownerId,
    subjectEntityId,
    predicate,
    value,
    objectEntityId,
    category: input.category,
    confidence,
    source: input.source,
    verification: input.verification,
    sensitivity: input.sensitivity,
    status: "active",
    embeddingState: "pending",
    supersedesFactId: factsToSupersede[0]?._id,
    importBatchId: input.importBatchId,
    lastConfirmedAt:
      input.verification === "user_confirmed" || input.verification === "user_stated"
        ? now
        : undefined,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("memoryEvents", {
    ownerId,
    eventType: "fact_added",
    entityId: subjectEntityId,
    factId,
    summary: `Remembered ${predicate}`,
    occurredAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.memory.embedFact, { factId });
  return { factId, created: true };
}

async function bumpAndScheduleContext(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  options?: { imported?: boolean },
) {
  const profile = await ensureProfile(ctx, ownerId);
  const factVersion = profile.factVersion + 1;
  await ctx.db.patch(profile._id, {
    factVersion,
    lastImportAt: options?.imported ? Date.now() : profile.lastImportAt,
    updatedAt: Date.now(),
  });
  await ctx.scheduler.runAfter(2_000, internal.memory.rebuildContext, {
    ownerId,
    factVersion,
  });
}

export const rememberFromScout = internalMutation({
  args: {
    ownerId: v.id("users"),
    subject: v.string(),
    subjectKind: entityKindValidator,
    predicate: v.string(),
    value: v.string(),
    objectName: v.optional(v.string()),
    objectKind: v.optional(entityKindValidator),
    category: factCategoryValidator,
    confidence: v.number(),
    verification: factVerificationValidator,
    sensitivity: sensitivityValidator,
    replaceExisting: v.boolean(),
  },
  returns: v.object({ factId: v.id("memoryFacts"), created: v.boolean() }),
  handler: async (ctx, args) => {
    if (args.sensitivity === "sensitive" && args.verification === "inferred") {
      throw new ConvexError({ code: "SENSITIVE_INFERENCE_FORBIDDEN" });
    }
    const result = await insertFact(ctx, args.ownerId, {
      ...args,
      source: "conversation",
    });
    if (result.created) await bumpAndScheduleContext(ctx, args.ownerId);
    return result;
  },
});

export const importFacts = mutation({
  args: {
    batchId: v.string(),
    facts: v.array(factCandidateValidator),
  },
  returns: v.object({ imported: v.number(), duplicateBatch: v.boolean() }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    await roomScoutRateLimiter.limit(ctx, "contextImport", {
      key: ownerId,
      throws: true,
    });
    const batchId = cleanText(args.batchId, 100, "batchId");
    if (args.facts.length === 0 || args.facts.length > 40) {
      throw new ConvexError({ code: "INVALID_IMPORT_SIZE" });
    }
    const existingBatch = await ctx.db
      .query("memoryEvents")
      .withIndex("by_owner_and_import_batch_id", (q) =>
        q.eq("ownerId", ownerId).eq("importBatchId", batchId),
      )
      .unique();
    if (existingBatch !== null) return { imported: 0, duplicateBatch: true };

    let imported = 0;
    for (const fact of args.facts) {
      const result = await insertFact(ctx, ownerId, {
        ...fact,
        source: "context_import",
        verification: "user_confirmed",
        replaceExisting: false,
        importBatchId: batchId,
      });
      if (result.created) imported += 1;
    }
    const now = Date.now();
    await ctx.db.insert("memoryEvents", {
      ownerId,
      eventType: "import_completed",
      importBatchId: batchId,
      summary: `Imported ${imported} reviewed facts`,
      occurredAt: now,
    });
    if (imported > 0) await bumpAndScheduleContext(ctx, ownerId, { imported: true });
    return { imported, duplicateBatch: false };
  },
});

export const deleteFact = mutation({
  args: { factId: v.id("memoryFacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const fact = await ctx.db.get(args.factId);
    if (fact === null || fact.ownerId !== ownerId || fact.status !== "active") {
      throw new ConvexError({ code: "MEMORY_FACT_NOT_FOUND" });
    }
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(fact._id, { status: "deleted", updatedAt: now }),
      ctx.db.insert("memoryEvents", {
        ownerId,
        eventType: "fact_deleted",
        entityId: fact.subjectEntityId,
        factId: fact._id,
        summary: `Forgot ${fact.predicate}`,
        occurredAt: now,
      }),
    ]);
    await bumpAndScheduleContext(ctx, ownerId);
    return null;
  },
});

const profileProjectionValidator = v.object({
  factVersion: v.number(),
  contextVersion: v.number(),
  summary: v.optional(v.string()),
  musicalIdentity: v.optional(v.string()),
  practicalContext: v.optional(v.string()),
  relationshipContext: v.optional(v.string()),
  hardConstraints: v.array(v.string()),
  softPreferences: v.array(v.string()),
  openQuestions: v.array(v.string()),
  rebuiltAt: v.optional(v.number()),
  lastImportAt: v.optional(v.number()),
});

export const listMine = query({
  args: {},
  returns: v.object({
    facts: v.array(
      v.object({
        _id: v.id("memoryFacts"),
        subject: v.string(),
        subjectKind: entityKindValidator,
        predicate: v.string(),
        value: v.string(),
        objectName: v.optional(v.string()),
        category: factCategoryValidator,
        confidence: v.number(),
        source: factSourceValidator,
        verification: factVerificationValidator,
        sensitivity: sensitivityValidator,
        embeddingState: v.optional(
          v.union(
            v.literal("pending"),
            v.literal("ready"),
            v.literal("unavailable"),
            v.literal("failed"),
          ),
        ),
        lastConfirmedAt: v.optional(v.number()),
        createdAt: v.number(),
      }),
    ),
    profile: v.optional(profileProjectionValidator),
    events: v.array(
      v.object({
        _id: v.id("memoryEvents"),
        eventType: v.string(),
        summary: v.string(),
        occurredAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const [facts, profile, events] = await Promise.all([
      ctx.db
        .query("memoryFacts")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", ownerId).eq("status", "active"),
        )
        .order("desc")
        .take(100),
      ctx.db
        .query("memoryProfiles")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .unique(),
      ctx.db
        .query("memoryEvents")
        .withIndex("by_owner_and_occurred_at", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .take(12),
    ]);
    const entityIds = new Set<Id<"memoryEntities">>();
    for (const fact of facts) {
      entityIds.add(fact.subjectEntityId);
      if (fact.objectEntityId) entityIds.add(fact.objectEntityId);
    }
    const entities = await Promise.all(
      [...entityIds].map(async (entityId) => await ctx.db.get(entityId)),
    );
    const entityMap = new Map(
      entities.filter((entity) => entity !== null).map((entity) => [entity._id, entity]),
    );
    return {
      facts: facts.flatMap((fact) => {
        const subject = entityMap.get(fact.subjectEntityId);
        if (!subject) return [];
        return [{
          _id: fact._id,
          subject: subject.name,
          subjectKind: subject.kind,
          predicate: fact.predicate,
          value: fact.value,
          objectName: fact.objectEntityId
            ? entityMap.get(fact.objectEntityId)?.name
            : undefined,
          category: fact.category,
          confidence: fact.confidence,
          source: fact.source,
          verification: fact.verification,
          sensitivity: fact.sensitivity,
          embeddingState: fact.embeddingState,
          lastConfirmedAt: fact.lastConfirmedAt,
          createdAt: fact.createdAt,
        }];
      }),
      profile: profile
        ? {
            factVersion: profile.factVersion,
            contextVersion: profile.contextVersion,
            summary: profile.summary,
            musicalIdentity: profile.musicalIdentity,
            practicalContext: profile.practicalContext,
            relationshipContext: profile.relationshipContext,
            hardConstraints: profile.hardConstraints,
            softPreferences: profile.softPreferences,
            openQuestions: profile.openQuestions,
            rebuiltAt: profile.rebuiltAt,
            lastImportAt: profile.lastImportAt,
          }
        : undefined,
      events: events.map((event) => ({
        _id: event._id,
        eventType: event.eventType,
        summary: event.summary,
        occurredAt: event.occurredAt,
      })),
    };
  },
});

export const getEmbeddingInput = internalQuery({
  args: { factId: v.id("memoryFacts") },
  returns: v.union(
    v.object({
      ownerId: v.id("users"),
      text: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const fact = await ctx.db.get(args.factId);
    if (fact === null || fact.status !== "active") return null;
    const [subject, object] = await Promise.all([
      ctx.db.get(fact.subjectEntityId),
      fact.objectEntityId ? ctx.db.get(fact.objectEntityId) : null,
    ]);
    if (subject === null) return null;
    return {
      ownerId: fact.ownerId,
      text: [
        `Subject: ${subject.name} (${subject.kind})`,
        `Fact: ${fact.predicate.replaceAll("_", " ")} — ${fact.value}`,
        object ? `Related to: ${object.name} (${object.kind})` : undefined,
        `Category: ${fact.category}`,
      ].filter(Boolean).join(". "),
    };
  },
});

export const applyFactEmbedding = internalMutation({
  args: {
    factId: v.id("memoryFacts"),
    state: v.union(
      v.literal("ready"),
      v.literal("unavailable"),
      v.literal("failed"),
    ),
    embedding: v.optional(v.array(v.number())),
    model: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const fact = await ctx.db.get(args.factId);
    if (fact === null || fact.status !== "active") return null;
    await ctx.db.patch(fact._id, {
      embeddingState: args.state,
      embedding: args.embedding,
      embeddingModel: args.model,
      embeddingUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const embedFact = internalAction({
  args: { factId: v.id("memoryFacts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(internal.memory.getEmbeddingInput, args);
    if (input === null) return null;
    try {
      const embedding = await createOpenAIEmbedding(input.text);
      await ctx.runMutation(internal.memory.applyFactEmbedding, {
        factId: args.factId,
        state: embedding ? "ready" : "unavailable",
        embedding: embedding ?? undefined,
        model: embedding ? OPENAI_EMBEDDING_MODEL : undefined,
      });
    } catch (error) {
      console.error("Fact embedding failed", error instanceof Error ? error.message : "Unknown error");
      await ctx.runMutation(internal.memory.applyFactEmbedding, {
        factId: args.factId,
        state: "failed",
      });
    }
    return null;
  },
});

export const getRelevantFacts = internalQuery({
  args: {
    ownerId: v.id("users"),
    matches: v.array(v.object({ factId: v.id("memoryFacts"), score: v.number() })),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const lines: string[] = [];
    for (const match of args.matches) {
      const fact = await ctx.db.get(match.factId);
      if (fact === null || fact.ownerId !== args.ownerId || fact.status !== "active") continue;
      const subject = await ctx.db.get(fact.subjectEntityId);
      if (subject === null) continue;
      lines.push(
        `[semantic ${match.score.toFixed(3)}; ${fact.verification}] ${subject.name}.${fact.predicate} = ${fact.value}`,
      );
    }
    return lines;
  },
});

export const searchRelevant = internalAction({
  args: { ownerId: v.id("users"), query: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const embedding = await createOpenAIEmbedding(args.query);
    if (embedding === null) return "";
    const matches = await ctx.vectorSearch("memoryFacts", "by_embedding", {
      vector: embedding,
      limit: 12,
      filter: (q) => q.eq("ownerId", args.ownerId),
    });
    const lines: string[] = await ctx.runQuery(internal.memory.getRelevantFacts, {
      ownerId: args.ownerId,
      matches: matches.map((match) => ({ factId: match._id, score: match._score })),
    });
    return lines.length > 0
      ? `SEMANTICALLY RELEVANT MEMORY:\n${lines.join("\n")}`
      : "";
  },
});

export const getEmbeddingCandidates = internalQuery({
  args: { ownerId: v.id("users") },
  returns: v.array(v.id("memoryFacts")),
  handler: async (ctx, args) => {
    const facts = await ctx.db
      .query("memoryFacts")
      .withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", args.ownerId).eq("status", "active"),
      )
      .take(100);
    return facts
      .filter((fact) => fact.embeddingState !== "ready")
      .slice(0, 40)
      .map((fact) => fact._id);
  },
});

export const refreshMyEmbeddings = action({
  args: {},
  returns: v.object({ processed: v.number(), configured: v.boolean() }),
  handler: async (ctx): Promise<{ processed: number; configured: boolean }> => {
    const ownerId = await requireActionUserId(ctx);
    if (!process.env.OPENAI_API_KEY) return { processed: 0, configured: false };
    const factIds: Id<"memoryFacts">[] = await ctx.runQuery(
      internal.memory.getEmbeddingCandidates,
      { ownerId },
    );
    for (const factId of factIds) {
      await ctx.runAction(internal.memory.embedFact, { factId });
    }
    return { processed: factIds.length, configured: true };
  },
});

export const getPromptContext = internalQuery({
  args: { ownerId: v.id("users") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const [profile, facts] = await Promise.all([
      ctx.db
        .query("memoryProfiles")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
        .unique(),
      ctx.db
        .query("memoryFacts")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", args.ownerId).eq("status", "active"),
        )
        .order("desc")
        .take(80),
    ]);
    if (facts.length === 0 && !profile?.summary) {
      return "No durable musician or band memory has been recorded yet.";
    }
    const entityIds = new Set<Id<"memoryEntities">>();
    for (const fact of facts) {
      entityIds.add(fact.subjectEntityId);
      if (fact.objectEntityId) entityIds.add(fact.objectEntityId);
    }
    const entities = await Promise.all(
      [...entityIds].map(async (entityId) => await ctx.db.get(entityId)),
    );
    const entityMap = new Map(
      entities.filter((entity) => entity !== null).map((entity) => [entity._id, entity.name]),
    );
    const lines = facts.map((fact) => {
      const subject = entityMap.get(fact.subjectEntityId) ?? "Unknown entity";
      const object = fact.objectEntityId
        ? ` -> ${entityMap.get(fact.objectEntityId) ?? "Unknown entity"}`
        : "";
      return `- [${fact.verification}; ${fact.category}; confidence ${fact.confidence.toFixed(2)}] ${subject}.${fact.predicate} = ${fact.value}${object}`;
    });
    return [
      "DURABLE MEMORY — treat user-confirmed facts as stronger than inferred facts:",
      profile?.summary ? `Summary: ${profile.summary}` : undefined,
      profile?.musicalIdentity ? `Musical identity: ${profile.musicalIdentity}` : undefined,
      profile?.practicalContext ? `Practical context: ${profile.practicalContext}` : undefined,
      profile?.relationshipContext ? `People and relationships: ${profile.relationshipContext}` : undefined,
      profile?.hardConstraints.length
        ? `Hard constraints: ${profile.hardConstraints.join("; ")}`
        : undefined,
      profile?.softPreferences.length
        ? `Soft preferences: ${profile.softPreferences.join("; ")}`
        : undefined,
      "Active facts:",
      ...lines,
    ].filter((line): line is string => Boolean(line)).join("\n");
  },
});

export const getCompressionInput = internalQuery({
  args: { ownerId: v.id("users"), factVersion: v.number() },
  returns: v.union(
    v.object({ factVersion: v.number(), facts: v.array(v.string()) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("memoryProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (profile === null || profile.factVersion !== args.factVersion) return null;
    const facts = await ctx.db
      .query("memoryFacts")
      .withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", args.ownerId).eq("status", "active"),
      )
      .order("desc")
      .take(100);
    const entityIds = new Set<Id<"memoryEntities">>();
    for (const fact of facts) {
      entityIds.add(fact.subjectEntityId);
      if (fact.objectEntityId) entityIds.add(fact.objectEntityId);
    }
    const entities = await Promise.all(
      [...entityIds].map(async (entityId) => await ctx.db.get(entityId)),
    );
    const entityMap = new Map(
      entities.filter((entity) => entity !== null).map((entity) => [entity._id, entity.name]),
    );
    return {
      factVersion: profile.factVersion,
      facts: facts.map((fact) => {
        const subject = entityMap.get(fact.subjectEntityId) ?? "Unknown";
        const object = fact.objectEntityId
          ? `; related entity=${entityMap.get(fact.objectEntityId) ?? "Unknown"}`
          : "";
        return `${subject} | ${fact.predicate} | ${fact.value}${object} | category=${fact.category} | verification=${fact.verification} | confidence=${fact.confidence}`;
      }),
    };
  },
});

export const getFactVersion = internalQuery({
  args: { ownerId: v.id("users") },
  returns: v.union(v.number(), v.null()),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("memoryProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    return profile?.factVersion ?? null;
  },
});

export const applyCompressedContext = internalMutation({
  args: {
    ownerId: v.id("users"),
    factVersion: v.number(),
    summary: v.string(),
    musicalIdentity: v.string(),
    practicalContext: v.string(),
    relationshipContext: v.string(),
    hardConstraints: v.array(v.string()),
    softPreferences: v.array(v.string()),
    openQuestions: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("memoryProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (profile === null || profile.factVersion !== args.factVersion) return false;
    const now = Date.now();
    await ctx.db.patch(profile._id, {
      contextVersion: args.factVersion,
      summary: args.summary.slice(0, 2_000),
      musicalIdentity: args.musicalIdentity.slice(0, 1_500),
      practicalContext: args.practicalContext.slice(0, 1_500),
      relationshipContext: args.relationshipContext.slice(0, 1_500),
      hardConstraints: args.hardConstraints.slice(0, 30).map((item) => item.slice(0, 300)),
      softPreferences: args.softPreferences.slice(0, 30).map((item) => item.slice(0, 300)),
      openQuestions: args.openQuestions.slice(0, 20).map((item) => item.slice(0, 300)),
      rebuiltAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("memoryEvents", {
      ownerId: args.ownerId,
      eventType: "context_rebuilt",
      summary: `Rebuilt context version ${args.factVersion}`,
      occurredAt: now,
    });
    return true;
  },
});

const compressedContextSchema = z.object({
  summary: z.string().max(2_000),
  musicalIdentity: z.string().max(1_500),
  practicalContext: z.string().max(1_500),
  relationshipContext: z.string().max(1_500),
  hardConstraints: z.array(z.string().max(300)).max(30),
  softPreferences: z.array(z.string().max(300)).max(30),
  openQuestions: z.array(z.string().max(300)).max(20),
});

export const rebuildContext = internalAction({
  args: { ownerId: v.id("users"), factVersion: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const input = await ctx.runQuery(internal.memory.getCompressionInput, args);
    if (input === null) return null;
    if (input.facts.length === 0) {
      await ctx.runMutation(internal.memory.applyCompressedContext, {
        ...args,
        summary: "",
        musicalIdentity: "",
        practicalContext: "",
        relationshipContext: "",
        hardConstraints: [],
        softPreferences: [],
        openQuestions: [],
      });
      return null;
    }
    const output = await generateRoomScoutObject({
      schema: compressedContextSchema,
      instructions:
        "Compress a musician's durable RoomScout memory. Use only the supplied facts. Preserve uncertainty and distinguish people, bands, preferences, and hard constraints. Do not invent demographics, addresses, contact details, availability, or relationships. The summary should help a long-term rehearsal-room scout avoid asking repeated questions.",
      prompt: input.facts.join("\n"),
    });
    await ctx.runMutation(internal.memory.applyCompressedContext, {
      ownerId: args.ownerId,
      factVersion: input.factVersion,
      ...output,
    });
    return null;
  },
});

export const refreshMyContext = action({
  args: {},
  returns: v.object({ rebuiltVersion: v.optional(v.number()) }),
  handler: async (ctx): Promise<{ rebuiltVersion?: number }> => {
    const ownerId = await requireActionUserId(ctx);
    await roomScoutRateLimiter.limit(ctx, "contextImport", {
      key: ownerId,
      throws: true,
    });
    const factVersion: number | null = await ctx.runQuery(
      internal.memory.getFactVersion,
      { ownerId },
    );
    if (factVersion === null) return {};
    await ctx.runAction(internal.memory.rebuildContext, { ownerId, factVersion });
    return { rebuiltVersion: factVersion };
  },
});

const importedFactSchema = z.object({
  subject: z.string().min(1).max(160),
  subjectKind: z.enum(entityKinds),
  predicate: z.string().min(1).max(100),
  value: z.string().min(1).max(1_000),
  objectName: z.string().min(1).max(160).nullable(),
  objectKind: z.enum(entityKinds).nullable(),
  category: z.enum(factCategories),
  confidence: z.number().min(0).max(1),
  sensitivity: z.enum(sensitivities),
  relevance: z.string().min(1).max(300),
});

export const parseContextImport = action({
  args: { text: v.string() },
  returns: v.object({
    summary: v.string(),
    facts: v.array(factCandidateValidator),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    await roomScoutRateLimiter.limit(ctx, "contextImport", {
      key: ownerId,
      throws: true,
    });
    const text = args.text.trim();
    if (text.length < 20 || text.length > 50_000) {
      throw new ConvexError({ code: "INVALID_CONTEXT_IMPORT" });
    }
    const output = await generateRoomScoutObject({
      schema: z.object({
        summary: z.string().max(2_000),
        facts: z.array(importedFactSchema).max(40),
      }),
      instructions:
        "Extract a reviewable musician and band context import for RoomScout. Keep open-ended musical identity, genres, influences, collaboration goals, people, equipment, mobility, schedules, room needs, working style, preferences, and constraints. Use only explicit statements. Do not turn speculation into facts. Mark personal information as personal and highly private information as sensitive. Omit passwords, authentication data, contact details, exact home addresses, health data, financial account data, and irrelevant details. Use relationship facts and objectName when one entity relates to another; otherwise set objectName and objectKind to null. The user will review every proposed fact before storage.",
      prompt: text,
    });
    return {
      summary: output.summary,
      facts: output.facts.map(
        ({ objectName, objectKind, ...fact }) => ({
          ...fact,
          ...(objectName === null ? {} : { objectName }),
          ...(objectKind === null ? {} : { objectKind }),
        }),
      ),
    };
  },
});
