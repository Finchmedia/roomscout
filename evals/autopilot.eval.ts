import { evalite } from "evalite";
import { runLocalCase } from "../tools/evals/runLocalCase";
import { gatewayBridgeConfigured } from "../tools/evals/gatewayBridgeModel";
import { caseScorers } from "../tools/evals/scorers";
import { criticalScenarios, standardScenarios, type ScenarioId } from "../tools/evals/scenarios";

const register = gatewayBridgeConfigured() ? evalite : evalite.skip;
const requestedCaseId = process.env.EVAL_CASE_ID as ScenarioId | undefined;
const data = (rows: readonly { id: ScenarioId; title: string }[]) =>
  rows.filter((scenario) => !requestedCaseId || scenario.id === requestedCaseId)
    .map((scenario) => ({ input: { caseId: scenario.id, title: scenario.title } }));

const columns = ({ output }: { output: Awaited<ReturnType<typeof runLocalCase>> }) => [
  { label: "Rounds", value: output.rounds },
  { label: "Latency (ms)", value: output.latencyMs },
  { label: "Hard violations", value: output.hardViolations.map((item) => item.code) },
  { label: "Versions", value: output.versions },
  { label: "Diagnostics", value: output.diagnostics },
];

const standardData = data(standardScenarios);
if (standardData.length) register("RoomScout isolated real-Agent domain scenarios", {
  data: standardData,
  task: async ({ caseId }) => {
    const output = await runLocalCase(caseId);
    console.log(JSON.stringify({ caseId: output.caseId, rounds: output.rounds, taskSuccess: output.taskSuccess,
      semanticQuality: output.semanticQuality, hardViolationCodes: output.hardViolations.map((item) => item.code), diagnostics: output.diagnostics }));
    return output;
  },
  scorers: caseScorers,
  columns,
});

const criticalData = data(Array.from({ length: 5 }, (_, trial) => criticalScenarios.map((scenario) => ({
    ...scenario,
    title: `${scenario.title} — trial ${trial + 1}`,
  }))).flat());
if (criticalData.length) register("RoomScout isolated real-Agent critical trials", {
  data: criticalData,
  task: async ({ caseId }) => {
    const output = await runLocalCase(caseId);
    console.log(JSON.stringify({ caseId: output.caseId, rounds: output.rounds, taskSuccess: output.taskSuccess,
      semanticQuality: output.semanticQuality, hardViolationCodes: output.hardViolations.map((item) => item.code), diagnostics: output.diagnostics }));
    return output;
  },
  scorers: caseScorers,
  columns,
});
