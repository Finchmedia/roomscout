import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";

const flow = v.union(
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
const decision = v.union(
  v.literal("allowed"),
  v.literal("review_required"),
  v.literal("prohibited"),
  v.literal("unknown"),
);
const evidenceDecision = v.union(
  v.literal("allowed"),
  v.literal("disallowed"),
  v.literal("unknown"),
);
const policyStatus = v.union(
  v.literal("draft"),
  v.literal("approved"),
  v.literal("superseded"),
  v.literal("restricted"),
);
const policyItem = v.object({
  id: v.id("sourceFlowPolicies"),
  platformId: v.id("sourcePlatforms"),
  sourceId: v.optional(v.id("sources")),
  geoAreaId: v.optional(v.id("geoAreas")),
  scopeKey: v.string(),
  flow,
  version: v.number(),
  status: policyStatus,
  decision,
  maxAutomationLevel: automationLevel,
  userConnectionRequired: v.boolean(),
  humanPresenceRequired: v.boolean(),
  accountCreationAllowed: v.boolean(),
  externalApprovalRequired: v.boolean(),
  robotsDecision: evidenceDecision,
  termsDecision: evidenceDecision,
  retentionDays: v.optional(v.number()),
  evidenceUrls: v.array(v.string()),
  reviewedBy: v.optional(v.id("users")),
  approvedAt: v.optional(v.number()),
  nextReviewAt: v.optional(v.number()),
  updatedAt: v.number(),
});

function projectPolicy(policy: import("./_generated/dataModel").Doc<"sourceFlowPolicies">) {
  return {
    id: policy._id,
    platformId: policy.platformId,
    sourceId: policy.sourceId,
    geoAreaId: policy.geoAreaId,
    scopeKey: policy.scopeKey,
    flow: policy.flow,
    version: policy.version,
    status: policy.status,
    decision: policy.decision,
    maxAutomationLevel: policy.maxAutomationLevel,
    userConnectionRequired: policy.userConnectionRequired,
    humanPresenceRequired: policy.humanPresenceRequired,
    accountCreationAllowed: policy.accountCreationAllowed,
    externalApprovalRequired: policy.externalApprovalRequired,
    robotsDecision: policy.robotsDecision,
    termsDecision: policy.termsDecision,
    retentionDays: policy.retentionDays,
    evidenceUrls: policy.evidenceUrls,
    reviewedBy: policy.reviewedBy,
    approvedAt: policy.approvedAt,
    nextReviewAt: policy.nextReviewAt,
    updatedAt: policy.updatedAt,
  };
}

export const listForPlatform = query({
  args: {
    platformId: v.id("sourcePlatforms"),
    status: policyStatus,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(policyItem),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const result = await ctx.db
      .query("sourceFlowPolicies")
      .withIndex("by_platform_and_status_and_next_review_at", (q) =>
        q.eq("platformId", args.platformId).eq("status", args.status),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(projectPolicy) };
  },
});

export const createDraft = mutation({
  args: {
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    geoAreaId: v.optional(v.id("geoAreas")),
    flow,
    decision,
    maxAutomationLevel: automationLevel,
    userConnectionRequired: v.boolean(),
    humanPresenceRequired: v.boolean(),
    accountCreationAllowed: v.boolean(),
    externalApprovalRequired: v.boolean(),
    robotsDecision: evidenceDecision,
    termsDecision: evidenceDecision,
    retentionDays: v.optional(v.number()),
    evidenceUrls: v.array(v.string()),
    nextReviewAt: v.optional(v.number()),
  },
  returns: v.id("sourceFlowPolicies"),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const platform = await ctx.db.get(args.platformId);
    if (platform === null) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    }
    if (args.sourceId !== undefined && args.geoAreaId !== undefined) {
      throw new ConvexError({ code: "POLICY_SCOPE_MUST_BE_SINGULAR" });
    }
    const source =
      args.sourceId === undefined ? null : await ctx.db.get(args.sourceId);
    if (args.sourceId !== undefined && source === null) {
      throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    }
    if (source !== null && source.platformId !== undefined && source.platformId !== platform._id) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_SCOPE_MISMATCH" });
    }
    if (args.geoAreaId !== undefined && (await ctx.db.get(args.geoAreaId)) === null) {
      throw new ConvexError({ code: "GEO_AREA_NOT_FOUND" });
    }
    if (args.accountCreationAllowed && args.flow !== "auth") {
      throw new ConvexError({ code: "ACCOUNT_CREATION_ONLY_ALLOWED_FOR_AUTH_FLOW" });
    }
    if (args.retentionDays !== undefined && args.retentionDays < 0) {
      throw new ConvexError({ code: "INVALID_RETENTION_DAYS" });
    }
    if (args.evidenceUrls.length > 20) {
      throw new ConvexError({ code: "TOO_MANY_POLICY_EVIDENCE_URLS" });
    }
    const evidenceUrls = args.evidenceUrls.map((value) => {
      try {
        const url = new URL(value.trim());
        if (url.protocol !== "https:") throw new Error("not https");
        url.hash = "";
        return url.toString().slice(0, 1_000);
      } catch {
        throw new ConvexError({ code: "INVALID_POLICY_EVIDENCE_URL" });
      }
    });
    const scopeKey =
      source !== null
        ? `source:${source._id}`
        : args.geoAreaId !== undefined
          ? `geo:${args.geoAreaId}`
          : `platform:${platform._id}`;
    const previous = await ctx.db
      .query("sourceFlowPolicies")
      .withIndex("by_scope_key_and_flow_and_version", (q) =>
        q.eq("scopeKey", scopeKey).eq("flow", args.flow),
      )
      .order("desc")
      .first();
    const now = Date.now();
    return await ctx.db.insert("sourceFlowPolicies", {
      platformId: platform._id,
      sourceId: source?._id,
      geoAreaId: args.geoAreaId,
      scopeKey,
      flow: args.flow,
      version: (previous?.version ?? 0) + 1,
      status: "draft",
      decision: args.decision,
      maxAutomationLevel: args.maxAutomationLevel,
      userConnectionRequired: args.userConnectionRequired,
      humanPresenceRequired: args.humanPresenceRequired,
      accountCreationAllowed: args.accountCreationAllowed,
      externalApprovalRequired:
        args.externalApprovalRequired || args.flow === "contact" || args.flow === "reply",
      robotsDecision: args.robotsDecision,
      termsDecision: args.termsDecision,
      retentionDays: args.retentionDays,
      evidenceUrls,
      nextReviewAt: args.nextReviewAt,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const approve = mutation({
  args: { policyId: v.id("sourceFlowPolicies") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const policy = await ctx.db.get(args.policyId);
    if (policy === null) throw new ConvexError({ code: "POLICY_NOT_FOUND" });
    if (policy.status !== "draft") {
      throw new ConvexError({ code: "POLICY_NOT_DRAFT" });
    }
    if (
      policy.decision === "allowed" &&
      (policy.robotsDecision !== "allowed" || policy.termsDecision !== "allowed")
    ) {
      throw new ConvexError({ code: "POLICY_EVIDENCE_NOT_ALLOWED" });
    }
    if (
      (policy.flow === "contact" || policy.flow === "reply") &&
      !policy.externalApprovalRequired
    ) {
      throw new ConvexError({ code: "EXTERNAL_APPROVAL_REQUIRED" });
    }
    const existing = await ctx.db
      .query("sourceFlowPolicies")
      .withIndex("by_scope_key_and_flow_and_status", (q) =>
        q
          .eq("scopeKey", policy.scopeKey)
          .eq("flow", policy.flow)
          .eq("status", "approved"),
      )
      .order("desc")
      .first();
    const now = Date.now();
    if (existing !== null) {
      await ctx.db.patch(existing._id, { status: "superseded", updatedAt: now });
    }
    await ctx.db.patch(policy._id, {
      status: policy.decision === "prohibited" ? "restricted" : "approved",
      reviewedBy: operatorId,
      approvedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const resolveEffective = internalQuery({
  args: {
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    geoAreaId: v.optional(v.id("geoAreas")),
    flow,
    at: v.number(),
  },
  returns: v.union(v.null(), policyItem),
  handler: async (ctx, args) => {
    const scopeKeys = [
      args.sourceId === undefined ? null : `source:${args.sourceId}`,
      args.geoAreaId === undefined ? null : `geo:${args.geoAreaId}`,
      `platform:${args.platformId}`,
    ];
    for (const scopeKey of scopeKeys) {
      if (scopeKey === null) continue;
      const policy = await ctx.db
        .query("sourceFlowPolicies")
        .withIndex("by_scope_key_and_flow_and_status", (q) =>
          q.eq("scopeKey", scopeKey).eq("flow", args.flow).eq("status", "approved"),
        )
        .order("desc")
        .first();
      if (
        policy !== null &&
        policy.platformId === args.platformId &&
        (policy.nextReviewAt === undefined || policy.nextReviewAt >= args.at)
      ) {
        return projectPolicy(policy);
      }
    }
    return null;
  },
});
