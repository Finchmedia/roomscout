export type ScoutMode =
  | "guided"
  | "research_autopilot"
  | "outreach_autopilot"
  | "negotiation_autopilot";

export type ExternalActionType =
  | "send_email"
  | "submit_webform"
  | "send_platform_dm"
  | "create_portal_account"
  | "publish_listing"
  | "share_contact_details"
  | "propose_visit_time";

export type PersonalDataScope =
  | "band_name"
  | "member_first_names"
  | "reply_email"
  | "phone"
  | "precise_location"
  | "availability"
  | "budget"
  | "music_profile";

export type AutomationLevel =
  | "disabled"
  | "public_read"
  | "connected_read"
  | "prepare_only"
  | "approved_execute";

export type MandateSnapshot = {
  mode: ScoutMode;
  status: "active" | "superseded" | "revoked" | "expired";
  platformIds: string[];
  allowedActionTypes: ExternalActionType[];
  allowedPersonalData: PersonalDataScope[];
  maxContactsPerDay: number;
  maxBrowserMinutesPerDay: number;
  maxMonthlyPriceEur?: number;
  expiresAt: number;
  stopOnComplaint: boolean;
  stopWhenSuitableRoomConfirmed: boolean;
  commitmentBoundary?: "non_binding_outreach_only";
  stoppedAt?: number;
};

export type ActionAuthorizationInput = {
  now: number;
  actionType: ExternalActionType;
  platformId?: string;
  personalData: PersonalDataScope[];
  contactsAlreadyAttemptedToday: number;
  browserMinutesUsedToday: number;
  proposedMonthlyPriceEur?: number;
  policyDecision: "allowed" | "review_required" | "prohibited" | "unknown";
  policyAutomationLevel: AutomationLevel;
  connectionActive: boolean;
  complaintRecorded: boolean;
  suitableRoomConfirmed: boolean;
  bindingCommitment: boolean;
};

export type AuthorizationDecision = {
  authorized: boolean;
  exactApprovalRequired: boolean;
  reasons: string[];
};

const MODE_ACTIONS: Record<ScoutMode, ReadonlySet<ExternalActionType>> = {
  guided: new Set(),
  research_autopilot: new Set(),
  outreach_autopilot: new Set([
    "send_email",
    "submit_webform",
    "send_platform_dm",
    "publish_listing",
    "share_contact_details",
  ]),
  negotiation_autopilot: new Set([
    "send_email",
    "submit_webform",
    "send_platform_dm",
    "publish_listing",
    "share_contact_details",
    "propose_visit_time",
  ]),
};

const CONNECTION_ACTIONS = new Set<ExternalActionType>([
  "send_platform_dm",
  "create_portal_account",
  "publish_listing",
]);
const BROWSER_ACTIONS = new Set<ExternalActionType>([
  "submit_webform",
  "send_platform_dm",
  "create_portal_account",
  "publish_listing",
]);

/**
 * Evaluates only a previously persisted mandate snapshot. It never upgrades a
 * source policy or turns a prepared action into an execution by itself.
 */
