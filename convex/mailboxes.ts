import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireUser } from "./integrations/auth";
import { requireActionUserId } from "./integrations/authz";
import { envValue } from "./integrations/env";

const publicMailbox = v.object({
  status: v.union(
    v.literal("provisioning"),
    v.literal("active"),
    v.literal("failed"),
    v.literal("disabled"),
  ),
  emailAddress: v.optional(v.string()),
  lastError: v.optional(v.string()),
});

const ensuredMailbox = v.union(
  v.object({
    status: v.literal("active"),
    mailboxId: v.id("userMailboxes"),
    providerInboxId: v.string(),
    emailAddress: v.string(),
  }),
  v.object({ status: v.literal("pending") }),
  v.object({ status: v.literal("disabled") }),
  v.object({ status: v.literal("failed"), error: v.string() }),
);

const provisioningClaim = v.union(
  v.object({
    outcome: v.literal("ready"),
    mailboxId: v.id("userMailboxes"),
    providerInboxId: v.string(),
    emailAddress: v.string(),
  }),
  v.object({ outcome: v.literal("pending") }),
  v.object({ outcome: v.literal("disabled") }),
  v.object({
    outcome: v.literal("provision"),
    mailboxId: v.id("userMailboxes"),
    clientId: v.string(),
  }),
);

const PROVISIONING_LEASE_MS = 2 * 60 * 1_000;

type ProvisioningClaim =
  | {
      outcome: "ready";
      mailboxId: Id<"userMailboxes">;
      providerInboxId: string;
      emailAddress: string;
    }
  | { outcome: "pending" }
  | { outcome: "disabled" }
  | {
      outcome: "provision";
      mailboxId: Id<"userMailboxes">;
      clientId: string;
    };

export type EnsuredMailbox =
  | {
      status: "active";
      mailboxId: Id<"userMailboxes">;
      providerInboxId: string;
      emailAddress: string;
    }
  | { status: "pending" | "disabled" }
  | { status: "failed"; error: string };

type PublicMailbox = {
  status: "provisioning" | "active" | "failed" | "disabled";
  emailAddress?: string;
  lastError?: string;
};

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : "Mailbox provisioning failed")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 500);
}

async function mailboxDigest(ownerId: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ownerId)),
  );
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function usernameForClientId(clientId: string): string {
  const digest = clientId.replace(/^roomscout-user-/, "");
  return `rs-${digest.slice(0, 24).toLowerCase()}`;
}

export const getMine = query({
  args: {},
  returns: v.union(publicMailbox, v.null()),
  handler: async (ctx) => {
    const ownerId = await requireUser(ctx);
    const mailbox = await ctx.db
      .query("userMailboxes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    return mailbox
      ? {
          status: mailbox.status,
          emailAddress: mailbox.emailAddress,
          lastError: mailbox.lastError,
        }
      : null;
  },
});

export const getDraftOwner = internalQuery({
  args: { draftId: v.id("outreachDrafts") },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args) => {
    const draft = await ctx.db.get(args.draftId);
    return draft?.ownerId ?? null;
  },
});

export const claimProvisioning = internalMutation({
  args: {
    ownerId: v.id("users"),
    clientId: v.string(),
    provisioningToken: v.string(),
  },
  returns: provisioningClaim,
  handler: async (ctx, args) => {
    if ((await ctx.db.get(args.ownerId)) === null) {
      throw new ConvexError({ code: "USER_NOT_FOUND" });
    }
    const now = Date.now();
    const existing = await ctx.db
      .query("userMailboxes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (
      existing?.status === "active" &&
      existing.providerInboxId &&
      existing.emailAddress
    ) {
      return {
        outcome: "ready" as const,
        mailboxId: existing._id,
        providerInboxId: existing.providerInboxId,
        emailAddress: existing.emailAddress,
      };
    }
    if (existing?.status === "disabled") {
      return { outcome: "disabled" as const };
    }
    if (
      existing?.status === "provisioning" &&
      now - existing.updatedAt < PROVISIONING_LEASE_MS
    ) {
      return { outcome: "pending" as const };
    }
    if (existing) {
      const clientId = existing.clientId || args.clientId;
      await ctx.db.patch(existing._id, {
        clientId,
        status: "provisioning",
        provisioningToken: args.provisioningToken,
        lastError: undefined,
        updatedAt: now,
      });
      return {
        outcome: "provision" as const,
        mailboxId: existing._id,
        clientId,
      };
    }
    const mailboxId = await ctx.db.insert("userMailboxes", {
      ownerId: args.ownerId,
      provider: "agentmail",
      clientId: args.clientId,
      status: "provisioning",
      provisioningToken: args.provisioningToken,
      createdAt: now,
      updatedAt: now,
    });
    return {
      outcome: "provision" as const,
      mailboxId,
      clientId: args.clientId,
    };
  },
});

export const completeProvisioning = internalMutation({
  args: {
    mailboxId: v.id("userMailboxes"),
    provisioningToken: v.string(),
    providerInboxId: v.string(),
    emailAddress: v.string(),
  },
  returns: ensuredMailbox,
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (
      mailbox === null ||
      mailbox.status !== "provisioning" ||
      mailbox.provisioningToken !== args.provisioningToken
    ) {
      return { status: "pending" as const };
    }
    const collision = await ctx.db
      .query("userMailboxes")
      .withIndex("by_provider_inbox_id", (q) =>
        q.eq("providerInboxId", args.providerInboxId),
      )
      .unique();
    if (collision !== null && collision._id !== mailbox._id) {
      await ctx.db.patch(mailbox._id, {
        status: "failed",
        lastError: "Provider inbox is already assigned to another user.",
        provisioningToken: undefined,
        updatedAt: Date.now(),
      });
      return {
        status: "failed" as const,
        error: "Provider inbox assignment conflict.",
      };
    }
    await ctx.db.patch(mailbox._id, {
      status: "active",
      providerInboxId: args.providerInboxId,
      emailAddress: args.emailAddress,
      provisioningToken: undefined,
      lastError: undefined,
      updatedAt: Date.now(),
    });
    return {
      status: "active" as const,
      mailboxId: mailbox._id,
      providerInboxId: args.providerInboxId,
      emailAddress: args.emailAddress,
    };
  },
});

