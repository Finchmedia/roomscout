# Scout surface — state model & demo script

Source of truth: `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype/Roomscout.dc.html`,
script block `<script type="text/x-dc" data-dc-script …>` — **lines 646–1230**.
Template (lines 1–645) is documented separately; this file documents the **logic + data + copy** so the
Scout surface can be re-implemented as a typed React state machine without opening the prototype.

The script tag declares editor props:
`data-props = { "$preview": { "width": 1440, "height": 900 }, "mobile": { "editor": "boolean", "default": false, "tsType": "boolean", "section": "Vorschau" } }`
→ the only editor-facing prop is **`mobile: boolean`** (default `false`), which forces the narrow/phone layout.

The component is `class Component extends DCLogic` — a React class component whose `renderVals()`
returns the props object consumed by the template. Everything below is derived from that class.

---

## 0. Port summary (what to build)

| Concern | Port target |
| --- | --- |
| Stage machine | `useReducer` over a discriminated `ScoutStage` union, or XState. Stages are exclusive full-screen scenes. |
| Timers | Replace the bespoke `Sched` class with a pausable scheduler hook (`useScheduler`) — pause/resume/clear/skip semantics are load-bearing for pause, settings-hold and demo controls. |
| Word-by-word reveal | `setInterval` incrementing `utter.shown`; must be skippable and instant in text mode / reduced motion. |
| Fact capsule flight | FLIP-style clone animation via Web Animations API (kept as `custom`, no shadcn equivalent). |
| Settings / Operator | Rendered as `dc-import` children (`Settings.dc.html`, `Operator.dc.html`) fed by `settingsData`/`settingsActions` and `opData`/`opActions`. In the port these become the shadcn **sidebar-13 dialogs**; the Scout surface owns their state. |
| Demo controls | **NOT to be built.** See §17. |

---

## 1. Runtime primitives

### 1.1 `class Sched` — pausable scheduler

```
constructor()      items: SchedItem[] = [], paused = false, speed = 1
after(ms, fn)      → item { fn, remaining: ms / this.speed, start: 0, h: null }
                     pushed to items; armed immediately unless paused; returns the item
_arm(it)           it.start = performance.now(); it.h = setTimeout(→ remove from items, run it.fn, it.remaining)
pause()            no-op if already paused. paused = true; for each item: clearTimeout,
                   remaining = max(0, remaining - (now - start))
resume()           no-op if not paused. paused = false; re-arms every item with its residual remaining
clear()            clearTimeout on every item; items = []
skip()             returns false if no items. Picks the item with the SMALLEST residual time
                   (residual = paused ? remaining : remaining - (now - start)),
                   clears its timeout, removes it, runs its fn immediately, returns true
```

**Every** delay in the demo goes through `this.sched.after(...)`. `speed` divides the delay
(`ms / speed`), so `speed = 1.6` runs the demo 1.6× faster. Reveal-interval timing divides by
`this.sched.speed` too.

### 1.2 Instance fields (not React state)

| Field | Type | Purpose |
| --- | --- | --- |
| `this.sched` | `Sched` | the scheduler above |
| `this.mainRef` | `React.RefObject` | the scrolling `<main>`; used for `querySelector` of `[data-utter]`, `[data-status]`, `[data-capsule]`, `[data-fact-row="<id>"]`, `[data-fact-summary]`, `[data-fact-label="<id>"]`, `[data-blob-anchor]` |
| `this.blobRef` | `React.RefObject` | the floating orange blob element, positioned imperatively |
| `this.uid` | `number` (starts 0) | monotonic id for utterances (`++this.uid`) |
| `this.reveal` | `number \| null` | the `setInterval` handle of the word reveal |
| `this.mq` | `MediaQueryList` | `(max-width: 959px)` → drives `state.narrow` |
| `this.rm` | `MediaQueryList` | `(prefers-reduced-motion: reduce)` → disables reveal + all element animations |
| `this._prevUtter`, `this._prevStatus` | `number \| null`, `string` | change detection in `componentDidUpdate` to trigger the fade-in |

### 1.3 Lifecycle

- `componentDidMount()` — creates the two media queries, sets `narrow` from `mq.matches`, subscribes to
  `mq change` and `window resize` (→ `syncBlob()`), calls `syncBlob()` once.
- `componentWillUnmount()` — `sched.clear()`, `stopReveal()`, removes both listeners.
- `componentDidUpdate()` — `syncBlob()`; if `utter.id` changed → `fade('[data-utter]')`;
  if `status` changed and non-empty → `fade('[data-status]')`.
- `fade(sel)` — `el.animate([{opacity:0, transform:'translateY(6px)'}, {opacity:1, transform:'none'}], {duration: 420, easing: 'ease-out'})`, skipped when `prefers-reduced-motion`.
- `syncBlob()` — finds `[data-blob-anchor]` inside `main`; if absent sets `blob.style.opacity = '0'`;
  otherwise copies the anchor's rect into the blob's `left/top/width/height` (top offset by `main.scrollTop`)
  and sets `opacity: 1`. The blob element itself carries
  `transition: left .9s cubic-bezier(.22,.8,.2,1), top .9s …, width .9s …, height .9s …, opacity .6s`,
  so the blob glides between scenes.
  **shadcn candidate: custom** (bespoke animated blob).
- `now()` — `'Heute, ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0')` (hours **not** zero-padded).

### 1.4 `bind(fn)` — the form-submit wrapper

Declared at the top of `renderVals()` (not a class method):

```
const bind = fn => (e) => { if (e && e.preventDefault) e.preventDefault(); fn(e); };
```

It wraps **four** handlers, and only these four:

| binding | section |
| --- | --- |
| `submitDiscovery` | §9.1 |
| `submitSideNote` | §18.12 |
| `submitClar` | §8.1 |
| `submitQa` | §8.5 |

All four composers are `<form onSubmit>` elements in the template, so **every one of them needs
`preventDefault()`** — wiring the clarification, side-note or Q&A composer without it reloads the page.
`e` is forwarded to `fn`, but none of the four handlers reads it.

Note also that every binding returned by `renderVals()` closes over `const s = this.state` — the state
snapshot of the render that created it — which is why handlers such as `submitDiscovery`, `useSuggestion`
and `toggleSearchPause` read stale-by-one-render values instead of `this.state`. A hook-based port gets
this behaviour for free with `useCallback`, but must not "fix" it silently where the flow depends on it.

---

## 2. State model

`this.state = Object.assign({ …persistent… }, this.baseFor('welcome'))`.
Two groups: **persistent** keys (survive every `go()` / stage jump) and **stage keys** (reset by `baseFor`).

### 2.1 Persistent state (never reset by `go()`)

| Key | Type | Initial value | Meaning |
| --- | --- | --- | --- |
| `mode` | `'voice' \| 'text'` | `'voice'` | conversation input mode. Set by `startVoice`/`startText`/`switchToText`/`switchToVoice`. Drives instant vs. word-by-word reveal. |
| `micOn` | `boolean` | `true` | voice-mode mic toggle (visual only). |
| `draft` | `string` | `''` | discovery text input value |
| `sideDraft` | `string` | `''` | autopilot "side note" input value |
| `clarDraft` | `string` | `''` | clarification reply input value |
| `qaDraft` | `string` | `''` | offer-review question input value |
| `editDraft` | `Record<factId, string>` | `{}` | per-fact edit buffer while `editing` |
| `demoPaused` | `boolean` | `false` | demo-controls pause (NOT product UI) |
| `demoOpen` | `boolean` | `true` | demo-controls bar expanded (NOT product UI) |
| `speed` | `1 \| 1.6` | `1` | demo speed (NOT product UI) |
| `narrow` | `boolean` | `false` (set on mount from `matchMedia('(max-width: 959px)')`) | viewport is narrow |
| `stepIndex` | `number` | `0` | index into `SCRIPT` of the step currently shown/awaited |
| `view` | `'scout' \| 'settings' \| 'operator'` | `'scout'` | which top-level surface is mounted |
| `settingsPage` | `string` | `'sources'` | active Settings page (passed down to `Settings.dc.html`) |
| `opPage` | `string` | `'overview'` | active Operator page |
| `menuOpen` | `boolean` | `false` | header avatar dropdown |
| `toast` | `string \| null` | `null` | event toast, only ever set while `view !== 'scout'` |
| `sessionHeld` | `boolean` | `false` | the discovery conversation was paused because the user opened Settings/Operator |
| `settingsDirty` | `boolean` | `false` | Settings child reports unsaved changes; blocks direct back-navigation |
| `backReq` | `number` | `0` | monotonic "back requested" counter handed to the Settings child so it can show its own confirm dialog |
| `name` | `string` | `'Herzbuben'` | band / account name |
| `sources` | `Source[]` | `SOURCES0.map(s => Object.assign({}, s))` — a **shallow per-item copy** (new array, new flat objects; nothing deeper is cloned) | search sources, see §3.7 |
| `autoSources` | `boolean` | `true` | "let the scout choose sources" switch |
| `rules` | `Rules` | `Object.assign({}, RULES0)` — **shallow copy** | autonomy / Handlungsspielraum, see §3.8 |
| `knowledge` | `Knowledge[]` | `KNOW0.map(k => Object.assign({}, k))` — **shallow per-item copy** | stored knowledge items, see §3.9 |
| `knowledgeLog` | `{ text: string; when: string }[]` | `[]` | change log; `when` from `now()` |
| `notif` | `{ decision: boolean; offer: boolean; digest: boolean; channel: string }` | `{ decision: true, offer: true, digest: false, channel: 'app' }` | notification settings |
| `flags` | `{ voice: boolean; publicSearch: boolean }` | `{ voice: true, publicSearch: false }` | operator feature flags |
| `incident` | `boolean` | `false` | operator incident is active |
| `incidentResolved` | `boolean` | `false` | incident was fixed by re-connecting the portal |
| `offerStale` | `boolean` | `false` | **also** a stage key (see below); a fact was edited while an offer stood |
| `mobile` | `boolean \| undefined` | *absent* (falls back to `props.mobile`) | phone-frame preview; only ever written by `toggleMobile` |

### 2.2 Stage state — `baseFor(stage)` base object

Every `go()` replaces **all** of these:

| Key | Type | Base value | Meaning |
| --- | --- | --- | --- |
| `stage` | `Stage` | the requested stage | current scene |
| `utter` | `{ id: number; who: 'scout' \| 'user'; words: string[]; shown: number } \| null` | `null` | the utterance currently being revealed |
| `capsule` | `Fact \| null` | `null` | the fact chip flying toward the list |
| `awaitingUser` | `boolean` | `false` | text mode is waiting for the user to send the next line |
| `suggestion` | `string \| null` | `null` | prepared reply shown as a chip in text mode |
| `hint` | `string \| null` | `null` | transient bottom toast ("Prototyp: …") |
| `transcriptOpen` | `boolean` | `false` | Mitschrift side panel |
| `briefOpen` | `boolean` | `false` | inline "Euer Suchauftrag" disclosure |
| `editing` | `boolean` | `false` | brief card is in edit mode |
| `convoEnded` | `boolean` | `false` | user ended the discovery conversation |
| `cardArrived` | `boolean` | `false` | brief card finished its entrance (gates the action buttons) |
| `headlineShown` | `boolean` | `false` | brief headline opacity |
| `activityOpen` | `boolean` | `false` | activity timeline disclosure |
| `searchPaused` | `boolean` | `false` | product-level "Suche pausieren" |
| `offerTalk` | `string \| null` | `null` | the spoken offer explanation (`OFFER_TALK`) |
| `fullTerms` | `boolean` | `false` | full terms disclosure in review |
| `questionOpen` | `boolean` | `false` | Q&A block in review |
| `qa` | `{ q: string; a: string } \| null` | `null` | the answered question |
| `scoutState` | `'idle' \| 'speaking' \| 'listening' \| 'thinking'` | `'idle'` | drives blob animation + status word |
| `status` | `string` | `''` | autopilot status line |
| `listMode` | `'hidden' \| 'float' \| 'card' \| 'leaving'` | `'hidden'` | the fact list's presentation |
| `facts` | `Fact[]` | `[]` | the search brief, see §4 |
| `transcript` | `{ who: 'scout' \| 'user'; text: string }[]` | `[]` | Mitschrift log |
| `activity` | `ActivityEntry[]` | `[]` | activity timeline |
| `clar` | `{ userText: string \| null; scoutText: string \| null }` | `{ userText: null, scoutText: null }` | clarification exchange |
| `pending` | `{ to: string; text: string; reason: 'contact' \| 'review' } \| null` | `null` | message awaiting release |
| `waitingFor` | `'source' \| 'access' \| 'release' \| null` | `null` | what blocks the scout |
| `offerStale` | `boolean` | `false` | offer needs re-check after a fact edit |
| `offer` | `Candidate` | `OFFER0` (= `CANDS[0]`, Stuttgart-West) | the offer currently on the table |

> **Port note:** `go(stage, extra)` does `setState(Object.assign(baseFor(stage), extra || {}))` — it never
> touches the persistent group. A typed port should model this as
> `state = { ...persistent, ...stageState }` with a single `resetStage(stage, extra)` reducer action.

---

## 3. Constants (verbatim)

### 3.1 `STAGES`

```ts
const STAGES = ['welcome','discovery','brief_review','scouting','waiting','clarification','following_up','offer','offer_review','complete'];
```

Two further stages exist but are **not** in `STAGES` (reachable only through handlers or the demo chapter select):
`'dead_end'` and `'candidates'`.

```ts
const AUTOPILOT = ['scouting','waiting','following_up'];
```
`AUTOPILOT` gates `attemptContact`, `arriveReply`, `showCandidates` and the header "Scout ist unterwegs" badge.

### 3.2 `SCRIPT` — the discovery conversation (8 steps, indices 0–7)

