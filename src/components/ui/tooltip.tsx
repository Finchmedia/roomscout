"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Tooltip as TooltipPrimitive } from "radix-ui"

/**
 * Tooltip — shadcn/ui primitive restyled to the RoomScout design system.
 *
 * DS reference: `design-system/components/feedback/hint/Hint.jsx`
 * (the prototype has no tooltip of its own; `Hint` is the quiet, non-conversational
 * note surface and therefore the spec for a floating micro-label).
 *
 * Surface `--rs-surface-hint`, 1px `--rs-border-card` hairline, `--radius-control`,
 * 13.5px (`--text-caption-sm-size`) in `--rs-ink-2`, `--shadow-toast`; the arrow is
 * filled with the same surface. Motion is the DS `rsFadeUp` enter
 * (`animate-rs-fade-up`), which `prefers-reduced-motion` collapses globally in
 * `src/styles/tokens.css`.
 *
 * The Radix/shadcn API and every `data-slot` are preserved; `showArrow` is the only
 * addition on top.
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
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

type TooltipContentProps = React.ComponentProps<
  typeof TooltipPrimitive.Content
> & {
  /** Render the DS arrow (same surface as the content). Defaults to `true`. */
  showArrow?: boolean
}

function TooltipContent({
  className,
  /** --space-2 (6px): the hairline surface floats clear of its trigger. */
  sideOffset = 6,
  showArrow = true,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin)",
          "rounded-control border border-rs-border-card bg-rs-surface-hint shadow-toast",
          "px-[var(--space-7)] py-[var(--space-4)]",
          "font-sans text-[length:var(--text-caption-sm-size)] text-rs-ink-2 text-balance",
          "animate-rs-fade-up",
          className
        )}
        {...props}
      >
        {children}
        {showArrow ? (
          <TooltipPrimitive.Arrow
            data-slot="tooltip-arrow"
            width={12}
            height={6}
            className="fill-rs-surface-hint"
          />
        ) : null}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
export type { TooltipContentProps }
