import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * RoomScout voice control — the large labelled circle of the live conversation
 * row: „Mikro an“ / „Mikro aus“ · „Mitschrift“ · „Gespräch beenden“.
 *
 * DS reference: `design-system/components/forms/voice-control/`
 * (`VoiceControl.jsx`, `VoiceControl.d.ts`, `VoiceControl.prompt.md`,
 * `voice-control.card.html`).
 * Prototype source: `docs/UI_PORT/SCOUT_SCREENS.md` §6.6.
 *
 * Geometry verbatim from `VoiceControl.jsx` / SCOUT_SCREENS.md §6.6:
 *   column button · `display:flex` · gap 10 (`--space-4`) · no border, no
 *   background, no padding · ink `--rs-ink-2` · 14px (`--text-caption-size`) ·
 *   pointer cursor
 *   circle `--size-voice-control` (76px), `--radius-circle`, centred content,
 *   `transition: background .3s` — so `transition-[background-color]`,
 *   `--duration-base`, and the CSS default easing (`ease-[ease]`); the DS names
 *   no timing function, and nothing but the background may move.
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
 * **Open DS-vs-prototype conflicts** — this atom follows the DS (`VoiceControl.jsx`)
 * in all four, because the design system is the port's specification, but none
 * of them is settled; a maintainer decision can flip any of them here:
 *  · *mic glow*: DS `0 0 0 6px rgba(255,105,38,.12)` (a hard halo) vs.
 *    SCOUT_SCREENS.md §6.6 / TOKENS.md:1573 `0 6px 24px rgba(255,105,38,.3)`
 *    (a soft drop-glow). These render very differently. The prototype value has
 *    no token (`design-system/tokens/effects.css` stops at
 *    `--shadow-accent-button`), so adopting it needs a new effects token first.
 *  · *mic-ON border*: prototype `1px solid #ff6926`, DS `1px solid transparent`.
 *    Visually equivalent over the orange fill; the DS value is used.
 *  · *mic hover*: the prototype binds `micBg` to `micOn` only and gives the mic
 *    **no** hover state; `VoiceControl.jsx:8` hovers to `--rs-orange-hover`.
 *    The ported mic therefore gains a hover the prototype never had.
 *  · *neutral hover*: both sources say white `.12`; `tokens.css` has no `.12`
 *    step (the ladder is .04 / .06 / .07 / .10), so it is written as an opacity
 *    modifier on the white token (`hover:bg-rs-white/12`) — the exact DS value,
 *    no literal colour, the same route `icon-button.tsx` / `stepper.tsx` /
 *    `switch.tsx` take. A shared `--rs-surface-hover-strong` token would be
 *    better: §6.7's composer send button needs the same `.12`.
 *
 * Two values that stay literal because no token names them (the route
 * `icon-button.tsx` takes for its 13px): the narrow circle `60px`, and the 6px
 * ring width, which resolves through `--space-2` — a *spacing* step standing in
 * for a ring width. A dedicated `--ring-voice-glow: 6px` (or the whole halo as
 * `--shadow-mic-glow`) would be the honest fix; until then the `--space-2`
 * reference is a rounding, not a semantic match.
 *
 * **Sizing.** The circle diameter always travels on the `--rs-voice-control-size`
 * custom property, which the circle reads with the DS default as its fallback,
 * so `voiceControlCircleVariants()` renders at 76px even on a node that never
 * saw this component. `density` carries the DS's responsive pair in one switch
 * — `wide` 76px / 14px label, `narrow` 60px / 12.5px label (SCOUT_SCREENS.md
 * §6.6 `ctrl` and `ctrlFont`) — so the two halves cannot drift apart at a call
 * site. It is a prop and not a media query on purpose: TOKENS.md §0.1 records
 * `narrow` as JS-derived state (`matchMedia('(max-width: 959px)') || mobile`),
 * so the stage owns the breakpoint. `size` still overrides the diameter for
 * anything off that ladder — a number is px, a string is used verbatim so a
 * call site can stay tokenised — and wins over `density` because it lands in
 * `style`. The 20px narrow row gap, the row itself and the „Zum Schreiben
 * wechseln“ link below it belong to the stage, not to this atom.
 *
 * Purely presentational: it owns no mic, transcript or hang-up state. The
 * stage passes `active` plus the matching `label` („Mikro an“ / „Mikro aus“)
 * and reacts in `onClick`. `active` is mirrored to `data-active` for styling
 * and tests but **not** to `aria-pressed`: the DS flips the accessible name
 * („Mikro an“ ↔ „Mikro aus“, DS card demo + §6.6 `micLabel`), and the WAI-ARIA
 * APG asks for a changing label *or* a pressed state, never both — with both,
 * a screen reader announces „Mikro an, pressed“. `disabled` comes from the
 * button element and fades the control to .5 (`Button.jsx:11`,
 * `opacity: disabled ? .5 : 1` / `cursor: disabled ? 'default' : 'pointer'` —
 * `VoiceControl.jsx` ships no disabled state of its own, so the sibling DS
 * primitive supplies it) while the native `disabled` blocks activation.
 *
 * **Why `!` on the font and the focus ring.** `src/styles/app.css` ships its
 * legacy base block *unlayered* — `button, input, select, textarea { font:
 * inherit }` and `button:focus-visible { outline: 2px solid var(--signal);
 * outline-offset: 3px }`. Tailwind emits utilities inside `@layer utilities`,
 * and an unlayered declaration beats any layered one, so the plain utilities
 * lost: `font: inherit` is a shorthand, so the label rendered at whatever size
 * its parent used instead of the DS's 14px, and the ring drew at a 3px offset
 * instead of the DS's 2px (TOKENS.md F17). Same note as `icon-button.tsx` /
 * `input.tsx`; every `!` here can go once that block moves into `@layer base`.
 */
