# GPT-Live: Implementierungs- und Prüfstatus

Stand: 2026-09-15 · Lokale Integrationsarbeit, keine Produktionsfreigabe.

Dieses Dokument hält nur beobachtete Ergebnisse und noch offene Nachweise fest. Es enthält keine Session-IDs, Rohtranskripte oder Zugangsdaten. Produktumfang und Abnahmekriterien stehen im [Migrationsplan](GPT_LIVE_MIGRATION_PLAN_2026-09-15.md).

## Aktuelle Umgebung

- Die GPT-Live-Arbeit läuft in einem isolierten Branch/Worktree.
- Lokale Dienste: Convex auf Port `3220`, Convex Site auf Port `3221`, Frontend auf Port `5174`.
- Diese Ports belegen eine lokale Testumgebung, kein Deployment und keine Ende-zu-Ende-Freigabe.

## Belegte Ergebnisse

- [x] Ein echter GPT-Live-WebRTC-Handshake war erfolgreich.
- [x] Captions und die zugehörigen Protokoll-ACKs wurden im realen Live-Pfad beobachtet.
- [x] Der anfängliche Fehler an der Grenze von 64 gepufferten Fragmenten wurde behoben; die Grenzen liegen nun bei 1.024 Fragmenten und 64.000 Zeichen.
- [x] Das englische UI-Wörterbuch enthält 1.338 Leaf-Einträge.
- [x] Im letzten protokollierten UI-Testlauf bestanden 38 Tests.

Diese Punkte belegen jeweils ihren begrenzten technischen Pfad. Sie belegen noch nicht den vollständigen Demo-Ablauf.

## Phase-0-Live-Evidenz

- [x] Eine synthetische, ununterbrochene englische Suchbeschreibung lief 36,84 Sekunden.
- [x] Dabei wurden 95 `session.input_transcript.delta`-Ereignisse empfangen.
- [x] Die erste `session.delegation.created`-Meldung kam ungefähr 1,0 Sekunde nach dem Audioende.
- [x] Damit ist Client Delegation grundsätzlich beobachtet, eine native Delegation während laufender Sprache jedoch nicht belegt.

Die offizielle Live-API dokumentiert `session.delegation.created` als vom Modell erzeugtes Ereignis und keinen Client-Befehl für eine zeitlich erzwungene Delegation. [Live API reference](https://developers.openai.com/api/reference/typescript/resources/live) Die Delegationsdokumentation erlaubt der Anwendung, Transkriptfragmente vor einer Delegation auszuwerten und damit eigene Arbeit oder UI-Aktualisierungen anzustoßen; Fragmente können unvollständig sein und müssen gegen spätere Korrekturen sowie doppelte Aktionen abgesichert werden. [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)

## In Arbeit, noch nicht validiert

- [ ] Der echte bestehende Scout-Brain verarbeitet den vollständigen Live-Auftrag im integrierten Pfad.
- [ ] Reversible Suchfakten werden während längerer Sprache über den begrenzten app-eigenen Intent durch denselben Scout und dieselbe serielle Queue gespeichert.
- [ ] Der app-eigene frühe Pfad verwendet `delegation_id:null`, bleibt von nativer Client Delegation unterscheidbar und erzeugt keine zweite fachliche Schreiblogik.
- [ ] Die kanonische gespeicherte Suchquery treibt Faktenanzeige und Animation; ungespeicherte Transkriptkandidaten erscheinen nicht als Fakten.
- [ ] Eine Mid-Speech-Korrektur ersetzt den älteren Wert ohne spätes Zurücksetzen oder doppelte Ausführung.
- [ ] Englisch als Standard, expliziter Deutschwechsel und EN→DE→EN funktionieren im integrierten Live-Ablauf.
- [ ] Der ungeschnittene englische Demo-Ablauf besteht Ende zu Ende mit echtem Brain, Fakten, Korrektur, UI und Voice.

## Review-Checkliste für den nächsten Evidenzstand

- [ ] Für native Delegation und app-eigenen frühen Intent getrennte Zeitpunkte protokollieren.
- [ ] Nur synthetische Testinhalte verwenden; keine Rohtranskripte oder Session-IDs dokumentieren.
- [ ] Vor jeder UI-Behauptung den kanonischen gespeicherten Suchstand prüfen.
- [ ] Unvollständige, mehrdeutige und später korrigierte Fragmente abdecken.
- [ ] Deduplizierung zwischen frühem App-Intent und später nativer Delegation belegen.
- [ ] Suchstart, Pause, Entscheidungen, Anbieterkommunikation und verbindliche Aktionen vom frühen Faktenpfad ausgeschlossen halten.
- [ ] Die 38 UI-Tests nach Integrationsänderungen erneut ausführen und den neuen tatsächlichen Stand eintragen.
- [ ] Live-Abnahme erst nach realem Durchlauf als bestanden markieren.
