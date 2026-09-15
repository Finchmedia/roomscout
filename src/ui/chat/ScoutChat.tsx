import { useSmoothText } from "@convex-dev/agent/react"
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

/** The Agent component's message status, as the thread reports it. */
type ScoutChatMessageStatus = "streaming" | "pending" | "success" | "failed"

/**
 * The parts of a message the chat renders. Prose arrives as `text`; a tool call
 * arrives as `tool-<toolName>` with the state of its input — the server strips
 * the inputs and outputs themselves, the chat only ever says *that* it ran.
 */
interface ScoutChatMessagePart {
  type: string
  text?: string
  toolCallId?: string
  state?: string
}

interface ScoutChatMessage {
  id: string
  author: ScoutChatAuthor
  body: string
  /** Absent for locally composed rows (the intro line, the gallery fixtures). */
  status?: ScoutChatMessageStatus
  parts?: readonly ScoutChatMessagePart[]
}

interface ScoutChatLabels {
  composer: string
  empty: string
  failed: string
  history: string
  historyBusy: string
  loadError: string
  /**
   * @deprecated Unused. The composer no longer explains the wait — it stays
   * usable while the Scout replies and the thinking Marker is the one place
   * that says so. Kept so hosts that still pass it keep compiling.
   */
  replying: string
  restoreDraft: string
  retry: string
  scout: string
  send: string
  sendError: string
  sending: string
  status: string
  system: string
  /** Accessible name of the thinking Marker; the visible line is a rotating verb. */
  thinking: string
  /**
   * What the thinking Marker shows, rotated every ~2.2 s from a random start.
   * `src/ui/chat/thinkingVerbs.ts` holds the copy keys a host resolves.
   */
  thinkingVerbs: readonly string[]
  /** One label per tool name; `toolDefault` covers a tool with no entry. */
  tools: Record<string, string>
  toolDefault: string
  user: string
  voice: string
}

interface ScoutChatProps extends Omit<React.ComponentProps<"section">, "onError"> {
  messages: ScoutChatMessage[]
  onSend: (body: string) => Promise<boolean>
  /** The thread has an unfinished turn on it — derived from the messages, never from a local flag. */
  replying?: boolean
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
  /**
   * Records the answer; resolves once the server accepted it. `text` is the
   * musician's own wording and arrives with `choice === "custom"` — pass both
   * to `api.decisions.answer`.
   */
  onAnswerDecision?: (decisionId: OpenDecision["_id"], choice: string, text?: string) => Promise<void>
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
  failed: "Antwort fehlgeschlagen.",
  history: "Ältere Nachrichten laden",
  historyBusy: "Ältere Nachrichten werden geladen …",
  loadError: "Ältere Nachrichten konnten nicht geladen werden.",
  replying: "Dein Scout antwortet gerade …",
  restoreDraft: "Fehlgeschlagenen Entwurf wiederherstellen",
  retry: "Erneut senden",
  scout: "Dein Scout",
  send: "Senden",
  sendError: "Die Nachricht konnte nicht gesendet werden.",
  sending: "Nachricht wird gesendet …",
  status: "Gesprächsstatus",
  system: "System",
  thinking: "Dein Scout denkt nach …",
  thinkingVerbs: [
    "Sortiert Gedanken …",
    "Blättert im Suchauftrag …",
    "Wägt Optionen ab …",
    "Formuliert …",
    "Hört noch mal genau hin …",
    "Prüft die Details …",
  ],
  tools: {},
  toolDefault: "Arbeitet …",
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

/**
 * The Scout's prose. `useSmoothText` paces the deltas, which land in bursts,
 * into an even line — and it keeps pacing after the message flipped to
 * `success`, so the last burst is read rather than blinked in.
 *
 * Whether to pace at all is decided once, on mount, and held: a reply the
 * musician walked in on keeps animating to the end, while history loaded after
 * the fact is simply there. The message id keys this element, so the instance —
 * and with it the decision — survives every status change of that message.
 */
function ScoutText({ body, streaming }: { body: string; streaming: boolean }) {
  const [watched] = React.useState(streaming)
  const [visible] = useSmoothText(body, { startStreaming: watched })
  return <MarkdownMessage body={watched ? visible : body} />
}

/** The tool name behind an AI SDK tool part: `tool-rememberFact` → `rememberFact`. */
function toolName(type: string) {
  return type.startsWith("tool-") ? type.slice("tool-".length) : type
}

/** A tool call the Scout has started but not finished — the only ones worth a line. */
function runningToolParts(message: ScoutChatMessage) {
  if (message.status !== "streaming" && message.status !== "pending") return []
  return (message.parts ?? []).filter(
    (part) =>
      part.toolCallId !== undefined &&
      (part.state === "input-streaming" || part.state === "input-available"),
  )
}

/** How long one thinking verb stays up before the next one takes over. */
const THINKING_VERB_INTERVAL = 2_200

/**
 * The line the chat shows while the Scout works and has written nothing yet.
 *
 * Two things make it read as somebody thinking rather than as a frozen label:
 * the text sweeps (shadcn's `shimmer` utility from `shadcn/tailwind.css`), and the
 * verb rotates. The rotation starts at a random index, so two waits in a row do
 * not open with the same canned line, and the element is mounted only while the
 * Scout is pending — a new turn is therefore a new start, for free.
 *
 * The accessible name stays `label` („Dein Scout denkt nach …“): a screen
 * reader gets one stable status, not a verb changing under it every two
 * seconds.
 */
function ThinkingMarker({ label, verbs }: { label: string; verbs: readonly string[] }) {
  const [index, setIndex] = React.useState(() =>
    verbs.length > 0 ? Math.floor(Math.random() * verbs.length) : 0
  )

  React.useEffect(() => {
    if (verbs.length < 2) return
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % verbs.length),
      THINKING_VERB_INTERVAL
    )
    return () => clearInterval(timer)
  }, [verbs.length])

  return (
    <Marker role="status" aria-label={label}>
      <MarkerContent className="shimmer">
        {(verbs.length > 0 ? verbs[index % verbs.length] : undefined) ?? label}
      </MarkerContent>
    </Marker>
  )
}

