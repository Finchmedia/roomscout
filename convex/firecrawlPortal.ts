"use node";

import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import { requirePortalBrowserProviderConfiguration, resolvePortalBrowserProvider } from "./integrations/portalBrowserEngine";
import { buildAllowedPortalUrl, sanitizeInboxThreads } from "./integrations/portalSafety";
import { extractPortalVerificationCode, isRelevantPortalVerificationMessage } from "./integrations/portalVerification";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import {
  createFirecrawlPortalSession,
  firecrawlComponentPortalTransport,
  FIRECRAWL_PORTAL_URL_PROGRAM,
  type FirecrawlPortalSession,
} from "./integrations/firecrawlPortalRuntime";
import {
  readFirecrawlPortalInboxBatch,
  readFirecrawlPortalPageState,
  signUpOnFirecrawlPortal,
  submitFirecrawlPortalVerification,
  writeFirecrawlPortalMessage,
  type FirecrawlPortalHumanBlocker,
  type FirecrawlPortalPageState,
} from "./integrations/firecrawlPortalEngine";
import { scheduleContextCleanup, scheduleExecutionCleanup, scheduleProviderCleanup } from "./portalBrowserCleanup";

const client = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);
const RECOVERY_STOP_RESERVE_MS = 5_000;
/**
 * Outer bound of one registration session. It stays open across the AgentMail
 * verification wait, so it must outlast the OTP poll, not just one program.
 */
const REGISTRATION_SESSION_DEADLINE_MS = 420_000;
/** A continuation session only runs the verification program. */
const VERIFICATION_SESSION_DEADLINE_MS = 150_000;
/** Outer bound of one write session; each program inside it has its own budget. */
const WRITE_SESSION_DEADLINE_MS = 120_000;
const ONBOARDING_POLL_MS = 5_000;
const ONBOARDING_MAX_POLLS = 60;
const RUN_TEARDOWN_RESERVE_MS = 5_000;
const VERIFICATION_KEEPALIVE_EVERY_POLLS = 12;
/** A keepalive only reads the page URL; it never needs a program budget. */
const KEEPALIVE_TIMEOUT_MS = 15_000;
type RegistrationPhase = "mailbox" | "session_open" | "run_attach" | "progress" | "signup" | "verification" | "session_stop" | "profile_proof";
/**
 * A freshly opened inbox session occasionally answers its first Interact call
 * with a transport-class failure (e.g. the scrape's browser is not reachable,
 * surfacing as REQUEST_REJECTED). Only that opening step is retried, with a
 * new session each time; later batches keep failing fast.
 */
const INBOX_OPEN_RETRY_DELAYS_MS = [4_000, 8_000];
/** The write path retries only its side-effect-free opening (session, navigate, fill, verify). */
const WRITE_OPEN_RETRY_DELAYS_MS = [4_000, 8_000];
/** After an unconfirmed send, one inbox sync reconciles the observed message. */
const RECONCILE_SYNC_DELAY_MS = 20_000;
/**
 * Before beforeSubmit nothing reached the portal, so sandbox and
 * result-decoding failures are retryable too. `FIRECRAWL_WRITE_PREPARE_MISMATCH`
 * belongs here as well: a field that is not editable yet is a timing fault, and
 * the preparation program left nothing behind on the portal.
 */
const WRITE_OPEN_RETRYABLE_CODE = /^(FIRECRAWL_PORTAL_((SCRAPE|INTERACT)_(TRANSPORT_FAILED|REQUEST_REJECTED|UNAVAILABLE|PROFILE_BUSY|RATE_LIMITED|TIMED_OUT)|SCRAPE_ID_MISSING|EVIDENCE_INVALID|URL_INVALID|WRITE_RESULT_INVALID)|FIRECRAWL_INTERACT_(EXECUTION_FAILED|RESULT_INVALID|RESULT_MISSING|KILLED|ENVELOPE_INVALID)|FIRECRAWL_WRITE_PREPARE_MISMATCH)$/;
const INBOX_OPEN_RETRYABLE_CODE = /^FIRECRAWL_PORTAL_((SCRAPE|INTERACT)_(TRANSPORT_FAILED|REQUEST_REJECTED|UNAVAILABLE|PROFILE_BUSY|RATE_LIMITED|TIMED_OUT)|SCRAPE_ID_MISSING)$/;
const INBOX_SYNC_ERROR_CODE_MAX = 100;
/** `actionExecutions.error` is stored truncated at 1000 characters. */
const WRITE_FAILURE_ERROR_MAX = 500;

/**
 * The leading UPPER_SNAKE code of a thrown message, used for retry
 * classification. A program failure now carries a sanitised `:<detail>` tail
 * (see `parseInteractEnvelope`); the classification ignores it.
 */
function inboxSyncInnerCode(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const code = message.split(":", 1)[0] ?? "";
  return /^[A-Z0-9_]{3,80}$/.test(code) ? code : "UNKNOWN";
}

/**
 * Code plus the detail our own program attached, bounded for persistence. A
 * message that is not one of our codes stays "UNKNOWN": provider text never
 * reaches a stored record.
 */
function firecrawlErrorDetail(error: unknown, maxLength: number): string {
  if (inboxSyncInnerCode(error) === "UNKNOWN") return "UNKNOWN";
  return (error as Error).message.trim().slice(0, maxLength);
}

