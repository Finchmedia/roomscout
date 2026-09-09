import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * StatusDot — a coloured dot plus a short status line.
 *
 * DS reference: `design-system/components/core/status-dot/`
 * (`StatusDot.jsx`, `StatusDot.d.ts`, `StatusDot.prompt.md`,
 * `status-dot.card.html`). Prototype catalogue:
 * `docs/UI_PORT/COMPONENT_MAP.md` §A2 and `docs/UI_PORT/SCOUT_SCREENS.md`
 * §2.4.1 (the header Scout badge).
 *
 * Geometry verbatim from `StatusDot.jsx:6-12`: an `inline-flex` row,
 * `gap:10px` (`--space-4`), `--font-sans`, 14.5px, `--rs-ink-2`,
 * `white-space:nowrap`; the mark is a `50%`-round `flex:none` square of
 * `size` px (default 8 = `--space-3`). 14.5px has no token of its own
 * (`--text-caption-size` is 14px, `--text-caption-sm-size` 13.5px), so it stays
 * literal — the same route `badge.tsx` takes for its `pill` variant.
 *
 * **Tones** (`StatusDot.d.ts`; colours from the `C` map in `StatusDot.jsx:3`)
 * and the prototype states they cover per COMPONENT_MAP §A2:
 * - `accent` (default) — `--rs-orange`. Paired with `pulse`, this is the
 *   prototype's `live` dot: „Scout ist unterwegs“, the latest activity row.
 * - `success` — `--rs-green`. `ok`: „Verbunden“, „Verfügbar“.
 * - `warning` — `--rs-amber`. `warn`: „Anmeldung nötig“, the waiting states.
 * - `muted` — `--rs-ink-6`. `paused` (`#a89684`, never animated):
 *   „Suche pausiert“, „Ausgeschlossen“.
 * - `neutral` — `--rs-ink-2`, the dot that carries the label's own ink.
 * - `danger` — `--rs-red`, the DS `--danger` alias. **Additive**: the DS map
 *   has no red tone (see open questions); it exists so a failure row does not
 *   have to reach for the raw-string escape hatch.
 *
 * Any other string is passed through as a CSS colour, exactly as the DS's
 * `C[tone] || tone` fallback does — use it only with a token, e.g.
 * `tone="var(--rs-white)"`. COMPONENT_MAP's remaining prototype tones (`idle`
 * white .3, `past` warm-white .35) have no DS token and are deliberately not
 * named here.
 *
 * `pulse` is the DS's only "working" signal — never a spinner or a progress
 * bar (`StatusDot.prompt.md`). It runs `rsDot`
 * (`0%,100%{opacity:.4} 50%{opacity:1}`, 2.4s ease-in-out infinite) via the
 * `animate-rs-dot` utility from `src/styles/tokens.css`, and stops under
 * `prefers-reduced-motion`.
 *
 * The label is optional: the narrow header renders the dot alone and keeps the
 * text as `title`/`aria-label` on this element (`SCOUT_SCREENS.md` §2.4.1), so
 * every `span` attribute — including `title`, `aria-label`, `style` and
 * `className` — is forwarded to the row.
 *
 * ```tsx
 * <StatusDot pulse>Scout ist unterwegs</StatusDot>
 * <StatusDot tone="success">Verbunden</StatusDot>
 * <StatusDot tone="warning">Anmeldung nötig</StatusDot>
 * <StatusDot tone="muted" size={7} aria-label="Suche pausiert" />
 * ```
 */

/** The DS `C` map (`StatusDot.jsx:3`) as token utilities, plus `danger`. */
const TONE_CLASS = {
  accent: "bg-rs-orange",
  success: "bg-rs-green",
  warning: "bg-rs-amber",
  muted: "bg-rs-ink-6",
  neutral: "bg-rs-ink-2",
  danger: "bg-rs-red",
} as const

/** Named DS tones; any other string is a CSS colour (DS `C[tone] || tone`). */
type StatusDotToneName = keyof typeof TONE_CLASS

/**
 * `'accent' | 'success' | 'warning' | 'muted' | 'neutral' | 'danger' | string`
 * — `Record<never, never>` only keeps the named steps in autocomplete.
 */
type StatusDotTone = StatusDotToneName | (string & Record<never, never>)

/** `style` that may carry the dot's own custom property. */
type StatusDotStyle = React.CSSProperties & Record<`--${string}`, string>

/**
 * The mark itself. Exported so a screen can put the dot on an element it
 * already renders (a list bullet, a `::before`-less legend swatch) instead of
 * nesting one. Size comes from `--rs-dot-size`, defaulting to the DS's 8px.
 */
const statusDotVariants = cva(
  "block size-[var(--rs-dot-size,var(--space-3))] flex-none rounded-circle",
  {
    variants: {
      tone: TONE_CLASS,
      pulse: {
        /** DS `rsDot`, 2.4s ease-in-out infinite — the only "working" signal. */
        true: "animate-rs-dot motion-reduce:animate-none",
        false: "",
      },
    },
    defaultVariants: {
      tone: "accent",
      pulse: false,
    },
  }
)

interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** DS tone name, or any CSS colour string (pass a token: `var(--rs-…)`). */
  tone?: StatusDotTone
  /** Slow opacity blink while the Scout is working. */
  pulse?: boolean
  /** Dot size in px. DS default 8; the prototype also uses 6, 7, 9 and 12. */
  size?: number
  children?: React.ReactNode
  style?: React.CSSProperties
}

function isToneName(tone: StatusDotTone): tone is StatusDotToneName {
  return Object.prototype.hasOwnProperty.call(TONE_CLASS, tone)
}

function StatusDot({
  className,
  tone = "accent",
  pulse = false,
  size,
  style,
  children,
  ...props
}: StatusDotProps) {
  const named = isToneName(tone)
  const customSize: StatusDotStyle | undefined =
    size === undefined ? undefined : { "--rs-dot-size": `${size}px` }

  return (
    <span
      data-slot="status-dot"
      data-tone={tone}
      data-pulse={pulse ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-[var(--space-4)] font-sans text-[14.5px] whitespace-nowrap text-rs-ink-2",
        className
      )}
      style={customSize ? { ...customSize, ...style } : style}
      {...props}
    >
      <span
        data-slot="status-dot-indicator"
        aria-hidden="true"
        className={statusDotVariants({
          // A custom colour string has no utility — skip the tone class
          // (`null` opts out of cva's default) and paint it inline.
          tone: named ? tone : null,
          pulse,
        })}
        style={named ? undefined : { background: tone }}
      />
      {children}
    </span>
  )
}

// `statusDotVariants` is part of the shadcn public API (a screen can put the
// dot style on an element it already renders); the cva() call is not a plain
// constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { StatusDot, statusDotVariants }
export type { StatusDotProps, StatusDotTone }
