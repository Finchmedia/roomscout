import { describe, expect, it } from "vitest";
import { widenArrangementForSharing } from "./needArrangement";

describe("open to sharing widens the arrangement filter", () => {
  it("always accepts both shared and permanent rooms when sharing is open", () => {
    // Observed in production: "we're open to sharing" was captured as
    // ["shared"], which hard-excluded the €220 permanent room in Marzahn.
    expect(widenArrangementForSharing(["shared"], true).sort()).toEqual([
      "permanent",
      "shared",
    ]);
    expect(widenArrangementForSharing(["permanent"], true).sort()).toEqual([
      "permanent",
      "shared",
    ]);
    expect(widenArrangementForSharing([], true).sort()).toEqual([
      "permanent",
      "shared",
    ]);
  });

  it("leaves a deliberate shared-only brief alone when sharing was not offered", () => {
    expect(widenArrangementForSharing(["shared"], undefined)).toEqual(["shared"]);
    expect(widenArrangementForSharing(["shared"], false)).toEqual(["shared"]);
  });

  it("never narrows or duplicates an existing list", () => {
    expect(widenArrangementForSharing(["shared", "permanent"], true).sort()).toEqual([
      "permanent",
      "shared",
    ]);
    expect(widenArrangementForSharing(["hourly"], true).sort()).toEqual([
      "hourly",
      "permanent",
      "shared",
    ]);
  });

  it("keeps an unrelated arrangement while widening", () => {
    expect(widenArrangementForSharing(["shared", "hourly"], true).sort()).toEqual([
      "hourly",
      "permanent",
      "shared",
    ]);
  });
});
