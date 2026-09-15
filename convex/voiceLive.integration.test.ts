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
import { composeVoiceInput } from "./voiceLive";

const modules = import.meta.glob("./**/*.ts");

type ClaimArgs = {
  ownerId: Id<"users">;
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  fingerprint: string;
  source: "voice" | "text";
  intent?: "capture_facts";
  delegationId?: string;
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
  spokenSummary?: string;
  changedFields?: string[];
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
    },
  });
  expect(result).toMatchObject({ status: "superseded", locale: "de" });
  expect(result.spokenSummary).toBeUndefined();
});

it("returns the new locale when the claimed language tool made the change", async () => {
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
      spokenSummary: "Now speaking German",
      changedFields: ["conversationLocale"],
    },
  });
  expect(result).toMatchObject({
    status: "completed",
    locale: "de",
    resolvedEventIds: ["event:spoken-language"],
    changedFields: ["conversationLocale"],
  });
  expect(result.spokenSummary).toBeUndefined();
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
