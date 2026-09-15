import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useCopy } from "@/ui/copy"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { iconButtonVariants } from "@/components/ui/icon-button"

/**
 * Dialog — Radix Dialog (shadcn/ui) restyled to the RoomScout design system.
 *
 * DS spec:
 * - `design-system/components/core/card/Card.jsx` — `tone="panel"` /
 *   `size="panel"`: `--rs-surface-panel` fill, 1px `--rs-border-panel`,
 *   `--radius-panel` (28px), `--shadow-panel`. No blur, no glow
 *   (`design-system/readme.md` → "Cards").
 * - `design-system/ui_kits/roomscout-app/Settings.jsx` — the settings shell is a
 *   `<Card tone="panel" size="panel" padding={0}>` at `--width-content`
 *   (1380px); `ImportDialog` (`:148`) and `ConnSheet` (`:232`) are the two modal
 *   surfaces: `rgba(18,14,11,.98)` on `var(--rs-border-panel)`, radius 22,
 *   padding `30px 32px`, `box-shadow:0 30px 80px rgba(0,0,0,.5)`,
 *   `animation: rsFadeUp .25s ease both` (scrim `.2s`), and a close control that
 *   is `IconButton variant="subtle" size={40}` with an 18px glyph.
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §1.2 (shell geometry + the port delta
 *   that adds the breadcrumb header and its × button), §6 (discard alert:
 *   440px, 26/28 padding, **20px** radius, title 22/500), §13.1 (import dialog:
 *   640px, 30/32 padding, **22px** radius, title 24/500, `aria-label="Schließen"`).
 * - `docs/UI_PORT/SCOUT_SCREENS.md` §2.9 — the 40px circular close control.
 * - `docs/UI_PORT/TOKENS.md` Part F — F6 modal scrim, F15 "one `rs-fade-up`,
 *   `.2s ease both`" for every ported mount (`.3s` stays with the Roomscout
 *   stage only), C3 `shadow-modal`, C2 radius scale.
 *
 * Scoping (SETTINGS §1.2): inside the shell "all overlays are `position:absolute`
 * **inside the panel**, not viewport-fixed" — §6 (`z-index:30/31`) and §13.1
 * (`20/21`). Pass `container` (plus `portalProps` / `overlayProps` /
 * `overlayClassName` when the scrim needs its own treatment) and both the scrim
 * and the panel switch from `fixed` to `absolute`; a caller `className` still
 * wins over that default.
 *
 * Token folds — the DS value has no token in `src/styles/tokens.css` yet, so the
 * nearest shipped token is used (same policy as `card.tsx` / `sheet.tsx`):
 * - scrim `rgba(6,4,3,.55)` (F6) / `.6` (S §6, §13.1) → `--rs-black` at 55%.
 *   Needs `--rs-scrim` (+ the `.6` step) before it can be exact.
 * - dialog fill `rgba(18,14,11,.98)` (TOKENS B5 `dialog`) → `--rs-surface-menu`
 *   `rgba(20,15,12,.96)`, the nearest surface. Needs `--rs-surface-dialog`.
 * - `shadow-modal` `0 30px 80px rgba(0,0,0,.5)` (S) → `--shadow-card-float`,
 *   which is that same token's Landing step (`…,.35`). Needs `--shadow-modal`.
 * - dialog border `rgba(255,200,160,.16)` (§0.3 `--overlay-border`) →
 *   `--rs-border-panel`; the DS kit itself writes `var(--rs-border-panel)` there
 *   (`Settings.jsx:148`, `:232`), so this fold is sanctioned, not approximate.
 * - the exit animation (`data-[state=closed]`) needs a second keyframe; with one
 *   keyframe name for both states Radix unmounts without waiting, so closing
 *   still pops. Same known gap as `sheet.tsx`.
 * - `--rs-z-scrim 20 / --rs-z-modal 21 / --rs-z-scrim-2 30 / --rs-z-modal-2 31`
 *   (TOKENS §A17) are not shipped either; every layer stays on the shadcn `z-50`
 *   and a nested alert expresses the ladder through `className` /
 *   `overlayClassName` until the tokens land.
 *
 * The shadcn public API (all parts, `data-slot`s, `showCloseButton`) is intact;
 * `tone`, `size`, `container`, `portalProps`, `overlayClassName`,
 * `overlayProps` and the `data-tone` / `data-size` / `data-close-button`
 * attributes are additive. `tone`/`size` are dialog-specific enums and do
 * **not** mirror `Card`'s (`tone: panel|dialog`, `size: sm|md|shell`); the radii
 * they resolve to are DS steps (20 / 22 / 28).
 */

