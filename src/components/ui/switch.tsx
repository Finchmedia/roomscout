import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * Switch — shadcn primitive restyled to the RoomScout design system.
 *
 * DS spec: `design-system/components/forms/switch/`
 * (`Switch.jsx`, `Switch.d.ts`, `Switch.prompt.md`, `switch.card.html`).
 * Prototype source of truth: `docs/UI_PORT/SETTINGS_SCREENS.md` §3.3 (the
 * shared toggle, six byte-identical instances across Settings and Operator)
 * and `docs/UI_PORT/TOKENS.md` §F27.
 *
 * Geometry verbatim from `Switch.jsx:6-7`:
 *   track  56×32 (`--size-switch-w` / `--size-switch-h`) · radius **16**
 *          (`--radius-card`) — the DS writes `borderRadius: 16`, not a pill;
 *          at 32px tall the two render identically, so the stated value wins ·
 *          no border · `--rs-orange` when on, white .14 when off ·
 *          `transition: background .2s` (`--duration-quick`)
 *   knob   26×26 (`--space-12`) · circle · white · `--shadow-knob` ·
 *          `translateX(24px)` when on (`--space-11`) ·
 *          `transition: transform .2s`
 *   inset  3px — the DS's `top:3;left:3`, here the track's padding. No token
 *          (the ladder starts at `--space-1:4px`), so it stays literal exactly
 *          as the 3px in `radio-card.tsx` does. The three numbers stay
 *          consistent by construction: 26 = 32 − 2×3 and 24 = 56 − 32.
 *   disabled  opacity .5, default cursor.
 *
 * The DS ships exactly **one** switch — `Switch.d.ts` declares no `size` — so
 * there is no variant ladder to expose and hence no `cva`, the same call
 * `input.tsx` and `stepper.tsx` make (and what shadcn's own switch does).
 *
 * Neither DS transition names a timing function, so both keep the CSS default
 * `ease` (`ease-[ease]`; without it Tailwind substitutes its own
 * `--default-transition-timing-function`). `--ease-out-soft` is deliberately
 * not used here: `design-system/readme.md` §Motion scopes that curve to layout
 * morphs. Only `background` / `transform` are transitioned — never the focus
 * outline, which the prototype's global `:focus-visible` rule paints instantly.
 *
 * White .14 is an opacity modifier on the `--rs-white` token (`bg-rs-white/14`),
 * the route `stepper.tsx` and `skeleton.tsx` take for the same reason:
 * `docs/UI_PORT/TOKENS.md` §2040/§F25 asks for a dedicated `--rs-switch-off`
 * token, but `src/styles/tokens.css` does not carry one yet.
 *
 * **API.** The Radix surface is untouched (`checked` / `defaultChecked` /
 * `onCheckedChange` / `disabled` / `required` / `name` / `value` / `ref`), as
 * is the shadcn `data-slot` hook, so installed shadcn blocks keep working.
 * Three DS props are adapted rather than inherited:
 *   · `label` fills in `aria-label` — the DS toggle carries no visible label.
 *   · `onChange` keeps the DS signature `(checked: boolean) => void` and fires
 *     after `onCheckedChange`. The DOM `onChange` is omitted from the type: it
 *     never fires on the `<button>` Radix renders, so a call site copied from
 *     `Switch.prompt.md` now works instead of silently doing nothing.
 *   · `children` is omitted. The DS type declares it but its JSX drops it, and
 *     here the knob is a real child no spread can beat — so passing children is
 *     a compile error rather than a silent no-op.
 *
 * **Accessible name.** `role="switch"` renders no text of its own, so every
 * call site must supply one of `label`, `aria-label`, `aria-labelledby`, or a
 * `<label>` that wraps or points at the switch (a `<button>` is a labelable
 * element, so `<Label htmlFor>` works). A switch that ends up with none is a
 * dev-only console warning.
 *
 * ```tsx
 * <Switch checked={on} onCheckedChange={setOn} label="Anbieter kontaktieren" />
 * ```
 */
const SWITCH_TRACK = [
  "peer inline-flex shrink-0 cursor-pointer items-center",
  "h-[var(--size-switch-h)] w-[var(--size-switch-w)] rounded-card border-0 p-[3px]",
  "bg-rs-white/14 data-[state=checked]:bg-rs-orange",
  "transition-[background-color] duration-[var(--duration-quick)] ease-[ease]",
  // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17). It is
  // untransitioned — hence the single enumerated property above, not
  // `transition-colors`, which would also animate `outline-color`.
  // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
  "disabled:cursor-default disabled:opacity-50",
].join(" ")

/**
 * The knob. `transition-transform` rather than a `transform`-only list:
 * Tailwind v4 emits the standalone `translate` property for `translate-x-*`,
 * which a bare `transition-[transform]` would not animate.
 */
const SWITCH_THUMB = [
  "pointer-events-none block size-[var(--space-12)]",
  "rounded-circle bg-rs-white shadow-knob ring-0",
  "transition-transform duration-[var(--duration-quick)] ease-[ease]",
  "data-[state=unchecked]:translate-x-0",
  "data-[state=checked]:translate-x-[var(--space-11)]",
].join(" ")

type SwitchProps = Omit<
  React.ComponentProps<typeof SwitchPrimitive.Root>,
  "children" | "onChange"
> & {
  /**
   * DS convenience prop: used as `aria-label` when no explicit `aria-label` is
   * passed. The DS toggle is always label-less, so every call site ships the
   * row copy here (e.g. `label="Anbieter kontaktieren"`).
   */
  label?: string
  /**
   * DS alias for `onCheckedChange` (`Switch.d.ts:9`), fired right after it.
   * Prefer `onCheckedChange` in new code — this exists so a snippet copied
   * from the DS keeps working instead of attaching a DOM `change` handler to
   * a `<button>`, where it would never fire.
   *
   * @deprecated Use `onCheckedChange`.
   */
  onChange?: (checked: boolean) => void
}

function Switch({
  className,
  label,
  onChange,
  onCheckedChange,
  "aria-label": ariaLabel,
  ref,
  ...props
}: SwitchProps) {
  const nodeRef = React.useRef<HTMLButtonElement | null>(null)
  const ariaLabelledBy = props["aria-labelledby"]

  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      nodeRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  // Dev-only: a `role="switch"` button with no accessible name is invisible to
  // AT. `.labels` covers both the wrapping and the `htmlFor` form of <label>.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    if (ariaLabel || label || ariaLabelledBy) return
    if (nodeRef.current?.labels?.length) return
    console.warn(
      "Switch: rendered without an accessible name. Pass `label`, `aria-label`, " +
        "`aria-labelledby`, or associate a <label> with it."
    )
  }, [ariaLabel, ariaLabelledBy, label])

  const handleCheckedChange =
    onCheckedChange || onChange
      ? (checked: boolean) => {
          onCheckedChange?.(checked)
          onChange?.(checked)
        }
      : undefined

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      ref={setRef}
      aria-label={ariaLabel ?? label}
      onCheckedChange={handleCheckedChange}
      className={cn(SWITCH_TRACK, className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={SWITCH_THUMB} />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
export type { SwitchProps }
