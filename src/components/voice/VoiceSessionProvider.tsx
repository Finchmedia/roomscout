import type { PropsWithChildren } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mic, MicOff, PhoneOff } from "lucide-react";
import {
  useRealtimeVoiceScout,
  type UseRealtimeVoiceScoutOptions,
} from "../../hooks/useRealtimeVoiceScout";
import { VoiceSessionContext } from "./VoiceSessionContext";

/** Owned by the authenticated route, not a modal or a voice/text view. */
export function VoiceSessionProvider({
  children,
  options,
}: PropsWithChildren<{ options?: UseRealtimeVoiceScoutOptions }>) {
  const session = useRealtimeVoiceScout(options);
  const location = useLocation();
  const showOngoingCall =
    session.connected && location.pathname !== "/app/scout";
  return (
    <VoiceSessionContext.Provider value={session}>
      {children}
      {showOngoingCall ? (
        <aside
          className="rs-ongoing-call"
          aria-label="Laufendes Scout-Gespräch"
        >
          <Link to="/app/scout">
            <span className="rs-ongoing-call__dot" />
            Gespräch läuft · Zum Scout
          </Link>
          <button
            type="button"
            aria-label={
              session.muted ? "Mikrofon einschalten" : "Mikrofon stummschalten"
            }
            onClick={() => session.setMuted(!session.muted)}
          >
            {session.muted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            type="button"
            aria-label="Gespräch beenden"
            onClick={session.disconnect}
          >
            <PhoneOff size={18} />
          </button>
        </aside>
      ) : null}
    </VoiceSessionContext.Provider>
  );
}
