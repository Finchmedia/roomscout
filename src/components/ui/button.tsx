import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

/**
 * RoomScout pill button — shadcn primitive restyled to the design-system spec.
 *
 * DS reference: `design-system/components/core/button/`
 * (`Button.jsx`, `Button.d.ts`, `Button.prompt.md`, `button.card.html`).
 *
 * DS rule: one action per screen — a single orange `primary` pill, everything
 * else quieter. `tint` is the answer-suggestion chip, `link` the underlined
 * text button.
 *
 * The shadcn API is preserved: `asChild`, `buttonVariants`, `data-slot`, and
 * the `default` / `destructive` / `outline` variants plus the
 * `default` / `sm` / `lg` / `icon*` sizes still resolve — `default` is an alias
 * of `primary`, size `default` an alias of DS `base`. The aliases are resolved
 * to their DS name before `data-variant` / `data-size` are written, so a
 * selector or test written against the DS vocabulary (`[data-variant=primary]`)
 * matches every button that looks like a primary.
 *
 * Geometry (height / horizontal padding / font-size), verbatim from Button.jsx:
 * `lg` 60/34/19 · `md` 56/32/17 · `base` 50/24/16 · `sm` 46/22/15 ·
 * `xs` 44/20/15 · `2xs` 36/14/13.5.
 *
 * **Accessible name.** `icon` is decorative: it is rendered inside an
 * `aria-hidden` wrapper so an icon carrying a `<title>` (or an emoji passed as
 * `icon`) is not concatenated into the button's name. The `icon` / `icon-xs` /
 * `icon-sm` / `icon-lg` sizes render a bare glyph and therefore REQUIRE an
 * `aria-label` (or an `sr-only` child); prefer `IconButton`, whose `label`
 * prop makes that impossible to forget.
 *
 * **Disabled.** Both `disabled` and `aria-disabled` / `data-disabled` get the
 * DS's `.5` opacity and default cursor, so the `aria-disabled` form documented
 * on `Tooltip` (a disabled-looking control that still receives pointer and
 * focus events, so the explaining tooltip can open) looks disabled too. Only
 * the native `disabled` form gets `pointer-events-none` — adding it to
 * `aria-disabled` would break exactly that tooltip contract.
 *
 * **Deliberate deviations** (do not "fix" without a token first):
 *  · `secondary` rests on `--rs-surface-subtle-2` (white .06); Button.jsx:14
 *    specifies white .05, for which no token exists.
 *  · `tint` rests on `--rs-surface-accent-tint` (orange .16, TOKENS.md's *chip*
 *    fill); Button.jsx:15 specifies the orange .14 outline-button fill
 *    (TOKENS.md:220 / B3), for which no token exists.
 *  · `tint`'s border uses `--rs-border-accent` (accent .50); Button.jsx:15
 *    specifies .45, which TOKENS.md F10 explicitly canonicalises to .50.
 *  · `link`'s underline uses `--rs-border-control-strong` (warm white .30);
 *    TOKENS.md F7 canonicalises the neutral text-button underline at warm white
 *    .35 and TOKENS.md:2036 names a dedicated `--rs-underline` token that
 *    tokens.css does not yet define.
 *  · The auto icon sizes below are an addition — Button.jsx sizes no icon; the
 *    DS passes an explicit `size` at the call site (Button.prompt.md).
 *  · No `aria-invalid:` hooks (upstream shadcn has them): the DS has no invalid
 *    state for a button, and inventing one would need off-spec colours.
 *  · No default `type="button"`: neither Button.jsx nor upstream shadcn sets
 *    one, so a `<Button>` inside a `<form>` submits unless the call site says
 *    `type="button"`.
 */

/** primary — the one orange CTA; 600 weight, white ink, hover --rs-orange-hover. */
const PRIMARY =
  "rounded-pill bg-rs-orange text-rs-white font-semibold hover:bg-rs-orange-hover"
/** danger — destructive red pill (Beenden / Abbrechen). */
const DANGER =
  "rounded-pill bg-rs-red text-rs-white font-semibold hover:bg-rs-red-hover"
