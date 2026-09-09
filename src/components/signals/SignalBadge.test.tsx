import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { MarketSignal } from "../../mocks/demoData";
import { SignalBadge } from "./SignalBadge";

afterEach(cleanup);

function signal(isDemo?: boolean): MarketSignal {
  return {
    id: "signal-1",
    isDemo,
    side: "supply",
    verification: "observed",
    freshness: "fresh",
    freshnessLabel: "Checked just now",
    title: "Room",
    location: "Stuttgart",
    source: "Source",
    firstSeen: "First seen today",
    facts: [],
    summary: "A room signal.",
  };
}

describe("SignalBadge", () => {
  it("clearly labels only an explicitly controlled demo signal", () => {
    render(<SignalBadge signal={signal(true)} />);

    expect(screen.getByText("Controlled demo")).toBeInTheDocument();
    expect(screen.getByText("Supply · Observed")).toBeInTheDocument();
  });

  it.each([undefined, false])("does not label legacy or real signals (%s)", (isDemo) => {
    render(<SignalBadge signal={signal(isDemo)} />);

    expect(screen.queryByText("Controlled demo")).not.toBeInTheDocument();
  });
});
