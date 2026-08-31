import { describe, expect, it } from "vitest";
import {
  buildAllowedPortalUrl,
  isAllowedHostname,
  sanitizeInboxThreads,
  sanitizeProviderError,
  sanitizeReconItems,
} from "./portalSafety";

describe("portalSafety", () => {
  it("accepts an exact host and its subdomains, not suffix lookalikes", () => {
    expect(isAllowedHostname("portal.example.com", ["example.com"])).toBe(true);
    expect(isAllowedHostname("example.com.attacker.test", ["example.com"])).toBe(false);
  });

  it("builds only HTTPS URLs within the reviewed path", () => {
    expect(
      buildAllowedPortalUrl({
        baseUrl: "https://example.com",
        path: "/inbox/thread-1#reply",
        allowedDomains: ["example.com"],
        allowedPaths: ["/inbox"],
      }),
    ).toBe("https://example.com/inbox/thread-1");

    expect(() =>
      buildAllowedPortalUrl({
        baseUrl: "https://example.com",
        path: "https://attacker.test/inbox",
        allowedDomains: ["example.com"],
        allowedPaths: ["/inbox"],
      }),
    ).toThrow("DOMAIN_NOT_ALLOWED");
  });

  it("bounds and filters reconnaissance output", () => {
    const result = sanitizeReconItems(
      [
        { title: "  First   room ", url: "https://example.com/room/1#top" },
        { title: "Duplicate", url: "https://example.com/room/1" },
        { title: "Cross-site", url: "https://attacker.test/room/2" },
      ],
      ["example.com"],
    );
    expect(result).toEqual([{ title: "First room", url: "https://example.com/room/1" }]);
  });

  it("maps provider errors to non-sensitive codes", () => {
    expect(sanitizeProviderError(new Error("request timeout with secret details"))).toBe(
      "PROVIDER_TIMEOUT",
    );
    expect(sanitizeProviderError(new Error("unexpected credential=value"))).toBe(
      "PROVIDER_ERROR",
    );
  });

  it("rejects malformed inbox payloads and bounds valid message content", () => {
    expect(sanitizeInboxThreads({ raw: "dom" })).toEqual([]);
    const result = sanitizeInboxThreads([
      {
        providerThreadId: " thread-1 ",
        subject: " Rehearsal room ",
        participants: ["Band A"],
        lastMessageAt: 123,
        messages: [
          {
            providerMessageId: "message-1",
            direction: "inbound",
            bodyText: "  Still available. ",
            sentAt: 123,
          },
        ],
      },
    ]);
    expect(result[0]?.messages[0]?.bodyText).toBe("Still available.");
  });

  it("redacts credential-like text before inbox persistence", () => {
    const result = sanitizeInboxThreads([
      {
        providerThreadId: "thread-1",
        participants: [],
        lastMessageAt: 123,
        messages: [
          {
            providerMessageId: "message-1",
            direction: "inbound",
            bodyText: "password=hunter2 OTP: 123456 Bearer abcdefghijklmnop",
            sentAt: 123,
          },
        ],
      },
    ]);
    expect(result[0]?.messages[0]?.bodyText).toBe(
      "password=[REDACTED] OTP [REDACTED] Bearer [REDACTED]",
    );
  });
});
