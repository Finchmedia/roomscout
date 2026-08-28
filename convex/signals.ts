import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";

const signalSide = v.union(v.literal("supply"), v.literal("demand"));
const signalStatus = v.union(v.literal("published"), v.literal("stale"));

const signalProjectionValidator = v.object({
  _id: v.id("signals"),
  side: signalSide,
  title: v.string(),
  city: v.string(),
  district: v.optional(v.string()),
  summary: v.string(),
  arrangement: v.union(
    v.literal("permanent"),
    v.literal("shared"),
    v.literal("hourly"),
    v.literal("unknown"),
  ),
  priceEur: v.optional(v.number()),
  pricePeriod: v.optional(
    v.union(v.literal("hour"), v.literal("month"), v.literal("unknown")),
  ),
  requirements: v.array(v.string()),
  unknowns: v.array(v.string()),
  status: signalStatus,
  verification: v.union(
    v.literal("observed"),
    v.literal("verified"),
    v.literal("conflicting"),
  ),
  sourceCount: v.number(),
  firstSeenAt: v.number(),
  lastSeenAt: v.number(),
  publishedAt: v.optional(v.number()),
});

const evidenceProjectionValidator = v.object({
  _id: v.id("signalEvidence"),
  sourceName: v.string(),
  sourceUrl: v.string(),
  sourceTitle: v.string(),
  excerpt: v.string(),
  observedAt: v.number(),
});

function projectSignal(signal: Doc<"signals">) {
  if (signal.status !== "published" && signal.status !== "stale") {
    throw new Error("A non-public signal reached the public projection");
  }
  return {
    _id: signal._id,
    side: signal.side,
    title: signal.title,
    city: signal.city,
    district: signal.district,
    summary: signal.summary,
    arrangement: signal.arrangement,
    priceEur: signal.priceEur,
    pricePeriod: signal.pricePeriod,
    requirements: signal.requirements,
    unknowns: signal.unknowns,
    status: signal.status,
    verification: signal.verification,
    sourceCount: signal.sourceCount,
    firstSeenAt: signal.firstSeenAt,
    lastSeenAt: signal.lastSeenAt,
    publishedAt: signal.publishedAt,
  };
}

async function takeForStatus(
  ctx: QueryCtx,
  input: {
    city?: string;
    side?: "supply" | "demand";
    status: "published" | "stale";
    take: number;
  },
) {
  if (input.city && input.side) {
    return await ctx.db
      .query("signals")
      .withIndex("by_side_and_city_and_status", (q) =>
        q
          .eq("side", input.side!)
          .eq("city", input.city!)
          .eq("status", input.status),
      )
      .order("desc")
      .take(input.take);
  }
  if (input.city) {
    return await ctx.db
      .query("signals")
      .withIndex("by_city_and_status", (q) =>
        q.eq("city", input.city!).eq("status", input.status),
      )
      .order("desc")
      .take(input.take);
  }

  const candidates = await ctx.db
    .query("signals")
    .withIndex("by_status_and_last_seen_at", (q) =>
      q.eq("status", input.status),
    )
    .order("desc")
    .take(input.take);
  return input.side
    ? candidates.filter((signal) => signal.side === input.side)
    : candidates;
}

export const list = query({
  args: {
    city: v.optional(v.string()),
    side: v.optional(signalSide),
    limit: v.optional(v.number()),
  },
  returns: v.array(signalProjectionValidator),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 24), 50));
    const city = args.city?.trim() || undefined;
    const candidateLimit = Math.min(limit * 3, 100);
    const [published, stale] = await Promise.all([
      takeForStatus(ctx, {
        city,
        side: args.side,
        status: "published",
        take: candidateLimit,
      }),
      takeForStatus(ctx, {
        city,
        side: args.side,
        status: "stale",
        take: candidateLimit,
      }),
    ]);

    return [...published, ...stale]
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt)
      .slice(0, limit)
      .map(projectSignal);
  },
});

export const get = query({
  args: { signalId: v.id("signals") },
  returns: v.union(
    v.object({
      signal: signalProjectionValidator,
      evidence: v.array(evidenceProjectionValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (
      signal === null ||
      (signal.status !== "published" && signal.status !== "stale")
    ) {
      return null;
    }

    const evidence = await ctx.db
      .query("signalEvidence")
      .withIndex("by_signal", (q) => q.eq("signalId", signal._id))
      .order("desc")
      .take(12);
    const projectedEvidence = await Promise.all(
      evidence.map(async (item) => {
        const source = await ctx.db.get(item.sourceId);
        return {
          _id: item._id,
          sourceName: source?.name ?? "Unknown source",
          sourceUrl: item.sourceUrl,
          sourceTitle: item.sourceTitle,
          excerpt: item.excerpt,
          observedAt: item.observedAt,
        };
      }),
    );

    return { signal: projectSignal(signal), evidence: projectedEvidence };
  },
});

export const requirePublic = query({
  args: { signalId: v.id("signals") },
  returns: signalProjectionValidator,
  handler: async (ctx, args) => {
    const signal = await ctx.db.get(args.signalId);
    if (
      signal === null ||
      (signal.status !== "published" && signal.status !== "stale")
    ) {
      throw new ConvexError({ code: "SIGNAL_NOT_FOUND" });
    }
    return projectSignal(signal);
  },
});
