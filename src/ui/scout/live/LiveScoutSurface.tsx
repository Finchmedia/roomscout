import type * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { StatusDot } from "@/components/ui/status-dot";
import { AppHeader } from "@/ui/chrome/AppHeader";
import { StageBackground } from "@/ui/chrome/StageBackground";
import { useNarrow } from "../state/useNarrow";
import type { LiveScoutStage, LiveScoutSurfaceProps } from "./types";

const STAGE_SHELL =
  "flex flex-1 flex-col items-center justify-center px-[var(--space-11)] pt-[var(--space-7)] pb-[var(--space-15)] text-center";

function initials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toLocaleUpperCase();
}

function StageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="m-0 max-w-[720px] text-[length:var(--text-headline-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)] [text-wrap:balance]">
      {children}
    </h1>
  );
}

function WorkChrome({ props, stage }: { props: LiveScoutSurfaceProps; stage: LiveScoutStage }) {
  const paused = stage === "paused";
  const providerUpdate = stage === "provider-update";
  const headline = paused
    ? props.copy.pausedHeadline
    : providerUpdate
      ? props.copy.providerUpdateHeadline
      : props.copy.workingHeadline;
  const status = paused
    ? props.copy.pausedStatus
    : providerUpdate
      ? props.copy.providerUpdateStatus
      : props.copy.workingStatus;

  return (
    <div className={STAGE_SHELL} data-live-scout-stage={stage}>
      <ScoutBlob
        size={stage === "working" ? 160 : 112}
        state={paused ? "still" : "idle"}
        className="mb-[var(--space-17)]"
      />
      <StageTitle>{headline}</StageTitle>
      <p aria-live="polite" className="mt-[var(--space-8)] max-w-[620px] text-[length:var(--text-body-lg-size)] leading-[1.5] text-rs-ink-2">
        {status}
      </p>
      {providerUpdate && props.providerUpdateSlot ? (
        <div className="mt-[var(--space-10)] w-[min(960px,100%)]">
          {props.providerUpdateSlot}
        </div>
      ) : null}
      {paused ? (
        <Button size="sm" className="mt-[var(--space-12)]" onClick={props.onResume}>
          {props.copy.resumeAction}
        </Button>
      ) : null}
    </div>
  );
}

