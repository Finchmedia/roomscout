import { useId, useState, type FormEvent } from "react";
import type { FunctionReturnType } from "convex/server";
import { Link } from "react-router-dom";
import type { api } from "../../../convex/_generated/api";
import { OfferAcceptanceFlow } from "../opportunities/OfferAcceptanceDialog";
import { Bubble, BubbleContent } from "../ui/bubble";
import { Button } from "../ui/button";
import { Capsule } from "../ui/capsule";
import { Card } from "../ui/card";
import { Overline } from "../ui/overline";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoices,
  QuestionnaireDescription,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "../ui/questionnaire";
import { useCopy } from "../../ui/copy";
import { splitDecisionDetail } from "./decisionDetail";

/** One row of `api.decisions.listOpenMine` — the Entscheidung the Scout put to the musician. */
export type OpenDecision = FunctionReturnType<typeof api.decisions.listOpenMine>[number];

const MESSAGE_KINDS = new Set<OpenDecision["kind"]>([
  "review_message", "private_data", "binding_content", "unsupported_claims", "safety_unavailable",
]);

/**
 * The choice `convex/decisions.ts` reserves for a typed answer: it is the only
 * one that carries `text`, and for a message kind it turns that text into an
 * instruction to the Scout (`MUSICIAN_INSTRUCTION_PREFIX`) instead of a message
 * to the Anbieter.
 */
const CUSTOM_CHOICE = "custom";

export type DecisionCardProps = {
  decision: OpenDecision;
  /**
   * Records the answer; resolves once the server accepted it.
   *
   * `text` is present only for the typed answer, where `choice` is `"custom"` —
   * the host passes both straight to `api.decisions.answer({ decisionId,
   * choice, text })`. A host that only knows the two-argument form still
   * compiles: the parameter is optional.
   */
  onAnswer: (choice: string, label: string, text?: string) => Promise<void> | void;
  /** `offer_ready`: the current content hash of `refs.offerId`, needed to open the review. */
  offerHash?: string;
  busy?: boolean;
};

/**
 * One open Entscheidung, rendered as the last item of the Scout chat and inside
 * a Nachrichten thread: the question, what the Scout would send, and the answers
 * the musician can give.
 *
 * **The Entscheidung owns its own input.** The answerable kinds are a
 * `Questionnaire` — prepared options plus one free-text field with its own
 * label and its own „Antworten“ button — so nothing typed here can be mistaken
 * for a chat message, and nothing typed into the chat composer can be mistaken
 * for an answer. That separation is the whole point: on a message kind the
 * typed answer is an *instruction to the Scout* („bitte höflicher“, „frag auch
 * nach der Kaution“), never a message forwarded to the Anbieter verbatim.
 *
 * The questionnaire allows exactly one answer per question, so typing clears a
 * picked chip and picking a chip clears the text — the field is controlled here
 * for that second half.
 *
 * `offer_ready` and `human_step` have no answer to type: the first opens the
 * acceptance review, the second hands over to the browser run or the settings.
 */
