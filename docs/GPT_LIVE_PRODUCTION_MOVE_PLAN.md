# GPT-Live: Umzug in Haupt-Checkout und Produktion

Stand: 16.09.2026 · Revision 3 mit Ausführungsstand. Die folgenden Abschnitte bleiben das beschlossene Vorgehen; der tatsächliche Stand steht hier.

## Ausführungsstand

- Remote-Sicherung beider Branches und annotierter Tag `prod-pre-gpt-live` auf `e55092b` bestätigt.
- Code-Checkpoint `aca88c8`, Dokumentations-Checkpoint `ba023e7`; Merge **M = `d37a46555e64399085e333219e2833e24673e1a0`** ist remote gesichert.
- Gemeinsamer typisierter Vertrag `25c0163`, Readiness `1eeb4d7`, vollständiger Live-only-Ausbau `b19d12b`.
- Codegen, Typecheck und Produktionsbuild bestanden; 155 Testdateien mit **1.260 Tests bestanden**, eine Datei/ein Test übersprungen. Globales Lint: keine Fehler, 29 bestehende UI-Warnungen.
- Produktionskonfiguration für Live, Marin und exakte Site-Origin vorbereitet; bestehende Firecrawl-/Mapbox-Konfiguration geprüft, alte Variablen unverändert erhalten.
- Haupt-Checkout-Fast-forward, Deployment und Nicht-Voice-Nachprüfung stehen als nächste Schritte aus. Kein Datenreset und kein realer Voice-Test durchgeführt.
- Nutzerprüfung und zehn Demo-Durchläufe bleiben separat offen.

## 1. Ziel und verbindliche Vorgaben

GPT-Live wird der einzige aktive Voice-Pfad. Realtime-Transport, Endpunkt und
Provider-Auswahl werden beim Umzug entfernt. Gemeinsame Session-Funktionen und
lesbare historische Daten bleiben erhalten. Die bestehende App-Adresse und das
Produktions-Deployment werden weiterverwendet.

- **Marin ist gesetzt und vom Nutzer bestätigt.** Kein erneuter Stimmvergleich
  und keine Suche nach einer vermeintlich noch aktiven Ripple-Konfiguration.
- **Keine echten Voice-Tests durch Agenten während des Umzugs:** keine Calls,
  Mikrofonbenutzung, synthetische Audioeinspeisung oder automatische Sprachdemo.
  Der Nutzer übernimmt die Sprachtests nach Übergabe. Unit-/Integrationstests mit
  Mocks, HTTP-Prüfungen und Nicht-Voice-UI-Prüfungen bleiben Teil der technischen Prüfung.
- Die zwei jüngsten Nachbesserungen sind technisch geprüft, noch nicht erneut
  menschlich abgenommen. Das ist kein vorgeschaltetes Mikrofontest-Gate für den Merge.
- Englisch ist Standard ohne ausdrückliche Sprachwahl. Ein gespeicherter Wunsch
  nach Deutsch bleibt gültig; keine pauschale Überschreibung aller Sprachpräferenzen.
- Keine Datenübernahme aus der Sandbox und kein Reset als Bestandteil des Umzugs.
- Vorbereitung in den vorhandenen zwei Worktrees; ein Integrator schreibt und
  veröffentlicht den Gesamtstand. Parallel arbeitender Claude Code wird für das
  vereinbarte Integrationsfenster mit einbezogen.

## 2. Geprüfte Ausgangslage

| Bereich | Stand bei der Planprüfung |
|---|---|
| Haupt-Checkout | `roomscout`, `autopilot-policy`, `e55092b` |
| Live-Checkout | `roomscout-gpt-live`, `codex/gpt-live-migration`, `5a4c002` plus uncommittete Fixes/Dokumentation |
| Gemeinsamer Ausgangspunkt | `3184f73` |
| Hauptbranch seitdem | Vier Dokumentations-Commits; Demo-Drehbuch und Prioritäten |
| Live-Branch seitdem | 56 Commits plus Working Tree |
| Gemeinsame Dateiänderung | `docs/DEMO_PRIORITIES.md`; geprüfte Änderungen ohne überlappende Konflikthunks |
| Produktionsziel laut Repo | `fleet-jackal-83` mit Convex Static Hosting |
| Live-Testumgebung | `descriptive-kookabura-886`, eigene Cloud-Entwicklung |

