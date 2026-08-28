import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(v.literal("musician"), v.literal("operator"));
const signalSide = v.union(v.literal("supply"), v.literal("demand"));
const signalStatus = v.union(
  v.literal("reviewing"),
  v.literal("published"),
  v.literal("stale"),
  v.literal("removed"),
  v.literal("suppressed"),
);
const verification = v.union(
  v.literal("observed"),
  v.literal("verified"),
  v.literal("conflicting"),
);

export default defineSchema({
  users: defineTable({
    username: v.string(),
    displayName: v.optional(v.string()),
    role,
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_role", ["role"]),

  sources: defineTable({
    slug: v.string(),
    name: v.string(),
    baseUrl: v.string(),
    side: signalSide,
    status: v.union(
      v.literal("reviewing"),
      v.literal("active"),
      v.literal("paused"),
    ),
    health: v.union(
      v.literal("unknown"),
      v.literal("healthy"),
      v.literal("degraded"),
      v.literal("failing"),
    ),
    lastCheckedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  sourceTargets: defineTable({
    sourceId: v.id("sources"),
    url: v.string(),
    mode: v.union(
      v.literal("scrape"),
      v.literal("crawl"),
      v.literal("batch"),
    ),
    changeTrackingTag: v.string(),
    scheduleMinutes: v.number(),
    nextRunAt: v.number(),
    paused: v.boolean(),
    lastChangeStatus: v.optional(
      v.union(
        v.literal("new"),
        v.literal("same"),
        v.literal("changed"),
        v.literal("removed"),
      ),
    ),
    lastRunAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source", ["sourceId"])
    .index("by_paused_and_next_run_at", ["paused", "nextRunAt"]),

  ingestionEvents: defineTable({
    provider: v.literal("firecrawl"),
    providerEventId: v.string(),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    eventType: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("ignored"),
    ),
    payloadHash: v.string(),
    changeStatus: v.optional(
      v.union(
        v.literal("new"),
        v.literal("same"),
        v.literal("changed"),
        v.literal("removed"),
      ),
    ),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_provider_and_provider_event_id", [
      "provider",
      "providerEventId",
    ])
    .index("by_status_and_received_at", ["status", "receivedAt"]),

  signals: defineTable({
    side: signalSide,
    title: v.string(),
    city: v.string(),
    district: v.optional(v.string()),
    summary: v.string(),
    arrangement: v.union(
      v.literal("permanent"),
      v.literal("shared"),
      v.literal("hourly"),
      v.literal("unknown"),
    ),
    priceEur: v.optional(v.number()),
    pricePeriod: v.optional(
      v.union(v.literal("hour"), v.literal("month"), v.literal("unknown")),
    ),
    requirements: v.array(v.string()),
    unknowns: v.array(v.string()),
    status: signalStatus,
    verification,
    sourceCount: v.number(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_city_and_status", ["city", "status"])
    .index("by_side_and_city_and_status", ["side", "city", "status"])
    .index("by_status_and_last_seen_at", ["status", "lastSeenAt"]),

  signalEvidence: defineTable({
    signalId: v.id("signals"),
    sourceId: v.id("sources"),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    sourceUrl: v.string(),
    sourceTitle: v.string(),
    excerpt: v.string(),
    fingerprint: v.string(),
    observedAt: v.number(),
  })
    .index("by_signal", ["signalId"])
    .index("by_source", ["sourceId"])
    .index("by_fingerprint", ["fingerprint"]),

  savedNeeds: defineTable({
    ownerId: v.id("users"),
    title: v.string(),
    city: v.string(),
    districts: v.array(v.string()),
    maxBudgetEur: v.optional(v.number()),
    arrangement: v.array(
      v.union(
        v.literal("permanent"),
        v.literal("shared"),
        v.literal("hourly"),
      ),
    ),
    schedule: v.array(v.string()),
    requirements: v.array(v.string()),
    openToSharing: v.optional(v.boolean()),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_status_and_city", ["status", "city"]),

  scoutContexts: defineTable({
    ownerId: v.id("users"),
    threadId: v.string(),
    activeNeedId: v.optional(v.id("savedNeeds")),
    mode: v.union(
      v.literal("search_discovery"),
      v.literal("signal_advisor"),
      v.literal("outreach_drafting"),
    ),
    focusedSignalId: v.optional(v.id("signals")),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_thread_id", ["threadId"]),

  memoryEntities: defineTable({
    ownerId: v.id("users"),
    kind: v.union(
      v.literal("person"),
      v.literal("band"),
      v.literal("place"),
      v.literal("equipment"),
      v.literal("organization"),
      v.literal("project"),
      v.literal("other"),
    ),
    name: v.string(),
    normalizedName: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_and_kind_and_normalized_name", [
      "ownerId",
      "kind",
      "normalizedName",
    ]),

  memoryFacts: defineTable({
    ownerId: v.id("users"),
    subjectEntityId: v.id("memoryEntities"),
    predicate: v.string(),
    value: v.string(),
    objectEntityId: v.optional(v.id("memoryEntities")),
    category: v.union(
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
    ),
    confidence: v.number(),
    source: v.union(
      v.literal("conversation"),
      v.literal("context_import"),
      v.literal("user_edit"),
      v.literal("agentmail"),
      v.literal("observed"),
    ),
    verification: v.union(
      v.literal("user_stated"),
      v.literal("user_confirmed"),
      v.literal("inferred"),
      v.literal("external"),
    ),
    sensitivity: v.union(
      v.literal("normal"),
      v.literal("personal"),
      v.literal("sensitive"),
    ),
    status: v.union(
      v.literal("active"),
      v.literal("superseded"),
      v.literal("deleted"),
    ),
    supersedesFactId: v.optional(v.id("memoryFacts")),
    importBatchId: v.optional(v.string()),
    lastConfirmedAt: v.optional(v.number()),
    validUntil: v.optional(v.number()),
    embedding: v.optional(v.array(v.number())),
    embeddingModel: v.optional(v.string()),
    embeddingState: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("ready"),
        v.literal("unavailable"),
        v.literal("failed"),
      ),
    ),
    embeddingUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_owner_and_category_and_status", [
      "ownerId",
      "category",
      "status",
    ])
    .index("by_subject_and_status", ["subjectEntityId", "status"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 512,
      filterFields: ["ownerId"],
    }),

  memoryProfiles: defineTable({
    ownerId: v.id("users"),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  memoryEvents: defineTable({
    ownerId: v.id("users"),
    eventType: v.union(
      v.literal("fact_added"),
      v.literal("fact_superseded"),
      v.literal("fact_deleted"),
      v.literal("context_rebuilt"),
      v.literal("import_completed"),
    ),
    entityId: v.optional(v.id("memoryEntities")),
    factId: v.optional(v.id("memoryFacts")),
    importBatchId: v.optional(v.string()),
    summary: v.string(),
    occurredAt: v.number(),
  })
    .index("by_owner_and_occurred_at", ["ownerId", "occurredAt"])
    .index("by_owner_and_import_batch_id", ["ownerId", "importBatchId"]),

  outreachDrafts: defineTable({
    ownerId: v.id("users"),
    signalId: v.id("signals"),
    savedNeedId: v.id("savedNeeds"),
    recipientName: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    body: v.string(),
    contentVersion: v.number(),
    contentHash: v.string(),
    status: v.union(
      v.literal("drafted"),
      v.literal("awaiting_approval"),
      v.literal("approved"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("replied"),
      v.literal("rejected"),
      v.literal("failed"),
    ),
    sendIdempotencyKey: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_signal", ["signalId"])
    .index("by_provider_thread_id", ["providerThreadId"]),

  outreachApprovals: defineTable({
    draftId: v.id("outreachDrafts"),
    ownerId: v.id("users"),
    contentVersion: v.number(),
    contentHash: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    body: v.string(),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    decidedAt: v.number(),
  })
    .index("by_draft_and_content_version", ["draftId", "contentVersion"])
    .index("by_owner_and_decided_at", ["ownerId", "decidedAt"]),

  mailThreads: defineTable({
    ownerId: v.id("users"),
    draftId: v.id("outreachDrafts"),
    providerThreadId: v.string(),
    subject: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("awaiting_reply"),
      v.literal("replied"),
      v.literal("closed"),
      v.literal("failed"),
    ),
    lastMessageAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_owner_and_last_message_at", ["ownerId", "lastMessageAt"])
    .index("by_provider_thread_id", ["providerThreadId"])
    .index("by_draft", ["draftId"]),

  mailMessages: defineTable({
    threadId: v.id("mailThreads"),
    providerMessageId: v.string(),
    direction: v.union(v.literal("outbound"), v.literal("inbound")),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    parsedSummary: v.optional(v.string()),
    parsedFacts: v.optional(v.array(v.string())),
    receivedAt: v.number(),
  })
    .index("by_thread_and_received_at", ["threadId", "receivedAt"])
    .index("by_provider_message_id", ["providerMessageId"]),

  providerEvents: defineTable({
    provider: v.union(v.literal("firecrawl"), v.literal("agentmail")),
    providerEventId: v.string(),
    eventType: v.string(),
    payloadHash: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processed"),
      v.literal("ignored"),
      v.literal("failed"),
    ),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_provider_and_provider_event_id", [
      "provider",
      "providerEventId",
    ])
    .index("by_provider_and_status_and_received_at", [
      "provider",
      "status",
      "receivedAt",
    ]),
});
