"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Avatar as AvatarPrimitive } from "radix-ui"
import { statusDotVariants } from "@/components/ui/status-dot"

/**
 * RoomScout initials circle — the shadcn/Radix Avatar restyled to the
 * design-system spec.
 *
 * DS reference: `design-system/components/core/avatar/`
 * (`Avatar.jsx`, `Avatar.d.ts`, `Avatar.prompt.md`, `avatar.card.html`).
 * Prototype catalogue: `docs/UI_PORT/COMPONENT_MAP.md` §E12.
 *
 * DS rule: **no photos, initials only** — "HB" / "OP". The circle wears the
 * same outline treatment as an outline IconButton: 1px `--rs-border-control`
 * over `--rs-surface-subtle`, ink `--rs-ink`, weight 500.
 *
 * **Sizing.** `Avatar.jsx` drives width/height and the initials font-size from
 * one number (`fontSize = round(size * .31)`), but that formula only
 * reproduces the prototype at 42 and 72 — COMPONENT_MAP §E12 pins the header
 * avatar at 13px (round(38 * .31) would be 12) and the 52px source avatar at
 * 22px (the formula gives 16). So the DS instances are a table, not a formula:
 *   · `sm` 38px / 13px — narrow header (`hdrBtn` 38, TOKENS.md §353)
 *   · `default` `--size-header-button` (42px) / 13px — app + operator header
 *   · `lg` 72px / 22px — Settings profile circle
 *   · `size={52}` / 22px — Settings source avatar (`variant="source"`)
 *   · `size={44}` — landing provider circle (`variant="provider"`, glyph only)
 * Any other number falls back to the DS formula; override the type size with
 * `style={{ "--rs-avatar-font": "…" }}`, which wins over the class either way.
 * 13px and 22px have no token in `src/styles/tokens.css`
 * (`--text-caption-sm-size` is 13.5px, not 13px) and stay literal, the same
 * route `status-dot.tsx` takes for its 14.5px; 38 and 72 likewise have no
 * diameter token — only 42 does, via `--size-header-button`.
 *
 * The 38 ↔ 42 swap is the responsive `hdrBtn` binding (TOKENS.md §353), which
 * covers the header icon buttons *and* the avatar. It is deliberately **not** a
 * media query inside `default`: the operator avatar is a static 42
 * (`OPERATOR_SCREENS.md` §3.2) and `icon-button.tsx` does not embed it either.
 * `AppHeader` owns the breakpoint and passes `sm` / `default`.
 *
 * **API.** The shadcn surface (`Avatar` / `AvatarImage` / `AvatarFallback`,
 * `data-slot`, the `sm` / `default` / `lg` names) is preserved. `AvatarBadge`,
 * `AvatarGroup` and `AvatarGroupCount` are **additive** — neither shadcn/ui nor
 * the DS ships them, and no documented call site uses them; they exist for
 * blocks that expect the pattern and follow DS materials, not a DS spec.
 * `interactive`, `initials` and `size` come from `Avatar.d.ts`; `variant` and
 * `label` are the port's own.
 *
 * `interactive` renders a real `<button>` (DS `Avatar.jsx:5`
 * `const Tag = interactive ? 'button' : 'div'`), so the profile control is
 * keyboard-operable without the caller having to remember `asChild`:
 *
 * ```tsx
 * <Avatar interactive label="Profilmenü" aria-haspopup="menu" onClick={toggle}>
 *   <AvatarFallback>HB</AvatarFallback>
 * </Avatar>
 * ```
 *
 * Pass `asChild` when the trigger must be somebody else's element (a
 * DropdownMenu trigger); then the caller owns the tag and its ARIA. A static
 * avatar takes `label` to get `role="img"` + `aria-label` — Radix's bare `span`
 * is `role=generic`, where `aria-label` is ignored (`OPERATOR_SCREENS.md` §3.2
 * asks for `aria-label="Operator"`).
 *
 * The shared initials derivation (`'Herzbuben' → 'HB'`, first letters ×2,
 * uppercased, fallback `HB` / en-dash `–`; COMPONENT_MAP §E12,
 * `SETTINGS_SCREENS.md` §0.4) belongs in `src/lib/initials.ts` and is the
 * caller's job — this primitive only defaults to the DS's `'HB'`.
 */

/** DS default initials (`Avatar.jsx:4`, `avatar.card.html` `<Avatar/>`). */
const DEFAULT_INITIALS = "HB"

