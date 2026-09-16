import type { PropsWithChildren } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link, useLocation } from "react-router-dom";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import {
  useGptLiveVoiceScout,
  type UseGptLiveVoiceScoutOptions,
} from "../../hooks/useGptLiveVoiceScout";
import { useCopy } from "../../ui/copy";
import {
  VoiceSessionContext,
  type VoiceSessionValue,
} from "./VoiceSessionContext";

export type VoiceSessionProviderOptions = {
  live?: UseGptLiveVoiceScoutOptions;
};

/** Owns the connection above individual Scout views. */
export function VoiceSessionProvider({
  children,
  options,
}: PropsWithChildren<{ options?: VoiceSessionProviderOptions }>) {
  const config = useQuery(api.voiceLive.getConfig, {});
  const { locale: uiLocale, setLocale: setUiLocale, t } = useCopy();
  const live = useGptLiveVoiceScout({
    ...options?.live,
    initialLocale: config?.locale ?? uiLocale,
  });
  const liveSetLanguage = live.setLanguage;
  const liveSessionLocale = live.sessionLocale;
  const liveBackendBusy = live.backendState === "queued" || live.backendState === "processing";
  const synchronizedLocaleRef = useRef<"en" | "de">(uiLocale);
  const location = useLocation();
  const voiceCopy = (key: string) => t(key as Parameters<typeof t>[0]);

  const connect = useCallback(async () => {
    if (!config) return;
    live.setLanguage(config.locale);
    await live.connect();
  }, [config, live]);

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
    if (!liveBackendBusy && config?.locale && config.locale !== synchronized) {
      synchronizedLocaleRef.current = config.locale;
      liveSetLanguage(config.locale);
      setUiLocale(config.locale);
    }
  }, [config?.locale, liveBackendBusy, liveSessionLocale, liveSetLanguage, setUiLocale, uiLocale]);

  const value = useMemo<VoiceSessionValue>(
    () => ({ ...live, connect, setLanguage }),
    [connect, live, setLanguage],
  );

  const showOngoingCall = live.connected && location.pathname !== "/app/scout";
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
            aria-label={voiceCopy(live.muted ? "liveScout.voice.microphoneOn" : "liveScout.voice.microphoneOff")}
            onClick={() => live.setMuted(!live.muted)}
          >
            {live.muted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button type="button" aria-label={voiceCopy("liveScout.voice.end")} onClick={live.disconnect}>
            <PhoneOff size={18} />
          </button>
        </aside>
      ) : null}
    </VoiceSessionContext.Provider>
  );
}
