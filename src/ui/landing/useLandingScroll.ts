/**
 * The landing page's small scroll toolkit.
 *
 * `docs/UI_PORT/LANDING_SCREENS.md` §2 specifies a rAF-throttled `measure()`
 * engine that computes a 0–1 progress value per section and drives every reveal
 * from it. This port keeps the *story* (which beat shows what, in which order)
 * and replaces the engine with `IntersectionObserver`: reveals latch when an
 * element crosses the viewport, and the sticky beats step through their states
 * on invisible sentinels that cross the viewport middle. Cheap, no listeners on
 * `scroll`, and it degrades to „everything visible" where the observer is
 * missing (jsdom, very old browsers).
 *
 * DECISIONS.md item 48 puts a subscribing `useReducedMotion` under
 * `src/ui/motion/`; that directory does not exist yet, so the hook lives here
 * and moves when it does — see the surface's open questions.
 * DECISIONS.md item 9 keeps the landing breakpoint separate from the app's
 * 959 px one; `--bp-landing-narrow` is not in `tokens.css` yet, so the 880 px
 * literal is declared once, here, and every CSS-only variant spells it
 * `min-[880px]:`.
 */

import * as React from "react"

/** LANDING_SCREENS §13 / DECISIONS item 9: `window.innerWidth < 880`. */
export const LANDING_NARROW_BREAKPOINT = 880

function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {}
      }
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onStoreChange)
      return () => mql.removeEventListener("change", onStoreChange)
    },
    [query]
  )

  const getSnapshot = React.useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false
    }
    return window.matchMedia(query).matches
  }, [query])

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/**
 * `true` below the landing breakpoint. Only for markup that genuinely differs
 * (the header's nav → `Sheet` swap, DECISIONS item 8); pure geometry uses the
 * `min-[880px]:` variant instead, so it never flashes the wrong layout.
 */
export function useNarrow(): boolean {
  return useMediaQuery(`(max-width: ${LANDING_NARROW_BREAKPOINT - 1}px)`)
}

/** Subscribing `prefers-reduced-motion` probe (DECISIONS item 48). */
export function useReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

/**
 * `true` once the document is scrolled past `threshold` px — LANDING_SCREENS §3
 * (`scrollY > 40` shrinks the header). rAF-throttled, `{passive:true}`, and it
 * measures once synchronously on mount so a reload deep in the page never
 * paints the tall header first (§2.2, „load-bearing").
 */
export function useScrolled(threshold = 40): boolean {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      setScrolled(window.scrollY > threshold)
    }
    const onScroll = () => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [threshold])

  return scrolled
}

interface InViewOptions {
  /** Shrinks the viewport so a reveal fires before the element is centred. */
  rootMargin?: string
  threshold?: number
  /** Latch (default). `false` re-hides the element when it leaves. */
  once?: boolean
}

/**
 * One latching reveal. Attach `ref` to the element (or to a sentinel placed
 * where the reveal should trip) and gate opacity/transform on `inView`.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>({
  rootMargin = "0px 0px -20% 0px",
  threshold = 0,
  once = true,
}: InViewOptions = {}): { ref: React.RefObject<T | null>; inView: boolean } {
  const ref = React.useRef<T | null>(null)
  // Without an observer (jsdom, ancient browsers) the content is simply there
  // from the first render — decided in the initialiser so the effect never has
  // to `setState` synchronously.
  const [inView, setInView] = React.useState(
    () => typeof IntersectionObserver === "undefined"
  )

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            if (once) observer.disconnect()
          } else if (!once) {
            setInView(false)
          }
        }
      },
      { rootMargin, threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [once, rootMargin, threshold])

  return { ref, inView }
}

/** The observer band used for „has this step reached the viewport middle?". */
const MIDDLE_BAND = "-50% 0px -49% 0px"

/**
 * A scrolled sequence of `count` steps. Render one sentinel per step (a
 * zero-content block that spans the scroll distance that step should own) with
 * `stepProps(i)` spread on it; `index` is the step whose sentinel currently
 * crosses the viewport middle. Mirrors LANDING_SCREENS §7's
 * `stIdx = min(2, floor(p * 3))` without measuring anything by hand.
 */
export function useScrollSteps(count: number): {
  index: number
  stepProps: (step: number) => {
    "data-landing-step": number
    ref: (node: HTMLElement | null) => void
  }
} {
  const [index, setIndex] = React.useState(0)
  const nodes = React.useRef<Map<number, HTMLElement>>(new Map())

  const stepProps = React.useCallback(
    (step: number) => ({
      "data-landing-step": step,
      ref: (node: HTMLElement | null) => {
        if (node) nodes.current.set(step, node)
        else nodes.current.delete(step)
      },
    }),
    []
  )

  React.useEffect(() => {
    const elements = [...nodes.current.values()]
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const raw = (entry.target as HTMLElement).dataset.landingStep
          const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10)
          if (!Number.isNaN(parsed)) setIndex(parsed)
        }
      },
      { rootMargin: MIDDLE_BAND, threshold: 0 }
    )
    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [count])

  return { index, stepProps }
}

/**
 * A latching reveal *sequence*: `revealed` is how many of the `count` items
 * have crossed the reveal line, and never goes down. Spread `itemProps(i)` on
 * each item. This is the port of §6.3's per-line `shown` / `capOn` / `moved`
 * gates — one gate per line instead of three fractional ones.
 */
export function useRevealSequence(
  count: number,
  rootMargin = "0px 0px -30% 0px"
): {
  revealed: number
  itemProps: (item: number) => {
    "data-landing-step": number
    ref: (node: HTMLElement | null) => void
  }
} {
  // No observer → every item is revealed from the first render (see `useInView`).
  const [revealed, setRevealed] = React.useState(() =>
    typeof IntersectionObserver === "undefined" ? count : 0
  )
  const nodes = React.useRef<Map<number, HTMLElement>>(new Map())

  const itemProps = React.useCallback(
    (item: number) => ({
      "data-landing-step": item,
      ref: (node: HTMLElement | null) => {
        if (node) nodes.current.set(item, node)
        else nodes.current.delete(item)
      },
    }),
    []
  )

  React.useEffect(() => {
    const elements = [...nodes.current.values()]
    if (elements.length === 0 || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const raw = (entry.target as HTMLElement).dataset.landingStep
          const parsed = raw === undefined ? Number.NaN : Number.parseInt(raw, 10)
          if (Number.isNaN(parsed)) continue
          setRevealed((current) => Math.max(current, parsed + 1))
        }
      },
      { rootMargin, threshold: 0 }
    )
    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [count, rootMargin])

  return { revealed, itemProps }
}