Die vollständige Migration wird zusammengeführt: Transport, Scout-Tools, Fakten,
Englisch, Persistenz und UI sind gemeinsam entwickelt. Vor Ausführung Branches,
Arbeitsverzeichnisse, Remote-Refs und tatsächlich veröffentlichten Stand erneut
prüfen. Ein Repo-Tag sichert Quellcode, aber weder Deployment-Konfiguration noch
Datenbank; `e55092b` ist nicht allein durch seinen Namen ein nachgewiesenes Live-Release.

## 3. Sicherung, Commit-Grenzen und Zusammenführung

### 3.1 Exklusives Arbeitsfenster und Remote-Sicherung

1. Schreibende Arbeit in beiden Checkouts abstimmen. Tatsächlich laufende Prozesse
   erfassen: insbesondere beide Vite-Server und alte Browser-Tabs; Dev-/Deploy-Watcher
   nur dann anhalten, wenn welche laufen. Keine ungeprüfte Behauptung über Watcher.
2. Den uncommitteten Diff und die neu angelegte Plan-Datei außerhalb des Repos
   sichern, ohne `.env`-Dateien, Zugangsdaten oder `node_modules` zu kopieren.
3. Einen zusammenhängenden **Code-Checkpoint** der aktuellen Korrekturen und einen
   separaten **Dokumentations-Checkpoint** erstellen. Die bestätigten Regressionen
   und die zwei letzten Ergänzungen greifen in denselben Dateien und benachbarten
   Hunks ineinander. Eine nachträgliche Dreiteilung würde Zwischenstände rekonstruieren,
   die nicht genau so menschlich getestet wurden. Teststatus deshalb ausdrücklich
   dokumentieren, statt einen Commit pauschal als menschlich abgenommen zu bezeichnen.
4. Nur explizite Pfade beziehungsweise gezielt geprüfte Hunks stagen. Kein
   `git add -A`: `node_modules` ist ein Symlink, den das jetzige Muster
   `node_modules/` nicht schützt. Den Ignore-Eintrag auch für den Symlink absichern;
   vor jedem Commit `git diff --cached --name-status` prüfen. Die neue Plan-Datei
   muss im Doku-Checkpoint ausdrücklich mit aufgenommen werden.
5. **Vor dem Merge** beide Branches auf `origin` sichern und den bisherigen
   Hauptbranch-Stand als annotierten `prod-pre-gpt-live`-Tag sichern. Vorgesehene
   Befehle nach Prüfung der Refs:

   ```sh
   git push origin autopilot-policy
   git push -u origin codex/gpt-live-migration
   git tag -a prod-pre-gpt-live e55092b -m "Repository checkpoint before GPT-Live integration"
   git push origin prod-pre-gpt-live
   ```

   Vorhandenen Tag nicht überschreiben. Wenn der Hauptbranch inzwischen weiter ist,
   den tatsächlich vereinbarten Ausgangscommit taggen. Push-Ergebnis/Remote-SHAs
   prüfen; bei fehlgeschlagener Sicherung noch nicht integrieren. Keine Force-Pushes.

### 3.2 Merge und getrennte Bereinigung

6. **Im Live-Worktree** `autopilot-policy` mit `--no-ff` in
   `codex/gpt-live-migration` mergen. Diesen Merge-Commit als **M** notieren und
   auf den Remote sichern. M enthält die additive Live-Struktur und noch den alten
   Voice-Code; er ist der vorgesehene schema-kompatible Wiederherstellungspunkt.
7. Alle Realtime-Entfernungen und Schnittstellenänderungen aus §4 als eigene,
   technisch geprüfte Commits **nach M** erstellen. Sie werden nicht in den
   Merge hineingemischt. M ist ein technischer Checkpoint, keine neue Voice-Abnahme.
8. Das aktuelle Demo-Drehbuch und seine Reihenfolge aus dem Hauptbranch erhalten.
   Nutzerkorrekturen wie „Qualitätsnachweis“ behalten; überholtes „GPT-Live nur
   geplant / nicht anfassen“ und alte Voraussetzungen gezielt aktualisieren.
