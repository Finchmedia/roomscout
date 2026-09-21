import { describe, expect, it } from "vitest";
import { MUSICIAN_DECISION_QUESTION_SCOPE } from "./decisions";

describe("musician decision formulation case card", () => {
  it("asks only about genuine open choices, never about satisfied or non-demand requirements", () => {
    expect(MUSICIAN_DECISION_QUESTION_SCOPE).toContain("Only ask about genuine open choices for the musician");
    expect(MUSICIAN_DECISION_QUESTION_SCOPE).toContain(
      "Never ask whether a requirement the provider has already satisfied, or a statement about what the band brings, does, owns or does not need, should remain a requirement",
    );
    expect(MUSICIAN_DECISION_QUESTION_SCOPE).toContain("open only because of band-side wording");
    expect(MUSICIAN_DECISION_QUESTION_SCOPE).toContain("treat it as satisfied and skip it");
  });

  it("never turns a fact the provider can supply into a musician question", () => {
    expect(MUSICIAN_DECISION_QUESTION_SCOPE).toContain(
      "Never ask whether the Scout should request a fact from the provider (an address, a price detail, availability, house rules)",
    );
    expect(MUSICIAN_DECISION_QUESTION_SCOPE).toContain("requesting facts is the Scout's job, not a musician choice");
    expect(MUSICIAN_DECISION_QUESTION_SCOPE).toContain("typically whether to arrange a viewing");
  });
});
