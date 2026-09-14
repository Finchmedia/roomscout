/**
 * The settings surface — `PanelDialog` with the two nav groups, the seven
 * pages, and the panel-scoped overlays (connection sheet, import dialog,
 * discard dialog).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:248-275`
 * (the `Settings` shell), measured in `docs/UI_PORT/SETTINGS_SCREENS.md`
 * §1–§3 (panel), §2 (nav), §6 (discard gate), §14 (toast slot).
 *
 * The shell is `src/ui/chrome/PanelDialog.tsx`, which adds the breadcrumb
 * header („Einstellungen › {Seite}“), the × and the < 900px page picker that
 * the prototype does not have (§1.2 port delta), and keeps the sidebar's
 * „Zurück zum Scout“ row.
 *
 * §6's `tryNav` gate lives here: the autonomy draft is panel state, so every
 * navigation — nav row, back row, breadcrumb picker, cross-link, „Zum Scout“ —
 * runs through `tryNav` and opens the discard dialog while it is dirty.
 */

import * as React from "react"

import { Icon } from "@/components/ui/icon"
import { showToast } from "@/components/ui/sonner"
import { PanelDialog, type PanelDialogGroup } from "@/ui/chrome/PanelDialog"
import { useCopy } from "@/ui/copy"

import { ConnectionSheet } from "./ConnectionSheet"
import { DiscardDialog } from "./DiscardDialog"
import { ImportDialog } from "./ImportDialog"
import { AutonomyPage } from "./pages/AutonomyPage"
import { BillingPage } from "./pages/BillingPage"
import { KnowledgePage } from "./pages/KnowledgePage"
import { NotificationsPage } from "./pages/NotificationsPage"
import { PrivacyPage } from "./pages/PrivacyPage"
import { ProfilePage } from "./pages/ProfilePage"
import { SourcesPage } from "./pages/SourcesPage"
import {
  knowledgeText,
  type AutonomyRules,
  type SettingsActions,
  type SettingsData,
  type SettingsPageContext,
  type SettingsPageId,
  type SourceId,
} from "./state/useSettingsDemoState"

/** §2.2 — the three host values of the session line. */
type SettingsSession = "working" | "paused" | "held"

interface SettingsPanelProps {
  open: boolean
  onOpenChange?: (open: boolean) => void
  data: SettingsData
  actions: SettingsActions
  /** Controlled page; omit to let the panel keep its own. */
  page?: SettingsPageId
  onPageChange?: (page: SettingsPageId) => void
  /** „Zurück zum Scout“ / „Zum Scout“. Defaults to closing the panel. */
  onBack?: () => void
  /** The session line under the back row; omit to hide it. */
  session?: SettingsSession | null
}

/** §14 — one toast slot, 2400 ms, replacing whatever is showing. */
const TOAST_MS = 2400

