"use node";

import { z, type ZodType } from "zod";
import type { GenericActionCtx, GenericDataModel } from "convex/server";
import type { FirecrawlRoomScoutClient } from "../components/firecrawlRoomScout/client";
import { buildFirecrawlProgram, parseInteractEnvelope } from "./firecrawlProgram";
import { PORTAL_DOM_EXPRESSIONS, readPortalDomEvidenceFromPage } from "./portalDomEvidence";
import { portalFormInspectionExpression } from "./portalFormInspection";
import { REVIEWED_PORTAL_ORIGIN, reviewedPortalUrl } from "./reviewedPortalUrl";
import type {
  PortalDomEvidence,
  StagehandObservedAction,
  StagehandPortalPrimitives,
} from "./stagehandPortalDriver";

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
  primitives: StagehandPortalPrimitives;
  stop(): Promise<void>;
  liveView(): Promise<string>;
  runProgram(
    body: string,
    vars: Record<string, unknown>,
    mutating?: boolean,
    timeoutOverrideMs?: number,
  ): Promise<unknown>;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
/** A stop must always reach the provider, even after the run budget is gone. */
const STOP_TIMEOUT_MS = 20_000;
const MIN_STOP_TIMEOUT_MS = 5_000;
/** Every program returns the page URL; `getUrl` reuses it for this long. */
const URL_CACHE_TTL_MS = 2_000;
/** Time given to a DOM element or auth state to appear inside one program. */
const IN_SANDBOX_WAIT_MS = 1_500;
const AUTH_SETTLE_WAIT_MS = 2_000;
/** Short settle after a click or fill so the returned URL reflects the action. */
const ACTION_SETTLE_MS = 200;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Session-level helpers shared by the primitives and `runProgram`. */
type SessionShared = {
  now(): number;
  /** Space requests to stay under the team's per-minute Interact limit. */
  pace(): Promise<void>;
  rememberUrl(result: unknown): void;
  cachedUrl(): string | null;
};

