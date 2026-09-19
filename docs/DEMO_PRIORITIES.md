# Demo-Prioritäten (Stand 2026-09-15, 02:00)

Festgehalten aus dem Gespräch mit dem Maintainer nach dem Firecrawl-Umbau.
Hackathon-Deadline 2026-09-22.

> Aktualisierung 2026-09-16: GPT-Live und die Kandidaten-/Budget-Fixes sind auf
> Produktion veröffentlicht. Die untenstehenden Bestandszahlen beschreiben den
> früheren Priorisierungsstand, keine aktuelle Datenabfrage. Als Nächstes stehen
> durchgehend EN/DE, der begrenzte GT-Wörterbuchtest und das fertige Demo-Paket
> an. Neue Sprachen und Standorte gehören nicht in diesen Schritt. Der
> vollständige Portal-/Raum-Durchlauf und die zehn Wiederholungen bleiben reale
> Abnahmen durch den Maintainer. Aktueller Abschlussplan:
> [Demo und Einreichung](DEMO_SUBMISSION_READINESS.md).

> UX-Entscheidung 2026-09-16: Voice und Text-Scout sind der Musiker-Einstieg.
> Explore und Karte entfallen als Produktoberflächen; der Index bleibt die
> Datengrundlage des Scouts. Die ältere Karten-Kulisse unten ist damit überholt.

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
- **GPT-Live:** Der GPT-Live-Pfad ist implementiert und inzwischen mit dem
  aktuellen Demo-Stand in Produktion veröffentlicht.
  Live führt das natürliche Discovery-Gespräch; der bestehende Terra-Scout
  speichert Fakten und Memory, prüft Bereitschaft und führt Aktionen aus.
  Englisch ist Standard, ein ausdrücklicher Deutschwechsel bleibt gespeichert,
  und `marin` ist die festgelegte Stimme. Synthetische API- und gezielte
  menschliche Nachweise sind dokumentiert; der vollständige Anbieterweg und die
  zehn stabilen Demo-Wiederholungen bleiben offen.

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
4. **Englisch.** Das vollständige UI-Wörterbuch, Englisch als Standard und der
   gespeicherte ausdrückliche Deutschwechsel sind umgesetzt. Für den Dreh bleiben
   die englischen Portal-/Vermieter-Bot-Texte und der vollständige Durchlauf zu
   prüfen.
5. **Evalite reparieren und Scorecard erzeugen.** Kleiner Fix (Mandat raus,
   Regeln rein, Musiker-Rolle im Simulator), dann läuft die Offline-Suite
   wieder, plus die Live-Suite aus Punkt 2. Für die Demo zweitrangig, als
   Qualitätsnachweis erstrangig.
6. **Aufräumen:** Branch mergen und pushen, alte Ops-Seiten aus der
   Navigation, „Mandat“ aus Docs und Landing.

## Bewusst nicht

Ein weiteres Voice-/Persona-Redesign, Modellvergleiche, Browserbase-Rückweg und
Kandidaten D bis J der Architektur-Liste. Sie tragen nichts zur Demo bei, was
nicht schon läuft.
