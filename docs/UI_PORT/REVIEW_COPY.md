# REVIEW_COPY — new strings for maintainer review

**Status: every row below is PROPOSED. Nothing here is in the product yet.**

This document exists because of `DECISIONS.md` item 15. It collects every string the UI port needs
that the prototype never contained, each as a German original with an English pair. It is a review
artefact, not a dictionary: **no code imports this file.**

**How to use it.** Read a table, edit the DE column in place where the wording is wrong, and strike
any row you do not want. Once you are happy with a group, the accepted rows are added to the
dictionaries under
`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/copy/de/` at the key given in the
first column, and the English pairs go into the `en` dictionaries when they are written
(`DECISIONS.md` item 10). Until then the builder treats these strings as drafts.

**Tone rules applied** (from `design-system/readme.md`, "Content fundamentals"):

- Informal **du** for the individual, **ihr/euch** for the band. The Scout speaks in first person **ich**.
- Sentence case everywhere. Headlines end with a period. Overlines are UPPERCASE.
- Buttons are verb-first imperatives, two to three words.
- No emoji, no exclamation marks, no percentages, no counters, no model names, no IDs, no technical logs.
- Middle-dot separators, prices `280 € / Monat`, times with an en dash, dates `1. Oktober 2026`.
- Status lines are human progress, never telemetry.

**Scope.** Server-authored strings stay English and are not listed here — `DECISIONS.md` item 13
sends server-side localisation to the backlog. That covers the two `searchSources` disclosures, the
provider-conversation blocker prefix, all notification titles and bodies, and every piece of model
output (`assessment.summary`, `blockers`, `uncertainties`, `request.error`, `mailbox.lastError`).

**Reading the Note column.** `DE exists` marks a row whose German string is already in the
dictionaries verbatim; only the English pair is new, and the DE column repeats the shipped value so
you can see the pair. Every other row is new in both languages.

**Two decisions that produce no string.** `DECISIONS.md` item 45 truncates the calm banner and the
no-incident Diagnose card to their first sentence with no replacement, so nothing is authored for
it. Item 44 fixes 24-hour time in both languages; the German `„Heute, {time}“` already exists, so
only its English pair appears below.

---

## 1. Portal connection states

The `portalUiStatus(status, policyDecision)` fold has six UI states
(`DATA_BINDING_PLAN.md` §5.1). The prototype supplies only „Verbunden“ and „Anmeldung erneut nötig“;
the other four are new. The pending state is what a row actually shows after „Einbeziehen“, which
inserts a `draft` row an operator has to review before it can ever be used.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `settings.sources.status.disabled` | Nicht verfügbar | Not available | Settings → Quellen & Zugänge, source row status text | `status === "disabled"` or `policyDecision === "prohibited"`. Grey dot. Wording taken from the plan's own proposal | PROPOSED |
| `settings.sources.status.loginNeeded` | Anmeldung nötig | Sign-in needed | same row | `status === "needs_auth"`. Amber dot. ⚠ the same German string already exists at `settings.sources.more.state.loginNeeded` for a different axis — keep both keys, they can drift | PROPOSED |
| `settings.sources.status.paused` | Pausiert | Paused | same row | `status === "paused"`, set by `portalConnections.pauseMine`. Grey dot | PROPOSED |
| `settings.sources.status.notConnected` | Noch nicht verbunden | Not connected yet | same row | `status === "draft"` and everything else. Grey dot | PROPOSED |
| `settings.sources.status.pendingReview` | Angefragt. Diese Quelle wird geprüft, bevor du dich anmelden kannst. | Requested. This source is reviewed before you can sign in. | Settings → Quellen & Zugänge, the row created by „Einbeziehen“ | Replaces the login button entirely — there is nothing for the user to do here. Do not present „Einbeziehen“ as if it connected the source | PROPOSED |

---

## 2. Scout mailbox states

`mailboxes.getMine` returns five states, not two (`DATA_BINDING_PLAN.md` §5.1). The address block
already has `settings.sources.address.title/value/hint/copy/copied`; these are the state lines
around it.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `settings.sources.address.state.none` | Wird bei der ersten Anfrage erstellt | Created with your first request | Settings → Quellen & Zugänge, in place of the address | `mailboxes.getMine === null`. No retry control, no error framing — nothing has gone wrong | PROPOSED |
| `settings.sources.address.state.provisioning` | Wird eingerichtet … | Setting it up … | same slot | `status === "provisioning"`. Ellipsis is the single character `…` | PROPOSED |
| `settings.sources.address.state.active` | *(reuses `settings.sources.address.value` + `.copy`)* | *(same)* | same slot | `status === "active"` — the real address plus „Kopieren“. Listed for completeness; no new German string | PROPOSED |
| `settings.sources.address.state.failed` | Die Scout-Adresse konnte nicht eingerichtet werden. | Your Scout address could not be set up. | same slot | `status === "failed"`. ⚠ never render `mailbox.lastError` (§7.3 rule 4) | PROPOSED |
| `settings.sources.address.retry` | Erneut versuchen | Try again | button under the failed state | Calls `mailboxes.ensureMine()`, which can itself come back `failed` | PROPOSED |
| `settings.sources.address.state.disabled` | Diese Scout-Adresse ist deaktiviert. | This Scout address is switched off. | same slot | `status === "disabled"`. No retry button — a retry would not help | PROPOSED |

---

## 3. Action-request outcomes and the drafted affordance

