import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LiveOperatorPage } from "./LiveOperatorPage";

const fixtures = vi.hoisted(() => ({
  user: { role: "operator" } as { role: string } | null | undefined,
  overview: {
    boundedSample: 200,
    metrics: {
      publishedSignals: 12, staleSignals: 2, detailBacklog: 3,
      detailFailures: 1, awaitingApproval: 4, repliedThreads: 5,
      unhealthySources: 1, activeVoiceSessions: 0, activeMailboxes: 6,
    },
    activity: [{ id: "event-1", kind: "mail", title: "Mail received", detail: "Provider reply", status: "received", at: 1 }],
  },
  readiness: vi.fn().mockResolvedValue({
    overallStatus: "incomplete", configuredProviders: 3, serverProviderCount: 5,
    firecrawl: { status: "configured" }, agentmail: { status: "configured" },
    browserbase: { status: "incomplete" }, mapbox: { status: "disabled" },
    openaiDirect: { status: "client_only" }, frontendMapbox: { status: "client_only" },
  }),
  queries: vi.fn(),
  sources: [{ _id: "source-test", name: "Testquelle", geographicScope: "Testregion", status: "paused", health: "unknown", accessMode: "public" }],
}));

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref);
    fixtures.queries(name, args);
    if (name === "users:current") return fixtures.user;
    if (name === "ops:overview") return fixtures.overview;
    if (name === "ops:listSources") return fixtures.sources;
    return undefined;
  },
  useAction: () => fixtures.readiness,
}));

function renderRoute(path = "/ops") {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/ops/:section?" element={<LiveOperatorPage />} /></Routes></MemoryRouter>);
}

afterEach(cleanup);
beforeEach(() => {
  fixtures.user = { role: "operator" };
  fixtures.readiness.mockClear();
  fixtures.queries.mockClear();
});

it("renders only real overview metrics and preserves links to operational tools", () => {
  renderRoute();
  expect(screen.getByRole("heading", { name: "Betreiberansicht" })).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("Veröffentlichte Signale")).toBeInTheDocument();
  expect(screen.queryByText(/Parallele Browser-Sessions/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Feature-Flags$/ })).toBeInTheDocument();
});

it("loads the operator-gated provider snapshot only after explicit refresh", async () => {
  renderRoute("/ops/integrations");
  expect(fixtures.readiness).not.toHaveBeenCalled();
  expect(screen.getByText("Nur Konfigurationsprüfung, kein Live-Test")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Konfiguration neu prüfen" }));
  await waitFor(() => expect(fixtures.readiness).toHaveBeenCalledWith({}));
  expect(await screen.findByText("Firecrawl")).toBeInTheDocument();
  expect(screen.getByText("Deaktiviert")).toBeInTheDocument();
  expect(screen.getByText("Nur im Client prüfbar")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Konfigurationsprüfung abgeschlossen");
});

it("reports a readiness transport failure separately from incomplete configuration", async () => {
  fixtures.readiness.mockRejectedValueOnce(new Error("private provider detail"));
  renderRoute("/ops/integrations");
  fireEvent.click(screen.getByRole("button", { name: "Konfiguration neu prüfen" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Die Konfigurationsprüfung ist fehlgeschlagen. Bitte erneut versuchen.");
  expect(screen.queryByText("private provider detail")).not.toBeInTheDocument();
});

it("does not run provider readiness while mounting integrations in StrictMode", () => {
  render(<StrictMode><MemoryRouter initialEntries={["/ops/integrations"]}><Routes><Route path="/ops/:section?" element={<LiveOperatorPage />} /></Routes></MemoryRouter></StrictMode>);
  expect(fixtures.readiness).not.toHaveBeenCalled();
});

it("keeps a local authorization boundary if mounted outside the guarded router", () => {
  fixtures.user = { role: "musician" };
  renderRoute();
  expect(screen.getByRole("heading", { name: "Betreiberzugang erforderlich" })).toBeInTheDocument();
  expect(screen.queryByText("Veröffentlichte Signale")).not.toBeInTheDocument();
  expect(fixtures.queries).toHaveBeenCalledWith("ops:overview", "skip");
  expect(fixtures.queries).toHaveBeenCalledWith("ops:listSources", "skip");
});

it("loads real source rows only on the authorized sources section", () => {
  renderRoute("/ops/sources");
  expect(fixtures.queries).toHaveBeenCalledWith("ops:listSources", { limit: 40 });
  expect(screen.getByText("Testquelle")).toBeInTheDocument();
  expect(screen.getByText("Testregion")).toBeInTheDocument();
});

it("does not subscribe to source details from the overview", () => {
  renderRoute();
  expect(fixtures.queries).toHaveBeenCalledWith("ops:listSources", "skip");
});

it.each([
  ["overview", "Betrieb im Blick"],
  ["sources", "Quellen"],
  ["tasks", "Aufträge"],
  ["integrations", "Integrationen"],
  ["flags", "Feature-Flags"],
  ["diag", "Diagnose"],
])("supports the design section /ops/%s", (section, heading) => {
  renderRoute(`/ops/${section}`);
  expect(screen.getByRole("heading", { name: heading, level: 1 })).toBeInTheDocument();
});

it("keeps old activity links pointed at the tasks view", () => {
  renderRoute("/ops/activity");
  expect(screen.getByRole("heading", { name: "Aufträge" })).toBeInTheDocument();
  expect(screen.getByText("Mail received")).toBeInTheDocument();
});

it("renders the authorization loading state in the tokenized shell", () => {
  fixtures.user = undefined;
  renderRoute();
  expect(screen.getByRole("status")).toHaveTextContent("Betreiberzugang wird geprüft");
  expect(screen.getByRole("status").closest('[data-slot="card"]')).toBeInTheDocument();
});
