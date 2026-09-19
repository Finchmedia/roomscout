import { describe, expect, it } from "vitest";
import { DEFAULT_AUTONOMY_RULES, type AutonomyRules } from "./autonomy";
import {
  BROWSER_BUSY_RETRY_MS,
  CONNECTION_RETRY_MS,
  MESSAGE_ACTIONS,
  decideGate,
  gateReasonText,
  type GateFacts,
  type GateReason,
  type GateVerdict,
} from "./autonomyGate";
import type { ExternalActionType } from "./autonomy";

const NOW = 1_700_000_000_000;
const autopilot: AutonomyRules = DEFAULT_AUTONOMY_RULES;
const review: AutonomyRules = { ...DEFAULT_AUTONOMY_RULES, mode: "review" };
const clear: GateVerdict = { classification: "non_binding", unsupportedClaims: [], explanation: "Only asks." };

function facts(overrides: Partial<GateFacts> = {}): GateFacts {
  return {
    phase: "submit",
    actionType: "send_platform_dm",
    isAcceptance: false,
    isOwnedMailReply: false,
    isPortalAccountOperation: false,
    platformDomain: "roomscout.dev",
    detectedScopes: [],
    verdict: clear,
    verdictAttempts: 0,
    contextValid: true,
    policyExecutable: true,
    connectionActive: true,
    controlledPortalOnly: false,
    browserBusy: false,
    userApproved: false,
    now: NOW,
    ...overrides,
  };
}

const messageActions = [...MESSAGE_ACTIONS] as ExternalActionType[];

describe("decideGate: mode × message action × verdict", () => {
  it.each(messageActions)("autopilot proceeds with a non_binding verdict for %s", (actionType) => {
    expect(decideGate(autopilot, facts({ actionType }))).toEqual({ outcome: "proceed" });
  });

  it.each(messageActions)("review mode asks (review_mode) with a non_binding verdict for %s", (actionType) => {
    expect(decideGate(review, facts({ actionType }))).toEqual({ outcome: "ask_user", reason: "review_mode" });
  });

  it.each([
    ["binding", "ask_user", "binding_content"],
    ["uncertain", "ask_user", "uncertain_content"],
    ["unsafe", "stop", "unsafe_content"],
  ] as const)("a %s verdict yields %s (%s) in both modes", (classification, outcome, reason) => {
    const verdict: GateVerdict = { ...clear, classification, explanation: "Because." };
    for (const rules of [autopilot, review]) {
      expect(decideGate(rules, facts({ verdict }))).toEqual({ outcome, reason, detail: "Because." });
    }
  });

  it("unsupported claims ask with the claims listed", () => {
    const verdict: GateVerdict = { ...clear, unsupportedClaims: ["We rehearse daily", "We have insurance"] };
    expect(decideGate(autopilot, facts({ verdict }))).toEqual({
      outcome: "ask_user", reason: "unsupported_claims", detail: "We rehearse daily, We have insurance",
    });
  });

  it("registration and publishing never ask in review mode", () => {
    const rules: AutonomyRules = { ...review, publishAd: true };
    expect(decideGate(rules, facts({ actionType: "create_portal_account", isPortalAccountOperation: true }))).toEqual({ outcome: "proceed" });
    expect(decideGate(rules, facts({ actionType: "publish_listing" }))).toEqual({ outcome: "proceed" });
  });

  it("review mode only applies at submit time", () => {
    expect(decideGate(review, facts({ phase: "claim" }))).toEqual({ outcome: "proceed" });
  });
});

describe("decideGate: verdict availability", () => {
  it("waits (safety_pending) while the verdict is missing", () => {
    expect(decideGate(autopilot, facts({ verdict: null }))).toEqual({ outcome: "wait", reason: "safety_pending" });
  });

  it("asks (safety_unavailable) after three waits", () => {
    expect(decideGate(autopilot, facts({ verdict: null, verdictAttempts: 2 }))).toEqual({ outcome: "wait", reason: "safety_pending" });
    expect(decideGate(autopilot, facts({ verdict: null, verdictAttempts: 3 }))).toEqual({ outcome: "ask_user", reason: "safety_unavailable" });
  });

  it("portal account operations need no verdict", () => {
    expect(decideGate(autopilot, facts({ actionType: "create_portal_account", isPortalAccountOperation: true, verdict: null, platformDomain: "other.example" })))
      .toEqual({ outcome: "proceed" });
  });
});

