import * as React from "react"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Icon, type IconName } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"

/**
 * FactList — „Euer Suchauftrag“: the brief as a list of facts with quiet icons.
 *
 * DS reference: `design-system/components/data/fact-list/`
 * (`FactList.jsx`, `FactList.d.ts`, `FactList.prompt.md`,
 * `fact-list.card.html`). Prototype catalogue: `docs/UI_PORT/SCOUT_SCREENS.md`
 * §4 (§4.1 icons, §4.2 desktop list, §4.3 arrival choreography, §4.4 sheet).
 *
 * The single source of truth for what the Scout searches, and **one element in
 * three densities** (`FactList.prompt.md`): `floating` is the light group
 * beside the conversation, `card` the central review card that carries the
 * „Scout losschicken“ CTA as `children`, `compact` the inline expansion. The
 * float→card morph itself (position, the .9s `--duration-morph` transition) is
 * the screen's job — this atom only owns the two end states.
 *
 * Geometry verbatim from `FactList.jsx`, one column per variant —
 * width · padding · radius · fill · border · shadow · gap:
 *   `floating` 300px    · 14/16   · 16 · card .50 · card-soft · none  · 2px
 *   `card`     min(520) · 26/28/28· 26 · card .78 · panel     · float · 4px
 *   `compact`  min(380) · 14/18   · 16 · card .72 · card-soft · none  · 2px
 * Rows: `card` 44px · gap 14 · 17px type · a `--rs-border-divider-soft` rule;
 * the other two 34px · gap 12 · 14px type, no rule. Every row is 8px
 * (`--radius-chip`) with `0 6px` padding and clips its label to an ellipsis.
 *
 * Icons (`SCOUT_SCREENS.md` §4.1) sit in a 22px (`--space-10`) cell on
 * `--rs-ink-2`: `pin` (Ort), a plain „€“ text glyph (Budget — never an icon),
 * `users` (Band), `clock` (Zeit), `drum` (Ausstattung). An unknown id falls
 * back to the DS's 6px `--rs-orange-light` bullet, so a screen may add its own
 * rows without a glyph.
 *
 * `changed` is the correction flash: the row **stays in place** and crossfades
 * an orange wash over `--duration-slow` (.5s), which the caller clears after
 * ~1s (`FactList.prompt.md`; `SCOUT_SCREENS.md` §4 puts the clear at 1100–1200
 * ms). Never append a duplicate row for a corrected fact.
 *
 * Token notes — nothing here is a raw colour:
 *  · `floating`'s fill is the DS's `rgba(18,14,12,.50)`, 10 points below the
 *    card ladder's floor (.72/.66/.60): a barely-there panel is its own role,
 *    not a card, so folding it onto `--rs-surface-card-faint` would change what
 *    it is. It is derived from the card token instead —
 *    `color-mix(… --rs-surface-card 69%, transparent)` = alpha .497 — the same
 *    move `summary-pill.tsx` makes for its warm hover wash.
 *  · `card`'s `rgba(18,14,12,.78)` (the prototype has .74) *does* fold onto
 *    `--rs-surface-card` (.72): same role, and a ≤.06 alpha delta over the
 *    near-black ground is imperceptible — the §F1/§F9 argument in
 *    `docs/UI_PORT/TOKENS.md`.
 *  · The `changed` wash `rgba(255,105,38,.18)` (prototype .20) folds onto
 *    `--rs-surface-accent-tint` (.16), the DS's orange chip fill.
 *  · The edit input's `rgba(255,200,160,.25)` hairline has no token (the card
 *    family ships .12/.14/.18); it takes `--rs-border-control`
 *    (rgba(255,220,190,.22)) — the DS's own *control* border, .03 away, and per
 *    §F2 the two warm-white hues are indistinguishable at that alpha.
 *  · 11.5px / .09em (the overline title), 21px (the card title), 34px (the
 *    dense row), 300px and 520px have no token — the type ladder is 12.5px
 *    (`--text-overline-size`) at .14em and 19/17/16px, the width ladder starts
 *    at 380px. They stay literal, as `card.tsx` keeps its 20px radius. 380px is
 *    `--width-card-narrow` and is written as the token.
 *
 * Deliberate additions over `FactList.jsx`, all behavioural:
 *  · Rows enter with `rsFadeUp` per `design-system/readme.md` § Motion
 *    („content enters with rsFadeUp“); keyed by fact id, so a row animates once
 *    and a correction crossfades in place instead of remounting.
 *  · The edit button is the DS `IconButton` in its documented 36px `bare`
 *    (inline) size, which adds the hover wash and the global focus ring the
 *    raw `<button>` in the DS source lacks; §4.2 gives it the same `rsFadeUp`.
 *  · The edit input gets the one DS focus ring (2px orange, 2px offset —
 *    `TOKENS.md` §F17) instead of the DS's `outline:none`.
 *  · `data-fact-row` / `data-fact-label` are kept on the row and its label:
 *    §4.3's capsule flight measures its target with exactly those selectors.
 *
 * `title` is the heading text, as in the DS — it is not forwarded as the DOM
 * `title` attribute.
 */

