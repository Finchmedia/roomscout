/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import agentTest from "@convex-dev/agent/test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import workpoolTest from "@convex-dev/workpool/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { signalMatchRevision } from "./lib/matchValidity";

const modules = import.meta.glob("./**/*.ts");
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

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
    await ctx.db.insert("signalMatches", {
      ownerId, savedNeedId: needId, signalId, kind: "need_supply", eligible: true, contactEligible: true,
      needRevision: 0, signalRevision: await signalMatchRevision((await ctx.db.get(signalId))!),
      status: "new", score: 0.91, structuredScore: 0.91, semanticScore: 0.91,
      reasons: ["same city"], uncertainties: [], fingerprint: "fixture-match", createdAt: now, updatedAt: now,
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
    return { ownerId, needId, platformId, mandateId, opportunityId, signalId, entryId, sourceId, bindingId, policyId };
  });
}

async function makeControlledRegistrationEligible(
  t: ReturnType<typeof convexTest>,
  fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>,
) {
  return await t.run(async (ctx) => {
    await ctx.db.patch(fixture.platformId, {
      slug: "roomscout-dev",
      canonicalDomain: "roomscout.dev",
    });
    await ctx.db.patch(fixture.sourceId, {
      slug: "roomscout-dev-connected",
      baseUrl: "https://roomscout.dev/",
      accessMode: "authenticated",
      automationReview: "approved",
      adapterKey: "roomscout-dev-v1",
    });
    await ctx.db.patch(fixture.policyId, {
      sourceId: fixture.sourceId,
      maxAutomationLevel: "approved_execute",
      humanPresenceRequired: false,
      accountCreationAllowed: true,
      robotsDecision: "allowed",
      termsDecision: "allowed",
    });
    await ctx.db.patch(fixture.bindingId, {
      sourceId: fixture.sourceId,
      adapterKey: "roomscout-dev-v1",
      executor: "browserbase",
      config: {
        kind: "browserbase",
        workflowKey: "roomscout-dev.platform-message.v1",
        contextRequired: true,
      },
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId: fixture.ownerId,
      sourceId: fixture.sourceId,
      platformId: fixture.platformId,
      label: "roomscout.dev portal",
      allowedDomains: ["roomscout.dev"],
      allowedPaths: ["/", "/sign-up", "/sign-in", "/listings", "/inbox"],
      inboxPath: "/inbox",
      adapterKey: "roomscout-dev-v1",
      status: "needs_auth",
      policyDecision: "allowed",
      allowReadOnlyRecon: false,
      allowInboxPolling: true,
      pollIntervalMinutes: 60,
      failureCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const mandate = await ctx.db.get(fixture.mandateId);
    await ctx.db.patch(fixture.mandateId, {
      allowedActionTypes: [...(mandate?.allowedActionTypes ?? []), "create_portal_account"],
      commitmentBoundary: "non_binding_outreach_only",
    });
    return connectionId;
  });
}

it("schedules one controlled portal registration before outreach and remains idempotent", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedOrchestrationFixture(t);
  const connectionId = await makeControlledRegistrationEligible(t, fixture);

  expect(await t.mutation(internal.mandateOrchestrator.runForOwner, {
    ownerId: fixture.ownerId,
  })).toMatchObject({ created: 0, scheduled: 1 });
  expect(await t.mutation(internal.mandateOrchestrator.runForOwner, {
    ownerId: fixture.ownerId,
  })).toMatchObject({ created: 0, scheduled: 0 });

  const state = await t.run(async (ctx) => ({
    runs: await ctx.db.query("browserRuns").withIndex("by_connection", (q) =>
      q.eq("connectionId", connectionId),
    ).collect(),
    turns: await ctx.db.query("providerTurns").collect(),
  }));
  expect(state.runs).toHaveLength(1);
  expect(state.runs[0]).toMatchObject({
    ownerId: fixture.ownerId,
    connectionId,
    kind: "authenticate",
    status: "queued",
  });
  expect(state.turns).toEqual([]);
});

it("stops a queued registration when its standing mandate is revoked before execution", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedOrchestrationFixture(t);
  const connectionId = await makeControlledRegistrationEligible(t, fixture);
  await t.mutation(internal.mandateOrchestrator.runForOwner, { ownerId: fixture.ownerId });
  const runId = await t.run(async (ctx) =>
    (await ctx.db.query("browserRuns").withIndex("by_connection", (q) => q.eq("connectionId", connectionId)).unique())!._id,
  );
  await t.run(async (ctx) => {
    await ctx.db.patch(fixture.mandateId, { status: "revoked", stoppedAt: Date.now() });
  });

  await expect(t.action(internal.browserbasePortal.runScheduledAgentRegistration, {
    ownerId: fixture.ownerId,
    mandateId: fixture.mandateId,
    connectionId,
    runId,
  })).resolves.toBeNull();
  expect(await t.run(async (ctx) => ctx.db.get(runId))).toMatchObject({
    status: "stopped",
    errorCode: "REGISTRATION_MANDATE_NO_LONGER_ACTIVE",
  });
});

