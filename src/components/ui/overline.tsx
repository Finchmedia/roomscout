import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Overline — the DS's uppercase, letter-spaced section label (kicker/eyebrow).
 *
 * DS spec: `design-system/components/core/overline/Overline.jsx` (+ `.d.ts`,
 * `overline.card.html`). The prototype's own catalogue of this atom is
 * `docs/UI_PORT/COMPONENT_MAP.md` §A3 ("Eyebrow label", 36 occurrences across
 * all four surfaces).
 *
 * Fixed for every instance: `--font-sans`, `--text-overline-size` (12.5px),
 * `text-transform: uppercase`. The two props then pick tracking, weight and ink,
 * exactly as `Overline.jsx:5` does:
 *
 * - `tone="muted"` (default) — `--rs-ink-6` at `--weight-regular`, tracking
 *   `--text-overline-tracking` (.14em). The house default: the card/section
 *   kicker ("RAUM IN STUTTGART-WEST").
 * - `tone="accent"` — `--rs-orange-light` at `--weight-medium`, tracking
 *   **.16em**. The "something happened" label ("ANGEBOT EINGEGANGEN",
 *   "FREIGABE NÖTIG"). The DS deliberately tracks the accent tone one step
 *   wider than muted; .16em is the one value here with no token of its own
 *   (`design-system/tokens/typography.css` ships only .14em and .18em), so it
 *   is written literally — see `docs/UI_PORT/TOKENS.md` §F20 and
 *   `COMPONENT_MAP.md` §A3, where the two offer-card eyebrows (Scout
 *   "Angebot eingegangen" and Landing "Beispielangebot") are byte-identical at
 *   `letter-spacing:.16em`.
 * - `wide` — `--text-overline-tracking-wide` (.18em), overriding either tone's
 *   tracking. The landing-page section kicker ("SO FUNKTIONIERT ROOMSCOUT");
 *   the DS pairs it with `tone="accent"`, but it is orthogonal, as in the JSX.
 *
 * Weight is *not* `--text-overline-weight` (500) for both tones: the DS ships
 * muted at 400 and only the accent tone at 500, and the JSX is the authority
 * for the component. `font-normal`/`font-medium` are Tailwind's names for the
 * DS's `--weight-regular`/`--weight-medium`.
 *
 * A plain `div` with forwardable HTML props, so a call site can add `id`,
 * `aria-*`, `style` or its own spacing via `className`.
 */
const overlineVariants = cva(
  "font-sans text-[length:var(--text-overline-size)] uppercase",
  {
    variants: {
      tone: {
        /** Muted grey-beige kicker — the default. */
        muted: "font-normal text-rs-ink-6",
        /** Orange-light "event" label ("ANGEBOT EINGEGANGEN"). */
        accent: "font-medium text-rs-orange-light",
      },
      wide: {
        /** Landing section kicker: .18em. Wins over the tone's tracking. */
        true: "tracking-[var(--text-overline-tracking-wide)]",
        false: "",
      },
    },
    compoundVariants: [
      {
        tone: "muted",
        wide: false,
        class: "tracking-[var(--text-overline-tracking)]",
      },
      // .16em — DS accent tracking, no token exists for it (see JSDoc).
      { tone: "accent", wide: false, class: "tracking-[.16em]" },
    ],
    defaultVariants: {
      tone: "muted",
      wide: false,
    },
  }
)

interface OverlineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** muted grey-beige (default) or accent orange-light ("ANGEBOT EINGEGANGEN"). */
  tone?: "muted" | "accent"
  /** .18em tracking (landing section kickers). */
  wide?: boolean
  children?: React.ReactNode
  style?: React.CSSProperties
}

function Overline({
  className,
  tone = "muted",
  wide = false,
  ...props
}: OverlineProps) {
  return (
    <div
      data-slot="overline"
      data-tone={tone}
      data-wide={wide ? "true" : undefined}
      className={cn(overlineVariants({ tone, wide }), className)}
      {...props}
    />
  )
}

// `overlineVariants` is part of the shadcn public API (a screen can put the
// eyebrow type on an existing element — a <dt>, a <legend> — instead of
// rendering an <Overline>); the cva() call is not a plain constant, so the
// react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Overline, overlineVariants }
export type { OverlineProps }
