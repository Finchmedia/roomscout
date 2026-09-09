import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { PanelLeftIcon } from "lucide-react"
import { Slot } from "radix-ui"

import { useIsMobile } from "@/hooks/use-mobile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/**
 * Sidebar — the shadcn/ui sidebar family restyled to the RoomScout design system.
 *
 * DS spec:
 * - `design-system/components/navigation/nav-item/NavItem.jsx` — the menu row:
 *   50px tall (`--size-nav-item`), 12px radius (`--radius-control-lg`), 16px ink,
 *   icon + label, `current` = warm fill + warm border + orange-light icon.
 * - `design-system/components/navigation/nav-item/NavItem.jsx` → `NavGroupLabel`
 *   — the group label: `.14em`, uppercase, `--rs-ink-6`, weight **400** (the
 *   JSX declares no `fontWeight`; the DS `Overline` is 400 in its muted tone),
 *   inset `28px 10px 10px`. The **first** label of a column is inset
 *   `34px 10px 10px` (`Settings.jsx:260`, SETTINGS_SCREENS §2.3,
 *   OPERATOR_SCREENS §4.3) — that is `spacing="lead"`.
 * - `design-system/ui_kits/roomscout-app/Settings.jsx` (sidebar column) — the nav
 *   itself: `296px` track (`--width-settings-nav`), padding `36px 26px 30px`,
 *   right hairline `--rs-border-divider-soft` (`.08` — the chrome level, not the
 *   content one; TOKENS.md F8 and `--sidebar-border` in `tokens.css`),
 *   "Zurück zum Scout" ghost row on top, two labelled groups, spacer, divider
 *   (`24px 0 20px`, `.10`), footer name + "Persönlicher Bereich".
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §2 (§2.1 back row, §2.3/§2.5 group labels,
 *   §2.4 item states, §2.6 footer) and `docs/UI_PORT/OPERATOR_SCREENS.md` §4.
 *
 * Deliberate deviations from the prototype, per the port brief:
 * - The active row is the **orange tint** (`--rs-surface-accent-tint` +
 *   `--rs-border-accent-soft` + `--rs-ink-bright`), not the prototype's rust
 *   wash — this is the mock's active item and the DS `--sidebar-accent` mapping.
 * - Row gap is `12px` and the icon `18px` at stroke `1.6` (prototype: 14 / 20).
 * - The active row **keeps** its highlight on hover (it only deepens). Losing it
 *   is an inline-style-ordering artefact of the prototype runtime —
 *   `OPERATOR_SCREENS.md` §4.4 "Hover on the active item — resolved".
 * - The nav ground is **transparent**: the Settings/Operator shell is a
 *   `Dialog` panel that already paints `--rs-surface-panel`. `tone="solid"`
 *   restores the opaque `--sidebar` glass for a standalone app sidebar.
 * - The group label renders at the DS **Overline** size (`12.5px`,
 *   `--text-overline-size`), per the port brief. `NavGroupLabel` and both screen
 *   docs say `12px`, and the DS type scale has no `12px` step, so the nearest
 *   type token is used rather than a raw literal.
 * - **One scroll container, and it is `SidebarContent`.** The mock puts
 *   `overflow:auto` on the `<nav>` itself, so its back row, labels and footer
 *   scroll away with the list. shadcn instead pins `SidebarHeader`/
 *   `SidebarFooter` and scrolls the middle — which is what every consumer of
 *   this family expects and what `sidebar-13` relies on. The port keeps the
 *   shadcn behaviour; the column element carries **no** overflow of its own, so
 *   the two never nest.
 *
 * The shadcn public API is intact — every part, every `data-slot`, `asChild`,
 * `isActive`, `tooltip`, `collapsible`, `variant`, `side` and `useSidebar` still
 * behave as upstream, so `sidebar-13` and friends keep working. `tone` on
 * `Sidebar`, `spacing` on `SidebarGroupLabel`, `srLabel` on `SidebarTrigger`/
 * `SidebarRail` and the `back` size on `SidebarMenuButton` are additive.
 *
 * Two caveats for call sites:
 * - **Landmark.** The DS nav is `<nav aria-label="Einstellungen">` /
 *   `aria-label="Betrieb"`. `Sidebar` always renders a `div`, so pass
 *   `role="navigation" aria-label={…}` through: with `collapsible="none"` (the
 *   settled Settings/Operator pattern) and on mobile those land on the element
 *   that carries `data-slot="sidebar"`. In the `offcanvas`/`icon` desktop branch
 *   they land on the fixed positioning wrapper instead — wrap the children in
 *   your own `<nav>` there.
 * - **Radius overrides.** `cn()` is stock `tailwind-merge`, which does not know
 *   the DS radius scale, so `rounded-control` / `-lg` / `-chip` / `-card` are
 *   *not* one conflict group: a `className="rounded-chip"` on
 *   `SidebarMenuButton` survives *alongside* the variant's `rounded-control-lg`
 *   and the winner is stylesheet order, not the call site. Override a radius by
 *   passing `style={{ borderRadius: "var(--radius-chip)" }}` (or register the
 *   scale with `extendTailwindMerge` in `src/lib/utils.ts`).
 */

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
/** DS nav track — `--width-settings-nav` (296px), fixed at every width. */
const SIDEBAR_WIDTH = "var(--width-settings-nav)"
const SIDEBAR_WIDTH_MOBILE = "var(--width-settings-nav)"
/** Icon rail — 48px, the top of the DS spacing scale. */
const SIDEBAR_WIDTH_ICON = "var(--space-19)"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"
/** German default copy for the parts the DS prototype has no analogue for. */
const SIDEBAR_TOGGLE_LABEL = "Navigation umschalten"
const SIDEBAR_MOBILE_TITLE = "Navigation"
const SIDEBAR_MOBILE_DESCRIPTION = "Zeigt die Navigation als Seitenblatt."

