import process from "node:process";

const required = ["EVALITE_CONVEX_URL"];
const missing = required.filter((name) => !process.env[name]);

if (missing.length > 0) {
  process.stderr.write(`EVAL_BACKEND_NOT_CONFIGURED: missing ${missing.join(", ")}\n`);
  process.exitCode = 1;
}
