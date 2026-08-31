import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";

const flow = v.union(
  v.literal("discovery"),
  v.literal("listing"),
  v.literal("contact"),
  v.literal("reply"),
  v.literal("auth"),
);
const trigger = v.union(
  v.literal("operator"),
  v.literal("scheduler"),
  v.literal("connection"),
);
const runStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("succeeded"),
  v.literal("partial"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("cancelled"),
);
const stepKind = v.union(
  v.literal("navigate"),
  v.literal("authenticate"),
  v.literal("discover"),
  v.literal("list"),
  v.literal("inspect_contact"),
  v.literal("read_replies"),
  v.literal("assert"),
);
const stepStatus = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("passed"),
  v.literal("failed"),
  v.literal("blocked"),
  v.literal("skipped"),
);
const adapterConfig = v.union(
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
  v.object({ kind: v.literal("direct_api"), integrationKey: v.string() }),
  v.object({ kind: v.literal("manual"), instructionKey: v.string() }),
);
const runItem = v.object({
  id: v.id("sourceFlowProbeRuns"),
  probeId: v.id("sourceFlowProbes"),
  bindingId: v.id("sourceAdapterBindings"),
  connectionId: v.optional(v.id("portalConnections")),
  browserContextId: v.optional(v.id("browserContexts")),
  trigger,
  status: runStatus,
  resultCode: v.optional(v.string()),
  itemsObserved: v.optional(v.number()),
  error: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});
const stepItem = v.object({
  id: v.id("sourceFlowProbeSteps"),
  ordinal: v.number(),
  kind: stepKind,
  status: stepStatus,
  summary: v.optional(v.string()),
  evidenceHash: v.optional(v.string()),
  startedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  createdAt: v.number(),
});

const AUTOMATION_RANK = {
  disabled: 0,
  public_read: 1,
  connected_read: 2,
  prepare_only: 3,
  approved_execute: 4,
} as const;

const safeProbeSafetyLevel = v.union(
  v.literal("read_only"),
  v.literal("prepare_only"),
);

const factValue = v.union(
  v.object({ kind: v.literal("text"), value: v.string() }),
  v.object({ kind: v.literal("number"), value: v.number() }),
  v.object({ kind: v.literal("boolean"), value: v.boolean() }),
);

const normalizedFact = v.object({
  category: v.union(
    v.literal("access"),
    v.literal("contact"),
    v.literal("auth"),
    v.literal("flow"),
  ),
  key: v.string(),
  value: factValue,
  confidence: v.number(),
});

function requiredAutomationRank(
  safetyLevel: "read_only" | "prepare_only",
  connected: boolean,
): number {
  if (safetyLevel === "prepare_only") return AUTOMATION_RANK.prepare_only;
  return connected
    ? AUTOMATION_RANK.connected_read
    : AUTOMATION_RANK.public_read;
}

