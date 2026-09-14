/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import { DEFAULT_AUTONOMY_RULES, autonomyHash, type AutonomyRules } from "./lib/autonomy";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const aliceId = await ctx.db.insert("users", { username: "alice", role: "musician", createdAt: now, lastSeenAt: now });
    const bobId = await ctx.db.insert("users", { username: "bob", role: "musician", createdAt: now, lastSeenAt: now });
    return { aliceId, bobId };
  });
  return { t, ids, alice: t.withIdentity({ subject: ids.aliceId }), bob: t.withIdentity({ subject: ids.bobId }) };
}

const reviewRules: AutonomyRules = {
  mode: "review",
  contact: false,
  viewings: true,
  publishAd: true,
  shareProfile: true,
  sharePrivate: true,
};

it("returns the contract defaults at version 0 for a user without a row", async () => {
  const { alice, t, ids } = await fixture();
  const expected = { rules: DEFAULT_AUTONOMY_RULES, version: 0, contentHash: await autonomyHash(DEFAULT_AUTONOMY_RULES), updatedAt: null };
  expect(await alice.query(api.autonomy.getMine, {})).toEqual(expected);
  expect(await t.query(internal.autonomy.getForOwner, { ownerId: ids.aliceId })).toEqual(expected);
});

it("saves, reads back the same rules, increments the version and writes an audit event", async () => {
  const { alice, t, ids } = await fixture();
  const first = await alice.mutation(api.autonomy.save, { rules: reviewRules });
  expect(first).toEqual({ version: 1, contentHash: await autonomyHash(reviewRules) });

  const mine = await alice.query(api.autonomy.getMine, {});
  expect(mine.rules).toEqual(reviewRules);
  expect(mine.version).toBe(1);
  expect(mine.contentHash).toBe(first.contentHash);
  expect(mine.updatedAt).toEqual(expect.any(Number));

  const changed: AutonomyRules = { ...reviewRules, mode: "autopilot", sharePrivate: false };
  const second = await alice.mutation(api.autonomy.save, { rules: changed });
  expect(second.version).toBe(2);
  expect(second.contentHash).not.toBe(first.contentHash);
  expect(second.contentHash).toBe(await autonomyHash(changed));
  expect(await alice.query(api.autonomy.getMine, {})).toMatchObject({ rules: changed, version: 2, contentHash: second.contentHash });

  const rows = await t.run(async (ctx) => ctx.db.query("scoutAutonomy").withIndex("by_owner", (q) => q.eq("ownerId", ids.aliceId)).collect());
  expect(rows).toHaveLength(1);

  const events = await t.run(async (ctx) => ctx.db.query("auditEvents").withIndex("by_entity_key_and_occurred_at", (q) => q.eq("entityKey", `autonomy:${ids.aliceId}`)).collect());
  expect(events.map((event) => ({ eventKey: event.eventKey, eventType: event.eventType, actorType: event.actorType, actorUserId: event.actorUserId, beforeHash: event.beforeHash, afterHash: event.afterHash })))
    .toEqual([
      { eventKey: `autonomy:${ids.aliceId}:1`, eventType: "autonomy.updated", actorType: "user", actorUserId: ids.aliceId, beforeHash: undefined, afterHash: first.contentHash },
      { eventKey: `autonomy:${ids.aliceId}:2`, eventType: "autonomy.updated", actorType: "user", actorUserId: ids.aliceId, beforeHash: first.contentHash, afterHash: second.contentHash },
    ]);
});

it("keeps the hash stable when the same rules are saved again", async () => {
  const { alice } = await fixture();
  const first = await alice.mutation(api.autonomy.save, { rules: reviewRules });
  const again = await alice.mutation(api.autonomy.save, { rules: { ...reviewRules } });
  expect(again).toEqual({ version: 2, contentHash: first.contentHash });
});

it("isolates users: one user's save never leaks into another's rules", async () => {
  const { alice, bob, t, ids } = await fixture();
  await alice.mutation(api.autonomy.save, { rules: reviewRules });
  expect(await bob.query(api.autonomy.getMine, {})).toMatchObject({ rules: DEFAULT_AUTONOMY_RULES, version: 0 });
  expect(await t.query(internal.autonomy.getForOwner, { ownerId: ids.bobId })).toMatchObject({ rules: DEFAULT_AUTONOMY_RULES, version: 0 });

  await bob.mutation(api.autonomy.save, { rules: { ...DEFAULT_AUTONOMY_RULES, publishAd: true } });
  expect(await alice.query(api.autonomy.getMine, {})).toMatchObject({ rules: reviewRules, version: 1 });
  expect(await bob.query(api.autonomy.getMine, {})).toMatchObject({ rules: { ...DEFAULT_AUTONOMY_RULES, publishAd: true }, version: 1 });
});

it("rejects unauthenticated reads and writes", async () => {
  const { t } = await fixture();
  await expect(t.query(api.autonomy.getMine, {})).rejects.toThrow("UNAUTHENTICATED");
  await expect(t.mutation(api.autonomy.save, { rules: DEFAULT_AUTONOMY_RULES })).rejects.toThrow("UNAUTHENTICATED");
});
