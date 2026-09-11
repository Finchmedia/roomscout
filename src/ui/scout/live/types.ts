import type * as React from "react";

export type LiveScoutStage =
  | "welcome"
  | "loading"
  | "discovery"
  | "brief"
  | "working"
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
