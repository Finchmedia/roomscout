/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import agentTest from "@convex-dev/agent/test";
import workpoolTest from "@convex-dev/workpool/test";
import { expect, it } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { messageSafetySchema } from "./lib/messageSafety";

const modules = import.meta.glob("./**/*.ts");

function testConvex() {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool");
  return t;
}

async function seedScoutWebform(t: ReturnType<typeof convexTest>, domain = "bandnet.hamburg") {
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
      canonicalDomain: domain,
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
      baseUrl: `https://${domain}/anzeige/kategorie/19/proberaum-frei`,
      side: "supply",
      status: "active",
      health: "healthy",
      createdAt: now,
      updatedAt: now,
    });
    const sourceTargetId = await ctx.db.insert("sourceTargets", {
      sourceId,
      url: `https://${domain}/anzeige/kategorie/19/proberaum-frei`,
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
      canonicalUrl: `https://${domain}/anzeige/42`,
      detailUrl: `https://${domain}/anzeige/42`,
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
      value: `https://${domain}/anzeige/42/kontaktieren`,
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
      evidenceUrls: [`https://${domain}/nutzungsbedingungen`],
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

it("stops legacy real-source Autopilot drafts with a reason instead of sending fictional demo outreach", async () => {
  const t = testConvex();
  const fixture = await seedScoutWebform(t);
  const result = await t.mutation(internal.externalActions.createContactFormFromScout, {
    ownerId: fixture.ownerId,
    savedNeedId: fixture.savedNeedId,
    signalId: fixture.signalId,
    senderEmail: "scout@example.test",
    subject: "Is the rehearsal room still available?",
    body: "Hello, is the room still available for a four-piece band?",
  });

  expect(result).toMatchObject({ status: "blocked", authorizedByAutopilot: false });
  const state = await t.run(async (ctx) => ({
    request: await ctx.db.get(result.requestId),
    approval: await ctx.db.query("actionApprovals").withIndex("by_request_and_content_version", (q) =>
      q.eq("requestId", result.requestId).eq("contentVersion", 1),
    ).unique(),
    audit: await ctx.db.query("auditEvents").collect(),
  }));
  expect(state.request).toMatchObject({
    mandateId: fixture.mandateId,
    automationMode: "standing_mandate",
    status: "blocked",
    error: "controlled_portal_only",
    gate: { outcome: "stop", reason: "controlled_portal_only", detail: "bandnet.hamburg", autonomyVersion: 0 },
  });
  expect(state.approval).toBeNull();
  expect(state.audit.map((event) => event.eventType)).toEqual(["action.scout_drafted_webform", "action.stopped_by_gate"]);
});

it("turns a binding Scout draft into an Entscheidung with the reason, never silent review", async () => {
  const t = testConvex();
  const fixture = await seedScoutWebform(t, "roomscout.dev");
  const result = await t.mutation(internal.externalActions.createContactFormFromScout, {
    ownerId: fixture.ownerId,
    savedNeedId: fixture.savedNeedId,
    signalId: fixture.signalId,
    senderEmail: "scout@example.test",
    subject: "Contract acceptance",
    body: "We accept the contract and confirm the booking.",
  });

  // Wording alone never decides: the request waits for the safety verdict.
  expect(result).toMatchObject({ status: "queued", authorizedByAutopilot: false });
  expect(await t.run((ctx) => ctx.db.get(result.requestId))).toMatchObject({
    automationMode: "standing_mandate", status: "queued", gate: { outcome: "wait", reason: "safety_pending" },
  });

  const input = (await t.query(internal.messageSafety.getInput, { requestId: result.requestId }))!;
  const binding = messageSafetySchema.parse({ classification: "binding", explanation: "Accepts the contract and confirms a booking.", personalDataScopes: ["reply_email"], proposedMonthlyPriceEur: null, unsupportedClaims: [] });
  expect(await t.mutation(internal.messageSafety.recordAndAuthorize, { requestId: result.requestId, snapshotHash: input.snapshotHash, assessment: binding })).toBe(false);
  expect(await t.run((ctx) => ctx.db.get(result.requestId))).toMatchObject({
    automationMode: "standing_mandate", status: "awaiting_approval",
    gate: { outcome: "ask_user", reason: "binding_content", detail: "Accepts the contract and confirms a booking." },
  });
  expect(await t.run((ctx) => ctx.db.query("actionApprovals").collect())).toEqual([]);
});
