import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Skeleton — the shadcn/ui skeleton primitive restyled to the RoomScout
 * design system.
 *
 * **No DS component spec exists.** `design-system/components/{core,data,
 * feedback,forms,navigation}` carries no `skeleton/` directory — no
 * `Skeleton.jsx`, no `.d.ts`, no `.prompt.md`, no `.card.html`. Everything
 * below is therefore **additive**, assembled from tokens and from the one
 * place the prototype draws a placeholder (see `bar`); the variant names
 * `default` / `bar` / `circle` and the `pulse` prop are this port's invention
 * and nothing in the DS pins them. Treat them as provisional — the same
 * caveat `status-dot.tsx` puts on its additive `danger` tone.
 *
 * DS spec for the *fill*: `design-system/tokens/colors.css` — the placeholder
 * surface is `--rs-surface-subtle-2`, the quiet white .06 step (above
 * `--rs-surface-subtle` .04, below `--rs-surface-hover` .10) — pulsing with the
 * DS's only pulse, the `rsDot` keyframe of `design-system/tokens/effects.css`
 * (`0%,100%{opacity:.4} 50%{opacity:1}`, 2.4s ease-in-out infinite, exposed by
 * `src/styles/tokens.css` as the `animate-rs-dot` utility). It is the same slow
 * breath the live status dot uses
 * (`design-system/components/core/status-dot/StatusDot.jsx:9`), so a loading
 * surface reads as "the Scout is working", not as a shimmering dashboard.
 *
 * Two stock shadcn choices are wrong under this token layer and are replaced:
 * - `bg-accent` — section (b) of `src/styles/tokens.css` re-points shadcn's
 *   `--accent` at `--rs-surface-hover` (white .10), i.e. the *hover* surface.
 *   Far too loud for a placeholder, and it would flash on hover-adjacent rows.
 * - `animate-pulse` — Tailwind's own 2s `cubic-bezier(.4,0,.6,1)` fade to
 *   opacity .5. The DS has no such curve; `rsDot` is the house pulse.
 *
 * **Sizing contract.** Each variant ships exactly the axes the DS fixes and
 * leaves the rest to the call site:
 * - `default` — no intrinsic size, like stock shadcn. Pass `h-*` / `w-*`.
 * - `bar` — height fixed at 6px (`--space-2`, the DS value); **width comes
 *   from the call site** (80/70/60/50/75 %).
 * - `circle` — both axes fixed at 42px (`--size-header-button`), the DS's
 *   round unit (icon buttons, header avatars). Override with `size-*`.
 *
 * **`bar` is the prototype's only documented placeholder** —
 * `docs/UI_PORT/COMPONENT_MAP.md` §E7 (= `LANDING_SCREENS.md` §10.3, bento
 * card C, and §E7 names shadcn `Skeleton` as the component for it):
 * `height:6px; border-radius:3px; background:rgba(255,255,255,.12)` at widths
 * 80/70/60/50/75 %, explicitly **static, no shimmer** — hence
 * `PULSE_DEFAULT.bar === false`. Two knowing divergences:
 * - **Radius.** There is no 3px token. `rounded-pill` (`--radius-pill`, 999px)
 *   is used instead: at the shipped 6px height CSS clamps the radius to 3px, so
 *   the two are pixel-identical *only while the bar is 6px tall*. Override the
 *   height (`<Skeleton variant="bar" className="h-3" />`) and you get a 6px
 *   pill where the spec says 3px — don't, or set the radius too.
 * - **Fill.** White .12 has no token (`colors.css` stops at .04 / .06 / .07 /
 *   .10; `docs/UI_PORT/TOKENS.md` §81 records it as a landing-only colour), so
 *   it is derived from `--rs-white` with Tailwind's alpha modifier — the route
 *   `switch.tsx` (.14), `stepper.tsx` (.12/.05) and `avatar.tsx` already take.
 *   A dedicated `--rs-surface-subtle-3` would be the real fix; see open
 *   questions. This also means `bar` matches neither half of the fill/pulse
 *   spec above — it is a landing-scoped decoration living in a shared
 *   primitive because §E7 maps it to `Skeleton`.
 * The bento's vertical rhythm (`margin-top:8px` on the first bar of a card,
 * `6px` on the second) is layout, not geometry, and stays at the call site
 * (`src/ui/landing/bento/SourcesCard.tsx`).
 *
 * **Deliberate deviations from stock new-york Skeleton** (i.e. the rendered
 * DOM of installed blocks *does* change; this is not purely additive):
 * - `rounded-md` → `rounded-chip` (8px, `--radius-chip`). `rounded-md` resolves
 *   through `--radius: var(--radius-control-lg)` to 10px `--radius-control`,
 *   which no skeleton-bearing DS surface uses (list/fact rows are 8px, mini
 *   cards 14px, cards 16–26px) — and the only in-repo consumer,
 *   `SidebarMenuSkeleton`, already overrides to `rounded-chip` itself
 *   (`sidebar.tsx:860-870`: `size-[18px] rounded-chip` and
 *   `h-4 max-w-(--skeleton-width) flex-1 rounded-chip`).
 * - Every node gains `data-variant`, `data-pulse` and — unless `label` is
 *   passed — `aria-hidden="true"`. Attribute-based snapshots of third-party
 *   blocks will see these.
 * The rest of the shadcn surface is untouched: plain `div` props (minus
 * `children`, below), `data-slot="skeleton"`, `className` merged last.
 *
 * **Accessibility.** A skeleton is decorative by default, so the root is
 * `aria-hidden="true"` and AT skips it. When the skeleton stands in for a whole
 * region, that leaves a silently empty area — pass `label` and the node becomes
 * a polite live region instead (`role="status" aria-busy="true"
 * aria-label={label}`, no `aria-hidden`), the same escape hatch `switch.tsx`
 * offers. An explicit `aria-hidden` from the call site still wins over both.
 * `children` is omitted from the props type: focusable content inside an
 * `aria-hidden` node is the axe `aria-hidden-focus` violation, so nesting is a
 * compile error rather than a silent a11y bug (the route `switch.tsx` takes).
 *
 * ```tsx
 * <Skeleton className="h-4 w-40" />
 * <Skeleton variant="circle" />
 * <Skeleton variant="bar" className="w-[80%]" />
 * <Skeleton className="h-24 w-full" label="Angebote werden geladen" />
 * ```
 */

