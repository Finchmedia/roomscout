/**
 * CandidateList — „Kandidaten“, the rail beside the live Scout stage.
 *
 * One row per indexed room or provider conversation of the current search: what
 * the room is called, what the Scout is waiting on, and when it last moved.
 * Rows open room details through `onOpen`; the screen owns conversation navigation.
 *
 * The rows reuse the sidebar's hover tint so the rail reads as navigation, not
 * as another card stack.
 */

import type * as React from "react";
import { Overline } from "@/components/ui/overline";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import type { ViewingSlot } from "@/features/viewings/formatViewing";

export type CandidateProgress =
  | "checking"
  | "preparing_inquiry"
  | "assessment_failed"
  | "inquiry_sent"
  | "reply_received"
  | "reviewing_reply"
  | "needs_attention"
  | "viewing_arranged"
  | "closed";

/** A provider conversation or indexed match, narrowed to the rail. */
export interface CandidateRow {
  /** Existing conversation navigation target. Absent until a provider thread exists. */
  conversationId?: string;
  /** Stable `${savedNeedId}:${signalId}` identity from the indexed-candidate projection. */
  candidateKey?: string;
  savedNeedId?: string;
  signalId?: string;
  source?: "conversation" | "indexed";
  matchKind?: "fit" | "near_budget";
  disposition?: "active" | "above_budget" | "not_fit";
  exclusionReason?: "unavailable" | "schedule" | "requirements" | "closed" | "not_fit";
  /** Listing title; the screen falls back to the Anbieter when the listing is gone. */
  title: string;
  /** Optional public listing photo. Missing images leave no empty thumbnail. */
  imageUrl?: string;
  subtitle: string;
  state?: "waiting" | "thinking" | "needs_attention" | "offer_ready" | "closed";
  progress?: CandidateProgress;
  /** The arranged slot, Berlin wall clock; present exactly with `viewing_arranged`. */
  viewing?: ViewingSlot;
  hasProviderReply?: boolean;
  /** A translated status supplied by the screen wins over fallback mapping. */
  statusLabel?: string;
  lastActivityAt: number;
  unread: boolean;
  /** An open decision takes priority within candidates that remain in play. */
  hasOpenDecision: boolean;
  canRetryAssessment?: boolean;
  /** Factual simulation or contact boundary shown with the candidate. */
  disclosure?: string;
}

export interface CandidateListCopy {
  title: string;
  empty: string;
  question: string;
  offer: string;
  reply: string;
  asked: string;
  checking?: string;
  preparing?: string;
  failed?: string;
  reviewing?: string;
  attention?: string;
  /** Plain fallback for an arranged viewing whose slot the row does not carry. */
  viewing?: string;
  closed?: string;
  fit?: string;
  nearBudget?: string;
  groupActive?: string;
  groupAboveBudget?: string;
  groupNotFit?: string;
  unavailable?: string;
  notFit?: string;
  scheduleConflict?: string;
  requirementsConflict?: string;
  showAboveBudget: string;
}

export interface CandidateListProps {
  candidates: CandidateRow[];
  copy: CandidateListCopy;
  /** `formatMessageStamp(locale, at, now, { short: true })`, bound by the screen. */
  formatStamp: (timestamp: number) => string;
  /** `formatViewingLabel(viewing, locale)`, bound by the screen like `formatStamp`. */
  formatViewing?: (viewing: ViewingSlot) => string;
  onOpen: (targetId: string, candidate: CandidateRow) => void;
  /** Controlled so the desktop rail and its mobile sheet share one filter. */
  showAboveBudget?: boolean;
  onShowAboveBudgetChange?: (checked: boolean) => void;
  ref?: React.Ref<HTMLElement>;
}

/**
 * Show exclusion before delivery activity; active rooms prioritize the
 * musician's decision — except an arranged viewing, which is the goal state of
 * a run and outranks every other in-play label, so the row keeps saying when
 * the musician is expected at the room.
 */
