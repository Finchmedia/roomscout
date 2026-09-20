import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { isUserResetTombstoned } from "../devUserReset";

type DatabaseCtx = QueryCtx | MutationCtx;

export async function requireUserId(ctx: DatabaseCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError({ code: "UNAUTHENTICATED" });
  }

  const userId = ctx.db.normalizeId("users", identity.subject);
  if (userId === null || (await ctx.db.get(userId)) === null || await isUserResetTombstoned(ctx, userId)) {
    throw new ConvexError({ code: "INVALID_IDENTITY" });
  }

  return userId;
}

export async function requireOperatorId(
  ctx: DatabaseCtx,
): Promise<Id<"users">> {
  const userId = await requireUserId(ctx);
  const user = await ctx.db.get(userId);
  if (user === null || user.role !== "operator") {
    throw new ConvexError({ code: "FORBIDDEN" });
  }
  return userId;
}

export async function requireActionUserId(
  ctx: Pick<ActionCtx, "auth" | "runQuery">,
): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError({ code: "UNAUTHENTICATED" });
  }
  const userId = await ctx.runQuery(internal.users.resolveAuthSubject, {
    subject: identity.subject,
  });
  // resolveAuthSubject already rejects unknown and tombstoned (dev-reset) users.
  // The demo-reset pause (devUserReset.userMayRunWork) gates scheduled workers
  // only; the owner's own actions keep working while their data is wiped.
  if (userId === null) {
    throw new ConvexError({ code: "INVALID_IDENTITY" });
  }
  return userId;
}
