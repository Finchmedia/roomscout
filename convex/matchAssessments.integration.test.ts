/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { ROOMSCOUT_MODEL_ID } from "./ai";
import { MATCH_ASSESSMENT_VERSION, type MatchAssessment } from "./lib/matchAssessment";
import { signalMatchRevision } from "./lib/matchValidity";
import { generateRoomScoutObject } from "./ai";

vi.mock("./ai", async (importOriginal) => ({
  ...await importOriginal<typeof import("./ai")>(),
  generateRoomScoutObject: vi.fn(),
}));

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(generateRoomScoutObject).mockReset();
});

const assessment: MatchAssessment = {
  requirements: [],
  schedule: { verdict: "unknown", evidence: null, explanation: "No schedule requested" },
  monthlyPrice: { minimumEur: 220, totalKnown: true, evidence: "Listed price: EUR 220; period: month" },
  sharing: { open: null, evidence: null },
};

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { username: "assessment-test", role: "musician", createdAt: 1, lastSeenAt: 1 });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Room search", city: "Stuttgart", districts: [], maxBudgetEur: 250,
      arrangement: ["shared"], schedule: [], requirements: [], status: "active",
      matchingRevision: 1, createdAt: 1, updatedAt: 1,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply", title: "Shared room", city: "Stuttgart", summary: "Room to share",
      arrangement: "shared", priceEur: 220, pricePeriod: "month", requirements: [], unknowns: [],
      status: "published", verification: "observed", sourceCount: 1, firstSeenAt: 1, lastSeenAt: 1,
    });
    return { ownerId, savedNeedId, signalId };
  });
  const signalRevision = await t.run(async (ctx) => signalMatchRevision((await ctx.db.get(ids.signalId))!));
  return { t, ...ids, key: { ...ids, needRevision: 1, signalRevision } };
}

it("clears a stale assessment when an existing failed cache entry fails again", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.insert("matchAssessments", {
      ...f.key, status: "failed", assessment, attempts: 1, errorCode: "BAD_OUTPUT",
      model: ROOMSCOUT_MODEL_ID, promptVersion: MATCH_ASSESSMENT_VERSION,
      retryAfter: Date.now() + 5_000, updatedAt: Date.now(),
    });
  });

  await f.t.mutation(internal.matchAssessments.save, { ...f.key, errorCode: "PROVIDER_UNAVAILABLE" });

  const row = await f.t.run(async (ctx) => ctx.db.query("matchAssessments").first());
  expect(row).toMatchObject({ status: "failed", attempts: 2, errorCode: "PROVIDER_UNAVAILABLE" });
  expect(row?.assessment).toBeUndefined();
  expect(await f.t.query(internal.matchAssessments.getCached, f.key)).toEqual({ status: "failed" });
});

it("never exposes a retained legacy assessment from a failed cache entry", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.insert("matchAssessments", {
      ...f.key, status: "failed", assessment, attempts: 1,
      model: ROOMSCOUT_MODEL_ID, promptVersion: MATCH_ASSESSMENT_VERSION,
      retryAfter: Date.now() + 60_000, updatedAt: Date.now(),
    });
  });

  expect(await f.t.query(internal.matchAssessments.getCached, f.key)).toEqual({ status: "failed" });
});

it("keeps a ready cache immutable when a late failure arrives for the same input", async () => {
  const f = await fixture();
  await f.t.mutation(internal.matchAssessments.save, { ...f.key, assessment });
  await f.t.mutation(internal.matchAssessments.save, { ...f.key, errorCode: "LATE_FAILURE" });

  const row = await f.t.run(async (ctx) => ctx.db.query("matchAssessments").first());
  expect(row).toMatchObject({ status: "ready", attempts: 1, assessment });
  expect(row?.errorCode).toBeUndefined();
  expect(await f.t.query(internal.matchAssessments.getCached, f.key)).toEqual({ status: "ready", assessment });
});

it("bounds failed retries and emits one system notification on the third failure", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await f.t.mutation(internal.matchAssessments.save, { ...f.key, errorCode: `FAIL_${attempt}` });
  }

  const row = await f.t.run(async (ctx) => ctx.db.query("matchAssessments").first());
  const notifications = await f.t.run(async (ctx) => ctx.db.query("notifications").collect());
  const scheduled = await f.t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect());
  expect(row).toMatchObject({ status: "failed", attempts: 3, errorCode: "FAIL_3" });
  expect(notifications).toHaveLength(1);
  expect(notifications[0]).toMatchObject({ ownerId: f.ownerId, kind: "system", title: "Raumprüfung fehlgeschlagen" });
  expect(scheduled).toHaveLength(2);
});

it("does not write or enqueue work for an inactive search", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => { await ctx.db.patch(f.savedNeedId, { status: "paused" }); });

  await f.t.mutation(internal.matchAssessments.save, { ...f.key, errorCode: "PROVIDER_UNAVAILABLE" });

  expect(await f.t.run(async (ctx) => ctx.db.query("matchAssessments").collect())).toEqual([]);
  expect(await f.t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});

it("drops a scheduled retry after its search has been deleted", async () => {
  const f = await fixture();
  const failedAt = Date.now();
  await f.t.run(async (ctx) => {
    await ctx.db.insert("matchAssessments", {
      ...f.key, status: "failed", attempts: 1, errorCode: "PROVIDER_UNAVAILABLE",
      model: ROOMSCOUT_MODEL_ID, promptVersion: MATCH_ASSESSMENT_VERSION,
      retryAfter: failedAt + 5_000, updatedAt: failedAt,
    });
    await ctx.db.delete(f.savedNeedId);
  });

  await f.t.mutation(internal.matchAssessments.retryFailed, { ...f.key, failedAt });

  expect(await f.t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});

it("repairs an ungrounded assessment and authorizes contact with the corrected output", async () => {
  vi.mocked(generateRoomScoutObject)
    .mockResolvedValueOnce({
      ...assessment,
      monthlyPrice: { ...assessment.monthlyPrice, evidence: "EUR 220 per month" },
    })
    .mockResolvedValueOnce(assessment);
  const f = await fixture();

  await f.t.action(internal.matches.recomputeNeed, { ownerId: f.ownerId, savedNeedId: f.savedNeedId });

  expect(generateRoomScoutObject).toHaveBeenCalledTimes(2);
  expect(JSON.parse(vi.mocked(generateRoomScoutObject).mock.calls[1]![0].prompt)).toMatchObject({
    previousAssessment: { monthlyPrice: { evidence: "EUR 220 per month" } },
    retryFeedback: expect.stringContaining("exact quote"),
  });
  const match = await f.t.run(async (ctx) => ctx.db.query("signalMatches").first());
  const cached = await f.t.run(async (ctx) => ctx.db.query("matchAssessments").first());
  expect(match).toMatchObject({ eligible: true, contactEligible: true });
  expect(cached).toMatchObject({ status: "ready", attempts: 1, assessment });
});
