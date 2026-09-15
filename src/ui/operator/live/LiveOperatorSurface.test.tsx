import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  LiveOperatorSurface,
  type LiveOperatorSection,
} from "./LiveOperatorSurface";

const NOW = new Date(2026, 8, 14, 12, 0).getTime();

const base = {
  metrics: [],
  activity: [],
  providers: [],
  sources: [],
  boundedSample: 0,
  readinessLoading: false,
  now: NOW,
  onRefreshReadiness: vi.fn(),
  onCheckSources: vi.fn(),
  onToggleSource: vi.fn(),
  onSectionChange: vi.fn(),
  onToolOpen: vi.fn(),
  onClose: vi.fn(),
};

function renderSection(section: LiveOperatorSection, overrides = {}) {
  return render(
    <LiveOperatorSurface {...base} {...overrides} section={section} />,
  );
}

describe("live operator surface", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  beforeAll(() => {
    Element.prototype.scrollTo = () => {};
  });

  it("shows fixed provider identities as unchecked before readiness returns", () => {
    renderSection("overview");
    expect(screen.getByText("Convex AI Gateway")).toBeInTheDocument();
    expect(screen.getByText("Firecrawl")).toBeInTheDocument();
    expect(screen.getAllByText("Noch nicht geprüft").length).toBeGreaterThan(0);
  });

  it("renders honest disabled flag controls", () => {
    renderSection("flags");
    expect(screen.getByRole("switch", { name: "Voice Scout" })).toBeDisabled();
    expect(
      screen.getByRole("switch", { name: "Öffentliche Quellensuche" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Änderungen speichern" }),
    ).toBeDisabled();
  });

  it("treats a degraded source as disturbed, not connected", () => {
    renderSection("sources", {
      sources: [
        {
          id: "one",
          name: "Quelle",
          status: "active",
          health: "failing",
          baseUrl: "https://roomscout.dev/inserate",
        },
      ],
    });
    expect(screen.getByText("Gestört").closest("span")).toHaveAttribute(
      "data-tone",
      "warning",
    );
  });

  it("names the demo access only for an active controlled source", () => {
    renderSection("sources", {
      sources: [
        {
          id: "demo",
          name: "Demo-Quelle",
          status: "active",
          health: "healthy",
          baseUrl: "https://roomscout.dev/inserate",
          lastCheckedAt: NOW - 90 * 60_000,
        },
        {
          id: "extern",
          name: "Fremdquelle",
          status: "active",
          health: "healthy",
          baseUrl: "https://example.org/list",
        },
        {
          id: "paused",
          name: "Pausierte Quelle",
          status: "paused",
          health: "unknown",
          baseUrl: "https://roomscout.dev/inserate",
        },
      ],
    });
    expect(screen.getByText("Angebunden · Demo-Zugang")).toBeInTheDocument();
    expect(screen.getByText("Angebunden")).toBeInTheDocument();
    expect(screen.getByText("Nicht aktiv").closest("span")).toHaveAttribute(
      "data-tone",
      "muted",
    );
    // Stamped against the injected clock, never the wall clock.
    expect(screen.getByText("Today, 10:30")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBe(2);
  });

  it("toggles a source through the caller and keeps the row disabled meanwhile", () => {
    let settle = () => {};
    const onToggleSource = vi.fn(
      () => new Promise<void>((resolve) => { settle = resolve; }),
    );
    renderSection("sources", {
      sources: [
        { id: "one", name: "Quelle", status: "paused", health: "unknown" },
      ],
      onToggleSource,
    });
    const toggle = screen.getByRole("switch", { name: "Quelle aktivieren" });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(onToggleSource).toHaveBeenCalledWith("one", true);
    expect(toggle).toBeDisabled();
    settle();
  });

  it("offers a bounded demo check and the advanced view instead of a read-only note", () => {
    const onCheckSources = vi.fn();
    const onToolOpen = vi.fn();
    renderSection("sources", { onCheckSources, onToolOpen });
    fireEvent.click(
      screen.getByRole("button", { name: "Jetzt Quellen prüfen" }),
    );
    expect(onCheckSources).toHaveBeenCalled();
    expect(screen.getByText(/nur auf roomscout.dev begrenzt|roomscout.dev begrenzt/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Erweiterte Ansicht" }));
    expect(onToolOpen).toHaveBeenCalledWith("sources");
  });

  it("disables the check button while a run is in flight", () => {
    renderSection("sources", { sourceCheckRunning: true });
    expect(screen.getByRole("button", { name: "Prüfung läuft …" })).toBeDisabled();
  });

  it("shows OpenAI as a tile and folds Browserbase into the Firecrawl engine picker", () => {
    renderSection("overview");
    expect(
      screen.getByText("OpenAI direkt").closest('[data-slot="card"]'),
    ).not.toBeNull();
    expect(screen.queryByText("Browserbase")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Engine: Firecrawl/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Quellen beobachten · Portal-Zugänge"),
    ).toBeInTheDocument();
  });

  it("lists the integrations in the fixed order without a Browserbase row", () => {
    renderSection("integrations");
    const rows = Array.from(
      document.querySelectorAll('[data-slot="operator-integration-row"]'),
    ).map((row) => row.textContent ?? "");
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain("Convex AI Gateway");
    expect(rows[1]).toContain("AgentMail");
    expect(rows[2]).toContain("OpenAI direkt");
    expect(rows[3]).toContain("Firecrawl");
    expect(rows[4]).toContain("Mapbox");
    expect(rows.join(" ")).not.toContain("Browserbase");
  });

  it("filters on exact failure status and expands real event detail", () => {
    renderSection("tasks", {
      activity: [
        {
          id: "ok",
          title: "healthy title",
          detail: "done detail",
          status: "processed",
          at: 1,
        },
        {
          id: "bad",
          title: "job",
          detail: "failure detail",
          status: "failed",
          at: 2,
        },
      ],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Braucht Aufmerksamkeit" }),
    );
    expect(screen.queryByText("healthy title")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Details/ }));
    expect(screen.getByText(/failure detail/)).toBeInTheDocument();
  });
});
