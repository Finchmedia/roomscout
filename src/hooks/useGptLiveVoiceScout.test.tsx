import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveDelegateResult } from "./useGptLiveVoiceScout";
import {
  createGptLiveSession,
  resolveLiveSessionEndpoint,
  splitLiveAppendContent,
  spokenResultContent,
  useGptLiveVoiceScout,
} from "./useGptLiveVoiceScout";

vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "token" }));
const convexMocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn().mockResolvedValue({ locale: "en", languageRevision: 1 }),
  query: undefined as unknown,
}));
const audioMocks = vi.hoisted(() => ({
  attach: vi.fn().mockResolvedValue(undefined),
  detach: vi.fn(),
  inputVolume: 0,
  outputVolume: 0,
  callCount: 0,
}));
vi.mock("convex/react", () => ({
  useAction: () => convexMocks.action,
  useMutation: () => convexMocks.mutation,
  useQuery: () => convexMocks.query,
}));
vi.mock("./useAudioVolume", () => ({
  useAudioVolume: () => ({
    volume: (audioMocks.callCount++ % 2 === 0)
      ? audioMocks.inputVolume
      : audioMocks.outputVolume,
    attach: audioMocks.attach,
    detach: audioMocks.detach,
  }),
}));

type TestConnection = {
  channel: RTCDataChannel;
  peer: RTCPeerConnection;
  sent: Array<Record<string, unknown>>;
};

function installConnection(): TestConnection {
  const sent: Array<Record<string, unknown>> = [];
  const channel = {
    readyState: "open",
    send: vi.fn((value: string) => sent.push(JSON.parse(value) as Record<string, unknown>)),
    close: vi.fn(),
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  } as unknown as RTCDataChannel;
  const peer = {
    connectionState: "connected",
    localDescription: { type: "offer", sdp: "offer-sdp" },
    ontrack: null,
    onconnectionstatechange: null,
    addTrack: vi.fn(),
    close: vi.fn(),
    createDataChannel: vi.fn(() => channel),
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockResolvedValue(undefined),
  } as unknown as RTCPeerConnection;
  function MockPeerConnection() {
    return peer;
  }
  vi.stubGlobal("RTCPeerConnection", MockPeerConnection);
  return { channel, peer, sent };
}

function serverEvent(channel: RTCDataChannel, event: Record<string, unknown>) {
  channel.onmessage?.({ data: JSON.stringify(event) } as MessageEvent);
}

function completed(requestId: string, resolvedEventIds: string[]): LiveDelegateResult {
  return {
    status: "completed",
    requestId,
    resolvedEventIds,
    spokenSummary: "Wednesday is saved.",
    locale: "en",
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  convexMocks.action.mockReset();
  convexMocks.mutation.mockClear();
  convexMocks.query = undefined;
  audioMocks.attach.mockClear();
  audioMocks.detach.mockClear();
  audioMocks.inputVolume = 0;
  audioMocks.outputVolume = 0;
  audioMocks.callCount = 0;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  const stream = {
    getTracks: () => [{ stop: vi.fn(), enabled: true }],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
});

afterEach(async () => {
  // Close each synthetic call before jsdom disappears, including its timers
  // and pending React updates. Vitest does not expose a global afterEach here.
  await act(async () => { cleanup(); });
});

it("requires the explicit Live provider and app session headers", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("answer-sdp"),
      headers: new Headers({
        "X-RoomScout-Voice-Provider": "live",
        "X-RoomScout-Voice-Session": "voice-1",
      }),
    }),
  );
  await expect(createGptLiveSession("/api/live/session", "offer", "token", "en")).resolves.toEqual({
    answerSdp: "answer-sdp",
    provider: "live",
    voiceSessionId: "voice-1",
  });
  const request = vi.mocked(fetch).mock.calls[0]?.[0] as URL;
  expect(request.searchParams.get("locale")).toBe("en");

  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    text: () => Promise.resolve("realtime-answer"),
    headers: new Headers({
      "X-RoomScout-Voice-Provider": "realtime",
      "X-RoomScout-Voice-Session": "voice-2",
    }),
  } as Response);
  await expect(createGptLiveSession("/api/live/session", "offer", "token", "en")).rejects.toThrow(
    "Live voice session request failed",
  );
});

it("resolves the Live endpoint from the active Convex deployment before stale overrides", () => {
  expect(resolveLiveSessionEndpoint(
    " https://fleet-jackal-83.convex.cloud/ ",
    "https://stale-sandbox.convex.site",
  )).toBe("https://fleet-jackal-83.convex.site/api/live/session");
  expect(resolveLiveSessionEndpoint(
    "https://fleet-jackal-83.convex.cloud",
    undefined,
  )).toBe("https://fleet-jackal-83.convex.site/api/live/session");
  expect(resolveLiveSessionEndpoint(
    "http://127.0.0.1:3220",
    "http://127.0.0.1:3221/",
  )).toBe("http://127.0.0.1:3221/api/live/session");
  expect(resolveLiveSessionEndpoint(
    "https://api.roomscout.example",
    "https://voice.roomscout.example/",
  )).toBe("https://voice.roomscout.example/api/live/session");
  expect(resolveLiveSessionEndpoint(undefined, undefined)).toBe("/api/live/session");
});

describe("spokenResultContent", () => {
  const answer: LiveDelegateResult = {
    status: "completed", requestId: "r", resolvedEventIds: ["e"], locale: "en",
    delivery: "spoken", responseKind: "answer", spokenSummary: "Modul Ost confirmed Tuesday evenings.",
  };
  const fresh = { locale: "en" as const, contextIsCurrent: true, localeStillCurrent: true, hasNewerInput: false, hasNewerTypedInput: false, honoredEndCall: false };

  it("speaks a fresh result as is and never a silent one or an honoured farewell", () => {
    expect(spokenResultContent({ ...fresh, result: answer })).toBe("Modul Ost confirmed Tuesday evenings.");
    expect(spokenResultContent({ ...fresh, result: { ...answer, delivery: "silent" } })).toBeUndefined();
    expect(spokenResultContent({ ...fresh, result: { ...answer, spokenSummary: undefined } })).toBeUndefined();
    expect(spokenResultContent({ ...fresh, result: answer, honoredEndCall: true })).toBeUndefined();
  });

  it("keeps answers, clarifications, decision results and failures after a newer utterance, with a prefix", () => {
    for (const responseKind of ["answer", "clarification", "decision_result"] as const) {
      expect(spokenResultContent({ ...fresh, result: { ...answer, responseKind }, contextIsCurrent: false, hasNewerInput: true }))
        .toBe("Answer to the earlier question: Modul Ost confirmed Tuesday evenings.");
    }
    expect(spokenResultContent({ ...fresh, locale: "de", result: { ...answer, status: "failed", responseKind: undefined }, contextIsCurrent: false, hasNewerInput: true }))
      .toBe("Antwort auf die frühere Frage: Modul Ost confirmed Tuesday evenings.");
  });

  it("treats a focus-only context change as fresh for an answer, without a prefix", () => {
    expect(spokenResultContent({ ...fresh, result: answer, contextIsCurrent: false })).toBe("Modul Ost confirmed Tuesday evenings.");
  });

  it("still drops write acknowledgements, and every kind behind typed input or a language switch", () => {
    for (const responseKind of ["routine_update", "action_result", undefined] as const) {
      expect(spokenResultContent({ ...fresh, result: { ...answer, responseKind }, hasNewerInput: true })).toBeUndefined();
      expect(spokenResultContent({ ...fresh, result: { ...answer, responseKind }, contextIsCurrent: false })).toBeUndefined();
    }
    expect(spokenResultContent({ ...fresh, result: answer, hasNewerTypedInput: true })).toBeUndefined();
    expect(spokenResultContent({ ...fresh, result: answer, contextIsCurrent: false, localeStillCurrent: false })).toBeUndefined();
  });
});

