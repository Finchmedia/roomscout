/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("keeps provider readiness operator-only", async () => {
  const t = convexTest(schema, modules);
  const users = await t.run(async (ctx) => {
    const now = Date.now();
    const operatorId = await ctx.db.insert("users", {
      username: "operator",
      role: "operator",
      createdAt: now,
      lastSeenAt: now,
    });
    const musicianId = await ctx.db.insert("users", {
      username: "musician",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    return { operatorId, musicianId };
  });

  await expect(
    t.action(api.opsActions.providerReadiness, {}),
  ).rejects.toThrow();
  await expect(
    t
      .withIdentity({ subject: users.musicianId })
      .action(api.opsActions.providerReadiness, {}),
  ).rejects.toThrow();

  const result = await t
    .withIdentity({ subject: users.operatorId })
    .action(api.opsActions.providerReadiness, {});
  expect(result.serverProviderCount).toBe(5);
  expect(result.frontendMapbox).toMatchObject({
    status: "client_only",
    backendInspectable: false,
  });
});
