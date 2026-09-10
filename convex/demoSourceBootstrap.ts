import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";
import { isUserResetTombstoned } from "./devUserReset";
import {
  CONTROLLED_AUTH_SOURCE_SLUG,
  CONTROLLED_SOURCE_SCHEDULE_MINUTES,
  CONTROLLED_SOURCE_SLUG,
  CONTROLLED_SOURCE_URL,
} from "./integrations/controlledSourceProofConfig";
import { approveControlledDemoConnectionCore } from "./portalConnections";

const GLOBAL_PLATFORM_SLUG = "roomscout-dev";
const GLOBAL_DOMAIN = "roomscout.dev";
const CONNECTION_LABEL = "roomscout.dev portal";
const CONNECTION_PATHS = ["/", "/sign-up", "/sign-in", "/listings", "/inbox"];
const USER_RECONCILIATION_PAGE_SIZE = 25;

export type ControlledDemoRecords = {
  platformId: Id<"sourcePlatforms">;
  publicSourceId: Id<"sources">;
  authenticatedSourceId: Id<"sources">;
  publicTargetId: Id<"sourceTargets">;
  contactPolicyId: Id<"sourceFlowPolicies">;
  contactBindingId: Id<"sourceAdapterBindings">;
};

/**
 * Idempotently establishes the first-party records shared by every user.
 * Public indexing is intentionally represented by a different source from the
 * authenticated portal connection and never depends on a user row.
 */
