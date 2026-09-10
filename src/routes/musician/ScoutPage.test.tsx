import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ScoutPage } from "./ScoutPage";

const fixtures = vi.hoisted(() => ({
  needs: [
    {
      _id: "need-current",
      title: "Current band search",
      city: "Stuttgart",
      locationQuery: "Stuttgart",
      locationLabel: "Stuttgart",
      radiusKm: 20,
      requirements: [],
      schedule: [],
      arrangement: ["shared"],
      status: "active",
    },
  ],
  activeNeedId: "need-current",
  matches: [] as unknown[],
  opportunities: [] as unknown[],
  externalActions: [] as unknown[],
  portalConnections: [] as unknown[],
  portalRuns: [] as unknown[],
  providerConversations: [] as unknown[],
  activeMandate: null as null | { mode: string },
  queries: vi.fn(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  actions: new Map<string, ReturnType<typeof vi.fn>>(),
  voice: {
    connected: false,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  },
}));

function mutation(name: string) {
  const handler =
    fixtures.mutations.get(name) ?? vi.fn().mockResolvedValue(null);
  fixtures.mutations.set(name, handler);
  return handler;
}

function action(name: string) {
  const handler = fixtures.actions.get(name) ?? vi.fn().mockResolvedValue(null);
  fixtures.actions.set(name, handler);
  return handler;
}

function providerConversation({
  current,
  ready,
}: {
  current: boolean;
  ready: boolean;
}) {
  return {
    conversationId: `conversation-${current}-${ready}`,
    savedNeedId: "need-current",
    signalId: "signal-provider",
    state: ready ? "ready" : "needs_attention",
    revision: 2,
    updatedAt: 2,
    platformThreadId: "provider-thread",
    offer: {
      offerId: "offer-provider",
      revision: 2,
      current,
      ready,
      contentHash: "offer-hash",
      blockers: ready ? [] : ["Bitte bestaetigt noch die Nutzungszeiten."],
      assessment: {
        summary: ready
          ? "Der Anbieter hat Verfuegbarkeit, Preis und Bedingungen bestaetigt."
          : "Der Anbieter hat geantwortet, aber eine Bedingung ist noch offen.",
        availability: { status: "available", evidence: [] },
        monthlyPrice: {
          totalEur: 240,
          allRecurringCostsKnown: ready,
          evidence: [],
        },
        terms: [],
        constraints: [],
        uncertainties: ready ? [] : ["Welche Nutzungszeiten gelten?"],
        contradictions: [],
        nextAction: ready ? "review_offer" : "ask_provider",
        suggestedReply: null,
      },
    },
  };
}

vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref);
    fixtures.queries(name, args);
    if (name === "savedNeeds:listMine") return fixtures.needs;
    if (name === "scout:getMine")
      return {
        threadId: "thread",
        activeNeedId: fixtures.activeNeedId,
        mode: "search_discovery",
      };
    if (name === "matches:listMine") return fixtures.matches;
    if (name === "memory:listMine") return { facts: [], profile: null };
    if (name === "users:current") return { username: "musician" };
    if (name === "opportunities:listMine") return fixtures.opportunities;
    if (name === "externalActions:listMine") return fixtures.externalActions;
    if (name === "portalConnections:listMine") return fixtures.portalConnections;
    if (name === "portalConnections:listRunsMine") return fixtures.portalRuns;
    if (name === "mandates:getActiveMine") return fixtures.activeMandate;
    if (name === "providerConversations:listMine")
      return fixtures.providerConversations;
    if (name === "outreach:listMine") return [];
    return null;
  },
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) =>
    mutation(getFunctionName(ref)),
  useAction: (ref: Parameters<typeof getFunctionName>[0]) =>
    action(getFunctionName(ref)),
  usePaginatedQuery: () => ({
    results: [],
    status: "Exhausted",
    loadMore: vi.fn(),
  }),
}));
vi.mock("../../components/navigation/WorkspaceShell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("../../components/memory/ContextImportDialog", () => ({
  ContextImportDialog: () => null,
}));
vi.mock("../../components/voice", () => ({
  RealtimeVoiceScout: () => <div>Voice Scout session</div>,
}));
vi.mock("../../components/voice/VoiceSessionContext", () => ({
  useVoiceSession: () => fixtures.voice,
}));

