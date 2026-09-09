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
 * There is **no** `design-system/components/**` spec for tabs (the DS ships none
 * — `navigation/` has accordion, app-header, nav-item, profile-menu only), so
 * the variant name `underline` and the absence of a size ladder come from
 * `docs/UI_PORT`, not from a component contract. Nothing here was compared
 * against a `Tabs.d.ts`, because none exists.
 *
 * The DS ships exactly one tab treatment: an underline tablist with a bottom
 * hairline (`--rs-border-divider`), 44px triggers at 17px in muted ink
 * (`--rs-ink-4`), the active one in `--rs-orange-light` over a 2px
 * `--rs-orange` underline that sits on the hairline (`-mb-px`). That is the
 * `underline` variant and it is the default, so unmodified shadcn markup
 * renders in RoomScout's language.
 *
 * Variant cascade (the `Accordion` pattern in this folder): `Tabs` provides the
 * variant through context, `TabsList` may override it, and `TabsTrigger`
 * inherits from the list — every part also takes an explicit `variant` prop.
 * Each part therefore emits **plain, unprefixed** utilities from its own cva
 * slot instead of the `group-data-[variant=…]/tabs-list:` modifier chain the
 * upstream file uses, which means `tailwind-merge` inside `cn()` can see a
 * caller's `className` as conflicting and the shadcn escape hatch actually
 * works (`<TabsTrigger className="px-[var(--space-5)]">` now wins).
 * A block that composes a raw `TabsPrimitive.List` from the exported
 * `tabsListVariants` gets no context: pass `variant` to each `TabsTrigger` (or
 * wrap in `TabsList`), otherwise the triggers fall back to the default.
 *
 * `underline` is horizontal-only, matching the DS. `orientation="vertical"`
 * therefore resolves the list (and its triggers) to `line` automatically, so
 * the default variant can never produce the broken column-with-a-bottom-border
 * case.
 *
 * Accessible name: Radix emits `role="tablist"` and nothing else. Call sites
 * **must** pass `aria-label` to `TabsList` (the knowledge surface sits next to
 * the settings sidebar nav); no default is shipped because the name is
 * content-specific — unlike `Breadcrumb`, a tablist has no generic German
 * label.
 *
 * Value notes (three sources disagree; recorded so the next reader does not
 * have to rediscover it):
 * - Colours: `SETTINGS_SCREENS.md` §7.3 / `COMPONENT_MAP.md` E10 / `TOKENS.md`
 *   §A2b record the prototype's measured values (inactive `#cbb9a8` =
 *   `--rs-ink-4`, active `#ff8a4e` = `--rs-orange-light`, underline `#ff6926` =
 *   `--rs-orange`). The `Settings.jsx` recreation simplifies the text to
 *   `--rs-ink` / `--rs-ink-6`, and the port brief said the active text is
 *   `--rs-orange`. The measured prototype values win (two documents agree, and
 *   `TOKENS.md` §0.3 names `--accent-link #ff8a4e` "active tab color"); the
 *   2px `--rs-orange` underline is identical in all three.
 * - Size: 17px (`--text-body-lg-size`) per §7.3, E10 and `Settings.jsx:117`;
 *   the port brief said 16px. The three DS/doc sources win.
 * - The prototype defines exactly two trigger colours and **no** hover state
 *   (`transition:color .15s` covers the active/inactive switch). An earlier
 *   port added `hover:text-rs-ink`, which made a hovered inactive tab brighter
 *   than the active one; it is removed.
 *
 * The retained shadcn `default` (pill) and `line` variants are a **compatibility
 * shim** for installed blocks that ask for them by name. They are off-spec: the
 * DS has no pill or line tablist, so they keep upstream's raw Tailwind steps
 * (`p-[3px]`, `text-sm`, `after:bottom-[-5px]`, …) rather than inventing DS
 * values. Three deliberate deltas from upstream:
 * - `dark:` utilities are dropped. `app.css` defines `dark` as `&:is(.dark *)`
 *   and nothing ever sets that class (single dark theme on bare `:root`), so
 *   they were dead code — and this is the only file in `components/ui` that
 *   carried any.
 * - The DS focus ring (2px `--rs-orange`, 2px offset — `readme.md`) is applied
 *   to *all* variants from the shared base, replacing upstream's
 *   `focus-visible:ring-[3px]` halo. The DS ring is a system-wide rule.
 * - The active pill's `shadow-sm` is dropped: it is a Tailwind default shadow,
 *   and the project forbids ad-hoc shadows outside the `--shadow-*` ladder.
 *
 * The segmented control (`SETTINGS_SCREENS.md` §9.3, "Kanal") is deliberately
 * **not** a variant here: §9.3 spells it `role="radiogroup"` / `role="radio"`,
 * so `RadioGroup` / `ToggleGroup` is its semantically correct home, even though
 * §16 lists `Tabs` as a candidate. Building it as a tablist would ship the
 * wrong role.
 *
 * Root spacing: the prototype has no wrapper element — the tablist and the
 * content below it are siblings, and the 22px offset (`--space-10`) belongs to
 * the content (§7.3, `Settings.jsx:118`). The `underline` root therefore adds
 * no gap; `default`/`line` keep upstream's 8px, expressed as `--space-3`.
 *
 * The Radix API (`value` / `defaultValue`, `onValueChange`, `orientation`,
 * `activationMode`, …) and the shadcn `data-slot` / `data-variant` hooks are
 * untouched, so installed shadcn blocks keep working.
 */

