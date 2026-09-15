import * as React from "react"

import { useVoiceSession } from "@/components/voice/VoiceSessionContext"
import { ChatTurn } from "@/ui/chat/ChatTurn"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
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
  /** Give captions more room when voice is the centre pane's primary conversation. */
  primary?: boolean
  /** Keep call controls visible while an explicit text view owns the conversation history. */
  showTranscript?: boolean
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

interface CallControlProps {
  active?: boolean
  children: React.ReactNode
  compact: boolean
  label: string
  onClick: React.MouseEventHandler<HTMLButtonElement>
  tone?: "accent" | "danger" | "neutral"
}

function CallControl({ active, children, compact, label, onClick, tone = "neutral" }: CallControlProps) {
  if (compact) {
    const variant = tone === "danger" ? "danger" : tone === "accent" && active !== false ? "accent" : "outline"
    return (
      <IconButton label={label} onClick={onClick} size={36} variant={variant}>
        {children}
      </IconButton>
    )
  }
  return <VoiceControl active={active} label={label} onClick={onClick} tone={tone}>{children}</VoiceControl>
}

function LiveVoiceChat({
  onEnd,
  onText,
  title,
  compact = false,
  primary = false,
  showTranscript = true,
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
  const captionViewport = React.useRef<HTMLDivElement>(null)
  const followLatestCaption = React.useRef(true)
  React.useLayoutEffect(() => {
    const viewport = captionViewport.current
    if (viewport && followLatestCaption.current) viewport.scrollTop = viewport.scrollHeight
  }, [latestTurns])

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
  const backendStatusCopy = voice.provider === "live"
    ? voice.backendState === "outcome_unknown"
      ? t("liveScout.voice.outcomeUnknown")
      : voice.pendingInputCount > 0
        ? t("liveScout.voice.queued")
        : voice.backendState === "processing"
          ? t("liveScout.voice.updating")
          : undefined
    : undefined

  const end = () => {
    voice.disconnect()
    onEnd?.()
  }

  return (
    <section
      aria-label={t("liveScout.voice.region")}
      data-scout-conversation="voice"
      data-compact={compact || undefined}
      data-primary={primary || undefined}
      className={cn(
        "flex min-h-0 w-full flex-col rounded-card border border-rs-border-card bg-rs-surface-card",
        compact
          ? cn(
              "items-stretch justify-start gap-[var(--space-3)] overflow-hidden px-[var(--space-4)] py-[var(--space-4)] text-left",
              primary ? "max-h-[min(30rem,calc(100dvh-10rem))]" : "max-h-[220px]"
            )
          : "items-center justify-center gap-[var(--space-11)] px-[var(--space-7)] py-[var(--space-13)] text-center",
        className
      )}
    >
      {!hideBlob && !compact ? <ScoutBlob state={blobState(voice.status)} size={160} /> : null}
      {!hideBlob && compact && primary ? <ScoutBlob className="shrink-0 self-center" state={blobState(voice.status)} size={96} /> : null}

      <div className={cn("max-w-[38rem]", compact && "flex w-full min-w-0 items-center gap-[var(--space-4)]")}>
        {!hideBlob && compact && !primary ? <ScoutBlob className="shrink-0" state={blobState(voice.status)} size={48} /> : null}
        <div className={cn(compact && "flex min-w-0 flex-1 items-center justify-between gap-[var(--space-4)]")}>
          <h2 className={cn("shrink-0 font-light text-rs-ink", compact ? "text-[length:var(--text-body-size)]" : "text-[length:var(--text-card-title-size)]")}>{title ?? t("liveScout.voice.title")}</h2>
          <p
            role={voice.error ? "alert" : "status"}
            className={cn(
              compact ? "min-w-0 truncate text-right text-[length:var(--text-micro-size)] text-rs-ink-6" : "mt-[var(--space-4)] text-[length:var(--text-body-sm-size)] text-rs-ink-6",
              voice.error && "text-rs-red-text"
            )}
          >
            {statusCopy}{voice.muted ? ` · ${t("liveScout.voice.muted")}` : ""}{backendStatusCopy ? ` · ${backendStatusCopy}` : ""}
          </p>
        </div>
      </div>

      {voice.provider === "live" && voice.backendState === "failed" ? (
        <div role="alert" className={cn("flex items-center gap-3 text-sm text-rs-red-text", compact && "text-[length:var(--text-micro-size)]")}>
          <span>{t("liveScout.failed")}</span>
          <button type="button" className="underline underline-offset-4" onClick={() => voice.retryFailedInput()}>{t("liveScout.retry")}</button>
        </div>
      ) : null}

      {showTranscript && latestTurns.length > 0 && (
        <div
          ref={captionViewport}
          aria-label={t("liveScout.voice.transcript")}
          data-voice-transcript-density={compact ? "compact" : "full"}
          onScroll={(event) => {
            const viewport = event.currentTarget
            followLatestCaption.current =
              viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 24
          }}
          className={cn(
            "flex w-full flex-col overflow-y-auto text-left",
            compact
              ? cn(
                  "min-h-0 flex-1 max-w-none gap-[var(--space-2)] rounded-control bg-rs-surface-inset px-[var(--space-3)] py-[var(--space-2)]",
                  primary ? "max-h-[13rem]" : "max-h-[5rem]"
                )
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
        </div>
      )}

      <div
        aria-label={labels.controls}
        role="group"
        data-voice-controls-density={compact ? "compact" : "full"}
        className={cn("flex items-start justify-center", compact ? "min-h-9 flex-nowrap items-center gap-[var(--space-3)]" : "flex-wrap gap-[var(--space-9)]")}
      >
        {!active && !busy && (
          <CallControl
            tone="accent"
            compact={compact}
            label={voice.status === "error" || voice.status === "disconnected" ? labels.reconnect : labels.connect}
            onClick={() => void voice.connect()}
          >
            <Icon name={voice.status === "idle" ? "mic" : "restart"} size={compact ? 18 : 22} />
          </CallControl>
        )}

        {busy && (
          <CallControl compact={compact} tone="danger" label={labels.cancel} onClick={end}>
            <Icon name="close" size={compact ? 18 : 22} />
          </CallControl>
        )}

        {active && (
          <>
            <CallControl
              tone="accent"
              compact={compact}
              active={!voice.muted}
              label={voice.muted ? labels.microphoneOn : labels.microphoneOff}
              onClick={() => voice.setMuted(!voice.muted)}
            >
              <Icon name={voice.muted ? "mic-off" : "mic"} size={compact ? 18 : 22} />
            </CallControl>
            {(voice.scoutSpeaking || voice.status === "speaking") && (
              <CallControl compact={compact} label={labels.interrupt} onClick={voice.interrupt}>
                <Icon name="pause" size={compact ? 18 : 22} />
              </CallControl>
            )}
            <CallControl compact={compact} tone="danger" label={labels.end} onClick={end}>
              <Icon name="close" size={compact ? 18 : 22} />
            </CallControl>
          </>
        )}
        {compact && onText ? (
          <button
            type="button"
            className="ml-auto min-w-0 truncate rounded-pill px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-micro-size)] text-rs-ink-3 underline decoration-rs-border-control-strong underline-offset-4 hover:text-rs-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange"
            onClick={onText}
          >
            {labels.switchToText}
          </button>
        ) : null}
      </div>

      {!compact && onText && (
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
