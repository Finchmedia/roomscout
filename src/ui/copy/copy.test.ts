/**
 * Copy-layer contract tests.
 *
 * These assert the runtime properties both dictionaries must preserve: non-empty
 * values, matching leaf and plural shapes, matching interpolation variables, and
 * locale resolution and persistence through the provider.
 *
 * Written without JSX (the file is `.ts`, per the build plan) — `React.createElement`.
 */

import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { de } from "./de";
import { en } from "./en";
import {
  formatCurrencyEUR,
  formatTime,
  interpolate,
  isPluralNode,
  plural,
} from "./format";
import { LocaleProvider } from "./LocaleProvider";
import { LanguageToggle } from "./LanguageToggle";
import { COPY_VAR_NAMES } from "./types";
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

const deLeaves = collectLeaves(de);
const enLeaves = collectLeaves(en);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(LocaleProvider, null, children);

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
});

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
  it("has no empty string anywhere", () => {
    const empty = deLeaves.filter((leaf) => leaf.strings.some((s) => s.trim() === ""));
    expect(empty.map((leaf) => leaf.path)).toEqual([]);
  });

  it("has no duplicate leaf path", () => {
    expect(new Set(deLeaves.map((leaf) => leaf.path)).size).toBe(deLeaves.length);
  });

  it("uses only placeholders declared in CopyVars", () => {
    const declared = new Set<string>(COPY_VAR_NAMES);
    const undeclared: string[] = [];
    for (const leaf of deLeaves) {
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
    for (const leaf of deLeaves) {
      for (const value of leaf.strings) {
        for (const match of value.matchAll(/\{(\w+)\}/g)) {
          if (match[1] !== undefined) used.add(match[1]);
        }
      }
    }
    expect([...COPY_VAR_NAMES].filter((name) => !used.has(name))).toEqual([]);
  });

});

describe("the English dictionary", () => {
  it("has exactly the same leaves and plural shapes as German", () => {
    expect(enLeaves.map((leaf) => `${leaf.path}:${leaf.plural}`).sort()).toEqual(
      deLeaves.map((leaf) => `${leaf.path}:${leaf.plural}`).sort(),
    );
  });

  it("keeps the interpolation variables of every translated leaf", () => {
    const tokens = (leaf: Leaf) =>
      [...new Set(leaf.strings.flatMap((value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1])))]
        .sort();
    const englishByPath = new Map(enLeaves.map((leaf) => [leaf.path, leaf]));
    const mismatches = deLeaves.flatMap((leaf) => {
      const english = englishByPath.get(leaf.path);
      return english && JSON.stringify(tokens(leaf)) === JSON.stringify(tokens(english))
        ? []
        : [`${leaf.path}: ${tokens(leaf).join(",")} -> ${english ? tokens(english).join(",") : "missing"}`];
    });
    expect(mismatches).toEqual([]);
  });

  it("contains no empty or visibly German product copy", () => {
    const empty = enLeaves.filter((leaf) => leaf.strings.some((value) => value.trim() === ""));
    expect(empty.map((leaf) => leaf.path)).toEqual([]);

    const germanWords = /\b(?:anmeldung|anbieter|auftrag|auswählen|dein|deine|details klären|euer|eure|für|gespeichert|handlungs|keine|nicht|noch|quelle|quellen|suchauftrag|übernehmen|verwerfen|wird|zur|zum)\b/i;
    const leaked = enLeaves.flatMap((leaf) =>
      leaf.strings.filter((value) => germanWords.test(value)).map((value) => `${leaf.path}: ${value}`),
    );
    expect(leaked).toEqual([]);
  });
});

describe("useCopy", () => {
  it("resolves a known key through the provider", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.locale).toBe("en");
    expect(result.current.t("scout.welcome.headline")).toBe("Let’s find your rehearsal room.");
    expect(result.current.t("common.saved")).toBe("Saved");
  });

  it("interpolates variables", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.t("scout.welcome.greeting", { name: "Jonas" })).toBe("Hey Jonas.");
  });

  it("resolves plural leaves with tp and supplies {count} implicitly", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.tp("scout.brief.sheet.count", 1)).toBe("1 search fact");
    expect(result.current.tp("scout.brief.sheet.count", 3)).toBe("3 search facts");
    expect(result.current.tp("settings.knowledge.import.done", 4, { n: 4 })).toBe(
      "Imported 4 details.",
    );
  });

  it("defaults to English", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.locale).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("restores an explicit German preference", () => {
    localStorage.setItem("roomscout.locale", "de");
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect(result.current.locale).toBe("de");
    expect(result.current.t("common.saved")).toBe("Gespeichert");
    expect(document.documentElement.lang).toBe("de");
  });

  it("registers both languages and persists an explicit switch", () => {
    const { result } = renderHook(() => useCopy(), { wrapper });
    expect([...result.current.availableLocales]).toEqual(["de", "en"]);
    React.act(() => result.current.setLocale("de"));
    expect(result.current.locale).toBe("de");
    expect(localStorage.getItem("roomscout.locale")).toBe("de");
  });
});

describe("LanguageToggle", () => {
  it("offers both registered languages and switches to German explicitly", () => {
    render(React.createElement(LocaleProvider, null, React.createElement(LanguageToggle)));
    const group = screen.getByRole("group", { name: "Language" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "DE" }));

    expect(screen.getByRole("group", { name: "Sprache" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DE" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("roomscout.locale")).toBe("de");
  });
});