describe("decideGate: Datenfelder", () => {
  it("allows member_first_names with shareProfile on", () => {
    expect(decideGate(autopilot, facts({ detectedScopes: ["member_first_names", "band_name", "reply_email"] }))).toEqual({ outcome: "proceed" });
  });

  it("asks (private_data) for phone with sharePrivate off, listing the scopes", () => {
    expect(decideGate(autopilot, facts({ detectedScopes: ["reply_email", "phone", "precise_location", "phone"] }))).toEqual({
      outcome: "ask_user", reason: "private_data", detail: "phone, precise_location",
    });
  });

  it("proceeds for phone with sharePrivate on", () => {
    expect(decideGate({ ...autopilot, sharePrivate: true }, facts({ detectedScopes: ["phone"] }))).toEqual({ outcome: "proceed" });
  });

  it("asks (private_data) for profile fields with shareProfile off", () => {
    expect(decideGate({ ...autopilot, shareProfile: false }, facts({ detectedScopes: ["band_name"] }))).toEqual({
      outcome: "ask_user", reason: "private_data", detail: "band_name",
    });
  });
});

describe("decideGate: switches", () => {
  it.each([
    ["contact", "send_email"],
    ["contact", "submit_webform"],
    ["contact", "send_platform_dm"],
    ["viewings", "propose_visit_time"],
    ["publishAd", "publish_listing"],
    ["sharePrivate", "share_contact_details"],
  ] as const)("switch %s off stops %s (action_not_allowed)", (key, actionType) => {
    const rules: AutonomyRules = { ...autopilot, publishAd: true, sharePrivate: true, [key]: false };
    expect(decideGate(rules, facts({ actionType }))).toEqual({ outcome: "stop", reason: "action_not_allowed", detail: actionType });
    expect(decideGate({ ...rules, [key]: true }, facts({ actionType }))).toEqual({ outcome: "proceed" });
  });

  it("create_portal_account is allowed with every switch off", () => {
    const allOff: AutonomyRules = { mode: "review", contact: false, viewings: false, publishAd: false, shareProfile: false, sharePrivate: false };
    expect(decideGate(allOff, facts({ actionType: "create_portal_account", isPortalAccountOperation: true }))).toEqual({ outcome: "proceed" });
  });
});

