import { describe, expect, it } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import { projectSignal } from "./signals";

describe("public signal projection", () => {
  it("preserves stored facets without deriving facts from summary text", () => {
    const facets: NonNullable<Doc<"signals">["facets"]> = [
      { namespace: "capacity", key: "max_people", value: "8", confidence: 1 },
      { namespace: "equipment", key: "drums", value: "true", confidence: 1 },
    ];
    const projected = projectSignal({
      _id: "signal" as Id<"signals">,
      _creationTime: 1,
      side: "supply",
      title: "Room",
      city: "Stuttgart",
      summary: "Shared by several musicians.",
      arrangement: "unknown",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: 1,
      lastSeenAt: 2,
      facets: [...facets, { namespace: "access", key: "parking", value: true, confidence: 1 }],
    });

    expect(projected.facets).toEqual(facets);
    expect(projected.arrangement).toBe("unknown");
    expect(projected.requirements).toEqual([]);
  });
});
