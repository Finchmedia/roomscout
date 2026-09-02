import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, mutation, type MutationCtx } from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";

export const ROOMSCOUT_SOURCE_SEEDS = [
  {
    slug: "musiker-in-deiner-stadt-room-demand",
    name: "Musiker in deiner Stadt · Proberaum gesucht",
    baseUrl: "https://www.musiker-in-deiner-stadt.de",
    targetUrl:
      "https://www.musiker-in-deiner-stadt.de/kleinanzeigen.finden/proberaum-gesucht",
    side: "demand" as const,
    geographicScope: "Stuttgart region",
    adapterKey: "generic-list-v1",
    scheduleMinutes: 24 * 60,
  },
  {
    slug: "musiker-sucht-berlin",
    name: "Musiker-sucht.de · Berlin",
    baseUrl: "https://www.musiker-sucht.de",
    targetUrl: "https://www.musiker-sucht.de/stadt/berlin",
    side: "both" as const,
    geographicScope: "Berlin",
    adapterKey: "generic-list-v1",
    scheduleMinutes: 24 * 60,
  },
  {
    slug: "bandnet-hamburg-room-supply",
    name: "Bandnet Hamburg · Proberaum frei",
    baseUrl: "https://bandnet.hamburg",
    targetUrl:
      "https://bandnet.hamburg/anzeige/kategorie/19/proberaum-frei",
    side: "supply" as const,
    geographicScope: "Hamburg",
    adapterKey: "generic-list-v1",
    scheduleMinutes: 24 * 60,
  },
  {
    slug: "bandnet-hamburg-room-demand",
    name: "Bandnet Hamburg · Proberaum gesucht",
    baseUrl: "https://bandnet.hamburg",
    targetUrl:
      "https://bandnet.hamburg/anzeige/kategorie/20/proberaum-gesucht",
    side: "demand" as const,
    geographicScope: "Hamburg",
    adapterKey: "generic-list-v1",
    scheduleMinutes: 24 * 60,
  },
] as const;

/**
 * Creates review-only, paused source definitions. This never provisions a
 * Firecrawl monitor or starts a crawl; an operator must review and activate it.
 */
async function seedReviewSourceRecords(ctx: MutationCtx) {
  let sourcesCreated = 0;
  let targetsCreated = 0;
  const now = Date.now();

  for (const seed of ROOMSCOUT_SOURCE_SEEDS) {
    let source = await ctx.db.query("sources").withIndex("by_slug", (q) => q.eq("slug", seed.slug)).unique();
    if (!source) {
      const sourceId = await ctx.db.insert("sources", {
        slug: seed.slug, name: seed.name, baseUrl: seed.baseUrl, side: seed.side,
        status: "reviewing", health: "unknown", geographicScope: seed.geographicScope,
        accessMode: "public", automationReview: "pending",
        policyNotes: "Seeded for operator review. Confirm terms, crawl policy, and extraction quality before activation.",
        adapterKey: seed.adapterKey, publicDisplay: false, createdAt: now, updatedAt: now,
      });
      source = await ctx.db.get(sourceId);
      sourcesCreated += 1;
    }
    if (!source) continue;
    const targets = await ctx.db.query("sourceTargets").withIndex("by_source", (q) => q.eq("sourceId", source._id)).take(20);
    if (targets.some((target) => target.url === seed.targetUrl)) continue;
    await ctx.db.insert("sourceTargets", {
      sourceId: source._id, url: seed.targetUrl, mode: "scrape",
      changeTrackingTag: `roomscout:${seed.slug}:v1`, scheduleMinutes: seed.scheduleMinutes,
      nextRunAt: now, paused: true, monitorStatus: "unconfigured",
      cityScope: seed.geographicScope, sideScope: seed.side, adapterKey: seed.adapterKey,
      backlogCount: 0, successfulSnapshotCount: 0, createdAt: now, updatedAt: now,
    });
    targetsCreated += 1;
  }
  return { sourcesCreated, targetsCreated };
}

export const seedReviewSources = mutation({
  args: {},
  returns: v.object({ sourcesCreated: v.number(), targetsCreated: v.number() }),
  handler: async (ctx) => {
    await requireOperatorId(ctx);
    return await seedReviewSourceRecords(ctx);
  },
});

export const seedReviewSourcesInternal = internalMutation({
  args: {},
  returns: v.object({ sourcesCreated: v.number(), targetsCreated: v.number() }),
  handler: seedReviewSourceRecords,
});

