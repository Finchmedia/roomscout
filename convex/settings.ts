import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireUserId } from "./integrations/authz";

/** Settings-owned profile write. Authentication identity and role are immutable here. */
export const updateDisplayName = mutation({
  args: { displayName: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const displayName = args.displayName.trim();
    if (displayName.length < 1 || displayName.length > 80) {
      throw new ConvexError({ code: "INVALID_DISPLAY_NAME" });
    }
    await ctx.db.patch(ownerId, { displayName });
    return null;
  },
});
