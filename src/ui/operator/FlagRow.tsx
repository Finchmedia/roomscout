/**
 * Feature-Flags page row — label, effect sentence and the DS `Switch`.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` (`flags`
 * page); `docs/UI_PORT/OPERATOR_SCREENS.md` §9.1 (`18px 0` rows on a
 * `--rs-border-divider` rule, 17px label, 14.5px effect on `--rs-ink-4`,
 * `role="switch"` named by the flag label).
 *
 * The row always renders the **draft** value while an unsaved draft exists —
 * `F = flagDraft || flags` in the kit.
 */

import { Switch } from "@/components/ui/switch"
import { useCopy } from "@/ui/copy"
import {
  OPERATOR_FLAG_COPY,
  type OperatorFlagKey,
} from "@/ui/operator/state/useOperatorDemoState"

interface FlagRowProps {
  flag: OperatorFlagKey
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function FlagRow({ flag, checked, onCheckedChange }: FlagRowProps) {
  const { t } = useCopy()
  const copy = OPERATOR_FLAG_COPY[flag]
  const label = t(copy.labelKey)

  return (
    <div
      data-slot="operator-flag-row"
      className="flex items-center justify-between gap-[var(--space-9)] border-b border-rs-border-divider py-[var(--space-8)]"
    >
      <div className="min-w-0">
        <div className="text-[length:var(--text-body-lg-size)] text-rs-ink">
          {label}
        </div>
        <div className="mt-[var(--space-1)] text-[14.5px] leading-[var(--text-body-leading)] text-rs-ink-4">
          {t(copy.effectKey)}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        label={label}
      />
    </div>
  )
}

export { FlagRow }
export type { FlagRowProps }
