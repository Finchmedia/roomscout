import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * RoomScout badge — shadcn primitive restyled to the design-system spec.
 *
 * DS reference: `design-system/components/core/badge/`
 * (`Badge.jsx`, `Badge.d.ts`, `Badge.prompt.md`, `badge.card.html`).
 *
 * The four DS variants (names from `Badge.d.ts`), geometry verbatim from
 * `Badge.jsx` — padding / radius / font-size / weight / tracking:
 *   `solid`   5px 11px · pill · 12.5px · 600 · .04em — orange, white ink
 *             („Mein Vorschlag“)
 *   `outline` 5px 10px · chip 8 · 12px · 600 · .12em · uppercase — accent
 *             hairline, `--rs-orange-light` ink („INTERN“)
 *   `muted`   4px 10px · pill · 13px — neutral panel hairline, `--rs-ink-6`
 *             („In dieser Demo nicht aktiv“)
 *   `pill`    h 38 · 0 18px · pill · 14.5px — accent hairline, body ink
 *             („Euer persönlicher Proberaum-Scout“)
 *
 * The shadcn API is preserved: `asChild`, `badgeVariants`, `data-slot="badge"`
 * and the `default` / `secondary` / `destructive` / `outline` / `ghost` /
 * `link` variant names all still resolve — `default` is an alias of DS `solid`,
 * `secondary` of DS `muted`. One deliberate semantic change: `outline` now
 * carries the DS meaning (uppercase accent chip), because the DS owns that
 * name; reach for `muted` when a neutral outline chip is wanted. `destructive`
 * / `ghost` / `link` have no DS counterpart and are kept only so installed
 * blocks keep rendering; they are built from DS tokens.
 *
 * Token notes:
 *  · The DS outline (.60) and pill (.55) accent hairlines both fold into the
 *    .50 step per docs/UI_PORT/TOKENS.md §F10 → `--rs-border-accent`.
 *  · 12.5px is `--text-micro-size`; 12px / 13px / 14.5px and the 5px / 11px /
 *    38px steps have no token in src/styles/tokens.css and stay literal.
 *  · shadcn's `overflow-hidden` is dropped: the Scout live badge puts a glowing
 *    dot inside a badge, and the glow must not be clipped.
 */

/** DS solid — the orange label pill. */
const SOLID =
  "rounded-pill bg-rs-orange px-[11px] py-[5px] text-[length:var(--text-micro-size)] font-semibold tracking-[.04em] text-rs-white [a&]:hover:bg-rs-orange-hover"
/** DS muted — neutral outline pill, quiet caption ink. */
const MUTED =
  "rounded-pill border border-rs-border-panel px-[var(--space-4)] py-[var(--space-1)] text-[13px] font-normal text-rs-ink-6 [a&]:hover:bg-rs-surface-hover-soft"

const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center",
    "gap-[var(--space-3)] font-sans whitespace-nowrap",
    "transition-[background-color,border-color,color]",
    "duration-[var(--duration-quick)] ease-out-soft",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        solid: SOLID,
        /** shadcn alias — `default` is the DS solid. */
        default: SOLID,
        /** DS outline — uppercase accent chip, the only 8px-radius badge. */
        outline:
          "rounded-chip border border-rs-border-accent px-[var(--space-4)] py-[5px] text-[12px] font-semibold tracking-[.12em] text-rs-orange-light uppercase [a&]:hover:bg-rs-surface-accent-tint-soft",
        muted: MUTED,
        /** shadcn alias — `secondary` is the DS muted. */
        secondary: MUTED,
        /** DS pill — the 38px hero / header capsule. */
        pill: "h-[38px] rounded-pill border border-rs-border-accent px-[var(--space-8)] text-[14.5px] font-normal text-rs-ink [a&]:hover:bg-rs-surface-accent-tint-soft",
        /** Not a DS variant — shadcn parity, solid geometry in DS red. */
        destructive:
          "rounded-pill bg-rs-red px-[11px] py-[5px] text-[length:var(--text-micro-size)] font-semibold tracking-[.04em] text-rs-white [a&]:hover:bg-rs-red-hover",
        /** Not a DS variant — shadcn parity: muted without the hairline. */
        ghost:
          "rounded-chip px-[var(--space-4)] py-[var(--space-1)] text-[13px] font-normal text-rs-ink-6 [a&]:hover:bg-rs-surface-hover-soft",
        /** Not a DS variant — shadcn parity: the DS underlined text button. */
        link: "text-[13px] font-normal text-rs-ink-3 underline decoration-rs-border-control-strong underline-offset-4 [a&]:hover:text-rs-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    /** Render as the single child element (shadcn Slot). */
    asChild?: boolean
  }

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

// `badgeVariants` is part of the shadcn public API (blocks apply it to an
// anchor instead of rendering a <Badge>); the cva() call is not a plain
// constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants }
export type { BadgeProps }
