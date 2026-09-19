# Testqualität: Was die 1.260 Tests absichern

Stand: 2026-09-16 · Branch `autopilot-policy` · geprüfter Commit `0180bc117590be7289fb01bcf630ef767c5d3c83`

## Umgesetzte Bereinigung am 2026-09-16

Nach Freigabe des Reviews wurden die klaren Altlasten im Working Tree bereinigt:

- Leeren Firecrawl-Test entfernt und seine weiterhin benötigten Helfer nach `setup.testSupport.ts` verschoben.
- Zwei nicht eingebundene Scout-Komponenten samt Styles und fünf Tests entfernt.
- Historische Wörterbuch-Migrationsprüfungen, doppelte Landingpage-Prüfungen, einen redundanten Mailbox-Vergleich und die willkürliche Provideranzahl entfernt.
- Die Legacy-Profiltests verwenden jetzt die echte `/app/profile`-Route; aktive Settings- und Freigabeprüfungen bleiben erhalten.
- Prompt-Konstruktionsprüfungen auf wesentliche Sprach-, Phasen-, Start-, Auflege- und Belegregeln reduziert. Reine CSS-/Pixelprüfungen durch vorhandene beziehungsweise fokussierte Caption-, Steuerungs- und Navigationsprüfungen ersetzt. Die produktiven Prompts wurden nicht verändert.
- Öffentliche Browser-Tests auf die aktuelle Oberfläche umgestellt. Sie verwenden feste Antworten an der externen Convex-Verbindung und testen echte Navigation, Ortswechsel/Leerzustand, Supply-Filter, Sortierung und Quellenanzeige. Der Build liegt getrennt unter `node_modules/.cache`; HTTP zu externen Zielen wird blockiert, WebSockets werden vollständig simuliert, unbekannte Queries und Schreibversuche schlagen fehl.

Die vollständige Vitest-Suite besteht mit **1.240 Fällen in 152 Dateien**, zusätzlich ein bewusst deaktivierter Provider-Proof. Gegenüber dem Inventar sind es 20 Fälle weniger; ein großer Teil der Bereinigung entfernt einzelne Assertions statt ganze Tests.

Zusätzlich bestanden fünf Playwright-Durchläufe auf Desktop/Mobil; der reine Mobilmenü-Fall wird auf Desktop übersprungen. Projekt-TypeScript, separate Browser-Test-Typprüfung und Build sind erfolgreich. Lint meldet null Fehler und 29 bereits vorhandene Warnungen. Der alte Landingpage-Test scheiterte vor seiner Korrektur nachweislich an der veralteten Überschrift. Kein Deployment und keine echte Voice- oder Provider-Aktion erfolgten.

Die weiter unten beschriebenen zusätzlichen Voice-Kompositions-, Auth-/Ownership- und ausführbaren Provider-Programmtests bleiben Empfehlungen. Bestehende Quelltext-Prüfungen zur AgentMail-Konfiguration und Firecrawl-Belegen wurden nicht ersatzlos gelöscht.

**Die folgenden Fundstellen und das Inventar dokumentieren den Zustand vor der Bereinigung.** Entfernte Dateien und damalige Zeilennummern beziehen sich auf den oben genannten Commit.

## Urteil

Die Anzahl ist für die gesamte Anwendung plausibel. Ich würde den Großteil behalten. Viele Fälle schützen vor doppelten Nachrichten, unberechtigten Zugriffen, veralteten Entscheidungen und verbindlichen Zusagen ohne Freigabe. Die wichtigsten Schwächen sind veraltete Oberflächen-Tests, Prüfungen von Implementierungsdetails und fehlende Tests über mehrere verbundene Anwendungsschichten.

**Das Ziel sollte mehr Aussagekraft pro Test sein, nicht eine bestimmte kleinere Testzahl.** Ein großer Testbestand kann gleichzeitig sinnvolle Einzelprüfungen enthalten und den tatsächlichen Demo-Ablauf unzureichend abdecken.

## Methode und Grenzen

