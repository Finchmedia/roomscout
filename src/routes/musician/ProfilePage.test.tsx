import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const deleteFact = vi.fn(async () => undefined);
const recoverSetup = vi.fn(async () => undefined);
const registerPortal = vi.fn(async () => ({ runId: "new-run" }));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    users: { current: "users.current" },
    memory: {
      listMine: "memory.listMine",
      deleteFact: "memory.deleteFact",
      refreshMyEmbeddings: "memory.refreshMyEmbeddings",
      refreshMyContext: "memory.refreshMyContext",
    },
    mailboxes: {
      getMine: "mailboxes.getMine",
      ensureMine: "mailboxes.ensureMine",
    },
    portalConnections: {
      listMine: "portalConnections.listMine",
      listConnectableSources: "portalConnections.listConnectableSources",
      pauseMine: "portalConnections.pauseMine",
      requestConnection: "portalConnections.requestConnection",
      recoverFailedRegistration: "portalConnections.recoverFailedRegistration",
    },
    browserbasePortal: {
      startAuthentication: "browserbasePortal.startAuthentication",
      startAgentRegistration: "browserbasePortal.startAgentRegistration",
      syncInboxNow: "browserbasePortal.syncInboxNow",
      disableConnection: "browserbasePortal.disableConnection",
    },
    firecrawlPortal: { recoverProfile: "firecrawlPortal.recoverProfile" },
    savedNeeds: { listMine: "savedNeeds.listMine" },
    searchSources: {
      listForNeed: "searchSources.listForNeed",
      setPreference: "searchSources.setPreference",
    },
    signals: { list: "signals.list" },
    mandates: {
      getActiveMine: "mandates.getActiveMine",
      createDraft: "mandates.createDraft",
      activate: "mandates.activate",
      enableDefaultAutopilot: "mandates.enableDefaultAutopilot",
      revoke: "mandates.revoke",
      killSwitch: "mandates.killSwitch",
    },
    scout: { getMine: "scout.getMine" },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: (query: string) => {
    if (query === "users.current")
      return {
        username: "drummer",
        displayName: "The Drummer",
        role: "musician",
      };
    if (query === "memory.listMine")
      return {
        profile: {
          contextVersion: 1,
          factVersion: 1,
          summary: "A loud trio.",
          musicalIdentity: "Noise rock",
          practicalContext: "Berlin",
          relationshipContext: "Three members",
          hardConstraints: [],
          softPreferences: [],
          openQuestions: [],
        },
        facts: [
          {
            _id: "fact-1",
            subject: "Band",
            subjectKind: "project",
            predicate: "city",
            category: "search",
            value: "Berlin",
            verification: "stated",
            source: "conversation",
            confidence: 1,
            embeddingState: "ready",
          },
        ],
        events: [],
      };
    if (
      query === "portalConnections.listMine" ||
      query === "portalConnections.listConnectableSources"
    )
      return [];
    if (query === "savedNeeds.listMine") return [];
    if (query === "scout.getMine") return null;
    return null;
  },
  useMutation: (mutation: string) =>
    mutation === "memory.deleteFact"
      ? deleteFact
      : mutation === "portalConnections.recoverFailedRegistration"
        ? recoverSetup : vi.fn(async () => undefined),
  useAction: (action: string) => action === "browserbasePortal.startAgentRegistration"
    ? registerPortal : vi.fn(async () => ({ configured: true, status: "active" })),
}));

vi.mock("../../components/navigation/WorkspaceShell", () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("../../components/connections/PortalConnectionsWorkspace", () => ({
  PortalConnectionsWorkspace: ({ onRecoverRegistration, success, error }: {
    onRecoverRegistration?: (id: string) => void; success?: string; error?: string;
  }) => <div>Live portal controls
    <button onClick={() => onRecoverRegistration?.("failed-connection")} type="button">Reset failed setup</button>
    {success ? <p role="status">{success}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
  </div>,
}));
vi.mock("../../components/memory/ContextImportDialog", () => ({
  ContextImportDialog: () => null,
}));

function renderSection(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProfilePage />} path="/app/settings/:section?" />
        <Route element={<ProfilePage />} path="/app/profile" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProfilePage settings routes", () => {
  beforeEach(() => {
    deleteFact.mockClear(); recoverSetup.mockReset(); registerPortal.mockClear();
  });
  afterEach(cleanup);

  it("uses the deep-linked section and presents sources without requiring a search", () => {
    renderSection("/app/settings/sources");
    expect(
      screen.getByRole("heading", { name: "Sources & access" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Live portal controls")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Create a search first" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/portal access/i)).toBeInTheDocument();
  });

  it("recovers only the selected setup and waits for a separate registration click", async () => {
    renderSection("/app/settings/sources");
    fireEvent.click(screen.getByRole("button", { name: "Reset failed setup" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Setup unblocked"));
    expect(recoverSetup).toHaveBeenCalledWith({ connectionId: "failed-connection" });
    expect(registerPortal).not.toHaveBeenCalled();
  });

  it("renders a recovery cooldown without leaking server details", async () => {
    recoverSetup.mockRejectedValueOnce({ data: { kind: "RateLimited", name: "portalAuthRecovery", retryAfter: 60_000 } });
    renderSection("/app/settings/sources");
    fireEvent.click(screen.getByRole("button", { name: "Reset failed setup" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again in 1 minute"));
    expect(registerPortal).not.toHaveBeenCalled();
  });

  it("states honestly that billing and metering are unavailable", () => {
    renderSection("/app/settings/usage");
    expect(
      screen.getByRole("heading", { name: "Billing is not available" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no connected billing system/i),
    ).toBeInTheDocument();
  });

  it("navigates between path-based settings sections", () => {
    renderSection("/app/settings/sources");
    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(
      screen.getByRole("heading", { name: "Privacy" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sources & access" }),
    ).not.toBeInTheDocument();
  });

  it("keeps memory deletion behind confirmation", async () => {
    renderSection("/app/settings/knowledge");
    fireEvent.click(screen.getByRole("button", { name: "Forget Berlin" }));
    expect(
      screen.getByRole("dialog", { name: "Forget this fact?" }),
    ).toBeInTheDocument();
    expect(deleteFact).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Forget fact" }));
    await waitFor(() =>
      expect(deleteFact).toHaveBeenCalledWith({ factId: "fact-1" }),
    );
  });

  it("keeps the legacy profile query links working", () => {
    renderSection("/app/profile?section=privacy");
    expect(
      screen.getByRole("heading", { name: "Privacy" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Raw voice audio/)).toBeInTheDocument();
  });
});
