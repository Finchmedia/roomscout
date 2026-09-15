import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"

import { ChatTurn } from "./ChatTurn"

const turn = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="chat-turn"]')!

const bubble = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-slot="bubble"]')!

describe("ChatTurn", () => {
  afterEach(cleanup)

  it("puts the musician on the right in the tinted bubble", () => {
    const { container } = render(<ChatTurn who="user">Mittwoch passt</ChatTurn>)

    expect(turn(container)).toHaveAttribute("data-align", "end")
    expect(turn(container)).toHaveAttribute("data-who", "user")
    expect(bubble(container)).toHaveAttribute("data-align", "end")
    expect(bubble(container)).toHaveAttribute("data-variant", "tinted")
    expect(screen.getByText("Mittwoch passt")).toBeInTheDocument()
  })

  it("starts the row for the Scout", () => {
    const { container } = render(<ChatTurn who="scout">Ich prüfe das.</ChatTurn>)

    expect(turn(container)).toHaveAttribute("data-align", "start")
    expect(bubble(container)).toHaveAttribute("data-align", "start")
  })

  it("starts the row for the Anbieter too", () => {
    const { container } = render(
      <ChatTurn who="provider">Der Raum ist ab Oktober frei.</ChatTurn>
    )

    expect(turn(container)).toHaveAttribute("data-align", "start")
    expect(turn(container)).toHaveAttribute("data-who", "provider")
    expect(bubble(container)).toHaveAttribute("data-align", "start")
  })

  it("renders a given label as the speaker line and names the turn", () => {
    const { container } = render(
      <ChatTurn who="scout" label="Dein Scout" compact>
        Welche Tage passen euch?
      </ChatTurn>
    )

    expect(
      container.querySelector('[data-slot="message-header"]')
    ).toHaveTextContent("Dein Scout")
    expect(screen.getByRole("group", { name: "Dein Scout" })).toHaveTextContent(
      "Welche Tage passen euch?"
    )
    expect(turn(container)).toHaveAttribute("data-compact", "true")
  })

  it("stays unlabelled and unnamed without a label", () => {
    const { container } = render(<ChatTurn who="user">Ja, gern.</ChatTurn>)

    expect(container.querySelector('[data-slot="message-header"]')).toBeNull()
    expect(screen.queryByRole("group")).toBeNull()
    expect(turn(container)).not.toHaveAttribute("data-compact")
  })
})