/** What `finishExecution` stores for a failed write: the reason, not the label. */
function firecrawlWriteFailureError(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "FIRECRAWL_PORTAL_WRITE_FAILED";
  const detail = message.startsWith("FIRECRAWL_PORTAL_WRITE_FAILED")
    ? message
    : `FIRECRAWL_PORTAL_WRITE_FAILED:${message}`;
  return detail.slice(0, WRITE_FAILURE_ERROR_MAX);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Read-only AgentMail REST fetch. Never persists the body; used only to read the OTP. */
async function firecrawlAgentMailJson(path: string): Promise<unknown> {
  const apiKey = envValue("AGENTMAIL_API_KEY");
  if (!apiKey) throw new Error("AGENTMAIL_API_KEY_MISSING");
  const base = (envValue("AGENTMAIL_BASE_URL") ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`AGENTMAIL_HTTP_${response.status}`);
  return await response.json();
}

/**
 * Wait for the Clerk verification code inline, in the same Firecrawl session
 * that started the sign-up. Polls the AgentMail REST inbox directly rather than
 * the webhook-backed mailboxMessages table, so a delayed or missing webhook
 * cannot stall the run, and returns the code to the caller for entry in the
 * one live browser that holds Clerk's in-progress sign-up.
 */
async function waitForFirecrawlVerification(input: {
  emailAddress: string;
  receivedAfter: number;
  portalDomain: string;
  deadlineAt: number;
  keepAlive: () => Promise<void>;
}): Promise<{ messageId: string; code: string } | null> {
  const inboxPath = `/inboxes/${encodeURIComponent(input.emailAddress)}/messages`;
  for (let attempt = 0; attempt < ONBOARDING_MAX_POLLS; attempt += 1) {
    if (input.deadlineAt - Date.now() <= RUN_TEARDOWN_RESERVE_MS) break;
    const list = asRecord(await firecrawlAgentMailJson(`${inboxPath}?limit=10`).catch(() => null));
    const messages = Array.isArray(list?.messages) ? list.messages : [];
    for (const raw of messages) {
      const summary = asRecord(raw);
      const messageId = typeof summary?.message_id === "string" ? summary.message_id : null;
      const receivedAt = Date.parse(
        typeof summary?.created_at === "string" ? summary.created_at
          : typeof summary?.timestamp === "string" ? summary.timestamp : "",
      );
      if (!messageId || !Number.isFinite(receivedAt) || receivedAt < input.receivedAfter) continue;
      const message = asRecord(await firecrawlAgentMailJson(`${inboxPath}/${encodeURIComponent(messageId)}`).catch(() => null));
      const subject = typeof message?.subject === "string" ? message.subject : "";
      const body = typeof message?.extracted_text === "string" ? message.extracted_text
        : typeof message?.text === "string" ? message.text : "";
      const from = typeof message?.from === "string" ? message.from : JSON.stringify(message?.from ?? "").slice(0, 1_000);
      if (!isRelevantPortalVerificationMessage({ from, subject, body, portalDomain: input.portalDomain })) continue;
      const code = extractPortalVerificationCode(`${subject}\n${body}`);
      if (code) return { messageId, code };
    }
    if (attempt < ONBOARDING_MAX_POLLS - 1) {
      // A Firecrawl session goes idle after ~5 min without an Interact call;
      // ping it periodically so a slow delivery cannot expire the browser.
      if (attempt > 0 && attempt % VERIFICATION_KEEPALIVE_EVERY_POLLS === 0) await input.keepAlive();
      const sleepMs = Math.min(ONBOARDING_POLL_MS, Math.max(0, input.deadlineAt - Date.now() - RUN_TEARDOWN_RESERVE_MS));
      if (sleepMs <= 0) break;
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }
  return null;
}

function firecrawlRegistrationFailureCode(error: unknown, phase: RegistrationPhase): string {
  const message = error instanceof Error ? error.message : "";
  if (/^FIRECRAWL_(SIGNUP_VALUE_MISMATCH|PORTAL_(REGISTRATION_RESULT_INVALID|VERIFICATION_RESULT_INVALID|PAGE_STATE_INVALID))$/.test(message)) return message;
  if (/^FIRECRAWL_PORTAL_(SCRAPE_(AUTH_FAILED|TIMED_OUT|RATE_LIMITED|PROFILE_BUSY|UNAVAILABLE|REQUEST_REJECTED|TRANSPORT_FAILED)|SCRAPE_ID_MISSING|PROFILE_INVALID|TIMEOUT_INVALID|DEADLINE_EXCEEDED|INTERACT_(AUTH_FAILED|TIMED_OUT|RATE_LIMITED|PROFILE_BUSY|UNAVAILABLE|REQUEST_REJECTED|TRANSPORT_FAILED))$/.test(message)) {
    return message;
  }
  if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data) {
    const code = error.data.code;
    if (code === "AGENTMAIL_PROVISIONING" || code === "AGENTMAIL_NOT_CONFIGURED" || code === "FIRECRAWL_RUN_DEADLINE_EXCEEDED") return code;
  }
  return `FIRECRAWL_REGISTRATION_${phase.toUpperCase()}_FAILED`;
}

export type FirecrawlPortalContext = {
  baseUrl: string;
  adapterKey: string;
  profileName: string;
};
type WorkerConnection = {
  connectionId: Id<"portalConnections">; platformId?: Id<"sourcePlatforms">; baseUrl: string;
  allowedDomains: string[]; allowedPaths: string[]; inboxPath?: string; adapterKey?: string;
  allowReadOnlyRecon: boolean; allowInboxPolling: boolean; providerContextId?: string;
  accessMode?: "public" | "authenticated";
  browserProvider: "firecrawl" | "browserbase"; contextStatus?: "creating" | "ready" | "reauth_required" | "deleting" | "deleted" | "failed";
};
type SyncResult = { runId: Id<"browserRuns">; threadsCreated: number; messagesCreated: number };
type WriteResult = { executionId: Id<"actionExecutions">; status: "succeeded" | "human_required" | "unknown" | "in_progress"; blocker?: FirecrawlPortalHumanBlocker; alreadyCompleted: boolean };
type WriteClaim = {
  executionId: Id<"actionExecutions">; executionStatus: string; alreadyClaimed: boolean;
  browserProvider?: "firecrawl" | "browserbase"; connectionId?: Id<"portalConnections">;
  platformId?: Id<"sourcePlatforms">; requestedActionType: string;
  payload: { kind: string; body: string; threadId?: Id<"platformThreads">; targetPath?: string; senderLabel?: string; recipients: string[]; subject?: string };
};

const registrationPreflightResultValidator = v.union(
  v.object({ status: v.literal("ready"), stage: v.union(v.literal("authenticated"), v.literal("sign_in"), v.literal("sign_up"), v.literal("verification"), v.literal("unknown")) }),
  v.object({ status: v.literal("failed"), phase: v.union(v.literal("session_open"), v.literal("get_url"), v.literal("inspect"), v.literal("stop")), errorCode: v.string() }),
);

export type FirecrawlProfileRecoveryInspection =
  | { outcome: "authenticated" }
  | { outcome: "awaiting_verification" }
  | { outcome: "auth_needed" }
  | { outcome: "review"; blocker?: FirecrawlPortalHumanBlocker };

function transport(ctx: ActionCtx) {
  return firecrawlComponentPortalTransport({ ctx, client });
}

function requireSelectedFirecrawl(): void {
  if (resolvePortalBrowserProvider() !== "firecrawl") throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
  requirePortalBrowserProviderConfiguration("firecrawl");
}

function remainingRunMs(deadlineAt: number): number {
  const remaining = deadlineAt - Date.now() - RUN_TEARDOWN_RESERVE_MS;
  if (remaining <= 0) throw new ConvexError({ code: "FIRECRAWL_RUN_DEADLINE_EXCEEDED" });
  return remaining;
}

async function stopRegistrationSession(
  ctx: ActionCtx,
  session: FirecrawlPortalSession,
  cleanup?: { ownerId: Id<"users">; runId: Id<"browserRuns"> } | {
    ownerId: Id<"users">; connectionId: Id<"portalConnections">; contextId: Id<"browserContexts">;
  },
): Promise<void> {
  try {
    await session.stop();
  } catch (error) {
    if (cleanup) {
      if ("runId" in cleanup) await scheduleProviderCleanup(ctx, {
        ...cleanup, provider: "firecrawl", providerSessionId: session.scrapeId,
      }).catch(() => undefined);
      else await scheduleContextCleanup(ctx, {
        ...cleanup, provider: "firecrawl", providerSessionId: session.scrapeId, purpose: "profile_proof",
      }).catch(() => undefined);
    }
    throw error;
  }
}

async function stopRunSessionOrSchedule(ctx: ActionCtx, session: FirecrawlPortalSession, ownerId: Id<"users">, runId: Id<"browserRuns">): Promise<void> {
  try { await session.stop(); }
  catch {
    await scheduleProviderCleanup(ctx, {
      ownerId, runId, provider: "firecrawl", providerSessionId: session.scrapeId,
    }).catch(() => undefined);
  }
}

/**
 * Minimum spacing between Interact requests of one session. Firecrawl rate
 * limits Interact executes per team and per minute (10 on Free, 100 on Hobby,
 * 500 on Standard); the reviewed driver issues one request per primitive, so
 * a registration burst of ~20 requests must be spread out. 700 ms keeps one
 * session under ~85 requests per minute.
 */
const DEFAULT_INTERACT_MIN_INTERVAL_MS = 700;

function interactMinIntervalMs(): number {
  const raw = Number(process.env.FIRECRAWL_INTERACT_MIN_INTERVAL_MS ?? "");
  return Number.isFinite(raw) && raw >= 0 && raw <= 10_000 ? Math.floor(raw) : DEFAULT_INTERACT_MIN_INTERVAL_MS;
}

/**
 * Whether an approved write opens the portal profile writably. Default false:
 * sending a message does not rotate the Clerk session, so the write needs no
 * profile write lock, and without that lock the self-inflicted 409 on the
 * following session disappears. `FIRECRAWL_WRITE_SAVE_CHANGES=true` restores
 * the old behaviour without a code change if a live run ever shows the saved
 * login does not survive.
 */
export function firecrawlWriteSaveChanges(): boolean {
  return (envValue("FIRECRAWL_WRITE_SAVE_CHANGES") ?? "").trim().toLowerCase() === "true";
}

export async function openFirecrawlPortalSession(
  ctx: ActionCtx,
  input: FirecrawlPortalContext & { path: string; saveChanges: boolean; timeoutMs?: number },
): Promise<FirecrawlPortalSession> {
  return await createFirecrawlPortalSession({
    transport: transport(ctx),
    url: new URL(input.path, input.baseUrl).toString(),
    profileName: input.profileName,
    saveChanges: input.saveChanges,
    timeoutMs: input.timeoutMs,
    pacing: { minIntervalMs: interactMinIntervalMs() },
  });
}

/**
 * Enter a verification code in a fresh session on the saved profile. Used only
 * by the scheduler continuation; the inline registration keeps its own session
 * open and calls the verification program there.
 */
export async function runFirecrawlRegistrationStep(
  ctx: ActionCtx,
  input: FirecrawlPortalContext & {
    verificationCode: string;
    deadlineAt?: number;
    cleanup?: { ownerId: Id<"users">; runId: Id<"browserRuns"> } | {
      ownerId: Id<"users">; connectionId: Id<"portalConnections">; contextId: Id<"browserContexts">;
    };
  },
): Promise<{ outcome: "authenticated" | "human_required"; blocker?: FirecrawlPortalHumanBlocker }> {
  const session = await openFirecrawlPortalSession(ctx, {
    ...input,
    path: "/sign-up",
    saveChanges: true,
    timeoutMs: input.deadlineAt
      ? Math.min(VERIFICATION_SESSION_DEADLINE_MS, remainingRunMs(input.deadlineAt))
      : VERIFICATION_SESSION_DEADLINE_MS,
  });
  try {
    const verified = await submitFirecrawlPortalVerification({ session, code: input.verificationCode });
    return verified.authenticated
      ? { outcome: "authenticated" as const }
      : { outcome: "human_required" as const, blocker: "policy_human_presence" as const };
  } finally {
    await stopRegistrationSession(ctx, session, input.cleanup);
  }
}

/** Inspect an existing saved profile without registering, mutating, or resuming a stopped scrape. */
export async function inspectFirecrawlProfileForRecovery(
  ctx: ActionCtx,
  input: FirecrawlPortalContext & {
    deadlineAt?: number; now?: () => number;
    cleanup?: { ownerId: Id<"users">; connectionId: Id<"portalConnections">; contextId: Id<"browserContexts"> };
  },
): Promise<FirecrawlProfileRecoveryInspection> {
  const now = input.now ?? Date.now;
  const deadlineAt = input.deadlineAt ?? now() + 30_000;
  const availableMs = deadlineAt - now() - RECOVERY_STOP_RESERVE_MS;
  if (availableMs <= 0) throw new Error("FIRECRAWL_RECOVERY_DEADLINE_EXCEEDED");
  let session: FirecrawlPortalSession | undefined;
  try {
    session = await openFirecrawlPortalSession(ctx, {
      ...input,
      path: "/",
      saveChanges: false,
      timeoutMs: Math.min(30_000, availableMs),
    });
    let state: FirecrawlPortalPageState = await readFirecrawlPortalPageState({ session, path: "/" });
    // Only a page that is neither signed in, nor already waiting for a code,
    // nor blocked is worth a second look on the sign-up route.
    if (!state.authenticated && state.stage !== "verification" && !state.captcha) {
      state = await readFirecrawlPortalPageState({ session, path: "/sign-up" });
    }
    await session.stop();
    session = undefined;
    if (state.authenticated || state.stage === "authenticated") return { outcome: "authenticated" };
    if (state.stage === "verification") return { outcome: "awaiting_verification" };
    if (state.captcha) return { outcome: "review", blocker: "captcha" };
    if (state.stage === "sign_in" || state.stage === "sign_up") return { outcome: "auth_needed" };
    return { outcome: "review" };
  } finally {
    if (session) await session.stop().catch(async () => {
      if (input.cleanup) await scheduleContextCleanup(ctx, {
        ...input.cleanup, provider: "firecrawl", providerSessionId: session!.scrapeId, purpose: "recovery",
      }).catch(() => undefined);
    });
  }
}

/** Read-only deployment preflight: creates no portal account and submits nothing. */
export const registrationPreflight = internalAction({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections") },
  returns: registrationPreflightResultValidator,
  handler: async (ctx, args) => {
    requireSelectedFirecrawl();
    const connection = await ctx.runQuery(internal.portalConnections.getConnectionForWorker, args);
    if (!connection || connection.browserProvider !== "firecrawl" || connection.adapterKey !== "roomscout-dev-v1") {
      return { status: "failed" as const, phase: "session_open" as const, errorCode: "FIRECRAWL_PREFLIGHT_NOT_AVAILABLE" };
    }
    let phase: "session_open" | "get_url" | "inspect" | "stop" = "session_open";
    let session: FirecrawlPortalSession | undefined;
    try {
      session = await openFirecrawlPortalSession(ctx, {
        baseUrl: connection.baseUrl, adapterKey: connection.adapterKey,
        profileName: `preflight_${crypto.randomUUID().replaceAll("-", "")}`,
        path: "/sign-up", saveChanges: false, timeoutMs: 30_000,
      });
      phase = "inspect";
      const state = await readFirecrawlPortalPageState({ session, path: "/sign-up" });
      if (state.stage === "unknown") throw new Error("FIRECRAWL_PREFLIGHT_STAGE_UNKNOWN");
      phase = "stop";
      await session.stop();
      session = undefined;
      return { status: "ready" as const, stage: state.stage };
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      // The phase says where it stopped; the inner code says why, when our own
      // program or the transport named one.
      const inner = inboxSyncInnerCode(error);
      const errorCode = /^FIRECRAWL_[A-Z0-9_]{1,90}$/.test(message)
        ? message
        : `FIRECRAWL_PREFLIGHT_${phase.toUpperCase()}_FAILED${inner === "UNKNOWN" ? "" : `:${inner}`}`;
      return { status: "failed" as const, phase, errorCode };
    } finally {
      await session?.stop().catch(() => undefined);
    }
  },
});

export async function readFirecrawlInbox(
  ctx: ActionCtx,
  input: FirecrawlPortalContext & {
    requestedThreadIds?: string[]; startOffset?: number;
    cleanup: { ownerId: Id<"users">; connectionId: Id<"portalConnections">; contextId: Id<"browserContexts"> };
  },
) {
  const session = await openFirecrawlPortalSession(ctx, { ...input, path: "/inbox", saveChanges: false, timeoutMs: 120_000 });
  try {
    return await readFirecrawlPortalInboxBatch({
      session,
      requestedThreadIds: input.requestedThreadIds,
      startOffset: input.startOffset,
    });
  } finally {
    try { await session.stop(); }
    catch {
      await scheduleContextCleanup(ctx, {
        ...input.cleanup, provider: "firecrawl", providerSessionId: session.scrapeId, purpose: "profile_proof",
      }).catch(() => undefined);
    }
  }
}

export async function executeFirecrawlApprovedWrite(
  ctx: ActionCtx,
  input: FirecrawlPortalContext & {
    body: string;
    providerThreadId?: string;
    targetPath?: string;
    senderLabel?: string;
    beforeSubmit: () => Promise<void>;
    onSessionOpened?: (providerSessionId: string) => Promise<void>;
    onStopFailure?: (providerSessionId: string) => Promise<void>;
  },
) {
  const path = input.providerThreadId ? `/inbox/${encodeURIComponent(input.providerThreadId)}` : input.targetPath;
  if (!path) throw new Error("PORTAL_TARGET_PATH_INVALID");
  // Everything up to beforeSubmit is side-effect free on the portal, so a fresh
  // session's transport-class failure (cold start, busy profile, rate limit) is
  // retried with a new session the same way the inbox sync retries its opening.
  for (let attempt = 0; ; attempt += 1) {
    let session: FirecrawlPortalSession;
    try {
      session = await openFirecrawlPortalSession(ctx, { ...input, path, saveChanges: firecrawlWriteSaveChanges(), timeoutMs: WRITE_SESSION_DEADLINE_MS });
    } catch (error) {
      const delayMs = WRITE_OPEN_RETRY_DELAYS_MS[attempt];
      const code = inboxSyncInnerCode(error);
      if (delayMs === undefined || !WRITE_OPEN_RETRYABLE_CODE.test(code)) {
        console.error("FIRECRAWL_PORTAL_WRITE_FAILED", { phase: "open", code, attempt });
        throw new Error(`FIRECRAWL_PORTAL_WRITE_FAILED:${firecrawlErrorDetail(error, WRITE_FAILURE_ERROR_MAX)}`, { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    let submissionMayHaveOccurred = false;
    let sessionStopped = false;
    let cleanupScheduled = false;
    let retryDelayMs: number | undefined;
    try {
      await input.onSessionOpened?.(session.scrapeId);
      const result = await writeFirecrawlPortalMessage({
        session,
        body: input.body,
        providerThreadId: input.providerThreadId,
        targetPath: input.targetPath,
        senderLabel: input.senderLabel,
        beforeSubmit: async () => {
          submissionMayHaveOccurred = true;
          await input.beforeSubmit();
        },
      });
      let profileStopFailed = false;
      try { await session.stop(); sessionStopped = true; } catch { profileStopFailed = true; await input.onStopFailure?.(session.scrapeId); cleanupScheduled = true; }
      return { ...result, profileStopFailed };
    } catch (error) {
      if (submissionMayHaveOccurred) {
        let profileStopFailed = false;
        try { await session.stop(); sessionStopped = true; } catch { profileStopFailed = true; await input.onStopFailure?.(session.scrapeId); cleanupScheduled = true; }
        // The click may have landed and the session is gone: no home
        // observation exists, so the profile probe has nothing to go on.
        return { outcome: "unknown" as const, submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" as const, profileAuthenticated: undefined, profileStopFailed };
      }
      const code = inboxSyncInnerCode(error);
      const delayMs = WRITE_OPEN_RETRY_DELAYS_MS[attempt];
      if (delayMs !== undefined && WRITE_OPEN_RETRYABLE_CODE.test(code)) {
        retryDelayMs = delayMs;
      } else {
        console.error("FIRECRAWL_PORTAL_WRITE_FAILED", { phase: "prepare", code, attempt });
        throw new Error(`FIRECRAWL_PORTAL_WRITE_FAILED:${firecrawlErrorDetail(error, WRITE_FAILURE_ERROR_MAX)}`, { cause: error });
      }
    } finally {
      if (!sessionStopped) {
        try { await session.stop(); }
        catch { if (!cleanupScheduled) await input.onStopFailure?.(session.scrapeId); }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

async function connectionForFirecrawl(ctx: ActionCtx, ownerId: Id<"users">, connectionId: Id<"portalConnections">): Promise<WorkerConnection> {
  requireSelectedFirecrawl();
  const connection = await ctx.runQuery(internal.portalConnections.getConnectionForWorker, { ownerId, connectionId });
  if (!connection) throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
  if (connection.browserProvider !== "firecrawl") throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
  if (!connection.providerContextId || connection.contextStatus !== "ready") throw new ConvexError({ code: "PORTAL_REAUTH_REQUIRED" });
  return connection as WorkerConnection;
}

/**
 * Open the inbox session and read its first batch, retrying the pair a bounded
 * number of times on transport-class failures. A failed session is stopped
 * (or its cleanup scheduled) before the next attempt.
 */
async function openInboxSessionWithFirstBatch(
  ctx: ActionCtx,
  input: { connection: WorkerConnection; ownerId: Id<"users">; runId: Id<"browserRuns">; startOffset: number; requestedThreadIds: string[] },
): Promise<{ session: FirecrawlPortalSession; batch: Awaited<ReturnType<typeof readFirecrawlPortalInboxBatch>> }> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const session = await openFirecrawlPortalSession(ctx, {
        baseUrl: input.connection.baseUrl,
        adapterKey: input.connection.adapterKey ?? "",
        profileName: input.connection.providerContextId!,
        path: input.connection.inboxPath!,
        saveChanges: false,
        timeoutMs: 120_000,
      });
      try {
        const batch = await readFirecrawlPortalInboxBatch({ session, startOffset: input.startOffset, requestedThreadIds: input.requestedThreadIds });
        return { session, batch };
      } catch (error) {
        await stopRunSessionOrSchedule(ctx, session, input.ownerId, input.runId);
        throw error;
      }
    } catch (error) {
      const delayMs = INBOX_OPEN_RETRY_DELAYS_MS[attempt];
      if (delayMs === undefined || !(error instanceof Error && INBOX_OPEN_RETRYABLE_CODE.test(error.message))) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function syncInboxForOwner(ctx: ActionCtx, ownerId: Id<"users">, connectionId: Id<"portalConnections">, progress?: { generation: number; requestedThreadIds: string[]; startOffset: number }): Promise<SyncResult> {
  const connection = await connectionForFirecrawl(ctx, ownerId, connectionId);
  if (!connection.allowInboxPolling || !connection.inboxPath) throw new ConvexError({ code: "INBOX_POLLING_NOT_ALLOWED" });
  const runId: Id<"browserRuns"> = await ctx.runMutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "inbox_sync", browserProvider: "firecrawl",
  });
  try {
    let startOffset = progress?.startOffset ?? 0;
    const initialOffset = startOffset;
    let requestedThreadIds = progress?.requestedThreadIds ?? [];
    // The run can be attached to a provider session only once, so it binds to
    // the session that survived the opening retries.
    const { session, batch: firstBatch } = await openInboxSessionWithFirstBatch(ctx, { connection, ownerId, runId, startOffset, requestedThreadIds });
    await ctx.runMutation(internal.portalConnections.attachProviderRun, {
      runId, ownerId, providerSessionId: session.scrapeId,
      providerContextId: connection.providerContextId,
      browserProvider: "firecrawl", humanRequired: false,
    });
    try {
      let threadsCreated = 0;
      let messagesCreated = 0;
      let complete = false;
      for (let batchIndex = 0; batchIndex < 5; batchIndex += 1) {
        const batch = batchIndex === 0 ? firstBatch : await readFirecrawlPortalInboxBatch({ session, startOffset, requestedThreadIds });
        const threads = sanitizeInboxThreads(batch.threads);
        const result: { threadsCreated: number; messagesCreated: number } = await ctx.runMutation(internal.platformInbox.upsertReadOnlyBatch, { ownerId, connectionId, threads });
        threadsCreated += result.threadsCreated;
        messagesCreated += result.messagesCreated;
        const handled = new Set([...batch.threads.map((thread) => thread.providerThreadId), ...batch.missingThreadIds]);
        requestedThreadIds = requestedThreadIds.filter((id) => !handled.has(id));
        const cycleCompleted = batchIndex > 0 && batch.nextOffset === initialOffset;
        const contentTruncated = batch.bodyTruncatedThreadIds.length > 0 || batch.historyTruncatedThreadIds.length > 0;
        const partial = batch.timedOut || contentTruncated || batch.failedThreadIds.length > 0 || requestedThreadIds.length > 0 || (batch.truncated && !cycleCompleted);
        if (progress) await ctx.runMutation(internal.portalInboxSync.recordReadProgress, {
          ownerId, connectionId, generation: progress.generation, browserProvider: "firecrawl",
          nextOffset: batch.nextOffset, remainingRequestedThreadIds: requestedThreadIds,
          partial, truncated: batch.truncated, timedOut: batch.timedOut,
        });
        if (batch.timedOut) break;
        if (!partial) { complete = true; break; }
        if (batch.nextOffset === startOffset) break;
        startOffset = batch.nextOffset;
      }
      if (!complete) {
        await ctx.runMutation(internal.portalConnections.finishRun, { runId, status: "failed", resultCount: messagesCreated, errorCode: "FIRECRAWL_INBOX_PARTIAL" });
        throw new ConvexError({ code: "FIRECRAWL_INBOX_PARTIAL" });
      }
      await ctx.runMutation(internal.portalConnections.finishRun, { runId, status: "completed", resultCount: messagesCreated });
      return { runId, threadsCreated, messagesCreated };
    } finally { await stopRunSessionOrSchedule(ctx, session, ownerId, runId); }
  } catch (error) {
    if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data && error.data.code === "FIRECRAWL_INBOX_PARTIAL") throw error;
    const inner = inboxSyncInnerCode(error);
    await ctx.runMutation(internal.portalConnections.finishRun, {
      runId, status: "failed", errorCode: `FIRECRAWL_INBOX_SYNC_FAILED:${inner}`.slice(0, INBOX_SYNC_ERROR_CODE_MAX),
    });
    throw new ConvexError({ code: "FIRECRAWL_INBOX_SYNC_FAILED", inner });
  }
}

export const syncInboxNow = action({
  args: { connectionId: v.id("portalConnections") },
  returns: v.object({ runId: v.id("browserRuns"), threadsCreated: v.number(), messagesCreated: v.number() }),
  handler: async (ctx, args): Promise<SyncResult> => {
    const ownerId = await requireActionUserId(ctx);
    const generation = await ctx.runMutation(internal.portalInboxSync.beginManualSync, { ownerId, connectionId: args.connectionId });
    if (generation === null) throw new ConvexError({ code: "INBOX_SYNC_ALREADY_ACTIVE" });
    if (generation.browserProvider !== "firecrawl") throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
    let failed = true;
    try { const result: SyncResult = await syncInboxForOwner(ctx, ownerId, args.connectionId, { generation: generation.generation, requestedThreadIds: [], startOffset: 0 }); failed = false; return result; }
    finally { await ctx.runMutation(internal.portalInboxSync.finishManualSync, { ownerId, connectionId: args.connectionId, generation: generation.generation, browserProvider: "firecrawl", failed }); }
  },
});

export const syncInboxCoordinatedWorker = internalAction({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), generation: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!await ctx.runQuery(internal.devUserReset.userMayRunWork, { userId: args.ownerId })) return null;
    const claimed: { requestedThreadIds: string[]; startOffset: number } | null = await ctx.runMutation(internal.portalInboxSync.claimWorker, { ...args, browserProvider: "firecrawl" });
    if (!claimed) return null;
    await syncInboxForOwner(ctx, args.ownerId, args.connectionId, { generation: args.generation, ...claimed });
    return null;
  },
});

export const syncInboxForOwnerAction = internalAction({
  args: { ownerId: v.id("users"), connectionId: v.id("portalConnections") },
  returns: v.object({ runId: v.id("browserRuns"), threadsCreated: v.number(), messagesCreated: v.number() }),
  handler: async (ctx, args) => await syncInboxForOwner(ctx, args.ownerId, args.connectionId),
});

const writeResultValidator = v.object({
  executionId: v.id("actionExecutions"),
  status: v.union(v.literal("succeeded"), v.literal("human_required"), v.literal("unknown"), v.literal("in_progress")),
  blocker: v.optional(v.union(v.literal("password"), v.literal("two_factor"), v.literal("captcha"), v.literal("terms"), v.literal("payment"), v.literal("contract"), v.literal("policy_human_presence"))),
  alreadyCompleted: v.boolean(),
});

async function executeWriteForOwner(ctx: ActionCtx, ownerId: Id<"users">, requestId: Id<"actionRequests">): Promise<WriteResult> {
  requireSelectedFirecrawl();
  const gate = await ctx.runMutation(internal.externalActions.prepareClaim, { ownerId, requestId, executor: "browserbase" });
  if (gate.outcome !== "proceed") throw new ConvexError({ code: `GATE_${gate.outcome.toUpperCase()}`, reason: gate.reason });
  const claim: WriteClaim = await ctx.runMutation(internal.externalActions.claimForExecutor, { ownerId, requestId, executor: "browserbase" }) as WriteClaim;
  if (claim.browserProvider !== "firecrawl") throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
  if (claim.executionStatus === "succeeded") return { executionId: claim.executionId, status: "succeeded" as const, alreadyCompleted: true };
  if (["failed", "unknown"].includes(claim.executionStatus)) return { executionId: claim.executionId, status: "unknown" as const, alreadyCompleted: true };
  if (claim.executionStatus === "running" || claim.alreadyClaimed) return { executionId: claim.executionId, status: "in_progress" as const, alreadyCompleted: false };
  if (claim.payload?.kind !== "platform_message" || !claim.connectionId) throw new ConvexError({ code: "FIRECRAWL_PAYLOAD_NOT_SUPPORTED" });
  const connection = await connectionForFirecrawl(ctx, ownerId, claim.connectionId);
  const existingThread = claim.payload.threadId ? await ctx.runQuery(internal.platformInbox.getThreadForWrite, {
    ownerId, connectionId: connection.connectionId, threadId: claim.payload.threadId,
  }) : null;
  const locked = await ctx.runMutation(internal.portalConnections.claimWriteSession, {
    ownerId, connectionId: connection.connectionId, executionId: claim.executionId, browserProvider: "firecrawl",
  });
  if (!locked) throw new ConvexError({ code: "BROWSER_CONTEXT_BUSY" });
  let deliveryConfirmed = false;
  let confirmedReceipt: { providerThreadId: string; providerMessageId: string } | undefined;
  const pendingProof: { contextId: Id<"browserContexts">; profileName: string; generation: number } = await ctx.runMutation(
    internal.portalConnections.markContextPendingAfterWrite,
    { ownerId, connectionId: connection.connectionId, executionId: claim.executionId, browserProvider: "firecrawl" },
  );
  let proofRecorded = false;
  /**
   * The profile proof no longer opens a second session (plan S3): the send
   * program ends on `/` and reports whether Clerk is still authenticated there.
   * Without that observation the profile is unchanged when the session was
   * opened read-only, so it stays ready; with `FIRECRAWL_WRITE_SAVE_CHANGES`
   * on, an unobserved run is treated as unproven.
   */
  const recordProfileProbe = async (probe: { authenticated?: boolean; stopFailed: boolean }) => {
    const success = !probe.stopFailed && (
      probe.authenticated === true ||
      (probe.authenticated === undefined && !firecrawlWriteSaveChanges())
    );
    const errorCode = probe.stopFailed ? "CONTEXT_PROFILE_STOP_FAILED" : "CONTEXT_PROFILE_NOT_READY";
    try {
      await ctx.runMutation(internal.portalConnections.recordWriteContextProbe, {
        ownerId, connectionId: connection.connectionId, contextId: pendingProof.contextId,
        executionId: claim.executionId, browserProvider: "firecrawl", generation: pendingProof.generation,
        success, errorCode: success ? undefined : errorCode, attempt: 1,
        // There is no second attempt left to wait for, so a failed probe is
        // immediately exhausted and the connection asks for reconnection.
        deadlineAt: success ? undefined : Date.now(),
      });
      proofRecorded = true;
    } catch {
      // The context remains non-ready. Delivery state is intentionally independent.
    }
  };
  try {
    const result = await executeFirecrawlApprovedWrite(ctx, {
      baseUrl: connection.baseUrl, adapterKey: connection.adapterKey ?? "", profileName: pendingProof.profileName,
      body: claim.payload.body, providerThreadId: existingThread?.providerThreadId,
      targetPath: claim.payload.targetPath, senderLabel: claim.payload.senderLabel,
      onSessionOpened: async (providerSessionId) => {
        await ctx.runMutation(internal.externalActions.attachProviderExecution, {
          ownerId, executionId: claim.executionId, providerActionId: providerSessionId,
        });
      },
      onStopFailure: async (providerSessionId) => {
        await scheduleExecutionCleanup(ctx, {
          ownerId, executionId: claim.executionId, provider: "firecrawl", providerSessionId,
        }).catch(() => undefined);
      },
      beforeSubmit: async () => {
        await ctx.runMutation(internal.externalActions.claimForExecutor, { ownerId, requestId, executor: "browserbase" });
      },
    });
    if (result.outcome === "human_required") {
      await ctx.runMutation(internal.externalActions.finishExecution, { ownerId, executionId: claim.executionId, status: "failed", error: `FIRECRAWL_${result.blocker.toUpperCase()}_REQUIRES_HUMAN` });
      await recordProfileProbe({ authenticated: result.profileAuthenticated, stopFailed: result.profileStopFailed });
      return { executionId: claim.executionId, status: "human_required" as const, blocker: result.blocker, alreadyCompleted: false };
    }
    if (result.outcome === "unknown") {
      await ctx.runMutation(internal.externalActions.finishExecution, { ownerId, executionId: claim.executionId, status: "unknown", error: result.errorCode });
      await recordProfileProbe({ authenticated: result.profileAuthenticated, stopFailed: result.profileStopFailed });
      // The portal usually did store the message. One inbox sync shortly afterwards lets the
      // observed-message reconciliation turn "unknown" into a confirmed send instead of leaving
      // the musician with a vague status.
      await ctx.scheduler.runAfter(RECONCILE_SYNC_DELAY_MS, internal.portalInboxSync.requestSync, {
        ownerId, connectionId: connection.connectionId, reason: "manual",
      });
      return { executionId: claim.executionId, status: "unknown" as const, alreadyCompleted: false };
    }
    deliveryConfirmed = true;
    confirmedReceipt = { providerThreadId: result.providerThreadId, providerMessageId: result.providerMessageId };
    if (claim.requestedActionType === "send_platform_dm") await ctx.runMutation(internal.platformInbox.recordOutboundWrite, {
      ownerId, connectionId: connection.connectionId, threadId: claim.payload.threadId,
      providerThreadId: result.providerThreadId, providerMessageId: result.providerMessageId,
      participants: claim.payload.recipients.length ? claim.payload.recipients : existingThread?.participants ?? [],
      subject: claim.payload.subject, bodyText: claim.payload.body, sentAt: Date.now(),
    });
    await ctx.runMutation(internal.externalActions.finishExecution, { ownerId, executionId: claim.executionId, status: "succeeded", providerThreadId: result.providerThreadId, providerMessageId: result.providerMessageId });
    await recordProfileProbe({ authenticated: result.profileAuthenticated, stopFailed: result.profileStopFailed });
    return { executionId: claim.executionId, status: "succeeded" as const, alreadyCompleted: false };
  } catch (error) {
    // The write threw before any home observation. The session carried no
    // profile changes unless the save switch is on, so the probe decides from
    // that alone; there is no scheduled retry to wait for any more.
    if (!proofRecorded) await recordProfileProbe({ stopFailed: false });
    if (deliveryConfirmed && confirmedReceipt) {
      try {
        await ctx.runMutation(internal.externalActions.finishExecution, { ownerId, executionId: claim.executionId, status: "succeeded", ...confirmedReceipt });
        return { executionId: claim.executionId, status: "succeeded" as const, alreadyCompleted: false };
      } catch {
        return { executionId: claim.executionId, status: "unknown" as const, alreadyCompleted: false };
      }
    }
    const message = error instanceof Error ? error.message : "FIRECRAWL_PORTAL_WRITE_FAILED";
    if (message !== "SUBMIT_RESULT_UNKNOWN") {
      // The full reason, not the bare label: without it a production failure is
      // unreadable in the execution record.
      await ctx.runMutation(internal.externalActions.finishExecution, { ownerId, executionId: claim.executionId, status: "failed", error: firecrawlWriteFailureError(error) });
    }
    throw error;
  } finally {
    await ctx.runMutation(internal.portalConnections.releaseWriteSession, { ownerId, connectionId: connection.connectionId, executionId: claim.executionId });
  }
}

export const executeApprovedWriteForOwner = internalAction({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests") },
  returns: writeResultValidator,
  handler: async (ctx, args) => await executeWriteForOwner(ctx, args.ownerId, args.requestId),
});

export const executeApprovedWriteWorker = internalAction({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests"), busyAttempt: v.optional(v.number()) },
  returns: writeResultValidator,
  handler: async (ctx, args): Promise<WriteResult> => await executeWriteForOwner(ctx, args.ownerId, args.requestId),
});

export const executeApprovedWrite = action({
  args: { requestId: v.id("actionRequests") }, returns: writeResultValidator,
  handler: async (ctx, args): Promise<WriteResult> => await executeWriteForOwner(ctx, await requireActionUserId(ctx), args.requestId),
});

const registrationResultValidator = v.object({ runId: v.id("browserRuns"), status: v.union(v.literal("waiting_verification"), v.literal("human_required"), v.literal("completed")) });
const recoveryResultValidator = v.object({
  status: v.union(v.literal("completed"), v.literal("waiting_verification"), v.literal("auth_needed"), v.literal("review")),
  runId: v.optional(v.id("browserRuns")),
});

export const recoverProfile = action({
  args: { connectionId: v.id("portalConnections") },
  returns: recoveryResultValidator,
  handler: async (ctx, args): Promise<{ status: "completed" | "waiting_verification" | "auth_needed" | "review"; runId?: Id<"browserRuns"> }> => {
    const ownerId = await requireActionUserId(ctx);
    requireSelectedFirecrawl();
    const recovery = await ctx.runMutation(internal.portalConnections.prepareProfileRecovery, {
      ownerId, connectionId: args.connectionId, browserProvider: "firecrawl",
    });
    let inspection: FirecrawlProfileRecoveryInspection;
    try {
      inspection = await inspectFirecrawlProfileForRecovery(ctx, {
        baseUrl: recovery.baseUrl, adapterKey: recovery.adapterKey,
        profileName: recovery.profileName,
        cleanup: { ownerId, connectionId: args.connectionId, contextId: recovery.contextId },
      });
    } catch {
      await ctx.runMutation(internal.portalConnections.recordProfileRecoveryProbe, {
        ownerId, connectionId: args.connectionId, contextId: recovery.contextId,
        browserProvider: "firecrawl", generation: recovery.generation,
        outcome: "review", errorCode: "FIRECRAWL_PROFILE_RECOVERY_INSPECTION_FAILED",
      });
      return { status: "review" };
    }
    if (inspection.outcome === "authenticated") {
      await ctx.runMutation(internal.portalConnections.recordProfileRecoveryProbe, {
        ownerId, connectionId: args.connectionId, contextId: recovery.contextId,
        browserProvider: "firecrawl", generation: recovery.generation, outcome: "ready",
      });
      return { status: "completed" };
    }
    if (inspection.outcome === "awaiting_verification" && recovery.latestVerificationMailboxId && recovery.latestVerificationRequestedAt) {
      const runId: Id<"browserRuns"> = await ctx.runMutation(internal.portalConnections.reserveRun, {
        ownerId, connectionId: args.connectionId, kind: "authenticate", browserProvider: "firecrawl",
      });
      await ctx.runMutation(internal.portalConnections.recordProfileRecoveryProbe, {
        ownerId, connectionId: args.connectionId, contextId: recovery.contextId,
        browserProvider: "firecrawl", generation: recovery.generation, outcome: "awaiting_verification",
      });
      await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, {
        ownerId, runId, stage: "waiting_verification", mailboxId: recovery.latestVerificationMailboxId,
        verificationRequestedAt: recovery.latestVerificationRequestedAt, pollAttempt: 0,
        humanRequired: false, eventMessage: "RECOVERED_WAITING_FOR_AGENTMAIL_VERIFICATION",
      });
      await ctx.scheduler.runAfter(ONBOARDING_POLL_MS, internal.firecrawlPortal.continueAgentRegistration, { ownerId, runId });
      return { status: "waiting_verification", runId };
    }
    const outcome = inspection.outcome === "auth_needed" ? "auth_needed" : "review";
    await ctx.runMutation(internal.portalConnections.recordProfileRecoveryProbe, {
      ownerId, connectionId: args.connectionId, contextId: recovery.contextId,
      browserProvider: "firecrawl", generation: recovery.generation, outcome,
      errorCode: outcome === "auth_needed" ? "FIRECRAWL_MANUAL_LOGIN_UNSUPPORTED" : "FIRECRAWL_PROFILE_RECOVERY_REVIEW_REQUIRED",
    });
    return { status: outcome };
  },
});

export const runRecon = action({
  args: { connectionId: v.id("portalConnections"), path: v.optional(v.string()) },
  returns: v.object({ runId: v.id("browserRuns"), items: v.array(v.object({ title: v.string(), url: v.string() })) }),
  handler: async (ctx, args): Promise<{ runId: Id<"browserRuns">; items: Array<{ title: string; url: string }> }> => {
    const ownerId = await requireActionUserId(ctx);
    const connection: WorkerConnection = await connectionForFirecrawl(ctx, ownerId, args.connectionId);
    if (!connection.allowReadOnlyRecon) throw new ConvexError({ code: "RECON_NOT_ALLOWED" });
    const targetUrl = buildAllowedPortalUrl({ baseUrl: connection.baseUrl, path: args.path ?? connection.allowedPaths[0] ?? "/", allowedDomains: connection.allowedDomains, allowedPaths: connection.allowedPaths });
    const runId: Id<"browserRuns"> = await ctx.runMutation(internal.portalConnections.reserveRun, { ownerId, connectionId: args.connectionId, kind: "recon", browserProvider: "firecrawl" });
    let session: FirecrawlPortalSession | undefined;
    try {
      session = await openFirecrawlPortalSession(ctx, { baseUrl: connection.baseUrl, adapterKey: connection.adapterKey ?? "", profileName: connection.providerContextId!, path: new URL(targetUrl).pathname, saveChanges: false, timeoutMs: 60_000 });
      await ctx.runMutation(internal.portalConnections.attachProviderRun, { runId, ownerId, providerSessionId: session.scrapeId, providerContextId: connection.providerContextId, browserProvider: "firecrawl", humanRequired: false });
      const raw = await session.runProgram(`
        const current = new URL(await page.url());
        if (current.origin !== vars.origin || current.pathname !== vars.path) throw new Error("PORTAL_NAVIGATION_ESCAPED");
        const authenticated = await page.evaluate(() => Boolean(document.querySelector("[data-roomscout-inbox-state], [data-roomscout-thread-state], [data-roomscout-authenticated]")));
        if (vars.requireAuth && !authenticated) throw new Error("PORTAL_AUTH_REQUIRED");
        return await page.evaluate(() => Array.from(document.querySelectorAll("a[href]")).slice(0, 100).map((anchor) => ({ title: (anchor.textContent ?? "").trim(), url: anchor.href })));
      `, { origin: new URL(connection.baseUrl).origin, path: new URL(targetUrl).pathname, requireAuth: connection.accessMode === "authenticated" }, false);
      const items: Array<{ title: string; url: string }> = Array.isArray(raw) ? raw.flatMap((item: unknown): Array<{ title: string; url: string }> => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        if (typeof row.title !== "string" || typeof row.url !== "string") return [];
        try { const url = new URL(row.url); return connection.allowedDomains.includes(url.hostname) ? [{ title: row.title.slice(0, 500), url: url.toString() }] : []; } catch { return []; }
      }) : [];
      await ctx.runMutation(internal.portalConnections.finishRun, { runId, status: "completed", resultCount: items.length });
      return { runId, items };
    } catch { await ctx.runMutation(internal.portalConnections.finishRun, { runId, status: "failed", errorCode: "FIRECRAWL_RECON_FAILED" }); throw new ConvexError({ code: "FIRECRAWL_RECON_FAILED" }); }
    finally { if (session) await stopRunSessionOrSchedule(ctx, session, ownerId, runId); }
  },
});

export async function startAgentRegistrationForOwner(ctx: ActionCtx, ownerId: Id<"users">, connectionId: Id<"portalConnections">, preReservedRunId?: Id<"browserRuns">): Promise<{ runId: Id<"browserRuns">; status: "waiting_verification" | "human_required" | "completed" }> {
  requireSelectedFirecrawl();
  const connection = await ctx.runQuery(internal.portalConnections.getConnectionForWorker, { ownerId, connectionId }) as WorkerConnection | null;
  if (!connection || connection.browserProvider !== "firecrawl" || connection.adapterKey !== "roomscout-dev-v1") throw new ConvexError({ code: "AGENT_REGISTRATION_NOT_REVIEWED" });
  const runId: Id<"browserRuns"> = preReservedRunId ?? await ctx.runMutation(internal.portalConnections.reserveRun, { ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl" });
  const reservedRun = await ctx.runQuery(internal.portalConnections.getRunForOwner, { ownerId, runId });
  if (!reservedRun) throw new ConvexError({ code: "RUN_NOT_FOUND" });
  const deadlineAt = reservedRun.expiresAt;
  // A ready context reuses its saved profile. Before that, every attempt gets
  // its own profile name: a previous attempt whose session could not be
  // stopped keeps a write lock on its profile until the session TTL expires,
  // and a shared name would turn that into a 409 for every retry.
  const profileName = connection.providerContextId ?? `roomscout_${connectionId}_${runId}`;
  let session: FirecrawlPortalSession | undefined;
  let phase: RegistrationPhase = "mailbox";
  try {
    remainingRunMs(deadlineAt);
    const mailbox = await ctx.runAction(internal.mailboxes.ensureForOwner, { ownerId });
    if (mailbox.status !== "active") throw new ConvexError({ code: mailbox.status === "pending" ? "AGENTMAIL_PROVISIONING" : "AGENTMAIL_NOT_CONFIGURED" });
    phase = "session_open";
    // The session stays open across the AgentMail wait, so its budget is the
    // run's, not one program's; every program inside carries its own timeout.
    session = await openFirecrawlPortalSession(ctx, { baseUrl: connection.baseUrl, adapterKey: connection.adapterKey, profileName, path: "/sign-up", saveChanges: true, timeoutMs: Math.min(REGISTRATION_SESSION_DEADLINE_MS, remainingRunMs(deadlineAt)) });
    phase = "run_attach";
    await ctx.runMutation(internal.portalConnections.attachProviderRun, { runId, ownerId, providerSessionId: session.scrapeId, providerContextId: profileName, browserProvider: "firecrawl", humanRequired: false });
    phase = "progress";
    await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId, runId, stage: "opening_signup", mailboxId: mailbox.mailboxId, pollAttempt: 0, humanRequired: false, eventMessage: "AGENT_SIGNUP_OPENED" });
    phase = "signup";
    // One program: terms gate, both fields, the exact readback, one submit and
    // the OTP field awaited inside the sandbox (plan S4).
    const access = await signUpOnFirecrawlPortal({ session, email: mailbox.emailAddress, password: `Rs!${crypto.randomUUID().replaceAll("-", "")}aA1` });
    remainingRunMs(deadlineAt);
    if (access.outcome === "human_required") {
      await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId, runId, stage: "human_required", mailboxId: mailbox.mailboxId, humanRequired: true, eventMessage: `SIGNUP_${access.blocker.toUpperCase()}_REQUIRES_HUMAN` });
      return { runId, status: "human_required" as const };
    }
    // A field that did not read back exactly is a timing fault on a form that
    // was never submitted, so it fails the run instead of asking for a human.
    if (access.outcome === "mismatch") throw new Error("FIRECRAWL_SIGNUP_VALUE_MISMATCH");
    if (access.outcome === "authenticated") {
      phase = "session_stop";
      await stopRegistrationSession(ctx, session, { ownerId, runId });
      session = undefined;
      phase = "profile_proof";
      return await finishRegistrationWithProof(ctx, { ownerId, runId, connectionId, authenticated: true, deadlineAt });
    }
    // OTP continuation runs INLINE in the same Firecrawl session. A Firecrawl
    // scrape-bound session cannot be reconnected, and Clerk's in-progress
    // sign-up transaction lives in that one browser, so a second session on
    // /sign-up would show no verification field. The verification code is
    // polled from AgentMail's REST inbox directly (not the webhook-backed
    // mailboxMessages table) so a delayed webhook cannot stall the run. This
    // mirrors the proven Stagehand path; the scheduler-based
    // continueAgentRegistration is never used for Firecrawl.
    const verificationRequestedAt = Date.now() - 5_000;
    await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId, runId, stage: "waiting_verification", mailboxId: mailbox.mailboxId, verificationRequestedAt, pollAttempt: 0, humanRequired: false, eventMessage: "WAITING_FOR_AGENTMAIL_VERIFICATION" });
    const verification = await waitForFirecrawlVerification({
      emailAddress: mailbox.emailAddress,
      receivedAfter: verificationRequestedAt,
      portalDomain: new URL(connection.baseUrl).hostname,
      deadlineAt,
      keepAlive: async () => { await session!.runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false, KEEPALIVE_TIMEOUT_MS).catch(() => undefined); },
    });
    if (!verification) {
      await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId, runId, stage: "human_required", mailboxId: mailbox.mailboxId, pollAttempt: ONBOARDING_MAX_POLLS, humanRequired: true, eventMessage: "VERIFICATION_EMAIL_NOT_FOUND" });
      return { runId, status: "human_required" as const };
    }
    // verification.messageId is AgentMail's opaque id, not a Convex
    // mailboxMessages id, so it is not stored on the onboarding state (the
    // Stagehand inline path omits it too).
    await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId, runId, stage: "submitting_verification", mailboxId: mailbox.mailboxId, humanRequired: false, eventMessage: "VERIFICATION_CODE_RECEIVED" });
    remainingRunMs(deadlineAt);
    phase = "verification";
    // Second and last program of the registration: fill the code, submit once,
    // and wait for Clerk's authenticated session inside the sandbox.
    const verified = await submitFirecrawlPortalVerification({ session, code: verification.code });
    if (!verified.authenticated) {
      await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId, runId, stage: "human_required", mailboxId: mailbox.mailboxId, humanRequired: true, eventMessage: "VERIFICATION_REQUIRES_HUMAN" });
      return { runId, status: "human_required" as const };
    }
    phase = "session_stop";
    await stopRegistrationSession(ctx, session, { ownerId, runId });
    session = undefined;
    phase = "profile_proof";
    // The authenticated session observed by the verification program IS the
    // proof (plan S3/S4); no second session is opened on the saved profile.
    return await finishRegistrationWithProof(ctx, { ownerId, runId, connectionId, authenticated: true, deadlineAt });
  } catch (error) {
    const errorCode = firecrawlRegistrationFailureCode(error, phase);
    // The phase code names the step; the session's own last failure names the
    // cause, so it is recorded on the run timeline next to it.
    const innerCode = session?.lastErrorCode?.() ?? null;
    if (innerCode !== null && innerCode !== errorCode) {
      await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, {
        ownerId, runId, stage: "failed", humanRequired: false,
        eventMessage: `${errorCode}:${innerCode}`,
      }).catch(() => undefined);
    }
    await ctx.runMutation(internal.portalConnections.finishRun, { runId, status: "failed", errorCode });
    throw new ConvexError({ code: errorCode });
  } finally {
    if (session) await stopRegistrationSession(ctx, session, { ownerId, runId }).catch(() => undefined);
  }
}

