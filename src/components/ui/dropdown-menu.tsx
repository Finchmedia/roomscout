"use client"

/**
 * DropdownMenu — shadcn/ui primitive restyled to the RoomScout design system.
 *
 * DS reference:
 *   design-system/components/navigation/profile-menu/ProfileMenu.jsx
 *   design-system/components/navigation/profile-menu/ProfileMenu.d.ts
 *   design-system/components/navigation/profile-menu/profile-menu.card.html
 *   docs/UI_PORT/SCOUT_SCREENS.md §2.4.3 (Avatar button + profile menu)
 *
 * The DS ships the profile dropdown as a single `ProfileMenu` block; here it is
 * decomposed onto the Radix parts so the shadcn API (and every shadcn block
 * built on it, e.g. sidebar-13) keeps working:
 *
 *   <DropdownMenuContent align="end">
 *     <DropdownMenuLabel description="Persönlicher Bereich">Herzbuben</DropdownMenuLabel>
 *     <DropdownMenuSeparator />
 *     <DropdownMenuItem><Icon name="sliders" />Einstellungen</DropdownMenuItem>
 *   </DropdownMenuContent>
 *
 * DS surface: min-width 240 · padding 8 · radius 16 (--radius-card) ·
 * --rs-surface-menu on --rs-border-panel · --shadow-menu · rsFadeUp .18s.
 * DS row: 15px ink · 10/12 padding · radius 10 (--radius-control) · gap 10 ·
 * hover --rs-surface-hover-soft. Icons inherit the ink colour (17px), they are
 * not muted like in stock shadcn.
 *
 * Glyphs come from `@/components/ui/icon` (the DS stroke set), never from
 * lucide — readme.md § Iconography: "No icon font, no CDN set."
 *
 * Additions on top of the shadcn API (all optional, defaults are the DS look):
 *   · `size` on Content/SubContent — "default" = DS 240px, "compact" (alias
 *     "sm", the shadcn size name, so installed blocks keep compiling) = the
 *     stock shadcn 8rem for dense menus.
 *   · `description` on Label — renders the DS identity block's 12.5px muted
 *     second line under the name.
 *
 * Sizing a glyph: rows force DS 17px onto every `<svg>` that has no `size-*`
 * class, and that CSS wins over the width/height attributes `<Icon size>`
 * renders. To use another size, pass a class — `<Icon className="size-5" />`,
 * not `<Icon size={20} />`.
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Icon } from "@/components/ui/icon"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

/**
 * The floating menu surface. `rsFadeUp` (keyframes in src/styles/tokens.css) is
 * the DS entry motion; the DS menu unmounts without an exit animation.
 */
