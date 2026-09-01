"use node";

import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import { FirecrawlRoomScoutClient } from "./components/firecrawlRoomScout/client";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";
import { deriveProviderReadiness } from "./integrations/providerReadiness";

const firecrawl = new FirecrawlRoomScoutClient(components.firecrawlRoomScout);

async function requireActionOperator(ctx: ActionCtx) {
  const userId = await requireActionUserId(ctx);
  const allowed = await ctx.runQuery(internal.users.isOperatorInternal, { userId });
  if (!allowed) throw new ConvexError({ code: "FORBIDDEN" });
}

export const runMonitorNow = action({
  args: { sourceTargetId: v.id("sourceTargets") },
  returns: v.object({ checkId: v.string(), status: v.string() }),
  handler: async (ctx, args): Promise<{ checkId: string; status: string }> => {
    await requireActionOperator(ctx);
    if (envValue("FIRECRAWL_MONITORS_ENABLED") !== "true") {
      throw new ConvexError({ code: "FIRECRAWL_MONITORS_DISABLED" });
    }
    const apiKey = envValue("FIRECRAWL_API_KEY");
    if (!apiKey) throw new ConvexError({ code: "FIRECRAWL_NOT_CONFIGURED" });
    const target = await ctx.runQuery(internal.sourceRegistry.getTargetForRun, args);
    if (!target) throw new ConvexError({ code: "ACTIVE_MONITOR_NOT_FOUND" });
    const check = await firecrawl.runMonitor(ctx, target.providerMonitorId);
    return { checkId: check.id, status: check.status };
  },
});

const providerStatus = v.union(
  v.literal("configured"),
  v.literal("incomplete"),
  v.literal("disabled"),
  v.literal("client_only"),
);

const reasons = v.array(v.string());

export const providerReadiness = action({
  args: {},
  returns: v.object({
    overallStatus: v.union(v.literal("configured"), v.literal("incomplete")),
    configuredProviders: v.number(),
    serverProviderCount: v.number(),
    firecrawl: v.object({
      status: providerStatus,
      apiKeyConfigured: v.boolean(),
      webhookSecretConfigured: v.boolean(),
      monitorWebhookBearerConfigured: v.boolean(),
      webhookUrlConfigured: v.boolean(),
      webhookUrlValid: v.boolean(),
      monitorsEnabled: v.boolean(),
      reasons,
    }),
    agentmail: v.object({
      status: providerStatus,
      apiKeyConfigured: v.boolean(),
      webhookSecretConfigured: v.boolean(),
      addressSaltConfigured: v.boolean(),
      customDomainConfigured: v.boolean(),
      reasons,
    }),
    browserbase: v.object({
      status: providerStatus,
      apiKeyConfigured: v.boolean(),
      credentialPresenceOnly: v.boolean(),
      reasons,
    }),
    mapbox: v.object({
      status: providerStatus,
      serverTokenConfigured: v.boolean(),
      reasons,
    }),
    openaiDirect: v.object({
      status: providerStatus,
      apiKeyConfigured: v.boolean(),
      realtimeOriginsConfigured: v.boolean(),
      realtimeOriginsValid: v.boolean(),
      productionOriginConfigured: v.boolean(),
      reasons,
    }),
    frontendMapbox: v.object({
      status: providerStatus,
      backendInspectable: v.boolean(),
      reasons,
    }),
  }),
  handler: async (ctx) => {
    await requireActionOperator(ctx);
    return deriveProviderReadiness(envValue);
  },
});
