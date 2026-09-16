/// <reference types="vite/client" />
import agentTest from "@convex-dev/agent/test";
import { listMessages } from "@convex-dev/agent";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import { api, components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { scoutAgent } from "./scoutRuntime";
import {
  captureFactsCapabilities,
  composeVoiceInput,
  hasMeaningfulSavedNeed,
  resolveLiveDelivery,
} from "./voiceLive";

const modules = import.meta.glob("./**/*.ts");

type ClaimArgs = {
  ownerId: Id<"users">;
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  fingerprint: string;
  source: "voice" | "text";
  intent?: "capture_facts";
  delegationId?: string;
  transcriptSegmentId?: string;
  eventIds: string[];
  prompt: string;
  focusedSignalId?: Id<"signals">;
  decisionId?: Id<"decisions">;
};
type Result = {
  status: "in_progress" | "busy" | "completed" | "needs_clarification" | "superseded" | "failed" | "outcome_unknown";
  requestId: string;
  resolvedEventIds: string[];
  locale: "en" | "de";
  promptMessageId?: string;
  assistantMessageId?: string;
  delivery?: "silent" | "spoken";
  spokenSummary?: string;
  changedFields?: string[];
  endCall?: { reason: "user_request" | "farewell"; farewell: string };
};
type ClaimResult =
  | { kind: "accepted"; generation: number; promptMessageId?: string; locale: "en" | "de"; activeNeedId?: Id<"savedNeeds">; needRevision?: number }
  | { kind: "result"; result: Result };

const claimRequest = makeFunctionReference<"mutation", ClaimArgs, ClaimResult>("voiceLive:claimRequest");
const finishRequest = makeFunctionReference<"mutation", {
  ownerId: Id<"users">;
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  generation: number;
  expectedLocale: "en" | "de";
  result: Result;
}, Result>("voiceLive:finishRequest");
const updateFromScout = makeFunctionReference<"mutation", {
  ownerId: Id<"users">;
  needId: Id<"savedNeeds">;
  maxBudgetEur?: number;
  schedule?: string[];
  voiceClaim?: { voiceSessionId: Id<"voiceSessions">; requestId: string; generation: number };
}, { revision: number; changedFields: string[] }>("savedNeeds:updateFromScout");
const setLanguage = makeFunctionReference<"mutation", {
  locale: "en" | "de";
  voiceSessionId?: Id<"voiceSessions">;
}, { locale: "en" | "de"; languageRevision: number }>("voiceLive:setLanguage");
const getConfig = makeFunctionReference<"query", Record<string, never>, {
  provider: "live" | "realtime";
  locale: "en" | "de";
}>("voiceLive:getConfig");
const answerNonbindingFromVoice = makeFunctionReference<"mutation", {
  ownerId: Id<"users">;
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  generation: number;
  decisionId: Id<"decisions">;
  choice: string;
  text?: string;
}, unknown>("decisions:answerNonbindingFromVoice");
const setLanguageFromClaim = makeFunctionReference<"mutation", {
  ownerId: Id<"users">;
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  generation: number;
  locale: "en" | "de";
}, { locale: "en" | "de"; languageRevision: number }>("voiceLive:setLanguageFromClaim");
const changeNeedStatus = makeFunctionReference<"mutation", {
  ownerId: Id<"users">;
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  generation: number;
  action: "start" | "pause";
}, {
  status: "active" | "paused" | "needs_clarification";
  revision: number;
  changed: boolean;
  missingFields: Array<"location" | "radiusKm">;
  clarificationQuestion?: string;
}>("voiceLive:changeNeedStatus");
const recordTranscriptSegment = makeFunctionReference<"mutation", {
  voiceSessionId: Id<"voiceSessions">;
  segmentId: string;
  revision: number;
  role: "user" | "assistant";
  transcript: string;
  sourceEventIds: string[];
  startMs: number;
  endMs: number;
}, { status: "created" | "updated" | "unchanged" | "stale"; messageId: string }>("voiceLive:recordTranscriptSegment");

async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  const data = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", {
      username: "live-owner",
      role: "musician",
      conversationLocale: "en",
      createdAt: now,
      lastSeenAt: now,
    });
    const needId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Band room",
      city: "Berlin",
      locationQuery: "Berlin",
      locationLabel: "Berlin",
      radiusKm: 10,
      arrangement: [],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const firstSignalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "First room",
      city: "Berlin",
      summary: "First room",
      arrangement: "shared",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    const secondSignalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "Second room",
      city: "Berlin",
      summary: "Second room",
      arrangement: "shared",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
    });
    const { threadId } = await scoutAgent.createThread(ctx, { userId: ownerId, title: "Live test" });
    await ctx.db.insert("scoutContexts", {
      ownerId,
      threadId,
      activeNeedId: needId,
      focusedSignalId: firstSignalId,
      mode: "search_discovery",
      updatedAt: now,
    });
    const voiceSessionId = await ctx.db.insert("voiceSessions", {
      ownerId,
      threadId,
      model: "gpt-live-1",
      voice: "marin",
      provider: "live",
      providerSessionId: "live_test",
      conversationLocale: "en",
      languageRevision: 0,
      claimGeneration: 0,
      requestTombstones: [],
      recentResults: [],
      status: "active",
      activeNeedId: needId,
      focusedSignalId: firstSignalId,
      startedAt: now,
      updatedAt: now,
    });
    return { ownerId, needId, firstSignalId, secondSignalId, threadId, voiceSessionId };
  });
  return { t, owner: t.withIdentity({ subject: data.ownerId }), ...data };
}

