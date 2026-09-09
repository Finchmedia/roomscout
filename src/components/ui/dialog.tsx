import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/components/ui/button"

/**
 * Dialog — Radix Dialog (shadcn/ui) restyled to the RoomScout design system.
 *
 * DS spec:
 * - `design-system/components/core/card/Card.jsx` — `tone="panel"` / `size="panel"`:
 *   `--rs-surface-panel` fill, 1px `--rs-border-panel`, `--radius-panel` (28px),
 *   `--shadow-panel`. No blur, no glow (`design-system/readme.md` → "Cards").
 * - `design-system/ui_kits/roomscout-app/Settings.jsx` — the settings shell is a
 *   `<Card tone="panel" size="panel" padding={0}>` at `--width-content` (1380px).
 * - `design-system/components/core/icon-button/IconButton.jsx` — `variant="outline"`,
 *   42px circle (`--size-header-button`): `--rs-surface-subtle` on
 *   `--rs-border-control`, hover `--rs-surface-hover`. Used for the close button.
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §1.2 (shell geometry + the port delta that
 *   adds the close button), §6 (discard alert: 440px, 26/28 padding, 20px radius),
 *   §13 / `COMPONENT_MAP.md` D-import (import dialog: 640px, 30/32 padding).
 * - `docs/UI_PORT/SCOUT_SCREENS.md` §2.9 — transcript sheet close button.
 * - `docs/UI_PORT/TOKENS.md` Part F — F6 modal scrim `rgba(6,4,3,.55)` (rendered
 *   here as `--rs-black` at 55%, the nearest token), F15 one `rsFadeUp` entrance.
 *
 * Deliberate deviations from the prototype, per the port brief:
 * - Every `DialogContent` carries the panel skin and `--radius-panel`; only
 *   `size="sm"` keeps the compact 22px `--radius-card-lg` of the alert dialogs.
 * - `tone="dialog"` is the near-opaque modal fill (`--rs-surface-menu`) for
 *   confirm/import dialogs that must fully occlude the grain background.
 *
 * The shadcn public API (all parts, `data-slot`s, `showCloseButton`) is intact;
 * `tone` and `size` are additive.
 */

const dialogContentVariants = cva(
  "fixed top-1/2 left-1/2 z-50 grid translate-x-[-50%] translate-y-[-50%] border font-sans text-rs-ink outline-none data-[state=open]:animate-rs-fade-up",
  {
    variants: {
      tone: {
        /** Settings/Operator shell + default surface: translucent panel glass. */
        panel: "bg-rs-surface-panel border-rs-border-panel shadow-panel",
        /** Confirm/import modals: near-opaque, occludes the grain stage. */
        dialog: "bg-rs-surface-menu border-rs-border-panel shadow-card-float",
      },
      size: {
        /** Alert/confirm — SETTINGS_SCREENS §6 ("Änderungen verwerfen?"). */
        sm: "w-[calc(100%_-_var(--space-19))] max-w-[440px] max-h-[calc(100%_-_var(--space-19))] overflow-auto rounded-card-lg p-[var(--space-12)_var(--space-13)] gap-[var(--space-9)]",
        // 32px has no spacing token (the scale jumps 30 → 34), so the Tailwind
        // step is used for the inline padding; everything else is --space-*.
        /** Standard modal — SETTINGS_SCREENS §13 (import dialog). */
        md: "w-[calc(100%_-_var(--space-19))] max-w-[640px] max-h-[calc(100%_-_var(--space-19))] overflow-auto rounded-panel py-[var(--space-14)] px-8 gap-[var(--space-9)]",
        /** Settings/Operator sidebar-13 shell — SETTINGS_SCREENS §1.2. */
        shell:
          "h-[calc(100dvh_-_120px)] min-h-[560px] w-[calc(100%_-_2_*_var(--space-16))] max-w-[var(--width-content)] overflow-hidden rounded-panel p-0 gap-0",
      },
    },
    defaultVariants: {
      tone: "panel",
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

/** Modal scrim — TOKENS.md F6: dark, no blur, one `rsFadeUp` entrance. */
function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-rs-black/55 data-[state=open]:animate-rs-fade-up",
        className
      )}
      {...props}
    />
  )
}

/**
 * The close control: IconButton `outline` at 42px (`--size-header-button`),
 * top-right. Copy is German per the DS ("Schließen").
 */
const dialogCloseButtonClasses =
  "absolute top-[var(--space-9)] right-[var(--space-9)] z-10 inline-flex size-[var(--size-header-button)] shrink-0 cursor-pointer items-center justify-center rounded-circle border border-rs-border-control bg-rs-surface-subtle text-rs-ink transition-colors duration-[var(--duration-quick)] ease-out-soft hover:bg-rs-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]"

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof dialogContentVariants> & {
    /** Render the built-in 42px circular close button. */
    showCloseButton?: boolean
  }

function DialogContent({
  className,
  children,
  tone = "panel",
  size = "md",
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-tone={tone}
        data-size={size}
        className={cn(dialogContentVariants({ tone, size }), className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={dialogCloseButtonClasses}
          >
            <XIcon />
            <span className="sr-only">Schließen</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-[var(--space-3)] text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-[var(--space-4)] sm:flex-row sm:flex-wrap sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Schließen</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-[22px] leading-[1.2] font-medium tracking-[-.01em] text-rs-ink",
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
export type { DialogContentProps }
