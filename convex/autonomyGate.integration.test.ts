/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { DEFAULT_AUTONOMY_RULES, autonomyHash, type AutonomyRules } from "./lib/autonomy";
import { signalMatchRevision } from "./lib/matchValidity";
import { messageSafetySchema } from "./lib/messageSafety";
import type { ProviderAssessment } from "./lib/providerAssessment";
import * as ai from "./ai";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

const clear = messageSafetySchema.parse({ classification: "non_binding", explanation: "Asks about availability without agreeing to anything.", personalDataScopes: [], proposedMonthlyPriceEur: null, unsupportedClaims: [] });

/**
 * One owner on the controlled portal (roomscout.dev) with an approved contact
 * policy, an active browserbase binding and connection, an active Suchauftrag,
 * a published signal and a provider conversation whose offer suggests a reply.
 * The gate reads only the owner's Handlungsspielraum (`scoutAutonomy`).
 */
async function scenario(rules?: Partial<AutonomyRules>) {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool");
  const f = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "controlled-musician", role: "musician", createdAt: now, lastSeenAt: now });
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
    return { ownerId, needId, platformId, connectionId, threadId, conversationId, offerId, policyId };
  });
  const musician = t.withIdentity({ subject: f.ownerId });
  let autonomy = { version: 0, contentHash: await autonomyHash(DEFAULT_AUTONOMY_RULES) };
  if (rules) autonomy = await musician.mutation(api.autonomy.save, { rules: { ...DEFAULT_AUTONOMY_RULES, ...rules } });
  // stageReply drafts the reply and runs the Freigabeprüfung once (no verdict yet -> queued).
  const requestId = (await t.mutation(internal.providerActions.stageReply, { offerId: f.offerId }))!;
  expect(requestId).toBeTruthy();
  const authorize = async (assessment = clear) => {
    const input = (await t.query(internal.messageSafety.getInput, { requestId }))!;
    return t.mutation(internal.messageSafety.recordAndAuthorize, { requestId, snapshotHash: input.snapshotHash, assessment });
  };
  const request = () => t.run((ctx) => ctx.db.get(requestId));
  const approvals = () => t.run((ctx) => ctx.db.query("actionApprovals").collect());
  const scheduled = () => t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect());
  const prepareClaim = () => t.mutation(internal.externalActions.prepareClaim, { ownerId: f.ownerId, requestId, executor: "browserbase" });
  return { t, musician, ...f, autonomy, requestId, authorize, request, approvals, scheduled, prepareClaim };
}

describe("Freigabeprüfung at submit time", () => {
  it("autopilot + non_binding verdict -> approved, gate proceed, approval pinned to the rule version", async () => {
    const s = await scenario({ mode: "autopilot" });
    expect(s.autonomy.version).toBe(1);
    expect(await s.authorize()).toBe(true);
    expect(await s.request()).toMatchObject({
      status: "approved",
      gate: { outcome: "proceed", autonomyVersion: 1, autonomyHash: s.autonomy.contentHash },
    });
    const [approval] = await s.approvals();
    expect(approval).toMatchObject({ decision: "authorized_by_autonomy", autonomyVersion: 1, autonomyHash: s.autonomy.contentHash, contentVersion: 1 });
    const audit = await s.t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(audit.map((event) => event.eventType)).toContain("action.authorized_by_autonomy");
  });

  it("without a scoutAutonomy row the defaults (version 0) apply", async () => {
    const s = await scenario();
    expect(await s.authorize()).toBe(true);
    expect(await s.request()).toMatchObject({ status: "approved", gate: { outcome: "proceed", autonomyVersion: 0, autonomyHash: s.autonomy.contentHash } });
  });

  it("Rücksprache -> awaiting_approval with reason review_mode and the sentence for the UI", async () => {
    const s = await scenario({ mode: "review" });
    expect(await s.authorize()).toBe(false);
    expect(await s.request()).toMatchObject({ status: "awaiting_approval", gate: { outcome: "ask_user", reason: "review_mode", autonomyVersion: 1 } });
    expect(await s.approvals()).toEqual([]);
    // The submit result carries the user-facing text.
    await s.t.run((ctx) => ctx.db.patch(s.requestId, { status: "drafted" }));
    expect(await s.t.mutation(internal.externalActions.submitChecked, { ownerId: s.ownerId, requestId: s.requestId }))
      .toEqual({ status: "awaiting_approval", authorizedByAutonomy: false, reasons: ["Du prüfst Nachrichten vor dem Versand."] });
  });

  it("binding verdict -> awaiting_approval binding_content in both modes", async () => {
    for (const mode of ["autopilot", "review"] as const) {
      const s = await scenario({ mode });
      expect(await s.authorize({ ...clear, classification: "binding", explanation: "Agrees to rent." })).toBe(false);
      expect(await s.request()).toMatchObject({ status: "awaiting_approval", gate: { outcome: "ask_user", reason: "binding_content", detail: "Agrees to rent." } });
    }
  });

  it("unsafe verdict -> blocked unsafe_content, with the reason as the error", async () => {
    const s = await scenario({ mode: "autopilot" });
    expect(await s.authorize({ ...clear, classification: "unsafe", explanation: "Contains a verification code." })).toBe(false);
    expect(await s.request()).toMatchObject({ status: "blocked", error: "unsafe_content", gate: { outcome: "stop", reason: "unsafe_content", detail: "Contains a verification code." } });
    expect(await s.approvals()).toEqual([]);
    const audit = await s.t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(audit.map((event) => event.eventType)).toContain("action.stopped_by_gate");
  });

  it("detected member_first_names with shareProfile on -> approved", async () => {
    const s = await scenario({ shareProfile: true });
    expect(await s.authorize({ ...clear, personalDataScopes: ["member_first_names", "band_name"] })).toBe(true);
    expect(await s.request()).toMatchObject({ status: "approved", gate: { outcome: "proceed" } });
  });

  it("detected phone with sharePrivate off -> awaiting_approval private_data listing phone", async () => {
    const s = await scenario({ sharePrivate: false });
    expect(await s.authorize({ ...clear, personalDataScopes: ["member_first_names", "phone"] })).toBe(false);
    expect(await s.request()).toMatchObject({ status: "awaiting_approval", gate: { outcome: "ask_user", reason: "private_data", detail: "phone" } });
  });

  it("contact switch off -> blocked action_not_allowed before any verdict is requested", async () => {
    const s = await scenario({ contact: false });
    expect(await s.t.query(internal.messageSafety.getInput, { requestId: s.requestId })).toBeNull();
    expect(await s.request()).toMatchObject({ status: "blocked", error: "action_not_allowed", gate: { outcome: "stop", reason: "action_not_allowed", detail: "send_platform_dm" } });
    expect(await s.approvals()).toEqual([]);
  });

  it("missing verdict -> queued safety_pending with exactly one enqueued assessment", async () => {
    const s = await scenario({ mode: "autopilot" });
    const generate = vi.spyOn(ai, "generateRoomScoutObject").mockResolvedValue(clear);
    expect(await s.request()).toMatchObject({ status: "queued", gate: { outcome: "wait", reason: "safety_pending" } });
    await s.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(generate).toHaveBeenCalledOnce();
    expect(await s.request()).toMatchObject({ status: "approved", gate: { outcome: "proceed" } });
    expect(await s.approvals()).toHaveLength(1);
  });

  it("exhausted verdict generation -> wait with retry, and after three waits an Entscheidung (safety_unavailable)", async () => {
    const s = await scenario({ mode: "autopilot" });
    const exhausted = () => s.t.mutation(internal.messageSafety.assessmentCompleted, { workId: "test" as never, context: { requestId: s.requestId, contentVersion: 1 }, result: { kind: "failed", error: "provider unavailable" } });
    await exhausted();
    expect(await s.request()).toMatchObject({ status: "queued", gate: { outcome: "wait", reason: "safety_pending", attempts: 1, retryAt: Date.now() + 5 * 60_000 } });
    expect((await s.scheduled()).map((row) => row.name)).toContain("externalActions:submitChecked");
    await exhausted(); await exhausted();
    const result = await s.t.mutation(internal.externalActions.submitChecked, { ownerId: s.ownerId, requestId: s.requestId });
    expect(result).toMatchObject({ status: "awaiting_approval", reasons: ["Die Prüfung der Nachricht ist mehrfach fehlgeschlagen."] });
    expect(await s.request()).toMatchObject({ status: "awaiting_approval", gate: { outcome: "ask_user", reason: "safety_unavailable", attempts: 3 } });
    expect(await s.t.run((ctx) => ctx.db.query("notifications").collect())).toEqual([]);
  });
});

