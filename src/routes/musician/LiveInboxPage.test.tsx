import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type React from "react";
import { getFunctionName } from "convex/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveInboxPage } from "./LiveInboxPage";

const useQuery = vi.fn();
const mutations = vi.hoisted(() => ({
  reply: vi.fn(async () => ({ requestId: "r1", status: "approved", dispatched: true, sent: false })),
  markRead: vi.fn(async () => null),
  answer: vi.fn(async () => ({ status: "answered" })),
}));

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQuery(...args),
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(reference);
    if (name === "conversations:reply") return mutations.reply;
    if (name === "conversations:markRead") return mutations.markRead;
    return mutations.answer;
  },
}));

vi.mock("../../ui/copy", () => ({
  useCopy: () => ({ t: (key: string) => key, tp: (key: string, n: number) => `${key}:${n}`, locale: "de" }),
}));

vi.mock("../../components/navigation/LiveProfileMenu", () => ({
  LiveProfileMenu: ({ name }: { name: string }) => <span>profile:{name}</span>,
}));

// The shell is exercised by `src/ui/chrome/PanelDialog.test.tsx`; here it only
// has to expose the rows with their `meta` so the page's own mapping is visible.
vi.mock("../../ui/chrome/PanelDialog", () => ({
  PanelDialog: ({ children, groups, navHeader, onOpenChange, currentId }: {
    children: React.ReactNode;
    groups: Array<{ items: Array<{ id: string; label: string; onSelect?: () => void; meta?: { preview?: string; time?: string; status?: string; dot?: boolean } }> }>;
    navHeader: React.ReactNode;
    onOpenChange: (open: boolean) => void;
    currentId?: string;
  }) => <div>
    <button onClick={() => onOpenChange(false)}>close-inbox</button>
    <div data-testid="nav-header">{navHeader}</div>
    <ul>
      {groups.flatMap((group) => group.items).map((item) => <li key={item.id}>
        <button data-current={item.id === currentId} onClick={item.onSelect}>{item.label}</button>
        <span data-testid={`preview-${item.id}`}>{item.meta?.preview}</span>
        <span data-testid={`time-${item.id}`}>{item.meta?.time}</span>
        <span data-testid={`status-${item.id}`}>{item.meta?.status}</span>
        {item.meta?.dot ? <span data-testid={`dot-${item.id}`}>unread</span> : null}
      </li>)}
    </ul>
    {children}
  </div>,
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const AT = new Date(2026, 8, 14, 9, 41).getTime();

function row(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: "c1", savedNeedId: "n1", signalId: "s1",
    title: "Proberaum Neukölln", subtitle: "Berlin", channel: "platform",
    state: "waiting", revision: 1, lastActivityAt: AT, unread: true,
    preview: { author: "provider", text: "Der Raum ist frei.", at: AT },
    providerLabel: "Anna Meier",
    ...overrides,
  };
}

function thread(overrides: Record<string, unknown> = {}) {
  return {
    header: {
      conversationId: "c1", savedNeedId: "n1", signalId: "s1",
      title: "Proberaum Neukölln", subtitle: "Berlin", channel: "platform",
      state: "waiting", providerLabel: "Anna Meier", offer: null,
      progress: "reply_received", hasProviderReply: true, canRetryAssessment: false,
      composer: { enabled: true },
      ...(overrides.header as Record<string, unknown> ?? {}),
    },
    items: (overrides.items as unknown[]) ?? [],
  };
}

function fixture(options: { rows?: unknown[]; threads?: Record<string, unknown> } = {}) {
  useQuery.mockReset();
  const rows = options.rows ?? [row()];
  const threads = options.threads ?? { c1: thread() };
  useQuery.mockImplementation((reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference);
    if (name === "users:current") return { _id: "u1", displayName: "Hanna Berg", role: "musician" };
    if (name === "conversations:listMine") return rows;
    if (name === "providerConversations:listMine") return [];
    if (name === "conversations:getMine") {
      if (args === "skip") return undefined;
      const id = (args as { conversationId: string }).conversationId;
      return threads[id] ?? null;
    }
    return undefined;
  });
}

function renderRoute(path = "/app/inbox/c1") {
  return render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/app/inbox/:conversationId?" element={<LiveInboxPage />} />
    <Route path="/app/scout" element={<p>Scout route</p>} />
  </Routes></MemoryRouter>);
}

