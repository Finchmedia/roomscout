const MAX_PROGRAM_BODY_LENGTH = 90_000;
const MAX_PROGRAM_VARS_LENGTH = 10_000;
const RESULT_MARKER = "__ROOMSCOUT_RESULT__";
/** In-band failure code carried by a program that threw inside the sandbox. */
const SANDBOX_ERROR_CODE = "SANDBOX_ERROR";
const MAX_SANDBOX_MESSAGE_LENGTH = 400;
/** How much of a sandbox message survives into our error code. */
const MAX_SURFACED_MESSAGE_LENGTH = 120;
export const FIRECRAWL_COMPLETION_FIELD = "__roomscoutCompletion";

/**
 * One page probe, evaluated only when the program throws. Mirrors the local
 * proof (`scripts/firecrawl-local-lib.mjs` `program()`): a bare exit code says
 * nothing about why a portal step failed, a page snapshot says everything.
 */
const DIAGNOSTIC_SOURCE = String.raw`const __roomscoutDiag = async () => {
  try {
    return await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      clerkLoaded: window.Clerk?.loaded === true,
      authenticated: Boolean(window.Clerk?.user && window.Clerk?.session),
      formErrors: Array.from(document.querySelectorAll('[class*="formFieldErrorText"], [class*="alertText"], [role="alert"]')).map((el) => (el.textContent ?? '').trim()).filter(Boolean).slice(0, 5),
      textSnippet: (document.body?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 400),
    }));
  } catch (error) { return { diagError: String(error?.message ?? error).slice(0, 200) }; }
};`;

/**
 * Build a single-expression program that is safe in Firecrawl's persistent REPL.
 *
 * The body runs inside an inner async IIFE wrapped in try/catch, so a throw
 * comes back in-band as `{ __roomscoutError: { code, message, partial, diag } }`
 * instead of a bare non-zero exit code. Bodies may record progress on
 * `__roomscoutPartial` before a step that can fail.
 */
export function buildFirecrawlProgram(
  body: string,
  vars: Record<string, unknown>,
  completionKey?: string,
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
  if (completionKey !== undefined && !/^__roomscoutRun_[A-Za-z0-9_-]{1,100}$/.test(completionKey)) {
    throw new Error("FIRECRAWL_PROGRAM_COMPLETION_KEY_INVALID");
  }
  const completionStart = completionKey === undefined ? "" :
    `globalThis[${JSON.stringify(completionKey)}] = JSON.stringify({ ${JSON.stringify(FIRECRAWL_COMPLETION_FIELD)}: { id: ${JSON.stringify(completionKey)}, state: "pending" } });`;
  const completionFinish = completionKey === undefined ? "" :
    `__roomscoutResult = { ${JSON.stringify(FIRECRAWL_COMPLETION_FIELD)}: { id: ${JSON.stringify(completionKey)}, state: "done", value: __roomscoutResult } };\nglobalThis[${JSON.stringify(completionKey)}] = JSON.stringify(__roomscoutResult);`;
  return `await (async () => {
${completionStart}
const vars = ${serialized};
const __roomscoutPartial = {};
${DIAGNOSTIC_SOURCE}
let __roomscoutResult;
try {
__roomscoutResult = await (async () => {
${body}
})();
} catch (error) {
__roomscoutResult = { __roomscoutError: { code: ${JSON.stringify(SANDBOX_ERROR_CODE)}, message: String(error?.message ?? error).slice(0, ${MAX_SANDBOX_MESSAGE_LENGTH}), partial: __roomscoutPartial, diag: await __roomscoutDiag() } };
}
${completionFinish}
const __roomscoutEncoded = JSON.stringify(__roomscoutResult);
console.log(${JSON.stringify(RESULT_MARKER)} + __roomscoutEncoded);
return __roomscoutEncoded;
})()`;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Keep the sandbox's own words, drop anything that could carry a credential:
 * URLs (and therefore query strings) go, control characters go, and what
 * remains is bounded.
 */
function sanitisedSandboxMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  let cleaned = "";
  for (const character of value.replace(/https?:\/\/\S+/gi, "<url>")) {
    cleaned += character < " " || character === "\u007F" ? " " : character;
  }
  return cleaned.replace(/\s+/g, " ").trim().slice(0, MAX_SURFACED_MESSAGE_LENGTH);
}

function keysOf(value: unknown): string[] {
  const shape = record(value);
  return shape === null ? [] : Object.keys(shape).slice(0, 12);
}

/**
 * Accept only a conclusively successful Interact execution and return its
 * structured result. Provider diagnostics are deliberately never surfaced; our
 * own program's failure reason is, sanitised.
 */
export function parseInteractEnvelope(envelope: unknown): unknown {
  const value = record(envelope);
  if (!value) throw new Error("FIRECRAWL_INTERACT_ENVELOPE_INVALID");
  if (value.killed === true) throw new Error("FIRECRAWL_INTERACT_KILLED");
  if (value.success !== true || value.exitCode !== 0) {
    throw new Error("FIRECRAWL_INTERACT_EXECUTION_FAILED");
  }

  // Our program prints its result behind an owned marker; that line is the
  // authoritative result. The provider's `result` field is only a fallback:
  // node mode sometimes fills it with an unrelated structured value, which
  // used to surface downstream as EVIDENCE_INVALID. The component applies the
  // same order at the source and forwards both fields for this scan.
  let markerLine: string | undefined;
  for (const candidate of [value.output, value.stdout]) {
    if (typeof candidate !== "string") continue;
    const markerIndex = candidate.lastIndexOf(RESULT_MARKER);
    if (markerIndex < 0) continue;
    markerLine = candidate.slice(markerIndex + RESULT_MARKER.length).split(/\r?\n/, 1)[0];
    break;
  }
  let result: unknown;
  if (markerLine !== undefined) {
    try { result = JSON.parse(markerLine); } catch { result = undefined; }
  }
  let invalidStructuredResult = false;
  if (result === undefined) {
    let fallback: unknown = value.result;
    if (typeof fallback === "string") {
      try { fallback = JSON.parse(fallback); } catch { fallback = undefined; invalidStructuredResult = true; }
    }
    result = fallback;
  }
  if (result === undefined) {
    if (markerLine !== undefined || invalidStructuredResult) throw new Error("FIRECRAWL_INTERACT_RESULT_INVALID");
    throw new Error("FIRECRAWL_INTERACT_RESULT_MISSING");
  }
  if (typeof result === "function" || typeof result === "symbol") {
    throw new Error("FIRECRAWL_INTERACT_RESULT_INVALID");
  }
  const completion = record(record(result)?.[FIRECRAWL_COMPLETION_FIELD]);
  const completedValue = completion?.state === "done" ? completion.value : result;
  const sandboxError = record(record(completedValue)?.__roomscoutError);
  if (sandboxError) {
    const message = sanitisedSandboxMessage(sandboxError.message);
    // Keys only plus the sanitised message: the page snapshot stays out of the
    // log, its shape is enough to tell a login gap from a missing element.
    console.error("FIRECRAWL_INTERACT_SANDBOX_ERROR", {
      code: typeof sandboxError.code === "string" ? sandboxError.code.slice(0, 40) : SANDBOX_ERROR_CODE,
      message,
      diagKeys: keysOf(sandboxError.diag),
      partialKeys: keysOf(sandboxError.partial),
    });
    throw new Error(`FIRECRAWL_INTERACT_EXECUTION_FAILED${message ? `:${message}` : ""}`);
  }
  return result;
}
