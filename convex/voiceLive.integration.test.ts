/// <reference types="vite/client" />
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { listMessages } from "@convex-dev/agent";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { ConvexError } from "convex/values";
import { expect, it } from "vitest";
import { api, components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { scoutAgent } from "./scoutRuntime";
import {
  captureFactsCapabilities,
  composeVoiceInput,
  failureSpokenSummary,
  hasMeaningfulSavedNeed,
  resolveLiveDelivery,
} from "./voiceLive";

const modules = import.meta.glob("./**/*.ts");

it("routes only the authenticated Live session surface with exact-origin CORS", async () => {
  const t = convexTest(schema, modules);
  const allowed = await t.fetch("/api/live/session", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:5173" },
  });
  expect(allowed.status).toBe(204);
  expect(allowed.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  expect(allowed.headers.get("access-control-expose-headers"))
    .toContain("X-RoomScout-Voice-Session");

  const rejectedOrigin = await t.fetch("/api/live/session", {
    method: "OPTIONS",
    headers: { Origin: "https://not-roomscout.example" },
  });
  expect(rejectedOrigin.status).toBe(403);

  const unauthenticated = await t.fetch("/api/live/session", {
    method: "POST",
    headers: {
      Origin: "http://localhost:5173",
      "Content-Type": "application/sdp",
    },
    body: "v=0\r\n",
  });
  expect(unauthenticated.status).toBe(401);

  const removedRealtime = await t.fetch("/api/realtime/session", {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: "v=0\r\n",
  });
  expect(removedRealtime.status).toBe(404);
});

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
  responseKind?: "routine_update" | "answer" | "clarification" | "action_result" | "decision_result";
  spokenSummary?: string;
  changedFields?: string[];
  verifiedFacts?: string[];
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
  questionId?: string;
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
  // A voice "custom" on a message decision enqueues the provider re-draft turn.
  workpoolTest.register(t, "scoutWorkpool");
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

it("includes the confirmed musician identity in Live context without private surname or login", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.ownerId, {
    username: "private-login",
    firstName: "Alex",
    lastName: "Private-Surname",
    actKind: "band",
    actName: "Neon Harbour",
    providerIdentityConfirmedAt: 1,
  }));

  const bootstrap = await f.t.query(internal.voiceLive.getSessionBootstrap, { ownerId: f.ownerId });

  expect(bootstrap?.discoveryContext).toContain('"firstName":"Alex"');
  expect(bootstrap?.discoveryContext).toContain('"representedName":"Neon Harbour"');
  expect(bootstrap?.discoveryContext).toContain('"actKind":"band"');
  expect(bootstrap?.discoveryContext).toContain("already confirmed");
  expect(bootstrap?.discoveryContext).not.toContain("Private-Surname");
  expect(bootstrap?.discoveryContext).not.toContain("private-login");
});

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

  // Source projection is an existence check, not a uniqueness boundary. A
  // duplicate historical marker must not make the whole Scout thread fail.
  await f.t.run(async (ctx) => {
    await ctx.db.insert("voiceTranscriptEvents", {
      ownerId: f.ownerId,
      voiceSessionId: f.voiceSessionId,
      providerEventId: "duplicate:user:event-1",
      role: "user",
      transcript: "We rehearse on Wednesday.",
      agentMessageId: created.messageId,
      finalizedAt: 1_200,
    });
  });

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
  })).toEqual({ delivery: "silent", status: "completed", responseKind: "routine_update" });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "clarification", spokenSummary: "What radius around Berlin should I use?" },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: true,
  })).toEqual({
    delivery: "spoken",
    status: "needs_clarification",
    responseKind: "clarification",
    spokenSummary: "What radius around Berlin should I use?",
  });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "answer", spokenSummary: "Modul Ost confirmed Tuesday evenings." },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: false,
    requiresClarification: false,
  })).toEqual({
    delivery: "spoken",
    status: "completed",
    responseKind: "answer",
    spokenSummary: "Modul Ost confirmed Tuesday evenings.",
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
  })).toEqual({ delivery: "spoken", status: "completed", responseKind: "action_result", spokenSummary: "The budget is updated." });

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
  })).toEqual({ delivery: "spoken", status: "completed", responseKind: "action_result", spokenSummary: "The search is now paused." });

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
  })).toEqual({ delivery: "spoken", status: "completed", responseKind: "action_result", spokenSummary: "The search is already paused." });

  // A verified decision effect outranks the model's own label: the client
  // would drop a late routine_update, silencing the confirmation.
  expect(resolveLiveDelivery({
    semantic: { delivery: "silent", responseKind: "routine_update", spokenSummary: "I'll take that as your answer for Modul Ost." },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: false,
    spokenEffectKinds: ["decision"],
  })).toEqual({
    delivery: "spoken",
    status: "completed",
    responseKind: "decision_result",
    spokenSummary: "I'll take that as your answer for Modul Ost.",
  });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "answer", spokenSummary: "Noted for Modul Ost; they asked about the drum kit next." },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: false,
    spokenEffectKinds: ["decision"],
  })).toMatchObject({ responseKind: "answer" });

  expect(resolveLiveDelivery({
    semantic: { delivery: "silent", responseKind: "routine_update", spokenSummary: "Raum West is open." },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: true,
    requiresClarification: false,
    spokenEffectKinds: ["candidate"],
  })).toMatchObject({ delivery: "spoken", responseKind: "action_result" });

  expect(resolveLiveDelivery({
    semantic: { delivery: "spoken", responseKind: "routine_update", spokenSummary: "The budget is saved." },
    captureFacts: false,
    hasEndCall: false,
    requiresSpoken: false,
    requiresClarification: false,
    spokenEffectKinds: [],
  })).toMatchObject({ responseKind: "routine_update" });

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
    responseKind: "clarification",
    spokenSummary: "Welchen Umkreis um Berlin soll ich verwenden?",
  });
});

