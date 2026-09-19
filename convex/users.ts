import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { isUserResetTombstoned } from "./devUserReset";
import { resolveProviderIdentity } from "./lib/musicianIdentity";

const currentUserValidator = v.object({
  _id: v.id("users"),
  username: v.string(),
  displayName: v.optional(v.string()),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  actKind: v.optional(v.union(v.literal("band"), v.literal("solo"))),
  actName: v.optional(v.string()),
  profileCompleted: v.boolean(),
  providerDisplayName: v.union(v.string(), v.null()),
  representedName: v.union(v.string(), v.null()),
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
    const userId = await ctx.db.insert("users", {
      username,
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    await Promise.all([
      ctx.scheduler.runAfter(0, internal.mailboxes.provisionAfterSignup, {
        ownerId: userId,
        attempt: 0,
      }),
      ctx.scheduler.runAfter(
        0,
        internal.demoSourceBootstrap.bootstrapControlledDemoForOwner,
        { ownerId: userId },
      ),
    ]);
    return userId;
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
    if (!(await ctx.db.get(args.userId)) || await isUserResetTombstoned(ctx, args.userId)) {
      throw new ConvexError({ code: "USER_NOT_FOUND" });
    }
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
    const reset = await ctx.db.query("devUserResets").withIndex("by_target_user", (q) => q.eq("targetUserId", userId)).first();
    if (reset) return null;
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

    const providerIdentity = resolveProviderIdentity(user);
    return {
      _id: user._id,
      username: user.username,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      actKind: user.actKind,
      actName: user.actName,
      profileCompleted: providerIdentity.complete,
      providerDisplayName: providerIdentity.complete ? providerIdentity.providerDisplayName : null,
      representedName: providerIdentity.complete ? providerIdentity.representedName : null,
      role: user.role,
    };
  },
});
