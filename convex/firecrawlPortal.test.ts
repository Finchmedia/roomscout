import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  verify: vi.fn(),
  register: vi.fn(),
  send: vi.fn(),
}));

vi.mock("./components/firecrawlRoomScout/client", () => ({
  FirecrawlRoomScoutClient: class {},
}));
vi.mock("./integrations/firecrawlPortalRuntime", () => ({
  firecrawlComponentPortalTransport: vi.fn(() => ({})),
  createFirecrawlPortalSession: mocks.createSession,
}));
vi.mock("./integrations/stagehandPortalDriver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./integrations/stagehandPortalDriver")>()),
  verifyControlledPortalContext: mocks.verify,
  ensureControlledPortalRegistration: mocks.register,
  sendControlledPortalMessage: mocks.send,
}));

import { inspectFirecrawlProfileForRecovery, proveFirecrawlProfile, runFirecrawlRegistrationStep } from "./firecrawlPortal";

function session(id: string) {
  return {
    scrapeId: id,
    profileName: "profile_1",
    openedAt: 1,
    primitives: {},
    stop: vi.fn(async () => undefined),
    liveView: vi.fn(),
    runProgram: vi.fn(),
  };
}

describe("Firecrawl portal orchestration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("closes an OTP session instead of exposing a fake resume", async () => {
    const opened = session("scrape_otp");
    mocks.createSession.mockResolvedValue(opened);
    mocks.register.mockResolvedValue({ outcome: "authenticated" });
    await expect(runFirecrawlRegistrationStep({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", verificationCode: "123456",
    })).resolves.toEqual({ outcome: "authenticated" });
    expect(opened.stop).toHaveBeenCalledOnce();
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ profileName: "profile_1", saveChanges: true }));
  });

  it("does not begin profile proof when registration session stop fails", async () => {
    const opened = session("scrape_otp");
    opened.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(opened);
    mocks.register.mockResolvedValue({ outcome: "authenticated" });
    await expect(runFirecrawlRegistrationStep({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", verificationCode: "123456",
    })).rejects.toThrow("stop failed");
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("proves persistence only in a new read-only session", async () => {
    const probe = session("scrape_probe");
    mocks.createSession.mockResolvedValue(probe);
    mocks.verify.mockResolvedValue(true);
    await expect(proveFirecrawlProfile({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1",
      profileName: "profile_1", now: () => 10,
    })).resolves.toEqual({ verified: true, attempts: 1 });
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ saveChanges: false }));
    expect(probe.stop).toHaveBeenCalledOnce();
  });

  it("inspects the same profile read-only without starting registration", async () => {
    const probe = session("scrape_recovery");
    probe.primitives = { extract: vi.fn(async () => ({ authenticated: false, stage: "verification", blocker: null })) };
    mocks.createSession.mockResolvedValue(probe);
    await expect(inspectFirecrawlProfileForRecovery({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
    })).resolves.toEqual({ outcome: "awaiting_verification" });
    expect(mocks.register).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledWith(expect.objectContaining({ profileName: "profile_1", saveChanges: false }));
    expect(probe.stop).toHaveBeenCalledOnce();
  });

  it("does not report profile recovery when the read-only session cannot be saved", async () => {
    const probe = session("scrape_recovery");
    probe.primitives = { extract: vi.fn(async () => ({ authenticated: true, stage: "authenticated", blocker: null })) };
    probe.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(probe);
    await expect(inspectFirecrawlProfileForRecovery({} as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
    })).rejects.toThrow("stop failed");
  });

  it("durably schedules the exact proof scrape when teardown fails", async () => {
    const probe = session("scrape_proof_cleanup");
    probe.stop.mockRejectedValue(new Error("stop failed"));
    mocks.createSession.mockResolvedValue(probe);
    mocks.verify.mockResolvedValue(true);
    const runMutation = vi.fn(async () => ({ cleanupId: "cleanup_1", generation: 1 }));
    const runAfter = vi.fn(async () => undefined);
    let clockReads = 0;
    await expect(proveFirecrawlProfile({ runMutation, scheduler: { runAfter } } as never, {
      baseUrl: "https://roomscout.dev", adapterKey: "roomscout-dev-v1", profileName: "profile_1",
      deadlineAt: 50_000, now: () => clockReads++ === 0 ? 0 : 50_000,
      cleanup: { ownerId: "owner" as never, connectionId: "connection" as never, contextId: "context" as never, purpose: "profile_proof" },
    })).resolves.toMatchObject({ verified: false, attempts: 1 });
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      providerSessionId: "scrape_proof_cleanup", provider: "firecrawl", purpose: "profile_proof",
    }));
    expect(runAfter).toHaveBeenCalledWith(0, expect.anything(), expect.objectContaining({
      cleanupId: "cleanup_1", providerSessionId: "scrape_proof_cleanup",
    }));
  });
});
