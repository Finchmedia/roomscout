import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
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
 * Two colour literals in `Notice.jsx` have no token in `src/styles/tokens.css`:
 *  · `rgba(255,255,255,.03)` (success/neutral fill). `TOKENS.md` §B5 keeps this
 *    as its own step — `surface-1`, „quietest inner card", 12 uses — *next to*
 *    `surface-2` = `.04` („default quiet panel"), and does **not** fold the two;
 *    `COMPONENT_MAP.md` §D6 confirms `.03` for the calm-notice instance itself.
 *    The token layer simply never shipped the `.03` step, so this file does what
 *    `status-dot.tsx` does for `--rs-dot-idle` / `--rs-dot-past`: it renders the
 *    DS value through a *forward* reference,
 *    `var(--rs-surface-subtle-1, color-mix(in srgb, var(--rs-white) 3%, transparent))`.
 *    The DS alpha is correct today (the fallback is `.03` exactly, expressed on
 *    `--rs-white`, not as a raw rgba literal) and the atom adopts the real token
 *    the moment `--rs-surface-subtle-1` lands in `tokens.css`. Deliberate
 *    consequence: the calm Notice is now one step quieter than
 *    `avatar.tsx` / `radio-card.tsx` / `dialog.tsx`, which sit on
 *    `--rs-surface-subtle` (`.04`) — that is the DS reading, not a drift.
 *    Naming caveat for whoever adds the token: `tokens.css` ships
 *    `--rs-surface-subtle` = `.04` and `--rs-surface-subtle-2` = `.06`, i.e. its
 *    suffixes are off by one against §B5's `surface-1/2/3`; the name used here
 *    follows §B5's ladder position, not the shipped suffix.
 *  · `rgba(255,140,90,.22)` (accent hairline) → `--rs-border-accent-soft`
 *    (`.35`). Per `TOKENS.md` §F10 the `.22` and `.30` accent alphas „read
 *    identical to `.35`", whose canonical answer is „**`.35` default accent**".
 *    `--rs-border-accent-faint` (`.30`) *is* numerically nearer to `.22`, but it
 *    is not the right target: `card.tsx` maps this **same literal** — the DS
 *    `rust` card, `Card.jsx:10` — onto `--rs-border-accent-soft`, and reserves
 *    `-faint` for its `accent` tone because `Card.jsx:10` names *that token*
 *    there rather than a literal. The fold applies to literals only. Moving this
 *    file to `-faint` alone would split the one hairline the two files share
 *    (`COMPONENT_MAP.md` §D6 „Lock reassurance (accent)": `border:1px solid
 *    rgba(255,140,90,.22)`, the card that sits next to the consent bar). If the
 *    project decides `.22 → -faint` instead, it has to change `card.tsx`'s
 *    `rust` tone in the same commit — see the open question in the port log.
 *
 * **Accessibility.**
 *  · `role="status"` (with the paired explicit `aria-live="polite"` older AT
 *    combinations still want) is the default, matching the sibling feedback bar
 *    `hint.tsx` / `Hint.jsx:5` and the `role="status"` that two of
 *    `COMPONENT_MAP.md` §D6's own prototype instances carry (Undo bar, Saved /
 *    resolved status). `Notice.jsx` renders a bare `div`, but the real usage is
 *    dynamic — `ui_kits/roomscout-app/ScreensB.jsx:111` mounts the stale-offer
 *    bar as `{offerStale && <Ntc …>}` after a user edit, `Settings.jsx:55`
 *    mounts the „keine nutzbare Quelle" bar the same way — and an unannounced
 *    conditional bar is the whole failure mode. For *static* page copy pass
 *    `role={undefined}`, which drops the paired `aria-live` too; for a genuinely
 *    interrupting message pass `role="alert"`. Tone does **not** pick the role:
 *    the DS's amber copy („Nach deiner Änderung muss das Angebot erneut geprüft
 *    werden.") is informational, and `alert` is assertive.
 *  · The dot is `aria-hidden`, so tone is a purely visual reinforcement. That is
 *    acceptable while the sentence itself carries the severity (it does in every
 *    DS string), but a call site whose copy is severity-neutral can pass
 *    `toneLabel` to prefix a visually hidden word — „Achtung:" / „Hinweis:".
 *    No default is shipped: the DS ships no such copy, and inventing German for
 *    every notice is a content decision, not a port decision.
 *  · When `action` is a React element that does not already set
 *    `aria-describedby`, it is cloned with one pointing at the text span, so a
 *    screen-reader user who tabs straight to „Angaben ansehen"
 *    (`notice.card.html`) still hears the sentence that motivates it. A string
 *    or fragment `action` cannot be wired this way — pass an element, or set
 *    `aria-describedby` yourself. Note the flip side of `role="status"`: the
 *    action sits inside the live region, so its label is announced with the
 *    notice on mount.
 *
 * Known port-wide deviation (not fixed here): `Notice.jsx:12` sets no
 * `line-height`, so the DS preview inherits `normal` (~1.2 → ~37px bar), while
 * the app inherits Tailwind Preflight's `html{line-height:1.5}` (~41px bar) at
 * the identical padding. Every text atom in this folder shifts the same way, so
 * pinning `leading-*` here alone would desync this bar from `hint.tsx` and the
 * rest; the fix is one body line-height decision in `src/styles/app.css`.
 */

/** Root skin per tone — `Notice.jsx`'s `t.bg` / `t.border`. */
const NOTICE_TONE_CLASS = {
  /** Amber — anything that needs attention (the default). */
  warning: "border-rs-border-amber bg-rs-surface-amber-tint",
  /** Quietest surface, green dot — "nothing to do here". */
  success:
    "border-rs-border-card-soft bg-[color:var(--rs-surface-subtle-1,color-mix(in_srgb,var(--rs-white)_3%,transparent))]",
  /** Same surface as `success`, muted dot — plain information. */
  neutral:
    "border-rs-border-card-soft bg-[color:var(--rs-surface-subtle-1,color-mix(in_srgb,var(--rs-white)_3%,transparent))]",
  /** Rust wash, orange dot — consent / brand-critical statements. */
  accent: "border-rs-border-accent-soft bg-rs-rust-faint",
} as const

const noticeVariants = cva(
  [
    "flex flex-wrap items-center",
    "gap-[var(--space-4)] px-[var(--space-7)] py-[var(--space-4)]",
    "rounded-control-lg border",
    "font-sans text-[length:var(--text-caption-size)] text-rs-ink",
  ].join(" "),
  {
    variants: {
      tone: NOTICE_TONE_CLASS,
    },
    defaultVariants: {
      tone: "warning",
    },
  }
)

/** The single source of the tone vocabulary; `NoticeProps.tone` derives from it. */
type NoticeTone = NonNullable<VariantProps<typeof noticeVariants>["tone"]>

/**
 * Dot fill per tone — `Notice.jsx`'s `t.dot`. Typed `Record<NoticeTone, string>`
 * so a tone added to the root skin without a dot colour (or vice versa) fails to
 * compile instead of rendering a bar with a stale dot.
 *
 * **Tone vocabulary collision, straight out of the DS:** `neutral` here is
 * `--rs-ink-6` (`Notice.jsx:8`), while `StatusDot`'s `neutral` is `--rs-ink-2`
 * and its *`muted`* is `--rs-ink-6` (`StatusDot.jsx`'s `C` map). `warning`,
 * `success` and `accent` do agree. Do not assume the two vocabularies are
 * interchangeable when moving a call site between the atoms.
 */
const NOTICE_DOT_CLASS: Record<NoticeTone, string> = {
  warning: "bg-rs-amber",
  success: "bg-rs-green",
  neutral: "bg-rs-ink-6",
  accent: "bg-rs-orange",
}

/**
 * The mark itself, exported alongside `noticeVariants` so a screen that puts the
 * bar's skin on an element it already renders gets the matching dot instead of
 * re-deriving four colours by hand (`status-dot.tsx` exports
 * `statusDotVariants` for the same reason).
 *
 * Sizing goes through `--rs-dot-size` with the DS 8px (`--space-3`) default —
 * the exact contract `statusDotVariants` uses — so the two 8px dots can be
 * re-tuned from one place. `TOKENS.md` §F16 keeps five deliberate dot sizes, so
 * do not "canonicalise" them; override per element, e.g.
 * `cn(noticeDotVariants({ tone: "success" }), "[--rs-dot-size:var(--space-2)]")`.
 */
const noticeDotVariants = cva(
  "block size-[var(--rs-dot-size,var(--space-3))] flex-none rounded-circle",
  {
    variants: {
      tone: NOTICE_DOT_CLASS,
    },
    defaultVariants: {
      tone: "warning",
    },
  }
)

interface NoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  /** amber attention bar (default), green "all clear", muted info, or orange consent. */
  tone?: NoticeTone
  /** Inline action node (usually a link Button). */
  action?: React.ReactNode
  /**
   * Visually hidden word in front of the sentence, for copy that does not carry
   * its own severity („Achtung:" / „Hinweis:"). Off by default — the DS ships no
   * such string.
   */
  toneLabel?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
}

function Notice({
  className,
  tone = "warning",
  action,
  toneLabel,
  children,
  role = "status",
  "aria-live": ariaLive,
  ...props
}: NoticeProps) {
  const textId = React.useId()

  // Tie the inline action to the sentence it acts on. Only an element can be
  // wired, and an explicit `aria-describedby` on the action always wins.
  const describedAction =
    React.isValidElement<{ "aria-describedby"?: string }>(action) &&
    action.props["aria-describedby"] === undefined
      ? React.cloneElement(action, { "aria-describedby": textId })
      : action

  return (
    <div
      data-slot="notice"
      data-tone={tone}
      role={role}
      // `role="status"` implies it, but the paired form is the defensive belt;
      // an explicit `aria-live` wins, and dropping the role drops it as well.
      aria-live={ariaLive ?? (role === "status" ? "polite" : undefined)}
      className={cn(noticeVariants({ tone }), className)}
      {...props}
    >
      <span
        data-slot="notice-dot"
        aria-hidden="true"
        className={noticeDotVariants({ tone })}
      />
      <span data-slot="notice-text" id={textId} className="min-w-0 flex-1">
        {toneLabel ? (
          <span className="sr-only">
            {toneLabel}
            {" "}
          </span>
        ) : null}
        {children}
      </span>
      {describedAction}
    </div>
  )
}

// `noticeVariants` and `noticeDotVariants` are part of the shadcn public API (a
// screen can put the notice bar's skin — and its dot — on elements it already
// renders: a <p role="status">, a form error line — instead of rendering a
// <Notice>); the cva() calls are not plain constants, so the react-refresh rule
// cannot see them as such.
// eslint-disable-next-line react-refresh/only-export-components
export { Notice, noticeVariants, noticeDotVariants }
export type { NoticeProps, NoticeTone }
