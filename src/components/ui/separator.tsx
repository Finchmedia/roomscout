"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Separator as SeparatorPrimitive } from "radix-ui"

/**
 * Separator — the shadcn/ui separator primitive restyled to the RoomScout
 * design system.
 *
 * DS spec: the borders block of `design-system/tokens/colors.css`, shown as the
 * "Divider" swatch in `design-system/guidelines/colors-borders.html`
 * (`--rs-border-divider`). The DS has no `Separator` component: every rule is
 * drawn inline as a bare 1px box, never as a `border`, always filled with a
 * divider token —
 * - `components/navigation/profile-menu/ProfileMenu.jsx:9` and
 *   `ui_kits/roomscout-app/{Settings.jsx:265,Operator.jsx:120}` (sidebar footer):
 *   `height:1; background:var(--rs-border-divider)`;
 * - `components/data/data-table/DataTable.jsx`: header rule `--rs-border-divider`,
 *   row rules `--rs-border-divider-soft`.
 *
 * `docs/UI_PORT/TOKENS.md` §F8 rules that exactly two divider levels are
 * meaningful and everything between them is drift: `.10` (`--rs-border-divider`,
 * 44 uses) for content rules, `.08` (`--rs-border-divider-soft`, 18 uses) for
 * nav/sidebar chrome. Those are `tone="default"` and `tone="soft"`. The two
 * short *vertical* rules in the source — the side-note composer at
 * `rgba(255,220,190,.16)` (`docs/UI_PORT/SCOUT_SCREENS.md:1021`) and the landing
 * footer at `rgba(255,220,190,.2)` (`docs/UI_PORT/LANDING_SCREENS.md:987`) —
 * are the "quiet control border" family (`TOKENS.md:182-183`), so they resolve
 * to `--rs-border-control` as `tone="control"`.
 *
 * Note the DS default differs from stock shadcn: `bg-border` resolves to
 * `--border-card` (the card hairline, `rgba(255,200,160,.14)`), which is a
 * *card edge*, not a rule. Dividers are the peach `255,220,190` family.
 *
 * Geometry stays shadcn's: 1px on the cross axis, full length on the main axis.
 * The DS rules carry their own margins and, for the vertical ones, a fixed
 * height (18/22px) — that is call-site layout, not the primitive's business.
 *
 * The Radix/shadcn public API (`orientation`, `decorative`, `asChild`, …) and
 * the `data-slot="separator"` hook are untouched, so shadcn blocks keep working
 * (`SidebarSeparator` composes this and overrides the fill with
 * `bg-sidebar-border`, which is `--rs-border-divider-soft`). `tone` is additive.
 */
const separatorVariants = cva(
  [
    "shrink-0 border-0",
    "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
    "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
  ],
  {
    variants: {
      tone: {
        /** Content rule between rows, sections and menu groups (.10). */
        default: "bg-rs-border-divider",
        /** Chrome hairline: sidebar/nav edges and table row rules (.08). */
        soft: "bg-rs-border-divider-soft",
        /** Quiet control rule — the short vertical splits in composer/footer. */
        control: "bg-rs-border-control",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  }
)

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  tone = "default",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root> &
  VariantProps<typeof separatorVariants>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      data-tone={tone}
      decorative={decorative}
      orientation={orientation}
      className={cn(separatorVariants({ tone }), className)}
      {...props}
    />
  )
}

// `separatorVariants` is part of the shadcn public API (blocks import the
// variants to compose their own rules); the cva() call is not a plain constant,
// so the react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Separator, separatorVariants }
