# RoomScout

RoomScout ist ein autonomer Proberaum-Scout: Musiker beschreiben ihren Bedarf, der Scout sucht, kontaktiert Anbieter und klärt Details, bis ein Angebot vorliegt. Die verbindliche Zusage bleibt beim Menschen.

## Language

### Handlungsspielraum

**Handlungsspielraum**:
Die vom Nutzer gewählten Regeln, wie selbstständig der Scout arbeitet. Gilt pro Nutzer für alle Suchaufträge.
_Avoid_: Policy, Autonomy rules, Mandat (für die Regeln)

**Modus**:
Der Hauptschalter des Handlungsspielraums: Autopilot oder Rücksprache.
_Avoid_: guided, research_autopilot, outreach_autopilot, negotiation_autopilot

**Autopilot**:
Modus, in dem der Scout jeden unverbindlichen Schritt ohne Rückfrage ausführt.
_Avoid_: Standing mandate, Default autopilot

**Rücksprache**:
Modus, in dem jede ausgehende Nachricht vor dem Versand als Entscheidung vorgelegt wird. Suchen, Registrieren und Lesen bleiben autonom.
_Avoid_: Review mode, guided, Mit Rücksprache (als Feldwert)

**Verbindliche Zusage**:
Der Schritt, der in jedem Modus beim Menschen bleibt: Angebot annehmen, Buchung, Zahlung, Kaution, Vertrag. Passwort, 2FA und Captcha sind ebenfalls menschliche Eingriffe.
_Avoid_: binding commitment, commitment boundary, harte Linie (im Code)

**Datenfeld**:
Eine Kategorie persönlicher Angaben, die der Scout teilen darf. Bandprofil: Bandname, Vornamen, Scout-Adresse, Verfügbarkeit, Budget, Musikprofil. Privat: Telefon, genaue Adresse.
_Avoid_: personal data scope, Scope

### Ablauf

**Freigabeprüfung**:
Die eine Prüfung, ob der Scout eine Aktion jetzt ausführen darf. Sie liest den Handlungsspielraum und antwortet mit weiter, warten, Entscheidung oder Stopp, immer mit Grund.
_Avoid_: Gate, authorization, mandate check

**Entscheidung**:
Eine Frage des Scouts an den Nutzer mit Ja oder Nein, die bei Ja die vorbereitete Aktion ausführt. Erscheint dort, wo der Nutzer ist: im Scout-Chat.
_Avoid_: Approval, Freigabe (als Objekt), awaiting_approval

**Suchauftrag**:
Ein aktiver Bedarf eines Nutzers mit Ort, Budget und Anforderungen, für den der Scout arbeitet.
_Avoid_: saved need, search, Mandat

**Anbieter**:
Die Person hinter einem Inserat, mit der der Scout korrespondiert.
_Avoid_: Provider, Vermieter, Listing owner

**Angebot**:
Ein vom Anbieter bestätigter Stand zu Raum, Preis und Konditionen, den der Nutzer verbindlich zusagen kann.
_Avoid_: Offer, Deal
