import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SourceRowSurface } from "./SourceRow"

describe("SourceRowSurface", () => {
  it("renders caller data and reports the requested checked state", () => {
    const onToggle = vi.fn()
    render(
      <SourceRowSurface
        name="Live source"
        description="Current registry description"
        enabled
        status={{ label: "Healthy", tone: "success" }}
        onToggle={onToggle}
        detail={<p>Live source detail</p>}
        connectionAction={<button type="button">Manage live connection</button>}
      />
    )

    expect(screen.getByText("Live source")).toBeInTheDocument()
    expect(screen.getByText("Healthy")).toBeInTheDocument()
    expect(screen.getByText("Live source detail")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Manage live connection" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("switch"))
    expect(onToggle).toHaveBeenCalledWith(false)
  })

  it("makes an omitted toggle handler read-only and keeps details collapsible", () => {
    const { container } = render(
      <SourceRowSurface
        name="Read-only source"
        description="Managed elsewhere"
        enabled={false}
        status={{ label: "Paused", tone: "muted" }}
        detail={<p>Operational detail</p>}
      />
    )

    expect(within(container).getByRole("switch")).toBeDisabled()
    const details = within(container).getByRole("button", { name: /details/i })
    expect(details).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(details)
    expect(details).toHaveAttribute("aria-expanded", "true")
  })
})
