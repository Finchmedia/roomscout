/**
 * „Quellen & Zugänge“ — where the Scout may search.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:38-70`
 * (`SourcesPage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §4.
 * Applied delta: DECISIONS item 37 — „Weitere Quellen“ no longer repeats the
 * rows above it; it lists only sources that are not already managed here, which
 * in the demo is the single unavailable example the dictionary ships.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Notice } from "@/components/ui/notice"
import { Overline } from "@/components/ui/overline"
import { StatusDot } from "@/components/ui/status-dot"
import { Switch } from "@/components/ui/switch"
import { useCopy } from "@/ui/copy"

import { PageLead, PageTitle, SavedFlash } from "../primitives"
import { useFlash } from "../useFlash"
import { SourceRow } from "../SourceRow"
import {
  isSourceUsable,
  type SettingsPageContext,
  type SourceId,
} from "../state/useSettingsDemoState"

interface SourcesPageProps extends SettingsPageContext {
  onOpenConnection: (id: SourceId) => void
}

/** The demo city of the search order — `sources.subtitle.withOrder`'s `{city}`. */
const DEMO_CITY = "Stuttgart"

function SourcesPage({
  data,
  actions,
  back,
  toast,
  onOpenConnection,
}: SourcesPageProps) {
  const { t } = useCopy()
  const [autoSaved, flashAutoSaved] = useFlash()
  const [copied, setCopied] = React.useState(false)
  const [moreOpen, setMoreOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const usable = data.sources.filter((source) =>
    isSourceUsable(source, data.flags)
  )

  // The dictionary ships the address as a literal, not as a function of the
  // display name — which is exactly what `profile.footnote` promises („… deine
  // Scout-Adresse werden bei einer Namensänderung nicht umbenannt“). The kit's
  // `{name}@scout.roomscout.dev` derivation contradicts that line and is dropped.
  const address = t("settings.sources.address.value")

  const exampleName = t("settings.sources.more.example.name")
  const exampleRegion = t("settings.sources.more.example.region")
  const needle = query.trim().toLowerCase()
  const showExample =
    needle.length === 0 ||
    `${exampleName} ${exampleRegion}`.toLowerCase().includes(needle)

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast(t("settings.sources.address.copyFail"))
    }
  }

  return (
    <>
      <PageTitle>{t("settings.sources.title")}</PageTitle>
      <PageLead>
        {data.hasOrder
          ? t("settings.sources.subtitle.withOrder", { city: DEMO_CITY })
          : t("settings.sources.subtitle.noOrder")}
      </PageLead>

      {!data.hasOrder ? (
        <Card
          size="md"
          className="mt-[var(--space-13)] flex flex-wrap items-center justify-between gap-[var(--space-9)] bg-rs-surface-subtle"
        >
          <div>
            <div className="text-[length:var(--text-body-lg-size)]">
              {t("settings.sources.noOrder.title")}
            </div>
            <div className="mt-[var(--space-1)] text-[length:var(--text-caption-size)] text-rs-ink-4">
              {t("settings.sources.noOrder.body")}
            </div>
          </div>
          <Button size="sm" onClick={back}>
            {t("settings.sources.noOrder.cta")}
          </Button>
        </Card>
      ) : (
        <>
          <div className="mt-[var(--space-12)] flex items-center justify-between gap-[var(--space-9)] border-y border-rs-border-divider py-[var(--space-10)]">
            <div>
              <div className="text-[length:var(--text-lead-size)]">
                {t("settings.sources.auto.title")}
              </div>
              <div className="mt-[var(--space-1)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
                {t("settings.sources.auto.sub")}
              </div>
            </div>
            <div className="flex items-center gap-[var(--space-5)]">
              <SavedFlash show={autoSaved}>
                {t("settings.sources.auto.saved")}
              </SavedFlash>
              <Switch
                checked={data.autoSources}
                onCheckedChange={(checked) => {
                  actions.setAutoSources(checked)
                  flashAutoSaved()
                }}
                label={t("settings.sources.auto.title")}
              />
            </div>
          </div>

          <div className="mt-[var(--space-12)] flex items-baseline justify-between gap-[var(--space-9)]">
            <Overline>{t("settings.sources.list.label")}</Overline>
            <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
              {t("settings.sources.list.scope")}
            </span>
          </div>

          {usable.length === 0 ? (
            <Notice
              className="mt-[var(--space-6)]"
              action={
                <Button
                  size="2xs"
                  onClick={() => actions.toggleSource("roomscout")}
                >
                  {t("settings.sources.noUsable.cta")}
                </Button>
              }
            >
              {t("settings.sources.noUsable.text")}
            </Notice>
          ) : null}

          <div className="mt-[var(--space-5)]">
            {data.sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                flags={data.flags}
                onToggle={actions.toggleSource}
                onOpenConnection={onOpenConnection}
                defaultOpen={source.id === "roomscout"}
              />
            ))}
          </div>

          <div className="mt-[var(--space-10)] grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-[var(--space-9)] border-t border-rs-border-divider pt-[var(--space-10)]">
            <Icon
              name="mail"
              size={26}
              className="mt-[var(--space-1)] text-rs-ink-2"
            />
            <div className="min-w-0">
              <div className="text-[length:var(--text-body-lg-size)]">
                {t("settings.sources.address.title")}
              </div>
              <div className="mt-[var(--space-1)] [user-select:all] text-[length:var(--text-body-lg-size)] break-all">
                {address}
              </div>
              <div className="mt-[var(--space-2)] text-[length:var(--text-caption-size)] text-rs-ink-4">
                {t("settings.sources.address.hint")}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="min-w-[120px]"
              onClick={copyAddress}
            >
              {copied
                ? t("settings.sources.address.copied")
                : t("settings.sources.address.copy")}
            </Button>
          </div>

          <div className="mt-[var(--space-12)] flex flex-wrap items-center justify-between gap-[var(--space-9)]">
            <Button
              variant="link"
              size="2xs"
              className="text-[length:var(--text-body-sm-size)] text-rs-ink"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((value) => !value)}
            >
              {moreOpen
                ? t("settings.sources.more.hide")
                : t("settings.sources.more.show")}
            </Button>
            <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
              {t("settings.sources.more.note")}
            </span>
          </div>

          {moreOpen ? (
            <Card
              size="md"
              tone="faint"
              className="mt-[var(--space-7)] animate-rs-fade-up bg-rs-surface-subtle"
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("settings.sources.more.searchPlaceholder")}
                label={t("settings.sources.more.searchAria")}
              />
              <div className="mt-[var(--space-3)] flex flex-col">
                {showExample ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-[var(--space-7)] border-b border-rs-border-divider-soft px-[var(--space-1)] py-[var(--space-6)]">
                    <div className="min-w-0">
                      <div className="text-[length:var(--text-body-size)]">
                        {exampleName}
                      </div>
                      <div className="mt-[2px] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
                        {exampleRegion}
                      </div>
                    </div>
                    <StatusDot
                      tone="muted"
                      className="text-[length:var(--text-caption-size)]"
                    >
                      {t("settings.sources.more.state.unavailable")}
                    </StatusDot>
                    <Button
                      variant="secondary"
                      size="2xs"
                      disabled
                      title={t("settings.sources.more.example.title")}
                      className="min-w-[130px]"
                    >
                      {t("settings.sources.more.action.unavailable")}
                    </Button>
                  </div>
                ) : (
                  <div className="px-[var(--space-1)] py-[var(--space-6)] text-[length:var(--text-caption-size)] text-rs-ink-6">
                    {t("settings.sources.more.empty")}
                  </div>
                )}
              </div>
              <div className="mt-[var(--space-4)] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
                {t("settings.sources.more.footnote")}
              </div>
            </Card>
          ) : null}
        </>
      )}
    </>
  )
}

export { SourcesPage }
