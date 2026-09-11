/**
 * „So funktioniert RoomScout" — the intro block (LANDING_SCREENS.md §5) and the
 * four story beats that follow it (§6–§9).
 *
 * The source is one scroll engine driving five sticky/measured sections; this
 * port keeps the beats, their order and every control they carry, and drives
 * the reveals from `IntersectionObserver` (see `useLandingScroll.ts`). The one
 * piece of state that crosses beats is the visitor's Rückfrage answer: Beat 4
 * writes it, Beat 5 dims its offer card on the „Donnerstag" branch (§9).
 */

import * as React from "react"

import { Overline } from "@/components/ui/overline"
import { useCopy } from "@/ui/copy"

import { ClarifyBeat } from "./ClarifyBeat"
import { ConversationBeat } from "./ConversationBeat"
import { OfferBeat } from "./OfferBeat"
import { WorkBeat } from "./WorkBeat"
import { SECTION_IDS, type ClarifyChoice } from "./demoData"

interface HowItWorksProps {
  demoHref?: string
}

export function HowItWorks({ demoHref }: HowItWorksProps) {
  const { t } = useCopy()
  const [clarifyChoice, setClarifyChoice] = React.useState<ClarifyChoice>(null)

  return (
    <>
      <section
        id={SECTION_IDS.how}
        className="relative z-2 mx-auto max-w-[1400px] scroll-mt-[60px] px-[clamp(20px,5vw,80px)] pt-[120px]"
      >
        <div className="grid grid-cols-1 items-end gap-10 min-[880px]:grid-cols-[minmax(0,1.6fr)_minmax(260px,.8fr)]">
          <div>
            <Overline tone="accent" wide>
              {t("landing.how.eyebrow")}
            </Overline>
            <h2 className="mt-[18px] text-[clamp(36px,5.4vw,74px)] leading-[1.02] font-normal tracking-[-.03em] text-balance">
              {t("landing.how.headline.line1")}
              <br />
              {t("landing.how.headline.line2")}
            </h2>
          </div>

          <div className="pb-2.5 text-[clamp(17px,1.4vw,20px)] leading-[1.5] text-rs-ink-4">
            {t("landing.how.lead")}
            <br />
            <a
              href={`#${SECTION_IDS.features}`}
              className="mt-[14px] inline-block text-[14.5px] text-rs-ink-6 no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
            >
              {t("landing.how.link.features")}
            </a>
          </div>
        </div>
      </section>

      <ConversationBeat />
      <WorkBeat />
      <ClarifyBeat choice={clarifyChoice} onChoose={setClarifyChoice} />
      <OfferBeat dimmed={clarifyChoice === "thursday"} demoHref={demoHref} />
    </>
  )
}

export type { HowItWorksProps }
