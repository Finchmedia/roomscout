import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Wordmark } from "@/components/ui/wordmark"
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
 *   · wordmark 20 (the `--text-wordmark-size` default) → 17 narrow
 *   · right-cluster gap 14 (`--space-6`) → 10 narrow (`--space-4`)
 *   · avatar 42 (`--size-header-button`, `size="default"`) → 38 narrow (`sm`)
 * `flex:none` is kept (`flex-none`): the header never shrinks inside the stage
 * column. `position:relative;z-index:12` comes from SCOUT_SCREENS §2.4 — the
 * DS card renders the bar standalone, but on a screen it has to sit above the
 * three absolutely positioned background layers (§2.3).
 *
 * **No nav links here** (`AppHeader.prompt.md`) — the landing page header is a
 * different pattern. Everything between the wordmark and the avatar arrives
 * through `right`, which on the Scout surface is the autopilot pair from
 * SCOUT_SCREENS §2.4.1/§2.4.2 and the DS card:
 *
 * ```tsx
 * <AppHeader
 *   right={
 *     <>
 *       <StatusDot pulse>Scout ist unterwegs</StatusDot>
 *       <IconButton label="Suche pausieren"><Icon name="pause" size={16} /></IconButton>
 *     </>
 *   }
 *   onAvatar={toggleMenu}
 * />
 * ```
 *
 * `children` — declared by `AppHeader.d.ts` but dropped by its JSX — is the
 * JSX-children spelling of `right`: both render in the cluster, `right` first,
 * so a screen can mix a named slot with inline markup.
 *
 * `onAvatar` turns the initials circle into a real `<button>` (DS
 * `interactive`), labelled „Profilmenü“ verbatim and marked
 * `aria-haspopup="menu"` after the prototype's profile control
 * (SCOUT_SCREENS §2.4.3); without it the circle is inert, as in the DS. The
 * menu itself is not part of this component — the owning screen renders it and
 * toggles it from `onAvatar`.
 */

const appHeaderVariants = cva(
  [
    // z-index/position per SCOUT_SCREENS §2.4 (above the background layers).
    "relative z-[12] flex flex-none items-center justify-between",
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

/** Narrow wordmark size; 20 is the token default, so only 17 is ever passed. */
const NARROW_MARK_SIZE = 17

interface AppHeaderProps extends React.ComponentProps<"header"> {
  /** Narrow chrome: 64px tall, tighter padding, smaller mark and avatar. */
  narrow?: boolean
  /** Profile initials, uppercased by the caller. */
  initials?: string
  /** Right-side content before the avatar (StatusDot, pause IconButton). */
  right?: React.ReactNode
  /** Makes the avatar a button and opens the profile menu. */
  onAvatar?: () => void
}

function AppHeader({
  className,
  narrow = false,
  initials = DEFAULT_INITIALS,
  right,
  onAvatar,
  children,
  ...props
}: AppHeaderProps) {
  const avatarSize = narrow ? "sm" : "default"
  const avatarInitials = <AvatarFallback>{initials}</AvatarFallback>

  return (
    <header
      data-slot="app-header"
      data-narrow={narrow ? "true" : undefined}
      className={cn(appHeaderVariants({ narrow }), className)}
      {...props}
    >
      <Wordmark size={narrow ? NARROW_MARK_SIZE : undefined} />
      <div
        data-slot="app-header-actions"
        className={appHeaderActionsVariants({ narrow })}
      >
        {right}
        {children}
        {onAvatar ? (
          <Avatar asChild interactive size={avatarSize}>
            <button
              type="button"
              aria-label={AVATAR_LABEL}
              aria-haspopup="menu"
              onClick={onAvatar}
            >
              {avatarInitials}
            </button>
          </Avatar>
        ) : (
          <Avatar size={avatarSize}>{avatarInitials}</Avatar>
        )}
      </div>
    </header>
  )
}

export { AppHeader }
export type { AppHeaderProps }
