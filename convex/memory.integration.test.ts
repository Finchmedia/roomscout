/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("allows a user to retain more than 500 active memory facts", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => {
    const now = Date.now();
    return await ctx.db.insert("users", {
      username: "memory-owner",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
  });
  const user = t.withIdentity({ subject: userId });

  for (let batch = 0; batch < 13; batch += 1) {
    const result = await user.mutation(api.memory.importFacts, {
      batchId: `memory-import-${batch}`,
      facts: Array.from({ length: 40 }, (_, index) => ({
        subject: "The Example Band",
        subjectKind: "band" as const,
        predicate: `preference_${batch}_${index}`,
        value: `Fact ${batch * 40 + index}`,
        category: "preference" as const,
        confidence: 1,
        sensitivity: "normal" as const,
        relevance: "Retained user context",
      })),
    });
    expect(result).toEqual({ imported: 40, duplicateBatch: false });
  }

  const activeCount = await t.run(async (ctx) =>
    (await ctx.db
      .query("memoryFacts")
      .withIndex("by_owner_and_status", (q) =>
        q.eq("ownerId", userId).eq("status", "active"),
      )
      .collect()).length,
  );
  expect(activeCount).toBe(520);
});

it("lets only the owner correct and confirm an active memory fact", async () => {
  const t = convexTest(schema, modules);
  const { ownerId, otherId, factId } = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "fact-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const otherId = await ctx.db.insert("users", { username: "fact-other", role: "musician", createdAt: now, lastSeenAt: now });
    const entityId = await ctx.db.insert("memoryEntities", { ownerId, kind: "band", name: "Band", normalizedName: "band", createdAt: now, updatedAt: now });
    const factId = await ctx.db.insert("memoryFacts", { ownerId, subjectEntityId: entityId, predicate: "drum_kit_room_preference", value: "Mitnutzbares Schlagzeug", category: "equipment", confidence: .7, source: "conversation", verification: "inferred", sensitivity: "normal", status: "active", createdAt: now, updatedAt: now });
    await ctx.db.insert("memoryProfiles", { ownerId, factVersion: 0, contextVersion: 0, hardConstraints: [], softPreferences: [], openQuestions: [], createdAt: now, updatedAt: now });
    return { ownerId, otherId, factId };
  });
  await expect(t.withIdentity({ subject: otherId }).mutation(api.memory.updateFact, { factId: factId as Id<"memoryFacts">, value: "Eigenes Schlagzeug darf bleiben" })).rejects.toThrow();
  const owner = t.withIdentity({ subject: ownerId });
  await owner.mutation(api.memory.updateFact, { factId, value: "Eigenes Schlagzeug darf dauerhaft bleiben" });
  await owner.mutation(api.memory.confirmFact, { factId });
  const fact = await t.run(async (ctx) => await ctx.db.get(factId));
  expect(fact).toMatchObject({ value: "Eigenes Schlagzeug darf dauerhaft bleiben", source: "user_edit", verification: "user_confirmed", confidence: 1 });
});
