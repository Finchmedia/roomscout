"use node";

import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { FirecrawlRoomScoutClient } from "../components/firecrawlRoomScout/client";
import {
  buildFirecrawlProgram,
  parseInteractEnvelope,
} from "./firecrawlProgram";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

/** Provider program timeouts are seconds; transport deadlines are milliseconds. */
export const FIRECRAWL_PUBLIC_FORM_TIMEOUTS = {
  prepareSeconds: 60,
  submitSeconds: 60,
  previewSeconds: 15,
  requestMs: 65_000,
  stopRequestMs: 15_000,
} as const;

export type FormPreparationField = {
  key: string;
  value: string;
  aliases: string[];
};

export type FirecrawlFormPreview = {
  jobId: string;
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
  output: string;
};

type ReviewedLocator =
  | { kind: "selector"; value: string }
  | { kind: "label"; value: string }
  | { kind: "placeholder"; value: string };

type ReviewedField = {
  key: string;
  acceptedPayloadNames: string[];
  locators: ReviewedLocator[];
  required: boolean;
};

export type ReviewedFirecrawlSubmitWorkflow = {
  adapterKey: string;
  extractionProfileKey: string;
  fields: ReviewedField[];
  submit: {
    locator: ReviewedLocator;
    expectedAccessibleName: string;
  };
  success: {
    selectors: string[];
    urlIncludes: string[];
    visibleText: string[];
  };
};

export type ApprovedFirecrawlSubmissionField = {
  name: string;
  value: string;
};

export type FirecrawlSubmissionResult = {
  jobId: string;
  state:
    | "submitted_verified"
    | "human_required"
    | "verification_unknown";
  reasonCode:
    | "SUCCESS_SIGNAL_OBSERVED"
    | "HUMAN_PRESENCE_REQUIRED"
    | "CAPTCHA_REQUIRED"
    | "AUTHENTICATION_REQUIRED"
    | "TERMS_ACCEPTANCE_REQUIRED"
    | "PAYMENT_OR_CONTRACT_CONTROL_PRESENT"
    | "MISSING_REQUIRED_FIELDS"
    | "SUBMIT_CONTROL_MISMATCH"
    | "SUCCESS_SIGNAL_NOT_OBSERVED";
  filled: string[];
  missing: string[];
  blockers: string[];
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
};

export class FirecrawlSubmissionError extends Error {
  readonly mayHaveSubmitted: boolean;

  constructor(message: string, mayHaveSubmitted: boolean) {
    super(message);
    this.name = "FirecrawlSubmissionError";
    this.mayHaveSubmitted = mayHaveSubmitted;
  }
}

/**
 * Reviewed, code-owned workflows only. A persisted action payload supplies
 * values, never selectors or browser instructions. Adding a workflow here is a
 * code review event and does not activate it: an active binding and an approved
 * `approved_execute` source policy are still required server-side.
 */
const REVIEWED_SUBMIT_WORKFLOWS: readonly ReviewedFirecrawlSubmitWorkflow[] = [
  {
    adapterKey: "bandnet-contact-form-v1",
    extractionProfileKey: "bandnet-contact-form-v1",
    fields: [
      {
        key: "name",
        acceptedPayloadNames: ["name", "sender_name"],
        locators: [{ kind: "label", value: "Dein Name" }],
        required: true,
      },
      {
        key: "email",
        acceptedPayloadNames: ["email", "reply_email", "sender_email"],
        locators: [{ kind: "label", value: "Deine E-Mail-Adresse" }],
        required: true,
      },
      {
        key: "subject",
        acceptedPayloadNames: ["subject", "betreff"],
        locators: [{ kind: "label", value: "Betreff" }],
        required: true,
      },
      {
        key: "message",
        acceptedPayloadNames: ["message", "body", "nachricht"],
        locators: [{ kind: "label", value: "Nachricht" }],
        required: true,
      },
    ],
    submit: {
      locator: { kind: "selector", value: 'button[type="submit"], input[type="submit"]' },
      expectedAccessibleName: "E-Mail senden",
    },
    success: {
      selectors: [".alert-success", '[role="status"]'],
      urlIncludes: ["/kontaktieren/gesendet", "/contact/success"],
      visibleText: ["Nachricht wurde gesendet", "E-Mail wurde gesendet"],
    },
  },
] as const;

