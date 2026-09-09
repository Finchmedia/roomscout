/**
 * Kontrolle & FAQ — LANDING_SCREENS.md §11 (`#control`).
 *
 * Left: the „Klar geregelt" claim. Right: the three-item accordion, single-open
 * and collapsible with item 0 open on load — the `Accordion` atom's `faq`
 * variant already ships the circled plus/minus, the warm open hairline and the
 * .32 s panel, so nothing here restyles it.
 */

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Overline } from "@/components/ui/overline"
import { useCopy } from "@/ui/copy"

import { FAQ_ITEMS, SECTION_IDS } from "./demoData"

export function Faq() {
  const { t } = useCopy()

  return (
    <section
      id={SECTION_IDS.control}
      className="relative z-2 mx-auto grid max-w-[1400px] scroll-mt-[70px] grid-cols-1 items-start gap-[clamp(30px,5vw,80px)] px-[clamp(20px,5vw,80px)] pt-[110px] pb-10 min-[880px]:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]"
    >
      <div>
        <Overline tone="accent" wide>
          {t("landing.control.eyebrow")}
        </Overline>
        <h2 className="mt-[18px] text-[clamp(32px,3.8vw,54px)] leading-[1.06] font-normal tracking-[-.03em] text-balance">
          {t("landing.control.headline.line1")}
          <br />
          {t("landing.control.headline.line2")}
        </h2>
        <p className="mt-[22px] max-w-[460px] text-[17px] leading-[1.6] text-rs-ink-4 text-pretty">
          {t("landing.control.lead")}
        </p>
      </div>

      <Accordion
        type="single"
        collapsible
        defaultValue={FAQ_ITEMS[0]?.id}
        className="flex flex-col gap-3"
      >
        {FAQ_ITEMS.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger>{t(item.questionKey)}</AccordionTrigger>
            <AccordionContent>{t(item.answerKey)}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
