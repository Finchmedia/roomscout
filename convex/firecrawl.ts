import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  httpAction,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { stableFingerprint } from "./integrations/fingerprints";
import { envValue } from "./integrations/env";

const changeStatus = v.union(
  v.literal("new"),
  v.literal("same"),
  v.literal("changed"),
  v.literal("removed"),
);

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseChangeStatus(
  value: unknown,
): "new" | "same" | "changed" | "removed" | undefined {
  return value === "new" ||
    value === "same" ||
    value === "changed" ||
    value === "removed"
    ? value
    : undefined;
}

export const claimDueTargets = internalMutation({
  args: { now: v.number(), limit: v.number() },
  returns: v.array(
    v.object({
      targetId: v.id("sourceTargets"),
      sourceId: v.id("sources"),
      url: v.string(),
      mode: v.union(
        v.literal("scrape"),
        v.literal("crawl"),
        v.literal("batch"),
      ),
      changeTrackingTag: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const targets = await ctx.db
      .query("sourceTargets")
      .withIndex("by_paused_and_next_run_at", (q) =>
        q.eq("paused", false).lte("nextRunAt", args.now),
      )
      .take(Math.max(1, Math.min(Math.floor(args.limit), 10)));
    const claimed = [];
    for (const target of targets) {
      const source = await ctx.db.get(target.sourceId);
      if (source?.status !== "active") {
        continue;
      }
      await ctx.db.patch(target._id, {
        nextRunAt: args.now + Math.max(5, target.scheduleMinutes) * 60_000,
        lastRunAt: args.now,
        updatedAt: args.now,
      });
      claimed.push({
        targetId: target._id,
        sourceId: target.sourceId,
        url: target.url,
        mode: target.mode,
        changeTrackingTag: target.changeTrackingTag,
      });
    }
    return claimed;
  },
});

export const recordTargetOutcome = internalMutation({
  args: {
    targetId: v.id("sourceTargets"),
    changeStatus: v.optional(changeStatus),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.targetId);
    if (target === null) {
      return null;
    }
    const now = Date.now();
    await ctx.db.patch(target._id, {
      lastChangeStatus: args.changeStatus,
      lastRunAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(target.sourceId, {
      health: args.error ? "degraded" : "healthy",
      lastCheckedAt: now,
      updatedAt: now,
    });
    return null;
  },
});

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
    const apiKey = envValue("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return { claimed: 0, succeeded: 0, failed: 0 };
    }
    const targets: Array<{
      targetId: Id<"sourceTargets">;
      sourceId: Id<"sources">;
      url: string;
      mode: "scrape" | "crawl" | "batch";
      changeTrackingTag: string;
    }> = await ctx.runMutation(internal.firecrawl.claimDueTargets, {
      now: Date.now(),
      limit: 5,
    });
    let succeeded = 0;
    let failed = 0;

    for (const target of targets) {
      if (target.mode !== "scrape") {
        failed += 1;
        await ctx.runMutation(internal.firecrawl.recordTargetOutcome, {
          targetId: target.targetId,
          error: `${target.mode} targets are not enabled in the MVP scheduler.`,
        });
        continue;
      }
      const runStartedAt = Date.now();
      try {
        const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: target.url,
            formats: [
              "markdown",
              { type: "changeTracking", tag: target.changeTrackingTag },
            ],
            onlyMainContent: true,
          }),
        });
        if (!response.ok) {
          throw new Error(`Firecrawl scrape failed with status ${response.status}`);
        }
        const responsePayload = recordOf(await response.json());
        const data = recordOf(responsePayload?.data);
        if (!data) {
          throw new Error("Firecrawl response did not include a data object");
        }
        const tracking = recordOf(data.changeTracking);
        const status = parseChangeStatus(tracking?.changeStatus);
        const metadata = recordOf(data.metadata);
        const eventId =
          stringValue(metadata?.scrapeId) ??
          `scheduled:${target.targetId}:${runStartedAt}`;
        const receipt = await ctx.runMutation(
          internal.ingestion.recordFirecrawlEvent,
          {
            providerEventId: eventId,
            sourceTargetId: target.targetId,
            eventType: "scheduled.scrape",
            payloadHash: stableFingerprint(JSON.stringify(data)),
            changeStatus: status,
          },
        );
        if (!receipt.duplicate && receipt.sourceTargetId) {
          const markdown = stringValue(data.markdown) ?? "";
          if ((status === "new" || status === "changed") && markdown) {
            await ctx.scheduler.runAfter(
              0,
              internal.ingestion.normalizeDocument,
              {
                eventId: receipt.eventId,
                sourceTargetId: receipt.sourceTargetId,
                sourceUrl:
                  stringValue(metadata?.url) ??
                  stringValue(metadata?.sourceURL) ??
                  target.url,
                sourceTitle: stringValue(metadata?.title) ?? target.url,
                markdown,
                fingerprint: stableFingerprint(
                  `${target.targetId}\n${
                    stringValue(metadata?.url) ??
                    stringValue(metadata?.sourceURL) ??
                    target.url
                  }`,
                ),
              },
            );
          } else if (status === "same" || status === "removed") {
            await ctx.runMutation(internal.ingestion.observeTrackedPage, {
              eventId: receipt.eventId,
              sourceTargetId: receipt.sourceTargetId,
              changeStatus: status,
              fingerprint: stableFingerprint(
                `${target.targetId}\n${
                  stringValue(metadata?.url) ??
                  stringValue(metadata?.sourceURL) ??
                  target.url
                }`,
              ),
            });
          } else {
            await ctx.runMutation(internal.ingestion.setEventStatus, {
              eventId: receipt.eventId,
              status: "ignored",
            });
          }
        }
        await ctx.runMutation(internal.firecrawl.recordTargetOutcome, {
          targetId: target.targetId,
          changeStatus: status,
        });
        succeeded += 1;
      } catch (error) {
        failed += 1;
        await ctx.runMutation(internal.firecrawl.recordTargetOutcome, {
          targetId: target.targetId,
          error: error instanceof Error ? error.message : "Firecrawl run failed",
        });
      }
    }
    return { claimed: targets.length, succeeded, failed };
  },
});

