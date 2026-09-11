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
  actions: [] as Array<Record<string, unknown>>,
  messages: [] as Array<Record<string, unknown>>,
  queries: vi.fn(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  actionFns: new Map<string, ReturnType<typeof vi.fn>>(),
  voice: { connected: false, connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn() },
}));

function mutation(name: string) {
  const fn = fixtures.mutations.get(name) ?? vi.fn().mockResolvedValue(null);
  fixtures.mutations.set(name, fn);
  return fn;
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

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref);
    fixtures.queries(name, args);
    if (name === "users:current") return { username: "test-band", displayName: "Test Band" };
    if (name === "savedNeeds:listMine") return fixtures.needs;
    if (name === "scout:getMine") return fixtures.context;
    if (name === "matches:listMine") return fixtures.matches;
    if (name === "providerConversations:listMine") return fixtures.conversations;
    if (name === "externalActions:listMine") return fixtures.actions;
    return null;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => mutation(getFunctionName(ref)),
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => action(getFunctionName(ref)),
  usePaginatedQuery: () => ({ results: fixtures.messages, status: "Exhausted", loadMore: vi.fn() }),
}));

vi.mock("../../ui/chat/LiveVoiceChat", () => ({ LiveVoiceChat: () => <div>Voice Scout session</div> }));
vi.mock("@convex-dev/auth/react", () => ({ useAuthActions: () => ({ signOut: vi.fn() }) }));
vi.mock("../../components/voice/VoiceSessionContext", () => ({ useVoiceSession: () => fixtures.voice }));

function renderPage() { return render(<MemoryRouter><ScoutPage /></MemoryRouter>); }

afterEach(cleanup);
beforeEach(() => {
  fixtures.needs = [need()];
  fixtures.context = { threadId: "thread", activeNeedId: "need-current", mode: "search_discovery" };
  fixtures.matches = []; fixtures.conversations = []; fixtures.actions = []; fixtures.messages = [];
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

  it("opens a ready brief automatically without activating the mandate", () => {
    fixtures.context.briefReadiness = { status: "ready", needRevision: 3, readyAt: 100 };
    renderPage();
    expect(screen.getByRole("heading", { name: "So suche ich für euch." })).toBeInTheDocument();
    expect(screen.getByText(/Euer Suchauftrag ist bereit/)).toHaveAttribute("role", "status");
    expect(mutation("mandates:enableDefaultAutopilot")).not.toHaveBeenCalled();
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
    const enable = mutation("mandates:enableDefaultAutopilot");
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
    expect(mutation("mandates:enableDefaultAutopilot")).not.toHaveBeenCalled();
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
    expect(screen.getByText("Der Anbieter hat geantwortet, aber eine Bedingung ist noch offen.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Angebot prüfen" })).not.toBeInTheDocument();
  });

  it("keeps chat and the saved brief accessible while the Scout is working", () => {
    fixtures.needs = [need("active")];
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Suchauftrag ansehen" }));
    expect(screen.getByRole("group", { name: "Euer Suchauftrag" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lieber schreiben" }));
    expect(screen.getByRole("region", { name: "Scout-Chat" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not claim a provider reply merely because an outbound thread exists", () => {
    fixtures.needs = [need("active")];
    fixtures.conversations = [{ ...providerConversation({ ready: false }), assessmentFromProviderReply: false }];
    renderPage();
    expect(screen.queryByRole("heading", { name: "Der Anbieter hat geantwortet." })).not.toBeInTheDocument();
  });

  it("shows accepted completion even when the need is paused", () => {
    fixtures.needs = [need("paused")]; fixtures.conversations = [providerConversation({ accepted: true })];
    renderPage();
    expect(screen.getByRole("heading", { name: "Eure Zusage ist angekommen." })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Eure Suche macht eine Pause." })).not.toBeInTheDocument();
  });
});
