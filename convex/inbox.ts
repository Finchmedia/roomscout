import { v } from "convex/values";
import { z } from "zod";
import { internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { generateRoomScoutObject } from "./ai";
import { requireUser } from "./integrations/auth";

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
        receivedAt: message.receivedAt,
      })),
    };
  },
});

export const storeInboundMessage = internalMutation({
  args: {
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    receivedAt: v.number(),
  },
  returns: v.union(v.id("mailMessages"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mailMessages")
      .withIndex("by_provider_message_id", (q) =>
        q.eq("providerMessageId", args.providerMessageId),
      )
      .unique();
    if (existing !== null) {
      return existing._id;
    }

    const thread = await ctx.db
      .query("mailThreads")
      .withIndex("by_provider_thread_id", (q) =>
        q.eq("providerThreadId", args.providerThreadId),
      )
      .unique();
    if (thread === null) {
      return null;
    }
    const messageId = await ctx.db.insert("mailMessages", {
      threadId: thread._id,
      providerMessageId: args.providerMessageId,
      direction: "inbound",
      from: args.from.slice(0, 320),
      to: args.to.slice(0, 20).map((address) => address.slice(0, 320)),
      subject: args.subject.slice(0, 500),
      body: args.body.slice(0, 100_000),
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
    ]);
    return messageId;
  },
});

export const getMessageForParsing = internalQuery({
  args: { messageId: v.id("mailMessages") },
  returns: v.union(
    v.object({ subject: v.string(), body: v.string() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (message === null || message.direction !== "inbound") {
      return null;
    }
    return { subject: message.subject, body: message.body };
  },
});

export const applyParsedReply = internalMutation({
  args: {
    messageId: v.id("mailMessages"),
    summary: v.string(),
    facts: v.array(v.string()),
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
      }),
      instructions:
        "Extract only explicit facts from this rehearsal-room email reply. Keep uncertainty explicit, never infer availability, price, or commitments that are not stated.",
      prompt: `Subject: ${message.subject}\n\n${message.body.slice(0, 12_000)}`,
    });
    await ctx.runMutation(internal.inbox.applyParsedReply, {
      messageId: args.messageId,
      summary: output.summary,
      facts: output.facts,
    });
    return null;
  },
});
