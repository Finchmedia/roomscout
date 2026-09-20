import { describe, expect, it } from "vitest";
import {
  offerConstraints, offerReadiness, providerAssessmentValidationIssue, providerCaseInstructions,
  providerAssessmentContextInstructions, validateProviderAssessment, type ProviderAssessment,
} from "./providerAssessment";

const quote = "Der Raum ist frei. 220 Euro monatlich inklusive aller Nebenkosten. Schlagzeug erlaubt, Lagerung möglich. Montags ab 18 Uhr.";
const citation = { sourceId: "portal:one", quote };
const need = { requirements: ["Drums and storage"], schedule: ["Monday evening", "Thursday evening"], maxBudgetEur: 250 };
const evidence = [{ sourceId: "portal:one", text: quote }];
function assessment(): ProviderAssessment {
  return {
    summary: "Available including drums and storage.", availability: { status: "available", evidence: [citation] },
    monthlyPrice: { totalEur: 220, allRecurringCostsKnown: true, evidence: [citation] },
    terms: [{ key: "equipment", label: "Equipment", value: "Drums and storage allowed", evidence: [citation] }],
    constraints: offerConstraints(need).map(({ key }) => ({ key, verdict: "satisfied", explanation: "Confirmed", evidence: [citation] })),
    uncertainties: [], contradictions: [], nextAction: "present_offer", suggestedReply: null,
  };
}

