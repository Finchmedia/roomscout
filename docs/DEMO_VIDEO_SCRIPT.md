# Demo-Video: Drehbuch-Entwurf (Stand 2026-09-16)

Vorbild ist das GPT-Live-Launchvideo von OpenAI: ein Take, echte Reaktionen,
jeder Beat zeigt eine Fähigkeit (Vollduplex, Unterbrechung, Hintergrundlärm,
Backend-Aktion, Preis), und der Humor kommt aus der Situation, nicht aus dem
Modell. Unser Setting: Proberaum, der Maintainer spielt den Musiker, das Handy
spielt „Mike“, den Gitarristen, der nicht aufhören kann.

Alles unten ist Entwurf. Gesprochene Scout-Zeilen sind Beispiele dafür, was das
Modell sagen könnte, keine Templates.

## Aufbau im Bild

- **Links:** Laptop mit der Bühne. Drei Spalten: Kandidaten, Blob mit
  einströmenden Captions, Suchauftrag rechts. Der Suchauftrag ist unser
  „LED-Display“: hier sieht man, was der Scout verstanden und gespeichert hat.
- **Mitte:** der Musiker mit Kopfhörern oder Laptop-Mikro.
- **Rechts oder Handy:** das Demo-Portal roomscout.dev mit dem Vermieter-Posteingang.
  Das ist unser „Roboter“: die sichtbare Wirkung der Backend-Aktion.
- **Handy 2 / Bluetooth-Box:** Mikes Gitarrensolo als Störgeräusch.

## Beats

| # | Beat (OpenAI-Vorbild) | RoomScout-Moment | Was sichtbar wird | Stand |
|---|---|---|---|---|
| 1 | „What are we launching today?“ | „Hey Scout, we're a four-piece post-punk band in Stuttgart. We need a room on Wednesdays, around 300 a month.“ | Ort, Band, Mittwoch, Budget fliegen als Kapseln in den Suchauftrag, während der Satz noch läuft | Frühe Faktenübernahme auf dem Codex-Branch nachgewiesen (erste Fakten nach ~10 s) |
| 2 | Unterbrechung | Der Scout fragt nach dem Schlagzeug, der Musiker fällt ihm ins Wort: „Wait, make that 280, not 300.“ | Scout bricht ab, Budget-Zeile wechselt auf 280 mit kurzem Aufleuchten | 300 → 280 auf dem Codex-Branch nachgewiesen |
| 3 | Hintergrundlärm | Mike spielt ein schiefes Solo. Musiker: „Mike, give it a rest for one minute, I'm talking to our Scout.“ Dann in den Lärm hinein: „And the drum kit has to stay in the room.“ | Equipment-Zeile erscheint trotz Lärm, Scout bestätigt kurz | Vom Maintainer im Test bestätigt, noch nicht als Aufnahme geprüft |
| 4 | Backend steuert den Roboter | „Alright, go find us something.“ Suche startet per Stimme. Der Scout arbeitet, das Gespräch läuft weiter. | Status „Ich kümmere mich darum“, Kandidat erscheint links, im Portal trifft die Nachricht des Scouts beim Vermieter ein | Suchstart per Stimme: Codex-Fixture. Nachricht ins Portal über Firecrawl: auf autopilot-policy bewiesen (4 Round Trips). Beides zusammen: offen |
| 5 | Antwort kommt zurück | Der Vermieter antwortet (Simulator oder Vermieter-Bot). An der nächsten Pause: „Quick update: Wednesday works at the West room, and the kit can stay. One condition: three months minimum. Fine with you?“ Musiker: „Yeah, that's fine.“ | Entscheidungskarte auf der Bühne, per Stimme beantwortet, Karte schließt | Anbieterweg bis zur gesprochenen Erwähnung ist nur mit synthetischem Fixture geprüft. Das ist der eine Beweis, der noch fehlt |
| 6 | Preis / Abschluss | Angebot bereit. Musiker klickt „Angebot prüfen“, ein Klick, „Zusage gesendet“. Optional als Schlussgag: Mike fragt auf Deutsch dazwischen, der Scout antwortet auf Deutsch. | Zusage im Portal sichtbar, Status mit Uhrzeit | Zusage über Firecrawl auf autopilot-policy bewiesen. Sprachwechsel EN→DE auf dem Codex-Branch bewiesen |

Die verbindliche Zusage bleibt der eine Klick in der UI. Das ist kein
Demo-Kompromiss, sondern die Regel: der Scout handelt bis zur Verbindlichkeit,
die Verbindlichkeit gehört dem Menschen.

## Produktionsregeln

- **Ein Take pro Abschnitt, keine Schnitte um Scout-Antworten herum.** Ein
  Schnitt ist nur an einer Stelle ehrlich: zwischen Beat 4 und 5, wenn der
  Vermieter länger als eine Minute braucht. Dann Einblendung „two minutes
  later“, so wie OpenAI es auch nicht kaschiert hätte.
- **Humor aus den Menschen, nicht aus dem Modell.** Mikes Solo und der Musiker,
  der ihn zurechtweist, tragen den Witz. Wir scripten keine Pointe für den
  Scout; wenn er trocken reagiert, ist das Bonus.
- **Kein Fluchen.** Die Zeile für Mike muss auf einer Hackathon-Bühne und in
  einem Firmen-Feed funktionieren.
- **Der Suchauftrag rechts ist immer im Bild.** Jede gesprochene Änderung muss
  dort landen, sonst glaubt niemand, dass der Scout verstanden hat.
- **Das Portal ist sichtbar.** Die Nachricht des Scouts beim Vermieter und
  später die Zusage sind der Beweis, dass da ein Backend handelt.
- **Englisch durchgehend**, Deutsch nur als bewusster Wechsel am Ende.

## Was vor dem Dreh belastbar sein muss

1. **Radius-Blocker** (Codex, in Arbeit): fehlt der Umkreis, fragt der Scout
   nach, statt „bereit“ zu sagen. Ohne das hängt Beat 4.
2. **Eine Voice-Ansicht** (Codex, in Arbeit): Blob plus streamender
   Gesprächsbereich, kein zweiter Chat darunter.
3. **Voice und echter Anbieterweg auf einer Instanz.** Die Codex-Instanz hat
   kein Firecrawl, unser Dev hat kein GPT-Live. Erst nach dem Zusammenführen
   lässt sich Beat 4 bis 6 am Stück proben.
4. **Vermieter, der antwortet.** Heute: der geskriptete Simulator oder der
   Maintainer selbst im Portal. Der LLM-Vermieter-Bot (Priorität 2) macht die
   Demo selbstlaufend und die Antwortzeit planbar.
5. **Antwortlatenz messen.** Der Maintainer hat gemerkt, dass Scout-Antworten
   „noch ein bisschen brauchen“. Für das Video muss die Hintergrundmeldung in
   der Gesprächspause landen, nicht mitten im nächsten Satz.
6. **Zehn Durchläufe am Stück**, bevor die Kamera läuft. Die Demo ist nur so
   gut wie der schlechteste Durchlauf.

## Länge

OpenAIs Video hat 75 Sekunden mit fünf Beats. Unsere sechs Beats mit echtem
Anbieterweg brauchen realistisch zwei bis drei Minuten. Kürzer geht, wenn
Beat 5 und 6 zusammenfallen: der Vermieter antwortet gleich mit dem Angebot.
