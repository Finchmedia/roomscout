import { ConvexError, v } from "convex/values";
import { opportunityMatchIsCurrent, signalMatchRevision } from "./lib/matchValidity";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import { currentMessageSafety, messageSafetyContext, permitsAutonomy } from "./lib/messageSafety";
import { assertAcceptanceCurrent } from "./lib/offerAcceptance";
import { resolveControlledPortal } from "./lib/providerPortal";
import { setNeedStatus } from "./lib/needLifecycle";
import { scoutWorkpool } from "./workpools";
import { actionPayloadHash, canonicalJson, normalizeEmail, normalizeText } from "./integrations/contentHash";
import { requireUserId } from "./integrations/authz";
import { isDefaultAutopilotMandate } from "./mandates";
import { isUserResetTombstoned } from "./devUserReset";
import {
  portalBrowserProviderValidator,
  resolvePortalBrowserProvider,
  storedPortalBrowserProvider,
  type PortalBrowserProvider,
} from "./integrations/portalBrowserEngine";
import {
  authorizeFromMandate,
  containsBindingCommitment,
  countUniqueAttemptedRequests,
  type PersonalDataScope,
} from "./lib/mandateAuthorization";

const actionTypeValidator = v.union(
  v.literal("send_email"), v.literal("submit_webform"), v.literal("send_platform_dm"),
  v.literal("create_portal_account"), v.literal("publish_listing"),
  v.literal("share_contact_details"), v.literal("propose_visit_time"),
);
const BROWSER_WRITE_LOCK_MS = 8 * 60_000;
const personalDataValidator = v.union(
  v.literal("band_name"), v.literal("member_first_names"), v.literal("reply_email"),
  v.literal("phone"), v.literal("precise_location"), v.literal("availability"),
  v.literal("budget"), v.literal("music_profile"),
);
const payloadValidator = v.union(
  v.object({ kind: v.literal("platform_message"), threadId: v.optional(v.id("platformThreads")), targetPath: v.optional(v.string()), recipients: v.array(v.string()), senderLabel: v.optional(v.string()), subject: v.optional(v.string()), body: v.string() }),
  v.object({ kind: v.literal("contact_form"), targetUrl: v.string(), fields: v.array(v.object({ name: v.string(), label: v.optional(v.string()), value: v.string(), sensitivity: v.union(v.literal("normal"), v.literal("personal"), v.literal("sensitive")) })) }),
  v.object({ kind: v.literal("portal_account_operation"), connectionId: v.id("portalConnections"), operation: v.union(v.literal("connect"), v.literal("reauth"), v.literal("disconnect")), accountLabel: v.optional(v.string()) }),
  v.object({ kind: v.literal("email_message"), recipientName: v.string(), recipientEmail: v.string(), subject: v.string(), body: v.string(), mailThreadId: v.optional(v.id("mailThreads")), parentMessageId: v.optional(v.string()) }),
);
const statusValidator = v.union(
  v.literal("drafted"), v.literal("awaiting_approval"), v.literal("approved"),
  v.literal("rejected"), v.literal("queued"), v.literal("executing"),
  v.literal("executed"), v.literal("failed"), v.literal("cancelled"), v.literal("expired"),
);
const executorValidator = v.union(
  v.literal("firecrawl"),
  v.literal("browserbase"),
  v.literal("agentmail"),
);

function actionFlow(actionType: Doc<"actionRequests">["requestedActionType"], payload?: Doc<"actionRequests">["payload"]): "contact" | "reply" | "listing" | "auth" {
  if (payload?.kind === "email_message" && payload.mailThreadId) return "reply";
  if (actionType === "publish_listing") return "listing";
  if (actionType === "create_portal_account") return "auth";
  return "contact";
}

