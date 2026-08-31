/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

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
