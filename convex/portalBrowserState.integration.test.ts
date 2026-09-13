/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { afterEach, vi } from "vitest";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

async function fixture(provider?: "firecrawl" | "browserbase") {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = Date.now();
    const ownerId = await ctx.db.insert("users", { username: "state-owner", role: "musician", createdAt: now, lastSeenAt: now });
    const sourceId = await ctx.db.insert("sources", {
      slug: "state-source", name: "State source", baseUrl: "https://roomscout.dev", side: "both",
      status: "active", health: "healthy", accessMode: "authenticated", automationReview: "approved",
      createdAt: now, updatedAt: now,
    });
    const connectionId = await ctx.db.insert("portalConnections", {
      ownerId, sourceId, label: "State", allowedDomains: ["roomscout.dev"], allowedPaths: ["/"],
      browserProvider: provider, adapterKey: "roomscout-dev-v1", status: "needs_auth", policyDecision: "allowed", allowReadOnlyRecon: true,
      allowInboxPolling: true, pollIntervalMinutes: 30, failureCount: 0, createdAt: now, updatedAt: now,
    });
    return { ownerId, connectionId };
  });
  return { t, ...ids };
}

it("pins an unbound connection and expires its own stale run even behind unrelated global rows", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture();
  await t.run(async (ctx) => {
    const now = Date.now();
    for (let index = 0; index < 12; index += 1) {
      await ctx.db.insert("browserRuns", {
        connectionId, ownerId, browserProvider: "firecrawl", kind: "recon", status: "completed",
        expiresAt: now - 1, endedAt: now - 1, createdAt: now - 100, updatedAt: now - 1,
      });
    }
    await ctx.db.insert("browserRuns", {
      connectionId, ownerId, browserProvider: "firecrawl", kind: "authenticate", status: "queued",
      expiresAt: now - 1, createdAt: now - 100, updatedAt: now - 100,
    });
  });
  const runId = await t.mutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl",
  });
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ browserProvider: "firecrawl" });
  expect(await t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ browserProvider: "firecrawl" });
});

it("projects the latest persisted authentication phase without exposing provider session state", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("browserRuns", {
      connectionId, ownerId, browserProvider: "firecrawl", kind: "authenticate", status: "running",
      onboardingStage: "waiting_verification", providerSessionId: "private-scrape-id",
      expiresAt: now + 60_000, createdAt: now, updatedAt: now,
    });
  });
  const [connection] = await t.withIdentity({ subject: ownerId }).query(api.portalConnections.listMine, {});
  expect(connection.latestAuthenticationRun).toMatchObject({
    status: "running", onboardingStage: "waiting_verification", browserProvider: "firecrawl",
  });
  expect(connection.latestAuthenticationRun).not.toHaveProperty("providerSessionId");
});

it("never overwrites a Browserbase context with Firecrawl state", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("browserbase");
  await t.run(async (ctx) => {
    const now = Date.now();
    await ctx.db.insert("browserContexts", {
      connectionId, ownerId, providerContextId: "bb-context", status: "ready", createdAt: now, updatedAt: now,
    });
  });
  await expect(t.mutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl",
  })).rejects.toThrow("PORTAL_BROWSER_PROVIDER_RECONNECT_REQUIRED");
  expect(await t.run(async (ctx) => (await ctx.db.query("browserContexts").collect())[0].providerContextId)).toBe("bb-context");
});

it("requires a successful new-session Firecrawl probe before finishRun activates the connection", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const runId = await t.mutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl",
  });
  const attached = await t.mutation(internal.portalConnections.attachProviderRun, {
    ownerId, runId, providerSessionId: "session", providerContextId: "profile", browserProvider: "firecrawl",
    browserEngine: "firecrawl", humanRequired: false,
  });
  await t.mutation(internal.portalConnections.finishRun, { runId, status: "completed", contextReady: true });
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "failed", errorCode: "CONTEXT_PROFILE_NOT_READY" });
  const unprovedContext = await t.run((ctx) => ctx.db.get(attached.contextId!));
  expect(unprovedContext).toMatchObject({ status: "reauth_required" });
  expect(unprovedContext).not.toHaveProperty("lastVerifiedAt");
  expect(await t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ status: "reauth_required", lastErrorCode: "CONTEXT_PROFILE_NOT_READY" });

  const secondRunId = await t.mutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl",
  });
  await t.mutation(internal.portalConnections.attachProviderRun, {
    ownerId, runId: secondRunId, providerSessionId: "new-session", providerContextId: "profile",
    browserProvider: "firecrawl", browserEngine: "firecrawl", humanRequired: false,
  });
  await t.mutation(internal.portalConnections.recordContextProbeResult, {
    ownerId, connectionId, contextId: attached.contextId!, runId: secondRunId,
    browserProvider: "firecrawl", success: true, attempt: 1,
  });
  await t.mutation(internal.portalConnections.finishRun, { runId: secondRunId, status: "completed", contextReady: true });
  expect(await t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ status: "active" });
});

