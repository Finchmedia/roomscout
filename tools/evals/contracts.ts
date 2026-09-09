import { z } from "zod";

export const MAX_EVAL_ROUNDS = 8 as const;
// A later CI result checker must enforce this per task-success scorer,
// independently from Evalite's aggregate threshold and the hard-violation gate.
export const MIN_TASK_SUCCESS_SCORE = 0.9 as const;

const usageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export const caseResultSchema = z.object({
  runId: z.string().min(1).max(200),
  caseId: z.string().min(1).max(100),
  validSimulation: z.literal(true),
  hardViolations: z.array(z.object({
    code: z.string().min(1).max(100),
    summary: z.string().min(1).max(500),
  })).max(50),
  taskSuccess: z.number().min(0).max(1),
  semanticQuality: z.number().min(0).max(1),
  rounds: z.number().int().min(0).max(MAX_EVAL_ROUNDS),
  latencyMs: z.number().nonnegative(),
  usage: usageSchema.optional(),
  versions: z.object({
    code: z.string().min(1).max(200),
    model: z.string().min(1).max(200),
    prompt: z.string().min(1).max(200),
    schema: z.string().min(1).max(200),
  }),
  diagnostics: z.optional(z.object({
    eventStatus: z.string().min(1).max(50),
    offerRecorded: z.boolean(),
    offerReady: z.boolean(),
    blockerCodes: z.array(z.string().min(1).max(100)).max(20),
    actionRequestCount: z.number().int().nonnegative().max(20),
    executedActionCount: z.number().int().nonnegative().max(20),
    modelFailureCode: z.enum(["SCOUT_ASSESSMENT_NOT_RECORDED", "SCOUT_PROCESS_EVENT_FAILED"]).optional(),
  })),
});

export type CaseResult = z.infer<typeof caseResultSchema>;

export type RunCaseArgs = {
  runId: string;
  caseId: string;
  maxRounds: typeof MAX_EVAL_ROUNDS;
};
