/**
 * Feature bento — LANDING_SCREENS.md §10 (`#features`).
 *
 * Four cards on the `Card` atom (`size="2xl" tone="soft" hoverLift`), in the
 * source's two rows: A wide + B on top, C + D wide underneath. Below 880 px all
 * four stack, card A drops its photo (§10.1's `memPhoto = !narrow`) and card D
 * gives up its 66 % text clamp (DECISIONS item 8).
 *
 * Card titles are `h3` (DECISIONS item 49 — the source's plain `<div>`s cost
 * the page its outline).
 *
 * The one animated detail is §10.1's `memSeen`: the first time the bento
 * reaches the viewport, card A strikes „400 €" through and turns „350 € /
 * Monat" orange, and the panel stamp switches to „Aktualisiert · gerade eben".
 * It latches, so the correction plays exactly once.
 */

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Overline } from "@/components/ui/overline"
import { ScoutBlob } from "@/components/ui/scout-blob"
import { SummaryPill } from "@/components/ui/summary-pill"
import { useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"

import { ROOM_PHOTO_SRC, SECTION_IDS } from "./demoData"
import { useInView } from "./useLandingScroll"

/** §10 card head — 22–27 px title, 16 px subtitle. */
function BentoHead({ titleKey, subtitleKey }: { titleKey: StringCopyKey; subtitleKey: StringCopyKey }) {
  const { t } = useCopy()
  return (
    <>
      <h3 className="text-[clamp(22px,1.9vw,27px)] font-medium tracking-[-.01em]">
        {t(titleKey)}
      </h3>
      <div className="mt-1.5 text-[16px] text-rs-ink-4">{t(subtitleKey)}</div>
    </>
  )
}

/** §10.3's placeholder rules — static, not a loading `Skeleton`. */
function CollageBar({ className }: { className?: string }) {
  return <div className={cn("h-1.5 rounded-[3px] bg-rs-white/12", className)} />
}

export function Bento() {
  const { t } = useCopy()
  const { ref, inView: memSeen } = useInView<HTMLElement>({ rootMargin: "0px 0px -30% 0px" })

  return (
    <section
      ref={ref}
      id={SECTION_IDS.features}
      className="relative z-2 mx-auto max-w-[1400px] scroll-mt-[70px] px-[clamp(20px,5vw,80px)] pt-[140px] pb-10"
    >
      <Overline tone="accent" wide>
        {t("landing.features.eyebrow")}
      </Overline>
      <h2 className="mt-[18px] text-[clamp(36px,5vw,68px)] leading-[1.04] font-normal tracking-[-.03em] text-balance">
        {t("landing.features.headline.line1")}
        <br />
        {t("landing.features.headline.line2")}
      </h2>
      <p className="mt-4 text-[clamp(17px,1.4vw,20px)] text-rs-ink-4">
        {t("landing.features.lead")}
      </p>

      {/* Row 1 — A (wide) + B */}
      <div className="mt-10 grid grid-cols-1 gap-[18px] min-[880px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card
          size="2xl"
          tone="soft"
          hoverLift
          padding={0}
          className="grid grid-cols-1 overflow-hidden min-[880px]:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]"
        >
          <div className="min-w-0 px-[34px] py-8">
            <BentoHead
              titleKey="landing.features.memory.title"
              subtitleKey="landing.features.memory.subtitle"
            />

            <div className="mt-6 rounded-card border border-rs-border-card bg-rs-surface-inset px-[18px] py-[14px]">
              <div className="flex justify-between text-[12px] tracking-[.1em] text-rs-ink-6 uppercase">
                <span>{t("landing.features.memory.panel.label")}</span>
                <span className="tracking-normal normal-case">
                  {memSeen
                    ? t("landing.features.memory.stamp.updated")
                    : t("landing.features.memory.stamp.idle")}
                </span>
              </div>

              <div className="mt-2 flex h-[46px] items-center gap-3 border-t border-rs-border-divider-soft text-[15.5px]">
                <Icon name="users" size={20} color="var(--rs-ink-2)" />
                {t("landing.features.memory.row.band")}
              </div>
              <div className="flex h-[46px] items-center gap-3 border-t border-rs-border-divider-soft text-[15.5px]">
                <Icon name="drum" size={20} color="var(--rs-ink-2)" />
                {t("landing.features.memory.row.equip")}
              </div>
              <div className="flex h-[46px] items-center gap-3 border-t border-rs-border-divider-soft text-[15.5px]">
                <span aria-hidden="true" className="w-5 text-center text-[19px]">
                  €
                </span>
                <span
                  className={cn(
                    "text-rs-ink-6 line-through transition-opacity duration-[var(--duration-slow)]",
                    memSeen ? "opacity-100" : "opacity-0"
                  )}
                >
                  {t("landing.features.memory.row.budget.old")}
                </span>
                <span
                  className={cn(
                    "font-medium transition-colors duration-[var(--duration-slow)]",
                    memSeen ? "text-rs-orange-light" : "text-rs-ink"
                  )}
                >
                  {t("landing.features.memory.row.budget.new")}
                </span>
              </div>
            </div>
          </div>

          <img
            src={ROOM_PHOTO_SRC}
            alt=""
            className="hidden h-full min-h-[280px] w-full object-cover min-[880px]:block"
          />
        </Card>

        <Card size="2xl" tone="soft" hoverLift>
          <BentoHead
            titleKey="landing.features.followup.title"
            subtitleKey="landing.features.followup.subtitle"
          />

          <div className="mt-6 flex flex-col gap-2.5">
            <div className="grid grid-cols-[44px_1fr] items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-11 items-center justify-center rounded-circle border border-rs-border-card bg-rs-surface-subtle-2 text-rs-ink-2"
              >
                <Icon name="building" size={18} />
              </span>
              <div className="rounded-[14px] border border-rs-border-divider bg-rs-white/5 px-4 py-3">
                <div className="flex justify-between text-[12.5px] text-rs-ink-6">
                  <span>{t("landing.features.followup.msg1.sender")}</span>
                  <span>{t("landing.features.followup.msg1.time")}</span>
                </div>
                <div className="mt-1 text-[15.5px]">
                  {t("landing.features.followup.msg1.body")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[44px_1fr] items-start gap-3">
              <ScoutBlob size={44} state="still" />
              <div className="rounded-[14px] border border-rs-border-accent-faint bg-rs-rust-soft px-4 py-3">
                <div className="flex justify-between text-[12.5px]">
                  <span className="text-rs-orange-light">
                    {t("landing.features.followup.msg2.sender")}
                  </span>
                  <span className="text-rs-ink-6">
                    {t("landing.features.followup.msg2.time")}
                  </span>
                </div>
                <div className="mt-1 text-[15.5px]">
                  {t("landing.features.followup.msg2.body")}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Row 2 — C + D (wide) */}
      <div className="mt-[18px] grid grid-cols-1 gap-[18px] min-[880px]:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card size="2xl" tone="soft" hoverLift className="overflow-hidden">
          <BentoHead
            titleKey="landing.features.sources.title"
            subtitleKey="landing.features.sources.subtitle"
          />

          {/* Painting order is DOM order — §10.3: listing, wanted, shared, pill. */}
          <div className="relative mt-6 h-[170px]">
            <div className="absolute top-0 left-0 grid w-[min(300px,78%)] grid-cols-[96px_1fr] gap-3 rounded-[14px] border border-rs-border-panel bg-rs-black/35 p-2.5">
              <img
                src={ROOM_PHOTO_SRC}
                alt=""
                className="h-[78px] w-24 rounded-chip object-cover"
              />
              <div>
                <div className="text-[14.5px]">{t("landing.features.sources.card.listing")}</div>
                <CollageBar className="mt-2 w-[80%]" />
                <CollageBar className="mt-1.5 w-[60%]" />
              </div>
            </div>

            <div className="absolute top-[58px] left-[min(150px,40%)] w-[min(240px,62%)] rounded-[14px] border border-rs-border-card bg-rs-surface-page/90 px-3.5 py-3">
              <div className="flex items-center gap-2 text-[14.5px]">
                <Icon name="doc" size={16} />
                {t("landing.features.sources.card.wanted")}
              </div>
              <CollageBar className="mt-2 w-[70%]" />
              <CollageBar className="mt-1.5 w-[50%]" />
            </div>

            <div className="absolute top-6 left-[min(300px,70%)] w-[150px] rounded-[14px] border border-rs-border-card-soft bg-rs-surface-page/85 px-3.5 py-3">
              <div className="flex items-center gap-2 text-[13.5px]">
                <Icon name="home" size={15} />
                {t("landing.features.sources.card.shared")}
              </div>
              <CollageBar className="mt-2 w-[75%]" />
            </div>

            <SummaryPill
              size="sm"
              icon={<Icon name="pin" size={16} />}
              className="absolute bottom-0 left-0 h-10"
            >
              {t("landing.features.sources.pill.city")}
            </SummaryPill>
          </div>
        </Card>

        <Card size="2xl" tone="soft" hoverLift className="relative overflow-hidden">
          <ScoutBlob
            size={220}
            className="absolute top-1/2 right-[-40px] -translate-y-1/2 opacity-90"
          />

          <div className="relative max-w-full min-[880px]:max-w-[66%]">
            <BentoHead
              titleKey="landing.features.autopilot.title"
              subtitleKey="landing.features.autopilot.subtitle"
            />

            <div className="mt-6 rounded-card border border-rs-border-card bg-rs-black/30 px-[18px] py-1.5">
              <div className="grid grid-cols-[36px_1fr] items-center gap-3.5 border-b border-rs-border-divider-soft py-3">
                <span
                  aria-hidden="true"
                  className="flex size-[34px] items-center justify-center rounded-circle bg-rs-orange text-rs-white"
                >
                  <Icon name="check" size={16} strokeWidth={2.4} />
                </span>
                <div>
                  <div className="text-[15.5px]">{t("landing.features.autopilot.row1.title")}</div>
                  <div className="text-[13.5px] text-rs-ink-6">
                    {t("landing.features.autopilot.row1.sub")}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-[36px_1fr] items-center gap-3.5 py-3">
                <span
                  aria-hidden="true"
                  className="flex size-[34px] items-center justify-center rounded-circle border border-rs-border-control-strong text-rs-ink"
                >
                  <Icon name="lock" size={15} />
                </span>
                <div>
                  <div className="text-[15.5px]">{t("landing.features.autopilot.row2.title")}</div>
                  <div className="text-[13.5px] text-rs-ink-6">
                    {t("landing.features.autopilot.row2.sub")}
                  </div>
                </div>
              </div>
            </div>

            <a
              href={`#${SECTION_IDS.control}`}
              className="mt-[18px] inline-block text-[15px] text-rs-ink underline decoration-rs-border-accent underline-offset-4 transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
            >
              {t("landing.features.autopilot.link")}
            </a>
          </div>
        </Card>
      </div>
    </section>
  )
}
