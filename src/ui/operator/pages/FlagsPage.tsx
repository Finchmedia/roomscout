/**
 * Operator → Feature-Flags (`page = "flags"`).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx`
 * (`pages.flags`); `docs/UI_PORT/OPERATOR_SCREENS.md` §9 and §13 — the two
 * rows render the **draft** value, the scope note sits under them, the dirty
 * panel appears only while a draft actually differs from the saved value, and
 * „Flags lokal gespeichert.“ is a `role="status"` line that clears itself after
 * 2600 ms (timer owned by `OperatorPanel`).
 *
 * Demo data — see `state/useOperatorDemoState.ts`.
 */

import { useCopy } from "@/ui/copy"
import { FlagDirtyPanel } from "@/ui/operator/FlagDirtyPanel"
import { FlagRow } from "@/ui/operator/FlagRow"
import { PageIntro } from "@/ui/operator/PageIntro"
import {
  OPERATOR_FLAG_KEYS,
  type OperatorFlags,
} from "@/ui/operator/state/useOperatorDemoState"

interface FlagsPageProps {
  /** The saved flags — what the overview mirror shows. */
  flags: OperatorFlags
  /** Unsaved local edit, or `null` when there is none. */
  draft: OperatorFlags | null
  onDraftChange: (draft: OperatorFlags) => void
  onCancel: () => void
  onSave: () => void
  /** True for 2600 ms after „Lokal speichern“. */
  saved: boolean
}

function FlagsPage({
  flags,
  draft,
  onDraftChange,
  onCancel,
  onSave,
  saved,
}: FlagsPageProps) {
  const { t } = useCopy()
  const effective = draft ?? flags
  const changed = OPERATOR_FLAG_KEYS.filter(
    (flag) => effective[flag] !== flags[flag]
  )

  return (
    <div className="flex flex-col">
      <PageIntro
        title={t("operator.flags.title")}
        lead={t("operator.flags.subtitle")}
      />

      <div className="mt-[var(--space-12)] flex flex-col">
        {OPERATOR_FLAG_KEYS.map((flag) => (
          <FlagRow
            key={flag}
            flag={flag}
            checked={effective[flag]}
            onCheckedChange={(checked) =>
              onDraftChange({ ...effective, [flag]: checked })
            }
          />
        ))}
      </div>

      <p className="mt-[var(--space-6)] text-[14.5px] text-rs-ink-6">
        {t("operator.flags.scopeNote")}
      </p>

      {draft && changed.length > 0 ? (
        <FlagDirtyPanel
          changed={changed}
          draft={effective}
          onCancel={onCancel}
          onSave={onSave}
        />
      ) : null}

      {saved ? (
        <p
          role="status"
          className="animate-rs-fade-up mt-[var(--space-7)] text-[14.5px] text-rs-ink-4"
        >
          {t("operator.flags.saved")}
        </p>
      ) : null}
    </div>
  )
}

export { FlagsPage }
export type { FlagsPageProps }
