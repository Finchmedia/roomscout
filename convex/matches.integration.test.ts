/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { signalMatchRevision } from "./lib/matchValidity";
import { generateRoomScoutObject } from "./ai";

vi.mock("./ai", async (importOriginal) => ({
  ...await importOriginal<typeof import("./ai")>(),
  generateRoomScoutObject: vi.fn(async () => { throw new Error("Model disabled in deterministic tests"); }),
}));

const modules = import.meta.glob("./**/*.ts");
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllEnvs();
  vi.mocked(generateRoomScoutObject).mockReset().mockRejectedValue(new Error("Model disabled in deterministic tests"));
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", { username: "matching-test", role: "musician", createdAt: 1, lastSeenAt: 1 });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Rehearsal search", city: "Stuttgart", districts: [], maxBudgetEur: 250,
      arrangement: ["shared"], schedule: [], requirements: [], status: "draft", createdAt: 1, updatedAt: 1,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply", title: "Rehearsal room", city: "Stuttgart", summary: "Room to share",
      arrangement: "shared", priceEur: 220, pricePeriod: "month", requirements: [], unknowns: [],
      status: "published", verification: "observed", sourceCount: 1, firstSeenAt: 1, lastSeenAt: 1,
    });
    return { ownerId, savedNeedId, signalId };
  });
  return { t, owner: t.withIdentity({ subject: ids.ownerId }), ...ids };
}

it("validates saved-search radius bounds and stores the full location query", async () => {
  const f = await fixture();
  const input = {
    title: "Address search",
    locationQuery: "Hauptstätter Straße 123, Stuttgart",
    locationLabel: "Hauptstätter Straße 123",
    arrangement: ["shared" as const],
    schedule: [],
    requirements: [],
  };
  await expect(f.owner.mutation(api.savedNeeds.create, { ...input, radiusKm: 0 }))
    .rejects.toThrow("INVALID_RADIUS");
  await expect(f.owner.mutation(api.savedNeeds.create, { ...input, radiusKm: 201 }))
    .rejects.toThrow("INVALID_RADIUS");
  const needId = await f.owner.mutation(api.savedNeeds.create, { ...input, radiusKm: 8 });
  expect(await f.owner.query(api.savedNeeds.getMine, { needId })).toMatchObject({
    locationQuery: input.locationQuery,
    locationLabel: input.locationLabel,
    radiusKm: 8,
  });
});

it("activation matches an already indexed room without a new signal", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.activate, { savedNeedId: f.savedNeedId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await f.owner.query(api.matches.listMine, {});
  expect(rows).toHaveLength(1);
  expect(rows[0].signalId).toBe(f.signalId);
  const need = await f.owner.query(api.savedNeeds.getMine, { needId: f.savedNeedId });
  expect(need?.matchingRevision).toBe(1);
  await f.owner.mutation(api.savedNeeds.activate, { savedNeedId: f.savedNeedId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await f.owner.query(api.matches.listMine, {}))).toHaveLength(1);
  expect((await f.owner.query(api.savedNeeds.getMine, { needId: f.savedNeedId }))?.matchingRevision).toBe(1);
});

it("shows a budget-only exclusion as near-budget and promotes the same row after a budget edit", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.t.run(async (ctx) => { await ctx.db.patch(f.signalId, { priceEur: 350 }); });

  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await f.owner.query(api.matches.listMine, { savedNeedId: f.savedNeedId })).toEqual([]);
  const [near] = await f.owner.query(api.matches.listCandidatesMine, { savedNeedId: f.savedNeedId });
  expect(near).toMatchObject({
    candidateKey: `${f.savedNeedId}:${f.signalId}`,
    savedNeedId: f.savedNeedId,
    signalId: f.signalId,
    kind: "near_budget",
    contactEligible: false,
    budgetDeltaEur: 100,
    monthlyCostEur: 350,
    monthlyCostBasis: "listed_monthly_base",
    signal: { _id: f.signalId, title: "Rehearsal room", priceEur: 350, pricePeriod: "month" },
  });
  expect(await f.t.run((ctx) => ctx.db.query("opportunities").collect())).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toEqual([]);

  await f.owner.mutation(api.savedNeeds.update, { needId: f.savedNeedId, maxBudgetEur: 400 });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);

  const [fit] = await f.owner.query(api.matches.listCandidatesMine, { savedNeedId: f.savedNeedId });
  expect(fit).toMatchObject({
    candidateKey: `${f.savedNeedId}:${f.signalId}`,
    kind: "fit",
    budgetDeltaEur: -50,
  });
  expect(await f.owner.query(api.matches.listMine, { savedNeedId: f.savedNeedId })).toHaveLength(1);
  expect(await f.t.run((ctx) => ctx.db.query("signalMatches").collect())).toHaveLength(1);
  expect(await f.t.run((ctx) => ctx.db.query("opportunities").collect())).toHaveLength(1);
  expect((await f.t.run((ctx) => ctx.db.query("notifications").collect()))
    .filter((notification) => notification.kind === "new_match")).toHaveLength(1);
});

