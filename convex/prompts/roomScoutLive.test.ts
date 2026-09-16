import { describe, expect, it } from "vitest";
import { roomScoutPersonality } from "./roomScoutPersonality";
import { liveInstructions, scoutVoiceInstructions } from "./roomScoutLive";

describe("RoomScout personality", () => {
  it.each([
    ["en", "Use light humour only when it arises naturally", "briefly acknowledge its impact", "do not joke"],
    ["de", "Nutze leichten Humor nur, wenn er sich natürlich ergibt", "erkenne die Belastung kurz an", "mache keinen Witz"],
  ] as const)("keeps the %s persona warm without forced performance", (locale, humour, empathy, restraint) => {
    const persona = roomScoutPersonality(locale);

    expect(persona).toContain(humour);
    expect(persona).toContain(empathy);
    expect(persona).toContain(restraint);
    expect(persona).toContain(locale === "de" ? "erfinde keine eigenen Erfahrungen" : "never invent personal experiences");
  });
});

describe("RoomScout Live prompts", () => {
  it("lets Live lead English discovery without turning it into a checklist", () => {
    const prompt = liveInstructions(
      "en",
      "phase=discovery; status=draft; saved location=Berlin; missing activation field=radiusKm",
      { hasPriorContext: true, discovery: true },
    );

    expect(prompt).toContain("DISCOVERY: You lead the conversation");
    expect(prompt).toContain("Ask one useful question at a time");
    expect(prompt).toContain("There is no fixed turn count and no requirement to ask every topic");
    expect(prompt).toContain("Hearing an answer does not prove it was saved");
    expect(prompt).toContain("Skip any criterion already answered or clearly covered in meaning");
    expect(prompt).toContain("even when phrased differently or a related optional saved field is null");
    expect(prompt).toContain("move straight to the next useful unanswered question in the same turn");
    expect(prompt).toContain("Do not reply with a backchannel alone");
    expect(prompt).toContain("never recap or list it");
    expect(prompt).toContain("A completed substantive turn adds or corrects facts");
    expect(prompt).toContain("Delegate the whole completed turn even when quiet context already reflects some clauses");
    expect(prompt).toContain("Backchannel policy:");
    expect(prompt).toContain("Interruption policy:");
    expect(prompt).toContain("Delegation policy:");
    expect(prompt).toContain("Backend tools:");
    expect(prompt).toContain("Delegate to the backend when:");
    expect(prompt).toContain("Do not delegate to the backend when:");
    expect(prompt).toContain("saved brief is ready for review and the current question is resolved");
    expect(prompt).toContain("proactively ask whether the musician wants to start the search");
    expect(prompt).toContain("unless one clearly useful unanswered topic should come first");
    expect(prompt).toContain("Do not merely thank them, recap the brief, end discovery without their choice or start automatically");
    expect(prompt).toContain("give no readiness verdict until the backend result arrives");
    expect(prompt).toContain("never infer not-ready from an earlier collecting or absent-ready state");
    expect(prompt).toContain("latest result overrides earlier readiness context");
    expect(prompt).toContain("Always delegate a direct request to end this voice call");
    expect(prompt).toContain("A negated, quoted, reported or hypothetical goodbye does not end the call");
    expect(prompt).not.toContain("sole source of domain reasoning and discovery questions");
    expect(prompt).not.toContain("Scout losschicken");
  });

  it("lets Live lead equivalent German discovery while preserving evidence boundaries", () => {
    const prompt = liveInstructions(
      "de",
      "phase=discovery; status=draft; gespeicherte Anforderung=Lagerung; kein Raum ausgewählt",
      { hasPriorContext: true, discovery: true },
    );

    expect(prompt).toContain("DISCOVERY: Du führst das Gespräch");
    expect(prompt).toContain("Stelle jeweils eine nützliche Frage");
    expect(prompt).toContain("keine feste Turn-Zahl und keine Pflicht, jedes Thema abzufragen");
    expect(prompt).toContain("Gehört bedeutet nicht gespeichert");
    expect(prompt).toContain("Überspringe jedes bereits beantwortete oder inhaltlich eindeutig abgedeckte Kriterium");
    expect(prompt).toContain("ein zugehöriges optionales gespeichertes Feld null ist");
    expect(prompt).toContain("im selben Beitrag direkt zur nächsten nützlichen offenen Frage über");
    expect(prompt).toContain("Antworte nicht nur mit einer Floskel");
    expect(prompt).toContain("Fasse ihn nie zusammen und liste ihn nicht auf");
    expect(prompt).toContain("Eine gespeicherte Anforderung beschreibt, was er braucht, nicht was ein Raum bietet");
    expect(prompt).toContain("Ein abgeschlossener inhaltlicher Beitrag ergänzt oder korrigiert Fakten");
    expect(prompt).toContain("Backchannel policy:");
    expect(prompt).toContain("Interruption policy:");
    expect(prompt).toContain("Delegation policy:");
    expect(prompt).toContain("Backend tools:");
    expect(prompt).toContain("Delegate to the backend when:");
    expect(prompt).toContain("Do not delegate to the backend when:");
    expect(prompt).toContain("gespeicherte Suchauftrag zur Prüfung bereit ist und die aktuelle Frage geklärt wurde");
    expect(prompt).toContain("frage von dir aus, ob die Suche gestartet werden soll");
    expect(prompt).toContain("außer ein eindeutig nützliches offenes Thema sollte zuerst geklärt werden");
    expect(prompt).toContain("Bedanke dich nicht nur, fasse den Suchauftrag nicht zusammen");
    expect(prompt).toContain("gib kein Bereitschaftsurteil ab, bevor das Backend-Ergebnis vorliegt");
    expect(prompt).toContain("leite aus einem früheren Sammelstatus oder fehlender Bereitschaft nie ab");
    expect(prompt).toContain("neueste Ergebnis überschreibt früheren Bereitschaftskontext");
    expect(prompt).toContain("Delegiere immer eine direkte Bitte, diesen Sprachanruf zu beenden");
  });

  it.each(["en", "de"] as const)("does not restart %s discovery outside a trusted discovery phase", (locale) => {
    const prompt = liveInstructions(locale, "phase=offer; focused candidate=East Room", {
      hasPriorContext: true,
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
    expect(discovery).toContain("proactively assess whether the draft has its required fields");
    expect(discovery).toContain("call markSearchBriefReady in the same turn without waiting for the musician to ask what comes next");
    expect(discovery).toContain("A successful readiness mark stays quiet; Live offers the search start");
    expect(discovery).toContain("ask no follow-up, give no recap and create no visible conversation continuation");
    expect(discovery).toContain("Live chooses the next discovery question");
    expect(discovery).toContain("requested backend action or readiness depends on a required field");
    expect(currentTask).not.toContain("VOICE DISCOVERY PROCESSING");
    expect(currentTask).not.toContain("markSearchBriefReady");
    expect(currentTask).toContain("follow the trusted current task");
  });

  it("gives German discovery the same proactive quiet readiness handoff", () => {
    const discovery = scoutVoiceInstructions("de", { discovery: true });

    expect(discovery).toContain("Prüfe nach den Aktualisierungen von dir aus");
    expect(discovery).toContain("rufe dann im selben Turn markSearchBriefReady auf");
    expect(discovery).toContain("ohne darauf zu warten, dass der Musiker nach dem nächsten Schritt fragt");
    expect(discovery).toContain("erfolgreiche Bereitschaftsmarkierung bleibt still; Live bietet den Suchstart an");
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
      hasPriorContext: true,
      discovery: true,
    });

    expect(prompt).toContain(greeting);
    expect(prompt).toContain(locale === "de"
      ? "Sprich beim Sitzungsstart genau einmal zuerst"
      : "Speak first exactly once when the session starts");
    expect(prompt).toContain(locale === "de"
      ? "Fasse den Suchauftrag nicht zusammen"
      : "Do not recap the search brief");
  });

  it.each(["en", "de"] as const)("keeps the fresh %s opening in discovery", (locale) => {
    const prompt = liveInstructions(locale, "phase=discovery; no saved search", {
      hasPriorContext: false,
      discovery: true,
    });

    expect(prompt).toContain(locale === "de"
      ? "Stell dich in einem kurzen Satz als RoomScout vor"
      : "Introduce yourself as RoomScout in one brief sentence");
    expect(prompt).toContain(locale === "de"
      ? "lade den Musiker ein zu erzählen, was ihn herführt"
      : "invite the musician to share what brought them here");
    expect(prompt).toContain(locale === "de"
      ? "Wiederhole diese Eröffnung nach der Antwort nicht"
      : "Do not repeat this opening after they answer");
    expect(prompt).not.toContain("welcome back");
    expect(prompt).not.toContain("willkommen zurück");
  });
});
