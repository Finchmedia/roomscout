import { describe, expect, it } from "vitest";
import { portalRegistrationErrorMessage } from "./portalRegistrationError";

describe("portalRegistrationErrorMessage", () => {
  it("renders the portal registration retry delay without leaking a Convex stack", () => {
    expect(
      portalRegistrationErrorMessage({
        data: {
          kind: "RateLimited",
          name: "portalAuthSource",
          retryAfter: 73_007_290,
          code: "PORTAL_RATE_LIMITED",
        },
        message: "[CONVEX A(browserbasePortal:startAgentRegistration)] stack trace",
      }),
    ).toBe(
      "RoomScout has reached its registration limit for this portal. Try again in 20 hours and 17 minutes.",
    );
  });

  it("bounds unexpectedly large retry delays", () => {
    expect(
      portalRegistrationErrorMessage({
        data: {
          kind: "RateLimited",
          name: "portalAuthSource",
          retryAfter: Number.MAX_SAFE_INTEGER,
        },
      }),
    ).toBe(
      "RoomScout has reached its registration limit for this portal. Try again in 30 days.",
    );
  });

  it("renders fixed Browserbase launch failures as actionable copy", () => {
    expect(
      portalRegistrationErrorMessage({
        data: {
          code: "AGENT_REGISTRATION_BROWSER_LAUNCH_BAD_REQUEST_HTTP_402",
        },
      }),
    ).toBe(
      "Browserbase could not open the secure registration browser. Check the Browserbase account capacity, then try again.",
    );
  });

  it("distinguishes the shared RoomScout browser limit", () => {
    expect(portalRegistrationErrorMessage({ data: {
      kind: "RateLimited", name: "portalSessionGlobal", retryAfter: 60_000,
    } })).toBe("RoomScout has reached its shared browser-session limit. Try again in 1 minute.");
  });

  it("explains a bounded recovery cooldown", () => {
    expect(portalRegistrationErrorMessage({ data: {
      kind: "RateLimited", name: "portalAuthRecovery", retryAfter: 60_000,
    } })).toBe("The failed setup has already been reset for this daily window. Try again in 1 minute.");
  });

  it("does not expose unknown error details", () => {
    expect(
      portalRegistrationErrorMessage(new Error("provider secret response")),
    ).toBe(
      "The controlled portal registration could not be started. Please try again later.",
    );
  });
});
