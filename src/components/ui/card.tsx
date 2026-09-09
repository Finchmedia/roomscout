import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
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
 *  · `md`'s 20px radius and `2xl`'s 32px block padding have no token in
 *    src/styles/tokens.css (the radius ladder jumps 18 → 22, the spacing one
 *    30 → 34); both stay literal — `rounded-[20px]` and `py-[32px]`. The
 *    Tailwind rem step (`py-8`) is deliberately *not* used: every other padding
 *    here is an absolute px token, and `py-8` would rescale the block padding
 *    against the root font size while the 34px inline padding stayed put.
 *    Every other radius and padding step is a `--radius-*` utility or a
 *    `--space-*` token.
 *  · Tones other than `panel` reset the shadow (`shadow-none`), because
 *    `Card.jsx:12` sets `boxShadow: tone === 'panel' ? … : 'none'` — an
 *    explicit reset that matters as soon as `cardVariants()` is composed onto
 *    an element that already carries a shadow (a Radix content part, a legacy
 *    `.panel` rule). A caller `className` shadow still wins: it is merged last,
 *    so `cn()`'s tailwind-merge drops the reset.
 *  · The DS `rust` border is the raw literal rgba(255,140,90,.22), which has no
 *    token — per `docs/UI_PORT/TOKENS.md` §F10 („.22/.30 read identical to
 *    .35“, canonical: **.35 default accent**) it folds onto
 *    `--rs-border-accent-soft`. That is the same call `notice.tsx` makes for the
 *    identical hairline on its `accent` tone, so the two render alike. The
 *    `accent` tone keeps `--rs-border-accent-faint` (.30) because `Card.jsx:10`
 *    names *that token*, not a literal — the fold applies to literals only.
 *  · Easing is a deliberate upgrade: `Card.jsx` writes the shorthand
 *    `transition: transform .3s`, i.e. the CSS default `ease`. The port keeps
 *    the duration (`--duration-base` = .3s) and eases with `ease-out-soft`
 *    (cubic-bezier(.22,.8,.2,1)) — `TOKENS.md` §C6 calls it „the signature
 *    stage/landing easing“ (21 uses) and it is what every hover in this folder
 *    uses (see `dropdown-menu.tsx`, `icon-button.tsx`, `radio-card.tsx`).
 *  · `hoverLift` is the landing bento lift (translateY(-3px)). The DS drives it
 *    from JS mouse state (`onMouseEnter`); here it is a CSS `:hover`, which
 *    costs no render but is *narrower*: Tailwind v4 wraps `hover:` in
 *    `@media (hover: hover)`, so a touch tap no longer lifts, and `:hover`
 *    never fires from the keyboard. Since `hoverLift` marks the card as
 *    interactive, the lift is mirrored on `focus-visible:`. Under
 *    `prefers-reduced-motion` the global rule in tokens.css only collapses the
 *    *duration*, leaving a 3px snap, so both states are pinned to
 *    `translate-y-0` there.
 *  · Focus ring on the base, not only on `hoverLift`: a card is made
 *    interactive by the consumer (`tabIndex` + `onClick`, `asChild` onto a
 *    `<button>`/`<a>`), and the app's global rule in `src/styles/app.css`
 *    matches `button/a/input/select/textarea` only — a focusable `<div>` would
 *    get nothing. The declaration is the layer's shared DS ring (TOKENS.md
 *    §F17: 2px solid `--rs-orange`, 2px offset), identical to `badge.tsx`.
 *  · `padding` overrides the size padding inline; a caller `style.padding`
 *    still wins over it, exactly as in `Card.jsx`.
 *  · **No sub-parts, on purpose.** The DS Card has no `CardHeader` /
 *    `CardTitle` / `CardDescription` / `CardContent` / `CardFooter` /
 *    `CardAction`, so neither has this file — `LANDING_SCREENS.md:789` requires
 *    the bento title/subtitle to stay plain `<div>`s so the document outline
 *    survives; the DS substitute for a header is `<Overline>` plus plain divs.
 *    An upstream shadcn block that imports those parts will therefore fail to
 *    compile against this module: map it onto `Card` + `Overline` + divs rather
 *    than adding the parts back.
 *  · Props base type: `React.ComponentProps<"div">` (the shadcn v4 shape, as in
 *    `badge.tsx` / `button.tsx`) where `Card.d.ts` declares
 *    `React.HTMLAttributes<HTMLDivElement>`. The difference is `ref` (React 19
 *    ref-as-prop, forwarded through `...props`) and `key`; the DS `.d.ts` has no
 *    ref because its JSX runtime predates it.
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
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md §F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2",
    "focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
  ].join(" "),
  {
    variants: {
      size: {
        /** DS sm — 16px radius, 14/18 padding. */
        sm: "rounded-card px-[var(--space-8)] py-[var(--space-6)]",
        /** DS md — 20px is not on the DS radius ladder (…18, 22…), kept literal. */
        md: "rounded-[20px] px-[var(--space-12)] py-[var(--space-11)]",
        /** DS lg — 22px radius, 34/36/30 padding. */
        lg: "rounded-card-lg px-[var(--space-16)] pt-[var(--space-15)] pb-[var(--space-14)]",
        /** DS xl — 24px radius, 28/36/30 padding. */
        xl: "rounded-card-xl px-[var(--space-16)] pt-[var(--space-13)] pb-[var(--space-14)]",
        /** DS 2xl — the landing bento; 32px has no spacing token, kept literal. */
        "2xl": "rounded-card-2xl px-[var(--space-15)] py-[32px]",
        /** DS panel — the settings / operator shell, no padding of its own. */
        panel: "rounded-panel p-0",
      },
      tone: {
        default: "border-rs-border-card bg-rs-surface-card shadow-none",
        soft: "border-rs-border-card bg-rs-surface-card-soft shadow-none",
        faint: "border-rs-border-card-soft bg-rs-surface-card-faint shadow-none",
        /** accent — default surface, warm orange hairline („Freigabe nötig“). */
        accent: "border-rs-border-accent-faint bg-rs-surface-card shadow-none",
        warning: "border-rs-border-amber bg-rs-surface-amber-tint shadow-none",
        inset: "border-rs-border-card bg-rs-surface-inset shadow-none",
        /** panel — the settings / operator shell; the only card with a shadow. */
        panel: "border-rs-border-panel bg-rs-surface-panel shadow-panel",
        /** rust — the warm lock notice; .22 hairline folded onto the .35 step. */
        rust: "border-rs-border-accent-soft bg-rs-rust-faint shadow-none",
      },
      hoverLift: {
        true: [
          "hover:-translate-y-[3px] focus-visible:-translate-y-[3px]",
          "motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0",
        ].join(" "),
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

type CardProps = React.ComponentProps<"div"> &
  VariantProps<typeof cardVariants> & {
    /** Override padding (CSS string or number). */
    padding?: string | number
    /** Render as the single child element (shadcn Slot). */
    asChild?: boolean
  }

function Card({
  className,
  size,
  tone,
  hoverLift = false,
  padding,
  style,
  asChild = false,
  ...props
}: CardProps) {
  const Comp = asChild ? Slot.Root : "div"
  const resolvedSize = size ?? "md"
  const resolvedTone = tone ?? "default"

  return (
    <Comp
      data-slot="card"
      data-size={resolvedSize}
      data-tone={resolvedTone}
      className={cn(
        cardVariants({ size: resolvedSize, tone: resolvedTone, hoverLift }),
        className
      )}
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
