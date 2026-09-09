/**
 * 7b · Sackgasse (ScreensC.jsx `DeadEnd`).
 *
 * The Scout says so when it cannot go on, and offers exactly three
 * compromises — none of which it takes on its own. „Nichts ändern“ is always
 * available and simply keeps the search running.
 *
 * The budget option's number is dynamic (`budget + 50`), per DECISIONS item 27.
 */

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Overline } from "@/components/ui/overline";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { DEAD_END_BUDGET_STEP, DEAD_END_OPTIONS } from "../state/demoData";
import { budgetNumber } from "../state/useScoutDemoMachine";
import { STAGE_SHELL, type StageProps } from "./stageProps";

export function DeadEndStage({ m }: StageProps) {
  const { t } = useCopy();
  const nextBudget = budgetNumber(m.s.facts) + DEAD_END_BUDGET_STEP;

  return (
    <div className={cn(STAGE_SHELL, "animate-rs-fade-up")}>
      <ScoutBlob size={110} className="mb-[var(--space-14)]" />
      <h1 className="m-0 text-[length:var(--text-headline-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)] [text-wrap:balance]">
        {t("scout.deadEnd.headline")}
      </h1>

      <Card
        size="lg"
        tone="soft"
        className="mt-[var(--space-12)] w-[min(700px,100%)] px-[var(--space-14)] py-[var(--space-13)] text-left"
      >
        <Overline>{t("scout.deadEnd.eyebrow")}</Overline>
        <div className="mt-[var(--space-4)] text-[clamp(19px,2vw,24px)] leading-[1.35] font-light">
          {t("scout.deadEnd.body")}
        </div>
        <div className="mt-[var(--space-10)] text-[length:var(--text-body-sm-size)] text-rs-ink-4">
          {t("scout.deadEnd.prompt")}
        </div>
        <div className="mt-[var(--space-5)] flex flex-col gap-[var(--space-3)]">
          {DEAD_END_OPTIONS.map((option) => (
            <button
              key={option.target}
              type="button"
              onClick={() => m.pickCompromise(option.target)}
              className={cn(
                "flex w-full cursor-pointer items-center justify-between gap-[var(--space-7)]",
                "rounded-control-lg border border-rs-border-panel bg-rs-surface-subtle",
                "px-[var(--space-7)] py-[var(--space-6)] text-left text-rs-ink",
                "transition-colors duration-(--duration-fast) ease-out-soft hover:bg-rs-surface-hover",
              )}
            >
              <span>
                <span className="block text-[length:var(--text-body-lg-size)]">
                  {t(option.titleKey, { budget: nextBudget })}
                </span>
                <span className="mt-[2px] block text-[length:var(--text-caption-size)] text-rs-ink-4">
                  {t(option.subKey)}
                </span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
      </Card>

      <Button
        variant="link"
        className="mt-[var(--space-9)] text-[length:var(--text-body-sm-size)]"
        onClick={m.keepWaiting}
      >
        {t("scout.deadEnd.keepWaiting")}
      </Button>
    </div>
  );
}
