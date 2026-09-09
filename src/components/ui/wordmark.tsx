import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Wordmark — the lowercase „roomscout" brand mark.
 *
 * DS reference: `design-system/components/core/wordmark/`
 * (`Wordmark.jsx`, `Wordmark.d.ts`, `Wordmark.prompt.md`, `wordmark.card.html`).
 * Cross-surface catalogue: `docs/UI_PORT/COMPONENT_MAP.md` §A1 (R header,
 * O header, L header, L footer).
 *
 * It is the *only* brand mark in the product UI — never paired with the cube
 * logo (`assets/logo-roomscout.png`), which appears solely as the roomscout.dev
 * source avatar (design-system/readme.md § Iconography).
 *
 * Fixed for every instance, verbatim from `Wordmark.jsx:6`:
 * `--font-sans` · weight 500 (`--text-wordmark-weight`, Tailwind `font-medium`)
 * · tracking `--text-wordmark-tracking` (.04em) · `line-height: 1` ·
 * `text-decoration: none` · ink `--rs-ink`.
 *
 * Sizes are a free number, not a scale — the DS ships four (`COMPONENT_MAP.md`
 * §A1, `SCOUT_SCREENS.md` §2.4 `markSize`, `LANDING_SCREENS.md` §3):
 *   20 — R/O header (the default, and the only one with a token:
 *        `--text-wordmark-size`; omit `size` to get it)
 *   19 — L header  ·  17 — R narrow header + L footer  ·  34 — DS card demo
 * `size` therefore lands as an inline `font-size` and simply overrides the
 * token; `<Wordmark />` and `<Wordmark size={20} />` render identically.
 *
 * `href` switches the element to an `<a>` and is the only variant here, because
 * the landing header wordmark is the one anchor on that page that inherits
 * `a{color:#f5ece2} a:hover{color:#ff6926}` — every other link sets `color`
 * inline and so has no hover at all (`LANDING_SCREENS.md` §3.1). That
 * inline-beats-`:hover` mechanic is reproduced exactly: the hover ink lives in
 * a class, and passing `color` writes an inline style that wins over it, just
 * as it does in the source. The R and O headers pass no `href` — there the
 * wordmark is static text, "not a link, no click handler"
 * (`SCOUT_SCREENS.md` §2.4).
 *
 * `as` (`div` default, `span`, `h1`) is ignored while `href` is set, matching
 * `Wordmark.jsx:8-9`. `lowercase` is added on top of the DS style object so the
 * brand rule ("Wordmark always lowercase `roomscout`", design-system/readme.md
 * § Content fundamentals) survives an uppercasing parent.
 */
const wordmarkVariants = cva(
  [
    "font-sans lowercase no-underline",
    // 20px · 500 · .04em · line-height 1 — the DS wordmark type tokens.
    "text-[length:var(--text-wordmark-size)] font-medium",
    "tracking-[var(--text-wordmark-tracking)] leading-none",
    "text-rs-ink",
  ].join(" "),
  {
    variants: {
      /** Rendered as an `<a>`: the landing header's hover + a DS focus ring. */
      link: {
        true: [
          "transition-colors duration-[var(--duration-quick)] ease-out-soft",
          "hover:text-rs-orange",
          // DS focus ring: 2px solid orange, 2px offset (TOKENS.md §F17).
          "outline-none focus-visible:outline-2",
          "focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
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

interface WordmarkProps extends React.HTMLAttributes<HTMLElement> {
  /** Font size in px (20 header, 19 landing, 17 narrow/footer). Omit for the 20px token. */
  size?: number
  /** Ink override, e.g. `var(--rs-ink-6)`. Inline, so it beats the link hover — as in the DS. */
  color?: string
  /** Render as a link. */
  href?: string
  as?: "div" | "span" | "h1"
  children?: React.ReactNode
  style?: React.CSSProperties
}

function Wordmark({
  className,
  style,
  size,
  color,
  href,
  as = "div",
  children,
  ...props
}: WordmarkProps) {
  const isLink = href !== undefined
  const content = children ?? WORDMARK_TEXT
  // `size` / `color` are per-instance overrides, so they precede the caller's
  // own `style` — a call site passing both stays in control.
  const inlineStyle: React.CSSProperties = { fontSize: size, color, ...style }

  if (isLink) {
    return (
      <a
        data-slot="wordmark"
        href={href}
        className={cn(wordmarkVariants({ link: true }), className)}
        style={inlineStyle}
        {...props}
      >
        {content}
      </a>
    )
  }

  const Comp: React.ElementType = as

  return (
    <Comp
      data-slot="wordmark"
      className={cn(wordmarkVariants({ link: false }), className)}
      style={inlineStyle}
      {...props}
    >
      {content}
    </Comp>
  )
}

// `wordmarkVariants` is part of the shadcn public API (a header can put the
// wordmark type on an existing element instead of rendering a <Wordmark>);
// the cva() call is not a plain constant, so the react-refresh rule cannot see
// it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Wordmark, wordmarkVariants }
export type { WordmarkProps }
