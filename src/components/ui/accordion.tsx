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
 * - `docs/UI_PORT/SETTINGS_SCREENS.md` §6 source row · `OPERATOR_SCREENS.md` §8
 * - `docs/UI_PORT/COMPONENT_MAP.md` E9 · Accordion row (three flavours)
 *
 * `COMPONENT_MAP.md` E9 maps **three** DS accordion flavours onto this one
 * primitive, so all three ship here as variants; `default` is upstream shadcn,
 * kept only as a compatibility shim for installed blocks (no DS surface uses
 * it). The `default` variant of *this file* is `faq`, so DS screens get the
 * RoomScout treatment without opting in.
 *
 * | variant | surface | signature |
 * | --- | --- | --- |
 * | `faq` | L §11 | 18px card (`--radius-card-md`) on `--rs-surface-card-faint`, hairline `--rs-border-card` warming to `--rs-orange/70` while open, `clamp(18px,1.5vw,22px)` question in `--rs-ink`, circled plus that rotates into a minus, `.32s` `--ease-out-snap` panel |
 * | `source` | S §6 | 18px wrapper, transparent until open (then `#fff` @3.5% on `--rs-border-card`, +8px gap below), `.25s` background/border, 36px ghost chevron button, `.26s` `--ease-out-snap` panel over a `--rs-border-divider` rule |
 * | `integration` | O §8 | `--rs-border-divider` bottom rule, 4-cell grid trigger (`1.2fr 1.3fr 1fr auto`) at 16px with a `#fff` @4% hover, 16px chevron at `--duration-quick`, auto-fit panel at 14.5px/1.6 |
 * | `default` | — | verbatim shadcn, except the DS focus ring (see below) |
 *
 * Both app-side flavours are **controlled** accordions (`openInt` / `expanded`
 * are written by the overview tiles too — E9): pass `value` + `onValueChange`.
 * Their content-specific grid children stay in the screen components
 * (`src/ui/settings/SourceRow.tsx`, `src/ui/operator/IntegrationRow.tsx`); this
 * file ships the chrome, the timings and the states.
 *
 * DS ↔ Radix API map — the DS ships a single self-contained item
 * (`Accordion.d.ts`: `{ question, defaultOpen, children, style }`), this is the
 * four-part Radix composition, so its own snippets do not compile 1:1:
 * - `question` → `<AccordionTrigger>` children · `defaultOpen` → `defaultValue`
 * - `accordion.card.html` renders two independent items → `type="multiple"`
 * - the landing FAQ is `type="single" collapsible defaultValue="item-0"`
 *   (COMPONENT_MAP E9: item 0 is open on load)
 *
 * ```tsx
 * <Accordion type="single" collapsible defaultValue="item-0">
 *   <AccordionItem value="item-0">
 *     <AccordionTrigger>Was darf der Scout selbstständig tun?</AccordionTrigger>
 *     <AccordionContent>Er recherchiert und fragt unverbindlich an.</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 * ```
 *
 * Deviations from the raw DS source, all deliberate:
 * - The DS animates `grid-template-rows: 0fr → 1fr`, which needs the panel
 *   mounted while closed. Radix unmounts it and only awaits *animations*, so
 *   the height keyframes stay (explicitly allowed by COMPONENT_MAP E9) with the
 *   DS timings kept: `.32s` (`faq`) / `.26s` (`source`) `--ease-out-snap`.
 * - `heading` defaults to `true` for every variant: DECISIONS.md §3.7 #49
 *   („Improve the outline … accordion triggers keep shadcn's `h3` wrapper")
 *   overrides the prototype's `<span>`-in-a-`<button>` (LANDING_SCREENS.md
 *   §1.8/§11). The Settings source row passes `heading={false}` — there the
 *   trigger is an icon-only „Details" control and the row title lives in the
 *   head grid, so an `<h3>` would put „Details" in the document outline.
 * - `default` keeps upstream's raw steps (`text-sm`, `hover:underline`,
 *   `animate-accordion-*` at `.2s ease-out`) because it exists to render
 *   installed blocks unchanged — but the DS focus ring (2px orange, 2px offset,
 *   `readme.md`) replaces upstream's `focus-visible:ring-[3px]` halo on *all*
 *   variants, because that ring is a system-wide rule.
 * - The indicator lives in a `<span data-slot="accordion-indicator">` in every
 *   variant (the DS's circled glyph needs the frame), so the chevron is **not**
 *   a direct child of the trigger: an installed block that targets `[&>svg]` on
 *   the trigger must target `[&_svg]` instead. Upstream's
 *   `[&[data-state=open]>svg]:rotate-180` is dropped for the same reason — it
 *   could never match the built-in chevron and only ever rotated a caller's
 *   bare `icon`.
 *
 * Value notes:
 * - Open FAQ border = `--rs-orange` at 70% (`border-rs-orange/70` ≡
 *   `rgba(255,105,38,.7)`): LANDING_SCREENS.md §11, COMPONENT_MAP E9 and
 *   TOKENS.md all measure that value; only `Accordion.jsx` — a simplified
 *   recreation — reaches for `--rs-border-accent-faint` (`rgba(255,140,90,.3)`),
 *   which is a different hue at a third of the alpha. The three measured
 *   sources win. (There is no flat token for it; the opacity modifier on the
 *   brand orange is this repo's way of writing one — cf. `input.tsx`.)
 * - Every transition names its easing explicitly: without `ease-[ease]`
 *   Tailwind substitutes its own `cubic-bezier(.4,0,.2,1)` where the DS relies
 *   on the CSS default `ease` (cf. `switch.tsx`).
 * - The panel durations `.32s` / `.26s`, the row duration `.25s` and the
 *   question ramp `clamp(18px,1.5vw,22px)` have no token in `tokens.css`
 *   (`--duration-quick .2s` / `--duration-base .3s` / `--duration-slow .5s`).
 *   Each is written once, as a named local custom property where it is used
 *   more than once; they want real tokens (`--duration-accordion`,
 *   `--duration-accordion-row`, `--text-faq-question-size`).
 *
 * The Radix API (`type`, `collapsible`, `value` / `defaultValue`, `onValueChange`,
 * …) and the shadcn `data-slot` hooks are untouched.
 */

type AccordionVariant = "default" | "faq" | "source" | "integration"

/** Single source of truth for the default, shared by the cvas and the parts. */
const ACCORDION_DEFAULT_VARIANT: AccordionVariant = "faq"

const AccordionVariantContext = React.createContext<AccordionVariant>(
  ACCORDION_DEFAULT_VARIANT
)

/** Resolves the variant of a sub-part: explicit prop first, then the Root's. */
function useAccordionVariant(
  override?: AccordionVariant | null
): AccordionVariant {
  const inherited = React.useContext(AccordionVariantContext)
  return override ?? inherited
}

/**
 * DS focus ring: 2px orange outline, 2px offset (`readme.md`).
 * `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
 */
const ACCORDION_FOCUS_RING =
  "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange"

/**
 * DS lists: L FAQ `display:flex;flex-direction:column;gap:12px`; the S source
 * list and the O integration list are the same column without a gap (their rows
 * carry their own separation — an 8px margin while open / a bottom hairline).
 */
const accordionVariants = cva("", {
  variants: {
    variant: {
      default: "",
      faq: "flex flex-col gap-[var(--space-5)]",
      source: "flex flex-col",
      integration: "flex flex-col",
    },
  },
  defaultVariants: {
    variant: ACCORDION_DEFAULT_VARIANT,
  },
})

/**
 * The item root carries the DS's inheritance contract (`font-family`, `color`),
 * so recolouring the item reaches the question too — the DS button is
 * `color:inherit;font:inherit`.
 *
 * - `faq`: `border-radius:18px;border:1px solid var(--rs-border-card);
 *   background:var(--rs-surface-card-faint);transition:border-color .3s`, the
 *   border warming to `rgba(255,105,38,.7)` while open.
 * - `source`: `border-radius:18px;background:{{ rowBg }};border:1px solid
 *   {{ rowBorder }};margin-bottom:{{ mb }}px;transition:background .25s,
 *   border-color .25s` — open `rgba(255,255,255,.035)` / `--rs-border-card` / 8px,
 *   closed transparent / transparent / 0.
 * - `integration`: `border-bottom:1px solid rgba(255,220,190,.1)`.
 */
const accordionItemVariants = cva("", {
  variants: {
    variant: {
      default: "border-b last:border-b-0",
      faq: "rounded-card-md border border-rs-border-card bg-rs-surface-card-faint font-sans text-rs-ink transition-[border-color] duration-[var(--duration-base)] ease-[ease] data-[state=open]:border-rs-orange/70",
      // `.25s` has no token — see the value note in the file docblock.
      source:
        "rounded-card-md border border-transparent bg-transparent font-sans text-rs-ink transition-[background-color,border-color] duration-[.25s] ease-[ease] data-[state=open]:mb-[var(--space-3)] data-[state=open]:border-rs-border-card data-[state=open]:bg-rs-white/[3.5%]",
      integration: "border-b border-b-rs-border-divider font-sans text-rs-ink",
    },
  },
  defaultVariants: {
    variant: ACCORDION_DEFAULT_VARIANT,
  },
})

/**
 * - `faq`: `width:100%;display:flex;justify-content:space-between;
 *   align-items:center;gap:20px;padding:22px 26px;border:0;background:none;
 *   color:inherit;font:inherit;font-size:clamp(18px,1.5vw,22px);text-align:left;
 *   cursor:pointer;border-radius:18px`. `leading-[normal]` restores the DS's
 *   `font:inherit` on a page with no `line-height`: Tailwind's preflight would
 *   otherwise hand the button `1.5`, making a wrapped question ~25% taller.
 * - `source`: the row's expand control only — a 36px round ghost button
 *   (`color:#e2d3c3`, hover `rgba(255,255,255,.08)`); avatar, name, status and
 *   the switch are siblings in the screen's head grid, *not* trigger children
 *   (the row's `Switch` is a button and may not nest inside this one).
 * - `integration`: `width:100%;display:grid;
 *   grid-template-columns:1.2fr 1.3fr 1fr auto;gap:14px;align-items:center;
 *   padding:16px 10px;border:0;background:none;font-size:16px;
 *   border-radius:10px` + hover `rgba(255,255,255,.04)`. The column ratio is the
 *   DS default and stays overridable through `className`.
 */
const accordionTriggerVariants = cva(
  [
    "group/accordion-trigger",
    ACCORDION_FOCUS_RING,
    "disabled:pointer-events-none disabled:opacity-50",
  ],
  {
    variants: {
      variant: {
        default:
          "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all hover:underline",
        faq: "flex w-full flex-1 cursor-pointer items-center justify-between gap-[var(--space-9)] rounded-card-md border-0 bg-transparent px-[var(--space-12)] py-[var(--space-10)] text-left text-[length:clamp(18px,1.5vw,22px)] leading-[normal] font-normal",
        source:
          "flex size-[var(--size-button-2xs)] cursor-pointer items-center justify-center rounded-circle border-0 bg-transparent p-0 text-rs-ink-2 hover:bg-rs-white/8",
        integration:
          "grid w-full cursor-pointer grid-cols-[1.2fr_1.3fr_1fr_auto] items-center gap-[var(--space-6)] rounded-control border-0 bg-transparent px-[var(--space-4)] py-[var(--space-7)] text-left text-[length:var(--text-body-size)] leading-[normal] font-normal hover:bg-rs-surface-subtle",
      },
    },
    defaultVariants: {
      variant: ACCORDION_DEFAULT_VARIANT,
    },
  }
)

/**
 * The indicator frame, rotated 180° while open.
 * - `faq`: `width:36px;height:36px;border-radius:50%;
 *   border:1px solid var(--rs-border-control-strong);transition:transform .3s`.
 * - `source`: an 18×18 chevron at `.25s` · `integration`: 16×16 at `.2s`.
 */
const accordionIndicatorVariants = cva(
  "pointer-events-none flex shrink-0 items-center justify-center",
  {
    variants: {
      variant: {
        default: "size-4 translate-y-0.5 text-muted-foreground",
        faq: "size-[var(--size-button-2xs)] rounded-circle border border-rs-border-control-strong transition-transform duration-[var(--duration-base)] ease-[ease] group-data-[state=open]/accordion-trigger:rotate-180",
        // `.25s` has no token — see the value note in the file docblock.
        source:
          "size-[18px] transition-transform duration-[.25s] ease-[ease] group-data-[state=open]/accordion-trigger:rotate-180",
        integration:
          "size-4 transition-transform duration-[var(--duration-quick)] ease-[ease] group-data-[state=open]/accordion-trigger:rotate-180",
      },
    },
    defaultVariants: {
      variant: ACCORDION_DEFAULT_VARIANT,
    },
  }
)

/**
 * DS panels: the height keyframes carry the DS timings
 * (`.32s` / `.26s cubic-bezier(.3,.7,.2,1)` = `--ease-out-snap`), declared once
 * as a local custom property because the class needs them twice.
 * Copy: L answer `--text-body-size`/1.6 in `--rs-ink-4`; S body 15px/1.6 in
 * `--rs-ink-2`; O panel 14.5px/1.6 in `--rs-ink-4`.
 */
const accordionContentVariants = cva("overflow-hidden", {
  variants: {
    variant: {
      default:
        "text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
      faq: "text-[length:var(--text-body-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4 [--rs-accordion-panel-duration:.32s] data-[state=closed]:animate-[accordion-up_var(--rs-accordion-panel-duration)_var(--ease-out-snap)] data-[state=open]:animate-[accordion-down_var(--rs-accordion-panel-duration)_var(--ease-out-snap)]",
      source:
        "text-[length:var(--text-body-sm-size)] leading-[var(--text-body-leading-relaxed)] text-rs-ink-2 [--rs-accordion-panel-duration:.26s] data-[state=closed]:animate-[accordion-up_var(--rs-accordion-panel-duration)_var(--ease-out-snap)] data-[state=open]:animate-[accordion-down_var(--rs-accordion-panel-duration)_var(--ease-out-snap)]",
      // O: the prototype fades the panel in (`opFade .2s ease`); Radix's height
      // keyframes take its place, at the same duration and easing.
      integration:
        "text-[14.5px] leading-[var(--text-body-leading-relaxed)] text-rs-ink-4 data-[state=closed]:animate-[accordion-up_var(--duration-quick)_ease] data-[state=open]:animate-[accordion-down_var(--duration-quick)_ease]",
    },
  },
  defaultVariants: {
    variant: ACCORDION_DEFAULT_VARIANT,
  },
})

/**
 * The answer box inside the animated panel.
 * - `faq`: `padding:0 26px 24px`.
 * - `source`: `margin:0 16px;padding:16px 8px 18px;
 *   border-top:1px solid rgba(255,220,190,.1);display:flex;
 *   justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap`.
 * - `integration`: `padding:4px 10px 18px;display:grid;
 *   grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 24px`.
 */
const accordionContentBodyVariants = cva("", {
  variants: {
    variant: {
      default: "pt-0 pb-4",
      faq: "px-[var(--space-12)] pt-0 pb-[var(--space-11)]",
      source:
        "mx-[var(--space-7)] flex flex-wrap items-start justify-between gap-[var(--space-9)] border-t border-t-rs-border-divider px-[var(--space-3)] pt-[var(--space-7)] pb-[var(--space-8)]",
      integration:
        "grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-x-[var(--space-11)] gap-y-[var(--space-4)] px-[var(--space-4)] pt-[var(--space-1)] pb-[var(--space-8)]",
    },
  },
  defaultVariants: {
    variant: ACCORDION_DEFAULT_VARIANT,
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
        className="transition-opacity duration-[var(--duration-quick)] ease-[ease] group-data-[state=open]/accordion-trigger:opacity-0"
      />
    </svg>
  )
}

/** The glyph inside the indicator frame: DS plus/minus for `faq`, else a chevron. */
function AccordionIndicatorGlyph({ variant }: { variant: AccordionVariant }) {
  if (variant === "faq") return <AccordionPlusMinusIcon />
  return (
    <ChevronDownIcon
      className={variant === "source" ? "size-[18px]" : "size-4"}
    />
  )
}

type AccordionProps = React.ComponentProps<typeof AccordionPrimitive.Root> &
  VariantProps<typeof accordionVariants>

function Accordion({ className, variant, ...props }: AccordionProps) {
  const resolved: AccordionVariant = variant ?? ACCORDION_DEFAULT_VARIANT

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
     * Replaces the variant's indicator (`faq`: the circled plus/minus, else a
     * chevron). It is rendered decorative (`aria-hidden`) and unrotated — the
     * variant's own indicator frame is not applied. Pass `null` to render none.
     */
    icon?: React.ReactNode
    /**
     * Wrap the trigger in Radix's `<h3>` header. Defaults to `true`
     * (DECISIONS.md §3.7 #49). Pass `false` where the trigger is not the row's
     * title — e.g. the Settings source row's icon-only „Details" control.
     */
    heading?: boolean
  }

function AccordionTrigger({
  className,
  children,
  variant,
  icon,
  heading = true,
  ...props
}: AccordionTriggerProps) {
  const resolved = useAccordionVariant(variant)

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
      {/* DS markup: the question is a single `<span>` in the button, so a
          multi-node label stays grouped left of the indicator. `integration`
          triggers *are* the grid, and their children are its cells. */}
      {resolved === "faq" ? (
        <span data-slot="accordion-trigger-label">{children}</span>
      ) : (
        children
      )}
      {icon === undefined ? (
        <span
          data-slot="accordion-indicator"
          aria-hidden="true"
          className={cn(accordionIndicatorVariants({ variant: resolved }))}
        >
          <AccordionIndicatorGlyph variant={resolved} />
        </span>
      ) : icon ? (
        <span
          data-slot="accordion-indicator"
          aria-hidden="true"
          className="pointer-events-none flex shrink-0 items-center justify-center"
        >
          {icon}
        </span>
      ) : null}
    </AccordionPrimitive.Trigger>
  )

  return heading ? (
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

// The cva recipes and the DS glyph are part of the public surface: the Settings
// and Operator rows compose their own head grids from them. The cva() calls are
// not plain constants, so the react-refresh rule cannot see them as such.
export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  AccordionPlusMinusIcon,
}
// eslint-disable-next-line react-refresh/only-export-components
export { accordionVariants, accordionItemVariants, accordionTriggerVariants, accordionIndicatorVariants, accordionContentVariants, accordionContentBodyVariants }
export type {
  AccordionProps,
  AccordionItemProps,
  AccordionTriggerProps,
  AccordionContentProps,
  AccordionVariant,
}