/** The variant class map — the single source of the variant names. */
const VARIANT_CLASS = {
  /** Block placeholder — rows, cards, bubbles, text lines. No intrinsic size. */
  default: "rounded-chip bg-rs-surface-subtle-2",
  /**
   * Landing bento bar (COMPONENT_MAP §E7): 6px tall, fully rounded, white .12,
   * static. Width comes from the call site (80/70/60/50/75 %).
   */
  bar: "h-[var(--space-2)] rounded-pill bg-rs-white/12",
  /** Round placeholder — 42px icon buttons and avatars (`--size-header-button`). */
  circle:
    "size-[var(--size-header-button)] rounded-circle bg-rs-surface-subtle-2",
} as const

type SkeletonVariantName = keyof typeof VARIANT_CLASS

/** The variant a bare `<Skeleton />` / `skeletonVariants()` renders. */
const DEFAULT_VARIANT: SkeletonVariantName = "default"

/**
 * Whether each variant pulses when the call site says nothing. Only the DS's
 * documented placeholder has an opinion: COMPONENT_MAP §E7 ships `bar`
 * "static, no shimmer".
 */
const PULSE_DEFAULT: Record<SkeletonVariantName, boolean> = {
  default: true,
  bar: false,
  circle: true,
}

const skeletonVariants = cva("", {
  variants: {
    variant: VARIANT_CLASS,
    pulse: {
      /** DS `rsDot`, 2.4s ease-in-out infinite — the house "working" signal. */
      true: "animate-rs-dot motion-reduce:animate-none",
      false: "",
    },
  },
  defaultVariants: {
    variant: DEFAULT_VARIANT,
    pulse: PULSE_DEFAULT[DEFAULT_VARIANT],
  },
})

type SkeletonProps = Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof skeletonVariants> & {
    /**
     * Run the `rsDot` pulse. Defaults per variant (`PULSE_DEFAULT`): on, except
     * `variant="bar"`, which the DS ships static (COMPONENT_MAP §E7).
     * `prefers-reduced-motion` stops it in every case.
     *
     * Calling `skeletonVariants()` directly does **not** apply that per-variant
     * default — cva only knows the `default` variant's value — so pass `pulse`
     * explicitly there.
     */
    pulse?: boolean
    /**
     * Accessible name for a skeleton that replaces a whole region. Turns the
     * node into `role="status" aria-busy="true"` instead of hiding it, so AT
     * announces the wait rather than meeting an empty area. Omit for
     * decorative skeletons.
     */
    label?: string
  }

function Skeleton({
  className,
  variant,
  pulse,
  label,
  ...props
}: SkeletonProps) {
  const resolvedVariant = variant ?? DEFAULT_VARIANT
  const animated = pulse ?? PULSE_DEFAULT[resolvedVariant]

  const a11y: React.AriaAttributes & { role?: string } = label
    ? { role: "status", "aria-busy": "true", "aria-label": label }
    : { "aria-hidden": "true" }

  return (
    <div
      data-slot="skeleton"
      data-variant={resolvedVariant}
      data-pulse={animated ? "true" : undefined}
      {...a11y}
      className={cn(
        skeletonVariants({ variant: resolvedVariant, pulse: animated }),
        className
      )}
      {...props}
    />
  )
}

// `skeletonVariants` is part of the shadcn public API (a screen can put the
// placeholder style on an element it already renders); the cva() call is not a
// plain constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Skeleton, skeletonVariants }
export type { SkeletonProps }
