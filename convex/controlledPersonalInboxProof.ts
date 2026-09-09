import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { envValue } from "./integrations/env";
import {
  approveControlledDemoConnectionCore,
  requestConnectionForOwner,
} from "./portalConnections";

const CONFIRMATION = "RUN_CONTROLLED_PERSONAL_INBOX_PROOF_DEVELOPMENT" as const;
const DEV_CLOUD_URL = "https://perceptive-antelope-445.eu-west-1.convex.cloud";
const DEV_SITE_URL = "https://perceptive-antelope-445.eu-west-1.convex.site";
const ACTORS = [
  { key: "actor_a" as const, username: "roomscout-backend-proof-actor-a" },
  { key: "actor_b" as const, username: "roomscout-backend-proof-actor-b" },
];

const confirmationValidator = v.literal(CONFIRMATION);
const actorKeyValidator = v.union(v.literal("actor_a"), v.literal("actor_b"));

type ActorKey = "actor_a" | "actor_b";
type EnsureResult =
  | {
      status: "active";
      mailboxId?: Id<"userMailboxes">;
      providerInboxId?: string;
    }
  | { status: "pending" }
  | { status: "disabled" }
  | { status: "failed"; error: string };
type ActorResolution = {
  key: ActorKey;
  ownerId: Id<"users">;
  mailboxActive: boolean;
};
type PrepareActorsResult = {
  actorCount: 2;
  createdCount: number;
  reusedCount: number;
};
type ProvisionResult = {
  actorCount: 2;
  activeCount: number;
  distinct: boolean;
  reusedCount: number;
  failedCodes: string[];
};
type PreparedConnection = { key: ActorKey; connectionId: Id<"portalConnections"> };

export function assertControlledProofDevelopment(input: {
  cloudUrl?: string;
  siteUrl?: string;
}): void {
  if (input.cloudUrl !== DEV_CLOUD_URL && input.siteUrl !== DEV_SITE_URL) {
    throw new ConvexError({ code: "CONTROLLED_PROOF_DEVELOPMENT_ONLY" });
  }
}

function developmentGuard(): void {
  assertControlledProofDevelopment({
    cloudUrl: envValue("CONVEX_CLOUD_URL"),
    siteUrl: envValue("CONVEX_SITE_URL"),
  });
}

function safeFailureCode(result: EnsureResult): string | null {
  if (result.status === "active") return null;
  if (result.status === "pending") return "PROVISIONING_PENDING";
  if (result.status === "disabled") return "MAILBOX_DISABLED";
  return result.error === "AgentMail per-user mailbox provisioning is not configured."
    ? "AGENTMAIL_NOT_CONFIGURED"
    : "MAILBOX_PROVISION_FAILED";
}

