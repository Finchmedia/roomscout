import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { MoreHorizontal } from "lucide-react"
import { Slot } from "radix-ui"

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
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §1 port delta + §16 assembly summary
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
 * - 15px (`--text-body-sm-size`) Geist, the DS body-small step, on the warm ink
 *   ladder — ancestors `--rs-ink-4`, current page `--rs-ink` (readme: text is
 *   warm white stepping down through beige/taupe, never neutral grey).
 * - Hover lightens the link to `--rs-ink` over `--duration-fast`, the DS ghost
 *   hover; focus is the global DS ring (`outline:2px solid #ff6926` at 2px
 *   offset, TOKENS.md F17) instead of shadcn's soft `ring-ring/50`.
 * - The separator is the prototype's own `chevron-right`
 *   (`design-system/components/core/icon/Icon.jsx`, path `M9 6l6 6-6 6`) at 14×14
 *   in `--rs-ink-6`, not lucide's — the DS ships its own glyph set. Its stroke is
 *   2.2 (readme: "2–2.2 for chevrons/checks"); the prototype's in-flow 14×14
 *   chevrons use 2, so this is the heavier end of the DS range, chosen because a
 *   separator has to read as a mark rather than as text.
 * - `--space-*` / `--radius-chip` / `--size-button-2xs` (36px) replace the raw
 *   Tailwind spacing steps; no raw hex, px or shadow values anywhere.
 *
 * Deliberate deviations:
 * - Default a11y copy is German (`aria-label="Navigationspfad"`, ellipsis
 *   `Mehr`), per the DS "German only" rule; both remain overridable via props.
 * - The ellipsis keeps lucide's `MoreHorizontal` — the DS's 40-glyph set has no
 *   ellipsis, and lucide's three `currentColor` dots match its stroke look.
 *
 * The exports stay exactly shadcn's seven parts: `breadcrumbListVariants` is
 * module-internal (upstream ships no cva here, and exporting a non-component
 * would trip `react-refresh/only-export-components`); the `size` prop is the
 * public surface.
 *
 * The shadcn public API (the seven parts, `BreadcrumbLink asChild`, children as
 * a custom separator glyph — e.g. `<BreadcrumbSeparator>/</BreadcrumbSeparator>`
 * for the `Einstellungen / …` spelling) and every `data-slot` are untouched, so
 * installed shadcn blocks keep working.
 */

/**
 * DS: `flex-wrap` row of 15px links on the muted ink step, 6px gap tightening
 * the DS `--space-*` scale (10px from the `sm` breakpoint up).
 * `size="sm"` is the `< 900px` header step (14px caption, SETTINGS_SCREENS §15
 * shrinks the shell's type below 900px).
 */
const breadcrumbListVariants = cva(
  "flex flex-wrap items-center gap-[var(--space-2)] font-normal break-words text-rs-ink-4 sm:gap-[var(--space-4)]",
  {
    variants: {
      size: {
        default: "text-[length:var(--text-body-sm-size)]",
        sm: "text-[length:var(--text-caption-size)]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

/** The prototype's `chevron-right` glyph, drawn inline like every DS icon. */
function BreadcrumbChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}

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
 * (`.15s` = `--duration-fast`), with the global DS focus ring.
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
        "rounded-chip text-rs-ink-4 transition-colors duration-[var(--duration-fast)] hover:text-rs-ink focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
        className
      )}
      {...props}
    />
  )
}

/** DS: the current page is the one item on full ink (`--rs-ink`), weight 400. */
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-rs-ink", className)}
      {...props}
    />
  )
}

/**
 * DS: 14×14 `chevron-right` at stroke 2.2 on the muted ink step (`--rs-ink-6`).
 * Pass children to swap the glyph (the docs also spell the trail with `/`).
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
      {children ?? <BreadcrumbChevronIcon />}
    </li>
  )
}

/** DS: 36px hit area (`--size-button-2xs`, the DS's smallest round control). */
function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "flex size-[var(--size-button-2xs)] items-center justify-center rounded-circle text-rs-ink-6",
        className
      )}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">Mehr</span>
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
}
