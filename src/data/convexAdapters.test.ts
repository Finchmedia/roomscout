import { describe, expect, it } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { publicSignalToMarketSignal } from "./convexAdapters";

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
