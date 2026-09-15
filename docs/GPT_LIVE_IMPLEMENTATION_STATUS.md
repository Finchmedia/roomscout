# GPT-Live: Implementierungs- und Prüfstatus

Stand: 2026-09-15 · Isolierte Integrationsarbeit, keine Produktionsfreigabe.

Dieses Dokument hält nur beobachtete Ergebnisse und noch offene Nachweise fest. Es enthält keine Session-IDs, Rohtranskripte oder Zugangsdaten. Produktumfang und Abnahmekriterien stehen im [Migrationsplan](GPT_LIVE_MIGRATION_PLAN_2026-09-15.md).

## Aktuelle Umgebung

- Die GPT-Live-Arbeit läuft in einem isolierten Branch/Worktree.
- Das Frontend läuft auf Port `5174` im Worktree `roomscout-gpt-live`, Branch `codex/gpt-live-migration`.
- Der erste Spike lief mit lokalem Convex (`3220`/`3221`). Dort funktioniert der direkte Live-Handshake, aber `getServiceToken("ai-gateway")` wird vom lokalen Backend ausdrücklich abgelehnt.
- Für den echten Scout-Brain wurde daher die getrennte Cloud-Entwicklungsinstanz `dev/gpt-live-migration-20260915` angelegt: `descriptive-kookabura-886` (eu-west-1), mit Ablauf nach 14 Tagen. Der bisherige persönliche Dev-Standard und die Produktion bleiben unverändert.
- Die Testinstanz erhält nur für die Integration nötige Umgebungsvariablen; Firecrawl-Monitoring ist dort abgeschaltet. Es wurden keine Anbieter angeschrieben.

## Belegte Ergebnisse

- [x] Ein echter GPT-Live-WebRTC-Handshake war erfolgreich.
- [x] Captions und die zugehörigen Protokoll-ACKs wurden im realen Live-Pfad beobachtet.
- [x] Der anfängliche Fehler an der Grenze von 64 gepufferten Fragmenten wurde behoben; die Grenzen liegen nun bei 1.024 Fragmenten und 64.000 Zeichen.
- [x] Die stille Begrenzung auf die letzten 80 Fragmente und eingefügte Leerzeichen zwischen Deltas sind behoben. Im zweiten echten Durchlauf kamen 93 Deltas an; Berlin, vierköpfige Band, Kreuzberg/Neukölln und die letzten Anforderungen wurden vollständig gespeichert.
- [x] Das englische UI-Wörterbuch enthält 1.338 Leaf-Einträge.
- [x] Der vollständige Testlauf vor den letzten Runtime-Erweiterungen bestand mit 1.151 erfolgreichen Tests und einem übersprungenen Test; der Produktionsbuild war grün. Die neueren Runtime-/UI-Änderungen wurden zusätzlich gezielt getestet; ein abschließender Gesamtlauf steht aus.

Diese Punkte belegen jeweils ihren begrenzten technischen Pfad. Sie belegen noch nicht den vollständigen Demo-Ablauf.

## Phase-0-Live-Evidenz

- [x] Eine synthetische, ununterbrochene englische Suchbeschreibung lief 36,84 Sekunden.
- [x] Dabei wurden 95 `session.input_transcript.delta`-Ereignisse empfangen.
- [x] Die erste `session.delegation.created`-Meldung kam ungefähr 1,0 Sekunde nach dem Audioende.
- [x] Damit ist Client Delegation grundsätzlich beobachtet, eine native Delegation während laufender Sprache jedoch nicht belegt.

