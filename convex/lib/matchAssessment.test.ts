import { describe, expect, it } from "vitest";
import { MATCH_ASSESSMENT_VERSION, validateMatchAssessment, type MatchAssessment } from "./matchAssessment";
import { scoreSignalMatch, type MatchNeed, type MatchSignal } from "../matchingCore";

const need: MatchNeed = { city: "Stuttgart", districts: [], arrangement: ["shared"], maxBudgetEur: 250, requirements: ["Loud drums allowed"], schedule: ["Monday evening"] };
const signal: MatchSignal = { side: "supply", city: "Stuttgart", title: "Shared room", summary: "No acoustic drums. Monday after 18:00 is free. Rent 220 plus mandatory utilities 50 per month.", arrangement: "shared", priceEur: 220, pricePeriod: "month", requirements: [] };
const assessment: MatchAssessment = {
  requirements: [{ index: 0, verdict: "conflict", evidence: "No acoustic drums.", explanation: "Acoustic drums are explicitly excluded" }],
  schedule: { verdict: "satisfied", evidence: "Monday after 18:00 is free.", explanation: "Monday evening is offered" },
  monthlyPrice: { minimumEur: 270, totalKnown: true, evidence: "Rent 220 plus mandatory utilities 50 per month." },
  sharing: { open: null, evidence: null },
};

describe("evidence-backed matching", () => {
  it("never lets a perfect embedding override an equipment conflict", () => {
    const checked = validateMatchAssessment(assessment, need, signal);
    expect(scoreSignalMatch(need, signal, 1, checked).eligible).toBe(false);
  });
  it("includes mandatory extras before comparing budget", () => {
    const checked = { ...assessment, requirements: [{ ...assessment.requirements[0]!, verdict: "unknown" as const }] };
    expect(scoreSignalMatch(need, signal, 1, checked).reasons).toContain("Monthly cost including stated extras exceeds the maximum budget");
  });
  it("rejects invented evidence even when the generated object matches the schema", () => {
    expect(() => validateMatchAssessment({ ...assessment, requirements: [{ ...assessment.requirements[0]!, evidence: "Drums are allowed" }] }, need, signal)).toThrow("Ungrounded");
  });
  it("requires complete, non-duplicated requirement references", () => {
    expect(() => validateMatchAssessment({ ...assessment, requirements: [] }, need, signal)).toThrow("Incomplete");
    expect(() => validateMatchAssessment({ ...assessment, requirements: [assessment.requirements[0], assessment.requirements[0]] }, need, signal)).toThrow("Invalid requirement");
  });
  it("does not reinterpret an hourly quote as affordable monthly rent", () => {
    const result = scoreSignalMatch({ ...need, requirements: [], schedule: [] }, { ...signal, priceEur: 10, pricePeriod: "hour" }, 1);
    expect(result.reasons.some((reason) => reason.includes("price is within budget"))).toBe(false);
    expect(result.uncertainties).toContain("A comparable total monthly price has not been established");
  });
  it("withholds a per-person unit price when the band's total is unknown", () => {
    const perPersonSignal = { ...signal, summary: "Rent is EUR 80 per person per month; band size is not specified.", priceEur: undefined, pricePeriod: undefined };
    const perPersonNeed = { ...need, requirements: [], schedule: [], maxBudgetEur: 50 };
    const unknownTotal: MatchAssessment = {
      requirements: [], schedule: { verdict: "unknown", evidence: null, explanation: "No schedule requested." },
      monthlyPrice: { minimumEur: null, totalKnown: false, evidence: null }, sharing: { open: null, evidence: null },
    };
    const checked = validateMatchAssessment(unknownTotal, perPersonNeed, perPersonSignal);
    expect(checked.monthlyPrice).toEqual({ minimumEur: null, totalKnown: false, evidence: null });
    expect(scoreSignalMatch(perPersonNeed, perPersonSignal, 1, checked).reasons).not.toContain("Monthly price is within budget");
    expect(scoreSignalMatch(perPersonNeed, perPersonSignal, 1, checked).uncertainties).toContain("Price is not stated");
    expect(MATCH_ASSESSMENT_VERSION).toBe("constraints-v2");
  });
  it("does not fabricate musical overlap when neither party has musical preferences", () => {
    const result = scoreSignalMatch({ ...need, requirements: [], schedule: [] }, { ...signal, summary: "Plain shared room" }, 0);
    expect(result.reasons).not.toContain("Musical context overlaps");
  });
  it("makes conditional requirements uncertainty, not fulfilled requirements", () => {
    const checked = { ...assessment, requirements: [{ index: 0, verdict: "unknown" as const, evidence: null, explanation: "Need to clarify quiet drums restriction" }], monthlyPrice: { minimumEur: null, totalKnown: false, evidence: null } };
    const result = scoreSignalMatch(need, signal, 1, checked);
    expect(result.uncertainties).toContain("Need to clarify quiet drums restriction");
    expect(result.reasons).not.toContain("Practical requirements overlap");
  });
  it("rejects an incompatible schedule regardless of semantic similarity", () => {
    const checked = { ...assessment, requirements: [], schedule: { verdict: "conflict" as const, evidence: "Monday after 18:00 is free.", explanation: "Only weekday slot is incompatible" }, monthlyPrice: { minimumEur: null, totalKnown: false, evidence: null } };
    expect(scoreSignalMatch({ ...need, requirements: [], schedule: ["Saturday morning"] }, signal, 1, checked).eligible).toBe(false);
  });
  it("requires positive sharing evidence instead of matching a negated phrase", () => {
    const demand = { ...signal, side: "demand" as const, summary: "Not open to sharing" };
    expect(scoreSignalMatch({ ...need, openToSharing: true }, demand, 1).eligible).toBe(false);
  });
});
