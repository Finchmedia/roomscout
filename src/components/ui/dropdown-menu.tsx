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
 * Additions on top of the shadcn API (all optional, defaults are the DS look):
 *   · `size` on Content/SubContent — "default" = DS 240px, "compact" = the
 *     stock shadcn 8rem for dense menus.
 *   · `description` on Label — renders the DS identity block's 12.5px muted
 *     second line under the name.
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

/**
 * The floating menu surface. `rsFadeUp` (keyframes in src/styles/tokens.css) is
 * the DS entry motion; the DS menu unmounts without an exit animation.
 */
const dropdownMenuContentVariants = cva(
  "z-50 flex flex-col gap-0.5 overflow-x-hidden overflow-y-auto rounded-card border border-rs-border-panel bg-rs-surface-menu p-2 text-rs-ink shadow-menu origin-(--radix-dropdown-menu-content-transform-origin) data-[state=open]:animate-[rsFadeUp_0.18s_ease_both]",
  {
    variants: {
      size: {
        default: "min-w-60",
        compact: "min-w-[8rem]",
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
  "relative flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2.5 text-[length:var(--text-body-sm-size)] transition-colors duration-(--duration-fast) ease-out-soft outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[17px]",
  {
    variants: {
      variant: {
        default:
          "text-rs-ink hover:bg-rs-surface-hover-soft focus:bg-rs-surface-hover-soft data-[state=open]:bg-rs-surface-hover-soft",
        destructive:
          "text-rs-red-text hover:bg-rs-red/15 focus:bg-rs-red/15 data-[state=open]:bg-rs-red/15",
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
          <CheckIcon className="size-4" />
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
          <CircleIcon className="size-2 fill-current" />
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

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-[length:var(--text-micro-size)] tracking-widest text-rs-ink-6",
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
      <ChevronRightIcon className="ml-auto size-4" />
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
