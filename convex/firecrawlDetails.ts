"use node";

import { randomUUID } from "node:crypto";
import Firecrawl from "firecrawl";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";
import { envValue } from "./integrations/env";

export const processDetailBacklog = internalAction({
  args: {},
  returns: v.object({
    claimed: v.number(),
    succeeded: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx): Promise<{
    claimed: number;
    succeeded: number;
    failed: number;
  }> => {
    const apiKey = envValue("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return { claimed: 0, succeeded: 0, failed: 0 };
    }
    const leaseId = randomUUID();
    const jobs = await ctx.runMutation(internal.ingestion.claimDetailBacklog, {
      leaseId,
      now: Date.now(),
    });
    if (jobs.length === 0) {
      return { claimed: 0, succeeded: 0, failed: 0 };
    }

    const firecrawl = new Firecrawl({
      apiKey,
      timeoutMs: 60_000,
      maxRetries: 2,
    });
    const outcomes = await Promise.all(
      jobs.map(async (job: {
        sourceEntryId: Id<"sourceEntries">;
        sourceTargetId: Id<"sourceTargets">;
        detailUrl: string;
        leaseId: string;
      }) => {
        try {
          const document = await firecrawl.scrape(job.detailUrl, {
            formats: ["markdown"],
            onlyMainContent: true,
            maxAge: 0,
          });
          if (!document.markdown) {
            throw new Error("Firecrawl returned no markdown for the detail page");
          }
          return await ctx.runAction(internal.ingestion.normalizeDetailDocument, {
            sourceEntryId: job.sourceEntryId,
            leaseId: job.leaseId,
            markdown: document.markdown,
          });
        } catch (error) {
          await ctx.runMutation(internal.ingestion.failDetailNormalization, {
            sourceEntryId: job.sourceEntryId,
            leaseId: job.leaseId,
            error: error instanceof Error ? error.message : "Detail scrape failed",
          });
          return false;
        }
      }),
    );
    const succeeded = outcomes.filter(Boolean).length;
    const failed = outcomes.length - succeeded;

    // A single worker owns at most two concurrent detail scrapes. Continue in
    // another invocation so the global concurrency boundary remains explicit.
    await ctx.scheduler.runAfter(
      1_000,
      internal.firecrawlDetails.processDetailBacklog,
      {},
    );
    return { claimed: jobs.length, succeeded, failed };
  },
});
