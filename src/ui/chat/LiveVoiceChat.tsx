import * as React from "react"

import { useVoiceSession } from "@/components/voice/VoiceSessionContext"
import { ChatTurn } from "@/ui/chat/ChatTurn"
import { Icon } from "@/components/ui/icon"
import { ScoutBlob, type ScoutBlobState } from "@/components/ui/scout-blob"
import { VoiceControl } from "@/components/ui/voice-control"
import type { VoiceScoutStatus } from "@/hooks/useRealtimeVoiceScout"
import { cn } from "@/lib/utils"
import { useCopy } from "@/ui/copy"

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
  /** Keep the active call small while text, a candidate, or an offer shares the centre pane. */
  compact?: boolean
  /** Suppress the decorative blob when the parent stage already renders one. */
  hideBlob?: boolean
  labels?: Partial<LiveVoiceChatLabels>
  className?: string
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
  title,
  compact = false,
  hideBlob = false,
  labels: labelOverrides,
  className,
}: LiveVoiceChatProps) {
  const voice = useVoiceSession()
  const { t } = useCopy()
  const labels: LiveVoiceChatLabels = {
    cancel: t("liveScout.voice.cancel"), connect: t("liveScout.voice.connect"),
    connecting: t("liveScout.voice.connecting"), controls: t("liveScout.voice.controls"),
    end: t("liveScout.voice.end"), error: t("liveScout.voice.error"),
    interrupt: t("liveScout.voice.interrupt"), listening: t("liveScout.voice.listening"),
    microphoneOff: t("liveScout.voice.microphoneOff"), microphoneOn: t("liveScout.voice.microphoneOn"),
    reconnect: t("liveScout.voice.reconnect"), scout: t("liveScout.voice.scout"),
    speaking: t("liveScout.voice.speaking"), status: t("liveScout.voice.status"),
    switchToText: t("liveScout.voice.switchToText"), thinking: t("liveScout.voice.thinking"),
    user: t("liveScout.voice.user"), ...labelOverrides,
  }
  const busy = BUSY_STATUSES.has(voice.status)
  const active = voice.connected || ACTIVE_STATUSES.has(voice.status)
  const transcript = voice.transcript

  // Input and output can overlap. Keep their actual caption rows in sequence.
  const latestTurns = React.useMemo(() => transcript.filter(turn => turn.text.trim()).slice(-8), [transcript])
  const captionEnd = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { captionEnd.current?.scrollIntoView?.({ block: "nearest" }) }, [latestTurns])

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
      aria-label={t("liveScout.voice.region")}
      data-scout-conversation="voice"
      data-compact={compact || undefined}
      className={cn(
        "flex min-h-0 w-full flex-col rounded-card border border-rs-border-card bg-rs-surface-card",
        compact
          ? "items-stretch justify-start gap-[var(--space-5)] px-[var(--space-5)] py-[var(--space-5)] text-left"
          : "items-center justify-center gap-[var(--space-11)] px-[var(--space-7)] py-[var(--space-13)] text-center",
        className
      )}
    >
      {!hideBlob && !compact ? <ScoutBlob state={blobState(voice.status)} size={160} /> : null}

      <div className={cn("max-w-[38rem]", compact && "w-full max-w-none")}>
        <h2 className={cn("font-light text-rs-ink", compact ? "text-[length:var(--text-body-lg-size)]" : "text-[length:var(--text-card-title-size)]")}>{title ?? t("liveScout.voice.title")}</h2>
        <p
          role={voice.error ? "alert" : "status"}
          className={cn(
            compact ? "mt-[var(--space-2)] text-[length:var(--text-caption-size)] text-rs-ink-6" : "mt-[var(--space-4)] text-[length:var(--text-body-sm-size)] text-rs-ink-6",
            voice.error && "text-rs-red-text"
          )}
        >
          {statusCopy}{voice.muted ? ` · ${t("liveScout.voice.muted")}` : ""}
        </p>
      </div>

      {voice.provider === "live" && (voice.backendState === "processing" || voice.pendingInputCount > 0 || voice.backendState === "outcome_unknown") ? (
        <p role="status" className="text-sm text-rs-ink-4">
          {voice.backendState === "outcome_unknown" ? t("liveScout.voice.outcomeUnknown") : voice.pendingInputCount > 0 ? t("liveScout.voice.queued") : t("liveScout.voice.updating")}
        </p>
      ) : null}

      {voice.provider === "live" && voice.backendState === "failed" ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-rs-red-text">
          <span>{t("liveScout.failed")}</span>
          <button type="button" className="underline underline-offset-4" onClick={() => voice.retryFailedInput()}>{t("liveScout.retry")}</button>
        </div>
      ) : null}

      {latestTurns.length > 0 && (
        <div
          aria-label={t("liveScout.voice.transcript")}
          data-voice-transcript-density={compact ? "compact" : "full"}
          className={cn(
            "flex w-full flex-col overflow-y-auto text-left",
            compact
              ? "max-h-[8.5rem] max-w-none gap-[var(--space-3)] rounded-control bg-rs-surface-inset px-[var(--space-4)] py-[var(--space-3)]"
              : "max-h-[32vh] max-w-[42rem] gap-[var(--space-5)]"
          )}
        >
          {latestTurns.map((turn) => {
            const user = turn.role === "user"
            return (
              <ChatTurn key={turn.id} who={user ? "user" : "scout"} label={user ? labels.user : labels.scout} compact>
                {turn.text}
              </ChatTurn>
            )
          })}
          <div ref={captionEnd} />
        </div>
      )}

      <div aria-label={labels.controls} role="group" className={cn("flex flex-wrap items-start justify-center", compact ? "gap-[var(--space-5)]" : "gap-[var(--space-9)]")}>
        {!active && !busy && (
          <VoiceControl
            tone="accent"
            density={compact ? "narrow" : "wide"}
            label={voice.status === "error" || voice.status === "disconnected" ? labels.reconnect : labels.connect}
            onClick={() => void voice.connect()}
          >
            <Icon name={voice.status === "idle" ? "mic" : "restart"} size={22} />
          </VoiceControl>
        )}

        {busy && (
          <VoiceControl density={compact ? "narrow" : "wide"} tone="danger" label={labels.cancel} onClick={end}>
            <Icon name="close" size={22} />
          </VoiceControl>
        )}

        {active && (
          <>
            <VoiceControl
              tone="accent"
              density={compact ? "narrow" : "wide"}
              active={!voice.muted}
              label={voice.muted ? labels.microphoneOn : labels.microphoneOff}
              onClick={() => voice.setMuted(!voice.muted)}
            >
              <Icon name={voice.muted ? "mic-off" : "mic"} size={22} />
            </VoiceControl>
            {(voice.scoutSpeaking || voice.status === "speaking") && (
              <VoiceControl density={compact ? "narrow" : "wide"} label={labels.interrupt} onClick={voice.interrupt}>
                <Icon name="pause" size={22} />
              </VoiceControl>
            )}
            <VoiceControl density={compact ? "narrow" : "wide"} tone="danger" label={labels.end} onClick={end}>
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
