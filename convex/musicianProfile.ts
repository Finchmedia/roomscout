import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalQuery, mutation } from "./_generated/server";
import { requireUserId } from "./integrations/authz";
import { musicianProfilePromptContext, resolveProviderIdentity, type MusicianActKind } from "./lib/musicianIdentity";

const actKindValidator = v.union(v.literal("band"), v.literal("solo"));

function requiredName(value: string, code: string) {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 80) throw new ConvexError({ code });
  return normalized;
}

function optionalName(value: string | undefined, max: number, code: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > max) throw new ConvexError({ code });
  return normalized;
}

export const getPromptContext = internalQuery({
  args: { ownerId: v.id("users") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.ownerId);
    return user?.role === "musician" ? musicianProfilePromptContext(user) : "";
  },
});

export const saveMine = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    actKind: actKindValidator,
    actName: v.optional(v.string()),
    expectedProviderDisplayName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "musician") throw new ConvexError({ code: "MUSICIAN_PROFILE_UNAVAILABLE" });

    const firstName = requiredName(args.firstName, "INVALID_FIRST_NAME");
    const lastName = optionalName(args.lastName, 80, "INVALID_LAST_NAME");
    const actName = optionalName(args.actName, 120, "INVALID_ACT_NAME");
    const confirmedAt = Date.now();
    const identity = resolveProviderIdentity({
      firstName,
      lastName,
      actKind: args.actKind as MusicianActKind,
      actName,
      providerIdentityConfirmedAt: confirmedAt,
    });
    if (!identity.complete || identity.providerDisplayName !== args.expectedProviderDisplayName) {
      throw new ConvexError({ code: "PROFILE_PREVIEW_CHANGED" });
    }

    await ctx.db.patch(userId, {
      firstName,
      lastName,
      actKind: args.actKind,
      actName,
      providerIdentityConfirmedAt: confirmedAt,
      displayName: identity.complete ? identity.representedName : undefined,
    });
    await ctx.scheduler.runAfter(0, internal.providerConversations.resumeProfileBlockedForOwner, {
      ownerId: userId,
    });
    return null;
  },
});
