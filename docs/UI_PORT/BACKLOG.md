# BACKLOG — the two-way gap between the current app and the prototype

Companion to `APP_UI_INVENTORY.md` (what the app renders today), `SCOUT_SCREENS.md` / `SCOUT_STATE.md`,
`SETTINGS_SCREENS.md`, `OPERATOR_SCREENS.md`, `LANDING_SCREENS.md` (what the prototype specifies) and
`DATA_MAP.md` (what the backend can serve).

All file paths are relative to the repo root
`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout`.
Prototype root: `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype`
(`Landing v2.dc.html`, `Roomscout.dc.html`, `Settings.dc.html`, `Operator.dc.html`).

German copy is quoted verbatim (including „ “ · – — € … ’). English copy is quoted verbatim too, because
every one of those strings has to be captured for the DE/EN toggle. Where a table row would become
unreadable, the set is named by count in the row and **enumerated verbatim in §4** — no string in this
document is left as a `…` range.

---

## 0. How to read this document

### Scope of Table 1

Table 1 lists every current-app route, panel, control and rendered string group that has **no** 1:1 home
in the prototype — i.e. everything classified **(b)** (legacy, no counterpart) or **(c)** (unclear /
partial) in `APP_UI_INVENTORY.md` §9, plus the **(a)** elements whose control set is only partially
covered by the prototype. Elements with a clean 1:1 counterpart (Landing sections, Scout discovery /
brief / voice, the seven Settings sections as *sections*, Ops overview + readiness + audit as *pages*)
are **not** repeated here — they are the port work, not the backlog.

### Decision vocabulary

The maintainer's standing decision: **legacy features leave the navigation, but their routes stay
reachable by URL; nothing is deleted in the first pass.** Encoded as:

| Code | Meaning |
| --- | --- |
| **KEEP-HIDDEN** | Route stays reachable by direct URL. Removed from every nav/menu/footer. Not restyled in pass 1; keeps its current stylesheet. |
| **KEEP-AS-IS** | Stays exactly where and how it is in pass 1 (usually because it has no prototype counterpart but is load-bearing, e.g. auth). |
| **PORT-INTO** | Element is absorbed into a named prototype surface during the rebuild; the old markup stops being rendered but the file stays. |
| **REPLACE** | The prototype has a *different* element for the same job. The current element is not rendered on the new surface; the file stays until pass 2. |
| **FLAG** | Dead code / unreachable control. Not deleted in pass 1, only recorded. |
| **DECIDE** | No default exists. Needs a maintainer call before the surface can be built. |

### Priority

`must` = has to be settled before the hackathon demo (it is on the demo path, or it breaks the new
navigation). `nice` = visibly improves the demo. `later` = post-demo.

---

## 1. Table 1 — current-app UI with no prototype home

### 1.1 Routing, guards and app-level chrome

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Auth-loading state `Restoring your session…` | `src/app/router.tsx` (`RequireAuth` → `RouteState`), `div.rs-route-state[role=status]` | Blocks render while Convex auth restores | none — the prototype has no auth at all | KEEP-AS-IS | app shell loading state, DE/EN | nice |
| `AuthRoute` restore state `Restoring your session…` | `src/app/router.tsx` | Same, for `/sign-in` `/sign-up` | none | KEEP-AS-IS | app shell | nice |
| Operator check pending `Checking operator access…` | `src/app/router.tsx` (`RequireOperator`) | Blocks render while `users.current` loads | none | KEEP-AS-IS | app shell | nice |
| Operator denied panel: eyebrow `Protected workspace`, h1 `Operator access required`, body `Your account can use the musician workspace. The Ops cockpit is restricted server-side.`, CTA `Open your Scout` | `src/app/router.tsx` | Denies `/ops/*` to musicians (UI affordance only; `api.ops.*` re-checks server-side) | partial — the prototype gates the Operator surface with a nav entry and the sidebar footnote „Nur für Betreiber“, never with a denial page | KEEP-AS-IS | keep as the route guard behind the Operator dialog | nice |
| Catch-all `*` → `<Navigate replace to="/">` | `src/app/router.tsx` | 404 handling | none (prototype has no router) | KEEP-AS-IS | app shell | later |
| `safeReturnTo` default `/app/scout` | `src/app/returnTo.ts` (no markup) | Any unauthenticated `/app/*` visit lands on `/app/scout` after sign-in | none | KEEP-AS-IS | app shell; pinned by `app/returnTo.test.ts` | later |
| Hard crash when `VITE_CONVEX_URL` is missing | `src/app/providers.tsx` | Throws at boot, no UI | none | KEEP-AS-IS | — | later |
| Two routes for one settings component (`/app/profile` writes `?section=`, `/app/settings/:section` navigates) | `src/routes/musician/ProfilePage.tsx:176–180` | Same component, two URL behaviours and two history behaviours | none — the prototype has exactly one Settings surface, opened from the avatar menu („Einstellungen“) | DECIDE | one canonical settings route/dialog; keep `/app/profile` as a redirect | must |

### 1.2 `PublicHeader` — `src/components/navigation/PublicHeader.tsx`

Used by `/explore`, `/signals/:id`, `/map` (public), `/sign-in`, `/sign-up`. Not used by `/`.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| The component itself (sticky 68 px bar, `.pubhead` + `.rs-public-header`) | `PublicHeader.tsx` | Public chrome for five routes | none — the prototype has a Landing header (`Landing v2`) and an app header (`Roomscout.dc.html` §2.4); nothing in between | KEEP-AS-IS (it only serves legacy + auth routes) | fold `/sign-in` `/sign-up` under the Landing header; leave legacy routes on it | nice |
| Nav link `Explore` → `/explore` | `PublicHeader.tsx` | Entry point to the market explorer | **none** | KEEP-HIDDEN (remove link) | — | must |
| Nav link `Map` → `/map` | `PublicHeader.tsx` | Entry point to the globe | **none** | KEEP-HIDDEN (remove link) | — | must |
| Nav link `How it works` → `/#how` | `PublicHeader.tsx` | Anchor into the landing story | partial — Landing v2 nav is „So funktioniert’s“ | REPLACE (copy) | Landing header | nice |
| CTA `Start my search` → `/app/scout` | `PublicHeader.tsx` | Primary CTA | partial — Landing v2 CTA is „Demo starten“ | REPLACE (copy) | Landing header | nice |
| Nav link `Sign in` → `/sign-in` | `PublicHeader.tsx` | Auth entry | none | KEEP-AS-IS | Landing header | nice |
| Burger `≤650 px` (`Open navigation` / `Close navigation`, `.pubhead nav.open`) | `PublicHeader.tsx` | Mobile nav panel | partial — Landing v2 has a `narrow` (<880 px) header variant, no burger documented | DECIDE | Landing header narrow variant (`LANDING_SCREENS.md` §13) | later |

### 1.3 `WorkspaceShell` — musician mode — `src/components/navigation/WorkspaceShell.tsx`

Prototype counterpart: `Roomscout.dc.html` header (§2.4) + profile menu (§2.4.3), whose **only** menu
items are „Einstellungen“ and „Zurück zum Scout“ (plus the name block and „Persönlicher Bereich“).

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Account-menu nav list as a whole (`<details class=rs-account-menu>`, `summary` aria `Profilmenü`, `nav` aria `RoomScout und Konto`). Exact contents per `APP_UI_INVENTORY.md` §2.2: identity block + **4** `Nav` rows (`Scout`, `Anzeigen entdecken`, `Euer Suchauftrag`, `Nachrichten`) + **3** `Link`s (`Karte`, `Einstellungen` → `/app/settings/sources`, `Betreiberansicht` → `/ops` operator-only) + `<hr>` + **1** `Button` (`Abmelden`, listed separately two rows below) | `WorkspaceShell.tsx` | Primary navigation for the musician app | partial — prototype menu has no nav list | REPLACE | prototype avatar menu (name + „Persönlicher Bereich“ + „Einstellungen“) | must |
| Row `Anzeigen entdecken` → `/app/explore` (icon `Search`) | `WorkspaceShell.tsx` | Opens the market explorer | **none** | KEEP-HIDDEN (remove row) | — | must |
| Row `Karte` → `/app/map` (icon `Map`) | `WorkspaceShell.tsx` | Opens the globe | **none** | KEEP-HIDDEN (remove row) | — | must |
| Row `Nachrichten` → `/app/inbox` (icon `Mail`) + badge from `api.inbox.listThreadsMine` filtered `status==="replied"` | `WorkspaceShell.tsx` | Opens the three-pane inbox | **none** — „Nachrichten“ appears in the prototype only inside Settings („Anzeigen lesen und Nachrichten austauschen“) and Operator („Portal-Nachrichten lesen“) | KEEP-HIDDEN (remove row) | provider replies surface inside the Scout stages (offer / clarification) | must |
| Row `Euer Suchauftrag` → `/app/search` (icon `SlidersHorizontal`) + badge from `api.matches.listMine {status:"new"}` | `WorkspaceShell.tsx` | Opens the ledger page | partial — „Euer Suchauftrag“ is a *card/pill inside Scout* (`SCOUT_SCREENS.md` §4) and a Settings section, never a page | KEEP-HIDDEN (remove row) | Scout brief pill + Settings „Handlungsspielraum“ | must |
| Row `Scout` → `/app/scout` (icon `Radar`) + badge from `api.outreach.listMine {status:"awaiting_approval"}` | `WorkspaceShell.tsx` | Back to Scout | partial — prototype has „Zurück zum Scout“ only while the Settings view is open | REPLACE | prototype avatar menu | must |
| Count badges `<span class="cnt">{count}</span>` (omitted at 0/undefined) | `WorkspaceShell.tsx` (`NavigationItems`) | Unread/attention counters on three rows | **none** — the prototype signals attention with the header dot („Scout ist unterwegs“) and the toast, never with numeric badges | DECIDE | header badge / toast (`SCOUT_SCREENS.md` §2.4.1, §2.7) | nice |
| Link `Betreiberansicht` → `/ops` (operators only) | `WorkspaceShell.tsx` | Operator entry point | **none in the shipped prototype UI** — „Betreiberansicht“ exists only on the demo control bar (`SCOUT_SCREENS.md` §2.10 item 9), which must not be built | DECIDE | avatar menu, operator-only row | must |
| Button `Abmelden` (`signOut()` → `/`) | `WorkspaceShell.tsx` | Ends the session | **none** — the prototype menu has no sign-out | KEEP-AS-IS (add to the ported menu) | avatar menu, below „Einstellungen“ | must |
| Identity block `{displayName}` + `Dein persönlicher Scout` | `WorkspaceShell.tsx` | Name + subtitle | partial — prototype subtitle is „Persönlicher Bereich“ | REPLACE (copy) | avatar menu | nice |
| `main.rs-consumer-main` (max-width 1440, padding 24/48/80, `padding-top:0` on `/app/scout`) | `WorkspaceShell.tsx` + `design-system.css` | Page container | none — the prototype has three nested layers, not one: **root container** `position:fixed;inset:0;overflow:hidden` (`SCOUT_SCREENS.md` §2.1), **stage frame** `data-stage="1"` `position:absolute;left:{{stL}};top:{{stT}};width:{{stW}};height:{{stH}};transform:{{stTf}};border-radius:{{stR}};border:{{stB}};overflow:hidden;display:flex;flex-direction:column;background:#0b0a09;transition:width .4s,height .4s,border-radius .4s` (§2.2 — desktop `0/0/100%/100%/none/0/0`, phone `50%/50%/390px/min(844px,calc(100% - 32px))/translate(-50%,-50%)/44px/1px solid rgba(255,220,190,.2)`), and the **scroll container** `<main>` `position:relative;z-index:2;flex:1;min-height:0;overflow:auto;overflow-x:hidden;scrollbar-width:none` (§2.6) | PORT-INTO | Scout stage frame | must |
| Dead musician sidebar branch (`Profile`, `Switch to Ops`, `Sign out`, lines 119–125) | `WorkspaceShell.tsx` | Unreachable (`mode==="musician"` returns earlier) | — | FLAG | — | later |

### 1.4 `WorkspaceShell` — ops mode + ops chrome

Prototype counterpart: `Operator.dc.html` sidebar — „Übersicht“, „Quellen“, „Aufträge“, „Integrationen“,
„Feature-Flags“, „Diagnose“, back link „Zur App“, footnote „Nur für Betreiber“.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Sidebar item `Signals` → `/ops/signals` + badge `api.ops.navCounts.signalReview` | `WorkspaceShell.tsx` | Normalization pipeline queue | **none** (prototype has no normalization surface) | KEEP-HIDDEN | fold into „Aufträge“ / „Diagnose“ | later |
| Sidebar item `Outreach` → `/ops/outreach` + badge `navCounts.outreach` | `WorkspaceShell.tsx` | Approval/delivery ledger | partial — prototype „Aufträge“ is a task table, not an approval ledger | KEEP-HIDDEN | „Aufträge“ | later |
| Sidebar item `Inbox` → `/ops/inbox` + badge `navCounts.inbox` | `WorkspaceShell.tsx` | Mail/platform routing | **none** | KEEP-HIDDEN | „Aufträge“ / „Diagnose“ | later |
| Sidebar item `Audit log` → `/ops/audit` | `WorkspaceShell.tsx` | Event ledger | partial — the prototype renders the `events` array as a two-column timeline **directly on the Diagnose page** (`OPERATOR_SCREENS.md` §10.2, conditional `hasIncident`; row grid `110px 1fr`, `gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,220,190,.08);font-size:15.5px`, time cell `color:#a89684`) **and** again inside the Diagnose sheet. Only the heading „Ereignisfolge“ is sheet-only (§11/§12.4). So the port target is a **page**, not a sheet | PORT-INTO | „Diagnose“ page timeline | nice |
| Sidebar link `Switch to RoomScout` → `/app/scout` | `WorkspaceShell.tsx` | Back to the musician app | partial — „Zur App“ | REPLACE (copy) | Operator sidebar | nice |
| Identity `span.rs-nav-identity` = `displayName ?? username ?? "Operator"` | `WorkspaceShell.tsx` | Who is signed in | partial — prototype shows the static avatar „OP“ + „INTERN“ + „Entwicklung“ | KEEP-AS-IS | Operator header | later |
| Mobile tab bar `nav[aria-label="Mobile workspace navigation"]` (≤820 px, `items.slice(0,4)`) | `WorkspaceShell.tsx` | Ops nav on small screens | **none** — the Operator surface documents no mobile variant | DECIDE | — | later |
| Ops page header eyebrow `Internal operator workspace` + the 6 title/description pairs **plus a 7th fallback description** — `Operations overview` / `Provider health, source coverage, and work that needs attention.`; `Sources & portals` / `Technical source and portal operations, independent of musician preferences.`; `Signal review` / `Inspect the live normalization pipeline and retry bounded failures.`; `Outreach control` / `Review external-action state without bypassing a musician’s approval boundary.`; `Inbox routing` / `Follow delivery and reply state across approved communication.`; `Audit log` / `A bounded, human-readable ledger of approvals and provider events.`; (fallback) `Live operational state from the protected RoomScout backend.` | `src/components/ops/OpsPageHeader.tsx`, `src/routes/ops/*` | Page framing, English | partial — prototype pages are „Betrieb im Blick“ / „Quellen“ / „Aufträge“ / „Integrationen“ / „Feature-Flags“ / „Diagnose“ with German sublines | REPLACE | Operator content column (`OPERATOR_SCREENS.md` §3.5) | later |
| `OpsWorkspace.css` imported from a component (global, session-wide) | `src/components/ops/OpsWorkspace.css` via `OpsPageHeader.tsx` | Ops card/table/filter skin | none | FLAG | move into the Operator dialog styles | later |

