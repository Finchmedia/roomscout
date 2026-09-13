import { ConvexError, v } from "convex/values";
import { envValue } from "./env";

export type PortalBrowserProvider = "firecrawl" | "browserbase";

export const portalBrowserProviderValidator = v.union(
  v.literal("firecrawl"),
  v.literal("browserbase"),
);

type ReadEnv = (name: string) => string | undefined;

// Convex may replace the Node runtime's process.env object between invocations.
// Read dynamically instead of retaining the generated module's original object.
const defaultReadEnv: ReadEnv = (name) => envValue(name);

export function resolvePortalBrowserProvider(
  readEnv: ReadEnv = defaultReadEnv,
): PortalBrowserProvider {
  const configured = readEnv("PORTAL_BROWSER_ENGINE")?.trim().toLowerCase();
  if (!configured) return "browserbase";
  if (configured === "firecrawl" || configured === "browserbase") return configured;
  throw new ConvexError({ code: "PORTAL_BROWSER_ENGINE_INVALID" });
}

export function requirePortalBrowserProviderConfiguration(
  provider: PortalBrowserProvider = resolvePortalBrowserProvider(),
  readEnv: ReadEnv = defaultReadEnv,
): PortalBrowserProvider {
  const keyName = provider === "firecrawl" ? "FIRECRAWL_API_KEY" : "BROWSERBASE_API_KEY";
  if (!readEnv(keyName)?.trim()) {
    throw new ConvexError({
      code: provider === "firecrawl" ? "FIRECRAWL_NOT_CONFIGURED" : "BROWSERBASE_NOT_CONFIGURED",
    });
  }
  return provider;
}

export function storedPortalBrowserProvider(
  provider: PortalBrowserProvider | undefined,
): PortalBrowserProvider {
  return provider ?? "browserbase";
}