- Maßstab: Matt Pococks [TDD-Skill](https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd), einschließlich `tests.md` und `mocking.md`.
- Vollständiges Inventar der von Vitest registrierten Fälle; Testnamen und Dateien gesichtet, repräsentative und auffällige Bereiche im Detail gelesen. Backend, Frontend und Voice wurden parallel mit Sol geprüft. Dies ist keine Einzelzertifizierung sämtlicher Assertions.
- `vitest list --exclude '**/*.eval.?(m)ts' --json …` hat **1.260 Fälle in 155 Dateien** aufgelistet. Das sammelt Tests; es führt sie nicht aus. Im Dateibaum vorhandene, deaktivierte Tests können von dieser Zählung abweichen.
- Für dieses Review wurde die Testsuite nicht erneut ausgeführt. Keine Mikrofontests, Provider-Aktionen, Deployments oder Änderungen an Anwendung und Tests.
- Keine Coverage- oder Mutation-Messung: Aus dieser Prüfung lässt sich keine seriöse Prozentzahl „überflüssiger Tests“ ableiten. Auch ein historischer Red–Green-TDD-Ablauf lässt sich aus fertigen Tests nicht nachweisen.

## Was wird gezählt?

| Bereich | Fälle | Dateien | Was darunter fällt |
| --- | ---: | ---: | --- |
| Backend-Dateien mit `.integration.` im Namen | 373 | 47 | Convex-Funktionen, Datenbankzustände, Ownership, Freigaben, Queues und Persistenz |
| Weitere Backend-Tests | 490 | 55 | Fachregeln, Matching, Parser, Provider-Adapter, Prompts und Konfiguration |
| Frontend | 391 | 52 | Benutzerinteraktionen, Zustandswechsel, Voice-Laufzeit, Übersetzungen und Darstellung |
| Eval-Werkzeuge | 6 | 1 | Szenarioaufbereitung und Trennung von Agentenwissen und Bewertungswissen |
| **Gesamt** | **1.260** | **155** | |

Die Namen sind eine Inventaraufteilung, keine Qualitätsbewertung. Ein Dateiname mit „integration“ garantiert keinen vollständigen Durchlauf durch Browser und Anbieter. Parameterisierte Tests zählen jede Eingabevariante einzeln: 53 Autonomie-Regeltests sind beispielsweise nicht 53 unterschiedliche Benutzerreisen.

`npm test` umfasst nicht die separat ausgeführten Playwright-Tests oder Modell-Evals. Unter `tests/e2e` gibt es drei öffentliche Browser-Szenarien; keines bildet den angemeldeten Scout-Ablauf vollständig ab. `eval:autopilot` ist eine eigene Prüfung. Der Foundation-Eval ist ausdrücklich ein Test der Eval-Infrastruktur, kein Beleg für Agentenqualität.

## Pococks Maßstab, auf RoomScout angewendet

Ein guter Test prüft eine beobachtbare Zusage: „Eine bereits abgesendete Anfrage wird bei einem Retry nicht erneut verschickt.“ Er sollte auch dann bestehen bleiben, wenn interne Hilfsfunktionen oder Dateien anders organisiert werden.

Ein schwacher Test prüft stattdessen: „Diese Datei enthält genau diesen Quelltext“ oder „Dieses Element trägt genau diese Tailwind-Klassen“. Er kann bei einem harmlosen Umbau scheitern und einen tatsächlichen Produktfehler trotzdem übersehen.

Dabei gelten sinnvolle Ausnahmen:

- Exportierte Fachregeln sind geeignete Testgrenzen. Kleine Unit-Tests sind nicht automatisch Ballast.
- `convex-test` mit echter Handler-Ausführung und einer Testdatenbank ist sinnvoll. Datenbank-Fixtures machen einen Test nicht schlecht.
- RTC, Mikrofon, Zeit und externe Anbieter zu simulieren ist angemessen. Problematisch wird es, wenn alle eigenen Verbindungsschichten ebenfalls simuliert werden und deren Zusammenspiel ungeprüft bleibt.
- Ein exakter externer Aufrufzähler kann wichtig sein: „genau eine Nachricht verschickt“ ist Produktverhalten. Die Aufrufreihenfolge privater Hilfsmethoden ist meist Implementierungsdetail.

