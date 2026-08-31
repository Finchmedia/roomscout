import { AgentMailClient } from "agentmail";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalAction, internalMutation } from "./_generated/server";
import {
  bestMessageBody,
  parseAgentMailEvent,
} from "./integrations/agentmailPayload";
import { envValue } from "./integrations/env";
import { stableFingerprint } from "./integrations/fingerprints";
import { verifySvixWebhook } from "./integrations/svix";
import { roomScoutRateLimiter } from "./rateLimits";

const eventStatus = v.union(
  v.literal("processed"),
  v.literal("ignored"),
  v.literal("failed"),
);

const deliveryStatus = v.union(
  v.literal("sent"),
  v.literal("delivered"),
  v.literal("bounced"),
  v.literal("rejected"),
  v.literal("complained"),
);

function createClient(apiKey: string): AgentMailClient {
  return new AgentMailClient({ apiKey, timeoutInSeconds: 20, maxRetries: 2 });
}

function safeError(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : fallback)
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function eventMetadata(payload: unknown): {
  eventId?: string;
  eventType: string;
} {
  const root = recordOf(payload);
  if (!root) {
    return { eventType: "unknown" };
  }
  const eventType =
    typeof root.event_type === "string"
      ? root.event_type
      : typeof root.eventType === "string"
        ? root.eventType
        : "unknown";
  const eventId =
    typeof root.event_id === "string"
      ? root.event_id
      : typeof root.eventId === "string"
        ? root.eventId
        : undefined;
  return { eventId, eventType };
}

export const recordWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    eventType: v.string(),
    payloadHash: v.string(),
  },
  returns: v.object({ duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("providerEvents")
      .withIndex("by_provider_and_provider_event_id", (q) =>
        q.eq("provider", "agentmail").eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (existing !== null) {
      return { duplicate: true };
    }
    await ctx.db.insert("providerEvents", {
      provider: "agentmail",
      providerEventId: args.providerEventId,
      eventType: args.eventType,
      payloadHash: args.payloadHash,
      status: "received",
      receivedAt: Date.now(),
    });
    return { duplicate: false };
  },
});

export const completeWebhookEvent = internalMutation({
  args: {
    providerEventId: v.string(),
    status: eventStatus,
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("providerEvents")
      .withIndex("by_provider_and_provider_event_id", (q) =>
        q.eq("provider", "agentmail").eq("providerEventId", args.providerEventId),
      )
      .unique();
    if (event === null || event.status !== "received") {
      return null;
    }
    await ctx.db.patch(event._id, {
      status: args.status,
      processedAt: Date.now(),
      error: args.error?.slice(0, 500),
    });
    return null;
  },
});

