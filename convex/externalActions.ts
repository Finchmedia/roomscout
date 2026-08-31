import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { contentHash, normalizeEmail, normalizeText } from "./integrations/contentHash";
import { requireUserId } from "./integrations/authz";
import { authorizeFromMandate, type PersonalDataScope } from "./lib/mandateAuthorization";

const actionTypeValidator = v.union(
  v.literal("send_email"), v.literal("submit_webform"), v.literal("send_platform_dm"),
  v.literal("create_portal_account"), v.literal("publish_listing"),
  v.literal("share_contact_details"), v.literal("propose_visit_time"),
);
const personalDataValidator = v.union(
  v.literal("band_name"), v.literal("member_first_names"), v.literal("reply_email"),
  v.literal("phone"), v.literal("precise_location"), v.literal("availability"),
  v.literal("budget"), v.literal("music_profile"),
);
const payloadValidator = v.union(
  v.object({ kind: v.literal("platform_message"), threadId: v.optional(v.id("platformThreads")), recipients: v.array(v.string()), subject: v.optional(v.string()), body: v.string() }),
  v.object({ kind: v.literal("contact_form"), targetUrl: v.string(), fields: v.array(v.object({ name: v.string(), label: v.optional(v.string()), value: v.string(), sensitivity: v.union(v.literal("normal"), v.literal("personal"), v.literal("sensitive")) })) }),
  v.object({ kind: v.literal("portal_account_operation"), connectionId: v.id("portalConnections"), operation: v.union(v.literal("connect"), v.literal("reauth"), v.literal("disconnect")), accountLabel: v.optional(v.string()) }),
  v.object({ kind: v.literal("email_message"), recipientName: v.string(), recipientEmail: v.string(), subject: v.string(), body: v.string() }),
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

function actionFlow(actionType: Doc<"actionRequests">["requestedActionType"]): "contact" | "listing" | "auth" {
  if (actionType === "publish_listing") return "listing";
  if (actionType === "create_portal_account") return "auth";
  return "contact";
}

function cleanPayload(payload: Doc<"actionRequests">["payload"]): Doc<"actionRequests">["payload"] {
  if (payload.kind === "email_message") {
    const email = normalizeEmail(payload.recipientEmail);
    const subject = normalizeText(payload.subject).slice(0, 200);
    const body = normalizeText(payload.body).slice(0, 20_000);
    if (!email.includes("@") || !subject || !body) throw new ConvexError({ code: "INVALID_EMAIL_ACTION" });
    return { ...payload, recipientName: normalizeText(payload.recipientName).slice(0, 160), recipientEmail: email, subject, body };
  }
  if (payload.kind === "platform_message") {
    const body = normalizeText(payload.body).slice(0, 20_000);
    if (!body || payload.recipients.length > 20) throw new ConvexError({ code: "INVALID_PLATFORM_ACTION" });
    return { ...payload, recipients: [...new Set(payload.recipients.map((item) => normalizeText(item).slice(0, 320)).filter(Boolean))], subject: payload.subject ? normalizeText(payload.subject).slice(0, 200) : undefined, body };
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
  return await contentHash([JSON.stringify(payload)]);
}

function actionPublic(
  row: Doc<"actionRequests">,
  executor?: "firecrawl" | "browserbase" | "agentmail" | "direct_api" | "manual",
  execution?: Doc<"actionExecutions"> | null,
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
    execution: execution ? { id: execution._id, status: execution.status, error: execution.error, updatedAt: execution.updatedAt } : undefined,
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
  execution: v.optional(v.object({ id: v.id("actionExecutions"), status: v.union(v.literal("claimed"), v.literal("running"), v.literal("succeeded"), v.literal("failed"), v.literal("unknown")), error: v.optional(v.string()), updatedAt: v.number() })),
});

export const listMine = query({
  args: { limit: v.optional(v.number()) }, returns: v.array(publicValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const rows = await ctx.db.query("actionRequests").withIndex("by_owner_and_status_and_updated_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(Math.max(1, Math.min(50, Math.floor(args.limit ?? 30))));
    return await Promise.all(rows.map(async (row) => {
      const [binding, executions] = await Promise.all([
        row.adapterBindingId ? ctx.db.get(row.adapterBindingId) : Promise.resolve(null),
        ctx.db.query("actionExecutions").withIndex("by_request", (q) => q.eq("requestId", row._id)).order("desc").take(1),
      ]);
      return actionPublic(row, binding?.executor, executions[0]);
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
    if (args.savedNeedId) { const need = await ctx.db.get(args.savedNeedId); if (need?.ownerId !== ownerId) throw new ConvexError({ code: "NEED_NOT_FOUND" }); }
    if (args.connectionId) { const connection = await ctx.db.get(args.connectionId); if (connection?.ownerId !== ownerId) throw new ConvexError({ code: "CONNECTION_NOT_FOUND" }); }
    if (args.mandateId) { const mandate = await ctx.db.get(args.mandateId); if (mandate?.ownerId !== ownerId) throw new ConvexError({ code: "MANDATE_NOT_FOUND" }); }
    if (args.opportunityId) { const opportunity = await ctx.db.get(args.opportunityId); if (opportunity?.ownerId !== ownerId) throw new ConvexError({ code: "OPPORTUNITY_NOT_FOUND" }); }
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
  returns: v.id("actionRequests"),
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
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId: args.ownerId,
      savedNeedId: need._id,
      platformId: source.platformId,
      adapterBindingId: binding._id,
      policyVersionId: policy._id,
      automationMode: "exact_once",
      requestedActionType: "submit_webform",
      personalDataScopes: ["reply_email"],
      payload,
      contentVersion: 1,
      contentHash: hash,
      status: "awaiting_approval",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("auditEvents", { eventKey: `action:${requestId}:approval_requested:1`, actorType: "system", actorUserId: args.ownerId, entityKey: `action:${requestId}`, eventType: "action.scout_drafted_webform", actionRequestId: requestId, policyId: policy._id, afterHash: hash, occurredAt: now });
    return requestId;
  },
});

export const submit = mutation({
  args: { requestId: v.id("actionRequests") },
  returns: v.object({ status: statusValidator, authorizedByMandate: v.boolean(), reasons: v.array(v.string()) }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== ownerId) throw new ConvexError({ code: "ACTION_NOT_FOUND" });
    if (request.status !== "drafted") throw new ConvexError({ code: "INVALID_ACTION_STATE" });
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
      stoppedAt: mandate.stoppedAt,
    }, {
      now: Date.now(), actionType: request.requestedActionType,
      platformId: request.platformId, personalData: request.personalDataScopes as PersonalDataScope[],
      contactsAlreadyAttemptedToday: executions.length,
      browserMinutesUsedToday,
      proposedMonthlyPriceEur: request.proposedMonthlyPriceEur,
      policyDecision: policy?.decision ?? "unknown",
      policyAutomationLevel: policy?.maxAutomationLevel ?? "disabled",
      connectionActive: connection?.ownerId === ownerId && connection.status === "active",
      complaintRecorded: mailThreads.some((thread) => thread.lastDeliveryStatus === "complained"),
      suitableRoomConfirmed: converted.length > 0,
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
  },
});

export const decide = mutation({
  args: { requestId: v.id("actionRequests"), decision: v.union(v.literal("approved"), v.literal("rejected")), expectedContentVersion: v.number(), expectedContentHash: v.string(), expectedPayload: payloadValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const request = await ctx.db.get(args.requestId);
    if (request === null || request.ownerId !== ownerId) throw new ConvexError({ code: "ACTION_NOT_FOUND" });
    if (request.status !== "awaiting_approval") throw new ConvexError({ code: "INVALID_ACTION_STATE" });
    const expected = cleanPayload(args.expectedPayload);
    if (request.contentVersion !== args.expectedContentVersion || request.contentHash !== args.expectedContentHash || await payloadHash(expected) !== request.contentHash || JSON.stringify(expected) !== JSON.stringify(request.payload)) {
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
    if (approval === null || approval.contentHash !== request.contentHash || JSON.stringify(approval.payloadSnapshot) !== JSON.stringify(request.payload)) return null;
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
    const [approval, platform, policy, binding, connection] = await Promise.all([
      ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) =>
        q.eq("requestId", request._id).eq("contentVersion", request.contentVersion),
      ).unique(),
      ctx.db.get(request.platformId),
      ctx.db.get(request.policyVersionId),
      ctx.db.get(request.adapterBindingId),
      request.connectionId ? ctx.db.get(request.connectionId) : Promise.resolve(null),
    ]);
    const flow = actionFlow(request.requestedActionType);
    if (
      approval === null ||
      approval.decision === "rejected" ||
      approval.contentHash !== request.contentHash ||
      JSON.stringify(approval.payloadSnapshot) !== JSON.stringify(request.payload) ||
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

    if (approval.decision === "authorized_by_mandate") {
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
        stoppedAt: mandate.stoppedAt,
      }, {
        now: Date.now(),
        actionType: request.requestedActionType,
        platformId: request.platformId,
        personalData: request.personalDataScopes as PersonalDataScope[],
        contactsAlreadyAttemptedToday: executions.length,
        browserMinutesUsedToday: browserMinutes,
        proposedMonthlyPriceEur: request.proposedMonthlyPriceEur,
        policyDecision: policy.decision,
        policyAutomationLevel: policy.maxAutomationLevel,
        connectionActive: args.executor !== "browserbase" || connection?.status === "active",
        complaintRecorded: complainedThreads.some((thread) => thread.lastDeliveryStatus === "complained"),
        suitableRoomConfirmed: converted.length > 0,
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
      };
    }
    const now = Date.now();
    const executionId = await ctx.db.insert("actionExecutions", {
      requestId: request._id,
      ownerId: args.ownerId,
      approvalId: approval._id,
      platformId: platform._id,
      connectionId: request.connectionId,
      adapterBindingId: binding._id,
      status: "claimed",
      idempotencyKey,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });
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
    const binding = execution.adapterBindingId ? await ctx.db.get(execution.adapterBindingId) : null;
    if (binding?.executor === "browserbase") {
      const cutoff = Date.now() - 8 * 60 * 1_000;
      const recentRunning = await ctx.db.query("actionExecutions").withIndex("by_status_and_updated_at", (q) =>
        q.eq("status", "running").gt("updatedAt", cutoff),
      ).take(50);
      for (const candidate of recentRunning) {
        if (candidate._id === execution._id || !candidate.adapterBindingId) continue;
        const candidateBinding = await ctx.db.get(candidate.adapterBindingId);
        if (candidateBinding?.executor === "browserbase") {
          throw new ConvexError({ code: "BROWSERBASE_WRITE_CONCURRENCY_LIMIT" });
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
        await ctx.db.patch(opportunity._id, { status: "contacted", mandateId: request.mandateId, updatedAt: now });
      }
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
