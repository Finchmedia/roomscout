import { describe, expect, it } from "vitest";
import { compareForCorroboration, verificationFromEvidence } from "./corroboration";

const base = {
  side: "supply" as const,
  title: "Shared rehearsal room for punk band in Stuttgart West",
  city: "Stuttgart",
  district: "West",
  arrangement: "shared" as const,
  priceEur: 220,
  pricePeriod: "month" as const,
};

describe("cross-source corroboration", () => {
  it("links a materially similar listing from another source", () => {
    expect(compareForCorroboration(base, {
      ...base,
      title: "Punk band: shared rehearsal room, Stuttgart-West",
    }).relation).toBe("corroborated");
  });

  it("does not link generic listings just because city and side match", () => {
    expect(compareForCorroboration(base, {
      ...base,
      title: "Hourly equipped studio near the main station",
      arrangement: "hourly",
    }).relation).toBe("none");
  });

  it("marks strongly identified but contradictory evidence as conflicting", () => {
    expect(compareForCorroboration(base, {
      ...base,
      title: base.title,
      priceEur: 500,
    }).relation).toBe("conflicting");
  });

  it("requires two distinct sources for verified", () => {
    expect(verificationFromEvidence([
      { ...base, sourceId: "source-a" },
      { ...base, sourceId: "source-a" },
    ])).toEqual({ sourceCount: 1, verification: "observed" });
    expect(verificationFromEvidence([
      { ...base, sourceId: "source-a" },
      { ...base, sourceId: "source-b" },
    ])).toEqual({ sourceCount: 2, verification: "verified" });
  });
});
