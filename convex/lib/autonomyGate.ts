/**
 * Freigabeprüfung — the one decision whether the Scout may run an action now.
 *
 * Pure module: no Convex ctx, fully table-testable. It reads only the
 * Handlungsspielraum (`AutonomyRules`) plus gathered facts and answers with
 * proceed, wait, ask_user or stop — always with a reason (ADR 0001, 0002).
 * Daily limits do not exist here on purpose.
 */

import {
  allowedActions,
  allowedDataScopes,
  type AutonomyRules,
  type ExternalActionType,
  type PersonalDataScope,
} from "./autonomy";

export type GateReason =
  | "review_mode"
  | "user_draft"
  | "action_not_allowed"
  | "private_data"
  | "binding_content"
  | "uncertain_content"
  | "unsafe_content"
  | "unsupported_claims"
  | "safety_pending"
  | "safety_unavailable"
  | "binding_action"
  | "context_changed"
  | "controlled_portal_only"
  | "policy_not_executable"
  | "connection_not_ready"
  | "browser_busy"
  | "provider_mismatch";

export type GateOutcome =
  | { outcome: "proceed" }
  | { outcome: "wait"; reason: GateReason; retryAt?: number; detail?: string }
  | { outcome: "ask_user"; reason: GateReason; detail?: string }
  | { outcome: "stop"; reason: GateReason; detail?: string };

export type GateVerdict = {
  classification: "non_binding" | "binding" | "unsafe" | "uncertain";
  unsupportedClaims: string[];
  explanation: string;
};

export type GateFacts = {
  phase: "submit" | "claim";
  actionType: ExternalActionType;
  isAcceptance: boolean;
  isOwnedMailReply: boolean;
  isPortalAccountOperation: boolean;
  platformDomain: string | null;
  detectedScopes: PersonalDataScope[];
  verdict: GateVerdict | null;
  verdictAttempts: number;
  contextValid: boolean;
  policyExecutable: boolean;
  connectionActive: boolean;
  controlledPortalOnly: boolean;
  browserBusy: boolean;
  /**
   * The human already said yes to this exact content: an exact approval at
   * claim time, or a text the musician dictated themselves (`humanDraft`).
   */
  userApproved: boolean;
  now: number;
};

/** Outbound messages: what Rücksprache turns into an Entscheidung. */
export const MESSAGE_ACTIONS: ReadonlySet<ExternalActionType> = new Set<ExternalActionType>([
  "send_email",
  "submit_webform",
  "send_platform_dm",
  "propose_visit_time",
]);

/** Actions that need an active, user-owned portal connection before they can run. */
export const CONNECTION_ACTIONS: ReadonlySet<ExternalActionType> = new Set<ExternalActionType>([
  "send_platform_dm",
  "create_portal_account",
  "publish_listing",
]);

/** The only portal autonomous communication may target while the controlled-portal rule is on. */
export const CONTROLLED_PORTAL_DOMAIN = "roomscout.dev";

export const SAFETY_RETRY_MS = 5 * 60_000;
export const CONNECTION_RETRY_MS = 10 * 60_000;
export const BROWSER_BUSY_RETRY_MS = 2 * 60_000;
export const MAX_SAFETY_WAITS = 3;

const REASON_TEXT: Record<GateReason, string> = {
  review_mode: "Du prüfst Nachrichten vor dem Versand.",
  user_draft: "Du hast diese Nachricht selbst entworfen und bestätigst sie.",
  action_not_allowed: "Dieser Schritt ist in deinem Handlungsspielraum ausgeschaltet.",
  private_data: "Die Nachricht enthält Angaben, die der Scout nicht teilen darf.",
  binding_content: "Die Nachricht enthält eine verbindliche Zusage.",
  uncertain_content: "Die Bedeutung der Nachricht ist nicht eindeutig.",
  unsafe_content: "Die Nachricht enthält unsichere Inhalte.",
  unsupported_claims: "Die Nachricht enthält Behauptungen ohne Beleg.",
  safety_pending: "Der Scout prüft die fertige Nachricht.",
  safety_unavailable: "Die Prüfung der Nachricht ist mehrfach fehlgeschlagen.",
  binding_action: "Die verbindliche Zusage bleibt bei dir.",
  context_changed: "Der Suchauftrag oder das Gespräch hat sich geändert.",
  controlled_portal_only: "Autonome Nachrichten sind nur auf dem kontrollierten Portal erlaubt.",
  policy_not_executable: "Die Quelle erlaubt keine automatische Ausführung.",
  connection_not_ready: "Die Portal-Verbindung ist noch nicht bereit.",
  browser_busy: "Der Portal-Browser ist gerade belegt.",
  provider_mismatch: "Die Portal-Verbindung muss neu verbunden werden.",
};

