"use node";

import type { GenericActionCtx, GenericDataModel } from "convex/server";
import type { FirecrawlRoomScoutClient } from "../components/firecrawlRoomScout/client";
import { buildFirecrawlProgram, parseInteractEnvelope } from "./firecrawlProgram";
import { reviewedPortalUrl } from "./reviewedPortalUrl";

export type FirecrawlInteractOptions = {
  code: string;
  language: "node";
  /** Firecrawl program execution timeout, in seconds. */
  timeout: number;
  /** End-to-end HTTP request deadline, in milliseconds. */
  requestTimeoutMs: number;
  mutating: boolean;
  allowUnsuccessfulBody: true;
};

export interface FirecrawlPortalTransport {
  scrape(input: {
    url: string;
    profileName: string;
    saveChanges: boolean;
    timeoutMs: number;
  }): Promise<unknown>;
  interact(scrapeId: string, options: FirecrawlInteractOptions): Promise<unknown>;
  stop(scrapeId: string, requestTimeoutMs: number): Promise<unknown>;
}

type PortalActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

/** Bind the runtime to the vendored component while keeping tests transport-only. */
export function firecrawlComponentPortalTransport(input: {
  ctx: PortalActionCtx;
  client: FirecrawlRoomScoutClient;
}): FirecrawlPortalTransport {
  return {
    async scrape(args) {
      return await input.client.scrapeOnce(input.ctx, args.url, {
        formats: ["markdown"],
        onlyMainContent: true,
        // Interact requires the live browser tied to this scrapeId. A cached
        // scrape can return metadata for an already-closed browser session.
        maxAge: 0,
        storeInCache: false,
        timeout: args.timeoutMs,
        extra: {
          profile: { name: args.profileName, saveChanges: args.saveChanges },
        },
      }, args.timeoutMs);
    },
    async interact(scrapeId, options) {
      return await input.client.interact(input.ctx, scrapeId, options);
    },
    async stop(scrapeId, requestTimeoutMs) {
      return await input.client.stopInteraction(input.ctx, scrapeId, requestTimeoutMs);
    },
  };
}

export type FirecrawlPortalSession = {
  scrapeId: string;
  profileName: string;
  openedAt: number;
  stop(): Promise<void>;
  liveView(): Promise<string>;
  /**
   * The last Interact failure this session saw, or null. The Browserbase
   * driver flattens everything into `CONTROLLED_REGISTRATION_<step>_FAILED`
   * and drops the cause; this keeps the cause on the Firecrawl side so a run
   * event can still name it.
   */
  lastErrorCode(): string | null;
  runProgram(
    body: string,
    vars: Record<string, unknown>,
    mutating?: boolean,
    timeoutOverrideMs?: number,
  ): Promise<unknown>;
};

const DEFAULT_TIMEOUT_MS = 30_000;
/** Upper bound of one program's sandbox budget (Interact allows 300 s). */
const MAX_PROGRAM_TIMEOUT_MS = 120_000;
/**
 * Upper bound of a whole session. Registration holds one session open across
 * the AgentMail verification wait, so the session outlives every program in it.
 */
const MAX_SESSION_TIMEOUT_MS = 600_000;
/** A stop must always reach the provider, even after the run budget is gone. */
const STOP_TIMEOUT_MS = 20_000;
const MIN_STOP_TIMEOUT_MS = 5_000;
/**
 * Extra time the HTTP request gets over its program's sandbox timeout, so the
 * sandbox reports its own failure before the transport gives up (the local
 * scripts use the same sandbox + 30 s rule).
 */
const TRANSPORT_GRACE_MS = 30_000;
/** Bound for the remembered inner failure code reported on a run event. */
const MAX_RECORDED_ERROR_CODE_LENGTH = 120;
/** Reads the current page URL and nothing else; used as a session keepalive. */
export const FIRECRAWL_PORTAL_URL_PROGRAM = "return { url: await page.url() };";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function boundedTimeoutMs(value: number | undefined, maximum: number): number {
  const timeout = Math.floor(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > maximum) {
    throw new Error("FIRECRAWL_PORTAL_TIMEOUT_INVALID");
  }
  return timeout;
}

