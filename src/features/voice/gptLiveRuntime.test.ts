import { describe, expect, it } from "vitest";
import {
  GptLiveFragmentBuffer,
  GptLiveContextOverflowError,
  isClientDelegationEvent,
  isLiveTranscriptEvent,
  isRetryablePreclaimFailure,
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

  it("never resends resolved user speech as a new backend prompt", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "resolved-brief",
      delta: "We need a room in Berlin",
      start_ms: 0,
      end_ms: 300,
    });
    buffer.resolve(["resolved-brief"]);
    buffer.append({
      type: "session.output_transcript.delta",
      event_id: "assistant-context",
      delta: "Which day works?",
      start_ms: 310,
      end_ms: 500,
    });
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "new-answer",
      delta: "Wednesday evening",
      start_ms: 510,
      end_ms: 700,
    });

    expect(buffer.snapshot("second-turn").fragments).toEqual([
      expect.objectContaining({ eventId: "assistant-context", role: "assistant" }),
      expect.objectContaining({ eventId: "new-answer", role: "user" }),
    ]);
  });

  it("pins a delegation snapshot before a later unresolved correction", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "original-brief",
      delta: "Budget 300, Tuesday",
      start_ms: 0,
      end_ms: 300,
    });
    const delegationBoundary = buffer.latestSequence();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "later-correction",
      delta: "Actually 280, Wednesday",
      start_ms: 310,
      end_ms: 600,
    });

    const snapshot = buffer.snapshot("original-delegation", delegationBoundary);
    expect(snapshot.fragments.map((fragment) => fragment.eventId)).toEqual(["original-brief"]);
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

  it("keeps persisted transcript segments separate across speaker turns", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({ type: "session.input_transcript.delta", event_id: "user-a", delta: "Berlin", start_ms: 0, end_ms: 100 });
    buffer.append({ type: "session.output_transcript.delta", event_id: "assistant-q", delta: "Which radius?", start_ms: 110, end_ms: 200 });
    buffer.append({ type: "session.input_transcript.delta", event_id: "user-b", delta: "5 km", start_ms: 210, end_ms: 300 });
    expect(buffer.transcriptSegments()).toEqual([
      expect.objectContaining({ segmentId: "live:user:user-a", role: "user", text: "Berlin" }),
      expect.objectContaining({ segmentId: "live:assistant:assistant-q", role: "assistant", text: "Which radius?" }),
      expect.objectContaining({ segmentId: "live:user:user-b", role: "user", text: "5 km" }),
    ]);
  });

  it("selects only complete, substantive fact statements for early capture", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "greeting",
      delta: "Hi, nice to meet you.",
      start_ms: 0,
      end_ms: 300,
    });
    const start = { sequence: 0, characterOffset: 0 };
    expect(buffer.captureCandidate(start)).toBeUndefined();

    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "incomplete-budget",
      delta: " Our monthly rehearsal budget is 300",
      start_ms: 310,
      end_ms: 700,
    });
    expect(buffer.captureCandidate(start)).toBeUndefined();

    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "completed-budget",
      delta: " euros.",
      start_ms: 710,
      end_ms: 800,
    });
    expect(buffer.captureCandidate(start)).toBeUndefined();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "next-sentence",
      delta: " We also need storage",
      start_ms: 810,
      end_ms: 1_000,
    });
    expect(buffer.captureCandidate(start)).toEqual(
      expect.objectContaining({
        maxSequence: 3,
        text: "Hi, nice to meet you. Our monthly rehearsal budget is 300 euros.",
        nextCursor: { sequence: 3, characterOffset: " euros.".length },
      }),
    );
  });

  it("captures a sentence prefix inside a real-style provider delta without changing the source", () => {
    const buffer = new GptLiveFragmentBuffer();
    const realFixtureDeltas = [
      " Hey",
      " Scout",
      ", we're a",
      " four",
      "-piece",
      " indie",
      " rock",
      " band",
      " in",
      " Berlin",
      ". We're",
    ];
    realFixtureDeltas.forEach((delta, index) => {
      buffer.append({
        type: "session.input_transcript.delta",
        event_id: `real-event-${index}`,
        delta,
        start_ms: index * 200,
        end_ms: index * 200 + 200,
      });
    });

    const first = buffer.captureCandidate({ sequence: 0, characterOffset: 0 });
    expect(first).toEqual(
      expect.objectContaining({
        text: " Hey Scout, we're a four-piece indie rock band in Berlin.",
      }),
    );
    expect(first?.fragments.at(-1)).toEqual(
      expect.objectContaining({ eventId: "real-event-10", text: "." }),
    );
    expect(buffer.fragments().at(-1)?.text).toBe(". We're");

    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "event-location-next",
      delta: " looking near Kreuzberg. Our",
      start_ms: 1_010,
      end_ms: 1_500,
    });
    const second = buffer.captureCandidate(first!.nextCursor);
    expect(second).toEqual(
      expect.objectContaining({
        text: " We're looking near Kreuzberg.",
        fragments: [
          expect.objectContaining({ eventId: "real-event-10", text: " We're" }),
          expect.objectContaining({
            eventId: "event-location-next",
            text: " looking near Kreuzberg.",
          }),
        ],
      }),
    );
    expect(new Set(second!.fragments.map((fragment) => fragment.eventId)).size).toBe(
      second!.fragments.length,
    );
    expect(buffer.snapshot("native").fragments.map((fragment) => fragment.text).join(""))
      .toBe(" Hey Scout, we're a four-piece indie rock band in Berlin. We're looking near Kreuzberg. Our");
  });

  it("waits for lookahead before treating a punctuation-ended number as complete", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "decimal-first",
      delta: "Our rehearsal budget is 300.",
      start_ms: 0,
      end_ms: 300,
    });
    expect(buffer.captureCandidate({ sequence: 0, characterOffset: 0 })).toBeUndefined();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "decimal-rest",
      delta: "50 euros and includes bills",
      start_ms: 310,
      end_ms: 500,
    });
    expect(buffer.captureCandidate({ sequence: 0, characterOffset: 0 })).toBeUndefined();
  });

  it("captures a short contextual answer at the assistant turn boundary with its question", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.output_transcript.delta",
      event_id: "radius-question",
      delta: "How far outside Berlin should I look?",
      start_ms: 0,
      end_ms: 250,
    });
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "radius-answer",
      delta: "5 km",
      start_ms: 260,
      end_ms: 400,
    });
    expect(buffer.captureCandidate({ sequence: 0, characterOffset: 0 })).toBeUndefined();
    buffer.append({
      type: "session.output_transcript.delta",
      event_id: "next-question",
      delta: "Which day works?",
      start_ms: 410,
      end_ms: 600,
    });
    expect(buffer.captureCandidate({ sequence: 0, characterOffset: 0 })).toEqual(
      expect.objectContaining({
        text: "5 km",
        fragments: [
          expect.objectContaining({ eventId: "radius-question", role: "assistant" }),
          expect.objectContaining({ eventId: "radius-answer", role: "user" }),
        ],
      }),
    );
  });

  it("captures a quiet standalone fact or numeric answer without a following Scout turn", () => {
    for (const [eventId, text] of [["city-answer", "Berlin"], ["budget-answer", "300."]] as const) {
      const buffer = new GptLiveFragmentBuffer();
      buffer.append({
        type: "session.input_transcript.delta",
        event_id: eventId,
        delta: text,
        start_ms: 0,
        end_ms: 200,
      });
      expect(buffer.captureCandidate({ sequence: 0, characterOffset: 0 })).toBeUndefined();
      expect(buffer.captureCandidate({ sequence: 0, characterOffset: 0 }, true)).toEqual(
        expect.objectContaining({ text }),
      );
    }
  });

  it("does not capture a quiet greeting as a saved fact", () => {
    const buffer = new GptLiveFragmentBuffer();
    buffer.append({
      type: "session.input_transcript.delta",
      event_id: "hello-only",
      delta: "Hello!",
      start_ms: 0,
      end_ms: 200,
    });
    expect(buffer.captureCandidate({ sequence: 0, characterOffset: 0 }, true)).toBeUndefined();
  });

  it("never drops the beginning of a long unresolved monologue", () => {
    const buffer = new GptLiveFragmentBuffer();
    for (let index = 0; index < 180; index += 1) {
      buffer.append({
        type: "session.input_transcript.delta",
        event_id: `monologue-${index}`,
        delta:
          index === 0
            ? "We are a four-piece band in Berlin, "
            : index === 179
              ? "and our schedule is Wednesday evenings."
              : `detail ${index}, `,
        start_ms: index * 100,
        end_ms: index * 100 + 90,
      });
    }

    const snapshot = buffer.snapshot("long-delegation");
    expect(snapshot.fragments).toHaveLength(180);
    expect(snapshot.fragments[0]).toEqual(
      expect.objectContaining({ eventId: "monologue-0", text: "We are a four-piece band in Berlin, " }),
    );
    expect(snapshot.fragments.at(-1)).toEqual(
      expect.objectContaining({
        eventId: "monologue-179",
        text: "and our schedule is Wednesday evenings.",
      }),
    );
  });

  it("fails explicitly when all unresolved input cannot fit the backend contract", () => {
    const buffer = new GptLiveFragmentBuffer();
    for (let index = 0; index < 1_025; index += 1) {
      buffer.append({
        type: "session.input_transcript.delta",
        event_id: `overflow-${index}`,
        delta: "fact ",
        start_ms: index,
        end_ms: index + 1,
      });
    }
    expect(() => buffer.snapshot("overflow")).toThrow(GptLiveContextOverflowError);
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

it("distinguishes deterministic pre-claim rejection from an ambiguous failure", () => {
  expect(isRetryablePreclaimFailure({ data: { code: "INVALID_VOICE_REQUEST" } })).toBe(true);
  expect(isRetryablePreclaimFailure(new Error("Authentication_required"))).toBe(true);
  expect(isRetryablePreclaimFailure(new TypeError("network connection lost"))).toBe(false);
  expect(isRetryablePreclaimFailure({ data: { code: "VOICE_FIELD_CONFLICT" } })).toBe(false);
});
