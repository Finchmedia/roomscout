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
    provider: "realtime",
    status: "idle",
    modality: "voice",
    muted: false,
    error: undefined,
    transcript: [],
    connectedAt: undefined,
    connected: false,
    volume: 0,
    providerMuted: false,
    connectionState: "disconnected",
    microphoneState: "off",
    userSpeaking: false,
    scoutSpeaking: false,
    backendState: "idle",
    pendingInputCount: 0,
    pendingTextDraft: "",
    sessionLocale: "de",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setMuted: vi.fn(),
    setModality: vi.fn(),
    sendText: vi.fn().mockReturnValue(true),
    flushPendingInputs: vi.fn().mockResolvedValue(true),
    retryFailedInput: vi.fn().mockReturnValue(false),
    clearPendingTextDraft: vi.fn(),
    interrupt: vi.fn(),
    stopSpeaking: vi.fn(),
    setLanguage: vi.fn(),
    setFocus: vi.fn(),
    appendVerifiedBackgroundUpdate: vi.fn().mockReturnValue(true),
    clearBackgroundUpdate: vi.fn(),
    clearBackgroundUpdates: vi.fn(),
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

  it("keeps real captions and call controls usable in compact companion mode", () => {
    fixture.session = session({
      connected: true,
      status: "speaking",
      transcript: [
        { id: "user", role: "user", text: "Wednesday evenings, around three hundred euros.", final: true },
        { id: "scout", role: "assistant", text: "I am updating the saved search.", final: false },
      ],
    })
    const onText = vi.fn()
    const { container } = render(
      <LiveVoiceChat
        compact
        onText={onText}
        labels={{
          end: "End conversation",
          interrupt: "Interrupt Scout",
          microphoneOff: "Turn microphone off",
          switchToText: "Switch to text",
        }}
      />,
    )

    const surface = container.querySelector('[data-scout-conversation="voice"]')
    const transcript = container.querySelector('[data-voice-transcript-density="compact"]')
    expect(surface).toHaveAttribute("data-compact", "true")
    expect(container.querySelector('[data-slot="scout-blob"]')).toBeNull()
    expect(transcript).toHaveAttribute("data-voice-transcript-density", "compact")
    expect(transcript).toHaveTextContent("Wednesday evenings, around three hundred euros.")
    expect(transcript).toHaveTextContent("I am updating the saved search.")

    const mic = screen.getByRole("button", { name: "Turn microphone off" })
    const interrupt = screen.getByRole("button", { name: "Interrupt Scout" })
    const end = screen.getByRole("button", { name: "End conversation" })
    expect(mic).toHaveAttribute("data-density", "narrow")
    expect(interrupt).toHaveAttribute("data-density", "narrow")
    expect(end).toHaveAttribute("data-density", "narrow")

    fireEvent.click(mic)
    fireEvent.click(interrupt)
    fireEvent.click(screen.getByRole("button", { name: "Switch to text" }))
    expect(fixture.session.setMuted).toHaveBeenCalledWith(true)
    expect(fixture.session.interrupt).toHaveBeenCalledOnce()
    expect(onText).toHaveBeenCalledOnce()
  })
})
