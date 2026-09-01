/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seedOrchestrationFixture(
  t: ReturnType<typeof convexTest>,
  options?: {
    mode?:
      | "guided"
      | "research_autopilot"
      | "outreach_autopilot"
      | "negotiation_autopilot";
    status?: "active" | "revoked";
    expiresAt?: number;
    adapterKey?: string;
    executor?: "firecrawl" | "browserbase";
  },
) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", {
      username: "owner",
      displayName: "Vera",
      role: "musician",
      createdAt: now,
      lastSeenAt: now,
    });
    const needId = await ctx.db.insert("savedNeeds", {
      ownerId,
      title: "Fester Proberaum für unsere Band",
      city: "Hamburg",
      districts: ["Bramfeld"],
      arrangement: ["permanent", "shared"],
      schedule: ["Mittwochabend"],
      requirements: ["Schlagzeug erlaubt"],
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "bandnet",
      name: "Bandnet Hamburg",
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
      slug: "bandnet-hamburg-supply",
      name: "Bandnet Proberaum frei",
      baseUrl: "https://bandnet.hamburg/anzeige/kategorie/19/proberaum-frei",
      side: "supply",
      status: "active",
      health: "healthy",
      createdAt: now,
      updatedAt: now,
    });
    const targetId = await ctx.db.insert("sourceTargets", {
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
      sourceTargetId: targetId,
      externalId: "42",
      canonicalUrl: "https://bandnet.hamburg/anzeige/42",
      detailUrl: "https://bandnet.hamburg/anzeige/42",
      title: "Proberaum für junge Band in Bramfeld frei",
      excerpt: "Öffentliches Inserat",
      side: "supply",
      city: "Hamburg",
      status: "active",
      detailState: "processed",
      detailAttempts: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      updatedAt: now,
      contactDataPresent: true,
    });
    const signalId = await ctx.db.insert("signals", {
      side: "supply",
      title: "Proberaum für junge Band in Bramfeld frei",
      city: "Hamburg",
      district: "Bramfeld",
      summary: "Öffentlich beobachtetes Angebot",
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
    await ctx.db.patch(entryId, { signalId });
    await ctx.db.insert("signalContacts", {
      signalId,
      sourceEntryId: entryId,
      kind: "platform",
      value: "https://bandnet.hamburg/anzeige/42/kontaktieren",
      confidence: 1,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("userMailboxes", {
      ownerId,
      provider: "agentmail",
      providerInboxId: "inbox_1",
      emailAddress: "roomscout-user@agentmail.to",
      clientId: "roomscout-user",
      status: "active",
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
      approvedAt: now,
      nextReviewAt: now + 86_400_000,
      createdAt: now,
      updatedAt: now,
    });
    const adapterKey = options?.adapterKey ?? "bandnet-contact-form-v1";
    const executor = options?.executor ?? "firecrawl";
    const bindingId = await ctx.db.insert("sourceAdapterBindings", {
      platformId,
      sourceId,
      scopeKey: `source:${sourceId}`,
      flow: "contact",
      adapterKey,
      adapterVersion: 1,
      status: "active",
      executor,
      config:
        executor === "firecrawl"
          ? {
              kind: "firecrawl" as const,
              extractionProfileKey: adapterKey,
              monitorDriven: false,
            }
          : {
              kind: "browserbase" as const,
              workflowKey: adapterKey,
              contextRequired: true,
            },
      configFingerprint: `binding:${adapterKey}`,
      policyVersionId: policyId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(targetId, { adapterBindingId: bindingId });
    const mandateId = await ctx.db.insert("searchMandates", {
      ownerId,
      savedNeedId: needId,
      version: 1,
      mode: options?.mode ?? "outreach_autopilot",
      status: options?.status ?? "active",
      platformIds: [platformId],
      allowedActionTypes: ["submit_webform"],
      allowedPersonalData: ["reply_email"],
      maxContactsPerDay: 5,
      maxBrowserMinutesPerDay: 30,
      expiresAt: options?.expiresAt ?? now + 86_400_000,
      stopOnComplaint: true,
      stopWhenSuitableRoomConfirmed: true,
      commitmentBoundary: "non_binding_outreach_only",
      contentHash: "mandate-hash",
      activatedAt: now,
      ...(options?.status === "revoked" ? { stoppedAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    });
    const opportunityId = await ctx.db.insert("opportunities", {
      ownerId,
      savedNeedId: needId,
      kind: "supply_match",
      status: "new",
      signalId,
      platformId,
      score: 0.91,
      reasons: ["same city"],
      uncertainties: [],
      fingerprint: `match:${needId}:${signalId}`,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { ownerId, needId, platformId, mandateId, opportunityId };
  });
}

it("orchestrates one exact Bandnet action idempotently from a standing mandate", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedOrchestrationFixture(t);
  const first = await t.mutation(internal.mandateOrchestrator.runForOwner, {
    ownerId: fixture.ownerId,
    limit: 5,
  });
  const second = await t.mutation(internal.mandateOrchestrator.runForOwner, {
    ownerId: fixture.ownerId,
    limit: 5,
  });
  expect(first).toMatchObject({ created: 1, scheduled: 1 });
  expect(second.created).toBe(0);
  const state = await t.run(async (ctx) => ({
    requests: await ctx.db
      .query("actionRequests")
      .withIndex("by_opportunity", (q) =>
        q.eq("opportunityId", fixture.opportunityId),
      )
      .collect(),
    approvals: await ctx.db.query("actionApprovals").collect(),
  }));
  expect(state.requests).toHaveLength(1);
  expect(state.requests[0]).toMatchObject({
    mandateId: fixture.mandateId,
    automationMode: "standing_mandate",
    requestedActionType: "submit_webform",
    status: "approved",
  });
  expect(state.approvals).toHaveLength(1);
  expect(state.approvals[0]).toMatchObject({
    decision: "authorized_by_mandate",
    mandateId: fixture.mandateId,
    mandateHash: "mandate-hash",
  });
});

it("does not orchestrate revoked or expired mandates", async () => {
  const revokedTest = convexTest(schema, modules);
  const revoked = await seedOrchestrationFixture(revokedTest, {
    status: "revoked",
  });
  expect(
    (
      await revokedTest.mutation(internal.mandateOrchestrator.runForOwner, {
        ownerId: revoked.ownerId,
      })
    ).created,
  ).toBe(0);

  const expiredTest = convexTest(schema, modules);
  const expired = await seedOrchestrationFixture(expiredTest, {
    expiresAt: Date.now() - 1,
  });
  const result = await expiredTest.mutation(
    internal.mandateOrchestrator.runForOwner,
    { ownerId: expired.ownerId },
  );
  expect(result).toMatchObject({ created: 0, expired: 1 });
  expect(
    await expiredTest.run(async (ctx) => (await ctx.db.get(expired.mandateId))?.status),
  ).toBe("expired");
});

it("records a durable audit event when the owner uses the search kill switch", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedOrchestrationFixture(t);
  const owner = t.withIdentity({ subject: fixture.ownerId });

  await expect(
    owner.mutation(api.mandates.killSwitch, { savedNeedId: fixture.needId }),
  ).resolves.toBe(1);

  const state = await t.run(async (ctx) => ({
    mandate: await ctx.db.get(fixture.mandateId),
    auditEvents: await ctx.db
      .query("auditEvents")
      .withIndex("by_entity_key_and_occurred_at", (q) =>
        q.eq("entityKey", `mandate:${fixture.mandateId}`),
      )
      .collect(),
  }));
  expect(state.mandate).toMatchObject({ status: "revoked" });
  expect(state.auditEvents).toContainEqual(
    expect.objectContaining({
      actorType: "user",
      actorUserId: fixture.ownerId,
      eventType: "mandate.kill_switch_revoked",
    }),
  );

  const orchestrated = await t.mutation(
    internal.mandateOrchestrator.runForOwner,
    { ownerId: fixture.ownerId },
  );
  expect(orchestrated.created).toBe(0);
});

it.each(["guided", "research_autopilot"] as const)(
  "does not execute external communication in %s mode",
  async (mode) => {
    const t = convexTest(schema, modules);
    const fixture = await seedOrchestrationFixture(t, { mode });
    const result = await t.mutation(
      internal.mandateOrchestrator.runForOwner,
      { ownerId: fixture.ownerId },
    );
    expect(result.created).toBe(0);
    expect(await t.run(async (ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
  },
);

it.each([
  { adapterKey: "unreviewed-contact-v1", executor: "firecrawl" as const },
  { adapterKey: "bandnet-contact-form-v1", executor: "browserbase" as const },
])("does not orchestrate an unsupported channel %#", async (options) => {
  const t = convexTest(schema, modules);
  const fixture = await seedOrchestrationFixture(t, options);
  const owner = t.withIdentity({ subject: fixture.ownerId });
  const result = await owner.mutation(api.mandateOrchestrator.runNowMine, {
    limit: 5,
  });
  expect(result.created).toBe(0);
  expect(await t.run(async (ctx) => ctx.db.query("actionRequests").collect())).toEqual([]);
});
