/**
 * Copy-layer contract tests — COMPONENT_MAP.md Part 6, DECISIONS.md items 10–20 and 44.
 *
 * These assert the properties the port depends on and that prose cannot guarantee:
 * the dictionary is complete and non-empty, its placeholder vocabulary is exactly the
 * declared one, the two excluded blocks really are absent, and `useCopy` resolves a key
 * through the provider.
 *
 * Written without JSX (the file is `.ts`, per the build plan) — `React.createElement`.
 */

import { renderHook } from "@testing-library/react";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { de } from "./de";
import {
  formatCurrencyEUR,
  formatTime,
  interpolate,
  isPluralNode,
  plural,
} from "./format";
import { LocaleProvider, registerDictionary } from "./LocaleProvider";
import { COPY_VAR_NAMES, type Dict } from "./types";
import { useCopy } from "./useCopy";

/* ---------------------------------------------------------------------------
 * Walkers — the runtime mirror of `DeepLeafPaths`: a plural `{ one, other }`
 * object is ONE leaf, and the path stops at the object.
 * ------------------------------------------------------------------------- */

type Leaf = { path: string; strings: string[]; plural: boolean };

function collectLeaves(node: unknown, path = "", out: Leaf[] = []): Leaf[] {
  if (typeof node === "string") {
    out.push({ path, strings: [node], plural: false });
    return out;
  }
  if (isPluralNode(node)) {
    const forms = Object.values(node).filter(
      (form): form is string => typeof form === "string",
    );
    out.push({ path, strings: forms, plural: true });
    return out;
  }
  if (typeof node === "object" && node !== null) {
    for (const [key, child] of Object.entries(node)) {
      collectLeaves(child, path === "" ? key : `${path}.${key}`, out);
    }
    return out;
  }
  throw new Error(`Dictionary leaf at "${path}" is neither a string nor a plural object`);
}

const leaves = collectLeaves(de);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(LocaleProvider, null, children);

/* ------------------------------------------------------------------------- */

describe("interpolate", () => {
  it("substitutes every {name} token", () => {
    expect(interpolate("Hey {name}.", { name: "Jonas" })).toBe("Hey Jonas.");
  });

  it("accepts numbers and repeated tokens", () => {
    expect(interpolate("{prefix}, {h}:{mm}", { prefix: "Heute", h: 9, mm: "41" })).toBe(
      "Heute, 9:41",
    );
    expect(interpolate("{n}/{n}", { n: 2 })).toBe("2/2");
  });

  it("leaves an unsupplied token visible instead of rendering undefined", () => {
    expect(interpolate("Hey {name}.", {})).toBe("Hey {name}.");
    expect(interpolate("Hey {name}.")).toBe("Hey {name}.");
  });
});

describe("plural", () => {
  const forms = { one: "1 Wunsch gemerkt", other: "{count} Wünsche gemerkt" };

  it("selects the German CLDR category", () => {
    expect(plural("de", 1, forms)).toBe(forms.one);
    expect(plural("de", 0, forms)).toBe(forms.other);
    expect(plural("de", 2, forms)).toBe(forms.other);
  });

  it("selects the English CLDR category", () => {
    const en = { one: "1 wish saved", other: "{count} wishes saved" };
    expect(plural("en", 1, en)).toBe(en.one);
    expect(plural("en", 0, en)).toBe(en.other);
  });

  it("falls back to `other` for a category the dictionary does not carry", () => {
    // Russian has `few` at 2; the DE/EN bag only has one/other.
    expect(plural("ru", 2, forms)).toBe(forms.other);
  });
});

describe("formatTime / formatCurrencyEUR", () => {
  const at0941 = new Date(2026, 8, 9, 9, 41);
  const at1705 = new Date(2026, 8, 9, 17, 5);

  it("uses 24-hour time in both languages (DECISIONS.md item 44)", () => {
    expect(formatTime("de", at0941)).toBe("9:41");
    expect(formatTime("de", at1705)).toBe("17:05");
    expect(formatTime("en", at1705)).toBe("17:05");
    // en-US zero-pads a numeric hour under `hour12: false`; the point of the decision is
    // that no locale ever renders "AM"/"PM".
    expect(formatTime("en", at0941)).toMatch(/^0?9:41$/);
    for (const locale of ["de", "en"] as const) {
      expect(formatTime(locale, at1705)).not.toMatch(/[AaPp]\.?[Mm]/);
    }
  });

  it("feeds the {time} placeholder of operator.sources.check.renewed", () => {
    expect(interpolate(de.operator.sources.check.renewed, { time: formatTime("de", at0941) })).toBe(
      "Heute, 9:41",
    );
  });

  it("formats EUR per locale", () => {
    expect(formatCurrencyEUR("de", 280)).toContain("€");
    expect(formatCurrencyEUR("de", 280)).toContain("280,00");
    expect(formatCurrencyEUR("en", 280)).toContain("280.00");
  });
});

