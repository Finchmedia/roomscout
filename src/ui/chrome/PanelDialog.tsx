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

/**
 * PanelDialog — the RoomScout panel shell: a 296px nav column and a scrolling
 * content column inside one glass panel dialog. Settings and Operator are the
 * two surfaces built on it; the screens supply the page content as `children`.
 *
 * DS reference:
 * - `design-system/ui_kits/roomscout-app/Settings.jsx` — the surface this shell
 *   was extracted from (sidebar column, back row, session line, two labelled
 *   groups, footer, scrolling content pane).
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §1.2 (panel geometry, the "all overlays
 *   are `position:absolute` **inside the panel**" rule, and the port delta that
 *   adds the breadcrumb header and the × button), §2 (`296px` nav:
 *   `36px 26px 30px`, right hairline, `<nav aria-label="Einstellungen">`,
 *   "Zurück zum Scout" first, §2.2 session line, group labels „Dein Scout“ /
 *   „Dein Konto“ — uppercased by CSS, footer name + „Persönlicher Bereich“), §3
 *   (content pane `42px 46px 40px`, scrolled to top on every page change),
 *   §15 "Mobile variant" (the required `< 900px` plan), §0.7 (page-change
 *   effect), §0.6 (`prefers-reduced-motion`), §16 (assembly).
 * - `docs/UI_PORT/OPERATOR_SCREENS.md` §16 — the same `sidebar-13` mapping for
 *   the operator surface (`Betrieb › {nav label}`).
 * - `docs/UI_PORT/COMPONENT_MAP.md` D10 (shell, props `minHeight, maxWidth,
 *   header, sidebar, children, overlays`) · D11/D12 (nav item, group label,
 *   footer) · D14 (back row).
 * - shadcn block `sidebar-13` — the structure is followed slot for slot:
 *   `Dialog › DialogContent (p-0) › [sr-only DialogTitle + DialogDescription] ›
 *   SidebarProvider › Sidebar collapsible="none" + content column › header
 *   (Breadcrumb) › scrolling content`.
 *
 * Deliberate deviations from `sidebar-13`, all required by the DS:
 * - `SidebarProvider` gets `h-full min-h-0` instead of the block's `items-start`
 *   + `min-h-svh`: the DS nav column is full height and carries the panel's only
 *   internal seam (SETTINGS §2), which `items-start` would cut short. §1.2, §16
 *   and COMPONENT_MAP D10 all spell `items-start`; this is the one place the
 *   shell knowingly departs from them (see open questions in the port log).
 * - `keyboardShortcut={false}`: upstream's provider binds a document-wide
 *   ⌘/Ctrl+B that toggles `state`, which `collapsible="none"` ignores. Inside a
 *   dialog that shortcut is a pure no-op that still swallows the browser
 *   binding and writes a `sidebar_state` cookie.
 * - The column is not a `<main>`: the app shell around the panel already owns
 *   that landmark, so the shell exposes exactly one landmark of its own — the
 *   `<nav>` (§2) — plus the labelled scroll region of §3.
 * - The header carries a `DialogClose` on the right (block: none) — SETTINGS §1.2
 *   port delta, which keeps **both** the × and the sidebar's back row.
 * - The breadcrumb root is plain text, not a link: it names this shell, so there
 *   is nowhere for it to navigate (`BreadcrumbLink href="#"` in the block).
 * - Below `900px` (SETTINGS §15, and the one breakpoint `breadcrumb.tsx` knows)
 *   the nav column is hidden and the breadcrumb's **leaf** becomes a compact
 *   page picker that opens the same nav in a left `Sheet`; the root label stays.
 *   The prototype's own phone preview collapses the content column to ~20px and
 *   is explicitly *not* a design to reproduce. The switch is pure CSS on both
 *   halves, so there is never a frame with neither affordance.
 *
 * Behaviour carried over from the prototype (§0.7): a `currentId` change scrolls
 * the content pane back to the top **and** replays the 200 ms fade-up, skipped
 * under `prefers-reduced-motion` (§0.6). It runs as a WAAPI animation on the
 * pane itself, so `children` are never remounted and no screen state is lost.
 *
 * German copy: the shell ships the two shared defaults of `common.close`
 * („Schließen“) and takes every surface-specific string as a prop, so nothing
 * here is invented and both surfaces feed it from `src/ui/copy/de/*`.
 */