function stateLabel(
  row: CandidateRow,
  copy: CandidateListCopy,
  formatViewing?: (viewing: ViewingSlot) => string,
): string {
  switch (row.exclusionReason) {
    case "unavailable": return copy.unavailable ?? copy.notFit ?? copy.closed ?? copy.asked;
    case "schedule": return copy.scheduleConflict ?? copy.notFit ?? copy.closed ?? copy.asked;
    case "requirements": return copy.requirementsConflict ?? copy.notFit ?? copy.closed ?? copy.asked;
    case "closed": return copy.closed ?? copy.notFit ?? copy.asked;
    case "not_fit": return copy.notFit ?? copy.closed ?? copy.asked;
  }
  if (row.disposition === "not_fit") return copy.notFit ?? copy.closed ?? copy.asked;
  // A conversation that was closed afterwards keeps its viewing row in the
  // database, but the rail must not present a room that is out of the running
  // as an appointment. Über Budget is still in play, so the slot outranks it —
  // the room card says the same, and the budget group header stays the warning.
  if ((row.viewing || row.progress === "viewing_arranged") && row.progress !== "closed" && row.state !== "closed") {
    const slot = row.viewing && formatViewing ? formatViewing(row.viewing) : undefined;
    return slot ?? copy.viewing ?? copy.offer;
  }
  if (row.disposition === "above_budget") return copy.nearBudget ?? copy.fit ?? copy.asked;
  if (row.hasOpenDecision) return copy.question;
  if (row.state === "offer_ready") return copy.offer;
  if (row.statusLabel) return row.statusLabel;
  if (row.source === "indexed" || row.matchKind) return row.matchKind === "near_budget" ? (copy.nearBudget ?? copy.fit ?? copy.asked) : (copy.fit ?? copy.asked);
  switch (row.progress) {
    case "checking": return copy.checking ?? copy.asked;
    case "preparing_inquiry": return copy.preparing ?? copy.asked;
    case "assessment_failed": return copy.failed ?? copy.attention ?? copy.asked;
    case "inquiry_sent": return copy.asked;
    case "reply_received": return copy.reply;
    case "reviewing_reply": return copy.reviewing ?? copy.reply;
    case "needs_attention": return copy.attention ?? copy.asked;
    case "closed": return copy.closed ?? copy.asked;
  }
  if (row.state === "needs_attention") return row.hasProviderReply ? copy.reply : (copy.attention ?? copy.asked);
  if (row.state === "closed") return copy.closed ?? copy.asked;
  return copy.checking ?? copy.attention ?? copy.asked;
}

type CandidateGroup = "active" | "above_budget" | "not_fit";

function candidateGroup(row: CandidateRow): CandidateGroup {
  if (row.disposition === "not_fit" || row.exclusionReason || row.state === "closed" || row.progress === "closed") return "not_fit";
  if (row.disposition === "above_budget" || row.matchKind === "near_budget") return "above_budget";
  return "active";
}

