/**
 * Operator → Betrieb im Blick (`page = "overview"`).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` (`pages.overview`);
 * `docs/UI_PORT/OPERATOR_SCREENS.md` §5 — attention/calm banner, four
 * integration tiles, the static OpenAI row, the task table and the two-column
 * block (Betriebsregeln + read-only Feature-Flags mirror).
 *
 * Everything on this page is demo data (`state/useOperatorDemoState.ts`).
 */

import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Notice } from "@/components/ui/notice"
import { Overline } from "@/components/ui/overline"
import { StatusDot } from "@/components/ui/status-dot"
import { useCopy } from "@/ui/copy"
import {
  IntegrationTile,
  PartnerLogo,
} from "@/ui/operator/IntegrationTile"
import { PageIntro } from "@/ui/operator/PageIntro"
import { TaskTable } from "@/ui/operator/TaskRow"
import {
  isIncidentOpen,
  OPERATOR_FLAG_COPY,
  OPERATOR_FLAG_KEYS,
  type OperatorDemoState,
  type OperatorIntegration,
  type OperatorIntegrationId,
  type OperatorTask,
  type OperatorTaskId,
} from "@/ui/operator/state/useOperatorDemoState"

interface OverviewPageProps {
  state: OperatorDemoState
  tasks: readonly OperatorTask[]
  integrations: readonly OperatorIntegration[]
  openTaskId: OperatorTaskId | null
  onToggleTask: (id: OperatorTaskId) => void
  onDiagnose: () => void
  /** „Ansehen“ — jumps to Aufträge with the attention filter preselected. */
  onViewAttention: () => void
  /** A tile opens the Integrationen page with that provider expanded. */
  onOpenIntegration: (id: OperatorIntegrationId) => void
  onEditFlags: () => void
}

