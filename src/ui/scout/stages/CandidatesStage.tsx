/**
 * 7c · Kandidaten (ScreensC.jsx `Candidates`).
 *
 * Three rooms side by side with the differences that matter, and one badge —
 * „Mein Vorschlag“ — on the cheapest room that fits the brief, keeps the drums
 * and lies in the searched area (DECISIONS item 31: the backend score replaces
 * this rule when there is one). Both computed variants are built: the amber
 * over-budget line is built (item 26); the out-of-area case only removes a room
 * from the badge race, because no dictionary key carries its marker yet.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FactList } from "@/components/ui/fact-list";
import { Icon } from "@/components/ui/icon";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { SummaryPill } from "@/components/ui/summary-pill";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { CANDIDATES } from "../state/demoData";
import { findFact, toFactRows } from "../state/stages";
import { budgetCompactKey, budgetNumber } from "../state/useScoutDemoMachine";
import { STAGE_SHELL, type StageProps } from "./stageProps";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

export function CandidatesStage({ m, narrow }: StageProps) {
  const { t } = useCopy();
  const [briefOpen, setBriefOpen] = React.useState(false);

  const budget = budgetNumber(m.s.facts);
  // The kit tests the „& Umland“ label; the key is the language-safe equivalent.
  const includesUmland =
    findFact(m.s.facts, "ort")?.labelKey === "scout.facts.ort.umland";

  const list = CANDIDATES.map((candidate) => ({
    candidate,
    fits: candidate.priceNum <= budget,
    inArea: candidate.id !== "esslingen" || includesUmland,
  }));
  const best = list
    .filter((entry) => entry.fits && entry.candidate.storageOk && entry.inArea)
    .sort((a, b) => a.candidate.priceNum - b.candidate.priceNum)[0];

  return (
    <div className={cn(STAGE_SHELL, "pt-[var(--space-9)]")}>
      <ScoutBlob size={72} className="mb-[var(--space-10)]" />
      <h1 className="m-0 text-[length:var(--text-headline-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)] [text-wrap:balance]">
        {t("scout.candidates.headline")}
      </h1>
      <p className="mt-[var(--space-5)] mb-0 text-[length:var(--text-body-lg-size)] text-rs-ink-4">
        {t("scout.candidates.subline")}
      </p>

      <div
        className={cn(
          "mt-[var(--space-13)] grid w-[min(1180px,100%)] animate-rs-fade-up gap-[var(--space-6)] text-left",
          narrow ? "grid-cols-1" : "grid-cols-3",
        )}
      >
        {list.map(({ candidate, fits }) => {
          const isBest = best?.candidate.id === candidate.id;
          return (
            <Card
              key={candidate.id}
              size="lg"
              padding={0}
              className={cn(
                "relative flex flex-col overflow-hidden",
                isBest && "border-rs-border-accent",
              )}
            >
              {isBest ? (
                <Badge className="absolute top-[var(--space-6)] left-[var(--space-6)] z-2">
                  {t("scout.candidates.badge.best")}
                </Badge>
              ) : null}
              {candidate.photo ? (
                <img
                  src={candidate.photo}
                  alt=""
                  className="block h-[150px] w-full object-cover"
                />
              ) : (
                <PhotoPlaceholder className="h-[150px]">
                  {t("scout.candidates.photo.pending")}
                </PhotoPlaceholder>
              )}
              <div className="flex flex-1 flex-col gap-[var(--space-6)] px-[var(--space-10)] pt-[var(--space-9)] pb-[var(--space-10)]">
                <div>
                  <div className="text-[length:var(--text-lead-size)]">{t(candidate.nameKey)}</div>
                  <div className="mt-[var(--space-1)] text-[30px] tracking-[var(--text-display-tracking)]">
                    {t(candidate.priceKey)}
                  </div>
                  <div
                    className={cn(
                      "mt-[2px] text-[length:var(--text-caption-sm-size)]",
                      fits ? "text-rs-ink-6" : "text-rs-amber",
                    )}
                  >
                    {fits
                      ? t("scout.candidates.budget.ok")
                      : t("scout.candidates.budget.over", { budget })}
                  </div>
                </div>

                <div className="flex flex-col gap-[9px] border-t border-rs-border-divider pt-[var(--space-5)] text-[length:var(--text-body-sm-size)]">
                  <div className="flex items-start gap-[var(--space-4)]">
                    <Icon name="clock" size={18} className="mt-[1px] text-rs-ink-2" />
                    {t(candidate.timeKey)}
                  </div>
                  <div className="flex items-start gap-[var(--space-4)]">
                    <Icon
                      name={candidate.storageOk ? "check" : "close"}
                      size={18}
                      className={cn("mt-[1px]", candidate.storageOk ? "text-rs-orange" : "text-rs-amber")}
                    />
                    {t(candidate.storageKey)}
                  </div>
                  <div className="flex items-start gap-[var(--space-4)]">
                    <Icon name="pin" size={18} className="mt-[1px] text-rs-ink-2" />
                    {t(candidate.wayKey)}
                  </div>
                  <div className="flex items-start gap-[var(--space-4)] text-rs-ink-4">
                    <Icon name="home" size={18} className="mt-[1px] text-rs-ink-2" />
                    {t(candidate.sizeKey)}
                  </div>
                </div>

                <div className="flex items-start gap-[var(--space-4)] border-t border-rs-border-divider pt-[var(--space-4)] text-[14.5px] text-rs-ink-2">
                  <span
                    aria-hidden="true"
                    className="mt-[5px] size-[10px] flex-none rounded-circle bg-rs-orange shadow-blob-sm"
                  />
                  {t(candidate.noteKey)}
                </div>

                <div className="flex-1" />
                <Button
                  size="sm"
                  variant={isBest ? "primary" : "secondary"}
                  block
                  className="h-[48px] font-semibold"
                  onClick={() => m.pickCandidate(candidate.id)}
                >
                  {t("scout.candidates.cta")}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-[var(--space-10)] flex flex-wrap items-center justify-center gap-[var(--space-8)]">
        <Button
          variant="link"
          className="text-[length:var(--text-body-sm-size)]"
          onClick={m.keepSearching}
        >
          {t("scout.candidates.keepSearching")}
        </Button>
        <SummaryPill
          size="sm"
          chevron
          open={briefOpen}
          onClick={() => setBriefOpen((open) => !open)}
          className="h-[40px]"
        >
          {t("scout.autopilot.brief.pill.compact", {
            budget: t(budgetCompactKey(m.s.facts)),
          })}
        </SummaryPill>
      </div>
      {briefOpen ? (
        <FactList
          variant="compact"
          title={t("scout.brief.title")}
          facts={toFactRows(t, m.s.facts)}
          className="mt-[var(--space-4)]"
        />
      ) : null}
    </div>
  );
}
