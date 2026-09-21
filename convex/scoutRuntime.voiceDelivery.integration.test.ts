/// <reference types="vite/client" />
import agentTest from "@convex-dev/agent/test";
import { convexTest } from "convex-test";
import { NoOutputGeneratedError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { readVoiceTurnEnvelope, scoutAgent, VOICE_TURN_STEP_BUDGET } from "./scoutRuntime";

const modules = import.meta.glob("./**/*.ts");
const originalModel = scoutAgent.options.languageModel;
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 10, text: 10, reasoning: 0 } };

beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", ""); });
afterEach(() => { scoutAgent.options.languageModel = originalModel; vi.unstubAllEnvs(); });

/** The real delegate path (claim, action context, Agent tool loop, finishRequest) with only the model replaced. */
async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  const data = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", {
      username: "voice-delivery-owner", role: "musician", conversationLocale: "en", createdAt: now, lastSeenAt: now,
    });
    const needId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Band room", city: "Berlin", locationQuery: "Berlin", locationLabel: "Berlin", radiusKm: 10,
      arrangement: [], schedule: [], requirements: [], status: "active", matchingRevision: 1, createdAt: now, updatedAt: now,
    });
    const { threadId } = await scoutAgent.createThread(ctx, { userId: ownerId, title: "Voice delivery test" });
    await ctx.db.insert("scoutContexts", { ownerId, threadId, activeNeedId: needId, mode: "search_discovery", updatedAt: now });
    const voiceSessionId = await ctx.db.insert("voiceSessions", {
      ownerId, threadId, model: "gpt-live-1", voice: "marin", provider: "live", providerSessionId: "live_delivery_test",
      conversationLocale: "en", languageRevision: 0, claimGeneration: 0, requestTombstones: [], recentResults: [],
      status: "active", activeNeedId: needId, startedAt: now, updatedAt: now,
    });
    return { ownerId, needId, threadId, voiceSessionId };
  });
  return { t, owner: t.withIdentity({ subject: data.ownerId }), ...data };
}

const toolStep = (index: number) => ({
  content: [{ type: "tool-call" as const, toolCallId: `status-${index}`, toolName: "getCurrentSearch", input: "{}" }],
  finishReason: { unified: "tool-calls" as const, raw: undefined },
  usage,
  warnings: [],
});
const envelopeStep = (spokenSummary: string) => ({
  content: [{ type: "text" as const, text: JSON.stringify({ delivery: "spoken", responseKind: "answer", spokenSummary }) }],
  finishReason: { unified: "stop" as const, raw: undefined },
  usage,
  warnings: [],
});

async function delegate(f: Awaited<ReturnType<typeof fixture>>, requestId: string) {
  return await f.owner.action(api.voiceLive.delegate, {
    voiceSessionId: f.voiceSessionId,
    requestId,
    delegationId: `delegation:${requestId}`,
    source: "voice",
    fragments: [{ eventId: `event:${requestId}`, role: "user", text: "What's the status of my rooms?", startMs: 0, endMs: 900 }],
  });
}

it("lets a multi-room status turn use more steps than the shared Agent default before the envelope", async () => {
  const f = await fixture();
  const model = new MockLanguageModelV4({ doGenerate: [
    ...Array.from({ length: 7 }, (_, index) => toolStep(index)),
    envelopeStep("First room confirmed Tuesday evenings; Second room has not replied yet."),
  ] });
  scoutAgent.options.languageModel = model;

  const result = await delegate(f, "multi-room-status");

  expect(model.doGenerateCalls).toHaveLength(8);
  expect(result).toMatchObject({
    status: "completed",
    delivery: "spoken",
    responseKind: "answer",
    spokenSummary: "First room confirmed Tuesday evenings; Second room has not replied yet.",
    resolvedEventIds: ["event:multi-room-status"],
  });
  expect(model.doGenerateCalls[6]?.toolChoice).toEqual({ type: "auto" });
});

it("forces the envelope before the budget ends and reports an honest failure if the model keeps calling tools", async () => {
  const f = await fixture();
  const model = new MockLanguageModelV4({ doGenerate: Array.from({ length: VOICE_TURN_STEP_BUDGET + 2 }, (_, index) => toolStep(index)) });
  scoutAgent.options.languageModel = model;

  const result = await delegate(f, "runaway-tools");

  expect(model.doGenerateCalls).toHaveLength(VOICE_TURN_STEP_BUDGET);
  // The two reserved steps are asked for text only; a real model then writes the envelope.
  expect(model.doGenerateCalls[VOICE_TURN_STEP_BUDGET - 2]?.toolChoice).toEqual({ type: "none" });
  expect(model.doGenerateCalls[VOICE_TURN_STEP_BUDGET - 1]?.toolChoice).toEqual({ type: "none" });
  expect(result).toMatchObject({ status: "failed", delivery: "spoken", locale: "en" });
  expect(result.spokenSummary).toBe(
    "I couldn't get that from the backend just now, the answer came back in a form I couldn't hand over. The panel shows the current status, or ask me once more.",
  );
  expect(result.responseKind).toBeUndefined();
  // The failed turn does not block the next one.
  const session = await f.t.run((ctx) => ctx.db.get(f.voiceSessionId));
  expect(session?.activeClaim).toBeUndefined();
});