function cleanPayload(payload: Doc<"actionRequests">["payload"]): Doc<"actionRequests">["payload"] {
  if (payload.kind === "email_message") {
    if ((payload.mailThreadId === undefined) !== (payload.parentMessageId === undefined)) throw new ConvexError({ code: "INVALID_EMAIL_REPLY_ROUTE" });
    const email = normalizeEmail(payload.recipientEmail);
    const subject = normalizeText(payload.subject).slice(0, 200);
    const body = normalizeText(payload.body).slice(0, 20_000);
    if (!email.includes("@") || !subject || !body) throw new ConvexError({ code: "INVALID_EMAIL_ACTION" });
    return { ...payload, recipientName: normalizeText(payload.recipientName).slice(0, 160), recipientEmail: email, subject, body };
  }
  if (payload.kind === "platform_message") {
    const body = normalizeText(payload.body).slice(0, 20_000);
    if (!body || payload.recipients.length > 20) throw new ConvexError({ code: "INVALID_PLATFORM_ACTION" });
    const targetPath = payload.targetPath?.trim();
    if (targetPath && (!targetPath.startsWith("/") || targetPath.startsWith("//") || targetPath.includes("..") || /[?#\\]/.test(targetPath))) {
      throw new ConvexError({ code: "INVALID_PLATFORM_TARGET" });
    }
    return { ...payload, targetPath: targetPath?.slice(0, 500), recipients: [...new Set(payload.recipients.map((item) => normalizeText(item).slice(0, 320)).filter(Boolean))], senderLabel: payload.senderLabel ? normalizeText(payload.senderLabel).slice(0, 100) : undefined, subject: payload.subject ? normalizeText(payload.subject).slice(0, 200) : undefined, body };
  }
  if (payload.kind === "contact_form") {
    let url: URL;
    try { url = new URL(payload.targetUrl); } catch { throw new ConvexError({ code: "INVALID_FORM_URL" }); }
    if (url.protocol !== "https:" || payload.fields.length === 0 || payload.fields.length > 30) throw new ConvexError({ code: "INVALID_FORM_ACTION" });
    const names = new Set<string>();
    const fields = payload.fields.map((field) => {
      const name = normalizeText(field.name).slice(0, 120);
      const value = normalizeText(field.value).slice(0, 20_000);
      if (!name || names.has(name)) throw new ConvexError({ code: "INVALID_FORM_FIELD" });
      names.add(name);
      return { ...field, name, label: field.label ? normalizeText(field.label).slice(0, 160) : undefined, value };
    });
    url.hash = "";
    return { ...payload, targetUrl: url.toString(), fields };
  }
  return { ...payload, accountLabel: payload.accountLabel ? normalizeText(payload.accountLabel).slice(0, 160) : undefined };
}

/** Portal DOM readback may collapse layout whitespace. Preserve every
 * non-whitespace character and compare no other transformation. */
function normalizeProviderReadback(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function assertActionPayloadMatch(actionType: Doc<"actionRequests">["requestedActionType"], payload: Doc<"actionRequests">["payload"]): void {
  const valid =
    (actionType === "send_email" && payload.kind === "email_message") ||
    (actionType === "submit_webform" && payload.kind === "contact_form") ||
    (actionType === "send_platform_dm" && payload.kind === "platform_message") ||
    (actionType === "create_portal_account" && payload.kind === "portal_account_operation" && payload.operation === "connect") ||
    (["publish_listing", "share_contact_details", "propose_visit_time"] as string[]).includes(actionType) && (payload.kind === "platform_message" || payload.kind === "contact_form" || payload.kind === "email_message");
  if (!valid) throw new ConvexError({ code: "ACTION_PAYLOAD_MISMATCH" });
}

function hostMatchesPlatform(targetUrl: string, canonicalDomain: string): boolean {
  try {
    const target = new URL(targetUrl);
    const host = target.hostname.toLowerCase().replace(/^www\./, "");
    const domain = canonicalDomain.toLowerCase().replace(/^www\./, "");
    return target.protocol === "https:" && (host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function payloadHash(payload: Doc<"actionRequests">["payload"]): Promise<string> {
  return await actionPayloadHash(payload);
}

function actionPublic(
  row: Doc<"actionRequests">,
  executor?: "firecrawl" | "browserbase" | "agentmail" | "direct_api" | "manual",
  execution?: Doc<"actionExecutions"> | null,
  browserProvider?: PortalBrowserProvider,
) {
  return {
    _id: row._id, savedNeedId: row.savedNeedId, mandateId: row.mandateId,
    opportunityId: row.opportunityId, handoffId: row.handoffId,
    platformId: row.platformId, connectionId: row.connectionId,
    automationMode: row.automationMode, requestedActionType: row.requestedActionType,
    personalDataScopes: row.personalDataScopes, proposedMonthlyPriceEur: row.proposedMonthlyPriceEur,
    payload: row.payload, contentVersion: row.contentVersion, contentHash: row.contentHash,
    status: row.status, error: row.error, expiresAt: row.expiresAt,
    executor,
    browserProvider,
    execution: execution ? { id: execution._id, status: execution.status, error: execution.error,
      browserProvider: execution.browserProvider, updatedAt: execution.updatedAt } : undefined,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

const publicValidator = v.object({
  _id: v.id("actionRequests"), savedNeedId: v.optional(v.id("savedNeeds")),
  mandateId: v.optional(v.id("searchMandates")), opportunityId: v.optional(v.id("opportunities")),
  handoffId: v.optional(v.id("handoffs")), platformId: v.optional(v.id("sourcePlatforms")),
  connectionId: v.optional(v.id("portalConnections")), automationMode: v.union(v.literal("exact_once"), v.literal("standing_mandate")),
  requestedActionType: actionTypeValidator, personalDataScopes: v.array(personalDataValidator),
  proposedMonthlyPriceEur: v.optional(v.number()), payload: payloadValidator,
  contentVersion: v.number(), contentHash: v.string(), status: statusValidator,
  error: v.optional(v.string()), expiresAt: v.optional(v.number()), createdAt: v.number(), updatedAt: v.number(),
  executor: v.optional(v.union(v.literal("firecrawl"), v.literal("browserbase"), v.literal("agentmail"), v.literal("direct_api"), v.literal("manual"))),
  browserProvider: v.optional(portalBrowserProviderValidator),
  execution: v.optional(v.object({ id: v.id("actionExecutions"), status: v.union(v.literal("claimed"), v.literal("running"), v.literal("succeeded"), v.literal("failed"), v.literal("unknown")), error: v.optional(v.string()), browserProvider: v.optional(portalBrowserProviderValidator), updatedAt: v.number() })),
});

export const listMine = query({
  args: {
    limit: v.optional(v.number()),
    savedNeedId: v.optional(v.id("savedNeeds")),
  }, returns: v.array(publicValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    if (args.savedNeedId !== undefined) {
      const need = await ctx.db.get(args.savedNeedId);
      if (need?.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 30)));
    const rows = args.savedNeedId === undefined
      ? await ctx.db.query("actionRequests").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(limit)
      : await ctx.db.query("actionRequests").withIndex("by_owner_and_saved_need_and_updated_at", (q) => q.eq("ownerId", ownerId).eq("savedNeedId", args.savedNeedId)).order("desc").take(limit);
    return await Promise.all(rows.map(async (row) => {
      const [binding, executions, connection] = await Promise.all([
        row.adapterBindingId ? ctx.db.get(row.adapterBindingId) : Promise.resolve(null),
        ctx.db.query("actionExecutions").withIndex("by_request", (q) => q.eq("requestId", row._id)).order("desc").take(1),
        row.connectionId ? ctx.db.get(row.connectionId) : Promise.resolve(null),
      ]);
      const browserProvider = binding?.executor === "browserbase"
        ? storedPortalBrowserProvider(executions[0]?.browserProvider ?? connection?.browserProvider)
        : undefined;
      return actionPublic(row, binding?.executor, executions[0], browserProvider);
    }));
  },
});

export const createDraft = mutation({
  args: {
    savedNeedId: v.optional(v.id("savedNeeds")), mandateId: v.optional(v.id("searchMandates")),
    opportunityId: v.optional(v.id("opportunities")), handoffId: v.optional(v.id("handoffs")),
    platformId: v.optional(v.id("sourcePlatforms")), connectionId: v.optional(v.id("portalConnections")),
    policyVersionId: v.optional(v.id("sourceFlowPolicies")),
    adapterBindingId: v.optional(v.id("sourceAdapterBindings")),
    automationMode: v.union(v.literal("exact_once"), v.literal("standing_mandate")),
    requestedActionType: actionTypeValidator, personalDataScopes: v.array(personalDataValidator),
    proposedMonthlyPriceEur: v.optional(v.number()), payload: payloadValidator,
  },
  returns: v.id("actionRequests"),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = args.savedNeedId ? await ctx.db.get(args.savedNeedId) : null;
    if (args.savedNeedId && need?.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" });
    if (args.connectionId) { const connection = await ctx.db.get(args.connectionId); if (connection?.ownerId !== ownerId) throw new ConvexError({ code: "CONNECTION_NOT_FOUND" }); }
    if (args.mandateId) { const mandate = await ctx.db.get(args.mandateId); if (mandate?.ownerId !== ownerId) throw new ConvexError({ code: "MANDATE_NOT_FOUND" }); }
    const opportunity = args.opportunityId ? await ctx.db.get(args.opportunityId) : null;
    if (args.opportunityId && (opportunity?.ownerId !== ownerId || opportunity.savedNeedId !== args.savedNeedId)) throw new ConvexError({ code: "OPPORTUNITY_NOT_FOUND" });
    const signal = opportunity?.signalId ? await ctx.db.get(opportunity.signalId) : null;
    if (args.handoffId) { const handoff = await ctx.db.get(args.handoffId); if (handoff?.ownerId !== ownerId) throw new ConvexError({ code: "HANDOFF_NOT_FOUND" }); }
    const clean = cleanPayload(args.payload);
    assertActionPayloadMatch(args.requestedActionType, clean);
    const platform = args.platformId ? await ctx.db.get(args.platformId) : null;
    if (args.platformId && platform === null) throw new ConvexError({ code: "PLATFORM_NOT_FOUND" });
    if (clean.kind === "contact_form") {
      if (platform === null || !args.policyVersionId || !hostMatchesPlatform(clean.targetUrl, platform.canonicalDomain)) {
        throw new ConvexError({ code: "FORM_SOURCE_POLICY_REQUIRED" });
      }
      const policy = await ctx.db.get(args.policyVersionId);
      if (policy === null || policy.platformId !== platform._id || policy.flow !== "contact" || policy.status !== "approved" || policy.decision !== "allowed" || (policy.maxAutomationLevel !== "prepare_only" && policy.maxAutomationLevel !== "approved_execute")) {
        throw new ConvexError({ code: "FORM_SOURCE_POLICY_REQUIRED" });
      }
    }
    if (clean.kind === "platform_message" && !args.connectionId) throw new ConvexError({ code: "PORTAL_CONNECTION_REQUIRED" });
    if (args.adapterBindingId) {
      const binding = await ctx.db.get(args.adapterBindingId);
      if (binding === null || binding.status !== "active" || (args.platformId && binding.platformId !== args.platformId)) throw new ConvexError({ code: "ADAPTER_BINDING_NOT_ACTIVE" });
    }
    const now = Date.now();
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId, ...args, payload: clean,
      matchingNeedRevision: need ? need.matchingRevision ?? 0 : undefined,
      matchingSignalId: signal?._id,
      matchingSignalRevision: signal ? await signalMatchRevision(signal) : undefined,
      personalDataScopes: [...new Set(args.personalDataScopes)],
      contentVersion: 1, contentHash: await payloadHash(clean), status: "drafted",
      createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      eventKey: `action:${requestId}:drafted:1`,
      actorType: "user",
      actorUserId: ownerId,
      entityKey: `action:${requestId}`,
      eventType: "action.drafted",
      actionRequestId: requestId,
      afterHash: await payloadHash(clean),
      occurredAt: now,
    });
    return requestId;
  },
});

/**
 * Code-owned Scout bridge for a public listing that exposes a reviewed web
 * contact channel. The model supplies prose only; destination, field names,
 * source policy, and adapter binding are resolved from trusted Convex state.
 */
export const createContactFormFromScout = internalMutation({
  args: {
    ownerId: v.id("users"),
    savedNeedId: v.id("savedNeeds"),
    signalId: v.id("signals"),
    senderEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.object({
    requestId: v.id("actionRequests"),
    status: statusValidator,
    authorizedByAutopilot: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const [owner, need, signal] = await Promise.all([
      ctx.db.get(args.ownerId),
      ctx.db.get(args.savedNeedId),
      ctx.db.get(args.signalId),
    ]);
    if (owner === null || need?.ownerId !== args.ownerId || signal === null || !signal.sourceEntryId) {
      throw new ConvexError({ code: "SCOUT_CONTACT_CONTEXT_NOT_FOUND" });
    }
    const entry = await ctx.db.get(signal.sourceEntryId);
    const source = entry ? await ctx.db.get(entry.sourceId) : null;
    if (entry === null || source === null || !source.platformId) {
      throw new ConvexError({ code: "SCOUT_CONTACT_PLATFORM_NOT_FOUND" });
    }
    const contact = await ctx.db.query("signalContacts").withIndex("by_signal_and_kind", (q) =>
      q.eq("signalId", signal._id).eq("kind", "platform"),
    ).first();
    if (contact === null || !hostMatchesPlatform(contact.value, (await ctx.db.get(source.platformId))?.canonicalDomain ?? "")) {
      throw new ConvexError({ code: "SCOUT_WEBFORM_NOT_FOUND" });
    }
    const policies = await ctx.db.query("sourceFlowPolicies").withIndex("by_platform_and_status_and_next_review_at", (q) =>
      q.eq("platformId", source.platformId!).eq("status", "approved"),
    ).take(20);
    const policy = policies.find((candidate) =>
      candidate.flow === "contact" &&
      candidate.decision === "allowed" &&
      (candidate.maxAutomationLevel === "prepare_only" || candidate.maxAutomationLevel === "approved_execute") &&
      candidate.robotsDecision === "allowed" &&
      candidate.termsDecision === "allowed" &&
      (candidate.nextReviewAt === undefined || candidate.nextReviewAt >= Date.now()),
    );
    if (!policy) throw new ConvexError({ code: "SCOUT_CONTACT_POLICY_NOT_APPROVED" });
    const bindings = await ctx.db.query("sourceAdapterBindings").withIndex("by_platform_and_flow_and_status", (q) =>
      q.eq("platformId", source.platformId!).eq("flow", "contact").eq("status", "active"),
    ).take(20);
    const binding = bindings.find((candidate) => candidate.policyVersionId === policy._id && candidate.executor === "firecrawl" && candidate.config.kind === "firecrawl");
    if (!binding || binding.adapterKey !== "bandnet-contact-form-v1") {
      throw new ConvexError({ code: "SCOUT_CONTACT_ADAPTER_NOT_REVIEWED" });
    }
    const senderName = normalizeText(owner.displayName ?? owner.username).slice(0, 160);
    const senderEmail = normalizeEmail(args.senderEmail);
    const subject = normalizeText(args.subject).slice(0, 200);
    const body = normalizeText(args.body).slice(0, 20_000);
    if (!senderName || !senderEmail.includes("@") || !subject || !body) {
      throw new ConvexError({ code: "SCOUT_CONTACT_PAYLOAD_INVALID" });
    }
    const payload: Doc<"actionRequests">["payload"] = {
      kind: "contact_form",
      targetUrl: contact.value,
      fields: [
        { name: "name", label: "Dein Name", value: senderName, sensitivity: "personal" },
        { name: "email", label: "Deine E-Mail-Adresse", value: senderEmail, sensitivity: "personal" },
        { name: "subject", label: "Betreff", value: subject, sensitivity: "normal" },
        { name: "message", label: "Nachricht", value: body, sensitivity: "normal" },
      ],
    };
    const now = Date.now();
    const hash = await payloadHash(payload);
    const mandate = await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
      q.eq("ownerId", args.ownerId).eq("savedNeedId", need._id).eq("status", "active"),
    ).unique();
    let authorizedByAutopilot = false;
    if (mandate !== null && policy.maxAutomationLevel === "approved_execute") {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [executions, browserRuns, mailThreads, converted] = await Promise.all([
        ctx.db.query("actionExecutions").withIndex("by_owner_and_created_at", (q) =>
          q.eq("ownerId", args.ownerId).gte("createdAt", startOfDay.getTime()),
        ).take(100),
        ctx.db.query("browserRuns").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).order("desc").take(100),
        ctx.db.query("mailThreads").withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", args.ownerId)).order("desc").take(50),
        ctx.db.query("opportunities").withIndex("by_saved_need_and_status_and_updated_at", (q) =>
          q.eq("savedNeedId", need._id).eq("status", "converted"),
        ).take(1),
      ]);
      const browserMinutesUsedToday = browserRuns.reduce((total, run) => {
        const startedAt = run.startedAt ?? run.createdAt;
        if (startedAt < startOfDay.getTime()) return total;
        return total + Math.max(0, ((run.endedAt ?? now) - startedAt) / 60_000);
      }, 0);
      const skipUsageLimits = await isDefaultAutopilotMandate(ctx, mandate);
      const authorization = authorizeFromMandate({
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
        commitmentBoundary: mandate.commitmentBoundary,
        stoppedAt: mandate.stoppedAt,
      }, {
        now,
        actionType: "submit_webform",
        platformId: source.platformId,
        personalData: ["reply_email"],
        contactsAlreadyAttemptedToday: countUniqueAttemptedRequests(executions),
        browserMinutesUsedToday,
        policyDecision: policy.decision,
        policyAutomationLevel: policy.maxAutomationLevel,
        connectionActive: true,
        complaintRecorded: mailThreads.some((thread) => thread.lastDeliveryStatus === "complained"),
        suitableRoomConfirmed: converted.length > 0,
        bindingCommitment: containsBindingCommitment(payload),
        skipUsageLimits,
      });
      authorizedByAutopilot = authorization.authorized;
    }
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId: args.ownerId,
      savedNeedId: need._id,
      matchingNeedRevision: need.matchingRevision ?? 0,
      matchingSignalId: signal._id,
      matchingSignalRevision: await signalMatchRevision(signal),
      mandateId: authorizedByAutopilot ? mandate?._id : undefined,
      platformId: source.platformId,
      adapterBindingId: binding._id,
      policyVersionId: policy._id,
      automationMode: authorizedByAutopilot ? "standing_mandate" : "exact_once",
      requestedActionType: "submit_webform",
      personalDataScopes: ["reply_email"],
      payload,
      contentVersion: 1,
      contentHash: hash,
      status: authorizedByAutopilot ? "approved" : "awaiting_approval",
      expiresAt: authorizedByAutopilot && mandate ? Math.min(mandate.expiresAt, now + 24 * 60 * 60 * 1_000) : undefined,
      createdAt: now,
      updatedAt: now,
    });
    if (authorizedByAutopilot) {
      await ctx.db.patch(requestId, { status: "drafted" });
      const result = await submitRequest(ctx, args.ownerId, requestId);
      return { requestId, status: result.status, authorizedByAutopilot: result.authorizedByMandate };
    }
    await ctx.db.insert("auditEvents", { eventKey: `action:${requestId}:approval_requested:1`, actorType: "system", actorUserId: args.ownerId, entityKey: `action:${requestId}`, eventType: "action.scout_drafted_webform", actionRequestId: requestId, policyId: policy._id, afterHash: hash, occurredAt: now });
    return { requestId, status: "awaiting_approval" as const, authorizedByAutopilot: false };
  },
});

const submitResult = v.object({ status: statusValidator, authorizedByMandate: v.boolean(), reasons: v.array(v.string()) });
export const submit = mutation({
  args: { requestId: v.id("actionRequests") },
  returns: submitResult,
  handler: async (ctx, args) => submitRequest(ctx, await requireUserId(ctx), args.requestId),
});

export const submitChecked = internalMutation({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests") }, returns: submitResult,
  handler: async (ctx, args) => submitRequest(ctx, args.ownerId, args.requestId),
});

async function submitRequest(ctx: MutationCtx, ownerId: Id<"users">, requestId: Id<"actionRequests">): Promise<{
  status: Doc<"actionRequests">["status"]; authorizedByMandate: boolean; reasons: string[];
}> {
    const args = { requestId };
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== ownerId) throw new ConvexError({ code: "ACTION_NOT_FOUND" });
    if (["queued", "approved", "executing", "executed"].includes(request.status)) {
      const approval = await ctx.db.query("actionApprovals")
        .withIndex("by_request_and_content_version", (q) => q.eq("requestId", request._id).eq("contentVersion", request.contentVersion))
        .unique();
      return {
        status: request.status,
        authorizedByMandate: request.status !== "queued" && approval?.decision === "authorized_by_mandate" && approval.ownerId === ownerId && approval.contentHash === request.contentHash,
        reasons: [],
      };
    }
    if (request.status !== "drafted") throw new ConvexError({ code: "INVALID_ACTION_STATE" });
    if (request.providerActionKind === "acceptance") throw new ConvexError({ code: "ACCEPTANCE_REVIEW_REQUIRED" });
    if (request.automationMode !== "standing_mandate" || !request.mandateId) {
      const now = Date.now();
      await ctx.db.patch(request._id, { status: "awaiting_approval", updatedAt: now });
      await ctx.db.insert("auditEvents", { eventKey: `action:${request._id}:approval_requested:${request.contentVersion}`, actorType: "user", actorUserId: ownerId, entityKey: `action:${request._id}`, eventType: "action.approval_requested", actionRequestId: request._id, afterHash: request.contentHash, occurredAt: now });
      return { status: "awaiting_approval" as const, authorizedByMandate: false, reasons: [] };
    }
    const mandate = await ctx.db.get(request.mandateId);
    if (mandate === null || mandate.ownerId !== ownerId || mandate.savedNeedId !== request.savedNeedId || mandate.status !== "active") {
      await ctx.db.patch(request._id, { status: "awaiting_approval", updatedAt: Date.now() });
      return { status: "awaiting_approval" as const, authorizedByMandate: false, reasons: ["The selected standing mandate is not valid for this search."] };
    }
    const platform = request.platformId ? await ctx.db.get(request.platformId) : null;
    const isOwnedMailReply = request.payload.kind === "email_message" && request.payload.mailThreadId !== undefined && request.payload.parentMessageId !== undefined;
    if (request.payload.kind !== "portal_account_operation" && !isOwnedMailReply && platform?.canonicalDomain !== "roomscout.dev") {
      await ctx.db.patch(request._id, { status: "awaiting_approval", error: "CONTROLLED_DEMO_ONLY", updatedAt: Date.now() });
      return { status: "awaiting_approval", authorizedByMandate: false, reasons: ["Autonomous demo communication is restricted to roomscout.dev."] };
    }
    const semantic = request.payload.kind === "portal_account_operation" ? null : await currentMessageSafety(ctx, request);
    if (request.payload.kind !== "portal_account_operation" && !semantic) {
      if (!await messageSafetyContext(ctx, request)) {
        await ctx.db.patch(request._id, { status: "expired", error: "MESSAGE_CONTEXT_CHANGED", updatedAt: Date.now() });
        return { status: "expired", authorizedByMandate: false, reasons: ["The search or provider conversation changed."] };
      }
      await ctx.db.patch(request._id, { status: "queued", updatedAt: Date.now() });
      await scoutWorkpool.enqueueAction(ctx, internal.messageSafety.assessAndAuthorize, { requestId: request._id }, {
        onComplete: internal.messageSafety.assessmentCompleted, context: { requestId: request._id, contentVersion: request.contentVersion },
      });
      return { status: "queued", authorizedByMandate: false, reasons: ["Scout is checking the final message before authorization."] };
    }
    if (semantic && !permitsAutonomy(semantic.assessment)) {
      await ctx.db.patch(request._id, { status: "awaiting_approval", error: "MESSAGE_REQUIRES_REVIEW", updatedAt: Date.now() });
      return { status: "awaiting_approval", authorizedByMandate: false, reasons: [semantic.assessment.explanation] };
    }
    const policy = request.policyVersionId ? await ctx.db.get(request.policyVersionId) : null;
    const connection = request.connectionId ? await ctx.db.get(request.connectionId) : null;
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const executions = await ctx.db.query("actionExecutions").withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId).gte("createdAt", startOfDay.getTime())).take(100);
    const browserRuns = await ctx.db.query("browserRuns").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).order("desc").take(100);
    const mailThreads = await ctx.db.query("mailThreads").withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(50);
    const converted = request.savedNeedId
      ? await ctx.db.query("opportunities").withIndex("by_saved_need_and_status_and_updated_at", (q) => q.eq("savedNeedId", request.savedNeedId!).eq("status", "converted")).take(1)
      : [];
    const browserMinutesUsedToday = browserRuns.reduce((total, run) => {
      const startedAt = run.startedAt ?? run.createdAt;
      if (startedAt < startOfDay.getTime()) return total;
      return total + Math.max(0, ((run.endedAt ?? Date.now()) - startedAt) / 60_000);
    }, 0);
    const skipUsageLimits = await isDefaultAutopilotMandate(ctx, mandate);
    const decision = authorizeFromMandate({
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
      commitmentBoundary: mandate.commitmentBoundary,
      stoppedAt: mandate.stoppedAt,
    }, {
      now: Date.now(), actionType: request.requestedActionType,
      platformId: request.platformId, personalData: [...new Set([...request.personalDataScopes, ...(semantic?.assessment.personalDataScopes ?? [])])] as PersonalDataScope[],
      contactsAlreadyAttemptedToday: countUniqueAttemptedRequests(executions),
      browserMinutesUsedToday,
      proposedMonthlyPriceEur: semantic?.assessment.proposedMonthlyPriceEur ?? request.proposedMonthlyPriceEur,
      policyDecision: policy?.decision ?? "unknown",
      policyAutomationLevel: policy?.maxAutomationLevel ?? "disabled",
      connectionActive: connection?.ownerId === ownerId && connection.status === "active",
      complaintRecorded: mailThreads.some((thread) => thread.lastDeliveryStatus === "complained"),
      suitableRoomConfirmed: converted.length > 0,
      bindingCommitment: semantic ? semantic.assessment.classification !== "non_binding" : containsBindingCommitment(request.payload),
      skipUsageLimits,
    });
    if (!decision.authorized) {
      await ctx.db.patch(request._id, { status: "awaiting_approval", updatedAt: Date.now() });
      return { status: "awaiting_approval" as const, authorizedByMandate: false, reasons: decision.reasons };
    }
    const now = Date.now();
    await ctx.db.insert("actionApprovals", {
      requestId: request._id, ownerId, contentVersion: request.contentVersion,
      contentHash: request.contentHash, payloadSnapshot: request.payload,
      policyVersionId: request.policyVersionId, decision: "authorized_by_mandate",
      mandateId: mandate._id, mandateVersion: mandate.version, mandateHash: mandate.contentHash,
      decidedAt: now,
    });
    await ctx.db.patch(request._id, { status: "approved", updatedAt: now });
    await ctx.db.insert("auditEvents", { eventKey: `action:${request._id}:mandate_authorized:${request.contentVersion}`, actorType: "system", actorUserId: ownerId, entityKey: `action:${request._id}`, eventType: "action.authorized_by_mandate", actionRequestId: request._id, policyId: request.policyVersionId, afterHash: request.contentHash, occurredAt: now });
    return { status: "approved" as const, authorizedByMandate: true, reasons: [] };
}

