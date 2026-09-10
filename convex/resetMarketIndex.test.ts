/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import { FLEET_RESET_CONFIRMATION } from "./devUserReset";
import schema from "./schema";
const modules = import.meta.glob("./**/*.ts");
beforeEach(() => { vi.stubEnv("CONVEX_CLOUD_URL", "https://perceptive-antelope-445.eu-west-1.convex.cloud"); vi.stubEnv("CONVEX_SITE_URL", "https://perceptive-antelope-445.eu-west-1.convex.site"); });

it("retires only explicit stale evidence and rejects the preserved Finch URL", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const source = await ctx.db.insert("sources", { slug: "old-demo", name: "Old demo", baseUrl: "https://roomscout.dev", side: "supply", status: "paused", health: "healthy", createdAt: now, updatedAt: now });
    const target = await ctx.db.insert("sourceTargets", { sourceId: source, url: "https://roomscout.dev", mode: "scrape", changeTrackingTag: "test", scheduleMinutes: 1440, nextRunAt: now, paused: true, createdAt: now, updatedAt: now });
    const entry = await ctx.db.insert("sourceEntries", { sourceId: source, sourceTargetId: target, canonicalUrl: "https://roomscout.dev/listings/old", detailUrl: "https://roomscout.dev/listings/old", title: "Old", excerpt: "Old", side: "supply", status: "stale", detailState: "processed", detailAttempts: 1, firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    const signal = await ctx.db.insert("signals", { side: "supply", title: "Old", city: "Berlin", summary: "Old", arrangement: "unknown", requirements: [], unknowns: [], status: "stale", verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now, sourceEntryId: entry, isDemo: true });
    await ctx.db.patch(entry, { signalId: signal });
    return { signal };
  });
  const args = { signalIds: [ids.signal], keepCanonicalUrl: "https://roomscout.dev/listings/finch", confirmation: FLEET_RESET_CONFIRMATION };
  expect(await t.query(internal.resetMarketIndex.preview, args)).toHaveLength(1);
  expect(await t.mutation(internal.resetMarketIndex.retire, args)).toMatchObject({ retiredSignals: 1, retiredEntries: 1 });
  await expect(t.query(internal.resetMarketIndex.preview, { ...args, keepCanonicalUrl: "https://roomscout.dev/listings/old" })).rejects.toThrow("MARKET_RESET_KEEP_SIGNAL_FORBIDDEN");
});
