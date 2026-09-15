import * as React from "react"
import { XIcon } from "lucide-react"
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ExternalToast,
} from "sonner"

import { cn } from "@/lib/utils"
import { useCopy } from "@/ui/copy"

/**
 * RoomScout toast — the sonner primitive restyled to the design-system Toast.
 *
 * DS reference: `design-system/components/feedback/toast/`
 * (`Toast.jsx`, `Toast.d.ts`, `Toast.prompt.md`, `toast.card.html`).
 * Behaviour, anchor and copy: `docs/UI_PORT/SCOUT_SCREENS.md` §2.7 / §18.2.
 *
 * The shadcn API is preserved: `<Toaster />` takes sonner's own props (`ref`
 * included), `className` / `style` / `toastOptions` are merged onto the DS
 * defaults rather than replaced, and every other prop still overrides ours.
 * `showToast()` adds the DS semantics on top: orange dot + message +
 * „Zum Scout“ pill + ghost X.
 *
 * Styling note — sonner injects its stylesheet into <head> at runtime, i.e.
 * *unlayered*, so it beats every Tailwind utility (those live in
 * `@layer utilities`) no matter the specificity. The DS look therefore goes
 * through the three channels that do win: sonner's own CSS-variable contract
 * (`--normal-bg`, `--normal-border`, `--border-radius`, `--width`), inline
 * styles, and — only for states inline styles cannot express (`:hover`,
 * `:focus-visible`) — Tailwind utilities with the `!` important modifier.
 * All three carry tokens from `src/styles/tokens.css`; no raw values.
 *
 * **Deliberate deviations** (do not "fix" without reading this first):
 *  · **Border.** `--rs-border-accent-soft` (orange .35) is Toast.jsx verbatim.
 *    TOKENS.md F5 resolves *the toast/tooltip family* — the Roomscout toast,
 *    the Roomscout hint bar and the Settings toast — onto one warm-white
 *    `rgba(255,200,160,.22)` (= `--rs-border-control`); the port brief names a
 *    third value (`--rs-border-card-strong`, .18). Those three surfaces are
 *    three different components (SETTINGS_SCREENS.md §14's toast is
 *    bottom-centred, 14px, no dot and no buttons), and this file ports only
 *    the Roomscout one, whose DS spec is unambiguous — so the DS wins over F5.
 *  · **Message size.** 15px (`--text-body-sm-size`), not Toast.jsx's 14.5px:
 *    TOKENS.md F19 unifies body text at 15px and reserves 14.5px for
 *    Operator's dense tables. Every other number below is DS verbatim.
 *  · **Entrance.** Toast.jsx animates `rsFadeUp .25s ease both` (8px rise +
 *    fade). We keep sonner's own mount transition instead: sonner drives the
 *    `<li>`'s `transform` for entrance, stacking lift *and* swipe
 *    (`--y`, `--lift-amount`, `--swipe-amount-*`), so an `animation … both`
 *    on that element would freeze `transform` at the keyframe's end value and
 *    break stacking and swipe-to-dismiss. Putting `rsFadeUp` on an inner
 *    wrapper instead would run two entrances at once.
 *  · **`role="status"`.** Toast.jsx sets it on the toast box; sonner's `<li>`
 *    takes no role and exposes no prop for one. It does not need one: sonner
 *    wraps the whole list in `<section aria-live="polite"
 *    aria-relevant="additions text">`, which is what actually announces, and a
 *    nested live region inside it risks double announcements in some AT.
 *    Announcement is therefore equivalent; the DS attribute is waived.
 *  · **Layering.** TOKENS.md §A17 has two toast steps — `--rs-z-toast: 14`
 *    (app flow, under scrims/modals) and `--rs-z-toast-top: 40` (the Settings
 *    toast, above everything). sonner hard-codes `z-index: 999999999` on the
 *    toaster `<ol>`, i.e. always the `-top` behaviour. That matches this
 *    toast's purpose (Toast.prompt.md: it fires while the user is *away* from
 *    the Scout, in Settings or Operator), and tokens.css ships no z-index
 *    scale to point at yet. Revisit when it does.
 *  · **Sizes from the spacing ramp.** 34px pill height, 30px X, 14px icon and
 *    8px dot are DS control sizes, but tokens.css's `--size-*` group has no
 *    entry for any of them, so they borrow `--space-15 / -14 / -6 / -3`. A
 *    retune of the spacing ramp would resize this toast; give the toast its
 *    own `--size-toast-*` tokens if that ever becomes a risk.
 *
 * Verified against **sonner 2.0.8**. Two of its internal rules are
 * load-bearing here (see `--width` below); re-check them on upgrade.
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
 * The same anchor for sonner's `@media (max-width: 600px)` branch, where the
 * header is `--size-header-narrow`. Without this sonner fills every
 * `--mobile-offset-*` with its own 16px default and the toast lands *on top of*
 * the narrow header, which is exactly what the 96px offset exists to avoid.
 */
