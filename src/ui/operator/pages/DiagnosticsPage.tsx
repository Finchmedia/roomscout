/**
 * Operator → Diagnose (`page = "diag"`).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx`
 * (`pages.diag`); `docs/UI_PORT/OPERATOR_SCREENS.md` §10 — the no-incident
 * card, the event timeline, and the „Diagnose-Sheet öffnen“ trigger.
 *
 * DECISIONS.md item 43: the trigger is gated on `incident`, not on
 * `incidentOpen`, so the resolved state of the sheet stays reachable.
 *
 * Demo data — see `state/useOperatorDemoState.ts`.
 */

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCopy } from "@/ui/copy"
import { EventTimeline } from "@/ui/operator/EventTimeline"
import { PageIntro } from "@/ui/operator/PageIntro"
import {
  deriveEvents,
  type OperatorDemoState,
} from "@/ui/operator/state/useOperatorDemoState"

interface DiagnosticsPageProps {
  state: OperatorDemoState
  onOpenSheet: () => void
}

function DiagnosticsPage({ state, onOpenSheet }: DiagnosticsPageProps) {
  const { t } = useCopy()
  const events = deriveEvents(state)

  return (
    <div className="flex flex-col">
      <PageIntro
        title={t("operator.diag.title")}
        lead={t("operator.diag.subtitle")}
      />

      {state.incident ? (
        <>
          <EventTimeline
            events={events}
            className="mt-[var(--space-12)]"
          />
          <Button
            variant="secondary"
            size="xs"
            className="mt-[var(--space-9)] self-start rounded-control-lg px-[var(--space-9)] text-[length:var(--text-body-sm-size)]"
            onClick={onOpenSheet}
          >
            {t("operator.diag.openSheet")}
          </Button>
        </>
      ) : (
        <Card
          size="sm"
          tone="faint"
          className="mt-[var(--space-12)] rounded-card px-[var(--space-11)] py-[var(--space-10)] text-[length:var(--text-body-size)] text-rs-ink-2"
        >
          {t("operator.diag.empty")}
        </Card>
      )}
    </div>
  )
}

export { DiagnosticsPage }
export type { DiagnosticsPageProps }
