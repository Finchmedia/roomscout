// German copy dictionary — cross-surface `common.*` namespace.
// Source of the 7 canonical keys: docs/UI_PORT/SETTINGS_SCREENS.md §17.12 "Global toasts / misc",
// hoisted to the top level (not nested under `settings.*`) per docs/UI_PORT/COMPONENT_MAP.md §6.1 rule 3.
// Extracted verbatim on 2026-09-09.

export const commonDe = {
  // --- the 7 source keys, §17.12, verbatim ---
  copyFailedToast: "Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst.",
  saved: "Gespeichert",
  cancel: "Abbrechen",
  back: "Zurück",
  close: "Schließen",
  details: "Details",
  demoName: "Herzbuben",

  // --- widened per DECISIONS item 17: shared strings promoted into `common.*`.
  // Port decision, not a source fact (COMPONENT_MAP §6.1). Every value below occurs
  // verbatim in a screen doc; the origin key is cited per line. ---
  save: "Speichern", // SETTINGS_SCREENS.md §17.6 knowledge.edit.save / §17.8 profile.save
  apply: "Übernehmen", // SCOUT_SCREENS.md §18.9 brief.save
  discard: "Verwerfen", // SETTINGS_SCREENS.md §17.5 discard.discard
  next: "Weiter", // SETTINGS_SCREENS.md §17.7 import.step1.next
  backToScout: "Zurück zum Scout", // SCOUT_SCREENS.md §18.1 chrome.menu.backToScout / SETTINGS_SCREENS.md §17.1 settings.nav.back
} as const;
