import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"

import { ScoutChat } from "./ScoutChat"

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
})
