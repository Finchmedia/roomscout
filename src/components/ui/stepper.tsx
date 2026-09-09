import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The −/+ buttons. Module-private: the DS ships one stepper geometry, so there
 * is no variant ladder to expose (hence no `cva` here, as in `input.tsx`).
 *
 * `rgba(255,255,255,.05)` / `.12` are written as opacity modifiers on the
 * `--rs-white` token (`bg-rs-white/5`, `hover:bg-rs-white/12`) — the exact DS
 * values, no literal colour; the same route `switch.tsx` takes for its
 * `bg-rs-white/14` track.
 */
const STEPPER_BUTTON = [
  "inline-flex shrink-0 cursor-pointer items-center justify-center border-0 p-0",
  "w-[var(--size-header-button)] h-[var(--space-17)]",
  "bg-rs-white/5 hover:bg-rs-white/12 text-rs-ink",
  "font-sans text-[18px] leading-none",
  "transition-colors duration-[var(--duration-fast)] ease-out-soft",
  // DS focus ring: 2px solid orange (TOKENS.md F17). The offset is negative,
  // not the DS's +2px: the group clips (`overflow-hidden`), so an outset ring
  // would be cut off — it is drawn just inside the button instead.
  // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rs-orange",
].join(" ")

/**
 * The value field: transparent, centred, borderless — the group owns the box.
 * `Stepper.jsx` kills the focus outline outright (`outline:'none'`); the port
 * keeps the DS ring instead, inset like the buttons' so the clip cannot eat it.
 */
const STEPPER_INPUT = [
  "w-[var(--size-button)] h-[var(--space-17)] border-0 bg-transparent p-0 text-center",
  "font-sans text-[length:var(--text-body-lg-size)] text-rs-ink",
  "selection:bg-rs-orange selection:text-rs-white",
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-rs-orange",
].join(" ")

interface StepperProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Current integer value. */
  value: number
  /** Called with the next integer — from a button press or a typed value. */
  onChange?: (value: number) => void
  /** Lower bound the − button clamps to. DS default 1. */
  min?: number
  /** Upper bound the + button clamps to. DS default 99. */
  max?: number
  /** `aria-label` of the value field — the DS stepper carries no visible label. */
  label?: string
  /**
   * Declared because `Stepper.d.ts` declares it; the DS component renders no
   * children — the group is exactly − / field / +. A passed child is dropped
   * (the JSX children below win over the spread).
   */
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop, so the group stays forwardable. */
  ref?: React.Ref<HTMLDivElement>
}

/**
 * Stepper — the DS's −/+ integer control („Neue Anbieter pro Tag“).
 *
 * DS reference: `design-system/components/forms/stepper/`
 * (`Stepper.jsx`, `Stepper.d.ts`, `Stepper.prompt.md`, `stepper.card.html`).
 * Prototype source of truth: `docs/UI_PORT/SETTINGS_SCREENS.md` §5.7 and
 * `docs/UI_PORT/COMPONENT_MAP.md` §B14 (Settings → Handlungsspielraum →
 * „Grenzen“); the DS kit's own call site is
 * `design-system/ui_kits/roomscout-app/Settings.jsx:93`.
 *
 * Geometry verbatim from `Stepper.jsx:6-12` / COMPONENT_MAP §B14:
 *   group   `inline-flex` · `align-items:center` · 1px `rgba(255,220,190,.2)`
 *           · radius 10 (`--radius-control`) · `overflow:hidden` · `--font-sans`
 *   buttons 42×40 · no border · fill `rgba(255,255,255,.05)`, hover `.12`
 *           · ink `--rs-ink` · 18px · pointer cursor
 *   input   56×40 · centred · no border · transparent · ink `--rs-ink`
 *           · 17px (`--text-body-lg-size`) · `inputmode="numeric"`
 * Token mapping, with the three values the token layer does not carry exactly:
 *   · 42px = `--size-header-button`, 40px = `--space-17`, 56px = `--size-button`
 *     — the only tokens at those sizes; 18px has no token in the type ladder
 *     (19 / 17 / 16 …) and stays literal, as 13px does in `capsule.tsx`.
 *   · the group hairline is `--rs-border-control` (`rgba(255,220,190,.22)`),
 *     the DS control-border token; the prototype's `.2` has no token of its own
 *     (`docs/UI_PORT/TOKENS.md` §colours lists both alphas separately).
 *   · the hover swap is instant in the prototype; here it rides
 *     `--duration-fast` (.15s), the DS's own shortest step.
 * Glyphs are literally „−“ (U+2212) and „+“ (`readme.md`: no emoji, no icons
 * here), and the button labels are the DS's German „Weniger“ / „Mehr“.
 *
 * **Value handling.** `onChange` is the DS's value-first callback and always
 * receives a **number**, per `Stepper.d.ts`:
 * - − / + clamp to `[min, max]` exactly as `Stepper.jsx` does, and a
 *   non-integer `value` falls back to `min` first (the prototype's
 *   `Number.isInteger(n) ? n : 1` guard).
 * - Typing keeps the raw text in local state so the field can be emptied or
 *   half-written, and emits only once the text parses to an integer —
 *   **unclamped**, mirroring the prototype, which writes the field through raw
 *   and validates at the call site („Bitte eine ganze Zahl größer als 0
 *   eingeben.“, §5.7). The draft is dropped on blur and on any button press,
 *   so the field snaps back to the committed `value`.
 *
 * Everything else is forwarded to the group `<div>` (`className`, `style`,
 * `data-*`, handlers, `ref`). The four form-control attributes belong on the
 * field, not the box, and are routed there: `id` (so a `<label htmlFor>` hits
 * the input), `aria-invalid` (the prototype sets it per §5.7), `aria-describedby`
 * (the `role="alert"` line and the caption under the row) and `aria-labelledby`.
 *
 * ```tsx
 * <Stepper value={perDay} onChange={setPerDay} label="Neue Anbieter pro Tag" />
 * ```
 */
function Stepper({
  className,
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  id,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: StepperProps) {
  /** Raw text while the field is being edited; `null` = show `value`. */
  const [draft, setDraft] = React.useState<string | null>(null)

  const step = (direction: -1 | 1) => {
    const base = Number.isInteger(value) ? value : min
    setDraft(null)
    onChange?.(direction === -1 ? Math.max(min, base - 1) : Math.min(max, base + 1))
  }

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value
    setDraft(next)
    const parsed = Number(next)
    if (next.trim() !== "" && Number.isInteger(parsed)) onChange?.(parsed)
  }

  return (
    <div
      data-slot="stepper"
      className={cn(
        "inline-flex items-center overflow-hidden rounded-control",
        "border border-rs-border-control font-sans",
        className
      )}
      {...props}
    >
      <button
        type="button"
        data-slot="stepper-decrement"
        aria-label="Weniger"
        onClick={() => step(-1)}
        className={STEPPER_BUTTON}
      >
        −
      </button>
      <input
        id={id}
        data-slot="stepper-input"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        value={draft ?? String(value)}
        onChange={handleInput}
        onBlur={() => setDraft(null)}
        className={STEPPER_INPUT}
      />
      <button
        type="button"
        data-slot="stepper-increment"
        aria-label="Mehr"
        onClick={() => step(1)}
        className={STEPPER_BUTTON}
      >
        +
      </button>
    </div>
  )
}

export { Stepper }
export type { StepperProps }
