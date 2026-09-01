import { useAuthToken } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAudioVolume } from "./useAudioVolume";

export type VoiceScoutStatus =
  | "idle"
  | "requesting_microphone"
  | "connecting"
  | "creating_session"
  | "listening"
  | "thinking"
  | "speaking"
  | "disconnected"
  | "error";

export type VoiceScoutModality = "voice" | "text";

export type VoiceTranscriptItem = {
  id: string;
  role: "user" | "assistant";
  text: string;
  final: boolean;
};

export type RealtimeServerEvent = {
  type: string;
  event_id?: string;
  item_id?: string;
  response_id?: string;
  transcript?: string;
  delta?: string;
  text?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  error?: { message?: string; code?: string };
  [key: string]: unknown;
};

export type UseRealtimeVoiceScoutOptions = {
  /** Authenticated Convex HTTP action that exchanges raw SDP with OpenAI. */
  sessionEndpoint?: string;
  /** Override for tests or a custom authenticated SDP transport. */
  createSession?: (sdp: string, convexAccessToken: string) => Promise<string | RealtimeSessionAnswer>;
  initialModality?: VoiceScoutModality;
  onEvent?: (event: RealtimeServerEvent) => void;
};

export type RealtimeSessionAnswer = {
  answerSdp: string;
  voiceSessionId?: Id<"voiceSessions">;
};

function defaultSessionEndpoint() {
  const cloudUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  const derivedSiteUrl = cloudUrl?.replace(/\.convex\.cloud$/, ".convex.site");
  const siteUrl = derivedSiteUrl ?? import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  return siteUrl
    ? `${siteUrl.replace(/\/$/, "")}/api/realtime/session`
    : "/api/realtime/session";
}

export async function createRealtimeSession(
  endpoint: string,
  sdp: string,
  convexAccessToken: string,
): Promise<RealtimeSessionAnswer> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "omit",
    headers: {
      Accept: "application/sdp",
      Authorization: `Bearer ${convexAccessToken}`,
      "Content-Type": "application/sdp",
    },
    body: sdp,
  });
  const answerSdp = await response.text();
  if (!response.ok || !answerSdp.trim()) {
    throw new Error(answerSdp.trim() || `Could not start voice session (${response.status})`);
  }
  const voiceSessionId = response.headers.get("X-RoomScout-Voice-Session") as Id<"voiceSessions"> | null;
  return { answerSdp, voiceSessionId: voiceSessionId ?? undefined };
}

function eventText(event: RealtimeServerEvent) {
  return typeof event.transcript === "string"
    ? event.transcript
    : typeof event.delta === "string"
      ? event.delta
      : typeof event.text === "string"
        ? event.text
        : "";
}

function upsertTranscript(
  current: VoiceTranscriptItem[],
  item: VoiceTranscriptItem,
) {
  const existing = current.findIndex((entry) => entry.id === item.id);
  if (existing < 0) return [...current, item].slice(-24);
  return current.map((entry, index) => index === existing ? item : entry);
}

