import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveSettingsPage } from "./LiveSettingsPage";

const useQuery = vi.fn();
const mutation = vi.fn(async () => null);

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
  useMutation: () => mutation,
  useAction: () => mutation,
}));

vi.mock("../../ui/copy", () => ({
  useCopy: () => ({ t: (key: string) => key }),
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

afterEach(cleanup);

function queryFixture(portals: unknown[] = [], connectable: unknown[] = [], selectedNeed?: Record<string, unknown>) {
  useQuery.mockReset();
  const user = { _id: "user", username: "cooks", displayName: "The Cooks", role: "musician" };
  const need = { _id: "need", title: "Search", status: "active", arrangement: [], schedule: [], requirements: [], ...selectedNeed };
  const results: Record<string, unknown> = {
    "users:current": user,
    "savedNeeds:listMine": [need],
    "scout:getMine": { activeNeedId: "need" },
    "memory:listMine": { facts: [], events: [], profile: undefined },
    "mailboxes:getMine": null,
    "portalConnections:listMine": portals,
    "portalConnections:listConnectableSources": connectable,
    "searchSources:listForNeed": { city: "Berlin", sources: [] },
    "mandates:getActiveMine": null,
    "searchSources:getPortalPreferences": [],
  };
  useQuery.mockImplementation((reference) => results[getFunctionName(reference)]);
}

function renderRoute(section: string) {
  return render(<MemoryRouter initialEntries={[`/app/settings/${section}`]}><Routes>
    <Route path="/app/settings/:section" element={<LiveSettingsPage />} />
    <Route path="/app/scout" element={<p>Scout route</p>} />
  </Routes></MemoryRouter>);
}

describe("LiveSettingsPage", () => {
  beforeEach(() => { queryFixture(); mutation.mockClear(); });

  it("keeps the design photo, gradient and grain stage behind settings", () => {
    const { container } = renderRoute("sources");
    const stage = container.querySelector('[data-slot="stage-background"]');
    expect(stage).toHaveAttribute("data-position", "fixed");
    expect(stage?.querySelector(".rs-bg")).toBeInTheDocument();
    expect(stage?.querySelector(".rs-grain")).toBeInTheDocument();
    expect(stage?.querySelector("header")).toBeInTheDocument();
  });

  it("does not render pretend notification toggles when preferences are unavailable", () => {
    renderRoute("notifications");
    expect(screen.getByText("liveSettings.notificationUnavailable")).toBeVisible();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("guards the panel close while the profile name has unsaved changes", () => {
    renderRoute("profile");
    fireEvent.change(screen.getByLabelText("liveSettings.displayName"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "close-settings" }));
    expect(screen.getByText("liveSettings.discardBody")).toBeVisible();
    expect(screen.queryByText("Scout route")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "liveSettings.discard" }));
    expect(screen.getByText("Scout route")).toBeVisible();
  });

  it("guards navigation away from an unsaved autonomy mode change", () => {
    renderRoute("autonomy");
    fireEvent.click(screen.getByRole("radio", { name: /settings.autonomy.mode.autopilot.title/ }));
    fireEvent.click(screen.getByRole("button", { name: "settings.nav.item.sources" }));
    expect(screen.getByText("liveSettings.discardBody")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "liveSettings.discard" }));
    expect(screen.getByRole("heading", { name: "settings.sources.title" })).toBeVisible();
    expect(mutation).not.toHaveBeenCalled();
  });

  it("localizes connection state and does not offer an already connected source again", () => {
    queryFixture([{ _id: "portal", sourceId: "source", sourceName: "roomscout.dev", baseUrl: "https://roomscout.dev", status: "active", policyDecision: "allowed", allowInboxPolling: true }], [{ sourceId: "source", name: "roomscout.dev", baseUrl: "https://roomscout.dev" }]);
    renderRoute("sources");
    expect(screen.getByText("settings.sources.status.connected")).toBeVisible();
    expect(screen.getByRole("heading", { name: "settings.sources.title" })).toBeVisible();
    expect(screen.getByRole("button", { name: "settings.sources.detail.manageConnection" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "liveSettings.remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "liveSettings.include" })).not.toBeInTheDocument();
  });

  it("shows facts from the Scout-selected search instead of a different saved search", () => {
    queryFixture([], [], { maxBudgetEur: 400, genres: ["Rock"] });
    renderRoute("knowledge");
    expect(screen.getByText("Bis 400 € / Monat")).toBeVisible();
    expect(screen.getByText("Rock")).toBeVisible();
  });

  it("renders billing controls as disabled placeholders without inventing usage", () => {
    renderRoute("billing");
    expect(screen.getByRole("button", { name: "Tarife ansehen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verwalten" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hinzufügen" })).toBeDisabled();
    expect(screen.getAllByText("Noch nicht erfasst")).toHaveLength(3);
    expect(mutation).not.toHaveBeenCalled();
  });

  it("connects privacy navigation while export and account deletion remain disabled", () => {
    renderRoute("privacy");
    expect(screen.getByRole("button", { name: "Daten exportieren" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Konto löschen" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Portalzugänge verwalten" }));
    expect(screen.getByRole("heading", { name: "settings.sources.title" })).toBeVisible();
    expect(mutation).not.toHaveBeenCalled();
  });
});
