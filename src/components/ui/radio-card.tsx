import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * RadioCard — a large radio option rendered as a card („Autopilot“ /
 * „Mit Rücksprache“).
 *
 * DS reference: `design-system/components/forms/radio-card/`
 * (`RadioCard.jsx`, `RadioCard.d.ts`, `RadioCard.prompt.md`,
 * `radio-card.card.html`). Prototype catalogue:
 * `docs/UI_PORT/COMPONENT_MAP.md` §C3 and `docs/UI_PORT/SETTINGS_SCREENS.md`
 * §5.2 (Settings → Handlungsspielraum, the „Arbeitsmodus“ pair).
 *
 * **Implementation: plain `<button role="radio">`, not Radix.** The DS type is
 * a fully controlled, standalone card (`checked` + `onSelect`); Radix's
 * `RadioGroup.Item` would require a `value` prop and a `RadioGroup.Root`
 * ancestor, i.e. a different public API than `RadioCard.d.ts` prescribes.
 * Nothing was installed — `radix-ui` ships `RadioGroup` already, should a
 * screen ever want the primitive instead.
 *
 * Geometry verbatim from `RadioCard.jsx:6-9` (identical to SETTINGS_SCREENS.md
 * §5.2):
 *   card  flex · items-center · gap 18 (`--space-8`) · padding 20/22
 *         (`--space-9` / `--space-10`) · radius 16 (`--radius-card`) ·
 *         1px border · ink `--rs-ink` · `--font-sans` · text-left ·
 *         cursor-pointer · width 100% · `transition: background .2s,
 *         border-color .2s` (`--duration-quick`)
 *   ring  26×26 (`--space-12`) · circle · 2px border · flex:none · centred
 *   dot   12×12 (`--space-5`) · circle
 *   title block · 19px (`--text-lead-size`) · weight 500 (`--weight-medium`)
 *   sub   block · margin-top 3px · 15px (`--text-body-sm-size`) · `--rs-ink-4`
 *
 * The DS's four state colours are quantised onto the nearest token, since
 * `src/styles/tokens.css` is the only allowed colour source:
 *   checked border  `rgba(255,140,90,.55)` → `--rs-border-accent`   (.50)
 *   checked fill    `rgba(255,105,38,.10)` → `--rs-surface-accent-tint-soft` (.12)
 *   default fill    `rgba(255,255,255,.03)`→ `--rs-surface-subtle`  (.04)
 *   default ring    `rgba(255,220,190,.35)`→ `--rs-border-control-strong` (.30)
 * The default border (`--rs-border-card`), the ring/dot orange (`--rs-orange`)
 * and every size are exact. 3px (`margin-top` of the description) has no token
 * — the spacing ladder starts at 4px — so it stays literal, as 14.5px does in
 * `status-dot.tsx`. Note that the *prototype* paints the checked card warmer
 * than the DS does (`rgba(255,105,38,.75)` border on a `rgba(120,58,22,.28)`
 * rust fill, COMPONENT_MAP §C3); the DS file is the specification and wins.
 *
 * `title` is deliberately consumed, never forwarded — it is the card's copy,
 * not a native tooltip. `children` (declared by the DS type but dropped by its
 * JSX, where the spread cannot beat real JSX children) renders under the
 * description, so a card can carry a badge or a hint. `onClick` composes with
 * `onSelect`: it runs first and can suppress selection with `preventDefault()`.
 *
 * ```tsx
 * <RadioCardGroup aria-label="Arbeitsmodus">
 *   <RadioCard
 *     checked={mode === "autopilot"}
 *     onSelect={() => setMode("autopilot")}
 *     title="Autopilot"
 *     description="Suchen, anfragen und Details klären."
 *   />
 *   <RadioCard
 *     checked={mode === "review"}
 *     onSelect={() => setMode("review")}
 *     title="Mit Rücksprache"
 *     description="Nachrichten vor dem Versand prüfen."
 *   />
 * </RadioCardGroup>
 * ```
 */
const radioCardVariants = cva(
  [
    "group/radio-card flex w-full cursor-pointer items-center gap-[var(--space-8)]",
    "rounded-card border px-[var(--space-10)] py-[var(--space-9)]",
    "text-left font-sans text-rs-ink",
    "transition-[background-color,border-color] duration-[var(--duration-quick)] ease-out-soft",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
  ].join(" "),
  {
    variants: {
      checked: {
        true: "border-rs-border-accent bg-rs-surface-accent-tint-soft",
        false: "border-rs-border-card bg-rs-surface-subtle",
      },
    },
    defaultVariants: {
      checked: false,
    },
  }
)

/** The 26px ring; orange once the card is the selected one. */
const RADIO_CARD_INDICATOR = [
  "flex size-[var(--space-12)] flex-none items-center justify-center",
  "rounded-circle border-2 border-rs-border-control-strong",
  "transition-[border-color] duration-[var(--duration-quick)] ease-out-soft",
  "group-data-[state=checked]/radio-card:border-rs-orange",
].join(" ")

