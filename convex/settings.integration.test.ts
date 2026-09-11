/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
it("updates only the authenticated user's display name", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { username: "settings-user", role: "musician", createdAt: 1, lastSeenAt: 1 }));
  const otherId = await t.run((ctx) => ctx.db.insert("users", { username: "other-user", displayName: "Other", role: "musician", createdAt: 1, lastSeenAt: 1 }));
  const user = t.withIdentity({ subject: userId });
  await user.mutation(api.settings.updateDisplayName, { displayName: "  The Cooks  " });
  expect(await user.query(api.users.current, {})).toMatchObject({ username: "settings-user", displayName: "The Cooks", role: "musician" });
  expect(await t.run((ctx) => ctx.db.get(otherId))).toMatchObject({ displayName: "Other" });
  await expect(user.mutation(api.settings.updateDisplayName, { displayName: "x".repeat(81) })).rejects.toThrow("INVALID_DISPLAY_NAME");
  await expect(t.mutation(api.settings.updateDisplayName, { displayName: "Intruder" })).rejects.toThrow();
});
