import type { Page } from "@browserbasehq/stagehand";
import { buildAllowedPortalUrl } from "./portalSafety";

export const PORTAL_WRITE_TTL_MS = 8 * 60_000;
const PORTAL_WRITE_RECEIPT_POLL_MS = 250;
const PORTAL_WRITE_RECEIPT_ATTEMPTS = 24;

export type PortalWriteActionType = "send_platform_dm" | "publish_listing";

export type PortalWritePayload = {
  kind: "platform_message";
  recipients: string[];
  targetPath?: string;
  senderLabel?: string;
  subject?: string;
  body: string;
};

export type PortalHumanBlocker =
  | "password"
  | "two_factor"
  | "captcha"
  | "terms"
  | "payment"
  | "contract"
  | "policy_human_presence";

type PortalWriteField = {
  selector: string;
  value: string;
};

export type PortalWriteWorkflow = {
  adapterKey: string;
  adapterVersion: number;
  workflowKey: string;
  actionType: PortalWriteActionType;
  path(input: { providerThreadId?: string; payload: PortalWritePayload }): string;
  fields(payload: PortalWritePayload): PortalWriteField[];
  submitSelector: string;
  successSelector: string;
  postSubmitPaths: readonly string[];
};

export type PortalWriteResult =
  | {
      outcome: "human_required";
      blocker: PortalHumanBlocker;
      submitted: false;
    }
  | {
      outcome: "succeeded";
      submitted: true;
      providerThreadId?: string;
      providerMessageId?: string;
    }
  | {
      outcome: "unknown";
      submitted: true;
      errorCode: "SUBMIT_RESULT_UNKNOWN";
    };

type PortalWritePage = Pick<
  Page,
  "evaluate" | "locator" | "url" | "waitForLoadState" | "waitForTimeout"
>;

const FIXTURE_MESSAGE_WORKFLOW: PortalWriteWorkflow = {
  adapterKey: "roomscout-fixture-v1",
  adapterVersion: 1,
  workflowKey: "fixture.platform-message.v1",
  actionType: "send_platform_dm",
  path: ({ providerThreadId }) =>
    providerThreadId
      ? `/roomscout-fixture/messages/${encodeURIComponent(providerThreadId)}`
      : "/roomscout-fixture/messages/new",
  fields: (payload) => [
    ...(payload.recipients.length > 0
      ? [{ selector: '[data-roomscout-write="recipient"]', value: payload.recipients.join(", ") }]
      : []),
    ...(payload.subject
      ? [{ selector: '[data-roomscout-write="subject"]', value: payload.subject }]
      : []),
    { selector: '[data-roomscout-write="body"]', value: payload.body },
  ],
  submitSelector: '[data-roomscout-write="send"]',
  successSelector: '[data-roomscout-write-result="sent"]',
  postSubmitPaths: ["/roomscout-fixture/messages"],
};

const FIXTURE_LISTING_WORKFLOW: PortalWriteWorkflow = {
  adapterKey: "roomscout-fixture-v1",
  adapterVersion: 1,
  workflowKey: "fixture.publish-listing.v1",
  actionType: "publish_listing",
  path: () => "/roomscout-fixture/listings/new",
  fields: (payload) => {
    if (!payload.subject) throw new Error("LISTING_TITLE_REQUIRED");
    return [
      { selector: '[data-roomscout-write="title"]', value: payload.subject },
      { selector: '[data-roomscout-write="body"]', value: payload.body },
    ];
  },
  submitSelector: '[data-roomscout-write="publish"]',
  successSelector: '[data-roomscout-write-result="published"]',
  postSubmitPaths: ["/roomscout-fixture/listings"],
};

const ROOMSCOUT_DEV_MESSAGE_WORKFLOW: PortalWriteWorkflow = {
  adapterKey: "roomscout-dev-v1",
  adapterVersion: 1,
  workflowKey: "roomscout-dev.platform-message.v1",
  actionType: "send_platform_dm",
  path: ({ providerThreadId, payload }) => {
    if (providerThreadId) return `/inbox/${encodeURIComponent(providerThreadId)}`;
    if (!payload.targetPath?.startsWith("/listings/")) {
      throw new Error("PORTAL_TARGET_PATH_REQUIRED");
    }
    return payload.targetPath;
  },
  fields: (payload) => [
    {
      selector: '[data-roomscout-write="sender-label"]',
      value: payload.senderLabel ?? "RoomScout musician",
    },
    { selector: '[data-roomscout-write="body"]', value: payload.body },
  ],
  submitSelector: '[data-roomscout-write="send"]',
  successSelector: '[data-roomscout-write-result="sent"]',
  postSubmitPaths: ["/listings", "/inbox"],
};

