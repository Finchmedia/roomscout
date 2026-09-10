import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { ensureControlledDemoRecords } from "./demoSourceBootstrap";
import {
  CONTROLLED_SOURCE_PROOF_CONFIRMATION,
  CONTROLLED_SOURCE_SLUG,
  CONTROLLED_SOURCE_URL,
} from "./integrations/controlledSourceProofConfig";

const confirmation = v.literal(CONTROLLED_SOURCE_PROOF_CONFIRMATION);

/**
 * Exact, internal-only bootstrap for the global first-party ingestion source.
 * Unrelated reviewed sources can remain active independently.
 */
export const prepare = internalMutation({
  args: { confirmation },
  returns: v.object({
    sourceId: v.id("sources"),
    sourceTargetId: v.id("sourceTargets"),
    providerMonitorId: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const records = await ensureControlledDemoRecords(ctx);
    const target = await ctx.db.get(records.publicTargetId);
    if (!target)
      throw new ConvexError({ code: "CONTROLLED_TARGET_CREATE_FAILED" });
    return {
      sourceId: records.publicSourceId,
      sourceTargetId: records.publicTargetId,
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
    if (!target || target.url !== CONTROLLED_SOURCE_URL || target.paused) {
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
      .withIndex("by_source_target", (q) => q.eq("sourceTargetId", target._id))
      .unique();
    return {
      sourceTargetId: target._id,
      providerMonitorId: monitor?.providerMonitorId ?? target.providerMonitorId,
    };
  },
});
