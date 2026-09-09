import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { createRealtimeSession, useRealtimeVoiceScout } from "./useRealtimeVoiceScout";

vi.mock("@convex-dev/auth/react", () => ({ useAuthToken: () => "token" }));
const convexMocks = vi.hoisted(() => ({ action: vi.fn().mockResolvedValue({ instructions: "Help with the current search." }), mutation: vi.fn().mockResolvedValue(undefined) }));
const audioMocks = vi.hoisted(() => ({ attach: vi.fn().mockResolvedValue(undefined), detach: vi.fn() }));
vi.mock("convex/react", () => ({
  useAction: () => convexMocks.action,
  useMutation: () => convexMocks.mutation,
  useQuery: () => ({ mode: "search_discovery", activeNeedId: null, focusedSignalId: null }),
}));
vi.mock("./useAudioVolume", () => ({ useAudioVolume: () => ({ volume: 0, attach: audioMocks.attach, detach: audioMocks.detach }) }));

beforeEach(() => {
  vi.restoreAllMocks();
  convexMocks.action.mockClear();
  convexMocks.mutation.mockClear();
});

it("does not resurrect a connection when microphone startup resolves after disconnect", async () => {
  let resolveStream!: (stream: MediaStream) => void;
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }], getAudioTracks: () => [] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn(() => new Promise<MediaStream>((resolve) => { resolveStream = resolve; })) } });
  const createSession = vi.fn();
  const { result } = renderHook(() => useRealtimeVoiceScout({ createSession }));
  act(() => { void result.current.connect(); });
  await waitFor(() => expect(result.current.status).toBe("requesting_microphone"));
  act(() => result.current.disconnect());
  await act(async () => resolveStream(stream));
  await waitFor(() => expect(stop).toHaveBeenCalledOnce());
  expect(createSession).not.toHaveBeenCalled();
  expect(result.current.connected).toBe(false);
});

it("does not expose a failed session response body", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, text: () => Promise.resolve("request req_private: raw provider body"), headers: new Headers() }));
  await expect(createRealtimeSession("/session", "offer", "token")).rejects.toThrow("Voice session request failed");
});

it("ends the server session and detaches stale callbacks when remote setup fails", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }], getAudioTracks: () => [] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const channel = {
    readyState: "connecting",
    send: vi.fn(), close: vi.fn(),
    onopen: null, onclose: null, onerror: null, onmessage: null,
  } as unknown as RTCDataChannel;
  const peer = {
    connectionState: "new",
    ontrack: null, onconnectionstatechange: null,
    addTrack: vi.fn(), close: vi.fn(), createDataChannel: vi.fn(() => channel),
    createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "offer-sdp" }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined),
    setRemoteDescription: vi.fn().mockRejectedValue(new Error("raw remote failure")),
  } as unknown as RTCPeerConnection;
  function MockPeerConnection() { return peer; }
  vi.stubGlobal("RTCPeerConnection", MockPeerConnection);
  const createSession = vi.fn().mockResolvedValue({ answerSdp: "answer-sdp", voiceSessionId: "voice-1" });
  const { result } = renderHook(() => useRealtimeVoiceScout({ createSession }));
  await act(async () => { await result.current.connect(); });
  expect(convexMocks.mutation).toHaveBeenCalledWith({ voiceSessionId: "voice-1" });
  expect(stop).toHaveBeenCalledOnce();
  expect(channel.onclose).toBeNull();
  expect(peer.onconnectionstatechange).toBeNull();
  expect(result.current.status).toBe("error");
  expect(result.current.error).not.toContain("raw remote failure");
});

it("drops a tool result that completes after its connection is closed", async () => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
  let resolveTool!: (value: { outputJson: string }) => void;
  convexMocks.action.mockImplementation((args?: { name?: string }) => args?.name
    ? new Promise((resolve) => { resolveTool = resolve; })
    : Promise.resolve({ instructions: "Help with this search." }));
  const stream = { getTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream;
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn().mockResolvedValue(stream) } });
  const sent: string[] = [];
  const channel = { readyState: "open", send: vi.fn((value: string) => sent.push(value)), close: vi.fn(), onopen: null, onclose: null, onerror: null, onmessage: null } as unknown as RTCDataChannel;
  const peer = { connectionState: "connected", ontrack: null, onconnectionstatechange: null, addTrack: vi.fn(), close: vi.fn(), createDataChannel: vi.fn(() => channel), createOffer: vi.fn().mockResolvedValue({ type: "offer", sdp: "offer" }), setLocalDescription: vi.fn(), setRemoteDescription: vi.fn() } as unknown as RTCPeerConnection;
  function MockPeerConnection() { return peer; }
  vi.stubGlobal("RTCPeerConnection", MockPeerConnection);
  const { result } = renderHook(() => useRealtimeVoiceScout({ createSession: vi.fn().mockResolvedValue({ answerSdp: "answer", voiceSessionId: "voice-old" }) }));
  await act(async () => { await result.current.connect(); });
  act(() => { channel.onopen?.(new Event("open")); });
  act(() => { channel.onmessage?.({ data: JSON.stringify({ type: "response.done", response: { status: "completed", output: [{ type: "function_call", call_id: "call-old", name: "remember_fact", arguments: "{}" }] } }) } as MessageEvent); });
  await waitFor(() => expect(convexMocks.action).toHaveBeenCalledWith(expect.objectContaining({ name: "remember_fact" })));
  act(() => result.current.disconnect());
  await act(async () => resolveTool({ outputJson: "{\"ok\":true}" }));
  expect(sent.some((value) => value.includes("function_call_output"))).toBe(false);
});
