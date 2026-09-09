/**
 * Closing CTA — LANDING_SCREENS.md §12, items 1–4.
 *
 * Demo disclaimer, the resting blob, the closing question and the two calls to
 * action. The static blob is the `ScoutBlob` atom (the source hand-rolls the
 * same gradient, radius and `rsBreathe` animation inline).
 */

import { Button } from "@/components/ui/button"
import { ScoutBlob } from "@/components/ui/scout-blob"
import { useCopy } from "@/ui/copy"

import { DEMO_HREF, PROJECT_HREF } from "./demoData"

export function ClosingCta() {
  const { t } = useCopy()

  return (
    <section className="relative z-2 flex flex-col items-center px-6 pt-[100px] text-center">
      <div className="text-[15px] text-rs-ink-4">{t("landing.closing.disclaimer")}</div>

      <ScoutBlob size={86} className="mt-11" />

      <h2 className="mt-[34px] text-[clamp(36px,5vw,66px)] leading-[1.04] font-light tracking-[-.03em] text-balance">
        {t("landing.closing.headline")}
      </h2>

      <div className="mt-[34px] flex flex-wrap items-center justify-center gap-[26px]">
        <Button asChild size="lg" className="h-[58px] px-[34px] text-[17px]">
          <a href={DEMO_HREF}>{t("landing.closing.cta.primary")}</a>
        </Button>
        <a
          href={PROJECT_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[16px] text-rs-ink no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
        >
          {t("landing.closing.cta.secondary")}
        </a>
      </div>
    </section>
  )
}
