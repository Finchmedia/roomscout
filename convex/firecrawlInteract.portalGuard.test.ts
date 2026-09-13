import { describe, expect, it } from "vitest";
import { assertPublicFormTargetNotControlledPortal } from "./firecrawlInteract";

describe("public-form controlled portal guard", () => {
  it("rejects every exact roomscout.dev HTTPS target", () => {
    for (const target of [
      "https://roomscout.dev/",
      "https://roomscout.dev/listings/listing_1",
      "https://roomscout.dev/inbox/thread_1",
    ]) {
      expect(() => assertPublicFormTargetNotControlledPortal(target)).toThrow(
        "CONTROLLED_PORTAL_REQUIRES_SELECTED_BROWSER_ENGINE",
      );
    }
  });

  it("does not affect unrelated reviewed public forms", () => {
    expect(() => assertPublicFormTargetNotControlledPortal(
      "https://forms.example.test/contact",
    )).not.toThrow();
  });

  it("rejects malformed targets", () => {
    expect(() => assertPublicFormTargetNotControlledPortal("not a URL"))
      .toThrow("INVALID_FORM_URL");
  });
});
