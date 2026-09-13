/**
 * Thin, dependency-injected driver for the reviewed roomscout.dev portal.
 *
 * The component/REST transport owns browser sessions. This module owns the
 * reviewed workflow and deliberately never sends credentials, OTPs or message
 * bodies as natural-language instructions. Exact values travel only through
 * named action variables.
 */

import {
  evaluateControlledRegistrationPolicy,
  type ControlledRegistrationEvidence,
} from "./controlledPortalPolicy";
import { z, type ZodType } from "zod";
import {
  REVIEWED_PORTAL_ORIGIN,
  reviewedPortalPath,
} from "./reviewedPortalUrl";

const REVIEWED_ORIGIN = REVIEWED_PORTAL_ORIGIN;
const REVIEWED_ADAPTER = "roomscout-dev-v1";
const MAX_OBSERVED_ACTIONS = 4;
const CAPTCHA_POLL_ATTEMPTS = 16;
const CAPTCHA_POLL_INTERVAL_MS = 2_000;

export type StagehandObservedAction = {
  description: string;
  selector: string;
  method?: string;
  arguments?: string[];
  backendNodeId?: number;
};

export type PortalFormRole =
  | "email"
  | "password"
  | "verification_code"
  | "sender_label"
  | "message_body"
  | "submit";

export type PortalFormInspection = {
  count: number;
  visible: boolean;
  editable: boolean;
  name: string | null;
  type: string | null;
  autocomplete: string | null;
  required: boolean;
  value: string | null;
  formValid: boolean | null;
};

export type PortalDomEvidence =
  | { kind: "access"; authenticated: boolean }
  | { kind: "registration"; terms: ControlledRegistrationEvidence["terms"]; captcha: { kind: "absent" | "browserbase_native_solved" | "present_unsolved" | "unknown" }; paymentOrContractDetected: boolean; termsGateVisible: boolean }
  | { kind: "composer"; body: string | null }
  | { kind: "receipt"; visible: boolean; providerThreadId?: string; providerMessageId?: string }
  | { kind: "thread"; thread: unknown | null }
  | { kind: "inbox"; providerThreadIds: string[] };

export interface StagehandPortalPrimitives {
  navigate(input: { url: string }): Promise<void>;
  getUrl(): Promise<string>;
  observe(input: {
    instruction: string;
    options?: { variables?: Record<string, string> };
  }): Promise<StagehandObservedAction[]>;
  act(input: {
    action: StagehandObservedAction;
    options?: { variables?: Record<string, string> };
  }): Promise<void>;
  actInstruction?(input: {
    instruction: string;
    variables?: Record<string, string>;
  }): Promise<void>;
  clickSelector?(input: { selector: string }): Promise<void>;
  fillSelector?(input: { selector: string; value: string }): Promise<void>;
  extract<Schema extends ZodType>(input: {
    instruction: string;
    schema: Schema;
  }): Promise<z.output<Schema>>;
  readEvidence(input: { kind: PortalDomEvidence["kind"] }): Promise<PortalDomEvidence>;
  inspectForm(input: {
    selector: string;
    role: PortalFormRole;
  }): Promise<PortalFormInspection>;
  wait?(milliseconds: number): Promise<void>;
}

const CLERK_EMAIL_SELECTOR = 'input[name="emailAddress"]';
const CLERK_PASSWORD_SELECTOR = 'input[name="password"]';
const CLERK_CODE_SELECTOR = 'input[autocomplete="one-time-code"],input[name="code"]';
const CLERK_PRIMARY_SELECTOR = 'button[data-localization-key="formButtonPrimary"]';

async function fillReviewedField(input: {
  client: StagehandPortalPrimitives;
  selector: string;
  role: Exclude<PortalFormRole, "submit">;
  instruction: string;
  variable: string;
  value: string;
}): Promise<boolean> {
  const before = await input.client.inspectForm({
    selector: input.selector,
    role: input.role,
  });
  if (!validFieldForRole(before, input.role)) {
    return false;
  }
  if (input.client.actInstruction) {
    await input.client.actInstruction({
      instruction: input.instruction,
      variables: { [input.variable]: input.value },
    });
  } else if (input.client.fillSelector) {
    await input.client.fillSelector({
      selector: input.selector,
      value: input.value,
    });
  } else {
    return false;
  }
  await assertCurrentScope(input.client);
  const after = await input.client.inspectForm({
    selector: input.selector,
    role: input.role,
  });
  return validFieldForRole(after, input.role) && after.value === input.value;
}

async function fillReviewedSelector(input: {
  client: StagehandPortalPrimitives;
  selector: string;
  role: Exclude<PortalFormRole, "submit">;
  value: string;
}): Promise<boolean> {
  const before = await input.client.inspectForm({ selector: input.selector, role: input.role });
  if (!validFieldForRole(before, input.role) || !input.client.fillSelector) return false;
  await input.client.fillSelector({ selector: input.selector, value: input.value });
  await assertCurrentScope(input.client);
  const after = await input.client.inspectForm({ selector: input.selector, role: input.role });
  return validFieldForRole(after, input.role) && after.value === input.value;
}

