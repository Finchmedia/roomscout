/// <reference types="vite/client" />
import agentmailTest from "@agentmail/convex/test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { signalMatchRevision } from "./lib/matchValidity";
import { messageSafetySchema } from "./lib/messageSafety";
import type { ProviderAssessment } from "./lib/providerAssessment";

const modules = import.meta.glob("./**/*.ts");
const agentmailModules = import.meta.glob("../node_modules/@agentmail/convex/src/component/**/*.{ts,js}");
const cleared = messageSafetySchema.parse({ classification: "non_binding", explanation: "A non-binding availability question.", personalDataScopes: ["reply_email"], proposedMonthlyPriceEur: null, unsupportedClaims: [] });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("AGENTMAIL_API_KEY", "agentmail-test-key");
  // This suite proves the reviewed real-email workflow, not demo mode.
  vi.stubEnv("SCOUT_CONTROLLED_PORTAL_ONLY", "false");
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function fixture(options: { decline?: boolean } = {}) {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  rateLimiterTest.register(t);
  t.registerComponent("agentmail", agentmailTest.schema, agentmailModules);
  workpoolTest.register(t, "agentmail/sendPool");
  workpoolTest.register(t, "agentmail/callbackPool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "mail-owner", firstName: "Mina", actKind: "band", actName: "Night Owls", providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "other", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Hamburg", districts: [], arrangement: ["shared"], schedule: [], requirements: [], matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "mail-source", name: "Mail source", canonicalDomain: "example.com", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: "mail-source", name: "Mail source", baseUrl: "https://example.com", side: "supply", status: "active", health: "healthy", createdAt: now, updatedAt: now });
    const targetId = await ctx.db.insert("sourceTargets", { sourceId, url: "https://example.com/rooms", mode: "scrape", changeTrackingTag: "mail", scheduleMinutes: 1440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now });
    const entryId = await ctx.db.insert("sourceEntries", { sourceId, sourceTargetId: targetId, externalId: "room", canonicalUrl: "https://example.com/rooms/1", detailUrl: "https://example.com/rooms/1", title: "Room", excerpt: "Room", side: "supply", city: "Hamburg", status: "active", detailState: "processed", detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { sourceEntryId: entryId, side: "supply", title: "Room", city: "Hamburg", summary: "Shared room", arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    const signalRevision = await signalMatchRevision((await ctx.db.get(signalId))!);
    const policyId = await ctx.db.insert("sourceFlowPolicies", { platformId, sourceId, scopeKey: "mail:reply", flow: "reply", version: 1, status: "approved", decision: "allowed", maxAutomationLevel: "approved_execute", userConnectionRequired: false, humanPresenceRequired: false, accountCreationAllowed: false, externalApprovalRequired: true, robotsDecision: "allowed", termsDecision: "allowed", evidenceUrls: ["https://example.com/terms"], createdAt: now, updatedAt: now });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", { platformId, sourceId, scopeKey: "mail:reply", flow: "reply", adapterKey: "agentmail-reply", adapterVersion: 1, status: "active", executor: "agentmail", config: { kind: "agentmail", purpose: "reply" }, configFingerprint: "mail-v1", policyVersionId: policyId, createdAt: now, updatedAt: now });
    const mailboxId = await ctx.db.insert("userMailboxes", { ownerId, provider: "agentmail", providerInboxId: "inbox-1", emailAddress: "scout@agentmail.to", clientId: "mail-owner", status: "active", createdAt: now, updatedAt: now });
    const draftId = await ctx.db.insert("outreachDrafts", { ownerId, signalId, savedNeedId: needId, recipientName: "Provider", recipientEmail: "provider@example.com", subject: "Room", body: "Initial note", contentVersion: 1, contentHash: "initial", status: "replied", createdAt: now, updatedAt: now });
    const threadId = await ctx.db.insert("mailThreads", { ownerId, draftId, providerThreadId: "thread-1", subject: "Room", status: "replied", lastMessageAt: now, createdAt: now, mailboxId });
    await ctx.db.insert("mailMessages", { threadId, providerMessageId: "parent-1", direction: "inbound", from: "provider@example.com", to: ["scout@agentmail.to"], subject: "Re: Room", body: "Is Tuesday suitable?", deliveryStatus: "received", receivedAt: now });
    const conversationId = await ctx.db.insert("providerConversations", { ownerId, savedNeedId: needId, signalId, conversationKey: "mail-thread", agentThreadId: "agent-thread", mailThreadId: threadId, revision: 1, state: "needs_attention", createdAt: now, updatedAt: now });
    const eventId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "mail:parent-1", kind: "mail_reply", revision: 1, status: "completed", createdAt: now });
    const assessment: ProviderAssessment = options.decline
      ? { summary: "The provider cannot meet the required schedule.", availability: { status: "unknown", evidence: [] }, monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] }, terms: [], constraints: [], uncertainties: [], contradictions: [], nextAction: "decline", suggestedReply: { subject: "Re: Room", body: "Thanks, but the schedule does not fit." } }
      : { summary: "Ask about Tuesday", availability: { status: "unknown", evidence: [] }, monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] }, terms: [], constraints: [], uncertainties: ["Tuesday"], contradictions: [], nextAction: "ask_provider", suggestedReply: { subject: "Re: Room", body: "Would Tuesday evening work?" } };
    const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId, revision: 1, needRevision: 1, signalRevision, assessment, ready: false, blockers: ["Schedule unknown"], contentHash: "offer-v1", model: "test", promptVersion: "test", schemaVersion: "test", createdAt: now });
    await ctx.db.patch(conversationId, { currentOfferId: offerId });
    return { ownerId, otherId, needId, policyId, bindingId, mailboxId, threadId, conversationId, offerId };
  });
  const requestId = (await t.mutation(internal.providerActions.stageReply, { offerId: ids.offerId }))!;
  expect(requestId).toBeTruthy();
  expect(await t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "queued" });
  const input = (await t.query(internal.messageSafety.getInput, { requestId }))!;
  expect(await t.mutation(internal.messageSafety.recordAndAuthorize, { requestId, snapshotHash: input.snapshotHash, assessment: cleared })).toBe(true);
  // Executors run the Freigabeprüfung (prepareClaim) before the transactional claim.
  const claim = async () => {
    const gate = await t.mutation(internal.externalActions.prepareClaim, { ownerId: ids.ownerId, requestId, executor: "agentmail" });
    if (gate.outcome !== "proceed") throw new ConvexError({ code: `GATE_${gate.outcome.toUpperCase()}`, reason: gate.reason });
    return t.mutation(internal.externalActions.claimForExecutor, { ownerId: ids.ownerId, requestId, executor: "agentmail" });
  };
  return { t, requestId, claim, ...ids };
}

