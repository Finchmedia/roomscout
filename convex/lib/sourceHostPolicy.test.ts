import { describe, expect, it } from "vitest";
import {
  isBlockedDiscoveryHost,
  requiresTosReview,
} from "./sourceHostPolicy";

describe("discovery host policy", () => {
  it("blocks social and aggregator hosts on any subdomain", () => {
    for (const domain of [
      "facebook.com",
      "m.yelp.com",
      "de.linkedin.com",
      "www.instagram.com",
      "de.wikipedia.org",
      "google.de",
    ]) {
      expect(isBlockedDiscoveryHost(domain)).toBe(true);
    }
  });

  it("keeps real rehearsal-room hosts discoverable", () => {
    for (const domain of [
      "proberaum-dortmund.de",
      "feierwerk.de",
      "musiker-sucht.de",
      "bandnet.hamburg",
      "musiker-in-deiner-stadt.de",
    ]) {
      expect(isBlockedDiscoveryHost(domain)).toBe(false);
      expect(requiresTosReview(domain)).toBe(false);
    }
  });

  it("flags restricted marketplaces for review instead of dropping them", () => {
    for (const domain of ["kleinanzeigen.de", "www.kleinanzeigen.de", "ebay.de"]) {
      expect(isBlockedDiscoveryHost(domain)).toBe(false);
      expect(requiresTosReview(domain)).toBe(true);
    }
  });

  it("does not match a host that merely ends with the same letters", () => {
    expect(isBlockedDiscoveryHost("notfacebook.com")).toBe(false);
    expect(requiresTosReview("meine-kleinanzeigen.de")).toBe(false);
  });
});
