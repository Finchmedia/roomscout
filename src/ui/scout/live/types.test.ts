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

  it("lets an open Entscheidung interrupt routine work but not a ready offer", () => {
    expect(deriveLiveScoutStage({ blocked: true, providerUpdate: true, working: true })).toBe("blocked");
    expect(deriveLiveScoutStage({ blocked: true, offerReady: true })).toBe("offer");
    expect(deriveLiveScoutStage({ blocked: true, hasConversation: true })).toBe("blocked");
  });

  it("lets the rail's exclusion verdict replace the provider-update scene, but not a ready offer", () => {
    expect(deriveLiveScoutStage({ providerExcluded: true, providerUpdate: true, working: true })).toBe("provider-excluded");
    expect(deriveLiveScoutStage({ providerExcluded: true, offerReady: true })).toBe("offer");
    expect(deriveLiveScoutStage({ providerExcluded: true, blocked: true })).toBe("blocked");
  });

  it("defaults to welcome without live progress", () => {
    expect(deriveLiveScoutStage({})).toBe("welcome");
  });

  it("shows loading before a conversation exists", () => {
    expect(deriveLiveScoutStage({ loading: true })).toBe("loading");
  });
});
