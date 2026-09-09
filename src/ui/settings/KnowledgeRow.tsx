/**
 * One row of „Was dein Scout weiß“ — glyph, text, provenance, and the two
 * control clusters (confirm/dismiss for an assumption, edit + kebab otherwise).
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Settings.jsx:120-130`,
 * measured in `docs/UI_PORT/SETTINGS_SCREENS.md` §7.4/§7.5.
 * Applied deltas: DECISIONS item 38 (the „Herkunft ansehen“ popover can be
 * closed — × and Escape) and item 39 (a row that belongs to the search order
 * cannot be retired; it answers with a toast instead).
 */

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Icon, type IconName } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { useCopy } from "@/ui/copy"

import type { FactId, KnowledgeItem } from "./state/useSettingsDemoState"

interface KnowledgeRowProps {
  item: KnowledgeItem
  /** Already-resolved visible text. */
  text: string
  editing: boolean
  onEditStart: () => void
  onEditCancel: () => void
  onEditSave: (text: string) => void
  onConfirm: () => void
  onDismiss: () => void
  onRetire: () => void
}

/** `KICON` — the fact glyphs; „budget“ is the € sign, not an icon. */
const FACT_GLYPH: Record<Exclude<FactId, "budget">, IconName> = {
  band: "users",
  ort: "pin",
  zeit: "clock",
  equip: "drum",
}

const CATEGORY_GLYPH = {
  band: "music",
  ausstattung: "drum",
  alltag: "home",
} as const

function KnowledgeRow({
  item,
  text,
  editing,
  onEditStart,
  onEditCancel,
  onEditSave,
  onConfirm,
  onDismiss,
  onRetire,
}: KnowledgeRowProps) {
  const { t } = useCopy()
  const [originOpen, setOriginOpen] = React.useState(false)

  const assumed = item.status === "assumed"
  const glyph: IconName =
    item.factId && item.factId !== "budget"
      ? FACT_GLYPH[item.factId]
      : CATEGORY_GLYPH[item.cat]

  return (
    <div
      data-slot="settings-knowledge-row"
      className="relative grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[var(--space-6)] border-b border-rs-border-divider px-[var(--space-3)] py-[var(--space-6)]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && originOpen) {
          event.stopPropagation()
          setOriginOpen(false)
        }
      }}
    >
      <span
        aria-hidden="true"
        className="flex size-[26px] items-center justify-center text-rs-ink-2"
      >
        {item.factId === "budget" ? (
          <span className="text-[length:var(--text-body-lg-size)]">€</span>
        ) : (
          <Icon name={glyph} size={22} strokeWidth={1.5} />
        )}
      </span>

      <div className="min-w-0">
        {editing ? (
          // Mounted only while the row is in edit mode, so the draft starts
          // from the current text without an effect syncing it.
          <KnowledgeRowEditor
            initialText={text}
            factHint={
              item.factId ? t("settings.knowledge.edit.factHint") : undefined
            }
            onSave={onEditSave}
            onCancel={onEditCancel}
          />
        ) : (
          <>
            <div className="text-[length:var(--text-body-lg-size)]">{text}</div>
            {assumed ? (
              <span className="mt-[var(--space-2)] inline-flex rounded-pill border border-rs-border-accent bg-rs-surface-accent-tint-soft px-[var(--space-4)] py-[3px] text-[length:var(--text-caption-sm-size)] text-rs-orange-tint">
                {t("settings.knowledge.badge.assumed")}
              </span>
            ) : (
              <div className="mt-[2px] text-[length:var(--text-caption-sm-size)] text-rs-ink-6">
                {t(item.originKey)}
              </div>
            )}
            {originOpen ? (
              <div className="mt-[var(--space-2)] flex animate-rs-fade-up items-start gap-[var(--space-3)] text-[length:var(--text-caption-sm-size)] text-rs-ink-4">
                <span>
                  {t("settings.knowledge.origin.line", {
                    origin: t(item.originKey),
                    usage: item.factId
                      ? t("settings.knowledge.usage.fact")
                      : t("settings.knowledge.usage.preference"),
                  })}
                </span>
                <IconButton
                  variant="bare"
                  size={26}
                  label={t("common.close")}
                  onClick={() => setOriginOpen(false)}
                >
                  <Icon name="close" size={14} />
                </IconButton>
              </div>
            ) : null}
          </>
        )}
      </div>

      {assumed ? (
        <div className="flex items-center gap-[var(--space-2)]">
          <Button
            variant="link"
            size="2xs"
            className="text-[length:var(--text-body-sm-size)] text-rs-ink"
            onClick={onConfirm}
          >
            {t("settings.knowledge.action.confirm")}
          </Button>
          <Button
            variant="ghost"
            size="2xs"
            className="text-[length:var(--text-body-sm-size)]"
            onClick={onDismiss}
          >
            {t("settings.knowledge.action.dismiss")}
          </Button>
        </div>
      ) : editing ? (
        <span />
      ) : (
        <div className="flex items-center gap-[var(--space-1)]">
          <IconButton
            variant="bare"
            size={40}
            label={t("settings.knowledge.action.editAria")}
            onClick={onEditStart}
          >
            <Icon name="edit" size={18} />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                variant="bare"
                size={40}
                label={t("settings.knowledge.action.menuAria")}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                  <circle cx="6" cy="12" r="1.7" />
                  <circle cx="12" cy="12" r="1.7" />
                  <circle cx="18" cy="12" r="1.7" />
                </svg>
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onRetire}>
                {t("settings.knowledge.menu.retire")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOriginOpen((v) => !v)}>
                {t("settings.knowledge.menu.origin")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

/** The inline edit form of §7.4 — its own component so its draft is mount-scoped. */
function KnowledgeRowEditor({
  initialText,
  factHint,
  onSave,
  onCancel,
}: {
  initialText: string
  factHint: string | undefined
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const { t } = useCopy()
  const [draft, setDraft] = React.useState(initialText)

  return (
    <form
      className="flex flex-wrap items-start gap-[var(--space-3)]"
      onSubmit={(event) => {
        event.preventDefault()
        const next = draft.trim()
        if (next.length > 0) onSave(next)
      }}
    >
      <Input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        label={t("settings.knowledge.edit.inputAria")}
        wrapperClassName="min-w-[220px] flex-1"
        helper={factHint}
      />
      <Button type="submit" size="xs">
        {t("settings.knowledge.edit.save")}
      </Button>
      <Button type="button" variant="secondary" size="xs" onClick={onCancel}>
        {t("settings.knowledge.edit.cancel")}
      </Button>
    </form>
  )
}

export { KnowledgeRow }