/** A fact's id: the five the prototype knows, plus any id a screen adds. */
type FactId = "ort" | "budget" | "band" | "zeit" | "equip" | (string & {})

/** One row of the brief. */
interface Fact {
  /** `ort` | `budget` | `band` | `zeit` | `equip`, or a screen's own id. */
  id: FactId
  /** The rendered value („Bis 350 € / Monat“). */
  label: string
  /** Correction flash: crossfades the orange wash in place for ~1s. */
  changed?: boolean
}

/** floating = light group beside the conversation; card = central review card; compact = inline expansion. */
type FactListVariant = "floating" | "card" | "compact"

/**
 * Fact id → glyph from the RoomScout icon set. `budget` is deliberately `null`:
 * the DS renders a plain „€“ text glyph for it, never an icon
 * (`design-system/readme.md` § Iconography).
 */
const FACT_ICONS: Record<string, IconName | null | undefined> = {
  ort: "pin",
  budget: null,
  band: "users",
  zeit: "clock",
  equip: "drum",
}

const factListVariants = cva(
  ["flex flex-col border text-left font-sans text-rs-ink"].join(" "),
  {
    variants: {
      variant: {
        /** 300px light group beside the conversation; no shadow. */
        floating: [
          "w-[300px] max-w-full gap-[2px]",
          "rounded-card px-[var(--space-7)] py-[var(--space-6)]",
          "border-rs-border-card-soft shadow-none",
          // DS rgba(18,14,12,.50) — 69% of the card token's alpha (see JSDoc).
          "bg-[color-mix(in_srgb,var(--rs-surface-card)_69%,transparent)]",
        ].join(" "),
        /** The central review card: denser fill, panel hairline, deep shadow. */
        card: [
          "w-[min(520px,100%)] gap-[var(--space-1)]",
          "rounded-card-2xl px-[var(--space-13)] pt-[var(--space-12)] pb-[var(--space-13)]",
          "border-rs-border-panel bg-rs-surface-card shadow-card-float",
        ].join(" "),
        /** Inline expansion inside another surface; card fill, no shadow. */
        compact: [
          "w-[min(var(--width-card-narrow),100%)] gap-[2px]",
          "rounded-card px-[var(--space-8)] py-[var(--space-6)]",
          "border-rs-border-card-soft bg-rs-surface-card shadow-none",
        ].join(" "),
      },
    },
    defaultVariants: {
      variant: "floating",
    },
  }
)

const factListHeaderVariants = cva("flex items-center justify-between", {
  variants: {
    variant: {
      floating: "mb-[var(--space-2)]",
      card: "mb-[var(--space-4)]",
      compact: "mb-[var(--space-2)]",
    },
  },
  defaultVariants: {
    variant: "floating",
  },
})

const factListTitleVariants = cva("min-w-0", {
  variants: {
    variant: {
      /** Overline treatment: 11.5px uppercase at .09em on muted ink. */
      floating: "text-[11.5px] uppercase tracking-[.09em] text-rs-ink-6",
      /** The card reads as a heading: 21px on full ink. */
      card: "text-[21px] text-rs-ink",
      compact: "text-[11.5px] uppercase tracking-[.09em] text-rs-ink-6",
    },
  },
  defaultVariants: {
    variant: "floating",
  },
})

const factRowVariants = cva(
  [
    "flex items-center overflow-hidden whitespace-nowrap",
    "rounded-chip px-[var(--space-2)]",
    "animate-rs-fade-up",
    // The correction flash crossfades over .5s, exactly as the DS does.
    "transition-colors duration-[var(--duration-slow)] ease-out-soft",
  ].join(" "),
  {
    variants: {
      variant: {
        floating:
          "h-[34px] gap-[var(--space-5)] text-[length:var(--text-caption-size)]",
        card: [
          "h-[var(--size-button-xs)] gap-[var(--space-6)]",
          "border-b border-rs-border-divider-soft",
          "text-[length:var(--text-body-lg-size)]",
        ].join(" "),
        compact:
          "h-[34px] gap-[var(--space-5)] text-[length:var(--text-caption-size)]",
      },
      changed: {
        /** The ~1s orange highlight; the caller clears the flag. */
        true: "bg-rs-surface-accent-tint",
        false: "bg-transparent",
      },
    },
    defaultVariants: {
      variant: "floating",
      changed: false,
    },
  }
)

