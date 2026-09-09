/**
 * `useCopy()` — the only way a component reads a visible string.
 * COMPONENT_MAP.md §6.4: "No component hard-codes a visible string — that rule is what
 * makes the toggle complete."
 *
 * `t` takes a dotted path into the dictionary and is fully type-checked: `CopyKey` is
 * generated from `typeof de`, so a typo or a removed key is a compile error, not a blank
 * label. Plural leaves are read with `tp` — `PluralCopyKey` is the four `{ one, other }`
 * paths of COMPONENT_MAP.md §6.3, so `t` cannot accidentally render a plural object and
 * `tp` cannot be pointed at a plain string.
 */

import * as React from "react";
import { get, interpolate, pickPlural } from "./format";
import { LocaleCtx } from "./LocaleProvider";
import type { CopyVars, PluralCopyKey, StringCopyKey } from "./types";

export function useCopy() {
  const { dict, locale, setLocale, availableLocales } = React.useContext(LocaleCtx);

  const t = React.useCallback(
    (key: StringCopyKey, vars?: CopyVars): string => {
      const node = get(dict, key);
      // A missing key returns the key path — loud, and never the German string, so a hole
      // in `en.ts` is visible instead of silently bilingual (§6.2 rule 1). The type union
      // makes this unreachable for dictionaries that satisfy `Dict`.
      if (typeof node !== "string") return key;
      return interpolate(node, vars);
    },
    [dict],
  );

  const tp = React.useCallback(
    (key: PluralCopyKey, count: number, vars?: CopyVars): string => {
      const resolved = pickPlural(get(dict, key), count, locale);
      if (resolved === undefined) return key;
      return interpolate(resolved, { count, ...vars });
    },
    [dict, locale],
  );

  return { t, tp, locale, setLocale, availableLocales, dict };
}

export type UseCopy = ReturnType<typeof useCopy>;
