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
 * `docs/UI_PORT/SCOUT_SCREENS.md` §6.7 (text controls).
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
 *   padding `0 6px` (`--space-2`), no focus outline — the caret is the DS's
 *   only focus indicator inside the pill.
 *   Trailing actions are `IconButton`s at `height - 16` (44px at the default
 *   height = `--size-button-xs`): `subtle` send (paper plane 18px) whenever
 *   `onSubmit` is given, `accent` mic (18px) whenever `onVoice` is given.
 *
 * Height is driven through `--rs-composer-height` / `--rs-composer-action`
 * instead of literal pixels, so the default lands on the DS tokens
 * (`--size-composer`, `--size-button-xs`) while `height` (56–62 in context)
 * still works as the plain number the DS declares. The action size is handed
 * to `IconButton` as its own `--rs-icon-button-size`, which the button spreads
 * last and therefore honours over its `size` prop.
 *
 * Copy is the DS's, verbatim: placeholder „Nachricht an deinen Scout …“,
 * `aria-label` „Nachricht an deinen Scout“, „Senden“, „Mit Scout sprechen“.
 * (§6.7's discovery screen overrides the first two per state —
 * „Antwort an deinen Scout …“ / „Dein Scout spricht …“ — and labels the mic
 * „Zum Sprechen wechseln“; those are call-site props, not new defaults.)
 *
 * Two things this atom deliberately does not own:
 * - **The suggestion chip** above the composer (§6.7). It is a
 *   `<Button variant="tint" size="2xs">` in the DS's own screens
 *   (`design-system/ui_kits/roomscout-app/ScreensA.jsx`), sitting in the
 *   12px-gap column that wraps the composer — not a part of the form.
 * - **The voice/text rule.** `Composer.prompt.md`: exactly one voice entry per
 *   screen — either `onVoice` here or a separate „Sprechen“ button, never both.
 *
 * The DS's value-based handlers are kept (`onChange(value)`, `onSubmit(value)`
 * — not the native form events), so every other form prop stays forwardable.
 */

/** The pill itself. Height comes from `--rs-composer-height`, set inline. */
const COMPOSER_FORM = [
  "flex w-full items-center gap-[var(--space-3)]",
  "h-(--rs-composer-height) pr-[var(--space-3)] pl-[var(--space-8)]",
  "rounded-pill border border-rs-border-panel bg-rs-surface-composer",
  "[backdrop-filter:var(--blur-composer)]",
  "font-sans",
].join(" ")

/** The field: transparent, borderless, no focus ring — the caret carries it. */
const COMPOSER_INPUT = [
  "min-w-0 flex-1 border-0 bg-transparent px-[var(--space-2)]",
  "font-sans text-[length:var(--text-body-size)] text-rs-ink",
  "placeholder:text-rs-ink-7",
  "selection:bg-rs-orange selection:text-rs-white",
  "outline-none",
].join(" ")

interface ComposerProps
  extends Omit<
    React.FormHTMLAttributes<HTMLFormElement>,
    "onChange" | "onSubmit"
  > {
  value: string
  onChange?: (value: string) => void
  /** Renders the send button when provided. */
  onSubmit?: (value: string) => void
  /** Renders the orange mic button when provided. */
  onVoice?: () => void
  placeholder?: string
  label?: string
  /** 60 default, 56–62 in context. */
  height?: number
  showKeyboardIcon?: boolean
  /** Thin divider after the icon (autopilot side note). */
  divider?: boolean
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
  height,
  showKeyboardIcon = true,
  divider,
  style,
  children,
  ...props
}: ComposerProps) {
  // Undefined height = the DS default: 60px pill, 44px actions — both tokens.
  const pillHeight = height === undefined ? "var(--size-composer)" : `${height}px`
  const actionSize =
    height === undefined ? "var(--size-button-xs)" : `${height - 16}px`

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
      className={cn(COMPOSER_FORM, className)}
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
        // A controlled field with no handler is read-only by definition; saying
        // so keeps React from warning and keeps the caret honest.
        readOnly={onChange === undefined}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={COMPOSER_INPUT}
      />
      {children}
      {onSubmit && (
        <IconButton
          data-composer-action="send"
          type="submit"
          variant="subtle"
          label="Senden"
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
          label="Mit Scout sprechen"
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
