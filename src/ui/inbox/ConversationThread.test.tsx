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

vi.mock("../../components/opportunities/OfferAcceptanceDialog", () => ({
  OfferAcceptanceFlow: ({ expectedOfferHash, offerId }: { expectedOfferHash: string; offerId: string }) => (
    <div data-testid="acceptance-flow">{offerId}:{expectedOfferHash}</div>
  ),
}));

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
    progress: "reply_received", hasProviderReply: true, canRetryAssessment: false,
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
  onRetry?: () => Promise<void>;
} = {}) {
  return render(
    <MemoryRouter>
      <ConversationThread
        header={options.head ?? header()}
        items={options.rows ?? []}
        now={NOW}
        onSend={options.onSend ?? (async () => true)}
        onRetryAssessment={options.onRetry}
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
    expect(provider).toHaveTextContent("Today, 09:41");

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

  it.each([
    ["drafted", false, "Dein Scout bereitet diese Nachricht vor."],
    ["awaiting_approval", false, "Diese Nachricht wartet auf deine Freigabe."],
    ["queued", false, "Dein Scout sendet diese Nachricht gerade."],
    ["executing", true, "Der Versand konnte nicht bestätigt werden. Prüfe den Verlauf, bevor du es erneut versuchst."],
    ["failed", false, "Diese Nachricht wurde nicht gesendet."],
  ] as const)("aligns the composer with a %s pending message", (status, outcomeUnknown, hint) => {
    renderThread({
      head: header({ channel: "none", progress: "preparing_inquiry", hasProviderReply: false, composer: { enabled: false, reason: "channel_not_ready" } }),
      rows: items({ kind: "pending_message", id: "r1", at: AT, author: "scout", text: "Ist der Raum noch frei?", status, outcomeUnknown }),
    });

    expect(screen.getByText(hint)).toBeVisible();
    expect(screen.queryByText("Noch kein Kanal")).not.toBeInTheDocument();
    expect(screen.getByText("Berlin")).toBeVisible();
  });

  it.each([
    ["sent", "Gesendet"],
    ["delivered", "Zugestellt"],
    ["bounced", "Zustellung fehlgeschlagen"],
  ] as const)("shows the actual %s delivery state on an outbound receipt", (deliveryStatus, label) => {
    renderThread({
      rows: items({ kind: "sent_message", id: "m1", at: AT, author: "scout", text: "Ist der Raum frei?", deliveryStatus }),
    });
    expect(screen.getByRole("group", { name: "Dein Scout" })).toHaveTextContent(label);
  });

  it("does not let an old failed request override a newer outbound receipt", () => {
    renderThread({
      head: header({ progress: "inquiry_sent", hasProviderReply: false, composer: { enabled: false, reason: "assessment_required" } }),
      rows: items(
        { kind: "pending_message", id: "r1", at: AT, author: "scout", text: "Alter Versuch", status: "failed" },
        { kind: "sent_message", id: "m1", at: AT + 1000, author: "scout", text: "Neue Nachricht", deliveryStatus: "delivered" },
      ),
    });
    expect(screen.getByText("Deine Nachricht wurde gesendet. Dein Scout wartet auf die Antwort des Anbieters.")).toBeVisible();
    expect(screen.queryByText("Diese Nachricht wurde nicht gesendet.")).not.toBeInTheDocument();
    expect(screen.queryByText("Dieser Kandidat wurde noch nicht kontaktiert.")).not.toBeInTheDocument();
  });

  it("does not call a conversation awaiting reply while a newer provider reply is being reviewed", () => {
    renderThread({
      head: header({ progress: "reviewing_reply", hasProviderReply: true, composer: { enabled: false, reason: "thinking" } }),
      rows: items(
        { kind: "sent_message", id: "m1", at: AT, author: "scout", text: "Ist der Raum frei?", deliveryStatus: "delivered" },
        { kind: "provider_message", id: "m2", at: AT + 1000, label: "Anna", text: "Ja, er ist frei." },
      ),
    });
    expect(screen.getByText("Dein Scout wertet gerade aus …")).toBeVisible();
    expect(screen.queryByText(/wartet auf die Antwort des Anbieters/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("radio", { name: "Ja, so senden" }));
    fireEvent.click(screen.getByRole("button", { name: "Antworten" }));
    expect(onAnswerDecision).toHaveBeenCalledWith("d1", "yes", undefined);
  });

  it("passes a typed answer through as the custom choice with its text", () => {
    const onAnswerDecision = vi.fn().mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <ConversationThread
          header={header()}
          items={items({
            kind: "decision", id: "d1", at: AT,
            decision: {
              _id: "d1", kind: "review_message", status: "open",
              question: "Soll ich diese Nachricht so senden?",
              options: [{ id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" }],
              refs: {}, createdAt: AT, updatedAt: AT,
            },
          })}
          now={NOW}
          onSend={async () => true}
          onAnswerDecision={onAnswerDecision}
        />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Was soll anders sein?" }), {
      target: { value: "frag auch nach der Kaution" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Antworten" }));
    expect(onAnswerDecision).toHaveBeenCalledWith("d1", "custom", "frag auch nach der Kaution");
  });

  it("opens the acceptance review from a staged Zusage instead of sending to the chat", () => {
    render(
      <MemoryRouter>
        <ConversationThread
          header={header()}
          items={items({
            kind: "pending_message", id: "r1", at: AT, author: "acceptance",
            text: "Wir nehmen den Raum ab dem 1. Oktober.", status: "awaiting_approval",
          })}
          now={NOW}
          onSend={async () => true}
          onAnswerDecision={async () => undefined}
          offerConversation={{
            conversationId: "c1",
            offer: { offerId: "offer-1", contentHash: "hash-1", ready: true, current: true },
          } as never}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Zusage wartet auf deine Freigabe")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Entscheidung öffnen" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zusage prüfen" }));
    expect(screen.getByTestId("acceptance-flow")).toHaveTextContent("offer-1:hash-1");
  });

  it("shows a bounded Scout update and one private answered Q&A without internal action ids", () => {
    renderThread({
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
        {
          kind: "musician_input", id: "input-d2", at: AT + 2,
          text: "Ja, so senden", decisionId: "d2",
        },
      ),
    });

    const update = screen.getByRole("group", { name: "Scout-Update" });
    expect(within(update).getByText("Scout-Update")).toBeVisible();
    expect(within(update).getByText("Der Raum kostet 280 € und ist ab Oktober frei.")).not.toBeVisible();
    fireEvent.click(within(update).getByText("Scout-Update"));
    expect(within(update).getByText("Der Raum kostet 280 € und ist ab Oktober frei.")).toBeVisible();
    expect(update).toHaveTextContent("Today, 09:41");
    expect(screen.queryByText(/ask_provider/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nächster Schritt/)).not.toBeInTheDocument();

    const qa = screen.getByRole("group", { name: "Private Scout-Frage" });
    expect(qa).toHaveTextContent("Frage deines Scouts");
    expect(qa).toHaveTextContent("Soll ich diese Nachricht so senden?");
    expect(qa).toHaveTextContent("Deine Antwort");
    expect(qa).toHaveTextContent("Ja, so senden");
    expect(qa).toHaveTextContent("Beantwortet");
    expect(screen.queryByRole("group", { name: "Du an deinen Scout" })).not.toBeInTheDocument();
  });

  it("groups every answered round question in the private Scout card and hides duplicate input bubbles", () => {
    renderThread({ rows: items(
      {
        kind: "decision", id: "round-1", at: AT,
        decision: {
          _id: "round-1", kind: "scout_question", status: "answered",
          question: "Passt Mittwochabend?", options: [{ id: "wed", label: "Ja, Mittwoch passt" }], refs: {},
          questions: [
            { id: "schedule", constraintKeys: ["schedule"], question: "Passt Mittwochabend?", options: [{ id: "wed", label: "Ja, Mittwoch passt" }], answer: { choice: "wed", at: AT } },
            { id: "sound", constraintKeys: ["sound"], question: "Ist akustisches Spielen möglich?", options: [{ id: "electronic", label: "Nein, nur elektronisch" }], answer: { choice: "electronic", at: AT + 1 } },
          ],
          answer: { choice: "electronic", at: AT + 1 }, createdAt: AT, updatedAt: AT + 1,
        },
      },
      { kind: "musician_input", id: "round-answer-1", at: AT, text: "Ja, Mittwoch passt", decisionId: "round-1" },
      { kind: "musician_input", id: "round-answer-2", at: AT + 1, text: "Nein, nur elektronisch", decisionId: "round-1" },
    ) });

    const card = screen.getByRole("group", { name: "Private Scout-Frage" });
    expect(card).toHaveTextContent("Passt Mittwochabend?");
    expect(card).toHaveTextContent("Ja, Mittwoch passt");
    expect(card).toHaveTextContent("Ist akustisches Spielen möglich?");
    expect(card).toHaveTextContent("Nein, nur elektronisch");
    expect(screen.queryByRole("group", { name: "Du an deinen Scout" })).not.toBeInTheDocument();
  });

  it("sends the musician's own text from the provider panel", () => {
    const onSend = vi.fn().mockResolvedValue(true);
    renderThread({ onSend, rows: items({ kind: "provider_message", id: "m1", at: AT, label: "Anna", text: "Freitag wäre möglich." }) });
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

  it("shows a failed initial review and retries only after an explicit click", () => {
    const retry = vi.fn().mockResolvedValue(undefined);
    renderThread({ head: header({ channel: "none", state: "needs_attention", progress: "assessment_failed", hasProviderReply: false, canRetryAssessment: true, composer: { enabled: false, reason: "channel_not_ready" } }), onRetry: retry });
    expect(screen.queryByText(/letzte Antwort/)).not.toBeInTheDocument();
    expect(screen.queryByText("Dein Scout bereitet die erste Nachricht vor.")).not.toBeInTheDocument();
    expect(retry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Prüfung wiederholen" }));
    expect(retry).toHaveBeenCalledTimes(1);
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
