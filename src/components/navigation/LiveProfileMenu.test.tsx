import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveProfileMenu } from "./LiveProfileMenu";

const auth = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => auth }));
afterEach(cleanup);
beforeEach(() => auth.signOut.mockClear());

function openMenu(operator = false) {
  render(<MemoryRouter><LiveProfileMenu name="Test Band" operator={operator} /></MemoryRouter>);
  fireEvent.keyDown(screen.getByRole("button", { name: "Profilmenü" }), { key: "Enter" });
}

describe("live profile navigation", () => {
  it("keeps settings and messages reachable without showing operator access", () => {
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Einstellungen" })).toHaveAttribute("href", "/app/settings");
    expect(screen.getByRole("menuitem", { name: "Nachrichten" })).toHaveAttribute("href", "/app/inbox");
    expect(screen.queryByRole("menuitem", { name: "Betreiberansicht" })).not.toBeInTheDocument();
  });
  it("shows the operator entry only for the supplied authenticated role", () => {
    openMenu(true);
    expect(screen.getByRole("menuitem", { name: "Betreiberansicht" })).toHaveAttribute("href", "/ops");
  });
  it("uses real sign out only on the user action", async () => {
    openMenu();
    expect(auth.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("menuitem", { name: "Abmelden" }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledOnce());
  });
});