const dialogContentVariants = cva(
  [
    "group/dialog fixed top-1/2 left-1/2 z-50 grid translate-x-[-50%] translate-y-[-50%]",
    "border font-sans text-rs-ink outline-none",
    // The close control's diameter, declared once on the panel: the button
    // sizes itself from it and `DialogHeader` reserves it. 40px is the DS kit's
    // (`Settings.jsx:149`, `:233`; SCOUT §2.9) and is not on the `--size-*`
    // scale (`--size-header-button` is 42), so it stays literal here.
    "[--rs-dialog-close-size:40px]",
    // F15: one `rsFadeUp`, `.2s` — the token's `.3s` is the Roomscout stage.
    "data-[state=open]:animate-rs-fade-up data-[state=open]:[animation-duration:var(--duration-quick)]",
  ].join(" "),
  {
    variants: {
      tone: {
        /** Settings/Operator shell + default surface: translucent panel glass. */
        panel: "bg-rs-surface-panel border-rs-border-panel shadow-panel",
        /** Confirm/import modals: near-opaque, occludes the grain stage. */
        dialog: "bg-rs-surface-menu border-rs-border-panel shadow-card-float",
      },
      size: {
        // 20px is not on the DS radius ladder (…18, 22…) — kept literal, as in
        // `card.tsx` (`Card` size `md`, the same 20px step).
        /** Alert/confirm — SETTINGS §6 ("Änderungen verwerfen?"), 440 · 26/28. */
        sm: "w-[calc(100%_-_var(--space-19))] max-w-[440px] max-h-[calc(100%_-_var(--space-19))] overflow-auto rounded-[20px] p-[var(--space-12)_var(--space-13)] gap-[var(--space-9)]",
        // 32px has no spacing token (the scale jumps 30 → 34); it stays a px
        // pair with the 30px block padding rather than a rem-based `px-8`.
        /** Standard modal — SETTINGS §13.1 (import dialog), 640 · 30/32 · r22. */
        md: "w-[calc(100%_-_var(--space-19))] max-w-[640px] max-h-[calc(100%_-_var(--space-19))] overflow-auto rounded-card-lg px-[32px] py-[var(--space-14)] gap-[var(--space-8)]",
        // §1.2 is `height:100%;min-height:560px` in normal flow under the 84px
        // header. Centred in a fixed box the bare 560px minimum would overflow a
        // short viewport in both directions with nothing able to scroll, so it
        // is clamped to the space that actually exists.
        /** Settings/Operator sidebar-13 shell — SETTINGS §1.2. */
        shell:
          "h-[calc(100dvh_-_var(--size-header)_-_var(--space-16))] min-h-[min(560px,calc(100dvh_-_var(--space-19)))] w-[calc(100%_-_2_*_var(--space-16))] max-w-[var(--width-content)] overflow-hidden rounded-panel p-0 gap-0",
      },
    },
    defaultVariants: {
      tone: "panel",
      size: "md",
    },
  }
)

/**
 * The close control — DS kit `IconButton variant="subtle" size={40}` with an
 * 18px glyph (`Settings.jsx:149`, `:233`; SCOUT §2.9), placed at the dialog's
 * own padding corner so it lands where §13.1's `space-between` header row puts
 * it. German copy per the DS ("Schließen"), on both `aria-label` and `title`.
 */
const dialogCloseVariants = cva(
  cn(
    iconButtonVariants({ variant: "subtle" }),
    // Feeds the diameter custom property `iconButtonVariants` sizes itself
    // from, off the panel's single declaration above.
    "absolute z-10 [--rs-icon-button-size:var(--rs-dialog-close-size,40px)]",
    "[&_svg:not([class*='size-'])]:size-[18px]"
  ),
  {
    variants: {
      size: {
        /** §6 padding 26/28 (that alert ships no × of its own). */
        sm: "top-[var(--space-12)] right-[var(--space-13)]",
        /** §13.1 padding 30/32. */
        md: "top-[var(--space-14)] right-[32px]",
        /** §1.2 puts the shell's × in the breadcrumb header instead. */
        shell: "top-[var(--space-9)] right-[var(--space-9)]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
)

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

/**
 * Modal scrim — TOKENS.md F6, no blur, `.2s` fade (SETTINGS §6 / §13.1 scrim).
 *
 * The DS ships exactly one mount keyframe and it *travels* (`rsFadeUp`, 8px;
 * the prototype's `stFade` is the same shape at 6px), so a scrim that is merely
 * `inset-0` would expose an unpainted strip along the leading edge for the
 * length of the fade. It is therefore bled one travel-step (`--space-3` = 8px,
 * the keyframe's own offset) past every edge; after the animation settles the
 * bleed is invisible on a `fixed` scrim and clipped by the panel's
 * `overflow:hidden` on a scoped one.
 */
const dialogOverlayClasses = cn(
  "fixed -inset-[var(--space-3)] z-50 bg-rs-black/55",
  "data-[state=open]:animate-rs-fade-up data-[state=open]:[animation-duration:var(--duration-quick)]"
)

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(dialogOverlayClasses, className)}
      {...props}
    />
  )
}

