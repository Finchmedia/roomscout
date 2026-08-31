import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireOperatorId } from "./integrations/authz";

const signalSide = v.union(v.literal("supply"), v.literal("demand"));
const sourceSide = v.union(
  v.literal("supply"),
  v.literal("demand"),
  v.literal("both"),
);
const detailState = v.union(
  v.literal("none"),
  v.literal("queued"),
  v.literal("fetching"),
  v.literal("processed"),
  v.literal("failed"),
);
const outreachStatus = v.union(
  v.literal("drafted"),
  v.literal("awaiting_approval"),
  v.literal("approved"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("replied"),
  v.literal("rejected"),
  v.literal("failed"),
);

const MAX_COUNT_SAMPLE = 200;

function clampLimit(limit: number | undefined, fallback: number, maximum: number) {
  return Math.max(1, Math.min(Math.floor(limit ?? fallback), maximum));
}

function operatorName(user: Doc<"users"> | null) {
  return user?.displayName?.trim() || user?.username || "Unknown user";
}

function maskEmail(address: string) {
  const at = address.lastIndexOf("@");
  if (at <= 0 || at === address.length - 1) return "Restricted address";
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  return `${local.slice(0, Math.min(2, local.length))}…@${domain}`;
}

async function sourceNameForTarget(
  ctx: QueryCtx,
  sourceTargetId: Id<"sourceTargets"> | undefined,
) {
  if (sourceTargetId === undefined) return "Unresolved source";
  const target = await ctx.db.get(sourceTargetId);
  if (target === null) return "Deleted source target";
  const source = await ctx.db.get(target.sourceId);
  return source?.name ?? "Deleted source";
}

const activityValidator = v.object({
  id: v.string(),
  kind: v.union(
    v.literal("ingestion"),
    v.literal("outreach"),
    v.literal("mail"),
    v.literal("voice"),
  ),
  title: v.string(),
  detail: v.string(),
  status: v.string(),
  at: v.number(),
});

export const overview = query({
  args: {},
  returns: v.object({
    boundedSample: v.number(),
    metrics: v.object({
      publishedSignals: v.number(),
      staleSignals: v.number(),
      detailBacklog: v.number(),
      detailFailures: v.number(),
      awaitingApproval: v.number(),
      repliedThreads: v.number(),
      unhealthySources: v.number(),
      activeVoiceSessions: v.number(),
      activeMailboxes: v.number(),
    }),
    activity: v.array(activityValidator),
  }),
  handler: async (ctx) => {
    await requireOperatorId(ctx);

    const [
      publishedSignals,
      staleSignals,
      queuedEntries,
      fetchingEntries,
      failedEntries,
      awaitingApproval,
      sources,
      threads,
      activeVoiceSessions,
      mailboxes,
      receivedEvents,
      processingEvents,
      processedEvents,
      failedEvents,
      ignoredEvents,
      recentOutreach,
      recentVoice,
    ] = await Promise.all([
      ctx.db
        .query("signals")
        .withIndex("by_status_and_last_seen_at", (q) =>
          q.eq("status", "published"),
        )
        .take(MAX_COUNT_SAMPLE),
      ctx.db
        .query("signals")
        .withIndex("by_status_and_last_seen_at", (q) => q.eq("status", "stale"))
        .take(MAX_COUNT_SAMPLE),
      ctx.db
        .query("sourceEntries")
        .withIndex("by_detail_state_and_next_attempt", (q) =>
          q.eq("detailState", "queued"),
        )
        .take(MAX_COUNT_SAMPLE),
      ctx.db
        .query("sourceEntries")
        .withIndex("by_detail_state_and_next_attempt", (q) =>
          q.eq("detailState", "fetching"),
        )
        .take(MAX_COUNT_SAMPLE),
      ctx.db
        .query("sourceEntries")
        .withIndex("by_detail_state_and_next_attempt", (q) =>
          q.eq("detailState", "failed"),
        )
        .take(MAX_COUNT_SAMPLE),
      ctx.db
        .query("outreachDrafts")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "awaiting_approval"),
        )
        .take(MAX_COUNT_SAMPLE),
      ctx.db.query("sources").take(MAX_COUNT_SAMPLE),
      ctx.db.query("mailThreads").order("desc").take(MAX_COUNT_SAMPLE),
      ctx.db
        .query("voiceSessions")
        .withIndex("by_status_and_updated_at", (q) => q.eq("status", "active"))
        .take(MAX_COUNT_SAMPLE),
      ctx.db.query("userMailboxes").take(MAX_COUNT_SAMPLE),
      ctx.db
        .query("ingestionEvents")
        .withIndex("by_status_and_received_at", (q) => q.eq("status", "received"))
        .order("desc")
        .take(5),
      ctx.db
        .query("ingestionEvents")
        .withIndex("by_status_and_received_at", (q) => q.eq("status", "processing"))
        .order("desc")
        .take(5),
      ctx.db
        .query("ingestionEvents")
        .withIndex("by_status_and_received_at", (q) => q.eq("status", "processed"))
        .order("desc")
        .take(5),
      ctx.db
        .query("ingestionEvents")
        .withIndex("by_status_and_received_at", (q) => q.eq("status", "failed"))
        .order("desc")
        .take(5),
      ctx.db
        .query("ingestionEvents")
        .withIndex("by_status_and_received_at", (q) => q.eq("status", "ignored"))
        .order("desc")
        .take(5),
      ctx.db
        .query("outreachDrafts")
        .withIndex("by_status_and_updated_at", (q) => q.eq("status", "failed"))
        .order("desc")
        .take(5),
      ctx.db
        .query("voiceSessions")
        .withIndex("by_status_and_updated_at", (q) => q.eq("status", "error"))
        .order("desc")
        .take(5),
    ]);

    const ingestion = [
      ...receivedEvents,
      ...processingEvents,
      ...processedEvents,
      ...failedEvents,
      ...ignoredEvents,
    ]
      .sort((left, right) => right.receivedAt - left.receivedAt)
      .slice(0, 12);
    const ingestionActivity = await Promise.all(
      ingestion.map(async (event) => ({
        id: `ingestion:${event._id}`,
        kind: "ingestion" as const,
        title: event.eventType,
        detail: `${await sourceNameForTarget(ctx, event.sourceTargetId)} · ${event.changeStatus ?? "monitor event"}`,
        status: event.status,
        at: event.receivedAt,
      })),
    );
    const outreachActivity = recentOutreach.map((draft) => ({
      id: `outreach:${draft._id}`,
      kind: "outreach" as const,
      title: "Outreach delivery needs attention",
      detail: `${draft.subject} · ${draft.error ?? "send failed"}`.slice(0, 500),
      status: draft.status,
      at: draft.updatedAt,
    }));
    const mailActivity = threads
      .filter((thread) => thread.status === "replied" || thread.status === "failed")
      .sort((left, right) => right.lastMessageAt - left.lastMessageAt)
      .slice(0, 5)
      .map((thread) => ({
        id: `mail:${thread._id}`,
        kind: "mail" as const,
        title: thread.status === "replied" ? "Inbound reply received" : "Mail thread failed",
        detail: thread.subject,
        status: thread.lastDeliveryStatus ?? thread.status,
        at: thread.lastMessageAt,
      }));
    const voiceActivity = recentVoice.map((session) => ({
      id: `voice:${session._id}`,
      kind: "voice" as const,
      title: "Voice session error",
      detail: session.error ?? `${session.model} session ended with an error`,
      status: session.status,
      at: session.updatedAt,
    }));

    return {
      boundedSample: MAX_COUNT_SAMPLE,
      metrics: {
        publishedSignals: publishedSignals.length,
        staleSignals: staleSignals.length,
        detailBacklog: queuedEntries.length + fetchingEntries.length,
        detailFailures: failedEntries.length,
        awaitingApproval: awaitingApproval.length,
        repliedThreads: threads.filter((thread) => thread.status === "replied").length,
        unhealthySources: sources.filter(
          (source) => source.health === "degraded" || source.health === "failing",
        ).length,
        activeVoiceSessions: activeVoiceSessions.length,
        activeMailboxes: mailboxes.filter((mailbox) => mailbox.status === "active").length,
      },
      activity: [
        ...ingestionActivity,
        ...outreachActivity,
        ...mailActivity,
        ...voiceActivity,
      ]
        .sort((left, right) => right.at - left.at)
        .slice(0, 20),
    };
  },
});

