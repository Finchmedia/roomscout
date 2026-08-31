import { describe, expect, it } from "vitest";
import { canonicalDomain, canonicalizeUrl } from "./urlCanonicalization";

describe("URL canonicalization", () => {
  it("removes trackers, fragments, duplicate slashes and default ports", () => {
    expect(
      canonicalizeUrl(
        "https://WWW.Example.com:443//rooms/?utm_source=test&b=2#a",
      ),
    ).toBe("https://www.example.com/rooms?b=2");
  });

  it("uses one platform domain key for www and root URLs", () => {
    expect(canonicalDomain("https://www.bandnet.hamburg/listing")).toBe(
      "bandnet.hamburg",
    );
  });
});