### 1.5 Voice — ongoing-call bar and error copy

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Ongoing-call pill `Gespräch läuft · Zum Scout` + mute (`Mikrofon einschalten` / `Mikrofon stummschalten`) + hang-up (`Gespräch beenden`), `aside[aria-label="Laufendes Scout-Gespräch"]` | `src/components/voice/VoiceSessionProvider.tsx`, `.rs-ongoing-call` in `design-system.css` | Floating pill on every authenticated route while a call is connected and the route is not `/app/scout` | partial — the prototype expresses a held session as the Settings sidebar line „Gespräch pausiert · läuft weiter, wenn du zurückkehrst“ (`SETTINGS_SCREENS.md` §2.2); there is no floating call pill, and no mute/hang-up outside the Scout stage | DECIDE (keep the pill, or reduce to the Settings session line) | Settings sidebar session line + Scout voice controls | nice |
| The 14 English voice error strings that replace the German status line (`Sign in before starting a private voice session.`, `This browser does not support microphone capture.`, `The realtime peer connection failed.`, `The Realtime event channel failed.`, `Received an unreadable Realtime event.`, `The browser did not create a WebRTC offer.`, `Could not start the Realtime session.`, `Microphone access was not allowed.`, `No microphone was found.`, `The voice service could not be reached. Check your connection and try again.`, `The browser could not create a voice connection.`, `The voice service is busy. Please wait a moment and try again.`, `The voice service could not process the microphone audio.`, `The Realtime session reported an error.`) | `src/hooks/useRealtimeVoiceScout.ts`, `src/features/voice/realtimeRuntime.ts`, rendered by `RealtimeVoiceScout.tsx:102` | Replace `statusCopy[status]` in the connection line; the German ` · Mikro aus` suffix is appended after them | **none** — the prototype has no error states; its only related string is the hint „Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus.“ | DECIDE (needs German equivalents written) | Scout voice controls; hint slot (`SCOUT_SCREENS.md` §2.8) | must |
| Tool-call failure payload `{"error":"The Scout could not complete that action."}` posted back as `function_call_output` | `src/hooks/useRealtimeVoiceScout.ts:263` | Reaches the model, may be paraphrased aloud | none | KEEP-AS-IS | — | later |
| `VoiceVolumeBlob` default `role="img"` label `Voice activity` (EN) while callers pass „Sprachaktivität“ | `src/components/voice/VoiceVolumeBlob.tsx` | a11y label | none (prototype blob is `aria-hidden="true"`) | KEEP-AS-IS | — | later |

### 1.6 `/` — Landing — `src/routes/public/LandingPage.tsx`

The route as a whole has a home (`Landing v2.dc.html`). These parts do not.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Closing CTA `Öffentlichen Markt ansehen →` → `/explore` | `LandingPage.tsx` (`section.landing-closing`) | Advertises the market explorer | **none** — Landing v2's secondary closing CTA is „Projekt ansehen ↗“ (GitHub) | REPLACE | closing section (`LANDING_SCREENS.md` §12) | must |
| Footer link `Karte` → `/map` | `LandingPage.tsx` (`footer.landing-footer`) | Advertises the globe | **none** — v2 footer is wordmark + „Ein persönlicher Scout für eure Proberaumsuche.“ + `GitHub` + „Entstanden beim Convex All Gas Hackathon.“ | REPLACE | footer | must |
| Hero sub-copy „Erzählt, was ihr sucht. RoomScout bündelt die Recherche und hilft, offene Fragen mit Anbietern zu klären.“ | `LandingPage.tsx` | Hero paragraph | partial — v2 reads „Erzählt, was ihr sucht. RoomScout übernimmt die Suche und klärt mit Anbietern, ob der Raum zu euch passt.“ | REPLACE (copy) | hero (`LANDING_SCREENS.md` §17.2) | nice |
| Story fact chip „Stuttgart & Umgebung“ | `src/components/landing/landingStoryModel.ts` | First fact of the scroll story | partial — the Scout surface and v1 use „Stuttgart“; v2 landing uses „Stuttgart & Umgebung“ | DECIDE (align with the Scout fact `facts.ort`) | scroll story beat 1 | nice |
| Branch B section `landing-continued-search` („Demo-Suche angepasst“, „Donnerstag bleibt gesetzt.“, CTA `Echten Scout öffnen`, replay link „Alternativen Demo-Ausgang mit Mittwoch ansehen“) | `src/components/landing/LandingStory.tsx` | The „Donnerstag bleibt wichtig“ branch of the interactive Rückfrage | partial — v2 has **no separate section**. The two choices are „Mittwoch passt“ / **„Donnerstag bleibt wichtig“**; the answer/reply strings are `ansText` = „Mittwoch passt auch.“ / „Donnerstag bleibt wichtig.“ and `repText` = **„Alles klar, Mittwoch geht also auch. Ich kläre den Rest.“** / **„Alles klar. Ich suche weiter nach Donnerstag.“**. The branch mechanism is `offerOp = alt ? 0.35 : (shown ? 1 : 0)` — on the Donnerstag path the offer card is **permanently dimmed to opacity 0.35**, and only the escape hatch **„Beispiel fortsetzen (Mittwoch-Pfad)“** (verbatim label, key `clarify.resume`; the only one of the four text links that *does* have a hover, `style-hover="color:#fff"`) sets `clar = 'mi'` and restores it | REPLACE | beat 4/5 (`LANDING_SCREENS.md` §8–§9, §17.7) | nice |
| `landing.css` is globally scoped once `/` has been visited (1158 lines, `.landing-shell` scope only by convention) | `src/styles/landing.css` | Landing design system | none | FLAG | fold into the token set (`TOKENS.md`) | later |

### 1.7 `/explore` and `/app/explore` — Market explorer

