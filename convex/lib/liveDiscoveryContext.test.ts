import { describe, expect, it } from "vitest";
import { buildLiveDiscoveryContext } from "./liveDiscoveryContext";

describe("buildLiveDiscoveryContext", () => {
  it("exposes canonical discovery values and activation gaps without defaults", () => {
    const context = buildLiveDiscoveryContext({
      mode: "search_discovery",
      need: {
        _id: "need-1",
        title: "Post-punk room",
        status: "draft",
        locationQuery: "Kreuzberg, Berlin",
        maxBudgetEur: 300,
        arrangement: ["shared"],
        schedule: ["Wednesday evening"],
        requirements: ["Secure storage for own kit"],
        genres: ["post-punk"],
        instruments: ["drums", "guitar", "bass"],
        facets: [{ namespace: "band", key: "size", value: 4, confidence: 1 }],
        matchingRevision: 4,
      },
      briefReadiness: {
        status: "ready",
        needRevision: 4,
        missingFields: ["radiusKm"],
      },
    });

    expect(context).toMatchObject({
      version: 1,
      mode: "search_discovery",
      phase: "discovery",
      discovery: true,
      search: {
        location: { query: "Kreuzberg, Berlin", label: "Kreuzberg, Berlin", radiusKm: null },
        maxBudgetEur: 300,
        activation: { canActivate: false, missingFields: ["radiusKm"] },
        brief: { status: "ready", readyForReview: false, needRevision: 4 },
      },
    });
  });

  it("turns discovery off outside a draft search and defaults an absent mode", () => {
    expect(buildLiveDiscoveryContext({ need: null })).toEqual({
      version: 1,
      mode: "search_discovery",
      phase: "no_search",
      discovery: false,
      search: null,
    });
    expect(buildLiveDiscoveryContext({
      mode: "signal_advisor",
      need: {
        _id: "need-2",
        title: "Active room search",
        status: "active",
        city: "Berlin",
        arrangement: [],
        schedule: [],
        requirements: [],
      },
    })).toMatchObject({ phase: "candidate", discovery: false });
  });
});
