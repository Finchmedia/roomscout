/**
 * One row of „Deine Quellen“ — avatar, name/description, status, include
 * switch and an expandable detail strip.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:11-36`
 * (`SourceRow`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §4.6/§4.7.
 * Applied deltas: DECISIONS item 37 (the „Gespeichert“ flash is scoped to the
 * row that was actually toggled) and item 40 (the switch is two-state:
 * include / exclude).
 */

import * as React from "react"

import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot"
import { Switch } from "@/components/ui/switch"
import { useCopy } from "@/ui/copy"

import { SavedFlash } from "./primitives"
import { useFlash } from "./useFlash"
import type { DemoSource, SettingsFlags } from "./state/useSettingsDemoState"

interface SourceRowProps {
  source: DemoSource
  flags: SettingsFlags
  onToggle: (id: DemoSource["id"]) => void
  /** Portal rows only — opens the connection sheet for this source. */
  onOpenConnection: (id: DemoSource["id"]) => void
  /** The prototype opens roomscout.dev expanded (`Settings.jsx:12`). */
  defaultOpen?: boolean
}

/** Glyph of the source avatar; roomscout.dev shows the product mark instead. */
const SOURCE_GLYPH = {
  roomscout: "globe",
  musiker: "users",
  bandnet: "music",
} as const

function SourceRow({
  source,
  flags,
  onToggle,
  onOpenConnection,
  defaultOpen = false,
}: SourceRowProps) {
  const { t } = useCopy()
  const [open, setOpen] = React.useState(defaultOpen)
  const [saved, flashSaved] = useFlash()

  const name = t(source.nameKey)

  const status: { label: string; tone: StatusDotTone } = !source.enabled
    ? { label: t("settings.sources.status.excluded"), tone: "muted" }
    : source.kind === "portal"
      ? source.access === "connected"
        ? { label: t("settings.sources.status.connected"), tone: "success" }
        : { label: t("settings.sources.status.expired"), tone: "warning" }
      : flags.publicSearch
        ? { label: t("settings.sources.status.public"), tone: "muted" }
        : { label: t("settings.sources.detail.demoInactive"), tone: "muted" }

  return (
    <div
      data-slot="settings-source-row"
      data-enabled={source.enabled ? "true" : "false"}
      className={cn(
        "mb-[var(--space-3)] rounded-card-md border transition-colors duration-[var(--duration-base)]",
        source.enabled
          ? "border-rs-border-card-soft bg-rs-surface-subtle"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-[var(--space-5)] py-[var(--space-7)] pr-[var(--space-7)] pl-[var(--space-6)] min-[720px]:grid-cols-[52px_minmax(0,1fr)_auto_auto_auto] min-[720px]:gap-[var(--space-8)]">
        <span
          aria-hidden="true"
          className="flex size-[52px] items-center justify-center rounded-circle border border-rs-border-control bg-rs-surface-subtle text-rs-ink-2"
        >
          {source.id === "roomscout" ? (
            <img src="/logo.png" alt="" className="size-[30px] object-contain" />
          ) : (
            <Icon name={SOURCE_GLYPH[source.id]} size={22} />
          )}
        </span>

        <div className="min-w-0">
          <div className="text-[length:var(--text-lead-size)] text-rs-ink">
            {name}
          </div>
          <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">
            {t(source.descKey)}
          </div>
        </div>

        <div className="col-span-3 flex items-center gap-[var(--space-3)] min-[720px]:col-span-1">
          <StatusDot tone={status.tone}>{status.label}</StatusDot>
          <SavedFlash show={saved}>{t("settings.sources.row.saved")}</SavedFlash>
        </div>

        <Switch
          checked={source.enabled}
          onCheckedChange={() => {
            onToggle(source.id)
            flashSaved()
          }}
          label={t("settings.sources.row.switchAria", { name })}
        />

        <IconButton
          variant="bare"
          size={36}
          label={t("settings.sources.row.detailsAria")}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <Icon
            name="chevron-down"
            size={18}
            className={cn(
              "transition-transform duration-[var(--duration-base)]",
              open && "rotate-180"
            )}
          />
        </IconButton>
      </div>

      {/* 0fr → 1fr is the DS's height-less expand (Settings.jsx:25). */}
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-out-soft",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mx-[var(--space-7)] flex flex-wrap justify-between gap-[var(--space-9)] border-t border-rs-border-divider px-[var(--space-3)] pt-[var(--space-7)] pb-[var(--space-8)] text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-2">
            <div className="min-w-0">
              {source.id === "roomscout" ? (
                <>
                  <div className="text-rs-ink">
                    {t("settings.sources.detail.portalProfile", {
                      profile: t("settings.sources.demo.roomscout.profile"),
                    })}
                  </div>
                  <div>{t("settings.sources.detail.portalScope")}</div>
                </>
              ) : null}

              {source.id === "musiker" ? (
                <>
                  {t("settings.sources.detail.publicListings")}
                  {!flags.publicSearch ? (
                    <div className="mt-[var(--space-2)]">
                      <Badge variant="muted">
                        {t("settings.sources.detail.demoInactive")}
                      </Badge>
                    </div>
                  ) : null}
                </>
              ) : null}

              {source.id === "bandnet"
                ? t("settings.sources.detail.outOfRegion")
                : null}

              {!source.enabled ? (
                <div className="mt-[var(--space-2)] text-rs-ink-6">
                  {t("settings.sources.detail.offHint")}
                </div>
              ) : null}
            </div>

            {source.kind === "portal" ? (
              <Button
                variant="link"
                size="2xs"
                data-conn-trigger=""
                className="text-[length:var(--text-body-sm-size)] text-rs-ink"
                onClick={() => onOpenConnection(source.id)}
              >
                {source.access === "connected"
                  ? t("settings.sources.detail.manageConnection")
                  : t("settings.sources.detail.openLogin")}
                <Icon name="arrow-up-right" size={14} />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export { SourceRow }
