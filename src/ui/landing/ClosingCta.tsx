/**
 * Closing CTA — LANDING_SCREENS.md §12, items 1–4.
 *
 * Demo disclaimer, the resting blob, the closing question and the two calls to
 * action. The static blob is the `ScoutBlob` atom (the source hand-rolls the
 * same gradient, radius and `rsBreathe` animation inline).
 */

import type * as React from "react"

import { Button } from "@/components/ui/button"
import { ScoutBlob } from "@/components/ui/scout-blob"
import { useCopy } from "@/ui/copy"

import { DEMO_HREF, PROJECT_HREF } from "./demoData"

interface ClosingCtaProps {
  primaryHref?: string
  primaryLabel?: React.ReactNode
  secondaryHref?: string
  secondaryLabel?: React.ReactNode
  secondaryExternal?: boolean
}

export function ClosingCta({
  primaryHref = DEMO_HREF,
  primaryLabel,
  secondaryHref = PROJECT_HREF,
  secondaryLabel,
  secondaryExternal = true,
}: ClosingCtaProps) {
  const { t } = useCopy()

  return (
    <section className="relative z-2 flex flex-col items-center px-6 pt-[100px] text-center">
      <div className="text-[15px] text-rs-ink-4">{t("landing.closing.disclaimer")}</div>

      <ScoutBlob size={86} className="mt-11" />

      <h2 className="mt-[34px] text-[clamp(36px,5vw,66px)] leading-[1.04] font-light tracking-[-.03em] text-balance">
        {t("landing.closing.headline")}
      </h2>

      <div className="mt-[34px] flex flex-wrap items-center justify-center gap-[26px]">
        <Button asChild size="lg" className="h-[58px] px-[34px] text-[17px] text-rs-white! hover:text-rs-white!">
          <a href={primaryHref}>{primaryLabel ?? t("landing.closing.cta.primary")}</a>
        </Button>
        <a
          href={secondaryHref}
          target={secondaryExternal ? "_blank" : undefined}
          rel={secondaryExternal ? "noopener noreferrer" : undefined}
          className="text-[16px] text-rs-ink no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
        >
          {secondaryLabel ?? t("landing.closing.cta.secondary")}
        </a>
      </div>
    </section>
  )
}

export type { ClosingCtaProps }
