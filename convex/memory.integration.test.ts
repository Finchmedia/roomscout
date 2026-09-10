/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
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
