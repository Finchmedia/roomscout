import {
  AgentMail,
  type AgentMailEvent,
  type OutboundId,
  vEvent,
  vOutboundStatus,
} from "@agentmail/convex";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  normalizeAgentMailInbox,
  normalizeAgentMailInboxPage,
  normalizeAgentMailMessage,
  parseAgentMailEvent,
} from "./integrations/agentmailPayload";
import {
  CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID,
  CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS,
  CONTROLLED_AGENTMAIL_WEBHOOK_URL,
  parseAgentMailWebhookPage,
  planScopedWebhookBootstrap,
  resolveScopedWebhookSigningSecret,
  signingSecretFromCreateResponse,
} from "./integrations/agentmailWebhookBootstrap";
import { envValue } from "./integrations/env";
import { stableFingerprint } from "./integrations/fingerprints";

const normalizedInbox = v.object({
  inboxId: v.string(),
  email: v.string(),
  clientId: v.optional(v.string()),
});

const normalizedMessage = v.object({
  inboxId: v.string(),
  threadId: v.string(),
  messageId: v.string(),
  from: v.string(),
  to: v.array(v.string()),
  subject: v.string(),
  body: v.string(),
  htmlAvailable: v.boolean(),
  occurredAt: v.number(),
});

const accessibleInboxPage = v.object({
  inboxes: v.array(normalizedInbox),
  hasMore: v.boolean(),
});

const outboundStatus = v.object({
  status: vOutboundStatus,
  agentmailMessageId: v.union(v.string(), v.null()),
  threadId: v.union(v.string(), v.null()),
  errorMessage: v.union(v.string(), v.null()),
});

function componentClient(): AgentMail {
  return new AgentMail(components.agentmail, {
    onEvent: internal.agentmailComponent.receiveEvent,
  });
}

async function agentmailWebhookRequest(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<unknown> {
  const apiKey = envValue("AGENTMAIL_API_KEY");
  if (!apiKey) throw new Error("AGENTMAIL_API_KEY is not configured.");
  const baseUrl = (
    envValue("AGENTMAIL_BASE_URL") ?? "https://api.agentmail.to/v0"
  ).replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    throw new Error(
      `AgentMail scoped webhook ${init.method} failed (${response.status}).`,
    );
  }
  return await response.json();
}

export async function handleAgentMailWebhook(
  ctx: unknown,
  request: Request,
): Promise<Response> {
  // Convex's HttpActionCtx and MutationCtx expose the same runMutation call
  // needed here, but their generated overloads differ in whether transaction
  // options are accepted. The component is explicitly designed for httpAction.
  return await componentClient().handleWebhook(
    ctx as Parameters<AgentMail["handleWebhook"]>[0],
    request,
  );
}

export const createInbox = internalAction({
  args: {
    username: v.string(),
    domain: v.optional(v.string()),
    displayName: v.string(),
    clientId: v.string(),
  },
  returns: normalizedInbox,
  handler: async (ctx, args) => {
    const inbox = normalizeAgentMailInbox(
      await componentClient().createInbox(ctx, args),
    );
    if (inbox === null) {
      throw new Error("AgentMail returned a malformed inbox response.");
    }
    return inbox;
  },
});