type DialogPortalProps = React.ComponentProps<typeof DialogPrimitive.Portal>

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants> & {
    /**
     * Render the built-in 40px circular close button. Defaults to `true`, and
     * to `false` for `size="shell"` — SETTINGS §1.2 puts that × in the
     * breadcrumb header of the content column instead.
     */
    showCloseButton?: boolean
    /**
     * Portal target. Set it to the panel element to keep the scrim and the
     * dialog inside the shell (SETTINGS §1.2); both then position themselves
     * `absolute` rather than `fixed`.
     */
    container?: DialogPortalProps["container"]
    /** Anything else the portal takes (`forceMount`). */
    portalProps?: Omit<DialogPortalProps, "children" | "container">
    /** Scrim classes — e.g. the stronger `.6` step, or a DS z-index step. */
    overlayClassName?: string
    /** Scrim props — e.g. `onClick` for a scrim that dismisses (§13.1). */
    overlayProps?: Omit<
      React.ComponentProps<typeof DialogPrimitive.Overlay>,
      "className"
    >
  }

function DialogContent({
  className,
  children,
  tone = "panel",
  size = "md",
  showCloseButton,
  container,
  portalProps,
  overlayClassName,
  overlayProps,
  ...props
}: DialogContentProps) {
  const { t } = useCopy()
  // §1.2: inside a container every overlay is absolute, not viewport-fixed.
  const scoped = container != null
  // §1.2 port delta: the shell's × lives in its breadcrumb header.
  const withCloseButton = showCloseButton ?? size !== "shell"

  return (
    <DialogPortal container={container} {...portalProps}>
      <DialogOverlay
        // Only the positioning scheme flips; the one-step bleed above has to
        // survive, so `inset-0` must not be re-declared here.
        className={cn(scoped && "absolute", overlayClassName)}
        {...overlayProps}
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-tone={tone}
        data-size={size}
        data-close-button={withCloseButton ? "true" : "false"}
        className={cn(
          dialogContentVariants({ tone, size }),
          scoped && "absolute",
          className
        )}
        {...props}
      >
        {/* First in the DOM, so reading order matches the top-right position
            and Radix's initial focus lands on it — SETTINGS §13.1 focuses
            `importCloseRef` on open. */}
        {withCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            aria-label={t("common.close")}
            title={t("common.close")}
            className={dialogCloseVariants({ size })}
          >
            <XIcon />
          </DialogPrimitive.Close>
        )}
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

/**
 * §6 puts the body 8px under the title; §13.1 lays the title out in a
 * `justify-content:space-between` row *beside* the close button. The port
 * absolutely-positions that button at the padding corner instead, so when it is
 * rendered the header reserves its width (40px) plus the row gap — otherwise a
 * title that wraps toward the right edge runs underneath it.
 */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-[var(--space-3)] text-left",
        "group-data-[close-button=true]/dialog:pe-[calc(var(--rs-dialog-close-size,40px)_+_var(--space-5))]",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-[var(--space-4)] sm:flex-row sm:flex-wrap sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

/** §13.1 import title 24/500; §6 discard title 22/500 (`size="sm"`). */
function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-[24px] leading-[1.2] font-medium text-rs-ink",
        "group-data-[size=sm]/dialog:text-[22px]",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)] text-rs-ink-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
// `dialogContentVariants` is part of the shadcn contract — it lets a composite
// put the dialog skin on a Radix content part it already renders instead of
// duplicating the class string; the cva() call is not a plain constant, so the
// react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { dialogContentVariants }
export type { DialogContentProps }
