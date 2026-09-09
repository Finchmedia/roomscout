/**
 * „Profil“ — the display name the Scout addresses the band by.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:158-170`
 * (`ProfilePage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §8.
 * The name draft is deliberately NOT part of the autonomy draft: leaving the
 * page with an unsaved name never opens the discard dialog (§8.2).
 */

import * as React from "react"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCopy } from "@/ui/copy"

import { PageLead, PageTitle, SettingsRow } from "../primitives"
import type { SettingsPageContext } from "../state/useSettingsDemoState"

/** `AppHeader`'s rule, reused so the preview matches the header exactly. */
function initialsOf(name: string, fallback: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return initials.length > 0 ? initials : fallback
}

function ProfilePage({ data, actions }: SettingsPageContext) {
  const { t } = useCopy()
  const [draft, setDraft] = React.useState(data.name)
  const [saved, setSaved] = React.useState(false)
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  React.useEffect(() => () => clearTimeout(savedTimer.current), [])

  const trimmed = draft.trim()
  const fallback = t("settings.profile.initialsFallback")

  return (
    <>
      <PageTitle>{t("settings.profile.title")}</PageTitle>
      <PageLead>{t("settings.profile.subtitle")}</PageLead>

      <form
        className="mt-[var(--space-13)] grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[var(--space-11)] border-b border-rs-border-divider pb-[var(--space-12)]"
        onSubmit={(event) => {
          event.preventDefault()
          if (trimmed.length === 0 || trimmed === data.name) return
          actions.setName(trimmed)
          setSaved(true)
          clearTimeout(savedTimer.current)
          savedTimer.current = setTimeout(() => setSaved(false), 2200)
        }}
      >
        <Avatar size={72} initials={initialsOf(draft, fallback)} label={trimmed} />
        <div className="min-w-0">
          <label
            htmlFor="settings-profile-name"
            className="mb-[var(--space-2)] block text-[length:var(--text-caption-sm-size)] text-rs-ink-6"
          >
            {t("settings.profile.nameLabel")}
          </label>
          <div className="flex flex-wrap gap-[var(--space-4)]">
            <Input
              id="settings-profile-name"
              variant="lg"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              wrapperClassName="min-w-[220px] flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={trimmed.length === 0 || trimmed === data.name}
            >
              {t("settings.profile.save")}
            </Button>
          </div>
          <p
            role="status"
            aria-live="polite"
            className="mt-[var(--space-3)] mb-0 min-h-[var(--space-9)] text-[length:var(--text-caption-size)] text-rs-ink-4"
          >
            {saved ? t("settings.profile.saved") : null}
          </p>
        </div>
      </form>

      <SettingsRow className="py-[var(--space-10)]">
        <div>
          <div className="text-[length:var(--text-body-lg-size)]">
            {t("settings.profile.login.title")}
          </div>
          <div className="mt-[3px] text-[length:var(--text-caption-size)] text-rs-ink-4">
            {t("settings.profile.login.sub")}
          </div>
        </div>
        <Badge variant="muted">{t("settings.profile.login.badge")}</Badge>
      </SettingsRow>

      <p className="py-[var(--space-10)] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
        {t("settings.profile.footnote")}
      </p>
    </>
  )
}

export { ProfilePage }
