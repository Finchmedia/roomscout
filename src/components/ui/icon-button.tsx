import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * RoomScout circular icon button — the compact, icon-only control.
 *
 * DS reference: `design-system/components/core/icon-button/`
 * (`IconButton.jsx`, `IconButton.d.ts`, `IconButton.prompt.md`,
 * `icon-button.card.html`).
 *
 * DS rule: `outline` = header controls (42px, warm hairline on rgba white .04);
 * `subtle` = the quiet filled control (composer send, 44px); `accent` = the
 * orange voice entry (46px); `bare` = no background (inline edit, 36px);
 * `danger` = the red end-call (44px).
 *
 * `label` is required and feeds both `aria-label` and `title`, so the control
 * is never an unlabelled icon. `size` is the diameter — a number is read as px
 * (the DS `.d.ts` signature), a string is passed through verbatim so a call
 * site can stay tokenised (`size="var(--size-button-xs)"`); omitting it lands
 * on the DS header size token (`--size-header-button`, 42px).
 *
 * **Why `!` on the font and the focus ring.** `src/styles/app.css` still ships
 * its legacy base block *unlayered* — `button, input, select, textarea { font:
 * inherit }` and `button:focus-visible { outline: 2px solid var(--signal);
 * outline-offset: 3px }`. Tailwind emits every utility inside `@layer
 * utilities`, and per cascade-layer semantics an unlayered declaration beats
 * *any* layered one regardless of specificity, so the plain utilities lost:
 * `font: inherit` is a shorthand, so it reset family, size *and* weight (the
 * button rendered at whatever its parent used, not the DS's 13px/500), and the
 * ring drew at a 3px offset instead of the DS's 2px. `!important` is the one
 * thing a layered utility can win with. `outline-solid` additionally re-arms
 * `--tw-outline-style`, which `outline-none` pins to `none` in every state —
 * without it `focus-visible:outline-2` resolves to `outline-style: none` and
 * the ring never paints at all (it only *looked* right because the unlayered
 * global was drawing it). When that legacy block moves into `@layer base`,
 * every `!` in this file can go — same note as `input.tsx` / `textarea.tsx`.
 *
 * **Deliberate deviations** (do not "fix" without a token first):
 *  · `13px` is a literal: `TOKENS.md` §A3 records it as a real step (21 uses,
 *    "Caption / footnote") but `tokens.css` ports only 14 / 13.5 / 12.5, so
 *    there is no token to point at — the same route `button.tsx` takes for its
 *    32px padding.
 *  · The white alphas the DS asks for and `tokens.css` does not carry (`.08`
 *    resting / `.14` hover on `subtle`, `.08` hover on `bare`) are written as
 *    opacity modifiers on the `--rs-white` token (`bg-rs-white/8`,
 *    `hover:bg-rs-white/14`) — the exact DS values, no literal colour; the same
 *    route `stepper.tsx`, `switch.tsx` and `accordion.tsx` take. `TOKENS.md` §B
 *    (`surface-4` `.08` = "42–44px icon buttons", `hover-4` `.14` = the 44px /
 *    42px round submit buttons) and rule F25 ("`.14` only for controls that
 *    already sit on `rgba(255,255,255,.08)`") make this pair load-bearing, so it
 *    must not be re-mapped onto `--rs-surface-subtle-2` (.06) /
 *    `--rs-surface-hover` (.10).
 *  · Disabled dims to `.5` opacity and drops the pointer cursor. `IconButton.jsx`
 *    ships no disabled state at all; this is `Button.jsx:11`'s treatment
 *    (`opacity: disabled ? .5 : 1`, `cursor: disabled ? 'default' : 'pointer'`)
 *    borrowed from the sibling primitive. It hangs off `aria-disabled` /
 *    `data-disabled` as well as `:disabled`, because the pseudo-class never
 *    matches an `<a>`/`<div>` rendered through `asChild`. No
 *    `pointer-events-none`: this control is icon-only, so its `title` is the
 *    single explanation of what it does, and suppressing hit-testing would take
 *    that away exactly when the user needs it (`disabled` already blocks
 *    activation natively).
 *  · A default `type="button"`, unlike `button.tsx`. An icon button is almost
 *    always a *secondary* action, and `composer.tsx` renders two of them inside
 *    a real `<form>`; without the default, `fact-list.tsx`'s bare edit button
 *    would submit any enclosing form. `...props` still overrides it, which is
 *    how `composer.tsx` keeps its `type="submit"` send button.
 */

const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center p-0",
    // Diameter comes from the custom property set below, so the DS's plain
    // `size` number still works while the default resolves to a DS token.
    "size-(--rs-icon-button-size) rounded-circle",
    // IconButton.jsx:14 — `fontFamily: var(--font-sans)`, `fontSize: 13`,
    // `fontWeight: 500`. See the `!` note above.
    "font-sans! text-[13px]! font-medium!",
    // IconButton.jsx:14 transitions `background` only, at .2s on the CSS
    // default easing — nothing else moves (border and ink are static per
    // variant, including on hover).
    "transition-[background-color] duration-(--duration-quick) ease-[ease]",
    // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
    "outline-none focus-visible:outline-solid! focus-visible:outline-2!",
    "focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
    "disabled:cursor-default disabled:opacity-50",
    "aria-disabled:cursor-default aria-disabled:opacity-50",
    "data-disabled:cursor-default data-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /** outline — 1px warm border on rgba white .04; the header control. */
        outline:
          "border border-rs-border-control bg-rs-surface-subtle text-rs-ink hover:bg-rs-surface-hover",
        /** subtle — borderless white .08, hover .14 (composer send). */
        subtle: "bg-rs-white/8 text-rs-ink hover:bg-rs-white/14",
        /** accent — the orange voice entry; white ink. */
        accent: "bg-rs-orange text-rs-white hover:bg-rs-orange-hover",
        /** bare — no background until white .08 on hover; muted ink. */
        bare: "bg-transparent text-rs-ink-2 hover:bg-rs-white/8",
        /** danger — the red end-call / stop control; white ink. */
        danger: "bg-rs-red text-rs-white hover:bg-rs-red-hover",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  }
)

