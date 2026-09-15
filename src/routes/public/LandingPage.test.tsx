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
    expect(screen.getByRole("heading", { name: /You make the music/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "I’m on it." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ready to find your next rehearsal room?" })).toBeInTheDocument();
  });

  it("separates the synthetic demo from real start and sign-in destinations", () => {
    renderPage();
    const demoLinks = [
      ...screen.getAllByRole("link", { name: /Start demo|Try the demo/ }),
      screen.getByRole("link", { name: "Review offer" }),
    ];
    demoLinks.forEach((link) => expect(link).toHaveAttribute("href", "/design/scout"));
    const primaryLinks = screen.getAllByRole("link").filter((link) => link.dataset.variant === "primary");
    expect(primaryLinks.length).toBeGreaterThan(0);
    primaryLinks.forEach((link) => {
      expect(link).toHaveClass("text-rs-white!", "hover:text-rs-white!");
    });
    expect(screen.getByRole("link", { name: "Start searching" })).toHaveAttribute("href", "/sign-up?returnTo=%2Fapp%2Fscout");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?returnTo=%2Fapp%2Fscout");
    expect(screen.getByRole("link", { name: "Explore the public market →" })).toHaveAttribute("href", "/explore");
  });

  it("marks the scripted story and offer as examples without live claims", () => {
    renderPage();
    expect(screen.getByText("Interactive sample demo · synthetic data · nothing will be sent.")).toBeInTheDocument();
    expect(screen.getByText("Sample offer")).toBeInTheDocument();
    expect(screen.getByText("Sample search · flow shortened for the demo")).toBeInTheDocument();
    expect(screen.getByText("Currently a controlled demo. No inquiries to third-party providers.")).toBeInTheDocument();
  });
});
