/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const confirmation = "RUN_ROOMSCOUT_DEV_SOURCE_ONLY" as const;

it("activates only the exact first-party RoomScout source and pauses it cleanly", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    const sourceId = await ctx.db.insert("sources", {
      slug: "third-party-review-source",
      name: "Third-party review source",
      baseUrl: "https://example.com",
      side: "both",
      status: "reviewing",
      health: "unknown",
      accessMode: "public",
      automationReview: "pending",
      publicDisplay: false,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("sourceTargets", {
      sourceId,
      url: "https://example.com/listings",
      mode: "scrape",
      changeTrackingTag: "example:v1",
      scheduleMinutes: 1440,
      nextRunAt: now,
      paused: true,
      monitorStatus: "unconfigured",
      createdAt: now,
      updatedAt: now,
    });
  });

  const first = await t.mutation(internal.controlledSourceProof.prepare, {
    confirmation,
  });
  const second = await t.mutation(internal.controlledSourceProof.prepare, {
    confirmation,
  });
  expect(second.sourceId).toBe(first.sourceId);
  expect(second.sourceTargetId).toBe(first.sourceTargetId);

  await t.run(async (ctx) => {
    const sources = await ctx.db.query("sources").collect();
    expect(sources.find((source) => source.slug === "roomscout-dev-public"))
      .toMatchObject({
        baseUrl: "https://roomscout.dev",
        status: "active",
        automationReview: "approved",
        accessMode: "public",
        publicDisplay: true,
      });
    expect(sources.find((source) => source.slug === "third-party-review-source"))
      .toMatchObject({ status: "reviewing", automationReview: "pending" });
    const active = sources.filter((source) => source.status === "active");
    expect(active.map((source) => source.slug)).toEqual([
      "roomscout-dev-public",
    ]);
  });

  await t.mutation(internal.controlledSourceProof.pause, { confirmation });
  await t.run(async (ctx) => {
    const source = await ctx.db
      .query("sources")
      .withIndex("by_slug", (q) => q.eq("slug", "roomscout-dev-public"))
      .unique();
    const target = await ctx.db.get(first.sourceTargetId);
    expect(source).toMatchObject({ status: "paused", publicDisplay: false });
    expect(target).toMatchObject({ paused: true });
  });
});

it("refuses to run while any unrelated source is active", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("sources", {
      slug: "unexpected-active-source",
      name: "Unexpected active source",
      baseUrl: "https://example.com",
      side: "both",
      status: "active",
      health: "unknown",
      accessMode: "public",
      automationReview: "approved",
      publicDisplay: true,
      createdAt: now,
      updatedAt: now,
    });
  });
  await expect(
    t.mutation(internal.controlledSourceProof.prepare, { confirmation }),
  ).rejects.toThrow("OTHER_ACTIVE_SOURCE_PRESENT");
});
