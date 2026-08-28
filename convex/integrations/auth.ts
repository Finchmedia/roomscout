import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthContext = Pick<QueryCtx, "auth">;

export async function authenticatedUserId(
  ctx: AuthContext,
): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError({ code: "UNAUTHENTICATED" });
  }

  return identity.subject as Id<"users">;
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    throw new ConvexError({ code: "UNAUTHENTICATED" });
  }

  const userId = ctx.db.normalizeId("users", identity.subject);
  if (userId === null || (await ctx.db.get(userId)) === null) {
    throw new ConvexError({ code: "USER_NOT_FOUND" });
  }

  return userId;
}
