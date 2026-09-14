import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { Link } from "react-router-dom";
import type { api } from "../../../convex/_generated/api";
import { OfferAcceptanceFlow } from "../opportunities/OfferAcceptanceDialog";
import { Bubble, BubbleContent } from "../ui/bubble";
import { Button } from "../ui/button";
import { Capsule } from "../ui/capsule";
import { Card } from "../ui/card";
import { Overline } from "../ui/overline";
import { useCopy } from "../../ui/copy";
import { splitDecisionDetail } from "./decisionDetail";

/** One row of `api.decisions.listOpenMine` — the Entscheidung the Scout put to the musician. */
export type OpenDecision = FunctionReturnType<typeof api.decisions.listOpenMine>[number];

const MESSAGE_KINDS = new Set<OpenDecision["kind"]>([
  "review_message", "private_data", "binding_content", "unsupported_claims", "safety_unavailable",
]);
/** Kinds whose answer may also be typed into the composer below the card. */
const FREE_TEXT_KINDS = new Set<OpenDecision["kind"]>(["scout_question", ...MESSAGE_KINDS]);

export type DecisionCardProps = {
  decision: OpenDecision;
  /** Records the choice; resolves once the server accepted it. */
  onAnswer: (choice: string, label: string) => Promise<void> | void;
  /** `offer_ready`: the current content hash of `refs.offerId`, needed to open the review. */
  offerHash?: string;
  busy?: boolean;
};

/**
 * One open Entscheidung, rendered as the last item of the Scout chat: the
 * question, what the Scout would send, and the answers the musician can give.
 * Answers go to `api.decisions.answer`; free text goes through the composer.
 */
export function DecisionCard({ decision, onAnswer, offerHash, busy = false }: DecisionCardProps) {
  const { t } = useCopy();
  const [answered, setAnswered] = useState<string>();
  const [pending, setPending] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
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

  async function answer(option: { id: string; label: string }) {
    if (disabled) return;
    const label = optionLabel(option);
    setPending(option.id);
    try {
      await onAnswer(option.id, label);
      setAnswered(option.id);
    } catch {
      // The host reports the failure next to its composer; the options stay usable.
    } finally {
      setPending(undefined);
    }
  }

  const canReviewOffer = decision.kind === "offer_ready" && Boolean(decision.refs.offerId && offerHash);
  const showAck = answered !== undefined && !(messageKind && answered === "no");

  return <Card size="md" tone="accent" role="group" aria-label={t("liveScout.decisionEyebrow")} className="w-full text-left">
    <Overline tone="accent" tracking="default">{t("liveScout.decisionEyebrow")}</Overline>
    <p className="mt-[var(--space-5)] text-[length:var(--text-body-lg-size)] leading-[1.35] font-light tracking-[-.01em] [text-wrap:balance]">
      {decision.question}
    </p>

    {scopes.length > 0 ? <div className="mt-[var(--space-6)]">
      <div className="text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveScout.decisionScopes")}</div>
      <ul aria-label={t("liveScout.decisionScopes")} className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-3)]">
        {scopes.map((scope) => <li key={scope}><Capsule size="sm">{scope}</Capsule></li>)}
      </ul>
    </div> : null}

    {message ? <div className="mt-[var(--space-6)]">
      {messageKind ? <div className="mb-[var(--space-3)] text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveScout.decisionMessage")}</div> : null}
      <Bubble align="start" className="max-w-full">
        <BubbleContent><blockquote className="m-0">{message}</blockquote></BubbleContent>
      </Bubble>
    </div> : null}

    {decision.kind === "human_step" ? <div className="mt-[var(--space-8)]">
      {decision.refs.runId
        ? <Button asChild variant="tint" size="sm"><Link to={`/app/runs/${decision.refs.runId}`}>{t("liveScout.decisionOpenRun")}</Link></Button>
        : <Button asChild variant="tint" size="sm"><Link to="/app/settings/sources">{t("liveScout.decisionReconnect")}</Link></Button>}
    </div> : null}

    {showAck ? <p role="status" className="mt-[var(--space-8)] text-[length:var(--text-body-sm-size)] text-rs-ink-3">{t("liveScout.decisionAnswered")}</p> : null}

    {decision.kind !== "human_step" && answered === undefined ? <>
      <div className="mt-[var(--space-8)] flex flex-wrap gap-[var(--space-4)]">
        {decision.options.map((option, index) => {
          if (decision.kind === "offer_ready" && option.id === "review") {
            return canReviewOffer
              ? <Button key={option.id} variant="tint" size="sm" disabled={disabled} onClick={() => setReviewing(true)}>{optionLabel(option)}</Button>
              : <Button key={option.id} asChild variant="tint" size="sm"><Link to="/app/inbox">{t("liveScout.viewMessages")}</Link></Button>;
          }
          const primary = index === 0 && option.id !== "no";
          return <Button key={option.id} variant={primary ? "tint" : "secondary"} size="sm" disabled={disabled} aria-busy={pending === option.id} onClick={() => void answer(option)}>
            {optionLabel(option)}
          </Button>;
        })}
      </div>
      {FREE_TEXT_KINDS.has(decision.kind) ? <p className="mt-[var(--space-5)] text-[length:var(--text-caption-size)] text-rs-ink-6">{t("liveScout.decisionTypeHint")}</p> : null}
    </> : null}

    {reviewing && decision.refs.offerId && offerHash
      ? <OfferAcceptanceFlow expectedOfferHash={offerHash} offerId={decision.refs.offerId} onOpenChange={setReviewing} />
      : null}
  </Card>;
}
