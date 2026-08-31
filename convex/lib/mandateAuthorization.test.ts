import { describe, expect, it } from "vitest";
import {
  authorizeFromMandate,
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
    },
  );
  expect(decision.authorized).toBe(false);
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
