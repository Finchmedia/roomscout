import { describe, expect, it } from "vitest";
import { splitLiveAppendContent } from "../../hooks/useGptLiveVoiceScout";
import { formatLiveDecisionAnnouncement } from "./liveDecisionAnnouncement";

const question = (over: Partial<Parameters<typeof formatLiveDecisionAnnouncement>[0]> = {}) => ({
  _id: "decision-1", kind: "scout_question", question: "Passt der Termin?",
  options: [{ id: "yes", label: "Ja, passt" }, { id: "no", label: "Nein" }],
  conversationId: "conversation-2", updatedAt: 1, ...over,
});

describe("live decision announcement", () => {
  it("stays a single commentary append for every kind, locale and length", () => {
    const longQuestion = "Der Anbieter fragt, ob ihr auch mit einem E-Drum-Set zurechtkommt, weil das akustische Set nur donnerstags verfügbar ist, und ob ihr eure eigenen Verstärker dauerhaft einlagern möchtet oder sie jedes Mal mitbringt, und bis wann ihr euch entscheiden könnt.";
    const longRoom = "Proberaum Modul Ost Kreuzberg Süd im Hinterhof";
    const cases = [
      question(),
      question({ question: longQuestion, options: [
        { id: "a", label: "Ja, E-Drums sind okay" },
        { id: "b", label: "Nein, wir brauchen ein akustisches Set" },
        { id: "c", label: "Nur donnerstags akustisch reicht uns" },
      ] }),
      question({ options: [] }),
      question({ kind: "review_message", question: "Soll ich diese Nachricht so senden?", options: [
        { id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" },
      ] }),
      question({ kind: "review_message", question: longQuestion, options: [] }),
      question({ kind: "offer_ready", question: "Das Angebot ist da. Möchtest du es prüfen?", options: [] }),
      question({ kind: "offer_ready", question: longQuestion, options: [] }),
    ];
    for (const decision of cases) {
      for (const locale of ["en", "de"] as const) {
        for (const room of [longRoom, undefined]) {
          const content = formatLiveDecisionAnnouncement(decision, room, locale);
          expect(splitLiveAppendContent(content), `${decision.kind}/${locale}/${room ?? "no room"}`).toHaveLength(1);
        }
      }
    }
  });

  it("clips an over-long question instead of dropping the options or the room", () => {
    const content = formatLiveDecisionAnnouncement(
      question({ question: "Ja oder nein? ".repeat(60) }),
      "Proberaum Modul Ost",
      "de",
    );
    expect(splitLiveAppendContent(content)).toHaveLength(1);
    expect(content).toContain("Proberaum Modul Ost");
    expect(content).toContain("Ja, passt");
    expect(content).toContain("Nein");
    expect(content).toContain("…");
    expect(content).toContain("oder eine eigene Antwort");
  });

  it("offers whole option labels only, never a list cut in half", () => {
    const content = formatLiveDecisionAnnouncement(
      question({ options: Array.from({ length: 8 }, (_, index) => ({
        id: `option-${index}`, label: `Antwortmöglichkeit Nummer ${index + 1} mit Zusatz`,
      })) }),
      "Raum West",
      "de",
    );
    expect(splitLiveAppendContent(content)).toHaveLength(1);
    const quoted = content.match(/“[^“”]*”/g) ?? [];
    expect(quoted.length).toBeGreaterThan(0);
    for (const label of quoted) {
      expect(label).toMatch(/^“Antwortmöglichkeit Nummer \d+ mit Zusatz”$/);
    }
  });

  it("keeps sending and the offer review out of the spoken options", () => {
    const message = formatLiveDecisionAnnouncement(
      question({ kind: "review_message", question: "Soll ich diese Nachricht so senden?", options: [
        { id: "yes", label: "Ja, so senden" }, { id: "no", label: "Nein, anders" },
      ] }),
      "Raum West",
      "en",
    );
    expect(message).toContain("no, or a different wording");
    expect(message).not.toContain("Ja, so senden");
    const offer = formatLiveDecisionAnnouncement(
      question({ kind: "offer_ready", question: "The offer is ready. Review it?", options: [
        { id: "review", label: "Angebot prüfen" }, { id: "no", label: "Nicht dieses" },
      ] }),
      "Raum West",
      "en",
    );
    expect(offer).toContain("not this one");
    expect(offer).toContain("reviewing and accepting happens only in the app");
    expect(offer).not.toContain("Angebot prüfen");
  });
});
