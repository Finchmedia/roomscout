import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSettingsPage } from "./LiveSettingsPage";
import { LocaleProvider } from "../../ui/copy";

const useQuery = vi.fn();
const mutation = vi.fn(async () => null);
const recoverProfile = vi.fn(async () => ({ status: "completed" }));
const startAuthentication = vi.fn(async () => ({ runId: "auth-run" }));
const startRegistration = vi.fn(async () => ({ runId: "registration-run" }));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
  useMutation: () => mutation,
  useAction: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name === "firecrawlPortal:recoverProfile") return recoverProfile;
    if (name === "browserbasePortal:startAuthentication") return startAuthentication;
    if (name === "browserbasePortal:startAgentRegistration") return startRegistration;
    return mutation;
  },
}));

vi.mock("../../ui/chrome/PanelDialog", () => ({
  PanelDialog: ({ children, groups, onOpenChange, onSelect, overlays }: {
    children: React.ReactNode;
    groups: Array<{ items: Array<{ id: string; label: string }> }>;
    onOpenChange: (open: boolean) => void;
    onSelect: (id: string) => void;
    overlays: React.ReactNode;
  }) => <div>
    <button onClick={() => onOpenChange(false)}>close-settings</button>
    {groups.flatMap((group) => group.items).map((item) => <button key={item.id} onClick={() => onSelect(item.id)}>{item.label}</button>)}
    {children}{overlays}
  </div>,
}));