/** Convert our millisecond operation budget to Firecrawl Interact seconds. */
export function interactTimeoutSeconds(milliseconds: number): number {
  return Math.max(1, Math.min(300, Math.ceil(milliseconds / 1_000)));
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function providerStatus(error: unknown): number | undefined {
  const candidate = record(error);
  const data = record(candidate?.data);
  return typeof data?.status === "number" ? data.status : undefined;
}

export function firecrawlTransportErrorCode(error: unknown, operation: "SCRAPE" | "INTERACT"): string {
  const status = providerStatus(error);
  const suffix = status === 401 || status === 403 ? "AUTH_FAILED"
    : status === 408 ? "TIMED_OUT"
    : status === 429 ? "RATE_LIMITED"
    // Firecrawl answers 409 when another session still writes to the profile.
    : status === 409 ? "PROFILE_BUSY"
    : status !== undefined && status >= 500 ? "UNAVAILABLE"
    : status !== undefined && status >= 400 ? "REQUEST_REJECTED"
    : "TRANSPORT_FAILED";
  return `FIRECRAWL_PORTAL_${operation}_${suffix}`;
}

function scrapeIdFrom(value: unknown): string {
  const outer = record(value);
  const data = record(outer?.data) ?? outer;
  const metadata = record(data?.metadata);
  const scrapeId = metadata?.scrapeId;
  if (typeof scrapeId !== "string" || !/^[A-Za-z0-9_-]{1,300}$/.test(scrapeId)) {
    throw new Error("FIRECRAWL_PORTAL_SCRAPE_ID_MISSING");
  }
  return scrapeId;
}

function liveViewFrom(value: unknown): string | null {
  const envelope = record(value);
  const candidate = envelope?.interactiveLiveViewUrl ?? envelope?.liveViewUrl;
  if (typeof candidate !== "string") return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function createFirecrawlPortalSession(input: {
  transport: FirecrawlPortalTransport;
  url: string;
  profileName: string;
  saveChanges: boolean;
  timeoutMs?: number;
  now?: () => number;
  /** Minimum spacing between Interact requests; 0 disables pacing. */
  pacing?: { minIntervalMs: number };
}): Promise<FirecrawlPortalSession> {
  const url = reviewedPortalUrl(input.url);
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(input.profileName)) {
    throw new Error("FIRECRAWL_PORTAL_PROFILE_INVALID");
  }
  const timeout = boundedTimeoutMs(input.timeoutMs, MAX_SESSION_TIMEOUT_MS);
  const now = input.now ?? Date.now;
  const openedAt = now();
  const deadlineAt = openedAt + timeout;
  const remainingMs = () => {
    const remaining = Math.floor(deadlineAt - now());
    if (remaining <= 0) throw new Error("FIRECRAWL_PORTAL_DEADLINE_EXCEEDED");
    return remaining;
  };
  let scrape: unknown;
  try {
    scrape = await input.transport.scrape({
      url,
      profileName: input.profileName,
      saveChanges: input.saveChanges,
      timeoutMs: remainingMs(),
    });
  } catch (error) {
    // eslint-disable-next-line preserve-caught-error -- Provider diagnostics must not cross the credential boundary.
    throw new Error(firecrawlTransportErrorCode(error, "SCRAPE"));
  }
  const scrapeId = scrapeIdFrom(scrape);
  let latestLiveView = liveViewFrom(scrape);
  let stopPromise: Promise<void> | undefined;
  const minIntervalMs = Math.max(0, Math.floor(input.pacing?.minIntervalMs ?? 0));
  let lastDispatchAt = Number.NEGATIVE_INFINITY;
  /** Space requests to stay under the team's per-minute Interact limit. */
  const pace = async () => {
    if (minIntervalMs <= 0) return;
    const waitMs = lastDispatchAt + minIntervalMs - now();
    if (waitMs > 0) {
      if (waitMs >= remainingMs()) throw new Error("FIRECRAWL_PORTAL_DEADLINE_EXCEEDED");
      await sleep(waitMs);
    }
    lastDispatchAt = now();
  };
  let lastErrorCode: string | null = null;
  const recordFailure = (code: string) => {
    const trimmed = code.trim().slice(0, MAX_RECORDED_ERROR_CODE_LENGTH);
    if (trimmed) lastErrorCode = trimmed;
  };
  const runProgram = async (
    body: string,
    vars: Record<string, unknown>,
    mutating = false,
    timeoutOverrideMs?: number,
  ) => {
    await pace();
    // One budget per program, like the local proof: the sandbox gets its own
    // timeout and the HTTP request gets that plus a transport grace, both
    // clamped to what is left of the session. A program that hangs then fails
    // on its own deadline instead of consuming every following step's budget.
    const sandboxTimeoutMs = Math.min(
      boundedTimeoutMs(timeoutOverrideMs ?? Math.min(timeout, MAX_PROGRAM_TIMEOUT_MS), MAX_PROGRAM_TIMEOUT_MS),
      remainingMs(),
    );
    const requestTimeoutMs = Math.min(
      sandboxTimeoutMs + TRANSPORT_GRACE_MS,
      Math.max(remainingMs(), sandboxTimeoutMs),
    );
    let envelope: unknown;
    try {
      envelope = await input.transport.interact(scrapeId, {
        code: buildFirecrawlProgram(body, vars),
        language: "node",
        timeout: interactTimeoutSeconds(sandboxTimeoutMs),
        requestTimeoutMs,
        mutating,
        allowUnsuccessfulBody: true,
      });
    } catch (error) {
      const code = firecrawlTransportErrorCode(error, "INTERACT");
      recordFailure(code);
      // eslint-disable-next-line preserve-caught-error -- Provider diagnostics must not cross the credential boundary.
      throw new Error(code);
    }
    latestLiveView = liveViewFrom(envelope) ?? latestLiveView;
    let parsed: unknown;
    try {
      parsed = parseInteractEnvelope(envelope);
    } catch (error) {
      recordFailure(error instanceof Error ? error.message : "FIRECRAWL_INTERACT_RESULT_INVALID");
      throw error;
    }
    return parsed;
  };
  return {
    scrapeId,
    profileName: input.profileName,
    openedAt,
    stop() {
      // Never let an exhausted run budget skip the provider stop: an unstopped
      // session holds the profile write lock and a browser slot for its TTL.
      const remaining = Math.max(0, deadlineAt - now());
      const stopTimeoutMs = Math.max(MIN_STOP_TIMEOUT_MS, Math.min(STOP_TIMEOUT_MS, remaining || STOP_TIMEOUT_MS));
      stopPromise ??= input.transport.stop(scrapeId, stopTimeoutMs).then(
        () => undefined,
        () => { throw new Error("FIRECRAWL_PORTAL_STOP_FAILED"); },
      );
      return stopPromise;
    },
    lastErrorCode() {
      return lastErrorCode;
    },
    async liveView() {
      // One cheap program refreshes the envelope that carries the live-view URL.
      await runProgram(FIRECRAWL_PORTAL_URL_PROGRAM, {}, false);
      if (!latestLiveView) throw new Error("FIRECRAWL_PORTAL_LIVE_VIEW_UNAVAILABLE");
      return latestLiveView;
    },
    runProgram,
  };
}