interface FactRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The fact to render; `changed` drives the orange flash. */
  fact: Fact
  /** Row density — inherited from the list. */
  variant?: FactListVariant
  /** Inline edit mode: the row renders an input instead of the label. */
  editing?: boolean
  /** Draft value while editing; falls back to `fact.label`. */
  draft?: string
  onDraftChange?: (id: string, value: string) => void
}

/**
 * One fact row — icon cell plus label (or, while editing, an input).
 *
 * Exported so a screen can compose its own list (the mobile bottom sheet of
 * `SCOUT_SCREENS.md` §4.4 wraps the same rows in a collapsible) without
 * rebuilding the icon mapping and the flash.
 */
function FactRow({
  className,
  fact,
  variant = "floating",
  editing = false,
  draft,
  onDraftChange,
  ...props
}: FactRowProps) {
  const glyph = FACT_ICONS[fact.id]

  return (
    <div
      data-slot="fact-row"
      data-fact-row={fact.id}
      data-changed={fact.changed ? "true" : undefined}
      className={cn(
        factRowVariants({ variant, changed: fact.changed === true }),
        className
      )}
      {...props}
    >
      <span
        data-slot="fact-row-icon"
        className="flex size-[var(--space-10)] flex-none items-center justify-center text-rs-ink-2"
      >
        {fact.id === "budget" ? (
          <span
            aria-hidden="true"
            className="text-[length:var(--text-lead-size)] leading-none"
          >
            €
          </span>
        ) : glyph ? (
          <Icon name={glyph} size={variant === "card" ? 20 : 18} />
        ) : (
          <span
            aria-hidden="true"
            className="size-[var(--space-2)] rounded-circle bg-rs-orange-light"
          />
        )}
      </span>
      {editing ? (
        <input
          data-slot="fact-row-input"
          aria-label="Kriterium bearbeiten"
          value={draft ?? fact.label}
          onChange={(event) => onDraftChange?.(fact.id, event.target.value)}
          className={cn(
            "min-w-0 flex-1 rounded-chip",
            "border border-rs-border-control bg-rs-surface-subtle-2",
            "px-[var(--space-4)] py-[var(--space-2)]",
            "font-sans text-[length:var(--text-body-size)] text-rs-ink",
            // DS focus ring: 2px solid orange, 2px offset (TOKENS.md F17).
            // `outline-solid` re-arms --tw-outline-style, which `outline-none` clears.
            "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange"
          )}
        />
      ) : (
        <span
          data-slot="fact-row-label"
          data-fact-label={fact.id}
          className="overflow-hidden text-ellipsis"
        >
          {fact.label}
        </span>
      )}
    </div>
  )
}

interface FactListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The brief. Max five rows beside the conversation — „+2 weitere Wünsche“ beyond that. */
  facts: Fact[]
  /** floating = light group beside the conversation; card = central review card; compact = inline expansion. */
  variant?: FactListVariant
  /** Heading text; the DS default is „Euer Suchauftrag“. */
  title?: string
  /** Renders the pencil button („Suchauftrag bearbeiten“); hidden while editing. */
  onEdit?: () => void
  /** Inline edit mode: rows render inputs. */
  editing?: boolean
  /** Draft values keyed by fact id while editing. */
  drafts?: Record<string, string>
  onDraftChange?: (id: string, value: string) => void
  /** Card actions („Scout losschicken“ and its caption) go here. */
  children?: React.ReactNode
  style?: React.CSSProperties
}

function FactList({
  className,
  facts,
  variant = "floating",
  title = "Euer Suchauftrag",
  onEdit,
  editing = false,
  drafts,
  onDraftChange,
  children,
  ...props
}: FactListProps) {
  return (
    <div
      data-slot="fact-list"
      data-variant={variant}
      data-editing={editing ? "true" : undefined}
      data-fact-list="1"
      className={cn(factListVariants({ variant }), className)}
      {...props}
    >
      <div
        data-slot="fact-list-header"
        className={factListHeaderVariants({ variant })}
      >
        <div
          data-slot="fact-list-title"
          className={factListTitleVariants({ variant })}
        >
          {title}
        </div>
        {onEdit && !editing ? (
          <IconButton
            variant="bare"
            size={36}
            label="Suchauftrag bearbeiten"
            onClick={onEdit}
            className="animate-rs-fade-up"
          >
            <Icon name="edit" size={18} />
          </IconButton>
        ) : null}
      </div>
      {facts.map((fact) => (
        <FactRow
          key={fact.id}
          fact={fact}
          variant={variant}
          editing={editing}
          draft={drafts?.[fact.id]}
          onDraftChange={onDraftChange}
        />
      ))}
      {children}
    </div>
  )
}

export { FactList, FactRow }
export type { Fact, FactId, FactListProps, FactListVariant, FactRowProps }
