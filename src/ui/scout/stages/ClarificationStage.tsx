/**
 * 5 · Rückfrage (ScreensB.jsx `Clarification`).
 *
 * One question, two prepared answers, and a composer for the band that would
 * rather type. The answer is echoed as a pair of bubbles while the machine
 * hands the flow back to the autopilot.
 *
 * The two free-text matchers are the prototype's German heuristic, kept as
 * behaviour rather than copy — an unmatched answer gets the hint, never a wrong
 * branch.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Composer } from "@/components/ui/composer";
import { ChatTurn } from "@/ui/chat/ChatTurn";
import { Icon } from "@/components/ui/icon";
import { Overline } from "@/components/ui/overline";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { STAGE_SHELL, type StageProps } from "./stageProps";

const YES_PATTERN = /mittwoch|\bja\b|passt|ok|gern|klar/;
const NO_PATTERN = /\bnein\b|nicht|donnerstag ist wichtig/;

export function ClarificationStage({ m }: StageProps) {
  const { t } = useCopy();
  const [answer, setAnswer] = React.useState<"yes" | "no" | null>(null);
  const [draft, setDraft] = React.useState("");

  const reply = (yes: boolean) => {
    setAnswer(yes ? "yes" : "no");
    m.answerClarification(yes);
  };

  const submit = (value: string) => {
    const text = value.trim().toLowerCase();
    if (!text) return;
    if (NO_PATTERN.test(text)) reply(false);
    else if (YES_PATTERN.test(text)) reply(true);
    else m.showHint(t("scout.hint.clarificationNotUnderstood"));
  };

  return (
    <div className={cn(STAGE_SHELL, "animate-rs-fade-up")}>
      <ScoutBlob size={118} state="listening" className="mb-[var(--space-15)]" />
      <h1 className="m-0 text-[length:var(--text-headline-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)]">
        {t("scout.clarification.headline")}
      </h1>

      <Card size="lg" tone="soft" className="mt-[var(--space-13)] w-[min(740px,100%)] text-center">
        <Overline>{t("scout.clarification.eyebrow")}</Overline>
        <div className="mt-[var(--space-6)] text-[length:var(--text-card-title-size)] leading-[1.2] font-light tracking-[-.01em] [text-wrap:balance]">
          {t("scout.clarification.question")}
        </div>
        <div className="mt-[var(--space-7)] text-[length:var(--text-body-size)] text-rs-ink-4">
          {t("scout.clarification.detail")}
        </div>
        {!answer ? (
          <div className="mt-[var(--space-11)] flex flex-wrap justify-center gap-[var(--space-4)]">
            <Button variant="tint" size="sm" onClick={() => reply(true)}>
              {t("scout.clarification.yes.text")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => reply(false)}>
              {t("scout.clarification.no.text")}
            </Button>
          </div>
        ) : null}
      </Card>

      {answer ? (
        <div className="mt-[var(--space-8)] flex w-[min(740px,100%)] flex-col gap-[var(--space-5)]">
          <ChatTurn who="user" aria-label={t("scout.transcript.who.user")}>
            {answer === "yes"
              ? t("scout.clarification.yes.userText")
              : t("scout.clarification.no.userText")}
          </ChatTurn>
          <ChatTurn who="scout" aria-label={t("scout.transcript.who.scout")}>
            {answer === "yes"
              ? t("scout.clarification.yes.reply")
              : t("scout.clarification.no.reply")}
          </ChatTurn>
        </div>
      ) : null}

      {!answer ? (
        <div className="mt-[var(--space-10)] flex w-[min(740px,100%)] flex-wrap items-center gap-[var(--space-4)]">
          <div className="min-w-[240px] flex-1">
            <Composer
              value={draft}
              onChange={setDraft}
              onSubmit={submit}
              showKeyboardIcon={false}
              height={58}
              label={t("scout.clarification.input.aria")}
              sendLabel={t("scout.clarification.send.aria")}
              placeholder={t("scout.clarification.input.placeholder")}
            />
          </div>
          <Button
            variant="secondary"
            size="lg"
            icon={<Icon name="mic" size={18} />}
            className="h-[58px] text-[length:var(--text-body-sm-size)]"
            onClick={() => m.showHint(t("scout.hint.micSimulatedClarification"))}
          >
            {t("scout.clarification.voice")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
