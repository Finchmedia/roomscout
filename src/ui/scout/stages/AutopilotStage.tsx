/**
 * 4 · Autopilot (ScreensB.jsx `Autopilot`).
 *
 * The Scout works; the band watches one calm status line. The sequence itself
 * lives in the machine (it has to survive the Settings and Operator panels), so
 * this file is the view plus the three things the band can do here: release a
 * prepared message, unblock a source or an access, and drop a side note.
 *
 * The approval card and both blockers are built even though the kit's happy
 * path never reaches them — DECISIONS.md item 25.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Composer } from "@/components/ui/composer";
import { FactList } from "@/components/ui/fact-list";
import { Icon } from "@/components/ui/icon";
import { Overline } from "@/components/ui/overline";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { StatusDot, statusDotVariants } from "@/components/ui/status-dot";
import { SummaryPill } from "@/components/ui/summary-pill";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { budgetCompactKey } from "../state/useScoutDemoMachine";
import { resolveCopy, toFactRows } from "../state/stages";
import { STAGE_SHELL, type StageProps } from "./stageProps";

export function AutopilotStage({ m, narrow }: StageProps) {
  const { t } = useCopy();
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const { paused, status, pending, waitingFor, activity, facts } = m.s;
  const statusLine = paused
    ? t("scout.chrome.badge.paused")
    : status
      ? resolveCopy(t, status)
      : "";

  return (
    <div className={cn(STAGE_SHELL, "animate-rs-fade-up")}>
      <ScoutBlob
        size={narrow ? 112 : 160}
        state={paused ? "still" : "idle"}
        className={narrow ? "mb-[var(--space-14)]" : "mb-[var(--space-19)]"}
      />
      <h1
        className={cn(
          "m-0 font-light tracking-[var(--text-display-tracking)]",
          "leading-[var(--text-display-leading)]",
          narrow ? "text-[34px]" : "text-[length:var(--text-headline-size)]",
        )}
      >
        {t("scout.autopilot.headline")}
      </h1>
      <p
        key={statusLine}
        aria-live="polite"
        className="mt-[var(--space-10)] mb-0 min-h-[32px] max-w-[560px] animate-rs-fade-up text-[length:var(--text-body-lg-size)] leading-[1.45] text-rs-ink-2 [text-wrap:balance]"
      >
        {statusLine}
      </p>

      {/* §8.3 — a message that only goes out with an explicit release. */}
      {pending ? (
        <Card
          tone="accent"
          size="md"
          className="mt-[var(--space-12)] w-[min(680px,100%)] animate-rs-fade-up text-left"
        >
          <Overline tone="accent">{t("scout.autopilot.approval.eyebrow")}</Overline>
          <div className="mt-[var(--space-4)] text-[length:var(--text-caption-size)] text-rs-ink-6">
            {t("scout.autopilot.approval.toLabel")}
            <span className="text-rs-ink-2">{t("scout.autopilot.approval.to")}</span>
          </div>
          <div className="mt-[var(--space-5)] rounded-control bg-rs-surface-subtle px-[var(--space-7)] py-[var(--space-6)] text-[length:var(--text-body-sm-size)] leading-[1.55]">
            {t("scout.autopilot.approval.message", {
              name: t(m.s.nameKey),
              budget: t(pending.budgetKey),
            })}
          </div>
          {pending.reason === "contact" ? (
            <div className="mt-[var(--space-4)] text-[length:var(--text-caption-sm-size)] text-rs-ink-4">
              {t("scout.autopilot.approval.contactOff")}
            </div>
          ) : null}
          <div className="mt-[var(--space-7)] flex flex-wrap items-center gap-[var(--space-5)]">
            <Button size="sm" onClick={m.releasePending}>
              {t("scout.autopilot.approval.release")}
            </Button>
            <Button
              variant="link"
              size="2xs"
              className="text-[length:var(--text-caption-size)]"
              onClick={() => m.openSettings("autonomy")}
            >
              {t("scout.autopilot.approval.changeAutonomy")}
            </Button>
          </div>
        </Card>
      ) : null}

      {/* §8.4 — no usable source is selected. */}
      {waitingFor === "source" ? (
        <Button
          variant="secondary"
          size="xs"
          className="mt-[var(--space-6)]"
          onClick={() => m.openSettings("sources")}
        >
          {t("scout.autopilot.blocked.chooseSource")}
        </Button>
      ) : null}

      {/* §8.5 — the portal login has expired. */}
      {waitingFor === "access" ? (
        <div className="mt-[var(--space-6)] flex flex-wrap items-center justify-center gap-[var(--space-4)] text-[length:var(--text-caption-size)] text-rs-ink-2">
          <StatusDot tone="warning">{t("scout.autopilot.blocked.accessText")}</StatusDot>
          <Button
            variant="link"
            size="2xs"
            className="px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption-size)] text-rs-ink"
            onClick={() => m.openSettings("sources")}
          >
            {t("scout.autopilot.blocked.accessLink")}
          </Button>
        </div>
      ) : null}

      <SummaryPill
        size="lg"
        icon={<Icon name="search" size={18} />}
        chevron
        open={briefOpen}
        onClick={() => setBriefOpen((open) => !open)}
        className="mt-[var(--space-15)]"
      >
        {t("scout.autopilot.brief.pill.compact", { budget: t(budgetCompactKey(facts)) })}
      </SummaryPill>
      {briefOpen ? (
        <FactList
          variant="compact"
          title={t("scout.autopilot.brief.title")}
          facts={toFactRows(t, facts)}
          className="mt-[var(--space-4)]"
        />
      ) : null}

      <Button
        variant="ghost"
        icon={<Icon name="clock" size={18} />}
        className="mt-[var(--space-10)] text-[length:var(--text-body-sm-size)]"
        onClick={() => setActivityOpen((open) => !open)}
      >
        {activityOpen ? t("scout.autopilot.activity.hide") : t("scout.autopilot.activity.show")}
      </Button>
      {activityOpen ? (
        <Card
          size="sm"
          tone="faint"
          className="w-[min(420px,100%)] animate-rs-fade-up px-[var(--space-9)] py-[var(--space-7)] text-left"
        >
          {activity.map((entry, index) => (
            <div
              key={entry.id}
              className="grid grid-cols-[14px_1fr] items-start gap-[var(--space-5)] py-[7px]"
            >
              <span
                aria-hidden="true"
                className={cn(
                  statusDotVariants({
                    tone: index === activity.length - 1 ? "accent" : "past",
                  }),
                  "mt-[6px] justify-self-center",
                )}
              />
              <div>
                <div className="text-[length:var(--text-body-sm-size)]">
                  {resolveCopy(t, entry.text)}
                </div>
                {entry.metaKey ? (
                  <div className="mt-[2px] text-[length:var(--text-micro-size)] text-rs-ink-6">
                    {t(entry.metaKey)}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      <div className="mt-[var(--space-17)] w-[min(660px,100%)]">
        <Composer
          value={note}
          onChange={setNote}
          onSubmit={() => {
            if (!note.trim()) return;
            setNote("");
            m.showHint(t("scout.hint.sideNote"));
          }}
          onVoice={() => m.showHint(t("scout.hint.micSimulatedAutopilot"))}
          divider
          height={62}
          label={t("scout.autopilot.sideNote.aria")}
          voiceLabel={t("scout.autopilot.sideNote.voice.aria")}
          placeholder={t("scout.autopilot.sideNote.placeholder")}
        />
      </div>
      <div className="mt-[var(--space-10)] text-[length:var(--text-caption-size)] text-rs-ink-6">
        {t("scout.autopilot.footnote")}
      </div>
    </div>
  );
}
