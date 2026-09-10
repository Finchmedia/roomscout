export const CONTROLLED_PORTAL_POLICY_VERSION = "roomscout-dev-registration-v2" as const;

export const CONTROLLED_PORTAL_REGISTRATION = {
  adapterKey: "roomscout-dev-v1",
  hostname: "roomscout.dev",
  signupPath: "/sign-up",
} as const;

/** Exact reviewed demo evidence. Never replace this with text/selector matching. */
export const REVIEWED_FREE_REGISTRATION_TERMS: readonly {
  path: string;
  contentFingerprint: `v1:${string}`;
}[] = [{
  path: "/demo-terms/v1",
  contentFingerprint:
    "v1:ea21240c84382829bf2e76b1d67f4eef75afae0899647b28ae3f349fff7a09f1",
}];

export type ControlledRegistrationEvidence = {
  adapterKey: string | undefined;
  pageUrl: string;
  terms:
    | { kind: "absent" }
    | { kind: "present"; path: string; contentFingerprint: string }
    | { kind: "unknown" };
  captcha:
    | { kind: "absent" }
    | { kind: "browserbase_native_solved" }
    | { kind: "present_unsolved" }
    | { kind: "unknown" };
  paymentOrContractDetected: boolean;
};

export type ControlledRegistrationPolicyDecision =
  | { allowed: true; policyVersion: typeof CONTROLLED_PORTAL_POLICY_VERSION }
  | {
      allowed: false;
      reason:
        | "CONTROLLED_PORTAL_SCOPE_MISMATCH"
        | "REGISTRATION_TERMS_NOT_REVIEWED"
        | "REGISTRATION_CAPTCHA_REQUIRES_NATIVE_SOLVE"
        | "REGISTRATION_COMMERCIAL_COMMITMENT_REQUIRES_HUMAN";
    };

/** Fail-closed policy for the single controlled registration demo. */
export function evaluateControlledRegistrationPolicy(
  evidence: ControlledRegistrationEvidence,
): ControlledRegistrationPolicyDecision {
  let page: URL;
  try {
    page = new URL(evidence.pageUrl);
  } catch {
    return { allowed: false, reason: "CONTROLLED_PORTAL_SCOPE_MISMATCH" };
  }
  if (
    evidence.adapterKey !== CONTROLLED_PORTAL_REGISTRATION.adapterKey ||
    page.protocol !== "https:" ||
    page.hostname !== CONTROLLED_PORTAL_REGISTRATION.hostname ||
    page.port !== "" ||
    page.pathname !== CONTROLLED_PORTAL_REGISTRATION.signupPath
  ) {
    return { allowed: false, reason: "CONTROLLED_PORTAL_SCOPE_MISMATCH" };
  }
  if (evidence.paymentOrContractDetected) {
    return {
      allowed: false,
      reason: "REGISTRATION_COMMERCIAL_COMMITMENT_REQUIRES_HUMAN",
    };
  }
  if (
    evidence.captcha.kind !== "absent" &&
    evidence.captcha.kind !== "browserbase_native_solved"
  ) {
    return {
      allowed: false,
      reason: "REGISTRATION_CAPTCHA_REQUIRES_NATIVE_SOLVE",
    };
  }
  if (evidence.terms.kind === "present") {
    const presentedTerms = evidence.terms;
    const reviewed = REVIEWED_FREE_REGISTRATION_TERMS.some(
      (terms) =>
        terms.path === presentedTerms.path &&
        terms.contentFingerprint === presentedTerms.contentFingerprint,
    );
    if (!reviewed) {
      return { allowed: false, reason: "REGISTRATION_TERMS_NOT_REVIEWED" };
    }
  } else if (evidence.terms.kind !== "absent") {
    return { allowed: false, reason: "REGISTRATION_TERMS_NOT_REVIEWED" };
  }
  return { allowed: true, policyVersion: CONTROLLED_PORTAL_POLICY_VERSION };
}
