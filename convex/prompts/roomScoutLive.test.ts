import { describe, expect, it } from "vitest";
import { roomScoutPersonality } from "./roomScoutPersonality";
import { liveInstructions, scoutVoiceInstructions } from "./roomScoutLive";

describe("RoomScout personality", () => {
  it.each([
    ["en", "dry Australian humour", "automatic praise"],
    ["de", "trockenen Humor", "Begeisterung"],
  ] as const)("keeps the %s persona warm without forced performance", (locale, humour, restraint) => {
    const persona = roomScoutPersonality(locale);

    expect(persona).toContain(humour);
    expect(persona).toContain(restraint);
    expect(persona).toContain(locale === "de" ? "erfinde keine eigenen Erfahrungen" : "never invent personal experiences");
  });
});

describe("RoomScout Live prompts", () => {
  it("lets Live lead English discovery without turning it into a checklist", () => {
    const prompt = liveInstructions(
      "en",
      "phase=discovery; status=draft; saved location=Berlin; missing activation field=radiusKm",
      { hasSavedNeed: true, discovery: true },
    );

    expect(prompt).toContain("DISCOVERY: You lead the conversation");
    expect(prompt).toContain("Ask one useful question at a time");
    expect(prompt).toContain("There is no fixed turn count and no requirement to ask every topic");
    expect(prompt).toContain("Hearing an answer does not prove it was saved");
    expect(prompt).toContain("Skip any criterion already answered or clearly covered in meaning");
    expect(prompt).toContain("even when phrased differently or a related optional saved field is null");
    expect(prompt).toContain("without progress filler, waiting language or commentary about backend work");
    expect(prompt).toContain("never recap or list it");
    expect(prompt).toContain("A completed substantive turn adds or corrects facts");
    expect(prompt).toContain("Delegate the whole completed turn even when quiet context already reflects some clauses");
    expect(prompt).toContain("Backchannel policy:");
    expect(prompt).toContain("Interruption policy:");
    expect(prompt).toContain("Delegation policy:");
    expect(prompt).toContain("Backend tools:");
    expect(prompt).toContain("Delegate to the backend when:");
    expect(prompt).toContain("Do not delegate to the backend when:");
    expect(prompt).toContain("Confirmed readiness permits you to offer the search start when it fits");
    expect(prompt).toContain("it does not end discovery or require an immediate offer");
    expect(prompt).toContain("Always delegate a direct request to end this voice call");
    expect(prompt).toContain("A negated, quoted, reported or hypothetical goodbye does not end the call");
    expect(prompt).not.toContain("sole source of domain reasoning and discovery questions");
    expect(prompt).not.toContain("Scout losschicken");
  });

  it("lets Live lead equivalent German discovery while preserving evidence boundaries", () => {
    const prompt = liveInstructions(
      "de",
      "phase=discovery; status=draft; gespeicherte Anforderung=Lagerung; kein Raum ausgewählt",
      { hasSavedNeed: true, discovery: true },
    );

    expect(prompt).toContain("DISCOVERY: Du führst das Gespräch");
    expect(prompt).toContain("Stelle jeweils eine nützliche Frage");
    expect(prompt).toContain("keine feste Turn-Zahl und keine Pflicht, jedes Thema abzufragen");
    expect(prompt).toContain("Gehört bedeutet nicht gespeichert");
    expect(prompt).toContain("Überspringe jedes bereits beantwortete oder inhaltlich eindeutig abgedeckte Kriterium");
    expect(prompt).toContain("ein zugehöriges optionales gespeichertes Feld null ist");
    expect(prompt).toContain("ohne Fortschrittsfloskeln, Warteformulierungen oder Kommentare zur Backend-Arbeit");
    expect(prompt).toContain("Fasse ihn nie zusammen und liste ihn nicht auf");
    expect(prompt).toContain("Eine gespeicherte Anforderung beschreibt, was er braucht, nicht was ein Raum bietet");
    expect(prompt).toContain("Ein abgeschlossener inhaltlicher Beitrag ergänzt oder korrigiert Fakten");
    expect(prompt).toContain("Backchannel policy:");
    expect(prompt).toContain("Interruption policy:");
    expect(prompt).toContain("Delegation policy:");
    expect(prompt).toContain("Backend tools:");
    expect(prompt).toContain("Delegate to the backend when:");
    expect(prompt).toContain("Do not delegate to the backend when:");
    expect(prompt).toContain("Bestätigte Bereitschaft erlaubt dir, den Suchstart anzubieten, wenn es passt");
    expect(prompt).toContain("sie beendet Discovery nicht und verlangt kein sofortiges Angebot");
    expect(prompt).toContain("Delegiere immer eine direkte Bitte, diesen Sprachanruf zu beenden");
  });

  it.each(["en", "de"] as const)("does not restart %s discovery outside a trusted discovery phase", (locale) => {
    const prompt = liveInstructions(locale, "phase=offer; focused candidate=East Room", {
      hasSavedNeed: true,
      discovery: false,
    });

    expect(prompt).toContain(locale === "de" ? "Discovery ist nicht aktiv" : "Discovery is not active");
    expect(prompt).toContain(locale === "de"
      ? "stelle keine neue Frage zu Suchkriterien"
      : "Do not restart onboarding or ask a new search-criteria question");
    expect(prompt).not.toContain(locale === "de"
      ? "DISCOVERY: Du führst das Gespräch"
      : "DISCOVERY: You lead the conversation");
  });

  it("gives the backend a quiet extraction role only in discovery", () => {
    const discovery = scoutVoiceInstructions("en", { discovery: true });
    const currentTask = scoutVoiceInstructions("en", { discovery: false });

    expect(discovery).toContain("VOICE DISCOVERY PROCESSING");
    expect(discovery).toContain("Save explicit search details with updateSearchDraft");
    expect(discovery).toContain("durable band or musician context with rememberFact");
    expect(discovery).toContain("ask no follow-up, give no recap and create no visible conversation continuation");
    expect(discovery).toContain("Live chooses the next discovery question");
    expect(discovery).toContain("requested backend action or readiness depends on a required field");
    expect(currentTask).not.toContain("VOICE DISCOVERY PROCESSING");
    expect(currentTask).toContain("follow the trusted current task");
  });

  it("keeps capability and action proof rules in concise Scout results", () => {
    expect(scoutVoiceInstructions("en", { discovery: true })).toContain("Treat only successful tool results as proof");
    expect(scoutVoiceInstructions("de", { discovery: true })).toContain("Nutze ausschließlich erfolgreiche Tool-Ergebnisse als Beleg");
    expect(scoutVoiceInstructions("en")).toContain("A saved requirement is not evidence of a room capability");
    expect(scoutVoiceInstructions("de")).toContain("Eine gespeicherte Anforderung belegt keine Eigenschaft eines Raums");
  });
});

describe("GPT Live session opening", () => {
  it.each([
    ["en", "Hey, welcome back. What would you like to pick up?"],
    ["de", "Hey, willkommen zurück. Womit möchtest du weitermachen?"],
  ] as const)("continues an existing %s search without recapping it", (locale, greeting) => {
    const prompt = liveInstructions(locale, "phase=discovery; saved facts exist", {
      hasSavedNeed: true,
      discovery: true,
    });

    expect(prompt).toContain(greeting);
    expect(prompt).toContain(locale === "de"
      ? "Fasse den Suchauftrag nicht zusammen"
      : "Do not recap the search brief");
  });

  it.each(["en", "de"] as const)("keeps the fresh %s opening in discovery", (locale) => {
    const prompt = liveInstructions(locale, "phase=discovery; no saved search", {
      hasSavedNeed: false,
      discovery: true,
    });

    expect(prompt).toContain(locale === "de"
      ? "frage, was für einen Proberaum er sucht"
      : "ask what they are looking for in a rehearsal room");
    expect(prompt).not.toContain("welcome back");
    expect(prompt).not.toContain("willkommen zurück");
  });
});