it("names the failure category honestly instead of a generic apology", () => {
  const named = (name: string, message = name) => Object.assign(new Error(message), { name });
  expect(failureSpokenSummary("en", named("AI_NoOutputGeneratedError", "No output generated.")))
    .toBe("I couldn't get that from the backend just now, the answer came back in a form I couldn't hand over. The panel shows the current status, or ask me once more.");
  expect(failureSpokenSummary("en", new Error("No object generated: response did not match schema.")))
    .toContain("in a form I couldn't hand over");
  expect(failureSpokenSummary("en", new Error("VOICE_ENVELOPE_MISSING"))).toContain("in a form I couldn't hand over");
  expect(failureSpokenSummary("en", named("TimeoutError", "The operation was aborted due to timeout")))
    .toBe("I couldn't get that from the backend just now, it took too long. The panel shows the current status, or ask me once more.");
  expect(failureSpokenSummary("en", named("AbortError", "This operation was aborted"))).toContain("it took too long");
  expect(failureSpokenSummary("en", new ConvexError({ code: "NEED_NOT_FOUND" })))
    .toBe("I couldn't get that from the backend just now, something changed underneath. The panel shows the current status, or ask me once more.");
  expect(failureSpokenSummary("en", new Error("boom")))
    .toBe("I couldn't get that from the backend just now, an error stopped it. The panel shows the current status, or ask me once more.");
  expect(failureSpokenSummary("de", new Error("boom")))
    .toBe("Das konnte ich gerade nicht vom Backend bekommen, ein Fehler hat es gestoppt. Das Panel zeigt den aktuellen Stand, oder frag mich noch einmal.");
  expect(failureSpokenSummary("de", named("AI_NoObjectGeneratedError", "No object generated")))
    .toContain("in einer Form zurück, die ich nicht weitergeben konnte");
  for (const error of [new Error("boom"), named("TimeoutError"), new ConvexError({ code: "X" })]) {
    expect(failureSpokenSummary("en", error)).not.toMatch(/sent|saved|started/);
  }

  // outcome_unknown: a write may have landed and the client blocks the next
  // turn, so this sentence must not invite a repeat the app would refuse.
  expect(failureSpokenSummary("en", named("TimeoutError", "The operation was aborted due to timeout"), true))
    .toBe("I can't tell yet whether that last step went through, it took too long. It is still being checked; the panel shows the current status, so please look there before repeating it.");
  expect(failureSpokenSummary("de", new Error("boom"), true))
    .toBe("Ich kann noch nicht sagen, ob der letzte Schritt durchgegangen ist, ein Fehler hat es gestoppt. Das wird gerade geprüft; das Panel zeigt den aktuellen Stand, schau bitte dort nach, bevor du es wiederholst.");
  for (const locale of ["en", "de"] as const) {
    expect(failureSpokenSummary(locale, new Error("boom"), true)).not.toMatch(/ask me once more|frag mich noch einmal/);
    expect(failureSpokenSummary(locale, new Error("boom"), true)).not.toMatch(/sent|saved|started|gesendet|gespeichert/);
  }
});

