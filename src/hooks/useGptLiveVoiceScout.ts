import { useAuthToken } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import {
  GptLiveFragmentBuffer,
  GptLiveContextOverflowError,
  isClientDelegationEvent,
  isLiveTranscriptEvent,
  isRetryablePreclaimFailure,
  safeLiveError,
  safeLiveProviderError,
  type LiveCaptionRow,
  type LiveDelegationSnapshot,
  type LiveLocale,
  type LiveServerEvent,
  type LiveTranscriptFragment,
} from "../features/voice/gptLiveRuntime";
import type {
  VoiceScoutModality,
  VoiceScoutStatus,
  VoiceTranscriptItem,
} from "./useRealtimeVoiceScout";
import { useAudioVolume } from "./useAudioVolume";

export type LiveConnectionState =
  | "disconnected"
  | "connecting"
  | "active"
  | "closing"
  | "error";
export type LiveMicrophoneState = "off" | "on" | "locally_muted";
export type LiveBackendState =
  | "idle"
  | "queued"
  | "processing"
  | "waiting_for_clarification"
  | "failed"
  | "outcome_unknown";

export type LiveDelegateResult = {
  status:
    | "in_progress"
    | "busy"
    | "completed"
    | "needs_clarification"
    | "superseded"
    | "failed"
    | "outcome_unknown";
  requestId: string;
  resolvedEventIds: string[];
  spokenSummary?: string;
  locale: LiveLocale;
  revision?: number;
  promptMessageId?: string;
  assistantMessageId?: string;
  changedFields?: string[];
  verifiedFacts?: string[];
};

export type LiveSessionState = {
  voiceSessionId: Id<"voiceSessions">;
  status: "connecting" | "active" | "ended" | "error";
  provider: "live" | "realtime";
  locale: LiveLocale;
  languageRevision: number;
  activeRequest?: { requestId: string; source: "voice" | "text"; startedAt: number };
  lastResult?: LiveDelegateResult;
  current: {
    activeNeedId?: Id<"savedNeeds">;
    needRevision?: number;
    needStatus?: string;
    focusedSignalId?: Id<"signals">;
    decisionId?: Id<"decisions">;
    decisionStatus?: string;
  };
};

type LiveDelegateArgs = {
  voiceSessionId: Id<"voiceSessions">;
  requestId: string;
  delegationId?: string;
  source: "voice" | "text";
  intent?: "capture_facts";
  fragments: Array<{
    eventId: string;
    role: "user" | "assistant";
    text: string;
    startMs: number;
    endMs: number;
  }>;
  text?: string;
  focusedSignalId?: Id<"signals">;
  decisionId?: Id<"decisions">;
};

const delegateReference = makeFunctionReference<"action", LiveDelegateArgs, LiveDelegateResult>(
  "voiceLive:delegate",
);
const sessionStateReference = makeFunctionReference<
  "query",
  { voiceSessionId: Id<"voiceSessions"> },
  LiveSessionState | null
>("voiceLive:getSessionState");
const setLanguageReference = makeFunctionReference<
  "mutation",
  { locale: LiveLocale; voiceSessionId?: Id<"voiceSessions"> },
  { locale: LiveLocale; languageRevision: number }
>("voiceLive:setLanguage");

export type LiveSessionAnswer = {
  answerSdp: string;
  voiceSessionId: Id<"voiceSessions">;
  provider: "live";
};

export type LiveFocus = {
  focusedSignalId?: Id<"signals">;
  decisionId?: Id<"decisions">;
  /** A concise summary built from verified app state for resolving “this” and “yes”. */
  summary?: string;
};

export type VerifiedBackgroundUpdate = {
  id: string;
  version: string | number;
  content: string;
  speak?: boolean;
};

export type UseGptLiveVoiceScoutOptions = {
  sessionEndpoint?: string;
  initialLocale?: LiveLocale;
  createSession?: (
    sdp: string,
    convexAccessToken: string,
    locale: LiveLocale,
  ) => Promise<LiveSessionAnswer>;
  delegate?: (args: LiveDelegateArgs) => Promise<LiveDelegateResult>;
  /** Application-owned early fact capture. Disable only for comparison spikes. */
  enableEarlyFactCapture?: boolean;
  /** Defaults to 5 seconds; exposed so deterministic tests do not wait on a wall clock. */
  earlyFactCaptureCadenceMs?: number;
  onEvent?: (event: LiveServerEvent) => void;
};

type QueuedInput = {
  requestId: string;
  source: "voice" | "text";
  delegationId?: string;
  text?: string;
  intent?: "capture_facts";
};

type FailedInput = {
  input: QueuedInput;
  /** Terminal server failures are cached by request ID, so an explicit retry is a new attempt. */
  refreshRequestId: boolean;
};

const LIVE_CLIENT_EVENT_TYPES = new Set([
  "session.input_audio.mute",
  "session.input_audio.unmute",
  "session.commentary.append",
  "session.thinking.append",
  "session.instructions.append",
  "session.close",
]);
const MAX_APPEND_CHARACTERS = 1_000;

/**
 * Live append commands are capped in tokens. EN/DE app context stays well below
 * that ceiling at this conservative character size; chunking preserves all text
 * and prefers complete sentence boundaries without pretending to tokenize it.
 */