## Behalten: besonders wertvolle Absicherung

| Bereich und Beispiele | Welche Fehler diese Tests verhindern |
| --- | --- |
| [Offer Acceptance](../../convex/offerAcceptance.integration.test.ts), [Freigabedialog](../../src/components/opportunities/OfferAcceptanceDialog.test.tsx) | Verbindliche Zusage ohne konkrete Freigabe, doppelte Annahme, falsche Erfolgsmeldung ohne Versandbeleg, Weiterverwendung geänderter Konditionen |
| [Autonomy Gate](../../convex/autonomyGate.integration.test.ts), [Regelmatrix](../../convex/lib/autonomyGate.test.ts) | Ausführung trotz geändertem Modus, fehlender Berechtigung oder unzulässiger Inhalte; erneute Prüfung vor tatsächlicher Ausführung |
| [External Actions](../../convex/externalActions.integration.test.ts) | Wiederholter Versand nach einem unklaren Anbieter-Ergebnis; Verwechslung von „vor Versand fehlgeschlagen“ und „eventuell bereits versendet“ |
| [Portal Inbox Sync](../../convex/portalInboxSync.integration.test.ts), [Provider Isolation](../../convex/firecrawlProviderIsolation.integration.test.ts) | Doppelte Benachrichtigungen, alte Worker-Ergebnisse, konkurrierendes Lesen/Schreiben und unsichere Fortsetzung nach Providerwechsel |
| [Voice-Backend](../../convex/voiceLive.integration.test.ts) | Fremde Sessions, doppelte Delegationsverarbeitung, veraltete Ergebnisse, verlorene Transkript-Updates, unerlaubte verbindliche Zusagen und nicht idempotentes Auflegen |
| [Voice Runtime](../../src/features/voice/gptLiveRuntime.test.ts), [Voice Hook](../../src/hooks/useGptLiveVoiceScout.test.tsx) | Fehler beim Zusammensetzen kurzer und langer Sprachfragmente, Reihenfolge, Warteschlangen, Timer und verspätete Antworten |
| [Voice Session Provider](../../src/components/voice/VoiceSessionProvider.test.tsx) | Gespräch geht beim Routenwechsel verloren; falsche Sprachumschaltung oder verlorene Gesprächssteuerung |
| [ScoutChat](../../src/ui/chat/ScoutChat.test.tsx), [DecisionCard](../../src/components/scout/DecisionCard.test.tsx) | Doppelte Eingaben, verlorener Entwurf nach Fehlern und Entscheidungen trotz ausstehender Verarbeitung |
| [Übersetzungen](../../src/ui/copy/copy.test.ts), [Formatierung](../../src/ui/copy/format.test.ts) | Fehlende EN/DE-Schlüssel, leere Texte, falsche Platzhalter, falsche Datums- und Zeitdarstellung |

Die 53 Fälle in `autonomyGate.test.ts` oder 33 Fälle in `offerAcceptance.integration.test.ts` würde ich daher nicht allein wegen ihrer Anzahl kürzen.

## Entfernen oder konsolidieren: konkrete Kandidaten

### 1. Klarer Nullnutzen: ein leerer Test

`convex/components/firecrawlRoomScout/setup.test.ts:53` enthält `test("setup", () => {})`. Dieser Fall prüft nichts. Die Datei enthält gleichzeitig benötigte Hilfsfunktionen: diese in ein Support-Modul verschieben und nur den leeren Test entfernen.

### 2. Tests für zwei nicht mehr eingebundene Komponenten

`src/components/scout/ScoutConversation.test.tsx` und `ScoutFactList.test.tsx` enthalten zusammen fünf Fälle. Die Komponenten haben aktuell keine Nicht-Test-Importeure. Die aktiven Oberflächen verwenden `ScoutChat` beziehungsweise `ArrivingFactList`.

