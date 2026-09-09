/**
 * „Was dein Scout weiß“ — the summary line, the three category tabs, the
 * editable knowledge rows, the change log and the context import entry point.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:105-138`
 * (`KnowledgePage`), measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §7.
 * Applied deltas: DECISIONS item 39 (a row that is part of the search order
 * answers a retire attempt with a toast) and the 6 s undo bar for the rest.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Overline } from "@/components/ui/overline"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCopy } from "@/ui/copy"

import { KnowledgeRow } from "../KnowledgeRow"
import { PageLead, PageTitle } from "../primitives"
import {
  knowledgeText,
  type KnowledgeCategory,
  type KnowledgeItem,
  type SettingsPageContext,
} from "../state/useSettingsDemoState"

interface KnowledgePageProps extends SettingsPageContext {
  onOpenImport: () => void
}

const CATEGORIES: readonly KnowledgeCategory[] = ["band", "alltag", "ausstattung"]

/** The prototype's undo window for a retired memory row (§7.5). */
const UNDO_MS = 6000

function KnowledgePage({
  data,
  actions,
  navigate,
  toast,
  onOpenImport,
}: KnowledgePageProps) {
  const { t } = useCopy()
  const [tab, setTab] = React.useState<KnowledgeCategory>("band")
  const [editId, setEditId] = React.useState<string | null>(null)
  const [undo, setUndo] = React.useState<KnowledgeItem | null>(null)
  const [logOpen, setLogOpen] = React.useState(false)
  const undoTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  React.useEffect(() => () => clearTimeout(undoTimer.current), [])

  const label = React.useCallback(
    (item: KnowledgeItem) => knowledgeText(item, t),
    [t]
  )

  const rows = data.knowledge.filter(
    (item) => item.cat === tab && item.status !== "retired"
  )
  const anyRows = data.knowledge.some((item) => item.status !== "retired")

  function retire(item: KnowledgeItem) {
    // DECISIONS item 39: search-order rows are corrected, never retired.
    if (item.factId) {
      toast(t("settings.knowledge.toast.factRetire"))
      return
    }
    actions.retireKnowledge(item.id)
    setUndo(item)
    clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS)
  }

  return (
    <>
      <PageTitle>{t("settings.knowledge.title")}</PageTitle>
      <PageLead>{t("settings.knowledge.subtitle")}</PageLead>

      <div className="mt-[var(--space-12)] flex items-center justify-between gap-[var(--space-9)] rounded-card border border-rs-border-panel bg-rs-surface-subtle px-[var(--space-11)] py-[var(--space-9)]">
        <p className="m-0 text-[length:var(--text-body-lg-size)] leading-[1.45]">
          {t("settings.knowledge.summary.demo")}
        </p>
        <IconButton
          variant="bare"
          size={40}
          label={t("settings.knowledge.summary.editAria")}
          onClick={() => {
            if (!anyRows) {
              toast(t("settings.knowledge.toast.noItems"))
              return
            }
            setTab("band")
          }}
        >
          <Icon name="edit" size={20} />
        </IconButton>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as KnowledgeCategory)}
        className="mt-[var(--space-10)]"
      >
        <TabsList aria-label={t("settings.knowledge.title")}>
          {CATEGORIES.map((category) => (
            <TabsTrigger key={category} value={category}>
              {t(`settings.knowledge.tab.${category}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((category) => (
          <TabsContent
            key={category}
            value={category}
            className="pt-[var(--space-10)]"
          >
            <Overline>{t(`settings.knowledge.tab.${category}`)}</Overline>

            {rows.length === 0 ? (
              <div className="mt-[var(--space-6)] rounded-card border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-11)] py-[var(--space-10)] text-[length:var(--text-body-lg-size)] text-rs-ink-2">
                {t(`settings.knowledge.empty.${category}`)}
              </div>
            ) : null}

            <div className="mt-[var(--space-2)]">
              {rows.map((item) => (
                <KnowledgeRow
                  key={item.id}
                  item={item}
                  text={label(item)}
                  editing={editId === item.id}
                  onEditStart={() => setEditId(item.id)}
                  onEditCancel={() => setEditId(null)}
                  onEditSave={(text) => {
                    actions.updateKnowledge(item.id, text)
                    setEditId(null)
                  }}
                  onConfirm={() => actions.confirmKnowledge(item.id)}
                  onDismiss={() => {
                    actions.dismissKnowledge(item.id)
                    toast(t("settings.knowledge.toast.dismissed"))
                  }}
                  onRetire={() => retire(item)}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {undo ? (
        <div
          role="status"
          className="mt-[var(--space-5)] flex animate-rs-fade-up items-center justify-between gap-[var(--space-7)] rounded-card-sm border border-rs-border-card bg-rs-surface-subtle-2 px-[var(--space-7)] py-[var(--space-5)] text-[length:var(--text-caption-size)]"
        >
          <span>
            {t("settings.knowledge.undo.text", { text: label(undo) })}
          </span>
          <Button
            variant="ghost"
            size="2xs"
            className="font-medium text-rs-orange-light"
            onClick={() => {
              actions.restoreKnowledge(undo.id)
              setUndo(null)
            }}
          >
            {t("settings.knowledge.undo.action")}
          </Button>
        </div>
      ) : null}

      <Button
        variant="link"
        size="2xs"
        aria-expanded={logOpen}
        className="mt-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink"
        onClick={() => setLogOpen((value) => !value)}
      >
        {logOpen
          ? t("settings.knowledge.log.hide")
          : t("settings.knowledge.log.show")}
      </Button>

      {logOpen ? (
        <div className="mt-[var(--space-4)] animate-rs-fade-up rounded-card border border-rs-border-card-soft bg-rs-surface-subtle px-[var(--space-9)] py-[var(--space-6)]">
          {data.knowledgeLog.length === 0 ? (
            <div className="py-[var(--space-1)] text-[length:var(--text-caption-size)] text-rs-ink-6">
              {t("settings.knowledge.log.empty")}
            </div>
          ) : null}
          {data.knowledgeLog.map((entry) => (
            <div
              key={entry.id}
              className="flex justify-between gap-[var(--space-7)] border-b border-rs-border-divider-soft py-[var(--space-3)] text-[length:var(--text-caption-size)]"
            >
              <span>
                {t(entry.key, { text: entry.text, n: entry.n })}
              </span>
              <span className="whitespace-nowrap text-rs-ink-6">
                {entry.when}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-[var(--space-12)] grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-[var(--space-9)] border-t border-rs-border-divider pt-[var(--space-11)]">
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="text-rs-ink-2"
        >
          <path d="M12 4v11M7 10l5 5 5-5" />
          <path d="M4 19h16" />
        </svg>
        <div className="min-w-0">
          <div className="text-[length:var(--text-body-lg-size)]">
            {t("settings.knowledge.import.title")}
          </div>
          <div className="mt-[var(--space-1)] text-[length:var(--text-caption-size)] text-rs-ink-4">
            {t("settings.knowledge.import.sub")}
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={onOpenImport}>
          {t("settings.knowledge.import.cta")}
        </Button>
      </div>

      <Button
        variant="link"
        size="2xs"
        className="mt-[var(--space-10)] text-[length:var(--text-body-sm-size)] text-rs-ink"
        onClick={() => navigate("privacy")}
      >
        {t("settings.knowledge.managePrivacy")}
      </Button>
    </>
  )
}

export { KnowledgePage }
