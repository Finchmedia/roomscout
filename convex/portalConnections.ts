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
import { PORTAL_RUN_TTLS_MS, normalizeHostname } from "./integrations/portalSafety";
import { PORTAL_WRITE_TTL_MS } from "./integrations/portalWriteAdapters";
import {
  portalBrowserProviderValidator,
  resolvePortalBrowserProvider,
  storedPortalBrowserProvider,
  type PortalBrowserProvider,
} from "./integrations/portalBrowserEngine";

const connectionStatusValidator = v.union(
  v.literal("draft"),
  v.literal("needs_auth"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("reauth_required"),
  v.literal("disabled"),
);
const BROWSERBASE_HUMAN_INACTIVITY_MS = 5 * 60_000;
const PROVIDER_CLEANUP_LEASE_MAX_MS = 2 * 60_000;

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

const browserEngineValidator = v.union(
  v.literal("stagehand"),
  v.literal("legacy"),
  v.literal("firecrawl"),
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
  browserProvider: portalBrowserProviderValidator,
  contextStatus: v.optional(v.union(
    v.literal("creating"), v.literal("ready"), v.literal("reauth_required"),
    v.literal("deleting"), v.literal("deleted"), v.literal("failed"),
  )),
  contextProbeAttempts: v.optional(v.number()),
  contextProbeDeadlineAt: v.optional(v.number()),
  contextProbeErrorCode: v.optional(v.string()),
  providerMismatch: v.boolean(),
  providerConfigurationError: v.optional(v.string()),
  allowReadOnlyRecon: v.boolean(),
  allowInboxPolling: v.boolean(),
  pollIntervalMinutes: v.number(),
  nextPollAt: v.optional(v.number()),
  lastSuccessAt: v.optional(v.number()),
  lastErrorCode: v.optional(v.string()),
  circuitOpenUntil: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  latestAuthenticationRun: v.optional(v.object({
    runId: v.id("browserRuns"),
    status: runStatusValidator,
    onboardingStage: v.optional(onboardingStageValidator),
    errorCode: v.optional(v.string()),
    browserProvider: portalBrowserProviderValidator,
    updatedAt: v.number(),
  })),
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
  browserProvider: portalBrowserProviderValidator,
  canResume: v.boolean(),
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
  browserProvider?: PortalBrowserProvider;
  allowReadOnlyRecon: boolean;
  allowInboxPolling: boolean;
  pollIntervalMinutes: number;
  nextPollAt?: number;
  lastSuccessAt?: number;
  lastErrorCode?: string;
  circuitOpenUntil?: number;
  createdAt: number;
  updatedAt: number;
}, metadata: {
  sourceName: string; baseUrl: string; platformName?: string;
  contextStatus?: "creating" | "ready" | "reauth_required" | "deleting" | "deleted" | "failed";
  contextProbeAttempts?: number; contextProbeDeadlineAt?: number; contextProbeErrorCode?: string;
  providerMismatch: boolean; providerConfigurationError?: string;
  latestAuthenticationRun?: {
    runId: Id<"browserRuns">;
    status: "queued" | "running" | "human_required" | "completed" | "failed" | "stopped" | "expired";
    onboardingStage?: "opening_signup" | "waiting_verification" | "submitting_verification" | "human_required" | "completed" | "failed";
    errorCode?: string;
    browserProvider: PortalBrowserProvider;
    updatedAt: number;
  };
}) {
  return {
    _id: connection._id,
    sourceId: connection.sourceId,
    label: connection.label,
    ...metadata,
    status: connection.status,
    policyDecision: connection.policyDecision,
    browserProvider: storedPortalBrowserProvider(connection.browserProvider),
    contextStatus: metadata.contextStatus,
    contextProbeAttempts: metadata.contextProbeAttempts,
    contextProbeDeadlineAt: metadata.contextProbeDeadlineAt,
    contextProbeErrorCode: metadata.contextProbeErrorCode,
    providerMismatch: metadata.providerMismatch,
    providerConfigurationError: metadata.providerConfigurationError,
    allowReadOnlyRecon: connection.allowReadOnlyRecon,
    allowInboxPolling: connection.allowInboxPolling,
    pollIntervalMinutes: connection.pollIntervalMinutes,
    nextPollAt: connection.nextPollAt,
    lastSuccessAt: connection.lastSuccessAt,
    lastErrorCode: connection.lastErrorCode,
    circuitOpenUntil: connection.circuitOpenUntil,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
    latestAuthenticationRun: metadata.latestAuthenticationRun,
  };
}

function selectedProviderForUi(): { provider?: PortalBrowserProvider; error?: string } {
  try {
    return { provider: resolvePortalBrowserProvider() };
  } catch {
    return { error: "PORTAL_BROWSER_ENGINE_INVALID" };
  }
}

