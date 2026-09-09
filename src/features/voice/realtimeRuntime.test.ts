import { expect, it } from "vitest";
import {
  functionCallsFromResponse,
  reserveTranscriptItem,
  safeProviderError,
  safeVoiceError,
  upsertTranscriptItem,
} from "./realtimeRuntime";

it("extracts grouped function calls only from response.done", () => {
  const calls = functionCallsFromResponse({
    type: "response.done",
    response: {
      status: "completed",
      output: [
        { type: "message", role: "assistant" },
        {
          type: "function_call",
          call_id: "call-a",
          name: "remember_fact",
          arguments: '{"x":1}',
        },
        {
          type: "function_call",
          call_id: "call-b",
          name: "get_current_search",
          arguments: "{}",
        },
      ],
    },
  });
  expect(calls).toEqual([
    { call_id: "call-a", name: "remember_fact", arguments: '{"x":1}' },
    { call_id: "call-b", name: "get_current_search", arguments: "{}" },
  ]);
  expect(
    functionCallsFromResponse({
      type: "response.function_call_arguments.done",
      call_id: "call-a",
    }),
  ).toEqual([]);
  expect(
    functionCallsFromResponse({
      type: "response.done",
      response: {
        status: "cancelled",
        output: [
          { type: "function_call", call_id: "call-c", name: "remember_fact" },
        ],
      },
    }),
  ).toEqual([]);
});

it("reserves transcript order before delayed transcription completes", () => {
  const reserved = reserveTranscriptItem([], "user-1", "user");
  const withReply = upsertTranscriptItem(reserved, {
    id: "assistant-1",
    role: "assistant",
    text: "Hallo",
    final: true,
  });
  const completed = upsertTranscriptItem(withReply, {
    id: "user-1",
    role: "user",
    text: "Hi",
    final: true,
  });
  expect(completed.map((item) => item.id)).toEqual(["user-1", "assistant-1"]);
});

it("does not expose provider messages, ids, or response bodies", () => {
  expect(
    safeProviderError({
      type: "error",
      error: {
        message: "request req_secret failed",
        code: "rate_limit_exceeded",
      },
    }),
  ).not.toContain("req_secret");
  expect(safeVoiceError(new Error("raw SDP body session_123"))).toBe(
    "Could not start the Realtime session.",
  );
});
