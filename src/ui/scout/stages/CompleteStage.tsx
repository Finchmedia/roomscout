/**
 * 8 · Abschluss (ScreensB.jsx `Complete`).
 *
 * The quiet end: what was agreed, in one pill, and the way back to the start.
 *
 * `scout.complete.subline` still carries the prototype's „es wurde keine echte
 * Zusage versendet“. DECISIONS.md item 30 replaces it with the honest line once
 * the maintainer signs off `REVIEW_COPY.md` §5 — a one-key edit in
 * `src/ui/copy/de/scout.ts`, deliberately not made from a surface build.
 */

import { Button } from "@/components/ui/button";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { SummaryPill } from "@/components/ui/summary-pill";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { candidateById } from "../state/demoData";
import { STAGE_SHELL, type StageProps } from "./stageProps";

export function CompleteStage({ m }: StageProps) {
  const { t } = useCopy();
  const offer = candidateById(m.s.offerId);

  return (
    <div className={cn(STAGE_SHELL, "pb-[var(--space-17)]")}>
      <ScoutBlob size={96} className="mb-[var(--space-17)]" />
      <h1 className="m-0 max-w-[720px] animate-rs-fade-up text-[length:var(--text-display-size)] leading-[var(--text-display-leading)] font-light tracking-[var(--text-display-tracking)] [text-wrap:balance]">
        {t("scout.complete.headline")}
      </h1>
      <div className="mt-[var(--space-10)] animate-rs-fade-up text-[length:var(--text-body-lg-size)] text-rs-ink-4">
        {t("scout.complete.subline")}
      </div>
      <SummaryPill
        size="md"
        className="mt-[var(--space-13)] h-[46px] animate-rs-fade-up text-[length:var(--text-body-sm-size)] text-rs-ink"
      >
        {t("scout.complete.summary", {
          short: t(offer.shortKey),
          price: t(offer.priceKey),
          timeLower: t(offer.timeLowerKey),
        })}
      </SummaryPill>
      <Button
        variant="link"
        className="mt-[var(--space-17)] animate-rs-fade-up text-[length:var(--text-body-sm-size)]"
        onClick={() => m.go("welcome", { reset: true })}
      >
        {t("scout.complete.restart")}
      </Button>
    </div>
  );
}