/**
 * Close the registration run on the proof the registration session itself
 * produced. The authenticated Clerk session observed by the last program is the
 * proof (plan S3/S4); a second session on the same profile only ever created
 * the 409 it then reported as `CONTEXT_PROFILE_NOT_READY`.
 */
async function finishRegistrationWithProof(ctx: ActionCtx, input: { ownerId: Id<"users">; runId: Id<"browserRuns">; connectionId: Id<"portalConnections">; authenticated: boolean; deadlineAt?: number }) {
  const context = await ctx.runQuery(internal.portalConnections.getContextForOwner, { ownerId: input.ownerId, connectionId: input.connectionId });
  if (!context || context.browserProvider !== "firecrawl") throw new Error("PORTAL_BROWSER_PROVIDER_MISMATCH");
  const run = input.deadlineAt === undefined ? await ctx.runQuery(internal.portalConnections.getRunForOwner, { ownerId: input.ownerId, runId: input.runId }) : null;
  const deadlineAt = input.deadlineAt ?? run?.expiresAt;
  if (!deadlineAt) throw new Error("RUN_NOT_FOUND");
  remainingRunMs(deadlineAt);
  await ctx.runMutation(internal.portalConnections.recordContextProbeResult, {
    ownerId: input.ownerId, connectionId: input.connectionId, contextId: context.contextId, runId: input.runId,
    browserProvider: "firecrawl", success: input.authenticated,
    errorCode: input.authenticated ? undefined : "CONTEXT_PROFILE_NOT_READY",
    attempt: 1, deadlineAt: Date.now(),
  });
  if (!input.authenticated) throw new Error("CONTEXT_PROFILE_NOT_READY");
  await ctx.runMutation(internal.portalConnections.finishRun, { runId: input.runId, status: "completed", resultCount: 1, contextReady: true });
  return { runId: input.runId, status: "completed" as const };
}