function OverviewPage({
  state,
  tasks,
  integrations,
  openTaskId,
  onToggleTask,
  onDiagnose,
  onViewAttention,
  onOpenIntegration,
  onEditFlags,
}: OverviewPageProps) {
  const { t } = useCopy()
  const attention = isIncidentOpen(state)
  const tiles = integrations.filter((integration) => integration.id !== "openai")
  const openai = integrations.find((integration) => integration.id === "openai")

  return (
    <div className="flex flex-col">
      <PageIntro
        title={t("operator.overview.title")}
        lead={t("operator.overview.subtitle")}
      />

      {attention ? (
        <div className="animate-rs-fade-up mt-[var(--space-11)] flex flex-wrap items-center justify-between gap-[var(--space-7)] rounded-card-sm border border-rs-border-amber bg-rs-surface-amber-tint px-[var(--space-8)] py-[var(--space-6)]">
          <div className="flex items-center gap-[var(--space-6)] text-[length:var(--text-body-lg-size)]">
            <span
              aria-hidden="true"
              className="flex size-[var(--space-11)] flex-none items-center justify-center rounded-circle bg-rs-amber text-[length:var(--text-body-sm-size)] font-bold text-rs-black"
            >
              {t("operator.overview.attention.icon")}
            </span>
            {t("operator.overview.attention.text")}
          </div>
          <Button
            variant="link"
            size="2xs"
            className="text-[length:var(--text-body-size)] text-rs-ink hover:text-rs-orange-light"
            onClick={onViewAttention}
          >
            {t("operator.overview.attention.cta")}
            <Icon name="chevron-right" size={16} />
          </Button>
        </div>
      ) : (
        <Notice
          tone="success"
          className="mt-[var(--space-11)] rounded-card-sm px-[var(--space-8)] py-[var(--space-6)] text-[length:var(--text-body-sm-size)] text-rs-ink-4"
        >
          {t("operator.overview.calm.text")}
        </Notice>
      )}

      <Overline className="mt-[var(--space-12)]">
        {t("operator.overview.section.integrations")}
      </Overline>
      <div className="mt-[var(--space-5)] grid gap-[var(--space-5)] [grid-template-columns:repeat(auto-fit,minmax(210px,1fr))]">
        {tiles.map((integration) => (
          <IntegrationTile
            key={integration.id}
            integration={integration}
            onOpen={onOpenIntegration}
          />
        ))}
      </div>

      {/* §5.6: OpenAI is a static rule-bounded row here, not a tile. */}
      {openai ? (
        <div className="mt-[var(--space-6)] flex flex-wrap items-center gap-[var(--space-6)] border-b border-rs-border-divider pb-[var(--space-8)] text-[length:var(--text-body-size)]">
          <PartnerLogo src={openai.logo} size={22} />
          <span>{t("operator.overview.openai.name")}</span>
          <span className="text-rs-ink-6">
            {t("operator.overview.openai.separator")}
          </span>
          <span className="text-rs-ink-4">
            {t("operator.overview.openai.role")}
          </span>
          <StatusDot tone="success" className="ml-[var(--space-3)]">
            {t("operator.overview.openai.status")}
          </StatusDot>
        </div>
      ) : null}

      <Overline className="mt-[var(--space-11)]">
        {t("operator.overview.section.tasks")}
      </Overline>
      <TaskTable
        className="mt-[var(--space-4)]"
        tasks={tasks}
        openTaskId={openTaskId}
        onToggleDetails={onToggleTask}
        onDiagnose={onDiagnose}
      />

      <div className="mt-[var(--space-12)] grid grid-cols-1 gap-x-[var(--space-17)] gap-y-[var(--space-11)] border-t border-rs-border-divider pt-[var(--space-10)] min-[900px]:grid-cols-2">
        <section>
          <Overline>{t("operator.overview.rules.label")}</Overline>
          <div className="mt-[var(--space-4)] flex justify-between gap-[var(--space-7)] border-b border-rs-border-divider-soft py-[var(--space-4)] text-[length:var(--text-body-size)]">
            <span>{t("operator.overview.rules.sessions.label")}</span>
            <span className="text-rs-ink-4">
              {t("operator.overview.rules.sessions.value")}
            </span>
          </div>
          <div className="flex justify-between gap-[var(--space-7)] py-[var(--space-4)] text-[length:var(--text-body-size)]">
            <span>{t("operator.overview.rules.retries.label")}</span>
            <span className="text-rs-ink-4">
              {t("operator.overview.rules.retries.value")}
            </span>
          </div>
          <p className="mt-[var(--space-2)] text-[13px] text-rs-ink-6">
            {t("operator.overview.rules.note")}
          </p>
        </section>

        <section className="min-[900px]:border-l min-[900px]:border-rs-border-divider min-[900px]:pl-[var(--space-14)]">
          <Overline>{t("operator.overview.flags.label")}</Overline>
          {OPERATOR_FLAG_KEYS.map((flag) => (
            <div
              key={flag}
              className="flex items-center justify-between gap-[var(--space-7)] border-b border-rs-border-divider-soft py-[var(--space-4)] text-[length:var(--text-body-size)]"
            >
              <div className="min-w-0">
                {t(OPERATOR_FLAG_COPY[flag].labelKey)}
                {flag === "publicSearch" ? (
                  <div className="mt-[2px] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
                    {t("operator.overview.flags.publicSearch.sub")}
                  </div>
                ) : null}
              </div>
              {/* Read-only mirror of the SAVED flags — never the draft (§5.9). */}
              <StatusDot tone={state.flags[flag] ? "success" : "idle"}>
                {state.flags[flag]
                  ? t("operator.flags.state.on")
                  : t("operator.flags.state.off")}
              </StatusDot>
            </div>
          ))}
          <Button
            variant="link"
            size="2xs"
            className="mt-[var(--space-4)] text-[14.5px] text-rs-ink hover:text-rs-orange-light"
            onClick={onEditFlags}
          >
            {t("operator.overview.flags.edit")}
          </Button>
        </section>
      </div>
    </div>
  )
}

export { OverviewPage }
export type { OverviewPageProps }
