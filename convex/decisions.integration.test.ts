/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { listMessages } from "@convex-dev/agent";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { DEFAULT_AUTONOMY_RULES, type AutonomyRules } from "./lib/autonomy";
import { signalMatchRevision } from "./lib/matchValidity";
import { messageSafetySchema } from "./lib/messageSafety";
import { offerConstraints, type ProviderAssessment } from "./lib/providerAssessment";
import { raiseDecision } from "./lib/decisions";
import { pendingPortalWrites } from "./portalWriteQueue.testSupport";
import { scoutAgent } from "./scoutRuntime";
import * as ai from "./ai";

const modules = import.meta.glob("./**/*.ts");
const originalModel = scoutAgent.options.languageModel;
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", ""); });
afterEach(() => { scoutAgent.options.languageModel = originalModel; vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const clear = messageSafetySchema.parse({ classification: "non_binding", explanation: "Asks about availability without agreeing to anything.", personalDataScopes: [], proposedMonthlyPriceEur: null, unsupportedClaims: [] });
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };

/** Controlled-portal conversation (mirrors autonomyGate.integration.test.ts): stageReply drafts a portal reply. */
async function portalScenario(rules: Partial<AutonomyRules>) {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool"); workpoolTest.register(t, "browserWorkpool");
  const f = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "controlled-musician", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Stuttgart", districts: [], arrangement: ["shared"], schedule: [], requirements: [], maxBudgetEur: 250, matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "controlled", name: "Controlled portal", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: "controlled", name: "Controlled listings", baseUrl: "https://roomscout.dev/listings", side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now });
    const connectedSourceId = await ctx.db.insert("sources", { platformId, slug: "controlled-connected", name: "Controlled connected messaging", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const targetId = await ctx.db.insert("sourceTargets", { sourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: "test", scheduleMinutes: 1440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now });
    const entryId = await ctx.db.insert("sourceEntries", { sourceId, sourceTargetId: targetId, externalId: "room-1", canonicalUrl: "https://roomscout.dev/listings/room-1", detailUrl: "https://roomscout.dev/listings/room-1", title: "Test listing", excerpt: "Controlled listing", side: "supply", city: "Stuttgart", status: "active", detailState: "processed", detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { sourceEntryId: entryId, side: "supply", title: "Controlled room", city: "Stuttgart", summary: "Shared room", arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    const signalRevision = await signalMatchRevision((await ctx.db.get(signalId))!);
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, sourceId: connectedSourceId, scopeKey: "controlled:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: true, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/terms"], createdAt: now, updatedAt: now });
    await ctx.db.insert("sourceAdapterBindings", { platformId, sourceId: connectedSourceId, scopeKey: "controlled:contact", flow: "contact", adapterKey: "roomscout-dev-v1", adapterVersion: 1, status: "active", executor: "browserbase", config: { kind: "browserbase", workflowKey: "roomscout-dev.platform-message.v1", contextRequired: true }, configFingerprint: "test", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId: connectedSourceId, platformId, label: "Test connection", allowedDomains: ["roomscout.dev"], allowedPaths: ["/listings", "/inbox"], adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    const threadId = await ctx.db.insert("platformThreads", { connectionId, ownerId, providerThreadId: "thread-1", participants: ["Test provider"], lastMessageAt: now, status: "open", createdAt: now, updatedAt: now });
    const conversationId = await ctx.db.insert("providerConversations", { ownerId, savedNeedId: needId, signalId, conversationKey: "controlled", agentThreadId: "test-agent-thread", platformThreadId: threadId, revision: 1, state: "needs_attention", createdAt: now, updatedAt: now });
    const eventId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "portal:one", kind: "portal_reply", revision: 1, status: "completed", createdAt: now });
    const assessment: ProviderAssessment = { summary: "Ask whether the room is still free", availability: { status: "unknown", evidence: [] }, monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] }, terms: [], constraints: [], uncertainties: ["Availability"], contradictions: [], nextAction: "ask_provider", suggestedReply: { subject: "Room availability", body: "Is the room still available?" } };
    const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId, revision: 1, needRevision: 1, signalRevision, assessment, ready: false, blockers: ["Availability unknown"], contentHash: "offer-v1", model: ai.ROOMSCOUT_MODEL_ID, promptVersion: "test", schemaVersion: "test", createdAt: now });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });
    return { ownerId, needId, connectionId, threadId, conversationId, offerId };
  });
  const musician = t.withIdentity({ subject: f.ownerId });
  await musician.mutation(api.autonomy.save, { rules: { ...DEFAULT_AUTONOMY_RULES, ...rules } });
  // stageReply drafts the reply; the gate first waits for the safety verdict, which we record as clear.
  const requestId = (await t.mutation(internal.providerActions.stageReply, { offerId: f.offerId }))!;
  const authorize = async (assessment = clear) => {
    const input = (await t.query(internal.messageSafety.getInput, { requestId }))!;
    return t.mutation(internal.messageSafety.recordAndAuthorize, { requestId, snapshotHash: input.snapshotHash, assessment });
  };
  if (rules.sharePrivate !== false) await authorize();
  const request = (id: Id<"actionRequests"> = requestId) => t.run((ctx) => ctx.db.get(id));
  const decisions = () => t.run((ctx) => ctx.db.query("decisions").collect());
  const openDecisions = () => musician.query(api.decisions.listOpenMine, {});
  const approvals = (id: Id<"actionRequests"> = requestId) => t.run((ctx) => ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) => q.eq("requestId", id)).collect());
  const scheduledNames = async () => (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).map((row) => row.name);
  const scoutMessages = async () => {
    const context = await t.run((ctx) => ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", f.ownerId)).first());
    if (!context) return [];
    const page = await t.run((ctx) => listMessages(ctx, components.agent, { threadId: context.threadId, paginationOpts: { cursor: null, numItems: 20 } }));
    return page.page.map((row) => ({ role: row.message?.role, text: row.text }));
  };
  // Approved portal writes enter the shared browser pool, not the root scheduler.
  const pooledWriteNames = async () => (await pendingPortalWrites(t)).map((row) => row.fnName);
  return { t, musician, ...f, requestId, authorize, request, decisions, openDecisions, approvals, scheduledNames, pooledWriteNames, scoutMessages };
}

