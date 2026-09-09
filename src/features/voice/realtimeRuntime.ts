import type {
  RealtimeServerEvent,
  VoiceTranscriptItem,
} from "../../hooks/useRealtimeVoiceScout";

export type RealtimeFunctionCall = {
  call_id: string;
  name: string;
  arguments: string;
};

export function functionCallsFromResponse(
  event: RealtimeServerEvent,
): RealtimeFunctionCall[] {
  if (
    event.type !== "response.done" ||
    !event.response ||
    typeof event.response !== "object"
  )
    return [];
  if ((event.response as { status?: unknown }).status !== "completed")
    return [];
  const output = (event.response as { output?: unknown }).output;
  if (!Array.isArray(output)) return [];
  return output.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const call = item as {
      type?: unknown;
      call_id?: unknown;
      name?: unknown;
      arguments?: unknown;
    };
    return call.type === "function_call" &&
      typeof call.call_id === "string" &&
      typeof call.name === "string"
      ? [
          {
            call_id: call.call_id,
            name: call.name,
            arguments:
              typeof call.arguments === "string" ? call.arguments : "{}",
          },
        ]
      : [];
  });
}

export function reserveTranscriptItem(
  current: VoiceTranscriptItem[],
  id: string,
  role: VoiceTranscriptItem["role"],
) {
  if (current.some((item) => item.id === id)) return current;
  return [...current, { id, role, text: "", final: false }].slice(-24);
}

export function upsertTranscriptItem(
  current: VoiceTranscriptItem[],
  item: VoiceTranscriptItem,
) {
  const existing = current.findIndex((entry) => entry.id === item.id);
  if (existing < 0) return [...current, item].slice(-24);
  return current.map((entry, index) => (index === existing ? item : entry));
}

export function safeVoiceError(
  cause: unknown,
  fallback = "Could not start the Realtime session.",
) {
  if (cause instanceof DOMException && cause.name === "NotAllowedError")
    return "Microphone access was not allowed.";
  if (cause instanceof DOMException && cause.name === "NotFoundError")
    return "No microphone was found.";
  if (cause instanceof TypeError)
    return "The voice service could not be reached. Check your connection and try again.";
  const message = cause instanceof Error ? cause.message : "";
  if (/browser did not create/i.test(message))
    return "The browser could not create a voice connection.";
  return fallback;
}

export function safeProviderError(event: RealtimeServerEvent) {
  const code = event.error?.code ?? "";
  if (/rate_limit/i.test(code))
    return "The voice service is busy. Please wait a moment and try again.";
  if (/audio|microphone/i.test(code))
    return "The voice service could not process the microphone audio.";
  return "The Realtime session reported an error.";
}