export const navCounts = query({
  args: {},
  returns: v.object({
    signalReview: v.number(),
    outreach: v.number(),
    inbox: v.number(),
  }),
  handler: async (ctx) => {
    await requireOperatorId(ctx);
    const [queued, failed, awaitingApproval, threads] = await Promise.all([
      ctx.db
        .query("sourceEntries")
        .withIndex("by_detail_state_and_next_attempt", (q) =>
          q.eq("detailState", "queued"),
        )
        .take(100),
      ctx.db
        .query("sourceEntries")
        .withIndex("by_detail_state_and_next_attempt", (q) =>
          q.eq("detailState", "failed"),
        )
        .take(100),
      ctx.db
        .query("outreachDrafts")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "awaiting_approval"),
        )
        .take(100),
      ctx.db.query("mailThreads").order("desc").take(100),
    ]);
    return {
      signalReview: queued.length + failed.length,
      outreach: awaitingApproval.length,
      inbox: threads.filter(
        (thread) => thread.status === "replied" || thread.status === "failed",
      ).length,
    };
  },
});

const sourceTargetValidator = v.object({
  _id: v.id("sourceTargets"),
  url: v.string(),
  paused: v.boolean(),
  scheduleMinutes: v.number(),
  monitorStatus: v.optional(
    v.union(
      v.literal("unconfigured"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("error"),
    ),
  ),
  providerMonitorId: v.optional(v.string()),
  backlogCount: v.number(),
  successfulSnapshotCount: v.number(),
  lastRunAt: v.optional(v.number()),
  lastMonitorEventAt: v.optional(v.number()),
  monitor: v.optional(
    v.object({
      state: v.union(v.literal("active"), v.literal("paused"), v.literal("error")),
      lastCheckStatus: v.optional(v.string()),
      lastCheckAt: v.optional(v.number()),
      lastReconciledAt: v.optional(v.number()),
      error: v.optional(v.string()),
    }),
  ),
});

export const listSources = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("sources"),
      name: v.string(),
      baseUrl: v.string(),
      side: sourceSide,
      status: v.union(
        v.literal("reviewing"),
        v.literal("active"),
        v.literal("paused"),
      ),
      health: v.union(
        v.literal("unknown"),
        v.literal("healthy"),
        v.literal("degraded"),
        v.literal("failing"),
      ),
      lastCheckedAt: v.optional(v.number()),
      geographicScope: v.optional(v.string()),
      automationReview: v.optional(
        v.union(v.literal("pending"), v.literal("approved"), v.literal("restricted")),
      ),
      accessMode: v.optional(v.union(v.literal("public"), v.literal("authenticated"), v.literal("partner"), v.literal("restricted"))),
      policyNotes: v.optional(v.string()),
      reviewedAt: v.optional(v.number()),
      targets: v.array(sourceTargetValidator),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const sources = await ctx.db
      .query("sources")
      .order("desc")
      .take(clampLimit(args.limit, 25, 50));

    return await Promise.all(
      sources.map(async (source) => {
        const targets = await ctx.db
          .query("sourceTargets")
          .withIndex("by_source", (q) => q.eq("sourceId", source._id))
          .take(10);
        const projectedTargets = await Promise.all(
          targets.map(async (target) => {
            const monitor = await ctx.db
              .query("sourceMonitors")
              .withIndex("by_source_target", (q) =>
                q.eq("sourceTargetId", target._id),
              )
              .unique();
            return {
              _id: target._id,
              url: target.url,
              paused: target.paused,
              scheduleMinutes: target.scheduleMinutes,
              monitorStatus: target.monitorStatus,
              providerMonitorId: target.providerMonitorId,
              backlogCount: target.backlogCount ?? 0,
              successfulSnapshotCount: target.successfulSnapshotCount ?? 0,
              lastRunAt: target.lastRunAt,
              lastMonitorEventAt: target.lastMonitorEventAt,
              monitor: monitor
                ? {
                    state: monitor.state,
                    lastCheckStatus: monitor.lastCheckStatus,
                    lastCheckAt: monitor.lastCheckAt,
                    lastReconciledAt: monitor.lastReconciledAt,
                    error: monitor.error?.slice(0, 500),
                  }
                : undefined,
            };
          }),
        );
        return {
          _id: source._id,
          name: source.name,
          baseUrl: source.baseUrl,
          side: source.side,
          status: source.status,
          health: source.health,
          lastCheckedAt: source.lastCheckedAt,
          geographicScope: source.geographicScope,
          automationReview: source.automationReview,
          accessMode: source.accessMode,
          policyNotes: source.policyNotes,
          reviewedAt: source.reviewedAt,
          targets: projectedTargets,
        };
      }),
    );
  },
});

