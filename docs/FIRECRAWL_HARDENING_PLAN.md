# Firecrawl-Orchestrierung härten und vereinfachen

Revision 1 · 2026-09-15 · Plan, kein Code. Grundlage: drei parallele Analysen
(lokale Skripte, Convex-Firecrawl-Pfad, Nahtstellen zu Browserbase/Stagehand)
und der Prod-Abend vom 2026-09-14 (WRITE_FAILED, EVIDENCE_INVALID, 404 beim
ersten Aufruf, 409 belegtes Profil, 429).

Leitsatz: Der lokale Beweis `scripts/firecrawl-local-message.mjs` ist die
Spezifikation. Der Convex-Pfad muss dieselbe Aufrufstruktur haben, nicht
dieselbe Abstraktion wie Browserbase.

## 0. Zahlen

| Vorgang | lokal (bewiesen) | Convex heute | Ziel |
|---|---|---|---|
| Nachricht in bestehenden Thread | 7 Roundtrips (1 scrape · 5 interact · 1 stop) | 16 best, 46 worst, plus 4–23 für den Profil-Beweis | 4 (scrape · vorbereiten · senden · stop) |
| Erste Nachricht auf eine Anzeige | 7 | 19 best, 47 worst | 4 |
| Inbox-Sync bis 10 Threads | 4 | 3 (schon programm-nativ) | 3 |
| Registrierung inkl. OTP | 4 plus AgentMail-Polls | ~33 best, weit über 100 worst | ~6 |

Dazu heute: 700 ms Pacing zwischen jedem Aufruf (9 bis 32 s reine Wartezeit
pro Nachricht), ein 120-Sekunden-Budget für alle Schritte zusammen, und ein
Team-Limit von 100 Interact-Aufrufen pro Minute (Hobby). Eine Nachricht parallel
zum Inbox-Poll reicht, um das Limit zu reißen.

## 1. Befund: sechs Ursachen

1. **Primitive statt Programme.** Der Stagehand-Treiber wurde 1:1 übernommen;
   jedes Primitiv (navigieren, Formular inspizieren, füllen, erneut
   inspizieren, Evidenz lesen, klicken) ist ein eigener HTTP-Aufruf
   (`convex/integrations/firecrawlPortalRuntime.ts:196-215`). Der Treiber war
   für eine offene Websocket-Session gebaut, wo ein Primitiv nichts kostet.
2. **Poll-Schleifen auf der Client-Seite.** Quittung bis 31 Aufrufe im
   Sekundentakt (`stagehandPortalDriver.ts:1084-1089`), Captcha 16 Aufrufe,
   Feld-Warten bis 20, Home-Bestätigung bis 20. Lokal wartet all das in der
   Sandbox mit `waitForSelector` und kostet null Roundtrips.
3. **Fehler werden dreimal plattgedrückt.** Die Komponente wirft Pfad und
   Anbieter-Meldung weg (`components/firecrawlRoomScout/api.ts:38-51`); ein
   Fehler im Sandbox-Programm wird zu `FIRECRAWL_INTERACT_EXECUTION_FAILED`
   ohne Text (`firecrawlProgram.ts:39-41`); der innere Code aus
   `FIRECRAWL_PORTAL_WRITE_FAILED:<code>` landet als nacktes `WRITE_FAILED`
   im Execution-Record (`firecrawlPortal.ts:845`); die Registrierung macht aus
   allem `CONTROLLED_REGISTRATION_<schritt>_FAILED`.
4. **Ergebnis-Dekodierung an der falschen Stelle.** Die Komponente bevorzugt
   Firecrawls eigenes `result`-Feld und streicht `output`/`stdout`
   (`components/firecrawlRoomScout/interact.ts:26-39`). Der Marker-zuerst-Fix
   vom Abend (0abe076) sitzt eine Schicht darüber und sieht die Markierung
   deshalb in Produktion nie. **Das ist die Quelle von EVIDENCE_INVALID und
   der wichtigste Einzelfehler; der Fix vom Abend ist dort wirkungslos.**
5. **Selbstgemachte 409.** Das Schreiben öffnet das Profil mit
   `saveChanges:true`, direkt danach öffnet der Profil-Beweis eine zweite
   Session auf demselben Profil (`firecrawlPortal.ts:766` →
   `proveFirecrawlProfile:281`). Hat der Stop noch nicht durchgeschlagen, gibt
   es 409, der Beweis schluckt das in `CONTEXT_PROFILE_NOT_READY`, und die
   Verbindung steht auf `reauth_required`, obwohl die Nachricht zugestellt ist.
6. **Ein Budget für alles.** Jedes Programm bekommt das gesamte Restbudget als
   Timeout (`firecrawlPortalRuntime.ts:197-205`); hängt eines, reißt es alle
   folgenden mit, und `DEADLINE_EXCEEDED` ist nicht wiederholbar.

