import { createContext, useContext } from "react";
import type { useRealtimeVoiceScout } from "../../hooks/useRealtimeVoiceScout";

export type VoiceSessionValue = ReturnType<typeof useRealtimeVoiceScout>;
export const VoiceSessionContext = createContext<VoiceSessionValue | null>(
  null,
);

export function useVoiceSession(): VoiceSessionValue {
  const session = useContext(VoiceSessionContext);
  if (!session)
    throw new Error(
      "VoiceSessionProvider is required inside the authenticated workspace.",
    );
  return session;
}
