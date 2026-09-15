# Demo-Video: Drehbuch (Stand 2026-09-16, zweiter Entwurf)

Format: ein Loom. Ein Take pro Szene, live gesprochen, echte Bildschirmaufnahme,
echte Stimme, echtes Portal. Vorbild ist das GPT-Live-Launchvideo von OpenAI
(ein Beat pro Fähigkeit, Humor aus der Situation). Dazu kommt, was ein
Hackathon-Juror braucht und OpenAI nicht brauchte: den Grund. Eine Band fliegt
aus ihrem Proberaum.

Feste Zeilen gibt es nur für den Menschen. Die Scout-Zeilen sind Beispiele für
das, was das Modell sagen könnte, keine Templates. Englisch durchgehend,
Deutsch nur als bewusster Wechsel am Schluss.

Ziel-Länge: 3:00 bis 3:30. Die Produktstrecke (Szene 1 bis 5) bleibt der
längste Teil, weil der Juror die App bewertet, nicht den Film.

## Szene 0 · Kaltstart (0:00 bis 0:20)

**Bild:** Daniel am Laptop, Webcam-Framing. Die Umgebung ist KI-generiert: ein
Proberaum, hinter ihm reißt eine Abrissbirne oder ein Bagger die Rückwand
heraus. Daniel selbst ist real gefilmt, nur der Hintergrund ist ersetzt.
Kameraposition, Shirt und Licht sind identisch mit der späteren Webcam.

**Ton:** volle Baustelle.

**Daniel:** "RoomScout, I hope you can hear me. The demolition crew is already
tearing down our rehearsal room. We need a new one, and we need it fast."

**Übergang:** In dem Moment, in dem die Wand fällt, Überblendung auf die echte
Webcam. Auf dem Tisch liegt das Handy, aus dessen Lautsprecher blechern der
Baustellen-Sound kommt. Daniel tippt es aus. Der Zuschauer weiß jetzt: das
hier ist echt.

## Szene 1 · Der Suchauftrag entsteht im Gespräch (0:20 bis 1:05)

**Bild:** Bildschirmaufnahme der Bühne, drei Spalten: Kandidaten links, Blob
mit einströmenden Captions in der Mitte, Suchauftrag rechts. Webcam klein in
der Ecke.

**Daniel:** "We're a four-piece glam rock cover band in Stuttgart. We rehearse
Wednesday evenings, around 300 a month, and the drum kit has to stay in the
room."

**Was passiert:** Ort, Band, Mittwoch, Budget, Equipment fliegen als Kapseln in
den Suchauftrag, während der Satz noch läuft. Der Scout stellt eine Frage,
voraussichtlich nach dem Umkreis.

**Daniel:** "Fifteen kilometres around Stuttgart is fine."

**Beat Unterbrechung:** Der Scout setzt zu einer Rückfrage an, Daniel fällt
ihm ins Wort: "Wait, make that 280, not 300." Der Scout bricht ab, die
Budget-Zeile springt auf 280 und leuchtet kurz auf.

**Beat Lärm:** Mike beginnt hinter Daniel ein schiefes Gitarrensolo (zweites
Handy oder eine zweite Person). Daniel dreht sich um: "Mike. One minute. I'm
talking to our Scout." Zurück zur Kamera, in den Lärm hinein: "And we need
parking for the van." Die Zeile erscheint trotzdem. Wenn der Scout trocken
bestätigt, ist das die Pointe; wir scripten sie nicht.

## Szene 2 · Losschicken (1:05 bis 1:20)

**Daniel:** "Alright. Go find us something."

**Was passiert:** Die Suche startet per Stimme. Die Bühne wechselt in den
Arbeitszustand ("I'm on it."), das Gespräch bleibt verbunden, der Blob bleibt
oben.

**Scout (Beispiel):** "On it. I'll check the listings around Stuttgart and get
in touch with the ones that fit. I'll let you know when there's news."

## Szene 3 · Loom-Erklärung, während der Scout arbeitet (1:20 bis 2:20)

Dieser Teil füllt genau die Zeit, die Firecrawl und der Vermieter brauchen.
Daniel wechselt ins Entwickler-Register, bleibt aber live und im selben Take.

**Daniel:** "While it works, let me show you what's actually happening."

**Bild und Reihenfolge:**

1. Die Quellen-/Run-Ansicht mit den echten Firecrawl-Schritten, die sich live
   von aktiv auf erledigt schalten. Das ist der Overlay. Keine gebaute
   Animation nötig; wenn Zeit bleibt, kommt eine obendrauf.
2. Das Demo-Portal roomscout.dev in einem zweiten Fenster, klar benannt: "This
   is our controlled portal, so we don't bother real musicians."
3. Der Vermieter-Posteingang im Portal, in dem die Nachricht des Scouts
   eintrifft.

