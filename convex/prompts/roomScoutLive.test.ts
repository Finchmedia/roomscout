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
    ["en", "Discovery is not active", "Do not restart onboarding or ask a new search-criteria question", "DISCOVERY: You lead the conversation", "An explicit correction to a saved search fact (for example a new budget) is still a backend delegation, not a discovery question"],
    ["de", "Discovery ist nicht aktiv", "stelle keine neue Frage zu Suchkriterien", "DISCOVERY: Du führst das Gespräch", "Eine ausdrückliche Korrektur eines gespeicherten Suchfakts (zum Beispiel ein neues Budget) ist weiterhin eine Backend-Delegation, keine Discovery-Frage"],
  ] as const)("does not restart %s discovery outside its trusted phase", (locale, inactive, noRestart, discovery, correction) => {
    const prompt = liveInstructions(locale, "phase=offer; focused candidate=East Room", {
      hasPriorContext: true,
      discovery: false,
    });

    expect(prompt).toContain(inactive);
    expect(prompt).toContain(noRestart);
    expect(prompt).toContain(correction);
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
    ["en", "Treat only successful tool results as proof", "A saved requirement is not evidence of a room capability", "Apply explicit corrections to search facts with updateSearchDraft even when the search is already active; ask no follow-up discovery question and give no recap"],
    ["de", "Nutze ausschließlich erfolgreiche Tool-Ergebnisse als Beleg", "Eine gespeicherte Anforderung belegt keine Eigenschaft eines Raums", "Wende ausdrückliche Korrekturen an Suchfakten mit updateSearchDraft an, auch wenn die Suche bereits aktiv ist; stelle danach keine Discovery-Anschlussfrage und gib kein Recap"],
  ] as const)("keeps %s action and room claims evidence-bound", (locale, actionProof, capabilityProof, correction) => {
    const prompt = scoutVoiceInstructions(locale);

    expect(prompt).toContain(actionProof);
    expect(prompt).toContain(capabilityProof);
    // A live search still takes explicit corrections; the draft-only readiness tool stays out.
    expect(prompt).toContain(correction);
    expect(prompt).not.toContain("markSearchBriefReady");
  });
});

describe("prompt construction: backend answers and voice decisions", () => {
  it.each([
    ["en", "RESULT DELIVERY: When the app appends a commentary for a delegation, that is the backend answer", "never say you are still waiting once the answer arrived", "never answer it from memory or defer it to the panel", "An announced decision is answered only through the backend"],
    ["de", "ERGEBNISWIEDERGABE: Wenn die App zu einer Delegation einen Kommentar anhängt, ist das die Backend-Antwort", "sage nie, du wartest noch, sobald die Antwort da ist", "beantworte es nie aus dem Gedächtnis und verweise nicht aufs Panel", "Eine angekündigte Entscheidung wird nur über das Backend beantwortet"],
  ] as const)("speaks %s backend answers on arrival and delegates status questions", (locale, delivery, noWaiting, noMemory, decision) => {
    for (const session of [{ hasPriorContext: true, discovery: true }, { hasPriorContext: false, discovery: false }]) {
      const prompt = liveInstructions(locale, "phase=any", session);
      expect(prompt).toContain(delivery);
      expect(prompt).toContain(noWaiting);
      expect(prompt).toContain(noMemory);
      expect(prompt).toContain(decision);
    }
  });

  it.each([
    ["en", "I'll take that as your answer for Modul Ost", "if the result is ui_only, say that sending or accepting happens in the app", "Never claim anything was sent"],
    ["de", "Das nehme ich als deine Antwort für Modul Ost", "ist das Ergebnis ui_only, sage, dass Senden oder Annehmen in der App passiert", "Behaupte nie, etwas sei gesendet worden"],
  ] as const)("confirms a %s voice decision answer without claiming a send", (locale, confirmation, uiOnly, noSend) => {
    const prompt = scoutVoiceInstructions(locale);
    expect(prompt).toContain(confirmation);
    expect(prompt).toContain(uiOnly);
    expect(prompt).toContain(noSend);
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

  it.each([
    ["en", { hasPriorContext: true, discovery: true }],
    ["en", { hasPriorContext: false, discovery: true }],
    ["en", { hasPriorContext: false, discovery: false }],
    ["de", { hasPriorContext: true, discovery: true }],
    ["de", { hasPriorContext: false, discovery: true }],
    ["de", { hasPriorContext: false, discovery: false }],
  ] as const)("makes the %s opening one-shot for %o", (locale, session) => {
    const prompt = liveInstructions(locale, "phase=any", session);
    const oneShot = locale === "de"
      ? "Diese Eröffnung gilt nur für deinen allerersten Beitrag dieser Sitzung. Spätere Anweisungen oder Kontext-Updates der App starten keine neue Sitzung; begrüße nie erneut und sage den Eröffnungssatz nie wieder."
      : "This opening belongs only to your very first utterance of this session. Later instruction or context updates from the app never restart the session; never greet again and never say the opening sentence again.";

    expect(prompt).toContain(oneShot);
    // The clause belongs to the opening rule itself, ahead of the trusted context block.
    const rule = locale === "de" ? "SITZUNGSBEGINN:" : "SESSION OPENING:";
    expect(prompt.indexOf(rule)).toBeLessThan(prompt.indexOf(oneShot));
    expect(prompt.indexOf(oneShot)).toBeLessThan(prompt.indexOf("TRUSTED CURRENT ROOMSCOUT CONTEXT"));
  });
});
