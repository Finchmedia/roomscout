"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Separator as SeparatorPrimitive } from "radix-ui"

/**
 * Separator — the shadcn/ui separator primitive restyled to the RoomScout
 * design system.
 *
 * DS spec: the borders block of `design-system/tokens/colors.css`, shown as the
 * "Divider" / "Panel" / "Control" swatches in
 * `design-system/guidelines/colors-borders.html`.
 *
 * The DS has no `Separator` component, and it draws rules two ways:
 * - **as a CSS border** on an existing box — the large majority, always
 *   `1px solid var(--rs-border-divider)` (.10) or `…-divider-soft` (.08):
 *   `ui_kits/roomscout-app/Settings.jsx:{8,25,50,57,65,117,120,133,134,153,163,188,191,192,200,235}`,
 *   `Operator.jsx:{32,59,68,71,72,73,89,96,104,128}`,
 *   `ui_kits/landing/Landing.jsx:{18,97,98,122,140}`,
 *   `components/data/data-table/DataTable.jsx:{8,10}` (header rule `.10`, row
 *   rules `.08`);
 * - **as a standalone 1px box** — exactly three, all horizontal, all
 *   `--rs-border-divider`: `components/navigation/profile-menu/ProfileMenu.jsx:9`
 *   (`margin:2px 4px 6px`) and the sidebar footer hairline in
 *   `ui_kits/roomscout-app/{Settings.jsx:265,Operator.jsx:120}`
 *   (`height:1;background:var(--rs-border-divider);margin:24px 0 20px`).
 *
 * This primitive replaces both shapes: it is always a background-filled 1px box
 * (`border-0`), so a ported screen that had `borderBottom` renders a
 * `<Separator />` element between the two blocks instead.
 *
 * `docs/UI_PORT/TOKENS.md` §F8 rules that exactly two divider levels are
 * meaningful and everything between them is drift: `.10` (`--rs-border-divider`,
 * 44 uses) for content rules, `.08` (`--rs-border-divider-soft`, 18 uses) for
 * nav/sidebar chrome. Those are `tone="default"` and `tone="soft"`.
 *
 * The DS has exactly three *vertical* rules, and they do not share a token:
 * - `components/forms/composer/Composer.jsx:10` —
 *   `width:1;height:22;background:var(--rs-border-panel)` (rgba(255,190,140,.16)).
 *   That is `tone="panel"`. (`docs/UI_PORT/SCOUT_SCREENS.md:1021` reports the raw
 *   prototype value `rgba(255,220,190,.16)`; the DS component file is the
 *   authoritative spec and tokenises it to `--rs-border-panel`, which
 *   `src/components/ui/composer.tsx` follows.)
 * - `ui_kits/landing/Landing.jsx:141` — `width:1;height:18;background:
 *   rgba(255,220,190,.2)`, left raw by the DS; the nearest token is
 *   `--rs-border-control` (.22, the "quiet control border" family,
 *   `TOKENS.md:182-183`). That is `tone="control"`.
 * - `ui_kits/roomscout-app/App.jsx:115` — `rgba(255,255,255,.12)` in the
 *   prototype dev bar. That is demo scaffolding, not a product surface, and is
 *   deliberately not a tone; a rule of that family would be
 *   `className="bg-rs-border-neutral"` (.10).
 *
 * Note the DS default differs from stock shadcn: `bg-border` resolves to
 * `--border-card` (the card hairline, `rgba(255,200,160,.14)`), which is a
 * *card edge*, not a rule. Dividers are the peach `255,220,190` family.
 *
 * Geometry stays shadcn's: 1px on the cross axis, full length on the main axis.
 * The one deviation is `min-h` on vertical rules — see `orientation` below.
 * The DS rules carry their own margins, so spacing is call-site layout.
 *
 * The Radix/shadcn public API (`orientation`, `decorative`, `asChild`, …) and
 * the `data-slot="separator"` hook are untouched, so shadcn blocks keep working
 * (`SidebarSeparator` composes this and re-states the fill as
 * `bg-rs-border-divider` — the same colour as the default tone, matching the DS
 * sidebar footer rule; note `bg-sidebar-border` would be *wrong* there, since
 * `--sidebar-border` is `--rs-border-divider-soft`, `src/styles/tokens.css:339`).
 * `tone` is additive.
 */
const separatorVariants = cva(
  [
    "shrink-0 border-0",
    "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
    // `h-full` is 0 in a content-height flex row, which is every vertical rule
    // the DS has; the min-height keeps the rule visible at the DS's shortest
    // length (18px) until the call site states its own.
    "data-[orientation=vertical]:w-px data-[orientation=vertical]:h-full",
    "data-[orientation=vertical]:min-h-[var(--space-8)]",
  ],
  {
    variants: {
      tone: {
        /** Content rule between rows, sections and menu groups (.10). */
        default: "bg-rs-border-divider",
        /** Chrome hairline: sidebar/nav edges and table row rules (.08). */
        soft: "bg-rs-border-divider-soft",
        /** The composer's vertical split (rgba(255,190,140,.16)). */
        panel: "bg-rs-border-panel",
        /** Quiet control rule — the landing footer's vertical split (.22). */
        control: "bg-rs-border-control",
      },
    },
    defaultVariants: {
      tone: "default",
    },
  }
)

interface SeparatorProps
  extends Omit<
    React.ComponentProps<typeof SeparatorPrimitive.Root>,
    "orientation" | "decorative"
  > {
  /**
   * `"horizontal"` (default) draws a 1px rule across the container.
   * `"vertical"` draws a 1px column; it falls back to `h-full`, which collapses
   * to 0 in a content-height flex row, so give it the DS height explicitly —
   * `h-[var(--space-10)]` (22px, composer) or `h-[var(--space-8)]` (18px,
   * landing footer). Without one it renders at the 18px floor.
   */
  orientation?: "horizontal" | "vertical"
  /**
   * `true` (default) renders `role="none"` — right for the purely visual rules,
   * which is most of the DS. Pass `false` for a rule that is a real structural
   * break, so it maps to `role="separator"` + `aria-orientation`: the sidebar
   * footer hairline that splits the nav list from the `Nur für Betreiber` /
   * account footer (`Settings.jsx:265`, `Operator.jsx:120`) and the group rule
   * inside `role="menu"` (`ProfileMenu.jsx:9`, an ARIA menu separator).
   */
  decorative?: boolean
  /**
   * Which border token fills the rule. Mirrored onto `data-tone`, so overriding
   * the fill through `className` instead (`bg-…`) leaves `data-tone` reporting
   * the colour the element no longer has — pass the matching `tone` as well
   * whenever a `[data-tone=…]` selector or a DOM assertion has to stay honest.
   */
  tone?: "default" | "soft" | "panel" | "control"
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  tone = "default",
  ...props
}: SeparatorProps) {
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
export type { SeparatorProps }
