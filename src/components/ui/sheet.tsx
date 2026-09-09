import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { iconButtonVariants } from "@/components/ui/icon-button"

/**
 * Sheet — Radix Dialog (shadcn/ui) restyled to the RoomScout design system.
 *
 * DS spec — two different surfaces share this primitive:
 * - `design-system/ui_kits/roomscout-app/ScreensA.jsx` → `BottomSheet` and
 *   `docs/UI_PORT/SCOUT_SCREENS.md` §4.4 — the narrow-viewport sheet. One
 *   element in two states that **morph** into each other over `.6s`
 *   `--ease-out-soft`: the discovery *pill* (`variant="pill"` — inset 12px,
 *   radius 20px, padding `8px 14px 8px`, title 15/500) and the brief-review
 *   *card* (`variant="card"` — full-bleed, radius `26px 26px 0 0`, padding
 *   `22px 22px 26px`, title 22/400). Both: `background:rgba(18,14,12,.92)`,
 *   `border:1px solid --rs-border-panel`, `backdrop-filter:blur(10px)`,
 *   `display:flex;flex-direction:column;gap:4px`, `max-height:78%`,
 *   `overflow:auto`, `box-shadow:0 -20px 60px rgba(0,0,0,.4)` (cast **upward**)
 *   and an explicit `text-align:left`, because the stage around it is centred.
 * - `docs/UI_PORT/SCOUT_SCREENS.md` §2.9 — the right-edge transcript panel:
 *   `--rs-surface-drawer` (`rgba(14,11,9,.94)`), `min(420px,100%)`,
 *   `border-left: --rs-border-card-soft`, **no** shadow, `rsFadeUp .3s` entrance,
 *   and a two-part body: an 84px `flex:none` header row (`padding:0 24px`,
 *   `space-between`, 17/500 title, 40px circular close with
 *   `aria-label="Mitschrift schließen"`) over a `flex:1;overflow:auto` body
 *   (`padding:4px 24px 24px`, `gap:14px`).
 *
 * Parts map to the spec like this: `SheetHeader` is §4.4's title row / §2.9's
 * 84px header row (it switches shape on `data-side`), `SheetBody` is §2.9's
 * scrolling body, `SheetFooter` is §4.4's `shActions` stack. **`SheetContent`
 * itself does not scroll** — that is what keeps the close control reachable —
 * so anything that can outgrow the panel belongs in `SheetBody`.
 *
 * Deliberate deviations from the DS, and why:
 * - Fill for `top`/`bottom`: the spec is `rgba(18,14,12,.92)`, catalogued in
 *   `docs/UI_PORT/TOKENS.md` (§"Surfaces") as `--rs-sheet` and explicitly
 *   distinct from `--rs-side-panel` (`rgba(14,11,9,.94)` = the shipped
 *   `--rs-surface-drawer`). `--rs-sheet` is **not in `src/styles/tokens.css`
 *   yet**, so the drawer surface stands in and the sheet renders 2% more opaque
 *   and marginally cooler than spec. Needs `--rs-surface-sheet` (same token-fold
 *   policy as `dialog.tsx` / `card.tsx`).
 * - Shadow colour: TOKENS C3 `shadow-sheet` (`0 -20px 60px rgba(0,0,0,.4)`) is
 *   not in `tokens.css` either. The *geometry* is written out literally so the
 *   cast stays upward on `bottom` (mirrored downward on `top`); the colour is
 *   `--rs-black` (`#0b0a09`) at 40%, the same near-black fold `dialog.tsx` uses
 *   for the scrim. Needs `--shadow-sheet`. `left`/`right` carry no shadow at
 *   all, per §2.9.
 * - Title size 22px (§4.4 `shTitleSize`) has no step on the type scale
 *   (`--text-body-lg-size` 17px → `--text-card-title-size` clamp(24…32px)), so
 *   it is a px literal here exactly as in `dialog.tsx` (`text-[22px]` for the
 *   §6 alert title). Needs `--text-sheet-title-size`. Same for the pill's 20px
 *   radius, which is off the DS radius ladder (18 / 22) — `dialog.tsx` keeps
 *   that step literal too.
 * - Close-button hover is `--rs-surface-hover` (white .10) where §2.9 asks for
 *   white .12; `tokens.css` ships the .04/.06/.07/.10 ladder only and
 *   `design-system/readme.md` sanctions ".04 → .1" as *the* hover rule. Needs
 *   TOKENS' `--rs-hover-3` (.12) before it can be exact.
 * - `max-height:78%` becomes `max-h-[78dvh]`: the prototype's sheet is
 *   `position:absolute` inside the mobile stage frame, so its 78% is 78% *of the
 *   stage*; a shadcn `Sheet` is viewport-fixed and has no such container.
 * - Entrance is the one DS mount animation, `rsFadeUp .3s` — exactly §2.9's,
 *   and `dialog.tsx`'s policy (TOKENS F15) for §4.4, which has no entrance of
 *   its own because it morphs. There is **no exit animation**: that needs a
 *   second keyframe in `tokens.css` (with one keyframe name for both states
 *   Radix unmounts without waiting), the same known gap as `dialog.tsx`. The
 *   stock `slide-in-from-*` utilities need `tw-animate-css`, which this project
 *   does not ship.
 * - The scrim is a shadcn carry-over, not DS: §4.4 is `z-index:6` over the stage
 *   with no backdrop and §2.9 is `z-index:9`, both below TOKENS' modal scrim at
 *   20. Ported screens that want the prototype's non-modal layer pass
 *   `showOverlay={false}` (plus `modal={false}` on `Sheet`).
 * - `top` has no DS counterpart at all; it is defined here as the mirror of the
 *   mobile sheet and therefore carries the same blur, which `readme.md` (l.33,
 *   l.42) reserves for the composer, the mobile sheet and the landing header —
 *   a port decision, not something the readme licenses.
 * - `--blur-sheet` is applied through two arbitrary properties so the
 *   `-webkit-` prefix is emitted as well; Safari < 18 needs it, and Tailwind
 *   only emits both from its own `backdrop-blur-*` utilities, which cannot take
 *   a whole `blur()` token. `composer.tsx` wants the same treatment.
 *
 * The shadcn public API (all parts, every `data-slot`, `side`,
 * `showCloseButton`, the close button as a direct `<button>` child so
 * `[&>button]:hidden` in `sidebar.tsx` keeps working) is intact. `variant`,
 * `showOverlay`, `closeLabel`, `SheetBody` and `data-side` / `data-variant` are
 * additive; `showCloseButton` now *defaults* per side (see below).
 */

