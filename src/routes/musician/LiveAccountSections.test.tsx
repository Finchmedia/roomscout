import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveBillingSection, LivePrivacySection } from "./LiveAccountSections";

afterEach(cleanup);

describe("LiveBillingSection", () => {
  it("shows no invented usage and keeps unavailable billing controls disabled", () => {
    render(<LiveBillingSection />);
    expect(screen.getAllByText("Noch nicht erfasst")).toHaveLength(3);
    for (const name of ["Tarife ansehen", "Verwalten", "Hinzufügen"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.queryByText(/September|pro Monat/i)).not.toBeInTheDocument();
  });

  it("shows only explicitly supplied reliable counts", () => {
    render(<LiveBillingSection activity={{ activeSearches: 1, providersContacted: 2 }} />);
    expect(screen.getByText("1")).toBeVisible(); expect(screen.getByText("2")).toBeVisible();
    expect(screen.getAllByText("Noch nicht erfasst")).toHaveLength(1);
  });
});

describe("LivePrivacySection", () => {
  it("keeps real navigation active and placeholder data actions disabled", () => {
    const onKnowledge = vi.fn(), onSources = vi.fn(), onScout = vi.fn();
    render(<LivePrivacySection onKnowledge={onKnowledge} onSources={onSources} onScout={onScout} />);
    fireEvent.click(screen.getByRole("button", { name: "Gespeicherte Angaben ansehen" }));
    fireEvent.click(screen.getByRole("button", { name: "Portalzugänge verwalten" }));
    fireEvent.click(screen.getByRole("button", { name: "Gespräche ansehen" }));
    expect(onKnowledge).toHaveBeenCalledOnce(); expect(onSources).toHaveBeenCalledOnce(); expect(onScout).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Daten exportieren" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Konto löschen" })).toBeDisabled();
  });

  it("does not present fixture counts or claim storage is local-only", () => {
    render(<LivePrivacySection onKnowledge={() => undefined} onSources={() => undefined} onScout={() => undefined} />);
    expect(screen.getByText("Angaben über eure Band und Suche")).toBeVisible();
    expect(screen.getByText("Verbindungen zu euren Portalen")).toBeVisible();
    expect(screen.queryByText("Noch nicht erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText(/lokal speichert|nur lokal/i)).not.toBeInTheDocument();
    expect(screen.getByText(/in der Cloud speichert/)).toBeVisible();
  });
});
