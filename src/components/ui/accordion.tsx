import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"

/**
 * Accordion — shadcn/ui primitive restyled to the RoomScout design system.
 *
 * DS reference:
 * - `design-system/components/navigation/accordion/{Accordion.jsx,Accordion.d.ts,accordion.card.html}`
 * - `docs/UI_PORT/LANDING_SCREENS.md` §11 „Kontrolle & FAQ" (`#control`)
 * - `docs/UI_PORT/COMPONENT_MAP.md` E9 · Accordion row (FAQ flavour)
 *
 * The DS ships exactly one accordion: the landing-page FAQ row — an 18px card
 * (`--radius-card-md`) on `--rs-surface-card-faint`, hairline `--rs-border-card`
 * that warms to `--rs-border-accent-faint` while open, a 22/26px trigger at
 * `clamp(18px,1.5vw,22px)` in `--rs-ink`, and a circled plus that rotates 180°
 * into a minus. That is the `faq` variant and it is the default, so DS screens
 * get the RoomScout treatment without opting in. The untouched shadcn treatment
 * stays available as `variant="default"` — the base the two app-side flavours
 * (Settings source row, Operator integration row, both hairline lists with a
 * chevron) build on, since the DS specs those per screen, not as a component.
 *
 * Deviations from the raw DS source, all deliberate:
 * - The DS animates `grid-template-rows: 0fr → 1fr`, which needs the panel
 *   mounted while closed. Radix unmounts it and only awaits *animations*, so
 *   the height keyframes stay (explicitly allowed by COMPONENT_MAP E9) with the
 *   DS timing kept: `.32s var(--ease-out-snap)`.
 * - `--ease-out-snap` is also used for the indicator rotation, where the DS
 *   leaves the browser default `ease` implicit (`transition:transform .3s`).
 * - `heading` defaults to `false` for `faq`: the prototype's FAQ question is a
 *   `<span>` in a `<button>`, not an `<h3>` (LANDING_SCREENS.md §1.8 heading
 *   census). `variant="default"` keeps Radix's `<h3>` header.
 *
 * Value note: the open border is `--rs-border-accent-faint` per the DS source.
 * `LANDING_SCREENS.md` §11 measured `rgba(255,105,38,.7)` on the prototype,
 * which has no token; the DS component is the spec, so it wins here.
 *
 * The Radix API (`type`, `collapsible`, `value` / `defaultValue`, `onValueChange`,
 * …) and the shadcn `data-slot` hooks are untouched, so installed shadcn blocks
 * keep working.
 */

type AccordionVariant = "default" | "faq"

const AccordionVariantContext =
  React.createContext<AccordionVariant>("faq")

/** Resolves the variant of a sub-part: explicit prop first, then the Root's. */
function useAccordionVariant(
  override?: AccordionVariant | null
): AccordionVariant {
  const inherited = React.useContext(AccordionVariantContext)
  return override ?? inherited
}

/** DS: the FAQ list is `display:flex;flex-direction:column;gap:12px`. */
const accordionVariants = cva("", {
  variants: {
    variant: {
      default: "",
      faq: "flex flex-col gap-[var(--space-5)]",
    },
  },
  defaultVariants: {
    variant: "faq",
  },
})

/**
 * DS: `border-radius:18px;border:1px solid var(--rs-border-card);
 * background:var(--rs-surface-card-faint);transition:border-color .3s`, the
 * border warming to `var(--rs-border-accent-faint)` while the item is open.
 */
const accordionItemVariants = cva("", {
  variants: {
    variant: {
      default: "border-b last:border-b-0",
      faq: "rounded-card-md border border-rs-border-card bg-rs-surface-card-faint transition-[border-color] duration-[var(--duration-base)] data-[state=open]:border-rs-border-accent-faint",
    },
  },
  defaultVariants: {
    variant: "faq",
  },
})

/**
 * DS: `width:100%;display:flex;justify-content:space-between;align-items:center;
 * gap:20px;padding:22px 26px;border:0;background:none;color:var(--rs-ink);
 * font:inherit;font-size:clamp(18px,1.5vw,22px);text-align:left;cursor:pointer;
 * border-radius:18px`, plus the DS focus ring (2px orange, 2px offset).
 */
const accordionTriggerVariants = cva("group/accordion-trigger", {
  variants: {
    variant: {
      default:
        "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
      faq: "flex w-full flex-1 cursor-pointer items-center justify-between gap-[var(--space-9)] rounded-card-md border-0 bg-transparent px-[var(--space-12)] py-[var(--space-10)] text-left text-[length:clamp(18px,1.5vw,22px)] font-normal text-rs-ink outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange disabled:pointer-events-none disabled:opacity-50",
    },
  },
  defaultVariants: {
    variant: "faq",
  },
})

/**
 * DS: `width:36px;height:36px;border-radius:50%;
 * border:1px solid var(--rs-border-control-strong);transition:transform .3s`,
 * rotated 180° while open.
 */
