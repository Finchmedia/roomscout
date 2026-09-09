import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"

/**
 * Tabs — shadcn/ui primitive restyled to the RoomScout design system.
 *
 * DS reference:
 * - `design-system/ui_kits/roomscout-app/Settings.jsx` → `KnowledgePage` tablist
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §7.3 „Tabs" (Was dein Scout weiß)
 * - `docs/UI_PORT/COMPONENT_MAP.md` E10 · Tabs
 *
 * The DS ships exactly one tab treatment: an underline tablist with a bottom
 * hairline (`--rs-border-divider`), 44px triggers at 17px in muted ink
 * (`--rs-ink-4`), the active one in `--rs-orange-light` over a 2px
 * `--rs-orange` underline that sits on the hairline (`-mb-px`). That is the
 * `underline` variant and it is the default, so unmodified shadcn markup
 * renders in RoomScout's language. The shadcn `default` (pill) and `line`
 * variants are kept untouched for blocks that ask for them by name.
 *
 * `underline` is horizontal-only, matching the DS; use `default`/`line` for
 * `orientation="vertical"`.
 *
 * Value note: `SETTINGS_SCREENS.md` §7.3 / `TOKENS.md` record the prototype's
 * measured colours (inactive `#cbb9a8` = `--rs-ink-4`, active `#ff8a4e` =
 * `--rs-orange-light`); the `Settings.jsx` recreation simplifies them to
 * `--rs-ink-6` / `--rs-ink`. The measured prototype values win here.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
        /** DS: `display:flex;gap:6px;border-bottom:1px solid var(--rs-border-divider)`. */
        underline:
          "w-full justify-start gap-[var(--space-2)] rounded-none border-b border-b-rs-border-divider bg-transparent p-0 text-rs-ink-4 group-data-[orientation=horizontal]/tabs:h-auto",
      },
    },
    defaultVariants: {
      variant: "underline",
    },
  }
)

function TabsList({
  className,
  variant = "underline",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

/**
 * DS trigger styling, scoped to `TabsList variant="underline"` through the
 * `group/tabs-list` marker: `height:44px` (`--size-button-xs`), `padding:0 20px`
 * (`--space-9`), `font-size:17px` (`--text-body-lg-size`) at weight 400,
 * `border-bottom:2px solid transparent` pulled onto the list hairline with
 * `margin-bottom:-1px`, `transition:color .15s` (`--duration-fast`), and the
 * DS focus ring (2px `--rs-orange`, 2px offset). Every class is scoped and
 * state-qualified so it outranks the shadcn base rule it replaces instead of
 * relying on stylesheet order.
 */
const tabsTriggerUnderline =
  "group-data-[variant=underline]/tabs-list:h-[var(--size-button-xs)] group-data-[variant=underline]/tabs-list:flex-none group-data-[variant=underline]/tabs-list:-mb-px group-data-[variant=underline]/tabs-list:rounded-none group-data-[variant=underline]/tabs-list:border-x-0 group-data-[variant=underline]/tabs-list:border-t-0 group-data-[variant=underline]/tabs-list:border-b-2 group-data-[variant=underline]/tabs-list:bg-transparent group-data-[variant=underline]/tabs-list:px-[var(--space-9)] group-data-[variant=underline]/tabs-list:py-0 group-data-[variant=underline]/tabs-list:text-[length:var(--text-body-lg-size)] group-data-[variant=underline]/tabs-list:leading-none group-data-[variant=underline]/tabs-list:font-normal group-data-[variant=underline]/tabs-list:text-rs-ink-4 group-data-[variant=underline]/tabs-list:transition-colors group-data-[variant=underline]/tabs-list:duration-[var(--duration-fast)] group-data-[variant=underline]/tabs-list:focus-visible:ring-0 group-data-[variant=underline]/tabs-list:focus-visible:outline-2 group-data-[variant=underline]/tabs-list:focus-visible:outline-offset-2 group-data-[variant=underline]/tabs-list:focus-visible:outline-rs-orange group-data-[variant=underline]/tabs-list:data-[state=inactive]:border-b-transparent group-data-[variant=underline]/tabs-list:data-[state=inactive]:hover:text-rs-ink group-data-[variant=underline]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=underline]/tabs-list:data-[state=active]:border-b-rs-orange group-data-[variant=underline]/tabs-list:data-[state=active]:text-rs-orange-light"

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "data-[state=active]:bg-background data-[state=active]:text-foreground dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 dark:data-[state=active]:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        tabsTriggerUnderline,
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

// `tabsListVariants` is part of the shadcn public API (blocks import it to
// compose their own lists); the cva() call is not a plain constant, so the
// react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
