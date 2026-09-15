import type * as React from "react";

export type LiveScoutStage =
  | "welcome"
  | "loading"
  | "discovery"
  | "brief"
  | "working"
  | "blocked"
  | "provider-update"
  | "offer"
  | "paused"
  | "complete";

export interface LiveScoutStageSignals {
  loading?: boolean;
  complete?: boolean;
  offerReady?: boolean;
  paused?: boolean;
  briefNeedsReview?: boolean;
  providerUpdate?: boolean;
  /** An open Entscheidung: the Scout needs the musician before it can go on. */
  blocked?: boolean;
  working?: boolean;
  hasConversation?: boolean;
  hasPartialReply?: boolean;
}

/**
 * Collapses backend state into one calm, exclusive scene. A usable current
 * offer wins over stale discovery/provider uncertainty; an incomplete reply
 * stays in the conversation instead of being mistaken for a finished brief.
 */
export function deriveLiveScoutStage(signals: LiveScoutStageSignals): LiveScoutStage {
  if (signals.complete) return "complete";
  if (signals.offerReady) return "offer";
  if (signals.paused) return "paused";
  if (signals.briefNeedsReview) return "brief";
  if (signals.blocked) return "blocked";
  if (signals.providerUpdate) return "provider-update";
  if (signals.working) return "working";
  if (signals.hasPartialReply || signals.hasConversation) return "discovery";
  if (signals.loading) return "loading";
  return "welcome";
}

export interface LiveScoutCopy {
  avatarLabel: string;
  welcomeGreeting: (displayName: string) => React.ReactNode;
  welcomeHeadline: React.ReactNode;
  welcomeVoiceAction: React.ReactNode;
  welcomeChatAction: React.ReactNode;
  discoveryLabel: React.ReactNode;
  loadingHeadline: React.ReactNode;
  loadingStatus: React.ReactNode;
  briefHeadline: React.ReactNode;
  workingHeadline: React.ReactNode;
  workingStatus: React.ReactNode;
  blockedHeadline: React.ReactNode;
  blockedStatus: React.ReactNode;
  providerUpdateHeadline: React.ReactNode;
  providerUpdateStatus: React.ReactNode;
  pausedHeadline: React.ReactNode;
  pausedStatus: React.ReactNode;
  pauseAction: string;
  resumeAction: string;
  settingsAction: string;
  briefReviewAction: string;
  activeStatus: string;
  pausedLabel: string;
  chatTitle: string;
  /** Names the two side columns; below 1100px they are the sheet openers. */
  openCandidates: string;
  openBrief: string;
  offerHeadline: React.ReactNode;
  completeHeadline: React.ReactNode;
  completeStatus: React.ReactNode;
}

export interface LiveScoutSurfaceProps {
  stage: LiveScoutStage;
  band: { displayName: string };
  copy: LiveScoutCopy;
  chatSlot?: React.ReactNode;
  profileMenuSlot?: React.ReactNode;
  voiceSlot?: React.ReactNode;
  briefFacts?: React.ReactNode;
  briefExpanded?: boolean;
  briefReviewSlot?:
    | React.ReactNode
    | ((actions: { onReviewBrief: () => void; onActivate: () => void }) => React.ReactNode);
  providerUpdateSlot?: React.ReactNode;
  /**
   * The open Entscheidung's options, answered on the stage itself. Rendered
   * under the status line in `blocked` — the musician no longer has to go
   * through the chat for a question that has prepared answers.
   */
  decisionSlot?: React.ReactNode;
  /**
   * „Kandidaten“ — the left column of the working stages, a sheet below 1100px.
   */
  railSlot?: React.ReactNode;
  /**
   * „Euer Suchauftrag“ — the right column, a sheet below 1100px. It replaces
   * the `briefReviewAction` toggle on the stages that carry it, and it is the
   * one place the captured facts appear: in discovery it floats beside the
   * conversation and takes the arriving facts (`ArrivingFactList`), on the
   * working stages it is the quiet compact list.
   */
  asideSlot?: React.ReactNode;
  offerSlot?: React.ReactNode;
  completeSlot?: React.ReactNode;
  errorSlot?: React.ReactNode;
  onChat: () => void;
  onCloseChat: () => void;
  onVoice: () => void;
  onReviewBrief: () => void;
  onActivate: () => void;
  onPause: () => void;
  onResume: () => void;
  onSettings: () => void;
}
