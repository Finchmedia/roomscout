/**
 * Smoke test for the landing surface: the page renders, its beats are in the
 * document and every string resolves through the default EN dictionary (a missing key
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
  expect(screen.getByText("You make the music.")).toBeInTheDocument()
  expect(screen.getByRole("heading", { name: "I’m on it." })).toBeInTheDocument()
  expect(screen.getByText("Ready to find your next rehearsal room?")).toBeInTheDocument()

  // Beat 1's accumulator: the corrected budget replaces the row instead of
  // appending a second one — €400 survives only as the spoken chip.
  expect(screen.getAllByText("Up to €350 / month").length).toBeGreaterThan(1)
  expect(screen.getAllByText("Up to €400 / month")).toHaveLength(1)

  // FAQ item 0 is open on load.
  expect(
    screen.getByRole("button", { name: "What can the Scout do independently?" })
  ).toHaveAttribute("aria-expanded", "true")
})
