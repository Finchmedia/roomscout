import { describe, expect, it } from "vitest";
import {
  assertReviewedProbeUrl,
  normalizeProbeObservation,
  resolveReviewedProbeAdapter,
} from "./sourceProbeAdapters";

describe("source probe adapter safety", () => {
  it("resolves only reviewed executor/config/flow tuples", () => {
    expect(
      resolveReviewedProbeAdapter({
        executor: "firecrawl",
        adapterKey: "generic-list-v1",
        configKey: "generic-list-v1",
        flow: "listing",
      }),
    ).not.toBeNull();
    expect(
      resolveReviewedProbeAdapter({
        executor: "firecrawl",
        adapterKey: "generic-list-v1",
        configKey: "client-provided-program",
        flow: "listing",
      }),
    ).toBeNull();
    expect(
      resolveReviewedProbeAdapter({
        executor: "browserbase",
        adapterKey: "generic-readonly-recon-v1",
        configKey: "generic-readonly-recon.v1",
        flow: "reply",
      }),
    ).toBeNull();
  });

  it("enforces the reviewed domain and path", () => {
    expect(
      assertReviewedProbeUrl({
        targetUrl: "https://bandnet.hamburg/anzeige/kategorie/19",
        canonicalDomain: "bandnet.hamburg",
        allowedDomains: ["bandnet.hamburg"],
        allowedPaths: ["/anzeige"],
      }),
    ).toBe("https://bandnet.hamburg/anzeige/kategorie/19");
    expect(() =>
      assertReviewedProbeUrl({
        targetUrl: "https://evil.example/anzeige",
        canonicalDomain: "bandnet.hamburg",
        allowedDomains: ["bandnet.hamburg"],
        allowedPaths: ["/anzeige"],
      }),
    ).toThrow("PROBE_TARGET_DOMAIN_NOT_ALLOWED");
    expect(() =>
      assertReviewedProbeUrl({
        targetUrl: "https://bandnet.hamburg/admin",
        canonicalDomain: "bandnet.hamburg",
        allowedDomains: ["bandnet.hamburg"],
        allowedPaths: ["/anzeige"],
      }),
    ).toThrow("PATH_NOT_ALLOWED");
  });

  it("stores bounded normalized facts and hashes evidence instead of returning content", async () => {
    const normalized = await normalizeProbeObservation({
      flow: "contact",
      maxItems: 5,
      observation: {
        finalUrl: "https://bandnet.hamburg/kontakt/1",
        linkCount: 30,
        sameDomainLinkCount: 12,
        formCount: 1,
        passwordFieldCount: 0,
        submitControlCount: 1,
        captchaPresent: true,
        loginSurfacePresent: false,
        sourceMaterial: "private page content that must not be persisted",
      },
    });
    expect(normalized.itemsObserved).toBe(1);
    expect(normalized.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(normalized)).not.toContain("private page content");
    expect(normalized.summary).toContain("no form was filled or submitted");
    expect(normalized.facts).toContainEqual(
      expect.objectContaining({
        key: "probe.contact.captcha_present",
        value: { kind: "boolean", value: true },
      }),
    );
  });
});
