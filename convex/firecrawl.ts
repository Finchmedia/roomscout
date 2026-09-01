import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  httpAction,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { envValue } from "./integrations/env";
import { stableFingerprint } from "./integrations/fingerprints";
import { parseMonitorWebhook } from "./integrations/monitorReconciliation";
import { constantTimeSecretMatches } from "./integrations/secureCompare";
import { extractSourceEntriesFromSnapshot } from "./integrations/sourceEntryExtraction";

const monitorState = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("error"),
);

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function markdownFromPayload(payload: Record<string, unknown>): string | null {
  const data = recordOf(payload.data);
  const page = recordOf(data?.page) ?? data;
  return typeof page?.markdown === "string" ? page.markdown : null;
}

export const listMonitorCandidates = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      targetId: v.id("sourceTargets"),
      sourceName: v.string(),
      url: v.string(),
      mode: v.union(
        v.literal("scrape"),
        v.literal("crawl"),
        v.literal("batch"),
      ),
      scheduleMinutes: v.number(),
      paused: v.boolean(),
      providerMonitorId: v.optional(v.string()),
      storedFingerprint: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const targets = await ctx.db.query("sourceTargets").take(100);
    const candidates = [];
    for (const target of targets) {
      const source = await ctx.db.get(target.sourceId);
      if (
        !source ||
        source.status !== "active" ||
        source.automationReview !== "approved"
      ) {
        continue;
      }
      const monitor = await ctx.db
        .query("sourceMonitors")
        .withIndex("by_source_target", (q) =>
          q.eq("sourceTargetId", target._id),
        )
        .unique();
      if (target.paused && !monitor && !target.providerMonitorId) {
        continue;
      }
      candidates.push({
        targetId: target._id,
        sourceName: source.name,
        url: target.url,
        mode: target.mode,
        scheduleMinutes: target.scheduleMinutes,
        paused: target.paused,
        providerMonitorId:
          monitor?.providerMonitorId ?? target.providerMonitorId,
        storedFingerprint: monitor?.configFingerprint,
      });
    }
    return candidates;
  },
});

