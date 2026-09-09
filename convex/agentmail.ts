import { v } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, internalAction, internalMutation } from "./_generated/server";
import { handleAgentMailWebhook } from "./agentmailComponent";
import { envValue } from "./integrations/env";
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

function safeError(error: unknown, fallback: string): string {
  return (error instanceof Error ? error.message : fallback)
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
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
        const full = await ctx.runAction(
          internal.agentmailComponent.fetchMessage,
          {
            inboxId: args.inboxId,
            messageId: args.providerMessageId,
          },
        );
        if (
          full.inboxId !== args.inboxId ||
          full.threadId !== args.providerThreadId ||
          full.messageId !== args.providerMessageId
        ) {
          throw new Error("Fetched AgentMail message identifiers do not match webhook.");
        }
        body = full.body;
        from = full.from;
        to = full.to;
        subject = full.subject;
        receivedAt = full.occurredAt;
        htmlAvailable = full.htmlAvailable;
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
      if (mailboxMessageId !== null) {
        await ctx.runMutation(internal.portalNotifications.consumeOwnedMailboxHint, {
          ownerId: mailbox.ownerId,
          providerMessageId: args.providerMessageId,
          from,
          to,
          subject,
          body,
        });
      }
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: args.providerEventId,
        status: messageId === null && mailboxMessageId === null ? "ignored" : "processed",
        error: undefined,
      });
      // Known-thread receipt atomically enqueues the shared Scout assessment.
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

    try {
      await ctx.runMutation(internal.agentmailComponent.enqueueApprovedSend, {
        draftId: envelope.draftId,
        mailboxId: mailbox.mailboxId,
        idempotencyKey: envelope.idempotencyKey,
        recipientEmail: envelope.recipientEmail,
        subject: envelope.subject,
        body: envelope.body,
      });
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

export const executeApprovedReply = internalAction({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests") }, returns: v.null(),
  handler: async (ctx, args) => {
    await roomScoutRateLimiter.limit(ctx, "agentMailUser", { key: args.ownerId, throws: true });
    await roomScoutRateLimiter.limit(ctx, "agentMailGlobal", { throws: true });
    const claim = await ctx.runMutation(internal.externalActions.claimForExecutor, { ...args, executor: "agentmail" });
    if (claim.executionStatus !== "claimed" || claim.alreadyClaimed) return null;
    try {
      const queued = await ctx.runMutation(internal.agentmailComponent.enqueueClaimedReply, { ownerId: args.ownerId, executionId: claim.executionId });
      await ctx.scheduler.runAfter(1_000, internal.agentmail.reconcileApprovedReply, { ...args, executionId: claim.executionId, outboundId: queued.outboundId, attempt: 0 });
    } catch (error) {
      await ctx.runMutation(internal.externalActions.finishExecution, { ownerId: args.ownerId, executionId: claim.executionId, status: "failed", error: safeError(error, "AgentMail reply failed") });
    }
    return null;
  },
});

export const reconcileApprovedReply = internalAction({
  args: { ownerId: v.id("users"), requestId: v.id("actionRequests"), executionId: v.id("actionExecutions"), outboundId: v.string(), attempt: v.number() }, returns: v.null(),
  handler: async (ctx, args) => {
    const status = await ctx.runQuery(internal.agentmailComponent.getOutboundStatus, { outboundId: args.outboundId });
    if (!status) return null;
    if (status.status === "pending") {
      if (args.attempt >= 120) await ctx.runMutation(internal.externalActions.finishExecution, { ownerId: args.ownerId, executionId: args.executionId, status: "unknown", error: "AgentMail reply did not finish within 30 minutes." });
      else await ctx.scheduler.runAfter(Math.min(15_000, 1_000 * 2 ** Math.min(4, args.attempt)), internal.agentmail.reconcileApprovedReply, { ...args, attempt: args.attempt + 1 });
      return null;
    }
    if (["failed", "bounced", "rejected", "complained"].includes(status.status)) {
      await ctx.runMutation(internal.externalActions.finishExecution, { ownerId: args.ownerId, executionId: args.executionId, status: "failed", error: status.errorMessage ?? undefined });
      return null;
    }
    if (!status.threadId || !status.agentmailMessageId || !await ctx.runMutation(internal.inbox.recordOutboundActionReply, { ownerId: args.ownerId, executionId: args.executionId, outboundId: args.outboundId, providerThreadId: status.threadId, providerMessageId: status.agentmailMessageId })) {
      await ctx.runMutation(internal.externalActions.finishExecution, { ownerId: args.ownerId, executionId: args.executionId, status: "unknown", error: "AGENTMAIL_REPLY_RECEIPT_MISMATCH" });
      return null;
    }
    await ctx.runMutation(internal.externalActions.finishExecution, { ownerId: args.ownerId, executionId: args.executionId, status: "succeeded", providerThreadId: status.threadId, providerMessageId: status.agentmailMessageId });
    return null;
  },
});

export const reconcileApprovedSend = internalAction({
  args: {
    draftId: v.id("outreachDrafts"),
    mailboxId: v.id("userMailboxes"),
    idempotencyKey: v.string(),
    outboundId: v.string(),
    attempt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const [status, mailbox] = await Promise.all([
        ctx.runQuery(internal.agentmailComponent.getOutboundStatus, {
          outboundId: args.outboundId,
        }),
        ctx.runQuery(internal.mailboxes.getActiveById, {
          mailboxId: args.mailboxId,
        }),
      ]);
      if (mailbox === null) {
        throw new Error("The RoomScout AgentMail inbox is no longer active.");
      }
      if (status === null) {
        throw new Error("AgentMail component send state was not found.");
      }

      if (status.status === "pending") {
        const active = await ctx.runMutation(
          internal.outreach.touchComponentSend,
          {
            draftId: args.draftId,
            idempotencyKey: args.idempotencyKey,
            outboundId: args.outboundId,
          },
        );
        if (!active) return null;
        if (args.attempt >= 120) {
          throw new Error("AgentMail send did not finish within 30 minutes.");
        }
        const delayMs = Math.min(15_000, 1_000 * 2 ** Math.min(4, args.attempt));
        await ctx.scheduler.runAfter(
          delayMs,
          internal.agentmail.reconcileApprovedSend,
          { ...args, attempt: args.attempt + 1 },
        );
        return null;
      }

      if (status.status === "failed") {
        throw new Error(status.errorMessage ?? "AgentMail component send failed.");
      }
      if (!status.agentmailMessageId || !status.threadId) {
        throw new Error("AgentMail completed without message and thread IDs.");
      }

      const threadId = await ctx.runMutation(internal.outreach.markSent, {
        draftId: args.draftId,
        idempotencyKey: args.idempotencyKey,
        providerMessageId: status.agentmailMessageId,
        providerThreadId: status.threadId,
        from: mailbox.emailAddress,
      });
      if (threadId === null) return null;

      await ctx.runMutation(internal.inbox.attachMailboxToSentMessage, {
        threadId,
        mailboxId: mailbox.mailboxId,
        providerInboxId: mailbox.providerInboxId,
        providerMessageId: status.agentmailMessageId,
      });
      if (status.status !== "sent") {
        await ctx.runMutation(internal.inbox.applyDeliveryEvent, {
          mailboxId: mailbox.mailboxId,
          providerThreadId: status.threadId,
          providerMessageId: status.agentmailMessageId,
          status: status.status,
          eventAt: Date.now(),
          error: status.errorMessage ?? undefined,
        });
      }
    } catch (error) {
      await ctx.runMutation(internal.outreach.markSendFailed, {
        draftId: args.draftId,
        idempotencyKey: args.idempotencyKey,
        error: safeError(error, "AgentMail component reconciliation failed"),
      });
    }
    return null;
  },
});

export const webhook = httpAction(async (ctx, request) => {
  if (!envValue("AGENTMAIL_WEBHOOK_SECRET")) {
    return Response.json({ error: "Webhook is not configured" }, { status: 503 });
  }
  const body = await request.text();
  if (body.length > 1_100_000) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }
  const forwarded = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
  });
  return await handleAgentMailWebhook(ctx, forwarded);
});