function normalizeWorkflowKey(value: string): string {
  return value.trim().toLowerCase();
}

export function resolveReviewedSubmitWorkflow(args: {
  adapterKey: string;
  extractionProfileKey: string;
}): ReviewedFirecrawlSubmitWorkflow | null {
  const adapterKey = normalizeWorkflowKey(args.adapterKey);
  const extractionProfileKey = normalizeWorkflowKey(args.extractionProfileKey);
  return (
    REVIEWED_SUBMIT_WORKFLOWS.find(
      (workflow) =>
        workflow.adapterKey === adapterKey &&
        workflow.extractionProfileKey === extractionProfileKey,
    ) ?? null
  );
}

function safePreparationFields(fields: FormPreparationField[]) {
  return fields.map((field) => ({
    key: field.key.slice(0, 120),
    value: field.value.slice(0, 20_000),
    aliases: field.aliases.slice(0, 8).map((alias) => alias.slice(0, 120)),
  }));
}

export function buildPreparationCode(fields: FormPreparationField[]): string {
  return buildFirecrawlProgram(`
const fields = vars.fields;
const filled = [];
const missing = [];
const escapeRegex = (value) => value.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&");
for (const field of fields) {
  const candidates = [];
  for (const alias of [field.key, ...field.aliases]) {
    const exact = new RegExp("^\\\\s*" + escapeRegex(alias) + "\\\\s*$", "i");
    candidates.push(page.getByLabel(exact));
    candidates.push(page.getByPlaceholder(exact));
    candidates.push(page.locator('[name="' + CSS.escape(alias) + '"]'));
  }
  let target = null;
  for (const candidate of candidates) {
    if (await candidate.count()) {
      const first = candidate.first();
      if (await first.isVisible()) { target = first; break; }
    }
  }
  if (!target) { missing.push(field.key); continue; }
  const tag = await target.evaluate((element) => element.tagName.toLowerCase());
  if (tag === "select") await target.selectOption({ label: field.value });
  else await target.fill(field.value);
  filled.push(field.key);
}
const possibleSubmitControls = await page
  .locator('button[type="submit"], input[type="submit"]')
  .allTextContents();
return {
  url: page.url(),
  filled,
  missing,
  possibleSubmitControls,
  submitted: false,
};`, { fields: safePreparationFields(fields) });
}

function resolveApprovedFields(
  workflow: ReviewedFirecrawlSubmitWorkflow,
  fields: ApprovedFirecrawlSubmissionField[],
): Array<{ key: string; value: string; locators: ReviewedLocator[]; required: boolean }> {
  const values = new Map<string, string>();
  for (const field of fields) {
    const name = field.name.trim().toLowerCase();
    if (!name || values.has(name)) {
      throw new Error("APPROVED_FORM_FIELDS_INVALID");
    }
    values.set(name, field.value);
  }

  const acceptedNames = new Set(
    workflow.fields.flatMap((field) =>
      field.acceptedPayloadNames.map((name) => name.toLowerCase()),
    ),
  );
  for (const name of values.keys()) {
    if (!acceptedNames.has(name)) {
      throw new Error("UNREVIEWED_FORM_FIELD");
    }
  }

  return workflow.fields.map((field) => {
    const names = field.acceptedPayloadNames.filter((candidate) =>
      values.has(candidate.toLowerCase()),
    );
    if (names.length > 1) {
      throw new Error("APPROVED_FORM_FIELDS_AMBIGUOUS");
    }
    const name = names[0];
    return {
      key: field.key,
      value: name === undefined ? "" : (values.get(name.toLowerCase()) ?? ""),
      locators: field.locators,
      required: field.required,
    };
  });
}