afterEach(cleanup);

beforeEach(() => {
  fixtures.needs = [
    {
      _id: "need-current",
      title: "Current band search",
      city: "Stuttgart",
      locationQuery: "Stuttgart",
      locationLabel: "Stuttgart",
      radiusKm: 20,
      requirements: [],
      schedule: [],
      arrangement: ["shared"],
      status: "active",
    },
  ];
  fixtures.activeNeedId = "need-current";
  fixtures.matches = [];
  fixtures.opportunities = [];
  fixtures.externalActions = [];
  fixtures.portalConnections = [];
  fixtures.portalRuns = [];
  fixtures.providerConversations = [];
  fixtures.activeMandate = null;
  fixtures.queries.mockClear();
  fixtures.mutations.clear();
  fixtures.actions.clear();
  fixtures.voice.connected = false;
  fixtures.voice.connect.mockClear();
  fixtures.voice.disconnect.mockClear();
});

it("shows only current-need matches and does not query arbitrary city listings", () => {
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  expect(fixtures.queries).toHaveBeenCalledWith("matches:listMine", {
    savedNeedId: "need-current",
    limit: 30,
  });
  expect(
    fixtures.queries.mock.calls.some(([name]) => name === "signals:list"),
  ).toBe(false);
  expect(
    screen.getByText(/No current matches for Stuttgart/),
  ).toBeInTheDocument();
});

it("prefers the Scout context's selected active need over another current need", () => {
  fixtures.needs = [
    { ...fixtures.needs[0]!, _id: "need-first", city: "Berlin", locationQuery: "Berlin", locationLabel: "Berlin" },
    { ...fixtures.needs[0]!, _id: "need-selected", city: "Hamburg", locationQuery: "Hamburg", locationLabel: "Hamburg" },
  ];
  fixtures.activeNeedId = "need-selected";
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  expect(fixtures.queries).toHaveBeenCalledWith("matches:listMine", {
    savedNeedId: "need-selected",
    limit: 30,
  });
  expect(
    screen.getByText(/No current matches for Hamburg/),
  ).toBeInTheDocument();
});

it("keeps draft entry voice-first and reveals chat only after Lieber schreiben", () => {
  fixtures.needs[0]!.status = "draft";
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("button", { name: /Mit Scout sprechen/ }),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Message your Room Scout"),
  ).not.toBeInTheDocument();
  expect(fixtures.voice.connect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Lieber schreiben/ }));
  expect(screen.getByLabelText("Message your Room Scout")).toBeInTheDocument();
});

it("starts the persisted mandate only after reviewing the search brief and confirming", async () => {
  fixtures.needs[0] = {
    ...fixtures.needs[0]!,
    status: "draft",
    maxBudgetEur: 350,
  } as (typeof fixtures.needs)[number];
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  const enable = mutation("mandates:enableDefaultAutopilot");
  expect(enable).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Suchauftrag ansehen" }));
  expect(
    screen.getByRole("heading", { name: "So suche ich für euch." }),
  ).toBeInTheDocument();
  expect(enable).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Scout losschicken" }));
  await waitFor(() =>
    expect(enable).toHaveBeenCalledWith({ savedNeedId: "need-current" }),
  );
});

it("persists dismissal through the match mutation", async () => {
  fixtures.matches = [
    {
      _id: "match-1",
      signalId: "signal-1",
      reasons: ["Same city"],
      uncertainties: [],
      signal: {
        _id: "signal-1",
        title: "Suitable room",
        side: "supply",
        city: "Stuttgart",
        summary: "Shared room",
        arrangement: "shared",
        requirements: [],
        unknowns: [],
        status: "published",
        verification: "observed",
        sourceCount: 1,
        firstSeenAt: 1,
        lastSeenAt: 1,
      },
    },
  ];
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { name: "Suitable room" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  await waitFor(() =>
    expect(mutation("matches:updateStatus")).toHaveBeenCalledWith({
      matchId: "match-1",
      status: "dismissed",
    }),
  );
});

it("does not describe a paused search as active", () => {
  fixtures.needs[0]!.status = "paused";
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByText(
      "Your search is paused. Resume it to refresh your matches.",
    ),
  ).toBeInTheDocument();
});

