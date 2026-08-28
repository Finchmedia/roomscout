import { query } from "./_generated/server";
import { v } from "convex/values";

export const status = query({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    service: v.literal("roomscout"),
  }),
  handler: async () => ({ ok: true, service: "roomscout" as const }),
});
