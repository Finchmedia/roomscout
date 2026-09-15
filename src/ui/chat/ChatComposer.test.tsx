import { useState } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChatComposer } from "./ChatComposer"

const labels = {
  composer: "Message Scout", send: "Send", sendError: "Could not send",
  sending: "Sending", status: "Ready", restoreDraft: "Restore draft", voice: "Talk",
}

describe("ChatComposer voice draft recovery", () => {
  afterEach(cleanup)

  it("preserves both existing typing and unadmitted voice-session text until the musician edits", () => {
    const consumed = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue(true)
    const view = render(<ChatComposer labels={labels} onSubmit={onSubmit} onDraftRestored={consumed} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep Wednesday." } })
    view.rerender(<ChatComposer labels={labels} onSubmit={onSubmit} restoredDraft="Budget is 280." onDraftRestored={consumed} />)
    expect(screen.getByRole("textbox")).toHaveValue("Keep Wednesday.\nBudget is 280.")
    expect(consumed).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep Wednesday.\nBudget is 280, all in." } })
    expect(consumed).toHaveBeenCalledOnce()
    view.rerender(<ChatComposer labels={labels} onSubmit={onSubmit} onDraftRestored={consumed} />)
    expect(screen.getByRole("textbox")).toHaveValue("Keep Wednesday.\nBudget is 280, all in.")
  })

  it("retains a recovered voice draft when its explicit text retry fails", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false)
    function RecoveryHost() {
      const [pending, setPending] = useState("Please keep the search paused.")
      return <ChatComposer labels={labels} onSubmit={onSubmit} restoredDraft={pending} onDraftRestored={() => setPending("")} />
    }
    render(<RecoveryHost />)
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send" })))
    expect(onSubmit).toHaveBeenCalledExactlyOnceWith("Please keep the search paused.")
    expect(screen.getByRole("textbox")).toHaveValue("Please keep the search paused.")
    expect(screen.getByRole("alert")).toHaveTextContent("Could not send")
  })

  it("reports typing as real user activity", () => {
    const onActivity = vi.fn()
    render(<ChatComposer labels={labels} onSubmit={vi.fn().mockResolvedValue(true)} onActivity={onActivity} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Still here" } })
    expect(onActivity).toHaveBeenCalled()
  })
})
