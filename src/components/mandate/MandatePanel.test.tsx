import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ScoutMandate } from "../../features/agentOperations/types";
import { MandatePanel } from "./MandatePanel";

const mandate: ScoutMandate = {
  mode: "negotiation",
  version: 1,
  status: "active",
  goal: "Find a room",
  sourceAllowlist: [],
  platformAllowlist: ["platform-1"],
  allowedActionTypes: ["send_email"],
  dataScopes: ["reply_email"],
  dailyContactLimit: 10,
  dailyBrowserMinutes: 30,
  expiresAt: Date.now() + 86_400_000,
  killSwitchEnabled: true,
  stopConditions: [],
  persisted: true,
};

afterEach(cleanup);

describe("MandatePanel usage budget summary", () => {
  it("shows an audit-verified default mandate as uncapped", () => {
    render(<MandatePanel mandate={{ ...mandate, usesDefaultUnlimitedUsage: true }} />);

    expect(screen.getByText("No app usage cap")).toBeInTheDocument();
    expect(screen.queryByText(/10 contacts\/day/i)).not.toBeInTheDocument();
    expect(screen.getByText(/without an app usage cap/i)).toBeInTheDocument();
  });

  it("continues displaying an explicitly selected contact budget", () => {
    render(<MandatePanel mandate={{ ...mandate, dailyContactLimit: 42 }} />);

    expect(screen.getByText((_, element) =>
      element?.tagName === "SPAN" && element.textContent === "42 contacts/day",
    )).toBeInTheDocument();
    expect(screen.queryByText("No app usage cap")).not.toBeInTheDocument();
  });
});
