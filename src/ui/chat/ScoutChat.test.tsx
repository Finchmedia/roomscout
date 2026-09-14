import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

import { MemoryRouter } from "react-router-dom"

import { ScoutChat } from "./ScoutChat"
import type { OpenDecision } from "@/components/scout/DecisionCard"

const decision: OpenDecision = {
  _id: "decision-1" as OpenDecision["_id"],
  kind: "review_message",
  status: "open",
  question: "Soll ich diese Nachricht so senden?",
  detail: "Hallo, ist der Raum noch frei?",
  options: [{ id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" }],
  refs: {},
  createdAt: 1,
  updatedAt: 1,
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ScoutChat", () => {
  afterEach(cleanup)

  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub)
    Element.prototype.scrollTo = () => {}
    Element.prototype.scrollIntoView = () => {}
  })

  it("renders speakers, system markers, and safe markdown", () => {
    const { container } = render(
      <ScoutChat
        messages={[
          { id: "1", author: "system", body: "Heute" },
          { id: "2", author: "scout", body: "**Hallo** <script>alert(1)</script>" },
          { id: "3", author: "user", body: "Hi" },
        ]}
        onSend={vi.fn()}
      />
    )

    expect(screen.getByRole("status", { name: "System" })).toHaveTextContent("Heute")
    expect(screen.getByRole("group", { name: "Dein Scout" })).toHaveTextContent("Hallo")
    expect(screen.getByRole("group", { name: "Du" })).toBeInTheDocument()
    expect(container.querySelector("strong")).toHaveTextContent("Hallo")
    expect(container.querySelector("script")).toBeNull()
  })

  it("clears immediately while send is pending and synchronously blocks duplicates", async () => {
    let finish: ((sent: boolean) => void) | undefined
    const onSend = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve }))
    render(<ScoutChat messages={[]} onSend={onSend} />)
    const composer = screen.getByRole("textbox", { name: "Nachricht an deinen Scout …" })

    fireEvent.change(composer, { target: { value: "Hallo Scout" } })
    fireEvent.keyDown(composer, { key: "Enter" })
    fireEvent.keyDown(composer, { key: "Enter" })
    expect(composer).toHaveValue("")
    expect(onSend).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status", { name: "Nachricht wird gesendet …" })).toBeInTheDocument()
    await act(async () => finish?.(true))
  })

  it("restores a failed send when the user has not typed anything newer", async () => {
    const onSend = vi.fn().mockResolvedValue(false)
    render(<ScoutChat messages={[]} onSend={onSend} />)
    const composer = screen.getByRole("textbox")
    fireEvent.change(composer, { target: { value: "Hallo Scout" } })
    fireEvent.keyDown(composer, { key: "Enter" })
    expect(composer).toHaveValue("")
    await screen.findByRole("alert")
    expect(composer).toHaveValue("Hallo Scout")
  })

  it("does not overwrite newer typing when a send fails and keeps the failed draft recoverable", async () => {
    let finish: ((sent: boolean) => void) | undefined
    const onSend = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve }))
    render(<ScoutChat messages={[]} onSend={onSend} />)
    const composer = screen.getByRole("textbox")
    fireEvent.change(composer, { target: { value: "Erste Nachricht" } })
    fireEvent.keyDown(composer, { key: "Enter" })
    fireEvent.change(composer, { target: { value: "Neuer Text" } })
    await act(async () => finish?.(false))
    expect(composer).toHaveValue("Neuer Text")
    fireEvent.click(screen.getByRole("button", { name: "Fehlgeschlagenen Entwurf wiederherstellen" }))
    expect(composer).toHaveValue("Erste Nachricht\n\nNeuer Text")
    expect(screen.queryByRole("button", { name: "Fehlgeschlagenen Entwurf wiederherstellen" })).not.toBeInTheDocument()
  })

  it("does not submit an IME composition and exposes history and voice controls", () => {
    const onSend = vi.fn().mockResolvedValue(true)
    const onVoice = vi.fn()
    const onLoadHistory = vi.fn()
    render(
      <ScoutChat
        messages={[]}
        onSend={onSend}
        onVoice={onVoice}
        onLoadHistory={onLoadHistory}
        hasMoreHistory
      />
    )
    const composer = screen.getByRole("textbox")
    fireEvent.change(composer, { target: { value: "入力中" } })
    fireEvent.keyDown(composer, { key: "Enter", isComposing: true })
    expect(onSend).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Mit Scout sprechen" }))
    fireEvent.click(screen.getByRole("button", { name: "Ältere Nachrichten laden" }))
    expect(onVoice).toHaveBeenCalledOnce()
    expect(onLoadHistory).toHaveBeenCalledOnce()
  })

  it("renders the open Entscheidung after the transcript and echoes the answer as bubbles", async () => {
    const onAnswerDecision = vi.fn().mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <ScoutChat
          messages={[{ id: "1", author: "scout", body: "Ich habe einen Raum gefunden." }]}
          onSend={vi.fn()}
          decision={decision}
          onAnswerDecision={onAnswerDecision}
          decisionAnsweredText="Danke, ich mache weiter."
        />
      </MemoryRouter>
    )
    const viewport = screen.getByRole("region", { name: "Scout-Chat" })
    const transcript = viewport.querySelector('[data-slot="bubble-content"]')
    const card = screen.getByRole("group", { name: "Entscheidung" })
    expect(transcript && card.compareDocumentPosition(transcript) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Ja, so senden" }))
    expect(onAnswerDecision).toHaveBeenCalledWith("decision-1", "yes")
    expect((await screen.findAllByRole("group", { name: "Du" })).at(-1)).toHaveTextContent("Ja, so senden")
    expect(screen.getAllByRole("group", { name: "Dein Scout" }).at(-1)).toHaveTextContent("Danke, ich mache weiter.")
  })
})