/** Provider-independent coordinator used by the action and deterministic tests. */
export async function coordinateControlledProvisioning(
  actorKeys: readonly ActorKey[],
  ensure: (key: ActorKey) => Promise<EnsureResult>,
): Promise<Map<ActorKey, EnsureResult>> {
  const firstWave = await Promise.all(
    actorKeys.flatMap((key) => [ensure(key), ensure(key)]),
  );
  const final = new Map<ActorKey, EnsureResult>();
  actorKeys.forEach((key, index) => {
    const pair = firstWave.slice(index * 2, index * 2 + 2);
    final.set(key, pair.find((result) => result.status === "active") ?? pair[1]!);
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const pending = actorKeys.filter((key) => final.get(key)?.status === "pending");
    if (pending.length === 0) break;
    const retried = await Promise.all(pending.map((key) => ensure(key)));
    pending.forEach((key, index) => final.set(key, retried[index]!));
  }
  return final;
}

export const prepareActors = internalMutation({
  args: { confirmation: confirmationValidator },
  returns: v.object({ actorCount: v.literal(2), createdCount: v.number(), reusedCount: v.number() }),
  handler: async (ctx): Promise<PrepareActorsResult> => {
    developmentGuard();
    let createdCount = 0;
    let reusedCount = 0;
    for (const actor of ACTORS) {
      const [marked, usernameRows] = await Promise.all([
        ctx.db.query("users").withIndex("by_controlled_proof_actor_key", (q) => q.eq("controlledProofActorKey", actor.key)).take(2),
        ctx.db.query("users").withIndex("by_username", (q) => q.eq("username", actor.username)).take(2),
      ]);
      if (marked.length > 1 || usernameRows.length > 1) {
        throw new ConvexError({ code: "CONTROLLED_PROOF_ACTOR_COLLISION" });
      }
      const existing = marked[0] ?? usernameRows[0];
      if (existing) {
        if (existing.controlledProofActorKey !== actor.key || existing.username !== actor.username || existing.role !== "musician") {
          throw new ConvexError({ code: "CONTROLLED_PROOF_ACTOR_COLLISION" });
        }
        reusedCount += 1;
        continue;
      }
      const now = Date.now();
      await ctx.db.insert("users", {
        username: actor.username,
        displayName: actor.key === "actor_a" ? "Backend Proof Actor A" : "Backend Proof Actor B",
        role: "musician",
        controlledProofActorKey: actor.key,
        createdAt: now,
        lastSeenAt: now,
      });
      createdCount += 1;
    }
    return { actorCount: 2 as const, createdCount, reusedCount };
  },
});

export const resolveActors = internalQuery({
  args: { confirmation: confirmationValidator },
  returns: v.array(v.object({ key: actorKeyValidator, ownerId: v.id("users"), mailboxActive: v.boolean() })),
  handler: async (ctx): Promise<ActorResolution[]> => {
    developmentGuard();
    const result: ActorResolution[] = [];
    for (const actor of ACTORS) {
      const user = await ctx.db.query("users").withIndex("by_controlled_proof_actor_key", (q) => q.eq("controlledProofActorKey", actor.key)).unique();
      if (!user || user.username !== actor.username || user.role !== "musician") {
        throw new ConvexError({ code: "CONTROLLED_PROOF_ACTORS_NOT_PREPARED" });
      }
      const mailbox = await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
      result.push({ key: actor.key, ownerId: user._id, mailboxActive: mailbox?.status === "active" });
    }
    return result;
  },
});

export const provision = internalAction({
  args: { confirmation: confirmationValidator },
  returns: v.object({ actorCount: v.literal(2), activeCount: v.number(), distinct: v.boolean(), reusedCount: v.number(), failedCodes: v.array(v.string()) }),
  handler: async (ctx): Promise<ProvisionResult> => {
    developmentGuard();
    const actors = await ctx.runQuery(internal.controlledPersonalInboxProof.resolveActors, { confirmation: CONFIRMATION });
    const byKey = new Map(actors.map((actor) => [actor.key, actor]));
    const results = await coordinateControlledProvisioning(
      ACTORS.map((actor) => actor.key),
      async (key) => {
        const actor = byKey.get(key);
        if (!actor) return { status: "failed", error: "ACTOR_NOT_FOUND" };
        return await ctx.runAction(internal.mailboxes.ensureForOwner, { ownerId: actor.ownerId });
      },
    );
    const active = ACTORS.map((actor) => results.get(actor.key)).filter(
      (result): result is Extract<EnsureResult, { status: "active" }> => result?.status === "active",
    );
    const failedCodes = ACTORS.map((actor) => safeFailureCode(results.get(actor.key) ?? { status: "failed", error: "NO_RESULT" })).filter((code): code is string => code !== null);
    return {
      actorCount: 2 as const,
      activeCount: active.length,
      distinct:
        active.length === 2 &&
        active.every((result) => result.mailboxId && result.providerInboxId) &&
        new Set(active.map((result) => String(result.mailboxId))).size === 2 &&
        new Set(active.map((result) => result.providerInboxId)).size === 2,
      reusedCount: actors.filter((actor) => actor.mailboxActive).length,
      failedCodes,
    };
  },
});

export const prepareConnections = internalMutation({
  args: { confirmation: confirmationValidator },
  returns: v.object({
    actorCount: v.literal(2),
    preparedCount: v.number(),
    reusedActiveCount: v.number(),
    reauthRequiredCount: v.number(),
    driftCount: v.number(),
  }),
  handler: async (ctx): Promise<{
    actorCount: 2;
    preparedCount: number;
    reusedActiveCount: number;
    reauthRequiredCount: number;
    driftCount: number;
  }> => {
    developmentGuard();
    const source = await ctx.db.query("sources").withIndex("by_slug", (q) => q.eq("slug", "roomscout-dev-connected")).unique();
    if (!source) throw new ConvexError({ code: "CONTROLLED_DEMO_SOURCE_REQUIRED" });
    let preparedCount = 0;
    let reusedActiveCount = 0;
    let reauthRequiredCount = 0;
    let driftCount = 0;
    for (const actor of ACTORS) {
      const user = await ctx.db.query("users").withIndex("by_controlled_proof_actor_key", (q) => q.eq("controlledProofActorKey", actor.key)).unique();
      if (!user || user.username !== actor.username || user.role !== "musician") {
        throw new ConvexError({ code: "CONTROLLED_PROOF_ACTORS_NOT_PREPARED" });
      }
      const connectionId = await requestConnectionForOwner(ctx, {
        ownerId: user._id,
        sourceId: source._id,
        label: `Controlled proof ${actor.key}`,
      });
      try {
        const outcome = await approveControlledDemoConnectionCore(ctx, connectionId, { preserveEstablishedState: true });
        if (outcome === "prepared") preparedCount += 1;
        else if (outcome === "reused_active") reusedActiveCount += 1;
        else reauthRequiredCount += 1;
      } catch (error) {
        if (error instanceof ConvexError && error.data && typeof error.data === "object" && "code" in error.data && error.data.code === "CONTROLLED_DEMO_CONNECTION_DRIFT") {
          driftCount += 1;
          continue;
        }
        throw error;
      }
    }
    return { actorCount: 2 as const, preparedCount, reusedActiveCount, reauthRequiredCount, driftCount };
  },
});

export const resolveConnections = internalQuery({
  args: { confirmation: confirmationValidator },
  returns: v.array(v.object({ key: actorKeyValidator, connectionId: v.id("portalConnections") })),
  handler: async (ctx): Promise<PreparedConnection[]> => {
    developmentGuard();
    const source = await ctx.db.query("sources").withIndex("by_slug", (q) => q.eq("slug", "roomscout-dev-connected")).unique();
    if (!source) throw new ConvexError({ code: "CONTROLLED_DEMO_SOURCE_REQUIRED" });
    const result: PreparedConnection[] = [];
    for (const actor of ACTORS) {
      const user = await ctx.db.query("users").withIndex("by_controlled_proof_actor_key", (q) => q.eq("controlledProofActorKey", actor.key)).unique();
      if (!user || user.username !== actor.username || user.role !== "musician") throw new ConvexError({ code: "CONTROLLED_PROOF_ACTORS_NOT_PREPARED" });
      const connection = await ctx.db.query("portalConnections").withIndex("by_owner_and_source", (q) => q.eq("ownerId", user._id).eq("sourceId", source._id)).unique();
      if (!connection) throw new ConvexError({ code: "CONTROLLED_PROOF_CONNECTIONS_NOT_PREPARED" });
      result.push({ key: actor.key, connectionId: connection._id });
    }
    return result;
  },
});

export const inspect = internalQuery({
  args: { confirmation: confirmationValidator },
  returns: v.object({
    actorCount: v.number(), activeMailboxCount: v.number(), distinctMailboxCount: v.number(),
    persistedInboundEvidenceCount: v.number(), controlledConnectionCount: v.number(),
    completedAuthenticationCount: v.number(), readyContextCount: v.number(),
    backendOwnedSyntheticActors: v.literal(true), publicAuthSignupProven: v.literal(false),
    signedWebhookProof: v.literal(false), liveSignedEventProofRequired: v.literal(true),
  }),
  handler: async (ctx) => {
    developmentGuard();
    let actorCount = 0;
    let activeMailboxCount = 0;
    let persistedInboundEvidenceCount = 0;
    let controlledConnectionCount = 0;
    let completedAuthenticationCount = 0;
    let readyContextCount = 0;
    const providerInboxIds = new Set<string>();
    for (const actor of ACTORS) {
      const user = await ctx.db.query("users").withIndex("by_controlled_proof_actor_key", (q) => q.eq("controlledProofActorKey", actor.key)).unique();
      if (!user || user.username !== actor.username || user.role !== "musician") continue;
      actorCount += 1;
      const mailbox = await ctx.db.query("userMailboxes").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).unique();
      if (mailbox?.status === "active" && mailbox.providerInboxId) {
        activeMailboxCount += 1;
        providerInboxIds.add(mailbox.providerInboxId);
        const messages = await ctx.db.query("mailboxMessages").withIndex("by_owner_and_received_at", (q) => q.eq("ownerId", user._id).gte("receivedAt", mailbox.updatedAt)).take(20);
        if (messages.some((message) => message.mailboxId === mailbox._id && message.providerEventId.length > 0)) persistedInboundEvidenceCount += 1;
      }
      const connections = await ctx.db.query("portalConnections").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).take(20);
      for (const connection of connections) {
        const source = await ctx.db.get(connection.sourceId);
        if (source?.slug !== "roomscout-dev-connected" || source.baseUrl !== "https://roomscout.dev" || connection.adapterKey !== "roomscout-dev-v1" || connection.policyDecision !== "allowed") continue;
        controlledConnectionCount += 1;
        const runs = await ctx.db.query("browserRuns").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).order("desc").take(20);
        if (runs.some((run) => run.kind === "authenticate" && run.status === "completed" && run.verificationMessageId)) completedAuthenticationCount += 1;
        const context = await ctx.db.query("browserContexts").withIndex("by_connection", (q) => q.eq("connectionId", connection._id)).order("desc").first();
        if (context?.status === "ready") readyContextCount += 1;
      }
    }
    return {
      actorCount, activeMailboxCount, distinctMailboxCount: providerInboxIds.size,
      persistedInboundEvidenceCount, controlledConnectionCount,
      completedAuthenticationCount, readyContextCount,
      backendOwnedSyntheticActors: true as const, publicAuthSignupProven: false as const,
      signedWebhookProof: false as const, liveSignedEventProofRequired: true as const,
    };
  },
});
