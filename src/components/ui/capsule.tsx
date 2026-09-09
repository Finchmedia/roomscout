import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * RoomScout fact capsule — the chip that appears under the current utterance
 * once the Scout has understood one fact („Stuttgart“, „Bis 400 € / Monat“),
 * before it glides into the fact list.
 *
 * DS reference: `design-system/components/core/capsule/`
 * (`Capsule.jsx`, `Capsule.d.ts`, `Capsule.prompt.md`, `capsule.card.html`).
 * Prototype source of truth: `docs/UI_PORT/SCOUT_SCREENS.md` §6.4 (chip) and
 * §4.3 (the flight choreography that this atom deliberately does not own).
 *
 * Geometry verbatim from `Capsule.jsx` / SCOUT_SCREENS.md §6.4:
 *   inline-flex · gap 8 (`--space-3`) · pill radius · white-space nowrap
 *   `md` (default) h 34 (`--space-15`) · padding-x 14 (`--space-6`) · 14px
 *                  (`--text-caption-size`)
 *   `sm`           h 30 (`--space-14`) · padding-x 12 (`--space-5`) · 13px
 *   fill `--rs-surface-accent-tint` (rgba(255,105,38,.16)), hairline
 *   `--rs-border-accent` (rgba(255,140,90,.5)), ink `--rs-orange-tint`
 *   (#ffd9c4), weight 500, `animation: rsFadeUp .3s ease both`
 *   (`animate-rs-fade-up`, whose duration token is `--duration-base` = .3s).
 * 13px is the one value with no token in `src/styles/tokens.css` (the caption
 * ladder is 14 / 13.5 / 12.5) and stays literal, as in `badge.tsx`.
 *
 * Reduced motion needs no handling here: `tokens.css` collapses every
 * animation globally under `prefers-reduced-motion: reduce`, and the
 * prototype's reduced-motion branch skips the flight at the stage level.
 *
 * **The flight is not part of this atom.** The stage owns it (§4.3: clone the
 * node into `<main>`, `Element.animate` it onto `[data-fact-row="<id>"]` over
 * 580 ms). What this component contributes are the handles that FLIP needs:
 *   · `data-capsule="1"` — the prototype's own selector for the live chip; the
 *     clone has it removed so only one node ever matches.
 *   · `data-slot="capsule"` / `data-size` — shadcn-style hooks for querying and
 *     for size-aware measurement.
 *   · `ref` — React 19 ref-as-prop, so the caller can hold the node it measures
 *     and clones without a DOM query.
 * The fade-in comes from a class, so a clone still carries it; setting
 * `clone.style.animation = "none"` (what `flyCapsule` does) wins over the
 * utility, and the FLIP transform stays uncontested.
 */
const capsuleVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center",
    "gap-[var(--space-3)] rounded-pill whitespace-nowrap",
    "border border-rs-border-accent bg-rs-surface-accent-tint",
    "font-sans font-medium text-rs-orange-tint",
    "animate-rs-fade-up",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      size: {
        /** DS sm — 30px, the tighter chip („Donnerstags ab 19 Uhr“). */
        sm: "h-[var(--space-14)] px-[var(--space-5)] text-[13px]",
        /** DS md — 34px, the default discovery chip. */
        md: "h-[var(--space-15)] px-[var(--space-6)] text-[length:var(--text-caption-size)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

interface CapsuleProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md"
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop — the node a FLIP flight measures and clones. */
  ref?: React.Ref<HTMLSpanElement>
}

function Capsule({ className, size = "md", ...props }: CapsuleProps) {
  return (
    <span
      data-slot="capsule"
      data-capsule="1"
      data-size={size}
      className={cn(capsuleVariants({ size }), className)}
      {...props}
    />
  )
}

// `capsuleVariants` is part of the shadcn public API (the flight clone is a
// raw node, not a <Capsule>, and may need the same classes); the cva() call is
// not a plain constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Capsule, capsuleVariants }
export type { CapsuleProps }
