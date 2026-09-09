import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * RoomScout card — the dark, slightly translucent container with a very fine
 * warm hairline that everything on the grain background sits in.
 *
 * DS reference: `design-system/components/core/card/`
 * (`Card.jsx`, `Card.d.ts`, `Card.prompt.md`, `card.card.html`).
 *
 * DS rule: no frosted glass, no blur, no glow, no gradient fill — background
 * `--rs-surface-card` (rgba(18,14,12,.72)) over the photo, border
 * `--rs-border-card` (rgba(255,200,160,.14)), and that is the whole treatment.
 *
 * Geometry (radius · padding), verbatim from `Card.jsx`:
 *   `sm`    16 · 14/18        `md` 20 · 24/26      `lg`  22 · 34/36/30
 *   `xl`    24 · 28/36/30     `2xl` 26 · 32/34     `panel` 28 · 0
 *
 * Tones (background / border), verbatim from `Card.jsx`:
 *   `default` card / card border      `soft`    card-soft / card border
 *   `faint`   card-faint / card-soft  `accent`  card / accent hairline
 *   `warning` amber tint / amber      `inset`   inset / card border
 *   `panel`   panel + `--shadow-panel` / panel border
 *   `rust`    rust-faint — the warm lock notice
 *             („Verbindliche Entscheidungen bleiben bei dir.“)
 *
 * Notes:
 *  · `md`'s 20px radius and `2xl`'s 32px padding have no token in
 *    src/styles/tokens.css (the radius ladder jumps 18 → 22, the spacing one
 *    30 → 34); they stay literal. Every other radius and padding step is a
 *    `--radius-*` utility or a `--space-*` token.
 *  · The DS `rust` border is rgba(255,140,90,.22), which has no token — it
 *    folds into `--rs-border-accent-faint` (.30) per
 *    docs/UI_PORT/TOKENS.md §F10 (".22 .30 .35" → one accent border step).
 *  · `hoverLift` is the landing bento lift (translateY(-3px)). The DS drives it
 *    from JS mouse state; here it is a plain `:hover`, so it also survives
 *    keyboard/touch scrolling and costs no render.
 *  · `padding` overrides the size padding inline; a caller `style.padding`
 *    still wins over it, exactly as in `Card.jsx`.
 */

const cardVariants = cva(
  [
    "font-sans text-left text-rs-ink",
    "border",
    // Tailwind v4 emits the standalone `translate` property for
    // -translate-y-*, not `transform`, so both are listed or the hoverLift
    // would jump instead of easing.
    "transition-[transform,translate]",
    "duration-[var(--duration-base)] ease-out-soft",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "rounded-card px-[var(--space-8)] py-[var(--space-6)]",
        // 20px is not on the DS radius ladder (…18, 22…) — kept literal.
        md: "rounded-[20px] px-[var(--space-12)] py-[var(--space-11)]",
        lg: "rounded-card-lg px-[var(--space-16)] pt-[var(--space-15)] pb-[var(--space-14)]",
        xl: "rounded-card-xl px-[var(--space-16)] pt-[var(--space-13)] pb-[var(--space-14)]",
        // 32px has no spacing token (the scale jumps 30 → 34), so the Tailwind
        // step is used for the block padding.
        "2xl": "rounded-card-2xl px-[var(--space-15)] py-8",
        panel: "rounded-panel p-0",
      },
      tone: {
        default: "border-rs-border-card bg-rs-surface-card",
        soft: "border-rs-border-card bg-rs-surface-card-soft",
        faint: "border-rs-border-card-soft bg-rs-surface-card-faint",
        /** accent — default surface, warm orange hairline („Freigabe nötig“). */
        accent: "border-rs-border-accent-faint bg-rs-surface-card",
        warning: "border-rs-border-amber bg-rs-surface-amber-tint",
        inset: "border-rs-border-card bg-rs-surface-inset",
        /** panel — the settings / operator shell; the only card with a shadow. */
        panel: "border-rs-border-panel bg-rs-surface-panel shadow-panel",
        /** rust — the warm lock notice; .22 hairline folded onto the .30 step. */
        rust: "border-rs-border-accent-faint bg-rs-rust-faint",
      },
      hoverLift: {
        true: "hover:-translate-y-[3px]",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      tone: "default",
      hoverLift: false,
    },
  }
)

interface CardProps extends React.ComponentProps<"div"> {
  /** Radius/padding scale: sm 16, md 20, lg 22, xl 24, 2xl 26, panel 28. */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "panel"
  tone?:
    | "default"
    | "soft"
    | "faint"
    | "accent"
    | "warning"
    | "inset"
    | "panel"
    | "rust"
  /** Landing bento hover: translateY(-3px). */
  hoverLift?: boolean
  /** Override padding (CSS string or number). */
  padding?: string | number
  children?: React.ReactNode
  style?: React.CSSProperties
}

function Card({
  className,
  size = "md",
  tone = "default",
  hoverLift = false,
  padding,
  style,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      data-size={size}
      data-tone={tone}
      className={cn(cardVariants({ size, tone, hoverLift }), className)}
      style={padding === undefined ? style : { padding, ...style }}
      {...props}
    />
  )
}

// `cardVariants` is part of the shadcn contract — it lets a composite reuse the
// card surface on an element it already renders (a <section>, a <button>, a
// Radix content part) instead of nesting a <Card>; the cva() call is not a
// plain constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Card, cardVariants }
export type { CardProps }
