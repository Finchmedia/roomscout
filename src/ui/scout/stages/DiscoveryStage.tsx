/**
 * 2 · Gespräch (ScreensA.jsx `Discovery`).
 *
 * The scripted conversation. Voice mode plays itself; text mode waits for the
 * band at every user turn and offers the prepared answer as a tint button.
 * Extracted wishes fly as a capsule and land in the fact list — floating beside
 * the conversation on a wide stage, in the „N Wünsche gemerkt“ sheet on a
 * narrow one.
 *
 * The script's timings are local to the stage, exactly as in the kit; only the
 * facts and the transcript go through the machine (Settings and the brief read
 * them). Free text is not interpreted — the prototype says so in a hint.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Capsule } from "@/components/ui/capsule";
import { Composer } from "@/components/ui/composer";
import { FactList } from "@/components/ui/fact-list";
import { Icon } from "@/components/ui/icon";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { VoiceControl } from "@/components/ui/voice-control";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import type { StringCopyKey } from "@/ui/copy";
import { StageSheet } from "../chrome/StageSheet";
import { SCRIPT } from "../state/demoData";
import { toFactRows } from "../state/stages";
import { STAGE_SHELL, type StageProps } from "./stageProps";

export function DiscoveryStage({ m, narrow }: StageProps) {
  const { t, tp } = useCopy();
  const [step, setStep] = React.useState(0);
  const [capsuleKey, setCapsuleKey] = React.useState<StringCopyKey | null>(null);
  const [micOn, setMicOn] = React.useState(true);
  const [draft, setDraft] = React.useState("");
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const { mode, facts } = m.s;
  const { after } = m.timers;
  const { addTranscript, commitFact, clearChangedFacts, go, showHint, setMode, toggleTranscript } =
    m;

  const line = SCRIPT[Math.min(step, SCRIPT.length - 1)];
  const isScout = line?.who === "scout";

  /** One advance per (step, mode) — StrictMode mounts every effect twice. */
  const played = React.useRef<string | null>(null);

  const advance = React.useCallback(() => {
    const current = SCRIPT[step];
    if (!current) return;
    addTranscript([{ who: current.who, key: current.key }]);

    if (current.end) {
      after(1400, () => go("brief"));
      return;
    }
    if (current.facts) {
      const extracted = current.facts;
      extracted.forEach((fact, index) => {
        after(300 + index * 1100, () => setCapsuleKey(fact.labelKey));
        after(900 + index * 1100, () => {
          setCapsuleKey(null);
          commitFact(fact.id, fact.labelKey);
          after(1200, clearChangedFacts);
        });
      });
      after(600 + extracted.length * 1100, () => setStep((value) => value + 1));
      return;
    }
    after(mode === "voice" ? 2600 : 600, () => setStep((value) => value + 1));
  }, [step, mode, after, addTranscript, commitFact, clearChangedFacts, go]);

  React.useEffect(() => {
    const token = `${step}:${mode}`;
    if (played.current === token) return;
    const current = SCRIPT[step];
    if (!current) return;
    // Voice plays both sides; in text mode the band answers for itself.
    if (mode !== "voice" && current.who !== "scout") return;
    played.current = token;
    advance();
  }, [step, mode, advance]);

  const send = () => {
    setDraft("");
    played.current = `${step}:${mode}`;
    advance();
  };

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !line) return;
    if (isScout) {
      showHint(t("scout.hint.scoutNotDone"));
      return;
    }
    // The prototype accepts an answer that reuses the prepared wording.
    const reference = t(line.key).toLowerCase();
    const hits = trimmed
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && reference.includes(word)).length;
    if (hits >= 2) send();
    else showHint(t("scout.hint.freeTextDiscovery"));
  };

  if (!line) return null;

  const suggestion = mode === "text" && !isScout ? t(line.key) : null;
  const controlSize = narrow ? 60 : 76;
  const blobSize = narrow ? (mode === "voice" ? 120 : 88) : mode === "voice" ? 150 : 96;
  const utteranceClass = narrow
    ? mode === "voice"
      ? "text-[28px]"
      : "text-[24px]"
    : mode === "voice"
      ? "text-[length:var(--text-utterance-size)]"
      : "text-[length:var(--text-card-title-size)]";

  return (
    <div
      className={cn(
        STAGE_SHELL,
        "relative",
        narrow && facts.length > 0 ? "pb-[96px]" : "pb-[var(--space-13)]",
      )}
    >
      <ScoutBlob
        size={blobSize}
        state={isScout ? "speaking" : "listening"}
        className="mb-[var(--space-13)] transition-[width,height] duration-(--duration-slower) ease-out-soft"
      />
      <div className="flex min-h-[22px] items-center gap-[var(--space-4)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
        <span className="font-medium text-rs-ink-2">
          {isScout ? t("scout.discovery.speaker.scout") : t("scout.discovery.speaker.user")}
        </span>
        {isScout ? null : (
          <>
            <span className="text-rs-ink-8">·</span>
            <span>{t("scout.discovery.state.listening")}</span>
          </>
        )}
      </div>
      <div className="flex min-h-[170px] w-full items-center justify-center">
        <p
          key={step}
          className={cn(
            "mt-[var(--space-5)] mb-0 animate-rs-fade-up font-light text-rs-ink-bright [text-wrap:balance]",
            "leading-[var(--text-utterance-leading)] tracking-[var(--text-utterance-tracking)]",
            utteranceClass,
          )}
          style={{
            maxWidth:
              !narrow && facts.length > 0 ? "min(760px, calc(100vw - 660px))" : "760px",
          }}
        >
          {mode === "text" && !isScout ? "" : t(line.key)}
        </p>
      </div>
      <div className="mt-[var(--space-2)] flex h-[var(--space-19)] items-center justify-center">
        {capsuleKey ? <Capsule key={capsuleKey}>{t(capsuleKey)}</Capsule> : null}
      </div>

      {mode === "voice" ? (
        <>
          <div
            className={cn(
              "mt-[var(--space-16)] flex items-start",
              narrow ? "gap-[var(--space-9)]" : "gap-[var(--space-15)]",
            )}
          >
            <VoiceControl
              tone="accent"
              size={controlSize}
              active={micOn}
              label={
                micOn ? t("scout.discovery.controls.micOn") : t("scout.discovery.controls.micOff")
              }
              onClick={() => setMicOn((on) => !on)}
            >
              <Icon name={micOn ? "mic" : "mic-off"} size={26} />
            </VoiceControl>
            <VoiceControl
              size={controlSize}
              label={t("scout.discovery.controls.transcript")}
              onClick={toggleTranscript}
            >
              <Icon name="transcript" size={24} />
            </VoiceControl>
            <VoiceControl
              size={controlSize}
              tone="danger"
              label={t("scout.discovery.controls.end")}
              onClick={() => go("welcome")}
            >
              <Icon name="close" size={24} />
            </VoiceControl>
          </div>
          <Button
            variant="link"
            size="2xs"
            className="mt-[var(--space-12)] text-[length:var(--text-caption-size)] text-rs-ink-6 no-underline"
            onClick={() => setMode("text")}
          >
            {t("scout.discovery.controls.switchToText")}
          </Button>
        </>
      ) : (
        <div className="mt-[var(--space-10)] flex w-[min(640px,100%)] flex-col items-center gap-[var(--space-5)]">
          {suggestion ? (
            <Button
              variant="tint"
              size="2xs"
              className="h-auto px-[var(--space-6)] py-[var(--space-3)] text-left font-normal whitespace-normal"
              onClick={send}
            >
              {suggestion}
            </Button>
          ) : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            onVoice={() => setMode("voice")}
            label={t("scout.discovery.input.aria")}
            sendLabel={t("scout.discovery.send.aria")}
            voiceLabel={t("scout.discovery.switchToVoice.aria")}
            placeholder={
              isScout
                ? t("scout.discovery.input.placeholder.busy")
                : t("scout.discovery.input.placeholder.awaiting")
            }
          />
          <div className="flex gap-[var(--space-8)]">
            <Button
              variant="ghost"
              size="2xs"
              className="text-[length:var(--text-caption-size)] text-rs-ink-6"
              onClick={toggleTranscript}
            >
              {t("scout.discovery.links.transcript")}
            </Button>
            <Button
              variant="ghost"
              size="2xs"
              className="text-[length:var(--text-caption-size)] text-rs-ink-6"
              onClick={() => go("welcome")}
            >
              {t("scout.discovery.links.end")}
            </Button>
          </div>
        </div>
      )}

      {facts.length > 0 && !narrow ? (
        <FactList
          title={t("scout.brief.title")}
          facts={toFactRows(t, facts)}
          className="absolute top-1/2 right-[var(--space-17)] -translate-y-1/2 animate-rs-fade-up"
        />
      ) : null}

      {facts.length > 0 && narrow ? (
        <StageSheet
          variant="pill"
          open={sheetOpen}
          onToggle={() => setSheetOpen((open) => !open)}
          title={tp("scout.brief.sheet.count", facts.length)}
        >
          {sheetOpen ? (
            <FactList
              variant="compact"
              title=""
              facts={toFactRows(t, facts)}
              className="w-full border-0 bg-transparent px-0 pt-[var(--space-2)] pb-0"
            />
          ) : null}
        </StageSheet>
      ) : null}
    </div>
  );
}