Empfehlung: Nach einem letzten Importer-Check die alten Komponenten samt zugehörigen Styles und Tests gemeinsam entfernen. Das ist eine konkrete Altlast; andere `/design`-Oberflächen sind dagegen weiterhin geroutet und nicht pauschal unbenutzt.

### 3. Anzahl und historische Struktur des Wörterbuchs

`src/ui/copy/copy.test.ts:144` verlangt mindestens 860 Texte. Das beweist weder Vollständigkeit noch Korrektheit. Die Fälle ab Zeile 185 dokumentieren außerdem historische Umzugsschritte und eine exakte Liste von Plural-Schlüsseln.

Empfehlung: Mindestanzahl entfernen; abgeschlossene Strukturmigrationen aus dem dauerhaften Regressionstest herausnehmen oder konsolidieren. EN/DE-Parität, Interpolationsvariablen, nicht leere Texte und Sprachpersistenz behalten.

### 4. Exakte Prompt-Prosa

`convex/prompts/roomScoutLive.test.ts` und `convex/scoutCaseCards.test.ts` prüfen häufig lange Textbestandteile. Das sichert die Prompt-Erzeugung ab, beweist aber weder Empathie noch Gesprächsfluss oder Befolgung der Anweisungen.

Empfehlung: Wenige wichtige Varianten behalten: neue/fortgesetzte Session, Phase, Sprache und Sicherheitsgrenzen. Nicht jede gewünschte Formulierung als unveränderlichen Vertrag behandeln. Für tatsächliches Modellverhalten braucht es gesonderte Gesprächs-Evals beziehungsweise die vereinbarten manuellen Voice-Tests.

### 5. CSS-Klassen als vermeintlicher UX-Beweis

Beispiele: `src/ui/chat/LiveVoiceChat.test.tsx:153`, `:180`; `src/ui/scout/live/LiveScoutSurface.test.tsx:87`; `src/routes/musician/LiveSettingsPage.test.tsx` für dekorative Hintergründe.

`max-h-[…]`, `overflow-y-auto`, Blob-Größe oder `line-clamp-1` zu prüfen beweist nicht, dass ein Benutzer auf einem realen Bildschirm die Steuerelemente erreichen kann. jsdom berechnet dafür kein echtes Browserlayout.

Empfehlung: Caption-Inhalte, Auflegen, Mute und Wechsel zum Text weiter testen. Reine Style-Assertions reduzieren; relevante Scroll- und Sichtbarkeitsregressionen durch wenige Browserprüfungen absichern. Auch die zuletzt ergänzten Voice-Tests enthalten solche schwachen Style-Assertions.

### 6. Eigene Quelldateien nach Text durchsuchen

`convex/integrations/agentmailComponentEnv.test.ts` liest Konfiguration und Patchdatei als Text. Teile von `firecrawlParity.test.ts:283` und `:298` prüfen Importnamen beziehungsweise Wörter in generierten Browserprogrammen.

Die Absicht ist sinnvoll: korrekte Konfiguration, Providertrennung und Versandbelege. Die Technik ist fragil. Text kann vorhanden sein, ohne dass der betreffende Pfad funktioniert.

Empfehlung: Tatsächlichen Konfigurationsvertrag beziehungsweise das generierte Programm gegen eine kleine Seiten-Fixture prüfen; reine Importgrenzen gegebenenfalls als Architektur-/Lint-Regel führen. Nicht die Belegprüfung ersatzlos streichen. Transportbudget- und Einmalversand-Tests behalten; nur nachweislich gleiche Garantien verschiedener Adaptertests zusammenlegen.

### 7. Doppelte oder falsch verdrahtete Oberflächentests

- Die beiden Landingpage-Suiten wiederholen teilweise dieselben Überschriften. Route-Test auf Navigation beschränken; Interaktionsverhalten in der echten Oberfläche prüfen.
- `src/routes/musician/ProfilePage.test.tsx:126` setzt die alte Profilkomponente unter `/app/settings/:section?` ein. Die echte Route verwendet inzwischen `LiveSettingsPage`. Ein Test dieses künstlichen Routings beweist nicht die echte Settings-Navigation. Ein kleiner Test für das weiterhin existierende `/app/profile` ist dagegen sinnvoll.
- Kleine redundante Assertions wie der erneute Vergleich derselben Mailbox-Namensberechnung liefern wenig Zusatznutzen neben dem bereits vorhandenen konkreten Erwartungswert. Nicht die nützlichen Normalisierungsfälle mit entfernen.

