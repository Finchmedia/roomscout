/**
 * „Wirkung vor dem Speichern“ — the inline preview panel that appears as soon
 * as a flag draft differs from the saved value, with `Abbrechen` /
 * `Lokal speichern`.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` (`flagDraft`
 * / `flagEffects` / `saveFlags`); `docs/UI_PORT/OPERATOR_SCREENS.md` §9.3 —
 * `18px 22px`, radius 14, `--rs-surface-card`-class fill on
 * `--rs-border-card`, overline, `ul` at 15px/1.7, right-aligned actions. It is
 * an inline preview, deliberately not a modal confirm.
 *
 * Effect lines are composed from the dictionary exactly as §13.2 specifies:
 * `{label} → {an|aus}. {sentence}`.
 */

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Overline } from "@/components/ui/overline"
import { useCopy } from "@/ui/copy"
import {
  OPERATOR_FLAG_COPY,
  type OperatorFlagKey,
  type OperatorFlags,
} from "@/ui/operator/state/useOperatorDemoState"

interface FlagDirtyPanelProps {
  /** The flags whose draft value differs from the saved value. */
  changed: readonly OperatorFlagKey[]
  draft: OperatorFlags
  onCancel: () => void
  onSave: () => void
}

function FlagDirtyPanel({
  changed,
  draft,
  onCancel,
  onSave,
}: FlagDirtyPanelProps) {
  const { t } = useCopy()

  return (
    <Card
      size="sm"
      className="animate-rs-fade-up mt-[var(--space-10)] rounded-card-sm px-[var(--space-10)] py-[var(--space-8)]"
    >
      <Overline>{t("operator.flags.preview.label")}</Overline>
      <ul className="mt-[var(--space-4)] list-disc pl-[var(--space-8)] text-[length:var(--text-body-sm-size)] leading-[1.7] text-rs-ink-2">
        {changed.map((flag) => {
          const copy = OPERATOR_FLAG_COPY[flag]
          const on = draft[flag]
          return (
            <li key={flag}>
              {t(copy.labelKey)} {t("operator.flags.preview.arrow")}{" "}
              {on
                ? t("operator.flags.preview.on")
                : t("operator.flags.preview.off")}
              . {on ? t(copy.previewOnKey) : t(copy.previewOffKey)}
            </li>
          )
        })}
      </ul>
      <div className="mt-[var(--space-7)] flex justify-end gap-[var(--space-4)]">
        <Button variant="secondary" size="xs" onClick={onCancel}>
          {t("operator.flags.action.cancel")}
        </Button>
        <Button variant="primary" size="xs" onClick={onSave}>
          {t("operator.flags.action.save")}
        </Button>
      </div>
    </Card>
  )
}

export { FlagDirtyPanel }
export type { FlagDirtyPanelProps }
