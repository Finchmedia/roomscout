import { z } from "zod";
import type { FirecrawlPortalSession } from "./firecrawlPortalRuntime";
import { REVIEWED_PORTAL_ORIGIN } from "./reviewedPortalUrl";

const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,160}$/);
const messageSchema = z.object({
  providerMessageId: idSchema,
  direction: z.enum(["inbound", "outbound", "unknown"]),
  senderLabel: z.string().max(300).optional(),
  bodyText: z.string(),
  sentAt: z.number().finite().nonnegative(),
});
const threadSchema = z.object({
  providerThreadId: idSchema,
  subject: z.string().max(500).optional(),
  participants: z.array(z.string().max(300)).max(20),
  lastMessageAt: z.number().finite().nonnegative(),
  messages: z.array(messageSchema).max(50),
});
const resultSchema = z.object({
  threads: z.array(threadSchema),
  missingThreadIds: z.array(idSchema),
  failedThreadIds: z.array(idSchema),
  bodyTruncatedThreadIds: z.array(idSchema),
  historyTruncatedThreadIds: z.array(idSchema),
  discoveredThreadIds: z.array(idSchema),
  truncated: z.boolean(),
  timedOut: z.boolean(),
  nextOffset: z.number().int().nonnegative(),
});

export type FirecrawlPortalInboxBatch = z.infer<typeof resultSchema>;

function boundedInt(value: number | undefined, fallback: number, min: number, max: number): number {
  const result = Math.floor(value ?? fallback);
  if (!Number.isFinite(result) || result < min || result > max) {
    throw new Error("FIRECRAWL_PORTAL_READ_LIMIT_INVALID");
  }
  return result;
}

/**
 * Read the inbox and a bounded round-robin batch of threads in one Interact
 * program. Every navigation has its own timeout and repeats the origin/auth
 * contract before any DOM is accepted.
 */
