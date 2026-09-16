import { fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { VoiceSessionProvider } from "./VoiceSessionProvider";

const runtime = vi.hoisted(() => ({
  started: vi.fn(),
  stopped: vi.fn(),
  disconnect: vi.fn(),
  mute: vi.fn(),
  config: { locale: "de" as "en" | "de" },
  uiLocale: "de" as "en" | "de",
  setUiLocale: vi.fn(),
  live: {
    connected: true,
    muted: false,
    sessionLocale: "de" as "en" | "de",
    backendState: "idle" as "idle" | "queued" | "processing",
    setLanguage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    setMuted: vi.fn(),
  },
}));
vi.mock("../../hooks/useGptLiveVoiceScout", async () => {
  const { useEffect } = await import("react");
  return {
    useGptLiveVoiceScout: () => {
      useEffect(() => {
        runtime.started();
        return () => runtime.stopped();
      }, []);
      return { ...runtime.live, disconnect: runtime.disconnect, setMuted: runtime.mute };
    },
  };
});
vi.mock("convex/react", () => ({
  useQuery: () => runtime.config,
}));
vi.mock("../../ui/copy", () => ({
  useCopy: () => ({
    locale: runtime.uiLocale,
    setLocale: runtime.setUiLocale,
    t: (key: string) => ({
      "liveScout.voice.ongoingCall": "Laufendes Scout-Gespräch",
      "liveScout.voice.returnToScout": "Gespräch läuft · Zum Scout",
      "liveScout.voice.microphoneOn": "Mikrofon einschalten",
      "liveScout.voice.microphoneOff": "Mikrofon stummschalten",
      "liveScout.voice.end": "Gespräch beenden",
    })[key] ?? key,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  runtime.config = { locale: "de" };
  runtime.uiLocale = "de";
  runtime.live.connected = true;
  runtime.live.muted = false;
  runtime.live.sessionLocale = "de";
  runtime.live.backendState = "idle";
});

function renderProvider() {
  return render(
    <MemoryRouter initialEntries={["/app/scout"]}>
      <VoiceSessionProvider><p>Child</p></VoiceSessionProvider>
    </MemoryRouter>,
  );
}

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

it("defers a config echo during processing and lets the request result drive the UI locale", () => {
  runtime.config = { locale: "en" };
  runtime.uiLocale = "en";
  runtime.live.sessionLocale = "en";
  runtime.live.backendState = "processing";
  const view = renderProvider();
  runtime.live.setLanguage.mockClear();
  runtime.setUiLocale.mockClear();

  // The backend persists the request-owned language change before the action
  // result reaches the hook. This config update must not invalidate that turn.
  runtime.config = { locale: "de" };
  view.rerender(
    <MemoryRouter initialEntries={["/app/scout"]}>
      <VoiceSessionProvider><p>Child</p></VoiceSessionProvider>
    </MemoryRouter>,
  );
  expect(runtime.live.setLanguage).not.toHaveBeenCalled();
  expect(runtime.setUiLocale).not.toHaveBeenCalled();

  runtime.live.sessionLocale = "de";
  runtime.live.backendState = "idle";
  view.rerender(
    <MemoryRouter initialEntries={["/app/scout"]}>
      <VoiceSessionProvider><p>Child</p></VoiceSessionProvider>
    </MemoryRouter>,
  );
  expect(runtime.setUiLocale).toHaveBeenCalledWith("de");
  expect(runtime.live.setLanguage).not.toHaveBeenCalled();
});

it("keeps an explicit UI language toggle immediate while a Live request is processing", () => {
  runtime.config = { locale: "en" };
  runtime.uiLocale = "en";
  runtime.live.sessionLocale = "en";
  runtime.live.backendState = "processing";
  const view = renderProvider();
  runtime.live.setLanguage.mockClear();

  runtime.uiLocale = "de";
  view.rerender(
    <MemoryRouter initialEntries={["/app/scout"]}>
      <VoiceSessionProvider><p>Child</p></VoiceSessionProvider>
    </MemoryRouter>,
  );
  expect(runtime.live.setLanguage).toHaveBeenCalledWith("de");
});

it("adopts an independent config language change after pending work settles", () => {
  runtime.config = { locale: "en" };
  runtime.uiLocale = "en";
  runtime.live.sessionLocale = "en";
  runtime.live.backendState = "queued";
  const view = renderProvider();
  runtime.live.setLanguage.mockClear();
  runtime.setUiLocale.mockClear();

  runtime.config = { locale: "de" };
  view.rerender(
    <MemoryRouter initialEntries={["/app/scout"]}>
      <VoiceSessionProvider><p>Child</p></VoiceSessionProvider>
    </MemoryRouter>,
  );
  expect(runtime.live.setLanguage).not.toHaveBeenCalled();

  runtime.live.backendState = "idle";
  view.rerender(
    <MemoryRouter initialEntries={["/app/scout"]}>
      <VoiceSessionProvider><p>Child</p></VoiceSessionProvider>
    </MemoryRouter>,
  );
  expect(runtime.live.setLanguage).toHaveBeenCalledWith("de");
  expect(runtime.setUiLocale).toHaveBeenCalledWith("de");
});