`DATA_BINDING_PLAN.md` §4.4.2: five `actionRequests` statuses had no treatment anywhere, and §7.3
rule 1 forbids a send disappearing without a user-visible outcome. §4.4.0 adds the `drafted` case,
which is an affordance rather than an outcome. The card survives a stage change and stays until the
user dismisses it.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `scout.autopilot.outcome.overline` | ANFRAGE BEENDET | REQUEST CLOSED | Overline on the outcome card, autopilot screen | Uppercase overline per the design system. Covers all four terminal statuses | PROPOSED |
| `scout.autopilot.outcome.rejected` | Du hast die Anfrage abgelehnt. Nichts wurde gesendet. | You rejected the request. Nothing was sent. | outcome card, `status === "rejected"` | Reached by „Ablehnen“ on the approval card | PROPOSED |
| `scout.autopilot.outcome.cancelled` | Du hast abgebrochen. Nichts wurde gesendet. | You cancelled. Nothing was sent. | outcome card, `status === "cancelled"` | `confirmHumanCompleted({ submitted: false })` | PROPOSED |
| `scout.autopilot.outcome.failed` | Es hat nicht geklappt. Nichts wurde gesendet. | It did not work. Nothing was sent. | outcome card, `status === "failed"` | ⚠ never render `request.error` (§7.3 rule 4). The user learns that it failed, not how | PROPOSED |
| `scout.autopilot.outcome.expired` | Die Anfrage ist nicht mehr aktuell. Nichts wurde gesendet. | The request is out of date. Nothing was sent. | outcome card, `status === "expired"` | Context changed under it, or the review window elapsed | PROPOSED |
| `scout.autopilot.outcome.retry` | Neu vorbereiten | Prepare it again | button on the `rejected` and `expired` cards | Verb-first. Not offered on `failed` or `cancelled` until the cause is known | PROPOSED |
| `scout.autopilot.outcome.dismiss` | Ausblenden | Dismiss | secondary control on the outcome card | The card is dismissed in per-session state (`DECISIONS.md` item 34) | PROPOSED |
| `scout.autopilot.drafted.text` | Ich habe eine Anfrage vorbereitet. Sag mir, wann sie rausgehen soll. | I have prepared a request. Tell me when it should go out. | autopilot screen, `status === "drafted"` | §4.4.0 — a `drafted` row produces no approval card, so without this the request is invisible | PROPOSED |
| `scout.autopilot.drafted.submit` | Anfrage vorlegen | Submit the request | button next to it | Calls `externalActions.submit`. ⚠ this is not a send: the returned status decides the next screen | PROPOSED |
| `scout.status.awaitingSubmit` | Ich habe eine Anfrage vorbereitet und lege sie dir gleich vor. | I have prepared a request and will put it to you shortly. | derived status line while a `drafted` row exists | Sits alongside the existing `scout.autopilot.status.prepared`, which covers `awaiting_approval` | PROPOSED |
| `scout.autopilot.status.queued` | Ich prüfe den Text noch einmal, bevor etwas rausgeht. | I am checking the text once more before anything goes out. | status line, `submit` returned `queued` | §4.4.0 — no card, no send. The plan's own draft was „Ich prüfe den Text noch einmal.“; extended so it names the consequence | PROPOSED |
| `scout.autopilot.status.approvedByMandate` | Von deinem Handlungsspielraum gedeckt. Ich schicke die Anfrage raus. | Covered by your Autopilot. I am sending the request. | autopilot card, `submit` returned `approved` | ⚠ this one **is** a send, so it must not carry „Nichts wurde gesendet.“ | PROPOSED |

---

## 4. Candidate cards — contact eligibility, budget, area, demo provenance

`DECISIONS.md` items 26, 28 and 60, and `DATA_BINDING_PLAN.md` §4.7. Three of these five rows have
German already; only the English pair is new for those.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `scout.candidates.noContact` | Für diesen Raum ist noch kein Kontaktweg geprüft. | No contact route has been checked for this room yet. | Candidate card, in place of „Diesen Raum anfragen“ | `match.contactEligible === false`. The card renders **without** the primary CTA — do not wire the button and let it fail later | PROPOSED |
| `scout.candidates.budget.over` | Über eurem Budget ({budget} €) | Over your budget ({budget} €) | Candidate card, amber budget line | **DE exists** (`scout.ts` `candidates.budget.over`). Amber `#e0a13a`, the variant the prototype computes and never renders | PROPOSED |
| `scout.candidates.area.outside` | Außerhalb eures Suchgebiets | Outside your search area | Candidate card, next to the location row | New in both languages. The `outside` marker is computed and dropped in the prototype; today the only cue is demo prose in `note` | PROPOSED |
| `scout.candidates.photo.pending` | Foto folgt vom Anbieter | Photo to follow from the provider | Candidate card and offer card media cell | **DE exists** (`scout.ts` `candidates.photo.pending` and `offer.photo.pending`). ⚠ `DATA_BINDING_PLAN.md` §4.7 says to hide the media cell for candidates rather than imply a photo is coming, while `DECISIONS.md` item 28 keeps the placeholder for the review card. Please settle which surfaces use it | PROPOSED |
| `scout.signal.demoSource` | Kontrollierte Demo-Quelle | Controlled demo source | Badge on every surface a signal appears: candidate card, offer, acceptance review, map | New in both languages. `signal.isDemo === true`. Load-bearing: an unbadged demo signal next to a real one is the failure the rules forbid | PROPOSED |

---

## 5. Completion

`DECISIONS.md` item 30. The prototype subline is false in the real app, where an acceptance really
is sent.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `scout.complete.subline` | Deine Zusage ist unterwegs zum Anbieter. Ich schicke euch die Bestätigung, sobald sie da ist. | Your acceptance is on its way to the provider. I will send you the confirmation as soon as it arrives. | Complete stage, under the headline | Replaces „Demo abgeschlossen — es wurde keine echte Zusage versendet.“ Note the register split: **deine** Zusage (only you can commit), **euch** die Bestätigung (the band gets told) | PROPOSED |

⚠ The headline above it, „Euer nächster Proberaum steht bereit.“, is still open — it overstates a
*sent* acceptance in the same way the old subline understated it. That is `DATA_BINDING_PLAN.md`
§11 Q5 and is not decided, so no replacement is proposed here.

---

## 6. Voice session cap

`DECISIONS.md` item 32: a warning in the last minute, then a graceful end that lands on the existing
„Gespräch beendet“ state. `useRealtimeVoiceScout` disconnects unconditionally 15 minutes after
`connectedAt`. No countdown is shown from the start.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `scout.voice.cap.warning` | Noch etwa eine Minute, dann beende ich das Gespräch. Alles Besprochene bleibt gespeichert. | About a minute left, then I will end the conversation. Everything we discussed stays saved. | Hint bar over the voice controls, from minute 14 | Appears once, not as a ticking counter — a countdown would read as telemetry | PROPOSED |
| `scout.voice.cap.ended` | Ich habe das Gespräch nach 15 Minuten beendet. Eure Wünsche bleiben als Entwurf gespeichert. | I ended the conversation after 15 minutes. Your notes stay saved as a draft. | The „Gespräch beendet“ state, replacing `scout.discovery.ended.text` for this one cause | The existing „Gespräch fortsetzen“ and „Suchauftrag ansehen“ controls stay as they are | PROPOSED |

---

## 7. Language switching

`DECISIONS.md` items 18 and 51: German is the unconditional default, and the toggle lives in the
profile menu and in the landing header. The settings row is the third place the choice is visible.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `settings.profile.language.label` | Sprache | Language | Settings → Profil, row label | A row in the profile page, below „Anzeigename“ | PROPOSED |
| `settings.profile.language.de` | Deutsch | German | same row, option | ⚠ the option labels are endonyms in the source: see the note under this table | PROPOSED |
| `settings.profile.language.en` | English | English | same row, option | Deliberately „English“, not „Englisch“ | PROPOSED |
| `settings.profile.language.aria` | Sprache wählen | Choose language | same row, `aria-label` on the control | | PROPOSED |
| `common.language.toggleAria` | Sprache wechseln | Switch language | `aria-label` on the header and profile-menu toggle | One key for both places, since the control is the same | PROPOSED |
| `common.language.shortDe` | DE | DE | Toggle label, German active | Two letters, uppercase, unchanged between languages | PROPOSED |
| `common.language.shortEn` | EN | EN | Toggle label, English active | | PROPOSED |

