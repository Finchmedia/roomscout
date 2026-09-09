import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * StageBackground — the one continuous dark grain stage every RoomScout screen
 * sits on. Photo (mirrored, desaturated) → protection gradient → grain overlay,
 * as one non-interactive backdrop; `children` render above it.
 *
 * DS reference: `design-system/tokens/base.css` (`.rs-bg` / `.rs-grain`, the
 * classes this component composes) and `design-system/guidelines/
 * brand-background.html` (the three-step specimen card). Prototype source of
 * truth: `docs/UI_PORT/SCOUT_SCREENS.md` §2.3 ("Background layers", lines
 * 29–31) and §2.1/§2.2 (root container / stage frame). Placement in the port:
 * `docs/UI_PORT/COMPONENT_MAP.md` §4.1–4.2 (`ui/chrome/StageBackground.tsx`,
 * mounted first inside `<StageFrame>`).
 *
 * The three layers come from `src/styles/tokens.css` §(d), which mirrors
 * `base.css` verbatim, so no value is restated here:
 *   1. `.rs-bg::before` — `--bg-image` (`/design/bg.jpg`) `cover` at `50% 30%`,
 *      `inset:-2%` (bleeds the mirrored/filtered edges out of frame),
 *      `filter:var(--bg-image-filter)` (saturate .62 · brightness .5) and
 *      `transform:scaleX(-1)`.
 *   2. `.rs-bg::after` — `--bg-gradient`, the protection scrim (warm amber .28
 *      at the top → near-black petrol .92 at the bottom).
 *   3. `.rs-grain` — `--bg-grain` (`/design/grain.svg`) at
 *      `--bg-grain-opacity` (.28) with `mix-blend-mode: overlay`.
 * `.rs-bg` also paints `--surface-page` under the photo; the wrapper repeats it
 * as `bg-rs-surface-page` so the ground is correct before the image decodes.
 *
 * `.rs-grain` is a SIBLING that follows `.rs-bg`, never its child: `::after`
 * (the scrim) is the last box of `.rs-bg` in tree order, so a nested grain
 * would paint *under* the scrim and its `mix-blend-mode: overlay` would blend
 * against the bare photo only — the grain all but disappears at the bottom of
 * the stage, where the scrim is .92 opaque. Both DS kits mount them flat
 * (`ui_kits/roomscout-app/App.jsx:89`, `ui_kits/landing/Landing.jsx:17`), as
 * does `guidelines/brand-background.html` panel 3. (The usage comment in
 * `src/styles/tokens.css` §(d) shows the nested form and is wrong.)
 *
 * `position="absolute"` is the default: §2.3 has the layers as siblings inside
 * the stage frame and §4.2 mounts this first inside `<StageFrame>`, whose §2.2
 * phone mode is a 390×844 rounded 44px `overflow:hidden` box — a `fixed`
 * backdrop would escape that clip and would not ride the frame's
 * `transition:width .4s,height .4s,border-radius .4s`. `position="fixed"` is
 * for a backdrop that must span the viewport behind a scrolling document, the
 * landing page's `<div style="position:fixed;inset:0;z-index:0">` wrapper.
 *
 * Interaction and stacking follow §2.3 ("all three are non-interactive and sit
 * below every z-index used by content — content starts at `z-index:2`"):
 * the wrapper and the layers are `pointer-events-none`, so a bare
 * `<StageBackground />` used as a pure backdrop never swallows a click, and the
 * content column re-enables pointer events at `z-index:2`. The column is only
 * rendered when `children` actually produce a node, so
 * `<StageBackground>{cond && <Stage/>}</StageBackground>` with a false `cond`
 * stays a pure backdrop instead of laying an invisible click trap over the
 * stage. The layers carry `aria-hidden`, being decorative.
 *
 * The content column does NOT scroll: per §2.6 the scrolling surface is the
 * `<main>` inside the frame (`overflow:auto;overflow-x:hidden`), so the caller
 * owns it. The column is a `min-h-0` flex column precisely so a child marked
 * `flex-1 min-h-0 overflow-auto` can scroll inside it; content taller than the
 * frame is otherwise clipped by the wrapper's `overflow-hidden` (`.rs-bg`
 * needs it for the `inset:-2%` photo bleed). Use `contentClassName` to reach
 * the column when the layout needs more than that.
 *
 * A plain `div` with forwardable HTML props (`id`, `style`, `aria-*`, `ref`),
 * so `AppShell` can address it directly.
 */
const stageBackgroundVariants = cva(
  "pointer-events-none inset-0 overflow-hidden bg-rs-surface-page",
  {
    variants: {
      position: {
        /** Clipped to the nearest positioned ancestor (the stage frame). */
        absolute: "absolute",
        /** Viewport backdrop behind a scrolling document (the landing page). */
        fixed: "fixed",
      },
    },
    defaultVariants: {
      position: "absolute",
    },
  }
)

type StageBackgroundProps = React.ComponentProps<"div"> &
  VariantProps<typeof stageBackgroundVariants> & {
    /** Classes for the `z-index:2` content column that holds `children`. */
    contentClassName?: string
  }

function StageBackground({
  className,
  contentClassName,
  position = "absolute",
  children,
  ...props
}: StageBackgroundProps) {
  // `toArray` drops `null` / `undefined` / booleans, so a short-circuited
  // child (`{cond && <Stage/>}`) renders no column at all.
  const hasContent = React.Children.toArray(children).length > 0

  return (
    <div
      data-slot="stage-background"
      data-position={position}
      className={cn(stageBackgroundVariants({ position }), className)}
      {...props}
    >
      <div className="rs-bg pointer-events-none" aria-hidden="true" />
      <div className="rs-grain" aria-hidden="true" />
      {hasContent ? (
        <div
          data-slot="stage-background-content"
          className={cn(
            "pointer-events-auto relative z-2 flex h-full min-h-0 flex-col",
            contentClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

export { StageBackground }
export type { StageBackgroundProps }
