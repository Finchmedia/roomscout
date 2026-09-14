import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScoutPage } from "./ScoutPage";

const fixtures = vi.hoisted(() => ({
  needs: [] as Array<Record<string, unknown>>,
  context: {} as Record<string, unknown>,
  matches: [] as Array<Record<string, unknown>>,
  conversations: [] as Array<Record<string, unknown>>,
  /** `api.conversations.listMine` — the rows behind the „Kandidaten“ rail. */
  inbox: [] as Array<Record<string, unknown>>,
  actions: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  decisions: [] as Array<Record<string, unknown>>,
  queries: vi.fn(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  actionFns: new Map<string, ReturnType<typeof vi.fn>>(),
  voice: { connected: false, connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn() },
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
}) {
  const { role, text = "", status = "success", order, parts } = options;
  return {
    key: `thread-${order}-0`, role, text, status, order, stepOrder: 0,
    parts: parts ?? (text ? [{ type: "text", text }] : []),
    _creationTime: order, createdAt: order,
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
    if (name === "users:current") return { username: "test-band", displayName: "Test Band" };
    if (name === "savedNeeds:listMine") return fixtures.needs;
    if (name === "scout:getMine") return fixtures.context;
    if (name === "matches:listMine") return fixtures.matches;
    if (name === "providerConversations:listMine") return fixtures.conversations;
    if (name === "conversations:listMine") return fixtures.inbox;
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

vi.mock("../../ui/chat/LiveVoiceChat", () => ({ LiveVoiceChat: () => <div>Voice Scout session</div> }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn() }) }));
vi.mock("../../components/voice/VoiceSessionContext", () => ({ useVoiceSession: () => fixtures.voice }));

function renderPage() { return render(<MemoryRouter><ScoutPage /></MemoryRouter>); }

afterEach(cleanup);
beforeEach(() => {
  fixtures.needs = [need()];
  fixtures.context = { threadId: "thread", activeNeedId: "need-current", mode: "search_discovery" };
  fixtures.matches = []; fixtures.conversations = []; fixtures.inbox = []; fixtures.actions = []; fixtures.messages = []; fixtures.decisions = [];
  fixtures.queries.mockClear(); fixtures.mutations.clear(); fixtures.actionFns.clear();
  fixtures.voice.connected = false; fixtures.voice.connect.mockClear(); fixtures.voice.disconnect.mockClear();
});

describe("live Scout route", () => {
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

  it("cancels a starting voice session when switching to text and on route exit", () => {
    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Mit Scout sprechen" }));
    expect(fixtures.voice.connect).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
    expect(fixtures.voice.disconnect).toHaveBeenCalledOnce();
    view.unmount();
    expect(fixtures.voice.disconnect).toHaveBeenCalledTimes(2);
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
    expect(screen.getByRole("button", { name: "Bearbeiten" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists the running candidates of this Suchauftrag, newest first", () => {
    fixtures.needs = [need("active")];
    fixtures.inbox = [
      candidate({ id: "c-old", title: "Raum Süd", at: 1_000 }),
      candidate({ id: "c-new", title: "Raum West", state: "offer_ready", unread: true, at: 9_000 }),
      candidate({ id: "c-other", title: "Fremder Raum", savedNeedId: "need-other", at: 8_000 }),
      candidate({ id: "c-closed", title: "Beendeter Raum", state: "closed", at: 7_000 }),
    ];
    renderPage();

    const rail = screen.getByRole("navigation", { name: "Kandidaten" });
    expect(rail).toHaveTextContent("Angebot liegt vor");
    expect(rail).not.toHaveTextContent("Fremder Raum");
    expect(rail).not.toHaveTextContent("Beendeter Raum");
    const rows = screen.getAllByRole("button").filter(row => rail.contains(row));
    expect(rows.map(row => row.textContent?.split("Proberaum")[0])).toEqual(["Raum West", "Raum Süd"]);
  });

  it("names the empty rail rather than leaving the column blank", () => {
    fixtures.needs = [need("active")];
    renderPage();
    expect(screen.getByRole("navigation", { name: "Kandidaten" }))
      .toHaveTextContent("Noch keine Kandidaten. Ich melde mich, sobald ich Räume anfrage.");
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
    // The answer is on the stage now, so nothing opens by itself.
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    const answer = mutation("decisions:answer");
    fireEvent.click(screen.getByRole("button", { name: "Ja, so senden" }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith({ decisionId: "decision-1", choice: "yes" }));
    expect(fixtures.voice.connect).not.toHaveBeenCalled();
  });

  it("hands an Entscheidung to the chat card when the musician would rather write", () => {
    fixtures.needs = [need("active")];
    fixtures.decisions = [reviewDecision()];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Oder lieber schreiben" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Entscheidung" })).toHaveTextContent("Hallo, ist der Raum noch frei?");
  });

  it("sends an Entscheidung without prepared answers to the chat", () => {
    fixtures.needs = [need("active")];
    fixtures.decisions = [{
      _id: "decision-3", kind: "human_step", status: "open",
      question: "Bitte melde dich einmal selbst im Portal an.", options: [],
      refs: {}, createdAt: 1, updatedAt: 1,
    }];
    renderPage();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Im Chat ansehen" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
  });

  it("does not open the chat for an Entscheidung while a voice session is running", () => {
    fixtures.needs = [need("active")]; fixtures.voice.connected = true;
    fixtures.decisions = [{ _id: "decision-2", kind: "scout_question", status: "open", question: "Ist Stuttgart-West okay?", options: [], refs: {}, createdAt: 1, updatedAt: 1 }];
    renderPage();
    expect(screen.getByRole("heading", { name: "Hier brauche ich kurz deine Hilfe." })).toBeInTheDocument();
    expect(screen.getByText("Voice Scout session")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Scout-Chat" })).not.toBeInTheDocument();
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

  it("blocks sending while the reply streams, and names the reason", () => {
    fixtures.messages = [
      message({ role: "user", text: "Wir suchen ab Mai.", order: 0 }),
      message({ role: "assistant", text: "Ich schaue", status: "streaming", order: 1 }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
    const composer = screen.getByRole("textbox", { name: "Nachricht an deinen Scout …" });
    fireEvent.change(composer, { target: { value: "Noch etwas" } });
    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
    expect(screen.getByText("Dein Scout antwortet gerade …")).toBeInTheDocument();
  });

  it("releases the composer once the reply is on the thread", () => {
    fixtures.messages = [
      message({ role: "user", text: "Wir suchen ab Mai.", order: 0 }),
      message({ role: "assistant", text: "Ich schaue mal nach.", order: 1 }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
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
});