## Größere Lücken als die Testanzahl

### A. Veralteter öffentlicher Browser-Test

`tests/e2e/public-flow.spec.ts:3` erwartet noch „Stop searching“, „City or region“ und „Search rehearsal rooms“ auf der Landingpage. Diese Elemente passen nicht mehr zur aktuellen Oberfläche. Das ist ein statischer Befund; der Browser-Test wurde in diesem Audit nicht ausgeführt.

Der zweite Fall prüft Angebotsdetails nur, falls Daten vorhanden sind. Bei einer leeren Liste kann er bestehen, ohne die Detailseite je zu öffnen. Datenzustände gezielt vorgeben und Leerzustand sowie vorhandenes Angebot getrennt prüfen.

### B. Verbindung zwischen Voice, Backend und Oberfläche

Die Hook-Tests simulieren unter anderem die eigene Backend-Delegation; die Seiten-Tests simulieren Voice-Kontext und Voice-Komponente. Beide Seiten können grün sein, obwohl ihre realen Übergaben nicht zusammenpassen.

Priorität: Ein Test mit dem tatsächlichen Delegationsformat durch den echten Backend-Validator/Adapter und ein zusammenhängender Ablauf mit echter UI-Zusammensetzung:

1. Eine simulierte Provider-Äußerung liefert Fakten.
2. Diese werden tatsächlich gespeichert und erscheinen in der Sidebar.
3. Eine Korrektur ersetzt den bisherigen Wert.
4. Nach Voice-Ende zeigt der Textchat denselben Verlauf.
5. Eine bestätigte Startaktion verändert den Suchstatus; Auflegen beendet die lokale Session.

Das kann deterministisch mit einer simulierten externen Sprachschnittstelle geschehen. Es beweist weiterhin nicht, dass GPT-Live beim echten Gespräch passend delegiert oder natürlich weiterspricht.

### C. Authentifizierung und exponierte Backend-Grenzen

Die Auth-Seitentests prüfen vorwiegend Texte. Wichtiger wären Passwort-Abgleich, einmalige Formularübermittlung, Fehlerbehandlung und sichere Rücknavigation. Bestehende Tests der `returnTo`-Hilfsfunktion behalten.

Weitere gezielt zu prüfende Grenzen: öffentliche Outreach-Aktionen, Operator-Policy-/Adapter-Aktionen und öffentliche Memory-Änderungen. Für mehrere dieser Einstiegspunkte fehlen direkte Negativtests für fremde Nutzer oder fehlende Berechtigungen; Fixtures ihrer Datenbankzeilen ersetzen diese Prüfung nicht.

### D. Externe Kompatibilität und Modellverhalten

- Die schnellen Tests bestätigen nicht die aktuelle Anbieter-API, echtes Audio, Unterbrechungen oder die tatsächliche Latenz.
- Ein Prompt-Substring-Test bestätigt keine höfliche Begrüßung, proaktive nächste Frage oder erfolgreiche Reaktion auf „please hang up“.
- Webhook-Signaturtests sollten mindestens einen unabhängig vorgegebenen HMAC-Erwartungswert enthalten. Signieren und Verifizieren mit derselben Implementierung kann denselben Fehler auf beiden Seiten übersehen.

Diese Ebenen ausdrücklich unterscheiden, statt weitere Mock-Tests als Beweis für die gesamte Demo zu zählen. Echte Voice-Abnahme bleibt beim Nutzer.

## Empfohlene Reihenfolge