export const decide = mutation({
  args: { requestId: v.id("actionRequests"), decision: v.union(v.literal("approved"), v.literal("rejected")), expectedContentVersion: v.number(), expectedContentHash: v.string(), expectedPayload: payloadValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== ownerId) throw new ConvexError({ code: "ACTION_NOT_FOUND" });
    if (request.status !== "awaiting_approval") throw new ConvexError({ code: "INVALID_ACTION_STATE" });
    if (request.providerActionKind === "acceptance" && args.decision === "approved") throw new ConvexError({ code: "ACCEPTANCE_REVIEW_REQUIRED" });
    const expected = cleanPayload(args.expectedPayload);
    if (request.contentVersion !== args.expectedContentVersion || request.contentHash !== args.expectedContentHash || await payloadHash(expected) !== request.contentHash || canonicalJson(expected) !== canonicalJson(request.payload)) {
      throw new ConvexError({ code: "ACTION_CONTENT_CHANGED" });
    }
    const now = Date.now();
    await ctx.db.insert("actionApprovals", { requestId: request._id, ownerId, contentVersion: request.contentVersion, contentHash: request.contentHash, payloadSnapshot: request.payload, policyVersionId: request.policyVersionId, decision: args.decision, decidedAt: now });
    await ctx.db.patch(request._id, { status: args.decision === "approved" ? "approved" : "rejected", updatedAt: now });
    await ctx.db.insert("auditEvents", { eventKey: `action:${request._id}:${args.decision}:${request.contentVersion}`, actorType: "user", actorUserId: ownerId, entityKey: `action:${request._id}`, eventType: `action.${args.decision}`, actionRequestId: request._id, policyId: request.policyVersionId, afterHash: request.contentHash, occurredAt: now });
    return null;
  },
});

