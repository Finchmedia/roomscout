/**
 * `useNarrow()` — the app's narrow breakpoint, ≤ 959 px (DECISIONS.md item 5,
 * `--bp-app-narrow`). The prototype's 390×844 phone frame is deliberately not
 * ported; every „mobile“ branch of the kit hangs off this flag instead.
 *
 * `use-mobile.ts` reads the design-system's 768 px step, which is a different
 * question — hence a second hook rather than a changed constant.
 */

import * as React from "react";

/** DECISIONS.md item 9 — `--bp-app-narrow: 959px`, the app's own breakpoint. */
const APP_NARROW_MAX = 959;
const QUERY = `(max-width: ${APP_NARROW_MAX}px)`;

function getMediaQueryList(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(QUERY);
}

function subscribe(onStoreChange: () => void): () => void {
  const mql = getMediaQueryList();
  if (!mql) return () => {};
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return getMediaQueryList()?.matches ?? false;
}

function getServerSnapshot(): boolean {
  return false;
}

export function useNarrow(): boolean {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
