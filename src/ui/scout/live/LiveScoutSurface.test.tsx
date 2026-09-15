import { cleanup, render, screen } from "@testing-library/react";
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

const centreColumn = () => document.querySelector('[data-live-scout-column="center"]');

afterEach(cleanup);

describe("live Scout surface columns", () => {
  it("keeps the brief beside the conversation during discovery", () => {
    renderSurface("discovery", {
      chatSlot: <div>Gespräch</div>,
      asideSlot: <div>Euer Suchauftrag</div>,
    });

    // The aside is inside the three-column row, not only behind the sheet.
    expect(centreColumn()).not.toBeNull();
    expect(screen.getAllByText("Euer Suchauftrag").length).toBeGreaterThan(0);
    expect(screen.getByText("Gespräch")).toBeInTheDocument();
    // The column row replaces the „Suchauftrag ansehen“ toggle with the sheet.
    expect(screen.getByRole("button", { name: "Suchauftrag" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suchauftrag ansehen" })).not.toBeInTheDocument();
  });

  it("leaves discovery single-column while there is nothing to put beside it", () => {
    renderSurface("discovery", { chatSlot: <div>Gespräch</div> });
    expect(centreColumn()).toBeNull();
    expect(screen.getByRole("button", { name: "Suchauftrag ansehen" })).toBeInTheDocument();
  });

  it("centres the stage column vertically while the side columns stay at the top", () => {
    renderSurface("working", {
      railSlot: <div>Kandidaten</div>,
      asideSlot: <div>Euer Suchauftrag</div>,
    });

    const centre = centreColumn();
    expect(centre).not.toBeNull();
    // The mock centres blob and headline in the space the columns leave.
    expect(centre).toHaveClass("justify-center", "flex-1", "min-h-0");
    const row = centre?.parentElement;
    expect(row).toHaveClass("items-stretch");
    for (const side of [row?.firstElementChild, row?.lastElementChild]) {
      expect(side).toHaveClass("self-start");
    }
  });

  it("says nothing where the Entscheidung card already asks the question", () => {
    renderSurface("blocked", { decisionSlot: <div>Soll ich das senden?</div> });
    expect(screen.getByRole("heading", { name: "Hier brauche ich kurz deine Hilfe." })).toBeInTheDocument();
    expect(screen.getAllByText("Soll ich das senden?")).toHaveLength(1);
  });
});
