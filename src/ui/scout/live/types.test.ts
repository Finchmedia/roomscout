import { describe, expect, it } from "vitest";
import { deriveLiveScoutStage } from "./types";

describe("deriveLiveScoutStage", () => {
  it("prefers a current ready offer over stale provider uncertainty", () => {
    expect(deriveLiveScoutStage({ offerReady: true, providerUpdate: true, working: true })).toBe("offer");
  });

  it("keeps a partial reply in discovery", () => {
    expect(deriveLiveScoutStage({ hasPartialReply: true })).toBe("discovery");
  });

  it("keeps paused work distinct from active work", () => {
    expect(deriveLiveScoutStage({ paused: true, working: true })).toBe("paused");
  });

  it("defaults to welcome without live progress", () => {
    expect(deriveLiveScoutStage({})).toBe("welcome");
  });

  it("shows loading before a conversation exists", () => {
    expect(deriveLiveScoutStage({ loading: true })).toBe("loading");
  });
});
