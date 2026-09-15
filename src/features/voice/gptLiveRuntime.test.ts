import { describe, expect, it } from "vitest";
import {
  GptLiveFragmentBuffer,
  isClientDelegationEvent,
  isLiveTranscriptEvent,
} from "./gptLiveRuntime";

describe("GptLiveFragmentBuffer", () => {
  it("deduplicates opaque event IDs and retains late intervals in arrival order", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "evt-later-audio",
      delta: "Wednesday",
      start_ms: 2_000,
      end_ms: 2_400,
    });
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "evt-late-delivery",
      delta: "Actually, ",
      start_ms: 1_700,
      end_ms: 1_990,
    });
    expect(
      buffer.append({
        type: "session.input_transcript.delta",
        event_id: "evt-late-delivery",
        delta: "duplicate",
        start_ms: 1_700,
        end_ms: 1_990,
      }),
    ).toBeUndefined();
    expect(buffer.fragments().map((fragment) => fragment.eventId)).toEqual([
      "evt-later-audio",
      "evt-late-delivery",
    ]);
    expect(buffer.fragments().map((fragment) => fragment.sequence)).toEqual([1, 2]);
    expect(buffer.captions()[0]?.text).toBe("Actually, Wednesday");
  });

  it("advances only through contiguous resolved input and supports partial resolution", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "user-1",
      delta: "Tuesday",
      start_ms: 100,
      end_ms: 200,
    });
    buffer.append({
      type: "session.output_transcript.delta",
      event_id: "assistant-1",
      delta: "Got it",
      start_ms: 210,
      end_ms: 300,
    });
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "user-2",
      delta: "Wednesday instead",
      start_ms: 310,
      end_ms: 500,
    });

    buffer.resolve(["user-2"]);
    expect(buffer.processedCursor()).toBe(0);
    expect(buffer.unresolvedUserFragments().map((fragment) => fragment.eventId)).toEqual(["user-1"]);
    buffer.resolve(["user-1"]);
    expect(buffer.processedCursor()).toBe(3);
    expect(buffer.unresolvedUserFragments()).toEqual([]);
  });

  it("keeps speaker roles in delegation context and detects newer unresolved input", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.output_transcript.delta",
      event_id: "question",
      delta: "Would Wednesday work?",
      start_ms: 100,
      end_ms: 400,
    });
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "answer",
      delta: "Yes",
      start_ms: 410,
      end_ms: 500,
    });
    const snapshot = buffer.snapshot("delegation-1");
    expect(snapshot.fragments.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "assistant", text: "Would Wednesday work?" },
      { role: "user", text: "Yes" },
    ]);
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "correction",
      delta: "Actually Thursday",
      start_ms: 510,
      end_ms: 700,
    });
    expect(buffer.hasNewerUnresolvedUserInput(snapshot.maxSequence)).toBe(true);
  });

  it("keeps overlapping speakers independent and lets a late fragment revise its earlier row", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "user-a",
      delta: "We need Tuesday",
      start_ms: 100,
      end_ms: 400,
    });
    buffer.append({
      type: "session.output_transcript.delta",
      event_id: "assistant-a",
      delta: "Mm-hm",
      start_ms: 300,
      end_ms: 430,
    });
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "user-late",
      delta: "—Wednesday, sorry",
      start_ms: 410,
      end_ms: 650,
    });
    expect(buffer.captions()).toEqual([
      expect.objectContaining({ role: "user", text: "We need Tuesday—Wednesday, sorry" }),
      expect.objectContaining({ role: "assistant", text: "Mm-hm" }),
    ]);
  });
});

it("accepts only documented transcript and client-delegation event shapes", () => {
  expect(
    isLiveTranscriptEvent({
      type: "session.input_transcript.delta",
      event_id: "evt",
      delta: "hello",
      start_ms: 0,
      end_ms: 10,
    }),
  ).toBe(true);
  expect(
    isClientDelegationEvent({
      type: "session.delegation.created",
      delegation: { id: "d1", type: "delegation", target: "client" },
    }),
  ).toBe(true);
  expect(
    isClientDelegationEvent({
      type: "session.delegation.created",
      delegation: { id: "d1", type: "delegation", target: "responses" },
    }),
  ).toBe(false);
});
