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

it("classifies an otherwise fitting room above a comparable monthly budget as near-budget", () => {
  const result = scoreSignalMatch({
    city: "Stuttgart",
    maxBudgetEur: 250,
    arrangement: ["shared"],
    requirements: [],
  }, {
    side: "supply",
    city: "Stuttgart",
    title: "Shared room",
    summary: "A monthly rehearsal room",
    arrangement: "shared",
    priceEur: 350,
    pricePeriod: "month",
    requirements: [],
  }, 1);

  expect(result).toMatchObject({
    eligible: false,
    eligibility: "near_budget",
    monthlyCostEur: 350,
    monthlyCostBasis: "listed_monthly_base",
    budgetDeltaEur: 100,
  });
});

it("does not compare an hourly listing price with a monthly search budget", () => {
  const result = scoreSignalMatch({
    city: "Stuttgart",
    maxBudgetEur: 250,
    arrangement: ["hourly"],
    requirements: [],
  }, {
    side: "supply",
    city: "Stuttgart",
    title: "Hourly room",
    summary: "Book by the hour",
    arrangement: "hourly",
    priceEur: 300,
    pricePeriod: "hour",
    requirements: [],
  }, 1);

  expect(result.eligibility).toBe("fit");
  expect(result.monthlyCostBasis).toBe("unknown");
  expect(result.budgetDeltaEur).toBeUndefined();
  expect(result.uncertainties).toContain("A comparable total monthly price has not been established");
});

it("uses a grounded monthly minimum as a comparable lower bound without claiming the total is known", () => {
  const result = scoreSignalMatch({
    city: "Stuttgart", maxBudgetEur: 250, arrangement: ["shared"], requirements: [],
  }, {
    side: "supply", city: "Stuttgart", title: "Shared room", summary: "Room",
    arrangement: "shared", priceEur: 25, pricePeriod: "hour", requirements: [],
  }, 1, {
    requirements: [],
    schedule: { verdict: "unknown", evidence: null, explanation: "No schedule requested" },
    monthlyPrice: { minimumEur: 320, totalKnown: false, evidence: "At least EUR 320 monthly" },
    sharing: { open: null, evidence: null },
  });

  expect(result).toMatchObject({
    eligibility: "near_budget",
    monthlyCostBasis: "assessed_monthly_minimum",
    monthlyCostEur: 320,
    budgetDeltaEur: 70,
  });
});

it("does not call a room near-budget when another hard constraint also excludes it", () => {
  const result = scoreSignalMatch({
    city: "Stuttgart", maxBudgetEur: 250, arrangement: ["shared"], requirements: [],
  }, {
    side: "supply", city: "Stuttgart", title: "Permanent room", summary: "Room",
    arrangement: "permanent", priceEur: 350, pricePeriod: "month", requirements: [],
  }, 1);

  expect(result).toMatchObject({ eligibility: "ineligible", budgetDeltaEur: 100 });
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