export async function readFirecrawlPortalInboxBatch(input: {
  session: FirecrawlPortalSession;
  requestedThreadIds?: string[];
  startOffset?: number;
  maxThreads?: number;
  maxMessagesPerThread?: number;
  maxBodyChars?: number;
  navigationTimeoutMs?: number;
  overallTimeoutMs?: number;
}): Promise<FirecrawlPortalInboxBatch> {
  let requested: string[];
  try {
    requested = [...new Set(input.requestedThreadIds ?? [])].map((value) => idSchema.parse(value));
  } catch {
    throw new Error("FIRECRAWL_PORTAL_THREAD_ID_INVALID");
  }
  if (requested.length > 40) throw new Error("FIRECRAWL_PORTAL_READ_LIMIT_INVALID");
  const limits = {
    startOffset: boundedInt(input.startOffset, 0, 0, 10_000),
    maxThreads: boundedInt(input.maxThreads, 10, 1, 20),
    maxMessages: boundedInt(input.maxMessagesPerThread, 20, 1, 50),
    maxBodyChars: boundedInt(input.maxBodyChars, 8_000, 100, 20_000),
    navigationTimeoutMs: boundedInt(input.navigationTimeoutMs, 12_000, 1_000, 30_000),
    overallTimeoutMs: boundedInt(input.overallTimeoutMs, 90_000, 5_000, 120_000),
  };
  const raw = await input.session.runProgram(`
    const deadline = Date.now() + vars.limits.overallTimeoutMs;
    const origin = vars.origin;
    const assertOrigin = async () => {
      if (new URL(await page.url()).origin !== origin) throw new Error("PORTAL_NAVIGATION_ESCAPED");
    };
    const navigate = async (url) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: vars.limits.navigationTimeoutMs });
      await assertOrigin();
    };
    const authenticated = async (kind, id) => await page.evaluate(({ kind, id }) => {
      if (kind === "inbox") return document.querySelectorAll('[data-roomscout-inbox-state="ready"], [data-roomscout-inbox-state="empty"]').length === 1;
      const rows = Array.from(document.querySelectorAll('[data-roomscout-thread-state="ready"]'));
      return rows.length === 1 && rows[0].dataset.roomscoutThreadId === id;
    }, { kind, id });
    await navigate(origin + "/inbox");
    if (!(await authenticated("inbox", null))) throw new Error("PORTAL_AUTH_REQUIRED");
    const discovered = await page.evaluate(() => Array.from(document.querySelectorAll('a[data-roomscout-thread-id][href]')).map((row) => row.dataset.roomscoutThreadId ?? ""));
    const valid = (value) => /^[A-Za-z0-9_-]{1,160}$/.test(value);
    const allDiscoveredIds = [...new Set(discovered.filter(valid))];
    const discoveredIds = allDiscoveredIds.slice(0, 100);
    const requestedIds = [...new Set(vars.requestedThreadIds.filter(valid))];
    const rotated = discoveredIds.length === 0 ? [] : discoveredIds.map((_, index) => discoveredIds[(vars.limits.startOffset + index) % discoveredIds.length]);
    const ids = [...new Set([...requestedIds, ...rotated])].slice(0, vars.limits.maxThreads);
    const threads = [];
    const missingThreadIds = [];
    const failedThreadIds = [];
    const bodyTruncatedThreadIds = [];
    const historyTruncatedThreadIds = [];
    let timedOut = false;
    for (const id of ids) {
      if (Date.now() >= deadline) { timedOut = true; break; }
      try {
        await navigate(origin + "/inbox/" + encodeURIComponent(id));
        if (!(await authenticated("thread", id))) { missingThreadIds.push(id); continue; }
        const read = await page.evaluate(({ maxMessages, maxBodyChars }) => {
          const row = document.querySelector('[data-roomscout-thread-state="ready"]');
          if (!row) return null;
          const clean = (value, max) => (value ?? "").replace(/\\s+/g, " ").trim().slice(0, max);
          const allMessageRows = Array.from(row.querySelectorAll('[data-roomscout-message-id]'));
          const messageRows = allMessageRows.slice(-maxMessages);
          return { historyTruncated: allMessageRows.length > maxMessages, bodyTruncated: messageRows.some((message) => (message.querySelector('[data-roomscout-body]')?.textContent ?? "").replace(/\\s+/g, " ").trim().length > maxBodyChars), thread: {
            providerThreadId: row.dataset.roomscoutThreadId ?? "",
            subject: clean(row.querySelector('[data-roomscout-subject]')?.textContent, 500) || undefined,
            participants: Array.from(row.querySelectorAll('[data-roomscout-participant]')).slice(0, 20).map((item) => clean(item.textContent, 300)),
            lastMessageAt: Number(row.dataset.roomscoutLastMessageAt ?? 0),
            messages: messageRows.map((message) => ({
              providerMessageId: message.dataset.roomscoutMessageId ?? "",
              direction: ["inbound", "outbound"].includes(message.dataset.roomscoutDirection) ? message.dataset.roomscoutDirection : "unknown",
              senderLabel: clean(message.querySelector('[data-roomscout-sender]')?.textContent, 300) || undefined,
              bodyText: clean(message.querySelector('[data-roomscout-body]')?.textContent, maxBodyChars),
              sentAt: Number(message.dataset.roomscoutSentAt ?? 0),
            })),
          }};
        }, { maxMessages: vars.limits.maxMessages, maxBodyChars: vars.limits.maxBodyChars });
        if (read) {
          threads.push(read.thread);
          if (read.bodyTruncated) bodyTruncatedThreadIds.push(id);
          if (read.historyTruncated) historyTruncatedThreadIds.push(id);
        } else missingThreadIds.push(id);
      } catch {
        if (new URL(await page.url()).origin !== origin) throw new Error("PORTAL_NAVIGATION_ESCAPED");
        failedThreadIds.push(id);
      }
    }
    return {
      threads,
      missingThreadIds,
      failedThreadIds,
      bodyTruncatedThreadIds,
      historyTruncatedThreadIds,
      discoveredThreadIds: discoveredIds,
      truncated: timedOut || allDiscoveredIds.length > discoveredIds.length || ids.length < requestedIds.length + rotated.length || discoveredIds.length > vars.limits.maxThreads || failedThreadIds.length > 0 || bodyTruncatedThreadIds.length > 0 || historyTruncatedThreadIds.length > 0,
      timedOut,
      nextOffset: discoveredIds.length === 0 ? 0 : (vars.limits.startOffset + Math.max(1, threads.length + missingThreadIds.length + failedThreadIds.length)) % discoveredIds.length,
    };`, { origin: REVIEWED_PORTAL_ORIGIN, requestedThreadIds: requested, limits }, false, limits.overallTimeoutMs);
  try {
    return resultSchema.parse(raw);
  } catch {
    throw new Error("FIRECRAWL_PORTAL_READ_RESULT_INVALID");
  }
}

/* ------------------------------------------------------------------ */
/* Program-native write path (plan §3, slices S2/S3/S5)                */
/* ------------------------------------------------------------------ */

/** Sandbox budget of the read-only preparation program. */
const PREPARE_SANDBOX_TIMEOUT_MS = 60_000;
/** Sandbox budget of the single mutating program: click, receipt, read-back, home. */
const SEND_SANDBOX_TIMEOUT_MS = 90_000;
const WRITE_NAVIGATION_TIMEOUT_MS = 30_000;
/** How long a program waits inside the sandbox for the composer or thread DOM. */
const WRITE_READY_TIMEOUT_MS = 30_000;
/** Clerk hydration is awaited, never required: the wait is allowed to lapse. */
const WRITE_CLERK_TIMEOUT_MS = 15_000;
const WRITE_RECEIPT_TIMEOUT_MS = 30_000;
const MAX_BODY_LENGTH = 5_000;
const MAX_SENDER_LABEL_LENGTH = 300;
/** The receipt and thread read-back compare this much of the body, like the local proof. */
const RECEIPT_BODY_PREFIX = 120;