async function submitReviewedClerkPrimary(
  client: StagehandPortalPrimitives,
): Promise<boolean> {
  const inspection = await client.inspectForm({
    selector: CLERK_PRIMARY_SELECTOR,
    role: "submit",
  });
  if (
    inspection.count !== 1 ||
    !inspection.visible ||
    inspection.formValid !== true ||
    !client.clickSelector
  ) {
    return false;
  }
  await client.clickSelector({ selector: CLERK_PRIMARY_SELECTOR });
  await client.wait?.(250);
  await assertCurrentScope(client);
  return true;
}

async function waitForReviewedField(
  client: StagehandPortalPrimitives,
  selector: string,
  role: Exclude<PortalFormRole, "submit">,
): Promise<boolean> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (validFieldForRole(await client.inspectForm({ selector, role }), role)) {
      return true;
    }
    if (attempt < 19) await client.wait?.(500);
  }
  return false;
}

export type PortalHumanBlocker =
  | "captcha"
  | "terms"
  | "payment"
  | "contract"
  | "two_factor"
  | "password"
  | "policy_human_presence";

export type PortalAccessResult =
  | { outcome: "authenticated" }
  | { outcome: "awaiting_code" }
  | { outcome: "human_required"; blocker: PortalHumanBlocker };

export type ParsedPortalMessage = {
  providerMessageId: string;
  direction: "inbound" | "outbound" | "unknown";
  senderLabel?: string;
  bodyText: string;
  sentAt: number;
};

export type ParsedPortalThread = {
  providerThreadId: string;
  subject?: string;
  participants: string[];
  lastMessageAt: number;
  messages: ParsedPortalMessage[];
};

export type PortalSendResult =
  | {
      outcome: "succeeded";
      submitted: true;
      providerThreadId: string;
      providerMessageId: string;
    }
  | {
      outcome: "human_required";
      submitted: false;
      blocker: PortalHumanBlocker;
    }
  | { outcome: "unknown"; submitted: true; errorCode: "SUBMIT_RESULT_UNKNOWN" };

type PageState = {
  authenticated: boolean;
  stage: "authenticated" | "sign_in" | "sign_up" | "verification" | "unknown";
  blocker: PortalHumanBlocker | null;
};

const pageStateSchema = z.object({
  authenticated: z.boolean(),
  stage: z.enum(["authenticated", "sign_in", "sign_up", "verification", "unknown"]),
  blocker: z.enum(["captcha", "terms", "payment", "contract", "two_factor", "password", "policy_human_presence"]).nullable(),
});
function assertReviewedScope(input: { baseUrl: string; adapterKey: string }): void {
  const parsed = new URL(input.baseUrl);
  if (
    input.adapterKey !== REVIEWED_ADAPTER ||
    parsed.origin !== REVIEWED_ORIGIN ||
    (parsed.pathname !== "/" && parsed.pathname !== "") ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("PORTAL_ADAPTER_NOT_REVIEWED");
  }
}

function portalUrl(path: string): string {
  return reviewedPortalPath(path);
}

async function assertCurrentScope(client: StagehandPortalPrimitives): Promise<void> {
  const current = new URL(await client.getUrl());
  if (current.origin !== REVIEWED_ORIGIN) throw new Error("PORTAL_NAVIGATION_ESCAPED");
}

async function confirmPortalAuthenticated(client: StagehandPortalPrimitives): Promise<boolean> {
  await client.navigate({ url: portalUrl("/inbox") });
  await assertCurrentScope(client);
  const evidence = await client.readEvidence({ kind: "access" });
  return evidence.kind === "access" && evidence.authenticated;
}

async function confirmCurrentPageAuthenticated(
  client: StagehandPortalPrimitives,
): Promise<boolean> {
  const evidence = await client.readEvidence({ kind: "access" });
  return evidence.kind === "access" && evidence.authenticated;
}

async function waitForCurrentPageAuthenticated(
  client: StagehandPortalPrimitives,
  attempts: number,
  intervalMs: number,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await confirmCurrentPageAuthenticated(client)) return true;
    if (attempt < attempts - 1) await client.wait?.(intervalMs);
  }
  return false;
}

async function confirmPortalHomeAuthenticated(
  client: StagehandPortalPrimitives,
): Promise<boolean> {
  await client.navigate({ url: portalUrl("/") });
  await assertCurrentScope(client);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await confirmCurrentPageAuthenticated(client)) return true;
    if (attempt < 19) await client.wait?.(500);
  }
  return false;
}

export async function verifyControlledPortalContext(input: {
  client: StagehandPortalPrimitives;
  baseUrl: string;
  adapterKey: string;
}): Promise<boolean> {
  assertReviewedScope(input);
  return await confirmPortalHomeAuthenticated(input.client);
}

type ControlledRegistrationStep =
  | "OTP_FIELD"
  | "OTP_FILL"
  | "OTP_SUBMIT"
  | "AUTH_CONFIRM"
  | "SIGNUP_NAVIGATE"
  | "REDIRECT_AUTH_READ"
  | "POLICY_READ"
  | "TERMS_READ"
  | "TERMS_ACCEPT"
  | "EMAIL_FIELD"
  | "EMAIL_FILL"
  | "PASSWORD_FILL"
  | "EXACT_READBACK"
  | "SIGNUP_SUBMIT"
  | "VERIFICATION_FIELD";

