import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const role = v.union(v.literal("musician"), v.literal("operator"));
const signalSide = v.union(v.literal("supply"), v.literal("demand"));
const sourceSide = v.union(
  v.literal("supply"),
  v.literal("demand"),
  v.literal("both"),
);
const locationPrecision = v.union(
  v.literal("exact"),
  v.literal("postal_code"),
  v.literal("district"),
  v.literal("city"),
  v.literal("unknown"),
);
const flexibleFacet = v.object({
  namespace: v.string(),
  key: v.string(),
  value: v.union(
    v.string(),
    v.number(),
    v.boolean(),
    v.array(v.string()),
  ),
  confidence: v.number(),
});
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
const sourceFlow = v.union(
  v.literal("discovery"),
  v.literal("listing"),
  v.literal("contact"),
  v.literal("reply"),
  v.literal("auth"),
);
const automationLevel = v.union(
  v.literal("disabled"),
  v.literal("public_read"),
  v.literal("connected_read"),
  v.literal("prepare_only"),
  v.literal("approved_execute"),
);
const sourcePolicyDecision = v.union(
  v.literal("allowed"),
  v.literal("review_required"),
  v.literal("prohibited"),
  v.literal("unknown"),
);
const policyEvidenceDecision = v.union(
  v.literal("allowed"),
  v.literal("disallowed"),
  v.literal("unknown"),
);
const sourceAdapterConfig = v.union(
  v.object({
    kind: v.literal("firecrawl"),
    extractionProfileKey: v.string(),
    monitorDriven: v.boolean(),
  }),
  v.object({
    kind: v.literal("browserbase"),
    workflowKey: v.string(),
    contextRequired: v.boolean(),
  }),
  v.object({
    kind: v.literal("agentmail"),
    purpose: v.union(v.literal("outreach"), v.literal("reply")),
  }),
  v.object({
    kind: v.literal("direct_api"),
    integrationKey: v.string(),
  }),
  v.object({
    kind: v.literal("manual"),
    instructionKey: v.string(),
  }),
);
const actionPayload = v.union(
  v.object({
    kind: v.literal("platform_message"),
    threadId: v.optional(v.id("platformThreads")),
    recipients: v.array(v.string()),
    subject: v.optional(v.string()),
    body: v.string(),
  }),
  v.object({
    kind: v.literal("contact_form"),
    targetUrl: v.string(),
    fields: v.array(
      v.object({
        name: v.string(),
        label: v.optional(v.string()),
        value: v.string(),
        sensitivity: v.union(
          v.literal("normal"),
          v.literal("personal"),
          v.literal("sensitive"),
        ),
      }),
    ),
  }),
  v.object({
    kind: v.literal("portal_account_operation"),
    connectionId: v.id("portalConnections"),
    operation: v.union(
      v.literal("connect"),
      v.literal("reauth"),
      v.literal("disconnect"),
    ),
    accountLabel: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal("email_message"),
    recipientName: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  }),
);
const mandateActionType = v.union(
  v.literal("send_email"),
  v.literal("submit_webform"),
  v.literal("send_platform_dm"),
  v.literal("create_portal_account"),
  v.literal("publish_listing"),
  v.literal("share_contact_details"),
  v.literal("propose_visit_time"),
);
const mandatePersonalData = v.union(
  v.literal("band_name"),
  v.literal("member_first_names"),
  v.literal("reply_email"),
  v.literal("phone"),
  v.literal("precise_location"),
  v.literal("availability"),
  v.literal("budget"),
  v.literal("music_profile"),
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
    platformId: v.optional(v.id("sourcePlatforms")),
    slug: v.string(),
    name: v.string(),
    baseUrl: v.string(),
    side: sourceSide,
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
    geographicScope: v.optional(v.string()),
    accessMode: v.optional(
      v.union(
        v.literal("public"),
        v.literal("authenticated"),
        v.literal("partner"),
        v.literal("restricted"),
      ),
    ),
    automationReview: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("restricted"),
      ),
    ),
    policyNotes: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    adapterKey: v.optional(v.string()),
    publicDisplay: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_platform", ["platformId"])
    .index("by_status", ["status"])
    .index("by_automation_review_and_status", ["automationReview", "status"]),

  sourceTargets: defineTable({
    sourceId: v.id("sources"),
    geoAreaId: v.optional(v.id("geoAreas")),
    adapterBindingId: v.optional(v.id("sourceAdapterBindings")),
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
    providerMonitorId: v.optional(v.string()),
    providerTargetId: v.optional(v.string()),
    monitorStatus: v.optional(
      v.union(
        v.literal("unconfigured"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("error"),
      ),
    ),
    lastCheckId: v.optional(v.string()),
    lastMonitorEventAt: v.optional(v.number()),
    cityScope: v.optional(v.string()),
    sideScope: v.optional(sourceSide),
    adapterKey: v.optional(v.string()),
    successfulSnapshotCount: v.optional(v.number()),
    backlogCount: v.optional(v.number()),
  })
    .index("by_source", ["sourceId"])
    .index("by_paused_and_next_run_at", ["paused", "nextRunAt"])
    .index("by_provider_monitor_id", ["providerMonitorId"]),

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
    providerMonitorId: v.optional(v.string()),
    providerCheckId: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
    retryCount: v.optional(v.number()),
    entryCount: v.optional(v.number()),
  })
    .index("by_provider_and_provider_event_id", [
      "provider",
      "providerEventId",
    ])
    .index("by_status_and_received_at", ["status", "receivedAt"])
    .index("by_monitor_and_check", ["providerMonitorId", "providerCheckId"]),

  sourceMonitors: defineTable({
    sourceTargetId: v.id("sourceTargets"),
    provider: v.literal("firecrawl"),
    providerMonitorId: v.string(),
    state: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("error"),
    ),
    configFingerprint: v.string(),
    lastProviderCheckId: v.optional(v.string()),
    lastCheckStatus: v.optional(v.string()),
    lastCheckAt: v.optional(v.number()),
    lastReconciledAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_source_target", ["sourceTargetId"])
    .index("by_provider_monitor_id", ["providerMonitorId"])
    .index("by_state", ["state"]),

  sourceEntries: defineTable({
    sourceId: v.id("sources"),
    sourceTargetId: v.id("sourceTargets"),
    externalId: v.optional(v.string()),
    canonicalUrl: v.string(),
    detailUrl: v.string(),
    title: v.string(),
    excerpt: v.string(),
    side: signalSide,
    city: v.optional(v.string()),
    district: v.optional(v.string()),
    sourcePublishedAt: v.optional(v.number()),
    contentFingerprint: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("removed"),
      v.literal("stale"),
      v.literal("reviewing"),
    ),
    detailState: v.union(
      v.literal("none"),
      v.literal("queued"),
      v.literal("fetching"),
      v.literal("processed"),
      v.literal("failed"),
    ),
    detailAttempts: v.number(),
    nextDetailAttemptAt: v.optional(v.number()),
    detailLeaseId: v.optional(v.string()),
    detailLeaseExpiresAt: v.optional(v.number()),
    signalId: v.optional(v.id("signals")),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    updatedAt: v.number(),
    error: v.optional(v.string()),
    missingSnapshots: v.optional(v.number()),
    contactDataPresent: v.optional(v.boolean()),
  })
    .index("by_source_and_external_id", ["sourceId", "externalId"])
    .index("by_target_and_canonical_url", ["sourceTargetId", "canonicalUrl"])
    .index("by_detail_state_and_next_attempt", ["detailState", "nextDetailAttemptAt"])
    .index("by_target_and_status", ["sourceTargetId", "status"]),

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
    sourceEntryId: v.optional(v.id("sourceEntries")),
    genres: v.optional(v.array(v.string())),
    instruments: v.optional(v.array(v.string())),
    facets: v.optional(v.array(flexibleFacet)),
    locationLabel: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    locationPrecision: v.optional(locationPrecision),
    geocodeId: v.optional(v.id("geocodes")),
  })
    .index("by_city_and_status", ["city", "status"])
    .index("by_side_and_city_and_status", ["side", "city", "status"])
    .index("by_status_and_last_seen_at", ["status", "lastSeenAt"]),

  signalContacts: defineTable({
    signalId: v.id("signals"),
    sourceEntryId: v.id("sourceEntries"),
    kind: v.union(
      v.literal("email"),
      v.literal("phone"),
      v.literal("social"),
      v.literal("platform"),
    ),
    value: v.string(),
    label: v.optional(v.string()),
    confidence: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_signal", ["signalId"])
    .index("by_signal_and_kind", ["signalId", "kind"])
    .index("by_source_entry", ["sourceEntryId"]),

  signalEmbeddings: defineTable({
    signalId: v.id("signals"),
    model: v.string(),
    inputHash: v.string(),
    embedding: v.array(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_signal", ["signalId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 512,
      filterFields: [],
    }),

  savedNeedEmbeddings: defineTable({
    savedNeedId: v.id("savedNeeds"),
    ownerId: v.id("users"),
    model: v.string(),
    inputHash: v.string(),
    embedding: v.array(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_saved_need", ["savedNeedId"])
    .index("by_owner", ["ownerId"]),

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

  signalMatches: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    signalId: v.id("signals"),
    kind: v.union(v.literal("need_supply"), v.literal("demand_demand")),
    score: v.number(),
    structuredScore: v.number(),
    semanticScore: v.number(),
    reasons: v.array(v.string()),
    uncertainties: v.array(v.string()),
    status: v.union(
      v.literal("new"),
      v.literal("seen"),
      v.literal("saved"),
      v.literal("dismissed"),
      v.literal("contacted"),
    ),
    fingerprint: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status_and_updated_at", ["ownerId", "status", "updatedAt"])
    .index("by_saved_need_and_signal", ["savedNeedId", "signalId"])
    .index("by_signal", ["signalId"]),

  marketAreas: defineTable({
    cityKey: v.string(),
    city: v.string(),
    countryCode: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    supplyCount: v.number(),
    demandCount: v.number(),
    verifiedCount: v.number(),
    freshCount: v.number(),
    lastSignalAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_city_key", ["cityKey"]),

  geocodes: defineTable({
    queryKey: v.string(),
    query: v.string(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    precision: locationPrecision,
    provider: v.literal("mapbox"),
    providerFeatureId: v.optional(v.string()),
    status: v.union(v.literal("ready"), v.literal("not_found"), v.literal("failed")),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_query_key", ["queryKey"]),

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
    radiusKm: v.optional(v.number()),
    genres: v.optional(v.array(v.string())),
    instruments: v.optional(v.array(v.string())),
    collaborationOpen: v.optional(v.boolean()),
    facets: v.optional(v.array(flexibleFacet)),
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
    // Durable transport handle owned by the isolated @agentmail/convex
    // component. This is intentionally separate from providerMessageId,
    // which is assigned only after AgentMail accepts the message.
    agentmailComponentOutboundId: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    error: v.optional(v.string()),
    mailboxId: v.optional(v.id("userMailboxes")),
    providerMessageId: v.optional(v.string()),
    deliveryStatus: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("rejected"),
        v.literal("complained"),
      ),
    ),
    sendingStartedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_status_and_updated_at", ["status", "updatedAt"])
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
    inboxId: v.optional(v.string()),
    mailboxId: v.optional(v.id("userMailboxes")),
    lastDeliveryStatus: v.optional(
      v.union(
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("rejected"),
        v.literal("complained"),
      ),
    ),
    lastError: v.optional(v.string()),
  })
    .index("by_owner_and_last_message_at", ["ownerId", "lastMessageAt"])
    .index("by_provider_thread_id", ["providerThreadId"])
    .index("by_mailbox_and_provider_thread_id", [
      "mailboxId",
      "providerThreadId",
    ])
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
    providerEventId: v.optional(v.string()),
    htmlAvailable: v.optional(v.boolean()),
    deliveryStatus: v.optional(
      v.union(
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("bounced"),
        v.literal("rejected"),
        v.literal("complained"),
        v.literal("received"),
      ),
    ),
    providerEventAt: v.optional(v.number()),
  })
    .index("by_thread_and_received_at", ["threadId", "receivedAt"])
    .index("by_provider_message_id", ["providerMessageId"]),

  userMailboxes: defineTable({
    ownerId: v.id("users"),
    provider: v.literal("agentmail"),
    providerInboxId: v.optional(v.string()),
    emailAddress: v.optional(v.string()),
    clientId: v.string(),
    status: v.union(
      v.literal("provisioning"),
      v.literal("active"),
      v.literal("failed"),
      v.literal("disabled"),
    ),
    lastError: v.optional(v.string()),
    provisioningToken: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_provider_inbox_id", ["providerInboxId"])
    .index("by_client_id", ["clientId"]),

  mailboxMessages: defineTable({
    ownerId: v.id("users"),
    mailboxId: v.id("userMailboxes"),
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    providerEventId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    kind: v.union(v.literal("portal_verification"), v.literal("general")),
    status: v.union(v.literal("unread"), v.literal("read"), v.literal("archived")),
    htmlAvailable: v.boolean(),
    receivedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_received_at", ["ownerId", "receivedAt"])
    .index("by_mailbox_and_provider_message_id", ["mailboxId", "providerMessageId"])
    .index("by_owner_and_status_and_received_at", ["ownerId", "status", "receivedAt"]),

  voiceSessions: defineTable({
    ownerId: v.id("users"),
    threadId: v.string(),
    model: v.string(),
    voice: v.string(),
    status: v.union(
      v.literal("connecting"),
      v.literal("active"),
      v.literal("ended"),
      v.literal("error"),
    ),
    focusedSignalId: v.optional(v.id("signals")),
    activeNeedId: v.optional(v.id("savedNeeds")),
    startedAt: v.number(),
    endedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_owner_and_started_at", ["ownerId", "startedAt"])
    .index("by_status_and_updated_at", ["status", "updatedAt"]),

  voiceTranscriptEvents: defineTable({
    ownerId: v.id("users"),
    voiceSessionId: v.id("voiceSessions"),
    providerEventId: v.string(),
    itemId: v.optional(v.string()),
    role: v.union(v.literal("user"), v.literal("assistant")),
    transcript: v.string(),
    finalizedAt: v.number(),
  })
    .index("by_voice_session_and_provider_event_id", ["voiceSessionId", "providerEventId"])
    .index("by_owner_and_finalized_at", ["ownerId", "finalizedAt"]),

  notifications: defineTable({
    ownerId: v.id("users"),
    kind: v.union(
      v.literal("new_match"),
      v.literal("mail_reply"),
      v.literal("outreach_failed"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.string(),
    signalMatchId: v.optional(v.id("signalMatches")),
    mailThreadId: v.optional(v.id("mailThreads")),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_owner_and_created_at", ["ownerId", "createdAt"])
    .index("by_owner_and_read_at", ["ownerId", "readAt"]),

  sourcePlatforms: defineTable({
    slug: v.string(),
    name: v.string(),
    canonicalDomain: v.string(),
    kind: v.union(
      v.literal("classifieds"),
      v.literal("community"),
      v.literal("marketplace"),
      v.literal("directory"),
      v.literal("studio_network"),
      v.literal("other"),
    ),
    status: v.union(
      v.literal("candidate"),
      v.literal("reviewing"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("restricted"),
    ),
    firstSeenAt: v.number(),
    lastObservedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_canonical_domain", ["canonicalDomain"])
    .index("by_status_and_last_observed_at", ["status", "lastObservedAt"]),

  geoAreas: defineTable({
    key: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    countryCode: v.string(),
    type: v.union(
      v.literal("country"),
      v.literal("region"),
      v.literal("city"),
      v.literal("district"),
      v.literal("postal_code"),
    ),
    parentId: v.optional(v.id("geoAreas")),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    west: v.optional(v.number()),
    south: v.optional(v.number()),
    east: v.optional(v.number()),
    north: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("reviewing"),
      v.literal("retired"),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_parent_and_type", ["parentId", "type"])
    .index("by_country_code_and_type", ["countryCode", "type"])
    .index("by_country_code_and_normalized_name", [
      "countryCode",
      "normalizedName",
    ]),

  sourceDiscoveryBatches: defineTable({
    batchKey: v.string(),
    geoAreaId: v.optional(v.id("geoAreas")),
    side: sourceSide,
    query: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    candidateCount: v.number(),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_batch_key", ["batchKey"])
    .index("by_status_and_created_at", ["status", "createdAt"]),

  sourceCandidates: defineTable({
    canonicalKey: v.string(),
    canonicalUrl: v.string(),
    canonicalDomain: v.string(),
    name: v.string(),
    geoAreaId: v.optional(v.id("geoAreas")),
    side: sourceSide,
    discoveryMethod: v.union(
      v.literal("manual"),
      v.literal("firecrawl_search"),
      v.literal("source_link"),
      v.literal("operator_seed"),
    ),
    snippet: v.string(),
    confidence: v.number(),
    status: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("promoted"),
      v.literal("ignored"),
      v.literal("merged"),
    ),
    discoveredFromPlatformId: v.optional(v.id("sourcePlatforms")),
    promotedPlatformId: v.optional(v.id("sourcePlatforms")),
    mergedIntoCandidateId: v.optional(v.id("sourceCandidates")),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_canonical_key", ["canonicalKey"])
    .index("by_status_and_last_seen_at", ["status", "lastSeenAt"])
    .index("by_geo_area_and_side_and_status", ["geoAreaId", "side", "status"])
    .index("by_canonical_domain_and_status", ["canonicalDomain", "status"]),

  sourceCoverage: defineTable({
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    geoAreaId: v.id("geoAreas"),
    side: signalSide,
    mode: v.union(
      v.literal("explicit_page"),
      v.literal("filter"),
      v.literal("radius"),
      v.literal("nationwide"),
      v.literal("inferred"),
    ),
    status: v.union(
      v.literal("inferred"),
      v.literal("probed"),
      v.literal("verified"),
      v.literal("unsupported"),
      v.literal("stale"),
    ),
    confidence: v.number(),
    listingCount: v.optional(v.number()),
    lastObservedAt: v.optional(v.number()),
    lastProbeRunId: v.optional(v.id("sourceFlowProbeRuns")),
    evidenceUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_platform_and_geo_area_and_side", [
      "platformId",
      "geoAreaId",
      "side",
    ])
    .index("by_geo_area_and_side_and_status", ["geoAreaId", "side", "status"])
    .index("by_platform_and_status", ["platformId", "status"]),

  sourceIntelligenceFacts: defineTable({
    platformId: v.id("sourcePlatforms"),
    geoAreaId: v.optional(v.id("geoAreas")),
    category: v.union(
      v.literal("access"),
      v.literal("coverage"),
      v.literal("quality"),
      v.literal("cost"),
      v.literal("contact"),
      v.literal("auth"),
      v.literal("policy"),
      v.literal("flow"),
      v.literal("other"),
    ),
    key: v.string(),
    value: v.union(
      v.object({ kind: v.literal("text"), value: v.string() }),
      v.object({ kind: v.literal("number"), value: v.number() }),
      v.object({ kind: v.literal("boolean"), value: v.boolean() }),
      v.object({ kind: v.literal("text_set"), value: v.array(v.string()) }),
    ),
    confidence: v.number(),
    evidenceUrl: v.optional(v.string()),
    probeRunId: v.optional(v.id("sourceFlowProbeRuns")),
    status: v.union(
      v.literal("active"),
      v.literal("superseded"),
      v.literal("disputed"),
    ),
    supersedesFactId: v.optional(v.id("sourceIntelligenceFacts")),
    observedAt: v.number(),
    validUntil: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_platform_and_category_and_status", [
      "platformId",
      "category",
      "status",
    ])
    .index("by_platform_and_key_and_status", ["platformId", "key", "status"])
    .index("by_geo_area_and_category_and_status", [
      "geoAreaId",
      "category",
      "status",
    ]),

  sourceAdapterBindings: defineTable({
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    scopeKey: v.string(),
    flow: sourceFlow,
    adapterKey: v.string(),
    adapterVersion: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("error"),
      v.literal("retired"),
    ),
    executor: v.union(
      v.literal("firecrawl"),
      v.literal("browserbase"),
      v.literal("agentmail"),
      v.literal("direct_api"),
      v.literal("manual"),
    ),
    config: sourceAdapterConfig,
    configFingerprint: v.string(),
    policyVersionId: v.optional(v.id("sourceFlowPolicies")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_key_and_flow_and_status", ["scopeKey", "flow", "status"])
    .index("by_platform_and_flow_and_status", ["platformId", "flow", "status"])
    .index("by_adapter_key_and_adapter_version_and_status", [
      "adapterKey",
      "adapterVersion",
      "status",
    ]),

  adapterCheckpoints: defineTable({
    bindingId: v.id("sourceAdapterBindings"),
    scopeKey: v.string(),
    cursor: v.optional(v.string()),
    checkpointHash: v.optional(v.string()),
    lastSuccessAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_binding_and_scope_key", ["bindingId", "scopeKey"])
    .index("by_binding_and_updated_at", ["bindingId", "updatedAt"]),

  sourceFlowPolicies: defineTable({
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    geoAreaId: v.optional(v.id("geoAreas")),
    scopeKey: v.string(),
    flow: sourceFlow,
    version: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("superseded"),
      v.literal("restricted"),
    ),
    decision: sourcePolicyDecision,
    maxAutomationLevel: automationLevel,
    userConnectionRequired: v.boolean(),
    humanPresenceRequired: v.boolean(),
    accountCreationAllowed: v.boolean(),
    externalApprovalRequired: v.boolean(),
    robotsDecision: policyEvidenceDecision,
    termsDecision: policyEvidenceDecision,
    retentionDays: v.optional(v.number()),
    evidenceUrls: v.array(v.string()),
    reviewedBy: v.optional(v.id("users")),
    approvedAt: v.optional(v.number()),
    nextReviewAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_key_and_flow_and_status", ["scopeKey", "flow", "status"])
    .index("by_scope_key_and_flow_and_version", ["scopeKey", "flow", "version"])
    .index("by_platform_and_status_and_next_review_at", [
      "platformId",
      "status",
      "nextReviewAt",
    ])
    .index("by_status_and_next_review_at", ["status", "nextReviewAt"]),

  sourceFlowProbes: defineTable({
    platformId: v.id("sourcePlatforms"),
    bindingId: v.id("sourceAdapterBindings"),
    geoAreaId: v.optional(v.id("geoAreas")),
    flow: sourceFlow,
    name: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("approved"),
      v.literal("paused"),
      v.literal("retired"),
    ),
    safetyLevel: v.union(
      v.literal("read_only"),
      v.literal("prepare_only"),
      v.literal("execute_approved"),
    ),
    policyVersionId: v.id("sourceFlowPolicies"),
    maxItems: v.number(),
    timeoutMs: v.number(),
    createdBy: v.id("users"),
    approvedBy: v.optional(v.id("users")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_platform_and_flow_and_status", ["platformId", "flow", "status"])
    .index("by_binding_and_status", ["bindingId", "status"]),

  sourceFlowProbeRuns: defineTable({
    probeId: v.id("sourceFlowProbes"),
    bindingId: v.id("sourceAdapterBindings"),
    connectionId: v.optional(v.id("portalConnections")),
    browserContextId: v.optional(v.id("browserContexts")),
    trigger: v.union(
      v.literal("operator"),
      v.literal("scheduler"),
      v.literal("connection"),
    ),
    idempotencyKey: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("partial"),
      v.literal("failed"),
      v.literal("blocked"),
      v.literal("cancelled"),
    ),
    resultCode: v.optional(v.string()),
    itemsObserved: v.optional(v.number()),
    outputHash: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_probe_and_started_at", ["probeId", "startedAt"])
    .index("by_status_and_created_at", ["status", "createdAt"]),

  sourceFlowProbeSteps: defineTable({
    runId: v.id("sourceFlowProbeRuns"),
    ordinal: v.number(),
    kind: v.union(
      v.literal("navigate"),
      v.literal("authenticate"),
      v.literal("discover"),
      v.literal("list"),
      v.literal("inspect_contact"),
      v.literal("read_replies"),
      v.literal("assert"),
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("passed"),
      v.literal("failed"),
      v.literal("blocked"),
      v.literal("skipped"),
    ),
    summary: v.optional(v.string()),
    evidenceHash: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_run_and_ordinal", ["runId", "ordinal"])
    .index("by_run_and_status", ["runId", "status"]),

  portalConnections: defineTable({
    ownerId: v.id("users"),
    sourceId: v.id("sources"),
    platformId: v.optional(v.id("sourcePlatforms")),
    label: v.string(),
    allowedDomains: v.array(v.string()),
    allowedPaths: v.array(v.string()),
    inboxPath: v.optional(v.string()),
    adapterKey: v.optional(v.string()),
    status: v.union(
      v.literal("draft"),
      v.literal("needs_auth"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("reauth_required"),
      v.literal("disabled"),
    ),
    policyDecision: v.union(
      v.literal("pending"),
      v.literal("allowed"),
      v.literal("restricted"),
      v.literal("prohibited"),
    ),
    allowReadOnlyRecon: v.boolean(),
    allowInboxPolling: v.boolean(),
    pollIntervalMinutes: v.number(),
    nextPollAt: v.optional(v.number()),
    failureCount: v.number(),
    circuitOpenUntil: v.optional(v.number()),
    lastSuccessAt: v.optional(v.number()),
    lastErrorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_and_source", ["ownerId", "sourceId"])
    .index("by_source", ["sourceId"])
    .index("by_status_and_next_poll_at", ["status", "nextPollAt"]),

  browserContexts: defineTable({
    connectionId: v.id("portalConnections"),
    ownerId: v.id("users"),
    providerContextId: v.string(),
    status: v.union(
      v.literal("creating"),
      v.literal("ready"),
      v.literal("reauth_required"),
      v.literal("deleting"),
      v.literal("deleted"),
      v.literal("failed"),
    ),
    activeRunId: v.optional(v.id("browserRuns")),
    lastVerifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_connection", ["connectionId"])
    .index("by_owner", ["ownerId"])
    .index("by_provider_context_id", ["providerContextId"]),

  browserRuns: defineTable({
    connectionId: v.id("portalConnections"),
    ownerId: v.id("users"),
    contextId: v.optional(v.id("browserContexts")),
    providerSessionId: v.optional(v.string()),
    kind: v.union(
      v.literal("recon"),
      v.literal("authenticate"),
      v.literal("inbox_sync"),
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("human_required"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("stopped"),
      v.literal("expired"),
    ),
    startedAt: v.optional(v.number()),
    expiresAt: v.number(),
    endedAt: v.optional(v.number()),
    resultCount: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_connection", ["connectionId"])
    .index("by_status", ["status"])
    .index("by_provider_session_id", ["providerSessionId"]),

  browserRunEvents: defineTable({
    runId: v.id("browserRuns"),
    ownerId: v.id("users"),
    kind: v.union(
      v.literal("started"),
      v.literal("progress"),
      v.literal("human_required"),
      v.literal("resumed"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("stopped"),
    ),
    message: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_run", ["runId"]),

  platformThreads: defineTable({
    connectionId: v.id("portalConnections"),
    ownerId: v.id("users"),
    providerThreadId: v.string(),
    subject: v.optional(v.string()),
    participants: v.array(v.string()),
    lastMessageAt: v.number(),
    status: v.union(v.literal("open"), v.literal("archived")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_connection_and_provider_thread_id", [
      "connectionId",
      "providerThreadId",
    ])
    .index("by_connection_and_last_message_at", [
      "connectionId",
      "lastMessageAt",
    ])
    .index("by_owner_and_last_message_at", ["ownerId", "lastMessageAt"]),

  platformMessages: defineTable({
    connectionId: v.id("portalConnections"),
    ownerId: v.id("users"),
    threadId: v.id("platformThreads"),
    providerMessageId: v.string(),
    direction: v.union(
      v.literal("inbound"),
      v.literal("outbound"),
      v.literal("unknown"),
    ),
    senderLabel: v.optional(v.string()),
    bodyText: v.string(),
    sentAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_connection_and_provider_message_id", [
      "connectionId",
      "providerMessageId",
    ])
    .index("by_thread_and_sent_at", ["threadId", "sentAt"]),

  searchMandates: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    version: v.number(),
    supersedesMandateId: v.optional(v.id("searchMandates")),
    mode: v.union(
      v.literal("guided"),
      v.literal("research_autopilot"),
      v.literal("outreach_autopilot"),
      v.literal("negotiation_autopilot"),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("active"),
      v.literal("superseded"),
      v.literal("revoked"),
      v.literal("expired"),
    ),
    platformIds: v.array(v.id("sourcePlatforms")),
    allowedActionTypes: v.array(mandateActionType),
    allowedPersonalData: v.array(mandatePersonalData),
    maxContactsPerDay: v.number(),
    maxBrowserMinutesPerDay: v.number(),
    maxMonthlyPriceEur: v.optional(v.number()),
    expiresAt: v.number(),
    stopOnComplaint: v.boolean(),
    stopWhenSuitableRoomConfirmed: v.boolean(),
    contentHash: v.string(),
    activatedAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_saved_need_and_status", [
      "ownerId",
      "savedNeedId",
      "status",
    ])
    .index("by_status_and_expires_at", ["status", "expiresAt"]),

  searchSourcePreferences: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    platformId: v.id("sourcePlatforms"),
    preference: v.union(
      v.literal("include"),
      v.literal("prefer"),
      v.literal("neutral"),
      v.literal("exclude"),
    ),
    reason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_saved_need_and_platform", ["savedNeedId", "platformId"])
    .index("by_owner_and_updated_at", ["ownerId", "updatedAt"]),

  opportunities: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    mandateId: v.optional(v.id("searchMandates")),
    kind: v.union(
      v.literal("supply_match"),
      v.literal("demand_collaboration"),
      v.literal("source_lead"),
    ),
    status: v.union(
      v.literal("new"),
      v.literal("reviewing"),
      v.literal("saved"),
      v.literal("dismissed"),
      v.literal("contacted"),
      v.literal("converted"),
      v.literal("expired"),
    ),
    signalId: v.optional(v.id("signals")),
    platformId: v.optional(v.id("sourcePlatforms")),
    sourceCandidateId: v.optional(v.id("sourceCandidates")),
    score: v.number(),
    reasons: v.array(v.string()),
    uncertainties: v.array(v.string()),
    fingerprint: v.string(),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_saved_need_and_fingerprint", ["savedNeedId", "fingerprint"])
    .index("by_owner_and_status_and_updated_at", ["ownerId", "status", "updatedAt"])
    .index("by_saved_need_and_status_and_updated_at", [
      "savedNeedId",
      "status",
      "updatedAt",
    ]),

  handoffs: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    mandateId: v.optional(v.id("searchMandates")),
    opportunityId: v.optional(v.id("opportunities")),
    connectionId: v.optional(v.id("portalConnections")),
    actionRequestId: v.optional(v.id("actionRequests")),
    channel: v.union(
      v.literal("platform"),
      v.literal("email"),
      v.literal("manual"),
      v.literal("operator"),
    ),
    status: v.union(
      v.literal("draft"),
      v.literal("ready"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("failed"),
    ),
    summary: v.string(),
    contextHash: v.string(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status_and_updated_at", ["ownerId", "status", "updatedAt"])
    .index("by_saved_need_and_status_and_updated_at", [
      "savedNeedId",
      "status",
      "updatedAt",
    ])
    .index("by_action_request", ["actionRequestId"]),

  actionRequests: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.optional(v.id("savedNeeds")),
    mandateId: v.optional(v.id("searchMandates")),
    opportunityId: v.optional(v.id("opportunities")),
    handoffId: v.optional(v.id("handoffs")),
    platformId: v.optional(v.id("sourcePlatforms")),
    connectionId: v.optional(v.id("portalConnections")),
    adapterBindingId: v.optional(v.id("sourceAdapterBindings")),
    automationMode: v.union(
      v.literal("exact_once"),
      v.literal("standing_mandate"),
    ),
    requestedActionType: mandateActionType,
    personalDataScopes: v.array(mandatePersonalData),
    proposedMonthlyPriceEur: v.optional(v.number()),
    payload: actionPayload,
    contentVersion: v.number(),
    contentHash: v.string(),
    policyVersionId: v.optional(v.id("sourceFlowPolicies")),
    status: v.union(
      v.literal("drafted"),
      v.literal("awaiting_approval"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("queued"),
      v.literal("executing"),
      v.literal("executed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("expired"),
    ),
    executionIdempotencyKey: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status_and_updated_at", ["ownerId", "status", "updatedAt"])
    .index("by_status_and_updated_at", ["status", "updatedAt"])
    .index("by_opportunity", ["opportunityId"])
    .index("by_handoff", ["handoffId"])
    .index("by_execution_idempotency_key", ["executionIdempotencyKey"]),

  actionApprovals: defineTable({
    requestId: v.id("actionRequests"),
    ownerId: v.id("users"),
    contentVersion: v.number(),
    contentHash: v.string(),
    payloadSnapshot: actionPayload,
    policyVersionId: v.optional(v.id("sourceFlowPolicies")),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("authorized_by_mandate"),
    ),
    mandateId: v.optional(v.id("searchMandates")),
    mandateVersion: v.optional(v.number()),
    mandateHash: v.optional(v.string()),
    decidedAt: v.number(),
  })
    .index("by_request_and_content_version", ["requestId", "contentVersion"])
    .index("by_owner_and_decided_at", ["ownerId", "decidedAt"]),

  actionExecutions: defineTable({
    requestId: v.id("actionRequests"),
    ownerId: v.id("users"),
    approvalId: v.id("actionApprovals"),
    platformId: v.optional(v.id("sourcePlatforms")),
    connectionId: v.optional(v.id("portalConnections")),
    adapterBindingId: v.optional(v.id("sourceAdapterBindings")),
    browserRunId: v.optional(v.id("browserRuns")),
    status: v.union(
      v.literal("claimed"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("unknown"),
    ),
    idempotencyKey: v.string(),
    providerActionId: v.optional(v.string()),
    providerThreadId: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_request", ["requestId"])
    .index("by_idempotency_key", ["idempotencyKey"])
    .index("by_status_and_updated_at", ["status", "updatedAt"])
    .index("by_owner_and_created_at", ["ownerId", "createdAt"]),

  auditEvents: defineTable({
    eventKey: v.string(),
    actorType: v.union(
      v.literal("user"),
      v.literal("operator"),
      v.literal("system"),
      v.literal("provider"),
    ),
    actorUserId: v.optional(v.id("users")),
    entityKey: v.string(),
    eventType: v.string(),
    correlationId: v.optional(v.string()),
    actionRequestId: v.optional(v.id("actionRequests")),
    executionId: v.optional(v.id("actionExecutions")),
    probeRunId: v.optional(v.id("sourceFlowProbeRuns")),
    policyId: v.optional(v.id("sourceFlowPolicies")),
    beforeHash: v.optional(v.string()),
    afterHash: v.optional(v.string()),
    summary: v.optional(v.string()),
    occurredAt: v.number(),
  })
    .index("by_event_key", ["eventKey"])
    .index("by_entity_key_and_occurred_at", ["entityKey", "occurredAt"])
    .index("by_action_request_and_occurred_at", ["actionRequestId", "occurredAt"]),

  migrationRuns: defineTable({
    name: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    cursor: v.optional(v.string()),
    processed: v.number(),
    error: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

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