| # | who | text (verbatim) | facts emitted | extra |
| --- | --- | --- | --- | --- |
| 0 | `scout` | „Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?“ | — | — |
| 1 | `user` | „Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat.“ | `ort` = „Stuttgart“; `budget` = „Bis 400 € / Monat“; `band` = „Geteilter Raum · 4 Personen“ | — |
| 2 | `scout` | „Welche Tage passen euch zum Proben?“ | — | — |
| 3 | `user` | „Donnerstags ab 19 Uhr wäre gut.“ | `zeit` = „Donnerstags ab 19 Uhr“ | — |
| 4 | `scout` | „Gibt es etwas, das im Raum vorhanden sein oder dort bleiben muss?“ | — | — |
| 5 | `user` | „Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit.“ | `equip` = „Schlagzeug darf im Raum bleiben“ | `memory: 'Verstärker bringt die Band mit'` |
| 6 | `user` | „Und beim Budget lieber maximal 350 Euro.“ | `budget` = „Bis 350 € / Monat“ (**overwrites** step 1's value → triggers the `changed` highlight) | — |
| 7 | `scout` | „Alles klar, maximal 350 Euro. So würde ich für euch suchen. Soll ich loslegen?“ | — | `then: 'brief'` |

Notes for the port:
- Step 6 follows step 5 **without** a scout turn in between — two consecutive user utterances.
- `memory` on step 5 is declared but **never read** by any code path. It mirrors the `k_amps` knowledge item
  („Verstärker bringt ihr selbst mit“) which is pre-seeded in `KNOW0`. Keep it as data, do not wire it.
- `then: 'brief'` on step 7 is the only transition trigger baked into `SCRIPT`.

### 3.3 `FINAL_FACTS` — the brief after discovery

```ts
const FINAL_FACTS = [
  { id: 'ort',    label: 'Stuttgart' },
  { id: 'budget', label: 'Bis 350 € / Monat' },
  { id: 'band',   label: 'Geteilter Raum · 4 Personen' },
  { id: 'zeit',   label: 'Donnerstags ab 19 Uhr' },
  { id: 'equip',  label: 'Schlagzeug darf im Raum bleiben' },
];
```
Used by `baseFor` for every stage ≥ `brief_review`, as a **shallow per-entry copy**
(`FINAL_FACTS.map(f => Object.assign({}, f))` — new array, new flat fact objects).

### 3.4 Single strings

| Constant | Value (verbatim) |
| --- | --- |
| `START_LINE` | „Alles klar. Ich suche passende Räume und kläre die Details. Ich melde mich, wenn ich euch brauche.“ |
| `FOLLOW_STATUS` | „Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben.“ |
| `ALT_STATUS` | „Ich frage nach einer Alternative zu Mittwoch und suche weiter.“ |
| `YES_TEXT` | „Ja, Mittwoch passt auch.“ |
| `YES_REPLY` | „Alles klar, Mittwoch geht also auch. Ich kläre den Rest.“ |
| `NO_TEXT` | „Nein, Donnerstag ist wichtig.“ |
| `NO_REPLY` | „Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter.“ |
| `OFFER_TALK` | „Das Angebot liegt bei 280 Euro inklusive Nebenkosten. Ihr könnt mittwochs von 19 bis 22 Uhr proben, und euer Schlagzeug darf bleiben. Soll ich euch die übrigen Konditionen erklären?“ |

### 3.5 `STATUS` — the four scouting status lines

```ts
const STATUS = [
  'Ich suche nach passenden Räumen in Stuttgart.',                                          // STATUS[0]
  'Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details.',                        // STATUS[1]
  'Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.',    // STATUS[2]
  'Jetzt warte ich auf eine Antwort.',                                                       // STATUS[3]
];
```

### 3.6 `ACT` / `ACT2` — activity timeline entries

```ts
const ACT = {
  start:     { text: 'Suchauftrag gestartet' },
  found:     { text: 'Raum in Stuttgart-West gefunden', meta: 'roomscout.dev · Demo-Portal' },
  contacted: { text: 'Anbieter über das Portal kontaktiert' },
  waiting:   { text: 'Warte auf Antwort' },
  notif:     { text: 'Benachrichtigung aus dem Portal erhalten' },
  read:      { text: 'Neue Nachricht im Portal gelesen' },
  confirmed: { text: 'Mittwoch bestätigt, Angebot angefragt' },
  alt:       { text: 'Alternative zu Mittwoch angefragt' },
  offer:     { text: 'Angebot eingegangen' },
};
const ACT2 = {
  declined: { text: 'Anbieter hat abgesagt: Donnerstag nicht möglich' },
  noMatch:  { text: 'Kein weiterer passender Raum in Stuttgart gefunden' },
  found2:   { text: 'Drei Räume zum Vergleich zusammengestellt', meta: 'roomscout.dev · Demo-Portal' },
};
```
Two dynamic entries are pushed at runtime (not constants):
- `{ text: 'Suchauftrag angepasst: ' + label }` — from `compromise(kind)`
- `{ text: 'Angebot angefragt: ' + candidate.short }` — from `pickCandidate(id)`

**Identity matters:** `attemptContact` and `settingsData.usage.contacted` test `activity.some(a => a === ACT.contacted)`
by **object reference**. In a typed port replace with a `kind` discriminator
(`type ActivityEntry = { kind: ActKind; text: string; meta?: string }`) and compare on `kind`.

### 3.7 `SOURCES0` — search sources

```ts
const SOURCES0 = [
  { id: 'roomscout', name: 'roomscout.dev',            desc: 'Kontrolliertes Demo-Portal',        region: 'Stuttgart', enabled: true,  access: 'connected', profile: 'Herzbuben', lastAccess: null, kind: 'portal' },
  { id: 'musiker',   name: 'Musiker in deiner Stadt',  desc: 'Stuttgart · Öffentliche Anzeigen',  region: 'Stuttgart', enabled: true,  access: 'public',                                          kind: 'public' },
  { id: 'bandnet',   name: 'Bandnet Hamburg',          desc: 'Hamburg · Andere Region',           region: 'Hamburg',   enabled: false, access: 'public',                                          kind: 'public' },
];
```
`access` values seen: `'connected' | 'public' | 'expired'` (`'expired'` set by `loadIncident`).
`lastAccess` is stamped with `now()` whenever `setAccess(id, 'connected')` runs.

### 3.8 `RULES0` — Handlungsspielraum (autonomy)

```ts
const RULES0 = { mode: 'autopilot', contact: true, viewings: true, publishAd: false, shareProfile: true, sharePrivate: false, perDay: 5 };
```
`mode: 'autopilot' | 'review'`. Only `mode` and `contact` are read by the Scout surface
(in `attemptContact`); the rest is owned by the Settings surface.

### 3.9 `KNOW0` — stored knowledge

```ts
const KNOW0 = [
  { id: 'k_genre', cat: 'band',        text: 'Hardrock und Alternative',                        origin: 'Demo-Bandprofil',      status: 'confirmed' },
  { id: 'k_mates', cat: 'band',        text: 'Ähnliche Musikrichtung bei Mitnutzern wichtig',   origin: 'Annahme deines Scouts', status: 'assumed'  },
  { id: 'k_amps',  cat: 'ausstattung', text: 'Verstärker bringt ihr selbst mit',                origin: 'Aus dem Gespräch',      status: 'confirmed', requires: 'equip' },
];
```
`requires: 'equip'` means the item is only surfaced once the `equip` fact exists and is no longer `arriving`.

### 3.10 `FACT_CAT` — fact → knowledge category

```ts
const FACT_CAT = { ort: 'alltag', budget: 'band', band: 'band', zeit: 'alltag', equip: 'ausstattung' };
```

### 3.11 `CANDS` — the three candidate rooms; `OFFER0 = CANDS[0]`

| field | `west` | `esslingen` | `ost` |
| --- | --- | --- | --- |
| `id` | `'west'` | `'esslingen'` | `'ost'` |
| `name` | „Raum in Stuttgart-West“ | „Raum in Esslingen“ | „Raum in Stuttgart-Ost“ |
| `short` | „Stuttgart-West“ | „Esslingen“ | „Stuttgart-Ost“ |
| `price` | „280 € / Monat“ | „320 € / Monat“ | „350 € / Monat“ |
| `priceNum` | `280` | `320` | `350` |
| `time` | „Mittwochs, 19–22 Uhr“ | „Donnerstags, 19–23 Uhr“ | „Donnerstags, ab 20 Uhr“ |
| `timeLower` | „mittwochs 19–22 Uhr“ | „donnerstags 19–23 Uhr“ | „donnerstags ab 20 Uhr“ |
| `storage` | „Schlagzeug kann im Raum bleiben“ | „Schlagzeug kann im Raum bleiben“ | „Schlagzeug müsste abgebaut werden“ |
| `storageOk` | `true` | `true` | `false` |
| `way` | „12 Min. mit der Stadtbahn“ | „25 Min. mit der S-Bahn“ | „18 Min. mit der Stadtbahn“ |
| `size` | „ca. 28 m² · geteilt mit einer Band“ | „ca. 35 m² · geteilt mit zwei Bands“ | „ca. 22 m² · geteilt mit drei Bands“ |
| `note` | „Günstigster Raum, aber nur mittwochs frei.“ | „Euer Wunschtag, dafür im Umland.“ | „Am Budgetlimit, und das Schlagzeug kann nicht bleiben.“ |
| `photo` | `'assets/proberaum.png'` | `null` | `null` |

Note the **en-dash** `–` in every time range and the `·` separator in `size`.

**Photo handling:** a candidate with `photo === null` renders a striped placeholder
(`repeating-linear-gradient(135deg, rgba(255,255,255,.05) 0 10px, rgba(255,255,255,.02) 10px 20px)`,
height `150px` in the card, `min-height: offerImgMin` in the offer hero) with the monospace caption
„Foto folgt vom Anbieter“ (`font-family: ui-monospace,Menlo,monospace; font-size: 12.5px` in card / `13px` in hero; `color:#a89684`).
The **review** screen always uses `offerPhoto`, which falls back to `'assets/proberaum.png'` when the
selected offer has no photo — so Esslingen/Ost show the West photo on the review screen.
**shadcn candidate:** `Card` + `AspectRatio` for the tile, `Skeleton` styling reference for the placeholder (implement as `custom` striped div).

---

## 4. The fact model

```ts
type FactId = 'ort' | 'budget' | 'band' | 'zeit' | 'equip';
type Fact = {
  id: FactId;
  label: string;      // German, verbatim, user-editable
  arriving?: boolean; // true while the capsule is still flying — row is collapsed (h:0, opacity:0)
  changed?: boolean;  // true for ~1.1–1.2 s after a value change — row gets the orange wash
};
```

**Kinds / icons** (chosen in the template by `f.isOrt` … `f.isEquip`):

| id | icon | category (`FACT_CAT`) |
| --- | --- | --- |
| `ort` | map pin | `alltag` |
| `budget` | literal `€` glyph (`font-size:19px` card / `18px` sheet, `line-height:1`) | `band` |
| `band` | two-person group | `band` |
| `zeit` | clock | `alltag` |
| `equip` | drum / cylinder | `ausstattung` |

**Row geometry** (from `renderVals().facts`):

| prop | value |
| --- | --- |
| `opacity` | `f.arriving ? 0 : 1` |
| `bg` | `f.changed ? 'rgba(255,105,38,.2)' : 'transparent'` |
| `h` | `f.arriving ? 0 : (card ? 44 : 34)` px |
| `pad` | `f.arriving ? '0 6px' : (card ? '0 8px' : '0 6px')` |
| `editing` / `notEditing` | mirror `state.editing` |
| `draft` | `editDraft[f.id] ?? f.label` |
| `onEdit` | writes into `editDraft[f.id]` |

Row transition string: `transition: padding .9s, font-size .9s, gap .9s, height .9s, opacity .35s, background .5s`.
`rowGap = card ? 16 : 10`, `rowFont = card ? 17 : 13.5`.
**shadcn candidate:** list rows = `custom` (animated); the edit field = `Input`; the two edit buttons = `Button` (default + outline).

### 4.1 Fact writes

| Path | Effect |
| --- | --- |
| `processFacts` → `commitFact(f)` | sets `label`, `arriving:false`, `changed = !x.arriving` (so only a *re-stated* fact flashes — this is what makes the budget change at step 6 highlight). Then fades `[data-fact-label="<id>"]` (`[{opacity:0},{opacity:1}]`, `350 ms`) and schedules `changed:false` after **1100 ms**. |
| `updateFact(id, label)` (Settings → `settingsActions.updateFact`) | sets `label` + `changed:true`; sets `offerStale = offerStale \|\| ['offer','offer_review'].includes(stage)`; `logChange('Angabe korrigiert: ' + label)`; clears `changed` after **1200 ms**. |
| `startEdit()` (brief card edit) | `setState({ editing: true, editDraft: {} })` — **opening** edit mode discards whatever was left in the buffer. No fact is touched. |
| `cancelEdit()` (brief card edit) | `setState({ editing: false, editDraft: {} })` — **cancelling** discards the buffer. No fact is touched. |
| `saveEdit()` (brief card edit) | for every fact with a non-empty trimmed `editDraft[id]`, replaces `label`; sets `editing:false`, `editDraft:{}`. **Does not** set `changed`, **does not** log, **does not** set `offerStale`. |
| `answerClar(true, …)` | `zeit` → „Mittwoch oder Donnerstag ab 19 Uhr“ with `changed:true` at **+650 ms**. Both timers are queued at the instant `answerClar` is called, so the flag is cleared at **+2300 ms after the call** — i.e. only **1650 ms after it was set** — together with the stage switch. See §8.1 for the absolute offsets. |
| `compromise(kind)` | one fact per kind (see §8.2), `changed:true`, cleared after 1200 ms. |

---

## 5. Derived model helpers

### 5.1 `usableSources(st)`
`st.sources.filter(s => s.enabled && (s.kind === 'portal' || st.flags.publicSearch))`
→ public sources only count when the operator flag `publicSearch` is on.

### 5.2 `knowledgeItems()`
```
derived = facts.filter(f => !f.arriving).map(f => ({
  id: 'f_' + f.id, factId: f.id, cat: FACT_CAT[f.id], text: f.label,
  origin: 'Aus dem Gespräch · Teil eures Suchauftrags', status: 'confirmed',
}));
stored  = knowledge.filter(k => !k.requires || facts.some(f => f.id === k.requires && !f.arriving));
return derived.concat(stored);
```

### 5.3 `summary()` — the natural-language brief used by Settings
```
f = id => facts.find(x => x.id === id && !x.arriving)
band = f('band'), ort = f('ort'), eq = f('equip')
if (!band && !ort && !eq) return 'Ich weiß noch nichts über euch. Erzähl es mir beim nächsten Gespräch.'
s = 'Ihr seid eine ' + (band && /4|vier/i.test(band.label) ? 'vierköpfige ' : '') + 'Band'
    + (ort ? ' aus ' + ort.label.replace(/ & Umgebung/, '') : '') + '.'
parts = []
if (band) parts.push('sucht einen ' + (/geteilt/i.test(band.label) ? 'geteilten ' : '') + 'Proberaum')
if (eq && /schlagzeug/i.test(eq.label)) parts.push('möchtet euer Schlagzeug dort lassen')
if (parts.length) s += ' Ihr ' + parts.join(' und ') + '.'
```
With the default facts this yields:
„Ihr seid eine vierköpfige Band aus Stuttgart. Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen.“
(The `replace(/ & Umgebung/, '')` never fires — the Umland label is „Stuttgart & Umland“, not „& Umgebung“. Keep the behaviour, or fix to `/ & Umland/`.)

### 5.4 `logChange(text)` → appends `{ text, when: now() }` to `knowledgeLog`.

### 5.5 `matches(input, ref)` — fuzzy match for typed free text
```
norm = s => s.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3)
hits   = normalized(input) words present in the set of normalized(ref) words
num    = first /\d+/ of ref;  numHit = num && input.includes(num[0])
return hits >= 2 || (hits >= 1 && numHit)
```

---

## 6. Stage machine

```
welcome ──startVoice / startText──▶ discovery
discovery ──SCRIPT step 7 (then:'brief') ──▶ brief_review          [via morphToBrief]
brief_review ──startScouting──▶ scouting
brief_review ──backToConvo──▶ discovery (awaitingUser, suggestion 'Ja, leg los.')
scouting ──attemptContact ✓──▶ (contactAndWait) ──3 s──▶ waiting
scouting ──attemptContact ✗──▶ blocked: waitingFor 'source' | 'access' | 'release' (stage stays 'scouting')
waiting ──arriveReply──▶ clarification
clarification ──answerClar(true)──▶ following_up ──5 s──▶ offer
clarification ──answerClar(false)──▶ waiting ──6 s──▶ dead_end
dead_end ──compromise('zeit')──▶ scouting ──3.5 s──▶ following_up ──5 s──▶ offer
dead_end ──compromise('budget'|'umland')──▶ scouting ──3.5 s──▶ (status) ──3.5 s──▶ candidates
dead_end ──keepWaiting──▶ waiting (no timers → demo idles)
candidates ──pickCandidate(id)──▶ following_up ──5 s──▶ offer
candidates ──keepSearching──▶ waiting (no timers → demo idles)
offer ──reviewOffer──▶ offer_review
offer_review ──acceptOffer──▶ complete
complete ──restart──▶ welcome
```

### 6.1 `go(stage, extra)`
```
go(stage, extra) {
  this.sched.clear(); this.stopReveal();
  this.setState(Object.assign(this.baseFor(stage), extra || {}), () => this.enter(stage));
}
```

> **⚠ `go()` never un-pauses the scheduler.** `clear()` empties the queue but leaves `Sched.paused`
> untouched, and `go()` does not call `sched.resume()`. So a pause taken earlier (`endConvo` →
> `sched.pause()`, `toggleSearchPause`, `toggleDemoPause`) survives every stage change, while the
> *state* says the opposite: `baseFor` resets `searchPaused:false` and `onChapter` passes
> `{ demoPaused:false }`. Every timer queued after that is pushed but never armed, so the demo freezes
> with the UI showing „running“. See §10 and defect #9 in §19.1 — the port must clear the paused flag
> together with the stage.

> **`go()` is not the only way `stage` changes** — see §6.4 for the transitions that write `stage` with
> a plain `setState` and therefore keep `facts`, `transcript`, `mode`, `stepIndex`, `offer` … alive.

### 6.2 `enter(stage)` — the only auto-start timers

| stage | timer |
| --- | --- |
| `discovery` | `after(500)` → `runStep(0)` |
| `scouting` | `scheduleScouting(0)` → `STATUS[0]` at 0 ms, `STATUS[1]` + `ACT.found` at 4000 ms, `attemptContact()` at 8000 ms (§6.4) |
| `waiting` | `after(7000)` → `arriveReply()` |
| `following_up` | `after(5000)` → `showOffer()` |
| all others | none |

### 6.3 `baseFor(stage)` — cumulative state per stage (jump-in state)

Starting from the base object (§2.2), applied in order:

| stage | facts | transcript | activity | status | other |
| --- | --- | --- | --- | --- | --- |
| `welcome` | `[]` | `[]` | `[]` | `''` | — |
| `discovery` | `[]` | `[]` | `[]` | `''` | `listMode: 'float'` |
| `brief_review` | `FINAL_FACTS` | all 8 `SCRIPT` lines | `[]` | `''` | `listMode:'card'`, `cardArrived:true`, `headlineShown:true` |
| `scouting` | `FINAL_FACTS` | + `START_LINE` (scout) | `[start]` | `STATUS[0]` | — |
| `waiting` | `FINAL_FACTS` | + `START_LINE` | `[start, found, contacted, waiting]` | `STATUS[3]` | — |
| `clarification` | `FINAL_FACTS` | + `START_LINE` | `[…, notif, read]` | `''` | — |
| `dead_end` | `FINAL_FACTS` | + `START_LINE`, `NO_TEXT` (user), `NO_REPLY` (scout) | `[…, read, alt, ACT2.declined, ACT2.noMatch]` | `''` | — |
| `candidates` | `FINAL_FACTS` | + `START_LINE` | `[…, read, ACT2.found2]` | `''` | note: **no** yes/confirmed history |
| `following_up` | `FINAL_FACTS` with `zeit` → „Mittwoch oder Donnerstag ab 19 Uhr“ | + `START_LINE`, `YES_TEXT` (user), `YES_REPLY` (scout) | `[…, read, confirmed]` | `FOLLOW_STATUS` | — |
| `offer` / `offer_review` / `complete` | as `following_up` | as `following_up` | `[…, confirmed, offer]` | `''` (falls out of the `following_up` branch, so `status` stays base `''`) | — |

### 6.4 Transitions that bypass `go()` (plain `setState` — nothing is reset)

The only callers of `go()` are `startVoice`, `startText`, `restart`, `onChapter` and `demoNext`
(its `welcome → discovery` shortcut and its `STAGES[i+1]` fallback). **Every other stage change is a
plain `setState`**, so the base object of §2.2 is *not* applied: `facts`, `transcript`, `mode`, `micOn`,
`stepIndex`, `offer`, `editDraft`, `hint`, `capsule` … all survive and only the keys listed below change.
A port that routes these through a `resetStage()` reducer action would wrongly wipe the conversation.

#### `startScouting()` — `brief_review` → `scouting`

```
startScouting() {
  if (this.state.stage !== 'brief_review') return;            // guard: only from the brief
  this.sched.clear();                                          // drops the morphToBrief timers
  this.setState(st => ({
    stage: 'scouting', editing: false, listMode: 'leaving',
    status: START_LINE, scoutState: 'speaking',
    transcript: st.transcript.concat([{ who: 'scout', text: START_LINE }]),
    activity: [ACT.start],                                     // ← ASSIGNS, does not append
  }));
  this.sched.after(600, () => this.setState({ listMode: 'hidden' }));
  this.scheduleScouting(3800);
}
```

- `START_LINE` is shown as the autopilot `status` **and** appended to the transcript.
- `activity: [ACT.start]` **replaces** the timeline; anything already in it is discarded (harmless in the
  normal flow, where it is empty at this point, but load-bearing if a port appends instead).
- It uses `setState`, **not** `go('scouting')` — so `facts`, `transcript`, `mode`, `micOn` and `stepIndex`
  survive. Following §6.1's `go()` semantics here would reset them and break the brief.
- `sched.clear()` does **not** clear `Sched.paused` (§6.1 warning).
- Entry points: the binding `startScouting` (button „Scout losschicken“, wide card and mobile sheet) and
  `demoNext()` while `stage === 'brief_review'`.

#### `scheduleScouting(offset)` — the three autopilot timers

```
scheduleScouting(offset) {
  const S = this.sched;
  S.after(offset,        () => this.setState({ status: STATUS[0], scoutState: 'idle' }));
  S.after(offset + 4000, () => this.setState(st => ({ status: STATUS[1], activity: st.activity.concat([ACT.found]) })));
  S.after(offset + 8000, () => this.attemptContact());
}
```

| caller | `offset` | `STATUS[0]` + `scoutState:'idle'` | `STATUS[1]` + `activity += ACT.found` | `attemptContact()` |
| --- | --- | --- | --- | --- |
| `enter('scouting')` — i.e. any `go('scouting')`, incl. the demo chapter jump | `0` | 0 ms | 4000 ms | 8000 ms |
| `startScouting()` | `3800` | 3800 ms | 7800 ms | 11800 ms |

Note `compromise(kind)` also lands on `stage:'scouting'` but schedules its **own** timers (§8.2) —
it never calls `scheduleScouting`.

#### `backToConvo` (binding) — `brief_review` → `discovery`

```
backToConvo: () => {
  S.clear();
  this.setState({ stage: 'discovery', listMode: 'float', cardArrived: false, headlineShown: false,
                  editing: false, utter: null, scoutState: 'listening', awaitingUser: true,
                  suggestion: 'Ja, leg los.', stepIndex: SCRIPT.length });
}
```

- No guard, and no `go()`: `facts` and `transcript` survive (that is the point — the user goes back to
  keep talking). `capsule`, `mode`, `micOn`, `editDraft`, `convoEnded` and `offer` are **not** reset either.
- The screen returns to the floating fact list with the scout „listening“ and a prepared reply chip
  „Ja, leg los.“.
- `stepIndex = SCRIPT.length` (= 8) is **out of range** — see defect #1 in §19.1 (four paths then read
  `SCRIPT[8].text` and throw).
