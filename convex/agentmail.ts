import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  httpAction,
  internalAction,
  internalMutation,
} from "./_generated/server";
import { stableFingerprint } from "./integrations/fingerprints";
import { verifySvixWebhook } from "./integrations/svix";
import { envValue } from "./integrations/env";

const eventStatus = v.union(
  v.literal("processed"),
  v.literal("ignored"),
  v.literal("failed"),
);

function recordOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringList(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
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
        q
          .eq("provider", "agentmail")
          .eq("providerEventId", args.providerEventId),
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
        q
          .eq("provider", "agentmail")
          .eq("providerEventId", args.providerEventId),
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
    providerThreadId: v.string(),
    providerMessageId: v.string(),
    from: v.string(),
    to: v.array(v.string()),
    subject: v.string(),
    body: v.string(),
    receivedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const messageId = await ctx.runMutation(
        internal.inbox.storeInboundMessage,
        {
          providerThreadId: args.providerThreadId,
          providerMessageId: args.providerMessageId,
          from: args.from,
          to: args.to,
          subject: args.subject,
          body: args.body,
          receivedAt: args.receivedAt,
        },
      );
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: args.providerEventId,
        status: messageId === null ? "ignored" : "processed",
      });
      if (messageId !== null) {
        await ctx.scheduler.runAfter(0, internal.inbox.parseInboundReply, {
          messageId,
        });
      }
    } catch (error) {
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: args.providerEventId,
        status: "failed",
        error: error instanceof Error ? error.message : "Inbound processing failed",
      });
    }
    return null;
  },
});

export const sendApprovedDraft = internalAction({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const envelope = await ctx.runMutation(
      internal.outreach.claimApprovedSend,
      { draftId: args.draftId },
    );
    if (!envelope.shouldSend) {
      return null;
    }

    const apiKey = envValue("AGENTMAIL_API_KEY");
    const inboxId = envValue("AGENTMAIL_INBOX_ID");
    if (!apiKey || !inboxId) {
      await ctx.runMutation(internal.outreach.markSendFailed, {
        draftId: envelope.draftId,
        idempotencyKey: envelope.idempotencyKey,
        error: "AgentMail is not configured.",
      });
      return null;
    }

    try {
      const response = await fetch(
        `https://api.agentmail.to/v0/inboxes/${encodeURIComponent(
          inboxId,
        )}/messages/send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": envelope.idempotencyKey,
          },
          body: JSON.stringify({
            to: [envelope.recipientEmail],
            subject: envelope.subject,
            text: envelope.body,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`AgentMail send failed with status ${response.status}`);
      }
      const payload = (await response.json()) as {
        message_id?: string;
        messageId?: string;
        thread_id?: string;
        threadId?: string;
      };
      const providerMessageId = payload.messageId ?? payload.message_id;
      const providerThreadId = payload.threadId ?? payload.thread_id;
      if (!providerMessageId || !providerThreadId) {
        throw new Error("AgentMail response did not include message and thread IDs");
      }
      await ctx.runMutation(internal.outreach.markSent, {
        draftId: envelope.draftId,
        idempotencyKey: envelope.idempotencyKey,
        providerMessageId,
        providerThreadId,
        from: envValue("ROOMSCOUT_FROM_EMAIL") ?? inboxId,
      });
    } catch (error) {
      await ctx.runMutation(internal.outreach.markSendFailed, {
        draftId: envelope.draftId,
        idempotencyKey: envelope.idempotencyKey,
        error: error instanceof Error ? error.message : "AgentMail send failed",
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

  let payload: Record<string, unknown>;
  try {
    payload = recordOf(JSON.parse(body)) ?? {};
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventType = stringValue(payload.event_type) ?? "unknown";
  const eventId =
    stringValue(payload.event_id) ?? request.headers.get("svix-id") ?? "";
  if (!eventId) {
    return Response.json({ error: "Missing event ID" }, { status: 400 });
  }
  const receipt = await ctx.runMutation(
    internal.agentmail.recordWebhookEvent,
    {
      providerEventId: eventId,
      eventType,
      payloadHash: stableFingerprint(body),
    },
  );
  if (receipt.duplicate) {
    return new Response(null, { status: 204 });
  }

  if (eventType !== "message.received") {
    await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
      providerEventId: eventId,
      status: "ignored",
    });
    return new Response(null, { status: 204 });
  }
  const message = recordOf(payload.message);
  if (message === null) {
    await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
      providerEventId: eventId,
      status: "failed",
      error: "Missing message payload",
    });
    return Response.json({ error: "Missing message" }, { status: 400 });
  }

  const providerThreadId = stringValue(message.thread_id);
  const providerMessageId = stringValue(message.message_id);
  if (!providerThreadId || !providerMessageId) {
    await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
      providerEventId: eventId,
      status: "failed",
      error: "Missing provider identifiers",
    });
    return Response.json({ error: "Missing identifiers" }, { status: 400 });
  }
  const timestamp = Date.parse(
    stringValue(message.timestamp) ?? stringValue(message.created_at) ?? "",
  );
  await ctx.scheduler.runAfter(0, internal.agentmail.processInboundMessage, {
    providerEventId: eventId,
    providerThreadId,
    providerMessageId,
    from:
      stringValue(message.from) ?? stringList(message.from_)[0] ?? "unknown",
    to: stringList(message.to),
    subject: stringValue(message.subject) ?? "(no subject)",
    body:
      stringValue(message.extracted_text) ??
      stringValue(message.text) ??
      stringValue(message.preview) ??
      "",
    receivedAt: Number.isFinite(timestamp) ? timestamp : Date.now(),
  });
  return new Response(null, { status: 204 });
});
