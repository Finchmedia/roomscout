/**
 * Overview integration tile + the partner mark used across the surface.
 *
 * DS reference: `design-system/ui_kits/roomscout-app/Operator.jsx` (`tiles`
 * grid, `Logo`); `docs/UI_PORT/OPERATOR_SCREENS.md` §5.5 (tile: `18px 20px`,
 * radius 16, `--rs-surface-card` on `--rs-border-card`, head row with the mark,
 * name and role, then the status row) and §5.6 (the OpenAI mark at 22px).
 *
 * The tile navigates to the Integrationen page **and** expands that provider's
 * row — `openTile` in the kit. Logos are served from
 * `public/design/partners/` (copied from `design-system/assets/partners/`).
 */

import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { StatusDot } from "@/components/ui/status-dot"
import { useCopy } from "@/ui/copy"
import type { OperatorIntegration } from "@/ui/operator/state/useOperatorDemoState"

interface PartnerLogoProps {
  src: string
  /** Rendered box in px — 28 on a tile, 24 in a row, 22 for the OpenAI line. */
  size?: number
  className?: string
}

/** Decorative: the provider name always sits next to it. */
function PartnerLogo({ src, size = 24, className }: PartnerLogoProps) {
  return (
    <img
      data-slot="operator-partner-logo"
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("flex-none rounded-[5px] object-contain", className)}
      style={{ width: size, height: size }}
    />
  )
}

interface IntegrationTileProps {
  integration: OperatorIntegration
  onOpen: (id: OperatorIntegration["id"]) => void
}

function IntegrationTile({ integration, onOpen }: IntegrationTileProps) {
  const { t } = useCopy()

  return (
    <Card
      asChild
      size="sm"
      className="rounded-card px-[var(--space-9)] py-[var(--space-8)] transition-[background-color] duration-[var(--duration-fast)] ease-out-soft hover:bg-rs-surface-hover-soft"
    >
      <button
        type="button"
        onClick={() => onOpen(integration.id)}
        className="flex cursor-pointer flex-col gap-[var(--space-6)] text-left"
      >
        <span className="flex items-center gap-[var(--space-5)]">
          <PartnerLogo src={integration.logo} size={28} />
          <span className="min-w-0">
            <span className="block text-[16.5px] font-medium text-rs-ink">
              {t(integration.nameKey)}
            </span>
            <span className="mt-px block text-[length:var(--text-caption-size)] text-rs-ink-4">
              {t(integration.roleKey)}
            </span>
          </span>
        </span>
        <StatusDot tone={integration.tone}>{t(integration.statusKey)}</StatusDot>
      </button>
    </Card>
  )
}

export { IntegrationTile, PartnerLogo }
export type { IntegrationTileProps, PartnerLogoProps }
