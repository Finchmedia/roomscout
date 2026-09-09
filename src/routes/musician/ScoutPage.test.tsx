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
      districts: [],
      requirements: [],
      schedule: [],
      arrangement: ["shared"],
      status: "active",
    },
  ],
  activeNeedId: "need-current",
  matches: [] as unknown[],
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
    if (
      name === "outreach:listMine" ||
      name === "opportunities:listMine" ||
      name === "providerConversations:listMine"
    )
      return [];
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
      districts: [],
      requirements: [],
      schedule: [],
      arrangement: ["shared"],
      status: "active",
    },
  ];
  fixtures.activeNeedId = "need-current";
  fixtures.matches = [];
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
    { ...fixtures.needs[0]!, _id: "need-first", city: "Berlin" },
    { ...fixtures.needs[0]!, _id: "need-selected", city: "Hamburg" },
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
