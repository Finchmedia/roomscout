/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { listMessages, mockModel, saveMessages } from "@convex-dev/agent";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, components } from "./_generated/api";
import schema from "./schema";
import { scoutAgent } from "./scoutRuntime";

const modules = import.meta.glob("./**/*.ts");
const originalModel = scoutAgent.options.languageModel;
beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", ""); });
afterEach(() => { scoutAgent.options.languageModel = originalModel; vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function fixture() {
  const t = convexTest(schema, modules);
  agentTest.register(t);
  workpoolTest.register(t, "scoutWorkpool");
  workpoolTest.register(t, "browserWorkpool");
  const ids = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", { username: "chat-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const strangerId = await ctx.db.insert("users", { username: "chat-stranger", role: "musician", createdAt: now, lastSeenAt: now });
    const needId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Proberaum", city: "Berlin", locationQuery: "Berlin", locationLabel: "Berlin",
      radiusKm: 15, arrangement: [], schedule: [], requirements: [], status: "draft", createdAt: now, updatedAt: now,
    });
    return { ownerId, strangerId, needId };
  });
  const owner = t.withIdentity({ subject: ids.ownerId });
  const stranger = t.withIdentity({ subject: ids.strangerId });
  const { threadId } = await owner.mutation(api.scout.getOrCreateThread, { activeNeedId: ids.needId });
  const threadMessages = async () => {
    const page = await t.run((ctx) => listMessages(ctx, components.agent, { threadId, paginationOpts: { cursor: null, numItems: 50 } }));
    // The component lists newest first; the chat reads oldest first.
    return page.page.map((row) => ({ role: row.message?.role, text: row.text, status: row.status })).reverse();
  };
  const scheduled = async () => (await t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect()));
  return { t, owner, stranger, threadId, threadMessages, scheduled, ...ids };
}

it("send saves the musician message at once and schedules the streamed reply", async () => {
  const f = await fixture();

  const { messageId } = await f.owner.mutation(api.scout.send, { threadId: f.threadId, prompt: "  Ich suche einen Proberaum in Berlin.  " });

  expect(messageId).toBeTruthy();
  expect(await f.threadMessages()).toEqual([
    { role: "user", text: "Ich suche einen Proberaum in Berlin.", status: "success" },
  ]);
  const pending = await f.scheduled();
  expect(pending).toHaveLength(1);
  expect(pending[0]!.name).toContain("scout:reply");
  expect(pending[0]!.args[0]).toMatchObject({
    ownerId: f.ownerId, threadId: f.threadId, promptMessageId: messageId,
    prompt: "Ich suche einen Proberaum in Berlin.",
  });
});

it("send rejects an empty message, an over-long message and a foreign thread", async () => {
  const f = await fixture();

  await expect(f.owner.mutation(api.scout.send, { threadId: f.threadId, prompt: "   " }))
    .rejects.toThrow(/INVALID_MESSAGE/);
  await expect(f.owner.mutation(api.scout.send, { threadId: f.threadId, prompt: "x".repeat(4_001) }))
    .rejects.toThrow(/INVALID_MESSAGE/);
  await expect(f.stranger.mutation(api.scout.send, { threadId: f.threadId, prompt: "Hallo" }))
    .rejects.toThrow(/THREAD_NOT_FOUND/);
  expect(await f.threadMessages()).toEqual([]);
  expect(await f.scheduled()).toEqual([]);
});

it("listMessages carries stream deltas and reduces tool parts to type, call id and state", async () => {
  const f = await fixture();
  await f.t.run((ctx) => saveMessages(ctx, components.agent, {
    threadId: f.threadId,
    userId: f.ownerId,
    messages: [
      { role: "user", content: "Wir sind zu dritt." },
      { role: "assistant", content: [{ type: "tool-call", toolCallId: "call-1", toolName: "rememberFact", input: { subject: "Band", value: "drei Mitglieder" } }] },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "call-1", toolName: "rememberFact", output: { type: "json", value: { remembered: true, factId: "fact-1" } } }] },
      { role: "assistant", content: "Notiert: drei Mitglieder." },
    ],
  }));

  const withoutStreams = await f.owner.query(api.scout.listMessages, { threadId: f.threadId, paginationOpts: { cursor: null, numItems: 20 } });
  expect(withoutStreams.streams).toBeUndefined();
  expect(withoutStreams.page.map((row) => row.role)).toEqual(["user", "assistant"]);
  const assistant = withoutStreams.page.at(-1)!;
  expect(assistant.order).toBe(withoutStreams.page[0]!.order);
  const toolParts = assistant.parts.filter((part) => part.type.startsWith("tool-"));
  expect(toolParts).toEqual([{ type: "tool-rememberFact", toolCallId: "call-1", state: "output-available" }]);
  for (const part of toolParts) {
    expect(Object.keys(part).sort()).toEqual(["state", "toolCallId", "type"]);
  }
  expect(assistant.parts.some((part) => "text" in part && part.text === "Notiert: drei Mitglieder.")).toBe(true);

  const withStreams = await f.owner.query(api.scout.listMessages, {
    threadId: f.threadId, paginationOpts: { cursor: null, numItems: 20 },
    streamArgs: { kind: "list" },
  });
  expect(withStreams.streams).toEqual({ kind: "list", messages: [] });

  await expect(f.stranger.query(api.scout.listMessages, { threadId: f.threadId, paginationOpts: { cursor: null, numItems: 20 } }))
    .rejects.toThrow(/THREAD_NOT_FOUND/);
});