function claimArgs(f: Awaited<ReturnType<typeof fixture>>, requestId: string): ClaimArgs {
  return {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId,
    fingerprint: `fingerprint:${requestId}`,
    source: "voice",
    delegationId: `delegation:${requestId}`,
    eventIds: [`event:${requestId}`],
    prompt: `Request ${requestId}`,
  };
}

it("claims once, reports active duplicates and caches terminal results", async () => {
  const f = await fixture();
  const first = await f.t.mutation(claimRequest, claimArgs(f, "one"));
  expect(first.kind).toBe("accepted");
  if (first.kind !== "accepted") throw new Error("claim not accepted");

  const duplicate = await f.t.mutation(claimRequest, claimArgs(f, "one"));
  expect(duplicate).toMatchObject({ kind: "result", result: { status: "in_progress", requestId: "one", resolvedEventIds: [] } });
  const busy = await f.t.mutation(claimRequest, claimArgs(f, "two"));
  expect(busy).toMatchObject({ kind: "result", result: { status: "busy", requestId: "two", resolvedEventIds: [] } });
  const conflicting = await f.t.mutation(claimRequest, { ...claimArgs(f, "one"), fingerprint: "different" });
  expect(conflicting).toMatchObject({ kind: "result", result: { status: "outcome_unknown", resolvedEventIds: [] } });

  const terminal: Result = {
    status: "completed",
    requestId: "one",
    resolvedEventIds: ["event:one"],
    locale: "en",
    promptMessageId: first.promptMessageId,
    endCall: { reason: "farewell", farewell: "Bye for now!" },
  };
  await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "one",
    generation: first.generation,
    expectedLocale: "en",
    result: terminal,
  });
  const replay = await f.t.mutation(claimRequest, claimArgs(f, "one"));
  expect(replay).toEqual({ kind: "result", result: terminal });

  const stored = await f.t.run((ctx) => ctx.db.get(f.voiceSessionId));
  expect(stored?.requestTombstones).toHaveLength(1);
  expect(stored?.activeClaim).toBeUndefined();
});

