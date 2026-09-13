import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { BrowserRun } from "../../features/agentOperations/types";
import { BrowserRunWorkspace } from "./BrowserRunWorkspace";

const completedRun: BrowserRun = {
  id: "run-1",
  sourceName: "Controlled portal",
  searchTitle: "Scout-assisted portal registration",
  mandateLabel: "Policy-reviewed portal run",
  state: "approval_required",
  steps: [{ id: "verify", label: "Verify authentication in a new profile session", state: "active" }],
};

describe("BrowserRunWorkspace Firecrawl recovery", () => {
  it("offers profile verification instead of presenting an unverified completed run as done", () => {
    const html = renderToStaticMarkup(<BrowserRunWorkspace browserProvider="firecrawl" onRetry={vi.fn()} recoveryRequired run={completedRun} />);
    expect(html).toContain("Verify saved profile");
    expect(html).toContain("approval required");
    expect(html).toContain("rs-run-step--active");
  });

  it("explains why a terminal Firecrawl run has no Live View", () => {
    const html = renderToStaticMarkup(<BrowserRunWorkspace browserProvider="firecrawl" recoveryRequired run={completedRun} />);
    expect(html).toContain("Firecrawl session closed");
    expect(html).toContain("available only while its interactive browser session is active");
    expect(html).not.toContain("Live View not connected");
  });
});
