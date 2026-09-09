# UI Kit · RoomScout App

Recreation of the band-facing RoomScout app from `Roomscout.dc.html`, `Settings.dc.html` and `Operator.dc.html` in the "Roomscout UI Interactive Prototype" codebase. One adaptive surface, no sidebar; the screen changes emphasis rather than "navigating".

Files
- `index.html` — entry; loads the DS bundle and the screens below.
- `ScreensA.jsx` — Welcome, Discovery (voice + text mode, fact extraction into the floating FactList; mobile bottom sheet "N Wünsche gemerkt"), Brief (central Suchauftrag card with inline edit; mobile sheet variant), `BottomSheet`.
- `ScreensB.jsx` — Autopilot (status sequence, Freigabe-nötig card for "Mit Rücksprache", Quelle-fehlt / Zugang-abgelaufen states, summary pill, activity), Clarification, Offer (dynamic offer, stale notice, Scout explanation), Review (full terms, Q&A "Was passiert nach der Zusage?"), Complete.
- `ScreensC.jsx` — DeadEnd (Sackgasse with three compromises), Candidates (three rooms, "Mein Vorschlag").
- `Settings.jsx` — Quellen & Zugänge (with portal-connection sheet), Handlungsspielraum (draft/save), Was dein Scout weiß (tabs, edit, retire/undo, change log, context import dialog), Profil, Benachrichtigungen, Tarif & Nutzung, Datenschutz.
- `Operator.jsx` — Betreiberansicht: Übersicht, Quellen, Aufträge, Integrationen, Feature-Flags, Diagnose + diagnosis sheet ("Beispielstörung laden").
- `App.jsx` — shared state (facts, rules, sources, flags, knowledge, offer), header, profile menu, transcript drawer, toast/hint, mobile frame (390×844), demo chapter picker.

Flow: `welcome → discovery → brief → scouting → clarification → (offer | dead_end → scouting → candidates → scouting → offer) → offer_review → complete`. Timings are compressed demo timings from the source prompt.
