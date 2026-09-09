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
 *
 * **Why `!` on font, size, leading and the focus ring.** `src/styles/app.css`
 * ships its legacy base block *unlayered* — `button, input, select, textarea {
 * font: inherit }` and `button:focus-visible, input:focus-visible { outline:
 * 2px solid var(--signal); outline-offset: 3px }`. Tailwind emits every utility
 * inside `@layer utilities`, and per cascade-layer semantics an unlayered
 * declaration beats *any* layered one regardless of specificity. `font:
 * inherit` is a shorthand, so it resets family, size, weight *and* line-height
 * — without `!` the 18px glyph rendered at the ambient 17px and the ring sat at
 * the legacy 3px offset in the legacy colour. Same call as `input.tsx`; when
 * that legacy block moves into `@layer base`, every `!` in this file can go.
 *
 * **Geometry tokens are aliases, not semantic matches** (noted at each usage):
 * the token layer carries no stepper-specific sizes, so the three numbers are
 * borrowed from the only tokens that hold them. See the block comment on
 * `Stepper` for the open question.
 */
const STEPPER_BUTTON = [
  "inline-flex shrink-0 cursor-pointer items-center justify-center border-0 p-0",
  // 42px = `--size-header-button` (the app-header icon button; borrowed for its
  // value only) · 40px = `--space-17` (a spacing step, likewise borrowed).
  "w-[var(--size-header-button)] h-[var(--space-17)]",
  "bg-rs-white/5 text-rs-ink hover:bg-rs-white/12",
  // 18px has no font-size token: the type ladder runs 19 / 17 / 16 / 15 / 14 /
  // 13.5 / 12.5 and `--space-8` is a *spacing* step that merely happens to be
  // 18px. Kept a literal rather than aliased, as 13px is in `capsule.tsx`.
  "font-sans! text-[18px]! leading-none!",
  // DS focus ring: 2px solid orange at +2px offset (TOKENS.md F17,
  // `design-system/readme.md` §Hover/Press) — the one ring every interactive
  // element in the app wears, identical to `input.tsx` / `switch.tsx`. It can
  // be drawn outset because the group no longer clips (see `Stepper`).
  // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
  "outline-none focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
  // Disabled: muted ink rather than `opacity-50`, the call `input.tsx` makes —
  // and the hover lighten is held back, since a disabled <button> still matches
  // `:hover` in Chrome. The DS ships no disabled stepper (see `Stepper`).
  "disabled:cursor-not-allowed disabled:text-rs-ink-6 disabled:hover:bg-rs-white/5",
].join(" ")

/**
 * The value field: transparent, centred, borderless — the group owns the box.
 * `Stepper.jsx` kills the focus outline outright (`outline:'none'`); the port
 * keeps the DS ring instead, so the field is not the one focusable control in
 * the app with no visible focus.
 *
 * No `selection:*` utilities, matching `input.tsx`: app.css's unlayered
 * `::selection { background: var(--signal-border) }` beats a layered
 * `selection:bg-*`, so recolouring only the text would put white on a
 * low-alpha wash. Selection stays global and uniform.
 */
const STEPPER_INPUT = [
  // 56px = `--size-button` (a button size, borrowed for its value)
  // · 40px = `--space-17`, as on the buttons.
  "w-[var(--size-button)] h-[var(--space-17)] border-0 bg-transparent p-0 text-center",
  "font-sans! text-[length:var(--text-body-lg-size)]! text-rs-ink",
  "outline-none focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
  "disabled:cursor-not-allowed disabled:text-rs-ink-6",
].join(" ")

/**
 * What the stepper holds and hands back.
 *
 * A **string** is not a defect: it is how the prototype makes „Bitte eine ganze
 * Zahl größer als 0 eingeben.“ reachable. Typing writes the field through raw
 * (`SETTINGS_SCREENS.md` §5.7 / `COMPONENT_MAP.md` §B14: *raw string, hence
 * validation*; `Stepper.jsx:10` `onChange(e.target.value)`), and the call site
 * decides — `Settings.jsx:77` `const invalid = !(Number.isInteger(Number(v)) &&
 * Number(v) > 0)`. The −/+ buttons always hand back a `number`.
 */
type StepperValue = number | string

