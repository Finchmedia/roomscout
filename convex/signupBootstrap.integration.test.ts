/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
it("schedules post-signup inbox provisioning and a truthful demo connection", async () => {
  vi.useFakeTimers();
  vi.stubEnv("AGENTMAIL_API_KEY", "");
  vi.stubEnv("AGENTMAIL_ADDRESS_SALT", "");
  const t = convexTest(schema, modules);
  const ownerId = await t.mutation(internal.users.createUserPassword, {
    provider: "password",
    providerAccountId: "",
    profile: { username: "TheStrummers" },
  });

  await t.finishAllScheduledFunctions(vi.runAllTimers);

  const state = await t.run(async (ctx) => ({
    mailbox: await ctx.db
      .query("userMailboxes")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique(),
    connections: await ctx.db
      .query("portalConnections")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .take(2),
  }));
  expect(state.mailbox).toBeNull();
  expect(state.connections).toHaveLength(1);
  expect(state.connections[0]).toMatchObject({
    status: "needs_auth",
    policyDecision: "allowed",
    adapterKey: "roomscout-dev-v1",
  });
});