it("does not apply the missing-auth-proof failure rule to Firecrawl recon runs", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const { contextId, runId } = await t.run(async (ctx) => {
    const now = Date.now();
    const contextId = await ctx.db.insert("browserContexts", { connectionId, ownerId, providerContextId: "ready-profile", browserProvider: "firecrawl", status: "ready", lastVerifiedAt: now - 10_000, createdAt: now - 20_000, updatedAt: now });
    const runId = await ctx.db.insert("browserRuns", { connectionId, ownerId, contextId, browserProvider: "firecrawl", browserEngine: "firecrawl", kind: "recon", status: "running", startedAt: now, expiresAt: now + 60_000, createdAt: now, updatedAt: now });
    await ctx.db.patch(contextId, { activeRunId: runId });
    return { contextId, runId };
  });
  await t.mutation(internal.portalConnections.finishRun, { runId, status: "completed", resultCount: 2 });
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({ status: "completed", resultCount: 2 });
  const context = await t.run((ctx) => ctx.db.get(contextId));
  expect(context).toMatchObject({ status: "ready" });
  expect(context).not.toHaveProperty("activeRunId");
});

it("rejects stale-provider business continuations while allowing recorded-provider cleanup", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const runId = await t.mutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl",
  });
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
  await expect(t.query(internal.portalConnections.validateRunProvider, {
    ownerId, runId, browserProvider: "firecrawl",
  })).resolves.toBe(false);
  await expect(t.query(internal.portalConnections.validateRunProvider, {
    ownerId, runId, browserProvider: "firecrawl", requireSelectedProvider: false,
  })).resolves.toBe(true);
});

it("terminalizes a pre-reserved run when provider preflight fails", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const runId = await t.mutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl",
  });
  await t.mutation(internal.portalConnections.failReservedRun, {
    runId, errorCode: "FIRECRAWL_NOT_CONFIGURED",
  });
  expect(await t.run((ctx) => ctx.db.get(runId))).toMatchObject({
    status: "failed", errorCode: "FIRECRAWL_NOT_CONFIGURED",
  });
});

it("exposes profile readiness without exposing a resumable Firecrawl scrape id", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const runId = await t.mutation(internal.portalConnections.reserveRun, {
    ownerId, connectionId, kind: "authenticate", browserProvider: "firecrawl",
  });
  await t.mutation(internal.portalConnections.attachProviderRun, {
    ownerId, runId, providerSessionId: "private-scrape-id", providerContextId: "profile",
    browserProvider: "firecrawl", browserEngine: "firecrawl", humanRequired: true,
  });
  const owner = t.withIdentity({ subject: ownerId });
  const [connection, run] = await Promise.all([
    owner.query(api.portalConnections.getMine, { connectionId }),
    owner.query(api.portalConnections.getRunMine, { runId }),
  ]);
  expect(connection).toMatchObject({
    browserProvider: "firecrawl", contextStatus: "creating", providerMismatch: false,
  });
  expect(run).toMatchObject({ browserProvider: "firecrawl", canResume: false });
  expect(run).not.toHaveProperty("providerSessionId");
});

it("recovers only the same Firecrawl profile with an exact recovery generation", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const contextId = await t.run(async (ctx) => ctx.db.insert("browserContexts", {
    connectionId, ownerId, providerContextId: "stable-profile", browserProvider: "firecrawl",
    status: "failed", createdAt: Date.now(), updatedAt: Date.now(),
  }));
  const recovery = await t.mutation(internal.portalConnections.prepareProfileRecovery, { ownerId, connectionId, browserProvider: "firecrawl" });
  expect(recovery).toMatchObject({ contextId, profileName: "stable-profile", generation: 1, adapterKey: "roomscout-dev-v1" });
  await expect(t.mutation(internal.portalConnections.recordProfileRecoveryProbe, {
    ownerId, connectionId, contextId, browserProvider: "firecrawl", generation: 2, outcome: "ready",
  })).rejects.toThrow("PORTAL_PROFILE_RECOVERY_STALE");
  await t.mutation(internal.portalConnections.recordProfileRecoveryProbe, {
    ownerId, connectionId, contextId, browserProvider: "firecrawl", generation: 1, outcome: "ready",
  });
  expect(await t.run((ctx) => ctx.db.get(contextId))).toMatchObject({ status: "ready", recoveryGeneration: 1 });
  expect(await t.run((ctx) => ctx.db.get(connectionId))).toMatchObject({ status: "active" });
});

