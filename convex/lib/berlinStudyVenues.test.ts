import { describe, expect, it } from "vitest";
import {
  BERLIN_STUDY_VENUES,
  namedVenueQuery,
  namedVenueSlice,
  pickVenueMatch,
} from "./berlinStudyVenues";

describe("operator-supplied Berlin venues", () => {
  it("carries the whole study list with unique names", () => {
    expect(BERLIN_STUDY_VENUES.length).toBe(28);
    expect(new Set(BERLIN_STUDY_VENUES.map((v) => v.name)).size).toBe(28);
    expect(BERLIN_STUDY_VENUES.every((v) => v.city === "Berlin")).toBe(true);
  });

  it("quotes the venue name and disambiguates by city", () => {
    expect(namedVenueQuery({ name: "ORWOHaus", city: "Berlin" })).toBe(
      '"ORWOHaus" Proberaum Berlin',
    );
  });

  it("slices resumably", () => {
    const first = namedVenueSlice({ cursor: 0, limit: 10 });
    expect(first.venues).toHaveLength(10);
    expect(first.nextCursor).toBe(10);
    expect(namedVenueSlice({ cursor: 27, limit: 10 }).nextCursor).toBeNull();
  });

  it("prefers the venue's own domain over a document that lists it", () => {
    // Observed live: a name search for "Die Linse" returned the study PDF first.
    const match = pickVenueMatch(
      { name: "Die Linse", city: "Berlin" },
      [
        {
          canonicalUrl:
            "https://www.musicboard-berlin.de/wp-content/uploads/2021/study.pdf",
          canonicalDomain: "musicboard-berlin.de",
        },
        { canonicalUrl: "https://die-linse.de/", canonicalDomain: "die-linse.de" },
      ],
    );
    expect(match?.canonicalDomain).toBe("die-linse.de");
  });

  it("prefers the official site over a ticketing aggregator", () => {
    // Observed live: "Berliner Rockhaus" returned an events aggregator first.
    const match = pickVenueMatch(
      { name: "Berliner Rockhaus", city: "Berlin" },
      [
        {
          canonicalUrl:
            "https://events.musicofourdesire.com/venue/berliner-rockhaus",
          canonicalDomain: "events.musicofourdesire.com",
        },
        { canonicalUrl: "https://rockhaus.de/", canonicalDomain: "rockhaus.de" },
      ],
    );
    expect(match?.canonicalDomain).toBe("rockhaus.de");
  });

  it("still returns the best available hit when no domain matches", () => {
    const match = pickVenueMatch(
      { name: "Super-Sessions", city: "Berlin" },
      [{ canonicalUrl: "https://example.de/rooms", canonicalDomain: "example.de" }],
    );
    expect(match?.canonicalDomain).toBe("example.de");
  });
});