it("surfaces a scheduled registration startup failure on the reserved browser run", async () => {
  vi.stubEnv("BROWSERBASE_API_KEY", "");
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  const fixture = await seedOrchestrationFixture(t);
  const connectionId = await makeControlledRegistrationEligible(t, fixture);
  await t.mutation(internal.mandateOrchestrator.runForOwner, { ownerId: fixture.ownerId });
  const runId = await t.run(async (ctx) =>
    (await ctx.db.query("browserRuns").withIndex("by_connection", (q) => q.eq("connectionId", connectionId)).unique())!._id,
  );

  await expect(t.action(internal.browserbasePortal.runScheduledAgentRegistration, {
    ownerId: fixture.ownerId,
    mandateId: fixture.mandateId,
    connectionId,
    runId,
  })).resolves.toBeNull();
  expect(await t.run(async (ctx) => ctx.db.get(runId))).toMatchObject({
    status: "failed",
    errorCode: "PROVIDER_ERROR",
  });
});

it.each([
  {
    name: "guided mode",
    mutate: async (t: ReturnType<typeof convexTest>, fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>) =>
      await t.run(async (ctx) => { await ctx.db.patch(fixture.mandateId, { mode: "guided" }); }),
  },
  {
    name: "missing account-creation scope",
    mutate: async (t: ReturnType<typeof convexTest>, fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>) =>
      await t.run(async (ctx) => { await ctx.db.patch(fixture.mandateId, { allowedActionTypes: ["submit_webform"] }); }),
  },
  {
    name: "inactive personal mailbox",
    mutate: async (t: ReturnType<typeof convexTest>, fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>) =>
      await t.run(async (ctx) => {
        const mailbox = (await ctx.db.query("userMailboxes").collect()).find(
          (candidate) => candidate.ownerId === fixture.ownerId,
        );
        await ctx.db.patch(mailbox!._id, { status: "provisioning" });
      }),
  },
  {
    name: "inactive saved need",
    mutate: async (t: ReturnType<typeof convexTest>, fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>) =>
      await t.run(async (ctx) => { await ctx.db.patch(fixture.needId, { status: "paused" }); }),
  },
  {
    name: "platform outside mandate",
    mutate: async (t: ReturnType<typeof convexTest>, fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>) =>
      await t.run(async (ctx) => { await ctx.db.patch(fixture.mandateId, { platformIds: [] }); }),
  },
  {
    name: "account creation forbidden by policy",
    mutate: async (t: ReturnType<typeof convexTest>, fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>) =>
      await t.run(async (ctx) => { await ctx.db.patch(fixture.policyId, { accountCreationAllowed: false }); }),
  },
  {
    name: "unreviewed adapter",
    mutate: async (t: ReturnType<typeof convexTest>, fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>) =>
      await t.run(async (ctx) => { await ctx.db.patch(fixture.bindingId, { adapterKey: "unreviewed-v1" }); }),
  },
  {
    name: "connection already active",
    mutate: async (t: ReturnType<typeof convexTest>, _fixture: Awaited<ReturnType<typeof seedOrchestrationFixture>>, connectionId?: string) =>
      await t.run(async (ctx) => { await ctx.db.patch(connectionId as import("./_generated/dataModel").Id<"portalConnections">, { status: "active" }); }),
  },
])("does not auto-register with $name", async ({ mutate }) => {
  const t = convexTest(schema, modules);
  const fixture = await seedOrchestrationFixture(t);
  const connectionId = await makeControlledRegistrationEligible(t, fixture);
  await mutate(t, fixture, connectionId);
  expect(await t.mutation(internal.mandateOrchestrator.runForOwner, {
    ownerId: fixture.ownerId,
  })).toMatchObject({ scheduled: 0 });
  expect(await t.run(async (ctx) => ctx.db.query("browserRuns").collect())).toEqual([]);
});

