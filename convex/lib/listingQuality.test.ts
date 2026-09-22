import { describe, expect, it } from "vitest";
import {
  assessListingQuality,
  isPlaceableCity,
  isWithinGermany,
} from "./listingQuality";

describe("listing quality", () => {
  it("keeps real listings observed in production", () => {
    for (const listing of [
      { title: "Proberaum Berlin Übungsraum 20qm Tageslicht", city: "Berlin" },
      { title: "Bandproberaum in Spandau 24/7 nutzbar mit WC", city: "Berlin" },
      { title: "Sehr preiswerter Proberaum zur Mitnutzung", city: "Bonn" },
      { title: "Untermieter für Proberaum (Nichtraucher)", city: "Hannover" },
      { title: "Jazz Übungsraum Köln", city: "Köln" },
      // A phone number in a real title must not disqualify it.
      { title: "Ab [phone redacted] Mitbenutzung Proberaum 20qm", city: "Berlin" },
    ]) {
      expect(assessListingQuality(listing).usable).toBe(true);
    }
  });

  it("rejects the placeholders the extractor emits for non-listing pages", () => {
    expect(assessListingQuality({ title: "Unbekannt", city: "Unbekannt" }))
      .toMatchObject({ usable: false });
    expect(assessListingQuality({ title: "Keine Anzeige abrufbar", city: "Unbekannt" }))
      .toMatchObject({ usable: false, reason: "placeholder_title" });
    expect(assessListingQuality({ title: "Rehearsal-room listing", city: "Unknown" }))
      .toMatchObject({ usable: false, reason: "placeholder_title" });
    expect(
      assessListingQuality({
        title: "No rehearsal-room listing details provided",
        city: "unknown",
      }),
    ).toMatchObject({ usable: false, reason: "placeholder_title" });
  });

  it("rejects a site name that cannot be placed on the map", () => {
    expect(
      assessListingQuality({ title: "MUSIK-ANZEIGEN", city: "Deutschland" }),
    ).toMatchObject({ usable: false, reason: "placeholder_city" });
    expect(
      assessListingQuality({
        title: "Musiker-in-deiner-Stadt.de – DEUTSCHLANDS ZENTRALES MUSIKERREGISTER",
        city: "unknown",
      }),
    ).toMatchObject({ usable: false, reason: "placeholder_city" });
  });

  it("keeps a real room whose city extraction failed", () => {
    // Observed in production: a genuine studio listing with no city parsed.
    expect(
      assessListingQuality({
        title: "Jangalz Studio – Dein Proberaum & Recording Space",
        city: "unknown",
      }).usable,
    ).toBe(true);
    expect(
      assessListingQuality({ title: "Proberaum frei ab sofort", city: " " }).usable,
    ).toBe(true);
  });

  it("rejects a title made only of redaction markers", () => {
    expect(
      assessListingQuality({ title: "[phone redacted] [email redacted]", city: "Berlin" }),
    ).toMatchObject({ usable: false, reason: "empty_title" });
  });
});

describe("placeable cities", () => {
  it("accepts real German city names", () => {
    for (const city of ["Berlin", "Köln", "Rodgau", "Frankfurt am Main", "Ulm"]) {
      expect(isPlaceableCity(city)).toBe(true);
    }
  });

  it("rejects placeholders, abbreviations and non-Latin junk", () => {
    // All three were produced by the extractor and reached a live snapshot.
    for (const city of ["unknown", "Deutschland", "HH", "、", " ", "x"]) {
      expect(isPlaceableCity(city)).toBe(false);
    }
  });

  it("rejects coordinates outside Germany", () => {
    expect(isWithinGermany(52.52, 13.405)).toBe(true);
    expect(isWithinGermany(48.137, 11.575)).toBe(true);
    // "NYC" was extracted as a city and geocoded to New York.
    expect(isWithinGermany(40.713, -74.006)).toBe(false);
    expect(isWithinGermany(51.507, -0.128)).toBe(false);
  });
});
