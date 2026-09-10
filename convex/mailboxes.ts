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
import { stableFingerprint } from "./integrations/fingerprints";

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

const controlledMailboxResult = v.object({
  status: v.literal("active"),
  mailboxId: v.id("userMailboxes"),
  providerInboxId: v.string(),
  emailAddress: v.string(),
  reused: v.boolean(),
});

const controlledScopedInboxInspection = v.object({
  count: v.number(),
  hasMore: v.boolean(),
  inboxFingerprint: v.optional(v.string()),
});

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

type ControlledMailboxResult = {
  status: "active";
  mailboxId: Id<"userMailboxes">;
  providerInboxId: string;
  emailAddress: string;
  reused: boolean;
};

type AccessibleInboxPage = {
  inboxes: Array<{ inboxId: string; email: string; clientId?: string }>;
  hasMore: boolean;
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

export function mailboxUsername(
  roomScoutUsername: string,
): string {
  return roomScoutUsername
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "musician";
}

export function collisionSafeMailboxUsername(
  roomScoutUsername: string,
  clientId: string,
): string {
  const digest = clientId.replace(/^roomscout-user-/, "").toLowerCase();
  return `${mailboxUsername(roomScoutUsername).slice(0, 23)}-${digest.slice(0, 8)}`;
}

function isMailboxUsernameCollision(error: unknown): boolean {
  return error instanceof Error && /(?:error|status)\s+409\b/i.test(error.message);
}

function controlledInboxFingerprint(inbox: {
  inboxId: string;
  email: string;
}): string {
  return stableFingerprint(
    `${inbox.inboxId}\n${inbox.email.trim().toLowerCase()}`,
  );
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

export const getProvisioningUsername = internalQuery({
  args: { ownerId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => (await ctx.db.get(args.ownerId))?.username ?? null,
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

export const assignControlledScopedInbox = internalMutation({
  args: {
    ownerId: v.id("users"),
    providerInboxId: v.string(),
    emailAddress: v.string(),
    clientId: v.string(),
  },
  returns: controlledMailboxResult,
  handler: async (ctx, args) => {
    if ((await ctx.db.get(args.ownerId)) === null) {
      throw new ConvexError({ code: "USER_NOT_FOUND" });
    }
    const [ownerMailbox, inboxMailbox] = await Promise.all([
      ctx.db
        .query("userMailboxes")
        .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
        .unique(),
      ctx.db
        .query("userMailboxes")
        .withIndex("by_provider_inbox_id", (q) =>
          q.eq("providerInboxId", args.providerInboxId),
        )
        .unique(),
    ]);
    if (inboxMailbox && inboxMailbox.ownerId !== args.ownerId) {
      throw new ConvexError({ code: "PROVIDER_INBOX_ALREADY_ASSIGNED" });
    }
    if (
      ownerMailbox?.providerInboxId &&
      ownerMailbox.providerInboxId !== args.providerInboxId
    ) {
      throw new ConvexError({ code: "OWNER_ALREADY_HAS_DIFFERENT_INBOX" });
    }
    if (ownerMailbox?.status === "disabled") {
      throw new ConvexError({ code: "OWNER_MAILBOX_DISABLED" });
    }
    if (
      ownerMailbox?.status === "active" &&
      ownerMailbox.providerInboxId === args.providerInboxId &&
      ownerMailbox.emailAddress === args.emailAddress
    ) {
      return {
        status: "active" as const,
        mailboxId: ownerMailbox._id,
        providerInboxId: args.providerInboxId,
        emailAddress: args.emailAddress,
        reused: true,
      };
    }
    const now = Date.now();
    const patch = {
      providerInboxId: args.providerInboxId,
      emailAddress: args.emailAddress,
      clientId: args.clientId,
      status: "active" as const,
      provisioningToken: undefined,
      lastError: undefined,
      updatedAt: now,
    };
    const mailboxId = ownerMailbox
      ? ownerMailbox._id
      : await ctx.db.insert("userMailboxes", {
          ownerId: args.ownerId,
          provider: "agentmail",
          ...patch,
          createdAt: now,
        });
    if (ownerMailbox) await ctx.db.patch(ownerMailbox._id, patch);
    return {
      status: "active" as const,
      mailboxId,
      providerInboxId: args.providerInboxId,
      emailAddress: args.emailAddress,
      reused: false,
    };
  },
});

/**
 * Explicitly map the sole inbox visible to an inbox-scoped demo credential.
 * This never creates an AgentMail inbox and never sends mail.
 */
export const bootstrapControlledScopedInbox = internalAction({
  args: {
    ownerId: v.id("users"),
    expectedInboxFingerprint: v.string(),
    confirmation: v.literal("MAP_EXISTING_SCOPED_INBOX"),
  },
  returns: controlledMailboxResult,
  handler: async (ctx, args): Promise<ControlledMailboxResult> => {
    const page: AccessibleInboxPage = await ctx.runAction(
      internal.agentmailComponent.listAccessibleInboxes,
      {},
    );
    if (page.hasMore || page.inboxes.length !== 1) {
      throw new ConvexError({ code: "EXPECTED_EXACTLY_ONE_SCOPED_INBOX" });
    }
    const inbox = page.inboxes[0];
    if (!inbox) {
      throw new ConvexError({ code: "EXPECTED_EXACTLY_ONE_SCOPED_INBOX" });
    }
    if (controlledInboxFingerprint(inbox) !== args.expectedInboxFingerprint) {
      throw new ConvexError({ code: "SCOPED_INBOX_CONFIRMATION_MISMATCH" });
    }
    return await ctx.runMutation(
      internal.mailboxes.assignControlledScopedInbox,
      {
        ownerId: args.ownerId,
        providerInboxId: inbox.inboxId,
        emailAddress: inbox.email,
        clientId: `roomscout-controlled-${stableFingerprint(inbox.inboxId)}`,
      },
    );
  },
});

/** Read-only preflight; returns no provider inbox identifier or address. */
export const inspectControlledScopedInbox = internalAction({
  args: {},
  returns: controlledScopedInboxInspection,
  handler: async (ctx) => {
    const page: AccessibleInboxPage = await ctx.runAction(
      internal.agentmailComponent.listAccessibleInboxes,
      {},
    );
    const inbox = page.inboxes.length === 1 ? page.inboxes[0] : undefined;
    return {
      count: page.inboxes.length,
      hasMore: page.hasMore,
      ...(inbox && !page.hasMore
        ? { inboxFingerprint: controlledInboxFingerprint(inbox) }
        : {}),
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
    if (!await ctx.runQuery(internal.devUserReset.userMayRunWork, { userId: args.ownerId })) {
      return { status: "disabled" as const };
    }
    const apiKey = envValue("AGENTMAIL_API_KEY");
    const salt =
      envValue("AGENTMAIL_ADDRESS_SALT") ?? envValue("AGENTMAIL_MAILBOX_SALT");
    if (!apiKey || !salt) {
      return {
        status: "failed" as const,
        error: "AgentMail per-user mailbox provisioning is not configured.",
      };
    }
    const roomScoutUsername: string | null = await ctx.runQuery(
      internal.mailboxes.getProvisioningUsername,
      { ownerId: args.ownerId },
    );
    if (roomScoutUsername === null) {
      return { status: "failed" as const, error: "RoomScout user was not found." };
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
          username: mailboxUsername(roomScoutUsername),
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
        if (!inbox && isMailboxUsernameCollision(createError)) {
          try {
            inbox = await ctx.runAction(internal.agentmailComponent.createInbox, {
              username: collisionSafeMailboxUsername(
                roomScoutUsername,
                claim.clientId,
              ),
              domain:
                envValue("AGENTMAIL_DOMAIN") ?? envValue("AGENTMAIL_INBOX_DOMAIN"),
              displayName: "RoomScout",
              clientId: claim.clientId,
            });
          } catch (fallbackError) {
            inbox = await ctx.runAction(
              internal.agentmailComponent.findInboxByClientId,
              { clientId: claim.clientId },
            );
            if (!inbox) throw fallbackError;
          }
        } else if (!inbox) {
          throw createError;
        }
      }
      if (!await ctx.runQuery(internal.devUserReset.userMayRunWork, { userId: args.ownerId })) {
        await ctx.runAction(internal.agentmailComponent.deleteInbox, { inboxId: inbox.inboxId });
        return { status: "disabled" as const };
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

export const provisionAfterSignup = internalAction({
  args: { ownerId: v.id("users"), attempt: v.number() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (!Number.isInteger(args.attempt) || args.attempt < 0 || args.attempt > 3) {
      throw new ConvexError({ code: "INVALID_PROVISIONING_ATTEMPT" });
    }
    const result: EnsuredMailbox = await ctx.runAction(
      internal.mailboxes.ensureForOwner,
      { ownerId: args.ownerId },
    );
    const configured =
      result.status !== "failed" ||
      result.error !== "AgentMail per-user mailbox provisioning is not configured.";
    if (
      configured &&
      result.status !== "active" &&
      result.status !== "disabled" &&
      args.attempt < 3
    ) {
      await ctx.scheduler.runAfter(
        2_000 * 2 ** args.attempt,
        internal.mailboxes.provisionAfterSignup,
        { ownerId: args.ownerId, attempt: args.attempt + 1 },
      );
    }
    return null;
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
