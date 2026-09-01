import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { generateRoomScoutObject } from "./ai";
import { stableFingerprint } from "./integrations/fingerprints";
import { redactContactData } from "./integrations/piiRedaction";
import { delimitUntrustedData } from "./lib/privacy";
import {
  compareForCorroboration,
  verificationFromEvidence,
  type CorroborationSnapshot,
} from "./lib/corroboration";
import {
  extractSourceEntriesFromSnapshot,
  type SignalSide,
} from "./integrations/sourceEntryExtraction";

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

function signalSnapshot(
  signal: Pick<Doc<"signals">, "side" | "title" | "city" | "district" | "arrangement" | "priceEur" | "pricePeriod">,
): CorroborationSnapshot {
  return {
    side: signal.side,
    title: signal.title,
    city: signal.city,
    district: signal.district,
    arrangement: signal.arrangement,
    priceEur: signal.priceEur,
    pricePeriod: signal.pricePeriod,
  };
}

async function findCrossSourceSignal(
  ctx: MutationCtx,
  snapshot: CorroborationSnapshot,
  sourceId: Id<"sources">,
  excludeSignalId?: Id<"signals">,
): Promise<{ signalId: Id<"signals">; relation: "corroborated" | "conflicting" } | null> {
  const candidates = await ctx.db
    .query("signals")
    .withIndex("by_side_and_city_and_status", (q) =>
      q.eq("side", snapshot.side).eq("city", snapshot.city).eq("status", "published"),
    )
    .take(100);
  let best: { signalId: Id<"signals">; relation: "corroborated" | "conflicting"; score: number } | null = null;
  for (const candidate of candidates) {
    if (candidate._id === excludeSignalId) continue;
    const evidence = await ctx.db
      .query("signalEvidence")
      .withIndex("by_signal", (q) => q.eq("signalId", candidate._id))
      .take(25);
    if (!evidence.some((item) => item.sourceId !== sourceId)) continue;
    const decision = compareForCorroboration(signalSnapshot(candidate), snapshot);
    if (decision.relation === "none" || (best && best.score >= decision.score)) continue;
    best = { signalId: candidate._id, relation: decision.relation, score: decision.score };
  }
  return best ? { signalId: best.signalId, relation: best.relation } : null;
}

async function refreshSignalVerification(
  ctx: MutationCtx,
  signalId: Id<"signals">,
): Promise<void> {
  const [signal, evidence] = await Promise.all([
    ctx.db.get(signalId),
    ctx.db.query("signalEvidence").withIndex("by_signal", (q) => q.eq("signalId", signalId)).take(50),
  ]);
  if (!signal) return;
  const fallback = signalSnapshot(signal);
  const result = verificationFromEvidence(evidence.map((item) => ({
    sourceId: item.sourceId,
    side: item.side ?? fallback.side,
    title: item.title ?? item.sourceTitle ?? fallback.title,
    city: item.city ?? fallback.city,
    district: item.district,
    arrangement: item.arrangement ?? fallback.arrangement,
    priceEur: item.priceEur,
    pricePeriod: item.pricePeriod,
  })));
  await ctx.db.patch(signalId, result);
}

async function countPendingDetailsForTarget(
  ctx: MutationCtx,
  sourceTargetId: Id<"sourceTargets">,
): Promise<number> {
  const [queued, fetching] = await Promise.all([
    ctx.db
      .query("sourceEntries")
      .withIndex("by_target_and_detail_state", (q) =>
        q.eq("sourceTargetId", sourceTargetId).eq("detailState", "queued"),
      )
      .take(5),
    ctx.db
      .query("sourceEntries")
      .withIndex("by_target_and_detail_state", (q) =>
        q.eq("sourceTargetId", sourceTargetId).eq("detailState", "fetching"),
      )
      .take(5),
  ]);
  return Math.min(queued.length + fetching.length, 5);
}

function evidenceSnapshotFields(snapshot: CorroborationSnapshot) {
  return {
    side: snapshot.side,
    title: snapshot.title,
    city: snapshot.city,
    district: snapshot.district,
    arrangement: snapshot.arrangement,
    priceEur: snapshot.priceEur,
    pricePeriod: snapshot.pricePeriod,
  };
}

