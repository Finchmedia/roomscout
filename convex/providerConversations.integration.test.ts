/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { MockLanguageModelV4 } from "ai/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { scoutAgent } from "./scoutRuntime";
import { offerConstraints, type ProviderAssessment } from "./lib/providerAssessment";

const modules = import.meta.glob("./**/*.ts");
const originalModel = scoutAgent.options.languageModel;
beforeEach(() => { vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", ""); });
afterEach(() => { scoutAgent.options.languageModel = originalModel; vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllEnvs(); });

const body = "Room available. Monthly total including all charges: EUR 220. Drums and storage allowed, Monday evenings available.";
async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "offer-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "offer-other", role: "musician", createdAt: now, lastSeenAt: now });
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
    const threadId = await ctx.db.insert("mailThreads", {
      ownerId, draftId, mailboxId, providerThreadId: "provider-thread", subject: "Room inquiry", status: "awaiting_reply", lastMessageAt: now, createdAt: now,
    });
    return { ownerId, otherId, savedNeedId, signalId, threadId, mailboxId };
  });
  const inbound = {
    mailboxId: ids.mailboxId, providerThreadId: "provider-thread", providerMessageId: "message-1", providerEventId: "event-1",
    from: "provider@example.test", to: ["scout@example.test"], subject: "Room reply", body,
    htmlAvailable: false, receivedAt: Date.now(),
  };
  const messageId = (await t.mutation(internal.inbox.storeInboundMessage, inbound))!;
  const eventId = (await t.mutation(internal.providerConversations.enqueueMailReply, { messageId }))!;
  const input = (await t.mutation(internal.providerConversations.prepareTurn, { eventId }))!;
  const citation = { sourceId: `mail:${messageId}`, quote: body };
  const assessment: ProviderAssessment = {
    summary: "Provider confirms the room matches the search.",
    availability: { status: "available", evidence: [citation] },
    monthlyPrice: { totalEur: 220, allRecurringCostsKnown: true, evidence: [citation] },
    terms: [{ key: "equipment", label: "Equipment", value: "Drums and storage allowed", evidence: [citation] }],
    constraints: offerConstraints(input.need).map(({ key }) => ({ key, verdict: "satisfied", explanation: "Confirmed by provider", evidence: [citation] })),
    uncertainties: [], contradictions: [], nextAction: "present_offer", suggestedReply: null,
  };
  const recordArgs = { eventId, needRevision: input.needRevision, signalRevision: input.signalRevision, assessment };
  return { t, ...ids, inbound, messageId, eventId, input, assessment, recordArgs };
}

