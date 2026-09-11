/**
 * Hero — LANDING_SCREENS.md §4 (`#top`).
 *
 * Eyebrow pill · two-line headline (line 2 orange) · sub-copy · CTA row ·
 * disclaimer · the tilted product preview.
 *
 * §4.6's scroll animation (`rotateX(14deg) scale(.96)` easing to flat as the
 * card climbs the viewport) is reduced to a single CSS transition: the card
 * starts tilted and lies down once the sentinel below it scrolls into view.
 * `prefers-reduced-motion` renders it flat from the first frame, as the source
 * does (§2.4 rule 3).
 *
 * Not ported: the blob knock-out mask and blob anchor 0 (§4.6 children 2–3).
 * They exist only for the travelling blob, which this port does not fly between
 * sections — see the surface's open questions.
 */

import type * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCopy } from "@/ui/copy"

import { DEMO_HREF, HERO_PREVIEW_SRC, SECTION_IDS } from "./demoData"
import { useInView, useReducedMotion } from "./useLandingScroll"

interface HeroProps {
  demoHref?: string
  demoDisclosure?: React.ReactNode
}

export function Hero({ demoHref = DEMO_HREF, demoDisclosure }: HeroProps) {
  const { t } = useCopy()
  const reducedMotion = useReducedMotion()
  const { ref: tiltRef, inView: untilted } = useInView<HTMLDivElement>({
    rootMargin: "0px 0px -10% 0px",
  })
  const flat = untilted || reducedMotion

  return (
    <section
      id={SECTION_IDS.top}
      className="relative z-2 flex flex-col items-center px-6 pt-[130px] pb-10 text-center"
    >
      <Badge variant="pill">{t("landing.hero.eyebrow")}</Badge>

      <h1 className="mt-[26px] text-[length:var(--text-display-lg-size)] leading-[1.02] font-normal tracking-[var(--text-display-lg-tracking)] text-balance">
        {t("landing.hero.headline.line1")}
        <br />
        <span className="text-rs-orange">{t("landing.hero.headline.line2")}</span>
      </h1>

      <p className="mt-6 max-w-[600px] text-[clamp(17px,1.5vw,21px)] leading-[1.5] text-rs-ink-4 text-pretty">
        {t("landing.hero.subline")}
      </p>

      <div className="mt-[34px] flex flex-wrap items-center justify-center gap-[26px]">
        <Button asChild size="lg" className="text-[17px] text-rs-white! hover:text-rs-white!">
          <a href={demoHref}>{t("landing.hero.cta.primary")}</a>
        </Button>
        <a
          href={`#${SECTION_IDS.how}`}
          className="flex items-center gap-2 text-[16px] text-rs-ink no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
        >
          {t("landing.hero.cta.secondary.label")}
          <span aria-hidden="true">{t("landing.hero.cta.secondary.arrow")}</span>
        </a>
      </div>

      <div className="mt-5 text-[13.5px] text-rs-ink-6">{demoDisclosure ?? t("landing.hero.disclaimer")}</div>

      <div className="mt-11 w-[min(1120px,100%)] [perspective:1600px] [perspective-origin:50%_0%]">
        <div
          className="relative overflow-hidden rounded-card-lg border border-rs-border-control-strong shadow-hero transition-transform duration-[var(--duration-slower)] ease-out-soft [transform-origin:50%_0%] motion-reduce:transition-none"
          style={{
            transform: flat ? "rotateX(0deg) scale(1)" : "rotateX(14deg) scale(.96)",
          }}
        >
          <img
            src={HERO_PREVIEW_SRC}
            alt={t("landing.hero.preview.alt")}
            className="block h-auto w-full"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_70%,color-mix(in_srgb,var(--rs-surface-page)_35%,transparent)_100%)]"
          />
          <Badge
            variant="muted"
            className="absolute right-[18px] bottom-[14px] border-rs-border-control bg-rs-surface-page/55 text-[12px] text-rs-ink-2"
          >
            {t("landing.hero.preview.badge")}
          </Badge>
        </div>
        {/* Trips the un-tilt once the preview has climbed the viewport. */}
        <div ref={tiltRef} aria-hidden="true" className="h-px w-full" />
      </div>
    </section>
  )
}

export type { HeroProps }
