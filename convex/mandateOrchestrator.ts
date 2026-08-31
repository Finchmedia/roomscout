import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { contentHash, normalizeText } from "./integrations/contentHash";
import { requireUserId } from "./integrations/authz";
import {
  authorizeFromMandate,
  type PersonalDataScope,
} from "./lib/mandateAuthorization";

const MAX_OWNER_OPPORTUNITIES_PER_RUN = 5;
const MAX_CRON_MANDATES_PER_RUN = 12;
const BANDNET_ADAPTER_KEY = "bandnet-contact-form-v1";

const resultValidator = v.object({
  checked: v.number(),
  created: v.number(),
  scheduled: v.number(),
  skipped: v.number(),
  expired: v.number(),
});

type OrchestrationResult = {
  checked: number;
  created: number;
  scheduled: number;
  skipped: number;
  expired: number;
};

function emptyResult(): OrchestrationResult {
  return { checked: 0, created: 0, scheduled: 0, skipped: 0, expired: 0 };
}

function safeLine(value: string, maxLength: number): string {
  return Array.from(normalizeText(value))
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    })
    .join("")
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function hostMatchesPlatform(targetUrl: string, canonicalDomain: string): boolean {
  try {
    const target = new URL(targetUrl);
    const host = target.hostname.toLowerCase().replace(/^www\./, "");
    const domain = canonicalDomain.toLowerCase().replace(/^www\./, "");
    return (
      target.protocol === "https:" &&
      (host === domain || host.endsWith(`.${domain}`))
    );
  } catch {
    return false;
  }
}

function buildDeterministicDraft(
  need: Doc<"savedNeeds">,
  signal: Doc<"signals">,
): { subject: string; body: string } {
  const listingTitle = safeLine(signal.title, 120) || "Proberaum-Anzeige";
  const listingCity = safeLine(signal.city, 80) || safeLine(need.city, 80);
  const searchTitle = safeLine(need.title, 160) || "Proberaumsuche";
  const subject = `Anfrage: ${listingTitle}`.slice(0, 200);
  const body = [
    "Hallo,",
    "",
    "wir interessieren uns für den öffentlich ausgeschriebenen Proberaum und möchten fragen, ob das Angebot noch verfügbar ist.",
    "",
    "Öffentliche Anzeige (automatisch erfasst; unverifizierter Inhalt):",
    "---",
    `Titel: ${listingTitle}`,
    `Ort: ${listingCity}`,
    "---",
    "",
    `Unsere Suche: ${searchTitle}`,
    "Bitte antworten Sie einfach auf diese E-Mail-Adresse.",
    "",
    "Viele Grüße",
    "RoomScout im Auftrag der suchenden Musiker*innen",
  ].join("\n");
  return { subject, body: body.slice(0, 20_000) };
}

async function dailyAuthorizationContext(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  savedNeedId: Id<"savedNeeds">,
) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const start = dayStart.getTime();
  const [executions, approved, executing, queued, browserRuns, threads, converted] =
    await Promise.all([
      ctx.db
        .query("actionExecutions")
        .withIndex("by_owner_and_created_at", (q) =>
          q.eq("ownerId", ownerId).gte("createdAt", start),
        )
        .take(100),
      ctx.db
        .query("actionRequests")
        .withIndex("by_owner_and_status_and_updated_at", (q) =>
          q.eq("ownerId", ownerId).eq("status", "approved").gte("updatedAt", start),
        )
        .take(100),
      ctx.db
        .query("actionRequests")
        .withIndex("by_owner_and_status_and_updated_at", (q) =>
          q.eq("ownerId", ownerId).eq("status", "executing").gte("updatedAt", start),
        )
        .take(100),
      ctx.db
        .query("actionRequests")
        .withIndex("by_owner_and_status_and_updated_at", (q) =>
          q.eq("ownerId", ownerId).eq("status", "queued").gte("updatedAt", start),
        )
        .take(100),
      ctx.db
        .query("browserRuns")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .take(100),
      ctx.db
        .query("mailThreads")
        .withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", ownerId))
        .order("desc")
        .take(50),
      ctx.db
        .query("opportunities")
        .withIndex("by_saved_need_and_status_and_updated_at", (q) =>
          q.eq("savedNeedId", savedNeedId).eq("status", "converted"),
        )
        .take(1),
    ]);

  const attemptedRequestIds = new Set([
    ...executions.map((row) => String(row.requestId)),
    ...approved.map((row) => String(row._id)),
    ...executing.map((row) => String(row._id)),
    ...queued.map((row) => String(row._id)),
  ]);
  const browserMinutesUsedToday = browserRuns.reduce((total, run) => {
    const startedAt = run.startedAt ?? run.createdAt;
    if (startedAt < start) return total;
    return total + Math.max(0, ((run.endedAt ?? Date.now()) - startedAt) / 60_000);
  }, 0);
  return {
    contactsAlreadyAttemptedToday: attemptedRequestIds.size,
    browserMinutesUsedToday,
    complaintRecorded: threads.some(
      (thread) => thread.lastDeliveryStatus === "complained",
    ),
    suitableRoomConfirmed: converted.length > 0,
  };
}