describe("decideGate: binding boundary and destination facts", () => {
  it("acceptance always asks (binding_action), regardless of mode", () => {
    for (const rules of [autopilot, review]) {
      expect(decideGate(rules, facts({ isAcceptance: true }))).toEqual({ outcome: "ask_user", reason: "binding_action" });
    }
  });

  it("stops (controlled_portal_only) off the controlled portal", () => {
    expect(decideGate(autopilot, facts({ platformDomain: "bandnet.hamburg", controlledPortalOnly: true }))).toEqual({
      outcome: "stop", reason: "controlled_portal_only", detail: "bandnet.hamburg",
    });
    expect(decideGate(autopilot, facts({ platformDomain: null, controlledPortalOnly: true }))).toEqual({ outcome: "stop", reason: "controlled_portal_only" });
  });

  it("does not let human approval, owned mail replies, or account setup escape the demo boundary", () => {
    expect(decideGate(autopilot, facts({ phase: "claim", userApproved: true, platformDomain: "bandnet.hamburg", controlledPortalOnly: true }))).toEqual({
      outcome: "stop", reason: "controlled_portal_only", detail: "bandnet.hamburg",
    });
    expect(decideGate(autopilot, facts({ actionType: "send_email", platformDomain: "bandnet.hamburg", isOwnedMailReply: true, controlledPortalOnly: true }))).toEqual({
      outcome: "stop", reason: "controlled_portal_only", detail: "bandnet.hamburg",
    });
    expect(decideGate(autopilot, facts({ actionType: "create_portal_account", isPortalAccountOperation: true, platformDomain: "bandnet.hamburg", controlledPortalOnly: true }))).toEqual({
      outcome: "stop", reason: "controlled_portal_only", detail: "bandnet.hamburg",
    });
  });

  it("blocks AgentMail sends in demo mode even if a platform row names the controlled domain", () => {
    expect(decideGate(autopilot, facts({ actionType: "send_email", platformDomain: "roomscout.dev", controlledPortalOnly: true }))).toEqual({
      outcome: "stop", reason: "controlled_portal_only", detail: "roomscout.dev",
    });
  });

  it("lets any platform through when the controlled-portal rule is off", () => {
    expect(decideGate(autopilot, facts({ platformDomain: "bandnet.hamburg", controlledPortalOnly: false }))).toEqual({ outcome: "proceed" });
  });

  it("stops (policy_not_executable) when the source policy does not allow execution", () => {
    expect(decideGate(autopilot, facts({ policyExecutable: false }))).toEqual({ outcome: "stop", reason: "policy_not_executable" });
  });

  it.each(["send_platform_dm", "create_portal_account", "publish_listing"] as const)("waits (connection_not_ready) for %s without an active connection", (actionType) => {
    const rules: AutonomyRules = { ...autopilot, publishAd: true };
    expect(decideGate(rules, facts({ actionType, isPortalAccountOperation: actionType === "create_portal_account", connectionActive: false }))).toEqual({
      outcome: "wait", reason: "connection_not_ready", retryAt: NOW + CONNECTION_RETRY_MS,
    });
  });

  it.each(["send_email", "submit_webform"] as const)("%s does not need a connection", (actionType) => {
    expect(decideGate(autopilot, facts({ actionType, connectionActive: false }))).toEqual({ outcome: "proceed" });
  });

  it("waits (browser_busy) only in the claim phase", () => {
    expect(decideGate(autopilot, facts({ phase: "claim", browserBusy: true }))).toEqual({
      outcome: "wait", reason: "browser_busy", retryAt: NOW + BROWSER_BUSY_RETRY_MS,
    });
    expect(decideGate(autopilot, facts({ phase: "submit", browserBusy: true }))).toEqual({ outcome: "proceed" });
  });
});

describe("decideGate: user-approved claim", () => {
  const approved = (overrides: Partial<GateFacts> = {}) => facts({ phase: "claim", userApproved: true, ...overrides });

  it("proceeds through review_mode, private_data and binding_content on the controlled portal — the human said yes", () => {
    expect(decideGate(review, approved())).toEqual({ outcome: "proceed" });
    expect(decideGate(autopilot, approved({ detectedScopes: ["phone"] }))).toEqual({ outcome: "proceed" });
    expect(decideGate(autopilot, approved({ verdict: { ...clear, classification: "binding" } }))).toEqual({ outcome: "proceed" });
  });

  it("proceeds without a verdict and for an approved acceptance", () => {
    expect(decideGate(autopilot, approved({ verdict: null }))).toEqual({ outcome: "proceed" });
    expect(decideGate(autopilot, approved({ isAcceptance: true, verdict: null }))).toEqual({ outcome: "proceed" });
  });

  it("still stops on a changed context or a non-executable policy and still waits on a busy browser", () => {
    expect(decideGate(autopilot, approved({ contextValid: false }))).toEqual({ outcome: "stop", reason: "context_changed" });
    expect(decideGate(autopilot, approved({ policyExecutable: false }))).toEqual({ outcome: "stop", reason: "policy_not_executable" });
    expect(decideGate(autopilot, approved({ browserBusy: true }))).toMatchObject({ outcome: "wait", reason: "browser_busy" });
  });

  it("still applies the controlled demo boundary after exact human approval", () => {
    expect(decideGate(autopilot, approved({ platformDomain: "bandnet.hamburg", controlledPortalOnly: true }))).toEqual({
      outcome: "stop", reason: "controlled_portal_only", detail: "bandnet.hamburg",
    });
  });

  it("also applies at submit time for a musician-dictated text (humanDraft), world facts still apply", () => {
    expect(decideGate(review, facts({ phase: "submit", userApproved: true }))).toEqual({ outcome: "proceed" });
    expect(decideGate(review, facts({ phase: "submit", userApproved: true, verdict: null, detectedScopes: ["phone"] }))).toEqual({ outcome: "proceed" });
    expect(decideGate(review, facts({ phase: "submit", userApproved: true, policyExecutable: false }))).toEqual({ outcome: "stop", reason: "policy_not_executable" });
    expect(decideGate(review, facts({ phase: "submit", userApproved: false }))).toEqual({ outcome: "ask_user", reason: "review_mode" });
  });
});

