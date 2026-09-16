# GPT-Live: Implementierungs- und Prüfstatus

Stand: 2026-09-16 · GPT-Live ist mit Release `415f27d` im Haupt-Checkout und auf
Produktion veröffentlicht. Marin ist konfiguriert; Realtime-Endpunkt, Transport
und Provider-Auswahl sind entfernt. Reale Voice-Abnahme und zehn Demo-Durchläufe
bleiben beim Nutzer. Die kontrollierte Portal-Nachprüfung ist separat offen.

Dieses Dokument unterscheidet implementiertes Verhalten, reale API-Nachweise und offene Prüfungen. Es enthält keine Zugangsdaten, Session-IDs oder Rohtranskripte. Umfang: [Migrationsplan](GPT_LIVE_MIGRATION_PLAN_2026-09-15.md). Aktueller Umzug: [Produktions-Umzugsplan](GPT_LIVE_PRODUCTION_MOVE_PLAN.md). Einrichtung und menschliche Prüfung: [Review Guide](GPT_LIVE_REVIEW_GUIDE.md).

**Technischer Integrationsstand:** Live-only-Ausbau `b19d12b` abgeschlossen.
155 Testdateien / 1.260 Tests bestanden, eine Datei/ein Test übersprungen;
Codegen, Typecheck und Produktionsbuild bestanden. Globales Lint: keine Fehler,
29 bestehende UI-Warnungen. Getypte API-Referenzen verbinden Frontend und Backend;
Realtime-Endpunkt, Transport und Provider-Auswahl sind entfernt. Historische
Session-Felder bleiben schema-kompatibel. Fast-forward und Deployment auf `fleet-jackal-83` sind abgeschlossen;
reale Voice-Abnahme und zehn Demo-Durchläufe bleiben beim Nutzer.

## Produktions-Nachprüfung am 16.09.2026

Health und direkte App-Routen antworten mit 200, der entfernte Realtime-POST mit
404. Live-OPTIONS erlaubt die Produktions-Site (204) und lehnt eine fremde Origin
ab (403). Das ausgelieferte App-Bundle enthält das Produktionsziel und keine
Sandbox-Endpunkte. Die Readiness-Action bestätigt fünf konfigurierte Dienste.
Ein bestehender Account lädt seine Suche, die englische Oberfläche und den
vorhandenen Chat; eine neue Textantwort benennt korrekt den gespeicherten Ort
und Radius. Schließen des Chats und Budgeteditor funktionieren.

Die vorhandene Portal-Verbindung des Testaccounts ist seit dem 14.09. deaktiviert;
ihr Firecrawl-Kontext wurde nach `VERIFICATION_TIMEOUT` gelöscht. Der Zustand
bestand vor diesem Release. Die Simulator-Funktionen sind vorhanden, aber es
gibt keinen aktiven kontrollierten Lauf. Daher bleibt der neue kontrollierte
Anfrage-/Antwort-Rundlauf offen; er benötigt eine wieder eingerichtete
Testverbindung oder einen frischen Testaccount. Es gab
keinen Datenreset, keinen Sandbox-Import und keinen Voice-Call durch Agenten.
Alte Umgebungsvariablen bleiben bis zur Nutzerabnahme für den manuellen
Wiederherstellungspunkt erhalten; der Live-only-Code verwendet sie nicht.

## Update 16.09.2026 — Auflegen und proaktiver Suchstart-Vorschlag

Der Nutzer bestätigte im erneuten Mikrofontest den verbesserten Gesprächsfluss,
Suchstart und schließlich auch das Auflegen. Zwei beobachtete Schwächen wurden
anschließend gezielt korrigiert:

- Ein erfolgreich validierter Auflegeauftrag derselben laufenden Session wird
  auch dann ausgeführt, wenn inzwischen weitere Sprache eingetroffen ist. Die
  Verabschiedung beginnt direkt; wartende Faktenaufträge halten den Call nicht
  offen. Der bestehende Abschied hat jetzt eine maximale Wartezeit von fünf
  Sekunden vor dem Close-Request. Ungesendeter Text bleibt als Entwurf erhalten.
- Die stille Faktenverarbeitung kann in einer Discovery mit Suchentwurf nach
  dem Speichern die vorhandene Bereitschaftsprüfung aufrufen. Der Scout soll
  dabei den gesamten sinnvollen Suchauftrag und offene Unklarheiten beurteilen;
  Ort und Radius allein sind kein Auftrag, sofort fertig zu sein. Sobald die
  reaktiven Daten die aktuelle gespeicherte Revision als bereit bestätigen,
  erhält Live einen Startvorschlag für eine passende Gesprächspause. Veraltete
  Vorschläge werden entfernt. Starten erfordert weiterhin eine ausdrückliche
  Nutzerentscheidung.