/** Short German sentence per reason for the UI. */
export function gateReasonText(reason: GateReason): string {
  return REASON_TEXT[reason];
}

function listDetail(items: readonly string[]): string | undefined {
  return items.length > 0 ? items.join(", ") : undefined;
}

/**
 * Fixed precedence: context_changed > binding_action > action_not_allowed >
 * controlled_portal_only > policy_not_executable > connection_not_ready >
 * browser_busy (claim only) > verdict > private_data > review_mode > proceed.
 *
 * `userApproved` short-circuits every rule that only exists to ask the human —
 * the human already decided on this exact content (exact approval at claim
 * time, or a musician-dictated text in either phase). Facts about the world
 * (context, policy, connection, browser) still apply.
 */
export function decideGate(rules: AutonomyRules, facts: GateFacts): GateOutcome {
  if (!facts.contextValid) return { outcome: "stop", reason: "context_changed" };
  const humanDecided = facts.userApproved;

  if (facts.isAcceptance && !humanDecided) return { outcome: "ask_user", reason: "binding_action" };

  if (!humanDecided && !allowedActions(rules).includes(facts.actionType)) {
    return { outcome: "stop", reason: "action_not_allowed", detail: facts.actionType };
  }

  if (
    facts.controlledPortalOnly && !humanDecided &&
    !facts.isPortalAccountOperation && !facts.isOwnedMailReply &&
    facts.platformDomain !== CONTROLLED_PORTAL_DOMAIN
  ) {
    return { outcome: "stop", reason: "controlled_portal_only", detail: facts.platformDomain ?? undefined };
  }

  if (!facts.policyExecutable) return { outcome: "stop", reason: "policy_not_executable" };

  if (CONNECTION_ACTIONS.has(facts.actionType) && !facts.connectionActive) {
    return { outcome: "wait", reason: "connection_not_ready", retryAt: facts.now + CONNECTION_RETRY_MS };
  }

  if (facts.phase === "claim" && facts.browserBusy) {
    return { outcome: "wait", reason: "browser_busy", retryAt: facts.now + BROWSER_BUSY_RETRY_MS };
  }

  if (!facts.isPortalAccountOperation && !humanDecided) {
    const verdict = facts.verdict;
    if (verdict === null) {
      if (facts.verdictAttempts >= MAX_SAFETY_WAITS) return { outcome: "ask_user", reason: "safety_unavailable" };
      return { outcome: "wait", reason: "safety_pending" };
    }
    if (verdict.classification === "unsafe") return { outcome: "stop", reason: "unsafe_content", detail: verdict.explanation };
    if (verdict.classification === "binding") return { outcome: "ask_user", reason: "binding_content", detail: verdict.explanation };
    if (verdict.classification === "uncertain") return { outcome: "ask_user", reason: "uncertain_content", detail: verdict.explanation };
    if (verdict.unsupportedClaims.length > 0) {
      return { outcome: "ask_user", reason: "unsupported_claims", detail: listDetail(verdict.unsupportedClaims) };
    }
  }

  if (!humanDecided) {
    const allowed = allowedDataScopes(rules);
    const disallowed = [...new Set(facts.detectedScopes)].filter((scope) => !allowed.includes(scope));
    if (disallowed.length > 0) return { outcome: "ask_user", reason: "private_data", detail: listDetail(disallowed) };
  }

  if (
    facts.phase === "submit" && !humanDecided &&
    rules.mode === "review" && MESSAGE_ACTIONS.has(facts.actionType)
  ) {
    return { outcome: "ask_user", reason: "review_mode" };
  }

  return { outcome: "proceed" };
}