/**
 * Builds the complete approved execution as one non-retried Interact program.
 * All selectors and success conditions originate from the reviewed registry.
 */
export function buildApprovedSubmissionCode(args: {
  workflow: ReviewedFirecrawlSubmitWorkflow;
  fields: ApprovedFirecrawlSubmissionField[];
  forceHumanPresence?: boolean;
}): string {
  const fieldPlans = resolveApprovedFields(args.workflow, args.fields);
  const programVars = {
    fieldPlans,
    submit: args.workflow.submit,
    success: args.workflow.success,
    forceHumanPresence: args.forceHumanPresence === true,
  };
  return buildFirecrawlProgram(`
const workflow = vars.workflow;
const filled = [];
const missing = [];
const blockers = [];
const exactRegex = (value) => new RegExp("^\\\\s*" + value.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&") + "\\\\s*$", "i");
const locate = (locator) => {
  if (locator.kind === "selector") return page.locator(locator.value);
  if (locator.kind === "label") return page.getByLabel(exactRegex(locator.value));
  return page.getByPlaceholder(exactRegex(locator.value));
};
const firstVisible = async (locators) => {
  for (const locator of locators) {
    const candidate = locate(locator);
    if (await candidate.count()) {
      const first = candidate.first();
      if (await first.isVisible()) return first;
    }
  }
  return null;
};
const anyVisible = async (selector) => {
  const candidates = page.locator(selector);
  const count = Math.min(await candidates.count(), 30);
  for (let index = 0; index < count; index += 1) {
    if (await candidates.nth(index).isVisible()) return true;
  }
  return false;
};
const anyVisibleText = async (pattern) => {
  const candidates = page.getByText(pattern);
  const count = Math.min(await candidates.count(), 20);
  for (let index = 0; index < count; index += 1) {
    if (await candidates.nth(index).isVisible()) return true;
  }
  return false;
};
const output = (state, reasonCode) => ({
  state,
  reasonCode,
  filled,
  missing,
  blockers,
});

// Credentials, OTPs, terms, payment and contracts are never agent actions.
if (await anyVisible('input[type="password"]')) blockers.push("password");
if (await anyVisible('input[autocomplete="one-time-code"], input[name*="otp" i], input[name*="2fa" i], input[name*="verification" i]') || await anyVisibleText(/two[- ]factor|verification code|one[- ]time code|bestätigungscode|einmalcode|2fa/i)) blockers.push("two_factor_authentication");
if (await anyVisible('input[type="checkbox"][name*="terms" i], input[type="checkbox"][name*="agreement" i], input[type="checkbox"][name*="agb" i], input[type="checkbox"][id*="terms" i], input[type="checkbox"][id*="agreement" i], input[type="checkbox"][id*="agb" i]')) blockers.push("terms_acceptance");
if (await anyVisible('label:has(input[type="checkbox"])') && await anyVisibleText(/accept.*terms|agree.*terms|terms and conditions|nutzungsbedingungen|allgemeine geschäftsbedingungen|vertrag.*akzeptieren|vereinbarung.*akzeptieren/i)) blockers.push("terms_acceptance");
if (await anyVisible('input[autocomplete="cc-number"], input[name*="card" i], input[name*="iban" i], [data-payment], [data-contract]') || await anyVisibleText(/payment details|credit card|zahlungsmittel|zahlungsdaten|vertrag (abschließen|unterzeichnen)/i)) blockers.push("payment_or_contract");
if (blockers.includes("password") || blockers.includes("two_factor_authentication")) {
  return output("human_required", "AUTHENTICATION_REQUIRED");
}
if (blockers.includes("terms_acceptance")) {
  return output("human_required", "TERMS_ACCEPTANCE_REQUIRED");
}
if (blockers.includes("payment_or_contract")) {
  return output("human_required", "PAYMENT_OR_CONTRACT_CONTROL_PRESENT");
}

for (const field of workflow.fieldPlans) {
  if (!field.value && field.required) { missing.push(field.key); continue; }
  if (!field.value) continue;
  const target = await firstVisible(field.locators);
  if (!target) { if (field.required) missing.push(field.key); continue; }
  const tag = await target.evaluate((element) => element.tagName.toLowerCase());
  if (tag === "select") await target.selectOption({ label: field.value });
  else await target.fill(field.value);
  filled.push(field.key);
}
if (missing.length > 0) {
  return output("human_required", "MISSING_REQUIRED_FIELDS");
}

if (await anyVisible('iframe[src*="recaptcha" i], iframe[src*="hcaptcha" i], iframe[src*="turnstile" i], [class*="captcha" i], [id*="captcha" i], textarea[name="g-recaptcha-response"], textarea[name="h-captcha-response"], input[name="cf-turnstile-response"]')) {
  blockers.push("captcha");
  return output("human_required", "CAPTCHA_REQUIRED");
}
if (workflow.forceHumanPresence) {
  blockers.push("policy_requires_human_presence");
  return output("human_required", "HUMAN_PRESENCE_REQUIRED");
}

const submit = await firstVisible([workflow.submit.locator]);
if (!submit) {
  blockers.push("submit_control_missing");
  return output("human_required", "SUBMIT_CONTROL_MISMATCH");
}
const submitLabel = ((await submit.getAttribute("value")) || (await submit.innerText()) || "").trim();
if (!exactRegex(workflow.submit.expectedAccessibleName).test(submitLabel) || /(pay|purchase|buy|book|accept|agree|sign|zahlung|kaufen|buchen|akzeptieren|unterschreiben)/i.test(submitLabel)) {
  blockers.push("submit_control_mismatch");
  return output("human_required", "SUBMIT_CONTROL_MISMATCH");
}

const beforeUrl = page.url();
await submit.click({ timeout: 15000 });
await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => undefined);
const afterUrl = page.url();
let successObserved = afterUrl !== beforeUrl && workflow.success.urlIncludes.some((part) => afterUrl.includes(part));
if (!successObserved) {
  for (const selector of workflow.success.selectors) {
    if (await anyVisible(selector)) { successObserved = true; break; }
  }
}
if (!successObserved) {
  for (const text of workflow.success.visibleText) {
    const candidate = page.getByText(text, { exact: false });
    if (await candidate.count() && await candidate.first().isVisible()) { successObserved = true; break; }
  }
}
return output(successObserved ? "submitted_verified" : "verification_unknown", successObserved ? "SUCCESS_SIGNAL_OBSERVED" : "SUCCESS_SIGNAL_NOT_OBSERVED");`, { workflow: programVars });
}

