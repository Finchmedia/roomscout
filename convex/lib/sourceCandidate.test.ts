import { describe, expect, it } from "vitest";
import { normalizeDiscoveryHit } from "./sourceCandidate";

describe("source discovery candidates", () => {
  it("deduplicates tracking variants and redacts public contact data", () => {
    const candidate = normalizeDiscoveryHit({
      url: "https://www.example.de/rooms?utm_source=search",
      title: "Rooms",
      description: "Mail room@example.de or call +49 711 12345678",
    });
    expect(candidate).toMatchObject({
      canonicalUrl: "https://www.example.de/rooms",
      canonicalDomain: "example.de",
    });
    expect(candidate?.snippet).not.toContain("room@example.de");
    expect(candidate?.snippet).not.toContain("12345678");
  });

  it("drops search and social hosts rather than treating them as sources", () => {
    expect(normalizeDiscoveryHit({ url: "https://www.google.com/search?q=room" })).toBeNull();
    expect(normalizeDiscoveryHit({ url: "https://instagram.com/a" })).toBeNull();
    expect(normalizeDiscoveryHit({ url: "https://m.yelp.com/biz/room" })).toBeNull();
    expect(normalizeDiscoveryHit({ url: "https://www.facebook.com/groups/1" })).toBeNull();
  });

  it("keeps restricted marketplaces but marks them for a terms review", () => {
    expect(
      normalizeDiscoveryHit({ url: "https://www.kleinanzeigen.de/s-dortmund/proberaum/k0l1085" }),
    ).toMatchObject({ canonicalDomain: "kleinanzeigen.de", tosReviewRequired: true });
    expect(
      normalizeDiscoveryHit({ url: "https://proberaum-dortmund.de/" }),
    ).toMatchObject({ tosReviewRequired: false });
  });
});