9. **Im Haupt-Checkout** alle sechs kollidierenden unversionierten Dateien in eine
   Sicherung außerhalb des Checkouts verschieben — auch die fünf bytegleichen:

   - `docs/GPT_LIVE_MIGRATION_PLAN_2026-09-15.md`
   - `docs/GPT_LIVE_VOICE_PLAN.md`
   - `scripts/firecrawl-local-lib.mjs`
   - `scripts/firecrawl-local-message.mjs`
   - `scripts/firecrawl-local-signup.mjs`
   - `scripts/firecrawl-local-verify.mjs`

   Der erste Plan ist eine ältere Revision 2, die Live-Fassung Revision 3.
   Alte Kopie sichern, neuere Fassung übernehmen. Kein `git clean`.
10. Nach den Prüfungen `autopilot-policy` **im Haupt-Checkout** mit
    `git merge --ff-only codex/gpt-live-migration` vorziehen. Kein Branch-Checkout
    in fremd belegten Worktrees. Neue parallele Commits zuerst zurück in den
    Integrationsstand holen und betroffene Checks wiederholen.

## 4. Vollständige Umsetzungsliste und gekoppelte Verträge

### 4.1 Backend-Ausbau

| Datei | Geplante Änderung |
|---|---|
| [convex/http.ts](../convex/http.ts) | Realtime-Import sowie POST- und OPTIONS-Routen für `/api/realtime/session` entfernen |
| [convex/voice.ts](../convex/voice.ts) | Nur `expireSession` und `endMine` als gemeinsame Session-Funktionen behalten |
| [convex/voiceLive.ts](../convex/voiceLive.ts) | `configuredProvider`, Provider-Gate in `sessionHttp`, `LiveEnvironment.VOICE_PROVIDER` und alten Origin-Rückgriff entfernen |
| `convex/convex.config.ts` | `VOICE_PROVIDER` entfernen; Codegen anschließend neu ausführen |
| `convex/ops.ts` | Serverseitiges Label „Realtime Scout session“ auf neutrale Scout-Session-Beschriftung ändern |
| `convex/scout.ts` | Transkript-Zuordnung in `listMessages` duplikattolerant machen, siehe unten |

Aus `voice.ts` müssen konkret entfernt werden: `optionsHttp`, `getVoiceContext`,
`openSession`, `setSessionStatus`, `sessionHttp`, `executeTool`, `getInstructions`,
`getOwnedSession`, `getPublicSignal`, `recordTranscript`, der private Helper
`realtimeTools` und danach unbenutzte Imports/Handshake-Helfer.

`expireSession` und `endMine` behalten ihre vorhandenen Funktionsnamen und
Berechtigungsprüfungen. Live verwendet sie schon; auch bestehende geplante
Ablaufjobs finden weiterhin ihr Ziel. Dafür braucht es keinen Übergangsadapter.

### 4.2 Gemeinsamer Schnittstellen-Commit

`makeFunctionReference` verbindet mehrere APIs über Strings; Typecheck allein
prüft dabei nicht den tatsächlichen Serververtrag. Deshalb gehören gemeinsam
in einen Commit und in gekoppelte Tests:

- `voiceLive.getConfig`: nur noch `{ locale }`.
- `VoiceSessionProvider.tsx`: Vertrag anpassen, nur Live instanziieren; keine
  `activeProvider`-/`configuredProvider`-Verzweigung und kein Realtime-Mock als Default.
- `voiceLive.getSessionState`: Provider-Feld aus dem Antwortvertrag entfernen;
  `session.provider ?? "realtime"` entfällt. Den lokalen `LiveSessionState`-Typ
  und betroffene Tests gleichzeitig anpassen. Alte Zeilen nicht als Live umetikettieren.
- Alle fünf String-Referenzen im Live-Hook abgleichen: Delegation, Session-Zustand,
  Sprachwechsel, `voice:endMine` und Transkript-Persistenz. Ihre verbleibenden
  Request-/Response-Verträge ausdrücklich testen.

