import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { MoreHorizontal } from "lucide-react"
import { Slot } from "radix-ui"

import { Icon } from "@/components/ui/icon"

/**
 * Breadcrumb — shadcn/ui primitive restyled to the RoomScout design system.
 *
 * DS reference:
 * - `design-system/readme.md` → "Content fundamentals" (German, sentence case,
 *   no emoji), "Visual foundations · Type" (Geist, body 15–17px, captions 14px),
 *   "Visual foundations · Color" (warm ink ladder, never neutral grey),
 *   "Hover" (ghost text lightens, focus = 2px orange outline at 2px offset),
 *   "Iconography" (own inline stroke SVGs, 24×24 viewBox, stroke 2–2.2 for
 *   chevrons, round caps/joins, `currentColor`)
 * - `docs/UI_PORT/COMPONENT_MAP.md` D10 · Sidebar shell (`sidebar-13`)
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §1 port delta + §15/§16 assembly summary
 * - `docs/UI_PORT/OPERATOR_SCREENS.md` §16 `sidebar-13` mapping plan
 *
 * The prototype has **no** breadcrumb: it is a port addition that comes in with
 * the `sidebar-13` shell, where it labels the Settings and Operator dialogs —
 * `Einstellungen / {PAGES[page]}` and `Betrieb / {PAGES[page]}`, always the nav
 * label, never the h1 (COMPONENT_MAP D10). There is therefore no DS component
 * spec to mirror, only the DS type/colour/icon rules, and no variant ladder:
 * one treatment, plus a `size` for the narrow header.
 *
 * The RoomScout treatment:
 * - 15px (`--text-body-sm-size`) Geist, the DS body-small step, stepping down to
 *   the 14px caption below 900px — the width at which SETTINGS_SCREENS §15
 *   shrinks the whole shell (padding, h1, lead). `size="sm"` pins the caption
 *   step regardless of viewport, for a header that is narrow without the window
 *   being narrow. The gap follows the same 900px boundary, so the component has
 *   exactly one breakpoint (upstream's inherited Tailwind `sm` = 640px was a
 *   third, unrelated number).
 * - Warm ink ladder — ancestors `--rs-ink-4`, current page `--rs-ink` (readme:
 *   text is warm white stepping down through beige/taupe, never neutral grey).
 * - Hover lightens the link to `--rs-ink` over `--duration-fast` on
 *   `--ease-out-soft`, the DS ghost hover; focus is the global DS ring
 *   (`outline: 2px solid #ff6926` at 2px offset, TOKENS.md F17) instead of
 *   shadcn's soft `ring-ring/50`.
 * - The separator is the prototype's own `chevron-right` glyph, rendered
 *   through `Icon` (the shared registry, `design-system/components/core/icon/`)
 *   at 14×14 in `--rs-ink-6` — same 24×24 viewBox, same `M9 6l6 6-6 6`, same
 *   registry stroke 2, and it cannot drift away from the DS the way a second
 *   hand-drawn copy of the path could.
 * - `--space-*` / `--radius-chip` / `--size-button-2xs` (36px) replace the raw
 *   Tailwind spacing steps; no raw hex, px or shadow values anywhere.
 *
 * **Why `!` on the link's colour and focus ring.** `src/styles/app.css` still
 * ships its legacy base block *unlayered* — `a { color: var(--signal) }`,
 * `a:hover { color: var(--signal-hover) }` and `a:focus-visible { outline: 2px
 * solid var(--signal); outline-offset: 3px }`. Tailwind emits every utility
 * inside `@layer utilities`, and per cascade-layer semantics an unlayered
 * declaration beats *any* layered one regardless of specificity, so the plain
 * utilities lost: a `<BreadcrumbLink href>` rendered in RoomScout orange rather
 * than on the ink ladder, and focused at 3px offset instead of the DS's 2px.
 * `!important` is the one thing a layered utility can win with — the same
 * defence `input.tsx` and `sonner.tsx` already carry. When that legacy block
 * moves into `@layer base`, every `!` in this file can go.
 *
 * Deliberate deviations:
 * - Default a11y copy is German (`aria-label="Navigationspfad"`, ellipsis
 *   `label="Mehr"`), per the DS "German only" rule; both remain overridable via
 *   props.
 * - The ellipsis keeps lucide's `MoreHorizontal` — the DS's 42-glyph set has no
 *   ellipsis, and lucide's three `currentColor` dots match its stroke look.
 * - `BreadcrumbPage` drops upstream's `role="link" aria-disabled="true"`: the
 *   WAI-ARIA APG breadcrumb pattern marks the current item with
 *   `aria-current="page"` alone, and a non-focusable, href-less "link" is a
 *   false affordance. PanelDialog renders every Settings/Operator page label
 *   through this part, so it is on the hot path.
 *
 * The shadcn public API (the seven parts, `BreadcrumbLink asChild`, children as
 * a custom separator glyph — e.g. `<BreadcrumbSeparator>/</BreadcrumbSeparator>`
 * for the `Einstellungen / …` spelling) and every `data-slot` are untouched, so
 * installed shadcn blocks keep working; `breadcrumbListVariants` is exported
 * next to the component like every other cva-bearing primitive here
 * (`button.tsx`, `badge.tsx`, `summary-pill.tsx`).
 */

