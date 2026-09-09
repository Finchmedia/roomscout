/**
 * „Datenschutz“ — what the demo stores locally, and the two cross-links into
 * the pages that manage it.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:210-224`
 * (`PrivacyPage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §11.
 * The export writes a JSON blob of the local demo data and reports through the
 * panel's toast slot; nothing leaves the browser.
 */

import { Button } from "@/components/ui/button"
import { useCopy } from "@/ui/copy"

import { PageLead, PageTitle, SettingsRow } from "../primitives"
import type { SettingsPageContext } from "../state/useSettingsDemoState"

function PrivacyPage({ data, navigate, toast }: SettingsPageContext) {
  const { t, tp } = useCopy()

  const stored = data.knowledge.filter((item) => item.status !== "retired")
  const connected = data.sources.filter(
    (source) => source.kind === "portal" && source.access === "connected"
  )

  function exportDemoData() {
    try {
      const payload = JSON.stringify(
        {
          note: t("settings.privacy.export.note"),
          name: data.name,
          sources: data.sources,
          rules: data.rules,
          knowledge: data.knowledge,
          notif: data.notif,
        },
        null,
        2
      )
      const url = URL.createObjectURL(
        new Blob([payload], { type: "application/json" })
      )
      const link = document.createElement("a")
      link.href = url
      link.download = t("settings.privacy.export.filename")
      link.click()
      URL.revokeObjectURL(url)
      toast(t("settings.privacy.toast.exported"))
    } catch {
      toast(t("settings.privacy.toast.exportFailed"))
    }
  }

  return (
    <>
      <PageTitle>{t("settings.privacy.title")}</PageTitle>
      <PageLead>{t("settings.privacy.subtitle")}</PageLead>

      <div className="mt-[var(--space-12)]">
        <SettingsRow className="border-t border-t-rs-border-divider py-[var(--space-8)]">
          <div>
            <div className="text-[length:var(--text-body-lg-size)]">
              {t("settings.privacy.stored.title")}
            </div>
            <div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
              {t("settings.privacy.stored.sub", { n: stored.length })}
            </div>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => navigate("knowledge")}
          >
            {t("settings.privacy.stored.cta")}
          </Button>
        </SettingsRow>

        <SettingsRow className="py-[var(--space-8)]">
          <div>
            <div className="text-[length:var(--text-body-lg-size)]">
              {t("settings.privacy.transcript.title")}
            </div>
            <div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
              {t("settings.privacy.transcript.sub")}
            </div>
          </div>
        </SettingsRow>

        <SettingsRow className="py-[var(--space-8)]">
          <div>
            <div className="text-[length:var(--text-body-lg-size)]">
              {t("settings.privacy.portals.title")}
            </div>
            <div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
              {tp("settings.privacy.portals.sub", connected.length)}
            </div>
          </div>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => navigate("sources")}
          >
            {t("settings.privacy.portals.cta")}
          </Button>
        </SettingsRow>

        <SettingsRow className="py-[var(--space-8)]">
          <div>
            <div className="text-[length:var(--text-body-lg-size)]">
              {t("settings.privacy.export.title")}
            </div>
            <div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
              {t("settings.privacy.export.sub")}
            </div>
          </div>
          <Button variant="secondary" size="xs" onClick={exportDemoData}>
            {t("settings.privacy.export.cta")}
          </Button>
        </SettingsRow>

        <SettingsRow className="py-[var(--space-8)]">
          <div>
            <div className="text-[length:var(--text-body-lg-size)]">
              {t("settings.privacy.delete.title")}
            </div>
            <div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
              {t("settings.privacy.delete.body")}
            </div>
          </div>
        </SettingsRow>

        <div className="py-[var(--space-8)]">
          <div className="text-[length:var(--text-body-lg-size)]">
            {t("settings.privacy.vendors.title")}
          </div>
          <div className="mt-[2px] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
            {t("settings.privacy.vendors.body")}
          </div>
        </div>
      </div>
    </>
  )
}

export { PrivacyPage }
