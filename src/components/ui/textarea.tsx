import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * The field itself.
 *
 * **Why `!` on font, size, leading and focus ring.** `src/styles/app.css` still
 * ships its legacy base block *unlayered* — `button, input, select, textarea {
 * font: inherit }` and `…, textarea:focus-visible { outline: 2px solid
 * var(--signal); outline-offset: 3px }`. Tailwind emits every utility inside
 * `@layer utilities`, and per cascade-layer semantics an unlayered declaration
 * beats *any* layered one regardless of specificity, so the plain utilities
 * lost. `font: inherit` is a shorthand, so it resets font-family, font-size
 * *and* line-height: the field rendered at the inherited 16px/normal, not the
 * DS's 15px/1.55, and focused at 3px offset, not the DS's 2px. `!important` is
 * the one thing a layered utility can win with. Verified against
 * tailwindcss 4.3.3 output. When that legacy block moves into `@layer base`,
 * every `!` in this file can go (same note as in `input.tsx` / `button.tsx`).
 */
const textareaVariants = cva(
  [
    "flex w-full resize-y font-sans!",
    "px-[var(--space-7)] py-[var(--space-6)]",
    // 1.55 leading is the prototype's own value; the DS leading scale only has
    // 1.5 / 1.6, so it stays a literal rather than borrowing the wrong token.
    "text-[length:var(--text-body-sm-size)]! leading-[1.55]! text-rs-ink",
    "placeholder:text-rs-ink-7",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid! focus-visible:outline-2!",
    "focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
    // DS invalid border rgba(255,138,106,.6) = --rs-red-text at 60%. It hangs
    // off `data-invalid`, the component's single source of truth: `invalid`
    // *or* any truthy `aria-invalid` (including the ARIA values "grammar" and
    // "spelling", which the `aria-invalid:` variant would miss) flips it, and
    // the helper line reads the same flag, so border and message never
    // disagree. It lives in the base, not per variant, so no variant can be
    // silently missing the affordance — `ghost` draws no border by design, so
    // there it is inert and the surrounding shell owns the invalid state.
    "data-[invalid=true]:border-rs-red-text/60",
    // The DS specifies no disabled state for this field; muting the ink to the
    // caption step keeps it legible, where upstream shadcn's `opacity-50` (the
    // file's only untokenised number) put ink and placeholder under 4.5:1 on
    // `--rs-surface-inset`. Matches `input.tsx`, which drops `pointer-events-
    // none` for the same reason: it suppressed the `cursor-not-allowed` it
    // shipped with and blocked explanatory tooltips.
    "disabled:cursor-not-allowed disabled:text-rs-ink-6",
  ].join(" "),
  {
    variants: {
      variant: {
        /**
         * C5b verbatim (`COMPONENT_MAP.md`, `SETTINGS_SCREENS.md` §13.3): the
         * import dialog's context field — `14px 16px` padding, 14px radius,
         * `rgba(0,0,0,.25)` fill, `resize:vertical`.
         *
         * **Hairline, deliberately not `input.tsx`'s.** C5b's border is
         * `rgba(255,220,190,.2)`, which rounds to `--rs-border-control` (.22) —
         * the same rounding `input.tsx`'s `lg` variant applies to that identical
         * literal. `input.tsx`'s `default` is `--rs-border-panel` because that
         * is what `TextInput.jsx` declares for *its* field. COMPONENT_MAP C5b
         * is explicit that this field's radius, padding and hairline are its
         * own and must "not be folded into C5's three input signatures", so the
         * two primitives showing different hairlines in the import dialog is
         * the prototype's own drift, not a port bug. Flagged for the
         * maintainer; if the answer is "one hairline for all fields", both
         * files change together.
         */
        default:
          "rounded-card-sm border border-rs-border-control bg-rs-surface-inset",
        /**
         * The read-only prompt box (`SETTINGS_SCREENS.md` §13.2): white .04
         * fill, card hairline, roomier padding, the DS's dense body size
         * (14.5px has no type token) — and `user-select:all` with no resize
         * handle, because its whole purpose is that one click selects the
         * prompt for copying.
         */
        subtle:
          "rounded-card-sm border border-rs-border-card bg-rs-surface-subtle px-[var(--space-8)] py-[var(--space-7)] text-[length:14.5px]! leading-[var(--text-body-leading-relaxed)]! resize-none select-all",
        /** Bare field for use inside a shell that already draws the chrome. */
        ghost: "resize-none rounded-none border-0 bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

/** Helper / error line under the field: 8px gap (--space-3), 14px caption. */
const TEXTAREA_HELPER = "text-[length:var(--text-caption-size)]"

/** C5b ships `rows="6"`; a bare `ghost` shell is a one-line box until told otherwise. */
const DEFAULT_ROWS = { default: 6, subtle: 6, ghost: 1 } as const

type TextareaProps = React.ComponentProps<"textarea"> &
  VariantProps<typeof textareaVariants> & {
    /** DS `TextInputProps.invalid` — red hairline, red helper, `aria-invalid`. */
    invalid?: boolean
    /** DS `TextInputProps.helper` — helper or error line under the field. */
    helper?: React.ReactNode
    /** Class for the wrapper `<div data-slot="textarea-field">` (always rendered). */
    wrapperClassName?: string
    /**
     * DS `TextInputProps.label` — used as `aria-label`, for the DS's label-less
     * field only. C5b's real call site has a **visible** `<Label htmlFor>`
     * („Musik-Kontext einfügen“); do not pass `label` as well, or the invisible
     * name overrides the visible one (WCAG 2.5.3 Label in Name). A dev-only
     * warning fires if you do.
     */
    label?: string
  }

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
 * import field („Zusammenfassung hier einfügen …“, `SETTINGS_SCREENS.md` §13.3
 * / `COMPONENT_MAP.md` C5b): 14/16 padding, 14px radius, 1.55 leading,
 * `resize: vertical`, `rows="6"`. The `subtle` variant is that dialog's
 * read-only prompt box (§13.2 — white .04 fill, card hairline, 16/18 padding,
 * 14.5px/1.6, `user-select:all`).
 *
 * The shadcn API is preserved: every native textarea prop passes through,
 * `className` still lands on the textarea itself, `ref` still lands on it, and
 * `data-slot="textarea"` stays put, so installed shadcn blocks keep working.
 * Two upstream deltas that blocks may notice:
 *
 * - **`field-sizing-content` is dropped.** Upstream new-york ships it; it
 *   fights the DS's `resize: vertical` (the browser overrides the user's drag
 *   on every keystroke). Blocks that relied on the auto-growing box now get a
 *   fixed `rows` box that the user can drag.
 * - **`min-h-16` is dropped, `rows` defaults instead** (6 for `default` /
 *   `subtle`, 1 for `ghost`). 64px was a raw Tailwind scale step with no DS
 *   token behind it and ≈2.5 lines, where C5b specifies six.
 * - **`shadow-xs` is dropped** — the DS gives this field no shadow.
 * - **No `transition`.** Neither the DS nor C5b declares one, the field has no
 *   hover state, and the only animatable change is the invalid flip, where a
 *   200ms fade is a *delayed* error. (Same call as `input.tsx`.)
 * - **No `selection:*` utilities** — the app ships a global unlayered
 *   `::selection`, so selection stays uniform across both form primitives.
 *
 * Four DS props sit on top of the native ones — `invalid`, `helper`,
 * `wrapperClassName`, `label` (see `TextareaProps`). As in `input.tsx`, the
 * wrapper `<div data-slot="textarea-field">` and the helper live region are
 * **always** mounted: rendering them only when `helper` was set changed the
 * element type at that position (React remounted the field the moment a
 * validation message appeared, losing focus, caret and IME state), made
 * `wrapperClassName` a silent no-op, and — because `role="alert"` was toggled
 * onto a node that already existed — announced nothing in NVDA/JAWS/VoiceOver.
 * The helper is a `<div>`, not a `<p>`: app.css's unlayered `p { color:
 * var(--gray-300) }` beats every layered utility and turned the error line
 * neutral grey.
 *
 * The DS's value-only `onChange(value)` is deliberately not adopted: `onChange`
 * stays the native React event handler, as shadcn expects.
 */
function Textarea({
  className,
  wrapperClassName,
  variant = "default",
  invalid,
  helper,
  label,
  id,
  rows,
  ref,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaProps) {
  const reactId = React.useId()
  const nodeRef = React.useRef<HTMLTextAreaElement | null>(null)
  const ariaLabelledBy = props["aria-labelledby"]

  // Always give the field an id, so an external <Label htmlFor> can bind to it
  // and so the helper's `aria-describedby` always resolves.
  const fieldId = id ?? reactId
  const helperId = `${fieldId}-helper`

  // An empty string is what form libraries hand over (`errors.x?.message ?? ""`)
  // and must not print a helper line; `false` / `0` are reachable through the
  // ReactNode type and are not messages either.
  const hasHelper =
    helper !== undefined && helper !== null && helper !== false && helper !== ""

  // One flag drives the border, the helper colour and the DOM attribute, so a
  // caller who passes `invalid={false}` alongside `aria-invalid="true"` (the
  // react-hook-form / shadcn `Form` path) can no longer get a red-bordered
  // field with a neutral, unannounced message. A truthy non-boolean
  // `aria-invalid` ("grammar" / "spelling") is preserved on the way out.
  const ariaInvalidIsTruthy =
    ariaInvalid !== undefined && ariaInvalid !== false && ariaInvalid !== "false"
  const isInvalid = invalid ?? ariaInvalidIsTruthy
  const resolvedAriaInvalid = isInvalid
    ? ariaInvalidIsTruthy
      ? ariaInvalid
      : true
    : undefined

  const setRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      nodeRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  // Dev-only naming guards. C5b pairs this field with a visible <Label htmlFor>,
  // so the common mistakes are (a) shipping it with no accessible name at all
  // (WCAG 4.1.2 — a placeholder is not a name) and (b) passing `label` *as well
  // as* the visible <label>, where the invisible aria-label silently wins and
  // breaks voice control (WCAG 2.5.3). `.labels` covers both the wrapping and
  // the `htmlFor` <label>.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    const hasVisibleLabel = Boolean(nodeRef.current?.labels?.length)
    const ariaName = ariaLabel ?? label
    if (ariaName && hasVisibleLabel) {
      console.warn(
        "Textarea: both a visible <label> and an aria-label are set; the " +
          "aria-label overrides the visible text as the accessible name " +
          "(WCAG 2.5.3). Drop `label`/`aria-label` when a <Label htmlFor> exists."
      )
      return
    }
    if (ariaName || ariaLabelledBy || hasVisibleLabel) return
    console.warn(
      "Textarea: rendered without an accessible name. Pass `label`, " +
        "`aria-label`, `aria-labelledby`, or associate a <label> with it."
    )
  }, [ariaLabel, ariaLabelledBy, label])

  return (
    <div
      data-slot="textarea-field"
      className={cn("w-full font-sans", wrapperClassName)}
    >
      <textarea
        data-slot="textarea"
        data-variant={variant ?? "default"}
        data-invalid={isInvalid ? "true" : undefined}
        id={fieldId}
        ref={setRef}
        rows={rows ?? DEFAULT_ROWS[variant ?? "default"]}
        aria-label={ariaLabel ?? label}
        aria-invalid={resolvedAriaInvalid}
        aria-describedby={
          [ariaDescribedBy, hasHelper ? helperId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={cn(textareaVariants({ variant }), className)}
        {...props}
      />
      {/* Always mounted so the live region exists before the message does;
          empty it carries no margin and no box, so it costs no vertical
          rhythm. */}
      <div
        id={helperId}
        data-slot="textarea-helper"
        data-invalid={isInvalid ? "true" : undefined}
        aria-live="polite"
        className={cn(
          TEXTAREA_HELPER,
          hasHelper && "mt-[var(--space-3)]",
          isInvalid ? "text-rs-red-text" : "text-rs-ink-6"
        )}
      >
        {hasHelper ? helper : null}
      </div>
    </div>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
export { Textarea, textareaVariants }
export type { TextareaProps }