function toPublicRun(run: {
  _id: Id<"browserRuns">;
  connectionId: Id<"portalConnections">;
  providerSessionId?: string;
  kind: "recon" | "authenticate" | "inbox_sync";
  status: "queued" | "running" | "human_required" | "completed" | "failed" | "stopped" | "expired";
  startedAt?: number;
  expiresAt: number;
  inactivityDeadlineAt?: number;
  endedAt?: number;
  resultCount?: number;
  errorCode?: string;
  onboardingStage?: "opening_signup" | "waiting_verification" | "submitting_verification" | "human_required" | "completed" | "failed";
  browserProvider?: PortalBrowserProvider;
  createdAt: number;
  updatedAt: number;
}, selectedProvider?: PortalBrowserProvider) {
  const runProvider = storedPortalBrowserProvider(run.browserProvider);
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
    browserProvider: runProvider,
    canResume: runProvider === "browserbase" && selectedProvider === runProvider &&
      run.status === "human_required" && run.expiresAt > Date.now() &&
      (run.inactivityDeadlineAt ?? run.expiresAt) > Date.now() && run.providerSessionId !== undefined,
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
    const selected = selectedProviderForUi();
    return await Promise.all(rows.map(async (row) => {
      const source = await ctx.db.get(row.sourceId);
      const platform = row.platformId ? await ctx.db.get(row.platformId) : source?.platformId ? await ctx.db.get(source.platformId) : null;
      const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", row._id)).order("desc").first();
      const recentRuns = await ctx.db.query("browserRuns").withIndex("by_connection", (q) => q.eq("connectionId", row._id)).order("desc").take(30);
      const latestAuthentication = recentRuns.find((run) => run.kind === "authenticate");
      const provider = storedPortalBrowserProvider(row.browserProvider);
      const matchingContext = context && storedPortalBrowserProvider(context.browserProvider) === provider ? context : null;
      return toPublicConnection(row, {
        sourceName: source?.name ?? row.label,
        baseUrl: source?.baseUrl ?? "",
        platformName: platform?.name,
        contextStatus: matchingContext?.status,
        contextProbeAttempts: matchingContext?.probeAttempts,
        contextProbeDeadlineAt: matchingContext?.probeDeadlineAt,
        contextProbeErrorCode: matchingContext?.probeErrorCode,
        providerMismatch: selected.provider !== undefined && selected.provider !== provider,
        providerConfigurationError: selected.error,
        latestAuthenticationRun: latestAuthentication ? {
          runId: latestAuthentication._id,
          status: latestAuthentication.status,
          onboardingStage: latestAuthentication.onboardingStage,
          errorCode: latestAuthentication.errorCode,
          browserProvider: storedPortalBrowserProvider(latestAuthentication.browserProvider),
          updatedAt: latestAuthentication.updatedAt,
        } : undefined,
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
    const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).order("desc").first();
    const selected = selectedProviderForUi();
    const provider = storedPortalBrowserProvider(connection.browserProvider);
    const matchingContext = context && storedPortalBrowserProvider(context.browserProvider) === provider ? context : null;
    return toPublicConnection(connection, {
      sourceName: source?.name ?? connection.label,
      baseUrl: source?.baseUrl ?? "",
      platformName: platform?.name,
      contextStatus: matchingContext?.status,
      contextProbeAttempts: matchingContext?.probeAttempts,
      contextProbeDeadlineAt: matchingContext?.probeDeadlineAt,
      contextProbeErrorCode: matchingContext?.probeErrorCode,
      providerMismatch: selected.provider !== undefined && selected.provider !== provider,
      providerConfigurationError: selected.error,
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
    return rows.map((run) => toPublicRun(run, selectedProviderForUi().provider));
  },
});

export const getRunMine = query({
  args: { runId: v.id("browserRuns") },
  returns: v.union(publicRunValidator, v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const run = await ctx.db.get(args.runId);
    return run?.ownerId === ownerId ? toPublicRun(run, selectedProviderForUi().provider) : null;
  },
});

export async function requestConnectionForOwner(
  ctx: MutationCtx,
  input: { ownerId: Id<"users">; sourceId: Id<"sources">; label: string },
): Promise<Id<"portalConnections">> {
  const source = await ctx.db.get(input.sourceId);
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
      q.eq("ownerId", input.ownerId).eq("sourceId", source._id),
    )
    .unique();
  if (existing !== null) return existing._id;
  const now = Date.now();
  return await ctx.db.insert("portalConnections", {
    ownerId: input.ownerId,
    sourceId: source._id,
    label: cleanLabel(input.label),
    browserProvider: resolvePortalBrowserProvider(),
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
}

export const requestConnection = mutation({
  args: { sourceId: v.id("sources"), label: v.string() },
  returns: v.id("portalConnections"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    return await requestConnectionForOwner(ctx, { ownerId, ...args });
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
    if (!Number.isInteger(args.pollIntervalMinutes) || args.pollIntervalMinutes <= 0) {
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

export type ControlledConnectionApproval = "prepared" | "reused_active" | "reauth_required";

export async function approveControlledDemoConnectionCore(
  ctx: MutationCtx,
  connectionId: Id<"portalConnections">,
  options: { preserveEstablishedState?: boolean } = {},
): Promise<ControlledConnectionApproval> {
  const connection = await ctx.db.get(connectionId);
  if (connection === null) {
    throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
  }
  const source = await ctx.db.get(connection.sourceId);
  let sourceUrl: URL | undefined;
  try {
    sourceUrl = source ? new URL(source.baseUrl) : undefined;
  } catch {
    sourceUrl = undefined;
  }
  if (
    source === null ||
    source.slug !== "roomscout-dev-connected" ||
    source.accessMode !== "authenticated" ||
    source.automationReview !== "approved" ||
    source.adapterKey !== "roomscout-dev-v1" ||
    sourceUrl?.protocol !== "https:" ||
    sourceUrl.hostname !== "roomscout.dev" ||
    sourceUrl.port !== "" ||
    (sourceUrl.pathname !== "/" && sourceUrl.pathname !== "")
  ) {
    throw new ConvexError({ code: "CONTROLLED_DEMO_SOURCE_REQUIRED" });
  }
  const domain = normalizeHostname(source.baseUrl);
  const exactScope =
    connection.platformId === source.platformId &&
    connection.policyDecision === "allowed" &&
    connection.allowReadOnlyRecon === false &&
    connection.allowInboxPolling === true &&
    connection.allowedDomains.length === 1 &&
    connection.allowedDomains[0] === domain &&
    connection.allowedPaths.join("\n") === ["/", "/sign-up", "/sign-in", "/listings", "/inbox"].join("\n") &&
    connection.inboxPath === "/inbox" &&
    connection.adapterKey === "roomscout-dev-v1" &&
    connection.pollIntervalMinutes === 60;
  if (options.preserveEstablishedState && exactScope && connection.status === "active") return "reused_active";
  if (options.preserveEstablishedState && exactScope && connection.status === "reauth_required") return "reauth_required";
  if (options.preserveEstablishedState && exactScope && connection.status === "needs_auth") return "prepared";
  if (
    options.preserveEstablishedState &&
    (connection.status === "active" || connection.status === "reauth_required")
  ) {
    throw new ConvexError({ code: "CONTROLLED_DEMO_CONNECTION_DRIFT" });
  }
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
  return "prepared";
}

export const approveControlledDemoConnection = mutation({
  args: { connectionId: v.id("portalConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    await approveControlledDemoConnectionCore(ctx, args.connectionId);
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

async function expireStaleRunsForConnection(
  ctx: MutationCtx,
  connectionId: Id<"portalConnections">,
  now: number,
): Promise<void> {
  const rows = await ctx.db.query("browserRuns").withIndex("by_connection", (q) =>
    q.eq("connectionId", connectionId),
  ).order("desc").take(50);
  for (const run of rows) {
    if (!["queued", "running", "human_required"].includes(run.status) || run.expiresAt > now) continue;
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
      if (run.contextId) {
        const context = await ctx.db.get(run.contextId);
        if (context?.activeRunId === run._id) {
          await ctx.db.patch(context._id, { activeRunId: undefined, updatedAt: now });
        }
      }
  }
}

export const reserveRun = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    kind: runKindValidator,
    browserProvider: v.optional(portalBrowserProviderValidator),
  },
  returns: v.id("browserRuns"),
  handler: async (ctx, args) => {
    const maintenance = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", "controlled_portal")).unique();
    if (maintenance?.paused) throw new ConvexError({ code: "PORTAL_BROWSER_MAINTENANCE_PAUSED" });
    const selectedProvider = resolvePortalBrowserProvider();
    if (args.browserProvider !== undefined && args.browserProvider !== selectedProvider) {
      throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
    }
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== args.ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    if (connection.policyDecision !== "allowed" || connection.status === "disabled") {
      throw new ConvexError({ code: "PORTAL_POLICY_REQUIRED" });
    }
    const existingContext = await ctx.db.query("browserContexts").withIndex("by_connection", (q) =>
      q.eq("connectionId", connection._id),
    ).order("desc").first();
    const establishedProvider = connection.browserProvider ?? existingContext?.browserProvider ??
      (existingContext ? "browserbase" : undefined);
    if (establishedProvider !== undefined && establishedProvider !== selectedProvider) {
      throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_RECONNECT_REQUIRED" });
    }
    if (args.kind === "recon" && !connection.allowReadOnlyRecon) {
      throw new ConvexError({ code: "RECON_NOT_ALLOWED" });
    }
    if (args.kind === "inbox_sync" && !connection.allowInboxPolling) {
      throw new ConvexError({ code: "INBOX_POLLING_NOT_ALLOWED" });
    }
    const now = Date.now();
    if (connection.activeWriteExecutionId && (connection.activeWriteDeadlineAt ?? 0) > now) {
      throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
    }
    await expireStaleRunsForConnection(ctx, connection._id, now);
    const connectionRuns = await ctx.db.query("browserRuns").withIndex("by_connection", (q) =>
      q.eq("connectionId", connection._id),
    ).order("desc").take(20);
    if (connectionRuns.some((run) => ["queued", "running", "human_required"].includes(run.status))) {
      throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
    }
    const runId = await ctx.db.insert("browserRuns", {
      connectionId: connection._id,
      ownerId: args.ownerId,
      browserProvider: selectedProvider,
      kind: args.kind,
      status: "queued",
      expiresAt: now + PORTAL_RUN_TTLS_MS[args.kind],
      createdAt: now,
      updatedAt: now,
    });
    if (connection.browserProvider === undefined) {
      await ctx.db.patch(connection._id, { browserProvider: selectedProvider, updatedAt: now });
    }
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

export const claimWriteSession = internalMutation({
  args: {
    ownerId: v.id("users"), connectionId: v.id("portalConnections"),
    executionId: v.id("actionExecutions"), browserProvider: v.optional(portalBrowserProviderValidator),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const selectedProvider = args.browserProvider ?? resolvePortalBrowserProvider();
    const [connection, execution, context] = await Promise.all([
      ctx.db.get(args.connectionId),
      ctx.db.get(args.executionId),
      ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId)).order("desc").first(),
    ]);
    if (!connection || connection.ownerId !== args.ownerId || connection.status !== "active" || connection.policyDecision !== "allowed" ||
      !execution || execution.ownerId !== args.ownerId || execution.connectionId !== connection._id || execution.status !== "claimed" ||
      storedPortalBrowserProvider(connection.browserProvider) !== selectedProvider ||
      storedPortalBrowserProvider(execution.browserProvider) !== selectedProvider) return false;
    if (selectedProvider === "firecrawl" &&
      (!context || context.status !== "ready" || storedPortalBrowserProvider(context.browserProvider) !== selectedProvider)) return false;
    if (connection.inboxSyncActiveGeneration !== undefined && (connection.inboxSyncDeadlineAt ?? 0) > now) return false;
    if (context?.activeRunId) {
      const activeRun = await ctx.db.get(context.activeRunId);
      if (activeRun && ["queued", "running", "human_required"].includes(activeRun.status)) return false;
    }
    if (connection.activeWriteExecutionId && connection.activeWriteExecutionId !== execution._id && (connection.activeWriteDeadlineAt ?? 0) > now) return false;
    await ctx.db.patch(connection._id, { activeWriteExecutionId: execution._id, activeWriteDeadlineAt: now + PORTAL_WRITE_TTL_MS, updatedAt: now });
    return true;
  },
});

export const validateRunProvider = internalQuery({
  args: {
    ownerId: v.id("users"),
    runId: v.id("browserRuns"),
    browserProvider: portalBrowserProviderValidator,
    requireReadyContext: v.optional(v.boolean()),
    requireSelectedProvider: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.ownerId !== args.ownerId || storedPortalBrowserProvider(run.browserProvider) !== args.browserProvider) return false;
    const connection = await ctx.db.get(run.connectionId);
    if (!connection || connection.ownerId !== args.ownerId ||
      storedPortalBrowserProvider(connection.browserProvider) !== args.browserProvider) return false;
    if (args.requireSelectedProvider !== false && resolvePortalBrowserProvider() !== args.browserProvider) return false;
    if (args.requireReadyContext) {
      if (!run.contextId) return false;
      const context = await ctx.db.get(run.contextId);
      if (!context || context.connectionId !== connection._id || context.status !== "ready" ||
        storedPortalBrowserProvider(context.browserProvider) !== args.browserProvider) return false;
    }
    return true;
  },
});

export const validateProviderCleanup = internalQuery({
  args: { ownerId: v.id("users"), runId: v.id("browserRuns"), provider: portalBrowserProviderValidator, providerSessionId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    return run !== null && run.ownerId === args.ownerId &&
      storedPortalBrowserProvider(run.browserProvider) === args.provider &&
      run.providerSessionId === args.providerSessionId;
  },
});

export const validateExecutionProviderCleanup = internalQuery({
  args: { ownerId: v.id("users"), executionId: v.id("actionExecutions"), provider: portalBrowserProviderValidator, providerSessionId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    return execution !== null && execution.ownerId === args.ownerId && execution.providerActionId === args.providerSessionId &&
      storedPortalBrowserProvider(execution.browserProvider) === args.provider;
  },
});

const cleanupPurposeValidator = v.union(v.literal("write_proof"), v.literal("profile_proof"), v.literal("recovery"));

export const registerProviderCleanupLease = internalMutation({
  args: {
    ownerId: v.id("users"), connectionId: v.id("portalConnections"), contextId: v.id("browserContexts"),
    provider: portalBrowserProviderValidator, providerSessionId: v.string(), purpose: cleanupPurposeValidator,
    deadlineAt: v.number(),
  },
  returns: v.object({ cleanupId: v.id("providerCleanupLeases"), generation: v.number() }),
  handler: async (ctx, args) => {
    const [connection, context] = await Promise.all([ctx.db.get(args.connectionId), ctx.db.get(args.contextId)]);
    const now = Date.now();
    if (!connection || connection.ownerId !== args.ownerId || storedPortalBrowserProvider(connection.browserProvider) !== args.provider ||
      !context || context.ownerId !== args.ownerId || context.connectionId !== connection._id ||
      storedPortalBrowserProvider(context.browserProvider) !== args.provider || !args.providerSessionId.trim() ||
      !Number.isFinite(args.deadlineAt) || args.deadlineAt <= now || args.deadlineAt > now + PROVIDER_CLEANUP_LEASE_MAX_MS) throw new ConvexError({ code: "PORTAL_PROVIDER_CLEANUP_LEASE_REJECTED" });
    const generation = (context.cleanupGeneration ?? 0) + 1;
    await ctx.db.patch(context._id, { cleanupGeneration: generation, updatedAt: now });
    const cleanupId = await ctx.db.insert("providerCleanupLeases", {
      ownerId: args.ownerId, connectionId: connection._id, contextId: context._id, provider: args.provider,
      providerSessionId: args.providerSessionId, purpose: args.purpose, generation, status: "pending",
      deadlineAt: args.deadlineAt, createdAt: now, updatedAt: now,
    });
    return { cleanupId, generation };
  },
});

export const validateCleanupLease = internalQuery({
  args: { cleanupId: v.id("providerCleanupLeases"), provider: portalBrowserProviderValidator, providerSessionId: v.string(), deadlineAt: v.number() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const lease = await ctx.db.get(args.cleanupId);
    if (!lease || lease.status !== "pending" || lease.provider !== args.provider || lease.providerSessionId !== args.providerSessionId ||
      lease.deadlineAt !== args.deadlineAt || lease.deadlineAt <= Date.now()) return false;
    const context = await ctx.db.get(lease.contextId);
    return context !== null && context.ownerId === lease.ownerId && context.connectionId === lease.connectionId &&
      storedPortalBrowserProvider(context.browserProvider) === lease.provider;
  },
});

export const finishCleanupLease = internalMutation({
  args: { cleanupId: v.id("providerCleanupLeases"), provider: portalBrowserProviderValidator, providerSessionId: v.string(), outcome: v.union(v.literal("completed"), v.literal("exhausted")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const lease = await ctx.db.get(args.cleanupId);
    if (!lease || lease.status !== "pending" || lease.provider !== args.provider || lease.providerSessionId !== args.providerSessionId) return null;
    await ctx.db.patch(lease._id, { status: args.outcome, updatedAt: Date.now() });
    return null;
  },
});

export const touchBrowserbaseHumanRun = internalMutation({
  args: { ownerId: v.id("users"), runId: v.id("browserRuns"), providerSessionId: v.string() },
  returns: v.union(v.object({ expiresAt: v.number(), inactivityDeadlineAt: v.number() }), v.null()),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    const now = Date.now();
    if (!run || run.ownerId !== args.ownerId || storedPortalBrowserProvider(run.browserProvider) !== "browserbase" ||
      run.providerSessionId !== args.providerSessionId || run.status !== "human_required" || run.expiresAt <= now ||
      (run.inactivityDeadlineAt ?? run.expiresAt) <= now || resolvePortalBrowserProvider() !== "browserbase") return null;
    const inactivityDeadlineAt = Math.min(run.expiresAt, now + BROWSERBASE_HUMAN_INACTIVITY_MS);
    await ctx.db.patch(run._id, { inactivityDeadlineAt, updatedAt: now });
    return { expiresAt: run.expiresAt, inactivityDeadlineAt };
  },
});

export const releaseWriteSession = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), executionId: v.id("actionExecutions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (connection?.ownerId === args.ownerId && connection.activeWriteExecutionId === args.executionId) {
      await ctx.db.patch(connection._id, { activeWriteExecutionId: undefined, activeWriteDeadlineAt: undefined, updatedAt: Date.now() });
    }
    return null;
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
      browserProvider: portalBrowserProviderValidator,
      contextStatus: v.optional(v.union(
        v.literal("creating"), v.literal("ready"), v.literal("reauth_required"),
        v.literal("deleting"), v.literal("deleted"), v.literal("failed"),
      )),
      contextProbeAttempts: v.optional(v.number()),
      contextProbeDeadlineAt: v.optional(v.number()),
      contextProbeErrorCode: v.optional(v.string()),
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
    const connectionProvider = storedPortalBrowserProvider(connection.browserProvider);
    const matchingContext = context && storedPortalBrowserProvider(context.browserProvider) === connectionProvider
      ? context
      : null;
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
      browserProvider: connectionProvider,
      contextStatus: matchingContext?.status,
      contextProbeAttempts: matchingContext?.probeAttempts,
      contextProbeDeadlineAt: matchingContext?.probeDeadlineAt,
      contextProbeErrorCode: matchingContext?.probeErrorCode,
      providerContextId:
        matchingContext?.status === "ready" ? matchingContext.providerContextId : undefined,
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
      browserProvider: portalBrowserProviderValidator,
      browserEngine: v.optional(browserEngineValidator),
      kind: runKindValidator,
      status: runStatusValidator,
      expiresAt: v.number(),
      inactivityDeadlineAt: v.optional(v.number()),
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
      browserProvider: storedPortalBrowserProvider(run.browserProvider),
      browserEngine: run.browserEngine,
      kind: run.kind,
      status: run.status,
      expiresAt: run.expiresAt,
      inactivityDeadlineAt: run.inactivityDeadlineAt,
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
    browserEngine: v.optional(browserEngineValidator),
    browserProvider: v.optional(portalBrowserProviderValidator),
    humanRequired: v.boolean(),
  },
  returns: v.object({ contextId: v.optional(v.id("browserContexts")) }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (run === null || run.ownerId !== args.ownerId || run.status !== "queued") {
      throw new ConvexError({ code: "RUN_NOT_RESERVABLE" });
    }
    const now = Date.now();
    const runProvider = storedPortalBrowserProvider(run.browserProvider);
    const requestedProvider = args.browserProvider ?? runProvider;
    if (requestedProvider !== runProvider) {
      throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
    }
    let contextId: Id<"browserContexts"> | undefined;
    if (args.providerContextId) {
      const existing = await ctx.db
        .query("browserContexts")
        .withIndex("by_connection", (q) => q.eq("connectionId", run.connectionId))
        .order("desc")
        .first();
      if (existing) {
        if (storedPortalBrowserProvider(existing.browserProvider) !== requestedProvider) {
          throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_RECONNECT_REQUIRED" });
        }
        contextId = existing._id;
        await ctx.db.patch(existing._id, {
          providerContextId: args.providerContextId,
          browserProvider: requestedProvider,
          status: requestedProvider === "firecrawl" || args.humanRequired ? "creating" : existing.status,
          activeRunId: run._id,
          updatedAt: now,
        });
      } else {
        contextId = await ctx.db.insert("browserContexts", {
          connectionId: run.connectionId,
          ownerId: args.ownerId,
          providerContextId: args.providerContextId,
          browserProvider: requestedProvider,
          status: requestedProvider === "firecrawl" || args.humanRequired ? "creating" : "ready",
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
      browserProvider: requestedProvider,
      browserEngine: requestedProvider === "firecrawl" ? "firecrawl" : args.browserEngine ?? "legacy",
      status,
      startedAt: now,
      inactivityDeadlineAt: requestedProvider === "browserbase" && args.humanRequired
        ? Math.min(run.expiresAt, now + BROWSERBASE_HUMAN_INACTIVITY_MS)
        : undefined,
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
    const context = run.contextId ? await ctx.db.get(run.contextId) : null;
    const runProvider = storedPortalBrowserProvider(run.browserProvider);
    const contextMatchesRun = context !== null && storedPortalBrowserProvider(context.browserProvider) === runProvider;
    const firecrawlProbeVerified = context?.lastVerifiedAt !== undefined &&
      context.lastVerifiedAt >= (run.startedAt ?? run.createdAt);
    const contextReady = args.contextReady === true && contextMatchesRun &&
      (runProvider === "browserbase" ||
        firecrawlProbeVerified);
    const firecrawlAuthenticationMissingProof = runProvider === "firecrawl" && run.kind === "authenticate" &&
      args.status === "completed" && !contextReady;
    const terminalStatus = firecrawlAuthenticationMissingProof ? "failed" as const : args.status;
    const terminalErrorCode = firecrawlAuthenticationMissingProof
      ? "CONTEXT_PROFILE_NOT_READY"
      : args.errorCode?.slice(0, 100);
    const reauthRequired = args.reauthRequired === true || firecrawlAuthenticationMissingProof;
    await ctx.db.patch(run._id, {
      status: terminalStatus,
      resultCount: args.resultCount,
      errorCode: terminalErrorCode,
      endedAt: now,
      onboardingStage:
        run.onboardingStage === undefined
          ? undefined
          : terminalStatus === "completed"
            ? "completed"
            : "failed",
      updatedAt: now,
    });
    await ctx.db.insert("browserRunEvents", {
      runId: run._id,
      ownerId: run.ownerId,
      kind: terminalStatus === "completed" ? "completed" : terminalStatus === "stopped" ? "stopped" : "failed",
      message: terminalErrorCode,
      createdAt: now,
    });
    if (context && contextMatchesRun) {
      await ctx.db.patch(context._id, {
        status: contextReady
          ? "ready"
          : reauthRequired
            ? "reauth_required"
            : "ready",
        activeRunId: undefined,
        lastVerifiedAt: contextReady ? context.lastVerifiedAt ?? now : context.lastVerifiedAt,
        updatedAt: now,
      });
    }
    if (connection !== null) {
      const failureCount = terminalStatus === "failed" ? connection.failureCount + 1 : 0;
      const failureBackoffMs = Math.min(
        connection.pollIntervalMinutes * 60_000,
        5 * 60_000 * 2 ** Math.min(Math.max(failureCount - 1, 0), 4),
      );
      await ctx.db.patch(connection._id, {
        status:
          contextReady
            ? "active"
            : reauthRequired
              ? "reauth_required"
              : connection.status,
        failureCount,
        circuitOpenUntil: undefined,
        lastSuccessAt: terminalStatus === "completed" ? now : connection.lastSuccessAt,
        lastErrorCode: terminalStatus === "failed" ? terminalErrorCode : undefined,
        nextPollAt:
          terminalStatus === "completed" && connection.allowInboxPolling
            ? now + connection.pollIntervalMinutes * 60_000
            : terminalStatus === "failed" && connection.allowInboxPolling && !reauthRequired
              ? now + failureBackoffMs
              : undefined,
        updatedAt: now,
      });
    }
    if (terminalStatus === "completed" && contextReady) {
      await ctx.scheduler.runAfter(0, internal.mandateOrchestrator.runForOwner, {
        ownerId: run.ownerId,
      });
    }
    return null;
  },
});

export const recordContextProbeResult = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    contextId: v.id("browserContexts"),
    runId: v.id("browserRuns"),
    browserProvider: portalBrowserProviderValidator,
    success: v.boolean(),
    errorCode: v.optional(v.string()),
    attempt: v.number(),
    deadlineAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [connection, context, run] = await Promise.all([
      ctx.db.get(args.connectionId), ctx.db.get(args.contextId), ctx.db.get(args.runId),
    ]);
    if (!connection || !context || !run || connection.ownerId !== args.ownerId ||
      context.ownerId !== args.ownerId || run.ownerId !== args.ownerId ||
      context.connectionId !== connection._id || run.connectionId !== connection._id ||
      run.contextId !== context._id || storedPortalBrowserProvider(connection.browserProvider) !== args.browserProvider ||
      storedPortalBrowserProvider(context.browserProvider) !== args.browserProvider ||
      storedPortalBrowserProvider(run.browserProvider) !== args.browserProvider) {
      throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
    }
    if (!Number.isInteger(args.attempt) || args.attempt < 1 || args.attempt < (context.probeAttempts ?? 0)) {
      throw new ConvexError({ code: "INVALID_CONTEXT_PROBE_ATTEMPT" });
    }
    const now = Date.now();
    const exhausted = !args.success && args.deadlineAt !== undefined && args.deadlineAt <= now;
    await ctx.db.patch(context._id, {
      status: args.success ? "creating" : exhausted ? "failed" : "creating",
      probeAttempts: args.attempt,
      probeDeadlineAt: args.deadlineAt ?? context.probeDeadlineAt,
      probeLastAttemptAt: now,
      probeErrorCode: args.success ? undefined : args.errorCode?.slice(0, 100) ?? "CONTEXT_PROBE_FAILED",
      lastVerifiedAt: args.success ? now : context.lastVerifiedAt,
      updatedAt: now,
    });
    if (exhausted) {
      await ctx.db.patch(connection._id, {
        lastErrorCode: args.errorCode?.slice(0, 100) ?? "CONTEXT_PROFILE_NOT_READY",
        updatedAt: now,
      });
    }
    return null;
  },
});

export const markContextPendingAfterWrite = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    executionId: v.id("actionExecutions"),
    browserProvider: v.literal("firecrawl"),
  },
  returns: v.object({
    contextId: v.id("browserContexts"),
    profileName: v.string(),
    generation: v.number(),
  }),
  handler: async (ctx, args) => {
    if (resolvePortalBrowserProvider() !== args.browserProvider) {
      throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
    }
    const [connection, execution, context] = await Promise.all([
      ctx.db.get(args.connectionId),
      ctx.db.get(args.executionId),
      ctx.db.query("browserContexts").withIndex("by_connection", (q) =>
        q.eq("connectionId", args.connectionId),
      ).order("desc").first(),
    ]);
    if (!connection || !execution || !context || connection.ownerId !== args.ownerId ||
      execution.ownerId !== args.ownerId || execution.connectionId !== connection._id ||
      context.ownerId !== args.ownerId || context.connectionId !== connection._id ||
      connection.activeWriteExecutionId !== execution._id ||
      (connection.activeWriteDeadlineAt ?? 0) <= Date.now() ||
      !["claimed", "running"].includes(execution.status) || context.status !== "ready" ||
      storedPortalBrowserProvider(connection.browserProvider) !== args.browserProvider ||
      storedPortalBrowserProvider(context.browserProvider) !== args.browserProvider ||
      storedPortalBrowserProvider(execution.browserProvider) !== args.browserProvider) {
      throw new ConvexError({ code: "PORTAL_WRITE_CONTEXT_NOT_CLAIMED" });
    }
    const generation = (context.writeProofGeneration ?? 0) + 1;
    await ctx.db.patch(context._id, {
      status: "creating",
      writeProofGeneration: generation,
      pendingWriteExecutionId: execution._id,
      probeAttempts: 0,
      probeDeadlineAt: undefined,
      probeLastAttemptAt: undefined,
      probeErrorCode: undefined,
      updatedAt: Date.now(),
    });
    return { contextId: context._id, profileName: context.providerContextId, generation };
  },
});

export const recordWriteContextProbe = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    contextId: v.id("browserContexts"),
    executionId: v.id("actionExecutions"),
    browserProvider: v.literal("firecrawl"),
    generation: v.number(),
    success: v.boolean(),
    errorCode: v.optional(v.string()),
    attempt: v.number(),
    deadlineAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [connection, context, execution] = await Promise.all([
      ctx.db.get(args.connectionId), ctx.db.get(args.contextId), ctx.db.get(args.executionId),
    ]);
    if (!connection || !context || !execution || connection.ownerId !== args.ownerId ||
      context.ownerId !== args.ownerId || execution.ownerId !== args.ownerId ||
      context.connectionId !== connection._id || execution.connectionId !== connection._id ||
      context.pendingWriteExecutionId !== execution._id || context.writeProofGeneration !== args.generation ||
      storedPortalBrowserProvider(connection.browserProvider) !== args.browserProvider ||
      storedPortalBrowserProvider(context.browserProvider) !== args.browserProvider ||
      storedPortalBrowserProvider(execution.browserProvider) !== args.browserProvider) {
      throw new ConvexError({ code: "PORTAL_WRITE_PROBE_STALE" });
    }
    if (!Number.isInteger(args.attempt) || args.attempt < 1 || args.attempt < (context.probeAttempts ?? 0)) {
      throw new ConvexError({ code: "INVALID_CONTEXT_PROBE_ATTEMPT" });
    }
    const now = Date.now();
    const exhausted = !args.success && args.deadlineAt !== undefined && args.deadlineAt <= now;
    await ctx.db.patch(context._id, {
      status: args.success ? "ready" : exhausted ? "failed" : "creating",
      pendingWriteExecutionId: args.success || exhausted ? undefined : execution._id,
      lastVerifiedAt: args.success ? now : context.lastVerifiedAt,
      probeAttempts: args.attempt,
      probeDeadlineAt: args.deadlineAt ?? context.probeDeadlineAt,
      probeLastAttemptAt: now,
      probeErrorCode: args.success ? undefined : args.errorCode?.slice(0, 100) ?? "CONTEXT_PROFILE_NOT_READY",
      updatedAt: now,
    });
    if (!args.success) {
      await ctx.db.patch(connection._id, {
        status: exhausted ? "reauth_required" : connection.status,
        lastErrorCode: args.errorCode?.slice(0, 100) ?? "CONTEXT_PROFILE_NOT_READY",
        nextPollAt: undefined,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const validatePendingWriteProfileProof = internalQuery({
  args: {
    ownerId: v.id("users"), connectionId: v.id("portalConnections"), contextId: v.id("browserContexts"),
    executionId: v.id("actionExecutions"), generation: v.number(), browserProvider: v.literal("firecrawl"),
  },
  returns: v.union(v.object({ profileName: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const maintenance = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", "controlled_portal")).unique();
    if (maintenance?.paused || resolvePortalBrowserProvider() !== args.browserProvider) return null;
    const [connection, context, execution] = await Promise.all([
      ctx.db.get(args.connectionId), ctx.db.get(args.contextId), ctx.db.get(args.executionId),
    ]);
    if (!connection || connection.ownerId !== args.ownerId || connection.browserProvider !== args.browserProvider ||
      !context || context.ownerId !== args.ownerId || context.connectionId !== connection._id || context.browserProvider !== args.browserProvider ||
      context.status !== "creating" || context.pendingWriteExecutionId !== execution?._id || context.writeProofGeneration !== args.generation ||
      !execution || execution.ownerId !== args.ownerId || execution.connectionId !== connection._id || execution.browserProvider !== args.browserProvider) return null;
    return { profileName: context.providerContextId };
  },
});

export const prepareProfileRecovery = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), browserProvider: v.literal("firecrawl") },
  returns: v.object({ contextId: v.id("browserContexts"), profileName: v.string(), generation: v.number(), baseUrl: v.string(), adapterKey: v.string(), latestVerificationEmailId: v.optional(v.id("mailboxMessages")), latestVerificationMailboxId: v.optional(v.id("userMailboxes")), latestVerificationRequestedAt: v.optional(v.number()) }),
  handler: async (ctx, args) => {
    const maintenance = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", "controlled_portal")).unique();
    if (maintenance?.paused || resolvePortalBrowserProvider() !== args.browserProvider) throw new ConvexError({ code: "PORTAL_PROFILE_RECOVERY_NOT_AVAILABLE" });
    const connection = await ctx.db.get(args.connectionId);
    const source = connection ? await ctx.db.get(connection.sourceId) : null;
    const context = connection ? await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).order("desc").first() : null;
    if (!connection || connection.ownerId !== args.ownerId || connection.browserProvider !== args.browserProvider || !source || !connection.adapterKey ||
      !context || context.ownerId !== args.ownerId || context.browserProvider !== args.browserProvider || !["creating", "failed", "reauth_required"].includes(context.status) ||
      (connection.activeWriteExecutionId && (connection.activeWriteDeadlineAt ?? 0) > Date.now()) ||
      (connection.inboxSyncActiveGeneration !== undefined && (connection.inboxSyncDeadlineAt ?? 0) > Date.now())) throw new ConvexError({ code: "PORTAL_PROFILE_RECOVERY_NOT_AVAILABLE" });
    const recentRuns = await ctx.db.query("browserRuns").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).order("desc").take(20);
    if (recentRuns.some((run) => ["queued", "running", "human_required"].includes(run.status))) throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
    const latest = recentRuns.find((run) => run.kind === "authenticate");
    const generation = (context.recoveryGeneration ?? 0) + 1;
    const now = Date.now();
    await ctx.db.patch(context._id, { status: "creating", recoveryGeneration: generation, recoveryOutcome: undefined, probeErrorCode: undefined, updatedAt: now });
    return { contextId: context._id, profileName: context.providerContextId, generation, baseUrl: source.baseUrl, adapterKey: connection.adapterKey, latestVerificationEmailId: latest?.verificationMessageId, latestVerificationMailboxId: latest?.onboardingMailboxId, latestVerificationRequestedAt: latest?.verificationRequestedAt };
  },
});

export const recordProfileRecoveryProbe = internalMutation({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), contextId: v.id("browserContexts"), browserProvider: v.literal("firecrawl"), generation: v.number(), outcome: v.union(v.literal("ready"), v.literal("awaiting_verification"), v.literal("auth_needed"), v.literal("review")), errorCode: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [connection, context] = await Promise.all([ctx.db.get(args.connectionId), ctx.db.get(args.contextId)]);
    if (!connection || connection.ownerId !== args.ownerId || connection.browserProvider !== args.browserProvider || !context || context.connectionId !== connection._id || context.ownerId !== args.ownerId || context.browserProvider !== args.browserProvider || context.recoveryGeneration !== args.generation || context.status !== "creating") throw new ConvexError({ code: "PORTAL_PROFILE_RECOVERY_STALE" });
    const now = Date.now();
    if (args.outcome === "ready") {
      await ctx.db.patch(context._id, { status: "ready", recoveryOutcome: undefined, probeErrorCode: undefined, lastVerifiedAt: now, updatedAt: now });
      await ctx.db.patch(connection._id, { status: "active", lastErrorCode: undefined, lastSuccessAt: now, updatedAt: now });
    } else {
      await ctx.db.patch(context._id, { status: args.outcome === "awaiting_verification" ? "creating" : args.outcome === "auth_needed" ? "reauth_required" : "failed", recoveryOutcome: args.outcome, probeErrorCode: args.errorCode?.slice(0, 100), updatedAt: now });
      await ctx.db.patch(connection._id, { status: args.outcome === "awaiting_verification" ? "needs_auth" : "reauth_required", lastErrorCode: args.errorCode?.slice(0, 100), updatedAt: now });
    }
    return null;
  },
});

export const failReservedRun = internalMutation({
  args: { runId: v.id("browserRuns"), errorCode: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.status !== "queued") return null;
    const now = Date.now();
    const errorCode = args.errorCode.slice(0, 100);
    await ctx.db.patch(run._id, { status: "failed", errorCode, endedAt: now, updatedAt: now });
    await ctx.db.insert("browserRunEvents", {
      runId: run._id, ownerId: run.ownerId, kind: "failed", message: errorCode, createdAt: now,
    });
    return null;
  },
});

