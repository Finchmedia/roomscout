import process from "node:process";
import { spawnSync } from "node:child_process";
import "./requireBackend.mjs";

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["evalite", "run", "evals/autopilot.eval.ts", "--outputPath", "artifacts/autopilot-eval.json"],
  { cwd: process.cwd(), env: { ...process.env, NODE_ENV: "test" }, stdio: "inherit", timeout: 30 * 60_000 },
);
if (result.error) {
  process.stderr.write("EVALITE_RUNNER_FAILED\n");
  process.exit(1);
}
process.exit(result.status ?? 1);
