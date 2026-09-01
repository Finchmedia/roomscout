import { ConvexError, v } from "convex/values";
import { contentHash } from "./integrations/contentHash";
import { requireUserId } from "./integrations/authz";
import { mutation, query } from "./_generated/server";

const modeValidator = v.union(
  v.literal("guided"),
  v.literal("research_autopilot"),
  v.literal("outreach_autopilot"),
  v.literal("negotiation_autopilot"),
);
const statusValidator = v.union(
  v.literal("draft"),
  v.literal("active"),
  v.literal("superseded"),
  v.literal("revoked"),
  v.literal("expired"),
);
const actionTypeValidator = v.union(
  v.literal("send_email"),
  v.literal("submit_webform"),
  v.literal("send_platform_dm"),
  v.literal("create_portal_account"),
  v.literal("publish_listing"),
  v.literal("share_contact_details"),
  v.literal("propose_visit_time"),
);
const personalDataValidator = v.union(
  v.literal("band_name"),
  v.literal("member_first_names"),
  v.literal("reply_email"),
  v.literal("phone"),
  v.literal("precise_location"),
  v.literal("availability"),
  v.literal("budget"),
  v.literal("music_profile"),
);

const mandateValidator = v.object({
  _id: v.id("searchMandates"),
  savedNeedId: v.id("savedNeeds"),
  version: v.number(),
  supersedesMandateId: v.optional(v.id("searchMandates")),
  mode: modeValidator,
  status: statusValidator,
  platformIds: v.array(v.id("sourcePlatforms")),
  allowedActionTypes: v.array(actionTypeValidator),
  allowedPersonalData: v.array(personalDataValidator),
  maxContactsPerDay: v.number(),
  maxBrowserMinutesPerDay: v.number(),
  maxMonthlyPriceEur: v.optional(v.number()),
  expiresAt: v.number(),
  stopOnComplaint: v.boolean(),
  stopWhenSuitableRoomConfirmed: v.boolean(),
  commitmentBoundary: v.optional(v.literal("non_binding_outreach_only")),
  contentHash: v.string(),
  activatedAt: v.optional(v.number()),
  stoppedAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

function publicMandate(row: {
  _id: import("./_generated/dataModel").Id<"searchMandates">;
  savedNeedId: import("./_generated/dataModel").Id<"savedNeeds">;
  version: number;
  supersedesMandateId?: import("./_generated/dataModel").Id<"searchMandates">;
  mode: "guided" | "research_autopilot" | "outreach_autopilot" | "negotiation_autopilot";
  status: "draft" | "active" | "superseded" | "revoked" | "expired";
  platformIds: import("./_generated/dataModel").Id<"sourcePlatforms">[];
  allowedActionTypes: ("send_email" | "submit_webform" | "send_platform_dm" | "create_portal_account" | "publish_listing" | "share_contact_details" | "propose_visit_time")[];
  allowedPersonalData: ("band_name" | "member_first_names" | "reply_email" | "phone" | "precise_location" | "availability" | "budget" | "music_profile")[];
  maxContactsPerDay: number; maxBrowserMinutesPerDay: number; maxMonthlyPriceEur?: number;
  expiresAt: number; stopOnComplaint: boolean; stopWhenSuitableRoomConfirmed: boolean;
  commitmentBoundary?: "non_binding_outreach_only";
  contentHash: string; activatedAt?: number; stoppedAt?: number; createdAt: number; updatedAt: number;
}) {
  return {
    _id: row._id, savedNeedId: row.savedNeedId, version: row.version,
    supersedesMandateId: row.supersedesMandateId, mode: row.mode, status: row.status,
    platformIds: row.platformIds, allowedActionTypes: row.allowedActionTypes,
    allowedPersonalData: row.allowedPersonalData, maxContactsPerDay: row.maxContactsPerDay,
    maxBrowserMinutesPerDay: row.maxBrowserMinutesPerDay, maxMonthlyPriceEur: row.maxMonthlyPriceEur,
    expiresAt: row.expiresAt, stopOnComplaint: row.stopOnComplaint,
    stopWhenSuitableRoomConfirmed: row.stopWhenSuitableRoomConfirmed,
    commitmentBoundary: row.commitmentBoundary,
    contentHash: row.contentHash, activatedAt: row.activatedAt, stoppedAt: row.stoppedAt,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

type MandateInput = {
  mode: "guided" | "research_autopilot" | "outreach_autopilot" | "negotiation_autopilot";
  platformIds: string[];
  allowedActionTypes: string[];
  allowedPersonalData: string[];
  maxContactsPerDay: number;
  maxBrowserMinutesPerDay: number;
  maxMonthlyPriceEur?: number;
  expiresAt: number;
  stopOnComplaint: boolean;
  stopWhenSuitableRoomConfirmed: boolean;
  commitmentBoundary?: "non_binding_outreach_only";
};

async function mandateHash(input: MandateInput): Promise<string> {
  return await contentHash([
    input.mode,
    JSON.stringify([...input.platformIds].sort()),
    JSON.stringify([...input.allowedActionTypes].sort()),
    JSON.stringify([...input.allowedPersonalData].sort()),
    String(input.maxContactsPerDay),
    String(input.maxBrowserMinutesPerDay),
    input.maxMonthlyPriceEur === undefined ? "" : String(input.maxMonthlyPriceEur),
    String(input.expiresAt),
    String(input.stopOnComplaint),
    String(input.stopWhenSuitableRoomConfirmed),
    input.commitmentBoundary ?? "",
  ]);
}

function validateLimits(input: MandateInput, now: number): void {
  if (input.commitmentBoundary !== "non_binding_outreach_only") {
    throw new ConvexError({ code: "MANDATE_COMMITMENT_BOUNDARY_REQUIRED" });
  }
  if (!Number.isInteger(input.maxContactsPerDay) || input.maxContactsPerDay < 0 || input.maxContactsPerDay > 50) {
    throw new ConvexError({ code: "INVALID_CONTACT_LIMIT" });
  }
  if (!Number.isInteger(input.maxBrowserMinutesPerDay) || input.maxBrowserMinutesPerDay < 0 || input.maxBrowserMinutesPerDay > 240) {
    throw new ConvexError({ code: "INVALID_BROWSER_LIMIT" });
  }
  if (input.maxMonthlyPriceEur !== undefined && (!Number.isFinite(input.maxMonthlyPriceEur) || input.maxMonthlyPriceEur < 0 || input.maxMonthlyPriceEur > 100_000)) {
    throw new ConvexError({ code: "INVALID_PRICE_LIMIT" });
  }
  if (input.expiresAt <= now || input.expiresAt > now + 366 * 24 * 60 * 60 * 1_000) {
    throw new ConvexError({ code: "INVALID_MANDATE_EXPIRY" });
  }
  if ((input.mode === "guided" || input.mode === "research_autopilot") && input.allowedActionTypes.length > 0) {
    throw new ConvexError({ code: "MODE_CANNOT_AUTHORIZE_EXTERNAL_ACTIONS" });
  }
}

export const listMine = query({
  args: { savedNeedId: v.optional(v.id("savedNeeds")), limit: v.optional(v.number()) },
  returns: v.array(mandateValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 20)));
    const rows = args.savedNeedId
      ? await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
          q.eq("ownerId", ownerId).eq("savedNeedId", args.savedNeedId!).eq("status", "active"),
        ).take(limit)
      : await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
          q.eq("ownerId", ownerId),
        ).take(limit);
    return rows.map(publicMandate);
  },
});

