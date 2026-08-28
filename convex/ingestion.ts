import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { generateRoomScoutObject } from "./ai";

const changeStatus = v.union(
  v.literal("new"),
  v.literal("same"),
  v.literal("changed"),
  v.literal("removed"),
);

const arrangement = v.union(
  v.literal("permanent"),
  v.literal("shared"),
  v.literal("hourly"),
  v.literal("unknown"),
);

export const recordFirecrawlEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    sourceTargetId: v.optional(v.string()),
    eventType: v.string(),
    payloadHash: v.string(),
    changeStatus: v.optional(changeStatus),
  },
  returns: v.object({
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.optional(v.id("sourceTargets")),
    duplicate: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ingestionEvents")
      .withIndex("by_provider_and_provider_event_id", (q) =>
        q
          .eq("provider", "firecrawl")
          .eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existing !== null) {
      return {
        eventId: existing._id,
        sourceTargetId: existing.sourceTargetId,
        duplicate: true,
      };
    }
    const sourceTargetId = args.sourceTargetId
      ? (ctx.db.normalizeId("sourceTargets", args.sourceTargetId) ?? undefined)
      : undefined;
    const eventId = await ctx.db.insert("ingestionEvents", {
      provider: "firecrawl",
      providerEventId: args.providerEventId,
      sourceTargetId,
      eventType: args.eventType,
      status: "received",
      payloadHash: args.payloadHash,
      changeStatus: args.changeStatus,
      receivedAt: Date.now(),
    });
    return { eventId, sourceTargetId, duplicate: false };
  },
});