const avatarVariants = cva(
  [
    // DS `display:'inline-flex'`, `flex:'none'`, `padding:0` (Avatar.jsx:7).
    // `padding:0` matters once the tag is a real button.
    "group/avatar relative inline-flex shrink-0 items-center justify-center p-0 select-none",
    "size-(--rs-avatar-size) rounded-circle border",
    "font-sans text-[length:var(--rs-avatar-font)] leading-none font-medium",
    // DS `cursor: interactive ? 'pointer' : 'default'`.
    "cursor-default data-[interactive]:cursor-pointer",
    // DS hover ladder for the header control: surface .04 → .10. The DS avatar
    // itself declares no transition; the outline IconButton it borrows its
    // treatment from animates `background` only, so the transition is scoped to
    // the interactive circle and to the one property that ever changes.
    "data-[interactive]:hover:bg-rs-surface-hover",
    "data-[interactive]:transition-[background-color]",
    "data-[interactive]:duration-(--duration-quick) data-[interactive]:ease-out-soft",
    // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "[--rs-avatar-size:38px] [--rs-avatar-font:13px]",
        default:
          "[--rs-avatar-size:var(--size-header-button)] [--rs-avatar-font:13px]",
        lg: "[--rs-avatar-size:72px] [--rs-avatar-font:22px]",
      },
      /**
       * The three surface/border/ink triples COMPONENT_MAP §E12 lists.
       * `source` and `provider` need warm hairlines at .18 and .14 alpha, which
       * `src/styles/tokens.css` does not carry (it has .22
       * `--rs-border-control`, .3 `-strong`, .1 `--rs-border-divider`). Rather
       * than a raw `rgba()`, both are scaled off the .22 token with an opacity
       * modifier — .22 × .82 ≈ .18, .22 × .64 ≈ .14 — the route `stepper.tsx`
       * and `skeleton.tsx` take with `bg-rs-white/14`. See open questions.
       */
      variant: {
        /** R header · O operator · S profile — border .22, surface .04, ink. */
        default: "border-rs-border-control bg-rs-surface-subtle text-rs-ink",
        /** S source avatar (52) — border .18, surface .04, ink. */
        source: "border-rs-border-control/82 bg-rs-surface-subtle text-rs-ink",
        /** L provider circle (44) — border .14, surface .06, ink-2. */
        provider:
          "border-rs-border-control/64 bg-rs-surface-subtle-2 text-rs-ink-2",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  }
)

/** Named steps; every other DS instance passes a number. */
type AvatarSizeName = NonNullable<VariantProps<typeof avatarVariants>["size"]>
type AvatarSize = AvatarSizeName | number
type AvatarVariant = NonNullable<VariantProps<typeof avatarVariants>["variant"]>

/** `style` that may carry the two avatar custom properties. */
type AvatarStyle = React.CSSProperties & Record<`--${string}`, string>

/** Diameter of each named step, for `data-size-px`. */
const STEP_PX: Record<AvatarSizeName, number> = { sm: 38, default: 42, lg: 72 }

/** DS type size per documented diameter (COMPONENT_MAP §E12). */
const DS_FONT_PX: Record<number, number> = { 38: 13, 42: 13, 52: 22, 72: 22 }

function isNamedSize(size: AvatarSize): size is AvatarSizeName {
  return typeof size === "string"
}

/**
 * The step a numeric size reports through `data-size`, so the `group-data-`
 * hooks below always match one of the three names (a raw `data-size="52"`
 * matched none of them).
 */
function stepForPx(px: number): AvatarSizeName {
  if (px <= 40) return "sm"
  if (px >= 60) return "lg"
  return "default"
}

/** DS fallback for undocumented diameters: `Math.round(size * .31)`. */
function customSize(size: number): AvatarStyle {
  return {
    "--rs-avatar-size": `${size}px`,
    "--rs-avatar-font": `${DS_FONT_PX[size] ?? Math.round(size * 0.31)}px`,
  }
}

interface AvatarProps
  extends React.ComponentProps<typeof AvatarPrimitive.Root> {
  /** `sm` 38 · `default` 42 · `lg` 72 · or an arbitrary pixel size. */
  size?: AvatarSize
  /** DS surface/border/ink triple (COMPONENT_MAP §E12). */
  variant?: AvatarVariant
  /** DS `interactive`: renders a `<button>` unless `asChild` is given. */
  interactive?: boolean
  /** Accessible name. Static avatars also get `role="img"`. */
  label?: string
  /** DS `initials`, rendered as the fallback when no children are passed. */
  initials?: string
}

