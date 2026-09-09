import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * ScoutBlob — the RoomScout assistant presence: an organic orange blob with a
 * restrained local glow. It is *the Scout* on a screen; it free-floats and is
 * never boxed into a card, never ringed, never paired with an audio meter, and
 * there is exactly one per screen (`ScoutBlob.prompt.md`).
 *
 * DS reference: `design-system/components/core/scout-blob/`
 * (`ScoutBlob.jsx`, `ScoutBlob.d.ts`, `ScoutBlob.prompt.md`,
 * `scout-blob.card.html`) and `design-system/guidelines/brand-blob.html`.
 * Prototype source of truth: `docs/UI_PORT/SCOUT_SCREENS.md` §3.
 *
 * Structure verbatim from `ScoutBlob.jsx:6-12`: an `aria-hidden` outer box of
 * `size` × `size` with `flex:none` (the layout slot), and an inner `100%/100%`
 * node carrying the whole look — `--blob-shape`
 * (`62% 38% 46% 54% / 44% 58% 42% 56%`), `--blob-gradient` (the four-stop warm
 * radial), the glow shadow and the animation, plus `transition:box-shadow .6s`
 * (`--duration-slower`, timing function `ease` — the CSS initial value the DS
 * shorthand implies) so toggling `glow` fades rather than snaps.
 *
 * **Size.** `size` is a plain number of px because every stage picks its own
 * (`SCOUT_SCREENS.md` §3.3: 168 · 160 · 118 · 110 · 96 · 72 · 64 · 58, and the
 * narrow-viewport 128 / 120 / 112 / 104 / 88). It is written to the local
 * `--scout-blob-size` custom property, which is set on *every* render — with
 * `var(--size-blob-welcome)` (168px, the DS default expressed as its token) when
 * `size` is left out. The property is deliberately never read through a CSS
 * fallback: custom properties inherit, so a `--…-blob-size` set by some ancestor
 * (a stage driving its `[data-blob-anchor]` boxes, say) would otherwise silently
 * resize every default-size blob beneath it. The name is component-scoped for
 * the same reason. The other DS sizes have tokens too: `--size-blob-working`
 * 160, `--size-blob-brief` 96, `--size-blob-small` 58.
 *
 * **Glow.** `glow` (default true) selects the DS's size-aware pair: the wide
 * double shadow `--shadow-blob` at ≥ 80px, the single tight `--shadow-blob-sm`
 * below it (`ScoutBlob.jsx:9`), so a 58px inline blob does not smear the line it
 * sits in. `glow={false}` removes it entirely. The swap is driven by the `size`
 * **prop**: a caller that sizes the blob some other way (inline `width`/`height`
 * — see the teleport note below) keeps the wide `--shadow-blob`, which is what
 * the prototype does at every size (§3.1). A shell that wants the tight glow
 * from a *measured* box passes that box to the exported `resolveScoutBlobGlow`.
 *
 * **State.** `idle` breathes (`rsBreathe`, 5.2s — `--blob-breathe-duration`),
 * `speaking` is livelier (`rsSpeak`, 1.6s), `listening` rotates calmly
 * (`rsListen`, 3.2s), `thinking` is `rsBreathe` at the prototype's 2.4s
 * (§3.4 — set right after a user utterance while facts are extracted), `still`
 * does not move. The keyframes live in `src/styles/tokens.css` and animate
 * `transform` *and* `border-radius`, which is what makes the shape read as
 * organic rather than as a spinning circle; they are reached through the
 * `animate-rs-breathe` / `-speak` / `-listen` utilities generated from that
 * file's `@theme` block. `motion-reduce` collapses every state to `still`
 * (part of the cva base, so the exported variants carry it too). An out-of-
 * contract `state` — the Scout shell maps a backend `scoutState` string onto
 * this prop — falls back to `idle` rather than to no animation at all, matching
 * the DS's `ANIM[state] || ANIM.idle`.
 *
 * The prototype's `speaking` / `listening` timings differ slightly from the DS
 * (§3.4: 1.7s / 4.2s vs. 1.6s / 3.2s). The DS is the declared spec, so the atom
 * ships 1.6s / 3.2s. A stage that must restore a prototype cadence overrides
 * `animation-duration` on the **body** node — `className` lands on the outer
 * layout box, which carries no animation, so the override has to reach the body
 * through its `data-slot`:
 *
 * ```tsx
 * <ScoutBlob
 *   state="speaking"
 *   className="[&>[data-slot=scout-blob-body]]:[animation-duration:1.7s]"
 * />
 * ```
 *
 * The blob is *measured, not laid out* (§3.2): the Scout shell keeps a single
 * node and teleports it onto the active `[data-blob-anchor]`. `ref` and every
 * div attribute (`style`, `className`, `data-*`) are forwarded so that shell can
 * position and animate the node it holds, and `style` is merged last so a
 * caller-supplied `width`/`height`/`position` wins over the size property —
 * exactly as the DS spreads `...style` after its own. `data-state` is the one
 * attribute written *after* `{...props}`: it is derived from `state` together
 * with the animation class, and letting a caller desynchronise the two would
 * make the DOM lie about what the blob is doing. It is mirrored onto the body so
 * `[data-slot=scout-blob-body][data-state=speaking]` is a usable style hook.
 *
 * **Accessibility.** `aria-hidden="true"` matches the DS and the prototype: the
 * blob is decoration, it has no accessible name and no role. But `speaking` and
 * `listening` (mic on) are meaningful *application* state, so the consuming
 * Scout shell **MUST** carry that state non-visually itself — an `aria-live`
 * status region announcing the Scout's turn, and in particular an unmistakable
 * announcement whenever the microphone opens or closes. Do not solve this by
 * passing `aria-hidden={false}`; that only exposes an empty unlabelled div.
 *
 * ```tsx
 * <ScoutBlob />                                  // 168, idle, glowing
 * <ScoutBlob size={96} state="speaking" />
 * <ScoutBlob size={58} state="listening" />
 * <ScoutBlob size={44} state="still" glow={false} />
 * ```
 */