/**
 * Creates the two deliberately separate records needed for the controlled
 * roomscout.dev proof: a public SSR listing source for Firecrawl and an
 * authenticated source for per-user Browserbase Contexts. Nothing is crawled
 * and no user connection is created by this mutation.
 */
export const seedControlledDemoPortal = mutation({
  args: { baseUrl: v.string() },
  returns: v.object({
    platformId: v.id("sourcePlatforms"),
    publicSourceId: v.id("sources"),
    authenticatedSourceId: v.id("sources"),
    publicTargetId: v.id("sourceTargets"),
    contactPolicyId: v.id("sourceFlowPolicies"),
    contactBindingId: v.id("sourceAdapterBindings"),
  }),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const parsed = new URL(args.baseUrl);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname.toLowerCase() !== "roomscout.dev" ||
      parsed.port ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new ConvexError({ code: "INVALID_DEMO_PORTAL_URL" });
    }
    const canonicalDomain = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!canonicalDomain || canonicalDomain === "localhost") {
      throw new ConvexError({ code: "INVALID_DEMO_PORTAL_URL" });
    }
    const baseUrl = `${parsed.protocol}//${parsed.host}`;
    const now = Date.now();

    let platform = await ctx.db
      .query("sourcePlatforms")
      .withIndex("by_canonical_domain", (q) =>
        q.eq("canonicalDomain", canonicalDomain),
      )
      .unique();
    if (!platform) {
      const platformId = await ctx.db.insert("sourcePlatforms", {
        slug: "roomscout-dev",
        name: "roomscout.dev controlled demo portal",
        canonicalDomain,
        kind: "community",
        status: "active",
        firstSeenAt: now,
        lastObservedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      platform = await ctx.db.get(platformId);
    }
    if (!platform) throw new ConvexError({ code: "DEMO_PLATFORM_CREATE_FAILED" });

    async function ensureSource(input: {
      slug: string;
      name: string;
      accessMode: "public" | "authenticated";
    }) {
      const existing = await ctx.db
        .query("sources")
        .withIndex("by_slug", (q) => q.eq("slug", input.slug))
        .unique();
      if (existing) {
        const expectedAdapter =
          input.accessMode === "authenticated"
            ? "roomscout-dev-v1"
            : "generic-list-v1";
        if (
          existing.platformId !== platform!._id ||
          existing.baseUrl !== baseUrl ||
          existing.accessMode !== input.accessMode ||
          existing.adapterKey !== expectedAdapter
        ) {
          throw new ConvexError({ code: "DEMO_SOURCE_CONFIGURATION_CONFLICT" });
        }
        return existing._id;
      }
      return await ctx.db.insert("sources", {
        platformId: platform!._id,
        slug: input.slug,
        name: input.name,
        baseUrl,
        side: "both",
        status: "paused",
        health: "unknown",
        geographicScope: "Controlled hackathon demo",
        accessMode: input.accessMode,
        automationReview: "approved",
        policyNotes:
          "First-party controlled demo surface. Public reads and authenticated messaging remain separate; no real third party receives test traffic.",
        reviewedAt: now,
        adapterKey:
          input.accessMode === "authenticated"
            ? "roomscout-dev-v1"
            : "generic-list-v1",
        publicDisplay: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    const publicSourceId = await ensureSource({
      slug: "roomscout-dev-public",
      name: "roomscout.dev · demo public listings",
      accessMode: "public",
    });
    const authenticatedSourceId = await ensureSource({
      slug: "roomscout-dev-connected",
      name: "roomscout.dev · demo connected messaging",
      accessMode: "authenticated",
    });

    const existingTargets = await ctx.db
      .query("sourceTargets")
      .withIndex("by_source", (q) => q.eq("sourceId", publicSourceId))
      .take(20);
    let publicTargetId = existingTargets.find((target) => target.url === baseUrl)?._id;
    if (!publicTargetId) {
      publicTargetId = await ctx.db.insert("sourceTargets", {
        sourceId: publicSourceId,
        url: baseUrl,
        mode: "scrape",
        changeTrackingTag: "roomscout-dev-public:v1",
        scheduleMinutes: 24 * 60,
        nextRunAt: now,
        paused: true,
        monitorStatus: "unconfigured",
        sideScope: "both",
        adapterKey: "generic-list-v1",
        successfulSnapshotCount: 0,
        backlogCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    const scopeKey = `platform:${platform._id}:roomscout-dev:contact`;
    const priorPolicies = await ctx.db
      .query("sourceFlowPolicies")
      .withIndex("by_scope_key_and_flow_and_status", (q) =>
        q.eq("scopeKey", scopeKey).eq("flow", "contact").eq("status", "approved"),
      )
      .take(1);
    let contactPolicyId = priorPolicies[0]?._id;
    if (!contactPolicyId) {
      contactPolicyId = await ctx.db.insert("sourceFlowPolicies", {
        platformId: platform._id,
        sourceId: authenticatedSourceId,
        scopeKey,
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
        evidenceUrls: [baseUrl],
        reviewedBy: operatorId,
        approvedAt: now,
        nextReviewAt: now + 30 * 24 * 60 * 60_000,
        createdAt: now,
        updatedAt: now,
      });
    }

    const existingBindings = await ctx.db
      .query("sourceAdapterBindings")
      .withIndex("by_scope_key_and_flow_and_status", (q) =>
        q.eq("scopeKey", scopeKey).eq("flow", "contact").eq("status", "active"),
      )
      .take(1);
    let contactBindingId = existingBindings[0]?._id;
    if (!contactBindingId) {
      contactBindingId = await ctx.db.insert("sourceAdapterBindings", {
        platformId: platform._id,
        sourceId: authenticatedSourceId,
        scopeKey,
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
  },
});

export const reviewSource = mutation({
  args: {
    sourceId: v.id("sources"),
    decision: v.union(v.literal("approved"), v.literal("restricted"), v.literal("pending")),
    policyNotes: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    const now = Date.now();
    await ctx.db.patch(source._id, {
      automationReview: args.decision,
      status: args.decision === "approved" ? "paused" : "reviewing",
      policyNotes: args.policyNotes.trim().slice(0, 2_000),
      reviewedAt: args.decision === "pending" ? undefined : now,
      publicDisplay: false,
      updatedAt: now,
    });
    if (args.decision !== "approved") {
      const targets = await ctx.db.query("sourceTargets").withIndex("by_source", (q) => q.eq("sourceId", source._id)).take(20);
      for (const target of targets) await ctx.db.patch(target._id, { paused: true, updatedAt: now });
    }
    return null;
  },
});

export const setSourceActive = mutation({
  args: { sourceId: v.id("sources"), active: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (!source) throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    if (args.active && (source.automationReview !== "approved" || source.accessMode !== "public")) {
      throw new ConvexError({ code: "SOURCE_REVIEW_REQUIRED" });
    }
    const now = Date.now();
    await ctx.db.patch(source._id, {
      status: args.active ? "active" : "paused",
      publicDisplay: args.active,
      updatedAt: now,
    });
    const targets = await ctx.db.query("sourceTargets").withIndex("by_source", (q) => q.eq("sourceId", source._id)).take(20);
    for (const target of targets) {
      await ctx.db.patch(target._id, { paused: !args.active, nextRunAt: now, updatedAt: now });
    }
    await ctx.scheduler.runAfter(0, internal.firecrawl.runDueTargets, {});
    return null;
  },
});

export const syncMonitors = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOperatorId(ctx);
    await ctx.scheduler.runAfter(0, internal.firecrawl.runDueTargets, {});
    return null;
  },
});

export const continueBacklog = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOperatorId(ctx);
    await ctx.scheduler.runAfter(0, internal.firecrawlDetails.processDetailBacklog, {});
    return null;
  },
});

export const retrySourceEntry = mutation({
  args: { sourceEntryId: v.id("sourceEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const entry = await ctx.db.get(args.sourceEntryId);
    if (!entry) throw new ConvexError({ code: "SOURCE_ENTRY_NOT_FOUND" });
    if (entry.detailState !== "failed") throw new ConvexError({ code: "SOURCE_ENTRY_NOT_FAILED" });
    await ctx.db.patch(entry._id, {
      detailState: "queued",
      detailAttempts: 0,
      nextDetailAttemptAt: Date.now(),
      error: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.firecrawlDetails.processDetailBacklog, {});
    return null;
  },
});

export const getTargetForRun = internalQuery({
  args: { sourceTargetId: v.id("sourceTargets") },
  returns: v.union(v.object({ providerMonitorId: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (!target || target.paused || !target.providerMonitorId) return null;
    const source = await ctx.db.get(target.sourceId);
    if (!source || source.status !== "active" || source.automationReview !== "approved") return null;
    return { providerMonitorId: target.providerMonitorId };
  },
});
