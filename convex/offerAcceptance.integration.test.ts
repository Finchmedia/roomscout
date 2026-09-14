/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { signalMatchRevision } from "./lib/matchValidity";
import type { ProviderAssessment } from "./lib/providerAssessment";
import * as ai from "./ai";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool");
  const f = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "accepting-musician", role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "other-musician", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Stuttgart", districts: [], arrangement: ["shared"], schedule: ["Tuesday evenings"], requirements: ["Drums allowed"], maxBudgetEur: 250, matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "controlled", name: "Controlled portal", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: "controlled", name: "Controlled listings", baseUrl: "https://roomscout.dev/listings", side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now });
    const connectedSourceId = await ctx.db.insert("sources", { platformId, slug: "controlled-connected", name: "Controlled connected messaging", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const targetId = await ctx.db.insert("sourceTargets", { sourceId, url: "https://roomscout.dev/listings", mode: "scrape", changeTrackingTag: "test", scheduleMinutes: 1440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now });
    const entryId = await ctx.db.insert("sourceEntries", { sourceId, sourceTargetId: targetId, externalId: "room-1", canonicalUrl: "https://roomscout.dev/listings/room-1", detailUrl: "https://roomscout.dev/listings/room-1", title: "Test listing", excerpt: "Controlled listing", side: "supply", city: "Stuttgart", status: "active", detailState: "processed", detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { sourceEntryId: entryId, side: "supply", title: "Controlled room", city: "Stuttgart", summary: "Shared room with drums", arrangement: "shared", requirements: ["Drums allowed"], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    const signalRevision = await signalMatchRevision((await ctx.db.get(signalId))!);
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, sourceId: connectedSourceId, scopeKey: "controlled:contact", flow: "contact", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: true, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://roomscout.dev/terms"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, sourceId: connectedSourceId, scopeKey: "controlled:contact", flow: "contact", adapterKey: "roomscout-dev-v1", adapterVersion: 1, status: "active", executor: "browserbase", config: { kind: "browserbase", workflowKey: "roomscout-dev.platform-message.v1", contextRequired: true }, configFingerprint: "test", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId: connectedSourceId, platformId, label: "Test connection", allowedDomains: ["roomscout.dev"], allowedPaths: ["/listings", "/inbox"], adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    const threadId = await ctx.db.insert("platformThreads", { connectionId, ownerId, providerThreadId: "thread-1", participants: ["Test provider"], lastMessageAt: now, status: "open", createdAt: now, updatedAt: now });
    const conversationId = await ctx.db.insert("providerConversations", { ownerId, savedNeedId: needId, signalId, conversationKey: "controlled", agentThreadId: "test-agent-thread", platformThreadId: threadId, revision: 1, state: "offer_ready", createdAt: now, updatedAt: now });
    const eventId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "portal:provider-offer", kind: "portal_reply", revision: 1, status: "completed", completedAt: now, createdAt: now });
    const providerEvidence = [{ sourceId: "portal:provider-offer", quote: "Available Tuesday evenings for EUR 220 total monthly, drums are allowed." }];
    const assessment: ProviderAssessment = {
      summary: "Provider confirmed a suitable room.",
      availability: { status: "available", evidence: providerEvidence },
      monthlyPrice: { totalEur: 220, allRecurringCostsKnown: true, evidence: providerEvidence },
      terms: [{ key: "recurring-cost", label: "Recurring cost", value: "EUR 220 total monthly", evidence: providerEvidence }],
      constraints: [
        { key: "requirement:0", verdict: "satisfied", explanation: "Drums are allowed.", evidence: providerEvidence },
        { key: "schedule", verdict: "satisfied", explanation: "Tuesday evenings are available.", evidence: providerEvidence },
        { key: "budget", verdict: "satisfied", explanation: "EUR 220 is within the EUR 250 budget.", evidence: providerEvidence },
      ],
      uncertainties: [], contradictions: [], nextAction: "present_offer", suggestedReply: null,
    };
    const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId, revision: 1, needRevision: 1, signalRevision, assessment, ready: true, blockers: [], contentHash: "offer-v1", model: ai.ROOMSCOUT_MODEL_ID, promptVersion: "test", schemaVersion: "test", createdAt: now });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });
    return { ownerId, otherId, needId, platformId, connectionId, threadId, conversationId, eventId, offerId, signalId, bindingId, policyId, assessment, signalRevision };
  });
  const musician = t.withIdentity({ subject: f.ownerId });
  const prepare = () => musician.mutation(api.offerAcceptance.prepare, { offerId: f.offerId, expectedOfferHash: "offer-v1" });
  const review = async (requestId: Awaited<ReturnType<typeof prepare>>) => (await musician.query(api.offerAcceptance.getMine, { requestId }))!;
  const approve = async (requestId: Awaited<ReturnType<typeof prepare>>) => {
    const view = await review(requestId);
    return musician.mutation(api.offerAcceptance.approveAndSend, { requestId, offerId: f.offerId, expectedOfferHash: view.offerHash, expectedContentVersion: view.contentVersion, expectedContentHash: view.contentHash, expectedContextHash: view.reviewContextHash, acknowledged: true });
  };
  const claim = (requestId: Awaited<ReturnType<typeof prepare>>) => t.mutation(internal.externalActions.claimForExecutor, { ownerId: f.ownerId, requestId, executor: "browserbase" });
  return { t, musician, ...f, prepare, review, approve, claim };
}