describe("evidence-backed provider offers", () => {
  it("accepts complete citations and treats requested time alternatives as one condition", () => {
    const parsed = validateProviderAssessment(assessment(), evidence, need);
    expect(parsed.constraints.map((item) => item.key)).toEqual(["requirement:0", "schedule", "budget"]);
    expect(offerReadiness(parsed, need).ready).toBe(true);
  });
  it("rejects invented excerpts and citations to another provider", () => {
    for (const bad of [{ sourceId: "portal:other", quote }, { sourceId: "portal:one", quote: "Costs only 100 Euro" }]) {
      const input = assessment(); input.terms[0]!.evidence = [bad];
      expect(() => validateProviderAssessment(input, evidence, need)).toThrow("OFFER_EVIDENCE_NOT_FOUND");
    }
  });
  it("identifies a stitched quote's exact field and source so one model turn can repair it", () => {
    const input = assessment();
    input.terms[0]!.evidence = [{
      sourceId: "portal:one",
      quote: "Der Raum ist frei. Schlagzeug erlaubt, Lagerung möglich.",
    }];
    let issue = null;
    try {
      validateProviderAssessment(input, evidence, need);
    } catch (error) {
      issue = providerAssessmentValidationIssue(error);
    }
    expect(issue).toEqual({
      code: "OFFER_EVIDENCE_NOT_CONTIGUOUS",
      fieldPath: "terms[0].evidence[0]",
      sourceId: "portal:one",
    });

    input.terms[0]!.evidence = [
      { sourceId: "portal:one", quote: "Der Raum ist frei." },
      { sourceId: "portal:one", quote: "Schlagzeug erlaubt, Lagerung möglich." },
    ];
    expect(validateProviderAssessment(input, evidence, need).terms[0]?.evidence).toHaveLength(2);
  });
  it("does not allow a missing or duplicated hard requirement", () => {
    const input = assessment(); input.constraints.shift();
    expect(() => validateProviderAssessment(input, evidence, need)).toThrow("MISSING_OFFER_CONSTRAINT");
    input.constraints.push(input.constraints[0]!);
    expect(() => validateProviderAssessment(input, evidence, need)).toThrow("UNEXPECTED_OR_DUPLICATE_CONSTRAINT");
  });
  it("requires evidence for definite price, availability and term claims", () => {
    const price = assessment(); price.monthlyPrice.evidence = [];
    expect(() => validateProviderAssessment(price, evidence, need)).toThrow("PRICE_EVIDENCE_REQUIRED");
    const availability = assessment(); availability.availability.evidence = [];
    expect(() => validateProviderAssessment(availability, evidence, need)).toThrow("AVAILABILITY_EVIDENCE_REQUIRED");
    const term = assessment(); term.terms[0]!.evidence = [];
    expect(() => validateProviderAssessment(term, evidence, need)).toThrow("TERM_EVIDENCE_REQUIRED");
  });
  it("an asserted match cannot override a numeric budget conflict", () => {
    const input = assessment(); input.monthlyPrice.totalEur = 320;
    expect(offerReadiness(input, need)).toMatchObject({ ready: false, blockers: expect.arrayContaining([expect.stringContaining("exceeds")]) });
  });
  it.each(["conditional", "conflict", "unknown"] as const)("does not equate %s with a satisfied condition", (verdict) => {
    const input = assessment(); input.constraints[0]!.verdict = verdict;
    expect(offerReadiness(input, need).ready).toBe(false);
  });
  it("keeps partial recurring costs, unresolved conflicts and public-only observations unready", () => {
    const price = assessment(); price.monthlyPrice.allRecurringCostsKnown = false;
    expect(offerReadiness(price, need).ready).toBe(false);
    const conflict = assessment(); conflict.contradictions.push({ explanation: "Conflicting costs", evidence: [citation, citation] });
    expect(offerReadiness(conflict, need).ready).toBe(false);
    const listing = assessment(); listing.availability.evidence = [{ sourceId: "listing", quote }];
    expect(offerReadiness(listing, need).ready).toBe(false);
  });
  it("names an explicitly unavailable room instead of calling its availability unconfirmed", () => {
    const unavailable = assessment(); unavailable.availability.status = "unavailable";
    expect(offerReadiness(unavailable, need)).toMatchObject({ ready: false, hardBlockers: ["The provider reports the room as not available."] });
    const unknown = assessment(); unknown.availability.status = "unknown";
    expect(offerReadiness(unknown, need)).toMatchObject({ ready: false, hardBlockers: ["Availability is not confirmed."] });
  });
  it("keeps an offer unready without a present_offer action but does not surface that as a blocker", () => {
    const input = assessment(); input.nextAction = "ask_musician";
    expect(offerReadiness(input, need)).toEqual({ ready: false, blockers: [], hardBlockers: [] });
  });
  it("does not let an accepted schedule concession satisfy an independent equipment conflict", () => {
    const concessionNeed = {
      requirements: ["Acoustic drums allowed"],
      schedule: ["Tuesday evening", "Thursday evening"],
    };
    const previous = assessment();
    previous.constraints = [
      {
        key: "requirement:0", verdict: "conflict",
        explanation: "Only electronic drums are allowed; acoustic drums are prohibited.", evidence: [citation],
      },
      {
        key: "schedule", verdict: "conflict",
        explanation: "Only Wednesday is available.", evidence: [citation],
      },
    ];
    const input = structuredClone(previous);
    input.constraints[0]!.verdict = "satisfied";
    input.constraints[1]!.verdict = "satisfied";

    expect(() => validateProviderAssessment(input, evidence, concessionNeed, {
      previousAssessment: previous,
      answeredConstraintKeys: ["schedule"],
    })).toThrow("UNANSWERED_CONSTRAINT_CONCESSION");

    expect(validateProviderAssessment(input, evidence, concessionNeed, {
      previousAssessment: previous,
      answeredConstraintKeys: ["schedule", "requirement:0"],
    }).constraints.every((constraint) => constraint.verdict === "satisfied")).toBe(true);

    input.constraints[0]!.verdict = "conflict";

    const parsed = validateProviderAssessment(input, evidence, concessionNeed, {
      previousAssessment: previous,
      answeredConstraintKeys: ["schedule"],
    });
    expect(offerReadiness(parsed, concessionNeed)).toMatchObject({
      ready: false,
      blockers: ["Only electronic drums are allowed; acoustic drums are prohibited."],
    });
  });
  it("keeps a shared equipment constraint conflicting when one sibling answer retains it", () => {
    const equipmentNeed = { requirements: ["Acoustic drums and onsite storage"], schedule: [] };
    const previous = assessment();
    previous.constraints = [{
      key: "requirement:0", verdict: "conflict",
      explanation: "Storage is available, but only electronic drums are allowed.", evidence: [citation],
    }];
    const input = structuredClone(previous);
    input.constraints[0]!.verdict = "satisfied";

    expect(() => validateProviderAssessment(input, evidence, equipmentNeed, {
      previousAssessment: previous,
      // The storage sibling was accepted, while the drums sibling explicitly
      // kept the acoustic-drums requirement under the same structured key.
      answeredConstraintKeys: ["requirement:0"],
      retainedConstraintKeys: ["requirement:0"],
    })).toThrow("MUSICIANS_CONSTRAINT_RETAINED");
  });
  it("can offer a viewing decision with contract details open without claiming a binding-ready offer", () => {
    const input = assessment();
    input.nextAction = "ask_musician";
    input.summary = "The room fits. Would you like to arrange a viewing and clarify notice terms there?";
    input.uncertainties = ["Notice terms to clarify at a viewing."];
    const parsed = validateProviderAssessment(input, evidence, need);
    expect(parsed.suggestedReply).toBeNull();
    expect(offerReadiness(parsed, need)).toEqual({
      ready: false, blockers: ["Notice terms to clarify at a viewing."], hardBlockers: [],
    });
  });
  it("does not create an outgoing proposal when handing an offer to the musician", () => {
    const input = assessment(); input.suggestedReply = { subject: "Reply", body: "We accept." };
    expect(() => validateProviderAssessment(input, evidence, need)).toThrow("UNEXPECTED_REPLY_PROPOSAL");
  });
});

describe("provider case instructions", () => {
  it("treats a musician instruction about the wording as an instruction, not as offer evidence", () => {
    expect(providerCaseInstructions).toContain("Anweisung der Band");
    expect(providerCaseInstructions).toContain("instruction for the wording of your next message");
    expect(providerCaseInstructions).toContain("exact contiguous substring");
  });

  it("scopes each musician concession to the constraint key that was asked", () => {
    expect(providerCaseInstructions).toContain("Apply an answer only to the constraintKeys attached to its question");
    expect(providerCaseInstructions).toContain("accepting Wednesday instead of Tuesday/Thursday changes only the schedule constraint");
    expect(providerCaseInstructions).toContain("until the musician explicitly accepts that equipment concession");
  });

  it("scopes the fictional-provider disclaimer without weakening real availability evidence", () => {
    const instructions = providerAssessmentContextInstructions({ controlledAiSimulation: true });
    expect(instructions).toContain("inside this controlled simulation");
    expect(instructions).toContain("is not a withdrawal");
    expect(instructions).toContain("actual inbound provider message");
    expect(instructions).toContain("explicitly unavailable or withdrawn");
    expect(providerAssessmentContextInstructions({ controlledAiSimulation: false })).toBe("");
  });
});
