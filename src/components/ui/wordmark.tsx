import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * Wordmark — the lowercase „roomscout" brand mark.
 *
 * DS reference: `design-system/components/core/wordmark/`
 * (`Wordmark.jsx`, `Wordmark.d.ts`, `Wordmark.prompt.md`, `wordmark.card.html`).
 * Cross-surface catalogue: `docs/UI_PORT/COMPONENT_MAP.md` §A1 (R header,
 * O header, L header, L footer).
 *
 * This is the canonical text mark. Navigation composes it with the existing
 * cube logo through `BrandLockup`; non-navigation uses may keep it on its own.
 *
 * Fixed for every instance, verbatim from `Wordmark.jsx:5`:
 * `--font-sans` · `--text-wordmark-weight` (500) ·
 * `--text-wordmark-tracking` (.04em) · `line-height: 1` ·
 * `text-decoration: none` · ink `--rs-ink`.
 *
 * ## Sizes
 * A free number, not a scale — the DS ships four (`COMPONENT_MAP.md` §A1,
 * `SCOUT_SCREENS.md` §2.4 `markSize`, `LANDING_SCREENS.md` §3):
 *   `default` 20 — R/O header (the only one with a token,
 *                  `--text-wordmark-size`; omit `size` to get it)
 *   `md` 19 — L header  ·  `sm` 17 — R narrow header + L footer
 *   `xl` 34 — DS card demo (`wordmark.card.html:10`)
 * Only 20 has a token, so the other three live in `WORDMARK_SIZES` here rather
 * than at every call site; `size` still accepts a raw number as an escape
 * hatch (`Wordmark.d.ts:8`), and lands as an inline `font-size` that simply
 * overrides the token — `<Wordmark />`, `<Wordmark size="default" />` and
 * `<Wordmark size={20} />` render identically.
 *
 * ## Ink, hover, and why the colour is inline
 * `src/styles/app.css` still ships its legacy base block **unlayered** —
 * `a { color: var(--signal) }`, `a:hover { color: var(--signal-hover) }`,
 * `a:focus-visible { outline: 2px solid var(--signal); outline-offset: 3px }`.
 * Tailwind emits every utility inside `@layer utilities`, and per CSS Cascade 5
 * an unlayered declaration beats *any* layered one regardless of specificity,
 * so a plain `text-rs-ink` / `hover:text-rs-orange` pair loses: the link
 * variant would rest on RoomScout orange (#ff6926) and hover to the *hover*
 * orange (#ff7a3d) instead of resting on `--rs-ink` and hovering to #ff6926.
 *
 * `!important` is the usual defence here (`breadcrumb.tsx`, `input.tsx`,
 * `textarea.tsx`, `sonner.tsx`), but it would also beat the `color` prop, which
 * is a normal inline declaration. So the ink travels through a component-local
 * custom property instead: the class list sets `--rs-wordmark-ink`, the
 * component writes `color: var(--rs-wordmark-ink)` **inline**, and an inline
 * declaration outranks every unlayered rule. The `link` variant then flips the
 * property on hover, which no legacy rule touches.
 *
 * That reproduces the landing mechanic exactly (`LANDING_SCREENS.md` §3.1,
 * `COMPONENT_MAP.md` §A1): with no `color`, the mark rests on `--rs-ink` and
 * hovers to `--rs-orange` — the header wordmark is the one anchor on Landing
 * that has a hover at all. Pass `color` and it is written inline verbatim,
 * which kills the hover, exactly as every other landing anchor's inline colour
 * does. There is no transition: the source stylesheet declares none and
 * `Wordmark.jsx` sets none, so the hover snaps.
 *
 * When the legacy block moves into `@layer base`, the `!` on the focus ring
 * below can go and the ink could move back into a plain `text-rs-ink`.
 *
 * ## Elements
 * `href` renders an `<a>` (and defaults `link` to `true`); `as`
 * (`div` default, `span`, `h1`) picks the static element, matching
 * `Wordmark.jsx:7-8`. `asChild` renders into a caller-supplied element — the
 * app header wordmark is a react-router `<Link>` (`DATA_MAP.md`:960), which a
 * bare `href` would turn into a full document reload. The `link` variant is
 * also exposed as a prop, so an `asChild` `<Link>` opts into the hover and
 * focus ring with `<Wordmark asChild link>`.
 *
 * **Accessible name.** A wordmark that navigates home needs one: the visible
 * text is just „roomscout". The app's own header passes
 * `aria-label="RoomScout home"` (`APP_UI_INVENTORY.md`:155, `DATA_MAP.md`:960)
 * and the port must keep doing so — it is not defaulted here because the
 * Landing header's `href="#top"` is an in-page jump, not a home link, and
 * carries no label in the source.
 *
 * ## Deliberate deviations from `Wordmark.jsx` (Δ, per COMPONENT_MAP §8.2)
 *  · **Hover.** `Wordmark.jsx:4` defaults `color` to `'var(--rs-ink)'` and
 *    always writes it inline, so the DS *component* can never pick up
 *    `a:hover` — yet the DS *markup* it stands for (`Landing v2.dc.html:35`,
 *    `LANDING_SCREENS.md`:336) omits the colour precisely to get that hover.
 *    This port follows the markup: no `color` → hover; `color` → no hover.
 *  · **`lowercase`.** Not in `Wordmark.jsx:5`. Added so the brand rule
 *    ("Wordmark always lowercase `roomscout`", design-system/readme.md
 *    § Content fundamentals) survives an uppercasing parent.
 *  · **`children` is `never`.** `Wordmark.jsx:6-7` renders the literal string
 *    in both branches and never reads children; the `children` line in
 *    `Wordmark.d.ts:13` is vestigial typing. The mark is never translated and
 *    never substituted (`COMPONENT_MAP.md`:1220), so children are typed away
 *    and an `asChild` child's own children are replaced by the mark.
 *  · **Anchor typing.** `Wordmark.d.ts:6` types both branches as
 *    `HTMLAttributes<HTMLElement>`, which has no `target` / `download` /
 *    `referrerPolicy`. The port discriminates on `href` and widens the link
 *    branch to `AnchorHTMLAttributes`, so the Landing footer's external links
 *    type-check.
 *  · **Named sizes.** An addition; see § Sizes.
 */

const wordmarkVariants = cva(
  [
    "font-sans lowercase no-underline",
    // 20px · 500 · .04em · line-height 1 — the DS wordmark type tokens.
    "text-[length:var(--text-wordmark-size)] font-(--text-wordmark-weight)",
    "tracking-[var(--text-wordmark-tracking)] leading-none",
    // Rest ink. `<Wordmark>` re-reads this property from an inline `color`
    // (see the docblock); the utility is what makes `wordmarkVariants()` usable
    // on a caller's own non-anchor element.
    "[--rs-wordmark-ink:var(--rs-ink)] text-(--rs-wordmark-ink)",
  ].join(" "),
  {
    variants: {
      /** The landing header's hover + the DS focus ring. Defaults to `href !== undefined`. */
      link: {
        true: [
          // #f5ece2 → #ff6926, no transition (LANDING_SCREENS.md §3.1).
          "hover:[--rs-wordmark-ink:var(--rs-orange)]",
          // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
          // `outline-solid` re-arms --tw-outline-style, which `outline-none`
          // clears; `!` beats the legacy unlayered `a:focus-visible` rule that
          // would otherwise pin the offset at 3px.
          "outline-none focus-visible:outline-solid! focus-visible:outline-2!",
          "focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
        ].join(" "),
        false: "",
      },
    },
    defaultVariants: {
      link: false,
    },
  }
)

/** The mark itself. Always lowercase, never translated (COMPONENT_MAP.md §11). */
const WORDMARK_TEXT = "roomscout"

/**
 * The four sizes the DS ships. `default` is `null` because 20px is the
 * `--text-wordmark-size` token — it needs no inline override.
 */
const WORDMARK_SIZES = {
  /** 20px — R/O header, straight from `--text-wordmark-size`. */
  default: null,
  /** 17px — R narrow header + L footer. */
  sm: 17,
  /** 19px — L header. */
  md: 19,
  /** 34px — the DS card demo. */
  xl: 34,
} as const

type WordmarkSize = keyof typeof WORDMARK_SIZES

function resolveFontSize(size: number | WordmarkSize | undefined) {
  if (size === undefined) return undefined
  if (typeof size === "number") return size
  return WORDMARK_SIZES[size] ?? undefined
}

interface WordmarkBaseProps extends VariantProps<typeof wordmarkVariants> {
  /** Named DS step or a raw px number. Omit for the 20px token. */
  size?: number | WordmarkSize
  /**
   * Ink override, e.g. `var(--rs-ink-6)`. Written inline, so — as in the DS —
   * it beats the link hover and the mark stops reacting to the pointer.
   */
  color?: string
  className?: string
  style?: React.CSSProperties
}

interface WordmarkAnchorProps
  extends WordmarkBaseProps,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "color"> {
  /** Render as an `<a>`. Give a home link an `aria-label` (see docblock). */
  href: string
  as?: never
  asChild?: false
  /** The mark is fixed; `roomscout` is never substituted. */
  children?: never
}

interface WordmarkStaticProps
  extends WordmarkBaseProps,
    Omit<React.HTMLAttributes<HTMLElement>, "children" | "color"> {
  href?: never
  as?: "div" | "span" | "h1"
  asChild?: false
  /** The mark is fixed; `roomscout` is never substituted. */
  children?: never
}

interface WordmarkSlotProps
  extends WordmarkBaseProps,
    Omit<React.HTMLAttributes<HTMLElement>, "children" | "color"> {
  href?: never
  as?: never
  /** Render into `children` — e.g. a react-router `<Link>`. */
  asChild: true
  /** A single element. Its own children are replaced by the mark. */
  children: React.ReactElement
}

type WordmarkProps =
  | WordmarkAnchorProps
  | WordmarkStaticProps
  | WordmarkSlotProps

function Wordmark({
  className,
  style,
  size,
  color,
  href,
  as = "div",
  asChild,
  link,
  children,
  ...props
}: WordmarkProps) {
  // The union's rest is only ever spread onto a host element; every member
  // narrows to plain HTML attributes at that point.
  const rest = props as React.HTMLAttributes<HTMLElement>
  const isLink = link ?? href !== undefined
  const classes = cn(wordmarkVariants({ link: isLink }), className)
  // `size` / `color` are per-instance overrides, so they precede the caller's
  // own `style` — a call site passing both stays in control. The `color`
  // fallback is the custom property the class list sets: inline is the only
  // place a colour outranks app.css's unlayered `a { color: … }`.
  const inlineStyle: React.CSSProperties = {
    fontSize: resolveFontSize(size),
    color: color ?? "var(--rs-wordmark-ink)",
    ...style,
  }

  if (asChild) {
    return (
      <Slot.Root
        data-slot="wordmark"
        className={classes}
        style={inlineStyle}
        {...rest}
      >
        {React.cloneElement(
          React.Children.only(children),
          undefined,
          WORDMARK_TEXT
        )}
      </Slot.Root>
    )
  }

  if (href !== undefined) {
    return (
      <a
        data-slot="wordmark"
        href={href}
        className={classes}
        style={inlineStyle}
        {...rest}
      >
        {WORDMARK_TEXT}
      </a>
    )
  }

  const Comp: React.ElementType = as

  return (
    <Comp
      data-slot="wordmark"
      className={classes}
      style={inlineStyle}
      {...rest}
    >
      {WORDMARK_TEXT}
    </Comp>
  )
}

// `wordmarkVariants` is part of the shadcn public API (a header can put the
// wordmark type on an existing element instead of rendering a <Wordmark>);
// the cva() call is not a plain constant, so the react-refresh rule cannot see
// it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Wordmark, wordmarkVariants }
export type { WordmarkProps, WordmarkSize }
