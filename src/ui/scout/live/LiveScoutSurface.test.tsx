import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveScoutSurface } from "./LiveScoutSurface";
import type { LiveScoutStage, LiveScoutSurfaceProps } from "./types";

const copy: LiveScoutSurfaceProps["copy"] = {
  avatarLabel: "Profil",
  welcomeGreeting: (name) => `Hallo ${name}`,
  welcomeHeadline: "Was sucht ihr?",
  welcomeVoiceAction: "Mit Scout sprechen",
  welcomeChatAction: "Lieber schreiben",
  discoveryLabel: "Dein Scout",
  loadingHeadline: "Dein Scout macht sich bereit …",
  loadingStatus: "",
  briefHeadline: "So suche ich für euch.",
  workingHeadline: "Ich kümmere mich darum.",
  workingStatus: "Ich suche passende Räume.",
  blockedHeadline: "Hier brauche ich kurz deine Hilfe.",
  blockedStatus: "",
  providerUpdateHeadline: "Der Anbieter hat geantwortet.",
  providerUpdateStatus: "Ich prüfe die Antwort.",
  pausedHeadline: "Eure Suche macht eine Pause.",
  pausedStatus: "Euer Suchauftrag bleibt gespeichert.",
  pauseAction: "Pausieren",
  resumeAction: "Weiter",
  settingsAction: "Einstellungen",
  briefReviewAction: "Suchauftrag ansehen",
  activeStatus: "Scout unterwegs",
  pausedLabel: "Pausiert",
  chatTitle: "Mit deinem Scout schreiben",
  openCandidates: "Kandidaten",
  openBrief: "Suchauftrag",
  offerHeadline: "Ein Raum, der zu euch passt.",
  completeHeadline: "Eure Zusage ist angekommen.",
  completeStatus: "Eure Suche ist pausiert.",
};