it("opens and focuses one chat action for the current attention question", async () => {
  fixtures.opportunities = [
    {
      _id: "opportunity-1",
      savedNeedId: "need-current",
      kind: "supply_match",
      status: "reviewing",
      signalId: "signal-attention",
      score: 0.8,
      reasons: ["Der Raum passt zum Suchradius."],
      uncertainties: ["Ist Dienstagabend möglich?", "Wer bringt das Schlagzeug mit?"],
      firstSeenAt: 1,
      lastSeenAt: 1,
      updatedAt: 1,
    },
  ];
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );

  expect(screen.getAllByRole("button", { name: "Mit Scout klären" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Mit Scout klären" }));

  const composer = await screen.findByLabelText("Message your Room Scout");
  expect(composer).toHaveFocus();
  await waitFor(() =>
    expect(mutation("scout:setFocus")).toHaveBeenCalledWith({
      threadId: "thread",
      mode: "signal_advisor",
      activeNeedId: "need-current",
      focusedSignalId: "signal-attention",
    }),
  );
  await waitFor(() =>
    expect(action("scout:sendMessage")).toHaveBeenCalledWith({
      threadId: "thread",
      message:
        "Hilf mir, diese offene Frage zur aktuellen Gelegenheit zu klären: Ist Dienstagabend möglich?",
    }),
  );
});

it("does not claim provider outreach from a match uncertainty alone", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [
    {
      _id: "opportunity-autopilot",
      savedNeedId: "need-current",
      kind: "supply_match",
      status: "new",
      signalId: "signal-autopilot",
      score: 0.8,
      reasons: ["The room fits."],
      uncertainties: ["Can the drum kit remain in secure storage?"],
      firstSeenAt: 1,
      lastSeenAt: 1,
      updatedAt: 1,
    },
  ];
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", {
    name: "Ich habe einen passenden Raum gefunden.",
  })).toBeInTheDocument();
  expect(screen.getByText(
    "Offen ist: Can the drum kit remain in secure storage?",
  )).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Mit Scout klären" })).not.toBeInTheDocument();
});

it("reports a blocked portal setup without claiming the provider was contacted", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-blocked", savedNeedId: "need-current", kind: "supply_match",
    status: "new", signalId: "signal-blocked", score: 0.8, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.portalConnections = [{
    _id: "connection-1", baseUrl: "https://roomscout.dev", status: "needs_auth",
    lastErrorCode: "AGENT_REGISTRATION_BROWSER_LAUNCH_SESSION",
  }];
  render(<MemoryRouter><ScoutPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Der nächste Schritt ist blockiert." })).toBeInTheDocument();
  expect(screen.getByText(/Der Anbieter wurde nicht kontaktiert/)).toBeInTheDocument();
});

it.each([
  {
    label: "registration",
    action: null,
    heading: "Der Portalzugang wird gerade eingerichtet.",
    detail: "Die Registrierung läuft; der Anbieter wurde noch nicht kontaktiert.",
  },
  {
    label: "pending outreach",
    action: { _id: "outreach-action", savedNeedId: "need-current", requestedActionType: "send_platform_dm", status: "awaiting_approval" },
    heading: "Die Anfrage ist vorbereitet, aber noch nicht gesendet.",
    detail: "Es gibt einen Entwurf oder eine ausstehende Freigabe.",
  },
])("reports $label without claiming a completed send", ({ label, action, heading, detail }) => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-progress", savedNeedId: "need-current", kind: "supply_match",
    status: "new", signalId: "signal-progress", score: 0.8, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.externalActions = action ? [action] : [];
  if (label === "registration") {
    fixtures.portalConnections = [{
      _id: "connection-registering", baseUrl: "https://roomscout.dev", status: "needs_auth",
    }];
    fixtures.portalRuns = [{
      _id: "run-registering", connectionId: "connection-registering", kind: "authenticate", status: "running",
    }];
  }
  render(<MemoryRouter><ScoutPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  expect(screen.getByText(detail)).toBeInTheDocument();
  expect(screen.queryByText(/Anfrage ist gesendet/)).not.toBeInTheDocument();
});