/**
 * Reviewed portal writes are code, not configuration. The database may select
 * one of these exact tuples, but it cannot inject selectors, scripts or paths.
 * A real portal is added only after its concrete flow has been reviewed and
 * tested; unknown tuples fail closed.
 */
const REVIEWED_WORKFLOWS: readonly PortalWriteWorkflow[] = [
  FIXTURE_MESSAGE_WORKFLOW,
  FIXTURE_LISTING_WORKFLOW,
  ROOMSCOUT_DEV_MESSAGE_WORKFLOW,
];

export function resolvePortalWriteWorkflow(input: {
  adapterKey: string;
  adapterVersion: number;
  workflowKey: string;
  actionType: PortalWriteActionType;
}): PortalWriteWorkflow {
  const workflow = REVIEWED_WORKFLOWS.find(
    (candidate) =>
      candidate.adapterKey === input.adapterKey &&
      candidate.adapterVersion === input.adapterVersion &&
      candidate.workflowKey === input.workflowKey &&
      candidate.actionType === input.actionType,
  );
  if (!workflow) throw new Error("PORTAL_WRITE_ADAPTER_NOT_REVIEWED");
  return workflow;
}

export function buildPortalWriteUrl(input: {
  baseUrl: string;
  allowedDomains: readonly string[];
  allowedPaths: readonly string[];
  workflow: PortalWriteWorkflow;
  providerThreadId?: string;
  payload: PortalWritePayload;
}): string {
  return buildAllowedPortalUrl({
    baseUrl: input.baseUrl,
    path: input.workflow.path({
      providerThreadId: input.providerThreadId,
      payload: input.payload,
    }),
    allowedDomains: input.allowedDomains,
    allowedPaths: input.allowedPaths,
  });
}

export function assertAllowedPortalWriteLocation(input: {
  url: string;
  allowedDomains: readonly string[];
  allowedPaths: readonly string[];
  workflow: PortalWriteWorkflow;
  afterSubmit?: boolean;
}): void {
  const parsed = new URL(
    buildAllowedPortalUrl({
      baseUrl: input.url,
      path: input.url,
      allowedDomains: input.allowedDomains,
      allowedPaths: input.allowedPaths,
    }),
  );
  if (input.afterSubmit) {
    const accepted = input.workflow.postSubmitPaths.some(
      (path) => parsed.pathname === path || parsed.pathname.startsWith(`${path}/`),
    );
    if (!accepted) throw new Error("POST_SUBMIT_PATH_NOT_ALLOWED");
  }
}

export async function detectPortalHumanBlocker(
  page: PortalWritePage,
): Promise<Exclude<PortalHumanBlocker, "policy_human_presence"> | null> {
  const blockers = await page.evaluate(() => {
    const visible = (element: Element | null): element is HTMLElement => {
      if (!(element instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none";
    };
    const hasVisible = (selector: string) =>
      Array.from(document.querySelectorAll(selector)).some(visible);
    const checkboxNeedsConsent = Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
    ).some((checkbox) => {
      if (!visible(checkbox) || checkbox.checked) return false;
      const label = checkbox.labels?.[0]?.textContent ?? "";
      const marker = `${checkbox.name} ${checkbox.id} ${label}`.toLowerCase();
      return /\b(terms|conditions|agb|nutzungsbedingungen|privacy|datenschutz|consent|zustimm)/.test(
        marker,
      );
    });
    const riskyButtonText = Array.from(
      document.querySelectorAll<HTMLElement>('button, input[type="submit"], [role="button"]'),
    )
      .filter(visible)
      .map((element) =>
        `${element.textContent ?? ""} ${element.getAttribute("value") ?? ""}`.toLowerCase(),
      );
    return {
      password: hasVisible('input[type="password"]'),
      twoFactor: hasVisible(
        'input[autocomplete="one-time-code"], input[name*="otp" i], input[id*="otp" i], input[name*="2fa" i], input[id*="2fa" i]',
      ),
      captcha: hasVisible(
        'iframe[src*="captcha" i], iframe[title*="captcha" i], [data-sitekey], [class*="captcha" i], [id*="captcha" i]',
      ),
      terms: checkboxNeedsConsent,
      payment:
        hasVisible(
          'input[autocomplete="cc-number"], input[name*="card" i], input[id*="card" i], [data-payment-element]',
        ) ||
        riskyButtonText.some((text) =>
          /\b(pay|payment|bezahlen|zahlungspflichtig|kostenpflichtig|kaufen|purchase)\b/.test(text),
        ),
      contract: riskyButtonText.some((text) =>
        /\b(sign contract|accept agreement|vertrag unterschreiben|vertrag annehmen|booking bestätigen|buchung bestätigen)\b/.test(
          text,
        ),
      ),
    };
  });
  if (blockers.password) return "password";
  if (blockers.twoFactor) return "two_factor";
  if (blockers.captcha) return "captcha";
  if (blockers.terms) return "terms";
  if (blockers.payment) return "payment";
  if (blockers.contract) return "contract";
  return null;
}

async function requireUniqueVisible(page: PortalWritePage, selector: string) {
  const locator = page.locator(selector);
  const count = await locator.count();
  if (count !== 1 || !(await locator.isVisible())) {
    throw new Error("PORTAL_SELECTOR_MISMATCH");
  }
  return locator;
}

function cleanProviderId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[^A-Za-z0-9._:@/-]/g, "").slice(0, 500);
  return clean || undefined;
}

