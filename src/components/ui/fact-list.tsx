import { useCopy } from "@/ui/copy"
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
 * width · padding · radius · fill · border · shadow · gap. The **fill column
 * states what this file renders**, with the DS value in brackets where the two
 * differ (both folds are argued under „Token notes“ below):
 *   `floating` 300px    · 14/16   · 16 · card .497 [DS .50] · card-soft · none  · 2px
 *   `card`     min(520) · 26/28/28· 26 · card .72  [DS .78] · panel     · float · 4px
 *   `compact`  min(380) · 14/18   · 16 · card .72           · card-soft · none  · 2px
 * Rows: `card` 44px · gap 14 · 17px type · a `--rs-border-divider-soft` rule;
 * the other two 34px (`--space-15`) · gap 12 · 14px type, no rule. Every row is
 * 8px (`--radius-chip`) with `0 6px` padding and clips its label to an ellipsis.
 *
 * Icons (`SCOUT_SCREENS.md` §4.1) sit in a 22px (`--space-10`) cell on
 * `--rs-ink-2`: `pin` (Ort), a plain „€“ text glyph (Budget — never an icon),
 * `users` (Band), `clock` (Zeit), `drum` (Ausstattung). An unknown id falls
 * back to the DS's 6px `--rs-orange-light` bullet, so a screen may add its own
 * rows without a glyph.
 *
 * `changed` is the correction flash: the row **stays in place** and crossfades
 * an orange wash over `--duration-slow` (.5s). It is a *controlled* flag — this
 * atom never clears it, so a caller that sets it and forgets leaves the row
 * orange for good; see the prop doc on `Fact.changed` for the three prototype
 * clear timings. Never append a duplicate row for a corrected fact.
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
 *    `--rs-surface-accent-tint` (.16), the DS's orange chip fill and the
 *    nearest step of the accent-tint ladder (.12 / .16 / .26). **Open for a
 *    maintainer call:** the fold runs 2–4 points *weaker* than both sources,
 *    and this wash is the only in-product feedback a correction gets. Raising
 *    it to the DS value without a raw colour is one line —
 *    `bg-[color-mix(in_srgb,var(--rs-orange)_18%,transparent)]`.
 *  · The edit input's `rgba(255,200,160,.25)` hairline has no token: the
 *    255,200,160 border family ships .12/.14/.18, so the nearest same-hue step
 *    (`--rs-border-card-strong`, .18) is .07 away while the *control* ladder's
 *    `--rs-border-control` (rgba(255,220,190,.22)) is .03 away. It takes the
 *    control token — this is a control, `TOKENS.md` §F2 records the two
 *    warm-white hues as indistinguishable at these alphas, and `input.tsx`
 *    makes the identical trade for both of its DS hairlines (`.2` → control
 *    `.22`, `rgba(255,200,160,.3)` → control-strong `.3`).
 *  · 11.5px / .09em (the overline title), 21px (the card title), 300px and
 *    520px have no token — the type ladder is 12.5px (`--text-overline-size`)
 *    at .14em and 19/17/16px, the width ladder starts at 380px. They stay
 *    literal, as `card.tsx` keeps its 20px radius; `overline.tsx` records the
 *    11.5px/.09em eyebrow as this component's to own. 380px is
 *    `--width-card-narrow` and 34px is `--space-15`; both are written as the
 *    token. `gap-[2px]` stays a px literal rather than Tailwind's `gap-0.5`
 *    (`.125rem`), because every other DS gap here is a px token and a root
 *    font-size change must not resize it.
 *  · The title renders at `--weight-regular` in both densities, as
 *    `FactList.jsx:12` does (it sets no weight) and as `Overline.jsx:5` /
 *    `overline.tsx` do for every muted eyebrow in the app. `SCOUT_SCREENS.md`
 *    §4.2 gives the *screen's* float header `listHeadWeight:500` and the card
 *    header `-.01em` / 22px; those belong to the morphing container the screen
 *    owns, and the DS component is the spec here.
 *
 * Deliberate additions over `FactList.jsx`, all behavioural or accessibility:
 *  · Rows enter with `rsFadeUp` per `design-system/readme.md` § Motion
 *    („content enters with rsFadeUp“); keyed by fact id, so a row animates once
 *    and a correction crossfades in place instead of remounting.
 *  · `arriving` (`SCOUT_SCREENS.md` §4 `renderVals()`) — the placeholder row of
 *    §4.3's capsule flight: height 0, opacity 0 and no entry animation, so the
 *    row can *grow* when `commitFact` flips the flag 400 ms into the 580 ms
 *    flight. It is not in `FactList.d.ts`; it is added for the same reason
 *    `capsule.tsx` adds `flight`, namely that the choreography is impossible
 *    without a handle inside the atom. The row therefore transitions `height`
 *    over `--duration-morph` and `opacity` over `--duration-base` (§4.2's row
 *    transition asks for .9s / .35s) next to the DS's `background .5s` — and
 *    `height` doubles as the float→card row-height morph.
 *  · The edit button is the DS `IconButton` in its documented 36px `bare`
 *    (inline) size, which adds the hover wash, the global focus ring and the
 *    `type="button"` the raw `<button>` in the DS source lacks; §4.2 gives it
 *    the same `rsFadeUp`.
 *  · The edit input gets the one DS focus ring (2px orange, 2px offset —
 *    `TOKENS.md` §F17) instead of the DS's `outline:none`, and the row stops
 *    clipping while `editing` so the ring (and a 16px input taller than a 34px
 *    dense row) is not cut off by `overflow:hidden`.
 *  · Accessibility, none of which the DS source has: the rows are a
 *    `role="list"` of `role="listitem"`s inside a `role="group"` named by the
 *    title; the icon cell carries the fact's German category visually hidden,
 *    because the glyph is `aria-hidden` and the label holds only the value; the
 *    editing inputs are labelled per row instead of five identical „Kriterium
 *    bearbeiten“; and `changed` announces „Angabe korrigiert: …“ (the
 *    prototype's own `logChange` string) through a per-row `role="status"`,
 *    since the wash is otherwise silent for AT and invisible under
 *    `prefers-reduced-motion`.
 *  · `data-fact-row` / `data-fact-label` are kept on the row and its label:
 *    §4.3's capsule flight measures its target with exactly those selectors.
 *    `data-fact-list="1"` marks the container §4.2 measures for the morph, and
 *    both components take a `ref` (React 19 ref-as-prop) so a screen can hold
 *    the node it measures without a DOM query.
 *
 * **Not implemented, by design:** `FactList.prompt.md`'s „Max five rows in the
 * conversation view; '+2 weitere Wünsche' beyond that“. Neither `FactList.jsx`
 * nor the prototype has an overflow row — there is no geometry, no ink and no
 * plural rule for it anywhere in the DS or in `docs/UI_PORT/`, and the copy
 * dictionary (`SCOUT_SCREENS.md` §18.9) does not carry the string. The screen
 * that composes the floating list owns the cap: slice to five and render the
 * „+N weitere Wünsche“ line as its own node (`children` is appended after the
 * rows), or the rule gets a spec first.
 *
 * `title` is the heading text, as in the DS — it is not forwarded as the DOM
 * `title` attribute. It names the group through `aria-labelledby`; an empty
 * string (the DS ui-kit passes `title=""` inside the mobile sheet) leaves the
 * group unnamed rather than naming it "".
 */

/** A fact's id: the five the prototype knows, plus any id a screen adds. */
type FactId = "ort" | "budget" | "band" | "zeit" | "equip" | (string & {})

/** One row of the brief. */
interface Fact {
  /** `ort` | `budget` | `band` | `zeit` | `equip`, or a screen's own id. */
  id: FactId
  /** The rendered value („Bis 350 € / Monat“). */
  label: string
  /**
   * Correction flash: crossfades the orange wash in place and announces
   * „Angabe korrigiert: …“. **The caller must clear it** — this atom holds no
   * timer, so the wash stays until the flag flips back. `SCOUT_SCREENS.md` §4
   * clears it 1100 ms after `commitFact`, 1200 ms after `updateFact` /
   * `compromise`, and at the 2300 ms stage switch after `answerClar`; the
   * prompt's „~1 s“ is the round number for those. Note that the in-product
   * „Übernehmen“ (`saveEdit`) sets it **not** at all.
   */
  changed?: boolean
  /**
   * §4.3's placeholder row: height 0, opacity 0, no entry animation. The stage
   * pushes the fact with `arriving: true`, flies the capsule at it, and 400 ms
   * into the flight `commitFact` clears the flag so the row grows over
   * `--duration-morph` while its label fades in. Discovery only; a row that is
   * simply rendered leaves it unset.
   */
  arriving?: boolean
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

/**
 * Fact id → the German category the glyph stands for (`SCOUT_SCREENS.md` §4.1
 * names them: Ort, Budget, Band, Zeit, Ausstattung). Rendered visually hidden
 * in the icon cell and used as the editing input's label, because the glyph is
 * `aria-hidden` and `label` carries only the value („Stuttgart“) — without it
 * a screen-reader user cannot tell which criterion a value belongs to. An id
 * the DS does not know has no category and falls back to the value.
 */
const FACT_CATEGORIES = {
  ort: "Ort",
  budget: "Budget",
  band: "Band",
  zeit: "Zeit",
  equip: "Ausstattung",
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

/**
 * The `role="list"` wrapper around the rows. It exists only so the brief has
 * list semantics without wrapping the header and the card actions in it too;
 * it re-states the container's own gap, so the rendered spacing is identical to
 * the DS's flat column of siblings.
 */
const factListRowsVariants = cva("flex min-w-0 flex-col", {
  variants: {
    variant: {
      floating: "gap-[2px]",
      card: "gap-[var(--space-1)]",
      compact: "gap-[2px]",
    },
  },
  defaultVariants: {
    variant: "floating",
  },
})

const factRowVariants = cva(
  [
    "flex items-center overflow-hidden whitespace-normal",
    "rounded-chip px-[var(--space-2)]",
    // The row height is a private custom property, so `editing` can swap the
    // fixed box for a floor and `arriving` can collapse it to 0 without a
    // compound variant per density. tailwind-merge keeps the last `h-*`.
    "min-h-[var(--rs-fact-row-h)] py-[var(--space-2)]",
    // FactList.jsx:16 transitions `background` only — .5s on the CSS default
    // easing (`transition-colors` would drag the card's divider and the ink
    // along; `ease-out-soft` is the .9s morph curve, not the flash's).
    // `height` / `opacity` are §4.2's row transition (`height .9s,
    // opacity .35s`): the arrival of §4.3 and the float→card height change.
    "[transition:background-color_var(--duration-slow),height_var(--duration-morph),opacity_var(--duration-base)]",
  ].join(" "),
  {
    variants: {
      variant: {
        floating: [
          "[--rs-fact-row-h:var(--space-15)]",
          "gap-[var(--space-5)] text-[length:var(--text-caption-size)]",
        ].join(" "),
        card: [
          "[--rs-fact-row-h:var(--size-button-xs)] gap-[var(--space-6)]",
          "border-b border-rs-border-divider-soft",
          "text-[length:var(--text-body-lg-size)]",
        ].join(" "),
        compact: [
          "[--rs-fact-row-h:var(--space-15)]",
          "gap-[var(--space-5)] text-[length:var(--text-caption-size)]",
        ].join(" "),
      },
      changed: {
        /** The ~1s orange highlight; the caller clears the flag. */
        true: "bg-rs-surface-accent-tint",
        false: "bg-transparent",
      },
      editing: {
        /**
         * The input is 16px type in 6px padding inside a 1px box, i.e. taller
         * than the 34px dense row, and its focus ring paints 4px outside that
         * box. Clipping either is the DS source's bug (it only ever edits in
         * the 44px `card`), so edit mode turns the fixed height into a floor
         * and stops the row clipping.
         */
        true: "h-auto min-h-[var(--rs-fact-row-h)] overflow-visible",
        false: "",
      },
      arriving: {
        /** §4.3's placeholder: collapsed and invisible, no entry animation. */
        true: "h-0 min-h-0 animate-none overflow-hidden opacity-0",
        false: "animate-rs-fade-up opacity-100",
      },
    },
    defaultVariants: {
      variant: "floating",
      changed: false,
      editing: false,
      arriving: false,
    },
  }
)

interface FactRowProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** The fact to render; `changed` drives the orange flash, `arriving` the §4.3 placeholder. */
  fact: Fact
  /** Row density — inherited from the list. */
  variant?: FactListVariant
  /** Inline edit mode: the row renders an input instead of the label. */
  editing?: boolean
  /** Draft value while editing; falls back to `fact.label`. */
  draft?: string
  onDraftChange?: (id: string, value: string) => void
  /**
   * React 19 ref-as-prop — §4.3's capsule flight measures its target box, and
   * `FactList` itself renders no ref onto the rows.
   */
  ref?: React.Ref<HTMLDivElement>
}

/**
 * One fact row — icon cell plus label (or, while editing, an input).
 *
 * Exported so a screen can compose its own list (the mobile bottom sheet of
 * `SCOUT_SCREENS.md` §4.4 wraps the same rows in a collapsible) without
 * rebuilding the icon mapping and the flash. It defaults to `role="listitem"`,
 * so such a wrapper owes it a `role="list"` container (`factListRowsVariants`
 * is exported for exactly that); a row that is deliberately not in a list must
 * name its own `role` — `role={undefined}` falls back to the default, as every
 * destructured default does.
 */
function FactRow({
  className,
  fact,
  variant = "floating",
  editing = false,
  draft,
  onDraftChange,
  role = "listitem",
  ...props
}: FactRowProps) {
  const glyph = FACT_ICONS[fact.id]
  const { t } = useCopy()
  const categoryKey = fact.id as keyof typeof FACT_CATEGORIES
  const category = categoryKey in FACT_CATEGORIES ? t(`liveScout.factCategories.${categoryKey}`) : undefined
  const arriving = fact.arriving === true

  return (
    <div
      data-slot="fact-row"
      data-fact-row={fact.id}
      data-changed={fact.changed ? "true" : undefined}
      data-arriving={arriving ? "true" : undefined}
      role={role}
      className={cn(
        factRowVariants({
          variant,
          changed: fact.changed === true,
          editing,
          arriving,
        }),
        className
      )}
      {...props}
    >
      <span
        data-slot="fact-row-icon"
        className="flex size-[var(--space-10)] flex-none items-center justify-center text-rs-ink-2"
      >
        {category ? <span className="sr-only">{`${category}: `}</span> : null}
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
          // Five rows mean five inputs; the DS labels every one of them
          // „Kriterium bearbeiten“, which is five identical fields for AT.
          aria-label={t("liveScout.editCriterion", { category: category ?? fact.label })}
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
          className="min-w-0 break-words leading-relaxed"
        >
          {fact.label}
        </span>
      )}
      {/*
       * The wash is the only feedback a correction gets, and it is silent for
       * AT and invisible under `prefers-reduced-motion` (tokens.css pins every
       * transition to .01ms there). The region is always mounted and empty, so
       * only the row that flips `changed` speaks. Copy: the prototype's own
       * `logChange` string (SCOUT_SCREENS.md §4).
       */}
      <span data-slot="fact-row-status" role="status" className="sr-only">
        {fact.changed ? t("liveScout.factUpdated", { value: fact.label }) : null}
      </span>
    </div>
  )
}

