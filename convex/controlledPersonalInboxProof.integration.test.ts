/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import {
  assertControlledProofDevelopment,
  coordinateControlledProvisioning,
} from "./controlledPersonalInboxProof";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const confirmation = "RUN_CONTROLLED_PERSONAL_INBOX_PROOF_DEVELOPMENT" as const;

beforeEach(() => {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://perceptive-antelope-445.eu-west-1.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://perceptive-antelope-445.eu-west-1.convex.site");
  vi.stubEnv("AGENTMAIL_API_KEY", "test-only-key");
  vi.stubEnv("AGENTMAIL_ADDRESS_SALT", "test-only-salt");
});
afterEach(() => vi.unstubAllEnvs());

it("prepares exactly two marked synthetic actors idempotently", async () => {
  const t = convexTest(schema, modules);
  expect(await t.mutation(internal.controlledPersonalInboxProof.prepareActors, { confirmation }))
    .toEqual({ actorCount: 2, createdCount: 2, reusedCount: 0 });
  expect(await t.mutation(internal.controlledPersonalInboxProof.prepareActors, { confirmation }))
    .toEqual({ actorCount: 2, createdCount: 0, reusedCount: 2 });
});

it("rejects a fixed username collision with a non-proof user", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("users", { username: "roomscout-backend-proof-actor-a", role: "musician", createdAt: now, lastSeenAt: now });
  });
  await expect(t.mutation(internal.controlledPersonalInboxProof.prepareActors, { confirmation }))
    .rejects.toThrow("CONTROLLED_PROOF_ACTOR_COLLISION");
});

it("fails closed outside the exact Development deployment", () => {
  expect(() => assertControlledProofDevelopment({
    cloudUrl: "https://example.convex.cloud",
    siteUrl: "https://example.convex.site",
  })).toThrow("CONTROLLED_PROOF_DEVELOPMENT_ONLY");
});

it("exercises duplicate concurrency and bounded pending retries", async () => {
  const calls = new Map<string, number>();
  const results = await coordinateControlledProvisioning(["actor_a", "actor_b"], async (key) => {
    const call = (calls.get(key) ?? 0) + 1;
    calls.set(key, call);
    if (key === "actor_a") return call === 1 ? { status: "active" as const } : { status: "pending" as const };
    return call < 4 ? { status: "pending" as const } : { status: "active" as const };
  });
  expect(results.get("actor_a")?.status).toBe("active");
  expect(results.get("actor_b")?.status).toBe("active");
  expect(calls).toEqual(new Map([["actor_a", 2], ["actor_b", 4]]));
});

it("runs the registered provision action without provider calls when both inboxes already exist", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.controlledPersonalInboxProof.prepareActors, { confirmation });
  const actors = await t.query(internal.controlledPersonalInboxProof.resolveActors, { confirmation });
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const actor of actors) {
      await ctx.db.insert("userMailboxes", {
        ownerId: actor.ownerId, provider: "agentmail", providerInboxId: `ready-${actor.key}`,
        emailAddress: `${actor.key}@invalid.test`, clientId: `ready-client-${actor.key}`,
        status: "active", createdAt: now, updatedAt: now,
      });
    }
  });
  expect(await t.action(internal.controlledPersonalInboxProof.provision, { confirmation }))
    .toEqual({ actorCount: 2, activeCount: 2, distinct: true, reusedCount: 2, failedCodes: [] });
});

it("labels database evidence as persisted but never as signed webhook proof", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.controlledPersonalInboxProof.prepareActors, { confirmation });
  const actors = await t.query(internal.controlledPersonalInboxProof.resolveActors, { confirmation });
  await t.run(async (ctx) => {
    const now = Date.now();
    for (const actor of actors) {
      const mailboxId = await ctx.db.insert("userMailboxes", {
        ownerId: actor.ownerId, provider: "agentmail", providerInboxId: `inbox-${actor.key}`,
        emailAddress: `${actor.key}@invalid.test`, clientId: `client-${actor.key}`,
        status: "active", createdAt: now, updatedAt: now,
      });
      await ctx.db.insert("mailboxMessages", {
        ownerId: actor.ownerId, mailboxId, providerThreadId: `thread-${actor.key}`,
        providerMessageId: `message-${actor.key}`, providerEventId: `event-${actor.key}`,
        from: "sender@invalid.test", to: [`${actor.key}@invalid.test`], subject: "fixture", body: "fixture",
        kind: "portal_verification", status: "unread", htmlAvailable: false,
        receivedAt: now, createdAt: now, updatedAt: now,
      });
    }
  });
  expect(await t.query(internal.controlledPersonalInboxProof.inspect, { confirmation })).toMatchObject({
    actorCount: 2, activeMailboxCount: 2, distinctMailboxCount: 2,
    persistedInboundEvidenceCount: 2, signedWebhookProof: false,
    liveSignedEventProofRequired: true, publicAuthSignupProven: false,
  });
});

async function seedControlledSource(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "roomscout-dev", name: "Controlled", canonicalDomain: "roomscout.dev",
      kind: "community", status: "active", firstSeenAt: now, lastObservedAt: now,
      createdAt: now, updatedAt: now,
    });
    return await ctx.db.insert("sources", {
      platformId, slug: "roomscout-dev-connected", name: "Controlled connected",
      baseUrl: "https://roomscout.dev", side: "both", accessMode: "authenticated",
      automationReview: "approved", adapterKey: "roomscout-dev-v1", status: "paused",
      health: "healthy", createdAt: now, updatedAt: now,
    });
  });
}

it("prepares two owner-scoped controlled connections idempotently", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.controlledPersonalInboxProof.prepareActors, { confirmation });
  await seedControlledSource(t);
  expect(await t.mutation(internal.controlledPersonalInboxProof.prepareConnections, { confirmation }))
    .toEqual({ actorCount: 2, preparedCount: 2, reusedActiveCount: 0, reauthRequiredCount: 0, driftCount: 0 });
  expect(await t.mutation(internal.controlledPersonalInboxProof.prepareConnections, { confirmation }))
    .toEqual({ actorCount: 2, preparedCount: 2, reusedActiveCount: 0, reauthRequiredCount: 0, driftCount: 0 });
  expect(await t.query(internal.controlledPersonalInboxProof.resolveConnections, { confirmation })).toHaveLength(2);
});

it("preserves active connections and reports established-state drift", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.controlledPersonalInboxProof.prepareActors, { confirmation });
  await seedControlledSource(t);
  await t.mutation(internal.controlledPersonalInboxProof.prepareConnections, { confirmation });
  const connections = await t.query(internal.controlledPersonalInboxProof.resolveConnections, { confirmation });
  await t.run(async (ctx) => {
    await ctx.db.patch(connections[0]!.connectionId, { status: "active" });
    await ctx.db.patch(connections[1]!.connectionId, { status: "active", inboxPath: "/drift" });
  });
  expect(await t.mutation(internal.controlledPersonalInboxProof.prepareConnections, { confirmation }))
    .toEqual({ actorCount: 2, preparedCount: 0, reusedActiveCount: 1, reauthRequiredCount: 0, driftCount: 1 });
  const drifted = await t.run(async (ctx) => await ctx.db.get(connections[1]!.connectionId));
  expect(drifted?.status).toBe("active");
  expect(drifted?.inboxPath).toBe("/drift");
});
