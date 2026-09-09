import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * Switch — shadcn primitive restyled to the RoomScout design system.
 *
 * DS spec: `design-system/components/forms/switch/{Switch.jsx,Switch.d.ts,switch.card.html}`
 * (see also `docs/UI_PORT/SETTINGS_SCREENS.md` §3.3, the shared toggle).
 *
 * 56×32 track (`--size-switch-w` / `--size-switch-h`), fully rounded, no border:
 * orange when on, white .14 when off, `.2s` background transition. The knob is a
 * 26px white circle inset by 3px, carrying `--shadow-knob`, travelling 24px
 * (= track width − track height). Disabled fades to .5 with a default cursor.
 *
 * All geometry derives from the two DS size tokens through the local
 * `--rs-switch-*` custom properties, so the `sm` variant scales without
 * introducing off-token pixel values.
 *
 * The Radix API is untouched (`checked` / `onCheckedChange` / `disabled` / …),
 * as are the shadcn `data-slot` / `data-size` hooks, so installed shadcn blocks
 * keep working. `label` is the one DS addition: it fills in `aria-label`.
 */
const switchVariants = cva(
  [
    "peer group/switch inline-flex shrink-0 cursor-pointer items-center",
    "h-[var(--rs-switch-h)] w-[var(--rs-switch-w)] rounded-pill border-0 p-[var(--rs-switch-inset)]",
    "bg-rs-white/14 data-[state=checked]:bg-rs-orange",
    "transition-colors duration-[var(--duration-quick)] ease-out-soft",
    // DS focus ring: outline 2px solid orange, 2px offset (TOKENS.md F17).
    // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
    "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
    "disabled:cursor-default disabled:opacity-50",
  ],
  {
    variants: {
      size: {
        default: [
          "[--rs-switch-w:var(--size-switch-w)]",
          "[--rs-switch-h:var(--size-switch-h)]",
          "[--rs-switch-inset:3px]",
        ],
        sm: [
          "[--rs-switch-w:calc(var(--size-switch-w)_*_0.75)]",
          "[--rs-switch-h:calc(var(--size-switch-h)_*_0.75)]",
          "[--rs-switch-inset:2px]",
        ],
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

/**
 * The knob: a white circle that fills the track minus its inset (26px at the
 * default size) and travels `track width − track height` (24px), so both follow
 * the size tokens instead of a hard-coded pixel pair.
 */
const SWITCH_THUMB = [
  "pointer-events-none block size-[calc(var(--rs-switch-h)_-_var(--rs-switch-inset)_*_2)]",
  "rounded-circle bg-rs-white shadow-knob ring-0",
  "transition-transform duration-[var(--duration-quick)] ease-out-soft",
  "data-[state=unchecked]:translate-x-0",
  "data-[state=checked]:translate-x-[calc(var(--rs-switch-w)_-_var(--rs-switch-h))]",
].join(" ")

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> &
  VariantProps<typeof switchVariants> & {
    /**
     * DS convenience prop: used as `aria-label` when no explicit `aria-label`
     * is passed. The DS toggle is always label-less, so every call site ships
     * the row copy here (e.g. `label="Anbieter kontaktieren"`).
     */
    label?: string
  }

function Switch({
  className,
  size = "default",
  label,
  "aria-label": ariaLabel,
  ...props
}: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size ?? "default"}
      aria-label={ariaLabel ?? label}
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={SWITCH_THUMB} />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
export type { SwitchProps }
