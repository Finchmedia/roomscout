/**
 * 7 · Prüfung (ScreensB.jsx `Review`).
 *
 * Every condition on one card before anything is promised, the full terms one
 * click away, and one prepared question the Scout answers in place.
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
import type { StringCopyKey } from "@/ui/copy";
import { REVIEW_TERM_KEYS, candidateById } from "../state/demoData";
import { STAGE_SHELL, type StageProps } from "./stageProps";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

const ANSWERABLE = /zusage|danach|passiert|dann/;

export function ReviewStage({ m }: StageProps) {
  const { t } = useCopy();
  const [termsOpen, setTermsOpen] = React.useState(false);
  const [questionOpen, setQuestionOpen] = React.useState(false);
  const [answered, setAnswered] = React.useState<{ question: string } | null>(null);
  const [draft, setDraft] = React.useState("");

  const offer = candidateById(m.s.offerId);
  // The room's own „Mittwochs, 19–22 Uhr“ sits between the fixed rows, as in the kit.
  const rows: StringCopyKey[] = [
    "scout.review.terms.shared",
    offer.timeKey,
    ...REVIEW_TERM_KEYS.slice(1),
  ];

  const submit = (value: string) => {
    const text = value.trim();
    if (!text) return;
    setDraft("");
    if (ANSWERABLE.test(text.toLowerCase())) setAnswered({ question: text });
    else m.showHint(t("scout.hint.freeQuestion"));
  };

  return (
    <div className={cn(STAGE_SHELL, "animate-rs-fade-up pt-[var(--space-9)]")}>
      <ScoutBlob
        size={64}
        state={answered ? "speaking" : "idle"}
        className="mb-[var(--space-10)]"
      />
      <h1 className="mt-0 mb-[var(--space-12)] text-[length:var(--text-headline-size)] leading-[var(--text-headline-leading)] font-light tracking-[var(--text-display-tracking)]">
        {t("scout.review.headline")}
      </h1>

      <Card
        size="xl"
        className="w-[min(var(--width-card),100%)] px-[clamp(22px,3vw,36px)] pt-[var(--space-13)] pb-[var(--space-14)] text-left"
      >
        <div className="flex items-center gap-[var(--space-8)]">
          {offer.photo ? (
            <img
              src={offer.photo}
              alt=""
              className="h-[84px] w-[112px] flex-none rounded-control object-cover"
            />
          ) : (
            <PhotoPlaceholder className="h-[84px] w-[112px] flex-none rounded-control">
              {t("scout.offer.photo.pending")}
            </PhotoPlaceholder>
          )}
          <div>
            <Overline>{t(offer.nameKey)}</Overline>
            <div className="mt-[var(--space-2)] text-[26px] tracking-[-.01em]">
              {t(offer.priceKey)}{" "}
              <span className="text-[length:var(--text-body-size)] text-rs-ink-4">
                {t("scout.review.price.note")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-[var(--space-11)] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-x-[var(--space-11)] gap-y-[var(--space-4)] text-[length:var(--text-body-size)]">
          {rows.map((row) => (
            <div key={row} className="flex items-start gap-[var(--space-5)]">
              <span className="mt-[2px]">
                <Icon name="check" size={18} className="text-rs-orange" />
              </span>
              {t(row)}
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="2xs"
          className="mt-[var(--space-8)] px-0 py-[var(--space-2)] text-[length:var(--text-caption-size)]"
          onClick={() => setTermsOpen((open) => !open)}
        >
          {termsOpen ? t("scout.review.terms.hide") : t("scout.review.terms.show")}
          <Icon
            name="chevron-down"
            size={14}
            className={cn(
              "transition-transform duration-(--duration-quick) ease-out-soft",
              termsOpen && "rotate-180",
            )}
          />
        </Button>
        {termsOpen ? (
          <div className="mt-[var(--space-3)] animate-rs-fade-up rounded-control-lg bg-rs-surface-subtle px-[var(--space-8)] py-[var(--space-7)] text-[14.5px] leading-[var(--text-body-leading-relaxed)] text-rs-ink-2">
            {t("scout.review.terms.full")}
            <div className="mt-[var(--space-3)] text-[length:var(--text-micro-size)] text-rs-ink-6">
              {t("scout.review.terms.demoNote")}
            </div>
          </div>
        ) : null}

        <div className="mt-[var(--space-12)] flex flex-col gap-[var(--space-5)]">
          <Button size="md" block onClick={() => m.go("complete")}>
            {t("scout.review.accept.text")}
          </Button>
          <div className="text-center text-[length:var(--text-caption-size)] leading-[1.5] text-rs-ink-4">
            {t("scout.review.accept.disclaimer")}
          </div>
        </div>
      </Card>

      <Button
        variant="link"
        className="mt-[var(--space-9)] text-[length:var(--text-body-sm-size)]"
        onClick={() => setQuestionOpen((open) => !open)}
      >
        {t("scout.review.question.toggle")}
      </Button>

      {questionOpen ? (
        <div className="mt-[var(--space-3)] flex w-[min(var(--width-card),100%)] animate-rs-fade-up flex-col items-center gap-[var(--space-5)]">
          {!answered ? (
            <Button
              variant="tint"
              size="2xs"
              className="font-normal"
              onClick={() => setAnswered({ question: t("scout.review.question.prepared") })}
            >
              {t("scout.review.question.prepared")}
            </Button>
          ) : null}
          {answered ? (
            <div className="flex w-full flex-col gap-[var(--space-4)]">
              <ChatTurn who="user" aria-label={t("scout.transcript.who.user")}>
                {answered.question}
              </ChatTurn>
              <ChatTurn who="scout" aria-label={t("scout.transcript.who.scout")}>
                {t("scout.review.question.answer")}
              </ChatTurn>
            </div>
          ) : null}
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={submit}
            showKeyboardIcon={false}
            height={56}
            label={t("scout.review.question.aria")}
            sendLabel={t("scout.review.question.send.aria")}
            placeholder={t("scout.review.question.placeholder")}
          />
        </div>
      ) : null}
    </div>
  );
}
