import * as React from "react"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/utils"

/**
 * ChatComposer — the one place the user types a message, on both chat
 * surfaces: the Scout chat (`ScoutChat`) and Nachrichten
 * (`src/ui/inbox/ConversationThread.tsx`).
 *
 * It was extracted from `ScoutChat` verbatim, so every behaviour below is the
 * Scout chat's and stays observable there:
 * - **Enter sends, Shift+Enter breaks the line**, and an IME composition never
 *   submits (`isComposing` / the legacy `keyCode === 229`).
 * - **The draft clears at enqueue time**, not on resolution: the host has
 *   already put the user's own bubble on screen, and a composer that still
 *   holds the text reads as a second, unsent copy.
 * - **A failed send is recoverable.** `onSubmit` resolving `false` (or
 *   throwing) restores the text when the field is still empty; when the user
 *   has typed something newer it is kept and the failed draft stays available
 *   behind „Fehlgeschlagenen Entwurf wiederherstellen“, which prepends it.
 * - **A double Enter sends once** — the guard is a ref, so it holds inside one
 *   synchronous event pair, before React has re-rendered.
 *
 * What it deliberately does not own: the transcript, the busy *indicator*
 * (reported through `onBusyChange`, so the host can render its own "sending"
 * row and `aria-busy`), and any error that did not come from `onSubmit` —
 * those arrive as `error` and are rendered in the same alert region.
 */
interface ChatComposerLabels {
  /** Placeholder and accessible name of the textarea. */
  composer: string
  /** Accessible name of the send button. */
  send: string
  /** Shown when `onSubmit` resolves `false` or throws. */
  sendError: string
  /** Live-region text while a send is in flight. */
  sending: string
  /** Live-region text at rest. */
  status: string
  /** Label of the restore button for a failed draft. */
  restoreDraft: string
  /** Accessible name of the voice button; only used with `onVoice`. */
  voice: string
}

interface ChatComposerProps
  extends Omit<React.ComponentProps<"div">, "onSubmit" | "onError"> {
  /** Sends `body`; resolves `true` when it was accepted. */
  onSubmit: (body: string) => Promise<boolean>
  labels: ChatComposerLabels
  /** Host-side work in flight — disables sending without disabling typing. */
  busy?: boolean
  /** The conversation cannot take a message at all (paused, closed, no channel). */
  disabled?: boolean
  /** Why it is disabled, in German — rendered above the field. */
  disabledHint?: React.ReactNode
  /** An error the host owns (a failed decision answer, a failed reload). */
  error?: React.ReactNode
  /** Adds the microphone button before send. */
  onVoice?: () => void
  autoFocus?: boolean
  maxLength?: number
  /** Reports the composer's own in-flight state to the host. */
  onBusyChange?: (busy: boolean) => void
}

function ChatComposer({
  onSubmit,
  labels,
  busy = false,
  disabled = false,
  disabledHint,
  error,
  onVoice,
  autoFocus = false,
  maxLength = 4000,
  onBusyChange,
  className,
  ...props
}: ChatComposerProps) {
  const [draft, setDraft] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [failedDraft, setFailedDraft] = React.useState<string | null>(null)
  const submittingRef = React.useRef(false)
  const statusId = React.useId()
  const isBusy = busy || submitting

  const submit = async () => {
    const body = draft.trim()
    if (!body || busy || disabled || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    // Reported from the event, not from an effect: the host renders its own
    // "sending" row from it, and an effect would be one render behind.
    onBusyChange?.(true)
    setLocalError(null)
    setFailedDraft(null)
    setDraft("")
    try {
      const sent = await onSubmit(body)
      if (!sent) {
        setFailedDraft(body)
        setDraft((current) => (current === "" ? body : current))
        setLocalError(labels.sendError)
      }
    } catch {
      setFailedDraft(body)
      setDraft((current) => (current === "" ? body : current))
      setLocalError(labels.sendError)
    } finally {
      submittingRef.current = false
      setSubmitting(false)
      onBusyChange?.(false)
    }
  }

  const shownError = error || localError

  return (
    <div
      data-slot="chat-composer"
      className={cn("border-t border-rs-border-divider p-[var(--space-5)]", className)}
      {...props}
    >
      {disabledHint ? (
        <p
          role="status"
          className="mb-[var(--space-4)] text-[length:var(--text-caption-size)] text-rs-ink-6"
        >
          {disabledHint}
        </p>
      ) : null}

      {shownError ? (
        <div
          id={statusId}
          role="alert"
          className="mb-[var(--space-4)] flex flex-wrap items-center gap-[var(--space-3)] text-[length:var(--text-caption-size)] text-rs-red-text"
        >
          <span>{shownError}</span>
          {failedDraft && draft !== failedDraft ? (
            <Button
              type="button"
              variant="link"
              size="2xs"
              onClick={() => {
                setDraft((current) => (current ? `${failedDraft}\n\n${current}` : failedDraft))
                setFailedDraft(null)
              }}
            >
              {labels.restoreDraft}
            </Button>
          ) : null}
        </div>
      ) : null}

      <form
        className="flex items-end gap-[var(--space-3)] rounded-[var(--radius-card-md)] border border-rs-border-panel bg-rs-surface-composer py-[var(--space-3)] pr-[var(--space-3)] pl-[var(--space-7)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rs-orange"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <textarea
          autoFocus={autoFocus}
          aria-describedby={shownError ? statusId : undefined}
          aria-label={labels.composer}
          disabled={disabled}
          maxLength={maxLength}
          rows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key !== "Enter" ||
              event.shiftKey ||
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229
            )
              return
            event.preventDefault()
            void submit()
          }}
          placeholder={labels.composer}
          className="max-h-40 min-h-[2.25rem] min-w-0 flex-1 resize-y border-0 bg-transparent py-[var(--space-2)] text-[length:var(--text-body-size)] text-rs-ink outline-none! placeholder:text-rs-ink-7 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {onVoice && (
          <Button
            type="button"
            variant="primary"
            size="icon-sm"
            aria-label={labels.voice}
            onClick={onVoice}
            disabled={isBusy || disabled}
          >
            <Icon name="mic" />
          </Button>
        )}
        <Button
          type="submit"
          variant="secondary"
          size="icon-sm"
          aria-label={labels.send}
          disabled={isBusy || disabled || draft.trim().length === 0}
        >
          <Icon name="send" />
        </Button>
      </form>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {submitting ? labels.sending : labels.status}
      </span>
    </div>
  )
}

export { ChatComposer }
export type { ChatComposerLabels, ChatComposerProps }
