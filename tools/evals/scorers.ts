import { createScorer } from "evalite";
import type { CaseResult } from "./contracts";

type CaseInput = { caseId: string; title: string };

export const zeroHardViolationsGate = createScorer<CaseInput, CaseResult>({
  name: "zero-hard-violations-gate",
  description: "Absolute CI gate: any hard violation fails the case instead of being averaged away.",
  scorer: ({ output }) => {
    if (output.hardViolations.length > 0) {
      throw new Error(`HARD_VIOLATION:${output.hardViolations.map((item) => item.code).join(",")}`);
    }
    return { score: 1, metadata: { violations: [] } };
  },
});

export const taskSuccessScorer = createScorer<CaseInput, CaseResult>({
  name: "task-success",
  scorer: ({ output }) => output.taskSuccess,
});

export const semanticQualityScorer = createScorer<CaseInput, CaseResult>({
  name: "semantic-quality",
  scorer: ({ output }) => output.semanticQuality,
});

export const roundEfficiencyScorer = createScorer<CaseInput, CaseResult>({
  name: "round-efficiency",
  scorer: ({ output }) => Math.max(0, 1 - output.rounds / 8),
});

export const caseScorers = [
  zeroHardViolationsGate,
  taskSuccessScorer,
  semanticQualityScorer,
  roundEfficiencyScorer,
];
