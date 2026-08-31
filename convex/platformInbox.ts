import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { requireUserId } from "./integrations/authz";

const directionValidator = v.union(
  v.literal("inbound"),
  v.literal("outbound"),
  v.literal("unknown"),
);

const threadStatusValidator = v.union(v.literal("open"), v.literal("archived"));

const threadValidator = v.object({
  _id: v.id("platformThreads"),
  connectionId: v.id("portalConnections"),
  subject: v.optional(v.string()),
  participants: v.array(v.string()),
  lastMessageAt: v.number(),
  status: threadStatusValidator,
  createdAt: v.number(),
  updatedAt: v.number(),
});

const messageValidator = v.object({
  _id: v.id("platformMessages"),
  threadId: v.id("platformThreads"),
  direction: directionValidator,
  senderLabel: v.optional(v.string()),
  bodyText: v.string(),
  sentAt: v.number(),
  createdAt: v.number(),
});

export const listThreadsMine = query({
  args: { connectionId: v.id("portalConnections"), limit: v.optional(v.number()) },
  returns: v.array(threadValidator),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    const limit = Math.max(1, Math.min(50, Math.floor(args.limit ?? 30)));
    const rows = await ctx.db
      .query("platformThreads")
      .withIndex("by_connection_and_last_message_at", (q) =>
        q.eq("connectionId", connection._id),
      )
      .order("desc")
      .take(limit);
    return rows.map((row) => ({
      _id: row._id,
      connectionId: row.connectionId,
      subject: row.subject,
      participants: row.participants,
      lastMessageAt: row.lastMessageAt,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});

export const getThreadMine = query({
  args: { threadId: v.id("platformThreads"), messageLimit: v.optional(v.number()) },
  returns: v.union(
    v.object({ thread: threadValidator, messages: v.array(messageValidator) }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireUserId(ctx);
    const thread = await ctx.db.get(args.threadId);
    if (thread === null || thread.ownerId !== ownerId) return null;
    const limit = Math.max(1, Math.min(100, Math.floor(args.messageLimit ?? 50)));
    const messages = await ctx.db
      .query("platformMessages")
      .withIndex("by_thread_and_sent_at", (q) => q.eq("threadId", thread._id))
      .order("desc")
      .take(limit);
    return {
      thread: {
        _id: thread._id,
        connectionId: thread.connectionId,
        subject: thread.subject,
        participants: thread.participants,
        lastMessageAt: thread.lastMessageAt,
        status: thread.status,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
      },
      messages: messages.reverse().map((message) => ({
        _id: message._id,
        threadId: message.threadId,
        direction: message.direction,
        senderLabel: message.senderLabel,
        bodyText: message.bodyText,
        sentAt: message.sentAt,
        createdAt: message.createdAt,
      })),
    };
  },
});

/**
 * Resolves an opaque provider thread id for one already-authorized browser
 * write. The provider id is never accepted from the client and can only be
 * returned to another internal Convex function.
 */
export const getThreadForWrite = internalQuery({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    threadId: v.id("platformThreads"),
  },
  returns: v.union(
    v.object({
      providerThreadId: v.string(),
      participants: v.array(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const thread = await ctx.db.get(args.threadId);
    if (
      thread === null ||
      thread.ownerId !== args.ownerId ||
      thread.connectionId !== args.connectionId
    ) {
      return null;
    }
    return {
      providerThreadId: thread.providerThreadId,
      participants: thread.participants,
    };
  },
});

/** Records only provider-confirmed outbound writes. No DOM or page snapshot is
 * accepted here; opaque ids and the already-approved message are sufficient. */
export const recordOutboundWrite = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    threadId: v.optional(v.id("platformThreads")),
    providerThreadId: v.optional(v.string()),
    providerMessageId: v.string(),
    participants: v.array(v.string()),
    subject: v.optional(v.string()),
    bodyText: v.string(),
    sentAt: v.number(),
  },
  returns: v.object({
    threadId: v.id("platformThreads"),
    messageId: v.id("platformMessages"),
    created: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (
      connection === null ||
      connection.ownerId !== args.ownerId ||
      connection.status !== "active" ||
      connection.policyDecision !== "allowed"
    ) {
      throw new ConvexError({ code: "CONNECTION_NOT_ACTIVE" });
    }
    const providerMessageId = args.providerMessageId.trim().slice(0, 500);
    const providerThreadId = args.providerThreadId?.trim().slice(0, 500);
    const bodyText = args.bodyText.trim().slice(0, 20_000);
    if (!providerMessageId || !bodyText || args.participants.length > 20) {
      throw new ConvexError({ code: "INVALID_OUTBOUND_WRITE" });
    }

    let thread = args.threadId ? await ctx.db.get(args.threadId) : null;
    if (args.threadId && thread === null) {
      throw new ConvexError({ code: "PLATFORM_THREAD_NOT_FOUND" });
    }
    if (
      thread !== null &&
      (thread.ownerId !== args.ownerId || thread.connectionId !== connection._id)
    ) {
      throw new ConvexError({ code: "PLATFORM_THREAD_NOT_FOUND" });
    }
    if (thread !== null && providerThreadId && thread.providerThreadId !== providerThreadId) {
      throw new ConvexError({ code: "PROVIDER_THREAD_MISMATCH" });
    }
    if (thread === null) {
      if (!providerThreadId) {
        throw new ConvexError({ code: "PROVIDER_THREAD_ID_REQUIRED" });
      }
      thread = await ctx.db
        .query("platformThreads")
        .withIndex("by_connection_and_provider_thread_id", (q) =>
          q
            .eq("connectionId", connection._id)
            .eq("providerThreadId", providerThreadId),
        )
        .unique();
    }

    const now = Date.now();
    if (thread === null) {
      const newThreadId = await ctx.db.insert("platformThreads", {
        connectionId: connection._id,
        ownerId: args.ownerId,
        providerThreadId: providerThreadId!,
        subject: args.subject?.trim().slice(0, 500),
        participants: args.participants.map((value) => value.trim().slice(0, 200)),
        lastMessageAt: args.sentAt,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
      thread = await ctx.db.get(newThreadId);
    }
    if (thread === null) throw new ConvexError({ code: "PLATFORM_THREAD_NOT_FOUND" });

    const existing = await ctx.db
      .query("platformMessages")
      .withIndex("by_connection_and_provider_message_id", (q) =>
        q
          .eq("connectionId", connection._id)
          .eq("providerMessageId", providerMessageId),
      )
      .unique();
    if (existing !== null) {
      if (existing.ownerId !== args.ownerId || existing.threadId !== thread._id) {
        throw new ConvexError({ code: "PROVIDER_MESSAGE_ID_CONFLICT" });
      }
      return { threadId: thread._id, messageId: existing._id, created: false };
    }
    const messageId = await ctx.db.insert("platformMessages", {
      connectionId: connection._id,
      ownerId: args.ownerId,
      threadId: thread._id,
      providerMessageId,
      direction: "outbound",
      senderLabel: "RoomScout",
      bodyText,
      sentAt: args.sentAt,
      createdAt: now,
    });
    await ctx.db.patch(thread._id, {
      subject: args.subject?.trim().slice(0, 500) ?? thread.subject,
      participants:
        args.participants.length > 0
          ? args.participants.map((value) => value.trim().slice(0, 200))
          : thread.participants,
      lastMessageAt: Math.max(thread.lastMessageAt, args.sentAt),
      updatedAt: now,
    });
    return { threadId: thread._id, messageId, created: true };
  },
});

export const upsertReadOnlyBatch = internalMutation({
  args: {
    ownerId: v.id("users"),
    connectionId: v.id("portalConnections"),
    threads: v.array(
      v.object({
        providerThreadId: v.string(),
        subject: v.optional(v.string()),
        participants: v.array(v.string()),
        lastMessageAt: v.number(),
        messages: v.array(
          v.object({
            providerMessageId: v.string(),
            direction: directionValidator,
            senderLabel: v.optional(v.string()),
            bodyText: v.string(),
            sentAt: v.number(),
          }),
        ),
      }),
    ),
  },
  returns: v.object({ threadsCreated: v.number(), messagesCreated: v.number() }),
  handler: async (ctx, args) => {
    const connection = await ctx.db.get(args.connectionId);
    if (connection === null || connection.ownerId !== args.ownerId) {
      throw new ConvexError({ code: "CONNECTION_NOT_FOUND" });
    }
    if (
      connection.policyDecision !== "allowed" ||
      !connection.allowInboxPolling ||
      connection.status === "disabled"
    ) {
      throw new ConvexError({ code: "INBOX_POLLING_NOT_ALLOWED" });
    }
    if (args.threads.length > 20) throw new ConvexError({ code: "INBOX_BATCH_TOO_LARGE" });

    let threadsCreated = 0;
    let messagesCreated = 0;
    const now = Date.now();
    for (const inputThread of args.threads) {
      if (inputThread.messages.length > 20) {
        throw new ConvexError({ code: "INBOX_THREAD_TOO_LARGE" });
      }
      let thread = await ctx.db
        .query("platformThreads")
        .withIndex("by_connection_and_provider_thread_id", (q) =>
          q
            .eq("connectionId", connection._id)
            .eq("providerThreadId", inputThread.providerThreadId),
        )
        .unique();
      if (thread === null) {
        const threadId = await ctx.db.insert("platformThreads", {
          connectionId: connection._id,
          ownerId: args.ownerId,
          providerThreadId: inputThread.providerThreadId,
          subject: inputThread.subject,
          participants: inputThread.participants,
          lastMessageAt: inputThread.lastMessageAt,
          status: "open",
          createdAt: now,
          updatedAt: now,
        });
        thread = await ctx.db.get(threadId);
        threadsCreated += 1;
      } else {
        await ctx.db.patch(thread._id, {
          subject: inputThread.subject,
          participants: inputThread.participants,
          lastMessageAt: Math.max(thread.lastMessageAt, inputThread.lastMessageAt),
          updatedAt: now,
        });
      }
      if (thread === null) continue;

      for (const inputMessage of inputThread.messages) {
        const existing = await ctx.db
          .query("platformMessages")
          .withIndex("by_connection_and_provider_message_id", (q) =>
            q
              .eq("connectionId", connection._id)
              .eq("providerMessageId", inputMessage.providerMessageId),
          )
          .unique();
        if (existing !== null) continue;
        await ctx.db.insert("platformMessages", {
          connectionId: connection._id,
          ownerId: args.ownerId,
          threadId: thread._id,
          providerMessageId: inputMessage.providerMessageId,
          direction: inputMessage.direction,
          senderLabel: inputMessage.senderLabel,
          bodyText: inputMessage.bodyText,
          sentAt: inputMessage.sentAt,
          createdAt: now,
        });
        messagesCreated += 1;
      }
    }
    return { threadsCreated, messagesCreated };
  },
});