type TabsVariant = "default" | "line" | "underline"
type TabsOrientation = "horizontal" | "vertical"

/** Single source of truth for the default, shared by the cvas and the parts. */
const TABS_DEFAULT_VARIANT: TabsVariant = "underline"

const TabsVariantContext = React.createContext<TabsVariant>(TABS_DEFAULT_VARIANT)
const TabsOrientationContext =
  React.createContext<TabsOrientation>("horizontal")

/** Resolves the variant of a sub-part: explicit prop first, then the Root's. */
function useTabsVariant(override?: TabsVariant | null): TabsVariant {
  const inherited = React.useContext(TabsVariantContext)
  return override ?? inherited
}

/**
 * DS: no wrapper at all — the 22px below the tablist is the content's margin,
 * so `underline` contributes no gap. `default`/`line` keep upstream's 8px.
 */
const tabsVariants = cva(
  "group/tabs flex data-[orientation=horizontal]:flex-col",
  {
    variants: {
      variant: {
        default: "gap-[var(--space-3)]",
        line: "gap-[var(--space-3)]",
        underline: "gap-0",
      },
    },
    defaultVariants: {
      variant: TABS_DEFAULT_VARIANT,
    },
  }
)

type TabsProps = React.ComponentProps<typeof TabsPrimitive.Root> &
  VariantProps<typeof tabsVariants>

function Tabs({
  className,
  variant,
  orientation = "horizontal",
  ...props
}: TabsProps) {
  const resolved: TabsVariant = variant ?? TABS_DEFAULT_VARIANT

  return (
    <TabsOrientationContext.Provider value={orientation}>
      <TabsVariantContext.Provider value={resolved}>
        <TabsPrimitive.Root
          data-slot="tabs"
          orientation={orientation}
          className={cn(tabsVariants({ variant: resolved }), className)}
          {...props}
        />
      </TabsVariantContext.Provider>
    </TabsOrientationContext.Provider>
  )
}

/**
 * DS tablist: `display:flex;gap:6px;border-bottom:1px solid
 * var(--rs-border-divider)` — full width, so the hairline spans the column.
 */
const tabsListVariants = cva("group/tabs-list", {
  variants: {
    variant: {
      default:
        "inline-flex w-fit items-center justify-center rounded-lg bg-muted p-[3px] text-muted-foreground",
      line: "inline-flex w-fit items-center justify-center gap-1 rounded-none bg-transparent p-[3px] text-muted-foreground",
      underline:
        "flex w-full items-center justify-start gap-[var(--space-2)] rounded-none border-b border-b-rs-border-divider bg-transparent",
    },
    orientation: {
      horizontal: "",
      vertical: "h-fit flex-col",
    },
  },
  compoundVariants: [
    {
      variant: ["default", "line"],
      orientation: "horizontal",
      // upstream `h-9`; 36px is on the DS scale as `--size-button-2xs`.
      class: "h-[var(--size-button-2xs)]",
    },
  ],
  defaultVariants: {
    variant: TABS_DEFAULT_VARIANT,
    orientation: "horizontal",
  },
})