it("the streamed reply writes deltas and saves the assistant message on the thread", async () => {
  const f = await fixture();
  scoutAgent.options.languageModel = mockModel({ content: [{ type: "text", text: "Ich schaue mir Berlin an." }] });

  await f.owner.mutation(api.scout.send, { threadId: f.threadId, prompt: "Ich suche einen Proberaum in Berlin." });
  await f.t.finishAllScheduledFunctions(() => {});

  expect(await f.threadMessages()).toEqual([
    { role: "user", text: "Ich suche einen Proberaum in Berlin.", status: "success" },
    { role: "assistant", text: "Ich schaue mir Berlin an.", status: "success" },
  ]);
  const streams = await f.t.run((ctx) => ctx.runQuery(components.agent.streams.list, { threadId: f.threadId, statuses: ["streaming", "finished", "aborted"] }));
  const deltas = await f.t.run((ctx) => ctx.runQuery(components.agent.streams.listDeltas, {
    threadId: f.threadId,
    cursors: streams.map((stream) => ({ streamId: stream.streamId, cursor: 0 })),
  }));
  // The reply went through the Agent's delta primitives, not one generateText round.
  expect(streams).toHaveLength(1);
  expect(streams[0]).toMatchObject({ format: "UIMessageChunk", status: "finished", order: 0 });
  expect(deltas.length).toBeGreaterThan(0);
  expect(deltas.every((delta) => delta.streamId === streams[0]!.streamId)).toBe(true);
});

it("gives the shared Scout turn the confirmed musician profile without private account identity", async () => {
  const f = await fixture();
  await f.t.run((ctx) => ctx.db.patch(f.ownerId, {
    username: "private-login",
    firstName: "Alex",
    lastName: "Private-Surname",
    actKind: "band",
    actName: "Neon Harbour",
    providerIdentityConfirmedAt: 1,
  }));
  const model = mockModel({ content: [{ type: "text", text: "Ich suche weiter." }] }) as ReturnType<typeof mockModel> & {
    doStreamCalls: Array<{ prompt?: Array<{ role: string; content: unknown }> }>;
  };
  scoutAgent.options.languageModel = model;

  await f.owner.mutation(api.scout.send, { threadId: f.threadId, prompt: "Wie ist der Stand?" });
  await f.t.finishAllScheduledFunctions(() => {});

  const instructions = String(model.doStreamCalls[0]?.prompt?.find((message) => message.role === "system")?.content);
  expect(instructions).toContain('"firstName":"Alex"');
  expect(instructions).toContain('"representedName":"Neon Harbour"');
  expect(instructions).toContain('"actKind":"band"');
  expect(instructions).toContain("already confirmed");
  expect(instructions).not.toContain("Private-Surname");
  expect(instructions).not.toContain("private-login");
});

it("a failing reply marks the pending answer failed instead of leaving it open", async () => {
  const f = await fixture();
  scoutAgent.options.languageModel = mockModel({ fail: true, content: [{ type: "text", text: "unused" }] });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  await f.owner.mutation(api.scout.send, { threadId: f.threadId, prompt: "Ich suche einen Proberaum in Berlin." });
  await f.t.finishAllScheduledFunctions(() => {});

  const messages = await f.threadMessages();
  expect(messages[0]).toMatchObject({ role: "user", status: "success" });
  expect(messages.some((row) => row.status === "failed")).toBe(true);
  expect(logged.mock.calls.some((call) => call[0] === "SCOUT_REPLY_FAILED")).toBe(true);
});
