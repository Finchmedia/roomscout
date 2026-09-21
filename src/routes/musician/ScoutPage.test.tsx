import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { ConvexError } from "convex/values";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { de } from "../../ui/copy/de";
import { splitLiveAppendContent } from "../../hooks/useGptLiveVoiceScout";
import { LocaleCtx } from "../../ui/copy/LocaleProvider";
import { ScoutPage } from "./ScoutPage";

const fixtures = vi.hoisted(() => ({
  user: { username: "test-band", displayName: "Test Band", role: "musician", profileCompleted: true } as Record<string, unknown>,
  needs: [] as Array<Record<string, unknown>>,
  context: {} as Record<string, unknown>,
  matches: [] as Array<Record<string, unknown>>,
  indexed: [] as Array<Record<string, unknown>>,
  conversations: [] as Array<Record<string, unknown>>,
  focusedThread: null as Record<string, unknown> | null,
  focusedSignal: null as Record<string, unknown> | null,
  /** `api.conversations.listMine` — the rows behind the „Kandidaten“ rail. */
  inbox: [] as Array<Record<string, unknown>>,
  actions: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  decisions: [] as Array<Record<string, unknown>>,
  queries: vi.fn(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  actionFns: new Map<string, ReturnType<typeof vi.fn>>(),
  voice: { connected: false, status: "idle" as "idle" | "requesting_microphone" | "connecting" | "creating_session", muted: false, connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn(), setMuted: vi.fn(),
    sendText: vi.fn().mockReturnValue(true), setFocus: vi.fn(), appendVerifiedBackgroundUpdate: vi.fn(), clearBackgroundUpdate: vi.fn(),
    pendingTextDraft: "", clearPendingTextDraft: vi.fn(), noteActivity: vi.fn(),
    backendState: "idle" as "idle" | "queued" | "processing" },
}));

function mutation(name: string) {
  const cached = fixtures.mutations.get(name);
  if (cached) return cached;
  const fn = vi.fn().mockResolvedValue(null);
  // `api.scout.send` is wired through `.withOptimisticUpdate(...)`; the update
  // itself is the Agent's helper and is mocked to the identity below.
  Object.assign(fn, { withOptimisticUpdate: () => fn });
  fixtures.mutations.set(name, fn);
  return fn;
}

/** A row as `api.scout.listMessages` returns it (and as the stream materialises it). */
function message(options: {
  role: "user" | "assistant" | "system";
  text?: string;
  status?: "streaming" | "pending" | "success" | "failed";
  order: number;
  parts?: Array<Record<string, unknown>>;
  source?: "voice_transcript";
}) {
  const { role, text = "", status = "success", order, parts, source } = options;
  return {
    key: `thread-${order}-0`, role, text, status, order, stepOrder: 0,
    parts: parts ?? (text ? [{ type: "text", text }] : []),
    _creationTime: order, createdAt: order, source,
  };
}

function action(name: string) {
  const fn = fixtures.actionFns.get(name) ?? vi.fn().mockResolvedValue(null);
  fixtures.actionFns.set(name, fn);
  return fn;
}

function need(status: "draft" | "active" | "paused" = "draft") {
  return {
    _id: "need-current", title: "Current band search", city: "Stuttgart",
    locationQuery: "Stuttgart", locationLabel: "Stuttgart", radiusKm: 20,
    maxBudgetEur: 350, requirements: [], schedule: [], arrangement: ["shared"],
    openToSharing: true, collaborationOpen: false, status,
  };
}

function providerConversation(options: {
  current?: boolean; ready?: boolean; revision?: number; accepted?: boolean;
} = {}) {
  const { current = true, ready = true, revision = 2, accepted = false } = options;
  return {
    conversationId: `conversation-${revision}`, savedNeedId: "need-current",
    signalId: "signal-provider", platformThreadId: "provider-thread",
    isDemo: true, providerSimulation: "ai_simulated",
    state: ready ? "ready" : "needs_attention", revision, updatedAt: revision,
    assessmentFromProviderReply: true,
    ...(accepted ? { acceptedOfferId: "offer-provider", acceptedAt: 10, acceptanceStatus: "executed" } : {}),
    offer: {
      offerId: "offer-provider", revision, current, ready,
      contentHash: `offer-hash-${revision}`,
      blockers: ready ? [] : ["Bitte bestätigt noch die Nutzungszeiten."],
      assessment: {
        summary: ready ? "Der Anbieter hat Verfügbarkeit, Preis und Bedingungen bestätigt." : "Der Anbieter hat geantwortet, aber eine Bedingung ist noch offen.",
        availability: { status: "available", evidence: [] },
        monthlyPrice: { totalEur: 240, allRecurringCostsKnown: ready, evidence: [] },
        terms: [], constraints: [], uncertainties: ready ? [] : ["Welche Nutzungszeiten gelten?"],
        contradictions: [], nextAction: ready ? "review_offer" : "ask_provider", suggestedReply: null,
      },
    },
  };
}

/** A row as `api.conversations.listMine` returns it — the rail reads these. */
function candidate(options: {
  id: string; savedNeedId?: string; title?: string;
  state?: "waiting" | "thinking" | "needs_attention" | "offer_ready" | "closed";
  unread?: boolean; at?: number; openDecision?: boolean;
}) {
  const {
    id, savedNeedId = "need-current", title = `Raum ${id}`, state = "waiting",
    unread = false, at = 1_000, openDecision = false,
  } = options;
  return {
    conversationId: id, savedNeedId, signalId: `signal-${id}`, title, subtitle: "Proberaum",
    channel: "email", state, revision: 1, lastActivityAt: at, unread, providerLabel: "Anbieter",
    ...(openDecision
      ? { openDecision: { decisionId: `decision-${id}`, kind: "scout_question", question: "Passt der Termin?" } }
      : {}),
  };
}

/** The open Entscheidung the working stage blocks on, with two prepared answers. */
function reviewDecision() {
  return {
    _id: "decision-1", kind: "review_message", status: "open",
    question: "Soll ich diese Nachricht so senden?", detail: "Hallo, ist der Raum noch frei?",
    options: [{ id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" }],
    refs: { requestId: "send-1" }, conversationId: "conversation-2", createdAt: 1, updatedAt: 1,
  };
}

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref);
    fixtures.queries(name, args);
    if (name === "users:current") return fixtures.user;
    if (name === "savedNeeds:listMine") return fixtures.needs;
    if (name === "scout:getMine") return fixtures.context;
    if (name === "matches:listMine") return fixtures.matches;
    if (name === "matches:listCandidatesMine") return fixtures.indexed;
    if (name === "providerConversations:listMine") return fixtures.conversations;
    if (name === "conversations:listMine") return fixtures.inbox;
    if (name === "conversations:getMine") return args === "skip" ? null : fixtures.focusedThread;
    if (name === "signals:get") return args === "skip" ? null : fixtures.focusedSignal;
    if (name === "externalActions:listMine") return fixtures.actions;
    if (name === "decisions:listOpenMine") return fixtures.decisions;
    return null;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => mutation(getFunctionName(ref)),
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => action(getFunctionName(ref)),
  usePaginatedQuery: () => ({ results: fixtures.messages, status: "Exhausted", loadMore: vi.fn() }),
}));

