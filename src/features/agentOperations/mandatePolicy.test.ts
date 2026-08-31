import { describe, expect, it } from "vitest";
import { canMandateAuthorize, isHardHumanAction, mandateRequiresExactApproval } from "./mandatePolicy";
import type { ScoutMandate } from "./types";

function mandate(overrides: Partial<ScoutMandate> = {}): ScoutMandate {
  return {
    mode: "outreach",
    version: 3,
    status: "active",
    goal: "Find a rehearsal room",
    sourceAllowlist: ["room.example"],
    platformAllowlist: ["portal.example"],
    allowedActionTypes: ["browse_public", "send_email", "submit_webform"],
    dataScopes: ["band name", "room criteria"],
    dailyContactLimit: 3,
    dailyBrowserMinutes: 20,
    maxMonthlyPriceEur: 300,
    expiresAt: 2_000,
    killSwitchEnabled: true,
    stopConditions: ["Room found"],
    persisted: true,
    ...overrides,
  };
}

describe("standing mandate policy", () => {
  it("never authorizes hard human actions", () => {
    expect(isHardHumanAction("accept_contract")).toBe(true);
    expect(canMandateAuthorize(mandate({ allowedActionTypes: ["accept_contract"] }), "accept_contract", 1_000)).toBe(false);
  });

  it("keeps Guided actions behind exact approval", () => {
    expect(mandateRequiresExactApproval(mandate({ mode: "guided" }), "send_email", 1_000)).toBe(true);
  });

  it("allows Research to browse but not communicate", () => {
    const research = mandate({ mode: "research", allowedActionTypes: ["browse_public", "send_email"] });
    expect(canMandateAuthorize(research, "browse_public", 1_000)).toBe(true);
    expect(canMandateAuthorize(research, "send_email", 1_000)).toBe(false);
  });

  it("allows an explicitly listed outreach action under an active standing mandate", () => {
    expect(canMandateAuthorize(mandate(), "send_email", 1_000)).toBe(true);
    expect(canMandateAuthorize(mandate(), "send_platform_dm", 1_000)).toBe(false);
  });

  it("rejects draft, killed, disabled, unversioned, and expired mandates", () => {
    expect(canMandateAuthorize(mandate({ status: "draft" }), "send_email", 1_000)).toBe(false);
    expect(canMandateAuthorize(mandate({ status: "killed" }), "send_email", 1_000)).toBe(false);
    expect(canMandateAuthorize(mandate({ killSwitchEnabled: false }), "send_email", 1_000)).toBe(false);
    expect(canMandateAuthorize(mandate({ version: undefined }), "send_email", 1_000)).toBe(false);
    expect(canMandateAuthorize(mandate({ expiresAt: 999 }), "send_email", 1_000)).toBe(false);
  });
});