Nach Backend-Änderung und Codegen die Referenzen nach Möglichkeit über
`api.voiceLive.*` beziehungsweise `api.voice.endMine` anbinden, damit auch der
Compiler die Serververträge sieht. Verbleibende explizit typisierte String-Referenzen
benötigen weiterhin den gemeinsamen Vertragstest; eine Typannotation allein ist
kein Nachweis, dass der Server diese Form tatsächlich liefert.

Die Typdeklaration `LiveEnvironment` in `voiceLive.ts` muss explizit bereinigt
werden; der bestehende Double-Cast schützt nicht vor einer veralteten Deklaration.

### 4.3 Frontend-Ausbau und dauerhafte URL-Korrektur

- `VoiceScoutStatus`, `VoiceScoutModality`, `VoiceTranscriptItem` aus dem alten
  Hook in ein neutrales Typmodul verschieben. Im Live-Hook, `VoiceSessionContext`
  und **`src/ui/chat/LiveVoiceChat.tsx`** die Importe umstellen.
- `useRealtimeVoiceScout` und `realtimeRuntime` samt Tests löschen;
  `RealtimeVoiceScout` samt Test/CSS und den ausschließlich dort verwendeten
  `VoiceVolumeBlob` samt CSS entfernen.
- Unbenutzte Barrels `src/hooks/index.ts` und `src/components/voice/index.ts`
  nach letzter Importprüfung entfernen.
- Provider-Verzweigungen in ScoutPage, LiveVoiceChat und Test-Fixtures entfernen.
  Bestehende Blob-/Streaming-UI, Sprachabgleich und fortlaufende Session behalten.
- Profil-/Operator-Beschriftungen einschließlich `OpsOverviewPage` aktualisieren.
- In `defaultLiveSessionEndpoint()` die Auswahl auf
  **`derivedSiteUrl ?? explicitSiteUrl`** umstellen. Bei einer regulären
  `VITE_CONVEX_URL` mit `.convex.cloud` ist deren `.convex.site` maßgeblich. Der
  explizite Wert bleibt für Umgebungen ohne ableitbare Cloud-URL verwendbar;
  andernfalls gilt der relative Live-Endpunkt.
- Regressionstest mit Produktions-Cloud-URL und absichtlich veraltetem
  Sandbox-Site-Wert, Cloud-URL ohne Override, explizites lokales/custom Ziel,
  fehlende Werte und normalisierte abschließende Slashes.

### 4.4 Operator-Readiness ohne unnötigen API-Umbau

`providerReadiness.ts` liest künftig `VOICE_ALLOWED_ORIGINS`; Gründe und sichtbare
Labels nennen GPT-Live. Die bestehenden Antwortschlüssel
`realtimeOriginsConfigured` und `realtimeOriginsValid` bleiben zunächst erhalten.
Sie sind historische Feldnamen, keine Provider-Auswahl. Damit müssen externe
Verträge nicht für diese Umstellung umbenannt werden.

Dennoch gemeinsam prüfen: `convex/integrations/providerReadiness.ts` und Tests,
Returns-Validator in `convex/opsActions.ts`, `ProviderReadinessPanel.tsx` und Test.
Die fünf betroffenen bisherigen Env-/Text-Erwartungen aktualisieren. Sollte doch
umbenannt werden, nur in einem vollständigen gemeinsamen Vertragsschritt.

### 4.5 Tests erhalten und Test-Helfer aus dem Produkt entfernen

- `scoutBriefReadiness.integration.test.ts` von `api.voice.executeTool` auf den
  verbleibenden Scout-/Live-Readiness-Pfad umstellen. Fachliche Aussagen zu Revision,
  fehlenden Angaben und ausbleibender automatischer Aktivierung erhalten.
- `liveProofFixture.ts` **zusammen mit** `liveProofFixture.integration.test.ts`
  entfernen. Dessen String-Referenzen würden sonst erst zur Laufzeit scheitern.
  Benötigte fachliche Fixtures ausschließlich als Test-Helfer weiterführen.
- Den Routenwechseltest in `VoiceSessionProvider.test.tsx` auf den Live-Mock
  umschreiben: genau eine Session, Banner außerhalb Scout, Mute und Auflegen über
  Routenwechsel hinweg. Diese Abdeckung nicht mit dem Realtime-Mock löschen.
