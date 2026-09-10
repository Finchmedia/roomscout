import { describe, expect, it, vi } from "vitest";
import { MATCH_ASSESSMENT_INSTRUCTIONS, MATCH_ASSESSMENT_VERSION, matchAssessmentSchema, type MatchAssessment } from "./lib/matchAssessment";
import { MATCH_ASSESSMENT_PROOF_CALL_CAP, MATCH_ASSESSMENT_PROOF_CASES, runMatchAssessmentProof } from "./matchAssessmentProof";

function unknownAssessment(requirementCount: number): MatchAssessment {
  return {
    requirements: Array.from({ length: requirementCount }, (_, index) => ({ index, verdict: "unknown", evidence: null, explanation: "Not established." })),
    schedule: { verdict: "unknown", evidence: null, explanation: "Not established." },
    monthlyPrice: { minimumEur: null, totalKnown: false, evidence: null },
    sharing: { open: null, evidence: null },
  };
}

describe("controlled semantic match proof", () => {
  it("uses the fixed production request shape exactly once per bounded case", async () => {
    expect(MATCH_ASSESSMENT_VERSION).toBe("constraints-v3");
    expect(MATCH_ASSESSMENT_INSTRUCTIONS).toContain("TOTAL MONTHLY COST FOR THE WHOLE BAND");
    expect(MATCH_ASSESSMENT_INSTRUCTIONS).toContain("per-person price without a known band-member count MUST produce minimumEur: null");
    const generate = vi.fn(async (args: Parameters<NonNullable<Parameters<typeof runMatchAssessmentProof>[0]>>[0]) => {
      const parsed = JSON.parse(args.prompt) as { need: { requirements: string[] } };
      return unknownAssessment(parsed.need.requirements.length);
    });
    const result = await runMatchAssessmentProof(generate);
    expect(MATCH_ASSESSMENT_PROOF_CASES).toHaveLength(6);
    expect(MATCH_ASSESSMENT_PROOF_CASES.length).toBeLessThanOrEqual(MATCH_ASSESSMENT_PROOF_CALL_CAP);
    expect(generate).toHaveBeenCalledTimes(MATCH_ASSESSMENT_PROOF_CASES.length);
    for (const [request] of generate.mock.calls) {
      expect(request).toMatchObject({ schema: matchAssessmentSchema, instructions: MATCH_ASSESSMENT_INSTRUCTIONS, timeoutMs: 45_000 });
      expect(Object.keys(JSON.parse(request.prompt))).toEqual(["need", "listingEvidence"]);
    }
    expect(result.caseCount).toBe(6);
  });

  it("reports provider failure honestly without a fallback or retry pass", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("secret provider detail"));
    const result = await runMatchAssessmentProof(generate);
    expect(generate).toHaveBeenCalledTimes(6);
    expect(result.results).toHaveLength(6);
    expect(result.results.every((item) => !item.success && item.failure === "provider_or_validation_failure")).toBe(true);
    expect(result.results.every((item) => !item.success && item.failureStage === "generation" && item.errorCode === "GENERATION_FAILED")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret provider detail");
  });

  it("reports a fixed grounding failure code without exposing model output", async () => {
    const generate = vi.fn(async () => ({
      ...unknownAssessment(0),
      monthlyPrice: { minimumEur: 225, totalKnown: true, evidence: "invented quote" },
    }));
    const result = await runMatchAssessmentProof(generate, "mandatory-monthly-extras");
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.caseCount).toBe(1);
    expect(result.results).toEqual([
      expect.objectContaining({
        id: "mandatory-monthly-extras",
        success: false,
        failureStage: "grounding",
        errorCode: "UNGROUNDED_MONTHLY_PRICE",
        priceDiagnostic: {
          minimumEur: 225,
          totalKnown: true,
          evidence: "invented quote",
          evidenceInListing: false,
        },
      }),
    ]);
  });

  it("bounds synthetic price evidence and never exposes it for another grounding error", async () => {
    const longEvidence = `EUR 225 ${"x".repeat(700)}`;
    const priceFailure = await runMatchAssessmentProof(async () => ({
      ...unknownAssessment(0),
      monthlyPrice: { minimumEur: 225, totalKnown: true, evidence: longEvidence },
    }), "mandatory-monthly-extras");
    const diagnostic = priceFailure.results[0]?.success === false
      ? priceFailure.results[0].priceDiagnostic
      : undefined;
    expect(diagnostic?.evidence).toHaveLength(600);
    expect(diagnostic?.evidenceInListing).toBe(false);

    const otherFailure = await runMatchAssessmentProof(async () => ({
      ...unknownAssessment(1),
      requirements: [{ index: 0, verdict: "satisfied", evidence: "private synthetic detail", explanation: "fixture" }],
    }), "negated-drums-and-storage");
    expect(otherFailure.results[0]).not.toHaveProperty("priceDiagnostic");
    expect(JSON.stringify(otherFailure)).not.toContain("private synthetic detail");
  });

  it("rejects an unknown targeted case before making a model call", async () => {
    const generate = vi.fn();
    await expect(runMatchAssessmentProof(generate, "caller-chosen-case")).rejects.toThrow("MATCH_PROOF_CASE_UNKNOWN");
    expect(generate).not.toHaveBeenCalled();
  });

  it("does not score an absent schedule constraint as a failure", async () => {
    const generate = vi.fn(async (args: { prompt: string }) => {
      const parsed = JSON.parse(args.prompt) as { need: { requirements: string[] } };
      const assessment = unknownAssessment(parsed.need.requirements.length);
      assessment.schedule = { verdict: "satisfied", evidence: null, explanation: "No schedule requested." };
      return assessment;
    });
    const result = await runMatchAssessmentProof(generate);
    expect(result.results.find((item) => item.id === "conditional-restriction")?.matchedExpected).toBe(true);
    expect(result.results.find((item) => item.id === "schedule-conflict")?.matchedExpected).toBe(false);
  });
});
