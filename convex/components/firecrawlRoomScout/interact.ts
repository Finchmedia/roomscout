import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server.js";
import { firecrawlRequest } from "./api.js";
import { firecrawlId, normalizeInteractArgs } from "./contracts.js";

const RESULT_MARKER = "__ROOMSCOUT_RESULT__";
/**
 * How much of `output`/`stdout` travels back to the caller. Enough for the app
 * layer to run its own marker scan and to keep a failing program's diagnostic
 * tail, short enough that a runaway log cannot dominate the response.
 */
const DIAGNOSTIC_TAIL_CHARS = 2_000;

/**
 * The line our own program prints behind an owned marker. This is the
 * authoritative result: Firecrawl's node runtime sometimes fills `result` with
 * an unrelated structured value, which used to win here and surfaced
 * downstream as EVIDENCE_INVALID.
 */
function markerResult(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const markerIndex = value.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) return undefined;
  const line = value.slice(markerIndex + RESULT_MARKER.length).split(/\r?\n/, 1)[0];
  return line === undefined || line.length === 0 ? undefined : line;
}

/** Provider fallback: a JSON string stays a string, a structured value passes through. */
function nativeResult(value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return value;
  try {
    JSON.parse(value);
    return value;
  } catch {
    return undefined;
  }
}

/** Shape only, never content: what the provider returned instead of our line. */
function describeShape(value: unknown): { type: string; keys?: string[] } {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) return { type: "array" };
  if (typeof value === "object") {
    return { type: "object", keys: Object.keys(value as object).slice(0, 12) };
  }
  return { type: typeof value };
}

function diagnosticTail(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0
    ? value.slice(-DIAGNOSTIC_TAIL_CHARS)
    : undefined;
}

function safeInteractEnvelope(value: Record<string, any>) {
  const marker = markerResult(value.output) ?? markerResult(value.stdout);
  const fallback = marker === undefined ? nativeResult(value.result) : undefined;
  const result = marker ?? fallback;
  if (marker === undefined && typeof fallback !== "string") {
    console.error("FIRECRAWL_INTERACT_RESULT_SHAPE", {
      marker: false,
      ...describeShape(value.result),
    });
  }
  const output = diagnosticTail(value.output);
  const stdout = diagnosticTail(value.stdout);
  return {
    success: value.success === true,
    ...(result !== undefined ? { result } : {}),
    ...(typeof value.exitCode === "number" ? { exitCode: value.exitCode } : {}),
    ...(typeof value.killed === "boolean" ? { killed: value.killed } : {}),
    // Forwarded so the app-layer parser can scan for the marker itself and so a
    // failing program's diagnostics survive the component boundary.
    ...(output !== undefined ? { output } : {}),
    ...(stdout !== undefined ? { stdout } : {}),
    ...(typeof value.liveViewUrl === "string"
      ? { liveViewUrl: value.liveViewUrl }
      : {}),
    ...(typeof value.interactiveLiveViewUrl === "string"
      ? { interactiveLiveViewUrl: value.interactiveLiveViewUrl }
      : {}),
  };
}

/**
 * Run code or a prompt in a scrape browser session. `mutating` must be true
 * for programs that can click or submit; those requests are never retried.
 */
export const execute = action({
  args: {
    jobId: v.string(),
    code: v.optional(v.string()),
    prompt: v.optional(v.string()),
    language: v.optional(
      v.union(v.literal("node"), v.literal("python"), v.literal("bash")),
    ),
    timeout: v.optional(v.number()),
    mutating: v.boolean(),
    allowUnsuccessfulBody: v.optional(v.boolean()),
    requestTimeoutMs: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    let body: ReturnType<typeof normalizeInteractArgs>;
    try {
      body = normalizeInteractArgs(args);
    } catch (error) {
      throw new ConvexError({
        code: "firecrawl_invalid_interact_input",
        message: error instanceof Error ? error.message : "Invalid Interact input",
      });
    }
    const envelope = await firecrawlRequest(
      `/v2/scrape/${firecrawlId(args.jobId, "job_id")}/interact`,
      {
        method: "POST",
        body,
        maxRetries: args.mutating ? 0 : undefined,
        retryConflict: !args.mutating,
        allowUnsuccessfulBody: args.allowUnsuccessfulBody === true,
        requestTimeoutMs: args.requestTimeoutMs,
      },
    );
    return safeInteractEnvelope(envelope);
  },
});

/**
 * Stop an interactive browser session. Safe to call best-effort on cleanup.
 * DELETE is idempotent (a stopped session answers 404), so transient failures
 * and rate-limit windows are retried within the request budget: an unstopped
 * session keeps its profile write lock and a concurrency slot for its whole TTL.
 */
export const stop = action({
  args: { jobId: v.string(), requestTimeoutMs: v.optional(v.number()) },
  returns: v.any(),
  handler: async (_ctx, args) => {
    try {
      return await firecrawlRequest(
        `/v2/scrape/${firecrawlId(args.jobId, "job_id")}/interact`,
        { method: "DELETE", requestTimeoutMs: args.requestTimeoutMs, maxRetries: 3 },
      );
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "status" in error.data && error.data.status === 404) {
        return { success: true, alreadyStopped: true };
      }
      throw error;
    }
  },
});