async function queueProbeRun(
  ctx: MutationCtx,
  args: {
    probeId: Id<"sourceFlowProbes">;
    connectionId?: Id<"portalConnections">;
    browserContextId?: Id<"browserContexts">;
    trigger: "operator" | "scheduler" | "connection";
    idempotencyKey: string;
  },
): Promise<{ runId: Id<"sourceFlowProbeRuns">; duplicate: boolean }> {
  const idempotencyKey = args.idempotencyKey.trim().slice(0, 240);
  if (!idempotencyKey) {
    throw new ConvexError({ code: "PROBE_IDEMPOTENCY_KEY_REQUIRED" });
  }
  const existing = await ctx.db
    .query("sourceFlowProbeRuns")
    .withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", idempotencyKey),
    )
    .unique();
  if (existing !== null) return { runId: existing._id, duplicate: true };
  const probe = await ctx.db.get(args.probeId);
  if (
    probe === null ||
    probe.status !== "approved" ||
    (probe.safetyLevel !== "read_only" &&
      probe.safetyLevel !== "prepare_only")
  ) {
    throw new ConvexError({ code: "SAFE_PROBE_NOT_APPROVED" });
  }
  const binding = await ctx.db.get(probe.bindingId);
  const policy = await ctx.db.get(probe.policyVersionId);
  if (
    binding === null ||
    binding.status !== "active" ||
    binding.platformId !== probe.platformId ||
    binding.flow !== probe.flow ||
    binding.policyVersionId !== policy?._id
  ) {
    throw new ConvexError({ code: "PROBE_BINDING_NOT_ACTIVE" });
  }
  const connected =
    args.connectionId !== undefined ||
    policy?.userConnectionRequired === true ||
    (binding.config.kind === "browserbase" && binding.config.contextRequired);
  if (
    policy === null ||
    policy.status !== "approved" ||
    policy.decision !== "allowed" ||
    policy.robotsDecision !== "allowed" ||
    policy.termsDecision !== "allowed" ||
    (policy.nextReviewAt !== undefined && policy.nextReviewAt < Date.now()) ||
    AUTOMATION_RANK[policy.maxAutomationLevel] <
      requiredAutomationRank(probe.safetyLevel, connected)
  ) {
    throw new ConvexError({ code: "PROBE_POLICY_NOT_READABLE" });
  }
  if (connected && args.connectionId === undefined) {
    throw new ConvexError({ code: "PROBE_CONNECTION_REQUIRED" });
  }
  if (
    binding.config.kind === "browserbase" &&
    binding.config.contextRequired &&
    args.browserContextId === undefined
  ) {
    throw new ConvexError({ code: "BROWSER_CONTEXT_REQUIRED" });
  }
  if (args.connectionId !== undefined) {
    const connection = await ctx.db.get(args.connectionId);
    if (
      connection === null ||
      connection.policyDecision !== "allowed" ||
      !connection.allowReadOnlyRecon ||
      connection.status === "disabled" ||
      (connection.platformId !== undefined &&
        connection.platformId !== probe.platformId)
    ) {
      throw new ConvexError({ code: "CONNECTION_RECON_NOT_ALLOWED" });
    }
  }
  if (args.browserContextId !== undefined) {
    const context = await ctx.db.get(args.browserContextId);
    if (
      context === null ||
      context.connectionId !== args.connectionId ||
      context.status !== "ready"
    ) {
      throw new ConvexError({ code: "BROWSER_CONTEXT_NOT_READY" });
    }
  }
  const now = Date.now();
  const runId = await ctx.db.insert("sourceFlowProbeRuns", {
    probeId: probe._id,
    bindingId: probe.bindingId,
    connectionId: args.connectionId,
    browserContextId: args.browserContextId,
    trigger: args.trigger,
    idempotencyKey,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.sourceProbeWorker.run, { runId });
  return { runId, duplicate: false };
}

