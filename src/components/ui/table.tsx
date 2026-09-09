import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Table — the shadcn/ui table primitive restyled to the RoomScout design system.
 *
 * DS reference: `design-system/components/data/data-table/`
 * (`DataTable.jsx`, `DataTable.d.ts`, `DataTable.prompt.md`,
 * `data-table.card.html`). Values cross-checked against
 * `docs/UI_PORT/OPERATOR_SCREENS.md` §5.8 (Aufgaben), §6 (Quellen), §7.2 (Aufträge).
 *
 * What the DS prescribes and what is encoded here:
 * - Header cells read as overlines — 12.5px, `.14em`, uppercase, `--rs-ink-6`
 *   (`components/core/overline/Overline.jsx`, tone "muted" → weight 400).
 * - Header rule `--rs-border-divider` (.1), row rules `--rs-border-divider-soft` (.08).
 * - Body rows 15px (`--text-body-sm-size`); hover lightens to `--rs-surface-subtle`.
 * - Cell padding reproduces the DS grid (`padding: 10|12px 14px` plus `gap: 12px`
 *   between tracks): 6px per side between cells, 14px on the outer edges.
 * - `<TableRow highlight>` is the DS `_highlight` row tint (amber at 6%);
 *   `<TableCell muted>` is the DS `columns[].muted` ink step (`--rs-ink-4`).
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
      {...container}
      className={cn("relative w-full overflow-x-auto", container?.className)}
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom font-sans text-[length:var(--text-body-sm-size)] text-rs-ink",
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
        "[&_tr]:border-b [&_tr]:border-rs-border-divider [&_tr]:hover:bg-transparent",
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
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-rs-border-divider bg-rs-surface-subtle font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({
  className,
  highlight,
  ...props
}: React.ComponentProps<"tr"> & {
  /** DS `_highlight`: warm amber wash marking a row that needs attention. */
  highlight?: boolean
}) {
  return (
    <tr
      data-slot="table-row"
      data-highlight={highlight ? "true" : undefined}
      className={cn(
        "border-b border-rs-border-divider-soft transition-colors duration-[var(--duration-fast)] ease-out-soft",
        "hover:bg-rs-surface-subtle has-aria-expanded:bg-rs-surface-subtle data-[state=selected]:bg-rs-surface-subtle-2",
        // Amber at 6% = the DS row tint; the stacked hover variant outranks the
        // plain :hover rule on specificity, so a highlighted row keeps its tone.
        "data-[highlight=true]:bg-rs-amber/[6%] data-[highlight=true]:hover:bg-rs-amber/[10%]",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "px-[var(--space-2)] py-[var(--space-4)] first:pl-[var(--space-6)] last:pr-[var(--space-6)]",
        "text-left align-middle whitespace-nowrap",
        "text-[length:var(--text-overline-size)] font-normal tracking-[var(--text-overline-tracking)] uppercase text-rs-ink-6",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({
  className,
  muted,
  ...props
}: React.ComponentProps<"td"> & {
  /** DS `columns[].muted`: quiet secondary column (source, region, timestamp). */
  muted?: boolean
}) {
  return (
    <td
      data-slot="table-cell"
      data-muted={muted ? "true" : undefined}
      className={cn(
        "px-[var(--space-2)] py-[var(--space-5)] first:pl-[var(--space-6)] last:pr-[var(--space-6)]",
        "align-middle whitespace-nowrap data-[muted=true]:text-rs-ink-4",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
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
  label: React.ReactNode
  /** DS grid track: `fr` values are converted to `<col>` percentages; any other
   * CSS length (`120px`, `20%`) is passed through verbatim. Defaults to `1fr`. */
  width?: string
  /** Renders this column's cells in the quiet ink step. */
  muted?: boolean
}

/** One row of the DS `DataTable`: cells keyed by column, plus the DS tint flag. */
type DataTableRow = Record<string, React.ReactNode> & { _highlight?: boolean }

type DataTableProps = Omit<React.ComponentProps<"div">, "children"> & {
  columns: readonly DataTableColumn[]
  rows: readonly DataTableRow[]
}

const FRACTION_WIDTH = /^(\d*\.?\d+)fr$/

/**
 * Turns the DS grid tracks (`1.3fr 1fr 1.2fr 1fr`) into `<col>` widths. The
 * table stays `table-auto`, so the percentages behave like `fr` tracks: they are
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

  return columns.map((column, index) => {
    const fraction = fractions[index]
    if (fraction === null || fraction === undefined) return column.width?.trim()
    if (total <= 0) return undefined
    return `${((fraction / total) * 100).toFixed(4)}%`
  })
}

/**
 * DataTable — the DS convenience wrapper over the primitives above, matching
 * `design-system/components/data/data-table/DataTable.d.ts`
 * (`columns` / `rows`, `rows[]._highlight`, `columns[].muted`).
 *
 * ```tsx
 * <DataTable
 *   columns={[
 *     { key: "name", label: "Vorgang", width: "1.3fr" },
 *     { key: "src", label: "Quelle", muted: true },
 *     { key: "status", label: "Status", width: "1.2fr" },
 *     { key: "next", label: "Nächster Schritt" },
 *   ]}
 *   rows={[{ name: "Neue Anzeigen prüfen", src: "roomscout.dev", status: …, next: … }]}
 * />
 * ```
 */
function DataTable({ columns, rows, className, ...props }: DataTableProps) {
  const widths = React.useMemo(() => resolveColumnWidths(columns), [columns])

  return (
    <Table container={{ ...props, className }}>
      <colgroup>
        {columns.map((column, index) => {
          const width = widths[index]
          return (
            <col key={column.key} style={width ? { width } : undefined} />
          )
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
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex} highlight={row._highlight === true}>
            {columns.map((column) => (
              <TableCell key={column.key} muted={column.muted}>
                {row[column.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

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
}
export type { DataTableColumn, DataTableRow, DataTableProps }