export function parseApprovedSubmissionOutput(
  value: unknown,
): Omit<
  FirecrawlSubmissionResult,
  "jobId" | "liveViewUrl" | "interactiveLiveViewUrl"
> {
  const candidate =
    typeof value === "string"
      ? (() => {
          try { return JSON.parse(value) as unknown; } catch { return null; }
        })()
      : value;
  if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const parsed = candidate as Record<string, unknown>;
      const validStates = new Set([
        "submitted_verified",
        "human_required",
        "verification_unknown",
      ]);
      const validReasons = new Set([
        "SUCCESS_SIGNAL_OBSERVED",
        "HUMAN_PRESENCE_REQUIRED",
        "CAPTCHA_REQUIRED",
        "AUTHENTICATION_REQUIRED",
        "TERMS_ACCEPTANCE_REQUIRED",
        "PAYMENT_OR_CONTRACT_CONTROL_PRESENT",
        "MISSING_REQUIRED_FIELDS",
        "SUBMIT_CONTROL_MISMATCH",
        "SUCCESS_SIGNAL_NOT_OBSERVED",
      ]);
      if (
        typeof parsed.state !== "string" ||
        !validStates.has(parsed.state) ||
        typeof parsed.reasonCode !== "string" ||
        !validReasons.has(parsed.reasonCode)
      ) {
        throw new Error("FIRECRAWL_SUBMISSION_RESULT_INVALID");
      }
      const stringArray = (input: unknown) =>
        Array.isArray(input)
          ? input
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.slice(0, 120))
              .slice(0, 30)
          : [];
      return {
        state: parsed.state as FirecrawlSubmissionResult["state"],
        reasonCode: parsed.reasonCode as FirecrawlSubmissionResult["reasonCode"],
        filled: stringArray(parsed.filled),
        missing: stringArray(parsed.missing),
        blockers: stringArray(parsed.blockers),
      };
  }
  throw new Error("FIRECRAWL_SUBMISSION_RESULT_INVALID");
}

