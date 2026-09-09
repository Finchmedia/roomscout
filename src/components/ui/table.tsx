import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Table — the shadcn/ui table primitive restyled to the RoomScout design system.
 *
 * DS reference: `design-system/components/data/data-table/`
 * (`DataTable.jsx`, `DataTable.d.ts`, `DataTable.prompt.md`,
 * `data-table.card.html`). Values cross-checked against
 * `docs/UI_PORT/OPERATOR_SCREENS.md` §5.8 (Aufgaben), §6 (Quellen), §7.2/7.3
 * (Aufträge) and §16 ("rows keep `border-radius:10px` + conditional tint").
 *
 * What the DS prescribes and what is encoded here (`DataTable.jsx` is the
 * authority; every number below is verbatim from it):
 * - Header cells: 14px (`--text-caption-size`), `--rs-ink-6`, regular weight,
 *   **no** uppercase and **no** tracking (`DataTable.jsx:8`;
 *   `OPERATOR_SCREENS.md` §2.2 lists `14px` for "all table header rows").
 *   The 12.5px/.14em/uppercase overline recipe belongs to the *section eyebrow*
 *   that sits above the table (§5.7), never to the header row itself.
 * - Body rows 16px (`--text-body-size`, `DataTable.jsx:10`).
 * - Header rule `--rs-border-divider` (.1), row rules `--rs-border-divider-soft`
 *   (.08).
 * - Cell padding reproduces the DS grid (`padding: 10|12px 14px` plus `gap: 12px`
 *   between tracks): 6px per side between cells, 14px on the outer edges.
 * - `<TableRow highlight>` is the DS `_highlight` row tint (amber at 6%) and
 *   `<TableCell>` carries the DS row radius (`--radius-control`, 10px);
 *   `<TableCell muted>` is the DS `columns[].muted` ink step (`--rs-ink-4`).
 *
 * **Why the table is `border-separate`.** The DS row is a CSS grid with
 * `border-radius: 10px`, so its tint is a rounded band. Tailwind's preflight
 * sets `border-collapse: collapse`, under which a radius on a `<tr>` or on a
 * cell is ignored — so the table switches to `border-separate` +
 * `border-spacing: 0` and every rule that the collapsed model put on the row
 * (`border-b`) moves onto the cells, where it renders identically and where the
 * radius actually clips. Legacy screens that pass their own `.facts` / `.q`
 * class keep `border-collapse: collapse` (those rules are unlayered and beat a
 * Tailwind utility), so nothing under `src/routes` changes.
 *
 * **Which state wins.** The row-level states (`:hover`,
 * `data-[state=selected]`) paint the `<tr>` background; the DS attention tint
 * paints the *cells*. They therefore compose instead of competing — a
 * highlighted row that is also hovered or selected shows the 6% amber over the
 * neutral wash — and no rule depends on Tailwind's variant sort order.
 *
 * Deviations from the DS, deliberately (nothing else in this file is off-token):
 * 1. `bg-rs-amber/[6%]` — the DS row tint `rgba(224,161,58,.06)` byte-for-byte.
 *    The only amber-tint token is `--rs-surface-amber-tint` (12%, the attention
 *    *banner*), so the 6% row wash has no token to point at yet.
 * 2. `[&>[role=checkbox]]:translate-y-[2px]` — shadcn's optical nudge for a
 *    checkbox in a cell. 2px is a hairline correction, not a spacing step.
 *
 * Port additions the DS does not specify (`DataTable.jsx` is an inline-style
 * prototype, not an accessible component): row `:hover`, `scope="col"`, the
 * keyboard-focusable scroll container, `caption`, `empty`, `highlightLabel` and
 * `getRowKey`. Each is documented at its declaration.
 *
 * The shadcn public API and every `data-slot` are preserved so shadcn blocks
 * (sidebar-13 dialogs, data-table blocks) keep working; DS props are additive.
 * Operator-only surface per `DataTable.prompt.md` — never in the band-facing flow.
 */
