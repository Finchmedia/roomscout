import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveDelegateResult } from "./useGptLiveVoiceScout";
import { createGptLiveSession, useGptLiveVoiceScout } from "./useGptLiveVoiceScout";

vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "token" }));
const convexMocks = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn().mockResolvedValue({ locale: "en", languageRevision: 1 }),
}));
const audioMocks = vi.hoisted(() => ({
  attach: vi.fn().mockResolvedValue(undefined),
  detach: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useAction: () => convexMocks.action,
  useMutation: () => convexMocks.mutation,
  useQuery: () => undefined,
}));
vi.mock("./useAudioVolume", () => ({
  useAudioVolume: () => ({ volume: 0, attach: audioMocks.attach, detach: audioMocks.detach }),
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
  audioMocks.attach.mockClear();
  audioMocks.detach.mockClear();
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

describe("useGptLiveVoiceScout", () => {
  async function connect(delegate: (args: never) => Promise<LiveDelegateResult>) {
    const connection = installConnection();
    const createSession = vi.fn().mockResolvedValue({
      answerSdp: "answer-sdp",
      voiceSessionId: "voice-1",
      provider: "live",
    });
    const hook = renderHook(() =>
      useGptLiveVoiceScout({ createSession, delegate: delegate as never, initialLocale: "en" }),
    );
    await act(async () => hook.result.current.connect());
    act(() => connection.channel.onopen?.(new Event("open")));
    await waitFor(() => expect(hook.result.current.connectionState).toBe("active"));
    return { ...connection, ...hook };
  }

  it("retains an early delegation until a user fragment arrives", async () => {
    const delegate = vi.fn().mockImplementation(async (args: { requestId: string }) =>
      completed(args.requestId, ["user-fragment"]),
    );
    const { channel, result } = await connect(delegate as never);
    act(() => {
      serverEvent(channel, {
        type: "session.delegation.created",
        delegation: { id: "delegation-1", type: "delegation", target: "client" },
      });
    });
    expect(delegate).not.toHaveBeenCalled();
    expect(result.current.pendingInputCount).toBe(1);

    act(() => {
      serverEvent(channel, {
        type: "session.input_transcript.delta",
        event_id: "user-fragment",
        delta: "Wednesday instead",
        start_ms: 100,
        end_ms: 500,
      });
    });
    await waitFor(() => expect(delegate).toHaveBeenCalledOnce());
    expect(delegate).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceSessionId: "voice-1",
        requestId: "delegation-1",
        delegationId: "delegation-1",
        source: "voice",
        fragments: [
          expect.objectContaining({ eventId: "user-fragment", role: "user", text: "Wednesday instead" }),
        ],
      }),
    );
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
    await act(async () => resolveDelegate(completed("delegation-room", ["room-question"])));
    expect(result.current.sessionLocale).toBe("de");
    expect(sent.some((event) => event.type === "session.commentary.append")).toBe(false);
    expect(sent).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "session.thinking.append" }),
        expect.objectContaining({ type: "session.instructions.append" }),
      ]),
    );
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
});
