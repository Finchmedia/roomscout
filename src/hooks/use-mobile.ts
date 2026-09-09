import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null
  }
  return window.matchMedia(MOBILE_QUERY)
}

function subscribe(onStoreChange: () => void) {
  const mql = getMediaQueryList()
  if (!mql) return () => {}
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return getMediaQueryList()?.matches ?? false
}

function getServerSnapshot() {
  return false
}

/**
 * Tracks the viewport against the design-system mobile breakpoint.
 *
 * Reads the media query synchronously through `useSyncExternalStore` so the
 * first render already has the correct value — no effect, no `setState` inside
 * an effect, and no transient `undefined`/desktop frame before hydration.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