The option labels are endonyms on purpose: „Deutsch“ and „English“ each read in their own language,
so the row is legible whichever language is active. If you would rather have them translated
(„Deutsch“ / „Englisch“ in DE, "German" / "English" in EN), say so and the EN column changes to
"German" / "English" while the DE column stays.

---

## 8. Navigation sheets and their labels

`DECISIONS.md` item 8 gives the landing a `Sheet` navigation below 880 px; items 6 and 7 give
Settings and Operator a page picker below 900 px. None of these controls exist in the prototype, so
none has a label.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `landing.header.nav.openAria` | Menü öffnen | Open menu | Landing header, sheet trigger below 880 px | Icon-only button, so the `aria-label` is the only name it has | PROPOSED |
| `landing.header.nav.closeAria` | Menü schließen | Close menu | Landing nav sheet, close button | | PROPOSED |
| `settings.nav.pickerAria` | Seite wählen | Choose page | Settings, page-picker trigger below 900 px | Beyond the brief, but item 6 creates the control and it needs a name | PROPOSED |
| `operator.nav.pickerAria` | Seite wählen | Choose page | Operator, page-picker trigger below 900 px | Same control, same wording. Item 7 inherits the Settings pattern | PROPOSED |

---

## 9. Operator

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `operator.tasks.t2.detail.expired` | Die gespeicherte Anmeldung ist abgelaufen. Private Portalnachrichten können momentan nicht gelesen werden. Die Suche nach Anzeigen läuft weiter. | The stored sign-in has expired. Private portal messages cannot be read at the moment. Listing discovery continues. | Operator → Aufträge, detail for „Portal-Nachrichten lesen“ in the expired state | `DECISIONS.md` item 42. Assembled verbatim from the Diagnose sheet's `diag.text.cause` and `diag.text.impact`, so the two surfaces cannot drift. The prototype value is an empty string. ⚠ **accepting this row is a shape change** — see the paragraph under this table | PROPOSED |
| `operator.sources.check.renewed` | Heute, {time} | Today, {time} | Operator → Quellen, „Letzter Demo-Check“ column | **DE exists** (`operator.ts` `sources.check.renewed`). `DECISIONS.md` item 44: one `Intl` formatter with `hour12: false` for both locales, so English shows „Today, 9:41“ and never „9:41 AM“. ⚠ two doc corrections below | PROPOSED |

⚠ **`operator.tasks.t2.detail.expired` cannot be added on its own.** The key space holds both
`tasks.t2.detail` (a string that ships today) and `tasks.t2.detail.expired`, and a TypeScript object
cannot be both a leaf and a namespace. Accepting the row therefore means restructuring `t2.detail`
into `{ default, expired }`, mirroring the `t3.detail` shape that already exists — which renames the
shipped path `operator.tasks.t2.detail` to `operator.tasks.t2.detail.default` and invalidates every
component and `en.ts` reference written against the old path. Both edits belong in one step. The
same instruction is recorded as a `PENDING SHAPE CHANGE` comment beside the key in
`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/copy/de/operator.ts`, so whoever
lands the copy sees it there too. Until it lands, the expanded Aufträge row renders a blank detail
stripe in the incident state.

⚠ **Two corrections to sibling documents, found while pairing the time string.** First, „Letzter
Demo-Check“ is a column on the **Quellen** page (`OPERATOR_SCREENS.md` §6), not on Betrieb im Blick
— `DECISIONS.md` item 44's consequence line cites §5, and the key is `sources.check.renewed`.
Second, item 44 mandates `hour12: false`, but the `Intl` option lists in `OPERATOR_SCREENS.md` §17.5
and `COMPONENT_MAP.md` §6.3 still read `{ hour: 'numeric', minute: '2-digit' }` and carry the
example "Today, 9:41 AM". Item 44 overrides both; the option lists and that example need updating.
The override is already annotated beside the key in `operator.ts`.

---

## 10. Settings — privacy plural

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `settings.privacy.portals.sub.other` | {n} verbundene Portalzugänge, simuliert | {n} connected portal accounts, simulated | Settings → Datenschutz, Portalzugänge row | The existing string is singular-only and becomes `.one`; this is the missing `.other`. ⚠ `DATA_BINDING_PLAN.md` §5.7 drops „simuliert“ once the row counts real active connections — if you take that, both forms lose the word and the English loses ", simulated" | PROPOSED |

---

## 11. Error code map (`common.errors.*`)

`DECISIONS.md` item 14 and `DATA_BINDING_PLAN.md` §7.3. Today only the Scout page humanises errors;
every other screen renders the raw `ConvexError` payload, so a user can see `INCOMPLETE_NEED`
verbatim. One `errorCopy(code, lang)` map replaces that. Every code the plan lists gets a pair
below, plus the generic fallback and the rate-limit line.

Rules the wording follows:

1. Everything in the send, approval and acceptance families ends with „Nichts wurde gesendet.“
2. Provider and model text is never surfaced. No code name, no HTTP status, no raw message.
3. Errors render inline next to the control that failed, so the line names the thing, not the screen.
4. The Scout speaks as **ich** wherever it is the Scout that could not act.

⚠ **Three rows deliberately break rule 1**, because the sentence would be a lie: `ALREADY_DECIDED`
(a decision exists, and it may have been an approval that was sent), `HUMAN_EXECUTION_NOT_CONFIRMABLE`
(the person may well have submitted the form) and `scout.autopilot.status.approvedByMandate` in
group 3 (that one really is a send). They are marked in the Note column. Please confirm.

⚠ **The acceptance family says „Nichts wurde gesendet.“ per rule 1**, but „Es wurde nichts zugesagt.“
would be the more meaningful sentence for a commitment. Say which you prefer and the whole
acceptance block changes together.