it("uses a hidden marker only for silent typed turns and leaves spoken persistence to Live captions", async () => {
  const f = await fixture();
  const silentClaim = await f.t.mutation(claimRequest, { ...claimArgs(f, "silent"), source: "text" });
  if (silentClaim.kind !== "accepted") throw new Error("claim not accepted");
  const silent = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "silent",
    generation: silentClaim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "silent",
      resolvedEventIds: ["event:silent"],
      locale: "en",
      delivery: "silent",
      promptMessageId: silentClaim.promptMessageId,
    },
  });
  expect(silent.assistantMessageId).toBeTruthy();
  expect(await f.t.mutation(claimRequest, { ...claimArgs(f, "silent"), source: "text" })).toMatchObject({
    kind: "result",
    result: {
      requestId: "silent",
      delivery: "silent",
      assistantMessageId: silent.assistantMessageId,
    },
  });

  const spokenClaim = await f.t.mutation(claimRequest, claimArgs(f, "spoken"));
  if (spokenClaim.kind !== "accepted") throw new Error("claim not accepted");
  const spoken = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "spoken",
    generation: spokenClaim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "spoken",
      resolvedEventIds: ["event:spoken"],
      locale: "en",
      delivery: "spoken",
      spokenSummary: "Your search is active.",
      promptMessageId: spokenClaim.promptMessageId,
    },
  });
  expect(spoken.assistantMessageId).toBeUndefined();

  const messages = await f.t.run((ctx) => listMessages(ctx, components.agent, {
    threadId: f.threadId,
    paginationOpts: { cursor: null, numItems: 20 },
  }));
  const orderedMessages = [...messages.page].sort((left, right) =>
    left.order - right.order || left.stepOrder - right.stepOrder);
  expect(orderedMessages.map((message) => ({ role: message.message?.role, text: message.message?.content }))).toEqual([
    { role: "user", text: "Request silent" },
    { role: "assistant", text: "" },
    { role: "user", text: "Request spoken" },
  ]);
  expect(JSON.stringify(messages.page)).not.toContain("responseKind");

  const projected = await f.owner.query(api.scout.listMessages, {
    threadId: f.threadId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  const projectedInOrder = [...projected.page].sort((left, right) =>
    left.order - right.order || left.stepOrder - right.stepOrder);
  expect(projectedInOrder.map((message) => ({ role: message.role, text: message.text }))).toEqual([
    { role: "user", text: "Request silent" },
    { role: "assistant", text: "" },
    { role: "user", text: "Request spoken" },
  ]);
});

it("upserts coalesced Live captions, rejects stale snapshots, and anchors delegation without a duplicate user row", async () => {
  const f = await fixture();
  const created = await f.owner.mutation(recordTranscriptSegment, {
    voiceSessionId: f.voiceSessionId,
    segmentId: "live:user:event-1",
    revision: 1,
    role: "user",
    transcript: "We rehearse",
    sourceEventIds: ["event-1"],
    startMs: 100,
    endMs: 300,
  });
  expect(created.status).toBe("created");
  await expect(f.owner.mutation(recordTranscriptSegment, {
    voiceSessionId: f.voiceSessionId,
    segmentId: "live:user:event-1",
    revision: 2,
    role: "user",
    transcript: "We rehearse on Wednesday.",
    sourceEventIds: ["event-1", "event-2"],
    startMs: 100,
    endMs: 700,
  })).resolves.toEqual({ status: "updated", messageId: created.messageId });
  await expect(f.owner.mutation(recordTranscriptSegment, {
    voiceSessionId: f.voiceSessionId,
    segmentId: "live:user:event-1",
    revision: 1,
    role: "user",
    transcript: "We rehearse",
    sourceEventIds: ["event-1"],
    startMs: 100,
    endMs: 300,
  })).resolves.toEqual({ status: "stale", messageId: created.messageId });

  const claim = await f.t.mutation(claimRequest, {
    ...claimArgs(f, "caption-anchored"),
    transcriptSegmentId: "live:user:event-1",
    eventIds: ["event-1", "event-2"],
    prompt: "We rehearse on Wednesday.",
  });
  expect(claim).toMatchObject({ kind: "accepted", promptMessageId: created.messageId });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");
  const finished = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "caption-anchored",
    generation: claim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "caption-anchored",
      resolvedEventIds: ["event-1", "event-2"],
      locale: "en",
      delivery: "spoken",
      spokenSummary: "Wednesday is saved.",
      promptMessageId: created.messageId,
    },
  });
  expect(finished.assistantMessageId).toBeUndefined();
  await expect(f.owner.mutation(recordTranscriptSegment, {
    voiceSessionId: f.voiceSessionId,
    segmentId: "live:assistant:event-3",
    revision: 1,
    role: "assistant",
    transcript: "What time on Wednesday works?",
    sourceEventIds: ["event-3"],
    startMs: 800,
    endMs: 1_100,
  })).resolves.toMatchObject({ status: "created" });

  const projected = await f.owner.query(api.scout.listMessages, {
    threadId: f.threadId,
    paginationOpts: { cursor: null, numItems: 20 },
  });
  const projectedInOrder = [...projected.page].sort((left, right) =>
    left.order - right.order || left.stepOrder - right.stepOrder);
  expect(projectedInOrder.map((message) => ({
    role: message.role,
    text: message.text,
    source: message.source,
  }))).toEqual([
    { role: "user", text: "We rehearse on Wednesday.", source: "voice_transcript" },
    { role: "assistant", text: "What time on Wednesday works?", source: "voice_transcript" },
  ]);
  const stored = await f.t.run(async (ctx) => ctx.db
    .query("voiceTranscriptEvents")
    .withIndex("by_voice_session_and_provider_event_id", (q) =>
      q.eq("voiceSessionId", f.voiceSessionId).eq("providerEventId", "live:user:event-1"))
    .unique());
  expect(stored).toMatchObject({
    transcript: "We rehearse on Wednesday.",
    sourceEventIds: ["event-1", "event-2"],
    segmentRevision: 2,
    agentMessageId: created.messageId,
  });
});