function Table({
  className,
  container,
  ...props
}: React.ComponentProps<"table"> & {
  /** Props forwarded to the scroll container that wraps the table. */
  container?: React.ComponentProps<"div">
}) {
  return (
    <div
      data-slot="table-container"
      // A horizontally scrollable region must be reachable by keyboard
      // (WCAG 2.1.1); the operator tables are fixed 4-column layouts with no
      // responsive fallback (`OPERATOR_SCREENS.md` §15), so they *will* overflow
      // on narrow viewports. Pass `container={{ tabIndex: -1 }}` to opt out.
      tabIndex={0}
      {...container}
      className={cn(
        "relative w-full overflow-x-auto",
        "outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rs-orange",
        container?.className
      )}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-separate border-spacing-0 font-sans text-[length:var(--text-body-size)] text-rs-ink",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        // The header rule is the stronger divider (.1); header rows never hover.
        // It sits on the cells because `border-separate` drops row borders.
        "[&_tr>*]:border-b [&_tr>*]:border-rs-border-divider [&_tr]:hover:bg-transparent",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child>*]:border-b-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-rs-surface-subtle font-medium",
        "[&>tr:first-child>*]:border-t [&>tr:first-child>*]:border-rs-border-divider [&>tr:last-child>*]:border-b-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * Row recipe. The base carries the DS hairline (on the cells — see the file
 * header) and the two neutral row washes; `highlight` is the DS `_highlight`
 * attention tint, which paints the cells so the 10px radius on the first/last
 * cell clips it into the DS's rounded band.
 */
const tableRowVariants = cva(
  "transition-colors duration-[var(--duration-fast)] ease-out-soft [&>*]:border-b [&>*]:border-rs-border-divider-soft hover:bg-rs-surface-subtle data-[state=selected]:bg-rs-surface-subtle-2",
  {
    variants: {
      highlight: {
        /** DS `rgba(224,161,58,.06)` (`DataTable.jsx:10`). */
        true: "[&>*]:bg-rs-amber/[6%]",
        false: "",
      },
    },
    defaultVariants: {
      highlight: false,
    },
  }
)

