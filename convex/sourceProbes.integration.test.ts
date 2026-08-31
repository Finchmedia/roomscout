/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function sourceProbeFixture() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const now = Date.now();
    const operatorId = await ctx.db.insert("users", {
      username: "operator",
      role: "operator",
      createdAt: now,
      lastSeenAt: now,
    });
    const platformId = await ctx.db.insert("sourcePlatforms", {
      slug: "bandnet",
      name: "Bandnet",
      canonicalDomain: "bandnet.hamburg",
      kind: "community",
      status: "reviewing",
      firstSeenAt: now,
      lastObservedAt: now - 1_000,
      createdAt: now,
      updatedAt: now,
    });
    const geoAreaId = await ctx.db.insert("geoAreas", {
      key: "de:hamburg",
      name: "Hamburg",
      normalizedName: "hamburg",
      countryCode: "DE",
      type: "city",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    const sourceId = await ctx.db.insert("sources", {
      platformId,
      slug: "bandnet-supply",
      name: "Bandnet supply",
      baseUrl: "https://bandnet.hamburg",
      side: "supply",
      status: "paused",
      health: "unknown",
      accessMode: "public",
      automationReview: "approved",
      adapterKey: "generic-list-v1",
      createdAt: now,
      updatedAt: now,
    });
    const sourceTargetId = await ctx.db.insert("sourceTargets", {
      sourceId,
      geoAreaId,
      url: "https://bandnet.hamburg/anzeige/kategorie/19/proberaum-frei",
      mode: "scrape",
      changeTrackingTag: "bandnet:supply:v1",
      scheduleMinutes: 1_440,
      nextRunAt: now,
      paused: true,
      createdAt: now,
      updatedAt: now,
    });
    const policyId = await ctx.db.insert("sourceFlowPolicies", {
      platformId,
      sourceId,
      scopeKey: `source:${sourceId}`,
      flow: "listing",
      version: 1,
      status: "approved",
      decision: "allowed",
      maxAutomationLevel: "public_read",
      userConnectionRequired: false,
      humanPresenceRequired: false,
      accountCreationAllowed: false,
      externalApprovalRequired: false,
      robotsDecision: "allowed",
      termsDecision: "allowed",
      evidenceUrls: ["https://bandnet.hamburg/nutzungsbedingungen"],
      createdAt: now,
      updatedAt: now,
    });
    const bindingId = await ctx.db.insert("sourceAdapterBindings", {
      platformId,
      sourceId,
      sourceTargetId,
      scopeKey: `target:${sourceTargetId}`,
      flow: "listing",
      adapterKey: "generic-list-v1",
      adapterVersion: 1,
      status: "active",
      executor: "firecrawl",
      config: {
        kind: "firecrawl",
        extractionProfileKey: "generic-list-v1",
        monitorDriven: false,
      },
      configFingerprint: "probe-binding-v1",
      policyVersionId: policyId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(sourceTargetId, { adapterBindingId: bindingId });
    const probeId = await ctx.db.insert("sourceFlowProbes", {
      platformId,
      bindingId,
      geoAreaId,
      flow: "listing",
      name: "Bandnet public listing probe",
      status: "approved",
      safetyLevel: "read_only",
      policyVersionId: policyId,
      maxItems: 5,
      timeoutMs: 30_000,
      createdBy: operatorId,
      approvedBy: operatorId,
      createdAt: now,
      updatedAt: now,
    });
    return {
      operatorId,
      platformId,
      sourceId,
      sourceTargetId,
      geoAreaId,
      policyId,
      bindingId,
      probeId,
    };
  });
  return { t, fixture, operator: t.withIdentity({ subject: fixture.operatorId }) };
}

it("queues and claims an allowlisted source probe idempotently", async () => {
  const { t, fixture, operator } = await sourceProbeFixture();
  const first = await operator.mutation(api.sourceProbes.requestReadOnlyRun, {
    probeId: fixture.probeId,
    trigger: "operator",
    idempotencyKey: "bandnet-listing-check-1",
  });
  const duplicate = await operator.mutation(api.sourceProbes.requestReadOnlyRun, {
    probeId: fixture.probeId,
    trigger: "operator",
    idempotencyKey: "bandnet-listing-check-1",
  });
  expect(first.duplicate).toBe(false);
  expect(duplicate).toEqual({ runId: first.runId, duplicate: true });

  const claim = await t.mutation(internal.sourceProbes.claimReadOnlyRun, {
    runId: first.runId,
  });
  expect(claim).toMatchObject({
    runId: first.runId,
    executor: "firecrawl",
    adapterKey: "generic-list-v1",
    canonicalDomain: "bandnet.hamburg",
    targetUrl: "https://bandnet.hamburg/anzeige/kategorie/19/proberaum-frei",
    allowedDomains: ["bandnet.hamburg"],
    allowedPaths: ["/anzeige/kategorie/19/proberaum-frei"],
    safetyLevel: "read_only",
  });
  expect(
    await t.mutation(internal.sourceProbes.claimReadOnlyRun, {
      runId: first.runId,
    }),
  ).toBeNull();
});

it("persists normalized probe evidence, policy facts, and probed coverage", async () => {
  const { t, fixture, operator } = await sourceProbeFixture();
  const queued = await operator.mutation(api.sourceProbes.requestReadOnlyRun, {
    probeId: fixture.probeId,
    trigger: "operator",
    idempotencyKey: "bandnet-listing-check-2",
  });
  await t.mutation(internal.sourceProbes.claimReadOnlyRun, {
    runId: queued.runId,
  });
  await t.mutation(internal.sourceProbes.recordSucceededRun, {
    runId: queued.runId,
    summary:
      "Inspected listing surface and observed 12 same-domain links, bounded to 5 probe items.",
    evidenceHash: "a".repeat(64),
    resultCode: "READ_ONLY_PROBE_SUCCEEDED",
    itemsObserved: 5,
    facts: [
      {
        category: "access",
        key: "probe.listing.reachable",
        value: { kind: "boolean", value: true },
        confidence: 0.9,
      },
      {
        category: "flow",
        key: "probe.listing.same_domain_links",
        value: { kind: "number", value: 12 },
        confidence: 0.85,
      },
    ],
  });

  const state = await t.run(async (ctx) => {
    const run = await ctx.db.get(queued.runId);
    const steps = await ctx.db
      .query("sourceFlowProbeSteps")
      .withIndex("by_run_and_ordinal", (q) => q.eq("runId", queued.runId))
      .take(10);
    const facts = await ctx.db
      .query("sourceIntelligenceFacts")
      .withIndex("by_platform_and_category_and_status", (q) =>
        q
          .eq("platformId", fixture.platformId)
          .eq("category", "flow")
          .eq("status", "active"),
      )
      .take(10);
    const coverage = await ctx.db
      .query("sourceCoverage")
      .withIndex("by_platform_and_geo_area_and_side", (q) =>
        q
          .eq("platformId", fixture.platformId)
          .eq("geoAreaId", fixture.geoAreaId)
          .eq("side", "supply"),
      )
      .unique();
    return { run, steps, facts, coverage };
  });
  expect(state.run).toMatchObject({
    status: "succeeded",
    itemsObserved: 5,
    outputHash: "a".repeat(64),
  });
  expect(state.steps.map((step) => step.ordinal)).toEqual([0, 1, 2]);
  expect(state.steps[2]?.evidenceHash).toBe("a".repeat(64));
  expect(state.facts).toContainEqual(
    expect.objectContaining({
      key: "probe.listing.same_domain_links",
      probeRunId: queued.runId,
    }),
  );
  expect(state.coverage).toMatchObject({
    status: "probed",
    lastProbeRunId: queued.runId,
  });
  expect(state.coverage?.listingCount).toBeUndefined();
});

it("blocks a queued probe when its reviewed policy is no longer effective", async () => {
  const { t, fixture, operator } = await sourceProbeFixture();
  const queued = await operator.mutation(api.sourceProbes.requestReadOnlyRun, {
    probeId: fixture.probeId,
    trigger: "operator",
    idempotencyKey: "bandnet-listing-check-3",
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(fixture.policyId, {
      status: "restricted",
      updatedAt: Date.now(),
    });
  });
  expect(
    await t.mutation(internal.sourceProbes.claimReadOnlyRun, {
      runId: queued.runId,
    }),
  ).toBeNull();
  expect(await t.run((ctx) => ctx.db.get(queued.runId))).toMatchObject({
    status: "blocked",
    resultCode: "policy_not_readable",
  });
});

it("creates one idempotent retry run for a terminal probe failure", async () => {
  const { t, fixture, operator } = await sourceProbeFixture();
  const queued = await operator.mutation(api.sourceProbes.requestReadOnlyRun, {
    probeId: fixture.probeId,
    trigger: "operator",
    idempotencyKey: "bandnet-listing-check-4",
  });
  await t.mutation(internal.sourceProbes.completeRun, {
    runId: queued.runId,
    status: "failed",
    resultCode: "PROVIDER_TIMEOUT",
    itemsObserved: 0,
    error: "PROVIDER_TIMEOUT",
  });
  const first = await operator.mutation(api.sourceProbes.retryRun, {
    runId: queued.runId,
  });
  const duplicate = await operator.mutation(api.sourceProbes.retryRun, {
    runId: queued.runId,
  });
  expect(first.duplicate).toBe(false);
  expect(duplicate).toEqual({ runId: first.runId, duplicate: true });
  expect(await operator.query(api.sourceProbes.getRun, { runId: first.runId }))
    .toMatchObject({ run: { status: "queued", trigger: "operator" }, steps: [] });
});
