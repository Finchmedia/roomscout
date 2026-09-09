/**
 * Copy-layer types — the key union and the interpolation-variable union.
 *
 * COMPONENT_MAP.md §6.2: `Dict = typeof de` (German defines the shape, so a missing or
 * extra English key is a compile error in `en.ts`, and no runtime fallback is needed —
 * a silent fallback would ship German into an English UI unnoticed).
 */

import type { de } from "./de";

/** The dictionary shape. DE is the source language and therefore the shape (§6.2 rule 1). */
export type Dict = typeof de;

/** Locales the app knows about. DECISIONS.md item 18: DE is the unconditional default. */
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * A plural leaf. COMPONENT_MAP.md §6.3 names four of them, all shipped as an explicit
 * `{ one, other }` sub-object resolved through `Intl.PluralRules`:
 * `scout.brief.sheet.count` · `settings.knowledge.import.done` ·
 * `settings.billing.usage.searches` · `settings.privacy.portals.sub`.
 * Extra CLDR categories (`zero`/`two`/`few`/`many`) are allowed for languages that need
 * them; `one` and `other` are mandatory because `other` is the fallback.
 */
export type PluralLeaf = { readonly one: string; readonly other: string } & Partial<
  Record<Intl.LDMLPluralRule, string>
>;

/** Structural test used by every path walker below and by `isPluralNode` at runtime. */
type PluralShape = { readonly one: string; readonly other: string };

/**
 * Dotted paths to every leaf of `T`.
 *
 * A plural `{ one, other }` object counts as ONE leaf — the path stops at the object,
 * not at `.one` / `.other` — so `tp("settings.billing.usage.searches", n)` is the only
 * way those strings are ever read.
 */
export type DeepLeafPaths<T> = T extends string
  ? never
  : T extends PluralShape
    ? never
    : {
        [K in Extract<keyof T, string>]: T[K] extends string
          ? K
          : T[K] extends PluralShape
            ? K
            : `${K}.${DeepLeafPaths<T[K]>}`;
      }[Extract<keyof T, string>];

/** Leaf paths whose value is a plain string — the keys `t()` accepts. */
export type StringLeafPaths<T> = T extends string
  ? never
  : T extends PluralShape
    ? never
    : {
        [K in Extract<keyof T, string>]: T[K] extends string
          ? K
          : T[K] extends PluralShape
            ? never
            : `${K}.${StringLeafPaths<T[K]>}`;
      }[Extract<keyof T, string>];

/** Leaf paths whose value is a plural object — the keys `tp()` accepts. */
export type PluralLeafPaths<T> = T extends string
  ? never
  : T extends PluralShape
    ? never
    : {
        [K in Extract<keyof T, string>]: T[K] extends string
          ? never
          : T[K] extends PluralShape
            ? K
            : `${K}.${PluralLeafPaths<T[K]>}`;
      }[Extract<keyof T, string>];

/** Every leaf of the dictionary — `"scout.welcome.headline" | …` (COMPONENT_MAP.md §6.2). */
export type CopyKey = DeepLeafPaths<Dict>;
/** The subset `t()` accepts: plain-string leaves. */
export type StringCopyKey = StringLeafPaths<Dict>;
/** The subset `tp()` accepts: `{ one, other }` leaves. */
export type PluralCopyKey = PluralLeafPaths<Dict>;

/**
 * Interpolation variables — the complete set of `{name}` tokens present in `de`,
 * verified against the dictionary by `copy.test.ts` rather than trusted from prose.
 *
 * 18 come from the source dictionaries (COMPONENT_MAP.md §6.3): the two easily missed
 * ones are `{ort}` (`scout.data.summary.pattern`, SCOUT §18.19) and `{prefix}`
 * (`operator.host.now.format`, OPERATOR §17.12). `{time}` is the 19th and is introduced
 * by the port — `operator.sources.check.renewed` = „Heute, {time}“ formatted with
 * `formatTime()` (§6.3, DECISIONS.md item 44).
 */
export const COPY_VAR_NAMES = [
  "budget",
  "city",
  "count",
  "h",
  "label",
  "mm",
  "n",
  "name",
  "origin",
  "ort",
  "prefix",
  "price",
  "profile",
  "roomName",
  "short",
  "text",
  "time",
  "timeLower",
  "usage",
] as const;

/** One interpolation-variable name. */
export type CopyVarName = (typeof COPY_VAR_NAMES)[number];

/** The `vars` bag accepted by `interpolate` / `t` / `tp`. */
export type CopyVars = Partial<Record<CopyVarName, string | number>>;