/**
 * DS: `flex-wrap` row of links on the muted ink step. One breakpoint, 900px
 * (SETTINGS_SCREENS §15): below it the caption step and the 6px gap, at and
 * above it the 15px body-small step and the 10px gap. `size="sm"` pins the
 * caption step at every width.
 */
const breadcrumbListVariants = cva(
  "flex flex-wrap items-center gap-[var(--space-2)] font-normal break-words text-rs-ink-4 min-[900px]:gap-[var(--space-4)]",
  {
    variants: {
      size: {
        default:
          "text-[length:var(--text-caption-size)] min-[900px]:text-[length:var(--text-body-sm-size)]",
        sm: "text-[length:var(--text-caption-size)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

/** The separator glyph step in px; `[&>svg]:size-3.5` mirrors it for custom children. */
const SEPARATOR_ICON_SIZE = 14

function Breadcrumb({ ...props }: React.ComponentProps<"nav">) {
  return <nav aria-label="Navigationspfad" data-slot="breadcrumb" {...props} />
}

type BreadcrumbListProps = React.ComponentProps<"ol"> &
  VariantProps<typeof breadcrumbListVariants>

function BreadcrumbList({ className, size, ...props }: BreadcrumbListProps) {
  const resolved = size ?? "default"

  return (
    <ol
      data-slot="breadcrumb-list"
      data-size={resolved}
      className={cn(breadcrumbListVariants({ size: resolved }), className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn(
        "inline-flex items-center gap-[var(--space-2)]",
        className
      )}
      {...props}
    />
  )
}

/**
 * DS: ancestor link on `--rs-ink-4`, lightening to `--rs-ink` on hover
 * (`.15s` = `--duration-fast`, `--ease-out-soft`), with the global DS focus
 * ring. The `!` utilities defeat the unlayered legacy `a` rules — see the file
 * header; `outline-solid` re-arms `--tw-outline-style`, which `outline-none`
 * clears.
 */
function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        "rounded-chip text-rs-ink-4! transition-colors duration-(--duration-fast) ease-out-soft hover:text-rs-ink!",
        "outline-none focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-rs-orange!",
        className
      )}
      {...props}
    />
  )
}

/**
 * DS: the current page is the one item on full ink (`--rs-ink`), weight 400.
 * APG marks it with `aria-current="page"` and nothing else.
 */
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn("font-normal text-rs-ink", className)}
      {...props}
    />
  )
}

/**
 * DS: 14×14 `chevron-right` from the shared glyph registry (stroke 2) on the
 * muted ink step (`--rs-ink-6`). Pass children to swap the glyph — the Settings
 * trail is spelled with a literal `/` in SETTINGS_SCREENS §1 / COMPONENT_MAP
 * D10, the Operator trail with the chevron (OPERATOR_SCREENS §16), so the
 * spelling stays a call-site decision.
 */
function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "flex items-center text-rs-ink-6 [&>svg]:size-3.5",
        className
      )}
      {...props}
    >
      {children ?? (
        <Icon name="chevron-right" size={SEPARATOR_ICON_SIZE} />
      )}
    </li>
  )
}

/**
 * The collapsed-trail marker. shadcn wraps it in a `DropdownMenuTrigger`, so
 * the wrapper must stay reachable by AT: only the glyph is `aria-hidden`, and
 * `label` is the trigger's accessible name (upstream nests the `sr-only` text
 * inside an `aria-hidden` node, where it is suppressed along with the icon).
 * The 36px `--size-button-2xs` box is the trigger's hit area and carries the DS
 * ghost-hover fill, so the circle radius reads; the focus ring belongs to the
 * wrapping trigger, which is the focusable element.
 */
function BreadcrumbEllipsis({
  className,
  label = "Mehr",
  ...props
}: React.ComponentProps<"span"> & {
  /** Accessible name of the collapsed-trail control (German per the DS). */
  label?: string
}) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      className={cn(
        "flex size-[var(--size-button-2xs)] items-center justify-center rounded-circle text-rs-ink-6",
        "transition-colors duration-(--duration-fast) ease-out-soft hover:bg-rs-surface-hover-soft",
        className
      )}
      {...props}
    >
      <MoreHorizontal className="size-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
  // `breadcrumbListVariants` is part of the shadcn public API (a shell can put
  // the trail's type/gap ladder on an existing list); the cva() call is not a
  // plain constant, so the react-refresh rule cannot see it as one.
  // eslint-disable-next-line react-refresh/only-export-components
  breadcrumbListVariants,
}
export type { BreadcrumbListProps }
