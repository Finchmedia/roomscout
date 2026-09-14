import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { DecisionCard, type OpenDecision } from "@/components/scout/DecisionCard"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Marker, MarkerContent } from "@/components/ui/marker"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { cn } from "@/lib/utils"

type ScoutChatAuthor = "scout" | "user" | "system"

interface ScoutChatMessage {
  id: string
  author: ScoutChatAuthor
  body: string
}

interface ScoutChatLabels {
  composer: string
  empty: string
  history: string
  historyBusy: string
  loadError: string
  restoreDraft: string
  scout: string
  send: string
  sendError: string
  sending: string
  status: string
  system: string
  user: string
  voice: string
}

interface ScoutChatProps extends Omit<React.ComponentProps<"section">, "onError"> {
  messages: ScoutChatMessage[]
  onSend: (body: string) => Promise<boolean>
  busy?: boolean
  error?: React.ReactNode
  onVoice?: () => void
  autoFocus?: boolean
  onLoadHistory?: () => Promise<void> | void
  hasMoreHistory?: boolean
  historyBusy?: boolean
  emptyState?: React.ReactNode
  labels?: Partial<ScoutChatLabels>
  /** The newest open Entscheidung; rendered as the last item so it scrolls with the chat. */
  decision?: OpenDecision | null
  /** `offer_ready`: the current content hash of the referenced offer. */
  decisionOfferHash?: string
  /** Records a button answer; resolves once the server accepted it. */
  onAnswerDecision?: (decisionId: OpenDecision["_id"], choice: string) => Promise<void>
  /** Shown as the Scout's bubble after an answer no chat message follows. */
  decisionAnsweredText?: string
}

/** Locally echoed answer to an Entscheidung: the musician's bubble plus the Scout's acknowledgement. */
interface DecisionEcho {
  id: string
  user: string
  scout?: string
}

const DEFAULT_LABELS: ScoutChatLabels = {
  composer: "Nachricht an deinen Scout …",
  empty: "Beginne ein Gespräch mit deinem Scout.",
  history: "Ältere Nachrichten laden",
  historyBusy: "Ältere Nachrichten werden geladen …",
  loadError: "Ältere Nachrichten konnten nicht geladen werden.",
  restoreDraft: "Fehlgeschlagenen Entwurf wiederherstellen",
  scout: "Dein Scout",
  send: "Senden",
  sendError: "Die Nachricht konnte nicht gesendet werden.",
  sending: "Nachricht wird gesendet …",
  status: "Gesprächsstatus",
  system: "System",
  user: "Du",
  voice: "Mit Scout sprechen",
}

function MarkdownMessage({ body }: { body: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ className, ...props }) => <a className={cn("text-rs-orange-light underline underline-offset-4", className)} {...props} />,
        blockquote: ({ className, ...props }) => <blockquote className={cn("border-l border-rs-border-accent pl-[var(--space-5)] text-rs-ink-3", className)} {...props} />,
        code: ({ className, ...props }) => <code className={cn("rounded-chip bg-rs-surface-inset px-[var(--space-1)] font-mono text-[.9em]", className)} {...props} />,
        ol: ({ className, ...props }) => <ol className={cn("ml-[var(--space-8)] list-decimal space-y-[var(--space-1)]", className)} {...props} />,
        p: ({ className, ...props }) => <p className={cn("not-last:mb-[var(--space-4)]", className)} {...props} />,
        pre: ({ className, ...props }) => <pre className={cn("max-w-full overflow-x-auto rounded-control bg-rs-surface-inset p-[var(--space-5)]", className)} {...props} />,
        ul: ({ className, ...props }) => <ul className={cn("ml-[var(--space-8)] list-disc space-y-[var(--space-1)]", className)} {...props} />,
      }}
    >
      {body}
    </ReactMarkdown>
  )
}