it("retains a first ineligible row without exposing a candidate or starting outreach", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.t.run(async (ctx) => { await ctx.db.patch(f.signalId, { city: "Berlin" }); });

  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await f.t.run((ctx) => ctx.db.query("signalMatches").first())).toMatchObject({
    signalId: f.signalId,
    eligible: false,
    eligibility: "ineligible",
    contactEligible: false,
  });
  expect(await f.owner.query(api.matches.listCandidatesMine, { savedNeedId: f.savedNeedId })).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("opportunities").collect())).toEqual([]);
  expect(await f.t.run((ctx) => ctx.db.query("notifications").collect())).toEqual([]);
});

it("does not reopen or renotify a contacted candidate after a new search revision", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const match = (await f.owner.query(api.matches.listMine, { savedNeedId: f.savedNeedId }))[0]!;
  await f.owner.mutation(api.matches.updateStatus, { matchId: match._id, status: "contacted" });
  await f.t.run(async (ctx) => {
    const opportunity = await ctx.db.query("opportunities")
      .withIndex("by_saved_need_and_fingerprint", (q) => q.eq("savedNeedId", f.savedNeedId).eq("fingerprint", `match:${f.savedNeedId}:${f.signalId}`))
      .unique();
    await ctx.db.patch(opportunity!._id, { status: "contacted" });
  });
  const beforeNotifications = (await f.t.run((ctx) => ctx.db.query("notifications").collect()))
    .filter((notification) => notification.kind === "new_match").length;

  await f.owner.mutation(api.savedNeeds.update, { needId: f.savedNeedId, maxBudgetEur: 260 });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);

  expect(await f.t.run(async (ctx) => (await ctx.db.query("signalMatches").first())?.status)).toBe("contacted");
  expect(await f.t.run(async (ctx) => (await ctx.db.query("opportunities").first())?.status)).toBe("contacted");
  expect(await f.t.run((ctx) => ctx.db.query("opportunities").collect())).toHaveLength(1);
  expect((await f.t.run((ctx) => ctx.db.query("notifications").collect()))
    .filter((notification) => notification.kind === "new_match")).toHaveLength(beforeNotifications);
});

it("requeues a failed assessment with no external effects after a newer need revision", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => { await ctx.db.patch(f.savedNeedId, { status: "active", matchingRevision: 1 }); });
  const firstRun = (await f.t.mutation(internal.matches.beginMatching, {
    ownerId: f.ownerId, savedNeedId: f.savedNeedId,
  }))!;
  const signalRevision = await f.t.run(async (ctx) => signalMatchRevision((await ctx.db.get(f.signalId))!));
  const scored = {
    signalId: f.signalId,
    signalRevision,
    eligible: true,
    eligibility: "fit" as const,
    contactEligible: true,
    monthlyCostBasis: "listed_monthly_base" as const,
    monthlyCostEur: 220,
    budgetDeltaEur: -30,
    kind: "need_supply" as const,
    score: 1,
    structuredScore: 1,
    semanticScore: 1,
    reasons: ["Same city: Stuttgart"],
    uncertainties: [],
    fingerprint: "first",
  };
  await f.t.mutation(internal.matches.applyMatches, {
    ownerId: f.ownerId, savedNeedId: f.savedNeedId, needRevision: 1,
    matchingRunId: firstRun.matchingRunId, matches: [scored],
  });
  const opportunity = (await f.t.run((ctx) => ctx.db.query("opportunities").first()))!;
  await f.t.run(async (ctx) => {
    await ctx.db.patch(opportunity._id, { status: "reviewing" });
    const conversationId = await ctx.db.insert("providerConversations", {
      ownerId: f.ownerId,
      savedNeedId: f.savedNeedId,
      signalId: f.signalId,
      opportunityId: opportunity._id,
      conversationKey: `opportunity:${opportunity._id}`,
      agentThreadId: "failed-assessment-thread",
      revision: 1,
      state: "needs_attention",
      lastErrorCode: "SCOUT_ASSESSMENT_FAILED",
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("providerTurns", {
      conversationId,
      sourceKey: "opportunity:first",
      kind: "opportunity",
      revision: 1,
      status: "failed",
      errorCode: "SCOUT_ASSESSMENT_FAILED",
      createdAt: 1,
      completedAt: 2,
    });
    await ctx.db.patch(f.savedNeedId, { matchingRevision: 2, maxBudgetEur: 400 });
  });
  const nextRun = (await f.t.mutation(internal.matches.beginMatching, {
    ownerId: f.ownerId, savedNeedId: f.savedNeedId,
  }))!;

  await f.t.mutation(internal.matches.applyMatches, {
    ownerId: f.ownerId, savedNeedId: f.savedNeedId, needRevision: 2,
    matchingRunId: nextRun.matchingRunId,
    matches: [{ ...scored, budgetDeltaEur: -180, fingerprint: "second" }],
  });

  expect(await f.t.run(async (ctx) => (await ctx.db.get(opportunity._id))?.status)).toBe("new");
  expect(await f.t.run((ctx) => ctx.db.query("opportunities").collect())).toHaveLength(1);
  expect((await f.t.run((ctx) => ctx.db.query("notifications").collect()))
    .filter((notification) => notification.kind === "new_match")).toHaveLength(1);
});

