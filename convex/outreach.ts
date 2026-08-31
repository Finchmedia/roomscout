import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { requireUser } from "./integrations/auth";
import {
  contentHash,
  normalizeEmail,
  normalizeText,
} from "./integrations/contentHash";

const draftStatus = v.union(
  v.literal("drafted"),
  v.literal("awaiting_approval"),
  v.literal("approved"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("replied"),
  v.literal("rejected"),
  v.literal("failed"),
);

const draftValidator = v.object({
  _id: v.id("outreachDrafts"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  signalId: v.id("signals"),
  savedNeedId: v.id("savedNeeds"),
  recipientName: v.string(),
  recipientEmail: v.string(),
  subject: v.string(),
  body: v.string(),
  contentVersion: v.number(),
  contentHash: v.string(),
  status: draftStatus,
  sendIdempotencyKey: v.optional(v.string()),
  providerThreadId: v.optional(v.string()),
  approvedAt: v.optional(v.number()),
  sentAt: v.optional(v.number()),
  error: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

const approvalValidator = v.object({
  contentVersion: v.number(),
  contentHash: v.string(),
  recipientEmail: v.string(),
  subject: v.string(),
  body: v.string(),
  decision: v.union(v.literal("approved"), v.literal("rejected")),
  decidedAt: v.number(),
});

function cleanContent(input: {
  recipientName: string;
  recipientEmail: string;
  subject: string;
  body: string;
}) {
  const recipientName = input.recipientName.trim();
  const recipientEmail = normalizeEmail(input.recipientEmail);
  const subject = normalizeText(input.subject);
  const body = normalizeText(input.body);
  if (!recipientEmail.includes("@") || recipientEmail.length > 320) {
    throw new ConvexError({ code: "INVALID_RECIPIENT" });
  }
  if (subject.length === 0 || subject.length > 200) {
    throw new ConvexError({ code: "INVALID_SUBJECT" });
  }
  if (body.length === 0 || body.length > 20_000) {
    throw new ConvexError({ code: "INVALID_BODY" });
  }
  return { recipientName, recipientEmail, subject, body };
}

export const listMine = query({
  args: { status: v.optional(draftStatus), limit: v.optional(v.number()) },
  returns: v.array(draftValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 30), 50));
    if (args.status) {
      return await ctx.db
        .query("outreachDrafts")
        .withIndex("by_owner_and_status", (q) =>
          q.eq("ownerId", ownerId).eq("status", args.status!),
        )
        .order("desc")
        .take(limit);
    }

    const statuses = [
      "awaiting_approval",
      "approved",
      "sending",
      "sent",
      "replied",
      "drafted",
      "rejected",
      "failed",
    ] as const;
    const pages = await Promise.all(
      statuses.map((status) =>
        ctx.db
          .query("outreachDrafts")
          .withIndex("by_owner_and_status", (q) =>
            q.eq("ownerId", ownerId).eq("status", status),
          )
          .order("desc")
          .take(limit),
      ),
    );
    return pages
      .flat()
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, limit);
  },
});