it("preserves provider delta spacing and keeps assistant context separate", () => {
  expect(composeVoiceInput({
    source: "voice",
    locale: "en",
    fragments: [
      { role: "user", text: "Berlin, Kreuz" },
      { role: "user", text: "berg or Neuk" },
      { role: "user", text: "ölln" },
      { role: "assistant", text: "Would Wednesday " },
      { role: "assistant", text: "work?" },
      { role: "user", text: "Yes, after 7." },
    ],
  })).toEqual({
    userPrompt: "Berlin, Kreuzberg or Neukölln\nYes, after 7.",
    assistantContext: "Would Wednesday work?",
  });
});

it("does not treat an auto-created blank draft as prior musician context", () => {
  expect(hasMeaningfulSavedNeed({
    arrangement: [],
    schedule: [],
    requirements: [],
  })).toBe(false);
  expect(hasMeaningfulSavedNeed({
    locationQuery: "Berlin",
    arrangement: [],
    schedule: [],
    requirements: [],
  })).toBe(true);
});

it("uses the same-turn semantic envelope with action and clarification guards", () => {
  expect(resolveLiveDelivery({
    semantic: { delivery: "silent", responseKind: "routine_update", spokenSummary: "" },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: false,
    requiresClarification: false,
  })).toEqual({ delivery: "silent", status: "completed" });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "clarification", spokenSummary: "What radius around Berlin should I use?" },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: true,
  })).toEqual({
    delivery: "spoken",
    status: "needs_clarification",
    spokenSummary: "What radius around Berlin should I use?",
  });

  expect(resolveLiveDelivery({
    semantic: { delivery: "silent", responseKind: "routine_update", spokenSummary: "" },
    captureFacts: true,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: false,
  })).toEqual({ delivery: "silent", status: "completed" });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "action_result", spokenSummary: "" },
    captureFacts: false,
    hasEndCall: true,
    requiresSpoken: true,
    requiresClarification: false,
  })).toEqual({ delivery: "silent", status: "completed" });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "action_result", spokenSummary: "The budget is updated." },
    captureFacts: false,
    hasEndCall: true,
    requiresSpoken: true,
    requiresClarification: false,
  })).toEqual({ delivery: "spoken", status: "completed", spokenSummary: "The budget is updated." });

  expect(resolveLiveDelivery({
    semantic: {
      delivery: "spoken",
      responseKind: "action_result",
      spokenSummary: "I can't pause it because the search is still a draft.",
    },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: false,
    searchStatus: {
      locale: "en",
      action: "pause",
      result: { status: "paused", changed: true },
    },
  })).toEqual({ delivery: "spoken", status: "completed", spokenSummary: "The search is now paused." });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "action_result", spokenSummary: "stale" },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: false,
    searchStatus: {
      locale: "en",
      action: "pause",
      result: { status: "paused", changed: false },
    },
  })).toEqual({ delivery: "spoken", status: "completed", spokenSummary: "The search is already paused." });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "action_result", spokenSummary: "stale" },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: true,
    searchStatus: {
      locale: "de",
      action: "start",
      result: {
        status: "needs_clarification",
        changed: false,
        clarificationQuestion: "Welchen Umkreis um Berlin soll ich verwenden?",
      },
    },
  })).toEqual({
    delivery: "spoken",
    status: "needs_clarification",
    spokenSummary: "Welchen Umkreis um Berlin soll ich verwenden?",
  });
});