/** Narrow operator recovery for a controlled registration whose provider
 * context disappeared after a failed run. This never activates the connection;
 * it only permits the already-authorized onboarding flow to retry cleanly. */
export const resetControlledRegistrationFailure = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    confirmation: v.literal("RESET_CONTROLLED_REGISTRATION_FAILURE"),
  },
  returns: v.object({ contextInvalidated: v.boolean() }),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    const source = connection ? await ctx.db.get(connection.sourceId) : null;
    let sourceUrl: URL | null;
    try {
      sourceUrl = source ? new URL(source.baseUrl) : null;
    } catch {
      sourceUrl = null;
    }
    if (
      !connection ||
      connection.ownerId !== args.ownerId ||
      connection.status !== "needs_auth" ||
      connection.policyDecision !== "allowed" ||
      connection.adapterKey !== "roomscout-dev-v1" ||
      !source ||
      source.slug !== "roomscout-dev-connected" ||
      sourceUrl?.protocol !== "https:" ||
      sourceUrl.hostname !== "roomscout.dev" ||
      sourceUrl.port !== "" ||
      (sourceUrl.pathname !== "/" && sourceUrl.pathname !== "") ||
      source.adapterKey !== "roomscout-dev-v1"
    ) {
      throw new ConvexError({ code: "CONTROLLED_REGISTRATION_RECOVERY_REJECTED" });
    }
    const runs = await ctx.db
      .query("browserRuns")
      .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
      .order("desc")
      .take(20);
    if (runs.some((run) => ["queued", "running", "human_required"].includes(run.status))) {
      throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
    }
    const context = await ctx.db
      .query("browserContexts")
      .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
      .order("desc")
      .first();
    const now = Date.now();
    if (context && context.status !== "deleted") {
      await ctx.db.patch(context._id, {
        status: "failed",
        activeRunId: undefined,
        updatedAt: now,
      });
    }
    await ctx.db.patch(connection._id, {
      failureCount: 0,
      circuitOpenUntil: undefined,
      lastErrorCode: undefined,
      nextPollAt: undefined,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      eventKey: `connection:${connection._id}:controlled_registration_recovery:${now}`,
      actorType: "system",
      actorUserId: args.ownerId,
      entityKey: `connection:${connection._id}`,
      eventType: "portal.controlled_registration_recovered",
      summary: "Cleared failed controlled registration state for a clean retry",
      occurredAt: now,
    });
    return { contextInvalidated: Boolean(context && context.status !== "deleted") };
  },
});

