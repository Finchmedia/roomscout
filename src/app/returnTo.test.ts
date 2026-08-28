import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./returnTo";

describe("safeReturnTo", () => {
  it("keeps an internal path and query string", () => {
    expect(safeReturnTo("/signals/example?from=scout")).toBe(
      "/signals/example?from=scout",
    );
  });

  it.each([null, "", "https://example.com", "//example.com/path"])(
    "falls back for an unsafe return target: %s",
    (target) => {
      expect(safeReturnTo(target)).toBe("/app/scout");
    },
  );
});