it("activation sets the search active, records the audit event and schedules matching, the orchestrator and the roomscout.dev check", async () => {
  vi.useFakeTimers();
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.activate, { savedNeedId: f.savedNeedId });
  expect((await f.owner.query(api.savedNeeds.getMine, { needId: f.savedNeedId }))?.status).toBe("active");
  const state = await f.t.run(async (ctx) => ({
    scheduled: (await ctx.db.system.query("_scheduled_functions").collect()).map((row) => row.name),
    audit: (await ctx.db.query("auditEvents").collect()).map((event) => event.eventType),
  }));
  expect(state.scheduled).toEqual(expect.arrayContaining([
    "matches:recomputeNeed", "scoutOrchestrator:runForOwner", "demoSourceChecks:requestAutomatic",
  ]));
  expect(state.audit).toContain("search.activated");
});

it("activation rejects an empty city and leaves the search a draft", async () => {
  const f = await fixture();
  await f.t.run(async (ctx) => { await ctx.db.patch(f.savedNeedId, { city: " " }); });
  await expect(f.owner.mutation(api.savedNeeds.activate, { savedNeedId: f.savedNeedId })).rejects.toThrow("INCOMPLETE_NEED");
  expect((await f.owner.query(api.savedNeeds.getMine, { needId: f.savedNeedId }))?.status).toBe("draft");
  expect(await f.t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())).toEqual([]);
});

it("activation is refused for another user's search", async () => {
  const f = await fixture();
  const strangerId = await f.t.run((ctx) => ctx.db.insert("users", { username: "stranger", role: "musician", createdAt: 1, lastSeenAt: 1 }));
  await expect(f.t.withIdentity({ subject: strangerId }).mutation(api.savedNeeds.activate, { savedNeedId: f.savedNeedId })).rejects.toThrow("NEED_NOT_FOUND");
});

it("edits hide obsolete matches immediately and expire the old opportunity after recomputation", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.owner.query(api.matches.listMine, {})).toHaveLength(1);
  await f.owner.mutation(api.savedNeeds.update, { needId: f.savedNeedId, locationQuery: "Berlin" });
  expect(await f.owner.query(api.matches.listMine, {})).toHaveLength(0);
  expect(await f.owner.query(api.matches.listCandidatesMine, { savedNeedId: f.savedNeedId })).toHaveLength(0);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const opportunity = await f.t.run(async (ctx) => ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) => q.eq("savedNeedId", f.savedNeedId)).first());
  expect(opportunity?.status).toBe("expired");
});

it("a changed signal cannot reuse a previously computed match even if observation time is unchanged", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  await f.t.run(async (ctx) => { await ctx.db.patch(f.signalId, { priceEur: 900 }); });
  expect(await f.owner.query(api.matches.listMine, {})).toHaveLength(0);
});

