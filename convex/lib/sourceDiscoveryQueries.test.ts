import { describe, expect, it } from "vitest";
import {
  buildGermanySourceDiscoveryQueries,
  discoveryQuerySlice,
  germanDiscoveryCities,
} from "./sourceDiscoveryQueries";

describe("Germany source discovery matrix", () => {
  it("covers every city with all source families and stable unique keys", () => {
    const queries = buildGermanySourceDiscoveryQueries();
    expect(queries.length).toBe(germanDiscoveryCities().length * 4);
    expect(new Set(queries.map((query) => query.key)).size).toBe(queries.length);
    expect(queries.some((query) => query.location === "Stuttgart")).toBe(true);
    expect(queries.some((query) => query.location === "Hamburg")).toBe(true);
    expect(queries.some((query) => query.location === "Berlin")).toBe(true);
    expect(new Set(queries.map((query) => query.sourceKind))).toEqual(
      new Set([
        "classifieds",
        "music_community",
        "studio_directory",
        "public_culture",
      ]),
    );
  });

  it("scopes every query to a city, never to a region or the country", () => {
    const locations = new Set(
      buildGermanySourceDiscoveryQueries().map((query) => query.location),
    );
    for (const nonCity of [
      "Deutschland",
      "Bayern",
      "Nordrhein-Westfalen",
      "Baden-Württemberg",
      "Sachsen",
    ]) {
      expect(locations.has(nonCity)).toBe(false);
    }
    expect(locations.size).toBe(germanDiscoveryCities().length);
  });

  it("searches a parenthesised city under its plain name", () => {
    const halle = buildGermanySourceDiscoveryQueries().find(
      (query) => query.location === "Halle (Saale)",
    );
    expect(halle).toBeDefined();
    expect(halle?.query.endsWith(" Halle")).toBe(true);
  });

  it("forces bounded resumable batches", () => {
    const first = discoveryQuerySlice({ cursor: 0, limit: 999 });
    expect(first.queries).toHaveLength(25);
    expect(first.nextCursor).toBe(25);
    const end = discoveryQuerySlice({ cursor: first.total - 1, limit: 3 });
    expect(end.queries).toHaveLength(1);
    expect(end.nextCursor).toBeNull();
  });
});