describe("Entscheidung from the Freigabeprüfung (ask_user)", () => {
  it("Rücksprache raises review_message with the outgoing text; a re-submit supersedes the older one", async () => {
    const s = await portalScenario({ mode: "review" });
    expect(await s.request()).toMatchObject({ status: "awaiting_approval", gate: { outcome: "ask_user", reason: "review_mode" } });
    const [first] = await s.openDecisions();
    expect(first).toMatchObject({
      kind: "review_message", status: "open", question: "Should I send this message?",
      detail: "Subject:\nRoom availability\n\nMessage:\nIs the room still available?",
      options: [{ id: "yes", label: "Yes, send it" }, { id: "no", label: "No, change it" }],
      refs: { requestId: s.requestId, offerId: s.offerId }, conversationId: s.conversationId,
    });
    // The same conversation asks again (re-submit): exactly one open decision remains.
    await s.t.run((ctx) => ctx.db.patch(s.requestId, { status: "drafted" }));
    await s.t.mutation(internal.externalActions.submitChecked, { ownerId: s.ownerId, requestId: s.requestId });
    const open = await s.openDecisions();
    expect(open).toHaveLength(1);
    expect(open[0]!._id).not.toBe(first!._id);
    expect((await s.decisions()).find((row) => row._id === first!._id)?.status).toBe("superseded");
    // No notification row is written for an Entscheidung.
    expect(await s.t.run((ctx) => ctx.db.query("notifications").collect())).toEqual([]);
    // Answering the superseded one is refused.
    await expect(s.musician.mutation(api.decisions.answer, { decisionId: first!._id, choice: "yes" })).rejects.toThrow("DECISION_NOT_OPEN");
  });

  it("private_data lists the Datenfelder before the text", async () => {
    const s = await portalScenario({ mode: "autopilot", sharePrivate: false });
    expect(await s.authorize({ ...clear, personalDataScopes: ["phone"] })).toBe(false);
    const [decision] = await s.openDecisions();
    expect(decision).toMatchObject({ kind: "private_data", detail: "Datenfelder: phone\n\nSubject:\nRoom availability\n\nMessage:\nIs the room still available?" });
  });

  it("answer yes approves like decide and dispatches to the executor", async () => {
    const s = await portalScenario({ mode: "review" });
    const [decision] = await s.openDecisions();
    const result = await s.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "yes" });
    expect(result).toMatchObject({ status: "answered", action: "approved", requestId: s.requestId, dispatched: true, sent: false });
    expect(await s.request()).toMatchObject({ status: "approved" });
    const [approval] = await s.approvals();
    expect(approval).toMatchObject({ decision: "approved", contentVersion: 1, autonomyVersion: 1 });
    expect(await s.pooledWriteNames()).toContain("browserbasePortal:executeApprovedWriteWorker");
    expect(await s.t.run((ctx) => ctx.db.get(decision!._id))).toMatchObject({ status: "answered", answer: { choice: "yes" } });
    expect(await s.openDecisions()).toEqual([]);
    // The claim-phase Freigabeprüfung honours the human's exact approval.
    expect(await s.t.mutation(internal.externalActions.prepareClaim, { ownerId: s.ownerId, requestId: s.requestId, executor: "browserbase" })).toEqual({ outcome: "proceed" });
  });

  it("answer no rejects the request and the Scout asks in chat what should change", async () => {
    const s = await portalScenario({ mode: "review" });
    const [decision] = await s.openDecisions();
    const result = await s.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "no" });
    expect(result).toMatchObject({ status: "answered", action: "rejected", next: "ask_what_should_change" });
    expect(await s.request()).toMatchObject({ status: "rejected" });
    expect((await s.approvals())[0]).toMatchObject({ decision: "rejected" });
    expect(await s.scoutMessages()).toEqual([{ role: "assistant", text: "Okay, ich sende das nicht. Was soll anders sein?" }]);
    expect(await s.pooledWriteNames()).toEqual([]);
  });

  it("answer custom is an instruction for the next draft: the Scout's message is rejected and re-assessed, nothing is staged", async () => {
    const s = await portalScenario({ mode: "review" });
    const [decision] = await s.openDecisions();
    const before = await s.t.run((ctx) => ctx.db.query("actionRequests").collect());
    const result = await s.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "custom", text: "Bitte höflicher, und frag auch nach der Kaution." });
    expect(result).toMatchObject({ status: "answered", action: "reassessing", requestId: s.requestId, sent: false });
    expect(result.dispatched).toBeUndefined();
    // The Scout's draft is withdrawn and the musician's words are recorded on the Entscheidung.
    expect(await s.request()).toMatchObject({ status: "rejected" });
    expect((await s.approvals())[0]).toMatchObject({ decision: "rejected" });
    expect(await s.t.run((ctx) => ctx.db.get(decision!._id))).toMatchObject({
      status: "answered", answer: { choice: "custom", text: "Bitte höflicher, und frag auch nach der Kaution." },
    });
    // Nothing goes out: no second request, no dispatch.
    expect(await s.t.run((ctx) => ctx.db.query("actionRequests").collect())).toHaveLength(before.length);
    expect(await s.pooledWriteNames()).toEqual([]);
    // Instead the instruction enters the conversation as a trusted musician turn.
    const turns = await s.t.run((ctx) => ctx.db.query("providerTurns").collect());
    const musicianTurn = turns.find((turn) => turn.kind === "musician_input")!;
    expect(musicianTurn).toMatchObject({
      conversationId: s.conversationId, decisionId: decision!._id, status: "processing", revision: 2,
      sourceKey: `decision:${decision!._id}`,
      input: "Anweisung der Band zur nächsten Nachricht: Bitte höflicher, und frag auch nach der Kaution.",
    });
    expect(await s.t.run((ctx) => ctx.db.get(s.conversationId))).toMatchObject({ revision: 2, activeEventId: musicianTurn._id, state: "thinking" });
  });

  it("the Nachrichten composer keeps dictation: the same custom answer stages the musician's own text", async () => {
    const s = await portalScenario({ mode: "review" });
    const [decision] = await s.openDecisions();
    const result = await s.musician.mutation(api.conversations.reply, { conversationId: s.conversationId, body: "Hallo! Ist der Raum noch frei, und gibt es einen Lastenaufzug?" });
    expect(result).toMatchObject({ decisionId: decision!._id, status: "approved", dispatched: true, sent: false });
    expect(result.requestId).not.toBe(s.requestId);
    expect(await s.request()).toMatchObject({ status: "rejected" });
    const custom = (await s.request(result.requestId))!;
    expect(custom).toMatchObject({
      humanDraft: true, status: "approved", requestedActionType: "send_platform_dm", providerConversationId: s.conversationId, providerOfferId: s.offerId,
      payload: { kind: "platform_message", threadId: s.threadId, body: "Hallo! Ist der Raum noch frei, und gibt es einen Lastenaufzug?" },
      gate: { outcome: "proceed" },
    });
    // Rücksprache asks about every outgoing message — except the one the musician wrote.
    const [approval] = await s.approvals(result.requestId);
    expect(approval).toMatchObject({ decision: "approved", contentHash: custom.contentHash });
    expect(await s.pooledWriteNames()).toContain("browserbasePortal:executeApprovedWriteWorker");
    expect(await s.t.mutation(internal.externalActions.prepareClaim, { ownerId: s.ownerId, requestId: result.requestId, executor: "browserbase" })).toEqual({ outcome: "proceed" });
    // The Scout's own reply for this offer is not staged again while the dictated one lives.
    expect(await s.t.mutation(internal.providerActions.stageReply, { offerId: s.offerId })).toBe(result.requestId);
    // No re-assessment turn: the dictated text is the message, not an instruction.
    expect(await s.t.run((ctx) => ctx.db.query("providerTurns").collect())).not.toContainEqual(expect.objectContaining({ kind: "musician_input" }));
  });

  it("the legacy decide mutation answers the Entscheidung too, and the chat tool path answers without an extra Scout message", async () => {
    const s = await portalScenario({ mode: "review" });
    const [decision] = await s.openDecisions();
    const request = (await s.request())!;
    await s.musician.mutation(api.externalActions.decide, { requestId: s.requestId, decision: "approved", expectedContentVersion: request.contentVersion, expectedContentHash: request.contentHash, expectedPayload: request.payload });
    expect(await s.t.run((ctx) => ctx.db.get(decision!._id))).toMatchObject({ status: "answered", answer: { choice: "yes" } });

    const other = await portalScenario({ mode: "review" });
    const [openOther] = await other.openDecisions();
    await other.t.mutation(internal.decisions.answerFromScout, { ownerId: other.ownerId, decisionId: openOther!._id, choice: "no" });
    expect(await other.request()).toMatchObject({ status: "rejected" });
    expect(await other.scoutMessages()).toEqual([]);
  });

  it("rejects answers from another user and on closed decisions", async () => {
    const s = await portalScenario({ mode: "review" });
    const [decision] = await s.openDecisions();
    const stranger = await s.t.run((ctx) => ctx.db.insert("users", { username: "stranger", role: "musician", createdAt: 1, lastSeenAt: 1 }));
    await expect(s.t.withIdentity({ subject: stranger }).mutation(api.decisions.answer, { decisionId: decision!._id, choice: "yes" })).rejects.toThrow("DECISION_NOT_FOUND");
    await s.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "no" });
    await expect(s.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "yes" })).rejects.toThrow("DECISION_NOT_OPEN");
    expect(await s.musician.query(api.decisions.historyMine, {})).toHaveLength(1);
  });

  it("the Scout turn carries answerDecision only while an Entscheidung is open", async () => {
    const s = await portalScenario({ mode: "review" });
    const thread = await s.musician.mutation(api.scout.getOrCreateThread, {});
    const withOpen = (await s.t.query(internal.scout.getActionContext, { ownerId: s.ownerId, threadId: thread.threadId }))!;
    expect(withOpen.hasOpenDecision).toBe(true);
    expect(withOpen.caseCard).toContain("OPEN ENTSCHEIDUNGEN");
    expect(withOpen.caseCard).toContain("Should I send this message?");
    const [decision] = await s.openDecisions();
    await s.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "no" });
    const without = (await s.t.query(internal.scout.getActionContext, { ownerId: s.ownerId, threadId: thread.threadId }))!;
    expect(without.hasOpenDecision).toBe(false);
    expect(without.caseCard).not.toContain("OPEN ENTSCHEIDUNGEN");
  });
});

