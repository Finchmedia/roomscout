/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import {
  getSavedNeedActivationReadiness,
  savedNeedActivationClarificationQuestion,
} from "./lib/savedNeedLocation";
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
    missingFields: [],
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
  }))).toMatchObject({ readyForReview: true, readyAt: firstReadyAt, missingFields: [] });
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

it("keeps a normalized location without radius unready until the radius is saved", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const context = await ctx.db.query("scoutContexts")
      .withIndex("by_owner", (q) => q.eq("ownerId", f.ownerId)).unique();
    if (!context) throw new Error("missing Scout context");
    await ctx.db.patch(f.needId, { radiusKm: undefined });
    await ctx.db.patch(context._id, { readyNeedRevision: 0, briefReadyAt: 900 });
  });

  expect(await f.owner.query(api.scout.getMine, {})).toMatchObject({
    briefReadiness: {
      status: "needs_edits",
      needRevision: 0,
      missingFields: ["radiusKm"],
    },
  });
  const incomplete = await f.t.mutation(internal.scout.markBriefReady, {
    ownerId: f.ownerId,
    threadId: "brief-thread",
    needId: f.needId,
  });
  expect(incomplete).toEqual({
    readyForReview: false,
    needRevision: 0,
    missingFields: ["radiusKm"],
    clarificationQuestion: "What radius around Berlin should I use?",
  });
  expect(await f.owner.query(api.scout.getMine, {})).toMatchObject({
    briefReadiness: { status: "collecting", missingFields: ["radiusKm"] },
  });
  await expect(f.owner.mutation(api.savedNeeds.activate, { savedNeedId: f.needId }))
    .rejects.toThrow("INCOMPLETE_NEED");

  await f.t.mutation(internal.savedNeeds.updateFromScout, {
    ownerId: f.ownerId,
    needId: f.needId,
    radiusKm: 10,
  });
  const ready = await f.t.mutation(internal.scout.markBriefReady, {
    ownerId: f.ownerId,
    threadId: "brief-thread",
    needId: f.needId,
  });
  expect(ready).toMatchObject({
    readyForReview: true,
    needRevision: 1,
    missingFields: [],
  });
  await expect(f.owner.mutation(api.savedNeeds.activate, { savedNeedId: f.needId }))
    .resolves.toBeNull();
  expect((await f.t.run((ctx) => ctx.db.get(f.needId)))?.status).toBe("active");
});

it("reports activation gaps and focused EN/DE questions without changing legacy city compatibility", () => {
  expect(getSavedNeedActivationReadiness({ locationQuery: "Berlin", city: "Berlin" }))
    .toEqual({ canActivate: false, missingFields: ["radiusKm"] });
  expect(getSavedNeedActivationReadiness({ city: "Berlin" }))
    .toEqual({ canActivate: true, missingFields: [] });
  const need = { locationQuery: "Berlin", locationLabel: "Berlin", city: "Berlin" };
  expect(savedNeedActivationClarificationQuestion("en", need))
    .toBe("What radius around Berlin should I use?");
  expect(savedNeedActivationClarificationQuestion("de", need))
    .toBe("Welchen Umkreis um Berlin soll ich verwenden?");
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
