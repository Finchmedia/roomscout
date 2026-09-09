/**
 * German copy for the prototype-only demo control bar (`demo.*`).
 *
 * Source: docs/UI_PORT/SCOUT_SCREENS.md §18.18 "`demo` — prototype-only, NOT to be built".
 * Extracted verbatim on 2026-09-09.
 *
 * Kept out of the shipped product dictionary on purpose (COMPONENT_MAP.md §6.1 rule 2):
 * these 28 keys drive the design prototype's dev bar and are not part of the product.
 * Dev-only surfaces may import it; the assembled product dictionary must not.
 */

export const devDe = {
  demo: {
    label: "Prototyp · Beispieldaten",
    collapsed: "Prototyp · Demo-Steuerung",
    play: "Abspielen",
    pause: "Pausieren",
    next: "Nächster Schritt",
    restart: "Zurück zum Anfang",
    chapter: {
      aria: "Kapitel",
      welcome: "1 · Willkommen",
      discovery: "2 · Gespräch",
      brief_review: "3 · Suchauftrag",
      scouting: "4 · Autopilot",
      waiting: "5 · Warten",
      clarification: "6 · Rückfrage",
      following_up: "7 · Klärung",
      dead_end: "7b · Sackgasse",
      candidates: "7c · Kandidaten",
      offer: "8 · Angebot",
      offer_review: "9 · Prüfung",
      complete: "10 · Abschluss",
    },
    speed: {
      aria: "Tempo",
      "1x": "1×",
      "1_6x": "1.6×",
    },
    mobile: "Mobil",
    settings: "Einstellungen",
    operator: "Betreiberansicht",
    incident: "Beispielstörung laden",
    hide: {
      aria: "Steuerung ausblenden",
      title: "Ausblenden",
    },
  },
} as const;
