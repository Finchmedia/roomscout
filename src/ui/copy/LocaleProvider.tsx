/* eslint-disable react-refresh/only-export-components --
 * COMPONENT_MAP.md §6.4 specifies one provider module. The dictionary registry has to live
 * beside the provider that reads it (a second module would let a surface register into a
 * registry the provider never sees), so this file exports the context, the registry API and
 * the component together and gives up fast refresh for those exports. */

/**
 * Locale provider — COMPONENT_MAP.md §6.4, DECISIONS.md items 18 and 19.
 *
 * Two decisions are load-bearing here:
 *   · The default locale is German, **unconditionally**. There is no `navigator.language`
 *     probe (§6.4: do not ship a ternary whose branches are both `"de"`).
 *   · There is **no runtime fallback between dictionaries** (§6.2 rule 1). A locale can only
 *     become active once its dictionary is registered, so German can never leak into an
 *     English UI unnoticed. `en.ts` registers itself with `registerDictionary("en", en)`.
 */

import * as React from "react";
import { de } from "./de";
import { LOCALES, type Dict, type Locale } from "./types";

export type { Locale };

/** Persisted preference. Wrapped in try/catch everywhere: Safari private mode throws. */
const STORAGE_KEY = "roomscout.locale";

/** DECISIONS.md item 18 — German, unconditionally. */
export const DEFAULT_LOCALE: Locale = "de";

/* ---------------------------------------------------------------------------
 * Registry
 * ------------------------------------------------------------------------- */

const registry: Partial<Record<Locale, Dict>> = { de };

/** Recomputed on every registration so `useSyncExternalStore` gets a stable reference. */
let availableSnapshot: readonly Locale[] = computeAvailable();
const listeners = new Set<() => void>();

function computeAvailable(): readonly Locale[] {
  return LOCALES.filter((locale) => registry[locale] !== undefined);
}

function subscribeToRegistry(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function getAvailableSnapshot(): readonly Locale[] {
  return availableSnapshot;
}

/**
 * Register a dictionary for a locale. `en.ts` calls this at module scope; until it does,
 * `availableLocales` is `["de"]` and `<LanguageToggle>` renders nothing.
 */
export function registerDictionary(locale: Locale, dict: Dict): void {
  registry[locale] = dict;
  availableSnapshot = computeAvailable();
  for (const listener of listeners) listener();
}

/** The dictionary for a locale, or `undefined` when it has not been registered. */
export function getDictionary(locale: Locale): Dict | undefined {
  return registry[locale];
}

/** Locales that currently have a dictionary. Derived from the registry, never hard-coded. */
export function getAvailableLocales(): readonly Locale[] {
  return availableSnapshot;
}

export function isLocale(value: unknown): value is Locale {
  return (LOCALES as readonly string[]).includes(value as string);
}

function readStoredLocale(): Locale | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null && isLocale(stored)) return stored;
  } catch {
    /* storage disabled or unavailable — fall through to the default */
  }
  return undefined;
}

function writeStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage disabled or unavailable — the choice simply does not persist */
  }
}

/* ---------------------------------------------------------------------------
 * Context
 * ------------------------------------------------------------------------- */

export type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: readonly Locale[];
  dict: Dict;
};

export const LocaleCtx = React.createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  availableLocales: getAvailableLocales(),
  dict: de,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const availableLocales = React.useSyncExternalStore(
    subscribeToRegistry,
    getAvailableSnapshot,
    getAvailableSnapshot,
  );

  /** The persisted preference, read once. It may name a locale nobody has registered yet. */
  const [storedPreference] = React.useState<Locale | undefined>(readStoredLocale);
  /** An explicit in-session choice always wins over the persisted preference. */
  const [chosen, setChosen] = React.useState<Locale | undefined>(undefined);

  // Derived, not stored: a preference for a locale whose dictionary is missing stays
  // dormant (German renders) and takes effect by itself the moment it is registered.
  // `availableLocales` is part of this render, so registration re-runs this line.
  const locale: Locale =
    chosen ??
    (storedPreference !== undefined && registry[storedPreference] !== undefined
      ? storedPreference
      : DEFAULT_LOCALE);

  const setLocale = React.useCallback((next: Locale) => {
    // No silent fallback: switching to a locale without a dictionary is a no-op, not a
    // switch that renders German under an English flag (§6.2 rule 1).
    if (registry[next] === undefined) return;
    setChosen(next);
    writeStoredLocale(next);
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Unreachable in practice — `locale` is only ever a registered locale — but it keeps the
  // context value total without an assertion. `de` is the source language (§6.2 rule 1).
  const dict = registry[locale] ?? de;

  const value = React.useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, availableLocales, dict }),
    [locale, setLocale, availableLocales, dict],
  );

  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}
