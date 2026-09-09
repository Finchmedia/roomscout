import * as React from "react"
import { cva } from "class-variance-authority"
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
 *   `display:inline-block` · `padding:10px 16px` (`--space-4` / `--space-7`)
 *   · `border-radius:12px` (`--radius-control-lg`)
 *   · `background:--rs-surface-hint` · `font-size:13.5px`
 *   (`--text-caption-sm-size`) in `--rs-ink-2` · `text-align:center`
 *   · `animation:rsFadeUp .3s ease both` — exactly `animate-rs-fade-up`
 *   (`rsFadeUp var(--duration-base) ease both`, and `--duration-base` is .3s).
 *   `prefers-reduced-motion` collapses that enter globally in
 *   `src/styles/tokens.css`.
 *
 * Token notes:
 *  · **Border.** The DS value is `rgba(255,200,160,.2)` (`Hint.jsx:5`,
 *    `SCOUT_SCREENS.md` §2.8, `COMPONENT_MAP.md` §D5) and it has no token.
 *    Be precise about why `--rs-border-card-strong` (.18) stands in, because
 *    the port docs do *not* endorse .18: `TOKENS.md` §F5 would put the whole
 *    toast/tooltip/hint hairline on `rgba(255,200,160,.22)`, and §F9 collapses
 *    the `255,200,160` card ladder to .14 / .16 / .25 / .35. .18 is in neither
 *    list — it is simply the nearest *shipped* step to the DS .2 (the family
 *    ships .12 / .14 / .18), and it is the same fold `tooltip.tsx` makes from
 *    the same `Hint.jsx:5` line, so the two floating surfaces stay identical.
 *    §F9's default `--rs-border-card` (.14) is deliberately not used: it is one
 *    step too quiet for a surface that has to read as detached from the stage
 *    behind it. The real fix is a `--rs-border-hint` / `--rs-border-toast` at
 *    §F5's .22 in `src/styles/tokens.css`; adding it is out of scope here, and
 *    this atom should move to it when it lands.
 *  · **560px** has no token (`--width-card-narrow` is 380, `--width-card` 720,
 *    `--width-card-wide` 740) and stays literal — the one hard-coded dimension
 *    in the file. A `--width-hint: 560px` token would remove the exception.
 *
 * Width: the atom ships the *screen's* clamp, `min(560px, calc(100% - 32px))`
 * (`SCOUT_SCREENS.md` §2.8, `COMPONENT_MAP.md` §D5, and `TOKENS.md` §C5's
 * „All 21 `width:min(…)` values" table, which records it for the hint bar), not
 * `Hint.jsx:5`'s flat `max-width:560`. The two agree at ≥592px; below that the
 * flat DS value overflows, and the eight German strings run to ~110 characters,
 * so the clamp is the only correct reading. `32px` is `2 * --space-7` — the
 * same gutter the hint's own horizontal padding uses.
 *
 * Positioning is *not* part of the atom. The Scout screen pins it
 * `position:absolute;z-index:8;left:50%;bottom:22px;translateX(-50%)`; that,
 * and the 4200 ms auto-clear that only fires while the hint is still the same
 * string (`SCOUT_SCREENS.md` §18.3), belong to the `HintBar` chrome component
 * (`COMPONENT_MAP.md` §D5) — pass them via `className` / `style` / `ref`.
 *
 * Accessibility: `role="status"` (with the paired explicit `aria-live="polite"`
 * older AT combinations still want) is the DS default and is right for the
 * transient prototype notices. For *static* copy — a form footnote, a settings
 * caption — pass `role={undefined}`, which drops the paired `aria-live` too, so
 * the note is not announced on every mount and every text swap.
 * Known risk to carry into `HintBar`: 4200 ms is marginal reading time for the
 * longest string (`hint.freeTextDiscovery`) and is a WCAG 2.2.1 (Timing
 * Adjustable) exposure.
 */
const hintVariants = cva([
  "inline-block max-w-[min(560px,calc(100%_-_2_*_var(--space-7)))]",
  "rounded-control-lg border border-rs-border-card-strong bg-rs-surface-hint",
  "px-[var(--space-7)] py-[var(--space-4)]",
  "font-sans text-[length:var(--text-caption-sm-size)] text-rs-ink-2",
  "text-center",
  "animate-rs-fade-up",
])

interface HintProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop — the node `HintBar` positions and measures. */
  ref?: React.Ref<HTMLDivElement>
}

function Hint({
  className,
  role = "status",
  "aria-live": ariaLive,
  ...props
}: HintProps) {
  return (
    <div
      data-slot="hint"
      role={role}
      // `role="status"` implies it, but the paired form is the defensive belt;
      // an explicit `aria-live` wins, and dropping the role drops it as well.
      aria-live={ariaLive ?? (role === "status" ? "polite" : undefined)}
      className={cn(hintVariants(), className)}
      {...props}
    />
  )
}

// `hintVariants` is part of the shadcn public API: `COMPONENT_MAP.md` §D5 lets
// `HintBar` be a Sonner toaster, and sonner renders its own node — so the
// recipe has to be reachable without a `<Hint>` wrapper (`toast.custom(() =>
// <div className={hintVariants()} />, { unstyled: true })`) rather than
// re-authored as a second set of inline styles. The cva() call is not a plain
// constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Hint, hintVariants }
export type { HintProps }
