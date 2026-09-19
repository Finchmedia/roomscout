import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { BrandLockup } from "@/components/navigation/BrandLockup"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

/**
 * AppHeader — the top bar of every in-product RoomScout screen: wordmark left,
 * status + controls + profile right.
 *
 * DS reference: `design-system/components/navigation/app-header/`
 * (`AppHeader.jsx`, `AppHeader.d.ts`, `AppHeader.prompt.md`,
 * `app-header.card.html`). Prototype bindings:
 * `docs/UI_PORT/SCOUT_SCREENS.md` §2.4.
 *
 * Geometry verbatim from `AppHeader.jsx:7-13`, which matches the prototype's
 * `hdrH` / `hdrPad` / `markSize` / `hdrBtn` / `hdrGap` table 1:1:
 *   · height 84 (`--size-header`) → 64 narrow (`--size-header-narrow`)
 *   · padding-x 36 (`--space-16`) → 18 narrow (`--space-8`)
 *   · wordmark 20 (`size="default"`) → 17 narrow (`size="sm"`)
 *   · right-cluster gap 14 (`--space-6`) → 10 narrow (`--space-4`)
 *   · avatar 42 (`--size-header-button`, `size="default"`) → 38 narrow (`sm`)
 * Both wordmark steps go through `WORDMARK_SIZES` in `wordmark.tsx` rather than
 * a local literal, so the pair stays coupled: `default` resolves to the
 * `--text-wordmark-size` token, `sm` to the DS's 17 (`SCOUT_SCREENS.md` §2.4
 * `markSize`, `TOKENS.md` §353), which has no token of its own and is declared
 * once, in the wordmark's own size table.
 *
 * The avatar's **type size** does not follow `Avatar.jsx:6`'s
 * `fontSize = round(size * .31)` at the narrow step: the formula gives 12px for
 * a 38px circle, while `avatar.tsx`'s `sm` pins 13px. That is deliberate and
 * settled in `avatar.tsx` (§ Sizing) — `COMPONENT_MAP.md` §E12 and
 * `SCOUT_SCREENS.md` §2.4.3 both give the header profile control a fixed
 * `font-size:13px` and bind only the circle geometry (`hdrBtn` 42 → 38) to the
 * breakpoint. Do not "restore" 12px here.
 *
 * `flex:none` is kept (`flex-none`): the header never shrinks inside the stage
 * column. `position:relative;z-index:12` comes from SCOUT_SCREENS §2.4 — the
 * DS card renders the bar standalone, but on a screen it has to sit above the
 * three absolutely positioned background layers (§2.3). 12 is the named "app
 * header" level of the prototype's 16-level z scale (`TOKENS.md` § "The
 * z-index scale"), which `src/styles/tokens.css` has not ported yet; it is
 * written as `var(--z-app-header, 12)` so the scale can land in the token
 * layer without touching this file — the route `status-dot.tsx` takes for
 * `--rs-dot-idle`. See open questions.
 *
 * **No nav links here** (`AppHeader.prompt.md`) — the landing page header is a
 * different pattern. Everything between the wordmark and the avatar arrives
 * through `right`, which on the Scout surface is the autopilot pair from
 * SCOUT_SCREENS §2.4.1/§2.4.2 and the DS card:
 *
 * ```tsx
 * <AppHeader
 *   narrow={narrow}
 *   right={
 *     <>
 *       <StatusDot pulse>Scout ist unterwegs</StatusDot>
 *       <IconButton label="Suche pausieren"><Icon name="pause" size={16} /></IconButton>
 *     </>
 *   }
 *   onAvatar={toggleMenu}
 *   avatarExpanded={menuOpen}
 *   avatarMenu={menuOpen ? <ProfileMenu … /> : null}
 * />
 * ```
 *
 * `children` — declared by `AppHeader.d.ts` but dropped by its JSX — is the
 * JSX-children spelling of `right`: both render in the cluster, `right` first,
 * so a screen can mix a named slot with inline markup.
 *
 * ## The narrow contract for the right cluster
 * `narrow` is not only geometry: SCOUT_SCREENS §2.4's binding table also
 * carries `badgeTextVisible` (`true` desktop / `false` narrow), i.e. the Scout
 * badge drops its `<span>` label in narrow chrome and keeps the text as
 * `title` / `aria-label` only (§2.4.1: „the aria-label must survive the narrow
 * collapse“). That is a render decision, so the flag reaches the slot content
 * two ways:
 *   · `useAppHeaderNarrow()` — React context, for children that must *render*
 *     differently (the badge label, an icon-only fallback);
 *   · `data-narrow="true"` on the `<header>` and on the action cluster — the
 *     supported CSS hook (`group-data-[narrow=true]:…`, `[data-narrow] &`) for
 *     children that only need different styling.
 * A screen may of course still thread its own `narrow` prop; the context only
 * removes the obligation.
 *
 * ## Profile control
 * `onAvatar` turns the initials circle into a real `<button>` (DS
 * `interactive`), labelled „Profilmenü“ verbatim (`avatarLabel`) and marked
 * `aria-haspopup="menu"` after the prototype's profile control
 * (SCOUT_SCREENS §2.4.3); without it the circle is inert, as in the DS — and
 * still carries the label, because `AppHeader.jsx:13` passes `aria-label`
 * unconditionally and a bare „HB“ is read out as two letters. On a surface
 * that knows who is signed in, pass the user's name as `avatarLabel` instead.
 *
 * §2.4.3 also gives the control `aria-expanded="{{ menuOpen }}"` and wraps it
 * in a `position:relative` div so the menu panel can sit at
 * `position:absolute;right:0;top:52px`. Both are honoured here:
 * `avatarExpanded` writes the state (omitted entirely when undefined, so a
 * header with no menu does not claim one), `avatarMenu` renders into the
 * relative wrapper next to the button, and `avatarProps` is the escape hatch
 * for everything a real menu needs to wire up — `id`, `aria-controls`, a `ref`
 * for a positioning library. The menu's own markup, state and dismissal stay
 * with the owning screen; only its anchor lives here.
 */