export function splitLiveAppendContent(content: string): string[] {
  const chunks: string[] = [];
  let remaining = content.trim();
  while (remaining) {
    if (remaining.length <= MAX_APPEND_CHARACTERS) {
      chunks.push(remaining);
      break;
    }
    const window = remaining.slice(0, MAX_APPEND_CHARACTERS + 1);
    let boundary = -1;
    const sentenceBoundary = /[.!?](?:["')\]]*)?(?=\s|$)|\n/gu;
    for (const match of window.matchAll(sentenceBoundary)) {
      boundary = (match.index ?? 0) + match[0].length;
    }
    if (boundary < 1) boundary = window.lastIndexOf(" ");
    if (boundary < 1) boundary = MAX_APPEND_CHARACTERS;
    chunks.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trimStart();
  }
  return chunks;
}

function defaultLiveSessionEndpoint(): string {
  const cloudUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  const explicitSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  const derivedSiteUrl = cloudUrl?.endsWith(".convex.cloud")
    ? cloudUrl.replace(/\.convex\.cloud$/, ".convex.site")
    : undefined;
  const siteUrl = explicitSiteUrl ?? derivedSiteUrl;
  return siteUrl ? `${siteUrl.replace(/\/$/, "")}/api/live/session` : "/api/live/session";
}

export async function createGptLiveSession(
  endpoint: string,
  sdp: string,
  convexAccessToken: string,
  locale: LiveLocale,
): Promise<LiveSessionAnswer> {
  const url = new URL(endpoint, window.location.href);
  url.searchParams.set("locale", locale);
  const response = await fetch(url, {
    method: "POST",
    credentials: "omit",
    headers: {
      Accept: "application/sdp",
      Authorization: `Bearer ${convexAccessToken}`,
      "Content-Type": "application/sdp",
      "X-RoomScout-Conversation-Locale": locale,
    },
    body: sdp,
  });
  const answerSdp = await response.text();
  const provider = response.headers.get("X-RoomScout-Voice-Provider");
  const voiceSessionId = response.headers.get("X-RoomScout-Voice-Session") as
    | Id<"voiceSessions">
    | null;
  if (!response.ok || !answerSdp.trim() || provider !== "live" || !voiceSessionId) {
    throw new Error("Live voice session request failed");
  }
  return { answerSdp, voiceSessionId, provider: "live" };
}

function toDelegateFragments(fragments: LiveTranscriptFragment[]) {
  return fragments.map(({ eventId, role, text, startMs, endMs }) => ({
    eventId,
    role,
    text,
    startMs,
    endMs,
  }));
}

function toTranscript(rows: LiveCaptionRow[]): VoiceTranscriptItem[] {
  return rows.slice(-24).map((row) => ({
    id: row.id,
    role: row.role,
    text: row.text,
    // GPT-Live deliberately has no authoritative final-fragment event.
    final: false,
  }));
}

function newRequestId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function useGptLiveVoiceScout(options: UseGptLiveVoiceScoutOptions = {}) {
  const accessToken = useAuthToken();
  const runDelegate = useAction(delegateReference);
  const persistLanguage = useMutation(setLanguageReference);
  const endpoint = options.sessionEndpoint ?? defaultLiveSessionEndpoint();
  const delegate = options.delegate ?? runDelegate;
  const [connectionState, setConnectionState] = useState<LiveConnectionState>("disconnected");
  const [microphoneState, setMicrophoneState] = useState<LiveMicrophoneState>("off");
  const [providerMuted, setProviderMuted] = useState(false);
  const [backendState, setBackendState] = useState<LiveBackendState>("idle");
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [scoutSpeaking, setScoutSpeaking] = useState(false);
  const [error, setError] = useState<string>();
  const [transcript, setTranscript] = useState<VoiceTranscriptItem[]>([]);
  const [connectedAt, setConnectedAt] = useState<number>();
  const [voiceSessionId, setVoiceSessionId] = useState<Id<"voiceSessions">>();
  const [hasConnected, setHasConnected] = useState(false);
  const [sessionLocale, setSessionLocale] = useState<LiveLocale>(options.initialLocale ?? "en");
  const [modality, setModalityState] = useState<VoiceScoutModality>("voice");
  const [pendingTextInputs, setPendingTextInputs] = useState<Array<{ id: string; text: string }>>([]);
  const [pendingInputCount, setPendingInputCount] = useState(0);
  const earlyCaptureEnabled = options.enableEarlyFactCapture ?? true;
  const earlyCaptureCadenceMs = options.earlyFactCaptureCadenceMs ?? 5_000;

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceSessionIdRef = useRef<Id<"voiceSessions"> | undefined>(undefined);
  const generationRef = useRef(0);
  const connectingRef = useRef(false);
  const closingTimerRef = useRef<number | undefined>(undefined);
  const speechTimersRef = useRef<{ user?: number; assistant?: number }>({});
  const userSpeakingRef = useRef(false);
  const captureTimerRef = useRef<number | undefined>(undefined);
  const captureWatermarkRef = useRef(0);
  const lastCaptureQueuedAtRef = useRef(0);
  const fragmentBufferRef = useRef(new GptLiveFragmentBuffer());
  const queueRef = useRef<QueuedInput[]>([]);
  const activeInputRef = useRef<QueuedInput | undefined>(undefined);
  const failedInputRef = useRef<FailedInput | undefined>(undefined);
  const uncertainInputRef = useRef<
    {
      input: QueuedInput;
      snapshot: LiveDelegationSnapshot;
      contextEpoch: number;
      locale: LiveLocale;
    } | undefined
  >(undefined);
  const waitingForServerIdleRef = useRef(false);
  const blockedByUnknownRef = useRef(false);
  const greetedGenerationRef = useRef(0);
  const focusRef = useRef<LiveFocus>({});
  const contextEpochRef = useRef(0);
  const pendingAppendIdsRef = useRef(new Set<string>());
  const flushWaitersRef = useRef<Array<(complete: boolean) => void>>([]);
  const deliveredUpdateVersionsRef = useRef(new Map<string, string>());
  const bufferedUpdatesRef = useRef(new Map<string, VerifiedBackgroundUpdate>());
  const onEventRef = useRef(options.onEvent);
  const localeRef = useRef(sessionLocale);
  const pumpRef = useRef<() => void>(() => undefined);
  const scheduleCaptureRef = useRef<() => void>(() => undefined);
  const flushSpokenUpdatesRef = useRef<() => void>(() => undefined);
  const createSession = options.createSession;
  const { volume: inputVolume, attach: attachInputMeter, detach: detachInputMeter } = useAudioVolume();
  const { volume: outputVolume, attach: attachOutputMeter, detach: detachOutputMeter } = useAudioVolume();
  const sessionState = useQuery(
    sessionStateReference,
    voiceSessionId ? { voiceSessionId } : "skip",
  );

  const settleFlushWaiters = useCallback((complete: boolean) => {
    const waiters = flushWaitersRef.current.splice(0);
    for (const resolve of waiters) resolve(complete);
  }, []);

  useEffect(() => {
    onEventRef.current = options.onEvent;
  }, [options.onEvent]);

  const sendEvent = useCallback((event: Record<string, unknown>) => {
    const channel = channelRef.current;
    if (
      !channel ||
      channel.readyState !== "open" ||
      typeof event.type !== "string" ||
      !LIVE_CLIENT_EVENT_TYPES.has(event.type)
    )
      return false;
    channel.send(JSON.stringify(event));
    return true;
  }, []);

  const appendContext = useCallback(
    (content: string, speak: boolean, delegationId: string | null = null) => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      let sentAll = true;
      for (const chunk of splitLiveAppendContent(trimmed)) {
        const eventId = newRequestId(speak ? "commentary" : "thinking");
        const sent = sendEvent({
          type: speak ? "session.commentary.append" : "session.thinking.append",
          event_id: eventId,
          delegation_id: delegationId,
          content: chunk,
        });
        if (sent) pendingAppendIdsRef.current.add(eventId);
        else sentAll = false;
      }
      return sentAll;
    },
    [sendEvent],
  );

  const appendInstructions = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;
      let sentAll = true;
      for (const chunk of splitLiveAppendContent(trimmed)) {
        const eventId = newRequestId("instructions");
        const sent = sendEvent({
          type: "session.instructions.append",
          event_id: eventId,
          delegation_id: null,
          content: chunk,
        });
        if (sent) pendingAppendIdsRef.current.add(eventId);
        else sentAll = false;
      }
      return sentAll;
    },
    [sendEvent],
  );

  const cleanup = useCallback(
    (preservePendingText = true) => {
      generationRef.current += 1;
      if (closingTimerRef.current !== undefined) window.clearTimeout(closingTimerRef.current);
      if (captureTimerRef.current !== undefined) window.clearTimeout(captureTimerRef.current);
      for (const timer of Object.values(speechTimersRef.current)) {
        if (timer !== undefined) window.clearTimeout(timer);
      }
      const channel = channelRef.current;
      const peer = peerRef.current;
      if (channel) {
        channel.onopen = null;
        channel.onclose = null;
        channel.onerror = null;
        channel.onmessage = null;
        channel.close();
      }
      if (peer) {
        peer.ontrack = null;
        peer.onconnectionstatechange = null;
        peer.close();
      }
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (remoteAudioRef.current) {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      }
      const unadmittedTextIds = new Set(
        queueRef.current.filter((input) => input.source === "text").map((input) => input.requestId),
      );
      if (failedInputRef.current?.input.source === "text") {
        unadmittedTextIds.add(failedInputRef.current.input.requestId);
      }
      if (preservePendingText) {
        setPendingTextInputs((current) => current.filter((entry) => unadmittedTextIds.has(entry.id)));
      } else {
        setPendingTextInputs([]);
      }
      queueRef.current = [];
      activeInputRef.current = undefined;
      failedInputRef.current = undefined;
      uncertainInputRef.current = undefined;
      waitingForServerIdleRef.current = false;
      peerRef.current = null;
      channelRef.current = null;
      localStreamRef.current = null;
      remoteAudioRef.current = null;
      voiceSessionIdRef.current = undefined;
      setVoiceSessionId(undefined);
      connectingRef.current = false;
      blockedByUnknownRef.current = false;
      pendingAppendIdsRef.current.clear();
      bufferedUpdatesRef.current.clear();
      deliveredUpdateVersionsRef.current.clear();
      fragmentBufferRef.current.clear();
      captureTimerRef.current = undefined;
      captureWatermarkRef.current = 0;
      lastCaptureQueuedAtRef.current = 0;
      settleFlushWaiters(false);
      setPendingInputCount(0);
      setMicrophoneState("off");
      setProviderMuted(false);
      userSpeakingRef.current = false;
      setUserSpeaking(false);
      setScoutSpeaking(false);
      setConnectedAt(undefined);
      detachInputMeter();
      detachOutputMeter();
    },
    [detachInputMeter, detachOutputMeter, settleFlushWaiters],
  );

  const pumpQueue = useCallback(async () => {
    if (
      activeInputRef.current ||
      failedInputRef.current ||
      waitingForServerIdleRef.current ||
      blockedByUnknownRef.current ||
      connectionState !== "active" ||
      !voiceSessionIdRef.current
    )
      return;
    const next = queueRef.current[0];
    if (!next) {
      setPendingInputCount(0);
      settleFlushWaiters(true);
      return;
    }
    const captureCandidate = next.intent === "capture_facts"
      ? fragmentBufferRef.current.captureCandidate(captureWatermarkRef.current)
      : undefined;
    if (next.intent === "capture_facts" && !captureCandidate) {
      queueRef.current.shift();
      setPendingInputCount(queueRef.current.length);
      pumpRef.current();
      return;
    }
    let snapshot: LiveDelegationSnapshot;
    try {
      snapshot = captureCandidate
        ? {
          delegationId: next.requestId,
          maxSequence: captureCandidate.maxSequence,
          fragments: captureCandidate.fragments,
          unresolvedUserEventIds: captureCandidate.fragments.map((fragment) => fragment.eventId),
        }
        : fragmentBufferRef.current.snapshot(next.delegationId ?? next.requestId);
    } catch (cause) {
      queueRef.current.shift();
      failedInputRef.current = { input: next, refreshRequestId: false };
      if (next.source === "text" && next.text) {
        setPendingTextInputs((current) =>
          current.some((entry) => entry.id === next.requestId)
            ? current
            : [...current, { id: next.requestId, text: next.text! }],
        );
      }
      setPendingInputCount(queueRef.current.length + 1);
      setBackendState("failed");
      setError(
        cause instanceof GptLiveContextOverflowError
          ? cause.message
          : "The voice request could not be prepared safely.",
      );
      settleFlushWaiters(false);
      return;
    }
    if (next.source === "voice" && snapshot.unresolvedUserEventIds.length === 0) {
      return;
    }

    queueRef.current.shift();
    activeInputRef.current = next;
    setPendingInputCount(queueRef.current.length + 1);
    setBackendState("processing");
    if (next.source === "text") {
      setPendingTextInputs((current) => current.filter((entry) => entry.id !== next.requestId));
    }
    const generation = generationRef.current;
    const sessionId = voiceSessionIdRef.current;
    const contextEpoch = contextEpochRef.current;
    const requestLocale = localeRef.current;
    try {
      const result = await delegate({
        voiceSessionId: sessionId,
        requestId: next.requestId,
        ...(next.delegationId ? { delegationId: next.delegationId } : {}),
        source: next.source,
        ...(next.intent ? { intent: next.intent } : {}),
        fragments: toDelegateFragments(snapshot.fragments),
        ...(next.text ? { text: next.text } : {}),
        ...(focusRef.current.focusedSignalId
          ? { focusedSignalId: focusRef.current.focusedSignalId }
          : {}),
        ...(focusRef.current.decisionId ? { decisionId: focusRef.current.decisionId } : {}),
      });
      if (generationRef.current !== generation || voiceSessionIdRef.current !== sessionId) return;
      if (next.intent === "capture_facts") {
        if (!["busy", "in_progress", "outcome_unknown"].includes(result.status)) {
          captureWatermarkRef.current = Math.max(captureWatermarkRef.current, snapshot.maxSequence);
        }
      } else {
        fragmentBufferRef.current.resolve(result.resolvedEventIds);
        captureWatermarkRef.current = Math.max(
          captureWatermarkRef.current,
          fragmentBufferRef.current.processedCursor(),
        );
      }
      setTranscript(toTranscript(fragmentBufferRef.current.captions()));
      if (contextEpochRef.current === contextEpoch && localeRef.current === requestLocale) {
        setSessionLocale(result.locale);
        localeRef.current = result.locale;
      }
      if (result.status === "busy") {
        queueRef.current.unshift(next);
        waitingForServerIdleRef.current = true;
        setBackendState("queued");
        return;
      }
      if (result.status === "in_progress") {
        uncertainInputRef.current = { input: next, snapshot, contextEpoch, locale: requestLocale };
        waitingForServerIdleRef.current = true;
        setBackendState("processing");
        return;
      }
      if (result.status === "needs_clarification") {
        setBackendState(next.intent === "capture_facts" ? "idle" : "waiting_for_clarification");
      }
      else if (result.status === "failed" && next.intent !== "capture_facts") {
        failedInputRef.current = { input: next, refreshRequestId: true };
        if (next.source === "text" && next.text) {
          setPendingTextInputs((current) =>
            current.some((entry) => entry.id === next.requestId)
              ? current
              : [...current, { id: next.requestId, text: next.text! }],
          );
        }
        setBackendState("failed");
        settleFlushWaiters(false);
      }
      else if (result.status === "outcome_unknown") {
        blockedByUnknownRef.current = true;
        setBackendState("outcome_unknown");
        settleFlushWaiters(false);
      } else setBackendState("idle");

      const hasNewerInput = fragmentBufferRef.current.hasNewerUnresolvedUserInput(snapshot.maxSequence);
      const contextIsCurrent =
        contextEpochRef.current === contextEpoch && localeRef.current === requestLocale;
      if (next.intent !== "capture_facts" && result.spokenSummary && !hasNewerInput && contextIsCurrent) {
        appendContext(result.spokenSummary, true, next.delegationId ?? null);
      }
    } catch (cause) {
      if (generationRef.current !== generation || voiceSessionIdRef.current !== sessionId) return;
      if (isRetryablePreclaimFailure(cause)) {
        if (next.intent !== "capture_facts") {
          failedInputRef.current = { input: next, refreshRequestId: false };
        } else {
          captureWatermarkRef.current = Math.max(captureWatermarkRef.current, snapshot.maxSequence);
        }
        if (next.intent !== "capture_facts" && next.source === "text" && next.text) {
          setPendingTextInputs((current) =>
            current.some((entry) => entry.id === next.requestId)
              ? current
              : [...current, { id: next.requestId, text: next.text! }],
          );
        }
        setBackendState(next.intent === "capture_facts" ? "idle" : "failed");
        if (next.intent !== "capture_facts") settleFlushWaiters(false);
      } else {
        uncertainInputRef.current = { input: next, snapshot, contextEpoch, locale: requestLocale };
        waitingForServerIdleRef.current = true;
        blockedByUnknownRef.current = true;
        setBackendState("outcome_unknown");
        settleFlushWaiters(false);
      }
    } finally {
      if (generationRef.current === generation && activeInputRef.current?.requestId === next.requestId) {
        activeInputRef.current = undefined;
        setPendingInputCount(queueRef.current.length);
        if (!blockedByUnknownRef.current && !waitingForServerIdleRef.current) pumpRef.current();
        scheduleCaptureRef.current();
      }
    }
  }, [appendContext, connectionState, delegate, settleFlushWaiters]);
  useEffect(() => {
    pumpRef.current = () => void pumpQueue();
  }, [pumpQueue]);

  const scheduleEarlyCapture = useCallback(() => {
    if (
      !earlyCaptureEnabled ||
      connectionState !== "active" ||
      activeInputRef.current?.intent === "capture_facts" ||
      queueRef.current.some((input) => input.intent === "capture_facts") ||
      !fragmentBufferRef.current.captureCandidate(captureWatermarkRef.current)
    )
      return;
    const elapsed = Date.now() - lastCaptureQueuedAtRef.current;
    const remaining = Math.max(0, earlyCaptureCadenceMs - elapsed);
    if (remaining > 0) {
      if (captureTimerRef.current === undefined) {
        captureTimerRef.current = window.setTimeout(() => {
          captureTimerRef.current = undefined;
          scheduleCaptureRef.current();
        }, remaining);
      }
      return;
    }
    lastCaptureQueuedAtRef.current = Date.now();
    queueRef.current.push({
      requestId: newRequestId("capture"),
      source: "voice",
      intent: "capture_facts",
    });
    setPendingInputCount(queueRef.current.length + (activeInputRef.current ? 1 : 0));
    if (!activeInputRef.current) setBackendState("queued");
    pumpRef.current();
  }, [connectionState, earlyCaptureCadenceMs, earlyCaptureEnabled]);
  useEffect(() => {
    scheduleCaptureRef.current = scheduleEarlyCapture;
  }, [scheduleEarlyCapture]);

  useEffect(() => {
    if (!sessionState) return;
    queueMicrotask(() => {
      const uncertain = uncertainInputRef.current;
      if (
        uncertain &&
        sessionState.lastResult?.requestId === uncertain.input.requestId &&
        !["busy", "in_progress"].includes(sessionState.lastResult.status)
      ) {
        const result = sessionState.lastResult;
        if (uncertain.input.intent === "capture_facts") {
          if (!["busy", "in_progress", "outcome_unknown"].includes(result.status)) {
            captureWatermarkRef.current = Math.max(
              captureWatermarkRef.current,
              uncertain.snapshot.maxSequence,
            );
          }
        } else {
          fragmentBufferRef.current.resolve(result.resolvedEventIds);
        }
        uncertainInputRef.current = undefined;
        waitingForServerIdleRef.current = false;
        if (result.status === "outcome_unknown") {
          blockedByUnknownRef.current = true;
          setBackendState("outcome_unknown");
          settleFlushWaiters(false);
          return;
        }
        blockedByUnknownRef.current = false;
        if (result.status === "failed" && uncertain.input.intent !== "capture_facts") {
          failedInputRef.current = { input: uncertain.input, refreshRequestId: true };
          if (uncertain.input.source === "text" && uncertain.input.text) {
            setPendingTextInputs((current) =>
              current.some((entry) => entry.id === uncertain.input.requestId)
                ? current
                : [
                    ...current,
                    { id: uncertain.input.requestId, text: uncertain.input.text! },
                  ],
            );
          }
        }
        setBackendState(
          result.status === "needs_clarification"
            ? uncertain.input.intent === "capture_facts"
              ? "idle"
              : "waiting_for_clarification"
            : result.status === "failed"
              ? uncertain.input.intent === "capture_facts"
                ? "idle"
                : "failed"
              : "idle",
        );
        if (
          uncertain.input.intent !== "capture_facts" &&
          result.spokenSummary &&
          !fragmentBufferRef.current.hasNewerUnresolvedUserInput(uncertain.snapshot.maxSequence) &&
          contextEpochRef.current === uncertain.contextEpoch &&
          localeRef.current === uncertain.locale
        ) {
          appendContext(result.spokenSummary, true, uncertain.input.delegationId ?? null);
        }
      }
      if (!sessionState.activeRequest) {
        waitingForServerIdleRef.current = false;
        pumpRef.current();
      }
    });
  }, [appendContext, sessionState, settleFlushWaiters]);

  const noteSpeaking = useCallback((role: "user" | "assistant") => {
    const priorTimer = speechTimersRef.current[role];
    if (priorTimer !== undefined) window.clearTimeout(priorTimer);
    if (role === "user") {
      userSpeakingRef.current = true;
      setUserSpeaking(true);
    }
    else {
      setScoutSpeaking(true);
      const audio = remoteAudioRef.current;
      if (audio?.paused) void audio.play().catch(() => undefined);
    }
    speechTimersRef.current[role] = window.setTimeout(() => {
      if (role === "user") {
        userSpeakingRef.current = false;
        setUserSpeaking(false);
        flushSpokenUpdatesRef.current();
      }
      else setScoutSpeaking(false);
    }, 750);
  }, []);

  const handleServerEvent = useCallback(
    (event: LiveServerEvent) => {
      onEventRef.current?.(event);
      if (isLiveTranscriptEvent(event)) {
        const fragment = fragmentBufferRef.current.append(event);
        if (!fragment) return;
        setTranscript(toTranscript(fragmentBufferRef.current.captions()));
        noteSpeaking(fragment.role);
        if (fragment.role === "user") pumpRef.current();
        if (fragment.role === "user") scheduleCaptureRef.current();
        return;
      }
      if (isClientDelegationEvent(event)) {
        if (
          activeInputRef.current?.requestId === event.delegation.id ||
          queueRef.current.some((input) => input.requestId === event.delegation.id)
        )
          return;
        const captureIndex = queueRef.current.findIndex((input) => input.intent === "capture_facts");
        const delegationInput: QueuedInput = {
          requestId: event.delegation.id,
          delegationId: event.delegation.id,
          source: "voice",
        };
        if (captureIndex >= 0) queueRef.current.splice(captureIndex, 0, delegationInput);
        else queueRef.current.push(delegationInput);
        setPendingInputCount(queueRef.current.length + (activeInputRef.current ? 1 : 0));
        setBackendState("queued");
        pumpRef.current();
        return;
      }
      if (event.type.endsWith(".appended") && event.client_event_id) {
        pendingAppendIdsRef.current.delete(event.client_event_id);
        return;
      }
      if (event.type === "session.input_audio.muted") {
        setProviderMuted(true);
        return;
      }
      if (event.type === "session.started") {
        const generation = generationRef.current;
        if (greetedGenerationRef.current !== generation) {
          greetedGenerationRef.current = generation;
          appendInstructions(
            localeRef.current === "en"
              ? "Greet the musician briefly in English now, ask what matters for their rehearsal room, then pause and listen."
              : "Begrüße den Musiker jetzt kurz auf Deutsch, frage, was beim Proberaum wichtig ist, und höre dann zu.",
          );
        }
        return;
      }
      if (event.type === "session.input_audio.unmuted") {
        setProviderMuted(false);
        return;
      }
      if (event.type === "session.closed") {
        cleanup();
        setConnectionState("disconnected");
        return;
      }
      if (event.type === "error") {
        const clientEventId = event.error?.client_event_id;
        if (clientEventId) pendingAppendIdsRef.current.delete(clientEventId);
        setError(safeLiveProviderError(event));
      }
    },
    [appendInstructions, cleanup, noteSpeaking],
  );

  const connect = useCallback(async () => {
    if (connectingRef.current || connectionState === "active" || connectionState === "closing") return;
    if (!accessToken) {
      setError("Sign in before starting a private voice session.");
      setConnectionState("error");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support microphone capture.");
      setConnectionState("error");
      return;
    }
    cleanup();
    connectingRef.current = true;
    const generation = ++generationRef.current;
    const cancelled = () => generationRef.current !== generation;
    setError(undefined);
    setConnectionState("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: true, echoCancellation: true, noiseSuppression: true },
      });
      if (cancelled()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      setMicrophoneState("on");
      await attachInputMeter(stream);
      if (cancelled()) return;

      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      const remoteAudio = document.createElement("audio");
      remoteAudio.autoplay = true;
      remoteAudio.setAttribute("playsinline", "");
      remoteAudioRef.current = remoteAudio;
      peer.ontrack = (event) => {
        if (cancelled() || peerRef.current !== peer) return;
        const remoteStream = event.streams[0] ?? new MediaStream([event.track]);
        remoteAudio.srcObject = remoteStream;
        void remoteAudio.play().catch(() => undefined);
        void attachOutputMeter(remoteStream);
      };
      peer.onconnectionstatechange = () => {
        if (cancelled() || peerRef.current !== peer) return;
        if (peer.connectionState === "failed") {
          setError("The Live peer connection failed.");
          setConnectionState("error");
        } else if (peer.connectionState === "disconnected" || peer.connectionState === "closed") {
          cleanup();
          setConnectionState("disconnected");
        }
      };
      for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);

      const channel = peer.createDataChannel("oai-events");
      channelRef.current = channel;
      channel.onopen = () => {
        if (cancelled() || channelRef.current !== channel) return;
        connectingRef.current = false;
        setConnectedAt(Date.now());
        setHasConnected(true);
        setConnectionState("active");
        const initialFocus = focusRef.current.summary?.trim();
        if (initialFocus) appendContext(initialFocus, false);
        for (const update of bufferedUpdatesRef.current.values()) {
          appendContext(update.content, update.speak ?? false);
        }
        bufferedUpdatesRef.current.clear();
        pumpRef.current();
      };
      channel.onmessage = (message) => {
        if (cancelled() || channelRef.current !== channel) return;
        try {
          handleServerEvent(JSON.parse(String(message.data)) as LiveServerEvent);
        } catch {
          setError("Received an unreadable Live event.");
        }
      };
      channel.onerror = () => {
        if (cancelled() || channelRef.current !== channel) return;
        setError("The Live event channel failed.");
        setConnectionState("error");
      };
      channel.onclose = () => {
        if (cancelled() || channelRef.current !== channel) return;
        cleanup();
        setConnectionState("disconnected");
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (cancelled()) return;
      const sdp = peer.localDescription?.sdp ?? offer.sdp;
      if (!sdp) throw new Error("The browser did not create a WebRTC offer.");
      const answer = createSession
        ? await createSession(sdp, accessToken, localeRef.current)
        : await createGptLiveSession(endpoint, sdp, accessToken, localeRef.current);
      if (cancelled()) return;
      voiceSessionIdRef.current = answer.voiceSessionId;
      setVoiceSessionId(answer.voiceSessionId);
      await peer.setRemoteDescription({ type: "answer", sdp: answer.answerSdp });
    } catch (cause) {
      if (cancelled()) return;
      cleanup();
      setError(safeLiveError(cause));
      setConnectionState("error");
    } finally {
      if (generationRef.current === generation) connectingRef.current = false;
    }
  }, [accessToken, appendContext, attachInputMeter, attachOutputMeter, cleanup, connectionState, createSession, endpoint, handleServerEvent]);

  const disconnect = useCallback(() => {
    if (connectionState === "disconnected") return;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = false;
    });
    setMicrophoneState("off");
    setConnectionState("closing");
    const sent = sendEvent({ type: "session.close", event_id: newRequestId("close") });
    if (!sent) {
      cleanup();
      setConnectionState("disconnected");
      return;
    }
    closingTimerRef.current = window.setTimeout(() => {
      cleanup();
      setConnectionState("disconnected");
    }, 1_000);
  }, [cleanup, connectionState, sendEvent]);

  const setMuted = useCallback(
    (muted: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      setMicrophoneState(muted ? "locally_muted" : "on");
      setProviderMuted(false);
      sendEvent({
        type: muted ? "session.input_audio.mute" : "session.input_audio.unmute",
        event_id: newRequestId(muted ? "mute" : "unmute"),
      });
    },
    [sendEvent],
  );

  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || connectionState !== "active") return false;
    const requestId = newRequestId("typed");
    queueRef.current.push({ requestId, source: "text", text: trimmed });
    setPendingTextInputs((current) => [...current, { id: requestId, text: trimmed }]);
    setPendingInputCount(queueRef.current.length + (activeInputRef.current ? 1 : 0));
    setBackendState("queued");
    pumpRef.current();
    return true;
  }, [connectionState]);

  const clearPendingTextDraft = useCallback(() => setPendingTextInputs([]), []);
  const retryFailedInput = useCallback(() => {
    const failed = failedInputRef.current;
    if (!failed || connectionState !== "active") return false;
    const input = failed.refreshRequestId
      ? { ...failed.input, requestId: newRequestId(failed.input.source === "text" ? "typed" : "retry") }
      : failed.input;
    failedInputRef.current = undefined;
    if (failed.refreshRequestId && input.source === "text") {
      setPendingTextInputs((current) =>
        current.map((entry) =>
          entry.id === failed.input.requestId ? { ...entry, id: input.requestId } : entry,
        ),
      );
    }
    queueRef.current.unshift(input);
    setPendingInputCount(queueRef.current.length);
    setBackendState("queued");
    pumpRef.current();
    return true;
  }, [connectionState]);
  const flushPendingInputs = useCallback(() => {
    if (failedInputRef.current || blockedByUnknownRef.current) return Promise.resolve(false);
    if (!activeInputRef.current && queueRef.current.length === 0) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      flushWaitersRef.current.push(resolve);
      pumpRef.current();
    });
  }, []);

  const setLanguage = useCallback(
    (locale: LiveLocale) => {
      if (localeRef.current !== locale) contextEpochRef.current += 1;
      setSessionLocale(locale);
      localeRef.current = locale;
      const voiceSessionId = voiceSessionIdRef.current;
      void persistLanguage(voiceSessionId ? { locale, voiceSessionId } : { locale }).catch(() => undefined);
      if (connectionState === "active") {
        appendInstructions(
          locale === "en"
            ? "Continue the conversation in English. Preserve names and confirmed facts exactly."
            : "Führe das Gespräch auf Deutsch fort. Namen und bestätigte Fakten bleiben unverändert.",
        );
      }
    },
    [appendInstructions, connectionState, persistLanguage],
  );

  const setFocus = useCallback(
    (focus: LiveFocus) => {
      const priorSummary = focusRef.current.summary;
      const changed =
        focus.focusedSignalId !== focusRef.current.focusedSignalId ||
        focus.decisionId !== focusRef.current.decisionId ||
        focus.summary !== focusRef.current.summary;
      if (changed) contextEpochRef.current += 1;
      focusRef.current = focus;
      if (connectionState === "active" && focus.summary?.trim() && focus.summary !== priorSummary) {
        appendContext(focus.summary, false);
      }
    },
    [appendContext, connectionState],
  );

  const flushSpokenUpdates = useCallback(() => {
    if (connectionState !== "active" || userSpeakingRef.current) return;
    for (const [id, update] of bufferedUpdatesRef.current) {
      if (update.speak !== true) continue;
      if (appendContext(update.content, true)) bufferedUpdatesRef.current.delete(id);
    }
  }, [appendContext, connectionState]);
  useEffect(() => {
    flushSpokenUpdatesRef.current = flushSpokenUpdates;
  }, [flushSpokenUpdates]);

  const appendVerifiedBackgroundUpdate = useCallback(
    (update: VerifiedBackgroundUpdate) => {
      const version = String(update.version);
      if (deliveredUpdateVersionsRef.current.get(update.id) === version) return false;
      if (connectionState === "connecting") {
        deliveredUpdateVersionsRef.current.set(update.id, version);
        bufferedUpdatesRef.current.set(update.id, update);
        return true;
      }
      if (connectionState !== "active") return false;
      if (update.speak === true && userSpeakingRef.current) {
        deliveredUpdateVersionsRef.current.set(update.id, version);
        bufferedUpdatesRef.current.set(update.id, update);
        return true;
      }
      const sent = appendContext(update.content, update.speak ?? false);
      if (sent) deliveredUpdateVersionsRef.current.set(update.id, version);
      return sent;
    },
    [appendContext, connectionState],
  );

  const clearBackgroundUpdate = useCallback((id: string) => {
    bufferedUpdatesRef.current.delete(id);
    deliveredUpdateVersionsRef.current.delete(id);
  }, []);
  const clearBackgroundUpdates = useCallback(() => {
    bufferedUpdatesRef.current.clear();
    deliveredUpdateVersionsRef.current.clear();
  }, []);

  const stopSpeaking = useCallback(() => {
    remoteAudioRef.current?.pause();
    setScoutSpeaking(false);
    appendInstructions("Stop speaking now. Leave room for the user and listen.");
  }, [appendInstructions]);

  const setModality = useCallback((next: VoiceScoutModality) => setModalityState(next), []);

  useEffect(() => () => cleanup(), [cleanup]);

  const connected = connectionState === "active";
  const muted = microphoneState === "locally_muted";
  const status: VoiceScoutStatus =
    connectionState === "connecting"
      ? microphoneState === "off"
        ? "requesting_microphone"
        : "creating_session"
      : connectionState === "closing" || connectionState === "disconnected"
        ? connectionState === "closing"
          ? "disconnected"
          : hasConnected
            ? "disconnected"
            : "idle"
        : connectionState === "error"
          ? "error"
          : scoutSpeaking
            ? "speaking"
            : backendState === "processing" || backendState === "queued"
              ? "thinking"
              : "listening";
  const volume = scoutSpeaking ? outputVolume : muted ? 0 : inputVolume;
  const pendingTextDraft = useMemo(
    () => pendingTextInputs.map((entry) => entry.text).join("\n"),
    [pendingTextInputs],
  );

  return {
    provider: "live" as const,
    status,
    modality,
    muted,
    providerMuted,
    error,
    transcript,
    connectedAt,
    connected,
    volume,
    connectionState,
    microphoneState,
    userSpeaking,
    scoutSpeaking,
    backendState,
    pendingInputCount,
    pendingTextDraft,
    sessionLocale,
    connect,
    disconnect,
    setMuted,
    setModality,
    sendText,
    flushPendingInputs,
    retryFailedInput,
    clearPendingTextDraft,
    interrupt: stopSpeaking,
    stopSpeaking,
    setLanguage,
    setFocus,
    appendVerifiedBackgroundUpdate,
    clearBackgroundUpdate,
    clearBackgroundUpdates,
    sendEvent,
    voiceSessionId,
  };
}
