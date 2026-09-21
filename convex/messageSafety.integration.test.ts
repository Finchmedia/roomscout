/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { actionPayloadHash } from "./integrations/contentHash";
import { signalMatchRevision } from "./lib/matchValidity";
import { MESSAGE_SAFETY_VERSION, messageSafetyContext, messageSafetyInstructions, messageSafetySchema } from "./lib/messageSafety";
import type { ProviderAssessment } from "./lib/providerAssessment";
import * as ai from "./ai";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
const clear = messageSafetySchema.parse({ classification: "non_binding", explanation: "Asks about availability without agreeing to anything.", personalDataScopes: [], proposedMonthlyPriceEur: null, unsupportedClaims: [] });

async function fixture(options?: { initial?: boolean }) {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool"); workpoolTest.register(t, "browserWorkpool");
  const f = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "controlled-musician", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "other-musician", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Stuttgart", districts: [], arrangement: ["shared"], schedule: ["Wednesday evenings"], requirements: [], genres: ["Post-rock"], facets: [{ namespace: "band", key: "size", value: 4, confidence: 1 }], maxBudgetEur: 250, matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "controlled", name: "Controlled portal", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: "controlled", name: "Controlled listings", baseUrl: "https://roomscout.dev/listings", side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now });
    const connectedSourceId = await ctx.db.insert("sources", { platformId, slug: "controlled-connected", name: "Controlled connected messaging", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const targetId = await ctx.db.insert("sourceTargets", { sourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: "test", scheduleMinutes: 1440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now });
    const entryId = await ctx.db.insert("sourceEntries", { sourceId, sourceTargetId: targetId, externalId: "room-1", canonicalUrl: "https://roomscout.dev/listings/room-1", detailUrl: "https://roomscout.dev/listings/room-1", title: "Test listing", excerpt: "Controlled listing", side: "supply", city: "Stuttgart", status: "active", detailState: "processed", detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { sourceEntryId: entryId, side: "supply", title: "Controlled room", city: "Stuttgart", summary: "Shared room", arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    const signalRevision = await signalMatchRevision((await ctx.db.get(signalId))!);
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, sourceId, scopeKey: "controlled:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: true, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/terms"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, sourceId, scopeKey: "controlled:contact", flow: "contact", adapterKey: "roomscout-dev-v1", adapterVersion: 1, status: "active", executor: "browserbase", config: { kind: "browserbase", workflowKey: "roomscout-dev.platform-message.v1", contextRequired: true }, configFingerprint: "test", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, platformId, label: "Test connection", allowedDomains: ["roomscout.dev"], allowedPaths: ["/listings", "/inbox"], adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    const threadId = await ctx.db.insert("platformThreads", { connectionId, ownerId, providerThreadId: "thread-1", participants: ["Test provider"], lastMessageAt: now, status: "open", createdAt: now, updatedAt: now });
    const conversationId = await ctx.db.insert("providerConversations", { ownerId, savedNeedId: needId, signalId, conversationKey: "controlled", agentThreadId: "test-agent-thread", platformThreadId: threadId, revision: 1, state: "needs_attention", createdAt: now, updatedAt: now });
    await ctx.db.patch(policyId, { sourceId: connectedSourceId });
    await ctx.db.patch(bindingId, { sourceId: connectedSourceId });
    await ctx.db.patch(connectionId, { sourceId: connectedSourceId });
    if (options?.initial) {
      const opportunityId = await ctx.db.insert("opportunities", { ownerId, savedNeedId: needId, kind: "supply_match", status: "reviewing", signalId, platformId, score: 0.8, reasons: ["Matching city"], uncertainties: [], fingerprint: "initial-match", firstSeenAt: now, lastSeenAt: now, createdAt: now, updatedAt: now });
      await ctx.db.insert("signalMatches", { ownerId, savedNeedId: needId, signalId, kind: "need_supply", score: 0.8, structuredScore: 0.8, semanticScore: 0.8, reasons: ["Matching city"], uncertainties: [], status: "new", fingerprint: "match", eligible: true, contactEligible: true, needRevision: 1, signalRevision, createdAt: now, updatedAt: now });
      await ctx.db.patch(conversationId, { platformThreadId: undefined, opportunityId });
    }
    const eventId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "portal:one", kind: "portal_reply", revision: 1, status: "completed", createdAt: now });
    const assessment: ProviderAssessment = { summary: "Ask whether the room is still free", availability: { status: "unknown", evidence: [] }, monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] }, terms: [], constraints: [], uncertainties: ["Availability"], contradictions: [], nextAction: "ask_provider", suggestedReply: { subject: "Room availability", body: "Is the room still available?" }, viewing: null };
    const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId, revision: 1, needRevision: 1, signalRevision, assessment, ready: false, blockers: ["Availability unknown"], contentHash: "offer-v1", model: ai.ROOMSCOUT_MODEL_ID, promptVersion: "test", schemaVersion: "test", createdAt: now });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });
    return { ownerId, otherId, needId, platformId, connectionId, threadId, conversationId, offerId, signalId, bindingId, policyId };
  });
  const requestId = (await t.mutation(internal.providerActions.stageReply, { offerId: f.offerId }))!;
  expect(requestId).toBeTruthy();
  const input = (await t.query(internal.messageSafety.getInput, { requestId }))!;
  const authorize = (assessment = clear) => t.mutation(internal.messageSafety.recordAndAuthorize, { requestId, snapshotHash: input.snapshotHash, assessment });
  // Executors run the Freigabeprüfung (prepareClaim) before the transactional claim.
  const claim = async () => {
    const gate = await t.mutation(internal.externalActions.prepareClaim, { ownerId: f.ownerId, requestId, executor: "browserbase" });
    if (gate.outcome !== "proceed") throw new ConvexError({ code: `GATE_${gate.outcome.toUpperCase()}`, reason: gate.reason });
    return t.mutation(internal.externalActions.claimForExecutor, { ownerId: f.ownerId, requestId, executor: "browserbase" });
  };
  const request = () => t.run((ctx) => ctx.db.get(requestId));
  return { t, ...f, requestId, input, authorize, claim, request };
}

