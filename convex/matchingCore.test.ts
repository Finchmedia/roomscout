import { describe, expect, it } from "vitest";
import { scoreSignalMatch } from "./matchingCore";

const need = {
  city: "Stuttgart",
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

  it("accepts a positioned signal across a city boundary when it is inside the radius", () => {
    const result = scoreSignalMatch({
      ...need, locationQuery: "Stuttgart", locationLabel: "Stuttgart", radiusKm: 20,
      centerLatitude: 48.7758, centerLongitude: 9.1829,
    }, {
      side: "supply", city: "Esslingen", district: "Innenstadt", title: "Room", summary: "Room",
      arrangement: "shared", requirements: [], latitude: 48.7406, longitude: 9.3108,
    }, 1);
    expect(result.eligible).toBe(true);
    expect(result.reasons.some((reason) => reason.startsWith("Within 20 km radius"))).toBe(true);
  });

  it("does not use listing districts as a saved-need constraint or score", () => {
    const centeredNeed = {
      ...need,
      locationQuery: "Stuttgart",
      locationLabel: "Stuttgart",
      radiusKm: 20,
      centerLatitude: 48.7758,
      centerLongitude: 9.1829,
    };
    const baseSignal = {
      side: "supply" as const,
      city: "Stuttgart",
      title: "Room",
      summary: "Room",
      arrangement: "shared" as const,
      requirements: [],
      latitude: 48.78,
      longitude: 9.18,
    };
    const west = scoreSignalMatch(centeredNeed, { ...baseSignal, district: "West" }, 1);
    const east = scoreSignalMatch(centeredNeed, { ...baseSignal, district: "East" }, 1);
    expect(west).toEqual(east);
    expect(west.reasons.every((reason) => !reason.includes("area"))).toBe(true);
  });

  it("keeps an unpositioned listing as uncertain instead of treating the district as a hard gate", () => {
    const result = scoreSignalMatch({
      ...need, radiusKm: 20, centerLatitude: 48.7758, centerLongitude: 9.1829,
    }, {
      side: "supply", city: "Ludwigsburg", title: "Room", summary: "Room",
      arrangement: "shared", requirements: [],
    }, 1);
    expect(result.uncertainties).toContain("Listing coordinates are unavailable; radius eligibility needs clarification");
  });
});
