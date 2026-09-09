import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Hint — the quiet note that sits *outside* the conversation.
 *
 * DS reference: `design-system/components/feedback/hint/`
 * (`Hint.jsx`, `Hint.d.ts`, `Hint.prompt.md`, `hint.card.html`).
 *
 * A single, variant-free surface: the prototype uses it for the eight
 * „Prototyp: …“ lines that tell the user the demo only understands prepared
 * answers (`docs/UI_PORT/SCOUT_SCREENS.md` §2.8 / §18.3, `COMPONENT_MAP.md`
 * §D5 „Hint bar“). It is *not* a toast — no icon, no action, no dismiss.
 *
 * Geometry verbatim from `Hint.jsx:5`:
 *   `display:inline-block` · `max-width:560px` · `padding:10px 16px`
 *   (`--space-4` / `--space-7`) · `border-radius:12px` (`--radius-control-lg`)
 *   · `background:--rs-surface-hint` · `font-size:13.5px`
 *   (`--text-caption-sm-size`) in `--rs-ink-2` · `text-align:center`
 *   · `animation:rsFadeUp .3s ease both` — exactly `animate-rs-fade-up`
 *   (`rsFadeUp var(--duration-base) ease both`, and `--duration-base` is .3s).
 *   `prefers-reduced-motion` collapses that enter globally in
 *   `src/styles/tokens.css`.
 *
 * Token notes:
 *  · The DS border is `rgba(255,200,160,.2)`, which has no token of its own.
 *    It folds into `--rs-border-card-strong` (.18) — the nearest step in the
 *    same `255,200,160` family, and the nearest to the `.22` that
 *    `docs/UI_PORT/TOKENS.md` §F5 unifies the toast/tooltip/hint hairlines on.
 *    §F9 records that the whole `.10…30` ladder is used interchangeably, so
 *    the two-hundredths are invisible over the dark ground.
 *  · 560px has no token (`--width-card-narrow` is 380, `--width-card` 720) and
 *    stays literal.
 *
 * Positioning is deliberately *not* part of the atom. The Scout screen pins it
 * `position:absolute;z-index:8;left:50%;bottom:22px;translateX(-50%)` and
 * tightens the width to `min(560px, calc(100% - 32px))`; that, and the 4200 ms
 * auto-clear, belong to the `HintBar` chrome component
 * (`COMPONENT_MAP.md` §D5) — pass them via `className` / `style`.
 *
 * `role="status"` (an implicit `aria-live="polite"`) is the DS default and can
 * be overridden through props, like every other HTML attribute.
 */
interface HintProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  style?: React.CSSProperties
}

function Hint({ className, ...props }: HintProps) {
  return (
    <div
      data-slot="hint"
      role="status"
      className={cn(
        "inline-block max-w-[560px]",
        "rounded-control-lg border border-rs-border-card-strong bg-rs-surface-hint",
        "px-[var(--space-7)] py-[var(--space-4)]",
        "font-sans text-[length:var(--text-caption-sm-size)] text-rs-ink-2",
        "text-center",
        "animate-rs-fade-up",
        className
      )}
      {...props}
    />
  )
}

export { Hint }
export type { HintProps }
