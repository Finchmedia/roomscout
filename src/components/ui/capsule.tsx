import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

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
 *   (#ffd9c4), weight 500 (`--weight-medium`), `animation: rsFadeUp .3s ease
 *   both` (`animate-rs-fade-up`, whose duration token is `--duration-base`).
 * Nothing beyond that list is added: `Capsule.jsx` is a bare styled `<span>`
 * with no width clamp (`w-fit` / `shrink-0` would change how the chip behaves
 * in the DS's own wrapping demo row) and no icon slot — `capsule.card.html`
 * renders four text-only chips and §6.4 documents the content as
 * `{{ capsuleLabel }}` alone, so an `[&_svg]` sizing rule (as in `badge.tsx` /
 * `button.tsx`, whose DS components *do* ship glyphs) has nothing to size here.
 * A caller that does put a glyph in the 8px gap sizes it itself
 * (`<Icon size={14} />`), which is also the only way to avoid a rem-relative
 * `size-*` length that no DS token backs.
 *
 * Token notes:
 *  · 13px (`sm`) has no token in `src/styles/tokens.css` — the caption ladder is
 *    14 / 13.5 / 12.5 — and stays literal, as in `badge.tsx`. It is *not* an
 *    inherently token-less value: `docs/UI_PORT/TOKENS.md` §F19 (line 1763)
 *    proposes it as its own step, `text-3xs`, with 21 occurrences across the
 *    four screen families. The fix is a 13px caption token in `tokens.css`,
 *    which this file cannot add; until then every 13px in the port is literal.
 *  · The two heights come from the spacing ladder (`--space-14` = 30px,
 *    `--space-15` = 34px) because the "Control sizes" block in `tokens.css`
 *    (36 / 44 / 50 / 56 / 60px) has no 30 or 34 step. `summary-pill.tsx`, the
 *    closest analogue, uses `--size-button-*` for exactly this reason. The
 *    coupling here is coincidental — 30/34 merely happen to sit on the spacing
 *    scale — so a chip resize belongs in a new control token, not in a shifted
 *    spacing step.
 *  · `font-(--weight-medium)` rather than `font-medium`: the `@theme inline`
 *    block in `tokens.css` maps the colour, font-family, radius, shadow, ease,
 *    duration and animation namespaces onto DS tokens but not
 *    `--font-weight-*`, so `font-medium` would resolve to Tailwind's own
 *    default 500 rather than to the DS `--weight-medium`. Same latent issue in
 *    `badge.tsx` (`font-semibold`); the repo-wide fix is a
 *    `--font-weight-*: var(--weight-*)` mapping in the theme block.
 *
 * Reduced motion needs no handling here: `tokens.css` collapses every
 * animation globally under `prefers-reduced-motion: reduce`, and the
 * prototype's reduced-motion branch skips the flight at the stage level.
 *
 * **The flight is not part of this atom.** The stage owns it (§4.3: clone the
 * node into `<main>`, `Element.animate` it onto `[data-fact-row="<id>"]` over
 * 580 ms). What this component contributes are the handles that FLIP needs:
 *   · `flight` → `data-capsule="1"` — the prototype's *singleton* selector
 *     (`mainRef.current.querySelector('[data-capsule]')`, SCOUT_STATE.md §1.2 /
 *     §7.5). It is **opt-in**: the stage sets it on the one live chip, so a
 *     screen that shows several capsules at once (the DS demo row renders four)
 *     cannot make `flyCapsule` clone the wrong one. Stamping it on every
 *     instance would make the selector match the first chip in the DOM.
 *   · `data-slot="capsule"` / `data-size` — shadcn-style styling and test
 *     hooks. They are **not** flight-safe: §4.3 / SCOUT_STATE.md §7.5 strip
 *     only `data-capsule` from the clone, so for the ~580 ms of the flight both
 *     attributes match two nodes (original + absolutely positioned clone).
 *     Query `[data-capsule]` when you need the live chip.
 *   · `ref` — React 19 ref-as-prop, so the caller can hold the node it measures
 *     and clones without a DOM query.
 * The fade-in comes from a class, so a clone still carries it; setting
 * `clone.style.animation = "none"` (what `flyCapsule` does) wins over the
 * utility, and the FLIP transform stays uncontested.
 *
 * **Accessibility is the stage's, and this atom ships none of it.** The chip
 * mounts, lives ~650 ms and is removed, which is silent for assistive tech, and
 * a bare `role="status"` here would fire on every capsule in a list. The
 * prototype's own pattern is a sibling live region — `<p data-status="1"
 * aria-live="polite">` (SCOUT_SCREENS.md §8.1) — and the stage should announce
 * the understood fact there, or pass `role="status"` through `...props` on the
 * single chip it renders. Two further duties the DS clone contract omits:
 * the clone must get `aria-hidden="true"` (§4.3 lists `animation:none`,
 * `data-capsule` removed, `position:absolute`, `margin:0`, `zIndex:20`,
 * `pointerEvents:none`, `willChange:transform` — not this), otherwise the same
 * German label sits twice inside `<main>` for the length of the flight; and the
 * fact row that fades in behind it (§4.3 step 3) needs its own announcement.
 */
const capsuleVariants = cva(
  [
    "inline-flex items-center",
    "gap-[var(--space-3)] rounded-pill whitespace-nowrap",
    "border border-rs-border-accent bg-rs-surface-accent-tint",
    "font-sans font-(--weight-medium) text-rs-orange-tint",
    "animate-rs-fade-up",
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
    // Load-bearing for consumers that call `capsuleVariants()` directly on a
    // node they own; the `size = "md"` default in the component signature is
    // what feeds `data-size`.
    defaultVariants: {
      size: "md",
    },
  }
)

/** The DS sizes, derived from the cva config so the two cannot drift. */
type CapsuleSize = NonNullable<VariantProps<typeof capsuleVariants>["size"]>

type CapsuleProps = React.ComponentProps<"span"> & {
  /** 30px / 34px; `md` is the DS default. */
  size?: CapsuleSize
  /** Render as the single child element (shadcn Slot). */
  asChild?: boolean
  /**
   * Mark this chip as the one the stage flies into the fact list — stamps the
   * prototype's `data-capsule="1"`. Exactly one mounted capsule may set it.
   */
  flight?: boolean
}

function Capsule({
  className,
  size = "md",
  asChild = false,
  flight = false,
  ...props
}: CapsuleProps) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="capsule"
      data-size={size}
      data-capsule={flight ? "1" : undefined}
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
export type { CapsuleProps, CapsuleSize }
