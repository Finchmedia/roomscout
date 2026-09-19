import { Button } from "@/components/ui/button";
import { Overline } from "@/components/ui/overline";
import { useId } from "react";

export interface IndexedCandidatePanelCopy {
  room: string;
  fit: string;
  nearBudget: string;
  reasons: string;
  uncertainties: string;
  adjustBudget: string;
  contact: string;
  openConversation: string;
  retry: string;
  actionQueued: string;
  actionUnavailable: string;
}

export interface IndexedCandidatePanelCandidate {
  kind: "room" | "fit" | "near_budget";
  statusLabel?: string;
  title: string;
  imageUrl?: string;
  subtitle?: string;
  summary?: string;
  priceLabel?: string;
  budgetGapLabel?: string;
  reasons: string[];
  uncertainties: string[];
  /** Factual provenance/contact boundary supplied by the screen. */
  disclosure?: string;
}

export interface IndexedCandidatePanelProps {
  candidate: IndexedCandidatePanelCandidate;
  copy: IndexedCandidatePanelCopy;
  busy?: boolean;
  canRetry?: boolean;
  onAdjustBudget?: () => void;
  onContact?: () => void;
  onOpenConversation?: () => void;
  onRetry?: () => void;
}

/** Read-only indexed candidate detail. Every mutation remains an explicit button callback. */
export function IndexedCandidatePanel({
  candidate,
  copy,
  busy = false,
  canRetry = false,
  onAdjustBudget,
  onContact,
  onOpenConversation,
  onRetry,
}: IndexedCandidatePanelProps) {
  const nearBudget = candidate.kind === "near_budget";
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="mx-auto flex w-full max-w-[var(--width-card)] flex-col gap-[var(--space-7)] overflow-hidden rounded-card border border-rs-border-card bg-rs-surface-card p-[var(--space-8)] text-left">
      {candidate.imageUrl ? (
        <img
          alt={candidate.title}
          className="-mx-[var(--space-8)] -mt-[var(--space-8)] aspect-[16/9] w-[calc(100%+2*var(--space-8))] object-cover"
          decoding="async"
          loading="lazy"
          src={candidate.imageUrl}
        />
      ) : null}
      <header>
        <Overline>{candidate.statusLabel ?? (nearBudget ? copy.nearBudget : candidate.kind === "fit" ? copy.fit : copy.room)}</Overline>
        <h2 id={titleId} className="mt-[var(--space-3)] text-[length:var(--text-card-title-size)] font-light text-rs-ink">
          {candidate.title}
        </h2>
        {candidate.subtitle ? <p className="mt-[var(--space-2)] text-sm text-rs-ink-4">{candidate.subtitle}</p> : null}
        {candidate.disclosure ? <p className="mt-[var(--space-3)] inline-flex rounded-chip bg-rs-surface-subtle-2 px-3 py-1 text-[length:var(--text-caption-sm-size)] text-rs-ink-3">{candidate.disclosure}</p> : null}
      </header>

      {candidate.summary ? <p className="m-0 leading-relaxed text-rs-ink-2">{candidate.summary}</p> : null}

      {candidate.priceLabel || candidate.budgetGapLabel ? (
        <div className="rounded-control bg-rs-surface-inset px-[var(--space-5)] py-[var(--space-4)]">
          {candidate.priceLabel ? <strong className="block font-medium text-rs-ink">{candidate.priceLabel}</strong> : null}
          {candidate.budgetGapLabel ? <span className="mt-1 block text-sm text-rs-ink-3">{candidate.budgetGapLabel}</span> : null}
        </div>
      ) : null}

      {candidate.reasons.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-rs-ink">{copy.reasons}</h3>
          <ul className="mt-[var(--space-3)] list-disc space-y-2 pl-5 text-sm text-rs-ink-2">
            {candidate.reasons.map((reason, index) => <li key={`${index}:${reason}`}>{reason}</li>)}
          </ul>
        </div>
      ) : null}

      {candidate.uncertainties.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium text-rs-ink">{copy.uncertainties}</h3>
          <ul className="mt-[var(--space-3)] list-disc space-y-2 pl-5 text-sm text-rs-ink-4">
            {candidate.uncertainties.map((uncertainty, index) => <li key={`${index}:${uncertainty}`}>{uncertainty}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-[var(--space-4)]">
        {nearBudget && onAdjustBudget ? <Button type="button" onClick={onAdjustBudget} disabled={busy}>{copy.adjustBudget}</Button> : null}
        {onOpenConversation ? <Button type="button" onClick={onOpenConversation}>{copy.openConversation}</Button> : null}
        {!nearBudget && !onOpenConversation && onContact ? <Button type="button" onClick={onContact} disabled={busy}>{busy ? copy.actionQueued : copy.contact}</Button> : null}
        {canRetry && onRetry ? <Button type="button" variant="outline" onClick={onRetry} disabled={busy}>{copy.retry}</Button> : null}
      </div>
      {!nearBudget && !onContact && !onOpenConversation ? <p className="m-0 text-sm text-rs-ink-4">{copy.actionUnavailable}</p> : null}
    </section>
  );
}
