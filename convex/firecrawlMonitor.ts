"use node";

import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import { envValue } from "./integrations/env";
import { stableFingerprint } from "./integrations/fingerprints";
import {
  buildDesiredMonitor,
  monitorConfigFingerprint,
  monitorMatchesDesired,
} from "./integrations/monitorReconciliation";
import { extractSourceEntriesFromSnapshot } from "./integrations/sourceEntryExtraction";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Firecrawl monitor error";
}

export const reconcileNativeMonitors = internalAction({
  args: {},
  returns: v.object({
    considered: v.number(),
    created: v.number(),
    updated: v.number(),
    unchanged: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx): Promise<{
    considered: number;
    created: number;
    updated: number;
    unchanged: number;
    failed: number;
  }> => {
    if (envValue("FIRECRAWL_MONITORS_ENABLED") !== "true") {
      return { considered: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
    }
    const apiKey = envValue("FIRECRAWL_API_KEY");
    const webhookUrl = envValue("FIRECRAWL_WEBHOOK_URL");
    const webhookBearer = envValue("FIRECRAWL_MONITOR_WEBHOOK_BEARER");
    if (!apiKey || !webhookUrl || !webhookBearer) {
      return { considered: 0, created: 0, updated: 0, unchanged: 0, failed: 0 };
    }

    const candidates = await ctx.runQuery(
      internal.firecrawl.listMonitorCandidates,
      {},
    );
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const candidate of candidates) {
      const desired = buildDesiredMonitor({
        candidate,
        webhookUrl,
        webhookBearer,
      });
      const fingerprint = monitorConfigFingerprint(desired, candidate.paused);
      try {
        if (!candidate.providerMonitorId) {
          const monitor = await firecrawl.createMonitor(ctx, desired);
          if (candidate.paused) {
            await firecrawl.updateMonitor(ctx, monitor.id, { status: "paused" });
          }
          await ctx.runMutation(
            internal.firecrawl.saveMonitorReconciliation,
            {
              sourceTargetId: candidate.targetId,
              providerMonitorId: monitor.id,
              providerTargetId: monitor.targets[0]?.id,
              state: candidate.paused ? "paused" : "active",
              configFingerprint: fingerprint,
            },
          );
          created += 1;
          continue;
        }

        const current = await firecrawl.getMonitor(ctx, candidate.providerMonitorId);
        if (
          monitorMatchesDesired(
            current,
            fingerprint,
            candidate.storedFingerprint,
            candidate.paused,
          )
        ) {
          await ctx.runMutation(
            internal.firecrawl.saveMonitorReconciliation,
            {
              sourceTargetId: candidate.targetId,
              providerMonitorId: current.id,
              providerTargetId: current.targets[0]?.id,
              state: candidate.paused ? "paused" : "active",
              configFingerprint: fingerprint,
            },
          );
          unchanged += 1;
          continue;
        }

        const monitor = await firecrawl.updateMonitor(ctx, current.id, {
          name: desired.name,
          status: candidate.paused ? "paused" : "active",
          schedule: desired.schedule,
          webhook: desired.webhook,
          targets: desired.targets,
          retentionDays: desired.retentionDays,
          goal: desired.goal,
          judgeEnabled: desired.judgeEnabled,
        });
        await ctx.runMutation(internal.firecrawl.saveMonitorReconciliation, {
          sourceTargetId: candidate.targetId,
          providerMonitorId: monitor.id,
          providerTargetId: monitor.targets[0]?.id,
          state: candidate.paused ? "paused" : "active",
          configFingerprint: fingerprint,
        });
        updated += 1;
      } catch (error) {
        failed += 1;
        await ctx.runMutation(internal.firecrawl.recordMonitorFailure, {
          sourceTargetId: candidate.targetId,
          error: errorMessage(error),
        });
      }
    }

    return {
      considered: candidates.length,
      created,
      updated,
      unchanged,
      failed,
    };
  },
});

export const reconcileMonitorCheck = internalAction({
  args: {
    sourceTargetId: v.id("sourceTargets"),
    providerMonitorId: v.string(),
    providerCheckId: v.string(),
  },
  returns: v.object({
    pages: v.number(),
    entries: v.number(),
    queuedDetails: v.number(),
  }),
  handler: async (ctx, args): Promise<{
    pages: number;
    entries: number;
    queuedDetails: number;
  }> => {
    const apiKey = envValue("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return { pages: 0, entries: 0, queuedDetails: 0 };
    }
    const context = await ctx.runQuery(
      internal.ingestion.getEntryIngestionContext,
      { sourceTargetId: args.sourceTargetId },
    );
    if (!context?.sourceActive) {
      return { pages: 0, entries: 0, queuedDetails: 0 };
    }

    let skip = 0;
    let pageCount = 0;
    let entryCount = 0;
    let queuedDetails = 0;
    let checkStatus = "completed";
    let checkError: string | undefined;

    try {
      for (let batch = 0; batch < 10; batch += 1) {
        const check = await firecrawl.getMonitorCheck(
          ctx,
          args.providerMonitorId,
          args.providerCheckId,
          { limit: 100, skip },
        );
        checkStatus = check.status;
        checkError = check.error ?? undefined;
        if (check.pages.length === 0) {
          break;
        }
        for (const page of check.pages) {
          pageCount += 1;
          const supportedStatus =
            page.status === "new" ||
            page.status === "same" ||
            page.status === "changed" ||
            page.status === "removed"
              ? page.status
              : undefined;
          const receipt = await ctx.runMutation(
            internal.ingestion.recordFirecrawlEvent,
            {
              // v1 used only the inline monitor snapshot. Current Firecrawl
              // checks may instead reference the completed scrape artifact,
              // so version this receipt to let those previously ignored pages
              // be reconciled once under the corrected contract.
              providerEventId: `monitor-check:${args.providerCheckId}:page:${page.id}:artifact:v1`,
              sourceTargetId: args.sourceTargetId,
              eventType: "monitor.check.page",
              payloadHash: stableFingerprint(
                JSON.stringify({
                  id: page.id,
                  url: page.url,
                  status: page.status,
                  currentScrapeId: page.currentScrapeId,
                }),
              ),
              changeStatus: supportedStatus,
              providerMonitorId: args.providerMonitorId,
              providerCheckId: args.providerCheckId,
              pageUrl: page.url,
            },
          );
          if (receipt.duplicate) {
            continue;
          }
          if (page.status === "same" || page.status === "removed") {
            await ctx.runMutation(internal.ingestion.observeMonitorPage, {
              eventId: receipt.eventId,
              sourceTargetId: args.sourceTargetId,
              changeStatus: page.status,
            });
            continue;
          }
          if (page.status === "error") {
            await ctx.runMutation(internal.ingestion.setEventStatus, {
              eventId: receipt.eventId,
              status: "failed",
              error: page.error ?? "Monitor page check failed",
            });
            continue;
          }

          let snapshot = page.snapshot?.json;
          if (snapshot === undefined && page.currentScrapeId) {
            const scrape = await firecrawl.getMonitorScrape(
              ctx,
              page.currentScrapeId,
            );
            snapshot = scrape.json ?? scrape.changeTracking?.json;
          }
          const entries = extractSourceEntriesFromSnapshot({
            snapshot,
            pageUrl: page.url,
            defaultSide: context.defaultSide,
          });
          if (entries.length === 0) {
            await ctx.runMutation(internal.ingestion.setEventStatus, {
              eventId: receipt.eventId,
              status: "ignored",
              error: "Monitor page snapshot contained no source entries.",
            });
            continue;
          }
          const outcome = await ctx.runMutation(
            internal.ingestion.upsertSourceEntries,
            {
              eventId: receipt.eventId,
              sourceTargetId: args.sourceTargetId,
              pageUrl: page.url,
              entries,
            },
          );
          entryCount += outcome.discovered;
          queuedDetails += outcome.queuedDetails;
        }
        skip += check.pages.length;
        if (!check.next) {
          break;
        }
      }
    } catch (error) {
      checkStatus = "failed";
      checkError = errorMessage(error);
    }

    await ctx.runMutation(internal.firecrawl.recordMonitorCheck, {
      sourceTargetId: args.sourceTargetId,
      providerMonitorId: args.providerMonitorId,
      providerCheckId: args.providerCheckId,
      status: checkStatus,
      ...(checkError ? { error: checkError } : {}),
    });
    if (queuedDetails > 0) {
      await ctx.scheduler.runAfter(
        0,
        internal.firecrawlDetails.processDetailBacklog,
        {},
      );
    }
    return { pages: pageCount, entries: entryCount, queuedDetails };
  },
});