it("keeps responseKind through finishRequest, the cached replay and the session state", async () => {
  const f = await fixture();
  const claim = await f.t.mutation(claimRequest, claimArgs(f, "status-answer"));
  if (claim.kind !== "accepted") throw new Error("claim not accepted");
  const result = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "status-answer",
    generation: claim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "status-answer",
      resolvedEventIds: ["event:status-answer"],
      locale: "en",
      promptMessageId: claim.promptMessageId,
      delivery: "spoken",
      responseKind: "answer",
      spokenSummary: "First room: the provider confirmed Tuesday evenings.",
    },
  });
  expect(result).toMatchObject({ status: "completed", delivery: "spoken", responseKind: "answer" });
  expect(await f.t.mutation(claimRequest, claimArgs(f, "status-answer"))).toMatchObject({
    kind: "result",
    result: { status: "completed", responseKind: "answer", spokenSummary: "First room: the provider confirmed Tuesday evenings." },
  });
  const state = await f.owner.query(api.voiceLive.getSessionState, { voiceSessionId: f.voiceSessionId });
  expect(state.lastResult).toMatchObject({ requestId: "status-answer", responseKind: "answer" });
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
  expect(await f.owner.query(getConfig, {})).toEqual({ locale: "en" });
  const claim = await f.t.mutation(claimRequest, claimArgs(f, "language"));
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  expect(await f.owner.mutation(setLanguage, { voiceSessionId: f.voiceSessionId, locale: "de" }))
    .toEqual({ locale: "de", languageRevision: 1 });
  expect(await f.owner.query(getConfig, {})).toEqual({ locale: "de" });
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

/** A Freigabeprüfung decision on a drafted provider message, with the request it guards. */
async function reviewMessageDecision(f: Awaited<ReturnType<typeof fixture>>) {
  return await f.t.run(async (ctx) => {
    const conversationId = await ctx.db.insert("providerConversations", {
      ownerId: f.ownerId,
      conversationKey: "voice-review",
      savedNeedId: f.needId,
      signalId: f.firstSignalId,
      agentThreadId: "voice-review-thread",
      revision: 1,
      state: "needs_attention",
      createdAt: 2_000,
      updatedAt: 2_000,
    });
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId: f.ownerId,
      savedNeedId: f.needId,
      providerConversationId: conversationId,
      automationMode: "exact_once",
      requestedActionType: "send_email",
      personalDataScopes: [],
      payload: { kind: "email_message", recipientName: "Provider", recipientEmail: "provider@example.test", subject: "Room", body: "Is the room still available?" },
      contentVersion: 1,
      contentHash: "voice-review-hash",
      status: "awaiting_approval",
      gate: { outcome: "ask_user", reason: "review_mode", autonomyVersion: 1, autonomyHash: "hash", decidedAt: 2_000 },
      createdAt: 2_000,
      updatedAt: 2_000,
    });
    const decisionId = await ctx.db.insert("decisions", {
      ownerId: f.ownerId,
      savedNeedId: f.needId,
      conversationId,
      kind: "review_message",
      status: "open",
      question: "Send this message?",
      options: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }],
      refs: { requestId },
      createdAt: 2_000,
      updatedAt: 2_000,
    });
    return { conversationId, requestId, decisionId };
  });
}

it("keeps sending UI-only: a bound message decision refuses yes from voice as VOICE_DECISION_UI_ONLY", async () => {
  const f = await fixture();
  const { decisionId, requestId } = await reviewMessageDecision(f);
  const claim = await f.t.mutation(claimRequest, { ...claimArgs(f, "binding"), decisionId });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "binding",
    generation: claim.generation,
    decisionId,
    choice: "yes",
  })).rejects.toThrow(/VOICE_DECISION_UI_ONLY/);
  expect(await f.t.run((ctx) => ctx.db.get(decisionId))).toMatchObject({ status: "open" });
  expect(await f.t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "awaiting_approval" });
  expect(await f.t.run((ctx) => ctx.db.query("actionApprovals").collect())).toEqual([]);
});