describe("the German dictionary", () => {
  it("ships the full extracted copy (>= 860 leaves)", () => {
    expect(leaves.length).toBeGreaterThanOrEqual(860);
  });

  it("has no empty string anywhere", () => {
    const empty = leaves.filter((leaf) => leaf.strings.some((s) => s.trim() === ""));
    expect(empty.map((leaf) => leaf.path)).toEqual([]);
  });

  it("has no duplicate leaf path", () => {
    expect(new Set(leaves.map((leaf) => leaf.path)).size).toBe(leaves.length);
  });

  it("uses only placeholders declared in CopyVars", () => {
    const declared = new Set<string>(COPY_VAR_NAMES);
    const undeclared: string[] = [];
    for (const leaf of leaves) {
      for (const value of leaf.strings) {
        for (const match of value.matchAll(/\{(\w+)\}/g)) {
          const name = match[1];
          if (name !== undefined && !declared.has(name)) {
            undeclared.push(`${leaf.path} → {${name}}`);
          }
        }
      }
    }
    expect(undeclared).toEqual([]);
  });

  it("declares no placeholder the dictionary never uses", () => {
    const used = new Set<string>();
    for (const leaf of leaves) {
      for (const value of leaf.strings) {
        for (const match of value.matchAll(/\{(\w+)\}/g)) {
          if (match[1] !== undefined) used.add(match[1]);
        }
      }
    }
    expect([...COPY_VAR_NAMES].filter((name) => !used.has(name))).toEqual([]);
  });

  it("carries every plural leaf as one leaf each (COMPONENT_MAP.md §6.3)", () => {
    expect(leaves.filter((leaf) => leaf.plural).map((leaf) => leaf.path).sort()).toEqual([
      // The port's own fifth plural leaf: „{count} Unterhaltungen“ in the
      // Nachrichten nav header. §6.3 predates the surface; the rule it states
      // (a plural is one leaf, read only through `tp`) is what is under test.
      "liveInbox.count",
      "scout.brief.sheet.count",
      "settings.billing.usage.searches",
      "settings.knowledge.import.done",
      "settings.privacy.portals.sub",
    ]);
  });

  it("excludes the prototype dev bar and the superseded landing v1 copy", () => {
    // COMPONENT_MAP.md §6.1 rule 2 / DECISIONS.md item 20. The excluded blocks are exactly
    // SCOUT §18.18 `scout.demo.*` and LANDING §17.12 `landing.v1.*` — NOT every path that
    // contains the substring "demo": `settings.sources.demo.*`, `settings.knowledge.demo.*`
    // and `landing.header.cta.demo` are shipped product copy (the demo data of §6.2 rule 6).
    const excluded = leaves.filter(
      (leaf) => leaf.path.startsWith("scout.demo.") || leaf.path.startsWith("landing.v1."),
    );
    expect(excluded.map((leaf) => leaf.path)).toEqual([]);
    expect("demo" in de.scout).toBe(false);
    expect("v1" in de.landing).toBe(false);
  });

  it("applied the two §6.1 self-prefix strips", () => {
    expect("settings" in de.settings).toBe(false); // not settings.settings.nav.back
    expect("operator" in de.operator).toBe(false); // not operator.operator.nav.back
    expect(de.settings.nav.back).toBeTypeOf("string");
    expect(de.operator.nav.back).toBeTypeOf("string");
    // §17.12's quoted cross-surface blocks are a different surface and correctly stay.
    expect(de.operator.settings).toBeTypeOf("object");
    expect(de.operator.scout).toBeTypeOf("object");
  });

  it("hoisted SETTINGS §17.12's common.* to the root", () => {
    expect("common" in de.settings).toBe(false);
    expect(de.common.saved).toBe("Gespeichert");
    expect(de.common.copyFailedToast).toBe(
      "Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst.",
    );
  });
});

describe("useCopy", () => {
  it("resolves a known key through the provider", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.locale).toBe("de");
    expect(result.current.t("scout.welcome.headline")).toBe("Finden wir euren Proberaum.");
    expect(result.current.t("common.saved")).toBe("Gespeichert");
  });

  it("interpolates variables", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.t("scout.welcome.greeting", { name: "Jonas" })).toBe("Hey Jonas.");
  });

  it("resolves plural leaves with tp and supplies {count} implicitly", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.tp("scout.brief.sheet.count", 1)).toBe("1 Wunsch gemerkt");
    expect(result.current.tp("scout.brief.sheet.count", 3)).toBe("3 Wünsche gemerkt");
    expect(result.current.tp("settings.knowledge.import.done", 4, { n: 4 })).toBe(
      "4 Angaben übernommen.",
    );
  });

  it("defaults to German unconditionally (DECISIONS.md item 18)", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.locale).toBe("de");
    expect(document.documentElement.lang).toBe("de");
  });
});

// Placed last on purpose: `registerDictionary` mutates the module-level registry, and the
// point of the assertions above is that only German is registered until `en.ts` exists.
describe("the dictionary registry", () => {
  it("exposes only the registered locales, and grows when one is registered", () => {
    const before = renderHook(() => useCopy(), { wrapper });
    expect([...before.result.current.availableLocales]).toEqual(["de"]);

    // Switching to a locale with no dictionary is a no-op — never a silent German render
    // under an English flag (COMPONENT_MAP.md §6.2 rule 1).
    before.result.current.setLocale("en");
    expect(before.result.current.locale).toBe("de");

    // A stand-in for `en.ts`; only the registry mechanics are under test here.
    registerDictionary("en", de as Dict);
    const after = renderHook(() => useCopy(), { wrapper });
    expect([...after.result.current.availableLocales]).toEqual(["de", "en"]);
  });
});
