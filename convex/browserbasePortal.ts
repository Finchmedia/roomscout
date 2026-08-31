"use node";

import { Browserbase } from "@browserbasehq/sdk";
import { browserbase, type StagehandBrowser } from "@browserbasehq/stagehand";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import {
  buildAllowedPortalUrl,
  isAllowedHostname,
  PORTAL_RUN_TTLS_MS,
  sanitizeInboxThreads,
  sanitizeProviderError,
  sanitizeReconItems,
  type SafeInboxThread,
} from "./integrations/portalSafety";
import {
  PORTAL_WRITE_TTL_MS,
  buildPortalWriteUrl,
  inspectPortalWriteSuccess,
  resolvePortalWriteWorkflow,
  runDeterministicPortalWrite,
  type PortalHumanBlocker,
  type PortalWriteActionType,
  type PortalWritePayload,
} from "./integrations/portalWriteAdapters";
import { roomScoutRateLimiter } from "./rateLimits";

const reconItemValidator = v.object({ title: v.string(), url: v.string() });

type WorkerConnection = {
  connectionId: Id<"portalConnections">;
  sourceId: Id<"sources">;
  platformId?: Id<"sourcePlatforms">;
  baseUrl: string;
  allowedDomains: string[];
  allowedPaths: string[];
  inboxPath?: string;
  adapterKey?: string;
  accessMode: "public" | "authenticated";
  allowReadOnlyRecon: boolean;
  allowInboxPolling: boolean;
  providerContextId?: string;
};

const writeStatusValidator = v.union(
  v.literal("succeeded"),
  v.literal("human_required"),
  v.literal("unknown"),
  v.literal("in_progress"),
);

const humanBlockerValidator = v.union(
  v.literal("password"),
  v.literal("two_factor"),
  v.literal("captcha"),
  v.literal("terms"),
  v.literal("payment"),
  v.literal("contract"),
  v.literal("policy_human_presence"),
);

const writeResultValidator = v.object({
  executionId: v.id("actionExecutions"),
  status: writeStatusValidator,
  blocker: v.optional(humanBlockerValidator),
  alreadyCompleted: v.boolean(),
});

type ApprovedWriteResult = {
  executionId: Id<"actionExecutions">;
  status: "succeeded" | "human_required" | "unknown" | "in_progress";
  blocker?: PortalHumanBlocker;
  alreadyCompleted: boolean;
};

type ClaimedBrowserAction = {
  executionId: Id<"actionExecutions">;
  executionStatus: "claimed" | "running" | "succeeded" | "failed" | "unknown";
  alreadyClaimed: boolean;
  requestedActionType:
    | "send_email"
    | "submit_webform"
    | "send_platform_dm"
    | "create_portal_account"
    | "publish_listing"
    | "share_contact_details"
    | "propose_visit_time";
  payload:
    | PortalWritePayload & { threadId?: Id<"platformThreads"> }
    | { kind: "contact_form"; targetUrl: string; fields: unknown[] }
    | { kind: "portal_account_operation"; connectionId: Id<"portalConnections">; operation: string; accountLabel?: string }
    | { kind: "email_message"; recipientName: string; recipientEmail: string; subject: string; body: string };
  platformId: Id<"sourcePlatforms">;
  platformDomain: string;
  connectionId?: Id<"portalConnections">;
  bindingId: Id<"sourceAdapterBindings">;
  adapterKey: string;
  adapterVersion: number;
  adapterConfig:
    | { kind: "browserbase"; workflowKey: string; contextRequired: boolean }
    | { kind: "firecrawl"; extractionProfileKey: string; monitorDriven: boolean }
    | { kind: "agentmail"; purpose: "outreach" | "reply" }
    | { kind: "direct_api"; integrationKey: string }
    | { kind: "manual"; instructionKey: string };
  humanPresenceRequired: boolean;
};

function browserbaseApiKey(): string {
  const apiKey = envValue("BROWSERBASE_API_KEY");
  if (!apiKey) throw new ConvexError({ code: "BROWSERBASE_NOT_CONFIGURED" });
  return apiKey;
}

function createBrowserbaseClient(apiKey: string): Browserbase {
  return new Browserbase({ apiKey, maxRetries: 0, timeout: 30_000 });
}

async function getWorkerConnection(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  connectionId: Id<"portalConnections">,
): Promise<WorkerConnection> {
  const connection: WorkerConnection | null = await ctx.runQuery(
    internal.portalConnections.getConnectionForWorker,
    { ownerId, connectionId },
  );
  if (connection === null) {
    throw new ConvexError({ code: "PORTAL_CONNECTION_NOT_READY" });
  }
  return connection;
}

