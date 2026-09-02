/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("activates one safe default Autopilot mandate and respects excluded sources", async () => {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "autopilot-owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Find our band a room",
      city: "Stuttgart",
      districts: [],
      maxBudgetEur: 350,
      arrangement: ["permanent", "shared"],
      schedule: ["Weekday evenings"],
      requirements: ["Drums allowed"],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const includedPlatformId = await ctx.db.insert("sourcePlatforms", {
      slug: "included",
      name: "Included source",
      canonicalDomain: "included.example",
      kind: "community",
      status: "active",
      firstSeenAt: now,
      lastObservedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const excludedPlatformId = await ctx.db.insert("sourcePlatforms", {
      slug: "excluded",
      name: "Excluded source",
      canonicalDomain: "excluded.example",
      kind: "classifieds",
      status: "active",
      firstSeenAt: now,
      lastObservedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("searchSourcePreferences", {
      ownerId,
      savedNeedId,
      platformId: excludedPlatformId,
      preference: "exclude",
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, savedNeedId, includedPlatformId, excludedPlatformId };
  });
  const owner = t.withIdentity({ subject: fixture.ownerId });

  const first = await owner.mutation(api.mandates.enableDefaultAutopilot, {
    savedNeedId: fixture.savedNeedId,
  });
  const second = await owner.mutation(api.mandates.enableDefaultAutopilot, {
    savedNeedId: fixture.savedNeedId,
  });

  expect(first.created).toBe(true);
  expect(second).toMatchObject({ mandateId: first.mandateId, created: false });
  const mandate = await owner.query(api.mandates.getActiveMine, {
    savedNeedId: fixture.savedNeedId,
  });
  expect(mandate).toMatchObject({
    mode: "negotiation_autopilot",
    status: "active",
    platformIds: [fixture.includedPlatformId],
    allowedActionTypes: [
      "send_email",
      "submit_webform",
      "send_platform_dm",
      "create_portal_account",
      "publish_listing",
      "propose_visit_time",
    ],
    allowedPersonalData: [
      "band_name",
      "reply_email",
      "availability",
      "budget",
      "music_profile",
    ],
    maxContactsPerDay: 10,
    maxBrowserMinutesPerDay: 30,
    maxMonthlyPriceEur: 350,
    commitmentBoundary: "non_binding_outreach_only",
  });
  expect(mandate?.platformIds).not.toContain(fixture.excludedPlatformId);
});