/** The four anchors, as the plain shadcn union (never `null`). */
type SheetSide = "top" | "right" | "bottom" | "left"

/** §4.4's two states of the mobile sheet. Ignored on `left` / `right`. */
type SheetVariant = "card" | "pill"

const sheetContentVariants = cva(
  [
    "group/sheet fixed z-50 flex flex-col overflow-hidden font-sans text-rs-ink outline-none",
    // §4.4 sets `text-align:left` explicitly because the Discovery and Brief
    // stages it sits in are `text-align:center`.
    "text-left",
    // §2.9's entrance; the port's single mount animation (TOKENS F15).
    "data-[state=open]:animate-rs-fade-up",
  ].join(" "),
  {
    variants: {
      side: {
        /** Mirror of the bottom sheet — same skin, radius on the lower edge. */
        top: [
          "top-0 right-0 left-0 h-auto max-h-[78dvh]",
          "border border-rs-border-panel bg-rs-surface-drawer",
          "shadow-[0_20px_60px_color-mix(in_srgb,var(--rs-black)_40%,transparent)]",
          "[backdrop-filter:var(--blur-sheet)] [-webkit-backdrop-filter:var(--blur-sheet)]",
          "transition-[left,right,top,border-radius,padding] duration-[var(--duration-slower)] ease-out-soft",
        ].join(" "),
        /** Transcript drawer — SCOUT_SCREENS §2.9. 420px has no width token. */
        right:
          "top-0 right-0 bottom-0 h-full w-[min(420px,100%)] border-l border-rs-border-card-soft bg-rs-surface-drawer",
        /** Mobile sheet — SCOUT_SCREENS §4.4; `variant` picks pill or card. */
        bottom: [
          "right-0 bottom-0 left-0 h-auto max-h-[78dvh]",
          "border border-rs-border-panel bg-rs-surface-drawer",
          "shadow-[0_-20px_60px_color-mix(in_srgb,var(--rs-black)_40%,transparent)]",
          "[backdrop-filter:var(--blur-sheet)] [-webkit-backdrop-filter:var(--blur-sheet)]",
          // §4.4's pill → card morph.
          "transition-[left,right,bottom,border-radius,padding] duration-[var(--duration-slower)] ease-out-soft",
        ].join(" "),
        /** Mirror of the transcript drawer. */
        left: "top-0 bottom-0 left-0 h-full w-[min(420px,100%)] border-r border-rs-border-card-soft bg-rs-surface-drawer",
      },
      variant: {
        /** Geometry comes from the compound variants below. */
        card: "",
        pill: "",
      },
    },
    compoundVariants: [
      /** §4.4 `sheetCard=true`: full-bleed, `26px 26px 0 0`, `22px 22px 26px`. */
      {
        side: "bottom",
        variant: "card",
        class:
          "gap-[var(--space-1)] rounded-t-card-2xl p-[var(--space-10)_var(--space-10)_var(--space-12)]",
      },
      {
        side: "top",
        variant: "card",
        class:
          "gap-[var(--space-1)] rounded-b-card-2xl p-[var(--space-12)_var(--space-10)_var(--space-10)]",
      },
      /** §4.4 `sheetCard=false`: inset 12px, radius 20px, `8px 14px 8px`. */
      {
        side: "bottom",
        variant: "pill",
        class:
          "right-[var(--space-5)] bottom-[var(--space-5)] left-[var(--space-5)] gap-[var(--space-1)] rounded-[20px] p-[var(--space-3)_var(--space-6)_var(--space-3)]",
      },
      {
        side: "top",
        variant: "pill",
        class:
          "top-[var(--space-5)] right-[var(--space-5)] left-[var(--space-5)] gap-[var(--space-1)] rounded-[20px] p-[var(--space-3)_var(--space-6)_var(--space-3)]",
      },
    ],
    defaultVariants: {
      side: "right",
      variant: "card",
    },
  }
)

