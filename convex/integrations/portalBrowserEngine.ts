import { ConvexError, v } from "convex/values";
import { env } from "../_generated/server";
import { envValue } from "./env";

export type PortalBrowserProvider = "firecrawl" | "browserbase";

export const portalBrowserProviderValidator = v.union(
  v.literal("firecrawl"),
  v.literal("browserbase"),
);

type ReadEnv = (name: string) => string | undefined;

const defaultReadEnv: ReadEnv = (name) =>
  name === "PORTAL_BROWSER_ENGINE" ? env.PORTAL_BROWSER_ENGINE : envValue(name);

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