- Label: „Zurück zum Gespräch“ (§18.11).

#### The remaining plain-`setState` transitions

`morphToBrief()` (§7.6), `viewBrief` (§9.2), `answerClar` (§8.1), `deadEnd` / `compromise` / `keepWaiting`
(§8.2), `showCandidates` / `pickCandidate` / `keepSearching` (§8.3), `showOffer` / `reviewOffer` (§8.4),
`acceptOffer` (§8.5), `arriveReply` (§11), `contactAndWait` (§11) and `demoNext`'s
`offer → offer_review → complete` shortcuts.

---

## 7. The discovery run (word-by-word engine)

### 7.1 `runStep(i)`
```
s = SCRIPT[i]; if (!s) return;                                   // silently stops past the end
if (s.who === 'user' && state.mode === 'text') {
  setState({ awaitingUser: true, suggestion: s.text, stepIndex: i, scoutState: 'listening' });
  return;                                                        // waits for the user
}
showUtterance(s, i, s.text);
```

### 7.2 `showUtterance(s, i, text)`
```
words   = text.split(' ')
id      = ++this.uid
instant = state.mode === 'text' || prefersReducedMotion
setState({
  utter: { id, who: s.who, words, shown: instant ? words.length : 0 },
  scoutState: s.who === 'scout' ? 'speaking' : (state.micOn ? 'listening' : 'idle'),
  awaitingUser: false, suggestion: null, stepIndex: i,
  transcript: transcript.concat([{ who: s.who, text }]),
})
per      = (s.who === 'scout' ? 78 : 96) / sched.speed             // ms per word
this.stopReveal()                                                  // ← MANDATORY: kills the previous interval
if (!instant) reveal = setInterval(→ shown++ until words.length, per)
revealMs = instant ? 0 : words.length * per * sched.speed          // == words.length * (78|96)
hold     = s.who === 'user' ? 700 : Math.min(5200, Math.max(1800, words.length * 260))
sched.after(revealMs + hold, () => afterUtterance(s, i))           // Sched divides by speed again
```
`stopReveal()` runs **after** the `setState` and **before** the new `setInterval` is created. It is not
redundant with the `utter.id` guard: without it a rapid second utterance (`useSuggestion`, `demoNext`,
`switchToVoice`, `submitDiscovery`) leaves the previous interval ticking forever — the guard only stops
it from writing state, it never clears the handle. `this.reveal` holds a single handle, so the old one
would be lost.
The reveal interval guards on `utter.id` so a superseded utterance can never keep ticking
(and calls `stopReveal()` itself once `shown >= words.length`).
Note the third argument: `submitDiscovery` passes the **user's typed text** instead of `s.text`, so the
transcript records what the user actually wrote while the step's `facts` still apply.

### 7.3 `afterUtterance(s, i)`
```
if (s.who === 'user') { setState({ scoutState: 'thinking' });
                        processFacts(s.facts || [], 0, () => sched.after(600, () => runStep(i + 1))); }
else if (s.then === 'brief') sched.after(500, () => morphToBrief());
else                          sched.after(500, () => runStep(i + 1));
```

### 7.4 `processFacts(list, k, done)` — one capsule per fact, sequential
```
if (k >= list.length) { done(); return; }
f = list[k];
setState({ capsule: f,
           facts: alreadyHasId ? facts : facts.concat([{ id: f.id, label: f.label, arriving: true }]) });
sched.after(650, () => flyCapsule(f, () => sched.after(300, () => processFacts(list, k + 1, done))));
```
Timeline per fact: **capsule appears → 650 ms → flight starts → 400 ms → `commitFact` → flight ends (580 ms total) → 300 ms → next fact**.

### 7.5 `flyCapsule(f, done)` — FLIP clone animation
- Targets: `[data-capsule]` (source) and `[data-fact-row="<id>"]` or, as fallback, `[data-fact-summary]`.
- If either is missing, or `prefers-reduced-motion`, or no `Element.animate`:
  `setState({capsule:null}); commitFact(f); done();` — **synchronous fallback path, must be ported**.
- Otherwise: clone the capsule node, strip `data-capsule`, `animation:'none'`, absolutely position it at the
  capsule's offset inside `main` (`top` offset by `main.scrollTop`), `margin:0`, `zIndex:20`,
  `pointerEvents:'none'`, `willChange:'transform'`, append to `main`, then `setState({capsule:null})`.
- `dx = (targetLeft + 8) - capsuleLeft`, `dy = (targetTop + (targetHeight ? (targetHeight - capsuleHeight)/2 : 8)) - capsuleTop`
- Keyframes:
  ```
  [{ transform:'translate(0,0) scale(1)', opacity:1 },
   { transform:`translate(${dx*.55}px, ${dy*.5 - 46}px) scale(.96)`, opacity:1, offset:.5 },
   { transform:`translate(${dx}px, ${dy}px) scale(.9)`, opacity:0 }]
  { duration: 580, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'forwards' }
  ```
- `sched.after(400, () => commitFact(f))`; `animation.onfinish → clone.remove(); done()`.

Capsule chip style (template): `height:34px; padding:0 14px; border-radius:999px;
background:rgba(255,105,38,.16); border:1px solid rgba(255,140,90,.5); color:#ffd9c4;
font-size:14px; font-weight:500; white-space:nowrap; animation:rsFadeUp .3s ease both`.
**shadcn candidate: `Badge`** (variant customised) — but the flight animation stays `custom`.

### 7.6 `morphToBrief()`
```
stopReveal();
setState({ stage:'brief_review', utter:null, capsule:null, scoutState:'idle',
           listMode:'card', awaitingUser:false, suggestion:null });
sched.after(450, () => setState({ headlineShown: true }));
sched.after(950, () => setState({ cardArrived: true }));
```
The fact list does **not** unmount — `listMode` flips `'float' → 'card'` and the same element animates
(`listLeft/listTop/listWidth/listPad/listRadius/listBg/listBorder/listShadow/listGap`), which is why the
port must keep one shared node rather than two components.

### 7.7 Timing table — full unattended run at `speed = 1`

| t (ms, cumulative) | event |
| --- | --- |
| 0 | `startVoice` → `go('discovery')` |
| 500 | `runStep(0)` — scout line 0 begins. **13 words** („Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?“ → `split(' ')` gives 13): reveal = 13 × 78 = **1014 ms**, hold = min(5200, max(1800, 13 × 260 = 3380)) = **3380 ms**, so `after(4394)` |
| 4894 | `afterUtterance(s0, 0)` — scout line, no `then` → `after(500)` |
| **5394** | `runStep(1)` — user line 1 (16 words × 96 ms = 1536 reveal, hold 700 → `after(2236)`) |
| 7630 | `afterUtterance` → `scoutState:'thinking'`, then 3 capsules × (650 + 580 + 300) = 4590 ms |
| 12220 | `processFacts` done → `after(600)` |
| 12820 | `runStep(2)` — scout „Welche Tage …“ |
| … | pattern repeats for steps 3–6 (scout: 78 ms/word + hold ≥ 1800, then 500 ms gap; user: 96 ms/word + 700 ms hold, then facts, then 600 ms gap) |
| after step 7 | `+500` → `morphToBrief()`; `+450` headline; `+950` card |
| `startScouting` | guard `stage === 'brief_review'`; `sched.clear()`; then `stage:'scouting'`, `editing:false`, `listMode:'leaving'`, `status = START_LINE`, `scoutState:'speaking'`, `transcript += START_LINE`, **`activity = [ACT.start]`** (assignment, see §6.4); `+600` `listMode:'hidden'`; `scheduleScouting(3800)` |
| +3800 | `status = STATUS[0]`, `scoutState:'idle'` |
| +7800 | `status = STATUS[1]`, activity += `ACT.found` |
| +11800 | `attemptContact()` |
| `contactAndWait` | `status = STATUS[2]`, `pending:null`, `waitingFor:null`, activity += `ACT.contacted`; `+3000` → `stage:'waiting'`, `STATUS[3]`, activity += `ACT.waiting`; `+10000` → `arriveReply()` |
| `arriveReply` | guards `AUTOPILOT.includes(stage) && !waitingFor`; then `stage:'clarification'`, `scoutState:'idle'`, `activityOpen:false`, `briefOpen:false`, `clar` reset to `{ userText:null, scoutText:null }`, activity += `ACT.notif`, `ACT.read`; toast „Dein Scout hat eine Rückfrage“ (full body in §11) |
| `answerClar(true)` | `+650` scout reply, `+2300` `stage:'following_up'`, then `+5000` from **that** callback → `showOffer()` at +7300 after the call |

The absolute figures assume the **animated** capsule path (650 + 580 + 300 per fact). With
`prefers-reduced-motion`, a missing `[data-capsule]`/target node, or no `Element.animate`, `flyCapsule`
takes its synchronous fallback (§7.5) and a fact costs 650 + 300 = 950 ms instead — the run is then
1740 ms shorter per user line with three facts. Text mode additionally makes every reveal instant
(`revealMs = 0`), leaving only the `hold`.

---

## 8. Branch flows

### 8.1 Clarification — `answerClar(yes: boolean, text: string)`

Guard: `stage === 'clarification' && !clar.userText` (one answer only).

| step | delay | state changes |
| --- | --- | --- |
| immediate | 0 | `clar = { userText: text, scoutText: null }`, `clarDraft: ''`, `transcript += { who:'user', text }` |
| reply | +650 | `scoutState:'speaking'`, `clar.scoutText = yes ? YES_REPLY : NO_REPLY`, `transcript += { who:'scout', text: reply }`; if `yes`: fact `zeit` → „Mittwoch oder Donnerstag ab 19 Uhr“ with `changed:true` |
| commit | +2300 | `stage = yes ? 'following_up' : 'waiting'`, `scoutState:'idle'`, `status = yes ? FOLLOW_STATUS : ALT_STATUS`, **all** facts `changed:false`, `activity += yes ? ACT.confirmed : ACT.alt` |
| follow-up | +2300 then +5000 (yes) | `showOffer()` |
| follow-up | +2300 then +6000 (no) | `deadEnd()` |