Whole route has **no** prototype counterpart (`APP_UI_INVENTORY.md` §0: 0 hits for „Anzeigen entdecken“ /
"Explore" in all five prototype files). Copy is English throughout.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Route `/explore` (public wrapper) and `/app/explore` (authenticated) | `src/routes/public/ExplorePage.tsx`, `src/app/router.tsx` | Same `ExploreContent`, two shells | none | KEEP-HIDDEN | — | must (nav), later (port) |
| `PageHeader` `Market explorer` + meta `Live index` + `{n} indexed signals` | `ExplorePage.tsx` + `src/components/ui/LedgerCard.tsx` | Count from `api.signals.list` | none | KEEP-HIDDEN | — | later |
| `CoverageTrustNotice compact` (`Observed online coverage, not total market availability.` + `Offline offers and sources that require an unconnected account may be missing.`) | `src/components/coverage/CoverageTrustNotice.tsx` | Honesty notice | **none** — no prototype surface carries a coverage disclaimer | DECIDE (it is a truth claim; keep it wherever sources are shown) | Settings „Quellen & Zugänge“ footnote | nice |
| Location input `#explore-location` (sr-only label `Location`, placeholder `City`, default `?city=` else `Stuttgart`) | `ExplorePage.tsx` | Server arg `signals.list {city}` | none | KEEP-HIDDEN | — | later |
| Side segment `.seg[aria-label="Signal side"]` — `All` / `Supply` / `Demand` | `ExplorePage.tsx` | Server arg `side` | none | KEEP-HIDDEN | — | later |
| Sort `SelectField[aria-label="Sort signals"]` — `Most relevant` / `Newest` | `ExplorePage.tsx`, `src/components/ui/SelectField.tsx` | Client sort | none | KEEP-HIDDEN | — | later |
| 6 filter chips `Fixed monthly`, `Hourly`, `≤ €250/month`, `Evenings`, `Storage`, `Fresh this week` | `ExplorePage.tsx` | Client-side filter over fetched signals | none | KEEP-HIDDEN | — | later |
| Result count `<b>{n}</b> signals in {location or "all indexed locations"}` + `Public, provenance-linked observations` | `ExplorePage.tsx` | Derived | none | KEEP-HIDDEN | — | later |
| Empty states `Loading signals…` / `RoomScout is loading the current public index.` and `No matching signals yet` / `No indexed signal currently matches this location and filter combination. Try removing a filter or searching another city.` | `ExplorePage.tsx` + `EmptyState` | Loading/empty | none | KEEP-HIDDEN | — | later |
| Result grid `div.list.rs-signal-grid` → `SignalCard` per signal | `ExplorePage.tsx`, `src/components/signals/SignalCard.tsx` | Public index cards | none (the prototype's nearest object is the candidate card, `SCOUT_SCREENS.md` §14 — different data, different job) | KEEP-HIDDEN | — | later |
| `Save this search` button + save-gate `ActionDialog` (unauth: `Save it to your account` / `Sign in so RoomScout can preserve this search and alert you. Browsing remains public.` / `Not now` / `Create account` / `Sign in`; auth: `Review before saving` / `The current city and supported filters will become an editable draft search. Your Scout can refine it with you before activation.` / `Save draft search`) | `ExplorePage.tsx` | Writes `api.savedNeeds.create` from chips, then navigates to `/app/search` | none — in the prototype a Suchauftrag is only ever created in the Scout conversation | KEEP-HIDDEN | — | later |
| Save errors `Add a city before saving this search.` / `The search could not be saved.` (`p.rs-form-error`, unstyled) | `ExplorePage.tsx` | Error slot | none | KEEP-HIDDEN | — | later |
| `/app/explore` visual delta (pill buttons, 22 px cards, 12 px inputs from `design-system.css` only) | `src/styles/design-system.css` | Same content, different skin than `/explore` | none | FLAG | — | later |

### 1.8 `/signals/:signalId` — Signal detail — `src/routes/public/SignalDetailPage.tsx`

Whole route has **no** prototype counterpart. English throughout.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Route + `Back to explorer` link | `SignalDetailPage.tsx` | Detail view of one public signal | none | KEEP-HIDDEN | — | must (nav), later (port) |
| `SignalBadge` row — `Supply`/`Demand` · `Observed`/`Source verified`/`User verified`/`Conflicting sources` + `Controlled demo` chip | `src/components/signals/SignalBadge.tsx` | Verification vocabulary | none — the prototype never labels verification state | KEEP-HIDDEN | — | later |
| `Freshness` (`Checked 3 h ago`, `Last seen 2 d ago`, `Possibly stale`) | `SignalBadge.tsx`, `src/data/convexAdapters.ts` | Recency | none | KEEP-HIDDEN | — | later |
| `Known facts` card (`Table.facts`: Price / Arrangement / Requirements, `Not stated`) | `SignalDetailPage.tsx` | Canonical signal | partial — the prototype's offer/candidate cards show price + time + storage, but as narrative rows, not a facts table | KEEP-HIDDEN | — | later |
| `Unknown or unclear` card + `No unresolved fields were recorded during normalization.` | `SignalDetailPage.tsx` | Unknowns list | none | KEEP-HIDDEN | — | later |
| `Freshness` timeline (`First observed`, `Last checked`, `Index status` → `Possibly stale` / `Published`) | `SignalDetailPage.tsx` | Provenance timing | none | KEEP-HIDDEN | — | later |
| `Fit — sign in for yours` card + `Create or activate a saved search to see structured match reasons and uncertainties for this signal.` | `SignalDetailPage.tsx` | Gated fit teaser | none | KEEP-HIDDEN | — | later |
| `Provenance` card (`Source`, `Evidence records`, `Verification`, excerpt blockquote, `Open source`, `No public evidence excerpt is attached to this record yet.`) | `SignalDetailPage.tsx` | Evidence trail | none | KEEP-HIDDEN | — | later |
| Action `Ask Room Scout about this` → `/app/scout?mode=signal_advisor&signalId=…` | `SignalDetailPage.tsx` | The only consumer of `mode=signal_advisor` | **none** — the prototype Scout has no "advise me about this listing" entry | KEEP-HIDDEN | — | later |
| Boundary note `Exact recipient and message approval is required before any inquiry is sent.` | `SignalDetailPage.tsx` | Safety claim | partial — prototype equivalents are „Eine verbindliche Zusage gibst nur du.“ and „Nachricht freigeben“ | KEEP-HIDDEN | reuse the prototype boundary strings | later |
| Sign-in gate dialog `Continue with your Scout` / `Sign in so RoomScout can keep your search, Scout thread, saved signal, and approvals together.` | `SignalDetailPage.tsx` | Auth gate | none | KEEP-HIDDEN | — | later |

### 1.9 `/map` and `/app/map` — `src/routes/MapPage.tsx`

Whole route has **no** prototype counterpart („Karte“ appears once, as a v1 landing footer link). English.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Route (public + workspace variant) | `src/routes/MapPage.tsx` | Coverage map | none | KEEP-HIDDEN | — | must (nav), later (port) |
| `PageHeader` eyebrow `Observed public coverage`, title `RoomScout coverage map`, meta `{n} positioned signals` / `{n} positioned markets` | `MapPage.tsx` | Counts from `api.map.listPins` / `listAreas` | none | KEEP-HIDDEN | — | later |
| Tools: `SelectField[aria-label="Market city"]` (`All market areas` + one per area), `.seg` `All/Supply/Demand`, chips `Fresh only`, `Verified only` | `MapPage.tsx` | Filter args | none | KEEP-HIDDEN | — | later |
| Area-vs-pin mode switch (`listPins` skipped until a city is chosen). The three props `MapPage` actually passes are `autoRotate={!city}`, `initialZoom={city ? 9 : undefined}` and `initialCenter={city && mapSignals[0] ? mapSignals[0].coordinates : undefined}`; the `2.5` zoom and `GERMANY_CENTER = [10.4515, 51.1657]` are `MarketGlobe`'s own defaults, not `MapPage` values (`APP_UI_INVENTORY.md` §5.5). The header meta switches `signals`/`markets` on the same condition | `MapPage.tsx` | Two different data shapes behind one screen | none | KEEP-HIDDEN | — | later |
| Derived strings `{city} market area`, `Public source` / `Indexed source` / `RoomScout market index`, `{n} supply · {n} demand · {n} verified`, `No freshness data` | `MapPage.tsx` | Card copy | none | KEEP-HIDDEN | — | later |
| `MarketGlobe` (Mapbox GL globe, clustering, auto-spin, ⌘/Ctrl scroll-zoom, side panel `Signals in view`, detail card, `Back to overview`, hint `Hold ⌘ or Ctrl while scrolling to zoom. Drag the globe to explore current market signals.`, errors incl. `VITE_MAPBOX_ACCESS_TOKEN is required to render the market globe.`) | `src/components/map/MarketGlobe.tsx` (+ `mapbox-gl` dependency, `VITE_MAPBOX_ACCESS_TOKEN`) | The only consumer of Mapbox in the app | none | KEEP-HIDDEN | — | later |
| Loading / empty / suspense states (`Loading the live market index…`, `No geocoded signals match these filters yet. Signals remain usable even when a location cannot be positioned.`, `Loading the interactive map…`) | `MapPage.tsx` | States | none | KEEP-HIDDEN | — | later |

### 1.10 `/sign-in` and `/sign-up` — `src/routes/public/AuthPage.tsx`

The prototype has **no** auth surface; its only related element is the Settings → Profil row „Demo-Login“
/ „Lokale Beispielidentität „herzbuben“ · keine echte Anmeldung“ / badge „Designprototyp“.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Route + `LedgerCard.authcard` shell | `AuthPage.tsx`, `src/app/router.tsx` (`AuthRoute`) | Sign-in / sign-up | none | KEEP-AS-IS | its own route, restyled to prototype tokens | must |
| DE intro block: eyebrow `Dein persönlicher RoomScout`, h1 `Euer nächster Raum beginnt hier.` / `Schön, dass du wieder da bist.`, p `Ein Gespräch. Ein Suchauftrag. Dein Scout bleibt dran.` / `Deine Suche und eure Gespräche warten auf dich.` | `AuthPage.tsx` | Prototype-flavoured German framing | none (invented for this route) | KEEP-AS-IS | auth route | nice |
| Context strip `Your current search can continue after authentication.` | `AuthPage.tsx` | Explains the returnTo flow | none | KEEP-AS-IS (translate) | auth route | nice |
| Form: `Username` (placeholder `e.g. vierteltakt`), `Password` + `.pwtoggle` (`Show password` / `Hide password`), hint `10–100 characters. No spaces at the beginning or end.`, `Confirm password`, submit `Please wait…` / `Create account` / `Sign in`, swap prefix `Already have an account? ` / `New here? ` + swap button `Sign in` / **`Create an account`** (note: the swap label `Create an account` is a *different string* from the submit label `Create account`) | `AuthPage.tsx`, `src/features/auth/errors.ts` | Convex Auth v2 username/password | none | KEEP-AS-IS (translate) | auth route | must |
| Mode inference behaviour: the mode is inferred from the pathname (`…sign-up` ⇒ sign-up) and **can be toggled in place without navigating**, so `/sign-in` can render the sign-up form and vice versa | `AuthPage.tsx` (`APP_UI_INVENTORY.md` §5.6, Mode-swap row) | URL and rendered form can disagree | none | DECIDE (preserve, or make the swap navigate) | auth route | nice |
| The **4 page-local validation strings** that are *not* in `features/auth/errors.ts`: `Enter a username.`, `Use at least {n} characters.`, `Use no more than {n} characters.`, `The passwords do not match.` — rendered in `p.err.visible[aria-live=polite]` (`.visible` has no CSS rule) | `AuthPage.tsx` | Client-side form validation | none | KEEP-AS-IS (needs German pairs) | auth route | must |
| The 15-string auth error dictionary from `features/auth/errors.ts` + `Authentication is not connected in this presentation-only route yet.` — **all 15 quoted verbatim in §4.1** | `src/features/auth/errors.ts`, `AuthPage.tsx` | Error copy, English | none | KEEP-AS-IS (needs German pairs) | auth route | must |
| Escape hatch `Continue browsing without an account` → `/explore` | `AuthPage.tsx` | Sends users to a legacy route | **none** | REPLACE (point at `/`) | Landing | must |

### 1.11 `/app/scout` — `src/routes/musician/ScoutPage.tsx`

The German discovery/brief/voice stages have a home. These do not.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Attention card `section.attention`: label `Open question`, h2 = `attention.uncertainties[0]`, p = `attention.reasons[0] ?? "Scout needs your preference before proceeding."`, up to 2 buttons all labelled `Discuss this with Scout` (sends `About the current opportunity: {question}`) | `ScoutPage.tsx` | The app's clarification stage, English, free-text answer | partial — prototype `clarification` stage (`SCOUT_SCREENS.md` §9): „Eine kurze Rückfrage.“ + eyebrow „Raum in Stuttgart-West“ + question + detail + two typed buttons „Ja, Mittwoch passt“ / „Nein, Donnerstag ist wichtig“ + composer | REPLACE | Scout `clarification` stage | must |
| Results grid `.results` with up to 6 `article.result` cards: meta `{verification}` + `{n} source(s)`, title, `{district, city}`, `€{price} / {period}` chip, up to 2 `match.reasons`, summary, buttons `Ask Scout to inquire` / `Dismiss` | `ScoutPage.tsx` (+ `marketSignal()` at lines 281–330) | The app's match list, English | partial — prototype `candidates` stage (`SCOUT_SCREENS.md` §14): „Drei Räume, die in Frage kommen.“, badge „Mein Vorschlag“, photo, price, time, storage, way, size, note, CTA „Diesen Raum anfragen“, „Keiner passt, weiter suchen“ | REPLACE | Scout `candidates` stage | must |
| Waiting/paused quiet lines `Your search is paused. Resume it to refresh your matches.` / `No current matches for {need.city} yet.` (`No current matches for this search yet.` with an empty city) | `ScoutPage.tsx` | English filler under the workspace | partial — prototype uses `STATUS` lines („Ich suche nach passenden Räumen in Stuttgart.“ …) and the footnote „Du kannst die App schließen. Ich melde mich.“ | REPLACE | Scout autopilot status line | must |
| Activity `<details class=activity>`: summary `What Scout is doing`, items `Subscribed to live matches for this search`, `Reading the current index…` / `{n} current matches`, `Checking opportunities…` / `{n} open opportunities` | `ScoutPage.tsx` | Debug affordance describing query state | partial — prototype „Aktivität ansehen“ / „Aktivität ausblenden“ lists domain events („Suchauftrag gestartet“, „Raum in Stuttgart-West gefunden“, „Anbieter über das Portal kontaktiert“, „Warte auf Antwort“, „Angebot eingegangen“) | REPLACE | Scout autopilot activity list (`SCOUT_SCREENS.md` §8.7) | must |
| Bottom action `Aktualisieren` (RefreshCw, `api.matches.recomputeMine`, only while `need.status==="active"`) | `ScoutPage.tsx` | Manual re-match | **none** — the prototype never asks the user to refresh | DECIDE (drop, or keep as a hidden dev control) | — | nice |
| Topline `nav.topActions` → `Link.ghost` `/app/settings` labelled `Einstellungen` (icon `Settings2`) | `ScoutPage.tsx` | Second settings entry point | partial — the prototype has exactly one entry, in the avatar menu | REPLACE (remove; keep the avatar-menu entry) | avatar menu | must |
| 3 English conversation starters `We need a permanent room for our band`, `We are open to sharing with a compatible band`, `Help me work out what matters before we search` (visible only while the thread has no persisted messages) | `ScoutPage.tsx` → `src/components/scout/ScoutConversation.tsx` | Cold-start prompts | partial — the prototype's text mode shows **one** suggestion chip at a time, whose value is the pending scripted user line. The four real values (the `who:'user'` entries of `SCRIPT`, indices 1/3/5/6) are: „Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat.“ · „Donnerstags ab 19 Uhr wäre gut.“ · „Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit.“ · „Und beim Budget lieber maximal 350 Euro.“ A fifth value **„Ja, leg los.“** is *not* from `SCRIPT` — `backToConvo` sets it literally together with `stepIndex: SCRIPT.length` (8) while `SCRIPT` has indices 0–7, so on that path `useSuggestion` / `submitDiscovery` / `demoNext` all throw a `TypeError` (`SCOUT_SCREENS.md` §6.7 + the §7 hazard note). **Do not port „Ja, leg los.“ as a working suggestion without the guard** — §7 recommends option (a): treat `stepIndex >= SCRIPT.length` as end-of-script and play „Ja, leg los.“ as a synthetic user utterance that goes straight to `morphToBrief()` | DECIDE (write German starters, or drop) | Scout discovery text mode | nice |
| Free-text handling on the discovery composer | `ScoutConversation.tsx` (no equivalent guard) | The app interprets any free text | partial — `submitDiscovery` accepts text that loosely matches the scripted line (≥2 shared words >3 chars, or 1 shared word plus the reference number); otherwise it shows the hint **„Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich.“** and, when the Scout is still speaking, **„Der Scout ist noch nicht fertig. Gleich kannst du antworten.“** Both are prototype-only strings — the app *does* interpret free text, so neither should ship | FLAG (do not port the hints) | — | nice |
| `ScoutConversation` English chrome: `Scout is thinking…`, sr-only `Message your Room Scout`, placeholder `Tell Scout what matters…`, aria `Talk to Scout` / `Send message` | `src/components/scout/ScoutConversation.tsx` | Conversation UI | partial — prototype: aria „Nachricht an deinen Scout“, placeholders „Antwort an deinen Scout …“ / „Dein Scout spricht …“, aria „Senden“, state „Ich denke kurz nach“ | REPLACE (copy) | Scout discovery | must |
| `ScoutBrief` English copy: `Your search brief`, `{n} search facts`, `Tell Scout what matters and your brief will form here.` | `src/components/scout/ScoutBrief.tsx` | Collapsed brief pill | partial — prototype pill/sheet: „Euer Suchauftrag“, „{count} Wünsche gemerkt“ / „1 Wunsch gemerkt“ | REPLACE (copy) | Scout brief pill (`SCOUT_SCREENS.md` §4.4) | must |
| `Hey there.` — the English fallback inside the German greeting `Hey {name}.` when neither `displayName` nor `username` is set | `ScoutPage.tsx` | Greeting | partial — prototype greets „Hey {name}.“ with `name = "Herzbuben"` and never falls back to English | DECIDE (German fallback) | Scout welcome | nice |
| `ApprovalComposer` (`Manual send review`) mounted on this page, English, rendered only when a `draftSignal` + matching outreach draft exist | `src/components/outreach/ApprovalComposer.tsx` | Editable subject/body + a **4-state** approve ladder: `Lock exact version for review` → `Approve & send once` → `Send approved message`, plus a **fourth** state `Approve exact message` for any draft status outside `drafted`/`awaiting_approval`/`approved`, the busy label `Working…`, and a `Cancel` button to its left (`APP_UI_INVENTORY.md` §8) | partial — the prototype's approval is the inline autopilot card „Freigabe nötig“ / „An: Anbieter · Raum in Stuttgart-West · roomscout.dev“ / „Nachricht freigeben“ / „Handlungsspielraum ändern“, with a **non-editable** message. **That card is unreachable in the prototype's default flow**: `RULES0 = { mode:'autopilot', contact:true, … }`, so `attemptContact()` falls straight through to `contactAndWait()`; the card, `state.pending`, `waitingFor:'release'` and the toast „Dein Scout wartet auf deine Freigabe“ only appear once the user switches Settings → Handlungsspielraum to `mode:'review'` or `contact:false` (`SCOUT_SCREENS.md` §8.3) | DECIDE (editable vs read-only message) | Scout autopilot approval card (`SCOUT_SCREENS.md` §8.3) | must |
| — the state machine behind that card (load-bearing for the port) | — | — | `attemptContact()` has **two guards**: it is a no-op outside `AUTOPILOT` **and** a no-op once `st.activity.some(a => a === ACT.contacted)` — so it can never fire twice. It then checks, in order, source (§8.4) → access (§8.5) → `rules.mode === 'review' \|\| !rules.contact` (the card) → `contactAndWait()`. Releasing (`releaseMessage` → `contactAndWait()`) applies **four immediate state changes before any timer**: `status = STATUS[2]` („Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.“), `pending: null`, `waitingFor: null`, `activity + ACT.contacted` („Anbieter über das Portal kontaktiert“); only then are the 3000 ms → `waiting`/`STATUS[3]` and 10000 ms → `arriveReply()` timers armed | PORT-INTO | Scout autopilot state machine | must |
| URL params `?mode=search_discovery\|signal_advisor\|outreach_drafting` and `?signalId=` | `ScoutPage.tsx` | Deep-link modes | **none** | KEEP-AS-IS (harmless), remove `signal_advisor` links | — | later |
| Fallback intro messages `I have your saved music context. Tell me what kind of rehearsal situation you want now.` / `Tell me about your band and the room you need. I’ll turn the useful details into a search you can review.` | `ScoutPage.tsx` | First thread message, English | partial — prototype `script.s1.scout`: „Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?“ | REPLACE (copy) | Scout discovery | must |
| Outreach prompt sent as a user message: `Handle the next appropriate inquiry about “{signal.title}”. Use only the active persisted mandate for eligible non-binding outreach. Any commitment or human-only step must come back to me.` | `ScoutPage.tsx` (`prepareOutreach`) | Appears verbatim in the transcript | none — the prototype's transcript contains only natural dialogue | DECIDE (hide from the transcript, or rewrite) | Scout transcript („Mitschrift“) | nice |
| `ScoutPage.marketSignal()` — a second signal vocabulary that disagrees with `convexAdapters.publicSignalToMarketSignal` (freshness, arrangement, source, firstSeen, facts) | `ScoutPage.tsx:281–330` vs `src/data/convexAdapters.ts` | Same data, two label sets | none | FLAG (unify during the candidates rebuild) | one adapter | nice |
| `features/scout/viewModel.ts` English fact labels (`Location`, `Arrangement`, `Budget`, `Radius`, `Schedule`, `Essential`, `Sharing`, `Music`, `Instruments`, `Connections`) feeding a German fact list; `Sharing` value differs from `savedNeedToSearch` (`Open to a compatible band` vs `Open to compatible room-sharing`) | `src/features/scout/viewModel.ts`, `src/data/convexAdapters.ts` | The fact rail content | partial — prototype facts have no labels at all, only icon + value („Stuttgart“, „Bis 350 € / Monat“, „Geteilter Raum · 4 Personen“, „Donnerstags ab 19 Uhr“, „Schlagzeug darf im Raum bleiben“) | REPLACE | Scout fact list (`SCOUT_SCREENS.md` §4) | must |
| `ScoutFactList` empty state „Was euch wichtig ist, sammelt sich hier – während wir sprechen.“ | `src/components/scout/ScoutFactList.tsx` | Empty rail | none — the prototype list simply does not render until a fact arrives | KEEP-AS-IS | Scout fact list | later |

### 1.12 `/app/search` — "My search" — `src/routes/musician/MySearchPage.tsx`

Whole page is **(c)**: its three tabs map to Scout + Settings in the prototype. English throughout.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| The route itself | `MySearchPage.tsx`, `src/app/router.tsx` | Ledger page for the saved need | **none as a page** | KEEP-HIDDEN | split: brief → Scout, sources/autonomy → Settings, activity → Scout activity list | must (nav), later (port) |
| Route-level loading and empty states: `My search` + `Loading your search…` / `RoomScout is loading your saved criteria and current matches.`; `No saved search yet` / `Talk to your Scout to turn your rehearsal-room needs into an editable search.` + CTA `Start with your Scout`. Plus the two panel placeholders `Loading Scout mandate…` / `Loading the active version and authorization limits.` (overview-left `MandatePanel` slot) and `Loading source coverage…` / `Loading reviewed source coverage and your saved source preferences.` (sources tab) | `MySearchPage.tsx` + `EmptyState` (`APP_UI_INVENTORY.md` §6.2) | Query-state copy, English | none — the prototype has no loading states; its nearest empty state is Settings → Quellen „Lege zuerst einen Suchauftrag an.“ | KEEP-HIDDEN (with the route); reuse the strings if the panels move into Settings | Settings → Quellen / Handlungsspielraum | later |
| `PageHeader` `My search` + meta `Convex live query` + `Pause`/`Resume`/`Updating…` | `MySearchPage.tsx` | Status + pause toggle (`savedNeeds.setStatus`) | partial — prototype pause lives in the Scout header („Suche pausieren“ / „Suche fortsetzen“) and the badge „Suche pausiert“ | PORT-INTO | Scout header (`SCOUT_SCREENS.md` §2.4.2) | must |
| Tab bar `overview` / `sources · {n}` / `activity` (`role=tablist`, lowercase + CSS capitalize) | `MySearchPage.tsx` | `?tab=` navigation | none | KEEP-HIDDEN | — | later |
| `SearchProfileCard` (eyebrow `Draft search` / `Your search`, meta `Not active yet` or the raw status string, `dl.rs-search-fields` with a `You`/`Scout` chip per field, draft meter `{n} of {n} high-value fields set`, `Confirm search`) | `src/components/scout/SearchProfileCard.tsx` | Read-only brief; `onEdit`/`onConfirm` are never passed, so the pencil buttons never render and `Confirm search` is inert | partial — prototype brief card („Euer Suchauftrag“ + „Scout losschicken“ + „Noch etwas ändern“ + per-row edit „Kriterium bearbeiten“ / „Übernehmen“ / „Abbrechen“) | REPLACE | Scout brief card (`SCOUT_SCREENS.md` §4.2/§7) | must |
| Link `Edit with Scout` → `/app/scout?mode=search_discovery` | `MySearchPage.tsx` | Back to Scout | partial — prototype „Zurück zum Gespräch“ / „Noch etwas ändern“ | REPLACE | Scout brief card | later |
| `LedgerCard` `Updates`: rows `Channel`→`In-app notifications`, `Cadence`→`As matches and replies arrive`, `Decision point`→`Agreements, bookings, or money` | `MySearchPage.tsx` | Static explanation | partial — the prototype's Settings „Benachrichtigungen“ page owns this topic („Wann soll ich mich melden?“) | PORT-INTO | Settings → Benachrichtigungen | later |
| `Current matches` card (`{n} live`, `Matches use structured constraints plus semantic compatibility. Unknown facts remain visible as uncertainty.`, draft/empty states, match cards with `{n}% match`, `Room signal` / `Potential band connection`, reasons, `Still unclear: …`, actions `Open detail` → `/signals/{id}`, `Save`, `Dismiss`) | `MySearchPage.tsx` | The match ledger | partial — prototype `candidates` stage; `Open detail` points at a legacy route | REPLACE | Scout `candidates` stage | later |
| `sources` tab → `SearchSourcesPanel` | `MySearchPage.tsx`, `src/components/search/SearchSourcesPanel.tsx` | Duplicate of the Settings sources panel with a different error string and no `Saving…` state | partial — prototype has one place: Settings „Quellen & Zugänge“ | PORT-INTO | Settings → Quellen & Zugänge | later |
| `activity` tab: `Search activity` + `Persisted search + match events` → `ol.stream` rows `Search updated — {title}`, `New match` / `Match updated` — `{signalTitle}` + `{n}%` | `MySearchPage.tsx` | Derived event stream | partial — prototype autopilot activity list (domain events, German) | PORT-INTO | Scout activity list | later |
| Error set `The search status could not be changed.`, `The match could not be updated.`, `The source preference could not be saved.`, `The mandate could not be updated.`, `The mandate could not be saved and activated.` | `MySearchPage.tsx` | Error slot (`p.rs-form-error`, unstyled) | none | PORT-INTO | wherever the control lands | later |
| `stopConditions` divergence: `MySearchPage.tsx:184` emits `A login or human-only step is required` while `SearchControlSettings.tsx:222–226` emits `A human-only step is required`; plus `Coverage status unavailable` vs `Coverage unavailable`, two source-error strings, two date formats | `MySearchPage.tsx`, `src/components/settings/SearchControlSettings.tsx` | Same concept, two strings | none | DECIDE (unify before extracting i18n keys) | Settings → Handlungsspielraum | must |

### 1.13 `/app/inbox` — `src/routes/musician/MusicianInboxPage.tsx`

Three-pane tool, **no** prototype counterpart. Mixed DE frame / EN function.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| The route + `div.threepane.rs-inbox` layout (245 px / 1fr / 270 px) | `MusicianInboxPage.tsx` | Message workspace | **none** | KEEP-HIDDEN | provider replies fold into the Scout stages | must (nav), later (port) |
| Filter bar h1 „Nachrichten“ + p „Alle Gespräche zu eurer Suche. Dein Scout bleibt für euch dran.“ | `MusicianInboxPage.tsx` | German framing | none | KEEP-HIDDEN | tone is reusable in Scout | later |
| 5 channel chips `all`, `needs action`, `email`, `webform`, `platform dm` (+ the `needs action` per-channel status test) | `MusicianInboxPage.tsx:76–85` | Filtering; changing a chip resets the selection to `visibleThreads[0]` | none | KEEP-HIDDEN | — | later |
| Thread list `Gespräche` + count, `.titem` rows (`Email`/`Platform DM`/`Web form`, participants or `participants not exposed`), empty „Hier ist es noch ruhig. Sobald ein Gespräch beginnt, erscheint es hier.“ | `MusicianInboxPage.tsx` | `communications.listThreadsMine` | none | KEEP-HIDDEN | — | later |
| Email thread pane (`You → {to}` / `{from} → You`, `Delivery update · {status}`, parsed block `Scout · Parsed reply` + `AI interpretation · original stays above`, actions `Draft reply with Scout`, `Ask Scout`, `Update search`) | `MusicianInboxPage.tsx` | Mail transcript | none | KEEP-HIDDEN | — | later |
| Platform thread pane (`Platform DM · {status}`, `Synced thread`, `No messages in this thread`, actions `Draft platform reply`, `Ask Scout`) | `MusicianInboxPage.tsx` | Portal DM transcript | none | KEEP-HIDDEN | — | later |
| Web-form pseudo-channel synthesized client-side from `externalActions.listMine` rows with payload kind `contact_form` (`Prepared for {hostname}`, `Action state · {status}`, action `Review exact form`) | `MusicianInboxPage.tsx` | A channel that exists only in this page | none | KEEP-HIDDEN | (DATA_MAP §7.5 recommends moving this server-side) | later |
| Empty pane `Platz für gute Nachrichten.` / `Wähle links ein Gespräch. Hier findest du den Verlauf und neue Antworten.` | `MusicianInboxPage.tsx` | German empty state | none | KEEP-HIDDEN | — | later |
| Context pane: mailbox block `Scout mailbox` + `mailbox.emailAddress` / `Provisioning…` / `Created on first outreach` | `MusicianInboxPage.tsx` | AgentMail identity | partial — prototype Settings block „Deine Scout-Adresse“ / „herzbuben@scout.example“ / „Für Portal-Anmeldungen und Antworten an deinen Scout.“ / „Kopieren“ | PORT-INTO | Settings → Quellen & Zugänge | nice |
| Context pane boundary block „Du hast das letzte Wort.“ / „Dein Scout kümmert sich um unverbindliche Gespräche. Zusagen, Buchungen und Zahlungen bleiben bei dir.“ | `MusicianInboxPage.tsx` | Safety claim, German | partial — prototype „Verbindliche Entscheidungen bleiben bei dir.“ / „Verträge, Buchungen und Zahlungen brauchen immer deine Freigabe.“ (Settings → Handlungsspielraum) | REPLACE | Settings → Handlungsspielraum lock card | later |
| `<details class=rs-inbox-advanced>` `Advanced activity` → `Selected channel` table, `Account & verification mail` (`MailboxVerificationPanel`), `External action ledger` (`ActionLifecyclePanel`, `actionRows.slice(0,10)`), `Opportunities` (up to 3 `OpportunityHandoff`) | `MusicianInboxPage.tsx` | Power-user ledger | **none** | KEEP-HIDDEN | — | later |
| `ActionApprovalSheet` mount (always `authorization:{mode:"approve_once"}`, no `onPauseMandate`) | `src/components/actions/ActionApprovalSheet.tsx` | One-time approval dialog | partial — prototype approval is the inline autopilot card; there is no dialog | PORT-INTO | Scout autopilot approval card | nice |
| Six error strings — **all quoted verbatim in §4.4** | `MusicianInboxPage.tsx` | Error slot | none | KEEP-HIDDEN | — | later |
| Badge/endpoint mismatch: the shell badge counts `api.inbox.listThreadsMine`, the page lists `api.communications.listThreadsMine` | `WorkspaceShell.tsx` vs `MusicianInboxPage.tsx` | Badge and list can disagree | none | FLAG (resolves itself when the badge is removed) | — | must |

### 1.14 `/app/profile` and `/app/settings/:section?` — `src/routes/musician/ProfilePage.tsx`

The frame and all seven sections have prototype homes; these parts inside them do not.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| `SettingsFrame` rail: `h2` `Settings`, groups `Scout` / `Account`, items `Sources & access`, `Autonomy`, `What Scout knows`, `Profile`, `Notifications`, `Plan & usage`, `Privacy` (all English) | `src/components/settings/SettingsFrame.tsx` | Section navigation | partial — the prototype rail is „Zurück zum Scout“ + session line + „Dein Scout“ (Quellen & Zugänge, Handlungsspielraum, Was dein Scout weiß) + „Dein Konto“ (Profil, Benachrichtigungen, Tarif & Nutzung, Datenschutz) + footer „Persönlicher Bereich“ | REPLACE (copy + rail structure) | Settings sidebar (`SETTINGS_SCREENS.md` §2) | must |
| The 7 English `h1`/`p` header pairs — **all seven quoted verbatim in §4.2** | `ProfilePage.tsx` | Page headers | partial — prototype headers are „Wo darf dein Scout suchen?“, „So arbeitet dein Scout“, „Was ich über euch weiß“, „Dein Profil“, „Wann soll ich mich melden?“, „Tarif & Nutzung“, „Deine Daten, deine Kontrolle“ | REPLACE (copy) | Settings content column | must |
| `SearchControlSettings` guard states `Loading search controls…` / `Reading your active search and its live authorization state.` and `Create a search first` / `Source preferences and mandates belong to a concrete search, so RoomScout will not create global permissions without one.` + `Start with your Scout` | `src/components/settings/SearchControlSettings.tsx:66–88` | Shown on **both** sources and autonomy | partial — prototype has an empty state only on Quellen: „Lege zuerst einen Suchauftrag an.“ / „Quellen gelten immer für eine konkrete Suche. Deine Portalzugänge bleiben davon unabhängig.“ / „Zum Scout“ | REPLACE (copy); DECIDE whether Handlungsspielraum shows one too | Settings → Quellen (`SETTINGS_SCREENS.md` §4.2) | must |
| `SearchSourcesPanel` coverage card (`Coverage for {city}` / `Coverage for this search`, `Live index evidence`, 4 metrics `observed signals` / `evidence sources` / `watching this search` / `known gaps`, fixed hint `Source inclusion is a search preference. Global monitoring, policy review, and extraction health remain operator-controlled.`, caller disclosure with the fallback `Coverage is based on reviewed sources.`) | `src/components/search/SearchSourcesPanel.tsx` | Index-evidence explainer | **none** — the prototype source page shows only source rows + „Passende Quellen automatisch auswählen“ + „Deine Scout-Adresse“ + „Weitere Quellen“ | DECIDE (keep as an honesty block, or drop) | Settings → Quellen, below the source list | nice |
| `SearchSourcesPanel` source rows: status pills `Watching` / `Partial coverage` / `Connection required` / `Under review` / `Unavailable`, footer `{lastCheckedLabel ?? "No successful check recorded"}` + `{signalCount ?? 0} relevant signals`, toggle `Included` / `Excluded` / `Saving…`, `Connect` | `SearchSourcesPanel.tsx` | Per-source preference | partial — prototype rows use „Verbunden“ / „Anmeldung erneut nötig“ / „Ohne Anmeldung“ / „Nicht einbezogen“, a switch with aria „{name} für diese Suche verwenden“, „Gespeichert“, and a „Details“ disclosure | REPLACE (copy + shape) | Settings → Quellen (`SETTINGS_SCREENS.md` §4.6) | must |
| `PortalConnectionsWorkspace` — mail-identity card `Registration & reply address`, safety block `One isolated Browserbase Context per portal identity` + the Browserbase paragraph, `Your portal identities` with 6 status label/description pairs (**all six quoted verbatim in §4.6**), scope chips `Read-only research` / `Inbox sync`, actions `Let Scout register`, `Open secure setup`, `Reconnect portal`, `Reauthenticate`, `Sync inbox`, `Pause`, `Disable & delete Context`, and `Available portals` + `Prepare connection` | `src/components/connections/PortalConnectionsWorkspace.tsx` | The real portal workshop (7 actions, 6 states) | partial — the prototype's whole portal UI is one sheet „Verbindung zu roomscout.dev“ with Portalprofil / Zustand / Letzter erfolgreicher Zugriff, „Verbindung trennen“, and a simulated „Demo-Anmeldung abschließen“ | DECIDE (how much of the real flow the ported Settings shows) | Settings → Quellen → connection sheet (`SETTINGS_SCREENS.md` §12) | must |
| Disable dialog: title `Disable this portal connection?` / description `This affects only the selected portal. Other connected sites keep their own Contexts.` / body `RoomScout will stop using this portal and ask Browserbase to delete its persisted Context. This removes the reusable portal session; it does not delete the account on the third-party website.` / buttons `Keep connected` · `Disable & delete Context` | `ProfilePage.tsx` | Confirmation | partial — prototype confirm is „RoomScout verliert den gespeicherten Zugang. Dein Account auf dem Portal bleibt bestehen.“ / „Verbunden bleiben“ / „Verbindung trennen“ | REPLACE (copy) | connection sheet | nice |
| The 7 portal error strings — **all quoted verbatim in §4.3** | `ProfilePage.tsx` | Error slot | none | KEEP-AS-IS (translate) | connection sheet | later |
| Knowledge: `Working context` card (`Version {n}` / spinner + `Learning`, sections `Musical identity`, `Practical context`, `People + relationships`, fallback `Not enough context yet.`, empty state `Your Scout is ready to learn` + `Build working context now`) | `ProfilePage.tsx` | LLM working context | partial — prototype summary card is one sentence, verbatim **„Ihr seid eine vierköpfige Band aus Stuttgart. Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen.“** (key `knowledge.summary.demo`), with an edit affordance „Zugrunde liegende Angaben bearbeiten“ | REPLACE | Settings → Was dein Scout weiß, summary card (`SETTINGS_SCREENS.md` §7.2) | must |
| Knowledge: `grid3.rs-memory-layers` — `Hard constraints`, `Soft preferences`, `Worth asking` | `ProfilePage.tsx` | Three derived buckets | **none** — the prototype groups knowledge by life area („Eure Band“ / „Alltag & Wege“ / „Ausstattung“) | DECIDE (bucket by category instead) | Settings → Was dein Scout weiß, tabs (`SETTINGS_SCREENS.md` §7.3) | must |
| Knowledge: `Fact memory` rows (`{predicate} · {category}`, `{value} → {objectName}`, `{verification} · {source} · {n}% confidence`, `Forget {value}` + confirm dialog: title `Forget this fact?` / description `The original memory event remains in the audit trail.` / body `RoomScout will stop using this fact and rebuild the working context without it.` / buttons `Keep it` · `Forget fact`) | `ProfilePage.tsx` | Fact list, grouped by subject | partial — prototype rows offer „Stimmt“ / „Nicht wichtig“ / „Bearbeiten“ / „Mehr“ → „Nicht mehr verwenden“ / „Herkunft ansehen“, a badge „Noch zu bestätigen“, the origin line „Herkunft: {origin}. Verwendet für: {usage}.“ and an undo bar „„{text}“ wird nicht mehr verwendet.“ / „Rückgängig“ | REPLACE | Settings → Was dein Scout weiß, fact rows (`SETTINGS_SCREENS.md` §7.5–§7.6) | must |
| — `deleteFact` makes **no distinction by origin**; the prototype does | `ProfilePage.tsx` vs `SETTINGS_SCREENS.md` §7.5 (`retire` handler) | Any fact can be forgotten today | partial — in the prototype a knowledge row **carrying a `factId` cannot be retired at all**: „Nicht mehr verwenden“ then only closes the kebab menu and fires the toast **„Diese Angabe gehört zum Suchauftrag. Bearbeite sie dort oder korrigiere sie hier.“** Only non-fact knowledge items are retired (`status:'retired'` + log entry „Angabe nicht mehr verwenden: {text}“ + a **6000 ms** undo window). Note also that „Nicht wichtig“ (`dismiss`) retires *without* setting the undo bar | DECIDE (adopt the fact/knowledge split, or keep one delete path) | Settings → Was dein Scout weiß, fact rows | must |
| Knowledge: `Account` card (`Username`, `Role`, `Raw import`→`Analyzed, never stored`, `Autopilot`→`Non-binding outreach only · commitments stay with you`, `Semantic index`→`{n} / {n} facts ready`) | `ProfilePage.tsx` | Account/index status inside the knowledge section | **none** | DECIDE (move the honest claims to Datenschutz; drop the index row) | Settings → Datenschutz | nice |
| Knowledge: `Build semantic index` button + `Set OPENAI_API_KEY in this Convex deployment first.` / `Semantic memory is up to date.` | `ProfilePage.tsx` | Developer affordance (`memory.refreshMyEmbeddings`) | **none** | KEEP-AS-IS but hide from the ported UI | — | later |
| Knowledge: `Memory activity` list (`{HH:MM}` + summary + eventType chip, empty `The event ledger will show what changed and when.`) | `ProfilePage.tsx` | `memory.listMine().events` | partial — prototype „Änderungsverlauf ansehen“ / „ausblenden“ with entries like „Angabe korrigiert: {text}“, „Budget korrigiert: 400 → 350 €“ | REPLACE (copy) | Settings → Was dein Scout weiß, Änderungsverlauf (§7.7) | nice |
| Knowledge: `ContextImportDialog` (`Import your music context`, `01 · Ask your current assistant`, `Copy prompt`, `02 · Paste the result here`, `Analyze for review` (≥20 chars), `Scout readout`, `Remember {n} facts`, plus `MUSIC_CONTEXT_IMPORT_PROMPT` — **14 lines, 11 of them non-blank** (1 intro + 1 instruction + 7 bullets + 1 boundary paragraph + 1 closing), quoted verbatim in `APP_UI_INVENTORY.md` §8 under „`MUSIC_CONTEXT_IMPORT_PROMPT` — the verbatim prompt rendered in `ContextImportDialog`“) | `src/components/memory/ContextImportDialog.tsx`, `src/features/memory/contextImportPrompt.ts` | 2-phase import, English, real LLM extraction | partial — prototype is a **3-step** dialog („Schritt {n} von 3“: „Kontext vorbereiten“ / „Ergebnis einfügen“ / „Vor Übernahme prüfen“) with a German prompt, „Beispiel einsetzen“, conflict notes („Widerspricht „{text}“ im aktuellen Suchauftrag…“) and „Ausgewählte Angaben übernehmen“ | REPLACE (structure + copy; keep the real extraction) | Settings → Was dein Scout weiß → Kontext importieren (`SETTINGS_SCREENS.md` §13) | must |
| Profile section: read-only `Account` card (`Display name` → `Not set`, `Username` → `Loading…`, `Role` → `Musician`) | `ProfilePage.tsx` | Identity, read-only (`DATA_MAP.md` §1.9: nothing ever writes `displayName`) | partial — prototype has an editable „Anzeigename“ form with „Speichern“, the confirmation „Name gespeichert. Ansprache und Initialen sind aktualisiert.“, a „Demo-Login“ row and the footnote „Externe Portal-Accounts und deine Scout-Adresse werden bei einer Namensänderung nicht umbenannt.“ | DECIDE (see Table 2 — no write path exists) | Settings → Profil | must |
| Notifications section: static card h2 `In-app decisions stay visible`; p `Matches, replies, approvals, and required handoffs appear in RoomScout as they arrive. User-configurable email, push, and browser notification preferences are not available yet; RoomScout will not claim permission or delivery it has not implemented.`; action `Open inbox` → `/app/inbox` | `ProfilePage.tsx` | Honest non-feature (pinned by `ProfilePage.test.tsx`) | partial — prototype has 3 toggles + a channel segmented control (see Table 2) | DECIDE | Settings → Benachrichtigungen | must |
| Usage section: static card h2 `Billing is not available`; p `This workspace has no connected billing system, purchasable plan, or user-facing metering ledger. No prices, quotas, or usage totals are shown because RoomScout cannot currently verify them.` | `ProfilePage.tsx` | Honest non-feature (pinned by test) | partial — prototype „Tarif & Nutzung“ is a full page (see Table 2) | DECIDE | Settings → Tarif & Nutzung | must |
| Privacy section: `Storage boundaries` + `Services involved` cards | `ProfilePage.tsx` | Two static paragraphs | partial — prototype „Datenschutz“ has 6 rows incl. Export and Konto löschen (see Table 2); its vendor row is „Beteiligte Dienstleister“ | REPLACE (copy) | Settings → Datenschutz | must |
| Legacy `?tab=connections` / `?tab=memory` query support | `ProfilePage.tsx` | Old deep links (pinned by `ProfilePage.test.tsx`) | none | KEEP-AS-IS | — | later |

### 1.15 `/app/runs/:runId` — Browser run — `src/routes/musician/BrowserRunPage.tsx`

Whole route has **no** prototype counterpart (the prototype simulates portal login inside Settings).

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| The route + `div.wrap.rs-browser-run-page` | `BrowserRunPage.tsx` | Live-View run page; reached from `PortalConnectionsWorkspace` | none | KEEP-HIDDEN | — | must (linkage), later (port) |
| `PortalAuthenticationGuide` (head strip `You control this one-time {portalName} setup` + the Live-View paragraph, the 3-step `ol`, mail block + `Copy address` / `Create address`, checkbox `I can see that {portalName} is signed in`, hint `Open the Live View before confirming the portal session.`) | `src/components/connections/PortalAuthenticationGuide.tsx` | Human-login instructions (pinned by its test) | partial — prototype's „Demo-Anmeldesimulation“ sheet: „Dies ist keine echte Login-Seite von roomscout.dev. Es werden keine Zugangsdaten abgefragt oder gespeichert. Die Anmeldung wird lokal simuliert.“ / „Demo-Anmeldung abschließen“ | KEEP-HIDDEN | Settings connection sheet, if a real login is demoed | later |
| `BrowserRunWorkspace` (run bar `Scout run · {sourceName}`, state pill, `Stop run`, takeover banner `Scout needs you` / `You have control`, Live-View iframe or `Live View not connected`, rail `Run plan`, `Take control` / `Return control to Scout` / `Retry safely`) | `src/components/browser/BrowserRunWorkspace.tsx` | Browserbase session UI | none | KEEP-HIDDEN | — | later |
| Run-step and run-title vocabulary (`Open isolated Browserbase Context`, `Register with personal AgentMail address`, `Receive and parse Clerk verification mail`, `Inject code and persist authenticated session`, `Session reserved`, `Human authentication`, `Persist authenticated Browserbase context`; titles `Scout-assisted portal registration`, `Connect portal account`, `Sync portal inbox`, `Review portal source`; `Policy-reviewed portal run`) | `BrowserRunPage.tsx` | Step rail copy | none | KEEP-HIDDEN | — | later |
| Footer `Requested run: {runId ?? "none"}` + `Back to connections` → `/app/profile?tab=connections` | `BrowserRunPage.tsx` | Legacy query-form link | none | KEEP-HIDDEN | — | later |
| 5 error strings — **all quoted verbatim in §4.5** | `BrowserRunPage.tsx` | Error slot | none | KEEP-HIDDEN | — | later |

### 1.16 Operator routes `/ops/*`

The prototype Operator is German with six pages: „Übersicht“, „Quellen“, „Aufträge“, „Integrationen“,
„Feature-Flags“, „Diagnose“. Today's six pages are English and organised around provider internals.

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| `/ops` metric grid — 12 `LedgerCard.metric` tiles (`Published signals`, `Stale signals`, `Detail backlog`, `Detail failures`, `Pending approvals`, `Replies`, `Unhealthy sources`, `Active voice`, `AgentMail inboxes`, `Source platforms`, `New source candidates`, `My portal connections`; only 4 can take the `warning` tone) | `src/routes/ops/OpsOverviewPage.tsx` | `api.ops.overview.metrics` + 3 more queries | **none** — the prototype overview has integration tiles, a task table, „Betriebsregeln“ and a flags card, but no metric grid | DECIDE (keep as an operator-only extra, or drop) | Operator → Übersicht | later |
| `/ops` `Work queues` card + `Counts capped at {boundedSample}` and its 6 `Open` rows | `OpsOverviewPage.tsx` | Cross-links into the other ops pages | partial — prototype „Aufgaben“ table with columns „Vorgang“ / „Quelle“ / „Status“ / „Nächster Schritt“ and row actions „Diagnose“ / „Details“ | REPLACE | Operator → Übersicht → Aufgaben (`OPERATOR_SCREENS.md` §5.8) | later |
| `/ops` `Live activity` card + `Firecrawl · AgentMail · Realtime` event stream | `OpsOverviewPage.tsx` | `ops.overview` events | partial — the prototype's event timeline is rendered **on the Diagnose page** (`OPERATOR_SCREENS.md` §10.2, `hasIncident`), not only in the sheet; the „Ereignisfolge“ heading is the sheet-only part (§12.4) | PORT-INTO | Operator → Diagnose **page** timeline | later |
| `ProviderReadinessPanel` (`Provider readiness` + `Presence and shape checks only`, 6 provider blocks with check pills `Key`, `Crawl HMAC`, `Monitor bearer`, `Webhook URL`, `Monitors`, `Webhook secret`, `Address salt`, `Custom domain`, `Key presence`, `Geocoding token`, `Realtime origins`, `Build-time token`, `Refresh`/`Checking…`, summary + the "configured ≠ accepted" note) | `src/components/ops/ProviderReadinessPanel.tsx` | Real config presence checks | partial — prototype „Integrationen“ shows role + „Bereit“/„Konfiguriert“/„Prüfen“, „Konfiguration:“, „Letzter Demo-Test:“ and a note per provider; no secret-shape checks | REPLACE (copy + shape) | Operator → Integrationen (`OPERATOR_SCREENS.md` §8) | later |
| `/ops/signals` — the whole page (filter chips `All`/`Failed`/`Queued`/`Fetching`/`Processed`/`Not queued`, table `Entry`/`Side`/`Source`/`Detail state`/`Last seen`, the always-mounted review drawer with `Pipeline state`, `Redacted source excerpt`, `Canonical signal`, `Retry entry`) | `src/routes/ops/OpsSignalsPage.tsx` | Normalization pipeline | **none** | KEEP-HIDDEN | — | later |
| Drawer "falls back to the first row" pattern (also in `OpsOutreachPage`, `OpsInboxPage`, `OpsAuditPage`) — a row is pre-selected on first render | `src/routes/ops/*` | Opens a detail panel unasked | none | FLAG | — | later |
| `/ops/sources` `SourceIntelligencePanel` (command bar `Germany source-discovery cursor {n}` + `Run next bounded slice`, `Platform directory`, `Candidate review` + chips `New`/`Reviewing`/`Promoted`/`Ignored`/`Merged`, `Platform transaction map`, `Read-only flow probes`) | `src/components/ops/SourceIntelligencePanel.tsx` | Firecrawl discovery → policy → adapter pipeline | **none** — prototype „Quellen“ is a 4-column table (`Quelle` / `Region` / `Anbindung` / `Letzter Demo-Check`) | KEEP-HIDDEN | — | later |
| `SourceIntelligencePanel` hard-coded `bandnet.hamburg` buttons (`Bind reviewed form`, `Create Bandnet review draft — verify evidence`) | `SourceIntelligencePanel.tsx` | Site-specific one-offs | none | FLAG | — | later |
| `/ops/sources` `PortalOperationsPanel` (`Browserbase portal operations` + boundary note, connection rows, facts `Status`/`Policy`/`Read-only recon`/`Inbox polling`/`Next poll`/`Circuit breaker`, actions `Run recon`/`Start human login`/`Sync inbox`/`Pause`/`Delete context & disable`, `Recent browser runs` table, Live-View link) | `src/components/ops/PortalOperationsPanel.tsx` | Operator-owned portal ops | **none** | KEEP-HIDDEN | — | later |
| `/ops/sources` `Legacy monitor registry` card (`Firecrawl Native Monitoring`, buttons `Seed review sources`, `Sync monitors`, `Continue bounded backlog`, `Approve automation review`, `Pause source`, `Activate reviewed source`, `Run once`; the label→message mismatch table) | `src/routes/ops/OpsSourcesPage.tsx` | Explicitly labelled legacy | none | KEEP-HIDDEN | — | later |
| `/ops/outreach` — the whole page (chips `All`…`Rejected`, queue rows, `Approval invariant` card with `Content fingerprint`, and the closing note `The exact recipient, subject, body, content version, and hash are rechecked by the backend before an approved send. Message bodies stay out of this aggregate Ops query.`) | `src/routes/ops/OpsOutreachPage.tsx` | Approval ledger, read-only | partial — prototype „Aufträge“ shows the same *idea* (a task list with statuses and a next step) with far less detail | KEEP-HIDDEN | Operator → Aufträge | later |
| `/ops/inbox` — the whole page (AgentMail branch + Platform branch, `Portal privacy boundary` card, `Sync now`, `Read-only transcript`) | `src/routes/ops/OpsInboxPage.tsx` | Routing/delivery state | **none** | KEEP-HIDDEN | — | later |
| `/ops/audit` `Browserbase run ledger` card (connection chips + run stream, `{kind} — {n} normalized items` / `No result payload stored`) | `src/routes/ops/OpsAuditPage.tsx` | Portal run history | **none** | KEEP-HIDDEN | — | later |
| `/ops/audit` `Approval and provider events` stream | `OpsAuditPage.tsx` | Audit ledger | partial — the prototype's human-readable German entries render **on the Diagnose page** (`OPERATOR_SCREENS.md` §10.2) and are repeated in the sheet under the heading „Ereignisfolge“ (§12.4). The six fixed entries (all `incident`-gated, timestamps are illustrative literals): `09:41` „Portal-Benachrichtigung über neue Nachricht erhalten“ · `09:41` „Öffnen der Portal-Nachricht fehlgeschlagen: Anmeldung abgelaufen“ · `09:42` „Aufgabe „Portal-Nachrichten lesen“ als „Anmeldung abgelaufen“ markiert“ · `09:42` „Aufgabe „Anfrage vorbereiten“ wartet auf Zugang“ · `09:42` „Hinweis in den Zugängen der Band angezeigt“ · `Jetzt` (only when resolved) „Anmeldung erneuert (Simulation) · wartende Aufgabe einmalig fortgesetzt“ | PORT-INTO | Operator → Diagnose **page** timeline | later |
| `opsFormat.ts` helpers (`formatAge` via `Intl.RelativeTimeFormat("en")`, `formatDuration`, `titleCase`) | `src/routes/ops/opsFormat.ts` | English-only formatting | none | FLAG (locale-bound) | — | later |

### 1.17 Shared primitives, adapters and dead code

| Element | Where it lives today (file) | What it does / data it shows | Prototype counterpart | Default decision | Suggested future home | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| `LedgerCard` / `PageHeader` / `EmptyState` (`.lcard` border + `lcard-top`/`lcard-foot` strips; the three `rs-ledger-card__*` classes have no CSS; `EmptyState` is entirely unstyled) | `src/components/ui/LedgerCard.tsx` | The visual language of every non-Scout surface | **none** — the prototype uses flat sections with hairline dividers; only Operator has card-ish tiles | DECIDE (this is the single biggest visual decision outside Scout) | replaced by prototype sections + shadcn `Card` only where the Operator uses tiles | must |
| `SelectField` (Radix Select, `.rs-select-trigger` 190 px, portalled content, `rs-select-in` 140 ms) | `src/components/ui/SelectField.tsx` | Used only by `/explore` and `/map` | **none** — the prototype's only `<select>` is in the demo bar (not to be built); Settings uses toggles, radios and a segmented control | KEEP-AS-IS (legacy routes only) | — | later |
| `table.tsx` (the only Tailwind-utility file) + `cn()` + the unused `TableCaption` export | `src/components/ui/table.tsx`, `src/lib/utils.ts` | Tables on `/signals/:id` and all ops pages; callers add legacy classes so Tailwind and globals fight | partial — the prototype has tables only in Operator (`Aufgaben`, `Quellen`) | DECIDE (adopt shadcn `Table` properly, or drop) | Operator tables | later |
| `ActionDialog` (`.overlay` + `.modal`, `rs-dialog-overlay` unstyled) | `src/components/ui/ActionDialog.tsx` | Every confirm/approve dialog | partial — the prototype uses a scrim + panel with its own geometry (`SETTINGS_SCREENS.md` §12/§13, `OPERATOR_SCREENS.md` §11) | PORT-INTO | shadcn `Dialog` / `Sheet` with prototype geometry | must |
| `ActionLifecyclePanel` (the 10 status pills `Draft`, `Approval needed`, `Approved`, `Rejected`, `Queued`, `Executing`, `Executed`, `Failed`, `Cancelled`, `Expired`; the two provider-state overrides `Outcome unknown` / `Provider running`; `Review exact action`, `Execute approved action` / `Resume provider` / `Starting…`, `This approved action has no supported provider executor.`, `The provider paused at a human-only step. Open the ephemeral Live View, then explicitly tell RoomScout whether you submitted.`, `Open ephemeral Live View`, `I submitted it`, `Cancel action`, `Loading action ledger…`, `No persisted external actions yet.`) | `src/components/actions/ActionLifecyclePanel.tsx` | External-action ledger | **none** | KEEP-HIDDEN (only reachable from `/app/inbox`) | — | later |
| `MailboxVerificationPanel` (`{n} message(s)`, `{n} unread`, `Archive`, `Verification links are opened only by you. RoomScout never follows them automatically.`, first 6 non-archived messages) | `src/components/actions/MailboxVerificationPanel.tsx` | Verification mail list | **none** | KEEP-HIDDEN | — | later |
| `OpportunityHandoff` (`Opportunity ready for handoff`, `Prepare handoff`, `Copy brief` → `Copied`, `Mark handed off`, the `<pre>` brief, warning `RoomScout has not accepted, signed, booked, or paid for anything. Review the counterparty and all unresolved terms yourself.`) | `src/components/opportunities/OpportunityHandoff.tsx` | Human handoff brief | **none** | KEEP-HIDDEN | — | later |
| `SignalCard` + `SignalBadge` (+ their unreachable action row and `compact` variant) | `src/components/signals/SignalCard.tsx`, `SignalBadge.tsx` | Public index cards | none | KEEP-HIDDEN | — | later |
| `CoverageTrustNotice` | `src/components/coverage/CoverageTrustNotice.tsx` | Renders on `/explore`, `/map`, `/app/search?tab=sources` and `/app/settings/sources` (it is `SearchSourcesPanel`'s first child) | **none** | DECIDE | Settings → Quellen footnote | nice |
| `ProviderOfferPanel` English copy (`Scout assessment`, `Revision {n} · `, `Availability`, `Monthly total`, `Still to resolve`, the 7-step reply label ladder — **quoted verbatim in §4.7** — `Evidence behind this assessment`, `An assessment is not a booking or acceptance. Any final commitment needs your exact approval.`) | `src/components/opportunities/ProviderOfferPanel.tsx` | Offer assessment | partial — prototype offer stage („Angebot eingegangen“, „Euer {roomName}“, „inklusive Nebenkosten“, „Angebot prüfen“, „Vor einer Zusage schauen wir uns alle Konditionen an.“) | REPLACE (copy) | Scout `offer` stage | must |
| `OfferAcceptanceDialog` / `OfferAcceptanceFlow` English copy (`Review offer acceptance`, `Offer being accepted`, `Sending as`, `Destination`, `Exact message`, the 10 state strings — **quoted verbatim in §4.8** — the boundary line `Controlled roomscout.dev platform message only. This does not sign an agreement, book a room, or make a payment.` and the acknowledgement `I reviewed these exact terms, sender, destination, subject, and message. RoomScout may send this acceptance once.`) | `src/components/opportunities/OfferAcceptanceDialog.tsx` | Exact-once acceptance | partial — prototype review stage („Passt das für euch?“, „Vollständige Bedingungen anzeigen“, „Angebot annehmen“, „Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet.“) | REPLACE (copy; keep the exact-payload machinery) | Scout `offer_review` stage | must |
| `MandatePanel` English copy (`Scout Autopilot`, `On`/`Off`, `RoomScout is working for you`, `Advanced controls`, the 19 `actionLabels` and the 8 data-scope labels — **both enumerated verbatim in §4.9** — `Emergency stop`, and the footer note `Saving creates a new immutable mandate version. Existing provider gates re-check that version immediately before execution.`, replaced by `Autopilot persistence is unavailable. Manual review remains enforced.` when no `onSave` prop is passed) | `src/components/mandate/MandatePanel.tsx` | Autopilot config dialog | partial — prototype „Handlungsspielraum“ is a *page*, not a dialog, with 2 mode cards, 3 action toggles, 2 share toggles, one stepper, „Weitere Grenzen“, the lock card and a dirty save bar **guarded by a discard-changes `alertdialog`** (see Table 2) | REPLACE (structure + copy) | Settings → Handlungsspielraum (`SETTINGS_SCREENS.md` §5) | must |
| `ActionApprovalSheet` `kindLabels` diverging from `MandatePanel.actionLabels` (`Create portal account` vs `Create a portal account`, `Publish listing` vs `Publish a search listing`, `Propose visit time` vs `Propose a visit time` / key `propose_visit`) | `src/components/actions/ActionApprovalSheet.tsx`, `MandatePanel.tsx` | Two label maps for one vocabulary | none | DECIDE (unify before i18n extraction) | one shared action vocabulary | must |
| `src/mocks/demoData.ts` (344 lines; only its **types** are imported) | `src/mocks/demoData.ts` | Dead mock payload | none | FLAG (move `MarketSignal`/`SavedSearch`/`SearchField`/`SignalSide` to a real module) | — | later |
| Unused `ConnectionsPanel.tsx` (no importer) | `src/components/connections/ConnectionsPanel.tsx` | Dead file, superseded by `PortalConnectionsWorkspace` | none | FLAG | — | later |
| Dead CSS: `.demo-trigger`, `.rs-brand-mark`, `MarketGlobe.module.css .marker/.markerSelected`, `ScoutPage.module.css` `.factsStage` / `.fact` / `.voiceOverlay` / `.voiceClose` | `src/styles/app.css`, `src/components/map/MarketGlobe.module.css`, `src/routes/musician/ScoutPage.module.css` | No consumers | none | FLAG | — | later |
| Unstyled class names in use (`rs-empty-state`, `rs-form-error`, `rs-signal-grid`, `rs-event-stream`, `rs-metrics-grid`, `rs-signal-detail`, `rs-signal-detail__columns`, `rs-search-page__layout`, `rs-page-header__meta`, `rs-freshness`, `badges`, `checks`, `frow`, `visible`, `rs-dialog-overlay`, `rs-ledger-card__*`, `rs-explore`, `rs-outreach-layout`, `rs-ops-inbox-layout` — the full list from `APP_UI_INVENTORY.md` §3.6) | `src/styles/*`, various components | Render with browser defaults (notably every `EmptyState` and every `p.rs-form-error` alert) | none | FLAG (fix or drop during the rebuild) | — | must |
| Undefined token `--gray-100` consumed by 3 rules; `.rs-wordmark` declared twice; two dead font declarations; `--signal` `#ff6b2c` vs `#ff6926` with `--signal-soft`/`--signal-border` still derived from the old value; `src/assets/room-background.jpg` bundled but never visible | `src/styles/app.css`, `design-system.css`, `landing.css`, module CSS | Token drift | prototype token set is documented in `TOKENS.md` / `tokens.proposed.css` | FLAG | one token layer | must |
| Unreachable controls: `SignalCard` action row + `compact`; `SearchProfileCard` pencil `Edit {label}`, inert draft `Confirm search`, and the per-field `Scout` chip; `ActionApprovalSheet`'s whole `standing_mandate` branch (`Handled by Autopilot`, `Covered by Autopilot`, `Outside the current Autopilot boundary`, `Close`, `Pause mandate`, `Pausing…`, `Autopilot v{n}`); `SearchSourcesPanel` status `Connection required` + `Connect`; `SearchSourcesPanel`'s non-zero `{n} relevant signals` | see `APP_UI_INVENTORY.md` §9 table | Rendered code paths no caller can reach | mostly none | DECIDE per item (wire up, port, or drop) | — | nice |

---

## 2. Table 2 — prototype elements the app cannot back yet

Direction: prototype → app. "Backend today" cites `DATA_MAP.md`. Nothing here is invented; where the
prototype shows data the backend has no field for, that is stated as a missing field, not as a feature.

| Prototype element (verbatim) | Prototype source | What it shows | Backend today | Gap | Suggested resolution | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Autopilot activity list — „Suchauftrag gestartet“, „Raum in Stuttgart-West gefunden“, „Anbieter über das Portal kontaktiert“, „Warte auf Antwort“, „Angebot eingegangen“, „Suchauftrag angepasst: {label}“ | `SCOUT_SCREENS.md` §8.7, §18.11 | A per-search, human-readable event feed | The `notifications` table exists and is written on 8 paths, but **has no query**; other sources are `api.memory.listMine().events`, `matches[].updatedAt`, `externalActions.listMine[].status`, `providerConversations[].state` (`DATA_MAP.md` §7.1) | No single activity query | Add `api.notifications.listMine({limit})` + a read mutation, or a combined `api.activity.listMine({savedNeedId, limit})` | must |
| Toasts „Dein Scout wartet auf deine Freigabe“, „Dein Scout hat eine Rückfrage“, „Dein Scout braucht eine Entscheidung“, „Dein Scout hat Räume zum Vergleichen“, „Ein Angebot ist eingegangen“. **Structure** (`role="status"`, positioned `right:24px;top:96px` **inside the stage frame**, `z-index:14`): orange dot + message (`font-size:14.5px`) + primary button **„Zum Scout“** (handler `toastGo` → `backToScout()`) + close button `aria-label="Schließen"` (handler `dismissToast`) | `SCOUT_SCREENS.md` §2.7, §18.2 | Fire when an event happens while the user is *not* on the Scout view (`notify()` no-ops when `view === 'scout'`) | Same gap as above — the events are persisted, the read query is missing | No notification read path | Same query as above; drive the toast from unread rows. **No auto-dismiss**: `notify(text)` only sets `state.toast`, there is no timer; it survives until `dismissToast`, `toastGo` or any `backToScout()`. If Sonner is used it must be configured with `duration: Infinity` plus a manual dismiss, and the two actions must both be present | must |
| Autopilot **`waitingFor` blocker path** — the source blocker (§8.4): status „Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen.“ + button „Quelle auswählen“ (→ `openSettings('sources')`); the access blocker (§8.5): status „Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.“ plus the inline row (amber dot `#e0a13a`) „Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.“ + link „Zu den Zugängen“ (which opens the page titled **„Quellen & Zugänge“** — there is no page called „Zugänge“) | `SCOUT_SCREENS.md` §8.4, §8.5; `OPERATOR_SCREENS.md` §12.3, §17.12 | The Scout half of the cross-surface reauth loop: Operator incident → Scout banner → Settings → autopilot resumes | **Partially backed.** `portalConnections` already has `reauth_required` + `lastErrorCode` (`DATA_MAP.md`), and `searchSources.setPreference` backs the source case; what is missing is the Scout-side surfacing and the resume trigger | No Scout-facing blocker state; no automatic resume on fix | Port the full loop: on Settings → „Quellen & Zugänge“ the source status reads „Anmeldung erneut nötig“ (dot `#e0a13a`) with the action „Anmeldung öffnen“; completing it (the prototype's „Demo-Anmeldung abschließen“ → the app's real Live-View flow) shows „Zugang gespeichert. Dein Scout kann weitermachen.“ and resumes the autopilot **exactly once** (`attemptContact()` returns early once `ACT.contacted` is in the activity log, so it cannot double-send). Both `toggleSource` and `setAccess` re-enter `attemptContact()` from their `setState` callback, so fixing the blocker in Settings must not require returning to the Scout view | must |
| Typed clarification answers „Ja, Mittwoch passt“ / „Nein, Donnerstag ist wichtig“ (and the fact rewrite `zeit` → „Mittwoch oder Donnerstag ab 19 Uhr“) | `SCOUT_SCREENS.md` §9, `SCOUT_STATE.md` §8.1 | Two typed buttons that answer a provider question and update one fact | `opportunity.uncertainties[]` is a `string[]`; the answer today is free text via `scout.sendMessage` and uncertainties are cleared by backend re-assessment (`DATA_MAP.md` §7.2) | No typed answer channel | Either a typed `opportunities.answerUncertainty` mutation, or send the button label as the message text and accept the round-trip | must |
| `dead_end` stage — „Da komme ich gerade nicht weiter.“ + the three compromise options „Budget bis 400 €“, „Umland einbeziehen“, „Mittwoch doch erlauben“ + „Nichts ändern, weiter suchen lassen“ | `SCOUT_SCREENS.md` §13, `SCOUT_STATE.md` §8.2 | Exhausted-search branch | Nothing marks a search as exhausted; the three options each map to a `savedNeeds.update` (budget / districts+radius / schedule) which already re-triggers matching (`DATA_MAP.md` §7.3) | No exhaustion signal | Derive from mandate age + zero matches + dismissed/expired opportunities, or persist an explicit flag | nice |
| Candidate cards — subline „Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage.“, photo (`assets/proberaum.png`), „Foto folgt vom Anbieter“, „ca. 28 m² · geteilt mit einer Band“, „12 Min. mit der Stadtbahn“, badge „Mein Vorschlag“, per-card budget label „Im Budget“ / „Über eurem Budget ({budget} €)“ | `SCOUT_SCREENS.md` §14, §18.17; `SCOUT_STATE.md` §8.3 | Three comparable rooms with size, commute, co-tenants and a ranked recommendation | Only `signal.summary`, `requirements[]`, `unknowns[]`, `priceEur`, `pricePeriod`, `match.reasons`, `match.uncertainties` exist (`DATA_MAP.md` §7.4). The two budget labels **can** be backed (`priceEur` vs the need's budget), and so can the subline | No photo, size, travel-time or co-tenant fields; no ranking field | Render from `summary`/`requirements`, drop the missing rows, keep the subline and both budget labels. **„Mein Vorschlag“ is not a max-score badge in the prototype** — the rule is `best = candidates.filter(fits && storageOk && inArea).sort(by priceNum asc)[0]`, i.e. the **cheapest** candidate that is within budget, keeps the drum kit, and lies inside the search area (`inArea = c.id !== 'esslingen' \|\| /Umland/.test(ortLabel)` — Esslingen only counts when the Ort label matches `/Umland/`). Port that rule, or state the substitution explicitly. Note `fits` depends on **price only**, so all three cards read „Im Budget“ in every scripted flow; the amber „Über eurem Budget (350 €)“ (`#e0a13a`) only appears after the budget fact is edited below a candidate price | must |
| Offer card photo + „Foto folgt vom Anbieter“ placeholder | `SCOUT_SCREENS.md` §10.2 | Room image or striped placeholder | No image field on signals/offers documented | No image storage/field | Ship the placeholder only, or add a signal image field | nice |
| „Vollständige Bedingungen anzeigen“ → the full-terms paragraph | `SCOUT_SCREENS.md` §11, `review.terms.full` | One long prose block with all conditions | `offer.assessment.terms` rows + `monthlyPrice` + `availability` + `blockers` are documented; a single full-text terms field is not | No full-text terms field | Compose the block from the structured terms rows. The prototype's footnote is **„Demo-Bedingungen. Im echten Produkt wäre hier das vollständige Angebot des Anbieters einsehbar.“** (key `review.terms.demoNote`) — in the app the second half is no longer true, so replace it rather than shipping it verbatim | nice |
| Q&A chip „Noch eine Frage klären“ → prepared question „Was passiert nach der Zusage?“ + scripted answer | `SCOUT_SCREENS.md` §11.1 | A canned question/answer pair inside the review stage | Free text through `scout.sendMessage` works; there is no prepared-question object | No canned-question backing | Send the chip label as a normal Scout message; do not fake the answer | nice |
| `complete` stage — h1 „Euer nächster Proberaum steht bereit.“, subline „Demo abgeschlossen — es wurde keine echte Zusage versendet.“ (em dash), summary pill `completeSummary = offer.short + " · " + offer.price + " · " + offer.timeLower` → „Stuttgart-West · 280 € / Monat · mittwochs 19–22 Uhr“ (alternatives „Esslingen · 320 € / Monat · donnerstags 19–23 Uhr“ and „Stuttgart-Ost · 350 € / Monat · donnerstags ab 20 Uhr“), restart link „Demo erneut ansehen“ | `SCOUT_SCREENS.md` §12; `SCOUT_STATE.md` §17 (`restart()`) | Terminal success screen | Reachable, **but** `externalActions.finishExecution` pauses the need and stops the mandate on acceptance, and every offer becomes non-current (`DATA_MAP.md` §4, `complete` row). The summary pill is fully backed (`offer.short`/`price`/`timeLower` ⇄ signal district + `priceEur`/`pricePeriod` + availability) | Stage precedence bug if `paused` is tested first; the subline and the restart link are **demo-only copy** | Test acceptance **before** `paused` in `useScoutStage()`; do not depend on `offer.current`. Keep the summary pill. **Honest-copy decision:** the subline „Demo abgeschlossen — es wurde keine echte Zusage versendet.“ is false in the real app (an acceptance *is* sent) — replace it with a true statement of what was sent, do not ship it verbatim. „Demo erneut ansehen“ (`restart()`) is the one demo-control handler `SCOUT_STATE.md` §17 marks as genuine product UI („keep it only there“); in the app it has no meaning — drop it or replace it with a link back to the search | must |
| Settings → „Anzeigename“ form + „Speichern“ + „Name gespeichert. Ansprache und Initialen sind aktualisiert.“ | `SETTINGS_SCREENS.md` §8.2, §17.8 | Editable display name feeding greeting + initials | `users` has `displayName?`, but **nothing in the app ever writes it** and no user-facing mutation is documented (`DATA_MAP.md` §1.9, §5) | No write path | Add a `users.setDisplayName` mutation, or ship the field read-only | must |
| Settings → „Demo-Login“ row („Lokale Beispielidentität „herzbuben“ · keine echte Anmeldung“, badge „Designprototyp“) | `SETTINGS_SCREENS.md` §8.3 | Prototype identity disclosure | The app has real Convex Auth v2 username/password | Prototype-only; would be a false claim in the app | Replace with the real account row (username + role) | must |
| Settings → „Passende Quellen automatisch auswählen“ toggle + „Deine Ausschlüsse bleiben erhalten.“ | `SETTINGS_SCREENS.md` §4.3 | Auto-select suitable sources, keeping manual exclusions | `api.searchSources.setPreference` is per-source include/exclude only; no auto-select flag documented | No auto-select flag | Add a per-need flag, or ship the row disabled with an honest note | nice |
| Settings → „Weitere Quellen ansehen“ panel: search field „Quelle oder Region suchen …“, states „Verfügbar“ / „Anmeldung nötig“ / „Noch nicht verfügbar“, actions „Einbeziehen“ / „Ausschließen“ / „Nicht verfügbar“, footnote „Demo-Quellen. Keine vollständige Liste aller Portale.“ | `SETTINGS_SCREENS.md` §4.9 | A browsable source directory for musicians | `api.searchSources.listForNeed` (per-need coverage) and `api.portalConnections.listConnectableSources {limit:50}` (portals only) exist; there is no searchable source directory query for musicians | No directory/search query | Reuse `listConnectableSources` + reviewed sources, or ship the panel without search | nice |
| Settings → **discard-changes dialog** (`role="alertdialog" aria-modal="true"`): „Änderungen verwerfen?“ / „Dein Handlungsspielraum hat ungespeicherte Änderungen.“ / „Weiter bearbeiten“ (autofocused, = cancel) / „Verwerfen“ (drops the draft, then performs the queued navigation). Scrim is deliberately **non-dismissing** (no click handler); Escape behaves like „Weiter bearbeiten“ | `SETTINGS_SCREENS.md` §6 | Guards every navigation away from a dirty „Handlungsspielraum“: sidebar items, „Zurück zum Scout“, „Zum Scout“, „Suchauftrag bearbeiten“, „Gespeicherte Informationen verwalten“, the privacy cross-links, and the host's `backReq` | The app's `MandatePanel` dialog has a plain `Cancel` button and **no unsaved-changes guard** at all — closing it silently discards the draft | No dirty-state guard | Build it as a shadcn `AlertDialog` (keep its focus trap and focus restore, which the prototype lacks; keep the overlay **non-dismissing** to match). Route every settings navigation through one `tryNav()`-style helper so the guard cannot be bypassed | must |
| Settings → knowledge tabs „Eure Band“ / „Alltag & Wege“ / „Ausstattung“ (with `FACT_CAT` mapping) | `SETTINGS_SCREENS.md` §7.3, `SCOUT_STATE.md` §3.10 | Life-area grouping of remembered facts | Facts carry `subject`, `subjectKind`, `predicate`, `category`, `verification`, `source`, `confidence`; the app groups by **subject**, not by life area | No life-area category mapping | Map existing `category` values onto the three tabs, or add a category field | must |
| Settings → knowledge row actions „Stimmt“ / „Nicht wichtig“ + badge „Noch zu bestätigen“ | `SETTINGS_SCREENS.md` §7.5 | Confirm or dismiss an assumed fact | `api.memory.deleteFact` exists; no confirm/dismiss mutation is documented | No confirm/dismiss path | Add mutations, or map „Stimmt“/„Nicht wichtig“ onto verification state | nice |
| Settings → undo bar „„{text}“ wird nicht mehr verwendet.“ / „Rückgängig“ | `SETTINGS_SCREENS.md` §7.6 | Undo a retirement | `deleteFact` is behind a confirm dialog and is not reversible in the UI | No undo | Soft-retire instead of delete, or keep the confirm dialog and drop the undo | nice |
| Settings → „Benachrichtigungen“: 3 toggles with sub-lines — „Wenn deine Entscheidung nötig ist“ / „Rückfragen, Freigaben und Angebote, die du prüfen sollst“ (default on) · „Wenn ein Angebot eingeht“ / „Konkrete Angebote mit Konditionen“ (default on) · „Allgemeine Fortschritte als Zusammenfassung“ / „Gelegentlicher Überblick über Suche und Anfragen“ (default off). Each toggle fires the toast „Gespeichert“ (**2400 ms**); the switch `aria-label` is the row label. Then label „Kanal“ + `role="radiogroup" aria-label="Kanal"` with „In der App“ / „Scout-Adresse (simuliert)“ — the radios fire **no** toast. Footnote: „Präferenzen werden lokal gespeichert. Es wird keine Browser-Berechtigung angefragt und keine echte E-Mail versendet. Notwendige Entscheidungen bleiben in der App sichtbar, auch wenn Benachrichtigungen aus sind.“ | `SETTINGS_SCREENS.md` §9.2–§9.4 | Notification preferences and a delivery channel | **No preference storage and no delivery channel other than in-app**; the current copy says so explicitly and `ProfilePage.test.tsx` pins that honesty (`DATA_MAP.md` §7.8) | No preferences, no email/push delivery | Ship the toggles disabled with an honest note, or omit the section; never claim mail delivery. **The prototype's own footnote is the honest text** — it already says no browser permission is requested and no real e-mail is sent; adopt it (minus „lokal gespeichert“ if preferences become server-side) instead of writing a new disclaimer. Drop the „Scout-Adresse (simuliert)“ channel option unless a real delivery path exists | must |
| Settings → „Tarif & Nutzung“ — **complete contents** (nothing else is on the page): h1 „Tarif & Nutzung“ + lead „Dein Zugang, deine Aktivität und deine Abrechnung.“; section „Dein Zugang“ → row „Demo-Zugang“ / „Kein kostenpflichtiges Abonnement aktiv.“ + button „Tarife ansehen“ → disclosure panel „Tarife sind noch nicht festgelegt.“ / „In diesem Prototyp kannst du RoomScout ausprobieren. Es wird nichts berechnet.“; section „Aktivität im September“ (**hard-coded month — no date binding in the prototype**) → 3 stats: `usageSearches` with label „Aktive Suchen“, or **„Aktive Suche“ when the value is exactly 1**; `usageContacted` / „Anbieter kontaktiert“; `usageTalk` / „Gespräche mit Scout“ (demo value „Noch nicht erfasst“); footnote „Aktivitätsübersicht, keine Abrechnungseinheiten.“; two payment rows „Zahlungsdaten“ / „Keine Zahlungsmethode hinterlegt“ + „Verwalten“ and „Rechnungsadresse“ / „Noch nicht hinterlegt“ + „Hinzufügen“, both opening the panel „Zahlungsverwaltung ist noch nicht eingerichtet.“ / „Hier würdest du später deine Zahlungs- und Rechnungsdaten verwalten.“; section „Rechnungen“ → empty row „Noch keine Rechnungen“ / „Hier findest du später deine Belege.“; footer note „Produktkonzept · Noch keine Zahlungsintegration“ | `SETTINGS_SCREENS.md` §10.1–§10.5 | A plan page with monthly usage counters and invoices | No billing system, no purchasable plan, no metering ledger; the usage counters would need the same activity query as the activity list | Entire page unbacked | Keep today's honest `Billing is not available` message, restyled; **or** keep only these three elements, which a real query can serve or which are already true: the „Aktivität im September“ stat grid (with a real month, from `savedNeeds` + the activity query — including the singular label variant), its footnote „Aktivitätsübersicht, keine Abrechnungseinheiten.“, and the footer note „Produktkonzept · Noch keine Zahlungsintegration“. Drop „Demo-Zugang“, „Tarife ansehen“ and both payment rows unless billing exists | must |
| Settings → „Datenschutz“ → „Export“ / „Demo-Daten exportieren“ (`exportData()` → `{name, facts, knowledge, sources, rules, notif, hinweis}`) | `SETTINGS_SCREENS.md` §11.2, `SCOUT_STATE.md` §12.2 | Local JSON download of the demo data | No export endpoint documented | No export path | Either build a real export over `memory` + `savedNeeds` + `mandates`, or omit the row | nice |
| Settings → „Datenschutz“ → „Konto löschen“ | `SETTINGS_SCREENS.md` §11.2 | Account deletion (prototype says it is not implemented) | No deletion path documented | Unbacked | Ship the prototype's own honest paragraph, or omit | later |
| Settings → „Datenschutz“ → „Gesprächsverlauf“ / „Mitschrift eurer Gespräche mit dem Scout, in der App einsehbar“ | `SETTINGS_SCREENS.md` §11.2 | Points at the transcript | Backed — `scout.listMessages` + the voice transcript drawer | (no gap; listed for completeness of the section) | Link to the Scout transcript („Mitschrift“) | nice |
| Settings → „Verbindung zu roomscout.dev“ sheet → „Demo-Anmeldesimulation“ / „Demo-Anmeldung abschließen“ | `SETTINGS_SCREENS.md` §12.4 | A locally simulated portal login | The app has a **real** Browserbase Live-View flow (`/app/runs/:runId`, `PortalAuthenticationGuide`) | Inverse gap: the app's flow is bigger than the prototype's | Wire the sheet's „Anmeldung öffnen“ to the real flow; never present a simulated login as real | must |
| Operator → Übersicht **attention banner** (conditional `attention` = `incident && !incidentResolved`): `!` badge + „1 Aufgabe braucht Aufmerksamkeit“ + link button „Ansehen“ (handler `viewAttention` → `filter:'attention'` + `setPage('tasks')`) | `OPERATOR_SCREENS.md` §5.2 | The overview's only alert row | Nothing produces this count; the prototype's own **count is hard-coded, not derived from the task list** | No attention count | Derive the count from the real queue (`ops.overview` + `portalConnections` with `reauth_required`) and make it a real number, or omit the banner. Never ship the literal „1“ | later |
| Operator → Übersicht **calm banner** „Keine Aufgabe braucht Aufmerksamkeit. Beispielstörung über die Demo-Steuerung laden.“ and Diagnose **no-incident card** „Keine offenen Störungen. Über die Demo-Steuerung lässt sich eine Beispielstörung laden.“ | `OPERATOR_SCREENS.md` §5.3, §10.1 | The two calm/empty states of the Operator surface | Backed as *states* (no open incident), but both strings **point at the demo control bar**, which §3 item 3 forbids building | Copy references a surface that will not exist | Keep the states, rewrite the second sentence of each: e.g. „Keine Aufgabe braucht Aufmerksamkeit.“ and „Keine offenen Störungen.“ alone, or with a real next step. Shipping either string verbatim would reference a control the app does not have | must |
| Operator → „Feature-Flags“ page: „Voice Scout“, „Öffentliche Quellensuche“, effect previews, „Lokal speichern“, „Flags lokal gespeichert.“ | `OPERATOR_SCREENS.md` §9, §13 | Two toggles with pre-save effect lines and real in-prototype effects | No feature-flag storage or read path documented in the ops API | Entire page unbacked | Add a small ops-only flag table, or omit the page in pass 1 | later |
| Operator → „Diagnose“ + Diagnose sheet: „Beispielstörung laden“, „Vorgang“ / „Portal“ / „Zustand“, „Ursache“ / „Auswirkung“ / „Nächster Schritt“, „Ereignisfolge“, „Anmeldung als erneuert simulieren“, „Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt.“ | `OPERATOR_SCREENS.md` §10–§12 | A full incident object with cause/impact/next-step, an event timeline and a resolve action | Partially: `/ops/audit` has an event stream and `portalConnections` has `reauth_required` + `lastErrorCode`; there is no incident entity, no cause/impact/next-step text and no resolve action | No incident model | Derive a read-only incident view from a `reauth_required` connection + its audit events; drop the simulation button | nice |
| Operator → „Aufträge“ task table (`Vorgang` / `Quelle` / `Status` / `Nächster Schritt`, statuses „Abgeschlossen“, „Anmeldung abgelaufen“, „Wartet auf Zugang“, „Geplant“, „Fortgesetzt (einmalig)“, filter „Braucht Aufmerksamkeit“) | `OPERATOR_SCREENS.md` §7, §17.4 | One row per running job with a next step | The pieces exist across `ops.overview`, `outreach`, `externalActions` and the signal queue; there is no unified per-order task query, and no „Nächster Schritt“ text | No unified task query | Compose client-side from the existing ops queries, or add one ops query | later |
| Operator → „Integrationen“ per-provider „Letzter Demo-Test:“ („Erfolgreich (Demo)“ / „Noch kein Demo-Test“) | `OPERATOR_SCREENS.md` §8 | A last-test timestamp/result per provider | `ProviderReadinessPanel` performs **presence and shape checks only** and states so explicitly | No stored test result | Show the presence check honestly, or persist real probe results | later |
| Operator → „Betriebsregeln“ — two label/value rows in a `justify-content:space-between` row, **with no colon in either string**: „Parallele Browser-Sessions“ / „2“ (keys `overview.rules.sessions.label` / `.value`) and „Erneute Versuche“ / „Mit zunehmendem Abstand“ (`overview.rules.retries.label` / `.value`) | `OPERATOR_SCREENS.md` §5.9 Row 1 / Row 2, §17.3 | Two operating-rule rows — the prototype itself labels them „Illustrative Betriebsregeln, keine echten Worker-Pools.“ | No worker-pool figures are exposed | Unbacked by design | Keep the prototype's own disclaimer, or omit. Keep label and value as **separate** i18n keys — do not concatenate them with a colon | later |
| Operator → „Quellen“ column „Region“ and „Letzter Demo-Check“ | `OPERATOR_SCREENS.md` §6, §17.5 | Region per source + last check time | Sources carry health + last check; a region field is not documented | Missing region field | Derive from the source scope, or drop the column | later |
| Operator → header badges „INTERN“ / „Entwicklung“ | `OPERATOR_SCREENS.md` §17.1 | Environment disclosure | No env exposure documented in the ops API | Missing env value | Derive from the deployment at build time | later |
| Operator assets `logo-convex.svg`, `logo-firecrawl.svg`, `logo-agentmail.png`, `logo-browserbase.png`, `logo-openai.svg`, `logo-roomscout.png` | `OPERATOR_SCREENS.md` §18 | Provider logos in tiles (28×28), rows (24×24) and the OpenAI row (22×22) | Not present in the app's asset pipeline | Missing assets | Copy from the prototype's `assets/` into `public/design/` | nice |
| Landing v2 footer link `GitHub` + closing secondary CTA „Projekt ansehen ↗“ — both `<a href="https://github.com/Finchmedia/roomscout" target="_blank" rel="noopener">`; closing CTA `font-size:16px;color:#f5ece2;text-decoration:none`, footer link `color:#e2d3c3;text-decoration:none`; neither has a hover state in the source | `LANDING_SCREENS.md` §12, §17.11, §18 | External project link | **No gap** — the href, the target and the rel are all specified by the prototype; the app simply points its two closing/footer links at `/explore` and `/map` instead | none (listed because both current-app links must be repointed) | Use `https://github.com/Finchmedia/roomscout` verbatim with `target="_blank" rel="noopener"` on both the closing secondary CTA and the footer link | must |

---

## 3. Cross-cutting items that are not single elements

These do not fit either table but block both directions.

1. **No i18n layer exists.** Every string is a hard-coded JSX literal or a module constant (`statusCopy`,
   `STATUS_COPY`, `statusLabels`, `actionLabels`, `kindLabels`, `channelLabels`, `copy`, `descriptions`,
   `filterChips`, `sortOptions`, `starters`, `faqs`, `storyLines`, `statuses`). A DE/EN toggle requires
   extracting all of them; the prototype docs already ship stable key sets
   (`SCOUT_SCREENS.md` §18, `SETTINGS_SCREENS.md` §17, `OPERATOR_SCREENS.md` §17, `LANDING_SCREENS.md` §17).
   Priority: **must**.
2. **Three competing stylesheets** (`app.css` 754 lines, `design-system.css` 297, `landing.css` 1158) with
   the documented conflicts in `APP_UI_INVENTORY.md` §3, against one prototype token set
   (`TOKENS.md`, `tokens.proposed.css`). Priority: **must**.
3. **The prototype's demo control bar** (`SCOUT_SCREENS.md` §2.10, §18.18) and the whole `demo.*` copy set
   are explicitly **not to be built**. Which of its shortcuts actually need a replacement is narrower
   than it looks (`SCOUT_STATE.md` §17: „`openSettings()` / `openOperator()` / `loadIncident()` |
   shortcuts, also reachable from the product UI (`openSettings`) — only `loadIncident` is demo-only
   from this bar“):
   - **„Einstellungen“ needs no new entry point.** The prototype's product UI already has one: the
     avatar profile menu item „Einstellungen“, `role="menuitem"`, handler `openSettings`
     (`SCOUT_SCREENS.md` §2.4.3). Port that; do not invent a second one (and see §1.3/§1.14, which
     both already record it).
   - **„Betreiberansicht“ does need one.** `openOperator` is wired only into the demo bar
     (`SCOUT_STATE.md` §13, §17), so the operator entry is genuinely missing from the prototype's
     product UI — see §1.3, which proposes an operator-only row in the avatar menu.
   - **„Beispielstörung laden“ must not ship.** `loadIncident` is demo-only. Note that two *product*
     strings point at it and therefore also cannot ship verbatim — the Operator calm banner and the
     Diagnose no-incident card (both recorded in Table 2).
   - **„Demo erneut ansehen“ is product UI.** `restart()` is the one demo-control handler that the
     prototype renders inside the product surface (the complete screen); `SCOUT_STATE.md` §17 says
     „keep it only there“. In the app it has no meaning — see the `complete` row in Table 2.

   Priority: **must**.
4. **Three breakpoints, one of them unspecified.** `narrow` is `≤ 959 px` in the Scout surface and
   `< 880 px` on Landing v2 — neither matches a Tailwind default, and the app currently uses `650`,
   `820`, `1050`. Two further facts change the plan:
   - **Settings has no breakpoint at all.** `Settings.dc.html` exposes no `mobile` prop and contains no
     width-based branching (`SETTINGS_SCREENS.md` §15). Its only fluid behaviour is
     `grid-template-columns:repeat(auto-fit,minmax(280px,1fr))` on the autonomy mode cards, `flex-wrap`
     on a handful of rows, and the three `width:min(…)` overlays. The prototype's own mobile preview of
     this surface is **visually broken** — a 296 px fixed sidebar inside a 318 px usable frame leaves a
     ~20 px content column — and is a preview artefact, not a design. The port must therefore **invent**
     a `< 900px` breakpoint: collapse the sidebar into a `Sheet` (or a horizontal `Tabs`/`Select`),
     content padding `42px 46px 40px` → ~`24px 18px 28px`, H1 `44px` → ~`30–32px`, lead `19px` → `16px`,
     source-row grid `56px minmax(0,1fr) auto auto auto` → two rows, billing stat grid → single column
     without the `border-left` dividers, connection sheet → full-width bottom `Sheet`.
   - **Operator is desktop-only.** „The Operator has no `mobile` prop — this surface is desktop-only in
     the prototype“ (`OPERATOR_SCREENS.md` §1.2). Decide whether `/ops` gets a mobile layout at all;
     today's app ships an ops mobile tab bar at `≤ 820 px` (§1.4) that has no prototype counterpart.

   Priority: **nice** (Scout/Landing), **must** (the invented Settings breakpoint, because the Settings
   dialog is on the demo path).
5. **Reduced motion** is honoured differently on each side (`prefers-reduced-motion` skips the transform on
   Landing, disables the blob animation in `ScoutBlob`, and in the prototype makes the utterance reveal
   instant and skips the capsule flight). Priority: **nice**.
6. **Need resolution is duplicated three times** — `ScoutPage`, `MySearchPage` and
   `SearchControlSettings` each resolve the active saved need independently (`DATA_MAP.md` §7, gap 7:
   „extract `useActiveNeed()`“). This duplication is the **cause**, not a coincidence, of two divergences
   that Table 1 records only as symptoms: the `stopConditions` string split
   (`A login or human-only step is required` vs `A human-only step is required`, plus
   `Coverage status unavailable` vs `Coverage unavailable`, two source-error strings and two date
   formats) and the two `SearchSourcesPanel` variants (different error string, `Saving…` state present
   on one caller only). Extract `useActiveNeed()` **before** extracting i18n keys, otherwise the same
   concept is keyed twice. Priority: **must**.

---

## 4. Appendix — the elided string sets, enumerated verbatim

This document's own rule (§0 preamble) is that German **and** English copy is quoted verbatim, because
every string has to become an i18n key for the DE/EN toggle. The tables above name a few sets by count
to stay readable; all of them are enumerated here so no key has to be recovered from
`APP_UI_INVENTORY.md`. Nothing in this section is new information — it is the same copy, unelided.

### 4.1 `features/auth/errors.ts` — the 15-string auth dictionary (EN)

`MIN_PASSWORD_LENGTH = 10`, `MAX_PASSWORD_LENGTH = 100`. `authErrorMessage(userError)` maps one Convex
error code to exactly one string.

| Code | String |
| --- | --- |
| `PASSWORD_TOO_SHORT` | `Use at least {minimumLength ?? 10} characters.` |
| `PASSWORD_TOO_LONG` | `Use no more than {maximumLength ?? 100} characters.` |
| `PASSWORD_HAS_SURROUNDING_WHITESPACE` | `Remove spaces from the beginning or end of the password.` |
| `PASSWORD_TOO_COMMON` | `Choose a less common password.` |
| `USERNAME_TOO_SHORT` | `Use at least {minimumLength ?? 1} character for the username.` |
| `USERNAME_HAS_SURROUNDING_WHITESPACE` | `Remove spaces from the beginning or end of the username.` |
| `USERNAME_HAS_INVALID_CHARACTERS` | `The username contains unsupported or invisible characters.` |
| `USERNAME_TAKEN` | `That username is already in use.` |
| `USER_NOT_FOUND` | `No account exists for that username.` |
| `INVALID_CREDENTIALS` | `The username or password is incorrect.` |
| `RATE_LIMITED` | `Too many attempts. Try again in {n} second.` / `Too many attempts. Try again in {n} seconds.` (`n = max(1, ceil(retryAfterMs/1000))`; singular only at 1) |
| `INVALID_PASSWORD` | `Choose a valid password.` |
| `INVALID_USERNAME` | `Choose a valid username.` |
| `OTHER_ERROR` | `An unexpected authentication error occurred. Please try again.` |
| (default) | `Authentication failed. Please try again.` |

Plus the page-local `Authentication is not connected in this presentation-only route yet.` and the four
page-local validation strings that are **not** in this file: `Enter a username.`,
`Use at least {n} characters.`, `Use no more than {n} characters.`, `The passwords do not match.`

### 4.2 The 7 Settings `h1` / `p` header pairs (EN, `ProfilePage.tsx`)

| Section | `h1` | `p` |
| --- | --- | --- |
| sources | `Sources & access` | `Manage the private identities and reviewed portal access RoomScout may use for you.` |
| autonomy | `Autonomy` | `Review what your Scout may do, what still needs approval, and where it must stop.` |
| knowledge | `What your Scout knows` | `Inspect remembered facts and the working context used for your search.` |
| profile | `Your profile` | `The account identity attached to this private RoomScout workspace.` |
| notifications | `Notifications` | `See which product events can currently reach you.` |
| usage | `Plan & usage` | `Availability of billing and metered usage for this workspace.` |
| privacy | `Privacy` | `Understand what is stored, what is not, and which services perform product work.` |

Prototype counterparts, in the same order: „Wo darf dein Scout suchen?“, „So arbeitet dein Scout“,
„Was ich über euch weiß“, „Dein Profil“, „Wann soll ich mich melden?“, „Tarif & Nutzung“,
„Deine Daten, deine Kontrolle“.

### 4.3 The 7 portal error strings (EN, `ProfilePage.tsx`)

`The secure portal session could not be started.` ·
`The controlled portal registration could not be started.` ·
`The portal connection could not be paused.` ·
`The portal inbox could not be synchronized.` ·
`The portal connection could not be created.` ·
`The RoomScout email address could not be created.` ·
`The portal connection could not be disabled.`

### 4.4 The 6 inbox error strings (EN, `MusicianInboxPage.tsx`, `p.rs-form-error[role=alert]`)

`The handoff could not be persisted.` ·
`The exact action decision could not be persisted.` ·
`The approved provider action could not be started.` ·
`The human completion state could not be saved.` ·
`The mailbox message status could not be saved.` ·
`This action does not have a supported provider executor.`

### 4.5 The 5 `BrowserRunPage` error strings (EN)

`Live View is not available.` ·
`The authenticated context could not be finalized.` ·
`The browser run could not be stopped.` ·
`The browser run could not be restarted.` ·
`The RoomScout registration address could not be created.`

### 4.6 `PortalConnectionsWorkspace` — the 6 status label / description pairs (EN)

| Label | Description |
| --- | --- |
| `Not connected` | `RoomScout has created the connection record, but its reviewed login flow is not ready yet.` |
| `Login / registration needed` | `Open a private Live View to log in or register once. RoomScout never sees or stores what you type there.` |
| `Connected` | `The saved Browserbase Context can be reused for allowed searches and inbox checks on this portal.` |
| `Reauthentication required` | `This portal ended or invalidated its login. Reconnect in Live View to refresh only this portal Context.` |
| `Paused` | `RoomScout will not use this portal until you reconnect it. Other portal connections are unaffected.` |
| `Disabled` | `The remote Browserbase Context was deleted and this portal identity can no longer be used.` |

### 4.7 `ProviderOfferPanel` — the 7-step reply label ladder (EN)

`Reply · sent` · `Reply · delivery being checked` · `Reply · checking final text` ·
`Reply · authorized, awaiting delivery` · `Reply · needs your review` ·
`Reply · failed; not confirmed sent` · `Suggested reply · not sent`

Also on this panel, and elided in Table 1: the no-offer branch
`Your Scout is reviewing the provider's message against your search.` /
`The provider update could not be assessed yet. No reply has been sent.`; the header meta
`Accepted offer` / `Needs reassessment` / `Ready for review` / `Open questions`; the stale notice
`This assessment is out of date because the conversation, listing or your search changed.`; and the
three acceptance notices `Acceptance sent · search paused. This does not confirm a booking, signature, or payment.`,
`Acceptance approved. Delivery is still being checked; it is not yet confirmed sent.`,
`Acceptance failed and is not confirmed sent.`

### 4.8 `OfferAcceptanceDialog` — the 10 state strings (EN)

| State | String |
| --- | --- |
| loading | `Preparing the exact acceptance…` |
| prepare failed | `The acceptance could not be prepared. Nothing was sent.` |
| no descriptor | `This acceptance request is unavailable. Nothing was sent.` |
| stale (`!descriptor.current`) | `This review is stale because the offer, search, or conversation changed. Nothing was sent.` |
| `OFFER_CHANGED` / `ACCEPTANCE_CONTENT_CHANGED` | `The offer or acceptance message changed. Nothing was sent. Close this review and start again from the current offer.` |
| expired | `This approval request expired. Nothing was sent.` |
| failed | `The acceptance failed and is not confirmed sent. This exact request cannot be approved again.` |
| pending (`approved`/`executing`) | `Acceptance approved. Delivery is still being checked; this does not yet confirm it was sent.` |
| executed | `Acceptance sent.` |
| approve rejected | `The acceptance could not be approved. Nothing was sent.` |

Footer `Cancel` / `Approve and send acceptance` (busy `Approving…`).

### 4.9 `MandatePanel` — the 19 `actionLabels` and the 8 data-scope labels (EN)

`actionLabels` (in order): `Browse public sources` · `Browse connected portals` ·
`Read connected messages` · `Extract and compare facts` · `Send email` · `Submit web form` ·
`Send platform message` · `Create a portal account` · `Publish a search listing` ·
`Share contact details` · `Propose a visit time` · `Accept terms` · `Accept or sign a contract` ·
`Confirm a booking` · `Make a payment` · `Pay a deposit` · `Enter a password` ·
`Complete two-factor authentication` · `Solve a CAPTCHA`

**Do not reuse this map in the approval dialog** — `ActionApprovalSheet.kindLabels` is a different,
differently worded map (see the divergence row in §1.17).

Data-scope checkbox labels, rendered as `scope.replaceAll("_", " ")`: `band name` ·
`member first names` · `reply email` · `phone` · `precise location` · `availability` · `budget` ·
`music profile`

### 4.10 Dialog and section body lines quoted only by name in Table 1

- Disable-portal dialog body: `RoomScout will stop using this portal and ask Browserbase to delete its persisted Context. This removes the reusable portal session; it does not delete the account on the third-party website.`
- Forget-fact dialog body: `RoomScout will stop using this fact and rebuild the working context without it.`
- Notifications static card: `Matches, replies, approvals, and required handoffs appear in RoomScout as they arrive. User-configurable email, push, and browser notification preferences are not available yet; RoomScout will not claim permission or delivery it has not implemented.`
- Usage static card: `This workspace has no connected billing system, purchasable plan, or user-facing metering ledger. No prices, quotas, or usage totals are shown because RoomScout cannot currently verify them.`
- Privacy → `Storage boundaries`: `Reviewed memory facts, searches, approvals, and event metadata may be persisted in Convex. Raw context imports are analyzed but not stored. Raw voice audio, passwords, 2FA values, CAPTCHA answers, cookies, and ephemeral Live View URLs are not stored.`
- Privacy → `Services involved`: `Convex stores application state. Firecrawl performs public-web discovery and monitoring. AgentMail handles approved email. Browserbase provides isolated portal contexts. OpenAI performs text reasoning, embeddings, and the approved realtime voice flow.`
- `OpportunityHandoff` warning (`src/components/opportunities/OpportunityHandoff.tsx:59`, verified in source because `APP_UI_INVENTORY.md` §8 elides it too): `RoomScout has not accepted, signed, booked, or paid for anything. Review the counterparty and all unresolved terms yourself.`
- `MUSIC_CONTEXT_IMPORT_PROMPT`: 14 lines, 11 non-blank, quoted verbatim in `APP_UI_INVENTORY.md` §8 (too long to duplicate here; it is the only set in this appendix that is not reproduced).
