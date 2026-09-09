import * as React from "react"
import { cva } from "class-variance-authority"
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
 * is never an unlabelled icon. `size` is the diameter in px; omitting it lands
 * on the DS header size token (`--size-header-button`, 42px).
 */

const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 cursor-pointer items-center justify-center p-0",
    // Diameter comes from the custom property set below, so `size` stays a
    // plain number in the API while the default resolves to a DS token.
    "size-(--rs-icon-button-size) rounded-circle",
    "font-sans text-[length:var(--text-caption-sm-size)] font-medium",
    "transition-colors duration-(--duration-quick) ease-out-soft",
    // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        /** outline — 1px warm border on rgba white .04; the header control. */
        outline:
          "border border-rs-border-control bg-rs-surface-subtle text-rs-ink hover:bg-rs-surface-hover",
        /** subtle — borderless translucent white fill (composer send). */
        subtle:
          "bg-rs-surface-subtle-2 text-rs-ink hover:bg-rs-surface-hover",
        /** accent — the orange voice entry; white ink. */
        accent: "bg-rs-orange text-rs-white hover:bg-rs-orange-hover",
        /** bare — no background until hover; muted ink. */
        bare: "bg-transparent text-rs-ink-2 hover:bg-rs-surface-hover-soft",
        /** danger — the red end-call / stop control; white ink. */
        danger: "bg-rs-red text-rs-white hover:bg-rs-red-hover",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  }
)

interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "subtle" | "accent" | "bare" | "danger"
  /** Diameter in px (42 header, 44–46 composer, 36 inline, 30 toast). */
  size?: number
  /** aria-label + title. */
  label: string
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop, so the control stays forwardable. */
  ref?: React.Ref<HTMLButtonElement>
}

function IconButton({
  className,
  variant = "outline",
  size,
  label,
  style,
  children,
  ...props
}: IconButtonProps) {
  const diameter =
    size === undefined ? "var(--size-header-button)" : `${size}px`

  return (
    <button
      data-slot="icon-button"
      data-variant={variant}
      aria-label={label}
      title={label}
      className={cn(iconButtonVariants({ variant }), className)}
      style={
        {
          "--rs-icon-button-size": diameter,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </button>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
export { IconButton, iconButtonVariants }
export type { IconButtonProps }
