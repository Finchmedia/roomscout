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
import { cn } from "@/lib/utils";
import { useNarrow } from "../state/useNarrow";
import type { LiveScoutStage, LiveScoutSurfaceProps } from "./types";

const STAGE_SHELL =
  "flex flex-1 flex-col items-center justify-center px-[var(--space-11)] pt-[var(--space-7)] pb-[var(--space-15)] text-center";

/**
 * The stages that carry a side column.
 *
 * Discovery is one of them: „Euer Suchauftrag“ grows beside the conversation
 * while the band talks (the mock's floating list, `DiscoveryStage.tsx`), so the
 * facts land in the aside instead of being recited back as a bullet list in the
 * chat. It passes no rail — there are no candidates yet — so the centre column
 * simply sits further left than it does on the working stages.
 *
 * 1100px is this layout's own threshold, not the app's narrow breakpoint
 * (959px): it leaves room for the 340px candidate rail and 300px brief while
 * the centre still carries the active conversation. Below it they fold into sheets.
 */
const COLUMN_STAGES: ReadonlySet<LiveScoutStage> = new Set<LiveScoutStage>([
  "discovery",
  "working",
  "blocked",
  "provider-update",
  "provider-excluded",
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
  // An excluded room keeps the provider card, but the headline states the
  // verdict instead of announcing the reply as news.
  const providerExcluded = stage === "provider-excluded";
  const providerUpdate = stage === "provider-update" || providerExcluded;
  const blocked = stage === "blocked";
  const headline = paused
    ? props.copy.pausedHeadline
    : providerExcluded
      ? props.copy.providerExcludedHeadline ?? props.copy.providerUpdateHeadline
      : providerUpdate
        ? props.copy.providerUpdateHeadline
        : blocked
          ? props.copy.blockedHeadline
          : props.copy.workingHeadline;
  const status = paused
    ? props.copy.pausedStatus
    : providerExcluded
      ? props.copy.providerExcludedStatus
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
      {/* An empty status is a real state, not a missing string: when the
          Entscheidung card below carries the question, repeating it here would
          put the same sentence on screen twice. */}
      {status ? (
        <p aria-live="polite" className="mt-[var(--space-8)] max-w-[620px] text-[length:var(--text-body-lg-size)] leading-[1.5] text-rs-ink-2">
          {status}
        </p>
      ) : null}
      {blocked && props.decisionSlot ? (
        <div className="mt-[var(--space-11)] w-[min(720px,100%)]">
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
  const working = stage === "working" || stage === "blocked" || stage === "provider-update" || stage === "provider-excluded" || stage === "paused";
  // The side columns exist only where there is something to put in them; a
  // screen that passes neither slot keeps the plain centred stage.
  const columns = (COLUMN_STAGES.has(stage) || Boolean(props.voiceSlot)) && Boolean(props.railSlot || props.asideSlot);
  const briefReview = typeof props.briefReviewSlot === "function"
    ? props.briefReviewSlot({ onReviewBrief: props.onReviewBrief, onActivate: props.onActivate })
    : props.briefReviewSlot;
  const voiceDetailSlot = props.detailSlot ?? (stage === "offer" ? props.offerSlot : stage === "provider-update" || stage === "provider-excluded" ? props.providerUpdateSlot : null);
  const voiceHasScrollableCompanion = Boolean(props.chatSlot || voiceDetailSlot);
  const conversationOpen = Boolean(props.chatSlot || props.voiceSlot);

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
        <div
          className={cn(
            STAGE_SHELL,
            props.chatSlot && "min-h-0 justify-start overflow-hidden px-[var(--space-5)] py-[var(--space-5)] min-[960px]:px-[var(--space-7)] min-[960px]:py-[var(--space-7)]"
          )}
          data-live-scout-stage={stage}
        >
          {!props.voiceSlot && !props.chatSlot ? <ScoutBlob size={narrow ? 88 : 104} state="idle" className="mb-[var(--space-10)]" /> : null}
          <div className={cn("text-[length:var(--text-body-sm-size)] text-rs-ink-4", props.chatSlot ? "mb-[var(--space-4)]" : "mb-[var(--space-7)]")}>{copy.discoveryLabel}</div>
          <div
            className={cn(
              "w-[min(var(--width-card),100%)]",
              props.chatSlot && "min-h-0 flex-1 overflow-hidden [&>[data-scout-conversation=text]]:h-full [&>[data-scout-conversation=text]]:max-h-full"
            )}
            data-live-scout-chat-host={Boolean(props.chatSlot) || undefined}
          >
            {props.chatSlot}
          </div>
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
          {props.briefFacts ? <div className="mt-[var(--space-12)] w-[min(var(--width-card),100%)]">{props.briefFacts}</div> : null}
          {briefReview ? <div className="mt-[var(--space-8)] w-[min(var(--width-card),100%)]">{briefReview}</div> : null}
        </div>
      );
      break;
    case "working":
    case "blocked":
    case "provider-update":
    case "provider-excluded":
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

  // Keep the voice subtree at the same location as the search stage changes.
  // Status and domain cards can update without remounting the conversation.
  if (props.voiceSlot) {
    content = (
      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--space-7)] px-[var(--space-5)] py-[var(--space-5)] min-[960px]:px-[var(--space-7)] min-[960px]:py-[var(--space-7)]",
          voiceHasScrollableCompanion ? "h-full overflow-hidden" : "justify-center"
        )}
        data-live-scout-stage={stage}
      >
        <div
          className={cn("w-full shrink-0", voiceHasScrollableCompanion && "sticky top-0 z-4")}
          data-voice-sticky={voiceHasScrollableCompanion || undefined}
        >
          {props.voiceSlot}
        </div>
        <div
          className={cn(
            "flex w-full flex-col gap-[var(--space-7)]",
            voiceHasScrollableCompanion && "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[var(--space-2)] [scrollbar-width:thin]"
          )}
          data-voice-companion-scroll={voiceHasScrollableCompanion || undefined}
        >
          {props.chatSlot ? (
            <div
              className="h-[min(32rem,55dvh)] min-h-[18rem] w-full shrink-0 overflow-hidden"
              data-voice-text-companion
            >
              {props.chatSlot}
            </div>
          ) : null}
          {working ? <p role="status" className="text-center text-sm text-rs-ink-4">{stage === "paused" ? copy.pausedHeadline : props.decisionSlot ? copy.blockedHeadline : copy.workingHeadline}</p> : null}
          {props.decisionSlot ? <div className="mx-auto w-full max-w-[720px]" data-voice-decision-host>{props.decisionSlot}</div> : null}
          {voiceDetailSlot}
          {stage === "complete" ? <div className="text-center">{copy.completeHeadline}{props.completeSlot}</div> : null}
        </div>
      </div>
    );
  } else if (props.detailSlot) {
    // A focused room replaces the stage chrome, so without a voice companion
    // the open Entscheidung needs its own host here (for example after a reload).
    content = (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[var(--space-8)] overflow-y-auto overscroll-contain p-[var(--space-7)] [scrollbar-width:thin]">
        {props.decisionSlot ? <div className="mx-auto w-full max-w-[720px]" data-detail-decision-host>{props.decisionSlot}</div> : null}
        {props.detailSlot}
      </div>
    );
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
      <main className={cn(
        "relative z-2 flex min-h-0 flex-1 flex-col [scrollbar-width:none]",
        // `overflow:hidden` remains programmatically scrollable: focusing the
        // chat composer can move this whole viewport and hide the voice card.
        // Column children own their scrolling, so make this a hard boundary.
        columns ? "overflow-clip" : "overflow-x-hidden overflow-y-auto"
      )}>
        {props.errorSlot ? (
          <div className="sticky top-0 z-5 mx-auto w-[min(760px,calc(100%_-_var(--space-11)_*_2))] pt-[var(--space-5)]">
            {props.errorSlot}
          </div>
        ) : null}
        {columns ? (
          // Each side column scrolls within the stage while the centre keeps
          // either the active conversation or the quiet-state composition in
          // the viewport.
          <div className="flex min-h-0 w-full flex-1 items-stretch overflow-hidden">
            <div data-live-scout-column="candidates" className="hidden h-full min-h-0 w-[340px] shrink-0 overflow-y-auto overscroll-contain pr-[var(--space-5)] pl-[var(--space-7)] [scrollbar-width:thin] min-[1100px]:block">
              <div className="flex min-h-full flex-col py-[var(--space-7)] [justify-content:safe_center]" data-live-scout-rail-content="candidates">{props.railSlot}</div>
            </div>
            <div data-live-scout-column="center" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", conversationOpen ? "justify-start overflow-hidden" : "justify-center")}>
              {content}
            </div>
            <div data-live-scout-column="brief" className="hidden h-full min-h-0 w-[300px] shrink-0 overflow-y-auto overscroll-contain pr-[var(--space-11)] pl-[var(--space-7)] [scrollbar-width:thin] min-[1100px]:block">
              <div className="flex min-h-full flex-col py-[var(--space-7)] [justify-content:safe_center]" data-live-scout-rail-content="brief">{props.asideSlot}</div>
            </div>
          </div>
        ) : content}
        {stage !== "welcome" && stage !== "loading" ? (
          <div className={cn(
            "mx-auto flex w-[min(760px,calc(100%_-_var(--space-11)_*_2))] shrink-0 flex-col items-center gap-[var(--space-7)] pb-[var(--space-8)]",
            conversationOpen && (columns ? "min-[1100px]:hidden" : "hidden")
          )}>
            <div className="flex flex-wrap justify-center gap-[var(--space-4)]">
              {!conversationOpen ? <>
                <Button variant="ghost" size="sm" icon={<Icon name="mic" size={16} />} onClick={props.onVoice}>{copy.welcomeVoiceAction}</Button>
                <Button variant="ghost" size="sm" icon={<Icon name="keyboard" size={16} />} onClick={props.onChat}>{copy.welcomeChatAction}</Button>
              </> : null}
              {/* The side columns are folded away below 1100px; these two reach them. */}
              {columns && props.railSlot ? <Button variant="ghost" size="sm" className="min-[1100px]:hidden" onClick={() => setSheet("candidates")}>{copy.openCandidates}</Button> : null}
              {columns && props.asideSlot ? <Button variant="ghost" size="sm" className="min-[1100px]:hidden" onClick={() => setSheet("brief")}>{copy.openBrief}</Button> : null}
              {stage !== "brief" && !columns ? <Button variant="ghost" size="sm" onClick={props.onReviewBrief} aria-expanded={props.briefExpanded}>{copy.briefReviewAction}</Button> : null}
            </div>
            {stage !== "brief" && !columns && props.briefExpanded ? <div className="w-full">{briefReview}</div> : null}
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
      {stage !== "discovery" && !props.voiceSlot ? <Dialog open={Boolean(props.chatSlot)} onOpenChange={open => { if (!open) props.onCloseChat(); }}>
        <DialogContent tone="dialog" size="md" className="max-w-[var(--width-card)]" aria-describedby={undefined}>
          <DialogHeader><DialogTitle>{copy.chatTitle}</DialogTitle></DialogHeader>
          {props.chatSlot}
        </DialogContent>
      </Dialog> : null}
    </StageBackground>
  );
}