async function applySessionLimits(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  connectionId: Id<"portalConnections">,
  kind: "recon" | "authenticate" | "inbox_sync",
): Promise<void> {
  if (kind === "recon") {
    await roomScoutRateLimiter.limit(ctx, "portalReconUser", {
      key: ownerId,
      throws: true,
    });
    await roomScoutRateLimiter.limit(ctx, "portalReconSource", {
      key: connectionId,
      throws: true,
    });
  } else if (kind === "authenticate") {
    await roomScoutRateLimiter.limit(ctx, "portalAuthSource", {
      key: connectionId,
      throws: true,
    });
  } else {
    await roomScoutRateLimiter.limit(ctx, "portalInboxSource", {
      key: connectionId,
      throws: true,
    });
  }
  await roomScoutRateLimiter.limit(ctx, "portalSessionGlobal", {
    key: "browserbase",
    throws: true,
  });
}

async function reserveRun(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  connectionId: Id<"portalConnections">,
  kind: "recon" | "authenticate" | "inbox_sync",
): Promise<Id<"browserRuns">> {
  await applySessionLimits(ctx, ownerId, connectionId, kind);
  return await ctx.runMutation(internal.portalConnections.reserveRun, {
    ownerId,
    connectionId,
    kind,
  });
}

async function releaseProviderSession(
  client: Browserbase,
  providerSessionId: string | undefined,
): Promise<void> {
  if (!providerSessionId) return;
  try {
    await client.sessions.update(providerSessionId, { status: "REQUEST_RELEASE" });
  } catch {
    // The local run still needs to close even when Browserbase already expired it.
  }
}

function assertFinalDomain(url: string, allowedDomains: readonly string[]): void {
  const finalUrl = new URL(url);
  if (finalUrl.protocol !== "https:" || !isAllowedHostname(finalUrl.hostname, allowedDomains)) {
    throw new Error("DOMAIN_NOT_ALLOWED");
  }
}

async function launchReadOnlyBrowser(input: {
  apiKey: string;
  allowedDomains: string[];
  providerContextId?: string;
  timeoutMs: number;
}): Promise<StagehandBrowser> {
  return await browserbase.launch({
    apiKey: input.apiKey,
    api_timeout: Math.max(60, Math.ceil(input.timeoutMs / 1_000)),
    keepAlive: false,
    region: "eu-central-1",
    proxies: [{ type: "none" }],
    browserSettings: {
      allowedDomains: input.allowedDomains,
      solveCaptchas: false,
      recordSession: false,
      logSession: false,
      context: input.providerContextId
        ? { id: input.providerContextId, persist: false }
        : undefined,
    },
    userMetadata: { product: "roomscout", mode: "read_only" },
  });
}

async function launchWriteBrowser(input: {
  apiKey: string;
  allowedDomains: string[];
  providerContextId?: string;
}): Promise<StagehandBrowser> {
  return await browserbase.launch({
    apiKey: input.apiKey,
    api_timeout: Math.ceil(PORTAL_WRITE_TTL_MS / 1_000),
    keepAlive: true,
    region: "eu-central-1",
    proxies: [{ type: "none" }],
    browserSettings: {
      allowedDomains: input.allowedDomains,
      solveCaptchas: false,
      recordSession: false,
      logSession: false,
      context: input.providerContextId
        ? { id: input.providerContextId, persist: true }
        : undefined,
    },
    userMetadata: { product: "roomscout", mode: "approved_write" },
  });
}