it("preserves the first facts and exact spacing across more than one hundred deltas", () => {
  const transcript = "Berlin, four-piece band, Kreuzberg or Neukölln. " +
    "We need evening access and secure drum storage. ".repeat(8);
  const chunks = Array.from({ length: Math.ceil(transcript.length / 4) }, (_, index) =>
    transcript.slice(index * 4, index * 4 + 4));
  expect(chunks.length).toBeGreaterThan(100);

  const composed = composeVoiceInput({
    source: "voice",
    locale: "en",
    fragments: chunks.map((text) => ({ role: "user" as const, text })),
  });
  expect(composed.userPrompt).toBe(transcript.trim());
  expect(composed.userPrompt.startsWith("Berlin, four-piece band, Kreuzberg or Neukölln.")).toBe(true);
  expect(composed.assistantContext).toBe("");
});

it("claims fact capture without adding a technical message to the Scout thread", async () => {
  const f = await fixture();
  const capture = await f.t.mutation(claimRequest, {
    ...claimArgs(f, "capture"),
    intent: "capture_facts",
    prompt: "Berlin, Kreuzberg or Neukölln",
  });
  expect(capture).toMatchObject({ kind: "accepted" });
  expect("promptMessageId" in capture).toBe(false);
  const messages = await f.t.run((ctx) => listMessages(ctx, components.agent, {
    threadId: f.threadId,
    paginationOpts: { cursor: null, numItems: 20 },
  }));
  expect(messages.page).toHaveLength(0);
});

it("limits quiet fact capture readiness to a draft discovery search", () => {
  expect(captureFactsCapabilities({
    mode: "search_discovery",
    hasActiveNeed: true,
    needStatus: "draft",
  })).toEqual({ updateSearchDraft: true, markSearchBriefReady: true });
  expect(captureFactsCapabilities({
    mode: "search_discovery",
    hasActiveNeed: true,
    needStatus: "active",
  })).toEqual({ updateSearchDraft: true, markSearchBriefReady: false });
  expect(captureFactsCapabilities({
    mode: "signal_advisor",
    hasActiveNeed: true,
    needStatus: "draft",
  })).toEqual({ updateSearchDraft: true, markSearchBriefReady: false });
  expect(captureFactsCapabilities({
    mode: "search_discovery",
    hasActiveNeed: false,
  })).toEqual({ updateSearchDraft: false, markSearchBriefReady: false });
});

it("retains request tombstones after the bounded result cache evicts them", async () => {
  const f = await fixture();
  for (let index = 0; index < 9; index += 1) {
    const requestId = `request-${index}`;
    const claim = await f.t.mutation(claimRequest, claimArgs(f, requestId));
    expect(claim.kind).toBe("accepted");
    if (claim.kind !== "accepted") throw new Error("claim not accepted");
    await f.t.mutation(finishRequest, {
      ownerId: f.ownerId,
      voiceSessionId: f.voiceSessionId,
      requestId,
      generation: claim.generation,
      expectedLocale: "en",
      result: { status: "completed", requestId, resolvedEventIds: [`event:${requestId}`], locale: "en", promptMessageId: claim.promptMessageId },
    });
  }

  const oldReplay = await f.t.mutation(claimRequest, claimArgs(f, "request-0"));
  expect(oldReplay).toMatchObject({ kind: "result", result: { status: "outcome_unknown", requestId: "request-0", resolvedEventIds: [] } });
  const stored = await f.t.run((ctx) => ctx.db.get(f.voiceSessionId));
  expect(stored?.requestTombstones).toHaveLength(9);
  expect(stored?.recentResults).toHaveLength(8);
});

