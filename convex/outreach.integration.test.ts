/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { contentHash } from "./integrations/contentHash";

const modules = import.meta.glob("./**/*.ts");

afterEach(() => vi.unstubAllEnvs());

async function approvedDraft(profileComplete: boolean) {
  const t = convexTest(schema, modules);
  const draftId = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "legacy-outreach-owner",
      ...(profileComplete
        ? { firstName: "Mina", actKind: "band" as const, actName: "Night Owls", providerIdentityConfirmedAt: now }
        : {}),
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply", title: "Room", city: "Hamburg", summary: "Room",
      arrangement: "shared", requirements: [], unknowns: [], status: "published",
      verification: "observed", sourceCount: 1, firstSeenAt: now, lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId, title: "Room", city: "Hamburg", districts: [], arrangement: ["shared"],
      schedule: [], requirements: [], status: "active", createdAt: now, updatedAt: now,
    });
    const recipientEmail = "provider@example.com";
    const subject = "Rehearsal room";
    const body = "Is the room available?";
    const exactHash = await contentHash([recipientEmail, subject, body]);
    const id = await ctx.db.insert("outreachDrafts", {
      ownerId, signalId, savedNeedId, recipientName: "Provider", recipientEmail, subject, body,
      contentVersion: 1, contentHash: exactHash, status: "approved", approvedAt: now,
      createdAt: now, updatedAt: now,
    });
    await ctx.db.insert("outreachApprovals", {
      draftId: id, ownerId, contentVersion: 1, contentHash: exactHash,
      recipientEmail, subject, body, decision: "approved", decidedAt: now,
    });
    return id;
  });
  return { t, draftId };
}

it("blocks an exactly approved legacy email at the final claim while demo mode is on", async () => {
  const { t, draftId } = await approvedDraft(true);

  expect(await t.mutation(internal.outreach.claimApprovedSend, { draftId })).toEqual({ shouldSend: false });
  expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
    status: "failed",
    error: "CONTROLLED_PORTAL_ONLY",
  });
});

it("requires the canonical musician profile before a non-demo legacy email can be claimed", async () => {
  vi.stubEnv("SCOUT_CONTROLLED_PORTAL_ONLY", "false");
  const { t, draftId } = await approvedDraft(false);

  expect(await t.mutation(internal.outreach.claimApprovedSend, { draftId })).toEqual({ shouldSend: false });
  expect(await t.run((ctx) => ctx.db.get(draftId))).toMatchObject({
    status: "failed",
    error: "MUSICIAN_PROFILE_REQUIRED",
  });
});

it("keeps the reviewed legacy email workflow available when demo mode is explicitly disabled", async () => {
  vi.stubEnv("SCOUT_CONTROLLED_PORTAL_ONLY", "false");
  const { t, draftId } = await approvedDraft(true);

  expect(await t.mutation(internal.outreach.claimApprovedSend, { draftId })).toMatchObject({
    shouldSend: true,
    draftId,
    recipientEmail: "provider@example.com",
  });
});
