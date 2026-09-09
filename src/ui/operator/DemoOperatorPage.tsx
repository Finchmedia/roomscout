/**
 * `/design/operator` — the full-page demo host for the Betreiberansicht.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/App.jsx` — the fixed
 * stage with its background layers, the app header (here carrying the
 * operator's environment pill and `OP` avatar, §3.2) and the Demo-Steuerung
 * strip whose „Beispielstörung laden“ drives the whole incident flow.
 *
 * Everything is local demo state; there is no Convex on this route.
 */

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { StatusDot } from "@/components/ui/status-dot"
import { AppHeader } from "@/ui/chrome/AppHeader"
import { StageBackground } from "@/ui/chrome/StageBackground"
import { useCopy } from "@/ui/copy"
import { devDe } from "@/ui/copy/de/dev"
import { OperatorPanel } from "@/ui/operator/OperatorPanel"
import {
  useOperatorDemoState,
  type OperatorDemoActions,
} from "@/ui/operator/state/useOperatorDemoState"

interface OperatorDemoBarProps {
  actions: OperatorDemoActions
  onOpenPanel: () => void
  /** The panel is already open — its own row is redundant then. */
  panelOpen: boolean
}

/**
 * The kit's monospace dev strip. `devDe` is imported directly on purpose:
 * COMPONENT_MAP.md §6.1 rule 2 keeps the prototype control-bar copy out of the
 * product dictionary, and dev-only surfaces read it from `de/dev`.
 */
function OperatorDemoBar({
  actions,
  onOpenPanel,
  panelOpen,
}: OperatorDemoBarProps) {
  return (
    <div className="flex max-w-[calc(100vw-var(--space-14))] flex-wrap items-center gap-[var(--space-2)] rounded-control-lg border border-rs-border-neutral bg-rs-surface-toast px-[var(--space-5)] py-[var(--space-2)] font-mono text-[11.5px] text-rs-ink-6 backdrop-blur-[8px]">
      <span className="mr-[var(--space-2)]">{devDe.demo.label}</span>
      {panelOpen ? null : (
        <Button
          variant="ghost"
          size="2xs"
          className="h-[30px] rounded-chip bg-rs-surface-subtle-2 px-[var(--space-3)] font-mono text-[11.5px] text-rs-ink"
          onClick={onOpenPanel}
        >
          {devDe.demo.operator}
        </Button>
      )}
      <Button
        variant="ghost"
        size="2xs"
        className="h-[30px] rounded-chip bg-rs-surface-subtle-2 px-[var(--space-3)] font-mono text-[11.5px] text-rs-ink"
        onClick={() => {
          actions.loadIncident()
          onOpenPanel()
        }}
      >
        {devDe.demo.incident}
      </Button>
      <Button
        variant="ghost"
        size="2xs"
        aria-label={devDe.demo.restart}
        className="h-[30px] rounded-chip bg-rs-surface-subtle-2 px-[var(--space-3)] font-mono text-[11.5px] text-rs-ink"
        onClick={actions.reset}
      >
        <Icon name="restart" size={14} />
      </Button>
    </div>
  )
}

function DemoOperatorPage() {
  const { t } = useCopy()
  const { state, actions } = useOperatorDemoState()
  const [panelOpen, setPanelOpen] = React.useState(true)

  const openPanel = React.useCallback(() => setPanelOpen(true), [])

  const demoBar = (
    <OperatorDemoBar
      actions={actions}
      onOpenPanel={openPanel}
      panelOpen={panelOpen}
    />
  )

  return (
    <StageBackground position="fixed" contentClassName="h-full">
      <AppHeader
        initials={t("operator.avatar.initials")}
        avatarLabel={t("operator.avatar.aria")}
        right={
          <Badge
            variant="pill"
            className="h-[var(--size-header-button)] gap-[var(--space-4)] border-rs-border-card-strong bg-rs-surface-subtle"
          >
            <StatusDot tone="success">{t("operator.env.development")}</StatusDot>
          </Badge>
        }
      />

      {/* Visible only while the panel is closed („Zur App“). */}
      <main className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[var(--space-9)] px-[var(--space-16)] text-center">
        <p className="text-[length:var(--text-lead-size)] text-rs-ink-4">
          {t("operator.footer.note")}
        </p>
        <Button variant="secondary" size="base" onClick={openPanel}>
          {t("operator.host.demoControls.openOperator")}
        </Button>
      </main>

      <div className="absolute bottom-[var(--space-7)] left-[var(--space-7)] z-10">
        {panelOpen ? null : demoBar}
      </div>

      <OperatorPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        state={state}
        actions={actions}
        onBack={() => setPanelOpen(false)}
        demoControls={demoBar}
      />
    </StageBackground>
  )
}

export { DemoOperatorPage }