it("allows independent UI and voice fields but rejects a stale overlapping voice patch", async () => {
  const f = await fixture();
  const claim = await f.t.mutation(claimRequest, claimArgs(f, "edit"));
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  await f.owner.mutation(api.savedNeeds.update, {
    needId: f.needId,
    expectedRevision: 0,
    schedule: ["Wednesday"],
  });
  await expect(f.owner.mutation(api.savedNeeds.update, {
    needId: f.needId,
    expectedRevision: 0,
    maxBudgetEur: 300,
  })).rejects.toThrow(/NEED_REVISION_CONFLICT/);

  const voiceClaim = { voiceSessionId: f.voiceSessionId, requestId: "edit", generation: claim.generation };
  await expect(f.t.mutation(updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    maxBudgetEur: 300,
    voiceClaim,
  })).resolves.toMatchObject({ revision: 2, changedFields: ["maxBudgetEur"] });
  await expect(f.t.mutation(updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    maxBudgetEur: 320,
    voiceClaim,
  })).resolves.toMatchObject({ revision: 3, changedFields: ["maxBudgetEur"] });
  await expect(f.t.mutation(updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    maxBudgetEur: 320,
    voiceClaim,
  })).resolves.toEqual({ revision: 3, changedFields: [] });
  await expect(f.t.mutation(updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    schedule: ["Thursday"],
    voiceClaim,
  })).rejects.toThrow(/VOICE_FIELD_CONFLICT/);
});

it("persists explicit EN/DE changes and suppresses a result in the old language", async () => {
  const f = await fixture();
  expect(await f.owner.query(getConfig, {})).toMatchObject({ locale: "en" });
  const claim = await f.t.mutation(claimRequest, claimArgs(f, "language"));
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  expect(await f.owner.mutation(setLanguage, { voiceSessionId: f.voiceSessionId, locale: "de" }))
    .toEqual({ locale: "de", languageRevision: 1 });
  expect(await f.owner.query(getConfig, {})).toMatchObject({ locale: "de" });
  const result = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "language",
    generation: claim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "language",
      resolvedEventIds: ["event:language"],
      locale: "en",
      spokenSummary: "Saved in English",
      endCall: { reason: "farewell", farewell: "Bye for now!" },
    },
  });
  expect(result).toMatchObject({ status: "superseded", locale: "de" });
  expect(result.spokenSummary).toBeUndefined();
  expect(result.endCall).toBeUndefined();
});

it("preserves a spoken answer in the new locale after the claimed language tool changes it", async () => {
  const f = await fixture();
  const claim = await f.t.mutation(claimRequest, claimArgs(f, "spoken-language"));
  if (claim.kind !== "accepted") throw new Error("claim not accepted");
  expect(await f.t.mutation(setLanguageFromClaim, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "spoken-language",
    generation: claim.generation,
    locale: "de",
  })).toEqual({ locale: "de", languageRevision: 1 });
  const result = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "spoken-language",
    generation: claim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "spoken-language",
      resolvedEventIds: ["event:spoken-language"],
      locale: "en",
      delivery: "spoken",
      spokenSummary: "Der Lagerwunsch ist gespeichert; ob das Schlagzeug dort bleiben kann, muss für den ausgewählten Raum geprüft werden.",
      changedFields: ["conversationLocale"],
    },
  });
  expect(result).toMatchObject({
    status: "completed",
    locale: "de",
    resolvedEventIds: ["event:spoken-language"],
    changedFields: ["conversationLocale"],
    delivery: "spoken",
    spokenSummary: "Der Lagerwunsch ist gespeichert; ob das Schlagzeug dort bleiben kann, muss für den ausgewählten Raum geprüft werden.",
  });
  expect(result.assistantMessageId).toBeUndefined();
});

it("denies a binding decision even when it was explicitly bound to the claim", async () => {
  const f = await fixture();
  const decisionId = await f.t.run((ctx) => ctx.db.insert("decisions", {
    ownerId: f.ownerId,
    savedNeedId: f.needId,
    kind: "review_message",
    status: "open",
    question: "Send this message?",
    options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
    refs: {},
    createdAt: 2_000,
    updatedAt: 2_000,
  }));
  const claim = await f.t.mutation(claimRequest, { ...claimArgs(f, "binding"), decisionId });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "binding",
    generation: claim.generation,
    decisionId,
    choice: "yes",
  })).rejects.toThrow(/VOICE_DECISION_SUPERSEDED/);
  const decision = await f.t.run((ctx) => ctx.db.get(decisionId));
  expect(decision?.status).toBe("open");
});