**Daniel (Leitfaden, frei gesprochen):** "The Scout matches the brief against
the sources. Firecrawl opens the portal in a browser session and registers the
band. The portal runs Clerk, so a one-time code lands in the band's own
AgentMail inbox, which we provision at signup. We read the code, Firecrawl's
Interact endpoint types it in, and then it writes the message on the listing.
Every outgoing action passes a release check. The one thing the Scout never
does on its own is a binding commitment."

**Im Hintergrund:** Der Vermieter antwortet (Vermieter-Bot oder Simulator im
Portal). Webhook, Sync, Bewertung. Wenn das länger dauert als die Erklärung,
gibt es genau hier den einen ehrlichen Schnitt: Einblendung "two minutes
later".

## Szene 4 · Der Scout meldet sich zurück (2:20 bis 2:45)

**Was passiert:** An der nächsten Gesprächspause spricht der Scout die
geprüfte Antwort an. Gleichzeitig steht die Entscheidungskarte auf der Bühne.

**Scout (Beispiel):** "Quick update. The West room works on Wednesdays and the
kit can stay. One condition: three months minimum. Fine with you?"

**Daniel:** "Yeah, that's fine."

**Was passiert:** Die Karte schließt sich, der Scout schreibt zurück, das
Angebot wird vorbereitet.

## Szene 5 · Die Zusage bleibt beim Menschen (2:45 bis 3:05)

**Scout (Beispiel):** "They've sent the offer. Want to look at it?"

**Bild:** "Angebot prüfen" auf der Bühne, ein Klick, der Zusage-Flow, Bestätigung.
Status "Acceptance sent" mit Uhrzeit. Im Portal-Fenster erscheint die Zusage
beim Vermieter.

**Daniel:** "That's the one thing I do myself. Everything up to here, the Scout
did."

## Szene 6 · Schluss (3:05 bis 3:25)

**Optionaler Sprachwechsel als Gag:** Mike aus dem Hintergrund, auf Deutsch:
"Und? Haben wir jetzt was?" Daniel: "Scout, kannst du das für Mike auf Deutsch
zusammenfassen?" Der Scout wechselt, die UI wechselt mit.

**Schlusszeile (Daniel):** "RoomScout. Your band's scout, until the deal is
yours to sign."

**Abspann:** Stack in einer Zeile: Convex, GPT-Live, Firecrawl, AgentMail.

## Nachweis-Stand pro Szene

| Szene | Baustein | Stand |
|---|---|---|
| 0 | KI-Kulisse mit fallender Wand | Noch nicht produziert |
| 1 | Frühe Fakten während des Sprechens | Bewiesen (Codex-Branch, erste Fakten nach ~10 s) |
| 1 | Korrektur 300 → 280 | Bewiesen |
| 1 | Verstehen bei Lärm | Vom Maintainer getestet, nicht als Aufnahme |
| 1 | Umkreis-Rückfrage statt "bereit" | Codex, in Arbeit (Radius-Blocker) |
| 2 | Suchstart per Stimme, Gespräch bleibt | Bewiesen (Codex-Fixture) |
| 3 | Registrierung und Nachricht über Firecrawl ins Portal | Bewiesen (autopilot-policy, 4 Round Trips), nicht zusammen mit Voice |
| 3 | Run-Ansicht mit Live-Schritten | Vorhanden |
| 3 | Vermieter, der planbar antwortet | Simulator vorhanden, Vermieter-Bot offen (Priorität 2) |
| 4 | Echte Anbieterantwort bis zur gesprochenen Erwähnung | Offen. Nur synthetisches Fixture |
| 5 | Zusage über Firecrawl, Receipt als Beweis | Bewiesen (autopilot-policy) |
| 6 | Sprachwechsel EN → DE mit UI | Bewiesen (Codex-Branch) |

## Voraussetzungen vor dem Dreh

1. Radius-Blocker und die eine Voice-Ansicht (Codex, in Arbeit).
2. Voice und echter Anbieterweg auf einer Instanz: Fast-Forward von
   autopilot-policy auf den Codex-Branch, Deploy auf Dev, Provider-Schalter auf
   Live.
3. Vermieter-Bot im Portal, damit die Antwort in Szene 3 planbar kommt.
4. Antwortlatenz messen: Die Hintergrundmeldung muss in der Pause landen, nicht
   im nächsten Satz.
5. Zehn Durchläufe am Stück, bevor die Kamera läuft.
6. Englische Bühnen-Texte durchgehend (das EN-Wörterbuch liegt auf dem
   Codex-Branch).

## Produktionsregeln

- Keine Schnitte um Scout-Antworten herum. Der eine ehrliche Schnitt sitzt in
  Szene 3, wenn der Vermieter zu lange braucht.
- Humor aus den Menschen: Mikes Solo, Daniels Ansage, das Handy mit dem
  Baustellen-Sound. Keine Pointe für das Modell scripten.
- Kein Fluchen, keine geschützten Band-Looks. "Glam rock cover band" reicht.
- Der Suchauftrag rechts ist immer im Bild. Das Portal ist sichtbar, sobald
  der Scout handelt.
- Wenn ein Take scheitert, wird die Szene wiederholt, nicht geschnitten.
