import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** Content, not observation time: even edits that do not bump lastSeenAt invalidate a match. */
export async function signalMatchRevision(signal: Doc<"signals">): Promise<string> {
  const value = JSON.stringify({
    side: signal.side, title: signal.title, city: signal.city, district: signal.district,
    summary: signal.summary, arrangement: signal.arrangement, priceEur: signal.priceEur,
    pricePeriod: signal.pricePeriod, requirements: signal.requirements, unknowns: signal.unknowns,
    status: signal.status, verification: signal.verification, genres: signal.genres,
    instruments: signal.instruments, facets: signal.facets,
    latitude: signal.latitude, longitude: signal.longitude,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isCurrentMatch(ctx: Pick<QueryCtx, "db">, match: Doc<"signalMatches">): Promise<boolean> {
  if (match.eligible !== true) return false;
  const [need, signal] = await Promise.all([ctx.db.get(match.savedNeedId), ctx.db.get(match.signalId)]);
  return need !== null && need.ownerId === match.ownerId && need.status === "active" &&
    match.needRevision === (need.matchingRevision ?? 0) && signal?.status === "published" &&
    match.signalRevision === await signalMatchRevision(signal);
}

export async function opportunityMatchIsCurrent(ctx: Pick<QueryCtx, "db">, opportunity: Doc<"opportunities">, forContact = false): Promise<boolean> {
  if (!opportunity.signalId || opportunity.status === "expired") return false;
  const match = await ctx.db.query("signalMatches")
    .withIndex("by_saved_need_and_signal", (q) => q.eq("savedNeedId", opportunity.savedNeedId).eq("signalId", opportunity.signalId!))
    .unique();
  return match !== null && match.ownerId === opportunity.ownerId &&
    (!forContact || match.contactEligible === true) && match.status !== "dismissed" && await isCurrentMatch(ctx, match);
}
