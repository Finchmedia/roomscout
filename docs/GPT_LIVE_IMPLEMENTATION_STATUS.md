# GPT-Live: Implementierungs- und Prüfstatus

Stand: 2026-09-15 · Isolierte Entwicklungsintegration. Die menschliche Demo-Abnahme steht noch aus.

Dieses Dokument unterscheidet implementiertes Verhalten, reale API-Nachweise und offene Prüfungen. Es enthält keine Zugangsdaten, Session-IDs oder Rohtranskripte. Umfang: [Migrationsplan](GPT_LIVE_MIGRATION_PLAN_2026-09-15.md). Einrichtung und menschliche Prüfung: [Review Guide](GPT_LIVE_REVIEW_GUIDE.md).

## Umgebung und Isolation

- Branch `codex/gpt-live-migration`, Worktree `roomscout-gpt-live`, Frontend auf Port `5174`.
- Eigene Convex-Cloud-Entwicklungsinstanz: Branch `dev/gpt-live-migration-20260915`, Deployment `descriptive-kookabura-886` in `eu-west-1`, beim Anlegen mit 14 Tagen Ablaufzeit.
- Ursprünglicher Checkout, bisheriger persönlicher Dev-Standard und Produktion wurden nicht auf GPT-Live umgestellt. Kein Push oder Merge in den bisherigen Arbeitsbranch.
- Der erste Spike lief mit lokalem Convex auf `3220`/`3221`. Direkter Live-Handshake funktionierte; der lokale Backend-Runtime fehlt aber der AI-Gateway-Service-Token des Scout. Deshalb liefen die vollständigen Brain-Nachweise in der getrennten Cloud-Entwicklung.
- Firecrawl-Monitoring ist in dieser Instanz deaktiviert. Anbieter-/Angebotsnachweise verwenden ausschließlich inert angelegte synthetische Datensätze mit deaktiviertem Connector. Kein Anbieter wurde angeschrieben.

## Implementierter Umfang

| Bereich | Verhalten |
|---|---|
| Voice | Authentifizierter GPT-Live-WebRTC-Pfad mit nativen Captions, Mikrofonkontrolle, Unterbrechen und sauberem Ende |
| Brain | Der vorhandene Convex-Scout nutzt dieselben fachlichen Tools wie der Textpfad; Live führt keine Domain-Aktionen selbst aus |
| Eingaben | Serielle Session-Queue für Delegation, getippten Text und begrenzte frühe Faktenübernahme; ausdrücklicher Retry statt automatischer Wiederholung |
| Fakten | Kanonisch gespeicherte Felder treiben die rechte Box; gezielte Feldprüfungen schützen neuere Korrekturen |
| Frühe Übernahme | Derselbe Scout verarbeitet abgeschlossene Satzteile während längerer Sprache; nur reversible Suchfakten, keine Suche/Außenaktion/Entscheidungsantwort |
| Kontext | Kandidatenwahl wird mit dem Server synchronisiert; veraltete Ergebnisse dürfen keine aktuellen Aktionen oder unpassenden Ansagen auslösen |
| Hintergrund | Bestehende reaktive Queries liefern UI-Updates; ein flüchtiger Browser-Puffer wartet zusätzlich auf Mikrofon- und Transkript-Ruhe |
| Sprache | Englisch als Standard, ausdrücklich gewünschtes Deutsch wird gespeichert; EN/DE-Prompts und UI-Wörterbücher |
| Ton | Warm, aufmerksam und musikverständlich; kurze Antworten, keine Vollrecaps, keine erfundene Ausstattung oder Anbieterbestätigung |
| Lebensdauer | Voice bleibt bei Suchstart/Pause, Inline-Bearbeitung, Textansicht und Kandidatenansicht verbunden |
| Verbindliches | Annahme bleibt im bestehenden exakten UI-Review; Voice kann keine verbindliche Zusage ausführen |
| Fallback | Alter Realtime-Pfad bleibt per Provider-Schalter verfügbar; kein automatischer Wechsel mitten im Gespräch |

Keine neue persistente Voice-Outbox, kein allgemeiner Event-Koordinator und kein persistiertes Rohtranskript-Protokoll. Dauerhafte Nachrichten sind konsolidierte Nutzereingaben und Scout-Antworten. Frühe Faktenläufe speichern keine zusätzlichen Chat-Nachrichten.

## Reale API-Nachweise

Die Eingabe kam aus synthetischen englischen/deutschen Audiodateien in einem lokalen, nicht ausgelieferten Browser-Harness. WebRTC, GPT-Live, dessen Ereignisse, der Gateway-Scout und Convex-Schreibvorgänge waren echt.

### Lange Beschreibung und Fakten