export const failProvisioning = internalMutation({
  args: {
    mailboxId: v.id("userMailboxes"),
    provisioningToken: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (
      mailbox !== null &&
      mailbox.status === "provisioning" &&
      mailbox.provisioningToken === args.provisioningToken
    ) {
      await ctx.db.patch(mailbox._id, {
        status: "failed",
        lastError: args.error.slice(0, 500),
        provisioningToken: undefined,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const getByProviderInboxId = internalQuery({
  args: { providerInboxId: v.string() },
  returns: v.union(
    v.object({
      mailboxId: v.id("userMailboxes"),
      ownerId: v.id("users"),
      emailAddress: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const mailbox = await ctx.db
      .query("userMailboxes")
      .withIndex("by_provider_inbox_id", (q) =>
        q.eq("providerInboxId", args.providerInboxId),
      )
      .unique();
    if (!mailbox?.emailAddress || mailbox.status !== "active") {
      return null;
    }
    return {
      mailboxId: mailbox._id,
      ownerId: mailbox.ownerId,
      emailAddress: mailbox.emailAddress,
    };
  },
});

export const getActiveById = internalQuery({
  args: { mailboxId: v.id("userMailboxes") },
  returns: v.union(
    v.object({
      mailboxId: v.id("userMailboxes"),
      ownerId: v.id("users"),
      providerInboxId: v.string(),
      emailAddress: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const mailbox = await ctx.db.get(args.mailboxId);
    if (
      mailbox === null ||
      mailbox.status !== "active" ||
      !mailbox.providerInboxId ||
      !mailbox.emailAddress
    ) {
      return null;
    }
    return {
      mailboxId: mailbox._id,
      ownerId: mailbox.ownerId,
      providerInboxId: mailbox.providerInboxId,
      emailAddress: mailbox.emailAddress,
    };
  },
});

export const ensureForOwner = internalAction({
  args: { ownerId: v.id("users") },
  returns: ensuredMailbox,
  handler: async (ctx, args): Promise<EnsuredMailbox> => {
    const apiKey = envValue("AGENTMAIL_API_KEY");
    const salt =
      envValue("AGENTMAIL_ADDRESS_SALT") ?? envValue("AGENTMAIL_MAILBOX_SALT");
    if (!apiKey || !salt) {
      return {
        status: "failed" as const,
        error: "AgentMail per-user mailbox provisioning is not configured.",
      };
    }
    const digest = await mailboxDigest(args.ownerId, salt);
    const clientId = `roomscout-user-${digest}`;
    const provisioningToken = crypto.randomUUID();
    const claim: ProvisioningClaim = await ctx.runMutation(
      internal.mailboxes.claimProvisioning,
      {
      ownerId: args.ownerId,
      clientId,
      provisioningToken,
      },
    );
    if (claim.outcome === "ready") {
      return {
        status: "active" as const,
        mailboxId: claim.mailboxId,
        providerInboxId: claim.providerInboxId,
        emailAddress: claim.emailAddress,
      };
    }
    if (claim.outcome === "pending" || claim.outcome === "disabled") {
      return { status: claim.outcome };
    }

    try {
      let inbox;
      try {
        inbox = await ctx.runAction(internal.agentmailComponent.createInbox, {
          username: usernameForClientId(claim.clientId),
          domain:
            envValue("AGENTMAIL_DOMAIN") ?? envValue("AGENTMAIL_INBOX_DOMAIN"),
          displayName: "RoomScout",
          clientId: claim.clientId,
        });
      } catch (createError) {
        inbox = await ctx.runAction(
          internal.agentmailComponent.findInboxByClientId,
          { clientId: claim.clientId },
        );
        if (!inbox) {
          throw createError;
        }
      }
      const completion: EnsuredMailbox = await ctx.runMutation(
        internal.mailboxes.completeProvisioning,
        {
        mailboxId: claim.mailboxId,
        provisioningToken,
        providerInboxId: inbox.inboxId,
        emailAddress: inbox.email,
        },
      );
      return completion;
    } catch (error) {
      const message = safeError(error);
      await ctx.runMutation(internal.mailboxes.failProvisioning, {
        mailboxId: claim.mailboxId,
        provisioningToken,
        error: message,
      });
      return { status: "failed" as const, error: message };
    }
  },
});

export const ensureMine = action({
  args: {},
  returns: publicMailbox,
  handler: async (ctx): Promise<PublicMailbox> => {
    const ownerId = await requireActionUserId(ctx);
    const result: EnsuredMailbox = await ctx.runAction(
      internal.mailboxes.ensureForOwner,
      {
      ownerId,
      },
    );
    if (result.status === "active") {
      return { status: "active" as const, emailAddress: result.emailAddress };
    }
    if (result.status === "failed") {
      return { status: "failed" as const, lastError: result.error };
    }
    return {
      status: result.status === "pending" ? "provisioning" : "disabled",
    };
  },
});
