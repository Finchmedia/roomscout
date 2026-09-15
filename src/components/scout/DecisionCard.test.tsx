import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DecisionCard, type OpenDecision } from "./DecisionCard";
import { splitDecisionDetail } from "./decisionDetail";
import { LocaleCtx } from "@/ui/copy/LocaleProvider";
import { en } from "@/ui/copy/en";

vi.mock("../opportunities/OfferAcceptanceDialog", () => ({
  OfferAcceptanceFlow: ({ offerId, expectedOfferHash }: { offerId: string; expectedOfferHash: string }) => (
    <div role="dialog" aria-label="Angebot verbindlich annehmen">{offerId}:{expectedOfferHash}</div>
  ),
}));

function decision(overrides: Partial<OpenDecision> = {}): OpenDecision {
  return {
    _id: "decision-1" as OpenDecision["_id"],
    kind: "review_message",
    status: "open",
    question: "Soll ich diese Nachricht so senden?",
    detail: "Hallo, ist der Raum in Stuttgart-West noch frei?",
    options: [{ id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" }],
    refs: { requestId: "request-1" as NonNullable<OpenDecision["refs"]["requestId"]> },
    conversationId: "conversation-1" as NonNullable<OpenDecision["conversationId"]>,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof DecisionCard>[0]> = {}) {
  const onAnswer = props.onAnswer ?? vi.fn().mockResolvedValue(undefined);
  const view = render(<MemoryRouter><DecisionCard decision={decision()} onAnswer={onAnswer} {...props} /></MemoryRouter>);
  return { ...view, onAnswer };
}

/** The Entscheidung's own submit — not the chat composer's send. */
function submitAnswer() {
  fireEvent.click(screen.getByRole("button", { name: "Antworten" }));
}

afterEach(cleanup);

describe("DecisionCard", () => {
  it("renders the eyebrow, question, message detail and the prepared options", () => {
    renderCard();
    expect(screen.getByRole("group", { name: "Entscheidung" })).toBeInTheDocument();
    expect(screen.getByText("Soll ich diese Nachricht so senden?")).toBeInTheDocument();
    expect(screen.getByText("Hallo, ist der Raum in Stuttgart-West noch frei?")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Ja, so senden" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Nein, anders" })).toBeInTheDocument();
    // The answer is typed into the Entscheidung, never into the chat composer.
    expect(screen.queryByText("Oder schreib mir unten deine Antwort.")).not.toBeInTheDocument();
  });

  it("answers with the picked option and then shows the acknowledgement", async () => {
    const { onAnswer } = renderCard();
    fireEvent.click(screen.getByRole("radio", { name: "Ja, so senden" }));
    submitAnswer();
    expect(onAnswer).toHaveBeenCalledWith("yes", "Ja, so senden", undefined);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Danke, ich mache weiter."));
    expect(screen.queryByRole("radio", { name: "Ja, so senden" })).not.toBeInTheDocument();
  });

  it("sends a typed answer as the custom choice, with the text", async () => {
    const { onAnswer } = renderCard();
    fireEvent.change(screen.getByRole("textbox", { name: "Was soll anders sein?" }), {
      target: { value: "  bitte höflicher  " },
    });
    submitAnswer();
    expect(onAnswer).toHaveBeenCalledWith("custom", "bitte höflicher", "bitte höflicher");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Danke, ich mache weiter."));
  });

  it("says that a typed answer on a message kind goes to the Scout, not to the Anbieter", () => {
    renderCard();
    expect(screen.getByText("Was soll anders sein?", { selector: "label" })).toBeInTheDocument();
    expect(screen.getByText("Das liest dein Scout, der Anbieter bekommt es nicht zu sehen.")).toBeInTheDocument();
  });

  it("picking an option drops the text that was typed before it", () => {
    const { onAnswer } = renderCard();
    const field = screen.getByRole("textbox", { name: "Was soll anders sein?" });
    fireEvent.change(field, { target: { value: "doch lieber anders" } });
    fireEvent.click(screen.getByRole("radio", { name: "Ja, so senden" }));
    expect(field).toHaveValue("");
    submitAnswer();
    expect(onAnswer).toHaveBeenCalledWith("yes", "Ja, so senden", undefined);
  });

  it("answers nothing while no answer is given", () => {
    const { onAnswer } = renderCard();
    submitAnswer();
    expect(onAnswer).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Wähl eine Antwort oder schreib deine eigene.");
  });

  it("keeps the answers usable when the answer fails", async () => {
    const onAnswer = vi.fn().mockRejectedValue(new Error("offline"));
    renderCard({ onAnswer });
    fireEvent.click(screen.getByRole("radio", { name: "Nein, anders" }));
    submitAnswer();
    await waitFor(() => expect(screen.getByRole("button", { name: "Antworten" })).not.toBeDisabled());
    expect(screen.getByRole("radio", { name: "Nein, anders" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows private-data scopes as chips next to the message", () => {
    renderCard({ decision: decision({ kind: "private_data", detail: "Datenfelder: phone, address\n\nRuf mich an unter 0170." }) });
    const scopes = screen.getByRole("list", { name: "Betroffene Angaben" });
    expect(scopes).toHaveTextContent("phone");
    expect(scopes).toHaveTextContent("address");
    expect(screen.getByText("Ruf mich an unter 0170.")).toBeInTheDocument();
  });

  it("offer_ready opens the acceptance flow for the referenced offer", () => {
    renderCard({
      decision: decision({
        kind: "offer_ready", question: "Ein Angebot liegt vor. Willst du es prüfen?", detail: undefined,
        options: [{ id: "review", label: "Angebot prüfen" }, { id: "no", label: "Nicht dieses" }],
        refs: { offerId: "offer-1" as NonNullable<OpenDecision["refs"]["offerId"]> },
      }),
      offerHash: "hash-1",
    });
    expect(screen.getByRole("button", { name: "Nicht dieses" })).toBeInTheDocument();
    // No questionnaire here: the review dialog is the answer.
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Angebot prüfen" }));
    expect(screen.getByRole("dialog", { name: "Angebot verbindlich annehmen" })).toHaveTextContent("offer-1:hash-1");
  });

  it("localizes the fixed offer question while preserving the offer evidence and exact review target", () => {
    render(<LocaleCtx.Provider value={{ locale: "en", dict: en, availableLocales: ["en", "de"], setLocale: vi.fn() }}>
      <MemoryRouter><DecisionCard decision={decision({
        kind: "offer_ready", question: "Ein Angebot liegt vor. Willst du es prüfen?", detail: "EUR 180, Wednesday evenings.",
        options: [{ id: "review", label: "Angebot prüfen" }], refs: { offerId: "offer-en" as NonNullable<OpenDecision["refs"]["offerId"]> },
      })} offerHash="exact-en-hash" onAnswer={vi.fn()} /></MemoryRouter>
    </LocaleCtx.Provider>);
    expect(screen.getByText("An offer is ready. Would you like to review it?")).toBeInTheDocument();
    expect(screen.getByText("EUR 180, Wednesday evenings.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review offer" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("offer-en:exact-en-hash");
  });

  it("human_step links to the browser run and offers no answers", () => {
    renderCard({
      decision: decision({
        kind: "human_step", question: "Bei der Anmeldung im Portal brauche ich dich.", detail: undefined, options: [],
        refs: { runId: "run-1" as NonNullable<OpenDecision["refs"]["runId"]>, connectionId: "connection-1" as NonNullable<OpenDecision["refs"]["connectionId"]> },
      }),
    });
    expect(screen.getByRole("link", { name: "Im Browser weitermachen" })).toHaveAttribute("href", "/app/runs/run-1");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("human_step without a run links to the sources settings", () => {
    renderCard({ decision: decision({ kind: "human_step", options: [], refs: {}, detail: "Verbindung in den Einstellungen neu registrieren." }) });
    expect(screen.getByRole("link", { name: "Verbindung neu registrieren" })).toHaveAttribute("href", "/app/settings/sources");
  });

  it("uses the Scout's own labels for scout_question options and its own free-text label", () => {
    renderCard({
      decision: decision({
        kind: "scout_question", question: "Ist Stuttgart-West für euch okay?", detail: undefined,
        options: [{ id: "west_ok", label: "Ja, Stuttgart-West passt" }, { id: "no_west", label: "Nein, zu weit" }],
        refs: {},
      }),
    });
    expect(screen.getByRole("radio", { name: "Ja, Stuttgart-West passt" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Nein, zu weit" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Eigene Antwort" })).toBeInTheDocument();
    expect(screen.queryByText("Das liest dein Scout, der Anbieter bekommt es nicht zu sehen.")).not.toBeInTheDocument();
  });
});

describe("splitDecisionDetail", () => {
  it("splits private-data scopes from the message and leaves other details intact", () => {
    expect(splitDecisionDetail({ kind: "private_data", detail: "Datenfelder: phone\n\nText" })).toEqual({ scopes: ["phone"], message: "Text" });
    expect(splitDecisionDetail({ kind: "review_message", detail: "Text" })).toEqual({ scopes: [], message: "Text" });
    expect(splitDecisionDetail({ kind: "scout_question" })).toEqual({ scopes: [] });
  });
});