Dazu ein Wahrnehmungsfehler: jede Verifikationsabweichung (Feld noch nicht
editierbar, Rücklesen abweichend, Sende-Knopf noch nicht valide) wird als
`human_required` mit Grund `policy_human_presence` gemeldet
(`stagehandPortalDriver.ts:1044-1075`). Ein Timing-Problem erscheint dem
Nutzer als Regel-Stopp.

## 2. Was der lokale Pfad richtig macht

- **Eine Session pro Geschäftsvorgang.** Ein Scrape mit `maxAge:0` und
  `storeInCache:false` liefert eine `scrapeId`, alle Schritte nutzen sie, genau
  ein DELETE schließt und speichert das Profil.
- **Grobe Programme.** Ein Interact-Aufruf pro Phase: öffnen und Login prüfen,
  füllen, exakt zurücklesen, einmal senden und Quittung lesen, Thread
  zurücklesen.
- **Der Wrapper als harter Vertrag.** Async-IIFE (die Node-Sandbox ist ein
  persistenter REPL: `const` kollidiert, `return` ist ein Syntaxfehler), ein
  `out`-Objekt, `JSON.stringify(out)` als letzter Ausdruck, und ein `catch`, der
  jeden Fehler als `{error, partial, diag}` mit Seitendiagnose zurückgibt statt
  als nackten Exit-Code.
- **Tolerante Dekodierung.** Kandidaten `result`, dann die stdout-Zeilen von
  hinten, erstes gültiges JSON gewinnt; eine Diagnosezeile macht nie ein
  gültiges Ergebnis ungültig.
- **Evidenz getrennt von Mutation.** Rücklesen und Thread-Kontrolle sind eigene
  Lesevorgänge; „send-once“ wird nie wiederholt. Idempotenz durch Aufbau, nicht
  durch Retry-Politik.
- **Budget-Disziplin.** Sandbox-Timeout pro Phase (30/60/90 s), HTTP-Timeout =
  Sandbox + 30 s, Scrape 120 s, DELETE 60 s.

## 3. Zielbild

Heute, eine Nachricht (vereinfacht, 16 Roundtrips):

```
scrape ─ navigate ─ readAccess ─ readThread ─ inspect ─ fill ─ inspect ─ inspect
       ─ readComposer ─ inspectSend ─ [Convex claim] ─ click ─ readReceipt ×1..31
       ─ navigate ─ readAccess ─ readThread ─ stop
       ─ scrape ─ navigate ─ readAccess ×1..20 ─ stop        (Profil-Beweis)
```

Ziel, dieselbe Nachricht (4 Roundtrips):

```
scrape ──► Programm A „vorbereiten“ ──► [Convex claim] ──► Programm B „senden“ ──► stop
           öffnen, Origin+Login prüfen,                     genau ein Klick,
           Thread-Ids merken,                               Quittung in der Sandbox
           Sender/Body füllen,                              abwarten und lesen,
           exakt zurücklesen,                               Thread zurücklesen,
           alles als ein JSON zurück                        Home+Login prüfen (= Beweis)
```

Der Claim in Convex bleibt die einzige Stelle, an der ein Roundtrip zwischen
Vorbereiten und Senden nötig ist. Alles andere ist Playwright in der Sandbox.

## 4. Leitplanken

Bleibt als Invariante:

- Origin-Wächter in jedem Programm; exakte Werte (Body, Passwort, OTP) reisen
  nur als JSON-Variablen, nie als Prosa.
- Server-seitiger Exakt-Vergleich des zurückgelesenen Bodys vor dem Claim.
- Genau ein Klick auf einer mutierenden Anfrage mit `maxRetries:0`; nach dem
  Claim wird nie wiederholt, ein Fehler danach ist `SUBMIT_RESULT_UNKNOWN`.
- Quittung (`data-roomscout-write-result`, Message-Id, Thread-Id) plus
  Thread-Rücklesen als Erfolgsbedingung.
- Alle Convex-Lifecycle-Aufrufe an ihrem Platz: `reserveRun`,
  `claimWriteSession`, `attachProviderRun`, `attachProviderExecution`,
  `markAgentOnboardingState`, `recordWriteContextProbe`, `finishRun`,
  `finishExecution`. Die Isolationstests hängen daran.

Geht als geerbte Zeremonie:

- `observe`/`act` (nur eine feste Selektor-Tabelle), Inspektion vor dem Füllen,
  drittes Rücklesen über `readEvidence(composer)`, separate Inspektion des
  Sende-Knopfs, jeder `assertCurrentScope`-Roundtrip, die Quittungsschleife auf
  Client-Seite, die zweite Session für den Profil-Beweis.