Entry points:
- `clarYes()` → `answerClar(true, YES_TEXT)`
- `clarNo()` → `answerClar(false, NO_TEXT)`
- `submitClar` (typed) — wrapped in `bind` (§1.4), so it calls `preventDefault()` first:
  `t = clarDraft.trim()`; abort when empty; `l = t.toLowerCase()`
  - `/\bnein\b|nicht|donnerstag ist wichtig/.test(l)` → `answerClar(false, t)`
  - else `/mittwoch|\bja\b|passt|ok|gern|klar/.test(l)` → `answerClar(true, t)`
  - else hint „Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“.“
- `clarVoice()` → hint „Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text.“

**shadcn candidates:** answer chips = `Button` (outline / secondary); message bubbles = `custom`; input row = `Input` + icon `Button`.

### 8.2 Dead end — `deadEnd()` / `compromise(kind)` / `keepWaiting()`

`deadEnd()` — guard `stage === 'waiting'`:
`stage:'dead_end'`, `scoutState:'idle'`, `status:''`, `briefOpen:false`, `activityOpen:false`,
`activity += ACT2.declined, ACT2.noMatch`; toast „Dein Scout braucht eine Entscheidung“.

`compromise(kind)` — guard `stage === 'dead_end'`. Map:

| kind | fact id | new label | scout line (also pushed to transcript + shown as `status`) |
| --- | --- | --- | --- |
| `budget` | `budget` | „Bis 400 € / Monat“ | „Alles klar, bis 400 Euro. Ich suche erneut in Stuttgart.“ |
| `umland` | `ort` | „Stuttgart & Umland“ | „Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach.“ |
| `zeit` | `zeit` | „Mittwoch oder Donnerstag ab 19 Uhr“ | „Alles klar, Mittwoch geht also auch. Ich frage den Raum in Stuttgart-West erneut an.“ |

Common: `stage:'scouting'`, `offer: OFFER0`, fact updated with `changed:true`, `status = line`,
`scoutState:'speaking'`, `transcript += { who:'scout', text: line }`,
`activity += { text: 'Suchauftrag angepasst: ' + label }`, `logChange('Suchauftrag angepasst: ' + label)`,
`after(1200)` → all facts `changed:false`.

Then, branch:
- `kind === 'zeit'`: `after(3500)` → `stage:'following_up'`, `status = FOLLOW_STATUS`, `scoutState:'idle'`;
  `after(8500)` → `showOffer()`.
- otherwise: `after(3500)` → `status = 'Ich suche erneut mit den neuen Kriterien.'`, `scoutState:'idle'`;
  `after(7000)` → `showCandidates()`.

`keepWaiting()` — guard `stage === 'dead_end'`:
`stage:'waiting'`, `status: 'Alles klar, ich suche im Hintergrund weiter und melde mich.'`, `scoutState:'idle'`.
**No timer is scheduled** — the demo parks here until the user uses the demo controls.

### 8.3 Candidates — `showCandidates()` / `pickCandidate(id)` / `keepSearching()`

`showCandidates()` — guard `AUTOPILOT.includes(stage)`:
`stage:'candidates'`, `scoutState:'idle'`, `briefOpen:false`, `activityOpen:false`,
`activity += ACT2.found2`; toast „Dein Scout hat Räume zum Vergleichen“.

`pickCandidate(id)` — guard candidate exists **and** `stage === 'candidates'`:
`stage:'following_up'`, `offer = c`, `scoutState:'idle'`,
`status = 'Ich frage beim ' + c.name + ' nach einem Angebot und kläre die Details.'`
(e.g. „Ich frage beim Raum in Esslingen nach einem Angebot und kläre die Details.“),
`activity += { text: 'Angebot angefragt: ' + c.short }`; `after(5000)` → `showOffer()`.

`keepSearching()` — no guard:
`stage:'waiting'`, `status: 'Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt.'`,
`scoutState:'idle'`. **No timer** — parks the demo.

Candidate view-model (`cands`) computed each render:
```
budgetNum = Number((budgetFact?.label ?? '350').replace(/\D/g,'')) || 350      // 350, or 400 after the budget compromise
ortLabel  = ortFact?.label ?? 'Stuttgart'
fits      = c.priceNum <= budgetNum
inArea    = c.id !== 'esslingen' || /Umland/.test(ortLabel)
best      = candidates.filter(fits && storageOk && inArea).sort(by priceNum asc)[0]
```
| prop | value |
| --- | --- |
| `best` | `best?.id === c.id` → renders the „Mein Vorschlag“ pill (`background:#ff6926; color:#fff; font-size:12.5px; font-weight:600; letter-spacing:.04em; padding:5px 11px; border-radius:999px; position:absolute; top:14px; left:14px`) |
| `budgetText` | `fits ? 'Im Budget' : 'Über eurem Budget (' + budgetNum + ' €)'` |
| `budgetColor` | `fits ? '#a89684' : '#e0a13a'` |
| `border` | best → `'rgba(255,140,90,.5)'`, else `'rgba(255,200,160,.14)'` |
| `btnBg` | best → `'#ff6926'`, else `'rgba(255,255,255,.06)'` |
| `btnBorder` | best → `'#ff6926'`, else `'rgba(255,220,190,.28)'` |
| `storageOk` / `storageNo` | icon switch (orange check vs. muted cross) |
| `hasPhoto` / `noPhoto` | photo vs. striped placeholder |
| `fits`, `over`, `outside` | computed but **not referenced by the template** — dead bindings |
| `pick` | `() => pickCandidate(c.id)` |

Grid: `candCols = narrow ? '1fr' : 'repeat(3, minmax(0,1fr))'`, container `width: min(1180px,100%)`, `gap:14px`.
Headline binding `candHeadline = 'Drei Räume, die in Frage kommen.'` (defined in the script, not the template).
**shadcn candidate:** each tile = `Card` (`CardHeader`/`CardContent`/`CardFooter`), best-pill = `Badge`, action = `Button`.

### 8.4 Offer — `showOffer()` / `talkOffer()` / `reviewOffer()`

`showOffer()` — guard `stage === 'following_up'`:
`stage:'offer'`, `scoutState:'idle'`, `briefOpen:false`, `activityOpen:false`, `activity += ACT.offer`;
toast „Ein Angebot ist eingegangen“.

Offer view-model:
| binding | expression | value for `west` |
| --- | --- | --- |
| `offerTitle` | `'Euer ' + offer.name.replace('Raum in','Raum in')` (a **no-op** replace) | „Euer Raum in Stuttgart-West“ |
| `offerPriceNum` | `offer.price.split(' ')[0] + ' €'` | „280 €“ |
| `offerTime` | `offer.time` | „Mittwochs, 19–22 Uhr“ |
| `offerStorage` | `offer.storage` | „Schlagzeug kann im Raum bleiben“ |
| `offerPhoto` | `offer.photo \|\| 'assets/proberaum.png'` | `assets/proberaum.png` |
| `offerHasPhoto` / `offerNoPhoto` | `!!offer.photo` / `!offer.photo` | `true` / `false` |
| `offerShort` | `offer.short` | „Stuttgart-West“ — **unused by the template** |
| `reviewTitle` | `offer.name` | „Raum in Stuttgart-West“ |
| `reviewPrice` | `offer.price` | „280 € / Monat“ |
| `completeSummary` | `offer.short + ' · ' + offer.price + ' · ' + offer.timeLower` | „Stuttgart-West · 280 € / Monat · mittwochs 19–22 Uhr“ |
| `offerCols` | `narrow ? '1fr' : 'minmax(0,1fr) minmax(0,1.05fr)'` | |
| `offerImgMin` / `offerImgMax` | `narrow ? 200 : 380` / `narrow ? 240 : 470` px | |
| `offerPrompt` | `offerTalk ? 'Dein Scout' : 'Soll ich euch das Angebot erklären?'` | |
| `offerPillTop` | `briefOpen ? 10 : 34` px | |

`talkOffer()` — `offerTalk = OFFER_TALK`, `scoutState:'speaking'`; `after(6500)` → if still `stage === 'offer'`, `scoutState:'idle'`.
`reviewOffer()` — `sched.clear()`; `stage:'offer_review'`, `offerTalk:null`, `scoutState:'idle'`, `briefOpen:false`.

`offerStale` banner (visible on the offer screen when `offerStale`): „Nach deiner Änderung muss das Angebot erneut geprüft werden.“ + link „Angaben ansehen“ → `openKnowledge()` → `openSettings('knowledge')`.
**shadcn candidates:** hero = `Card` with an image column, stale banner = `Alert` (warning), CTA = `Button`, „Mit Scout sprechen“ = `Button` (outline).

### 8.5 Review + Q&A — `toggleTerms` / `acceptOffer` / `toggleQuestion` / `askQa` / `submitQa`

| binding | behaviour |
| --- | --- |
| `fullTerms` | boolean disclosure |
| `termsLabel` | `fullTerms ? 'Vollständige Bedingungen ausblenden' : 'Vollständige Bedingungen anzeigen'` |
| `termsRot` | `fullTerms ? 'rotate(180deg)' : 'none'` |
| `toggleTerms` | flips `fullTerms` |
| `acceptOffer` | `sched.clear()`; `stage:'complete'`, `scoutState:'idle'`, `questionOpen:false` |
| `questionOpen` / `toggleQuestion` | Q&A disclosure |
| `qa` / `qaHidden` | `{ q, a } \| null` / `!qa` |
| `qaDraft` / `onQaDraft` | controlled input |
| `askQa` | sets the canned pair (below) and `scoutState:'speaking'` |
| `submitQa` | wrapped in `bind` (§1.4) → `preventDefault()`; `t = qaDraft.trim()`; abort if empty; clear draft; if `/zusage\|danach\|passiert\|dann/.test(t.toLowerCase())` → `qa = { q: t, a: <canned answer> }` (note: **does not** set `scoutState`); else hint „Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage.“ |

Canned Q&A (verbatim):
- **q**: „Was passiert nach der Zusage?“
- **a**: „Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. In dieser Demo wird nichts versendet.“

**shadcn candidates:** terms disclosure = `Collapsible`, review body = `Card`, accept = `Button`, Q&A chip = `Button` (outline)/`Badge`, input = `Input`.

### 8.6 Complete — `restart()`
`restart()` → `go('welcome')` (full reset of the stage group; persistent settings survive).

---

## 9. Voice vs. text mode

`state.mode` is the switch; `flags.voice` (operator flag) can disable voice entirely.

| Handler | Behaviour |
| --- | --- |
| `startVoice()` | if `!flags.voice`: `go('discovery', { mode: 'text' })` **and** `showHint('Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus.')`. Otherwise `go('discovery', { mode: 'voice', micOn: true })`. |
| `startText()` | `go('discovery', { mode: 'text' })` |
| `switchToText()` | `setState({ mode: 'text' })` — an in-flight reveal keeps running; the next `runStep` on a user line will pause for input. |
| `switchToVoice()` | `setState({ mode: 'voice', micOn: true })`; if `awaitingUser` was true, `after(400)` → re-check `awaitingUser` and `showUtterance(SCRIPT[stepIndex], stepIndex, SCRIPT[stepIndex].text)` — i.e. the pending user line is *spoken* instead of typed. |
| `toggleMic()` | `micOn = !micOn`; `scoutState`: if it was `'listening'` **and** `micOn` was true → `'idle'`; else if it was `'idle'`, `micOn` was false, and `utter?.who === 'user'` → `'listening'`; otherwise unchanged. |
| `voiceOff` | binding `!flags.voice` — computed but **not used by the template** (dead binding). |

Mode-dependent derived values:

| binding | text mode | voice mode |
| --- | --- | --- |
| `instant` reveal (internal) | `true` (whole line at once) | `false` unless reduced motion |
| `voiceControls` | `false` | `!convoEnded` |
| `textControls` | `!convoEnded` | `false` |
| `discoveryBlob` (px) | `narrow ? 88 : 104` | `narrow ? 120 : 160` |
| `utterSize` | `narrow ? '24px' : 'clamp(24px,3vw,36px)'` | `narrow ? '28px' : 'clamp(28px,3.6vw,46px)'` |

Voice control cluster: `ctrl = narrow ? 60 : 76` (button diameter), `ctrlGap = narrow ? 20 : 34`, `ctrlFont = narrow ? 12.5 : 14`.
Mic button colours: `micBg = micOn ? '#ff6926' : 'rgba(255,255,255,.07)'`,
`micBorder = micOn ? '#ff6926' : 'rgba(255,220,190,.16)'`,
`micShadow = micOn ? '0 6px 24px rgba(255,105,38,.3)' : 'none'`,
`micLabel = micOn ? 'Mikro an' : 'Mikro aus'`, `micOff = !micOn` (adds the strike-through path to the icon).

`scoutStateText` (shown next to `utterLabel`, suppressed once `convoEnded`):
```
speaking  → null
listening → micOn ? 'Ich höre zu' : 'Mikro aus'
thinking  → 'Ich denke kurz nach'
idle      → null
```
`utterLabel = convoEnded ? '' : (utter ? (utter.who === 'scout' ? 'Dein Scout' : 'Du') : 'Dein Scout')`.

`blobAnim` by `scoutState`:
```
speaking  → 'rsSpeak 1.7s ease-in-out infinite'
listening → 'rsListen 4.2s ease-in-out infinite'
thinking  → 'rsBreathe 2.4s ease-in-out infinite'
idle      → 'rsBreathe 5.2s ease-in-out infinite'
```

### 9.1 Text-mode input

| binding | value |
| --- | --- |
| `suggestion` | `awaitingUser ? state.suggestion : null` |
| `useSuggestion()` | if `awaitingUser`: `showUtterance(SCRIPT[stepIndex], stepIndex, SCRIPT[stepIndex].text)` |
| `discoveryPlaceholder` | `awaitingUser ? 'Antwort an deinen Scout …' : 'Dein Scout spricht …'` (note the ellipsis character `…` preceded by a space) |
| `submitDiscovery` | wrapped in `bind` (§1.4) → `preventDefault()`; `t = draft.trim()`, abort if empty. If `!awaitingUser` → hint „Der Scout ist noch nicht fertig. Gleich kannst du antworten.“ Else if `matches(t, SCRIPT[stepIndex].text)` → `draft:''` + `showUtterance(step, stepIndex, t)`. Else → hint „Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich.“ |

**shadcn candidates:** suggestion chip = `Button` (outline, pill) or `Badge` as button; composer = `Input` inside a rounded shell + two icon `Button`s; mode switch link = `Button` (link/ghost).

### 9.2 Ending / resuming the conversation

| handler | behaviour |
| --- | --- |
| `endConvo()` | `sched.pause()`, `stopReveal()`, `convoEnded:true`, `scoutState:'idle'`, `capsule:null`. Screen shows „Gespräch beendet. Eure Wünsche bleiben als Entwurf gespeichert.“ |
| `resumeConvo()` | `convoEnded:false`, `scoutState = utter ? (utter.who === 'scout' ? 'speaking' : 'listening') : 'idle'`; `sched.resume()` unless `demoPaused`; if `awaitingUser === false && !utter` → `after(300)` → `runStep(stepIndex)`. |
| `viewBrief()` | `sched.clear()`; `convoEnded:false`, `stage:'brief_review'`, `utter:null`, `listMode:'card'`, `headlineShown:true`, `cardArrived:true`, `scoutState:'idle'`. Visible only when `hasFacts` (`facts.length > 0`). |
| `toggleTranscript()` | flips `transcriptOpen` |

---

## 10. Pause / hold / resume

Three independent pause concepts, all driving the **same single** `Sched.paused` flag — which is the
source of the desync below:

| Concept | State | Handler | Scheduler effect |
| --- | --- | --- | --- |
| Product pause („Suche pausieren“) | `searchPaused` | `toggleSearchPause()` | `p = !searchPaused; setState({searchPaused: p}); if (p) sched.pause(); else if (!demoPaused) sched.resume();` |
| Session hold (user opened Settings/Operator during discovery) | `sessionHeld` | `holdSession()` / `backToScout()` | pause on open, resume on return |
| Demo pause (NOT product UI) | `demoPaused` | `toggleDemoPause()` | see §17 |