const DS_MOBILE_OFFSET = {
  top: "calc(var(--size-header-narrow) + var(--space-5))",
  right: "var(--space-7)",
  bottom: "var(--space-7)",
  left: "var(--space-7)",
}

/**
 * Toaster-level variables. `--normal-*` are sonner's own hooks, so the DS
 * surface, hairline and radius land through sonner's rules instead of fighting
 * them.
 *
 * `--width: max-content` makes the toast hug its message the way the DS
 * `inline-flex` Toast does, instead of sonner's fixed 356px column. It reaches
 * the toast through two sonner rules that are load-bearing and unversioned:
 *   1. `[data-sonner-toast][data-styled='true'] { width: var(--width) }` passes
 *      the value from the toaster down to the toast box, and
 *   2. `[data-sonner-toast][data-x-position='right'] { right: 0 }` re-anchors
 *      the (absolutely positioned) box to the right edge of the `<ol>`.
 * Because every toast is `position: absolute`, the `<ol data-sonner-toaster>`
 * itself — also `width: var(--width)` — has no in-flow children and computes to
 * 0px wide; only its `right: var(--offset-right)` edge matters. If a sonner
 * upgrade drops either rule the toast silently slides off-screen, so verify the
 * anchor by eye after bumping the dependency.
 */
const DS_TOASTER_STYLE = {
  fontFamily: "var(--font-sans)",
  "--normal-bg": "var(--rs-surface-toast)",
  "--normal-text": "var(--text-body)",
  "--normal-border": "var(--rs-border-accent-soft)",
  "--border-radius": "var(--radius-card-sm)",
  "--width": "max-content",
} as React.CSSProperties

/** DS Toast box: padding 12/12/12/16, gap 14, `--shadow-toast`; ink see F19. */
const DS_TOAST_STYLE: React.CSSProperties = {
  padding: "var(--space-5) var(--space-5) var(--space-5) var(--space-7)",
  gap: "var(--space-6)",
  fontSize: "var(--text-body-sm-size)",
  boxShadow: "var(--shadow-toast)",
  // The DS box has no max-width — it hugs its content, and the canonical toast
  // („Dein Scout wartet auf deine Freigabe“ + pill + X) is ~455px wide, so a
  // narrow cap would only force it to wrap. This is a viewport guard for a
  // pathologically long message: 32px = the mobile gutter on both sides, which
  // is also exactly the width sonner's own `max-width: 600px` branch gives the
  // toast, so the cap never changes the mobile layout.
  maxWidth: "calc(100vw - var(--space-7) * 2)",
}

/**
 * DS action pill: 34px tall, 0/14 padding, orange, white ink, 13.5px, 600.
 * Used twice: inline on `showToast`'s own pill (see `showToast` for why it is
 * not sonner's `action` slot) and as `toastOptions.actionButtonStyle`, so a
 * raw `toast(msg, { action })` from anywhere else still looks like the DS.
 */
