import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { de } from "../../ui/copy/de";
import { en } from "../../ui/copy/en";
import { LocaleCtx, type Locale } from "../../ui/copy/LocaleProvider";
import { WorkspaceShell } from "./WorkspaceShell";

const auth = vi.hoisted(() => ({ signOut: vi.fn().mockResolvedValue(undefined) }));
const queries = vi.hoisted(() => ({
  current: "users.current",
  inbox: "inbox.listThreadsMine",
  matches: "matches.listMine",
  outreach: "outreach.listMine",
  ops: "ops.navCounts",
}));

vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => auth }));
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    users: { current: queries.current },
    inbox: { listThreadsMine: queries.inbox },
    matches: { listMine: queries.matches },
    outreach: { listMine: queries.outreach },
    ops: { navCounts: queries.ops },
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (query: string) => query === queries.current
    ? { displayName: "Test Band", role: "operator" }
    : [],
}));

afterEach(cleanup);

function renderShell(locale: Locale) {
  const dict = locale === "en" ? en : de;
  render(
    <LocaleCtx.Provider value={{ locale, dict, availableLocales: ["en", "de"], setLocale: vi.fn() }}>
      <MemoryRouter initialEntries={["/app/scout"]}>
        <WorkspaceShell mode="musician"><p>Workspace content</p></WorkspaceShell>
      </MemoryRouter>
    </LocaleCtx.Provider>,
  );
  fireEvent.click(screen.getByLabelText(locale === "en" ? "Profile menu" : "Profilmenü"));
}

describe("musician workspace navigation locale", () => {
  it.each([
    ["en", "RoomScout and account", ["Scout", "Your search", "Messages", "Settings", "Operator view", "Sign out"]],
    ["de", "RoomScout und Konto", ["Scout", "Euer Suchauftrag", "Nachrichten", "Einstellungen", "Betreiberansicht", "Abmelden"]],
  ] as const)("renders the %s account navigation in the selected language", (locale, navigationName, labels) => {
    renderShell(locale);

    const navigation = screen.getByRole("navigation", { name: navigationName });
    for (const label of labels) expect(within(navigation).getByText(label)).toBeInTheDocument();
    expect(navigation.querySelector('a[href="/app/explore"]')).not.toBeInTheDocument();
    expect(navigation.querySelector('a[href="/app/map"]')).not.toBeInTheDocument();
    expect(within(navigation).getByText(locale === "en" ? "Your personal Scout" : "Dein persönlicher Scout")).toBeInTheDocument();
  });
});