export const createReadOnlyProbe = mutation({
  args: {
    platformId: v.id("sourcePlatforms"),
    bindingId: v.id("sourceAdapterBindings"),
    geoAreaId: v.optional(v.id("geoAreas")),
    flow,
    name: v.string(),
    policyVersionId: v.id("sourceFlowPolicies"),
    maxItems: v.number(),
    timeoutMs: v.number(),
  },
  returns: v.id("sourceFlowProbes"),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const [platform, binding, policy] = await Promise.all([
      ctx.db.get(args.platformId),
      ctx.db.get(args.bindingId),
      ctx.db.get(args.policyVersionId),
    ]);
    if (platform === null) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    }
    if (
      binding === null ||
      binding.platformId !== platform._id ||
      binding.flow !== args.flow ||
      binding.policyVersionId !== policy?._id
    ) {
      throw new ConvexError({ code: "INVALID_PROBE_BINDING" });
    }
    if (
      policy === null ||
      policy.platformId !== platform._id ||
      policy.flow !== args.flow ||
      policy.status !== "approved"
    ) {
      throw new ConvexError({ code: "INVALID_PROBE_POLICY" });
    }
    if (
      args.geoAreaId !== undefined &&
      (await ctx.db.get(args.geoAreaId)) === null
    ) {
      throw new ConvexError({ code: "GEO_AREA_NOT_FOUND" });
    }
    if (!Number.isInteger(args.maxItems) || args.maxItems < 1 || args.maxItems > 50) {
      throw new ConvexError({ code: "INVALID_PROBE_ITEM_LIMIT" });
    }
    if (args.timeoutMs < 1_000 || args.timeoutMs > 120_000) {
      throw new ConvexError({ code: "INVALID_PROBE_TIMEOUT" });
    }
    const now = Date.now();
    return await ctx.db.insert("sourceFlowProbes", {
      platformId: platform._id,
      bindingId: binding._id,
      geoAreaId: args.geoAreaId,
      flow: args.flow,
      name: args.name.trim().slice(0, 180),
      status: "draft",
      safetyLevel: "read_only",
      policyVersionId: policy._id,
      maxItems: args.maxItems,
      timeoutMs: args.timeoutMs,
      createdBy: operatorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * A prepare-only probe may inspect a reviewed contact/auth surface, but the
 * worker still never fills fields, enters credentials, clicks, or submits.
 */
export const createPrepareOnlyProbe = mutation({
  args: {
    platformId: v.id("sourcePlatforms"),
    bindingId: v.id("sourceAdapterBindings"),
    geoAreaId: v.optional(v.id("geoAreas")),
    flow: v.union(v.literal("contact"), v.literal("auth")),
    name: v.string(),
    policyVersionId: v.id("sourceFlowPolicies"),
    maxItems: v.number(),
    timeoutMs: v.number(),
  },
  returns: v.id("sourceFlowProbes"),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const [platform, binding, policy, geoArea] = await Promise.all([
      ctx.db.get(args.platformId),
      ctx.db.get(args.bindingId),
      ctx.db.get(args.policyVersionId),
      args.geoAreaId === undefined ? Promise.resolve(null) : ctx.db.get(args.geoAreaId),
    ]);
    if (platform === null) {
      throw new ConvexError({ code: "SOURCE_PLATFORM_NOT_FOUND" });
    }
    if (
      binding === null ||
      binding.platformId !== platform._id ||
      binding.flow !== args.flow ||
      binding.policyVersionId !== policy?._id
    ) {
      throw new ConvexError({ code: "INVALID_PROBE_BINDING" });
    }
    if (
      policy === null ||
      policy.platformId !== platform._id ||
      policy.flow !== args.flow ||
      policy.status !== "approved" ||
      policy.decision !== "allowed" ||
      AUTOMATION_RANK[policy.maxAutomationLevel] < AUTOMATION_RANK.prepare_only
    ) {
      throw new ConvexError({ code: "INVALID_PROBE_POLICY" });
    }
    if (args.geoAreaId !== undefined && geoArea === null) {
      throw new ConvexError({ code: "GEO_AREA_NOT_FOUND" });
    }
    if (!Number.isInteger(args.maxItems) || args.maxItems < 1 || args.maxItems > 20) {
      throw new ConvexError({ code: "INVALID_PROBE_ITEM_LIMIT" });
    }
    if (args.timeoutMs < 1_000 || args.timeoutMs > 120_000) {
      throw new ConvexError({ code: "INVALID_PROBE_TIMEOUT" });
    }
    const now = Date.now();
    return await ctx.db.insert("sourceFlowProbes", {
      platformId: platform._id,
      bindingId: binding._id,
      geoAreaId: args.geoAreaId,
      flow: args.flow,
      name: args.name.trim().slice(0, 180),
      status: "draft",
      safetyLevel: "prepare_only",
      policyVersionId: policy._id,
      maxItems: args.maxItems,
      timeoutMs: args.timeoutMs,
      createdBy: operatorId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const approveReadOnlyProbe = mutation({
  args: { probeId: v.id("sourceFlowProbes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const probe = await ctx.db.get(args.probeId);
    if (probe === null) throw new ConvexError({ code: "PROBE_NOT_FOUND" });
    if (probe.status !== "draft" || probe.safetyLevel !== "read_only") {
      throw new ConvexError({ code: "PROBE_NOT_APPROVABLE" });
    }
    const [binding, policy] = await Promise.all([
      ctx.db.get(probe.bindingId),
      ctx.db.get(probe.policyVersionId),
    ]);
    if (
      binding === null ||
      binding.status !== "active" ||
      binding.policyVersionId !== probe.policyVersionId
    ) {
      throw new ConvexError({ code: "PROBE_BINDING_NOT_ACTIVE" });
    }
    if (
      policy === null ||
      policy.status !== "approved" ||
      policy.decision !== "allowed" ||
      policy.robotsDecision !== "allowed" ||
      policy.termsDecision !== "allowed" ||
      AUTOMATION_RANK[policy.maxAutomationLevel] < AUTOMATION_RANK.public_read
    ) {
      throw new ConvexError({ code: "PROBE_POLICY_NOT_READABLE" });
    }
    await ctx.db.patch(probe._id, {
      status: "approved",
      approvedBy: operatorId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const approvePrepareOnlyProbe = mutation({
  args: { probeId: v.id("sourceFlowProbes") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatorId = await requireOperatorId(ctx);
    const probe = await ctx.db.get(args.probeId);
    if (
      probe === null ||
      probe.status !== "draft" ||
      probe.safetyLevel !== "prepare_only" ||
      (probe.flow !== "contact" && probe.flow !== "auth")
    ) {
      throw new ConvexError({ code: "PROBE_NOT_APPROVABLE" });
    }
    const [binding, policy] = await Promise.all([
      ctx.db.get(probe.bindingId),
      ctx.db.get(probe.policyVersionId),
    ]);
    if (
      binding === null ||
      binding.status !== "active" ||
      binding.policyVersionId !== probe.policyVersionId
    ) {
      throw new ConvexError({ code: "PROBE_BINDING_NOT_ACTIVE" });
    }
    if (
      policy === null ||
      policy.status !== "approved" ||
      policy.decision !== "allowed" ||
      policy.robotsDecision !== "allowed" ||
      policy.termsDecision !== "allowed" ||
      AUTOMATION_RANK[policy.maxAutomationLevel] < AUTOMATION_RANK.prepare_only
    ) {
      throw new ConvexError({ code: "PROBE_POLICY_NOT_PREPARABLE" });
    }
    await ctx.db.patch(probe._id, {
      status: "approved",
      approvedBy: operatorId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const requestReadOnlyRun = mutation({
  args: {
    probeId: v.id("sourceFlowProbes"),
    connectionId: v.optional(v.id("portalConnections")),
    browserContextId: v.optional(v.id("browserContexts")),
    trigger,
    idempotencyKey: v.string(),
  },
  returns: v.object({
    runId: v.id("sourceFlowProbeRuns"),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    return await queueProbeRun(ctx, args);
  },
});

export const runNow = mutation({
  args: {
    probeId: v.id("sourceFlowProbes"),
    connectionId: v.optional(v.id("portalConnections")),
    browserContextId: v.optional(v.id("browserContexts")),
  },
  returns: v.object({
    runId: v.id("sourceFlowProbeRuns"),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const minuteBucket = Math.floor(Date.now() / 60_000);
    return await queueProbeRun(ctx, {
      ...args,
      trigger: "operator",
      idempotencyKey: `probe-run-now:${args.probeId}:${minuteBucket}`,
    });
  },
});

export const retryRun = mutation({
  args: { runId: v.id("sourceFlowProbeRuns") },
  returns: v.object({
    runId: v.id("sourceFlowProbeRuns"),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const previous = await ctx.db.get(args.runId);
    if (
      previous === null ||
      !["failed", "partial", "blocked", "cancelled"].includes(previous.status)
    ) {
      throw new ConvexError({ code: "PROBE_RUN_NOT_RETRYABLE" });
    }
    return await queueProbeRun(ctx, {
      probeId: previous.probeId,
      connectionId: previous.connectionId,
      browserContextId: previous.browserContextId,
      trigger: "operator",
      idempotencyKey: `probe-retry:${previous._id}:${previous.updatedAt}`,
    });
  },
});

export const claimReadOnlyRun = internalMutation({
  args: { runId: v.id("sourceFlowProbeRuns") },
  returns: v.union(
    v.null(),
    v.object({
      runId: v.id("sourceFlowProbeRuns"),
      probeId: v.id("sourceFlowProbes"),
      platformId: v.id("sourcePlatforms"),
      bindingId: v.id("sourceAdapterBindings"),
      flow,
      safetyLevel: safeProbeSafetyLevel,
      executor: v.union(v.literal("firecrawl"), v.literal("browserbase")),
      config: adapterConfig,
      adapterKey: v.string(),
      adapterVersion: v.number(),
      canonicalDomain: v.string(),
      targetUrl: v.string(),
      allowedDomains: v.array(v.string()),
      allowedPaths: v.array(v.string()),
      sourceId: v.optional(v.id("sources")),
      sourceTargetId: v.optional(v.id("sourceTargets")),
      geoAreaId: v.optional(v.id("geoAreas")),
      sourceSide: v.optional(
        v.union(
          v.literal("supply"),
          v.literal("demand"),
          v.literal("both"),
        ),
      ),
      connectionId: v.optional(v.id("portalConnections")),
      browserContextId: v.optional(v.id("browserContexts")),
      providerContextId: v.optional(v.string()),
      maxItems: v.number(),
      timeoutMs: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null || run.status !== "queued") return null;
    const [probe, binding] = await Promise.all([
      ctx.db.get(run.probeId),
      ctx.db.get(run.bindingId),
    ]);
    const policy =
      probe === null ? null : await ctx.db.get(probe.policyVersionId);
    const now = Date.now();
    const platform =
      probe === null ? null : await ctx.db.get(probe.platformId);
    const source =
      binding?.sourceId === undefined
        ? null
        : await ctx.db.get(binding.sourceId);
    const target =
      binding?.sourceTargetId === undefined
        ? null
        : await ctx.db.get(binding.sourceTargetId);
    const connection =
      run.connectionId === undefined
        ? null
        : await ctx.db.get(run.connectionId);
    const browserContext =
      run.browserContextId === undefined
        ? null
        : await ctx.db.get(run.browserContextId);
    const connected =
      connection !== null ||
      policy?.userConnectionRequired === true ||
      (binding?.config.kind === "browserbase" &&
        binding.config.contextRequired);
    const invalidReason =
      probe === null ||
      probe.status !== "approved" ||
      (probe.safetyLevel !== "read_only" &&
        probe.safetyLevel !== "prepare_only")
        ? "probe_not_approved"
        : binding === null ||
            binding.status !== "active" ||
            binding.platformId !== probe.platformId ||
            binding.flow !== probe.flow ||
            binding.policyVersionId !== probe.policyVersionId
          ? "binding_not_active"
          : binding.executor !== "firecrawl" && binding.executor !== "browserbase"
            ? "probe_executor_not_supported"
            : platform === null || platform.status === "restricted"
              ? "platform_not_probeable"
              : binding.sourceId !== undefined && source === null
                ? "probe_source_missing"
                : binding.sourceTargetId !== undefined &&
                    (target === null ||
                      (source !== null && target.sourceId !== source._id))
                  ? "probe_target_missing"
                  : policy === null ||
                      policy.status !== "approved" ||
                      policy.decision !== "allowed" ||
                      policy.robotsDecision !== "allowed" ||
                      policy.termsDecision !== "allowed" ||
                      (policy.nextReviewAt !== undefined &&
                        policy.nextReviewAt < now) ||
                      AUTOMATION_RANK[policy.maxAutomationLevel] <
                        requiredAutomationRank(probe.safetyLevel, connected)
                    ? "policy_not_readable"
                    : connected && connection === null
                      ? "probe_connection_required"
                      : connection !== null &&
                          (connection.policyDecision !== "allowed" ||
                            !connection.allowReadOnlyRecon ||
                            connection.status === "disabled" ||
                            (connection.platformId !== undefined &&
                              connection.platformId !== probe.platformId) ||
                            (binding.sourceId !== undefined &&
                              connection.sourceId !== binding.sourceId))
                        ? "connection_recon_not_allowed"
                        : run.browserContextId !== undefined &&
                            (browserContext === null ||
                              browserContext.connectionId !== run.connectionId ||
                              browserContext.status !== "ready")
                          ? "browser_context_not_ready"
                          : binding.config.kind === "browserbase" &&
                              binding.config.contextRequired &&
                              browserContext === null
                            ? "browser_context_required"
                            : null;
    if (invalidReason !== null || probe === null || binding === null) {
      await ctx.db.patch(run._id, {
        status: "blocked",
        resultCode: invalidReason ?? "invalid_probe_run",
        completedAt: now,
        updatedAt: now,
      });
      return null;
    }
    if (
      platform === null ||
      (probe.safetyLevel !== "read_only" &&
        probe.safetyLevel !== "prepare_only") ||
      (binding.executor !== "firecrawl" && binding.executor !== "browserbase")
    ) {
      return null;
    }
    const canonicalRoot = `https://${platform.canonicalDomain}/`;
    const connectionSource =
      connection === null ? null : await ctx.db.get(connection.sourceId);
    let targetUrl = target?.url ?? source?.baseUrl ?? canonicalRoot;
    if (connection !== null && connectionSource !== null) {
      const baseUrl = connectionSource.baseUrl;
      const requestedPath =
        probe.flow === "reply" && connection.inboxPath
          ? connection.inboxPath
          : connection.allowedPaths[0] ?? "/";
      targetUrl = new URL(requestedPath, baseUrl).toString();
    }
    let targetPath: string;
    try {
      targetPath = new URL(targetUrl).pathname || "/";
    } catch {
      await ctx.db.patch(run._id, {
        status: "blocked",
        resultCode: "invalid_probe_target_url",
        completedAt: now,
        updatedAt: now,
      });
      return null;
    }
    const allowedDomains =
      connection?.allowedDomains ?? [platform.canonicalDomain];
    const allowedPaths = connection?.allowedPaths ?? [targetPath];
    await ctx.db.insert("sourceFlowProbeSteps", {
      runId: run._id,
      ordinal: 0,
      kind: "assert",
      status: "passed",
      summary:
        "Safe probe, code-owned binding, allowlist, and current policy validated.",
      startedAt: now,
      completedAt: now,
      createdAt: now,
    });
    await ctx.db.patch(run._id, {
      status: "running",
      startedAt: now,
      updatedAt: now,
    });
    return {
      runId: run._id,
      probeId: probe._id,
      platformId: probe.platformId,
      bindingId: binding._id,
      flow: probe.flow,
      safetyLevel: probe.safetyLevel,
      executor: binding.executor,
      config: binding.config,
      adapterKey: binding.adapterKey,
      adapterVersion: binding.adapterVersion,
      canonicalDomain: platform.canonicalDomain,
      targetUrl,
      allowedDomains,
      allowedPaths,
      sourceId: source?._id,
      sourceTargetId: target?._id,
      geoAreaId: probe.geoAreaId,
      sourceSide: source?.side,
      connectionId: run.connectionId,
      browserContextId: run.browserContextId,
      providerContextId: browserContext?.providerContextId,
      maxItems: probe.maxItems,
      timeoutMs: probe.timeoutMs,
    };
  },
});

export const appendStep = internalMutation({
  args: {
    runId: v.id("sourceFlowProbeRuns"),
    ordinal: v.number(),
    kind: stepKind,
    status: stepStatus,
    summary: v.optional(v.string()),
    evidenceHash: v.optional(v.string()),
  },
  returns: v.id("sourceFlowProbeSteps"),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null || run.status !== "running") {
      throw new ConvexError({ code: "PROBE_RUN_NOT_RUNNING" });
    }
    if (!Number.isInteger(args.ordinal) || args.ordinal < 1 || args.ordinal > 100) {
      throw new ConvexError({ code: "INVALID_PROBE_STEP_ORDINAL" });
    }
    const duplicate = await ctx.db
      .query("sourceFlowProbeSteps")
      .withIndex("by_run_and_ordinal", (q) =>
        q.eq("runId", run._id).eq("ordinal", args.ordinal),
      )
      .unique();
    if (duplicate !== null) return duplicate._id;
    const now = Date.now();
    return await ctx.db.insert("sourceFlowProbeSteps", {
      runId: run._id,
      ordinal: args.ordinal,
      kind: args.kind,
      status: args.status,
      summary: args.summary?.trim().slice(0, 1_000),
      evidenceHash: args.evidenceHash?.trim().slice(0, 200),
      startedAt: now,
      completedAt:
        args.status === "running" || args.status === "queued" ? undefined : now,
      createdAt: now,
    });
  },
});

export const completeRun = internalMutation({
  args: {
    runId: v.id("sourceFlowProbeRuns"),
    status: v.union(
      v.literal("succeeded"),
      v.literal("partial"),
      v.literal("failed"),
      v.literal("blocked"),
      v.literal("cancelled"),
    ),
    resultCode: v.optional(v.string()),
    itemsObserved: v.number(),
    outputHash: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null) throw new ConvexError({ code: "PROBE_RUN_NOT_FOUND" });
    if (run.status !== "running" && run.status !== "queued") return null;
    if (!Number.isInteger(args.itemsObserved) || args.itemsObserved < 0) {
      throw new ConvexError({ code: "INVALID_OBSERVED_ITEM_COUNT" });
    }
    const now = Date.now();
    await ctx.db.patch(run._id, {
      status: args.status,
      resultCode: args.resultCode?.slice(0, 120),
      itemsObserved: args.itemsObserved,
      outputHash: args.outputHash?.slice(0, 200),
      error: args.error?.slice(0, 1_000),
      completedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

export const recordSucceededRun = internalMutation({
  args: {
    runId: v.id("sourceFlowProbeRuns"),
    summary: v.string(),
    evidenceHash: v.string(),
    resultCode: v.string(),
    itemsObserved: v.number(),
    facts: v.array(normalizedFact),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null) throw new ConvexError({ code: "PROBE_RUN_NOT_FOUND" });
    if (run.status === "succeeded") return null;
    if (run.status !== "running") {
      throw new ConvexError({ code: "PROBE_RUN_NOT_RUNNING" });
    }
    if (
      !Number.isInteger(args.itemsObserved) ||
      args.itemsObserved < 0 ||
      args.itemsObserved > 10_000
    ) {
      throw new ConvexError({ code: "INVALID_OBSERVED_ITEM_COUNT" });
    }
    if (!/^[a-f0-9]{64}$/i.test(args.evidenceHash)) {
      throw new ConvexError({ code: "INVALID_PROBE_EVIDENCE_HASH" });
    }
    if (args.facts.length > 20) {
      throw new ConvexError({ code: "TOO_MANY_PROBE_FACTS" });
    }
    const [probe, binding] = await Promise.all([
      ctx.db.get(run.probeId),
      ctx.db.get(run.bindingId),
    ]);
    if (probe === null || binding === null) {
      throw new ConvexError({ code: "PROBE_CONFIGURATION_MISSING" });
    }
    const [platform, policy, source, target] = await Promise.all([
      ctx.db.get(probe.platformId),
      ctx.db.get(probe.policyVersionId),
      binding.sourceId === undefined
        ? Promise.resolve(null)
        : ctx.db.get(binding.sourceId),
      binding.sourceTargetId === undefined
        ? Promise.resolve(null)
        : ctx.db.get(binding.sourceTargetId),
    ]);
    if (platform === null || policy === null) {
      throw new ConvexError({ code: "PROBE_CONFIGURATION_MISSING" });
    }
    const now = Date.now();
    const stepKindForFlow = {
      discovery: "discover",
      listing: "list",
      contact: "inspect_contact",
      reply: "read_replies",
      auth: "authenticate",
    } as const;
    const existingStep = await ctx.db
      .query("sourceFlowProbeSteps")
      .withIndex("by_run_and_ordinal", (q) =>
        q.eq("runId", run._id).eq("ordinal", 1),
      )
      .unique();
    if (existingStep === null) {
      await ctx.db.insert("sourceFlowProbeSteps", {
        runId: run._id,
        ordinal: 1,
        kind: "navigate",
        status: "passed",
        summary: "Reached the reviewed allowlisted target without a write.",
        evidenceHash: args.evidenceHash.toLowerCase(),
        startedAt: run.startedAt ?? now,
        completedAt: now,
        createdAt: now,
      });
    }
    const observationStep = await ctx.db
      .query("sourceFlowProbeSteps")
      .withIndex("by_run_and_ordinal", (q) =>
        q.eq("runId", run._id).eq("ordinal", 2),
      )
      .unique();
    if (observationStep === null) {
      await ctx.db.insert("sourceFlowProbeSteps", {
        runId: run._id,
        ordinal: 2,
        kind: stepKindForFlow[probe.flow],
        status: "passed",
        summary: args.summary.trim().slice(0, 1_000),
        evidenceHash: args.evidenceHash.toLowerCase(),
        startedAt: run.startedAt ?? now,
        completedAt: now,
        createdAt: now,
      });
    }

    for (const fact of args.facts) {
      if (
        !fact.key.startsWith(`probe.${probe.flow}.`) ||
        fact.key.length > 180 ||
        fact.confidence < 0 ||
        fact.confidence > 1
      ) {
        throw new ConvexError({ code: "INVALID_PROBE_FACT" });
      }
      const active = await ctx.db
        .query("sourceIntelligenceFacts")
        .withIndex("by_platform_and_key_and_status", (q) =>
          q
            .eq("platformId", platform._id)
            .eq("key", fact.key)
            .eq("status", "active"),
        )
        .order("desc")
        .first();
      if (active !== null) {
        await ctx.db.patch(active._id, {
          status: "superseded",
          updatedAt: now,
        });
      }
      await ctx.db.insert("sourceIntelligenceFacts", {
        platformId: platform._id,
        geoAreaId: probe.geoAreaId,
        category: fact.category,
        key: fact.key,
        value:
          fact.value.kind === "text"
            ? { kind: "text", value: fact.value.value.trim().slice(0, 500) }
            : fact.value,
        confidence: fact.confidence,
        probeRunId: run._id,
        status: "active",
        supersedesFactId: active?._id,
        observedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    const policyKey = `probe.${probe.flow}.effective_policy_version`;
    const previousPolicyFact = await ctx.db
      .query("sourceIntelligenceFacts")
      .withIndex("by_platform_and_key_and_status", (q) =>
        q
          .eq("platformId", platform._id)
          .eq("key", policyKey)
          .eq("status", "active"),
      )
      .order("desc")
      .first();
    if (previousPolicyFact !== null) {
      await ctx.db.patch(previousPolicyFact._id, {
        status: "superseded",
        updatedAt: now,
      });
    }
    await ctx.db.insert("sourceIntelligenceFacts", {
      platformId: platform._id,
      geoAreaId: probe.geoAreaId,
      category: "policy",
      key: policyKey,
      value: { kind: "number", value: policy.version },
      confidence: 1,
      probeRunId: run._id,
      status: "active",
      supersedesFactId: previousPolicyFact?._id,
      observedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    if (probe.geoAreaId !== undefined && source !== null) {
      const sides = source.side === "both" ? ["supply", "demand"] as const : [source.side];
      for (const side of sides) {
        const coverageCandidates = await ctx.db
          .query("sourceCoverage")
          .withIndex("by_platform_and_geo_area_and_side", (q) =>
            q
              .eq("platformId", platform._id)
              .eq("geoAreaId", probe.geoAreaId!)
              .eq("side", side),
          )
          .take(20);
        const coverage = coverageCandidates.find(
          (candidate) =>
            candidate.sourceId === source._id &&
            candidate.sourceTargetId === target?._id,
        );
        if (coverage !== undefined) {
          await ctx.db.patch(coverage._id, {
            status: "probed",
            confidence: Math.max(coverage.confidence, 0.7),
            lastObservedAt: now,
            lastProbeRunId: run._id,
            updatedAt: now,
          });
        } else {
          await ctx.db.insert("sourceCoverage", {
            platformId: platform._id,
            sourceId: source._id,
            sourceTargetId: target?._id,
            geoAreaId: probe.geoAreaId,
            side,
            mode: target === null ? "inferred" : "explicit_page",
            status: "probed",
            confidence: 0.7,
            lastObservedAt: now,
            lastProbeRunId: run._id,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }
    await Promise.all([
      ctx.db.patch(platform._id, { lastObservedAt: now, updatedAt: now }),
      source === null
        ? Promise.resolve()
        : ctx.db.patch(source._id, {
            health: "healthy",
            lastCheckedAt: now,
            updatedAt: now,
          }),
      ctx.db.patch(run._id, {
        status: "succeeded",
        resultCode: args.resultCode.trim().slice(0, 120),
        itemsObserved: args.itemsObserved,
        outputHash: args.evidenceHash.toLowerCase(),
        error: undefined,
        completedAt: now,
        updatedAt: now,
      }),
    ]);
    return null;
  },
});

export const listRuns = query({
  args: {
    status: runStatus,
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(runItem),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const result = await ctx.db
      .query("sourceFlowProbeRuns")
      .withIndex("by_status_and_created_at", (q) => q.eq("status", args.status))
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: result.page.map((run) => ({
        id: run._id,
        probeId: run.probeId,
        bindingId: run.bindingId,
        connectionId: run.connectionId,
        browserContextId: run.browserContextId,
        trigger: run.trigger,
        status: run.status,
        resultCode: run.resultCode,
        itemsObserved: run.itemsObserved,
        error: run.error,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      })),
    };
  },
});

export const getRun = query({
  args: { runId: v.id("sourceFlowProbeRuns") },
  returns: v.union(
    v.null(),
    v.object({ run: runItem, steps: v.array(stepItem) }),
  ),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const run = await ctx.db.get(args.runId);
    if (run === null) return null;
    const steps = await ctx.db
      .query("sourceFlowProbeSteps")
      .withIndex("by_run_and_ordinal", (q) => q.eq("runId", run._id))
      .take(100);
    return {
      run: {
        id: run._id,
        probeId: run.probeId,
        bindingId: run.bindingId,
        connectionId: run.connectionId,
        browserContextId: run.browserContextId,
        trigger: run.trigger,
        status: run.status,
        resultCode: run.resultCode,
        itemsObserved: run.itemsObserved,
        error: run.error,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
      },
      steps: steps.map((step) => ({
        id: step._id,
        ordinal: step.ordinal,
        kind: step.kind,
        status: step.status,
        summary: step.summary,
        evidenceHash: step.evidenceHash,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        createdAt: step.createdAt,
      })),
    };
  },
});