it("fences a claimed write after focus changes", async () => {
  const f = await fixture();
  const claim = await f.t.mutation(claimRequest, {
    ...claimArgs(f, "focus"),
    focusedSignalId: f.firstSignalId,
  });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");
  await f.t.run(async (ctx) => {
    const context = await ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", f.ownerId)).unique();
    if (!context) throw new Error("missing context");
    await ctx.db.patch(context._id, { focusedSignalId: f.secondSignalId });
  });

  await expect(f.t.mutation(updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    maxBudgetEur: 300,
    voiceClaim: { voiceSessionId: f.voiceSessionId, requestId: "focus", generation: claim.generation },
  })).rejects.toThrow(/VOICE_TARGET_SUPERSEDED/);
  const reconciled = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "focus",
    generation: claim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "focus",
      resolvedEventIds: ["event:focus"],
      locale: "en",
      spokenSummary: "Goodbye.",
      endCall: { reason: "farewell", farewell: "Bye for now!" },
    },
  });
  expect(reconciled).toMatchObject({ status: "superseded" });
  expect(reconciled.spokenSummary).toBeUndefined();
  expect(reconciled.endCall).toBeUndefined();
});

it("syncs candidate focus into the Live session before an advisor claim can pause and update the current search", async () => {
  const f = await fixture();
  await f.owner.mutation(api.scout.setFocus, {
    threadId: f.threadId,
    mode: "signal_advisor",
    activeNeedId: f.needId,
    focusedSignalId: f.firstSignalId,
  });
  const focused = await f.t.run(async (ctx) => ({
    context: await ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", f.ownerId)).unique(),
    session: await ctx.db.get(f.voiceSessionId),
  }));
  expect(focused.context).toMatchObject({ mode: "signal_advisor", focusedSignalId: f.firstSignalId });
  expect(focused.session?.focusedSignalId).toBe(f.firstSignalId);

  const claim = await f.t.mutation(claimRequest, {
    ...claimArgs(f, "advisor-global-search"),
    focusedSignalId: f.firstSignalId,
  });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");
  const voiceClaim = {
    voiceSessionId: f.voiceSessionId,
    requestId: "advisor-global-search",
    generation: claim.generation,
  };
  await expect(f.t.mutation(changeNeedStatus, {
    ownerId: f.ownerId,
    ...voiceClaim,
    action: "pause",
  })).resolves.toMatchObject({ status: "paused" });
  await expect(f.t.mutation(updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    schedule: ["Tuesday evening"],
    voiceClaim,
  })).resolves.toMatchObject({ changedFields: ["schedule"] });
  expect(await f.t.run((ctx) => ctx.db.get(f.needId))).toMatchObject({
    status: "paused",
    schedule: ["Tuesday evening"],
  });
});

it("returns a readable missing-radius clarification instead of failing a claimed voice start", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.needId, { radiusKm: undefined }));
  const claim = await f.t.mutation(claimRequest, claimArgs(f, "start-needs-radius"));
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  await expect(f.t.mutation(changeNeedStatus, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "start-needs-radius",
    generation: claim.generation,
    action: "start",
  })).resolves.toEqual({
    status: "needs_clarification",
    revision: 0,
    changed: false,
    missingFields: ["radiusKm"],
    clarificationQuestion: "What radius around Berlin should I use?",
  });
  expect((await f.t.run((ctx) => ctx.db.get(f.needId)))?.status).toBe("draft");
});

it("records Live call closure idempotently for its owner without changing the active search", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.needId, { status: "active", matchingRevision: 7 }));
  const otherOwnerId = await f.t.run((ctx) => ctx.db.insert("users", {
    username: "other-live-owner",
    role: "musician",
    createdAt: 1_000,
    lastSeenAt: 1_000,
  }));
  const other = f.t.withIdentity({ subject: otherOwnerId });

  await expect(other.mutation(api.voice.endMine, { voiceSessionId: f.voiceSessionId }))
    .rejects.toThrow(/VOICE_SESSION_NOT_FOUND/);
  await expect(f.owner.mutation(api.voice.endMine, { voiceSessionId: f.voiceSessionId }))
    .resolves.toBeNull();
  await expect(f.owner.mutation(api.voice.endMine, { voiceSessionId: f.voiceSessionId }))
    .resolves.toBeNull();

  expect(await f.t.run((ctx) => ctx.db.get(f.voiceSessionId))).toMatchObject({
    status: "ended",
  });
  expect(await f.t.run((ctx) => ctx.db.get(f.needId))).toMatchObject({
    status: "active",
    matchingRevision: 7,
  });
});

