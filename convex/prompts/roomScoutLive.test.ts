import { describe, expect, it } from "vitest";
import { liveInstructions, scoutVoiceInstructions } from "./roomScoutLive";

describe("RoomScout Live prompts", () => {
  it("makes the application Scout the only source of English domain questions", () => {
    const prompt = liveInstructions(
      "en",
      "Active search: rehearsal room; arrangements=shared; requirements=secure storage. No market signal is attached.",
      { hasSavedNeed: true },
    );

    expect(prompt).toContain("never recap it");
    expect(prompt).toContain("briefly acknowledge the one fact that was just corrected");
    expect(prompt).toContain("sole source of domain reasoning and discovery questions");
    expect(prompt).toContain("Speak a domain follow-up only when it is returned by the application");
    expect(prompt).toContain("Delegate the whole completed turn even when quiet application context already reflects some of its clauses");
    expect(prompt).toContain('"please save those requirements" always requires delegation');
    expect(prompt).toContain("they neither mean the current utterance is complete nor invite a response");
    expect(prompt).toContain("Never say that all requirements are captured or done before the application confirms the current turn");
    expect(prompt).toContain("A saved requirement says what the musician needs, not what a candidate room provides");
    expect(prompt).toContain('can "start the search"');
    expect(prompt).toContain("Always delegate a direct request to hang up/end this voice call");
    expect(prompt).toContain("A negated, quoted, reported, or hypothetical goodbye is not an end-call request");
    expect(prompt).toContain('"Stop speaking"');
    expect(prompt).not.toContain("Scout losschicken");
  });

  it("keeps German storage answers provisional until a room capability is verified", () => {
    const prompt = liveInstructions(
      "de",
      "Aktiver Suchauftrag: Raumteilung; Anforderungen=Lagerung. Kein Raum ausgewählt.",
      { hasSavedNeed: true },
    );

    expect(prompt).toContain("Fasse ihn nie zusammen");
    expect(prompt).toContain("ist für sich kein neuer Fakt");
    expect(prompt).toContain("beschreibt, was der Musiker braucht, nicht was ein Raum bietet");
    expect(prompt).toContain("RoomScout noch klären muss, ob ein Raum oder Anbieter sie erfüllt");
    expect(prompt).toContain("einzige Quelle für fachliche Schlussfolgerungen und Fragen zur Suche");
    expect(prompt).toContain("Stille Anwendungs- oder Denk-Kontexte enthalten nur die bisher bestätigten Felder");
    expect(prompt).toContain("muss immer delegiert werden");
    expect(prompt).toContain("Delegiere immer eine direkte Bitte, diesen Sprachanruf zu beenden oder aufzulegen");
    expect(prompt).toContain("Ein verneinter, zitierter, berichteter oder hypothetischer Abschied");
    expect(prompt).toContain("Pausieren oder Stoppen der Suche");
    expect(prompt).not.toContain("Scout losschicken");
  });

  it("repeats the requirement-versus-capability boundary in concise Scout results", () => {
    expect(scoutVoiceInstructions("en")).toContain("A saved requirement is not evidence of a room capability");
    expect(scoutVoiceInstructions("de")).toContain("Eine gespeicherte Anforderung belegt keine Eigenschaft eines Raums");
    expect(scoutVoiceInstructions("en")).toContain("Empty optional fields are not a reason to ask");
    expect(scoutVoiceInstructions("de")).toContain("Leere optionale Felder sind kein Fragegrund");
  });
});

describe("GPT Live session opening", () => {
  it.each([
    ["en", "Hey, welcome back. What would you like to pick up?"],
    ["de", "Hey, willkommen zurück. Womit möchtest du weitermachen?"],
  ] as const)("continues an existing %s search without restarting discovery", (locale, greeting) => {
    const prompt = liveInstructions(locale, "Active search: saved facts", { hasSavedNeed: true });

    expect(prompt).toContain(greeting);
    expect(prompt).toContain(locale === "de"
      ? "stelle keine neue Frage zu Suchkriterien"
      : "ask a new search-criteria question");
    expect(prompt).toContain(locale === "de"
      ? "Fasse den Suchauftrag nicht zusammen"
      : "Do not recap the search brief");
  });

  it.each(["en", "de"] as const)("keeps the fresh %s opening in discovery", (locale) => {
    const prompt = liveInstructions(locale, "No active structured search is attached.", {
      hasSavedNeed: false,
    });

    expect(prompt).toContain(locale === "de"
      ? "frage, was für einen Proberaum er sucht"
      : "ask what they are looking for in a rehearsal room");
    expect(prompt).not.toContain("welcome back");
    expect(prompt).not.toContain("willkommen zurück");
  });
});
