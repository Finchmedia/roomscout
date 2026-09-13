"use node";

import { Browserbase } from "@browserbasehq/sdk";
import { ConvexError, v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import {
  assertDevelopmentReset,
  DEV_RESET_CONFIRMATION,
  FLEET_RESET_CONFIRMATION,
  assertFleetReset,
} from "./devUserReset";
import { envValue } from "./integrations/env";

type Preflight = {
  userId: Id<"users">;
  username: string;
  providerInboxId?: string;
  providerContextIds: string[];
  providerContexts: Array<{
    providerContextId: string;
    browserProvider: "firecrawl" | "browserbase";
  }>;
  portalConnectionCount: number;
};

type ResetSelectedTestUserResult = {
  resetId: Id<"devUserResets">;
  status: "scheduled";
  providerInboxResult: "not_present" | "deleted" | "already_absent";
  providerContextCount: number;
  providerBrowserbaseContextDeletedCount: number;
  providerFirecrawlProfileRetainedCount: number;
  portalAccountDeletion: "unsupported_by_controlled_portal";
  authCredentialCleanup: "orphaned_password_and_sessions_unsupported";
};

export type ProviderCleanupOperations = {
  deleteInbox: (inboxId: string) => Promise<"deleted" | "already_absent">;
  deleteBrowserContext: (contextId: string) => Promise<void>;
};

export async function deleteProviderResources(
  plan: Pick<Preflight, "providerInboxId" | "providerContextIds"> & Partial<Pick<Preflight, "providerContexts">>,
  operations: ProviderCleanupOperations,
): Promise<{
  providerInboxResult: "not_present" | "deleted" | "already_absent";
  providerContextCount: number;
  providerBrowserbaseContextDeletedCount: number;
  providerFirecrawlProfileRetainedCount: number;
}> {
  const providerInboxResult = plan.providerInboxId
    ? await operations.deleteInbox(plan.providerInboxId)
    : "not_present";
  const providerContexts = plan.providerContexts ?? plan.providerContextIds.map(
    (providerContextId) => ({ providerContextId, browserProvider: "browserbase" as const }),
  );
  let providerBrowserbaseContextDeletedCount = 0;
  let providerFirecrawlProfileRetainedCount = 0;
  for (const context of providerContexts) {
    if (context.browserProvider === "firecrawl") {
      providerFirecrawlProfileRetainedCount += 1;
      continue;
    }
    await operations.deleteBrowserContext(context.providerContextId);
    providerBrowserbaseContextDeletedCount += 1;
  }
  return {
    providerInboxResult,
    providerContextCount: providerContexts.length,
    providerBrowserbaseContextDeletedCount,
    providerFirecrawlProfileRetainedCount,
  };
}

function isAlreadyAbsent(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as Error & { status?: unknown }).status;
  return status === 404 || /(?:error|status)\s+404\b/i.test(error.message);
}

async function deleteBrowserbaseContext(
  client: Browserbase,
  contextId: string,
): Promise<void> {
  try {
    await client.contexts.delete(contextId);
  } catch (error) {
    if (!isAlreadyAbsent(error)) throw error;
  }
}

async function preflight(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    username: string;
    confirmation: typeof DEV_RESET_CONFIRMATION;
  },
): Promise<Preflight> {
  return await ctx.runQuery(internal.devUserReset.preflight, args);
}

export const resetSelectedTestUser = internalAction({
  args: {
    userId: v.id("users"),
    username: v.string(),
    confirmation: v.literal(DEV_RESET_CONFIRMATION),
  },
  returns: v.object({
    resetId: v.id("devUserResets"),
    status: v.literal("scheduled"),
    providerInboxResult: v.union(
      v.literal("not_present"),
      v.literal("deleted"),
      v.literal("already_absent"),
    ),
    providerContextCount: v.number(),
    providerBrowserbaseContextDeletedCount: v.number(),
    providerFirecrawlProfileRetainedCount: v.number(),
    portalAccountDeletion: v.literal("unsupported_by_controlled_portal"),
    authCredentialCleanup: v.literal("orphaned_password_and_sessions_unsupported"),
  }),
  handler: async (ctx, args): Promise<ResetSelectedTestUserResult> => {
    assertDevelopmentReset({
      cloudUrl: envValue("CONVEX_CLOUD_URL"),
      siteUrl: envValue("CONVEX_SITE_URL"),
    });
    const plan = await preflight(ctx, args);
    const apiKey = envValue("BROWSERBASE_API_KEY");
    if (plan.providerContexts.some((context) => context.browserProvider === "browserbase") && !apiKey) {
      throw new ConvexError({ code: "DEV_USER_RESET_BROWSERBASE_NOT_CONFIGURED" });
    }
    const browserbase = apiKey ? new Browserbase({ apiKey }) : null;
    let providerResult: {
      providerInboxResult: "not_present" | "deleted" | "already_absent";
      providerContextCount: number;
      providerBrowserbaseContextDeletedCount: number;
      providerFirecrawlProfileRetainedCount: number;
    };
    try {
      providerResult = await deleteProviderResources(plan, {
        deleteInbox: async (inboxId) =>
          await ctx.runAction(internal.agentmailComponent.deleteInbox, { inboxId }),
        deleteBrowserContext: async (contextId) => {
          if (!browserbase) {
            throw new Error("Browserbase is not configured.");
          }
          await deleteBrowserbaseContext(browserbase, contextId);
        },
      });
    } catch {
      throw new ConvexError({
        code: "DEV_USER_RESET_PROVIDER_DELETE_FAILED",
      });
    }
    const resetId: Id<"devUserResets"> = await ctx.runMutation(
      internal.devUserReset.authorizeCleanup,
      {
        ...args,
        providerInboxResult: providerResult.providerInboxResult,
        providerContextCount: providerResult.providerContextCount,
      },
    );
    return {
      resetId,
      status: "scheduled" as const,
      ...providerResult,
      portalAccountDeletion: "unsupported_by_controlled_portal" as const,
      authCredentialCleanup:
        "orphaned_password_and_sessions_unsupported" as const,
    };
  },
});

