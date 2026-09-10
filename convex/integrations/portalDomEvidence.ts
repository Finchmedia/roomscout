"use node";

import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import type { Page } from "playwright-core";
import type { PortalDomEvidence } from "./stagehandPortalDriver";

type ReadOnlyDomPage = {
  evaluate<Result>(expression: string): Promise<Result>;
  url(): string;
};

export const PORTAL_DOM_EXPRESSIONS = {
  access: `(() => {
    const selectors = {
      inbox: '[data-roomscout-inbox-state="ready"], [data-roomscout-inbox-state="empty"]',
      thread: '[data-roomscout-thread-state="ready"]',
      listing: 'form[data-roomscout-compose] textarea[data-roomscout-write="body"]'
    };
    const result = {};
    result.homeClerk = Boolean(window.Clerk?.loaded && window.Clerk?.user && window.Clerk?.session);
    for (const [key, selector] of Object.entries(selectors)) {
      const rows = Array.from(document.querySelectorAll(selector));
      if (rows.length !== 1) { result[key] = false; continue; }
      const style = window.getComputedStyle(rows[0]);
      result[key] = style.display !== 'none' && style.visibility !== 'hidden';
    }
    return result;
  })()`,
  registration: `(() => {
    const terms = document.querySelector('[data-roomscout-terms-kind="present"]');
    const termsText = terms?.querySelector(':scope > p:not(.eyebrow)')?.textContent;
    const tokenFields = Array.from(document.querySelectorAll('textarea[name="g-recaptcha-response"], input[name="g-recaptcha-response"], textarea[name="cf-turnstile-response"], input[name="cf-turnstile-response"], input[name="h-captcha-response"], textarea[name="h-captcha-response"]'));
    const solvedToken = tokenFields.some((field) => field.value.trim().length > 0);
    const frames = Array.from(document.querySelectorAll('iframe[src*="captcha" i], iframe[title*="captcha" i], iframe[src*="turnstile" i], iframe[src*="hcaptcha" i]'));
    const visibleFrame = frames.some((element) => {
      const style = window.getComputedStyle(element);
      return !element.hidden && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const challenges = Array.from(document.querySelectorAll('[data-sitekey], [class*="captcha" i], [id*="captcha" i]'));
    const populatedChallenge = challenges.some((element) => {
      const style = window.getComputedStyle(element);
      const visible = !element.hidden && style.display !== 'none' && style.visibility !== 'hidden';
      return visible && (element.hasAttribute('data-sitekey') || element.childElementCount > 0 || (element.textContent ?? '').trim().length > 0);
    });
    return {
      termsPresent: terms !== null,
      termsPath: terms?.dataset.roomscoutTermsPath ?? null,
      termsText: termsText ?? null,
      termsGateVisible: terms !== null,
      captchaKind: solvedToken ? 'browserbase_native_solved' : visibleFrame || populatedChallenge ? 'present_unsolved' : 'absent',
      paymentOrContractDetected: document.querySelector('input[autocomplete="cc-number"], input[name*="card" i], input[id*="card" i], [data-payment-element], [data-roomscout-contract]') !== null
    };
  })()`,
  composer: `(() => {
    const fields = Array.from(document.querySelectorAll('textarea[data-roomscout-write="body"]'));
    return fields.length === 1 ? fields[0].value : null;
  })()`,
  receipt: `(() => {
    const rows = Array.from(document.querySelectorAll('[data-roomscout-write-result="sent"]'));
    if (rows.length !== 1) return { visible: false };
    const row = rows[0];
    const style = window.getComputedStyle(row);
    if (style.display === 'none' || style.visibility === 'hidden') return { visible: false };
    return { visible: true, providerThreadId: row.dataset.roomscoutProviderThreadId, providerMessageId: row.dataset.roomscoutProviderMessageId };
  })()`,
  inbox: `Array.from(document.querySelectorAll('a[data-roomscout-thread-id][href]')).slice(0, 20).map((row) => row.dataset.roomscoutThreadId ?? '')`,
  thread: `(() => {
    const rows = Array.from(document.querySelectorAll('[data-roomscout-thread-state="ready"]'));
    if (rows.length !== 1) return null;
    const row = rows[0];
    return {
      providerThreadId: row.dataset.roomscoutThreadId ?? '',
      subject: row.querySelector('[data-roomscout-subject]')?.textContent ?? undefined,
      participants: Array.from(row.querySelectorAll('[data-roomscout-participant]')).map((item) => item.textContent ?? ''),
      lastMessageAt: Number(row.dataset.roomscoutLastMessageAt ?? 0),
      messages: Array.from(row.querySelectorAll('[data-roomscout-message-id]')).slice(0, 20).map((message) => ({
        providerMessageId: message.dataset.roomscoutMessageId ?? '',
        direction: message.dataset.roomscoutDirection ?? 'unknown',
        senderLabel: message.querySelector('[data-roomscout-sender]')?.textContent ?? undefined,
        bodyText: message.querySelector('[data-roomscout-body]')?.textContent ?? '',
        sentAt: Number(message.dataset.roomscoutSentAt ?? 0)
      }))
    };
  })()`,
} as const;

