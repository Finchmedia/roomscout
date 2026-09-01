import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { requireOperatorId, requireUserId } from "./integrations/authz";
import {
  PORTAL_CIRCUIT_COOLDOWN_MS,
  PORTAL_CIRCUIT_FAILURES,
  PORTAL_RUN_TTLS_MS,
  normalizeHostname,
} from "./integrations/portalSafety";

const connectionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("needs_auth"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("reauth_required"),
  v.literal("disabled"),
);

const policyDecisionValidator = v.union(
  v.literal("pending"),
  v.literal("allowed"),
  v.literal("restricted"),
  v.literal("prohibited"),
);

const runKindValidator = v.union(
  v.literal("recon"),
  v.literal("authenticate"),
  v.literal("inbox_sync"),
);

const runStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("human_required"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("stopped"),
  v.literal("expired"),
);

const onboardingStageValidator = v.union(
  v.literal("opening_signup"),
  v.literal("waiting_verification"),
  v.literal("submitting_verification"),
  v.literal("human_required"),
  v.literal("completed"),
  v.literal("failed"),
);

const publicConnectionValidator = v.object({
  _id: v.id("portalConnections"),
  sourceId: v.id("sources"),
  label: v.string(),
  sourceName: v.string(),
  baseUrl: v.string(),
  platformName: v.optional(v.string()),
  status: connectionStatusValidator,
  policyDecision: policyDecisionValidator,
  allowReadOnlyRecon: v.boolean(),
  allowInboxPolling: v.boolean(),
  pollIntervalMinutes: v.number(),
  nextPollAt: v.optional(v.number()),
  lastSuccessAt: v.optional(v.number()),
  lastErrorCode: v.optional(v.string()),
  circuitOpenUntil: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const publicRunValidator = v.object({
  _id: v.id("browserRuns"),
  connectionId: v.id("portalConnections"),
  kind: runKindValidator,
  status: runStatusValidator,
  startedAt: v.optional(v.number()),
  expiresAt: v.number(),
  endedAt: v.optional(v.number()),
  resultCount: v.optional(v.number()),
  errorCode: v.optional(v.string()),
  onboardingStage: v.optional(onboardingStageValidator),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function cleanLabel(value: string): string {
  const result = value.replace(/\s+/g, " ").trim().slice(0, 100);
  if (!result) throw new ConvexError({ code: "INVALID_LABEL" });
  return result;
}

function toPublicConnection(connection: {
  _id: Id<"portalConnections">;
  sourceId: Id<"sources">;
  label: string;
  status: "draft" | "needs_auth" | "active" | "paused" | "reauth_required" | "disabled";
  policyDecision: "pending" | "allowed" | "restricted" | "prohibited";
  allowReadOnlyRecon: boolean;
  allowInboxPolling: boolean;
  pollIntervalMinutes: number;
  nextPollAt?: number;
  lastSuccessAt?: number;
  lastErrorCode?: string;
  circuitOpenUntil?: number;
  createdAt: number;
  updatedAt: number;
}, metadata: { sourceName: string; baseUrl: string; platformName?: string }) {
  return {
    _id: connection._id,
    sourceId: connection.sourceId,
    label: connection.label,
    ...metadata,
    status: connection.status,
    policyDecision: connection.policyDecision,
    allowReadOnlyRecon: connection.allowReadOnlyRecon,
    allowInboxPolling: connection.allowInboxPolling,
    pollIntervalMinutes: connection.pollIntervalMinutes,
    nextPollAt: connection.nextPollAt,
    lastSuccessAt: connection.lastSuccessAt,
    lastErrorCode: connection.lastErrorCode,
    circuitOpenUntil: connection.circuitOpenUntil,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

function toPublicRun(run: {
  _id: Id<"browserRuns">;
  connectionId: Id<"portalConnections">;
  kind: "recon" | "authenticate" | "inbox_sync";
  status: "queued" | "running" | "human_required" | "completed" | "failed" | "stopped" | "expired";
  startedAt?: number;
  expiresAt: number;
  endedAt?: number;
  resultCount?: number;
  errorCode?: string;
  onboardingStage?: "opening_signup" | "waiting_verification" | "submitting_verification" | "human_required" | "completed" | "failed";
  createdAt: number;
  updatedAt: number;
}) {
  return {
    _id: run._id,
    connectionId: run.connectionId,
    kind: run.kind,
    status: run.status,
    startedAt: run.startedAt,
    expiresAt: run.expiresAt,
    endedAt: run.endedAt,
    resultCount: run.resultCount,
    errorCode: run.errorCode,
    onboardingStage: run.onboardingStage,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}

export const listMine = query({
  args: {},
  returns: v.array(publicConnectionValidator),
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    const rows = await ctx.db
      .query("portalConnections")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .take(50);
    return await Promise.all(rows.map(async (row) => {
      const source = await ctx.db.get(row.sourceId);
      const platform = row.platformId ? await ctx.db.get(row.platformId) : source?.platformId ? await ctx.db.get(source.platformId) : null;
      return toPublicConnection(row, {
        sourceName: source?.name ?? row.label,
        baseUrl: source?.baseUrl ?? "",
        platformName: platform?.name,
      });
    }));
  },
});

export const getMine = query({
  args: { connectionId: v.id("portalConnections") },
  returns: v.union(publicConnectionValidator, v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== ownerId) return null;
    const source = await ctx.db.get(connection.sourceId);
    const platform = connection.platformId ? await ctx.db.get(connection.platformId) : source?.platformId ? await ctx.db.get(source.platformId) : null;
    return toPublicConnection(connection, {
      sourceName: source?.name ?? connection.label,
      baseUrl: source?.baseUrl ?? "",
      platformName: platform?.name,
    });
  },
});

export const listConnectableSources = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({
    sourceId: v.id("sources"),
    name: v.string(),
    baseUrl: v.string(),
    platformName: v.optional(v.string()),
  })),
  handler: async (ctx, args) => {
    await requireUserId(ctx);
    const rows = await ctx.db
      .query("sources")
      .withIndex("by_automation_review_and_status", (q) => q.eq("automationReview", "approved"))
      .take(Math.max(1, Math.min(50, Math.floor(args.limit ?? 30))));
    const result = [];
    for (const source of rows) {
      if (source.accessMode !== "authenticated") continue;
      const platform = source.platformId ? await ctx.db.get(source.platformId) : null;
      result.push({ sourceId: source._id, name: source.name, baseUrl: source.baseUrl, platformName: platform?.name });
    }
    return result;
  },
});

export const listRunsMine = query({
  args: { connectionId: v.id("portalConnections") },
  returns: v.array(publicRunValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    const rows = await ctx.db
      .query("browserRuns")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .order("desc")
      .take(30);
    return rows.map(toPublicRun);
  },
});

export const getRunMine = query({
  args: { runId: v.id("browserRuns") },
  returns: v.union(publicRunValidator, v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const run = await ctx.db.get(args.runId);
    return run?.ownerId === ownerId ? toPublicRun(run) : null;
  },
});

export const requestConnection = mutation({
  args: { sourceId: v.id("sources"), label: v.string() },
  returns: v.id("portalConnections"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const source = await ctx.db.get(args.sourceId);
    if (
      source === null ||
      (source.accessMode !== "public" && source.accessMode !== "authenticated")
    ) {
      throw new ConvexError({ code: "BROWSER_SOURCE_NOT_ELIGIBLE" });
    }
    const domain = normalizeHostname(source.baseUrl);
    const existing = await ctx.db
      .query("portalConnections")
      .withIndex("by_owner_and_source", (q) =>
        q.eq("ownerId", ownerId).eq("sourceId", source._id),
      )
      .unique();
    if (existing !== null) return existing._id;
    const now = Date.now();
    return await ctx.db.insert("portalConnections", {
      ownerId,
      sourceId: source._id,
      label: cleanLabel(args.label),
      status: "draft",
      policyDecision: "pending",
      allowReadOnlyRecon: false,
      allowInboxPolling: false,
      allowedDomains: [domain],
      allowedPaths: [],
      pollIntervalMinutes: 60,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const reviewConnection = mutation({
  args: {
    connectionId: v.id("portalConnections"),
    decision: policyDecisionValidator,
    allowReadOnlyRecon: v.boolean(),
    allowInboxPolling: v.boolean(),
    allowedDomains: v.array(v.string()),
    allowedPaths: v.array(v.string()),
    inboxPath: v.optional(v.string()),
    adapterKey: v.optional(v.string()),
    pollIntervalMinutes: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null) throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    const source = await ctx.db.get(connection.sourceId);
    if (source === null) throw new ConvexError({ code: "SOURCE_NOT_FOUND" });
    if (
      args.decision === "allowed" &&
      (source.automationReview !== "approved" ||
        (source.accessMode !== "public" && source.accessMode !== "authenticated"))
    ) {
      throw new ConvexError({ code: "SOURCE_REVIEW_REQUIRED" });
    }
    if (args.allowInboxPolling && !args.inboxPath) {
      throw new ConvexError({ code: "INBOX_PATH_REQUIRED" });
    }
    if (args.allowInboxPolling && source.accessMode !== "authenticated") {
      throw new ConvexError({ code: "AUTHENTICATED_SOURCE_REQUIRED" });
    }
    if (args.pollIntervalMinutes < 30 || args.pollIntervalMinutes > 24 * 60) {
      throw new ConvexError({ code: "INVALID_POLL_INTERVAL" });
    }

    const sourceDomain = normalizeHostname(source.baseUrl);
    const domains = Array.from(
      new Set(args.allowedDomains.map((domain) => normalizeHostname(domain))),
    );
    if (
      domains.length === 0 ||
      domains.length > 5 ||
      domains.some(
        (domain) => domain !== sourceDomain && !domain.endsWith(`.${sourceDomain}`),
      )
    ) {
      throw new ConvexError({ code: "INVALID_ALLOWED_DOMAINS" });
    }
    const paths = Array.from(
      new Set(
        args.allowedPaths.map((path) => {
          const clean = path.trim();
          if (!clean.startsWith("/") || clean.includes("://")) {
            throw new ConvexError({ code: "INVALID_ALLOWED_PATH" });
          }
          return clean.slice(0, 500);
        }),
      ),
    ).slice(0, 20);
    const inboxPath = args.inboxPath?.trim();
    if (inboxPath && !paths.some((path) => inboxPath === path || inboxPath.startsWith(`${path}/`))) {
      throw new ConvexError({ code: "INBOX_PATH_NOT_ALLOWED" });
    }
    const allowed = args.decision === "allowed";
    const now = Date.now();
    await ctx.db.patch(connection._id, {
      policyDecision: args.decision,
      allowReadOnlyRecon: allowed && args.allowReadOnlyRecon,
      allowInboxPolling: allowed && args.allowInboxPolling,
      allowedDomains: domains,
      allowedPaths: paths,
      inboxPath: inboxPath || undefined,
      adapterKey: args.adapterKey?.trim().slice(0, 100) || undefined,
      pollIntervalMinutes: args.pollIntervalMinutes,
      status:
        allowed && source.accessMode === "public"
          ? "active"
          : allowed
            ? "needs_auth"
            : "paused",
      nextPollAt: undefined,
      circuitOpenUntil: undefined,
      failureCount: 0,
      updatedAt: now,
    });
    return null;
  },
});

export const approveControlledDemoConnection = mutation({
  args: { connectionId: v.id("portalConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    const source = await ctx.db.get(connection.sourceId);
    if (
      source === null ||
      source.slug !== "roomscout-dev-connected" ||
      source.accessMode !== "authenticated" ||
      source.automationReview !== "approved" ||
      source.adapterKey !== "roomscout-dev-v1"
    ) {
      throw new ConvexError({ code: "CONTROLLED_DEMO_SOURCE_REQUIRED" });
    }
    const domain = normalizeHostname(source.baseUrl);
    const now = Date.now();
    await ctx.db.patch(connection._id, {
      platformId: source.platformId,
      status: "needs_auth",
      policyDecision: "allowed",
      allowReadOnlyRecon: false,
      allowInboxPolling: true,
      allowedDomains: [domain],
      allowedPaths: ["/", "/sign-up", "/sign-in", "/listings", "/inbox"],
      inboxPath: "/inbox",
      adapterKey: "roomscout-dev-v1",
      pollIntervalMinutes: 60,
      lastErrorCode: undefined,
      circuitOpenUntil: undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const pauseMine = mutation({
  args: { connectionId: v.id("portalConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    await ctx.db.patch(connection._id, {
      status: "paused",
      nextPollAt: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

async function expireStaleRuns(ctx: MutationCtx, now: number): Promise<void> {
  for (const status of ["queued", "running", "human_required"] as const) {
    const rows = await ctx.db
      .query("browserRuns")
      .withIndex("by_status", (q) => q.eq("status", status))
      .take(10);
    for (const run of rows) {
      if (run.expiresAt > now) continue;
      await ctx.db.patch(run._id, {
        status: "expired",
        errorCode: "RUN_TTL_EXPIRED",
        endedAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("browserRunEvents", {
        runId: run._id,
        ownerId: run.ownerId,
        kind: "failed",
        message: "RUN_TTL_EXPIRED",
        createdAt: now,
      });
    }
  }
}

export const reserveRun = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    kind: runKindValidator,
  },
  returns: v.id("browserRuns"),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== args.ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    if (connection.policyDecision !== "allowed" || connection.status === "disabled") {
      throw new ConvexError({ code: "PORTAL_POLICY_REQUIRED" });
    }
    if (args.kind === "recon" && !connection.allowReadOnlyRecon) {
      throw new ConvexError({ code: "RECON_NOT_ALLOWED" });
    }
    if (args.kind === "inbox_sync" && !connection.allowInboxPolling) {
      throw new ConvexError({ code: "INBOX_POLLING_NOT_ALLOWED" });
    }
    const now = Date.now();
    if (connection.circuitOpenUntil && connection.circuitOpenUntil > now) {
      throw new ConvexError({ code: "PORTAL_CIRCUIT_OPEN" });
    }
    await expireStaleRuns(ctx, now);
    for (const status of ["queued", "running", "human_required"] as const) {
      const active = await ctx.db
        .query("browserRuns")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(1);
      if (active.length > 0) throw new ConvexError({ code: "BROWSER_CONCURRENCY_LIMIT" });
    }
    const runId = await ctx.db.insert("browserRuns", {
      connectionId: connection._id,
      ownerId: args.ownerId,
      kind: args.kind,
      status: "queued",
      expiresAt: now + PORTAL_RUN_TTLS_MS[args.kind],
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("browserRunEvents", {
      runId,
      ownerId: args.ownerId,
      kind: "started",
      message: "RUN_RESERVED",
      createdAt: now,
    });
    return runId;
  },
});

export const getConnectionForWorker = internalQuery({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
  },
  returns: v.union(
    v.object({
      connectionId: v.id("portalConnections"),
      sourceId: v.id("sources"),
      sourceSlug: v.string(),
      platformId: v.optional(v.id("sourcePlatforms")),
      baseUrl: v.string(),
      allowedDomains: v.array(v.string()),
      allowedPaths: v.array(v.string()),
      inboxPath: v.optional(v.string()),
      adapterKey: v.optional(v.string()),
      accessMode: v.union(v.literal("public"), v.literal("authenticated")),
      allowReadOnlyRecon: v.boolean(),
      allowInboxPolling: v.boolean(),
      providerContextId: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (
      connection === null ||
      connection.ownerId !== args.ownerId ||
      connection.policyDecision !== "allowed" ||
      connection.status === "disabled"
    ) return null;
    const source = await ctx.db.get(connection.sourceId);
    if (
      source === null ||
      source.automationReview !== "approved" ||
      (source.accessMode !== "public" && source.accessMode !== "authenticated")
    ) return null;
    const context = await ctx.db
      .query("browserContexts")
      .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
      .order("desc")
      .first();
    return {
      connectionId: connection._id,
      sourceId: source._id,
      sourceSlug: source.slug,
      platformId: connection.platformId ?? source.platformId,
      baseUrl: source.baseUrl,
      allowedDomains: connection.allowedDomains,
      allowedPaths: connection.allowedPaths,
      inboxPath: connection.inboxPath,
      adapterKey: connection.adapterKey,
      accessMode: source.accessMode,
      allowReadOnlyRecon: connection.allowReadOnlyRecon,
      allowInboxPolling: connection.allowInboxPolling,
      providerContextId:
        context?.status === "ready" ? context.providerContextId : undefined,
    };
  },
});

export const getRunForOwner = internalQuery({
  args: { ownerId: v.id("users"), runId: v.id("browserRuns") },
  returns: v.union(
    v.object({
      runId: v.id("browserRuns"),
      connectionId: v.id("portalConnections"),
      contextId: v.optional(v.id("browserContexts")),
      providerSessionId: v.optional(v.string()),
      kind: runKindValidator,
      status: runStatusValidator,
      expiresAt: v.number(),
      onboardingStage: v.optional(onboardingStageValidator),
      onboardingMailboxId: v.optional(v.id("userMailboxes")),
      verificationMessageId: v.optional(v.id("mailboxMessages")),
      verificationRequestedAt: v.optional(v.number()),
      onboardingPollAttempt: v.optional(v.number()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null || run.ownerId !== args.ownerId) return null;
    return {
      runId: run._id,
      connectionId: run.connectionId,
      contextId: run.contextId,
      providerSessionId: run.providerSessionId,
      kind: run.kind,
      status: run.status,
      expiresAt: run.expiresAt,
      onboardingStage: run.onboardingStage,
      onboardingMailboxId: run.onboardingMailboxId,
      verificationMessageId: run.verificationMessageId,
      verificationRequestedAt: run.verificationRequestedAt,
      onboardingPollAttempt: run.onboardingPollAttempt,
    };
  },
});

export const markAgentOnboardingState = internalMutation({
  args: {
    ownerId: v.id("users"),
    runId: v.id("browserRuns"),
    stage: onboardingStageValidator,
    mailboxId: v.optional(v.id("userMailboxes")),
    verificationMessageId: v.optional(v.id("mailboxMessages")),
    verificationRequestedAt: v.optional(v.number()),
    pollAttempt: v.optional(v.number()),
    humanRequired: v.boolean(),
    eventMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (
      run === null ||
      run.ownerId !== args.ownerId ||
      run.kind !== "authenticate" ||
      ["completed", "failed", "stopped", "expired"].includes(run.status)
    ) {
      throw new ConvexError({ code: "AUTH_RUN_NOT_RESUMABLE" });
    }
    const now = Date.now();
    await ctx.db.patch(run._id, {
      status: args.humanRequired ? "human_required" : "running",
      onboardingStage: args.stage,
      onboardingMailboxId: args.mailboxId ?? run.onboardingMailboxId,
      verificationMessageId:
        args.verificationMessageId ?? run.verificationMessageId,
      verificationRequestedAt:
        args.verificationRequestedAt ?? run.verificationRequestedAt,
      onboardingPollAttempt: args.pollAttempt ?? run.onboardingPollAttempt,
      updatedAt: now,
    });
    await ctx.db.insert("browserRunEvents", {
      runId: run._id,
      ownerId: args.ownerId,
      kind: args.humanRequired ? "human_required" : "progress",
      message: args.eventMessage.slice(0, 100),
      createdAt: now,
    });
    return null;
  },
});

export const attachProviderRun = internalMutation({
  args: {
    runId: v.id("browserRuns"),
    ownerId: v.id("users"),
    providerSessionId: v.string(),
    providerContextId: v.optional(v.string()),
    humanRequired: v.boolean(),
  },
  returns: v.object({ contextId: v.optional(v.id("browserContexts")) }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null || run.ownerId !== args.ownerId || run.status !== "queued") {
      throw new ConvexError({ code: "RUN_NOT_RESERVABLE" });
    }
    const now = Date.now();
    let contextId: Id<"browserContexts"> | undefined;
    if (args.providerContextId) {
      const existing = await ctx.db
        .query("browserContexts")
        .withIndex("by_connection", (q) => q.eq("connectionId", run.connectionId))
        .order("desc")
        .first();
      if (existing) {
        contextId = existing._id;
        await ctx.db.patch(existing._id, {
          providerContextId: args.providerContextId,
          status: args.humanRequired ? "creating" : existing.status,
          activeRunId: run._id,
          updatedAt: now,
        });
      } else {
        contextId = await ctx.db.insert("browserContexts", {
          connectionId: run.connectionId,
          ownerId: args.ownerId,
          providerContextId: args.providerContextId,
          status: args.humanRequired ? "creating" : "ready",
          activeRunId: run._id,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    const status = args.humanRequired ? "human_required" : "running";
    await ctx.db.patch(run._id, {
      contextId,
      providerSessionId: args.providerSessionId,
      status,
      startedAt: now,
      updatedAt: now,
    });
    if (args.humanRequired) {
      await ctx.db.insert("browserRunEvents", {
        runId: run._id,
        ownerId: args.ownerId,
        kind: "human_required",
        message: "LOGIN_OR_2FA_REQUIRED",
        createdAt: now,
      });
    }
    return { contextId };
  },
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("browserRuns"),
    status: v.union(v.literal("completed"), v.literal("failed"), v.literal("stopped")),
    resultCount: v.optional(v.number()),
    errorCode: v.optional(v.string()),
    contextReady: v.optional(v.boolean()),
    reauthRequired: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null || ["completed", "failed", "stopped", "expired"].includes(run.status)) {
      return null;
    }
    const connection = await ctx.db.get(run.connectionId);
    const now = Date.now();
    await ctx.db.patch(run._id, {
      status: args.status,
      resultCount: args.resultCount,
      errorCode: args.errorCode?.slice(0, 100),
      endedAt: now,
      onboardingStage:
        run.onboardingStage === undefined
          ? undefined
          : args.status === "completed"
            ? "completed"
            : "failed",
      updatedAt: now,
    });
    await ctx.db.insert("browserRunEvents", {
      runId: run._id,
      ownerId: run.ownerId,
      kind: args.status === "completed" ? "completed" : args.status === "stopped" ? "stopped" : "failed",
      message: args.errorCode?.slice(0, 100),
      createdAt: now,
    });
    if (run.contextId) {
      await ctx.db.patch(run.contextId, {
        status: args.contextReady
          ? "ready"
          : args.reauthRequired
            ? "reauth_required"
            : "ready",
        activeRunId: undefined,
        lastVerifiedAt: args.contextReady ? now : undefined,
        updatedAt: now,
      });
    }
    if (connection !== null) {
      const failureCount = args.status === "failed" ? connection.failureCount + 1 : 0;
      const circuitOpenUntil =
        failureCount >= PORTAL_CIRCUIT_FAILURES
          ? now + PORTAL_CIRCUIT_COOLDOWN_MS
          : undefined;
      await ctx.db.patch(connection._id, {
        status:
          args.contextReady
            ? "active"
            : args.reauthRequired
              ? "reauth_required"
              : connection.status,
        failureCount,
        circuitOpenUntil,
        lastSuccessAt: args.status === "completed" ? now : connection.lastSuccessAt,
        lastErrorCode: args.status === "failed" ? args.errorCode?.slice(0, 100) : undefined,
        nextPollAt:
          args.status === "completed" && connection.allowInboxPolling
            ? now + connection.pollIntervalMinutes * 60_000
            : undefined,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const markRunResumed = internalMutation({
  args: { ownerId: v.id("users"), runId: v.id("browserRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (
      run === null ||
      run.ownerId !== args.ownerId ||
      run.kind !== "authenticate" ||
      run.status !== "human_required" ||
      run.expiresAt <= Date.now()
    ) throw new ConvexError({ code: "AUTH_RUN_NOT_RESUMABLE" });
    const now = Date.now();
    await ctx.db.patch(run._id, { status: "running", updatedAt: now });
    await ctx.db.insert("browserRunEvents", {
      runId: run._id,
      ownerId: args.ownerId,
      kind: "resumed",
      message: "HUMAN_AUTH_CONFIRMED",
      createdAt: now,
    });
    return null;
  },
});

export const getContextForOwner = internalQuery({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
  },
  returns: v.union(
    v.object({
      contextId: v.id("browserContexts"),
      providerContextId: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== args.ownerId) return null;
    const context = await ctx.db
      .query("browserContexts")
      .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
      .order("desc")
      .first();
    if (context === null || context.status === "deleted") return null;
    return { contextId: context._id, providerContextId: context.providerContextId };
  },
});

export const listDueInboxSyncs = internalQuery({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(
    v.object({
      ownerId: v.id("users"),
      connectionId: v.id("portalConnections"),
    }),
  ),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(5, Math.floor(args.limit)));
    const connections = await ctx.db
      .query("portalConnections")
      .withIndex("by_status_and_next_poll_at", (q) =>
        q.eq("status", "active").lte("nextPollAt", args.now),
      )
      .take(limit);
    return connections
      .filter(
        (connection) =>
          connection.policyDecision === "allowed" &&
          connection.allowInboxPolling &&
          (!connection.circuitOpenUntil || connection.circuitOpenUntil <= args.now),
      )
      .map((connection) => ({ ownerId: connection.ownerId, connectionId: connection._id }));
  },
});

export const markContextDeleted = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    contextId: v.id("browserContexts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    const context = await ctx.db.get(args.contextId);
    if (
      connection === null ||
      context === null ||
      connection.ownerId !== args.ownerId ||
      context.ownerId !== args.ownerId ||
      context.connectionId !== connection._id
    ) throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    const now = Date.now();
    await ctx.db.patch(context._id, { status: "deleted", activeRunId: undefined, updatedAt: now });
    await ctx.db.patch(connection._id, {
      status: "disabled",
      nextPollAt: undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const disableConnectionRecord = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    contextId: v.optional(v.id("browserContexts")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== args.ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    const now = Date.now();
    if (args.contextId) {
      const context = await ctx.db.get(args.contextId);
      if (
        context === null ||
        context.ownerId !== args.ownerId ||
        context.connectionId !== connection._id
      ) throw new ConvexError({ code: "CONTEXT_NOT_FOUND" });
      await ctx.db.patch(context._id, {
        status: "deleted",
        activeRunId: undefined,
        updatedAt: now,
      });
    }
    await ctx.db.patch(connection._id, {
      status: "disabled",
      allowReadOnlyRecon: false,
      allowInboxPolling: false,
      nextPollAt: undefined,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.portalConnections.purgeDisabledConnectionData, {
      ownerId: args.ownerId,
      connectionId: connection._id,
    });
    return null;
  },
});

export const purgeDisabledConnectionData = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (
      connection === null ||
      connection.ownerId !== args.ownerId ||
      connection.status !== "disabled"
    ) return null;

    const messages = await ctx.db
      .query("platformMessages")
      .withIndex("by_connection_and_provider_message_id", (q) =>
        q.eq("connectionId", connection._id),
      )
      .take(100);
    for (const message of messages) await ctx.db.delete(message._id);
    if (messages.length === 100) {
      await ctx.scheduler.runAfter(0, internal.portalConnections.purgeDisabledConnectionData, args);
      return null;
    }

    const threads = await ctx.db
      .query("platformThreads")
      .withIndex("by_connection_and_provider_thread_id", (q) =>
        q.eq("connectionId", connection._id),
      )
      .take(100);
    for (const thread of threads) await ctx.db.delete(thread._id);
    if (threads.length === 100) {
      await ctx.scheduler.runAfter(0, internal.portalConnections.purgeDisabledConnectionData, args);
    }
    return null;
  },
});
