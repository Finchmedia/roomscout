import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { LandingPage } from "./LandingPage";
import { factsAtStage } from "../../components/landing/landingStoryModel";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
});

afterEach(cleanup);

it("links the primary landing actions to the real Scout", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Mittwoch passt" }));
  expect(screen.getAllByRole("link", { name: /Demo (starten|ausprobieren|öffnen)/ })).toHaveLength(4);
  screen.getAllByRole("link", { name: /Demo (starten|ausprobieren|öffnen)/ }).forEach((link) => expect(link).toHaveAttribute("href", "/app/scout"));
});

it("labels the marketing story and offer as illustrative demo content", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  expect(screen.getByLabelText("Illustrierter Demo-Ablauf: Suchauftrag")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mittwoch passt" }));
  expect(screen.getByText("Illustratives Beispielangebot")).toBeInTheDocument();
  expect(screen.getByText(/Keine echte Anzeige/)).toBeInTheDocument();
});

it("reveals facts in speech order and replaces the earlier budget", () => {
  expect(factsAtStage(1).map((fact) => fact.label)).toEqual(["Stuttgart & Umgebung", "Geteilter Raum · 4 Personen"]);
  expect(factsAtStage(2).map((fact) => fact.label)).toContain("Bis 400 € / Monat");
  const finalFacts = factsAtStage(4);
  expect(finalFacts.filter((fact) => fact.id === "budget")).toEqual([{ id: "budget", label: "Bis 350 € / Monat" }]);
  expect(finalFacts.map((fact) => fact.label)).not.toContain("Bis 400 € / Monat");
});

it("rejecting Wednesday continues the search and removes the incompatible offer", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Donnerstag bleibt wichtig" }));
  expect(screen.getByText("Donnerstag bleibt gesetzt.")).toBeInTheDocument();
  expect(screen.getByText(/Beispielraum in Stuttgart-West ist verworfen/)).toBeInTheDocument();
  expect(screen.queryByText("Mittwochs, 19–22 Uhr")).not.toBeInTheDocument();
});

it("supports decision and FAQ interactions", () => {
  render(<MemoryRouter><LandingPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: "Mittwoch passt" }));
  expect(screen.getByText("Mittwoch passt auch.")).toBeInTheDocument();
  const portalQuestion = screen.getByRole("button", { name: /Funktioniert das schon auf allen Portalen/ });
  fireEvent.click(portalQuestion);
  expect(portalQuestion).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByText(/kontrollierte Demo zeigt einen begrenzten Ablauf/)).toBeInTheDocument();
});
