/**
 * Operator surface smoke test — renders the demo host and walks the kit's own
 * flow: overview → „Beispielstörung laden“ → attention banner → Aufträge →
 * Diagnose sheet → „Anmeldung als erneuert simulieren“, plus the flag draft
 * round-trip and the Quellen / Integrationen pages.
 *
 * It guards the wiring (state derivations, controlled accordion, panel nav),
 * not the pixels — there is deliberately no screenshot check.
 */

import { beforeAll, describe, expect, it } from "vitest"

import { fireEvent, render, screen, within } from "@testing-library/react"

import { DemoOperatorPage } from "@/ui/operator/DemoOperatorPage"

describe("operator surface smoke", () => {
  // jsdom has no Element#scrollTo; PanelDialog resets the scroll on page change.
  beforeAll(() => {
    Element.prototype.scrollTo = () => {}
  })

  it("renders the panel, walks the pages and runs the incident flow", () => {
    render(<DemoOperatorPage />)

    // Overview
    expect(screen.getByText("Betrieb im Blick")).toBeInTheDocument()
    expect(screen.getByText("INTERN")).toBeInTheDocument()
    expect(
      screen.getByText(/Keine Aufgabe braucht Aufmerksamkeit/),
    ).toBeInTheDocument()
    expect(screen.getByText("Convex AI Gateway")).toBeInTheDocument()

    // Load the sample incident from the demo strip.
    fireEvent.click(screen.getByRole("button", { name: "Beispielstörung laden" }))
    expect(screen.getByText("1 Aufgabe braucht Aufmerksamkeit")).toBeInTheDocument()

    // „Ansehen“ → Aufträge with the attention filter preselected.
    fireEvent.click(screen.getByRole("button", { name: /Ansehen/ }))
    const orders = screen.getByRole("region", { name: "Aufträge" })
    expect(within(orders).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Aufträge",
    )
    expect(
      screen.getByRole("button", { name: "Braucht Aufmerksamkeit" }),
    ).toHaveAttribute("aria-pressed", "true")

    // Diagnose sheet from the expired row, then resolve.
    fireEvent.click(within(orders).getByRole("button", { name: "Diagnose" }))
    const sheet = screen.getByRole("dialog", { name: "Diagnose" })
    expect(
      within(sheet).getByText("Die gespeicherte Anmeldung ist abgelaufen."),
    ).toBeInTheDocument()
    fireEvent.click(
      within(sheet).getByRole("button", {
        name: "Anmeldung als erneuert simulieren",
      }),
    )
    expect(within(sheet).getByText(/Zugang erneuert/)).toBeInTheDocument()
  })

  it("drafts and saves feature flags", () => {
    render(<DemoOperatorPage />)

    fireEvent.click(screen.getByRole("button", { name: "Feature-Flags" }))
    fireEvent.click(screen.getByRole("switch", { name: "Voice Scout" }))
    expect(screen.getByText("Wirkung vor dem Speichern")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Lokal speichern" }))
    expect(screen.getByText("Flags lokal gespeichert.")).toBeInTheDocument()
  })

  it("shows sources and integrations", () => {
    render(<DemoOperatorPage />)

    fireEvent.click(screen.getByRole("button", { name: "Quellen" }))
    const sources = screen.getByRole("region", { name: "Quellen" })
    expect(within(sources).getByText("roomscout.dev")).toBeInTheDocument()
    expect(
      within(sources).getByText("Angebunden · Demo-Zugang"),
    ).toBeInTheDocument()
    expect(within(sources).getAllByText("Nicht aktiv (Flag aus)")).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: "Integrationen" }))
    expect(screen.getByText("OpenAI direkt")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Firecrawl/ }))
    expect(
      screen.getByText(/kein Nachweis für einen erfolgreichen Live-Test/),
    ).toBeInTheDocument()
  })
})
