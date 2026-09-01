import { describe, expect, it } from "vitest";
import {
  buildDesiredMonitor,
  monitorConfigFingerprint,
  parseMonitorWebhook,
} from "./monitorReconciliation";
import { redactContactData } from "./piiRedaction";
import { extractSourceEntriesFromSnapshot } from "./sourceEntryExtraction";
import { canonicalizeUrl } from "./urlCanonicalization";

describe("URL canonicalization", () => {
  it("resolves relative detail links and removes tracking noise", () => {
    expect(
      canonicalizeUrl(
        "/listing/42/?utm_source=test&b=2&a=1#contact",
        "https://EXAMPLE.com/search/",
      ),
    ).toBe("https://example.com/listing/42?a=1&b=2");
  });

  it("rejects non-web protocols", () => {
    expect(canonicalizeUrl("mailto:band@example.com")).toBeNull();
  });
});

describe("contact redaction", () => {
  it("redacts email and formatted phone contacts but keeps prices", () => {
    const result = redactContactData(
      "Mail band@example.com or +49 711 123 45 67. Budget 450 EUR.",
    );
    expect(result.contactDataPresent).toBe(true);
    expect(result.redacted).toContain("[email redacted]");
    expect(result.redacted).toContain("[phone redacted]");
    expect(result.redacted).toContain("450 EUR");
    expect(result.redacted).not.toContain("band@example.com");
  });
});

describe("multi-entry extraction", () => {
  it("deduplicates canonical URLs and persists only redacted excerpts", () => {
    const entries = extractSourceEntriesFromSnapshot({
      pageUrl: "https://example.com/rooms",
      defaultSide: "demand",
      snapshot: {
        entries: [
          {
            id: "a",
            title: "Band sucht Raum",
            url: "/ads/1?utm_source=feed",
            summary: "Kontakt band@example.com",
            city: "Stuttgart",
          },
          {
            id: "duplicate",
            title: "Duplicate",
            url: "https://example.com/ads/1",
            summary: "same",
          },
          {
            id: "b",
            title: "Proberaum frei",
            url: "/ads/2",
            summary: "Freitags frei",
            side: "supply",
          },
        ],
      },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      canonicalUrl: "https://example.com/ads/1",
      side: "demand",
      contactDataPresent: true,
    });
    expect(entries[0]?.excerpt).not.toContain("band@example.com");
    expect(entries[1]?.side).toBe("supply");
  });
});

describe("native monitor contract", () => {
  it("builds a Firecrawl-owned schedule and stable secret-free fingerprint", () => {
    const request = buildDesiredMonitor({
      candidate: {
        targetId: "target-1",
        sourceName: "Source",
        url: "https://example.com/listings",
        mode: "scrape",
        scheduleMinutes: 5,
        paused: false,
      },
      webhookUrl: "https://deployment.convex.site/api/webhooks/firecrawl",
      webhookBearer: "first-secret",
    });
    const second = buildDesiredMonitor({
      candidate: {
        targetId: "target-1",
        sourceName: "Source",
        url: "https://example.com/listings",
        mode: "scrape",
        scheduleMinutes: 5,
        paused: false,
      },
      webhookUrl: "https://deployment.convex.site/api/webhooks/firecrawl",
      webhookBearer: "rotated-secret",
    });
    expect(request.schedule.text).toBe("every 15 minutes");
    expect(request.webhook?.events).toEqual([
      "monitor.page",
      "monitor.check.completed",
    ]);
    expect(request.targets[0]).not.toHaveProperty("id");
    expect(monitorConfigFingerprint(request, false)).toBe(
      monitorConfigFingerprint(second, false),
    );
  });

  it("uses Firecrawl's documented daily schedule instead of an invalid minute interval", () => {
    const request = buildDesiredMonitor({
      candidate: {
        targetId: "target-daily",
        sourceName: "Daily source",
        url: "https://example.com/listings",
        mode: "scrape",
        scheduleMinutes: 1_440,
        paused: false,
      },
      webhookUrl: "https://deployment.convex.site/api/webhooks/firecrawl",
      webhookBearer: "secret",
    });
    expect(request.schedule).toEqual({
      text: "daily",
      timezone: "Europe/Berlin",
    });
  });

  it("parses a monitor page webhook with a JSON snapshot", () => {
    expect(
      parseMonitorWebhook({
        type: "monitor.page",
        id: "evt-1",
        monitorId: "monitor-1",
        checkId: "check-1",
        metadata: { sourceTargetId: "target-1" },
        data: {
          id: "page-1",
          url: "https://example.com/listings",
          status: "changed",
          snapshot: { json: { entries: [] } },
        },
      }),
    ).toMatchObject({
      eventType: "monitor.page",
      providerEventId: "evt-1",
      providerMonitorId: "monitor-1",
      providerCheckId: "check-1",
      sourceTargetId: "target-1",
      pageUrl: "https://example.com/listings",
      changeStatus: "changed",
      snapshot: { entries: [] },
    });
  });

  it("parses the current Firecrawl array-wrapped monitor webhook shape", () => {
    expect(
      parseMonitorWebhook({
        type: "monitor.check.completed",
        id: "evt-complete",
        metadata: { sourceTargetId: "target-1" },
        data: [
          {
            monitorId: "monitor-1",
            checkId: "check-1",
            status: "completed",
          },
        ],
      }),
    ).toMatchObject({
      eventType: "monitor.check.completed",
      providerEventId: "evt-complete",
      providerMonitorId: "monitor-1",
      providerCheckId: "check-1",
      sourceTargetId: "target-1",
    });
  });
});
