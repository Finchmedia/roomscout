/**
 * 6 · Angebot (ScreensB.jsx `Offer`).
 *
 * One room, the two things the band asked for, and one way on: „Angebot
 * prüfen“. The Scout offers to explain the offer instead of a wall of terms.
 *
 * A candidate without a photo gets the „Foto folgt vom Anbieter“ placeholder
 * (DECISIONS.md item 28); a brief corrected after the offer arrived marks it
 * stale rather than silently re-pricing it.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FactList } from "@/components/ui/fact-list";
import { Icon } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Overline } from "@/components/ui/overline";
import { ScoutBlob } from "@/components/ui/scout-blob";
import { SummaryPill } from "@/components/ui/summary-pill";
import { cn } from "@/lib/utils";
import { useCopy } from "@/ui/copy";
import { candidateById } from "../state/demoData";
import { toFactRows } from "../state/stages";
import { STAGE_SHELL, type StageProps } from "./stageProps";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

export function OfferStage({ m, narrow }: StageProps) {
  const { t } = useCopy();
  const [briefOpen, setBriefOpen] = React.useState(false);
  const [talking, setTalking] = React.useState(false);

  const offer = candidateById(m.s.offerId);
  const price = t(offer.priceKey);
  const [amount = price] = price.split(" / ");

  return (
    <div className={cn(STAGE_SHELL, "pt-[var(--space-9)]")}>
      <h1 className="mt-0 mb-[var(--space-14)] animate-rs-fade-up text-[length:var(--text-headline-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)]">
        {t("scout.offer.headline")}
      </h1>

      {m.s.offerStale ? (
        <Notice
          className="mt-[calc(var(--space-5)*-1)] mb-[var(--space-10)]"
          action={
            <Button
              variant="link"
              size="2xs"
              className="px-[var(--space-1)] py-[2px] text-[length:var(--text-caption-size)] text-rs-ink"
              onClick={() => m.openSettings("knowledge")}
            >
              {t("scout.offer.stale.link")}
            </Button>
          }
        >
          {t("scout.offer.stale.text")}
        </Notice>
      ) : null}

      <Card
        size="xl"
        padding={0}
        className={cn(
          "grid w-[min(var(--width-offer),100%)] animate-rs-fade-up overflow-hidden text-left",
          narrow ? "grid-cols-1" : "grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]",
        )}
      >
        {offer.photo ? (
          <img
            src={offer.photo}
            alt={t("scout.offer.photo.alt")}
            className={cn(
              "block h-full w-full object-cover",
              narrow ? "max-h-[240px] min-h-[200px]" : "max-h-[470px] min-h-[380px]",
            )}
          />
        ) : (
          <PhotoPlaceholder
            className={cn("h-full", narrow ? "min-h-[200px]" : "min-h-[380px]")}
          >
            {t("scout.offer.photo.pending")}
          </PhotoPlaceholder>
        )}
        <div className="flex min-w-0 flex-col justify-center px-[clamp(24px,3.4vw,56px)] py-[clamp(24px,3vw,44px)]">
          <Overline tone="accent">{t("scout.offer.eyebrow")}</Overline>
          <div className="mt-[var(--space-8)] text-[length:var(--text-card-title-size)] tracking-[-.01em]">
            {t("scout.offer.title", { roomName: t(offer.nameKey) })}
          </div>
          <div className="mt-[var(--space-2)] text-[length:var(--text-price-size)] leading-[1.1] tracking-[var(--text-display-tracking)]">
            {amount}{" "}
            <span className="text-[.6em] text-rs-ink-2">{t("scout.offer.price.perMonth")}</span>
          </div>
          <div className="mt-[var(--space-2)] text-[length:var(--text-body-lg-size)] text-rs-ink-4">
            {t("scout.offer.price.note")}
          </div>
          <div className="mt-[var(--space-11)] flex flex-col gap-[var(--space-4)] text-[length:var(--text-body-lg-size)]">
            <div className="flex items-center gap-[var(--space-5)]">
              <Icon name="check" size={18} className="text-rs-orange" />
              {t(offer.timeKey)}
            </div>
            <div className="flex items-center gap-[var(--space-5)]">
              <Icon name="check" size={18} className="text-rs-orange" />
              {t(offer.storageKey)}
            </div>
          </div>
          <Button
            size="md"
            className="mt-[var(--space-14)] h-[54px] self-start px-[var(--space-17)]"
            onClick={() => m.go("offer_review")}
          >
            {t("scout.offer.cta")}
          </Button>
          <div className="mt-[var(--space-7)] text-[length:var(--text-caption-size)] text-rs-ink-6">
            {t("scout.offer.footnote")}
          </div>
        </div>
      </Card>

      <div className="mt-[var(--space-15)] flex flex-col items-center gap-[var(--space-7)]">
        <div className="flex flex-wrap items-center justify-center gap-[var(--space-10)]">
          <ScoutBlob size={58} state={talking ? "speaking" : "idle"} />
          <div className="text-[length:var(--text-lead-size)]">
            {talking ? t("scout.offer.prompt.speaking") : t("scout.offer.prompt.text")}
          </div>
        </div>
        {talking ? (
          <div className="max-w-[620px] animate-rs-fade-up text-[length:var(--text-body-lg-size)] leading-[1.5]">
            {t("scout.offer.talk")}
          </div>
        ) : (
          <Button
            variant="secondary"
            size="base"
            icon={<Icon name="mic" size={18} />}
            className="h-[52px] text-[length:var(--text-body-size)]"
            onClick={() => setTalking(true)}
          >
            {t("scout.offer.talkCta")}
          </Button>
        )}
      </div>

      {briefOpen ? (
        <FactList
          variant="compact"
          title={t("scout.offer.brief.title")}
          facts={toFactRows(t, m.s.facts)}
          className="mt-[var(--space-13)]"
        />
      ) : null}
      <SummaryPill
        icon={<Icon name="list" size={16} />}
        chevron
        open={briefOpen}
        onClick={() => setBriefOpen((open) => !open)}
        className={briefOpen ? "mt-[var(--space-4)]" : "mt-[var(--space-15)]"}
      >
        {t("scout.offer.briefPill")}
      </SummaryPill>
    </div>
  );
}