/** secondary — outlined translucent pill, 500 weight. */
const SECONDARY =
  "rounded-pill border border-rs-border-control-strong bg-rs-surface-subtle-2 text-rs-ink font-medium hover:bg-rs-surface-hover"
/**
 * The ink half of the two text buttons — 400 weight, ink lightens to white on
 * hover. The radius is NOT shared: Button.jsx overrides `borderRadius` to 8
 * for `ghost` only (line 16), while `link` (line 17) keeps the base pill.
 */
const TEXT_BUTTON_INK =
  "bg-transparent text-rs-ink-3 font-normal hover:text-rs-white"

const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center",
    "gap-[var(--space-5)] font-sans whitespace-nowrap",
    // Button.jsx:11 transitions `background`, `color` and `transform` at .2s on
    // the CSS default easing — nothing else moves (border and box-shadow are
    // static per variant/size). `translate` stands in for the spec's
    // `transform`: Tailwind v4 emits the standalone `translate` property for
    // -translate-y-px, which a `transform`-only list would not animate.
    "transition-[background-color,color,translate]",
    "duration-[var(--duration-quick)] ease-[ease]",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears —
    // without it `focus-visible:outline-2` resolves to `outline-style:none` and
    // the ring never paints.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    // Button.jsx:11 dims by opacity and drops the pointer cursor from the
    // `disabled` prop, so the look must not depend on the `:disabled`
    // pseudo-class — that never matches an <a>/<div> rendered through asChild.
    "disabled:pointer-events-none disabled:cursor-default disabled:opacity-50",
    "aria-disabled:cursor-default aria-disabled:opacity-50",
    "data-disabled:cursor-default data-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: PRIMARY,
        /** shadcn alias — `default` is the DS primary. */
        default: PRIMARY,
        secondary: SECONDARY,
        /** shadcn alias — the DS has no separate outline treatment. */
        outline: SECONDARY,
        /** tint — orange-tinted answer chip, warm ink. */
        tint: "rounded-pill border border-rs-border-accent bg-rs-surface-accent-tint text-rs-orange-tint-2 font-medium hover:bg-rs-surface-accent-tint-hover",
        /** ghost — bare text button; the only variant with an 8px radius. */
        ghost: `rounded-chip ${TEXT_BUTTON_INK}`,
        /** link — bare text button, pill radius, warm 4px-offset underline. */
        link: `rounded-pill ${TEXT_BUTTON_INK} underline underline-offset-4 decoration-rs-border-control-strong`,
        danger: DANGER,
        /** shadcn alias — `destructive` is the DS danger. */
        destructive: DANGER,
      },
      size: {
        lg: "h-[var(--size-button-lg)] px-[var(--space-15)] text-[length:var(--text-lead-size)] [&_svg:not([class*='size-'])]:size-5",
        // 32px has no spacing token (the scale jumps 30 → 34). A literal is
        // used rather than `px-8`, which is rem-derived and only equals 32px
        // while the root font-size is exactly 16px.
        md: "h-[var(--size-button)] px-[32px] text-[length:var(--text-body-lg-size)] [&_svg:not([class*='size-'])]:size-5",
        base: "h-[var(--size-button-md)] px-[var(--space-11)] text-[length:var(--text-body-size)] [&_svg:not([class*='size-'])]:size-5",
        /** shadcn alias — size `default` is the DS base (50px). */
        default:
          "h-[var(--size-button-md)] px-[var(--space-11)] text-[length:var(--text-body-size)] [&_svg:not([class*='size-'])]:size-5",
        sm: "h-[var(--size-button-sm)] px-[var(--space-10)] text-[length:var(--text-body-sm-size)] [&_svg:not([class*='size-'])]:size-[18px]",
        xs: "h-[var(--size-button-xs)] px-[var(--space-9)] text-[length:var(--text-body-sm-size)] [&_svg:not([class*='size-'])]:size-[18px]",
        "2xs":
          "h-[var(--size-button-2xs)] px-[var(--space-6)] text-[length:var(--text-caption-sm-size)] [&_svg:not([class*='size-'])]:size-4",
        // Square icon buttons — shadcn geometry, kept so blocks (SidebarTrigger,
        // DialogClose) keep working; `icon` lands on the DS 36px control size.
        // The three shadcn steps stay rem-derived on purpose: they exist for
        // upstream blocks, not for DS screens, which use `IconButton` (42/44/46
        // px control tokens) instead. All four require an `aria-label`.
        icon: "size-[var(--size-button-2xs)] [&_svg:not([class*='size-'])]:size-4",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-10 [&_svg:not([class*='size-'])]:size-5",
      },
      /** DS `block`: full-width action (welcome CTA, card footer). */
      block: {
        true: "flex w-full",
        false: "",
      },
    },
    // compoundVariants are emitted after the plain variants, so these win the
    // tailwind-merge pass regardless of how the size/variant classes order.
    compoundVariants: [
      {
        // ghost + link ignore the size ladder's box: height auto, 8/12 padding
        // (Button.jsx:16,17). Icon sizes are excluded so square icon buttons
        // stay square.
        variant: ["ghost", "link"],
        size: ["lg", "md", "base", "default", "sm", "xs", "2xs"],
        className: "h-auto px-[var(--space-5)] py-[var(--space-3)]",
      },
      {
        // Only `ghost` tightens the icon gap to 10px (Button.jsx:16); `link`
        // keeps the base 12px.
        variant: ["ghost"],
        className: "gap-[var(--space-4)]",
      },
      // Only the two large primaries carry the orange glow; lg also lifts 1px.
      {
        variant: ["primary", "default"],
        size: ["lg"],
        className: "shadow-accent-button hover:-translate-y-px",
      },
      {
        variant: ["primary", "default"],
        size: ["md"],
        className: "shadow-accent-button-sm",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      block: false,
    },
  }
)

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>
type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>["size"]>