/**
 * The blob body. Exported as part of the shadcn public API: the Scout shell
 * teleports a raw node between anchors and can need the same classes without
 * mounting a second `<ScoutBlob>`. Note the variant is `glowSize`, not `glow` —
 * the DS prop `glow` is a boolean and the two vocabularies must not collide on
 * one name; `resolveScoutBlobGlow` turns the prop pair into the variant value.
 */
const scoutBlobVariants = cva(
  [
    "size-full bg-[image:var(--blob-gradient)] rounded-[var(--blob-shape)]",
    // DS `transition: box-shadow .6s` — the shorthand omits a timing function,
    // so the CSS initial value `ease` applies. Tailwind's `transition-shadow`
    // would otherwise inject `--default-transition-timing-function`
    // (cubic-bezier(.4,0,.2,1)), which is a different curve.
    "transition-shadow duration-[var(--duration-slower)]",
    "[transition-timing-function:ease]",
    // `prefers-reduced-motion` reduces the Scout to `still`. tokens.css:270
    // already crushes every animation-duration to .01ms globally, which would
    // freeze the blob mid-keyframe; dropping the animation instead lands it on
    // its resting shape. It lives in the base so consumers that apply
    // `scoutBlobVariants(…)` to their own node inherit the collapse.
    "motion-reduce:animate-none",
  ].join(" "),
  {
    variants: {
      /** DS `ANIM` map (`ScoutBlob.jsx:3`) as the `@theme` animation utilities. */
      state: {
        idle: "animate-rs-breathe",
        speaking: "animate-rs-speak",
        listening: "animate-rs-listen",
        /**
         * Prototype-only (`SCOUT_SCREENS.md` §3.4): `rsBreathe 2.4s`. The DS has
         * no token for 2.4s, so only the duration of the token-driven shorthand
         * is overridden; the arbitrary property sorts after `animate-*` and
         * before `motion-reduce:animate-none` in the generated sheet.
         */
        thinking: "animate-rs-breathe [animation-duration:2.4s]",
        still: "animate-none",
      },
      /** Resolved from `glow` + `size` by `resolveScoutBlobGlow`, per `ScoutBlob.jsx:9`. */
      glowSize: {
        /** ≥ 80px — the wide two-layer glow. */
        lg: "shadow-blob",
        /** < 80px — the tight single glow, for inline and tiny blobs. */
        sm: "shadow-blob-sm",
        /** `glow={false}`. */
        none: "shadow-none",
      },
    },
    defaultVariants: {
      state: "idle",
      glowSize: "lg",
    },
  }
)

/** The DS animation states, derived from the cva so the two cannot drift. */
type ScoutBlobState = NonNullable<VariantProps<typeof scoutBlobVariants>["state"]>