export const getApprovedContactForm = internalQuery({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests") },
  returns: v.union(v.object({ targetUrl: v.string(), fields: v.array(v.object({ name: v.string(), label: v.optional(v.string()), value: v.string(), sensitivity: v.union(v.literal("normal"), v.literal("personal"), v.literal("sensitive")) })) }), v.null()),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== args.ownerId || request.status !== "approved" || request.payload.kind !== "contact_form" || !request.platformId || !request.policyVersionId) return null;
    const approval = await ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) => q.eq("requestId", request._id).eq("contentVersion", request.contentVersion)).unique();
    if (approval === null || approval.contentHash !== request.contentHash || canonicalJson(approval.payloadSnapshot) !== canonicalJson(request.payload)) return null;
    const [platform, policy] = await Promise.all([ctx.db.get(request.platformId), ctx.db.get(request.policyVersionId)]);
    if (platform === null || policy === null || policy.platformId !== platform._id || policy.flow !== "contact" || policy.status !== "approved" || policy.decision !== "allowed" || (policy.maxAutomationLevel !== "prepare_only" && policy.maxAutomationLevel !== "approved_execute") || !hostMatchesPlatform(request.payload.targetUrl, platform.canonicalDomain)) return null;
    return { targetUrl: request.payload.targetUrl, fields: request.payload.fields };
  },
});

export const markPreparing = internalMutation({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests"), providerActionId: v.string() },
  returns: v.id("actionExecutions"),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== args.ownerId || request.status !== "approved") throw new ConvexError({ code: "ACTION_NOT_APPROVED" });
    const approval = await ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) => q.eq("requestId", request._id).eq("contentVersion", request.contentVersion)).unique();
    if (approval === null || approval.contentHash !== request.contentHash) throw new ConvexError({ code: "APPROVAL_MISMATCH" });
    const idempotencyKey = `action:${request._id}:${request.contentVersion}:${request.contentHash}`;
    const existing = await ctx.db.query("actionExecutions").withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", idempotencyKey)).unique();
    if (existing !== null) return existing._id;
    const now = Date.now();
    const executionId = await ctx.db.insert("actionExecutions", { requestId: request._id, ownerId: args.ownerId, approvalId: approval._id, platformId: request.platformId, connectionId: request.connectionId, adapterBindingId: request.adapterBindingId, status: "running", idempotencyKey, providerActionId: args.providerActionId, startedAt: now, createdAt: now, updatedAt: now });
    await ctx.db.patch(request._id, { status: "executing", executionIdempotencyKey: idempotencyKey, updatedAt: now });
    return executionId;
  },
});

export const recordBrowserSessionBusy = internalMutation({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (request?.ownerId === args.ownerId && request.status === "approved") {
      const now = Date.now();
      await ctx.db.patch(request._id, { error: "BROWSER_SESSION_BUSY", updatedAt: now });
      await ctx.db.insert("notifications", { ownerId: args.ownerId, kind: "system", title: "Portal action is waiting",
        body: "The controlled portal is busy with another session. Nothing was sent; try again after that session finishes.", createdAt: now });
    }
    return null;
  },
});

export const confirmHumanCompleted = mutation({
  args: { requestId: v.id("actionRequests"), submitted: v.boolean() }, returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== ownerId || request.status !== "executing" || !request.executionIdempotencyKey) throw new ConvexError({ code: "ACTION_NOT_EXECUTING" });
    const execution = await ctx.db.query("actionExecutions").withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", request.executionIdempotencyKey!)).unique();
    if (execution === null || execution.ownerId !== ownerId) throw new ConvexError({ code: "EXECUTION_NOT_FOUND" });
    const now = Date.now();
    await ctx.db.patch(execution._id, { status: args.submitted ? "succeeded" : "failed", completedAt: now, error: args.submitted ? undefined : "USER_DID_NOT_SUBMIT", updatedAt: now });
    await ctx.db.patch(request._id, { status: args.submitted ? "executed" : "cancelled", error: args.submitted ? undefined : "USER_DID_NOT_SUBMIT", updatedAt: now });
    if (args.submitted && request.opportunityId) {
      const opportunity = await ctx.db.get(request.opportunityId);
      if (opportunity?.ownerId === ownerId && opportunity.status !== "converted" && opportunity.status !== "dismissed") {
        await ctx.db.patch(opportunity._id, { status: "contacted", mandateId: request.mandateId, updatedAt: now });
      }
    }
    await ctx.db.insert("auditEvents", { eventKey: `action:${request._id}:human_completed:${execution.idempotencyKey}`, actorType: "user", actorUserId: ownerId, entityKey: `action:${request._id}`, eventType: args.submitted ? "action.human_confirmed_submitted" : "action.human_cancelled", correlationId: execution.idempotencyKey, actionRequestId: request._id, executionId: execution._id, afterHash: request.contentHash, occurredAt: now });
    return null;
  },
});

