/**
 * `/design/settings` — the full-page demo host for the settings surface.
 *
 * **Demo data only.** It mounts the chrome the app mounts (stage background +
 * app header) and holds the panel open on top of it, so every page, sheet and
 * dialog of `SettingsPanel` can be reviewed in the browser without a backend.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/App.jsx` — the header and
 * the `view === 'settings'` branch. The Scout surface owns the profile menu,
 * so here the avatar simply reopens the panel.
 */

import * as React from "react"

import { AppHeader } from "@/ui/chrome/AppHeader"
import { StageBackground } from "@/ui/chrome/StageBackground"
import { useCopy } from "@/ui/copy"

import { SettingsPanel } from "./SettingsPanel"
import {
  useSettingsDemoState,
  type SettingsPageId,
} from "./state/useSettingsDemoState"

/** `AppHeader`'s initials rule, applied to the demo band name. */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function DemoSettingsPage() {
  const { t } = useCopy()
  const { data, actions } = useSettingsDemoState()

  const [open, setOpen] = React.useState(true)
  const [page, setPage] = React.useState<SettingsPageId>("sources")

  return (
    <StageBackground position="fixed" className="font-sans text-rs-ink">
      <AppHeader
        initials={initialsOf(data.name)}
        avatarLabel={data.name}
        onAvatar={() => setOpen(true)}
      />

      <main className="relative z-2 flex min-h-0 flex-1 items-center justify-center px-[var(--space-16)] pb-[var(--space-11)]">
        {!open ? (
          <button
            type="button"
            className="cursor-pointer rounded-pill border border-rs-border-accent bg-rs-surface-subtle px-[var(--space-11)] py-[var(--space-5)] font-sans text-[length:var(--text-body-sm-size)] text-rs-ink transition-colors duration-[var(--duration-fast)] hover:bg-rs-surface-hover focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange"
            onClick={() => setOpen(true)}
          >
            {t("settings.nav.aria")}
          </button>
        ) : null}
      </main>

      <SettingsPanel
        open={open}
        onOpenChange={setOpen}
        data={data}
        actions={actions}
        page={page}
        onPageChange={setPage}
        session="working"
      />
    </StageBackground>
  )
}

export { DemoSettingsPage }
