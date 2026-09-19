/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { signalMatchRevision } from "./lib/matchValidity";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = 1;
    const ownerId = await ctx.db.insert("users", {
      username: "portal-preference-owner", role: "musician", createdAt: now, lastSeenAt: now,
    });
    const otherId = await ctx.db.insert("users", {
      username: "portal-preference-other", role: "musician", createdAt: now, lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Portal-only search", city: "Unmapped", districts: [], arrangement: ["shared"],
      schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now,
    });
    const otherNeedId = await ctx.db.insert("savedNeeds", {
      ownerId: otherId, title: "Other search", city: "Unmapped", districts: [], arrangement: ["shared"],
      schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now,
    });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "portal-preferences", name: "Portal Preferences", canonicalDomain: "portal.example",
      kind: "marketplace", status: "active", firstSeenAt: now, lastObservedAt: now,
      createdAt: now, updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId, slug: "portal-preferences-connected", name: "Connected portal",
      baseUrl: "https://portal.example", side: "supply", status: "paused", health: "healthy",
      accessMode: "authenticated", createdAt: now, updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId, sourceId, label: "My portal", allowedDomains: ["portal.example"], allowedPaths: ["/"],
      status: "active", policyDecision: "allowed", allowReadOnlyRecon: true, allowInboxPolling: false,
      pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now,
    });
    const sourceTargetId = await ctx.db.insert("sourceTargets", {
      sourceId, url: "https://portal.example/rooms", mode: "scrape",
      changeTrackingTag: "portal-rooms", scheduleMinutes: 1_440, nextRunAt: now,
      paused: false, createdAt: now, updatedAt: now,
    });
    const entryId = await ctx.db.insert("sourceEntries", {
      sourceId, sourceTargetId, externalId: "portal-room", canonicalUrl: "https://portal.example/room",
      detailUrl: "https://portal.example/room", title: "Portal room", excerpt: "Available",
      side: "supply", city: "Unmapped", status: "active", detailState: "processed",
      detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      sourceEntryId: entryId, side: "supply", title: "Portal room", city: "Unmapped",
      summary: "Available", arrangement: "shared", requirements: [], unknowns: [],
      status: "published", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now,
    });
    await ctx.db.insert("signalMatches", {
      ownerId, savedNeedId, signalId, kind: "need_supply", score: 1, structuredScore: 1,
      semanticScore: 0, reasons: ["same city"], uncertainties: [], status: "new",
      fingerprint: "portal-match", eligible: true, contactEligible: true, needRevision: 0,
      signalRevision: await signalMatchRevision((await ctx.db.get(signalId))!), createdAt: now, updatedAt: now,
    });
    return { ownerId, otherId, savedNeedId, otherNeedId, platformId, sourceId, sourceTargetId, connectionId };
  });
  return {
    t,
    owner: t.withIdentity({ subject: ids.ownerId }),
    other: t.withIdentity({ subject: ids.otherId }),
    ...ids,
  };
}

it("persists an exclusion for a connected portal even without geographic coverage", async () => {
  const f = await fixture();
  expect(await f.owner.query(api.searchSources.getPortalPreferences, { savedNeedId: f.savedNeedId }))
    .toEqual([{ sourceId: f.sourceId, preference: "include" }]);
  expect(await f.owner.query(api.matches.listMine, { savedNeedId: f.savedNeedId })).toHaveLength(1);

  await f.owner.mutation(api.searchSources.setPortalPreference, {
    savedNeedId: f.savedNeedId, sourceId: f.sourceId, preference: "exclude",
  });

  expect(await f.owner.query(api.searchSources.getPortalPreferences, { savedNeedId: f.savedNeedId }))
    .toEqual([{ sourceId: f.sourceId, preference: "exclude" }]);
  expect(await f.owner.query(api.matches.listMine, { savedNeedId: f.savedNeedId })).toHaveLength(0);
  expect(await f.t.run((ctx) => ctx.db.query("searchSourcePreferences")
    .withIndex("by_saved_need_and_platform", (q) =>
      q.eq("savedNeedId", f.savedNeedId).eq("platformId", f.platformId),
    ).unique())).toMatchObject({ ownerId: f.ownerId, preference: "exclude" });
  expect(await f.t.run((ctx) => ctx.db.get(f.connectionId))).toMatchObject({ status: "active" });
});

it("enforces saved-need and portal ownership", async () => {
  const f = await fixture();
  await expect(f.other.query(api.searchSources.getPortalPreferences, { savedNeedId: f.savedNeedId }))
    .rejects.toThrow("NEED_NOT_FOUND");
  await expect(f.owner.mutation(api.searchSources.setPortalPreference, {
    savedNeedId: f.otherNeedId, sourceId: f.sourceId, preference: "exclude",
  })).rejects.toThrow("NEED_NOT_FOUND");
  await expect(f.other.mutation(api.searchSources.setPortalPreference, {
    savedNeedId: f.otherNeedId, sourceId: f.sourceId, preference: "exclude",
  })).rejects.toThrow("PORTAL_NOT_FOUND");
  expect(await f.t.run((ctx) => ctx.db.query("searchSourcePreferences").collect())).toHaveLength(0);
});

it("reports indexed evidence only for an active processed entry with a published signal", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const geoAreaId = await ctx.db.insert("geoAreas", {
      key: "de:city:unmapped", name: "Unmapped", normalizedName: "unmapped", countryCode: "DE",
      type: "city", status: "active", createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert("sourceCoverage", {
      platformId: f.platformId, sourceId: f.sourceId, sourceTargetId: f.sourceTargetId,
      geoAreaId, side: "supply", mode: "explicit_page", status: "verified", confidence: 1,
      lastObservedAt: 1, createdAt: 1, updatedAt: 1,
    });
  });

  const result = await f.owner.query(api.searchSources.listForNeed, { savedNeedId: f.savedNeedId });
  expect(result.sources).toEqual([expect.objectContaining({
    platformId: f.platformId,
    hasIndexedEvidence: true,
  })]);
});
