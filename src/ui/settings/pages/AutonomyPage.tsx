/**
 * „Handlungsspielraum“ — how independently the Scout is allowed to work.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:72-103`
 * (`AutonomyPage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §5. The
 * former „Grenzen“ section (per-day stepper, „Weitere Grenzen“) is gone: the
 * product has no daily limits (ADR 0002).
 *
 * Every control writes a **draft**, which the host owns (so its unsaved-changes
 * gate can drop it from the discard dialog). The page is therefore controlled:
 * `rules` + `draft` in, `onDraftChange` out, and the save bar reports back
 * through `onSave` / `onCancel`. The same component serves the demo host
 * (`SettingsPanel`) and the live route (`LiveSettingsPage` with
 * `api.autonomy.getMine` / `api.autonomy.save`).
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Overline } from "@/components/ui/overline"
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card"
import { Switch } from "@/components/ui/switch"
import { useCopy } from "@/ui/copy"

import { PageLead, PageTitle, SettingsRow } from "../primitives"
import { SaveBar } from "../SaveBar"
import type {
  AutonomyMode,
  AutonomyRules,
} from "../state/useSettingsDemoState"

interface AutonomyPageProps {
  /** The saved rules — the baseline the draft is compared against. */
  rules: AutonomyRules
  /** The unsaved draft, or `null` while the page is clean. */
  draft: AutonomyRules | null
  onDraftChange: (draft: AutonomyRules | null) => void
  /**
   * Persist the draft. Resolve (or return) `false` to suppress the
   * „Handlungsspielraum aktualisiert“ line, e.g. after a failed save.
   */
  onSave: (rules: AutonomyRules) => void | boolean | Promise<void | boolean>
  /** Every control is inert (rules not loaded yet, another action running). */
  disabled?: boolean
  /** A save is in flight — controls stay inert and the save button is disabled. */
  saving?: boolean
  /** Rendered as `role="alert"` under the lock card. */
  error?: string | null
}

/** The five switch rows of §5.3 / §5.5. */
type BoolRuleKey =
  | "contact"
  | "viewings"
  | "publishAd"
  | "shareProfile"
  | "sharePrivate"

