import * as React from "react"

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"

/**
 * Composer — the pill-shaped message field: the text way to talk to the Scout.
 *
 * DS spec: `design-system/components/forms/composer/`
 * (`Composer.jsx`, `Composer.d.ts`, `Composer.prompt.md`,
 * `composer.card.html`). Prototype source of truth:
 * `docs/UI_PORT/SCOUT_SCREENS.md` §6.7 (discovery text controls), §8.8
 * (autopilot side note) and §9 (clarification reply).
 *
 * Geometry verbatim from `Composer.jsx` / §6.7:
 *   `<form>` · 100% width · flex row · gap 8 (`--space-3`) · height 60
 *   (`--size-composer`) · padding `0 8px 0 18px` (`--space-3` / `--space-8`) ·
 *   pill radius · fill `--rs-surface-composer` (rgba(20,14,10,.6)) · 1px
 *   `--rs-border-panel` hairline · `backdrop-filter: var(--blur-composer)`
 *   (blur(6px)) · `--font-sans`.
 *   Leading keyboard glyph 20px in `--rs-ink-6`, optional 1×22 divider
 *   (`--space-10`) in `--rs-border-panel`, then the field: `flex:1`,
 *   transparent, no border, `--rs-ink` ink at 16px (`--text-body-size`),
 *   padding `0 6px` (`--space-2`), inherited family, and no outline of its own.
 *   Trailing actions are `IconButton`s at `height - 16` (44px at the default
 *   height = `--size-button-xs`): `subtle` send (paper plane 18px), `accent`
 *   mic (18px) whenever `onVoice` is given.
 *
 * Height is driven through `--rs-composer-height` / `--rs-composer-action`
 * instead of literal pixels, so the DS default (60) lands on the DS tokens
 * (`--size-composer`, `--size-button-xs`) whether it is inherited or passed
 * explicitly, while any other `height` (56–62 in context) still works as the
 * plain number the DS declares. The action size is handed to `IconButton` as
 * its own `--rs-icon-button-size`, which the button spreads last and therefore
 * honours over its `size` prop. `height - 16` is floored at 0, so a nonsense
 * height cannot emit a negative diameter.
 *
 * **Why `!` on the field's size and outline.** `src/styles/app.css` still ships
 * its legacy base block *unlayered* — `button, input, select, textarea { font:
 * inherit }` and `input:focus-visible { outline: 2px solid var(--signal);
 * outline-offset: 3px }`. Tailwind emits every utility inside `@layer
 * utilities`, and per cascade-layer semantics an unlayered *normal*
 * declaration beats any layered one regardless of specificity, so the plain
 * utilities lost: the DS's 16px pin was reset by the `font` shorthand's
 * `font-size: inherit` (the field silently drifted with its container), and
 * `outline-none` never suppressed anything — the pill drew the global ring at
 * a 3px offset. `!important` is the one thing a layered utility can win with.
 * Same note as `input.tsx` / `textarea.tsx` / `icon-button.tsx`; when that
 * legacy block moves into `@layer base`, every `!` here can go.
 * The family is deliberately *not* pinned: `Composer.jsx:11` and §6.7 both say
 * `font:inherit`, and the pill above it is `font-sans`.
 *
 * **Focus.** The DS kills the field's outline (`outline:'none'`) and leaves the
 * caret as the only indicator, which is not a visible focus indicator under
 * WCAG 2.4.7/2.4.11. The port keeps the field itself outline-free, as the DS
 * wants, and draws the one DS ring (2px `--rs-orange`, 2px offset —
 * `TOKENS.md` §F17) on the **pill** via `has-[input:focus-visible]`. Same route
 * `fact-list.tsx` and `stepper.tsx` take where the DS source says `outline:none`.
 *
 * No `selection:*` utilities: the app ships a global unlayered
 * `::selection { background: var(--signal-border) }`, so recolouring only the
 * text produced white on a 30%-alpha wash — a third appearance that matched
 * neither the DS global nor the utility. Selection stays global and uniform
 * (same call as `input.tsx`).
 *
 * Copy is the DS's, verbatim: placeholder „Nachricht an deinen Scout …“,
 * `aria-label` „Nachricht an deinen Scout“, „Senden“, „Mit Scout sprechen“.
 * Every one of them is a prop, because the documented call sites need other
 * words: §6.7 swaps the placeholder per state („Antwort an deinen Scout …“ /
 * „Dein Scout spricht …“) and labels the mic **„Zum Sprechen wechseln“**
 * (`voiceLabel`); §9 labels the field „Antwort an deinen Scout“ (`label`).
 *
 * The four documented shapes, all reachable without `className` surgery:
 *   §6.7 discovery — `height={60}`, send + mic, `voiceLabel="Zum Sprechen wechseln"`.
 *   §8.8 side note — `height={62}`, `divider`, `showSendButton={false}` with
 *        `onSubmit` still wired (Enter submits, no send button), and the 20px
 *        inset via `className="pl-[var(--space-9)]"`.
 *   §9 clarification reply — `height={58}`, `blur={false}`,
 *        `showKeyboardIcon={false}`, `inputClassName="px-0"`,
 *        `label="Antwort an deinen Scout"`.
 *   Voice-only — `onVoice` alone (`composer.card.html`, second instance).
 *
 * Two things this atom deliberately does not own:
 * - **The suggestion chip** above the composer (§6.7). It is a
 *   `<Button variant="tint" size="2xs">` in the DS's own screens
 *   (`design-system/ui_kits/roomscout-app/ScreensA.jsx`), sitting in the
 *   12px-gap column that wraps the composer — not a part of the form.
 * - **The voice/text rule.** `Composer.prompt.md`: exactly one voice entry per
 *   screen — either `onVoice` here or a separate „Sprechen“ button, never both.
 *
 * Open question for the maintainer (inherited from the DS, not introduced
 * here): `Composer.jsx:8,10` paints the hairline and the divider
 * `--rs-border-panel` (rgba(255,190,140,.16)), but §6.7/§8.8/§9 recreate the
 * composer with `rgba(255,200,160,.16)` and the divider with
 * `rgba(255,220,190,.16)`. `tokens.css` carries neither value, so the port
 * follows the DS component — the same call `input.tsx` and `separator.tsx`
 * made, and the same ruling they are waiting on (`TOKENS.md` §F2 proposes
 * collapsing the warm-white borders onto `rgba(255,200,160,.16)`).
 *
 * The DS's value-based handlers are kept (`onChange(value)`, `onSubmit(value)`
 * — not the native form events), so every other form prop stays forwardable.
 */

