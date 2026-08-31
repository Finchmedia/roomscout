import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";

const flow = v.union(
  v.literal("discovery"),
  v.literal("listing"),
  v.literal("contact"),
  v.literal("reply"),
  v.literal("auth"),
);
const status = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("error"),
  v.literal("retired"),
);
const executor = v.union(
  v.literal("firecrawl"),
  v.literal("browserbase"),
  v.literal("agentmail"),
  v.literal("direct_api"),
  v.literal("manual"),
);
const config = v.union(
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
  v.object({ kind: v.literal("manual"), instructionKey: v.string() }),
);
const bindingItem = v.object({
  id: v.id("sourceAdapterBindings"),
  platformId: v.id("sourcePlatforms"),
  sourceId: v.optional(v.id("sources")),
  sourceTargetId: v.optional(v.id("sourceTargets")),
  scopeKey: v.string(),
  flow,
  adapterKey: v.string(),
  adapterVersion: v.number(),
  status,
  executor,
  config,
  configFingerprint: v.string(),
  policyVersionId: v.optional(v.id("sourceFlowPolicies")),
  updatedAt: v.number(),
});

function projectBinding(binding: {
  _id: import("./_generated/dataModel").Id<"sourceAdapterBindings">;
  platformId: import("./_generated/dataModel").Id<"sourcePlatforms">;
  sourceId?: import("./_generated/dataModel").Id<"sources">;
  sourceTargetId?: import("./_generated/dataModel").Id<"sourceTargets">;
  scopeKey: string;
  flow: "discovery" | "listing" | "contact" | "reply" | "auth";
  adapterKey: string;
  adapterVersion: number;
  status: "active" | "paused" | "error" | "retired";
  executor: "firecrawl" | "browserbase" | "agentmail" | "direct_api" | "manual";
  config:
    | { kind: "firecrawl"; extractionProfileKey: string; monitorDriven: boolean }
    | { kind: "browserbase"; workflowKey: string; contextRequired: boolean }
    | { kind: "agentmail"; purpose: "outreach" | "reply" }
    | { kind: "direct_api"; integrationKey: string }
    | { kind: "manual"; instructionKey: string };
  configFingerprint: string;
  policyVersionId?: import("./_generated/dataModel").Id<"sourceFlowPolicies">;
  updatedAt: number;
}) {
  return {
    id: binding._id,
    platformId: binding.platformId,
    sourceId: binding.sourceId,
    sourceTargetId: binding.sourceTargetId,
    scopeKey: binding.scopeKey,
    flow: binding.flow,
    adapterKey: binding.adapterKey,
    adapterVersion: binding.adapterVersion,
    status: binding.status,
    executor: binding.executor,
    config: binding.config,
    configFingerprint: binding.configFingerprint,
    policyVersionId: binding.policyVersionId,
    updatedAt: binding.updatedAt,
  };
}

export const listForPlatform = query({
  args: {
    platformId: v.id("sourcePlatforms"),
    flow,
    status,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(bindingItem),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const result = await ctx.db
      .query("sourceAdapterBindings")
      .withIndex("by_platform_and_flow_and_status", (q) =>
        q
          .eq("platformId", args.platformId)
          .eq("flow", args.flow)
          .eq("status", args.status),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return { ...result, page: result.page.map(projectBinding) };
  },
});

export const upsertBinding = mutation({
  args: {
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    flow,
    adapterKey: v.string(),
    executor,
    config,
    configFingerprint: v.string(),
    policyVersionId: v.optional(v.id("sourceFlowPolicies")),
  },
  returns: v.id("sourceAdapterBindings"),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const platform = await ctx.db.get(args.platformId);
    if (platform === null) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    }
    const source =
      args.sourceId === undefined ? null : await ctx.db.get(args.sourceId);
    if (args.sourceId !== undefined && source === null) {
      throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    }
    const target =
      args.sourceTargetId === undefined
        ? null
        : await ctx.db.get(args.sourceTargetId);
    if (args.sourceTargetId !== undefined && target === null) {
      throw new ConvexError({ code: "SOURCE_TARGET_NOT_FOUND" });
    }
    if (target !== null && source !== null && target.sourceId !== source._id) {
      throw new ConvexError({ code: "SOURCE_TARGET_SCOPE_MISMATCH" });
    }
    if (source !== null && source.platformId !== undefined && source.platformId !== platform._id) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_SCOPE_MISMATCH" });
    }
    if (args.executor !== args.config.kind) {
      throw new ConvexError({ code: "ADAPTER_EXECUTOR_CONFIG_MISMATCH" });
    }
    if (args.policyVersionId !== undefined) {
      const policy = await ctx.db.get(args.policyVersionId);
      if (
        policy === null ||
        policy.platformId !== platform._id ||
        policy.flow !== args.flow ||
        policy.status !== "approved"
      ) {
        throw new ConvexError({ code: "INVALID_ADAPTER_POLICY" });
      }
    }

    const scopeKey =
      target !== null
        ? `target:${target._id}`
        : source !== null
          ? `source:${source._id}`
          : `platform:${platform._id}`;
    const existing = await ctx.db
      .query("sourceAdapterBindings")
      .withIndex("by_scope_key_and_flow_and_status", (q) =>
        q.eq("scopeKey", scopeKey).eq("flow", args.flow).eq("status", "active"),
      )
      .order("desc")
      .first();
    const now = Date.now();
    if (existing !== null && existing.configFingerprint === args.configFingerprint) {
      await ctx.db.patch(existing._id, {
        policyVersionId: args.policyVersionId,
        updatedAt: now,
      });
      return existing._id;
    }
    if (existing !== null) {
      await ctx.db.patch(existing._id, { status: "retired", updatedAt: now });
    }
    const bindingId = await ctx.db.insert("sourceAdapterBindings", {
      platformId: platform._id,
      sourceId: source?._id,
      sourceTargetId: target?._id,
      scopeKey,
      flow: args.flow,
      adapterKey: args.adapterKey.trim().slice(0, 120),
      adapterVersion: (existing?.adapterVersion ?? 0) + 1,
      status: "active",
      executor: args.executor,
      config: args.config,
      configFingerprint: args.configFingerprint.trim().slice(0, 200),
      policyVersionId: args.policyVersionId,
      createdAt: now,
      updatedAt: now,
    });
    if (target !== null) {
      await ctx.db.patch(target._id, { adapterBindingId: bindingId, updatedAt: now });
    }
    return bindingId;
  },
});

