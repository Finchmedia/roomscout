import { describe, expect, it } from "vitest";
import { roomScoutPersonality } from "./roomScoutPersonality";
import { liveInstructions, scoutVoiceInstructions } from "./roomScoutLive";

describe("prompt construction: RoomScout personality", () => {
  it.each([
    ["en", "Use light humour only when it arises naturally", "briefly acknowledge its impact"],
    ["de", "Nutze leichten Humor nur, wenn er sich natürlich ergibt", "erkenne die Belastung kurz an"],
  ] as const)("keeps the %s persona warm without forced humour", (locale, humour, empathy) => {
    const persona = roomScoutPersonality(locale);

    expect(persona).toContain(humour);
    expect(persona).toContain(empathy);
  });
});

describe("prompt construction: RoomScout Live policy", () => {
  it.each([
    [
      "en",
      "DISCOVERY: You lead the conversation",
      "Ask one useful question at a time",
      "Hearing an answer does not prove it was saved",
      "never recap or list it",
      "proactively ask whether the musician wants to start the search",
      "Do not merely thank them, recap the brief, end discovery without their choice or start automatically",
      "Always delegate a direct request to end this voice call",
      "A negated, quoted, reported or hypothetical goodbye does not end the call",
    ],
    [
      "de",
      "DISCOVERY: Du führst das Gespräch",
      "Stelle jeweils eine nützliche Frage",
      "Gehört bedeutet nicht gespeichert",
      "Fasse ihn nie zusammen und liste ihn nicht auf",
      "frage von dir aus, ob die Suche gestartet werden soll",
      "Bedanke dich nicht nur, fasse den Suchauftrag nicht zusammen",
      "Delegiere immer eine direkte Bitte, diesen Sprachanruf zu beenden",
      "Ein verneinter, zitierter, berichteter oder hypothetischer Abschied beendet den Anruf nicht",
    ],
  ] as const)(
    "keeps %s discovery conversational, evidence-bound and user-controlled",
    (locale, discovery, oneQuestion, savedBoundary, noRecap, readyOffer, noAutoStart, directHangup, safeHangup) => {
      const prompt = liveInstructions(locale, "phase=discovery; status=draft", {
        hasPriorContext: true,
        discovery: true,
      });

      for (const invariant of [
        discovery,
        oneQuestion,
        savedBoundary,
        noRecap,
        readyOffer,
        noAutoStart,
        directHangup,
        safeHangup,
      ]) {
        expect(prompt).toContain(invariant);
      }
    },
  );

  it.each([
    ["en", "Discovery is not active", "Do not restart onboarding or ask a new search-criteria question", "DISCOVERY: You lead the conversation"],
    ["de", "Discovery ist nicht aktiv", "stelle keine neue Frage zu Suchkriterien", "DISCOVERY: Du führst das Gespräch"],
  ] as const)("does not restart %s discovery outside its trusted phase", (locale, inactive, noRestart, discovery) => {
    const prompt = liveInstructions(locale, "phase=offer; focused candidate=East Room", {
      hasPriorContext: true,
      discovery: false,
    });

    expect(prompt).toContain(inactive);
    expect(prompt).toContain(noRestart);
    expect(prompt).not.toContain(discovery);
  });

  it.each([
    ["en", "VOICE DISCOVERY PROCESSING", "A successful readiness mark stays quiet; Live offers the search start"],
    ["de", "VOICE-DISCOVERY-VERARBEITUNG", "erfolgreiche Bereitschaftsmarkierung bleibt still; Live bietet den Suchstart an"],
  ] as const)("builds a quiet %s discovery backend policy", (locale, discovery, quietHandoff) => {
    const prompt = scoutVoiceInstructions(locale, { discovery: true });

    expect(prompt).toContain(discovery);
    expect(prompt).toContain("updateSearchDraft");
    expect(prompt).toContain("markSearchBriefReady");
    expect(prompt).toContain(quietHandoff);
  });

  it.each([
    ["en", "Treat only successful tool results as proof", "A saved requirement is not evidence of a room capability"],
    ["de", "Nutze ausschließlich erfolgreiche Tool-Ergebnisse als Beleg", "Eine gespeicherte Anforderung belegt keine Eigenschaft eines Raums"],
  ] as const)("keeps %s action and room claims evidence-bound", (locale, actionProof, capabilityProof) => {
    const prompt = scoutVoiceInstructions(locale);

    expect(prompt).toContain(actionProof);
    expect(prompt).toContain(capabilityProof);
    expect(prompt).not.toContain("markSearchBriefReady");
  });
});

describe("prompt construction: GPT Live session opening", () => {
  it.each([
    ["en", "Hey, welcome back. What would you like to pick up?", "Do not recap the search brief"],
    ["de", "Hey, willkommen zurück. Womit möchtest du weitermachen?", "Fasse den Suchauftrag nicht zusammen"],
  ] as const)("continues an existing %s session without recapping", (locale, greeting, noRecap) => {
    const prompt = liveInstructions(locale, "phase=discovery; saved facts exist", {
      hasPriorContext: true,
      discovery: true,
    });

    expect(prompt).toContain(greeting);
    expect(prompt).toContain(noRecap);
  });

  it.each([
    ["en", "Introduce yourself as RoomScout in one brief sentence", "welcome back"],
    ["de", "Stell dich in einem kurzen Satz als RoomScout vor", "willkommen zurück"],
  ] as const)("introduces RoomScout on a fresh %s session", (locale, introduction, staleGreeting) => {
    const prompt = liveInstructions(locale, "phase=discovery; no saved search", {
      hasPriorContext: false,
      discovery: true,
    });

    expect(prompt).toContain(introduction);
    expect(prompt).not.toContain(staleGreeting);
  });
});
