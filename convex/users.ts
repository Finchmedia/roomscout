import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

const currentUserValidator = v.object({
  _id: v.id("users"),
  username: v.string(),
  displayName: v.optional(v.string()),
  role: v.union(v.literal("musician"), v.literal("operator")),
});

export const createUserPassword = internalMutation({
  args: {
    provider: v.literal("password"),
    providerAccountId: v.string(),
    profile: v.object({ username: v.string() }),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const username = args.profile.username.trim();
    if (username.length === 0) {
      throw new ConvexError({ code: "INVALID_USERNAME" });
    }

    const now = Date.now();
    return await ctx.db.insert("users", {
      username,
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
  },
});

export const onSignInPassword = internalMutation({
  args: {
    provider: v.literal("password"),
    providerAccountId: v.string(),
    profile: v.object({ username: v.string() }),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastSeenAt: Date.now(),
    });
    return null;
  },
});

// Intentionally internal: operator access can only be granted from trusted
// backend tooling or the Convex dashboard, never by a client mutation.
export const promoteToOperator = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (user === null) {
      throw new ConvexError({ code: "USER_NOT_FOUND" });
    }
    if (user.role !== "operator") {
      await ctx.db.patch(args.userId, { role: "operator" });
    }
    return null;
  },
});

export const isOperatorInternal = internalQuery({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => (await ctx.db.get(args.userId))?.role === "operator",
});

export const resolveAuthSubject = internalQuery({
  args: { subject: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const userId = ctx.db.normalizeId("users", args.subject);
    if (userId === null || (await ctx.db.get(userId)) === null) {
      return null;
    }
    return userId;
  },
});

export const current = query({
  args: {},
  returns: v.union(currentUserValidator, v.null()),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const userId = ctx.db.normalizeId("users", identity.subject);
    if (userId === null) {
      return null;
    }

    const user = await ctx.db.get(userId);
    if (user === null) {
      return null;
    }

    return {
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    };
  },
});
