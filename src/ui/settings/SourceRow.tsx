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
import type { DemoSource, SettingsFlags } from "./state/useSettingsDemoState"
import { useFlash } from "./useFlash"

interface SourceRowSurfaceProps {
  name: string
  description: string
  enabled: boolean
  status: { label: string; tone: StatusDotTone }
  brand?: boolean
  onToggle?: (checked: boolean) => void
  disabled?: boolean
  defaultOpen?: boolean
  detail: React.ReactNode
  connectionAction?: React.ReactNode
  /** Optional source-specific glyph; non-brand rows default to the globe. */
  glyph?: React.ComponentProps<typeof Icon>["name"]
  /** Caller-owned feedback. The live surface does not imply an async save succeeded. */
  statusSupplement?: React.ReactNode
}

function SourceRowSurface({
  name,
  description,
  enabled,
  status,
  brand = false,
  onToggle,
  disabled = false,
  defaultOpen = false,
  detail,
  connectionAction,
  glyph = "globe",
  statusSupplement,
}: SourceRowSurfaceProps) {
  const { t } = useCopy()
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <div
      data-slot="settings-source-row"
      data-enabled={enabled ? "true" : "false"}
      className={cn(
        "mb-[var(--space-3)] rounded-card-md border transition-colors duration-[var(--duration-base)]",
        enabled
          ? "border-rs-border-card-soft bg-rs-surface-subtle"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-[var(--space-5)] py-[var(--space-7)] pr-[var(--space-7)] pl-[var(--space-6)] min-[720px]:grid-cols-[52px_minmax(0,1fr)_auto_auto_auto] min-[720px]:gap-[var(--space-8)]">
        <span
          aria-hidden="true"
          className="flex size-[52px] items-center justify-center rounded-circle border border-rs-border-control bg-rs-surface-subtle text-rs-ink-2"
        >
          {brand ? (
            <img src="/logo.png" alt="" className="size-[30px] object-contain" />
          ) : (
            <Icon name={glyph} size={22} />
          )}
        </span>

        <div className="min-w-0">
          <div className="text-[length:var(--text-lead-size)] text-rs-ink">{name}</div>
          <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-4">
            {description}
          </div>
        </div>

        <div className="col-span-3 flex items-center gap-[var(--space-3)] min-[720px]:col-span-1">
          <StatusDot tone={status.tone}>{status.label}</StatusDot>
          {statusSupplement}
        </div>

        <Switch
          checked={enabled}
          disabled={disabled || !onToggle}
          onCheckedChange={onToggle}
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

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--duration-base)] ease-out-soft",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mx-[var(--space-7)] flex flex-wrap justify-between gap-[var(--space-9)] border-t border-rs-border-divider px-[var(--space-3)] pt-[var(--space-7)] pb-[var(--space-8)] text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-2">
            <div className="min-w-0">{detail}</div>
            {connectionAction}
          </div>
        </div>
      </div>
    </div>
  )
}

interface SourceRowProps {
  source: DemoSource
  flags: SettingsFlags
  onToggle: (id: DemoSource["id"]) => void
  onOpenConnection: (id: DemoSource["id"]) => void
  defaultOpen?: boolean
}

const SOURCE_GLYPH = { roomscout: "globe", musiker: "users", bandnet: "music" } as const

function SourceRow({ source, flags, onToggle, onOpenConnection, defaultOpen = false }: SourceRowProps) {
  const { t } = useCopy()
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

  const detail = (
    <>
      {source.id === "roomscout" ? (
        <>
          <div className="text-rs-ink">
            {t("settings.sources.detail.portalProfile", { profile: t("settings.sources.demo.roomscout.profile") })}
          </div>
          <div>{t("settings.sources.detail.portalScope")}</div>
        </>
      ) : null}
      {source.id === "musiker" ? (
        <>
          {t("settings.sources.detail.publicListings")}
          {!flags.publicSearch ? (
            <div className="mt-[var(--space-2)]">
              <Badge variant="muted">{t("settings.sources.detail.demoInactive")}</Badge>
            </div>
          ) : null}
        </>
      ) : null}
      {source.id === "bandnet" ? t("settings.sources.detail.outOfRegion") : null}
      {!source.enabled ? (
        <div className="mt-[var(--space-2)] text-rs-ink-6">{t("settings.sources.detail.offHint")}</div>
      ) : null}
    </>
  )

  const connectionAction = source.kind === "portal" ? (
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
  ) : undefined

  return (
    <SourceRowSurface
      name={name}
      description={t(source.descKey)}
      enabled={source.enabled}
      status={status}
      brand={source.id === "roomscout"}
      glyph={SOURCE_GLYPH[source.id]}
      defaultOpen={defaultOpen}
      detail={detail}
      connectionAction={connectionAction}
      statusSupplement={<SavedFlash show={saved}>{t("settings.sources.row.saved")}</SavedFlash>}
      onToggle={() => {
        onToggle(source.id)
        flashSaved()
      }}
    />
  )
}

export { SourceRow, SourceRowSurface }
export type { SourceRowSurfaceProps }
