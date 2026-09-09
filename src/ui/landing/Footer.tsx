/**
 * Footer — LANDING_SCREENS.md §12, item 5.
 *
 * Wordmark · divider · tagline on the left, GitHub link and the hackathon
 * credit on the right.
 *
 * No partner/sponsor strip: §12 records that Landing v2 references no logo
 * asset at all (the sponsor logos in the prototype belong to the Operator
 * surface), and `public/design/` ships none — so the footer stays text.
 */

import { Separator } from "@/components/ui/separator"
import { Wordmark } from "@/components/ui/wordmark"
import { useCopy } from "@/ui/copy"

import { PROJECT_HREF } from "./demoData"

export function Footer() {
  const { t } = useCopy()

  return (
    <footer className="relative z-2 mx-auto mt-[90px] flex w-[min(1400px,100%)] flex-wrap items-center justify-between gap-4 border-t border-rs-border-divider px-[clamp(20px,5vw,80px)] pt-[26px] pb-[30px] text-[14px] text-rs-ink-6">
      <div className="flex items-center gap-[18px]">
        <Wordmark size="sm" />
        <Separator orientation="vertical" className="h-[18px]" />
        <span>{t("landing.footer.tagline")}</span>
      </div>

      <div className="flex flex-col items-end gap-2">
        <a
          href={PROJECT_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rs-ink-2 no-underline transition-colors duration-[var(--duration-quick)] hover:text-rs-orange"
        >
          {t("landing.footer.link.github")}
        </a>
        <span className="text-[13px]">{t("landing.footer.credit")}</span>
      </div>
    </footer>
  )
}