- In `scout.listMessages` die `.unique()`-Abfrage auf `by_agent_message_id` durch
  `.first()` mit unveränderter Eigentümerprüfung ersetzen. Der Index erzwingt
  keine Eindeutigkeit. Eine doppelte Zuordnung darf nicht die gesamte Chatliste
  abbrechen. Einen Regressionstest mit zwei Zuordnungen ergänzen; nicht allein
  auf unbestätigte Annahmen über `agentName` im projizierten Agent-Ergebnis setzen.

## 5. Daten und Konfiguration

### 5.1 Additives Schema beibehalten

Die optionalen Felder für Locale, Live-Session-Aufträge und Transkript-Metadaten
bleiben optional. **`voiceSessions.provider` bleibt die optionale Union
`realtime | live`.** Damit bleiben historische und mögliche Sandbox-Zeilen sowie
Checkpoint M lesbar. Neue Sessions werden ausschließlich als Live erzeugt.

Keine Schema-Verengung, kein Backfill, kein Seed/Fixture-Import und kein
Produktions-Reset. Ein erlaubter Fleet-Reset in `devUserReset.ts` ist keine
Anweisung, ihn auszuführen. Auch das Löschen allein der Voice-Tabellen wäre kein
vollständiger Verlauf-Reset, weil Nachrichten zusätzlich im Agent-Thread liegen.

### 5.2 Konfiguration vor dem neuen Backend bereitstellen

| Einstellung | Vorgehen |
|---|---|
| `OPENAI_API_KEY` | Bestehende serverseitige Konfiguration auf Vorhandensein prüfen, Wert nicht ausgeben |
| `OPENAI_LIVE_MODEL` | `gpt-live-1` |
| `OPENAI_LIVE_VOICE` | Bestätigtes `marin` im Ziel beibehalten/setzen; keine Sandbox-Stimmenprüfung |
| `VOICE_ALLOWED_ORIGINS` | Vor Entfernen des Rückgriffs setzen: `https://fleet-jackal-83.eu-west-1.convex.site` |
| `VITE_CONVEX_URL` / `VITE_CONVEX_SITE_URL` | Cloud-URL des Ziels; Site-Override optional, falls gesetzt konsistent; URL-Vorrang aus §4.3 schützt zusätzlich |
| `FIRECRAWL_WEBHOOK_URL` | Ziel und Vorhandensein für die bestehende Integration prüfen |
| `FIRECRAWL_MONITOR_WEBHOOK_BEARER` | Vorhandensein prüfen, niemals Wert protokollieren |
| `MAPBOX_SECRET_TOKEN` | Vorhandensein prüfen; Geocoding in kontrollierter Suchprüfung bestätigen |
| Brain | `openai/gpt-5.6-terra` über bestehenden Convex AI Gateway |

Die aktuelle `allowedOrigin`-Funktion erlaubt zusätzlich hartcodiert
`localhost:5173` und `127.0.0.1:5173` in jeder Umgebung. Der Plan behauptet daher
keine ausschließlich auf Dev begrenzte lokale Freigabe. Diese Regeln werden bei
HTTP-Tests berücksichtigt; die Produktions-Site benötigt trotzdem ihren
expliziten Eintrag, sonst schlägt ihre Anfrage nach Entfernen des alten
Origin-Rückgriffs mit 403 fehl.

`FIRECRAWL_WEBHOOK_URL` und `MAPBOX_SECRET_TOKEN` sind nicht im Convex-Env-Schema
aufgeführt. Der Monitor-Bearer **ist bereits optional deklariert**; auch das
beweist nicht sein Vorhandensein. Ein erfolgreicher Deploy bestätigt keine
vollständige Provider-Konfiguration. Bestehende 15-Minuten-Firecrawl-Crons und
weitere Hintergrundarbeit berücksichtigen; nicht durch einen Sandbox-Env-Import
oder pauschale Aktivierung verändern.

Readiness-Code und `.env.example` mit den Live-Variablen landen im Release.
`OPENAI_REALTIME_*`, `REALTIME_ALLOWED_ORIGINS` und der bisherige Provider-Schalter
werden erst nach erfolgreicher Nutzerabnahme aus dem Deployment entfernt. Der
neue Code liest sie nicht; Checkpoint M kann sie im manuellen Notfall noch benötigen.
Insbesondere bei Wiederherstellung von M bleibt `VOICE_PROVIDER=live` gesetzt.

