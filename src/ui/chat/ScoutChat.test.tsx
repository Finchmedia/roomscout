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

  it("reveals a streaming reply and keeps the same bubble once it succeeded", async () => {
    const view = render(
      <ScoutChat
        messages={[{ id: "1", author: "scout", body: "Ich schaue mal nach.", status: "streaming" }]}
        onSend={vi.fn()}
        replying
      />
    )
    // `useSmoothText` paces the deltas, so the line is still incomplete on the
    // first frame and fills in over the next few.
    expect(screen.queryByText("Ich schaue mal nach.")).toBeNull()
    expect(await screen.findByText("Ich schaue mal nach.")).toBeInTheDocument()
    expect(screen.queryByRole("status", { name: "Dein Scout denkt nach …" })).not.toBeInTheDocument()

    view.rerender(
      <ScoutChat
        messages={[{ id: "1", author: "scout", body: "Ich schaue mal nach.", status: "success" }]}
        onSend={vi.fn()}
      />
    )
    expect(screen.getByRole("group", { name: "Dein Scout" })).toHaveTextContent("Ich schaue mal nach.")
  })

  it("shows a shimmering thinking verb while the reply is pending and has no prose yet", () => {
    const verbs = ["Sortiert Gedanken …", "Wägt Optionen ab …"]
    render(
      <ScoutChat
        messages={[
          { id: "1", author: "user", body: "Wir suchen ab Mai.", status: "success" },
          { id: "2", author: "scout", body: "", status: "pending" },
        ]}
        onSend={vi.fn()}
        labels={{ thinkingVerbs: verbs }}
        replying
      />
    )
    // The accessible name stays the one stable status; the visible line is one
    // of the rotating verbs and it sweeps.
    const marker = screen.getByRole("status", { name: "Dein Scout denkt nach …" })
    const line = marker.querySelector('[data-slot="marker-content"]')
    expect(line?.querySelector(".text-transparent")).toBeInTheDocument()
    expect(verbs).toContain(line?.textContent)
    // An empty pending reply is a state, not an empty bubble.
    expect(screen.queryByRole("group", { name: "Dein Scout" })).not.toBeInTheDocument()
  })

  it("rotates the thinking verb while the Scout keeps working", () => {
    vi.useFakeTimers()
    try {
      const verbs = ["Sortiert Gedanken …", "Wägt Optionen ab …"]
      render(
        <ScoutChat
          messages={[{ id: "1", author: "scout", body: "", status: "pending" }]}
          onSend={vi.fn()}
          labels={{ thinkingVerbs: verbs }}
          replying
        />
      )
      const line = () =>
        screen.getByRole("status", { name: "Dein Scout denkt nach …" })
          .querySelector('[data-slot="marker-content"]')?.textContent
      const first = line()
      act(() => { vi.advanceTimersByTime(2_200) })
      expect(line()).not.toBe(first)
      expect(verbs).toContain(line())
    } finally {
      vi.useRealTimers()
    }
  })

  it("leaves the composer usable and unexplained while the Scout replies", () => {
    render(
      <ScoutChat
        messages={[{ id: "1", author: "scout", body: "", status: "pending" }]}
        onSend={vi.fn()}
        replying
      />
    )
    // The marker already says the Scout is working; the composer repeating it
    // was the duplicate line that had to go.
    expect(screen.queryByText("Dein Scout antwortet gerade …")).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Nachricht an deinen Scout …" })).not.toBeDisabled()
  })

  it("shows one pending line for a running tool and drops it once the reply succeeded", () => {
    const toolPart = { type: "tool-rememberFact", toolCallId: "call-1", state: "input-available" }
    const labels = { tools: { rememberFact: "Merkt sich etwas" }, toolDefault: "Arbeitet …" }
    const view = render(
      <ScoutChat
        messages={[{ id: "1", author: "scout", body: "", status: "streaming", parts: [toolPart] }]}
        onSend={vi.fn()}
        labels={labels}
        replying
      />
    )
    expect(screen.getAllByRole("status", { name: "Dein Scout denkt nach …" })).toHaveLength(1)
    expect(screen.getByText("Merkt sich etwas")).toBeInTheDocument()

    view.rerender(
      <ScoutChat
        messages={[{
          id: "1", author: "scout", body: "Notiert.", status: "success",
          parts: [{ ...toolPart, state: "output-available" }, { type: "text", text: "Notiert." }],
        }]}
        onSend={vi.fn()}
        labels={labels}
      />
    )
    expect(screen.queryByText("Merkt sich etwas")).not.toBeInTheDocument()
  })

  it("offers to resend a message whose turn failed", () => {
    const onSend = vi.fn().mockResolvedValue(true)
    render(
      <ScoutChat
        messages={[{ id: "1", author: "user", body: "Wir suchen ab Mai.", status: "failed" }]}
        onSend={onSend}
      />
    )
    expect(screen.getByRole("status", { name: "Antwort fehlgeschlagen." })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Erneut senden" }))
    expect(onSend).toHaveBeenCalledWith("Wir suchen ab Mai.")
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

    fireEvent.click(screen.getByRole("radio", { name: "Ja, so senden" }))
    fireEvent.click(screen.getByRole("button", { name: "Antworten" }))
    expect(onAnswerDecision).toHaveBeenCalledWith("decision-1", "yes", undefined)
    expect((await screen.findAllByRole("group", { name: "Du" })).at(-1)).toHaveTextContent("Ja, so senden")
    expect(screen.getAllByRole("group", { name: "Dein Scout" }).at(-1)).toHaveTextContent("Danke, ich mache weiter.")
  })

  it("passes the current question id without showing a completed-round echo for a partial answer", async () => {
    const onAnswerDecision = vi.fn().mockResolvedValue(undefined)
    const roundDecision = {
      ...decision,
      kind: "scout_question" as const,
      question: "Welcher Termin passt?",
      questions: [
        {
          id: "slot",
          constraintKeys: ["schedule"],
          question: "Passt Mittwoch?",
          options: [{ id: "yes", label: "Ja, Mittwoch passt" }],
        },
        {
          id: "drums",
          constraintKeys: ["requirement:0"],
          question: "Reicht ein E-Drumset?",
          options: [{ id: "yes", label: "Ja, E-Drums reichen" }],
        },
      ],
    } satisfies OpenDecision

    render(<MemoryRouter><ScoutChat
      messages={[]}
      onSend={vi.fn()}
      decision={roundDecision}
      onAnswerDecision={onAnswerDecision}
      decisionAnsweredText="Danke, ich mache weiter."
    /></MemoryRouter>)

    fireEvent.click(screen.getByRole("radio", { name: "Ja, Mittwoch passt" }))
    fireEvent.click(screen.getByRole("button", { name: "Nächste Frage" }))

    expect(onAnswerDecision).toHaveBeenCalledWith("decision-1", "yes", undefined, "slot")
    expect(screen.queryByText("Danke, ich mache weiter.")).not.toBeInTheDocument()
    expect(screen.queryByRole("group", { name: "Du" })).not.toBeInTheDocument()
  })
})