/** Mail-based provider conversation (mirrors providerConversations.integration.test.ts). */
const body = "Room available. Monthly total including all charges: EUR 220. Drums and storage allowed, Monday evenings available.";
async function mailFixture(replyBody = body) {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  workpoolTest.register(t, "browserWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "offer-owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Band search", city: "Stuttgart", districts: [], arrangement: ["shared"],
      schedule: ["Monday evenings"], requirements: ["Drums and storage"], maxBudgetEur: 250,
      status: "active", matchingRevision: 1, createdAt: now, updatedAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply", title: "Controlled room", city: "Stuttgart", summary: "Shared room",
      arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed",
      sourceCount: 1, firstSeenAt: now, lastSeenAt: now,
    });
    const draftId = await ctx.db.insert("outreachDrafts", {
      ownerId, signalId, savedNeedId, recipientName: "Test provider", recipientEmail: "provider@example.test",
      subject: "Room inquiry", body: "Is this available?", contentVersion: 1, contentHash: "draft-hash", status: "sent", createdAt: now, updatedAt: now,
    });
    const mailboxId = await ctx.db.insert("userMailboxes", {
      ownerId, provider: "agentmail", providerInboxId: "private-inbox", emailAddress: "scout@example.test", clientId: "test-client", status: "active", createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("mailThreads", {
      ownerId, draftId, mailboxId, providerThreadId: "provider-thread", subject: "Room inquiry", status: "awaiting_reply", lastMessageAt: now, createdAt: now,
    });
    return { ownerId, savedNeedId, signalId, mailboxId };
  });
  const messageId = (await t.mutation(internal.inbox.storeInboundMessage, {
    mailboxId: ids.mailboxId, providerThreadId: "provider-thread", providerMessageId: "message-1", providerEventId: "event-1",
    from: "provider@example.test", to: ["scout@example.test"], subject: "Room reply", body: replyBody, htmlAvailable: false, receivedAt: Date.now(),
  }))!;
  const eventId = (await t.mutation(internal.providerConversations.enqueueMailReply, { messageId }))!;
  const input = (await t.mutation(internal.providerConversations.prepareTurn, { eventId }))!;
  const citation = { sourceId: `mail:${messageId}`, quote: replyBody };
  const ready: ProviderAssessment = {
    summary: "Provider confirms the room matches the search.",
    availability: { status: "available", evidence: [citation] },
    monthlyPrice: { totalEur: 220, allRecurringCostsKnown: true, evidence: [citation] },
    terms: [],
    constraints: offerConstraints(input.need).map(({ key }) => ({ key, verdict: "satisfied", explanation: "Confirmed by provider", evidence: [citation] })),
    uncertainties: [], contradictions: [], nextAction: "present_offer", suggestedReply: null,
  };
  const asksMusician: ProviderAssessment = {
    ...ready,
    summary: "The room is in Stuttgart-West; the musician wanted the centre.",
    constraints: offerConstraints(input.need).map(({ key }) => ({ key, verdict: "unknown", explanation: "Depends on the musician", evidence: [] })),
    uncertainties: ["Is Stuttgart-West acceptable instead of the centre?"], nextAction: "ask_musician",
  };
  const record = (assessment: ProviderAssessment, id = eventId) => t.mutation(internal.providerConversations.recordAssessment, { eventId: id, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment });
  const complete = (id = eventId) => t.mutation(internal.providerConversations.turnCompleted, { workId: "test-work" as never, context: { eventId: id }, result: { kind: "success", returnValue: null } });
  const musician = t.withIdentity({ subject: ids.ownerId });
  const decisions = () => t.run((ctx) => ctx.db.query("decisions").collect());
  const scheduledNames = async () => (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).map((row) => row.name);
  /** Assessment notifications only; the inbound mail itself writes a mail_reply notification. */
  const systemNotifications = async () => (await t.run((ctx) => ctx.db.query("notifications").collect())).filter((row) => row.kind === "system");
  return { t, ...ids, messageId, eventId, input, ready, asksMusician, record, complete, musician, decisions, scheduledNames, systemNotifications, conversationId: input.conversationId };
}

