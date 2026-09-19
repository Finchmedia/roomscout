/**
 * Landing header — LANDING_SCREENS.md §3.
 *
 * Three grid columns (`1fr auto 1fr`): wordmark · nav · CTA cluster. The bar
 * shrinks 80 → 64 px and gains its blurred ground once the document is scrolled
 * past 40 px. Below 880 px the two nav anchors collapse into a `Sheet`
 * (DECISIONS item 8) and the language toggle stays next to the CTA
 * (DECISIONS item 51).
 *
 * The source's `position:fixed` bar is a `sticky` one here (task brief), so the
 * hero is no longer overlapped by 80 px of chrome.
 *
 * Nav anchors get a hover (DECISIONS item 6 — the source has none because its
 * inline `color` outranks the stylesheet's `a:hover`).
 */

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { BrandLockup } from "@/components/navigation/BrandLockup"
import { LanguageToggle, useCopy } from "@/ui/copy"
import type { StringCopyKey } from "@/ui/copy"

import { DEMO_HREF, SECTION_IDS } from "./demoData"
import { useNarrow, useScrolled } from "./useLandingScroll"

const NAV_ITEMS: readonly { href: string; labelKey: StringCopyKey }[] = [
  { href: `#${SECTION_IDS.how}`, labelKey: "landing.header.nav.how" },
  { href: `#${SECTION_IDS.features}`, labelKey: "landing.header.nav.features" },
]

interface LandingHeaderProps {
  demoHref?: string
  signInHref?: string
  signInLabel?: React.ReactNode
}

export function LandingHeader({ demoHref = DEMO_HREF, signInHref, signInLabel }: LandingHeaderProps) {
  const { t } = useCopy()
  const narrow = useNarrow()
  const scrolled = useScrolled()
  const [navOpen, setNavOpen] = React.useState(false)

  // No shipped key names this control: `landing.header.nav.openAria`
  // („Menü öffnen") is still PROPOSED in REVIEW_COPY.md §8 / DECISIONS item 81,
  // which explicitly rejects reusing `common.close`. Until it lands, the button
  // is named with the two entries it opens — shipped strings only, no invented
  // German. See the surface's open questions.
  const navLabel = `${t("landing.header.nav.how")} · ${t("landing.header.nav.features")}`

  return (
    <header
      data-scrolled={scrolled ? "true" : "false"}
      className={cn(
        "sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center",
        "border-b px-[clamp(20px,4vw,48px)]",
        "transition-[height,background-color,border-color] duration-[var(--duration-base)] ease-[ease]",
        scrolled
          ? "h-16 border-rs-border-divider-soft bg-rs-surface-page/72 [-webkit-backdrop-filter:blur(12px)] [backdrop-filter:blur(12px)]"
          : "h-20 border-transparent bg-transparent"
      )}
    >
      <a aria-label="RoomScout" href={`#${SECTION_IDS.top}`} className="justify-self-start no-underline">
        <BrandLockup size="md" />
      </a>

      {narrow ? (
        <span />
      ) : (
        <nav className="flex gap-[34px] text-[15px]">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-rs-ink-2 no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
            >
              {t(item.labelKey)}
            </a>
          ))}
        </nav>
      )}

      <div className="flex items-center gap-[14px] justify-self-end">
        <LanguageToggle className="flex items-center" />

        {!narrow && signInHref && signInLabel ? (
          <Button asChild variant="ghost" size="sm">
            <a href={signInHref}>{signInLabel}</a>
          </Button>
        ) : null}

        <Button
          asChild
          size="sm"
          className="h-11 rounded-pill px-[22px] text-[15px] font-semibold text-rs-white! hover:text-rs-white!"
        >
          <a href={demoHref}>{t("landing.header.cta.demo")}</a>
        </Button>

        {narrow ? (
          <Sheet open={navOpen} onOpenChange={setNavOpen}>
            <SheetTrigger asChild>
              <IconButton label={navLabel} size={40}>
                <Icon name="list" size={18} />
              </IconButton>
            </SheetTrigger>
            <SheetContent
              side="top"
              variant="card"
              showCloseButton
              closeLabel={t("common.close")}
              aria-describedby={undefined}
            >
              <SheetHeader>
                <SheetTitle className="sr-only">{navLabel}</SheetTitle>
              </SheetHeader>
              <SheetBody>
                <nav className="flex flex-col">
                  {NAV_ITEMS.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <a
                        href={item.href}
                        className="rounded-chip px-[var(--space-4)] py-[var(--space-6)] text-[19px] text-rs-ink no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
                      >
                        {t(item.labelKey)}
                      </a>
                    </SheetClose>
                  ))}
                  {signInHref && signInLabel ? (
                    <SheetClose asChild>
                      <a
                        href={signInHref}
                        className="rounded-chip px-[var(--space-4)] py-[var(--space-6)] text-[19px] text-rs-ink no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
                      >
                        {signInLabel}
                      </a>
                    </SheetClose>
                  ) : null}
                </nav>
              </SheetBody>
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </header>
  )
}

export type { LandingHeaderProps }
