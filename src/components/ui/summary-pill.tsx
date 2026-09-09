import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/ui/icon"

/**
 * SummaryPill — the dark translucent capsule that carries the brief in one line
 * („Stuttgart · bis 350 €“), optionally clickable to expand a panel.
 *
 * DS reference: `design-system/components/core/summary-pill/`
 * (`SummaryPill.jsx`, `SummaryPill.d.ts`, `SummaryPill.prompt.md`,
 * `summary-pill.card.html`). Screen context: `docs/UI_PORT/COMPONENT_MAP.md`
 * §D2 („Pill panel / summary pill“) and §S6 („Brief pill + panel“).
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
 * Token notes:
 *  · 36 / 44 / 50px are `--size-button-2xs` / `--size-button-xs` /
 *    `--size-button-md`; 16 / 20 / 10px are `--space-7` / `--space-9` /
 *    `--space-4`; 16px type is `--text-body-size`. Only 14.5px has no token in
 *    `src/styles/tokens.css` (`docs/UI_PORT/TOKENS.md` §F19 keeps it as the
 *    dense caption step) and stays literal, as in `badge.tsx`.
 *  · The DS hover fill is `rgba(30,22,16,.7)` — per `TOKENS.md` §A1 and
 *    `COMPONENT_MAP.md` §D2 the single non-white hover wash in the app, and the
 *    one value here with no token. It is not folded into a white hover step
 *    (that would lose the warmth the DS is deliberately after); instead it is
 *    derived from the nearest tokenised warm surface, `--rs-surface-hint`
 *    (`rgba(28,20,14,.92)`), taken to 76% alpha → `rgba(28,20,14,.70)`. Same
 *    alpha as the DS, and a 2/2/2 rgb delta that is imperceptible over the dark
 *    ground (the §F2 argument for collapsing near-identical warm values).
 *
 * Deliberate additions over `SummaryPill.jsx`, all behavioural:
 *  · The DS swaps the hover fill through React mouse state, which repaints on
 *    every enter/leave; here it is a plain `:hover` with the DS quick duration.
 *  · The global DS focus ring (`TOKENS.md` §F17: 2px solid orange, 2px offset).
 *  · `aria-expanded` on the clickable pill whenever `chevron` is set — the
 *    chevron already announces a disclosure visually (§S6 pill + panel).
 *  · The chevron is the shared `chevron-down` glyph from `icon.tsx`, whose path
 *    (`M6 9l6 6 6-6`) and stroke width (2) are byte-identical to the inline SVG
 *    in `SummaryPill.jsx`; `open` rotates it 180° over `--duration-base`.
 */
const summaryPillVariants = cva(
  [
    "inline-flex items-center whitespace-nowrap",
    "gap-[var(--space-4)] font-sans",
    "rounded-pill border border-rs-border-card-strong bg-rs-surface-pill",
    "transition-[background-color,color] duration-[var(--duration-quick)] ease-out-soft",
    // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
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
          "[--rs-summary-pill-hover:color-mix(in_srgb,var(--rs-surface-hint)_76%,transparent)]",
          "hover:bg-(--rs-summary-pill-hover)",
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
  /** Render the trailing disclosure chevron. */
  chevron?: boolean
  /** Panel state — rotates the chevron 180° and sets `aria-expanded`. */
  open?: boolean
  /** 36px / 44px / 50px; `md` is the DS default. */
  size?: "sm" | "md" | "lg"
  /** Makes the pill a `<button>`; omit for a static pill. */
  onClick?: () => void
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop, so the pill stays forwardable (popover anchors). */
  ref?: React.Ref<HTMLElement>
}

function SummaryPill({
  className,
  icon,
  chevron = false,
  open = false,
  size = "md",
  onClick,
  children,
  ref,
  ...props
}: SummaryPillProps) {
  const interactive = onClick !== undefined
  const classes = cn(summaryPillVariants({ size, interactive }), className)

  const content = (
    <>
      {icon}
      {children}
      {chevron ? (
        <Icon
          name="chevron-down"
          size={14}
          className={cn(
            "transition-transform duration-[var(--duration-base)] ease-out-soft",
            open && "rotate-180"
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
        data-state={chevron ? (open ? "open" : "closed") : undefined}
        aria-expanded={chevron ? open : undefined}
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
      data-state={chevron ? (open ? "open" : "closed") : undefined}
      className={classes}
      ref={ref as React.Ref<HTMLDivElement>}
      {...props}
    >
      {content}
    </div>
  )
}

// `summaryPillVariants` is part of the shadcn public API (a screen can put the
// pill's look on an existing element — the offer/candidates disclosure buttons
// of COMPONENT_MAP §S6 — instead of rendering a <SummaryPill>); the cva() call
// is not a plain constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { SummaryPill, summaryPillVariants }
export type { SummaryPillProps }
