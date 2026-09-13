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
