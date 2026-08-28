import { ConvexError, v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

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
