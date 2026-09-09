import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/ui/icon"

/**
 * SummaryPill — the dark translucent capsule that carries the brief in one line
 * („Stuttgart · bis 350 €“), optionally clickable to expand a panel.
 *
 * DS reference: `design-system/components/core/summary-pill/`
 * (`SummaryPill.jsx`, `SummaryPill.d.ts`, `SummaryPill.prompt.md`,
 * `summary-pill.card.html`) — the DS component is the spec for this file, and
 * its three sizes are the only geometry it ships.
 *
 * Geometry verbatim from `SummaryPill.jsx`, one row per DS size — height,
 * horizontal padding, font size, ink:
 *   `sm` 36px · 0 16px · 14.5px · `--rs-ink-2`  („5 Wünsche gemerkt“)
 *   `md` 44px · 0 16px · 14.5px · `--rs-ink-2`  („Suchauftrag“) — the default
 *   `lg` 50px · 0 20px · 16px   · `--rs-ink`    („Stuttgart · bis 350 €“)
 * Shared: `--radius-pill`, 1px `--rs-border-card-strong`, `--rs-surface-pill`
 * fill, `--font-sans`, `gap:10px`, `white-space:nowrap`.
 *
 * The element follows the DS: a `<button type="button">` when `onClick` is
 * given (cursor pointer + the hover wash), a plain `<div>` otherwise (cursor
 * default, no hover) — exactly the `const Tag = onClick ? 'button' : 'div'`
 * switch in the DS source.
 *
 * **Scope — which pills this component does *not* render.** The screen pills of
 * `docs/UI_PORT/COMPONENT_MAP.md` §D2 („Pill panel / summary pill“, file
 * `src/ui/primitives/Pill.tsx`) and §S6 („Brief pill + panel“, file
 * `src/ui/scout/brief/BriefDisclosure.tsx`, spec'd as `Collapsible` + `Button`)
 * span heights {50|46|44|42|40}, paddings {20|18|16}, type {16|15|14} and two
 * inks, plus a `color:#fff` ink hover and a chevron that points **up** on the
 * offer pill. Only the autopilot pill (50 / 0 20px / 16px / wash hover) is a
 * `size="lg"` SummaryPill. The others are deliberately *not* folded in here as
 * extra sizes or hover variants — that would put screen geometry into the DS
 * core component; they belong in their own files, which may reuse the base look
 * through `summaryPillVariants` + `className`.
 *
 * Token notes:
 *  · 36 / 44 / 50px are `--size-button-2xs` / `--size-button-xs` /
 *    `--size-button-md`; 16 / 20 / 10px are `--space-7` / `--space-9` /
 *    `--space-4`; 16px type is `--text-body-size`. Only 14.5px has no token in
 *    `src/styles/tokens.css` (`docs/UI_PORT/TOKENS.md` §F19 keeps it as the
 *    dense caption step, and §F19's line 1760 already names a `text-sm-dense`
 *    step for it) and stays literal, as in `badge.tsx` / `textarea.tsx`.
 *  · The DS hover fill is `rgba(30,22,16,.7)` — per `TOKENS.md` §A1 and
 *    `COMPONENT_MAP.md` §D2 the single non-white hover wash in the app, and the
 *    one value here with no token. It is not folded into a white hover step
 *    (that would lose the warmth the DS is deliberately after); instead it is
 *    derived from the nearest tokenised warm surface, `--rs-surface-hint`
 *    (`rgba(28,20,14,.92)`), taken to 76% alpha → `rgba(28,20,14,.6992)`. Same
 *    alpha to three places, and a 2/2/2 rgb delta that is imperceptible over the
 *    dark ground (the §F2 argument for collapsing near-identical warm values).
 *    It is an approximation on purpose: the exact value needs a token
 *    (`--rs-surface-pill-hover`) in `src/styles/tokens.css`, which this file
 *    cannot add. It ships as a plain hover background utility rather than as an
 *    arbitrary custom property, so `cn()`/tailwind-merge can resolve a caller's
 *    own hover background against it instead of leaving a dead variable behind.
 *
 * Deliberate additions over `SummaryPill.jsx`, all behavioural:
 *  · The DS swaps the hover fill through React mouse state, which repaints on
 *    every enter/leave; here it is a plain `:hover` with the DS quick duration.
 *    The transition sits on the `interactive` variant only — the static pill has
 *    nothing that changes — and lists `background-color` only.
 *  · The global DS focus ring (`TOKENS.md` §F17: 2px solid orange, 2px offset).
 *    NOTE: `src/styles/app.css:41-44` still emits an **unlayered** global
 *    `:focus-visible` rule at `outline-offset:3px`; unlayered declarations beat
 *    every cascade layer, so until that rule is layered (or corrected to §F17's
 *    2px) the pill renders a 3px offset — repo-wide, exactly as `button.tsx`
 *    and `badge.tsx` do. The utilities here state the DS intent and are what
 *    survives once app.css is fixed; they are not overridden with `!important`,
 *    which would make this one pill's ring differ from every other control.
 *  · `aria-expanded` on the clickable pill whenever `open` is passed — i.e.
 *    keyed off the disclosure relationship, not off the chevron, so a pill that
 *    toggles a panel without a caret is still announced (and a purely decorative
 *    caret makes no promise). Pair it with `aria-controls={panelId}` through
 *    `...props` when the pill drives a panel (`COMPONENT_MAP.md` §S6).
 *  · The chevron is the shared `chevron-down` glyph from `icon.tsx`, whose path
 *    (`M6 9l6 6 6-6`) and stroke width (2) match the inline SVG in
 *    `SummaryPill.jsx`; the shared glyph additionally rounds the joins
 *    (`strokeLinejoin="round"`, as `Icon.jsx:56` does for every DS glyph — the
 *    pill's inline SVG is the DS's own outlier and renders a mitred apex).
 *    `open` rotates it 180° over `--duration-base` on the CSS default `ease`,
 *    the DS's `transition:transform .3s`.
 */