export const recordFirecrawlEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    sourceTargetId: v.optional(v.string()),
    eventType: v.string(),
    payloadHash: v.string(),
    changeStatus: v.optional(changeStatus),
    providerMonitorId: v.optional(v.string()),
    providerCheckId: v.optional(v.string()),
    pageUrl: v.optional(v.string()),
    entryCount: v.optional(v.number()),
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
    let sourceTargetId = args.sourceTargetId
      ? (ctx.db.normalizeId("sourceTargets", args.sourceTargetId) ?? undefined)
      : undefined;
    if (!sourceTargetId && args.providerMonitorId) {
      const monitor = await ctx.db
        .query("sourceMonitors")
        .withIndex("by_provider_monitor_id", (q) =>
          q.eq("providerMonitorId", args.providerMonitorId!),
        )
        .unique();
      sourceTargetId = monitor?.sourceTargetId;
    }
    if (!sourceTargetId && args.providerMonitorId) {
      const target = await ctx.db
        .query("sourceTargets")
        .withIndex("by_provider_monitor_id", (q) =>
          q.eq("providerMonitorId", args.providerMonitorId),
        )
        .unique();
      sourceTargetId = target?._id;
    }
    const eventId = await ctx.db.insert("ingestionEvents", {
      provider: "firecrawl",
      providerEventId: args.providerEventId,
      sourceTargetId,
      eventType: args.eventType,
      status: "received",
      payloadHash: args.payloadHash,
      changeStatus: args.changeStatus,
      providerMonitorId: args.providerMonitorId,
      providerCheckId: args.providerCheckId,
      pageUrl: args.pageUrl,
      entryCount: args.entryCount,
      retryCount: 0,
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
      side: source.side === "both" ? "supply" : source.side,
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
    const snapshot: CorroborationSnapshot = {
      side: source.side === "both" ? "supply" : source.side,
      title: args.title,
      city: args.city,
      district: args.district,
      arrangement: args.arrangement,
      priceEur: args.priceEur,
      pricePeriod: args.pricePeriod,
    };
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
          ...evidenceSnapshotFields(snapshot),
          observedAt: now,
        });
      }
    } else {
      const corroborated = await findCrossSourceSignal(ctx, snapshot, source._id);
      signalId = corroborated?.signalId ?? await ctx.db.insert("signals", {
          side: snapshot.side,
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
      if (corroborated) await ctx.db.patch(signalId, { status: "published", lastSeenAt: now });
      await ctx.db.insert("signalEvidence", {
        signalId,
        sourceId: source._id,
        sourceTargetId: target._id,
        sourceUrl: args.sourceUrl,
        sourceTitle: args.sourceTitle,
        excerpt: args.excerpt,
        fingerprint: args.fingerprint,
        ...evidenceSnapshotFields(snapshot),
        observedAt: now,
      });
    }

    if (signalId) await refreshSignalVerification(ctx, signalId);

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
        const relatedEvidence = args.changeStatus === "removed"
          ? await ctx.db.query("signalEvidence").withIndex("by_signal", (q) => q.eq("signalId", signal._id)).take(50)
          : [];
        const independentlyFresh = relatedEvidence.some((item) =>
          item.sourceId !== evidence.sourceId && item.observedAt >= now - 45 * 24 * 60 * 60 * 1_000,
        );
        await ctx.db.patch(signal._id, {
          status:
            args.changeStatus === "removed" && !independentlyFresh ? "stale" : "published",
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
        prompt: delimitUntrustedData(
          "firecrawl_detail",
          args.markdown.slice(0, 20_000),
        ),
      });
      const { district, priceEur, pricePeriod, ...requiredOutput } = output;
      const safeExcerpt = redactContactData(args.markdown).redacted.slice(0, 1_000);
      const safeOutput = {
        ...requiredOutput,
        title: redactContactData(requiredOutput.title).redacted,
        summary: redactContactData(requiredOutput.summary).redacted,
        requirements: requiredOutput.requirements.map(
          (item) => redactContactData(item).redacted,
        ),
        unknowns: requiredOutput.unknowns.map(
          (item) => redactContactData(item).redacted,
        ),
      };
      await ctx.runMutation(internal.ingestion.upsertNormalizedSignal, {
        eventId: args.eventId,
        sourceTargetId: args.sourceTargetId,
        sourceUrl: args.sourceUrl,
        sourceTitle: args.sourceTitle,
        excerpt: safeExcerpt,
        fingerprint: args.fingerprint,
        ...safeOutput,
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

const extractedEntryValidator = v.object({
  externalId: v.optional(v.string()),
  canonicalUrl: v.string(),
  detailUrl: v.string(),
  title: v.string(),
  excerpt: v.string(),
  side: v.union(v.literal("supply"), v.literal("demand")),
  city: v.optional(v.string()),
  district: v.optional(v.string()),
  sourcePublishedAt: v.optional(v.number()),
  contentFingerprint: v.string(),
  contactDataPresent: v.boolean(),
  summary: v.string(),
  arrangement,
  priceEur: v.optional(v.number()),
  pricePeriod: v.optional(
    v.union(v.literal("hour"), v.literal("month"), v.literal("unknown")),
  ),
  requirements: v.array(v.string()),
  unknowns: v.array(v.string()),
});

export const getEntryIngestionContext = internalQuery({
  args: { sourceTargetId: v.id("sourceTargets") },
  returns: v.union(
    v.object({
      sourceId: v.id("sources"),
      sourceName: v.string(),
      sourceActive: v.boolean(),
      defaultSide: v.union(v.literal("supply"), v.literal("demand")),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (!target) {
      return null;
    }
    const source = await ctx.db.get(target.sourceId);
    if (!source) {
      return null;
    }
    const defaultSide: SignalSide =
      target.sideScope === "supply" || target.sideScope === "demand"
        ? target.sideScope
        : source.side === "supply"
          ? "supply"
          : "demand";
    return {
      sourceId: source._id,
      sourceName: source.name,
      sourceActive: source.status === "active",
      defaultSide,
    };
  },
});

export const upsertSourceEntries = internalMutation({
  args: {
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.id("sourceTargets"),
    pageUrl: v.string(),
    entries: v.array(extractedEntryValidator),
  },
  returns: v.object({
    discovered: v.number(),
    queuedDetails: v.number(),
    stale: v.number(),
  }),
  handler: async (ctx, args) => {
    const [event, target] = await Promise.all([
      ctx.db.get(args.eventId),
      ctx.db.get(args.sourceTargetId),
    ]);
    if (
      !event ||
      !target ||
      event.sourceTargetId !== target._id ||
      (event.status !== "received" && event.status !== "processing")
    ) {
      return { discovered: 0, queuedDetails: 0, stale: 0 };
    }
    const source = await ctx.db.get(target.sourceId);
    if (!source || source.status !== "active") {
      await ctx.db.patch(event._id, {
        status: "ignored",
        processedAt: Date.now(),
        error: "Source is unavailable or inactive.",
      });
      return { discovered: 0, queuedDetails: 0, stale: 0 };
    }

    const now = Date.now();
    const [queued, fetching] = await Promise.all([
      ctx.db
        .query("sourceEntries")
        .withIndex("by_detail_state_and_next_attempt", (q) =>
          q.eq("detailState", "queued"),
        )
        .take(5),
      ctx.db
        .query("sourceEntries")
        .withIndex("by_detail_state_and_next_attempt", (q) =>
          q.eq("detailState", "fetching"),
        )
        .take(5),
    ]);
    let availableDetailSlots = Math.max(0, 5 - queued.length - fetching.length);
    let queuedDetails = 0;
    const observedCanonicalUrls = new Set<string>();

    for (const entry of args.entries.slice(0, 100)) {
      observedCanonicalUrls.add(entry.canonicalUrl);
      const existing = await ctx.db
        .query("sourceEntries")
        .withIndex("by_target_and_canonical_url", (q) =>
          q
            .eq("sourceTargetId", target._id)
            .eq("canonicalUrl", entry.canonicalUrl),
        )
        .unique();
      const contentChanged =
        existing?.contentFingerprint !== entry.contentFingerprint;
      const needsDetail = entry.detailUrl !== args.pageUrl;
      const canQueueDetail =
        needsDetail &&
        contentChanged &&
        availableDetailSlots > 0 &&
        existing?.detailState !== "fetching";
      const nextDetailState = canQueueDetail
        ? ("queued" as const)
        : existing?.detailState === "processed" && !contentChanged
          ? ("processed" as const)
          : needsDetail
            ? (existing?.detailState ?? "none")
            : ("none" as const);
      if (canQueueDetail) {
        queuedDetails += 1;
        availableDetailSlots -= 1;
      }

      let sourceEntryId = existing?._id;
      if (existing) {
        await ctx.db.patch(existing._id, {
          externalId: entry.externalId,
          detailUrl: entry.detailUrl,
          title: entry.title,
          excerpt: entry.excerpt,
          side: entry.side,
          city: entry.city,
          district: entry.district,
          sourcePublishedAt: entry.sourcePublishedAt,
          contentFingerprint: entry.contentFingerprint,
          status: "active",
          detailState: nextDetailState,
          nextDetailAttemptAt: canQueueDetail ? now : existing.nextDetailAttemptAt,
          detailLeaseId: canQueueDetail ? undefined : existing.detailLeaseId,
          detailLeaseExpiresAt: canQueueDetail
            ? undefined
            : existing.detailLeaseExpiresAt,
          lastSeenAt: now,
          updatedAt: now,
          error: canQueueDetail ? undefined : existing.error,
          missingSnapshots: 0,
          contactDataPresent: entry.contactDataPresent,
        });
      } else {
        sourceEntryId = await ctx.db.insert("sourceEntries", {
          sourceId: source._id,
          sourceTargetId: target._id,
          externalId: entry.externalId,
          canonicalUrl: entry.canonicalUrl,
          detailUrl: entry.detailUrl,
          title: entry.title,
          excerpt: entry.excerpt,
          side: entry.side,
          city: entry.city,
          district: entry.district,
          sourcePublishedAt: entry.sourcePublishedAt,
          contentFingerprint: entry.contentFingerprint,
          status: "active",
          detailState: nextDetailState,
          detailAttempts: 0,
          nextDetailAttemptAt: canQueueDetail ? now : undefined,
          firstSeenAt: now,
          lastSeenAt: now,
          updatedAt: now,
          missingSnapshots: 0,
          contactDataPresent: entry.contactDataPresent,
        });
      }
      if (!sourceEntryId) {
        continue;
      }

      const currentEntry = await ctx.db.get(sourceEntryId);
      let signalId = currentEntry?.signalId;
      const signalPatch = {
        side: entry.side,
        title: entry.title,
        city: entry.city ?? "Unknown",
        district: entry.district,
        summary: entry.summary,
        arrangement: entry.arrangement,
        priceEur: entry.priceEur,
        pricePeriod: entry.pricePeriod,
        requirements: entry.requirements,
        unknowns: entry.unknowns,
        status: "published" as const,
        lastSeenAt: now,
      };
      const snapshot = signalSnapshot({ ...signalPatch });
      if (signalId) {
        const signal = await ctx.db.get(signalId);
        if (signal) {
          await ctx.db.patch(signal._id, signalPatch);
        } else {
          signalId = undefined;
        }
      }
      if (!signalId) {
        const corroborated = await findCrossSourceSignal(ctx, snapshot, source._id);
        if (corroborated) {
          signalId = corroborated.signalId;
          await ctx.db.patch(signalId, { status: "published", lastSeenAt: now });
        } else {
          signalId = await ctx.db.insert("signals", {
            ...signalPatch,
            verification: "observed",
            sourceCount: 1,
            firstSeenAt: now,
            publishedAt: now,
            sourceEntryId,
          });
        }
        await ctx.db.patch(sourceEntryId, { signalId });
      }

      const evidenceFingerprint = stableFingerprint(
        `source-entry\n${target._id}\n${entry.canonicalUrl}`,
      );
      const evidence = await ctx.db
        .query("signalEvidence")
        .withIndex("by_fingerprint", (q) =>
          q.eq("fingerprint", evidenceFingerprint),
        )
        .first();
      if (evidence) {
        await ctx.db.patch(evidence._id, {
          signalId,
          sourceUrl: entry.canonicalUrl,
          sourceTitle: entry.title,
          excerpt: entry.excerpt,
          ...evidenceSnapshotFields(snapshot),
          observedAt: now,
        });
      } else {
        await ctx.db.insert("signalEvidence", {
          signalId,
          sourceId: source._id,
          sourceTargetId: target._id,
          sourceUrl: entry.canonicalUrl,
          sourceTitle: entry.title,
          excerpt: entry.excerpt,
          fingerprint: evidenceFingerprint,
          ...evidenceSnapshotFields(snapshot),
          observedAt: now,
        });
      }
      await refreshSignalVerification(ctx, signalId);
      await ctx.scheduler.runAfter(0, internal.matches.embedSignal, { signalId });
      await ctx.scheduler.runAfter(0, internal.map.geocodeSignal, { signalId });
    }

    let stale = 0;
    if (args.entries.length > 0) {
      const previousEntries = await ctx.db
        .query("sourceEntries")
        .withIndex("by_target_and_status", (q) =>
          q.eq("sourceTargetId", target._id).eq("status", "active"),
        )
        .take(500);
      for (const previous of previousEntries) {
        if (observedCanonicalUrls.has(previous.canonicalUrl)) {
          continue;
        }
        const missingSnapshots = (previous.missingSnapshots ?? 0) + 1;
        const status = missingSnapshots >= 2 ? ("stale" as const) : previous.status;
        await ctx.db.patch(previous._id, {
          missingSnapshots,
          status,
          updatedAt: now,
        });
        if (status === "stale") {
          stale += 1;
          if (previous.signalId) {
            const evidence = await ctx.db.query("signalEvidence").withIndex("by_signal", (q) =>
              q.eq("signalId", previous.signalId!),
            ).take(50);
            const independentlyFresh = evidence.some((item) =>
              item.sourceId !== previous.sourceId && item.observedAt >= now - 45 * 24 * 60 * 60 * 1_000,
            );
            if (!independentlyFresh) await ctx.db.patch(previous.signalId, { status: "stale" });
          }
        }
      }
    }

    const backlogCount = await countPendingDetailsForTarget(ctx, target._id);
    await Promise.all([
      ctx.db.patch(event._id, {
        status: "processed",
        processedAt: now,
        entryCount: args.entries.length,
        error: undefined,
      }),
      ctx.db.patch(target._id, {
        lastChangeStatus: event.changeStatus,
        lastRunAt: now,
        lastMonitorEventAt: now,
        successfulSnapshotCount: (target.successfulSnapshotCount ?? 0) + 1,
        backlogCount,
        updatedAt: now,
      }),
      ctx.db.patch(source._id, {
        health: "healthy",
        lastCheckedAt: now,
        updatedAt: now,
      }),
    ]);
    return { discovered: args.entries.length, queuedDetails, stale };
  },
});

export const ingestPageDocument = internalAction({
  args: {
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.id("sourceTargets"),
    pageUrl: v.string(),
    markdown: v.string(),
  },
  returns: v.object({ discovered: v.number(), queuedDetails: v.number() }),
  handler: async (ctx, args): Promise<{
    discovered: number;
    queuedDetails: number;
  }> => {
    const context = await ctx.runQuery(
      internal.ingestion.getEntryIngestionContext,
      { sourceTargetId: args.sourceTargetId },
    );
    if (!context?.sourceActive) {
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: args.eventId,
        status: "ignored",
        error: "Source is unavailable or inactive.",
      });
      return { discovered: 0, queuedDetails: 0 };
    }
    await ctx.runMutation(internal.ingestion.setEventStatus, {
      eventId: args.eventId,
      status: "processing",
    });
    try {
      const output: {
        entries: Array<{
          externalId: string | null;
          title: string;
          url: string;
          summary: string;
          side: "supply" | "demand";
          city: string | null;
          district: string | null;
          publishedAt: string | null;
          arrangement: "permanent" | "shared" | "hourly" | "unknown";
          priceEur: number | null;
          pricePeriod: "hour" | "month" | "unknown" | null;
          requirements: string[];
          unknowns: string[];
        }>;
      } = await generateRoomScoutObject({
        schema: z.object({
          entries: z
            .array(
              z.object({
                externalId: z.string().max(300).nullable(),
                title: z.string().min(1).max(300),
                url: z.string().min(1).max(2_000),
                summary: z.string().min(1).max(1_500),
                side: z.enum(["supply", "demand"]),
                city: z.string().max(200).nullable(),
                district: z.string().max(200).nullable(),
                publishedAt: z.string().max(100).nullable(),
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
            )
            .max(100),
        }),
        instructions: `Extract every distinct public rehearsal-room listing from ${context.sourceName}. Preserve only explicit facts. Return the listing detail URL when present, resolve no URLs yourself, never infer contact details or availability, and return an empty list if the page contains no listings.`,
        prompt: delimitUntrustedData(
          "firecrawl_index",
          args.markdown.slice(0, 50_000),
        ),
      });
      const entries = extractSourceEntriesFromSnapshot({
        snapshot: { entries: output.entries },
        pageUrl: args.pageUrl,
        defaultSide: context.defaultSide,
      });
      const result: {
        discovered: number;
        queuedDetails: number;
        stale: number;
      } = await ctx.runMutation(
        internal.ingestion.upsertSourceEntries,
        {
          eventId: args.eventId,
          sourceTargetId: args.sourceTargetId,
          pageUrl: args.pageUrl,
          entries,
        },
      );
      return {
        discovered: result.discovered,
        queuedDetails: result.queuedDetails,
      };
    } catch (error) {
      await ctx.runMutation(internal.ingestion.setEventStatus, {
        eventId: args.eventId,
        status: "failed",
        error: error instanceof Error ? error.message : "Entry extraction failed",
      });
      return { discovered: 0, queuedDetails: 0 };
    }
  },
});

export const observeMonitorPage = internalMutation({
  args: {
    eventId: v.id("ingestionEvents"),
    sourceTargetId: v.id("sourceTargets"),
    changeStatus: v.union(v.literal("same"), v.literal("removed")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const [event, target] = await Promise.all([
      ctx.db.get(args.eventId),
      ctx.db.get(args.sourceTargetId),
    ]);
    if (!event || !target || event.sourceTargetId !== target._id) {
      return 0;
    }
    const now = Date.now();
    let affected = 0;
    if (args.changeStatus === "removed") {
      const entries = await ctx.db
        .query("sourceEntries")
        .withIndex("by_target_and_status", (q) =>
          q.eq("sourceTargetId", target._id).eq("status", "active"),
        )
        .take(500);
      for (const entry of entries) {
        const missingSnapshots = (entry.missingSnapshots ?? 0) + 1;
        const stale = missingSnapshots >= 2;
        await ctx.db.patch(entry._id, {
          status: stale ? "stale" : "active",
          missingSnapshots,
          updatedAt: now,
        });
        if (stale && entry.signalId) {
          await ctx.db.patch(entry.signalId, { status: "stale" });
        }
      }
      affected = entries.length;
    }
    await Promise.all([
      ctx.db.patch(event._id, { status: "processed", processedAt: now }),
      ctx.db.patch(target._id, {
        lastChangeStatus: args.changeStatus,
        lastRunAt: now,
        lastMonitorEventAt: now,
        updatedAt: now,
      }),
    ]);
    return affected;
  },
});

export const claimDetailBacklog = internalMutation({
  args: { leaseId: v.string(), now: v.number() },
  returns: v.array(
    v.object({
      sourceEntryId: v.id("sourceEntries"),
      sourceTargetId: v.id("sourceTargets"),
      detailUrl: v.string(),
      leaseId: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const fetching = await ctx.db
      .query("sourceEntries")
      .withIndex("by_detail_state_and_next_attempt", (q) =>
        q.eq("detailState", "fetching"),
      )
      .take(20);
    for (const entry of fetching) {
      if ((entry.detailLeaseExpiresAt ?? Number.POSITIVE_INFINITY) <= args.now) {
        await ctx.db.patch(entry._id, {
          detailState: "queued",
          nextDetailAttemptAt: args.now,
          detailLeaseId: undefined,
          detailLeaseExpiresAt: undefined,
          updatedAt: args.now,
        });
      }
    }

    const activeFetching = await ctx.db
      .query("sourceEntries")
      .withIndex("by_detail_state_and_next_attempt", (q) =>
        q.eq("detailState", "fetching"),
      )
      .take(2);
    const availableConcurrency = Math.max(0, 2 - activeFetching.length);
    if (availableConcurrency === 0) {
      return [];
    }

    const candidates = await ctx.db
      .query("sourceEntries")
      .withIndex("by_detail_state_and_next_attempt", (q) =>
        q.eq("detailState", "queued").lte("nextDetailAttemptAt", args.now),
      )
      .take(availableConcurrency);
    for (const entry of candidates) {
      await ctx.db.patch(entry._id, {
        detailState: "fetching",
        detailAttempts: entry.detailAttempts + 1,
        detailLeaseId: args.leaseId,
        detailLeaseExpiresAt: args.now + 2 * 60_000,
        updatedAt: args.now,
        error: undefined,
      });
    }
    return candidates.map((entry) => ({
      sourceEntryId: entry._id,
      sourceTargetId: entry.sourceTargetId,
      detailUrl: entry.detailUrl,
      leaseId: args.leaseId,
    }));
  },
});

/** Repair/reconcile the bounded Ops backlog metric for one source target. */
export const recountTargetDetailBacklog = internalMutation({
  args: { sourceTargetId: v.id("sourceTargets") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const target = await ctx.db.get(args.sourceTargetId);
    if (!target) return 0;
    const backlogCount = await countPendingDetailsForTarget(
      ctx,
      args.sourceTargetId,
    );
    await ctx.db.patch(args.sourceTargetId, {
      backlogCount,
      updatedAt: Date.now(),
    });
    return backlogCount;
  },
});

export const getDetailNormalizationContext = internalQuery({
  args: {
    sourceEntryId: v.id("sourceEntries"),
    leaseId: v.string(),
  },
  returns: v.union(
    v.object({
      sourceTargetId: v.id("sourceTargets"),
      sourceName: v.string(),
      side: v.union(v.literal("supply"), v.literal("demand")),
      detailUrl: v.string(),
      title: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.sourceEntryId);
    if (
      !entry ||
      entry.detailState !== "fetching" ||
      entry.detailLeaseId !== args.leaseId
    ) {
      return null;
    }
    const source = await ctx.db.get(entry.sourceId);
    if (!source || source.status !== "active") {
      return null;
    }
    return {
      sourceTargetId: entry.sourceTargetId,
      sourceName: source.name,
      side: entry.side,
      detailUrl: entry.detailUrl,
      title: entry.title,
    };
  },
});

export const completeDetailNormalization = internalMutation({
  args: {
    sourceEntryId: v.id("sourceEntries"),
    leaseId: v.string(),
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
    genres: v.array(v.string()),
    instruments: v.array(v.string()),
    facets: v.array(v.object({
      namespace: v.string(),
      key: v.string(),
      value: v.string(),
      confidence: v.number(),
    })),
    contacts: v.array(v.object({
      kind: v.union(v.literal("email"), v.literal("phone"), v.literal("social"), v.literal("platform")),
      value: v.string(),
    })),
    excerpt: v.string(),
    contentFingerprint: v.string(),
    contactDataPresent: v.boolean(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.sourceEntryId);
    if (
      !entry ||
      entry.detailState !== "fetching" ||
      entry.detailLeaseId !== args.leaseId
    ) {
      return false;
    }
    const now = Date.now();
    let signalId = entry.signalId;
    const previousSignalId = signalId;
    const signalPatch = {
      side: entry.side,
      title: args.title,
      city: args.city,
      district: args.district,
      summary: args.summary,
      arrangement: args.arrangement,
      priceEur: args.priceEur,
      pricePeriod: args.pricePeriod,
      requirements: args.requirements,
      unknowns: args.unknowns,
      genres: args.genres,
      instruments: args.instruments,
      facets: args.facets,
      status: "published" as const,
      lastSeenAt: now,
    };
    const snapshot = signalSnapshot(signalPatch);
    const currentEvidence = signalId
      ? await ctx.db.query("signalEvidence").withIndex("by_signal", (q) => q.eq("signalId", signalId!)).take(25)
      : [];
    const alreadyCrossSource = currentEvidence.some((evidence) => evidence.sourceId !== entry.sourceId);
    const corroborated = alreadyCrossSource
      ? null
      : await findCrossSourceSignal(ctx, snapshot, entry.sourceId, signalId);
    if (corroborated) {
      signalId = corroborated.signalId;
      await ctx.db.patch(signalId, corroborated.relation === "corroborated"
        ? signalPatch
        : { status: "published", lastSeenAt: now });
    } else if (signalId) {
      const signal = await ctx.db.get(signalId);
      if (signal) {
        await ctx.db.patch(signal._id, signalPatch);
      } else {
        signalId = undefined;
      }
    }
    if (!signalId) {
      signalId = await ctx.db.insert("signals", {
        ...signalPatch,
        verification: "observed",
        sourceCount: 1,
        firstSeenAt: now,
        publishedAt: now,
        sourceEntryId: entry._id,
      });
    }
    if (previousSignalId && previousSignalId !== signalId) {
      await ctx.db.patch(previousSignalId, { status: "stale", sourceCount: 0, verification: "observed" });
    }
    const evidenceFingerprint = stableFingerprint(
      `source-entry\n${entry.sourceTargetId}\n${entry.canonicalUrl}`,
    );
    const evidence = await ctx.db.query("signalEvidence").withIndex("by_fingerprint", (q) =>
      q.eq("fingerprint", evidenceFingerprint),
    ).first();
    if (evidence) {
      await ctx.db.patch(evidence._id, {
        signalId,
        sourceUrl: entry.canonicalUrl,
        sourceTitle: args.title,
        excerpt: args.excerpt,
        ...evidenceSnapshotFields(snapshot),
        observedAt: now,
      });
    } else {
      await ctx.db.insert("signalEvidence", {
        signalId,
        sourceId: entry.sourceId,
        sourceTargetId: entry.sourceTargetId,
        sourceUrl: entry.canonicalUrl,
        sourceTitle: args.title,
        excerpt: args.excerpt,
        fingerprint: evidenceFingerprint,
        ...evidenceSnapshotFields(snapshot),
        observedAt: now,
      });
    }
    const existingContacts = await ctx.db.query("signalContacts").withIndex("by_source_entry", (q) => q.eq("sourceEntryId", entry._id)).take(20);
    for (const contact of existingContacts) await ctx.db.delete(contact._id);
    for (const contact of args.contacts.slice(0, 10)) {
      await ctx.db.insert("signalContacts", {
        signalId,
        sourceEntryId: entry._id,
        kind: contact.kind,
        value: contact.value.slice(0, 500),
        confidence: 1,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(entry._id, {
      signalId,
      title: args.title,
      city: args.city,
      district: args.district,
      excerpt: args.excerpt,
      contentFingerprint: args.contentFingerprint,
      contactDataPresent: args.contactDataPresent,
      detailState: "processed",
      nextDetailAttemptAt: undefined,
      detailLeaseId: undefined,
      detailLeaseExpiresAt: undefined,
      lastSeenAt: now,
      updatedAt: now,
      error: undefined,
    });
    const backlogCount = await countPendingDetailsForTarget(
      ctx,
      entry.sourceTargetId,
    );
    await ctx.db.patch(entry.sourceTargetId, { backlogCount, updatedAt: now });
    await refreshSignalVerification(ctx, signalId);
    if (previousSignalId && previousSignalId !== signalId) {
      await refreshSignalVerification(ctx, previousSignalId);
    }
    return true;
  },
});

export const failDetailNormalization = internalMutation({
  args: {
    sourceEntryId: v.id("sourceEntries"),
    leaseId: v.string(),
    error: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.sourceEntryId);
    if (!entry || entry.detailLeaseId !== args.leaseId) {
      return false;
    }
    const now = Date.now();
    const retry = entry.detailAttempts < 3;
    await ctx.db.patch(entry._id, {
      detailState: retry ? "queued" : "failed",
      nextDetailAttemptAt: retry
        ? now + 30_000 * 2 ** Math.max(0, entry.detailAttempts - 1)
        : undefined,
      detailLeaseId: undefined,
      detailLeaseExpiresAt: undefined,
      updatedAt: now,
      error: args.error.slice(0, 500),
    });
    const backlogCount = await countPendingDetailsForTarget(
      ctx,
      entry.sourceTargetId,
    );
    await ctx.db.patch(entry.sourceTargetId, { backlogCount, updatedAt: now });
    return retry;
  },
});

export const normalizeDetailDocument = internalAction({
  args: {
    sourceEntryId: v.id("sourceEntries"),
    leaseId: v.string(),
    markdown: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args): Promise<boolean> => {
    const context: {
      sourceTargetId: Id<"sourceTargets">;
      sourceName: string;
      side: "supply" | "demand";
      detailUrl: string;
      title: string;
    } | null = await ctx.runQuery(
      internal.ingestion.getDetailNormalizationContext,
      { sourceEntryId: args.sourceEntryId, leaseId: args.leaseId },
    );
    if (!context) {
      return false;
    }
    try {
      const output: {
        title: string;
        city: string;
        district: string | null;
        summary: string;
        arrangement: "permanent" | "shared" | "hourly" | "unknown";
        priceEur: number | null;
        pricePeriod: "hour" | "month" | "unknown" | null;
        requirements: string[];
        unknowns: string[];
        genres: string[];
        instruments: string[];
        facets: Array<{ namespace: string; key: string; value: string; confidence: number }>;
        contacts: Array<{ kind: "email" | "phone" | "social" | "platform"; value: string }>;
      } = await generateRoomScoutObject({
        schema: z.object({
          title: z.string().min(1).max(300),
          city: z.string().min(1).max(200),
          district: z.string().max(200).nullable(),
          summary: z.string().min(1).max(1_500),
          arrangement: z.enum(["permanent", "shared", "hourly", "unknown"]),
          priceEur: z.number().nonnegative().nullable(),
          pricePeriod: z.enum(["hour", "month", "unknown"]).nullable(),
          requirements: z.array(z.string().max(300)).max(30),
          unknowns: z.array(z.string().max(300)).max(30),
          genres: z.array(z.string().max(100)).max(30),
          instruments: z.array(z.string().max(100)).max(30),
          facets: z.array(z.object({
            namespace: z.string().min(1).max(100),
            key: z.string().min(1).max(100),
            value: z.string().min(1).max(500),
            confidence: z.number().min(0).max(1),
          })).max(40),
          contacts: z.array(z.object({
            kind: z.enum(["email", "phone", "social", "platform"]),
            value: z.string().min(1).max(500),
          })).max(10),
        }),
        instructions: `Normalize one public rehearsal-room ${context.side} listing from ${context.sourceName}. Preserve only explicit facts. Never infer availability, price, location, contacts, or verification. Capture explicitly published music genres, instruments, and useful open-ended facts as typed facets. Capture explicit contact candidates only in contacts; they are stored privately and removed from public evidence.`,
        prompt: delimitUntrustedData(
          "firecrawl_detail",
          args.markdown.slice(0, 30_000),
        ),
      });
      const safe = redactContactData(args.markdown);
      const safeTitle = redactContactData(output.title);
      const safeSummary = redactContactData(output.summary);
      return await ctx.runMutation(
        internal.ingestion.completeDetailNormalization,
        {
          sourceEntryId: args.sourceEntryId,
          leaseId: args.leaseId,
          title: safeTitle.redacted,
          city: output.city,
          summary: safeSummary.redacted,
          arrangement: output.arrangement,
          requirements: output.requirements.map(
            (item) => redactContactData(item).redacted,
          ),
          unknowns: output.unknowns.map(
            (item) => redactContactData(item).redacted,
          ),
          genres: output.genres.map((item) => redactContactData(item).redacted),
          instruments: output.instruments.map((item) => redactContactData(item).redacted),
          facets: output.facets.map((facet) => ({
            ...facet,
            value: redactContactData(facet.value).redacted,
          })),
          contacts: output.contacts,
          excerpt: safe.redacted.slice(0, 1_000),
          contentFingerprint: stableFingerprint(
            `${context.detailUrl}\n${safe.redacted.slice(0, 10_000)}`,
          ),
          contactDataPresent:
            safe.contactDataPresent ||
            safeTitle.contactDataPresent ||
            safeSummary.contactDataPresent,
          ...(output.district === null ? {} : { district: output.district }),
          ...(output.priceEur === null ? {} : { priceEur: output.priceEur }),
          ...(output.pricePeriod === null
            ? {}
            : { pricePeriod: output.pricePeriod }),
        },
      );
    } catch (error) {
      await ctx.runMutation(internal.ingestion.failDetailNormalization, {
        sourceEntryId: args.sourceEntryId,
        leaseId: args.leaseId,
        error: error instanceof Error ? error.message : "Detail normalization failed",
      });
      return false;
    }
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