function SettingsPanel({
  open,
  onOpenChange,
  data,
  actions,
  page,
  onPageChange,
  onBack,
  session = null,
}: SettingsPanelProps) {
  const { t } = useCopy()

  const [internalPage, setInternalPage] =
    React.useState<SettingsPageId>("sources")
  const currentPage = page ?? internalPage

  const [rulesDraft, setRulesDraft] = React.useState<AutonomyRules | null>(null)
  const [connectionSource, setConnectionSource] = React.useState<SourceId | null>(
    null
  )
  const [connectionOpen, setConnectionOpen] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [discardNext, setDiscardNext] = React.useState<{
    run: () => void
  } | null>(null)

  const dirty =
    rulesDraft !== null &&
    JSON.stringify(rulesDraft) !== JSON.stringify(data.rules)

  /** §6: every navigation out of a dirty „Handlungsspielraum“ is confirmed. */
  const tryNav = React.useCallback(
    (run: () => void) => {
      if (dirty) {
        setDiscardNext({ run })
        return
      }
      run()
    },
    [dirty]
  )

  const goTo = React.useCallback(
    (next: SettingsPageId) => {
      tryNav(() => {
        setInternalPage(next)
        onPageChange?.(next)
      })
    },
    [onPageChange, tryNav]
  )

  const back = React.useCallback(() => {
    tryNav(() => {
      if (onBack) {
        onBack()
        return
      }
      onOpenChange?.(false)
    })
  }, [onBack, onOpenChange, tryNav])

  const toast = React.useCallback((message: string) => {
    showToast(message, { duration: TOAST_MS })
  }, [])

  const context: SettingsPageContext = {
    data,
    actions,
    navigate: goTo,
    back,
    toast,
  }

  const groups: PanelDialogGroup[] = [
    {
      id: "scout",
      label: t("settings.nav.groupScout"),
      items: [
        {
          id: "sources",
          label: t("settings.nav.item.sources"),
          icon: <Icon name="globe" />,
        },
        {
          id: "autonomy",
          label: t("settings.nav.item.autonomy"),
          icon: <Icon name="sliders" />,
        },
        {
          id: "knowledge",
          label: t("settings.nav.item.knowledge"),
          icon: <Icon name="doc" />,
        },
      ],
    },
    {
      id: "account",
      label: t("settings.nav.groupAccount"),
      items: [
        {
          id: "profile",
          label: t("settings.nav.item.profile"),
          icon: <Icon name="user" />,
        },
        {
          id: "notifications",
          label: t("settings.nav.item.notifications"),
          icon: <Icon name="bell" />,
        },
        {
          id: "billing",
          label: t("settings.nav.item.billing"),
          icon: <Icon name="card" />,
        },
        {
          id: "privacy",
          label: t("settings.nav.item.privacy"),
          icon: <Icon name="shield" />,
        },
      ],
    },
  ]

  const factText = (factId: string): string => {
    const item = data.knowledge.find((entry) => entry.factId === factId)
    return item ? knowledgeText(item, t) : ""
  }

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("settings.nav.aria")}
      rootLabel={t("settings.nav.aria")}
      closeLabel={t("common.close")}
      groups={groups}
      currentId={currentPage}
      onSelect={(id) => goTo(id as SettingsPageId)}
      back={{ label: t("settings.nav.back"), onSelect: back }}
      navHeader={
        session ? (
          <div className="mx-[var(--space-4)] flex items-start gap-[var(--space-3)] text-[length:var(--text-micro-size)] leading-[1.4] text-rs-ink-4">
            <span
              aria-hidden="true"
              className="mt-[5px] size-[7px] flex-none rounded-circle bg-rs-orange"
            />
            {t(`settings.session.${session}`)}
          </div>
        ) : null
      }
      footer={
        <div className="px-[var(--space-4)]">
          <div className="text-[length:var(--text-body-size)] font-medium text-rs-ink">
            {data.name}
          </div>
          <div className="mt-[2px] text-[length:var(--text-caption-size)] text-rs-ink-6">
            {t("settings.nav.footer.role")}
          </div>
        </div>
      }
      overlays={
        <>
          <ConnectionSheet
            open={connectionOpen}
            onOpenChange={setConnectionOpen}
            source={data.sources.find(
              (source) => source.id === connectionSource
            )}
            onSetAccess={actions.setAccess}
          />
          <ImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            onApply={actions.addKnowledge}
            toast={toast}
            bandFact={factText("band")}
            budgetFact={factText("budget")}
          />
          <DiscardDialog
            open={discardNext !== null}
            onKeepEditing={() => setDiscardNext(null)}
            onDiscard={() => {
              const queued = discardNext
              setRulesDraft(null)
              setDiscardNext(null)
              queued?.run()
            }}
          />
        </>
      }
    >
      {currentPage === "sources" ? (
        <SourcesPage
          {...context}
          onOpenConnection={(id) => {
            setConnectionSource(id)
            setConnectionOpen(true)
          }}
        />
      ) : null}

      {currentPage === "autonomy" ? (
        <AutonomyPage
          rules={data.rules}
          draft={rulesDraft}
          onDraftChange={setRulesDraft}
          onSave={(rules) => {
            actions.saveRules(rules)
            setRulesDraft(null)
          }}
        />
      ) : null}

      {currentPage === "knowledge" ? (
        <KnowledgePage {...context} onOpenImport={() => setImportOpen(true)} />
      ) : null}

      {currentPage === "profile" ? <ProfilePage {...context} /> : null}
      {currentPage === "notifications" ? (
        <NotificationsPage {...context} />
      ) : null}
      {currentPage === "billing" ? <BillingPage {...context} /> : null}
      {currentPage === "privacy" ? <PrivacyPage {...context} /> : null}

      {/* §1.4 host caption. The prototype prints it under the panel; inside the
          sidebar-13 shell the content column's foot is the equivalent spot. */}
      <p className="mt-[var(--space-16)] mb-0 text-center text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
        {t("settings.host.caption")}
      </p>
    </PanelDialog>
  )
}

export { SettingsPanel }
export type { SettingsPanelProps, SettingsSession }
