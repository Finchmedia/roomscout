import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageToggle, LocaleProvider } from "../../ui/copy";
import { LiveBillingSection, LivePrivacySection } from "./LiveAccountSections";

function renderGerman(ui: React.ReactNode) {
  localStorage.setItem("roomscout.locale", "de");
  return render(<LocaleProvider>{ui}</LocaleProvider>);
}

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const idleReset = { phase: "idle" as const, deletedDocumentCount: 0, onStart: () => undefined };
const noop = () => undefined;

describe("LiveBillingSection", () => {
  it("switches live billing copy while preserving disabled billing actions", () => {
    localStorage.removeItem("roomscout.locale");
    render(<LocaleProvider><LanguageToggle /><LiveBillingSection /></LocaleProvider>);
    expect(screen.getByRole("heading", { name: "Plan & usage" })).toBeVisible();
    expect(screen.getByRole("button", { name: "View plans" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(screen.getByRole("heading", { name: "Tarif & Nutzung" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tarife ansehen" })).toBeDisabled();
  });

  it("shows no invented usage and keeps unavailable billing controls disabled", () => {
    renderGerman(<LiveBillingSection />);
    expect(screen.getAllByText("Noch nicht erfasst")).toHaveLength(3);
    for (const name of ["Tarife ansehen", "Verwalten", "Hinzufügen"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.queryByText(/September|pro Monat/i)).not.toBeInTheDocument();
  });

  it("shows only explicitly supplied reliable counts", () => {
    renderGerman(<LiveBillingSection activity={{ activeSearches: 1, providersContacted: 2 }} />);
    expect(screen.getByText("1")).toBeVisible(); expect(screen.getByText("2")).toBeVisible();
    expect(screen.getAllByText("Noch nicht erfasst")).toHaveLength(1);
  });
});

describe("LivePrivacySection", () => {
  it("switches live privacy copy and keeps navigation actions working", () => {
    const onKnowledge = vi.fn(), onSources = vi.fn(), onScout = vi.fn();
    localStorage.removeItem("roomscout.locale");
    render(<LocaleProvider><LanguageToggle /><LivePrivacySection onKnowledge={onKnowledge} onSources={onSources} onScout={onScout} reset={idleReset} /></LocaleProvider>);
    expect(screen.getByRole("heading", { name: "Your data, your control" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "View saved details" }));
    expect(onKnowledge).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(screen.getByRole("heading", { name: "Deine Daten, deine Kontrolle" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Portalzugänge verwalten" }));
    expect(onSources).toHaveBeenCalledOnce();
  });

  it("keeps real navigation active and placeholder data actions disabled", () => {
    const onKnowledge = vi.fn(), onSources = vi.fn(), onScout = vi.fn();
    renderGerman(<LivePrivacySection onKnowledge={onKnowledge} onSources={onSources} onScout={onScout} reset={idleReset} />);
    fireEvent.click(screen.getByRole("button", { name: "Gespeicherte Angaben ansehen" }));
    fireEvent.click(screen.getByRole("button", { name: "Portalzugänge verwalten" }));
    fireEvent.click(screen.getByRole("button", { name: "Gespräche ansehen" }));
    expect(onKnowledge).toHaveBeenCalledOnce(); expect(onSources).toHaveBeenCalledOnce(); expect(onScout).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Daten exportieren" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Konto löschen" })).toBeDisabled();
  });

  it("does not present fixture counts or claim storage is local-only", () => {
    renderGerman(<LivePrivacySection onKnowledge={noop} onSources={noop} onScout={noop} reset={idleReset} />);
    expect(screen.getByText("Angaben über eure Band und Suche")).toBeVisible();
    expect(screen.getByText("Verbindungen zu euren Portalen")).toBeVisible();
    expect(screen.queryByText("Noch nicht erfasst")).not.toBeInTheDocument();
    expect(screen.queryByText(/lokal speichert|nur lokal/i)).not.toBeInTheDocument();
    expect(screen.getByText(/in der Cloud speichert/)).toBeVisible();
  });

  it("offers the demo reset behind a confirmation and projects its progress", () => {
    const onStart = vi.fn();
    localStorage.removeItem("roomscout.locale");
    const section = (phase: "idle" | "running" | "done", deletedDocumentCount = 0) =>
      <LocaleProvider><LivePrivacySection onKnowledge={noop} onSources={noop} onScout={noop} reset={{ phase, deletedDocumentCount, onStart }} /></LocaleProvider>;
    const view = render(section("idle"));
    expect(screen.getByText("Reset search and conversations")).toBeVisible();
    expect(screen.getByText(/Your account, profile, portal registration, mailbox and settings stay\./)).toBeVisible();
    // The danger action asks first; cancelling starts nothing.
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Reset search and conversations?")).toBeVisible();
    expect(screen.getByText(/This cannot be undone\./)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset now" }));
    expect(onStart).toHaveBeenCalledOnce();
    // Progress and completion replace the action while the backend works.
    view.rerender(section("running", 12));
    expect(screen.getByRole("button", { name: "Resetting … 12 deleted" })).toBeDisabled();
    view.rerender(section("done", 14));
    expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
  });

  it("localizes the demo reset row", () => {
    renderGerman(<LivePrivacySection onKnowledge={noop} onSources={noop} onScout={noop} reset={idleReset} />);
    expect(screen.getByText("Suche und Unterhaltungen zurücksetzen")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));
    expect(screen.getByText("Suche und Unterhaltungen zurücksetzen?")).toBeVisible();
    expect(screen.getByRole("button", { name: "Jetzt zurücksetzen" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Abbrechen" })).toBeVisible();
  });
});
