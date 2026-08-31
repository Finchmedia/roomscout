import { describe, expect, it } from "vitest";
import {
  buildGermanySourceDiscoveryQueries,
  discoveryQuerySlice,
} from "./sourceDiscoveryQueries";

describe("Germany source discovery matrix", () => {
  it("covers every region with all source families and stable unique keys", () => {
    const queries = buildGermanySourceDiscoveryQueries();
    expect(queries.length).toBeGreaterThan(100);
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

  it("forces bounded resumable batches", () => {
    const first = discoveryQuerySlice({ cursor: 0, limit: 999 });
    expect(first.queries).toHaveLength(10);
    expect(first.nextCursor).toBe(10);
    const end = discoveryQuerySlice({ cursor: first.total - 1, limit: 3 });
    expect(end.queries).toHaveLength(1);
    expect(end.nextCursor).toBeNull();
  });
});
