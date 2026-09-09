"use client"

import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Avatar as AvatarPrimitive } from "radix-ui"

/**
 * RoomScout initials circle — the shadcn/Radix Avatar restyled to the
 * design-system spec.
 *
 * DS reference: `design-system/components/core/avatar/`
 * (`Avatar.jsx`, `Avatar.d.ts`, `Avatar.prompt.md`, `avatar.card.html`).
 *
 * DS rule: **no photos, initials only** — "HB" / "OP", uppercased by the
 * caller (`docs/UI_PORT/COMPONENT_MAP.md` §E12 initials rule). The circle wears
 * the same outline treatment as an outline IconButton: 1px
 * `--rs-border-control` over `--rs-surface-subtle`, ink `--rs-ink`, weight 500.
 *
 * Sizing follows `Avatar.jsx`, which drives width/height and the initials
 * font-size from one number (`fontSize = round(size * .31)`). Here that number
 * lives in `--rs-avatar-size` / `--rs-avatar-font`, set by the `size` variant
 * or — for an arbitrary pixel size — inline:
 *   · `sm` 38px / 13px — narrow header (`hdrBtn` 38, TOKENS.md §353)
 *   · `default` `--size-header-button` (42px) / 13px — app + operator header
 *   · `lg` 72px / 22px — Settings profile circle
 *   · `size={52}` — any other DS instance (source avatar 52, landing 44)
 *
 * The shadcn API is preserved: `AvatarImage` / `AvatarFallback` /
 * `AvatarBadge` / `AvatarGroup` / `AvatarGroupCount`, every `data-slot`, the
 * `data-size` group hook and the `sm` / `default` / `lg` size names, so shadcn
 * blocks keep working. `interactive` is the DS addition (`Avatar.jsx` renders a
 * `button` when interactive); pair it with Radix `asChild` so the profile
 * control is a real button:
 *
 * ```tsx
 * <Avatar asChild interactive>
 *   <button type="button" aria-label="Profilmenü">
 *     <AvatarFallback>HB</AvatarFallback>
 *   </button>
 * </Avatar>
 * ```
 */

/** Named steps; every other DS instance passes a number. */
type AvatarSizeName = "sm" | "default" | "lg"
type AvatarSize = AvatarSizeName | number

/** `style` that may carry the two avatar custom properties. */
type AvatarStyle = React.CSSProperties & Record<`--${string}`, string>

const avatarVariants = cva(
  [
    "group/avatar relative flex shrink-0 items-center justify-center overflow-hidden select-none",
    "size-[var(--rs-avatar-size)] rounded-circle",
    "border border-rs-border-control bg-rs-surface-subtle",
    "font-sans text-[length:var(--rs-avatar-font)] leading-none font-medium text-rs-ink",
    "transition-[background-color,border-color] duration-[var(--duration-quick)] ease-out-soft",
    // DS hover ladder for the header control: surface .04 → .10.
    "data-[interactive]:cursor-pointer data-[interactive]:hover:bg-rs-surface-hover",
    // DS focus ring: 2px solid orange, 2px offset.
    "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "[--rs-avatar-size:38px] [--rs-avatar-font:13px]",
        default:
          "[--rs-avatar-size:var(--size-header-button)] [--rs-avatar-font:13px]",
        lg: "[--rs-avatar-size:72px] [--rs-avatar-font:22px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function isNamedSize(size: AvatarSize): size is AvatarSizeName {
  return typeof size === "string"
}

/** `Avatar.jsx`: fontSize = Math.round(size * .31). */
function customSize(size: number): AvatarStyle {
  return {
    "--rs-avatar-size": `${size}px`,
    "--rs-avatar-font": `${Math.round(size * 0.31)}px`,
  }
}

function Avatar({
  className,
  size = "default",
  interactive = false,
  style,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  /** `sm` 38 · `default` 42 · `lg` 72 · or an arbitrary pixel size. */
  size?: AvatarSize
  /** DS `interactive`: pointer cursor + the hover surface. Use with `asChild`. */
  interactive?: boolean
}) {
  const named = isNamedSize(size)

  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      data-interactive={interactive ? "true" : undefined}
      className={cn(
        avatarVariants({ size: named ? size : "default" }),
        className
      )}
      style={named ? style : { ...customSize(size), ...style }}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

/** The initials themselves — font-size and ink are inherited from the circle. */
function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-circle bg-transparent font-medium text-rs-ink",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute right-0 bottom-0 z-10 inline-flex size-2.5 items-center justify-center rounded-circle bg-rs-orange text-rs-white ring-2 ring-rs-surface-page select-none",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-2.5 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-rs-surface-page",
        className
      )}
      {...props}
    />
  )
}

/** The "+3" circle closing a group; tracks the group's own size step. */
function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "[--rs-avatar-size:var(--size-header-button)] [--rs-avatar-font:13px]",
        "group-has-data-[size=sm]/avatar-group:[--rs-avatar-size:38px]",
        "group-has-data-[size=lg]/avatar-group:[--rs-avatar-size:72px] group-has-data-[size=lg]/avatar-group:[--rs-avatar-font:22px]",
        "relative flex size-[var(--rs-avatar-size)] shrink-0 items-center justify-center rounded-circle",
        "border border-rs-border-control bg-rs-surface-subtle ring-2 ring-rs-surface-page",
        "font-sans text-[length:var(--rs-avatar-font)] leading-none font-medium text-rs-ink-6",
        "[&>svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
}
export type { AvatarSize }