describe("exact offer acceptance", () => {
  it("prepares only an owner-scoped exact draft", async () => {
    const f = await fixture(); const requestId = await f.prepare();
    const request = await f.t.run((ctx) => ctx.db.get(requestId));
    expect(request).toMatchObject({ ownerId: f.ownerId, providerOfferId: f.offerId, providerActionKind: "acceptance", automationMode: "exact_once", status: "awaiting_approval" });
    expect(request?.payload).toMatchObject({ kind: "platform_message", threadId: f.threadId, recipients: ["Test provider"] });
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toEqual([]);
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
    expect(await f.t.withIdentity({ subject: f.otherId }).query(api.offerAcceptance.getMine, { requestId })).toBeNull();
    await expect(f.t.withIdentity({ subject: f.otherId }).mutation(api.offerAcceptance.prepare, { offerId: f.offerId, expectedOfferHash: "offer-v1" })).rejects.toThrow("OFFER_NOT_FOUND");
  });

  it("rejects mismatched offer, content, and context snapshots", async () => {
    const f = await fixture();
    await expect(f.musician.mutation(api.offerAcceptance.prepare, { offerId: f.offerId, expectedOfferHash: "wrong" })).rejects.toThrow("OFFER_CHANGED");
    const requestId = await f.prepare(); const view = await f.review(requestId);
    for (const changed of [
      { expectedOfferHash: "wrong" }, { expectedContentVersion: view.contentVersion + 1 },
      { expectedContentHash: "wrong" }, { expectedContextHash: "wrong" },
    ]) {
      await expect(f.musician.mutation(api.offerAcceptance.approveAndSend, { requestId, offerId: f.offerId, expectedOfferHash: view.offerHash, expectedContentVersion: view.contentVersion, expectedContentHash: view.contentHash, expectedContextHash: view.reviewContextHash, acknowledged: true, ...changed })).rejects.toThrow("ACCEPTANCE_CONTENT_CHANGED");
    }
  });

  it.each(["participants", "providerThreadId"] as const)("invalidates review when the destination %s changes", async (change) => {
    const f = await fixture(); const requestId = await f.prepare();
    await f.t.run((ctx) => ctx.db.patch(f.threadId, change === "participants" ? { participants: ["Different provider"] } : { providerThreadId: "different-thread" }));
    await expect(f.approve(requestId)).rejects.toThrow("ACCEPTANCE_DESTINATION_CHANGED");
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toEqual([]);
  });

  it.each(["participants", "providerThreadId"] as const)("invalidates execution when approved destination %s changes", async (change) => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId);
    await f.t.run((ctx) => ctx.db.patch(f.threadId, change === "participants" ? { participants: ["Different provider"] } : { providerThreadId: "different-thread" }));
    await expect(f.claim(requestId)).rejects.toThrow("ACCEPTANCE_DESTINATION_CHANGED");
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
  });

  it.each(["expired", "memory", "rejected", "cancelled"] as const)("refreshes a safely reviewable %s request in place", async (reason) => {
    const f = await fixture(); const requestId = await f.prepare(); const oldView = await f.review(requestId);
    if (reason === "expired") vi.advanceTimersByTime(30 * 60_000 + 1);
    await f.t.run(async (ctx) => {
      if (reason === "memory") await ctx.db.insert("memoryProfiles", { ownerId: f.ownerId, summary: "Remember that Tuesdays are preferred.", factVersion: 1, contextVersion: 1, openQuestions: [], hardConstraints: [], softPreferences: [], createdAt: Date.now(), updatedAt: Date.now() });
      if (reason === "rejected") await ctx.db.patch(requestId, { status: "rejected" });
      if (reason === "cancelled") await ctx.db.patch(requestId, { status: "cancelled" });
    });
    expect(await f.prepare()).toBe(requestId);
    const refreshed = await f.review(requestId);
    expect(refreshed).toMatchObject({ status: "awaiting_approval", contentVersion: oldView.contentVersion + 1, current: true });
    if (reason === "memory") expect(refreshed.reviewContextHash).not.toBe(oldView.reviewContextHash);
    await expect(f.musician.mutation(api.offerAcceptance.approveAndSend, { requestId, offerId: f.offerId, expectedOfferHash: oldView.offerHash, expectedContentVersion: oldView.contentVersion, expectedContentHash: oldView.contentHash, expectedContextHash: oldView.reviewContextHash, acknowledged: true })).rejects.toThrow("ACCEPTANCE_CONTENT_CHANGED");
  });

  it("never resets an executing request whose provider outcome is unknown", async () => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "unknown", error: "receipt uncertain" });
    const before = await f.review(requestId);
    expect(await f.prepare()).toBe(requestId);
    expect(await f.review(requestId)).toMatchObject({ status: "executing", contentVersion: before.contentVersion });
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toHaveLength(1);
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toHaveLength(1);
  });

  it("reconciles an already stored outbound acceptance with provider-collapsed whitespace during inbox sync", async () => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    const request = (await f.t.run((ctx) => ctx.db.get(requestId)))!;
    if (request.payload.kind !== "platform_message") throw new Error("Expected platform message");
    const approvedBody = request.payload.body;
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "unknown", error: "SUBMIT_RESULT_UNKNOWN" });
    await f.t.run((ctx) => ctx.db.insert("platformMessages", { connectionId: f.connectionId, ownerId: f.ownerId, threadId: f.threadId,
      providerMessageId: "observed-acceptance", direction: "outbound", bodyText: approvedBody.replace(" ", "  \n"), sentAt: Date.now(), createdAt: Date.now() }));
    await f.t.mutation(internal.platformInbox.upsertReadOnlyBatch, { ownerId: f.ownerId, connectionId: f.connectionId, threads: [{
      providerThreadId: "thread-1", participants: ["Test provider"], lastMessageAt: Date.now(), messages: [],
    }] });
    expect(await f.t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "executed" });
    expect(await f.t.run((ctx) => ctx.db.get(f.conversationId))).toMatchObject({ acceptedOfferId: f.offerId, state: "closed" });
    expect(await f.t.mutation(internal.externalActions.reconcileObservedPortalAcceptance, { ownerId: f.ownerId, connectionId: f.connectionId, threadId: f.threadId })).toBe(false);
    expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(1);
  });

  it("does not reconcile a different outbound body", async () => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    const request = (await f.t.run((ctx) => ctx.db.get(requestId)))!;
    if (request.payload.kind !== "platform_message") throw new Error("Expected platform message");
    const approvedBody = request.payload.body;
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "unknown", error: "SUBMIT_RESULT_UNKNOWN" });
    await f.t.run((ctx) => ctx.db.insert("platformMessages", { connectionId: f.connectionId, ownerId: f.ownerId, threadId: f.threadId,
      providerMessageId: "unrelated-outbound", direction: "outbound", bodyText: approvedBody.replace("220", "221"), sentAt: Date.now(), createdAt: Date.now() }));
    expect(await f.t.mutation(internal.externalActions.reconcileObservedPortalAcceptance, { ownerId: f.ownerId, connectionId: f.connectionId, threadId: f.threadId })).toBe(false);
    expect(await f.t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "executing" });
    expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))?.acceptedAt).toBeUndefined();
  });

  it.each(["running", "unknown"] as const)("does not refresh a cancelled request with ambiguous %s execution history", async (history) => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    if (history === "running") {
      await f.t.mutation(internal.externalActions.attachProviderExecution, { ownerId: f.ownerId, executionId: claim.executionId });
    }
    if (history === "unknown") {
      await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "unknown", error: "receipt uncertain" });
    }
    await f.t.run(async (ctx) => {
      await ctx.db.patch(requestId, { status: "cancelled" });
    });
    const before = (await f.t.run((ctx) => ctx.db.get(requestId)))!;
    expect(await f.prepare()).toBe(requestId);
    expect(await f.t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "cancelled", contentVersion: before.contentVersion, executionIdempotencyKey: before.executionIdempotencyKey });
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toHaveLength(1);
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toHaveLength(1);
  });

  it("refreshes a cancelled request whose only execution failed before any submission", async () => {
    // The Firecrawl write attaches the provider session id at open and reports "unknown" whenever a
    // submission may have happened, so a failed execution never sent anything and is safe to redo.
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    await f.t.run(async (ctx) => {
      await ctx.db.patch(claim.executionId, { status: "failed", providerActionId: "provider-session-started", completedAt: Date.now(), error: "FIRECRAWL_PORTAL_WRITE_FAILED:FIRECRAWL_PORTAL_EVIDENCE_INVALID" });
      await ctx.db.patch(requestId, { status: "cancelled" });
    });
    expect(await f.prepare()).toBe(requestId);
    expect(await f.t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "awaiting_approval", contentVersion: 2 });
  });

  it.each(["need", "signal", "conversation", "memory"] as const)("rejects stale %s after review", async (change) => {
    const f = await fixture(); const requestId = await f.prepare();
    await f.t.run(async (ctx) => {
      if (change === "need") await ctx.db.patch(f.needId, { matchingRevision: 2 });
      if (change === "signal") await ctx.db.patch(f.signalId, { summary: "The listing changed." });
      if (change === "conversation") await ctx.db.patch(f.conversationId, { revision: 2 });
      if (change === "memory") await ctx.db.insert("memoryProfiles", { ownerId: f.ownerId, summary: "We can no longer rehearse on Tuesdays.", factVersion: 1, contextVersion: 1, openQuestions: [], hardConstraints: [], softPreferences: [], createdAt: Date.now(), updatedAt: Date.now() });
    });
    await expect(f.approve(requestId)).rejects.toThrow();
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toEqual([]);
  });

  it("does not allow the generic decision endpoint or the Autopilot to authorize acceptance", async () => {
    const f = await fixture(); const requestId = await f.prepare(); const view = await f.review(requestId);
    await expect(f.musician.mutation(api.externalActions.decide, { requestId, decision: "approved", expectedContentVersion: view.contentVersion, expectedContentHash: view.contentHash, expectedPayload: (await f.t.run((ctx) => ctx.db.get(requestId)))!.payload })).rejects.toThrow();
    await expect(f.musician.mutation(api.externalActions.submit, { requestId })).rejects.toThrow();
    expect((await f.t.run((ctx) => ctx.db.get(requestId)))?.status).toBe("awaiting_approval");
  });

  it("repeated exact approval creates one approval and one execution claim", async () => {
    const f = await fixture(); const requestId = await f.prepare();
    expect(await f.approve(requestId)).toMatchObject({ requestId, status: "approved" });
    expect(await f.approve(requestId)).toMatchObject({ requestId, status: "approved" });
    expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toHaveLength(1);
    const first = await f.claim(requestId); const repeated = await f.claim(requestId);
    expect(repeated.executionId).toBe(first.executionId);
    expect(repeated.alreadyClaimed).toBe(true);
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toHaveLength(1);
  });

  it("disallows two simultaneous acceptances for the same need", async () => {
    const f = await fixture(); const firstRequestId = await f.prepare();
    const second = await f.t.run(async (ctx) => {
      const now = Date.now();
      const conversationId = await ctx.db.insert("providerConversations", { ownerId: f.ownerId, savedNeedId: f.needId, signalId: f.signalId, conversationKey: "controlled-2", agentThreadId: "test-agent-thread-2", platformThreadId: f.threadId, revision: 1, state: "offer_ready", createdAt: now, updatedAt: now });
      const eventId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "portal:provider-offer-2", kind: "portal_reply", revision: 1, status: "completed", completedAt: now, createdAt: now });
      const offerId = await ctx.db.insert("offerRevisions", { ownerId: f.ownerId, savedNeedId: f.needId, conversationId, eventId, revision: 1, needRevision: 1, signalRevision: f.signalRevision, assessment: f.assessment, ready: true, blockers: [], contentHash: "offer-v2", model: ai.ROOMSCOUT_MODEL_ID, promptVersion: "test", schemaVersion: "test", createdAt: now });
      await ctx.db.patch(conversationId, { currentOfferId: offerId });
      return offerId;
    });
    const secondRequestId = await f.musician.mutation(api.offerAcceptance.prepare, { offerId: second, expectedOfferHash: "offer-v2" });
    await f.approve(firstRequestId);
    const secondView = (await f.musician.query(api.offerAcceptance.getMine, { requestId: secondRequestId }))!;
    await expect(f.musician.mutation(api.offerAcceptance.approveAndSend, { requestId: secondRequestId, offerId: second, expectedOfferHash: secondView.offerHash, expectedContentVersion: secondView.contentVersion, expectedContentHash: secondView.contentHash, expectedContextHash: secondView.reviewContextHash, acknowledged: true })).rejects.toThrow("ANOTHER_ACCEPTANCE_IN_PROGRESS");
  });

  it.each(["need", "signal", "conversation", "memory", "policy", "expiry"] as const)("rechecks stale %s after approval before execution", async (change) => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId);
    await f.t.run(async (ctx) => {
      if (change === "need") await ctx.db.patch(f.needId, { matchingRevision: 2 });
      if (change === "signal") await ctx.db.patch(f.signalId, { summary: "The listing changed." });
      if (change === "conversation") await ctx.db.patch(f.conversationId, { revision: 2 });
      if (change === "memory") await ctx.db.insert("memoryProfiles", { ownerId: f.ownerId, summary: "New constraint.", factVersion: 1, contextVersion: 1, openQuestions: [], hardConstraints: [], softPreferences: [], createdAt: Date.now(), updatedAt: Date.now() });
      if (change === "policy") await ctx.db.patch(f.policyId, { status: "superseded" });
      if (change === "expiry") await ctx.db.patch(requestId, { expiresAt: Date.now() });
    });
    await expect(f.claim(requestId)).rejects.toThrow();
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
  });

  it.each(["failed", "unknown"] as const)("never marks the offer accepted for a %s outcome", async (status) => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status, error: "provider did not confirm" });
    expect(await f.t.run((ctx) => ctx.db.get(f.conversationId))).toMatchObject({ state: "offer_ready" });
    expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))?.acceptedOfferId).toBeUndefined();
    expect((await f.t.run((ctx) => ctx.db.get(f.needId)))?.status).toBe("active");
  });

  it("rejects a claimed success without an exact outbound provider receipt", async () => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    await expect(f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "succeeded", providerThreadId: "thread-1", providerMessageId: "missing" })).rejects.toThrow("ACCEPTANCE_RECEIPT_REQUIRED");
    expect((await f.t.run((ctx) => ctx.db.get(f.conversationId)))?.acceptedOfferId).toBeUndefined();
    expect((await f.t.run((ctx) => ctx.db.get(f.needId)))?.status).toBe("active");
  });

  it("marks acceptance only after a positive provider receipt and deduplicates repeated receipts", async () => {
    const f = await fixture(); const requestId = await f.prepare(); await f.approve(requestId); const claim = await f.claim(requestId);
    const request = (await f.t.run((ctx) => ctx.db.get(requestId)))!;
    if (request.payload.kind !== "platform_message") throw new Error("bad fixture");
    await f.t.mutation(internal.platformInbox.recordOutboundWrite, { ownerId: f.ownerId, connectionId: f.connectionId, threadId: f.threadId, providerThreadId: "thread-1", providerMessageId: "acceptance-1", participants: ["Test provider"], subject: request.payload.subject, bodyText: request.payload.body, sentAt: Date.now() });
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "succeeded", providerThreadId: "thread-1", providerMessageId: "acceptance-1" });
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "succeeded", providerThreadId: "thread-1", providerMessageId: "acceptance-1" });
    expect(await f.t.run((ctx) => ctx.db.get(f.conversationId))).toMatchObject({ acceptedOfferId: f.offerId, state: "closed" });
    expect((await f.t.run((ctx) => ctx.db.get(f.needId)))?.status).not.toBe("active");
    const finished = (await f.t.run((ctx) => ctx.db.query("auditEvents").collect())).filter((event) => event.entityKey === `action:${requestId}` && event.eventType === "action.execution_succeeded");
    expect(finished).toHaveLength(1);
    expect((await f.t.run((ctx) => ctx.db.query("actionExecutions").collect()))).toHaveLength(1);
  });
});