const SENDER_LABEL_SELECTOR = '[data-roomscout-write="sender-label"]';
const BODY_SELECTOR = '[data-roomscout-write="body"]';
const SEND_SELECTOR = '[data-roomscout-write="send"]';
const RECEIPT_SELECTOR = "[data-roomscout-write-result]";
const THREAD_READY_SELECTOR = '[data-roomscout-thread-state="ready"]';
const LISTING_COMPOSER_SELECTOR = '[data-roomscout-compose="new-message"]';

const prepareSchema = z.object({
  url: z.string().max(2_000),
  authenticated: z.boolean(),
  existingIds: z.array(z.string().max(200)).max(200),
  values: z.object({
    senderLabel: z.string().max(2_000).nullable().optional(),
    body: z.string().max(20_000).nullable(),
  }),
  send: z.object({
    count: z.number().int().nonnegative(),
    visible: z.boolean(),
    enabled: z.boolean(),
  }),
});

const sendSchema = z.object({
  receipt: z.object({
    status: z.string().max(60).nullable(),
    errorCode: z.string().max(120).nullable(),
    providerMessageId: z.string().max(200).nullable(),
    providerThreadId: z.string().max(200).nullable(),
    text: z.string().max(400),
  }),
  thread: z.object({
    providerThreadId: z.string().max(200).nullable(),
    messages: z.array(z.object({
      id: z.string().max(200),
      direction: z.string().max(40),
      body120: z.string().max(400),
    })).max(50),
  }),
  home: z.object({ authenticated: z.boolean() }),
});

/**
 * Same shape the Browserbase driver returns (`PortalSendResult`), plus what the
 * send program observed about the profile on `/` — S3's proof without a second
 * session. `profileAuthenticated` is absent when the program never got that far.
 */
export type FirecrawlPortalWriteResult = (
  | { outcome: "succeeded"; submitted: true; providerThreadId: string; providerMessageId: string }
  | { outcome: "human_required"; submitted: false; blocker: "password" }
  | { outcome: "unknown"; submitted: true; errorCode: "SUBMIT_RESULT_UNKNOWN" }
) & { profileAuthenticated?: boolean };

/** Origin guard injected verbatim into every program below. */
const PORTAL_ORIGIN_GUARD = `const origin = vars.origin;
    const assertOrigin = async () => {
      if (new URL(await page.url()).origin !== origin) throw new Error("PORTAL_NAVIGATION_ESCAPED");
    };`;

const PREPARE_PROGRAM = `${PORTAL_ORIGIN_GUARD}
    await page.goto(origin + vars.path, { waitUntil: "domcontentloaded", timeout: vars.timeouts.navigationMs });
    await assertOrigin();
    await page.waitForSelector(vars.readySelector, { state: "visible", timeout: vars.timeouts.readyMs });
    // The composer is server-rendered from the session cookie and can appear
    // before clerk-js has hydrated; wait for Clerk before reading client state.
    await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: vars.timeouts.clerkMs }).catch(() => undefined);
    const authenticated = await page.evaluate(() => Boolean(window.Clerk?.user && window.Clerk?.session));
    if (!authenticated) {
      return { url: await page.url(), authenticated: false, existingIds: [], values: { body: null }, send: { count: 0, visible: false, enabled: false } };
    }
    const existingIds = await page.evaluate(() => Array.from(document.querySelectorAll('[data-roomscout-message-id]')).slice(-200).map((row) => row.dataset.roomscoutMessageId ?? ""));
    __roomscoutPartial.existingIds = existingIds.length;
    if (vars.senderLabel !== null) await page.locator(vars.senderSelector).fill(vars.senderLabel);
    await page.locator(vars.bodySelector).fill(vars.body);
    const values = await page.evaluate((selectors) => ({
      senderLabel: document.querySelector(selectors.sender)?.value ?? null,
      body: document.querySelector(selectors.body)?.value ?? null,
    }), { sender: vars.senderSelector, body: vars.bodySelector });
    const send = await page.evaluate((selector) => {
      const rows = Array.from(document.querySelectorAll(selector));
      if (rows.length !== 1) return { count: rows.length, visible: false, enabled: false };
      const row = rows[0];
      const style = window.getComputedStyle(row);
      const form = row.form ?? row.closest("form");
      return {
        count: 1,
        visible: !row.hidden && style.display !== "none" && style.visibility !== "hidden",
        enabled: row.disabled !== true && (form === null ? true : form.checkValidity()),
      };
    }, vars.sendSelector);
    await assertOrigin();
    return { url: await page.url(), authenticated: true, existingIds, values, send };`;