export const beginExactTestUserReset = internalAction({
  args: { targets: v.array(v.object({ userId: v.id("users"), username: v.string() })), confirmation: v.literal(DEV_RESET_CONFIRMATION) },
  returns: v.array(v.object({ userId: v.id("users"), resetId: v.id("devUserResets") })),
  handler: async (ctx, args): Promise<Array<{ userId: Id<"users">; resetId: Id<"devUserResets"> }>> => {
    assertDevelopmentReset({ cloudUrl: envValue("CONVEX_CLOUD_URL"), siteUrl: envValue("CONVEX_SITE_URL") });
    await ctx.runQuery(internal.devUserReset.previewExactTargets, args);
    for (const target of args.targets) {
      const paused = await ctx.runMutation(internal.devUserReset.pauseExactTarget, { ...target, confirmation: args.confirmation });
      if (!paused.ready) throw new ConvexError({ code: "DEV_USER_RESET_IN_FLIGHT_WORK" });
    }
    const result = [];
    for (const target of args.targets) {
      const reset: ResetSelectedTestUserResult = await ctx.runAction(internal.devUserResetActions.resetSelectedTestUser, { ...target, confirmation: args.confirmation });
      result.push({ userId: target.userId, resetId: reset.resetId });
    }
    return result;
  },
});

export const beginExactFleetUserReset = internalAction({
  args: { targets: v.array(v.object({ userId: v.id("users"), username: v.string() })), confirmation: v.literal(FLEET_RESET_CONFIRMATION) },
  returns: v.array(v.object({ userId: v.id("users"), resetId: v.id("devUserResets"), authCredentialCleanup: v.literal("username_tombstoned_core_credentials_unsupported") })),
  handler: async (ctx, args): Promise<Array<{ userId: Id<"users">; resetId: Id<"devUserResets">; authCredentialCleanup: "username_tombstoned_core_credentials_unsupported" }>> => {
    assertFleetReset({ cloudUrl: envValue("CONVEX_CLOUD_URL"), siteUrl: envValue("CONVEX_SITE_URL") });
    const preview = await ctx.runQuery(internal.devUserReset.previewExactTargets, args);
    for (const target of preview) await ctx.runMutation(internal.devUserReset.createFleetResetIntent, { userId: target.userId, username: target.username, confirmation: args.confirmation });
    for (const target of preview) {
      const paused = await ctx.runMutation(internal.devUserReset.pauseExactTarget, { userId: target.userId, username: target.username, confirmation: args.confirmation });
      if (!paused.ready) throw new ConvexError({ code: "FLEET_USER_RESET_IN_FLIGHT_WORK" });
    }
    const apiKey = envValue("BROWSERBASE_API_KEY");
    if (preview.some((target: { providerContexts: Array<{ browserProvider: "firecrawl" | "browserbase" }> }) =>
      target.providerContexts.some((context: { browserProvider: "firecrawl" | "browserbase" }) => context.browserProvider === "browserbase")) && !apiKey) {
      throw new ConvexError({ code: "FLEET_USER_RESET_BROWSERBASE_NOT_CONFIGURED" });
    }
    const browserbase = apiKey ? new Browserbase({ apiKey }) : null;
    const result = [];
    for (const target of preview) {
      let providerResult: Awaited<ReturnType<typeof deleteProviderResources>>;
      try {
        providerResult = await deleteProviderResources(target, {
          deleteInbox: async (inboxId) => await ctx.runAction(internal.agentmailComponent.deleteInbox, { inboxId }),
          deleteBrowserContext: async (contextId) => {
            if (!browserbase) throw new Error("Browserbase is not configured.");
            await deleteBrowserbaseContext(browserbase, contextId);
          },
        });
      } catch {
        throw new ConvexError({ code: "FLEET_USER_RESET_PROVIDER_DELETE_FAILED" });
      }
      for (const threadId of target.agentThreadIds) {
        await ctx.runAction(components.agent.threads.deleteAllForThreadIdSync, { threadId: threadId as never });
      }
      const resetId: Id<"devUserResets"> = await ctx.runMutation(internal.devUserReset.authorizeFleetCleanup, { userId: target.userId, username: target.username, confirmation: args.confirmation, providerInboxResult: providerResult.providerInboxResult, providerContextCount: providerResult.providerContextCount });
      result.push({ userId: target.userId, resetId, authCredentialCleanup: "username_tombstoned_core_credentials_unsupported" as const });
    }
    return result;
  },
});