> **⚠ State ↔ scheduler desync (prototype defect, decide before porting).** There is one `Sched.paused`
> flag but three state flags, and **nothing resets `Sched.paused` on a stage change**: `go()` only calls
> `sched.clear()`, and `clear()` leaves `paused` as it is. Meanwhile `baseFor` sets `searchPaused:false`
> and `onChapter` passes `{ demoPaused:false }` without ever calling `sched.resume()`. So:
> pause anywhere (`endConvo` → `sched.pause()`, „Suche pausieren“, demo „Pausieren“) → jump a chapter or
> hit `restart()` → the UI reads „running“, but every timer queued afterwards is pushed **unarmed** and
> the demo sits still forever. `resume()` is only reachable from `backToScout()`, `resumeConvo()`,
> `toggleSearchPause()` and `toggleDemoPause()`, each of which is additionally gated on the *other*
> two flags. The port should either derive `paused` from `searchPaused || sessionHeld || demoPaused`
> (one source of truth) or clear it in the stage-reset action. See defect #9 in §19.1.

`holdSession()`:
```
hold = stage === 'discovery' && !convoEnded && !demoPaused && !sched.paused;
if (hold) { sched.pause(); stopReveal(); }
return hold;
```

`openSettings(page)` → `hold = holdSession()`; `setState({ view:'settings', settingsPage: page ?? current, menuOpen:false, sessionHeld: hold || prev, transcriptOpen:false })`.
`openOperator()` → same, `view:'operator'` (no page argument).

`backToScout()` (the method):
```
if (sessionHeld && !demoPaused && !searchPaused) {
  sched.resume();
  if (utter && utter.shown < utter.words.length) setState(utter.shown = utter.words.length);  // snap the reveal to complete
}
setState({ view:'scout', sessionHeld:false, menuOpen:false, toast:null, settingsDirty:false });
```

`props.backToScout` (the binding) is different — it is the **guarded** version:
```
setState(st => ({ backReq: st.backReq + 1, menuOpen: false }),
  () => { if (view !== 'settings' || !settingsDirty) this.backToScout(); });
```
i.e. it always bumps `backReq` (which the Settings child watches to raise its own unsaved-changes dialog)
and only navigates immediately when Settings is clean.

Header pause affordances:
- `showScoutBadge = AUTOPILOT.includes(stage)`
- `badgeText = searchPaused ? 'Suche pausiert' : 'Scout ist unterwegs'`
- `badgeDotColor = searchPaused ? '#a89684' : '#ff6926'`
- `badgeDotAnim = searchPaused ? 'none' : 'rsDot 2.4s ease-in-out infinite'`
- `badgeTextVisible = !narrow` (icon-only dot on phones)
- `pauseLabel = searchPaused ? 'Suche fortsetzen' : 'Suche pausieren'`
- `searchPaused` also renders a big „Fortsetzen“ button under the autopilot status line.

**shadcn candidates:** badge = `Badge` (with a `custom` pulsing dot), pause button = `Button` (ghost, icon) + `Tooltip`.

---

## 11. Autonomy gating — `attemptContact()` and the release flow

```
attemptContact() {
  if (!AUTOPILOT.includes(stage)) return;
  if (activity.some(a => a === ACT.contacted)) return;                       // already contacted, idempotent
  src = sources.find(s => s.id === 'roomscout');

  if (!usableSources(state).length || !src.enabled)                          // A · no usable source
    → status: 'Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen.'
      waitingFor: 'source', pending: null; return;

  if (src.access !== 'connected')                                            // B · portal login expired
    → status: 'Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.'
      waitingFor: 'access', pending: null; return;

  if (rules.mode === 'review' || !rules.contact) {                           // C · needs release
    budget = facts.budget?.label ?? 'bis 350 € / Monat';
    text = 'Hallo, wir sind ' + name + ', eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, '
         + budget.replace('Bis','bis') + ', donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. '
         + 'Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, ' + name + ' (über RoomScout)';
    → pending: { to: 'Anbieter · Raum in Stuttgart-West · roomscout.dev', text,
                 reason: !rules.contact ? 'contact' : 'review' }
      status: 'Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst.'
      waitingFor: 'release'
      notify('Dein Scout wartet auf deine Freigabe');
    return;
  }
  contactAndWait();                                                          // D · autopilot, go
}
```

Rendered pending message with the default state:
> „Hallo, wir sind Herzbuben, eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, bis 350 € / Monat, donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, Herzbuben (über RoomScout)“

`contactAndWait()`:
```
status: STATUS[2], pending: null, waitingFor: null, activity += ACT.contacted
after(3000)  → stage: 'waiting', status: STATUS[3], activity += ACT.waiting
after(10000) → arriveReply()
```

`arriveReply()` — the portal answer that opens the clarification (plain `setState`, no `go()`):
```
arriveReply() {
  if (!AUTOPILOT.includes(this.state.stage) || this.state.waitingFor) return;   // ← TWO guards
  this.setState(st => ({
    stage: 'clarification', scoutState: 'idle',
    activityOpen: false, briefOpen: false,                    // both disclosures collapse
    clar: { userText: null, scoutText: null },                // reset → the screen opens unanswered
    activity: st.activity.concat([ACT.notif, ACT.read]),
  }));
  this.notify('Dein Scout hat eine Rückfrage');
}
```
Callers: `contactAndWait()` (`after(10000)`) and `enter('waiting')` (`after(7000)`).

The second guard is load-bearing for the blocked flows: a scout that is waiting on
`waitingFor === 'source' | 'access' | 'release'` **silently swallows** the scheduled reply — the timer
fires, nothing happens, and it is never re-armed. The only way back is
`releaseMessage()` / `toggleSource()` / `setAccess()` → `attemptContact()` → `contactAndWait()`, which
queues a fresh 10 s timer. In the scripted demo `waitingFor` is only ever set by `attemptContact` at a
moment when no reply timer exists yet, so the guard is defensive there — but any port that keeps the
autopilot ticking while blocked depends on it.

Unblocking paths (both re-enter `attemptContact` from a `setState` callback):
- `toggleSource(id)` → after the flip, `if (waitingFor === 'source') attemptContact()`
- `setAccess(id, access)` → after the write, `if (waitingFor === 'access' && access === 'connected') attemptContact()`
- `releaseMessage()` (binding) → `if (pending) contactAndWait()`

Related bindings:
| binding | value |
| --- | --- |
| `pending` | `!!state.pending` |
| `pendingTo` | `state.pending?.to ?? ''` |
| `pendingText` | `state.pending?.text ?? ''` |
| `pendingContactOff` | `!!pending && pending.reason === 'contact'` → shows „Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe raus.“ |
| `waitingSource` | `waitingFor === 'source'` → „Quelle auswählen“ button → `openSources()` |
| `waitingAccess` | `waitingFor === 'access' \|\| (AUTOPILOT.includes(stage) && roomSrc.access !== 'connected')` → amber-dot row „Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.“ + „Zu den Zugängen“ |
| `openAutonomy()` | `openSettings('autonomy')` |
| `openSources()` | `openSettings('sources')` |
| `openKnowledge()` | `openSettings('knowledge')` |

**shadcn candidates:** release card = `Card` + `Alert`, message body = `Textarea` (read-only) or `custom` pre-block, actions = `Button` + `Button` (link).

---

## 12. Settings bridge (state that lives in this file)

### 12.1 `settingsData` (passed to `Settings.dc.html` via `dc-import data=`)

| key | value |
| --- | --- |
| `name` | `state.name` |
| `initials` | `nw = name.trim().split(/\s+/).filter(Boolean)`, then verbatim:<br>`name.trim() === 'Herzbuben' ? 'HB' : (nw.length > 1 ? nw.map(w => w[0]).join('').slice(0,2) : (nw[0] \|\| 'HB').slice(0,2)).toUpperCase()`<br>Two details the port must keep: the single-word branch falls back to the literal **`'HB'`** when the trimmed name is empty (`''` → `filter(Boolean)` → `[]` → `nw[0]` is `undefined`), and `.toUpperCase()` applies to the **whole non-Herzbuben ternary**, not to the `'HB'` shortcut. „first 2 chars“ alone would yield `''` for an empty name. |
| `stage` | current stage |
| `hasOrder` | `facts.length > 0 && stage !== 'discovery' && stage !== 'welcome'` |
| `hasFacts` | `facts.length > 0` |
| `ort` | `facts.ort?.label ?? null` |
| `facts` | `facts.filter(f => !f.arriving).map(f => ({ id, label }))` |
| `sources` | `state.sources` |
| `autoSources` | `state.autoSources` |
| `usableCount` | `usableSources(state).length` |
| `rules` | `state.rules` |
| `knowledge` | `knowledgeItems()` (§5.2) |
| `summary` | `summary()` (§5.3) |
| `knowledgeLog` | `state.knowledgeLog` |
| `notif` | `state.notif` |
| `flags` | `state.flags` |
| `incident` | `state.incident` |
| `usage` | `{ searches: (inFlow \|\| stage === 'complete') ? 1 : 0, contacted: activity.includes(ACT.contacted) ? 1 : 0, talk: 'Noch nicht erfasst' }` where `inFlow = ['scouting','waiting','following_up','clarification','offer','offer_review'].includes(stage)` |
| `session` | `sessionHeld ? 'Gespräch pausiert · läuft weiter, wenn du zurückkehrst' : (AUTOPILOT.includes(stage) ? (searchPaused ? 'Suche pausiert' : 'Scout ist unterwegs') : null)` |
| `offerStale` | `state.offerStale` |

### 12.2 `settingsActions`

| action | effect |
| --- | --- |
| `back()` | `backToScout()` (unguarded method) |
| `setPage(p)` | `settingsPage = p` |
| `setDirty(d)` | writes `settingsDirty` only when it actually changes |
| `toggleSource(id)` | flips `enabled`; may re-trigger `attemptContact()` |
| `setAutoSources(v)` | `autoSources = v` |
| `setAccess(id, a)` | sets `access`; stamps `lastAccess = now()` when `a === 'connected'`; sets `incidentResolved = true` when an incident was open and the access became `connected`; may re-trigger `attemptContact()` |
| `saveRules(r)` | `rules = r` + `logChange('Handlungsspielraum aktualisiert')` |
| `setName(n)` | `name = n` (also maps `sources` through identity — a no-op re-render nudge) |
| `updateFact(id, label)` | §4.1 |
| `updateKnowledge(id, patch, logText)` | merges `patch` into the knowledge item; `logChange(logText)` when given |
| `addKnowledge(items)` | appends; `logChange(items.length + ' Angaben aus Beispiel-Kontext übernommen')` |
| `setNotif(n)` | `notif = n` |
| `exportData()` | returns `{ name, facts: settingsData.facts, knowledge: settingsData.knowledge, sources: sources.map(({id,enabled,access}) => …), rules, notif, hinweis: 'Lokale Demo-Daten des Designprototyps' }` |

Also passed: `settingsPage` (current page id) and `backReq` (the guard counter, §10).
Settings footer copy rendered by *this* file: „Designprototyp · Beispieldaten“.

---

## 13. Operator bridge & incident flow

`opData = { sources, flags, incident, incidentResolved, contacted: activity.includes(ACT.contacted), stage }`

`opActions`:
| action | effect |
| --- | --- |
| `back()` | `backToScout()` |
| `setPage(p)` | `opPage = p` |
| `setFlags(f)` | `flags = f` (`{ voice, publicSearch }`) |
| `loadIncident()` | see below |
| `renewLogin()` | `setAccess('roomscout', 'connected')` — resolves the incident and, if `waitingFor === 'access'`, immediately resumes `attemptContact()` |

`loadIncident()`:
```
incident: true, incidentResolved: false,
sources: roomscout.access = 'expired',
view: 'operator', opPage: 'overview', menuOpen: false
```
It is reachable from the Scout surface via `props.loadIncident` (wired only into the demo bar) and from
`opActions.loadIncident`. The resolution loop is: incident → `roomscout.access = 'expired'` →
the Scout screen shows the `waitingAccess` row → operator/user calls `setAccess('roomscout','connected')` →
`incidentResolved = true` and the blocked `attemptContact()` continues.

**shadcn candidates:** Operator shell = the sidebar-13 `Dialog` + `Sidebar` + `Breadcrumb` block; incident = `Alert` (destructive) + `Button`.

---

## 14. Toast, hint and transcript

| Surface | State | Rules |
| --- | --- | --- |
| Toast | `toast: string \| null` | `notify(text)` sets it **only when `view !== 'scout'`**. Bindings `toast`, `dismissToast()` (`toast:null`), `toastGo()` (`backToScout()`, which also clears it). Copy is always one of the five notify strings (§16). **shadcn candidate: `Sonner`/`Toast`.** |
| Hint | `hint: string \| null` | `showHint(t)` sets it and schedules `after(4200)` → clear **only if `hint === t`** (so a newer hint wins). Bottom-centre pill. **shadcn candidate: `Sonner` (bottom-center) or `Alert`.** |
| Transcript | `transcript: {who,text}[]`, `transcriptOpen` | Right-hand panel. `transcriptEmpty = transcript.length === 0` → „Noch keine Äußerungen.“ Closed by `openSettings`/`openOperator`. **shadcn candidate: `Sheet` (side=right) + `ScrollArea`.** |

Transcript row view-model:
```
who    = m.who === 'scout' ? 'Dein Scout' : 'Du'
align  = m.who === 'scout' ? 'flex-start' : 'flex-end'
radius = m.who === 'scout' ? '14px 14px 14px 4px' : '14px 14px 4px 14px'
bg     = m.who === 'scout' ? 'rgba(255,255,255,.06)' : 'rgba(120,58,22,.6)'
```

Everything that appends to `transcript`: `showUtterance` (every spoken/typed line), `startScouting`
(`START_LINE`), `answerClar` (user text + scout reply), `compromise` (the scout line), and `baseFor`
for stage jumps.

---

## 15. Layout / responsive variants carried in the script

`narrow = state.narrow || mobile`, where `mobile = state.mobile ?? props.mobile`.

| binding | narrow | wide |
| --- | --- | --- |
| `hdrPad` | `'0 18px'` | `'0 36px'` |
| `hdrH` | `64` | `84` |
| `markSize` | `17` | `20` |
| `hdrBtn` | `38` | `42` |
| `hdrGap` | `10` | `14` |
| `badgeTextVisible` | `false` | `true` |
| `autoBlob` / `autoBlobMb` | `112` / `30` | `160` / `48` |
| `autoH1` | `'34px'` | `'clamp(36px,5vw,58px)'` |
| `welcomeBlob` / `welcomeBlobMb` | `128` / `36` | `168` / `56` |
| `ctrl` / `ctrlGap` / `ctrlFont` | `60` / `20` / `12.5` | `76` / `34` / `14` |
| `discoveryPadBottom` | `sheetVisible ? 96 : 32` | same expression |
| `candCols` | `'1fr'` | `'repeat(3, minmax(0,1fr))'` |
| `offerCols` | `'1fr'` | `'minmax(0,1fr) minmax(0,1.05fr)'` |
| `offerImgMin` / `offerImgMax` | `200` / `240` | `380` / `470` |
| `briefSpacerHeight` | `40` | `60 + facts.length * 56 + 240` |
| `utterMaxWidth` | `'760px'` | `(!narrow && facts.length) ? 'min(760px, calc(100vw - 660px))' : '760px'` |

**Phone frame** (demo chrome, driven by `mobile`):
`stL/stT = mobile ? '50%' : '0'`, `stW = mobile ? '390px' : '100%'`,
`stH = mobile ? 'min(844px, calc(100% - 32px))' : '100%'`,
`stTf = mobile ? 'translate(-50%,-50%)' : 'none'`, `stR = mobile ? '44px' : '0'`,
`stB = mobile ? '1px solid rgba(255,220,190,.2)' : '0'`, `mobileBtnBg = mobile ? 'rgba(255,105,38,.35)' : 'rgba(255,255,255,.06)'`.
**Do not port the phone frame** — it belongs to the demo chrome; port only the `narrow` breakpoint behaviour.

