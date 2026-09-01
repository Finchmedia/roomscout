import { describe, expect, it } from "vitest";
import {
  authorizeFromMandate,
  containsBindingCommitment,
  countUniqueAttemptedRequests,
  isAlwaysHumanBoundary,
  type MandateSnapshot,
} from "./mandateAuthorization";

const activeMandate: MandateSnapshot = {
  mode: "outreach_autopilot",
  status: "active",
  platformIds: ["bandnet"],
  allowedActionTypes: ["submit_webform", "send_email"],
  allowedPersonalData: ["band_name", "reply_email", "budget"],
  maxContactsPerDay: 5,
  maxBrowserMinutesPerDay: 30,
  maxMonthlyPriceEur: 300,
  expiresAt: 2_000,
  stopOnComplaint: true,
  stopWhenSuitableRoomConfirmed: true,
  commitmentBoundary: "non_binding_outreach_only",
};

it("authorizes an exact action inside an active standing mandate", () => {
  expect(
    authorizeFromMandate(activeMandate, {
      now: 1_000,
      actionType: "submit_webform",
      platformId: "bandnet",
      personalData: ["band_name", "reply_email"],
      contactsAlreadyAttemptedToday: 1,
      browserMinutesUsedToday: 2,
      proposedMonthlyPriceEur: 250,
      policyDecision: "allowed",
      policyAutomationLevel: "approved_execute",
      connectionActive: true,
      complaintRecorded: false,
      suitableRoomConfirmed: false,
      bindingCommitment: false,
    }),
  ).toEqual({ authorized: true, exactApprovalRequired: false, reasons: [] });
});

it("falls back to exact approval outside limits instead of silently executing", () => {
  const decision = authorizeFromMandate(activeMandate, {
    now: 1_000,
    actionType: "submit_webform",
    platformId: "bandnet",
    personalData: ["phone"],
    contactsAlreadyAttemptedToday: 5,
    browserMinutesUsedToday: 2,
    proposedMonthlyPriceEur: 450,
    policyDecision: "allowed",
    policyAutomationLevel: "approved_execute",
    connectionActive: true,
    complaintRecorded: false,
    suitableRoomConfirmed: false,
    bindingCommitment: false,
  });
  expect(decision.authorized).toBe(false);
  expect(decision.exactApprovalRequired).toBe(true);
  expect(decision.reasons).toHaveLength(3);
});

it("cannot turn research autopilot into communication", () => {
  const decision = authorizeFromMandate(
    { ...activeMandate, mode: "research_autopilot" },
    {
      now: 1_000,
      actionType: "send_email",
      personalData: [],
      contactsAlreadyAttemptedToday: 0,
      browserMinutesUsedToday: 0,
      policyDecision: "allowed",
      policyAutomationLevel: "approved_execute",
      connectionActive: true,
      complaintRecorded: false,
      suitableRoomConfirmed: false,
      bindingCommitment: false,
    },
  );
  expect(decision.authorized).toBe(false);
});

describe("standing-mandate commitment boundary", () => {
  it("requires an explicit non-binding boundary on legacy mandate snapshots", () => {
    const decision = authorizeFromMandate(
      { ...activeMandate, commitmentBoundary: undefined },
      {
        now: 1_000,
        actionType: "send_email",
        personalData: [],
        contactsAlreadyAttemptedToday: 0,
        browserMinutesUsedToday: 0,
        policyDecision: "allowed",
        policyAutomationLevel: "approved_execute",
        connectionActive: true,
        complaintRecorded: false,
        suitableRoomConfirmed: false,
        bindingCommitment: false,
      },
    );
    expect(decision.authorized).toBe(false);
    expect(decision.exactApprovalRequired).toBe(true);
  });

  it("escalates an obvious commitment to exact approval", () => {
    const decision = authorizeFromMandate(activeMandate, {
      now: 1_000,
      actionType: "send_email",
      personalData: [],
      contactsAlreadyAttemptedToday: 0,
      browserMinutesUsedToday: 0,
      policyDecision: "allowed",
      policyAutomationLevel: "approved_execute",
      connectionActive: true,
      complaintRecorded: false,
      suitableRoomConfirmed: false,
      bindingCommitment: true,
    });
    expect(decision.authorized).toBe(false);
    expect(decision.exactApprovalRequired).toBe(true);
  });

  it.each([
    "We accept the offer and will take the room.",
    "Wir nehmen den Raum verbindlich.",
    "Bitte die Buchung bestätigen; wir akzeptieren den Vertrag.",
  ])("detects binding content: %s", (body) => {
    expect(
      containsBindingCommitment({
        kind: "email_message",
        subject: "Room",
        body,
      }),
    ).toBe(true);
  });

  it("does not classify a non-binding availability question", () => {
    expect(
      containsBindingCommitment({
        kind: "platform_message",
        body: "Is the room still available, and could we arrange a visit?",
      }),
    ).toBe(false);
  });
});

it("counts retries of one request only once for the daily cap", () => {
  expect(
    countUniqueAttemptedRequests([
      { requestId: "request-a" },
      { requestId: "request-a" },
      { requestId: "request-b" },
    ]),
  ).toBe(2);
});

describe("irreducible human boundaries", () => {
  it.each([
    "accept_agreement",
    "accept_terms",
    "sign_contract",
    "spend_money",
    "pay_deposit",
    "complete_booking",
    "enter_password",
    "enter_2fa",
    "solve_captcha",
  ])("keeps %s outside every mandate", (action) => {
    expect(isAlwaysHumanBoundary(action)).toBe(true);
  });
});