describe("useGptLiveVoiceScout", () => {
  async function connect(
    delegate: (args: never) => Promise<LiveDelegateResult>,
    captureOptions: {
      enableEarlyFactCapture?: boolean;
      earlyFactCaptureCadenceMs?: number;
      initialLocale?: "en" | "de";
      idleTimeoutMs?: number;
      idleGraceMs?: number;
      farewellOutputQuietMs?: number;
      farewellMaxWaitMs?: number;
      closeAckTimeoutMs?: number;
    } = {},
  ) {
    const connection = installConnection();
    const createSession = vi.fn().mockResolvedValue({
      answerSdp: "answer-sdp",
      voiceSessionId: "voice-1",
      provider: "live",
    });
    const hook = renderHook(() =>
      useGptLiveVoiceScout({
        createSession,
        delegate: delegate as never,
        initialLocale: "en",
        enableEarlyFactCapture: false,
        ...captureOptions,
      }),
    );
    await act(async () => hook.result.current.connect());
    act(() => connection.channel.onopen?.(new Event("open")));
    await waitFor(() => expect(hook.result.current.connectionState).toBe("active"));
    return { ...connection, ...hook };
  }

  it("triggers the server-owned session opening without imposing a client question", async () => {
    for (const [locale, expected] of [
      ["en", /SESSION OPENING rule in English for your very first utterance of this session only\. Speak first, then listen\..*must never be repeated/],
      ["de", /Regel SESSION OPENING auf Deutsch nur für deinen allerersten Beitrag dieser Sitzung an\. Sprich zuerst und höre dann zu\..*nie wiederholt werden/],
    ] as const) {
      const hook = await connect(
        vi.fn().mockResolvedValue(completed("none", [])) as never,
        { initialLocale: locale },
      );
      act(() => serverEvent(hook.channel, { type: "session.started" }));
      const opening = hook.sent.find((event) => event.type === "session.instructions.append");
      expect(String(opening?.content)).toMatch(expected);
      expect(String(opening?.content)).not.toMatch(/ask what matters|frage, was/i);
      // The server prompt decides between "welcome back" and a self-introduction;
      // the standing client cue must not prescribe an introduction the returning
      // user's opening rule forbids, nor read as "apply the opening now" later.
      expect(String(opening?.content)).not.toMatch(/introduction|Vorstellung|exactly once now|jetzt genau einmal/);
      expect(hook.sent.some((event) => event.type === "session.commentary.append")).toBe(false);
      act(() => serverEvent(hook.channel, {
        type: "session.instructions.appended",
        client_event_id: opening?.event_id,
      }));
      expect(hook.sent).toContainEqual(expect.objectContaining({
        type: "session.commentary.append",
        content: expect.stringContaining("SESSION OPENING"),
      }));
      act(() => serverEvent(hook.channel, {
        type: "session.instructions.appended",
        client_event_id: opening?.event_id,
      }));
      expect(hook.sent.filter((event) => event.type === "session.commentary.append")).toHaveLength(1);
      hook.unmount();
    }
  });

  it("retains an early delegation until a user fragment arrives", async () => {
    const delegate = vi.fn().mockImplementation(async (args: {
      requestId: string;
      fragments: Array<{ eventId: string; role: string }>;
    }) => completed(
      args.requestId,
      args.fragments.filter((fragment) => fragment.role === "user").map((fragment) => fragment.eventId),
    ),
    );
    const { channel, result } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-1", type: "delegation", target: "client" },
      });
    });
    expect(delegate).not.toHaveBeenCalled();
    expect(result.current.pendingInputCount).toBe(0);

    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "user-fragment",
        delta: "Wednesday ",
        start_ms: 100,
        end_ms: 300,
      });
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "user-fragment-2",
        delta: "instead",
        start_ms: 310,
        end_ms: 500,
      });
      serverEvent(channel, {
        type: "session.output_transcript.delta",
        event_id: "assistant-after-answer",
        delta: "Got it.",
        start_ms: 510,
        end_ms: 650,
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    expect(delegate).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceSessionId: "voice-1",
        requestId: "delegation-1",
        delegationId: "delegation-1",
        source: "voice",
        fragments: expect.arrayContaining([
          expect.objectContaining({ eventId: "user-fragment", role: "user", text: "Wednesday " }),
          expect.objectContaining({ eventId: "user-fragment-2", role: "user", text: "instead" }),
        ]),
      }),
    );
    await waitFor(() => expect(result.current.pendingInputCount).toBe(0));
    act(() => serverEvent(channel, {
      type: "session.delegation.created",
      delegation: { id: "delegation-1", type: "delegation", target: "client" },
    }));
    expect(delegate).toHaveBeenCalledOnce();
    expect(result.current.pendingInputCount).toBe(0);
  });

  it("persists the coalesced user caption and anchors its native delegation", async () => {
    const delegate = vi.fn().mockImplementation(async (args: {
      requestId: string;
      fragments: Array<{ eventId: string }>;
    }) => completed(args.requestId, args.fragments.map((fragment) => fragment.eventId)));
    const { channel } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "persist-a",
        delta: "We need a room ",
        start_ms: 0,
        end_ms: 200,
      });
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "persist-b",
        delta: "in Berlin",
        start_ms: 210,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "persist-delegation", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    const persisted = convexMocks.mutation.mock.calls.find(([args]) =>
      (args as { segmentId?: string }).segmentId === "live:user:persist-a"
    )?.[0];
    expect(persisted).toEqual(expect.objectContaining({
      voiceSessionId: "voice-1",
      revision: 2,
      role: "user",
      transcript: "We need a room in Berlin",
      sourceEventIds: ["persist-a", "persist-b"],
    }));
    expect(delegate).toHaveBeenCalledWith(expect.objectContaining({
      transcriptSegmentId: "live:user:persist-a",
    }));
  });

  it("captures a quiet standalone fact without waiting for the Scout to speak", async () => {
    const delegate = vi.fn().mockImplementation(async (args: { requestId: string }) => ({
      ...completed(args.requestId, []),
      spokenSummary: undefined,
    }));
    const hook = await connect(delegate as never, {
      enableEarlyFactCapture: true,
      earlyFactCaptureCadenceMs: 0,
    });
    vi.useFakeTimers();
    try {
      act(() => serverEvent(hook.channel, {
        type: "session.input_transcript.delta",
        event_id: "quiet-city",
        delta: "Berlin",
        start_ms: 0,
        end_ms: 200,
      }));
      expect(delegate).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTimeAsync(900));
      expect(delegate).toHaveBeenCalledWith(expect.objectContaining({
        intent: "capture_facts",
        fragments: [expect.objectContaining({ eventId: "quiet-city", text: "Berlin" })],
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it("suppresses a stale spoken result when a newer correction arrives", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "budget-300",
        delta: "Three hundred euros",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-budget", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "budget-280",
        delta: "Actually two eighty",
        start_ms: 410,
        end_ms: 650,
      });
    });
    await act(async () => resolveDelegate(completed("delegation-budget", ["budget-300"])));
    expect(sent.some((event) => event.type === "session.commentary.append")).toBe(false);
  });

  it("speaks a late status answer when only a backchannel arrived meanwhile", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "status-question",
        delta: "What's the status of Modul Ost?",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-status", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "backchannel-okay",
        delta: "okay",
        start_ms: 410,
        end_ms: 500,
      });
    });
    await act(async () => resolveDelegate({
      ...completed("delegation-status", ["status-question"]),
      responseKind: "answer",
      spokenSummary: "Modul Ost: the provider confirmed Tuesday evenings and asked about storage.",
    }));
    expect(sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      delegation_id: "delegation-status",
      content: "Answer to the earlier question: Modul Ost: the provider confirmed Tuesday evenings and asked about storage.",
    }));
    expect(result.current.backendState).toBe("idle");
  });

  it("still drops a late write acknowledgement when a newer correction arrived", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "budget-300-ack",
        delta: "Three hundred euros",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-budget-ack", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "budget-280-ack",
        delta: "Actually two eighty",
        start_ms: 410,
        end_ms: 650,
      });
    });
    await act(async () => resolveDelegate({
      ...completed("delegation-budget-ack", ["budget-300-ack"]),
      responseKind: "action_result",
      spokenSummary: "The budget is set to 300 euros.",
    }));
    expect(sent.some((event) => event.type === "session.commentary.append")).toBe(false);
  });

  it("speaks a failed backend result even after newer speech", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "status-question-failed",
        delta: "What did the provider say?",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-failed", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "hmm",
        delta: "hmm",
        start_ms: 410,
        end_ms: 450,
      });
    });
    await act(async () => resolveDelegate({
      status: "failed",
      requestId: "delegation-failed",
      resolvedEventIds: [],
      locale: "en",
      delivery: "spoken",
      spokenSummary: "I couldn't get that from the backend just now, it took too long. The panel shows the current status, or ask me once more.",
    }));
    expect(result.current.backendState).toBe("failed");
    expect(sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      delegation_id: "delegation-failed",
      content: expect.stringMatching(/^Answer to the earlier question: I couldn't get that from the backend just now, it took too long\./),
    }));
  });

  it("delegates the repeated question after a failed voice result, as the spoken sentence promises", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn().mockImplementation(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "status-first",
        delta: "What did the provider say?",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-first", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    await act(async () => resolveDelegate({
      status: "failed",
      requestId: "delegation-first",
      resolvedEventIds: [],
      locale: "en",
      delivery: "spoken",
      spokenSummary: "I couldn't get that from the backend just now, it took too long. The panel shows the current status, or ask me once more.",
    }));
    expect(result.current.backendState).toBe("failed");

    // "ask me once more": the next genuine utterance must go through without
    // the on-screen Retry link, carrying the unresolved first question along.
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "status-again",
        delta: "What did the provider say?",
        start_ms: 900,
        end_ms: 1_200,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-again", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(result.current.error).toBeUndefined();
    expect(delegate.mock.calls[1]?.[0]).toEqual(expect.objectContaining({ delegationId: "delegation-again" }));
    expect(delegate.mock.calls[1]?.[0].fragments.map((fragment: { eventId: string }) => fragment.eventId))
      .toEqual(expect.arrayContaining(["status-first", "status-again"]));
    await act(async () => resolveDelegate({
      ...completed("delegation-again", ["status-first", "status-again"]),
      responseKind: "answer",
      delivery: "spoken",
      spokenSummary: "Modul Ost confirmed Tuesday evenings.",
    }));
    await waitFor(() => expect(result.current.backendState).toBe("idle"));
  });

  it("keeps blocking after an unknown outcome, where the spoken sentence does not invite a repeat", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "send-it",
        delta: "Tell them Tuesday works",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-unknown", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    await act(async () => resolveDelegate({
      status: "outcome_unknown",
      requestId: "delegation-unknown",
      resolvedEventIds: [],
      locale: "en",
      delivery: "spoken",
      spokenSummary: "I can't tell yet whether that last step went through, it took too long. It is still being checked; the panel shows the current status, so please look there before repeating it.",
    }));
    expect(result.current.backendState).toBe("outcome_unknown");

    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "send-it-again",
        delta: "Did that go out?",
        start_ms: 900,
        end_ms: 1_200,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-unknown-again", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(result.current.pendingInputCount).toBe(1));
    expect(delegate).toHaveBeenCalledOnce();
  });

  it("speaks an answer without a prefix when only the focus changed while it ran", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "open-and-ask",
        delta: "Open Raum West, what did they say?",
        start_ms: 100,
        end_ms: 500,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-open", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    // The Scout's own openCandidate moved the server focus mid-turn.
    act(() => result.current.setFocus({ summary: "The user is viewing candidate Raum West." }));
    await act(async () => resolveDelegate({
      ...completed("delegation-open", ["open-and-ask"]),
      responseKind: "answer",
      spokenSummary: "Raum West is open. The provider offered Tuesday evenings.",
    }));
    expect(sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      delegation_id: "delegation-open",
      content: "Raum West is open. The provider offered Tuesday evenings.",
    }));
  });

  it("keeps an answer in the old language quiet after a mid-request language switch", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "status-before-switch",
        delta: "What's the status?",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-switch", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => result.current.setLanguage("de"));
    await act(async () => resolveDelegate({
      ...completed("delegation-switch", ["status-before-switch"]),
      responseKind: "answer",
      spokenSummary: "Two rooms replied; one is waiting for your answer.",
    }));
    expect(result.current.sessionLocale).toBe("de");
    expect(sent.some((event) => event.type === "session.commentary.append")).toBe(false);
  });

  it("keeps a late completed receipt quiet while the correction's native request is queued", async () => {
    let resolveOriginal!: (result: LiveDelegateResult) => void;
    let resolveCorrection!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(
        () => new Promise<LiveDelegateResult>((resolve) => { resolveOriginal = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise<LiveDelegateResult>((resolve) => { resolveCorrection = resolve; }),
      );
    const { channel, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "original-brief",
        delta: "Budget 300 euros and Tuesday evenings",
        start_ms: 0,
        end_ms: 500,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "original-native", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "newer-correction",
        delta: "Actually 280 euros and Wednesday evenings",
        start_ms: 510,
        end_ms: 900,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "correction-native", type: "delegation", target: "client" },
      });
    });
    await act(async () => resolveOriginal({
      ...completed("original-native", ["original-brief"]),
      spokenSummary: "All set. Your brief is ready.",
      changedFields: ["budget", "schedule", "needStatus"],
      verifiedFacts: ["Original request committed before the correction."],
    }));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));

    expect(delegate.mock.calls[0]?.[0].fragments).toEqual([
      expect.objectContaining({ eventId: "original-brief" }),
    ]);
    expect(delegate.mock.calls[1]?.[0].fragments).toEqual([
      expect.objectContaining({ eventId: "newer-correction" }),
    ]);
    expect(sent.some((event) =>
      event.type === "session.commentary.append" &&
      event.content === "All set. Your brief is ready.",
    )).toBe(false);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "session.thinking.append",
          content: expect.stringContaining("Original request committed before the correction."),
        }),
      ]),
    );
    await act(async () => resolveCorrection(completed("correction-native", ["newer-correction"])));
  });

  it("keeps a completed spoken summary quiet when newer typed work is waiting", async () => {
    let resolveVoice!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(
        () => new Promise<LiveDelegateResult>((resolve) => { resolveVoice = resolve; }),
      )
      .mockImplementation(async (args: { requestId: string }) => completed(args.requestId, []));
    const { channel, result, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "voice-before-text",
        delta: "Keep the first option open",
        start_ms: 0,
        end_ms: 300,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "voice-request", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => expect(result.current.sendText("Compare it with the second option")).toBe(true));
    await act(async () => resolveVoice({
      ...completed("voice-request", ["voice-before-text"]),
      spokenSummary: "The first option is ready.",
      changedFields: ["decisionStatus"],
      verifiedFacts: ["The first option stayed open."],
    }));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(sent.some((event) => event.content === "The first option is ready.")).toBe(false);
    expect(sent.some((event) =>
      event.type === "session.thinking.append" &&
      String(event.content).includes("The first option stayed open."),
    )).toBe(true);
  });

  it("delivers routine saved facts as quiet verified context", async () => {
    const delegate = vi.fn().mockImplementation(async (args: {
      requestId: string;
      fragments: Array<{ eventId: string }>;
    }) => ({
      ...completed(args.requestId, args.fragments.map((fragment) => fragment.eventId)),
      delivery: "silent" as const,
      spokenSummary: "I saved your four-piece band and guitars.",
      changedFields: ["bandSize", "instruments"],
      verifiedFacts: ["Band size: 4", "Instruments: guitars"],
    }));
    const { channel, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "silent-facts",
        delta: "We are four people and bring guitars",
        start_ms: 0,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "silent-request", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(sent.some((event) =>
      event.type === "session.thinking.append" &&
      String(event.content).includes("Band size: 4") &&
      event.delegation_id === "silent-request",
    )).toBe(true));
    expect(sent.some((event) =>
      event.type === "session.commentary.append" &&
      event.content === "I saved your four-piece band and guitars.",
    )).toBe(false);
  });

  it("keeps a cached silent completion quiet during reconciliation", async () => {
    const delegate = vi.fn().mockImplementation(async (args: { requestId: string }) => ({
      status: "in_progress" as const,
      requestId: args.requestId,
      resolvedEventIds: [],
      locale: "en" as const,
    }));
    const hook = await connect(delegate as never);
    act(() => {
      serverEvent(hook.channel, {
        type: "session.input_transcript.delta",
        event_id: "cached-fact",
        delta: "The radius is twenty kilometres",
        start_ms: 0,
        end_ms: 300,
      });
      serverEvent(hook.channel, {
        type: "session.delegation.created",
        delegation: { id: "cached-request", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    convexMocks.query = {
      voiceSessionId: "voice-1",
      status: "active",
      locale: "en",
      languageRevision: 1,
      activeRequest: undefined,
      lastResult: {
        ...completed("cached-request", ["cached-fact"]),
        delivery: "silent",
        spokenSummary: "Your radius is saved.",
        changedFields: ["radiusKm"],
        verifiedFacts: ["Radius: 20 km"],
      },
      current: {},
    };
    hook.rerender();
    await waitFor(() => expect(hook.sent.some((event) =>
      event.type === "session.thinking.append" &&
      String(event.content).includes("Radius: 20 km") &&
      event.delegation_id === "cached-request",
    )).toBe(true));
    expect(hook.sent.some((event) => event.content === "Your radius is saved.")).toBe(false);
  });

  it("honors a cached validated end-call despite newer queued voice", async () => {
    const delegate = vi.fn().mockImplementation(async (args: { requestId: string }) => ({
      status: "in_progress" as const,
      requestId: args.requestId,
      resolvedEventIds: [],
      locale: "en" as const,
    }));
    const hook = await connect(delegate as never);
    act(() => {
      serverEvent(hook.channel, {
        type: "session.input_transcript.delta",
        event_id: "cached-bye",
        delta: "Please hang up",
        start_ms: 0,
        end_ms: 250,
      });
      serverEvent(hook.channel, {
        type: "session.delegation.created",
        delegation: { id: "cached-bye-request", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(hook.channel, {
        type: "session.input_transcript.delta",
        event_id: "cached-filler",
        delta: "Uh",
        start_ms: 260,
        end_ms: 320,
      });
      serverEvent(hook.channel, {
        type: "session.delegation.created",
        delegation: { id: "cached-filler-request", type: "delegation", target: "client" },
      });
    });
    convexMocks.query = {
      voiceSessionId: "voice-1",
      status: "active",
      locale: "en",
      languageRevision: 1,
      activeRequest: undefined,
      lastResult: {
        ...completed("cached-bye-request", ["cached-bye"]),
        delivery: "silent",
        spokenSummary: undefined,
        endCall: { reason: "user_request", farewell: "Okay, I’ll end the call now." },
      },
      current: {},
    };
    hook.rerender();
    await waitFor(() => expect(hook.sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      content: "Okay, I’ll end the call now.",
    })));
    expect(delegate).toHaveBeenCalledOnce();
    expect(hook.result.current.microphoneState).toBe("off");
  });

  it("speaks a cached mixed language result after reconciling its own locale change", async () => {
    const delegate = vi.fn().mockImplementation(async (args: { requestId: string }) => ({
      status: "in_progress" as const,
      requestId: args.requestId,
      resolvedEventIds: [],
      locale: "en" as const,
    }));
    const hook = await connect(delegate as never);
    act(() => {
      serverEvent(hook.channel, {
        type: "session.input_transcript.delta",
        event_id: "cached-language",
        delta: "Auf Deutsch: Was fehlt noch?",
        start_ms: 0,
        end_ms: 300,
      });
      serverEvent(hook.channel, {
        type: "session.delegation.created",
        delegation: { id: "cached-language-request", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    convexMocks.query = {
      voiceSessionId: "voice-1",
      status: "active",
      locale: "de",
      languageRevision: 2,
      activeRequest: undefined,
      lastResult: {
        ...completed("cached-language-request", ["cached-language"]),
        locale: "de",
        delivery: "spoken",
        spokenSummary: "Es fehlt nur noch der Suchradius.",
        changedFields: ["conversationLocale"],
      },
      current: {},
    };
    hook.rerender();
    await waitFor(() => expect(hook.sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      content: "Es fehlt nur noch der Suchradius.",
    })));
    expect(hook.result.current.sessionLocale).toBe("de");
    expect(hook.sent.some((event) => String(event.content).includes("VERIFIED_PREVIOUS_REQUEST_RESULT"))).toBe(false);
  });

  it("processes a late fragment in the next queued delegation even when its audio interval is older", async () => {
    let resolveFirst!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(() => new Promise<LiveDelegateResult>((resolve) => { resolveFirst = resolve; }))
      .mockImplementation(async (args: { requestId: string }) => completed(args.requestId, ["late-correction"]));
    const { channel } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "first-value",
        delta: "Tuesday",
        start_ms: 500,
        end_ms: 700,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-1", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "late-correction",
        delta: "Actually Wednesday",
        start_ms: 300,
        end_ms: 490,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-2", type: "delegation", target: "client" },
      });
    });
    await act(async () => resolveFirst(completed("delegation-1", ["first-value"])));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(delegate.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        requestId: "delegation-2",
        fragments: expect.arrayContaining([
          expect.objectContaining({ eventId: "late-correction", text: "Actually Wednesday" }),
        ]),
      }),
    );
  });

  it("sends only each turn's unresolved user speech across later native delegations", async () => {
    const delegate = vi.fn().mockImplementation(async (args: {
      requestId: string;
      fragments: Array<{ eventId: string; role: string }>;
    }) => completed(
      args.requestId,
      args.fragments.filter((fragment) => fragment.role === "user").map((fragment) => fragment.eventId),
    ));
    const { channel } = await connect(delegate as never);
    for (const [index, text] of [
      "We need a room in Berlin",
      "Actually near Kreuzberg",
      "Wednesday evenings work",
    ].entries()) {
      act(() => {
        serverEvent(channel, {
          type: "session.input_transcript.delta",
          event_id: `user-turn-${index + 1}`,
          delta: text,
          start_ms: index * 1_000,
          end_ms: index * 1_000 + 500,
        });
        serverEvent(channel, {
          type: "session.delegation.created",
          delegation: {
            id: `delegation-turn-${index + 1}`,
            type: "delegation",
            target: "client",
          },
        });
      });
      await waitFor(() => expect(delegate).toHaveBeenCalledTimes(index + 1));
    }

    expect(delegate.mock.calls.map((call) =>
      call[0].fragments.filter((fragment: { role: string }) => fragment.role === "user")
        .map((fragment: { eventId: string }) => fragment.eventId),
    )).toEqual([["user-turn-1"], ["user-turn-2"], ["user-turn-3"]]);
  });

  it("does not speak or restore the old locale after focus and language change mid-request", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "room-question",
        delta: "What about this room?",
        start_ms: 100,
        end_ms: 400,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-room", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      result.current.setFocus({ summary: "The selected room is now East Room." });
      result.current.setLanguage("de");
    });
    await act(async () => resolveDelegate({
      ...completed("delegation-room", ["room-question"]),
      changedFields: ["decisionStatus"],
      verifiedFacts: ["The previous nonbinding decision was answered no."],
    }));
    expect(result.current.sessionLocale).toBe("de");
    expect(sent.some((event) => event.type === "session.commentary.append")).toBe(false);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "session.thinking.append" }),
        expect.objectContaining({ type: "session.instructions.append" }),
      ]),
    );
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "session.thinking.append",
          content: expect.stringContaining("VERIFIED_PREVIOUS_REQUEST_RESULT"),
        }),
        expect.objectContaining({
          type: "session.thinking.append",
          content: expect.stringContaining("previous nonbinding decision was answered no"),
        }),
      ]),
    );
  });

  it("speaks a fresh mixed language result after applying its own locale change", async () => {
    const delegate = vi.fn().mockImplementation(async (args: {
      requestId: string;
      fragments: Array<{ eventId: string }>;
    }) => ({
      ...completed(args.requestId, args.fragments.map((fragment) => fragment.eventId)),
      locale: "de" as const,
      delivery: "spoken" as const,
      spokenSummary: "Klar. Was möchtest du zu deiner Suche wissen?",
      changedFields: ["conversationLocale"],
    }));
    const { channel, result, sent } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "switch-and-question",
        delta: "Switch to German and tell me what is still missing",
        start_ms: 0,
        end_ms: 500,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "switch-request", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      content: "Klar. Was möchtest du zu deiner Suche wissen?",
    })));
    expect(result.current.sessionLocale).toBe("de");
    expect(sent.some((event) => String(event.content).includes("VERIFIED_PREVIOUS_REQUEST_RESULT"))).toBe(false);
  });

  it("waits for actual backend completion and preserves queued typed input on close", async () => {
    let resolveDelegate!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn(
      () => new Promise<LiveDelegateResult>((resolve) => { resolveDelegate = resolve; }),
    );
    const { channel, result } = await connect(delegate as never);
    act(() => {
      expect(result.current.sendText("Set the budget to 280")).toBe(true);
      expect(result.current.sendText("Then start the search")).toBe(true);
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    expect(result.current.pendingTextDraft).toBe("Then start the search");
    let flushed = false;
    const flush = result.current.flushPendingInputs().then((value) => { flushed = value; });
    await Promise.resolve();
    expect(flushed).toBe(false);

    act(() => result.current.disconnect());
    act(() => serverEvent(channel, { type: "session.closed", reason: "close_requested" }));
    await waitFor(() => expect(result.current.connectionState).toBe("disconnected"));
    expect(result.current.pendingTextDraft).toBe("Then start the search");
    await flush;
    expect(flushed).toBe(false);
    await act(async () => resolveDelegate(completed("ignored", [])));
  });

  it("counts only work waiting behind the active backend request as queued", async () => {
    let resolveFirst!: (result: LiveDelegateResult) => void;
    let resolveSecond!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(
        () => new Promise<LiveDelegateResult>((resolve) => { resolveFirst = resolve; }),
      )
      .mockImplementationOnce(
        () => new Promise<LiveDelegateResult>((resolve) => { resolveSecond = resolve; }),
      );
    const { result } = await connect(delegate as never);
    act(() => expect(result.current.sendText("Update the saved budget")).toBe(true));
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    expect(result.current.backendState).toBe("processing");
    expect(result.current.pendingInputCount).toBe(0);

    act(() => expect(result.current.sendText("Then check availability")).toBe(true));
    expect(result.current.pendingInputCount).toBe(1);
    await act(async () => resolveFirst(completed("first", [])));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(result.current.backendState).toBe("processing");
    expect(result.current.pendingInputCount).toBe(0);
    await act(async () => resolveSecond(completed("second", [])));
  });

  it("does not count fact-capture housekeeping as pending input", async () => {
    let resolveFirst!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(
        () => new Promise<LiveDelegateResult>((resolve) => { resolveFirst = resolve; }),
      )
      .mockImplementation(async (args: { requestId: string; intent?: string }) => ({
        ...completed(args.requestId, []),
        ...(args.intent ? { spokenSummary: undefined } : {}),
      }));
    const { result, channel } = await connect(delegate as never, {
      enableEarlyFactCapture: true,
      earlyFactCaptureCadenceMs: 0,
    });
    act(() => expect(result.current.sendText("Update the saved budget")).toBe(true));
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    expect(result.current.pendingInputCount).toBe(0);

    // A spoken fact arms a capture_facts item behind the active request. It is
    // background housekeeping, not a message the musician is waiting on.
    act(() => serverEvent(channel, {
      type: "session.input_transcript.delta",
      event_id: "berlin-band",
      delta: "We are a four-piece band in Berlin. We're",
      start_ms: 100,
      end_ms: 900,
    }));
    expect(delegate).toHaveBeenCalledOnce();
    expect(result.current.backendState).toBe("processing");
    expect(result.current.pendingInputCount).toBe(0);

    act(() => expect(result.current.sendText("Then check availability")).toBe(true));
    expect(result.current.pendingInputCount).toBe(1);

    await act(async () => resolveFirst(completed("first", [])));
    await waitFor(() => expect(delegate).toHaveBeenCalledWith(expect.objectContaining({ intent: "capture_facts" })));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(3));
    await waitFor(() => expect(result.current.pendingInputCount).toBe(0));
  });

  it("keeps a deterministically rejected typed input for explicit manual retry", async () => {
    const rejection = Object.assign(new Error("INVALID_VOICE_REQUEST"), {
      data: { code: "INVALID_VOICE_REQUEST" },
    });
    const delegate = vi.fn()
      .mockRejectedValueOnce(rejection)
      .mockImplementation(async (args: { requestId: string }) => completed(args.requestId, []));
    const { result } = await connect(delegate as never);
    act(() => {
      expect(result.current.sendText("Start the search now")).toBe(true);
    });
    await waitFor(() => expect(result.current.backendState).toBe("failed"));
    expect(result.current.pendingTextDraft).toBe("Start the search now");
    await expect(result.current.flushPendingInputs()).resolves.toBe(false);
    act(() => expect(result.current.retryFailedInput()).toBe(true));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.backendState).toBe("idle"));
    expect(result.current.pendingTextDraft).toBe("");
    expect(delegate.mock.calls[1]?.[0].requestId).toBe(delegate.mock.calls[0]?.[0].requestId);
  });

  it("uses a fresh request ID when retrying a terminal failure cached by the backend", async () => {
    const delegate = vi.fn()
      .mockImplementationOnce(async (args: { requestId: string }): Promise<LiveDelegateResult> => ({
        status: "failed",
        requestId: args.requestId,
        resolvedEventIds: [],
        locale: "en",
      }))
      .mockImplementation(async (args: { requestId: string }) => completed(args.requestId, []));
    const { result } = await connect(delegate as never);
    act(() => {
      expect(result.current.sendText("Start the search now")).toBe(true);
    });
    await waitFor(() => expect(result.current.backendState).toBe("failed"));
    expect(result.current.pendingTextDraft).toBe("Start the search now");
    const failedRequestId = delegate.mock.calls[0]?.[0].requestId;

    act(() => expect(result.current.retryFailedInput()).toBe(true));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(delegate.mock.calls[1]?.[0].requestId).not.toBe(failedRequestId);
    expect(delegate.mock.calls[1]?.[0].text).toBe("Start the search now");
    await waitFor(() => expect(result.current.backendState).toBe("idle"));
    expect(result.current.pendingTextDraft).toBe("");
  });

  it("keeps a pre-admission superseded voice request for an explicit context-aware retry", async () => {
    const delegate = vi.fn()
      .mockImplementationOnce(async (args: { requestId: string }): Promise<LiveDelegateResult> => ({
        status: "superseded",
        requestId: args.requestId,
        resolvedEventIds: [],
        locale: "en",
      }))
      .mockImplementation(async (args: { requestId: string }) => completed(args.requestId, ["pause"]));
    const { channel, result } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "pause",
        delta: "Pause this search",
        start_ms: 0,
        end_ms: 300,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "pause-delegation", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(result.current.backendState).toBe("failed"));
    expect(result.current.error).toContain("context changed");
    const rejectedRequestId = delegate.mock.calls[0]?.[0].requestId;

    act(() => expect(result.current.retryFailedInput()).toBe(true));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(delegate.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        delegationId: "pause-delegation",
        fragments: [expect.objectContaining({ eventId: "pause", text: "Pause this search" })],
      }),
    );
    expect(delegate.mock.calls[1]?.[0].requestId).not.toBe(rejectedRequestId);
  });

  it("sends verified focus and background context with documented append events", async () => {
    const { result, sent } = await connect(vi.fn().mockResolvedValue(completed("none", [])) as never);
    act(() => result.current.setFocus({ summary: "The selected room is West Room; no offer is accepted." }));
    act(() => {
      expect(
        result.current.appendVerifiedBackgroundUpdate({
          id: "decision-1",
          version: 2,
          content: "The provider confirmed Wednesday. Decision 1 is still open.",
          speak: true,
        }),
      ).toBe(true);
      expect(
        result.current.appendVerifiedBackgroundUpdate({
          id: "decision-1",
          version: 2,
          content: "duplicate",
          speak: true,
        }),
      ).toBe(false);
    });
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "session.thinking.append", delegation_id: null }),
        expect.objectContaining({ type: "session.commentary.append", delegation_id: null }),
      ]),
    );
    act(() => {
      expect(
        result.current.appendVerifiedBackgroundUpdate({
          id: "brief-quiet",
          version: 3,
          content: "The saved brief now says Wednesday.",
          speak: false,
        }),
      ).toBe(true);
    });
    expect(sent.at(-1)).toEqual(
      expect.objectContaining({
        type: "session.thinking.append",
        content: "The saved brief now says Wednesday.",
      }),
    );
    act(() => {
      expect(
        result.current.appendVerifiedBackgroundUpdate({
          id: "discovery-phase",
          version: "active",
          content: "Apply phase search_active now. Stop discovery questions.",
          speak: false,
          instruction: true,
        }),
      ).toBe(true);
    });
    expect(sent.at(-1)).toEqual(
      expect.objectContaining({
        type: "session.instructions.append",
        content: "Apply phase search_active now. Stop discovery questions.",
      }),
    );
  });

  it("chunks large append context at sentence boundaries without dropping content", async () => {
    const content = [
      "Do not accept room ID raum_äöü_東京_🎸; it is not available. ",
      ...Array.from(
        { length: 18 },
        (_, index) => `Negation ${index}: do not remove Köln or budget €300.\n`,
      ),
      "Final fact: Wednesday remains required, not Thursday.",
    ].join("");
    const chunks = splitLiveAppendContent(content);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => new TextEncoder().encode(chunk).length <= 400)).toBe(true);
    expect(chunks.join("")).toBe(content);
    expect(chunks.join("").match(/do not/gi)).toHaveLength(19);

    const { result, sent } = await connect(
      vi.fn().mockResolvedValue(completed("none", [])) as never,
    );
    act(() => {
      expect(result.current.appendVerifiedBackgroundUpdate({
        id: "large-brief",
        version: 1,
        content,
        speak: false,
      })).toBe(true);
    });
    const appended = sent.filter((event) => event.type === "session.thinking.append");
    expect(appended.map((event) => event.content).join("")).toBe(content);
  });

  it("keeps remote audio stopped across trailing output until new user input", async () => {
    const { channel, result } = await connect(
      vi.fn().mockResolvedValue(completed("none", [])) as never,
    );
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    act(() => {
      serverEvent(channel, {
        type: "session.output_transcript.delta",
        event_id: "assistant-before-stop",
        delta: "Here is the first result",
        start_ms: 0,
        end_ms: 200,
      });
    });
    const callsBeforeStop = play.mock.calls.length;
    expect(callsBeforeStop).toBeGreaterThan(0);

    act(() => result.current.stopSpeaking());
    act(() => {
      serverEvent(channel, {
        type: "session.output_transcript.delta",
        event_id: "assistant-trailing",
        delta: "and a trailing fragment",
        start_ms: 210,
        end_ms: 400,
      });
    });
    expect(play).toHaveBeenCalledTimes(callsBeforeStop);

    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "user-next-turn",
        delta: "Tell me about the next room",
        start_ms: 500,
        end_ms: 700,
      });
      serverEvent(channel, {
        type: "session.output_transcript.delta",
        event_id: "assistant-next-turn",
        delta: "The next room is available",
        start_ms: 710,
        end_ms: 900,
      });
    });
    expect(play.mock.calls.length).toBeGreaterThan(callsBeforeStop);
  });

  it("uses live input volume to defer spoken updates across delayed caption gaps", async () => {
    const hook = await connect(
      vi.fn().mockResolvedValue(completed("none", [])) as never,
    );
    const { channel, result, sent, rerender } = hook;
    vi.useFakeTimers();
    try {
      act(() => {
        serverEvent(channel, {
          type: "session.input_transcript.delta",
          event_id: "speaking-now",
          delta: "Our rehearsal room budget is 300",
          start_ms: 0,
          end_ms: 500,
        });
        expect(result.current.appendVerifiedBackgroundUpdate({
          id: "provider-result",
          version: 1,
          content: "Old provider update.",
          speak: true,
        })).toBe(true);
        result.current.clearBackgroundUpdate("provider-result");
        expect(result.current.appendVerifiedBackgroundUpdate({
          id: "provider-result",
          version: 2,
          content: "Current provider update.",
          speak: true,
        })).toBe(true);
        expect(result.current.appendVerifiedBackgroundUpdate({
          id: "brief-quiet",
          version: 1,
          content: "Quiet saved brief update.",
          speak: false,
        })).toBe(true);
      });
      audioMocks.inputVolume = 0.2;
      act(() => rerender());
      expect(sent.some((event) => event.content === "Old provider update.")).toBe(false);
      expect(sent.some((event) => event.content === "Current provider update.")).toBe(false);
      expect(sent).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "session.thinking.append",
            content: "Quiet saved brief update.",
          }),
        ]),
      );

      act(() => vi.advanceTimersByTime(4_000));
      expect(sent.some((event) => event.content === "Current provider update.")).toBe(false);
      act(() => {
        serverEvent(channel, {
          type: "session.input_transcript.delta",
          event_id: "delayed-caption",
          delta: " and Tuesday evenings",
          start_ms: 510,
          end_ms: 900,
        });
      });
      act(() => vi.advanceTimersByTime(2_000));
      expect(sent.some((event) => event.content === "Current provider update.")).toBe(false);

      audioMocks.inputVolume = 0;
      act(() => rerender());
      act(() => vi.advanceTimersByTime(1_599));
      expect(sent.some((event) => event.content === "Current provider update.")).toBe(false);
      act(() => vi.advanceTimersByTime(2));
      expect(sent.some((event) => event.content === "Old provider update.")).toBe(false);
      expect(sent).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "session.commentary.append",
            content: "Current provider update.",
          }),
        ]),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not release queued speech on mute, reset, or manual stop", async () => {
    const hook = await connect(
      vi.fn().mockResolvedValue(completed("none", [])) as never,
    );
    const { channel, result, sent, rerender } = hook;
    vi.useFakeTimers();
    try {
      audioMocks.inputVolume = 0.2;
      act(() => rerender());
      act(() => {
        expect(result.current.appendVerifiedBackgroundUpdate({
          id: "muted-update",
          version: 1,
          content: "Announce after unmute.",
          speak: true,
        })).toBe(true);
        result.current.setMuted(true);
      });
      audioMocks.inputVolume = 0;
      act(() => rerender());
      act(() => vi.advanceTimersByTime(5_000));
      expect(sent.some((event) => event.content === "Announce after unmute.")).toBe(false);

      act(() => result.current.setMuted(false));
      act(() => vi.advanceTimersByTime(1_601));
      expect(sent.some((event) => event.content === "Announce after unmute.")).toBe(true);

      audioMocks.inputVolume = 0.2;
      act(() => rerender());
      act(() => {
        expect(result.current.appendVerifiedBackgroundUpdate({
          id: "stopped-update",
          version: 1,
          content: "Wait for the next user turn.",
          speak: true,
        })).toBe(true);
        result.current.stopSpeaking();
      });
      audioMocks.inputVolume = 0;
      act(() => rerender());
      act(() => vi.advanceTimersByTime(5_000));
      expect(sent.some((event) => event.content === "Wait for the next user turn.")).toBe(false);
      act(() => {
        serverEvent(channel, {
          type: "session.input_transcript.delta",
          event_id: "new-turn-after-stop",
          delta: "Continue now",
          start_ms: 1_000,
          end_ms: 1_200,
        });
      });
      act(() => vi.advanceTimersByTime(1_601));
      expect(sent.some((event) => event.content === "Wait for the next user turn.")).toBe(true);

      audioMocks.inputVolume = 0.2;
      act(() => rerender());
      act(() => {
        expect(result.current.appendVerifiedBackgroundUpdate({
          id: "reset-update",
          version: 1,
          content: "Never announce after disconnect.",
          speak: true,
        })).toBe(true);
        result.current.disconnect();
        serverEvent(channel, { type: "session.closed" });
      });
      act(() => vi.advanceTimersByTime(5_000));
      expect(sent.some((event) => event.content === "Never announce after disconnect.")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("can invalidate and rebuild a queued background update while connecting", async () => {
    const connection = installConnection();
    let resolveSession!: (answer: { answerSdp: string; voiceSessionId: string; provider: "live" }) => void;
    const createSession = vi.fn(
      () => new Promise((resolve) => { resolveSession = resolve; }),
    );
    const { result } = renderHook(() =>
      useGptLiveVoiceScout({ createSession: createSession as never, initialLocale: "en" }),
    );
    let connectPromise!: Promise<void>;
    act(() => { connectPromise = result.current.connect(); });
    await waitFor(() => expect(result.current.connectionState).toBe("connecting"));
    act(() => {
      expect(result.current.appendVerifiedBackgroundUpdate({
        id: "brief:need-1",
        version: 4,
        content: "Old budget: 300.",
        speak: false,
      })).toBe(true);
      result.current.clearBackgroundUpdate("brief:need-1");
      expect(result.current.appendVerifiedBackgroundUpdate({
        id: "brief:need-1",
        version: 4,
        content: "Current budget: 280.",
        speak: false,
      })).toBe(true);
    });
    await act(async () => resolveSession({ answerSdp: "answer", voiceSessionId: "voice-1", provider: "live" }));
    await act(async () => connectPromise);
    act(() => connection.channel.onopen?.(new Event("open")));
    await waitFor(() => expect(result.current.connectionState).toBe("active"));
    expect(connection.sent.some((event) => event.content === "Old budget: 300.")).toBe(false);
    expect(connection.sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "session.thinking.append",
          content: "Current budget: 280.",
        }),
      ]),
    );
  });

  it("captures a completed fact clause early and keeps it for the later native delegation", async () => {
    const delegate = vi.fn().mockImplementation(async (args: {
      requestId: string;
      intent?: string;
      fragments: Array<{ eventId: string }>;
    }) => ({
      ...completed(args.requestId, args.intent ? [] : args.fragments.map((fragment) => fragment.eventId)),
      ...(args.intent ? { spokenSummary: undefined, changedFields: ["location"] } : {}),
    }));
    const { channel, sent } = await connect(delegate as never, {
      enableEarlyFactCapture: true,
      earlyFactCaptureCadenceMs: 0,
    });
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "berlin-band",
        delta: "We are a four-piece band in Berlin. We're",
        start_ms: 100,
        end_ms: 900,
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    expect(delegate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        source: "voice",
        intent: "capture_facts",
        fragments: [
          expect.objectContaining({
            eventId: "berlin-band",
            text: "We are a four-piece band in Berlin.",
          }),
        ],
      }),
    );
    expect(delegate.mock.calls[0]?.[0]).not.toHaveProperty("delegationId");
    expect(sent.some((event) => event.type === "session.commentary.append")).toBe(false);

    act(() => {
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "native-delegation", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(delegate.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        requestId: "native-delegation",
        delegationId: "native-delegation",
        fragments: [
          expect.objectContaining({
            eventId: "berlin-band",
            text: "We are a four-piece band in Berlin. We're",
          }),
        ],
      }),
    );
    expect(delegate.mock.calls[1]?.[0]).not.toHaveProperty("intent");
  });

  it("does not capture incomplete numbers, greetings, or facts when early capture is disabled", async () => {
    const enabledDelegate = vi.fn().mockImplementation(async (args: { requestId: string }) =>
      completed(args.requestId, []),
    );
    const enabled = await connect(enabledDelegate as never, {
      enableEarlyFactCapture: true,
      earlyFactCaptureCadenceMs: 0,
    });
    act(() => {
      serverEvent(enabled.channel, {
        type: "session.input_transcript.delta",
        event_id: "hello",
        delta: "Hi, nice to meet you.",
        start_ms: 0,
        end_ms: 100,
      });
      serverEvent(enabled.channel, {
        type: "session.input_transcript.delta",
        event_id: "unfinished-number",
        delta: " Our rehearsal budget is 300",
        start_ms: 110,
        end_ms: 300,
      });
    });
    await Promise.resolve();
    expect(enabledDelegate).not.toHaveBeenCalled();
    act(() => enabled.result.current.disconnect());
    act(() => serverEvent(enabled.channel, { type: "session.closed" }));

    const disabledDelegate = vi.fn().mockImplementation(async (args: { requestId: string }) =>
      completed(args.requestId, []),
    );
    const disabled = await connect(disabledDelegate as never, {
      enableEarlyFactCapture: false,
      earlyFactCaptureCadenceMs: 0,
    });
    act(() => {
      serverEvent(disabled.channel, {
        type: "session.input_transcript.delta",
        event_id: "disabled-fact",
        delta: "We need a rehearsal room in Berlin.",
        start_ms: 0,
        end_ms: 400,
      });
    });
    await Promise.resolve();
    expect(disabledDelegate).not.toHaveBeenCalled();
  });

  it("coalesces corrections behind one running capture and dispatches them serially", async () => {
    let resolveFirst!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(
        (args: { requestId: string }) =>
          new Promise<LiveDelegateResult>((resolve) => {
            resolveFirst = (result) => resolve({ ...result, requestId: args.requestId });
          }),
      )
      .mockImplementation(async (args: { requestId: string }) => ({
        ...completed(args.requestId, []),
        spokenSummary: undefined,
      }));
    const { channel } = await connect(delegate as never, {
      enableEarlyFactCapture: true,
      earlyFactCaptureCadenceMs: 0,
    });
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "budget-first",
        delta: "Our rehearsal budget is 300 euros. Actually",
        start_ms: 0,
        end_ms: 400,
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "budget-correction",
        delta: ", our rehearsal budget is 280 euros. Please",
        start_ms: 410,
        end_ms: 800,
      });
    });
    expect(delegate).toHaveBeenCalledOnce();
    await act(async () =>
      resolveFirst({
        status: "completed",
        requestId: "ignored",
        resolvedEventIds: [],
        locale: "en",
      }),
    );
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(delegate.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({
        intent: "capture_facts",
        fragments: expect.arrayContaining([
          expect.objectContaining({ eventId: "budget-first", text: " Actually" }),
          expect.objectContaining({
            eventId: "budget-correction",
            text: ", our rehearsal budget is 280 euros.",
          }),
        ]),
      }),
    );
  });

  it("runs a native delegation before a fact capture that has not started", async () => {
    let resolveTyped!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(
        () => new Promise<LiveDelegateResult>((resolve) => { resolveTyped = resolve; }),
      )
      .mockImplementation(async (args: {
        requestId: string;
        fragments: Array<{ eventId: string }>;
      }) => completed(args.requestId, args.fragments.map((fragment) => fragment.eventId)));
    const { channel, result } = await connect(delegate as never, {
      enableEarlyFactCapture: true,
      earlyFactCaptureCadenceMs: 0,
    });
    act(() => expect(result.current.sendText("Keep listening")).toBe(true));
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "priority-fact",
        delta: "We need a rehearsal room in Berlin. More",
        start_ms: 0,
        end_ms: 500,
      });
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "priority-native", type: "delegation", target: "client" },
      });
    });
    await act(async () => resolveTyped(completed("typed", [])));
    await waitFor(() => expect(delegate).toHaveBeenCalledTimes(2));
    expect(delegate.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ requestId: "priority-native", delegationId: "priority-native" }),
    );
    expect(delegate.mock.calls[1]?.[0]).not.toHaveProperty("intent");
  });

  it("speaks a current verified farewell, waits for output-meter quiet, then closes once", async () => {
    const delegate = vi.fn().mockImplementation(async (args: {
      requestId: string;
      fragments: Array<{ eventId: string }>;
    }) => ({
      ...completed(args.requestId, args.fragments.map((fragment) => fragment.eventId)),
      spokenSummary: "Wednesday is saved.",
      endCall: { reason: "user_request" as const, farewell: "Goodbye for now." },
    }));
    const hook = await connect(delegate as never, {
      idleTimeoutMs: 60_000,
      farewellOutputQuietMs: 100,
      farewellMaxWaitMs: 5_000,
    });
    act(() => {
      serverEvent(hook.channel, {
        type: "session.input_transcript.delta",
        event_id: "goodbye-input",
        delta: "Save Wednesday and end the call",
        start_ms: 0,
        end_ms: 500,
      });
      serverEvent(hook.channel, {
        type: "session.delegation.created",
        delegation: { id: "goodbye-request", type: "delegation", target: "client" },
      });
    });
    await waitFor(() => expect(hook.sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      content: "Wednesday is saved. Goodbye for now.",
    })));
    const farewell = hook.sent.find((event) => event.content === "Wednesday is saved. Goodbye for now.");
    act(() => serverEvent(hook.channel, {
      type: "session.commentary.appended",
      client_event_id: farewell?.event_id,
    }));
    expect(hook.sent.some((event) => event.type === "session.close")).toBe(false);

    vi.useFakeTimers();
    try {
      audioMocks.outputVolume = 0.2;
      hook.rerender();
      audioMocks.outputVolume = 0;
      hook.rerender();
      act(() => vi.advanceTimersByTime(99));
      expect(hook.sent.some((event) => event.type === "session.close")).toBe(false);
      act(() => vi.advanceTimersByTime(1));
      expect(hook.sent.some((event) => event.type === "session.close")).toBe(true);
      act(() => serverEvent(hook.channel, { type: "session.closed" }));
      expect(hook.result.current.connectionState).toBe("disconnected");
      expect(hook.result.current.automaticEndToken).toBe(1);
      expect(convexMocks.mutation).toHaveBeenCalledWith({ voiceSessionId: "voice-1" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("honors a validated end-call despite newer voice and preserves queued typed draft", async () => {
    let finishFirst!: (result: LiveDelegateResult) => void;
    const delegate = vi.fn()
      .mockImplementationOnce(() => new Promise<LiveDelegateResult>((resolve) => { finishFirst = resolve; }));
    const hook = await connect(delegate as never, { idleTimeoutMs: 60_000 });
    act(() => {
      serverEvent(hook.channel, { type: "session.input_transcript.delta", event_id: "bye-a", delta: "Goodbye", start_ms: 0, end_ms: 100 });
      serverEvent(hook.channel, { type: "session.delegation.created", delegation: { id: "bye-a-request", type: "delegation", target: "client" } });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    act(() => {
      serverEvent(hook.channel, { type: "session.input_transcript.delta", event_id: "filler-b", delta: "Uh", start_ms: 110, end_ms: 250 });
      serverEvent(hook.channel, { type: "session.delegation.created", delegation: { id: "filler-b-request", type: "delegation", target: "client" } });
      expect(hook.result.current.sendText("Keep this typed draft")).toBe(true);
    });
    await act(async () => finishFirst({
      ...completed("bye-a-request", ["bye-a"]),
      endCall: { reason: "farewell", farewell: "Goodbye now." },
    }));
    await waitFor(() => expect(hook.sent).toContainEqual(expect.objectContaining({
      type: "session.commentary.append",
      content: "Wednesday is saved. Goodbye now.",
    })));
    expect(delegate).toHaveBeenCalledOnce();
    expect(hook.result.current.microphoneState).toBe("off");
    expect(hook.result.current.pendingTextDraft).toBe("Keep this typed draft");
    act(() => serverEvent(hook.channel, { type: "session.closed" }));
    expect(hook.result.current.pendingTextDraft).toBe("Keep this typed draft");
  });

  it("ignores an end-call directive on a failed result", async () => {
    const delegate = vi.fn().mockImplementation(async (args: { requestId: string }) => ({
      ...completed(args.requestId, []),
      status: "failed" as const,
      endCall: { reason: "farewell" as const, farewell: "Should not play." },
    }));
    const hook = await connect(delegate as never, { idleTimeoutMs: 60_000 });
    act(() => expect(hook.result.current.sendText("test failed ending")).toBe(true));
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    await waitFor(() => expect(hook.result.current.backendState).toBe("failed"));
    expect(hook.sent.some((event) => event.content === "Should not play.")).toBe(false);
    expect(hook.result.current.microphoneState).toBe("on");
  });

  it("checks presence after idle, recovers from blocked grace, then says goodbye", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const hook = await connect(
        vi.fn().mockImplementation(async (args: { requestId: string }) => completed(args.requestId, [])) as never,
        {
          idleTimeoutMs: 100,
          idleGraceMs: 50,
          farewellOutputQuietMs: 20,
          farewellMaxWaitMs: 100,
          closeAckTimeoutMs: 20,
        },
      );
      act(() => vi.advanceTimersByTime(100));
      expect(hook.sent).toContainEqual(expect.objectContaining({
        type: "session.commentary.append",
        content: "Are you still there?",
      }));

      act(() => hook.result.current.noteActivity());
      act(() => vi.advanceTimersByTime(99));
      expect(hook.sent.some((event) => String(event.content).includes("I’ll end"))).toBe(false);
      act(() => vi.advanceTimersByTime(1));

      audioMocks.outputVolume = 0.2;
      hook.rerender();
      act(() => vi.advanceTimersByTime(1_050));
      expect(hook.sent.some((event) => String(event.content).includes("I’ll end"))).toBe(false);

      audioMocks.outputVolume = 0;
      hook.rerender();
      act(() => vi.advanceTimersByTime(1_000));
      expect(hook.sent).toContainEqual(expect.objectContaining({
        type: "session.commentary.append",
        content: "I’ll end the voice call for now. I’ll be here when you’re back.",
      }));
      act(() => vi.advanceTimersByTime(100));
      expect(hook.sent.some((event) => event.type === "session.close")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
