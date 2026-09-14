/**
 * `ConversationThread` — the item union, rendered.
 *
 * The assertions are the two promises the surface makes: the Anbieter, the
 * Scout and the musician never share a side or a speaker label, and nothing
 * that has not left the building is presented as sent.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ConversationThread, type ThreadHeader, type ThreadItem } from "./ConversationThread";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const AT = new Date(2026, 8, 14, 9, 41).getTime();
const NOW = new Date(2026, 8, 14, 11, 0).getTime();

function header(overrides: Partial<ThreadHeader> = {}): ThreadHeader {
  return {
    conversationId: "c1",
    savedNeedId: "n1",
    signalId: "s1",
    title: "Proberaum Neukölln",
    subtitle: "Berlin",
    channel: "platform",
    state: "waiting",
    providerLabel: "Anna Meier",
    offer: null,
    composer: { enabled: true },
    ...overrides,
  } as unknown as ThreadHeader;
}

function items(...rows: unknown[]): ThreadItem[] {
  return rows as ThreadItem[];
}

function renderThread(options: {
  head?: ThreadHeader;
  rows?: ThreadItem[];
  onSend?: (body: string) => Promise<boolean>;
} = {}) {
  return render(
    <MemoryRouter>
      <ConversationThread
        header={options.head ?? header()}
        items={options.rows ?? []}
        now={NOW}
        onSend={options.onSend ?? (async () => true)}
        onAnswerDecision={async () => undefined}
      />
    </MemoryRouter>
  );
}

describe("ConversationThread", () => {
  afterEach(cleanup);
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    Element.prototype.scrollTo = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  it("puts the Anbieter left and both Scout and musician right, each with its own speaker", () => {
    const { container } = renderThread({
      rows: items(
        { kind: "provider_message", id: "m1", at: AT, label: "Anna Meier", text: "Der Raum ist frei." },
        { kind: "sent_message", id: "m2", at: AT + 1000, author: "scout", text: "Wann können wir kommen?" },
        { kind: "sent_message", id: "m3", at: AT + 2000, author: "musician", text: "Gern am Freitag." },
        { kind: "musician_input", id: "m4", at: AT + 3000, text: "Frag nach der Kaution." },
      ),
    });

    const provider = screen.getByRole("group", { name: "Anna Meier" });
    expect(provider).toHaveAttribute("data-align", "start");
    expect(provider).toHaveTextContent("Der Raum ist frei.");
    expect(provider).toHaveTextContent("Heute, 09:41");

    const scout = screen.getByRole("group", { name: "Dein Scout" });
    expect(scout).toHaveAttribute("data-align", "end");
    expect(scout).toHaveTextContent("Wann können wir kommen?");

    const own = screen.getByRole("group", { name: "Du" });
    expect(own).toHaveAttribute("data-align", "end");
    expect(own).toHaveTextContent("Gern am Freitag.");

    const toScout = screen.getByRole("group", { name: "Du an deinen Scout" });
    expect(toScout).toHaveAttribute("data-align", "end");
    expect(toScout).toHaveTextContent("Frag nach der Kaution.");

    expect(container.querySelectorAll('[data-slot="message"][data-align="start"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-slot="message"][data-align="end"]')).toHaveLength(3);
  });

  it("never calls a waiting message sent and names the Freigabeprüfung's reason", () => {
    renderThread({
      rows: items(
        {
          kind: "pending_message", id: "r1", at: AT, author: "musician",
          text: "Wir nehmen den Raum.", status: "awaiting_approval",
        },
        {
          kind: "pending_message", id: "r2", at: AT + 1000, author: "scout",
          text: "Ist der Raum noch frei?", status: "blocked",
          gateReason: "connection_not_ready", gateText: "Die Verbindung zum Portal ist nicht bereit.",
        },
        { kind: "pending_message", id: "r3", at: AT + 2000, author: "scout", text: "Unterwegs.", status: "queued" },
      ),
    });

    expect(screen.getByText("Wartet auf deine Freigabe")).toBeVisible();
    expect(screen.getByRole("link", { name: "Entscheidung öffnen" })).toHaveAttribute("href", "/app/scout");
    expect(screen.getByText("Die Verbindung zum Portal ist nicht bereit.")).toBeVisible();
    expect(screen.getByText("Wird gesendet …")).toBeVisible();
    expect(screen.queryByText(/gesendet\.$/)).toBeNull();
  });

  it("answers an open Entscheidung in place and keeps the Freigabe link out of the way", () => {
    const onAnswerDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ConversationThread
          header={header()}
          items={items(
            {
              kind: "pending_message", id: "r1", at: AT, author: "scout",
              text: "Ist der Raum frei?", status: "awaiting_approval",
            },
            {
              kind: "decision", id: "d1", at: AT + 1,
              decision: {
                _id: "d1", kind: "review_message", status: "open",
                question: "Soll ich diese Nachricht so senden?",
                options: [{ id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" }],
                refs: {}, createdAt: AT, updatedAt: AT,
              },
            },
          )}
          now={NOW}
          onSend={async () => true}
          onAnswerDecision={onAnswerDecision}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("link", { name: "Entscheidung öffnen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ja, so senden" }));
    expect(onAnswerDecision).toHaveBeenCalledWith("d1", "yes");
  });

  it("collapses a Scout note to one line and records an answered Entscheidung as a marker", () => {
    const { container } = renderThread({
      rows: items(
        {
          kind: "scout_note", id: "o1", at: AT, revision: 2,
          summary: "Der Raum kostet 280 € und ist ab Oktober frei.",
          nextAction: "ask_provider",
        },
        {
          kind: "decision", id: "d2", at: AT + 1,
          decision: {
            _id: "d2", kind: "review_message", status: "answered",
            question: "Soll ich diese Nachricht so senden?",
            options: [{ id: "yes", label: "Ja, so senden" }],
            refs: {}, answer: { choice: "yes", at: AT }, createdAt: AT, updatedAt: AT,
          },
        },
      ),
    });

    const note = container.querySelector("summary");
    expect(note).toHaveTextContent("Dein Scout: Der Raum kostet 280 € und ist ab Oktober frei.");
    expect(note?.className).toContain("truncate");
    expect(screen.getByText("Entscheidung: Soll ich diese Nachricht so senden? → Ja, so senden")).toBeVisible();
  });

  it("sends the musician's own text and shows the empty thread while the Scout prepares", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    renderThread({ onSend });

    expect(screen.getByText("Dein Scout bereitet die erste Nachricht vor.")).toBeVisible();
    const composer = screen.getByRole("textbox", { name: "Nachricht an den Anbieter …" });
    fireEvent.change(composer, { target: { value: "Passt der Freitag?" } });
    fireEvent.keyDown(composer, { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("Passt der Freitag?");
  });

  it("disables the composer with the German reason while the Scout is assessing", () => {
    renderThread({
      head: header({ state: "thinking", composer: { enabled: false, reason: "thinking" } } as Partial<ThreadHeader>),
    });
    expect(screen.getByRole("textbox", { name: "Nachricht an den Anbieter …" })).toBeDisabled();
    expect(screen.getByText("Dein Scout wertet gerade aus …")).toBeVisible();
  });

  it("names the conversation and its channel in the head", () => {
    renderThread();
    expect(screen.getByRole("heading", { name: "Proberaum Neukölln" })).toBeVisible();
    expect(screen.getByText("Berlin · Portal")).toBeVisible();
  });

  it("shows the composer's hint for a closed conversation instead of a send path", () => {
    renderThread({
      head: header({ state: "closed", composer: { enabled: false, reason: "closed" } } as Partial<ThreadHeader>),
    });
    const form = screen.getByRole("textbox", { name: "Nachricht an den Anbieter …" }).closest("form")!;
    expect(within(form).getByRole("button", { name: "Senden" })).toBeDisabled();
    expect(screen.getByText("Diese Unterhaltung ist beendet.")).toBeVisible();
  });
});
