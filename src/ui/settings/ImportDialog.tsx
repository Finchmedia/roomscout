/**
 * „Kontext importieren“ — the three-step dialog that carries a music context
 * from another assistant into the Scout's knowledge list.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:140-156`
 * (`ImportDialog`, `IMPORT_PROMPT`, `EXAMPLE`, `IMPORT_CANDS`), measured in
 * `docs/UI_PORT/SETTINGS_SCREENS.md` §13. The candidate list and its conflict
 * lines follow the ported dictionary (`settings.import.cand.*` /
 * `settings.import.conflict.*`), which supersedes the kit's inline German.
 *
 * The dialog is portalled into the settings panel, so its scrim stays inside
 * the shell (SETTINGS §1.2). The wizard's state lives in `ImportDialogBody`,
 * which only mounts while the dialog is open — that is what restarts it at
 * step 1 every time, with no reset effect.
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Overline } from "@/components/ui/overline"
import { Textarea } from "@/components/ui/textarea"
import { usePanelDialogContainer } from "@/ui/chrome/PanelDialog"
import { useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"

import type {
  KnowledgeCategory,
  KnowledgeItem,
} from "./state/useSettingsDemoState"

type ImportStep = 1 | 2 | 3

interface ImportCandidate {
  id: string
  cat: KnowledgeCategory
  textKey: StringCopyKey
  /** Which conflict line to render, if any — §13.3. */
  conflict?: "band" | "budget"
}

/** `IMPORT_CANDS`, re-keyed onto `settings.import.cand.*`. */
const CANDIDATES: readonly ImportCandidate[] = [
  {
    id: "i1",
    cat: "band",
    textKey: "settings.import.cand.i1",
    conflict: "band",
  },
  { id: "i2", cat: "band", textKey: "settings.import.cand.i2" },
  { id: "i3", cat: "alltag", textKey: "settings.import.cand.i3" },
  { id: "i4", cat: "alltag", textKey: "settings.import.cand.i4" },
  {
    id: "i5",
    cat: "band",
    textKey: "settings.import.cand.i5",
    conflict: "budget",
  },
]

/** The prototype pre-selects the three candidates that carry no conflict. */
const DEFAULT_PICKS: Record<string, boolean> = { i2: true, i3: true, i4: true }

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Applies the picked rows to the knowledge list. */
  onApply: (items: KnowledgeItem[]) => void
  /** Panel toast slot — used for the „{n} Angaben übernommen.“ confirmation. */
  toast: (message: string) => void
  /** Copy of the band fact, quoted by the conflict line of candidate 1. */
  bandFact: string
  /** Copy of the budget fact, quoted by the conflict line of candidate 5. */
  budgetFact: string
}

function ImportDialog({
  open,
  onOpenChange,
  onApply,
  toast,
  bandFact,
  budgetFact,
}: ImportDialogProps) {
  const container = usePanelDialogContainer()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        tone="dialog"
        size="md"
        container={container ?? undefined}
        showCloseButton={false}
        overlayClassName="bg-rs-black/60"
      >
        <ImportDialogBody
          onClose={() => onOpenChange(false)}
          onApply={onApply}
          toast={toast}
          bandFact={bandFact}
          budgetFact={budgetFact}
        />
      </DialogContent>
    </Dialog>
  )
}

