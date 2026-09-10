import { describe, expect, it } from "vitest";
import { isReviewedVisibleTerms, selectPlaceholderAction, termsTransitionDiagnostic } from "./stagehandFormSmoke";
import { REVIEWED_FREE_REGISTRATION_TERMS } from "./integrations/controlledPortalPolicy";

describe("Stagehand form smoke safeguards", () => {
  it("requires one observed action carrying the exact placeholder", () => {
    const action = { description: "Email", selector: "#email", method: "fill", arguments: ["%email%"] };
    expect(selectPlaceholderAction([action], "email")).toEqual(action);
    expect(selectPlaceholderAction([{ ...action, arguments: ["literal@example.invalid"] }], "email")).toBeNull();
    expect(selectPlaceholderAction([{ ...action, method: "type" }], "email")).toBeNull();
    expect(selectPlaceholderAction([action, { ...action, selector: "#other" }], "email")).toBeNull();
  });
  it("rejects a changed rendered terms fingerprint", () => {
    const reviewed = REVIEWED_FREE_REGISTRATION_TERMS[0]!;
    const base = { adapterKey: "roomscout-dev-v1", pageUrl: "https://roomscout.dev/sign-up", captcha: { kind: "absent" as const }, paymentOrContractDetected: false };
    expect(isReviewedVisibleTerms({ ...base, terms: { kind: "present", ...reviewed } }, true)).toBe(true);
    expect(isReviewedVisibleTerms({ ...base, terms: { kind: "present", path: reviewed.path, contentFingerprint: "v1:changed" } }, true)).toBe(false);
  });
  it("reports only bounded structural transition evidence", () => {
    const detail = termsTransitionDiagnostic({
      evidence: { adapterKey: "roomscout-dev-v1", pageUrl: "https://roomscout.dev/sign-up", terms: { kind: "absent" }, captcha: { kind: "present_unsolved" }, paymentOrContractDetected: false },
      termsGateVisible: false,
      formPresent: true,
    });
    expect(detail).toBe("policy=REGISTRATION_CAPTCHA_REQUIRES_NATIVE_SOLVE;terms=absent;gate=false;form=true");
    expect(detail).not.toMatch(/body|html|email/i);
  });
});
