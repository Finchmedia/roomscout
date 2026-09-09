import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * StatusDot — a coloured dot plus a short status line.
 *
 * DS reference: `design-system/components/core/status-dot/`
 * (`StatusDot.jsx`, `StatusDot.d.ts`, `StatusDot.prompt.md`,
 * `status-dot.card.html`). Prototype catalogue:
 * `docs/UI_PORT/COMPONENT_MAP.md` §A2 and `docs/UI_PORT/SCOUT_SCREENS.md`
 * §2.4.1 (the header Scout badge).
 *
 * Geometry verbatim from `StatusDot.jsx:6-12`: an `inline-flex` row,
 * `gap:10px` (`--space-4`), `--font-sans`, 14.5px, `--rs-ink-2`,
 * `white-space:nowrap`; the mark is a `50%`-round `flex:none` square of
 * `size` px (default 8 = `--space-3`). 14.5px has no token of its own
 * (`--text-caption-size` is 14px, `--text-caption-sm-size` 13.5px), so it stays
 * literal — the same route `badge.tsx` takes for its `pill` variant.
 * `docs/UI_PORT/TOKENS.md:1760` names this step `text-sm-dense` (62
 * occurrences); the literal disappears here and in `badge.tsx` the day
 * `--text-sm-dense-size` lands in `src/styles/tokens.css`.
 *
 * **Tones** (`StatusDot.d.ts`; colours from the `C` map in `StatusDot.jsx:3`)
 * and the prototype states they cover per COMPONENT_MAP §A2:
 * - `accent` (default) — `--rs-orange`. Paired with `pulse`, this is the
 *   prototype's `live` dot: „Scout ist unterwegs“, the latest activity row.
 * - `success` — `--rs-green`. `ok`: „Verbunden“, „Verfügbar“.
 * - `warning` — `--rs-amber`. `warn`: „Anmeldung nötig“, the waiting states.
 * - `muted` — `--rs-ink-6`. `paused` (`#a89684`, never animated):
 *   „Suche pausiert“, „Ausgeschlossen“.
 * - `neutral` — `--rs-ink-2`, the dot that carries the label's own ink.
 * - `idle` — COMPONENT_MAP's `idle` (`rgba(255,255,255,.3)`): the „Weitere
 *   Quellen“ row state „Noch nicht verfügbar“ (`SETTINGS_SCREENS.md` §4.9).
 * - `past` — COMPONENT_MAP's `past` (`rgba(255,220,190,.35)`): every activity
 *   entry except the last (`SCOUT_SCREENS.md` §14, COMPONENT_MAP D-panel).
 * - `danger` — `--rs-red-text`. **Additive**: the DS map has no red tone (see
 *   open questions); it exists so a failure row does not have to reach for the
 *   raw-string escape hatch.
 *
 * `idle` and `past` are the two prototype tones with **no colour token yet**.
 * `docs/UI_PORT/tokens.proposed.css:168-169` reserves `--rs-dot-idle` /
 * `--rs-dot-past` for exactly these values, so both classes read that name with
 * a token-built fallback and upgrade themselves the moment the token lands:
 *  · `idle` falls back to `color-mix(in srgb, var(--rs-white) 30%, transparent)`
 *    — bit-exact `rgba(255,255,255,.3)`, no literal. Tailwind wraps that in
 *    `@supports (color:color-mix(…))` and degrades to opaque `--rs-white`
 *    where the function is missing.
 *  · `past` falls back to `--rs-border-control-strong` (`rgba(255,220,190,.3)`),
 *    the declared token of the same warm white; the prototype's .35 has no
 *    token and .30 is its nearest declared neighbour (a 0.05 alpha step on a
 *    ≤9px mark). This is the one knowing deviation in the file.
 *
 * `danger` paints `--rs-red-text` (#ff8a6a, the DS's foreground red, aliased
 * `--text-error`), **not** `--rs-red` (#b8382a). `--rs-red` is the DS *fill*
 * red — the `--danger` button background paired with `--rs-red-hover` — and an
 * 8px mark of it on the page ground `--rs-black` measures ≈3.4:1, a hair over
 * the 3:1 WCAG 1.4.11 floor for graphical objects and under it as soon as the
 * dot dims. `--rs-red-text` measures ≈8.6:1 on the same ground.
 *
 * Any other string is passed through as a CSS colour, exactly as the DS's
 * `C[tone] || tone` fallback does — use it only with a token, e.g.
 * `tone="var(--rs-white)"`, never a raw hex/rgba (the eslint
 * `no-restricted-syntax` rule for `src/components/ui/**` flags those). On that
 * path `data-tone` reads `"custom"`, so `[data-tone]` stays a usable hook.
 *
 * `pulse` is the DS's only "working" signal — never a spinner or a progress
 * bar (`StatusDot.prompt.md`). It runs `rsDot`
 * (`0%,100%{opacity:.4} 50%{opacity:1}`, 2.4s ease-in-out infinite) via the
 * `animate-rs-dot` utility from `src/styles/tokens.css`, and stops under
 * `prefers-reduced-motion`. Both docs bind the animation to the state, not to
 * the caller's taste — `running` → `accent` + `pulse`; `searchPaused` →
 * `muted`, `animation:none` (SCOUT_SCREENS §2.4.1, COMPONENT_MAP §A2, which
 * marks `paused` "+ animation:none"). `pulse` stays an independent boolean
 * because the DS component does too; only `accent` is ever meant to carry it.
 *
 * **Accessibility.** A dot alone means nothing to a screen reader and nothing
 * to a colour-blind reader, so the label-less form requires a name at the type
 * level: pass `children`, or `aria-label` / `aria-labelledby` / `title`. That is
 * exactly the narrow-header contract of `SCOUT_SCREENS.md` §2.4.1 — the text
 * collapses, „the aria-label must survive the narrow collapse“. Set `announce`
 * on a badge whose text changes in place (the header badge swapping „Scout ist
 * unterwegs“ ⇄ „Suche pausiert“) to render `role="status" aria-live="polite"`;
 * it is opt-in because a list of source rows must not announce.
 *
 * Props are `React.ComponentProps<"span">`, so `ref` is a prop (React 19 /
 * shadcn new-york, as in `badge.tsx`) and
 * `<TooltipTrigger asChild><StatusDot …/></TooltipTrigger>` can position.
 *
 * **Header override.** `SCOUT_SCREENS.md` §2.4.1 renders the badge at
 * `font-size:14px;color:#cbb9a8` (`--rs-ink-4`) and `display:flex`, while
 * `StatusDot.jsx:8` — the ruling spec for this component — says 14.5px,
 * `--rs-ink-2`, `inline-flex`. The DS wins here; the header call site restates
 * its own screen values in `className`
 * (`"flex text-[length:var(--text-caption-size)] text-rs-ink-4"`), which
 * `cn()`/tailwind-merge resolves over the base. No variant is added for a
 * one-surface divergence between two documents.
 *
 * ```tsx
 * <StatusDot pulse announce>Scout ist unterwegs</StatusDot>
 * <StatusDot tone="success">Verbunden</StatusDot>
 * <StatusDot tone="warning">Anmeldung nötig</StatusDot>
 * <StatusDot tone="idle" size={8}>Noch nicht verfügbar</StatusDot>
 * <StatusDot tone="muted" size={7} aria-label="Suche pausiert" />
 * ```
 */

/**
 * The DS `C` map (`StatusDot.jsx:3`) as token utilities, plus the prototype
 * tones the DS map omits (`idle`, `past`) and the additive `danger`.
 * `avatar.tsx` (`AvatarBadge`) types its own `tone` off this map — keep the
 * keys stable.
 */
const TONE_CLASS = {
  accent: "bg-rs-orange",
  success: "bg-rs-green",
  warning: "bg-rs-amber",
  muted: "bg-rs-ink-6",
  neutral: "bg-rs-ink-2",
  /** COMPONENT_MAP `idle`; exact fallback until `--rs-dot-idle` exists. */
  idle: "bg-[color:var(--rs-dot-idle,color-mix(in_srgb,var(--rs-white)_30%,transparent))]",
  /** COMPONENT_MAP `past`; nearest declared token until `--rs-dot-past` exists. */
  past: "bg-[color:var(--rs-dot-past,var(--rs-border-control-strong))]",
  /** Additive: the DS *foreground* red, not the `--danger` fill red. */
  danger: "bg-rs-red-text",
} as const

/**
 * The mark itself. Exported so a screen can put the dot on an element it
 * already renders (a list bullet, a `::before`-less legend swatch) instead of
 * nesting one — `avatar.tsx` does exactly that. The sizing contract is the
 * `--rs-dot-size` custom property on the element carrying the class (default
 * 8px = `--space-3`); `<StatusDot size>` writes it inline on the mark, a
 * standalone user sets it themselves, e.g.
 * `cn(statusDotVariants({ tone: "success" }), "[--rs-dot-size:var(--space-2)]")`.
 * `tone` here is the named set only — the free-colour escape hatch is a
 * `<StatusDot>` feature, since it needs an inline `background`.
 */
const statusDotVariants = cva(
  "block size-[var(--rs-dot-size,var(--space-3))] flex-none rounded-circle",
  {
    variants: {
      tone: TONE_CLASS,
      pulse: {
        /** DS `rsDot`, 2.4s ease-in-out infinite — the only "working" signal. */
        true: "animate-rs-dot motion-reduce:animate-none",
        false: "",
      },
    },
    defaultVariants: {
      tone: "accent",
      pulse: false,
    },
  }
)

/** Named DS tones; any other string is a CSS colour (DS `C[tone] || tone`). */
type StatusDotToneName = NonNullable<VariantProps<typeof statusDotVariants>["tone"]>

/**
 * `StatusDotToneName | string` — `Record<never, never>` only keeps the named
 * steps in autocomplete. Derived from the cva so the component's tone set and
 * `statusDotVariants`' cannot drift apart.
 */
type StatusDotTone = StatusDotToneName | (string & Record<never, never>)

/** `style` that may carry the dot's own custom property. */
type StatusDotStyle = React.CSSProperties & Record<`--${string}`, string>

interface StatusDotOwnProps {
  /** DS tone name, or any CSS colour string (pass a token: `var(--rs-…)`). */
  tone?: StatusDotTone
  /** Slow opacity blink while the Scout is working — `accent` only. */
  pulse?: boolean
  /**
   * Dot size in px, written to `--rs-dot-size` on the mark. DS default 8; the
   * prototype's five real sizes are 6, 7, 8, 9 and 12 (COMPONENT_MAP §A2:
   * "do not canonicalise"), and the prop stays `number` because
   * `StatusDot.d.ts` declares it that way.
   */
  size?: number
  /**
   * Render `role="status" aria-live="polite"` — for a badge whose label swaps
   * in place (§2.4.1: „Scout ist unterwegs“ ⇄ „Suche pausiert“). Opt-in: a
   * list of status rows must not announce.
   */
  announce?: boolean
}

type StatusDotBaseProps = React.ComponentProps<"span"> & StatusDotOwnProps

/**
 * The dot must carry a name: either a visible label (`children`) or, when the
 * label collapses, `aria-label` / `aria-labelledby` / `title` on the row.
 * A bare `<StatusDot tone="warning" />` would convey its whole meaning through
 * hue alone (WCAG 1.1.1 / 1.4.1) and no longer typechecks.
 */
type StatusDotProps = StatusDotBaseProps &
  (
    | { children: React.ReactNode }
    | { children?: never; "aria-label": string }
    | { children?: never; "aria-labelledby": string }
    | { children?: never; title: string }
  )

function isToneName(tone: StatusDotTone): tone is StatusDotToneName {
  return Object.prototype.hasOwnProperty.call(TONE_CLASS, tone)
}

function StatusDot(props: StatusDotProps) {
  const {
    className,
    tone = "accent",
    pulse = false,
    size,
    announce = false,
    role,
    "aria-live": ariaLive,
    style,
    children,
    ...rest
    // The public type is a union (label XOR accessible name); the body only
    // needs the widened shape.
  } = props as StatusDotBaseProps

  const named = isToneName(tone)
  // Both the size override and the custom colour live on the mark, never on
  // the row: `--rs-dot-size` inherits, so a row-level override would resize
  // every nested dot (and every element carrying `statusDotVariants`).
  const markStyle = {
    ...(size === undefined ? null : { "--rs-dot-size": `${size}px` }),
    ...(named ? null : { background: tone }),
  } as StatusDotStyle

  return (
    <span
      data-slot="status-dot"
      // A named tone emits its slug; the free-colour path emits "custom" so a
      // [data-tone] selector never has to match a colour string.
      data-tone={named ? tone : "custom"}
      data-pulse={pulse ? "true" : "false"}
      role={role ?? (announce ? "status" : undefined)}
      aria-live={ariaLive ?? (announce ? "polite" : undefined)}
      className={cn(
        "inline-flex items-center gap-[var(--space-4)] font-sans text-[14.5px] whitespace-nowrap text-rs-ink-2",
        className
      )}
      style={style}
      {...rest}
    >
      <span
        data-slot="status-dot-indicator"
        aria-hidden="true"
        className={statusDotVariants({
          // A custom colour string has no utility — skip the tone class
          // (`null` opts out of cva's default) and paint it inline.
          tone: named ? tone : null,
          pulse,
        })}
        style={markStyle}
      />
      {children}
    </span>
  )
}

// `statusDotVariants` is part of the shadcn public API (a screen can put the
// dot style on an element it already renders); the cva() call is not a plain
// constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { StatusDot, statusDotVariants }
export type { StatusDotProps, StatusDotTone }
