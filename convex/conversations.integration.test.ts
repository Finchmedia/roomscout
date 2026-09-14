/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import * as ai from "./ai";
import { DEFAULT_AUTONOMY_RULES, type AutonomyRules } from "./lib/autonomy";
import { signalMatchRevision } from "./lib/matchValidity";
import { type ProviderAssessment } from "./lib/providerAssessment";
import { scoutAgent } from "./scoutRuntime";

const modules = import.meta.glob("./**/*.ts");
const originalModel = scoutAgent.options.languageModel;
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", ""); });
afterEach(() => { scoutAgent.options.languageModel = originalModel; vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

const PROVIDER_TEXT = "Hallo, der Raum ist noch frei. 220 Euro im Monat.";
const SCOUT_TEXT = "Ist der Raum noch frei?";
const MUSICIAN_TEXT = "Wir kommen zu dritt, passt das?";
const PENDING_TEXT = "Kann ich den Raum am Montag ansehen?";

/**
 * One controlled-portal conversation of a musician with everything the
 * Nachrichten surface merges: an inbound provider message, a sent Scout
 * message and a sent musician message (both linked through actionExecutions),
 * a request still waiting for the Freigabeprüfung, an assessment, the
 * musician's answer to a Scout question and the answered Entscheidung.
 */
async function fixture(rules: Partial<AutonomyRules> = {}) {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  const f = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "inbox-musician", role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "inbox-other", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Stuttgart", districts: [], arrangement: ["shared"], schedule: [], requirements: [], maxBudgetEur: 250, matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "controlled", name: "Controlled portal", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: "controlled", name: "Controlled listings", baseUrl: "https://roomscout.dev/listings", side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now });
    const connectedSourceId = await ctx.db.insert("sources", { platformId, slug: "controlled-connected", name: "Controlled connected messaging", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const targetId = await ctx.db.insert("sourceTargets", { sourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: "test", scheduleMinutes: 1440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now });
    const entryId = await ctx.db.insert("sourceEntries", { sourceId, sourceTargetId: targetId, externalId: "room-1", canonicalUrl: "https://roomscout.dev/listings/room-1", detailUrl: "https://roomscout.dev/listings/room-1", title: "Test listing", excerpt: "Controlled listing", side: "supply", city: "Stuttgart", status: "active", detailState: "processed", detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { sourceEntryId: entryId, side: "supply", title: "Proberaum im Westen", city: "Stuttgart", summary: "Shared room", arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    const signalRevision = await signalMatchRevision((await ctx.db.get(signalId))!);
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, sourceId: connectedSourceId, scopeKey: "controlled:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: true, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/terms"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, sourceId: connectedSourceId, scopeKey: "controlled:contact", flow: "contact", adapterKey: "roomscout-dev-v1", adapterVersion: 1, status: "active", executor: "browserbase", config: { kind: "browserbase", workflowKey: "roomscout-dev.platform-message.v1", contextRequired: true }, configFingerprint: "test", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId: connectedSourceId, platformId, label: "Test connection", allowedDomains: ["roomscout.dev"], allowedPaths: ["/listings", "/inbox"], adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    const threadId = await ctx.db.insert("platformThreads", { connectionId, ownerId, providerThreadId: "thread-1", participants: ["Anna vom Proberaum"], lastMessageAt: now - 6_000, status: "open", createdAt: now - 10_000, updatedAt: now - 6_000 });
    const conversationId = await ctx.db.insert("providerConversations", { ownerId, savedNeedId: needId, signalId, conversationKey: "controlled", agentThreadId: "test-agent-thread", platformThreadId: threadId, revision: 1, state: "needs_attention", createdAt: now - 10_000, updatedAt: now - 1_000 });
    const turnId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "portal:one", kind: "portal_reply", revision: 1, status: "completed", createdAt: now - 9_000 });
    const assessment: ProviderAssessment = {
      summary: "Der Anbieter bestätigt 220 Euro im Monat.",
      availability: { status: "available", evidence: [] },
      monthlyPrice: { totalEur: 220, allRecurringCostsKnown: true, evidence: [] },
      terms: [], constraints: [], uncertainties: [], contradictions: [],
      nextAction: "ask_provider", suggestedReply: { subject: "Raum", body: SCOUT_TEXT },
    };
    const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId: turnId, revision: 1, needRevision: 1, signalRevision, assessment, ready: false, blockers: ["Besichtigung offen"], contentHash: "offer-v1", model: ai.ROOMSCOUT_MODEL_ID, promptVersion: "test", schemaVersion: "test", createdAt: now - 7_000 });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });

    const common = {
      ownerId, savedNeedId: needId, providerConversationId: conversationId, providerOfferId: offerId,
      matchingNeedRevision: 1, matchingSignalId: signalId, matchingSignalRevision: signalRevision,
      platformId, connectionId, adapterBindingId: bindingId, policyVersionId: policyId,
      automationMode: "autopilot" as const, requestedActionType: "send_platform_dm" as const,
      personalDataScopes: [], contentVersion: 1, createdAt: now - 9_000,
    };
    const sentRequestId = await ctx.db.insert("actionRequests", { ...common, payload: { kind: "platform_message", threadId, recipients: ["Anna vom Proberaum"], senderLabel: "RoomScout musician", subject: "Raum", body: SCOUT_TEXT }, contentHash: "sent-scout", status: "executed", updatedAt: now - 8_000 });
    const humanRequestId = await ctx.db.insert("actionRequests", { ...common, humanDraft: true, payload: { kind: "platform_message", threadId, recipients: ["Anna vom Proberaum"], senderLabel: "RoomScout musician", subject: "Raum", body: MUSICIAN_TEXT }, contentHash: "sent-human", status: "executed", updatedAt: now - 6_000 });
    const pendingRequestId = await ctx.db.insert("actionRequests", {
      ...common, payload: { kind: "platform_message", threadId, recipients: ["Anna vom Proberaum"], senderLabel: "RoomScout musician", subject: "Raum", body: PENDING_TEXT },
      contentHash: "pending-scout", status: "awaiting_approval", updatedAt: now - 2_000,
      gate: { outcome: "ask_user", reason: "review_mode", autonomyVersion: 1, autonomyHash: "hash", decidedAt: now - 2_000 },
    });
    for (const [requestId, providerMessageId] of [[sentRequestId, "out-scout-1"], [humanRequestId, "out-human-1"]] as const) {
      const approvalId = await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: "hash", payloadSnapshot: { kind: "platform_message", threadId, recipients: ["Anna vom Proberaum"], subject: "Raum", body: "x" }, decision: "authorized_by_autonomy", decidedAt: now - 8_000 });
      await ctx.db.insert("actionExecutions", { requestId, ownerId, approvalId, connectionId, status: "succeeded", idempotencyKey: `key-${providerMessageId}`, providerMessageId, startedAt: now - 8_000, createdAt: now - 8_000, updatedAt: now - 8_000 });
    }

    await ctx.db.insert("platformMessages", { connectionId, ownerId, threadId, providerMessageId: "in-1", direction: "inbound", senderLabel: "Anna vom Proberaum", bodyText: PROVIDER_TEXT, sentAt: now - 9_000, createdAt: now - 9_000 });
    await ctx.db.insert("platformMessages", { connectionId, ownerId, threadId, providerMessageId: "out-scout-1", direction: "outbound", bodyText: SCOUT_TEXT, sentAt: now - 8_000, createdAt: now - 8_000 });
    await ctx.db.insert("platformMessages", { connectionId, ownerId, threadId, providerMessageId: "out-human-1", direction: "outbound", bodyText: MUSICIAN_TEXT, sentAt: now - 6_000, createdAt: now - 6_000 });

    const answeredDecisionId = await ctx.db.insert("decisions", { ownerId, savedNeedId: needId, conversationId, kind: "scout_question", status: "answered", question: "Wie viele Personen probt ihr?", options: [], refs: {}, answer: { choice: "custom", text: "Zu dritt", at: now - 5_000 }, createdAt: now - 5_500, updatedAt: now - 5_000 });
    const inputTurnId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: `decision:${answeredDecisionId}`, kind: "musician_input", input: "Zu dritt", decisionId: answeredDecisionId, revision: 1, status: "completed", createdAt: now - 5_000 });

    return { now, ownerId, otherId, needId, signalId, connectionId, threadId, conversationId, offerId, turnId, sentRequestId, humanRequestId, pendingRequestId, answeredDecisionId, inputTurnId };
  });
  const musician = t.withIdentity({ subject: f.ownerId });
  const stranger = t.withIdentity({ subject: f.otherId });
  await musician.mutation(api.autonomy.save, { rules: { ...DEFAULT_AUTONOMY_RULES, ...rules } });
  const conversation = () => t.run((ctx) => ctx.db.get(f.conversationId));
  const request = (id: Id<"actionRequests">) => t.run((ctx) => ctx.db.get(id));
  /** The open Entscheidung the Freigabeprüfung would have raised for the waiting request. */
  const openReviewDecision = async () => await t.run((ctx) => ctx.db.insert("decisions", {
    ownerId: f.ownerId, savedNeedId: f.needId, conversationId: f.conversationId, kind: "review_message", status: "open",
    question: "Soll ich diese Nachricht so senden?", detail: PENDING_TEXT, options: [{ id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" }],
    refs: { requestId: f.pendingRequestId, offerId: f.offerId }, createdAt: f.now - 2_000, updatedAt: f.now - 2_000,
  }));
  return { t, musician, stranger, conversation, request, openReviewDecision, ...f };
}

describe("Nachrichten list", () => {
  it("lists the conversation with title, preview and unread, and markRead clears it", async () => {
    const s = await fixture();
    const [row] = await s.musician.query(api.conversations.listMine, {});
    expect(row).toMatchObject({
      conversationId: s.conversationId, title: "Proberaum im Westen", subtitle: "Stuttgart",
      channel: "platform", state: "needs_attention", providerLabel: "Anna vom Proberaum", unread: true,
      preview: { author: "musician", text: MUSICIAN_TEXT },
      pending: { requestId: s.pendingRequestId, status: "awaiting_approval", author: "scout", gateReason: "review_mode", gateText: "Du prüfst Nachrichten vor dem Versand." },
      offer: { offerId: s.offerId, ready: false },
    });
    expect(row?.lastActivityAt).toBe(s.now - 1_000);
    expect(row?.openDecision).toBeUndefined();

    expect(await s.musician.mutation(api.conversations.markRead, { conversationId: s.conversationId })).toBeNull();
    const [read] = await s.musician.query(api.conversations.listMine, {});
    expect(read).toMatchObject({ unread: false, lastReadAt: s.now });

    // An open Entscheidung is what the row announces, not a separate flag.
    const decisionId = await s.openReviewDecision();
    const [withDecision] = await s.musician.query(api.conversations.listMine, {});
    expect(withDecision?.openDecision).toEqual({ decisionId, kind: "review_message", question: "Soll ich diese Nachricht so senden?" });
  });

  it("keeps another musician's conversation out of the list and out of reach", async () => {
    const s = await fixture();
    expect(await s.stranger.query(api.conversations.listMine, {})).toEqual([]);
    expect(await s.stranger.query(api.conversations.getMine, { conversationId: s.conversationId })).toBeNull();
    expect(await s.stranger.mutation(api.conversations.markRead, { conversationId: s.conversationId })).toBeNull();
    expect((await s.conversation())?.lastReadAt).toBeUndefined();
    await expect(s.stranger.mutation(api.conversations.reply, { conversationId: s.conversationId, body: "Hallo" }))
      .rejects.toThrow("CONVERSATION_NOT_FOUND");
    await expect(s.musician.query(api.conversations.listMine, { limit: 0 })).rejects.toThrow("INVALID_LIMIT");
  });
});

describe("Nachrichten conversation", () => {
  it("merges provider, Scout, musician, waiting, assessment, input and Entscheidung rows in time order", async () => {
    const s = await fixture();
    const result = (await s.musician.query(api.conversations.getMine, { conversationId: s.conversationId }))!;
    expect(result.header).toMatchObject({
      conversationId: s.conversationId, title: "Proberaum im Westen", subtitle: "Stuttgart",
      channel: "platform", state: "needs_attention", providerLabel: "Anna vom Proberaum",
      composer: { enabled: true },
    });
    expect(result.header.offer).toMatchObject({ offerId: s.offerId, revision: 1, ready: false, blockers: ["Besichtigung offen"] });
    expect(result.header.offer?.assessment.summary).toBe("Der Anbieter bestätigt 220 Euro im Monat.");

    expect(result.items.map((item) => item.kind)).toEqual([
      "provider_message", "sent_message", "scout_note", "sent_message", "decision", "musician_input", "pending_message",
    ]);
    expect(result.items[0]).toMatchObject({ kind: "provider_message", label: "Anna vom Proberaum", text: PROVIDER_TEXT, at: s.now - 9_000 });
    // The Scout's own message and the musician's dictated one are told apart by the execution that produced them.
    expect(result.items[1]).toMatchObject({ kind: "sent_message", author: "scout", text: SCOUT_TEXT });
    expect(result.items[3]).toMatchObject({ kind: "sent_message", author: "musician", text: MUSICIAN_TEXT });
    expect(result.items[2]).toMatchObject({ kind: "scout_note", id: s.offerId, revision: 1, summary: "Der Anbieter bestätigt 220 Euro im Monat.", nextAction: "ask_provider" });
    expect(result.items[4]).toMatchObject({ kind: "decision", id: s.answeredDecisionId, decision: { status: "answered", question: "Wie viele Personen probt ihr?" } });
    expect(result.items[5]).toMatchObject({ kind: "musician_input", id: s.inputTurnId, text: "Zu dritt" });
    expect(result.items[6]).toMatchObject({
      kind: "pending_message", id: s.pendingRequestId, author: "scout", text: PENDING_TEXT,
      status: "awaiting_approval", gateReason: "review_mode", gateText: "Du prüfst Nachrichten vor dem Versand.",
    });
  });

  it("names why the composer is closed: thinking, closed, assessment_required", async () => {
    const s = await fixture();
    const composer = async () => (await s.musician.query(api.conversations.getMine, { conversationId: s.conversationId }))!.header.composer;

    await s.t.run((ctx) => ctx.db.patch(s.conversationId, { state: "thinking" }));
    expect(await composer()).toEqual({ enabled: false, reason: "thinking" });

    await s.t.run((ctx) => ctx.db.patch(s.conversationId, { state: "needs_attention", activeEventId: s.turnId }));
    expect(await composer()).toEqual({ enabled: false, reason: "thinking" });

    await s.t.run((ctx) => ctx.db.patch(s.conversationId, { activeEventId: undefined, revision: 2 }));
    expect(await composer()).toEqual({ enabled: false, reason: "assessment_required" });

    await s.t.run((ctx) => ctx.db.patch(s.conversationId, { revision: 1, state: "closed" }));
    expect(await composer()).toEqual({ enabled: false, reason: "closed" });
  });

  it("reports channel_not_ready when the portal connection is gone", async () => {
    const s = await fixture();
    await s.t.run((ctx) => ctx.db.patch(s.connectionId, { status: "reauth_required" }));
    const result = (await s.musician.query(api.conversations.getMine, { conversationId: s.conversationId }))!;
    expect(result.header.composer).toEqual({ enabled: false, reason: "channel_not_ready" });
  });
});

describe("Nachrichten reply", () => {
  it("stages the musician's own text, which the Freigabeprüfung lets through", async () => {
    const s = await fixture();
    const result = await s.musician.mutation(api.conversations.reply, { conversationId: s.conversationId, body: "Passt der Montagabend?" });
    expect(result).toMatchObject({ status: "approved", dispatched: true, sent: false });
    expect(result.decisionId).toBeUndefined();
    expect(await s.request(result.requestId)).toMatchObject({ humanDraft: true, status: "approved", payload: { kind: "platform_message", body: "Passt der Montagabend?" } });
    // It shows up as a waiting row until the execution reports a message.
    const after = (await s.musician.query(api.conversations.getMine, { conversationId: s.conversationId }))!;
    expect(after.items.filter((item) => item.kind === "pending_message").map((item) => item.author)).toEqual(["scout", "musician"]);

    await expect(s.musician.mutation(api.conversations.reply, { conversationId: s.conversationId, body: "   " }))
      .rejects.toThrow("INVALID_REPLY_BODY");
  });

  it("answers an open Entscheidung about an outgoing message instead of queueing a second one", async () => {
    const s = await fixture();
    const decisionId = await s.openReviewDecision();
    const result = await s.musician.mutation(api.conversations.reply, { conversationId: s.conversationId, body: "Lieber Dienstag, geht das?" });
    expect(result).toMatchObject({ decisionId, status: "approved", dispatched: true, sent: false });
    expect(result.requestId).not.toBe(s.pendingRequestId);
    // The Scout's draft is withdrawn, the Entscheidung is answered with the musician's words.
    expect(await s.request(s.pendingRequestId)).toMatchObject({ status: "rejected" });
    expect(await s.t.run((ctx) => ctx.db.get(decisionId))).toMatchObject({ status: "answered", answer: { choice: "custom", text: "Lieber Dienstag, geht das?" } });
    expect(await s.request(result.requestId)).toMatchObject({ humanDraft: true, payload: { kind: "platform_message", body: "Lieber Dienstag, geht das?" } });
  });

  it("refuses a reply while the conversation is closed or the assessment is missing", async () => {
    const s = await fixture();
    await s.t.run((ctx) => ctx.db.patch(s.conversationId, { currentOfferId: undefined }));
    await expect(s.musician.mutation(api.conversations.reply, { conversationId: s.conversationId, body: "Hallo" }))
      .rejects.toThrow("CONVERSATION_ASSESSMENT_REQUIRED");
    await s.t.run((ctx) => ctx.db.patch(s.conversationId, { currentOfferId: s.offerId, state: "closed" }));
    await expect(s.musician.mutation(api.conversations.reply, { conversationId: s.conversationId, body: "Hallo" }))
      .rejects.toThrow("CONVERSATION_CLOSED");
  });
});
