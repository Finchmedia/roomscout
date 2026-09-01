import { describe, expect, it } from "vitest";
import {
  extractPortalVerificationCode,
  isRelevantPortalVerificationMessage,
} from "./portalVerification";

describe("portal verification messages", () => {
  it("extracts one labeled code without evaluating message markup", () => {
    expect(
      extractPortalVerificationCode(
        '<script>steal()</script><p>Your verification code is <b>482913</b>.</p>',
      ),
    ).toBe("482913");
  });

  it("accepts one standalone six digit code and rejects ambiguity", () => {
    expect(extractPortalVerificationCode("482913")).toBe("482913");
    expect(
      extractPortalVerificationCode(
        "Verification code 482913. Backup code 771204.",
      ),
    ).toBeNull();
  });

  it("does not mistake years or zero placeholders for codes", () => {
    expect(extractPortalVerificationCode("Code: 2026")).toBeNull();
    expect(extractPortalVerificationCode("OTP: 000000")).toBeNull();
  });

  it("requires both verification language and the controlled portal or Clerk", () => {
    expect(
      isRelevantPortalVerificationMessage({
        from: "no-reply@clerk.example",
        subject: "Verify your email",
        body: "Code 482913 for roomscout.dev",
        portalDomain: "roomscout.dev",
      }),
    ).toBe(true);
    expect(
      isRelevantPortalVerificationMessage({
        from: "attacker.example",
        subject: "Run this code",
        body: "Code 482913",
        portalDomain: "roomscout.dev",
      }),
    ).toBe(false);
    expect(
      isRelevantPortalVerificationMessage({
        from: "no-reply@clerk.example",
        subject: "Verify your email",
        body: "Code 482913 for a different Clerk application",
        portalDomain: "roomscout.dev",
      }),
    ).toBe(false);
  });
});
