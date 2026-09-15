import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Link, useLocation } from "react-router-dom";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import {
  useGptLiveVoiceScout,
  type UseGptLiveVoiceScoutOptions,
} from "../../hooks/useGptLiveVoiceScout";
import {
  useRealtimeVoiceScout,
  type UseRealtimeVoiceScoutOptions,
} from "../../hooks/useRealtimeVoiceScout";
import { useCopy } from "../../ui/copy";
import {
  VoiceSessionContext,
  type VoiceProvider,
  type VoiceSessionValue,
} from "./VoiceSessionContext";

type VoiceConfig = { provider: VoiceProvider; locale: "en" | "de" };
const configReference = makeFunctionReference<"query", Record<string, never>, VoiceConfig>(
  "voiceLive:getConfig",
);

export type VoiceSessionProviderOptions = {
  live?: UseGptLiveVoiceScoutOptions;
  realtime?: UseRealtimeVoiceScoutOptions;
};

/** Owns the connection above individual Scout views. */
export function VoiceSessionProvider({
  children,
  options,
}: PropsWithChildren<{ options?: VoiceSessionProviderOptions }>) {
  const config = useQuery(configReference, {});
  const { locale: uiLocale, setLocale: setUiLocale, t } = useCopy();
  const live = useGptLiveVoiceScout({
    ...options?.live,
    initialLocale: config?.locale ?? uiLocale,
  });
  const realtime = useRealtimeVoiceScout(options?.realtime);
  const liveSetLanguage = live.setLanguage;
  const liveSessionLocale = live.sessionLocale;
  const synchronizedLocaleRef = useRef<"en" | "de">(uiLocale);
  const [activeProvider, setActiveProvider] = useState<VoiceProvider>();
  const location = useLocation();
  const configuredProvider = config?.provider ?? "realtime";
  // Freeze the provider once connect begins. A config change applies next time.
  const selectedProvider = activeProvider ?? configuredProvider;
  const selected = selectedProvider === "live" ? live : realtime;
  const voiceCopy = (key: string) => t(key as Parameters<typeof t>[0]);

  const connect = useCallback(async () => {
    if (!config) return;
    setActiveProvider(config.provider);
    if (config.provider === "live") {
      live.setLanguage(config.locale);
      await live.connect();
    } else {
      await realtime.connect();
    }
  }, [config, live, realtime]);

  const setLanguage = useCallback(
    (locale: "en" | "de") => {
      synchronizedLocaleRef.current = locale;
      setUiLocale(locale);
      liveSetLanguage(locale);
    },
    [liveSetLanguage, setUiLocale],
  );

  // The last synchronized value distinguishes a global UI toggle from a
  // spoken language change reported by the backend, avoiding update ping-pong.
  useEffect(() => {
    const synchronized = synchronizedLocaleRef.current;
    if (uiLocale !== synchronized) {
      synchronizedLocaleRef.current = uiLocale;
      liveSetLanguage(uiLocale);
      return;
    }
    if (liveSessionLocale !== synchronized) {
      synchronizedLocaleRef.current = liveSessionLocale;
      setUiLocale(liveSessionLocale);
      return;
    }
    if (config?.locale && config.locale !== synchronized) {
      synchronizedLocaleRef.current = config.locale;
      liveSetLanguage(config.locale);
      setUiLocale(config.locale);
    }
  }, [config?.locale, liveSessionLocale, liveSetLanguage, setUiLocale, uiLocale]);

  const value = useMemo<VoiceSessionValue>(() => {
    if (selectedProvider === "live") return { ...live, connect, setLanguage };
    const connected = realtime.connected;
    const muted = realtime.muted;
    return {
      ...realtime,
      provider: "realtime",
      connect,
      providerMuted: muted,
      connectionState:
        realtime.status === "error"
          ? "error"
          : connected
            ? "active"
            : ["requesting_microphone", "connecting", "creating_session"].includes(realtime.status)
              ? "connecting"
              : "disconnected",
      microphoneState: connected ? (muted ? "locally_muted" : "on") : "off",
      userSpeaking: connected && realtime.status === "listening",
      scoutSpeaking: connected && realtime.status === "speaking",
      backendState: realtime.status === "thinking" ? "processing" : "idle",
      pendingInputCount: 0,
      pendingTextDraft: "",
      sessionLocale: uiLocale,
      flushPendingInputs: async () => true,
      clearPendingTextDraft: () => undefined,
      stopSpeaking: realtime.interrupt,
      setLanguage,
      setFocus: () => undefined,
      appendVerifiedBackgroundUpdate: () => false,
      clearBackgroundUpdate: () => undefined,
      clearBackgroundUpdates: () => undefined,
    };
  }, [connect, live, realtime, selectedProvider, setLanguage, uiLocale]);

  const showOngoingCall = selected.connected && location.pathname !== "/app/scout";
  return (
    <VoiceSessionContext.Provider value={value}>
      {children}
      {showOngoingCall ? (
        <aside className="rs-ongoing-call" aria-label={voiceCopy("liveScout.voice.ongoingCall")}>
          <Link to="/app/scout">
            <span className="rs-ongoing-call__dot" />
            {voiceCopy("liveScout.voice.returnToScout")}
          </Link>
          <button
            type="button"
            aria-label={voiceCopy(selected.muted ? "liveScout.voice.microphoneOn" : "liveScout.voice.microphoneOff")}
            onClick={() => selected.setMuted(!selected.muted)}
          >
            {selected.muted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button type="button" aria-label={voiceCopy("liveScout.voice.end")} onClick={selected.disconnect}>
            <PhoneOff size={18} />
          </button>
        </aside>
      ) : null}
    </VoiceSessionContext.Provider>
  );
}
