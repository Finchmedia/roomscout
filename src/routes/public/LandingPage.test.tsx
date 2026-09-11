import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/ui/copy";

import { LandingPage } from "./LandingPage";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(cleanup);

function renderPage() {
  return render(<MemoryRouter><LocaleProvider><LandingPage /></LocaleProvider></MemoryRouter>);
}

describe("public landing route", () => {
  it("mounts the Claude design-system landing as the real public page", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Ihr macht Musik/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ich kümmere mich darum." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bereit für euren nächsten Proberaum?" })).toBeInTheDocument();
  });

  it("separates the synthetic demo from real start and sign-in destinations", () => {
    renderPage();
    const demoLinks = [
      ...screen.getAllByRole("link", { name: /Demo (starten|ausprobieren)/ }),
      screen.getByRole("link", { name: "Angebot prüfen" }),
    ];
    demoLinks.forEach((link) => expect(link).toHaveAttribute("href", "/design/scout"));
    const primaryLinks = screen.getAllByRole("link").filter((link) => link.dataset.variant === "primary");
    expect(primaryLinks.length).toBeGreaterThan(0);
    primaryLinks.forEach((link) => {
      expect(link).toHaveClass("text-rs-white!", "hover:text-rs-white!");
    });
    expect(screen.getByRole("link", { name: "Suche starten" })).toHaveAttribute("href", "/sign-up?returnTo=%2Fapp%2Fscout");
    expect(screen.getByRole("link", { name: "Anmelden" })).toHaveAttribute("href", "/sign-in?returnTo=%2Fapp%2Fscout");
    expect(screen.getByRole("link", { name: "Öffentlichen Markt ansehen →" })).toHaveAttribute("href", "/explore");
  });

  it("marks the scripted story and offer as examples without live claims", () => {
    renderPage();
    expect(screen.getByText("Interaktive Beispieldemo · synthetische Beispieldaten · es wird nichts versendet.")).toBeInTheDocument();
    expect(screen.getByText("Beispielangebot")).toBeInTheDocument();
    expect(screen.getByText("Beispielsuche · Ablauf verkürzt dargestellt")).toBeInTheDocument();
    expect(screen.getByText("Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter.")).toBeInTheDocument();
  });
});