**Fact-list ↔ card morph** (one element, `listMode`):
```
card       = listMode === 'card' || listMode === 'leaving'
cardTop    = 236
cardW      = Math.min(540, Math.max(280, (mainRef.current?.clientWidth ?? 600) - 32))
listVisible= !narrow && listMode !== 'hidden' && (listMode !== 'float' || facts.length > 0)
listLeft   = card ? `calc(50% - ${cardW/2}px)` : 'calc(100% - 312px)'
listTop    = card ? 236 : 20
listWidth  = card ? cardW : 288
listPad    = card ? '26px 28px 28px' : '12px 14px 12px'
listRadius = card ? 26 : 16
listBg     = card ? 'rgba(18,14,12,.74)' : 'rgba(18,14,12,.42)'
listBorder = card ? 'rgba(255,200,160,.16)' : 'rgba(255,200,160,.10)'
listShadow = card ? '0 30px 80px rgba(0,0,0,.35)' : 'none'
listGap    = card ? 6 : 2
listOpacity   = listMode === 'leaving' ? 0 : 1
listTransform = listMode === 'leaving' ? 'scale(.94) translateY(10px)' : 'none'
listHeadMb        = card ? 10 : 4
listHeadFont      = card ? 22 : 11.5
listHeadWeight    = card ? 400 : 500
listHeadSpacing   = card ? '-.01em' : '.09em'
listHeadTransform = card ? 'none' : 'uppercase'
listHeadColor     = card ? '#f5ece2' : '#a89684'
showEditBtn  = card && cardArrived && !editing
cardActions  = card && cardArrived && !editing && stage === 'brief_review'
headlineOpacity = headlineShown ? 1 : 0
```
**shadcn candidate:** the card = `Card`; the floating variant + morph = `custom`.

**Narrow bottom sheet** (replaces the floating list on phones):
```
sheetCard    = narrow && stage === 'brief_review'
sheetVisible = narrow && facts.length > 0 && (stage === 'discovery' || stage === 'brief_review') && listMode !== 'hidden'
shSide       = sheetCard ? 0 : 12          shBottom     = sheetCard ? 0 : 12
shRadius     = sheetCard ? '26px 26px 0 0' : '20px'
shPad        = sheetCard ? '22px 22px 26px' : '8px 14px 8px'
shTitleSize  = sheetCard ? 22 : 15         shTitleWeight = sheetCard ? 400 : 500
shTitle      = sheetCard ? 'Euer Suchauftrag'
                         : facts.length + (facts.length === 1 ? ' Wunsch gemerkt' : ' Wünsche gemerkt')
shRowsVisible= sheetCard || briefOpen      shChevron  = !sheetCard
shChevRot    = briefOpen ? 'rotate(180deg)' : 'none'
shActions    = sheetCard && cardArrived && !editing
shEditBtn    = sheetCard && cardArrived && !editing
shEditing    = sheetCard && editing
```
**shadcn candidate: `Drawer`** (vaul) or `Sheet` (`side="bottom"`), rows `custom`.

Autopilot brief pill: `compactBudget = facts.budget?.label ?? 'bis 350 €'`,
`compactBrief = 'Stuttgart · ' + compactBudget.replace('Bis ','bis ').replace(' / Monat','')`
→ „Stuttgart · bis 350 €“. **The city is hard-coded** — it does not follow the `ort` fact
(so after the Umland compromise it still reads „Stuttgart · bis 350 €“). Preserve or fix deliberately.
`chevRot` / `chevRotUp` = `briefOpen ? 'rotate(180deg)' : 'none'`.
`activityLabel = activityOpen ? 'Aktivität ausblenden' : 'Aktivität ansehen'`.
`activity` rows: `{ text, meta: a.meta ?? null, dot: isLast ? '#ff6926' : 'rgba(255,220,190,.35)' }`.
**shadcn candidates:** brief pill = `Button` (outline, pill) driving a `Collapsible`; activity list = `custom` timeline inside a `Collapsible`.

---

## 16. Notifications (`notify`) — the five toast strings

| trigger | text |
| --- | --- |
| `attemptContact` case C | „Dein Scout wartet auf deine Freigabe“ |
| `arriveReply` | „Dein Scout hat eine Rückfrage“ |
| `deadEnd` | „Dein Scout braucht eine Entscheidung“ |
| `showCandidates` | „Dein Scout hat Räume zum Vergleichen“ |
| `showOffer` | „Ein Angebot ist eingegangen“ |

(Five in total — `notify()` is called from exactly these five places: `attemptContact` case C,
`arriveReply`, `deadEnd`, `showCandidates` and `showOffer`. All only surface while the user is in
Settings or Operator, because `notify` no-ops when `view === 'scout'`.)

---

## 17. Demo controls — **NOT TO BE BUILT**

Everything in this section is prototype scaffolding. It must **not** ship in the ported app.
It is documented only so the port can recognise and drop it, and so QA can reproduce states.

| binding | behaviour |
| --- | --- |
| `demoOpen` / `demoClosed` / `toggleDemo()` | show/hide the monospace control bar. Collapsed label „Prototyp · Demo-Steuerung“; expanded prefix „Prototyp · Beispieldaten“. |
| `demoPaused` / `demoRunning` / `demoPauseLabel` | `demoPauseLabel = demoPaused ? 'Abspielen' : 'Pausieren'` |
| `toggleDemoPause()` | `p = !demoPaused`; if `p` → `sched.pause()` + `stopReveal()`; else if `!searchPaused` → `sched.resume()` and snap any partial reveal to complete. |
| `demoNext()` | 1) if a reveal is mid-flight → `stopReveal()` + snap `shown = words.length`; 2) if `awaitingUser` → `showUtterance(SCRIPT[stepIndex], stepIndex, SCRIPT[stepIndex].text)` and return; 3) if `stage === 'welcome'` → `go('discovery', { mode:'voice' })`; 4) else `sched.skip()`; if nothing was queued (`i = STAGES.indexOf(stage)`): `brief_review → startScouting()`, `clarification → answerClar(true, YES_TEXT)`, `offer → stage:'offer_review'`, `offer_review → stage:'complete'`, **else only if `i >= 0 && i < STAGES.length - 1`** → `go(STAGES[i + 1])`. Because `dead_end` and `candidates` are not in `STAGES` (`indexOf` → `-1`) and `complete` is the last entry, `demoNext()` does **nothing at all** in those three stages once the queue is empty — a QA dead end in the very control that exists to reproduce states (use the chapter select instead). |
| `onChapter(e)` | `go(e.target.value, { demoPaused: false })` |
| `speedLabel` / `toggleSpeed()` | `speed` toggles `1 ↔ 1.6`; also writes `sched.speed`. Label `'1×'` / `'1.6×'`. |
| `toggleMobile()` | `mobile = !mobile`, `menuOpen:false` |
| `restart()` | `go('welcome')` — **this one IS product UI** on the complete screen („Demo erneut ansehen“); keep it only there. |
| `openSettings()` / `openOperator()` / `loadIncident()` | shortcuts, also reachable from the product UI (`openSettings`) — only `loadIncident` is demo-only from this bar. |

Chapter select options (verbatim): „1 · Willkommen“, „2 · Gespräch“, „3 · Suchauftrag“, „4 · Autopilot“,
„5 · Warten“, „6 · Rückfrage“, „7 · Klärung“, „7b · Sackgasse“, „7c · Kandidaten“, „8 · Angebot“,
„9 · Prüfung“, „10 · Abschluss“. Bar buttons: „Mobil“, „Einstellungen“, „Betreiberansicht“, „Beispielstörung laden“;
aria labels „Nächster Schritt“, „Zurück zum Anfang“, „Tempo“, „Kapitel“, „Steuerung ausblenden“.

---

## 18. Binding index — every key the props object exposes

Listed in source order (`renderVals()` return object). Use this to cross-reference the template doc.
Entries marked **(dead)** are computed but never referenced by `Roomscout.dc.html`.

### 18.1 Demo frame / responsive
| binding | meaning |
| --- | --- |
| `mobile` | phone-frame preview active (demo prop) |
| `toggleMobile` | toggles the phone frame (demo only) |
| `stL`, `stT`, `stW`, `stH`, `stTf`, `stR`, `stB` | phone-frame stage box: left, top, width, height, transform, border-radius, border |
| `hdrPad`, `hdrH`, `markSize`, `hdrBtn`, `hdrGap` | header padding, height, wordmark size, round-button size, gap |
| `autoBlob`, `autoBlobMb` | autopilot blob diameter and bottom margin |
| `autoH1` | autopilot headline font-size |
| `welcomeBlob`, `welcomeBlobMb` | welcome blob diameter and bottom margin |
| `badgeTextVisible` | show the badge label text (hidden when narrow) |
| `ctrl`, `ctrlGap`, `ctrlFont` | voice control button diameter, gap, label size |
| `discoveryPadBottom` | extra bottom padding when the mobile sheet is up |

### 18.2 Bottom sheet (narrow)
| binding | meaning |
| --- | --- |
| `sheetVisible` | render the bottom sheet at all |
| `shSide`, `shBottom`, `shRadius`, `shPad`, `shTitleSize`, `shTitleWeight` | sheet geometry/typography, card vs. pill variant |
| `shTitle` | sheet title („Euer Suchauftrag“ or „N Wünsche gemerkt“) |
| `shRowsVisible` | fact rows expanded |
| `shChevron`, `shChevRot` | disclosure chevron present / rotated |
| `shActions` | show „Scout losschicken“ block in the sheet |
| `shEditBtn` | show the pencil button in the sheet |
| `shEditing` | show Übernehmen/Abbrechen in the sheet |
| `mobileBtnBg` | demo bar „Mobil“ button background (demo only) |

### 18.3 Candidates
| binding | meaning |
| --- | --- |
| `isCandidates` | stage is `candidates` |
| `cands` | the three candidate view-models (§8.3) |
| `candCols` | grid template columns |
| `candHeadline` | „Drei Räume, die in Frage kommen.“ |
| `keepSearching` | „Keiner passt, weiter suchen“ → back to `waiting` |

### 18.4 Dead end
| binding | meaning |
| --- | --- |
| `isDeadEnd` | stage is `dead_end` |
| `deadBudget` | „Bis <budgetNum + 50> €“ **(dead)** |
| `compBudget`, `compUmland`, `compZeit` | the three compromise handlers |
| `keepWaiting` | „Nichts ändern, weiter suchen lassen“ |

### 18.5 Offer / review / complete data
| binding | meaning |
| --- | --- |
| `offerTitle` | „Euer Raum in …“ headline |
| `offerPriceNum` | price without the „/ Monat“ suffix |
| `offerTime`, `offerStorage` | the two confirmed bullet lines |
| `offerPhoto` | photo URL with `assets/proberaum.png` fallback |
| `offerHasPhoto`, `offerNoPhoto` | photo vs. striped placeholder |
| `offerShort` | short room name **(dead)** |
| `reviewTitle`, `reviewPrice` | review card eyebrow + price |
| `completeSummary` | the final pill „Short · Preis · Zeit“ |

### 18.6 Views / navigation / chrome
| binding | meaning |
| --- | --- |
| `isScoutView`, `isSettingsView`, `isOperatorView`, `notOperator` | which surface is mounted; `notOperator` gates the shared header |
| `name`, `initials` | account name and avatar initials |
| `menuOpen`, `toggleMenu`, `closeMenu` | avatar dropdown |
| `openSettings` | open Settings (keeps the current page) |
| `backToScout` | guarded back-navigation (bumps `backReq`, respects `settingsDirty`) |
| `settingsData`, `settingsActions`, `settingsPage`, `backReq` | props handed to the Settings child |
| `opData`, `opActions`, `opPage` | props handed to the Operator child |
| `toast`, `dismissToast`, `toastGo` | event toast text, dismiss, jump back to Scout |
| `openOperator`, `loadIncident` | operator entry points (demo bar) |
| `stage` | the current stage id (also the chapter-select value) |
| `mainRef`, `blobRef` | refs for the scroll container and the blob |
| `blobAnim` | CSS animation shorthand for the current `scoutState` |

### 18.7 Stage flags
`isWelcome`, `isDiscovery`, `isBrief`, `isAutopilot`, `isClarification`, `isOffer`, `isReview`, `isComplete`
— one boolean per scene (`isAutopilot` covers `scouting`/`waiting`/`following_up`).

### 18.8 Header search badge
| binding | meaning |
| --- | --- |
| `showScoutBadge` | badge visible (autopilot stages) |
| `badgeText` | „Scout ist unterwegs“ / „Suche pausiert“ |
| `badgeDotColor`, `badgeDotAnim` | dot colour + pulse |
| `searchPaused`, `notSearchPaused` | pause state and its inverse (icon switch) |
| `pauseLabel` | button aria-label/title |
| `toggleSearchPause` | pause/resume the search (and the scheduler) |

### 18.9 Welcome
| binding | meaning |
| --- | --- |
| `startVoice` | „Mit Scout sprechen“ (falls back to text when `flags.voice` is off) |
| `startText` | „Lieber schreiben“ |

### 18.10 Discovery
| binding | meaning |
| --- | --- |
| `discoveryBlob` | blob diameter for the current mode/width |
| `utter` | an utterance is being shown (and the conversation is not ended) |
| `utterLabel` | „Dein Scout“ / „Du“ |
| `scoutStateText` | „Ich höre zu“ / „Mikro aus“ / „Ich denke kurz nach“ / none |
| `utterText` | the revealed prefix |
| `utterHidden` | the not-yet-revealed remainder (rendered at `opacity:0` to hold layout) |
| `utterSize`, `utterMaxWidth` | headline typography for the utterance |
| `capsule`, `capsuleLabel` | the flying fact chip and its label |
| `showSummaryChip`, `summaryText`, `briefOpenInline` | legacy inline summary chip — **hard-coded `false` / `''` / `false`** (dead branches in the template) |
| `voiceControls`, `textControls` | which control cluster is rendered |
| `convoEnded` | conversation ended state |
| `hasFacts` | at least one fact captured (gates „Suchauftrag ansehen“) |
| `micOff`, `micLabel`, `micBg`, `micBorder`, `micShadow` | mic button state and styling |
| `toggleMic` | mic toggle |
| `toggleTranscript` | Mitschrift panel |
| `endConvo`, `resumeConvo`, `viewBrief` | end / resume / jump to the brief |
| `switchToText`, `switchToVoice` | mode switch |
| `suggestion`, `useSuggestion` | prepared reply chip and its handler |
| `draft`, `onDraft`, `discoveryPlaceholder`, `submitDiscovery` | the text composer |

### 18.11 Brief review / fact list
| binding | meaning |
| --- | --- |
| `headlineOpacity` | „So suche ich für euch.“ fade-in |
| `briefSpacerHeight` | reserves vertical space under the headline for the absolutely-positioned card |
| `listVisible` | render the floating/card fact list (wide layouts only) |
| `editing` | edit mode (shows Übernehmen/Abbrechen) |
| `showEditBtn` | pencil button visible |
| `cardActions` | the „Scout losschicken“ block visible |
| `listLeft`, `listTop`, `listWidth`, `listPad`, `listRadius`, `listBg`, `listBorder`, `listShadow`, `listGap`, `listOpacity`, `listTransform` | the float↔card morph geometry |
| `listHeadMb`, `listHeadFont`, `listHeadWeight`, `listHeadSpacing`, `listHeadTransform`, `listHeadColor` | the „Euer Suchauftrag“ heading morph |
| `rowGap`, `rowFont` | fact row metrics |
| `facts` | the fact row view-models (§4) |
| `startEdit` | `setState({ editing: true, editDraft: {} })` — **clears the buffer on open** |
| `cancelEdit` | `setState({ editing: false, editDraft: {} })` — **discards the buffer**, facts untouched |
| `saveEdit` | commits every non-empty trimmed draft, then `editing:false`, `editDraft:{}` (§4.1) |
| `backToConvo` | „Zurück zum Gespräch“ — plain `setState` back to `discovery` with `awaitingUser:true`, `suggestion:'Ja, leg los.'`, `stepIndex: SCRIPT.length`; full body in §6.4, defect in §19.1 #1 |
| `startScouting` | „Scout losschicken“ — guarded `brief_review → scouting`, replaces `activity` with `[ACT.start]`; full body in §6.4 |