const DS_ACTION_BUTTON_STYLE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flex: "none",
  height: "var(--space-15)",
  padding: "0 var(--space-6)",
  marginInline: 0,
  border: 0,
  borderRadius: "var(--radius-pill)",
  backgroundColor: "var(--rs-orange)",
  color: "var(--text-on-accent)",
  fontFamily: "inherit",
  fontSize: "var(--text-caption-sm-size)",
  fontWeight: "var(--weight-semibold)",
  cursor: "pointer",
  transition: "background-color var(--duration-quick) var(--ease-out-soft)",
}

/** DS dismiss: 30px ghost circle, muted ink, no fill. */
const DS_CANCEL_BUTTON_STYLE: React.CSSProperties = {
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

/**
 * DS message row: the 8px orange dot, the message, then the „Zum Scout“ pill —
 * DOM order = reading order = visual order (Toast.jsx).
 */
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
 * State-only overrides for the elements sonner renders. Every property here is
 * one sonner sets in its unlayered stylesheet, so each utility carries the `!`
 * important modifier — that is what lets an author rule beat sonner's CSS.
 *
 * `!` also beats our own *inline* styles, which is why the two rings differ:
 * on the buttons `shadow-none!` only cancels sonner's
 * `[data-button]:focus-visible` ring (they carry no inline shadow), while on
 * the toast box the same utility would erase the inline `--shadow-toast` for
 * keyboard users — sonner gives the `<li>` `tabIndex={0}`, so it *is* focusable
 * — hence the box re-asserts the DS shadow instead of clearing it.
 */
const DS_FOCUS_RING =
  "focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-rs-orange!"

const DS_TOAST_FOCUS_RING = `focus-visible:shadow-toast! ${DS_FOCUS_RING}`
const DS_BUTTON_FOCUS_RING = `focus-visible:shadow-none! ${DS_FOCUS_RING}`

const DS_CLASS_NAMES = {
  toast: DS_TOAST_FOCUS_RING,
  actionButton: `hover:bg-rs-orange-hover! ${DS_BUTTON_FOCUS_RING}`,
  cancelButton: `hover:text-rs-white! ${DS_BUTTON_FOCUS_RING}`,
  // Reached only if a caller enables sonner's built-in close button
  // (`<Toaster closeButton />`) — `showToast` renders the DS X instead.
  closeButton: DS_BUTTON_FOCUS_RING,
}

/** The DS pill as `showToast` renders it: base geometry inline, hover here. */
const DS_ACTION_CLASS =
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange hover:bg-rs-orange-hover!"

/**
 * RoomScout's toaster. Single dark theme (the shadcn default `next-themes`
 * lookup is replaced by a static theme), anchored top-right per the DS.
 *
 * No `icons` map: the DS defines exactly one toast (orange dot, no glyph), so
 * shadcn's stock success/info/warning/error/loading lucide icons would only
 * dress a raw `toast.success(…)` in a half-DS look that appears nowhere in the
 * design system. Typed sonner toasts are deliberately left off-system — use
 * `showToast`.
 */
const Toaster = ({
  className,
  style,
  toastOptions,
  ...props
}: React.ComponentProps<typeof Sonner>) => {
  const { t } = useCopy()
  return (
    <Sonner
      theme="dark"
      position="top-right"
      offset={DS_OFFSET}
      mobileOffset={DS_MOBILE_OFFSET}
      containerAriaLabel={t("common.notifications")}
      className={cn("toaster group", className)}
      style={{ ...DS_TOASTER_STYLE, ...style }}
      toastOptions={{
        ...toastOptions,
        // Merged *after* the caller's object, per key, so overriding one field
        // of a style does not drop the rest of the DS spec.
        closeButtonAriaLabel:
          toastOptions?.closeButtonAriaLabel ?? t("common.close"),
        actionButtonStyle: {
          ...DS_ACTION_BUTTON_STYLE,
          ...toastOptions?.actionButtonStyle,
        },
        cancelButtonStyle: {
          ...DS_CANCEL_BUTTON_STYLE,
          ...toastOptions?.cancelButtonStyle,
        },
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
  /**
   * Label of the primary pill. DS default „Zum Scout“. A string, as in
   * `Toast.d.ts` — the DS action label is verb-first German copy, not markup.
   */
  actionLabel?: string
  /** Primary action. Omit it and no pill is rendered (as in the DS Toast). */
  onAction?: () => void
  /** Accessible name of the ghost X. DS default „Schließen“. */
  dismissLabel?: string
  /**
   * Render the ghost X. Defaults to `true` when `onDismiss` is given or the
   * toast never expires, which covers both DS toasts (SCOUT_SCREENS.md §2.7
   * always has the X, SETTINGS_SCREENS.md §14 never does). Set it explicitly
   * for anything in between — a 6s toast the user may also close by hand.
   * `dismissLabel` only names the X when it is actually rendered.
   */
  showDismiss?: boolean
  /**
   * Called when the user dismisses the toast (X or swipe), and on a
   * programmatic `toast.dismiss(id)`. `() => void` per `Toast.d.ts`; clicking
   * the „Zum Scout“ pill is an action, not a dismissal, and does not call it.
   */
  onDismiss?: () => void
}

/** Fallback ids for `showToast`'s own pill, which needs one before it fires. */
let toastCounter = 0

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
 *
 * The pill is rendered inside the message rather than handed to sonner's
 * `action` slot: sonner emits `cancel` *before* `action`, so the DS order
 * (message → „Zum Scout“ → X) could only be restored visually, with `order`,
 * leaving keyboard and screen-reader users to traverse [X][Zum Scout] —
 * WCAG 2.4.3 / 1.3.2. Rendering it in the content keeps DOM order = visual
 * order; the X stays sonner's `cancel`, which is what wires up `dismissible`.
 */
function showToast(
  message: React.ReactNode,
  options: ShowToastOptions = {}
): string | number {
  const {
    actionLabel = DS_ACTION_LABEL,
    onAction,
    dismissLabel = DS_DISMISS_LABEL,
    showDismiss,
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
    (showDismiss ??
      (onDismiss !== undefined ||
        resolvedDuration === Number.POSITIVE_INFINITY))

  const id = rest.id ?? `rs-toast-${++toastCounter}`
  // The pill dismisses the toast the way sonner's own action slot would, but
  // via `toast.dismiss`, which routes through sonner's `onDismiss`. Acting is
  // not dismissing (Toast.jsx wires the two to separate handlers), so the
  // notification is suppressed for that one path.
  let dismissedByAction = false

  return sonnerToast(
    <span data-slot="toast-message" style={DS_MESSAGE_STYLE}>
      <span aria-hidden="true" data-slot="toast-dot" style={DS_DOT_STYLE} />
      <span data-slot="toast-text">{message}</span>
      {onAction ? (
        <button
          type="button"
          data-slot="toast-action"
          className={DS_ACTION_CLASS}
          style={DS_ACTION_BUTTON_STYLE}
          onClick={() => {
            dismissedByAction = true
            onAction()
            sonnerToast.dismiss(id)
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </span>,
    {
      ...rest,
      id,
      duration: resolvedDuration,
      dismissible,
      // The DS dot replaces the type icon; null keeps sonner from reserving the
      // icon slot at all.
      icon: null,
      onDismiss: onDismiss
        ? () => {
            if (!dismissedByAction) onDismiss()
          }
        : undefined,
      cancel: withDismiss
        ? {
            label: (
              <>
                <XIcon aria-hidden="true" style={DS_DISMISS_ICON_STYLE} />
                <span className="sr-only">{dismissLabel}</span>
              </>
            ),
            // sonner's cancel handler dismisses the toast itself, but does not
            // call `onDismiss` on that path — hence the explicit call here.
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
