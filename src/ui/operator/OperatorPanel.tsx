/**
 * Betreiberansicht — the operator panel.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` (the whole
 * surface: header, 296px nav, six pages, Diagnose sheet, footer caption);
 * `docs/UI_PORT/OPERATOR_SCREENS.md` §3–§4 and §16 (the `sidebar-13` mapping
 * that DECISIONS.md item 47 makes the layout).
 *
 * Shell: `PanelDialog` supplies the panel, the 296px nav column, the
 * breadcrumb header („Betreiberansicht › Übersicht“), the × and the narrow
 * (< 900px) page picker (DECISIONS.md item 7). The kit's brand cluster —
 * wordmark + `INTERN` — sits in the nav header, as §16 prescribes; the
 * environment pill and the `OP` avatar live in the host header
 * (`DemoOperatorPage`).
 *
 * All UI state below mirrors `Operator.jsx`'s component state
 * (`diag`, `filter`, `openTask`, `openInt`, `flagDraft`, `flagsSaved`) and,
 * like the kit, survives page switches — see §15.1.
 *
 * The data is local demo state (`state/useOperatorDemoState.ts`); no Convex.
 */

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import type { IconName } from "@/components/ui/icon"
import { BrandLockup } from "@/components/navigation/BrandLockup"
import { PanelDialog } from "@/ui/chrome/PanelDialog"
import { useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"
import { DiagnosticsSheet } from "@/ui/operator/DiagnosticsSheet"
import { DiagnosticsPage } from "@/ui/operator/pages/DiagnosticsPage"
import { FlagsPage } from "@/ui/operator/pages/FlagsPage"
import { IntegrationsPage } from "@/ui/operator/pages/IntegrationsPage"
import { OverviewPage } from "@/ui/operator/pages/OverviewPage"
import { SourcesPage } from "@/ui/operator/pages/SourcesPage"
import { TasksPage } from "@/ui/operator/pages/TasksPage"
import type { OperatorTaskFilter } from "@/ui/operator/pages/TasksPage"
import {
  deriveIntegrations,
  deriveTasks,
  OPERATOR_PAGE_IDS,
  type OperatorDemoActions,
  type OperatorDemoState,
  type OperatorFlags,
  type OperatorIntegrationId,
  type OperatorPageId,
  type OperatorTaskId,
} from "@/ui/operator/state/useOperatorDemoState"

/** `Operator.jsx` `OPAGES` — glyph + nav label, in order. */
const OPERATOR_NAV: Record<
  OperatorPageId,
  { icon: IconName; labelKey: StringCopyKey }
> = {
  overview: { icon: "bars", labelKey: "operator.nav.overview" },
  sources: { icon: "database", labelKey: "operator.nav.sources" },
  tasks: { icon: "tasks", labelKey: "operator.nav.tasks" },
  integrations: { icon: "plug", labelKey: "operator.nav.integrations" },
  flags: { icon: "flag", labelKey: "operator.nav.flags" },
  diag: { icon: "pulse", labelKey: "operator.nav.diag" },
}

/** §9.4: „Flags lokal gespeichert.“ clears itself after 2600 ms. */
const FLAGS_SAVED_MS = 2600

interface OperatorPanelProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  state: OperatorDemoState
  actions: OperatorDemoActions
  /** „Zur App“ — the nav's first row. Defaults to closing the panel. */
  onBack?: () => void
  /**
   * Dev-only demo controls, pinned bottom-left inside the panel — the kit's
   * Demo-Steuerung strip. It has to live *inside* the panel: a modal dialog
   * makes everything behind it inert, so a strip in the page underneath would
   * be unclickable.
   */
  demoControls?: React.ReactNode
}