export async function prepareFormWithFirecrawl(args: {
  ctx: ActionCtx;
  url: string;
  fields: FormPreparationField[];
  profileName?: string;
}): Promise<FirecrawlFormPreview> {
  const document = await firecrawl.scrapeOnce(args.ctx, args.url, {
    formats: ["markdown"],
    onlyMainContent: true,
    maxAge: 0,
    storeInCache: false,
    ...(args.profileName
      ? { extra: { profile: { name: args.profileName, saveChanges: false } } }
      : {}),
  }, FIRECRAWL_PUBLIC_FORM_TIMEOUTS.requestMs);
  const scrapeId = document.metadata?.scrapeId;
  const jobId = typeof scrapeId === "string" ? scrapeId : undefined;
  if (!jobId) {
    throw new Error("Firecrawl did not return an interactive scrape session.");
  }
  const result = await firecrawl.interact(args.ctx, jobId, {
    code: buildPreparationCode(args.fields),
    language: "node",
    timeout: FIRECRAWL_PUBLIC_FORM_TIMEOUTS.prepareSeconds,
    requestTimeoutMs: FIRECRAWL_PUBLIC_FORM_TIMEOUTS.requestMs,
    mutating: false,
    allowUnsuccessfulBody: true,
  });
  let structured: unknown;
  try {
    structured = parseInteractEnvelope(result);
  } catch {
    await firecrawl.stopInteraction(args.ctx, jobId, FIRECRAWL_PUBLIC_FORM_TIMEOUTS.stopRequestMs).catch(() => undefined);
    throw new Error("FIRECRAWL_FORM_PREPARATION_FAILED");
  }
  return {
    jobId,
    ...(result.liveViewUrl ? { liveViewUrl: result.liveViewUrl } : {}),
    ...(result.interactiveLiveViewUrl
      ? { interactiveLiveViewUrl: result.interactiveLiveViewUrl }
      : {}),
    output: JSON.stringify(structured).slice(0, 20_000),
  };
}