const dropdownMenuContentVariants = cva(
  [
    "z-50 flex flex-col gap-0.5 overflow-x-hidden overflow-y-auto",
    "rounded-card border border-rs-border-panel bg-rs-surface-menu p-2 shadow-menu",
    // The surface is portaled to document.body, so it carries its own font
    // instead of borrowing one from the trigger's context — ProfileMenu.jsx:7
    // sets `fontFamily: var(--font-sans)`, and tooltip.tsx/sheet.tsx do the same.
    "font-sans text-rs-ink",
    "origin-(--radix-dropdown-menu-content-transform-origin)",
    // ProfileMenu.jsx:7 applies `animation: rsFadeUp .18s ease both`
    // unconditionally, so this stays ungated — a `forceMount` Content animates
    // like any other. .18s has no duration token (--duration-fast is .15s,
    // --duration-quick .2s) and the `animate-rs-fade-up` utility is the .3s
    // content entry, so the literal below is deliberate: do not "tokenise" it.
    "animate-[rsFadeUp_0.18s_ease_both]",
  ].join(" "),
  {
    variants: {
      size: {
        default: "min-w-60",
        compact: "min-w-32",
        /** shadcn size name — alias of `compact`, so installed blocks type-check. */
        sm: "min-w-32",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

/**
 * A selectable row: DS item geometry, shared by Item, CheckboxItem, RadioItem
 * and SubTrigger so every row in a menu lands on the same rhythm.
 */
const dropdownMenuItemVariants = cva(
  [
    "relative flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5",
    "text-[length:var(--text-body-sm-size)]",
    // ProfileMenu.jsx:11 swaps the row background from React state with no
    // transition; the fingerprint for a ghost hover in the prototype is
    // TOKENS.md A13 `transition: background .15s` (= --duration-fast), and
    // ease-out-soft is what every hover in this folder uses.
    "transition-colors duration-(--duration-fast) ease-out-soft",
    // DS focus ring: 2px solid orange, 2px offset (readme.md § Hover/Press,
    // TOKENS.md F17) — the .07 white wash alone is no visible focus state.
    // Radix focuses rows on pointermove, so `focus-visible:` stays invisible
    // for mouse users and only shows up for keyboard navigation.
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
    // DS rows carry 17px glyphs (SCOUT_SCREENS §2.4.3). This beats `<Icon size>`
    // (a presentation attribute); override with a `size-*` class instead.
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[17px]",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "text-rs-ink hover:bg-rs-surface-hover-soft focus:bg-rs-surface-hover-soft data-[state=open]:bg-rs-surface-hover-soft",
        // The DS menu has exactly one row-hover surface and there is no
        // red-tint surface token, so a destructive row carries its meaning in
        // the ink (--rs-red-text) and keeps the DS hover wash.
        destructive:
          "text-rs-red-text hover:bg-rs-surface-hover-soft focus:bg-rs-surface-hover-soft data-[state=open]:bg-rs-surface-hover-soft",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  // DS gap between the 42px avatar button and the menu (SCOUT_SCREENS §2.4.3:
  // wrapper is 42px tall, panel sits at top:52px) — --space-4.
  // The DS screen recreation disagrees: ui_kits/roomscout-app/App.jsx:92
  // positions the menu from the app root (top 66 desktop / 56 narrow under an
  // 84/64 header), which works out to a ~3px gap. The extracted prototype spec
  // is the more literal source, so 10 stays.
  sideOffset = 10,
  size = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content> &
  VariantProps<typeof dropdownMenuContentVariants>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        data-size={size}
        sideOffset={sideOffset}
        className={cn(
          "max-h-(--radix-dropdown-menu-content-available-height)",
          dropdownMenuContentVariants({ size, className })
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> &
  VariantProps<typeof dropdownMenuItemVariants> & {
    inset?: boolean
  }) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        dropdownMenuItemVariants({ variant }),
        "data-[inset]:pl-9",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        dropdownMenuItemVariants(),
        "py-2.5 pr-3 pl-9",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-3 flex size-[17px] items-center justify-center text-rs-orange-light">
        <DropdownMenuPrimitive.ItemIndicator>
          {/* DS check glyph (stroke 2.2); the row rule sizes it to 17px. */}
          <Icon name="check" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        dropdownMenuItemVariants(),
        "py-2.5 pr-3 pl-9",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-3 flex size-[17px] items-center justify-center text-rs-orange-light">
        <DropdownMenuPrimitive.ItemIndicator>
          {/* The DS icon set has no dot glyph — the marker is a plain circle. */}
          <span className="block size-2 rounded-circle bg-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

/**
 * DS identity block: 15px/500 name plus an optional 12.5px muted line
 * ("Persönlicher Bereich"). Without `description` it is the plain menu label.
 */
function DropdownMenuLabel({
  className,
  inset,
  description,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
  description?: React.ReactNode
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-3 pt-2.5 pb-2 text-[length:var(--text-body-sm-size)] font-medium text-rs-ink data-[inset]:pl-9",
        className
      )}
      {...props}
    >
      {children}
      {description === undefined ? null : (
        <span
          data-slot="dropdown-menu-label-description"
          className="block text-[length:var(--text-micro-size)] font-normal text-rs-ink-6"
        >
          {description}
        </span>
      )}
    </DropdownMenuPrimitive.Label>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(
        "mx-1 mt-0.5 mb-1.5 h-px bg-rs-border-divider",
        className
      )}
      {...props}
    />
  )
}

/**
 * Keyboard-shortcut hint — shadcn parity only. The prototype has no keyboard
 * shortcuts anywhere (SCOUT_SCREENS §2.4.3 lists none), so there is no DS spec
 * for this affordance; it borrows the DS micro size, the overline tracking and
 * the muted ink so a shadcn block that uses it still reads as RoomScout.
 */
function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-[length:var(--text-micro-size)] tracking-[var(--text-overline-tracking)] text-rs-ink-6",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(dropdownMenuItemVariants(), "data-[inset]:pl-9", className)}
      {...props}
    >
      {children}
      {/* DS chevron glyph (stroke 2); the row rule sizes it to 17px. */}
      <Icon name="chevron-right" className="ml-auto" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  size = "compact",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent> &
  VariantProps<typeof dropdownMenuContentVariants>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      data-size={size}
      className={cn(dropdownMenuContentVariants({ size, className }))}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}

// Exported like every other cva in this folder (buttonVariants, badgeVariants,
// noticeVariants) so a consumer — an installed shadcn block, a later src/ui
// screen — can put the DS surface or row geometry on a non-Radix element.
// The cva() calls are not plain constants, so the react-refresh rule cannot
// see them as such.
// eslint-disable-next-line react-refresh/only-export-components
export { dropdownMenuContentVariants, dropdownMenuItemVariants }
