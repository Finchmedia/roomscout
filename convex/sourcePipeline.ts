/**
 * CLI control surface for source gathering.
 *
 * Every function here is internal, so it is driven with `npx convex run`
 * without an operator session, and none of them start recurring work:
 * promotion leaves sources in review with their targets paused, and
 * activation keeps them paused unless monitoring is explicitly requested.
 * Firecrawl only ever runs when an operator asks for a one-time scrape.
 */

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import {
  assessListingQuality,
  isPlaceableCity,
  isWithinGermany,
} from "./lib/listingQuality";
import { germanDiscoveryCities } from "./lib/sourceDiscoveryQueries";
import {
  requiresTosReview,
  TOS_REVIEW_SNIPPET_PREFIX,
} from "./lib/sourceHostPolicy";

const COUNT_CAP = 2_000;

function cleanSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function normalizedCityName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** One shot status read for the CLI: what exists and what is running. */
export const summary = internalQuery({
  args: {},
  returns: v.object({
    candidates: v.object({
      new: v.number(),
      reviewing: v.number(),
      promoted: v.number(),
      ignored: v.number(),
      capped: v.boolean(),
    }),
    platforms: v.number(),
    sources: v.object({
      reviewing: v.number(),
      paused: v.number(),
      active: v.number(),
    }),
    targets: v.object({ total: v.number(), paused: v.number() }),
    sourceEntries: v.number(),
    geoAreas: v.number(),
    discoveryBatches: v.object({
      total: v.number(),
      completed: v.number(),
      failed: v.number(),
      running: v.number(),
    }),
    totalDiscoveryQueries: v.number(),
  }),
  handler: async (ctx) => {
    const countCandidates = async (
      status: "new" | "reviewing" | "promoted" | "ignored",
    ) =>
      (
        await ctx.db
          .query("sourceCandidates")
          .withIndex("by_status_and_last_seen_at", (q) => q.eq("status", status))
          .take(COUNT_CAP)
      ).length;
    const newC = await countCandidates("new");
    const reviewingC = await countCandidates("reviewing");
    const promotedC = await countCandidates("promoted");
    const ignoredC = await countCandidates("ignored");
    const [platforms, sources, targets, entries, geoAreas, batches] =
      await Promise.all([
        ctx.db.query("sourcePlatforms").take(COUNT_CAP),
        ctx.db.query("sources").take(COUNT_CAP),
        ctx.db.query("sourceTargets").take(COUNT_CAP),
        ctx.db.query("sourceEntries").take(COUNT_CAP),
        ctx.db.query("geoAreas").take(COUNT_CAP),
        ctx.db.query("sourceDiscoveryBatches").take(COUNT_CAP),
      ]);
    return {
      candidates: {
        new: newC,
        reviewing: reviewingC,
        promoted: promotedC,
        ignored: ignoredC,
        capped: newC >= COUNT_CAP,
      },
      platforms: platforms.length,
      sources: {
        reviewing: sources.filter((s) => s.status === "reviewing").length,
        paused: sources.filter((s) => s.status === "paused").length,
        active: sources.filter((s) => s.status === "active").length,
      },
      targets: {
        total: targets.length,
        paused: targets.filter((t) => t.paused).length,
      },
      sourceEntries: entries.length,
      geoAreas: geoAreas.length,
      discoveryBatches: {
        total: batches.length,
        completed: batches.filter((b) => b.status === "completed").length,
        failed: batches.filter((b) => b.status === "failed").length,
        running: batches.filter((b) => b.status === "running").length,
      },
      totalDiscoveryQueries: germanDiscoveryCities().length * 4,
    };
  },
});

/**
 * Seeds the German cities discovery sweeps so candidates resolve a geo area
 * and coverage can be attributed. Matches the `de:<slug>` key convention the
 * pilot migration established.
 */
