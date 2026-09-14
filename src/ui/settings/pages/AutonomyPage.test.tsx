import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AutonomyPage } from "./AutonomyPage"
import type { AutonomyRules } from "../state/useSettingsDemoState"

vi.mock("@/ui/copy", () => ({ useCopy: () => ({ t: (key: string) => key }) }))

const rules: AutonomyRules = {
  mode: "review",
  contact: true,
  viewings: false,
  publishAd: false,
  shareProfile: true,
  sharePrivate: false,
}

function props(
  overrides: Partial<ComponentProps<typeof AutonomyPage>> = {}
): ComponentProps<typeof AutonomyPage> {
  return { rules, draft: null, onDraftChange: vi.fn(), onSave: vi.fn(), ...overrides }
}

afterEach(cleanup)

describe("AutonomyPage", () => {
  it("renders the mode radio and the switches from the saved rules", () => {
    render(<AutonomyPage {...props()} />)
    expect(screen.getByRole("radio", { name: /settings.autonomy.mode.review.title/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("radio", { name: /settings.autonomy.mode.autopilot.title/ })).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("switch", { name: "settings.autonomy.action.contact" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: "settings.autonomy.action.viewings" })).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("switch", { name: "settings.autonomy.share.profile" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: "settings.autonomy.share.private" })).toHaveAttribute("aria-checked", "false")
  })

  it("has no daily limit control any more", () => {
    render(<AutonomyPage {...props()} />)
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument()
    expect(screen.queryByText(/settings.autonomy.limits/)).not.toBeInTheDocument()
  })

  it("reports a toggled switch as a draft with exactly that rule changed", () => {
    const values = props()
    render(<AutonomyPage {...values} />)
    fireEvent.click(screen.getByRole("switch", { name: "settings.autonomy.action.viewings" }))
    expect(values.onDraftChange).toHaveBeenCalledWith({ ...rules, viewings: true })
    fireEvent.click(screen.getByRole("radio", { name: /settings.autonomy.mode.autopilot.title/ }))
    expect(values.onDraftChange).toHaveBeenLastCalledWith({ ...rules, mode: "autopilot" })
  })

  it("prefers the draft over the saved rules and saves exactly the draft", async () => {
    const draft: AutonomyRules = { ...rules, mode: "autopilot", sharePrivate: true }
    const values = props({ draft })
    render(<AutonomyPage {...values} />)
    expect(screen.getByRole("radio", { name: /settings.autonomy.mode.autopilot.title/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("switch", { name: "settings.autonomy.share.private" })).toHaveAttribute("aria-checked", "true")
    fireEvent.click(screen.getByRole("button", { name: "settings.autonomy.save" }))
    expect(values.onSave).toHaveBeenCalledWith(draft)
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("settings.autonomy.saved"))
  })

  it("does not show the saved line when the host reports a failed save", async () => {
    const values = props({ draft: { ...rules, contact: false }, onSave: vi.fn(async () => false) })
    render(<AutonomyPage {...values} />)
    fireEvent.click(screen.getByRole("button", { name: "settings.autonomy.save" }))
    await waitFor(() => expect(values.onSave).toHaveBeenCalled())
    expect(screen.getByRole("status")).toHaveTextContent("")
  })

  it("hides the save bar buttons while the draft equals the saved rules and clears the draft on cancel", () => {
    const values = props({ draft: { ...rules } })
    render(<AutonomyPage {...values} />)
    expect(screen.queryByRole("button", { name: "settings.autonomy.save" })).not.toBeInTheDocument()
    cleanup()
    const dirty = props({ draft: { ...rules, publishAd: true } })
    render(<AutonomyPage {...dirty} />)
    fireEvent.click(screen.getByRole("button", { name: "settings.autonomy.cancel" }))
    expect(dirty.onDraftChange).toHaveBeenCalledWith(null)
  })

  it("renders the error as an alert and keeps save disabled while saving", () => {
    render(<AutonomyPage {...props({ draft: { ...rules, contact: false }, error: "Speichern fehlgeschlagen", saving: true })} />)
    expect(screen.getByRole("alert")).toHaveTextContent("Speichern fehlgeschlagen")
    expect(screen.getByRole("button", { name: "settings.autonomy.save" })).toBeDisabled()
    expect(screen.getByRole("switch", { name: "settings.autonomy.action.contact" })).toBeDisabled()
  })
})