it("lets voice say no to a message decision: the request is rejected and nothing is dispatched", async () => {
  const f = await fixture();
  const { decisionId, requestId } = await reviewMessageDecision(f);
  const claim = await f.t.mutation(claimRequest, { ...claimArgs(f, "voice-no"), decisionId });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "voice-no",
    generation: claim.generation,
    decisionId,
    choice: "no",
  })).resolves.toMatchObject({ status: "answered", action: "rejected", requestId });
  expect(await f.t.run((ctx) => ctx.db.get(decisionId))).toMatchObject({ status: "answered", answer: { choice: "no" } });
  expect(await f.t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "rejected" });
  expect(await f.t.run((ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("providerTurns").collect())).toEqual([]);
});

it("lets voice give a wording instruction: the draft is withdrawn and re-drafted through the Freigabeprüfung, nothing is sent", async () => {
  const f = await fixture();
  const { decisionId, requestId, conversationId } = await reviewMessageDecision(f);
  const claim = await f.t.mutation(claimRequest, { ...claimArgs(f, "voice-custom"), decisionId });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");

  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "voice-custom",
    generation: claim.generation,
    decisionId,
    choice: "custom",
    text: "Please also ask about the deposit.",
  })).resolves.toMatchObject({ status: "answered", action: "reassessing", requestId, sent: false });
  expect(await f.t.run((ctx) => ctx.db.get(requestId))).toMatchObject({ status: "rejected" });
  expect(await f.t.run((ctx) => ctx.db.query("actionRequests").collect())).toHaveLength(1);
  const turns = await f.t.run((ctx) => ctx.db.query("providerTurns").collect());
  expect(turns).toContainEqual(expect.objectContaining({ conversationId, kind: "musician_input", decisionId }));
});

it("lets voice decline a ready offer but keeps the offer review in the app", async () => {
  const f = await fixture();
  const offerDecision = () => f.t.run((ctx) => ctx.db.insert("decisions", {
    ownerId: f.ownerId,
    savedNeedId: f.needId,
    kind: "offer_ready",
    status: "open",
    question: "An offer is ready. Review it?",
    options: [{ id: "review", label: "Review the offer" }, { id: "no", label: "Not this one" }],
    refs: {},
    createdAt: 2_000,
    updatedAt: 2_000,
  }));
  const reviewId = await offerDecision();
  const first = await f.t.mutation(claimRequest, { ...claimArgs(f, "offer-review"), decisionId: reviewId });
  if (first.kind !== "accepted") throw new Error("claim not accepted");
  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "offer-review",
    generation: first.generation,
    decisionId: reviewId,
    choice: "review",
  })).rejects.toThrow(/VOICE_DECISION_UI_ONLY/);
  expect(await f.t.run((ctx) => ctx.db.get(reviewId))).toMatchObject({ status: "open" });
  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "offer-review",
    generation: first.generation,
    decisionId: reviewId,
    choice: "no",
    text: "Too far out.",
  })).resolves.toMatchObject({ status: "answered", action: "declined" });
  expect(await f.t.run((ctx) => ctx.db.get(reviewId))).toMatchObject({ status: "answered", answer: { choice: "no", text: "Too far out." } });
});

it("returns the next decision question and accepts it only under a fresh voice claim", async () => {
  const f = await fixture();
  const decisionId = await f.t.run((ctx) => ctx.db.insert("decisions", {
    ownerId: f.ownerId,
    savedNeedId: f.needId,
    kind: "scout_question",
    status: "open",
    question: "Does Wednesday work?",
    options: [{ id: "yes", label: "Yes, Wednesday works" }],
    questions: [
      {
        id: "schedule",
        constraintKeys: ["schedule"],
        question: "Does Wednesday work?",
        options: [{ id: "yes", label: "Yes, Wednesday works" }],
      },
      {
        id: "equipment",
        constraintKeys: ["requirement:0"],
        question: "Would an electronic drum kit work?",
        options: [{ id: "no", label: "No, acoustic drums are required" }],
      },
    ],
    refs: {},
    createdAt: 2_000,
    updatedAt: 2_000,
  }));
  const first = await f.t.mutation(claimRequest, { ...claimArgs(f, "round-one"), decisionId });
  if (first.kind !== "accepted") throw new Error("first claim not accepted");

  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "round-one",
    generation: first.generation,
    decisionId,
    questionId: "schedule",
    choice: "yes",
  })).resolves.toMatchObject({
    status: "open",
    action: "awaiting_answers",
    nextQuestionId: "equipment",
    nextQuestion: "Would an electronic drum kit work?",
  });

  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "round-one",
    generation: first.generation,
    decisionId,
    questionId: "equipment",
    choice: "no",
  })).rejects.toThrow(/VOICE_DECISION_SUPERSEDED/);

  await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "round-one",
    generation: first.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "round-one",
      resolvedEventIds: [],
      locale: "en",
      delivery: "spoken",
      spokenSummary: "I still need your equipment answer.",
      changedFields: ["decision"],
      verifiedFacts: ["decision.status=open", "decision.action=awaiting_answers"],
    },
  });
  const second = await f.t.mutation(claimRequest, { ...claimArgs(f, "round-two"), decisionId });
  if (second.kind !== "accepted") throw new Error("second claim not accepted");
  await expect(f.t.mutation(answerNonbindingFromVoice, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "round-two",
    generation: second.generation,
    decisionId,
    questionId: "equipment",
    choice: "no",
  })).resolves.toMatchObject({ status: "answered" });
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

