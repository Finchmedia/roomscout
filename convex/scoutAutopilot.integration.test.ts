/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedScoutWebform(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "scout-owner",
      displayName: "The Cooks",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const savedNeedId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Permanent room for The Cooks",
      city: "Hamburg",
      districts: [],
      arrangement: ["permanent", "shared"],
      schedule: [],
      requirements: [],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "bandnet",
      name: "Bandnet",
      canonicalDomain: "bandnet.hamburg",
      kind: "community",
      status: "active",
      firstSeenAt: now,
      lastObservedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId,
      slug: "bandnet-supply",
      name: "Bandnet supply",
      baseUrl: "https://bandnet.hamburg/anzeige/kategorie/19/proberaum-frei",
      side: "supply",
      status: "active",
      health: "healthy",
      createdAt: now,
      updatedAt: now,
    });
    const sourceTargetId = await ctx.db.insert("sourceTargets", {
      sourceId,
      url: "https://bandnet.hamburg/anzeige/kategorie/19/proberaum-frei",
      mode: "scrape",
      changeTrackingTag: "bandnet-supply",
      scheduleMinutes: 1_440,
      nextRunAt: now,
      paused: false,
      createdAt: now,
      updatedAt: now,
    });
    const entryId = await ctx.db.insert("sourceEntries", {
      sourceId,
      sourceTargetId,
      externalId: "room-42",
      canonicalUrl: "https://bandnet.hamburg/anzeige/42",
      detailUrl: "https://bandnet.hamburg/anzeige/42",
      title: "Room in Bramfeld",
      excerpt: "Public listing",
      side: "supply",
      city: "Hamburg",
      status: "active",
      detailState: "processed",
      detailAttempts: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      updatedAt: now,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "Room in Bramfeld",
      city: "Hamburg",
      summary: "Public room offer",
      arrangement: "shared",
      requirements: [],
      unknowns: [],
      status: "published",
      verification: "observed",
      sourceCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      sourceEntryId: entryId,
    });
    await ctx.db.insert("signalContacts", {
      signalId,
      sourceEntryId: entryId,
      kind: "platform",
      value: "https://bandnet.hamburg/anzeige/42/kontaktieren",
      confidence: 1,
      createdAt: now,
      updatedAt: now,
    });
    const policyId = await ctx.db.insert("sourceFlowPolicies", {
      platformId,
      sourceId,
      scopeKey: `source:${sourceId}`,
      flow: "contact",
      version: 1,
      status: "approved",
      decision: "allowed",
      maxAutomationLevel: "approved_execute",
      userConnectionRequired: false,
      humanPresenceRequired: false,
      accountCreationAllowed: false,
      externalApprovalRequired: true,
      robotsDecision: "allowed",
      termsDecision: "allowed",
      evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"],
      nextReviewAt: now + 86_400_000,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("sourceAdapterBindings", {
      platformId,
      sourceId,
      scopeKey: `source:${sourceId}`,
      flow: "contact",
      adapterKey: "bandnet-contact-form-v1",
      adapterVersion: 1,
      status: "active",
      executor: "firecrawl",
      config: {
        kind: "firecrawl",
        extractionProfileKey: "bandnet-contact-form-v1",
        monitorDriven: false,
      },
      configFingerprint: "bandnet-contact-form-v1:1",
      policyVersionId: policyId,
      createdAt: now,
      updatedAt: now,
    });
    const mandateId = await ctx.db.insert("searchMandates", {
      ownerId,
      savedNeedId,
      version: 1,
      mode: "negotiation_autopilot",
      status: "active",
      platformIds: [platformId],
      allowedActionTypes: ["submit_webform"],
      allowedPersonalData: ["reply_email"],
      maxContactsPerDay: 10,
      maxBrowserMinutesPerDay: 30,
      expiresAt: now + 86_400_000,
      stopOnComplaint: true,
      stopWhenSuitableRoomConfirmed: true,
      commitmentBoundary: "non_binding_outreach_only",
      contentHash: "mandate-hash",
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, savedNeedId, signalId, mandateId };
  });
}

it("lets the Scout execute reviewed non-binding webform outreach through Autopilot", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedScoutWebform(t);
  const result = await t.mutation(internal.externalActions.createContactFormFromScout, {
    ownerId: fixture.ownerId,
    savedNeedId: fixture.savedNeedId,
    signalId: fixture.signalId,
    senderEmail: "scout@example.test",
    subject: "Is the rehearsal room still available?",
    body: "Hello, is the room still available for a four-piece band?",
  });

  expect(result).toMatchObject({ status: "approved", authorizedByAutopilot: true });
  const state = await t.run(async (ctx) => ({
    request: await ctx.db.get(result.requestId),
    approval: await ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) =>
      q.eq("requestId", result.requestId).eq("contentVersion", 1),
    ).unique(),
  }));
  expect(state.request).toMatchObject({
    mandateId: fixture.mandateId,
    automationMode: "standing_mandate",
    status: "approved",
  });
  expect(state.approval).toMatchObject({
    decision: "authorized_by_mandate",
    mandateId: fixture.mandateId,
  });
});

it("falls back to human review when Scout prose contains a binding commitment", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedScoutWebform(t);
  const result = await t.mutation(internal.externalActions.createContactFormFromScout, {
    ownerId: fixture.ownerId,
    savedNeedId: fixture.savedNeedId,
    signalId: fixture.signalId,
    senderEmail: "scout@example.test",
    subject: "Contract acceptance",
    body: "We accept the contract and confirm the booking.",
  });

  expect(result).toMatchObject({
    status: "awaiting_approval",
    authorizedByAutopilot: false,
  });
  const request = await t.run(async (ctx) => await ctx.db.get(result.requestId));
  expect(request).toMatchObject({ automationMode: "exact_once", status: "awaiting_approval" });
});
