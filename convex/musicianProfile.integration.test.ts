/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("saves only the authenticated musician's confirmed provider identity", async () => {
  const t = convexTest(schema, modules);
  const ownerId = await t.run((ctx) => ctx.db.insert("users", {
    username: "login-handle",
    role: "musician",
    createdAt: 1,
    lastSeenAt: 1,
  }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", {
    username: "other-login",
    displayName: "Existing identity",
    role: "musician",
    createdAt: 1,
    lastSeenAt: 1,
  }));
  const owner = t.withIdentity({ subject: ownerId });

  await owner.mutation(api.musicianProfile.saveMine, {
    firstName: "  Alex ",
    lastName: " Private-Surname ",
    actKind: "band",
    actName: " Neon Harbour ",
    expectedProviderDisplayName: "RoomScout for Neon Harbour",
  });

  expect(await owner.query(api.users.current, {})).toMatchObject({
    username: "login-handle",
    displayName: "Neon Harbour",
    firstName: "Alex",
    lastName: "Private-Surname",
    actKind: "band",
    actName: "Neon Harbour",
    profileCompleted: true,
    providerDisplayName: "RoomScout for Neon Harbour",
    representedName: "Neon Harbour",
  });
  expect(await t.run((ctx) => ctx.db.get(otherId))).toMatchObject({ displayName: "Existing identity" });

  await expect(owner.mutation(api.musicianProfile.saveMine, {
    firstName: "Alex",
    actKind: "solo",
    expectedProviderDisplayName: "RoomScout for login-handle",
  })).rejects.toThrow("PROFILE_PREVIEW_CHANGED");
  await expect(t.mutation(api.musicianProfile.saveMine, {
    firstName: "Intruder",
    actKind: "solo",
    expectedProviderDisplayName: "RoomScout for Intruder",
  })).rejects.toThrow();
});
