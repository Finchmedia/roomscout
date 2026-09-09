import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { VoiceSessionProvider } from "./VoiceSessionProvider";

const runtime = vi.hoisted(() => ({
  started: vi.fn(),
  stopped: vi.fn(),
  disconnect: vi.fn(),
  mute: vi.fn(),
}));
vi.mock("../../hooks/useRealtimeVoiceScout", async () => {
  const { useEffect } = await import("react");
  return {
    useRealtimeVoiceScout: () => {
      useEffect(() => {
        runtime.started();
        return () => runtime.stopped();
      }, []);
      return {
        connected: true,
        muted: false,
        disconnect: runtime.disconnect,
        setMuted: runtime.mute,
      };
    },
  };
});

beforeEach(() => vi.clearAllMocks());

it("keeps one session mounted across Scout, settings and the authenticated map", () => {
  const { unmount } = render(
    <MemoryRouter initialEntries={["/app/scout"]}>
      <Routes>
        <Route
          element={
            <VoiceSessionProvider>
              <Outlet />
            </VoiceSessionProvider>
          }
        >
          <Route
            path="/app/scout"
            element={<Link to="/app/settings/sources">Settings</Link>}
          />
          <Route
            path="/app/settings/sources"
            element={<Link to="/app/map">Map</Link>}
          />
          <Route path="/app/map" element={<p>The map</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  expect(runtime.started).toHaveBeenCalledOnce();
  expect(
    screen.queryByLabelText("Laufendes Scout-Gespräch"),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Settings"));
  expect(screen.getByLabelText("Laufendes Scout-Gespräch")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Mikrofon stummschalten" }),
  );
  expect(runtime.mute).toHaveBeenCalledWith(true);
  fireEvent.click(screen.getByText("Map"));
  expect(screen.getByText("The map")).toBeInTheDocument();
  expect(runtime.started).toHaveBeenCalledOnce();
  expect(runtime.stopped).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Gespräch beenden" }));
  expect(runtime.disconnect).toHaveBeenCalledOnce();
  unmount();
  expect(runtime.stopped).toHaveBeenCalledOnce();
});
