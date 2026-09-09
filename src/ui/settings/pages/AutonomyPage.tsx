/**
 * „Handlungsspielraum“ — how independently the Scout is allowed to work.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:72-103`
 * (`AutonomyPage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §5.
 *
 * Every control writes a **draft**, which the panel owns (so its unsaved-changes
 * gate can drop it from the discard dialog). The page is therefore controlled:
 * `draft` in, `onDraftChange` out, and the save bar reports back through
 * `onSave` / `onCancel`.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Overline } from "@/components/ui/overline"
import { RadioCard, RadioCardGroup } from "@/components/ui/radio-card"
import { Stepper } from "@/components/ui/stepper"
import { Switch } from "@/components/ui/switch"
import { useCopy } from "@/ui/copy"

import { PageLead, PageTitle, SettingsRow } from "../primitives"
import { SaveBar } from "../SaveBar"
import type {
  AutonomyRules,
  SettingsPageContext,
} from "../state/useSettingsDemoState"

interface AutonomyPageProps extends SettingsPageContext {
  /** The unsaved draft, or `null` while the page is clean. */
  draft: AutonomyRules | null
  onDraftChange: (draft: AutonomyRules | null) => void
  onSave: (rules: AutonomyRules) => void
}

/** §5.7 — the per-day limit must be a whole number greater than zero. */
function isPerDayInvalid(value: AutonomyRules["perDay"]): boolean {
  const n = Number(value)
  return !(Number.isInteger(n) && n > 0)
}

/** The five switch rows of §5.3 / §5.5. */
type BoolRuleKey =
  | "contact"
  | "viewings"
  | "publishAd"
  | "shareProfile"
  | "sharePrivate"

function AutonomyPage({
  data,
  back,
  draft,
  onDraftChange,
  onSave,
}: AutonomyPageProps) {
  const { t } = useCopy()
  const [actionDetails, setActionDetails] = React.useState(false)
  const [shareDetails, setShareDetails] = React.useState(false)
  const [limitsOpen, setLimitsOpen] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const alertId = React.useId()

  React.useEffect(() => () => clearTimeout(savedTimer.current), [])

  const rules = draft ?? data.rules
  const dirty =
    draft !== null && JSON.stringify(draft) !== JSON.stringify(data.rules)
  const invalid = isPerDayInvalid(rules.perDay)

  const patch = (next: Partial<AutonomyRules>) =>
    onDraftChange({ ...rules, ...next })

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

  return (
    <>
      <PageTitle>{t("settings.autonomy.title")}</PageTitle>
      <PageLead>{t("settings.autonomy.subtitle")}</PageLead>

      <RadioCardGroup
        aria-label={t("settings.autonomy.modeGroupAria")}
        className="mt-[var(--space-12)] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[var(--space-6)]"
      >
        <RadioCard
          checked={rules.mode === "autopilot"}
          onSelect={() => patch({ mode: "autopilot" })}
          title={t("settings.autonomy.mode.autopilot.title")}
          description={t("settings.autonomy.mode.autopilot.sub")}
        />
        <RadioCard
          checked={rules.mode === "review"}
          onSelect={() => patch({ mode: "review" })}
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
            checked={Boolean(rules[row.key])}
            onCheckedChange={(checked) => setFlag(row.key, checked)}
            label={row.label}
          />
        </SettingsRow>
      ))}

      <Overline className="mt-[var(--space-14)]">
        {t("settings.autonomy.limits.label")}
      </Overline>
      <SettingsRow className="flex-wrap py-[var(--space-6)] text-[length:var(--text-body-lg-size)]">
        <span>{t("settings.autonomy.limits.perDay")}</span>
        <div className="flex flex-wrap items-center gap-[var(--space-10)]">
          <Stepper
            value={rules.perDay}
            onChange={(value) => patch({ perDay: value })}
            label={t("settings.autonomy.limits.perDay")}
            aria-invalid={invalid}
            aria-describedby={invalid ? alertId : undefined}
          />
          <Button
            variant="link"
            size="2xs"
            aria-expanded={limitsOpen}
            className="text-[length:var(--text-body-sm-size)] text-rs-ink"
            onClick={() => setLimitsOpen((value) => !value)}
          >
            {t("settings.autonomy.limits.more")}
            <Icon
              name="chevron-right"
              size={14}
              className={limitsOpen ? "rotate-90" : undefined}
            />
          </Button>
        </div>
      </SettingsRow>
      {invalid ? (
        <div
          id={alertId}
          role="alert"
          className="mt-[var(--space-3)] text-[length:var(--text-caption-size)] text-rs-red-text"
        >
          {t("settings.autonomy.limits.invalid")}
        </div>
      ) : null}
      <div className="mt-[var(--space-2)] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
        {t("settings.autonomy.limits.caption")}
      </div>
      {limitsOpen ? (
        <div className="mt-[var(--space-5)] animate-rs-fade-up rounded-card border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-9)] py-[var(--space-7)] text-[length:var(--text-body-sm-size)] leading-[1.7] text-rs-ink-2">
          <div>
            <span className="text-rs-ink-6">
              {t("settings.autonomy.limits.periodLabel")}
            </span>{" "}
            {t("settings.autonomy.limits.periodValue")}
          </div>
          <div>
            <span className="text-rs-ink-6">
              {t("settings.autonomy.limits.stopsLabel")}
            </span>{" "}
            {t("settings.autonomy.limits.stopsValue")}
          </div>
          <div>
            <span className="text-rs-ink-6">
              {t("settings.autonomy.limits.budgetLabel")}
            </span>{" "}
            {t("settings.autonomy.limits.budgetValue")}{" "}
            <Button
              variant="link"
              size="2xs"
              className="text-[length:var(--text-body-sm-size)] text-rs-ink"
              onClick={back}
            >
              {t("settings.autonomy.limits.budgetLink")}
            </Button>
          </div>
        </div>
      ) : null}

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

      <SaveBar
        dirty={dirty}
        invalid={invalid}
        saved={saved}
        onCancel={() => onDraftChange(null)}
        onSave={() => {
          if (invalid) return
          onSave({ ...rules, perDay: Number(rules.perDay) })
          setSaved(true)
          clearTimeout(savedTimer.current)
          savedTimer.current = setTimeout(() => setSaved(false), 2600)
        }}
      />
    </>
  )
}

export { AutonomyPage }