function ScoutChat({
  messages,
  onSend,
  replying = false,
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
  const [localError, setLocalError] = React.useState<string | null>(null)

  // The composer owns the draft, the failed-draft recovery and its own send
  // error; the chat only clears the errors it raised itself. Everything the
  // transcript shows about the turn in flight comes from `messages`.
  const submit = async (body: string) => {
    setLocalError(null)
    return await onSend(body)
  }

  const answerDecision = async (choice: string, label: string, text?: string) => {
    if (!decision || !onAnswerDecision) return
    setLocalError(null)
    try {
      await onAnswerDecision(decision._id, choice, text)
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

  // The Scout is working and has not written anything yet — the pending reply,
  // and the moment before the thread even carries it.
  const newest = messages.at(-1)
  const thinking =
    replying && (newest === undefined || newest.author !== "scout" || newest.body.trim() === "")

  return (
    <section
      aria-busy={replying || historyBusy}
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

              {messages.map((message, index) => {
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
                const body = message.body.trim()
                // A failed turn is resent from the message it failed on: the
                // musician's own text, or the one the Scout could not answer.
                const retryBody =
                  message.status !== "failed"
                    ? undefined
                    : isUser
                      ? body || undefined
                      : messages.slice(0, index).filter((row) => row.author === "user").at(-1)?.body

                return (
                  <React.Fragment key={message.id}>
                    {runningToolParts(message).map((part) => (
                      <MessageScrollerItem key={part.toolCallId} messageId={`${message.id}-${part.toolCallId}`}>
                        <Marker role="status" aria-label={labels.scout}>
                          <MarkerContent>{labels.tools[toolName(part.type)] ?? labels.toolDefault}</MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    ))}

                    {body ? (
                      <MessageScrollerItem messageId={message.id} scrollAnchor={isUser}>
                        <Message align={isUser ? "end" : "start"} role="group" aria-label={speaker}>
                          <MessageContent>
                            <MessageHeader aria-hidden="true">{speaker}</MessageHeader>
                            <Bubble align={isUser ? "end" : "start"}>
                              <BubbleContent>
                                {isUser
                                  ? <MarkdownMessage body={message.body} />
                                  : <ScoutText body={message.body} streaming={message.status === "streaming"} />}
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    ) : null}

                    {message.status === "failed" ? (
                      <MessageScrollerItem messageId={`${message.id}-failed`}>
                        <Marker role="status" aria-label={labels.failed} className="text-rs-red-text">
                          <MarkerContent className="flex items-center gap-[var(--space-3)]">
                            {labels.failed}
                            {retryBody ? (
                              <Button type="button" variant="link" size="2xs" onClick={() => void submit(retryBody)}>
                                {labels.retry}
                              </Button>
                            ) : null}
                          </MarkerContent>
                        </Marker>
                      </MessageScrollerItem>
                    ) : null}
                  </React.Fragment>
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
                  <DecisionCard decision={decision} offerHash={decisionOfferHash} onAnswer={answerDecision} busy={replying} />
                </MessageScrollerItem>
              ) : null}

              {thinking && (
                <MessageScrollerItem messageId="scout-thinking">
                  <ThinkingMarker label={labels.thinking} verbs={labels.thinkingVerbs} />
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
        busy={replying}
        error={error || localError}
        onVoice={onVoice}
        autoFocus={autoFocus}
      />
    </section>
  )
}

export { ScoutChat }
export type {
  ScoutChatAuthor,
  ScoutChatLabels,
  ScoutChatMessage,
  ScoutChatMessagePart,
  ScoutChatMessageStatus,
  ScoutChatProps,
}
