import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Notice — the DS's inline status bar: a coloured dot, one line of text, and an
 * optional inline action.
 *
 * DS spec: `design-system/components/feedback/notice/Notice.jsx` (+ `.d.ts`,
 * `Notice.prompt.md`, `notice.card.html`). The prompt states the rule of the
 * atom: *„Inline status bar; amber for anything that needs attention."* — hence
 * `warning` is the default tone, not `neutral`.
 *
 * Geometry verbatim from `Notice.jsx:12–14`, every value on a token:
 *  · `padding: 10px 16px`  → `--space-4` / `--space-7`
 *  · `gap: 10px`           → `--space-4`
 *  · `border-radius: 12px` → `--radius-control-lg` (`rounded-control-lg`)
 *  · `font-size: 14px`     → `--text-caption-size`, `--font-sans`, `--rs-ink`
 *  · dot `8px` circle, `flex: none` → `--space-3` (the 8px step; per
 *    `docs/UI_PORT/TOKENS.md` §F16, 8px is the Roomscout badge/activity dot)
 *  · text cell `flex: 1; min-width: 0`, root `flex-wrap: wrap` — so a long
 *    action button drops to a second line instead of squeezing the sentence.
 *
 * The four tones (names from `Notice.d.ts`), fill / hairline / dot:
 *  · `warning` (default) — amber tint, amber hairline, `--rs-amber` dot. The
 *    stale-offer / expired-access bar: „Nach deiner Änderung muss das Angebot
 *    erneut geprüft werden."
 *  · `success` — quietest surface, soft card hairline, `--rs-green` dot:
 *    „Keine Aufgabe braucht Aufmerksamkeit."
 *  · `neutral` — same surface and hairline as `success`, `--rs-ink-6` dot.
 *  · `accent` — rust-faint wash, accent hairline, `--rs-orange` dot. The
 *    consent bar: „Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe
 *    raus."
 *
 * Two colour literals in `Notice.jsx` have no exact token in
 * `src/styles/tokens.css` and are mapped, not copied:
 *  · `rgba(255,255,255,.03)` (success/neutral fill) — `TOKENS.md` §B5 calls it
 *    `surface-1`, the quietest inner-card fill; the token layer ships only the
 *    `.04` step `surface-2`, so it renders as `--rs-surface-subtle`.
 *  · `rgba(255,140,90,.22)` (accent hairline) — per `TOKENS.md` §F10 the `.22`
 *    and `.30` accent alphas "read identical to `.35`" and fold into the
 *    default accent border → `--rs-border-accent-soft`. (Same call as
 *    `badge.tsx`, which folds `.55`/`.60` up into the `.50` step.)
 *
 * No implicit ARIA role: the DS renders a plain `div`, and a notice is as often
 * static page copy as it is a live region. A call site that announces a change
 * passes `role="status"` (or `role="alert"`) through — all `div` props forward.
 */
const noticeVariants = cva(
  [
    "flex flex-wrap items-center",
    "gap-[var(--space-4)] px-[var(--space-7)] py-[var(--space-4)]",
    "rounded-control-lg border",
    "font-sans text-[length:var(--text-caption-size)] text-rs-ink",
  ].join(" "),
  {
    variants: {
      tone: {
        /** Amber — anything that needs attention (the default). */
        warning: "border-rs-border-amber bg-rs-surface-amber-tint",
        /** Quiet surface, green dot — "nothing to do here". */
        success: "border-rs-border-card-soft bg-rs-surface-subtle",
        /** Quiet surface, muted dot — plain information. */
        neutral: "border-rs-border-card-soft bg-rs-surface-subtle",
        /** Rust wash, orange dot — consent / brand-critical statements. */
        accent: "border-rs-border-accent-soft bg-rs-rust-faint",
      },
    },
    defaultVariants: {
      tone: "warning",
    },
  }
)

/** Dot fill per tone — `Notice.jsx`'s `t.dot`. Internal: it is not a slot a
 * call site can render on its own. */
const noticeDotVariants = cva(
  "flex-none size-[var(--space-3)] rounded-circle",
  {
    variants: {
      tone: {
        warning: "bg-rs-amber",
        success: "bg-rs-green",
        neutral: "bg-rs-ink-6",
        accent: "bg-rs-orange",
      },
    },
    defaultVariants: {
      tone: "warning",
    },
  }
)

interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** amber attention bar (default), green "all clear", muted info, or orange consent. */
  tone?: "warning" | "success" | "neutral" | "accent"
  /** Inline action node (usually a link Button). */
  action?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
}

function Notice({
  className,
  tone = "warning",
  action,
  children,
  ...props
}: NoticeProps) {
  return (
    <div
      data-slot="notice"
      data-tone={tone}
      className={cn(noticeVariants({ tone }), className)}
      {...props}
    >
      <span
        data-slot="notice-dot"
        aria-hidden="true"
        className={noticeDotVariants({ tone })}
      />
      <span data-slot="notice-text" className="min-w-0 flex-1">
        {children}
      </span>
      {action}
    </div>
  )
}

// `noticeVariants` is part of the shadcn public API (a screen can put the
// notice bar's skin on an element it already renders — a <p role="status">, a
// form error line — instead of rendering a <Notice>); the cva() call is not a
// plain constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Notice, noticeVariants }
export type { NoticeProps }