export function CandidateList({
  candidates,
  copy,
  formatStamp,
  formatViewing,
  onOpen,
  showAboveBudget = true,
  onShowAboveBudgetChange,
  ref,
}: CandidateListProps) {
  const hasToggleableAboveBudget = candidates.some(row =>
    candidateGroup(row) === "above_budget" && !row.conversationId && !row.hasOpenDecision,
  );
  const visibleCandidates = showAboveBudget
    ? candidates
    : candidates.filter(row =>
      candidateGroup(row) !== "above_budget" || Boolean(row.conversationId) || row.hasOpenDecision,
    );
  const groups: Array<{ key: CandidateGroup; label?: string; rows: CandidateRow[] }> = [
    { key: "active", label: copy.groupActive, rows: [] },
    { key: "above_budget", label: copy.groupAboveBudget, rows: [] },
    { key: "not_fit", label: copy.groupNotFit, rows: [] },
  ];
  for (const row of visibleCandidates) groups.find(group => group.key === candidateGroup(row))?.rows.push(row);

  const renderRow = (row: CandidateRow) => {
    const label = stateLabel(row, copy, formatViewing);
    const group = candidateGroup(row);
    const attention = group !== "not_fit" && (row.unread || row.hasOpenDecision || row.canRetryAssessment === true || row.progress === "needs_attention");
    const key = row.candidateKey ?? (row.savedNeedId && row.signalId ? `${row.savedNeedId}:${row.signalId}` : row.conversationId);
    if (!key) return null;
    return (
      <button key={key} type="button" onClick={() => onOpen(row.conversationId ?? key, row)} className="flex w-full items-start gap-[var(--space-3)] rounded-control-lg px-[var(--space-3)] py-[var(--space-3)] text-left transition-colors duration-[var(--duration-fast)] ease-out-soft hover:bg-rs-surface-subtle-2">
        {row.imageUrl ? <img alt={row.title} className="h-14 w-[72px] flex-none rounded-control object-cover" decoding="async" loading="lazy" src={row.imageUrl} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[length:var(--text-body-size)] text-rs-ink">{row.title}</span>
          <span className="mt-[2px] block truncate text-[length:var(--text-caption-sm-size)] text-rs-ink-6">{[row.subtitle, formatStamp(row.lastActivityAt)].filter(Boolean).join(" · ")}</span>
          <span className={group !== "active" ? `mt-2 inline-block rounded-chip bg-rs-surface-subtle-2 px-2 py-1 text-[length:var(--text-caption-sm-size)] ${group === "above_budget" ? "text-rs-orange" : "text-rs-ink-4"}` : "mt-1 block text-[length:var(--text-caption-sm-size)] text-rs-ink-4"}>{label}</span>
          {row.disclosure ? <span className="mt-2 block text-[length:var(--text-caption-sm-size)] text-rs-ink-3">{row.disclosure}</span> : null}
        </span>
        {attention ? <StatusDot tone="accent" size={7} aria-label={label} className="mt-[var(--space-3)] flex-none" /> : null}
      </button>
    );
  };

  return (
    <nav ref={ref} aria-label={copy.title} className="flex w-full flex-col gap-[var(--space-1)] text-left">
      <Overline className="px-[var(--space-3)] pb-[var(--space-3)]">{copy.title}</Overline>
      {hasToggleableAboveBudget && onShowAboveBudgetChange ? (
        <div className="mb-[var(--space-2)] flex items-center justify-between gap-[var(--space-3)] px-[var(--space-3)]">
          <span className="text-[length:var(--text-caption-sm-size)] leading-[1.35] text-rs-ink-4">{copy.showAboveBudget}</span>
          <Switch
            checked={showAboveBudget}
            label={copy.showAboveBudget}
            onCheckedChange={onShowAboveBudgetChange}
          />
        </div>
      ) : null}
      {visibleCandidates.length === 0 && candidates.length === 0 ? (
        <p className="m-0 px-[var(--space-3)] text-[length:var(--text-caption-sm-size)] leading-[1.5] text-rs-ink-6">
          {copy.empty}
        </p>
      ) : visibleCandidates.length > 0 ? (
        groups.filter(group => group.rows.length > 0).map((group, index) => (
          <section key={group.key} aria-label={group.label} className={index > 0 ? "mt-[var(--space-2)] border-t border-rs-border-divider-soft pt-[var(--space-4)]" : undefined}>
            {group.label ? <div className="flex items-center justify-between gap-[var(--space-3)] px-[var(--space-3)] pb-[var(--space-2)] text-[length:var(--text-micro-size)] font-medium tracking-[var(--text-overline-tracking)] text-rs-ink-6 uppercase"><span>{group.label}</span><span>{group.rows.length}</span></div> : null}
            {group.rows.map(renderRow)}
          </section>
        ))
      ) : null}
    </nav>
  );
}