export function authorizeFromMandate(
  mandate: MandateSnapshot,
  input: ActionAuthorizationInput,
): AuthorizationDecision {
  const reasons: string[] = [];

  if (mandate.status !== "active" || mandate.stoppedAt !== undefined) {
    reasons.push("The mandate is not active.");
  }
  if (mandate.expiresAt <= input.now) {
    reasons.push("The mandate has expired.");
  }
  if (mandate.mode === "guided" || mandate.mode === "research_autopilot") {
    reasons.push("This Scout mode cannot execute external communication.");
  }
  if (!MODE_ACTIONS[mandate.mode].has(input.actionType)) {
    reasons.push("This action is outside the selected Scout mode.");
  }
  if (!mandate.allowedActionTypes.includes(input.actionType)) {
    reasons.push("This action type is not included in the mandate.");
  }
  if (
    input.platformId !== undefined &&
    !mandate.platformIds.includes(input.platformId)
  ) {
    reasons.push("The destination platform is not included in the mandate.");
  }
  if (
    input.personalData.some(
      (scope) => !mandate.allowedPersonalData.includes(scope),
    )
  ) {
    reasons.push("The payload contains personal data outside the mandate.");
  }
  if (
    mandate.maxContactsPerDay <= 0 ||
    input.contactsAlreadyAttemptedToday >= mandate.maxContactsPerDay
  ) {
    reasons.push("The mandate's daily contact limit has been reached.");
  }
  if (
    BROWSER_ACTIONS.has(input.actionType) &&
    input.browserMinutesUsedToday >= mandate.maxBrowserMinutesPerDay
  ) {
    reasons.push("The mandate's daily browser-time limit has been reached.");
  }
  if (
    input.proposedMonthlyPriceEur !== undefined &&
    mandate.maxMonthlyPriceEur !== undefined &&
    input.proposedMonthlyPriceEur > mandate.maxMonthlyPriceEur
  ) {
    reasons.push("The proposed price exceeds the mandate limit.");
  }
  if (input.policyDecision !== "allowed") {
    reasons.push("The current source policy does not allow execution.");
  }
  if (input.policyAutomationLevel !== "approved_execute") {
    reasons.push("The source policy permits preparation but not execution.");
  }
  if (CONNECTION_ACTIONS.has(input.actionType) && !input.connectionActive) {
    reasons.push("An active user-owned portal connection is required.");
  }
  if (mandate.stopOnComplaint && input.complaintRecorded) {
    reasons.push("The mandate stopped after a complaint event.");
  }
  if (mandate.stopWhenSuitableRoomConfirmed && input.suitableRoomConfirmed) {
    reasons.push("The mandate stopped because a suitable room was confirmed.");
  }
  if (
    mandate.commitmentBoundary !== "non_binding_outreach_only" ||
    input.bindingCommitment
  ) {
    reasons.push(
      "Binding commitments always require exact human approval of the final content.",
    );
  }

  return {
    authorized: reasons.length === 0,
    exactApprovalRequired: reasons.length > 0,
    reasons,
  };
}

type ActionPayloadText =
  | {
      kind: "platform_message";
      subject?: string;
      body: string;
    }
  | {
      kind: "contact_form";
      fields: Array<{ name: string; label?: string; value: string }>;
    }
  | {
      kind: "portal_account_operation";
      operation: "connect" | "reauth" | "disconnect";
      accountLabel?: string;
    }
  | {
      kind: "email_message";
      subject: string;
      body: string;
    };

const BINDING_COMMITMENT_PATTERNS = [
  /\b(?:we|i)\s+(?:accept|agree to|commit to|confirm)\b/i,
  /\b(?:accept|confirm|complete)\s+(?:the\s+)?(?:offer|agreement|booking|lease|contract)\b/i,
  /\b(?:we(?:'ll| will)|i(?:'ll| will))\s+take\s+(?:the|this)\s+(?:room|space|offer)\b/i,
  /\b(?:binding|legally binding|sign(?:ing)? the contract|pay(?:ing)? (?:the )?deposit)\b/i,
  /\b(?:wir|ich)\s+(?:nehmen|akzeptieren|best[aä]tigen|stimmen)\b.{0,40}\b(?:raum|angebot|vertrag|vereinbarung|buchung|mietvertrag)\b/i,
  /\b(?:angebot|vertrag|vereinbarung|buchung|mietvertrag)\b.{0,40}\b(?:verbindlich|annehmen|akzeptieren|best[aä]tigen|unterschreiben)\b/i,
  /\b(?:verbindlich zusagen|kaution (?:zahlen|überweisen)|vertrag unterschreiben)\b/i,
];

/**
 * Conservative deterministic boundary for standing mandates. It is not used
 * to prove that content is harmless; it only escalates obvious commitments to
 * exact human approval across email, web forms and platform messages.
 */
export function containsBindingCommitment(payload: ActionPayloadText): boolean {
  if (payload.kind === "portal_account_operation") return false;
  const text =
    payload.kind === "contact_form"
      ? payload.fields.map((field) => `${field.label ?? field.name}: ${field.value}`).join("\n")
      : `${payload.subject ?? ""}\n${payload.body}`;
  return BINDING_COMMITMENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function countUniqueAttemptedRequests(
  executions: ReadonlyArray<{ requestId: unknown }>,
): number {
  return new Set(executions.map((execution) => String(execution.requestId))).size;
}

export function isAlwaysHumanBoundary(action: string): boolean {
  return new Set([
    "accept_agreement",
    "accept_terms",
    "sign_contract",
    "spend_money",
    "pay_deposit",
    "complete_booking",
    "enter_password",
    "enter_2fa",
    "solve_captcha",
  ]).has(action);
}
