import { describe, expect, it, vi } from "vitest";
import { runProviderCleanupAttempt } from "./portalBrowserCleanup";

const input = {
  ownerId: "owner" as never, runId: "run" as never, provider: "firecrawl" as const,
  providerSessionId: "session", attempt: 1, deadlineAt: 10_000,
};

describe("provider cleanup retry", () => {
  it("stops only the recorded provider session", async () => {
    const stop = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    await expect(runProviderCleanupAttempt(input, { now: () => 1_000, stop, schedule })).resolves.toBe("stopped");
    expect(stop).toHaveBeenCalledWith("firecrawl", "session", 9_000);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("schedules a bounded retry with only cleanup identifiers", async () => {
    const schedule = vi.fn(async () => undefined);
    await expect(runProviderCleanupAttempt(input, {
      now: () => 1_000, stop: vi.fn(async () => { throw new Error("unavailable"); }), schedule,
    })).resolves.toBe("retry_scheduled");
    expect(schedule).toHaveBeenCalledWith(2_000, { ...input, attempt: 2 });
  });

  it("does not retry after its attempt or deadline bound", async () => {
    const schedule = vi.fn(async () => undefined);
    const stop = vi.fn(async () => { throw new Error("unavailable"); });
    await expect(runProviderCleanupAttempt({ ...input, attempt: 5 }, { now: () => 1_000, stop, schedule })).resolves.toBe("exhausted");
    await expect(runProviderCleanupAttempt(input, { now: () => 10_000, stop, schedule })).resolves.toBe("exhausted");
    expect(schedule).not.toHaveBeenCalled();
  });
});