it("truncates an over-long envelope for speech instead of failing the turn", async () => {
  const f = await fixture();
  const long = Array.from({ length: 30 }, (_, index) => `Room ${index + 1} replied with details about pricing and access.`).join(" ");
  expect(long.length).toBeGreaterThan(1_000);
  expect(long.length).toBeLessThan(2_000);
  const model = new MockLanguageModelV4({ doGenerate: [toolStep(0), envelopeStep(long)] });
  scoutAgent.options.languageModel = model;

  const result = await delegate(f, "long-answer");

  expect(result).toMatchObject({ status: "completed", delivery: "spoken", responseKind: "answer" });
  expect(new TextEncoder().encode(result.spokenSummary ?? "").length).toBeLessThanOrEqual(440);
  expect(result.spokenSummary?.endsWith("…")).toBe(true);
  expect(result.spokenSummary?.startsWith("Room 1 replied")).toBe(true);
});

/** `result.output` throws; only the getter's own error decides what happens. */
const envelopeResult = (error: unknown, text: string) => ({
  get output(): unknown { throw error; },
  text,
});

it("falls back to the final prose when the envelope getter reports no output", () => {
  const long = "Modul Ost replied and confirmed Tuesday evenings. ".repeat(60);
  expect(long.length).toBeGreaterThan(2_000);

  expect(readVoiceTurnEnvelope(envelopeResult(
    new NoOutputGeneratedError({ message: "No output generated." }),
    "  Modul Ost replied: Tuesday evenings are free.  ",
  ))).toEqual({
    delivery: "spoken",
    responseKind: "answer",
    spokenSummary: "Modul Ost replied: Tuesday evenings are free.",
  });

  // The delegate truncates for speech; the envelope only keeps its own ceiling.
  expect(readVoiceTurnEnvelope(envelopeResult(new NoOutputGeneratedError({}), long)).spokenSummary)
    .toHaveLength(2_000);

  // Nothing to hand over: an honest failure instead of an invented answer.
  expect(() => readVoiceTurnEnvelope(envelopeResult(new NoOutputGeneratedError({}), "   ")))
    .toThrow("VOICE_ENVELOPE_MISSING");
});

it("rethrows anything that is not a missing-output error, prose or not", () => {
  const other = Object.assign(new Error("model unreachable"), { name: "APICallError" });
  expect(() => readVoiceTurnEnvelope(envelopeResult(other, "Modul Ost replied.")))
    .toThrow("model unreachable");
});

it("speaks a voice-answered decision as a decision result, whatever the model labelled it", async () => {
  const f = await fixture();
  const decisionId = await f.t.run((ctx) => ctx.db.insert("decisions", {
    ownerId: f.ownerId,
    savedNeedId: f.needId,
    kind: "scout_question",
    status: "open",
    question: "Is a Tuesday evening slot fine?",
    options: [{ id: "yes", label: "Yes, Tuesdays work" }, { id: "no", label: "No, another day" }],
    refs: {},
    createdAt: 2_000,
    updatedAt: 2_000,
  }));
  const model = new MockLanguageModelV4({ doGenerate: [
    {
      content: [{
        type: "tool-call" as const, toolCallId: "answer-1", toolName: "answerDecision",
        input: JSON.stringify({ decisionId, choice: "yes" }),
      }],
      finishReason: { unified: "tool-calls" as const, raw: undefined },
      usage,
      warnings: [],
    },
    // The model files its own confirmation as a silent routine update; the
    // verified decision effect overrides both, or a late confirmation is lost.
    {
      content: [{ type: "text" as const, text: JSON.stringify({
        delivery: "silent", responseKind: "routine_update",
        spokenSummary: "I'll take that as your answer: Tuesday evenings work.",
      }) }],
      finishReason: { unified: "stop" as const, raw: undefined },
      usage,
      warnings: [],
    },
  ] });
  scoutAgent.options.languageModel = model;

  const result = await f.owner.action(api.voiceLive.delegate, {
    voiceSessionId: f.voiceSessionId,
    requestId: "decision-answer",
    delegationId: "delegation:decision-answer",
    source: "voice",
    decisionId,
    fragments: [{ eventId: "event:decision-answer", role: "user", text: "Tuesday evenings are fine", startMs: 0, endMs: 900 }],
  });

  expect(result).toMatchObject({
    status: "completed",
    delivery: "spoken",
    responseKind: "decision_result",
    spokenSummary: "I'll take that as your answer: Tuesday evenings work.",
  });
  expect(await f.t.run((ctx) => ctx.db.get(decisionId))).toMatchObject({ status: "answered" });
});
