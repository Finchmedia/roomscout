import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { publicSignalToMarketSignal, savedNeedToSearch } from "./convexAdapters";

function publicSignal(isDemo?: boolean) {
  return {
    _id: "signal-id" as Id<"signals">,
    isDemo,
    side: "supply" as const,
    title: "Room",
    city: "Stuttgart",
    summary: "A public room signal.",
    arrangement: "shared" as const,
    requirements: [],
    unknowns: [],
    status: "published" as const,
    verification: "observed" as const,
    sourceCount: 1,
    firstSeenAt: 1_700_000_000_000,
    lastSeenAt: 1_700_000_000_000,
  };
}

describe("publicSignalToMarketSignal", () => {
  it("passes through only an explicit server-derived demo marker", () => {
    expect(publicSignalToMarketSignal(publicSignal(true)).isDemo).toBe(true);
    expect(publicSignalToMarketSignal(publicSignal(false)).isDemo).toBe(false);
    expect(publicSignalToMarketSignal(publicSignal()).isDemo).toBe(false);
  });
});

describe("savedNeedToSearch", () => {
  it("shows the location label and radius without legacy districts", () => {
    const search = savedNeedToSearch({
      _id: "need-id" as Id<"savedNeeds">,
      _creationTime: 1,
      ownerId: "owner-id" as Id<"users">,
      title: "Room search",
      city: "Legacy city",
      districts: ["Legacy district"],
      locationQuery: "Hauptstätter Straße 123, Stuttgart",
      locationLabel: "Hauptstätter Straße 123",
      radiusKm: 8,
      arrangement: [],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: 1,
      updatedAt: 1,
    } satisfies Doc<"savedNeeds">);
    expect(search.fields.slice(0, 2).map((field) => field.value)).toEqual([
      "Hauptstätter Straße 123",
      "8 km",
    ]);
  });
});