export async function ensureControlledDemoRecords(
  ctx: MutationCtx,
): Promise<ControlledDemoRecords> {
  const now = Date.now();
  let platform = await ctx.db
    .query("sourcePlatforms")
    .withIndex("by_canonical_domain", (q) =>
      q.eq("canonicalDomain", GLOBAL_DOMAIN),
    )
    .unique();
  if (platform && platform.slug !== GLOBAL_PLATFORM_SLUG) {
    throw new ConvexError({ code: "CONTROLLED_PLATFORM_CONFLICT" });
  }
  if (!platform) {
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: GLOBAL_PLATFORM_SLUG,
      name: "roomscout.dev controlled demo portal",
      canonicalDomain: GLOBAL_DOMAIN,
      kind: "community",
      status: "active",
      firstSeenAt: now,
      lastObservedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    platform = await ctx.db.get(platformId);
  } else if (platform.status !== "active") {
    await ctx.db.patch(platform._id, { status: "active", updatedAt: now });
    platform = await ctx.db.get(platform._id);
  }
  if (!platform)
    throw new ConvexError({ code: "CONTROLLED_PLATFORM_CREATE_FAILED" });
  const globalScopeKey = `platform:${platform._id}:roomscout-dev:contact`;

  const ensureSource = async (input: {
    slug: typeof CONTROLLED_SOURCE_SLUG | typeof CONTROLLED_AUTH_SOURCE_SLUG;
    name: string;
    accessMode: "public" | "authenticated";
    adapterKey: "generic-list-v1" | "roomscout-dev-v1";
    publicDisplay: boolean;
  }): Promise<Id<"sources">> => {
    let source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", input.slug))
      .unique();
    if (
      source &&
      (source.platformId !== platform._id ||
        source.baseUrl !== CONTROLLED_SOURCE_URL ||
        source.accessMode !== input.accessMode ||
        source.adapterKey !== input.adapterKey)
    ) {
      throw new ConvexError({
        code: "CONTROLLED_SOURCE_CONFLICT",
        sourceSlug: input.slug,
      });
    }
    if (!source) {
      const sourceId = await ctx.db.insert("sources", {
        platformId: platform._id,
        slug: input.slug,
        name: input.name,
        baseUrl: CONTROLLED_SOURCE_URL,
        side: "both",
        status: "active",
        health: "unknown",
        geographicScope: "Controlled hackathon demo",
        accessMode: input.accessMode,
        automationReview: "approved",
        policyNotes:
          "First-party controlled demo. Public indexing and per-user authenticated portal access are separate capabilities.",
        reviewedAt: now,
        adapterKey: input.adapterKey,
        publicDisplay: input.publicDisplay,
        createdAt: now,
        updatedAt: now,
      });
      source = await ctx.db.get(sourceId);
    } else {
      await ctx.db.patch(source._id, {
        status: "active",
        automationReview: "approved",
        publicDisplay: input.publicDisplay,
        reviewedAt: source.reviewedAt ?? now,
        updatedAt: now,
      });
      source = await ctx.db.get(source._id);
    }
    if (!source)
      throw new ConvexError({ code: "CONTROLLED_SOURCE_CREATE_FAILED" });
    return source._id;
  };

  const publicSourceId = await ensureSource({
    slug: CONTROLLED_SOURCE_SLUG,
    name: "roomscout.dev · demo public listings",
    accessMode: "public",
    adapterKey: "generic-list-v1",
    publicDisplay: true,
  });
  const authenticatedSourceId = await ensureSource({
    slug: CONTROLLED_AUTH_SOURCE_SLUG,
    name: "roomscout.dev · demo connected messaging",
    accessMode: "authenticated",
    adapterKey: "roomscout-dev-v1",
    publicDisplay: false,
  });

  const targets = await ctx.db
    .query("sourceTargets")
    .withIndex("by_source", (q) => q.eq("sourceId", publicSourceId))
    .take(20);
  const unexpectedTarget = targets.find(
    (target) => target.url !== CONTROLLED_SOURCE_URL,
  );
  if (unexpectedTarget)
    throw new ConvexError({ code: "CONTROLLED_TARGET_CONFLICT" });
  const target = targets.find(
    (candidate) => candidate.url === CONTROLLED_SOURCE_URL,
  );
  let publicTargetId: Id<"sourceTargets">;
  if (!target) {
    publicTargetId = await ctx.db.insert("sourceTargets", {
      sourceId: publicSourceId,
      url: CONTROLLED_SOURCE_URL,
      mode: "scrape",
      changeTrackingTag: "roomscout-dev-public:v1",
      scheduleMinutes: CONTROLLED_SOURCE_SCHEDULE_MINUTES,
      nextRunAt: now,
      paused: false,
      monitorStatus: "unconfigured",
      sideScope: "both",
      adapterKey: "generic-list-v1",
      successfulSnapshotCount: 0,
      backlogCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await ctx.db.patch(target._id, {
      scheduleMinutes: CONTROLLED_SOURCE_SCHEDULE_MINUTES,
      paused: false,
      updatedAt: now,
    });
    publicTargetId = target._id;
  }

  const policies = await ctx.db
    .query("sourceFlowPolicies")
    .withIndex("by_scope_key_and_flow_and_status", (q) =>
      q
        .eq("scopeKey", globalScopeKey)
        .eq("flow", "contact")
        .eq("status", "approved"),
    )
    .take(1);
  let contactPolicyId = policies[0]?._id;
  if (!contactPolicyId) {
    contactPolicyId = await ctx.db.insert("sourceFlowPolicies", {
      platformId: platform._id,
      sourceId: authenticatedSourceId,
      scopeKey: globalScopeKey,
      flow: "contact",
      version: 1,
      status: "approved",
      decision: "allowed",
      maxAutomationLevel: "approved_execute",
      userConnectionRequired: true,
      humanPresenceRequired: false,
      accountCreationAllowed: true,
      externalApprovalRequired: true,
      robotsDecision: "allowed",
      termsDecision: "allowed",
      retentionDays: 30,
      evidenceUrls: [CONTROLLED_SOURCE_URL],
      approvedAt: now,
      nextReviewAt: now + 30 * 24 * 60 * 60_000,
      createdAt: now,
      updatedAt: now,
    });
  }

  const bindings = await ctx.db
    .query("sourceAdapterBindings")
    .withIndex("by_scope_key_and_flow_and_status", (q) =>
      q
        .eq("scopeKey", globalScopeKey)
        .eq("flow", "contact")
        .eq("status", "active"),
    )
    .take(1);
  let contactBindingId = bindings[0]?._id;
  if (!contactBindingId) {
    contactBindingId = await ctx.db.insert("sourceAdapterBindings", {
      platformId: platform._id,
      sourceId: authenticatedSourceId,
      scopeKey: globalScopeKey,
      flow: "contact",
      adapterKey: "roomscout-dev-v1",
      adapterVersion: 1,
      status: "active",
      executor: "browserbase",
      config: {
        kind: "browserbase",
        workflowKey: "roomscout-dev.platform-message.v1",
        contextRequired: true,
      },
      configFingerprint: "roomscout-dev.platform-message.v1:1",
      policyVersionId: contactPolicyId,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    platformId: platform._id,
    publicSourceId,
    authenticatedSourceId,
    publicTargetId,
    contactPolicyId,
    contactBindingId,
  };
}

async function ensureOwnerConnection(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  records: ControlledDemoRecords,
): Promise<{ connectionId: Id<"portalConnections">; created: boolean }> {
  if (!(await ctx.db.get(ownerId)))
    throw new ConvexError({ code: "USER_NOT_FOUND" });
  let connection = await ctx.db
    .query("portalConnections")
    .withIndex("by_owner_and_source", (q) =>
      q.eq("ownerId", ownerId).eq("sourceId", records.authenticatedSourceId),
    )
    .unique();
  const created = connection === null;
  if (!connection) {
    const now = Date.now();
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId,
      sourceId: records.authenticatedSourceId,
      platformId: records.platformId,
      label: CONNECTION_LABEL,
      allowedDomains: [GLOBAL_DOMAIN],
      allowedPaths: CONNECTION_PATHS,
      inboxPath: "/inbox",
      adapterKey: "roomscout-dev-v1",
      status: "needs_auth",
      policyDecision: "allowed",
      allowReadOnlyRecon: false,
      allowInboxPolling: true,
      pollIntervalMinutes: 60,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    connection = await ctx.db.get(connectionId);
  }
  if (!connection) throw new ConvexError({ code: "CONNECTION_CREATE_FAILED" });
  if (connection.status === "disabled" || connection.status === "paused") {
    return { connectionId: connection._id, created };
  }
  await approveControlledDemoConnectionCore(ctx, connection._id, {
    preserveEstablishedState: true,
  });
  return { connectionId: connection._id, created };
}

export const ensureGlobalRecords = internalMutation({
  args: {},
  returns: v.object({
    platformId: v.id("sourcePlatforms"),
    publicSourceId: v.id("sources"),
    authenticatedSourceId: v.id("sources"),
    publicTargetId: v.id("sourceTargets"),
    contactPolicyId: v.id("sourceFlowPolicies"),
    contactBindingId: v.id("sourceAdapterBindings"),
  }),
  handler: ensureControlledDemoRecords,
});

/** Signup hook: creates only a pending authenticated portal connection. */
export const bootstrapControlledDemoForOwner = internalMutation({
  args: { ownerId: v.id("users") },
  returns: v.object({
    connectionId: v.id("portalConnections"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.ownerId)) || await isUserResetTombstoned(ctx, args.ownerId)) {
      throw new ConvexError({ code: "USER_NOT_FOUND" });
    }
    const records = await ensureControlledDemoRecords(ctx);
    return await ensureOwnerConnection(ctx, args.ownerId, records);
  },
});

/** Bounded safety net for users created outside the primary signup path. */
export const reconcileDefaultConnections = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    usersVisited: v.number(),
    connectionsCreated: v.number(),
    continued: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const records = await ensureControlledDemoRecords(ctx);
    const page = await ctx.db.query("users").paginate({
      numItems: USER_RECONCILIATION_PAGE_SIZE,
      cursor: args.cursor,
    });
    let connectionsCreated = 0;
    for (const user of page.page) {
      const result = await ensureOwnerConnection(ctx, user._id, records);
      if (result.created) connectionsCreated += 1;
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.demoSourceBootstrap.reconcileDefaultConnections,
        {
          cursor: page.continueCursor,
        },
      );
    }
    return {
      usersVisited: page.page.length,
      connectionsCreated,
      continued: !page.isDone,
    };
  },
});

