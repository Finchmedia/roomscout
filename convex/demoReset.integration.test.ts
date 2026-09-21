/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id, TableNames } from "./_generated/dataModel";
import schema from "./schema";
import { requireActionUserId } from "./integrations/authz";
import { DEMO_RESET_STALL_MS } from "./lib/demoReset";
import type { ProviderAssessment } from "./lib/providerAssessment";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

/** Every owner-scoped table the demo reset empties, in stage order. */
const WIPED_TABLES = [
  "decisions", "providerConversations", "messageSafetyAssessments", "actionExecutions", "actionApprovals",
  "actionRequests", "handoffs", "viewings", "offerRevisions", "platformMessages", "platformThreads", "mailThreads",
  "outreachApprovals", "outreachDrafts", "notifications", "voiceTranscriptEvents", "voiceSessions",
  "savedNeedEmbeddings", "matchAssessments", "signalMatches", "opportunities", "scoutContexts",
  "memoryEvents", "memoryFacts", "memoryProfiles", "memoryEntities", "savedNeeds",
] as const satisfies readonly TableNames[];
/** Account, portal registration, browser context, mailbox, settings, source preferences and audit trail survive a demo reset. */
const KEPT_TABLES = ["users", "portalConnections", "browserContexts", "userMailboxes", "scoutAutonomy", "searchSourcePreferences", "auditEvents"] as const satisfies readonly TableNames[];

const assessment: ProviderAssessment = {
  summary: "Ask whether the room is still free",
  availability: { status: "unknown", evidence: [] },
  monthlyPrice: { totalEur: null, allRecurringCostsKnown: false, evidence: [] },
  terms: [], constraints: [], uncertainties: ["Availability"], contradictions: [],
  nextAction: "ask_provider",
  suggestedReply: { subject: "Room availability", body: "Is the room still available?" },
  viewing: null,
};

function setup() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  return t;
}

type Harness = ReturnType<typeof setup>;