function renderSurface(stage: LiveScoutStage, overrides: Partial<LiveScoutSurfaceProps> = {}) {
  return render(
    <MemoryRouter>
      <LiveScoutSurface
        stage={stage}
        band={{ displayName: "Test Band" }}
        copy={copy}
        onChat={vi.fn()}
        onCloseChat={vi.fn()}
        onVoice={vi.fn()}
        onReviewBrief={vi.fn()}
        onActivate={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onSettings={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe("live Scout surface columns", () => {
  it("keeps the brief beside the conversation during discovery", () => {
    renderSurface("discovery", {
      chatSlot: <div>Gespräch</div>,
      asideSlot: <div>Euer Suchauftrag</div>,
    });

    expect(screen.getAllByText("Euer Suchauftrag").length).toBeGreaterThan(0);
    expect(screen.getByText("Gespräch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suchauftrag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suchauftrag ansehen" })).not.toBeInTheDocument();
  });

  it("leaves discovery single-column while there is nothing to put beside it", () => {
    renderSurface("discovery", { chatSlot: <div>Gespräch</div> });
    expect(screen.getByText("Gespräch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suchauftrag ansehen" })).toBeInTheDocument();
  });

  it("keeps working status, candidates and saved brief accessible together", () => {
    renderSurface("working", {
      railSlot: <div>Kandidaten</div>,
      asideSlot: <div>Euer Suchauftrag</div>,
    });

    expect(screen.getByRole("heading", { name: "Ich kümmere mich darum." })).toBeInTheDocument();
    expect(screen.getAllByText("Kandidaten").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Euer Suchauftrag").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Kandidaten" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suchauftrag" })).toBeInTheDocument();
  });

  it("keeps side-sheet navigation reachable without duplicate conversation actions", () => {
    renderSurface("discovery", {
      chatSlot: <section data-scout-conversation="text"><textarea aria-label="Message your Scout" /></section>,
      railSlot: <div>Candidate one</div>,
      asideSlot: <div>{Array.from({ length: 40 }, (_, index) => <p key={index}>Saved fact {index + 1}</p>)}</div>,
    });

    expect(screen.getByRole("textbox", { name: "Message your Scout" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mit Scout sprechen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lieber schreiben" })).not.toBeInTheDocument();

    const candidates = screen.getByRole("button", { name: "Kandidaten" });
    expect(screen.getByRole("button", { name: "Suchauftrag" })).toBeInTheDocument();
    fireEvent.click(candidates);
    expect(screen.getAllByText("Candidate one").length).toBeGreaterThan(1);
  });

  it("says nothing where the Entscheidung card already asks the question", () => {
    renderSurface("blocked", { decisionSlot: <div>Soll ich das senden?</div> });
    expect(screen.getByRole("heading", { name: "Hier brauche ich kurz deine Hilfe." })).toBeInTheDocument();
    expect(screen.getAllByText("Soll ich das senden?")).toHaveLength(1);
  });

  it.each(["working", "blocked", "offer"] as const)(
    "hosts the Entscheidung above a focused room on the %s stage when no voice session carries it",
    (stage) => {
      renderSurface(stage, {
        detailSlot: <div>Room panel</div>,
        decisionSlot: <div>Soll ich das senden?</div>,
      });
      const decision = screen.getByText("Soll ich das senden?");
      const detail = screen.getByText("Room panel");
      expect(decision.parentElement).toHaveAttribute("data-detail-decision-host");
      expect(decision.compareDocumentPosition(detail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getAllByText("Soll ich das senden?")).toHaveLength(1);
    },
  );

  it("keeps one pinned voice subtree while typing gives way to an interactive offer", () => {
    let mounts = 0;
    let unmounts = 0;
    const reviewOffer = vi.fn();

    function VoiceProbe() {
      React.useEffect(() => {
        mounts += 1;
        return () => { unmounts += 1; };
      }, []);
      return <div data-testid="voice-probe">Active call controls</div>;
    }

    function Harness({ stage }: { stage: "discovery" | "offer" }) {
      return (
        <MemoryRouter>
          <LiveScoutSurface
            stage={stage}
            band={{ displayName: "Test Band" }}
            copy={copy}
            voiceSlot={<VoiceProbe />}
            chatSlot={stage === "discovery" ? <div>Text composer and history</div> : undefined}
            offerSlot={stage === "offer" ? <button type="button" onClick={reviewOffer}>Review exact offer</button> : undefined}
            asideSlot={<div>All saved facts</div>}
            onChat={vi.fn()}
            onCloseChat={vi.fn()}
            onVoice={vi.fn()}
            onReviewBrief={vi.fn()}
            onActivate={vi.fn()}
            onPause={vi.fn()}
            onResume={vi.fn()}
            onSettings={vi.fn()}
          />
        </MemoryRouter>
      );
    }

    const view = render(<Harness stage="discovery" />);
    const voiceNode = screen.getByTestId("voice-probe");
    expect(screen.getAllByTestId("voice-probe")).toHaveLength(1);
    expect(screen.getByText("Text composer and history")).toBeInTheDocument();
    expect(screen.getAllByText("All saved facts").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Mit Scout sprechen" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lieber schreiben" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suchauftrag" })).toBeInTheDocument();

    view.rerender(<Harness stage="offer" />);
    expect(screen.getByTestId("voice-probe")).toBe(voiceNode);
    expect(mounts).toBe(1);
    expect(unmounts).toBe(0);
    expect(screen.queryByText("Text composer and history")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review exact offer" }));
    expect(reviewOffer).toHaveBeenCalledOnce();
  });

  it("centres a primary voice conversation while keeping decisions in a bounded reading column", () => {
    renderSurface("blocked", {
      voiceSlot: <div>Primary voice conversation</div>,
      decisionSlot: <div>Review this decision</div>,
      asideSlot: <div>Saved facts</div>,
    });

    expect(screen.getByText("Primary voice conversation").closest("[data-live-scout-stage]"))
      .toHaveClass("justify-center");
    expect(screen.getByText("Review this decision").parentElement).toHaveAttribute("data-voice-decision-host");
  });
});
