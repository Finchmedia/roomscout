/**
 * Operator page title block — the 44px `h1` plus the 19px lead line that every
 * one of the six pages opens with.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` `OH1` /
 * `OLead`; `docs/UI_PORT/OPERATOR_SCREENS.md` §5.1 (`--text-page-title-size`,
 * `line-height:1.1`, weight 500, `-.02em`; lead `--text-lead-size` on
 * `--rs-ink-4`).
 */

import { cn } from "@/lib/utils"

interface PageIntroProps {
  title: string
  lead: string
  className?: string
}

function PageIntro({ title, lead, className }: PageIntroProps) {
  return (
    <div data-slot="operator-page-intro" className={cn(className)}>
      <h1 className="m-0 text-[length:var(--text-page-title-size)] leading-[1.1] font-medium tracking-[-.02em] text-rs-ink">
        {title}
      </h1>
      <p className="mt-[var(--space-4)] text-[length:var(--text-lead-size)] text-rs-ink-4">
        {lead}
      </p>
    </div>
  )
}

export { PageIntro }
export type { PageIntroProps }
