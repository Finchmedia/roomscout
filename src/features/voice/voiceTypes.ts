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
