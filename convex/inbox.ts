import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { generateRoomScoutObject } from "./ai";
import { requireUser } from "./integrations/auth";
import { delimitUntrustedData } from "./lib/privacy";

const threadValidator = v.object({
  _id: v.id("mailThreads"),
  subject: v.string(),
  status: v.union(
    v.literal("sent"),
    v.literal("awaiting_reply"),
    v.literal("replied"),
    v.literal("closed"),
    v.literal("failed"),
  ),
  lastMessageAt: v.number(),
  lastDeliveryStatus: v.optional(
    v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("rejected"),
      v.literal("complained"),
    ),
  ),
  lastError: v.optional(v.string()),
  createdAt: v.number(),
});

const messageValidator = v.object({
  _id: v.id("mailMessages"),
  direction: v.union(v.literal("outbound"), v.literal("inbound")),
  from: v.string(),
  to: v.array(v.string()),
  subject: v.string(),
  body: v.string(),
  parsedSummary: v.optional(v.string()),
  parsedFacts: v.optional(v.array(v.string())),
  deliveryStatus: v.optional(
    v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("bounced"),
      v.literal("rejected"),
      v.literal("complained"),
      v.literal("received"),
    ),
  ),
  receivedAt: v.number(),
});

export const listThreadsMine = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(threadValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const threads = await ctx.db
      .query("mailThreads")
      .withIndex("by_owner_and_last_message_at", (q) =>
        q.eq("ownerId", ownerId),
      )
      .order("desc")
      .take(Math.max(1, Math.min(Math.floor(args.limit ?? 30), 50)));
    return threads.map((thread) => ({
      _id: thread._id,
      subject: thread.subject,
      status: thread.status,
      lastMessageAt: thread.lastMessageAt,
      lastDeliveryStatus: thread.lastDeliveryStatus,
      lastError: thread.lastError,
      createdAt: thread.createdAt,
    }));
  },
});

