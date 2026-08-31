import { describe, expect, it } from "vitest";
import { scoreSignalMatch } from "./matchingCore";

const need = {
  city: "Stuttgart",
  districts: ["West"],
  maxBudgetEur: 250,
  arrangement: ["shared" as const],
  requirements: ["drums", "secure storage"],
  openToSharing: true,
  genres: ["hardcore"],
  instruments: ["drums"],
};

it("keeps unknown price as uncertainty instead of excluding supply", () => {
  const result = scoreSignalMatch(need, {
    side: "supply",
    city: "Stuttgart",
    district: "West",
    title: "Shared hardcore rehearsal room with drums",
    summary: "Secure storage available",
    arrangement: "shared",
    requirements: ["drums", "storage"],
  }, 0.9);
  expect(result.eligible).toBe(true);
  expect(result.uncertainties).toContain("Price is not stated");
});

it("requires explicit bilateral sharing consent for demand matches", () => {
  const result = scoreSignalMatch(need, {
    side: "demand",
    city: "Stuttgart",
    title: "Metal band needs a room",
    summary: "Looking for a permanent space",
    arrangement: "shared",
    requirements: [],
  }, 1);
  expect(result.eligible).toBe(false);
});

describe("hard constraints", () => {
  it("rejects another city", () => {
    expect(scoreSignalMatch(need, {
      side: "supply",
      city: "Berlin",
      title: "Room",
      summary: "Room",
      arrangement: "shared",
      requirements: [],
    }, 1).eligible).toBe(false);
  });

  it("rejects a positioned signal outside an explicit radius", () => {
    expect(scoreSignalMatch({
      ...need,
      radiusKm: 5,
      centerLatitude: 48.7758,
      centerLongitude: 9.1829,
    }, {
      side: "supply",
      city: "Stuttgart",
      title: "Room",
      summary: "Room",
      arrangement: "shared",
      requirements: [],
      latitude: 48.9,
      longitude: 9.3,
    }, 1).eligible).toBe(false);
  });
});
