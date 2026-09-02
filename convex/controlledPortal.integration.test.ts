/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("seeds the controlled portal idempotently and scopes a user connection", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const operatorId = await ctx.db.insert("users", {
      username: "operator",
      role: "operator",
      createdAt: now,
      lastSeenAt: now,
    });
    const ownerId = await ctx.db.insert("users", {
      username: "owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    return { operatorId, ownerId };
  });
  const operator = t.withIdentity({ subject: ids.operatorId });
  const owner = t.withIdentity({ subject: ids.ownerId });

  const first = await operator.mutation(
    api.sourceRegistry.seedControlledDemoPortal,
    { baseUrl: "https://roomscout.dev" },
  );
  const second = await operator.mutation(
    api.sourceRegistry.seedControlledDemoPortal,
    { baseUrl: "https://roomscout.dev" },
  );
  expect(second).toEqual(first);

  const connectionId = await owner.mutation(
    api.portalConnections.requestConnection,
    {
      sourceId: first.authenticatedSourceId,
      label: "Scout portal identity",
    },
  );
  await operator.mutation(
    api.portalConnections.approveControlledDemoConnection,
    { connectionId },
  );
  const connection = await owner.query(api.portalConnections.getMine, {
    connectionId,
  });
  expect(connection).toMatchObject({
    status: "needs_auth",
    policyDecision: "allowed",
    allowReadOnlyRecon: false,
    allowInboxPolling: true,
  });
  const stored = await t.run(async (ctx) => await ctx.db.get(connectionId));
  expect(stored?.allowedDomains).toEqual(["roomscout.dev"]);
  expect(stored?.allowedPaths).toEqual([
    "/",
    "/sign-up",
    "/sign-in",
    "/listings",
    "/inbox",
  ]);
  expect(stored?.adapterKey).toBe("roomscout-dev-v1");

  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("browserContexts", {
      connectionId,
      ownerId: ids.ownerId,
      providerContextId: "expired-provider-context",
      status: "reauth_required",
      createdAt: now,
      updatedAt: now,
    });
  });
  const workerConnection = await t.query(
    internal.portalConnections.getConnectionForWorker,
    { ownerId: ids.ownerId, connectionId },
  );
  expect(workerConnection?.providerContextId).toBeUndefined();
});

it("does not let a musician create approved first-party source records", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      username: "owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
  });
  await expect(
    t
      .withIdentity({ subject: ownerId })
      .mutation(api.sourceRegistry.seedControlledDemoPortal, {
        baseUrl: "https://roomscout.dev",
      }),
  ).rejects.toThrow();
});

it("never binds the first-party adapter to a lookalike or unrelated host", async () => {
  const t = convexTest(schema, modules);
  const operatorId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      username: "operator",
      role: "operator",
      createdAt: now,
      lastSeenAt: now,
    });
  });
  const operator = t.withIdentity({ subject: operatorId });
  await expect(
    operator.mutation(api.sourceRegistry.seedControlledDemoPortal, {
      baseUrl: "https://lookalike.roomscout.dev",
    }),
  ).rejects.toThrow("INVALID_DEMO_PORTAL_URL");
  await expect(
    operator.mutation(api.sourceRegistry.seedControlledDemoPortal, {
      baseUrl: "https://unrelated.example",
    }),
  ).rejects.toThrow("INVALID_DEMO_PORTAL_URL");
});

it("fails closed when fixed demo source slugs already belong to another portal", async () => {
  const t = convexTest(schema, modules);
  const operatorId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      username: "operator",
      role: "operator",
      createdAt: now,
      lastSeenAt: now,
    });
  });
  const operator = t.withIdentity({ subject: operatorId });
  await operator.mutation(api.sourceRegistry.seedControlledDemoPortal, {
    baseUrl: "https://roomscout.dev",
  });

  await t.run(async (ctx) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", "roomscout-dev-connected"))
      .unique();
    if (!source) throw new Error("fixture source missing");
    await ctx.db.patch(source._id, { baseUrl: "https://unrelated.example" });
  });
  await expect(
    operator.mutation(api.sourceRegistry.seedControlledDemoPortal, {
      baseUrl: "https://roomscout.dev",
    }),
  ).rejects.toThrow("DEMO_SOURCE_CONFIGURATION_CONFLICT");
});