describe("decideGate: precedence", () => {
  it("context_changed beats everything", () => {
    expect(decideGate(review, facts({ contextValid: false, isAcceptance: true, policyExecutable: false, verdict: null, platformDomain: "x" })))
      .toEqual({ outcome: "stop", reason: "context_changed" });
  });

  it("controlled portal beats binding_action, action_not_allowed and verdict", () => {
    expect(decideGate({ ...autopilot, contact: false }, facts({ isAcceptance: true, platformDomain: "x", verdict: null, controlledPortalOnly: true })))
      .toEqual({ outcome: "stop", reason: "controlled_portal_only", detail: "x" });
  });

  it("action_not_allowed beats policy and verdict outside demo mode", () => {
    expect(decideGate({ ...autopilot, contact: false }, facts({ platformDomain: "x", policyExecutable: false, verdict: null, controlledPortalOnly: false })))
      .toMatchObject({ outcome: "stop", reason: "action_not_allowed" });
  });

  it("controlled_portal_only beats policy_not_executable", () => {
    expect(decideGate(autopilot, facts({ platformDomain: "x", policyExecutable: false, controlledPortalOnly: true }))).toMatchObject({ outcome: "stop", reason: "controlled_portal_only" });
  });

  it("policy_not_executable beats connection_not_ready and browser_busy", () => {
    expect(decideGate(autopilot, facts({ phase: "claim", policyExecutable: false, connectionActive: false, browserBusy: true })))
      .toEqual({ outcome: "stop", reason: "policy_not_executable" });
  });

  it("connection_not_ready beats browser_busy and the verdict", () => {
    expect(decideGate(autopilot, facts({ phase: "claim", connectionActive: false, browserBusy: true, verdict: null })))
      .toMatchObject({ outcome: "wait", reason: "connection_not_ready" });
  });

  it("browser_busy beats the verdict", () => {
    expect(decideGate(autopilot, facts({ phase: "claim", browserBusy: true, verdict: null }))).toMatchObject({ outcome: "wait", reason: "browser_busy" });
  });

  it("the verdict beats private_data and review_mode", () => {
    expect(decideGate(review, facts({ verdict: null, detectedScopes: ["phone"] }))).toEqual({ outcome: "wait", reason: "safety_pending" });
    expect(decideGate(review, facts({ verdict: { ...clear, classification: "unsafe" }, detectedScopes: ["phone"] })))
      .toMatchObject({ outcome: "stop", reason: "unsafe_content" });
  });

  it("private_data beats review_mode", () => {
    expect(decideGate(review, facts({ detectedScopes: ["phone"] }))).toMatchObject({ outcome: "ask_user", reason: "private_data" });
  });
});

describe("gateReasonText", () => {
  it("has a German sentence for every reason", () => {
    const reasons: GateReason[] = [
      "review_mode", "action_not_allowed", "private_data", "binding_content", "uncertain_content", "unsafe_content",
      "unsupported_claims", "safety_pending", "safety_unavailable", "binding_action", "context_changed",
      "controlled_portal_only", "policy_not_executable", "connection_not_ready", "browser_busy",
    ];
    for (const reason of reasons) expect(gateReasonText(reason)).toMatch(/\S+\.$/);
    expect(gateReasonText("review_mode")).toBe("Du prüfst Nachrichten vor dem Versand.");
  });
});
