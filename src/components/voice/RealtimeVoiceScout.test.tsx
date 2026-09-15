import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { VoiceSessionValue } from "./VoiceSessionContext";
import { RealtimeVoiceScout } from "./RealtimeVoiceScout";

const fixture = vi.hoisted(() => ({ session: {} as VoiceSessionValue }));
vi.mock("./VoiceSessionContext", () => ({
  useVoiceSession: () => fixture.session,
}));

function session(
  overrides: Partial<VoiceSessionValue> = {},
): VoiceSessionValue {
  return {
    provider: "realtime",
    status: "idle",
    modality: "voice",
    muted: false,
    error: undefined,
    transcript: [],
    connectedAt: undefined,
    connected: false,
    volume: 0,
    providerMuted: false,
    connectionState: "disconnected",
    microphoneState: "off",
    userSpeaking: false,
    scoutSpeaking: false,
    backendState: "idle",
    pendingInputCount: 0,
    pendingTextDraft: "",
    sessionLocale: "de",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    setMuted: vi.fn(),
    setModality: vi.fn(),
    sendText: vi.fn().mockReturnValue(true),
    flushPendingInputs: vi.fn().mockResolvedValue(true),
    retryFailedInput: vi.fn().mockReturnValue(false),
    clearPendingTextDraft: vi.fn(),
    interrupt: vi.fn(),
    stopSpeaking: vi.fn(),
    setLanguage: vi.fn(),
    setFocus: vi.fn(),
    appendVerifiedBackgroundUpdate: vi.fn().mockReturnValue(true),
    clearBackgroundUpdate: vi.fn(),
    clearBackgroundUpdates: vi.fn(),
    sendEvent: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  fixture.session = session();
});
afterEach(cleanup);

it("shows one humane default caption and keeps optional content closed", () => {
  render(<RealtimeVoiceScout />);
  expect(screen.getAllByText("Erzähl mir, was ihr sucht.")).toHaveLength(1);
  expect(
    screen.queryByRole("complementary", { name: "Mitschrift" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("Eure Wünsche")).not.toBeInTheDocument();
  expect(
    screen.queryByText(/OpenAI|WebRTC|session ID|provider/i),
  ).not.toBeInTheDocument();
});

it("renders only supplied keyed facts and opens the optional transcript", () => {
  fixture.session = session({
    transcript: [
      { id: "user-1", role: "user", text: "Maximal 350 Euro.", final: true },
    ],
  });
  render(
    <RealtimeVoiceScout
      facts={[{ key: "budget", label: "Budget", value: "Bis 350 € / Monat" }]}
    />,
  );
  expect(screen.getByText("Bis 350 € / Monat")).toBeInTheDocument();
  expect(
    screen.queryByText(/4 Personen|Schlagzeug|Stuttgart/),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Mitschrift öffnen" }));
  const transcript = screen.getByRole("complementary", { name: "Mitschrift" });
  expect(transcript).toBeInTheDocument();
  expect(within(transcript).getByText("Maximal 350 Euro.")).toBeInTheDocument();
});

it("ends an active call and invokes the presentation callback", () => {
  const onEnd = vi.fn();
  fixture.session = session({ connected: true, status: "listening" });
  render(<RealtimeVoiceScout onEnd={onEnd} />);
  fireEvent.click(screen.getByRole("button", { name: "Gespräch beenden" }));
  expect(fixture.session.disconnect).toHaveBeenCalledOnce();
  expect(onEnd).toHaveBeenCalledOnce();
});

it("lets the user cancel startup and mute an active microphone", () => {
  const onEnd = vi.fn();
  fixture.session = session({ status: "connecting" });
  const { rerender } = render(<RealtimeVoiceScout onEnd={onEnd} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Verbindungsaufbau abbrechen" }),
  );
  expect(fixture.session.disconnect).toHaveBeenCalledOnce();
  expect(onEnd).toHaveBeenCalledOnce();
  fixture.session = session({ connected: true, status: "listening" });
  rerender(<RealtimeVoiceScout />);
  fireEvent.click(screen.getByRole("button", { name: "Mikrofon ausschalten" }));
  expect(fixture.session.setMuted).toHaveBeenCalledWith(true);
});

it("sends composed text only while connected", () => {
  fixture.session = session();
  const { rerender } = render(<RealtimeVoiceScout />);
  fireEvent.click(screen.getByRole("button", { name: "Per Text schreiben" }));
  expect(
    screen.getByRole("textbox", { name: "Nachricht an deinen Scout" }),
  ).toBeDisabled();
  fixture.session = session({ connected: true, status: "listening" });
  rerender(<RealtimeVoiceScout />);
  const input = screen.getByRole("textbox", {
    name: "Nachricht an deinen Scout",
  });
  fireEvent.change(input, { target: { value: "Wir suchen mittwochs." } });
  fireEvent.click(screen.getByRole("button", { name: "Nachricht senden" }));
  expect(fixture.session.sendText).toHaveBeenCalledWith(
    "Wir suchen mittwochs.",
  );
  expect(input).toHaveValue("");
});

it("shows the sanitized hook error without technical fallback copy", () => {
  fixture.session = session({
    status: "error",
    error: "Die Sprachverbindung konnte nicht hergestellt werden.",
  });
  render(<RealtimeVoiceScout />);
  expect(
    screen.getByText("Die Sprachverbindung konnte nicht hergestellt werden."),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(/OpenAI|WebRTC|request[_ -]?id|raw body/i),
  ).not.toBeInTheDocument();
});