it("rejects late match application after a need edit", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const need = await f.owner.query(api.savedNeeds.getMine, { needId: f.savedNeedId });
  const signalRevision = await f.t.run(async (ctx) => signalMatchRevision((await ctx.db.get(f.signalId))!));
  const args = {
    ownerId: f.ownerId, savedNeedId: f.savedNeedId, needRevision: need!.matchingRevision!, matchingRunId: need!.matchingRunId!,
    matches: [{ signalId: f.signalId, signalRevision, eligible: true, eligibility: "fit" as const,
      monthlyCostBasis: "listed_monthly_base" as const, monthlyCostEur: 220, budgetDeltaEur: -30, kind: "need_supply" as const,
      score: 1, structuredScore: 1, semanticScore: 1, reasons: ["late"], uncertainties: [], fingerprint: "late" }],
  };
  await f.owner.mutation(api.savedNeeds.update, { needId: f.savedNeedId, maxBudgetEur: 100 });
  expect(await f.t.mutation(internal.matches.applyMatches, args)).toBe(0);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await f.owner.query(api.matches.listMine, {})).toHaveLength(0);
});

it("rejects superseded runs and changed signal content during an asynchronous assessment", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const need = await f.owner.query(api.savedNeeds.getMine, { needId: f.savedNeedId });
  const signalRevision = await f.t.run(async (ctx) => signalMatchRevision((await ctx.db.get(f.signalId))!));
  const pending = {
    ownerId: f.ownerId, savedNeedId: f.savedNeedId, needRevision: need!.matchingRevision!, matchingRunId: need!.matchingRunId!,
    matches: [{ signalId: f.signalId, signalRevision, eligible: true, eligibility: "fit" as const,
      monthlyCostBasis: "listed_monthly_base" as const, monthlyCostEur: 220, budgetDeltaEur: -30, contactEligible: true, kind: "need_supply" as const,
      score: 1, structuredScore: 1, semanticScore: 1, reasons: ["late"], uncertainties: [], fingerprint: "late" }],
  };
  const newer = await f.t.mutation(internal.matches.beginMatching, { ownerId: f.ownerId, savedNeedId: f.savedNeedId });
  expect(await f.t.mutation(internal.matches.applyMatches, pending)).toBe(0);
  await f.t.run(async (ctx) => { await ctx.db.patch(f.signalId, { priceEur: 900 }); });
  expect(await f.t.mutation(internal.matches.applyMatches, { ...pending, matchingRunId: newer!.matchingRunId })).toBe(0);
  expect(await f.owner.query(api.matches.listMine, {})).toEqual([]);
});

it("processes city candidates beyond the old 75/150 row cutoffs", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.t.run(async (ctx) => {
    const base = (await ctx.db.get(f.signalId))!;
    for (let i = 0; i < 160; i++) {
      const { _id, _creationTime, ...fields } = base;
      void _id; void _creationTime;
      await ctx.db.insert("signals", { ...fields, title: `Room ${i}`, priceEur: 800 });
    }
  });
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await f.owner.query(api.matches.listMine, {});
  expect(rows.map((row) => row.signalId)).toEqual([f.signalId]);
});

it("matches a positioned listing across city boundaries when it is inside the radius", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.t.run(async (ctx) => {
    await ctx.db.patch(f.savedNeedId, { radiusKm: 20, centerLatitude: 48.7758, centerLongitude: 9.1829 });
    await ctx.db.patch(f.signalId, { city: "Esslingen", latitude: 48.7406, longitude: 9.3108 });
  });
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await f.owner.query(api.matches.listMine, { savedNeedId: f.savedNeedId });
  expect(rows).toHaveLength(1);
  expect(rows[0]?.reasons.some((reason) => reason.startsWith("Within 20 km radius"))).toBe(true);
});

it("stores a resolved private search center with honest precision and invalidates old matches", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.t.mutation(internal.map.storeNeedGeocode, {
    savedNeedId: f.savedNeedId, query: "Stuttgart, Germany", queryKey: "stuttgart, germany",
    locationLabel: "Stuttgart", precision: "city", status: "ready", latitude: 48.7758, longitude: 9.1829,
  });
  const need = await f.owner.query(api.savedNeeds.getMine, { needId: f.savedNeedId });
  expect(need).toMatchObject({ centerLatitude: 48.7758, centerLongitude: 9.1829, locationPrecision: "city", matchingRevision: 1 });
});

it("preserves an exact address as the geocoding query", async () => {
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.update, {
    needId: f.savedNeedId,
    locationQuery: "Hauptstätter Straße 123, Stuttgart",
    radiusKm: 8,
  });
  const location = await f.t.query(internal.map.getNeedLocation, {
    savedNeedId: f.savedNeedId,
  });
  expect(location).toEqual({
    query: "Hauptstätter Straße 123, Stuttgart, Germany",
    queryKey: "hauptstätter straße 123, stuttgart, germany",
    locationLabel: "Hauptstätter Straße 123, Stuttgart",
  });
});