/** One nav row: the DS `NavItem` (SETTINGS §2.4, COMPONENT_MAP D11). */
interface PanelDialogItem {
  /** Stable page id; matched against `currentId` and passed to `onSelect`. */
  id: string
  /** Nav label — also the breadcrumb's current page (never the page h1). */
  label: string
  /**
   * DS glyph, e.g. `<Icon name="globe" />`. The ported nav renders row icons at
   * the DS's **18px** step (`sidebar.tsx` family JSDoc — a settled deviation
   * from the prototype's 20px), and `sidebarMenuButtonVariants` enforces it with
   * `[&>svg:not([class*='size-'])]:size-[18px]`. `Icon`'s `size` prop only sets
   * the SVG's `width`/`height` **attributes**, which that rule overrides — to
   * opt a glyph out, give it a `size-*` class (`<Icon name="globe"
   * className="size-5" />`), not `size={20}`.
   */
  icon?: React.ReactNode
  /** Forces the active state; defaults to `id === currentId`. */
  current?: boolean
  /** Per-item handler. When set it replaces the panel-level `onSelect`. */
  onSelect?: () => void
}

/** A labelled block of nav rows — „Dein Scout“, „Dein Konto“, „Betrieb“. */
interface PanelDialogGroup {
  /** React key; falls back to `label`, then to the group's index. */
  id?: string
  /**
   * Overline copy in **sentence case** — `SidebarGroupLabel` applies the DS's
   * `text-transform:uppercase` (§2.3/§2.5), so pass the dictionary value
   * (`settings.nav.groupScout` = „Dein Scout“), never a pre-uppercased literal.
   */
  label?: string
  items: PanelDialogItem[]
}