it("reports a ready portal without claiming outreach", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-ready", savedNeedId: "need-current", kind: "supply_match",
    status: "new", signalId: "signal-ready", score: 0.8, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.portalConnections = [{
    _id: "connection-ready", baseUrl: "https://roomscout.dev", status: "active",
  }];
  render(<MemoryRouter><ScoutPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Ich habe einen passenden Raum gefunden." })).toBeInTheDocument();
  expect(screen.getByText("Der Portalzugang ist bereit; der Anbieter wurde noch nicht kontaktiert.")).toBeInTheDocument();
});

it("treats a registration waiting for a person as blocked, not running", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-human", savedNeedId: "need-current", kind: "supply_match",
    status: "new", signalId: "signal-human", score: 0.8, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.portalConnections = [{
    _id: "connection-human", baseUrl: "https://roomscout.dev", status: "needs_auth",
  }];
  fixtures.portalRuns = [{
    _id: "run-human", connectionId: "connection-human", kind: "authenticate",
    status: "human_required", onboardingStage: "human_required",
  }];
  render(<MemoryRouter><ScoutPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Der nächste Schritt ist blockiert." })).toBeInTheDocument();
  expect(screen.queryByText(/Registrierung läuft/)).not.toBeInTheDocument();
});

it("reports an executed outreach as sent and waiting for a reply", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-sent", savedNeedId: "need-current", kind: "supply_match",
    status: "contacted", signalId: "signal-sent", score: 0.8, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.externalActions = [{
    _id: "action-1", savedNeedId: "need-current", requestedActionType: "send_platform_dm",
    status: "executed",
  }];
  render(<MemoryRouter><ScoutPage /></MemoryRouter>);
  expect(screen.getByRole("heading", {
    name: "Die Anfrage ist gesendet. Ich warte auf die Antwort.",
  })).toBeInTheDocument();
  expect(screen.getByText("Der Anbieter wurde kontaktiert; eine Antwort ist noch offen.")).toBeInTheDocument();
});

it("prioritizes a current ready provider offer over stale uncertainties and an executed action", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-stale-question", savedNeedId: "need-current", kind: "supply_match",
    status: "contacted", signalId: "signal-provider", score: 0.9, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.externalActions = [{
    _id: "action-before-offer", savedNeedId: "need-current", requestedActionType: "send_platform_dm",
    status: "executed",
  }];
  fixtures.providerConversations = [providerConversation({ current: true, ready: true })];

  render(<MemoryRouter><ScoutPage /></MemoryRouter>);

  expect(screen.getByRole("heading", {
    name: "Ich habe einen passenden Raum für euch geklärt.",
  })).toBeInTheDocument();
  expect(screen.getByText(
    "Der Anbieter hat die offenen Punkte bestätigt. Prüft das Angebot – zugesagt oder gebucht ist noch nichts.",
  )).toBeInTheDocument();
  expect(screen.queryByText("Die Anfrage ist gesendet. Ich warte auf die Antwort.")).not.toBeInTheDocument();
});