### 11.1 Search, need and match

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.INCOMPLETE_NEED` | Für diesen Schritt fehlen noch Angaben zu eurer Suche. | Some details of your search are still missing for this step. | Brief review, autopilot start | | PROPOSED |
| `common.errors.NEED_NOT_FOUND` | Diesen Suchauftrag gibt es nicht mehr. | This search no longer exists. | Any need-bound control | | PROPOSED |
| `common.errors.NEED_ARCHIVED` | Dieser Suchauftrag ist archiviert. Aktiviere ihn, um weiterzumachen. | This search is archived. Reactivate it to continue. | Brief, Settings → Quellen | | PROPOSED |
| `common.errors.NEED_REQUIRED` | Dafür brauche ich zuerst einen Suchauftrag. | I need a search before I can do this. | Settings → Quellen, empty state | | PROPOSED |
| `common.errors.INVALID_FIELD` | Diese Angabe kann ich so nicht übernehmen. | I cannot use this entry. | Inline at the field | ⚠ carries a `field` payload; route on it and prefer the two rows below | PROPOSED |
| `common.errors.INVALID_FIELD.title` | Gib eurem Suchauftrag einen Namen. | Give your search a name. | Inline at the title field | `field === "title"` | PROPOSED |
| `common.errors.INVALID_FIELD.city` | Sag mir, in welcher Stadt ich suchen soll. | Tell me which city to search in. | Inline at the city field | `field === "city"` | PROPOSED |
| `common.errors.INVALID_BUDGET` | Dieses Budget kann ich so nicht übernehmen. | I cannot use this budget. | Inline at the budget field | | PROPOSED |
| `common.errors.INVALID_LIMIT` | So viele Einträge kann ich nicht auf einmal laden. | I cannot load that many entries at once. | Lists with a page size | Should never reach a user; kept for completeness | PROPOSED |
| `common.errors.MATCH_NOT_FOUND` | Diesen Treffer gibt es nicht mehr. | This match no longer exists. | Candidate card | | PROPOSED |
| `common.errors.MATCH_NO_LONGER_CURRENT` | Dieser Treffer ist nicht mehr aktuell. | This match is out of date. | Candidate card, then remove the card | Wording taken from `DATA_BINDING_PLAN.md` §4.7 | PROPOSED |
| `common.errors.PLATFORM_NOT_AVAILABLE` | Diese Quelle ist derzeit nicht verfügbar. | This source is not available right now. | Settings → Quellen, leave the toggle off | Wording taken from §5.1 | PROPOSED |
| `common.errors.PLATFORM_NOT_FOUND` | Diese Quelle kenne ich nicht. | I do not know this source. | Settings → Quellen | | PROPOSED |
| `common.errors.OPPORTUNITY_NOT_FOUND` | Dieses Gespräch mit dem Anbieter gibt es nicht mehr. | This provider conversation no longer exists. | Clarification, offer | | PROPOSED |
| `common.errors.OPPORTUNITY_NO_LONGER_MATCHES` | Dieser Raum passt nicht mehr zu eurer Suche. | This room no longer matches your search. | Clarification, offer | | PROPOSED |
| `common.errors.INVALID_SUMMARY` | Diese Zusammenfassung kann ich so nicht speichern. | I cannot save this summary. | Brief review | | PROPOSED |
| `common.errors.HANDOFF_NOT_FOUND` | Diese Übergabe gibt es nicht mehr. | This handover no longer exists. | Offer review | | PROPOSED |

### 11.2 Scout thread and voice

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.THREAD_NOT_FOUND` | Dieses Gespräch gibt es nicht mehr. | This conversation no longer exists. | Conversation, composer | | PROPOSED |
| `common.errors.SIGNAL_NOT_FOUND` | Diese Anzeige gibt es nicht mehr. | This listing no longer exists. | Candidate card, detail page | | PROPOSED |
| `common.errors.SIGNAL_REQUIRED` | Dafür brauche ich zuerst eine Anzeige. | I need a listing for this step. | „Diesen Raum anfragen“ | | PROPOSED |
| `common.errors.INVALID_MESSAGE` | Diese Nachricht kann ich so nicht annehmen. | I cannot take this message. | Composer, side-note composer | Not a send failure — this is a message to the Scout | PROPOSED |
| `common.errors.SCOUT_CONTEXT_REQUIRED` | Mir fehlt der Zusammenhang für diesen Schritt. | I am missing the context for this step. | Composer after a focus change | | PROPOSED |
| `common.errors.NEED_AND_SIGNAL_REQUIRED` | Dafür brauche ich einen Suchauftrag und eine Anzeige. | I need both a search and a listing for this. | „Diesen Raum anfragen“ | | PROPOSED |
| `common.errors.INVALID_TOOL_ARGUMENTS` | Dieser Schritt hat nicht geklappt. Versuche es noch einmal. | This step did not work. Try it again. | Conversation | Deliberately vague: the detail is a tool payload | PROPOSED |
| `common.errors.INVALID_TRANSCRIPT` | Diese Mitschrift kann ich so nicht speichern. | I cannot save this transcript. | Voice, on disconnect | | PROPOSED |
| `common.errors.VOICE_SESSION_NOT_FOUND` | Dieses Gespräch läuft nicht mehr. | This voice session is no longer running. | Voice controls | | PROPOSED |
| `common.errors.VOICE_SESSION_NOT_ACTIVE` | Das Gespräch ist schon beendet. | The voice session has already ended. | Voice controls | | PROPOSED |

### 11.3 Handlungsspielraum (mandate)

