/**
 * Operator → Quellen (`page = "sources"`).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx`
 * (`pages.sources` / `OpSourceRow`); `docs/UI_PORT/OPERATOR_SCREENS.md` §6 —
 * the four columns „Quelle · Region · Anbindung · Letzter Demo-Check“, the
 * derivation of `tech`/`dot`/`check`, and the footnote.
 *
 * Controls kept from the kit: the per-row `Switch`. On a portal source it is
 * the demo access (`connected` ⇄ `expired`, which is what resolves an
 * incident); on a public source it is the „Öffentliche Quellensuche“ flag, so
 * flipping one row flips them all. The kit's row expander is dropped — it only
 * repeated Region / Anbindung / Letzter Demo-Check, which are columns here.
 *
 * The per-user `enabled` preference is deliberately not shown: the operator
 * sees technical connectivity only (§6, DECISIONS.md item 4).
 *
 * Demo data — see `state/useOperatorDemoState.ts`.
 */

import { Icon } from "@/components/ui/icon"
import type { IconName } from "@/components/ui/icon"
import { StatusDot } from "@/components/ui/status-dot"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatTime, useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"
import { PageIntro } from "@/ui/operator/PageIntro"
import type {
  OperatorDemoState,
  OperatorFlags,
  OperatorSource,
  OperatorSourceId,
  OperatorSourceAccess,
} from "@/ui/operator/state/useOperatorDemoState"

const SOURCE_COLUMNS = [
  { id: "source", width: "26%" },
  { id: "region", width: "17%" },
  { id: "connection", width: "26%" },
  { id: "lastCheck", width: "19%" },
  { id: "switch", width: "12%" },
] as const

/** The kit's per-source glyph; roomscout's own mark is not a partner asset. */
const SOURCE_ICON: Record<OperatorSourceId, IconName> = {
  roomscout: "globe",
  musiker: "users",
  bandnet: "music",
}

const SOURCE_NAME: Record<OperatorSourceId, StringCopyKey> = {
  roomscout: "operator.sources.item.roomscout.name",
  musiker: "operator.sources.item.musiker.name",
  bandnet: "operator.sources.item.bandnet.name",
}

const SOURCE_REGION: Record<OperatorSourceId, StringCopyKey> = {
  roomscout: "operator.sources.item.roomscout.region",
  musiker: "operator.sources.item.musiker.region",
  bandnet: "operator.sources.item.bandnet.region",
}

interface SourceRowProps {
  source: OperatorSource
  flags: OperatorFlags
  onSetAccess: (id: OperatorSourceId, access: OperatorSourceAccess) => void
  onSetFlags: (flags: OperatorFlags) => void
}

function SourceRow({
  source,
  flags,
  onSetAccess,
  onSetFlags,
}: SourceRowProps) {
  const { t, locale } = useCopy()
  const portal = source.kind === "portal"
  const on = portal ? source.access === "connected" : flags.publicSearch

  const name = t(SOURCE_NAME[source.id])
  const separator = t("operator.overview.openai.separator")
  const switchLabel = portal
    ? `${name} ${separator} ${t("operator.sources.column.connection")}`
    : `${name} ${separator} ${t("operator.flags.publicSearch.label")}`

  const techKey: StringCopyKey = portal
    ? on
      ? "operator.sources.tech.portal.connected"
      : "operator.sources.tech.portal.expired"
    : on
      ? "operator.sources.tech.public.active"
      : "operator.sources.tech.public.inactive"

  const tone = portal ? (on ? "success" : "warning") : on ? "success" : "idle"

  const check = portal
    ? source.lastAccess
      ? t("operator.sources.check.renewed", {
          time: formatTime(locale, source.lastAccess),
        })
      : t("operator.sources.check.demoRun")
    : t("operator.sources.check.none")

  return (
    <TableRow>
      <TableCell>
        <span className="flex items-center gap-[var(--space-5)]">
          <span className="flex size-[var(--space-13)] flex-none items-center justify-center rounded-circle border border-rs-border-control bg-rs-surface-subtle text-rs-ink-2">
            <Icon name={SOURCE_ICON[source.id]} size={16} />
          </span>
          {name}
        </span>
      </TableCell>
      <TableCell muted>{t(SOURCE_REGION[source.id])}</TableCell>
      <TableCell>
        <StatusDot
          tone={tone}
          className="text-[length:var(--text-body-size)] text-rs-ink"
        >
          {t(techKey)}
        </StatusDot>
      </TableCell>
      <TableCell muted>{check}</TableCell>
      <TableCell className="text-right">
        <Switch
          checked={on}
          label={switchLabel}
          onCheckedChange={(checked) => {
            if (portal) {
              onSetAccess(source.id, checked ? "connected" : "expired")
              return
            }
            onSetFlags({ ...flags, publicSearch: checked })
          }}
        />
      </TableCell>
    </TableRow>
  )
}

interface SourcesPageProps {
  state: OperatorDemoState
  onSetAccess: (id: OperatorSourceId, access: OperatorSourceAccess) => void
  onSetFlags: (flags: OperatorFlags) => void
}

function SourcesPage({ state, onSetAccess, onSetFlags }: SourcesPageProps) {
  const { t } = useCopy()

  return (
    <div className="flex flex-col">
      <PageIntro
        title={t("operator.sources.title")}
        lead={t("operator.sources.subtitle")}
      />

      <Table container={{ className: "mt-[var(--space-12)] font-sans" }}>
        <colgroup>
          {SOURCE_COLUMNS.map((column) => (
            <col key={column.id} style={{ width: column.width }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead>{t("operator.sources.column.source")}</TableHead>
            <TableHead>{t("operator.sources.column.region")}</TableHead>
            <TableHead>{t("operator.sources.column.connection")}</TableHead>
            <TableHead>{t("operator.sources.column.lastCheck")}</TableHead>
            {/* The switch column has no header in the kit; its control is
                named by the source it belongs to. */}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              flags={state.flags}
              onSetAccess={onSetAccess}
              onSetFlags={onSetFlags}
            />
          ))}
        </TableBody>
      </Table>

      <p className="mt-[var(--space-7)] text-[14.5px] leading-[var(--text-body-leading-relaxed)] text-rs-ink-6">
        {t("operator.sources.footnote")}
      </p>
    </div>
  )
}

export { SourcesPage }
export type { SourcesPageProps }