export const seedGeoAreas = internalMutation({
  args: {},
  returns: v.object({ created: v.number(), existing: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    let created = 0;
    let existing = 0;
    for (const city of germanDiscoveryCities()) {
      const displayName = city.replace(/\s*\(.*?\)\s*/g, " ").trim();
      const key = `de:${cleanSlug(displayName)}`;
      const row = await ctx.db
        .query("geoAreas")
        .withIndex("by_key", (q) => q.eq("key", key))
        .unique();
      if (row !== null) {
        existing += 1;
        continue;
      }
      await ctx.db.insert("geoAreas", {
        key,
        name: displayName,
        normalizedName: normalizedCityName(displayName),
        countryCode: "DE",
        type: "city",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      created += 1;
    }
    return { created, existing };
  },
});

async function ensurePlatformForCandidate(
  ctx: MutationCtx,
  candidate: Doc<"sourceCandidates">,
  kind: PlatformKind,
): Promise<Id<"sourcePlatforms">> {
  const existing = await ctx.db
    .query("sourcePlatforms")
    .withIndex("by_canonical_domain", (q) =>
      q.eq("canonicalDomain", candidate.canonicalDomain),
    )
    .unique();
  const now = Date.now();
  if (existing !== null) {
    await ctx.db.patch(existing._id, {
      lastObservedAt: Math.max(existing.lastObservedAt, candidate.lastSeenAt),
      updatedAt: now,
    });
    return existing._id;
  }
  const baseSlug = cleanSlug(candidate.canonicalDomain) || "source";
  let slug = baseSlug;
  for (
    let suffix = 2;
    await ctx.db
      .query("sourcePlatforms")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    suffix += 1
  ) {
    slug = `${baseSlug}-${suffix}`.slice(0, 80);
  }
  return await ctx.db.insert("sourcePlatforms", {
    slug,
    name: candidate.name.slice(0, 180),
    canonicalDomain: candidate.canonicalDomain,
    kind,
    status: "reviewing",
    firstSeenAt: candidate.firstSeenAt,
    lastObservedAt: candidate.lastSeenAt,
    createdAt: now,
    updatedAt: now,
  });
}

const PLATFORM_KINDS = [
  "classifieds",
  "community",
  "marketplace",
  "directory",
  "studio_network",
  "other",
] as const;
export type PlatformKind = (typeof PLATFORM_KINDS)[number];

type PromotionOutcome = {
  source: Doc<"sources"> | null;
  sourceCreated: boolean;
  targetCreated: boolean;
  coverageCreated: boolean;
};

/**
 * Creates the platform, source and paused scrape target for one candidate.
 * Shared by CLI bulk promotion and AI triage so both produce identical rows.
 */
async function promoteCandidateToSource(
  ctx: MutationCtx,
  candidate: Doc<"sourceCandidates">,
  options: { kind: PlatformKind; policyNotes?: string },
): Promise<PromotionOutcome> {
  const now = Date.now();
  const platformId = await ensurePlatformForCandidate(ctx, candidate, options.kind);
  await ctx.db.patch(candidate._id, {
    status: "promoted",
    promotedPlatformId: platformId,
    updatedAt: now,
  });

  let sourceCreated = false;
  let targetCreated = false;
  let coverageCreated = false;

  let source = await ctx.db
    .query("sources")
    .withIndex("by_platform", (q) => q.eq("platformId", platformId))
    .first();
  if (source === null) {
    const baseSlug = cleanSlug(candidate.canonicalDomain) || "source";
    let slug = baseSlug;
    for (
      let suffix = 2;
      await ctx.db
        .query("sources")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      suffix += 1
    ) {
      slug = `${baseSlug}-${suffix}`.slice(0, 80);
    }
    const sourceId = await ctx.db.insert("sources", {
      platformId,
      slug,
      name: candidate.name.slice(0, 180),
      baseUrl: `https://${candidate.canonicalDomain}`,
      side: candidate.side,
      status: "reviewing",
      health: "unknown",
      accessMode: "public",
      automationReview: "pending",
      policyNotes: (
        options.policyNotes ??
        (requiresTosReview(candidate.canonicalDomain)
          ? `${TOS_REVIEW_SNIPPET_PREFIX}This domain restricts automated access; resolve the terms question before activating.`
          : "Promoted from Firecrawl discovery. Review terms, allowed paths and extraction quality before activating.")
      ).slice(0, 2_000),
      adapterKey: "generic-list-v1",
      publicDisplay: false,
      createdAt: now,
      updatedAt: now,
    });
    source = await ctx.db.get(sourceId);
    sourceCreated = true;
  }
  if (source === null) {
    return { source: null, sourceCreated, targetCreated, coverageCreated };
  }

  const targets = await ctx.db
    .query("sourceTargets")
    .withIndex("by_source", (q) => q.eq("sourceId", source!._id))
    .take(20);
  if (!targets.some((target) => target.url === candidate.canonicalUrl)) {
    await ctx.db.insert("sourceTargets", {
      sourceId: source._id,
      geoAreaId: candidate.geoAreaId,
      url: candidate.canonicalUrl,
      mode: "scrape",
      changeTrackingTag: `roomscout:${source.slug}:v1`,
      scheduleMinutes: 24 * 60,
      nextRunAt: now,
      // Recurring collection stays off. A monitor is only ever created for
      // an unpaused target, so this is the switch that keeps Firecrawl idle.
      paused: true,
      monitorStatus: "unconfigured",
      sideScope: candidate.side,
      adapterKey: "generic-list-v1",
      backlogCount: 0,
      successfulSnapshotCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    targetCreated = true;
  }

  if (candidate.geoAreaId !== undefined) {
    const side = candidate.side === "demand" ? "demand" : "supply";
    const existingCoverage = await ctx.db
      .query("sourceCoverage")
      .withIndex("by_platform_and_geo_area_and_side", (q) =>
        q
          .eq("platformId", platformId)
          .eq("geoAreaId", candidate.geoAreaId!)
          .eq("side", side),
      )
      .first();
    if (existingCoverage === null) {
      await ctx.db.insert("sourceCoverage", {
        platformId,
        sourceId: source._id,
        geoAreaId: candidate.geoAreaId,
        side,
        mode: "inferred",
        status: "inferred",
        confidence: candidate.confidence,
        lastObservedAt: now,
        evidenceUrl: candidate.canonicalUrl.slice(0, 1_000),
        createdAt: now,
        updatedAt: now,
      });
      coverageCreated = true;
    }
  }
  return { source, sourceCreated, targetCreated, coverageCreated };
}

/**
 * Bulk promotion for the CLI. Creates the platform, the source and one scrape
 * target per candidate, all in review with the target paused. Nothing is
 * fetched here; `sourcePipelineActions.scrapeTargetOnce` is the only fetch.
 */
export const promoteCandidates = internalMutation({
  args: {
    limit: v.optional(v.number()),
    minConfidence: v.optional(v.number()),
    includeTosFlagged: v.optional(v.boolean()),
    domain: v.optional(v.string()),
  },
  returns: v.object({
    considered: v.number(),
    promoted: v.number(),
    skippedTos: v.number(),
    skippedLowConfidence: v.number(),
    sourcesCreated: v.number(),
    targetsCreated: v.number(),
    coverageCreated: v.number(),
    slugs: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(200, Math.floor(args.limit ?? 25)));
    const minConfidence = Math.max(0, Math.min(1, args.minConfidence ?? 0));
    const includeTosFlagged = args.includeTosFlagged ?? false;
    const domainFilter = args.domain?.trim().toLowerCase();
    const candidates = await ctx.db
      .query("sourceCandidates")
      .withIndex("by_status_and_last_seen_at", (q) => q.eq("status", "new"))
      .order("desc")
      .take(Math.min(500, limit * 5));

    const now = Date.now();
    let promoted = 0;
    let skippedTos = 0;
    let skippedLowConfidence = 0;
    let sourcesCreated = 0;
    let targetsCreated = 0;
    let coverageCreated = 0;
    const slugs: string[] = [];

    for (const candidate of candidates) {
      if (promoted >= limit) break;
      if (domainFilter && candidate.canonicalDomain !== domainFilter) continue;
      if (!includeTosFlagged && requiresTosReview(candidate.canonicalDomain)) {
        skippedTos += 1;
        continue;
      }
      if (candidate.confidence < minConfidence) {
        skippedLowConfidence += 1;
        continue;
      }

      const outcome = await promoteCandidateToSource(ctx, candidate, {
        kind: "other",
      });
      if (outcome.source === null) continue;
      if (outcome.sourceCreated) sourcesCreated += 1;
      if (outcome.targetCreated) targetsCreated += 1;
      if (outcome.coverageCreated) coverageCreated += 1;
      slugs.push(outcome.source.slug);
      promoted += 1;
    }

    return {
      considered: candidates.length,
      promoted,
      skippedTos,
      skippedLowConfidence,
      sourcesCreated,
      targetsCreated,
      coverageCreated,
      slugs,
    };
  },
});

/**
 * Approves and activates one source from the CLI. `monitoring` defaults to
 * false: the source becomes ingestible for a one-time scrape while its targets
 * stay paused, so Firecrawl never creates a recurring monitor for it.
 */
export const activateSource = internalMutation({
  args: {
    slug: v.string(),
    monitoring: v.optional(v.boolean()),
    publicDisplay: v.optional(v.boolean()),
    policyNotes: v.optional(v.string()),
  },
  returns: v.object({
    sourceId: v.id("sources"),
    targetsUnpaused: v.number(),
    monitoring: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug.trim()))
      .unique();
    if (source === null) throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    const monitoring = args.monitoring ?? false;
    const now = Date.now();
    await ctx.db.patch(source._id, {
      automationReview: "approved",
      reviewedAt: now,
      status: "active",
      publicDisplay: args.publicDisplay ?? false,
      policyNotes: (
        args.policyNotes ??
        `${source.policyNotes} Activated from the CLI for a one-time scrape${monitoring ? " with recurring monitoring" : "; recurring monitoring stays off"}.`
      ).slice(0, 2_000),
      updatedAt: now,
    });
    const targets = await ctx.db
      .query("sourceTargets")
      .withIndex("by_source", (q) => q.eq("sourceId", source._id))
      .take(20);
    for (const target of targets) {
      await ctx.db.patch(target._id, {
        paused: !monitoring,
        nextRunAt: now,
        updatedAt: now,
      });
    }
    return {
      sourceId: source._id,
      targetsUnpaused: monitoring ? targets.length : 0,
      monitoring,
    };
  },
});

/** Pauses a source again; the counterpart to activateSource. */
export const deactivateSource = internalMutation({
  args: { slug: v.string() },
  returns: v.object({ sourceId: v.id("sources"), targetsPaused: v.number() }),
  handler: async (ctx, args) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug.trim()))
      .unique();
    if (source === null) throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    const now = Date.now();
    await ctx.db.patch(source._id, {
      status: "paused",
      publicDisplay: false,
      updatedAt: now,
    });
    const targets = await ctx.db
      .query("sourceTargets")
      .withIndex("by_source", (q) => q.eq("sourceId", source._id))
      .take(20);
    for (const target of targets) {
      await ctx.db.patch(target._id, { paused: true, updatedAt: now });
    }
    return { sourceId: source._id, targetsPaused: targets.length };
  },
});

/** Targets belonging to active sources, for the one-time scrape runner. */
export const listScrapeTargets = internalQuery({
  args: {
    limit: v.optional(v.number()),
    slug: v.optional(v.string()),
    /** Skip targets collected at or after this time, so a chain advances. */
    notScrapedSince: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      sourceTargetId: v.id("sourceTargets"),
      sourceSlug: v.string(),
      sourceName: v.string(),
      url: v.string(),
      lastRunAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(1_000, Math.floor(args.limit ?? 50)));
    const slug = args.slug?.trim();
    const all = await ctx.db.query("sourceTargets").take(1_000);
    // Least-recently-collected first, never-collected before everything else.
    // Ordering by progress rather than by table position is what guarantees a
    // chained run advances instead of re-picking the head of the table.
    const targets = [...all].sort(
      (left, right) => (left.lastRunAt ?? 0) - (right.lastRunAt ?? 0),
    );
    const rows = [];
    for (const target of targets) {
      if (rows.length >= limit) break;
      if (
        args.notScrapedSince !== undefined &&
        target.lastRunAt !== undefined &&
        target.lastRunAt >= args.notScrapedSince
      ) {
        continue;
      }
      const source = await ctx.db.get(target.sourceId);
      if (source === null || source.status !== "active") continue;
      if (slug !== undefined && source.slug !== slug) continue;
      rows.push({
        sourceTargetId: target._id,
        sourceSlug: source.slug,
        sourceName: source.name,
        url: target.url,
        lastRunAt: target.lastRunAt,
      });
    }
    return rows;
  },
});