function timeoutMs(value: number | undefined): number {
  const timeout = Math.floor(value ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > MAX_TIMEOUT_MS) {
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

function currentOriginGuard(): string {
  return `const currentUrl = await page.url();
    if (new URL(currentUrl).origin !== vars.origin) throw new Error("PORTAL_NAVIGATION_ESCAPED");`;
}

function selectorForInstruction(instruction: string): StagehandObservedAction | null {
  if (instruction.includes("email-address input")) return { description: "Reviewed email field", selector: 'input[name="emailAddress"]', method: "fill", arguments: ["%email%"] };
  if (instruction.includes("password input")) return { description: "Reviewed password field", selector: 'input[name="password"]', method: "fill", arguments: ["%password%"] };
  if (instruction.includes("verification-code input")) return { description: "Reviewed verification field", selector: 'input[autocomplete="one-time-code"],input[name="code"]', method: "fill", arguments: ["%verificationCode%"] };
  if (instruction.includes("sender-label input")) return { description: "Reviewed sender field", selector: '[data-roomscout-write="sender-label"]', method: "fill", arguments: ["%senderLabel%"] };
  if (instruction.includes("message-body textarea")) return { description: "Reviewed message field", selector: '[data-roomscout-write="body"]', method: "fill", arguments: ["%body%"] };
  if (instruction.includes("data-roomscout-write=demo-terms")) return { description: "Reviewed terms checkbox", selector: '[data-roomscout-write="demo-terms"]', method: "click", arguments: [] };
  if (instruction.includes("data-roomscout-write=accept-demo-terms")) return { description: "Reviewed terms accept", selector: '[data-roomscout-write="accept-demo-terms"]', method: "click", arguments: [] };
  return null;
}

function createPrimitives(input: {
  transport: FirecrawlPortalTransport;
  scrapeId: string;
  timeoutMs: number;
  remainingMs(): number;
  onEnvelope(value: unknown): void;
  shared: SessionShared;
}): StagehandPortalPrimitives {
  const run = async (body: string, vars: Record<string, unknown>, mutating: boolean) => {
    await input.shared.pace();
    const operationTimeoutMs = input.remainingMs();
    let envelope: unknown;
    try {
      envelope = await input.transport.interact(input.scrapeId, {
        code: buildFirecrawlProgram(body, vars),
        language: "node",
        timeout: interactTimeoutSeconds(operationTimeoutMs),
        requestTimeoutMs: operationTimeoutMs,
        mutating,
        allowUnsuccessfulBody: true,
      });
    } catch (error) {
      // eslint-disable-next-line preserve-caught-error -- Provider diagnostics must not cross the credential boundary.
      throw new Error(firecrawlTransportErrorCode(error, "INTERACT"));
    }
    input.onEnvelope(envelope);
    const parsed = parseInteractEnvelope(envelope);
    input.shared.rememberUrl(parsed);
    return parsed;
  };
  // Short waits inside the sandbox: the driver polls fields and evidence in a
  // loop, and every iteration would otherwise be one rate-limited request.
  const inSandboxWaitMs = () => Math.max(0, Math.min(IN_SANDBOX_WAIT_MS, input.remainingMs() - 1_000));
  const authWaitMs = () => Math.max(0, Math.min(AUTH_SETTLE_WAIT_MS, input.remainingMs() - 1_000));
  const settledResult = `await page.waitForTimeout(vars.settleMs);
        return { ok: true, url: await page.url() };`;

  return {
    async navigate({ url }) {
      const target = reviewedPortalUrl(url);
      const navigationTimeoutMs = input.remainingMs();
      await run(`await page.goto(vars.url, { waitUntil: "domcontentloaded", timeout: vars.timeoutMs });
        ${currentOriginGuard()}
        return { url: currentUrl };`, { url: target, timeoutMs: navigationTimeoutMs, origin: REVIEWED_PORTAL_ORIGIN }, false);
    },
    async getUrl() {
      const cached = input.shared.cachedUrl();
      if (cached !== null) return cached;
      const result = record(await run("return { url: await page.url() };", {}, false));
      if (typeof result?.url !== "string") throw new Error("FIRECRAWL_PORTAL_URL_INVALID");
      return result.url;
    },
    async observe({ instruction }) {
      const action = selectorForInstruction(instruction);
      return action ? [action] : [];
    },
    async act({ action, options }) {
      if (action.method === "fill") {
        const placeholder = action.arguments?.find((value) => /^%[A-Za-z]+%$/.test(value));
        const variable = placeholder?.slice(1, -1);
        const value = variable ? options?.variables?.[variable] : undefined;
        if (typeof value !== "string") throw new Error("FIRECRAWL_PORTAL_ACTION_INVALID");
        await run(`${currentOriginGuard()}
          await page.locator(vars.selector).fill(vars.value);
          ${settledResult}`, { origin: REVIEWED_PORTAL_ORIGIN, selector: action.selector, value, settleMs: ACTION_SETTLE_MS }, true);
        return;
      }
      if (action.method !== "click") throw new Error("FIRECRAWL_PORTAL_ACTION_INVALID");
      await run(`${currentOriginGuard()}
        await page.locator(vars.selector).click();
        ${settledResult}`, { origin: REVIEWED_PORTAL_ORIGIN, selector: action.selector, settleMs: ACTION_SETTLE_MS }, true);
    },
    async clickSelector({ selector }) {
      await run(`${currentOriginGuard()}
        await page.locator(vars.selector).click();
        ${settledResult}`, { origin: REVIEWED_PORTAL_ORIGIN, selector, settleMs: ACTION_SETTLE_MS }, true);
    },
    async fillSelector({ selector, value }) {
      await run(`${currentOriginGuard()}
        await page.locator(vars.selector).fill(vars.value);
        ${settledResult}`, { origin: REVIEWED_PORTAL_ORIGIN, selector, value, settleMs: ACTION_SETTLE_MS }, true);
    },
    async extract<Schema extends ZodType>({ schema }: { instruction: string; schema: Schema }): Promise<z.output<Schema>> {
      const result = await run(`${currentOriginGuard()}
        const state = await page.evaluate(() => {
          const path = window.location.pathname;
          const clerk = window.Clerk;
          const auth = Boolean(
            ((path === "/" || path === "/listings/new") && clerk?.loaded && clerk?.user && clerk?.session) ||
            ((path === "/inbox" || /^\\/inbox\\/[A-Za-z0-9_-]+$/.test(path) || /^\\/listings\\/[A-Za-z0-9_-]+$/.test(path)) && document.querySelector("[data-roomscout-inbox-state], [data-roomscout-thread-state=ready], textarea[data-roomscout-write=body]"))
          );
          const code = document.querySelector('input[autocomplete="one-time-code"],input[name="code"]');
          const password = document.querySelector('input[name="password"]');
          const captcha = document.querySelector('iframe[src*="captcha" i],iframe[src*="turnstile" i],[data-sitekey]');
          return { authenticated: auth, stage: auth ? "authenticated" : code ? "verification" : path === "/sign-up" ? "sign_up" : path === "/sign-in" || password ? "sign_in" : "unknown", blocker: captcha ? "captcha" : null };
        });
        return state;`, { origin: REVIEWED_PORTAL_ORIGIN }, false);
      return schema.parse(result);
    },
    async readEvidence({ kind }: { kind: PortalDomEvidence["kind"] }) {
      // Let the expected DOM or auth state settle inside the sandbox first, so
      // the driver's poll loops converge in one or two requests.
      const waitSelector = kind === "receipt" ? '[data-roomscout-write-result]'
        : kind === "thread" ? '[data-roomscout-thread-state="ready"]'
        : kind === "inbox" ? '[data-roomscout-inbox-state]'
        : null;
      const result = record(await run(`${currentOriginGuard()}
        if (vars.waitSelector) await page.waitForSelector(vars.waitSelector, { state: "attached", timeout: vars.waitMs }).catch(() => null);
        if (vars.waitAuth) await page.waitForFunction(() => window.Clerk?.loaded === true && Boolean(window.Clerk?.user && window.Clerk?.session), undefined, { timeout: vars.waitMs }).catch(() => null);
        const settledUrl = await page.url();
        return { url: settledUrl, raw: await page.evaluate(vars.expression) };`, {
        origin: REVIEWED_PORTAL_ORIGIN,
        expression: PORTAL_DOM_EXPRESSIONS[kind],
        waitSelector,
        waitAuth: kind === "access",
        waitMs: kind === "access" ? authWaitMs() : inSandboxWaitMs(),
      }, false));
      if (typeof result?.url !== "string" || !("raw" in (result ?? {}))) {
        // Shape only, never content: which keys came back instead of { url, raw }.
        console.error("FIRECRAWL_PORTAL_EVIDENCE_INVALID", { kind, type: result === null ? "null" : typeof result, keys: Object.keys(result ?? {}).slice(0, 12) });
        throw new Error("FIRECRAWL_PORTAL_EVIDENCE_INVALID");
      }
      return await readPortalDomEvidenceFromPage({
        url: () => result.url as string,
        evaluate: async <Result>() => result.raw as Result,
      }, kind);
    },
    async inspectForm(formInput) {
      const result = await run(`${currentOriginGuard()}
        await page.waitForSelector(vars.selector, { state: "attached", timeout: vars.waitMs }).catch(() => null);
        const inspection = await page.evaluate(vars.expression);
        return { ...inspection, url: await page.url() };`, {
        origin: REVIEWED_PORTAL_ORIGIN,
        expression: portalFormInspectionExpression(formInput),
        selector: formInput.selector,
        waitMs: inSandboxWaitMs(),
      }, false);
      return z.object({
        count: z.number(), visible: z.boolean(), editable: z.boolean(),
        name: z.string().nullable(), type: z.string().nullable(),
        autocomplete: z.string().nullable(), required: z.boolean(),
        value: z.string().nullable(), formValid: z.boolean().nullable(),
      }).parse(result);
    },
    async wait(milliseconds) {
      if (!Number.isFinite(milliseconds) || milliseconds < 0 || milliseconds > input.timeoutMs) {
        throw new Error("FIRECRAWL_PORTAL_WAIT_INVALID");
      }
      // A pause needs no browser round trip; spending a rate-limited request
      // on it was the single largest source of Interact calls per run.
      const ms = Math.floor(milliseconds);
      if (ms >= input.remainingMs()) throw new Error("FIRECRAWL_PORTAL_DEADLINE_EXCEEDED");
      await sleep(ms);
    },
  };
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
  const timeout = timeoutMs(input.timeoutMs);
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
  let urlCache: { url: string; at: number } | null = null;
  const shared: SessionShared = {
    now,
    async pace() {
      if (minIntervalMs <= 0) return;
      const waitMs = lastDispatchAt + minIntervalMs - now();
      if (waitMs > 0) {
        if (waitMs >= remainingMs()) throw new Error("FIRECRAWL_PORTAL_DEADLINE_EXCEEDED");
        await sleep(waitMs);
      }
      lastDispatchAt = now();
    },
    rememberUrl(result) {
      const url = record(result)?.url;
      if (typeof url === "string") urlCache = { url, at: now() };
    },
    cachedUrl() {
      return urlCache !== null && now() - urlCache.at <= URL_CACHE_TTL_MS ? urlCache.url : null;
    },
  };
  const primitives = createPrimitives({
    transport: input.transport,
    scrapeId,
    timeoutMs: timeout,
    remainingMs,
    onEnvelope: (value) => { latestLiveView = liveViewFrom(value) ?? latestLiveView; },
    shared,
  });
  const runProgram = async (
    body: string,
    vars: Record<string, unknown>,
    mutating = false,
    timeoutOverrideMs?: number,
  ) => {
    await shared.pace();
    const programTimeout = Math.min(
      timeoutMs(timeoutOverrideMs ?? timeout),
      remainingMs(),
    );
    let envelope: unknown;
    try {
      envelope = await input.transport.interact(scrapeId, {
        code: buildFirecrawlProgram(body, vars),
        language: "node",
        timeout: interactTimeoutSeconds(programTimeout),
        requestTimeoutMs: programTimeout,
        mutating,
        allowUnsuccessfulBody: true,
      });
    } catch (error) {
      // eslint-disable-next-line preserve-caught-error -- Provider diagnostics must not cross the credential boundary.
      throw new Error(firecrawlTransportErrorCode(error, "INTERACT"));
    }
    latestLiveView = liveViewFrom(envelope) ?? latestLiveView;
    const parsed = parseInteractEnvelope(envelope);
    shared.rememberUrl(parsed);
    return parsed;
  };
  return {
    scrapeId,
    profileName: input.profileName,
    openedAt,
    primitives,
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
    async liveView() {
      await primitives.getUrl();
      if (!latestLiveView) throw new Error("FIRECRAWL_PORTAL_LIVE_VIEW_UNAVAILABLE");
      return latestLiveView;
    },
    runProgram,
  };
}
