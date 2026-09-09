import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Textarea — shadcn primitive restyled to the RoomScout design system.
 *
 * DS spec: `design-system/components/forms/composer/{Composer.jsx,Composer.d.ts}`.
 * The pill-shaped chat Composer ships as its own atom, so what this file takes
 * from the forms group is the Composer's rectangular sibling, the DS text field
 * `design-system/components/forms/text-input/TextInput.jsx`: inset dark fill,
 * one warm hairline, ink at 15px, and the global orange focus outline
 * (`docs/UI_PORT/TOKENS.md` F17 — `outline: 2px solid orange`, 2px offset,
 * placeholder `--rs-ink-7` per F18).
 *
 * Multi-line geometry comes from the prototype's own textarea, the context
 * import field („Zusammenfassung hier einfügen …“,
 * `docs/UI_PORT/SETTINGS_SCREENS.md`): 14/16 padding, 14px radius, 1.55
 * leading, `resize: vertical`. The `subtle` variant is that dialog's read-only
 * prompt box (`docs/UI_PORT/COMPONENT_MAP.md` — white .04 fill, card hairline,
 * 16/18 padding, 14.5px/1.6).
 *
 * The shadcn API is preserved: every native textarea prop passes through,
 * `className` still lands on the textarea itself, and `data-slot="textarea"`
 * stays put, so installed shadcn blocks keep working. The DS additions are
 * `variant` plus `invalid` / `helper` / `label` from `TextInputProps`.
 */
const textareaVariants = cva(
  [
    "flex min-h-16 w-full resize-y font-sans",
    "px-[var(--space-7)] py-[var(--space-6)]",
    // 1.55 leading is the prototype's own value; the DS leading scale only has
    // 1.5 / 1.6, so it stays a literal rather than borrowing the wrong token.
    "text-[length:var(--text-body-sm-size)] leading-[1.55] text-rs-ink",
    "placeholder:text-rs-ink-7",
    "transition-[background-color,border-color] duration-[var(--duration-quick)] ease-out-soft",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        /** The settings field: inset dark fill behind a warm control hairline. */
        default:
          "rounded-card-sm border border-rs-border-control bg-rs-surface-inset aria-invalid:border-rs-red-text/60",
        /**
         * The read-only prompt box: white .04 fill, card hairline, roomier
         * padding and the DS's dense body size (14.5px has no type token).
         */
        subtle:
          "rounded-card-sm border border-rs-border-card bg-rs-surface-subtle px-[var(--space-8)] py-[var(--space-7)] text-[14.5px] leading-[var(--text-body-leading-relaxed)] aria-invalid:border-rs-red-text/60",
        /** Bare field for use inside a shell that already draws the chrome. */
        ghost: "min-h-0 resize-none rounded-none border-0 bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type TextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants> & {
    /** DS `TextInputProps.invalid` — red hairline, red helper, `aria-invalid`. */
    invalid?: boolean
    /** DS `TextInputProps.helper` — helper or error line under the field. */
    helper?: React.ReactNode
    /** DS `TextInputProps.label` — fills in `aria-label` when none is passed. */
    label?: string
  }

function Textarea({
  className,
  variant = "default",
  invalid,
  helper,
  label,
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaProps) {
  const reactId = React.useId()
  const hasHelper = helper !== undefined && helper !== null && helper !== ""
  const helperId = hasHelper ? `${id ?? reactId}-helper` : undefined
  const isInvalid =
    invalid ?? (ariaInvalid === true || ariaInvalid === "true")

  const field = (
    <textarea
      data-slot="textarea"
      data-variant={variant ?? "default"}
      id={id}
      aria-label={ariaLabel ?? label}
      aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
      aria-describedby={
        [ariaDescribedBy, helperId].filter(Boolean).join(" ") || undefined
      }
      className={cn(textareaVariants({ variant }), className)}
      {...props}
    />
  )

  if (!hasHelper) return field

  return (
    <div data-slot="textarea-field" className="w-full font-sans">
      {field}
      <p
        id={helperId}
        data-slot="textarea-helper"
        role={isInvalid ? "alert" : undefined}
        className={cn(
          "mt-[var(--space-3)] text-[length:var(--text-caption-size)]",
          isInvalid ? "text-rs-red-text" : "text-rs-ink-6"
        )}
      >
        {helper}
      </p>
    </div>
  )
}

// Only the component is exported: stock shadcn's textarea has no `…Variants`
// export either, and adding one would trip react-refresh/only-export-components.
export { Textarea }
export type { TextareaProps }
