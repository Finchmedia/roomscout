/**
 * Scout surface smoke test — mounts the demo host and walks the kit's chapters
 * through the Demo-Steuerung strip, then exercises the two decisions that
 * actually change state: the clarification answer and a dead-end compromise.
 *
 * It guards the wiring (stage switch, machine reducers, copy keys), not the
 * pixels — there is deliberately no screenshot check.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import { DemoScoutPage } from "@/ui/scout/DemoScoutPage";

function goTo(chapter: string) {
  fireEvent.change(screen.getByLabelText("Kapitel"), { target: { value: chapter } });
}

/**
 * Step the demo clock in slices. Each slice commits, so the effect that
 * schedules the *next* step of a chained sequence gets to run — one big
 * `advanceTimersByTime` would drain the queue before React ever re-rendered.
 */
async function runDemo(ms: number) {
  const slice = 400;
  for (let elapsed = 0; elapsed < ms; elapsed += slice) {
    await act(async () => {
      vi.advanceTimersByTime(slice);
    });
  }
}

describe("scout surface smoke", () => {
  // The project runs vitest without `globals`, so RTL's auto-cleanup is not armed.
  afterEach(cleanup);
  // jsdom has no Element#scrollTo; PanelDialog resets the scroll on page change.
  beforeAll(() => {
    Element.prototype.scrollTo = () => {};
  });

  it("renders every chapter of the flow", () => {
    render(<DemoScoutPage />);

    expect(screen.getByText("Finden wir euren Proberaum.")).toBeInTheDocument();
    expect(screen.getByText("Hey Herzbuben.")).toBeInTheDocument();

    goTo("brief");
    expect(screen.getByText("So suche ich für euch.")).toBeInTheDocument();
    expect(screen.getByText("Bis 350 € / Monat")).toBeInTheDocument();

    goTo("scouting");
    expect(screen.getByText("Ich kümmere mich darum.")).toBeInTheDocument();
    expect(screen.getByText("Stuttgart · bis 350 €")).toBeInTheDocument();

    goTo("clarification");
    expect(screen.getByText("Eine kurze Rückfrage.")).toBeInTheDocument();

    goTo("dead_end");
    expect(screen.getByText("Da komme ich gerade nicht weiter.")).toBeInTheDocument();
    expect(screen.getByText("Budget bis 400 €")).toBeInTheDocument();

    goTo("candidates");
    expect(screen.getByText("Drei Räume, die in Frage kommen.")).toBeInTheDocument();
    expect(screen.getByText("Mein Vorschlag")).toBeInTheDocument();

    goTo("offer");
    expect(screen.getByText("Ein Raum, der zu euch passt.")).toBeInTheDocument();
    expect(screen.getByText("Euer Raum in Stuttgart-West")).toBeInTheDocument();

    goTo("offer_review");
    expect(screen.getByText("Passt das für euch?")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Vollständige Bedingungen anzeigen" }),
    );
    expect(screen.getByText(/Keine Kaution\./)).toBeInTheDocument();

    goTo("complete");
    expect(screen.getByText("Euer nächster Proberaum steht bereit.")).toBeInTheDocument();
    expect(
      screen.getByText("Stuttgart-West · 280 € / Monat · mittwochs 19–22 Uhr"),
    ).toBeInTheDocument();
  });

  it("answers the clarification and echoes both turns", () => {
    render(<DemoScoutPage />);
    goTo("clarification");

    fireEvent.click(screen.getByRole("button", { name: "Ja, Mittwoch passt" }));
    expect(screen.getByText("Ja, Mittwoch passt auch.")).toBeInTheDocument();
    expect(
      screen.getByText("Alles klar, Mittwoch geht also auch. Ich kläre den Rest."),
    ).toBeInTheDocument();
  });

  it("takes a dead-end compromise and hands the flow back to the autopilot", () => {
    render(<DemoScoutPage />);
    goTo("dead_end");

    fireEvent.click(screen.getByRole("button", { name: /Umland einbeziehen/ }));
    expect(screen.getByText("Ich kümmere mich darum.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach.",
      ),
    ).toBeInTheDocument();

    // The compromise wrote the fact, so the brief now reads „& Umland“.
    fireEvent.click(screen.getByRole("button", { name: /Stuttgart · bis 350 €/ }));
    expect(screen.getByText("Stuttgart & Umland")).toBeInTheDocument();
  });

  it("plays the scripted conversation through to the brief", async () => {
    vi.useFakeTimers();
    try {
      render(<DemoScoutPage />);
      fireEvent.click(screen.getByRole("button", { name: "Mit Scout sprechen" }));
      // The whole script, generously: eight turns plus the fact capsules.
      await runDemo(40_000);
      expect(screen.getByText("So suche ich für euch.")).toBeInTheDocument();
      expect(screen.getByText("Schlagzeug darf im Raum bleiben")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("runs the autopilot sequence into the clarification", async () => {
    vi.useFakeTimers();
    try {
      render(<DemoScoutPage />);
      goTo("scouting");
      expect(
        screen.getByText(/Alles klar. Ich suche passende Räume/),
      ).toBeInTheDocument();

      await runDemo(8_000);
      expect(screen.getByText(/Ein Raum in Stuttgart-West könnte passen/)).toBeInTheDocument();

      await runDemo(20_000);
      expect(screen.getByText("Eine kurze Rückfrage.")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("blocks the autopilot on an expired portal login and offers the way out", async () => {
    vi.useFakeTimers();
    try {
      render(<DemoScoutPage />);
      fireEvent.click(screen.getByRole("button", { name: "Beispielstörung laden" }));
      goTo("scouting");

      await runDemo(13_000);
      expect(
        screen.getByText(/Mein Zugang zu roomscout.dev braucht eine neue Anmeldung/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Zu den Zugängen" }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the profile menu and switches to the Betreiberansicht", () => {
    render(<DemoScoutPage />);

    fireEvent.click(screen.getByRole("button", { name: "Profilmenü" }));
    const menu = screen.getByRole("menu", { name: "Profilmenü" });
    expect(within(menu).getByRole("menuitem", { name: "Einstellungen" })).toBeInTheDocument();

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Betreiberansicht" }));
    expect(screen.getByRole("dialog", { name: "Betreiberansicht" })).toBeInTheDocument();
  });

  it("renders the narrow stage with the brief in a bottom sheet", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
    try {
      render(<DemoScoutPage />);
      goTo("brief");
      expect(screen.getByText("Euer Suchauftrag")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Scout losschicken" })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("opens the transcript drawer from the autopilot side controls", () => {
    render(<DemoScoutPage />);
    goTo("discovery");

    fireEvent.click(screen.getAllByRole("button", { name: "Mitschrift" })[0]!);
    expect(screen.getByRole("dialog", { name: "Mitschrift" })).toBeInTheDocument();
  });
});