/** The nav's first row — "Zurück zum Scout" (S) / "Zur App" (O), §2.1 · D14. */
interface PanelDialogBackAction {
  label: string
  onSelect: () => void
  /** Defaults to the DS `arrow-left` glyph; see {@link PanelDialogItem.icon}. */
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

type PanelDialogNavProps = React.ComponentProps<"nav"> &
  VariantProps<typeof panelDialogNavVariants> & {
    groups: PanelDialogGroup[]
    isCurrent: (item: PanelDialogItem) => boolean
    onItemSelect: (item: PanelDialogItem) => void
    back?: PanelDialogBackAction
    navHeader?: React.ReactNode
    footer?: React.ReactNode
  }

/**
 * The §2 navigation landmark. `Sidebar collapsible="none"` renders a plain
 * `div` and so does the mobile `Sheet`, so the landmark lives here — one `<nav>`
 * per placement, named by `aria-label` (`settings.nav.aria` = „Einstellungen“ /
 * `operator.nav.aria`), exactly as `sidebar.tsx`'s "Landmark" caveat asks.
 */
function PanelDialogNav({
  className,
  placement = "sidebar",
  groups,
  isCurrent,
  onItemSelect,
  back,
  navHeader,
  footer,
  ...props
}: PanelDialogNavProps) {
  return (
    <nav
      data-slot="panel-dialog-nav"
      data-placement={placement}
      className={cn(panelDialogNavVariants({ placement }), className)}
      {...props}
    >
      {back || navHeader ? (
        // §2.2: `SidebarHeader`'s 14px stack is the back row, then the session
        // line at `margin:14px 10px 0` (Settings.jsx:259).
        <SidebarHeader>
          {back ? (
            <SidebarMenu>
              <SidebarMenuItem>
                {/* D14: 8px/10px inset, 10px radius, 16px ink, arrow-left. */}
                <SidebarMenuButton size="back" onClick={back.onSelect}>
                  {back.icon ?? <Icon name="arrow-left" />}
                  <span>{back.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : null}
          {navHeader}
        </SidebarHeader>
      ) : null}

      <SidebarContent>
        {groups.map((group, index) => (
          <SidebarGroup key={group.id ?? group.label ?? index}>
            {group.label ? (
              // D12 records the label inset as `{34|28}px`: the first label of a
              // column gets the 34px lead, every later one the 28px step.
              <SidebarGroupLabel spacing={index === 0 ? "lead" : "default"}>
                {group.label}
              </SidebarGroupLabel>
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
    </nav>
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
  /**
   * Accessible name of the `<nav>` landmark and of the mobile page picker —
   * `settings.nav.aria` („Einstellungen“) / `operator.nav.aria`. Defaults to
   * `rootLabel`, which is the same string on both shipped surfaces.
   */
  navLabel?: string
  /** Nav groups, in order. */
  groups: PanelDialogGroup[]
  /** Id of the active page; sets the active row and the breadcrumb's leaf. */
  currentId?: string
  /** Fallback row handler — used for every item without its own `onSelect`. */
  onSelect?: (id: string) => void
  /** Optional first nav row (SETTINGS §2.1 / OPERATOR §4.2). */
  back?: PanelDialogBackAction
  /**
   * Slot under the back row, inside `SidebarHeader` — the §2.2 session line
   * (`settings.session.*`: „Scout ist unterwegs“ / „Suche pausiert“ /
   * „Gespräch pausiert · läuft weiter, wenn du zurückkehrst“). DS geometry:
   * `margin:14px 10px 0` (the header's own gap supplies the 14px), a 7×7
   * `--rs-orange` dot at `margin-top:5px`, 12.5px/1.4 on `--rs-ink-4`.
   */
  navHeader?: React.ReactNode
  /** Sidebar footer block, below the hairline (§2.6). */
  footer?: React.ReactNode
  /**
   * Panel-scoped overlay layer — COMPONENT_MAP D10's `overlays`, SETTINGS §16's
   * `<ConnectionSheet/> <ImportDialog/> <DiscardAlert/> <Toaster/>` as siblings
   * of the two columns. It is an out-of-flow layer pinned to the panel, so
   * §1.2's "all overlays are `position:absolute` **inside the panel**" holds and
   * nothing here scrolls or clips with the content pane. Children get pointer
   * events back; the layer itself is transparent to them.
   *
   * A nested Radix overlay should instead take the panel element as its portal
   * `container` — read it with {@link usePanelDialogContainer} from anywhere
   * inside the panel; `DialogContent` / `SheetContent` then switch from `fixed`
   * to `absolute` by themselves.
   */
  overlays?: React.ReactNode
  /** Accessible name of the × and of the mobile nav's close (`common.close`). */
  closeLabel?: string
  /** Extra classes for the `<nav>` landmark, in **both** placements. */
  navClassName?: string
  /** Extra classes for the content column (header + scroll pane). */
  mainClassName?: string
  /** Extra classes for the scrolling content pane itself. */
  contentClassName?: string
  /** The page itself — PanelDialog ships no page content of its own. */
  children?: React.ReactNode
}

/**
 * The shell's own measures, declared once on the panel so a retune of an
 * unrelated DS token cannot silently resize it (and so Operator can override
 * one without forking the shell):
 * - header height — the panel header is a port addition (§1.2 delta) with no
 *   prototype value; it borrows the app header's narrow step, 64px.
 * - picker height — the `< 900px` page picker; 42px, the DS control step.
 * - `46px` / `42px` content inset (§3) have no `--space-*` step (the scale runs
 *   40 → 44 → 48), so they stay literal here and nowhere else.
 */
const PANEL_DIALOG_SHELL_VARS = [
  "[--panel-dialog-header-height:var(--size-header-narrow)]",
  "[--panel-dialog-picker-height:var(--size-header-button)]",
  "[--panel-dialog-inset-x:46px]",
  "[--panel-dialog-inset-top:42px]",
].join(" ")

/** DS content inset — §3 `46px`, tightened to 18px below the breakpoint (§15). */
const PANEL_DIALOG_INLINE_INSET =
  "px-[var(--space-8)] min-[900px]:px-[var(--panel-dialog-inset-x)]"

/**
 * SETTINGS §15's sidebar-collapse width, and the single breakpoint
 * `breadcrumb.tsx` steps its type at. Tailwind needs the literal in the class
 * strings (`min-[900px]:…`), so the two must be changed together; this constant
 * exists only for the `matchMedia` guard below.
 */
const PANEL_DIALOG_BREAKPOINT = 900

/**
 * §0.7's page-change entrance, `.2s` (`--duration-quick`) and the prototype's
 * own 6px `stFade` travel — deliberately the 6px shape, not `rs-fade-up`'s 8px.
 */
const PANEL_DIALOG_PAGE_KEYFRAMES: Keyframe[] = [
  { opacity: 0, transform: "translateY(6px)" },
  { opacity: 1, transform: "none" },
]
const PANEL_DIALOG_PAGE_TIMING: KeyframeAnimationOptions = {
  duration: 200,
  easing: "ease-out",
}

/**
 * The panel element, for overlays that need `position:absolute` **inside** the
 * panel (§1.2) — pass it as the `container` of a nested `DialogContent` /
 * `SheetContent` and both the scrim and the surface scope themselves to it.
 * `null` outside a `PanelDialog`, and on the render before the panel mounts.
 */
const PanelDialogContainerContext = React.createContext<HTMLElement | null>(null)

function usePanelDialogContainer(): HTMLElement | null {
  return React.useContext(PanelDialogContainerContext)
}

function PanelDialog({
  open,
  onOpenChange,
  title,
  description,
  rootLabel,
  navLabel,
  groups,
  currentId,
  onSelect,
  back,
  navHeader,
  footer,
  overlays,
  closeLabel = "Schließen",
  navClassName,
  mainClassName,
  contentClassName,
  children,
  className,
  ref,
  ...props
}: PanelDialogProps) {
  const [navOpen, setNavOpen] = React.useState(false)
  const [panel, setPanel] = React.useState<HTMLDivElement | null>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const seenPageRef = React.useRef(false)

  const navName = navLabel ?? rootLabel

  // The panel is both the caller's ref target and the overlay container, so the
  // two are composed rather than one clobbering the other.
  const setPanelRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      setPanel(node)
      if (typeof ref === "function") {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    },
    [ref]
  )

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

  // The back row lives in the mobile nav too, and it can navigate inside the
  // panel or open the §0.7 `tryNav` discard dialog — either way the Sheet has to
  // go first, or the confirm renders under a still-open nav.
  const navBack = React.useMemo<PanelDialogBackAction | undefined>(() => {
    if (!back) {
      return undefined
    }
    return {
      ...back,
      onSelect: () => {
        setNavOpen(false)
        back.onSelect()
      },
    }
  }, [back])

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

  /**
   * §0.7: a page change scrolls the content pane back to the top and replays the
   * fade-up; §0.6 skips the motion under `prefers-reduced-motion`. The first
   * pass only records the page — the panel's own mount animation covers it.
   */
  React.useEffect(() => {
    const node = contentRef.current
    if (!node) {
      seenPageRef.current = false
      return
    }

    node.scrollTo({ top: 0 })

    const isFirstPage = !seenPageRef.current
    seenPageRef.current = true
    if (isFirstPage || typeof node.animate !== "function") {
      return
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return
    }

    node.animate(PANEL_DIALOG_PAGE_KEYFRAMES, PANEL_DIALOG_PAGE_TIMING)
  }, [currentId, open])

  // The picker's trigger is `display:none` above the breakpoint, so a resize
  // past it would otherwise strand an open Sheet with no way back to it. Only
  // the crossing is watched — the Sheet can only have been opened below 900px,
  // because that is the only width at which its trigger renders.
  React.useEffect(() => {
    if (!navOpen || typeof window === "undefined" || !window.matchMedia) {
      return
    }
    const mql = window.matchMedia(
      `(min-width: ${PANEL_DIALOG_BREAKPOINT}px)`
    )
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setNavOpen(false)
      }
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [navOpen])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Not `data-slot`: `DialogContent` sets `data-slot="dialog-content"` and
        // spreads `props` after it, so a second one would erase the primitive's
        // own marker and break every `[data-slot=dialog-content]` selector.
        data-panel-dialog=""
        ref={setPanelRef}
        tone="panel"
        size="shell"
        showCloseButton={false}
        className={cn(PANEL_DIALOG_SHELL_VARS, className)}
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

        <PanelDialogContainerContext.Provider value={panel}>
          <SidebarProvider
            className="h-full min-h-0"
            // Nothing here collapses (`collapsible="none"`), so the provider's
            // ⌘/Ctrl+B would only swallow the browser binding and set a cookie.
            keyboardShortcut={false}
          >
            {/* §2: the 296px column; below 900px the header picker replaces it. */}
            <Sidebar collapsible="none" className="hidden min-[900px]:flex">
              <PanelDialogNav
                aria-label={navName}
                groups={groups}
                isCurrent={isCurrent}
                onItemSelect={handleItemSelect}
                back={navBack}
                navHeader={navHeader}
                footer={footer}
                className={navClassName}
              />
            </Sidebar>

            <div
              data-slot="panel-dialog-main"
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col overflow-hidden",
                mainClassName
              )}
            >
              <header
                data-slot="panel-dialog-header"
                className={cn(
                  "flex h-[var(--panel-dialog-header-height)] shrink-0 items-center justify-between gap-[var(--space-5)]",
                  PANEL_DIALOG_INLINE_INSET
                )}
              >
                {/* One trail at every width. Above the breakpoint the leaf is the
                    page label; below it the leaf is the picker that opens the nav
                    (§15) — the root label never leaves the header. `Sheet` itself
                    renders no element, so the flex row keeps its two children. */}
                <Sheet open={navOpen} onOpenChange={setNavOpen}>
                  <Breadcrumb className="min-w-0">
                    <BreadcrumbList className="flex-nowrap">
                      {/* The root names this shell, so it is text, not a link. */}
                      <BreadcrumbItem className="shrink-0">
                        {rootLabel}
                      </BreadcrumbItem>

                      <BreadcrumbSeparator className="min-[900px]:hidden" />
                      <BreadcrumbItem className="min-w-0 min-[900px]:hidden">
                        <SheetTrigger asChild>
                          <button
                            type="button"
                            data-slot="panel-dialog-nav-trigger"
                            aria-haspopup="dialog"
                            aria-expanded={navOpen}
                            className="inline-flex h-[var(--panel-dialog-picker-height)] min-w-0 cursor-pointer items-center gap-[var(--space-3)] rounded-control-lg border border-rs-border-control bg-rs-surface-subtle px-[var(--space-6)] font-sans text-[length:var(--text-body-sm-size)] text-rs-ink transition-colors duration-[var(--duration-fast)] ease-out-soft hover:bg-rs-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange"
                          >
                            {/* The trigger's name is „{nav label} {current
                                page}“ — both dictionary values, so the control
                                says what it opens without inventing copy. */}
                            <span className="sr-only">{navName}</span>
                            <Icon name="list" size={18} />
                            <span className="truncate">
                              {currentLabel ?? rootLabel}
                            </span>
                            <Icon name="chevron-down" size={16} />
                          </button>
                        </SheetTrigger>
                      </BreadcrumbItem>

                      {currentLabel ? (
                        <>
                          <BreadcrumbSeparator className="hidden min-[900px]:flex" />
                          <BreadcrumbItem className="hidden min-w-0 min-[900px]:inline-flex">
                            <BreadcrumbPage className="truncate">
                              {currentLabel}
                            </BreadcrumbPage>
                          </BreadcrumbItem>
                        </>
                      ) : null}
                    </BreadcrumbList>
                  </Breadcrumb>

                  <SheetContent
                    side="left"
                    closeLabel={closeLabel}
                    className="w-[var(--width-settings-nav)] max-w-[calc(100%-var(--space-17))] p-0"
                    // The nav is its own landmark and needs no description; the
                    // attribute is Radix's explicit opt-out.
                    aria-describedby={undefined}
                  >
                    <SheetTitle className="sr-only">{navName}</SheetTitle>
                    <PanelDialogNav
                      placement="sheet"
                      aria-label={navName}
                      groups={groups}
                      isCurrent={isCurrent}
                      onItemSelect={handleItemSelect}
                      back={navBack}
                      navHeader={navHeader}
                      footer={footer}
                      className={navClassName}
                    />
                  </SheetContent>
                </Sheet>

                {/* §1.2 port delta: the × the prototype does not have. */}
                <DialogClose asChild>
                  <IconButton variant="outline" label={closeLabel}>
                    <Icon name="close" size={18} />
                  </IconButton>
                </DialogClose>
              </header>

              {/*
                The DS content column is the primary reading surface (§3) and a
                page can hold no focusable element at all, so the scroll port is
                a named, focusable region — otherwise a keyboard-only user cannot
                scroll it (WCAG 2.1.1).
              */}
              <div
                ref={contentRef}
                data-slot="panel-dialog-content"
                data-page={currentId}
                role="region"
                aria-label={currentLabel ?? rootLabel}
                tabIndex={0}
                className={cn(
                  "min-h-0 flex-1 overflow-auto [scrollbar-width:thin]",
                  "pt-[var(--space-11)] pb-[var(--space-13)] min-[900px]:pt-[var(--panel-dialog-inset-top)] min-[900px]:pb-[var(--space-17)]",
                  "outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rs-orange",
                  PANEL_DIALOG_INLINE_INSET,
                  contentClassName
                )}
              >
                {children}
              </div>
            </div>
          </SidebarProvider>

          {/* §1.2 / §16: the panel-scoped overlay layer, out of the grid and out
              of the scroll pane. `DialogContent` is `fixed`, so it is already the
              containing block these anchor to. */}
          {overlays ? (
            <div
              data-slot="panel-dialog-overlays"
              className="pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto"
            >
              {overlays}
            </div>
          ) : null}
        </PanelDialogContainerContext.Provider>
      </DialogContent>
    </Dialog>
  )
}

export { PanelDialog }
// `panelDialogNavVariants` is the nav column's class ladder (a screen can reuse
// the tree standalone) and `usePanelDialogContainer` is the documented way to
// scope an overlay to the panel. Neither is a plain constant, so the
// react-refresh rule cannot see them as one.
// eslint-disable-next-line react-refresh/only-export-components
export { panelDialogNavVariants, usePanelDialogContainer }
export type {
  PanelDialogProps,
  PanelDialogGroup,
  PanelDialogItem,
  PanelDialogBackAction,
}