describe("LiveInboxPage", () => {
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    Element.prototype.scrollTo = () => {};
    Element.prototype.scrollIntoView = () => {};
  });
  beforeEach(() => {
    // The stamps are relative to "now": freeze the clock on the fixture's day.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 14, 12, 0));
    fixture();
    mutations.reply.mockClear();
    mutations.markRead.mockClear();
    mutations.answer.mockClear();
  });

  it("lists the conversations with author-prefixed previews, a stamp and the unread mark", () => {
    fixture({
      rows: [
        row(),
        row({
          conversationId: "c2", title: "Bandkeller Wedding", unread: false,
          preview: { author: "musician", text: "Danke!", at: AT }, state: "offer_ready",
          offer: { offerId: "o2", ready: true, contentHash: "hash" },
        }),
      ],
      threads: { c1: thread(), c2: thread({ header: { conversationId: "c2", title: "Bandkeller Wedding" } }) },
    });
    renderRoute();

    expect(screen.getByTestId("preview-c1")).toHaveTextContent("liveInbox.previewProvider");
    expect(screen.getByTestId("preview-c2")).toHaveTextContent("liveInbox.previewYou");
    expect(screen.getByTestId("time-c1")).toHaveTextContent("09:41");
    expect(screen.getByTestId("status-c2")).toHaveTextContent("liveInbox.stateOfferReady");
    expect(screen.getByTestId("dot-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("dot-c2")).toBeNull();
    expect(screen.getByTestId("nav-header")).toHaveTextContent("liveInbox.count:2");
  });

  it("opens the clicked conversation", () => {
    fixture({
      rows: [row(), row({ conversationId: "c2", title: "Bandkeller Wedding" })],
      threads: {
        c1: thread(),
        c2: thread({ header: { conversationId: "c2", title: "Bandkeller Wedding" } }),
      },
    });
    renderRoute();
    expect(screen.getByRole("heading", { name: "Proberaum Neukölln" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Bandkeller Wedding" }));
    expect(screen.getByRole("heading", { name: "Bandkeller Wedding" })).toBeVisible();
  });

  it("marks the open conversation read", () => {
    renderRoute();
    expect(mutations.markRead).toHaveBeenCalledWith({ conversationId: "c1" });
  });

  it("renders the thread with the Anbieter left, both sent sides right and a waiting message named", () => {
    fixture({
      threads: {
        c1: thread({
          items: [
            { kind: "provider_message", id: "m1", at: AT, label: "Anna Meier", text: "Der Raum ist frei." },
            { kind: "sent_message", id: "m2", at: AT + 1, author: "scout", text: "Wann können wir kommen?" },
            { kind: "sent_message", id: "m3", at: AT + 2, author: "musician", text: "Gern am Freitag." },
            { kind: "pending_message", id: "r1", at: AT + 3, author: "scout", text: "Und die Kaution?", status: "awaiting_approval" },
            { kind: "scout_note", id: "o1", at: AT + 4, revision: 1, summary: "280 € warm.", nextAction: "ask_provider" },
          ],
        }),
      },
    });
    renderRoute();

    expect(screen.getByRole("group", { name: "Anna Meier" })).toHaveAttribute("data-align", "start");
    // The Scout speaks twice here: the sent message and the one still waiting.
    for (const scoutMessage of screen.getAllByRole("group", { name: "liveInbox.scout" })) {
      expect(scoutMessage).toHaveAttribute("data-align", "end");
    }
    expect(screen.getByRole("group", { name: "liveInbox.you" })).toHaveAttribute("data-align", "end");
    expect(screen.getByText("liveInbox.pendingApproval")).toBeVisible();
    expect(screen.getByText("liveInbox.scoutUpdate")).toBeVisible();
    expect(screen.queryByText(/ask_provider/)).not.toBeInTheDocument();
  });

  it("stages the musician's own reply through conversations.reply", async () => {
    renderRoute();
    const composer = screen.getByRole("textbox", { name: "liveInbox.composerPlaceholder" });
    fireEvent.change(composer, { target: { value: "Passt der Freitag?" } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(mutations.reply).toHaveBeenCalledWith({ conversationId: "c1", body: "Passt der Freitag?" });
    await screen.findByRole("textbox", { name: "liveInbox.composerPlaceholder" });
  });

  it("disables the composer with the German reason while the Scout is assessing", () => {
    fixture({
      threads: { c1: thread({ header: { state: "thinking", composer: { enabled: false, reason: "thinking" } } }) },
    });
    renderRoute();
    expect(screen.getByRole("textbox", { name: "liveInbox.composerPlaceholder" })).toBeDisabled();
    expect(screen.getByText("liveInbox.hintThinking")).toBeVisible();
  });

  it("offers the Scout instead of an empty list", () => {
    fixture({ rows: [], threads: {} });
    renderRoute("/app/inbox");
    expect(screen.getByText("liveInbox.empty")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "liveInbox.emptyAction" }));
    expect(screen.getByText("Scout route")).toBeVisible();
  });

  it("selects the newest conversation when the URL carries none", () => {
    fixture({
      rows: [row({ conversationId: "c2", title: "Bandkeller Wedding" }), row()],
      threads: {
        c1: thread(),
        c2: thread({ header: { conversationId: "c2", title: "Bandkeller Wedding" } }),
      },
    });
    renderRoute("/app/inbox");
    expect(screen.getByRole("heading", { name: "Bandkeller Wedding" })).toBeVisible();
  });

  it("keeps the panel close on the Scout and shows the profile menu in the header", () => {
    const { container } = renderRoute();
    expect(within(container).getByText("profile:Hanna Berg")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "close-inbox" }));
    expect(screen.getByText("Scout route")).toBeVisible();
  });

  it("shows a skeleton while the conversations are still loading", () => {
    useQuery.mockReset();
    useQuery.mockImplementation((reference: Parameters<typeof getFunctionName>[0]) => {
      const name = getFunctionName(reference);
      if (name === "users:current") return { _id: "u1", displayName: "Hanna Berg", role: "musician" };
      return undefined;
    });
    renderRoute("/app/inbox");
    expect(screen.getByRole("status", { name: "liveInbox.loading" })).toBeInTheDocument();
  });
});
