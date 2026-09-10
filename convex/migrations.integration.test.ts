/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("migrates legacy saved-need cities to location centers and removes district constraints", async () => {
  const t = convexTest(schema, modules);
  const savedNeedId = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      username: "location-migration",
      role: "musician",
      createdAt: 1,
      lastSeenAt: 1,
    });
    return await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Legacy search",
      city: "Stuttgart",
      districts: ["West", "Süd"],
      arrangement: ["shared"],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: 1,
      updatedAt: 1,
    });
  });

  await expect(t.mutation(internal.migrations.migrateSavedNeedLocations, {}))
    .resolves.toEqual({ processed: 1, complete: true });
  const migrated = await t.run(async (ctx) => ctx.db.get(savedNeedId));
  expect(migrated).toMatchObject({
    city: "Stuttgart",
    locationQuery: "Stuttgart",
    locationLabel: "Stuttgart",
    radiusKm: 20,
  });
  expect(migrated?.districts).toBeUndefined();
  await expect(t.mutation(internal.migrations.migrateSavedNeedLocations, {}))
    .resolves.toEqual({ processed: 0, complete: true });
});

it("repairs legacy zero radii to the bounded default", async () => {
  const t = convexTest(schema, modules);
  const savedNeedId = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      username: "location-zero-radius-migration",
      role: "musician",
      createdAt: 1,
      lastSeenAt: 1,
    });
    return await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Legacy zero-radius search",
      city: "Stuttgart",
      districts: [],
      radiusKm: 0,
      arrangement: ["shared"],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: 1,
      updatedAt: 1,
    });
  });

  await t.mutation(internal.migrations.migrateSavedNeedLocations, {});
  const migrated = await t.run(async (ctx) => ctx.db.get(savedNeedId));
  expect(migrated?.radiusKm).toBe(20);
});

it("seeds prohibited platform capabilities idempotently", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("geoAreas", {
      key: "de:hamburg",
      name: "Hamburg",
      normalizedName: "hamburg",
      countryCode: "DE",
      type: "city",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  });

  await expect(
    t.mutation(internal.migrations.seedKnownRestrictedPolicies, {}),
  ).resolves.toEqual({ platforms: 1, policies: 5, coverage: 2 });
  await expect(
    t.mutation(internal.migrations.seedKnownRestrictedPolicies, {}),
  ).resolves.toEqual({ platforms: 0, policies: 0, coverage: 0 });

  const snapshot = await t.run(async (ctx) => {
    const platform = await ctx.db
      .query("sourcePlatforms")
      .withIndex("by_canonical_domain", (q) =>
        q.eq("canonicalDomain", "kleinanzeigen.de"),
      )
      .unique();
    const policies = platform
      ? await ctx.db
          .query("sourceFlowPolicies")
          .withIndex("by_platform_and_status_and_next_review_at", (q) =>
            q.eq("platformId", platform._id).eq("status", "restricted"),
          )
          .collect()
      : [];
    const coverage = platform
      ? await ctx.db
          .query("sourceCoverage")
          .withIndex("by_platform_and_status", (q) =>
            q.eq("platformId", platform._id).eq("status", "unsupported"),
          )
          .collect()
      : [];
    return { platform, policies, coverage };
  });

  expect(snapshot.platform?.status).toBe("restricted");
  expect(snapshot.policies).toHaveLength(5);
  expect(snapshot.coverage).toHaveLength(2);
  expect(snapshot.policies.every((policy) =>
    policy.decision === "prohibited" &&
    policy.maxAutomationLevel === "disabled" &&
    policy.termsDecision === "disallowed"
  )).toBe(true);
});