it("carries OTP metadata from the latest authenticate run past a newer recon", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const carried = await t.run(async (ctx) => {
    const now = Date.now();
    const mailboxId = await ctx.db.insert("userMailboxes", { ownerId, provider: "agentmail", clientId: "otp-recovery", status: "active", createdAt: now, updatedAt: now });
    const contextId = await ctx.db.insert("browserContexts", { connectionId, ownerId, providerContextId: "otp-profile", browserProvider: "firecrawl", status: "failed", createdAt: now, updatedAt: now });
    await ctx.db.insert("browserRuns", { connectionId, ownerId, contextId, browserProvider: "firecrawl", browserEngine: "firecrawl", kind: "authenticate", status: "failed", expiresAt: now - 1, onboardingMailboxId: mailboxId, verificationRequestedAt: now - 5_000, createdAt: now - 10_000, updatedAt: now - 5_000 });
    await ctx.db.insert("browserRuns", { connectionId, ownerId, contextId, browserProvider: "firecrawl", browserEngine: "firecrawl", kind: "recon", status: "failed", expiresAt: now - 1, createdAt: now - 1_000, updatedAt: now - 500 });
    return { mailboxId, requestedAt: now - 5_000 };
  });
  const recovery = await t.mutation(internal.portalConnections.prepareProfileRecovery, { ownerId, connectionId, browserProvider: "firecrawl" });
  expect(recovery).toMatchObject({ latestVerificationMailboxId: carried.mailboxId, latestVerificationRequestedAt: carried.requestedAt });
});

it("expires Browserbase human resume by inactivity without shrinking total TTL or losing cleanup identity", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-11T10:00:00Z"));
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
  const { t, ownerId, connectionId } = await fixture("browserbase");
  const runId = await t.mutation(internal.portalConnections.reserveRun, { ownerId, connectionId, kind: "authenticate", browserProvider: "browserbase" });
  await t.mutation(internal.portalConnections.attachProviderRun, { ownerId, runId, providerSessionId: "bb-human-session", providerContextId: "bb-context", browserProvider: "browserbase", humanRequired: true });
  const before = await t.query(internal.portalConnections.getRunForOwner, { ownerId, runId });
  expect(before?.inactivityDeadlineAt).toBeLessThan(before!.expiresAt);
  vi.advanceTimersByTime(5 * 60_000 + 1);
  const owner = t.withIdentity({ subject: ownerId });
  expect(await owner.query(api.portalConnections.getRunMine, { runId })).toMatchObject({ canResume: false });
  await expect(t.mutation(internal.portalConnections.touchBrowserbaseHumanRun, { ownerId, runId, providerSessionId: "bb-human-session" })).resolves.toBeNull();
  await t.mutation(internal.portalConnections.finishRun, { runId, status: "stopped" });
  await expect(t.query(internal.portalConnections.validateProviderCleanup, { ownerId, runId, provider: "browserbase", providerSessionId: "bb-human-session" })).resolves.toBe(true);
});

it("authorizes non-run cleanup only through an exact durable provider session lease", async () => {
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "firecrawl");
  const { t, ownerId, connectionId } = await fixture("firecrawl");
  const contextId = await t.run(async (ctx) => ctx.db.insert("browserContexts", {
    connectionId, ownerId, providerContextId: "cleanup-profile", browserProvider: "firecrawl",
    status: "creating", createdAt: Date.now(), updatedAt: Date.now(),
  }));
  const deadlineAt = Date.now() + 60_000;
  const lease = await t.mutation(internal.portalConnections.registerProviderCleanupLease, {
    ownerId, connectionId, contextId, provider: "firecrawl", providerSessionId: "proof-scrape",
    purpose: "profile_proof", deadlineAt,
  });
  const laterLease = await t.mutation(internal.portalConnections.registerProviderCleanupLease, {
    ownerId, connectionId, contextId, provider: "firecrawl", providerSessionId: "later-proof-scrape",
    purpose: "profile_proof", deadlineAt,
  });
  expect(laterLease.generation).toBeGreaterThan(lease.generation);
  vi.stubEnv("PORTAL_BROWSER_ENGINE", "browserbase");
  await expect(t.query(internal.portalConnections.validateCleanupLease, {
    cleanupId: lease.cleanupId, provider: "firecrawl", providerSessionId: "proof-scrape", deadlineAt,
  })).resolves.toBe(true);
  await expect(t.query(internal.portalConnections.validateCleanupLease, {
    cleanupId: lease.cleanupId, provider: "browserbase", providerSessionId: "proof-scrape", deadlineAt,
  })).resolves.toBe(false);
  await expect(t.query(internal.portalConnections.validateCleanupLease, {
    cleanupId: lease.cleanupId, provider: "firecrawl", providerSessionId: "other-session", deadlineAt,
  })).resolves.toBe(false);
  await t.mutation(internal.portalConnections.finishCleanupLease, {
    cleanupId: lease.cleanupId, provider: "firecrawl", providerSessionId: "proof-scrape", outcome: "completed",
  });
  await expect(t.query(internal.portalConnections.validateCleanupLease, {
    cleanupId: lease.cleanupId, provider: "firecrawl", providerSessionId: "proof-scrape", deadlineAt,
  })).resolves.toBe(false);
});