export const webhook = httpAction(async (ctx, request) => {
  const secret = envValue("FIRECRAWL_WEBHOOK_SECRET");
  if (!secret) {
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
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

  const eventType = stringValue(payload.type) ?? "unknown";
  const providerEventId = stringValue(payload.id);
  if (!providerEventId) {
    return Response.json({ error: "Missing event ID" }, { status: 400 });
  }
  const rootMetadata = recordOf(payload.metadata);
  const sourceTargetId =
    request.headers.get("x-roomscout-source-target-id") ??
    stringValue(rootMetadata?.sourceTargetId);
  const dataValue = Array.isArray(payload.data)
    ? payload.data[0]
    : payload.data;
  const data = recordOf(dataValue);
  const tracking = recordOf(data?.changeTracking);
  const status = parseChangeStatus(tracking?.changeStatus);
  const receipt = await ctx.runMutation(
    internal.ingestion.recordFirecrawlEvent,
    {
      providerEventId,
      sourceTargetId: sourceTargetId ?? undefined,
      eventType,
      payloadHash: stableFingerprint(body),
      changeStatus: status,
    },
  );
  if (receipt.duplicate) {
    return new Response(null, { status: 204 });
  }
  if (!data || !receipt.sourceTargetId) {
    await ctx.runMutation(internal.ingestion.setEventStatus, {
      eventId: receipt.eventId,
      status: "ignored",
      error: "No page data or recognized source target was provided.",
    });
    return new Response(null, { status: 204 });
  }

  const markdown = stringValue(data.markdown) ?? "";
  const metadata = recordOf(data.metadata);
  if ((status === "new" || status === "changed") && markdown) {
    const url =
      stringValue(metadata?.url) ?? stringValue(metadata?.sourceURL) ?? "";
    await ctx.scheduler.runAfter(0, internal.ingestion.normalizeDocument, {
      eventId: receipt.eventId,
      sourceTargetId: receipt.sourceTargetId,
      sourceUrl: url,
      sourceTitle: stringValue(metadata?.title) ?? url,
      markdown,
      fingerprint: stableFingerprint(`${receipt.sourceTargetId}\n${url}`),
    });
  } else if (status === "same" || status === "removed") {
    const url =
      stringValue(metadata?.url) ?? stringValue(metadata?.sourceURL) ?? "";
    await ctx.runMutation(internal.ingestion.observeTrackedPage, {
      eventId: receipt.eventId,
      sourceTargetId: receipt.sourceTargetId,
      changeStatus: status,
      fingerprint: stableFingerprint(`${receipt.sourceTargetId}\n${url}`),
    });
  } else {
    await ctx.runMutation(internal.ingestion.setEventStatus, {
      eventId: receipt.eventId,
      status: "ignored",
    });
  }
  return new Response(null, { status: 204 });
});
