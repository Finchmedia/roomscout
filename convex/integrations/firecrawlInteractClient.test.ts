import { describe, expect, it } from "vitest";
import {
  buildApprovedSubmissionCode,
  buildPreparationCode,
  parseApprovedSubmissionOutput,
  resolveReviewedSubmitWorkflow,
} from "./firecrawlInteractClient";

function bandnetWorkflow() {
  const workflow = resolveReviewedSubmitWorkflow({
    adapterKey: "bandnet-contact-form-v1",
    extractionProfileKey: "bandnet-contact-form-v1",
  });
  if (workflow === null) throw new Error("test workflow missing");
  return workflow;
}

const approvedFields = [
  { name: "name", value: "RoomScout User" },
  { name: "email", value: "reply@example.test" },
  { name: "subject", value: "Room inquiry" },
  { name: "message", value: "Hello from the exact approved payload." },
];

describe("Firecrawl Interact safety boundary", () => {
  it("contains no submission primitive in the prepare-only implementation", () => {
    const code = buildPreparationCode([
      { key: "message", value: "Hello", aliases: ["Nachricht"] },
    ]);
    expect(code).not.toMatch(/\.click\(/);
    expect(code).not.toMatch(/\.press\(/);
    expect(code).not.toMatch(/\.submit\(/);
    expect(code).toContain("submitted: false");
  });

  it("resolves only an exact code-reviewed adapter and extraction profile pair", () => {
    expect(bandnetWorkflow().adapterKey).toBe("bandnet-contact-form-v1");
    expect(
      resolveReviewedSubmitWorkflow({
        adapterKey: "bandnet-contact-form-v1",
        extractionProfileKey: "user-controlled-profile",
      }),
    ).toBeNull();
    expect(
      resolveReviewedSubmitWorkflow({
        adapterKey: "user-controlled-adapter",
        extractionProfileKey: "bandnet-contact-form-v1",
      }),
    ).toBeNull();
  });

  it("uses one reviewed click and contains no bypass primitive", () => {
    const code = buildApprovedSubmissionCode({
      workflow: bandnetWorkflow(),
      fields: approvedFields,
    });
    expect(code.match(/\.click\(/g)).toHaveLength(1);
    expect(code).not.toMatch(/\.press\(/);
    expect(code).not.toMatch(/\.submit\(/);
    expect(code).not.toMatch(/captcha.*solve|solve.*captcha/i);
    expect(code).not.toMatch(/check\(\)|setChecked\(true\)/);
    expect(code).not.toContain('page.locator(\'input[type="password"]\').fill');
  });

  it("checks every irreducible human boundary before the single click", () => {
    const code = buildApprovedSubmissionCode({
      workflow: bandnetWorkflow(),
      fields: approvedFields,
    });
    const clickAt = code.indexOf("await submit.click");
    expect(clickAt).toBeGreaterThan(0);
    for (const marker of [
      'input[type="password"]',
      'autocomplete="one-time-code"',
      "terms_acceptance",
      "payment_or_contract",
      "CAPTCHA_REQUIRED",
      "MISSING_REQUIRED_FIELDS",
      "SUBMIT_CONTROL_MISMATCH",
    ]) {
      expect(code.indexOf(marker)).toBeGreaterThanOrEqual(0);
      expect(code.indexOf(marker)).toBeLessThan(clickAt);
    }
  });

  it("stops at the human handoff when policy requires presence", () => {
    const code = buildApprovedSubmissionCode({
      workflow: bandnetWorkflow(),
      fields: approvedFields,
      forceHumanPresence: true,
    });
    expect(code).toContain('forceHumanPresence":true');
    expect(code.indexOf("HUMAN_PRESENCE_REQUIRED")).toBeLessThan(
      code.indexOf("await submit.click"),
    );
  });

  it("rejects selectors and unreviewed fields supplied through the action payload", () => {
    expect(() =>
      buildApprovedSubmissionCode({
        workflow: bandnetWorkflow(),
        fields: [
          ...approvedFields,
          { name: 'button[type="submit"]', value: "injected" },
        ],
      }),
    ).toThrow("UNREVIEWED_FORM_FIELD");
  });

  it("rejects duplicate approved fields instead of choosing one value", () => {
    expect(() =>
      buildApprovedSubmissionCode({
        workflow: bandnetWorkflow(),
        fields: [...approvedFields, { name: "message", value: "changed" }],
      }),
    ).toThrow("APPROVED_FORM_FIELDS_INVALID");
  });

  it("rejects multiple aliases for the same reviewed field", () => {
    expect(() =>
      buildApprovedSubmissionCode({
        workflow: bandnetWorkflow(),
        fields: [
          ...approvedFields,
          { name: "sender_name", value: "A different sender" },
        ],
      }),
    ).toThrow("APPROVED_FORM_FIELDS_AMBIGUOUS");
  });

  it("uses conservative success signals and reports an unknown outcome otherwise", () => {
    const code = buildApprovedSubmissionCode({
      workflow: bandnetWorkflow(),
      fields: approvedFields,
    });
    expect(code).toContain("SUCCESS_SIGNAL_OBSERVED");
    expect(code).toContain("SUCCESS_SIGNAL_NOT_OBSERVED");
    expect(code).toContain("verification_unknown");
    expect(code).not.toContain("successObserved = true; //");
  });

  it("parses only the bounded structured provider result", () => {
    expect(
      parseApprovedSubmissionOutput(
        'diagnostic\n{"state":"human_required","reasonCode":"CAPTCHA_REQUIRED","filled":["message"],"missing":[],"blockers":["captcha"]}',
      ),
    ).toEqual({
      state: "human_required",
      reasonCode: "CAPTCHA_REQUIRED",
      filled: ["message"],
      missing: [],
      blockers: ["captcha"],
    });
    expect(() =>
      parseApprovedSubmissionOutput(
        '{"state":"submitted_verified","reasonCode":"made_up"}',
      ),
    ).toThrow("FIRECRAWL_SUBMISSION_RESULT_INVALID");
  });
});
