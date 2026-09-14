import { describe, expect, it } from "vitest";
import { offerConstraints, offerReadiness, validateProviderAssessment, type ProviderAssessment } from "./providerAssessment";

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
  it("keeps an offer unready without a present_offer action but does not surface that as a blocker", () => {
    const input = assessment(); input.nextAction = "ask_musician";
    expect(offerReadiness(input, need)).toEqual({ ready: false, blockers: [], hardBlockers: [] });
  });
  it("does not create an outgoing proposal when handing an offer to the musician", () => {
    const input = assessment(); input.suggestedReply = { subject: "Reply", body: "We accept." };
    expect(() => validateProviderAssessment(input, evidence, need)).toThrow("UNEXPECTED_REPLY_PROPOSAL");
  });
});