/** Explicit owner-initiated recovery for failed browser startup only. It never
 * registers or sends, and same-connection live work still blocks recovery. */
export const recoverFailedRegistration = mutation({
  args: { connectionId: v.id("portalConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (!connection || connection.ownerId !== ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    const source = await ctx.db.get(connection.sourceId);
    if (!source || source.status !== "active" || source.automationReview !== "approved" ||
      source.accessMode !== "authenticated") {
      throw new ConvexError({ code: "REGISTRATION_RECOVERY_NOT_AVAILABLE" });
    }
    const latest = await ctx.db.query("browserRuns")
      .withIndex("by_connection", (q) => q.eq("connectionId", args.connectionId))
      .order("desc").first();
    if (!latest || latest.ownerId !== ownerId || latest.kind !== "authenticate" ||
      latest.status !== "failed" || latest.providerSessionId ||
      !(latest.errorCode?.startsWith("AGENT_REGISTRATION_BROWSER_LAUNCH_") ||
        latest.errorCode?.startsWith("AGENT_REGISTRATION_CONTEXT_CREATE_")) ||
      (connection.activeWriteExecutionId && (connection.activeWriteDeadlineAt ?? 0) > Date.now()) ||
      (connection.inboxSyncActiveGeneration !== undefined && (connection.inboxSyncDeadlineAt ?? 0) > Date.now())) {
      throw new ConvexError({ code: "REGISTRATION_RECOVERY_NOT_AVAILABLE" });
    }
    // The shared operator helper independently checks the exact reviewed source,
    // ownership, needs_auth state and absence of live runs in this transaction.
    await ctx.runMutation(internal.portalConnections.resetControlledRegistrationFailure, {
      ownerId, connectionId: connection._id,
      confirmation: "RESET_CONTROLLED_REGISTRATION_FAILURE",
    });
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
      browserProvider: portalBrowserProviderValidator,
      status: v.union(
        v.literal("creating"), v.literal("ready"), v.literal("reauth_required"),
        v.literal("deleting"), v.literal("deleted"), v.literal("failed"),
      ),
      probeAttempts: v.optional(v.number()),
      probeDeadlineAt: v.optional(v.number()),
      probeErrorCode: v.optional(v.string()),
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
    return {
      contextId: context._id,
      providerContextId: context.providerContextId,
      browserProvider: storedPortalBrowserProvider(context.browserProvider),
      status: context.status,
      probeAttempts: context.probeAttempts,
      probeDeadlineAt: context.probeDeadlineAt,
      probeErrorCode: context.probeErrorCode,
    };
  },
});

export const listDueInboxSyncs = internalQuery({
  args: { now: v.number(), cursor: v.union(v.string(), v.null()), limit: v.number() },
  returns: v.object({
    rows: v.array(v.object({
      ownerId: v.id("users"),
      connectionId: v.id("portalConnections"),
    })),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit)));
    const page = await ctx.db
      .query("portalConnections")
      .withIndex("by_status_and_next_poll_at", (q) =>
        q.eq("status", "active").lte("nextPollAt", args.now),
      )
      .paginate({ cursor: args.cursor, numItems: limit });
    const rows = page.page
      .filter(
        (connection) =>
          connection.policyDecision === "allowed" &&
          connection.allowInboxPolling,
      )
      .map((connection) => ({ ownerId: connection.ownerId, connectionId: connection._id }));
    return { rows, continueCursor: page.continueCursor, isDone: page.isDone };
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