function ImportDialogBody({
  onClose,
  onApply,
  toast,
  bandFact,
  budgetFact,
}: Pick<ImportDialogProps, "onApply" | "toast" | "bandFact" | "budgetFact"> & {
  onClose: () => void
}) {
  const { t, tp } = useCopy()

  const [step, setStep] = React.useState<ImportStep>(1)
  const [text, setText] = React.useState("")
  const [freeText, setFreeText] = React.useState(false)
  const [picks, setPicks] = React.useState<Record<string, boolean>>(
    () => DEFAULT_PICKS
  )
  const [copied, setCopied] = React.useState(false)

  const example = t("settings.import.example")
  const picked = CANDIDATES.filter((candidate) => picks[candidate.id])

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(t("settings.import.step1.prompt"))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast(t("common.copyFailedToast"))
    }
  }

  function conflictLine(candidate: ImportCandidate): string | null {
    if (candidate.conflict === "band") {
      return t("settings.import.conflict.band", { text: bandFact })
    }
    if (candidate.conflict === "budget") {
      return budgetFact
        ? t("settings.import.conflict.budget", { text: budgetFact })
        : t("settings.import.conflict.budgetPlain")
    }
    return null
  }

  function apply() {
    onApply(
      picked.map((candidate) => ({
        id: `imp_${candidate.id}`,
        cat: candidate.cat,
        status: "confirmed" as const,
        textKey: candidate.textKey,
        originKey: "settings.knowledge.origin.imported" as const,
      }))
    )
    toast(tp("settings.knowledge.import.done", picked.length))
    onClose()
  }

  const titleKey: StringCopyKey =
    step === 1
      ? "settings.import.title.1"
      : step === 2
        ? "settings.import.title.2"
        : "settings.import.title.3"

  return (
    <>
      <DialogHeader className="flex-row items-center justify-between gap-[var(--space-5)] pe-0">
        <div>
          <Overline asChild>
            <DialogDescription>
              {t("settings.import.step", { n: step })}
            </DialogDescription>
          </Overline>
          <DialogTitle className="mt-[var(--space-2)] text-[length:var(--text-card-title-size)] font-medium">
            {t(titleKey)}
          </DialogTitle>
        </div>
        <DialogClose asChild>
          <IconButton
            variant="subtle"
            size={40}
            label={t("settings.import.closeAria")}
          >
            <Icon name="close" size={18} />
          </IconButton>
        </DialogClose>
      </DialogHeader>

      {step === 1 ? (
        <div>
          <p className="m-0 text-[length:var(--text-body-sm-size)] text-rs-ink-4">
            {t("settings.import.step1.intro")}
          </p>
          <p className="mt-[var(--space-5)] mb-0 rounded-card border border-rs-border-card bg-rs-surface-subtle px-[var(--space-8)] py-[var(--space-7)] text-[length:var(--text-caption-size)] leading-[var(--text-body-leading-relaxed)] [user-select:all]">
            {t("settings.import.step1.prompt")}
          </p>
          <div className="mt-[var(--space-8)] flex flex-wrap justify-between gap-[var(--space-4)]">
            <Button variant="secondary" size="sm" onClick={copyPrompt}>
              {copied
                ? t("settings.import.step1.copied")
                : t("settings.import.step1.copy")}
            </Button>
            <Button size="sm" onClick={() => setStep(2)}>
              {t("settings.import.step1.next")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <Textarea
            label={t("settings.import.step2.label")}
            placeholder={t("settings.import.step2.placeholder")}
            rows={6}
            value={text}
            onChange={(event) => setText(event.target.value)}
            helper={t("settings.import.step2.hint")}
          />
          <div className="mt-[var(--space-8)] flex flex-wrap justify-between gap-[var(--space-4)]">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setText(example)}
            >
              {t("settings.import.step2.useExample")}
            </Button>
            <div className="flex gap-[var(--space-4)]">
              <Button variant="secondary" size="sm" onClick={() => setStep(1)}>
                {t("settings.import.step2.back")}
              </Button>
              <Button
                size="sm"
                disabled={text.trim().length === 0}
                onClick={() => {
                  setFreeText(text.trim() !== example)
                  setStep(3)
                }}
              >
                {t("settings.import.step2.check")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 && freeText ? (
        <div>
          <p className="m-0 rounded-card border border-rs-border-card bg-rs-surface-subtle px-[var(--space-8)] py-[var(--space-7)] text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading)] text-rs-ink-2">
            {t("settings.import.step3.free")}
          </p>
          <div className="mt-[var(--space-8)] flex justify-end gap-[var(--space-4)]">
            <Button variant="secondary" size="sm" onClick={() => setStep(2)}>
              {t("settings.import.back")}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setText(example)
                setFreeText(false)
              }}
            >
              {t("settings.import.step3.useExample")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 && !freeText ? (
        <div>
          <p className="m-0 text-[length:var(--text-body-sm-size)] text-rs-ink-4">
            {t("settings.import.step3.intro")}
          </p>
          <div className="mt-[var(--space-5)]">
            {CANDIDATES.map((candidate) => {
              const conflict = conflictLine(candidate)
              return (
                <label
                  key={candidate.id}
                  className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-[var(--space-6)] border-b border-rs-border-divider-soft px-[var(--space-2)] py-[var(--space-5)]"
                >
                  <input
                    type="checkbox"
                    checked={picks[candidate.id] === true}
                    onChange={(event) =>
                      setPicks((current) => ({
                        ...current,
                        [candidate.id]: event.target.checked,
                      }))
                    }
                    className="mt-[var(--space-1)] size-[18px] accent-rs-orange"
                  />
                  <span>
                    <span className="block text-[length:var(--text-body-size)]">
                      {t(candidate.textKey)}
                    </span>
                    <span className="mt-[2px] block text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
                      {t(`settings.knowledge.tab.${candidate.cat}`)}
                    </span>
                    {conflict ? (
                      <span className="mt-[var(--space-2)] flex items-start gap-[var(--space-3)] text-[length:var(--text-caption-sm-size)] text-rs-amber">
                        <span
                          aria-hidden="true"
                          className="mt-[7px] size-[7px] flex-none rounded-circle bg-rs-amber"
                        />
                        {conflict}
                      </span>
                    ) : null}
                  </span>
                </label>
              )
            })}
          </div>
          <div className="mt-[var(--space-8)] flex flex-wrap items-center justify-between gap-[var(--space-4)]">
            <span className="text-[length:var(--text-caption-size)] text-rs-ink-6">
              {t("settings.import.pickCount", { n: picked.length })}
            </span>
            <div className="flex gap-[var(--space-4)]">
              <Button variant="secondary" size="sm" onClick={() => setStep(2)}>
                {t("settings.import.back")}
              </Button>
              <Button size="sm" disabled={picked.length === 0} onClick={apply}>
                {t("settings.import.apply")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

export { ImportDialog }
