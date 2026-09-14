"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip as TooltipPrimitive } from "radix-ui"

/**
 * Tooltip — shadcn/ui primitive restyled to the RoomScout design system.
 *
 * DS reference: the prototype ships **no** tooltip
 * (`design-system/components/` has no such directory, and a grep for
 * `polygon|arrow` across it returns icon paths only). Two DS sources define the
 * surface instead:
 *  · `design-system/components/feedback/hint/Hint.jsx` — the quiet,
 *    non-conversational note; the nearest thing to a micro-label.
 *  · `design-system/components/feedback/toast/Toast.jsx` — the DS's *floating*
 *    surface, whose fill/shadow family a tooltip belongs to.
 *
 * `docs/UI_PORT/TOKENS.md` resolves the split explicitly: §B5 (line 1635) files
 * the tooltip under the `toast` role, and §F5 collapses the three near-identical
 * fills (`rgba(24,17,13,.96)` R toast · `rgba(28,20,14,.92)` R hint bar ·
 * `rgba(28,20,14,.96)` S toast) onto **`rgba(24,17,13,.96)` = `--rs-surface-toast`**,
 * with the hairline canonicalised to `rgba(255,200,160,.22)`. A floating label
 * over the photo stage must occlude (`readme.md` → "Transparency & blur":
 * blur is reserved for the composer, the mobile sheet and the landing header,
 * so a tooltip gets its legibility from opacity alone).
 *
 * Geometry, and where each value comes from:
 *  · `border-radius:12px` → `--radius-control-lg` (`rounded-control-lg`) —
 *    `Hint.jsx:5` and `src/components/ui/hint.tsx:57`; `TOKENS.md` §C2 lists 12
 *    as the default card / menu / toast radius. (An earlier port used
 *    `--radius-control` (10px), which matched neither source.)
 *  · border `rgba(255,200,160,.2)` (`Hint.jsx:5`, and `TOKENS.md` line 270
 *    names that exact alpha "Tooltip border") → `--rs-border-card-strong` (.18),
 *    the nearest shipped step and the same fold `hint.tsx` documents; §F9
 *    records that the whole `.10…30` ladder reads interchangeably over the dark
 *    ground. `--rs-border-card` (.14) is the *default card* step — one step too
 *    quiet for a surface that has to read as detached from the page.
 *  · padding `12px / 6px` → `--space-5` / `--space-2`. NOT `Hint.jsx`'s
 *    `10px 16px`: that is the geometry of a 560px-wide bottom-centre notice
 *    bar, and around a one- or two-word icon-button label it is visually
 *    heavier than any other floating surface in the system. 12/6 is shadcn's
 *    own tooltip padding (`px-3 py-1.5`) and sits on the DS spacing grid;
 *    `Toast.jsx:7` is the same order of magnitude (`12px 12px 12px 16px`).
 *  · `max-width:560px` → `Hint.jsx:5`, ported literally as in `hint.tsx:56`
 *    (560 has no token: `--width-card-narrow` is 380, `--width-card` 720). It
 *    is a *cap*, not a target — without it a long German label runs to the
 *    viewport edge and the inherited `text-balance` never engages, because
 *    balancing only takes effect once the text wraps.
 *  · `13.5px` (`--text-caption-sm-size`) in `--rs-ink-2` on
 *    `--text-body-leading` (1.5). The DS pins leading on every multi-line
 *    surface (the bubble body in `bubble.tsx` is 1.45); `src/styles/app.css` sets none on
 *    `body`, and Tailwind's `text-[length:…]` emits no paired leading, so
 *    wrapped copy would otherwise fall back to `normal`.
 *  · `--shadow-toast` — `readme.md` → "Shadows": floating surfaces (menu,
 *    toast, panel) carry the deep black shadows.
 *
 * Motion: `rsFadeUp` at `--duration-quick` (.2s), gated on `data-[state=open]`
 * like `dropdown-menu.tsx` and `sheet.tsx`. `TOKENS.md` §F15 canonicalises the
 * mount animation to `.2s ease both` and keeps `.3s` (`--duration-base`, what
 * `animate-rs-fade-up` resolves to) "only for the Roomscout stage where it is
 * deliberately slower" — a hover label opened at `delayDuration = 0` is not the
 * stage. `prefers-reduced-motion` collapses the enter globally in
 * `src/styles/tokens.css`.
 *
 * Known limits, deliberately not solved here (both would need new keyframes in
 * `src/styles/tokens.css`, which this atom does not own):
 *  · **No exit animation.** shadcn's `data-[state=closed]:animate-out` needs
 *    `tw-animate-css`, which this project does not ship — the same reason
 *    `sheet.tsx` documents dropping `slide-in-from-*`. The DS floating surfaces
 *    unmount without one (see `dropdown-menu.tsx`).
 *  · **The enter is not side-aware.** `rsFadeUp` always runs
 *    `translateY(8px) → 0`, so a `side="top"` label rises *away* from its
 *    trigger and a `side="left"` / `"right"` one moves on the other axis. This
 *    is the DS's single mount animation, used everywhere regardless of
 *    direction; the four `data-[side=*]:slide-in-from-*` utilities that shadcn
 *    solves it with are unavailable here.
 *
 * Additions on top of the shadcn API (the API itself, and every `data-slot`,
 * is intact — including the `TooltipProvider` that shadcn nests inside
 * `Tooltip` so a standalone `<Tooltip>` works: without it Radix's
 * `useTooltipProviderContext` throws, and the only provider mounted in this app
 * is the one inside `SidebarProvider`):
 *  · `showArrow` on `TooltipContent` — **off by default.** The DS draws no
 *    pointer on any floating surface (Toast, ProfileMenu, the settings popup
 *    menu); its idiom for "this points at that" is a clipped corner
 *    (the chat bubble's `18px 18px 4px 18px` in `bubble.tsx`). Opt in per
 *    call site.
 *  · `portalProps` on `TooltipContent` — pass `{ container }` to portal into
 *    the dialog content. Settings and Operator run inside
 *    `Dialog > SidebarProvider` (sidebar-13) and `SETTINGS_SCREENS.md:1265`
 *    puts tooltips on their icon buttons; Radix Dialog marks everything outside
 *    its content `aria-hidden`, including nodes inserted later, so a tooltip
 *    left on `document.body` would leave the trigger's `aria-describedby`
 *    pointing at a subtree screen readers cannot reach.
 *  · `TooltipPortal` / `TooltipArrow` are re-exported, so a call site never has
 *    to reach past this layer into `radix-ui` (which would let an unstyled
 *    Radix arrow into the tree).
 *
 * **Disabled triggers.** A `disabled` button fires no pointer or focus events,
 * so `<TooltipTrigger asChild>` on one is inert and the tooltip never opens —
 * yet `SETTINGS_SCREENS.md:548` puts the *explanation* of why an action is
 * unavailable in exactly that place („Diese Beispielquelle ist im Prototyp
 * nicht angebunden."). Render such a control with `aria-disabled` instead of
 * `disabled` and neutralise it yourself:
 *
 *   <TooltipTrigger asChild>
 *     <Button aria-disabled data-disabled onClick={(e) => e.preventDefault()}>
 *       Nicht verfügbar
 *     </Button>
 *   </TooltipTrigger>
 *
 * — style the "off" look off `[aria-disabled=true]` / `data-disabled`, keep the
 * element focusable, and do NOT set `pointer-events:none` on it. Alternatively
 * leave the control `disabled` and put the trigger on a focusable
 * `<span tabIndex={0}>` wrapped around it.
 */

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipPortal({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Portal>) {
  return <TooltipPrimitive.Portal data-slot="tooltip-portal" {...props} />
}

/**
 * The pointer. Rendered as shadcn does it — a rotated square, not Radix's bare
 * `<polygon>` — because only a square can carry the DS hairline: a triangle's
 * SVG fill has no stroke, so the content's 1px outline would stop dead at the
 * arrow's base and the two slanted edges would be unbordered.
 *
 * Radix's popper wrapper rotates this element per `side` (see
 * `@radix-ui/react-popper` `PopperArrow`), so after the local 45° the **right**
 * and **bottom** borders are always the two outward-facing edges; the other two
 * sit inside the content and stay borderless. `translate-y` pulls the diamond
 * up over the content's own border line so no seam shows through the
 * translucent fill. `fill-none` hides Radix's polygon — the visible shape is
 * this element's own box.
 *
 * Not on a token: the 2px overlap and the 2px corner rounding. The DS spacing
 * scale starts at `--space-1` (4px) and `TOKENS.md` §C2 files 2–3px radii as
 * unnamed one-offs, so both stay literal (as 560px does in `hint.tsx`).
 */
function TooltipArrow({
  className,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Arrow>) {
  return (
    <TooltipPrimitive.Arrow
      data-slot="tooltip-arrow"
      aria-hidden="true"
      focusable="false"
      className={cn(
        // --space-4 (10px): the diamond's unrotated edge.
        "size-[var(--space-4)] translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]",
        "border-r border-b border-rs-border-card-strong bg-rs-surface-toast fill-none",
        className
      )}
      {...props}
    />
  )
}

interface TooltipContentProps
  extends React.ComponentProps<typeof TooltipPrimitive.Content> {
  /**
   * Render the DS pointer. Defaults to `false` — the design system draws no
   * arrow on any floating surface. With it on, drop `sideOffset` to ~0 so the
   * tip reaches the trigger.
   */
  showArrow?: boolean
  /**
   * Forwarded to `TooltipPortal`. Pass `{ container }` to mount the tooltip
   * inside a Radix `DialogContent` instead of `document.body`.
   */
  portalProps?: React.ComponentProps<typeof TooltipPrimitive.Portal>
}

function TooltipContent({
  className,
  /** --space-2 (6px): the hairline surface floats clear of its trigger. */
  sideOffset = 6,
  showArrow = false,
  portalProps,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPortal {...portalProps}>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          // The popper-computed origin. `rsFadeUp` never scales, so nothing
          // observes it today; it is kept for shadcn parity (and so a call site
          // layering its own zoom via `className` lands correctly), exactly as
          // `dropdown-menu.tsx` keeps its own.
          "z-50 w-fit max-w-[560px] origin-(--radix-tooltip-content-transform-origin)",
          "rounded-control-lg border border-rs-border-card-strong bg-rs-surface-toast shadow-toast",
          "px-[var(--space-5)] py-[var(--space-2)]",
          "font-sans text-[length:var(--text-caption-sm-size)] leading-[var(--text-body-leading)] text-rs-ink-2 text-balance",
          "data-[state=open]:animate-[rsFadeUp_var(--duration-quick)_ease_both]",
          className
        )}
        {...props}
      >
        {children}
        {showArrow ? <TooltipArrow /> : null}
      </TooltipPrimitive.Content>
    </TooltipPortal>
  )
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
  TooltipPortal,
  TooltipArrow,
}
export type { TooltipContentProps }
