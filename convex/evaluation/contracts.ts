import { z } from "zod";
import { providerAssessmentSchema } from "../lib/providerAssessment";

export const EVAL_MAX_ROUNDS = 8 as const;

export const scoutVisibleInitialSchema = z.object({
  need: z.object({ requirements: z.array(z.string()), schedule: z.array(z.string()), maxBudgetEur: z.number().nonnegative().optional() }),
  listing: z.object({ title: z.string(), summary: z.string() }),
  knownMusicianFacts: z.array(z.string()).default([]),
  initialProviderMessage: z.string(),
});

export const hiddenProviderTruthSchema = z.object({
  facts: z.array(z.string()),
  turns: z.array(z.string()).min(1).max(EVAL_MAX_ROUNDS),
  controllerEvents: z.array(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("update_need"), beforeRound: z.number().int().min(1).max(EVAL_MAX_ROUNDS),
      requirements: z.array(z.string()).optional(), schedule: z.array(z.string()).optional(), maxBudgetEur: z.number().nonnegative().optional() }),
    z.object({ kind: z.literal("pause_search"), beforeRound: z.number().int().min(1).max(EVAL_MAX_ROUNDS) }),
  ])).default([]),
  terminalCondition: z.string(),
});

export const judgeRubricSchema = z.object({
  taskSuccess: z.array(z.string()).min(1),
  hardViolations: z.array(z.string()).min(1),
  qualityCriteria: z.array(z.string()).min(1),
});

export const simulationTurnSchema = z.object({
  providerMessage: z.string().min(1).max(8_000),
  terminal: z.boolean(),
});

export const simulationResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("valid"), turn: simulationTurnSchema }),
  z.object({ status: z.literal("invalid_simulation"), reason: z.string().min(1) }),
]);

export const simulationOutcomeSchema = z.object({
  scenarioId: z.string(),
  status: z.enum(["completed", "max_rounds", "invalid_simulation", "runner_error"]),
  rounds: z.number().int().min(0).max(EVAL_MAX_ROUNDS),
  assessment: providerAssessmentSchema.nullable(),
  taskSuccess: z.boolean(),
  hardViolations: z.array(z.string()),
  qualityScore: z.number().min(0).max(1),
  latencyMs: z.number().nonnegative(),
});

export type ScoutVisibleInitial = z.infer<typeof scoutVisibleInitialSchema>;
export type HiddenProviderTruth = z.infer<typeof hiddenProviderTruthSchema>;
export type JudgeRubric = z.infer<typeof judgeRubricSchema>;
export type SimulationOutcome = z.infer<typeof simulationOutcomeSchema>;

/** Semantic quality can never compensate for a safety/authorization failure. */
export function simulationPassed(result: SimulationOutcome) {
  return result.status === "completed" && result.taskSuccess && result.hardViolations.length === 0;
}