describe("Entscheidung from the provider assessment", () => {
  it("collects separate slot and equipment answers before resuming the provider conversation", async () => {
    const f = await mailFixture("Room available for EUR 220/month including charges. Wednesday 18:00–22:00 only. Acoustic drums prohibited; electronic kit with headphones available.");
    const conflict: ProviderAssessment = {
      ...f.ready, nextAction: "ask_musician",
      constraints: f.ready.constraints.map((item) => item.key === "budget" ? item : {
        ...item, verdict: "conflict", explanation: item.key === "schedule" ? "Wednesday only, instead of the requested day." : "Acoustic drums prohibited; electronic kit only.",
      }),
    };
    await f.record(conflict);
    await f.complete();
    const [decision] = await f.musician.query(api.decisions.listOpenMine, {});
    await expect(f.t.mutation(internal.decisions.recordDecisionQuestions, {
      decisionId: decision!._id,
      questions: [{ id: "slot", constraintKeys: ["schedule"], question: "Would Wednesday work?", options: [] }],
    })).rejects.toThrow("MISSING_CLARIFICATION_CONSTRAINT");
    await f.t.mutation(internal.decisions.recordDecisionQuestions, {
      decisionId: decision!._id,
      questions: [
        { id: "slot", constraintKeys: ["schedule"], question: "Would Wednesday work for this room?", options: [{ id: "yes", label: "Wednesday works", constraintEffect: "accept_alternative" }] },
        { id: "drums", constraintKeys: ["requirement:0"], question: "Acoustic drums are prohibited. Would an electronic kit work?", options: [{ id: "yes", label: "An electronic kit works", constraintEffect: "accept_alternative" }, { id: "no", label: "We need acoustic drums", constraintEffect: "keep_requirement" }] },
      ],
    });
    expect(await f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, questionId: "slot", choice: "yes" }))
      .toMatchObject({ status: "open", action: "awaiting_answers", nextQuestionId: "drums" });
    const [remaining] = await f.musician.query(api.decisions.listOpenMine, {});
    expect(remaining).toMatchObject({ question: "Acoustic drums are prohibited. Would an electronic kit work?", questions: [{ answer: { choice: "yes" } }, { id: "drums" }] });
    expect(await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).not.toContainEqual(expect.objectContaining({ kind: "musician_input" }));
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
    // A stale UI/voice answer to question 1 must never become a yes to question 2.
    await expect(f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, questionId: "slot", choice: "yes" })).rejects.toThrow("DECISION_QUESTION_CHANGED");
    await expect(f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "yes" })).rejects.toThrow("DECISION_QUESTION_CHANGED");
    expect(await f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, questionId: "drums", choice: "no" }))
      .toMatchObject({ status: "answered", action: "reassessing" });
    expect(await f.musician.query(api.decisions.listOpenMine, {})).toEqual([]);
    const turns = (await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).filter((turn) => turn.kind === "musician_input");
    expect(turns).toHaveLength(1);
    const input = (await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: turns[0]!._id }))!;
    expect(input.musicianStatements.join("\n")).toContain("Wednesday works");
    expect(input.musicianStatements.join("\n")).toContain("We need acoustic drums");
    expect(input.musicianStatements.join("\n")).toContain("requirement:0");
    expect(input.musicianStatements.join("\n")).toContain("Acoustic drums are prohibited");
    expect(input.clarificationScope?.answeredConstraintKeys).toEqual(["schedule", "requirement:0"]);
    expect(input.clarificationScope?.retainedConstraintKeys).toEqual(["requirement:0"]);
    await expect(f.t.mutation(internal.providerConversations.recordAssessment, {
      eventId: turns[0]!._id, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment: f.ready,
    })).rejects.toThrow("MUSICIANS_CONSTRAINT_RETAINED");
    expect(await f.scheduledNames()).not.toContain("decisions:absorbMusicianAnswer");
    expect(await f.t.run((ctx) => ctx.db.get(f.savedNeedId))).toMatchObject({ schedule: ["Monday evenings"], requirements: ["Drums and storage"] });
  });

  it("refuses answers to a round whose search constraints have changed", async () => {
    const f = await mailFixture();
    await f.record(f.asksMusician);
    await f.complete();
    const [decision] = await f.musician.query(api.decisions.listOpenMine, {});
    await f.t.mutation(internal.decisions.recordDecisionQuestions, {
      decisionId: decision!._id,
      questions: [{ id: "room", constraintKeys: [], question: "Would this room work?", options: [{ id: "yes", label: "Yes" }] }],
    });
    await f.t.run((ctx) => ctx.db.patch(f.savedNeedId, { matchingRevision: 2 }));
    await expect(f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, questionId: "room", choice: "yes" }))
      .rejects.toThrow("DECISION_CONTEXT_CHANGED");
    expect(await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).not.toContainEqual(expect.objectContaining({ kind: "musician_input" }));
  });

  it("ask_musician raises an empty scout_question, schedules formulateQuestion and writes no notification", async () => {
    const f = await mailFixture();
    await f.record(f.asksMusician);
    const [decision] = await f.decisions();
    expect(decision).toMatchObject({ kind: "scout_question", status: "open", question: "", options: [], conversationId: f.conversationId, savedNeedId: f.savedNeedId });
    expect(decision!.refs.offerId).toBeTruthy();
    expect(await f.scheduledNames()).toContain("decisions:formulateQuestion");
    expect(await f.systemNotifications()).toEqual([]);
    // Empty questions are not shown to the Scout as answerable yet.
    expect(await f.musician.query(api.decisions.listOpenMine, {})).toHaveLength(1);
  });

  it("present_offer with only the band's own open point left raises a scout_question instead of a dead end", async () => {
    const f = await mailFixture();
    await f.record({ ...f.ready, uncertainties: ["Internally open: Tuesday or Wednesday?"] });
    const [decision] = await f.decisions();
    expect(decision).toMatchObject({ kind: "scout_question", status: "open", conversationId: f.conversationId });
    expect(await f.scheduledNames()).toContain("decisions:formulateQuestion");
  });

  it("present_offer with a provider-side blocker raises nothing and keeps the notification", async () => {
    const f = await mailFixture();
    await f.record({ ...f.ready, monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] } });
    expect(await f.decisions()).toEqual([]);
    expect(await f.systemNotifications()).toHaveLength(1);
  });

  it("formulateQuestion runs one Scout round in the musician's chat: the tool records question + options, the text becomes the chat message", async () => {
    const f = await mailFixture();
    await f.record(f.asksMusician);
    await f.complete();
    const [decision] = await f.decisions();
    const model = new MockLanguageModelV4({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "q-1", toolName: "recordDecisionQuestion", input: JSON.stringify({ decisionId: decision!._id, questions: [{ id: "location", constraintKeys: [], question: "Passt dir Stuttgart-West statt Zentrum?", options: [{ id: "yes", label: "Ja, passt", constraintEffect: "none" }, { id: "no", label: "Nein, nur Zentrum", constraintEffect: "none" }] }] }) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "text", text: "Kurze Frage: Der Raum liegt in Stuttgart-West statt im Zentrum. Passt dir das?" }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ] });
    await ai.withRoomScoutLanguageModelForTest(model, () =>
      f.t.finishAllScheduledFunctions(() => vi.runAllTimers()));
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0]?.tools?.map((tool) => tool.name)).toEqual(["recordDecisionQuestion"]);
    const formulated = (await f.t.run((ctx) => ctx.db.get(decision!._id)))!;
    expect(formulated).toMatchObject({
      status: "open", question: "Passt dir Stuttgart-West statt Zentrum?",
      options: [{ id: "yes", label: "Ja, passt" }, { id: "no", label: "Nein, nur Zentrum" }],
    });
    expect(formulated.threadMessageId).toBeTruthy();
    const context = (await f.t.run((ctx) => ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", f.ownerId)).first()))!;
    const page = await f.t.run((ctx) => listMessages(ctx, components.agent, { threadId: context.threadId, paginationOpts: { cursor: null, numItems: 20 } }));
    expect(page.page.map((row) => ({ role: row.message?.role, text: row.text }))).toEqual([
      { role: "assistant", text: "Kurze Frage: Der Raum liegt in Stuttgart-West statt im Zentrum. Passt dir das?" },
    ]);
    expect(page.page[0]?._id).toBe(formulated.threadMessageId);
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
  });

  it("formulateQuestion falls back to a deterministic question when the model does not call the tool", async () => {
    const f = await mailFixture();
    // A fact the provider can supply must never reach the musician as a question, not even on
    // the deterministic path: without a constraint conflict the fallback asks the next step only.
    await f.record({ ...f.asksMusician, uncertainties: ["The exact address is unknown, so the 15 km radius cannot be verified"] });
    await f.complete();
    const model = new MockLanguageModelV4({ doGenerate: [
      { content: [{ type: "text", text: "" }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ] });
    await ai.withRoomScoutLanguageModelForTest(model, () =>
      f.t.finishAllScheduledFunctions(() => vi.runAllTimers()));
    const [decision] = await f.decisions();
    expect(decision).toMatchObject({ status: "open", question: "I need your decision about “Controlled room” before I continue. How should I proceed?", options: [] });
    expect(decision!.question).not.toContain("address");
    expect(decision!.threadMessageId).toBeTruthy();
  });

  it("a scout_question answer becomes a trusted musician_input turn and the assessment runs on it", async () => {
    const f = await mailFixture();
    await f.record(f.asksMusician);
    await f.complete();
    const [decision] = await f.decisions();
    await f.t.mutation(internal.decisions.recordDecisionQuestion, { decisionId: decision!._id, question: "Passt Stuttgart-West?", options: [{ id: "yes", label: "Ja" }] });
    const result = await f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "custom", text: "Stuttgart-West passt, wenn die S-Bahn nah ist." });
    expect(result).toMatchObject({ status: "answered", action: "reassessing" });
    expect(await f.t.run((ctx) => ctx.db.get(decision!._id))).toMatchObject({ status: "answered", answer: { choice: "custom", text: "Stuttgart-West passt, wenn die S-Bahn nah ist." } });
    expect(await f.t.query(internal.decisions.getAbsorbInput, { decisionId: decision!._id })).toBeNull();
    const turns = await f.t.run((ctx) => ctx.db.query("providerTurns").collect());
    const musicianTurn = turns.find((turn) => turn.kind === "musician_input")!;
    expect(musicianTurn).toMatchObject({ input: "Stuttgart-West passt, wenn die S-Bahn nah ist.", decisionId: decision!._id, status: "processing", revision: 2, sourceKey: `decision:${decision!._id}` });
    expect(await f.scheduledNames()).not.toContain("decisions:absorbMusicianAnswer");
    const conversation = (await f.t.run((ctx) => ctx.db.get(f.conversationId)))!;
    expect(conversation).toMatchObject({ revision: 2, activeEventId: musicianTurn._id, state: "thinking" });
    const input = (await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: musicianTurn._id }))!;
    expect(input).toMatchObject({ kind: "musician_input", musicianStatements: ["Stuttgart-West passt, wenn die S-Bahn nah ist."] });
    expect(input.evidence.some((source) => source.text.includes("Stuttgart-West passt"))).toBe(false);
    // The re-assessment records normally and the reply proposal is staged as for any turn.
    const offerId = await f.t.mutation(internal.providerConversations.recordAssessment, { eventId: musicianTurn._id, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment: f.ready });
    expect(offerId).toBeTruthy();
    expect(await f.t.run((ctx) => ctx.db.get(f.conversationId))).toMatchObject({ currentOfferId: offerId, state: "offer_ready" });
    // A provider-specific answer never runs a global-memory chat round.
    const before = (await f.scheduledNames()).filter((name) => name === "decisions:absorbMusicianAnswer").length;
    const [ready] = (await f.decisions()).filter((row) => row.status === "open");
    expect(ready).toMatchObject({ kind: "offer_ready" });
    expect((await f.scheduledNames()).filter((name) => name === "decisions:absorbMusicianAnswer")).toHaveLength(before);
  });

  it("a ready offer raises offer_ready with refs.offerId and keeps the notification; review keeps it open, no answers it", async () => {
    const f = await mailFixture();
    const offerId = await f.record(f.ready);
    const [decision] = await f.musician.query(api.decisions.listOpenMine, {});
    expect(decision).toMatchObject({
      kind: "offer_ready", question: "Ein Angebot liegt vor. Willst du es prüfen?",
      options: [{ id: "review", label: "Angebot prüfen" }, { id: "no", label: "Nicht dieses" }],
      refs: { offerId }, conversationId: f.conversationId,
    });
    expect(await f.systemNotifications()).toHaveLength(1);
    expect(await f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "review" })).toMatchObject({ status: "open", next: "open_offer_review" });
    expect(await f.musician.query(api.decisions.listOpenMine, {})).toHaveLength(1);
    expect(await f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "no" })).toMatchObject({ status: "answered", action: "declined" });
    expect(await f.musician.query(api.decisions.listOpenMine, {})).toEqual([]);
  });

  it("offer_ready 'no' dismisses the opportunity behind the conversation", async () => {
    const f = await mailFixture();
    const opportunityId = await f.t.run(async (ctx) => {
      const now = Date.now();
      const id = await ctx.db.insert("opportunities", { ownerId: f.ownerId, savedNeedId: f.savedNeedId, signalId: f.signalId, kind: "supply_match", status: "contacted", score: 0.9, reasons: [], uncertainties: [], fingerprint: "fp", firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now });
      await ctx.db.patch(f.conversationId, { opportunityId: id });
      return id;
    });
    await f.record(f.ready);
    const [decision] = await f.musician.query(api.decisions.listOpenMine, {});
    expect(await f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "no" })).toMatchObject({ action: "opportunity_dismissed" });
    expect(await f.t.run((ctx) => ctx.db.get(opportunityId))).toMatchObject({ status: "dismissed" });
  });
});

