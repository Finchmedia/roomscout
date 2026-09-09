import { describe, expect, it } from "vitest";
import { EVALUATION_SCENARIOS } from "../../convex/evaluation/scenarios";
import { judgeContext, scoutScenarioInput, simulatorContext } from "./scenarioModels";
import { criticalScenarios, standardScenarios } from "./scenarios";

describe("isolated evaluation context boundaries", () => {
  it("projects all 15 scenarios without leaking hidden truth or rubrics to the Scout", () => {
    expect(EVALUATION_SCENARIOS).toHaveLength(15);
    for (const scenario of EVALUATION_SCENARIOS) {
      const projection = scoutScenarioInput(scenario);
      const serialized = JSON.stringify(projection);
      expect(serialized).not.toContain("hidden");
      expect(serialized).not.toContain("rubric");
      for (const truth of scenario.hidden.facts) {
        if (!JSON.stringify(scenario.scoutVisible).includes(truth)) expect(serialized).not.toContain(truth);
      }
    }
  });

  it("defines one standard trial and five trials for each critical case", () => {
    expect(standardScenarios).toHaveLength(10);
    expect(criticalScenarios).toHaveLength(5);
    expect(standardScenarios.length + criticalScenarios.length * 5).toBe(35);
  });

  it("gives hidden truth only to simulator and judge contexts", () => {
    const scenario = EVALUATION_SCENARIOS.find((item) => item.id === "prompt-injection")!;
    expect(simulatorContext(scenario, 1, [])).toHaveProperty("hiddenTruth");
    expect(judgeContext(scenario, { transcript: [], stateEvidence: {}, deterministicHardViolations: [] })).toHaveProperty("hiddenTruth");
    expect(scoutScenarioInput(scenario)).not.toHaveProperty("hiddenTruth");
  });

  it("shows the simulator only role-labelled visible conversation turns", () => {
    const scenario = EVALUATION_SCENARIOS[0]!;
    const visible = [{ role: "scout", text: "Could you confirm the total?", delivery: "internal_proposal" }] as const;
    const context = simulatorContext(scenario, 2, visible);
    expect(context.visibleConversation).toEqual(visible);
    expect(context).not.toHaveProperty("assessmentState");
    expect(context).not.toHaveProperty("blockerCodes");
  });

  it("enforces the eight-round contract before a model call", () => {
    const scenario = EVALUATION_SCENARIOS[0]!;
    expect(() => simulatorContext(scenario, 0, [])).toThrow("EVAL_ROUND_LIMIT");
    expect(() => simulatorContext(scenario, 9, [])).toThrow("EVAL_ROUND_LIMIT");
    expect(simulatorContext(scenario, 8, []).round).toBe(8);
  });

  it("carries deterministic violations into the judge context", () => {
    const violation = { code: "PROVIDER_RECEIPT_MISSING", summary: "No exact receipt exists." };
    const context = judgeContext(EVALUATION_SCENARIOS[0]!, {
      transcript: [], stateEvidence: { requestStatus: "executing" }, deterministicHardViolations: [violation],
    });
    expect(context.deterministicHardViolations).toEqual([violation]);
  });
});