// The thread is the only source of chat state: the page reads it through
// `useUIMessages`, so the fixtures are the messages the server would hold.
vi.mock("@convex-dev/agent/react", () => ({
  useUIMessages: () => ({ results: fixtures.messages, status: "Exhausted", isLoading: false, loadMore: vi.fn() }),
  optimisticallySendMessage: () => vi.fn(),
  useSmoothText: (text: string) => [text, { cursor: text.length, isStreaming: false }],
}));

vi.mock("../../ui/chat/LiveVoiceChat", () => ({
  LiveVoiceChat: ({ compact, primary, showTranscript, onText, onEnd }: { compact?: boolean; primary?: boolean; showTranscript?: boolean; onText?: () => void; onEnd?: () => void }) => (
    <div data-compact={compact || undefined} data-primary={primary || undefined} data-show-transcript={showTranscript} data-testid="voice-session">
      Voice Scout session<button onClick={onText}>Zum Schreiben wechseln</button><button onClick={onEnd}>Anruf beenden</button>
    </div>
  ),
}));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn() }) }));
vi.mock("../../components/voice/VoiceSessionContext", () => ({ useVoiceSession: () => fixtures.voice }));

function renderPage() { return render(<MemoryRouter><ScoutPage /></MemoryRouter>); }

afterEach(cleanup);
beforeEach(() => {
  fixtures.user = { username: "test-band", displayName: "Test Band", role: "musician", profileCompleted: true };
  fixtures.needs = [need()];
  fixtures.context = { threadId: "thread", activeNeedId: "need-current", mode: "search_discovery" };
  fixtures.indexed = []; fixtures.matches = []; fixtures.conversations = []; fixtures.focusedThread = null; fixtures.focusedSignal = null; fixtures.inbox = []; fixtures.actions = []; fixtures.messages = []; fixtures.decisions = [];
  fixtures.queries.mockClear(); fixtures.mutations.clear(); fixtures.actionFns.clear();
  fixtures.voice.connected = false;
  fixtures.voice.status = "idle";
  fixtures.voice.backendState = "idle";
  fixtures.voice.muted = false;
  fixtures.voice.connect.mockClear(); fixtures.voice.disconnect.mockClear(); fixtures.voice.sendText.mockClear();
  fixtures.voice.setMuted.mockClear();
  fixtures.voice.noteActivity.mockClear();
  fixtures.voice.setFocus.mockClear(); fixtures.voice.appendVerifiedBackgroundUpdate.mockClear(); fixtures.voice.clearBackgroundUpdate.mockClear();
});