export const startAgentRegistration = action({ args: { connectionId: v.id("portalConnections") }, returns: registrationResultValidator, handler: async (ctx, args): Promise<{ runId: Id<"browserRuns">; status: "waiting_verification" | "human_required" | "completed" }> => await startAgentRegistrationForOwner(ctx, await requireActionUserId(ctx), args.connectionId) });
export const startAgentRegistrationForOwnerAction = internalAction({ args: { ownerId: v.id("users"), connectionId: v.id("portalConnections"), runId: v.optional(v.id("browserRuns")) }, returns: registrationResultValidator, handler: async (ctx, args) => await startAgentRegistrationForOwner(ctx, args.ownerId, args.connectionId, args.runId) });

export const runScheduledAgentRegistration = internalAction({
  args: { ownerId: v.id("users"), savedNeedId: v.id("savedNeeds"), connectionId: v.id("portalConnections"), runId: v.id("browserRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      requireSelectedFirecrawl();
      const valid = await ctx.runQuery(internal.portalConnections.validateRunProvider, { ownerId: args.ownerId, runId: args.runId, browserProvider: "firecrawl" });
      const eligible = valid && await ctx.runQuery(internal.scoutOrchestrator.validateScheduledRegistration, args);
      if (!eligible) {
        await ctx.runMutation(internal.portalConnections.failReservedRun, { runId: args.runId, errorCode: "REGISTRATION_SEARCH_NO_LONGER_ACTIVE" });
        return null;
      }
      await startAgentRegistrationForOwner(ctx, args.ownerId, args.connectionId, args.runId);
    } catch (error) {
      const code = error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data && error.data.code === "FIRECRAWL_NOT_CONFIGURED"
        ? "FIRECRAWL_NOT_CONFIGURED" : "FIRECRAWL_REGISTRATION_FAILED";
      await ctx.runMutation(internal.portalConnections.failReservedRun, { runId: args.runId, errorCode: code });
    }
    return null;
  },
});

