# Demo-Prioritäten (Stand 2026-09-15, 02:00)

Festgehalten aus dem Gespräch mit dem Maintainer nach dem Firecrawl-Umbau.
Hackathon-Deadline 2026-09-22.

> Ergänzung 2026-09-15, abends: Der Maintainer hat die isolierte Umsetzung der GPT-Live-Migration ausdrücklich beauftragt (Astra koordiniert, Sol-5.6-Subagents implementieren). Die damaligen Aussagen „nur geplant“ und „vor der Demo nicht anfassen“ unten beschreiben die Entscheidung vom frühen Morgen und sind für diesen isolierten Arbeitsauftrag überholt. Die laufende Implementierung ist noch keine Produktionsfreigabe und kein Ersatz für die Portal-/Raum-Demo. Verbindlicher Stand: [Migrationsplan](GPT_LIVE_MIGRATION_PLAN_2026-09-15.md) und [Implementierungs-/Prüfstatus](GPT_LIVE_IMPLEMENTATION_STATUS.md).

## Stand der drei Punkte

- **Real-World-Räume:** Auf Prod gibt es genau ein Signal (das Demo-Listing),
  zwei Quellen (beide roomscout.dev), null Quellen-Kandidaten. Explore, Karte
  und Matching zeigen also einen einzigen Raum. Die Pipeline dafür existiert
  (Discovery-Cursor „Deutschland“, Kandidaten-Review, Firecrawl-Monitore), aber
  die Monitore sind aus und der nächtliche Abgleich hat einen Bug, der ihn nie
  laufen lässt.
- **Demo-Portal:** Ein Listing, ein Vermieter, das ist der Maintainer. Der
  geskriptete Simulator im Portal (`controlledSimulation.ts`) kennt drei
  Szenarien, ist aber nur Betreiber-Werkzeug und kein LLM.
- **GPT-Live:** Nur geplant. `docs/GPT_LIVE_VOICE_PLAN.md` sagt selbst „plan and
  handoff only, nothing implemented“. Heute läuft Voice über OpenAI Realtime,
  und das Realtime-Modell denkt selbst: es hat den vollen Werkzeugsatz (Suche
  aktualisieren, Fakten merken, Entscheidung beantworten, Anbieter antworten).
  Der Convex-Scout ist im Voice-Pfad nicht das Gehirn. Der geplante Umbau
  (Realtime nur als Stimme, Scout entscheidet) ist ein eigener mehrtägiger
  Umbau mit ungetesteter API. Eine Woche vor der Demo nicht anfassen. Voice
  funktioniert, hat die Entscheidungs-Werkzeuge, dort wird nur gefixt, was
  bricht.

## Rangfolge für die Demo

1. **Der Kern muss zehnmal hintereinander laufen.** Firecrawl-Umbau
   (gelandet 2026-09-15, Commit 0631cc8). Alles andere ist wertlos, wenn die
   Zusage vor Juroren beim dritten Anlauf scheitert.
2. **Fleisch im Demo-Portal, mit Vermieter-Bot.** Zehn bis fünfzehn Listings in
   Stuttgart mit unterschiedlichen Konstellationen (zu teuer, falscher Abend,
   nur Mindestlaufzeit, Kaution, Schlagzeug verboten, ein Vermieter, der
   drängt) und ein LLM-Vermieter im Portal, der aus einem Briefing antwortet.
   Damit wird die Demo selbstlaufend, und dieselben Briefings sind die Fälle
   für Evalite. Größter Hebel für „gehärteter Scout vor der Demo“, weil er
   echte Konstellationen über den echten Pfad fährt.
3. **Real-World-Räume als Kulisse.** Firecrawl-Discovery für drei Städte,
   Kandidaten prüfen, promoten, Monitor-Bug fixen, Monitore an. Explore und
   Karte zeigen Dutzende echter Räume, der Scout findet echte Treffer, das
   Firecrawl-Showoff ist sichtbar (Suche, Scrape, Extraktion, Monitore).
   Anschreiben bleibt technisch auf roomscout.dev beschränkt; die
   Freigabeprüfung erzwingt das mit `controlled_portal_only`.
4. **Englisch.** UI-Wörterbuch (rund 1.100 Strings, mechanisch), Sprache pro
   Nutzer für die festen Backend-Texte, Vermieter-Bot auf Englisch. Der Scout
   selbst folgt der Sprache der Band.
5. **Evalite reparieren und Scorecard erzeugen.** Kleiner Fix (Mandat raus,
   Regeln rein, Musiker-Rolle im Simulator), dann läuft die Offline-Suite
   wieder, plus die Live-Suite aus Punkt 2. Für die Demo zweitrangig, für
   SynTwin erstrangig.
6. **Aufräumen:** Branch mergen und pushen, alte Ops-Seiten aus der
   Navigation, „Mandat“ aus Docs und Landing.

## Bewusst nicht

GPT-Live-Umbau, Browserbase-Rückweg, Kandidaten D bis J der Architektur-Liste.
Sie tragen nichts zur Demo bei, was nicht schon läuft.