describe("live Scout route", () => {
  it("keeps saved Scout state readable while an incomplete profile gets a clear completion path", () => {
    fixtures.user = { username: "login-handle", role: "musician", profileCompleted: false };
    renderPage();
    expect(screen.getByText("Vervollständige dein Musikerprofil, bevor dein Scout Anbieter kontaktiert.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Profil vervollständigen" })).toHaveAttribute("href", "/onboarding?returnTo=%2Fapp%2Fscout");
    expect(screen.getByRole("heading", { name: "Finden wir euren Proberaum." })).toBeVisible();
  });
  it("queries matches only for the Scout context's selected need", () => {
    fixtures.needs = [need(), { ...need(), _id: "need-other", locationQuery: "Berlin" }];
    renderPage();
    expect(fixtures.queries).toHaveBeenCalledWith("matches:listMine", { savedNeedId: "need-current", limit: 30 });
    expect(fixtures.queries).toHaveBeenCalledWith("providerConversations:listMine", { savedNeedId: "need-current", limit: 50 });
    expect(fixtures.queries).toHaveBeenCalledWith("externalActions:listMine", { savedNeedId: "need-current", limit: 50 });
    expect(fixtures.queries.mock.calls.some(([name]) => name === "signals:list")).toBe(false);
  });

  it("opens a ready brief automatically without activating the search", () => {
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    renderPage();
    expect(screen.getByRole("heading", { name: "So suche ich für euch." })).toBeInTheDocument();
    expect(screen.getByText(/Euer Suchauftrag ist bereit/)).toHaveAttribute("role", "status");
    expect(mutation("savedNeeds:activate")).not.toHaveBeenCalled();
  });

  it("does not leave a completed silent Live turn busy without an assistant message", () => {
    fixtures.voice.connected = true;
    fixtures.voice.backendState = "idle";
    fixtures.needs = [{ ...need(), matchingRevision: 3 }];
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    fixtures.messages = [message({ role: "user", text: "Twenty kilometres is fine.", order: 0 })];
    renderPage();
    expect(document.querySelector("[data-live-scout-stage]")).toHaveAttribute("data-live-scout-stage", "brief");
    expect(screen.getByRole("button", { name: "Scout losschicken" })).toBeEnabled();
    expect(screen.queryByText("Dein Scout denkt nach …")).not.toBeInTheDocument();
  });

  it("uses an empty successful assistant marker as an invisible durable silent-turn boundary", () => {
    fixtures.needs = [{ ...need(), matchingRevision: 3 }];
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    fixtures.messages = [
      message({ role: "user", text: "Twenty kilometres is fine.", order: 0 }),
      message({ role: "assistant", text: "", status: "success", order: 1 }),
    ];
    renderPage();
    expect(screen.getByRole("heading", { name: "So suche ich für euch." })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Dein Scout" })).not.toBeInTheDocument();
    expect(screen.queryByText("Dein Scout denkt nach …")).not.toBeInTheDocument();
  });

  it("treats a persisted Live user transcript as conversation history, not pending work", () => {
    fixtures.needs = [{ ...need(), matchingRevision: 3 }];
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    fixtures.messages = [
      message({ role: "user", text: "Twenty kilometres is fine.", source: "voice_transcript", order: 0 }),
    ];
    renderPage();
    expect(screen.getByRole("button", { name: "Scout losschicken" })).toBeEnabled();
    expect(screen.queryByText("Dein Scout denkt nach …")).not.toBeInTheDocument();
  });

  it("dismisses the current ready event for editing but opens a later ready revision", () => {
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Noch etwas ändern" }));
    expect(screen.queryByRole("heading", { name: "So suche ich für euch." })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    fixtures.context.briefReadiness = { status: "ready", needRevision: 4, readyAt: 200 };
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "So suche ich für euch." })).toBeInTheDocument();
  });

  it("activates only after the explicit brief action", async () => {
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    renderPage();
    const enable = mutation("savedNeeds:activate");
    expect(enable).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Scout losschicken" }));
    await waitFor(() => expect(enable).toHaveBeenCalledWith({ savedNeedId: "need-current" }));
  });

  it("lets the user open chat directly from the ready brief", () => {
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "So suche ich für euch." })).not.toBeInTheDocument();
    expect(mutation("savedNeeds:activate")).not.toHaveBeenCalled();
  });

  it("keeps voice connected when opening text and leaves route lifecycle to the provider", () => {
    fixtures.voice.connected = true;
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Zum Schreiben wechseln" }));
    expect(fixtures.voice.disconnect).not.toHaveBeenCalled();
    expect(fixtures.voice.setMuted).not.toHaveBeenCalled();
    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-show-transcript", "false");
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-show-transcript", "true");
    fireEvent.click(screen.getByRole("button", { name: "Zum Schreiben wechseln" }));
    fireEvent.click(screen.getByRole("button", { name: "Mit Scout sprechen" }));
    expect(screen.getByTestId("voice-session")).toBeInTheDocument();
    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-show-transcript", "true");
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    view.unmount();
    expect(fixtures.voice.disconnect).not.toHaveBeenCalled();
  });

  it("returns to the normal Scout when the voice call ends", () => {
    fixtures.voice.connected = true;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Anruf beenden" }));
    expect(screen.queryByTestId("voice-session")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mit Scout sprechen" })).toBeInTheDocument();
  });

  it("keeps one compact voice shell before and after connection", () => {
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Mit Scout sprechen" }));

    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-compact", "true");
    expect(screen.getByRole("group", { name: "Euer Suchauftrag" })).toBeInTheDocument();

    fixtures.voice.connected = true;
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);

    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-compact", "true");
    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-primary", "true");
    expect(screen.getByRole("group", { name: "Euer Suchauftrag" })).toBeInTheDocument();
  });

  it("uses the compact transparent voice layout while the session initializes", () => {
    fixtures.voice.status = "creating_session";
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Mit Scout sprechen" }));
    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-compact", "true");
    expect(screen.getByTestId("voice-session")).toHaveAttribute("data-primary", "true");
  });

  it("keeps persisted chat history out of the active voice composition", () => {
    fixtures.voice.connected = true;
    fixtures.messages = [message({ role: "assistant", text: "Persisted Scout reply", order: 1 })];
    renderPage();
    expect(screen.getByTestId("voice-session")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    expect(screen.queryByText("Persisted Scout reply")).not.toBeInTheDocument();
  });

  it("explains a missing normalized radius and keeps legacy city-only drafts activatable", async () => {
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    fixtures.needs = [{ ...need(), radiusKm: undefined }];
    const view = renderPage();
    expect(screen.getByRole("button", { name: "Scout losschicken" })).toBeDisabled();
    expect(screen.getByText("Ergänzt einen Suchradius, bevor ihr den Scout losschickt.")).toHaveAttribute("role", "status");

    fixtures.needs = [{ ...need(), locationQuery: undefined, locationLabel: undefined, radiusKm: undefined }];
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    const activateButton = screen.getByRole("button", { name: "Scout losschicken" });
    expect(activateButton).toBeEnabled();
    fireEvent.click(activateButton);
    await waitFor(() => expect(mutation("savedNeeds:activate")).toHaveBeenCalledWith({ savedNeedId: "need-current" }));
  });

  it("shows the current ready provider offer ahead of stale progress", () => {
    fixtures.needs = [need("active")];
    fixtures.actions = [{ _id: "old-send", savedNeedId: "need-current", requestedActionType: "send_platform_dm", status: "executed" }];
    fixtures.conversations = [providerConversation()];
    fixtures.matches = [{ signal: { _id: "signal-provider", title: "Raum West" } }];
    renderPage();
    expect(screen.getByRole("heading", { name: "Ein Raum, der zu euch passt." })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Raum West" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Angebot prüfen" })).toBeInTheDocument();
    expect(screen.queryByText("Ich habe angefragt und warte auf die Antwort.")).not.toBeInTheDocument();
  });

  it("shows a partial provider update without presenting it as ready", () => {
    fixtures.needs = [need("active")]; fixtures.conversations = [providerConversation({ ready: false })];
    renderPage();
    expect(screen.getByRole("heading", { name: "Der Anbieter hat geantwortet." })).toBeInTheDocument();
    expect(screen.getByText("Zwischenstand")).toBeInTheDocument();
    expect(screen.getByText("Bitte bestätigt noch die Nutzungszeiten.")).toBeInTheDocument();
    expect(screen.queryByText("Der Anbieter hat geantwortet, aber eine Bedingung ist noch offen.")).not.toBeInTheDocument();
    expect(screen.queryByText("Angebot eingegangen")).not.toBeInTheDocument();
    expect(screen.queryByText("Alle Konditionen")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Angebot prüfen" })).not.toBeInTheDocument();
  });

  it("keeps the saved brief beside the working stage instead of behind a toggle", () => {
    fixtures.needs = [need("active")];
    renderPage();

    expect(screen.queryByRole("button", { name: "Suchauftrag ansehen" })).not.toBeInTheDocument();
    const aside = screen.getByRole("group", { name: "Euer Suchauftrag" });
    expect(aside).toHaveTextContent("Stuttgart · 20 km Umkreis");
    expect(aside).toHaveTextContent("Bis 350 € / Monat");
    expect(aside).toHaveTextContent("Geteilter Raum");
    expect(screen.getByRole("button", { name: "Budget bearbeiten" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the Suchauftrag beside the conversation while the band is still talking", () => {
    fixtures.needs = [{
      ...need(), genres: ["Rock"], instruments: ["Schlagzeug"],
      facets: [
        { namespace: "band", key: "size", value: 4, confidence: 1 },
        { namespace: "equipment", key: "on_site_or_storage_allowed", value: true, confidence: 1 },
      ],
    }];
    fixtures.messages = [
      message({ role: "user", text: "Wir sind zu viert.", order: 0 }),
      message({ role: "assistant", text: "Verstanden.", order: 1 }),
    ];
    renderPage();

    expect(document.querySelector("[data-live-scout-stage]")).toHaveAttribute("data-live-scout-stage", "discovery");
    // The facts land in the aside, not in the reply — and they land formatted.
    const aside = screen.getByRole("group", { name: "Euer Suchauftrag" });
    expect(aside).toHaveTextContent("Stuttgart · 20 km Umkreis");
    expect(aside).toHaveTextContent("Geteilter Raum · 4er-Rockband · Schlagzeug");
    expect(aside).not.toHaveTextContent("on_site_or_storage_allowed");
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    // Nobody has been contacted yet, so discovery carries no candidate rail.
    expect(screen.queryByRole("navigation", { name: "Kandidaten" })).not.toBeInTheDocument();
  });

  it("relays canonical saved discovery values and authoritative phase quietly", async () => {
    fixtures.voice.connected = true;
    fixtures.needs = [{
      ...need(),
      matchingRevision: 3,
      schedule: ["Wednesday evenings"],
      requirements: ["Storage for our amps"],
      genres: ["Post-rock"],
      instruments: ["Guitar", "Drums"],
      facets: [{ namespace: "band", key: "size", value: 4, confidence: 1 }],
    }];
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    const view = renderPage();
    await waitFor(() => expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalled());
    const discoveryCall = fixtures.voice.appendVerifiedBackgroundUpdate.mock.calls
      .map(([update]) => update as { id: string; speak: boolean; content: string })
      .find((update) => update.id === "discovery:need-current");
    expect(discoveryCall).toEqual(expect.objectContaining({ speak: false }));
    expect(discoveryCall?.content).toContain("phase=discovery; discovery=true")
    expect(discoveryCall?.content).toContain("radiusKm=20")
    expect(discoveryCall?.content).toContain('genres=["Post-rock"]')
    expect(discoveryCall?.content).toContain('instruments=["Guitar","Drums"]')
    expect(discoveryCall?.content).toContain('facets=[{"namespace":"band","key":"size","value":4,"confidence":1}]')
    expect(discoveryCall?.content).toContain("readyForReview=true")
    expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "discovery-phase",
        speak: false,
        content: expect.stringContaining("mode search_discovery, phase discovery"),
      }),
    )
    expect(fixtures.voice.appendVerifiedBackgroundUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "discovery-phase", instruction: true }),
    )
    expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "brief-ready:need-current",
        version: "en:3",
        speak: true,
        content: "Your brief is ready. Shall I start looking?",
      }),
    );

    fixtures.needs = [{ ...fixtures.needs[0]!, status: "active" }];
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    await waitFor(() => expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "discovery:need-current",
        content: expect.stringContaining("phase=search_active; discovery=false"),
      }),
    ));
    expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ content: expect.stringContaining("Stop discovery questions") }),
    );
    expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "discovery-phase",
        speak: false,
        content: expect.stringContaining("phase search_active"),
      }),
    );
    expect(fixtures.voice.appendVerifiedBackgroundUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "discovery-phase", instruction: true }),
    );
    expect(fixtures.voice.clearBackgroundUpdate).toHaveBeenCalledWith("brief-ready:need-current");
  });

  it("relays a phase change as same-session context, never as a fresh-session instruction", async () => {
    fixtures.voice.connected = true;
    const phaseUpdates = () => fixtures.voice.appendVerifiedBackgroundUpdate.mock.calls
      .map(([update]) => update as { id: string; speak?: boolean; instruction?: boolean; content: string })
      .filter((update) => update.id === "discovery-phase");
    const view = renderPage();
    await waitFor(() => expect(phaseUpdates()).not.toHaveLength(0));
    const discovery = phaseUpdates().at(-1)!;
    expect(discovery.instruction).toBeUndefined();
    expect(discovery.speak).toBe(false);
    expect(discovery.content).toMatch(/^Same voice session continues; this is an app update, not a new session\. Do not greet again and do not repeat the SESSION OPENING\. Apply the latest authoritative app phase now: mode search_discovery, phase discovery\./);

    // Starting the search flips the phase; the founder heard "welcome back" here.
    fixtures.needs = [need("active")];
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    await waitFor(() => expect(phaseUpdates().at(-1)?.content).toContain("phase search_active"));
    const active = phaseUpdates().at(-1)!;
    expect(active.instruction).toBeUndefined();
    expect(active.content).toContain("this is an app update, not a new session. Do not greet again");
    expect(active.content).toContain("Stop discovery questions");
    // No new discovery questions, but a spoken budget change on the live search still reaches the backend.
    expect(active.content).toContain("Explicit corrections to saved facts are still delegated to the backend.");
    expect(phaseUpdates().every((update) => update.instruction === undefined)).toBe(true);
  });

  it("relays the German phase change with the correction allowance the demo locale runs in", async () => {
    fixtures.voice.connected = true;
    fixtures.needs = [need("active")];
    const phaseUpdates = () => fixtures.voice.appendVerifiedBackgroundUpdate.mock.calls
      .map(([update]) => update as { id: string; content: string })
      .filter((update) => update.id === "discovery-phase");
    render(
      <LocaleCtx.Provider value={{ locale: "de", dict: de, availableLocales: ["en", "de"], setLocale: vi.fn() }}>
        <MemoryRouter><ScoutPage /></MemoryRouter>
      </LocaleCtx.Provider>,
    );
    await waitFor(() => expect(phaseUpdates().at(-1)?.content).toContain("Phase search_active"));
    const active = phaseUpdates().at(-1)!;
    expect(active.content).toContain("Begrüße nicht erneut");
    expect(active.content).toContain("Beende Discovery-Fragen");
    expect(active.content).toContain("Ausdrückliche Korrekturen an gespeicherten Fakten werden weiterhin ans Backend delegiert.");
  });

  it("keeps the conversation mounted when the search starts", async () => {
    fixtures.voice.connected = true;
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    const view = renderPage();
    expect(screen.getByText("Voice Scout session")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Scout losschicken" }));
    expect(fixtures.voice.sendText).toHaveBeenCalledWith(
      "Start the search now using my current requirements.",
    );
    expect(mutation("savedNeeds:activate")).not.toHaveBeenCalled();
    expect(fixtures.voice.disconnect).not.toHaveBeenCalled();

    fixtures.needs = [need("active")];
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    expect(screen.getByText("Ich kümmere mich darum.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    expect(screen.getByText("Voice Scout session")).toBeInTheDocument();
  });

  it("groups this search's candidates and keeps unavailable and closed rooms accessible", () => {
    fixtures.needs = [need("active")];
    fixtures.inbox = [
      candidate({ id: "c-old", title: "Raum Süd", at: 1_000 }),
      candidate({ id: "c-new", title: "Raum West", state: "offer_ready", unread: true, at: 9_000 }),
      candidate({ id: "c-other", title: "Fremder Raum", savedNeedId: "need-other", at: 8_000 }),
      candidate({ id: "c-closed", title: "Beendeter Raum", state: "closed", at: 7_000 }),
      { ...candidate({ id: "c-unavailable", title: "Unavailable room", at: 10_000 }), disposition: "not_fit", exclusionReason: "unavailable", progress: "reply_received" },
    ];
    renderPage();

    const rail = screen.getByRole("navigation", { name: "Kandidaten" });
    expect(rail).toHaveTextContent("Angebot liegt vor");
    expect(rail).not.toHaveTextContent("Fremder Raum");
    expect(rail).toHaveTextContent("Beendeter Raum");
    expect(rail).toHaveTextContent("Nicht verfügbar");
    expect(fixtures.queries).toHaveBeenCalledWith("conversations:listMine", { savedNeedId: "need-current", limit: 50 });
    const rows = screen.getAllByRole("button").filter(row => rail.contains(row));
    expect(rows.map(row => row.textContent?.split("Proberaum")[0])).toEqual(["Raum West", "Raum Süd", "Unavailable room", "Beendeter Raum"]);
  });

  it("names the empty rail rather than leaving the column blank", () => {
    fixtures.needs = [need("active")];
    renderPage();
    expect(screen.getByRole("navigation", { name: "Kandidaten" }))
      .toHaveTextContent("Noch keine passenden Räume. Ich suche weiter.");
  });

  it("states the rail's verdict instead of a provider update when the replying room is excluded", () => {
    fixtures.needs = [need("active")];
    const reply = providerConversation({ ready: false });
    fixtures.conversations = [{
      ...reply,
      offer: {
        ...reply.offer, blockers: ["The provider reports the room as not available."],
        assessment: { ...reply.offer.assessment, availability: { status: "unavailable", evidence: [] } },
      },
    }];
    // The same conversation as the rail sees it: filed under „Nicht mehr passend“.
    fixtures.inbox = [{ ...candidate({ id: "conversation-2", title: "Nordresonanz" }), disposition: "not_fit", exclusionReason: "unavailable", progress: "reply_received" }];
    renderPage();
    expect(document.querySelector("[data-live-scout-stage]")).toHaveAttribute("data-live-scout-stage", "provider-excluded");
    expect(screen.getByRole("heading", { name: "Nordresonanz passt nicht mehr." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Der Anbieter hat geantwortet." })).not.toBeInTheDocument();
    expect(screen.queryByText("Ich prüfe die Antwort und kläre, was noch offen ist.")).not.toBeInTheDocument();
    expect(screen.queryByText("Zwischenstand")).not.toBeInTheDocument();
    expect(screen.queryByText("Ich kläre noch:")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Angebot prüfen" })).not.toBeInTheDocument();
    // Rail and card agree on the verdict.
    expect(screen.getByRole("navigation", { name: "Kandidaten" })).toHaveTextContent("Nicht verfügbar");
    expect(screen.getByText("Nicht verfügbar", { selector: "[data-slot='overline']" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nachrichten ansehen" })).toBeInTheDocument();
  });

  it("does not claim a provider reply merely because an outbound thread exists", () => {
    fixtures.needs = [need("active")];
    fixtures.conversations = [{ ...providerConversation({ ready: false }), assessmentFromProviderReply: false }];
    renderPage();
    expect(screen.queryByRole("heading", { name: "Der Anbieter hat geantwortet." })).not.toBeInTheDocument();
  });

  it("answers the open Entscheidung on the stage without opening the chat", async () => {
    fixtures.needs = [need("active")];
    fixtures.actions = [{ _id: "send-1", savedNeedId: "need-current", requestedActionType: "send_platform_dm", status: "awaiting_approval" }];
    fixtures.decisions = [reviewDecision()];
    renderPage();
    expect(document.querySelector("[data-live-scout-stage]")).toHaveAttribute("data-live-scout-stage", "blocked");
    expect(screen.getByText("Hier brauche ich kurz deine Hilfe.").tagName).toBe("H1");
    expect(screen.getByText("Soll ich diese Nachricht so senden?")).toBeInTheDocument();
    expect(screen.queryByText("Ein Schritt konnte noch nicht abgeschlossen werden.", { exact: false })).not.toBeInTheDocument();
    // The whole Entscheidung is on the stage now — the prepared answers and the
    // card's own field — so nothing opens by itself.
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Entscheidung" })).toHaveTextContent("Hallo, ist der Raum noch frei?");
    const answer = mutation("decisions:answer");
    fireEvent.click(screen.getByRole("radio", { name: "Ja, so senden" }));
    fireEvent.click(screen.getByRole("button", { name: "Antworten" }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith({ decisionId: "decision-1", choice: "yes" }));
    expect(fixtures.voice.connect).not.toHaveBeenCalled();
  });

  it("sends the Entscheidung's own text as an instruction, not as a chat message", async () => {
    fixtures.needs = [need("active")];
    fixtures.decisions = [reviewDecision()];
    renderPage();
    const answer = mutation("decisions:answer");
    fireEvent.change(screen.getByRole("textbox", { name: "Was soll anders sein?" }), {
      target: { value: "Frag auch nach der Kaution." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Antworten" }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith({
      decisionId: "decision-1", choice: "custom", text: "Frag auch nach der Kaution.",
    }));
    expect(mutation("scout:send")).not.toHaveBeenCalled();
  });

  it("opens the acceptance review straight from the stage Entscheidung", () => {
    fixtures.needs = [need("active")];
    // A current offer that is not ready yet keeps the stage on „blocked“, so
    // the Entscheidung — not the offer stage — is what the musician answers.
    fixtures.conversations = [providerConversation({ ready: false })];
    fixtures.decisions = [{
      _id: "decision-offer", kind: "offer_ready", status: "open",
      question: "Ein Angebot liegt vor. Soll ich es dir zeigen?",
      options: [{ id: "review", label: "Angebot prüfen" }, { id: "no", label: "Nicht dieses" }],
      refs: { offerId: "offer-provider" }, conversationId: "conversation-2", createdAt: 1, updatedAt: 1,
    }];
    renderPage();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Angebot prüfen" }));
    // One click, and the review itself is open — no detour through the chat.
    expect(screen.getByRole("dialog", { name: "Angebot verbindlich annehmen" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
  });

  it("hands an Entscheidung to the chat card when the musician would rather write", () => {
    fixtures.needs = [need("active")];
    fixtures.decisions = [reviewDecision()];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Oder lieber schreiben" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Entscheidung" })).toHaveTextContent("Hallo, ist der Raum noch frei?");
  });

  it("hands a human step over on the stage and keeps the chat as the way out", () => {
    fixtures.needs = [need("active")];
    fixtures.decisions = [{
      _id: "decision-3", kind: "human_step", status: "open",
      question: "Bitte melde dich einmal selbst im Portal an.", options: [],
      refs: {}, createdAt: 1, updatedAt: 1,
    }];
    renderPage();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Verbindung neu registrieren" }))
      .toHaveAttribute("href", "/app/settings/sources");
    fireEvent.click(screen.getByRole("button", { name: "Oder lieber schreiben" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
  });

  it("does not open the chat for an Entscheidung while a voice session is running", () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [{ _id: "decision-2", kind: "scout_question", status: "open", question: "Ist Stuttgart-West okay?", options: [], refs: {}, createdAt: 1, updatedAt: 1 }];
    renderPage();
    expect(screen.getByText("Hier brauche ich kurz deine Hilfe.")).toBeInTheDocument();
    expect(screen.getByText("Voice Scout session")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Entscheidung" })).toBeInTheDocument();
  });

  it("does not repeat the global voice Entscheidung when chat and the selected provider thread already show it", async () => {
    const decision = reviewDecision();
    fixtures.needs = [need("active")];
    fixtures.voice.connected = true;
    fixtures.decisions = [decision];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    fixtures.focusedThread = {
      header: {
        conversationId: "conversation-2", savedNeedId: "need-current", signalId: "signal-conversation-2",
        title: "Raum West", subtitle: "Stuttgart", channel: "platform", state: "needs_attention",
        providerLabel: "Anbieter", offer: null, composer: { enabled: true },
      },
      items: [{ kind: "decision", id: decision._id, at: 1, decision }],
    };
    const view = renderPage();

    // Before another panel owns it, the global voice companion keeps the one
    // actionable card available.
    expect(screen.getAllByRole("group", { name: "Entscheidung" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Raum West/ }));
    await waitFor(() => expect(mutation("scout:setFocus")).toHaveBeenCalled());
    fixtures.context = { ...fixtures.context, focusedSignalId: "signal-conversation-2", mode: "signal_advisor" };
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    // A row carrying an open Entscheidung lands on its thread directly; the
    // card moves into the thread instead of doubling up with the global one.
    await waitFor(() => expect(screen.getByRole("region", { name: "Nachrichten" })).toBeInTheDocument());
    expect(screen.getAllByRole("group", { name: "Entscheidung" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Zum Schreiben wechseln" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    // The two visible conversation panels each retain their own canonical
    // context; the third floating/global copy is gone.
    expect(screen.getAllByRole("group", { name: "Entscheidung" })).toHaveLength(2);
  });

  /** A provider question tied to the „Raum West“ conversation, as `decisions.listOpenMine` returns it. */
  function roomQuestion() {
    return {
      _id: "decision-conversation-2", kind: "scout_question", status: "open",
      question: "Passt der Termin?", options: [{ id: "yes", label: "Ja, passt" }, { id: "no", label: "Nein" }],
      refs: {}, conversationId: "conversation-2", createdAt: 1, updatedAt: 1,
    };
  }

  const decisionUpdates = () => fixtures.voice.appendVerifiedBackgroundUpdate.mock.calls
    .map(([update]) => update as { id: string; version: string; speak?: boolean; content: string })
    .filter((update) => update.id.startsWith("decision:") || update.id.startsWith("decision-voice:"));

  it("announces the bound room question by voice with its question, options and room, and binds it", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [roomQuestion()];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    renderPage();
    await waitFor(() => expect(decisionUpdates()).toHaveLength(1));
    const [update] = decisionUpdates();
    expect(update).toEqual(expect.objectContaining({ id: "decision-voice:decision-conversation-2", version: "en:1", speak: true }));
    expect(update!.content).toContain("about Raum West");
    expect(update!.content).toContain("Question: Passt der Termin?");
    expect(update!.content).toContain("Ja, passt");
    expect(update!.content).toContain("Nein");
    expect(update!.content).toContain("or their own answer");
    expect(update!.content).toContain("Raise it once at the next pause");
    expect(update!.content).not.toContain("decision-conversation-2");
    // One commentary append, so the model gets one speakable item per decision.
    expect(splitLiveAppendContent(update!.content)).toHaveLength(1);
    expect(fixtures.voice.setFocus).toHaveBeenLastCalledWith(expect.objectContaining({ decisionId: "decision-conversation-2" }));
  });

  it("keeps the generic notice for a portal human step and binds no decision to voice", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [{
      _id: "decision-3", kind: "human_step", status: "open",
      question: "Bitte melde dich einmal selbst im Portal an.", options: [],
      refs: {}, createdAt: 1, updatedAt: 1,
    }];
    renderPage();
    await waitFor(() => expect(decisionUpdates()).toHaveLength(1));
    expect(decisionUpdates()[0]).toEqual(expect.objectContaining({
      id: "decision:decision-3", speak: true,
      content: expect.stringContaining("visible in the UI"),
    }));
    expect(decisionUpdates()[0]!.content).not.toContain("Quick one");
    expect(fixtures.voice.setFocus).toHaveBeenCalled();
    expect(fixtures.voice.setFocus.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ decisionId: undefined }));
  });

  it("announces nothing for a Scout question that is still being formulated", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [{ _id: "decision-4", kind: "scout_question", status: "open", question: "", options: [], refs: {}, conversationId: "conversation-2", createdAt: 1, updatedAt: 1 }];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    renderPage();
    await waitFor(() => expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalled());
    expect(decisionUpdates()).toEqual([]);
    expect(fixtures.voice.setFocus.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ decisionId: undefined }));
  });

  it("announces a Freigabeprüfung decision with no and a wording instruction only, never yes", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [reviewDecision()];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    renderPage();
    await waitFor(() => expect(decisionUpdates()).toHaveLength(1));
    const [update] = decisionUpdates();
    expect(update!.id).toBe("decision-voice:decision-1");
    expect(update!.content).toContain("about Raum West");
    expect(update!.content).toContain("Soll ich diese Nachricht so senden?");
    expect(update!.content).toContain("only in the app review");
    expect(update!.content).toContain("no, or a different wording");
    expect(update!.content).not.toContain("Ja, so senden");
    expect(update!.content).not.toContain("Hallo, ist der Raum noch frei?");
    expect(splitLiveAppendContent(update!.content)).toHaveLength(1);
    expect(fixtures.voice.setFocus).toHaveBeenLastCalledWith(expect.objectContaining({ decisionId: "decision-1" }));
  });

  it("binds the first answerable decision to voice, not a newer human step", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [{
      _id: "decision-3", kind: "human_step", status: "open",
      question: "Bitte melde dich einmal selbst im Portal an.", options: [],
      refs: {}, createdAt: 2, updatedAt: 2,
    }, roomQuestion()];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    renderPage();
    await waitFor(() => expect(decisionUpdates()).toHaveLength(2));
    expect(fixtures.voice.setFocus).toHaveBeenLastCalledWith(expect.objectContaining({ decisionId: "decision-conversation-2" }));
    expect(decisionUpdates().find((update) => update.id === "decision-voice:decision-conversation-2")?.content)
      .toContain("an open question about Raum West");
    expect(decisionUpdates().find((update) => update.id === "decision:decision-3")?.content).toContain("visible in the UI");
    // The stage still blocks on the newest Entscheidung.
    expect(document.querySelector("[data-live-scout-stage]")).toHaveAttribute("data-live-scout-stage", "blocked");
  });

  it("binds no decision of another search, even when it is the only answerable one", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    // listOpenMine is owner-wide: this question belongs to a room of an older
    // search, so the delegate could only answer it with "not_active".
    fixtures.decisions = [{ ...roomQuestion(), _id: "decision-stale", conversationId: "conversation-old" }];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West" })];
    renderPage();
    await waitFor(() => expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalled());
    expect(decisionUpdates()).toEqual([]);
    expect(fixtures.voice.setFocus.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ decisionId: undefined }));
  });

  it("announces a second decision by voice once it becomes the bound one", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    // The Freigabeprüfung is relayed as the generic notice while the Scout
    // question holds the binding; its updatedAt never changes.
    fixtures.decisions = [roomQuestion(), reviewDecision()];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    const view = renderPage();
    await waitFor(() => expect(decisionUpdates()).toHaveLength(2));
    expect(decisionUpdates().find((update) => update.id === "decision:decision-1")?.content).toContain("visible in the UI");

    // The musician answers the bound question by voice; it leaves listOpenMine.
    fixtures.decisions = [reviewDecision()];
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);

    await waitFor(() => expect(decisionUpdates().some((update) => update.id === "decision-voice:decision-1")).toBe(true));
    expect(decisionUpdates().find((update) => update.id === "decision-voice:decision-1")?.content)
      .toContain("Soll ich diese Nachricht so senden?");
    expect(fixtures.voice.clearBackgroundUpdate).toHaveBeenCalledWith("decision:decision-1");
    expect(fixtures.voice.setFocus).toHaveBeenLastCalledWith(expect.objectContaining({ decisionId: "decision-1" }));
  });

  it("does not re-announce a question round the delegate already advanced by voice", async () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [{
      ...roomQuestion(), question: "Reicht ein E-Drum-Set?", options: [{ id: "no", label: "Nein, akustisch" }], updatedAt: 5,
      questions: [
        { id: "schedule", constraintKeys: ["schedule"], question: "Passt der Termin?", options: [{ id: "yes", label: "Ja, passt" }], answer: { choice: "yes", at: 4 } },
        { id: "equipment", constraintKeys: ["requirement:0"], question: "Reicht ein E-Drum-Set?", options: [{ id: "no", label: "Nein, akustisch" }] },
      ],
    }];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    renderPage();
    await waitFor(() => expect(fixtures.voice.appendVerifiedBackgroundUpdate).toHaveBeenCalled());
    expect(decisionUpdates()).toEqual([]);
    // The delegate can still answer the next question under the bound decision.
    expect(fixtures.voice.setFocus).toHaveBeenLastCalledWith(expect.objectContaining({ decisionId: "decision-conversation-2" }));
  });

  it("keeps an open Entscheidung answerable above the focused room after a reload without voice", () => {
    // After a reload the voice session is gone but the server still remembers the
    // focused room, so the page lands on the room panel, not the voice companion.
    fixtures.needs = [need("active")];
    fixtures.voice.connected = false;
    fixtures.decisions = [roomQuestion()];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    fixtures.context = { ...fixtures.context, focusedSignalId: "signal-conversation-2", mode: "signal_advisor" };
    renderPage();
    expect(screen.queryByText("Voice Scout session")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nachrichten" })).not.toBeInTheDocument();
    const room = screen.getByRole("heading", { name: "Raum West" });
    const card = screen.getByRole("group", { name: "Entscheidung" });
    expect(card).toHaveTextContent("Passt der Termin?");
    expect(card.compareDocumentPosition(room) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("opens the provider thread with its Entscheidung straight from the candidate row", async () => {
    const decision = roomQuestion();
    fixtures.needs = [need("active")];
    fixtures.decisions = [decision];
    fixtures.inbox = [candidate({ id: "conversation-2", title: "Raum West", openDecision: true })];
    fixtures.focusedThread = {
      header: {
        conversationId: "conversation-2", savedNeedId: "need-current", signalId: "signal-conversation-2",
        title: "Raum West", subtitle: "Stuttgart", channel: "platform", state: "needs_attention",
        providerLabel: "Anbieter", offer: null, composer: { enabled: true },
      },
      items: [{ kind: "decision", id: decision._id, at: 1, decision }],
    };
    const view = renderPage();
    expect(screen.getAllByRole("group", { name: "Entscheidung" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Raum West/ }));
    await waitFor(() => expect(mutation("scout:setFocus")).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "signal_advisor", focusedSignalId: "signal-conversation-2" }),
    ));
    fixtures.context = { ...fixtures.context, focusedSignalId: "signal-conversation-2", mode: "signal_advisor" };
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    // One click: the thread, not the read-only room panel with its second „Unterhaltung öffnen“ step.
    await waitFor(() => expect(screen.getByRole("region", { name: "Nachrichten" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Unterhaltung öffnen" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("group", { name: "Entscheidung" })).toHaveLength(1);

    const answer = mutation("decisions:answer");
    fireEvent.click(screen.getByRole("radio", { name: "Ja, passt" }));
    fireEvent.click(screen.getByRole("button", { name: "Antworten" }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ decisionId: "decision-conversation-2", choice: "yes" }),
    ));
  });

  it("sends a chat message as a mutation carrying the prompt", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
    const composer = screen.getByRole("textbox", { name: "Nachricht an deinen Scout …" });
    fireEvent.change(composer, { target: { value: "Wir suchen ab Mai." } });
    fireEvent.keyDown(composer, { key: "Enter" });
    await waitFor(() => expect(mutation("scout:send")).toHaveBeenCalledWith({
      threadId: "thread", prompt: "Wir suchen ab Mai.",
    }));
  });

  it("blocks sending while the reply streams, without repeating the reason", () => {
    fixtures.messages = [
      message({ role: "user", text: "Wir suchen ab Mai.", order: 0 }),
      message({ role: "assistant", text: "Ich schaue", status: "streaming", order: 1 }),
    ];
    renderPage();
    const composer = screen.getByRole("textbox", { name: "Nachricht an deinen Scout …" });
    fireEvent.change(composer, { target: { value: "Noch etwas" } });
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
    // The thinking Marker is the one place that says the Scout is working; the
    // composer no longer duplicates it, and typing stays possible.
    expect(screen.queryByText("Dein Scout antwortet gerade …")).not.toBeInTheDocument();
    expect(composer).not.toBeDisabled();
  });

  it("releases the composer once the reply is on the thread", () => {
    fixtures.messages = [
      message({ role: "user", text: "Wir suchen ab Mai.", order: 0 }),
      message({ role: "assistant", text: "Ich schaue mal nach.", order: 1 }),
    ];
    renderPage();
    const composer = screen.getByRole("textbox", { name: "Nachricht an deinen Scout …" });
    fireEvent.change(composer, { target: { value: "Noch etwas" } });
    expect(screen.getByRole("button", { name: "Senden" })).toBeEnabled();
    expect(screen.queryByText("Dein Scout antwortet gerade …")).not.toBeInTheDocument();
  });

  it("shows accepted completion even when the need is paused", () => {
    fixtures.needs = [need("paused")]; fixtures.conversations = [providerConversation({ accepted: true })];
    renderPage();
    expect(screen.getByRole("heading", { name: "Eure Zusage ist angekommen." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eure Suche macht eine Pause." })).not.toBeInTheDocument();
  });
  it("queues Live search start behind pending speech instead of racing the domain mutation", () => {
    fixtures.voice.connected = true;
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Scout losschicken" }));
    expect(fixtures.voice.sendText).toHaveBeenCalledWith("Start the search now using my current requirements.");
    expect(mutation("savedNeeds:activate")).not.toHaveBeenCalled();
    expect(fixtures.voice.disconnect).not.toHaveBeenCalled();
  });

  it("saves a versioned inline edit and displays only the committed query value", async () => {
    fixtures.voice.connected = true;
    fixtures.needs = [{ ...need(), matchingRevision: 7 }];
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Budget bearbeiten" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximales Budget pro Monat" }), { target: { value: "280" } });
    expect(screen.getByRole("group", { name: "Euer Suchauftrag" })).toHaveTextContent("Bis 350 € / Monat");
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));
    await waitFor(() => expect(mutation("savedNeeds:update")).toHaveBeenCalledWith({ needId: "need-current", expectedRevision: 7, maxBudgetEur: 280 }));
    expect(screen.getByRole("group", { name: "Euer Suchauftrag" })).toHaveTextContent("Bis 350 € / Monat");
    fixtures.needs = [{ ...need(), maxBudgetEur: 280, matchingRevision: 8 }];
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    expect(screen.getByRole("group", { name: "Euer Suchauftrag" })).toHaveTextContent("Bis 280 € / Monat");
    expect(fixtures.voice.disconnect).not.toHaveBeenCalled();
  });

  it("binds server focus before opening a candidate beside voice", async () => {
    fixtures.voice.connected = true;
    fixtures.needs = [need("active")];
    fixtures.inbox = [candidate({ id: "c-west", title: "Raum West" })];
    fixtures.focusedSignal = {
      signal: {
        _id: "signal-c-west", title: "Raum West", city: "Stuttgart", district: "West",
        summary: "Ein heller Raum mit Lagerplatz.", priceEur: 280, pricePeriod: "month",
        unknowns: ["Wochenendzugang noch offen"], requirements: [], isDemo: true,
      },
      evidence: [],
    };
    fixtures.focusedThread = {
      header: {
        conversationId: "c-west", savedNeedId: "need-current", signalId: "signal-c-west",
        title: "Raum West", subtitle: "Stuttgart-West", channel: "platform", state: "waiting",
        providerLabel: "Anbieter", offer: null, composer: { enabled: true },
      },
      items: [],
    };
    let finishFocus: (() => void) | undefined;
    mutation("scout:setFocus").mockImplementationOnce(() => new Promise<void>(resolve => { finishFocus = resolve; }));
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Raum West/ }));
    expect(mutation("scout:setFocus")).toHaveBeenCalledWith({ threadId: "thread", activeNeedId: "need-current", mode: "signal_advisor", focusedSignalId: "signal-c-west" });
    expect(fixtures.queries).not.toHaveBeenCalledWith("conversations:getMine", { conversationId: "c-west" });
    finishFocus?.();
    fixtures.context = { ...fixtures.context, focusedSignalId: "signal-c-west", mode: "signal_advisor" };
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Raum West" })).toBeVisible();
    expect(screen.getByText("Ein heller Raum mit Lagerplatz.")).toBeVisible();
    expect(fixtures.queries).toHaveBeenCalledWith("signals:get", { signalId: "signal-c-west" });
    expect(fixtures.queries).not.toHaveBeenCalledWith("conversations:getMine", { conversationId: "c-west" });
    expect(mutation("conversations:markRead")).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Unterhaltung öffnen" }));
    await waitFor(() => expect(fixtures.queries).toHaveBeenCalledWith("conversations:getMine", { conversationId: "c-west" }));
    await waitFor(() => expect(mutation("conversations:markRead")).toHaveBeenCalledWith({ conversationId: "c-west" }));
    expect(screen.getByRole("region", { name: "Nachrichten" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Zurück zu den Raumdetails" }));
    expect(screen.getByText("Ein heller Raum mit Lagerplatz.")).toBeVisible();
    expect(screen.queryByRole("region", { name: "Nachrichten" })).not.toBeInTheDocument();
    expect(fixtures.voice.setFocus).toHaveBeenLastCalledWith(expect.objectContaining({ focusedSignalId: "signal-c-west" }));
    expect(screen.getByText("Voice Scout session")).toBeInTheDocument();
    expect(fixtures.voice.disconnect).not.toHaveBeenCalled();
  });

  it("opens a budget-only candidate without contacting it and requires a global budget edit", async () => {
    fixtures.needs = [{ ...need("active"), maxBudgetEur: 250, matchingRevision: 7 }];
    fixtures.indexed = [{ candidateKey: "need-current:room-350", savedNeedId: "need-current", signalId: "room-350", kind: "near_budget", updatedAt: 2000, monthlyCostEur: 350, budgetDeltaEur: 100, monthlyCostBasis: "listed_monthly_base", contactEligible: false, reasons: ["Within your area"], uncertainties: ["Evenings unconfirmed"], signal: { title: "Room 350", city: "Stuttgart", summary: "Shared rehearsal room", isDemo: true, providerSimulation: "ai_simulated" } }];
    const view = renderPage();
    expect(screen.getByRole("navigation", { name: "Kandidaten" })).toHaveTextContent("Über eurem aktuellen Budget");
    expect(screen.getByRole("button", { name: /Room 350/ })).not.toHaveTextContent("RoomScout-Demo");
    expect(screen.queryByText("Fiktiver Raum · KI-simulierter Anbieter")).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Räume über Budget anzeigen" })).toBeChecked();
    fireEvent.click(screen.getByRole("switch", { name: "Räume über Budget anzeigen" }));
    expect(screen.queryByRole("button", { name: /Room 350/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch", { name: "Räume über Budget anzeigen" }));
    fireEvent.click(screen.getByRole("button", { name: /Room 350/ }));
    await waitFor(() => expect(mutation("scout:setFocus")).toHaveBeenCalledWith(expect.objectContaining({ focusedSignalId: "room-350" })));
    fixtures.context = { ...fixtures.context, focusedSignalId: "room-350", mode: "signal_advisor" };
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    expect(screen.getByText(/100.*über eurem Monatsbudget/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Diesen Anbieter anfragen" })).not.toBeInTheDocument();
    expect(mutation("providerConversations:startInitialInquiry")).not.toHaveBeenCalled();
    expect(mutation("savedNeeds:update")).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Suchbudget anpassen" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximales Budget pro Monat" }), { target: { value: "400" } });
    fireEvent.click(screen.getByRole("button", { name: "Änderungen speichern" }));
    await waitFor(() => expect(mutation("savedNeeds:update")).toHaveBeenCalledWith({ needId: "need-current", expectedRevision: 7, maxBudgetEur: 400 }));

    // Reactive promotion preserves the selected room; merely displaying it sends nothing.
    fixtures.needs = [{ ...need("active"), maxBudgetEur: 400, matchingRevision: 8 }];
    fixtures.indexed = [{ ...fixtures.indexed[0], kind: "fit", budgetDeltaEur: -50, contactEligible: true }];
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Room 350" })).toBeInTheDocument();
    expect(screen.queryByText(/über eurem Monatsbudget/)).not.toBeInTheDocument();
    expect(mutation("providerConversations:startInitialInquiry")).not.toHaveBeenCalled();
    mutation("providerConversations:startInitialInquiry").mockResolvedValue({ status: "queued" });
    fireEvent.click(screen.getByRole("button", { name: "Diesen Anbieter anfragen" }));
    await waitFor(() => expect(mutation("providerConversations:startInitialInquiry")).toHaveBeenCalledWith({ savedNeedId: "need-current", signalId: "room-350" }));
  });

  it("keeps a real indexed room readable while contact stays disabled in the demo", async () => {
    fixtures.needs = [need("active")];
    fixtures.indexed = [{ candidateKey: "need-current:real-room", savedNeedId: "need-current", signalId: "real-room", kind: "fit", updatedAt: 2000, monthlyCostEur: 250, monthlyCostBasis: "listed_monthly_base", contactEligible: true, reasons: ["Within your area"], uncertainties: [], signal: { title: "Real indexed room", city: "Stuttgart", summary: "Observed public listing", isDemo: false } }];
    const view = renderPage();
    expect(screen.getByRole("button", { name: /Real indexed room/ })).toHaveTextContent("Kontakt in der Demo deaktiviert");
    fireEvent.click(screen.getByRole("button", { name: /Real indexed room/ }));
    await waitFor(() => expect(mutation("scout:setFocus")).toHaveBeenCalled());
    fixtures.context = { ...fixtures.context, focusedSignalId: "real-room", mode: "signal_advisor" };
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Real indexed room" })).toBeVisible();
    expect(screen.getAllByText("Kontakt in der Demo deaktiviert").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Diesen Anbieter anfragen" })).not.toBeInTheDocument();
    expect(mutation("providerConversations:startInitialInquiry")).not.toHaveBeenCalled();
  });

  it("turns a server profile requirement into the visible completion path", async () => {
    fixtures.needs = [need("active")];
    fixtures.indexed = [{ candidateKey: "need-current:demo-room", savedNeedId: "need-current", signalId: "demo-room", kind: "fit", updatedAt: 2000, monthlyCostEur: 250, monthlyCostBasis: "listed_monthly_base", contactEligible: true, reasons: ["Within your area"], uncertainties: [], signal: { title: "Controlled room", city: "Stuttgart", summary: "Demo listing", isDemo: true } }];
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Controlled room/ }));
    await waitFor(() => expect(mutation("scout:setFocus")).toHaveBeenCalled());
    fixtures.context = { ...fixtures.context, focusedSignalId: "demo-room", mode: "signal_advisor" };
    mutation("providerConversations:startInitialInquiry").mockRejectedValueOnce(new ConvexError({ code: "MUSICIAN_PROFILE_REQUIRED" }));
    view.rerender(<MemoryRouter><ScoutPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Diesen Anbieter anfragen" }));
    expect(await screen.findByRole("link", { name: "Profil vervollständigen" })).toBeVisible();
    expect(screen.queryByText("Die Aktion konnte nicht abgeschlossen werden.")).not.toBeInTheDocument();
  });

});