vi.mock("../../components/memory/ContextImportDialog", () => ({ ContextImportDialog: () => null }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function queryFixture(portals: unknown[] = [], connectable: unknown[] = [], selectedNeed?: Record<string, unknown>, publicSources: unknown[] = [], overrides: Record<string, unknown> = {}) {
  useQuery.mockReset();
  const user = {
    _id: "user", username: "cooks", displayName: "The Cooks", role: "musician",
    firstName: "Alex", lastName: "Private-Surname", actKind: "band", actName: "The Cooks",
    profileCompleted: true, providerDisplayName: "RoomScout for The Cooks", representedName: "The Cooks",
  };
  const need = { _id: "need", title: "Search", status: "active", arrangement: [], schedule: [], requirements: [], ...selectedNeed };
  const results: Record<string, unknown> = {
    "users:current": user,
    "savedNeeds:listMine": [need],
    "scout:getMine": { activeNeedId: "need" },
    "memory:listMine": { facts: [], events: [], profile: undefined },
    "mailboxes:getMine": null,
    "portalConnections:listMine": portals,
    "portalConnections:listConnectableSources": connectable,
    "searchSources:listForNeed": { city: "Berlin", sources: publicSources },
    "autonomy:getMine": { rules: { mode: "autopilot", contact: true, viewings: true, publishAd: false, shareProfile: true, sharePrivate: false }, version: 0, contentHash: "hash", updatedAt: null },
    "searchSources:getPortalPreferences": [],
    "demoReset:statusMine": null,
    ...overrides,
  };
  useQuery.mockImplementation((reference) => results[getFunctionName(reference)]);
}

function routeTree(section: string) {
  return <LocaleProvider><MemoryRouter initialEntries={[`/app/settings/${section}`]}><Routes>
    <Route path="/app/settings/:section" element={<LiveSettingsPage />} />
    <Route path="/app/runs/:runId" element={<p>Run route</p>} />
    <Route path="/app/scout" element={<p>Scout route</p>} />
  </Routes></MemoryRouter></LocaleProvider>;
}

function renderRoute(section: string) {
  return render(routeTree(section));
}

describe("LiveSettingsPage", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    queryFixture(); mutation.mockClear(); recoverProfile.mockClear();
    startAuthentication.mockClear(); startRegistration.mockClear();
  });

  it("does not render pretend notification toggles when preferences are unavailable", () => {
    renderRoute("notifications");
    expect(screen.getByText("Notifications currently appear only in RoomScout. Email, push, and browser settings are not available yet.")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("guards the panel close while the provider identity has unsaved changes", () => {
    renderRoute("profile");
    fireEvent.change(screen.getByLabelText("Band or artist name (optional)"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "close-settings" }));
    expect(screen.getByText("Your changes will be lost when you leave.")).toBeVisible();
    expect(screen.queryByText("Scout route")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByText("Scout route")).toBeVisible();
  });

  it("saves the structured profile with the exact confirmed provider preview", async () => {
    renderRoute("profile");
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Robin" } });
    expect(screen.getByText("RoomScout for The Cooks")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(mutation).toHaveBeenCalledWith({
      firstName: "Robin",
      lastName: "Private-Surname",
      actKind: "band",
      actName: "The Cooks",
      expectedProviderDisplayName: "RoomScout for The Cooks",
    });
  });

  it("guards navigation away from an unsaved autonomy mode change", () => {
    renderRoute("autonomy");
    expect(screen.getByRole("radio", { name: /Autopilot/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Review every action/ }));
    fireEvent.click(screen.getByRole("button", { name: "Sources & access" }));
    expect(screen.getByText("Your changes will be lost when you leave.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("heading", { name: "Where may your Scout search?" })).toBeVisible();
    expect(mutation).not.toHaveBeenCalled();
  });

  it("localizes connection state and does not offer an already connected source again", () => {
    queryFixture([{ _id: "portal", sourceId: "source", sourceName: "roomscout.dev", baseUrl: "https://roomscout.dev", status: "active", policyDecision: "allowed", allowInboxPolling: true }], [{ sourceId: "source", name: "roomscout.dev", baseUrl: "https://roomscout.dev" }]);
    renderRoute("sources");
    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Where may your Scout search?" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Manage connection" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Include" })).not.toBeInTheDocument();
  });

  it("shows persisted Firecrawl registration progress and opens its actual run", () => {
    queryFixture([{
      _id: "portal", sourceId: "source", sourceName: "roomscout.dev", baseUrl: "https://roomscout.dev",
      status: "needs_auth", contextStatus: "creating", browserProvider: "firecrawl", policyDecision: "allowed",
      allowInboxPolling: false, latestAuthenticationRun: {
        runId: "run-waiting", status: "running", onboardingStage: "waiting_verification",
        browserProvider: "firecrawl", updatedAt: 1,
      },
    }]);
    renderRoute("sources");
    expect(screen.getByText("Waiting for verification email")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Manage connection" }));
    expect(screen.getByRole("button", { name: "View progress" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sign in securely" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register Scout" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View progress" }));
    expect(screen.getByText("Run route")).toBeVisible();
  });

  it.each([
    ["queued", undefined, "Registration queued"],
    ["running", "opening_signup", "Opening registration"],
    ["running", "submitting_verification", "Checking verification code"],
    ["failed", "failed", "Registration failed"],
  ])("projects persisted authentication phase %s/%s", (status, onboardingStage, expected) => {
    queryFixture([{
      _id: "portal", sourceId: "source", sourceName: "roomscout.dev", baseUrl: "https://roomscout.dev",
      status: "needs_auth", contextStatus: "creating", browserProvider: "firecrawl", policyDecision: "allowed",
      allowInboxPolling: false, latestAuthenticationRun: {
        runId: "run-phase", status, onboardingStage, browserProvider: "firecrawl", updatedAt: 1,
      },
    }]);
    renderRoute("sources");
    expect(screen.getByText(expected)).toBeVisible();
  });

  it("uses Firecrawl profile recovery and never calls generic manual authentication", async () => {
    queryFixture([{
      _id: "portal", sourceId: "source", sourceName: "roomscout.dev", baseUrl: "https://roomscout.dev",
      status: "needs_auth", contextStatus: "creating", browserProvider: "firecrawl", policyDecision: "allowed",
      allowInboxPolling: false, latestAuthenticationRun: {
        runId: "run-completed", status: "completed", onboardingStage: "completed",
        browserProvider: "firecrawl", updatedAt: 1,
      },
    }]);
    renderRoute("sources");
    expect(screen.getByText("Sign-in required")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Manage connection" }));
    expect(screen.getByText("Manual sign-in for Firecrawl is not available here.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Check saved profile" }));
    expect(recoverProfile).toHaveBeenCalledWith({ connectionId: "portal" });
    expect(startAuthentication).not.toHaveBeenCalled();
    expect(startRegistration).not.toHaveBeenCalled();
  });

  it("keeps real sources readable but disables connection and authentication actions", () => {
    queryFixture(
      [{ _id: "real-portal", sourceId: "real-source", sourceName: "Real portal", baseUrl: "https://real.example", status: "needs_auth", policyDecision: "allowed", allowInboxPolling: false }],
      [{ sourceId: "new-real", name: "Another real portal", baseUrl: "https://another.example" }],
      undefined,
      [
        { platformId: "indexed", name: "Indexed public source", domain: "indexed.example", platformStatus: "active", confidence: 1, preference: "neutral", hasIndexedEvidence: true },
        { platformId: "reviewed", name: "Reviewed source", domain: "reviewed.example", platformStatus: "active", confidence: 1, preference: "neutral" },
      ],
    );
    renderRoute("sources");
    expect(screen.getByText("Indexed source")).toBeVisible();
    expect(screen.getAllByText("Reviewed source").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contact disabled in demo").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Manage connection" }));
    expect(screen.queryByRole("button", { name: "Sign in securely" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Register Scout" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "View more sources" }));
    expect(screen.getByRole("button", { name: "Contact disabled in demo" })).toBeDisabled();
    expect(mutation).not.toHaveBeenCalled();
  });

  it("shows facts from the Scout-selected search instead of a different saved search", () => {
    queryFixture([], [], { maxBudgetEur: 400, genres: ["Rock"] });
    renderRoute("knowledge");
    expect(screen.getByText("Up to €400 / month")).toBeVisible();
    expect(screen.getByText("Rock")).toBeVisible();
  });

  it("renders billing controls as disabled placeholders without inventing usage", () => {
    renderRoute("billing");
    expect(screen.getByRole("button", { name: "View plans" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Manage" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getAllByText("Not tracked yet")).toHaveLength(3);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("connects privacy navigation while export and account deletion remain disabled", () => {
    renderRoute("privacy");
    expect(screen.getByRole("button", { name: "Export data" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete account" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Manage portal connections" }));
    expect(screen.getByRole("heading", { name: "Where may your Scout search?" })).toBeVisible();
    expect(mutation).not.toHaveBeenCalled();
  });

  it("starts the demo reset from the privacy section only after confirmation", () => {
    renderRoute("privacy");
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Reset search and conversations?")).toBeVisible();
    expect(mutation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset now" }));
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledWith({});
  });

  it("shows a running demo reset as disabled progress and returns to the Scout once it completes", () => {
    vi.useFakeTimers();
    try {
      const running = { resetId: "reset-1", status: "running", stage: 3, stageCount: 26, deletedDocumentCount: 7, updatedAt: Date.now() };
      queryFixture([], [], undefined, [], { "demoReset:statusMine": running });
      const view = renderRoute("privacy");
      expect(screen.getByRole("button", { name: "Resetting … 7 deleted" })).toBeDisabled();
      queryFixture([], [], undefined, [], { "demoReset:statusMine": { ...running, status: "completed", stage: 26, deletedDocumentCount: 14, updatedAt: Date.now(), completedAt: 1 } });
      view.rerender(routeTree("privacy"));
      expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
      act(() => { vi.advanceTimersByTime(1200); });
      expect(screen.getByText("Scout route")).toBeVisible();
      expect(mutation).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });

  it("re-enables the reset once a running demo reset stalls, and resumes it through the same confirmation", () => {
    vi.useFakeTimers();
    try {
      // The pager last wrote a moment ago: still healthy, so the button reports progress ...
      const running = { resetId: "reset-1", status: "running", stage: 3, stageCount: 26, deletedDocumentCount: 7, updatedAt: Date.now() - 29_000 };
      queryFixture([], [], undefined, [], { "demoReset:statusMine": running });
      renderRoute("privacy");
      expect(screen.getByRole("button", { name: "Resetting … 7 deleted" })).toBeDisabled();
      // ... until the stall threshold passes without a newer write.
      act(() => { vi.advanceTimersByTime(1_000); });
      expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      fireEvent.click(screen.getByRole("button", { name: "Reset now" }));
      expect(mutation).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Scout route")).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it("does not treat an old completed demo reset as a fresh completion", () => {
    queryFixture([], [], undefined, [], { "demoReset:statusMine": { resetId: "reset-0", status: "completed", stage: 26, stageCount: 26, deletedDocumentCount: 14, updatedAt: 1, completedAt: 1 } });
    renderRoute("privacy");
    expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
    expect(screen.queryByText("Scout route")).not.toBeInTheDocument();
  });
});
