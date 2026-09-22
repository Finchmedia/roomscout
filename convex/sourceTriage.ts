/**
 * AI triage for discovered source domains.
 *
 * Discovery produces far more domains than a person will read, and the unit of
 * decision is the domain, not the search hit. This classifies each domain from
 * the evidence already stored - no page is fetched, so triage costs no
 * Firecrawl credits - and hands the verdicts to `applyTriageDecisions`.
 */

import { ConvexError, v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { generateRoomScoutObject } from "./ai";
import {
  buildTriagePrompt,
  TRIAGE_INSTRUCTIONS,
  triageBatches,
  type TriageDomain,
} from "./lib/sourceTriagePrompt";

const verdictSchema = z.object({
  verdicts: z.array(
    z.object({
      domain: z.string().min(1).max(253),
      verdict: z.enum(["promote", "skip", "unsure"]),
      kind: z.enum([
        "classifieds",
        "community",
        "marketplace",
        "directory",
        "studio_network",
        "other",
      ]),
      reason: z.string().min(1).max(200),
    }),
  ),
});

type Decision = {
  domain: string;
  verdict: "promote" | "skip" | "unsure";
  kind:
    | "classifieds"
    | "community"
    | "marketplace"
    | "directory"
    | "studio_network"
    | "other";
  reason: string;
};

export const triageCandidates = internalAction({
  args: {
    limit: v.optional(v.number()),
    batchSize: v.optional(v.number()),
    /** Model batches processed per invocation before chaining. */
    batchesPerRun: v.optional(v.number()),
    activate: v.optional(v.boolean()),
    publicDisplay: v.optional(v.boolean()),
    maxTargetsPerDomain: v.optional(v.number()),
    includeTosFlagged: v.optional(v.boolean()),
    chain: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    domainsConsidered: v.number(),
    classified: v.number(),
    promote: v.number(),
    skip: v.number(),
    unsure: v.number(),
    activated: v.number(),
    sourcesCreated: v.number(),
    targetsCreated: v.number(),
    failedBatches: v.number(),
    remaining: v.number(),
    chained: v.boolean(),
    samples: v.array(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    domainsConsidered: number;
    classified: number;
    promote: number;
    skip: number;
    unsure: number;
    activated: number;
    sourcesCreated: number;
    targetsCreated: number;
    failedBatches: number;
    remaining: number;
    chained: boolean;
    samples: string[];
  }> => {
    if (await ctx.runQuery(internal.sourcePipeline.isStopRequested, {})) {
      // A stop stays in force until an operator clears it, so a restart is
      // always deliberate rather than an accidental resume.
      throw new ConvexError({ code: "STOP_REQUESTED" });
    }
    const batchSize = Math.max(1, Math.min(40, Math.floor(args.batchSize ?? 20)));
    const batchesPerRun = Math.max(
      1,
      Math.min(20, Math.floor(args.batchesPerRun ?? 5)),
    );
    const dryRun = args.dryRun ?? false;

    const domains: TriageDomain[] = await ctx.runQuery(
      internal.sourcePipeline.listDomainsForTriage,
      {
        limit: Math.max(1, Math.min(1_000, Math.floor(args.limit ?? 1_000))),
        includeTosFlagged: args.includeTosFlagged,
      },
    );
    if (domains.length === 0) {
      return {
        domainsConsidered: 0,
        classified: 0,
        promote: 0,
        skip: 0,
        unsure: 0,
        activated: 0,
        sourcesCreated: 0,
        targetsCreated: 0,
        failedBatches: 0,
        remaining: 0,
        chained: false,
        samples: [],
      };
    }

    const batches = triageBatches(domains, batchSize).slice(0, batchesPerRun);
    let classified = 0;
    let promote = 0;
    let skip = 0;
    let unsure = 0;
    let activated = 0;
    let sourcesCreated = 0;
    let targetsCreated = 0;
    let failedBatches = 0;
    const samples: string[] = [];

    for (const batch of batches) {
      let decisions: Decision[];
      try {
        const output = await generateRoomScoutObject({
          modelRole: "utility",
          schema: verdictSchema,
          instructions: TRIAGE_INSTRUCTIONS,
          prompt: buildTriagePrompt(batch),
          timeoutMs: 120_000,
        });
        const known = new Set(batch.map((entry) => entry.domain));
        decisions = output.verdicts.filter((verdict) =>
          known.has(verdict.domain),
        );
      } catch {
        failedBatches += 1;
        continue;
      }
      classified += decisions.length;
      for (const decision of decisions) {
        if (decision.verdict === "promote") promote += 1;
        else if (decision.verdict === "skip") skip += 1;
        else unsure += 1;
        if (samples.length < 12) {
          samples.push(
            `${decision.verdict}/${decision.kind} ${decision.domain} - ${decision.reason}`,
          );
        }
      }
      if (dryRun) continue;
      const applied = await ctx.runMutation(
        internal.sourcePipeline.applyTriageDecisions,
        {
          decisions,
          activate: args.activate,
          publicDisplay: args.publicDisplay,
          maxTargetsPerDomain: args.maxTargetsPerDomain,
        },
      );
      activated += applied.activated;
      sourcesCreated += applied.sourcesCreated;
      targetsCreated += applied.targetsCreated;
    }

    const processed = batches.reduce((total, batch) => total + batch.length, 0);
    const remaining = Math.max(0, domains.length - processed);
    const stopRequested: boolean = await ctx.runQuery(
      internal.sourcePipeline.isStopRequested,
      {},
    );
    const chained =
      (args.chain ?? true) && !dryRun && remaining > 0 && !stopRequested;
    if (chained) {
      await ctx.scheduler.runAfter(
        1_000,
        internal.sourceTriage.triageCandidates,
        {
          limit: args.limit,
          batchSize,
          batchesPerRun,
          activate: args.activate,
          publicDisplay: args.publicDisplay,
          maxTargetsPerDomain: args.maxTargetsPerDomain,
          includeTosFlagged: args.includeTosFlagged,
          chain: true,
        },
      );
    }
    return {
      domainsConsidered: domains.length,
      classified,
      promote,
      skip,
      unsure,
      activated,
      sourcesCreated,
      targetsCreated,
      failedBatches,
      remaining,
      chained,
      samples,
    };
  },
});