export const saveMonitorReconciliation = internalMutation({
  args: {
    sourceTargetId: v.id("sourceTargets"),
    providerMonitorId: v.string(),
    providerTargetId: v.optional(v.string()),
    state: monitorState,
    configFingerprint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (!target) {
      return null;
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("sourceMonitors")
      .withIndex("by_source_target", (q) =>
        q.eq("sourceTargetId", args.sourceTargetId),
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        providerMonitorId: args.providerMonitorId,
        state: args.state,
        configFingerprint: args.configFingerprint,
        lastReconciledAt: now,
        error: undefined,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("sourceMonitors", {
        sourceTargetId: args.sourceTargetId,
        provider: "firecrawl",
        providerMonitorId: args.providerMonitorId,
        state: args.state,
        configFingerprint: args.configFingerprint,
        lastReconciledAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(target._id, {
      providerMonitorId: args.providerMonitorId,
      providerTargetId: args.providerTargetId,
      monitorStatus: args.state,
      monitorError: undefined,
      updatedAt: now,
    });
    return null;
  },
});

export const recordMonitorFailure = internalMutation({
  args: {
    sourceTargetId: v.id("sourceTargets"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (!target) {
      return null;
    }
    const now = Date.now();
    const monitor = await ctx.db
      .query("sourceMonitors")
      .withIndex("by_source_target", (q) =>
        q.eq("sourceTargetId", args.sourceTargetId),
      )
      .unique();
    if (monitor) {
      await ctx.db.patch(monitor._id, {
        state: "error",
        error: args.error.slice(0, 500),
        lastReconciledAt: now,
        updatedAt: now,
      });
    }
    await Promise.all([
      ctx.db.patch(target._id, {
        monitorStatus: "error",
        monitorError: args.error.slice(0, 500),
        updatedAt: now,
      }),
      ctx.db.patch(target.sourceId, {
        health: "degraded",
        updatedAt: now,
      }),
    ]);
    return null;
  },
});

export const recordMonitorCheck = internalMutation({
  args: {
    sourceTargetId: v.id("sourceTargets"),
    providerMonitorId: v.string(),
    providerCheckId: v.string(),
    status: v.string(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (!target) {
      return null;
    }
    const now = Date.now();
    const monitor = await ctx.db
      .query("sourceMonitors")
      .withIndex("by_source_target", (q) =>
        q.eq("sourceTargetId", args.sourceTargetId),
      )
      .unique();
    if (monitor) {
      await ctx.db.patch(monitor._id, {
        providerMonitorId: args.providerMonitorId,
        lastProviderCheckId: args.providerCheckId,
        lastCheckStatus: args.status,
        lastCheckAt: now,
        error: args.error?.slice(0, 500),
        updatedAt: now,
      });
    }
    await Promise.all([
      ctx.db.patch(target._id, {
        lastCheckId: args.providerCheckId,
        lastMonitorEventAt: now,
        updatedAt: now,
      }),
      ctx.db.patch(target.sourceId, {
        health: args.error ? "degraded" : "healthy",
        lastCheckedAt: now,
        updatedAt: now,
      }),
    ]);
    return null;
  },
});

/**
 * Kept as the cron entrypoint for compatibility. It reconciles provider
 * monitor definitions only; Firecrawl, not Convex, owns recurring checks.
 */
export const runDueTargets = internalAction({
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
    if (envValue("FIRECRAWL_MONITORS_ENABLED") !== "true") {
      return { claimed: 0, succeeded: 0, failed: 0 };
    }
    const result = await ctx.runAction(
      internal.firecrawlMonitor.reconcileNativeMonitors,
      {},
    );
    return {
      claimed: result.considered,
      succeeded: result.created + result.updated + result.unchanged,
      failed: result.failed,
    };
  },
});

export const webhook = httpAction(async (ctx, request) => {
  const bearer = envValue("FIRECRAWL_MONITOR_WEBHOOK_BEARER");
  if (!bearer) {
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  if (
    !(await constantTimeSecretMatches(
      request.headers.get("authorization"),
      `Bearer ${bearer}`,
    ))
  ) {
    return Response.json({ error: "Invalid authorization" }, { status: 401 });
  }
  const body = await request.text();
  if (body.length > 2_000_000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = recordOf(JSON.parse(body)) ?? {};
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseMonitorWebhook(payload);
  const headerTargetId = request.headers.get("x-roomscout-source-target-id");
  const receipt = await ctx.runMutation(
    internal.ingestion.recordFirecrawlEvent,
    {
      providerEventId: parsed.providerEventId,
      sourceTargetId: headerTargetId ?? parsed.sourceTargetId,
      eventType: parsed.eventType,
      payloadHash: stableFingerprint(body),
      changeStatus: parsed.changeStatus,
      providerMonitorId: parsed.providerMonitorId,
      providerCheckId: parsed.providerCheckId,
      pageUrl: parsed.pageUrl,
    },
  );
  if (receipt.duplicate) {
    return new Response(null, { status: 204 });
  }
  if (!receipt.sourceTargetId) {
    await ctx.runMutation(internal.ingestion.setEventStatus, {
      eventId: receipt.eventId,
      status: "ignored",
      error: "No recognized source target was provided.",
    });
    return new Response(null, { status: 204 });
  }

  if (parsed.eventType === "monitor.check.completed") {
    if (parsed.providerMonitorId && parsed.providerCheckId) {
      await ctx.scheduler.runAfter(
        0,
        internal.firecrawlMonitor.reconcileMonitorCheck,
        {
          sourceTargetId: receipt.sourceTargetId,
          providerMonitorId: parsed.providerMonitorId,
          providerCheckId: parsed.providerCheckId,
        },
      );
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: receipt.eventId,
        status: "processed",
      });
    } else {
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: receipt.eventId,
        status: "failed",
        error: "Monitor completion event omitted monitorId or checkId.",
      });
    }
    return new Response(null, { status: 204 });
  }

  if (parsed.changeStatus === "same" || parsed.changeStatus === "removed") {
    await ctx.runMutation(internal.ingestion.observeMonitorPage, {
      eventId: receipt.eventId,
      sourceTargetId: receipt.sourceTargetId,
      changeStatus: parsed.changeStatus,
    });
    return new Response(null, { status: 204 });
  }

  if (parsed.changeStatus === "new" || parsed.changeStatus === "changed") {
    const context = await ctx.runQuery(
      internal.ingestion.getEntryIngestionContext,
      { sourceTargetId: receipt.sourceTargetId },
    );
    if (!context?.sourceActive) {
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: receipt.eventId,
        status: "ignored",
        error: "Source is unavailable or inactive.",
      });
      return new Response(null, { status: 204 });
    }
    const pageUrl = parsed.pageUrl ?? "";
    const entries = extractSourceEntriesFromSnapshot({
      snapshot: parsed.snapshot,
      pageUrl,
      defaultSide: context.defaultSide,
    });
    if (entries.length > 0) {
      const outcome = await ctx.runMutation(
        internal.ingestion.upsertSourceEntries,
        {
          eventId: receipt.eventId,
          sourceTargetId: receipt.sourceTargetId,
          pageUrl,
          entries,
        },
      );
      if (outcome.queuedDetails > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.firecrawlDetails.processDetailBacklog,
          {},
        );
      }
      return new Response(null, { status: 204 });
    }

    const markdown = markdownFromPayload(payload);
    if (markdown && pageUrl) {
      const outcome = await ctx.runAction(internal.ingestion.ingestPageDocument, {
        eventId: receipt.eventId,
        sourceTargetId: receipt.sourceTargetId,
        pageUrl,
        markdown,
      });
      if (outcome.queuedDetails > 0) {
        await ctx.scheduler.runAfter(
          0,
          internal.firecrawlDetails.processDetailBacklog,
          {},
        );
      }
      return new Response(null, { status: 204 });
    }

    if (parsed.providerMonitorId && parsed.providerCheckId) {
      await ctx.scheduler.runAfter(
        0,
        internal.firecrawlMonitor.reconcileMonitorCheck,
        {
          sourceTargetId: receipt.sourceTargetId,
          providerMonitorId: parsed.providerMonitorId,
          providerCheckId: parsed.providerCheckId,
        },
      );
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: receipt.eventId,
        status: "processed",
      });
      return new Response(null, { status: 204 });
    }
  }

  await ctx.runMutation(internal.ingestion.setEventStatus, {
    eventId: receipt.eventId,
    status: "ignored",
    error: "Webhook contained no actionable monitor page payload.",
  });
  return new Response(null, { status: 204 });
});
