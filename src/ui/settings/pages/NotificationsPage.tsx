/**
 * „Benachrichtigungen“ — when the Scout gets in touch, and through which
 * channel.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:172-183`
 * (`NotifPage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §9. §9.3 spells
 * the channel control `role="radiogroup"` / `role="radio"`, so it is built as a
 * segmented radio group and not as a tablist.
 */

import { cn } from "@/lib/utils"

import { Overline } from "@/components/ui/overline"
import { Switch } from "@/components/ui/switch"
import { useCopy } from "@/ui/copy"

import { PageLead, PageTitle, SettingsRow } from "../primitives"
import type {
  NotificationPrefs,
  SettingsPageContext,
} from "../state/useSettingsDemoState"

type NotificationToggle = "decision" | "offer" | "digest"

const TOGGLES: readonly NotificationToggle[] = ["decision", "offer", "digest"]

const CHANNELS: readonly NotificationPrefs["channel"][] = ["app", "mail"]

function NotificationsPage({ data, actions, toast }: SettingsPageContext) {
  const { t } = useCopy()
  const notif = data.notif

  function setToggle(key: NotificationToggle, value: boolean) {
    const next: NotificationPrefs = { ...notif }
    next[key] = value
    actions.setNotif(next)
    toast(t("settings.notif.toast.saved"))
  }

  return (
    <>
      <PageTitle>{t("settings.notif.title")}</PageTitle>
      <PageLead>{t("settings.notif.subtitle")}</PageLead>

      <div className="mt-[var(--space-12)]">
        {TOGGLES.map((key) => (
          <SettingsRow key={key}>
            <div>
              <div className="text-[length:var(--text-body-lg-size)]">
                {t(`settings.notif.${key}.label`)}
              </div>
              <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-6">
                {t(`settings.notif.${key}.sub`)}
              </div>
            </div>
            <Switch
              checked={notif[key]}
              onCheckedChange={(checked) => setToggle(key, checked)}
              label={t(`settings.notif.${key}.label`)}
            />
          </SettingsRow>
        ))}
      </div>

      <Overline className="mt-[var(--space-13)]">
        {t("settings.notif.channel.label")}
      </Overline>
      <div
        role="radiogroup"
        aria-label={t("settings.notif.channel.aria")}
        className="mt-[var(--space-5)] inline-flex rounded-control-lg border border-rs-border-panel bg-rs-surface-inset p-[var(--space-1)]"
      >
        {CHANNELS.map((channel) => (
          <button
            key={channel}
            type="button"
            role="radio"
            aria-checked={notif.channel === channel}
            className={cn(
              "h-[var(--size-button-2xs)] cursor-pointer rounded-[9px] border-0 px-[var(--space-8)]",
              "font-sans text-[length:var(--text-body-sm-size)] text-rs-ink",
              "transition-colors duration-[var(--duration-fast)]",
              "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
              notif.channel === channel
                ? "bg-rs-surface-hover"
                : "bg-transparent"
            )}
            onClick={() => {
              actions.setNotif({ ...notif, channel })
              toast(t("settings.notif.toast.saved"))
            }}
          >
            {t(`settings.notif.channel.${channel}`)}
          </button>
        ))}
      </div>

      <p className="mt-[var(--space-8)] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4">
        {t("settings.notif.footnote")}
      </p>
    </>
  )
}

export { NotificationsPage }