export function DecisionCard({ decision, onAnswer, offerHash, busy = false }: DecisionCardProps) {
  const { t } = useCopy();
  const [answered, setAnswered] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [choice, setChoice] = useState<string>();
  const [text, setText] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const inputId = useId();
  const { scopes, message } = splitDecisionDetail(decision);
  const messageKind = MESSAGE_KINDS.has(decision.kind);
  const disabled = busy || pending !== undefined || answered !== undefined;

  function optionLabel(option: { id: string; label: string }): string {
    if (decision.kind === "offer_ready") {
      if (option.id === "review") return t("liveScout.decisionReview");
      if (option.id === "no") return t("liveScout.decisionNotThis");
    }
    if (messageKind) {
      if (option.id === "yes") return t("liveScout.decisionYes");
      if (option.id === "no") return t("liveScout.decisionNo");
    }
    return option.label;
  }

  async function answer(answerChoice: string, label: string, answerText?: string) {
    if (disabled) return;
    setPending(answerChoice);
    try {
      await onAnswer(answerChoice, label, answerText);
      setAnswered(answerChoice);
    } catch {
      // The host reports the failure next to its composer; the answers stay usable.
    } finally {
      setPending(undefined);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typed = text.trim();
    // The typed answer wins: the questionnaire already unpicked the chip the
    // moment the musician started writing.
    if (typed) return void answer(CUSTOM_CHOICE, typed, typed);
    const option = decision.options.find((row) => row.id === choice);
    if (!option) return;
    void answer(option.id, optionLabel(option));
  }

  const canReviewOffer = decision.kind === "offer_ready" && Boolean(decision.refs.offerId && offerHash);
  const showAck = answered !== undefined && !(messageKind && answered === "no");
  // The kinds that take an answer here. `offer_ready` opens the review instead,
  // `human_step` is a hand-over with nothing to answer.
  const answerable = decision.kind !== "offer_ready" && decision.kind !== "human_step";
  const inputLabel = t(messageKind ? "liveScout.decisionChangeLabel" : "liveScout.decisionOwnLabel");

  const detail = <>
    {scopes.length > 0 ? <div>
      <div className="text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveScout.decisionScopes")}</div>
      <ul aria-label={t("liveScout.decisionScopes")} className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-3)]">
        {scopes.map((scope) => <li key={scope}><Capsule size="sm">{scope}</Capsule></li>)}
      </ul>
    </div> : null}

    {message ? <div className="flex flex-col gap-[var(--space-3)]">
      {messageKind ? <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveScout.decisionMessage")}</span> : null}
      <Bubble align="start" variant="secondary" className="max-w-full">
        <BubbleContent><blockquote className="m-0">{message}</blockquote></BubbleContent>
      </Bubble>
    </div> : null}
  </>;

  return <Card size="md" tone="accent" role="group" aria-label={t("liveScout.decisionEyebrow")} className="w-full text-left">
    <Overline tone="accent" tracking="default">{t("liveScout.decisionEyebrow")}</Overline>

    {answerable && answered === undefined ? (
      <Questionnaire className="mt-[var(--space-5)] gap-[var(--space-6)]" shortcuts="letters" onSubmit={submit}>
        <QuestionnaireItem name={decision._id} required>
          <QuestionnaireTitle>{decision.kind === "offer_ready" ? t("liveScout.decisionOfferQuestion") : decision.question}</QuestionnaireTitle>
          <QuestionnaireDescription render={<div />} className="flex flex-col gap-[var(--space-6)] empty:hidden">
            {detail}
          </QuestionnaireDescription>

          {decision.options.length > 0 ? <QuestionnaireChoices>
            {decision.options.map((option) => (
              <QuestionnaireChoice
                key={option.id}
                value={option.id}
                onChange={(event) => {
                  if (!event.target.checked) return;
                  setChoice(option.id);
                  // One answer per question: picking a chip drops the text the
                  // questionnaire has already unselected.
                  setText("");
                }}
              >
                {optionLabel(option)}
              </QuestionnaireChoice>
            ))}
          </QuestionnaireChoices> : null}

          <div className="flex flex-col gap-[var(--space-3)]">
            <label htmlFor={inputId} className="text-[length:var(--text-caption-size)] text-rs-ink-4">{inputLabel}</label>
            <QuestionnaireInput
              id={inputId}
              value={text}
              placeholder={inputLabel}
              onChange={(event) => setText(event.target.value)}
            />
            {messageKind ? <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveScout.decisionInstructionHint")}</span> : null}
          </div>

          <QuestionnaireError>{t("liveScout.decisionRequired")}</QuestionnaireError>

          <QuestionnaireActions>
            <QuestionnaireSubmit disabled={disabled} aria-busy={pending !== undefined}>
              {t("liveScout.decisionSubmit")}
            </QuestionnaireSubmit>
          </QuestionnaireActions>
        </QuestionnaireItem>
      </Questionnaire>
    ) : <>
      <p className="mt-[var(--space-5)] text-[length:var(--text-body-lg-size)] leading-[1.35] font-light tracking-[-.01em] [text-wrap:balance]">
        {decision.kind === "offer_ready" ? t("liveScout.decisionOfferQuestion") : decision.question}
      </p>
      <div className="mt-[var(--space-6)] flex flex-col gap-[var(--space-6)] empty:hidden">{detail}</div>
    </>}

    {decision.kind === "human_step" ? <div className="mt-[var(--space-8)]">
      {decision.refs.runId
        ? <Button asChild variant="tint" size="sm"><Link to={`/app/runs/${decision.refs.runId}`}>{t("liveScout.decisionOpenRun")}</Link></Button>
        : <Button asChild variant="tint" size="sm"><Link to="/app/settings/sources">{t("liveScout.decisionReconnect")}</Link></Button>}
    </div> : null}

    {decision.kind === "offer_ready" && answered === undefined ? <div className="mt-[var(--space-8)] flex flex-wrap gap-[var(--space-4)]">
      {decision.options.map((option) => {
        if (option.id === "review") {
          return canReviewOffer
            ? <Button key={option.id} variant="tint" size="sm" disabled={disabled} onClick={() => setReviewing(true)}>{optionLabel(option)}</Button>
            : <Button key={option.id} asChild variant="tint" size="sm"><Link to="/app/inbox">{t("liveScout.viewMessages")}</Link></Button>;
        }
        return <Button key={option.id} variant="secondary" size="sm" disabled={disabled} aria-busy={pending === option.id} onClick={() => void answer(option.id, optionLabel(option))}>
          {optionLabel(option)}
        </Button>;
      })}
    </div> : null}

    {showAck ? <p role="status" className="mt-[var(--space-8)] text-[length:var(--text-body-sm-size)] text-rs-ink-3">{t("liveScout.decisionAnswered")}</p> : null}

    {reviewing && decision.refs.offerId && offerHash
      ? <OfferAcceptanceFlow expectedOfferHash={offerHash} offerId={decision.refs.offerId} onOpenChange={setReviewing} />
      : null}
  </Card>;
}
