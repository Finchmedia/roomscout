import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../ui/copy";

const auth = vi.hoisted(() => ({ user: { role: "musician", profileCompleted: false } as unknown }));

vi.mock("@convex-dev/auth/react", () => ({
  Authenticated: ({ children }: { children: ReactNode }) => children,
  Unauthenticated: () => null,
  AuthLoading: () => null,
}));
vi.mock("@convex-dev/auth/providers/password/react", () => ({
  useSignInWithPassword: () => ({ signIn: vi.fn(), pending: false }),
  useSignUpWithPassword: () => ({ signUp: vi.fn(), pending: false }),
}));
vi.mock("convex/react", () => ({ useQuery: () => auth.user }));

import { AuthRoute } from "./AuthRoute";

function Destination({ title }: { title: string }) {
  const location = useLocation();
  return <><h1>{title}</h1><output>{location.search}</output></>;
}

afterEach(cleanup);
beforeEach(() => { auth.user = { role: "musician", profileCompleted: false }; });

describe("AuthRoute", () => {
  it("sends an incomplete musician to onboarding with the original destination", () => {
    render(<LocaleProvider><MemoryRouter initialEntries={["/sign-in?returnTo=%2Fapp%2Finbox"]}><Routes>
      <Route path="/sign-in" element={<AuthRoute />} />
      <Route path="/onboarding" element={<Destination title="Onboarding" />} />
    </Routes></MemoryRouter></LocaleProvider>);
    expect(screen.getByRole("heading", { name: "Onboarding" })).toBeVisible();
    expect(screen.getByText("?returnTo=%2Fapp%2Finbox")).toBeVisible();
  });

  it("returns a complete musician to the requested app page", () => {
    auth.user = { role: "musician", profileCompleted: true };
    render(<LocaleProvider><MemoryRouter initialEntries={["/sign-in?returnTo=%2Fapp%2Finbox"]}><Routes>
      <Route path="/sign-in" element={<AuthRoute />} />
      <Route path="/app/inbox" element={<h1>Inbox</h1>} />
    </Routes></MemoryRouter></LocaleProvider>);
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeVisible();
  });
});