describe("Freigabeprüfung at claim time", () => {
  it("busy browser -> wait browser_busy, the approval stands and a re-dispatch is scheduled", async () => {
    const s = await scenario({ mode: "autopilot" });
    expect(await s.authorize()).toBe(true);
    await s.t.run((ctx) => ctx.db.patch(s.connectionId, { inboxSyncActiveGeneration: 1, inboxSyncDeadlineAt: Date.now() + 60_000 }));
    expect(await s.prepareClaim()).toEqual({ outcome: "wait", reason: "browser_busy", retryAt: Date.now() + 2 * 60_000 });
    expect(await s.request()).toMatchObject({ status: "approved", gate: { outcome: "wait", reason: "browser_busy", retryAt: Date.now() + 2 * 60_000 } });
    const scheduled = await s.scheduled();
    expect(scheduled.map((row) => row.name)).toContain("externalActions:redispatchApproved");
    expect(await s.t.run((ctx) => ctx.db.query("notifications").collect())).toEqual([]);
    await expect(s.t.mutation(internal.externalActions.claimForExecutor, { ownerId: s.ownerId, requestId: s.requestId, executor: "browserbase" })).rejects.toThrow("GATE_NOT_PASSED");
  });

  it("free browser -> proceed, and the transactional claim follows", async () => {
    const s = await scenario({ mode: "autopilot" });
    expect(await s.authorize()).toBe(true);
    expect(await s.prepareClaim()).toEqual({ outcome: "proceed" });
    expect(await s.approvals()).toHaveLength(1);
    const claim = await s.t.mutation(internal.externalActions.claimForExecutor, { ownerId: s.ownerId, requestId: s.requestId, executor: "browserbase" });
    expect(claim.alreadyClaimed).toBe(false);
  });

  it("a human approval after a claim-phase Entscheidung replaces the Scout's approval row", async () => {
    const s = await scenario({ mode: "autopilot", shareProfile: true });
    expect(await s.authorize({ ...clear, personalDataScopes: ["band_name"] })).toBe(true);
    await s.musician.mutation(api.autonomy.save, { rules: { ...DEFAULT_AUTONOMY_RULES, shareProfile: false } });
    expect(await s.prepareClaim()).toEqual({ outcome: "ask_user", reason: "private_data", detail: "band_name" });
    const request = (await s.request())!;
    expect(request).toMatchObject({ status: "awaiting_approval", gate: { reason: "private_data", autonomyVersion: 2 } });
    await s.musician.mutation(api.externalActions.decide, { requestId: s.requestId, decision: "approved", expectedContentVersion: request.contentVersion, expectedContentHash: request.contentHash, expectedPayload: request.payload });
    const approvals = await s.approvals();
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({ decision: "approved", autonomyVersion: 2 });
    expect(await s.prepareClaim()).toEqual({ outcome: "proceed" });
  });
});