The English term for „Handlungsspielraum“ is proposed as **Autopilot**, matching the shipped English
strings ("Covered by Autopilot", "Autopilot never authorizes terms, contracts, bookings, payments,
deposits, passwords, 2FA, or CAPTCHA"). If you want a closer translation, every EN row in this block
changes together.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.MANDATE_NOT_FOUND` | Diesen Handlungsspielraum gibt es nicht mehr. | This Autopilot setting no longer exists. | Settings → Handlungsspielraum | | PROPOSED |
| `common.errors.MANDATE_CONTENT_CHANGED` | Dein Handlungsspielraum hat sich geändert. Nichts wurde gespeichert. | Your Autopilot settings changed. Nothing was saved. | Settings → Handlungsspielraum, on save | ⚠ thrown by `mandates.activate` only — not by the approval card | PROPOSED |
| `common.errors.MANDATE_CHANGED` | Dein Handlungsspielraum hat sich zwischenzeitlich geändert. Sieh ihn dir noch einmal an. | Your Autopilot settings changed in the meantime. Please look at them again. | Approval card, Settings | | PROPOSED |
| `common.errors.MANDATE_NO_LONGER_AUTHORIZES` | Dein Handlungsspielraum deckt diesen Schritt nicht mehr. Nichts wurde gesendet. | Your Autopilot no longer covers this step. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.MANDATE_SNAPSHOT_MISSING` | Zu diesem Handlungsspielraum fehlt der gespeicherte Stand. | The saved version of this Autopilot setting is missing. | Approval card | | PROPOSED |
| `common.errors.INVALID_MANDATE_STATE` | In diesem Zustand lässt sich der Handlungsspielraum nicht ändern. | The Autopilot settings cannot be changed in this state. | Settings → Handlungsspielraum | | PROPOSED |
| `common.errors.INVALID_MANDATE_EXPIRY` | Dieses Enddatum kann ich so nicht übernehmen. | I cannot use this end date. | Inline at the expiry control | | PROPOSED |
| `common.errors.INVALID_CONTACT_LIMIT` | Diese Zahl an Anfragen kann ich so nicht übernehmen. | I cannot use this number of requests. | Inline at the contact stepper | | PROPOSED |
| `common.errors.INVALID_BROWSER_LIMIT` | Diese Zeitgrenze für Portalzugriffe kann ich so nicht übernehmen. | I cannot use this portal time limit. | Inline at „Weitere Grenzen“ | | PROPOSED |
| `common.errors.INVALID_PRICE_LIMIT` | Diese Preisgrenze kann ich so nicht übernehmen. | I cannot use this price limit. | Inline at the price control | | PROPOSED |
| `common.errors.MODE_CANNOT_AUTHORIZE_EXTERNAL_ACTIONS` | In diesem Arbeitsmodus darf ich nichts nach außen senden. Nichts wurde gesendet. | In this working mode I may not send anything out. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.MANDATE_COMMITMENT_BOUNDARY_REQUIRED` | Zusagen brauchen immer deine ausdrückliche Freigabe. Diese Grenze lässt sich nicht abschalten. | Commitments always need your explicit approval. This boundary cannot be switched off. | Settings → Handlungsspielraum | The one hard boundary the product never lets go of | PROPOSED |

### 11.4 Approval and execution

Every line in this block ends with „Nichts wurde gesendet.“ except the two marked deviations.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.ACTION_NOT_FOUND` | Diese Anfrage gibt es nicht mehr. Nichts wurde gesendet. | This request no longer exists. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.INVALID_ACTION_STATE` | Diese Anfrage ist nicht mehr in diesem Zustand. Nichts wurde gesendet. | This request is no longer in that state. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.ACTION_CONTENT_CHANGED` | Die Nachricht hat sich geändert. Nichts wurde gesendet. | The message changed. Nothing was sent. | Approval card, replaces the card plus a re-read button | Wording taken from `DATA_BINDING_PLAN.md` §4.4.1. This is what `externalActions.decide` throws | PROPOSED |
| `common.errors.ACTION_PAYLOAD_MISMATCH` | Der Inhalt stimmt nicht mehr mit dem überein, was du gesehen hast. Nichts wurde gesendet. | The content no longer matches what you saw. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.ACTION_NOT_APPROVED` | Diese Anfrage ist noch nicht freigegeben. Nichts wurde gesendet. | This request is not approved yet. Nothing was sent. | Approval card, execution controls | | PROPOSED |
| `common.errors.ACTION_NOT_EXECUTABLE` | Diese Anfrage lässt sich gerade nicht ausführen. Nichts wurde gesendet. | This request cannot be carried out right now. Nothing was sent. | Execution controls | | PROPOSED |
| `common.errors.ACTION_NOT_EXECUTING` | Diese Anfrage läuft gerade nicht. Nichts wurde gesendet. | This request is not running. Nothing was sent. | Live View, cancel control | | PROPOSED |
| `common.errors.ACTION_EXPIRED` | Die Anfrage ist nicht mehr aktuell. Nichts wurde gesendet. | The request is out of date. Nothing was sent. | Approval card | Same line as the `expired` outcome in group 3, on purpose | PROPOSED |
| `common.errors.ACTION_SEARCH_CHANGED` | Euer Suchauftrag hat sich geändert. Nichts wurde gesendet. | Your search changed. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.ACTION_SIGNAL_CHANGED` | Die Anzeige hat sich geändert. Nichts wurde gesendet. | The listing changed. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.ACTION_FIELD_TOO_LARGE` | Ein Feld ist zu lang. Nichts wurde gesendet. | One field is too long. Nothing was sent. | Approval card, web form payload | | PROPOSED |
| `common.errors.ACTION_PAYLOAD_TOO_LARGE` | Die Nachricht ist zu lang. Nichts wurde gesendet. | The message is too long. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.INVALID_ACTION_DESTINATION` | Dieses Ziel kann ich nicht anschreiben. Nichts wurde gesendet. | I cannot write to this destination. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.INVALID_ACTION_FIELDS` | Diese Formularangaben kann ich so nicht senden. Nichts wurde gesendet. | I cannot send these form entries. Nothing was sent. | Approval card, web form payload | | PROPOSED |
| `common.errors.INVALID_ACTION_FIELD_NAME` | Ein Feldname passt nicht zum Formular. Nichts wurde gesendet. | One field name does not match the form. Nothing was sent. | Approval card, web form payload | | PROPOSED |
| `common.errors.INVALID_ACTION_TYPE` | Diesen Schritt kann ich nicht ausführen. Nichts wurde gesendet. | I cannot carry out this step. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.EXECUTION_NOT_FOUND` | Zu diesem Schritt finde ich keinen Lauf. Nichts wurde gesendet. | I cannot find a run for this step. Nothing was sent. | Live View, completion control | | PROPOSED |
| `common.errors.EXECUTION_NOT_CLAIMED` | Dieser Lauf wurde nie gestartet. Nichts wurde gesendet. | This run was never started. Nothing was sent. | Live View | | PROPOSED |
| `common.errors.EXECUTION_DOMAIN_CHANGED` | Das Portal hat unterwegs die Adresse gewechselt. Ich habe abgebrochen, nichts wurde gesendet. | The portal changed address mid-run. I stopped, and nothing was sent. | Live View | A safety stop, not a defect — the line says so | PROPOSED |
| `common.errors.EXECUTION_POLICY_CHANGED` | Die Regeln für dieses Portal haben sich geändert. Ich habe abgebrochen, nichts wurde gesendet. | The rules for this portal changed. I stopped, and nothing was sent. | Live View | | PROPOSED |
| `common.errors.ALREADY_DECIDED` | Darüber hast du schon entschieden. Ich zeige dir den aktuellen Stand. | You have already decided this. I will show you where it stands. | Approval card | ⚠ **deviates from rule 1 on purpose.** The earlier decision may have been an approval that was sent, so „Nichts wurde gesendet.“ could be false | PROPOSED |
| `common.errors.APPROVAL_MISMATCH` | Diese Freigabe passt nicht zur Anfrage. Nichts wurde gesendet. | This approval does not match the request. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.APPROVAL_REQUIRED` | Dafür brauche ich deine Freigabe. Nichts wurde gesendet. | I need your approval for this. Nothing was sent. | Approval card, execution controls | | PROPOSED |
| `common.errors.EXTERNAL_APPROVAL_REQUIRED` | Dieser Schritt geht nach außen und braucht deine ausdrückliche Freigabe. Nichts wurde gesendet. | This step leaves the app and needs your explicit approval. Nothing was sent. | Approval card | | PROPOSED |
| `common.errors.HUMAN_EXECUTION_NOT_CONFIRMABLE` | Dieser Schritt lässt sich gerade nicht als erledigt bestätigen. | This step cannot be confirmed as done right now. | Human completion control | ⚠ **deviates from rule 1 on purpose.** The person may well have submitted the form; claiming nothing was sent would be a lie | PROPOSED |
| `common.errors.INTERACTION_NOT_FOUND` | Zu diesem Schritt finde ich keinen Vorgang. Nichts wurde gesendet. | I cannot find this interaction. Nothing was sent. | Live View, completion control | | PROPOSED |

### 11.5 Email drafts

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.DRAFT_NOT_FOUND` | Diesen Entwurf gibt es nicht mehr. Nichts wurde gesendet. | This draft no longer exists. Nothing was sent. | Approval composer | | PROPOSED |
| `common.errors.DRAFT_CONTENT_CHANGED` | Der Entwurf hat sich geändert. Nichts wurde gesendet. | The draft changed. Nothing was sent. | Approval composer | The `outreach` counterpart of `ACTION_CONTENT_CHANGED` | PROPOSED |
| `common.errors.DRAFT_LOCKED` | Dieser Entwurf geht gerade raus. Nichts wurde doppelt gesendet. | This draft is going out right now. Nothing was sent twice. | Approval composer | | PROPOSED |
| `common.errors.INVALID_DRAFT_STATE` | Dieser Entwurf ist nicht mehr in diesem Zustand. Nichts wurde gesendet. | This draft is no longer in that state. Nothing was sent. | Approval composer | | PROPOSED |
| `common.errors.INVALID_RECIPIENT` | Diese Empfängeradresse kann ich so nicht anschreiben. Nichts wurde gesendet. | I cannot write to this recipient address. Nothing was sent. | Inline at the recipient field | | PROPOSED |
| `common.errors.INVALID_SUBJECT` | Diesen Betreff kann ich so nicht senden. Nichts wurde gesendet. | I cannot send this subject line. Nothing was sent. | Inline at the subject field | | PROPOSED |
| `common.errors.INVALID_BODY` | Diesen Nachrichtentext kann ich so nicht senden. Nichts wurde gesendet. | I cannot send this message text. Nothing was sent. | Inline at the message field | | PROPOSED |

### 11.6 Offer acceptance

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.OFFER_NOT_FOUND` | Dieses Angebot gibt es nicht mehr. Nichts wurde gesendet. | This offer no longer exists. Nothing was sent. | Offer review | | PROPOSED |
| `common.errors.OFFER_NOT_READY` | Dieses Angebot ist noch nicht vollständig. Nichts wurde gesendet. | This offer is not complete yet. Nothing was sent. | Offer review | | PROPOSED |
| `common.errors.OFFER_CHANGED` | Das Angebot hat sich geändert. Nichts wurde gesendet. | The offer changed. Nothing was sent. | Offer review, then re-read | | PROPOSED |
| `common.errors.OFFER_ACTION_CONFLICT` | Zu diesem Angebot läuft schon ein anderer Schritt. Nichts wurde gesendet. | Another step is already running for this offer. Nothing was sent. | Offer review | | PROPOSED |
| `common.errors.CONTROLLED_PORTAL_THREAD_REQUIRED` | Zusagen gehen nur über ein bestätigtes Portalgespräch. Nichts wurde gesendet. | Acceptances only go through a confirmed portal conversation. Nothing was sent. | Offer review | | PROPOSED |
| `common.errors.ACCEPTANCE_NOT_REVIEWABLE` | Diese Zusage lässt sich gerade nicht prüfen. Nichts wurde gesendet. | This acceptance cannot be reviewed right now. Nothing was sent. | Offer review | | PROPOSED |
| `common.errors.ACCEPTANCE_CONTENT_CHANGED` | Der Text der Zusage hat sich geändert. Nichts wurde gesendet. | The text of the acceptance changed. Nothing was sent. | Acceptance dialog | | PROPOSED |
| `common.errors.ACCEPTANCE_CONTEXT_CHANGED` | Der Zusammenhang der Zusage hat sich geändert. Nichts wurde gesendet. | The context of the acceptance changed. Nothing was sent. | Acceptance dialog | | PROPOSED |
| `common.errors.ACCEPTANCE_DESTINATION_CHANGED` | Der Empfänger der Zusage hat sich geändert. Nichts wurde gesendet. | The recipient of the acceptance changed. Nothing was sent. | Acceptance dialog | | PROPOSED |
| `common.errors.ACCEPTANCE_EXPIRED` | Die Zusage ist nicht mehr aktuell. Nichts wurde gesendet. | The acceptance is out of date. Nothing was sent. | Acceptance dialog | ⚠ the real code is `ACCEPTANCE_EXPIRED`; there is no `EXPIRED` code anywhere. Do not key on a substring | PROPOSED |
| `common.errors.ACCEPTANCE_APPROVAL_MISMATCH` | Deine Freigabe passt nicht zu dieser Zusage. Nichts wurde gesendet. | Your approval does not match this acceptance. Nothing was sent. | Acceptance dialog | | PROPOSED |
| `common.errors.ACCEPTANCE_REVIEW_REQUIRED` | Diese Zusage musst du zuerst prüfen. Nichts wurde gesendet. | You have to review this acceptance first. Nothing was sent. | Acceptance dialog | Also thrown when an acceptance is pushed through `externalActions.submit` | PROPOSED |
| `common.errors.ANOTHER_ACCEPTANCE_IN_PROGRESS` | Es läuft schon eine andere Zusage. Nichts wurde gesendet. | Another acceptance is already in progress. Nothing was sent. | Acceptance dialog | | PROPOSED |
| `common.errors.ACCEPTANCE_MESSAGE_TOO_LONG` | Die Nachricht zur Zusage ist zu lang. Nichts wurde gesendet. | The acceptance message is too long. Nothing was sent. | Inline at the message field | | PROPOSED |
| `common.errors.ACCEPTANCE_RECEIPT_REQUIRED` | Zu dieser Zusage fehlt noch der Nachweis. Nichts wurde gesendet. | The record for this acceptance is still missing. Nothing was sent. | Acceptance dialog | | PROPOSED |

### 11.7 Portal access and Live View

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.CONNECTION_NOT_FOUND` | Diesen Portalzugang gibt es nicht mehr. | This portal account no longer exists. | Connection sheet | | PROPOSED |
| `common.errors.CONNECTION_NOT_ACTIVE` | Dieser Zugang ist gerade nicht aktiv. | This account is not active right now. | Connection sheet | ⚠ near-duplicate of the next row; the two could share one string if you prefer | PROPOSED |
| `common.errors.PORTAL_CONNECTION_NOT_ACTIVE` | Dieser Portalzugang ist nicht aktiv. Verbinde ihn zuerst. | This portal account is not active. Connect it first. | Settings → Quellen, approval card | | PROPOSED |
| `common.errors.PORTAL_CONNECTION_NOT_READY` | Dieser Portalzugang ist noch nicht bereit. | This portal account is not ready yet. | Settings → Quellen | | PROPOSED |
| `common.errors.PORTAL_CONNECTION_REQUIRED` | Dafür brauche ich einen Portalzugang. | I need a portal account for this. | Approval card | | PROPOSED |
| `common.errors.PORTAL_REAUTH_REQUIRED` | Dieser Portalzugang braucht eine neue Anmeldung. | This portal account needs a new sign-in. | Settings → Quellen, autopilot blocker | Pairs with the existing „Anmeldung erneut nötig“ status | PROPOSED |
| `common.errors.PORTAL_POLICY_REQUIRED` | Für dieses Portal fehlt noch die Freigabe der Betreiber. | This portal has not been cleared by the operators yet. | Settings → Quellen | | PROPOSED |
| `common.errors.PORTAL_CIRCUIT_OPEN` | Dieses Portal macht gerade Probleme. Ich versuche es später noch einmal. | This portal is having trouble. I will try again later. | Autopilot status, Settings → Quellen | The Scout keeps the job; the user does not have to act | PROPOSED |
| `common.errors.BROWSER_SOURCE_NOT_ELIGIBLE` | Diese Quelle lässt sich nicht anbinden. | This source cannot be connected. | „Einbeziehen“ in „Weitere Quellen“ | | PROPOSED |
| `common.errors.BROWSER_SESSION_BUSY` | Für dieses Portal läuft schon ein Zugriff. Warte einen Moment. | A session for this portal is already running. Give it a moment. | Connection sheet, Live View | | PROPOSED |
| `common.errors.BROWSER_CONCURRENCY_LIMIT` | Gerade laufen zu viele Portalzugriffe. Ich versuche es gleich noch einmal. | Too many portal sessions are running. I will try again shortly. | Connection sheet, Live View | | PROPOSED |
| `common.errors.BROWSERBASE_NOT_CONFIGURED` | Portalzugriffe sind gerade nicht eingerichtet. | Portal access is not set up right now. | Connection sheet | Also visible in Operator → Integrationen | PROPOSED |
| `common.errors.LIVE_VIEW_NOT_AVAILABLE` | Die Live-Ansicht ist gerade nicht verfügbar. | The live view is not available right now. | Run page | | PROPOSED |
| `common.errors.WRITE_LIVE_VIEW_NOT_AVAILABLE` | Für diesen Schritt gibt es keine Live-Ansicht. | There is no live view for this step. | Approval card, after execution | | PROPOSED |
| `common.errors.WRITE_LIVE_VIEW_EXPIRED` | Die Live-Ansicht ist abgelaufen. Öffne sie neu. | The live view expired. Open it again. | Approval card, after execution | Live View links live at most 60 seconds per call | PROPOSED |
| `common.errors.WRITE_SESSION_NOT_FOUND` | Diesen Portalvorgang finde ich nicht mehr. | I cannot find this portal session any more. | Approval card, cancel control | | PROPOSED |
| `common.errors.RUN_NOT_FOUND` | Diesen Lauf gibt es nicht mehr. | This run no longer exists. | Run page, connection sheet history | | PROPOSED |
| `common.errors.AUTH_RUN_NOT_RESUMABLE` | Diese Anmeldung lässt sich nicht fortsetzen. Starte sie neu. | This sign-in cannot be resumed. Start it again. | Run page | | PROPOSED |
| `common.errors.AUTH_SESSION_ENDED` | Die Anmeldung ist beendet. Starte sie neu, wenn du weitermachen willst. | The sign-in session ended. Start it again to carry on. | Run page | | PROPOSED |
| `common.errors.CONTROLLED_DEMO_ONLY` | Diesen Schritt führe ich in der Demo nur auf roomscout.dev aus. | In the demo I only carry out this step on roomscout.dev. | Approval card, connection sheet | Honest about the demo boundary without naming a flag | PROPOSED |
| `common.errors.SOURCE_REVIEW_REQUIRED` | Diese Quelle wird noch geprüft, bevor du sie nutzen kannst. | This source is still being reviewed before you can use it. | Settings → Quellen | Same fact as the pending-connection state in group 1, reached as a throw | PROPOSED |

### 11.8 Was dein Scout weiß (memory)

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.MEMORY_FACT_NOT_FOUND` | Diese Angabe gibt es nicht mehr. | This entry no longer exists. | Settings → Was dein Scout weiß | | PROPOSED |
| `common.errors.MEMORY_FACT_LIMIT` | Ich kann mir nicht mehr Angaben merken. Räume zuerst eine ältere weg. | I cannot remember any more entries. Retire an older one first. | Settings → Was dein Scout weiß, import | | PROPOSED |
| `common.errors.INVALID_MEMORY_FIELD` | Diese Angabe kann ich so nicht speichern. | I cannot save this entry. | Inline at the edited row | | PROPOSED |
| `common.errors.INVALID_CONTEXT_IMPORT` | Dieser Text ist zu kurz oder zu lang zum Übernehmen. | This text is too short or too long to import. | Import step 1 | | PROPOSED |
| `common.errors.INVALID_IMPORT_SIZE` | Wähle mindestens eine und höchstens 40 Angaben aus. | Select at least one entry and no more than 40. | Import step 2 | | PROPOSED |
| `common.errors.SENSITIVE_INFERENCE_FORBIDDEN` | Das merke ich mir nicht. Solche Angaben bleiben außen vor. | I do not store that. Entries like this stay out. | Import, fact editing | The refusal is the product working, so the line is calm rather than apologetic | PROPOSED |

### 11.9 Always present

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.UNAUTHENTICATED` | Bitte melde dich an. | Please sign in. | Never inline — route to sign-in instead | Kept only as a last-resort label; §7.3 says this code routes, it does not render as a form error | PROPOSED |
| `common.errors.FORBIDDEN` | Dafür fehlt dir die Berechtigung. | You do not have access to this. | Operator routes, cross-owner access | | PROPOSED |
| `common.errors.USER_NOT_FOUND` | Dieses Konto finde ich nicht. | I cannot find this account. | Profile | | PROPOSED |

### 11.10 Operator only

Operator is internal, so these lines name the system plainly. They still follow sentence case and
carry no code names.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.FIRECRAWL_NOT_CONFIGURED` | Firecrawl ist nicht eingerichtet. | Firecrawl is not configured. | Operator → Integrationen, Quellen | | PROPOSED |
| `common.errors.FIRECRAWL_MONITORS_DISABLED` | Die Quellenbeobachtung ist abgeschaltet. | Source monitoring is switched off. | Operator → Quellen | | PROPOSED |
| `common.errors.ACTIVE_MONITOR_NOT_FOUND` | Zu dieser Quelle läuft keine Beobachtung. | No monitor is running for this source. | Operator → Quellen | | PROPOSED |
| `common.errors.SOURCE_NOT_FOUND` | Diese Quelle gibt es nicht. | This source does not exist. | Operator → Quellen | | PROPOSED |
| `common.errors.SOURCE_TARGET_NOT_FOUND` | Dieses Quellenziel gibt es nicht. | This source target does not exist. | Operator → Quellen | | PROPOSED |
| `common.errors.SOURCE_ENTRY_NOT_FOUND` | Diesen Quelleneintrag gibt es nicht. | This source entry does not exist. | Operator → Quellen | | PROPOSED |
| `common.errors.SOURCE_ENTRY_NOT_FAILED` | Dieser Quelleneintrag ist nicht fehlgeschlagen. | This source entry has not failed. | Operator → Quellen, retry control | | PROPOSED |

### 11.11 Fallbacks

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `common.errors.rateLimit` | Kurz durchatmen: Bitte versuche es in einer Minute noch einmal. | Take a breath: please try again in a minute. | Any control that hits a server rate limit | **DE exists** (`ScoutPage.tsx:40`). Matched on the rate-limit / too-many message pattern, per §7.3 rule 2 | PROPOSED |
| `common.errors.fallback` | Der Scout konnte diesen Schritt gerade nicht abschließen. Bitte versuche es erneut. Dein Suchauftrag bleibt gespeichert. | The Scout could not finish this step just now. Please try again. Your search stays saved. | Any unknown code | **DE exists** (`ScoutPage.tsx:41`). §7.3 rule 3. ⚠ this line does **not** say „Nichts wurde gesendet.“ — if an unknown code surfaces inside the send or acceptance flow, use the family line, not this one | PROPOSED |

---

## What is deliberately not here

- **The three scripted status lines** (`scout.status.candidateFound`, `.asked`, `.followUp`) name
  demo content and need generic replacements with slots. That is `DATA_BINDING_PLAN.md` §11 Q3 and
  is still open, so nothing is proposed for them yet.
- **The `complete` headline** — §11 Q5, see the note in group 5.
- **The three English starter prompts** that replace the scripted suggestion chips — §11 Q8 asks
  whether you want translations or new German starters written from scratch.
- **Server-authored strings** — `DECISIONS.md` item 13 keeps them English and sends server-side
  localisation to the backlog.
- **`factsFromNeed` labels and values** — ten labels and nine value templates that exist in English
  today. They are a translation job, not new copy, and §11 Q14 has not settled the facet-label part.

---

## 12. Copy-layer triage (2026-09-09, afternoon)

Added after the section above, from the open questions the German extraction and the copy runtime
raised. Every decision behind these rows is recorded in `DECISIONS.md` under
"Copy-layer decisions (2026-09-09, afternoon)"; the item number is named in each Note.

### 12.1 The missing singular for the import change-log line

„{n} Angaben aus Beispiel-Kontext übernommen“ is a hard plural with no singular, so importing one
entry renders „1 Angaben …“. `knowledge.import.pickCount` („{n} ausgewählt“) lets the user pick a
single fact, so n=1 is reachable. The same string exists twice, once per surface, with a different
placeholder name in each — both spellings are verbatim source and neither is renamed. The two keys
become `{ one, other }` in one change (`DECISIONS.md` item 82).

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `settings.knowledge.log.entry.imported.one` | {n} Angabe aus Beispiel-Kontext übernommen | {n} entry taken from the example context | Settings → Was dein Scout weiß, change log | The missing singular. Only „Angaben“ → „Angabe“ changes; the rest is the shipped string | PROPOSED |
| `settings.knowledge.log.entry.imported.other` | {n} Angaben aus Beispiel-Kontext übernommen | {n} entries taken from the example context | same row | **DE exists** (`settings.ts` `knowledge.log.entry.imported`). Listed so the pair is visible; only the English is new | PROPOSED |
| `scout.data.log.knowledgeImported.one` | {count} Angabe aus Beispiel-Kontext übernommen | {count} entry taken from the example context | Scout, change log in „Was dein Scout weiß“ | Identical string, `{count}` per SCOUT §18.19. Must land in the same change as the Settings twin | PROPOSED |
| `scout.data.log.knowledgeImported.other` | {count} Angaben aus Beispiel-Kontext übernommen | {count} entries taken from the example context | same row | **DE exists** (`scout.ts` `data.log.knowledgeImported`) | PROPOSED |

This is the fifth plural case. `COMPONENT_MAP.md` §6.3 names four and needs the addition.

### 12.2 The two remaining false demo sentences on the review card

`DECISIONS.md` item 30 replaces the complete subline because it claims nothing is sent. Two review
strings end with the same sentence and were never covered by it (`DECISIONS.md` item 85). In the
real app the acceptance really is sent, which also makes the disclaimer's subjunctive wrong: it says
the Scout *would* commit, when it does.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `scout.review.accept.disclaimer` | Mit deiner Bestätigung sagt der Scout dem Anbieter verbindlich zu. | With your confirmation the Scout gives the provider a binding acceptance. | Review card, under the accept control | Replaces „Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet.“ Two edits: the false second sentence goes, and „würde … zusagen“ becomes „sagt … zu“ | PROPOSED |
| `scout.review.question.answer` | Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. | I give the provider a binding acceptance and send you the confirmation with all the terms. You can rehearse from 1 October. | Review card, the Scout's answer to „Was passiert dann?“ | Replaces the same trailing sentence. The first two sentences are the shipped string, unchanged. Register: **euch** the confirmation, **ihr** rehearse | PROPOSED |

⚠ The complete headline („Euer nächster Proberaum steht bereit.“) is still open for the same reason
and is deliberately not proposed here — see the note in group 5 and `DATA_BINDING_PLAN.md` §11 Q5.

### 12.3 What item 45's truncation actually produces

`DECISIONS.md` item 45 drops the sentence pointing at the demo control bar, with no replacement, but
`OPERATOR_SCREENS.md` still carries both sentences, so the extraction shipped them doc-verbatim
(`DECISIONS.md` item 102). No new wording is authored here; these two rows exist so the exact
truncated result is visible before it is written into `operator.ts`.

| Proposed key | DE (proposed) | EN (proposed) | Where it appears | Note | Status |
|---|---|---|---|---|---|
| `operator.overview.calm.text` | Keine Aufgabe braucht Aufmerksamkeit. | No task needs attention. | Operator → Betrieb im Blick, calm banner | Truncation only. Drops „Beispielstörung über die Demo-Steuerung laden.“ per item 45 | PROPOSED |
| `operator.diag.empty` | Keine offenen Störungen. | No open incidents. | Operator → Diagnose, no-incident card | Truncation only. Drops „Über die Demo-Steuerung lässt sich eine Beispielstörung laden.“ per item 45. The German gains the sentence-final period the source already has | PROPOSED |

### 12.4 Rows deliberately not added here

- **Language-toggle and navigation-sheet labels** are already proposed in groups 7 and 8. One
  control serves the landing header and the profile menu, so no landing-specific toggle key is
  added (`DECISIONS.md` items 80 and 81).
- **Plural forms for `operator.overview.attention.text` and
  `operator.integrations.browserbase.test.incident`**, which hard-code the count 1. Neither is bound
  to a live count, so no plural is invented for a hypothetical (`DECISIONS.md` item 99). They are a
  `BACKLOG.md` §3 conditional.
- **A replacement for `operator.host.now.format`.** It is kept verbatim as a dead-but-catalogued key
  and is translated as it stands (`DECISIONS.md` item 78).
