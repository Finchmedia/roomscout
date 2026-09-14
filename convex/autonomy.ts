/**
 * Handlungsspielraum per user — the one row (`scoutAutonomy`) that says how
 * independently the Scout works across every Suchauftrag (ADR 0001, 0002).
 *
 * A user without a row gets `DEFAULT_AUTONOMY_RULES` at version 0; every save
 * bumps the version, rehashes the rules and writes an audit event so a later
 * Freigabeprüfung can pin the exact rule version it acted on.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireUserId } from "./integrations/authz";
import {
  DEFAULT_AUTONOMY_RULES,
  autonomyHash,
  autonomyRulesValidator,
  normalizeAutonomyRules,
  type AutonomyRules,
} from "./lib/autonomy";

const autonomyStateValidator = v.object({
  rules: autonomyRulesValidator,
  version: v.number(),
  contentHash: v.string(),
  updatedAt: v.union(v.number(), v.null()),
});

export type AutonomyState = {
  rules: AutonomyRules;
  version: number;
  contentHash: string;
  updatedAt: number | null;
};

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

/** The owner's rules, or the defaults (version 0, no row) — for the gate and the settings page alike. */
export async function loadAutonomyForOwner(
  ctx: DbCtx,
  ownerId: Id<"users">,
): Promise<AutonomyState> {
  const row = await ctx.db
    .query("scoutAutonomy")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .unique();
  if (row === null) {
    return {
      rules: DEFAULT_AUTONOMY_RULES,
      version: 0,
      contentHash: await autonomyHash(DEFAULT_AUTONOMY_RULES),
      updatedAt: null,
    };
  }
  return {
    rules: normalizeAutonomyRules(row),
    version: row.version,
    contentHash: row.contentHash,
    updatedAt: row.updatedAt,
  };
}

export const getMine = query({
  args: {},
  returns: autonomyStateValidator,
  handler: async (ctx) => {
    const ownerId = await requireUserId(ctx);
    return loadAutonomyForOwner(ctx, ownerId);
  },
});

export const getForOwner = internalQuery({
  args: { ownerId: v.id("users") },
  returns: autonomyStateValidator,
  handler: async (ctx, args) => loadAutonomyForOwner(ctx, args.ownerId),
});

export const save = mutation({
  args: { rules: autonomyRulesValidator },
  returns: v.object({ version: v.number(), contentHash: v.string() }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const rules = normalizeAutonomyRules(args.rules);
    const now = Date.now();
    const existing = await ctx.db
      .query("scoutAutonomy")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    const version = (existing?.version ?? 0) + 1;
    const contentHash = await autonomyHash(rules);

    if (existing === null) {
      await ctx.db.insert("scoutAutonomy", {
        ownerId,
        ...rules,
        version,
        contentHash,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.patch(existing._id, {
        ...rules,
        version,
        contentHash,
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditEvents", {
      eventKey: `autonomy:${ownerId}:${version}`,
      actorType: "user",
      actorUserId: ownerId,
      entityKey: `autonomy:${ownerId}`,
      eventType: "autonomy.updated",
      beforeHash: existing?.contentHash,
      afterHash: contentHash,
      summary: `Handlungsspielraum aktualisiert (Version ${version}, Modus ${rules.mode === "autopilot" ? "Autopilot" : "Rücksprache"})`,
      occurredAt: now,
    });

    return { version, contentHash };
  },
});