export const findInboxByClientId = internalAction({
  args: { clientId: v.string() },
  returns: v.union(normalizedInbox, v.null()),
  handler: async (ctx, args) => {
    let pageToken: string | undefined;
    for (let page = 0; page < 20; page += 1) {
      const result = normalizeAgentMailInboxPage(
        await componentClient().listInboxes(ctx, {
          limit: 100,
          pageToken,
        }),
      );
      const inbox = result.inboxes.find(
        (candidate) => candidate.clientId === args.clientId,
      );
      if (inbox) return inbox;
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    return null;
  },
});

/** Read-only provider probe used by the explicit controlled-demo bootstrap. */
export const listAccessibleInboxes = internalAction({
  args: {},
  returns: accessibleInboxPage,
  handler: async (ctx) => {
    const result = normalizeAgentMailInboxPage(
      await componentClient().listInboxes(ctx, { limit: 2 }),
    );
    return {
      inboxes: result.inboxes.slice(0, 2),
      hasMore: result.nextPageToken !== undefined,
    };
  },
});

/**
 * Create or reuse the one controlled production webhook. The only return
 * value is the signing secret so callers can pipe it directly into Convex
 * environment configuration without including inbox identifiers in args.
 */
export const bootstrapControlledScopedWebhook = internalAction({
  args: {
    confirmation: v.literal(
      "CREATE_OR_REUSE_PRODUCTION_AGENTMAIL_WEBHOOK",
    ),
  },
  returns: v.string(),
  handler: async (ctx) => {
    const inboxPage = normalizeAgentMailInboxPage(
      await componentClient().listInboxes(ctx, { limit: 2 }),
    );
    if (inboxPage.nextPageToken || inboxPage.inboxes.length !== 1) {
      throw new Error("EXPECTED_EXACTLY_ONE_SCOPED_AGENTMAIL_INBOX");
    }
    const inbox = inboxPage.inboxes[0];
    if (!inbox) {
      throw new Error("EXPECTED_EXACTLY_ONE_SCOPED_AGENTMAIL_INBOX");
    }
    const inboxPath = `/inboxes/${encodeURIComponent(inbox.inboxId)}/webhooks`;
    const page = parseAgentMailWebhookPage(
      await agentmailWebhookRequest(`${inboxPath}?limit=100`, {
        method: "GET",
      }),
    );
    if (page.hasMore) {
      throw new Error("CONTROLLED_AGENTMAIL_WEBHOOK_LIST_TRUNCATED");
    }
    const plan = planScopedWebhookBootstrap(page.webhooks);
    if (plan.kind === "reuse") {
      return resolveScopedWebhookSigningSecret(
        plan.secret,
        envValue("AGENTMAIL_WEBHOOK_SECRET"),
      );
    }

    const created = await agentmailWebhookRequest(inboxPath, {
      method: "POST",
      body: {
        url: CONTROLLED_AGENTMAIL_WEBHOOK_URL,
        event_types: CONTROLLED_AGENTMAIL_WEBHOOK_EVENTS,
        client_id: CONTROLLED_AGENTMAIL_WEBHOOK_CLIENT_ID,
      },
    });
    return signingSecretFromCreateResponse(created);
  },
});

export const fetchMessage = internalAction({
  args: { inboxId: v.string(), messageId: v.string() },
  returns: normalizedMessage,
  handler: async (ctx, args) => {
    const message = normalizeAgentMailMessage(
      await componentClient().getMessage(ctx, args.inboxId, args.messageId),
    );
    if (message === null) {
      throw new Error("AgentMail returned a malformed message response.");
    }
    return message;
  },
});

export const enqueueApprovedSend = internalMutation({
  args: {
    draftId: v.id("outreachDrafts"),
    mailboxId: v.id("userMailboxes"),
    idempotencyKey: v.string(),
    recipientEmail: v.string(),
    subject: v.string(),
    body: v.string(),
  },
  returns: v.object({ outboundId: v.string(), reused: v.boolean() }),
  handler: async (ctx, args) => {
    const [draft, mailbox] = await Promise.all([
      ctx.db.get(args.draftId),
      ctx.db.get(args.mailboxId),
    ]);
    if (
      draft === null ||
      mailbox === null ||
      draft.ownerId !== mailbox.ownerId ||
      draft.status !== "sending" ||
      draft.sendIdempotencyKey !== args.idempotencyKey ||
      draft.recipientEmail !== args.recipientEmail ||
      draft.subject !== args.subject ||
      draft.body !== args.body ||
      mailbox.status !== "active" ||
      !mailbox.providerInboxId
    ) {
      throw new Error("Approved AgentMail envelope is no longer valid.");
    }

    let outboundId = draft.agentmailComponentOutboundId;
    const reused = outboundId !== undefined;
    if (!outboundId) {
      outboundId = await componentClient().sendMessage(
        ctx,
        mailbox.providerInboxId,
        {
          to: [draft.recipientEmail],
          subject: draft.subject,
          text: draft.body,
          labels: ["roomscout", "approved-outreach"],
        },
      );
      await ctx.db.patch(draft._id, {
        agentmailComponentOutboundId: outboundId,
        mailboxId: mailbox._id,
        updatedAt: Date.now(),
      });
    }

    await ctx.scheduler.runAfter(1_000, internal.agentmail.reconcileApprovedSend, {
      draftId: draft._id,
      mailboxId: mailbox._id,
      idempotencyKey: args.idempotencyKey,
      outboundId,
      attempt: 0,
    });
    return { outboundId, reused };
  },
});

export const getOutboundStatus = internalQuery({
  args: { outboundId: v.string() },
  returns: v.union(outboundStatus, v.null()),
  handler: async (ctx, args) =>
    await componentClient().status(ctx, args.outboundId as OutboundId),
});

export const receiveEvent = internalMutation({
  args: { event: vEvent },
  returns: v.null(),
  handler: async (ctx, args) => {
    const event = args.event as AgentMailEvent;
    const receipt = await ctx.runMutation(
      internal.agentmail.recordWebhookEvent,
      {
        providerEventId: event.event_id,
        eventType: event.event_type,
        payloadHash: stableFingerprint(JSON.stringify(event)),
      },
    );
    if (receipt.duplicate) return null;

    const parsed = parseAgentMailEvent(event);
    if (parsed === null) {
      const supported = new Set([
        "message.received",
        "message.sent",
        "message.delivered",
        "message.bounced",
        "message.rejected",
        "message.complained",
      ]).has(event.event_type);
      await ctx.runMutation(internal.agentmail.completeWebhookEvent, {
        providerEventId: event.event_id,
        status: supported ? "failed" : "ignored",
        error: supported ? "Malformed AgentMail event payload." : undefined,
      });
      return null;
    }

    if (parsed.kind === "received") {
      await ctx.scheduler.runAfter(0, internal.agentmail.processInboundMessage, {
        providerEventId: event.event_id,
        inboxId: parsed.inboxId,
        providerThreadId: parsed.providerThreadId,
        providerMessageId: parsed.providerMessageId,
        from: parsed.from,
        to: parsed.to,
        subject: parsed.subject,
        body: parsed.body,
        needsFullFetch: parsed.needsFullFetch,
        htmlAvailable: parsed.htmlAvailable,
        receivedAt: parsed.occurredAt,
        retryCount: 0,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.agentmail.processDeliveryEvent, {
        providerEventId: event.event_id,
        inboxId: parsed.inboxId,
        providerThreadId: parsed.providerThreadId,
        providerMessageId: parsed.providerMessageId,
        status: parsed.status,
        eventAt: parsed.occurredAt,
        error: parsed.error,
        retryCount: 0,
      });
    }
    return null;
  },
});
