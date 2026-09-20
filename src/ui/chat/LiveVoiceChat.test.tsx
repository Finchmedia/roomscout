import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
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
    providerMuted: false,
    connectionState: "disconnected",
    microphoneState: "off",
    userSpeaking: false,
    scoutSpeaking: false,
    backendState: "idle",
    pendingInputCount: 0,
    pendingTextDraft: "",
    automaticEndToken: 0,
    sessionLocale: "de",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setMuted: vi.fn(),
    setModality: vi.fn(),
    sendText: vi.fn().mockReturnValue(true),
    flushPendingInputs: vi.fn().mockResolvedValue(true),
    retryFailedInput: vi.fn().mockReturnValue(false),
    clearPendingTextDraft: vi.fn(),
    noteActivity: vi.fn(),
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

  it("hides voice delivery cues while preserving spoken content and meaningful brackets", () => {
    fixture.session = session({ transcript: [
      { id: "cue", role: "assistant", text: "[laugh]", final: true },
      { id: "joke", role: "assistant", text: "Hm [chuckle] Because they wanted to reach the high notes. [Tuesday] works.", final: true },
      { id: "user", role: "user", text: "Keep [laugh] in the song title", final: true },
    ] })
    const { container } = render(<LiveVoiceChat compact primary />)
    expect(screen.getByText("Hm Because they wanted to reach the high notes. [Tuesday] works.")).toBeTruthy()
    expect(screen.getByText("Keep [laugh] in the song title")).toBeTruthy()
    expect(screen.queryByText("[laugh]")).toBeNull()
  })

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

  it("leaves voice for text after an automatic farewell closes", () => {
    const onEnd = vi.fn()
    fixture.session = session({ connected: true, status: "listening", automaticEndToken: 0 })
    const view = render(<LiveVoiceChat onEnd={onEnd} />)
    fixture.session = session({ connected: false, status: "disconnected", automaticEndToken: 1 })
    view.rerender(<LiveVoiceChat onEnd={onEnd} />)
    expect(onEnd).toHaveBeenCalledOnce()
    expect(fixture.session.disconnect).not.toHaveBeenCalled()
    view.rerender(<LiveVoiceChat onEnd={onEnd} />)
    expect(onEnd).toHaveBeenCalledOnce()
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

  it("shows hook errors and offers reconnection", () => {
    fixture.session = session({ status: "error", error: "Mikrofon nicht verfügbar" })
    render(<LiveVoiceChat />)
    expect(screen.getByRole("alert")).toHaveTextContent("Mikrofon nicht verfügbar")
    expect(screen.getByRole("button", { name: "Gespräch erneut starten" })).toBeInTheDocument()
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
    render(
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

    const controls = screen.getByRole("group", { name: "Gesprächssteuerung" })
    expect(screen.getByRole("region", { name: "Gespräch mit deinem RoomScout" })).toBeInTheDocument()
    expect(screen.getByLabelText("Letzte Gesprächsbeiträge")).toHaveTextContent(
      "Wednesday evenings, around three hundred euros.",
    )
    expect(screen.getByLabelText("Letzte Gesprächsbeiträge")).toHaveTextContent(
      "I am updating the saved search.",
    )

    const mic = screen.getByRole("button", { name: "Turn microphone off" })
    const interrupt = screen.getByRole("button", { name: "Interrupt Scout" })
    const end = screen.getByRole("button", { name: "End conversation" })
    const switchToText = screen.getByRole("button", { name: "Switch to text" })
    for (const control of [mic, interrupt, end]) expect(controls).toContainElement(control)
    expect(controls).toContainElement(switchToText)

    fireEvent.click(mic)
    fireEvent.click(interrupt)
    fireEvent.click(switchToText)
    expect(fixture.session.setMuted).toHaveBeenCalledWith(true)
    expect(fixture.session.interrupt).toHaveBeenCalledOnce()
    expect(onText).toHaveBeenCalledOnce()
  })

  it("shows one primary voice conversation with its caption and controls", () => {
    fixture.session = session({
      connected: true,
      status: "listening",
      transcript: [{ id: "caption", role: "assistant", text: "I am checking that now.", final: false }],
    })
    const { container } = render(<LiveVoiceChat compact primary />)
    expect(screen.getAllByRole("region", { name: "Gespräch mit deinem RoomScout" })).toHaveLength(1)
    expect(container.querySelectorAll('[data-slot="scout-blob"]')).toHaveLength(1)
    expect(screen.getByLabelText("Letzte Gesprächsbeiträge")).toHaveTextContent("I am checking that now.")
    expect(screen.getByRole("button", { name: "Mikrofon ausschalten" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gespräch beenden" })).toBeInTheDocument()
  })

  it("puts one official shimmer pending line after the newest voice turn without a permanent title", () => {
    fixture.session = session({
      connected: true,
      status: "thinking",
      muted: true,
      transcript: [{ id: "user", role: "user", text: "Wednesday evening works.", final: true }],
    })
    render(<LiveVoiceChat compact primary />)

    const transcript = screen.getByLabelText("Letzte Gesprächsbeiträge")
    const pending = screen.getByRole("status", { name: "Ich denke kurz nach" })
    expect(transcript).toContainElement(pending)
    expect(pending.querySelector(".text-transparent")).toBeInTheDocument()
    expect(screen.getAllByText("Ich denke kurz nach")).toHaveLength(1)
    expect(screen.getByText("Mikrofon aus")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Erzähl mir, was ihr sucht." })).not.toBeInTheDocument()
    expect(screen.getAllByRole("status", { name: "Ich denke kurz nach" })).toHaveLength(1)
  })

  describe("queued copy", () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it("shows the backend update, not a queue, for one pending item until the wait is real", () => {
      fixture.session = session({ connected: true, status: "thinking", backendState: "processing", pendingInputCount: 1 })
      const view = render(<LiveVoiceChat compact primary />)
      expect(screen.getByRole("status", { name: "Dein Suchauftrag wird aktualisiert …" })).toBeInTheDocument()
      expect(screen.queryByText("Deine Nachricht wartet kurz …")).not.toBeInTheDocument()

      act(() => { vi.advanceTimersByTime(3_999) })
      expect(screen.queryByText("Deine Nachricht wartet kurz …")).not.toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(1) })
      expect(screen.getByRole("status", { name: "Deine Nachricht wartet kurz …" })).toBeInTheDocument()
      expect(screen.getAllByRole("status", { name: "Deine Nachricht wartet kurz …" })).toHaveLength(1)

      // Returning to zero clears the gate; the next single item waits again.
      fixture.session = session({ connected: true, status: "listening", backendState: "idle", pendingInputCount: 0 })
      view.rerender(<LiveVoiceChat compact primary />)
      expect(screen.queryByText("Deine Nachricht wartet kurz …")).not.toBeInTheDocument()
      fixture.session = session({ connected: true, status: "thinking", backendState: "processing", pendingInputCount: 1 })
      view.rerender(<LiveVoiceChat compact primary />)
      expect(screen.getByRole("status", { name: "Dein Suchauftrag wird aktualisiert …" })).toBeInTheDocument()
      expect(screen.queryByText("Deine Nachricht wartet kurz …")).not.toBeInTheDocument()
    })

    it("keeps the wait running while the backlog grows from one item to two", () => {
      fixture.session = session({ connected: true, status: "thinking", backendState: "processing", pendingInputCount: 1 })
      const view = render(<LiveVoiceChat compact primary />)
      act(() => { vi.advanceTimersByTime(3_000) })
      fixture.session = session({ connected: true, status: "thinking", backendState: "processing", pendingInputCount: 2 })
      view.rerender(<LiveVoiceChat compact primary />)
      // Two waiting messages are a real backlog: no gate at all.
      expect(screen.getByRole("status", { name: "Deine Nachricht wartet kurz …" })).toBeInTheDocument()
      fixture.session = session({ connected: true, status: "thinking", backendState: "processing", pendingInputCount: 1 })
      view.rerender(<LiveVoiceChat compact primary />)
      expect(screen.getByRole("status", { name: "Dein Suchauftrag wird aktualisiert …" })).toBeInTheDocument()
      act(() => { vi.advanceTimersByTime(1_000) })
      expect(screen.getByRole("status", { name: "Deine Nachricht wartet kurz …" })).toBeInTheDocument()
    })

    it("announces a real backlog of two messages immediately", () => {
      fixture.session = session({ connected: true, status: "thinking", backendState: "processing", pendingInputCount: 2 })
      render(<LiveVoiceChat compact primary />)
      expect(screen.getByRole("status", { name: "Deine Nachricht wartet kurz …" })).toBeInTheDocument()
    })

    it("falls back to thinking for one item waiting on a queued backend", () => {
      fixture.session = session({ connected: true, status: "thinking", backendState: "queued", pendingInputCount: 1 })
      render(<LiveVoiceChat compact primary />)
      expect(screen.getByRole("status", { name: "Ich denke kurz nach" })).toBeInTheDocument()
      expect(screen.queryByText("Deine Nachricht wartet kurz …")).not.toBeInTheDocument()
    })

    it("lets the speaking status stand while background work runs", () => {
      fixture.session = session({ connected: true, status: "speaking", backendState: "processing", pendingInputCount: 1 })
      render(<LiveVoiceChat compact primary />)
      act(() => { vi.advanceTimersByTime(5_000) })
      expect(screen.queryByText("Dein Suchauftrag wird aktualisiert …")).not.toBeInTheDocument()
      expect(screen.queryByText("Deine Nachricht wartet kurz …")).not.toBeInTheDocument()
      expect(screen.getByText("Dein Scout spricht")).toBeInTheDocument()
    })

    it("still surfaces an unknown outcome while the Scout speaks", () => {
      fixture.session = session({ connected: true, status: "speaking", backendState: "outcome_unknown", pendingInputCount: 0 })
      render(<LiveVoiceChat compact primary />)
      expect(screen.getByRole("status", { name: "Der letzte Schritt wird noch geprüft." })).toBeInTheDocument()
    })
  })

  it("keeps call controls while the explicit text view suppresses live captions", () => {
    fixture.session = session({
      connected: true,
      status: "listening",
      transcript: [{ id: "caption", role: "user", text: "This belongs only to voice captions.", final: true }],
    })
    const { container } = render(<LiveVoiceChat compact showTranscript={false} />)
    expect(container.querySelector('[data-voice-transcript-density]')).toBeNull()
    expect(screen.queryByText("This belongs only to voice captions.")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mikrofon ausschalten" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Gespräch beenden" })).toBeInTheDocument()
  })

  it("scrolls only its caption viewport and preserves user-scrolled history", () => {
    const scrollIntoView = vi.fn()
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    })
    fixture.session = session({
      connected: true,
      status: "listening",
      transcript: [{ id: "first", role: "user", text: "First caption", final: false }],
    })
    const { container, rerender } = render(
      <div data-outer-scroll>
        <LiveVoiceChat compact />
      </div>,
    )
    const outer = container.querySelector<HTMLElement>("[data-outer-scroll]")!
    const captions = container.querySelector<HTMLElement>("[data-voice-transcript-density]")!
    outer.scrollTop = 345
    Object.defineProperty(captions, "clientHeight", { configurable: true, value: 100 })
    Object.defineProperty(captions, "scrollHeight", { configurable: true, value: 300 })
    captions.scrollTop = 200
    fireEvent.scroll(captions)

    fixture.session = session({
      connected: true,
      status: "listening",
      transcript: [
        { id: "first", role: "user", text: "First caption", final: false },
        { id: "latest", role: "assistant", text: "Latest caption", final: false },
      ],
    })
    Object.defineProperty(captions, "scrollHeight", { configurable: true, value: 420 })
    rerender(<div data-outer-scroll><LiveVoiceChat compact /></div>)
    expect(captions.scrollTop).toBe(420)
    expect(outer.scrollTop).toBe(345)
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByText("Latest caption")).toBeInTheDocument()

    captions.scrollTop = 40
    fireEvent.scroll(captions)
    fixture.session = session({
      connected: true,
      status: "listening",
      transcript: [
        { id: "first", role: "user", text: "First caption", final: false },
        { id: "latest", role: "assistant", text: "Latest caption", final: false },
        { id: "newest", role: "user", text: "Newest caption", final: false },
      ],
    })
    Object.defineProperty(captions, "scrollHeight", { configurable: true, value: 520 })
    rerender(<div data-outer-scroll><LiveVoiceChat compact /></div>)
    expect(captions.scrollTop).toBe(40)
    expect(outer.scrollTop).toBe(345)
  })
})
