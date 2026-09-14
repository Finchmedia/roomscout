import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusDot } from "@/components/ui/status-dot";
import { AppHeader } from "@/ui/chrome/AppHeader";
import { StageBackground } from "@/ui/chrome/StageBackground";
import { useNarrow } from "../state/useNarrow";
import type { LiveScoutStage, LiveScoutSurfaceProps } from "./types";

const STAGE_SHELL =
  "flex flex-1 flex-col items-center justify-center px-[var(--space-11)] pt-[var(--space-7)] pb-[var(--space-15)] text-center";

/**
 * The stages that carry the two side columns: everything the Scout does after
 * the brief is signed off. Discovery keeps the single centred column, because
 * the conversation is the whole screen there.
 *
 * 1100px is this layout's own threshold, not the app's narrow breakpoint
 * (959px): three columns need 260 + 300 of side rail before the centre still
 * has room for a headline.
 */
const COLUMN_STAGES: ReadonlySet<LiveScoutStage> = new Set<LiveScoutStage>([
  "working",
  "blocked",
  "provider-update",
  "paused",
  "offer",
  "complete",
]);

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
  const blocked = stage === "blocked";
  const headline = paused
    ? props.copy.pausedHeadline
    : providerUpdate
      ? props.copy.providerUpdateHeadline
      : blocked
        ? props.copy.blockedHeadline
        : props.copy.workingHeadline;
  const status = paused
    ? props.copy.pausedStatus
    : providerUpdate
      ? props.copy.providerUpdateStatus
      : blocked
        ? props.copy.blockedStatus
        : props.copy.workingStatus;

  return (
    <div className={STAGE_SHELL} data-live-scout-stage={stage}>
      <ScoutBlob
        size={stage === "working" ? 160 : 112}
        state={paused ? "still" : blocked ? "listening" : "idle"}
        className="mb-[var(--space-17)]"
      />
      <StageTitle>{headline}</StageTitle>
      <p aria-live="polite" className="mt-[var(--space-8)] max-w-[620px] text-[length:var(--text-body-lg-size)] leading-[1.5] text-rs-ink-2">
        {status}
      </p>
      {blocked && props.decisionSlot ? (
        <div className="mt-[var(--space-11)] w-[min(620px,100%)]">
          {props.decisionSlot}
        </div>
      ) : null}
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
  const [sheet, setSheet] = React.useState<"candidates" | "brief" | null>(null);
  const { stage, copy } = props;
  const working = stage === "working" || stage === "blocked" || stage === "provider-update" || stage === "paused";
  // The side columns exist only where there is something to put in them; a
  // screen that passes neither slot keeps the plain centred stage.
  const columns = COLUMN_STAGES.has(stage) && Boolean(props.railSlot || props.asideSlot);
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
    case "blocked":
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
        {columns ? (
          <div className="flex min-h-0 w-full flex-1 items-start">
            <div className="hidden w-[260px] shrink-0 pt-[var(--space-7)] pr-[var(--space-7)] pl-[var(--space-11)] min-[1100px]:block">
              {props.railSlot}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">{content}</div>
            <div className="hidden w-[300px] shrink-0 pt-[var(--space-7)] pr-[var(--space-11)] pl-[var(--space-7)] min-[1100px]:block">
              {props.asideSlot}
            </div>
          </div>
        ) : content}
        {stage !== "welcome" && stage !== "loading" ? (
          <div className="mx-auto flex w-[min(760px,calc(100%_-_var(--space-11)_*_2))] shrink-0 flex-col items-center gap-[var(--space-7)] pb-[var(--space-8)]">
            <div className="flex flex-wrap justify-center gap-[var(--space-4)]">
              <Button variant="ghost" size="sm" icon={<Icon name="mic" size={16} />} onClick={props.onVoice}>{copy.welcomeVoiceAction}</Button>
              <Button variant="ghost" size="sm" icon={<Icon name="keyboard" size={16} />} onClick={props.onChat}>{copy.welcomeChatAction}</Button>
              {/* The side columns are folded away below 1100px; these two reach them. */}
              {columns && props.railSlot ? <Button variant="ghost" size="sm" className="min-[1100px]:hidden" onClick={() => setSheet("candidates")}>{copy.openCandidates}</Button> : null}
              {columns && props.asideSlot ? <Button variant="ghost" size="sm" className="min-[1100px]:hidden" onClick={() => setSheet("brief")}>{copy.openBrief}</Button> : null}
              {stage !== "brief" && !columns ? <Button variant="ghost" size="sm" onClick={props.onReviewBrief} aria-expanded={props.briefExpanded}>{copy.briefReviewAction}</Button> : null}
            </div>
            {stage !== "brief" && !columns && props.briefExpanded ? <div className="w-full">{briefReview}</div> : null}
            {stage !== "discovery" && props.voiceSlot ? <div className="w-full">{props.voiceSlot}</div> : null}
          </div>
        ) : null}
      </main>
      {columns && props.railSlot ? (
        <Sheet open={sheet === "candidates"} onOpenChange={open => { if (!open) setSheet(null); }}>
          <SheetContent side="left" aria-describedby={undefined}>
            <SheetHeader><SheetTitle>{copy.openCandidates}</SheetTitle></SheetHeader>
            <SheetBody>{props.railSlot}</SheetBody>
          </SheetContent>
        </Sheet>
      ) : null}
      {columns && props.asideSlot ? (
        <Sheet open={sheet === "brief"} onOpenChange={open => { if (!open) setSheet(null); }}>
          <SheetContent side="right" aria-describedby={undefined}>
            <SheetHeader><SheetTitle>{copy.openBrief}</SheetTitle></SheetHeader>
            <SheetBody>{props.asideSlot}</SheetBody>
          </SheetContent>
        </Sheet>
      ) : null}
      {stage !== "discovery" ? <Dialog open={Boolean(props.chatSlot)} onOpenChange={open => { if (!open) props.onCloseChat(); }}>
        <DialogContent tone="dialog" size="md" className="max-w-[800px]" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{copy.chatTitle}</DialogTitle></DialogHeader>
          {props.chatSlot}
        </DialogContent>
      </Dialog> : null}
    </StageBackground>
  );
}