type IconButtonVariant = NonNullable<
  VariantProps<typeof iconButtonVariants>["variant"]
>

type IconButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof iconButtonVariants> & {
    /**
     * Diameter (42 header, 44–46 composer, 36 inline, 30 toast). A number is
     * read as px, per the DS `.d.ts`; a string is used verbatim, so a token
     * stays a token (`size="var(--size-button-xs)"`).
     *
     * Either form lands on the `--rs-icon-button-size` custom property, which
     * `style` may also set directly — the caller's `style` is spread *after*
     * the component's, so `style={{ "--rs-icon-button-size": … }}` wins over
     * `size`. That is how `composer.tsx` passes a diameter it computes.
     */
    size?: number | string
    /** aria-label + title. */
    label: string
    /** Render as the single child element (shadcn Slot). */
    asChild?: boolean
    children?: React.ReactNode
    style?: React.CSSProperties
  }

function IconButton({
  className,
  variant = "outline",
  size,
  label,
  asChild = false,
  style,
  children,
  ...props
}: IconButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  const resolvedVariant: IconButtonVariant = variant ?? "outline"
  const diameter =
    size === undefined
      ? "var(--size-header-button)"
      : typeof size === "number"
        ? `${size}px`
        : size

  return (
    <Comp
      data-slot="icon-button"
      data-variant={resolvedVariant}
      // Only asserted when a `size` was actually passed. The default and the
      // `--rs-icon-button-size` escape hatch (`composer.tsx`) both leave it
      // absent rather than naming a diameter the element may not have.
      data-size={size === undefined ? undefined : diameter}
      aria-label={label}
      title={label}
      // Declared before the spread, so a call site's own `type` still wins.
      // Dropped under `asChild`, where the rendered element may not be a
      // <button> at all.
      type={asChild ? undefined : "button"}
      className={cn(
        iconButtonVariants({ variant: resolvedVariant }),
        className
      )}
      style={
        {
          "--rs-icon-button-size": diameter,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </Comp>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
export { IconButton, iconButtonVariants }
export type { IconButtonProps }