function cleanText(value: string | null | undefined, max: number): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function fingerprintRenderedTerms(path: string, text: string): string {
  return `v1:${createHash("sha256")
    .update(`${cleanText(path, 500)}\n${cleanText(text, 5_000)}`)
    .digest("hex")}`;
}

export async function readPortalDomEvidenceFromPage(
  page: ReadOnlyDomPage,
  kind: PortalDomEvidence["kind"],
): Promise<PortalDomEvidence> {
  if (kind === "access") {
    const pagePath = (() => {
      try {
        const url = new URL(page.url());
        if (!(url.protocol === "https:" &&
          url.hostname === "roomscout.dev" &&
          url.port === "")) return null;
        return url.pathname;
      } catch {
        return null;
      }
    })();
    const contracts = await page.evaluate<{
      homeClerk: boolean;
      inbox: boolean;
      thread: boolean;
      listing: boolean;
    }>(PORTAL_DOM_EXPRESSIONS.access);
    const pathMatches =
      (contracts.homeClerk && (pagePath === "/" || pagePath === "/listings/new")) ||
      (contracts.inbox && pagePath === "/inbox") ||
      (contracts.thread && /^\/inbox\/[A-Za-z0-9_-]+$/.test(pagePath ?? "")) ||
      (contracts.listing && /^\/listings\/[A-Za-z0-9_-]+$/.test(pagePath ?? ""));
    return { kind, authenticated: pathMatches };
  }
  if (kind === "registration") {
    const raw = await page.evaluate<{
      termsPresent: boolean;
      termsPath: string | null;
      termsText: string | null;
      termsGateVisible: boolean;
      captchaKind: "browserbase_native_solved" | "present_unsolved" | "absent";
      paymentOrContractDetected: boolean;
    }>(PORTAL_DOM_EXPRESSIONS.registration);
    const terms = raw.termsPresent
      ? raw.termsPath && raw.termsText
        ? {
            kind: "present" as const,
            path: cleanText(raw.termsPath, 500),
            contentFingerprint: fingerprintRenderedTerms(
              raw.termsPath,
              raw.termsText,
            ),
          }
        : { kind: "unknown" as const }
      : { kind: "absent" as const };
    return {
      kind,
      terms,
      captcha: { kind: raw.captchaKind },
      paymentOrContractDetected: raw.paymentOrContractDetected,
      termsGateVisible: raw.termsGateVisible,
    };
  }
  if (kind === "composer") {
    const body = await page.evaluate<string | null>(PORTAL_DOM_EXPRESSIONS.composer);
    return { kind, body };
  }
  if (kind === "receipt") {
    const receipt = await page.evaluate<{
      visible: boolean;
      providerThreadId?: string;
      providerMessageId?: string;
    }>(PORTAL_DOM_EXPRESSIONS.receipt);
    return { kind, ...receipt };
  }
  if (kind === "inbox") {
    const providerThreadIds = await page.evaluate<string[]>(PORTAL_DOM_EXPRESSIONS.inbox);
    return { kind, providerThreadIds };
  }
  const thread = await page.evaluate<unknown | null>(PORTAL_DOM_EXPRESSIONS.thread);
  return { kind, thread };
}

export async function readPortalDomEvidence(input: {
  connectUrl: string;
  kind: PortalDomEvidence["kind"];
}): Promise<PortalDomEvidence> {
  return await withSingleLivePage(input.connectUrl, async (page) =>
    await readPortalDomEvidenceFromPage(page, input.kind));
}

export async function readPortalCurrentUrl(connectUrl: string): Promise<string> {
  return await withSingleLivePage(connectUrl, async (page) => page.url());
}

async function withSingleLivePage<Result>(
  connectUrl: string,
  read: (page: Page) => Promise<Result>,
): Promise<Result> {
  const browser = await chromium.connectOverCDP(connectUrl);
  try {
    const pages = browser.contexts().flatMap((context) => context.pages());
    const livePages = pages.filter((page) => page.url() !== "about:blank");
    if (livePages.length !== 1) throw new Error("STAGEHAND_LIVE_PAGE_AMBIGUOUS");
    return await read(livePages[0]!);
  } finally {
    // For connectOverCDP Playwright's close tears down its local transport; the
    // remote Browserbase session remains owned by the component lifecycle.
    await browser.close();
  }
}