### 18.12 Autopilot
| binding | meaning |
| --- | --- |
| `status` | the live status line |
| `compactBrief` | the brief pill label „Stuttgart · bis 350 €“ |
| `chevRot`, `chevRotUp`, `briefOpen`, `toggleBrief` | the brief disclosure |
| `activity`, `activityOpen`, `activityLabel`, `toggleActivity` | the activity timeline |
| `sideDraft`, `onSideDraft`, `submitSideNote`, `sideVoice` | the „Möchtest du mir noch etwas sagen?“ composer. `submitSideNote = bind(…)` (§1.4): `preventDefault()` → **abort if `sideDraft.trim()` is empty** → `setState({ sideDraft: '' })` (**the field is cleared**) → `showHint('Prototyp: Zusätzliche Hinweise werden hier nicht interpretiert. Der Scout arbeitet mit dem Suchauftrag weiter.')`. `sideVoice` only calls `showHint('Prototyp: Das Mikrofon ist simuliert. Die Demo läuft ohne Spracheingabe weiter.')`. Nothing is stored, no transcript entry, no fact — but the clear-on-submit is real behaviour to reproduce. |
| `pending`, `pendingTo`, `pendingText`, `pendingContactOff`, `releaseMessage` | the release-required card |
| `openAutonomy`, `openSources`, `openKnowledge` | deep links into Settings pages |
| `waitingSource`, `waitingAccess` | the two blocked states |
| `offerStale` | the „muss erneut geprüft werden“ banner |
| `voiceOff` | `!flags.voice` **(dead)** |

### 18.13 Clarification
`clarUnanswered`, `clarUserText`, `clarScoutText`, `clarYes`, `clarNo`, `clarDraft`, `onClarDraft`, `submitClar`, `clarVoice`
— see §8.1.

### 18.14 Offer / review / Q&A
`offerCols`, `offerImgMin`, `offerImgMax`, `offerPrompt`, `offerTalk`, `offerTalkHidden`, `talkOffer`,
`reviewOffer`, `offerPillTop`, `fullTerms`, `termsLabel`, `termsRot`, `toggleTerms`, `acceptOffer`,
`questionOpen`, `toggleQuestion`, `qa`, `qaHidden`, `qaDraft`, `onQaDraft`, `askQa`, `submitQa`, `restart`
— see §8.4 / §8.5 / §8.6.

### 18.15 Hint & transcript
`hint`, `transcriptOpen`, `transcriptEmpty`, `transcript` — see §14.

### 18.16 Demo controls (do not build)
`demoOpen`, `demoClosed`, `toggleDemo`, `demoPaused`, `demoRunning`, `demoPauseLabel`, `toggleDemoPause`,
`demoNext`, `onChapter`, `speedLabel`, `toggleSpeed` — see §17.

---

## 19. Typed skeleton for the port

```ts
export type Stage =
  | 'welcome' | 'discovery' | 'brief_review'
  | 'scouting' | 'waiting' | 'clarification' | 'following_up'
  | 'dead_end' | 'candidates'
  | 'offer' | 'offer_review' | 'complete';

export const STAGES: Stage[] = ['welcome','discovery','brief_review','scouting','waiting',
  'clarification','following_up','offer','offer_review','complete'];        // dead_end & candidates excluded
export const AUTOPILOT_STAGES = ['scouting','waiting','following_up'] as const;

export type ScoutState = 'idle' | 'speaking' | 'listening' | 'thinking';
export type ListMode   = 'hidden' | 'float' | 'card' | 'leaving';
export type Blocker    = 'source' | 'access' | 'release' | null;
export type Mode       = 'voice' | 'text';

export type FactId = 'ort' | 'budget' | 'band' | 'zeit' | 'equip';
export interface Fact { id: FactId; label: string; arriving?: boolean; changed?: boolean }

export type ActKind =
  | 'start' | 'found' | 'contacted' | 'waiting' | 'notif' | 'read' | 'confirmed' | 'alt' | 'offer'
  | 'declined' | 'noMatch' | 'found2' | 'adjusted' | 'requested';
export interface ActivityEntry { kind: ActKind; text: string; meta?: string }

export interface Utterance { id: number; who: 'scout' | 'user'; words: string[]; shown: number }
export interface Pending   { to: string; text: string; reason: 'contact' | 'review' }

export interface StageState {
  stage: Stage; utter: Utterance | null; capsule: Fact | null;
  awaitingUser: boolean; suggestion: string | null; hint: string | null;
  transcriptOpen: boolean; briefOpen: boolean; editing: boolean; convoEnded: boolean;
  cardArrived: boolean; headlineShown: boolean; activityOpen: boolean; searchPaused: boolean;
  offerTalk: string | null; fullTerms: boolean; questionOpen: boolean; qa: { q: string; a: string } | null;
  scoutState: ScoutState; status: string; listMode: ListMode;
  facts: Fact[]; transcript: { who: 'scout' | 'user'; text: string }[]; activity: ActivityEntry[];
  clar: { userText: string | null; scoutText: string | null };
  pending: Pending | null; waitingFor: Blocker; offerStale: boolean; offer: Candidate;
}
```

### 19.1 Known prototype defects to decide on before porting

| # | Where | Issue |
| --- | --- | --- |
| 1 | `backToConvo()` | sets `stepIndex = SCRIPT.length` (8) with `awaitingUser: true` and `suggestion: 'Ja, leg los.'`. **Four** paths then dereference the undefined `SCRIPT[8]` → **TypeError**: `useSuggestion()`, `demoNext()` (its `awaitingUser` branch), `submitDiscovery` (`const ref = SCRIPT[s.stepIndex].text` — reachable because `awaitingUser` is `true`, so the „noch nicht fertig“ early return does not fire) and `switchToVoice`'s `after(400)` callback (`showUtterance(SCRIPT[st.stepIndex], st.stepIndex, SCRIPT[st.stepIndex].text)`). The port needs a synthetic terminal step (e.g. a `then: 'brief'` scout confirmation) or a guard in all four. |
| 2 | `compactBrief` | hard-codes „Stuttgart · “ and ignores the `ort` fact. |
| 3 | `summary()` | `replace(/ & Umgebung/, '')` never matches; the Umland label is „Stuttgart & Umland“. |
| 4 | `offerTitle` | `.replace('Raum in','Raum in')` is a no-op left over from an edit. |
| 5 | Activity identity | `a === ACT.contacted` compares object references; `baseFor` inserts the same singletons, which happens to work, but a copy would break it. Use a `kind` discriminator. |
| 6 | `keepSearching` / `keepWaiting` | move to `waiting` **without** scheduling `arriveReply`, so the demo stalls silently. Decide whether the ported flow should re-arm a timer. |
| 7 | `submitQa` | does not set `scoutState:'speaking'` (unlike `askQa`) — inconsistent. |
| 8 | `budgetNum` | `label.replace(/\D/g,'')` would concatenate digits if a label ever contained two numbers. |
| 9 | `Sched.paused` vs. `go()` | `go()` calls `sched.clear()` but never `sched.resume()`, and `clear()` does not touch `paused`. Any pause (`endConvo`, `toggleSearchPause`, `toggleDemoPause`) therefore survives every stage change, while `baseFor` resets `searchPaused:false` and `onChapter` passes `{ demoPaused:false }` — the UI shows „running“ while every newly queued timer is pushed **unarmed**. Pause → jump chapter (or `restart()`) → the demo freezes silently. Fix: derive the paused flag from state, or clear it in the stage-reset action. See §6.1 / §10. |
| 10 | `arriveReply()` | returns early when `waitingFor` is set and **never re-arms** the timer, so a reply scheduled while the scout is blocked on source/access/release is lost for good (§11). Defensive in the scripted flow, load-bearing in a port that keeps timers running while blocked. |
| 11 | `demoNext()` | its stage fallback is guarded by `i >= 0 && i < STAGES.length - 1`, and `dead_end`/`candidates` are not in `STAGES` — so „Nächster Schritt“ is inert in exactly the two branch stages QA needs most (§17). Demo-only, but worth knowing when reproducing states. |

---

## 20. Copy dictionary (DE)

Every user-visible string **defined in the script block**. Strings that live in the template
(`Roomscout.dc.html` lines 1–645) are marked `[tpl]` where they are needed to make a flow legible;
the template doc owns them. Keys are stable semantic identifiers for the i18n dictionary.

### 20.1 `scout.script` — the discovery conversation
```
scout.script.s0.scout            = "Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?"
scout.script.s1.user             = "Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat."
scout.script.s2.scout            = "Welche Tage passen euch zum Proben?"
scout.script.s3.user             = "Donnerstags ab 19 Uhr wäre gut."
scout.script.s4.scout            = "Gibt es etwas, das im Raum vorhanden sein oder dort bleiben muss?"
scout.script.s5.user             = "Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit."
scout.script.s5.memory           = "Verstärker bringt die Band mit"
scout.script.s6.user             = "Und beim Budget lieber maximal 350 Euro."
scout.script.s7.scout            = "Alles klar, maximal 350 Euro. So würde ich für euch suchen. Soll ich loslegen?"
scout.script.startLine           = "Alles klar. Ich suche passende Räume und kläre die Details. Ich melde mich, wenn ich euch brauche."
scout.script.resumeSuggestion    = "Ja, leg los."
```

### 20.2 `scout.facts` — fact labels
```
scout.facts.ort.initial          = "Stuttgart"
scout.facts.ort.umland           = "Stuttgart & Umland"
scout.facts.budget.initial       = "Bis 400 € / Monat"
scout.facts.budget.final         = "Bis 350 € / Monat"
scout.facts.budget.raised        = "Bis 400 € / Monat"
scout.facts.band                 = "Geteilter Raum · 4 Personen"
scout.facts.zeit.initial         = "Donnerstags ab 19 Uhr"
scout.facts.zeit.flexible        = "Mittwoch oder Donnerstag ab 19 Uhr"
scout.facts.equip                = "Schlagzeug darf im Raum bleiben"
```

### 20.3 `scout.status` — autopilot status lines
```
scout.status.searching           = "Ich suche nach passenden Räumen in Stuttgart."
scout.status.candidateFound      = "Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details."
scout.status.asked               = "Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist."
scout.status.waitingReply        = "Jetzt warte ich auf eine Antwort."
scout.status.followUp            = "Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben."
scout.status.alternative         = "Ich frage nach einer Alternative zu Mittwoch und suche weiter."
scout.status.searchAgain         = "Ich suche erneut mit den neuen Kriterien."
scout.status.keepSearching       = "Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt."
scout.status.keepWaiting         = "Alles klar, ich suche im Hintergrund weiter und melde mich."
scout.status.requestOffer        = "Ich frage beim {roomName} nach einem Angebot und kläre die Details."
scout.status.noSource            = "Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen."
scout.status.accessExpired       = "Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann."
scout.status.awaitingRelease     = "Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst."
```

### 20.4 `scout.clarification`
```
scout.clarification.yes.user     = "Ja, Mittwoch passt auch."
scout.clarification.yes.scout    = "Alles klar, Mittwoch geht also auch. Ich kläre den Rest."
scout.clarification.no.user      = "Nein, Donnerstag ist wichtig."
scout.clarification.no.scout     = "Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter."
scout.clarification.hint.unparsed= "Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“."
scout.clarification.hint.mic     = "Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text."
[tpl] scout.clarification.eyebrow      = "Raum in Stuttgart-West"
[tpl] scout.clarification.headline     = "Eine kurze Rückfrage."
[tpl] scout.clarification.question     = "Donnerstag ist leider belegt. Wäre Mittwoch ab 19 Uhr auch möglich?"
[tpl] scout.clarification.detail       = "280 € inklusive Nebenkosten. Euer Schlagzeug kann im Raum bleiben."
[tpl] scout.clarification.btn.yes      = "Ja, Mittwoch passt"
[tpl] scout.clarification.btn.no       = "Nein, Donnerstag ist wichtig"
[tpl] scout.clarification.placeholder  = "Nachricht an deinen Scout …"
[tpl] scout.clarification.btn.speak    = "Sprechen"
```

### 20.5 `scout.deadEnd` / `scout.compromise`
```
scout.compromise.budget.label    = "Bis 400 € / Monat"
scout.compromise.budget.line     = "Alles klar, bis 400 Euro. Ich suche erneut in Stuttgart."
scout.compromise.umland.label    = "Stuttgart & Umland"
scout.compromise.umland.line     = "Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach."
scout.compromise.zeit.label      = "Mittwoch oder Donnerstag ab 19 Uhr"
scout.compromise.zeit.line       = "Alles klar, Mittwoch geht also auch. Ich frage den Raum in Stuttgart-West erneut an."
[tpl] scout.deadEnd.headline           = "Da komme ich gerade nicht weiter."
[tpl] scout.deadEnd.eyebrow            = "Raum in Stuttgart-West"
[tpl] scout.deadEnd.body               = "Der Anbieter kann Donnerstag nicht anbieten. Weitere Räume in Stuttgart, die zu eurem Suchauftrag passen, habe ich aktuell nicht gefunden."
[tpl] scout.deadEnd.prompt             = "Was wäre für euch denkbar? Ich passe den Suchauftrag nur an, wenn ihr es sagt."
[tpl] scout.deadEnd.opt.budget.title   = "Budget bis 400 €"
[tpl] scout.deadEnd.opt.budget.desc    = "Erweitert die Suche in Stuttgart um weitere Räume."
[tpl] scout.deadEnd.opt.umland.title   = "Umland einbeziehen"
[tpl] scout.deadEnd.opt.umland.desc    = "Esslingen, Ludwigsburg, Fellbach · 20 bis 30 Minuten Weg."
[tpl] scout.deadEnd.opt.zeit.title     = "Mittwoch doch erlauben"
[tpl] scout.deadEnd.opt.zeit.desc      = "Der Raum in Stuttgart-West wäre dann verfügbar. Donnerstag bleibt gemerkt."
[tpl] scout.deadEnd.keepWaiting        = "Nichts ändern, weiter suchen lassen"
```

### 20.6 `scout.candidates`
```
scout.candidates.headline        = "Drei Räume, die in Frage kommen."
scout.candidates.budget.ok       = "Im Budget"
scout.candidates.budget.over     = "Über eurem Budget ({budgetNum} €)"
scout.candidates.west.name       = "Raum in Stuttgart-West"
scout.candidates.west.short      = "Stuttgart-West"
scout.candidates.west.price      = "280 € / Monat"
scout.candidates.west.time       = "Mittwochs, 19–22 Uhr"
scout.candidates.west.timeLower  = "mittwochs 19–22 Uhr"
scout.candidates.west.storage    = "Schlagzeug kann im Raum bleiben"
scout.candidates.west.way        = "12 Min. mit der Stadtbahn"
scout.candidates.west.size       = "ca. 28 m² · geteilt mit einer Band"
scout.candidates.west.note       = "Günstigster Raum, aber nur mittwochs frei."
scout.candidates.esslingen.name  = "Raum in Esslingen"
scout.candidates.esslingen.short = "Esslingen"
scout.candidates.esslingen.price = "320 € / Monat"
scout.candidates.esslingen.time  = "Donnerstags, 19–23 Uhr"
scout.candidates.esslingen.timeLower = "donnerstags 19–23 Uhr"
scout.candidates.esslingen.storage   = "Schlagzeug kann im Raum bleiben"
scout.candidates.esslingen.way   = "25 Min. mit der S-Bahn"
scout.candidates.esslingen.size  = "ca. 35 m² · geteilt mit zwei Bands"
scout.candidates.esslingen.note  = "Euer Wunschtag, dafür im Umland."
scout.candidates.ost.name        = "Raum in Stuttgart-Ost"
scout.candidates.ost.short       = "Stuttgart-Ost"
scout.candidates.ost.price       = "350 € / Monat"
scout.candidates.ost.time        = "Donnerstags, ab 20 Uhr"
scout.candidates.ost.timeLower   = "donnerstags ab 20 Uhr"
scout.candidates.ost.storage     = "Schlagzeug müsste abgebaut werden"
scout.candidates.ost.way         = "18 Min. mit der Stadtbahn"
scout.candidates.ost.size        = "ca. 22 m² · geteilt mit drei Bands"
scout.candidates.ost.note        = "Am Budgetlimit, und das Schlagzeug kann nicht bleiben."
[tpl] scout.candidates.sub             = "Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage."
[tpl] scout.candidates.badge.best      = "Mein Vorschlag"
[tpl] scout.candidates.photoPending    = "Foto folgt vom Anbieter"
[tpl] scout.candidates.btn.pick        = "Diesen Raum anfragen"
[tpl] scout.candidates.btn.keepSearching = "Keiner passt, weiter suchen"
```

