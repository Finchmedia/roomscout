/**
 * The RoomScout landing page — entry point of the `landing` surface.
 *
 * Port of `design-system/ui_kits/landing/Landing.jsx` (spec:
 * `docs/UI_PORT/LANDING_SCREENS.md`), composed from the design-system atoms and
 * the shared `StageBackground`. Everything visible reads through `useCopy()`;
 * the scripted search it tells is demo data (`demoData.ts`), never product
 * state — this surface imports nothing from Convex.
 *
 * Order: header · hero · „So funktioniert's" (four beats) · feature bento ·
 * Kontrolle & FAQ · closing CTA · footer.
 *
 * `html { scroll-behavior: smooth }` is the source's global rule (§1.2). It is
 * set on the document while this page is mounted rather than in the global
 * stylesheet, so the in-product surfaces keep their own scrolling; the
 * `prefers-reduced-motion` block in `tokens.css` already neutralises it, and
 * the hook skips it as well.
 */

import * as React from "react"

import { StageBackground } from "@/ui/chrome/StageBackground"

import { Bento } from "./Bento"
import { ClosingCta } from "./ClosingCta"
import { Faq } from "./Faq"
import { Footer } from "./Footer"
import { Hero } from "./Hero"
import { HowItWorks } from "./HowItWorks"
import { LandingHeader } from "./LandingHeader"
import { useReducedMotion } from "./useLandingScroll"

export function LandingPage() {
  const reducedMotion = useReducedMotion()

  React.useEffect(() => {
    if (reducedMotion) return
    const root = document.documentElement
    const previous = root.style.scrollBehavior
    root.style.scrollBehavior = "smooth"
    return () => {
      root.style.scrollBehavior = previous
    }
  }, [reducedMotion])

  return (
    <div className="relative min-h-screen bg-rs-surface-page font-sans text-rs-ink">
      <StageBackground position="fixed" className="z-0" />

      <LandingHeader />

      <main className="relative z-2">
        <Hero />
        <HowItWorks />
        <Bento />
        <Faq />
        <ClosingCta />
        <Footer />
      </main>
    </div>
  )
}