const voiceControlVariants = cva(
  [
    "flex cursor-pointer flex-col items-center",
    "gap-(--space-4) border-0 bg-transparent p-0",
    "font-sans! text-rs-ink-2",
    // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid! focus-visible:outline-2!",
    "focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
    "disabled:cursor-default disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      /**
       * The DS responsive pair, as state rather than a media query
       * (TOKENS.md §0.1): `wide` 76px circle + 14px label, `narrow` 60px + 12.5px.
       * The diameter is set as the custom property the circle reads, so an
       * explicit `size` — which lands in `style` — still wins.
       */
      density: {
        wide: "text-(length:--text-caption-size)!",
        narrow:
          "text-(length:--text-micro-size)! [--rs-voice-control-size:60px]",
      },
    },
    defaultVariants: {
      density: "wide",
    },
  }
)

const voiceControlCircleVariants = cva(
  [
    "flex items-center justify-center rounded-circle",
    // Bracket form (not the `size-(--…)` shorthand) so the DS default survives
    // on a node that never set the property — e.g. a bare
    // `voiceControlCircleVariants()` on a morph clone.
    "size-[var(--rs-voice-control-size,var(--size-voice-control))]",
    "transition-[background-color] duration-(--duration-base) ease-[ease]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      tone: {
        /** neutral — „Mitschrift“: quiet white wash, warm hairline. */
        neutral:
          "border border-rs-border-panel bg-rs-surface-hover-soft text-rs-ink hover:bg-rs-white/12",
        /**
         * accent — the mic. Everything but the ink is a compound variant, so
         * the on and off class sets are mutually exclusive: cva only
         * concatenates, and CSS then resolves by stylesheet order (where
         * `.border-rs-border-panel` and `.ring-0` both precede their accent
         * counterparts), not by class order. Splitting them keeps the string
         * self-consistent without a `cn()` / tailwind-merge step.
         */
        accent: "text-rs-white",
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
        off: false,
        // Orange fill on a transparent hairline plus the DS glow ring.
        class:
          "border border-transparent bg-rs-orange ring-(length:--space-2) ring-rs-surface-accent-tint-soft hover:bg-rs-orange-hover",
      },
      {
        tone: "accent",
        off: true,
        // Neutral fill + hairline, no glow, and no hover class at all —
        // `VoiceControl.jsx` ignores the hover state while `active === false`.
        class: "border border-rs-border-panel bg-rs-surface-hover-soft",
      },
    ],
    defaultVariants: {
      tone: "neutral",
      off: false,
    },
  }
)

type VoiceControlTone = NonNullable<
  VariantProps<typeof voiceControlCircleVariants>["tone"]
>

type VoiceControlDensity = NonNullable<
  VariantProps<typeof voiceControlVariants>["density"]
>

type VoiceControlProps = React.ComponentProps<"button"> & {
  /** `neutral` (Mitschrift) · `accent` (Mikro) · `danger` (Gespräch beenden). */
  tone?: VoiceControlTone
  /**
   * The DS responsive pair: `wide` (default) 76px circle + 14px label,
   * `narrow` 60px + 12.5px. Driven by the stage's `narrow` state.
   */
  density?: VoiceControlDensity
  /**
   * Circle diameter, overriding `density`. A number is read as px (the DS
   * `.d.ts` signature); a string is used verbatim, so a token stays a token
   * (`size="var(--size-voice-control)"`). Omitted = whatever `density` says.
   */
  size?: number | string
  /** The caption under the circle, e.g. „Mikro an“ — never omitted. */
  label: string
  /** For accent tone: false renders the mic as off. */
  active?: boolean
}

function VoiceControl({
  className,
  tone = "neutral",
  density = "wide",
  size,
  label,
  active,
  style,
  children,
  ...props
}: VoiceControlProps) {
  const off = tone === "accent" && active === false
  const diameter =
    size === undefined ? undefined : typeof size === "number" ? `${size}px` : size

  return (
    <button
      type="button"
      data-slot="voice-control"
      data-tone={tone}
      data-density={density}
      // Only asserted when a `size` was actually passed; `density` and the DS
      // default both leave it absent rather than naming a diameter twice.
      data-size={diameter}
      data-active={active === undefined ? undefined : String(active)}
      className={cn(voiceControlVariants({ density }), className)}
      style={
        diameter === undefined
          ? style
          : ({
              "--rs-voice-control-size": diameter,
              ...style,
            } as React.CSSProperties)
      }
      {...props}
    >
      <span
        // Decorative: the label span is the button's whole accessible name, so
        // nothing a caller passes as `children` can leak into it.
        aria-hidden="true"
        data-slot="voice-control-circle"
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
export type { VoiceControlProps, VoiceControlTone, VoiceControlDensity }
