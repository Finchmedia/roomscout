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
      : vi.fn(async () => undefined),
  useAction: () => vi.fn(async () => ({ configured: true, status: "active" })),
}));

vi.mock("../../components/navigation/WorkspaceShell", () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("../../components/connections/PortalConnectionsWorkspace", () => ({
  PortalConnectionsWorkspace: () => null,
}));
vi.mock("../../components/memory/ContextImportDialog", () => ({
  ContextImportDialog: () => null,
}));

function renderSection(section: string) {
  return render(
    <MemoryRouter initialEntries={[`/app/profile?section=${section}`]}>
      <Routes>
        <Route element={<ProfilePage />} path="/app/profile" />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProfilePage legacy settings route", () => {
  beforeEach(() => {
    deleteFact.mockClear();
  });
  afterEach(cleanup);

  it("states honestly that billing and metering are unavailable", () => {
    renderSection("usage");
    expect(
      screen.getByRole("heading", { name: "Billing is not available" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no connected billing system/i),
    ).toBeInTheDocument();
  });

  it("navigates between query-selected settings sections", () => {
    renderSection("sources");
    fireEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(
      screen.getByRole("heading", { name: "Privacy" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Sources & access" }),
    ).not.toBeInTheDocument();
  });

  it("keeps memory deletion behind confirmation", async () => {
    renderSection("knowledge");
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
    renderSection("privacy");
    expect(
      screen.getByRole("heading", { name: "Privacy" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Raw voice audio/)).toBeInTheDocument();
    expect(screen.getByText(/approved GPT-Live voice flow/)).toBeInTheDocument();
  });
});
