import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server.js";
import { firecrawlRequest } from "./api.js";
import { firecrawlId, normalizeInteractArgs } from "./contracts.js";

function safeInteractEnvelope(value: Record<string, any>) {
  return {
    success: value.success === true,
    ...(value.result !== undefined ? { result: value.result } : {}),
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
  handler: async (_ctx, args) =>
    await firecrawlRequest(
      `/v2/scrape/${firecrawlId(args.jobId, "job_id")}/interact`,
      { method: "DELETE", requestTimeoutMs: args.requestTimeoutMs },
    ),
});