export const resolveForFlow = internalQuery({
  args: {
    platformId: v.id("sourcePlatforms"),
    sourceId: v.optional(v.id("sources")),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    flow,
  },
  returns: v.union(v.null(), bindingItem),
  handler: async (ctx, args) => {
    const scopeKeys = [
      args.sourceTargetId === undefined ? null : `target:${args.sourceTargetId}`,
      args.sourceId === undefined ? null : `source:${args.sourceId}`,
      `platform:${args.platformId}`,
    ];
    for (const scopeKey of scopeKeys) {
      if (scopeKey === null) continue;
      const binding = await ctx.db
        .query("sourceAdapterBindings")
        .withIndex("by_scope_key_and_flow_and_status", (q) =>
          q.eq("scopeKey", scopeKey).eq("flow", args.flow).eq("status", "active"),
        )
        .order("desc")
        .first();
      if (binding !== null && binding.platformId === args.platformId) {
        return projectBinding(binding);
      }
    }
    return null;
  },
});

export const getCheckpoint = internalQuery({
  args: {
    bindingId: v.id("sourceAdapterBindings"),
    scopeKey: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      checkpointId: v.id("adapterCheckpoints"),
      cursor: v.optional(v.string()),
      checkpointHash: v.optional(v.string()),
      lastSuccessAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const checkpoint = await ctx.db
      .query("adapterCheckpoints")
      .withIndex("by_binding_and_scope_key", (q) =>
        q.eq("bindingId", args.bindingId).eq("scopeKey", args.scopeKey),
      )
      .unique();
    return checkpoint === null
      ? null
      : {
          checkpointId: checkpoint._id,
          cursor: checkpoint.cursor,
          checkpointHash: checkpoint.checkpointHash,
          lastSuccessAt: checkpoint.lastSuccessAt,
          lastError: checkpoint.lastError,
        };
  },
});

export const saveCheckpoint = internalMutation({
  args: {
    bindingId: v.id("sourceAdapterBindings"),
    scopeKey: v.string(),
    cursor: v.optional(v.string()),
    checkpointHash: v.optional(v.string()),
    succeeded: v.boolean(),
    error: v.optional(v.string()),
  },
  returns: v.id("adapterCheckpoints"),
  handler: async (ctx, args) => {
    if ((await ctx.db.get(args.bindingId)) === null) {
      throw new ConvexError({ code: "ADAPTER_BINDING_NOT_FOUND" });
    }
    const scopeKey = args.scopeKey.trim().slice(0, 300);
    const existing = await ctx.db
      .query("adapterCheckpoints")
      .withIndex("by_binding_and_scope_key", (q) =>
        q.eq("bindingId", args.bindingId).eq("scopeKey", scopeKey),
      )
      .unique();
    const now = Date.now();
    const patch = {
      cursor: args.cursor?.slice(0, 2_000),
      checkpointHash: args.checkpointHash?.slice(0, 200),
      lastSuccessAt: args.succeeded ? now : existing?.lastSuccessAt,
      lastError: args.succeeded ? undefined : args.error?.slice(0, 1_000),
      updatedAt: now,
    };
    if (existing !== null) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("adapterCheckpoints", {
      bindingId: args.bindingId,
      scopeKey,
      ...patch,
      createdAt: now,
    });
  },
});