describe("provider conversation and offer lifecycle", () => {
  it("deduplicates receipt and Agent prompts, and keeps private offers owner-scoped", async () => {
    const f = await fixture();
    expect(await f.t.mutation(internal.inbox.storeInboundMessage, f.inbound)).toBe(f.messageId);
    const again = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: f.eventId });
    expect(again?.promptMessageId).toBe(f.input.promptMessageId);
    const offerId = await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs);
    expect(await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).toBe(offerId);
    const duringTurn = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(duringTurn[0]?.offer).toMatchObject({ offerId, current: false, ready: false });
    expect(duringTurn[0]?.assessmentFromProviderReply).toBe(true);
    await f.t.run((ctx) => ctx.db.patch(f.eventId, { kind: "opportunity" }));
    expect((await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {}))[0]?.assessmentFromProviderReply).toBe(false);
    await f.t.run((ctx) => ctx.db.patch(f.eventId, { kind: "mail_reply" }));
    await f.t.mutation(internal.providerConversations.turnCompleted, {
      workId: "test-work" as never, context: { eventId: f.eventId }, result: { kind: "success", returnValue: null },
    });
    const mine = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(mine).toHaveLength(1);
    expect(mine[0]?.offer).toMatchObject({ offerId, current: true, ready: true });
    expect(await f.t.withIdentity({ subject: f.otherId }).query(api.providerConversations.listMine, {})).toEqual([]);
    expect(await f.t.run(async (ctx) => (await ctx.db.query("offerRevisions").collect()).length)).toBe(1);
  });

  it("new inbound mail immediately invalidates the prior offer and serializes its next turn", async () => {
    const f = await fixture();
    await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs);
    const newMessageId = await f.t.mutation(internal.inbox.storeInboundMessage, {
      ...f.inbound, providerMessageId: "message-2", providerEventId: "event-2", body: "Correction: monthly total is EUR 320.", receivedAt: Date.now() + 1,
    });
    const newEventId = await f.t.mutation(internal.providerConversations.enqueueMailReply, { messageId: newMessageId! });
    expect(await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).toBeNull();
    expect(await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: newEventId! })).toBeNull();
    const [mine] = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(mine?.offer).toMatchObject({ current: false, ready: false });
    await f.t.mutation(internal.providerConversations.turnCompleted, {
      workId: "test-work" as never, context: { eventId: f.eventId }, result: { kind: "success", returnValue: null },
    });
    const next = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: newEventId! });
    expect(next?.revision).toBe(2);
    expect(next?.threadId).toBe(f.input.threadId);
    expect(next?.previousAssessment?.monthlyPrice.totalEur).toBe(220);
    expect(await f.t.run(async (ctx) => (await ctx.db.get(f.eventId))?.status)).toBe("superseded");
  });

  it("rejects stale model results after the musician changes constraints", async () => {
    const f = await fixture();
    await f.t.run((ctx) => ctx.db.patch(f.savedNeedId, { maxBudgetEur: 150, matchingRevision: 2 }));
    expect(await f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).toBeNull();
    expect(await f.t.run((ctx) => ctx.db.query("offerRevisions").collect())).toEqual([]);
  });

  it("does not accept evidence from a different provider or write public facts", async () => {
    const f = await fixture();
    f.assessment.terms[0]!.evidence = [{ sourceId: "mail:unrelated", quote: body }];
    await expect(f.t.mutation(internal.providerConversations.recordAssessment, f.recordArgs)).rejects.toThrow("OFFER_EVIDENCE_NOT_FOUND");
    const signal = await f.t.run((ctx) => ctx.db.get(f.signalId));
    expect(signal?.summary).toBe("Shared room");
    expect(signal?.priceEur).toBeUndefined();
  });

  it("runs the real Convex Agent tool loop with only its model replaced", async () => {
    const f = await fixture();
    const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };
    const model = new MockLanguageModelV4({ doGenerate: [
      { content: [{ type: "tool-call", toolCallId: "assessment-1", toolName: "recordProviderAssessment", input: JSON.stringify(f.assessment) }], finishReason: { unified: "tool-calls", raw: undefined }, usage, warnings: [] },
      { content: [{ type: "text", text: "The offer is ready for your review; nothing has been sent." }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ] });
    scoutAgent.options.languageModel = model;
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(model.doGenerateCalls).toHaveLength(2);
    expect(model.doGenerateCalls[0]?.tools?.map((tool) => tool.name)).toEqual(["recordProviderAssessment"]);
    const mine = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(mine[0]?.offer).toMatchObject({ ready: true });
    expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
    const message = await f.t.run((ctx) => ctx.db.get(f.messageId));
    expect(message?.parsedSummary).toBe(f.assessment.summary);
    const event = await f.t.run((ctx) => ctx.db.get(f.eventId));
    expect(event?.status).toBe("completed");
  });

  it("keeps different provider threads separate even for the same matched room", async () => {
    const f = await fixture();
    const secondThread = await f.t.run(async (ctx) => {
      const first = (await ctx.db.get(f.threadId))!;
      return await ctx.db.insert("mailThreads", {
        ownerId: f.ownerId, draftId: first.draftId, mailboxId: f.mailboxId,
        providerThreadId: "another-provider", subject: "Second provider", status: "awaiting_reply", lastMessageAt: Date.now(), createdAt: Date.now(),
      });
    });
    const secondMessage = await f.t.mutation(internal.inbox.storeInboundMessage, {
      ...f.inbound, providerThreadId: "another-provider", providerMessageId: "second-provider-message", providerEventId: "second-provider-event", body: "Our room is unavailable.",
    });
    const secondEvent = await f.t.mutation(internal.providerConversations.enqueueMailReply, { messageId: secondMessage! });
    const input = await f.t.mutation(internal.providerConversations.prepareTurn, { eventId: secondEvent! });
    expect(input?.threadId).not.toBe(f.input.threadId);
    expect(input?.previousAssessment).toBeNull();
    expect(input?.evidence.some((source) => source.text.includes(body))).toBe(false);
    const rows = await f.t.withIdentity({ subject: f.ownerId }).query(api.providerConversations.listMine, {});
    expect(rows.map((row) => row.mailThreadId)).toContain(secondThread);
    expect(rows).toHaveLength(2);
  });
});
