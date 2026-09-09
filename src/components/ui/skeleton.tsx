import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Skeleton — the shadcn/ui skeleton primitive restyled to the RoomScout
 * design system.
 *
 * DS spec: `design-system/tokens/colors.css` — the placeholder fill is
 * `--rs-surface-subtle-2`, the quiet white .06 surface (the step above
 * `--rs-surface-subtle` .04 and below `--rs-surface-hover` .10) — pulsing with
 * the DS's only pulse, the `rsDot` keyframe of
 * `design-system/tokens/effects.css` (`0%,100%{opacity:.4} 50%{opacity:1}`,
 * 2.4s ease-in-out infinite, exposed by `src/styles/tokens.css` as the
 * `animate-rs-dot` utility). It is the same slow breath the live status dot
 * uses (`design-system/components/core/status-dot/StatusDot.jsx:9`), so a
 * loading surface reads as "the Scout is working", not as a shimmering
 * dashboard.
 *
 * Two stock shadcn choices are wrong under this token layer and are replaced:
 * - `bg-accent` — section (b) of `src/styles/tokens.css` re-points shadcn's
 *   `--accent` at `--rs-surface-hover` (white .10), i.e. the *hover* surface.
 *   Far too loud for a placeholder, and it would flash on hover-adjacent rows.
 * - `animate-pulse` — Tailwind's own 2s `cubic-bezier(.4,0,.6,1)` fade to
 *   opacity .5. The DS has no such curve; `rsDot` is the house pulse.
 *
 * The prototype ships no skeleton component of its own. Its one documented
 * appearance is `docs/UI_PORT/COMPONENT_MAP.md` §E7 (= `LANDING_SCREENS.md`
 * §10.3, bento card C): bars of `height:6px; border-radius:3px` on white .12,
 * at widths 80/70/60/50/75 % — and explicitly **static, no shimmer**. That is
 * the `bar` variant: 6px is `--space-2`, a 3px radius on a 6px bar is a full
 * pill (`--radius-pill`), and `pulse` defaults to `false` there. The .12 fill
 * has no token of its own, so it is derived from `--rs-white` with Tailwind's
 * alpha modifier (the same route `switch.tsx` takes for its .14 off-track).
 * `circle` is the placeholder for the DS's round things — 42px icon buttons and
 * avatars (`--radius-circle`).
 *
 * The shadcn public API is untouched: plain `div` props, `data-slot="skeleton"`,
 * and the default variant keeps stock's `rounded-md` box so installed blocks
 * that pass their own geometry (`SidebarMenuSkeleton`'s `size-4 rounded-md` /
 * `h-4 max-w-(--skeleton-width) flex-1`) render exactly as before. `variant`,
 * `pulse` and the decorative `aria-hidden` default are additive; an explicit
 * `aria-hidden` from the call site still wins.
 */
const skeletonVariants = cva("", {
  variants: {
    variant: {
      /** Block placeholder — rows, cards, bubbles, text lines. */
      default: "rounded-md bg-rs-surface-subtle-2",
      /**
       * Landing bento bar (COMPONENT_MAP §E7): 6px tall, fully rounded,
       * white .12. Width comes from the call site (80/70/60/50/75 %).
       */
      bar: "h-[var(--space-2)] w-full rounded-pill bg-rs-white/12",
      /** Round placeholder — avatars and 42px icon buttons. */
      circle: "rounded-circle bg-rs-surface-subtle-2",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

type SkeletonProps = React.ComponentProps<"div"> &
  VariantProps<typeof skeletonVariants> & {
    /**
     * Run the `rsDot` pulse. Defaults to `true`, except for `variant="bar"`,
     * which the DS ships static (COMPONENT_MAP §E7: "static, no shimmer").
     * `prefers-reduced-motion` stops it in every case.
     */
    pulse?: boolean
  }

function Skeleton({ className, variant, pulse, ...props }: SkeletonProps) {
  const resolvedVariant = variant ?? "default"
  const animated = pulse ?? resolvedVariant !== "bar"

  return (
    <div
      data-slot="skeleton"
      data-variant={resolvedVariant}
      aria-hidden="true"
      className={cn(
        skeletonVariants({ variant: resolvedVariant }),
        animated && "animate-rs-dot motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
export type { SkeletonProps }
