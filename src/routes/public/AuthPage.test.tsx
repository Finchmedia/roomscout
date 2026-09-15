import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { LocaleProvider } from "../../ui/copy";
import { AuthPage } from "./AuthPage";

afterEach(cleanup);

function renderPage(path: string) {
  return render(
    <LocaleProvider>
      <MemoryRouter initialEntries={[path]}>
        <AuthPage />
      </MemoryRouter>
    </LocaleProvider>,
  );
}

describe("AuthPage locale copy", () => {
  it("renders the sign-up introduction in the default English locale", () => {
    renderPage("/sign-up");

    expect(screen.getByText("Your personal RoomScout")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your next rehearsal room starts here." })).toBeVisible();
    expect(screen.getByText("One conversation. One search. Your Scout stays on it.")).toBeVisible();
  });

  it("renders the sign-in introduction in the default English locale", () => {
    renderPage("/sign-in");

    expect(screen.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    expect(screen.getByText("Your search and conversations are waiting for you.")).toBeVisible();
  });
});