export const runRecon = action({
  args: { connectionId: v.id("portalConnections"), path: v.optional(v.string()) },
  returns: v.object({
    runId: v.id("browserRuns"),
    items: v.array(reconItemValidator),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const connection = await getWorkerConnection(ctx, ownerId, args.connectionId);
    if (!connection.allowReadOnlyRecon) {
      throw new ConvexError({ code: "RECON_NOT_ALLOWED" });
    }
    const targetUrl = buildAllowedPortalUrl({
      baseUrl: connection.baseUrl,
      path: args.path ?? connection.allowedPaths[0] ?? "/",
      allowedDomains: connection.allowedDomains,
      allowedPaths: connection.allowedPaths,
    });
    const runId = await reserveRun(ctx, ownerId, connection.connectionId, "recon");
    let browser: StagehandBrowser | undefined;
    try {
      browser = await launchReadOnlyBrowser({
        apiKey: browserbaseApiKey(),
        allowedDomains: connection.allowedDomains,
        providerContextId: connection.providerContextId,
        timeoutMs: PORTAL_RUN_TTLS_MS.recon,
      });
      if (!browser.sessionId) throw new Error("PROVIDER_SESSION_MISSING");
      await ctx.runMutation(internal.portalConnections.attachProviderRun, {
        runId,
        ownerId,
        providerSessionId: browser.sessionId,
        providerContextId: connection.providerContextId,
        humanRequired: false,
      });
      const pages = await browser.context.pages();
      const page = pages[0] ?? (await browser.context.newPage());
      await page.goto(targetUrl);
      await page.waitForLoadState("domcontentloaded", 20_000);
      assertFinalDomain(await page.url(), connection.allowedDomains);
      const rawItems: unknown = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
          .slice(0, 100)
          .map((anchor) => ({
            title: anchor.textContent ?? "",
            url: anchor.href,
          })),
      );
      const items = sanitizeReconItems(rawItems, connection.allowedDomains);
      await ctx.runMutation(internal.portalConnections.finishRun, {
        runId,
        status: "completed",
        resultCount: items.length,
      });
      return { runId, items };
    } catch (error) {
      await ctx.runMutation(internal.portalConnections.finishRun, {
        runId,
        status: "failed",
        errorCode: sanitizeProviderError(error),
      });
      throw new ConvexError({ code: sanitizeProviderError(error) });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // Browserbase enforces the server-side TTL as the final cleanup boundary.
        }
      }
    }
  },
});

export const startAuthentication = action({
  args: { connectionId: v.id("portalConnections") },
  returns: v.object({
    runId: v.id("browserRuns"),
    status: v.literal("human_required"),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const connection = await getWorkerConnection(ctx, ownerId, args.connectionId);
    if (connection.accessMode !== "authenticated") {
      throw new ConvexError({ code: "AUTHENTICATED_SOURCE_REQUIRED" });
    }
    const runId = await reserveRun(ctx, ownerId, connection.connectionId, "authenticate");
    const apiKey = browserbaseApiKey();
    const client = createBrowserbaseClient(apiKey);
    let providerContextId = connection.providerContextId;
    let createdContext = false;
    let providerSessionId: string | undefined;
    try {
      if (!providerContextId) {
        const context = await client.contexts.create({ name: `roomscout-${runId}` });
        providerContextId = context.id;
        createdContext = true;
      }
      const session = await client.sessions.create({
        api_timeout: Math.ceil(PORTAL_RUN_TTLS_MS.authenticate / 1_000),
        keepAlive: true,
        region: "eu-central-1",
        proxies: [{ type: "none" }],
        browserSettings: {
          allowedDomains: connection.allowedDomains,
          solveCaptchas: false,
          recordSession: false,
          logSession: false,
          context: { id: providerContextId, persist: true },
        },
        userMetadata: { product: "roomscout", mode: "human_auth" },
      });
      providerSessionId = session.id;
      await ctx.runMutation(internal.portalConnections.attachProviderRun, {
        runId,
        ownerId,
        providerSessionId,
        providerContextId,
        humanRequired: true,
      });
      return { runId, status: "human_required" as const };
    } catch (error) {
      await releaseProviderSession(client, providerSessionId);
      if (createdContext && providerContextId) {
        try {
          await client.contexts.delete(providerContextId);
        } catch {
          // Do not leak provider details; orphan cleanup can be performed in Browserbase.
        }
      }
      await ctx.runMutation(internal.portalConnections.finishRun, {
        runId,
        status: "failed",
        errorCode: sanitizeProviderError(error),
      });
      throw new ConvexError({ code: sanitizeProviderError(error) });
    }
  },
});

export const getLiveView = action({
  args: { runId: v.id("browserRuns") },
  returns: v.object({ url: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args): Promise<{ url: string; expiresAt: number }> => {
    const ownerId = await requireActionUserId(ctx);
    const run = await ctx.runQuery(internal.portalConnections.getRunForOwner, {
      ownerId,
      runId: args.runId,
    });
    if (
      run === null ||
      run.kind !== "authenticate" ||
      run.status !== "human_required" ||
      !run.providerSessionId ||
      run.expiresAt <= Date.now()
    ) {
      throw new ConvexError({ code: "LIVE_VIEW_NOT_AVAILABLE" });
    }
    const ttlSeconds = Math.max(
      1,
      Math.min(60, Math.floor((run.expiresAt - Date.now()) / 1_000)),
    );
    const links: { debuggerFullscreenUrl: string } = await createBrowserbaseClient(
      browserbaseApiKey(),
    ).sessions.debug(
      run.providerSessionId,
      { expiresIn: ttlSeconds },
    );
    return {
      url: links.debuggerFullscreenUrl,
      expiresAt: Date.now() + ttlSeconds * 1_000,
    };
  },
});

export const resumeAuthentication = action({
  args: { runId: v.id("browserRuns") },
  returns: v.object({ status: v.literal("completed") }),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const run = await ctx.runQuery(internal.portalConnections.getRunForOwner, {
      ownerId,
      runId: args.runId,
    });
    if (
      run === null ||
      run.kind !== "authenticate" ||
      run.status !== "human_required" ||
      !run.providerSessionId ||
      run.expiresAt <= Date.now()
    ) {
      throw new ConvexError({ code: "AUTH_RUN_NOT_RESUMABLE" });
    }
    const client = createBrowserbaseClient(browserbaseApiKey());
    const session = await client.sessions.retrieve(run.providerSessionId);
    if (session.status !== "RUNNING") {
      await ctx.runMutation(internal.portalConnections.finishRun, {
        runId: run.runId,
        status: "failed",
        errorCode: "AUTH_SESSION_ENDED",
        reauthRequired: true,
      });
      throw new ConvexError({ code: "AUTH_SESSION_ENDED" });
    }
    await ctx.runMutation(internal.portalConnections.markRunResumed, {
      ownerId,
      runId: run.runId,
    });
    await releaseProviderSession(client, run.providerSessionId);
    await ctx.runMutation(internal.portalConnections.finishRun, {
      runId: run.runId,
      status: "completed",
      resultCount: 0,
      contextReady: true,
    });
    return { status: "completed" as const };
  },
});

export const stopRun = action({
  args: { runId: v.id("browserRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const run = await ctx.runQuery(internal.portalConnections.getRunForOwner, {
      ownerId,
      runId: args.runId,
    });
    if (run === null) throw new ConvexError({ code: "RUN_NOT_FOUND" });
    if (run.providerSessionId) {
      await releaseProviderSession(
        createBrowserbaseClient(browserbaseApiKey()),
        run.providerSessionId,
      );
    }
    await ctx.runMutation(internal.portalConnections.finishRun, {
      runId: run.runId,
      status: "stopped",
    });
    return null;
  },
});