describe("approved provider email replies", () => {
  it("allows one decline in an established provider conversation", async () => {
    const f = await fixture({ decline: true });
    expect(await f.t.run((ctx) => ctx.db.get(f.requestId))).toMatchObject({ status: "approved" });
    expect(await f.t.run((ctx) => ctx.db.get(f.conversationId))).toMatchObject({ state: "needs_attention" });
  });

  it("claims once and reuses one official component outbound on duplicate enqueue and worker replay", async () => {
    const f = await fixture();
    const claim = await f.claim();
    const first = await f.t.mutation(internal.agentmailComponent.enqueueClaimedReply, { ownerId: f.ownerId, executionId: claim.executionId });
    const second = await f.t.mutation(internal.agentmailComponent.enqueueClaimedReply, { ownerId: f.ownerId, executionId: claim.executionId });
    expect(second).toEqual({ outboundId: first.outboundId, reused: true });
    await f.t.action(internal.agentmail.executeApprovedReply, { ownerId: f.ownerId, requestId: f.requestId });
    expect((await f.t.run((ctx) => ctx.db.get(claim.executionId)))?.providerActionId).toBe(first.outboundId);
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toHaveLength(1);
  });

  it("requires the durable outbound receipt to match before success", async () => {
    const f = await fixture(); const claim = await f.claim();
    const queued = await f.t.mutation(internal.agentmailComponent.enqueueClaimedReply, { ownerId: f.ownerId, executionId: claim.executionId });
    expect(await f.t.mutation(internal.inbox.recordOutboundActionReply, { ownerId: f.ownerId, executionId: claim.executionId, outboundId: "wrong", providerThreadId: "thread-1", providerMessageId: "sent-1" })).toBe(false);
    expect(await f.t.mutation(internal.inbox.recordOutboundActionReply, { ownerId: f.ownerId, executionId: claim.executionId, outboundId: queued.outboundId, providerThreadId: "wrong-thread", providerMessageId: "sent-1" })).toBe(false);
    expect(await f.t.run((ctx) => ctx.db.query("mailMessages").withIndex("by_provider_message_id", (q) => q.eq("providerMessageId", "sent-1")).unique())).toBeNull();
    expect(await f.t.mutation(internal.inbox.recordOutboundActionReply, { ownerId: f.ownerId, executionId: claim.executionId, outboundId: queued.outboundId, providerThreadId: "thread-1", providerMessageId: "sent-1" })).toBe(true);
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "succeeded", providerThreadId: "thread-1", providerMessageId: "sent-1" });
    expect((await f.t.run((ctx) => ctx.db.get(f.requestId)))?.status).toBe("executed");
  });

  it.each([
    ["recipient", async (f: Awaited<ReturnType<typeof fixture>>) => f.t.run(async (ctx) => { const request = (await ctx.db.get(f.requestId))!; if (request.payload.kind === "email_message") await ctx.db.patch(f.requestId, { payload: { ...request.payload, recipientEmail: "changed@example.com" } }); })],
    ["newer inbound", async (f: Awaited<ReturnType<typeof fixture>>) => f.t.run((ctx) => ctx.db.insert("mailMessages", { threadId: f.threadId, providerMessageId: "parent-2", direction: "inbound", from: "provider@example.com", to: ["scout@agentmail.to"], subject: "Latest", body: "Update", deliveryStatus: "received", receivedAt: Date.now() + 1 }))],
    ["owner", async (f: Awaited<ReturnType<typeof fixture>>) => f.t.run((ctx) => ctx.db.patch(f.threadId, { ownerId: f.otherId }))],
    ["mailbox inactive", async (f: Awaited<ReturnType<typeof fixture>>) => f.t.run((ctx) => ctx.db.patch(f.mailboxId, { status: "disabled" }))],
    ["binding", async (f: Awaited<ReturnType<typeof fixture>>) => f.t.run((ctx) => ctx.db.patch(f.bindingId, { status: "paused" }))],
    ["autonomy", async (f: Awaited<ReturnType<typeof fixture>>) => f.t.run((ctx) => ctx.db.insert("scoutAutonomy", { ownerId: f.ownerId, mode: "autopilot", contact: false, viewings: true, publishAd: false, shareProfile: true, sharePrivate: false, version: 1, contentHash: "rules-v1", createdAt: Date.now(), updatedAt: Date.now() }))],
  ] as const)("rejects %s drift before any enqueue", async (_name, mutate) => {
    const f = await fixture(); await mutate(f);
    await expect(f.claim()).rejects.toThrow();
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
  });

  it("marks provider-started ambiguity unknown and never makes it retryable", async () => {
    const f = await fixture(); const claim = await f.claim();
    const queued = await f.t.mutation(internal.agentmailComponent.enqueueClaimedReply, { ownerId: f.ownerId, executionId: claim.executionId });
    await f.t.mutation(internal.externalActions.finishExecution, { ownerId: f.ownerId, executionId: claim.executionId, status: "unknown", error: "receipt unavailable" });
    await f.t.action(internal.agentmail.executeApprovedReply, { ownerId: f.ownerId, requestId: f.requestId });
    const execution = await f.t.run((ctx) => ctx.db.get(claim.executionId));
    expect(execution).toMatchObject({ status: "unknown", providerActionId: queued.outboundId });
    expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toHaveLength(1);
  });
});
