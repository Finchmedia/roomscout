import { describe, expect, it } from "vitest";
import type { Doc } from "../../../convex/_generated/dataModel";
import { de } from "../../ui/copy/de";
import { get, interpolate } from "../../ui/copy/format";
import type { CopyVars, StringCopyKey } from "../../ui/copy/types";
import { factsFromNeed, getScoutWorkspaceMode } from "./viewModel";

/**
 * The real German dictionary, not a stub: the point of these tests is what the
 * musician reads, and a stubbed `t` would let a missing key pass.
 */
const t = (key: StringCopyKey, vars?: CopyVars): string => {
  const node = get(de, key);
  if (typeof node !== "string") throw new Error(`missing copy key: ${key}`);
  return interpolate(node, vars);
};

const need = (
  overrides: Partial<Doc<"savedNeeds">> = {},
): Doc<"savedNeeds"> => ({
  _id: "need" as Doc<"savedNeeds">["_id"],
  _creationTime: 1,
  ownerId: "owner" as Doc<"savedNeeds">["ownerId"],
  title: "Our room",
  city: "Stuttgart",
  locationQuery: "Rotebühlstraße 1, Stuttgart",
  locationLabel: "Stuttgart-West",
  arrangement: ["shared"],
  schedule: ["Donnerstags ab 19 Uhr"],
  requirements: ["Schlagzeug darf stehen bleiben"],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

const values = (facts: ReturnType<typeof factsFromNeed>) =>
  Object.fromEntries(facts.map((fact) => [fact.key, fact.value]));

describe("Scout brief facts", () => {
  it("turns persisted need fields into concise German facts", () => {
    expect(
      factsFromNeed(need({ maxBudgetEur: 350, radiusKm: 15 }), t).map((fact) => fact.value),
    ).toEqual([
      "Stuttgart-West · 15 km Umkreis",
      "Geteilter Raum",
      "Bis 350 € / Monat",
      "Donnerstags ab 19 Uhr",
      "Schlagzeug darf stehen bleiben",
    ]);
  });

  /**
   * The brief as the maintainer saw it on 2026-09-15: a bullet reading „4“, one
   * reading „on_site_or_storage_allowed“, and „Rock“ / „Schlagzeug“ / „Nur
   * Raumsuche“ next to a requirements sentence that already said all three.
   */
  it("renders the 2026-09-15 brief without raw facets and without repeats", () => {
    const facts = factsFromNeed(
      need({
        requirements: [],
        genres: ["Rock"],
        instruments: ["Schlagzeug"],
        collaborationOpen: false,
        facets: [
          { namespace: "band", key: "size", value: 4, confidence: 1 },
          { namespace: "equipment", key: "on_site_or_storage_allowed", value: true, confidence: 1 },
        ],
      }),
      t,
    );

    expect(values(facts)).toEqual({
      ort: "Stuttgart-West",
      band: "Geteilter Raum · 4er-Rockband · Schlagzeug",
      zeit: "Donnerstags ab 19 Uhr",
      "facet:equipmentStorage": "Schlagzeug vor Ort oder eigenes darf stehen bleiben",
    });
    expect(facts.map((fact) => fact.value).join(" ")).not.toContain("on_site_or_storage_allowed");
    expect(facts.some((fact) => fact.value === "4")).toBe(false);
    expect(facts.some((fact) => fact.value === "Nur Raumsuche")).toBe(false);
  });

  it("drops a value the requirements sentence already carries", () => {
    const facts = factsFromNeed(
      need({
        requirements: ["Geeignet für 4er-Rockband · Schlagzeug vorhanden"],
        genres: ["Rock"],
        instruments: ["Schlagzeug"],
        facets: [{ namespace: "band", key: "size", value: 4, confidence: 1 }],
      }),
      t,
    );
    expect(values(facts).band).toBe("Geteilter Raum");
    expect(values(facts).equip).toBe("Geeignet für 4er-Rockband · Schlagzeug vorhanden");
  });

  it("names a band without a size and keeps an open collaboration", () => {
    expect(
      values(
        factsFromNeed(
          need({ requirements: [], genres: ["Jazz"], instruments: [], collaborationOpen: true }),
          t,
        ),
      ).band,
    ).toBe("Geteilter Raum · Jazz · Offen für andere Bands");
  });

  it("renders known facets by rule and drops the rest", () => {
    const facts = factsFromNeed(
      need({
        requirements: [],
        facets: [
          { namespace: "equipment", key: "pa", value: "ja", confidence: 1 },
          // A flag that is off is not a wish — it says nothing and shows nothing.
          { namespace: "access", key: "parking", value: false, confidence: 1 },
          { namespace: "cost", key: "deposit_eur", value: 300, confidence: 1 },
          { namespace: "access", key: "transport", value: ["S-Bahn", "U-Bahn"], confidence: 0.5 },
          { namespace: "vibes", key: "mood", value: "gemütlich", confidence: 1 },
        ],
      }),
      t,
    );
    expect(values(facts)).toMatchObject({
      "facet:equipmentPa": "PA vorhanden",
      "facet:costDeposit": "Kaution 300 €",
      "facet:accessTransport": "Erreichbar mit S-Bahn · U-Bahn · noch zu klären",
    });
    expect(facts.some((fact) => fact.key.includes("parking"))).toBe(false);
    expect(facts.some((fact) => fact.value.includes("gemütlich"))).toBe(false);
  });

  it("keeps one fact per key even when two facets mean the same thing", () => {
    const facts = factsFromNeed(
      need({
        requirements: [],
        facets: [
          { namespace: "equipment", key: "storage", value: true, confidence: 1 },
          { namespace: "equipment", key: "drum_storage", value: true, confidence: 1 },
        ],
      }),
      t,
    );
    expect(facts.filter((fact) => fact.key === "facet:equipmentStorage")).toHaveLength(1);
  });
});

describe("Scout workspace mode", () => {
  it("only shows attention when a persisted opportunity has unresolved facts", () => {
    expect(
      getScoutWorkspaceMode(
        need(),
        [],
        [{ status: "new", uncertainties: ["Can Wednesday work?"] }],
      ),
    ).toBe("attention");
    expect(
      getScoutWorkspaceMode(need(), [], [{ status: "new", uncertainties: [] }]),
    ).toBe("waiting");
  });

  it("keeps draft and paused states authoritative", () => {
    expect(
      getScoutWorkspaceMode(
        need({ status: "draft" }),
        [{} as never],
        [{} as never],
      ),
    ).toBe("discovery");
    expect(
      getScoutWorkspaceMode(
        need({ status: "paused" }),
        [{} as never],
        [{} as never],
      ),
    ).toBe("paused");
  });
});
