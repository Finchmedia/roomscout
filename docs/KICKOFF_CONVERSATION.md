# Kickoff Conversation (distilled)

> **English TL;DR:** This is the distilled planning conversation (originally German) that produced RoomScout, held 2026-08-26 with Claude. Path: from "what should I build for this hackathon?" through three candidate ideas to the final concept, including the shared-directory architecture and the two-tier email design. Personal and business-internal details are redacted — this is the distillate, not the raw transcript.

Stand: 2026-08-26 · Sprache: Deutsch (Original), gekürzt und destilliert

---

## Ausgangspunkt

Daniel: *„Schau dir mal diesen Hackathon an — was könnte ich als fun Fingerübung bauen, mit meinen Interessen und Fähigkeiten?"*

Rahmen des Hackathons (Convex „All Gas"):

- Everyday Apps, keine Developer-Tools — „build what you know: law, hospitality, health, construction…"
- Sponsor-Stack muss echte Arbeit leisten: **Convex runs it, Firecrawl feeds it data, AgentMail gives it an inbox**, OpenAI generiert
- Neue App (Start ab 25.08.), public Repo, Live-URL (convex.site), <3-min-Demo-Video, Social-Post
- Deadline: 22.09.2026, 12:00 PT
- **$20k Firecrawl-Credits pro Teilnehmer — aber nur während der Build-Phase** (nach Luma-Registrierung)

## Ideenfindung

Drei Kandidaten wurden diskutiert:

1. **RoomScout** — Proberaum-/Studio-Finder mit E-Mail-Agent ✅
2. **Kita-Post-Pilot** — AgentMail-Inbox für den Eltern-Mail-Wahnsinn, Termine → Familien-Dashboard (sehr „everyday", aber Firecrawl-Ecke schwach)
3. **Angebots-Agent für Hausbesitzer** — verworfen aus Kontextgründen

**Entscheidung für RoomScout**, weil es alle vier Sponsoren *natürlich* trifft statt gequetscht, und weil es thematisch direkt an Daniels Hauptprojekt Jumper (Buchungsplattform für Studio-Räume) andockt: gleiches strukturelles Problem, alternativer Ansatz — Plattform vs. Aggregator. Der Struggle ist real: Jede Band kennt den E-Mail-Marathon mit Studios.

## Kern-Architekturentscheidung: Shared Directory (Daniels Input)

Daniel: *„Wenn eine Band in Stuttgart gesucht hat und 5 Ergebnisse aufkamen — dann soll die nächste Band diese 5 Ergebnisse automatisch schon parat haben, und wir verbrennen nicht Tokens umsonst."*

Daraus wurde das zentrale Designprinzip:

- `rooms` ist die **geteilte Wahrheit**, gekeyt nach Stadt, mit `lastCrawledAt` + TTL (~14 Tage)
- Eine Suche prüft erst den Bestand; nur bei Miss/Stale feuert die Crawl-Pipeline
- Jede Suche macht das öffentliche Verzeichnis besser; Suche Nr. 2 in derselben Stadt ist instant
- `searches` bleibt trotzdem eigene Tabelle (Nachfrage-Log)
- Crons crawlen stale Städte nach — das Verzeichnis pflegt sich selbst

## Zwei E-Mail-Ebenen (Duplikat-Schutz für die Studios)

- **Anreicherung** („Was kostet ihr, was steht drin?") → einmal pro Raum, Ergebnis landet im geteilten Datensatz
- **Individuelle Anfrage** („Di + Do abends ab Oktober?") → pro Band, über deren eigene AgentMail-Inbox

Studios bekommen nie Duplikat-Spam, nur weil zwei Bands dieselbe Stadt gesucht haben.

## Firecrawl-Credits-Strategie

Die $20k gelten nur im Build-Fenster → Konsequenz: **im Fenster bewusst breit crawlen und die Daten in Convex einlagern.** Die Credits verfallen, die Datenbank bleibt. Städte-Priorität: Stuttgart zuerst (Heimspiel, verifizierbar), dann Berlin, Hamburg, München, Köln, Leipzig.

## Naming & Reuse

- Arbeitstitel: **RoomScout** (Rename vor Submission möglich)
- „BandAid" verworfen (Band-Aid® ist eine J&J-Marke; US-Judges lesen das Pflaster)
- Design-System (CSS-Tokens) und Hero-Video-Komponente (Vimeo-Embed) werden aus dem eigenen Hauptprojekt portiert — im Build-Log transparent ausgewiesen; aller App-Code ist neu