const SEND_PROGRAM = `${PORTAL_ORIGIN_GUARD}
    await assertOrigin();
    await page.locator(vars.sendSelector).click();
    await page.waitForSelector(vars.receiptSelector, { state: "visible", timeout: vars.timeouts.receiptMs });
    const receipt = await page.evaluate((selector) => {
      const row = document.querySelector(selector);
      return {
        status: row?.getAttribute("data-roomscout-write-result") ?? null,
        errorCode: row?.getAttribute("data-roomscout-error-code") ?? null,
        providerMessageId: row?.getAttribute("data-roomscout-provider-message-id") ?? null,
        providerThreadId: row?.getAttribute("data-roomscout-provider-thread-id") ?? null,
        text: (row?.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 300),
      };
    }, vars.receiptSelector);
    __roomscoutPartial.receiptStatus = receipt.status;
    let thread = { providerThreadId: null, messages: [] };
    const threadId = receipt.status === "sent" && receipt.providerMessageId
      ? (receipt.providerThreadId ?? vars.providerThreadId) : null;
    if (typeof threadId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(threadId)) {
      await page.goto(origin + "/inbox/" + encodeURIComponent(threadId), { waitUntil: "domcontentloaded", timeout: vars.timeouts.navigationMs });
      await assertOrigin();
      await page.waitForSelector(vars.threadSelector, { state: "visible", timeout: vars.timeouts.readyMs });
      thread = await page.evaluate((selector) => {
        const row = document.querySelector(selector);
        return {
          providerThreadId: row?.dataset.roomscoutThreadId ?? null,
          messages: Array.from(row?.querySelectorAll('[data-roomscout-message-id]') ?? []).slice(-50).map((message) => ({
            id: message.dataset.roomscoutMessageId ?? "",
            direction: message.dataset.roomscoutDirection ?? "unknown",
            body120: (message.querySelector('[data-roomscout-body]')?.textContent ?? "").trim().slice(0, 120),
          })),
        };
      }, vars.threadSelector);
      __roomscoutPartial.threadMessages = thread.messages.length;
    }
    // Home plus Clerk is the profile proof (S3); no second session is opened.
    await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: vars.timeouts.navigationMs });
    await assertOrigin();
    await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: vars.timeouts.clerkMs }).catch(() => undefined);
    const home = { authenticated: await page.evaluate(() => Boolean(window.Clerk?.user && window.Clerk?.session)) };
    return { receipt, thread, home };`;

/**
 * Send one approved message in two Interact programs, the way the local proof
 * `scripts/firecrawl-local-message.mjs` does it.
 *
 * Program A opens the target, proves the saved login, fills the reviewed fields
 * and reads them back; the exact comparison happens here, on the server, before
 * `beforeSubmit` claims the execution in Convex. Program B is the only mutating
 * request: one click, the receipt awaited inside the sandbox, the thread read
 * back, and finally `/` for the profile proof. Nothing after the claim is
 * retried — a failure there is `SUBMIT_RESULT_UNKNOWN`, never a second click.
 */