export const confirmHumanExecution = internalMutation({
  args: {
    ownerId: v.id("users"),
    requestId: v.id("actionRequests"),
    executionId: v.id("actionExecutions"),
    submitted: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const [request, execution] = await Promise.all([
      ctx.db.get(args.requestId),
      ctx.db.get(args.executionId),
    ]);
    if (
      request === null || request.ownerId !== args.ownerId || request.status !== "executing" || !request.executionIdempotencyKey ||
      execution === null || execution.ownerId !== args.ownerId || execution.requestId !== request._id || execution.idempotencyKey !== request.executionIdempotencyKey ||
      (execution.status !== "running" && execution.status !== "unknown")
    ) {
      throw new ConvexError({ code: "HUMAN_EXECUTION_NOT_CONFIRMABLE" });
    }
    const now = Date.now();
    await ctx.db.patch(execution._id, { status: args.submitted ? "succeeded" : "failed", completedAt: now, error: args.submitted ? undefined : "USER_DID_NOT_SUBMIT", updatedAt: now });
    await ctx.db.patch(request._id, { status: args.submitted ? "executed" : "cancelled", error: args.submitted ? undefined : "USER_DID_NOT_SUBMIT", updatedAt: now });
    if (args.submitted && request.opportunityId) {
      const opportunity = await ctx.db.get(request.opportunityId);
      if (opportunity?.ownerId === args.ownerId && opportunity.status !== "converted" && opportunity.status !== "dismissed") {
        await ctx.db.patch(opportunity._id, { status: "contacted", mandateId: request.mandateId, updatedAt: now });
      }
    }
    await ctx.db.insert("auditEvents", { eventKey: `action:${request._id}:human_completed:${execution.idempotencyKey}`, actorType: "user", actorUserId: args.ownerId, entityKey: `action:${request._id}`, eventType: args.submitted ? "action.human_confirmed_submitted" : "action.human_cancelled", correlationId: execution.idempotencyKey, actionRequestId: request._id, executionId: execution._id, afterHash: request.contentHash, occurredAt: now });
    return null;
  },
});

export const getPreparedInteraction = internalQuery({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests") },
  returns: v.union(v.object({ executionId: v.id("actionExecutions"), jobId: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== args.ownerId || request.status !== "executing" || !request.executionIdempotencyKey) return null;
    const execution = await ctx.db.query("actionExecutions").withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", request.executionIdempotencyKey!)).unique();
    if (execution === null || execution.ownerId !== args.ownerId || !execution.providerActionId) return null;
    return { executionId: execution._id, jobId: execution.providerActionId };
  },
});

export const cancelPreparedInteraction = internalMutation({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== args.ownerId || !request.executionIdempotencyKey) return null;
    const execution = await ctx.db.query("actionExecutions").withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", request.executionIdempotencyKey!)).unique();
    const now = Date.now();
    if (execution !== null && execution.ownerId === args.ownerId && execution.status === "running") {
      await ctx.db.patch(execution._id, { status: "failed", completedAt: now, error: args.error.slice(0, 500), updatedAt: now });
    }
    await ctx.db.patch(request._id, { status: "cancelled", error: args.error.slice(0, 500), updatedAt: now });
    return null;
  },
});

const claimedActionValidator = v.object({
  executionId: v.id("actionExecutions"),
  executionStatus: v.union(
    v.literal("claimed"),
    v.literal("running"),
    v.literal("succeeded"),
    v.literal("failed"),
    v.literal("unknown"),
  ),
  alreadyClaimed: v.boolean(),
  requestedActionType: actionTypeValidator,
  payload: payloadValidator,
  platformId: v.id("sourcePlatforms"),
  platformDomain: v.string(),
  connectionId: v.optional(v.id("portalConnections")),
  bindingId: v.id("sourceAdapterBindings"),
  adapterKey: v.string(),
  adapterVersion: v.number(),
  adapterConfig: v.union(
    v.object({ kind: v.literal("firecrawl"), extractionProfileKey: v.string(), monitorDriven: v.boolean() }),
    v.object({ kind: v.literal("browserbase"), workflowKey: v.string(), contextRequired: v.boolean() }),
    v.object({ kind: v.literal("agentmail"), purpose: v.union(v.literal("outreach"), v.literal("reply")) }),
    v.object({ kind: v.literal("direct_api"), integrationKey: v.string() }),
    v.object({ kind: v.literal("manual"), instructionKey: v.string() }),
  ),
  humanPresenceRequired: v.boolean(),
  browserProvider: v.optional(portalBrowserProviderValidator),
});

/**
 * Final transactional gate before any provider write. Provider actions must
 * claim here first; approval at draft time is never treated as sufficient.
 */
