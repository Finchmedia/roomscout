/**
 * Settings surface — the four layout atoms every page repeats.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:6-9`
 * (`H1`, `Lead`, `Row`, `Saved`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md`
 * §3 (content column) and §4–§11 (the pages that use them).
 *
 * They live here rather than in `src/components/ui` because they carry no DS
 * component contract of their own — they are this surface's page furniture.
 */

import * as React from "react"

import { cn } from "@/lib/utils"

/** Page headline — 44px / 1.1 / 500 / −.02em (`--text-page-title-*`). */
function PageTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="settings-page-title"
      className={cn(
        "m-0 text-[length:var(--text-page-title-size)] leading-[1.1] font-medium tracking-[-0.02em] text-rs-ink",
        className
      )}
      {...props}
    />
  )
}

/** Lead paragraph under the headline — 19px on `--rs-ink-4`, 10px below it. */
function PageLead({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="settings-page-lead"
      className={cn(
        "mt-[var(--space-4)] mb-0 text-[length:var(--text-lead-size)] text-rs-ink-4",
        className
      )}
      {...props}
    />
  )
}

/**
 * The shared settings row: label block on the left, control on the right,
 * separated by a hairline. `Settings.jsx:8` — `16px 0` and a bottom divider.
 */
function SettingsRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="settings-row"
      className={cn(
        "flex items-center justify-between gap-[var(--space-9)]",
        "border-b border-rs-border-divider py-[var(--space-7)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * The „Gespeichert“ flash that follows a switch (`Settings.jsx:9`). It is a
 * polite live region so the confirmation is announced, not only seen.
 */
function SavedFlash({
  show,
  children,
  className,
  ...props
}: React.ComponentProps<"span"> & { show: boolean }) {
  return (
    <span
      data-slot="settings-saved-flash"
      role="status"
      aria-live="polite"
      className={cn(
        "text-[length:var(--text-caption-sm-size)] text-rs-ink-6",
        show && "animate-rs-fade-up",
        className
      )}
      {...props}
    >
      {show ? children : null}
    </span>
  )
}

export { PageTitle, PageLead, SettingsRow, SavedFlash }