/**
 * Nav inset from Settings.jsx: `padding:36px 26px 30px`. It sits on the inner
 * column (not on the fixed positioning wrapper) so it survives every
 * `collapsible` mode; the icon rail drops back to an 8px gutter.
 */
const SIDEBAR_INNER_PADDING =
  "px-[var(--space-12)] pt-[var(--space-16)] pb-[var(--space-14)] group-data-[collapsible=icon]:px-[var(--space-3)]"

type SidebarTone = "panel" | "solid"

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  keyboardShortcut = true,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Bind the global ⌘/Ctrl+B toggle (default `true`, as upstream).
   * Pass `false` wherever nothing can collapse — the settled Settings/Operator
   * shell mounts `Sidebar collapsible="none"` inside a `Dialog`, where the
   * listener would only swallow the browser's ⌘B for no effect.
   */
  keyboardShortcut?: boolean
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        // Controlled: the owner of `open` is the source of truth, so persisting
        // our copy would leave a stale cookie behind on every render path.
        setOpenProp(openState)
        return
      }

      _setOpen(openState)

      // Persist the uncontrolled state. `SameSite=Lax` keeps it off
      // cross-site requests; the SPA never reads it back itself, it exists for
      // a server that wants to render the first paint in the right state.
      if (typeof document !== "undefined") {
        document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`
      }
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    if (!keyboardShortcut) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== SIDEBAR_KEYBOARD_SHORTCUT ||
        !(event.metaKey || event.ctrlKey)
      ) {
        return
      }

      // Never steal ⌘B from a text field — the Settings surface has real ones
      // (profile name, import textarea) and ⌘B is a rich-text idiom there.
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)
      ) {
        return
      }

      event.preventDefault()
      toggleSidebar()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [keyboardShortcut, toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "group/sidebar-wrapper flex min-h-svh w-full font-sans has-data-[variant=inset]:bg-sidebar",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  tone = "panel",
  mobileTitle = SIDEBAR_MOBILE_TITLE,
  mobileDescription = SIDEBAR_MOBILE_DESCRIPTION,
  className,
  // Pulled out of `props` so the mobile branch can merge it with the
  // `--sidebar-width` it has to set itself, instead of one clobbering the other.
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
  /**
   * DS ground of the nav column.
   * - `panel` (default) — transparent; the Settings/Operator `Dialog` already
   *   paints `--rs-surface-panel` behind it (SETTINGS_SCREENS §1.2 / §2). On
   *   mobile the `Sheet`'s own `--rs-surface-drawer` shows through instead.
   * - `solid` — the opaque `--sidebar` glass, for a standalone app sidebar.
   */
  tone?: SidebarTone
  /** sr-only title of the mobile `Sheet` dialog. */
  mobileTitle?: string
  /** sr-only description of the mobile `Sheet` dialog. */
  mobileDescription?: string
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  /**
   * The nav's only edge, per `Settings.jsx:257`: a 1px warm hairline on the
   * seam, at the `.08` *chrome* level (`--rs-border-divider-soft`), not the
   * `.10` content level — TOKENS.md F8, and `--sidebar-border` in `tokens.css`.
   */
  const edge = cn(
    "border-sidebar-border",
    side === "left" ? "border-r" : "border-l"
  )
  const ground = tone === "solid" ? "bg-sidebar" : "bg-transparent"

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        data-sidebar="sidebar"
        data-side={side}
        data-tone={tone}
        // No `overflow` here: `SidebarContent` is the column's single scroll
        // container (see the family JSDoc).
        className={cn(
          "flex h-full w-(--sidebar-width) min-h-0 flex-col font-sans text-rs-ink",
          SIDEBAR_INNER_PADDING,
          ground,
          edge,
          className
        )}
        style={style}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          data-tone={tone}
          // `SheetContent` is the element carrying `data-slot="sidebar"` on
          // mobile, so the consumer's `className`/`props` belong here — the
          // drawer already paints its ground and its own seam border, so
          // `tone="panel"` simply stays out of the way.
          className={cn(
            "w-(--sidebar-width) p-0 font-sans text-rs-ink [&>button]:hidden",
            tone === "solid" && "bg-sidebar",
            className
          )}
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              ...style,
            } as React.CSSProperties
          }
          side={side}
          {...props}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{mobileTitle}</SheetTitle>
            <SheetDescription>{mobileDescription}</SheetDescription>
          </SheetHeader>
          <div
            className={cn(
              "flex h-full w-full min-h-0 flex-col",
              SIDEBAR_INNER_PADDING
            )}
          >
            {children}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer hidden font-sans text-rs-ink md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-tone={tone}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "relative w-(--sidebar-width) bg-transparent transition-[width] duration-[var(--duration-quick)] ease-out-soft",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-[var(--duration-quick)] ease-out-soft md:flex",
          side === "left"
            ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : cn(
                "group-data-[collapsible=icon]:w-(--sidebar-width-icon)",
                // Same `.08` chrome hairline as the `collapsible="none"` column.
                "border-sidebar-border group-data-[side=left]:border-r group-data-[side=right]:border-l"
              ),
          className
        )}
        style={style}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className={cn(
            // No `overflow` here either — `SidebarContent` owns the scroll.
            "flex h-full w-full min-h-0 flex-col",
            SIDEBAR_INNER_PADDING,
            ground,
            "group-data-[variant=floating]:rounded-card group-data-[variant=floating]:border group-data-[variant=floating]:border-rs-border-panel group-data-[variant=floating]:shadow-panel",
            // A floating/inset column is its own surface — it needs a ground
            // even in `panel` tone, and it carries no seam hairline.
            variant === "floating" || variant === "inset" ? "bg-sidebar" : ""
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  srLabel = SIDEBAR_TOGGLE_LABEL,
  ...props
}: React.ComponentProps<typeof Button> & {
  /** Accessible name of the toggle. German by default (project copy rule). */
  srLabel?: string
}) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      // The DS header icon button — `--size-header-button` (42px), the size
      // `dialog.tsx`'s close button uses on the same chrome row.
      className={cn("size-[var(--size-header-button)] rounded-control", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="sr-only">{srLabel}</span>
    </Button>
  )
}

function SidebarRail({
  className,
  srLabel = SIDEBAR_TOGGLE_LABEL,
  ...props
}: React.ComponentProps<"button"> & {
  /** Accessible name of the drag rail. German by default. */
  srLabel?: string
}) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      type="button"
      aria-label={srLabel}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={srLabel}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-out-soft group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-rs-border-accent-soft sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-rs-surface-subtle-2",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        // `min-w-0` mirrors the DS grid track `minmax(0,1fr)`; the content column
        // must be able to shrink instead of pushing the 296px nav off-screen.
        "relative flex w-full min-w-0 flex-1 flex-col bg-transparent font-sans text-rs-ink",
        "peer-data-[variant=inset]:bg-background",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-card md:peer-data-[variant=inset]:shadow-panel md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn(
        "h-[var(--size-button-2xs)] w-full bg-rs-surface-inset shadow-none",
        className
      )}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      // The nav's own inset lives on the column (SIDEBAR_INNER_PADDING), so
      // header/footer/groups sit flush and only add their DS gaps. 14px is the
      // mock's only header stack: the back row, then the optional session line
      // at `margin:14px 10px 0` (SETTINGS_SCREENS §2.2, Settings.jsx:259).
      className={cn("flex shrink-0 flex-col gap-[var(--space-6)] p-0", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      // SETTINGS_SCREENS §2.6: block inset `0 10px`, 2px between name and role.
      className={cn(
        "flex shrink-0 flex-col gap-0.5 px-[var(--space-4)] py-0 group-data-[collapsible=icon]:px-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      // SETTINGS_SCREENS §2.6 / OPERATOR_SCREENS §4.5: full-bleed hairline,
      // margin `24px 0 20px`. The fill is deliberately *not* re-stated here —
      // the DS rule is `.10`, which is `Separator`'s `tone="default"`, so
      // `tone="soft"` / `"panel"` / `"control"` stay usable from the call site.
      className={cn(
        "mx-0 w-auto shrink-0 mt-[var(--space-11)] mb-[var(--space-9)]",
        className
      )}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      // gap-0: the DS group labels carry their own top inset (34px / 28px), so
      // an extra flex gap would double the rhythm between the two groups.
      // This is the column's single scroll container — the `Sidebar` element
      // itself deliberately declares no overflow (see the family JSDoc).
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-0 overflow-auto [scrollbar-width:none] group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

/**
 * Lets a `SidebarGroupLabel` name its own group: the DS split into
 * `DEIN SCOUT` / `DEIN KONTO` (SETTINGS_SCREENS §2.3/§2.5) is load-bearing, and
 * without this a screen reader hears one flat seven-item list.
 */
const SidebarGroupContext = React.createContext<{
  labelId: string | undefined
  setLabelId: (id: string | undefined) => void
} | null>(null)

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  const [labelId, setLabelId] = React.useState<string>()
  const value = React.useMemo(() => ({ labelId, setLabelId }), [labelId])

  return (
    <SidebarGroupContext.Provider value={value}>
      <div
        data-slot="sidebar-group"
        data-sidebar="group"
        // Only a *named* group is worth announcing; an unlabelled one stays a
        // plain box, as upstream.
        role={labelId ? "group" : undefined}
        aria-labelledby={labelId}
        // `pb`: the mock gives its *last* NavItem `margin-bottom:4` too
        // (Settings.jsx:261/263), which a flex `gap` inside `SidebarMenu`
        // cannot express. It is what makes the distance from the last row of a
        // group to the next group label 38px/32px, and to the footer rule 28px.
        className={cn(
          "relative flex w-full min-w-0 flex-col pb-[var(--space-1)]",
          className
        )}
        {...props}
      />
    </SidebarGroupContext.Provider>
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  spacing = "default",
  id,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean
  /**
   * Top inset. `default` is the DS `28px` (`--space-13`); `lead` is the `34px`
   * (`--space-15`) of the **first** label in a column — `Settings.jsx:260`,
   * SETTINGS_SCREENS §2.3, OPERATOR_SCREENS §4.3.
   */
  spacing?: "default" | "lead"
}) {
  const Comp = asChild ? Slot.Root : "div"
  const group = React.useContext(SidebarGroupContext)
  const fallbackId = React.useId()
  const labelId = id ?? fallbackId
  const setLabelId = group?.setLabelId

  React.useEffect(() => {
    if (!setLabelId) {
      return
    }
    setLabelId(labelId)
    return () => setLabelId(undefined)
  }, [setLabelId, labelId])

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      id={labelId}
      // DS NavGroupLabel: .14em / uppercase / --rs-ink-6 / weight 400, inset
      // `28px 10px 10px` (`34px` for the first label — `spacing="lead"`). The
      // size is the DS Overline token (12.5px); see the family JSDoc.
      className={cn(
        "flex h-auto shrink-0 items-center px-[var(--space-4)] pb-[var(--space-4)]",
        spacing === "lead" ? "pt-[var(--space-15)]" : "pt-[var(--space-13)]",
        "font-sans text-[length:var(--text-overline-size)] font-normal tracking-[var(--text-overline-tracking)] uppercase text-rs-ink-6",
        "transition-[margin,opacity] duration-[var(--duration-quick)] ease-out-soft",
        // `outline-solid` re-arms --tw-outline-style, which `outline-hidden` clears.
        "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
        "[&>svg]:size-[var(--space-7)] [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      // A bare `<button>` defaults to `type="submit"`; the Settings surface has
      // real forms, so never let a chrome control submit one.
      type={asChild ? undefined : "button"}
      className={cn(
        "absolute top-[var(--space-11)] right-[var(--space-4)] flex aspect-square w-[var(--space-9)] items-center justify-center rounded-chip p-0 text-rs-ink-2 transition-colors duration-[var(--duration-fast)] ease-out-soft hover:bg-rs-surface-subtle-2 hover:text-rs-ink-bright",
        // `outline-solid` re-arms --tw-outline-style, which `outline-hidden` clears.
        "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
        "[&>svg]:size-[var(--space-7)] [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn(
        "w-full text-[length:var(--text-body-size)]",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      // 4px between rows = the prototype's `margin-bottom:4` on every NavItem.
      // The mock's *trailing* 4px (it sits on the last row too) lives on
      // `SidebarGroup`, so a bare menu in the header does not inherit it.
      className={cn(
        "flex w-full min-w-0 flex-col gap-[var(--space-1)]",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

/**
 * DS NavItem. The row is a 1px-bordered box at every state so the active border
 * cannot shift the label by a pixel when `isActive` flips.
 */
const sidebarMenuButtonVariants = cva(
  [
    "peer/menu-button flex w-full cursor-pointer items-center overflow-hidden text-left",
    // The radius lives on the size variants, not here: tailwind-merge does not
    // treat `rounded-control` and `rounded-control-lg` as one group, so a base
    // radius would survive alongside the `back` size's 10px one and win.
    "gap-[var(--space-5)] border border-transparent font-sans text-rs-ink",
    "transition-colors duration-[var(--duration-fast)] ease-out-soft",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-hidden` clears
    // — without it Tailwind v4 resolves `outline-style: none` and nothing paints.
    "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "group-has-data-[sidebar=menu-action]/menu-item:pr-8",
    "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2!",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    // Active row: orange tint + warm hairline + bright ink + orange-light icon.
    // It keeps (and slightly deepens) its fill on hover — OPERATOR_SCREENS §4.4.
    "data-[active=true]:bg-rs-surface-accent-tint data-[active=true]:border-rs-border-accent-soft data-[active=true]:text-rs-ink-bright",
    "data-[active=true]:hover:bg-rs-surface-accent-tint-hover",
    "data-[state=open]:hover:bg-rs-surface-subtle-2",
    "[&>span:last-child]:truncate",
    // Icons: 18px at stroke 1.6, ink-2 → orange-light when the row is active.
    "[&>svg]:shrink-0 [&>svg]:text-rs-ink-2 [&>svg]:[stroke-width:1.6]",
    "[&>svg:not([class*='size-'])]:size-[18px]",
    "data-[active=true]:[&>svg]:text-rs-orange-light",
  ].join(" "),
  {
    variants: {
      variant: {
        /** Transparent row; hover lightens the ground to white .06. */
        default: "data-[active=false]:hover:bg-rs-surface-subtle-2",
        /** Outlined row — quiet filled control on the DS control hairline. */
        outline:
          "bg-rs-surface-subtle border-rs-border-control data-[active=false]:hover:bg-rs-surface-hover",
      },
      size: {
        /** DS NavItem — 50px (`--size-nav-item`), 14px inset, 12px radius, 16px ink. */
        default:
          "h-[var(--size-nav-item)] rounded-control-lg px-[var(--space-6)] text-[length:var(--text-body-size)]",
        /** Compact row — 36px, 12px inset, 14px ink. */
        sm: "h-[var(--size-button-2xs)] rounded-control-lg px-[var(--space-5)] text-[length:var(--text-caption-size)]",
        /** Roomy row — 46px, 14px inset, 17px ink. */
        lg: "h-[var(--size-button-sm)] rounded-control-lg px-[var(--space-6)] text-[length:var(--text-body-lg-size)] group-data-[collapsible=icon]:p-0!",
        /**
         * DS back row — "Zurück zum Scout" / "Zur App": no fixed height,
         * `8px 10px` inset, 10px radius, 16px ink (SETTINGS_SCREENS §2.1).
         */
        back: "h-auto rounded-control px-[var(--space-4)] py-[var(--space-3)] text-[length:var(--text-body-size)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot.Root : "button"
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      // A bare `<button>` defaults to `type="submit"`: a nav row rendered
      // inside one of the Settings forms would submit it instead of navigating.
      type={asChild ? undefined : "button"}
      // DS parity with the prototype's `aria-current` on the current nav row.
      aria-current={isActive ? "page" : undefined}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  const tooltipProps: React.ComponentProps<typeof TooltipContent> =
    typeof tooltip === "string" ? { children: tooltip } : tooltip

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltipProps}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      // Never let a row action submit a Settings form (see `SidebarMenuButton`).
      type={asChild ? undefined : "button"}
      className={cn(
        "absolute right-[var(--space-2)] flex aspect-square w-[var(--space-9)] items-center justify-center rounded-chip p-0 text-rs-ink-2 transition-colors duration-[var(--duration-fast)] ease-out-soft",
        "peer-hover/menu-button:text-rs-ink-bright hover:bg-rs-surface-subtle-2 hover:text-rs-ink-bright",
        // `outline-solid` re-arms --tw-outline-style, which `outline-hidden` clears.
        "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
        "[&>svg]:size-[var(--space-7)] [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 md:after:hidden",
        // Vertically centred against each row height: (h − 20px) / 2, kept as
        // arithmetic on the size tokens so it follows them if they move.
        "peer-data-[size=sm]/menu-button:top-[var(--space-3)]",
        "peer-data-[size=default]/menu-button:top-[calc((var(--size-nav-item)-var(--space-9))/2)]",
        "peer-data-[size=lg]/menu-button:top-[calc((var(--size-button-sm)-var(--space-9))/2)]",
        "peer-data-[size=back]/menu-button:top-[var(--space-3)]",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-rs-ink-bright data-[state=open]:opacity-100 md:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-[var(--space-2)] flex h-[var(--space-9)] min-w-[var(--space-9)] items-center justify-center rounded-chip px-[var(--space-1)] text-[length:var(--text-micro-size)] font-medium text-rs-ink-4 tabular-nums select-none",
        "peer-hover/menu-button:text-rs-ink-bright peer-data-[active=true]/menu-button:text-rs-orange-tint",
        "peer-data-[size=sm]/menu-button:top-[var(--space-3)]",
        "peer-data-[size=default]/menu-button:top-[calc((var(--size-nav-item)-var(--space-9))/2)]",
        "peer-data-[size=lg]/menu-button:top-[calc((var(--size-button-sm)-var(--space-9))/2)]",
        "peer-data-[size=back]/menu-button:top-[var(--space-3)]",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  // Width between 50% and 90%, derived from the render-stable React id rather
  // than Math.random() so the placeholder is pure and SSR/hydration-safe.
  const id = React.useId()
  const width = React.useMemo(() => {
    let hash = 0
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) % 41
    }
    return `${hash + 50}%`
  }, [id])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn(
        "flex h-[var(--size-nav-item)] items-center gap-[var(--space-5)] rounded-control-lg px-[var(--space-6)]",
        className
      )}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-[18px] rounded-chip"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-[var(--space-7)] max-w-(--skeleton-width) flex-1 rounded-chip"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        // The left rule is nav chrome, so it takes the `.08` level (TOKENS.md F8).
        "mx-[var(--space-6)] flex min-w-0 translate-x-px flex-col gap-[var(--space-1)] border-l border-sidebar-border px-[var(--space-5)] py-[var(--space-1)]",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("group/menu-sub-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
  size?: "sm" | "md"
  isActive?: boolean
}) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        // 36px is a *control* height, so it is `--size-button-2xs`, not the
        // 36px step of the spacing scale.
        "flex h-[var(--size-button-2xs)] min-w-0 -translate-x-px cursor-pointer items-center gap-[var(--space-4)] overflow-hidden rounded-control px-[var(--space-4)] font-sans text-rs-ink-3",
        "transition-colors duration-[var(--duration-fast)] ease-out-soft",
        // `outline-solid` re-arms --tw-outline-style, which `outline-hidden` clears.
        "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
        "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        "[&>span:last-child]:truncate [&>svg]:size-[var(--space-7)] [&>svg]:shrink-0 [&>svg]:[stroke-width:1.6] [&>svg]:text-rs-ink-4",
        "data-[active=false]:hover:bg-rs-surface-subtle-2 data-[active=false]:hover:text-rs-ink-bright",
        "data-[active=true]:bg-rs-surface-accent-tint data-[active=true]:text-rs-ink-bright data-[active=true]:[&>svg]:text-rs-orange-light",
        size === "sm" && "text-[length:var(--text-caption-sm-size)]",
        size === "md" && "text-[length:var(--text-body-sm-size)]",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  // `useSidebar` is part of the shadcn public API and has to read the context
  // declared in this file, so it cannot move to a components-only module.
  // eslint-disable-next-line react-refresh/only-export-components
  useSidebar,
}
export type { SidebarTone }