export function controlledRegistrationFailureCode(error: unknown): string | null {
  if (!(error instanceof Error)) return null;
  const match = /^CONTROLLED_REGISTRATION_([A-Z_]+)_FAILED$/.exec(error.message);
  return match ? error.message : null;
}

export async function ensureControlledPortalRegistration(input: {
  client: StagehandPortalPrimitives;
  email?: string;
  password?: string;
  verificationCode?: string;
}): Promise<PortalAccessResult> {
  let step: ControlledRegistrationStep = "SIGNUP_NAVIGATE";
  try {
    if (input.verificationCode) {
    if (!/^\d{4,10}$/.test(input.verificationCode)) {
      return { outcome: "human_required", blocker: "two_factor" };
    }
    step = "OTP_FIELD";
    if (!(await waitForReviewedField(
      input.client,
      CLERK_CODE_SELECTOR,
      "verification_code",
    ))) {
      return { outcome: "human_required", blocker: "two_factor" };
    }
    step = "OTP_FILL";
    const filled = await fillReviewedSelector({
      client: input.client,
      selector: CLERK_CODE_SELECTOR,
      role: "verification_code",
      value: input.verificationCode,
    });
    if (!filled) {
      step = "AUTH_CONFIRM";
      return await waitForCurrentPageAuthenticated(input.client, 20, 500)
        ? { outcome: "authenticated" }
        : { outcome: "human_required", blocker: "two_factor" };
    }
    // Clerk may auto-submit after the last OTP digit. Give that transition a
    // short bounded window and never click again once auth is established.
    step = "AUTH_CONFIRM";
    if (await waitForCurrentPageAuthenticated(input.client, 8, 250)) {
      return { outcome: "authenticated" };
    }
    step = "OTP_SUBMIT";
    if (!(await submitReviewedClerkPrimary(input.client))) {
      step = "AUTH_CONFIRM";
      return await waitForCurrentPageAuthenticated(input.client, 20, 500)
        ? { outcome: "authenticated" }
        : { outcome: "human_required", blocker: "two_factor" };
    }
    step = "AUTH_CONFIRM";
    if (!(await confirmPortalHomeAuthenticated(input.client))) {
      return { outcome: "human_required", blocker: "two_factor" };
    }
    return { outcome: "authenticated" };
  }

  step = "SIGNUP_NAVIGATE";
  await input.client.navigate({ url: portalUrl("/sign-up") });
  await assertCurrentScope(input.client);
  step = "REDIRECT_AUTH_READ";
  if (new URL(await input.client.getUrl()).pathname !== "/sign-up" &&
    await confirmCurrentPageAuthenticated(input.client)) {
    return { outcome: "authenticated" };
  }
  if (!input.email && !input.password) {
    const codeField = await input.client.inspectForm({
      selector: CLERK_CODE_SELECTOR,
      role: "verification_code",
    });
    if (validFieldForRole(codeField, "verification_code")) {
      return { outcome: "awaiting_code" };
    }
  }
  step = "POLICY_READ";
  const decision = await inspectRegistrationPolicy(input.client);
  if (!decision.allowed) {
    return { outcome: "human_required", blocker: policyBlocker(decision.reason) };
  }
  step = "TERMS_READ";
  const evidence = await input.client.readEvidence({ kind: "registration" });
  if (evidence.kind !== "registration") {
    return { outcome: "human_required", blocker: "terms" };
  }
  if (evidence.termsGateVisible) {
    if (!input.client.clickSelector) {
      return { outcome: "human_required", blocker: "terms" };
    }
    step = "TERMS_ACCEPT";
    await input.client.clickSelector({ selector: '[data-roomscout-write="demo-terms"]' });
    await input.client.clickSelector({ selector: '[data-roomscout-write="accept-demo-terms"]' });
  }
  if (!input.email || !input.password) {
    return { outcome: "human_required", blocker: "password" };
  }
  step = "EMAIL_FIELD";
  if (!(await waitForReviewedField(input.client, CLERK_EMAIL_SELECTOR, "email"))) {
    // Clerk redirects an already authenticated persistent context away from the
    // sign-up form. Treat that as success using DOM auth evidence only.
    if (await confirmCurrentPageAuthenticated(input.client)) {
      return { outcome: "authenticated" };
    }
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  step = "EMAIL_FILL";
  const emailFilled = await fillReviewedField({
    client: input.client,
    selector: CLERK_EMAIL_SELECTOR,
    role: "email",
    instruction: "Fill the email address input with %email%. Do not submit.",
    variable: "email",
    value: input.email,
  });
  step = "PASSWORD_FILL";
  const passwordFilled = await fillReviewedField({
    client: input.client,
    selector: CLERK_PASSWORD_SELECTOR,
    role: "password",
    instruction: "Fill the password input with %password%. Do not submit.",
    variable: "password",
    value: input.password,
  });
  if (!emailFilled || !passwordFilled) {
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  step = "EXACT_READBACK";
  const stillExact = await verifyExactFields(input.client, [
    { selector: CLERK_EMAIL_SELECTOR, role: "email", expectedValue: input.email },
    { selector: CLERK_PASSWORD_SELECTOR, role: "password", expectedValue: input.password },
  ]);
  step = "SIGNUP_SUBMIT";
  if (!stillExact || !(await submitReviewedClerkPrimary(input.client))) {
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  step = "VERIFICATION_FIELD";
  return await waitForReviewedField(
    input.client,
    CLERK_CODE_SELECTOR,
    "verification_code",
  )
    ? { outcome: "awaiting_code" }
    : { outcome: "human_required", blocker: "policy_human_presence" };
  } catch {
    throw new Error(`CONTROLLED_REGISTRATION_${step}_FAILED`);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function blocker(value: unknown): PortalHumanBlocker | null {
  return value === "captcha" || value === "terms" || value === "payment" ||
    value === "contract" || value === "two_factor" || value === "password" ||
    value === "policy_human_presence"
    ? value
    : null;
}

async function pageState(client: StagehandPortalPrimitives): Promise<PageState> {
  const raw = asRecord(await client.extract({
    instruction:
      "Inspect only the current page. Return authenticated boolean, stage as authenticated/sign_in/sign_up/verification/unknown, and blocker as captcha/terms/payment/contract/two_factor/password/policy_human_presence or null. A normal password field on sign-in/sign-up is not a blocker.",
    schema: pageStateSchema,
  }));
  const stage = raw?.stage;
  return {
    authenticated: raw?.authenticated === true,
    stage: stage === "authenticated" || stage === "sign_in" || stage === "sign_up" ||
      stage === "verification" ? stage : "unknown",
    blocker: blocker(raw?.blocker),
  };
}

function registrationEvidence(value: PortalDomEvidence, pageUrl: string): ControlledRegistrationEvidence {
  if (value.kind !== "registration") {
    return { adapterKey: REVIEWED_ADAPTER, pageUrl, terms: { kind: "unknown" }, captcha: { kind: "unknown" }, paymentOrContractDetected: false };
  }
  return {
    adapterKey: REVIEWED_ADAPTER,
    pageUrl,
    terms: value.terms,
    captcha: value.captcha,
    paymentOrContractDetected: value.paymentOrContractDetected,
  };
}

async function inspectRegistrationPolicy(
  client: StagehandPortalPrimitives,
): Promise<ReturnType<typeof evaluateControlledRegistrationPolicy>> {
  // Browserbase's native solver is configured by the parent session. The
  // driver never interacts with a challenge; it only waits for bounded,
  // structured evidence that the native solver completed.
  for (let attempt = 0; attempt < CAPTCHA_POLL_ATTEMPTS; attempt += 1) {
    const pageUrl = await client.getUrl();
    const evidence = registrationEvidence(await client.readEvidence({ kind: "registration" }), pageUrl);
    const decision = evaluateControlledRegistrationPolicy(evidence);
    if (decision.allowed || decision.reason !== "REGISTRATION_CAPTCHA_REQUIRES_NATIVE_SOLVE") {
      return decision;
    }
    if (attempt < CAPTCHA_POLL_ATTEMPTS - 1) {
      await client.wait?.(CAPTCHA_POLL_INTERVAL_MS);
    }
  }
  return { allowed: false, reason: "REGISTRATION_CAPTCHA_REQUIRES_NATIVE_SOLVE" };
}

function policyBlocker(
  reason: Exclude<ReturnType<typeof evaluateControlledRegistrationPolicy>, { allowed: true }> ["reason"],
): PortalHumanBlocker {
  if (reason === "REGISTRATION_TERMS_NOT_REVIEWED") return "terms";
  if (reason === "REGISTRATION_CAPTCHA_REQUIRES_NATIVE_SOLVE") return "captcha";
  if (reason === "REGISTRATION_COMMERCIAL_COMMITMENT_REQUIRES_HUMAN") return "contract";
  return "policy_human_presence";
}

async function uniqueAction(
  client: StagehandPortalPrimitives,
  instruction: string,
  options?: { variables?: Record<string, string>; method?: "fill" | "click"; placeholder?: string },
): Promise<StagehandObservedAction | null> {
  const actions = (await client.observe({
    instruction,
    ...(options?.variables ? { options: { variables: options.variables } } : {}),
  })).filter((action) =>
    typeof action.description === "string" && action.description.length > 0 &&
    typeof action.selector === "string" && action.selector.length > 0 &&
    (!options?.method || action.method === options.method) &&
    (!options?.placeholder || action.arguments?.includes(options.placeholder) === true));
  return actions.length === 1 && actions.length <= MAX_OBSERVED_ACTIONS ? actions[0]! : null;
}

async function fillExact(
  client: StagehandPortalPrimitives,
  instruction: string,
  variable: string,
  value: string,
  role: Exclude<PortalFormRole, "submit">,
): Promise<string | null> {
  const placeholder = `%${variable}%`;
  const action = await uniqueAction(client, instruction, {
    variables: { [variable]: value }, method: "fill", placeholder,
  });
  if (!action) return null;
  const before = await client.inspectForm({ selector: action.selector, role });
  if (!validFieldForRole(before, role)) return null;
  await client.act({ action, options: { variables: { [variable]: value } } });
  await assertCurrentScope(client);
  const after = await client.inspectForm({ selector: action.selector, role });
  return validFieldForRole(after, role) && after.value === value
    ? action.selector
    : null;
}

async function verifyExactFields(
  client: StagehandPortalPrimitives,
  fields: ReadonlyArray<{
    selector: string;
    role: Exclude<PortalFormRole, "submit">;
    expectedValue: string;
  }>,
): Promise<boolean> {
  for (const field of fields) {
    const inspection = await client.inspectForm({
      selector: field.selector,
      role: field.role,
    });
    if (!validFieldForRole(inspection, field.role) || inspection.value !== field.expectedValue) {
      return false;
    }
  }
  return true;
}

function validFieldForRole(
  field: PortalFormInspection,
  role: Exclude<PortalFormRole, "submit">,
): boolean {
  if (field.count !== 1 || !field.visible || !field.editable) return false;
  const name = field.name?.toLowerCase() ?? "";
  const type = field.type?.toLowerCase() ?? "";
  const autocomplete = field.autocomplete?.toLowerCase() ?? "";
  if (role === "email") {
    return type === "email" || autocomplete === "email" || /(^|[_-])email(address)?($|[_-])/.test(name);
  }
  if (role === "password") {
    return type === "password" || autocomplete === "new-password" || autocomplete === "current-password";
  }
  if (role === "verification_code") {
    return autocomplete === "one-time-code" || /code|otp|verification/.test(name);
  }
  if (role === "message_body") {
    return type === "textarea" || /body|message|content/.test(name);
  }
  return type === "text" || /sender|name|label/.test(name);
}

async function validSubmit(
  client: StagehandPortalPrimitives,
  action: StagehandObservedAction,
): Promise<boolean> {
  const submit = await client.inspectForm({ selector: action.selector, role: "submit" });
  return submit.count === 1 && submit.visible && submit.formValid === true;
}

async function clickUnique(
  client: StagehandPortalPrimitives,
  instruction: string,
): Promise<boolean> {
  const action = await uniqueAction(client, instruction, { method: "click" });
  if (!action) return false;
  await client.act({ action });
  await client.wait?.(250);
  await assertCurrentScope(client);
  return true;
}

async function submitReviewedClerkAuthForm(
  client: StagehandPortalPrimitives,
): Promise<boolean> {
  // Clerk includes hidden and password-toggle submit buttons. Its stable
  // primary-button marker is unambiguous on this exact reviewed origin,
  // whereas an observed XPath can point at the hidden helper submit.
  const action: StagehandObservedAction = {
      description: "Submit the reviewed Clerk authentication form",
      selector: 'xpath=//button[@data-localization-key="formButtonPrimary"]',
      method: "click",
      arguments: [],
  };
  if (!(await validSubmit(client, action))) return false;
  await client.act({ action });
  await client.wait?.(250);
  await assertCurrentScope(client);
  return true;
}

async function waitForSettledState(
  client: StagehandPortalPrimitives,
  accepted: ReadonlySet<PageState["stage"]>,
): Promise<PageState> {
  let state = await pageState(client);
  for (let attempt = 0; attempt < 5 && !accepted.has(state.stage) && !state.blocker; attempt += 1) {
    await client.wait?.(500);
    state = await pageState(client);
  }
  return state;
}

export async function ensurePortalAccess(input: {
  client: StagehandPortalPrimitives;
  baseUrl: string;
  adapterKey: string;
  mode: "register" | "login";
  email?: string;
  password?: string;
  displayName?: string;
  verificationCode?: string;
}): Promise<PortalAccessResult> {
  assertReviewedScope(input);
  // Verification continues in the existing persistent browser page. Navigating
  // away would discard Clerk's in-progress sign-up transaction.
  if (!input.verificationCode) {
    await input.client.navigate({ url: portalUrl("/inbox") });
  }
  await assertCurrentScope(input.client);
  let state = await pageState(input.client);
  if (state.authenticated) {
    return await confirmPortalAuthenticated(input.client)
      ? { outcome: "authenticated" }
      : { outcome: "human_required", blocker: "policy_human_presence" };
  }

  if (input.verificationCode) {
    if (state.stage !== "verification") {
      return { outcome: "human_required", blocker: "two_factor" };
    }
  } else if (input.mode === "register" && state.stage !== "sign_up") {
    // A new-account run must never submit its ephemeral password to sign-in.
    await input.client.navigate({ url: portalUrl("/sign-up") });
    await assertCurrentScope(input.client);
    state = await pageState(input.client);
  }

  if (state.stage === "sign_up") {
    const decision = await inspectRegistrationPolicy(input.client);
    if (!decision.allowed) {
      return { outcome: "human_required", blocker: policyBlocker(decision.reason) };
    }
    const terms = await input.client.readEvidence({ kind: "registration" });
    if (terms.kind !== "registration") {
      return { outcome: "human_required", blocker: "terms" };
    }
    const currentTermsDecision = evaluateControlledRegistrationPolicy(
      registrationEvidence(terms, await input.client.getUrl()),
    );
    if (!currentTermsDecision.allowed) {
      return { outcome: "human_required", blocker: policyBlocker(currentTermsDecision.reason) };
    }
    if (terms.termsGateVisible) {
      if (!(await clickUnique(input.client,
        "Find the single visible checkbox marked data-roomscout-write=demo-terms and check it.")) ||
        !(await clickUnique(input.client,
          "Find the single visible button marked data-roomscout-write=accept-demo-terms and submit the terms gate."))) {
        return { outcome: "human_required", blocker: "terms" };
      }
      // The controlled gate swaps to Clerk asynchronously. A single immediate
      // extraction can still see the departing gate and classify the page as
      // unknown even though the sign-up form appears a moment later.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        state = await pageState(input.client);
        if (state.stage === "sign_up") break;
        if (attempt < 5) await input.client.wait?.(500);
      }
      if (state.stage !== "sign_up") {
        return { outcome: "human_required", blocker: "policy_human_presence" };
      }
    }
  }

  if (state.blocker) return { outcome: "human_required", blocker: state.blocker };

  if (state.stage === "verification") {
    if (!input.verificationCode) return { outcome: "awaiting_code" };
    if (!/^\d{4,10}$/.test(input.verificationCode)) {
      return { outcome: "human_required", blocker: "two_factor" };
    }
    const filled = await fillExact(
      input.client,
      "Find the single visible email verification-code input and fill it with %verificationCode%. Do not submit.",
      "verificationCode",
      input.verificationCode,
      "verification_code",
    );
    if (!filled) return { outcome: "human_required", blocker: "two_factor" };
    const submit = await uniqueAction(
      input.client,
      "Find the single visible button that submits the email verification code.",
    );
    if (!submit || !(await validSubmit(input.client, submit))) {
      return { outcome: "human_required", blocker: "two_factor" };
    }
    await input.client.act({ action: submit });
    await assertCurrentScope(input.client);
    state = await waitForSettledState(input.client, new Set(["authenticated"]));
    if (state.authenticated) {
      return await confirmPortalAuthenticated(input.client)
        ? { outcome: "authenticated" }
        : { outcome: "human_required", blocker: "policy_human_presence" };
    }
    return state.blocker
      ? { outcome: "human_required", blocker: state.blocker }
      : { outcome: "human_required", blocker: "two_factor" };
  }

  if (!input.email || !input.password) {
    return { outcome: "human_required", blocker: "password" };
  }
  const signUp = input.mode === "register" && state.stage === "sign_up";
  if (state.stage !== "sign_in" && !signUp) {
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  const emailSelector = await fillExact(input.client,
    "Find the single visible email-address input in the authentication form and fill it with %email%. Do not submit.",
    "email", input.email, "email");
  if (!emailSelector) {
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  // The reviewed Clerk sign-up currently has no display-name field. Do not
  // ask an observer to infer an optional target here: it can otherwise select
  // the email input and overwrite the verified mailbox address.
  const passwordSelector = await fillExact(input.client,
    "Find the single visible password input in the authentication form and fill it with %password%. Do not submit.",
    "password", input.password, "password");
  if (!passwordSelector) {
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  if (!(await verifyExactFields(input.client, [
    { selector: emailSelector, role: "email", expectedValue: input.email },
    { selector: passwordSelector, role: "password", expectedValue: input.password },
  ]))) {
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  if (!(await submitReviewedClerkAuthForm(input.client))) {
    return { outcome: "human_required", blocker: "policy_human_presence" };
  }
  state = await waitForSettledState(input.client, new Set(["authenticated", "verification"]));
  if (state.authenticated) {
    return await confirmPortalAuthenticated(input.client)
      ? { outcome: "authenticated" }
      : { outcome: "human_required", blocker: "policy_human_presence" };
  }
  if (state.stage === "verification") return { outcome: "awaiting_code" };
  return {
    outcome: "human_required",
    blocker: state.blocker ?? "policy_human_presence",
  };
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseThread(value: unknown): ParsedPortalThread | null {
  const raw = asRecord(value);
  const providerThreadId = cleanText(raw?.providerThreadId, 200);
  if (!providerThreadId || !Array.isArray(raw?.messages)) return null;
  const messages = raw.messages.slice(0, 20).flatMap((item): ParsedPortalMessage[] => {
    const message = asRecord(item);
    const providerMessageId = cleanText(message?.providerMessageId, 200);
    const bodyText = cleanText(message?.bodyText, 10_000);
    const sentAt = message?.sentAt;
    if (!providerMessageId || !bodyText || typeof sentAt !== "number" || !Number.isFinite(sentAt)) return [];
    const rawDirection = message?.direction;
    const direction = rawDirection === "inbound" || rawDirection === "outbound"
      ? rawDirection : "unknown";
    const senderLabel = cleanText(message?.senderLabel, 200);
    return [{ providerMessageId, direction, ...(senderLabel ? { senderLabel } : {}), bodyText, sentAt }];
  });
  const participants = Array.isArray(raw?.participants)
    ? raw.participants.slice(0, 20).map((part) => cleanText(part, 200)).filter(Boolean)
    : [];
  if (typeof raw.lastMessageAt !== "number" || !Number.isFinite(raw.lastMessageAt)) return null;
  const lastMessageAt = raw.lastMessageAt;
  const subject = cleanText(raw.subject, 500);
  return { providerThreadId, ...(subject ? { subject } : {}), participants, lastMessageAt, messages };
}

function assertProviderId(id: string): void {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) throw new Error("PORTAL_PROVIDER_ID_INVALID");
}

export async function readPortalThread(input: {
  client: StagehandPortalPrimitives;
  baseUrl: string;
  adapterKey: string;
  providerThreadId: string;
}): Promise<ParsedPortalThread | null> {
  assertReviewedScope(input);
  assertProviderId(input.providerThreadId);
  await input.client.navigate({ url: portalUrl(`/inbox/${encodeURIComponent(input.providerThreadId)}`) });
  await assertCurrentScope(input.client);
  if (!(await confirmCurrentPageAuthenticated(input.client))) return null;
  const evidence = await input.client.readEvidence({ kind: "thread" });
  const thread = evidence.kind === "thread" ? parseThread(evidence.thread) : null;
  return thread?.providerThreadId === input.providerThreadId ? thread : null;
}

export async function readPortalInbox(input: {
  client: StagehandPortalPrimitives;
  baseUrl: string;
  adapterKey: string;
}): Promise<ParsedPortalThread[]> {
  assertReviewedScope(input);
  await input.client.navigate({ url: portalUrl("/inbox") });
  await assertCurrentScope(input.client);
  if (!(await confirmCurrentPageAuthenticated(input.client))) return [];
  const evidence = await input.client.readEvidence({ kind: "inbox" });
  const providerThreadIds = evidence.kind === "inbox"
    ? evidence.providerThreadIds.slice(0, 20).map((id) => cleanText(id, 200)).filter(Boolean)
    : [];
  const uniqueIds = [...new Set(providerThreadIds)];
  const threads: ParsedPortalThread[] = [];
  for (const providerThreadId of uniqueIds) {
    try {
      assertProviderId(providerThreadId);
    } catch {
      continue;
    }
    const thread = await readPortalThread({ ...input, providerThreadId });
    if (thread) threads.push(thread);
  }
  return threads;
}

export async function sendPortalMessage(input: {
  client: StagehandPortalPrimitives;
  baseUrl: string;
  adapterKey: string;
  body: string;
  providerThreadId?: string;
  targetPath?: string;
  senderLabel?: string;
  beforeSubmit: (claim: { body: string; providerThreadId?: string; targetPath?: string }) => Promise<void>;
}): Promise<PortalSendResult> {
  assertReviewedScope(input);
  if (!input.body || input.body.length > 5_000) throw new Error("PORTAL_MESSAGE_BODY_INVALID");
  if (input.providerThreadId) assertProviderId(input.providerThreadId);
  const path = input.providerThreadId
    ? `/inbox/${encodeURIComponent(input.providerThreadId)}`
    : input.targetPath;
  if (!path || !/^\/listings\/[A-Za-z0-9_-]{1,200}$/.test(path) && !input.providerThreadId) {
    throw new Error("PORTAL_TARGET_PATH_INVALID");
  }
  await input.client.navigate({ url: portalUrl(path) });
  await assertCurrentScope(input.client);
  const state = await pageState(input.client);
  if (!(await confirmCurrentPageAuthenticated(input.client))) {
    return { outcome: "human_required", submitted: false, blocker: state.blocker ?? "password" };
  }
  const beforeEvidence = input.providerThreadId
    ? await input.client.readEvidence({ kind: "thread" }) : null;
  const before = beforeEvidence?.kind === "thread" ? parseThread(beforeEvidence.thread) : null;
  const existingIds = new Set(before?.messages.map((message) => message.providerMessageId) ?? []);
  let senderLabelSelector: string | null = null;
  if (!input.providerThreadId && input.senderLabel) {
    senderLabelSelector = await fillExact(input.client,
      "Find the single visible sender-label input in the RoomScout message composer and fill it with %senderLabel%. Do not submit.",
      "senderLabel", input.senderLabel, "sender_label");
    if (!senderLabelSelector) {
      return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
    }
  }
  const bodySelector = await fillExact(input.client,
    "Find the single visible message-body textarea in the RoomScout message composer and fill it with %body%. Do not submit.",
    "body", input.body, "message_body");
  if (!bodySelector) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  const exactFields = [
    ...(senderLabelSelector && input.senderLabel
      ? [{ selector: senderLabelSelector, role: "sender_label" as const, expectedValue: input.senderLabel }]
      : []),
    { selector: bodySelector, role: "message_body" as const, expectedValue: input.body },
  ];
  if (!(await verifyExactFields(input.client, exactFields))) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  const composer = await input.client.readEvidence({ kind: "composer" });
  if (composer.kind !== "composer" || composer.body !== input.body) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  const submit = await uniqueAction(input.client,
    "Find the single visible Send button belonging to the RoomScout message composer. Do not click any other control.");
  if (!submit || !(await validSubmit(input.client, submit))) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  await input.beforeSubmit({
    body: input.body,
    ...(input.providerThreadId ? { providerThreadId: input.providerThreadId } : {}),
    ...(!input.providerThreadId && input.targetPath ? { targetPath: input.targetPath } : {}),
  });
  await input.client.act({ action: submit });
  await assertCurrentScope(input.client);

  let receipt = await input.client.readEvidence({ kind: "receipt" });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (receipt.kind === "receipt" && receipt.visible) break;
    await input.client.wait?.(1_000);
    receipt = await input.client.readEvidence({ kind: "receipt" });
  }
  const providerThreadId = cleanText(receipt.kind === "receipt" ? receipt.providerThreadId : undefined, 200);
  const providerMessageId = cleanText(receipt.kind === "receipt" ? receipt.providerMessageId : undefined, 200);
  if (receipt.kind !== "receipt" || receipt.visible !== true || !providerThreadId || !providerMessageId || existingIds.has(providerMessageId)) {
    return { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
  }
  assertProviderId(providerThreadId);
  assertProviderId(providerMessageId);
  const verified = await readPortalThread({
    client: input.client,
    baseUrl: input.baseUrl,
    adapterKey: input.adapterKey,
    providerThreadId,
  });
  const sent = verified?.messages.find((message) =>
    message.providerMessageId === providerMessageId &&
    message.direction === "outbound" &&
    message.bodyText === input.body &&
    !existingIds.has(message.providerMessageId));
  return sent
    ? { outcome: "succeeded", submitted: true, providerThreadId, providerMessageId }
    : { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
}

/** Direct controlled-portal write path proven by the standalone Browserbase run test. */
export async function sendControlledPortalMessage(input: {
  client: StagehandPortalPrimitives;
  baseUrl: string;
  adapterKey: string;
  body: string;
  providerThreadId?: string;
  targetPath?: string;
  senderLabel?: string;
  beforeSubmit: (claim: { body: string; providerThreadId?: string; targetPath?: string }) => Promise<void>;
}): Promise<PortalSendResult> {
  assertReviewedScope(input);
  if (!input.body || input.body.length > 5_000) throw new Error("PORTAL_MESSAGE_BODY_INVALID");
  if (input.providerThreadId) assertProviderId(input.providerThreadId);
  const path = input.providerThreadId
    ? `/inbox/${encodeURIComponent(input.providerThreadId)}`
    : input.targetPath;
  if (!path || (!input.providerThreadId && !/^\/listings\/[A-Za-z0-9_-]{1,200}$/.test(path))) {
    throw new Error("PORTAL_TARGET_PATH_INVALID");
  }
  await input.client.navigate({ url: portalUrl(path) });
  await assertCurrentScope(input.client);
  if (!(await confirmCurrentPageAuthenticated(input.client))) {
    return { outcome: "human_required", submitted: false, blocker: "password" };
  }
  const beforeEvidence = input.providerThreadId
    ? await input.client.readEvidence({ kind: "thread" })
    : null;
  const before = beforeEvidence?.kind === "thread" ? parseThread(beforeEvidence.thread) : null;
  const existingIds = new Set(before?.messages.map((message) => message.providerMessageId) ?? []);
  const fields: Array<{
    selector: string;
    role: "sender_label" | "message_body";
    expectedValue: string;
  }> = [];
  if (!input.providerThreadId && input.senderLabel) {
    const senderSelector = '[data-roomscout-write="sender-label"]';
    if (!(await fillReviewedField({
      client: input.client,
      selector: senderSelector,
      role: "sender_label",
      instruction: "Fill the sender label input with %senderLabel%. Do not submit.",
      variable: "senderLabel",
      value: input.senderLabel,
    }))) {
      return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
    }
    fields.push({ selector: senderSelector, role: "sender_label", expectedValue: input.senderLabel });
  }
  const bodySelector = '[data-roomscout-write="body"]';
  if (!(await fillReviewedField({
    client: input.client,
    selector: bodySelector,
    role: "message_body",
    instruction: "Fill the message textarea with %body%. Do not submit.",
    variable: "body",
    value: input.body,
  }))) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  fields.push({ selector: bodySelector, role: "message_body", expectedValue: input.body });
  if (!(await verifyExactFields(input.client, fields))) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  const composer = await input.client.readEvidence({ kind: "composer" });
  if (composer.kind !== "composer" || composer.body !== input.body) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  const submitSelector = '[data-roomscout-write="send"]';
  const submit = await input.client.inspectForm({ selector: submitSelector, role: "submit" });
  if (
    submit.count !== 1 || !submit.visible || submit.formValid !== true ||
    !input.client.clickSelector
  ) {
    return { outcome: "human_required", submitted: false, blocker: "policy_human_presence" };
  }
  await input.beforeSubmit({
    body: input.body,
    ...(input.providerThreadId ? { providerThreadId: input.providerThreadId } : {}),
    ...(!input.providerThreadId && input.targetPath ? { targetPath: input.targetPath } : {}),
  });
  await input.client.clickSelector({ selector: submitSelector });
  await assertCurrentScope(input.client);
  let receipt = await input.client.readEvidence({ kind: "receipt" });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (receipt.kind === "receipt" && receipt.visible) break;
    await input.client.wait?.(1_000);
    receipt = await input.client.readEvidence({ kind: "receipt" });
  }
  const providerThreadId = cleanText(receipt.kind === "receipt" ? receipt.providerThreadId : undefined, 200);
  const providerMessageId = cleanText(receipt.kind === "receipt" ? receipt.providerMessageId : undefined, 200);
  if (
    receipt.kind !== "receipt" || !receipt.visible || !providerThreadId ||
    !providerMessageId || existingIds.has(providerMessageId)
  ) {
    return { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
  }
  assertProviderId(providerThreadId);
  assertProviderId(providerMessageId);
  const verified = await readPortalThread({ ...input, providerThreadId });
  const sent = verified?.messages.some((message) =>
    message.providerMessageId === providerMessageId &&
    message.direction === "outbound" && message.bodyText === input.body &&
    !existingIds.has(message.providerMessageId)
  );
  return sent
    ? { outcome: "succeeded", submitted: true, providerThreadId, providerMessageId }
    : { outcome: "unknown", submitted: true, errorCode: "SUBMIT_RESULT_UNKNOWN" };
}
