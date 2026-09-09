import * as React from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner"

import { cn } from "@/lib/utils"

/**
 * RoomScout toast — the sonner primitive restyled to the design-system Toast.
 *
 * DS reference: `design-system/components/feedback/toast/`
 * (`Toast.jsx`, `Toast.d.ts`, `Toast.prompt.md`, `toast.card.html`).
 * Behaviour, anchor and copy: `docs/UI_PORT/SCOUT_SCREENS.md` §2.7 / §18.2.
 *
 * The shadcn API is preserved: `<Toaster />` takes the same `ToasterProps`,
 * `className` / `style` / `toastOptions` are merged onto the DS defaults rather
 * than replaced, and every other prop still overrides ours. `showToast()` adds
 * the DS semantics on top: orange dot + message + „Zum Scout“ pill + ghost X.
 *
 * Styling note — sonner injects its stylesheet into <head> at runtime, i.e.
 * *unlayered*, so it beats every Tailwind utility (those live in
 * `@layer utilities`) no matter the specificity. The DS look therefore goes
 * through the three channels that do win: sonner's own CSS-variable contract
 * (`--normal-bg`, `--normal-border`, `--border-radius`, `--width`), inline
 * styles, and — only for states inline styles cannot express (`:hover`,
 * `:focus-visible`) — Tailwind utilities with the `!` important modifier.
 * All three carry tokens from `src/styles/tokens.css`; no raw values.
 */

/** DS default action label (Toast.jsx), verbatim. */
const DS_ACTION_LABEL = "Zum Scout"
/** DS dismiss `aria-label` (Toast.jsx / SCOUT_SCREENS.md §18.2), verbatim. */
const DS_DISMISS_LABEL = "Schließen"

/**
 * DS anchor: „Positioned top-right under the header (right 24, top 96)“
 * (Toast.prompt.md). 96px = the 84px header plus 12px, both tokens; 24px is
 * `--space-11`. In the prototype the toast is absolute inside the stage frame —
 * as a fixed sonner toaster the same numbers become the viewport offset.
 */
const DS_OFFSET = {
  top: "calc(var(--size-header) + var(--space-5))",
  right: "var(--space-11)",
}

/**
 * Toaster-level variables. `--normal-*` are sonner's own hooks, so the DS
 * surface, hairline and radius land through sonner's rules instead of fighting
 * them. `--width: max-content` makes the toast hug its message the way the DS
 * `inline-flex` Toast does, instead of sonner's fixed 356px column.
 */
const DS_TOASTER_STYLE = {
  fontFamily: "var(--font-sans)",
  "--normal-bg": "var(--rs-surface-toast)",
  "--normal-text": "var(--text-body)",
  "--normal-border": "var(--rs-border-accent-soft)",
  "--normal-bg-hover": "var(--rs-surface-hover)",
  "--normal-border-hover": "var(--rs-border-control-strong)",
  "--border-radius": "var(--radius-card-sm)",
  "--width": "max-content",
} as React.CSSProperties

/** DS Toast box: padding 12/12/12/16, gap 14, 15px ink, `--shadow-toast`. */
const DS_TOAST_STYLE: React.CSSProperties = {
  padding: "var(--space-5) var(--space-5) var(--space-5) var(--space-7)",
  gap: "var(--space-6)",
  fontSize: "var(--text-body-sm-size)",
  boxShadow: "var(--shadow-toast)",
  // max-content still needs a ceiling on narrow viewports.
  maxWidth: "min(90vw, var(--width-card-narrow))",
}

/** DS action pill: 34px tall, 0/14 padding, orange, white ink, 13.5px, 600. */
const DS_ACTION_BUTTON_STYLE: React.CSSProperties = {
  flex: "none",
  height: "var(--space-15)",
  padding: "0 var(--space-6)",
  marginInline: 0,
  borderRadius: "var(--radius-pill)",
  backgroundColor: "var(--rs-orange)",
  color: "var(--text-on-accent)",
  fontSize: "var(--text-caption-sm-size)",
  fontWeight: "var(--weight-semibold)",
  transition: "background-color var(--duration-quick) var(--ease-out-soft)",
}

/**
 * DS dismiss: 30px ghost circle, muted ink, no fill. `order: 1` moves it behind
 * the action pill — sonner renders the cancel button before the action one.
 */
const DS_CANCEL_BUTTON_STYLE: React.CSSProperties = {
  order: 1,
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "var(--space-14)",
  height: "var(--space-14)",
  padding: 0,
  marginInline: 0,
  borderRadius: "var(--radius-circle)",
  backgroundColor: "transparent",
  color: "var(--text-muted)",
  transition: "color var(--duration-quick) var(--ease-out-soft)",
}

/** DS message row: the 8px orange dot, then the message at regular weight. */
const DS_MESSAGE_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-6)",
  fontWeight: "var(--weight-regular)",
}