async function syncInboxForOwner(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  connectionId: Id<"portalConnections">,
): Promise<{ runId: Id<"browserRuns">; threadsCreated: number; messagesCreated: number }> {
  const connection = await getWorkerConnection(ctx, ownerId, connectionId);
  if (!connection.allowInboxPolling || !connection.inboxPath) {
    throw new ConvexError({ code: "INBOX_POLLING_NOT_ALLOWED" });
  }
  if (!connection.providerContextId) {
    throw new ConvexError({ code: "PORTAL_REAUTH_REQUIRED" });
  }
  if (connection.adapterKey !== "roomscout-fixture-v1") {
    throw new ConvexError({ code: "INBOX_ADAPTER_REVIEW_REQUIRED" });
  }
  const targetUrl = buildAllowedPortalUrl({
    baseUrl: connection.baseUrl,
    path: connection.inboxPath,
    allowedDomains: connection.allowedDomains,
    allowedPaths: connection.allowedPaths,
  });
  const runId = await reserveRun(ctx, ownerId, connectionId, "inbox_sync");
  let browser: StagehandBrowser | undefined;
  try {
    browser = await launchReadOnlyBrowser({
      apiKey: browserbaseApiKey(),
      allowedDomains: connection.allowedDomains,
      providerContextId: connection.providerContextId,
      timeoutMs: PORTAL_RUN_TTLS_MS.inbox_sync,
    });
    if (!browser.sessionId) throw new Error("PROVIDER_SESSION_MISSING");
    await ctx.runMutation(internal.portalConnections.attachProviderRun, {
      runId,
      ownerId,
      providerSessionId: browser.sessionId,
      providerContextId: connection.providerContextId,
      humanRequired: false,
    });
    const pages = await browser.context.pages();
    const page = pages[0] ?? (await browser.context.newPage());
    await page.goto(targetUrl);
    await page.waitForLoadState("domcontentloaded", 20_000);
    assertFinalDomain(await page.url(), connection.allowedDomains);

    // Only a reviewed adapter may define these passive selectors. There are no
    // click, fill, submit, upload, registration, CAPTCHA, or send operations.
    const rawThreads: unknown = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-roomscout-thread-id]"))
        .slice(0, 20)
        .map((thread) => ({
          providerThreadId: thread.dataset.roomscoutThreadId ?? "",
          subject:
            thread.querySelector<HTMLElement>("[data-roomscout-subject]")?.innerText ??
            undefined,
          participants: Array.from(
            thread.querySelectorAll<HTMLElement>("[data-roomscout-participant]"),
          ).map((participant) => participant.innerText),
          lastMessageAt: Number(thread.dataset.roomscoutLastMessageAt ?? Date.now()),
          messages: Array.from(
            thread.querySelectorAll<HTMLElement>("[data-roomscout-message-id]"),
          )
            .slice(0, 20)
            .map((message) => ({
              providerMessageId: message.dataset.roomscoutMessageId ?? "",
              direction:
                message.dataset.roomscoutDirection === "inbound" ||
                message.dataset.roomscoutDirection === "outbound"
                  ? message.dataset.roomscoutDirection
                  : "unknown",
              senderLabel:
                message.querySelector<HTMLElement>("[data-roomscout-sender]")?.innerText ??
                undefined,
              bodyText:
                message.querySelector<HTMLElement>("[data-roomscout-body]")?.innerText ?? "",
              sentAt: Number(message.dataset.roomscoutSentAt ?? Date.now()),
            })),
        })),
    );
    const threads: SafeInboxThread[] = sanitizeInboxThreads(rawThreads);
    const result = await ctx.runMutation(internal.platformInbox.upsertReadOnlyBatch, {
      ownerId,
      connectionId,
      threads,
    });
    await ctx.runMutation(internal.portalConnections.finishRun, {
      runId,
      status: "completed",
      resultCount: result.messagesCreated,
    });
    return { runId, ...result };
  } catch (error) {
    const errorCode = sanitizeProviderError(error);
    await ctx.runMutation(internal.portalConnections.finishRun, {
      runId,
      status: "failed",
      errorCode,
      reauthRequired:
        errorCode === "PROVIDER_AUTH_FAILED" || errorCode === "PORTAL_REAUTH_REQUIRED",
    });
    throw new ConvexError({ code: errorCode });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // The server-side TTL remains the final cleanup boundary.
      }
    }
  }
}