const accordionIndicatorVariants = cva(
  "pointer-events-none flex shrink-0 items-center justify-center",
  {
    variants: {
      variant: {
        default: "size-4 translate-y-0.5 text-muted-foreground",
        faq: "size-[var(--size-button-2xs)] rounded-circle border border-rs-border-control-strong transition-transform duration-[var(--duration-base)] ease-out-snap group-data-[state=open]/accordion-trigger:rotate-180",
      },
    },
    defaultVariants: {
      variant: "faq",
    },
  }
)

/**
 * DS panel: the height keyframes carry the DS timing
 * (`.32s cubic-bezier(.3,.7,.2,1)` = `--ease-out-snap`); `text-rs-ink-4` at
 * 16px/1.6 is the answer copy.
 */
const accordionContentVariants = cva("overflow-hidden", {
  variants: {
    variant: {
      default:
        "text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      faq: "text-[length:var(--text-body-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4 data-[state=closed]:animate-[accordion-up_.32s_var(--ease-out-snap)] data-[state=open]:animate-[accordion-down_.32s_var(--ease-out-snap)]",
    },
  },
  defaultVariants: {
    variant: "faq",
  },
})

/** DS answer box: `padding:0 26px 24px`. */
const accordionContentBodyVariants = cva("", {
  variants: {
    variant: {
      default: "pt-0 pb-4",
      faq: "px-[var(--space-12)] pt-0 pb-[var(--space-11)]",
    },
  },
  defaultVariants: {
    variant: "faq",
  },
})

/** The DS plus→minus glyph: the vertical stroke fades out while open. */
function AccordionPlusMinusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
      <path
        d="M12 5v14"
        className="transition-opacity duration-[var(--duration-quick)] group-data-[state=open]/accordion-trigger:opacity-0"
      />
    </svg>
  )
}

type AccordionProps = React.ComponentProps<typeof AccordionPrimitive.Root> &
  VariantProps<typeof accordionVariants>

function Accordion({ className, variant, ...props }: AccordionProps) {
  const resolved: AccordionVariant = variant ?? "faq"

  return (
    <AccordionVariantContext.Provider value={resolved}>
      <AccordionPrimitive.Root
        data-slot="accordion"
        data-variant={resolved}
        className={cn(accordionVariants({ variant: resolved }), className)}
        {...props}
      />
    </AccordionVariantContext.Provider>
  )
}

type AccordionItemProps = React.ComponentProps<typeof AccordionPrimitive.Item> &
  VariantProps<typeof accordionItemVariants>

function AccordionItem({ className, variant, ...props }: AccordionItemProps) {
  const resolved = useAccordionVariant(variant)

  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      data-variant={resolved}
      className={cn(accordionItemVariants({ variant: resolved }), className)}
      {...props}
    />
  )
}

type AccordionTriggerProps = React.ComponentProps<
  typeof AccordionPrimitive.Trigger
> &
  VariantProps<typeof accordionTriggerVariants> & {
    /**
     * Replaces the variant's indicator (`faq`: the circled plus/minus,
     * `default`: shadcn's chevron). Pass `null` to render none.
     */
    icon?: React.ReactNode
    /**
     * Wrap the trigger in Radix's `<h3>` header. Defaults to `false` for the
     * `faq` variant — the prototype's FAQ question is a `<span>` in a
     * `<button>` (LANDING_SCREENS.md §1.8) — and to `true` otherwise.
     */
    heading?: boolean
  }

function AccordionTrigger({
  className,
  children,
  variant,
  icon,
  heading,
  ...props
}: AccordionTriggerProps) {
  const resolved = useAccordionVariant(variant)
  const asHeading = heading ?? resolved !== "faq"

  const trigger = (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      data-variant={resolved}
      className={cn(
        accordionTriggerVariants({ variant: resolved }),
        className
      )}
      {...props}
    >
      {children}
      {icon === undefined ? (
        <span
          data-slot="accordion-indicator"
          className={cn(accordionIndicatorVariants({ variant: resolved }))}
        >
          {resolved === "faq" ? (
            <AccordionPlusMinusIcon />
          ) : (
            <ChevronDownIcon className="size-4 transition-transform duration-[var(--duration-quick)] ease-out-snap group-data-[state=open]/accordion-trigger:rotate-180" />
          )}
        </span>
      ) : (
        icon
      )}
    </AccordionPrimitive.Trigger>
  )

  return asHeading ? (
    <AccordionPrimitive.Header data-slot="accordion-header" className="flex">
      {trigger}
    </AccordionPrimitive.Header>
  ) : (
    <AccordionPrimitive.Header asChild>
      <div data-slot="accordion-header" className="flex">
        {trigger}
      </div>
    </AccordionPrimitive.Header>
  )
}

type AccordionContentProps = React.ComponentProps<
  typeof AccordionPrimitive.Content
> &
  VariantProps<typeof accordionContentVariants>

function AccordionContent({
  className,
  children,
  variant,
  ...props
}: AccordionContentProps) {
  const resolved = useAccordionVariant(variant)

  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      data-variant={resolved}
      className={cn(accordionContentVariants({ variant: resolved }))}
      {...props}
    >
      <div
        className={cn(
          accordionContentBodyVariants({ variant: resolved }),
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
export type {
  AccordionProps,
  AccordionItemProps,
  AccordionTriggerProps,
  AccordionContentProps,
  AccordionVariant,
}
