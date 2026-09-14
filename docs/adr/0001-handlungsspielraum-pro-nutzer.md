---
status: accepted
date: 2026-09-14
---

# Handlungsspielraum gilt pro Nutzer, kein Mandat pro Suchauftrag

Bis September 2026 trug ein versioniertes Mandat pro Suchauftrag (`searchMandates`) Modus, erlaubte Aktionen, Datenfelder und Limits. Die Einstellungsseite projizierte es verlustbehaftet, „Mit Rücksprache“ bedeutete Widerruf, und drei Aufrufstellen leiteten die Freigabe jeweils anders ab. Wir haben entschieden: Die Regeln leben einmal pro Nutzer in `scoutAutonomy` (versioniert, gehasht) und gelten sofort für alle Suchaufträge. Das Mandat pro Suche wird entfernt; „Suche aktiv“ ist der Status des Suchauftrags, und jede Freigabe hält die Regel-Version fest. Der Nutzer wählt einmal, wie sein Scout arbeitet; eine zweite Regelkopie pro Suche erzeugte nur Abweichungen.

## Consequences

- Plattform-Umfang einer Suche = alle aktiven Plattformen minus die Quellen-Ausschlüsse des Nutzers; Preisdeckel kommt aus dem Suchauftrag.
- `mandateId` verschwindet von Opportunities, Requests und Approvals; Approvals tragen `autonomyVersion` und `autonomyHash`.
- Der Vier-Wege-Modus (guided, research_autopilot, outreach_autopilot, negotiation_autopilot) entfällt zugunsten von Autopilot | Rücksprache.
