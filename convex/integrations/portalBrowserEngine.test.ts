import { describe, expect, it } from "vitest";
import {
  requirePortalBrowserProviderConfiguration,
  resolvePortalBrowserProvider,
} from "./portalBrowserEngine";

const reader = (values: Record<string, string | undefined>) => (name: string) => values[name];

describe("portal browser provider selection", () => {
  it("defaults only an unset selector to Browserbase", () => {
    expect(resolvePortalBrowserProvider(reader({}))).toBe("browserbase");
    expect(resolvePortalBrowserProvider(reader({ PORTAL_BROWSER_ENGINE: "  " }))).toBe("browserbase");
  });

  it.each(["firecrawl", "browserbase"] as const)("selects %s exclusively", (provider) => {
    expect(resolvePortalBrowserProvider(reader({ PORTAL_BROWSER_ENGINE: provider }))).toBe(provider);
  });

  it("rejects invalid nonempty selectors", () => {
    expect(() => resolvePortalBrowserProvider(reader({ PORTAL_BROWSER_ENGINE: "auto" })))
      .toThrow("PORTAL_BROWSER_ENGINE_INVALID");
  });

  it("requires credentials for the selected provider without accepting the other key", () => {
    expect(() => requirePortalBrowserProviderConfiguration("firecrawl", reader({ BROWSERBASE_API_KEY: "other" })))
      .toThrow("FIRECRAWL_NOT_CONFIGURED");
    expect(() => requirePortalBrowserProviderConfiguration("browserbase", reader({ FIRECRAWL_API_KEY: "other" })))
      .toThrow("BROWSERBASE_NOT_CONFIGURED");
    expect(requirePortalBrowserProviderConfiguration("firecrawl", reader({ FIRECRAWL_API_KEY: "key" })))
      .toBe("firecrawl");
  });

  it("reads the current Node environment after its object is replaced", () => {
    const original = process.env;
    const current = resolvePortalBrowserProvider();
    const replacement = current === "firecrawl" ? "browserbase" : "firecrawl";
    try {
      process.env = { ...original, PORTAL_BROWSER_ENGINE: replacement };
      expect(resolvePortalBrowserProvider()).toBe(replacement);
    } finally {
      process.env = original;
    }
  });
});
