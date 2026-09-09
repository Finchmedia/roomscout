import { describe, expect, it } from "vitest";
import type { Doc } from "../../../convex/_generated/dataModel";
import { factsFromNeed, getScoutWorkspaceMode } from "./viewModel";

const need = (
  overrides: Partial<Doc<"savedNeeds">> = {},
): Doc<"savedNeeds"> => ({
  _id: "need" as Doc<"savedNeeds">["_id"],
  _creationTime: 1,
  ownerId: "owner" as Doc<"savedNeeds">["ownerId"],
  title: "Our room",
  city: "Stuttgart",
  districts: ["West"],
  arrangement: ["shared"],
  schedule: ["Thursday after 19:00"],
  requirements: ["Drum storage"],
  status: "active",
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe("Scout workspace view model", () => {
  it("keeps additional typed constraints visible and marks uncertain facts", () => {
    const facts = factsFromNeed(need({ facets: [
      { namespace: "band", key: "member_count", value: 4, confidence: 1 },
      { namespace: "access", key: "transport", value: ["S-Bahn", "U-Bahn"], confidence: 0.5 },
    ] }));
    expect(facts.find((fact) => fact.key === "facet:band:member_count")?.value).toBe("4");
    expect(facts.find((fact) => fact.key === "facet:access:transport")?.value).toBe("S-Bahn · U-Bahn · noch zu klären");
  });
  it("turns persisted need fields into concise facts", () => {
    expect(
      factsFromNeed(need({ maxBudgetEur: 350 })).map((fact) => fact.value),
    ).toEqual([
      "Stuttgart · West",
      "Shared room",
      "Up to €350 / month",
      "Thursday after 19:00",
      "Drum storage",
    ]);
  });

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