function OperatorPanel({
  open,
  onOpenChange,
  state,
  actions,
  onBack,
  demoControls,
}: OperatorPanelProps) {
  const { t } = useCopy()

  const [diagOpen, setDiagOpen] = React.useState(false)
  const [filter, setFilter] = React.useState<OperatorTaskFilter>("all")
  const [openTaskId, setOpenTaskId] = React.useState<OperatorTaskId | null>(null)
  const [openIntegrationId, setOpenIntegrationId] =
    React.useState<OperatorIntegrationId | null>(null)
  const [flagDraft, setFlagDraft] = React.useState<OperatorFlags | null>(null)
  const [flagsSaved, setFlagsSaved] = React.useState(false)

  // §11.7's `componentWillUnmount`: the pending timer must not outlive the
  // surface, or it sets state after teardown.
  React.useEffect(() => {
    if (!flagsSaved) return
    const timer = window.setTimeout(
      () => setFlagsSaved(false),
      FLAGS_SAVED_MS
    )
    return () => window.clearTimeout(timer)
  }, [flagsSaved])

  const tasks = deriveTasks(state)
  const integrations = deriveIntegrations(state)

  const handleBack = React.useCallback(() => {
    if (onBack) {
      onBack()
      return
    }
    onOpenChange?.(false)
  }, [onBack, onOpenChange])

  const toggleTask = React.useCallback((id: OperatorTaskId) => {
    setOpenTaskId((current) => (current === id ? null : id))
  }, [])

  const openDiagnostics = React.useCallback(() => setDiagOpen(true), [])

  const groups = [
    {
      id: "betrieb",
      label: t("operator.nav.groupLabel"),
      items: OPERATOR_PAGE_IDS.map((id) => ({
        id,
        label: t(OPERATOR_NAV[id].labelKey),
        icon: <Icon name={OPERATOR_NAV[id].icon} />,
        onSelect: () => actions.setPage(id),
      })),
    },
  ]

  const page = (() => {
    switch (state.page) {
      case "overview":
        return (
          <OverviewPage
            state={state}
            tasks={tasks}
            integrations={integrations}
            openTaskId={openTaskId}
            onToggleTask={toggleTask}
            onDiagnose={openDiagnostics}
            onViewAttention={() => {
              setFilter("attention")
              actions.setPage("tasks")
            }}
            onOpenIntegration={(id) => {
              actions.setPage("integrations")
              setOpenIntegrationId(id)
            }}
            onEditFlags={() => actions.setPage("flags")}
          />
        )
      case "sources":
        return (
          <SourcesPage
            state={state}
            onSetAccess={actions.setAccess}
            onSetFlags={actions.setFlags}
          />
        )
      case "tasks":
        return (
          <TasksPage
            tasks={tasks}
            filter={filter}
            onFilterChange={setFilter}
            openTaskId={openTaskId}
            onToggleTask={toggleTask}
            onDiagnose={openDiagnostics}
          />
        )
      case "integrations":
        return (
          <IntegrationsPage
            integrations={integrations}
            openIntegrationId={openIntegrationId}
            onOpenIntegrationChange={setOpenIntegrationId}
          />
        )
      case "flags":
        return (
          <FlagsPage
            flags={state.flags}
            draft={flagDraft}
            onDraftChange={(draft) => {
              setFlagDraft(draft)
              setFlagsSaved(false)
            }}
            onCancel={() => setFlagDraft(null)}
            onSave={() => {
              actions.setFlags(flagDraft ?? state.flags)
              setFlagDraft(null)
              setFlagsSaved(true)
            }}
            saved={flagsSaved}
          />
        )
      case "diag":
        return <DiagnosticsPage state={state} onOpenSheet={openDiagnostics} />
    }
  })()

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("operator.host.demoControls.openOperator")}
      rootLabel={t("operator.host.demoControls.openOperator")}
      navLabel={t("operator.nav.aria")}
      closeLabel={t("common.close")}
      groups={groups}
      currentId={state.page}
      back={{ label: t("operator.nav.back"), onSelect: handleBack }}
      navHeader={
        <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-5)] px-[var(--space-4)]">
          <BrandLockup size="md" />
          <Badge variant="outline">{t("operator.badge.internal")}</Badge>
        </div>
      }
      footer={
        <div className="px-[var(--space-4)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
          {t("operator.nav.footerNote")}
        </div>
      }
      overlays={
        <>
          <DiagnosticsSheet
            open={diagOpen}
            onOpenChange={setDiagOpen}
            state={state}
            onRenewLogin={actions.renewLogin}
          />
          {demoControls ? (
            <div className="absolute bottom-[var(--space-7)] left-[var(--space-7)] z-20">
              {demoControls}
            </div>
          ) : null}
        </>
      }
    >
      {page}

      {/* §3.6: the caption under the card. It scrolls with the page here, so
          the panel keeps its two-column geometry. */}
      <p className="mt-[var(--space-13)] text-center text-[13px] text-rs-ink-6">
        {t("operator.footer.note")}
      </p>
    </PanelDialog>
  )
}

export { OperatorPanel }
export type { OperatorPanelProps }
