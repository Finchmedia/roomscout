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
 * a fully controlled card (`checked` + `onSelect`); Radix's `RadioGroup.Item`
 * would require a `value` prop and a `RadioGroup.Root` ancestor, i.e. a
 * different public API than `RadioCard.d.ts` prescribes. Nothing was installed
 * — `radix-ui` ships `RadioGroup` already, should a screen ever want the
 * primitive instead.
 *
 * **A `RadioCardGroup` (or another `role="radiogroup"` element) is required**,
 * not optional: `role="radio"` has no meaning without an owning group — AT
 * would announce a radio with no group name and no „1 von 2“ position. Dev
 * builds warn when a card mounts outside one.
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
 * Only the card transitions, and only in `background-color` / `border-color`:
 * the DS declares its transition on the button alone, so the ring border and
 * the dot fill snap on selection instead of fading. Neither DS transition
 * names a timing function, so both keep the CSS default `ease` (`ease-[ease]`;
 * without it Tailwind substitutes its own `--default-transition-timing-function`)
 * — `--ease-out-soft` is deliberately not used, exactly as in `switch.tsx`:
 * `design-system/readme.md` §Motion scopes that curve to layout morphs.
 *
 * The DS's four state colours are quantised onto the nearest token, since
 * `src/styles/tokens.css` is the only allowed colour source:
 *   checked border  `rgba(255,140,90,.55)` → `--rs-border-accent`   (.50)
 *   checked fill    `rgba(255,105,38,.10)` → `--rs-surface-accent-tint-soft` (.12)
 *   default fill    `rgba(255,255,255,.03)`→ `--rs-surface-subtle`  (.04)
 *   default ring    `rgba(255,220,190,.35)`→ `--rs-border-control-strong` (.30)
 * The default border (`--rs-border-card`), the ring/dot orange (`--rs-orange`)
 * and every size are exact. Two literals have no token: 3px (`margin-top` of
 * the description — the spacing ladder starts at 4px, as 14.5px does in
 * `status-dot.tsx`) and the 280px minimum track width of `RadioCardGroup`'s
 * grid (`SETTINGS_SCREENS.md` §5.2; the width ladder in `TOKENS.md` carries no
 * such step). Note that the *prototype* paints the checked card warmer than the
 * DS does (`rgba(255,105,38,.75)` border on a `rgba(120,58,22,.28)` rust fill,
 * COMPONENT_MAP §C3); the DS file is the specification and wins.
 *
 * **API.** `React.ComponentProps<"button">` rather than the DS type's
 * `React.HTMLAttributes<HTMLButtonElement>`, which carries no `disabled` /
 * `form` / `name` / `value` — `disabled` in particular is needed, because
 * `RadioCardGroup` skips disabled cards when moving focus. Everything
 * `RadioCard.d.ts` declares survives. Three details:
 *   · `checked` is optional and defaults to `false`, so the second card of
 *     `RadioCard.prompt.md` (written without the prop) type-checks.
 *   · `title` is consumed, never forwarded — it is the card's copy, not a
 *     native tooltip.
 *   · `children` (declared by the DS type but dropped by its JSX, where the
 *     spread cannot beat real JSX children) renders under the description, so
 *     a card can carry a badge or a hint. It sits inside the `<button>`, which
 *     takes **phrasing content only**: a `<span>` badge is fine, a `<div>`, a
 *     list, or another button/link is invalid HTML.
 *   · `onClick` and `onSelect` both fire on every activation — `onClick` first,
 *     then `onSelect`. `onClick` cannot suppress the selection (a
 *     `preventDefault()` on a `<button type="button">` is a no-op natively and
 *     stays one here); own the `checked` prop instead.
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
    "transition-[background-color,border-color] duration-[var(--duration-quick)] ease-[ease]",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    // Both spellings are dimmed, because both are what `RadioCardGroup` skips
    // when arrow keys move the selection.
    "disabled:cursor-default disabled:opacity-50",
    "aria-disabled:cursor-default aria-disabled:opacity-50",
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

/** The 26px ring; orange once the card is the selected one (untransitioned). */
const RADIO_CARD_INDICATOR = [
  "flex size-[var(--space-12)] flex-none items-center justify-center",
  "rounded-circle border-2 border-rs-border-control-strong",
  "group-data-[state=checked]/radio-card:border-rs-orange",
].join(" ")

/** The 12px dot inside the ring; transparent while unselected. */
const RADIO_CARD_DOT = [
  "size-[var(--space-5)] rounded-circle bg-transparent",
  "group-data-[state=checked]/radio-card:bg-rs-orange",
].join(" ")

type RadioCardProps = Omit<React.ComponentProps<"button">, "title"> & {
  /**
   * Selected state — the card is controlled, exactly as in the DS. Optional
   * only so that `RadioCard.prompt.md`'s unselected example type-checks;
   * treat it as required in real screens.
   */
  checked?: boolean
  /** Fired on click / Enter / Space (and on arrow keys inside a group). */
  onSelect?: () => void
  /** Card copy, e.g. „Autopilot“. Rendered, never set as a `title` attribute. */
  title: string
  /** Second line, e.g. „Suchen, anfragen und Details klären.“ */
  description?: string
  /**
   * Extra content under the description (DS type declares it; its JSX drops
   * it). Phrasing content only — it renders inside the `<button>`.
   */
  children?: React.ReactNode
}