export const getThreadMine = query({
  args: { threadId: v.id("mailThreads"), limit: v.optional(v.number()) },
  returns: v.union(
    v.object({ thread: threadValidator, messages: v.array(messageValidator) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (thread === null || thread.ownerId !== ownerId) {
      return null;
    }
    const messages = await ctx.db
      .query("mailMessages")
      .withIndex("by_thread_and_received_at", (q) =>
        q.eq("threadId", thread._id),
      )
      .order("asc")
      .take(Math.max(1, Math.min(Math.floor(args.limit ?? 100), 100)));
    return {
      thread: {
        _id: thread._id,
        subject: thread.subject,
        status: thread.status,
        lastMessageAt: thread.lastMessageAt,
        lastDeliveryStatus: thread.lastDeliveryStatus,
        lastError: thread.lastError,
        createdAt: thread.createdAt,
      },
      messages: messages.map((message) => ({
        _id: message._id,
        direction: message.direction,
        from: message.from,
        to: message.to,
        subject: message.subject,
        body: message.body,
        parsedSummary: message.parsedSummary,
        parsedFacts: message.parsedFacts,
        deliveryStatus: message.deliveryStatus,
        receivedAt: message.receivedAt,
      })),
    };
  },
});

export const storeInboundMessage = internalMutation({
  args: {
    mailboxId: v.id("userMailboxes"),
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    providerEventId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    htmlAvailable: v.boolean(),
    receivedAt: v.number(),
  },
  returns: v.union(v.id("mailMessages"), v.null()),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("mailThreads")
      .withIndex("by_mailbox_and_provider_thread_id", (q) =>
        q
          .eq("mailboxId", args.mailboxId)
          .eq("providerThreadId", args.providerThreadId),
      )
      .unique();
    if (thread === null) {
      return null;
    }
    const existing = await ctx.db
      .query("mailMessages")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    if (existing !== null) {
      return existing.threadId === thread._id ? existing._id : null;
    }
    const messageId = await ctx.db.insert("mailMessages", {
      threadId: thread._id,
      providerMessageId: args.providerMessageId,
      direction: "inbound",
      from: args.from.slice(0, 320),
      to: args.to.slice(0, 20).map((address) => address.slice(0, 320)),
      subject: args.subject.slice(0, 500),
      body: args.body.slice(0, 100_000),
      providerEventId: args.providerEventId,
      htmlAvailable: args.htmlAvailable,
      deliveryStatus: "received",
      providerEventAt: args.receivedAt,
      receivedAt: args.receivedAt,
    });
    await Promise.all([
      ctx.db.patch(thread._id, {
        status: "replied",
        lastMessageAt: args.receivedAt,
      }),
      ctx.db.patch(thread.draftId, {
        status: "replied",
        updatedAt: Date.now(),
      }),
      ctx.db.insert("notifications", {
        ownerId: thread.ownerId,
        kind: "mail_reply",
        title: "A room contact replied",
        body: args.subject.slice(0, 240),
        mailThreadId: thread._id,
        createdAt: Date.now(),
      }),
    ]);
    return messageId;
  },
});

const mailboxMessageStatus = v.union(
  v.literal("unread"),
  v.literal("read"),
  v.literal("archived"),
);

function mailboxMessageKind(subject: string, body: string): "portal_verification" | "general" {
  return /verify|verification|confirm|confirmation|activate|activation|magic[ -]?link|one[ -]?time|otp|2fa|bestätig|verifiz|aktivier|einmal(?:code|passwort)/i.test(
    `${subject}\n${body.slice(0, 2_000)}`,
  ) ? "portal_verification" : "general";
}

export const storeMailboxMessage = internalMutation({
  args: {
    mailboxId: v.id("userMailboxes"),
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    providerEventId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    htmlAvailable: v.boolean(),
    receivedAt: v.number(),
  },
  returns: v.id("mailboxMessages"),
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (mailbox === null || mailbox.status !== "active") {
      throw new Error("MAILBOX_NOT_ACTIVE");
    }
    const providerMessageId = args.providerMessageId.slice(0, 500);
    const existing = await ctx.db.query("mailboxMessages").withIndex("by_mailbox_and_provider_message_id", (q) =>
      q.eq("mailboxId", mailbox._id).eq("providerMessageId", providerMessageId),
    ).unique();
    if (existing) return existing._id;
    const now = Date.now();
    const subject = args.subject.slice(0, 500);
    const body = args.body.slice(0, 100_000);
    const kind = mailboxMessageKind(subject, body);
    const messageId = await ctx.db.insert("mailboxMessages", {
      ownerId: mailbox.ownerId,
      mailboxId: mailbox._id,
      providerThreadId: args.providerThreadId.slice(0, 500),
      providerMessageId,
      providerEventId: args.providerEventId.slice(0, 500),
      from: args.from.slice(0, 320),
      to: args.to.slice(0, 20).map((address) => address.slice(0, 320)),
      subject,
      body,
      kind,
      status: "unread",
      htmlAvailable: args.htmlAvailable,
      receivedAt: args.receivedAt,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("notifications", {
      ownerId: mailbox.ownerId,
      kind: "system",
      title: kind === "portal_verification" ? "Portal verification email received" : "New Scout mailbox message",
      body: subject.slice(0, 240),
      createdAt: now,
    });
    return messageId;
  },
});

export const listMailboxMessagesMine = query({
  args: { status: v.optional(mailboxMessageStatus), limit: v.optional(v.number()) },
  returns: v.array(v.object({
    _id: v.id("mailboxMessages"),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    kind: v.union(v.literal("portal_verification"), v.literal("general")),
    status: mailboxMessageStatus,
    receivedAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 30)));
    const rows = args.status
      ? await ctx.db.query("mailboxMessages").withIndex("by_owner_and_status_and_received_at", (q) => q.eq("ownerId", ownerId).eq("status", args.status!)).order("desc").take(limit)
      : await ctx.db.query("mailboxMessages").withIndex("by_owner_and_received_at", (q) => q.eq("ownerId", ownerId)).order("desc").take(limit);
    return rows.map((row) => ({ _id: row._id, from: row.from, to: row.to, subject: row.subject, body: row.body, kind: row.kind, status: row.status, receivedAt: row.receivedAt }));
  },
});

export const updateMailboxMessageStatus = mutation({
  args: { messageId: v.id("mailboxMessages"), status: mailboxMessageStatus },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (message === null || message.ownerId !== ownerId) throw new Error("MAILBOX_MESSAGE_NOT_FOUND");
    await ctx.db.patch(message._id, { status: args.status, updatedAt: Date.now() });
    return null;
  },
});