/** shadcn alias → DS name, so `data-variant` speaks the DS vocabulary. */
const DS_VARIANT: Record<ButtonVariant, string> = {
  primary: "primary",
  default: "primary",
  secondary: "secondary",
  outline: "secondary",
  tint: "tint",
  ghost: "ghost",
  link: "link",
  danger: "danger",
  destructive: "danger",
}

/** shadcn alias → DS name, so `data-size` speaks the DS vocabulary. */
const DS_SIZE: Record<ButtonSize, string> = {
  lg: "lg",
  md: "md",
  base: "base",
  default: "base",
  sm: "sm",
  xs: "xs",
  "2xs": "2xs",
  icon: "icon",
  "icon-xs": "icon-xs",
  "icon-sm": "icon-sm",
  "icon-lg": "icon-lg",
}

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the single child element (shadcn Slot). */
    asChild?: boolean
    /**
     * DS leading icon node, rendered `aria-hidden` so it stays out of the
     * accessible name. Ignored when `asChild` is set, because Slot needs a
     * single child — pass the icon inside that child instead (dev builds warn).
     */
    icon?: React.ReactNode
  }

function Button({
  className,
  variant = "default",
  size = "default",
  block = false,
  asChild = false,
  icon,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const resolvedVariant: ButtonVariant = variant ?? "default"
  const resolvedSize: ButtonSize = size ?? "default"
  const hasIcon = icon !== undefined && icon !== null && icon !== false

  // Dev-only: `icon` cannot be rendered next to a Slot child, so it is dropped
  // silently — which type-checks and looks like a styling bug at the call site.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    if (!asChild || !hasIcon) return
    console.warn(
      "Button: `icon` is ignored when `asChild` is set — Slot renders a single " +
        "child. Move the icon inside that child element."
    )
  }, [asChild, hasIcon])

  return (
    <Comp
      data-slot="button"
      data-variant={DS_VARIANT[resolvedVariant]}
      data-size={DS_SIZE[resolvedSize]}
      className={cn(
        buttonVariants({ variant: resolvedVariant, size: resolvedSize, block }),
        className
      )}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {hasIcon ? (
            // `inline-flex` keeps the wrapper the exact size of the glyph (no
            // line box), so the DS gap is unchanged; rendering it only when an
            // icon exists avoids an empty flex item eating one gap.
            <span aria-hidden="true" className="inline-flex shrink-0">
              {icon}
            </span>
          ) : null}
          {children}
        </>
      )}
    </Comp>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
export { Button, buttonVariants }
export type { ButtonProps }
