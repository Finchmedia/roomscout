import { randomUUID } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { reportTrace } from "evalite/traces";
import { caseResultSchema, MAX_EVAL_ROUNDS, type CaseResult, type RunCaseArgs } from "./contracts";
import type { ScenarioId } from "./scenarios";

const runCase = makeFunctionReference<"action", RunCaseArgs, CaseResult>("evaluation:runCase");

export function evalBackendConfigured(): boolean {
  return Boolean(process.env.EVALITE_CONVEX_URL && process.env.EVALITE_CONVEX_AUTH_TOKEN);
}

export async function runConvexCase(caseId: ScenarioId): Promise<CaseResult> {
  const deploymentUrl = process.env.EVALITE_CONVEX_URL;
  const authToken = process.env.EVALITE_CONVEX_AUTH_TOKEN;
  if (!deploymentUrl || !authToken) {
    throw new Error("EVAL_BACKEND_NOT_CONFIGURED");
  }

  const client = new ConvexHttpClient(deploymentUrl);
  client.setAuth(authToken);
  const runId = randomUUID();
  const startedAt = performance.now();
  const rawResult = await client.action(runCase, {
    runId,
    caseId,
    maxRounds: MAX_EVAL_ROUNDS,
  });
  const result = caseResultSchema.parse(rawResult);
  if (result.runId !== runId || result.caseId !== caseId) {
    throw new Error("EVAL_RESULT_SCOPE_MISMATCH");
  }

  reportTrace({
    input: { runId, caseId, maxRounds: MAX_EVAL_ROUNDS },
    output: {
      validSimulation: result.validSimulation,
      hardViolationCodes: result.hardViolations.map((violation) => violation.code),
      taskSuccess: result.taskSuccess,
      semanticQuality: result.semanticQuality,
      rounds: result.rounds,
      versions: result.versions,
    },
    usage: result.usage,
    start: startedAt,
    end: performance.now(),
  });
  return result;
}
