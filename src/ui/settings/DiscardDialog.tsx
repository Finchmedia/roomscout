/**
 * „Änderungen verwerfen?“ — the modal that guards every navigation away from
 * „Handlungsspielraum“ while the draft is dirty.
 *
 * DS reference: `docs/UI_PORT/SETTINGS_SCREENS.md` §6 (the prototype's
 * `discardNext` gate; the kit's `Settings.jsx` predates it). Copy:
 * `settings.discard.*`.
 *
 * §6 is explicit that this one overlay must NOT dismiss on an outside click —
 * the prototype's scrim carries no handler here, unlike the sheet's and the
 * import dialog's. Escape stays available, which is `keepEditing`.
 */

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { usePanelDialogContainer } from "@/ui/chrome/PanelDialog"
import { useCopy } from "@/ui/copy"

interface DiscardDialogProps {
  open: boolean
  /** „Weiter bearbeiten“ — keeps the draft and cancels the queued navigation. */
  onKeepEditing: () => void
  /** „Verwerfen“ — drops the draft, then runs the queued navigation. */
  onDiscard: () => void
}

function DiscardDialog({ open, onKeepEditing, onDiscard }: DiscardDialogProps) {
  const { t } = useCopy()
  const container = usePanelDialogContainer()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeepEditing()
      }}
    >
      <DialogContent
        tone="dialog"
        size="sm"
        role="alertdialog"
        container={container ?? undefined}
        showCloseButton={false}
        overlayClassName="bg-rs-black/60"
        // §6: the scrim is inert here; only the two buttons and Escape decide.
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="pe-0">
          <DialogTitle className="text-[length:var(--text-body-lg-size)] font-medium">
            {t("settings.discard.title")}
          </DialogTitle>
          <DialogDescription>{t("settings.discard.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" size="sm" autoFocus onClick={onKeepEditing}>
            {t("settings.discard.keep")}
          </Button>
          <Button size="sm" onClick={onDiscard}>
            {t("settings.discard.discard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { DiscardDialog }