function RadioCard({
  className,
  checked = false,
  onSelect,
  onClick,
  title,
  description,
  children,
  ref,
  ...props
}: RadioCardProps) {
  const nodeRef = React.useRef<HTMLButtonElement | null>(null)

  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      nodeRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  // Dev-only: `role="radio"` outside a radiogroup has neither a group name nor
  // a set size/position, which is worse than the plain button it replaces.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    if (nodeRef.current?.closest('[role="radiogroup"]')) return
    console.warn(
      "RadioCard: rendered outside a radiogroup. Wrap the cards in " +
        '<RadioCardGroup> (or an element with role="radiogroup"), otherwise ' +
        "assistive tech announces a radio with no group and no position."
    )
  }, [])

  function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(event)
    onSelect?.()
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
      ref={setRef}
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
 * **Accessible name.** A radiogroup renders no text of its own, so every call
 * site must pass `aria-label` or `aria-labelledby` (`autonomy.modeGroupAria`
 * = „Arbeitsmodus“ for the Settings pair, `SETTINGS_SCREENS.md` §17.4). No
 * default is baked in — the string belongs to the screen, not to the atom —
 * and a group that ends up with neither is a dev-only console warning, the
 * same treatment `switch.tsx` gives a name-less toggle.
 *
 * It also supplies the two keyboard behaviours a native `<fieldset>` of radios
 * would have and a bare button pair does not (WAI-ARIA APG, radio group):
 * arrow keys move *and* select, with wrap-around, and the group is a single tab
 * stop — the checked card (or the first enabled one, when nothing is checked)
 * is the one that carries `tabindex="0"`.
 *
 * Both are applied to the rendered DOM rather than through context, so a card
 * keeps working under any wrapper. Two consequences worth knowing:
 *   · Membership is „every `[role="radio"]` whose *nearest* `[role="radiogroup"]`
 *     is this element“, so a nested group keeps its own cards; and disabled
 *     cards (`disabled` or `aria-disabled="true"`) are skipped when moving.
 *   · The group owns `tabIndex` on its cards — do not pass your own. A
 *     `MutationObserver` re-syncs the tab stop whenever a card is added,
 *     removed, disabled, or (de)selected, so memoised cards that flip
 *     `aria-checked` without re-rendering the group stay correct.
 *
 * Arrow keys are handled only for keydowns that started on a card of this
 * group: anything focusable a call site puts inside a card keeps its own
 * arrow-key behaviour.
 */
const RADIO_CARD_STEP: Record<string, 1 | -1> = {
  ArrowDown: 1,
  ArrowRight: 1,
  ArrowUp: -1,
  ArrowLeft: -1,
}

/** `RadioCardGroup` skips both spellings of „disabled“ when moving focus. */
function isEnabledCard(card: HTMLElement): boolean {
  return (
    !card.hasAttribute("disabled") &&
    card.getAttribute("aria-disabled") !== "true"
  )
}

type RadioCardGroupProps = React.ComponentProps<"div">

function RadioCardGroup({
  className,
  onKeyDown,
  ref,
  ...props
}: RadioCardGroupProps) {
  const groupRef = React.useRef<HTMLDivElement | null>(null)
  const ariaLabel = props["aria-label"]
  const ariaLabelledBy = props["aria-labelledby"]

  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      groupRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  /** This group's own cards, in DOM order — a nested group keeps its own. */
  const radios = React.useCallback((): HTMLElement[] => {
    const group = groupRef.current
    if (!group) return []
    return Array.from(
      group.querySelectorAll<HTMLElement>('[role="radio"]')
    ).filter((card) => card.closest('[role="radiogroup"]') === group)
  }, [])

  // Dev-only: a radiogroup with no accessible name is a WCAG 4.1.2 gap.
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    if (ariaLabel || ariaLabelledBy) return
    console.warn(
      "RadioCardGroup: rendered without an accessible name. Pass `aria-label` " +
        '(the Settings pair ships aria-label="Arbeitsmodus") or `aria-labelledby`.'
    )
  }, [ariaLabel, ariaLabelledBy])

  // Roving tab stop: the checked card — or the first enabled one, while nothing
  // is checked — is the group's single entry point. The observer keeps it
  // correct when the group itself does not re-render (memoised cards, cards
  // added or disabled later).
  React.useEffect(() => {
    const group = groupRef.current
    if (!group) return

    const sync = () => {
      const cards = radios()
      const selectable = cards.filter(isEnabledCard)
      const entry =
        selectable.find((card) => card.getAttribute("aria-checked") === "true") ??
        selectable[0]
      for (const card of cards) card.tabIndex = card === entry ? 0 : -1
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(group, {
      subtree: true,
      childList: true,
      // `tabindex` is deliberately absent: `sync` writes it, and observing it
      // would re-trigger the observer on its own mutations.
      attributeFilter: ["aria-checked", "aria-disabled", "disabled", "role"],
    })
    return () => observer.disconnect()
  }, [radios])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event)
    if (event.defaultPrevented) return

    const step = RADIO_CARD_STEP[event.key]
    if (!step || event.metaKey || event.ctrlKey || event.altKey) return

    // Only keydowns that a card of *this* group received move the selection.
    // A control nested inside a card, or a nested group's own card, keeps its
    // arrow keys — and a stray keydown can never move focus or select.
    const origin = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      '[role="radio"]'
    )
    if (!origin) return

    const cards = radios().filter(isEnabledCard)
    const current = cards.indexOf(origin)
    if (current === -1) return

    event.preventDefault()

    const next = cards[(current + step + cards.length) % cards.length]
    if (!next || next === origin) return

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