const queueState = v.union(
  v.literal("all"),
  v.literal("queued"),
  v.literal("fetching"),
  v.literal("failed"),
  v.literal("processed"),
  v.literal("none"),
);

export const listSignalQueue = query({
  args: { state: v.optional(queueState), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("sourceEntries"),
      title: v.string(),
      excerpt: v.string(),
      side: signalSide,
      city: v.optional(v.string()),
      sourceName: v.string(),
      detailUrl: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("removed"),
        v.literal("stale"),
        v.literal("reviewing"),
      ),
      detailState,
      detailAttempts: v.number(),
      error: v.optional(v.string()),
      contactDataPresent: v.boolean(),
      lastSeenAt: v.number(),
      signal: v.optional(
        v.object({
          _id: v.id("signals"),
          title: v.string(),
          summary: v.string(),
          arrangement: v.union(
            v.literal("permanent"),
            v.literal("shared"),
            v.literal("hourly"),
            v.literal("unknown"),
          ),
          priceEur: v.optional(v.number()),
          pricePeriod: v.optional(
            v.union(v.literal("hour"), v.literal("month"), v.literal("unknown")),
          ),
          requirements: v.array(v.string()),
          unknowns: v.array(v.string()),
          verification: v.union(
            v.literal("observed"),
            v.literal("verified"),
            v.literal("conflicting"),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const limit = clampLimit(args.limit, 40, 60);
    const states: Array<Doc<"sourceEntries">["detailState"]> =
      args.state && args.state !== "all"
        ? [args.state]
        : ["failed", "queued", "fetching", "processed", "none"];
    const pages = await Promise.all(
      states.map((state) =>
        ctx.db
          .query("sourceEntries")
          .withIndex("by_detail_state_and_next_attempt", (q) =>
            q.eq("detailState", state),
          )
          .take(limit),
      ),
    );
    const entries = pages
      .flat()
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);

    return await Promise.all(
      entries.map(async (entry) => {
        const [source, signal] = await Promise.all([
          ctx.db.get(entry.sourceId),
          entry.signalId ? ctx.db.get(entry.signalId) : null,
        ]);
        return {
          _id: entry._id,
          title: entry.title,
          excerpt: entry.excerpt,
          side: entry.side,
          city: entry.city,
          sourceName: source?.name ?? "Deleted source",
          detailUrl: entry.detailUrl,
          status: entry.status,
          detailState: entry.detailState,
          detailAttempts: entry.detailAttempts,
          error: entry.error?.slice(0, 500),
          contactDataPresent: entry.contactDataPresent ?? false,
          lastSeenAt: entry.lastSeenAt,
          signal: signal
            ? {
                _id: signal._id,
                title: signal.title,
                summary: signal.summary,
                arrangement: signal.arrangement,
                priceEur: signal.priceEur,
                pricePeriod: signal.pricePeriod,
                requirements: signal.requirements,
                unknowns: signal.unknowns,
                verification: signal.verification,
              }
            : undefined,
        };
      }),
    );
  },
});

export const listOutreach = query({
  args: { status: v.optional(outreachStatus), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("outreachDrafts"),
      ownerName: v.string(),
      signalTitle: v.string(),
      needTitle: v.string(),
      recipientName: v.string(),
      recipientEmailMasked: v.string(),
      senderAddressMasked: v.optional(v.string()),
      subject: v.string(),
      contentVersion: v.number(),
      contentHashPrefix: v.string(),
      status: outreachStatus,
      deliveryStatus: v.optional(
        v.union(
          v.literal("queued"),
          v.literal("sent"),
          v.literal("delivered"),
          v.literal("bounced"),
          v.literal("rejected"),
          v.literal("complained"),
        ),
      ),
      approvedAt: v.optional(v.number()),
      sentAt: v.optional(v.number()),
      error: v.optional(v.string()),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const limit = clampLimit(args.limit, 40, 60);
    const statuses: Array<Doc<"outreachDrafts">["status"]> = args.status
      ? [args.status]
      : [
          "awaiting_approval",
          "approved",
          "sending",
          "failed",
          "replied",
          "sent",
          "drafted",
          "rejected",
        ];
    const pages = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query("outreachDrafts")
          .withIndex("by_status_and_updated_at", (q) => q.eq("status", status))
          .order("desc")
          .take(limit),
      ),
    );
    const drafts = pages
      .flat()
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);
    return await Promise.all(
      drafts.map(async (draft) => {
        const [owner, signal, need, mailbox] = await Promise.all([
          ctx.db.get(draft.ownerId),
          ctx.db.get(draft.signalId),
          ctx.db.get(draft.savedNeedId),
          draft.mailboxId ? ctx.db.get(draft.mailboxId) : null,
        ]);
        return {
          _id: draft._id,
          ownerName: operatorName(owner),
          signalTitle: signal?.title ?? "Deleted signal",
          needTitle: need?.title ?? "Deleted search",
          recipientName: draft.recipientName || "Unnamed recipient",
          recipientEmailMasked: maskEmail(draft.recipientEmail),
          senderAddressMasked: mailbox?.emailAddress
            ? maskEmail(mailbox.emailAddress)
            : undefined,
          subject: draft.subject,
          contentVersion: draft.contentVersion,
          contentHashPrefix: draft.contentHash.slice(0, 12),
          status: draft.status,
          deliveryStatus: draft.deliveryStatus,
          approvedAt: draft.approvedAt,
          sentAt: draft.sentAt,
          error: draft.error?.slice(0, 500),
          updatedAt: draft.updatedAt,
        };
      }),
    );
  },
});