/**
 * Close control — SCOUT_SCREENS §2.9: the DS `IconButton variant="subtle"` at
 * 40px with an 18px glyph, sitting where the 84px header row's `space-between`
 * would put it (24px from the right edge, centred on the row). On `top` /
 * `bottom` it lands on the sheet's own 22px padding corner.
 */
const sheetCloseVariants = cva(
  cn(
    iconButtonVariants({ variant: "subtle" }),
    // 40px is not on the DS control-size scale (`--size-header-button` is 42),
    // but it is on the spacing scale; it feeds the diameter custom property
    // `iconButtonVariants` sizes itself from, as in `dialog.tsx`.
    "absolute z-10 [--rs-icon-button-size:var(--space-17)] [&_svg:not([class*='size-'])]:size-[var(--space-8)]"
  ),
  {
    variants: {
      side: {
        top: "top-[var(--space-10)] right-[var(--space-10)]",
        right:
          "top-[calc((var(--size-header)-var(--space-17))/2)] right-[var(--space-11)]",
        bottom: "top-[var(--space-10)] right-[var(--space-10)]",
        left: "top-[calc((var(--size-header)-var(--space-17))/2)] right-[var(--space-11)]",
      },
    },
    defaultVariants: {
      side: "right",
    },
  }
)

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

/**
 * Scrim — TOKENS F6 modal scrim, rendered as `--rs-black` at 55%. Neither DS
 * sheet has one (see the deviation list); `showOverlay={false}` opts out.
 *
 * The 8px negative block inset compensates `rsFadeUp`'s opening
 * `translateY(8px)`, which would otherwise leave an undimmed 8px band at the
 * top of the viewport for the length of the entrance. It can go once
 * `tokens.css` ships a translate-free `--animate-rs-fade` (`dialog.tsx` needs
 * the same one).
 */
function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-x-0 top-[calc(var(--space-3)*-1)] bottom-[calc(var(--space-3)*-1)] z-50 bg-rs-black/55 data-[state=open]:animate-rs-fade-up",
        className
      )}
      {...props}
    />
  )
}

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> & {
  /** Anchor edge. `left`/`right` are §2.9 drawers, `top`/`bottom` §4.4 sheets. */
  side?: SheetSide
  /** §4.4's two states of the mobile sheet; ignored on `left` / `right`. */
  variant?: SheetVariant
  /**
   * Render the built-in 40px circular close button. Defaults per side: the DS
   * ships one only on the §2.9 edge drawer, while §4.4's card has a pencil and
   * its pill a chevron toggle — so `left`/`right` default to `true`,
   * `top`/`bottom` to `false`.
   */
  showCloseButton?: boolean
  /** Render the scrim. `false` gives the DS's non-modal in-stage layer. */
  showOverlay?: boolean
  /** Accessible name of the built-in close (§2.9: „Mitschrift schließen“). */
  closeLabel?: string
}