const appHeaderVariants = cva(
  [
    // z-index/position per SCOUT_SCREENS §2.4 (above the background layers).
    // Named level 12 of the TOKENS.md z scale; fallback until it is ported.
    "relative z-[var(--z-app-header,12)] flex flex-none items-center justify-between",
    "font-sans text-rs-ink",
  ].join(" "),
  {
    variants: {
      narrow: {
        true: "h-[var(--size-header-narrow)] px-[var(--space-8)]",
        false: "h-[var(--size-header)] px-[var(--space-16)]",
      },
    },
    defaultVariants: {
      narrow: false,
    },
  }
)

/** The right cluster: `display:flex;align-items:center;gap:{{ hdrGap }}px`. */
const appHeaderActionsVariants = cva("flex items-center", {
  variants: {
    narrow: {
      true: "gap-[var(--space-4)]",
      false: "gap-[var(--space-6)]",
    },
  },
  defaultVariants: {
    narrow: false,
  },
})

/** DS default (`AppHeader.jsx:6`); the prototype derives it from the name. */
const DEFAULT_INITIALS = "HB"

/** German label, verbatim from `AppHeader.jsx:13`. */
const AVATAR_LABEL = "Profilmenü"

/**
 * `narrow`, as seen by the `right` / `children` slot content. `false` outside a
 * header, so a badge rendered on its own surface keeps its desktop form.
 */
const AppHeaderNarrowContext = React.createContext(false)

/**
 * Read the header's `narrow` flag from slot content — the render-time half of
 * the §2.4 narrow contract (`badgeTextVisible`), e.g.
 *
 * ```tsx
 * const narrow = useAppHeaderNarrow()
 * return narrow
 *   ? <StatusDot pulse aria-label={label} announce />
 *   : <StatusDot pulse announce>{label}</StatusDot>
 * ```
 */
