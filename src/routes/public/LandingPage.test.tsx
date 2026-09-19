import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/ui/copy";

import { LandingPage } from "./LandingPage";

const authState = vi.hoisted(() => ({ isAuthenticated: false, isLoading: false }));
const mediaState = vi.hoisted(() => ({ matches: false }));

vi.mock("convex/react", () => ({ useConvexAuth: () => authState }));

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      get matches() { return mediaState.matches; },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
});

afterEach(cleanup);
beforeEach(() => {
  authState.isAuthenticated = false;
  authState.isLoading = false;
  mediaState.matches = false;
});

function renderPage() {
  return render(<MemoryRouter><LocaleProvider><LandingPage /></LocaleProvider></MemoryRouter>);
}

describe("public landing route", () => {
  it("separates the synthetic demo from real start and sign-in destinations", () => {
    renderPage();
    const demoLinks = [
      ...screen.getAllByRole("link", { name: /Start demo|Try the demo/ }),
      screen.getByRole("link", { name: "Review offer" }),
    ];
    demoLinks.forEach((link) => expect(link).toHaveAttribute("href", "/design/scout"));
    expect(screen.getByRole("link", { name: "Start searching" })).toHaveAttribute("href", "/sign-up?returnTo=%2Fapp%2Fscout");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?returnTo=%2Fapp%2Fscout");
    expect(screen.getAllByRole("link", { name: "How it works" }).some((link) => link.getAttribute("href") === "/#how")).toBe(true);
    expect(document.querySelector('a[href="/explore"]')).not.toBeInTheDocument();
  });

  it("moves from a neutral loading action to the authenticated Scout actions and back to guest actions", () => {
    authState.isLoading = true;
    const page = renderPage();

    expect(screen.getByRole("link", { name: "Go to Scout" })).toHaveAttribute("href", "/app/scout");
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();

    authState.isLoading = false;
    authState.isAuthenticated = true;
    page.rerender(<MemoryRouter><LocaleProvider><LandingPage /></LocaleProvider></MemoryRouter>);
    const scoutLinks = screen.getAllByRole("link", { name: "Go to Scout" });
    expect(scoutLinks).toHaveLength(2);
    scoutLinks.forEach((link) => expect(link).toHaveAttribute("href", "/app/scout"));

    authState.isAuthenticated = false;
    page.rerender(<MemoryRouter><LocaleProvider><LandingPage /></LocaleProvider></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Start searching" })).toHaveAttribute("href", "/sign-up?returnTo=%2Fapp%2Fscout");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?returnTo=%2Fapp%2Fscout");
  });

  it("keeps the authenticated Scout action reachable from the mobile menu", () => {
    authState.isAuthenticated = true;
    mediaState.matches = true;
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "How it works · Your Scout" }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Go to Scout" })).toHaveAttribute("href", "/app/scout");
  });

  it("marks the scripted story and offer as examples without live claims", () => {
    renderPage();
    expect(screen.getByText("Interactive sample demo · synthetic data · nothing will be sent.")).toBeInTheDocument();
    expect(screen.getByText("Sample offer")).toBeInTheDocument();
    expect(screen.getByText("Sample search · flow shortened for the demo")).toBeInTheDocument();
    expect(screen.getByText("Currently a controlled demo. No inquiries to third-party providers.")).toBeInTheDocument();
    expect(screen.getByText("0 real rehearsal rooms found")).toBeInTheDocument();
    expect(screen.getByText(/currently no real rehearsal rooms listed here/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try fictional rooms in Berlin →" })).toHaveAttribute("href", "/sign-up?returnTo=%2Fapp%2Fscout");
  });
});