type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List> &
  Pick<VariantProps<typeof tabsListVariants>, "variant">

/** Pass `aria-label` — Radix gives `role="tablist"` no accessible name. */
function TabsList({ className, variant, ...props }: TabsListProps) {
  const orientation = React.useContext(TabsOrientationContext)
  const requested = useTabsVariant(variant)
  // `underline` is the DS's horizontal-only treatment; a vertical list would
  // render a column carrying a bottom hairline, so fall back to `line`.
  const resolved: TabsVariant =
    requested === "underline" && orientation === "vertical" ? "line" : requested

  return (
    <TabsVariantContext.Provider value={resolved}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={resolved}
        className={cn(
          tabsListVariants({ variant: resolved, orientation }),
          className
        )}
        {...props}
      />
    </TabsVariantContext.Provider>
  )
}

/**
 * DS trigger: `height:44px` (`--size-button-xs`), `padding:0 20px`
 * (`--space-9`), `font:inherit` + `font-size:17px` (`--text-body-lg-size`) at
 * weight 400 on the inherited body leading, `cursor:pointer`,
 * `border-bottom:2px solid transparent` pulled onto the list hairline with
 * `margin-bottom:-1px`, and `transition:color .15s` (`--duration-fast`).
 * Active: `--rs-orange-light` text over an `--rs-orange` underline.
 */
const tabsTriggerVariants = cva(
  [
    "relative inline-flex cursor-pointer items-center justify-center whitespace-nowrap",
    // DS focus ring: 2px orange outline, 2px offset (readme.md).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "h-[calc(100%-1px)] flex-1 gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium text-foreground/60 transition-all hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground [&_svg:not([class*='size-'])]:size-4",
        line: "h-[calc(100%-1px)] flex-1 gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-foreground/60 transition-all after:absolute after:bg-foreground after:opacity-0 after:transition-opacity hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:opacity-100 [&_svg:not([class*='size-'])]:size-4",
        underline:
          "-mb-px h-[var(--size-button-xs)] rounded-none border-b-2 border-b-transparent bg-transparent px-[var(--space-9)] py-0 text-[length:var(--text-body-lg-size)] leading-[var(--text-body-leading)] font-normal text-rs-ink-4 transition-colors duration-[var(--duration-fast)] data-[state=active]:border-b-rs-orange data-[state=active]:bg-transparent data-[state=active]:text-rs-orange-light",
      },
      orientation: {
        horizontal: "",
        vertical: "w-full justify-start",
      },
    },
    compoundVariants: [
      {
        variant: "line",
        orientation: "horizontal",
        class: "after:inset-x-0 after:bottom-[-5px] after:h-0.5",
      },
      {
        variant: "line",
        orientation: "vertical",
        class: "after:inset-y-0 after:-right-1 after:w-0.5",
      },
    ],
    defaultVariants: {
      variant: TABS_DEFAULT_VARIANT,
      orientation: "horizontal",
    },
  }
)

type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger> &
  Pick<VariantProps<typeof tabsTriggerVariants>, "variant">

function TabsTrigger({ className, variant, ...props }: TabsTriggerProps) {
  const orientation = React.useContext(TabsOrientationContext)
  const resolved = useTabsVariant(variant)

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      data-variant={resolved}
      className={cn(
        tabsTriggerVariants({ variant: resolved, orientation }),
        className
      )}
      {...props}
    />
  )
}

/**
 * Radix puts `tabIndex={0}` on the active panel, so Tab from the tablist lands
 * here: the DS focus ring replaces the stripped outline (WCAG 2.4.7).
 */
function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "flex-1 outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
        className
      )}
      {...props}
    />
  )
}

// `tabsListVariants` is part of the shadcn public API (blocks import it to
// compose their own lists); the cva() call is not a plain constant, so the
// react-refresh rule cannot see it as one.
// eslint-disable-next-line react-refresh/only-export-components
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