export const syncInboxNow = action({
  args: { connectionId: v.id("portalConnections") },
  returns: v.object({
    runId: v.id("browserRuns"),
    threadsCreated: v.number(),
    messagesCreated: v.number(),
  }),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    return await syncInboxForOwner(ctx, ownerId, args.connectionId);
  },
});

export const syncInboxWorker = internalAction({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await syncInboxForOwner(ctx, args.ownerId, args.connectionId);
    } catch {
      // The run record contains only a sanitized error code for operator review.
    }
    return null;
  },
});

export const scheduleDueInboxSync = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const due = await ctx.runQuery(internal.portalConnections.listDueInboxSyncs, {
      now: Date.now(),
      limit: 1,
    });
    const next = due[0];
    if (next) {
      await ctx.scheduler.runAfter(0, internal.browserbasePortal.syncInboxWorker, next);
    }
    return null;
  },
});

async function applyWriteLimits(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  connectionId: Id<"portalConnections">,
): Promise<void> {
  await roomScoutRateLimiter.limit(ctx, "portalWriteUser", {
    key: ownerId,
    throws: true,
  });
  await roomScoutRateLimiter.limit(ctx, "portalWriteSource", {
    key: connectionId,
    throws: true,
  });
  await roomScoutRateLimiter.limit(ctx, "portalSessionGlobal", {
    key: "browserbase",
    throws: true,
  });
}

async function finishBrowserExecution(
  ctx: ActionCtx,
  input: {
    ownerId: Id<"users">;
    executionId: Id<"actionExecutions">;
    status: "succeeded" | "failed" | "unknown";
    providerThreadId?: string;
    providerMessageId?: string;
    error?: string;
  },
): Promise<void> {
  await ctx.runMutation(internal.externalActions.finishExecution, input);
}

