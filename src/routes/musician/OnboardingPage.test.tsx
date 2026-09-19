import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../ui/copy";
import { OnboardingPage } from "./OnboardingPage";

const saveProfile = vi.fn(async () => null);
const currentUser = vi.hoisted(() => ({ value: { _id: "user", username: "login-handle", role: "musician", profileCompleted: false } as unknown }));

vi.mock("convex/react", () => ({
  useQuery: () => currentUser.value,
  useMutation: () => saveProfile,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("OnboardingPage", () => {
  beforeEach(() => {
    currentUser.value = { _id: "user", username: "login-handle", role: "musician", profileCompleted: false };
    saveProfile.mockClear();
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  });

  it("confirms the exact named-band preview and continues to the preserved destination", async () => {
    render(<LocaleProvider><MemoryRouter initialEntries={["/onboarding?returnTo=%2Fapp%2Finbox"]}><Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/app/inbox" element={<h1>Inbox destination</h1>} />
    </Routes></MemoryRouter></LocaleProvider>);

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText(/^Last name \(optional\)/), { target: { value: "Private-Surname" } });
    fireEvent.click(screen.getByRole("radio", { name: /A band/ }));
    fireEvent.change(screen.getByLabelText("Band or artist name (optional)"), { target: { value: "Neon Harbour" } });
    expect(screen.getByText("RoomScout for Neon Harbour")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Confirm profile" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledWith({
      firstName: "Alex",
      lastName: "Private-Surname",
      actKind: "band",
      actName: "Neon Harbour",
      expectedProviderDisplayName: "RoomScout for Neon Harbour",
    }));
    expect(await screen.findByRole("heading", { name: "Inbox destination" })).toBeVisible();
  });

  it("does not trap an operator in musician onboarding", () => {
    currentUser.value = { _id: "operator", username: "ops", role: "operator", profileCompleted: false };
    render(<LocaleProvider><MemoryRouter initialEntries={["/onboarding?returnTo=%2Fops"]}><Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/ops" element={<h1>Operator destination</h1>} />
    </Routes></MemoryRouter></LocaleProvider>);
    expect(screen.getByRole("heading", { name: "Operator destination" })).toBeVisible();
  });

  it("renders the confirmation flow in German from the active locale", () => {
    localStorage.setItem("roomscout.locale", "de");
    render(<LocaleProvider><MemoryRouter initialEntries={["/onboarding"]}><Routes>
      <Route path="/onboarding" element={<OnboardingPage />} />
    </Routes></MemoryRouter></LocaleProvider>);

    expect(screen.getByRole("heading", { name: "Wen vertritt dein Scout?" })).toBeVisible();
    expect(screen.getByLabelText("Vorname")).toBeVisible();
    expect(screen.getByRole("button", { name: "Profil bestätigen" })).toBeDisabled();
  });
});
