import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { VoiceSessionValue } from "@/components/voice/VoiceSessionContext"
import { LiveVoiceChat } from "./LiveVoiceChat"

const fixture = vi.hoisted(() => ({ session: {} as VoiceSessionValue }))
vi.mock("@/components/voice/VoiceSessionContext", () => ({
  useVoiceSession: () => fixture.session,
}))

function session(overrides: Partial<VoiceSessionValue> = {}): VoiceSessionValue {
  return {
    status: "idle",
    modality: "voice",
    muted: false,
    error: undefined,
    transcript: [],
    connectedAt: undefined,
    connected: false,
    volume: 0,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setMuted: vi.fn(),
    setModality: vi.fn(),
    sendText: vi.fn().mockReturnValue(true),
    interrupt: vi.fn(),
    sendEvent: vi.fn(),
    ...overrides,
  }
}

describe("LiveVoiceChat", () => {
  beforeEach(() => {
    fixture.session = session()
  })
  afterEach(cleanup)

  it("connects and supports custom typed labels", () => {
    render(<LiveVoiceChat labels={{ connect: "Jetzt sprechen" }} />)
    fireEvent.click(screen.getByRole("button", { name: "Jetzt sprechen" }))
    expect(fixture.session.connect).toHaveBeenCalledOnce()
  })

  it("disconnects before handing an ended session back to its owner", () => {
    const calls: string[] = []
    fixture.session = session({
      connected: true,
      status: "listening",
      disconnect: vi.fn(() => calls.push("disconnect")),
    })
    render(<LiveVoiceChat onEnd={() => calls.push("onEnd")} />)
    fireEvent.click(screen.getByRole("button", { name: "Gespräch beenden" }))
    expect(calls).toEqual(["disconnect", "onEnd"])
  })

  it("preserves overlapping caption history and active mute, interrupt, and text controls", () => {
    fixture.session = session({
      connected: true,
      status: "speaking",
      transcript: [
        { id: "old-user", role: "user", text: "Alter Wunsch", final: true },
        { id: "new-user", role: "user", text: "Mittwoch passt", final: true },
        { id: "scout", role: "assistant", text: "Ich prüfe das.", final: true },
      ],
    })
    const onText = vi.fn()
    render(<LiveVoiceChat onText={onText} />)

    expect(screen.getByText("Alter Wunsch")).toBeInTheDocument()
    expect(screen.getByText("Mittwoch passt")).toBeInTheDocument()
    expect(screen.getByText("Ich prüfe das.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Mikrofon ausschalten" }))
    fireEvent.click(screen.getByRole("button", { name: "Scout unterbrechen" }))
    fireEvent.click(screen.getByRole("button", { name: "Zum Schreiben wechseln" }))
    expect(fixture.session.setMuted).toHaveBeenCalledWith(true)
    expect(fixture.session.interrupt).toHaveBeenCalledOnce()
    expect(onText).toHaveBeenCalledOnce()
  })

  it("shows hook errors and reconnects without inventing activity UI", () => {
    fixture.session = session({ status: "error", error: "Mikrofon nicht verfügbar" })
    const { container } = render(<LiveVoiceChat />)
    expect(screen.getByRole("alert")).toHaveTextContent("Mikrofon nicht verfügbar")
    expect(screen.getByRole("button", { name: "Gespräch erneut starten" })).toBeInTheDocument()
    expect(container.querySelector("canvas")).toBeNull()
  })

  it("can defer the decorative blob to an enclosing stage", () => {
    const { container } = render(<LiveVoiceChat hideBlob />)
    expect(container.querySelector('[data-slot="scout-blob"]')).toBeNull()
  })
})