export const listInboxRouting = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      _id: v.id("mailThreads"),
      ownerName: v.string(),
      subject: v.string(),
      status: v.union(
        v.literal("sent"),
        v.literal("awaiting_reply"),
        v.literal("replied"),
        v.literal("closed"),
        v.literal("failed"),
      ),
      deliveryStatus: v.optional(
        v.union(
          v.literal("sent"),
          v.literal("delivered"),
          v.literal("bounced"),
          v.literal("rejected"),
          v.literal("complained"),
        ),
      ),
      recipientName: v.string(),
      recipientEmailMasked: v.string(),
      searchTitle: v.string(),
      signalTitle: v.string(),
      latestDirection: v.optional(v.union(v.literal("outbound"), v.literal("inbound"))),
      parsedSummary: v.optional(v.string()),
      parsedFacts: v.array(v.string()),
      lastError: v.optional(v.string()),
      lastMessageAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const limit = clampLimit(args.limit, 25, 40);
    const threads = (await ctx.db.query("mailThreads").order("desc").take(limit * 3))
      .sort((left, right) => right.lastMessageAt - left.lastMessageAt)
      .slice(0, limit);
    return await Promise.all(
      threads.map(async (thread) => {
        const [owner, draft, latestMessage] = await Promise.all([
          ctx.db.get(thread.ownerId),
          ctx.db.get(thread.draftId),
          ctx.db
            .query("mailMessages")
            .withIndex("by_thread_and_received_at", (q) =>
              q.eq("threadId", thread._id),
            )
            .order("desc")
            .first(),
        ]);
        const [need, signal] = draft
          ? await Promise.all([
              ctx.db.get(draft.savedNeedId),
              ctx.db.get(draft.signalId),
            ])
          : [null, null];
        return {
          _id: thread._id,
          ownerName: operatorName(owner),
          subject: thread.subject,
          status: thread.status,
          deliveryStatus: thread.lastDeliveryStatus,
          recipientName: draft?.recipientName || "Unnamed recipient",
          recipientEmailMasked: draft
            ? maskEmail(draft.recipientEmail)
            : "Restricted address",
          searchTitle: need?.title ?? "Deleted search",
          signalTitle: signal?.title ?? "Deleted signal",
          latestDirection: latestMessage?.direction,
          parsedSummary: latestMessage?.parsedSummary?.slice(0, 700),
          parsedFacts: latestMessage?.parsedFacts?.slice(0, 12) ?? [],
          lastError: thread.lastError?.slice(0, 500),
          lastMessageAt: thread.lastMessageAt,
        };
      }),
    );
  },
});

