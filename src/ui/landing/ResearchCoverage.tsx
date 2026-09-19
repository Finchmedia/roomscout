import { lazy, Suspense, useMemo } from "react"

import type { MapMarketSignal } from "@/components/map"
import { Overline } from "@/components/ui/overline"
import { useCopy } from "@/ui/copy"

import type { ResearchCoverageSnapshot } from "./researchCoverageSnapshot"
import { useInView } from "./useLandingScroll"

const MarketGlobe = lazy(async () => {
  const module = await import("@/components/map/MarketGlobe")
  return { default: module.MarketGlobe }
})

type ResearchCoverageProps = {
  snapshot: ResearchCoverageSnapshot
  demoHref?: string
  mapAccessToken?: string
}

export function ResearchCoverage({
  snapshot,
  demoHref,
  mapAccessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined,
}: ResearchCoverageProps) {
  const { t, locale } = useCopy()
  const { ref, inView } = useInView<HTMLElement>({ rootMargin: "320px 0px" })
  const observedDate = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Berlin",
  }).format(new Date(snapshot.observedAt))
  const hasCoverage = snapshot.realListingCount > 0
  const mapSignals = useMemo<MapMarketSignal[]>(() => snapshot.cities.map((city) => ({
    id: `research-${city.city}`,
    title: city.city,
    coordinates: [city.longitude, city.latitude],
    side: "supply",
    locationLabel: city.city,
    source: "RoomScout public research snapshot",
    freshnessLabel: observedDate,
    summary: `${city.realListingCount} real public listings`,
  })), [observedDate, snapshot.cities])

  return (
    <section
      aria-labelledby="research-coverage-title"
      ref={ref}
      className="relative z-2 mx-auto max-w-[1400px] px-[clamp(20px,5vw,80px)] py-[clamp(90px,10vw,140px)]"
    >
      <Overline tone="accent" wide>{t("landing.coverage.eyebrow")}</Overline>
      <div className="mt-[18px] grid gap-8 min-[900px]:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] min-[900px]:items-end">
        <div>
          <h2 id="research-coverage-title" className="text-[clamp(34px,4.5vw,60px)] leading-[1.04] tracking-[-.03em] text-balance">
            {t("landing.coverage.title")}
          </h2>
          <p className="mt-5 max-w-[620px] text-[clamp(16px,1.35vw,19px)] leading-relaxed text-rs-ink-4">
            {t("landing.coverage.lead")}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 min-[900px]:justify-end">
          <div className="rounded-full border border-rs-border-card bg-rs-surface-inset px-4 py-2 text-sm text-rs-ink-2">
            {snapshot.realListingCount} {t("landing.coverage.realCountLabel")}
          </div>
          <div className="rounded-full border border-rs-border-card bg-rs-surface-inset px-4 py-2 text-sm text-rs-ink-4">
            {t("landing.coverage.observedLabel")} {observedDate}
          </div>
        </div>
      </div>

      <div className="mt-9 grid overflow-hidden rounded-[28px] border border-rs-border-card bg-rs-surface-card/80 min-[900px]:grid-cols-[minmax(0,1.35fr)_minmax(290px,.65fr)]">
        <div className="relative min-h-[420px] border-b border-rs-border-card p-5 min-[900px]:border-r min-[900px]:border-b-0">
          {!mapAccessToken ? <div className="grid min-h-[380px] place-items-center rounded-2xl border border-rs-border-card bg-rs-surface-inset p-8 text-center text-sm text-rs-ink-4" role="status">{t("landing.coverage.mapUnavailable")}</div> : inView ? (
            <Suspense fallback={<div className="grid min-h-[380px] place-items-center text-sm text-rs-ink-4" role="status">{t("landing.coverage.mapLoading")}</div>}>
              <MarketGlobe
                accessToken={mapAccessToken}
                autoRotate={false}
                className="min-h-[380px] border-0"
                initialCenter={[10.4515, 51.1657]}
                initialZoom={4.6}
                interactive={false}
                showHint={false}
                showSignalPanel={false}
                signals={mapSignals}
              />
            </Suspense>
          ) : <div className="min-h-[380px]" aria-label={t("landing.coverage.mapLabel")} />}
          {!hasCoverage ? <p className="absolute inset-x-7 bottom-7 rounded-xl border border-rs-border-card bg-rs-surface-page/90 p-4 text-sm leading-relaxed text-rs-ink-4">{t("landing.coverage.empty")}</p> : null}
        </div>

        <div className="flex flex-col p-7">
          <h3 className="text-xl">{t("landing.coverage.sourcesTitle")}</h3>
          {snapshot.indexedSources.length > 0 ? (
            <ul className="mt-5 space-y-3">
              {snapshot.indexedSources.map((source) => <li className="flex items-center justify-between gap-4 border-b border-rs-border-divider-soft pb-3" key={source.name}>
                <span>{source.name}</span>
                <span className="text-xs tracking-[.08em] text-rs-orange-light uppercase">{t("landing.coverage.indexedSource")}</span>
              </li>)}
            </ul>
          ) : <p className="mt-4 text-sm leading-relaxed text-rs-ink-4">{t("landing.coverage.noSources")}</p>}
          <div className="mt-auto pt-8">
            <p className="text-sm leading-relaxed text-rs-ink-4">{t("landing.coverage.contactDisabled")}</p>
            {demoHref ? <a className="mt-4 inline-flex text-sm font-medium text-rs-orange-light underline decoration-rs-orange/40 underline-offset-4" href={demoHref}>{t("landing.coverage.demoCta")}</a> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
