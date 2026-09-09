import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * The field itself — module-private: upstream shadcn's `input.tsx` exports only
 * the component, and exporting the cva here would trip
 * `react-refresh/only-export-components` (same call as in `textarea.tsx`).
 *
 * **Why `!` on font, size and focus ring.** `src/styles/app.css` still ships its
 * legacy base block *unlayered* — `button, input, select, textarea { font:
 * inherit }` and `input:focus-visible { outline: 2px solid var(--signal);
 * outline-offset: 3px }`. Tailwind emits every utility inside `@layer
 * utilities`, and per cascade-layer semantics an unlayered declaration beats
 * *any* layered one regardless of specificity, so the plain utilities lost:
 * the field rendered at the inherited 16px, not the DS's 15px, and focused at
 * 3px offset, not 2px. `!important` is the one thing a layered utility can win
 * with. Verified against tailwindcss 4.3.3 output. When that legacy block moves
 * into `@layer base`, every `!` in this file can go (see also `button.tsx` /
 * `textarea.tsx`, which still carry the defeated form).
 */
const inputVariants = cva(
  [
    "flex w-full min-w-0 border bg-rs-surface-inset",
    "font-sans! text-rs-ink placeholder:text-rs-ink-7",
    "file:inline-flex file:h-[var(--space-13)] file:border-0 file:bg-transparent",
    "file:text-[length:var(--text-caption-size)] file:font-medium file:text-rs-ink",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid! focus-visible:outline-2!",
    "focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
    // DS invalid border rgba(255,138,106,.6) = --rs-red-text at 60%. It hangs
    // off `data-invalid`, the component's single source of truth: `invalid`
    // *or* any truthy `aria-invalid` (including the ARIA values "grammar" and
    // "spelling", which the `aria-invalid:` variant would miss) flips it, and
    // the helper line reads the same flag, so border and message never
    // disagree.
    "data-[invalid=true]:border-rs-red-text/60",
    // The DS specifies no disabled state for this field; muting the ink to the
    // caption step keeps it legible, where upstream shadcn's `opacity-50` (the
    // file's only untokenised number) put ink and placeholder under 4.5:1 on
    // `--rs-surface-inset`. `pointer-events-none` is dropped too: it suppressed
    // the `cursor-not-allowed` it shipped with and blocked explanatory tooltips.
    "disabled:cursor-not-allowed disabled:text-rs-ink-6",
  ].join(" "),
  {
    variants: {
      /**
       * The three rectangular field signatures of `COMPONENT_MAP.md` C5. Each
       * changes height, padding, radius, hairline *and* type size at once, so
       * they are a ladder rather than five class overrides per call site — the
       * same call `textarea.tsx` makes.
       */
      variant: {
        /**
         * The DS field, verbatim from `TextInput.jsx`: 46px
         * (`--size-button-sm`) · `0 16px` (`--space-7`) · 12px radius · 1px
         * `--rs-border-panel` · 15px (`--text-body-sm-size`). C5's
         * "more-sources search" (SETTINGS_SCREENS.md §4.9).
         */
        default:
          "h-[var(--size-button-sm)] rounded-control-lg border-rs-border-panel px-[var(--space-7)] text-[length:var(--text-body-sm-size)]!",
        /**
         * C5 "profile name" (SETTINGS_SCREENS.md §16, `aria-label="Anzeigename"`):
         * 48px · `0 16px` · 12px radius · 17px (`--text-body-lg-size`).
         * 48px has no `--size-*` step, so it borrows `--space-19`; the
         * prototype's `rgba(255,220,190,.2)` hairline has no token either and
         * rounds to `--rs-border-control` (.22).
         */
        lg: "h-[var(--space-19)] rounded-control-lg border-rs-border-control px-[var(--space-7)] text-[length:var(--text-body-lg-size)]!",
        /**
         * C5 "knowledge inline edit" (SETTINGS_SCREENS.md §12,
         * `aria-label="Angabe bearbeiten"`): 42px (`--size-header-button`, the
         * only 42px token) · `0 12px` · 10px radius · 16px. The prototype's
         * `rgba(255,200,160,.3)` hairline rounds to `--rs-border-control-strong`
         * (same .3 alpha, the tokenised hue). Sits in a flex row, so give the
         * *wrapper* the growth classes: `wrapperClassName="flex-1 min-w-[220px]"`.
         */
        inline:
          "h-[var(--size-header-button)] rounded-control border-rs-border-control-strong px-[var(--space-5)] text-[length:var(--text-body-size)]!",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** Helper / error line under the field: 8px gap (--space-3), 14px caption. */
const INPUT_HELPER = "text-[length:var(--text-caption-size)]"

type InputProps = React.ComponentProps<"input"> &
  VariantProps<typeof inputVariants> & {
    /** DS invalid state — red border, red helper line; sets `aria-invalid`. */
    invalid?: boolean
    /** DS helper or error text under the field. */
    helper?: React.ReactNode
    /** Class for the wrapper `<div data-slot="input-field">` (always rendered). */
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
 * (= `--text-placeholder`; `docs/UI_PORT/SETTINGS_SCREENS.md` §3.1) — patched
 * on per-component here because the port has not reinstated that global rule
 * (TOKENS.md F18). Focus is the one DS ring: 2px solid orange, 2px offset
 * (TOKENS.md F17). Invalid recolours the border to `--rs-red-text` at 60% —
 * the DS's `rgba(255,138,106,.6)` is that token's own rgb. `variant` adds C5's
 * other two signatures (`lg`, `inline`); `default` is the DS field.
 *
 * Deliberate deltas from the DS source, all four also flagged in review:
 * - **Hairline hue.** `--rs-border-panel` (rgba(255,190,140,.16)) is what
 *   `TextInput.jsx` declares and the DS is the spec, but the prototype field it
 *   recreates is `rgba(255,220,190,.16)` — the peach-white control family, and
 *   what the sibling `textarea.tsx` picked. Open question for the maintainer.
 * - **No `transition`.** The DS declares none for this field and nothing here
 *   animates except the invalid flip, where a 200ms fade is a *delayed* error.
 * - **No `selection:*` utilities.** The app ships a global `::selection`
 *   (unlayered, so it wins on background anyway); recolouring only the text
 *   produced white on a 30%-alpha wash. Selection is now global and uniform.
 * - **Disabled** is muted ink, not `opacity-50` — see the cva comment.
 *
 * The shadcn API is preserved: `<input data-slot="input">` takes every native
 * prop, `className` still targets that input, `ref` still lands on it, so
 * installed blocks (`SidebarInput`, `Form`) keep working. What changed in the
 * DOM: the wrapper `<div data-slot="input-field">` is now **always** rendered,
 * matching `TextInput.jsx`. Rendering it only when `helper` was set changed the
 * element type at that position, so React remounted the field the moment a
 * validation message appeared — losing focus, caret and IME state — and made
 * `wrapperClassName` a silent no-op plus the width dependent on an unrelated
 * prop. Four DS props sit on top of the native ones:
 *
 * - `invalid` — sets `aria-invalid` and `data-invalid`; a truthy `aria-invalid`
 *   from `react-hook-form` / shadcn `Form` drives the same state on its own.
 * - `helper` — the DS helper/error line, wired as `aria-describedby`. Its
 *   container is always mounted as a polite live region (empty ⇒ no margin, no
 *   `aria-describedby`), because toggling `role="alert"` on an existing node
 *   announces unreliably and double-announces when invalid on first paint.
 * - `wrapperClassName` — layout classes for the wrapper (`flex-1`, `min-w-*`);
 *   note the DS routes `style` to the wrapper and `inputStyle` to the field,
 *   the inverse of this file's `wrapperClassName` / `className`.
 * - `label` — fills in `aria-label`, matching the DS's label-less field.
 *
 * The DS's value-only `onChange(value)` is deliberately not adopted: `onChange`
 * stays the native React event handler (`e.target.value`), as shadcn expects.
 * `value` also stays optional (the DS makes it required), and `inputStyle` /
 * `style` / `children` are not re-exposed.
 */
function Input({
  className,
  wrapperClassName,
  variant = "default",
  type,
  id,
  invalid,
  helper,
  label,
  ref,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: InputProps) {
  const reactId = React.useId()
  const nodeRef = React.useRef<HTMLInputElement | null>(null)
  const ariaLabelledBy = props["aria-labelledby"]

  // An empty string is what form libraries hand over (`errors.x?.message ?? ""`)
  // and must not print a helper line; `false` / `0` are reachable through the
  // ReactNode type and are not messages either.
  const hasHelper =
    helper !== undefined &&
    helper !== null &&
    helper !== false &&
    helper !== ""
  const helperId = `${id ?? reactId}-helper`
  const isInvalid =
    invalid ??
    (ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== "false")

  const setRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      nodeRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  // Dev-only: the DS field is placeholder-only by design, and a placeholder is
  // not an accessible name (WCAG 4.1.2 / 3.3.2) — it disappears on input and is
  // ignored by several AT configurations. Every real call site in the prototype
  // passes one. `.labels` covers both the wrapping and the `htmlFor` <label>.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    if (ariaLabel || label || ariaLabelledBy) return
    if (nodeRef.current?.labels?.length) return
    console.warn(
      "Input: rendered without an accessible name. Pass `label`, `aria-label`, " +
        "`aria-labelledby`, or associate a <label> with it."
    )
  }, [ariaLabel, ariaLabelledBy, label])

  return (
    <div
      data-slot="input-field"
      className={cn("w-full font-sans", wrapperClassName)}
    >
      <input
        type={type}
        data-slot="input"
        data-variant={variant ?? "default"}
        data-invalid={isInvalid ? "true" : undefined}
        id={id}
        ref={setRef}
        aria-label={ariaLabel ?? label}
        aria-invalid={ariaInvalid ?? isInvalid}
        aria-describedby={
          [ariaDescribedBy, hasHelper ? helperId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(inputVariants({ variant }), className)}
        {...props}
      />
      {/* Always mounted so the live region exists before the message does; empty
          it carries no margin and no box, so it costs no vertical rhythm. It is
          a <div>, not a <p>: app.css's unlayered `p { color: var(--gray-300);
          line-height: 1.65 }` beats every layered utility, which turned the
          error line neutral grey — the one thing the DS readme forbids. */}
      <div
        id={helperId}
        data-slot="input-helper"
        data-invalid={isInvalid ? "true" : undefined}
        aria-live="polite"
        className={cn(
          INPUT_HELPER,
          hasHelper && "mt-[var(--space-3)]",
          isInvalid ? "text-rs-red-text" : "text-rs-ink-6"
        )}
      >
        {hasHelper ? helper : null}
      </div>
    </div>
  )
}

export { Input }
export type { InputProps }
