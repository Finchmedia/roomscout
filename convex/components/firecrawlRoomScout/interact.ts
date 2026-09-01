import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server.js";
import { firecrawlRequest } from "./api.js";
import { firecrawlId, normalizeInteractArgs } from "./contracts.js";

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
    return await firecrawlRequest(
      `/v2/scrape/${firecrawlId(args.jobId, "job_id")}/interact`,
      {
        method: "POST",
        body,
        maxRetries: args.mutating ? 0 : undefined,
      },
    );
  },
});

/** Stop an interactive browser session. Safe to call best-effort on cleanup. */
export const stop = action({
  args: { jobId: v.string() },
  returns: v.any(),
  handler: async (_ctx, args) =>
    await firecrawlRequest(
      `/v2/scrape/${firecrawlId(args.jobId, "job_id")}/interact`,
      { method: "DELETE" },
    ),
});