async function executeApprovedWriteForOwner(
  ctx: ActionCtx,
  ownerId: Id<"users">,
  requestId: Id<"actionRequests">,
): Promise<ApprovedWriteResult> {
  // Configuration is checked before the transactional claim so a missing
  // provider key cannot strand a newly approved action in `claimed`.
  const apiKey = browserbaseApiKey();
  const client = createBrowserbaseClient(apiKey);
  const claim: ClaimedBrowserAction = await ctx.runMutation(
    internal.externalActions.claimForExecutor,
    { ownerId, requestId, executor: "browserbase" },
  );
  if (claim.executionStatus === "succeeded") {
    return {
      executionId: claim.executionId,
      status: "succeeded",
      alreadyCompleted: true,
    };
  }
  if (claim.executionStatus === "failed" || claim.executionStatus === "unknown") {
    return {
      executionId: claim.executionId,
      status: "unknown",
      alreadyCompleted: true,
    };
  }
  if (
    claim.requestedActionType !== "send_platform_dm" &&
    claim.requestedActionType !== "publish_listing"
  ) {
    await finishBrowserExecution(ctx, {
      ownerId,
      executionId: claim.executionId,
      status: "failed",
      error: "BROWSERBASE_ACTION_NOT_SUPPORTED",
    });
    throw new ConvexError({ code: "BROWSERBASE_ACTION_NOT_SUPPORTED" });
  }
  if (claim.payload.kind !== "platform_message" || !claim.connectionId) {
    await finishBrowserExecution(ctx, {
      ownerId,
      executionId: claim.executionId,
      status: "failed",
      error: "BROWSERBASE_PAYLOAD_NOT_SUPPORTED",
    });
    throw new ConvexError({ code: "BROWSERBASE_PAYLOAD_NOT_SUPPORTED" });
  }
  if (claim.adapterConfig.kind !== "browserbase") {
    await finishBrowserExecution(ctx, {
      ownerId,
      executionId: claim.executionId,
      status: "failed",
      error: "BROWSERBASE_ADAPTER_REQUIRED",
    });
    throw new ConvexError({ code: "BROWSERBASE_ADAPTER_REQUIRED" });
  }

  if (claim.alreadyClaimed && claim.executionStatus === "claimed") {
    // Another invocation owns the newly claimed provider call. It may not have
    // attached its session id yet; never race it by launching a second session.
    return {
      executionId: claim.executionId,
      status: "in_progress",
      alreadyCompleted: false,
    };
  }

  let browser: StagehandBrowser | undefined;
  let providerSessionId: string | undefined;
  let keepSessionForHuman = false;
  try {
    const connection = await getWorkerConnection(ctx, ownerId, claim.connectionId);
    if (
      connection.platformId !== claim.platformId ||
      !isAllowedHostname(claim.platformDomain, connection.allowedDomains) ||
      connection.allowedPaths.length === 0
    ) {
      throw new Error("PORTAL_CONNECTION_SCOPE_MISMATCH");
    }
    if (claim.adapterConfig.contextRequired && !connection.providerContextId) {
      throw new Error("PORTAL_REAUTH_REQUIRED");
    }

    const existingThread = claim.payload.threadId
      ? await ctx.runQuery(internal.platformInbox.getThreadForWrite, {
          ownerId,
          connectionId: connection.connectionId,
          threadId: claim.payload.threadId,
        })
      : null;
    if (claim.payload.threadId && existingThread === null) {
      throw new Error("PLATFORM_THREAD_NOT_FOUND");
    }
    if (
      claim.requestedActionType === "send_platform_dm" &&
      !claim.payload.threadId &&
      claim.payload.recipients.length === 0
    ) {
      throw new Error("PLATFORM_RECIPIENT_REQUIRED");
    }
    const workflow = resolvePortalWriteWorkflow({
      adapterKey: claim.adapterKey,
      adapterVersion: claim.adapterVersion,
      workflowKey: claim.adapterConfig.workflowKey,
      actionType: claim.requestedActionType as PortalWriteActionType,
    });
    const targetUrl = buildPortalWriteUrl({
      baseUrl: connection.baseUrl,
      allowedDomains: connection.allowedDomains,
      allowedPaths: connection.allowedPaths,
      workflow,
      providerThreadId: existingThread?.providerThreadId,
    });

    if (claim.executionStatus === "running") {
      const execution = await ctx.runQuery(
        internal.externalActions.getBrowserExecutionForOwner,
        { ownerId, executionId: claim.executionId },
      );
      if (execution === null) {
        return {
          executionId: claim.executionId,
          status: "in_progress",
          alreadyCompleted: false,
        };
      }
      if (execution.startedAt + PORTAL_WRITE_TTL_MS <= Date.now()) {
        await finishBrowserExecution(ctx, {
          ownerId,
          executionId: claim.executionId,
          status: "failed",
          error: "PORTAL_WRITE_SESSION_EXPIRED",
        });
        throw new Error("PORTAL_WRITE_SESSION_EXPIRED");
      }
      providerSessionId = execution.providerSessionId;
      browser = await browserbase.connect({
        apiKey,
        sessionId: execution.providerSessionId,
      });
    } else {
      await applyWriteLimits(ctx, ownerId, connection.connectionId);
      browser = await launchWriteBrowser({
        apiKey,
        allowedDomains: connection.allowedDomains,
        providerContextId: connection.providerContextId,
      });
      if (!browser.sessionId) throw new Error("PROVIDER_SESSION_MISSING");
      providerSessionId = browser.sessionId;
      await ctx.runMutation(internal.externalActions.attachProviderExecution, {
        ownerId,
        executionId: claim.executionId,
        providerActionId: providerSessionId,
      });
    }

    const pages = await browser.context.pages();
    const page = pages[0] ?? (await browser.context.newPage());
    if (claim.executionStatus !== "running") {
      await page.goto(targetUrl);
      await page.waitForLoadState("domcontentloaded", 20_000);
    } else {
      try {
        const alreadySucceeded = await inspectPortalWriteSuccess({
          page,
          workflow,
          allowedDomains: connection.allowedDomains,
          allowedPaths: connection.allowedPaths,
        });
        if (alreadySucceeded) {
          const providerThreadId =
            alreadySucceeded.providerThreadId ?? existingThread?.providerThreadId;
          if (
            claim.requestedActionType === "send_platform_dm" &&
            alreadySucceeded.providerMessageId
          ) {
            await ctx.runMutation(internal.platformInbox.recordOutboundWrite, {
              ownerId,
              connectionId: connection.connectionId,
              threadId: claim.payload.threadId,
              providerThreadId,
              providerMessageId: alreadySucceeded.providerMessageId,
              participants:
                claim.payload.recipients.length > 0
                  ? claim.payload.recipients
                  : (existingThread?.participants ?? []),
              subject: claim.payload.subject,
              bodyText: claim.payload.body,
              sentAt: Date.now(),
            });
          }
          await finishBrowserExecution(ctx, {
            ownerId,
            executionId: claim.executionId,
            status: "succeeded",
            providerThreadId,
            providerMessageId: alreadySucceeded.providerMessageId,
          });
          return {
            executionId: claim.executionId,
            status: "succeeded",
            alreadyCompleted: true,
          };
        }
      } catch {
        // The current page may still be the reviewed compose path. The normal
        // workflow below performs the strict pre-submit path and blocker checks.
      }
    }

    const result = await runDeterministicPortalWrite({
      page,
      workflow,
      payload: claim.payload,
      allowedDomains: connection.allowedDomains,
      allowedPaths: connection.allowedPaths,
      humanPresenceRequired: claim.humanPresenceRequired,
    });
    if (result.outcome === "human_required") {
      keepSessionForHuman = true;
      return {
        executionId: claim.executionId,
        status: "human_required",
        blocker: result.blocker,
        alreadyCompleted: false,
      };
    }
    if (result.outcome === "unknown") {
      await finishBrowserExecution(ctx, {
        ownerId,
        executionId: claim.executionId,
        status: "unknown",
        error: result.errorCode,
      });
      return {
        executionId: claim.executionId,
        status: "unknown",
        alreadyCompleted: false,
      };
    }

    const providerThreadId = result.providerThreadId ?? existingThread?.providerThreadId;
    if (claim.requestedActionType === "send_platform_dm" && result.providerMessageId) {
      await ctx.runMutation(internal.platformInbox.recordOutboundWrite, {
        ownerId,
        connectionId: connection.connectionId,
        threadId: claim.payload.threadId,
        providerThreadId,
        providerMessageId: result.providerMessageId,
        participants:
          claim.payload.recipients.length > 0
            ? claim.payload.recipients
            : (existingThread?.participants ?? []),
        subject: claim.payload.subject,
        bodyText: claim.payload.body,
        sentAt: Date.now(),
      });
    }
    await finishBrowserExecution(ctx, {
      ownerId,
      executionId: claim.executionId,
      status: "succeeded",
      providerThreadId,
      providerMessageId: result.providerMessageId,
    });
    return {
      executionId: claim.executionId,
      status: "succeeded",
      alreadyCompleted: false,
    };
  } catch (error) {
    const errorCode = sanitizeProviderError(error);
    await finishBrowserExecution(ctx, {
      ownerId,
      executionId: claim.executionId,
      status: "failed",
      error: errorCode,
    });
    throw new ConvexError({ code: errorCode });
  } finally {
    if (!keepSessionForHuman) {
      if (browser) {
        try {
          await browser.close();
        } catch {
          // Browserbase session release below remains the cleanup boundary.
        }
      }
      await releaseProviderSession(client, providerSessionId);
    }
  }
}

