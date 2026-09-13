import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server.js";
import { firecrawlRequest } from "./api.js";
import { firecrawlId, normalizeInteractArgs } from "./contracts.js";

const RESULT_MARKER = "__ROOMSCOUT_RESULT__";

function safeMarkerResult(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const markerIndex = value.lastIndexOf(RESULT_MARKER);
  if (markerIndex < 0) return undefined;
  return value.slice(markerIndex + RESULT_MARKER.length).split(/\r?\n/, 1)[0];
}

function safeNativeResult(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    JSON.parse(value);
    return value;
  } catch {
    return undefined;
  }
}

function safeInteractEnvelope(value: Record<string, any>) {
  const result = safeNativeResult(value.result) ?? safeMarkerResult(value.output) ?? safeMarkerResult(value.stdout);
  return {
    success: value.success === true,
    ...(result !== undefined ? { result } : {}),
    ...(typeof value.exitCode === "number" ? { exitCode: value.exitCode } : {}),
    ...(typeof value.killed === "boolean" ? { killed: value.killed } : {}),
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

/** Stop an interactive browser session. Safe to call best-effort on cleanup. */
export const stop = action({
  args: { jobId: v.string(), requestTimeoutMs: v.optional(v.number()) },
  returns: v.any(),
  handler: async (_ctx, args) => {
    try {
      return await firecrawlRequest(
        `/v2/scrape/${firecrawlId(args.jobId, "job_id")}/interact`,
        { method: "DELETE", requestTimeoutMs: args.requestTimeoutMs, maxRetries: 0 },
      );
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "status" in error.data && error.data.status === 404) {
        return { success: true, alreadyStopped: true };
      }
      throw error;
    }
  },
});