/**
 * The DS chevron is `width="14" height="14"` (`SummaryPill.jsx:11`). There is no
 * icon-size token in `src/styles/tokens.css` (see `icon.tsx`), so it stays a
 * literal — annotated here so it cannot drift unnoticed.
 */
const CHEVRON_SIZE = 14

const summaryPillVariants = cva(
  [
    "inline-flex items-center whitespace-nowrap",
    "gap-[var(--space-4)] font-sans",
    "rounded-pill border border-rs-border-card-strong bg-rs-surface-pill",
    // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears —
    // without it `focus-visible:outline-2` resolves to `outline-style:none`
    // and the ring never paints (same note as button.tsx / badge.tsx).
    "outline-none focus-visible:outline-solid focus-visible:outline-2",
    "focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      size: {
        /** 36px — the quiet counter pill („5 Wünsche gemerkt“). */
        sm: "h-[var(--size-button-2xs)] px-[var(--space-7)] text-[14.5px] text-rs-ink-2",
        /** 44px — the default brief pill („Suchauftrag“). */
        md: "h-[var(--size-button-xs)] px-[var(--space-7)] text-[14.5px] text-rs-ink-2",
        /** 50px — the autopilot brief pill, body-size type on full ink. */
        lg: "h-[var(--size-button-md)] px-[var(--space-9)] text-[length:var(--text-body-size)] text-rs-ink",
      },
      interactive: {
        /** `onClick` given → button, pointer cursor, the warm hover wash. */
        true: [
          "cursor-pointer",
          "hover:bg-[color-mix(in_srgb,var(--rs-surface-hint)_76%,transparent)]",
          "transition-[background-color] duration-[var(--duration-quick)] ease-out-soft",
        ].join(" "),
        /** Static pill → a div that reads as text, not as a control. */
        false: "cursor-default",
      },
    },
    defaultVariants: {
      size: "md",
      interactive: false,
    },
  }
)

interface SummaryPillProps extends React.HTMLAttributes<HTMLElement> {
  /** Leading glyph, e.g. `<Icon name="search" size={18} />`. */
  icon?: React.ReactNode
  /** Render the trailing disclosure chevron (decorative — see `open`). */
  chevron?: boolean
  /**
   * Panel state. Passing it declares the pill a disclosure: it rotates the
   * chevron 180°, sets `data-state` and, on the clickable pill, `aria-expanded`.
   * Leave it off for a pill that opens nothing.
   */
  open?: boolean
  /**
   * 36px / 44px / 50px; `md` is the DS default. Derived from
   * {@link summaryPillVariants} so prop and cva cannot drift apart.
   */
  size?: NonNullable<VariantProps<typeof summaryPillVariants>["size"]>
  /**
   * Makes the pill a `<button>`; omit for a static pill. Typed as the full
   * React handler (the DS `.d.ts` narrows it to `() => void`, which costs call
   * sites `e.currentTarget` for anchoring the §S6 panel, `preventDefault` and
   * `stopPropagation`); a `() => void` stays assignable.
   */
  onClick?: React.MouseEventHandler<HTMLElement>
  /** React 19 ref-as-prop, so the pill stays forwardable (popover anchors). */
  ref?: React.Ref<HTMLElement>
}

function SummaryPill({
  className,
  icon,
  chevron = false,
  open,
  size = "md",
  onClick,
  children,
  ref,
  ...props
}: SummaryPillProps) {
  const interactive = onClick !== undefined
  // A disclosure is a pill whose caller tracks panel state — not a pill that
  // merely draws a caret.
  const isDisclosure = open !== undefined
  const classes = cn(summaryPillVariants({ size, interactive }), className)
  const state = isDisclosure ? (open ? "open" : "closed") : undefined

  const content = (
    <>
      {icon}
      {children}
      {chevron ? (
        <Icon
          name="chevron-down"
          size={CHEVRON_SIZE}
          className={cn(
            "transition-transform duration-[var(--duration-base)] ease-[ease]",
            open === true && "rotate-180"
          )}
        />
      ) : null}
    </>
  )

  if (interactive) {
    return (
      <button
        type="button"
        data-slot="summary-pill"
        data-size={size}
        data-state={state}
        aria-expanded={open}
        className={classes}
        onClick={onClick}
        ref={ref as React.Ref<HTMLButtonElement>}
        {...props}
      >
        {content}
      </button>
    )
  }

  return (
    <div
      data-slot="summary-pill"
      data-size={size}
      data-state={state}
      className={classes}
      ref={ref as React.Ref<HTMLDivElement>}
      {...props}
    >
      {content}
    </div>
  )
}

// `summaryPillVariants` is part of the shadcn public API: a screen can put the
// pill's look on an element it already owns — a `Collapsible.Trigger`, or the
// §D2 / §S6 pills whose geometry this component does not ship — instead of
// rendering a <SummaryPill>. `interactive` is internal to <SummaryPill> (it is
// derived from `onClick`) and defaults to `false`, so a call site styling its
// own control must ask for it: `summaryPillVariants({ size: 'lg', interactive:
// true })`, otherwise it gets `cursor-default` and no hover wash. The cva() call
// is not a plain constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { SummaryPill, summaryPillVariants }
export type { SummaryPillProps }
