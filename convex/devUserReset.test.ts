/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import {
  assertDevelopmentReset,
  assertFleetReset,
  DEV_RESET_CONFIRMATION,
  FLEET_RESET_CONFIRMATION,
} from "./devUserReset";
import { deleteProviderResources } from "./devUserResetActions";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.stubEnv(
    "CONVEX_CLOUD_URL",
    "https://perceptive-antelope-445.eu-west-1.convex.cloud",
  );
  vi.stubEnv(
    "CONVEX_SITE_URL",
    "https://perceptive-antelope-445.eu-west-1.convex.site",
  );
});

it("fleet cleanup cannot erase app data before provider cleanup completes", async () => {
  const t = convexTest(schema, modules);
  const resetId = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", { username: "fleet-old-band", role: "musician", createdAt: now, lastSeenAt: now });
    return await ctx.db.insert("devUserResets", { targetUserId: userId, targetUsername: "fleet-old-band", status: "scheduled", phase: "quiescing", stage: 0, deletedDocumentCount: 0, providerInboxResult: "not_present", providerContextCount: 0, authUsernameReleased: false, createdAt: now, updatedAt: now });
  });
  await expect(t.mutation(internal.devUserReset.runFleetCleanupPage, { resetId, confirmation: FLEET_RESET_CONFIRMATION })).rejects.toThrow("FLEET_USER_RESET_PROVIDER_CLEANUP_REQUIRED");
});

it("allows fleet cleanup only on the named development and production deployments", () => {
  expect(() => assertFleetReset({ cloudUrl: "https://fleet-jackal-83.eu-west-1.convex.cloud", siteUrl: "https://fleet-jackal-83.eu-west-1.convex.site" })).not.toThrow();
  expect(() => assertFleetReset({ cloudUrl: "https://perceptive-antelope-445.eu-west-1.convex.cloud", siteUrl: "https://perceptive-antelope-445.eu-west-1.convex.site" })).not.toThrow();
  expect(() => assertFleetReset({ cloudUrl: "https://other.convex.cloud" })).toThrow("FLEET_USER_RESET_DEPLOYMENT_FORBIDDEN");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it("fails closed outside the exact Development deployment", () => {
  expect(() =>
    assertDevelopmentReset({
      cloudUrl: "https://production.example.convex.cloud",
      siteUrl: "https://production.example.convex.site",
    }),
  ).toThrow("DEV_USER_RESET_DEVELOPMENT_ONLY");
});

it("stops provider cleanup at the first failure", async () => {
  const deleted: string[] = [];
  await expect(
    deleteProviderResources(
      {
        providerInboxId: "inbox-1",
        providerContextIds: ["context-1", "context-2"],
      },
      {
        deleteInbox: async (id) => {
          deleted.push(id);
          return "deleted";
        },
        deleteBrowserContext: async (id) => {
          deleted.push(id);
          throw new Error("provider unavailable");
        },
      },
    ),
  ).rejects.toThrow("provider unavailable");
  expect(deleted).toEqual(["inbox-1", "context-1"]);
});

it("deletes owned rows in bounded scheduled pages and removes the user last", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const { userId, resetId } = await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      username: "disposable-test-user",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    await ctx.db.insert("savedNeeds", {
      ownerId: userId,
      title: "Disposable need",
      city: "Berlin",
      districts: [],
      arrangement: [],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    const resetId = await ctx.db.insert("devUserResets", {
      targetUserId: userId,
      targetUsername: "disposable-test-user",
      status: "scheduled",
      stage: 0,
      deletedDocumentCount: 0,
      providerInboxResult: "not_present",
      providerContextCount: 0,
      authUsernameReleased: false,
      createdAt: now,
      updatedAt: now,
    });
    return { userId, resetId };
  });

  await t.mutation(internal.devUserReset.runCleanupPage, {
    resetId,
    confirmation: DEV_RESET_CONFIRMATION,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const result = await t.run(async (ctx) => ({
    user: await ctx.db.get(userId),
    reset: await ctx.db.get(resetId),
    needs: await ctx.db
      .query("savedNeeds")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .take(1),
  }));
  expect(result.user).toBeNull();
  expect(result.needs).toEqual([]);
  expect(result.reset).toMatchObject({ status: "completed" });
});

it("previews exact targets, protects finchlandlord, and blocks cleanup while work is in flight", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const target = await ctx.db.insert("users", { username: "thejacksons", role: "musician", createdAt: now, lastSeenAt: now });
    const protectedUser = await ctx.db.insert("users", { username: "finchlandlord", role: "musician", createdAt: now, lastSeenAt: now });
    const need = await ctx.db.insert("savedNeeds", { ownerId: target, title: "old test", city: "Berlin", districts: [], arrangement: [], schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now });
    const source = await ctx.db.insert("sources", { slug: "reset-source", name: "Reset source", baseUrl: "https://example.test", side: "supply", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const connection = await ctx.db.insert("portalConnections", { ownerId: target, sourceId: source, label: "Old portal", allowedDomains: ["example.test"], allowedPaths: ["/"], status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: false, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now });
    await ctx.db.insert("browserRuns", { ownerId: target, connectionId: connection, kind: "recon", status: "running", expiresAt: now + 60_000, createdAt: now, updatedAt: now });
    return { target, protectedUser, need };
  });
  const preview = await t.query(internal.devUserReset.previewExactTargets, { targets: [{ userId: ids.target, username: "thejacksons" }], confirmation: DEV_RESET_CONFIRMATION });
  expect(preview[0]).toMatchObject({ userId: ids.target, username: "thejacksons", inFlightBrowserRuns: 1 });
  await expect(t.query(internal.devUserReset.previewExactTargets, { targets: [{ userId: ids.protectedUser, username: "finchlandlord" }], confirmation: DEV_RESET_CONFIRMATION })).rejects.toThrow("DEV_USER_RESET_PROTECTED_USER");
  expect(await t.mutation(internal.devUserReset.pauseExactTarget, { userId: ids.target, username: "thejacksons", confirmation: DEV_RESET_CONFIRMATION })).toEqual({ ready: false });
  expect(await t.run((ctx) => ctx.db.get(ids.need))).toMatchObject({ status: "paused" });
});