export const processInboundMessage = internalAction({
  args: {
    providerEventId: v.string(),
    inboxId: v.string(),
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    needsFullFetch: v.boolean(),
    htmlAvailable: v.boolean(),
    receivedAt: v.number(),
    retryCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const mailbox = await ctx.runQuery(
        internal.mailboxes.getByProviderInboxId,
        { providerInboxId: args.inboxId },
      );
      if (mailbox === null) {
        await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
          providerEventId: args.providerEventId,
          status: "ignored",
          error: "Webhook inbox is not assigned to an active RoomScout mailbox.",
        });
        return null;
      }

      let body = args.body;
      let from = args.from;
      let to = args.to;
      let subject = args.subject;
      let receivedAt = args.receivedAt;
      let htmlAvailable = args.htmlAvailable;
      if (args.needsFullFetch) {
        const apiKey = envValue("AGENTMAIL_API_KEY");
        if (!apiKey) {
          throw new Error("AgentMail API key is required to fetch message content.");
        }
        const full = await createClient(apiKey).inboxes.messages.get(
          args.inboxId,
          args.providerMessageId,
        );
        if (
          full.inboxId !== args.inboxId ||
          full.threadId !== args.providerThreadId ||
          full.messageId !== args.providerMessageId
        ) {
          throw new Error("Fetched AgentMail message identifiers do not match webhook.");
        }
        body = bestMessageBody({
          extractedText: full.extractedText,
          text: full.text,
          preview: full.preview,
          html: full.html,
        });
        from = full.from;
        to = full.to;
        subject = full.subject ?? subject;
        receivedAt = full.timestamp.getTime();
        htmlAvailable = full.html !== undefined;
      }

      const messageId = await ctx.runMutation(internal.inbox.storeInboundMessage, {
        mailboxId: mailbox.mailboxId,
        providerThreadId: args.providerThreadId,
        providerMessageId: args.providerMessageId,
        providerEventId: args.providerEventId,
        from,
        to,
        subject,
        body,
        htmlAvailable,
        receivedAt,
      });
      if (messageId === null && args.retryCount < 3) {
        await ctx.scheduler.runAfter(
          (args.retryCount + 1) * 1_000,
          internal.agentmail.processInboundMessage,
          {
            ...args,
            body,
            needsFullFetch: false,
            from,
            to,
            subject,
            receivedAt,
            htmlAvailable,
            retryCount: args.retryCount + 1,
          },
        );
        return null;
      }
      const mailboxMessageId = messageId === null
        ? await ctx.runMutation(internal.inbox.storeMailboxMessage, {
            mailboxId: mailbox.mailboxId,
            providerThreadId: args.providerThreadId,
            providerMessageId: args.providerMessageId,
            providerEventId: args.providerEventId,
            from,
            to,
            subject,
            body,
            htmlAvailable,
            receivedAt,
          })
        : null;
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: args.providerEventId,
        status: messageId === null && mailboxMessageId === null ? "ignored" : "processed",
        error: undefined,
      });
      if (messageId !== null) {
        // Parsing can annotate the reply, but no action in this flow sends a reply.
        await ctx.scheduler.runAfter(0, internal.inbox.parseInboundReply, {
          messageId,
        });
      }
    } catch (error) {
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: args.providerEventId,
        status: "failed",
        error: safeError(error, "Inbound processing failed"),
      });
    }
    return null;
  },
});

export const processDeliveryEvent = internalAction({
  args: {
    providerEventId: v.string(),
    inboxId: v.string(),
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    status: deliveryStatus,
    eventAt: v.number(),
    error: v.optional(v.string()),
    retryCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const mailbox = await ctx.runQuery(
        internal.mailboxes.getByProviderInboxId,
        { providerInboxId: args.inboxId },
      );
      if (mailbox === null) {
        await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
          providerEventId: args.providerEventId,
          status: "ignored",
          error: "Delivery event inbox is not assigned to RoomScout.",
        });
        return null;
      }
      const applied = await ctx.runMutation(internal.inbox.applyDeliveryEvent, {
        mailboxId: mailbox.mailboxId,
        providerThreadId: args.providerThreadId,
        providerMessageId: args.providerMessageId,
        status: args.status,
        eventAt: args.eventAt,
        error: args.error,
      });
      if (!applied && args.retryCount < 3) {
        await ctx.scheduler.runAfter(
          (args.retryCount + 1) * 1_000,
          internal.agentmail.processDeliveryEvent,
          { ...args, retryCount: args.retryCount + 1 },
        );
        return null;
      }
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: args.providerEventId,
        status: applied ? "processed" : "ignored",
        error: applied
          ? undefined
          : "No matching message was found for the mailbox and provider thread.",
      });
    } catch (error) {
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: args.providerEventId,
        status: "failed",
        error: safeError(error, "Delivery event processing failed"),
      });
    }
    return null;
  },
});