export const setEventStatus = internalMutation({
  args: {
    eventId: v.id("ingestionEvents"),
    status: v.union(
      v.literal("processing"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("ignored"),
    ),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (event === null) {
      return null;
    }
    if (
      event.status === "processed" ||
      event.status === "ignored" ||
      event.status === "failed"
    ) {
      return null;
    }
    await ctx.db.patch(event._id, {
      status: args.status,
      processedAt:
        args.status === "processing" ? undefined : Date.now(),
      error: args.error?.slice(0, 500),
    });
    return null;
  },
});

export const getNormalizationContext = internalQuery({
  args: {
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.id("sourceTargets"),
  },
  returns: v.union(
    v.object({
      sourceId: v.id("sources"),
      sourceName: v.string(),
      side: v.union(v.literal("supply"), v.literal("demand")),
      sourceActive: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const [event, target] = await Promise.all([
      ctx.db.get(args.eventId),
      ctx.db.get(args.sourceTargetId),
    ]);
    if (
      event === null ||
      target === null ||
      event.sourceTargetId !== target._id ||
      (event.status !== "received" && event.status !== "processing")
    ) {
      return null;
    }
    const source = await ctx.db.get(target.sourceId);
    if (source === null) {
      return null;
    }
    return {
      sourceId: source._id,
      sourceName: source.name,
      side: source.side,
      sourceActive: source.status === "active",
    };
  },
});

export const upsertNormalizedSignal = internalMutation({
  args: {
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.id("sourceTargets"),
    sourceUrl: v.string(),
    sourceTitle: v.string(),
    excerpt: v.string(),
    fingerprint: v.string(),
    title: v.string(),
    city: v.string(),
    district: v.optional(v.string()),
    summary: v.string(),
    arrangement,
    priceEur: v.optional(v.number()),
    pricePeriod: v.optional(
      v.union(v.literal("hour"), v.literal("month"), v.literal("unknown")),
    ),
    requirements: v.array(v.string()),
    unknowns: v.array(v.string()),
  },
  returns: v.union(v.id("signals"), v.null()),
  handler: async (ctx, args) => {
    const [event, target] = await Promise.all([
      ctx.db.get(args.eventId),
      ctx.db.get(args.sourceTargetId),
    ]);
    if (
      event === null ||
      target === null ||
      event.sourceTargetId !== target._id ||
      (event.status !== "received" && event.status !== "processing")
    ) {
      return null;
    }
    const source = await ctx.db.get(target.sourceId);
    if (source === null || source.status !== "active") {
      await ctx.db.patch(event._id, {
        status: "ignored",
        processedAt: Date.now(),
        error: "Source is not active.",
      });
      return null;
    }

    const now = Date.now();
    const existingEvidence = await ctx.db
      .query("signalEvidence")
      .withIndex("by_fingerprint", (q) =>
        q.eq("fingerprint", args.fingerprint),
      )
      .first();
    let signalId;
    if (existingEvidence !== null) {
      signalId = existingEvidence.signalId;
      const signal = await ctx.db.get(existingEvidence.signalId);
      if (signal !== null) {
        await ctx.db.patch(signal._id, {
          title: args.title,
          city: args.city,
          district: args.district,
          summary: args.summary,
          arrangement: args.arrangement,
          priceEur: args.priceEur,
          pricePeriod: args.pricePeriod,
          requirements: args.requirements,
          unknowns: args.unknowns,
          status: "published",
          lastSeenAt: now,
          publishedAt: signal.publishedAt ?? now,
        });
        await ctx.db.patch(existingEvidence._id, {
          sourceUrl: args.sourceUrl,
          sourceTitle: args.sourceTitle,
          excerpt: args.excerpt,
          observedAt: now,
        });
      }
    } else {
      signalId = await ctx.db.insert("signals", {
        side: source.side,
        title: args.title,
        city: args.city,
        district: args.district,
        summary: args.summary,
        arrangement: args.arrangement,
        priceEur: args.priceEur,
        pricePeriod: args.pricePeriod,
        requirements: args.requirements,
        unknowns: args.unknowns,
        status: "published",
        verification: "observed",
        sourceCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        publishedAt: now,
      });
      await ctx.db.insert("signalEvidence", {
        signalId,
        sourceId: source._id,
        sourceTargetId: target._id,
        sourceUrl: args.sourceUrl,
        sourceTitle: args.sourceTitle,
        excerpt: args.excerpt,
        fingerprint: args.fingerprint,
        observedAt: now,
      });
    }

    await Promise.all([
      ctx.db.patch(event._id, {
        status: "processed",
        processedAt: now,
        error: undefined,
      }),
      ctx.db.patch(target._id, {
        lastChangeStatus: event.changeStatus,
        lastRunAt: now,
        updatedAt: now,
      }),
      ctx.db.patch(source._id, {
        health: "healthy",
        lastCheckedAt: now,
        updatedAt: now,
      }),
    ]);
    return signalId ?? null;
  },
});

export const observeTrackedPage = internalMutation({
  args: {
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.id("sourceTargets"),
    fingerprint: v.string(),
    changeStatus: v.union(v.literal("same"), v.literal("removed")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [event, target] = await Promise.all([
      ctx.db.get(args.eventId),
      ctx.db.get(args.sourceTargetId),
    ]);
    if (
      event === null ||
      target === null ||
      event.sourceTargetId !== target._id ||
      event.status !== "received"
    ) {
      return null;
    }
    const source = await ctx.db.get(target.sourceId);
    const evidence = await ctx.db
      .query("signalEvidence")
      .withIndex("by_fingerprint", (q) =>
        q.eq("fingerprint", args.fingerprint),
      )
      .first();
    const now = Date.now();
    if (evidence !== null) {
      const signal = await ctx.db.get(evidence.signalId);
      if (signal !== null) {
        await ctx.db.patch(signal._id, {
          status:
            args.changeStatus === "removed" ? "stale" : "published",
          lastSeenAt:
            args.changeStatus === "same" ? now : signal.lastSeenAt,
        });
      }
      await ctx.db.patch(evidence._id, { observedAt: now });
    }
    await Promise.all([
      ctx.db.patch(event._id, { status: "processed", processedAt: now }),
      ctx.db.patch(target._id, {
        lastChangeStatus: args.changeStatus,
        lastRunAt: now,
        updatedAt: now,
      }),
      ...(source
        ? [
            ctx.db.patch(source._id, {
              health: "healthy" as const,
              lastCheckedAt: now,
              updatedAt: now,
            }),
          ]
        : []),
    ]);
    return null;
  },
});

export const normalizeDocument = internalAction({
  args: {
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.id("sourceTargets"),
    sourceUrl: v.string(),
    sourceTitle: v.string(),
    markdown: v.string(),
    fingerprint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.ingestion.getNormalizationContext,
      {
        eventId: args.eventId,
        sourceTargetId: args.sourceTargetId,
      },
    );
    if (context === null || !context.sourceActive) {
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: args.eventId,
        status: "ignored",
        error: "Source is unavailable or inactive.",
      });
      return null;
    }
    await ctx.runMutation(internal.ingestion.setEventStatus, {
      eventId: args.eventId,
      status: "processing",
    });

    try {
      const output = await generateRoomScoutObject({
        schema: z.object({
          title: z.string().min(1).max(300),
          city: z.string().min(1).max(200),
          district: z.string().max(200).nullable(),
          summary: z.string().min(1).max(1_500),
          arrangement: z.enum([
            "permanent",
            "shared",
            "hourly",
            "unknown",
          ]),
          priceEur: z.number().nonnegative().nullable(),
          pricePeriod: z.enum(["hour", "month", "unknown"]).nullable(),
          requirements: z.array(z.string().max(300)).max(30),
          unknowns: z.array(z.string().max(300)).max(30),
        }),
        instructions: `Normalize one public rehearsal-room ${context.side} signal from ${context.sourceName}. Use only explicit evidence. Never infer availability, price, location, contact details, or verification. Use "Unknown" for city only when the source does not state a city. Use null for district, priceEur, or pricePeriod when the source does not state them, and list important missing fields in unknowns.`,
        prompt: args.markdown.slice(0, 20_000),
      });
      const { district, priceEur, pricePeriod, ...requiredOutput } = output;
      await ctx.runMutation(internal.ingestion.upsertNormalizedSignal, {
        eventId: args.eventId,
        sourceTargetId: args.sourceTargetId,
        sourceUrl: args.sourceUrl,
        sourceTitle: args.sourceTitle,
        excerpt: args.markdown.replace(/\s+/g, " ").slice(0, 1_000),
        fingerprint: args.fingerprint,
        ...requiredOutput,
        ...(district === null ? {} : { district }),
        ...(priceEur === null ? {} : { priceEur }),
        ...(pricePeriod === null ? {} : { pricePeriod }),
      });
    } catch (error) {
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: args.eventId,
        status: "failed",
        error: error instanceof Error ? error.message : "Normalization failed",
      });
    }
    return null;
  },
});

export const markStaleSignals = internalMutation({
  args: { maxAgeMs: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit), 100));
    const cutoff = Date.now() - Math.max(0, args.maxAgeMs);
    const signals = await ctx.db
      .query("signals")
      .withIndex("by_status_and_last_seen_at", (q) =>
        q.eq("status", "published").lt("lastSeenAt", cutoff),
      )
      .take(limit);
    await Promise.all(
      signals.map((signal) => ctx.db.patch(signal._id, { status: "stale" })),
    );
    return signals.length;
  },
});