export const claimForExecutor = internalMutation({
  args: {
    ownerId: v.id("users"),
    requestId: v.id("actionRequests"),
    executor: executorValidator,
  },
  returns: claimedActionValidator,
  handler: async (ctx, args) => {
    if (args.executor === "browserbase") {
      const maintenance = await ctx.db.query("portalBrowserMaintenance").withIndex("by_key", (q) => q.eq("key", "controlled_portal")).unique();
      if (maintenance?.paused) throw new ConvexError({ code: "PORTAL_BROWSER_MAINTENANCE_PAUSED" });
    }
    const request = await ctx.db.get(args.requestId);
    if (
      request === null ||
      request.ownerId !== args.ownerId ||
      (request.status !== "approved" && request.status !== "executing") ||
      !request.platformId ||
      !request.policyVersionId ||
      !request.adapterBindingId
    ) {
      throw new ConvexError({ code: "ACTION_NOT_EXECUTABLE" });
    }
    if (request.expiresAt !== undefined && request.expiresAt <= Date.now()) {
      throw new ConvexError({ code: "ACTION_EXPIRED" });
    }
    if (request.providerConversationId && !await messageSafetyContext(ctx, request)) {
      throw new ConvexError({ code: "PROVIDER_CONVERSATION_CHANGED" });
    }
    if (request.payload.kind === "email_message" && request.payload.mailThreadId && request.payload.parentMessageId) {
      const thread = await ctx.db.get(request.payload.mailThreadId);
      const conversation = request.providerConversationId ? await ctx.db.get(request.providerConversationId) : null;
      const mailbox = thread?.mailboxId ? await ctx.db.get(thread.mailboxId) : null;
      const messages = thread ? await ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) => q.eq("threadId", thread._id)).order("desc").take(20) : [];
      const parent = messages.find((message) => message.direction === "inbound");
      if (!thread || thread.ownerId !== args.ownerId || conversation?.mailThreadId !== thread._id || !mailbox || mailbox.ownerId !== args.ownerId || mailbox.status !== "active" ||
        !parent || parent.providerMessageId !== request.payload.parentMessageId || normalizeEmail(parent.from) !== request.payload.recipientEmail) {
        throw new ConvexError({ code: "EMAIL_REPLY_CONTEXT_CHANGED" });
      }
    }
    if (request.savedNeedId) {
      const need = await ctx.db.get(request.savedNeedId);
      const otherAcceptance = need?.acceptanceRequestId && need.acceptanceRequestId !== request._id
        ? await ctx.db.get(need.acceptanceRequestId) : null;
      if (otherAcceptance && ["approved", "executing", "executed"].includes(otherAcceptance.status)) {
        throw new ConvexError({ code: "ANOTHER_ACCEPTANCE_IN_PROGRESS" });
      }
    }
    const startsConversation = request.payload.kind === "contact_form" || (request.payload.kind === "email_message" && !request.payload.mailThreadId) ||
      (request.payload.kind === "platform_message" && !request.payload.threadId);
    if (startsConversation && request.savedNeedId) {
      const need = await ctx.db.get(request.savedNeedId);
      if (!need || need.ownerId !== args.ownerId || need.status !== "active" ||
        (need.matchingRevision ?? 0) !== (request.matchingNeedRevision ?? 0)) {
        throw new ConvexError({ code: "ACTION_SEARCH_CHANGED" });
      }
    }
    if (startsConversation && request.matchingSignalId) {
      const signal = await ctx.db.get(request.matchingSignalId);
      if (!signal || signal.status !== "published" || request.matchingSignalRevision !== await signalMatchRevision(signal)) {
        throw new ConvexError({ code: "ACTION_SIGNAL_CHANGED" });
      }
    }
    if (request.opportunityId && startsConversation) {
      const opportunity = await ctx.db.get(request.opportunityId);
      if (!opportunity || opportunity.ownerId !== args.ownerId || !await opportunityMatchIsCurrent(ctx, opportunity, true)) {
        throw new ConvexError({ code: "OPPORTUNITY_NO_LONGER_MATCHES" });
      }
      const signal = opportunity.signalId ? await ctx.db.get(opportunity.signalId) : null;
      if (!signal || request.matchingSignalRevision !== await signalMatchRevision(signal)) {
        throw new ConvexError({ code: "ACTION_SIGNAL_CHANGED" });
      }
    }
    const [approval, platform, policy, binding, connection] = await Promise.all([
      ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) =>
        q.eq("requestId", request._id).eq("contentVersion", request.contentVersion),
      ).unique(),
      ctx.db.get(request.platformId),
      ctx.db.get(request.policyVersionId),
      ctx.db.get(request.adapterBindingId),
      request.connectionId ? ctx.db.get(request.connectionId) : Promise.resolve(null),
    ]);
    const flow = actionFlow(request.requestedActionType, request.payload);
    const isPortalExecution = args.executor === "browserbase" && connection !== null;
    const browserProvider: PortalBrowserProvider | undefined = isPortalExecution
      ? resolvePortalBrowserProvider()
      : undefined;
    if (
      approval === null ||
      approval.ownerId !== args.ownerId ||
      approval.decision === "rejected" ||
      approval.contentHash !== request.contentHash ||
      canonicalJson(approval.payloadSnapshot) !== canonicalJson(request.payload) ||
      platform === null ||
      policy === null ||
      binding === null ||
      policy.platformId !== platform._id ||
      policy.flow !== flow ||
      policy.status !== "approved" ||
      policy.decision !== "allowed" ||
      policy.maxAutomationLevel !== "approved_execute" ||
      policy.robotsDecision !== "allowed" ||
      policy.termsDecision !== "allowed" ||
      (policy.nextReviewAt !== undefined && policy.nextReviewAt < Date.now()) ||
      binding.platformId !== platform._id ||
      binding.flow !== flow ||
      binding.status !== "active" ||
      binding.executor !== args.executor ||
      binding.config.kind !== args.executor ||
      binding.policyVersionId !== policy._id
    ) {
      throw new ConvexError({ code: "EXECUTION_POLICY_CHANGED" });
    }
    if (request.payload.kind === "contact_form" && !hostMatchesPlatform(request.payload.targetUrl, platform.canonicalDomain)) {
      throw new ConvexError({ code: "EXECUTION_DOMAIN_CHANGED" });
    }
    if (
      args.executor === "browserbase" &&
      (connection === null || connection.ownerId !== args.ownerId || connection.status !== "active" || connection.policyDecision !== "allowed")
    ) {
      throw new ConvexError({ code: "PORTAL_CONNECTION_NOT_ACTIVE" });
    }
    if (isPortalExecution && connection) {
      if (storedPortalBrowserProvider(connection.browserProvider) !== browserProvider) {
        throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_RECONNECT_REQUIRED" });
      }
      const portalContext = await ctx.db.query("browserContexts").withIndex("by_connection", (q) =>
        q.eq("connectionId", connection._id),
      ).order("desc").first();
      if (browserProvider === "firecrawl") {
        let samePendingWrite = false;
        if (portalContext?.status === "creating" && portalContext.pendingWriteExecutionId !== undefined &&
          portalContext.writeProofGeneration !== undefined &&
          connection.activeWriteExecutionId === portalContext.pendingWriteExecutionId &&
          (connection.activeWriteDeadlineAt ?? 0) > Date.now()) {
          const pendingExecution = await ctx.db.get(portalContext.pendingWriteExecutionId);
          samePendingWrite = pendingExecution !== null &&
            pendingExecution.ownerId === args.ownerId &&
            pendingExecution.requestId === request._id &&
            pendingExecution.connectionId === connection._id &&
            storedPortalBrowserProvider(pendingExecution.browserProvider) === "firecrawl" &&
            ["claimed", "running"].includes(pendingExecution.status);
        }
        if (!portalContext || storedPortalBrowserProvider(portalContext.browserProvider) !== browserProvider ||
          (portalContext.status !== "ready" && !samePendingWrite)) {
          throw new ConvexError({ code: "PORTAL_CONTEXT_NOT_READY" });
        }
      }
    }

    if (request.providerActionKind === "acceptance") {
      const current = await assertAcceptanceCurrent(ctx, request);
      const target = await resolveControlledPortal(ctx, current.conversation, current.signal, Date.now());
      if (approval.decision !== "approved" || approval.providerOfferId !== request.providerOfferId ||
        approval.providerOfferHash !== request.providerOfferHash || approval.reviewContextHash !== request.reviewContextHash ||
        approval.reviewDestinationHash !== request.reviewDestinationHash ||
        args.executor !== "browserbase" || !target || target.connection._id !== request.connectionId ||
        target.thread?._id !== (request.payload.kind === "platform_message" ? request.payload.threadId : undefined) ||
        target.binding._id !== request.adapterBindingId || target.policy._id !== request.policyVersionId) {
        throw new ConvexError({ code: "ACCEPTANCE_APPROVAL_MISMATCH" });
      }
    }

    if (approval.decision === "authorized_by_mandate") {
      const isOwnedMailReply = request.payload.kind === "email_message" && request.payload.mailThreadId !== undefined && request.payload.parentMessageId !== undefined;
      if (request.payload.kind !== "portal_account_operation" && !isOwnedMailReply && platform.canonicalDomain !== "roomscout.dev") {
        throw new ConvexError({ code: "CONTROLLED_DEMO_ONLY" });
      }
      const semantic = request.payload.kind === "portal_account_operation" ? null : await currentMessageSafety(ctx, request);
      if (request.payload.kind !== "portal_account_operation" && (!semantic || !permitsAutonomy(semantic.assessment))) {
        throw new ConvexError({ code: "FINAL_MESSAGE_NOT_CLEARED" });
      }
      if (!approval.mandateId || approval.mandateVersion === undefined || !approval.mandateHash) {
        throw new ConvexError({ code: "MANDATE_SNAPSHOT_MISSING" });
      }
      const mandate = await ctx.db.get(approval.mandateId);
      if (
        mandate === null ||
        mandate.ownerId !== args.ownerId ||
        mandate.status !== "active" ||
        mandate.version !== approval.mandateVersion ||
        mandate.contentHash !== approval.mandateHash ||
        mandate.savedNeedId !== request.savedNeedId
      ) {
        throw new ConvexError({ code: "MANDATE_CHANGED" });
      }
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const [executions, runs, complainedThreads, converted] = await Promise.all([
        ctx.db.query("actionExecutions").withIndex("by_owner_and_created_at", (q) =>
          q.eq("ownerId", args.ownerId).gte("createdAt", startOfDay.getTime()),
        ).take(100),
        ctx.db.query("browserRuns").withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId)).order("desc").take(100),
        ctx.db.query("mailThreads").withIndex("by_owner_and_last_message_at", (q) => q.eq("ownerId", args.ownerId)).order("desc").take(50),
        request.savedNeedId
          ? ctx.db.query("opportunities").withIndex("by_saved_need_and_status_and_updated_at", (q) =>
              q.eq("savedNeedId", request.savedNeedId!).eq("status", "converted"),
            ).take(1)
          : Promise.resolve([]),
      ]);
      const browserMinutes = runs.reduce((sum, run) => {
        const startedAt = run.startedAt ?? run.createdAt;
        if (startedAt < startOfDay.getTime()) return sum;
        return sum + Math.max(0, ((run.endedAt ?? Date.now()) - startedAt) / 60_000);
      }, 0);
      const skipUsageLimits = await isDefaultAutopilotMandate(ctx, mandate);
      const authorization = authorizeFromMandate({
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
        commitmentBoundary: mandate.commitmentBoundary,
        stoppedAt: mandate.stoppedAt,
      }, {
        now: Date.now(),
        actionType: request.requestedActionType,
        platformId: request.platformId,
        personalData: [...new Set([...request.personalDataScopes, ...(semantic?.assessment.personalDataScopes ?? [])])] as PersonalDataScope[],
        // Re-claiming or resuming the same idempotent request must not consume
        // another contact slot. Other requests still count, including failed
        // attempts, because they may already have reached the recipient.
        contactsAlreadyAttemptedToday: countUniqueAttemptedRequests(
          executions.filter((execution) => execution.requestId !== request._id),
        ),
        browserMinutesUsedToday: browserMinutes,
        proposedMonthlyPriceEur: semantic?.assessment.proposedMonthlyPriceEur ?? request.proposedMonthlyPriceEur,
        policyDecision: policy.decision,
        policyAutomationLevel: policy.maxAutomationLevel,
        connectionActive: args.executor !== "browserbase" || connection?.status === "active",
        complaintRecorded: complainedThreads.some((thread) => thread.lastDeliveryStatus === "complained"),
        suitableRoomConfirmed: converted.length > 0,
        bindingCommitment: semantic ? semantic.assessment.classification !== "non_binding" : containsBindingCommitment(request.payload),
        skipUsageLimits,
      });
      if (!authorization.authorized) {
        throw new ConvexError({ code: "MANDATE_NO_LONGER_AUTHORIZES", reasons: authorization.reasons });
      }
    }

    const idempotencyKey = `action:${request._id}:${request.contentVersion}:${request.contentHash}`;
    const existing = await ctx.db.query("actionExecutions").withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", idempotencyKey),
    ).unique();
    if (existing !== null) {
      if (browserProvider !== undefined && storedPortalBrowserProvider(existing.browserProvider) !== browserProvider) {
        throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
      }
      return {
        executionId: existing._id,
        executionStatus: existing.status,
        alreadyClaimed: true,
        requestedActionType: request.requestedActionType,
        payload: request.payload,
        platformId: platform._id,
        platformDomain: platform.canonicalDomain,
        connectionId: request.connectionId,
        bindingId: binding._id,
        adapterKey: binding.adapterKey,
        adapterVersion: binding.adapterVersion,
        adapterConfig: binding.config,
        humanPresenceRequired: policy.humanPresenceRequired,
        browserProvider,
      };
    }
    const now = Date.now();
    if (args.executor === "browserbase") {
      if (connection === null) throw new ConvexError({ code: "PORTAL_CONNECTION_NOT_ACTIVE" });
      if (connection.inboxSyncActiveGeneration !== undefined && (connection.inboxSyncDeadlineAt ?? 0) > now) {
        throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
      }
      if (connection.activeWriteExecutionId && (connection.activeWriteDeadlineAt ?? 0) > now) {
        throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
      }
      const connectionRuns = await ctx.db.query("browserRuns").withIndex("by_connection", (q) =>
        q.eq("connectionId", connection._id),
      ).order("desc").take(20);
      if (connectionRuns.some((run) => ["queued", "running", "human_required"].includes(run.status))) {
        throw new ConvexError({ code: "BROWSER_SESSION_BUSY" });
      }
    }
    const executionId = await ctx.db.insert("actionExecutions", {
      requestId: request._id,
      ownerId: args.ownerId,
      approvalId: approval._id,
      platformId: platform._id,
      connectionId: request.connectionId,
      adapterBindingId: binding._id,
      browserProvider,
      status: "claimed",
      idempotencyKey,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    if (args.executor === "browserbase" && connection !== null) {
      await ctx.db.patch(connection._id, { activeWriteExecutionId: executionId,
        activeWriteDeadlineAt: now + BROWSER_WRITE_LOCK_MS, updatedAt: now });
    }
    await ctx.db.patch(request._id, {
      status: "executing",
      executionIdempotencyKey: idempotencyKey,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", {
      eventKey: `action:${request._id}:claimed:${request.contentVersion}`,
      actorType: approval.decision === "authorized_by_mandate" ? "system" : "user",
      actorUserId: args.ownerId,
      entityKey: `action:${request._id}`,
      eventType: "action.execution_claimed",
      correlationId: idempotencyKey,
      actionRequestId: request._id,
      executionId,
      policyId: policy._id,
      afterHash: request.contentHash,
      summary: `${args.executor}:${binding.adapterKey}@${binding.adapterVersion}`,
      occurredAt: now,
    });
    return {
      executionId,
      executionStatus: "claimed" as const,
      alreadyClaimed: false,
      requestedActionType: request.requestedActionType,
      payload: request.payload,
      platformId: platform._id,
      platformDomain: platform.canonicalDomain,
      connectionId: request.connectionId,
      bindingId: binding._id,
      adapterKey: binding.adapterKey,
      adapterVersion: binding.adapterVersion,
      adapterConfig: binding.config,
      humanPresenceRequired: policy.humanPresenceRequired,
      browserProvider,
    };
  },
});

