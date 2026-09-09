import * as React from "react"
import { cva } from "class-variance-authority"
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
 * (`--duration-slower`) so toggling `glow` fades rather than snaps.
 *
 * **Size.** `size` is a plain number of px because every stage picks its own
 * (`SCOUT_SCREENS.md` §3.3: 168 · 160 · 118 · 110 · 96 · 72 · 64 · 58, and the
 * narrow-viewport 128 / 120 / 112 / 104 / 88). It is written to the local
 * `--rs-blob-size` custom property; left out, the box falls through to
 * `--size-blob-welcome` (168px) — the DS default expressed as its token rather
 * than as a literal. The other DS sizes have tokens too: `--size-blob-working`
 * 160, `--size-blob-brief` 96, `--size-blob-small` 58.
 *
 * **Glow.** `glow` (default true) is the DS's size-aware pair: the wide double
 * shadow `--shadow-blob` at ≥ 80px, the single tight `--shadow-blob-sm` below
 * it (`ScoutBlob.jsx:9`), so the inline 58px blob does not smear the line it
 * sits in. `glow={false}` removes it entirely.
 *
 * **State.** `idle` breathes (`rsBreathe`, 5.2s — `--blob-breathe-duration`),
 * `speaking` is livelier (`rsSpeak`, 1.6s), `listening` rotates calmly
 * (`rsListen`, 3.2s), `still` does not move. The keyframes live in
 * `src/styles/tokens.css` and animate `transform` *and* `border-radius`, which
 * is what makes the shape read as organic rather than as a spinning circle;
 * they are reached through the `animate-rs-breathe` / `-speak` / `-listen`
 * utilities generated from that file's `@theme` block. `motion-reduce`
 * collapses every state to `still`.
 *
 * The prototype's own timings differ slightly per trigger (§3.4: speaking 1.7s,
 * listening 4.2s, plus a `thinking` state that is `rsBreathe` at 2.4s). Those
 * are stage choreography, not the atom's contract — the DS component ships the
 * four states above; a stage that wants the `thinking` cadence overrides
 * `animation-duration` through `className` on this element.
 *
 * The blob is *measured, not laid out* (§3.2 / §2019): the Scout shell keeps a
 * single node and teleports it onto the active `[data-blob-anchor]`. `ref` and
 * every div attribute (`style`, `className`, `data-*`) are forwarded so that
 * shell can position and animate the node it holds, and `style` is merged last
 * so a caller-supplied `width`/`height`/`position` wins over the size property
 * — exactly as the DS spreads `...style` after its own.
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
 * mounting a second `<ScoutBlob>`.
 */
const scoutBlobVariants = cva(
  [
    "size-full bg-[image:var(--blob-gradient)] rounded-[var(--blob-shape)]",
    "transition-shadow duration-[var(--duration-slower)]",
  ].join(" "),
  {
    variants: {
      /** DS `ANIM` map (`ScoutBlob.jsx:3`) as the `@theme` animation utilities. */
      state: {
        idle: "animate-rs-breathe",
        speaking: "animate-rs-speak",
        listening: "animate-rs-listen",
        still: "animate-none",
      },
      /** Resolved from `glow` + `size`, per `ScoutBlob.jsx:9`. */
      glow: {
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
      glow: "lg",
    },
  }
)

/** DS default diameter, kept as `--size-blob-welcome` in CSS. */
const DEFAULT_SIZE = 168

/** Below this diameter the DS swaps to `--shadow-blob-sm` (`ScoutBlob.jsx:9`). */
const TIGHT_GLOW_BELOW = 80

/** `style` that may carry the blob's own custom property. */
type ScoutBlobStyle = React.CSSProperties & Record<`--${string}`, string>

interface ScoutBlobProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Diameter in px. Welcome 168, working 160, brief 96, inline 58, tiny 44. */
  size?: number
  /** idle = slow breathing; speaking = livelier; listening = calmer rotation; still = no animation. */
  state?: "idle" | "speaking" | "listening" | "still"
  /** Local orange glow (default true). */
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
  const sizeVar: ScoutBlobStyle | undefined =
    size === undefined ? undefined : { "--rs-blob-size": `${size}px` }

  const glowVariant = !glow
    ? "none"
    : (size ?? DEFAULT_SIZE) < TIGHT_GLOW_BELOW
      ? "sm"
      : "lg"

  return (
    <div
      aria-hidden="true"
      data-slot="scout-blob"
      data-state={state}
      className={cn(
        "size-[var(--rs-blob-size,var(--size-blob-welcome))] flex-none",
        className
      )}
      style={sizeVar ? { ...sizeVar, ...style } : style}
      {...props}
    >
      <div
        data-slot="scout-blob-body"
        className={cn(
          scoutBlobVariants({ state, glow: glowVariant }),
          // `prefers-reduced-motion` reduces the Scout to `still`. tokens.css
          // already crushes every animation-duration to .01ms globally, which
          // would freeze the blob mid-keyframe; dropping the animation instead
          // lands it on its resting shape.
          "motion-reduce:animate-none"
        )}
      />
    </div>
  )
}

// `scoutBlobVariants` is part of the shadcn public API (the teleported node is
// a raw div, not a <ScoutBlob>, and needs the same classes); the cva() call is
// not a plain constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { ScoutBlob, scoutBlobVariants }
export type { ScoutBlobProps }
