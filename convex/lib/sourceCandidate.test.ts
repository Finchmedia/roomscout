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
  });
});
