/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { actionPayloadHash } from "./integrations/contentHash";
import { signalMatchRevision } from "./lib/matchValidity";
import { MESSAGE_SAFETY_VERSION, messageSafetyContext, messageSafetySchema } from "./lib/messageSafety";
import type { ProviderAssessment } from "./lib/providerAssessment";
import * as ai from "./ai";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
const clear = messageSafetySchema.parse({ classification: "non_binding", explanation: "Asks about availability without agreeing to anything.", personalDataScopes: [], proposedMonthlyPriceEur: null, unsupportedClaims: [] });

async function fixture(options?: { initial?: boolean }) {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool");
  const f = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "controlled-musician", role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "other-musician", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Stuttgart", districts: [], arrangement: ["shared"], schedule: [], requirements: [], maxBudgetEur: 250, matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
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
    const mandateId = await ctx.db.insert("searchMandates", { ownerId, savedNeedId: needId, version: 1, mode: "negotiation_autopilot", status: "active", platformIds: [platformId], allowedActionTypes: ["send_platform_dm"], allowedPersonalData: ["availability"], maxContactsPerDay: 1, maxBrowserMinutesPerDay: 30, maxMonthlyPriceEur: 250, expiresAt: now + 86_400_000, stopOnComplaint: true, stopWhenSuitableRoomConfirmed: true, commitmentBoundary: "non_binding_outreach_only", contentHash: "mandate-v1", createdAt: now, updatedAt: now });
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
    const assessment: ProviderAssessment = { summary: "Ask whether the room is still free", availability: { status: "unknown", evidence: [] }, monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] }, terms: [], constraints: [], uncertainties: ["Availability"], contradictions: [], nextAction: "ask_provider", suggestedReply: { subject: "Room availability", body: "Is the room still available?" } };
    const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId, revision: 1, needRevision: 1, signalRevision, assessment, ready: false, blockers: ["Availability unknown"], contentHash: "offer-v1", model: ai.ROOMSCOUT_MODEL_ID, promptVersion: "test", schemaVersion: "test", createdAt: now });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });
    return { ownerId, otherId, needId, platformId, connectionId, threadId, mandateId, conversationId, offerId, signalId, bindingId, policyId };
  });
  const requestId = (await t.mutation(internal.providerActions.stageReply, { offerId: f.offerId }))!;
  expect(requestId).toBeTruthy();
  const input = (await t.query(internal.messageSafety.getInput, { requestId }))!;
  const authorize = (assessment = clear) => t.mutation(internal.messageSafety.recordAndAuthorize, { requestId, snapshotHash: input.snapshotHash, assessment });
  const claim = () => t.mutation(internal.externalActions.claimForExecutor, { ownerId: f.ownerId, requestId, executor: "browserbase" });
  return { t, ...f, requestId, input, authorize, claim };
}

describe("semantic final-message gate and provider dispatch", () => {
  it("starts a conversation using the listing URL and the separate authenticated-source connection", async () => {
    const f = await fixture({ initial: true });
    await f.authorize();
    const claimed = await f.claim();
    expect(claimed.payload).toMatchObject({ targetPath: "/listings/room-1", recipients: ["Listing owner"] });
    expect(claimed.payload).not.toHaveProperty("threadId");
    expect(claimed.connectionId).toBe(f.connectionId);
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

  it.each(["binding", "unsafe", "uncertain"] as const)("does not authorize a %s semantic verdict", async (classification) => {
    const f = await fixture();
    expect(await f.authorize({ ...clear, classification })).toBe(false);
    expect((await f.t.run((ctx) => ctx.db.get(f.requestId)))?.status).toBe("awaiting_approval");
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toEqual([]);
  });

  it("reports the persisted approval decision on repeated submission, not just the selected mode", async () => {
    const f = await fixture();
    const musician = f.t.withIdentity({ subject: f.ownerId });
    expect((await musician.mutation(api.externalActions.submit, { requestId: f.requestId })).authorizedByMandate).toBe(false);
    await f.authorize({ ...clear, classification: "uncertain" });
    const request = (await f.t.run((ctx) => ctx.db.get(f.requestId)))!;
    await musician.mutation(api.externalActions.decide, { requestId: f.requestId, decision: "approved", expectedContentVersion: request.contentVersion, expectedContentHash: request.contentHash, expectedPayload: request.payload });
    expect(await musician.mutation(api.externalActions.submit, { requestId: f.requestId })).toMatchObject({ status: "approved", authorizedByMandate: false });

    const automatic = await fixture();
    await automatic.authorize();
    expect((await automatic.t.withIdentity({ subject: automatic.ownerId }).mutation(api.externalActions.submit, { requestId: automatic.requestId })).authorizedByMandate).toBe(true);
  });

  it("uses detected disclosures, price and unsupported claims, not the model author's empty declaration", async () => {
    for (const assessment of [
      { ...clear, personalDataScopes: ["phone" as const] },
      { ...clear, proposedMonthlyPriceEur: 400 },
      { ...clear, unsupportedClaims: ["Invented rehearsal availability"] },
    ]) {
      const f = await fixture();
      expect(await f.authorize(assessment)).toBe(false);
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

  it.each(["search", "provider", "mandate", "content", "memory"])("rechecks changed %s after authorization, before a provider click", async (change) => {
    const f = await fixture(); await f.authorize();
    await f.t.run(async (ctx) => {
      if (change === "search") await ctx.db.patch(f.needId, { matchingRevision: 2 });
      if (change === "provider") await ctx.db.patch(f.conversationId, { revision: 2 });
      if (change === "mandate") await ctx.db.patch(f.mandateId, { status: "revoked" });
      if (change === "content") {
        const request = (await ctx.db.get(f.requestId))!;
        if (request.payload.kind !== "platform_message") throw new Error("bad fixture");
        await ctx.db.patch(f.requestId, { payload: { ...request.payload, body: "Then the place is ours starting next month." } });
      }
      if (change === "memory") await ctx.db.insert("memoryProfiles", { ownerId: f.ownerId, summary: "We can no longer rehearse on Mondays.", factVersion: 1, contextVersion: 1, openQuestions: [], hardConstraints: [], softPreferences: [], createdAt: Date.now(), updatedAt: Date.now() });
    });
    await expect(f.claim()).rejects.toThrow();
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

  it("holds the message on exhausted AI retries instead of using a regex fallback", async () => {
    const f = await fixture();
    await f.t.mutation(internal.messageSafety.assessmentCompleted, { workId: "test" as never, context: { requestId: f.requestId, contentVersion: 1 }, result: { kind: "failed", error: "provider unavailable" } });
    const row = await f.t.run((ctx) => ctx.db.get(f.requestId));
    expect(row).toMatchObject({ status: "awaiting_approval", error: "FINAL_MESSAGE_CHECK_UNAVAILABLE" });
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
    expect(MESSAGE_SAFETY_VERSION).toBe("final-message-v1");
  });
});
