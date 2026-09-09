import { evalite } from "evalite";

evalite("Evalite runner foundation smoke only", {
  data: [{ input: { label: "smoke-only" }, expected: "smoke-only" }],
  task: ({ label }) => label,
  scorers: [{
    name: "fixture-round-trip",
    description: "Framework smoke only; this is not an autopilot evaluation result.",
    scorer: ({ output, expected }) => output === expected ? 1 : 0,
  }],
});