interface FactListProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The brief. `FactList.prompt.md` caps the conversation view at five rows
   * („+2 weitere Wünsche“ beyond that) — the cap is **the screen's**, see the
   * component JSDoc. Defaults to `[]`, as `FactList.jsx:7` does, so a screen
   * rendering before its data resolves gets an empty card, not a crash.
   */
  facts: Fact[]
  /** floating = light group beside the conversation; card = central review card; compact = inline expansion. */
  variant?: FactListVariant
  /** Heading text; the DS default is „Euer Suchauftrag“. Names the group. */
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
  /**
   * React 19 ref-as-prop — §4.2 measures this node (`data-fact-list="1"`) for
   * the float→card morph.
   */
  ref?: React.Ref<HTMLDivElement>
}

function FactList({
  className,
  facts = [],
  variant = "floating",
  title,
  onEdit,
  editing = false,
  drafts,
  onDraftChange,
  children,
  ...props
}: FactListProps) {
  const { t } = useCopy()
  const heading = title ?? t("liveScout.asideTitle")
  const titleId = React.useId()

  return (
    <div
      data-slot="fact-list"
      data-variant={variant}
      data-editing={editing ? "true" : undefined}
      data-fact-list="1"
      // The brief is a named group of items, not a run of loose sentences.
      // Both are declared before the spread, so a screen can override them.
      role="group"
      aria-labelledby={heading ? titleId : undefined}
      className={cn(factListVariants({ variant }), className)}
      {...props}
    >
      <div
        data-slot="fact-list-header"
        className={factListHeaderVariants({ variant })}
      >
        <div
          id={titleId}
          data-slot="fact-list-title"
          className={factListTitleVariants({ variant })}
        >
          {heading}
        </div>
        {onEdit && !editing ? (
          <IconButton
            variant="bare"
            size={36}
            label={t("liveScout.asideEdit")}
            onClick={onEdit}
            className="animate-rs-fade-up"
          >
            <Icon name="edit" size={18} />
          </IconButton>
        ) : null}
      </div>
      <div
        data-slot="fact-list-rows"
        role="list"
        className={factListRowsVariants({ variant })}
      >
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
      </div>
      {children}
    </div>
  )
}

export { FactList, FactRow }

// The cva recipes are part of the public API, as they are in every other
// primitive here: `SCOUT_SCREENS.md` §4.4's mobile sheet composes its own
// wrapper around `FactRow`, and §4.3's flight clone is a raw node. The cva()
// calls are not plain constants, so the react-refresh rule cannot see them.
// eslint-disable-next-line react-refresh/only-export-components -- shadcn exports its cva variants next to the component
export { factListVariants, factListHeaderVariants, factListTitleVariants, factListRowsVariants, factRowVariants }
export type { Fact, FactId, FactListProps, FactListVariant, FactRowProps }