const DS_DOT_STYLE: React.CSSProperties = {
  flex: "none",
  width: "var(--space-3)",
  height: "var(--space-3)",
  borderRadius: "var(--radius-circle)",
  backgroundColor: "var(--rs-orange)",
}

/** DS X icon: 14×14, stroke 2 (lucide's default). */
const DS_DISMISS_ICON_STYLE: React.CSSProperties = {
  width: "var(--space-6)",
  height: "var(--space-6)",
}

/**
 * State-only overrides. Every property here is one sonner sets in its unlayered
 * stylesheet, so each utility carries the `!` important modifier — that is what
 * lets an author rule beat both sonner's CSS and our own inline styles.
 */
const DS_FOCUS_RING =
  "focus-visible:shadow-none! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-rs-orange!"

const DS_CLASS_NAMES = {
  toast: DS_FOCUS_RING,
  actionButton: `hover:bg-rs-orange-hover! ${DS_FOCUS_RING}`,
  cancelButton: `hover:text-rs-white! ${DS_FOCUS_RING}`,
  closeButton: DS_FOCUS_RING,
}

/**
 * RoomScout's toaster. Single dark theme (the shadcn default `next-themes`
 * lookup is replaced by a static theme), anchored top-right per the DS.
 */
const Toaster = ({
  className,
  style,
  toastOptions,
  ...props
}: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-right"
      offset={DS_OFFSET}
      className={cn("toaster group", className)}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{ ...DS_TOASTER_STYLE, ...style }}
      toastOptions={{
        closeButtonAriaLabel: DS_DISMISS_LABEL,
        actionButtonStyle: DS_ACTION_BUTTON_STYLE,
        cancelButtonStyle: DS_CANCEL_BUTTON_STYLE,
        ...toastOptions,
        style: { ...DS_TOAST_STYLE, ...toastOptions?.style },
        classNames: { ...DS_CLASS_NAMES, ...toastOptions?.classNames },
      }}
      {...props}
    />
  )
}

type ShowToastOptions = Omit<
  ExternalToast,
  "action" | "cancel" | "icon" | "onDismiss"
> & {
  /** Label of the primary pill. DS default „Zum Scout“. */
  actionLabel?: React.ReactNode
  /** Primary action. Omit it and no pill is rendered (as in the DS Toast). */
  onAction?: () => void
  /** Accessible name of the ghost X. DS default „Schließen“. */
  dismissLabel?: string
  /** Called when the user dismisses the toast (X or swipe). */
  onDismiss?: () => void
}

/**
 * Fire a design-system toast: orange dot, message, optional „Zum Scout“ pill,
 * ghost X. Returns sonner's toast id, so callers can `toast.dismiss(id)`.
 *
 * DS reference: `design-system/components/feedback/toast/Toast.jsx`.
 *
 * An event toast with an action does not expire — the prototype's `notify()`
 * sets no timer and the toast survives until the X, the action, or a return to
 * the Scout (SCOUT_SCREENS.md §2.7) — so it always carries the X. Pass an
 * explicit `duration` for the short confirmation toasts (Settings „Gespeichert“
 * is 2400 ms).
 */
function showToast(
  message: React.ReactNode,
  options: ShowToastOptions = {}
): string | number {
  const {
    actionLabel = DS_ACTION_LABEL,
    onAction,
    dismissLabel = DS_DISMISS_LABEL,
    onDismiss,
    duration,
    dismissible = true,
    ...rest
  } = options

  const resolvedDuration =
    duration ?? (onAction ? Number.POSITIVE_INFINITY : undefined)
  // A toast that never expires must always be dismissible by hand.
  const withDismiss =
    dismissible &&
    (onDismiss !== undefined || resolvedDuration === Number.POSITIVE_INFINITY)

  return sonnerToast(
    <span data-slot="toast-message" style={DS_MESSAGE_STYLE}>
      <span aria-hidden="true" data-slot="toast-dot" style={DS_DOT_STYLE} />
      {message}
    </span>,
    {
      ...rest,
      duration: resolvedDuration,
      dismissible,
      // The DS dot replaces the type icon; null keeps sonner from reserving the
      // icon slot at all.
      icon: null,
      onDismiss: onDismiss ? () => onDismiss() : undefined,
      action: onAction
        ? { label: actionLabel, onClick: () => onAction() }
        : undefined,
      cancel: withDismiss
        ? {
            label: (
              <>
                <XIcon aria-hidden="true" style={DS_DISMISS_ICON_STYLE} />
                <span className="sr-only">{dismissLabel}</span>
              </>
            ),
            onClick: () => onDismiss?.(),
          }
        : undefined,
    }
  )
}

// `showToast` is this primitive's DS entry point and stays colocated with the
// Toaster that styles it — the same one-file convention shadcn uses for
// `buttonVariants` / `badgeVariants`. Only the Fast-Refresh boundary rule
// objects; the export itself is intentional.
// eslint-disable-next-line react-refresh/only-export-components
export { Toaster, showToast }
export type { ShowToastOptions }
