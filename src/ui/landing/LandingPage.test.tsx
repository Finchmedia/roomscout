/**
 * Smoke test for the landing surface: the page renders, its beats are in the
 * document and every string resolves through the DE dictionary (a missing key
 * would render its own path, which the assertions below would not match).
 *
 * jsdom has no `IntersectionObserver`, so every scroll reveal falls back to
 * „shown from the first render" — which is exactly the no-observer contract in
 * `useLandingScroll.ts`.
 */

import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"

import { LocaleProvider } from "@/ui/copy"

import { LandingPage } from "./LandingPage"

it("renders every beat of the landing page", () => {
  render(
    <LocaleProvider>
      <LandingPage />
    </LocaleProvider>
  )

  // Hero, Beat 3, closing CTA.
  expect(screen.getByText("Ihr macht Musik.")).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "Ich kümmere mich darum." })).toBeInTheDocument()
  expect(screen.getByText("Bereit für euren nächsten Proberaum?")).toBeInTheDocument()

  // Beat 1's accumulator: the corrected budget replaces the row instead of
  // appending a second one — 400 € survives only as the spoken chip.
  expect(screen.getAllByText("Bis 350 € / Monat").length).toBeGreaterThan(1)
  expect(screen.getAllByText("Bis 400 € / Monat")).toHaveLength(1)

  // FAQ item 0 is open on load.
  expect(
    screen.getByRole("button", { name: "Was darf der Scout selbstständig tun?" })
  ).toHaveAttribute("aria-expanded", "true")
})