## 5. Schutzzaun für Browserbase

Unverändert (Byte für Byte):
`convex/integrations/stagehandPortalDriver.ts`,
`convex/integrations/stagehandV4Runtime.ts`,
`convex/integrations/portalWriteAdapters.ts`, `convex/browserbasePortal.ts`,
`convex/integrations/portalBrowserEngine.ts` (Auswahl), `validateRunProvider`,
die sieben `ctx.runAction(internal.firecrawlPortal.*)`-Delegationsstellen,
`portalBrowserCleanup.ts`.

Browserbase hängt an genau sechs Treiber-Exporten
(`controlledRegistrationFailureCode`, `ensureControlledPortalRegistration`,
`ensurePortalAccess`, `readPortalInbox`, `sendControlledPortalMessage`,
`verifyControlledPortalContext`) und an den gemeinsamen Lifecycle-Mutationen.
Firecrawl importiert heute drei davon und ruft sie an fünf Stellen
(`firecrawlPortal.ts:22-26, :269, :305, :482, :992, :1031`). Genau diese fünf
Stellen werden auf die neuen Programme umgestellt; danach importiert
`firecrawlPortal.ts` den Treiber nicht mehr.

Tests, die grün bleiben müssen: `stagehandPortalDriver.test.ts` (29 Fälle),
`stagehandV4Runtime.test.ts`, `stagehandPortal.integration.test.ts`,
`portalWriteAdapters.test.ts`, `firecrawlProviderIsolation.integration.test.ts`
(23 Fälle), `portalInboxSync.integration.test.ts` (Ausschluss Lesen/Schreiben),
`portalBrowserEngine.test.ts`.

Nur Firecrawl-Dateien werden angefasst: `convex/firecrawlPortal.ts` (drei
Funktionen), `convex/integrations/firecrawlPortalEngine.ts` (neue Programme
neben `readFirecrawlPortalInboxBatch`), `firecrawlProgram.ts`,
`firecrawlPortalRuntime.ts` (Budget pro Programm),
`components/firecrawlRoomScout/interact.ts` (Dekodierung), und in
`portalConnections.ts` nur die Konstante `CONTROLLED_PORTAL_POLL_MINUTES`.

Zum hypothetischen Rückschalten auf Browserbase: `PORTAL_BROWSER_ENGINE=
browserbase` plus `BROWSERBASE_API_KEY`; bestehende Verbindungen tragen den
Stempel `firecrawl` und melden `PORTAL_BROWSER_PROVIDER_RECONNECT_REQUIRED`, das
heißt eine Neu-Registrierung pro Verbindung. Der Code-Pfad selbst bleibt durch
diesen Plan unberührt. Nicht Fokus, aber so ist die Lage.

## 6. Scheiben