function Avatar({
  className,
  size = "default",
  variant = "default",
  interactive = false,
  asChild = false,
  label,
  initials,
  style,
  children,
  "aria-label": ariaLabel,
  ...props
}: AvatarProps) {
  const named = isNamedSize(size)
  const step = named ? size : stepForPx(size)
  const diameter = named ? STEP_PX[size] : size
  const custom = named ? undefined : customSize(size)

  // DS `Avatar.jsx:4` defaults `initials` to 'HB', which is what
  // `avatar.card.html`'s bare `<Avatar/>` renders. Composition wins when the
  // caller passes children (an AvatarFallback, an AvatarImage, a trigger).
  const content = children ?? (
    <AvatarFallback>{initials ?? DEFAULT_INITIALS}</AvatarFallback>
  )
  const name = label ?? ariaLabel
  // DS: `const Tag = interactive ? 'button' : 'div'`. `asChild` hands the tag
  // (and its ARIA) to the caller instead.
  const renderAsButton = interactive && !asChild

  return (
    <AvatarPrimitive.Root
      asChild={asChild || renderAsButton}
      data-slot="avatar"
      data-size={step}
      data-size-px={diameter}
      data-variant={variant}
      data-interactive={interactive ? "true" : undefined}
      aria-label={name}
      // Radix renders a bare `span` (role=generic), where `aria-label` is
      // dropped by AT; `role="img"` makes the labelled static avatar readable.
      role={!interactive && name ? "img" : undefined}
      className={cn(
        avatarVariants({ size: named ? size : null, variant }),
        className
      )}
      style={custom ? { ...custom, ...style } : style}
      {...props}
    >
      {renderAsButton ? <button type="button">{content}</button> : content}
    </AvatarPrimitive.Root>
  )
}

/**
 * The image slot. DS rule is initials-only; the one documented image instance
 * is the Settings source avatar — a 30×30 logo `object-fit:contain` inside the
 * 52px circle (COMPONENT_MAP §E12, `SETTINGS_SCREENS.md` §5.1) — so the image
 * keeps its intrinsic size, is centred by the circle's flex box and is never
 * cropped. A full-bleed picture opts in with
 * `className="size-full rounded-circle object-cover"`.
 */
function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("max-h-full max-w-full object-contain", className)}
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
        "flex size-full items-center justify-center rounded-circle bg-transparent font-medium",
        className
      )}
      {...props}
    />
  )
}

/**
 * Additive (no DS spec): a status dot pinned to the circle. It reuses
 * `statusDotVariants` so the tone map stays in one place, and sizes itself off
 * the space ladder via `--rs-dot-size`. The root is not `overflow-hidden` (the
 * DS circle never was), so the dot is not clipped away by the circle.
 */
function AvatarBadge({
  className,
  tone = "accent",
  ...props
}: React.ComponentProps<"span"> & {
  tone?: VariantProps<typeof statusDotVariants>["tone"]
}) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        statusDotVariants({ tone }),
        "absolute right-0 bottom-0 z-10 inline-flex items-center justify-center text-rs-white",
        "group-data-[size=sm]/avatar:[--rs-dot-size:var(--space-2)]",
        "group-data-[size=lg]/avatar:[--rs-dot-size:var(--space-4)]",
        "[&>svg]:size-[var(--rs-dot-size,var(--space-3))]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Additive (no DS spec): overlapping avatars. Separation comes from the
 * circles' own warm hairline — never from a ring in `--rs-surface-page`, which
 * is the palette's one opaque colour and would punch a hole in the background
 * grain stack.
 */
function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex items-center space-x-[calc(var(--space-2)*-1)]",
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
        avatarVariants({ size: "default", variant: "default" }),
        "group-has-data-[size=sm]/avatar-group:[--rs-avatar-size:38px]",
        "group-has-data-[size=lg]/avatar-group:[--rs-avatar-size:72px]",
        "group-has-data-[size=lg]/avatar-group:[--rs-avatar-font:22px]",
        "text-rs-ink-6 [&>svg]:size-(--rs-avatar-font)",
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
// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
export { avatarVariants }
export type { AvatarProps, AvatarSize, AvatarVariant }