- Der ursprüngliche Spike verarbeitete 36,84 Sekunden englische Sprache und 95 native Transkript-Deltas. Die erste native Delegation kam ungefähr eine Sekunde nach Audioende.
- Im späteren durchgehenden Lauf erschienen die ersten gespeicherten Fakten nach **10,96 Sekunden**, während die 36,84-sekündige Beschreibung noch lief. Weitere gespeicherte Ergänzungen kamen nach 20,26 und 26,85 Sekunden; später folgten Probetag und Lagerwunsch.
- Dieser Lauf hatte 88 native Eingabe-Deltas und die erste native Delegation etwa **0,87 Sekunden nach Audioende**. Die frühe Anzeige stammt daher nachweislich vom app-eigenen begrenzten Faktenpfad.
- Keine erfundenen Null-Euro-, Ein-Kilometer- oder negativen Sharing-Standardwerte im erneuten Lauf. Bereits gespeicherte Felder blieben über die aufeinanderfolgenden Teilübernahmen erhalten.
- Gesprochene Korrektur: 300 → 280 Euro und Dienstag → Mittwoch; andere Anforderungen blieben erhalten. Auf ausdrückliches „noch nicht suchen“ blieb der Auftrag im Entwurf.

Native Delegation während beliebig langer laufender Sprache ist weiterhin **keine behauptete API-Garantie**. Die Referenz beschreibt modellseitige `session.delegation.created`-Ereignisse. Der Delegation-Guide erlaubt die Auswertung von Transkriptfragmenten vor einer Delegation, verlangt dabei aber Rücksicht auf unvollständige Eingaben und Korrekturen. [Live API reference](https://developers.openai.com/api/reference/typescript/resources/live) · [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)

### Sprache, Aktionen und Oberfläche

- EN → DE → EN funktionierte im selben realen Gespräch, einschließlich gespeicherter Sprachwahl und UI-Wechsel. Die Rückfrage nur nach dem Probetag erhielt eine kurze Antwort zu Mittwoch.
- Der Scout unterschied beim Lagerwunsch ausdrücklich zwischen einer gespeicherten Anforderung und einer erst noch nötigen Anbieterbestätigung.
- Suchstart per Stimme setzte den Auftrag auf aktiv. Später wurde bei **geöffnetem Kandidaten-/Angebotspanel** per Stimme pausiert; die UI zeigte den gespeicherten Zustand `paused`.
- Eine nichtbindende Rückfrage wurde gesprochen beantwortet und geschlossen. Mittwoch blieb gespeichert.
- Ein gesprochenes „Angebot annehmen“ wurde an die Prüfung in der App verwiesen. Die anschließende Datenprüfung ergab **null Action Requests, null Approvals, null Executions und keinen Annahmebeleg** für den Testnutzer und das Testangebot.
- Inline-Budgetänderung auf 275 Euro wurde bei laufendem Gespräch gespeichert. Dieselbe Session blieb verbunden.
- Mikrofon-Aus wurde zusätzlich in einem früheren echten Lauf mit `session.input_audio.muted` bestätigt.

### Anbieterantwort während Sprache

- Während einer 27,35-sekündigen Erzählung wurden synthetisches Angebot und Rückfrage in den vorhandenen Domain-Tabellen angelegt und während laufender Sprache in der UI sichtbar.
- Während der ganzen Audioeingabe wurde kein neues `commentary.append` gesendet.
- Nach Audioende kam zuerst die Antwort auf den aktuellen Gesprächsbeitrag. Der Hintergrund-Relay folgte bei 33,40 Sekunden, also rund sechs Sekunden nach Ende der Eingabe. Live erwähnte anschließend das zur Prüfung verfügbare Angebot.
- Das prüft den realen Weg **gespeicherter Domain-Zustand → reaktive UI → Live-Relay → gesprochene Erwähnung**. Es prüft keine externe Portalzustellung oder Anbieter-Ingestion.

## Fehler, die durch diese Nachweise gefunden und korrigiert wurden

- Fragmentgrenze 64 → 1.024 mit zusätzlicher Zeichengrenze; keine stille Kürzung auf die letzten 80 Deltas.
- Transkriptdeltas werden ohne eingefügte Wortzwischenräume zusammengefügt. Bereits aufgelöste Nutzertexte werden nicht erneut als neuer Auftrag gespeichert.
- Satzende mitten in einem Delta wird erkannt; der frühe Cursor bleibt getrennt von der späteren vollständigen Delegation.
- Breite optionale Toolargumente erzeugten erfundene Standardwerte und leere Listen. Der Scout schreibt jetzt explizit benannte Änderungen statt eines vollständigen optionalen Feldobjekts.
- Doppeltes Budget in Freitext-Anforderungen und Musikerrollen als Instrumente wurden im realen Lauf entdeckt. Der neue Toolvertrag verlangt bei Budget-/Zeitänderungen explizit benannte, ersetzte Anforderungstexte; Instrumentrollen werden über eine enge Aliasliste kanonisiert. Ein weiterer frischer realer Lauf bestand anschließend: erste Fakten nach 9,16 Sekunden, 90 Deltas im langen Brief, danach 280 Euro/Mittwoch ohne alten Betrag im Freitext und ohne doppelte Instrumentrollen.
- Kandidatenauswahl ohne synchronisierten Serverfokus konnte nachfolgende Sprachbefehle verwerfen. Die synchronisierte Variante bestand den echten Pausenbefehl bei geöffnetem Angebot.
- Eine reine Caption-Lücke war kein ausreichender Nachweis einer Gesprächspause. Der Relay beachtet jetzt zusätzlich Mikrofonaktivität; der echte 27-Sekunden-Lauf bestand.
- Verbundene Discovery nutzte zunächst eine zu hohe Voice-Karte. Verbundene Gespräche verwenden nun auch dort die kompakte Darstellung.
- Doppelte Entscheidungskarten überlagerten im kombinierten Text-/Angebotslayout den Composer. Die globale Kopie wird bei vorhandener Entscheidung im sichtbaren Gespräch entfernt; die Chat-Fläche erhält zusätzlich eine begrenzte Höhe ohne Flex-Schrumpfen. Die echte Wiederholung bestand: Text wurde gespeichert und beantwortet; beim Fokussieren und Absenden blieb die zentrale Fläche bei y=84 und `main.scrollTop=0`. Captions scrollen ausschließlich ihren eigenen Ausschnitt.

## Abschließende Wiederholungen

- Ein neuer Live-Call knüpft am gespeicherten pausierten Suchauftrag an. Nach Entfernen einer überschreibenden Browser-Anweisung lautete die reale Begrüßung neutral: „Hey, welcome back. What would you like to pick up?“
- Eine getippte Frage im laufenden Call und geöffneten Angebotsmodus lieferte zunächst einen alten Chat-Budgetwert. Seit der Korrektur liest der Scout den eigenen aktuellen Suchauftrag unmittelbar vor der Generierung; `getCurrentSearch` steht außerdem in allen normalen Modi bereit. Derselbe reale Fall antwortete danach zweimal korrekt mit **275**, obwohl Chat- und Anbieterhistorie noch **280** enthalten.
- Das endgültige Desktop-Layout bestand die reale Bedienung: Voice bleibt oben, Text-Composer nimmt Eingaben an, Kandidat und Suchauftrag bleiben erreichbar. `overflow:clip` verhindert unbeabsichtigtes Scrollen der gesamten zentralen Fläche durch Fokuswechsel; innere Chat-/Detailflächen scrollen weiterhin.
- Der mobile Ruhe-/Pausenzustand wurde als echte App in einem 390-Pixel-Iframe angesehen: Einstiege für Voice, Text, Kandidaten und Suchauftrag sind sichtbar. Das ist eine Responsive-Sichtprüfung und kein bestandener mobiler Audio-Test.
- Für Antworten, deren Auftrag durch eine neuere Spracheingabe oder getippten Auftrag überholt wurde, bleibt der bestätigte Backend-Beleg erhalten; die alte Sprachzusammenfassung wird unterdrückt. Diese letzte Reihenfolgenregel ist durch gezielte Runtime-Regressionen abgedeckt.

## Automatisierte Prüfung

Abschließender vollständiger Lauf auf dem integrierten Code-Stand `fb2a340` samt den danach mitgesicherten generierten Deklarationen und Prompt-Testanpassungen:

- **157 Testdateien bestanden, eine übersprungen; 1.204 Tests bestanden, einer übersprungen.**
- **Typecheck bestanden.**
- **Produktionsbuild bestanden** (2.604 Module).
- **Lint bestanden: null Fehler, 29 bestehende Hinweise** zu ungenutzten ESLint-Ausnahmen in den UI-Primitives.
- Vitest meldete zusätzlich vier Node-Hinweise zu einem nicht gültig gesetzten `--localstorage-file`; keine Testfehler.

Die globale Lint-Konfiguration ignoriert erzeugte Proof-Artefakte und kennt die tatsächlichen Laufzeit-Globals der vorhandenen lokalen Browser-/Firecrawl-Helfer. Deren Logik wurde dabei nicht verändert.

## Noch menschlich beziehungsweise extern zu prüfen

- Echte Mikrofone, Kopfhörer, Raumgeräusche, Echo und natürliche Unterbrechungen; subjektiver Stimmklang, Wärme, musikalische Glaubwürdigkeit und Humor.
- Mobilbedienung während eines echten Voice-Calls und vollständiges Demo-Timing mit einem Menschen; Desktop-Text/Voice/Kandidatenbedienung ist technisch wiederholt geprüft.
- Portal-/Anbieterantwort von tatsächlicher Ingestion bis zur gesprochenen Erwähnung als verbundener Gesamtablauf. Der synthetische Fixture ersetzt diesen Nachweis nicht.
- Manuelle Netzunterbrechung, erneuter Einstieg und längere Gespräche unter realen Netzbedingungen. Unit- und Integrationstests decken die Fehlerzustände ab, sind aber kein Akustik-/Netztest.

Es wird weder eine Produktionsfreigabe noch eine bestandene menschliche Hackathon-Demo behauptet. Die isolierte Implementierung ist der Gegenstand des Reviews.