function useAppHeaderNarrow(): boolean {
  return React.useContext(AppHeaderNarrowContext)
}

interface AppHeaderProps
  extends React.ComponentProps<"header">,
    VariantProps<typeof appHeaderVariants> {
  /** Narrow chrome: 64px tall, tighter padding, smaller mark and avatar. */
  narrow?: boolean
  /** Profile initials, uppercased by the caller. */
  initials?: string
  /** Right-side content before the avatar (StatusDot, pause IconButton). */
  right?: React.ReactNode
  /** JSX-children spelling of `right`: renders in the cluster, after `right`. */
  children?: React.ReactNode
  /** Makes the avatar a button and opens the profile menu. */
  onAvatar?: () => void
  /**
   * Accessible name of the profile circle. Defaults to the DS's „Profilmenü“;
   * pass the signed-in user's name when the circle is inert.
   */
  avatarLabel?: string
  /**
   * `aria-expanded` for the profile button (SCOUT_SCREENS §2.4.3). Leave
   * undefined when no menu is attached — the attribute is then omitted.
   */
  avatarExpanded?: boolean
  /**
   * The profile menu panel, rendered into the avatar's `position:relative`
   * wrapper so `right:0;top:52px` anchors to the circle. State and dismissal
   * stay with the owning screen.
   */
  avatarMenu?: React.ReactNode
  /**
   * Escape hatch onto the profile `<button>` — `id`, `aria-controls`, `ref`,
   * a menu library's trigger props. Spread after the defaults above (so it can
   * override them) but before `onClick`, which stays wired to `onAvatar`.
   */
  avatarProps?: React.ComponentProps<"button">
  /** A complete accessible menu trigger when a screen owns its Radix menu. */
  avatarSlot?: React.ReactNode
}

function AppHeader({
  className,
  narrow = false,
  initials = DEFAULT_INITIALS,
  right,
  onAvatar,
  avatarLabel = AVATAR_LABEL,
  avatarExpanded,
  avatarMenu,
  avatarProps,
  avatarSlot,
  children,
  ...props
}: AppHeaderProps) {
  const avatarSize = narrow ? "sm" : "default"
  const avatarInitials = <AvatarFallback>{initials}</AvatarFallback>

  return (
    <AppHeaderNarrowContext.Provider value={narrow}>
      <header
        data-slot="app-header"
        data-narrow={narrow ? "true" : undefined}
        className={cn(appHeaderVariants({ narrow }), className)}
        {...props}
      >
        <BrandLockup size={narrow ? "sm" : "default"} />
        <div
          data-slot="app-header-actions"
          data-narrow={narrow ? "true" : undefined}
          className={appHeaderActionsVariants({ narrow })}
        >
          {right}
          {children}
          {/* §2.4.3's `position:relative` wrapper — the menu's anchor. */}
          <div
            data-slot="app-header-avatar"
            className="relative flex flex-none items-center"
          >
            {avatarSlot ?? (onAvatar ? (
              <Avatar asChild interactive size={avatarSize}>
                <button
                  type="button"
                  aria-label={avatarLabel}
                  aria-haspopup="menu"
                  aria-expanded={avatarExpanded}
                  {...avatarProps}
                  onClick={onAvatar}
                >
                  {avatarInitials}
                </button>
              </Avatar>
            ) : (
              <Avatar size={avatarSize} label={avatarLabel}>
                {avatarInitials}
              </Avatar>
            ))}
            {avatarMenu}
          </div>
        </div>
      </header>
    </AppHeaderNarrowContext.Provider>
  )
}

export { AppHeader }
// The cva pairs are part of the shadcn public API (a screen can put the header
// chrome on an element it already renders), and `useAppHeaderNarrow` is the
// documented narrow contract for slot content. Neither is a plain constant, so
// the react-refresh rule cannot see them as one.
// eslint-disable-next-line react-refresh/only-export-components
export { appHeaderVariants, appHeaderActionsVariants, useAppHeaderNarrow }
export type { AppHeaderProps }
