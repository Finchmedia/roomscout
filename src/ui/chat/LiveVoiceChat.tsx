import * as React from "react"

import { useVoiceSession } from "@/components/voice/VoiceSessionContext"
import { ChatTurn } from "@/ui/chat/ChatTurn"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ScoutBlob, type ScoutBlobState } from "@/components/ui/scout-blob"
import { VoiceControl } from "@/components/ui/voice-control"
import type { VoiceScoutStatus } from "@/features/voice/voiceTypes"
import { cn } from "@/lib/utils"
import { cleanVoiceTranscript } from "@/features/voice/transcriptText"
import { useCopy } from "@/ui/copy"
import { ScoutThinkingIndicator } from "@/ui/chat/ScoutThinkingIndicator"

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

/**
 * A single waiting item is usually the backend finishing the previous turn, not a
 * stuck message. Only a real backlog, or a wait this long, earns the queued copy.
 */
const QUEUED_LABEL_DELAY_MS = 4_000

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
  const handledAutomaticEnd = React.useRef(voice.automaticEndToken)
  React.useEffect(() => {
    if (
      voice.automaticEndToken === 0 ||
      voice.automaticEndToken === handledAutomaticEnd.current
    ) return
    handledAutomaticEnd.current = voice.automaticEndToken
    onEnd?.()
  }, [onEnd, voice.automaticEndToken])
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
  const latestTurns = React.useMemo(() => transcript.map(turn => ({ ...turn, text: turn.role === "assistant" ? cleanVoiceTranscript(turn.text) : turn.text })).filter(turn => turn.text.trim()), [transcript])
  const captionViewport = React.useRef<HTMLDivElement>(null)
  const followLatestCaption = React.useRef(true)

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
  const hasPending = voice.pendingInputCount > 0
  const [queuedLongEnough, setQueuedLongEnough] = React.useState(false)
  // The gate belongs to one stretch of pending work: when the queue empties, the
  // next single item must wait its full turn again. Resetting from the previous
  // render's value keeps the effect below free of synchronous state writes.
  const [wasPending, setWasPending] = React.useState(hasPending)
  if (wasPending !== hasPending) {
    setWasPending(hasPending)
    if (!hasPending) setQueuedLongEnough(false)
  }
  React.useEffect(() => {
    // Keyed on the boolean so a count change 1 -> 2 does not restart the wait.
    if (!hasPending) return
    const timer = window.setTimeout(() => setQueuedLongEnough(true), QUEUED_LABEL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [hasPending])
  const showQueued = voice.pendingInputCount > 1 || (hasPending && queuedLongEnough)
  // While the Scout is audibly speaking, background work is not news; the
  // speaking status line already tells the musician what is happening.
  const backendStatusCopy = voice.backendState === "outcome_unknown"
    ? t("liveScout.voice.outcomeUnknown")
    : voice.status === "speaking"
      ? undefined
      : showQueued
        ? t("liveScout.voice.queued")
        : voice.backendState === "processing"
          ? t("liveScout.voice.updating")
          : undefined
  const pendingCopy = voice.error
    ? undefined
    : busy
      ? labels.connecting
      : backendStatusCopy ?? (voice.status === "thinking" ? labels.thinking : undefined)
  const stateLineCopy = voice.error ?? (
    voice.muted
      ? t("liveScout.voice.muted")
      : pendingCopy
        ? undefined
        : statusCopy
  )
  React.useLayoutEffect(() => {
    const viewport = captionViewport.current
    if (viewport && followLatestCaption.current) viewport.scrollTop = viewport.scrollHeight
  }, [latestTurns, pendingCopy])

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
        "mx-auto flex min-h-0 w-full max-w-[var(--width-card)] flex-col",
        compact
          ? cn(
              "items-stretch justify-start gap-[var(--space-3)] overflow-visible px-[var(--space-3)] py-[var(--space-3)] text-left",
              primary ? "max-h-[calc(100dvh-10rem)]" : "max-h-[min(22rem,40dvh)]"
            )
          : "items-center justify-center gap-[var(--space-11)] rounded-card border border-rs-border-card bg-rs-surface-card px-[var(--space-7)] py-[var(--space-13)] text-center",
        className
      )}
    >
      {!hideBlob && !compact ? <ScoutBlob state={blobState(voice.status)} size={160} /> : null}
      {!hideBlob && compact && primary ? <ScoutBlob className="shrink-0 self-center" state={blobState(voice.status)} size={96} /> : null}

      {/* Compact mode keeps this row mounted: the status line empties while the
          thinking indicator carries its copy, and a row that unmounts (with the
          48px blob in companion mode) moved the whole card on every turn. */}
      {(compact || title || stateLineCopy) ? <div className={cn("max-w-[38rem] shrink-0", compact && "flex w-full min-w-0 items-center gap-[var(--space-4)]")}>
        {!hideBlob && compact && !primary ? <ScoutBlob className="shrink-0" state={blobState(voice.status)} size={48} /> : null}
        <div className={cn(compact && "flex min-w-0 flex-1 items-center justify-between gap-[var(--space-4)]")}>
          {title ? <h2 className={cn("shrink-0 font-light text-rs-ink", compact ? "text-[length:var(--text-body-size)]" : "text-[length:var(--text-card-title-size)]")}>{title}</h2> : null}
          <p
            role={voice.error ? "alert" : stateLineCopy ? "status" : undefined}
            aria-hidden={stateLineCopy ? undefined : true}
            data-voice-state-line
            className={cn(
              compact ? "min-h-[1.5em] min-w-0 flex-1 truncate text-right text-[length:var(--text-micro-size)] leading-[1.5] text-rs-ink-6" : "mt-[var(--space-4)] min-h-[1.5em] text-[length:var(--text-body-sm-size)] text-rs-ink-6",
              voice.error && "text-rs-red-text"
            )}
          >
            {stateLineCopy ?? "\u00a0"}
          </p>
        </div>
      </div> : null}

      {voice.backendState === "failed" ? (
        <div role="alert" className={cn("flex items-center gap-3 text-sm text-rs-red-text", compact && "text-[length:var(--text-micro-size)]")}>
          <span>{t("liveScout.failed")}</span>
          <button type="button" className="underline underline-offset-4" onClick={() => voice.retryFailedInput()}>{t("liveScout.retry")}</button>
        </div>
      ) : null}

      {showTranscript && (
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
            // The component pins its own scroll position (no browser anchoring);
            // the height is reserved per mode so the card does not grow turn by
            // turn, and the first child floats down while the region is empty.
            "flex w-full flex-col overflow-y-auto text-left [overflow-anchor:none] [&>*:first-child]:mt-auto",
            compact
              ? cn(
                  "min-h-0 flex-1 max-w-none gap-[var(--space-3)] px-1 py-[var(--space-2)]",
                  primary
                    ? "h-[clamp(16rem,44dvh,32rem)] flex-none max-h-[calc(100dvh-22rem)]"
                    : "h-[clamp(8rem,20dvh,14rem)] flex-none max-h-[24dvh]"
                )
              : "max-h-[32vh] max-w-[var(--width-card)] gap-[var(--space-5)]"
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
          {/* Reserved row: the indicator swaps in and out without moving the captions above it. */}
          <div className="min-h-6 shrink-0" data-voice-pending-row>
            {pendingCopy ? <ScoutThinkingIndicator label={pendingCopy} text={pendingCopy} /> : null}
          </div>
        </div>
      )}

      <div
        aria-label={labels.controls}
        role="group"
        data-voice-controls-density={compact ? "compact" : "full"}
        className={cn("flex shrink-0 items-start justify-center", compact ? "min-h-9 flex-nowrap items-center gap-[var(--space-3)]" : "flex-wrap gap-[var(--space-9)]")}
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