/** The resolved shadow step. Not a public prop — see `resolveScoutBlobGlow`. */
type ScoutBlobGlowSize = NonNullable<
  VariantProps<typeof scoutBlobVariants>["glowSize"]
>

/**
 * Runtime membership test for `state`. `Record<ScoutBlobState, true>` makes TS
 * fail the build if a cva state is added without being listed here.
 */
const SCOUT_BLOB_STATES: Record<ScoutBlobState, true> = {
  idle: true,
  speaking: true,
  listening: true,
  thinking: true,
  still: true,
}

function isScoutBlobState(value: string): value is ScoutBlobState {
  return Object.prototype.hasOwnProperty.call(SCOUT_BLOB_STATES, value)
}

/** Below this diameter the DS swaps to `--shadow-blob-sm` (`ScoutBlob.jsx:9`). */
const TIGHT_GLOW_BELOW = 80

/**
 * The DS's `glow ? (size < 80 ? sm : lg) : none` rule (`ScoutBlob.jsx:9`) as the
 * `glowSize` variant value. Exported so a shell that sizes a teleported raw node
 * from a *measured* anchor box can pick the same shadow the component would:
 *
 * ```ts
 * scoutBlobVariants({ state, glowSize: resolveScoutBlobGlow(true, rect.width) })
 * ```
 *
 * An unknown `size` stays on the wide glow — the DS default diameter
 * (`--size-blob-welcome`, 168px) is far above the threshold.
 */
function resolveScoutBlobGlow(
  glow: boolean,
  size?: number
): ScoutBlobGlowSize {
  if (!glow) return "none"
  return size !== undefined && size < TIGHT_GLOW_BELOW ? "sm" : "lg"
}

/** `style` that may carry the blob's own custom property. */
type ScoutBlobStyle = React.CSSProperties & Record<`--${string}`, string>

interface ScoutBlobProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Diameter in px. Welcome 168, working 160, brief 96, inline 58, tiny 44. */
  size?: number
  /** idle = slow breathing; speaking = livelier; listening = calmer rotation; thinking = quick breathing; still = no animation. */
  state?: ScoutBlobState
  /**
   * Local orange glow (default true). Deliberately *not*
   * `VariantProps<typeof scoutBlobVariants>` (the shadcn convention used by
   * `badge.tsx`): the DS prop is a boolean and the cva step is `glowSize`.
   */
  glow?: boolean
  /** React 19 ref-as-prop — the node the Scout shell measures and teleports. */
  ref?: React.Ref<HTMLDivElement>
}

function ScoutBlob({
  className,
  size,
  state = "idle",
  glow = true,
  style,
  ...props
}: ScoutBlobProps) {
  // Mirrors the DS's `ANIM[state] || ANIM.idle`: an out-of-contract value that
  // slipped past the types (a backend `scoutState`, an `as` cast, JSON) breathes
  // instead of standing dead still.
  const resolvedState: ScoutBlobState = isScoutBlobState(state) ? state : "idle"

  // Always written, never left to a CSS fallback — see the "Size" note above.
  const sizeVar: ScoutBlobStyle = {
    "--scout-blob-size":
      size === undefined ? "var(--size-blob-welcome)" : `${size}px`,
  }

  return (
    <div
      aria-hidden="true"
      data-slot="scout-blob"
      className={cn("size-(--scout-blob-size) flex-none", className)}
      style={{ ...sizeVar, ...style }}
      {...props}
      // After `{...props}`: `data-state` and the body's animation class are
      // derived from the same `state`, so they must not be overridable apart.
      data-state={resolvedState}
    >
      <div
        data-slot="scout-blob-body"
        data-state={resolvedState}
        className={scoutBlobVariants({
          state: resolvedState,
          glowSize: resolveScoutBlobGlow(glow, size),
        })}
      />
    </div>
  )
}

// `scoutBlobVariants` and `resolveScoutBlobGlow` are part of the shadcn public
// API (the teleported node is a raw div, not a <ScoutBlob>, and needs the same
// classes); neither is a plain constant, so the react-refresh rule cannot see
// them as one.
// eslint-disable-next-line react-refresh/only-export-components
export { ScoutBlob, scoutBlobVariants, resolveScoutBlobGlow }
export type { ScoutBlobProps, ScoutBlobState, ScoutBlobGlowSize }