/** The DS default height (`Composer.jsx:6`), which routes onto the tokens. */
const DEFAULT_HEIGHT = 60

/** The pill itself. Height comes from `--rs-composer-height`, set inline. */
const COMPOSER_FORM = [
  "flex w-full items-center gap-[var(--space-3)]",
  "h-(--rs-composer-height) pr-[var(--space-3)] pl-[var(--space-8)]",
  "rounded-pill border border-rs-border-panel bg-rs-surface-composer",
  "font-sans",
  // The DS ring, drawn on the pill so the field stays outline-free (F17).
  "has-[input:focus-visible]:outline-solid has-[input:focus-visible]:outline-2",
  "has-[input:focus-visible]:outline-offset-2",
  "has-[input:focus-visible]:outline-rs-orange",
].join(" ")

/** The field: transparent, borderless, no outline — the pill carries the ring. */
const COMPOSER_INPUT = [
  "min-w-0 flex-1 border-0 bg-transparent px-[var(--space-2)]",
  "text-[length:var(--text-body-size)]! text-rs-ink",
  "placeholder:text-rs-ink-7",
  "outline-none!",
].join(" ")

interface ComposerProps
  extends Omit<
    React.FormHTMLAttributes<HTMLFormElement>,
    "onChange" | "onSubmit"
  > {
  value: string
  onChange?: (value: string) => void
  /** Submit handler; also renders the send button unless `showSendButton` says otherwise. */
  onSubmit?: (value: string) => void
  /** Renders the orange mic button when provided. */
  onVoice?: () => void
  placeholder?: string
  /** Field `aria-label`. */
  label?: string
  /** Send button `aria-label`. */
  sendLabel?: string
  /** Mic button `aria-label` (§6.7: „Zum Sprechen wechseln“). */
  voiceLabel?: string
  /** 60 default, 56–62 in context. */
  height?: number
  showKeyboardIcon?: boolean
  /**
   * Send button. Defaults to „whenever `onSubmit` is given“, as in the DS.
   * §8.8's side note submits on Enter but ships no send button, so it needs
   * `onSubmit` with `showSendButton={false}`.
   */
  showSendButton?: boolean
  /** Thin divider after the icon (autopilot side note). */
  divider?: boolean
  /**
   * `backdrop-filter: var(--blur-composer)`. On by default; §9's reply composer
   * is the one documented composer without it, and `design-system/readme.md`
   * keeps blur deliberately scarce.
   */
  blur?: boolean
  /** Extra classes for the field itself (§9 drops its `padding: 0 6px`). */
  inputClassName?: string
  /** Extra controls inside the pill, between the field and the actions. */
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop, so the pill stays forwardable. */
  ref?: React.Ref<HTMLFormElement>
}