export const attachProviderExecution = internalMutation({
  args: {
    ownerId: v.id("users"),
    executionId: v.id("actionExecutions"),
    providerActionId: v.optional(v.string()),
    browserRunId: v.optional(v.id("browserRuns")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (execution === null || execution.ownerId !== args.ownerId || (execution.status !== "claimed" && execution.status !== "running")) {
      throw new ConvexError({ code: "EXECUTION_NOT_CLAIMED" });
    }
    if (execution.browserProvider !== undefined) {
      const selectedProvider = resolvePortalBrowserProvider();
      if (storedPortalBrowserProvider(execution.browserProvider) !== selectedProvider) {
        throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
      }
      if (args.browserRunId) {
        const run = await ctx.db.get(args.browserRunId);
        if (!run || run.ownerId !== args.ownerId || run.connectionId !== execution.connectionId ||
          storedPortalBrowserProvider(run.browserProvider) !== selectedProvider) {
          throw new ConvexError({ code: "PORTAL_BROWSER_PROVIDER_MISMATCH" });
        }
      }
    }
    await ctx.db.patch(execution._id, {
      status: "running",
      providerActionId: args.providerActionId?.slice(0, 500),
      browserRunId: args.browserRunId,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const getBrowserExecutionForOwner = internalQuery({
  args: {
    ownerId: v.id("users"),
    executionId: v.id("actionExecutions"),
  },
  returns: v.union(
    v.object({
      providerSessionId: v.string(),
      startedAt: v.number(),
      status: v.literal("running"),
      requestId: v.id("actionRequests"),
      connectionId: v.id("portalConnections"),
      browserProvider: portalBrowserProviderValidator,
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (
      execution === null ||
      execution.ownerId !== args.ownerId ||
      execution.status !== "running" ||
      !execution.providerActionId ||
      !execution.connectionId
    ) {
      return null;
    }
    return {
      providerSessionId: execution.providerActionId,
      startedAt: execution.startedAt,
      status: "running" as const,
      requestId: execution.requestId,
      connectionId: execution.connectionId,
      browserProvider: storedPortalBrowserProvider(execution.browserProvider),
    };
  },
});

export const finishExecution = internalMutation({
  args: {
    ownerId: v.id("users"),
    executionId: v.id("actionExecutions"),
    status: v.union(v.literal("succeeded"), v.literal("failed"), v.literal("unknown")),
    providerThreadId: v.optional(v.string()),
    providerMessageId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.executionId);
    if (execution === null || execution.ownerId !== args.ownerId) throw new ConvexError({ code: "EXECUTION_NOT_FOUND" });
    if (execution.status === "succeeded" || execution.status === "failed") return null;
    const request = await ctx.db.get(execution.requestId);
    if (request === null || request.ownerId !== args.ownerId) throw new ConvexError({ code: "ACTION_NOT_FOUND" });
    if (args.status === "succeeded" && request.providerActionKind === "acceptance") {
      const receipt = request.connectionId && args.providerMessageId ? await ctx.db.query("platformMessages")
        .withIndex("by_connection_and_provider_message_id", (q) => q.eq("connectionId", request.connectionId!).eq("providerMessageId", args.providerMessageId!)).unique() : null;
      const thread = receipt ? await ctx.db.get(receipt.threadId) : null;
      if (!receipt || receipt.ownerId !== args.ownerId || receipt.direction !== "outbound" ||
        request.payload.kind !== "platform_message" || receipt.threadId !== request.payload.threadId ||
        normalizeProviderReadback(receipt.bodyText) !== normalizeProviderReadback(request.payload.body) || thread?.providerThreadId !== args.providerThreadId) {
        throw new ConvexError({ code: "ACCEPTANCE_RECEIPT_REQUIRED" });
      }
    }
    if (args.status === "succeeded" && request.payload.kind === "email_message" && request.payload.mailThreadId) {
      const receipt = args.providerMessageId ? await ctx.db.query("mailMessages").withIndex("by_provider_message_id", (q) => q.eq("providerMessageId", args.providerMessageId!)).unique() : null;
      const thread = await ctx.db.get(request.payload.mailThreadId);
      if (!receipt || receipt.threadId !== thread?._id || receipt.direction !== "outbound" || receipt.body !== request.payload.body || thread.providerThreadId !== args.providerThreadId) throw new ConvexError({ code: "EMAIL_REPLY_RECEIPT_REQUIRED" });
    }
    const now = Date.now();
    await ctx.db.patch(execution._id, {
      status: args.status,
      providerThreadId: args.providerThreadId?.slice(0, 500),
      providerMessageId: args.providerMessageId?.slice(0, 500),
      completedAt: now,
      error: args.error?.slice(0, 1_000),
      updatedAt: now,
    });
    await ctx.db.patch(request._id, {
      status: args.status === "succeeded" ? "executed" : args.status === "unknown" ? "executing" : "failed",
      error: args.error?.slice(0, 1_000),
      updatedAt: now,
    });
    if (args.status === "succeeded" && request.opportunityId) {
      const opportunity = await ctx.db.get(request.opportunityId);
      if (opportunity?.ownerId === args.ownerId && opportunity.status !== "converted" && opportunity.status !== "dismissed") {
        await ctx.db.patch(opportunity._id, { status: request.providerActionKind === "acceptance" ? "converted" : "contacted", mandateId: request.mandateId, updatedAt: now });
      }
    }
    if (args.status === "succeeded" && request.providerActionKind === "acceptance" && request.providerConversationId && request.providerOfferId && request.savedNeedId) {
      const conversation = await ctx.db.get(request.providerConversationId);
      const need = await ctx.db.get(request.savedNeedId);
      if (conversation?.ownerId === args.ownerId && need?.ownerId === args.ownerId) {
        await ctx.db.patch(conversation._id, { acceptedOfferId: request.providerOfferId, acceptedAt: now, state: "closed", updatedAt: now });
        if (need.status === "active") await setNeedStatus(ctx, need, "paused");
        const mandate = await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
          q.eq("ownerId", args.ownerId).eq("savedNeedId", need._id).eq("status", "active")).unique();
        if (mandate) await ctx.db.patch(mandate._id, { stoppedAt: now, updatedAt: now });
        await ctx.db.insert("notifications", { ownerId: args.ownerId, kind: "system", title: "Offer acceptance sent",
          body: "Your approved confirmation was sent in the controlled portal. Your search is paused. No payment or contract signature was performed.", createdAt: now });
      }
    }
    if (args.status === "succeeded" && request.providerActionKind !== "acceptance" && request.providerConversationId && request.connectionId && args.providerThreadId) {
      const thread = await ctx.db.query("platformThreads").withIndex("by_connection_and_provider_thread_id", (q) =>
        q.eq("connectionId", request.connectionId!).eq("providerThreadId", args.providerThreadId!),
      ).unique();
      if (thread) await ctx.runMutation(internal.providerConversations.attachPlatformThread, {
        conversationId: request.providerConversationId, requestId: request._id, threadId: thread._id,
      });
    }
    await ctx.db.insert("auditEvents", {
      eventKey: `action:${request._id}:finished:${execution.idempotencyKey}`,
      actorType: "provider",
      entityKey: `action:${request._id}`,
      eventType: `action.execution_${args.status}`,
      correlationId: execution.idempotencyKey,
      actionRequestId: request._id,
      executionId: execution._id,
      afterHash: request.contentHash,
      summary: args.error?.slice(0, 500),
      occurredAt: now,
    });
    return null;
  },
});

/** Reconciles only an exact provider readback for an acceptance whose submit
 * outcome was unknown. It never sends or retries the external action. */
export const reconcileObservedPortalAcceptance = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    threadId: v.id("platformThreads"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.ownerId !== args.ownerId || thread.connectionId !== args.connectionId) return false;
    const conversation = await ctx.db.query("providerConversations").withIndex("by_platform_thread", (q) =>
      q.eq("platformThreadId", thread._id),
    ).unique();
    if (!conversation || conversation.ownerId !== args.ownerId || !conversation.acceptanceRequestId || conversation.acceptedAt !== undefined) return false;
    const request = await ctx.db.get(conversation.acceptanceRequestId);
    if (!request || request.ownerId !== args.ownerId || request.status !== "executing" ||
      request.providerActionKind !== "acceptance" || request.providerConversationId !== conversation._id ||
      request.connectionId !== args.connectionId || request.payload.kind !== "platform_message" ||
      request.payload.threadId !== thread._id || !request.executionIdempotencyKey ||
      !["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"].includes(request.error ?? "")) return false;
    const execution = await ctx.db.query("actionExecutions").withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", request.executionIdempotencyKey!),
    ).unique();
    if (!execution || execution.ownerId !== args.ownerId || execution.requestId !== request._id || execution.status !== "unknown") return false;
    const messages = await ctx.db.query("platformMessages").withIndex("by_thread_and_sent_at", (q) =>
      q.eq("threadId", thread._id).gte("sentAt", execution.startedAt),
    ).order("desc").take(20);
    const approvedBody = normalizeProviderReadback(request.payload.body);
    const receipt = messages.find((message) => message.ownerId === args.ownerId && message.connectionId === args.connectionId &&
      message.direction === "outbound" && normalizeProviderReadback(message.bodyText) === approvedBody);
    if (!receipt) return false;
    await ctx.runMutation(internal.externalActions.finishExecution, {
      ownerId: args.ownerId,
      executionId: execution._id,
      status: "succeeded",
      providerThreadId: thread.providerThreadId,
      providerMessageId: receipt.providerMessageId,
    });
    return true;
  },
});

/** Reconciles one ordinary platform write only from an exact imported provider
 * receipt. Ambiguous or incomplete evidence remains unknown and is never sent
 * again by this mutation. */
export const reconcileObservedPortalMessage = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    threadId: v.id("platformThreads"),
    providerMessageId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const providerMessageId = args.providerMessageId.trim().slice(0, 500);
    if (!providerMessageId) return false;
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.ownerId !== args.ownerId || thread.connectionId !== args.connectionId) return false;
    const receipt = await ctx.db.query("platformMessages")
      .withIndex("by_connection_and_provider_message_id", (q) =>
        q.eq("connectionId", args.connectionId).eq("providerMessageId", providerMessageId),
      ).unique();
    if (!receipt || receipt.ownerId !== args.ownerId || receipt.threadId !== thread._id || receipt.direction !== "outbound") return false;

    const unknown = await ctx.db.query("actionExecutions")
      .withIndex("by_owner_and_status_and_updated_at", (q) =>
        q.eq("ownerId", args.ownerId).eq("status", "unknown"),
      ).take(101);
    // Refuse to choose when the bounded candidate set cannot prove uniqueness.
    if (unknown.length > 100) return false;
    const matches: Array<{ execution: Doc<"actionExecutions">; request: Doc<"actionRequests"> }> = [];
    for (const execution of unknown) {
      if (execution.connectionId !== args.connectionId || receipt.sentAt < execution.startedAt) continue;
      if (execution.providerThreadId !== undefined && execution.providerThreadId !== thread.providerThreadId) continue;
      const request = await ctx.db.get(execution.requestId);
      if (!request || request.ownerId !== args.ownerId || request.status !== "executing" ||
        request.connectionId !== args.connectionId || request.providerActionKind === "acceptance" ||
        request.payload.kind !== "platform_message" ||
        !["SUBMIT_RESULT_UNKNOWN", "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"].includes(request.error ?? "") ||
        normalizeProviderReadback(request.payload.body) !== normalizeProviderReadback(receipt.bodyText)) continue;
      let destinationMatches = request.payload.threadId === thread._id;
      if (!destinationMatches && request.payload.threadId === undefined && request.payload.targetPath && request.matchingSignalId) {
        const signal = await ctx.db.get(request.matchingSignalId);
        const entry = signal?.sourceEntryId ? await ctx.db.get(signal.sourceEntryId) : null;
        const listingUrl = (() => {
          try {
            return entry ? new URL(entry.canonicalUrl) : null;
          } catch {
            return null;
          }
        })();
        destinationMatches = Boolean(
          signal && entry && listingUrl?.origin === "https://roomscout.dev" &&
          listingUrl.pathname === request.payload.targetPath &&
          /^\/listings\/[A-Za-z0-9_-]{1,200}$/.test(listingUrl.pathname) &&
          normalizeProviderReadback(thread.subject ?? "") === normalizeProviderReadback(`Re: ${signal.title}`),
        );
      }
      if (!destinationMatches) continue;
      matches.push({ execution, request });
      if (matches.length > 1) return false;
    }
    if (matches.length !== 1) return false;
    await ctx.runMutation(internal.externalActions.finishExecution, {
      ownerId: args.ownerId,
      executionId: matches[0]!.execution._id,
      status: "succeeded",
      providerThreadId: thread.providerThreadId,
      providerMessageId: receipt.providerMessageId,
    });
    return true;
  },
});

