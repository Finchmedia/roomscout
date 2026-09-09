/**
 * Diagnose sheet — the right-hand panel opened from an expired task row or from
 * the Diagnose page.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` (the `diag`
 * overlay); `docs/UI_PORT/OPERATOR_SCREENS.md` §11 — header with the 26px
 * title and the 40px round close, three key/value rows, four labelled blocks,
 * the event log, and (while the incident is open) the dashed Simulation box
 * whose button flips the demo access back to „Verbunden“.
 *
 * Port deltas, both settled:
 * - DECISIONS.md item 43 — the sheet stays reachable **after** the incident is
 *   resolved, so its resolved state can be inspected. The callers gate on
 *   `incident`, not on `incidentOpen`.
 * - The DS `Sheet` supplies the focus trap, Escape and focus restore that the
 *   prototype hand-rolled (DECISIONS.md item 3). It is viewport-anchored rather
 *   than clipped to the panel card, which the shipped `Sheet` cannot do without
 *   a portal container.
 */

import { Button } from "@/components/ui/button"
import { Overline } from "@/components/ui/overline"
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { StatusDot } from "@/components/ui/status-dot"
import { useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"
import { EventTimeline } from "@/ui/operator/EventTimeline"
import {
  deriveEvents,
  isIncidentOpen,
  isIncidentResolved,
  type OperatorDemoState,
} from "@/ui/operator/state/useOperatorDemoState"

/** §11.4's three labelled blocks, in order. */
const DIAG_BLOCKS: { labelKey: StringCopyKey; textKey: StringCopyKey }[] = [
  {
    labelKey: "operator.diagSheet.label.cause",
    textKey: "operator.diagSheet.text.cause",
  },
  {
    labelKey: "operator.diagSheet.label.impact",
    textKey: "operator.diagSheet.text.impact",
  },
  {
    labelKey: "operator.diagSheet.label.next",
    textKey: "operator.diagSheet.text.next",
  },
]

/** The eyebrow of a labelled block — 13px / `.12em`, §11.4. */
function BlockLabel({ children }: { children: string }) {
  return (
    <Overline className="text-[13px] tracking-[.12em]">{children}</Overline>
  )
}

interface DiagnosticsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: OperatorDemoState
  onRenewLogin: () => void
}

function DiagnosticsSheet({
  open,
  onOpenChange,
  state,
  onRenewLogin,
}: DiagnosticsSheetProps) {
  const { t } = useCopy()
  const incidentOpen = isIncidentOpen(state)
  const resolved = isIncidentResolved(state)
  const events = deriveEvents(state)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        closeLabel={t("operator.diagSheet.close.aria")}
        className="w-[min(500px,100%)] border-l-rs-border-panel bg-rs-surface-panel"
      >
        <SheetHeader>
          <SheetTitle className="text-[26px] font-medium">
            {t("operator.diagSheet.title")}
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="text-[length:var(--text-body-size)] leading-[var(--text-body-leading)]">
          <div className="flex flex-col gap-[var(--space-6)]">
            <div className="flex justify-between gap-[var(--space-7)] border-b border-rs-border-divider pb-[var(--space-5)]">
              <span className="text-rs-ink-6">
                {t("operator.diagSheet.field.process")}
              </span>
              <span className="text-right">
                {t("operator.diagSheet.value.process")}
              </span>
            </div>
            <div className="flex justify-between gap-[var(--space-7)] border-b border-rs-border-divider pb-[var(--space-5)]">
              <span className="text-rs-ink-6">
                {t("operator.diagSheet.field.portal")}
              </span>
              <span className="text-right">
                {t("operator.diagSheet.value.portal")}
              </span>
            </div>
            <div className="flex justify-between gap-[var(--space-7)] border-b border-rs-border-divider pb-[var(--space-5)]">
              <span className="text-rs-ink-6">
                {t("operator.diagSheet.field.state")}
              </span>
              <StatusDot
                tone={incidentOpen ? "warning" : "success"}
                className="text-[length:var(--text-body-size)] text-rs-ink"
              >
                {incidentOpen
                  ? t("operator.diagSheet.state.expired")
                  : t("operator.diagSheet.state.renewed")}
              </StatusDot>
            </div>

            {DIAG_BLOCKS.map((block) => (
              <div key={block.labelKey}>
                <BlockLabel>{t(block.labelKey)}</BlockLabel>
                <div className="mt-[var(--space-1)]">{t(block.textKey)}</div>
              </div>
            ))}

            <div>
              <BlockLabel>{t("operator.diagSheet.label.timeline")}</BlockLabel>
              <EventTimeline
                events={events}
                density="sheet"
                className="mt-[var(--space-2)]"
              />
            </div>
          </div>

          {/* §11.4: the spacer pushes the Simulation box to the bottom. */}
          <div className="flex-1" />

          {incidentOpen ? (
            <div className="rounded-card-sm border border-dashed border-rs-border-accent-soft bg-rs-surface-card-faint px-[var(--space-8)] py-[var(--space-7)]">
              <Overline tone="accent">
                {t("operator.diagSheet.simulation.label")}
              </Overline>
              <p className="mt-[var(--space-2)] text-[14.5px] leading-[1.55] text-rs-ink-4">
                {t("operator.diagSheet.simulation.text")}
              </p>
              <Button
                variant="primary"
                size="xs"
                block
                className="mt-[var(--space-6)] h-[46px]"
                onClick={onRenewLogin}
              >
                {t("operator.diagSheet.simulation.action")}
              </Button>
            </div>
          ) : null}

          {resolved ? (
            <p
              role="status"
              className="text-[14.5px] text-rs-ink-4"
            >
              {t("operator.diagSheet.resolved")}
            </p>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}

export { DiagnosticsSheet }
export type { DiagnosticsSheetProps }