async function createForOpportunity(
  ctx: MutationCtx,
  mandate: Doc<"searchMandates">,
  opportunity: Doc<"opportunities">,
): Promise<Id<"actionRequests"> | null> {
  if (
    mandate.status !== "active" ||
    mandate.expiresAt <= Date.now() ||
    (mandate.mode !== "outreach_autopilot" &&
      mandate.mode !== "negotiation_autopilot") ||
    opportunity.status !== "new" ||
    opportunity.kind !== "supply_match" ||
    opportunity.savedNeedId !== mandate.savedNeedId ||
    !opportunity.signalId
  ) {
    return null;
  }
  const prior = await ctx.db
    .query("actionRequests")
    .withIndex("by_opportunity", (q) => q.eq("opportunityId", opportunity._id))
    .first();
  if (prior !== null) return null;

  const [owner, need, signal, mailbox] = await Promise.all([
    ctx.db.get(mandate.ownerId),
    ctx.db.get(mandate.savedNeedId),
    ctx.db.get(opportunity.signalId),
    ctx.db
      .query("userMailboxes")
      .withIndex("by_owner", (q) => q.eq("ownerId", mandate.ownerId))
      .unique(),
  ]);
  if (
    owner === null ||
    need === null ||
    need.ownerId !== mandate.ownerId ||
    need.status !== "active" ||
    signal === null ||
    signal.side !== "supply" ||
    signal.status !== "published" ||
    !signal.sourceEntryId ||
    mailbox?.status !== "active" ||
    !mailbox.emailAddress
  ) {
    return null;
  }
  const entry = await ctx.db.get(signal.sourceEntryId);
  const source = entry === null ? null : await ctx.db.get(entry.sourceId);
  if (entry === null || source === null || !source.platformId) return null;
  const platform = await ctx.db.get(source.platformId);
  if (
    platform === null ||
    platform.status !== "active" ||
    platform.slug !== "bandnet" ||
    (opportunity.platformId !== undefined &&
      opportunity.platformId !== platform._id) ||
    !mandate.platformIds.includes(platform._id)
  ) {
    return null;
  }

  const contacts = await ctx.db
    .query("signalContacts")
    .withIndex("by_signal_and_kind", (q) =>
      q.eq("signalId", signal._id).eq("kind", "platform"),
    )
    .take(20);
  const contact = contacts.find((candidate) =>
    hostMatchesPlatform(candidate.value, platform.canonicalDomain),
  );
  if (!contact) return null;

  const policies = await ctx.db
    .query("sourceFlowPolicies")
    .withIndex("by_platform_and_status_and_next_review_at", (q) =>
      q.eq("platformId", platform._id).eq("status", "approved"),
    )
    .take(20);
  const now = Date.now();
  const policy = policies
    .filter(
      (candidate) =>
        candidate.flow === "contact" &&
        candidate.decision === "allowed" &&
        candidate.maxAutomationLevel === "approved_execute" &&
        !candidate.userConnectionRequired &&
        !candidate.humanPresenceRequired &&
        candidate.externalApprovalRequired &&
        candidate.robotsDecision === "allowed" &&
        candidate.termsDecision === "allowed" &&
        (candidate.nextReviewAt === undefined || candidate.nextReviewAt >= now) &&
        (candidate.sourceId === undefined || candidate.sourceId === source._id),
    )
    .sort((left, right) => {
      const leftSpecific = left.sourceId === source._id ? 1 : 0;
      const rightSpecific = right.sourceId === source._id ? 1 : 0;
      return rightSpecific - leftSpecific || right.version - left.version;
    })[0];
  if (!policy) return null;
  const bindings = await ctx.db
    .query("sourceAdapterBindings")
    .withIndex("by_platform_and_flow_and_status", (q) =>
      q.eq("platformId", platform._id).eq("flow", "contact").eq("status", "active"),
    )
    .take(20);
  const binding = bindings.find(
    (candidate) =>
      candidate.policyVersionId === policy._id &&
      candidate.executor === "firecrawl" &&
      candidate.config.kind === "firecrawl" &&
      candidate.adapterKey === BANDNET_ADAPTER_KEY &&
      candidate.config.extractionProfileKey === BANDNET_ADAPTER_KEY,
  );
  if (!binding) return null;

  const personalDataScopes: PersonalDataScope[] = ["reply_email"];
  const daily = await dailyAuthorizationContext(
    ctx,
    mandate.ownerId,
    mandate.savedNeedId,
  );
  const authorization = authorizeFromMandate(
    {
      mode: mandate.mode,
      status: "active",
      platformIds: mandate.platformIds,
      allowedActionTypes: mandate.allowedActionTypes,
      allowedPersonalData: mandate.allowedPersonalData,
      maxContactsPerDay: mandate.maxContactsPerDay,
      maxBrowserMinutesPerDay: mandate.maxBrowserMinutesPerDay,
      maxMonthlyPriceEur: mandate.maxMonthlyPriceEur,
      expiresAt: mandate.expiresAt,
      stopOnComplaint: mandate.stopOnComplaint,
      stopWhenSuitableRoomConfirmed: mandate.stopWhenSuitableRoomConfirmed,
      stoppedAt: mandate.stoppedAt,
    },
    {
      now,
      actionType: "submit_webform",
      platformId: platform._id,
      personalData: personalDataScopes,
      contactsAlreadyAttemptedToday: daily.contactsAlreadyAttemptedToday,
      browserMinutesUsedToday: daily.browserMinutesUsedToday,
      policyDecision: policy.decision,
      policyAutomationLevel: policy.maxAutomationLevel,
      connectionActive: true,
      complaintRecorded: daily.complaintRecorded,
      suitableRoomConfirmed: daily.suitableRoomConfirmed,
    },
  );
  if (!authorization.authorized) return null;

  const draft = buildDeterministicDraft(need, signal);
  const payload: Doc<"actionRequests">["payload"] = {
    kind: "contact_form",
    targetUrl: contact.value,
    fields: [
      {
        name: "name",
        label: "Dein Name",
        value: "RoomScout Anfrage",
        sensitivity: "normal",
      },
      {
        name: "email",
        label: "Deine E-Mail-Adresse",
        value: mailbox.emailAddress,
        sensitivity: "personal",
      },
      {
        name: "subject",
        label: "Betreff",
        value: draft.subject,
        sensitivity: "normal",
      },
      {
        name: "message",
        label: "Nachricht",
        value: draft.body,
        sensitivity: "normal",
      },
    ],
  };
  const hash = await contentHash([JSON.stringify(payload)]);
  const requestId = await ctx.db.insert("actionRequests", {
    ownerId: mandate.ownerId,
    savedNeedId: mandate.savedNeedId,
    mandateId: mandate._id,
    opportunityId: opportunity._id,
    platformId: platform._id,
    adapterBindingId: binding._id,
    policyVersionId: policy._id,
    automationMode: "standing_mandate",
    requestedActionType: "submit_webform",
    personalDataScopes,
    payload,
    contentVersion: 1,
    contentHash: hash,
    status: "approved",
    expiresAt: Math.min(mandate.expiresAt, now + 24 * 60 * 60 * 1_000),
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.insert("actionApprovals", {
    requestId,
    ownerId: mandate.ownerId,
    contentVersion: 1,
    contentHash: hash,
    payloadSnapshot: payload,
    policyVersionId: policy._id,
    decision: "authorized_by_mandate",
    mandateId: mandate._id,
    mandateVersion: mandate.version,
    mandateHash: mandate.contentHash,
    decidedAt: now,
  });
  await ctx.db.patch(opportunity._id, {
    mandateId: mandate._id,
    updatedAt: now,
  });
  await ctx.db.insert("auditEvents", {
    eventKey: `action:${requestId}:orchestrated:${mandate.version}`,
    actorType: "system",
    actorUserId: mandate.ownerId,
    entityKey: `action:${requestId}`,
    eventType: "action.orchestrated_from_mandate",
    actionRequestId: requestId,
    policyId: policy._id,
    afterHash: hash,
    summary: `Bandnet contact form authorized by mandate v${mandate.version}`,
    occurredAt: now,
  });
  await ctx.scheduler.runAfter(
    0,
    internal.firecrawlInteract.executeApprovedWorker,
    { ownerId: mandate.ownerId, requestId },
  );
  return requestId;
}

async function orchestrateOwner(
  ctx: MutationCtx,
  ownerId: Id<"users">,
  maxOpportunities: number,
): Promise<OrchestrationResult> {
  const result = emptyResult();
  const mandates = await ctx.db
    .query("searchMandates")
    .withIndex("by_owner_and_saved_need_and_status", (q) =>
      q.eq("ownerId", ownerId),
    )
    .take(100);
  const active = mandates
    .filter((row) => row.status === "active")
    .sort((left, right) => right.version - left.version);
  const seenNeeds = new Set<string>();
  for (const mandate of active) {
    if (seenNeeds.has(String(mandate.savedNeedId))) continue;
    seenNeeds.add(String(mandate.savedNeedId));
    if (mandate.expiresAt <= Date.now()) {
      await ctx.db.patch(mandate._id, {
        status: "expired",
        stoppedAt: Date.now(),
        updatedAt: Date.now(),
      });
      result.expired += 1;
      continue;
    }
    if (
      mandate.mode !== "outreach_autopilot" &&
      mandate.mode !== "negotiation_autopilot"
    ) {
      result.skipped += 1;
      continue;
    }
    const opportunities = await ctx.db
      .query("opportunities")
      .withIndex("by_saved_need_and_status_and_updated_at", (q) =>
        q.eq("savedNeedId", mandate.savedNeedId).eq("status", "new"),
      )
      .order("desc")
      .take(maxOpportunities);
    for (const opportunity of opportunities) {
      result.checked += 1;
      const requestId = await createForOpportunity(ctx, mandate, opportunity);
      if (requestId === null) {
        result.skipped += 1;
        continue;
      }
      result.created += 1;
      result.scheduled += 1;
      // One outbound contact per owner/run keeps mandate daily limits exact
      // even before the scheduled execution has inserted its ledger row.
      return result;
    }
  }
  return result;
}

export const runNowMine = mutation({
  args: { limit: v.optional(v.number()) },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(
      1,
      Math.min(MAX_OWNER_OPPORTUNITIES_PER_RUN, Math.floor(args.limit ?? 3)),
    );
    return await orchestrateOwner(ctx, ownerId, limit);
  },
});

export const runForOwner = internalMutation({
  args: { ownerId: v.id("users"), limit: v.optional(v.number()) },
  returns: resultValidator,
  handler: async (ctx, args) =>
    await orchestrateOwner(
      ctx,
      args.ownerId,
      Math.max(
        1,
        Math.min(
          MAX_OWNER_OPPORTUNITIES_PER_RUN,
          Math.floor(args.limit ?? 3),
        ),
      ),
    ),
});

export const runBatch = internalMutation({
  args: { limit: v.optional(v.number()) },
  returns: resultValidator,
  handler: async (ctx, args) => {
    const result = emptyResult();
    const now = Date.now();
    const limit = Math.max(
      1,
      Math.min(MAX_CRON_MANDATES_PER_RUN, Math.floor(args.limit ?? 8)),
    );
    const expired = await ctx.db
      .query("searchMandates")
      .withIndex("by_status_and_expires_at", (q) =>
        q.eq("status", "active").lte("expiresAt", now),
      )
      .take(limit);
    for (const mandate of expired) {
      await ctx.db.patch(mandate._id, {
        status: "expired",
        stoppedAt: now,
        updatedAt: now,
      });
      result.expired += 1;
    }

    const active = await ctx.db
      .query("searchMandates")
      .withIndex("by_status_and_expires_at", (q) =>
        q.eq("status", "active").gt("expiresAt", now),
      )
      .take(limit);
    const owners = new Set<string>();
    for (const mandate of active) {
      if (owners.has(String(mandate.ownerId))) continue;
      owners.add(String(mandate.ownerId));
      const ownerResult = await orchestrateOwner(ctx, mandate.ownerId, 3);
      result.checked += ownerResult.checked;
      result.created += ownerResult.created;
      result.scheduled += ownerResult.scheduled;
      result.skipped += ownerResult.skipped;
      result.expired += ownerResult.expired;
    }
    return result;
  },
});
