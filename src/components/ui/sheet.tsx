import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

/**
 * Sheet — Radix Dialog (shadcn/ui) restyled to the RoomScout design system.
 *
 * DS spec:
 * - `design-system/ui_kits/roomscout-app/ScreensA.jsx` → `BottomSheet` — the
 *   narrow-viewport sheet: `--blur-sheet` backdrop, 1px `--rs-border-panel`,
 *   `26px 26px 0 0` top radius in its full-bleed card variant, `max-height:78%`,
 *   `overflow:auto`, and a title row at the top of the panel.
 * - `docs/UI_PORT/SCOUT_SCREENS.md` §4.4 — the same sheet, binding by binding
 *   (`shSide` / `shBottom` / `shRadius` / `shPad` / `shTitleSize`), plus §2.9,
 *   the right-edge transcript sheet (`--rs-surface-drawer`, `min(420px,100%)`,
 *   `border-left: --rs-border-card-soft`, 40px circular close button).
 * - `design-system/readme.md` → "Cards" / "Transparency & blur": blur is
 *   reserved for the composer, the mobile sheet and the landing header — so the
 *   left/right drawers stay unblurred, only top/bottom carry `--blur-sheet`.
 *
 * Deliberate deviations from the prototype, per the port brief:
 * - The fill is `--rs-surface-drawer` for every side (the prototype's
 *   `rgba(18,14,12,.92)` bottom-sheet fill has no token; the drawer surface is
 *   the shipped one and is what §2.9 already uses).
 * - `--shadow-sheet` (`0 -20px 60px …`, upward) does not exist in
 *   `src/styles/tokens.css`; `--shadow-menu` is the nearest tokenised panel
 *   shadow and is used on every side.
 * - Entrance is the single DS animation `rsFadeUp` (as in `dialog.tsx`); the
 *   `slide-in-from-*` utilities of stock shadcn need `tw-animate-css`, which
 *   this project does not ship, so they were no-ops.
 * - The collapsible pill variant of §4.4 (inset 12px, 20px radius, chevron
 *   toggle) is not modelled here — 20px is not on the DS radius scale and the
 *   pill is a bespoke FactList affordance, not a modal sheet.
 *
 * The shadcn public API (all parts, every `data-slot`, `side`,
 * `showCloseButton`, the close button as a direct `<button>` child so
 * `[&>button]:hidden` in `sidebar.tsx` keeps working) is intact; the cva
 * variants and `data-side` are additive.
 */

const sheetContentVariants = cva(
  "group/sheet fixed z-50 flex flex-col bg-rs-surface-drawer font-sans text-rs-ink shadow-menu outline-none data-[state=open]:animate-rs-fade-up",
  {
    variants: {
      side: {
        /** Mirror of the bottom sheet — same skin, radius on the lower edge. */
        top: "inset-x-0 top-0 h-auto max-h-[78dvh] overflow-y-auto rounded-b-card-2xl border-b border-rs-border-panel [backdrop-filter:var(--blur-sheet)]",
        /** Transcript drawer — SCOUT_SCREENS §2.9. 420px has no width token. */
        right:
          "inset-y-0 right-0 h-full w-[min(420px,100%)] border-l border-rs-border-card-soft",
        /** Mobile bottom sheet — SCOUT_SCREENS §4.4, `sheetCard` variant. */
        bottom:
          "inset-x-0 bottom-0 h-auto max-h-[78dvh] overflow-y-auto rounded-t-card-2xl border-t border-rs-border-panel [backdrop-filter:var(--blur-sheet)]",
        /** Mirror of the transcript drawer. */
        left: "inset-y-0 left-0 h-full w-[min(420px,100%)] border-r border-rs-border-card-soft",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

/**
 * Close control — SCOUT_SCREENS §2.9: 40px circle, `--rs-surface-subtle-2`
 * fill, hover `--rs-surface-hover`, 18px icon. German copy per the DS.
 */
const sheetCloseButtonClasses =
  "absolute top-[var(--space-10)] right-[var(--space-10)] z-10 inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-circle bg-rs-surface-subtle-2 text-rs-ink transition-colors duration-(--duration-quick) ease-out-soft hover:bg-rs-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

/** Scrim — TOKENS.md F6 modal scrim, rendered as `--rs-black` at 55%. */
function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-rs-black/55 data-[state=open]:animate-rs-fade-up",
        className
      )}
      {...props}
    />
  )
}

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetContentVariants> & {
    /** Render the built-in 40px circular close button. */
    showCloseButton?: boolean
  }

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(sheetContentVariants({ side }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            className={sheetCloseButtonClasses}
          >
            <XIcon />
            <span className="sr-only">Schließen</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

/**
 * Title row of the panel — §4.4 `shPad` (22px inline / top, tight below the
 * title so the rows underneath sit close, as in the mock).
 */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-[var(--space-1)] p-[var(--space-10)] pb-[var(--space-3)] text-left",
        className
      )}
      {...props}
    />
  )
}

/** Action stack — §4.4 `shActions`: column, 12px gap, 26px bottom padding. */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col gap-[var(--space-5)] px-[var(--space-10)] pt-[var(--space-6)] pb-[var(--space-12)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * §4.4 `shTitleSize` / `shTitleWeight`: 22px regular in the bottom (and top)
 * sheet, 17px medium in the side drawers (§2.9 „Mitschrift“).
 */
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "text-[length:var(--text-body-lg-size)] leading-[1.3] font-medium tracking-[-.01em] text-rs-ink",
        "group-data-[side=bottom]/sheet:text-[22px] group-data-[side=bottom]/sheet:leading-[1.2] group-data-[side=bottom]/sheet:font-normal",
        "group-data-[side=top]/sheet:text-[22px] group-data-[side=top]/sheet:leading-[1.2] group-data-[side=top]/sheet:font-normal",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        "text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)] text-rs-ink-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
}
export type { SheetContentProps }