export const getActiveMine = query({
  args: { savedNeedId: v.id("savedNeeds") },
  returns: v.union(mandateValidator, v.null()),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const row = await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
      q.eq("ownerId", ownerId).eq("savedNeedId", args.savedNeedId).eq("status", "active"),
    ).unique();
    if (row === null) return null;
    return publicMandate(row);
  },
});

export const createDraft = mutation({
  args: {
    savedNeedId: v.id("savedNeeds"),
    mode: modeValidator,
    platformIds: v.array(v.id("sourcePlatforms")),
    allowedActionTypes: v.array(actionTypeValidator),
    allowedPersonalData: v.array(personalDataValidator),
    maxContactsPerDay: v.number(),
    maxBrowserMinutesPerDay: v.number(),
    maxMonthlyPriceEur: v.optional(v.number()),
    expiresAt: v.number(),
    stopOnComplaint: v.boolean(),
    stopWhenSuitableRoomConfirmed: v.boolean(),
  },
  returns: v.object({ mandateId: v.id("searchMandates"), contentHash: v.string() }),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const need = await ctx.db.get(args.savedNeedId);
    if (need === null || need.ownerId !== ownerId || need.status === "archived") {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    const platformIds = [...new Set(args.platformIds)];
    for (const platformId of platformIds) {
      if ((await ctx.db.get(platformId)) === null) throw new ConvexError({ code: "PLATFORM_NOT_FOUND" });
    }
    const input = {
      mode: args.mode,
      platformIds,
      allowedActionTypes: [...new Set(args.allowedActionTypes)],
      allowedPersonalData: [...new Set(args.allowedPersonalData)],
      maxContactsPerDay: args.maxContactsPerDay,
      maxBrowserMinutesPerDay: args.maxBrowserMinutesPerDay,
      maxMonthlyPriceEur: args.maxMonthlyPriceEur,
      expiresAt: args.expiresAt,
      stopOnComplaint: args.stopOnComplaint,
      stopWhenSuitableRoomConfirmed: args.stopWhenSuitableRoomConfirmed,
      commitmentBoundary: "non_binding_outreach_only" as const,
    };
    const now = Date.now();
    validateLimits(input, now);
    const previous = await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
      q.eq("ownerId", ownerId).eq("savedNeedId", args.savedNeedId).eq("status", "active"),
    ).unique();
    const priorRows = await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
      q.eq("ownerId", ownerId).eq("savedNeedId", args.savedNeedId),
    ).take(100);
    const version = priorRows.reduce((max, row) => Math.max(max, row.version), 0) + 1;
    const hash = await mandateHash(input);
    const mandateId = await ctx.db.insert("searchMandates", {
      ownerId,
      savedNeedId: args.savedNeedId,
      version,
      supersedesMandateId: previous?._id,
      ...input,
      status: "draft",
      contentHash: hash,
      createdAt: now,
      updatedAt: now,
    });
    return { mandateId, contentHash: hash };
  },
});

