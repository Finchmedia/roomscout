import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { ChatComposer } from "@/ui/chat/ChatComposer"
import { DecisionCard, type OpenDecision } from "@/components/scout/DecisionCard"
import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Button } from "@/components/ui/button"
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
  const [echoes, setEchoes] = React.useState<DecisionEcho[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [localError, setLocalError] = React.useState<string | null>(null)
  const isBusy = busy || submitting

  // The composer owns the draft, the failed-draft recovery and its own send
  // error; the chat only needs to know that something is in flight (for the
  // "sending" row and `aria-busy`) and to clear the errors it raised itself.
  const submit = async (body: string) => {
    setLocalError(null)
    return await onSend(body)
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

      <ChatComposer
        labels={labels}
        onSubmit={submit}
        busy={busy}
        error={error || localError}
        onVoice={onVoice}
        autoFocus={autoFocus}
        onBusyChange={setSubmitting}
      />
    </section>
  )
}

export { ScoutChat }
export type { ScoutChatAuthor, ScoutChatLabels, ScoutChatMessage, ScoutChatProps }