function Composer({
  className,
  value,
  onChange,
  onSubmit,
  onVoice,
  placeholder = "Nachricht an deinen Scout …",
  label = "Nachricht an deinen Scout",
  sendLabel = "Senden",
  voiceLabel = "Mit Scout sprechen",
  height = DEFAULT_HEIGHT,
  showKeyboardIcon = true,
  showSendButton,
  divider,
  blur = true,
  inputClassName,
  style,
  children,
  ...props
}: ComposerProps) {
  // The DS default resolves to tokens (60px pill, 44px actions) whether it was
  // inherited or passed explicitly; anything else stays the plain number.
  const isDefaultHeight = height === DEFAULT_HEIGHT
  const pillHeight = isDefaultHeight ? "var(--size-composer)" : `${height}px`
  const actionSize = isDefaultHeight
    ? "var(--size-button-xs)"
    : `${Math.max(height - 16, 0)}px`

  const sendVisible = showSendButton ?? onSubmit !== undefined

  // `IconButton` spreads the caller's `style` after its own
  // `--rs-icon-button-size`, so this is how the DS's `size={height - 16}`
  // survives without dropping back to a literal pixel number.
  const actionStyle = {
    "--rs-icon-button-size": "var(--rs-composer-action)",
  } as React.CSSProperties

  return (
    <form
      data-slot="composer"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit?.(value)
      }}
      className={cn(
        COMPOSER_FORM,
        blur && "[backdrop-filter:var(--blur-composer)]",
        className
      )}
      style={
        {
          "--rs-composer-height": pillHeight,
          "--rs-composer-action": actionSize,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      {showKeyboardIcon && (
        <Icon name="keyboard" size={20} className="text-rs-ink-6" />
      )}
      {divider && (
        <span
          data-slot="composer-divider"
          aria-hidden="true"
          className="h-[var(--space-10)] w-px shrink-0 bg-rs-border-panel"
        />
      )}
      <input
        data-slot="composer-input"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(COMPOSER_INPUT, inputClassName)}
      />
      {children}
      {sendVisible && (
        // `data-slot` stays the primitive's own (`icon-button`); the composer
        // marks its actions with a second attribute instead of overwriting it,
        // the way `fact-list.tsx` marks its rows.
        <IconButton
          data-composer-action="send"
          type="submit"
          variant="subtle"
          label={sendLabel}
          style={actionStyle}
        >
          <Icon name="send" size={18} />
        </IconButton>
      )}
      {onVoice && (
        <IconButton
          data-composer-action="voice"
          type="button"
          variant="accent"
          label={voiceLabel}
          onClick={onVoice}
          style={actionStyle}
        >
          <Icon name="mic" size={18} />
        </IconButton>
      )}
    </form>
  )
}

export { Composer }
export type { ComposerProps }