it("holds automatic contact on a failed AI assessment while keeping uncertainty visible", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const rows = await f.owner.query(api.matches.listMine, { savedNeedId: f.savedNeedId });
  expect(rows[0]?.contactEligible).toBe(false);
  expect(rows[0]?.uncertainties).toContain("AI condition check is pending; automatic contact is on hold");
});

it("caches a grounded assessment and authorizes contact only for its current versions", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  vi.mocked(generateRoomScoutObject).mockResolvedValue({
    requirements: [], schedule: { verdict: "unknown", evidence: null, explanation: "No schedule requested" },
    monthlyPrice: { minimumEur: 220, totalKnown: false, evidence: "Listed price: EUR 220; period: month" },
    sharing: { open: null, evidence: null },
  });
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await f.owner.query(api.matches.listMine, {}))[0]?.contactEligible).toBe(true);
  await f.t.action(internal.matches.recomputeNeed, { ownerId: f.ownerId, savedNeedId: f.savedNeedId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(generateRoomScoutObject).toHaveBeenCalledTimes(1);
  await f.owner.mutation(api.savedNeeds.update, { needId: f.savedNeedId, requirements: ["Loud drums"] });
  expect(await f.owner.query(api.matches.listMine, {})).toHaveLength(0);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  // The cached/fixture result omits the new requirement and must fail closed.
  expect((await f.owner.query(api.matches.listMine, {}))[0]?.contactEligible).toBe(false);
});

it("retires paused search opportunities and keeps all owner projections private", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const otherId = await f.t.run(async (ctx) => ctx.db.insert("users", { username: "other", role: "musician", createdAt: 1, lastSeenAt: 1 }));
  expect(await f.t.withIdentity({ subject: otherId }).query(api.matches.listMine, { savedNeedId: f.savedNeedId })).toEqual([]);
  expect(await f.t.withIdentity({ subject: otherId }).query(api.matches.listCandidatesMine, { savedNeedId: f.savedNeedId })).toEqual([]);
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "paused" });
  expect(await f.owner.query(api.matches.listMine, {})).toEqual([]);
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  expect((await f.t.run(async (ctx) => ctx.db.query("opportunities").first()))?.status).toBe("expired");
});

it("removal retires a match without deleting its historical row", async () => {
  vi.useFakeTimers(); vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.setStatus, { needId: f.savedNeedId, status: "active" });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  await f.t.run(async (ctx) => { await ctx.db.patch(f.signalId, { status: "removed" }); });
  await f.t.mutation(internal.matches.retireSignalMatches, { signalId: f.signalId, cursor: null });
  expect(await f.owner.query(api.matches.listMine, {})).toEqual([]);
  expect((await f.t.run(async (ctx) => ctx.db.query("signalMatches").first()))?.eligible).toBe(false);
  expect((await f.t.run(async (ctx) => ctx.db.query("opportunities").first()))?.status).toBe("expired");
});

it("recreates a missing opportunity for a still-current match on recomputation", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "");
  const f = await fixture();
  await f.owner.mutation(api.savedNeeds.activate, { savedNeedId: f.savedNeedId });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const before = await f.t.run(async (ctx) => ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) =>
    q.eq("savedNeedId", f.savedNeedId).eq("fingerprint", `match:${f.savedNeedId}:${f.signalId}`)).unique());
  expect(before?.status).toBe("new");
  // The opportunity row disappears (reset, cleanup) while the signalMatch stays current.
  await f.t.run(async (ctx) => ctx.db.delete(before!._id));
  await f.t.mutation(internal.matches.rematchAllActive, { cursor: null });
  await f.t.finishAllScheduledFunctions(vi.runAllTimers);
  const after = await f.t.run(async (ctx) => ctx.db.query("opportunities").withIndex("by_saved_need_and_fingerprint", (q) =>
    q.eq("savedNeedId", f.savedNeedId).eq("fingerprint", `match:${f.savedNeedId}:${f.signalId}`)).unique());
  expect(after?.status).toBe("new");
  expect(after?.signalId).toBe(f.signalId);
  expect(await f.t.run(async (ctx) => (await ctx.db.query("signalMatches").collect()).length)).toBe(1);
});