export const executeApprovedWrite = action({
  args: { requestId: v.id("actionRequests") },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<ApprovedWriteResult> => {
    const ownerId = await requireActionUserId(ctx);
    return await executeApprovedWriteForOwner(ctx, ownerId, args.requestId);
  },
});

export const executeApprovedWriteWorker = internalAction({
  args: {
    ownerId: v.id("users"),
    requestId: v.id("actionRequests"),
  },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<ApprovedWriteResult> =>
    await executeApprovedWriteForOwner(ctx, args.ownerId, args.requestId),
});

export const getApprovedWriteLiveView = action({
  args: { executionId: v.id("actionExecutions") },
  returns: v.object({ url: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args): Promise<{ url: string; expiresAt: number }> => {
    const ownerId = await requireActionUserId(ctx);
    const execution = await ctx.runQuery(
      internal.externalActions.getBrowserExecutionForOwner,
      { ownerId, executionId: args.executionId },
    );
    if (execution === null) {
      throw new ConvexError({ code: "WRITE_LIVE_VIEW_NOT_AVAILABLE" });
    }
    const expiresAt = execution.startedAt + PORTAL_WRITE_TTL_MS;
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      throw new ConvexError({ code: "WRITE_LIVE_VIEW_EXPIRED" });
    }
    const ttlSeconds = Math.max(1, Math.min(60, Math.floor(remainingMs / 1_000)));
    const links: { debuggerFullscreenUrl: string } = await createBrowserbaseClient(
      browserbaseApiKey(),
    ).sessions.debug(execution.providerSessionId, { expiresIn: ttlSeconds });
    return {
      url: links.debuggerFullscreenUrl,
      expiresAt: Math.min(expiresAt, Date.now() + ttlSeconds * 1_000),
    };
  },
});