function AutonomyPage({
  rules: savedRules,
  draft,
  onDraftChange,
  onSave,
  disabled = false,
  saving = false,
  error = null,
}: AutonomyPageProps) {
  const { t } = useCopy()
  const [actionDetails, setActionDetails] = React.useState(false)
  const [shareDetails, setShareDetails] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  React.useEffect(() => () => clearTimeout(savedTimer.current), [])

  const rules = draft ?? savedRules
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(savedRules)
  const inert = disabled || saving

  const setMode = (mode: AutonomyMode) => onDraftChange({ ...rules, mode })

  /** Writing through a union key keeps the draft typed without a cast. */
  const setFlag = (key: BoolRuleKey, checked: boolean) => {
    const next: AutonomyRules = { ...rules }
    next[key] = checked
    onDraftChange(next)
  }

  const toggleRows: { key: BoolRuleKey; label: string }[] = [
    { key: "contact", label: t("settings.autonomy.action.contact") },
    { key: "viewings", label: t("settings.autonomy.action.viewings") },
    { key: "publishAd", label: t("settings.autonomy.action.publishAd") },
  ]

  const shareRows: { key: BoolRuleKey; label: string }[] = [
    { key: "shareProfile", label: t("settings.autonomy.share.profile") },
    { key: "sharePrivate", label: t("settings.autonomy.share.private") },
  ]

  const save = async () => {
    if (inert) return
    const result = await onSave(rules)
    if (result === false) return
    setSaved(true)
    clearTimeout(savedTimer.current)
    savedTimer.current = setTimeout(() => setSaved(false), 2600)
  }

  return (
    <>
      <PageTitle>{t("settings.autonomy.title")}</PageTitle>
      <PageLead>{t("settings.autonomy.subtitle")}</PageLead>

      <RadioCardGroup
        aria-label={t("settings.autonomy.modeGroupAria")}
        className="mt-[var(--space-12)] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[var(--space-6)]"
      >
        <RadioCard
          disabled={inert}
          checked={rules.mode === "autopilot"}
          onSelect={() => setMode("autopilot")}
          title={t("settings.autonomy.mode.autopilot.title")}
          description={t("settings.autonomy.mode.autopilot.sub")}
        />
        <RadioCard
          disabled={inert}
          checked={rules.mode === "review"}
          onSelect={() => setMode("review")}
          title={t("settings.autonomy.mode.review.title")}
          description={t("settings.autonomy.mode.review.sub")}
        />
      </RadioCardGroup>

      <div className="mt-[var(--space-14)] flex items-baseline justify-between gap-[var(--space-9)]">
        <Overline>{t("settings.autonomy.actions.label")}</Overline>
        <Button
          variant="ghost"
          size="2xs"
          aria-expanded={actionDetails}
          className="text-[length:var(--text-caption-size)] text-rs-ink-6"
          onClick={() => setActionDetails((value) => !value)}
        >
          {t("settings.autonomy.details.toggle")}
        </Button>
      </div>
      {actionDetails ? (
        <p className="mt-[var(--space-3)] mb-0 animate-rs-fade-up text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
          {t("settings.autonomy.actions.details")}
        </p>
      ) : null}
      {toggleRows.map((row) => (
        <SettingsRow
          key={row.key}
          className="py-[var(--space-6)] text-[length:var(--text-body-lg-size)]"
        >
          <span>{row.label}</span>
          <Switch
            disabled={inert}
            checked={Boolean(rules[row.key])}
            onCheckedChange={(checked) => setFlag(row.key, checked)}
            label={row.label}
          />
        </SettingsRow>
      ))}

      <div className="mt-[var(--space-14)] flex items-baseline justify-between gap-[var(--space-9)]">
        <Overline>{t("settings.autonomy.share.label")}</Overline>
        <Button
          variant="ghost"
          size="2xs"
          aria-expanded={shareDetails}
          className="text-[length:var(--text-caption-size)] text-rs-ink-6"
          onClick={() => setShareDetails((value) => !value)}
        >
          {t("settings.autonomy.details.toggle")}
        </Button>
      </div>
      {shareDetails ? (
        <p className="mt-[var(--space-3)] mb-0 animate-rs-fade-up text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
          {t("settings.autonomy.share.details")}
        </p>
      ) : null}
      {shareRows.map((row) => (
        <SettingsRow
          key={row.key}
          className="py-[var(--space-6)] text-[length:var(--text-body-lg-size)]"
        >
          <span>{row.label}</span>
          <Switch
            disabled={inert}
            checked={Boolean(rules[row.key])}
            onCheckedChange={(checked) => setFlag(row.key, checked)}
            label={row.label}
          />
        </SettingsRow>
      ))}

      <Card
        tone="rust"
        size="md"
        className="mt-[var(--space-12)] flex items-center gap-[var(--space-9)]"
      >
        <Icon name="lock" size={26} className="flex-none text-rs-orange-light" />
        <div>
          <div className="text-[length:var(--text-body-lg-size)] font-medium">
            {t("settings.autonomy.lock.title")}
          </div>
          <div className="mt-[3px] text-[length:var(--text-caption-size)] text-rs-ink-4">
            {t("settings.autonomy.lock.sub")}
          </div>
        </div>
      </Card>

      {error ? (
        <p
          role="alert"
          className="mt-[var(--space-5)] mb-0 text-[length:var(--text-body-sm-size)] text-rs-red-text"
        >
          {error}
        </p>
      ) : null}

      <SaveBar
        dirty={dirty}
        invalid={Boolean(saving || disabled)}
        saved={saved}
        onCancel={() => {
          if (!saving) onDraftChange(null)
        }}
        onSave={() => void save()}
      />
    </>
  )
}

export { AutonomyPage }
export type { AutonomyPageProps }
