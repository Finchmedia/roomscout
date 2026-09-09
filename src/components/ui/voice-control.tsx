import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * RoomScout voice control — the large labelled circle of the live conversation
 * row: „Mikro an“ / „Mikro aus“ · „Mitschrift“ · „Gespräch beenden“.
 *
 * DS reference: `design-system/components/forms/voice-control/`
 * (`VoiceControl.jsx`, `VoiceControl.d.ts`, `VoiceControl.prompt.md`,
 * `voice-control.card.html`).
 * Prototype source of truth: `docs/UI_PORT/SCOUT_SCREENS.md` §6.6.
 *
 * Geometry verbatim from `VoiceControl.jsx` / SCOUT_SCREENS.md §6.6:
 *   column button · gap 10 (`--space-4`) · no border, no background, no
 *   padding · ink `--rs-ink-2` · 14px (`--text-caption-size`) · pointer cursor
 *   circle `--size-voice-control` (76px), `--radius-circle`, centred content,
 *   `transition: background .3s` (`--duration-base`)
 *
 * Tones (from `VoiceControl.jsx`, the DS spec for this atom):
 *   · `neutral` — „Mitschrift“: white .07 (`--rs-surface-hover-soft`) behind a
 *     `--rs-border-panel` hairline, ink `--rs-ink`, hover white .12.
 *   · `accent` — the mic. `active !== false` → `--rs-orange` on a transparent
 *     hairline, white ink, the DS glow `0 0 0 6px rgba(255,105,38,.12)` (a
 *     6px ring in `--rs-surface-accent-tint-soft`, expressed as `ring-*` so it
 *     carries no ad-hoc shadow value), hover `--rs-orange-hover`.
 *     `active === false` renders the mic as **off**: back to the neutral fill
 *     and hairline, ring removed, and — per the DS — *no* hover change.
 *   · `danger` — „Gespräch beenden“: `--rs-red`, white ink, hover
 *     `--rs-red-hover`.
 *
 * Two token roundings, both marked here so they are not read as drift:
 *   · the neutral hover is white .12 in the DS; the token ladder stops at
 *     `--rs-surface-hover` (white .10), which is what this atom uses — the
 *     port forbids raw rgba in UI files.
 *   · the 6px ring width resolves through `--space-2` (6px) rather than a
 *     literal, for the same reason.
 *
 * Purely presentational: it owns no mic, transcript or hang-up state. The
 * stage passes `active` plus the matching `label` („Mikro an“ / „Mikro aus“)
 * and reacts in `onClick`. `disabled` comes from the button element and fades
 * the control to .5 while swallowing pointer events, so a control that is not
 * available yet (mic permission pending, conversation already ended) needs no
 * extra prop. `aria-pressed` is emitted only when `active` is a boolean, so
 * the mic reads as a toggle and the other two stay plain buttons.
 *
 * Narrow layout (SCOUT_SCREENS.md §6.6: 60px circles, 12.5px labels, 20px row
 * gap) is the caller's job — pass `size={60}` and
 * `className="text-[length:var(--text-micro-size)]"`; the row itself and the
 * „Zum Schreiben wechseln“ link below it belong to the stage, not to this atom.
 */
const voiceControlVariants = cva(
  [
    "inline-flex cursor-pointer flex-col items-center",
    "gap-[var(--space-4)] border-0 bg-transparent p-0",
    "font-sans text-[length:var(--text-caption-size)] text-rs-ink-2",
    // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" ")
)

const voiceControlCircleVariants = cva(
  [
    "flex items-center justify-center rounded-circle",
    "size-(--rs-voice-control-size)",
    "transition-colors duration-[var(--duration-base)] ease-out-soft",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      tone: {
        /** neutral — „Mitschrift“: quiet white wash, warm hairline. */
        neutral:
          "border border-rs-border-panel bg-rs-surface-hover-soft text-rs-ink hover:bg-rs-surface-hover",
        /** accent — the mic: orange with the DS glow ring, white ink. */
        accent:
          "border border-transparent bg-rs-orange text-rs-white ring-[length:var(--space-2)] ring-rs-surface-accent-tint-soft hover:bg-rs-orange-hover",
        /** danger — „Gespräch beenden“: the end-call red, white ink. */
        danger: "border-0 bg-rs-red text-rs-white hover:bg-rs-red-hover",
      },
      /** accent only: the mic rendered as off (`active === false`). */
      off: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        tone: "accent",
        off: true,
        // Neutral fill + hairline, glow removed, and no hover change at all —
        // `VoiceControl.jsx` ignores the hover state while `active === false`.
        class:
          "border-rs-border-panel bg-rs-surface-hover-soft ring-0 hover:bg-rs-surface-hover-soft",
      },
    ],
    defaultVariants: {
      tone: "neutral",
      off: false,
    },
  }
)

interface VoiceControlProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** `neutral` (Mitschrift) · `accent` (Mikro) · `danger` (Gespräch beenden). */
  tone?: "neutral" | "accent" | "danger"
  /** Circle diameter in px; omitted = `--size-voice-control` (76). Narrow: 60. */
  size?: number
  /** The caption under the circle, e.g. „Mikro an“ — never omitted. */
  label: string
  /** For accent tone: false renders the mic as off. */
  active?: boolean
  onClick?: () => void
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop, so the control stays forwardable. */
  ref?: React.Ref<HTMLButtonElement>
}

function VoiceControl({
  className,
  tone = "neutral",
  size,
  label,
  active,
  style,
  children,
  ...props
}: VoiceControlProps) {
  const off = tone === "accent" && active === false
  const diameter = size === undefined ? "var(--size-voice-control)" : `${size}px`

  return (
    <button
      type="button"
      data-slot="voice-control"
      data-tone={tone}
      data-active={active === undefined ? undefined : String(active)}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      className={cn(voiceControlVariants(), className)}
      style={
        {
          "--rs-voice-control-size": diameter,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    >
      <span
        data-slot="voice-control-circle"
        // Through `cn()`, so the compound accent-off classes actually beat the
        // accent ones: cva only concatenates, and CSS resolves by stylesheet
        // order (where `.ring-0` precedes the 6px ring), not by class order.
        className={cn(voiceControlCircleVariants({ tone, off }))}
      >
        {children}
      </span>
      <span data-slot="voice-control-label">{label}</span>
    </button>
  )
}

// The two `cva()` calls are part of the shadcn public API (a stage may need the
// circle classes on a non-`<VoiceControl>` node, e.g. a morph clone); they are
// not plain constants, so the react-refresh rule cannot see them as such.
// eslint-disable-next-line react-refresh/only-export-components
export { VoiceControl, voiceControlVariants, voiceControlCircleVariants }
export type { VoiceControlProps }
