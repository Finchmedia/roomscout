import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  type DialogContentProps,
} from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { useIsMobile } from "@/hooks/use-mobile"

/**
 * PanelDialog — the RoomScout panel shell: a 296px nav column and a scrolling
 * content column inside one glass panel dialog. Settings and Operator are the
 * two surfaces built on it; the screens supply the page content as `children`.
 *
 * DS reference:
 * - `design-system/ui_kits/roomscout-app/Settings.jsx` — the surface this shell
 *   was extracted from (sidebar column, back row, two labelled groups, footer,
 *   scrolling content pane).
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §1.2 (panel geometry + the port delta
 *   that adds the breadcrumb header and the × button), §2 (`296px` nav:
 *   `36px 26px 30px`, right hairline, "Zurück zum Scout" first, group labels
 *   `DEIN SCOUT` / `DEIN KONTO`, footer name + "Persönlicher Bereich"), §3
 *   (content pane `42px 46px 40px`, scrolled to top on every page change),
 *   §15 "Mobile variant" (the required `< md` plan), §0.7 (page-change effect).
 * - `docs/UI_PORT/OPERATOR_SCREENS.md` §16 — the same `sidebar-13` mapping for
 *   the operator surface (`Betrieb › {nav label}`).
 * - `docs/UI_PORT/COMPONENT_MAP.md` D10 (shell) · D11/D12 (nav item, group
 *   label, footer) · D14 (back row).
 * - shadcn block `sidebar-13` — the structure is followed slot for slot:
 *   `Dialog › DialogContent (p-0) › [sr-only DialogTitle + DialogDescription] ›
 *   SidebarProvider › Sidebar collapsible="none" + main › header (Breadcrumb) ›
 *   scrolling content`.
 *
 * Deliberate deviations from `sidebar-13`, all required by the DS:
 * - `SidebarProvider` gets `h-full min-h-0` instead of the block's `items-start`
 *   + `min-h-svh`: the DS nav column is full height and carries the panel's only
 *   internal seam (SETTINGS §2), which `items-start` would cut short.
 * - The header carries a `DialogClose` on the right (block: none) — SETTINGS §1.2
 *   port delta, which keeps **both** the × and the sidebar's back row.
 * - The breadcrumb root is plain text, not a link: it names this shell, so there
 *   is nowhere for it to navigate (`BreadcrumbLink href="#"` in the block).
 * - Below `md` the nav column is hidden and the header shows a compact page
 *   picker that opens the same nav in a left `Sheet` (SETTINGS §15: the
 *   prototype's own phone preview collapses the content column to ~20px and is
 *   explicitly *not* a design to reproduce).
 *
 * Behaviour carried over from the prototype: a `currentId` change scrolls the
 * content pane back to the top (SETTINGS §0.7). The accompanying WAAPI fade is
 * left to the screens — replaying it here would have to remount `children` and
 * would throw away every screen's local state on each page change.
 */

/** One nav row: the DS `NavItem` (SETTINGS §2.4, COMPONENT_MAP D11). */
interface PanelDialogItem {
  /** Stable page id; matched against `currentId` and passed to `onSelect`. */
  id: string
  /** Nav label — also the breadcrumb's current page (never the page h1). */
  label: string
  /** 20×20 DS glyph, e.g. `<Icon name="globe" size={20} />`. */
  icon?: React.ReactNode
  /** Forces the active state; defaults to `id === currentId`. */
  current?: boolean
  /** Per-item handler. When set it replaces the panel-level `onSelect`. */
  onSelect?: () => void
}

/** A labelled block of nav rows — `DEIN SCOUT`, `DEIN KONTO`, `BETRIEB`. */
interface PanelDialogGroup {
  /** React key; falls back to `label`, then to the group's index. */
  id?: string
  /** Overline copy, uppercased by the DS `SidebarGroupLabel`. */
  label?: string
  items: PanelDialogItem[]
}

/** The nav's first row — "Zurück zum Scout" (S) / "Zur App" (O), §2.1 · D14. */
interface PanelDialogBackAction {
  label: string
  onSelect: () => void
  /** Defaults to the DS `arrow-left` glyph at 20px. */
  icon?: React.ReactNode
}

/**
 * DS nav column, in its two placements. Both render the same tree; only the
 * inset differs — `Sidebar collapsible="none"` already carries the DS
 * `36px 26px 30px`, the mobile `Sheet` has to bring it itself.
 */
