import { describe, expect, it } from "vitest";
import { constantTimeSecretMatches } from "./secureCompare";

describe("constantTimeSecretMatches", () => {
  it("accepts only the exact bearer value", async () => {
    await expect(constantTimeSecretMatches("Bearer secret", "Bearer secret"))
      .resolves.toBe(true);
    await expect(constantTimeSecretMatches("Bearer wrong", "Bearer secret"))
      .resolves.toBe(false);
    await expect(constantTimeSecretMatches(null, "Bearer secret"))
      .resolves.toBe(false);
  });
});