export const activate = mutation({
  args: { mandateId: v.id("searchMandates"), expectedContentHash: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const mandate = await ctx.db.get(args.mandateId);
    if (mandate === null || mandate.ownerId !== ownerId) throw new ConvexError({ code: "MANDATE_NOT_FOUND" });
    if (mandate.status !== "draft") throw new ConvexError({ code: "INVALID_MANDATE_STATE" });
    if (mandate.contentHash !== args.expectedContentHash) throw new ConvexError({ code: "MANDATE_CONTENT_CHANGED" });
    validateLimits(mandate, Date.now());
    const active = await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
      q.eq("ownerId", ownerId).eq("savedNeedId", mandate.savedNeedId).eq("status", "active"),
    ).unique();
    const now = Date.now();
    if (active !== null) {
      await ctx.db.patch(active._id, { status: "superseded", stoppedAt: now, updatedAt: now });
    }
    await ctx.db.patch(mandate._id, { status: "active", activatedAt: now, updatedAt: now });
    await ctx.db.insert("auditEvents", {
      eventKey: `mandate:${mandate._id}:activated:${mandate.version}`,
      actorType: "user",
      actorUserId: ownerId,
      entityKey: `mandate:${mandate._id}`,
      eventType: "mandate.activated",
      afterHash: mandate.contentHash,
      summary: `Activated ${mandate.mode} mandate version ${mandate.version}`,
      occurredAt: now,
    });
    return null;
  },
});

export const revoke = mutation({
  args: { mandateId: v.id("searchMandates") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const mandate = await ctx.db.get(args.mandateId);
    if (mandate === null || mandate.ownerId !== ownerId) throw new ConvexError({ code: "MANDATE_NOT_FOUND" });
    if (mandate.status !== "active" && mandate.status !== "draft") return null;
    const now = Date.now();
    await ctx.db.patch(mandate._id, { status: "revoked", stoppedAt: now, updatedAt: now });
    await ctx.db.insert("auditEvents", {
      eventKey: `mandate:${mandate._id}:revoked:${now}`,
      actorType: "user",
      actorUserId: ownerId,
      entityKey: `mandate:${mandate._id}`,
      eventType: "mandate.revoked",
      beforeHash: mandate.contentHash,
      summary: "Standing authorization revoked by its owner",
      occurredAt: now,
    });
    return null;
  },
});

export const killSwitch = mutation({
  args: { savedNeedId: v.id("savedNeeds") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const active = await ctx.db.query("searchMandates").withIndex("by_owner_and_saved_need_and_status", (q) =>
      q.eq("ownerId", ownerId).eq("savedNeedId", args.savedNeedId).eq("status", "active"),
    ).take(10);
    const now = Date.now();
    for (const mandate of active) {
      await ctx.db.patch(mandate._id, { status: "revoked", stoppedAt: now, updatedAt: now });
      await ctx.db.insert("auditEvents", {
        eventKey: `mandate:${mandate._id}:kill_switch:${mandate.version}`,
        actorType: "user",
        actorUserId: ownerId,
        entityKey: `mandate:${mandate._id}`,
        eventType: "mandate.kill_switch_revoked",
        beforeHash: mandate.contentHash,
        summary: "Standing authorization revoked by the search kill switch",
        occurredAt: now,
      });
    }
    return active.length;
  },
});
