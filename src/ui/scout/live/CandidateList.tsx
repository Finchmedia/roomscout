/**
 * CandidateList — „Kandidaten“, the rail beside the live Scout stage.
 *
 * One row per running provider conversation of the current Suchauftrag: what
 * the room is called, what the Scout is waiting on, and when it last moved.
 * The rail is a summary, never a second inbox — a row opens the real thread at
 * `/app/inbox/:conversationId`, which the screen owns through `onOpen`.
 *
 * The rows reuse the sidebar's hover tint so the rail reads as navigation, not
 * as another card stack.
 */

import type * as React from "react";
import { Overline } from "@/components/ui/overline";
import { StatusDot } from "@/components/ui/status-dot";

/** A conversation as `api.conversations.listMine` returns it, narrowed to the rail. */
export interface CandidateRow {
  conversationId: string;
  /** Listing title; the screen falls back to the Anbieter when the listing is gone. */
  title: string;
  subtitle: string;
  state: "waiting" | "thinking" | "needs_attention" | "offer_ready" | "closed";
  lastActivityAt: number;
  unread: boolean;
  /** An open Entscheidung on this conversation outranks every other state. */
  hasOpenDecision: boolean;
}

export interface CandidateListCopy {
  title: string;
  empty: string;
  question: string;
  offer: string;
  reply: string;
  asked: string;
}

export interface CandidateListProps {
  candidates: CandidateRow[];
  copy: CandidateListCopy;
  /** `formatMessageStamp(locale, at, now, { short: true })`, bound by the screen. */
  formatStamp: (timestamp: number) => string;
  onOpen: (conversationId: string) => void;
  ref?: React.Ref<HTMLElement>;
}

/** What the row is waiting on. A question to the musician wins over the state. */
function stateLabel(row: CandidateRow, copy: CandidateListCopy): string {
  if (row.hasOpenDecision) return copy.question;
  if (row.state === "offer_ready") return copy.offer;
  if (row.state === "needs_attention") return copy.reply;
  return copy.asked;
}

export function CandidateList({ candidates, copy, formatStamp, onOpen, ref }: CandidateListProps) {
  return (
    <nav ref={ref} aria-label={copy.title} className="flex w-full flex-col gap-[var(--space-1)] text-left">
      <Overline className="px-[var(--space-5)] pb-[var(--space-3)]">{copy.title}</Overline>
      {candidates.length === 0 ? (
        <p className="m-0 px-[var(--space-5)] text-[length:var(--text-caption-sm-size)] leading-[1.5] text-rs-ink-6">
          {copy.empty}
        </p>
      ) : (
        candidates.map((row) => {
          const label = stateLabel(row, copy);
          const attention = row.unread || row.hasOpenDecision;
          return (
            <button
              key={row.conversationId}
              type="button"
              onClick={() => onOpen(row.conversationId)}
              className="flex w-full items-start gap-[var(--space-4)] rounded-control-lg px-[var(--space-5)] py-[var(--space-4)] text-left transition-colors duration-[var(--duration-fast)] ease-out-soft hover:bg-rs-surface-subtle-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[length:var(--text-body-size)] text-rs-ink">{row.title}</span>
                <span className="mt-[2px] block truncate text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
                  {[row.subtitle, label, formatStamp(row.lastActivityAt)].filter(Boolean).join(" · ")}
                </span>
              </span>
              {attention ? (
                <StatusDot tone="accent" size={7} aria-label={label} className="mt-[var(--space-3)] flex-none" />
              ) : null}
            </button>
          );
        })
      )}
    </nav>
  );
}