export const getGlobalMonitorContext = internalQuery({
  args: {},
  returns: v.union(
    v.object({
      sourceTargetId: v.id("sourceTargets"),
      sourceName: v.string(),
      url: v.string(),
      scheduleMinutes: v.number(),
      providerMonitorId: v.optional(v.string()),
      storedFingerprint: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", CONTROLLED_SOURCE_SLUG))
      .unique();
    if (!source || source.accessMode !== "public") return null;
    const targets = await ctx.db
      .query("sourceTargets")
      .withIndex("by_source", (q) => q.eq("sourceId", source._id))
      .take(20);
    const target = targets.find(
      (candidate) => candidate.url === CONTROLLED_SOURCE_URL,
    );
    if (!target) return null;
    const monitor = await ctx.db
      .query("sourceMonitors")
      .withIndex("by_source_target", (q) => q.eq("sourceTargetId", target._id))
      .unique();
    return {
      sourceTargetId: target._id,
      sourceName: source.name,
      url: target.url,
      scheduleMinutes: target.scheduleMinutes,
      providerMonitorId: monitor?.providerMonitorId ?? target.providerMonitorId,
      storedFingerprint: monitor?.configFingerprint,
    };
  },
});

export const getStoredMonitorProof = internalQuery({
  args: { sourceTargetId: v.id("sourceTargets") },
  returns: v.union(
    v.object({
      lastCheckAt: v.optional(v.number()),
      lastCheckStatus: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const monitor = await ctx.db
      .query("sourceMonitors")
      .withIndex("by_source_target", (q) =>
        q.eq("sourceTargetId", args.sourceTargetId),
      )
      .unique();
    return monitor
      ? {
          lastCheckAt: monitor.lastCheckAt,
          lastCheckStatus: monitor.lastCheckStatus,
        }
      : null;
  },
});

export const globalStatus = query({
  args: { now: v.number() },
  returns: v.object({
    ready: v.boolean(),
    reasons: v.array(v.string()),
    publicSourceActive: v.boolean(),
    publicIndexIndependentOfConnections: v.boolean(),
    authenticatedSourceReady: v.boolean(),
    targetActive: v.boolean(),
    scheduleMinutes: v.union(v.number(), v.null()),
    monitorConfigured: v.boolean(),
    monitorState: v.union(v.string(), v.null()),
    lastReconciledAt: v.union(v.number(), v.null()),
    lastCheckAt: v.union(v.number(), v.null()),
    lastCheckStatus: v.union(v.string(), v.null()),
    checkOverdue: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    if (!Number.isFinite(args.now) || args.now < 0) {
      throw new ConvexError({ code: "INVALID_NOW" });
    }
    const publicSource = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", CONTROLLED_SOURCE_SLUG))
      .unique();
    const authenticatedSource = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", CONTROLLED_AUTH_SOURCE_SLUG))
      .unique();
    const target = publicSource
      ? (
          await ctx.db
            .query("sourceTargets")
            .withIndex("by_source", (q) => q.eq("sourceId", publicSource._id))
            .take(20)
        ).find((candidate) => candidate.url === CONTROLLED_SOURCE_URL)
      : undefined;
    const monitor = target
      ? await ctx.db
          .query("sourceMonitors")
          .withIndex("by_source_target", (q) =>
            q.eq("sourceTargetId", target._id),
          )
          .unique()
      : null;
    const publicSourceActive = Boolean(
      publicSource?.status === "active" &&
      publicSource.publicDisplay === true &&
      publicSource.accessMode === "public" &&
      publicSource.automationReview === "approved",
    );
    const authenticatedSourceReady = Boolean(
      authenticatedSource?.status === "active" &&
      authenticatedSource.publicDisplay !== true &&
      authenticatedSource.accessMode === "authenticated" &&
      authenticatedSource.automationReview === "approved",
    );
    const targetActive = Boolean(
      target &&
      !target.paused &&
      target.scheduleMinutes === CONTROLLED_SOURCE_SCHEDULE_MINUTES,
    );
    const monitorConfigured = Boolean(
      monitor?.state === "active" &&
      monitor.providerMonitorId &&
      target?.providerMonitorId,
    );
    const allowedLagMs = CONTROLLED_SOURCE_SCHEDULE_MINUTES * 60_000 * 2;
    const checkOverdue =
      !monitor?.lastCheckAt || args.now - monitor.lastCheckAt > allowedLagMs;
    const reasons: string[] = [];
    if (!publicSourceActive)
      reasons.push(
        "Public roomscout.dev source is not active and displayable.",
      );
    if (!authenticatedSourceReady)
      reasons.push("Authenticated roomscout.dev source is not ready.");
    if (!targetActive)
      reasons.push("Public monitor target is paused or has the wrong cadence.");
    if (!monitorConfigured)
      reasons.push("Firecrawl Native Monitor is not reconciled as active.");
    if (checkOverdue)
      reasons.push(
        "No successful monitor check has arrived within two expected cadences.",
      );
    return {
      ready: reasons.length === 0,
      reasons,
      publicSourceActive,
      publicIndexIndependentOfConnections:
        publicSource?.accessMode === "public",
      authenticatedSourceReady,
      targetActive,
      scheduleMinutes: target?.scheduleMinutes ?? null,
      monitorConfigured,
      monitorState: monitor?.state ?? null,
      lastReconciledAt: monitor?.lastReconciledAt ?? null,
      lastCheckAt: monitor?.lastCheckAt ?? null,
      lastCheckStatus: monitor?.lastCheckStatus ?? null,
      checkOverdue,
    };
  },
});
