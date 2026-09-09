/**
 * Copy formatting helpers — interpolation, plurals, dates, currency.
 * COMPONENT_MAP.md §6.3 / §6.4; DECISIONS.md item 44 (24-hour time in both languages).
 *
 * Nothing here reads the dictionary directly; `useCopy()` supplies the resolved node.
 */

import type { CopyVars, CopyVarName, Locale, PluralLeaf } from "./types";

/**
 * Replace `{name}` tokens. COMPONENT_MAP.md §6.3, verbatim behaviour: an unknown or
 * unsupplied name is left as `{name}` so a missing variable is visible in the UI rather
 * than rendered as `undefined`.
 */
export function interpolate(s: string, vars?: CopyVars): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (token, name: string) => {
    const value = vars[name as CopyVarName];
    return value === undefined ? token : String(value);
  });
}

/** Walk a nested dictionary by dotted path (COMPONENT_MAP.md §6.4 `get`). */
export function get(dict: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node == null ? node : (node as Record<string, unknown>)[part],
      dict,
    );
}

/** A node is a plural leaf when it carries both mandatory CLDR forms as strings. */
export function isPluralNode(node: unknown): node is PluralLeaf {
  if (typeof node !== "object" || node === null) return false;
  const candidate = node as Partial<Record<string, unknown>>;
  return typeof candidate.one === "string" && typeof candidate.other === "string";
}

/**
 * Pick the CLDR form for `n` via `Intl.PluralRules`, falling back to `other` for any
 * category this dictionary does not carry (German and English only need one/other, but
 * the type allows zero/two/few/many for later locales).
 */
export function plural(locale: Locale | string, n: number, forms: PluralLeaf): string {
  const category = new Intl.PluralRules(locale).select(n);
  return forms[category] ?? forms.other;
}

/**
 * COMPONENT_MAP.md §6.4 `pickPlural`: a string node is returned as-is, a plural node is
 * resolved for `count`. Anything else (a missing key) returns `undefined` so the caller
 * can decide how loudly to fail — there is deliberately no German fallback (§6.2 rule 1).
 */
export function pickPlural(
  node: unknown,
  count: number,
  locale: Locale | string,
): string | undefined {
  if (typeof node === "string") return node;
  if (isPluralNode(node)) return plural(locale, count, node);
  return undefined;
}

/**
 * 24-hour time in both languages — DECISIONS.md item 44, `hour12: false`.
 * Feeds `{time}` in `operator.sources.check.renewed` („Heute, {time}“ / "Today, {time}").
 */
export function formatTime(locale: Locale | string, date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * COMPONENT_MAP.md §6.3: prototype prices are literal strings and stay literal. This is
 * for the moment they become dynamic — the „/ Monat“ suffix stays its own key.
 */
export function formatCurrencyEUR(locale: Locale | string, n: number): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
