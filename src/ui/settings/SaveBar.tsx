/**
 * The dirty-state save bar of „Handlungsspielraum“.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:98-101`,
 * measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §5.10. The 52px minimum height
 * is load-bearing: it reserves the row so the page does not jump when the two
 * buttons appear.
 */

import { Button } from "@/components/ui/button"
import { useCopy } from "@/ui/copy"

interface SaveBarProps {
  /** The draft differs from the saved rules. */
  dirty: boolean
  /** Save stays disabled — e.g. while a save is in flight or the rules are not loaded. */
  invalid: boolean
  /** The 2600 ms „Handlungsspielraum aktualisiert“ line. */
  saved: boolean
  onCancel: () => void
  onSave: () => void
}

function SaveBar({ dirty, invalid, saved, onCancel, onSave }: SaveBarProps) {
  const { t } = useCopy()

  return (
    <div
      data-slot="settings-save-bar"
      className="mt-[var(--space-10)] flex min-h-[52px] items-center justify-end gap-[var(--space-5)]"
    >
      <span
        role="status"
        aria-live="polite"
        className="me-auto text-[length:var(--text-caption-size)] text-rs-ink-4"
      >
        {saved ? (
          <span className="animate-rs-fade-up">
            {t("settings.autonomy.saved")}
          </span>
        ) : null}
      </span>

      {dirty ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="animate-rs-fade-up"
            onClick={onCancel}
          >
            {t("settings.autonomy.cancel")}
          </Button>
          <Button
            size="sm"
            className="animate-rs-fade-up"
            disabled={invalid}
            onClick={onSave}
          >
            {t("settings.autonomy.save")}
          </Button>
        </>
      ) : null}
    </div>
  )
}

export { SaveBar }
