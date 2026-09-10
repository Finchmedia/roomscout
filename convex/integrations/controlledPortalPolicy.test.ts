import { describe, expect, it } from "vitest";
import {
  evaluateControlledRegistrationPolicy,
  REVIEWED_FREE_REGISTRATION_TERMS,
} from "./controlledPortalPolicy";

const baseline = {
  adapterKey: "roomscout-dev-v1",
  pageUrl: "https://roomscout.dev/sign-up",
  terms: { kind: "absent" as const },
  captcha: { kind: "absent" as const },
  paymentOrContractDetected: false,
};

describe("controlledPortalPolicy", () => {
  it("allows only the exact controlled free registration with no terms", () => {
    expect(evaluateControlledRegistrationPolicy(baseline)).toEqual({
      allowed: true,
      policyVersion: "roomscout-dev-registration-v2",
    });
    expect(
      evaluateControlledRegistrationPolicy({
        ...baseline,
        pageUrl: "https://preview.roomscout.dev/sign-up",
      }),
    ).toEqual({ allowed: false, reason: "CONTROLLED_PORTAL_SCOPE_MISMATCH" });
  });

  it("allows a Browserbase-native CAPTCHA result but no unknown CAPTCHA", () => {
    expect(
      evaluateControlledRegistrationPolicy({
        ...baseline,
        captcha: { kind: "browserbase_native_solved" },
      }).allowed,
    ).toBe(true);
    expect(
      evaluateControlledRegistrationPolicy({
        ...baseline,
        captcha: { kind: "unknown" },
      }),
    ).toEqual({
      allowed: false,
      reason: "REGISTRATION_CAPTCHA_REQUIRES_NATIVE_SOLVE",
    });
  });

  it("allows only the exact reviewed terms path and fingerprint", () => {
    expect(REVIEWED_FREE_REGISTRATION_TERMS).toHaveLength(1);
    expect(evaluateControlledRegistrationPolicy({
      ...baseline,
      terms: {
        kind: "present",
        path: "/demo-terms/v1",
        contentFingerprint:
          "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1",
      },
    }).allowed).toBe(true);
    expect(
      evaluateControlledRegistrationPolicy({
        ...baseline,
        terms: {
          kind: "present",
          path: "/terms",
          contentFingerprint: "v1:unreviewed",
        },
      }),
    ).toEqual({ allowed: false, reason: "REGISTRATION_TERMS_NOT_REVIEWED" });
  });

  it("never permits payment or contract commitment", () => {
    expect(
      evaluateControlledRegistrationPolicy({
        ...baseline,
        paymentOrContractDetected: true,
      }),
    ).toEqual({
      allowed: false,
      reason: "REGISTRATION_COMMERCIAL_COMMITMENT_REQUIRES_HUMAN",
    });
  });
});