async function claimedPortalExecutionMayHaveRun(
  ctx: MutationCtx,
  execution: Doc<"actionExecutions">,
): Promise<boolean> {
  if (execution.status !== "claimed" || !execution.connectionId) return false;
  const connection = await ctx.db.get(execution.connectionId);
  if (!connection || connection.ownerId !== execution.ownerId) return false;
  const context = await ctx.db.query("browserContexts")
    .withIndex("by_connection", (q) => q.eq("connectionId", connection._id))
    .order("desc")
    .first();
  const firecrawlEvidence = execution.browserProvider === "firecrawl" ||
    connection.browserProvider === "firecrawl" || context?.browserProvider === "firecrawl";
  if (!firecrawlEvidence) return false;
  return connection.activeWriteExecutionId === execution._id ||
    (context?.pendingWriteExecutionId === execution._id && context.writeProofGeneration !== undefined);
}

/** Releases only a claim that provably never attached a provider operation. */
export const cancelUnstartedForUserReset = internalMutation({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    if (!await isUserResetTombstoned(ctx, args.ownerId)) return false;
    const request = await ctx.db.get(args.requestId);
    if (!request || request.ownerId !== args.ownerId || !request.executionIdempotencyKey) return false;
    const execution = await ctx.db.query("actionExecutions").withIndex("by_idempotency_key", (q) =>
      q.eq("idempotencyKey", request.executionIdempotencyKey!),
    ).unique();
    if (!execution || execution.ownerId !== args.ownerId || execution.status !== "claimed" ||
      execution.providerActionId || execution.providerThreadId || execution.providerMessageId) return false;
    if (await claimedPortalExecutionMayHaveRun(ctx, execution)) return false;
    const now = Date.now();
    await ctx.db.patch(execution._id, { status: "failed", completedAt: now, error: "USER_RESET_IN_PROGRESS", updatedAt: now });
    await ctx.db.patch(request._id, { status: "failed", error: "USER_RESET_IN_PROGRESS", updatedAt: now });
    if (execution.connectionId) {
      const connection = await ctx.db.get(execution.connectionId);
      if (connection?.ownerId === args.ownerId && connection.activeWriteExecutionId === execution._id) {
        await ctx.db.patch(connection._id, { activeWriteExecutionId: undefined, activeWriteDeadlineAt: undefined, updatedAt: now });
      }
    }
    return true;
  },
});

/**
 * Recovers leases abandoned between the transactional claim and provider
 * completion. A running provider call is deliberately marked unknown rather
 * than retryable because repeating it could create a duplicate external side
 * effect.
 */
export const reapStaleExecutions = internalMutation({
  args: {
    olderThanMs: v.number(),
    limit: v.number(),
  },
  returns: v.object({ failedBeforeProvider: v.number(), unknownProviderOutcome: v.number() }),
  handler: async (ctx, args) => {
    const olderThanMs = Math.max(60_000, Math.min(args.olderThanMs, 24 * 60 * 60 * 1_000));
    const limit = Math.max(1, Math.min(Math.floor(args.limit), 100));
    const cutoff = Date.now() - olderThanMs;
    const [claimed, running] = await Promise.all([
      ctx.db
        .query("actionExecutions")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "claimed").lt("updatedAt", cutoff),
        )
        .take(limit),
      ctx.db
        .query("actionExecutions")
        .withIndex("by_status_and_updated_at", (q) =>
          q.eq("status", "running").lt("updatedAt", cutoff),
        )
        .take(limit),
    ]);
    let failedBeforeProvider = 0;
    let unknownProviderOutcome = 0;
    for (const execution of [...claimed, ...running].slice(0, limit)) {
      const request = await ctx.db.get(execution.requestId);
      if (request === null) continue;
      const now = Date.now();
      const providerMayHaveRun = execution.status === "running" || Boolean(execution.providerActionId) ||
        await claimedPortalExecutionMayHaveRun(ctx, execution);
      const status = providerMayHaveRun ? "unknown" as const : "failed" as const;
      const error = providerMayHaveRun
        ? "EXECUTION_STALE_PROVIDER_OUTCOME_UNKNOWN"
        : "EXECUTION_CLAIM_TIMED_OUT_BEFORE_PROVIDER";
      await ctx.db.patch(execution._id, {
        status,
        completedAt: now,
        error,
        updatedAt: now,
      });
      await ctx.db.patch(request._id, {
        status: providerMayHaveRun ? "executing" : "failed",
        error,
        updatedAt: now,
      });
      await ctx.db.insert("auditEvents", {
        eventKey: `action:${request._id}:reaped:${execution.idempotencyKey}`,
        actorType: "system",
        entityKey: `action:${request._id}`,
        eventType: providerMayHaveRun
          ? "action.execution_outcome_unknown"
          : "action.execution_claim_abandoned",
        correlationId: execution.idempotencyKey,
        actionRequestId: request._id,
        executionId: execution._id,
        afterHash: request.contentHash,
        summary: error,
        occurredAt: now,
      });
      if (providerMayHaveRun) unknownProviderOutcome += 1;
      else failedBeforeProvider += 1;
    }
    return { failedBeforeProvider, unknownProviderOutcome };
  },
});