it("allows published deep-link focus but rejects a stale signal without an owned conversation", async () => {
  const published = await fixture();
  await expect(published.owner.mutation(api.scout.setFocus, {
    threadId: published.threadId,
    mode: "signal_advisor",
    activeNeedId: published.needId,
    focusedSignalId: published.secondSignalId,
  })).resolves.toBeNull();
  await expect(published.owner.mutation(api.scout.setFocus, {
    threadId: published.threadId,
    mode: "search_discovery",
    activeNeedId: published.needId,
  })).resolves.toBeNull();
  const cleared = await published.t.run(async (ctx) => ({
    context: await ctx.db.query("scoutContexts").withIndex("by_owner", (q) => q.eq("ownerId", published.ownerId)).unique(),
    session: await ctx.db.get(published.voiceSessionId),
  }));
  expect(cleared.context?.focusedSignalId).toBeUndefined();
  expect(cleared.session?.focusedSignalId).toBeUndefined();

  const stale = await fixture();
  await stale.t.run((ctx) => ctx.db.patch(stale.secondSignalId, { status: "stale" }));
  await expect(stale.owner.mutation(api.scout.setFocus, {
    threadId: stale.threadId,
    mode: "signal_advisor",
    activeNeedId: stale.needId,
    focusedSignalId: stale.secondSignalId,
  })).rejects.toThrow(/SIGNAL_NOT_FOUND/);
  expect(await stale.t.run((ctx) => ctx.db.get(stale.voiceSessionId))).toMatchObject({
    focusedSignalId: stale.firstSignalId,
  });
});

it("allows a stale candidate only when its nonclosed provider conversation belongs to the active need", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.firstSignalId, { status: "stale" });
    await ctx.db.insert("providerConversations", {
      ownerId: f.ownerId,
      conversationKey: "voice-focus-owned",
      savedNeedId: f.needId,
      signalId: f.firstSignalId,
      agentThreadId: "voice-focus-owned-thread",
      revision: 0,
      state: "waiting",
      createdAt: 2_000,
      updatedAt: 2_000,
    });
  });
  await expect(f.owner.mutation(api.scout.setFocus, {
    threadId: f.threadId,
    mode: "signal_advisor",
    activeNeedId: f.needId,
    focusedSignalId: f.firstSignalId,
  })).resolves.toBeNull();
  expect(await f.t.run((ctx) => ctx.db.get(f.voiceSessionId))).toMatchObject({
    focusedSignalId: f.firstSignalId,
  });
});

it("lets an accepted claim finish after audio ends and never reruns an uncertain partial result", async () => {
  const f = await fixture();
  const claim = await f.t.mutation(claimRequest, claimArgs(f, "partial"));
  if (claim.kind !== "accepted") throw new Error("claim not accepted");
  await f.t.run(async (ctx) => ctx.db.patch(f.voiceSessionId, { status: "ended", endedAt: 2_000 }));
  const voiceClaim = { voiceSessionId: f.voiceSessionId, requestId: "partial", generation: claim.generation };
  await f.t.mutation(updateFromScout, { ownerId: f.ownerId, needId: f.needId, maxBudgetEur: 300, voiceClaim });
  const terminal: Result = {
    status: "outcome_unknown",
    requestId: "partial",
    resolvedEventIds: [],
    locale: "en",
    promptMessageId: claim.promptMessageId,
  };
  await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "partial",
    generation: claim.generation,
    expectedLocale: "en",
    result: terminal,
  });
  expect(await f.t.mutation(claimRequest, claimArgs(f, "partial"))).toEqual({ kind: "result", result: terminal });
  const need = await f.t.run((ctx) => ctx.db.get(f.needId));
  expect(need).toMatchObject({ maxBudgetEur: 300, matchingRevision: 1 });
});
