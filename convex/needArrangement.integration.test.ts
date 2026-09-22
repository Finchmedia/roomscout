/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { generateRoomScoutObject } from "./ai";
import schema from "./schema";

vi.mock("./ai", async (importOriginal) => ({
  ...await importOriginal<typeof import("./ai")>(),
  generateRoomScoutObject: vi.fn(async () => {
    throw new Error("Model disabled in deterministic tests");
  }),
}));

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.mocked(generateRoomScoutObject).mockReset().mockRejectedValue(
    new Error("Model disabled in deterministic tests"),
  );
});

it.each(["create", "update", "updateFromScout"] as const)(
  "%s keeps shared and permanent when sharing is offered",
  async (writer) => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const ownerId = await t.run(async (ctx) => await ctx.db.insert("users", {
      username: "sharing-writer", role: "musician", createdAt: 1, lastSeenAt: 1,
    }));
    const owner = t.withIdentity({ subject: ownerId });
    const brief = {
      title: "Weekly rehearsal", locationQuery: "Berlin", arrangement: ["permanent" as const],
      schedule: ["Wednesday evening"], requirements: [], radiusKm: 15,
    };
    const needId = writer === "create"
      ? await owner.mutation(api.savedNeeds.create, { ...brief, arrangement: ["shared"], openToSharing: true })
      : await owner.mutation(api.savedNeeds.getOrCreateDraft, {});
    if (writer === "update") {
      await owner.mutation(api.savedNeeds.update, { needId, arrangement: brief.arrangement });
      await owner.mutation(api.savedNeeds.update, { needId, openToSharing: true });
      // A later model or form write must use the already-stored sharing choice.
      await owner.mutation(api.savedNeeds.update, { needId, arrangement: ["shared"] });
    } else if (writer === "updateFromScout") {
      await t.mutation(internal.savedNeeds.updateFromScout, { ownerId, needId, arrangement: brief.arrangement });
      await t.mutation(internal.savedNeeds.updateFromScout, { ownerId, needId, openToSharing: true });
      await t.mutation(internal.savedNeeds.updateFromScout, { ownerId, needId, arrangement: ["shared"] });
    }
    const saved = await owner.query(api.savedNeeds.getMine, { needId });
    expect(saved?.openToSharing).toBe(true);
    expect(saved?.arrangement.toSorted()).toEqual(["permanent", "shared"]);
  },
);

it("matches Modul Ost after voice captures an open-to-sharing Berlin brief", async () => {
  vi.useFakeTimers();
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("SCOUT_CONTROLLED_PORTAL_ONLY", "false");
  const t = convexTest(schema, modules);
  const { ownerId, signalId } = await t.run(async (ctx) => {
    const ownerId = await ctx.db.insert("users", {
      username: "arrangement-integration",
      role: "musician",
      createdAt: 1,
      lastSeenAt: 1,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "Modul Ost",
      city: "Berlin",
      district: "Marzahn",
      summary: "Permanent rehearsal room in Marzahn, available Wednesday 18:00-22:00.",
      arrangement: "permanent",
      priceEur: 220,
      pricePeriod: "month",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: 1,
      lastSeenAt: 1,
      latitude: 52.54,
      longitude: 13.54,
    });
    return { ownerId, signalId };
  });
  const owner = t.withIdentity({ subject: ownerId });
  const needId = await owner.mutation(api.savedNeeds.getOrCreateDraft, {});

  // Voice fact capture writes through this internal mutation. The model may
  // report sharing as the arrangement, but "open" also keeps a private room
  // acceptable and therefore must widen the stored hard filter.
  await t.mutation(internal.savedNeeds.updateFromScout, {
    ownerId,
    needId,
    locationQuery: "Berlin Marzahn",
    locationLabel: "Berlin",
    radiusKm: 20,
    maxBudgetEur: 220,
    arrangement: ["shared"],
    openToSharing: true,
    schedule: ["Wednesday 18:00-22:00"],
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(needId, {
      centerLatitude: 52.54,
      centerLongitude: 13.54,
      locationPrecision: "district",
    });
  });

  expect(await owner.query(api.savedNeeds.getMine, { needId })).toMatchObject({
    arrangement: ["shared", "permanent"],
    openToSharing: true,
    maxBudgetEur: 220,
    schedule: ["Wednesday 18:00-22:00"],
  });

  await owner.mutation(api.savedNeeds.activate, { savedNeedId: needId });
  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const matches = await owner.query(api.matches.listMine, { savedNeedId: needId });
  expect(matches.map((match) => match.signalId)).toContain(signalId);
  expect(matches.find((match) => match.signalId === signalId)).toMatchObject({
    signal: {
      title: "Modul Ost",
      arrangement: "permanent",
      priceEur: 220,
      district: "Marzahn",
    },
  });
  expect(await t.run(async (ctx) => ctx.db
    .query("signalMatches")
    .withIndex("by_saved_need_and_signal", (q) =>
      q.eq("savedNeedId", needId).eq("signalId", signalId),
    )
    .unique())).toMatchObject({ eligible: true });
});
