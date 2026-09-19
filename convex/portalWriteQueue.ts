/**
 * One admission path for approved portal writes into the shared browser pool.
 * Queue position, not the execution deadline, absorbs waiting: nothing is
 * claimed here, execution claims are taken inside the worker once the pool
 * actually runs it.
 */
import { vOnCompleteArgs } from "@convex-dev/workpool";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { portalBrowserProviderValidator, type PortalBrowserProvider } from "./integrations/portalBrowserEngine";
import { browserWorkpool } from "./workpools";

const writeContextValidator = v.object({
  ownerId: v.id("users"),
  requestId: v.id("actionRequests"),
  browserProvider: portalBrowserProviderValidator,
});

export async function enqueueApprovedPortalWrite(ctx: MutationCtx, input: {
  ownerId: Id<"users">; requestId: Id<"actionRequests">; browserProvider: PortalBrowserProvider; busyAttempt?: number;
}): Promise<void> {
  const worker = input.browserProvider === "firecrawl"
    ? internal.firecrawlPortal.executeApprovedWriteWorker
    : internal.browserbasePortal.executeApprovedWriteWorker;
  const { ownerId, requestId, browserProvider, busyAttempt } = input;
  // retry: false is deliberate. A browser write is never replayed by the pool.
  await browserWorkpool.enqueueAction(ctx, worker, {
    ownerId, requestId, ...(busyAttempt !== undefined ? { busyAttempt } : {}),
  }, {
    retry: false,
    onComplete: internal.portalWriteQueue.writeCompleted,
    context: { ownerId, requestId, browserProvider },
  });
}

/**
 * A failed or canceled pool result does not prove the write did not happen, so
 * this only logs. The execution ledger, the worker's own in-action release and
 * the stale-execution reaper own the request state.
 */
export const writeCompleted = internalMutation({
  args: vOnCompleteArgs(writeContextValidator, v.any()),
  returns: v.null(),
  handler: async (_ctx, { context, result }) => {
    if (result.kind === "failed" || result.kind === "canceled") {
      console.warn("PORTAL_WRITE_POOL_RESULT", {
        requestId: context.requestId, kind: result.kind,
        error: result.kind === "failed" ? result.error.slice(0, 200) : undefined,
      });
    }
    return null;
  },
});