### 20.7 `scout.offer` / `scout.review`
```
scout.offer.talk                 = "Das Angebot liegt bei 280 Euro inklusive Nebenkosten. Ihr könnt mittwochs von 19 bis 22 Uhr proben, und euer Schlagzeug darf bleiben. Soll ich euch die übrigen Konditionen erklären?"
scout.offer.title                = "Euer {roomName}"
scout.offer.prompt.idle          = "Soll ich euch das Angebot erklären?"
scout.offer.prompt.talking       = "Dein Scout"
scout.review.qa.q                = "Was passiert nach der Zusage?"
scout.review.qa.a                = "Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. In dieser Demo wird nichts versendet."
scout.review.qa.hint.unparsed    = "Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage."
scout.review.terms.show          = "Vollständige Bedingungen anzeigen"
scout.review.terms.hide          = "Vollständige Bedingungen ausblenden"
[tpl] scout.offer.headline             = "Ein Raum, der zu euch passt."
[tpl] scout.offer.eyebrow              = "Angebot eingegangen"
[tpl] scout.offer.priceSuffix          = "/ Monat"
[tpl] scout.offer.inclusive            = "inklusive Nebenkosten"
[tpl] scout.offer.btn.review           = "Angebot prüfen"
[tpl] scout.offer.reviewNote           = "Vor einer Zusage schauen wir uns alle Konditionen an."
[tpl] scout.offer.btn.talk             = "Mit Scout sprechen"
[tpl] scout.offer.stale                = "Nach deiner Änderung muss das Angebot erneut geprüft werden."
[tpl] scout.offer.stale.link           = "Angaben ansehen"
[tpl] scout.offer.brief.pill           = "Suchauftrag"
[tpl] scout.review.headline            = "Passt das für euch?"
[tpl] scout.review.bullet.shared       = "Geteilter Raum · 4 Personen"
[tpl] scout.review.bullet.storage      = "Schlagzeug-Lagerung bestätigt"
[tpl] scout.review.bullet.start        = "Beginn: 1. Oktober 2026"
[tpl] scout.review.bullet.deposit      = "Keine Kaution"
[tpl] scout.review.bullet.notice       = "Kündigungsfrist: ein Monat zum Monatsende"
[tpl] scout.review.terms.body          = "Geteilte Nutzung des Raums in Stuttgart-West durch vier Bandmitglieder, mittwochs 19–22 Uhr. Miete 280 € monatlich inklusive Nebenkosten, Beginn 1. Oktober 2026. Keine Kaution. Kündigungsfrist ein Monat zum Monatsende. Das eigene Schlagzeug darf dauerhaft im Raum gelagert werden. Verstärker werden von der Band mitgebracht."
[tpl] scout.review.terms.disclaimer    = "Demo-Bedingungen. Im echten Produkt wäre hier das vollständige Angebot des Anbieters einsehbar."
[tpl] scout.review.btn.accept          = "Angebot annehmen"
[tpl] scout.review.acceptNote          = "Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet."
[tpl] scout.review.btn.question        = "Noch eine Frage klären"
[tpl] scout.review.qa.placeholder      = "Frage an deinen Scout …"
[tpl] scout.complete.headline          = "Euer nächster Proberaum steht bereit."
[tpl] scout.complete.note              = "Demo abgeschlossen — es wurde keine echte Zusage versendet."
[tpl] scout.complete.btn.restart       = "Demo erneut ansehen"
```

### 20.8 `scout.activity` — timeline entries
```
scout.activity.start             = "Suchauftrag gestartet"
scout.activity.found             = "Raum in Stuttgart-West gefunden"
scout.activity.found.meta        = "roomscout.dev · Demo-Portal"
scout.activity.contacted         = "Anbieter über das Portal kontaktiert"
scout.activity.waiting           = "Warte auf Antwort"
scout.activity.notif             = "Benachrichtigung aus dem Portal erhalten"
scout.activity.read              = "Neue Nachricht im Portal gelesen"
scout.activity.confirmed         = "Mittwoch bestätigt, Angebot angefragt"
scout.activity.alt               = "Alternative zu Mittwoch angefragt"
scout.activity.offer             = "Angebot eingegangen"
scout.activity.declined          = "Anbieter hat abgesagt: Donnerstag nicht möglich"
scout.activity.noMatch           = "Kein weiterer passender Raum in Stuttgart gefunden"
scout.activity.found2            = "Drei Räume zum Vergleich zusammengestellt"
scout.activity.found2.meta       = "roomscout.dev · Demo-Portal"
scout.activity.adjusted          = "Suchauftrag angepasst: {label}"
scout.activity.requested         = "Angebot angefragt: {short}"
scout.activity.toggle.show       = "Aktivität ansehen"
scout.activity.toggle.hide       = "Aktivität ausblenden"
```

### 20.9 `scout.notify` — toasts
```
scout.notify.release             = "Dein Scout wartet auf deine Freigabe"
scout.notify.clarification       = "Dein Scout hat eine Rückfrage"
scout.notify.decision            = "Dein Scout braucht eine Entscheidung"
scout.notify.candidates          = "Dein Scout hat Räume zum Vergleichen"
scout.notify.offer               = "Ein Angebot ist eingegangen"
[tpl] scout.notify.btn.go              = "Zum Scout"
```

### 20.10 `scout.hint` — prototype hints (4.2 s)
```
scout.hint.voiceDisabled         = "Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus."
scout.hint.notReady              = "Der Scout ist noch nicht fertig. Gleich kannst du antworten."
scout.hint.freeText              = "Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich."
scout.hint.sideNote              = "Prototyp: Zusätzliche Hinweise werden hier nicht interpretiert. Der Scout arbeitet mit dem Suchauftrag weiter."
scout.hint.sideVoice             = "Prototyp: Das Mikrofon ist simuliert. Die Demo läuft ohne Spracheingabe weiter."
scout.hint.clarVoice             = "Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text."
scout.hint.clarUnparsed          = "Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“."
scout.hint.qaUnparsed            = "Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage."
```

### 20.11 `scout.state` — scout status words / labels
```
scout.state.listening            = "Ich höre zu"
scout.state.micOff               = "Mikro aus"
scout.state.thinking             = "Ich denke kurz nach"
scout.speaker.scout              = "Dein Scout"
scout.speaker.user               = "Du"
scout.mic.on                     = "Mikro an"
scout.mic.off                    = "Mikro aus"
scout.badge.working              = "Scout ist unterwegs"
scout.badge.paused               = "Suche pausiert"
scout.pause.pause                = "Suche pausieren"
scout.pause.resume               = "Suche fortsetzen"
scout.brief.pill.compact         = "Stuttgart · {budget}"   // `compactBrief`; the city is hard-coded, §19.1 #2
scout.brief.pill.budget.fallback = "bis 350 €"              // `compactBudget` when no budget fact exists
scout.composer.placeholder.await = "Antwort an deinen Scout …"
scout.composer.placeholder.busy  = "Dein Scout spricht …"
[tpl] scout.welcome.greeting           = "Hey {name}."
[tpl] scout.welcome.headline           = "Finden wir euren Proberaum."
[tpl] scout.welcome.btn.voice          = "Mit Scout sprechen"
[tpl] scout.welcome.btn.text           = "Lieber schreiben"
[tpl] scout.welcome.tagline            = "Du erzählst. Dein Scout kümmert sich."
[tpl] scout.discovery.ended            = "Gespräch beendet. Eure Wünsche bleiben als Entwurf gespeichert."
[tpl] scout.discovery.btn.transcript   = "Mitschrift"
[tpl] scout.discovery.btn.end          = "Gespräch beenden"
[tpl] scout.discovery.btn.toText       = "Zum Schreiben wechseln"
[tpl] scout.discovery.btn.resume       = "Gespräch fortsetzen"
[tpl] scout.discovery.btn.viewBrief    = "Suchauftrag ansehen"
[tpl] scout.brief.headline             = "So suche ich für euch."
[tpl] scout.brief.title                = "Euer Suchauftrag"
[tpl] scout.brief.btn.start            = "Scout losschicken"
[tpl] scout.brief.startNote            = "Ich suche und frage selbstständig an.\nEine verbindliche Zusage gibst nur du."
[tpl] scout.brief.btn.editMore         = "Noch etwas ändern"
[tpl] scout.brief.btn.backToConvo      = "Zurück zum Gespräch"
[tpl] scout.brief.btn.save             = "Übernehmen"
[tpl] scout.brief.btn.cancel           = "Abbrechen"
[tpl] scout.autopilot.headline         = "Ich kümmere mich darum."
[tpl] scout.autopilot.btn.resume       = "Fortsetzen"
[tpl] scout.autopilot.sideNote.placeholder = "Möchtest du mir noch etwas sagen?"
[tpl] scout.autopilot.closeHint        = "Du kannst die App schließen. Ich melde mich."
[tpl] scout.transcript.title           = "Mitschrift"
[tpl] scout.transcript.empty           = "Noch keine Äußerungen."
[tpl] scout.menu.section               = "Persönlicher Bereich"
[tpl] scout.menu.settings              = "Einstellungen"
[tpl] scout.menu.backToScout           = "Zurück zum Scout"
[tpl] scout.footer.prototype           = "Designprototyp · Beispieldaten"
```
Sheet title plural (script-defined):
```
scout.sheet.title.card           = "Euer Suchauftrag"
scout.sheet.title.one            = "{n} Wunsch gemerkt"
scout.sheet.title.many           = "{n} Wünsche gemerkt"
```

### 20.12 `scout.release` — autonomy / release flow
```
scout.release.to                 = "Anbieter · Raum in Stuttgart-West · roomscout.dev"
scout.release.message            = "Hallo, wir sind {name}, eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, {budget}, donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, {name} (über RoomScout)"
scout.release.budget.fallback    = "bis 350 € / Monat"
[tpl] scout.release.eyebrow            = "Freigabe nötig"
[tpl] scout.release.toLabel            = "An:"
[tpl] scout.release.contactOff         = "Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe raus."
[tpl] scout.release.btn.release        = "Nachricht freigeben"
[tpl] scout.release.btn.autonomy       = "Handlungsspielraum ändern"
[tpl] scout.blocked.source.btn         = "Quelle auswählen"
[tpl] scout.blocked.access.text        = "Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung."
[tpl] scout.blocked.access.btn         = "Zu den Zugängen"
```

### 20.13 `scout.settings` — data owned by this file
```
settings.source.roomscout.name   = "roomscout.dev"
settings.source.roomscout.desc   = "Kontrolliertes Demo-Portal"
settings.source.roomscout.region = "Stuttgart"
settings.source.roomscout.profile= "Herzbuben"
settings.source.musiker.name     = "Musiker in deiner Stadt"
settings.source.musiker.desc     = "Stuttgart · Öffentliche Anzeigen"
settings.source.musiker.region   = "Stuttgart"
settings.source.bandnet.name     = "Bandnet Hamburg"
settings.source.bandnet.desc     = "Hamburg · Andere Region"
settings.source.bandnet.region   = "Hamburg"
settings.knowledge.k_genre.text  = "Hardrock und Alternative"
settings.knowledge.k_genre.origin= "Demo-Bandprofil"
settings.knowledge.k_mates.text  = "Ähnliche Musikrichtung bei Mitnutzern wichtig"
settings.knowledge.k_mates.origin= "Annahme deines Scouts"
settings.knowledge.k_amps.text   = "Verstärker bringt ihr selbst mit"
settings.knowledge.k_amps.origin = "Aus dem Gespräch"
settings.knowledge.derived.origin= "Aus dem Gespräch · Teil eures Suchauftrags"
settings.log.factEdited          = "Angabe korrigiert: {label}"
settings.log.rulesSaved          = "Handlungsspielraum aktualisiert"
settings.log.briefAdjusted       = "Suchauftrag angepasst: {label}"
settings.log.knowledgeImported   = "{n} Angaben aus Beispiel-Kontext übernommen"
settings.log.timePrefix          = "Heute, {hh}:{mm}"
settings.summary.empty           = "Ich weiß noch nichts über euch. Erzähl es mir beim nächsten Gespräch."
settings.summary.opener          = "Ihr seid eine "
settings.summary.bandPrefix4     = "vierköpfige "
settings.summary.bandWord        = "Band"
settings.summary.fromCity        = " aus {ort}"
settings.summary.seeksShared     = "sucht einen geteilten Proberaum"
settings.summary.seeks           = "sucht einen Proberaum"
settings.summary.storage         = "möchtet euer Schlagzeug dort lassen"
settings.summary.and             = " und "
settings.summary.youJoin         = " Ihr {parts}."
settings.usage.talk              = "Noch nicht erfasst"
settings.session.held            = "Gespräch pausiert · läuft weiter, wenn du zurückkehrst"
settings.session.working         = "Scout ist unterwegs"
settings.session.paused          = "Suche pausiert"
settings.export.hinweis          = "Lokale Demo-Daten des Designprototyps"
```

Assembly of `summary()` (§5.3), so an i18n build can reproduce the sentence from these keys alone:
```
opener + [bandPrefix4] + bandWord + [fromCity] + "."            → "Ihr seid eine vierköpfige Band aus Stuttgart."
parts  = [seeksShared | seeks] and/or [storage]                  joined with `and` (" und ")
if parts: + youJoin with {parts}                                 → " Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen."
```
German note for the EN dictionary: `opener`, `bandPrefix4` and `and` are **fragments with trailing /
surrounding spaces** that are concatenated, not a template — an English translation must be built as one
sentence template per case instead of translating the fragments.

### 20.14 `demo.*` — demo controls (**not to be built, not to be translated**)
```
demo.bar.label                   = "Prototyp · Beispieldaten"
demo.bar.collapsed               = "Prototyp · Demo-Steuerung"
demo.bar.play                    = "Abspielen"
demo.bar.pause                   = "Pausieren"
demo.bar.next                    = "Nächster Schritt"
demo.bar.restart                 = "Zurück zum Anfang"
demo.bar.speed                   = "Tempo"
demo.bar.speed.1x                = "1×"
demo.bar.speed.16x               = "1.6×"
demo.bar.chapter                 = "Kapitel"
demo.bar.mobile                  = "Mobil"
demo.bar.settings                = "Einstellungen"
demo.bar.operator                = "Betreiberansicht"
demo.bar.incident                = "Beispielstörung laden"
demo.bar.hide                    = "Steuerung ausblenden"
demo.chapter.1                   = "1 · Willkommen"
demo.chapter.2                   = "2 · Gespräch"
demo.chapter.3                   = "3 · Suchauftrag"
demo.chapter.4                   = "4 · Autopilot"
demo.chapter.5                   = "5 · Warten"
demo.chapter.6                   = "6 · Rückfrage"
demo.chapter.7                   = "7 · Klärung"
demo.chapter.7b                  = "7b · Sackgasse"
demo.chapter.7c                  = "7c · Kandidaten"
demo.chapter.8                   = "8 · Angebot"
demo.chapter.9                   = "9 · Prüfung"
demo.chapter.10                  = "10 · Abschluss"
```
