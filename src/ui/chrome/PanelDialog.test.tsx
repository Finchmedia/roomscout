/**
 * `PanelDialog` — the `meta` nav row, in both placements.
 *
 * The desktop column and the `< 900px` page picker render the same
 * `PanelDialogNav`, so the contract under test is that a row with `meta`
 * carries its avatar, preview, stamp, state and named unread dot in each of
 * them, while `label` keeps driving the breadcrumb leaf and the picker's own
 * label exactly as a plain row does.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"

import { PanelDialog, type PanelDialogGroup } from "./PanelDialog"

/** Every rendered nav row, in DOM order: the desktop column first, then the sheet. */
function navRows(label: RegExp | string): HTMLElement[] {
  return screen
    .getAllByRole("button", { name: label })
    .filter((node) => node.getAttribute("data-sidebar") === "menu-button")
}

/** The `< 900px` page picker in the breadcrumb. */
function picker(): HTMLElement {
  return screen
    .getAllByRole("button")
    .find((node) => node.getAttribute("data-slot") === "panel-dialog-nav-trigger")!
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function groups(onSelect: () => void): PanelDialogGroup[] {
  return [
    {
      id: "conversations",
      items: [
        {
          id: "c1",
          label: "Proberaum Neukölln",
          onSelect,
          meta: {
            avatar: <span data-testid="row-avatar">P</span>,
            preview: "Anbieter: Der Raum ist frei.",
            time: "09:41",
            status: "Angebot liegt vor",
            dot: true,
            dotLabel: "Neue Nachricht",
          },
        },
        { id: "c2", label: "Bandkeller Wedding", meta: { preview: "Du: Danke!", time: "Gestern" } },
      ],
    },
  ]
}

function renderPanel(onSelect = vi.fn()) {
  return render(
    <PanelDialog
      open
      title="Nachrichten"
      rootLabel="Nachrichten"
      currentId="c1"
      groups={groups(onSelect)}
    >
      <p>Unterhaltung</p>
    </PanelDialog>
  )
}

describe("PanelDialog meta rows", () => {
  afterEach(cleanup)
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub)
    Element.prototype.scrollTo = () => {}
  })

  it("renders title, preview, stamp, state and a named unread dot", () => {
    renderPanel()
    const row = navRows(/Proberaum Neukölln/)[0]!
    expect(within(row).getByTestId("row-avatar")).toBeInTheDocument()
    expect(row).toHaveTextContent("Anbieter: Der Raum ist frei.")
    expect(row).toHaveTextContent("09:41")
    expect(row).toHaveTextContent("Angebot liegt vor")
    expect(within(row).getByLabelText("Neue Nachricht")).toBeInTheDocument()
    expect(row).toHaveAttribute("aria-current", "page")
  })

  it("keeps the breadcrumb leaf and the mobile picker on the row label alone", () => {
    renderPanel()
    expect(screen.getByRole("region", { name: "Proberaum Neukölln" })).toBeInTheDocument()
    expect(picker()).toHaveTextContent("Proberaum Neukölln")
    expect(picker()).toHaveAttribute("aria-haspopup", "dialog")
  })

  it("renders the same row inside the page picker and selects from there", () => {
    const onSelect = vi.fn()
    renderPanel(onSelect)
    const columnRow = navRows(/Proberaum Neukölln/)[0]!
    fireEvent.click(picker())

    // The Sheet is modal: it hides the column behind it, so the one exposed row
    // is the picker's — rendered by the same `PanelDialogNav`, meta and all.
    const sheetRows = navRows(/Proberaum Neukölln/)
    expect(sheetRows).toHaveLength(1)
    expect(sheetRows[0]).not.toBe(columnRow)
    expect(sheetRows[0]).toHaveTextContent("Anbieter: Der Raum ist frei.")
    expect(within(sheetRows[0]!).getByLabelText("Neue Nachricht")).toBeInTheDocument()

    fireEvent.click(sheetRows[0]!)
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it("leaves a row without meta as the plain single-line nav row", () => {
    render(
      <PanelDialog
        open
        title="Einstellungen"
        rootLabel="Einstellungen"
        currentId="sources"
        groups={[{ items: [{ id: "sources", label: "Quellen" }] }]}
      >
        <p>Seite</p>
      </PanelDialog>
    )
    const row = navRows("Quellen")[0]!
    expect(row.className).not.toContain("h-auto")
  })
})
