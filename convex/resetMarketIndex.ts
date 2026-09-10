import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertFleetReset, FLEET_RESET_CONFIRMATION } from "./devUserReset";
import { envValue } from "./integrations/env";

const args = {
  signalIds: v.array(v.id("signals")),
  keepCanonicalUrl: v.string(),
  confirmation: v.literal(FLEET_RESET_CONFIRMATION),
};

function guard() {
  assertFleetReset({ cloudUrl: envValue("CONVEX_CLOUD_URL"), siteUrl: envValue("CONVEX_SITE_URL") });
}

function validateInput(input: { signalIds: unknown[]; keepCanonicalUrl: string }) {
  if (!/^https:\/\/roomscout\.dev\/listings\/[A-Za-z0-9_-]+$/.test(input.keepCanonicalUrl)) throw new ConvexError({ code: "MARKET_RESET_INVALID_KEEP_URL" });
  if (!input.signalIds.length || input.signalIds.length > 100 || new Set(input.signalIds.map(String)).size !== input.signalIds.length) throw new ConvexError({ code: "MARKET_RESET_INVALID_SIGNAL_SET" });
}

export const preview = internalQuery({
  args,
  returns: v.array(v.object({ signalId: v.id("signals"), sourceEntryId: v.id("sourceEntries"), canonicalUrl: v.string(), status: v.string() })),
  handler: async (ctx, input) => {
    guard();
    validateInput(input);
    const rows = [];
    for (const signalId of input.signalIds) {
      const signal = await ctx.db.get(signalId);
      if (!signal?.sourceEntryId) throw new ConvexError({ code: "MARKET_RESET_SIGNAL_PROVENANCE_REQUIRED", signalId });
      const entry = await ctx.db.get(signal.sourceEntryId);
      if (!entry || entry.signalId !== signalId) throw new ConvexError({ code: "MARKET_RESET_PROVENANCE_MISMATCH", signalId });
      if (entry.canonicalUrl === input.keepCanonicalUrl) throw new ConvexError({ code: "MARKET_RESET_KEEP_SIGNAL_FORBIDDEN", signalId });
      rows.push({ signalId, sourceEntryId: entry._id, canonicalUrl: entry.canonicalUrl, status: signal.status });
    }
    return rows;
  },
});

export const retire = internalMutation({
  args,
  returns: v.object({ retiredSignals: v.number(), retiredEntries: v.number(), deletedMatches: v.number(), deletedOpportunities: v.number(), cancelledActionRequests: v.number() }),
  handler: async (ctx, input) => {
    guard();
    validateInput(input);
    const rows = [];
    for (const signalId of input.signalIds) {
      const signal = await ctx.db.get(signalId);
      if (!signal?.sourceEntryId) throw new ConvexError({ code: "MARKET_RESET_SIGNAL_PROVENANCE_REQUIRED" });
      const entry = await ctx.db.get(signal.sourceEntryId);
      if (!entry || entry.signalId !== signalId || entry.canonicalUrl === input.keepCanonicalUrl) throw new ConvexError({ code: "MARKET_RESET_PROVENANCE_MISMATCH" });
      rows.push({ signal, entry });
    }
    const now = Date.now();
    for (const { signal, entry } of rows) {
      await ctx.db.patch(signal._id, { status: "removed", lastSeenAt: now });
      await ctx.db.patch(entry._id, { status: "removed", detailState: "none", nextDetailAttemptAt: undefined, detailLeaseId: undefined, detailLeaseExpiresAt: undefined, updatedAt: now });
      await ctx.scheduler.runAfter(0, internal.matches.retireSignalMatches, { signalId: signal._id, cursor: null });
    }
    return { retiredSignals: rows.length, retiredEntries: rows.length, deletedMatches: 0, deletedOpportunities: 0, cancelledActionRequests: 0 };
  },
});
