/**
 * Operator → Aufträge (`page = "tasks"`).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx`
 * (`pages.tasks`); `docs/UI_PORT/OPERATOR_SCREENS.md` §7 — the two filter
 * chips („Alle“ / „Braucht Aufmerksamkeit“, `aria-pressed`), the same task
 * table as the overview, and the empty state.
 *
 * DECISIONS.md item 2: the chips gain the hover the prototype forgot, and the
 * pressed background survives it.
 *
 * Demo data — see `state/useOperatorDemoState.ts`.
 */

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useCopy } from "@/ui/copy"
import { PageIntro } from "@/ui/operator/PageIntro"
import { TaskTable } from "@/ui/operator/TaskRow"
import type {
  OperatorTask,
  OperatorTaskId,
} from "@/ui/operator/state/useOperatorDemoState"

/** `Operator.jsx` `filter` — component state, never reset on navigation. */
type OperatorTaskFilter = "all" | "attention"

const TASK_FILTERS: OperatorTaskFilter[] = ["all", "attention"]

interface TasksPageProps {
  tasks: readonly OperatorTask[]
  filter: OperatorTaskFilter
  onFilterChange: (filter: OperatorTaskFilter) => void
  openTaskId: OperatorTaskId | null
  onToggleTask: (id: OperatorTaskId) => void
  onDiagnose: () => void
}

function TasksPage({
  tasks,
  filter,
  onFilterChange,
  openTaskId,
  onToggleTask,
  onDiagnose,
}: TasksPageProps) {
  const { t } = useCopy()
  const visible =
    filter === "attention" ? tasks.filter((task) => task.attention) : tasks

  return (
    <div className="flex flex-col">
      <PageIntro
        title={t("operator.orders.title")}
        lead={t("operator.orders.subtitle")}
      />

      <div className="mt-[var(--space-10)] flex flex-wrap gap-[var(--space-2)]">
        {TASK_FILTERS.map((value) => {
          const active = filter === value
          return (
            <Badge key={value} asChild variant="pill">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onFilterChange(value)}
                className={cn(
                  "cursor-pointer transition-[background-color] duration-[var(--duration-fast)] ease-out-soft",
                  active
                    ? "bg-rs-surface-accent-tint-hover"
                    : "bg-rs-surface-subtle hover:bg-rs-surface-hover-soft"
                )}
              >
                {value === "all"
                  ? t("operator.orders.filter.all")
                  : t("operator.orders.filter.attention")}
              </button>
            </Badge>
          )
        })}
      </div>

      <TaskTable
        className="mt-[var(--space-7)]"
        tasks={visible}
        openTaskId={openTaskId}
        onToggleDetails={onToggleTask}
        onDiagnose={onDiagnose}
        empty={t("operator.orders.empty")}
      />
    </div>
  )
}

export { TasksPage }
export type { OperatorTaskFilter, TasksPageProps }