/** The 12px dot inside the ring; transparent while unselected. */
const RADIO_CARD_DOT = [
  "size-[var(--space-5)] rounded-circle bg-transparent",
  "transition-[background-color] duration-[var(--duration-quick)] ease-out-soft",
  "group-data-[state=checked]/radio-card:bg-rs-orange",
].join(" ")

interface RadioCardProps extends React.HTMLAttributes<HTMLButtonElement> {
  /** Selected state — the card is fully controlled, exactly as in the DS. */
  checked: boolean
  /** Fired on click / Enter / Space (and on arrow keys inside a group). */
  onSelect?: () => void
  /** Card copy, e.g. „Autopilot“. Rendered, never set as a `title` attribute. */
  title: string
  /** Second line, e.g. „Suchen, anfragen und Details klären.“ */
  description?: string
  /** Extra content under the description (DS type declares it; its JSX drops it). */
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop. */
  ref?: React.Ref<HTMLButtonElement>
}

function RadioCard({
  className,
  checked,
  onSelect,
  onClick,
  title,
  description,
  children,
  ...props
}: RadioCardProps) {
  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    if (!event.defaultPrevented) onSelect?.()
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      data-slot="radio-card"
      data-state={checked ? "checked" : "unchecked"}
      className={cn(radioCardVariants({ checked }), className)}
      onClick={handleClick}
      {...props}
    >
      <span data-slot="radio-card-indicator" className={RADIO_CARD_INDICATOR}>
        <span data-slot="radio-card-dot" className={RADIO_CARD_DOT} />
      </span>
      <span data-slot="radio-card-content" className="min-w-0">
        <span
          data-slot="radio-card-title"
          className="block text-[length:var(--text-lead-size)] font-medium"
        >
          {title}
        </span>
        {description ? (
          <span
            data-slot="radio-card-description"
            className="mt-[3px] block text-[length:var(--text-body-sm-size)] text-rs-ink-4"
          >
            {description}
          </span>
        ) : null}
        {children}
      </span>
    </button>
  )
}

/**
 * RadioCardGroup — the `role="radiogroup"` wrapper the cards belong in.
 *
 * **Additive**: the DS ships no group component, but a lone `role="radio"`
 * outside a radiogroup has no „1 von 2“ semantics, and the prototype does wrap
 * the pair (`SETTINGS_SCREENS.md` §5.2: `role="radiogroup"
 * aria-label="Arbeitsmodus"`, `display:grid;grid-template-columns:repeat(auto-fit,
 * minmax(280px,1fr));gap:14px` = `--space-6`). The section's `margin-top:26px`
 * stays with the screen, not with this atom.
 *
 * It also supplies the two keyboard behaviours a native `<fieldset>` of radios
 * would have and a bare button pair does not (WAI-ARIA APG, radio group):
 * arrow keys move *and* select, with wrap-around, and the group is a single tab
 * stop — the checked card (or the first one, when nothing is checked) is the
 * one that carries `tabindex="0"`.
 *
 * Both are applied to the rendered DOM (`[role="radio"]` descendants) rather
 * than through context, so any nesting works and `RadioCard` stays a plain
 * standalone button when used outside a group. The consequence: do not pass
 * your own `tabIndex` to a `RadioCard` inside a group — the group owns it.
 */
const RADIO_CARD_STEP: Record<string, 1 | -1> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

interface RadioCardGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop. */
  ref?: React.Ref<HTMLDivElement>
}

function RadioCardGroup({
  className,
  onKeyDown,
  ref,
  ...props
}: RadioCardGroupProps) {
  const groupRef = React.useRef<HTMLDivElement | null>(null)

  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      groupRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  function items(): HTMLElement[] {
    return Array.from(
      groupRef.current?.querySelectorAll<HTMLElement>(
        '[role="radio"]:not([disabled]):not([aria-disabled="true"])'
      ) ?? []
    )
  }

  // Roving tab stop: the checked card — or the first one, while nothing is
  // checked — is the group's single entry point. No dependency array: this has
  // to re-run whenever the selection re-renders the group.
  React.useEffect(() => {
    const cards = items()
    if (cards.length === 0) return
    const entry =
      cards.find((card) => card.getAttribute("aria-checked") === "true") ??
      cards[0]
    for (const card of cards) card.tabIndex = card === entry ? 0 : -1
  })

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented) return

    const step = RADIO_CARD_STEP[event.key]
    if (!step || event.metaKey || event.ctrlKey || event.altKey) return

    const cards = items()
    if (cards.length === 0) return

    const current = cards.indexOf(document.activeElement as HTMLElement)
    const from =
      current === -1
        ? cards.findIndex((card) => card.getAttribute("aria-checked") === "true")
        : current
    const next = cards[(from + step + cards.length) % cards.length]
    if (!next) return

    event.preventDefault()
    next.focus()
    // APG: moving focus inside a radio group also selects.
    next.click()
  }

  return (
    <div
      role="radiogroup"
      data-slot="radio-card-group"
      ref={setRef}
      className={cn(
        "grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[var(--space-6)]",
        className
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  )
}

export { RadioCard, RadioCardGroup }
export type { RadioCardProps, RadioCardGroupProps }