Die offizielle Live-API dokumentiert `session.delegation.created` als vom Modell erzeugtes Ereignis und keinen Client-Befehl für eine zeitlich erzwungene Delegation. [Live API reference](https://developers.openai.com/api/reference/typescript/resources/live) Die Delegationsdokumentation erlaubt der Anwendung, Transkriptfragmente vor einer Delegation auszuwerten und damit eigene Arbeit oder UI-Aktualisierungen anzustoßen; Fragmente können unvollständig sein und müssen gegen spätere Korrekturen sowie doppelte Aktionen abgesichert werden. [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)

## In Arbeit, noch nicht validiert

- [x] Der bestehende Scout-Brain verarbeitet den vollständigen Live-Auftrag über den Gateway in der isolierten Cloud. Zuvor wurde derselbe Brain separat mit einer reinen Textnachricht erfolgreich geprüft.
- [ ] Reversible Suchfakten werden während längerer Sprache über den begrenzten app-eigenen Intent durch denselben Scout und dieselbe serielle Queue gespeichert.
- [ ] Der app-eigene frühe Pfad verwendet `delegation_id:null`, bleibt von nativer Client Delegation unterscheidbar und erzeugt keine zweite fachliche Schreiblogik.
- [ ] Die kanonische gespeicherte Suchquery treibt Faktenanzeige und Animation; ungespeicherte Transkriptkandidaten erscheinen nicht als Fakten.
- [ ] Eine Mid-Speech-Korrektur ersetzt den älteren Wert ohne spätes Zurücksetzen oder doppelte Ausführung.
- [x] EN→DE→EN wurde im selben echten Gespräch beobachtet: explizite gesprochene Wünsche ändern Stimme und UI. Die Rückfrage nach nur dem Probetag erhielt die kurze Antwort „Yep, Wednesday evenings.“ Freitext-Fakten werden durch den Sprachwechsel nicht automatisch übersetzt.
- [ ] Der ungeschnittene englische Demo-Ablauf besteht Ende zu Ende mit echtem Brain, Fakten, Korrektur, UI und Voice.

## Weitere reale Integrationsergebnisse

- [x] Nach der langen Beschreibung wurden 300 Euro und Dienstag gespeichert. Die nächste gesprochene Korrektur ersetzte dies durch 280 Euro und Mittwoch; Ort und andere Anforderungen blieben erhalten.
- [x] Während dieses Durchlaufs blieb die Suche im Entwurf. Die ausdrückliche Bitte, weder Suche noch Kontakt zu starten, wurde eingehalten.
- [x] Mikrofon ausschalten deaktivierte die lokale Eingabe und wurde mit dem echten Ereignis `session.input_audio.muted` bestätigt.
- [ ] Frühe Faktenanzeige ist noch nicht bestanden: Im zweiten Durchlauf kamen die ersten gespeicherten Fakten erst rund 13,7 Sekunden nach dem Audioende. Echte Deltas enthalten teils Satzende und Anfang des nächsten Satzes gemeinsam; die Erkennung wird mit diesen Fragmentgrenzen korrigiert.
- [ ] Die reale Unterhaltung zeigte unnötige Fragen zu bereits bekanntem Teilen sowie eine Vermischung eigener gelagerter Instrumente mit vorhandener Ausstattung. Prompt-/Tool-Guidance wird gezielt korrigiert; danach erneut sprechen.
- [ ] Der UI-Wechsel bleibt in Komponenten-Tests verbunden und ist kompakt umgesetzt; Anbieter-/Entscheidungsablauf und visuelle Endabnahme stehen noch aus.

Die Eingabe stammt aus synthetischen englischen/deutschen Audio-Dateien im lokalen, nicht ausgelieferten Testharness. WebRTC, GPT-Live, Captions, der Gateway-Scout und gespeicherte Convex-Fakten sind echt. Eine menschliche Hörprobe zu Stimmklang, Raumgeräuschen und natürlichem Barge-in ist damit nicht ersetzt.

## Review-Checkliste für den nächsten Evidenzstand

- [ ] Für native Delegation und app-eigenen frühen Intent getrennte Zeitpunkte protokollieren.
- [ ] Nur synthetische Testinhalte verwenden; keine Rohtranskripte oder Session-IDs dokumentieren.
- [ ] Vor jeder UI-Behauptung den kanonischen gespeicherten Suchstand prüfen.
- [ ] Unvollständige, mehrdeutige und später korrigierte Fragmente abdecken.
- [ ] Deduplizierung zwischen frühem App-Intent und später nativer Delegation belegen.
- [ ] Suchstart, Pause, Entscheidungen, Anbieterkommunikation und verbindliche Aktionen vom frühen Faktenpfad ausgeschlossen halten.
- [ ] Die 38 UI-Tests nach Integrationsänderungen erneut ausführen und den neuen tatsächlichen Stand eintragen.
- [ ] Live-Abnahme erst nach realem Durchlauf als bestanden markieren.