interface StepperProps
  extends Omit<React.ComponentProps<"div">, "onChange" | "children"> {
  /**
   * Current value. Typically the integer, but a half-typed or invalid string
   * round-trips through here unchanged so the call site can render its error.
   */
  value: StepperValue
  /**
   * Next value: a clamped `number` from − / + and the arrow keys, the **raw
   * string** from typing. Validate at the call site, per §5.7.
   */
  onChange?: (value: StepperValue) => void
  /**
   * Lower bound. − and the arrow keys clamp to it; **typing does not** — that
   * asymmetry is the DS's, and it is what keeps the error line reachable (a
   * clamp on input would silently rewrite „0“ to „1“ and no message could ever
   * fire). DS default 1.
   */
  min?: number
  /** Upper bound, clamped on − / + and the arrow keys only, as `min` is. DS default 99. */
  max?: number
  /**
   * Accessible name of the control — the DS stepper carries no visible label.
   * Names the group, the field, and (composed) the two buttons. An explicit
   * `aria-label` wins over it; `aria-labelledby` covers group and field.
   */
  label?: string
  /** Disables both buttons and the field. Not a DS state — see the block comment. */
  disabled?: boolean
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
 *           · radius 10 (`--radius-control`) · `--font-sans`
 *   buttons 42×40 · no border · fill `rgba(255,255,255,.05)`, hover `.12`
 *           · ink `--rs-ink` · 18px · pointer cursor
 *   input   56×40 · centred · no border · transparent · ink `--rs-ink`
 *           · 17px (`--text-body-lg-size`) · `inputmode="numeric"`
 * Glyphs are literally „−“ (U+2212) and „+“ (`readme.md`: no emoji, no icons
 * here), and the button labels start with the DS's German „Weniger“ / „Mehr“.
 *
 * **Value handling — the DS's, not a stricter one.** The control is purely
 * controlled: it keeps no draft, so it can never disagree with `value` (a
 * parent clamp, an „Abbrechen“ reset mid-edit, §5.10, all land immediately).
 * - Typing emits `event.target.value` **raw**, exactly as `Stepper.jsx:10`
 *   does. Emptying the field, „abc“, „3.5“, „1,5“ all reach the parent, so
 *   `perDayInvalid` flips, the `role="alert"` line renders and „Änderungen
 *   speichern“ disables — the whole §5.7 error story stays alive. Nothing is
 *   parsed on the way through, so there is no `Number()` surprise (`0x1f`,
 *   `1e3`, `+5`, `3.0`) either: what the user typed is what the parent sees.
 * - − / + and ↑ / ↓ hand back a clamped integer, following the prototype's two
 *   *different* fallbacks for a non-integer or out-of-range `value`
 *   (`n = Number(value)`, §5.7):
 *     `decPerDay` → `Math.max(min, (Number.isInteger(n) ? n : min) - 1)`
 *     `incPerDay` → `Math.min(max, (Number.isInteger(n) && n >= min ? n : min - 1) + 1)`
 *   The prototype hard-codes its `min` as 1; `min - 1` is its literal `0` base,
 *   so „abc“ and `-3` both step up to `min`, never to `min + 1`.
 * - At a bound the corresponding button is `disabled` — a DS gap closed, not
 *   copied: `Stepper.jsx` leaves it focusable and announced while it does
 *   nothing. Only an *integer* `value` can disable a button, and never both, so
 *   a typo („abc“ leaves both live, an emptied field leaves +) is always
 *   recoverable with one click.
 *
 * **Accessibility.** The group is `role="group"`, so − / field / + read as one
 * control rather than three strangers; the field is `role="spinbutton"` with
 * `aria-valuenow` / `aria-valuemin` / `aria-valuemax` (and `aria-valuetext`
 * while the text is not an integer), so the range is announced and every step
 * is spoken. ↑ / ↓ step, per the ARIA spinbutton pattern. `Home` / `End` /
 * `PageUp` / `PageDown` are deliberately **not** bound: they are optional in
 * that pattern, and in an editable text field Home/End caret movement is what
 * users expect, while a page-step size exists nowhere in the DS.
 *
 * **Deliberate deltas from the DS source, all four flagged for the maintainer:**
 * - **`overflow:hidden` dropped.** The DS clips the group to round the button
 *   fills; that clip also ate the focus ring, which is why an earlier port drew
 *   it *inside* the buttons. The end buttons carry `rounded-l/r-control`
 *   instead, so the fills are rounded identically and the ring is the app's.
 * - **Hairline alpha.** The spec is `rgba(255,220,190,.2)` in all three
 *   sources; `--rs-border-control` is `.22`. `.20` is a real step of that line
 *   ladder (TOKENS.md §B4) but has no token, and a raw `rgb()` is banned in
 *   this layer — so the neighbouring token stands until `.20` is added to
 *   `src/styles/tokens.css`. Maintainer's call.
 * - **No hover transition.** Restored to the DS: `Stepper.jsx` swaps the fill
 *   with no `transition`, so the hover snaps. `readme.md` §Motion scopes its
 *   curves to layout morphs, not to this control.
 * - **`disabled` added.** Neither `Stepper.jsx` nor `Stepper.d.ts` has it; the
 *   port matches `input.tsx` / `switch.tsx` so a call site can lock the row.
 *
 * `aria-invalid` is forwarded to the field and has **no** visual effect, which
 * is the spec: §5.7 recolours only the `role="alert"` line and leaves the box
 * unchanged. (`input.tsx` does tint its border — because its own DS source
 * does.) The DS's `children` is dropped from the type rather than accepted and
 * silently discarded, the call `switch.tsx` makes for the same reason.
 *
 * Everything else is forwarded to the group `<div>` (`className`, `style`,
 * `data-*`, handlers, `ref`). The form-control attributes belong on the field,
 * not the box, and are routed there: `id` (so a `<label htmlFor>` hits the
 * input), `aria-invalid`, `aria-describedby` (the alert line and the caption
 * under the row) and `aria-labelledby`.
 *
 * ```tsx
 * const [perDay, setPerDay] = React.useState<StepperValue>(5)
 * const invalid = !(Number.isInteger(Number(perDay)) && Number(perDay) > 0)
 * <Stepper value={perDay} onChange={setPerDay} label="Neue Anbieter pro Tag"
 *          aria-invalid={invalid} aria-describedby={invalid ? alertId : undefined} />
 * ```
 */
function Stepper({
  className,
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  disabled,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: StepperProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  // The prototype's `perDayNum = Number(R.perDay)`, computed once per render.
  const numeric = Number(value)
  const isInt = Number.isInteger(numeric)
  const text = String(value)

  const accessibleName = ariaLabel ?? label

  // Dev-only: neither the group nor the field renders text of its own, so a
  // stepper with no name is invisible to AT. `.labels` covers both the wrapping
  // and the `htmlFor` form of <label>.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    if (accessibleName || ariaLabelledBy) return
    if (inputRef.current?.labels?.length) return
    console.warn(
      "Stepper: rendered without an accessible name. Pass `label`, `aria-label`, " +
        "`aria-labelledby`, or associate a <label> with it."
    )
  }, [accessibleName, ariaLabelledBy])

  const decrement = () => {
    onChange?.(Math.max(min, (isInt ? numeric : min) - 1))
  }

  const increment = () => {
    onChange?.(Math.min(max, (isInt && numeric >= min ? numeric : min - 1) + 1))
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Raw, unparsed, unclamped — §5.7's „**raw string**, hence validation“.
    onChange?.(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault()
      increment()
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      decrement()
    }
  }

  return (
    <div
      data-slot="stepper"
      role="group"
      aria-label={accessibleName}
      aria-labelledby={ariaLabelledBy}
      data-disabled={disabled ? "true" : undefined}
      className={cn(
        "inline-flex items-center rounded-control",
        "border border-rs-border-control font-sans",
        className
      )}
      {...props}
    >
      <button
        type="button"
        data-slot="stepper-decrement"
        // DS copy „Weniger“ verbatim, with the field name composed in so two
        // steppers on one screen are distinguishable in an AT element list.
        aria-label={accessibleName ? `Weniger — ${accessibleName}` : "Weniger"}
        disabled={disabled || (isInt && numeric <= min)}
        onClick={decrement}
        className={cn(STEPPER_BUTTON, "rounded-l-control")}
      >
        −
      </button>
      <input
        id={id}
        ref={inputRef}
        data-slot="stepper-input"
        type="text"
        role="spinbutton"
        inputMode="numeric"
        autoComplete="off"
        disabled={disabled}
        aria-label={accessibleName}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-valuenow={isInt ? numeric : undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        // While the text is not an integer there is no `aria-valuenow` to read;
        // `aria-valuetext` keeps the half-typed entry audible instead of blank.
        aria-valuetext={!isInt && text.trim() !== "" ? text : undefined}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className={STEPPER_INPUT}
      />
      <button
        type="button"
        data-slot="stepper-increment"
        aria-label={accessibleName ? `Mehr — ${accessibleName}` : "Mehr"}
        disabled={disabled || (isInt && numeric >= max)}
        onClick={increment}
        className={cn(STEPPER_BUTTON, "rounded-r-control")}
      >
        +
      </button>
    </div>
  )
}

export { Stepper }
export type { StepperProps, StepperValue }