export const getMine = query({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.union(
    v.object({ draft: draftValidator, approval: v.optional(approvalValidator) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (draft === null || draft.ownerId !== ownerId) {
      return null;
    }
    const approval = await ctx.db
      .query("outreachApprovals")
      .withIndex("by_draft_and_content_version", (q) =>
        q
          .eq("draftId", draft._id)
          .eq("contentVersion", draft.contentVersion),
      )
      .unique();
    return {
      draft,
      approval: approval
        ? {
            contentVersion: approval.contentVersion,
            contentHash: approval.contentHash,
            recipientEmail: approval.recipientEmail,
            subject: approval.subject,
            body: approval.body,
            decision: approval.decision,
            decidedAt: approval.decidedAt,
          }
        : undefined,
    };
  },
});

export const createDraft = mutation({
  args: {
    signalId: v.id("signals"),
    savedNeedId: v.id("savedNeeds"),
    recipientName: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.id("outreachDrafts"),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const [need, signal] = await Promise.all([
      ctx.db.get(args.savedNeedId),
      ctx.db.get(args.signalId),
    ]);
    if (need === null || need.ownerId !== ownerId) {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    if (
      signal === null ||
      (signal.status !== "published" && signal.status !== "stale")
    ) {
      throw new ConvexError({ code: "SIGNAL_NOT_FOUND" });
    }
    const content = cleanContent(args);
    const now = Date.now();
    return await ctx.db.insert("outreachDrafts", {
      ownerId,
      signalId: signal._id,
      savedNeedId: need._id,
      ...content,
      contentVersion: 1,
      contentHash: await contentHash([
        content.recipientEmail,
        content.subject,
        content.body,
      ]),
      status: "drafted",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createFromScout = internalMutation({
  args: {
    ownerId: v.id("users"),
    signalId: v.id("signals"),
    savedNeedId: v.id("savedNeeds"),
    recipientName: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.id("outreachDrafts"),
  handler: async (ctx, args) => {
    const [owner, need, signal] = await Promise.all([
      ctx.db.get(args.ownerId),
      ctx.db.get(args.savedNeedId),
      ctx.db.get(args.signalId),
    ]);
    if (owner === null || need === null || need.ownerId !== owner._id) {
      throw new ConvexError({ code: "NEED_NOT_FOUND" });
    }
    if (
      signal === null ||
      (signal.status !== "published" && signal.status !== "stale")
    ) {
      throw new ConvexError({ code: "SIGNAL_NOT_FOUND" });
    }
    const content = cleanContent(args);
    const now = Date.now();
    return await ctx.db.insert("outreachDrafts", {
      ownerId: owner._id,
      signalId: signal._id,
      savedNeedId: need._id,
      ...content,
      contentVersion: 1,
      contentHash: await contentHash([
        content.recipientEmail,
        content.subject,
        content.body,
      ]),
      status: "drafted",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateDraft = mutation({
  args: {
    draftId: v.id("outreachDrafts"),
    recipientName: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (draft === null || draft.ownerId !== ownerId) {
      throw new ConvexError({ code: "DRAFT_NOT_FOUND" });
    }
    if (draft.status === "sending" || draft.status === "sent" || draft.status === "replied") {
      throw new ConvexError({ code: "DRAFT_LOCKED" });
    }
    const content = cleanContent(args);
    await ctx.db.patch(draft._id, {
      ...content,
      contentVersion: draft.contentVersion + 1,
      contentHash: await contentHash([
        content.recipientEmail,
        content.subject,
        content.body,
      ]),
      status: "drafted",
      sendIdempotencyKey: undefined,
      approvedAt: undefined,
      error: undefined,
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const submitForApproval = mutation({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (draft === null || draft.ownerId !== ownerId) {
      throw new ConvexError({ code: "DRAFT_NOT_FOUND" });
    }
    if (draft.status !== "drafted") {
      throw new ConvexError({ code: "INVALID_DRAFT_STATE" });
    }
    await ctx.db.patch(draft._id, {
      status: "awaiting_approval",
      updatedAt: Date.now(),
    });
    return null;
  },
});

export const decide = mutation({
  args: {
    draftId: v.id("outreachDrafts"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    expectedContentVersion: v.number(),
    expectedContentHash: v.string(),
    expectedRecipientEmail: v.string(),
    expectedSubject: v.string(),
    expectedBody: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (draft === null || draft.ownerId !== ownerId) {
      throw new ConvexError({ code: "DRAFT_NOT_FOUND" });
    }
    if (draft.status !== "awaiting_approval") {
      throw new ConvexError({ code: "INVALID_DRAFT_STATE" });
    }
    const expectedRecipientEmail = normalizeEmail(args.expectedRecipientEmail);
    const expectedSubject = normalizeText(args.expectedSubject);
    const expectedBody = normalizeText(args.expectedBody);
    const expectedHash = await contentHash([
      expectedRecipientEmail,
      expectedSubject,
      expectedBody,
    ]);
    if (
      args.expectedContentVersion !== draft.contentVersion ||
      args.expectedContentHash !== draft.contentHash ||
      expectedHash !== draft.contentHash ||
      expectedRecipientEmail !== draft.recipientEmail ||
      expectedSubject !== draft.subject ||
      expectedBody !== draft.body
    ) {
      throw new ConvexError({ code: "DRAFT_CONTENT_CHANGED" });
    }
    const existing = await ctx.db
      .query("outreachApprovals")
      .withIndex("by_draft_and_content_version", (q) =>
        q
          .eq("draftId", draft._id)
          .eq("contentVersion", draft.contentVersion),
      )
      .unique();
    if (existing !== null) {
      throw new ConvexError({ code: "ALREADY_DECIDED" });
    }

    const decidedAt = Date.now();
    await ctx.db.insert("outreachApprovals", {
      draftId: draft._id,
      ownerId,
      contentVersion: draft.contentVersion,
      contentHash: draft.contentHash,
      recipientEmail: draft.recipientEmail,
      subject: draft.subject,
      body: draft.body,
      decision: args.decision,
      decidedAt,
    });
    await ctx.db.patch(draft._id, {
      status: args.decision === "approved" ? "approved" : "rejected",
      approvedAt: args.decision === "approved" ? decidedAt : undefined,
      updatedAt: decidedAt,
    });
    return null;
  },
});

export const sendApproved = mutation({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const draft = await ctx.db.get(args.draftId);
    if (draft === null || draft.ownerId !== ownerId) {
      throw new ConvexError({ code: "DRAFT_NOT_FOUND" });
    }
    if (draft.status !== "approved") {
      throw new ConvexError({ code: "APPROVAL_REQUIRED" });
    }
    await ctx.scheduler.runAfter(0, internal.agentmail.sendApprovedDraft, {
      draftId: draft._id,
    });
    return null;
  },
});

export const claimApprovedSend = internalMutation({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.union(
    v.object({ shouldSend: v.literal(false) }),
    v.object({
      shouldSend: v.literal(true),
      draftId: v.id("outreachDrafts"),
      recipientEmail: v.string(),
      subject: v.string(),
      body: v.string(),
      contentVersion: v.number(),
      contentHash: v.string(),
      idempotencyKey: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (draft === null) {
      return { shouldSend: false as const };
    }
    if (draft.status !== "approved") {
      return { shouldSend: false as const };
    }
    const approval = await ctx.db
      .query("outreachApprovals")
      .withIndex("by_draft_and_content_version", (q) =>
        q
          .eq("draftId", draft._id)
          .eq("contentVersion", draft.contentVersion),
      )
      .unique();
    const currentHash = await contentHash([
      draft.recipientEmail,
      draft.subject,
      draft.body,
    ]);
    if (
      approval === null ||
      approval.decision !== "approved" ||
      approval.ownerId !== draft.ownerId ||
      approval.contentHash !== draft.contentHash ||
      approval.contentHash !== currentHash ||
      approval.recipientEmail !== draft.recipientEmail ||
      approval.subject !== draft.subject ||
      approval.body !== draft.body
    ) {
      await ctx.db.patch(draft._id, {
        status: "failed",
        error: "Persisted approval no longer matches the exact message.",
        updatedAt: Date.now(),
      });
      return { shouldSend: false as const };
    }

    const idempotencyKey =
      draft.sendIdempotencyKey ??
      `roomscout:${draft._id}:v${draft.contentVersion}:${draft.contentHash}`;
    await ctx.db.patch(draft._id, {
      status: "sending",
      sendIdempotencyKey: idempotencyKey,
      sendingStartedAt: Date.now(),
      error: undefined,
      updatedAt: Date.now(),
    });
    return {
      shouldSend: true as const,
      draftId: draft._id,
      recipientEmail: draft.recipientEmail,
      subject: draft.subject,
      body: draft.body,
      contentVersion: draft.contentVersion,
      contentHash: draft.contentHash,
      idempotencyKey,
    };
  },
});

export const markSent = internalMutation({
  args: {
    draftId: v.id("outreachDrafts"),
    idempotencyKey: v.string(),
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    from: v.string(),
  },
  returns: v.union(v.id("mailThreads"), v.null()),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (
      draft === null ||
      draft.sendIdempotencyKey !== args.idempotencyKey ||
      (draft.status !== "sending" && draft.status !== "sent")
    ) {
      return null;
    }
    const existingMessage = await ctx.db
      .query("mailMessages")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    if (existingMessage !== null) {
      await ctx.db.patch(draft._id, {
        status: "sent",
        providerThreadId: args.providerThreadId,
        sendingStartedAt: undefined,
        updatedAt: Date.now(),
      });
      return existingMessage.threadId;
    }

    let thread = await ctx.db
      .query("mailThreads")
      .withIndex("by_provider_thread_id", (q) =>
        q.eq("providerThreadId", args.providerThreadId),
      )
      .unique();
    const now = Date.now();
    if (thread === null) {
      const threadId = await ctx.db.insert("mailThreads", {
        ownerId: draft.ownerId,
        draftId: draft._id,
        providerThreadId: args.providerThreadId,
        subject: draft.subject,
        status: "awaiting_reply",
        lastMessageAt: now,
        createdAt: now,
      });
      thread = await ctx.db.get(threadId);
    }
    if (thread === null || thread.ownerId !== draft.ownerId) {
      return null;
    }

    await ctx.db.insert("mailMessages", {
      threadId: thread._id,
      providerMessageId: args.providerMessageId,
      direction: "outbound",
      from: args.from,
      to: [draft.recipientEmail],
      subject: draft.subject,
      body: draft.body,
      receivedAt: now,
    });
    await ctx.db.patch(draft._id, {
      status: "sent",
      providerThreadId: args.providerThreadId,
      sentAt: now,
      sendingStartedAt: undefined,
      error: undefined,
      updatedAt: now,
    });
    return thread._id;
  },
});

export const markSendFailed = internalMutation({
  args: {
    draftId: v.id("outreachDrafts"),
    idempotencyKey: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    if (
      draft !== null &&
      draft.status === "sending" &&
      draft.sendIdempotencyKey === args.idempotencyKey
    ) {
      await ctx.db.patch(draft._id, {
        status: "failed",
        error: args.error.slice(0, 500),
        sendingStartedAt: undefined,
        updatedAt: Date.now(),
      });
      await ctx.db.insert("notifications", {
        ownerId: draft.ownerId,
        kind: "outreach_failed",
        title: "Outreach could not be sent",
        body: args.error.slice(0, 500),
        createdAt: Date.now(),
      });
    }
    return null;
  },
});

export const recoverStuckSending = internalMutation({
  args: { olderThanMs: v.number(), limit: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const cutoff = Date.now() - Math.max(60_000, args.olderThanMs);
    const drafts = await ctx.db
      .query("outreachDrafts")
      .withIndex("by_status_and_updated_at", (q) =>
        q.eq("status", "sending").lt("updatedAt", cutoff),
      )
      .take(Math.max(1, Math.min(50, Math.floor(args.limit))));
    for (const draft of drafts) {
      await ctx.db.patch(draft._id, {
        status: "approved",
        sendingStartedAt: undefined,
        error: "Recovered an interrupted send; retrying with the same idempotency key.",
        updatedAt: Date.now(),
      });
      await ctx.scheduler.runAfter(0, internal.agentmail.sendApprovedDraft, {
        draftId: draft._id,
      });
    }
    return drafts.length;
  },
});
