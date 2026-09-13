import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserRunPage } from "./BrowserRunPage";

const recoverProfile = vi.fn(async () => ({ status: "completed" as const }));
const startAuthentication = vi.fn(async () => ({ runId: "new-auth-run" }));
const startAgentRegistration = vi.fn(async () => ({ runId: "new-registration-run" }));
let connectionStatus: "needs_auth" | "active" = "needs_auth";
let contextStatus: "creating" | "ready" = "creating";

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    portalConnections: { getRunMine: "portalConnections.getRunMine", getMine: "portalConnections.getMine" },
    mailboxes: { getMine: "mailboxes.getMine", ensureMine: "mailboxes.ensureMine" },
    browserbasePortal: {
      getLiveView: "browserbasePortal.getLiveView",
      resumeAuthentication: "browserbasePortal.resumeAuthentication",
      stopRun: "browserbasePortal.stopRun",
      startAuthentication: "browserbasePortal.startAuthentication",
      startAgentRegistration: "browserbasePortal.startAgentRegistration",
    },
    firecrawlPortal: { recoverProfile: "firecrawlPortal.recoverProfile" },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (query: string) => {
    if (query === "portalConnections.getRunMine") return {
      _id: "run-completed", connectionId: "connection-1", kind: "authenticate",
      status: "completed", browserProvider: "firecrawl", canResume: false,
    };
    if (query === "portalConnections.getMine") return {
      _id: "connection-1", sourceName: "Controlled portal", baseUrl: "https://roomscout.dev",
      status: connectionStatus, contextStatus, browserProvider: "firecrawl",
      providerMismatch: false, providerConfigurationError: undefined,
    };
    if (query === "mailboxes.getMine") return null;
    return null;
  },
  useAction: (action: string) => {
    if (action === "firecrawlPortal.recoverProfile") return recoverProfile;
    if (action === "browserbasePortal.startAuthentication") return startAuthentication;
    if (action === "browserbasePortal.startAgentRegistration") return startAgentRegistration;
    return vi.fn(async () => undefined);
  },
}));

vi.mock("../../components/navigation/WorkspaceShell", () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/app/runs/run-completed"]}>
      <Routes>
        <Route path="/app/runs/:runId" element={<BrowserRunPage />} />
        <Route path="/app/settings/sources" element={<p>Sources settings reached</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BrowserRunPage Firecrawl completion recovery", () => {
  beforeEach(() => {
    connectionStatus = "needs_auth";
    contextStatus = "creating";
    recoverProfile.mockClear();
    startAuthentication.mockClear();
    startAgentRegistration.mockClear();
  });
  afterEach(cleanup);

  it("recovers a completed but unverified profile without starting signup and navigates to sources", async () => {
    renderPage();
    expect(screen.getByText("Verify persistent Firecrawl profile").closest("li")).toHaveClass("rs-run-step--active");
    fireEvent.click(screen.getByRole("button", { name: /verify saved profile/i }));
    await waitFor(() => expect(recoverProfile).toHaveBeenCalledWith({ connectionId: "connection-1" }));
    expect(startAuthentication).not.toHaveBeenCalled();
    expect(startAgentRegistration).not.toHaveBeenCalled();
    expect(await screen.findByText("Sources settings reached")).toBeInTheDocument();
  });

  it("shows a completed active and ready connection without a recovery action", () => {
    connectionStatus = "active";
    contextStatus = "ready";
    renderPage();
    expect(screen.queryByRole("button", { name: /verify saved profile/i })).not.toBeInTheDocument();
    expect(screen.getByText("Verify persistent Firecrawl profile").closest("li")).toHaveClass("rs-run-step--done");
  });
});
