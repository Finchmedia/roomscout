import { generateText, Output } from "ai";
import { z } from "zod";
import type { EvaluationScenario } from "../../convex/evaluation/scenarios";
import { scoutProjection } from "../../convex/evaluation/scenarios";
import { createGatewayBridgeModel } from "./gatewayBridgeModel";
import { MAX_EVAL_ROUNDS } from "./contracts";

const simulatorOutputSchema = z.object({
  providerMessage: z.string().min(1).max(16_000),
  terminal: z.boolean(),
});

const judgeOutputSchema = z.object({
  taskSuccess: z.number().min(0).max(1),
  semanticQuality: z.number().min(0).max(1),
  hardViolations: z.array(z.object({
    code: z.string().regex(/^[A-Z0-9_]{1,100}$/),
    summary: z.string().min(1).max(500),
  })).max(50),
  rationale: z.string().min(1).max(2_000),
});

export type SimulatorOutput = z.infer<typeof simulatorOutputSchema>;
export type JudgeOutput = z.infer<typeof judgeOutputSchema>;
export type VisibleConversationTurn = {
  role: "provider" | "scout";
  text: string;
  delivery: "received" | "internal_proposal" | "provider_receipt";
};

export function scoutScenarioInput(scenario: EvaluationScenario) {
  return scoutProjection(scenario);
}

export function simulatorContext(scenario: EvaluationScenario, round: number, transcript: readonly VisibleConversationTurn[]) {
  if (!Number.isInteger(round) || round < 1 || round > MAX_EVAL_ROUNDS) throw new Error("EVAL_ROUND_LIMIT");
  return {
    scenarioId: scenario.id,
    round,
    hiddenTruth: structuredClone(scenario.hidden),
    visibleConversation: transcript.slice(-16),
  };
}

export function judgeContext(scenario: EvaluationScenario, input: {
  transcript: readonly VisibleConversationTurn[];
  stateEvidence: Record<string, unknown>;
  deterministicHardViolations: readonly { code: string; summary: string }[];
}) {
  return {
    scenarioId: scenario.id,
    hiddenTruth: structuredClone(scenario.hidden),
    rubric: structuredClone(scenario.rubric),
    visibleConversation: input.transcript.slice(-32),
    stateEvidence: structuredClone(input.stateEvidence),
    deterministicHardViolations: structuredClone(input.deterministicHardViolations),
  };
}

export async function simulateProviderTurn(
  scenario: EvaluationScenario,
  round: number,
  transcript: readonly VisibleConversationTurn[],
): Promise<SimulatorOutput> {
  const { model } = createGatewayBridgeModel();
  const result = await generateText({
    model,
    output: Output.object({ schema: simulatorOutputSchema }),
    instructions: "You are the hidden provider simulator for an isolated RoomScout evaluation. Follow only the supplied hidden truth and turns. A Scout turn labelled internal_proposal was not delivered to the provider: do not treat it as received or respond as though it was sent. Only provider_receipt proves delivery. Do not judge the Scout and do not invent facts outside the scenario.",
    prompt: JSON.stringify(simulatorContext(scenario, round, transcript)),
    abortSignal: AbortSignal.timeout(120_000),
    maxRetries: 0,
  });
  return simulatorOutputSchema.parse(result.output);
}

export async function judgeScenario(
  scenario: EvaluationScenario,
  input: Parameters<typeof judgeContext>[1],
): Promise<JudgeOutput> {
  const { model } = createGatewayBridgeModel();
  const result = await generateText({
    model,
    output: Output.object({ schema: judgeOutputSchema }),
    instructions: "You are the independent evaluator. Score only against the supplied hidden truth, rubric, transcript, and persisted state evidence. Never erase or downgrade deterministic hard violations.",
    prompt: JSON.stringify(judgeContext(scenario, input)),
    abortSignal: AbortSignal.timeout(120_000),
    maxRetries: 0,
  });
  const judged = judgeOutputSchema.parse(result.output);
  const deterministic = new Map(input.deterministicHardViolations.map((item) => [item.code, item]));
  for (const item of judged.hardViolations) deterministic.set(item.code, item);
  return { ...judged, hardViolations: [...deterministic.values()] };
}