Marin und der zuletzt positiv getestete Ton bleiben erhalten. Gezielte
Backend-, Prompt-, Hook- und Seitenprüfungen sowie TypeScript, scoped ESLint,
Frontend-Build und Diff-Check bestanden. Für diese beiden Nachbesserungen wurde
kein weiterer Browser- oder Audiotest ausgeführt; den Sprachtest übernimmt
wie gewünscht der Nutzer.

## Vorheriges Update 16.09.2026 — Korrektur nach menschlichem Discovery-Test

Die menschliche Prüfung fand Regressionen, die die vorherigen synthetischen
Nachweise nicht ausreichend erfasst hatten: fehlende Eröffnung, ausbleibende
Anschlussfragen nach kurzen Antworten, verspätete Fakten, unvollständige
Voice-Historie und eine nicht schließbare Textansicht. In einer betroffenen
Session wurde der erste Backend-Auftrag erst 87,8 Sekunden nach dem Start
angenommen; seine Verarbeitung dauerte anschließend 7,1 Sekunden. Das ist ein
einzelner Diagnosefall, kein Latenzbenchmark.

Die Korrektur behält Live als Gesprächsführung und Terra als zuständigen Scout
bei. Nutzer- und Assistententranskript werden unabhängig von Tool-Turns in
derselben Agent-Unterhaltung gespeichert. Die bestehende Transkript-Tabelle
ordnet begrenzte, aktualisierbare Gesprächsabschnitte ihren Agent-Nachrichten
zu. Gesprochene Backend-Zusammenfassungen erzeugen keine zweite Assistenten-
Nachricht neben dem tatsächlichen Live-Transkript. Frühe Faktenverarbeitung
lädt keinen unbenötigten Anbieter- oder semantischen Memory-Kontext.

Neue Calls verwenden wieder `marin`. Ein leerer automatisch angelegter Entwurf
gilt nicht als vorheriges Gespräch. Die Persona bleibt warm und musikverständig;
die australische Vorgabe entfällt. Bei einem Rückschlag soll der Scout dessen
Auswirkung kurz anerkennen, bevor er zur nächsten praktischen Frage übergeht.

Die Client-Korrektur bindet stille Antworten an ihre Delegation, behandelt
kurze Antworten an einer Sprechpause und speichert getrennte Sprecherabschnitte.
Die Eröffnung erhält nach der Anweisungsbestätigung einen ausdrücklichen Start.
Auflegen führt zur normalen Scout-Ansicht; der Textchat hat auch während
Discovery eine Schließen-Schaltfläche.

Backend-/Prompt-/Chat-Prüfungen: 37 gezielte Tests bestanden; Frontend: 86 Tests
bestanden. Integrierter TypeScript-Check und Diff-Check bestanden. Das Backend wurde
auf die isolierte Entwicklungsinstanz übertragen. Der Nutzer übernimmt auf
ausdrücklichen Wunsch den nächsten zusammenhängenden Mikrofontest; für diese
Korrektur wird noch kein neuer bestandener Live-Audiolauf behauptet.
Die folgenden Abschnitte sind frühere Nachweise und beschreiben teilweise den
inzwischen korrigierten Stand.

## Vorheriger Stand 16.09.2026 — Live-geführte Discovery mit Ripple

Option B aus dem [Discovery-Plan](GPT_LIVE_DISCOVERY_PLAN.md) ist umgesetzt. Live wählt selbst passende Discovery-Fragen; der bestehende Terra-Scout bleibt für Speicherung, Memory, Bereitschaft und Aktionen zuständig. Normale Speicherungen liefern stillen bestätigten Kontext. Explizite Antworten und Aktionsbelege bleiben gesprochen. Die bestehende Suchbox und Streaming-Captions bleiben die Oberfläche.

In diesem damaligen Stand war die gemeinsame EN-/DE-Persona musikverständig,
aufmerksam und zurückhaltend trocken-humorig. Die damaligen neuen Sessions
verwendeten `ripple`; die echte API meldete diese Stimme. Der aktuelle Stand
verwendet wieder `marin`, wie im Update oben festgehalten. Bootstrap und laufende
Updates enthalten tatsächliche gespeicherte Werte einschließlich Radius und
Facets. Wechsel zu Suche, Pause oder Kandidatenansicht ändern die
Live-Verhaltensanweisung ausdrücklich.