it("shows a current non-ready provider update instead of waiting for a reply", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-old-question", savedNeedId: "need-current", kind: "supply_match",
    status: "contacted", signalId: "signal-provider", score: 0.9, reasons: ["The room fits."],
    uncertainties: ["Old unanswered question"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.providerConversations = [providerConversation({ current: true, ready: false })];

  render(<MemoryRouter><ScoutPage /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Der Anbieter hat geantwortet." })).toBeInTheDocument();
  expect(screen.getByText(
    "Hier seht ihr die Antwort und welche Punkte noch offen sind.",
  )).toBeInTheDocument();
  expect(screen.getByText("Der Anbieter hat geantwortet, aber eine Bedingung ist noch offen.")).toBeInTheDocument();
  expect(screen.queryByText("Die Anfrage ist gesendet. Ich warte auf die Antwort.")).not.toBeInTheDocument();
});

it("never presents a stale ready offer as a successfully clarified room", () => {
  fixtures.providerConversations = [providerConversation({ current: false, ready: true })];

  render(<MemoryRouter><ScoutPage /></MemoryRouter>);

  expect(screen.queryByRole("heading", {
    name: "Ich habe einen passenden Raum für euch geklärt.",
  })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("out of date");
});

it("keeps a paused search paused when a current ready offer exists", () => {
  fixtures.needs[0]!.status = "paused";
  fixtures.providerConversations = [providerConversation({ current: true, ready: true })];

  render(<MemoryRouter><ScoutPage /></MemoryRouter>);

  expect(screen.getByRole("heading", { name: "Eure Suche macht eine Pause." })).toBeInTheDocument();
  expect(screen.queryByRole("heading", {
    name: "Ich habe einen passenden Raum für euch geklärt.",
  })).not.toBeInTheDocument();
});

it("shows the latest failed outreach even when an older provider thread exists", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.opportunities = [{
    _id: "opportunity-retry", savedNeedId: "need-current", kind: "supply_match",
    status: "contacted", signalId: "signal-retry", score: 0.8, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  fixtures.providerConversations = [{
    conversationId: "conversation-old", savedNeedId: "need-current",
    platformThreadId: "thread-old",
  }];
  fixtures.externalActions = [{
    _id: "action-failed", savedNeedId: "need-current", requestedActionType: "send_platform_dm",
    status: "failed",
  }];
  render(<MemoryRouter><ScoutPage /></MemoryRouter>);
  expect(screen.getByRole("heading", { name: "Der nächste Schritt ist blockiert." })).toBeInTheDocument();
  expect(screen.queryByText(/Anfrage ist gesendet/)).not.toBeInTheDocument();
});

it("does not say there are no matches while waiting on an Autopilot next step", () => {
  fixtures.activeMandate = { mode: "negotiation_autopilot" };
  fixtures.matches = [{
    _id: "match-1", signalId: "signal-1", reasons: ["Same city"], uncertainties: [],
    signal: { _id: "signal-1", title: "Suitable room", side: "supply", city: "Stuttgart",
      summary: "Shared room", arrangement: "shared", requirements: [], unknowns: [],
      status: "published", verification: "observed", sourceCount: 1, firstSeenAt: 1, lastSeenAt: 1 },
  }];
  fixtures.opportunities = [{
    _id: "opportunity-1", savedNeedId: "need-current", kind: "supply_match",
    status: "new", signalId: "signal-1", score: 0.8, reasons: ["The room fits."],
    uncertainties: ["Is the room still available?"], firstSeenAt: 1, lastSeenAt: 1, updatedAt: 1,
  }];
  render(<MemoryRouter><ScoutPage /></MemoryRouter>);
  expect(screen.getByText("1 current match for Stuttgart.")).toBeInTheDocument();
  expect(screen.queryByText(/No current matches/)).not.toBeInTheDocument();
});

it("shows a retry after draft initialization fails without starting voice or provider work", async () => {
  fixtures.needs = [];
  const initialize = mutation("savedNeeds:getOrCreateDraft");
  initialize
    .mockRejectedValueOnce(new Error("provider unavailable"))
    .mockResolvedValueOnce(null);
  render(
    <MemoryRouter>
      <ScoutPage />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Erneut versuchen" }),
    ).toBeInTheDocument(),
  );
  expect(fixtures.voice.connect).not.toHaveBeenCalled();
  expect(action("scout:sendMessage")).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
  await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
  expect(fixtures.voice.connect).not.toHaveBeenCalled();
});