1. Den veralteten öffentlichen Browser-Test aktualisieren und die Voice→Backend→Sidebar-/Verlauf-Verbindung absichern.
2. Den leeren Test und die zwei ungenutzten Komponenten samt Tests entfernen; falsches Settings-Test-Routing korrigieren.
3. Prompt-Prosa, historische Wörterbuchprüfungen und reine CSS-Assertions konsolidieren. Die abgedeckten Produktregressionen behalten.
4. Fehlende Auth-/Ownership-Grenzen gezielt ergänzen und Provider-Programmtests dort ausführbar machen, wo bisher nur Quelltext geprüft wird.
5. Neue Tests an konkreten Fehlerbildern und beobachtbarem Verhalten ausrichten. Kein pauschales Ziel wie „auf 500 Tests reduzieren“.

Dies sind Empfehlungen, keine bereits vorgenommenen Änderungen. Eine kleine Bereinigung kann die Anzahl senken; wichtige zusätzliche Verbindungstests können sie anschließend wieder erhöhen. Entscheidend ist, ob ein grüner Lauf belastbarere Aussagen über RoomScout erlaubt.

## Vollständiges registriertes Inventar

Die folgende Liste dokumentiert die Zählung, nicht eine individuelle Freigabe jeder Assertion. Pfade sind relativ zur Projektwurzel.

