import * as React from "react"
import { cva } from "class-variance-authority"
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
 * Per the readme, the stack's position never changes between states — hence
 * `position="fixed"` (the default): one viewport-sized backdrop that survives
 * every stage morph. `position="absolute"` is the §2.3 reading, where the
 * layers are siblings inside the absolutely positioned stage frame; use it when
 * the backdrop must be clipped to that frame (the mobile device frame of §2.2).
 *
 * Interaction and stacking follow §2.3 ("all three are non-interactive and sit
 * below every z-index used by content — content starts at `z-index:2`"):
 * the wrapper and the layers are `pointer-events-none`, so a bare
 * `<StageBackground />` used as a pure backdrop never swallows a click, and the
 * content column re-enables pointer events at `z-index:2`. The layers carry
 * `aria-hidden`, being decorative.
 *
 * A plain `div` with forwardable HTML props (`id`, `style`, `aria-*`, `ref`),
 * so `AppShell` can address it directly.
 */
const stageBackgroundVariants = cva(
  "pointer-events-none inset-0 overflow-hidden bg-rs-surface-page",
  {
    variants: {
      position: {
        /** Viewport backdrop — never moves between stages. The default. */
        fixed: "fixed",
        /** Clipped to the nearest positioned ancestor (the stage frame). */
        absolute: "absolute",
      },
    },
    defaultVariants: {
      position: "fixed",
    },
  }
)

interface StageBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `fixed` (default) pins the stack to the viewport; `absolute` to the frame. */
  position?: "fixed" | "absolute"
  /** Classes for the `z-index:2` content column that holds `children`. */
  contentClassName?: string
  children?: React.ReactNode
  style?: React.CSSProperties
  /** React 19 ref-as-prop — the backdrop node itself. */
  ref?: React.Ref<HTMLDivElement>
}

function StageBackground({
  className,
  contentClassName,
  position = "fixed",
  children,
  ...props
}: StageBackgroundProps) {
  const hasContent = children !== undefined && children !== null

  return (
    <div
      data-slot="stage-background"
      data-position={position}
      className={cn(stageBackgroundVariants({ position }), className)}
      {...props}
    >
      <div className="rs-bg pointer-events-none" aria-hidden="true">
        <div className="rs-grain" />
      </div>
      {hasContent ? (
        <div
          data-slot="stage-background-content"
          className={cn(
            "pointer-events-auto relative z-[2] flex h-full flex-col",
            contentClassName
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  )
}

// `stageBackgroundVariants` is part of the shadcn public API (AppShell may need
// the same classes on a wrapper it owns); the cva() call is not a plain
// constant, so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { StageBackground, stageBackgroundVariants }
export type { StageBackgroundProps }