| # | Scheibe | Aufwand | Wirkung |
|---|---|---|---|
| S0 | **Dekodierung an der Quelle.** Komponente: Markierung aus `output`/`stdout` zuerst, Anbieter-`result` nur Fallback; `output`/`stdout` (oder die Markierungszeile) mit durchreichen, damit der Parser prüfen kann; Form-Protokollierung bei Abweichung. Test mit Envelope-Fixtures (Objekt in `result`, Markierung in `stdout`). | 30 min | Beseitigt EVIDENCE_INVALID an der Wurzel; sofort deploybar. |
| S1 | **Fehlergründe durchreichen.** Programm-Fehler als `{ok:false, code, message, diag}` in-band statt Exception (wie der lokale Wrapper); `EXECUTION_FAILED` trägt die Meldung; `finishExecution` speichert `WRITE_FAILED:<code>` statt des nackten Codes; Registrierungs-Schrittcode behält den inneren Code. Test: ein Sandbox-Fehler landet lesbar im Execution-Record. | 1–2 h | Kein Raten mehr; jede Störung ist in Prod ablesbar. |
| S2 | **Firecrawl-nativer Schreibpfad.** `writePortalMessage` in `firecrawlPortalEngine.ts` nach dem Muster von `readFirecrawlPortalInboxBatch`: Programm A und B wie in Abschnitt 3, zod-validierte Ergebnisse, Retry-Leiter (4 s, 8 s) nur um Scrape plus Programm A. `executeFirecrawlApprovedWrite` ruft es statt `sendControlledPortalMessage`. Tests wie `firecrawlPortalEngine.test.ts`: genau ein mutierender Aufruf nach `beforeSubmit`; Origin-Wächter im Programmtext; ungültiges Ergebnis → ein fester Code; Aufrufzähler ≤ 4. | ½ Tag | 16 → 4 Roundtrips, Pacing und Rate-Limit werden irrelevant, Kaltstart trifft nur noch einen Aufruf. |
| S3 | **Beweis ohne zweite Session.** Programm B endet mit Navigation auf `/` und Login-Prüfung; `recordWriteContextProbe` wird aus diesem Ergebnis gespeist, `retryWriteProfileProof` nur noch bei Fehlschlag. Prüfen, ob Schreiben mit `saveChanges:false` reicht (Clerk rotiert beim Schreiben keine Cookies; wenn das hält, gibt es gar keinen Schreib-Lock mehr). | 2 h | Beseitigt die selbstgemachten 409 und das falsche `reauth_required`. |
| S4 | **Registrierung als zwei Programme.** Programm 1: Terms, E-Mail, Passwort, exakt zurücklesen, absenden, OTP-Feld abwarten; AgentMail-Poll bleibt host-seitig auf derselben Session; Programm 2: OTP füllen, absenden, Login und Home bestätigen. Captcha-Politik einmal lesen und bei Widget sofort `human_required` melden statt 16 Polls. Pro-Lauf-Profilname bleibt. | ½ Tag | ~33 → ~6 Roundtrips; passt in ein 45-Sekunden-Budget. |
| S5 | **Budgets wie lokal.** Sandbox-Timeout pro Programm (30/60/90 s) statt Restbudget; HTTP = Sandbox + 30 s; die 120 s Session bleiben äußere Grenze. Pacing bleibt bei 700 ms, ist bei 2–3 Aufrufen bedeutungslos. | 1 h | Ein hängendes Programm reißt nicht mehr alles mit; die Fehlerursache bleibt sichtbar statt `DEADLINE_EXCEEDED`. |
| S6 | **Poll auf 60 Minuten.** Webhook ist der Primärweg (Kette am 2026-09-14 bewiesen), der Poll nur Sicherheitsnetz. Vorher prüfen, ob der Scout-Webhook auch für Dev registriert ist. Fehler-Backoff bleibt. | 15 min | Weniger Sessions im Profil, weniger Rate-Limit-Kollisionen. |
| S7 | **Paritäts-Test.** Ein Test mit aufzeichnendem Transport, der pro Vorgang die Interact-Aufrufe zählt (Nachricht ≤ 4, Sync ≤ 3, Registrierung ≤ 6) und die Quittungsfelder gegen die lokalen Skripte prüft. Die vier `scripts/firecrawl-local-*.mjs` bleiben als Konformitätsvorlage im Repo. | 1 h | Verhindert, dass der nächste Umbau die Aufrufzahl wieder verdreifacht. |

Reihenfolge: S0 und S1 sofort (klein, sofortiger Nutzen), S6 dazu. Dann S2 mit
S5, das ist der große Gewinn. S3 direkt danach. S4 zuletzt; die Registrierung
läuft in der Demo selten. S7 begleitet S2.

Rollout pro Scheibe: Dev-Deploy, eine Nachricht durch das Dev-Portal, dann
Prod. Der alte Primitiv-Pfad wird ersetzt, nicht hinter einem Schalter
behalten; der Treiber bleibt für Browserbase.

## 7. Risiken und offene Prüfungen

- **Erfassung von `output`/`stdout`.** Die Memory vom 2026-09-11 sagt, `console.log`
  werde im REPL nicht erfasst; das lokale Skript verlässt sich auf `result` als
  letzter Ausdruck. S0 muss beides bedienen: letzter Ausdruck ist die kodierte
  Zeichenkette UND die Markierung steht im Ausgabetext. Die Form-Protokollierung
  aus S0 zeigt nach dem ersten Prod-Lauf, welche Variante Firecrawl liefert.
- **Cookie-Rotation.** S3 setzt voraus, dass Clerk beim Schreiben keine Cookies
  erneuert. Prüfung: eine Nachricht mit `saveChanges:false`, danach
  Inbox-Sync mit demselben Profil.
- **Sandbox-Laufzeit.** Programme mit Waits bis 90 s liegen weit unter dem
  300-Sekunden-Maximum von Interact; ein Programm, das die Quittung 30 s abwartet,
  ist zulässig.
- **Turnstile.** Firecrawls Browser löst Clerk-Turnstile nicht; im Demo-Portal ist
  der Bot-Schutz aus. S4 ändert daran nichts, meldet aber sauber `human_required`.

## 8. Erfolgskriterien

- Eine Nachricht kostet höchstens vier HTTP-Roundtrips und dauert Ende zu Ende
  unter 30 Sekunden.
- Zehn Demo-Nachrichten in Folge gehen ohne manuellen Eingriff durch.
- Jede fehlgeschlagene Anfrage trägt die Ursache im Execution-Record.
- Alle Browserbase- und Treiber-Testsuiten bleiben unverändert grün.
