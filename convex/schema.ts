import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { matchAssessmentValidator } from "./lib/matchAssessment";
import { providerAssessmentValidator } from "./lib/providerAssessment";
import { messageSafetyValidator } from "./lib/messageSafety";

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
    targetPath: v.optional(v.string()),
    recipients: v.array(v.string()),
    senderLabel: v.optional(v.string()),
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
    mailThreadId: v.optional(v.id("mailThreads")),
    parentMessageId: v.optional(v.string()),
  }),
);
const externalActionType = v.union(
  v.literal("send_email"),
  v.literal("submit_webform"),
  v.literal("send_platform_dm"),
  v.literal("create_portal_account"),
  v.literal("publish_listing"),
  v.literal("share_contact_details"),
  v.literal("propose_visit_time"),
);
const personalDataScope = v.union(
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
    conversationLocale: v.optional(v.union(v.literal("en"), v.literal("de"))),
    role,
    controlledProofActorKey: v.optional(
      v.union(v.literal("actor_a"), v.literal("actor_b")),
    ),
    createdAt: v.number(),
    lastSeenAt: v.number(),
  })
    .index("by_username", ["username"])
    .index("by_role", ["role"])
    .index("by_controlled_proof_actor_key", ["controlledProofActorKey"]),

  devUserResets: defineTable({
    targetUserId: v.id("users"),
    targetUsername: v.string(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("running"),
      v.literal("completed"),
    ),
    phase: v.optional(v.union(v.literal("quiescing"), v.literal("provider_cleanup_completed"), v.literal("deleting_app_data"), v.literal("completed"))),
    stage: v.number(),
    deletedDocumentCount: v.number(),
    providerInboxResult: v.union(
      v.literal("not_present"),
      v.literal("deleted"),
      v.literal("already_absent"),
    ),
    providerContextCount: v.number(),
    authUsernameReleased: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_target_user", ["targetUserId"])
    .index("by_status", ["status"]),

  demoSourceChecks: defineTable({
    singletonKey: v.literal("global"),
    generation: v.string(),
    mode: v.union(v.literal("manual"), v.literal("demo")),
    status: v.union(v.literal("queued"), v.literal("scraping"), v.literal("processing"), v.literal("waiting"), v.literal("completed"), v.literal("stopped"), v.literal("failed")),
    requestedBy: v.id("users"),
    checksCompleted: v.number(),
    maxChecks: v.number(),
    detailPagesUsed: v.number(),
    maxDetailPages: v.number(),
    startedAt: v.number(),
    expiresAt: v.number(),
    nextCheckAt: v.optional(v.number()),
    lastCompletedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_singleton_key", ["singletonKey"])
    .index("by_requested_by", ["requestedBy"]),

  demoSourceCheckRequests: defineTable({
    requestId: v.string(),
    requestedBy: v.id("users"),
    kind: v.union(v.literal("manual"), v.literal("demo")),
    accepted: v.boolean(),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_request_id", ["requestId"])
    .index("by_requested_by", ["requestedBy"]),

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
    monitorError: v.optional(v.string()),
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
    .index("by_target_and_detail_state", ["sourceTargetId", "detailState"])
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
    isDemo: v.optional(v.boolean()),
  })
    .index("by_city_and_status", ["city", "status"])
    .index("by_city_and_is_demo_and_status", ["city", "isDemo", "status"])
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
    side: v.optional(signalSide),
    title: v.optional(v.string()),
    city: v.optional(v.string()),
    district: v.optional(v.string()),
    arrangement: v.optional(v.union(
      v.literal("permanent"),
      v.literal("shared"),
      v.literal("hourly"),
      v.literal("unknown"),
    )),
    priceEur: v.optional(v.number()),
    pricePeriod: v.optional(v.union(v.literal("hour"), v.literal("month"), v.literal("unknown"))),
    observedAt: v.number(),
  })
    .index("by_signal", ["signalId"])
    .index("by_source", ["sourceId"])
    .index("by_fingerprint", ["fingerprint"]),

  matchAssessments: defineTable({
    ownerId: v.id("users"), savedNeedId: v.id("savedNeeds"), signalId: v.id("signals"),
    needRevision: v.number(), signalRevision: v.string(),
    status: v.union(v.literal("ready"), v.literal("failed")),
    assessment: v.optional(matchAssessmentValidator), model: v.string(), promptVersion: v.string(),
    retryAfter: v.number(), updatedAt: v.number(),
    attempts: v.optional(v.number()), errorCode: v.optional(v.string()),
  })
    .index("by_need_and_signal", ["savedNeedId", "signalId"])
    .index("by_owner", ["ownerId"]),

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
    eligible: v.optional(v.boolean()),
    contactEligible: v.optional(v.boolean()),
    needRevision: v.optional(v.number()),
    signalRevision: v.optional(v.string()),
    matchingRunId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status_and_updated_at", ["ownerId", "status", "updatedAt"])
    .index("by_saved_need_and_signal", ["savedNeedId", "signalId"])
    .index("by_owner_and_eligible_and_updated_at", ["ownerId", "eligible", "updatedAt"])
    .index("by_need_revision_and_eligible_score", ["savedNeedId", "needRevision", "eligible", "score"])
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

  marketAreaRebuilds: defineTable({
    cityKey: v.string(),
    city: v.string(),
    generation: v.number(),
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
    // Transitional compatibility fields. New APIs no longer accept either;
    // the migration removes districts after backfilling the fields below.
    city: v.string(),
    districts: v.optional(v.array(v.string())),
    locationQuery: v.optional(v.string()),
    locationLabel: v.optional(v.string()),
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
    centerLatitude: v.optional(v.number()),
    centerLongitude: v.optional(v.number()),
    locationPrecision: v.optional(locationPrecision),
    geocodeId: v.optional(v.id("geocodes")),
    genres: v.optional(v.array(v.string())),
    instruments: v.optional(v.array(v.string())),
    collaborationOpen: v.optional(v.boolean()),
    facets: v.optional(v.array(flexibleFacet)),
    matchingRevision: v.optional(v.number()),
    matchingRunId: v.optional(v.string()),
    acceptanceRequestId: v.optional(v.id("actionRequests")),
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
    // Scout may mark one exact draft revision ready for human review. Search
    // edits advance savedNeeds.matchingRevision, making this marker stale
    // without ever activating the search automatically.
    readyNeedRevision: v.optional(v.number()),
    briefReadyAt: v.optional(v.number()),
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
      v.literal("fact_corrected"),
      v.literal("fact_confirmed"),
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
    provider: v.optional(v.union(v.literal("realtime"), v.literal("live"))),
    providerSessionId: v.optional(v.string()),
    conversationLocale: v.optional(v.union(v.literal("en"), v.literal("de"))),
    languageRevision: v.optional(v.number()),
    claimGeneration: v.optional(v.number()),
    activeClaim: v.optional(v.object({
      requestId: v.string(),
      fingerprint: v.string(),
      generation: v.number(),
      source: v.union(v.literal("voice"), v.literal("text")),
      intent: v.optional(v.literal("capture_facts")),
      delegationId: v.optional(v.string()),
      eventIds: v.array(v.string()),
      promptMessageId: v.optional(v.string()),
      focusedSignalId: v.optional(v.id("signals")),
      decisionId: v.optional(v.id("decisions")),
      decisionUpdatedAt: v.optional(v.number()),
      needRevision: v.optional(v.number()),
      needSnapshotJson: v.optional(v.string()),
      startedAt: v.number(),
    })),
    requestTombstones: v.optional(v.array(v.object({
      requestId: v.string(),
      fingerprint: v.string(),
      promptMessageId: v.optional(v.string()),
      acceptedAt: v.number(),
    }))),
    recentResults: v.optional(v.array(v.object({
      status: v.union(
        v.literal("completed"),
        v.literal("needs_clarification"),
        v.literal("superseded"),
        v.literal("failed"),
        v.literal("outcome_unknown"),
      ),
      requestId: v.string(),
      resolvedEventIds: v.array(v.string()),
      spokenSummary: v.optional(v.string()),
      locale: v.union(v.literal("en"), v.literal("de")),
      revision: v.optional(v.number()),
      promptMessageId: v.optional(v.string()),
      assistantMessageId: v.optional(v.string()),
      changedFields: v.optional(v.array(v.string())),
      verifiedFacts: v.optional(v.array(v.string())),
      completedAt: v.number(),
    }))),
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
    browserProvider: v.optional(v.union(v.literal("firecrawl"), v.literal("browserbase"))),
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
    inboxSyncGeneration: v.optional(v.number()),
    inboxSyncActiveGeneration: v.optional(v.number()),
    inboxSyncDeadlineAt: v.optional(v.number()),
    inboxSyncLastReceiptKey: v.optional(v.string()),
    inboxSyncRequestedThreadIds: v.optional(v.array(v.string())),
    inboxSyncCursor: v.optional(v.number()),
    inboxSyncLastPartial: v.optional(v.boolean()),
    inboxSyncLastTruncated: v.optional(v.boolean()),
    inboxSyncLastTimedOut: v.optional(v.boolean()),
    activeWriteExecutionId: v.optional(v.id("actionExecutions")),
    activeWriteDeadlineAt: v.optional(v.number()),
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

  portalBrowserMaintenance: defineTable({
    key: v.literal("controlled_portal"),
    paused: v.boolean(),
    drainingProvider: v.optional(v.union(v.literal("firecrawl"), v.literal("browserbase"))),
    pausedBy: v.optional(v.id("users")),
    pausedAt: v.optional(v.number()),
    drainedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  providerCleanupLeases: defineTable({
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    contextId: v.id("browserContexts"),
    provider: v.union(v.literal("firecrawl"), v.literal("browserbase")),
    providerSessionId: v.string(),
    purpose: v.union(v.literal("write_proof"), v.literal("profile_proof"), v.literal("recovery")),
    generation: v.number(),
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("exhausted")),
    deadlineAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_context_and_generation", ["contextId", "generation"])
    .index("by_status_and_deadline_at", ["status", "deadlineAt"]),

  browserContexts: defineTable({
    connectionId: v.id("portalConnections"),
    ownerId: v.id("users"),
    providerContextId: v.string(),
    browserProvider: v.optional(v.union(v.literal("firecrawl"), v.literal("browserbase"))),
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
    probeAttempts: v.optional(v.number()),
    probeDeadlineAt: v.optional(v.number()),
    probeLastAttemptAt: v.optional(v.number()),
    probeErrorCode: v.optional(v.string()),
    writeProofGeneration: v.optional(v.number()),
    recoveryGeneration: v.optional(v.number()),
    cleanupGeneration: v.optional(v.number()),
    recoveryOutcome: v.optional(v.union(v.literal("awaiting_verification"), v.literal("auth_needed"), v.literal("review"))),
    pendingWriteExecutionId: v.optional(v.id("actionExecutions")),
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
    browserProvider: v.optional(v.union(v.literal("firecrawl"), v.literal("browserbase"))),
    browserEngine: v.optional(
      v.union(v.literal("stagehand"), v.literal("legacy"), v.literal("firecrawl")),
    ),
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
    inactivityDeadlineAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    resultCount: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    onboardingStage: v.optional(
      v.union(
        v.literal("opening_signup"),
        v.literal("waiting_verification"),
        v.literal("submitting_verification"),
        v.literal("human_required"),
        v.literal("completed"),
        v.literal("failed"),
      ),
    ),
    onboardingMailboxId: v.optional(v.id("userMailboxes")),
    verificationMessageId: v.optional(v.id("mailboxMessages")),
    verificationRequestedAt: v.optional(v.number()),
    onboardingPollAttempt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_connection", ["connectionId"])
    .index("by_status", ["status"])
    .index("by_browser_provider_and_status", ["browserProvider", "status"])
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
  })
    .index("by_run", ["runId"])
    .index("by_owner", ["ownerId"]),

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
    .index("by_thread_and_sent_at", ["threadId", "sentAt"])
    .index("by_owner", ["ownerId"]),

  /** Handlungsspielraum — one row per user (ADR 0001); defaults apply while absent. */
  scoutAutonomy: defineTable({
    ownerId: v.id("users"),
    mode: v.union(v.literal("autopilot"), v.literal("review")),
    contact: v.boolean(),
    viewings: v.boolean(),
    publishAd: v.boolean(),
    shareProfile: v.boolean(),
    sharePrivate: v.boolean(),
    version: v.number(),
    contentHash: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

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

  providerConversations: defineTable({
    ownerId: v.id("users"),
    conversationKey: v.string(),
    savedNeedId: v.id("savedNeeds"),
    signalId: v.id("signals"),
    opportunityId: v.optional(v.id("opportunities")),
    agentThreadId: v.string(),
    mailThreadId: v.optional(v.id("mailThreads")),
    platformThreadId: v.optional(v.id("platformThreads")),
    revision: v.number(),
    activeEventId: v.optional(v.id("providerTurns")),
    currentOfferId: v.optional(v.id("offerRevisions")),
    acceptanceRequestId: v.optional(v.id("actionRequests")),
    acceptedOfferId: v.optional(v.id("offerRevisions")),
    acceptedAt: v.optional(v.number()),
    state: v.union(v.literal("waiting"), v.literal("thinking"), v.literal("needs_attention"), v.literal("offer_ready"), v.literal("closed")),
    lastErrorCode: v.optional(v.string()),
    /** Nachrichten: when the musician last opened this conversation; absent means never read. */
    lastReadAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_need_and_signal", ["savedNeedId", "signalId"])
    .index("by_owner_and_key", ["ownerId", "conversationKey"])
    .index("by_need_and_updated_at", ["savedNeedId", "updatedAt"])
    .index("by_mail_thread", ["mailThreadId"])
    .index("by_platform_thread", ["platformThreadId"])
    .index("by_owner_and_updated_at", ["ownerId", "updatedAt"]),

  providerTurns: defineTable({
    conversationId: v.id("providerConversations"),
    sourceKey: v.string(),
    kind: v.union(v.literal("opportunity"), v.literal("mail_reply"), v.literal("portal_reply"), v.literal("musician_input")),
    mailMessageId: v.optional(v.id("mailMessages")),
    platformMessageId: v.optional(v.id("platformMessages")),
    /** musician_input: the musician's trusted answer to a Scout question (Entscheidung). */
    input: v.optional(v.string()),
    decisionId: v.optional(v.id("decisions")),
    revision: v.number(),
    promptMessageId: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("processing"), v.literal("completed"), v.literal("superseded"), v.literal("failed")),
    offerId: v.optional(v.id("offerRevisions")),
    errorCode: v.optional(v.string()),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_conversation_and_source", ["conversationId", "sourceKey"])
    .index("by_conversation_and_status_and_revision", ["conversationId", "status", "revision"])
    .index("by_conversation_and_kind_and_revision", ["conversationId", "kind", "revision"]),

  /**
   * Entscheidung: one question of the Scout to the musician, answered in the
   * Scout chat. At most one open decision per conversation (or per owner when
   * no conversation is involved); raising a new one supersedes the older one.
   */
  decisions: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.optional(v.id("savedNeeds")),
    conversationId: v.optional(v.id("providerConversations")),
    kind: v.union(
      v.literal("scout_question"),
      v.literal("review_message"),
      v.literal("private_data"),
      v.literal("binding_content"),
      v.literal("unsupported_claims"),
      v.literal("safety_unavailable"),
      v.literal("offer_ready"),
      v.literal("human_step"),
    ),
    status: v.union(v.literal("open"), v.literal("answered"), v.literal("superseded")),
    question: v.string(),
    detail: v.optional(v.string()),
    options: v.array(v.object({ id: v.string(), label: v.string() })),
    refs: v.object({
      requestId: v.optional(v.id("actionRequests")),
      offerId: v.optional(v.id("offerRevisions")),
      runId: v.optional(v.id("browserRuns")),
      connectionId: v.optional(v.id("portalConnections")),
    }),
    threadMessageId: v.optional(v.string()),
    answer: v.optional(v.object({ choice: v.string(), text: v.optional(v.string()), at: v.number() })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status", ["ownerId", "status"])
    .index("by_conversation_and_status", ["conversationId", "status"])
    .index("by_request", ["refs.requestId"]),

  offerRevisions: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    conversationId: v.id("providerConversations"),
    eventId: v.id("providerTurns"),
    revision: v.number(),
    needRevision: v.number(),
    signalRevision: v.string(),
    assessment: providerAssessmentValidator,
    ready: v.boolean(),
    blockers: v.array(v.string()),
    contentHash: v.string(),
    model: v.string(),
    promptVersion: v.string(),
    schemaVersion: v.string(),
    createdAt: v.number(),
  })
    .index("by_conversation_and_revision", ["conversationId", "revision"])
    .index("by_owner_and_created_at", ["ownerId", "createdAt"]),

  handoffs: defineTable({
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
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
    providerConversationId: v.optional(v.id("providerConversations")),
    providerOfferId: v.optional(v.id("offerRevisions")),
    providerActionKind: v.optional(v.literal("acceptance")),
    providerOfferHash: v.optional(v.string()),
    reviewContextHash: v.optional(v.string()),
    reviewDestinationHash: v.optional(v.string()),
    savedNeedId: v.optional(v.id("savedNeeds")),
    matchingNeedRevision: v.optional(v.number()),
    matchingSignalId: v.optional(v.id("signals")),
    matchingSignalRevision: v.optional(v.string()),
    opportunityId: v.optional(v.id("opportunities")),
    handoffId: v.optional(v.id("handoffs")),
    platformId: v.optional(v.id("sourcePlatforms")),
    connectionId: v.optional(v.id("portalConnections")),
    adapterBindingId: v.optional(v.id("sourceAdapterBindings")),
    automationMode: v.union(
      v.literal("exact_once"),
      v.literal("autopilot"),
    ),
    requestedActionType: externalActionType,
    personalDataScopes: v.array(personalDataScope),
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
      v.literal("blocked"),
    ),
    /** Last Freigabeprüfung verdict for this request (ADR 0002): never a silent stop. */
    gate: v.optional(
      v.object({
        outcome: v.union(
          v.literal("proceed"),
          v.literal("wait"),
          v.literal("ask_user"),
          v.literal("stop"),
        ),
        reason: v.optional(v.string()),
        detail: v.optional(v.string()),
        retryAt: v.optional(v.number()),
        attempts: v.optional(v.number()),
        autonomyVersion: v.number(),
        autonomyHash: v.string(),
        decidedAt: v.number(),
      }),
    ),
    executionIdempotencyKey: v.optional(v.string()),
    /** The musician dictated this text (Entscheidung "custom"); the Freigabeprüfung treats it as approved by the human. */
    humanDraft: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner_and_status_and_updated_at", ["ownerId", "status", "updatedAt"])
    .index("by_owner_and_saved_need_and_updated_at", ["ownerId", "savedNeedId", "updatedAt"])
    .index("by_status_and_updated_at", ["status", "updatedAt"])
    .index("by_opportunity", ["opportunityId"])
    .index("by_provider_offer", ["providerOfferId"])
    .index("by_provider_conversation_and_updated_at", ["providerConversationId", "updatedAt"])
    .index("by_handoff", ["handoffId"])
    .index("by_execution_idempotency_key", ["executionIdempotencyKey"]),

  messageSafetyAssessments: defineTable({
    requestId: v.id("actionRequests"), ownerId: v.id("users"),
    snapshotHash: v.string(), contentHash: v.string(), contentVersion: v.number(),
    assessment: messageSafetyValidator, model: v.string(), version: v.string(), createdAt: v.number(),
  })
    .index("by_request_and_snapshot", ["requestId", "snapshotHash"])
    .index("by_owner", ["ownerId"]),

  actionApprovals: defineTable({
    requestId: v.id("actionRequests"),
    ownerId: v.id("users"),
    contentVersion: v.number(),
    contentHash: v.string(),
    payloadSnapshot: actionPayload,
    providerOfferId: v.optional(v.id("offerRevisions")),
    providerOfferHash: v.optional(v.string()),
    reviewContextHash: v.optional(v.string()),
    reviewDestinationHash: v.optional(v.string()),
    policyVersionId: v.optional(v.id("sourceFlowPolicies")),
    decision: v.union(
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("authorized_by_autonomy"),
    ),
    /** Handlungsspielraum version the Freigabeprüfung acted on (ADR 0001). */
    autonomyVersion: v.optional(v.number()),
    autonomyHash: v.optional(v.string()),
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
    browserProvider: v.optional(v.union(v.literal("firecrawl"), v.literal("browserbase"))),
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
    .index("by_browser_provider_and_status", ["browserProvider", "status"])
    .index("by_owner_and_status_and_updated_at", ["ownerId", "status", "updatedAt"])
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
    .index("by_action_request_and_occurred_at", ["actionRequestId", "occurredAt"])
    .index("by_actor_user_id", ["actorUserId"]),

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
