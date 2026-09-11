import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  LiveOperatorSurface,
  type LiveOperatorSection,
} from "./LiveOperatorSurface";

const base = {
  metrics: [],
  activity: [],
  providers: [],
  sources: [],
  boundedSample: 0,
  readinessLoading: false,
  onRefreshReadiness: vi.fn(),
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

  it("treats unhealthy source health as warning, not healthy", () => {
    renderSection("sources", {
      sources: [
        { id: "one", name: "Quelle", status: "active", health: "unhealthy" },
      ],
    });
    expect(screen.getByText(/unhealthy/).closest("span")).toHaveAttribute(
      "data-tone",
      "warning",
    );
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