export const sendApprovedDraft = internalAction({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await ctx.runQuery(internal.mailboxes.getDraftOwner, {
      draftId: args.draftId,
    });
    if (ownerId === null) {
      return null;
    }
    const mailbox = await ctx.runAction(internal.mailboxes.ensureForOwner, {
      ownerId,
    });
    if (mailbox.status === "pending") {
      await ctx.scheduler.runAfter(2_000, internal.agentmail.sendApprovedDraft, args);
      return null;
    }
    if (mailbox.status !== "active") {
      return null;
    }

    await roomScoutRateLimiter.limit(ctx, "agentMailUser", {
      key: ownerId,
      throws: true,
    });
    await roomScoutRateLimiter.limit(ctx, "agentMailGlobal", { throws: true });

    // This mutation is the final exact-content approval gate. Provisioning occurs
    // first so a failed mailbox setup never consumes an otherwise valid approval.
    const envelope = await ctx.runMutation(internal.outreach.claimApprovedSend, {
      draftId: args.draftId,
    });
    if (!envelope.shouldSend) {
      return null;
    }
    const apiKey = envValue("AGENTMAIL_API_KEY");
    if (!apiKey) {
      await ctx.runMutation(internal.outreach.markSendFailed, {
        draftId: envelope.draftId,
        idempotencyKey: envelope.idempotencyKey,
        error: "AgentMail is not configured.",
      });
      return null;
    }

    try {
      const sent = await createClient(apiKey).inboxes.messages.send(
        mailbox.providerInboxId,
        {
          to: [envelope.recipientEmail],
          subject: envelope.subject,
          text: envelope.body,
        },
        { idempotencyKey: envelope.idempotencyKey },
      );
      const threadId = await ctx.runMutation(internal.outreach.markSent, {
        draftId: envelope.draftId,
        idempotencyKey: envelope.idempotencyKey,
        providerMessageId: sent.messageId,
        providerThreadId: sent.threadId,
        from: mailbox.emailAddress,
      });
      if (threadId !== null) {
        await ctx.runMutation(internal.inbox.attachMailboxToSentMessage, {
          threadId,
          mailboxId: mailbox.mailboxId,
          providerInboxId: mailbox.providerInboxId,
          providerMessageId: sent.messageId,
        });
      }
    } catch (error) {
      await ctx.runMutation(internal.outreach.markSendFailed, {
        draftId: envelope.draftId,
        idempotencyKey: envelope.idempotencyKey,
        error: safeError(error, "AgentMail send failed"),
      });
    }
    return null;
  },
});

export const webhook = httpAction(async (ctx, request) => {
  const secret = envValue("AGENTMAIL_WEBHOOK_SECRET");
  if (!secret) {
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  const body = await request.text();
  if (body.length > 1_100_000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  const verified = await verifySvixWebhook({
    body,
    messageId: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret,
  });
  if (!verified) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const metadata = eventMetadata(payload);
  const eventId = metadata.eventId ?? request.headers.get("svix-id") ?? "";
  if (!eventId) {
    return Response.json({ error: "Missing event ID" }, { status: 400 });
  }
  const receipt = await ctx.runMutation(internal.agentmail.recordWebhookEvent, {
    providerEventId: eventId,
    eventType: metadata.eventType,
    payloadHash: stableFingerprint(body),
  });
  if (receipt.duplicate) {
    return new Response(null, { status: 200 });
  }

  const event = parseAgentMailEvent(payload);
  if (event === null) {
    const supported = new Set([
      "message.received",
      "message.sent",
      "message.delivered",
      "message.bounced",
      "message.rejected",
      "message.complained",
    ]).has(metadata.eventType);
    await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
      providerEventId: eventId,
      status: supported ? "failed" : "ignored",
      error: supported ? "Malformed AgentMail event payload." : undefined,
    });
    return new Response(null, { status: 200 });
  }

  if (event.kind === "received") {
    await ctx.scheduler.runAfter(0, internal.agentmail.processInboundMessage, {
      providerEventId: eventId,
      inboxId: event.inboxId,
      providerThreadId: event.providerThreadId,
      providerMessageId: event.providerMessageId,
      from: event.from,
      to: event.to,
      subject: event.subject,
      body: event.body,
      needsFullFetch: event.needsFullFetch,
      htmlAvailable: event.htmlAvailable,
      receivedAt: event.occurredAt,
      retryCount: 0,
    });
  } else {
    await ctx.scheduler.runAfter(0, internal.agentmail.processDeliveryEvent, {
      providerEventId: eventId,
      inboxId: event.inboxId,
      providerThreadId: event.providerThreadId,
      providerMessageId: event.providerMessageId,
      status: event.status,
      eventAt: event.occurredAt,
      error: event.error,
      retryCount: 0,
    });
  }
  return new Response(null, { status: 200 });
});
