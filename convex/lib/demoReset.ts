import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** The owner's newest demo reset; `startMine` only inserts after the previous one completed. */
export async function latestDemoReset(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
): Promise<Doc<"demoResets"> | null> {
  return await ctx.db
    .query("demoResets")
    .withIndex("by_owner_and_created_at", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .first();
}

/**
 * A scheduled or running reset whose pager has not written for this long is
 * stalled (its scheduled chain died): `startMine` resumes it and the Settings
 * button offers the restart. A healthy reset patches its row on every page.
 */
export const DEMO_RESET_STALL_MS = 30_000;

export function isDemoResetStalled(
  reset: Pick<Doc<"demoResets">, "status" | "updatedAt">,
  now: number,
): boolean {
  return reset.status !== "completed" && now - reset.updatedAt >= DEMO_RESET_STALL_MS;
}

/** True while a demo reset is scheduled or running for the owner; workers must not write on their behalf. */
export async function hasActiveDemoReset(
  ctx: Pick<QueryCtx, "db">,
  ownerId: Id<"users">,
): Promise<boolean> {
  const latest = await latestDemoReset(ctx, ownerId);
  return latest !== null && latest.status !== "completed";
}
