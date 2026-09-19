import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { LocaleProvider } from "@/ui/copy"

import { ResearchCoverage } from "./ResearchCoverage"
import { researchCoverageSnapshot, type ResearchCoverageSnapshot } from "./researchCoverageSnapshot"

afterEach(cleanup)

vi.mock("@/components/map/MarketGlobe", () => ({
  MarketGlobe: ({ interactive, signals, showHint, showSignalPanel }: { interactive: boolean; signals: Array<{ title: string }>; showHint: boolean; showSignalPanel: boolean }) => (
    <div data-interactive={interactive} data-signal-count={signals.length} data-signal-titles={signals.map((signal) => signal.title).join(",")} data-show-hint={showHint} data-show-panel={showSignalPanel} data-testid="market-globe" />
  ),
}))

function renderCoverage(snapshot: ResearchCoverageSnapshot = researchCoverageSnapshot) {
  return render(<LocaleProvider><ResearchCoverage demoHref="/design/scout" mapAccessToken="pk.test-public-token" snapshot={snapshot} /></LocaleProvider>)
}

describe("landing research coverage", () => {
  it("renders the existing map with no markers when no real signal qualifies", async () => {
    renderCoverage()
    expect(screen.getByText("0 real rehearsal rooms found")).toBeInTheDocument()
    expect(screen.getByText(/currently no real rehearsal rooms listed here/i)).toBeInTheDocument()
    expect(screen.getByText(/No public source links are available yet/)).toBeInTheDocument()
    expect(screen.queryByText("Public source")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Try fictional rooms in Berlin →" })).toHaveAttribute("href", "/design/scout")
    expect(await screen.findByTestId("market-globe")).toHaveAttribute("data-signal-count", "0")
    expect(screen.getByTestId("market-globe")).toHaveAttribute("data-show-hint", "false")
    expect(screen.getByTestId("market-globe")).toHaveAttribute("data-show-panel", "false")
    expect(screen.getByTestId("market-globe")).toHaveAttribute("data-interactive", "false")
  })

  it("supplies only snapshot cities and evidence-backed sources to the existing map", async () => {
    renderCoverage({
      schemaVersion: 1,
      snapshotId: "fixture-v1",
      observedAt: "2026-09-17T00:00:00.000Z",
      realListingCount: 2,
      cities: [{ city: "Hamburg", latitude: 53.55, longitude: 9.99, realListingCount: 2 }],
      indexedSources: [{ name: "Fixture source", listingCount: 2 }],
    })
    expect(screen.getByText("Fixture source")).toBeInTheDocument()
    expect(screen.getByText("Public source")).toBeInTheDocument()
    expect(screen.queryByText(/no real rehearsal rooms listed here/i)).not.toBeInTheDocument()
    expect(await screen.findByTestId("market-globe")).toHaveAttribute("data-signal-count", "1")
    expect(screen.getByTestId("market-globe")).toHaveAttribute("data-signal-titles", "Hamburg")
  })

  it("shows a friendly state when the public Mapbox token is missing", () => {
    render(<LocaleProvider><ResearchCoverage snapshot={researchCoverageSnapshot} mapAccessToken="" /></LocaleProvider>)
    expect(screen.getByText(/map is currently unavailable/i)).toBeInTheDocument()
    expect(screen.queryByTestId("market-globe")).not.toBeInTheDocument()
  })
})