/** Two musicians with the same footprint: search, match, conversation, decision, offer, request with approval and execution, handoff, portal thread, mail thread, notification, memory, voice, plus the rows that must survive. */
async function seed(t: Harness) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const platformId = await ctx.db.insert("sourcePlatforms", { slug: "controlled", name: "Controlled portal", canonicalDomain: "roomscout.dev", kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now, createdAt: now, updatedAt: now });
    const sourceId = await ctx.db.insert("sources", { platformId, slug: "controlled-connected", name: "Controlled connected messaging", baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const signalId = await ctx.db.insert("signals", { side: "supply", title: "Shared room", city: "Stuttgart", summary: "Room to share", arrangement: "shared", requirements: [], unknowns: [], status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now });
    const seedUser = async (username: string) => {
      const ownerId = await ctx.db.insert("users", { username, firstName: username, actKind: "band", actName: `${username} band`, providerIdentityConfirmedAt: now, role: "musician", createdAt: now, lastSeenAt: now });
      const needId = await ctx.db.insert("savedNeeds", { ownerId, title: "Band room", city: "Stuttgart", districts: [], arrangement: ["shared"], schedule: [], requirements: [], maxBudgetEur: 250, matchingRevision: 1, status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("signalMatches", { ownerId, savedNeedId: needId, signalId, kind: "need_supply", score: 0.8, structuredScore: 0.8, semanticScore: 0.8, reasons: ["Matching city"], uncertainties: [], status: "new", fingerprint: `match-${username}`, eligible: true, contactEligible: true, needRevision: 1, signalRevision: "rev-1", createdAt: now, updatedAt: now });
      await ctx.db.insert("searchSourcePreferences", { ownerId, savedNeedId: needId, platformId, preference: "prefer", createdAt: now, updatedAt: now });
      const connectionId = await ctx.db.insert("portalConnections", { ownerId, sourceId, platformId, label: "Test connection", allowedDomains: ["roomscout.dev"], allowedPaths: ["/listings", "/inbox"], adapterKey: "roomscout-dev-v1", status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
      await ctx.db.insert("browserContexts", { connectionId, ownerId, providerContextId: `context-${username}`, status: "ready", createdAt: now, updatedAt: now });
      const platformThreadId = await ctx.db.insert("platformThreads", { connectionId, ownerId, providerThreadId: `thread-${username}`, participants: ["Provider"], lastMessageAt: now, status: "open", createdAt: now, updatedAt: now });
      await ctx.db.insert("platformMessages", { connectionId, ownerId, threadId: platformThreadId, providerMessageId: `in-${username}`, direction: "inbound", senderLabel: "Provider", bodyText: "Is the room still free?", sentAt: now, createdAt: now });
      const conversationThread = await ctx.runMutation(components.agent.threads.createThread, { userId: ownerId, title: `Provider thread ${username}` });
      const conversationId = await ctx.db.insert("providerConversations", { ownerId, savedNeedId: needId, signalId, conversationKey: `controlled-${username}`, agentThreadId: conversationThread._id, platformThreadId, revision: 1, state: "needs_attention", createdAt: now, updatedAt: now });
      const turnId = await ctx.db.insert("providerTurns", { conversationId, sourceKey: "portal:one", kind: "portal_reply", revision: 1, status: "completed", createdAt: now });
      const offerId = await ctx.db.insert("offerRevisions", { ownerId, savedNeedId: needId, conversationId, eventId: turnId, revision: 1, needRevision: 1, signalRevision: "rev-1", assessment, ready: false, blockers: ["Availability unknown"], contentHash: `offer-${username}`, model: "test-model", promptVersion: "test", schemaVersion: "test", createdAt: now });
      await ctx.db.patch(conversationId, { currentOfferId: offerId });
      await ctx.db.insert("viewings", { ownerId, savedNeedId: needId, conversationId, signalId, roomTitle: "Shared room", providerLabel: "Provider", date: "2026-09-25", time: "17:00", timeZone: "Europe/Berlin", evidenceSourceId: "portal:one", evidenceQuote: "Freitag, 25.09., 17:00 passt uns.", offerId, createdAt: now, updatedAt: now });
      await ctx.db.insert("decisions", { ownerId, savedNeedId: needId, conversationId, kind: "scout_question", status: "open", question: "Still interested?", options: [{ id: "yes", label: "Yes" }], refs: { offerId }, createdAt: now, updatedAt: now });
      const payload = { kind: "platform_message" as const, threadId: platformThreadId, recipients: ["Provider"], body: "Hello" };
      const requestId = await ctx.db.insert("actionRequests", { ownerId, connectionId, savedNeedId: needId, matchingSignalId: signalId, automationMode: "exact_once", requestedActionType: "send_platform_dm", personalDataScopes: [], payload, contentVersion: 1, contentHash: `hash-${username}`, status: "drafted", createdAt: now, updatedAt: now });
      const approvalId = await ctx.db.insert("actionApprovals", { requestId, ownerId, contentVersion: 1, contentHash: `hash-${username}`, payloadSnapshot: payload, decision: "approved", decidedAt: now });
      await ctx.db.insert("actionExecutions", { requestId, ownerId, approvalId, status: "succeeded", idempotencyKey: `execution-${username}`, startedAt: now, completedAt: now, createdAt: now, updatedAt: now });
      await ctx.db.insert("handoffs", { ownerId, savedNeedId: needId, actionRequestId: requestId, channel: "platform", status: "draft", summary: "Reply to the provider", contextHash: `handoff-${username}`, createdAt: now, updatedAt: now });
      await ctx.db.insert("auditEvents", { eventKey: `audit-${username}`, actorType: "user", actorUserId: ownerId, entityKey: `actionRequests:${requestId}`, eventType: "action_request.approved", actionRequestId: requestId, occurredAt: now });
      const draftId = await ctx.db.insert("outreachDrafts", { ownerId, signalId, savedNeedId: needId, recipientName: "Provider", recipientEmail: "provider@example.com", subject: "Room", body: "Hello", contentVersion: 1, contentHash: `draft-${username}`, status: "sent", createdAt: now, updatedAt: now });
      const mailThreadId = await ctx.db.insert("mailThreads", { ownerId, draftId, providerThreadId: `mail-${username}`, subject: "Room", status: "awaiting_reply", lastMessageAt: now, createdAt: now });
      await ctx.db.insert("mailMessages", { threadId: mailThreadId, providerMessageId: `mail-message-${username}`, direction: "outbound", from: `${username}@agentmail.to`, to: ["provider@example.com"], subject: "Room", body: "Hello", receivedAt: now });
      await ctx.db.insert("notifications", { ownerId, kind: "system", title: "Welcome", body: "Hello", createdAt: now });
      const entityId = await ctx.db.insert("memoryEntities", { ownerId, kind: "band", name: "Band", normalizedName: "band", createdAt: now, updatedAt: now });
      await ctx.db.insert("memoryFacts", { ownerId, subjectEntityId: entityId, predicate: "drum_kit_room_preference", value: "Shared drum kit", category: "equipment", confidence: 0.7, source: "conversation", verification: "inferred", sensitivity: "normal", status: "active", createdAt: now, updatedAt: now });
      const scoutThread = await ctx.runMutation(components.agent.threads.createThread, { userId: ownerId, title: "My RoomScout search" });
      await ctx.db.insert("scoutContexts", { ownerId, threadId: scoutThread._id, activeNeedId: needId, mode: "search_discovery", updatedAt: now });
      await ctx.db.insert("voiceSessions", { ownerId, threadId: scoutThread._id, model: "gpt-live-1", voice: "marin", provider: "live", status: "ended", startedAt: now, endedAt: now, updatedAt: now });
      await ctx.db.insert("userMailboxes", { ownerId, provider: "agentmail", providerInboxId: `inbox-${username}`, emailAddress: `${username}@agentmail.to`, clientId: `roomscout-${username}`, status: "active", createdAt: now, updatedAt: now });
      await ctx.db.insert("scoutAutonomy", { ownerId, mode: "autopilot", contact: false, viewings: true, publishAd: false, shareProfile: true, sharePrivate: false, version: 1, contentHash: "rules-v1", createdAt: now, updatedAt: now });
      return { ownerId, needId, conversationId, mailThreadId, scoutThreadId: scoutThread._id, conversationThreadId: conversationThread._id };
    };
    return { a: await seedUser("demo-a"), b: await seedUser("demo-b") };
  });
}

/** Rows per table that belong to `ownerId` (the users row is the owner itself; audit events name their actor). */
async function ownedCounts(t: Harness, ownerId: Id<"users">, tables: readonly TableNames[]) {
  return await t.run(async (ctx) => {
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows: Array<{ _id: string; ownerId?: string; actorUserId?: string }> = await ctx.db.query(table).collect();
      counts[table] = rows.filter((row) => (table === "users" ? row._id : table === "auditEvents" ? row.actorUserId : row.ownerId) === ownerId).length;
    }
    return counts;
  });
}

const zeroCounts = Object.fromEntries(WIPED_TABLES.map((table) => [table, 0]));
const keptCounts = Object.fromEntries(KEPT_TABLES.map((table) => [table, 1]));
const providerTurnCount = (t: Harness, conversationId: Id<"providerConversations">) =>
  t.run(async (ctx) => (await ctx.db.query("providerTurns").withIndex("by_conversation_and_status_and_revision", (q) => q.eq("conversationId", conversationId)).collect()).length);
const mailMessageCount = (t: Harness, threadId: Id<"mailThreads">) =>
  t.run(async (ctx) => (await ctx.db.query("mailMessages").withIndex("by_thread_and_received_at", (q) => q.eq("threadId", threadId)).collect()).length);
const agentThreadExists = (t: Harness, threadId: string) =>
  t.run(async (ctx) => (await ctx.runQuery(components.agent.threads.getThread, { threadId: threadId as never })) !== null);
const mayRunWork = (t: Harness, userId: Id<"users">) => t.query(internal.devUserReset.userMayRunWork, { userId });
const needStatus = (t: Harness, needId: Id<"savedNeeds">) => t.run(async (ctx) => (await ctx.db.get(needId))?.status ?? null);
const pendingScheduled = async (t: Harness) =>
  (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).filter((row) => row.state.kind === "pending" || row.state.kind === "inProgress");
/** The pending deletion pagers only; the portal reset action scheduled next to them is counted separately. */
const pendingPagers = async (t: Harness) => (await pendingScheduled(t)).filter((row) => row.name.endsWith("runPage"));
const pendingPortalResets = async (t: Harness) => (await pendingScheduled(t)).filter((row) => row.name.endsWith("resetPortalConversations"));
const mailboxAddress = (t: Harness, ownerId: Id<"users">) =>
  t.run(async (ctx) => (await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", ownerId)).first())?.emailAddress ?? null);
const portalResetOf = (t: Harness, resetId: Id<"demoResets">) => t.run(async (ctx) => (await ctx.db.get(resetId))?.portalReset ?? null);
const PORTAL_RESET_URL = "https://portal.example.convex.site/participant-reset";
const PORTAL_RESET_SECRET = "portal-reset-test-secret";
function stubPortalReset(url = PORTAL_RESET_URL, secret = PORTAL_RESET_SECRET) {
  vi.stubEnv("PORTAL_RESET_URL", url);
  vi.stubEnv("PORTAL_RESET_SECRET", secret);
}
/** A portal that answers every reset request with `status` and `body`; the mock records what the app sent. */
function stubPortalFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function sentRequest(fetch: ReturnType<typeof stubPortalFetch>) {
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  return { url, method: init.method, headers, body: JSON.parse(String(init.body)) as { emailAddresses: string[] } };
}
/** Fires the scheduled pages that are due right now and waits for them; pages they schedule stay pending. */
async function runDuePages(t: Harness) {
  vi.runOnlyPendingTimers();
  await t.finishInProgressScheduledFunctions();
}
/** The auth and query surface `requireActionUserId` needs, as a public action of `userId` would see it. */
const actionCtxFor = (t: Harness, userId: Id<"users">) => ({
  auth: { getUserIdentity: async () => ({ subject: userId, issuer: "test", tokenIdentifier: `test|${userId}` }) },
  runQuery: (reference: Parameters<Harness["query"]>[0], args: Parameters<Harness["query"]>[1]) => t.query(reference, args),
}) as unknown as Parameters<typeof requireActionUserId>[0];

describe("demoReset", () => {
  it("rejects an unauthenticated caller", async () => {
    const t = setup();
    await expect(t.mutation(api.demoReset.startMine, {})).rejects.toThrow("UNAUTHENTICATED");
    await expect(t.query(api.demoReset.statusMine, {})).rejects.toThrow("UNAUTHENTICATED");
    expect(await t.run((ctx) => ctx.db.query("demoResets").collect())).toEqual([]);
  });

  it("wipes only the caller's search and interactions, pauses their workers meanwhile, and keeps the account", async () => {
    const t = setup();
    const { a, b } = await seed(t);
    const musicianA = t.withIdentity({ subject: a.ownerId });
    expect(await musicianA.query(api.demoReset.statusMine, {})).toBeNull();
    const seededA = await ownedCounts(t, a.ownerId, WIPED_TABLES);
    const seededB = await ownedCounts(t, b.ownerId, WIPED_TABLES);
    expect(seededA).not.toEqual(zeroCounts);
    // Stages the seed does not exercise: their index and owner field are covered by the typecheck only.
    expect(Object.keys(seededA).filter((table) => seededA[table] === 0).sort()).toEqual([
      "matchAssessments", "memoryEvents", "memoryProfiles", "messageSafetyAssessments",
      "opportunities", "outreachApprovals", "savedNeedEmbeddings", "voiceTranscriptEvents",
    ]);
    const seededDocumentsA = Object.values(seededA).reduce((sum, count) => sum + count, 0) + 2; // + A's providerTurn and mailMessage

    const resetId = await musicianA.mutation(api.demoReset.startMine, {});
    expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "scheduled", stage: 0, stageCount: WIPED_TABLES.length, deletedDocumentCount: 0, updatedAt: Date.now() });
    // Scheduled and pooled workers consult userMayRunWork: A is paused, B is not.
    expect(await mayRunWork(t, a.ownerId)).toBe(false);
    expect(await mayRunWork(t, b.ownerId)).toBe(true);
    // The owner's own actions are not workers: they keep resolving during the reset.
    expect(await requireActionUserId(actionCtxFor(t, a.ownerId))).toBe(a.ownerId);
    // A second start while the reset is healthy returns the same reset and adds no second pager.
    expect(await musicianA.mutation(api.demoReset.startMine, {})).toBe(resetId);
    expect(await t.run((ctx) => ctx.db.query("demoResets").collect())).toHaveLength(1);
    expect(await pendingPagers(t)).toHaveLength(1);
    expect(await pendingPortalResets(t)).toHaveLength(1);

    // The first page quiesces A's active needs before anything is deleted, so the
    // ungated matching and orchestration workers stop producing rows behind the wipe.
    await runDuePages(t);
    expect(await needStatus(t, a.needId)).toBe("paused");
    expect(await needStatus(t, b.needId)).toBe("active");
    expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(seededA);
    expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "scheduled", stage: 0, deletedDocumentCount: 0 });

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(zeroCounts);
    expect(await providerTurnCount(t, a.conversationId)).toBe(0);
    expect(await mailMessageCount(t, a.mailThreadId)).toBe(0);
    expect(await agentThreadExists(t, a.scoutThreadId)).toBe(false);
    expect(await agentThreadExists(t, a.conversationThreadId)).toBe(false);
    expect(await ownedCounts(t, a.ownerId, KEPT_TABLES)).toEqual(keptCounts);
    // B is untouched in every respect.
    expect(await ownedCounts(t, b.ownerId, WIPED_TABLES)).toEqual(seededB);
    expect(await needStatus(t, b.needId)).toBe("active");
    expect(await providerTurnCount(t, b.conversationId)).toBe(1);
    expect(await mailMessageCount(t, b.mailThreadId)).toBe(1);
    expect(await agentThreadExists(t, b.scoutThreadId)).toBe(true);
    expect(await agentThreadExists(t, b.conversationThreadId)).toBe(true);
    expect(await ownedCounts(t, b.ownerId, KEPT_TABLES)).toEqual(keptCounts);

    const status = await musicianA.query(api.demoReset.statusMine, {});
    expect(status).toMatchObject({ resetId, status: "completed", stage: WIPED_TABLES.length, stageCount: WIPED_TABLES.length, deletedDocumentCount: seededDocumentsA });
    expect(status?.completedAt).toEqual(expect.any(Number));
    // No PORTAL_RESET_URL / PORTAL_RESET_SECRET in this test: the portal side is skipped, not failed.
    expect(status?.portalReset).toEqual({ status: "skipped_not_configured", at: expect.any(Number) });
    expect(await mayRunWork(t, a.ownerId)).toBe(true);
    expect(await pendingScheduled(t)).toEqual([]);

    // After completion a new reset starts from scratch rather than reusing the finished row.
    const secondResetId = await musicianA.mutation(api.demoReset.startMine, {});
    expect(secondResetId).not.toBe(resetId);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId: secondResetId, status: "completed", deletedDocumentCount: 0 });
    expect(await ownedCounts(t, a.ownerId, KEPT_TABLES)).toEqual(keptCounts);
  });

  it("resumes a reset whose pager died instead of leaving the account paused forever", async () => {
    const t = setup();
    const { a, b } = await seed(t);
    const musicianA = t.withIdentity({ subject: a.ownerId });
    const seededB = await ownedCounts(t, b.ownerId, WIPED_TABLES);
    // A row left in "running" with no scheduled page: the chain died after its first page.
    const staleAt = Date.now() - DEMO_RESET_STALL_MS;
    const resetId = await t.run((ctx) => ctx.db.insert("demoResets", { ownerId: a.ownerId, status: "running", stage: 0, deletedDocumentCount: 0, createdAt: staleAt, updatedAt: staleAt }));
    expect(await pendingScheduled(t)).toEqual([]);
    expect(await mayRunWork(t, a.ownerId)).toBe(false);
    expect(await requireActionUserId(actionCtxFor(t, a.ownerId))).toBe(a.ownerId);

    expect(await musicianA.mutation(api.demoReset.startMine, {})).toBe(resetId);
    expect(await pendingPagers(t)).toHaveLength(1);
    // The portal call recorded nothing before the chain died, so the resume retries it too.
    expect(await pendingPortalResets(t)).toHaveLength(1);
    expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "running", stage: 0, updatedAt: Date.now() });
    // The resume is marked, so a repeated start within the threshold does not add a pager.
    expect(await musicianA.mutation(api.demoReset.startMine, {})).toBe(resetId);
    expect(await pendingPagers(t)).toHaveLength(1);
    expect(await pendingPortalResets(t)).toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "completed", stage: WIPED_TABLES.length });
    expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(zeroCounts);
    expect(await ownedCounts(t, a.ownerId, KEPT_TABLES)).toEqual(keptCounts);
    expect(await ownedCounts(t, b.ownerId, WIPED_TABLES)).toEqual(seededB);
    expect(await mayRunWork(t, a.ownerId)).toBe(true);
    expect(await pendingScheduled(t)).toEqual([]);
  });

  describe("portal reset", () => {
    it("asks the portal to reset the owner's participants by mailbox address and records the match", async () => {
      stubPortalReset();
      const fetch = stubPortalFetch(202, { resetIds: ["portal-reset-1"], matched: 1 });
      const t = setup();
      const { a, b } = await seed(t);
      // The registered login is compared case-insensitively on the portal; the app sends it lowercased.
      await t.run(async (ctx) => {
        const mailbox = await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", a.ownerId)).first();
        await ctx.db.patch(mailbox!._id, { emailAddress: "Demo-A@AgentMail.to" });
      });
      const musicianA = t.withIdentity({ subject: a.ownerId });
      const resetId = await musicianA.mutation(api.demoReset.startMine, {});
      expect(await pendingPortalResets(t)).toHaveLength(1);
      await t.finishAllScheduledFunctions(vi.runAllTimers);

      const request = sentRequest(fetch);
      expect(request.url).toBe(PORTAL_RESET_URL);
      expect(request.method).toBe("POST");
      expect(request.headers["X-RoomScout-Reset-Secret"]).toBe(PORTAL_RESET_SECRET);
      expect(request.headers["Content-Type"]).toBe("application/json");
      expect(request.body).toEqual({ emailAddresses: ["demo-a@agentmail.to"] });
      expect(await mailboxAddress(t, b.ownerId)).toBe("demo-b@agentmail.to"); // B's identity is never sent.

      expect(await portalResetOf(t, resetId)).toEqual({ status: "done", matched: 1, resetIds: ["portal-reset-1"], at: expect.any(Number) });
      const status = await musicianA.query(api.demoReset.statusMine, {});
      expect(status).toMatchObject({ resetId, status: "completed", portalReset: { status: "done", matched: 1, resetIds: ["portal-reset-1"] } });
      expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(zeroCounts);
      expect(await ownedCounts(t, a.ownerId, KEPT_TABLES)).toEqual(keptCounts);
      expect(await pendingScheduled(t)).toEqual([]);
    });

    it("records done when the portal accepts with 202 but the reply body cannot be parsed", async () => {
      stubPortalReset();
      // Headers arrive, then the body is cut off or is not JSON: the 202 alone proves acceptance.
      const fetch = vi.fn(async () => new Response("<not json", { status: 202, headers: { "Content-Type": "application/json" } }));
      vi.stubGlobal("fetch", fetch);
      const t = setup();
      const { a } = await seed(t);
      const musicianA = t.withIdentity({ subject: a.ownerId });
      const resetId = await musicianA.mutation(api.demoReset.startMine, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(sentRequest(fetch).body).toEqual({ emailAddresses: ["demo-a@agentmail.to"] });
      expect(await portalResetOf(t, resetId)).toEqual({ status: "done", matched: 0, resetIds: [], at: expect.any(Number) });
      expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "completed", portalReset: { status: "done" } });
      expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(zeroCounts);
    });

    it("records none_matched when the portal knows no such participant", async () => {
      stubPortalReset();
      const fetch = stubPortalFetch(200, { resetIds: [], matched: 0 });
      const t = setup();
      const { a } = await seed(t);
      const musicianA = t.withIdentity({ subject: a.ownerId });
      const resetId = await musicianA.mutation(api.demoReset.startMine, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(sentRequest(fetch).body).toEqual({ emailAddresses: ["demo-a@agentmail.to"] });
      expect(await portalResetOf(t, resetId)).toEqual({ status: "none_matched", matched: 0, resetIds: [], at: expect.any(Number) });
      expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "completed" });
      expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(zeroCounts);
    });

    it("records a portal failure without failing or blocking the app reset", async () => {
      stubPortalReset();
      const fetch = stubPortalFetch(500, { error: "boom" });
      const t = setup();
      const { a } = await seed(t);
      const musicianA = t.withIdentity({ subject: a.ownerId });
      const resetId = await musicianA.mutation(api.demoReset.startMine, {});
      await expect(t.finishAllScheduledFunctions(vi.runAllTimers)).resolves.toBeUndefined();
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(await portalResetOf(t, resetId)).toEqual({ status: "failed", error: "PORTAL_HTTP_500", at: expect.any(Number) });
      expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "completed", stage: WIPED_TABLES.length, portalReset: { status: "failed", error: "PORTAL_HTTP_500" } });
      expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(zeroCounts);
      expect(await ownedCounts(t, a.ownerId, KEPT_TABLES)).toEqual(keptCounts);
      expect(await mayRunWork(t, a.ownerId)).toBe(true);
      expect(await pendingScheduled(t)).toEqual([]);
    });

    it("records a network failure as a code, not a message", async () => {
      stubPortalReset();
      const fetch = vi.fn(async () => { throw new TypeError("fetch failed: ECONNREFUSED portal.example"); });
      vi.stubGlobal("fetch", fetch);
      const t = setup();
      const { a } = await seed(t);
      const musicianA = t.withIdentity({ subject: a.ownerId });
      const resetId = await musicianA.mutation(api.demoReset.startMine, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(await portalResetOf(t, resetId)).toEqual({ status: "failed", error: "NETWORK", at: expect.any(Number) });
      expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "completed" });
    });

    it("skips the portal when the endpoint or secret is not configured", async () => {
      vi.stubEnv("PORTAL_RESET_URL", PORTAL_RESET_URL); // secret missing
      const fetch = stubPortalFetch(202, { resetIds: ["never"], matched: 1 });
      const t = setup();
      const { a } = await seed(t);
      const musicianA = t.withIdentity({ subject: a.ownerId });
      const resetId = await musicianA.mutation(api.demoReset.startMine, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(fetch).not.toHaveBeenCalled();
      expect(await portalResetOf(t, resetId)).toEqual({ status: "skipped_not_configured", at: expect.any(Number) });
      expect(await musicianA.query(api.demoReset.statusMine, {})).toMatchObject({ resetId, status: "completed", portalReset: { status: "skipped_not_configured" } });
      expect(await ownedCounts(t, a.ownerId, WIPED_TABLES)).toEqual(zeroCounts);
    });

    it("records none_matched without calling the portal when the owner has no mailbox address", async () => {
      stubPortalReset();
      const fetch = stubPortalFetch(202, { resetIds: ["never"], matched: 1 });
      const t = setup();
      const { a } = await seed(t);
      await t.run(async (ctx) => {
        const mailbox = await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", a.ownerId)).first();
        await ctx.db.patch(mailbox!._id, { emailAddress: undefined });
      });
      const musicianA = t.withIdentity({ subject: a.ownerId });
      const resetId = await musicianA.mutation(api.demoReset.startMine, {});
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(fetch).not.toHaveBeenCalled();
      expect(await portalResetOf(t, resetId)).toEqual({ status: "none_matched", matched: 0, resetIds: [], at: expect.any(Number) });
    });
  });
});