export function LiveScoutSurface(props: LiveScoutSurfaceProps) {
  const narrow = useNarrow();
  const { stage, copy } = props;
  const working = stage === "working" || stage === "provider-update" || stage === "paused";
  const briefReview = typeof props.briefReviewSlot === "function"
    ? props.briefReviewSlot({ onReviewBrief: props.onReviewBrief, onActivate: props.onActivate })
    : props.briefReviewSlot;

  let content: React.ReactNode;
  switch (stage) {
    case "welcome":
      content = (
        <div className={STAGE_SHELL} data-live-scout-stage={stage}>
          <ScoutBlob size={narrow ? 128 : 168} className="mb-[var(--space-16)]" />
          <div className="text-[length:var(--text-lead-size)] text-rs-ink-2">
            {copy.welcomeGreeting(props.band.displayName)}
          </div>
          <div className="mt-[var(--space-6)]"><StageTitle>{copy.welcomeHeadline}</StageTitle></div>
          <Button size="lg" icon={<Icon name="mic" size={20} />} className="mt-[var(--space-19)]" onClick={props.onVoice}>
            {copy.welcomeVoiceAction}
          </Button>
          <Button variant="ghost" icon={<Icon name="keyboard" size={20} />} className="mt-[var(--space-9)]" onClick={props.onChat}>
            {copy.welcomeChatAction}
          </Button>
        </div>
      );
      break;
    case "discovery":
      content = (
        <div className={STAGE_SHELL} data-live-scout-stage={stage}>
          {!props.voiceSlot ? <ScoutBlob size={narrow ? 88 : 104} state="idle" className="mb-[var(--space-10)]" /> : null}
          <div className="mb-[var(--space-7)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">{copy.discoveryLabel}</div>
          <div className="w-[min(760px,100%)]">{props.chatSlot}</div>
          {props.voiceSlot ? <div className="mt-[var(--space-9)]">{props.voiceSlot}</div> : null}
        </div>
      );
      break;
    case "loading":
      content = (
        <div className={STAGE_SHELL} data-live-scout-stage={stage}>
          <ScoutBlob size={narrow ? 112 : 150} state="thinking" className="mb-[var(--space-17)]" />
          <StageTitle>{copy.loadingHeadline}</StageTitle>
          <p aria-live="polite" className="mt-[var(--space-8)] max-w-[620px] text-[length:var(--text-body-lg-size)] leading-[1.5] text-rs-ink-2">
            {copy.loadingStatus}
          </p>
        </div>
      );
      break;
    case "brief":
      content = (
        <div className={STAGE_SHELL} data-live-scout-stage={stage}>
          <ScoutBlob size={96} className="mb-[var(--space-10)]" />
          <StageTitle>{copy.briefHeadline}</StageTitle>
          {props.briefFacts ? <div className="mt-[var(--space-12)] w-[min(680px,100%)]">{props.briefFacts}</div> : null}
          {briefReview ? <div className="mt-[var(--space-8)] w-[min(680px,100%)]">{briefReview}</div> : null}
        </div>
      );
      break;
    case "working":
    case "provider-update":
    case "paused":
      content = <WorkChrome props={props} stage={stage} />;
      break;
    case "offer":
      content = (
        <div className={`${STAGE_SHELL} justify-start pt-[var(--space-13)]`} data-live-scout-stage={stage}>
          <StageTitle>{copy.offerHeadline}</StageTitle>
          <div className="mt-[var(--space-12)] w-[min(var(--width-offer),100%)]">{props.offerSlot}</div>
        </div>
      );
      break;
    case "complete":
      content = (
        <div className={STAGE_SHELL} data-live-scout-stage={stage}>
          <ScoutBlob size={96} className="mb-[var(--space-17)]" />
          <StageTitle>{copy.completeHeadline}</StageTitle>
          <div className="mt-[var(--space-8)] text-[length:var(--text-body-lg-size)] text-rs-ink-4">{copy.completeStatus}</div>
          {props.completeSlot ? <div className="mt-[var(--space-12)]">{props.completeSlot}</div> : null}
        </div>
      );
      break;
  }

  return (
    <StageBackground position="fixed" contentClassName="overflow-hidden">
      <AppHeader
        avatarSlot={props.profileMenuSlot}
        narrow={narrow}
        initials={initials(props.band.displayName)}
        avatarLabel={copy.settingsAction}
        onAvatar={props.onSettings}
        right={working ? (
          <>
            <StatusDot tone={stage === "paused" ? "muted" : "accent"} pulse={stage !== "paused"} announce>
              {stage === "paused" ? copy.pausedLabel : copy.activeStatus}
            </StatusDot>
            <IconButton
              label={stage === "paused" ? copy.resumeAction : copy.pauseAction}
              onClick={stage === "paused" ? props.onResume : props.onPause}
            >
              <Icon name={stage === "paused" ? "play" : "pause"} size={16} />
            </IconButton>
          </>
        ) : null}
      />
      <main className="relative z-2 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [scrollbar-width:none]">
        {props.errorSlot ? (
          <div className="sticky top-0 z-5 mx-auto w-[min(760px,calc(100%_-_var(--space-11)_*_2))] pt-[var(--space-5)]">
            {props.errorSlot}
          </div>
        ) : null}
        {content}
        {stage !== "welcome" && stage !== "loading" ? (
          <div className="mx-auto flex w-[min(760px,calc(100%_-_var(--space-11)_*_2))] shrink-0 flex-col items-center gap-[var(--space-7)] pb-[var(--space-8)]">
            <div className="flex flex-wrap justify-center gap-[var(--space-4)]">
              <Button variant="ghost" size="sm" icon={<Icon name="mic" size={16} />} onClick={props.onVoice}>{copy.welcomeVoiceAction}</Button>
              <Button variant="ghost" size="sm" icon={<Icon name="keyboard" size={16} />} onClick={props.onChat}>{copy.welcomeChatAction}</Button>
              {stage !== "brief" ? <Button variant="ghost" size="sm" onClick={props.onReviewBrief} aria-expanded={props.briefExpanded}>{copy.briefReviewAction}</Button> : null}
            </div>
            {stage !== "brief" && props.briefExpanded ? <div className="w-full">{briefReview}</div> : null}
            {stage !== "discovery" && props.voiceSlot ? <div className="w-full">{props.voiceSlot}</div> : null}
          </div>
        ) : null}
      </main>
      {stage !== "discovery" ? <Dialog open={Boolean(props.chatSlot)} onOpenChange={open => { if (!open) props.onCloseChat(); }}>
        <DialogContent tone="dialog" size="md" className="max-w-[800px]" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{copy.chatTitle}</DialogTitle></DialogHeader>
          {props.chatSlot}
        </DialogContent>
      </Dialog> : null}
    </StageBackground>
  );
}