const panelDialogNavVariants = cva(
  "flex min-h-0 flex-1 flex-col font-sans text-rs-ink",
  {
    variants: {
      placement: {
        /** Inside the 296px `Sidebar` column (desktop). */
        sidebar: "",
        /** Inside the mobile `Sheet` — SETTINGS §2 nav inset, no scrollbar. */
        sheet:
          "overflow-auto px-[var(--space-12)] pt-[var(--space-16)] pb-[var(--space-14)] [scrollbar-width:none]",
      },
    },
    defaultVariants: {
      placement: "sidebar",
    },
  }
)

type PanelDialogNavProps = React.ComponentProps<"div"> &
  VariantProps<typeof panelDialogNavVariants> & {
    groups: PanelDialogGroup[]
    isCurrent: (item: PanelDialogItem) => boolean
    onItemSelect: (item: PanelDialogItem) => void
    back?: PanelDialogBackAction
    footer?: React.ReactNode
  }

function PanelDialogNav({
  className,
  placement = "sidebar",
  groups,
  isCurrent,
  onItemSelect,
  back,
  footer,
  ...props
}: PanelDialogNavProps) {
  return (
    <div
      data-slot="panel-dialog-nav"
      data-placement={placement}
      className={cn(panelDialogNavVariants({ placement }), className)}
      {...props}
    >
      {back ? (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              {/* D14: 8px/10px inset, 10px radius, 16px ink, arrow-left. The
                  glyph lands on the ported sidebar's 18px nav-icon rule (the
                  prototype draws 20px); pass an icon carrying a `size-*` class
                  to opt out of it. */}
              <SidebarMenuButton size="back" onClick={back.onSelect}>
                {back.icon ?? <Icon name="arrow-left" />}
                <span>{back.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      ) : null}

      <SidebarContent>
        {groups.map((group, index) => (
          <SidebarGroup key={group.id ?? group.label ?? index}>
            {group.label ? (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={isCurrent(item)}
                      onClick={() => onItemSelect(item)}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* §2.6: the footer is pushed down by the flex-1 content, then a hairline. */}
      {footer ? (
        <>
          <SidebarSeparator />
          <SidebarFooter>{footer}</SidebarFooter>
        </>
      ) : null}
    </div>
  )
}

type PanelDialogProps = Omit<
  DialogContentProps,
  "title" | "children" | "onSelect" | "tone" | "size" | "showCloseButton"
> & {
  /** Controlled open state of the panel. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Accessible name of the panel — rendered sr-only (`sidebar-13`). */
  title: string
  /** Optional sr-only description; omitted keeps the panel undescribed. */
  description?: string
  /** Breadcrumb root, e.g. "Einstellungen" / "Betrieb". */
  rootLabel: string
  /** Nav groups, in order. */
  groups: PanelDialogGroup[]
  /** Id of the active page; sets the active row and the breadcrumb's leaf. */
  currentId?: string
  /** Fallback row handler — used for every item without its own `onSelect`. */
  onSelect?: (id: string) => void
  /** Optional first nav row (SETTINGS §2.1 / OPERATOR §4.2). */
  back?: PanelDialogBackAction
  /** Sidebar footer block, below the hairline (§2.6). */
  footer?: React.ReactNode
  /** The page itself — PanelDialog ships no page content of its own. */
  children?: React.ReactNode
}

/**
 * DS content pane inset — §3 `42px 46px 40px`, tightened to `24px 18px 28px`
 * below `md` (§15). 46px and 42px have no spacing token (the scale runs
 * 40 → 44 → 48), so those two are raw px; every other step is a `--space-*`.
 */
const PANEL_DIALOG_INLINE_INSET = "px-[var(--space-8)] md:px-[46px]"

function PanelDialog({
  open,
  onOpenChange,
  title,
  description,
  rootLabel,
  groups,
  currentId,
  onSelect,
  back,
  footer,
  children,
  className,
  ...props
}: PanelDialogProps) {
  const isMobile = useIsMobile()
  const [navOpen, setNavOpen] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const isCurrent = React.useCallback(
    (item: PanelDialogItem) => item.current ?? item.id === currentId,
    [currentId]
  )

  const handleItemSelect = React.useCallback(
    (item: PanelDialogItem) => {
      setNavOpen(false)
      if (item.onSelect) {
        item.onSelect()
        return
      }
      onSelect?.(item.id)
    },
    [onSelect]
  )

  const currentLabel = React.useMemo(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (isCurrent(item)) {
          return item.label
        }
      }
    }
    return undefined
  }, [groups, isCurrent])

  /** §0.7: a page change scrolls the content pane back to the top. */
  React.useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [currentId])

  const nav = (
    <PanelDialogNav
      groups={groups}
      isCurrent={isCurrent}
      onItemSelect={handleItemSelect}
      back={back}
      footer={footer}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-slot="panel-dialog"
        tone="panel"
        size="shell"
        showCloseButton={false}
        className={className}
        // Radix warns when a dialog has neither a description nor an explicit
        // opt-out; dropping the attribute is that opt-out.
        {...(description ? {} : { "aria-describedby": undefined })}
        {...props}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="sr-only">
            {description}
          </DialogDescription>
        ) : null}

        <SidebarProvider className="h-full min-h-0">
          {/* §2: the 296px column; below `md` the header picker replaces it. */}
          <Sidebar collapsible="none" className="hidden md:flex">
            {nav}
          </Sidebar>

          <main
            data-slot="panel-dialog-main"
            className="flex h-full min-w-0 flex-1 flex-col overflow-hidden"
          >
            <header
              data-slot="panel-dialog-header"
              className={cn(
                "flex h-[var(--size-header-narrow)] shrink-0 items-center justify-between gap-[var(--space-5)]",
                PANEL_DIALOG_INLINE_INSET
              )}
            >
              {isMobile ? (
                <Sheet open={navOpen} onOpenChange={setNavOpen}>
                  <SheetTrigger asChild>
                    {/* §15: the `< md` page picker, in place of the nav column. */}
                    <button
                      type="button"
                      data-slot="panel-dialog-nav-trigger"
                      aria-haspopup="dialog"
                      className="inline-flex h-[var(--size-header-button)] min-w-0 cursor-pointer items-center gap-[var(--space-3)] rounded-control-lg border border-rs-border-control bg-rs-surface-subtle px-[var(--space-6)] font-sans text-[length:var(--text-body-sm-size)] text-rs-ink transition-colors duration-[var(--duration-fast)] ease-out-soft hover:bg-rs-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange"
                    >
                      <Icon name="list" size={18} />
                      <span className="truncate">
                        {currentLabel ?? rootLabel}
                      </span>
                      <Icon name="chevron-down" size={16} />
                    </button>
                  </SheetTrigger>
                  <SheetContent
                    side="left"
                    showCloseButton={false}
                    className="w-[var(--width-settings-nav)] max-w-[calc(100%-var(--space-17))] p-0"
                  >
                    <SheetTitle className="sr-only">{title}</SheetTitle>
                    <SheetDescription className="sr-only">
                      Bereich wählen.
                    </SheetDescription>
                    <PanelDialogNav
                      placement="sheet"
                      groups={groups}
                      isCurrent={isCurrent}
                      onItemSelect={handleItemSelect}
                      back={back}
                      footer={footer}
                    />
                  </SheetContent>
                </Sheet>
              ) : (
                <Breadcrumb className="min-w-0">
                  <BreadcrumbList>
                    {/* The root names this shell, so it is text, not a link. */}
                    <BreadcrumbItem>{rootLabel}</BreadcrumbItem>
                    {currentLabel ? (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem className="min-w-0">
                          <BreadcrumbPage className="truncate">
                            {currentLabel}
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </>
                    ) : null}
                  </BreadcrumbList>
                </Breadcrumb>
              )}

              {/* §1.2 port delta: the × the prototype does not have. */}
              <DialogClose asChild>
                <IconButton variant="outline" label="Schließen">
                  <Icon name="close" size={18} />
                </IconButton>
              </DialogClose>
            </header>

            <div
              ref={contentRef}
              data-slot="panel-dialog-content"
              className={cn(
                "min-h-0 flex-1 overflow-auto [scrollbar-width:thin]",
                "pt-[var(--space-11)] pb-[var(--space-13)] md:pt-[42px] md:pb-[var(--space-17)]",
                PANEL_DIALOG_INLINE_INSET
              )}
            >
              {children}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  )
}

export { PanelDialog }
export type {
  PanelDialogProps,
  PanelDialogGroup,
  PanelDialogItem,
  PanelDialogBackAction,
}