export async function submitApprovedFormWithFirecrawl(args: {
  ctx: ActionCtx;
  url: string;
  fields: ApprovedFirecrawlSubmissionField[];
  workflow: ReviewedFirecrawlSubmitWorkflow;
  forceHumanPresence?: boolean;
  profileName?: string;
  onSessionCreated?: (jobId: string) => Promise<void>;
}): Promise<FirecrawlSubmissionResult> {
  // Retries are disabled for the mutating phase. A timeout after the click is
  // treated as indeterminate by the caller and must never trigger a resubmit.
  let jobId: string | null = null;
  let mutatingProgramDispatched = false;
  try {
    // Resolve and validate every approved field against the reviewed registry
    // before allocating a provider session.
    const code = buildApprovedSubmissionCode({
      workflow: args.workflow,
      fields: args.fields,
      forceHumanPresence: args.forceHumanPresence,
    });
    const document = await firecrawl.scrapeOnce(args.ctx, args.url, {
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: 0,
      storeInCache: false,
      ...(args.profileName
        ? { extra: { profile: { name: args.profileName, saveChanges: false } } }
        : {}),
    }, FIRECRAWL_PUBLIC_FORM_TIMEOUTS.requestMs);
    const scrapeId = document.metadata?.scrapeId;
    jobId = typeof scrapeId === "string" ? scrapeId : null;
    if (!jobId) {
      throw new Error("FIRECRAWL_INTERACTIVE_SESSION_MISSING");
    }
    await args.onSessionCreated?.(jobId);
    mutatingProgramDispatched = true;
    const result = await firecrawl.interact(args.ctx, jobId, {
      code,
      language: "node",
      timeout: FIRECRAWL_PUBLIC_FORM_TIMEOUTS.submitSeconds,
      requestTimeoutMs: FIRECRAWL_PUBLIC_FORM_TIMEOUTS.requestMs,
      mutating: true,
      allowUnsuccessfulBody: true,
    });
    let structured: unknown;
    try {
      structured = parseInteractEnvelope(result);
    } catch {
      throw new FirecrawlSubmissionError(
        "FIRECRAWL_SUBMISSION_FAILED",
        true,
      );
    }
    const parsed = parseApprovedSubmissionOutput(structured);
    if (parsed.state === "submitted_verified") {
      await firecrawl.stopInteraction(args.ctx, jobId, FIRECRAWL_PUBLIC_FORM_TIMEOUTS.stopRequestMs).catch(() => undefined);
      return { jobId, ...parsed };
    }
    if (
      parsed.state === "human_required" &&
      !result.liveViewUrl &&
      !result.interactiveLiveViewUrl
    ) {
      await firecrawl.stopInteraction(args.ctx, jobId, FIRECRAWL_PUBLIC_FORM_TIMEOUTS.stopRequestMs).catch(() => undefined);
      throw new FirecrawlSubmissionError(
        "FIRECRAWL_HUMAN_HANDOFF_UNAVAILABLE",
        false,
      );
    }
    return {
      jobId,
      ...parsed,
      ...(result.liveViewUrl ? { liveViewUrl: result.liveViewUrl } : {}),
      ...(result.interactiveLiveViewUrl
        ? { interactiveLiveViewUrl: result.interactiveLiveViewUrl }
        : {}),
    };
  } catch (error) {
    if (jobId) {
      await firecrawl.stopInteraction(args.ctx, jobId, FIRECRAWL_PUBLIC_FORM_TIMEOUTS.stopRequestMs).catch(() => undefined);
    }
    if (error instanceof FirecrawlSubmissionError) throw error;
    throw new FirecrawlSubmissionError(
      error instanceof FirecrawlSubmissionError
        ? error.message
        : "FIRECRAWL_SUBMISSION_FAILED",
      mutatingProgramDispatched,
    );
  }
}

export async function resumeFirecrawlInteractionPreview(args: {
  ctx: ActionCtx;
  jobId: string;
}): Promise<{
  liveViewUrl?: string;
  interactiveLiveViewUrl?: string;
}> {
  const result = await firecrawl.interact(args.ctx, args.jobId, {
    code: buildFirecrawlProgram('return { state: "preview_only" };', {}),
    language: "node",
    timeout: FIRECRAWL_PUBLIC_FORM_TIMEOUTS.previewSeconds,
    requestTimeoutMs: FIRECRAWL_PUBLIC_FORM_TIMEOUTS.requestMs,
    mutating: false,
    allowUnsuccessfulBody: true,
  });
  try {
    parseInteractEnvelope(result);
  } catch {
    throw new Error("FIRECRAWL_INTERACTION_NOT_AVAILABLE");
  }
  return {
    ...(result.liveViewUrl ? { liveViewUrl: result.liveViewUrl } : {}),
    ...(result.interactiveLiveViewUrl
      ? { interactiveLiveViewUrl: result.interactiveLiveViewUrl }
      : {}),
  };
}

export async function stopFirecrawlInteraction(args: {
  ctx: ActionCtx;
  jobId: string;
}): Promise<void> {
  await firecrawl.stopInteraction(args.ctx, args.jobId, FIRECRAWL_PUBLIC_FORM_TIMEOUTS.stopRequestMs);
}
