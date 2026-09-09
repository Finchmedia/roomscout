/**
 * Incident event log — the two-column „Ereignisfolge“ list.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` (Diagnose
 * page rows and the sheet's `Ereignisfolge`);
 * `docs/UI_PORT/OPERATOR_SCREENS.md` §10.2 (page: `110px 1fr`, 15.5px, divider
 * `--rs-border-divider-soft`) and §11.4 (sheet: `100px 1fr`, 14.5px, hairline).
 *
 * The rows are demo data — see `state/useOperatorDemoState.ts`.
 */

import { cn } from "@/lib/utils"
import { useCopy } from "@/ui/copy"
import type { OperatorEvent } from "@/ui/operator/state/useOperatorDemoState"

interface EventTimelineProps {
  events: readonly OperatorEvent[]
  /** `sheet` is the tighter variant used inside the Diagnose sheet (§11.4). */
  density?: "page" | "sheet"
  className?: string
}

function EventTimeline({
  events,
  density = "page",
  className,
}: EventTimelineProps) {
  const { t } = useCopy()
  const sheet = density === "sheet"

  return (
    <div
      data-slot="operator-event-timeline"
      data-density={density}
      className={cn("flex flex-col", className)}
    >
      {events.map((event, index) => (
        <div
          key={`${event.id}-${index}`}
          className={cn(
            "grid items-baseline border-b border-rs-border-divider-soft",
            sheet
              ? "grid-cols-[100px_minmax(0,1fr)] gap-[var(--space-5)] py-[var(--space-2)] text-[14.5px]"
              : "grid-cols-[110px_minmax(0,1fr)] gap-[var(--space-7)] py-[var(--space-5)] text-[15.5px]"
          )}
        >
          <span className="text-rs-ink-6">{t(event.timeKey)}</span>
          <span className="min-w-0 text-rs-ink">{t(event.textKey)}</span>
        </div>
      ))}
    </div>
  )
}

export { EventTimeline }
export type { EventTimelineProps }