export function useRealtimeVoiceScout(options: UseRealtimeVoiceScoutOptions = {}) {
  const accessToken = useAuthToken();
  const executeTool = useAction(api.voice.executeTool);
  const getInstructions = useAction(api.voice.getInstructions);
  const recordTranscript = useMutation(api.voice.recordTranscript);
  const endVoiceSession = useMutation(api.voice.endMine);
  const scoutContext = useQuery(api.scout.getMine);
  const endpoint = options.sessionEndpoint ?? defaultSessionEndpoint();
  const [status, setStatus] = useState<VoiceScoutStatus>("idle");
  const [modality, setModalityState] = useState<VoiceScoutModality>(options.initialModality ?? "voice");
  const [muted, setMutedState] = useState(false);
  const [error, setError] = useState<string>();
  const [transcript, setTranscript] = useState<VoiceTranscriptItem[]>([]);
  const [connectedAt, setConnectedAt] = useState<number>();
  const [connected, setConnected] = useState(false);

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const voiceSessionIdRef = useRef<Id<"voiceSessions"> | undefined>(undefined);
  const connectingRef = useRef(false);
  const modalityRef = useRef(modality);
  const onEventRef = useRef(options.onEvent);
  const contextVersionRef = useRef("");
  const {
    volume: inputVolume,
    attach: attachInputMeter,
    detach: detachInputMeter,
  } = useAudioVolume();
  const {
    volume: outputVolume,
    attach: attachOutputMeter,
    detach: detachOutputMeter,
  } = useAudioVolume();
  const createSession = options.createSession;

  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);
  useEffect(() => {
    modalityRef.current = modality;
  }, [modality]);

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (!channel || channel.readyState !== "open") return false;
    channel.send(JSON.stringify(event));
    return true;
  }, []);

  const cleanup = useCallback(() => {
    channelRef.current?.close();
    peerRef.current?.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    channelRef.current = null;
    peerRef.current = null;
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    remoteAudioRef.current = null;
    connectingRef.current = false;
    setConnected(false);
    detachInputMeter();
    detachOutputMeter();
  }, [detachInputMeter, detachOutputMeter]);

  const disconnect = useCallback(() => {
    const voiceSessionId = voiceSessionIdRef.current;
    voiceSessionIdRef.current = undefined;
    if (voiceSessionId) void endVoiceSession({ voiceSessionId }).catch(() => undefined);
    cleanup();
    setMutedState(false);
    setConnectedAt(undefined);
    setStatus("disconnected");
  }, [cleanup, endVoiceSession]);

  const persistTranscript = useCallback((event: RealtimeServerEvent, role: "user" | "assistant", transcriptText: string) => {
    const voiceSessionId = voiceSessionIdRef.current;
    const providerEventId = event.event_id ?? event.item_id ?? event.response_id;
    const text = transcriptText.trim();
    if (!voiceSessionId || !providerEventId || !text) return;
    void recordTranscript({
      voiceSessionId,
      providerEventId,
      itemId: event.item_id,
      role,
      transcript: text,
    }).catch(() => undefined);
  }, [recordTranscript]);

  const executeRealtimeTool = useCallback(async (event: RealtimeServerEvent) => {
    const voiceSessionId = voiceSessionIdRef.current;
    const name = event.name;
    const callId = event.call_id;
    if (!voiceSessionId || !name || !callId) return;
    const allowedNames = [
      "get_current_search",
      "update_search_draft",
      "remember_fact",
      "recall_relevant_memory",
      "get_focused_signal",
      "create_outreach_draft",
      "create_webform_draft",
    ] as const;
    if (!allowedNames.includes(name as (typeof allowedNames)[number])) return;
    try {
      const result = await executeTool({
        voiceSessionId,
        name: name as (typeof allowedNames)[number],
        argumentsJson: event.arguments || "{}",
      });
      sendEvent({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output: result.outputJson },
      });
    } catch (cause) {
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ error: cause instanceof Error ? cause.message : "Tool execution failed" }),
        },
      });
    }
    sendEvent({ type: "response.create" });
  }, [executeTool, sendEvent]);

  const handleServerEvent = useCallback((event: RealtimeServerEvent) => {
    onEventRef.current?.(event);
    const type = event.type;
    if (type === "error") {
      setError(event.error?.message ?? "The Realtime session reported an error.");
      setStatus("error");
      return;
    }
    if (type === "input_audio_buffer.speech_started") setStatus("listening");
    if (type === "input_audio_buffer.speech_stopped" || type === "response.created") setStatus("thinking");
    if (type === "output_audio_buffer.started" || type === "response.output_audio.delta") setStatus("speaking");
    if (type === "output_audio_buffer.stopped" || type === "response.done") setStatus("listening");

    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = eventText(event).trim();
      if (text) {
        setTranscript((current) => upsertTranscript(current, {
          id: event.item_id ?? event.event_id ?? `user-${Date.now()}`,
          role: "user",
          text,
          final: true,
        }));
        persistTranscript(event, "user", text);
      }
    }
    if (type === "response.output_audio_transcript.delta" || type === "response.output_text.delta") {
      const text = eventText(event);
      if (!text) return;
      const id = event.item_id ?? event.response_id ?? "assistant-live";
      setTranscript((current) => {
        const previous = current.find((entry) => entry.id === id)?.text ?? "";
        return upsertTranscript(current, { id, role: "assistant", text: previous + text, final: false });
      });
    }
    if (type === "response.output_audio_transcript.done" || type === "response.output_text.done") {
      const text = eventText(event).trim();
      const id = event.item_id ?? event.response_id ?? "assistant-live";
      if (text) {
        setTranscript((current) => upsertTranscript(current, { id, role: "assistant", text, final: true }));
        persistTranscript(event, "assistant", text);
      }
    }
    if (type === "response.function_call_arguments.done") void executeRealtimeTool(event);
  }, [executeRealtimeTool, persistTranscript]);

  const connect = useCallback(async () => {
    if (connectingRef.current) return;
    if (peerRef.current) cleanup();
    if (!accessToken) {
      setError("Sign in before starting a private voice session.");
      setStatus("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone capture.");
      setStatus("error");
      return;
    }

    connectingRef.current = true;
    setError(undefined);
    setStatus("requesting_microphone");

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
      });
      localStreamRef.current = localStream;
      await attachInputMeter(localStream);

      setStatus("connecting");
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "");
      remoteAudioRef.current = remoteAudio;

      peer.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        remoteStreamRef.current = stream;
        remoteAudio.srcObject = stream;
        void remoteAudio.play().catch(() => undefined);
        void attachOutputMeter(stream);
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "failed") {
          setConnected(false);
          setError("The realtime peer connection failed.");
          setStatus("error");
        }
        if (peer.connectionState === "disconnected" || peer.connectionState === "closed") {
          setConnected(false);
          setStatus("disconnected");
        }
      };

      for (const track of localStream.getAudioTracks()) peer.addTrack(track, localStream);

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        setConnectedAt(Date.now());
        setConnected(true);
        setStatus("listening");
        connectingRef.current = false;
        channel.send(JSON.stringify({
          type: "session.update",
          session: {
            type: "realtime",
            output_modalities: [modalityRef.current === "voice" ? "audio" : "text"],
          },
        }));
      };
      channel.onclose = () => {
        setConnected(false);
        setStatus("disconnected");
      };
      channel.onerror = () => {
        setConnected(false);
        setError("The Realtime event channel failed.");
        setStatus("error");
      };
      channel.onmessage = (message) => {
        try {
          handleServerEvent(JSON.parse(String(message.data)) as RealtimeServerEvent);
        } catch {
          setError("Received an unreadable Realtime event.");
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (!offer.sdp) throw new Error("The browser did not create a WebRTC offer.");
      setStatus("creating_session");
      const sessionAnswer = createSession
        ? await createSession(offer.sdp, accessToken)
        : await createRealtimeSession(endpoint, offer.sdp, accessToken);
      const { answerSdp, voiceSessionId } = typeof sessionAnswer === "string"
        ? { answerSdp: sessionAnswer, voiceSessionId: undefined }
        : sessionAnswer;
      voiceSessionIdRef.current = voiceSessionId;
      await peer.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (cause) {
      cleanup();
      const message = cause instanceof DOMException && cause.name === "NotAllowedError"
        ? "Microphone access was not allowed."
        : cause instanceof Error
          ? cause.message
          : "Could not start the Realtime session.";
      setError(message);
      setStatus("error");
    } finally {
      connectingRef.current = false;
    }
  }, [accessToken, attachInputMeter, attachOutputMeter, cleanup, createSession, endpoint, handleServerEvent]);

  const setMuted = useCallback((nextMuted: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMutedState(nextMuted);
  }, []);

  const setModality = useCallback((nextModality: VoiceScoutModality) => {
    modalityRef.current = nextModality;
    setModalityState(nextModality);
    sendEvent({
      type: "session.update",
      session: { type: "realtime", output_modalities: [nextModality === "voice" ? "audio" : "text"] },
    });
  }, [sendEvent]);

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const id = `typed-${Date.now()}`;
    const sent = sendEvent({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text: trimmed }] },
    });
    if (!sent) return false;
    setTranscript((current) => upsertTranscript(current, { id, role: "user", text: trimmed, final: true }));
    const voiceSessionId = voiceSessionIdRef.current;
    if (voiceSessionId) {
      void recordTranscript({
        voiceSessionId,
        providerEventId: id,
        role: "user",
        transcript: trimmed,
      }).catch(() => undefined);
    }
    sendEvent({ type: "response.create", response: { output_modalities: [modality === "voice" ? "audio" : "text"] } });
    setStatus("thinking");
    return true;
  }, [modality, recordTranscript, sendEvent]);

  const interrupt = useCallback(() => {
    sendEvent({ type: "response.cancel" });
    sendEvent({ type: "output_audio_buffer.clear" });
    setStatus("listening");
  }, [sendEvent]);

  useEffect(() => {
    if (!connected || !scoutContext) return;
    const nextVersion = `${scoutContext.mode}:${scoutContext.activeNeedId ?? "none"}:${scoutContext.focusedSignalId ?? "none"}`;
    if (contextVersionRef.current === nextVersion) return;
    contextVersionRef.current = nextVersion;
    void getInstructions().then((result) => {
      sendEvent({
        type: "session.update",
        session: { type: "realtime", instructions: result.instructions },
      });
    }).catch(() => undefined);
  }, [connected, getInstructions, scoutContext, sendEvent]);

  useEffect(() => {
    if (!connectedAt) return;
    const remaining = Math.max(0, 15 * 60 * 1_000 - (Date.now() - connectedAt));
    const timeout = window.setTimeout(disconnect, remaining);
    return () => window.clearTimeout(timeout);
  }, [connectedAt, disconnect]);

  useEffect(() => disconnect, [disconnect]);

  const volume = status === "speaking" ? outputVolume : muted ? 0 : inputVolume;
  return {
    status,
    modality,
    muted,
    error,
    transcript,
    connectedAt,
    connected,
    volume,
    connect,
    disconnect,
    setMuted,
    setModality,
    sendText,
    interrupt,
    sendEvent,
  };
}