/** Queues the detail backlog worker after a one-time scrape found entries. */
export const continueDetailBacklog = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.firecrawlDetails.processDetailBacklog,
      {},
    );
    return null;
  },
});

const STOP_KEY = "discovery";

async function setStopFlag(ctx: MutationCtx): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("pipelineControl")
    .withIndex("by_key", (q) => q.eq("key", STOP_KEY))
    .unique();
  if (row === null) {
    await ctx.db.insert("pipelineControl", {
      key: STOP_KEY,
      stopRequestedAt: now,
      updatedAt: now,
    });
    return;
  }
  await ctx.db.patch(row._id, { stopRequestedAt: now, updatedAt: now });
}

/**
 * True when an operator asked the chained workers to stop. Checked by each
 * worker before it re-arms, so a stop lands even mid-batch.
 */
export const isStopRequested = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("pipelineControl")
      .withIndex("by_key", (q) => q.eq("key", STOP_KEY))
      .unique();
    return row?.stopRequestedAt !== undefined;
  },
});

/** Clears the stop flag so a new run may start. */
export const clearStopRequest = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("pipelineControl")
      .withIndex("by_key", (q) => q.eq("key", STOP_KEY))
      .unique();
    if (row !== null) {
      await ctx.db.patch(row._id, {
        stopRequestedAt: undefined,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

/**
 * Names of the two self-chaining workers in the source pipeline. Each keeps at
 * most one successor queued at a time, so cancelling the pending job ends the
 * chain; nothing re-arms it.
 */
const SWEEP_JOB = "sweepGermany";
const TRIAGE_JOB = "triageCandidates";
const VENUE_JOB = "resolveNamedVenues";
const DETAIL_BACKLOG_JOB = "processDetailBacklog";

/** Every self-chaining worker the CLI can start, so one call stops them all. */
function isChainedDiscoveryJob(name: string): boolean {
  return (
    name.includes(SWEEP_JOB) ||
    name.includes(TRIAGE_JOB) ||
    name.includes(VENUE_JOB) ||
    name.includes("scrapeAllOnce")
  );
}

function isPending(state: { kind: string }): boolean {
  return state.kind === "pending" || state.kind === "inProgress";
}

/** Shows what the pipeline currently has queued, so a chain is never a guess. */
export const scheduledWork = internalQuery({
  args: {},
  returns: v.object({
    sweep: v.array(
      v.object({
        id: v.string(),
        state: v.string(),
        scheduledTime: v.number(),
        cursor: v.optional(v.number()),
        remainingBudget: v.optional(v.number()),
      }),
    ),
    detailBacklog: v.array(
      v.object({
        id: v.string(),
        state: v.string(),
        scheduledTime: v.number(),
      }),
    ),
    recentFailures: v.array(
      v.object({ name: v.string(), message: v.string() }),
    ),
  }),
  handler: async (ctx) => {
    const jobs = await ctx.db.system.query("_scheduled_functions").take(500);
    const sweep = [];
    const detailBacklog = [];
    const recentFailures = [];
    for (const job of jobs) {
      if (
        job.state.kind === "failed" &&
        (isChainedDiscoveryJob(job.name) ||
          job.name.includes(DETAIL_BACKLOG_JOB)) &&
        recentFailures.length < 10
      ) {
        recentFailures.push({
          name: job.name,
          message: String(
            (job.state as { error?: string }).error ?? "unknown",
          ).slice(0, 300),
        });
      }
      if (!isPending(job.state)) continue;
      if (isChainedDiscoveryJob(job.name)) {
        const arg =
          Array.isArray(job.args) && typeof job.args[0] === "object"
            ? (job.args[0] as Record<string, unknown>)
            : undefined;
        sweep.push({
          id: job._id,
          state: job.state.kind,
          scheduledTime: job.scheduledTime,
          cursor:
            typeof arg?.cursor === "number" ? arg.cursor : undefined,
          remainingBudget:
            typeof arg?.maxQueries === "number" ? arg.maxQueries : undefined,
        });
      } else if (job.name.includes(DETAIL_BACKLOG_JOB)) {
        detailBacklog.push({
          id: job._id,
          state: job.state.kind,
          scheduledTime: job.scheduledTime,
        });
      }
    }
    return { sweep, detailBacklog, recentFailures };
  },
});

/**
 * Stops the discovery sweep. Cancelling the one queued successor ends the
 * chain immediately - no further searches are run and no credits are spent.
 * Pass `includeDetailBacklog` to stop the detail scrape worker as well.
 */
export const stopSweep = internalMutation({
  args: { includeDetailBacklog: v.optional(v.boolean()) },
  returns: v.object({
    stopRequested: v.boolean(),
    sweepCancelled: v.number(),
    detailBacklogCancelled: v.number(),
  }),
  handler: async (ctx, args) => {
    // The flag matters more than the cancellation: a worker that is mid-batch
    // has no queued successor to cancel yet, and checks this before re-arming.
    await setStopFlag(ctx);
    const jobs = await ctx.db.system.query("_scheduled_functions").take(500);
    let sweepCancelled = 0;
    let detailBacklogCancelled = 0;
    for (const job of jobs) {
      if (!isPending(job.state)) continue;
      if (isChainedDiscoveryJob(job.name)) {
        await ctx.scheduler.cancel(job._id);
        sweepCancelled += 1;
      } else if (
        (args.includeDetailBacklog ?? false) &&
        job.name.includes(DETAIL_BACKLOG_JOB)
      ) {
        await ctx.scheduler.cancel(job._id);
        detailBacklogCancelled += 1;
      }
    }
    return { stopRequested: true, sweepCancelled, detailBacklogCancelled };
  },
});

/**
 * Groups reviewable candidates by domain for triage.
 *
 * A source is created per domain, so the domain - not the individual search
 * hit - is the unit a reviewer or a model decides on. The representative row
 * is the highest-confidence candidate for that domain.
 */
export const listDomainsForTriage = internalQuery({
  args: { limit: v.optional(v.number()), includeTosFlagged: v.optional(v.boolean()) },
  returns: v.array(
    v.object({
      domain: v.string(),
      name: v.string(),
      snippet: v.string(),
      exampleUrl: v.string(),
      examples: v.array(v.object({ url: v.string(), title: v.string() })),
      urlCount: v.number(),
      confidence: v.number(),
      side: v.union(v.literal("supply"), v.literal("demand"), v.literal("both")),
      tosFlagged: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(1_000, Math.floor(args.limit ?? 1_000)));
    const includeTosFlagged = args.includeTosFlagged ?? false;
    const candidates = await ctx.db
      .query("sourceCandidates")
      .withIndex("by_status_and_last_seen_at", (q) => q.eq("status", "new"))
      .take(COUNT_CAP);
    const byDomain = new Map<string, {
      domain: string;
      name: string;
      snippet: string;
      exampleUrl: string;
      examples: Array<{ url: string; title: string }>;
      urlCount: number;
      confidence: number;
      side: "supply" | "demand" | "both";
      tosFlagged: boolean;
    }>();
    for (const candidate of candidates) {
      const tosFlagged = requiresTosReview(candidate.canonicalDomain);
      if (tosFlagged && !includeTosFlagged) continue;
      const existing = byDomain.get(candidate.canonicalDomain);
      if (existing === undefined) {
        byDomain.set(candidate.canonicalDomain, {
          domain: candidate.canonicalDomain,
          name: candidate.name,
          snippet: candidate.snippet,
          exampleUrl: candidate.canonicalUrl,
          examples: [
            { url: candidate.canonicalUrl, title: candidate.name },
          ],
          urlCount: 1,
          confidence: candidate.confidence,
          side: candidate.side,
          tosFlagged,
        });
        continue;
      }
      existing.urlCount += 1;
      // Several pages of the same domain are stronger evidence than one, and
      // a single editorial hit should not decide a whole platform.
      if (
        existing.examples.length < 3 &&
        !existing.examples.some((row) => row.url === candidate.canonicalUrl)
      ) {
        existing.examples.push({
          url: candidate.canonicalUrl,
          title: candidate.name,
        });
      }
      if (candidate.confidence > existing.confidence) {
        existing.confidence = candidate.confidence;
        existing.name = candidate.name;
        existing.snippet = candidate.snippet;
        existing.exampleUrl = candidate.canonicalUrl;
      }
    }
    return [...byDomain.values()]
      .sort((left, right) => right.urlCount - left.urlCount)
      .slice(0, limit);
  },
});

/**
 * Applies triage verdicts for whole domains.
 *
 * `promote` creates the source and up to `maxTargetsPerDomain` scrape targets,
 * folding the remaining URLs of that domain into the representative candidate.
 * `skip` marks the domain's candidates ignored. `unsure` leaves them in the
 * queue. Activation is opt-in and never touches a terms-flagged domain.
 */
export const applyTriageDecisions = internalMutation({
  args: {
    decisions: v.array(
      v.object({
        domain: v.string(),
        verdict: v.union(
          v.literal("promote"),
          v.literal("skip"),
          v.literal("unsure"),
        ),
        kind: v.union(
          v.literal("classifieds"),
          v.literal("community"),
          v.literal("marketplace"),
          v.literal("directory"),
          v.literal("studio_network"),
          v.literal("other"),
        ),
        reason: v.string(),
      }),
    ),
    activate: v.optional(v.boolean()),
    publicDisplay: v.optional(v.boolean()),
    maxTargetsPerDomain: v.optional(v.number()),
  },
  returns: v.object({
    promoted: v.number(),
    skipped: v.number(),
    unsure: v.number(),
    activated: v.number(),
    sourcesCreated: v.number(),
    targetsCreated: v.number(),
    merged: v.number(),
  }),
  handler: async (ctx, args) => {
    const activate = args.activate ?? false;
    const publicDisplay = args.publicDisplay ?? false;
    const maxTargets = Math.max(
      1,
      Math.min(25, Math.floor(args.maxTargetsPerDomain ?? 3)),
    );
    const now = Date.now();
    let promoted = 0;
    let skipped = 0;
    let unsure = 0;
    let activated = 0;
    let sourcesCreated = 0;
    let targetsCreated = 0;
    let merged = 0;

    for (const decision of args.decisions) {
      const domain = decision.domain.trim().toLowerCase();
      if (decision.verdict === "unsure") {
        unsure += 1;
        continue;
      }
      const rows = await ctx.db
        .query("sourceCandidates")
        .withIndex("by_canonical_domain_and_status", (q) =>
          q.eq("canonicalDomain", domain).eq("status", "new"),
        )
        .take(100);
      if (rows.length === 0) continue;

      if (decision.verdict === "skip") {
        for (const row of rows) {
          await ctx.db.patch(row._id, {
            status: "ignored",
            snippet: `${decision.reason.slice(0, 200)} | ${row.snippet}`.slice(0, 1_500),
            updatedAt: now,
          });
        }
        skipped += 1;
        continue;
      }

      // A terms-flagged domain is never activated by a model decision.
      const tosFlagged = requiresTosReview(domain);
      const ranked = [...rows].sort(
        (left, right) => right.confidence - left.confidence,
      );
      const chosen = ranked.slice(0, maxTargets);
      const rest = ranked.slice(maxTargets);
      let sourceSlug: string | null = null;
      for (const candidate of chosen) {
        const outcome = await promoteCandidateToSource(ctx, candidate, {
          kind: decision.kind,
          policyNotes: `AI triage: ${decision.reason.slice(0, 900)}`,
        });
        if (outcome.source === null) continue;
        sourceSlug = outcome.source.slug;
        if (outcome.sourceCreated) sourcesCreated += 1;
        if (outcome.targetCreated) targetsCreated += 1;
      }
      for (const candidate of rest) {
        await ctx.db.patch(candidate._id, {
          status: "merged",
          mergedIntoCandidateId: chosen[0]?._id,
          updatedAt: now,
        });
        merged += 1;
      }
      promoted += 1;

      if (activate && !tosFlagged && sourceSlug !== null) {
        const source = await ctx.db
          .query("sources")
          .withIndex("by_slug", (q) => q.eq("slug", sourceSlug!))
          .unique();
        if (source !== null && source.status !== "active") {
          await ctx.db.patch(source._id, {
            automationReview: "approved",
            reviewedAt: now,
            status: "active",
            publicDisplay,
            updatedAt: now,
          });
          activated += 1;
        }
      }
    }
    return {
      promoted,
      skipped,
      unsure,
      activated,
      sourcesCreated,
      targetsCreated,
      merged,
    };
  },
});




/** Records that a target was collected, so a chained run does not repeat it. */
export const markTargetScraped = internalMutation({
  args: { sourceTargetId: v.id("sourceTargets"), succeeded: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (target === null) return null;
    const now = Date.now();
    await ctx.db.patch(target._id, {
      lastRunAt: now,
      successfulSnapshotCount:
        (target.successfulSnapshotCount ?? 0) + (args.succeeded ? 1 : 0),
      updatedAt: now,
    });
    return null;
  },
});

/**
 * Suppresses extracted listings that are placeholders rather than rooms.
 *
 * A scraped page that is not a listing index still yields a row, carrying the
 * site's name or an explicit "unknown". Suppressing keeps the row and its
 * provenance while removing it from the public index and the coverage map.
 */
export const suppressPlaceholderSignals = internalMutation({
  args: { limit: v.optional(v.number()), dryRun: v.optional(v.boolean()) },
  returns: v.object({
    examined: v.number(),
    suppressed: v.number(),
    kept: v.number(),
    byReason: v.object({
      placeholder_city: v.number(),
      placeholder_title: v.number(),
      empty_title: v.number(),
    }),
    samples: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(COUNT_CAP, Math.floor(args.limit ?? COUNT_CAP)));
    const dryRun = args.dryRun ?? false;
    const signals = await ctx.db.query("signals").take(limit);
    const byReason = {
      placeholder_city: 0,
      placeholder_title: 0,
      empty_title: 0,
    };
    const samples: string[] = [];
    let suppressed = 0;
    let kept = 0;

    for (const signal of signals) {
      // The controlled demo portal is authored, not extracted; leave it alone.
      if (signal.isDemo === true) continue;
      if (signal.status !== "published" && signal.status !== "stale") continue;
      const verdict = assessListingQuality({
        title: signal.title,
        city: signal.city,
      });
      if (verdict.usable) {
        kept += 1;
        continue;
      }
      if (verdict.reason !== undefined) byReason[verdict.reason] += 1;
      if (samples.length < 10) {
        samples.push(
          `${verdict.reason}: "${signal.title.slice(0, 48)}" (${signal.city.slice(0, 24)})`,
        );
      }
      suppressed += 1;
      if (!dryRun) {
        await ctx.db.patch(signal._id, { status: "suppressed" });
      }
    }
    return {
      examined: signals.length,
      suppressed,
      kept,
      byReason,
      samples,
    };
  },
});

/**
 * The public coverage picture: real, placeable listings grouped by city.
 * Demo signals are excluded by construction so they can never reach the
 * public research snapshot.
 */
export const publicCoverageSnapshot = internalQuery({
  args: {},
  returns: v.object({
    realListingCount: v.number(),
    cities: v.array(
      v.object({
        city: v.string(),
        latitude: v.number(),
        longitude: v.number(),
        realListingCount: v.number(),
      }),
    ),
    indexedSources: v.array(
      v.object({ name: v.string(), listingCount: v.number() }),
    ),
    missingCoordinates: v.number(),
  }),
  handler: async (ctx) => {
    const signals = await ctx.db.query("signals").take(COUNT_CAP);
    const cities = new Map<string, {
      city: string;
      latitude: number;
      longitude: number;
      realListingCount: number;
    }>();
    const sources = new Map<string, number>();
    let realListingCount = 0;
    let missingCoordinates = 0;

    for (const signal of signals) {
      if (signal.isDemo === true) continue;
      if (signal.status !== "published" && signal.status !== "stale") continue;
      if (!assessListingQuality({ title: signal.title, city: signal.city }).usable) {
        continue;
      }
      realListingCount += 1;

      // A signal's provenance lives in its evidence rows, not on the signal.
      const evidence = await ctx.db
        .query("signalEvidence")
        .withIndex("by_signal", (q) => q.eq("signalId", signal._id))
        .take(4);
      const names = new Set<string>();
      for (const item of evidence) {
        const source = await ctx.db.get(item.sourceId);
        if (source === null || !("platformId" in source)) continue;
        // The domain is the honest, readable attribution; a source's name is
        // whatever title the discovering search hit happened to carry.
        const platform = source.platformId
          ? await ctx.db.get(source.platformId)
          : null;
        names.add(
          platform !== null && "canonicalDomain" in platform
            ? platform.canonicalDomain
            : source.name,
        );
      }
      for (const name of names) {
        sources.set(name, (sources.get(name) ?? 0) + 1);
      }

      if (
        signal.latitude === undefined ||
        signal.longitude === undefined ||
        !isPlaceableCity(signal.city) ||
        !isWithinGermany(signal.latitude, signal.longitude)
      ) {
        missingCoordinates += 1;
        continue;
      }
      const key = signal.city.trim().toLowerCase();
      const existing = cities.get(key);
      if (existing === undefined) {
        cities.set(key, {
          city: signal.city.trim(),
          latitude: signal.latitude,
          longitude: signal.longitude,
          realListingCount: 1,
        });
        continue;
      }
      existing.realListingCount += 1;
    }

    return {
      realListingCount,
      cities: [...cities.values()].sort(
        (left, right) => right.realListingCount - left.realListingCount,
      ),
      indexedSources: [...sources.entries()]
        .map(([name, listingCount]) => ({ name, listingCount }))
        .sort((left, right) => right.listingCount - left.listingCount),
      missingCoordinates,
    };
  },
});