## 6. Automatisierte Prüfung und Dokumentation vor der Übergabe

Nach dem vollständigen Vertragsschritt und der Bereinigung einmal integriert
Tests, Typecheck, relevantes Lint und Produktionsbuild ausführen. Schwerpunkte:

- Kein aktiver Realtime-Transport/Endpunkt/Schalter; historische Schema- und
  Readiness-Feldnamen sind ausdrücklich zulässige Texttreffer.
- Echte Serververträge der stringbasierten Referenzen, altes optionales Schema,
  neue Live-Zeilen, CORS/Auth und fehlende Konfiguration in lokalen Tests.
- Fakten, Readiness, explizite Aktivierung, konkurrierende Änderungen und doppelte
  Aufträge; Sprachabgleich, Chat-Persistenz, Duplikate und Routenwechsel mit Mocks.
- URL-Ableitung gegen abweichenden Site-Wert; Bundle ohne Sandbox-Endpoint.

**Kein Agent startet hierfür einen Voice-Call.** Ein Mikrofontest ist weder vor
Merge noch während Veröffentlichung vorgesehen. Die menschliche Prüfung steht
separat in §9; technisch erfolgreich ist nicht gleich menschlich demo-abgenommen.

Vor der Nutzerübergabe README, Agent-Anweisungen, `.env.example`, Review Guide,
Discovery-Plan und Implementierungsstatus aktualisieren. Der Review Guide muss
Zieldeployment und Entwicklungsbefehle klar trennen; alte Sandbox-Abbruchregeln
und pauschales `--prod`-Verbot dürfen nicht als aktueller Umzugsablauf stehenbleiben.
Ripple-Nachweise als historischen Stand kennzeichnen; aktuellen Marin- und
Tonprüfstatus widerspruchsfrei beschreiben.

**Hackathon-Format beibehalten:** Laut Skill folgt der Metadaten-Header direkt auf
`# Hackathon log`; kein vorgeschalteter „Latest“-Block. `Components` enthält nur
registrierte `@convex-dev/*`-Komponenten. AgentMail, Firecrawl und lokale
Stagehand-Komponenten mit konkreten Quellverweisen im chronologischen Log sichtbar
machen. Tatsächlichen Release erst nach Ausführung loggen, keine Abnahme erfinden.

## 7. Geplantes Release und technische Nachprüfung

Für die Veröffentlichung ein exklusives Fenster mit dem Nutzer und Claude Code
vereinbaren. Vorschlag: nach abgeschlossener Vorbereitung 30 Minuten für Deploy
und technische Nachprüfung reservieren. Menschliche Sprachtests liegen außerhalb
und werden nicht durch Ablauf eines Timers als bestanden gewertet.

1. Aktive Calls durch den Nutzer beenden lassen. Alte Tabs schließen/neu laden;
   Vite-Server und tatsächlich vorhandene konkurrierende Deploy-Prozesse zuordnen.
2. Haupt-Checkout auf dem finalen Commit, Remote-Sicherung und Checkpoint M prüfen.
   Live-Konfiguration einschließlich Produktions-Origin muss schon bereitstehen.
3. Aus dem Haupt-Checkout veröffentlichen. Vom gemeinsamen Elternordner aus:

   ```sh
   cd roomscout
   VITE_CONVEX_SITE_URL=https://fleet-jackal-83.eu-west-1.convex.site npm run deploy
   ```

   Der installierte CLI-Ablauf ist **Build → Backend → statischer Upload**. Im
   Fenster zwischen Backend und Frontend können alte Tabs keine Voice-Verbindung
   mehr aufbauen. Scheitert der Upload, ist das kein abgeschlossenes Release.
4. Nach Laden des neuen Frontends als Erstes den kontrollierten Portal-Kern ohne
   Voice prüfen: bestehende Provider-Konfiguration, vorbereitetes Listing und
   Vermieter/Simulator in `roomscout-dev/convex/controlledSimulation.ts`, Anfrage,
   Rückantwort, Bewertung und UI-Entscheidungsweg. Genau diese echte Strecke wurde
   durch die isolierten Voice-Fixtures nicht bewiesen und ist das höchste
   Integrationsrisiko. Nur kontrollierte Demo-Empfänger verwenden.
