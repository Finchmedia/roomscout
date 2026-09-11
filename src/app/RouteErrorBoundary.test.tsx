import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function BrokenPage(): never { throw new Error("private server diagnostic"); }

function StatefulSettingsShell() {
  const [count, setCount] = useState(0);
  const location = useLocation();
  return <><p>{location.pathname}</p><p>Count {count}</p><button onClick={() => setCount((value) => value + 1)}>Increment</button><Link to="/app/settings/profile">Profile</Link></>;
}

describe("route error recovery", () => {
  it("renders healthy content unchanged", () => {
    render(<MemoryRouter><RouteErrorBoundary><h1>Scout</h1></RouteErrorBoundary></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Scout" })).toBeInTheDocument();
  });

  it("preserves healthy route state across nested navigation", () => {
    render(<MemoryRouter initialEntries={["/app/settings/sources"]}><RouteErrorBoundary><StatefulSettingsShell /></RouteErrorBoundary></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Increment" }));
    fireEvent.click(screen.getByRole("link", { name: "Profile" }));
    expect(screen.getByText("/app/settings/profile")).toBeInTheDocument();
    expect(screen.getByText("Count 1")).toBeInTheDocument();
  });

  it("replaces a failed view with safe copy and recovers on navigation", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<MemoryRouter initialEntries={["/broken"]}><RouteErrorBoundary><Routes>
      <Route path="/broken" element={<BrokenPage />} />
      <Route path="/" element={<h1>Startseite</h1>} />
    </Routes></RouteErrorBoundary></MemoryRouter>);
    expect(screen.getByRole("alert")).toHaveTextContent("Deine gespeicherten Daten bleiben erhalten");
    expect(screen.queryByText("private server diagnostic")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Erneut laden" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Zur Startseite" }));
    expect(screen.getByRole("heading", { name: "Startseite" })).toBeInTheDocument();
  });
});