it("does not send fictional demo outreach to a real Bandnet listing even with an old mandate", async () => {
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
  expect(first).toMatchObject({ created: 0, scheduled: 0 });
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
  expect(state.requests).toHaveLength(0);
  expect(state.approvals).toHaveLength(0);
});

it("queues one controlled opportunity into the shared Agent without pre-authorizing a message", async () => {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool");
  const f = await seedOrchestrationFixture(t);
  await t.run(async (ctx) => {
    await ctx.db.patch(f.platformId, { canonicalDomain: "roomscout.dev", slug: "roomscout-dev" });
    await ctx.db.patch(f.sourceId, { baseUrl: "https://roomscout.dev/listings" });
    await ctx.db.patch(f.entryId, { detailUrl: "https://roomscout.dev/listings/controlled" });
  });
  expect(await t.mutation(internal.mandateOrchestrator.runForOwner, { ownerId: f.ownerId })).toMatchObject({ created: 1, scheduled: 1 });
  expect(await t.mutation(internal.mandateOrchestrator.runForOwner, { ownerId: f.ownerId })).toMatchObject({ created: 0 });
  const state = await t.run(async (ctx) => ({
    turns: await ctx.db.query("providerTurns").collect(), actions: await ctx.db.query("actionRequests").collect(),
    approvals: await ctx.db.query("actionApprovals").collect(), opportunity: await ctx.db.get(f.opportunityId),
  }));
  expect(state.turns).toHaveLength(1);
  expect(state.turns[0]?.kind).toBe("opportunity");
  expect(state.opportunity?.status).toBe("reviewing");
  expect(state.actions).toEqual([]);
  expect(state.approvals).toEqual([]);
});

it("honors a current source exclusion even when the active mandate still contains the platform", async () => {
  const t = convexTest(schema, modules);
  agentTest.register(t); workpoolTest.register(t, "scoutWorkpool");
  const f = await seedOrchestrationFixture(t);
  await t.run(async (ctx) => {
    await ctx.db.patch(f.platformId, { canonicalDomain: "roomscout.dev", slug: "roomscout-dev" });
    await ctx.db.patch(f.sourceId, { baseUrl: "https://roomscout.dev/listings" });
    await ctx.db.patch(f.entryId, { detailUrl: "https://roomscout.dev/listings/controlled" });
    await ctx.db.insert("searchSourcePreferences", {
      ownerId: f.ownerId, savedNeedId: f.needId, platformId: f.platformId,
      preference: "exclude", createdAt: Date.now(), updatedAt: Date.now(),
    });
  });

  expect(await t.mutation(internal.mandateOrchestrator.runForOwner, { ownerId: f.ownerId }))
    .toMatchObject({ created: 0, scheduled: 0, skipped: 1 });
  expect(await t.run(async (ctx) => ctx.db.query("providerTurns").collect())).toEqual([]);
  expect(await t.run(async (ctx) => ctx.db.get(f.opportunityId))).toMatchObject({ status: "new" });
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

it("cannot execute an already prepared first contact after the search changes", async () => {
  const t = convexTest(schema, modules);
  const fixture = await seedOrchestrationFixture(t);
  const request = await t.run(async (ctx) => {
    const requestId = await ctx.db.insert("actionRequests", {
      ownerId: fixture.ownerId, savedNeedId: fixture.needId, matchingNeedRevision: 0,
      platformId: fixture.platformId, policyVersionId: fixture.policyId, adapterBindingId: fixture.bindingId,
      opportunityId: fixture.opportunityId, automationMode: "exact_once", requestedActionType: "submit_webform",
      personalDataScopes: [], payload: { kind: "contact_form", targetUrl: "https://bandnet.hamburg/anzeige/42", fields: [] },
      contentVersion: 1, contentHash: "old-request", status: "approved", createdAt: Date.now(), updatedAt: Date.now(),
    });
    await ctx.db.patch(fixture.needId, { matchingRevision: 1 });
    // Even if the same listing becomes a fresh match again, the old message
    // cannot inherit the new search's validity.
    const match = await ctx.db.query("signalMatches").withIndex("by_saved_need_and_signal", (q) => q.eq("savedNeedId", fixture.needId)).first();
    await ctx.db.patch(match!._id, { needRevision: 1 });
    return await ctx.db.get(requestId);
  });
  await expect(t.mutation(internal.externalActions.claimForExecutor, {
    ownerId: fixture.ownerId, requestId: request!._id, executor: "firecrawl",
  })).rejects.toThrow("ACTION_SEARCH_CHANGED");
  expect(await t.run(async (ctx) => ctx.db.query("actionExecutions").collect())).toEqual([]);
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