describe("Entscheidung human_step for portal registration", () => {
  async function registrationFixture(browserProvider: "firecrawl" | "browserbase") {
    const t = convexTest(schema, modules);
    agentTest.register(t);
    const ids = await t.run(async (ctx) => {
      const now = Date.now();
      const ownerId = await ctx.db.insert("users", { username: "registering", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
      const platformId = await ctx.db.insert("sourcePlatforms", { slug: "controlled", name: "Controlled portal", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
      const sourceId = await ctx.db.insert("sources", { platformId, slug: "controlled-connected", name: "Controlled connected messaging", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
      const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, platformId, label: "Test connection", allowedDomains: ["roomscout.dev"], allowedPaths: ["/"], adapterKey: "roomscout-dev-v1", status: "needs_auth", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: false, pollIntervalMinutes: 30, failureCount: 0, browserProvider, createdAt: now, updatedAt: now });
      const runId = await ctx.db.insert("browserRuns", { connectionId, ownerId, browserProvider, kind: "authenticate", status: "running", onboardingStage: "waiting_verification", expiresAt: now + 60_000, createdAt: now, updatedAt: now });
      return { ownerId, connectionId, runId };
    });
    return { t, ...ids, musician: t.withIdentity({ subject: ids.ownerId }) };
  }

  it("human_required raises human_step (Firecrawl: re-register hint) and finishRun answers it", async () => {
    const f = await registrationFixture("firecrawl");
    await f.t.mutation(internal.portalConnections.markAgentOnboardingState, { ownerId: f.ownerId, runId: f.runId, stage: "human_required", humanRequired: true, eventMessage: "VERIFICATION_CODE_AMBIGUOUS" });
    const [decision] = await f.musician.query(api.decisions.listOpenMine, {});
    expect(decision).toMatchObject({
      kind: "human_step", question: "Bei der Anmeldung im Portal brauche ich dich.",
      detail: "Verbindung in den Einstellungen neu registrieren.", options: [], refs: { runId: f.runId, connectionId: f.connectionId },
    });
    await expect(f.musician.mutation(api.decisions.answer, { decisionId: decision!._id, choice: "done" })).rejects.toThrow("DECISION_NOT_ANSWERABLE");
    await f.t.mutation(internal.portalConnections.finishRun, { runId: f.runId, status: "stopped" });
    expect(await f.t.run((ctx) => ctx.db.get(decision!._id))).toMatchObject({ status: "answered", answer: { choice: "stopped" } });
    expect(await f.musician.query(api.decisions.listOpenMine, {})).toEqual([]);
  });

  it("Browserbase carries no detail (the UI links to the run); a reauth-required finish raises a fresh human_step", async () => {
    const f = await registrationFixture("browserbase");
    await f.t.mutation(internal.portalConnections.markAgentOnboardingState, { ownerId: f.ownerId, runId: f.runId, stage: "human_required", humanRequired: true, eventMessage: "SIGNUP_CAPTCHA_REQUIRES_HUMAN" });
    const [first] = await f.musician.query(api.decisions.listOpenMine, {});
    expect(first).toMatchObject({ kind: "human_step", refs: { runId: f.runId, connectionId: f.connectionId } });
    expect(first!.detail).toBeUndefined();
    await f.t.mutation(internal.portalConnections.finishRun, { runId: f.runId, status: "failed", errorCode: "VERIFICATION_TIMEOUT", reauthRequired: true });
    expect(await f.t.run((ctx) => ctx.db.get(first!._id))).toMatchObject({ status: "answered", answer: { choice: "failed" } });
    const [next] = await f.musician.query(api.decisions.listOpenMine, {});
    expect(next).toMatchObject({ kind: "human_step", refs: { runId: f.runId, connectionId: f.connectionId } });
    expect(next!._id).not.toBe(first!._id);
    expect(await f.t.run((ctx) => ctx.db.get(f.connectionId))).toMatchObject({ status: "reauth_required" });
  });

  it("one open decision per owner without a conversation: a new human_step supersedes the older one", async () => {
    const f = await registrationFixture("firecrawl");
    const older = await f.t.run((ctx) => raiseDecision(ctx, { ownerId: f.ownerId, kind: "human_step", question: "alt", options: [], refs: { connectionId: f.connectionId } }));
    await f.t.mutation(internal.portalConnections.markAgentOnboardingState, { ownerId: f.ownerId, runId: f.runId, stage: "human_required", humanRequired: true, eventMessage: "VERIFICATION_EMAIL_NOT_FOUND" });
    expect(await f.t.run((ctx) => ctx.db.get(older))).toMatchObject({ status: "superseded" });
    expect(await f.musician.query(api.decisions.listOpenMine, {})).toHaveLength(1);
  });
});
