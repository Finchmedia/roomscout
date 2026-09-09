/**
 * The Scout surface — one adaptive stage, no navigation (App.jsx).
 *
 * Background layers, the app header with its autopilot pair and profile menu,
 * the current stage, and the three overlays the flow can raise: the transcript
 * drawer, the arrival toast and the hint bar. Which stage shows is `m.s.stage`;
 * the screen changes emphasis, it does not navigate.
 *
 * Panels: the Settings view mounts the real `SettingsPanel`, the Operator view
 * the real `OperatorPanel`. Both own their own demo state, so the source a user
 * reconnects in Settings and the incident the Operator loads are not yet the
 * same objects as this machine's `sources` / `flags` — the panels are correct in
 * isolation, the cross-surface seam is the Convex step (see openQuestions).
 */

import type * as React from "react";
import { AppHeader } from "@/ui/chrome/AppHeader";
import { StageBackground } from "@/ui/chrome/StageBackground";
import { useCopy } from "@/ui/copy";
import { OperatorPanel } from "@/ui/operator/OperatorPanel";
import { useOperatorDemoState } from "@/ui/operator/state/useOperatorDemoState";
import { SettingsPanel } from "@/ui/settings/SettingsPanel";
import { useSettingsDemoState } from "@/ui/settings/state/useSettingsDemoState";
import { cn } from "@/lib/utils";
import { HintBar } from "./chrome/HintBar";
import { ProfileMenu } from "./chrome/ProfileMenu";
import { ScoutHeaderRight } from "./chrome/ScoutHeaderRight";
import { ScoutToast } from "./chrome/ScoutToast";
import { TranscriptDrawer } from "./chrome/TranscriptDrawer";
import { useNarrow } from "./state/useNarrow";
import type { ScoutDemoMachine } from "./state/useScoutDemoMachine";
import { AutopilotStage } from "./stages/AutopilotStage";
import { BriefStage } from "./stages/BriefStage";
import { CandidatesStage } from "./stages/CandidatesStage";
import { ClarificationStage } from "./stages/ClarificationStage";
import { CompleteStage } from "./stages/CompleteStage";
import { DeadEndStage } from "./stages/DeadEndStage";
import { DiscoveryStage } from "./stages/DiscoveryStage";
import { OfferStage } from "./stages/OfferStage";
import { ReviewStage } from "./stages/ReviewStage";
import { WelcomeStage } from "./stages/WelcomeStage";
import type { StageProps } from "./stages/stageProps";
import type { ScoutStage } from "./state/stages";

const STAGE_VIEWS: Record<ScoutStage, React.ComponentType<StageProps>> = {
  welcome: WelcomeStage,
  discovery: DiscoveryStage,
  brief: BriefStage,
  scouting: AutopilotStage,
  clarification: ClarificationStage,
  dead_end: DeadEndStage,
  candidates: CandidatesStage,
  offer: OfferStage,
  offer_review: ReviewStage,
  complete: CompleteStage,
};

export interface ScoutSurfaceProps {
  m: ScoutDemoMachine;
  /**
   * The prototype's demo strip. Rendered bottom-left over the stage *and*
   * handed to the Operator panel, which is a modal dialog and would otherwise
   * make the strip behind it inert.
   */
  demoControls?: React.ReactNode;
}

export function ScoutSurface({ m, demoControls }: ScoutSurfaceProps) {
  const { t } = useCopy();
  const narrow = useNarrow();
  const operator = useOperatorDemoState();
  const settings = useSettingsDemoState();

  const { stage, view, paused, menuOpen, transcriptOpen, transcript, toast, hint } = m.s;
  const Stage = STAGE_VIEWS[stage];
  const isAutopilot = stage === "scouting";

  return (
    <StageBackground position="fixed" contentClassName="overflow-hidden">
      {view !== "operator" ? (
        <AppHeader
          narrow={narrow}
          initials={t(m.s.initialsKey)}
          avatarLabel={t("scout.chrome.avatar.aria")}
          avatarExpanded={menuOpen}
          onAvatar={m.toggleMenu}
          right={
            isAutopilot && view === "scout" ? (
              <ScoutHeaderRight paused={paused} onTogglePause={m.togglePaused} />
            ) : null
          }
          avatarMenu={
            <ProfileMenu
              open={menuOpen}
              name={t(m.s.nameKey)}
              inPanel={view !== "scout"}
              onClose={() => m.setMenuOpen(false)}
              onSettings={() => m.openSettings()}
              onOperator={() => m.openOperator()}
              onBackToScout={m.backToScout}
            />
          }
        />
      ) : null}

      <main
        className={cn(
          "relative z-2 min-h-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-width:none]",
          view === "scout" ? "block" : "hidden",
        )}
      >
        <Stage m={m} narrow={narrow} />
      </main>

      {/*
        The panel keeps its own page; `m.s.settingsPage` is only ever set to the
        default here (nothing in the Scout deep-links a settings page yet), so
        leaving it uncontrolled avoids re-declaring the page-id union.
        `session` mirrors the header's pause pair: §2.2's line under the back row.
      */}
      <SettingsPanel
        open={view === "settings"}
        onOpenChange={(open) => {
          if (!open) m.backToScout();
        }}
        data={settings.data}
        actions={settings.actions}
        onBack={m.backToScout}
        session={paused ? "paused" : "working"}
      />

      <OperatorPanel
        open={view === "operator"}
        onOpenChange={(open) => {
          if (!open) m.backToScout();
        }}
        state={operator.state}
        actions={operator.actions}
        onBack={m.backToScout}
        demoControls={demoControls}
      />

      <TranscriptDrawer
        open={transcriptOpen}
        onOpenChange={m.setTranscriptOpen}
        transcript={transcript}
      />
      <ScoutToast toast={toast} onAction={m.backToScout} onDismiss={m.dismissToast} />
      <HintBar hint={hint} />
      {/*
        One copy at a time, and only over the stage: both panels are modal
        dialogs, so a strip behind them would render but not take clicks. The
        Operator panel renders its own; Settings is left to its own back row.
      */}
      {demoControls && view === "scout" ? (
        <div className="absolute bottom-[var(--space-7)] left-[var(--space-7)] z-10">
          {demoControls}
        </div>
      ) : null}
    </StageBackground>
  );
}
