/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = 1_000;
    const ownerId = await ctx.db.insert("users", {
      username: "brief-owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const otherOwnerId = await ctx.db.insert("users", {
      username: "brief-other",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const needId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Useful draft",
      city: "Berlin",
      locationQuery: "Berlin",
      locationLabel: "Berlin",
      radiusKm: 15,
      arrangement: [],
      schedule: [],
      requirements: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("scoutContexts", {
      ownerId,
      threadId: "brief-thread",
      activeNeedId: needId,
      mode: "search_discovery",
      updatedAt: now,
    });
    const voiceSessionId = await ctx.db.insert("voiceSessions", {
      ownerId,
      threadId: "brief-thread",
      model: "test-realtime",
      voice: "test-voice",
      status: "active",
      activeNeedId: needId,
      startedAt: now,
      updatedAt: now,
    });
    return { ownerId, otherOwnerId, needId, voiceSessionId };
  });
  return { t, owner: t.withIdentity({ subject: ids.ownerId }), ...ids };
}

it("persists readiness for one exact draft revision without activating it", async () => {
  const f = await fixture();

  const voiceResult = await f.owner.action(api.voice.executeTool, {
    voiceSessionId: f.voiceSessionId,
    name: "mark_search_brief_ready",
    argumentsJson: "{}",
  });
  expect(JSON.parse(voiceResult.outputJson)).toMatchObject({
    readyForReview: true,
    needRevision: 0,
    activationRequired: true,
  });

  expect(await f.owner.query(api.scout.getMine, {})).toMatchObject({
    activeNeedId: f.needId,
    briefReadiness: { status: "ready", needRevision: 0 },
  });
  const firstReadyAt = JSON.parse(voiceResult.outputJson).readyAt;
  expect((await f.t.mutation(internal.scout.markBriefReady, {
    ownerId: f.ownerId,
    threadId: "brief-thread",
    needId: f.needId,
  })).readyAt).toBe(firstReadyAt);
  expect((await f.t.run((ctx) => ctx.db.get(f.needId)))?.status).toBe("draft");

  await f.t.mutation(internal.savedNeeds.updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    requirements: ["Drums allowed"],
  });
  expect(await f.owner.query(api.scout.getMine, {})).toMatchObject({
    briefReadiness: { status: "needs_edits", needRevision: 1 },
  });

  await f.t.mutation(internal.scout.markBriefReady, {
    ownerId: f.ownerId,
    threadId: "brief-thread",
    needId: f.needId,
  });
  expect(await f.owner.query(api.scout.getMine, {})).toMatchObject({
    briefReadiness: { status: "ready", needRevision: 1 },
  });
});

it("rejects cross-owner and non-draft readiness markers", async () => {
  const f = await fixture();
  await expect(f.t.mutation(internal.scout.markBriefReady, {
    ownerId: f.otherOwnerId,
    threadId: "brief-thread",
    needId: f.needId,
  })).rejects.toThrow("NEED_NOT_FOUND");

  await f.t.run(async (ctx) => ctx.db.patch(f.needId, { status: "active" }));
  await expect(f.t.mutation(internal.scout.markBriefReady, {
    ownerId: f.ownerId,
    threadId: "brief-thread",
    needId: f.needId,
  })).rejects.toThrow("NEED_NOT_DRAFT");
});