| Datei | Registrierte Fälle |
| --- | ---: |
| `convex/agentmailComponent.integration.test.ts` | 3 |
| `convex/aiModelOverride.integration.test.ts` | 3 |
| `convex/autonomy.integration.test.ts` | 5 |
| `convex/autonomyGate.integration.test.ts` | 13 |
| `convex/browserbasePortal.integration.test.ts` | 23 |
| `convex/browserbaseSessionProof.test.ts` | 3 |
| `convex/components/firecrawlRoomScout/contracts.test.ts` | 5 |
| `convex/components/firecrawlRoomScout/crawl.test.ts` | 29 |
| `convex/components/firecrawlRoomScout/extensions.test.ts` | 14 |
| `convex/components/firecrawlRoomScout/interact.test.ts` | 7 |
| `convex/components/firecrawlRoomScout/lib.test.ts` | 12 |
| `convex/components/firecrawlRoomScout/setup.test.ts` | 1 |
| `convex/components/firecrawlRoomScout/signature.test.ts` | 4 |
| `convex/components/stagehandRoomScout/lib.test.ts` | 3 |
| `convex/controlledPersonalInboxProof.integration.test.ts` | 8 |
| `convex/controlledPortal.integration.test.ts` | 5 |
| `convex/controlledSourceProof.integration.test.ts` | 2 |
| `convex/conversations.integration.test.ts` | 8 |
| `convex/decisions.integration.test.ts` | 20 |
| `convex/demoProvenance.integration.test.ts` | 5 |
| `convex/demoSourceBootstrap.integration.test.ts` | 1 |
| `convex/demoSourceChecks.integration.test.ts` | 5 |
| `convex/detailBacklog.integration.test.ts` | 2 |
| `convex/devUserReset.test.ts` | 7 |
| `convex/evaluation/scenarios.test.ts` | 5 |
| `convex/evaluationGateway.integration.test.ts` | 3 |
| `convex/externalActions.integration.test.ts` | 10 |
| `convex/firecrawlFailure.integration.test.ts` | 2 |
| `convex/firecrawlInteract.portalGuard.test.ts` | 3 |
| `convex/firecrawlPortal.test.ts` | 14 |
| `convex/firecrawlProviderIsolation.integration.test.ts` | 21 |
| `convex/inbox.integration.test.ts` | 2 |
| `convex/integrations/agentmailComponentEnv.test.ts` | 2 |
| `convex/integrations/agentmailPayload.test.ts` | 12 |
| `convex/integrations/agentmailWebhookBootstrap.test.ts` | 10 |
| `convex/integrations/controlledPortalPolicy.test.ts` | 4 |
| `convex/integrations/firecrawlInteractClient.test.ts` | 12 |
| `convex/integrations/firecrawlParity.test.ts` | 8 |
| `convex/integrations/firecrawlPortalEngine.test.ts` | 26 |
| `convex/integrations/firecrawlPortalRuntime.test.ts` | 12 |
| `convex/integrations/firecrawlProgram.test.ts` | 14 |
| `convex/integrations/ingestionHelpers.test.ts` | 8 |
| `convex/integrations/portalBrowserEngine.test.ts` | 6 |
| `convex/integrations/portalDomEvidence.test.ts` | 9 |
| `convex/integrations/portalSafety.test.ts` | 8 |
| `convex/integrations/portalVerification.test.ts` | 4 |
| `convex/integrations/portalWriteAdapters.test.ts` | 17 |
| `convex/integrations/providerReadiness.test.ts` | 6 |
| `convex/integrations/secureCompare.test.ts` | 1 |
| `convex/integrations/sourceProbeAdapters.test.ts` | 3 |
| `convex/integrations/stagehandPortalDriver.test.ts` | 29 |
| `convex/integrations/stagehandV4Runtime.test.ts` | 9 |
| `convex/integrations/urlCanonicalization.test.ts` | 2 |
| `convex/lib/actionPayload.test.ts` | 3 |
| `convex/lib/autonomy.test.ts` | 18 |
| `convex/lib/autonomyGate.test.ts` | 53 |
| `convex/lib/corroboration.test.ts` | 4 |
| `convex/lib/liveDiscoveryContext.test.ts` | 2 |
| `convex/lib/matchAssessment.test.ts` | 10 |
| `convex/lib/privacy.test.ts` | 3 |
| `convex/lib/providerAssessment.test.ts` | 12 |
| `convex/lib/sourceCandidate.test.ts` | 2 |
| `convex/lib/sourceDiscoveryQueries.test.ts` | 2 |
| `convex/lib/voiceEndIntent.test.ts` | 16 |
| `convex/mailboxControlledBootstrap.integration.test.ts` | 2 |
| `convex/mailboxProvisioning.test.ts` | 2 |
| `convex/matchAssessmentProof.test.ts` | 6 |
| `convex/matchAssessments.integration.test.ts` | 7 |
| `convex/matches.integration.test.ts` | 18 |
| `convex/matchingCore.test.ts` | 7 |
| `convex/memory.integration.test.ts` | 2 |
| `convex/messageSafety.integration.test.ts` | 17 |
| `convex/migrations.integration.test.ts` | 3 |
| `convex/offerAcceptance.integration.test.ts` | 33 |
| `convex/opsActions.integration.test.ts` | 1 |
| `convex/platformInbox.integration.test.ts` | 5 |
| `convex/portalBrowserCleanup.test.ts` | 5 |
| `convex/portalBrowserMaintenance.integration.test.ts` | 5 |
| `convex/portalBrowserState.integration.test.ts` | 12 |
| `convex/portalInboxSync.integration.test.ts` | 11 |
| `convex/portalNotifications.integration.test.ts` | 18 |
| `convex/portalPolling.integration.test.ts` | 7 |
| `convex/prompts/roomScoutLive.test.ts` | 13 |
| `convex/providerConversations.integration.test.ts` | 6 |
| `convex/providerMailReply.integration.test.ts` | 9 |
| `convex/resetMarketIndex.test.ts` | 1 |
| `convex/resetWorkerGuards.test.ts` | 2 |
| `convex/scopedActivityLists.integration.test.ts` | 1 |
| `convex/scoutAutopilot.integration.test.ts` | 2 |
| `convex/scoutBriefReadiness.integration.test.ts` | 4 |
| `convex/scoutCaseCards.test.ts` | 6 |
| `convex/scoutChat.integration.test.ts` | 5 |
| `convex/scoutOrchestrator.integration.test.ts` | 24 |
| `convex/scoutProviderContext.integration.test.ts` | 5 |
| `convex/scoutSearchDraftTool.test.ts` | 11 |
| `convex/searchSources.integration.test.ts` | 2 |
| `convex/settings.integration.test.ts` | 1 |
| `convex/signupBootstrap.integration.test.ts` | 1 |
| `convex/sourceProbes.integration.test.ts` | 4 |
| `convex/stagehandFormSmoke.test.ts` | 3 |
| `convex/stagehandPortal.integration.test.ts` | 4 |
| `convex/voiceLive.integration.test.ts` | 23 |
| `src/app/RouteErrorBoundary.test.tsx` | 3 |
| `src/app/returnTo.test.ts` | 5 |
| `src/app/router.test.tsx` | 7 |
| `src/components/browser/BrowserRunWorkspace.test.tsx` | 2 |
| `src/components/connections/PortalAuthenticationGuide.test.tsx` | 2 |
| `src/components/connections/PortalConnectionsWorkspace.test.tsx` | 4 |
| `src/components/connections/portalRegistrationError.test.ts` | 6 |
| `src/components/navigation/LiveProfileMenu.test.tsx` | 3 |
| `src/components/opportunities/LiveProviderOffer.test.tsx` | 10 |
| `src/components/opportunities/OfferAcceptanceDialog.test.tsx` | 10 |
| `src/components/ops/OpsPageHeader.test.tsx` | 1 |
| `src/components/ops/ProviderReadinessPanel.test.tsx` | 1 |
| `src/components/scout/DecisionCard.test.tsx` | 14 |
| `src/components/scout/DemoSourceCheckControls.test.tsx` | 4 |
| `src/components/scout/ScoutConversation.test.tsx` | 3 |
| `src/components/scout/ScoutFactList.test.tsx` | 2 |
| `src/components/settings/SettingsFrame.test.tsx` | 1 |
| `src/components/signals/SignalBadge.test.tsx` | 3 |
| `src/components/voice/VoiceSessionProvider.test.tsx` | 4 |
| `src/data/convexAdapters.test.ts` | 2 |
| `src/features/auth/errors.test.ts` | 13 |
| `src/features/scout/viewModel.test.ts` | 8 |
| `src/features/voice/gptLiveRuntime.test.ts` | 17 |
| `src/hooks/useGptLiveVoiceScout.test.tsx` | 36 |
| `src/routes/musician/BrowserRunPage.test.tsx` | 2 |
| `src/routes/musician/LiveAccountSections.test.tsx` | 4 |
| `src/routes/musician/LiveInboxPage.test.tsx` | 10 |
| `src/routes/musician/LiveKnowledgeSection.test.tsx` | 6 |
| `src/routes/musician/LiveSettingsPage.test.tsx` | 14 |
| `src/routes/musician/LiveSourcesSection.test.tsx` | 2 |
| `src/routes/musician/ProfilePage.test.tsx` | 7 |
| `src/routes/musician/ScoutPage.test.tsx` | 36 |
| `src/routes/operator/LiveOperatorPage.test.tsx` | 17 |
| `src/routes/public/AuthPage.test.tsx` | 2 |
| `src/routes/public/LandingPage.test.tsx` | 3 |
| `src/ui/chat/ChatComposer.test.tsx` | 3 |
| `src/ui/chat/ChatTurn.test.tsx` | 5 |
| `src/ui/chat/LiveVoiceChat.test.tsx` | 10 |
| `src/ui/chat/ScoutChat.test.tsx` | 12 |
| `src/ui/chrome/PanelDialog.test.tsx` | 4 |
| `src/ui/copy/copy.test.ts` | 28 |
| `src/ui/copy/format.test.ts` | 5 |
| `src/ui/inbox/ConversationThread.test.tsx` | 10 |
| `src/ui/landing/LandingPage.test.tsx` | 1 |
| `src/ui/operator/live/LiveOperatorSurface.test.tsx` | 10 |
| `src/ui/operator/operator.smoke.test.tsx` | 3 |
| `src/ui/scout/live/ArrivingFactList.test.tsx` | 6 |
| `src/ui/scout/live/LiveScoutSurface.test.tsx` | 6 |
| `src/ui/scout/live/types.test.ts` | 6 |
| `src/ui/scout/scout.smoke.test.tsx` | 9 |
| `src/ui/settings/SourceRow.test.tsx` | 2 |
| `src/ui/settings/pages/AutonomyPage.test.tsx` | 7 |
| `tools/evals/scenarioModels.test.ts` | 6 |