5. Weitere technische Nachprüfung ohne Voice:

   - POST auf `/api/realtime/session` ergibt 404.
   - GET auf `/api/health`, direkte SPA-Aufrufe und OPTIONS auf `/api/live/session`
     für erlaubte/unerlaubte Origins prüfen. Kein POST auf die neue Live-Route,
     kein WebRTC-Verbindungsaufbau und kein Mikrofonzugriff durch Agenten.
   - Ausgelieferte ausführbare App-Assets enthalten weder `kookabura` noch
     `perceptive-antelope` als Endpoint; Netzwerkverkehr geht zum Zieldeployment.
   - Operator-Readiness meldet die Live-Konfiguration als vorhanden; das ist ein
     Konfigurationsnachweis, kein Verbindungs-/Audiotest.
   - Ein bestehender Account kann sich anmelden, Text senden und einen Suchauftrag
     sehen/bedienen. Fehlende Sprachpräferenz ergibt Englisch; ausdrückliches DE bleibt.
   - Neue englische Oberflächen auch ohne Voice kurz prüfen.
6. Den Nutzer für seine Tests übergeben. **Erst nach seinem ersten Call** lesend
   bestätigen, dass eine neue Session `provider: "live"` trägt. Dafür keinen
   zusätzlichen Test-Call durch den Agenten erzeugen.

## 8. Abbruch und Wiederherstellung

### Abbruchregeln

Kein Merge ohne bestätigte Sicherung, kein Release bei fehlgeschlagenen technischen
Checks oder fehlender Produktions-Origin. Bei falschem Zieldeployment, Backend-
oder Uploadfehler, kaputter Anmeldung/Chatliste oder kaputter kontrollierter
Portal-Strecke keine Demo-Freigabe erteilen. Problem und aktuellen Zustand festhalten.

### Uploadfehler

Wenn Backend erfolgreich und nur Upload/Frontend fehlgeschlagen ist: vom selben
finalen Commit den Frontend-Pfad erneut bauen/veröffentlichen, beispielsweise mit
`npm run deploy -- --skip-convex` und derselben ausdrücklich gesetzten Site-URL.
Nicht aus einem anderen Worktree oder mit einem alten Sandbox-`dist` nachladen.

### Manueller Wiederherstellungspunkt M

Wenn die technische Prüfung im reservierten Fenster nicht grün wird, Veröffentlichung
anhalten und den konkreten Fehler samt Wiederherstellungsoption melden. Checkpoint M
ist der bevorzugte manuelle Code-Rückweg: additive Live-Felder werden verstanden,
Backend und Frontend werden gemeinsam auf M veröffentlicht, Live bleibt ausgewählt.
Eine Wiederherstellung ist eine bewusste Release-Entscheidung, kein automatischer
Provider-Fallback. Sie bringt vorübergehend auch den alten Code zurück; die
Live-only-Zielmigration gilt dann als noch nicht abgeschlossen. Alte Env-Werte
bis zur Nutzerabnahme deshalb erhalten.

### Alter Tag

`prod-pre-gpt-live` sichert den vorherigen Code. Nach Live-Schreibvorgängen ist ein
Deploy dieses alten Schemas **kein sofort sicherer Vollrollback**. Betroffen sind
`users.conversationLocale`, sämtliche neuen Provider-/Locale-/Claim-/Result-Felder
in `voiceSessions` und Source-/Revision-/Timing-/Agent-ID-Felder in
`voiceTranscriptEvents`. Nur Sessions zu löschen und Locale zu entfernen reicht
bei verbleibenden erweiterten Transkriptzeilen nicht. Dafür wäre eine eigene
vollständige Daten-/Schema-Wiederherstellung nötig; kein destruktiver Reset als
automatischer Teil dieses Plans. M beziehungsweise eine gezielte Vorwärtskorrektur
sind die vorgesehenen Wege.

Die Demo wird auf der zuletzt tatsächlich grün geprüften Konfiguration gedreht.
Ein technischer Checkpoint allein belegt weder Gesprächsqualität noch den
vollständigen Demo-Ablauf.

