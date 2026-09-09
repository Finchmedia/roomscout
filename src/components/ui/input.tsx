import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The field itself — module-private: the DS ships exactly one text-input
 * geometry, so there is no variant ladder to expose, and upstream shadcn's
 * `input.tsx` exports only the component.
 */
const INPUT_FIELD = [
  "flex h-[var(--size-button-sm)] w-full min-w-0",
  "rounded-control-lg border border-rs-border-panel bg-rs-surface-inset",
  "px-[var(--space-7)] font-sans text-[length:var(--text-body-sm-size)]",
  "text-rs-ink placeholder:text-rs-ink-7",
  "selection:bg-rs-orange selection:text-rs-white",
  "file:inline-flex file:h-[var(--space-13)] file:border-0 file:bg-transparent",
  "file:text-[length:var(--text-caption-size)] file:font-medium file:text-rs-ink",
  "transition-[background-color,border-color,color] duration-[var(--duration-quick)] ease-out-soft",
  // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
  // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
  // DS invalid border rgba(255,138,106,.6) = --rs-red-text at 60%.
  "aria-invalid:border-rs-red-text/60",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
].join(" ")

/** Helper / error line under the field: 8px gap (--space-3), 14px caption. */
const INPUT_HELPER =
  "mt-[var(--space-3)] font-sans text-[length:var(--text-caption-size)]"

type InputProps = React.ComponentProps<"input"> & {
  /** DS invalid state — red border, red helper line; sets `aria-invalid`. */
  invalid?: boolean
  /** DS helper or error text under the field. Renders a wrapping element. */
  helper?: React.ReactNode
  /** Wrapper class — used only when `helper` is set; `className` styles the input. */
  wrapperClassName?: string
  /** DS convenience prop: used as `aria-label` when none is passed explicitly. */
  label?: string
}

/**
 * Input — shadcn primitive restyled to the RoomScout design system.
 *
 * DS spec: `design-system/components/forms/text-input/`
 * (`TextInput.jsx`, `TextInput.d.ts`, `text-input.card.html`) — the rectangular
 * settings field ("Quelle oder Region suchen …"). For chat, the DS uses
 * `Composer`, not this input.
 *
 * Geometry, verbatim from `TextInput.jsx`: 100% width · 46px height
 * (`--size-button-sm`) · `0 16px` padding (`--space-7`) · 12px radius
 * (`--radius-control-lg`) · 1px `--rs-border-panel` · `--rs-surface-inset`
 * background · `--rs-ink` ink at 15px (`--text-body-sm-size`). The placeholder
 * colour is the DS's global `input::placeholder` rule, `--rs-ink-7`
 * (= `--text-placeholder`; `docs/UI_PORT/SETTINGS_SCREENS.md` §3.1).
 * Focus is the one DS ring: 2px solid orange, 2px offset (TOKENS.md F17).
 * Invalid recolours the border to `--rs-red-text` at 60% — the DS's
 * `rgba(255,138,106,.6)` is that token's own rgb.
 *
 * The shadcn API is preserved: `Input` still renders a bare
 * `<input data-slot="input">` that takes every native prop, and `className`
 * still targets that input, so installed blocks (`SidebarInput`, forms) keep
 * working. Three DS props sit on top:
 *
 * - `invalid` — sets `aria-invalid`; the styling hangs off `aria-invalid`
 *   itself, so `react-hook-form` / shadcn `Form` get it without this prop.
 * - `helper` — the DS helper/error line. **Only when `helper` is set** does the
 *   component wrap input + line in a `<div data-slot="input-field">` (styled
 *   via `wrapperClassName`) and wire `aria-describedby`; when `invalid`, the
 *   line turns `--rs-red-text` and announces itself with `role="alert"`.
 * - `label` — fills in `aria-label`, matching the DS's label-less field.
 *
 * The DS's value-only `onChange(value)` is deliberately not adopted: `onChange`
 * stays the native React event handler (`e.target.value`), as shadcn expects.
 */
function Input({
  className,
  wrapperClassName,
  type,
  invalid,
  helper,
  label,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputProps) {
  const generatedId = React.useId()
  const helperId =
    helper == null ? undefined : `${props.id ?? generatedId}-helper`
  const describedBy =
    [ariaDescribedBy, helperId].filter(Boolean).join(" ") || undefined

  const field = (
    <input
      type={type}
      data-slot="input"
      aria-label={ariaLabel ?? label}
      aria-invalid={ariaInvalid ?? (invalid ? true : undefined)}
      aria-describedby={describedBy}
      className={cn(INPUT_FIELD, className)}
      {...props}
    />
  )

  if (helper == null) return field

  return (
    <div data-slot="input-field" className={cn("font-sans", wrapperClassName)}>
      {field}
      <p
        id={helperId}
        data-slot="input-helper"
        role={invalid ? "alert" : undefined}
        className={cn(
          INPUT_HELPER,
          invalid ? "text-rs-red-text" : "text-rs-ink-6"
        )}
      >
        {helper}
      </p>
    </div>
  )
}

export { Input }
export type { InputProps }
