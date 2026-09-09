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
 * The variant set is **exactly** the four names `Badge.d.ts` declares
 * (`'solid' | 'outline' | 'muted' | 'pill'`), with the geometry verbatim from
 * `Badge.jsx` — padding / radius / font-size / weight / tracking:
 *   `solid`   5px 11px · pill · 12.5px · 600 · .04em — orange, white ink
 *             („Mein Vorschlag“) — and the default, as in `Badge.jsx:4`
 *   `outline` 5px 10px · chip 8 · 12px · 600 · .12em · uppercase — accent
 *             hairline, `--rs-orange-light` ink („INTERN“)
 *   `muted`   4px 10px · pill · 13px — neutral panel hairline, `--rs-ink-6`
 *             („In dieser Demo nicht aktiv“)
 *   `pill`    h 38 · 0 18px · pill · 14.5px — accent hairline, body ink
 *             („Euer persönlicher Proberaum-Scout“)
 *
 * `Badge.jsx` sets `font-weight` on `solid` and `outline` only — `muted` and
 * `pill` deliberately **inherit** the surrounding weight (a muted badge dropped
 * into a 17px/500 settings row renders at 500), so neither pins one here.
 *
 * The shadcn *module* API is preserved — `asChild`, `badgeVariants`,
 * `data-slot="badge"`, `className` merging — but the shadcn *variant names* are
 * not: `default` / `secondary` / `destructive` (and the earlier home-grown
 * `ghost` / `link`, which exist in neither the DS nor upstream shadcn) are
 * gone. The DS owns this name space, and an alias makes the same badge emit two
 * different `data-variant` values depending on which spelling the call site
 * used, so `[data-variant="solid"]` selectors and assertions silently miss.
 * An installed shadcn block asking for `variant="default"` therefore fails to
 * typecheck — loudly, which is the point; map it to `solid` at the call site
 * (`secondary` → `muted`).
 *
 * **Escape hatch.** Two badge-shaped recipes the port screens need are *not* DS
 * Badge variants and must not become ones: the Settings T3 KnowledgeRow
 * accent-tint *filled* pill (`COMPONENT_MAP.md` T3 — `--rs-border-accent` +
 * `--rs-surface-accent-tint-soft` + `--rs-orange-tint`, 3px/10px) and the
 * Landing hero corner badge „Beispielansicht“ (`COMPONENT_MAP.md` D2, which
 * says in as many words to build it separately). Pass `className` for a one-off;
 * give them their own component under `src/ui/` once they recur.
 *
 * **Deliberate deviations** (do not "fix" without a token first):
 *  · The `outline` and `pill` accent hairlines use `--rs-border-accent` (.50);
 *    `Badge.jsx:7`/`:9` specify .60 and .55, which `docs/UI_PORT/TOKENS.md` §F10
 *    canonicalises to .50 (".40–.55 read identical to .50" and, for the Operator
 *    INTERN badge specifically, "fold into .50"). `COMPONENT_MAP.md` U1/D2 still
 *    quote the raw .60/.55; the fold follows TOKENS.md, which is the ruling
 *    document for the alpha ladders.
 *  · No `:hover` and no `transition`: `Badge.jsx` is a plain styled `<span>`
 *    with neither — including when `asChild` renders it as an anchor.
 *  · No `aria-invalid:` hooks (upstream shadcn has them): the DS has no invalid
 *    state for a badge and its `ring-destructive/20` has no DS token — the same
 *    call `button.tsx` makes.
 *  · `justify-center` is upstream shadcn's, not the DS base (`Badge.jsx:11` sets
 *    only `inline-flex` + `align-items:center`); it is inert at `w-fit` and
 *    bites only when a call site adds a width.
 *  · The icon selectors are the descendant form used by `button.tsx`,
 *    `capsule.tsx`, `icon-button.tsx` and `dropdown-menu.tsx` rather than
 *    upstream's `[&>svg]` child combinator — an icon wrapped in a span still
 *    gets sized, and `[class*='size-']` on the svg opts out (see the note in
 *    `accordion.tsx`).
 *  · shadcn's `overflow-hidden` is dropped: the Scout live badge puts a glowing
 *    dot inside a badge, and the glow must not be clipped.
 *
 * Token notes:
 *  · 12.5px is `--text-micro-size`; 12px / 13px / 14.5px and the 5px / 11px /
 *    38px steps have no token in `src/styles/tokens.css` (the type scale runs
 *    12.5/13.5/14/15/16/17/19…, the spacing scale 4/6/8/10/12/14/16/18…) and
 *    stay literal until one is added.
 *  · `tracking-[.12em]` is *not* `--text-overline-tracking` (.14em) — the DS
 *    outline badge is a hair tighter than an overline. Do not "unify" them.
 *  · `tracking-[.04em]` numerically equals `--text-wordmark-tracking`, but that
 *    token is semantically the wordmark; reusing it here would be wrong.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center",
    "gap-[var(--space-3)] font-sans whitespace-nowrap",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md §F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2",
    "focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        /** DS solid — the orange label pill („Mein Vorschlag“). */
        solid:
          "rounded-pill bg-rs-orange px-[11px] py-[5px] text-[length:var(--text-micro-size)] font-semibold tracking-[.04em] text-rs-white",
        /** DS outline — uppercase accent chip, the only 8px-radius badge. */
        outline:
          "rounded-chip border border-rs-border-accent px-[var(--space-4)] py-[5px] text-[12px] font-semibold tracking-[.12em] text-rs-orange-light uppercase",
        /** DS muted — neutral outline pill, quiet caption ink, inherited weight. */
        muted:
          "rounded-pill border border-rs-border-panel px-[var(--space-4)] py-[var(--space-1)] text-[13px] text-rs-ink-6",
        /** DS pill — the 38px hero / header capsule, inherited weight. */
        pill: "h-[38px] rounded-pill border border-rs-border-accent px-[var(--space-8)] text-[14.5px] text-rs-ink",
      },
    },
    defaultVariants: {
      variant: "solid",
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
  variant = "solid",
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
