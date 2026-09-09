/**
 * Operator task table — the „Vorgang · Quelle · Status · Nächster Schritt“ grid
 * that the overview and the Aufträge page both render, plus its per-row
 * expander.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` `TaskTable` /
 * `taskRows`; `docs/UI_PORT/OPERATOR_SCREENS.md` §5.8 (columns
 * `1.3fr 1fr 1.2fr 1fr`, amber row tint on the expired row, `Diagnose` button
 * vs. `Details` link, expanded detail row) and §7.2–§7.3 (same markup, filtered
 * list, empty state).
 *
 * Rows are demo data — see `state/useOperatorDemoState.ts`.
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { StatusDot } from "@/components/ui/status-dot"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"
import type {
  OperatorTask,
  OperatorTaskId,
  OperatorTaskStatus,
  OperatorTone,
} from "@/ui/operator/state/useOperatorDemoState"

/** `Operator.jsx` `mk()`: status → label + dot colour. */
const TASK_STATUS: Record<
  OperatorTaskStatus,
  { labelKey: StringCopyKey; tone: OperatorTone }
> = {
  done: { labelKey: "operator.tasks.status.done", tone: "success" },
  expired: { labelKey: "operator.tasks.status.expired", tone: "warning" },
  blocked: { labelKey: "operator.tasks.status.blocked", tone: "idle" },
  planned: { labelKey: "operator.tasks.status.planned", tone: "idle" },
  resumed: { labelKey: "operator.tasks.status.resumed", tone: "success" },
}

/** §5.8's `1.3fr 1fr 1.2fr 1fr`, resolved to percentages for `<colgroup>`. */
const TASK_COLUMNS = [
  { id: "process", width: "28.9%" },
  { id: "source", width: "22.2%" },
  { id: "status", width: "26.7%" },
  { id: "next", width: "22.2%" },
] as const

interface TaskRowProps {
  task: OperatorTask
  expanded: boolean
  onToggleDetails: (id: OperatorTaskId) => void
  onDiagnose: () => void
}

function TaskRow({ task, expanded, onToggleDetails, onDiagnose }: TaskRowProps) {
  const { t } = useCopy()
  const status = TASK_STATUS[task.status]

  return (
    <>
      <TableRow highlight={task.attention}>
        <TableCell className="text-[length:var(--text-body-size)]">
          {t(task.nameKey)}
        </TableCell>
        <TableCell muted>{t("operator.tasks.source.roomscout")}</TableCell>
        <TableCell>
          <StatusDot
            tone={status.tone}
            className="text-[length:var(--text-body-size)] text-rs-ink"
          >
            {t(status.labelKey)}
          </StatusDot>
        </TableCell>
        <TableCell>
          {task.attention ? (
            // §5.8 outline/table action: 40px tall, 10px radius.
            <Button
              variant="secondary"
              size="xs"
              className="h-10 rounded-control px-[var(--space-8)] text-[length:var(--text-body-sm-size)]"
              onClick={onDiagnose}
            >
              {t("operator.tasks.action.diagnose")}
            </Button>
          ) : (
            <Button
              variant="link"
              size="2xs"
              aria-expanded={expanded}
              className={cn(
                "text-[length:var(--text-body-sm-size)] text-rs-ink hover:text-rs-orange-light",
                !expanded && "no-underline"
              )}
              onClick={() => onToggleDetails(task.id)}
            >
              {t("operator.tasks.action.details")}
              <Icon name="chevron-right" size={14} />
            </Button>
          )}
        </TableCell>
      </TableRow>

      {expanded ? (
        <TableRow>
          <TableCell
            colSpan={TASK_COLUMNS.length}
            className="animate-rs-fade-up pt-[var(--space-4)] pb-[var(--space-6)] text-[14.5px] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4"
          >
            {t(task.detailKey)}
          </TableCell>
        </TableRow>
      ) : null}
    </>
  )
}

interface TaskTableProps {
  tasks: readonly OperatorTask[]
  openTaskId: OperatorTaskId | null
  onToggleDetails: (id: OperatorTaskId) => void
  onDiagnose: () => void
  /** Rendered in place of the rows when the filtered list is empty (§7.3). */
  empty?: React.ReactNode
  className?: string
}

function TaskTable({
  tasks,
  openTaskId,
  onToggleDetails,
  onDiagnose,
  empty,
  className,
}: TaskTableProps) {
  const { t } = useCopy()

  return (
    <Table container={{ className: cn("font-sans text-rs-ink", className) }}>
      <colgroup>
        {TASK_COLUMNS.map((column) => (
          <col key={column.id} style={{ width: column.width }} />
        ))}
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableHead>{t("operator.tasks.column.process")}</TableHead>
          <TableHead>{t("operator.tasks.column.source")}</TableHead>
          <TableHead>{t("operator.tasks.column.status")}</TableHead>
          <TableHead>{t("operator.tasks.column.next")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.length === 0 && empty !== undefined ? (
          <TableRow>
            <TableCell
              colSpan={TASK_COLUMNS.length}
              className="py-[var(--space-8)] text-[length:var(--text-body-sm-size)] text-rs-ink-6"
            >
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              expanded={openTaskId === task.id}
              onToggleDetails={onToggleDetails}
              onDiagnose={onDiagnose}
            />
          ))
        )}
      </TableBody>
    </Table>
  )
}

export { TaskRow, TaskTable }
export type { TaskRowProps, TaskTableProps }
