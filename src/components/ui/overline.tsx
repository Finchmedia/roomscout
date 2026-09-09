import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * Overline — the DS's uppercase, letter-spaced section label (kicker/eyebrow).
 *
 * DS spec: `design-system/components/core/overline/Overline.jsx` (+ `.d.ts`,
 * `overline.card.html`). The prototype's own catalogue of this atom is
 * `docs/UI_PORT/COMPONENT_MAP.md` §A3 ("Eyebrow label", 36 occurrences across
 * all four surfaces) and §A5 (the same atom reused as the in-page section
 * label of the Settings and Operator screens).
 *
 * Fixed for every instance: `--font-sans`, `--text-overline-size` (12.5px),
 * `text-transform: uppercase`. `tone` picks weight and ink, exactly as
 * `Overline.jsx:5` does:
 *
 * - `tone="muted"` (default) — `--rs-ink-6` at `--weight-regular`. The house
 *   default: the card/section kicker ("RAUM IN STUTTGART-WEST").
 * - `tone="accent"` — `--rs-orange-light` at `--weight-medium`. The "something
 *   happened" label ("ANGEBOT EINGEGANGEN", "FREIGABE NÖTIG").
 *
 * ## Tracking
 *
 * Three values, one per prototype role (`COMPONENT_MAP.md` §A3):
 *
 * | `tracking` | value | role                                                  |
 * | ---------- | ----- | ----------------------------------------------------- |
 * | `default`  | .14em | `--text-overline-tracking` — every kicker and §A5 label |
 * | `offer`    | .16em | the two offer cards only ("Angebot eingegangen" R, "Beispielangebot" L — byte-identical) |
 * | `wide`     | .18em | `--text-overline-tracking-wide` — the landing section kicker ("SO FUNKTIONIERT ROOMSCOUT") |
 *
 * `tracking="auto"` (the default) reproduces `Overline.jsx:5` verbatim —
 * `wide ? '.18em' : tone === 'accent' ? '.16em' : '.14em'` — so no existing prop
 * combination changes shape. The DS JSX collapses two prototype roles into that
 * ternary, though: it hard-wires **every** accent eyebrow to .16em, while the
 * prototype tracks three of the five accent eyebrows at the .14em default
 * (R "Freigabe nötig" `SCOUT_SCREENS.md:948`, S "Demo-Anmeldesimulation"
 * `SETTINGS_SCREENS.md:1052`, O "Simulation" `OPERATOR_SCREENS.md:934`) and
 * reserves .16em for the two offer cards. Those three call sites therefore pass
 * `tracking="default"` rather than overriding the atom through `className`.
 * The DS-faithful ternary stays the *default* because `Overline.jsx` is the
 * specification and `overline.card.html:10` renders `<Overline tone="accent">`
 * at .16em; whether `accent` should instead default to .14em (2 opt-ins instead
 * of 3) is a DS-level decision, not this file's.
 *
 * `wide` is the DS's boolean sugar for `tracking="wide"` and is kept because
 * `Overline.d.ts:10` declares it. An explicit `tracking` wins over it (it is
 * emitted last, and `cn()`'s tailwind-merge keeps the last `tracking-*`).
 *
 * ## Deliberate deviations
 *
 * - **Weight is *not* `--text-overline-weight` (500) for both tones.** The DS
 *   ships muted at 400 and only accent at 500 (`Overline.jsx:5`,
 *   `COMPONENT_MAP.md` §A3), so that per-component token is dead as named — do
 *   not "fix" the muted tone to 500 across 25+ eyebrows. Renaming or deleting
 *   the token belongs to `src/styles/tokens.css` (a verbatim mirror of
 *   `design-system/tokens/typography.css`), not here.
 * - **`.16em` is a literal.** `design-system/tokens/typography.css` ships only
 *   `--text-overline-tracking` (.14em) and `--text-overline-tracking-wide`
 *   (.18em); see `docs/UI_PORT/TOKENS.md` §F20. It is a real, repeated design
 *   value and wants a token (`--text-overline-tracking-offer`), which has to be
 *   added to the DS and its mirror together — outside this file. Written once,
 *   in `overlineTracking.offer`, until then.
 * - **One size only.** `--text-overline-size` (12.5px) is the only size the DS
 *   declares. `COMPONENT_MAP.md` §A3 lists three further prototype eyebrow
 *   sizes, and each is owned by the component that needs it rather than by a
 *   `size` axis here: `landing-panel` 11.5px/.09em by `fact-list.tsx`, the
 *   12px/.14em sidebar label by `sidebar.tsx` (DS `NavGroupLabel`). The two
 *   still unbuilt — `sheet-label` 13px/.12em (Operator diagnosis sheet) and
 *   `brief-label` 12px/.08em (Scout brief panel) — should follow that pattern
 *   or get a `size` axis in the DS first; neither has a token today.
 *
 * A `div` (or any element via `asChild`) with forwardable HTML props and `ref`,
 * so a call site can add `id`, `aria-*`, `style` or its own spacing via
 * `className`. §A5 renders these as the headings of the Settings and Operator
 * dialogs, so `asChild` exists to give them real semantics
 * (`<Overline asChild><h2 id="sources">Deine Quellen</h2></Overline>`, or a
 * `<legend>` / `<dt>` for a grouped control) without losing the `data-slot`
 * hooks that the `overlineVariants` class export drops.
 */
const overlineTracking = {
  /** Resolve from `wide` / `tone`, as `Overline.jsx:5` does. */
  auto: "",
  /** .14em — the DS default signature. */
  default: "tracking-[var(--text-overline-tracking)]",
  /** .16em — both offer cards. No token exists for it yet (see above). */
  offer: "tracking-[.16em]",
  /** .18em — landing section kickers. */
  wide: "tracking-[var(--text-overline-tracking-wide)]",
} as const

const overlineVariants = cva(
  "font-sans text-[length:var(--text-overline-size)] uppercase",
  {
    variants: {
      tone: {
        /** Muted grey-beige kicker — the default. */
        muted: "font-normal text-rs-ink-6",
        /** Orange-light "event" label ("ANGEBOT EINGEGANGEN"). */
        accent: "font-medium text-rs-orange-light",
      },
      /** DS sugar for `tracking="wide"`; an explicit `tracking` wins. */
      wide: {
        true: overlineTracking.wide,
        false: "",
      },
      tracking: overlineTracking,
    },
    // `tracking="auto"` only: the DS ternary, which is tone-dependent and so
    // cannot live in the `tracking` variant itself. `wide` already covers the
    // .18em leg through its own variant.
    compoundVariants: [
      {
        tracking: "auto",
        wide: false,
        tone: "muted",
        class: overlineTracking.default,
      },
      {
        tracking: "auto",
        wide: false,
        tone: "accent",
        class: overlineTracking.offer,
      },
    ],
    defaultVariants: {
      tone: "muted",
      wide: false,
      tracking: "auto",
    },
  }
)

type OverlineProps = React.ComponentProps<"div"> &
  VariantProps<typeof overlineVariants> & {
    /** Render as the single child element (shadcn Slot). */
    asChild?: boolean
  }

function Overline({
  className,
  tone,
  wide,
  tracking,
  asChild = false,
  ...props
}: OverlineProps) {
  const resolvedTone = tone ?? "muted"
  const resolvedWide = wide ?? false
  const resolvedTracking = tracking ?? "auto"
  // Mirrors the `auto` compound variants above, for the DOM hook only.
  const effectiveTracking =
    resolvedTracking !== "auto"
      ? resolvedTracking
      : resolvedWide
        ? "wide"
        : resolvedTone === "accent"
          ? "offer"
          : "default"
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="overline"
      data-tone={resolvedTone}
      data-wide={String(resolvedWide)}
      data-tracking={effectiveTracking}
      className={cn(
        overlineVariants({
          tone: resolvedTone,
          wide: resolvedWide,
          tracking: resolvedTracking,
        }),
        className
      )}
      {...props}
    />
  )
}

// `overlineVariants` is part of the shadcn public API (a screen can put the
// eyebrow type on an existing element — a <dt>, a <legend> — instead of
// rendering an <Overline>); the cva() call is not a plain constant, so the
// react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Overline, overlineVariants }
export type { OverlineProps }
