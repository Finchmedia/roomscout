import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ signedIn: true, role: "musician" }));
vi.mock("@convex-dev/auth/react", () => ({
  Authenticated: ({ children }: { children: ReactNode }) => auth.signedIn ? children : null,
  Unauthenticated: ({ children }: { children: ReactNode }) => auth.signedIn ? null : children,
  AuthLoading: () => null,
}));
vi.mock("convex/react", () => ({ useQuery: () => ({ role: auth.role }) }));
vi.mock("../routes", () => Object.fromEntries([
  "AppExplorePage", "BrowserRunPage", "ExplorePage", "LandingPage", "MapPage",
  "MySearchPage", "OpsAuditPage", "OpsInboxPage", "OpsOutreachPage",
  "OpsOverviewPage", "OpsSignalsPage", "OpsSourcesPage", "ProfilePage", "ScoutPage", "SignalDetailPage",
].map((name) => [name, () => <h1>{name}</h1>])));
vi.mock("../routes/musician/LiveInboxPage", () => ({ LiveInboxPage: () => <h1>Live inbox</h1> }));
vi.mock("../routes/musician/LiveSettingsPage", () => ({ LiveSettingsPage: () => <h1>Live settings</h1> }));
vi.mock("../routes/operator/LiveOperatorPage", () => ({ LiveOperatorPage: () => <h1>Live operator</h1> }));
vi.mock("./AuthRoute", () => ({ AuthRoute: () => <h1>Sign in</h1> }));
vi.mock("../components/voice/VoiceSessionProvider", () => ({ VoiceSessionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock("../ui/gallery/DesignGalleryPage", () => ({ DesignGalleryPage: () => null }));
vi.mock("../ui/landing", () => ({ LandingPage: () => null }));
vi.mock("../ui/operator", () => ({ DemoOperatorPage: () => null }));
vi.mock("../ui/scout", () => ({ DemoScoutPage: () => null }));
vi.mock("../ui/settings/DemoSettingsPage", () => ({ DemoSettingsPage: () => null }));

import { AppRouter } from "./router";

afterEach(cleanup);
beforeEach(() => { auth.signedIn = true; auth.role = "musician"; });
function open(path: string) { window.history.replaceState({}, "", path); render(<AppRouter />); }

describe("live UI routing", () => {
  it("opens live settings, keeping the legacy profile separate", () => {
    open("/app/settings/profile");
    expect(screen.getByRole("heading", { name: "Live settings" })).toBeInTheDocument();
    expect(screen.queryByText("ProfilePage")).not.toBeInTheDocument();
  });
  it("opens Nachrichten at the bare /app/inbox the existing links point at", () => {
    open("/app/inbox");
    expect(screen.getByRole("heading", { name: "Live inbox" })).toBeInTheDocument();
  });
  it("opens Nachrichten on one conversation", () => {
    open("/app/inbox/abc123");
    expect(screen.getByRole("heading", { name: "Live inbox" })).toBeInTheDocument();
  });
  it("protects settings and preserves its return destination", () => {
    auth.signedIn = false;
    open("/app/settings/profile");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("returnTo")).toBe("/app/settings/profile");
  });
  it("denies operator surfaces to a musician", () => {
    open("/ops/integrations");
    expect(screen.queryByText("Live operator")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zum Scout" })).toBeInTheDocument();
  });
  it("opens the ported operator panel for an operator", () => {
    auth.role = "operator";
    open("/ops/activity");
    expect(screen.getByRole("heading", { name: "Live operator" })).toBeInTheDocument();
  });
  it("keeps existing source operations reachable under tools", () => {
    auth.role = "operator";
    open("/ops/tools/sources");
    expect(screen.getByRole("heading", { name: "OpsSourcesPage" })).toBeInTheDocument();
  });
});