function ScoutChat({
  messages,
  onSend,
  busy = false,
  error,
  onVoice,
  autoFocus = false,
  onLoadHistory,
  hasMoreHistory = false,
  historyBusy = false,
  emptyState,
  labels: labelOverrides,
  decision,
  decisionOfferHash,
  onAnswerDecision,
  decisionAnsweredText,
  className,
  ...props
}: ScoutChatProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides }
  const [draft, setDraft] = React.useState("")
  const [echoes, setEchoes] = React.useState<DecisionEcho[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const [failedDraft, setFailedDraft] = React.useState<string | null>(null)
  const submittingRef = React.useRef(false)
  const isBusy = busy || submitting
  const statusId = React.useId()

  const submit = async () => {
    const body = draft.trim()
    if (!body || busy || submittingRef.current) return

    submittingRef.current = true
    setSubmitting(true)
    setLocalError(null)
    setFailedDraft(null)
    // The parent action persists the user turn before generating the reply, but
    // its promise covers the whole round trip. Clear at enqueue time so the
    // already-visible user bubble is not duplicated in the composer.
    setDraft("")
    try {
      const sent = await onSend(body)
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
    }
  }

  const answerDecision = async (choice: string, label: string) => {
    if (!decision || !onAnswerDecision) return
    setLocalError(null)
    try {
      await onAnswerDecision(decision._id, choice)
    } catch {
      setLocalError(labels.sendError)
      throw new Error("decision answer failed")
    }
    const quiet = decision.kind !== "scout_question" && decision.kind !== "offer_ready" && choice === "no"
    setEchoes((current) => [...current, {
      id: `decision-${decision._id}-${choice}`,
      user: label,
      ...(!quiet && decisionAnsweredText ? { scout: decisionAnsweredText } : {}),
    }])
  }

  const loadHistory = async () => {
    if (!onLoadHistory || historyBusy) return
    setLocalError(null)
    try {
      await onLoadHistory()
    } catch {
      setLocalError(labels.loadError)
    }
  }

  return (
    <section
      aria-busy={isBusy || historyBusy}
      aria-label="Scout-Chat"
      className={cn("flex h-[min(44rem,80dvh)] min-h-0 flex-col overflow-hidden rounded-card border border-rs-border-card bg-rs-surface-card", className)}
      {...props}
    >
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport aria-label="Nachrichtenverlauf" preserveScrollOnPrepend>
            <MessageScrollerContent className="p-[var(--space-7)]">
              {hasMoreHistory && onLoadHistory && (
                <div className="flex justify-center">
                  <Button type="button" variant="ghost" size="2xs" disabled={historyBusy} onClick={() => void loadHistory()}>
                    {historyBusy ? labels.historyBusy : labels.history}
                  </Button>
                </div>
              )}

              {messages.length === 0 && (
                <p className="m-auto max-w-[32rem] py-[var(--space-17)] text-center text-[length:var(--text-body-sm-size)] text-rs-ink-6">
                  {emptyState ?? labels.empty}
                </p>
              )}

              {messages.map((message) => {
                if (message.author === "system") {
                  return (
                    <MessageScrollerItem key={message.id} messageId={message.id}>
                      <Marker role="status" aria-label={labels.system}>
                        <MarkerContent>{message.body}</MarkerContent>
                      </Marker>
                    </MessageScrollerItem>
                  )
                }

                const isUser = message.author === "user"
                const speaker = isUser ? labels.user : labels.scout
                return (
                  <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={isUser}>
                    <Message align={isUser ? "end" : "start"} role="group" aria-label={speaker}>
                      <MessageContent>
                        <MessageHeader aria-hidden="true">{speaker}</MessageHeader>
                        <Bubble align={isUser ? "end" : "start"}>
                          <BubbleContent>
                            <MarkdownMessage body={message.body} />
                          </BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )
              })}

              {echoes.map((echo) => (
                <React.Fragment key={echo.id}>
                  <MessageScrollerItem messageId={`${echo.id}-user`} scrollAnchor>
                    <Message align="end" role="group" aria-label={labels.user}>
                      <MessageContent>
                        <MessageHeader aria-hidden="true">{labels.user}</MessageHeader>
                        <Bubble align="end"><BubbleContent>{echo.user}</BubbleContent></Bubble>
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                  {echo.scout ? (
                    <MessageScrollerItem messageId={`${echo.id}-scout`}>
                      <Message align="start" role="group" aria-label={labels.scout}>
                        <MessageContent>
                          <MessageHeader aria-hidden="true">{labels.scout}</MessageHeader>
                          <Bubble align="start"><BubbleContent>{echo.scout}</BubbleContent></Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ) : null}
                </React.Fragment>
              ))}

              {decision && onAnswerDecision ? (
                <MessageScrollerItem key={decision._id} messageId={`decision-${decision._id}`} scrollAnchor>
                  <DecisionCard decision={decision} offerHash={decisionOfferHash} onAnswer={answerDecision} busy={busy} />
                </MessageScrollerItem>
              ) : null}

              {isBusy && (
                <MessageScrollerItem messageId="scout-status">
                  <Message role="status" aria-label={labels.sending}>
                    <MessageContent>
                      <MessageHeader>{labels.scout}</MessageHeader>
                      <p className="text-[length:var(--text-body-sm-size)] text-rs-ink-6">{labels.sending}</p>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="border-t border-rs-border-divider p-[var(--space-5)]">
        {(error || localError) && (
          <div id={statusId} role="alert" className="mb-[var(--space-4)] flex flex-wrap items-center gap-[var(--space-3)] text-[length:var(--text-caption-size)] text-rs-red-text">
            <span>{error || localError}</span>
            {failedDraft && draft !== failedDraft ? (
              <Button
                type="button"
                variant="link"
                size="2xs"
                onClick={() => {
                  setDraft((current) => current ? `${failedDraft}\n\n${current}` : failedDraft)
                  setFailedDraft(null)
                }}
              >
                {labels.restoreDraft}
              </Button>
            ) : null}
          </div>
        )}
        <form
          className="flex items-end gap-[var(--space-3)] rounded-[var(--radius-card-md)] border border-rs-border-panel bg-rs-surface-composer py-[var(--space-3)] pr-[var(--space-3)] pl-[var(--space-7)] focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rs-orange"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <textarea
            autoFocus={autoFocus}
            aria-describedby={error || localError ? statusId : undefined}
            aria-label={labels.composer}
            maxLength={4000}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
              event.preventDefault()
              void submit()
            }}
            placeholder={labels.composer}
            className="max-h-40 min-h-[2.25rem] min-w-0 flex-1 resize-y border-0 bg-transparent py-[var(--space-2)] text-[length:var(--text-body-size)] text-rs-ink outline-none! placeholder:text-rs-ink-7"
          />
          {onVoice && (
            <Button type="button" variant="primary" size="icon-sm" aria-label={labels.voice} onClick={onVoice} disabled={isBusy}>
              <Icon name="mic" />
            </Button>
          )}
          <Button type="submit" variant="secondary" size="icon-sm" aria-label={labels.send} disabled={isBusy || draft.trim().length === 0}>
            <Icon name="send" />
          </Button>
        </form>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {submitting ? labels.sending : labels.status}
        </span>
      </div>
    </section>
  )
}

export { ScoutChat }
export type { ScoutChatAuthor, ScoutChatLabels, ScoutChatMessage, ScoutChatProps }
