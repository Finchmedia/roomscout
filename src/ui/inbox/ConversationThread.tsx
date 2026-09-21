import * as React from "react";
import type { FunctionReturnType } from "convex/server";
import { ArrowDownIcon, ChevronDownIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { api } from "../../../convex/_generated/api";
import { DecisionCard, type OpenDecision } from "../../components/scout/DecisionCard";
import { LiveProviderOffer } from "../../components/opportunities/LiveProviderOffer";
import { OfferAcceptanceFlow } from "../../components/opportunities/OfferAcceptanceDialog";
import { Bubble, BubbleContent } from "../../components/ui/bubble";
import { Button } from "../../components/ui/button";
import { Message, MessageContent, MessageFooter, MessageHeader } from "../../components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "../../components/ui/message-scroller";
import { ChatComposer } from "../chat/ChatComposer";
import { useCopy } from "../copy";
import { formatMessageStamp } from "../copy/format";
import { formatViewingLabel } from "../../features/viewings/formatViewing";

type ThreadPayload = NonNullable<FunctionReturnType<typeof api.conversations.getMine>>;
type ThreadHeader = ThreadPayload["header"];
type ThreadItem = ThreadPayload["items"][number];
type OfferConversation = FunctionReturnType<typeof api.providerConversations.listMine>[number];

/** Requests that are still on their way out; anything else is a standing state. */
const SENDING_STATUS = new Set(["queued", "approved", "executing"]);

interface ConversationThreadProps {
  header: ThreadHeader;
  items: ThreadItem[];
  /** Reference moment for every stamp — passed in, never read from the clock here. */
  now: number;
  /** Stages the musician's own reply; resolves `true` when the server took it. */
  onSend: (body: string) => Promise<boolean>;
  /**
   * Answers an Entscheidung rendered inside this thread. `text` is the
   * musician's own wording and arrives with `choice === "custom"`; on a message
   * kind the Scout reads it as an instruction, not as a message to forward.
   */
  onAnswerDecision: (decisionId: OpenDecision["_id"], choice: string, text?: string, questionId?: string) => Promise<void>;
  /**
   * The same conversation as `api.providerConversations.listMine` sees it —
   * the only shape `LiveProviderOffer` reads. Omitted while it is loading.
   */
  offerConversation?: OfferConversation | null;
  /** Listing title for the offer card's headline. */
  offerTitle?: string;
  /** German reason the last reply did not go through. */
  error?: React.ReactNode;
  onRetryAssessment?: () => Promise<void>;
}

/**
 * One Anbieter conversation, as the musician sees it: what the Anbieter wrote
 * (left), what the Scout sent on their behalf and what they dictated
 * themselves (right), the Scout's own notes as markers, an open Entscheidung
 * as a card, and a message that is still waiting for a Freigabeprüfung as a
 * bubble that says so.
 *
 * Two rules the surface must never break, both of them the reason the item
 * union carries `pending_message` at all:
 * - nothing is called „gesendet“ that is not a row in `mailMessages` /
 *   `platformMessages` — a pending request says „Wird gesendet …“, and a
 *   blocked one says the Freigabeprüfung's own sentence;
 * - the musician's text and the Scout's text never share a speaker label.
 *
 * The component owns the scroll region (the panel's content pane is handed
 * over with `p-0 overflow-hidden`), so the composer stays pinned at the bottom
 * while the transcript scrolls.
 */
export function ConversationThread({
  header,
  items,
  now,
  onSend,
  onAnswerDecision,
  offerConversation,
  offerTitle,
  error,
  onRetryAssessment,
}: ConversationThreadProps) {
  const { t, locale } = useCopy();
  const [busy, setBusy] = React.useState(false);
  const [retrying, setRetrying] = React.useState(false);
  const [retryError, setRetryError] = React.useState(false);
  // The binding Zusage is reviewed in its own dialog — terms, the exact
  // message, one confirmation — never as a detour through the Scout chat.
  const [reviewingAcceptance, setReviewingAcceptance] = React.useState(false);
  const offer = offerConversation?.offer;

  const stamp = (at: number) => formatMessageStamp(locale, at, now);
  const channelLabel = header.channel === "none" ? undefined : t(
    header.channel === "platform" ? "liveInbox.channelPortal"
      : "liveInbox.channelMail",
  );
  const title = header.title || header.providerLabel || t("liveInbox.provider");
  const subtitle = header.subtitle && channelLabel
    ? t("liveInbox.subtitle", { city: header.subtitle, label: channelLabel })
    : header.subtitle || (channelLabel ? t("liveInbox.subtitleChannelOnly", { label: channelLabel }) : undefined);

  const latestPendingItem = [...items].reverse().find(
    (item): item is Extract<ThreadItem, { kind: "pending_message" }> => item.kind === "pending_message",
  );
  const latestSentItem = [...items].reverse().find(item => item.kind === "sent_message");
  // Failed/blocked requests remain in history. Once a newer outbound receipt
  // exists, that older request must not keep controlling the composer copy.
  const latestPending = latestPendingItem && (!latestSentItem || latestPendingItem.at >= latestSentItem.at)
    ? latestPendingItem
    : undefined;
  const latestDeliveryFailed = latestSentItem && ["bounced", "rejected", "complained"].includes(latestSentItem.deliveryStatus ?? "");

  const composerHint = (() => {
    if (header.composer.enabled) return undefined;
    if (header.composer.reason === "closed") return t("liveInbox.hintClosed");
    if (latestPending?.outcomeUnknown) return t("liveInbox.hintOutcomeUnknown");
    if (latestPending?.status === "awaiting_approval") return t("liveInbox.hintAwaitingApproval");
    if (latestPending && SENDING_STATUS.has(latestPending.status)) return t("liveInbox.hintSending");
    if (latestPending?.status === "failed") return t("liveInbox.hintSendFailed");
    if (latestPending?.status === "blocked") return t("liveInbox.pendingBlocked");
    if (latestPending?.status === "drafted") return t("liveInbox.hintDrafted");
    if (latestDeliveryFailed) return t("liveInbox.hintDeliveryFailed");
    if (header.progress === "inquiry_sent" || (latestSentItem && !header.hasProviderReply)) {
      return t("liveInbox.hintAwaitingReply");
    }
    if (header.progress === "assessment_failed") return t("liveInbox.assessmentFailed");
    if (!header.hasProviderReply) {
      return t(header.progress === "checking" ? "liveInbox.emptyChecking" : "liveInbox.emptyContactNotReady");
    }
    if (header.composer.reason === "thinking") return t("liveInbox.hintThinking");
    if (header.composer.reason === "assessment_required") return t("liveInbox.hintAssessmentRequired");
    return t("liveInbox.hintChannelNotReady");
  })();

  // An open Entscheidung is answered right here, so the waiting bubble does not
  // also send the musician to the Scout chat for the same question.
  const hasOpenDecision = items.some(
    (item) => item.kind === "decision" && item.decision.status === "open",
  );
  const visibleDecisionIds = new Set(items.flatMap(item =>
    item.kind === "decision" ? [String(item.decision._id)] : [],
  ));
  const visibleItems = items.filter(item => {
    if (item.kind !== "musician_input") return true;
    const decisionId = item.decisionId;
    return !decisionId || !visibleDecisionIds.has(String(decisionId));
  });

  function pendingFooter(item: Extract<ThreadItem, { kind: "pending_message" }>) {
    if (item.outcomeUnknown) return t("liveInbox.pendingOutcomeUnknown");
    if (SENDING_STATUS.has(item.status)) return t("liveInbox.pendingSending");
    if (item.status === "awaiting_approval") return t("liveInbox.pendingApproval");
    if (item.status === "blocked") return item.gateText ?? t("liveInbox.pendingBlocked");
    if (item.status === "failed") return t("liveInbox.pendingFailed");
    return t("liveInbox.pendingDrafted");
  }

  function deliveryFooter(item: Extract<ThreadItem, { kind: "sent_message" }>) {
    if (["bounced", "rejected", "complained"].includes(item.deliveryStatus ?? "")) {
      return t("liveInbox.deliveryFailed");
    }
    if (item.deliveryStatus === "delivered") return t("liveInbox.deliveryDelivered");
    return t("liveInbox.deliverySent");
  }

  function renderItem(item: ThreadItem) {
    switch (item.kind) {
      case "provider_message": {
        const speaker = item.label || header.providerLabel || t("liveInbox.provider");
        return <Message align="start" role="group" aria-label={speaker}>
          <MessageContent>
            <MessageHeader>{speaker}</MessageHeader>
            <Bubble align="start" variant="secondary"><BubbleContent>{item.text}</BubbleContent></Bubble>
            <MessageFooter>{stamp(item.at)}</MessageFooter>
          </MessageContent>
        </Message>;
      }
      case "sent_message": {
        // `acceptance` is the Scout's wording on the musician's binding
        // approval — the words are the Scout's, so the label stays the Scout's.
        const speaker = item.author === "musician" ? t("liveInbox.you") : t("liveInbox.scout");
        return <Message align="end" role="group" aria-label={speaker}>
          <MessageContent>
            <MessageHeader>{speaker}</MessageHeader>
            <Bubble align="end" variant="tinted"><BubbleContent>{item.text}</BubbleContent></Bubble>
            <MessageFooter className="flex flex-wrap items-center justify-end gap-[var(--space-3)]">
              <span>{deliveryFooter(item)}</span>
              <span>{stamp(item.at)}</span>
            </MessageFooter>
          </MessageContent>
        </Message>;
      }
      case "pending_message": {
        const speaker = item.author === "musician" ? t("liveInbox.you") : t("liveInbox.scout");
        // A staged Zusage is not an Entscheidung with a yes/no: it is the one
        // binding step, and „Zusage prüfen“ opens the review that carries it.
        const acceptance = item.author === "acceptance" && item.status === "awaiting_approval";
        return <Message align="end" role="group" aria-label={speaker}>
          <MessageContent>
            <MessageHeader>{speaker}</MessageHeader>
            <Bubble align="end" variant="tinted"><BubbleContent>{item.text}</BubbleContent></Bubble>
            <MessageFooter className="flex flex-wrap items-center justify-end gap-[var(--space-3)]">
              <span>{acceptance ? t("liveInbox.pendingAcceptance") : pendingFooter(item)}</span>
              {acceptance && offer ? (
                <Button type="button" variant="link" size="2xs" onClick={() => setReviewingAcceptance(true)}>
                  {t("liveInbox.pendingAcceptanceAction")}
                </Button>
              ) : null}
              {!acceptance && item.status === "awaiting_approval" && !hasOpenDecision ? (
                <Button asChild variant="link" size="2xs">
                  <Link to="/app/scout">{t("liveInbox.pendingApprovalAction")}</Link>
                </Button>
              ) : null}
              <span>{stamp(item.at)}</span>
            </MessageFooter>
          </MessageContent>
        </Message>;
      }
      case "musician_input":
        return <Message align="end" role="group" aria-label={t("liveInbox.youToScout")}>
          <MessageContent>
            <MessageHeader>{t("liveInbox.youToScout")}</MessageHeader>
            <Bubble align="end" variant="tinted"><BubbleContent>{item.text}</BubbleContent></Bubble>
            <MessageFooter>{stamp(item.at)}</MessageFooter>
          </MessageContent>
        </Message>;
      case "scout_note":
        return <div className="w-full max-w-[44rem] text-left">
          <details role="group" aria-label={t("liveInbox.scoutUpdate")} className="group/scout-update min-w-0 rounded-control border border-rs-border-card bg-rs-surface-subtle-1 px-[var(--space-5)] py-[var(--space-4)]">
              <summary className="flex cursor-pointer items-center justify-between gap-[var(--space-4)] text-[length:var(--text-caption-size)] text-rs-ink-4">
                <span>{t("liveInbox.scoutUpdate")}</span>
                <span className="flex shrink-0 items-center gap-[var(--space-2)]">
                  <time dateTime={new Date(item.at).toISOString()} className="text-[length:var(--text-micro-size)] text-rs-ink-6">{stamp(item.at)}</time>
                  <ChevronDownIcon aria-hidden="true" className="size-4 transition-transform duration-[var(--duration-quick)] group-open/scout-update:rotate-180" />
                </span>
              </summary>
              <p className="mt-[var(--space-4)] max-w-[68ch] whitespace-pre-wrap break-words text-[length:var(--text-body-size)] leading-relaxed text-rs-ink-2 [overflow-wrap:anywhere]">{item.summary}</p>
            </details>
        </div>;
      case "decision":
        if (item.decision.status === "open") {
          return <DecisionCard
            decision={item.decision}
            offerHash={offer?.contentHash}
            busy={busy}
            onAnswer={async (choice, _label, text, questionId) => {
              if (questionId) await onAnswerDecision(item.decision._id, choice, text, questionId);
              else await onAnswerDecision(item.decision._id, choice, text);
            }}
          />;
        }
        if (item.decision.status !== "answered") return null;
        return <section role="group" aria-label={t("liveInbox.privateScoutQuestion")} className="w-full max-w-[44rem] rounded-card border border-rs-border-accent-soft bg-rs-surface-card px-[var(--space-6)] py-[var(--space-5)] text-left">
          <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
            <span className="text-[length:var(--text-caption-size)] font-medium text-rs-orange-light">{t("liveInbox.privateScoutQuestion")}</span>
            <span className="text-[length:var(--text-micro-size)] text-rs-ink-5">{t("liveInbox.decisionAnsweredState")}</span>
          </div>
          {answeredQuestions(item.decision, t("liveInbox.decisionAnsweredUnknown")).map((entry, index) => <div key={entry.id} className={index === 0 ? "mt-[var(--space-5)]" : "mt-[var(--space-5)] border-t border-rs-border-card pt-[var(--space-5)]"}>
            <div className="text-[length:var(--text-micro-size)] text-rs-ink-6">{t("liveInbox.scoutQuestion")}</div>
            <p className="mt-[var(--space-2)] break-words text-[length:var(--text-body-size)] leading-relaxed text-rs-ink-2 [overflow-wrap:anywhere]">{entry.question}</p>
            <div className="mt-[var(--space-4)]">
              <div className="text-[length:var(--text-micro-size)] text-rs-ink-6">{t("liveInbox.yourAnswer")}</div>
              <p className="mt-[var(--space-2)] break-words text-[length:var(--text-body-size)] leading-relaxed text-rs-ink [overflow-wrap:anywhere]">{entry.answerLabel}</p>
            </div>
            <time dateTime={new Date(entry.at).toISOString()} className="mt-[var(--space-4)] block text-[length:var(--text-micro-size)] text-rs-ink-6">{stamp(entry.at)}</time>
          </div>)}
        </section>;
    }
  }

  return <section
    aria-label={title}
    // The panel pane is handed over as `p-0 overflow-hidden flex flex-col`, so
    // the thread is the flex child that owns the remaining height: the
    // transcript scrolls and the composer stays put.
    className="flex h-full min-h-0 flex-1 flex-col"
  >
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport aria-label={t("liveInbox.messagesAria")} preserveScrollOnPrepend>
          <MessageScrollerContent className="px-[var(--space-8)] pt-[var(--space-9)] pb-[var(--space-7)] min-[900px]:px-[var(--space-13)]">
            {/* §4: the thread's own head scrolls with the transcript, so the
                panel header stays the breadcrumb and nothing is stacked twice. */}
            <MessageScrollerItem messageId="thread-header">
              <div>
                <h1 className="text-[length:var(--text-lead-size)] text-rs-ink">{title}</h1>
                {subtitle ? <p className="mt-[var(--space-2)] text-[length:var(--text-caption-size)] text-rs-ink-4">{subtitle}</p> : null}
                {/* An arranged viewing is what the run was for: the day and the
                    time the Anbieter agreed to stay at the top of the thread —
                    but a closed room is history here exactly as it is in the rail. */}
                {header.viewing && header.progress !== "closed" && header.state !== "closed" ? <p role="status" className="mt-[var(--space-3)] inline-flex rounded-chip bg-rs-surface-subtle-2 px-3 py-1 text-[length:var(--text-caption-size)] text-rs-ink-2">
                  {formatViewingLabel(header.viewing, locale)}
                </p> : null}
              </div>
            </MessageScrollerItem>

            {header.offer?.ready && offerConversation ? (
              <MessageScrollerItem messageId="thread-offer">
                <LiveProviderOffer conversation={offerConversation} title={offerTitle} now={now} hideMessagesLink />
              </MessageScrollerItem>
            ) : null}

            {items.length === 0 ? (
              <p className="m-auto max-w-[32rem] py-[var(--space-17)] text-center text-[length:var(--text-body-sm-size)] text-rs-ink-6">
                {t(header.progress === "assessment_failed" ? "liveInbox.assessmentFailed"
                  : header.progress === "preparing_inquiry" ? "liveInbox.emptyThread"
                    : header.progress === "checking" ? "liveInbox.emptyChecking"
                      : header.hasProviderReply || header.progress === "inquiry_sent" || header.progress === "closed" ? "liveInbox.emptyHistory" : "liveInbox.emptyContactNotReady")}
              </p>
            ) : null}

            {header.progress === "assessment_failed" && items.length > 0 ? <p role="status">{t("liveInbox.assessmentFailed")}</p> : null}
            {header.canRetryAssessment && onRetryAssessment ? <Button type="button" variant="outline" disabled={retrying}
              onClick={async () => {
                setRetrying(true); setRetryError(false);
                try { await onRetryAssessment(); } catch { setRetryError(true); } finally { setRetrying(false); }
              }}>{t(retrying ? "liveInbox.retrying" : "liveInbox.retryAssessment")}</Button> : null}
            {retryError ? <p role="alert">{t("liveInbox.errorGeneric")}</p> : null}

            {visibleItems.map((item) => (
              <MessageScrollerItem
                key={`${item.kind}:${item.id}`}
                messageId={`${item.kind}:${item.id}`}
                scrollAnchor={item.kind === "pending_message" || item.kind === "musician_input"}
              >
                {renderItem(item)}
              </MessageScrollerItem>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton>
          <ArrowDownIcon />
          <span className="sr-only">{t("liveInbox.scrollToEnd")}</span>
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>

    <ChatComposer
      labels={{
        composer: t("liveInbox.composerPlaceholder"),
        send: t("liveInbox.composerSend"),
        sendError: t("liveInbox.errorGeneric"),
        sending: t("liveInbox.composerSending"),
        status: t("liveInbox.composerStatus"),
        restoreDraft: t("liveInbox.composerRestore"),
        voice: t("liveInbox.composerSend"),
      }}
      onSubmit={onSend}
      disabled={!header.composer.enabled}
      disabledHint={composerHint}
      error={error}
      onBusyChange={setBusy}
    />

    {reviewingAcceptance && offer
      ? <OfferAcceptanceFlow expectedOfferHash={offer.contentHash} offerId={offer.offerId} onOpenChange={setReviewingAcceptance} />
      : null}
  </section>;
}

/** The option the musician picked, by its own label. */
function answerLabel(decision: ThreadDecision): string | undefined {
  const choice = decision.answer?.choice;
  if (choice === undefined) return undefined;
  const option = decision.options.find((row) => row.id === choice);
  return decision.answer?.text ?? option?.label ?? choice;
}

function answeredQuestions(decision: ThreadDecision & { questions?: DecisionQuestion[] }, unknownAnswer: string) {
  if (decision.questions?.length) {
    return decision.questions.flatMap((question) => question.answer ? [{
      id: question.id,
      question: question.question,
      answerLabel: question.answer.text ?? question.options.find((option) => option.id === question.answer?.choice)?.label ?? question.answer.choice,
      at: question.answer.at,
    }] : []);
  }
  return [{
    id: String(decision._id),
    question: decision.question,
    answerLabel: answerLabel(decision) ?? unknownAnswer,
    at: decision.answer?.at ?? decision.updatedAt,
  }];
}

type DecisionQuestion = NonNullable<OpenDecision["questions"]>[number];

type ThreadDecision = Extract<ThreadItem, { kind: "decision" }>["decision"];

export type { ConversationThreadProps, ThreadHeader, ThreadItem };