export const stopApprovedWrite = action({
  args: { executionId: v.id("actionExecutions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const execution = await ctx.runQuery(
      internal.externalActions.getBrowserExecutionForOwner,
      { ownerId, executionId: args.executionId },
    );
    if (execution === null) throw new ConvexError({ code: "WRITE_SESSION_NOT_FOUND" });
    await releaseProviderSession(
      createBrowserbaseClient(browserbaseApiKey()),
      execution.providerSessionId,
    );
    await finishBrowserExecution(ctx, {
      ownerId,
      executionId: args.executionId,
      status: "failed",
      error: "USER_STOPPED_BROWSER_WRITE",
    });
    return null;
  },
});

export const completeApprovedWriteHumanStep = action({
  args: {
    requestId: v.id("actionRequests"),
    executionId: v.id("actionExecutions"),
    submitted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const execution = await ctx.runQuery(
      internal.externalActions.getBrowserExecutionForOwner,
      { ownerId, executionId: args.executionId },
    );
    if (execution === null || execution.requestId !== args.requestId) {
      throw new ConvexError({ code: "WRITE_SESSION_NOT_FOUND" });
    }
    // Cleanup is best-effort and never changes the user's completion choice.
    // The internal mutation below is the authoritative, audited transition.
    await releaseProviderSession(
      createBrowserbaseClient(browserbaseApiKey()),
      execution.providerSessionId,
    );
    await ctx.runMutation(internal.externalActions.confirmHumanExecution, {
      ownerId,
      requestId: args.requestId,
      executionId: args.executionId,
      submitted: args.submitted,
    });
    return null;
  },
});

export const disableConnection = action({
  args: { connectionId: v.id("portalConnections") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireActionUserId(ctx);
    const context = await ctx.runQuery(internal.portalConnections.getContextForOwner, {
      ownerId,
      connectionId: args.connectionId,
    });
    if (context !== null) {
      try {
        await createBrowserbaseClient(browserbaseApiKey()).contexts.delete(
          context.providerContextId,
        );
      } catch (error) {
        throw new ConvexError({ code: sanitizeProviderError(error) });
      }
    }
    await ctx.runMutation(internal.portalConnections.disableConnectionRecord, {
      ownerId,
      connectionId: args.connectionId,
      contextId: context?.contextId,
    });
    return null;
  },
});