## 9. Nutzerprüfung und Demo-Abnahme nach dem Umzug

**Owner: Nutzer. Agenten starten keine Sprachtests.** Die Reihenfolge orientiert
sich am aktuellen Drehbuch im Haupt-Checkout:

| Prüfung | Erwartung |
|---|---|
| Frische Band | Englische Erstbegrüßung, Marin, vorhandener Blob und ein streamender Verlauf |
| Discovery einschließlich 60 Sekunden freier Erzählung | Fakten erscheinen währenddessen; kein Stillstand bis „Hello?“ und kein vorzeitiges Idle-Auflegen |
| Budget-/Termin-Korrektur und Unterbrechung | Neueste Angabe bleibt erhalten, keine veralteten Wiederholungen |
| Ende der Discovery | Proaktiver Startvorschlag ohne erneutes „What next?“; keine automatische Aktivierung |
| Start und echter Portal-Ablauf | Suche aktiv, Call bleibt verbunden; UI-Update und passende gesprochene Rückmeldung |
| Rückfrage und verbindliche Zusage | Sachliche Antwort möglich; verbindliche Zusage per Sprache wird auf UI-Review verwiesen |
| Sprachwechsel und Schreiben | EN/DE wechselt, tatsächlicher Voice-Verlauf bleibt im selben Thread |
| Auflegen, danach weiterreden/Laut | Bestätigter Auftrag endet trotzdem; normale Scout-Ansicht bedienbar |
| Inaktivität | Nachfrage nach zwei Minuten, weitere 30 Sekunden bis Abschied; laufende Nutzeraktivität/Backend-Arbeit blockiert den Timer |
| Wiederholungen | Keine unnötigen erneuten Fragen oder kompletten Recaps |
| Mobil, falls damit aufgenommen wird | Voice-/Fakten-/Angebotsansicht im tatsächlichen Aufnahmegerät nutzbar |

Vor der Aufnahme die im Drehbuch verlangten Voraussetzungen prüfen: kontrollierte
Listings/Vermieter, tatsächliche Zeitfolge, passende Konten und Quellen sowie
**zehn aufeinanderfolgende vollständige Kern-Durchläufe ohne Reparatureingriff**.
Diese Demo-Abnahme ist getrennt von der technischen Migration; automatisierte
Tests ersetzen sie nicht und ihr Voice-Anteil bleibt beim Nutzer. Danach alte
Realtime-Env-Einträge entfernen, Remote-Stand und Logs abschließen.

## 10. Owner, Reihenfolge und Definition of Done

1. **Astra allein:** Sicherung, Commits und Merge. Danach gemeinsamer
   Schnittstellen-Commit für `VoiceSessionProvider` + `getConfig`/`getSessionState`
   samt Typen und Vertragstests. Auch die gesamte Readiness-Kette einschließlich
   `opsActions`, `ProviderReadinessPanel`, `providerReadiness` und serverseitigem
   `ops.ts`-Label hat einen Integrations-Owner.
2. **Erst danach parallel:** Sol A übernimmt verbleibenden Backend-Ausbau,
   Chat-Zuordnung und Backendtests; Sol B übernimmt verbleibende Frontend-Typen,
   Altdateien und UI-Tests. Keine gleichzeitigen Änderungen an gemeinsamen
   Vertragsdateien. Die konkrete Dateizuteilung wird vor dem Start festgehalten.
3. **Astra:** gemeinsame Prüfung, Dokumentation vor Übergabe, Fast-forward,
   Veröffentlichung und Nicht-Voice-Nachprüfung.
4. **Nutzer:** Sprachtest und Demo-Abnahme; erst danach endgültige Konfigurationsbereinigung.

**Technischer Umzug fertig:** Gesicherter finaler Commit im Haupt-Checkout und auf
Produktion, Live-only-Code samt korrektem Ziel, bestandene technische/Nicht-Voice-
Prüfungen, keine Sandbox-Anfragen, aktuelle Anleitung für den Nutzer.

**Demo fertig:** Zusätzlich Nutzer-Sprachabnahme, Drehbuch-Voraussetzungen und
zehn erfolgreiche kontrollierte Kerndurchläufe. Bis dahin keine Behauptung, die
neueste Version sei vollständig menschlich abgenommen.
