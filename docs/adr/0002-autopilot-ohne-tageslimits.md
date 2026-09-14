---
status: accepted
date: 2026-09-14
---

# Autopilot ohne Tageslimits; Rücksprache heißt: ausgehende Nachrichten fragen

Tageslimits für Kontakte und Browser-Minuten, ein Audit-Event für „unbegrenzt“ und rund zwölf stille Stopps auf dem Standardpfad machten den Autopilot zum Formular. Wir haben entschieden: Die Freigabeprüfung kennt keine Tageslimits; Kostenkontrolle gehört in die Portal-Engine. Im Modus Autopilot fragt kein unverbindlicher Schritt; nur die verbindliche Zusage (Angebot annehmen, Buchung, Zahlung, Kaution, Vertrag) sowie Passwort, 2FA und Captcha bleiben beim Menschen. Im Modus Rücksprache wird jede ausgehende Nachricht mit fertigem Text zur Entscheidung; Suchen, Registrieren und Lesen bleiben autonom.

## Consequences

- Ein Datenfeld, das laut Schalter aus ist und im Text erkannt wird, sowie ein als verbindlich oder unklar eingestufter Text werden Entscheidungen mit Text, nie stille Stopps. Unsicherer Inhalt stoppt mit Grund.
- Ausstehender Safety-Verdict oder belegter Browser bedeutet „warten“ mit Wiedervorlage.
- Jeder Stopp und jede Entscheidung trägt einen Grund, der dem Nutzer gezeigt werden kann.