export const continueAgentRegistration = internalAction({
  args: { ownerId: v.id("users"), runId: v.id("browserRuns") }, returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.runQuery(internal.portalConnections.getRunForOwner, args);
    if (!run || run.browserProvider !== "firecrawl" || run.status !== "running" || run.onboardingStage !== "waiting_verification" || !run.onboardingMailboxId || !run.verificationRequestedAt) return null;
    if (run.expiresAt - Date.now() <= RUN_TEARDOWN_RESERVE_MS) {
      await ctx.runMutation(internal.portalConnections.finishRun, { runId: run.runId, status: "failed", errorCode: "VERIFICATION_TIMEOUT", reauthRequired: true });
      return null;
    }
    if (!await ctx.runQuery(internal.portalConnections.validateRunProvider, { ownerId: args.ownerId, runId: args.runId, browserProvider: "firecrawl" })) return null;
    const connection = await ctx.runQuery(internal.portalConnections.getConnectionForWorker, { ownerId: args.ownerId, connectionId: run.connectionId });
    const context = await ctx.runQuery(internal.portalConnections.getContextForOwner, { ownerId: args.ownerId, connectionId: run.connectionId });
    if (!connection || !context) return null;
    const messages = await ctx.runQuery(internal.inbox.latestPortalVerificationForOwner, { ownerId: args.ownerId, mailboxId: run.onboardingMailboxId, receivedAfter: run.verificationRequestedAt, limit: 20 });
    const message = messages.find((item: { from: string; subject: string; body: string; messageId: Id<"mailboxMessages"> }) => isRelevantPortalVerificationMessage({ from: item.from, subject: item.subject, body: item.body, portalDomain: new URL(connection.baseUrl).hostname }));
    if (!message) {
      const attempt = (run.onboardingPollAttempt ?? 0) + 1;
      if (attempt >= ONBOARDING_MAX_POLLS || run.expiresAt <= Date.now()) { await ctx.runMutation(internal.portalConnections.finishRun, { runId: run.runId, status: "failed", errorCode: "VERIFICATION_TIMEOUT", reauthRequired: true }); return null; }
      await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId: args.ownerId, runId: run.runId, stage: "waiting_verification", mailboxId: run.onboardingMailboxId, pollAttempt: attempt, humanRequired: false, eventMessage: "VERIFICATION_EMAIL_POLL" });
      await ctx.scheduler.runAfter(Math.min(ONBOARDING_POLL_MS, remainingRunMs(run.expiresAt)), internal.firecrawlPortal.continueAgentRegistration, args); return null;
    }
    const code = extractPortalVerificationCode(`${message.subject}\n${message.body}`);
    if (!code) { await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, { ownerId: args.ownerId, runId: run.runId, stage: "human_required", mailboxId: run.onboardingMailboxId, verificationMessageId: message.messageId, humanRequired: true, eventMessage: "VERIFICATION_CODE_AMBIGUOUS" }); return null; }
    await ctx.runMutation(internal.portalConnections.markAgentOnboardingState, {
      ownerId: args.ownerId, runId: run.runId, stage: "submitting_verification",
      mailboxId: run.onboardingMailboxId, verificationMessageId: message.messageId,
      humanRequired: false, eventMessage: "VERIFICATION_CODE_RECEIVED",
    });
    try {
      remainingRunMs(run.expiresAt);
      const access = await runFirecrawlRegistrationStep(ctx, {
        baseUrl: connection.baseUrl, adapterKey: connection.adapterKey ?? "", profileName: context.providerContextId,
        verificationCode: code, deadlineAt: run.expiresAt,
        cleanup: { ownerId: args.ownerId, connectionId: run.connectionId, contextId: context.contextId },
      });
      if (access.outcome !== "authenticated") {
        await ctx.runMutation(internal.portalConnections.finishRun, { runId: run.runId, status: "failed", errorCode: "VERIFICATION_REQUIRES_HUMAN", reauthRequired: true });
        return null;
      }
      await finishRegistrationWithProof(ctx, { ownerId: args.ownerId, runId: run.runId, connectionId: run.connectionId, authenticated: true, deadlineAt: run.expiresAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const errorCode = /^FIRECRAWL_[A-Z0-9_]{1,90}$/.test(message)
        ? message
        : "FIRECRAWL_VERIFICATION_FAILED";
      await ctx.runMutation(internal.portalConnections.finishRun, { runId: run.runId, status: "failed", errorCode, reauthRequired: true });
    }
    return null;
  },
});