function TableRow({
  className,
  highlight = false,
  ...props
}: React.ComponentProps<"tr"> &
  VariantProps<typeof tableRowVariants> & {
    /**
     * DS `_highlight`: warm amber wash marking a row that needs attention.
     *
     * Colour alone is not a status (WCAG 1.4.1) — in the prototype the tinted
     * row always also carries an amber `StatusDot` plus its German label. Keep
     * that pairing, or use `<DataTable highlightLabel>`, which puts a
     * screen-reader-only equivalent into the row's first cell.
     */
    highlight?: boolean
  }) {
  return (
    <tr
      data-slot="table-row"
      data-highlight={highlight ? "true" : undefined}
      className={cn(tableRowVariants({ highlight }), className)}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      // Every header cell this file emits sits in a single `<thead><tr>`, so the
      // column association is unambiguous and free. Override with `scope="row"`
      // for a row header.
      scope="col"
      className={cn(
        "px-[var(--space-2)] py-[var(--space-4)] first:pl-[var(--space-6)] last:pr-[var(--space-6)]",
        // DS header: 14px, --rs-ink-6, regular weight, no tracking, no caps.
        "text-left align-middle text-[length:var(--text-caption-size)] font-normal text-rs-ink-6",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

/**
 * Cell recipe. `muted` is the DS `columns[].muted` ink step; the end radii are
 * the DS row's `border-radius: 10px`, which only a cell can clip once the table
 * is `border-separate` (see the file header).
 */
const tableCellVariants = cva(
  "px-[var(--space-2)] py-[var(--space-5)] first:pl-[var(--space-6)] last:pr-[var(--space-6)] first:rounded-l-control last:rounded-r-control align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
  {
    variants: {
      muted: {
        /** DS `columns[].muted`: quiet secondary column (source, region, time). */
        true: "text-rs-ink-4",
        false: "",
      },
    },
    defaultVariants: {
      muted: false,
    },
  }
)

function TableCell({
  className,
  muted = false,
  ...props
}: React.ComponentProps<"td"> &
  VariantProps<typeof tableCellVariants> & {
    /** DS `columns[].muted`: quiet secondary column (source, region, timestamp). */
    muted?: boolean
  }) {
  return (
    <td
      data-slot="table-cell"
      data-muted={muted ? "true" : undefined}
      className={cn(tableCellVariants({ muted }), className)}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(
        "mt-[var(--space-7)] text-[length:var(--text-caption-size)] text-rs-ink-6",
        className
      )}
      {...props}
    />
  )
}

/** One column of the DS `DataTable` (`DataTable.d.ts`). */
type DataTableColumn = {
  key: string
  /**
   * DS type is `string`; widened to `ReactNode` so a header can carry a sort
   * affordance. Plain text stays the norm (`Vorgang`, `Quelle`, `Status`, …).
   */
  label: React.ReactNode
  /** DS grid track: `fr` values are converted to `<col>` widths; any other
   * CSS length (`120px`, `20%`) is passed through verbatim. Defaults to `1fr`. */
  width?: string
  /** Renders this column's cells in the quiet ink step. */
  muted?: boolean
}

/**
 * One row of the DS `DataTable`: cells keyed by column, plus the DS tint flag.
 * `_key` is a port addition — see `DataTableProps.getRowKey`.
 */
type DataTableRow = Record<string, React.ReactNode> & {
  _highlight?: boolean
  _key?: React.Key
}

type DataTableProps = Omit<React.ComponentProps<"div">, "children"> & {
  columns: readonly DataTableColumn[]
  rows: readonly DataTableRow[]
  /**
   * Stable React key per row. Defaults to `row._key`, falling back to the array
   * index. The DS keys by index (`DataTable.jsx:9`), which is wrong for the
   * documented consumer: the Aufträge table binds to
   * `filter === 'attention' ? tasks.filter(…) : tasks` (`OPERATOR_SCREENS.md`
   * §7.2), so toggling the chip re-uses row 0's DOM — including an open
   * disclosure or a focused `Diagnose` button — for a different task, and
   * `openTask` is never reset (§15.1). Pass ids for any filtered list.
   */
  getRowKey?: (row: DataTableRow, index: number) => React.Key
  /**
   * Accessible name for the table, rendered as `<TableCaption>` (visually below
   * the table; add `sr-only` via `<TableCaption>` yourself if you need it
   * hidden). Both operator tables are named only by a sibling section eyebrow
   * (`Aufgaben`, `Quellen`, §5.7), which assistive tech cannot associate.
   * `aria-label` / `aria-labelledby` are forwarded to the `<table>` instead of
   * the scroll container, so they name the right element.
   */
  caption?: React.ReactNode
  /**
   * Rendered in place of the rows when `rows` is empty, in the DS empty-state
   * recipe (`18px 14px`, 15px, `--rs-ink-6`). The DS component has no empty
   * state — the prototype renders it outside the table — so there is no default
   * copy; the Aufträge screen passes `Keine Aufgabe braucht Aufmerksamkeit.`
   * (`OPERATOR_SCREENS.md` §7.3).
   */
  empty?: React.ReactNode
  /**
   * Screen-reader-only equivalent of the `_highlight` tint, placed in the row's
   * first cell (WCAG 1.4.1 — the 6% amber wash is not perceivable on its own).
   * Pass `null` to opt out when the row's visible content already says it.
   */
  highlightLabel?: React.ReactNode
}

const FRACTION_WIDTH = /^(\d*\.?\d+)fr$/

/**
 * Turns the DS grid tracks (`1.3fr 1fr 1.2fr 1fr`) into `<col>` widths, with
 * the same arithmetic CSS grid uses: fixed tracks keep their length and the
 * fractions share what is left, so a mixed set such as `1fr 120px` resolves to
 * `calc((100% - (120px)) * 1)` + `120px` instead of overflowing at 100% + 120px.
 * The table stays `table-auto`, so the widths behave like `fr` tracks: they are
 * preferred widths that still yield to a cell's min-content.
 */
function resolveColumnWidths(
  columns: readonly DataTableColumn[]
): (string | undefined)[] {
  const fractions = columns.map((column) => {
    const raw = column.width?.trim()
    // DS default: `c.width || '1fr'`.
    if (raw === undefined || raw === "") return 1
    const match = FRACTION_WIDTH.exec(raw)
    return match?.[1] === undefined ? null : Number(match[1])
  })
  const total = fractions.reduce<number>(
    (sum, fraction) => (fraction === null ? sum : sum + fraction),
    0
  )
  const fixed = columns
    .map((column, index) =>
      fractions[index] === null ? column.width?.trim() : undefined
    )
    .filter((width): width is string => width !== undefined && width !== "")

  return columns.map((column, index) => {
    const fraction = fractions[index]
    if (fraction === null || fraction === undefined) return column.width?.trim()
    if (total <= 0) return undefined
    const share = fraction / total
    if (fixed.length === 0) return `${(share * 100).toFixed(4)}%`
    return `calc((100% - (${fixed.join(" + ")})) * ${share.toFixed(6)})`
  })
}

function defaultRowKey(row: DataTableRow, index: number): React.Key {
  const key = row._key
  return typeof key === "string" || typeof key === "number" ? key : index
}

/**
 * DataTable — the DS convenience wrapper over the primitives above, matching
 * `design-system/components/data/data-table/DataTable.d.ts`
 * (`columns` / `rows`, `rows[]._highlight`, `columns[].muted`).
 *
 * Two documented divergences from that `.d.ts`: `children` is omitted (the DS
 * declares it but `DataTable.jsx` never renders it, so accepting and dropping it
 * would be a silent no-op), and `columns[].label` is widened to `ReactNode`.
 * `style` reaches the scroll container, which is where the DS puts
 * `font-family` / `color` before spreading `...style` over them — the `<table>`
 * inherits both, so `style={{ color: … }}` still tints the cells as in the DS.
 *
 * ```tsx
 * <DataTable
 *   caption="Aufgaben"
 *   columns={[
 *     { key: "name", label: "Vorgang", width: "1.3fr" },
 *     { key: "src", label: "Quelle", muted: true },
 *     { key: "status", label: "Status", width: "1.2fr" },
 *     { key: "next", label: "Nächster Schritt" },
 *   ]}
 *   rows={[{ _key: "t1", name: "Neue Anzeigen prüfen", src: "roomscout.dev", status: …, next: … }]}
 *   empty="Keine Aufgabe braucht Aufmerksamkeit."
 * />
 * ```
 */
function DataTable({
  columns,
  rows,
  className,
  caption,
  empty,
  getRowKey = defaultRowKey,
  highlightLabel = "Braucht Aufmerksamkeit",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: DataTableProps) {
  const widths = React.useMemo(() => resolveColumnWidths(columns), [columns])

  return (
    <Table
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      // The DS spreads `...style` after `fontFamily`/`color` on its root, so a
      // caller's style wins; inline `inherit` here reproduces that through the
      // scroll container, which is what receives `style`.
      style={{ fontFamily: "inherit", color: "inherit" }}
      container={{ ...props, className: cn("font-sans text-rs-ink", className) }}
    >
      {caption === undefined ? null : <TableCaption>{caption}</TableCaption>}
      <colgroup>
        {columns.map((column, index) => {
          const width = widths[index]
          return <col key={column.key} style={width ? { width } : undefined} />
        })}
      </colgroup>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key}>{column.label}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && empty !== undefined ? (
          <TableRow>
            <TableCell
              colSpan={Math.max(columns.length, 1)}
              className="px-[var(--space-6)] py-[var(--space-8)] text-[length:var(--text-body-sm-size)] text-rs-ink-6"
            >
              {empty}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, rowIndex) => {
            const highlighted = row._highlight === true
            return (
              <TableRow key={getRowKey(row, rowIndex)} highlight={highlighted}>
                {columns.map((column, columnIndex) => (
                  <TableCell key={column.key} muted={column.muted}>
                    {highlighted && columnIndex === 0 && highlightLabel ? (
                      <span className="sr-only">{highlightLabel}</span>
                    ) : null}
                    {row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

// `tableRowVariants` / `tableCellVariants` are part of the public API (a screen
// can put the attention tint or the muted ink step on an element that is not a
// table cell); the cva() calls are not plain constants, so the react-refresh
// rule cannot see them as such.
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  DataTable,
  // eslint-disable-next-line react-refresh/only-export-components
  tableRowVariants,
  // eslint-disable-next-line react-refresh/only-export-components
  tableCellVariants,
}
export type { DataTableColumn, DataTableRow, DataTableProps }