function SheetContent({
  className,
  children,
  side = "right",
  variant = "card",
  showCloseButton,
  showOverlay = true,
  closeLabel = "Schließen",
  ...props
}: SheetContentProps) {
  const isEdge = side === "left" || side === "right"
  // The pill is §4.4's mobile-sheet state; the edge drawers have no such shape.
  const resolvedVariant: SheetVariant = isEdge ? "card" : variant
  const closeVisible = showCloseButton ?? isEdge

  return (
    <SheetPortal>
      {showOverlay ? <SheetOverlay /> : null}
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        data-variant={resolvedVariant}
        className={cn(
          sheetContentVariants({ side, variant: resolvedVariant }),
          // Reserves room for the close button in `SheetHeader`, so a long
          // title never runs under it. 40px control + 12px gap.
          closeVisible &&
            "[--rs-sheet-close-reserve:calc(var(--space-17)+var(--space-5))]",
          className
        )}
        {...props}
      >
        {children}
        {closeVisible && (
          <SheetPrimitive.Close
            data-slot="sheet-close-button"
            aria-label={closeLabel}
            title={closeLabel}
            className={sheetCloseVariants({ side })}
          >
            <XIcon />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

/**
 * Title row. Two shapes, picked from the sheet's `data-side`:
 * - `top`/`bottom` — §4.4's title block, `padding:6px 4px` inside the sheet's
 *   own `22px 22px 26px` (the container's 4px gap does the rest).
 * - `left`/`right` — §2.9's header row: `height:84px`, `flex:none`,
 *   `padding:0 24px`, `align-items:center`, `justify-content:space-between`.
 */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-[var(--space-1)] py-[var(--space-2)] pl-[var(--space-1)] text-left",
        "pr-[calc(var(--space-1)+var(--rs-sheet-close-reserve,0px))]",
        "group-[:is([data-side=left],[data-side=right])]/sheet:h-[var(--size-header)]",
        "group-[:is([data-side=left],[data-side=right])]/sheet:flex-none",
        "group-[:is([data-side=left],[data-side=right])]/sheet:flex-row",
        "group-[:is([data-side=left],[data-side=right])]/sheet:items-center",
        "group-[:is([data-side=left],[data-side=right])]/sheet:justify-between",
        "group-[:is([data-side=left],[data-side=right])]/sheet:gap-[var(--space-5)]",
        "group-[:is([data-side=left],[data-side=right])]/sheet:py-0",
        "group-[:is([data-side=left],[data-side=right])]/sheet:pl-[var(--space-11)]",
        "group-[:is([data-side=left],[data-side=right])]/sheet:pr-[calc(var(--space-11)+var(--rs-sheet-close-reserve,0px))]",
        className
      )}
      {...props}
    />
  )
}

/**
 * The scrolling body — §2.9 `flex:1;overflow:auto;padding:4px 24px 24px;gap:14px`
 * on the edge drawers; on `top`/`bottom` the sheet's own padding already frames
 * it, so it only brings the scroll box. `SheetContent` deliberately does not
 * scroll (the close button is anchored to it), so long content belongs here.
 */
function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto",
        "group-[:is([data-side=left],[data-side=right])]/sheet:gap-[var(--space-6)]",
        "group-[:is([data-side=left],[data-side=right])]/sheet:px-[var(--space-11)]",
        "group-[:is([data-side=left],[data-side=right])]/sheet:pt-[var(--space-1)]",
        "group-[:is([data-side=left],[data-side=right])]/sheet:pb-[var(--space-11)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Action stack — §4.4 `shActions`: `margin-top:14px`, column, **centred**, 12px
 * gap. The sheet's `26px` bottom padding closes it off, so the footer brings no
 * padding of its own.
 */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-[var(--space-6)] flex flex-col items-center gap-[var(--space-5)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * §2.9 „Mitschrift“ is 17/500; §4.4's `shTitleSize`/`shTitleWeight` are 22/400
 * in the card and 15/500 in the pill, with `transition:font-size .4s` across the
 * morph (.4s has no token — folded to `--duration-slow`). Neither spec declares
 * a letter-spacing or a line-height, so neither is set here.
 */
function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "text-[length:var(--text-body-lg-size)] font-medium text-rs-ink",
        "transition-[font-size] duration-[var(--duration-slow)] ease-out-soft",
        // 22px has no step on the type scale — see the deviation list.
        "group-[[data-side=bottom][data-variant=card]]/sheet:text-[22px] group-[[data-side=bottom][data-variant=card]]/sheet:font-normal",
        "group-[[data-side=top][data-variant=card]]/sheet:text-[22px] group-[[data-side=top][data-variant=card]]/sheet:font-normal",
        "group-data-[variant=pill]/sheet:text-[length:var(--text-body-sm-size)] group-data-[variant=pill]/sheet:font-medium",
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
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  // eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
  sheetContentVariants,
}
export type { SheetContentProps, SheetSide, SheetVariant }