export async function inspectPortalWriteSuccess(input: {
  page: PortalWritePage;
  workflow: PortalWriteWorkflow;
  allowedDomains: readonly string[];
  allowedPaths: readonly string[];
}): Promise<{
  providerThreadId?: string;
  providerMessageId?: string;
} | null> {
  assertAllowedPortalWriteLocation({
    url: await input.page.url(),
    allowedDomains: input.allowedDomains,
    allowedPaths: input.allowedPaths,
    workflow: input.workflow,
    afterSubmit: true,
  });
  const success = input.page.locator(input.workflow.successSelector);
  if ((await success.count()) !== 1 || !(await success.isVisible())) return null;
  const providerIds = await input.page.evaluate((selector) => {
    const marker = document.querySelector<HTMLElement>(selector);
    return {
      providerThreadId: marker?.dataset.roomscoutProviderThreadId,
      providerMessageId: marker?.dataset.roomscoutProviderMessageId,
    };
  }, input.workflow.successSelector);
  return {
    providerThreadId: cleanProviderId(providerIds.providerThreadId),
    providerMessageId: cleanProviderId(providerIds.providerMessageId),
  };
}

async function waitForPortalWriteSuccess(input: {
  page: PortalWritePage;
  workflow: PortalWriteWorkflow;
  allowedDomains: readonly string[];
  allowedPaths: readonly string[];
}): Promise<{
  providerThreadId?: string;
  providerMessageId?: string;
} | null> {
  for (let attempt = 0; attempt < PORTAL_WRITE_RECEIPT_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await input.page.waitForTimeout(PORTAL_WRITE_RECEIPT_POLL_MS);
    }
    try {
      const success = await inspectPortalWriteSuccess(input);
      if (success) return success;
    } catch {
      // A client-rendered portal can still be on the pre-submit path while its
      // authenticated mutation and route transition are settling. Keep the
      // poll bounded and never click the submit control a second time.
    }
  }
  return null;
}

export async function runDeterministicPortalWrite(input: {
  page: PortalWritePage;
  workflow: PortalWriteWorkflow;
  payload: PortalWritePayload;
  allowedDomains: readonly string[];
  allowedPaths: readonly string[];
  humanPresenceRequired: boolean;
}): Promise<PortalWriteResult> {
  assertAllowedPortalWriteLocation({
    url: await input.page.url(),
    allowedDomains: input.allowedDomains,
    allowedPaths: input.allowedPaths,
    workflow: input.workflow,
  });
  const initialBlocker = await detectPortalHumanBlocker(input.page);
  if (initialBlocker) {
    return { outcome: "human_required", blocker: initialBlocker, submitted: false };
  }

  for (const field of input.workflow.fields(input.payload)) {
    await (await requireUniqueVisible(input.page, field.selector)).fill(field.value);
  }

  const finalBlocker = await detectPortalHumanBlocker(input.page);
  if (finalBlocker) {
    return { outcome: "human_required", blocker: finalBlocker, submitted: false };
  }
  if (input.humanPresenceRequired) {
    return {
      outcome: "human_required",
      blocker: "policy_human_presence",
      submitted: false,
    };
  }

  const submit = await requireUniqueVisible(input.page, input.workflow.submitSelector);
  try {
    // This is the single provider-side write. Once attempted, this execution is
    // never retried automatically unless the adapter exposes positive evidence
    // that no submission occurred.
    await submit.click();
  } catch {
    return { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
  }

  try {
    await input.page.waitForLoadState("domcontentloaded", 15_000);
  } catch {
    // Some reviewed portals update in place without a navigation event.
  }
  try {
    const success = await waitForPortalWriteSuccess({
      page: input.page,
      workflow: input.workflow,
      allowedDomains: input.allowedDomains,
      allowedPaths: input.allowedPaths,
    });
    if (!success) {
      return { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
    }
    return {
      outcome: "succeeded",
      submitted: true,
      providerThreadId: success.providerThreadId,
      providerMessageId: success.providerMessageId,
    };
  } catch {
    // Any exception after the click is uncertain. Never label it a safe failure
    // because automatic retries could duplicate the provider-side write.
    return { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
  }
}