### Neue reale Nachweise

- Eine erste Radiusfrage begann **7,74 Sekunden vor** dem Ergebnis der vollständigen Backend-Delegation. Der Backend-Text wurde dabei nicht als zweite Discovery-Antwort eingespeist.
- Kurze Antworten speicherten fünf Kilometer und Mittwochabend; die Budgetkorrektur von 300 auf 280 blieb erhalten. Der vollständige Turn legte auch dauerhafte Musiker-Memory an.
- Die Suche wurde im Test pausiert, während der Call verbunden blieb. Eine erneute Pausenbitte erhielt anschließend den korrekten Beleg, dass die Suche bereits pausiert ist.
- Der finale Call wechselte DE → EN mit einer Frage nach dem Probetag und EN → DE mit einer Equipment-Frage. Beide Antworten wurden als tatsächliches `commentary.append` an Live übergeben und in der richtigen Sprache ausgegeben. Die Equipment-Antwort unterschied gespeicherten Bedarf von unbestätigter Raumausstattung.
- Derselbe finale Call endete auf gesprochenen Wunsch mit Abschied und `session.closed`, ohne Live-API-Fehler. Die Suche blieb pausiert.

Die Eingaben waren synthetische Audiodateien; Live, WebRTC, Gateway-Scout und gespeicherte Änderungen waren echt. Gelegentliche erneute Fragen zu bekannten Angaben traten weiterhin auf; der subjektive Gesprächsfluss und Ton sind kein abgeschlossener menschlicher Akustiktest. Der aktuelle Durchlauf umfasst keine erneute externe Anbieterzustellung oder verbindliche Zusage.

### Gefundene und behobene Integrationsfehler

Stille Ergebnisse schließen den Agent-Turn unsichtbar ab, damit die spätere Textansicht nicht dauerhaft beschäftigt bleibt. Erfolgreiche Sprachwechsel behalten ihre Sachantwort: Der Browser prüft Aktualität vor dem eigenen Sprachwechsel; eine vorzeitig eintreffende Konfigurations-Query erzeugt währenddessen keinen zweiten Wechsel. Die tatsächlichen Start-/Pausenergebnisse überschreiben widersprüchlichen Modelltext. Eine bestätigte Auflegeanweisung benötigt neben ihrem Abschied keine zusätzliche Zusammenfassung.

Dauerhaft gespeichert werden konsolidierte Nutzereingaben, sichtbare Backend-Sachantworten und leere erfolgreiche Abschlussmarkierungen für stille Turns. Lives eigenständige Gesprächsbeiträge bleiben in den bisherigen lokalen Streaming-Captions; es wurde keine zusätzliche Transkript-Persistenz eingeführt.

**Prüfstand dieser Entwicklungsphase:** 159 Testdateien bestanden, eine übersprungen; **1.257 Tests bestanden, einer übersprungen**. Typecheck, Lint der betroffenen Dateien und Produktionsbuild bestanden. Die folgenden Abschnitte dokumentieren die früheren Migrationsnachweise und deren damaligen Prüfstand.

## Historische Umgebung und Isolation

- Branch `codex/gpt-live-migration`, Worktree `roomscout-gpt-live`, Frontend auf Port `5174`.
- Eigene Convex-Cloud-Entwicklungsinstanz: Branch `dev/gpt-live-migration-20260915`, Deployment `descriptive-kookabura-886` in `eu-west-1`, beim Anlegen mit 14 Tagen Ablaufzeit.
- Zum Zeitpunkt dieser isolierten Nachweise waren ursprünglicher Checkout,
  persönlicher Dev-Standard und Produktion nicht auf GPT-Live umgestellt. Der
  spätere Git-Integrationsstand ändert nichts an dieser historischen
  Evidenzgrenze; die spätere Veröffentlichung ist im aktuellen Kopf dieses Dokuments verzeichnet.
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
| Übergang | Im dokumentierten Entwicklungscheckpoint blieb der alte Realtime-Pfad noch per Provider-Schalter verfügbar. Im geprüften Integrationsstand `b19d12b` sind dieser Pfad und der Schalter entfernt. |

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

## Frühere vollständige automatisierte Prüfung

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

Der technische Produktionsdeploy ist belegt; eine vollständig geprüfte
Portal-/Voice-Demo wird nicht behauptet. Die isolierten Nachweise bleiben als Evidenz erhalten;
der aktuelle Live-only-Integrationsstand wurde mit den oben genannten 1.260 Tests geprüft. Alle realen Voice- und
Zehn-Durchläufe führt der Nutzer nach der Migration aus.
