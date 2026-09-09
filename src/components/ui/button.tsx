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
 * of `primary`, size `default` an alias of DS `base`.
 *
 * Geometry (height / horizontal padding / font-size), verbatim from Button.jsx:
 * `lg` 60/34/19 · `md` 56/32/17 · `base` 50/24/16 · `sm` 46/22/15 ·
 * `xs` 44/20/15 · `2xs` 36/14/13.5.
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
/** ghost — bare text button, 400 weight, ink lightens to white on hover. */
const GHOST =
  "rounded-chip bg-transparent text-rs-ink-3 font-normal hover:text-rs-white"

const buttonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center",
    "gap-[var(--space-5)] font-sans whitespace-nowrap",
    // `translate` is listed because Tailwind v4 emits the standalone
    // `translate` property (not `transform`) for -translate-y-px — without it
    // the lg hover lift would jump instead of easing.
    "transition-[background-color,border-color,color,box-shadow,transform,translate]",
    "duration-[var(--duration-quick)] ease-out-soft",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "disabled:pointer-events-none disabled:opacity-50",
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
        ghost: GHOST,
        /** link — ghost plus a warm 4px-offset underline. */
        link: `${GHOST} underline underline-offset-4 decoration-rs-border-control-strong`,
        danger: DANGER,
        /** shadcn alias — `destructive` is the DS danger. */
        destructive: DANGER,
      },
      size: {
        lg: "h-[var(--size-button-lg)] px-[var(--space-15)] text-[length:var(--text-lead-size)] [&_svg:not([class*='size-'])]:size-5",
        // 32px has no spacing token (the scale jumps 30 → 34), so the Tailwind
        // step is used here; every other padding is a --space-* token.
        md: "h-[var(--size-button)] px-8 text-[length:var(--text-body-lg-size)] [&_svg:not([class*='size-'])]:size-5",
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
        // ghost + link ignore the size ladder's box: height auto, 8/12 padding,
        // 10px gap. Icon sizes are excluded so square icon buttons stay square.
        variant: ["ghost", "link"],
        size: ["lg", "md", "base", "default", "sm", "xs", "2xs"],
        className:
          "h-auto gap-[var(--space-4)] px-[var(--space-5)] py-[var(--space-3)]",
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

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render as the single child element (shadcn Slot). */
    asChild?: boolean
    /**
     * DS leading icon node. Ignored when `asChild` is set, because Slot needs a
     * single child — pass the icon inside that child instead.
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

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, block }), className)}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </Comp>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
export { Button, buttonVariants }
export type { ButtonProps }
