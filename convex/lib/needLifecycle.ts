import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** All edits/status changes invalidate old async work in the same transaction. */
export async function refreshNeedMatching(ctx: MutationCtx, need: Doc<"savedNeeds">) {
  const revision = (need.matchingRevision ?? 0) + 1;
  await ctx.db.patch(need._id, { matchingRevision: revision, matchingRunId: undefined });
  await ctx.scheduler.runAfter(0, internal.matches.retireNeedMatches, {
    ownerId: need.ownerId, savedNeedId: need._id, needRevision: revision, cursor: null,
  });
  if (need.status === "active") {
    await ctx.scheduler.runAfter(0, internal.matches.recomputeNeed, {
      ownerId: need.ownerId, savedNeedId: need._id,
    });
  }
}

export async function setNeedStatus(ctx: MutationCtx, need: Doc<"savedNeeds">, status: Doc<"savedNeeds">["status"]) {
  if (need.status === "archived" && status !== "archived") throw new ConvexError({ code: "NEED_ARCHIVED" });
  if (status === "active" && !need.city.trim()) throw new ConvexError({ code: "INCOMPLETE_NEED" });
  // Retrying activation is a no-op; the original transaction already queued matching.
  if (need.status === status) return;
  await ctx.db.patch(need._id, { status, updatedAt: Date.now() });
  await refreshNeedMatching(ctx, { ...need, status });
}
