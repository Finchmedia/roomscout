/**
 * Beat 5 — das Angebot (LANDING_SCREENS.md §9).
 *
 * Photo half + offer half in one card: eyebrow, room, price, two orange check
 * rows, the „Angebot prüfen" CTA and the note that only the band commits.
 *
 * `dimmed` is §9's branch: on the „Donnerstag bleibt wichtig" path the card
 * stays at 35 % opacity — the Scout promised to keep looking — until the
 * visitor takes the Mittwoch path again from Beat 4's reset link.
 */

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Overline } from "@/components/ui/overline"
import { useCopy } from "@/ui/copy"

import { DEMO_HREF, OFFER_FEATURE_KEYS, ROOM_PHOTO_SRC } from "./demoData"
import { useInView } from "./useLandingScroll"

interface OfferBeatProps {
  /** §9: the „Donnerstag" branch leaves the offer permanently faded. */
  dimmed: boolean
}

export function OfferBeat({ dimmed }: OfferBeatProps) {
  const { t } = useCopy()
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "0px 0px -15% 0px" })

  return (
    <section className="relative z-2 flex min-h-screen flex-col items-center justify-center px-6 py-[100px] text-center">
      <h3 className="mb-[30px] text-[clamp(32px,4.6vw,58px)] leading-[1.05] font-light tracking-[-.025em] text-balance">
        {t("landing.offer.headline")}
      </h3>

      <Card
        ref={ref}
        size="xl"
        padding={0}
        className={cn(
          "grid w-[min(1100px,100%)] grid-cols-1 overflow-hidden text-left min-[880px]:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]",
          "transition-[opacity,transform] duration-[var(--duration-slower)] ease-out-soft",
          inView ? "translate-y-0" : "translate-y-[24px]",
          dimmed ? "opacity-35" : inView ? "opacity-100" : "opacity-0"
        )}
      >
        <img
          src={ROOM_PHOTO_SRC}
          alt={t("landing.offer.image.alt")}
          className="block h-full max-h-[440px] min-h-[220px] w-full object-cover min-[880px]:min-h-[360px]"
        />

        <div className="flex min-w-0 flex-col justify-center px-[clamp(24px,3.4vw,52px)] py-[clamp(24px,3vw,44px)]">
          <Overline tone="accent">{t("landing.offer.eyebrow")}</Overline>

          <div className="mt-4 text-[clamp(22px,2.2vw,30px)]">{t("landing.offer.title")}</div>

          <div className="mt-1.5 text-[length:var(--text-price-size)] leading-[1.1] tracking-[-.02em]">
            {t("landing.offer.price.amount")}{" "}
            <span className="text-[.6em] text-rs-ink-2">{t("landing.offer.price.period")}</span>
          </div>

          <div className="mt-1 text-[16px] text-rs-ink-4">{t("landing.offer.price.note")}</div>

          <div className="mt-5 flex flex-col gap-[9px] text-[16px]">
            {OFFER_FEATURE_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-3">
                <Icon name="check" size={18} color="var(--rs-orange)" />
                {t(key)}
              </div>
            ))}
          </div>

          <Button asChild size="base" className="mt-[26px] self-start px-[30px]">
            <a href={DEMO_HREF}>{t("landing.offer.cta")}</a>
          </Button>

          <div className="mt-[14px] text-[14.5px] text-rs-ink-4">{t("landing.offer.note")}</div>
        </div>
      </Card>

      <div className="mt-[22px] text-[13px] text-rs-ink-6">{t("landing.offer.footnote")}</div>
    </section>
  )
}