export const listAudit = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      id: v.string(),
      kind: v.union(
        v.literal("approval"),
        v.literal("action"),
        v.literal("provider"),
        v.literal("voice"),
      ),
      title: v.string(),
      detail: v.string(),
      status: v.string(),
      at: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatorId(ctx);
    const limit = clampLimit(args.limit, 50, 80);
    const [approvals, actionEvents, providerEvents, voiceSessions] = await Promise.all([
      ctx.db.query("outreachApprovals").order("desc").take(limit),
      ctx.db.query("auditEvents").order("desc").take(limit),
      ctx.db.query("providerEvents").order("desc").take(limit),
      ctx.db.query("voiceSessions").order("desc").take(limit),
    ]);
    const approvalItems = await Promise.all(
      approvals.map(async (approval) => {
        const [owner, draft] = await Promise.all([
          ctx.db.get(approval.ownerId),
          ctx.db.get(approval.draftId),
        ]);
        return {
          id: `approval:${approval._id}`,
          kind: "approval" as const,
          title: `Outreach ${approval.decision}`,
          detail: `${operatorName(owner)} · ${draft?.subject ?? "Deleted draft"} · version ${approval.contentVersion}`,
          status: approval.decision,
          at: approval.decidedAt,
        };
      }),
    );
    const actionItems = actionEvents.map((event) => ({
      id: `action:${event._id}`,
      kind: "action" as const,
      title: event.eventType.replaceAll(".", " · "),
      detail: event.summary?.slice(0, 500) ?? `${event.actorType} · ${event.entityKey}`,
      status: event.eventType.split(".").at(-1) ?? "recorded",
      at: event.occurredAt,
    }));
    const providerItems = providerEvents.map((event) => ({
      id: `provider:${event._id}`,
      kind: "provider" as const,
      title: `${event.provider} · ${event.eventType}`,
      detail: event.error?.slice(0, 500) ?? `Provider event ${event.status}`,
      status: event.status,
      at: event.receivedAt,
    }));
    const voiceItems = voiceSessions.map((session) => ({
      id: `voice:${session._id}`,
      kind: "voice" as const,
      title: "Realtime Scout session",
      detail: `${session.model} · ${session.durationMs === undefined ? "duration pending" : `${Math.round(session.durationMs / 1000)}s`} · transcripts only`,
      status: session.status,
      at: session.startedAt,
    }));
    return [...approvalItems, ...actionItems, ...providerItems, ...voiceItems]
      .sort((left, right) => right.at - left.at)
      .slice(0, limit);
  },
});