export const latestPortalVerificationForOwner = internalQuery({
  args: {
    ownerId: v.id("users"),
    mailboxId: v.id("userMailboxes"),
    receivedAfter: v.number(),
    limit: v.number(),
  },
  returns: v.array(
    v.object({
      messageId: v.id("mailboxMessages"),
      from: v.string(),
      subject: v.string(),
      body: v.string(),
      receivedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (mailbox === null || mailbox.ownerId !== args.ownerId) return [];
    const rows = await ctx.db
      .query("mailboxMessages")
      .withIndex("by_owner_and_received_at", (q) =>
        q.eq("ownerId", args.ownerId).gte("receivedAt", args.receivedAfter),
      )
      .order("desc")
      .take(Math.max(1, Math.min(20, Math.floor(args.limit))));
    return rows
      .filter((row) => row.kind === "portal_verification")
      .map((message) => ({
          messageId: message._id,
          from: message.from,
          subject: message.subject,
          body: message.body,
          receivedAt: message.receivedAt,
        }));
  },
});

export const markMailboxMessageReadInternal = internalMutation({
  args: { ownerId: v.id("users"), messageId: v.id("mailboxMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (message?.ownerId === args.ownerId && message.status === "unread") {
      await ctx.db.patch(message._id, { status: "read", updatedAt: Date.now() });
    }
    return null;
  },
});

export const attachMailboxToSentMessage = internalMutation({
  args: {
    threadId: v.id("mailThreads"),
    mailboxId: v.id("userMailboxes"),
    providerInboxId: v.string(),
    providerMessageId: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const [thread, mailbox, message] = await Promise.all([
      ctx.db.get(args.threadId),
      ctx.db.get(args.mailboxId),
      ctx.db
        .query("mailMessages")
        .withIndex("by_provider_message_id", (q) =>
          q.eq("providerMessageId", args.providerMessageId),
        )
        .unique(),
    ]);
    if (
      thread === null ||
      mailbox === null ||
      mailbox.ownerId !== thread.ownerId ||
      mailbox.providerInboxId !== args.providerInboxId ||
      message === null ||
      message.threadId !== thread._id
    ) {
      return false;
    }
    const now = Date.now();
    await Promise.all([
      ctx.db.patch(thread._id, {
        mailboxId: mailbox._id,
        inboxId: args.providerInboxId,
        lastDeliveryStatus: "sent",
        lastError: undefined,
      }),
      ctx.db.patch(message._id, {
        deliveryStatus: "sent",
        providerEventAt: now,
      }),
      ctx.db.patch(thread.draftId, {
        mailboxId: mailbox._id,
        providerMessageId: args.providerMessageId,
        deliveryStatus: "sent",
        updatedAt: now,
      }),
    ]);
    return true;
  },
});

const deliveryStatus = v.union(
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("rejected"),
  v.literal("complained"),
);

const deliveryRank = {
  sent: 1,
  delivered: 2,
  bounced: 3,
  rejected: 3,
  complained: 4,
} as const;

export const applyDeliveryEvent = internalMutation({
  args: {
    mailboxId: v.id("userMailboxes"),
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    status: deliveryStatus,
    eventAt: v.number(),
    error: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const thread = await ctx.db
      .query("mailThreads")
      .withIndex("by_mailbox_and_provider_thread_id", (q) =>
        q
          .eq("mailboxId", args.mailboxId)
          .eq("providerThreadId", args.providerThreadId),
      )
      .unique();
    if (thread === null) {
      return false;
    }
    const message = await ctx.db
      .query("mailMessages")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    if (message === null || message.threadId !== thread._id) {
      return false;
    }
    const currentStatus = message.deliveryStatus;
    const shouldApply =
      currentStatus === undefined ||
      currentStatus === "received" ||
      message.providerEventAt === undefined ||
      args.eventAt > message.providerEventAt ||
      (args.eventAt === message.providerEventAt &&
        deliveryRank[args.status] > deliveryRank[currentStatus]);
    if (!shouldApply) {
      return true;
    }
    const failed =
      args.status === "bounced" ||
      args.status === "rejected" ||
      args.status === "complained";
    const error = failed
      ? (args.error ?? `AgentMail reported ${args.status}.`).slice(0, 500)
      : undefined;
    await Promise.all([
      ctx.db.patch(message._id, {
        deliveryStatus: args.status,
        providerEventAt: args.eventAt,
      }),
      ctx.db.patch(thread._id, {
        lastDeliveryStatus: args.status,
        lastError: error,
        status: failed ? "failed" : thread.status,
      }),
      ctx.db.patch(thread.draftId, {
        deliveryStatus: args.status,
        error,
        status: failed
          ? "failed"
          : thread.status === "replied"
            ? "replied"
            : "sent",
        updatedAt: Date.now(),
      }),
      ...(failed
        ? [
            ctx.db.insert("notifications", {
              ownerId: thread.ownerId,
              kind: "outreach_failed" as const,
              title: "Outreach delivery failed",
              body: error ?? `AgentMail reported ${args.status}.`,
              mailThreadId: thread._id,
              createdAt: Date.now(),
            }),
          ]
        : []),
    ]);
    return true;
  },
});

export const getMessageForParsing = internalQuery({
  args: { messageId: v.id("mailMessages") },
  returns: v.union(
    v.object({
      subject: v.string(),
      body: v.string(),
      ownerId: v.id("users"),
      savedNeedId: v.id("savedNeeds"),
      signalId: v.id("signals"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (message === null || message.direction !== "inbound") {
      return null;
    }
    const thread = await ctx.db.get(message.threadId);
    if (thread === null) return null;
    const draft = await ctx.db.get(thread.draftId);
    if (draft === null || draft.ownerId !== thread.ownerId) return null;
    return {
      subject: message.subject,
      body: message.body,
      ownerId: thread.ownerId,
      savedNeedId: draft.savedNeedId,
      signalId: draft.signalId,
    };
  },
});

export const applyParsedReply = internalMutation({
  args: {
    messageId: v.id("mailMessages"),
    summary: v.string(),
    facts: v.array(v.string()),
    opportunitySignal: v.union(
      v.literal("none"),
      v.literal("possible"),
      v.literal("strong"),
    ),
    uncertainties: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (message === null || message.direction !== "inbound") {
      return null;
    }
    await ctx.db.patch(message._id, {
      parsedSummary: args.summary.slice(0, 1_000),
      parsedFacts: args.facts.slice(0, 20).map((fact) => fact.slice(0, 500)),
    });
    if (args.opportunitySignal !== "none") {
      const thread = await ctx.db.get(message.threadId);
      if (thread !== null) {
        const draft = await ctx.db.get(thread.draftId);
        if (draft !== null && draft.ownerId === thread.ownerId) {
          const fingerprint = `agentmail-reply:${message._id}`;
          const existing = await ctx.db
            .query("opportunities")
            .withIndex("by_saved_need_and_fingerprint", (q) =>
              q.eq("savedNeedId", draft.savedNeedId).eq("fingerprint", fingerprint),
            )
            .unique();
          const now = Date.now();
          if (existing === null) {
            await ctx.db.insert("opportunities", {
              ownerId: thread.ownerId,
              savedNeedId: draft.savedNeedId,
              kind: "supply_match",
              status: "new",
              signalId: draft.signalId,
              score: args.opportunitySignal === "strong" ? 0.9 : 0.65,
              reasons: [args.summary.slice(0, 500)],
              uncertainties: args.uncertainties.slice(0, 20).map((item) => item.slice(0, 500)),
              fingerprint,
              firstSeenAt: now,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      }
    }
    return null;
  },
});

export const parseInboundReply = internalAction({
  args: { messageId: v.id("mailMessages") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(internal.inbox.getMessageForParsing, {
      messageId: args.messageId,
    });
    if (message === null) {
      return null;
    }

    const output = await generateRoomScoutObject({
      schema: z.object({
        summary: z.string().max(1_000),
        facts: z.array(z.string().max(500)).max(20),
        opportunitySignal: z.enum(["none", "possible", "strong"]),
        uncertainties: z.array(z.string().max(500)).max(20),
      }),
      instructions:
        "Extract only explicit facts from this rehearsal-room email reply. Keep uncertainty explicit, never infer availability, price, or commitments that are not stated.",
      prompt: delimitUntrustedData(
        "agentmail_reply",
        `Subject: ${message.subject}\n\n${message.body.slice(0, 12_000)}`,
      ),
    });
    await ctx.runMutation(internal.inbox.applyParsedReply, {
      messageId: args.messageId,
      summary: output.summary,
      facts: output.facts,
      opportunitySignal: output.opportunitySignal,
      uncertainties: output.uncertainties,
    });
    return null;
  },
});
