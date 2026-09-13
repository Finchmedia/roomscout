const MAX_PROGRAM_BODY_LENGTH = 90_000;
const MAX_PROGRAM_VARS_LENGTH = 10_000;

/** Build a single-expression program that is safe in Firecrawl's persistent REPL. */
export function buildFirecrawlProgram(
  body: string,
  vars: Record<string, unknown>,
): string {
  if (!body.trim() || body.length > MAX_PROGRAM_BODY_LENGTH) {
    throw new Error("FIRECRAWL_PROGRAM_INVALID");
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(vars);
  } catch {
    throw new Error("FIRECRAWL_PROGRAM_VARS_INVALID");
  }
  if (!serialized || serialized.length > MAX_PROGRAM_VARS_LENGTH) {
    throw new Error("FIRECRAWL_PROGRAM_VARS_INVALID");
  }
  return `(async () => {\nconst vars = ${serialized};\n${body}\n})()`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Accept only a conclusively successful Interact execution and return its
 * structured result. Provider diagnostics are deliberately never surfaced.
 */
export function parseInteractEnvelope(envelope: unknown): unknown {
  const value = record(envelope);
  if (!value) throw new Error("FIRECRAWL_INTERACT_ENVELOPE_INVALID");
  if (value.killed === true) throw new Error("FIRECRAWL_INTERACT_KILLED");
  if (value.success !== true || value.exitCode !== 0) {
    throw new Error("FIRECRAWL_INTERACT_EXECUTION_FAILED");
  }

  let result: unknown = value.result;
  if (typeof result === "string") {
    try {
      result = JSON.parse(result);
    } catch {
      throw new Error("FIRECRAWL_INTERACT_RESULT_INVALID");
    }
  }
  if (result === undefined) {
    throw new Error("FIRECRAWL_INTERACT_RESULT_MISSING");
  }
  if (typeof result === "function" || typeof result === "symbol") {
    throw new Error("FIRECRAWL_INTERACT_RESULT_INVALID");
  }
  return result;
}
