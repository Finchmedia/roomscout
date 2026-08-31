"use node";

import Firecrawl from "firecrawl";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action, type ActionCtx } from "./_generated/server";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";

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
    const firecrawl = new Firecrawl({ apiKey, timeoutMs: 60_000, maxRetries: 1 });
    const check = await firecrawl.runMonitor(target.providerMonitorId);
    return { checkId: check.id, status: check.status };
  },
});