it.each([false, true])("keeps the claim valid after the Scout opens a room by voice (claim carries focus: %s)", async (withFocus) => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.insert("providerConversations", {
    ownerId: f.ownerId,
    conversationKey: "voice-open-second",
    savedNeedId: f.needId,
    signalId: f.secondSignalId,
    agentThreadId: "voice-open-second-thread",
    revision: 0,
    state: "waiting",
    createdAt: 2_000,
    updatedAt: 2_000,
  }));
  const claim = await f.t.mutation(claimRequest, {
    ...claimArgs(f, "open-room"),
    ...(withFocus ? { focusedSignalId: f.firstSignalId } : {}),
  });
  if (claim.kind !== "accepted") throw new Error("claim not accepted");
  const voiceClaim = { voiceSessionId: f.voiceSessionId, requestId: "open-room", generation: claim.generation };

  await expect(f.t.mutation(internal.scoutCandidates.open, {
    ownerId: f.ownerId, threadId: f.threadId, savedNeedId: f.needId, signalId: f.secondSignalId, voiceClaim,
  })).resolves.toMatchObject({ opened: true, signalId: f.secondSignalId });
  expect(await f.t.run((ctx) => ctx.db.get(f.voiceSessionId))).toMatchObject({
    focusedSignalId: f.secondSignalId,
    activeClaim: { requestId: "open-room", focusedSignalId: f.secondSignalId },
  });
  // A later claimed write in the same turn still passes the fence.
  await expect(f.t.mutation(updateFromScout, {
    ownerId: f.ownerId, needId: f.needId, schedule: ["Tuesday evening"], voiceClaim,
  })).resolves.toMatchObject({ changedFields: ["schedule"] });

  const result = await f.t.mutation(finishRequest, {
    ownerId: f.ownerId,
    voiceSessionId: f.voiceSessionId,
    requestId: "open-room",
    generation: claim.generation,
    expectedLocale: "en",
    result: {
      status: "completed",
      requestId: "open-room",
      resolvedEventIds: ["event:open-room"],
      locale: "en",
      delivery: "spoken",
      responseKind: "answer",
      spokenSummary: "Second room is open; the provider has not replied yet.",
    },
  });
  expect(result).toMatchObject({ status: "completed", delivery: "spoken", spokenSummary: "Second room is open; the provider has not replied yet." });
  // The next turn, now about the opened room, is accepted instead of refused as superseded.
  const next = await f.t.mutation(claimRequest, { ...claimArgs(f, "after-open"), focusedSignalId: f.secondSignalId });
  expect(next.kind).toBe("accepted");
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


it("returns the Live-only session contract while keeping historical rows readable", async () => {
  const f = await fixture();
  for (const provider of [undefined, "realtime", "live"] as const) {
    await f.t.run(async (ctx) => { await ctx.db.patch(f.voiceSessionId, { provider }); });
    const state = await f.owner.query(api.voiceLive.getSessionState, { voiceSessionId: f.voiceSessionId });
    expect(state.voiceSessionId).toBe(f.voiceSessionId);
    expect(state.locale).toBe("en");
    expect(state).not.toHaveProperty("provider");
  }
  await f.owner.mutation(api.voice.endMine, { voiceSessionId: f.voiceSessionId });
  expect((await f.owner.query(api.voiceLive.getSessionState, { voiceSessionId: f.voiceSessionId })).status).toBe("ended");
});
