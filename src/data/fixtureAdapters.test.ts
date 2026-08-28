import { describe, expect, it } from "vitest";
import { createFixtureOutreachPort, createFixtureSignalsPort } from "./fixtureAdapters";
import type { OutreachDraft, SignalSummary } from "./ports";

const signal: SignalSummary = {
  id: "signal-1",
  side: "supply",
  title: "Shared room",
  city: "Stuttgart",
  arrangement: "shared",
  priceLabel: "€220/month",
  summary: "A fixture-backed offer.",
  sourceName: "Example source",
  sourceUrl: "https://example.com/signal-1",
  firstSeenLabel: "today",
  lastSeenLabel: "today",
  freshness: "fresh",
  verification: "observed",
  requirements: [],
  unknowns: [],
};

describe("fixture adapters", () => {
  it("filters market signals through the same port used by live data", async () => {
    const port = createFixtureSignalsPort([
      signal,
      { ...signal, id: "signal-2", side: "demand", city: "Berlin" },
    ]);

    await expect(port.list({ city: "Stuttgart", side: "supply" })).resolves.toEqual([
      signal,
    ]);
  });

  it("refuses approval when the visible draft version is stale", async () => {
    const draft: OutreachDraft = {
      id: "draft-1",
      signalId: signal.id,
      searchId: "search-1",
      recipientName: "Example room",
      recipientEmail: "owner@example.com",
      recipientSource: "public listing",
      subject: "Room availability",
      body: "Is the room still available?",
      contentVersion: 1,
      status: "awaiting_approval",
    };
    const port = createFixtureOutreachPort(draft);
    await port.revise(draft);

    await expect(port.approve(draft.id, 1)).rejects.toThrow(
      "This draft changed",
    );
  });
});