describe("semantic final-message gate and provider dispatch", () => {
  it("starts a conversation using the listing URL and the separate authenticated-source connection", async () => {
    const f = await fixture({ initial: true });
    const request = await f.request();
    expect(request?.personalDataScopes).toContain("band_name");
    expect(request?.payload).toMatchObject({ senderLabel: "RoomScout for Night Owls" });
    expect(request?.payload.kind === "platform_message" ? request.payload.body : "").toBe(
      "Hello, I’m RoomScout, an AI assistant contacting you on behalf of Night Owls.\n\nWe are a 4-piece act.\n\nWe play Post-rock.\n\nIs the room still available?",
    );
    expect(request?.payload.kind === "platform_message" ? request.payload.body : "").not.toContain("250");
    expect(JSON.stringify(request?.payload)).not.toContain("controlled-musician");
    expect(JSON.parse(f.input.data).search).toMatchObject({
      genres: ["Post-rock"],
      facets: [{ namespace: "band", key: "size", value: 4, confidence: 1 }],
    });
    await f.authorize();
    const claimed = await f.claim();
    expect(claimed.payload).toMatchObject({ targetPath: "/listings/room-1", recipients: ["Listing owner"] });
    expect(claimed.payload).not.toHaveProperty("threadId");
    expect(claimed.connectionId).toBe(f.connectionId);
  });

  it("invalidates the safety snapshot when the confirmed provider identity changes", async () => {
    const f = await fixture();
    await f.authorize();
    const before = f.input.snapshotHash;
    await f.t.run((ctx) => ctx.db.patch(f.ownerId, { actName: "Morning Static", providerIdentityConfirmedAt: Date.now() + 1 }));
    const request = (await f.t.run((ctx) => ctx.db.get(f.requestId)))!;
    const after = await f.t.run((ctx) => messageSafetyContext(ctx, request));
    expect(after?.snapshotHash).not.toBe(before);
    expect(after?.data).toContain('"representedName":"Morning Static"');
    expect((await f.t.mutation(internal.externalActions.prepareClaim, { ownerId: f.ownerId, requestId: f.requestId, executor: "browserbase" })).outcome).not.toBe("proceed");
  });
  it("stages one exact server-resolved reply and authorizes it only after the semantic check", async () => {
    const f = await fixture();
    expect(await f.t.mutation(internal.providerActions.stageReply, { offerId: f.offerId })).toBe(f.requestId);
    await expect(f.claim()).rejects.toThrow("ACTION_NOT_EXECUTABLE");
    expect(await f.authorize()).toBe(true);
    expect(await f.authorize()).toBe(false);
    const first = await f.claim(); const resumed = await f.claim();
    expect(resumed.executionId).toBe(first.executionId);
    expect(resumed.alreadyClaimed).toBe(true);
    expect(first.payload).toMatchObject({ kind: "platform_message", threadId: f.threadId, recipients: ["Test provider"], body: "Is the room still available?" });
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toHaveLength(1);
    expect(await f.t.withIdentity({ subject: f.otherId }).query(api.externalActions.listMine, {})).toEqual([]);
  });

  it.each([
    ["binding", "awaiting_approval", "binding_content"],
    ["uncertain", "awaiting_approval", "uncertain_content"],
    ["unsafe", "blocked", "unsafe_content"],
  ] as const)("does not authorize a %s semantic verdict: %s (%s)", async (classification, status, reason) => {
    const f = await fixture();
    expect(await f.authorize({ ...clear, classification })).toBe(false);
    expect(await f.request()).toMatchObject({ status, gate: { outcome: status === "blocked" ? "stop" : "ask_user", reason } });
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toEqual([]);
  });

  it("reports the persisted approval decision on repeated submission, not just the selected mode", async () => {
    const f = await fixture();
    const musician = f.t.withIdentity({ subject: f.ownerId });
    expect((await musician.mutation(api.externalActions.submit, { requestId: f.requestId })).authorizedByAutonomy).toBe(false);
    await f.authorize({ ...clear, classification: "uncertain" });
    const request = (await f.t.run((ctx) => ctx.db.get(f.requestId)))!;
    await musician.mutation(api.externalActions.decide, { requestId: f.requestId, decision: "approved", expectedContentVersion: request.contentVersion, expectedContentHash: request.contentHash, expectedPayload: request.payload });
    expect(await musician.mutation(api.externalActions.submit, { requestId: f.requestId })).toMatchObject({ status: "approved", authorizedByAutonomy: false });

    const automatic = await fixture();
    await automatic.authorize();
    expect((await automatic.t.withIdentity({ subject: automatic.ownerId }).mutation(api.externalActions.submit, { requestId: automatic.requestId })).authorizedByAutonomy).toBe(true);
  });

  it("uses detected disclosures and unsupported claims, not the model author's empty declaration", async () => {
    const cases: Array<[typeof clear, string, string]> = [
      [{ ...clear, personalDataScopes: ["phone"] }, "private_data", "phone"],
      [{ ...clear, unsupportedClaims: ["Invented rehearsal availability"] }, "unsupported_claims", "Invented rehearsal availability"],
    ];
    for (const [assessment, reason, detail] of cases) {
      const f = await fixture();
      expect(await f.authorize(assessment)).toBe(false);
      expect(await f.request()).toMatchObject({ status: "awaiting_approval", gate: { outcome: "ask_user", reason, detail } });
      await expect(f.claim()).rejects.toThrow("ACTION_NOT_EXECUTABLE");
    }
  });

  it("rejects a late semantic result after an inbound update", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.conversationId, { revision: 2 }));
    expect(await f.authorize()).toBe(false);
    expect(await f.t.run((ctx) => ctx.db.query("messageSafetyAssessments").collect())).toEqual([]);
    expect((await f.t.run((ctx) => ctx.db.get(f.requestId)))?.status).toBe("expired");
  });

  it.each([
    ["search", "stop", "context_changed", "expired"],
    ["provider", "stop", "context_changed", "expired"],
    ["autonomy", "stop", "action_not_allowed", "blocked"],
    ["content", "stop", "context_changed", "expired"],
    ["memory", "wait", "safety_pending", "queued"],
  ] as const)("rechecks changed %s after authorization, before a provider click (%s %s)", async (change, outcome, reason, status) => {
    const f = await fixture(); await f.authorize();
    await f.t.run(async (ctx) => {
      const now = Date.now();
      if (change === "search") await ctx.db.patch(f.needId, { matchingRevision: 2 });
      if (change === "provider") await ctx.db.patch(f.conversationId, { revision: 2 });
      if (change === "autonomy") await ctx.db.insert("scoutAutonomy", { ownerId: f.ownerId, mode: "autopilot", contact: false, viewings: true, publishAd: false, shareProfile: true, sharePrivate: false, version: 1, contentHash: "rules-v1", createdAt: now, updatedAt: now });
      if (change === "content") {
        const request = (await ctx.db.get(f.requestId))!;
        if (request.payload.kind !== "platform_message") throw new Error("bad fixture");
        await ctx.db.patch(f.requestId, { payload: { ...request.payload, body: "Then the place is ours starting next month." } });
      }
      if (change === "memory") await ctx.db.insert("memoryProfiles", { ownerId: f.ownerId, summary: "We can no longer rehearse on Mondays.", factVersion: 1, contextVersion: 1, openQuestions: [], hardConstraints: [], softPreferences: [], createdAt: now, updatedAt: now });
    });
    await expect(f.claim()).rejects.toThrow(`GATE_${outcome.toUpperCase()}`);
    expect(await f.request()).toMatchObject({ status, gate: { outcome, reason } });
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
  });

  it("runs structured generation through the gateway helper, not a regex verdict", async () => {
    const f = await fixture();
    const generate = vi.spyOn(ai, "generateRoomScoutObject").mockResolvedValue(clear);
    await f.t.action(internal.messageSafety.assessAndAuthorize, { requestId: f.requestId });
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0]![0].instructions).toContain("EXACT final outgoing payload");
    expect((await f.t.run((ctx) => ctx.db.get(f.requestId)))?.status).toBe("approved");
  });

  it("parks the message on exhausted AI retries and asks after the third wait, never a regex fallback", async () => {
    const f = await fixture();
    const exhausted = () => f.t.mutation(internal.messageSafety.assessmentCompleted, { workId: "test" as never, context: { requestId: f.requestId, contentVersion: 1 }, result: { kind: "failed", error: "provider unavailable" } });
    await exhausted();
    expect(await f.request()).toMatchObject({ status: "queued", gate: { outcome: "wait", reason: "safety_pending", attempts: 1, retryAt: Date.now() + 5 * 60_000 } });
    const scheduled = await f.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((row) => row.name)).toContain("externalActions:submitChecked");
    await exhausted(); await exhausted();
    expect(await f.request()).toMatchObject({ status: "queued", gate: { attempts: 3 } });
    const result = await f.t.mutation(internal.externalActions.submitChecked, { ownerId: f.ownerId, requestId: f.requestId });
    expect(result).toMatchObject({ status: "awaiting_approval", authorizedByAutonomy: false, reasons: ["Die Prüfung der Nachricht ist mehrfach fehlgeschlagen."] });
    expect(await f.request()).toMatchObject({ status: "awaiting_approval", gate: { outcome: "ask_user", reason: "safety_unavailable", attempts: 3 } });
    expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
  });

  it("binds a provider-confirmed portal receipt to the Scout conversation", async () => {
    const f = await fixture({ initial: true }); await f.authorize(); const claim = await f.claim();
    const earlyReplyId = await f.t.run((ctx) => ctx.db.insert("platformMessages", { ownerId: f.ownerId, connectionId: f.connectionId, threadId: f.threadId, providerMessageId: "reply-before-receipt", direction: "inbound", bodyText: "Yes, still available.", sentAt: Date.now(), createdAt: Date.now() }));
    await f.t.mutation(internal.platformInbox.recordOutboundWrite, { ownerId: f.ownerId, connectionId: f.connectionId, threadId: f.threadId, providerThreadId: "thread-1", providerMessageId: "sent-1", participants: ["Test provider"], bodyText: "Is the room still available?", sentAt: Date.now() });
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "succeeded", providerThreadId: "thread-1", providerMessageId: "sent-1" });
    const [view] = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(view?.replyStatus).toBe("executed");
    expect(view?.platformThreadId).toBe(f.threadId);
    const queued = await f.t.run((ctx) => ctx.db.query("providerTurns").withIndex("by_conversation_and_source", (q) => q.eq("conversationId", f.conversationId).eq("sourceKey", `portal:${earlyReplyId}`)).unique());
    expect(queued?.status).toBe("processing");
    await f.t.mutation(internal.providerConversations.enqueueBoundThreadMessages, { threadId: f.threadId, cursor: null });
    expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))?.revision).toBe(2);
  });

  it("canonical payload hashes survive Convex object-key serialization", async () => {
    expect(await actionPayloadHash({ b: "two", a: "one", optional: undefined })).toBe(await actionPayloadHash({ a: "one", b: "two" }));
    expect(await actionPayloadHash({ a: [1, 2] })).not.toBe(await actionPayloadHash({ a: [2, 1] }));
    const f = await fixture();
    expect(await f.t.run(async (ctx) => (await messageSafetyContext(ctx, (await ctx.db.get(f.requestId))!))?.snapshotHash)).toBe(f.input.snapshotHash);
    expect(MESSAGE_SAFETY_VERSION).toBe("final-message-v5-search-scope");
  });

  it("keeps current-search requirements authoritative over room-specific memory", () => {
    expect(messageSafetyInstructions).toContain("the current search is authoritative");
    expect(messageSafetyInstructions).toContain("supports claims only in that conversation");
    expect(messageSafetyInstructions).toContain("Still list any assertion about the provider, room or musician that the supplied data does not support");
  });
});