export async function writeFirecrawlPortalMessage(input: {
  session: FirecrawlPortalSession;
  body: string;
  providerThreadId?: string;
  targetPath?: string;
  senderLabel?: string;
  beforeSubmit: () => Promise<void>;
  prepareTimeoutMs?: number;
  sendTimeoutMs?: number;
}): Promise<FirecrawlPortalWriteResult> {
  if (!input.body || input.body.length > MAX_BODY_LENGTH) throw new Error("PORTAL_MESSAGE_BODY_INVALID");
  if (input.senderLabel !== undefined && (!input.senderLabel || input.senderLabel.length > MAX_SENDER_LABEL_LENGTH)) {
    throw new Error("PORTAL_SENDER_LABEL_INVALID");
  }
  let providerThreadId: string | undefined;
  if (input.providerThreadId !== undefined) {
    if (!idSchema.safeParse(input.providerThreadId).success) throw new Error("FIRECRAWL_PORTAL_THREAD_ID_INVALID");
    providerThreadId = input.providerThreadId;
  }
  const path = providerThreadId
    ? `/inbox/${encodeURIComponent(providerThreadId)}`
    : input.targetPath;
  if (!path || (!providerThreadId && !/^\/listings\/[A-Za-z0-9_-]{1,200}$/.test(path))) {
    throw new Error("PORTAL_TARGET_PATH_INVALID");
  }
  // A listing composer is the only place a sender label exists; in a thread the
  // identity is already bound to the saved profile.
  const senderLabel = !providerThreadId && input.senderLabel ? input.senderLabel : null;
  const timeouts = {
    navigationMs: WRITE_NAVIGATION_TIMEOUT_MS,
    readyMs: WRITE_READY_TIMEOUT_MS,
    clerkMs: WRITE_CLERK_TIMEOUT_MS,
    receiptMs: WRITE_RECEIPT_TIMEOUT_MS,
  };
  const prepareRaw = await input.session.runProgram(PREPARE_PROGRAM, {
    origin: REVIEWED_PORTAL_ORIGIN,
    path,
    readySelector: providerThreadId ? THREAD_READY_SELECTOR : LISTING_COMPOSER_SELECTOR,
    senderSelector: SENDER_LABEL_SELECTOR,
    bodySelector: BODY_SELECTOR,
    sendSelector: SEND_SELECTOR,
    senderLabel,
    body: input.body,
    timeouts,
  }, false, input.prepareTimeoutMs ?? PREPARE_SANDBOX_TIMEOUT_MS);
  let prepare: z.infer<typeof prepareSchema>;
  try {
    prepare = prepareSchema.parse(prepareRaw);
  } catch {
    throw new Error("FIRECRAWL_PORTAL_WRITE_RESULT_INVALID");
  }
  // No saved login on the portal page: report it, never fill or submit.
  if (!prepare.authenticated) return { outcome: "human_required", submitted: false, blocker: "password", profileAuthenticated: false };
  // A readback that does not match exactly is a timing fault, not a policy
  // stop: it is thrown as a retryable code, not reported as human_required.
  if (
    prepare.values.body !== input.body ||
    (senderLabel !== null && prepare.values.senderLabel !== senderLabel) ||
    prepare.send.count !== 1 || !prepare.send.visible || !prepare.send.enabled
  ) {
    console.error("FIRECRAWL_WRITE_PREPARE_MISMATCH", {
      bodyMatches: prepare.values.body === input.body,
      senderMatches: senderLabel === null || prepare.values.senderLabel === senderLabel,
      send: prepare.send,
    });
    throw new Error("FIRECRAWL_WRITE_PREPARE_MISMATCH");
  }
  const existingIds = new Set(prepare.existingIds);

  await input.beforeSubmit();

  let send: z.infer<typeof sendSchema>;
  try {
    const sendRaw = await input.session.runProgram(SEND_PROGRAM, {
      origin: REVIEWED_PORTAL_ORIGIN,
      sendSelector: SEND_SELECTOR,
      receiptSelector: RECEIPT_SELECTOR,
      threadSelector: THREAD_READY_SELECTOR,
      providerThreadId: providerThreadId ?? null,
      timeouts,
    }, true, input.sendTimeoutMs ?? SEND_SANDBOX_TIMEOUT_MS);
    send = sendSchema.parse(sendRaw);
  } catch (error) {
    // The click may have landed. Never retry, never claim delivery — but keep the reason visible.
    const code = error instanceof Error ? error.message.split(":", 1)[0] : "UNKNOWN";
    console.error("FIRECRAWL_WRITE_SEND_UNCONFIRMED", { code });
    return { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
  }
  const profileAuthenticated = send.home.authenticated;
  const providerMessageId = send.receipt.providerMessageId;
  const receiptThreadId = send.receipt.providerThreadId ?? providerThreadId ?? null;
  // The portal's own receipt (status + fresh message id) is the delivery proof, like the
  // local script. The thread read-back is a confirmation: the portal renders bodies with
  // collapsed whitespace, so compare normalised text and only warn on a mismatch.
  const delivered =
    send.receipt.status === "sent" &&
    providerMessageId !== null && idSchema.safeParse(providerMessageId).success &&
    receiptThreadId !== null && idSchema.safeParse(receiptThreadId).success &&
    !existingIds.has(providerMessageId);
  const normalise = (text: string) => text.replace(/\s+/g, " ").trim();
  const readBack = send.thread.providerThreadId === receiptThreadId &&
    send.thread.messages.some((message) =>
      message.id === providerMessageId &&
      message.direction === "outbound" &&
      normalise(message.body120).startsWith(normalise(input.body).slice(0, Math.min(RECEIPT_BODY_PREFIX, normalise(message.body120).length) - 1)));
  if (delivered && !readBack) {
    console.error("FIRECRAWL_PORTAL_WRITE_READBACK_MISMATCH", { threadMessages: send.thread.messages.length, sameThread: send.thread.providerThreadId === receiptThreadId });
  }
  if (!delivered) {
    console.error("FIRECRAWL_PORTAL_WRITE_UNCONFIRMED", {
      status: send.receipt.status,
      errorCode: send.receipt.errorCode?.slice(0, 60) ?? null,
      hasMessageId: providerMessageId !== null,
      threadMessages: send.thread.messages.length,
    });
    return { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN", profileAuthenticated };
  }
  return {
    outcome: "succeeded",
    submitted: true,
    providerThreadId: receiptThreadId,
    providerMessageId,
    profileAuthenticated,
  };
}

/* ------------------------------------------------------------------ */
/* Program-native registration and page state (plan §3, slice S4)      */
/* ------------------------------------------------------------------ */

/**
 * The blockers a controlled-portal flow may report. Same set as the reviewed
 * Browserbase driver's `PortalHumanBlocker`; declared here so the Firecrawl
 * path carries no import from the driver.
 */
export type FirecrawlPortalHumanBlocker =
  | "captcha"
  | "terms"
  | "payment"
  | "contract"
  | "two_factor"
  | "password"
  | "policy_human_presence";

/** Sandbox budget of the sign-up program (navigate, terms, fill, submit, OTP wait). */
const SIGNUP_SANDBOX_TIMEOUT_MS = 120_000;
/** Sandbox budget of the verification program (fill, submit, auth polls, home). */
const VERIFY_SANDBOX_TIMEOUT_MS = 120_000;
/** Sandbox budget of a read-only page-state probe. */
const PAGE_STATE_SANDBOX_TIMEOUT_MS = 30_000;
/** How long a registration program waits for a Clerk field, like the local proof. */
const REGISTRATION_FIELD_TIMEOUT_MS = 45_000;
const REGISTRATION_NAVIGATION_TIMEOUT_MS = 30_000;
/** Clerk hydration is awaited, never required: the wait is allowed to lapse. */
const REGISTRATION_CLERK_TIMEOUT_MS = 15_000;
/** Clerk often submits on the last OTP digit; the click may already be gone. */
const VERIFY_CLICK_TIMEOUT_MS = 5_000;
const AUTH_POLL_INTERVAL_MS = 500;
const AUTH_POLL_ATTEMPTS = 30;
const HOME_AUTH_POLL_ATTEMPTS = 20;
const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 200;

const SIGNUP_PATH = "/sign-up";
const EMAIL_SELECTOR = 'input[name="emailAddress"]';
const PASSWORD_SELECTOR = 'input[name="password"]';
const OTP_SELECTOR = 'input[autocomplete="one-time-code"],input[name="code"]';
const CLERK_PRIMARY_SELECTOR = 'button[data-localization-key="formButtonPrimary"]';
const DEMO_TERMS_SELECTOR = '[data-roomscout-write="demo-terms"]';
const ACCEPT_DEMO_TERMS_SELECTOR = '[data-roomscout-write="accept-demo-terms"]';
const PATH_PATTERN = /^\/[A-Za-z0-9/_-]{0,200}$/;

/** Shared in-sandbox readers. Never returns a field value, only what it saw. */
const PAGE_READERS = `const readCaptcha = async () => await page.evaluate(() =>
      document.querySelectorAll('iframe[src*="captcha" i],iframe[src*="turnstile" i],iframe[src*="hcaptcha" i]').length > 0 ||
      Array.from(document.querySelectorAll('#clerk-captcha,[data-sitekey]')).some((element) => element.getClientRects().length > 0));
    const readFormErrors = async () => await page.evaluate(() => Array.from(document.querySelectorAll('[class*="formFieldErrorText"], [class*="alertText"], [role="alert"]'))
      .map((element) => (element.textContent ?? "").replace(/\\s+/g, " ").trim())
      .filter(Boolean).slice(0, 5).map((text) => text.slice(0, 200)));
    const isAuthenticated = async () => await page.evaluate(() => Boolean(window.Clerk?.user && window.Clerk?.session));`;

const PAGE_STATE_PROGRAM = `${PORTAL_ORIGIN_GUARD}
    ${PAGE_READERS}
    await page.goto(origin + vars.path, { waitUntil: "domcontentloaded", timeout: vars.timeouts.navigationMs });
    await assertOrigin();
    await page.waitForFunction(() => window.Clerk?.loaded === true, undefined, { timeout: vars.timeouts.clerkMs }).catch(() => undefined);
    const state = await page.evaluate(() => {
      const path = window.location.pathname;
      const authenticated = Boolean(window.Clerk?.user && window.Clerk?.session);
      const hasCodeField = document.querySelector('input[autocomplete="one-time-code"],input[name="code"]') !== null;
      const hasPasswordField = document.querySelector('input[name="password"]') !== null;
      return {
        authenticated,
        hasCodeField,
        hasPasswordField,
        stage: authenticated ? "authenticated"
          : hasCodeField ? "verification"
          : path === "/sign-up" ? "sign_up"
          : path === "/sign-in" || hasPasswordField ? "sign_in"
          : "unknown",
      };
    });
    return { url: await page.url(), captcha: await readCaptcha(), ...state };`;

const SIGNUP_PROGRAM = `${PORTAL_ORIGIN_GUARD}
    ${PAGE_READERS}
    if (new URL(await page.url()).pathname !== vars.signupPath) {
      await page.goto(origin + vars.signupPath, { waitUntil: "domcontentloaded", timeout: vars.timeouts.navigationMs });
    }
    await assertOrigin();
    // Clerk's bot protection is never solved inside this browser, so a visible
    // widget is reported once instead of polled until the budget is gone.
    if (await readCaptcha()) return { stage: "captcha", url: await page.url(), formErrors: await readFormErrors() };
    __roomscoutPartial.stage = "terms";
    if (await page.locator(vars.termsSelector).count()) {
      await page.locator(vars.termsSelector).click();
      await page.locator(vars.acceptTermsSelector).click();
    }
    __roomscoutPartial.stage = "fill";
    await page.waitForSelector(vars.emailSelector, { state: "visible", timeout: vars.timeouts.fieldMs });
    await page.locator(vars.emailSelector).fill(vars.email);
    await page.locator(vars.passwordSelector).fill(vars.password);
    // The exact values never leave the sandbox: the comparison happens here and
    // only its verdict travels back.
    const valuesMatch = await page.evaluate((expected) => (
      (document.querySelector(expected.emailSelector)?.value ?? null) === expected.email &&
      (document.querySelector(expected.passwordSelector)?.value ?? null) === expected.password
    ), { emailSelector: vars.emailSelector, passwordSelector: vars.passwordSelector, email: vars.email, password: vars.password });
    if (!valuesMatch) return { stage: "mismatch", url: await page.url(), formErrors: await readFormErrors() };
    __roomscoutPartial.stage = "submit";
    await page.locator(vars.primarySelector).click();
    let otpVisible = true;
    try {
      await page.waitForSelector(vars.otpSelector, { state: "visible", timeout: vars.timeouts.fieldMs });
    } catch { otpVisible = false; }
    await assertOrigin();
    const authenticated = await isAuthenticated();
    __roomscoutPartial.stage = "classify";
    return {
      stage: otpVisible ? "awaiting_code" : authenticated ? "authenticated" : (await readCaptcha()) ? "captcha" : "unknown",
      url: await page.url(),
      formErrors: await readFormErrors(),
    };`;

const VERIFY_PROGRAM = `${PORTAL_ORIGIN_GUARD}
    ${PAGE_READERS}
    await assertOrigin();
    let codeVisible = true;
    try {
      await page.waitForSelector(vars.otpSelector, { state: "visible", timeout: vars.timeouts.fieldMs });
    } catch { codeVisible = false; }
    if (!codeVisible) return { authenticated: await isAuthenticated(), url: await page.url(), formErrors: await readFormErrors() };
    await page.locator(vars.otpSelector).fill(vars.code);
    __roomscoutPartial.stage = "submit";
    // Clerk can submit on the last digit, in which case the button is already
    // gone; that is not a failure of the verification.
    try { await page.locator(vars.primarySelector).click({ timeout: vars.timeouts.clickMs }); } catch { __roomscoutPartial.autoSubmitted = true; }
    let authenticated = false;
    for (let attempt = 0; attempt < vars.polls.attempts && !authenticated; attempt += 1) {
      authenticated = await isAuthenticated();
      if (!authenticated) await page.waitForTimeout(vars.polls.intervalMs);
    }
    if (!authenticated) {
      // Clerk finishes the sign-up transaction on the next navigation.
      await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: vars.timeouts.navigationMs });
      await assertOrigin();
      for (let attempt = 0; attempt < vars.polls.homeAttempts && !authenticated; attempt += 1) {
        authenticated = await isAuthenticated();
        if (!authenticated) await page.waitForTimeout(vars.polls.intervalMs);
      }
    }
    return { authenticated, url: await page.url(), formErrors: await readFormErrors() };`;

const registrationTimeouts = {
  navigationMs: REGISTRATION_NAVIGATION_TIMEOUT_MS,
  fieldMs: REGISTRATION_FIELD_TIMEOUT_MS,
  clerkMs: REGISTRATION_CLERK_TIMEOUT_MS,
  clickMs: VERIFY_CLICK_TIMEOUT_MS,
};
const authPolls = {
  attempts: AUTH_POLL_ATTEMPTS,
  homeAttempts: HOME_AUTH_POLL_ATTEMPTS,
  intervalMs: AUTH_POLL_INTERVAL_MS,
};

const formErrorsSchema = z.array(z.string().max(300)).max(5);
const signupResultSchema = z.object({
  stage: z.enum(["awaiting_code", "authenticated", "captcha", "mismatch", "unknown"]),
  url: z.string().max(2_000),
  formErrors: formErrorsSchema,
});
const verifyResultSchema = z.object({
  authenticated: z.boolean(),
  url: z.string().max(2_000),
  formErrors: formErrorsSchema,
});
const pageStateSchema = z.object({
  url: z.string().max(2_000),
  authenticated: z.boolean(),
  stage: z.enum(["authenticated", "sign_in", "sign_up", "verification", "unknown"]),
  hasPasswordField: z.boolean(),
  hasCodeField: z.boolean(),
  captcha: z.boolean(),
});

export type FirecrawlPortalPageState = z.infer<typeof pageStateSchema>;

/**
 * What one sign-up program observed. `mismatch` means the reviewed fields did
 * not read back exactly; it is a timing fault the caller may retry, never a
 * policy stop.
 */
export type FirecrawlPortalRegistrationOutcome =
  | { outcome: "awaiting_code"; url: string }
  | { outcome: "authenticated"; url: string }
  | { outcome: "human_required"; blocker: FirecrawlPortalHumanBlocker; url: string }
  | { outcome: "mismatch"; url: string };

/** Page text only, bounded, never a field value: enough to read a Clerk refusal. */
function logFormErrors(step: string, formErrors: string[]): void {
  if (formErrors.length === 0) return;
  console.error("FIRECRAWL_PORTAL_REGISTRATION_FORM_ERRORS", { step, formErrors: formErrors.slice(0, 3) });
}

/**
 * Register the controlled-portal account in ONE Interact program, mirroring
 * `scripts/firecrawl-local-signup.mjs`: origin guard, captcha policy read once,
 * the demo-terms gate, the two reviewed fields filled from JSON variables and
 * compared exactly inside the sandbox, one click on Clerk's primary button, and
 * the OTP field awaited in the sandbox instead of polled from here.
 */
export async function signUpOnFirecrawlPortal(input: {
  session: FirecrawlPortalSession;
  email: string;
  password: string;
  timeoutMs?: number;
}): Promise<FirecrawlPortalRegistrationOutcome> {
  if (!input.email || input.email.length > MAX_EMAIL_LENGTH) throw new Error("PORTAL_REGISTRATION_EMAIL_INVALID");
  if (!input.password || input.password.length > MAX_PASSWORD_LENGTH) throw new Error("PORTAL_REGISTRATION_PASSWORD_INVALID");
  const raw = await input.session.runProgram(SIGNUP_PROGRAM, {
    origin: REVIEWED_PORTAL_ORIGIN,
    signupPath: SIGNUP_PATH,
    termsSelector: DEMO_TERMS_SELECTOR,
    acceptTermsSelector: ACCEPT_DEMO_TERMS_SELECTOR,
    emailSelector: EMAIL_SELECTOR,
    passwordSelector: PASSWORD_SELECTOR,
    otpSelector: OTP_SELECTOR,
    primarySelector: CLERK_PRIMARY_SELECTOR,
    email: input.email,
    password: input.password,
    timeouts: registrationTimeouts,
  }, true, input.timeoutMs ?? SIGNUP_SANDBOX_TIMEOUT_MS);
  let result: z.infer<typeof signupResultSchema>;
  try {
    result = signupResultSchema.parse(raw);
  } catch {
    throw new Error("FIRECRAWL_PORTAL_REGISTRATION_RESULT_INVALID");
  }
  logFormErrors("signup", result.formErrors);
  if (result.stage === "captcha") return { outcome: "human_required", blocker: "captcha", url: result.url };
  if (result.stage === "unknown") return { outcome: "human_required", blocker: "policy_human_presence", url: result.url };
  if (result.stage === "mismatch") return { outcome: "mismatch", url: result.url };
  return { outcome: result.stage, url: result.url };
}

/**
 * Enter the verification code in the SAME session that started the sign-up and
 * confirm the authenticated Clerk session, mirroring the local proof's second
 * interact call. The polls run inside the sandbox; this costs one round trip.
 */
export async function submitFirecrawlPortalVerification(input: {
  session: FirecrawlPortalSession;
  code: string;
  timeoutMs?: number;
}): Promise<{ authenticated: boolean; url: string }> {
  if (!/^[0-9]{4,10}$/.test(input.code)) throw new Error("PORTAL_VERIFICATION_CODE_INVALID");
  const raw = await input.session.runProgram(VERIFY_PROGRAM, {
    origin: REVIEWED_PORTAL_ORIGIN,
    otpSelector: OTP_SELECTOR,
    primarySelector: CLERK_PRIMARY_SELECTOR,
    code: input.code,
    timeouts: registrationTimeouts,
    polls: authPolls,
  }, true, input.timeoutMs ?? VERIFY_SANDBOX_TIMEOUT_MS);
  let result: z.infer<typeof verifyResultSchema>;
  try {
    result = verifyResultSchema.parse(raw);
  } catch {
    throw new Error("FIRECRAWL_PORTAL_VERIFICATION_RESULT_INVALID");
  }
  logFormErrors("verification", result.formErrors);
  return { authenticated: result.authenticated, url: result.url };
}

/**
 * One read-only program for the small flows that used to spend a primitive per
 * observation: navigate, guard the origin, let Clerk hydrate, classify the page.
 */
export async function readFirecrawlPortalPageState(input: {
  session: FirecrawlPortalSession;
  path: string;
  timeoutMs?: number;
}): Promise<FirecrawlPortalPageState> {
  if (!PATH_PATTERN.test(input.path)) throw new Error("PORTAL_TARGET_PATH_INVALID");
  const raw = await input.session.runProgram(PAGE_STATE_PROGRAM, {
    origin: REVIEWED_PORTAL_ORIGIN,
    path: input.path,
    timeouts: registrationTimeouts,
  }, false, input.timeoutMs ?? PAGE_STATE_SANDBOX_TIMEOUT_MS);
  try {
    return pageStateSchema.parse(raw);
  } catch {
    throw new Error("FIRECRAWL_PORTAL_PAGE_STATE_INVALID");
  }
}
