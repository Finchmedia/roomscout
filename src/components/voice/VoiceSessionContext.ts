import { createContext, useContext } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import type {
  LiveBackendState,
  LiveConnectionState,
  LiveFocus,
  LiveMicrophoneState,
  VerifiedBackgroundUpdate,
} from "../../hooks/useGptLiveVoiceScout";
import type {
  VoiceScoutModality,
  VoiceScoutStatus,
  VoiceTranscriptItem,
} from "../../hooks/useRealtimeVoiceScout";
import type { LiveLocale } from "../../features/voice/gptLiveRuntime";

export type VoiceProvider = "live" | "realtime";

export type VoiceSessionValue = {
  provider: VoiceProvider;
  status: VoiceScoutStatus;
  modality: VoiceScoutModality;
  muted: boolean;
  providerMuted: boolean;
  error?: string;
  transcript: VoiceTranscriptItem[];
  connectedAt?: number;
  connected: boolean;
  volume: number;
  connectionState: LiveConnectionState;
  microphoneState: LiveMicrophoneState;
  userSpeaking: boolean;
  scoutSpeaking: boolean;
  backendState: LiveBackendState;
  pendingInputCount: number;
  pendingTextDraft: string;
  sessionLocale: LiveLocale;
  connect: () => Promise<void>;
  disconnect: () => void;
  setMuted: (muted: boolean) => void;
  setModality: (modality: VoiceScoutModality) => void;
  sendText: (text: string) => boolean;
  flushPendingInputs: () => Promise<boolean>;
  retryFailedInput: () => boolean;
  clearPendingTextDraft: () => void;
  interrupt: () => void;
  stopSpeaking: () => void;
  setLanguage: (locale: LiveLocale) => void;
  setFocus: (focus: LiveFocus) => void;
  appendVerifiedBackgroundUpdate: (update: VerifiedBackgroundUpdate) => boolean;
  clearBackgroundUpdate: (id: string) => void;
  clearBackgroundUpdates: () => void;
  sendEvent: (event: Record<string, unknown>) => boolean;
  voiceSessionId?: Id<"voiceSessions">;
};
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
