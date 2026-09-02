import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import {
  CONTROLLED_SOURCE_PROOF_CONFIRMATION,
  CONTROLLED_SOURCE_SLUG,
  CONTROLLED_SOURCE_URL,
} from "./integrations/controlledSourceProofConfig";

const confirmation = v.literal(CONTROLLED_SOURCE_PROOF_CONFIRMATION);

async function assertNoOtherActiveSources(ctx: MutationCtx) {
  const activeSources = await ctx.db
    .query("sources")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .take(100);
  const unexpected = activeSources.find(
    (source) => source.slug !== CONTROLLED_SOURCE_SLUG,
  );
  if (unexpected) {
    throw new ConvexError({
      code: "OTHER_ACTIVE_SOURCE_PRESENT",
      sourceSlug: unexpected.slug,
    });
  }
}

/**
 * Exact, internal-only bootstrap for the first production ingestion proof.
 * It can activate only the first-party roomscout.dev public listing source.
 */
export const prepare = internalMutation({
  args: { confirmation },
  returns: v.object({
    sourceId: v.id("sources"),
    sourceTargetId: v.id("sourceTargets"),
    providerMonitorId: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    await assertNoOtherActiveSources(ctx);
    const now = Date.now();

    let platform = await ctx.db
      .query("sourcePlatforms")
      .withIndex("by_canonical_domain", (q) =>
        q.eq("canonicalDomain", "roomscout.dev"),
      )
      .unique();
    if (platform && platform.slug !== "roomscout-dev") {
      throw new ConvexError({ code: "CONTROLLED_PLATFORM_CONFLICT" });
    }
    if (!platform) {
      const platformId = await ctx.db.insert("sourcePlatforms", {
        slug: "roomscout-dev",
        name: "roomscout.dev controlled demo portal",
        canonicalDomain: "roomscout.dev",
        kind: "community",
        status: "active",
        firstSeenAt: now,
        lastObservedAt: now,
        createdAt: now,
        updatedAt: now,
      });
      platform = await ctx.db.get(platformId);
    }
    if (!platform) {
      throw new ConvexError({ code: "CONTROLLED_PLATFORM_CREATE_FAILED" });
    }

    let source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", CONTROLLED_SOURCE_SLUG))
      .unique();
    if (
      source &&
      (source.platformId !== platform._id ||
        source.baseUrl !== CONTROLLED_SOURCE_URL ||
        source.accessMode !== "public" ||
        source.adapterKey !== "generic-list-v1")
    ) {
      throw new ConvexError({ code: "CONTROLLED_SOURCE_CONFLICT" });
    }
    if (!source) {
      const sourceId = await ctx.db.insert("sources", {
        platformId: platform._id,
        slug: CONTROLLED_SOURCE_SLUG,
        name: "roomscout.dev · demo public listings",
        baseUrl: CONTROLLED_SOURCE_URL,
        side: "both",
        status: "active",
        health: "unknown",
        geographicScope: "Controlled hackathon demo",
        accessMode: "public",
        automationReview: "approved",
        policyNotes:
          "First-party controlled source. This proof may read public listings only and cannot communicate with anyone.",
        reviewedAt: now,
        adapterKey: "generic-list-v1",
        publicDisplay: true,
        createdAt: now,
        updatedAt: now,
      });
      source = await ctx.db.get(sourceId);
    } else {
      await ctx.db.patch(source._id, {
        status: "active",
        automationReview: "approved",
        publicDisplay: true,
        reviewedAt: source.reviewedAt ?? now,
        updatedAt: now,
      });
      source = await ctx.db.get(source._id);
    }
    if (!source) {
      throw new ConvexError({ code: "CONTROLLED_SOURCE_CREATE_FAILED" });
    }

    const targets = await ctx.db
      .query("sourceTargets")
      .withIndex("by_source", (q) => q.eq("sourceId", source!._id))
      .take(20);
    const unexpectedTarget = targets.find(
      (target) => target.url !== CONTROLLED_SOURCE_URL,
    );
    if (unexpectedTarget) {
      throw new ConvexError({ code: "CONTROLLED_TARGET_CONFLICT" });
    }

    let target = targets.find(
      (candidate) => candidate.url === CONTROLLED_SOURCE_URL,
    );
    if (!target) {
      const targetId = await ctx.db.insert("sourceTargets", {
        sourceId: source._id,
        url: CONTROLLED_SOURCE_URL,
        mode: "scrape",
        changeTrackingTag: "roomscout-dev-public:v1",
        scheduleMinutes: 24 * 60,
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
      const createdTarget = await ctx.db.get(targetId);
      if (!createdTarget) {
        throw new ConvexError({ code: "CONTROLLED_TARGET_CREATE_FAILED" });
      }
      target = createdTarget;
    } else {
      await ctx.db.patch(target._id, {
        paused: false,
        nextRunAt: now,
        updatedAt: now,
      });
    }

    return {
      sourceId: source._id,
      sourceTargetId: target._id,
      providerMonitorId: target.providerMonitorId,
    };
  },
});

export const getRunContext = internalQuery({
  args: { sourceTargetId: v.id("sourceTargets") },
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
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (
      !target ||
      target.url !== CONTROLLED_SOURCE_URL ||
      target.paused
    ) {
      return null;
    }
    const source = await ctx.db.get(target.sourceId);
    if (
      !source ||
      source.slug !== CONTROLLED_SOURCE_SLUG ||
      source.status !== "active" ||
      source.automationReview !== "approved" ||
      source.accessMode !== "public"
    ) {
      return null;
    }
    const monitor = await ctx.db
      .query("sourceMonitors")
      .withIndex("by_source_target", (q) =>
        q.eq("sourceTargetId", target._id),
      )
      .unique();
    return {
      sourceTargetId: target._id,
      sourceName: source.name,
      url: target.url,
      scheduleMinutes: target.scheduleMinutes,
      providerMonitorId:
        monitor?.providerMonitorId ?? target.providerMonitorId,
      storedFingerprint: monitor?.configFingerprint,
    };
  },
});

export const pause = internalMutation({
  args: { confirmation },
  returns: v.object({
    sourceTargetId: v.id("sourceTargets"),
    providerMonitorId: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", CONTROLLED_SOURCE_SLUG))
      .unique();
    if (!source || source.baseUrl !== CONTROLLED_SOURCE_URL) {
      throw new ConvexError({ code: "CONTROLLED_SOURCE_NOT_FOUND" });
    }
    const targets = await ctx.db
      .query("sourceTargets")
      .withIndex("by_source", (q) => q.eq("sourceId", source._id))
      .take(20);
    const target = targets.find(
      (candidate) => candidate.url === CONTROLLED_SOURCE_URL,
    );
    if (!target) {
      throw new ConvexError({ code: "CONTROLLED_TARGET_NOT_FOUND" });
    }
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(source._id, {
        status: "paused",
        publicDisplay: false,
        updatedAt: now,
      }),
      ctx.db.patch(target._id, { paused: true, updatedAt: now }),
    ]);
    const monitor = await ctx.db
      .query("sourceMonitors")
      .withIndex("by_source_target", (q) =>
        q.eq("sourceTargetId", target._id),
      )
      .unique();
    return {
      sourceTargetId: target._id,
      providerMonitorId:
        monitor?.providerMonitorId ?? target.providerMonitorId,
    };
  },
});
