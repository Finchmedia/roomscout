import * as React from "react";
import type { FunctionReturnType } from "convex/server";
import { Link } from "react-router-dom";
import type { api } from "../../../convex/_generated/api";
import { DecisionCard, type OpenDecision } from "../../components/scout/DecisionCard";
import { LiveProviderOffer } from "../../components/opportunities/LiveProviderOffer";
import { Bubble, BubbleContent } from "../../components/ui/bubble";
import { Button } from "../../components/ui/button";
import { Marker, MarkerContent } from "../../components/ui/marker";
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
  /** Answers an Entscheidung rendered inside this thread. */
  onAnswerDecision: (decisionId: OpenDecision["_id"], choice: string) => Promise<void>;
  /**
   * The same conversation as `api.providerConversations.listMine` sees it —
   * the only shape `LiveProviderOffer` reads. Omitted while it is loading.
   */
  offerConversation?: OfferConversation | null;
  /** Listing title for the offer card's headline. */
  offerTitle?: string;
  /** German reason the last reply did not go through. */
  error?: React.ReactNode;
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
}: ConversationThreadProps) {
  const { t, locale } = useCopy();
  const [busy, setBusy] = React.useState(false);

  const stamp = (at: number) => formatMessageStamp(locale, at, now);
  const channelLabel = t(
    header.channel === "platform" ? "liveInbox.channelPortal"
      : header.channel === "mail" ? "liveInbox.channelMail"
        : "liveInbox.channelNone",
  );
  const title = header.title || header.providerLabel || t("liveInbox.provider");
  const subtitle = header.subtitle
    ? t("liveInbox.subtitle", { city: header.subtitle, label: channelLabel })
    : t("liveInbox.subtitleChannelOnly", { label: channelLabel });

  const composerHint = header.composer.enabled ? undefined : t(
    header.composer.reason === "closed" ? "liveInbox.hintClosed"
      : header.composer.reason === "thinking" ? "liveInbox.hintThinking"
        : header.composer.reason === "assessment_required" ? "liveInbox.hintAssessmentRequired"
          : "liveInbox.hintChannelNotReady",
  );

  // An open Entscheidung is answered right here, so the waiting bubble does not
  // also send the musician to the Scout chat for the same question.
  const hasOpenDecision = items.some(
    (item) => item.kind === "decision" && item.decision.status === "open",
  );

  function pendingFooter(item: Extract<ThreadItem, { kind: "pending_message" }>) {
    if (SENDING_STATUS.has(item.status)) return t("liveInbox.pendingSending");
    if (item.status === "awaiting_approval") return t("liveInbox.pendingApproval");
    if (item.status === "blocked") return item.gateText ?? t("liveInbox.pendingBlocked");
    if (item.status === "failed") return t("liveInbox.pendingFailed");
    return t("liveInbox.pendingDrafted");
  }

  function renderItem(item: ThreadItem) {
    switch (item.kind) {
      case "provider_message": {
        const speaker = item.label || header.providerLabel || t("liveInbox.provider");
        return <Message align="start" role="group" aria-label={speaker}>
          <MessageContent>
            <MessageHeader>{speaker}</MessageHeader>
            <Bubble align="start"><BubbleContent>{item.text}</BubbleContent></Bubble>
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
            <Bubble align="end"><BubbleContent>{item.text}</BubbleContent></Bubble>
            <MessageFooter>{stamp(item.at)}</MessageFooter>
          </MessageContent>
        </Message>;
      }
      case "pending_message": {
        const speaker = item.author === "musician" ? t("liveInbox.you") : t("liveInbox.scout");
        return <Message align="end" role="group" aria-label={speaker}>
          <MessageContent>
            <MessageHeader>{speaker}</MessageHeader>
            <Bubble align="end"><BubbleContent>{item.text}</BubbleContent></Bubble>
            <MessageFooter className="flex flex-wrap items-center justify-end gap-[var(--space-3)]">
              <span>{pendingFooter(item)}</span>
              {item.status === "awaiting_approval" && !hasOpenDecision ? (
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
            <Bubble align="end"><BubbleContent>{item.text}</BubbleContent></Bubble>
            <MessageFooter>{stamp(item.at)}</MessageFooter>
          </MessageContent>
        </Message>;
      case "scout_note":
        return <Marker>
          <MarkerContent className="min-w-0 flex-1">
            <details className="min-w-0 text-left">
              <summary className="cursor-pointer line-clamp-1 break-words [overflow-wrap:anywhere]">
                {t("liveInbox.scoutNote", { text: item.summary })}
              </summary>
              <p className="mt-[var(--space-3)] whitespace-pre-wrap">{item.summary}</p>
              {item.nextAction
                ? <p className="mt-[var(--space-2)]">{t("liveInbox.scoutNoteNext", { text: item.nextAction })}</p>
                : null}
              <p className="mt-[var(--space-2)]">{stamp(item.at)}</p>
            </details>
          </MarkerContent>
        </Marker>;
      case "decision":
        if (item.decision.status === "open") {
          return <DecisionCard
            decision={item.decision}
            offerHash={offerConversation?.offer?.contentHash}
            busy={busy}
            onAnswer={async (choice) => { await onAnswerDecision(item.decision._id, choice); }}
          />;
        }
        return <Marker>
          <MarkerContent>
            {t("liveInbox.decisionAnswered", {
              label: item.decision.question,
              text: answerLabel(item.decision) ?? t("liveInbox.decisionAnsweredUnknown"),
            })}
          </MarkerContent>
        </Marker>;
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
                <p className="mt-[var(--space-2)] text-[length:var(--text-caption-size)] text-rs-ink-4">{subtitle}</p>
              </div>
            </MessageScrollerItem>

            {header.offer?.ready && offerConversation ? (
              <MessageScrollerItem messageId="thread-offer">
                <LiveProviderOffer conversation={offerConversation} title={offerTitle} hideMessagesLink />
              </MessageScrollerItem>
            ) : null}

            {items.length === 0 ? (
              <p className="m-auto max-w-[32rem] py-[var(--space-17)] text-center text-[length:var(--text-body-sm-size)] text-rs-ink-6">
                {t("liveInbox.emptyThread")}
              </p>
            ) : null}

            {items.map((item) => (
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
        <MessageScrollerButton />
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
  </section>;
}

/** The option the musician picked, by its own label. */
function answerLabel(decision: ThreadDecision): string | undefined {
  const choice = decision.answer?.choice;
  if (choice === undefined) return undefined;
  const option = decision.options.find((row) => row.id === choice);
  return decision.answer?.text ?? option?.label ?? choice;
}

type ThreadDecision = Extract<ThreadItem, { kind: "decision" }>["decision"];

export type { ConversationThreadProps, ThreadHeader, ThreadItem };
