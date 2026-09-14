import * as React from "react"

import { useVoiceSession } from "@/components/voice/VoiceSessionContext"
import { ChatTurn } from "@/ui/chat/ChatTurn"
import { Icon } from "@/components/ui/icon"
import { ScoutBlob, type ScoutBlobState } from "@/components/ui/scout-blob"
import { VoiceControl } from "@/components/ui/voice-control"
import type { VoiceScoutStatus } from "@/hooks/useRealtimeVoiceScout"
import { cn } from "@/lib/utils"

interface LiveVoiceChatLabels {
  cancel: string
  connect: string
  connecting: string
  controls: string
  end: string
  error: string
  interrupt: string
  listening: string
  microphoneOff: string
  microphoneOn: string
  reconnect: string
  scout: string
  speaking: string
  status: string
  switchToText: string
  thinking: string
  user: string
}

interface LiveVoiceChatProps {
  onEnd?: () => void
  onText?: () => void
  title?: React.ReactNode
  /** Suppress the decorative blob when the parent stage already renders one. */
  hideBlob?: boolean
  labels?: Partial<LiveVoiceChatLabels>
  className?: string
}

const DEFAULT_LABELS: LiveVoiceChatLabels = {
  cancel: "Verbindungsaufbau abbrechen",
  connect: "Gespräch starten",
  connecting: "Gespräch wird verbunden …",
  controls: "Gesprächssteuerung",
  end: "Gespräch beenden",
  error: "Verbindung unterbrochen",
  interrupt: "Scout unterbrechen",
  listening: "Ich höre zu",
  microphoneOff: "Mikrofon ausschalten",
  microphoneOn: "Mikrofon einschalten",
  reconnect: "Gespräch erneut starten",
  scout: "Dein Scout",
  speaking: "Dein Scout spricht",
  status: "Bereit, wenn du es bist",
  switchToText: "Zum Schreiben wechseln",
  thinking: "Ich denke kurz nach",
  user: "Du",
}

const BUSY_STATUSES: ReadonlySet<VoiceScoutStatus> = new Set([
  "requesting_microphone",
  "connecting",
  "creating_session",
])

const ACTIVE_STATUSES: ReadonlySet<VoiceScoutStatus> = new Set([
  "listening",
  "thinking",
  "speaking",
])

function blobState(status: VoiceScoutStatus): ScoutBlobState {
  if (status === "listening" || status === "thinking" || status === "speaking") return status
  if (BUSY_STATUSES.has(status)) return "thinking"
  return "idle"
}

function LiveVoiceChat({
  onEnd,
  onText,
  title = "Erzähl mir, was ihr sucht.",
  hideBlob = false,
  labels: labelOverrides,
  className,
}: LiveVoiceChatProps) {
  const voice = useVoiceSession()
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const busy = BUSY_STATUSES.has(voice.status)
  const active = voice.connected || ACTIVE_STATUSES.has(voice.status)
  const transcript = voice.transcript

  const latestTurns = React.useMemo(() => {
    const latestByRole = new Map<"user" | "assistant", (typeof transcript)[number]>()
    for (let index = transcript.length - 1; index >= 0; index -= 1) {
      const turn = transcript[index]
      if (!turn) continue
      if (turn.text.trim() && !latestByRole.has(turn.role)) latestByRole.set(turn.role, turn)
      if (latestByRole.size === 2) break
    }
    return transcript.filter((turn) => latestByRole.get(turn.role)?.id === turn.id)
  }, [transcript])

  const statusCopy = voice.error ?? (
    busy
      ? labels.connecting
      : voice.status === "listening"
        ? labels.listening
        : voice.status === "thinking"
          ? labels.thinking
          : voice.status === "speaking"
            ? labels.speaking
            : voice.status === "error"
              ? labels.error
              : labels.status
  )

  const end = () => {
    voice.disconnect()
    onEnd?.()
  }

  return (
    <section
      aria-label="Gespräch mit deinem Room Scout"
      className={cn(
        "flex min-h-0 w-full flex-col items-center justify-center gap-[var(--space-11)] rounded-card border border-rs-border-card bg-rs-surface-card px-[var(--space-7)] py-[var(--space-13)] text-center",
        className
      )}
    >
      {!hideBlob && <ScoutBlob state={blobState(voice.status)} size={160} />}

      <div className="max-w-[38rem]" aria-live="polite" aria-atomic="true">
        <h2 className="text-[length:var(--text-card-title-size)] font-light text-rs-ink">{title}</h2>
        <p
          role={voice.error ? "alert" : "status"}
          className={cn(
            "mt-[var(--space-4)] text-[length:var(--text-body-sm-size)] text-rs-ink-6",
            voice.error && "text-rs-red-text"
          )}
        >
          {statusCopy}{voice.muted ? ` · ${labels.microphoneOn}` : ""}
        </p>
      </div>

      {latestTurns.length > 0 && (
        <div aria-label="Letzte Gesprächsbeiträge" className="flex w-full max-w-[42rem] flex-col gap-[var(--space-5)] text-left">
          {latestTurns.map((turn) => {
            const user = turn.role === "user"
            return (
              <ChatTurn key={turn.id} who={user ? "user" : "scout"} label={user ? labels.user : labels.scout} compact>
                {turn.text}
              </ChatTurn>
            )
          })}
        </div>
      )}

      <div aria-label={labels.controls} role="group" className="flex flex-wrap items-start justify-center gap-[var(--space-9)]">
        {!active && !busy && (
          <VoiceControl
            tone="accent"
            label={voice.status === "error" || voice.status === "disconnected" ? labels.reconnect : labels.connect}
            onClick={() => void voice.connect()}
          >
            <Icon name={voice.status === "idle" ? "mic" : "restart"} size={22} />
          </VoiceControl>
        )}

        {busy && (
          <VoiceControl tone="danger" label={labels.cancel} onClick={end}>
            <Icon name="close" size={22} />
          </VoiceControl>
        )}

        {active && (
          <>
            <VoiceControl
              tone="accent"
              active={!voice.muted}
              label={voice.muted ? labels.microphoneOn : labels.microphoneOff}
              onClick={() => voice.setMuted(!voice.muted)}
            >
              <Icon name={voice.muted ? "mic-off" : "mic"} size={22} />
            </VoiceControl>
            {voice.status === "speaking" && (
              <VoiceControl label={labels.interrupt} onClick={voice.interrupt}>
                <Icon name="pause" size={22} />
              </VoiceControl>
            )}
            <VoiceControl tone="danger" label={labels.end} onClick={end}>
              <Icon name="close" size={22} />
            </VoiceControl>
          </>
        )}
      </div>

      {onText && (
        <button
          type="button"
          className="rounded-pill px-[var(--space-5)] py-[var(--space-3)] text-[length:var(--text-caption-size)] text-rs-ink-3 underline decoration-rs-border-control-strong underline-offset-4 hover:text-rs-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange"
          onClick={onText}
        >
          {labels.switchToText}
        </button>
      )}
    </section>
  )
}

export { LiveVoiceChat }
export type { LiveVoiceChatLabels, LiveVoiceChatProps }
