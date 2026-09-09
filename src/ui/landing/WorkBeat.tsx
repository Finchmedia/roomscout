/**
 * Beat 3 — „Der Scout arbeitet" (LANDING_SCREENS.md §7, `#work`).
 *
 * A 200 vh section with a sticky 100 vh stage: blob, headline, a cross-fading
 * status line, the context pill and the reassurance. The source picks the
 * status from the section's scroll progress (`stIdx = min(2, floor(p*3))`);
 * here three invisible sentinels split the section into thirds and the one
 * crossing the viewport middle names the step — same three thresholds, no
 * measuring. The lines stack in one grid cell and cross-fade, as in the source.
 */

import { cn } from "@/lib/utils"
import { Icon } from "@/components/ui/icon"
import { ScoutBlob } from "@/components/ui/scout-blob"
import { SummaryPill } from "@/components/ui/summary-pill"
import { useCopy } from "@/ui/copy"

import { SECTION_IDS, WORK_STATUS_KEYS } from "./demoData"
import { useScrollSteps } from "./useLandingScroll"

export function WorkBeat() {
  const { t } = useCopy()
  const { index, stepProps } = useScrollSteps(WORK_STATUS_KEYS.length)

  return (
    <section id={SECTION_IDS.work} className="relative z-2 min-h-[200vh] scroll-mt-0">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid grid-rows-3">
        {WORK_STATUS_KEYS.map((key, step) => (
          <div key={key} {...stepProps(step)} />
        ))}
      </div>

      <div className="sticky top-0 flex h-screen flex-col items-center justify-center px-6 py-[min(90px,10vh)] text-center">
        <ScoutBlob size={150} className="mb-[min(44px,5vh)]" />

        <h3 className="text-[clamp(34px,5vw,64px)] leading-[1.05] font-light tracking-[-.025em] text-balance">
          {t("landing.work.headline")}
        </h3>

        <div className="mt-[22px] grid min-h-16 place-items-center">
          {WORK_STATUS_KEYS.map((key, step) => (
            <div
              key={key}
              aria-hidden={step === index ? undefined : true}
              className={cn(
                "col-start-1 row-start-1 max-w-[560px] text-[clamp(17px,1.6vw,22px)] text-rs-ink-2 text-balance",
                "transition-[opacity,transform] duration-[var(--duration-slow)] ease-out-soft",
                step === index
                  ? "translate-y-0 opacity-100"
                  : step < index
                    ? "-translate-y-[10px] opacity-0"
                    : "translate-y-[10px] opacity-0"
              )}
            >
              {t(key)}
            </div>
          ))}
        </div>

        <SummaryPill
          className="mt-[26px]"
          icon={<Icon name="search" size={18} />}
        >
          {t("landing.work.context.pill")}
        </SummaryPill>

        <p className="mt-[50px] max-w-[460px] text-[15px] leading-[1.6] text-rs-ink-6 text-pretty">
          {t("landing.work.reassurance")}
        </p>
      </div>
    </section>
  )
}
