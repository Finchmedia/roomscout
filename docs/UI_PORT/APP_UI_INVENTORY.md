# RoomScout — Inventory of the CURRENT app UI (pre-port baseline)

Branch: `ui-port`. Snapshot of everything the running app renders today, so each element can
later be matched against the Claude Design prototype
(`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype`:
`Landing.dc.html`, `Landing v2.dc.html`, `Roomscout.dc.html`, `Settings.dc.html`, `Operator.dc.html`).

This document is descriptive only. Nothing here was changed.

---

## 0. How to read this document

### Prototype-fit classification

Every panel/control row carries one of:

| Code | Meaning |
| --- | --- |
| **(a)** | Clearly belongs to a prototype surface — Landing, Scout (`Roomscout.dc.html`), Settings, or Operator. A 1:1 counterpart exists or is obviously intended. |
| **(b)** | Legacy tool with **no** prototype counterpart. Candidate for deletion, or for hiding behind an "advanced/internal" door. |
| **(c)** | Unclear. Partly implied by the prototype (a label exists, but no screen), or a cross-cutting concern the prototype never shows. |

Evidence used for the classification (keyword scan over the five `.dc.html` files):

| Concept | Landing | Landing v2 | Roomscout | Settings | Operator |
| --- | --- | --- | --- | --- | --- |
| „Suchauftrag“ | 1 | 5 | 19 | 14 | 0 |
| „Nachrichten“ | 0 | 0 | 0 | 4 | 4 |
| „Karte“ | 0 | 1 | 1 | 0 | 0 |
| „Mitschrift“ | 0 | 0 | 5 | 1 | 0 |
| „Anzeigen entdecken“ / "Explore" / "Signal" / "Live View" / „Posteingang“ | 0 | 0 | 0 | 0 | 0 |

⇒ The prototype has **no** Explore/market-explorer surface, **no** signal-detail page, **no** map/globe
screen, **no** standalone three-pane inbox, and **no** Browserbase Live-View run page. It **does**
have the Scout conversation + brief + offer/approval flow, a full Settings surface, and an Operator
surface.

### Language legend
`DE` = German copy, `EN` = English copy, `MIXED` = both inside the same panel.
German strings are quoted **verbatim**, including „…“, `·`, `–`, `…`, `’`.

### Styling-approach legend
- **G** = global class from `src/styles/app.css` (`.btn`, `.lcard`, `.type`, `.q`, `.drawer`, …)
- **D** = override from `src/styles/design-system.css` (`.rs-*` consumer/ops skin)
- **L** = `src/styles/landing.css` (only imported by `LandingPage.tsx`)
- **M** = CSS Module (`*.module.css`)
- **O** = `src/components/ops/OpsWorkspace.css` (plain global CSS, imported by `OpsPageHeader.tsx`)
- **T** = Tailwind utility classes (only `src/components/ui/table.tsx` uses these)
- **I** = inline `style` attribute (only `LandingPage` hero-preview transform, set imperatively)

---

## 1. Route map — `src/app/router.tsx`

```
BrowserRouter
└─ Routes
   /                       → LandingPage
   /explore                → ExplorePage            (public wrapper)
   /signals/:signalId      → SignalDetailPage
   /map                    → MapPage                (public)
   /sign-in                → AuthRoute → AuthPage
   /sign-up                → AuthRoute → AuthPage
   ── RequireAuth > VoiceSessionProvider > Outlet ──
   /app/scout              → ScoutPage
   /app/explore            → AppExplorePage         (same content, authenticated)
   /app/map                → MapPage workspace
   /app/search             → MySearchPage
   /app/inbox              → MusicianInboxPage
   /app/profile            → ProfilePage
   /app/settings/:section? → ProfilePage
   /app/runs/:runId        → BrowserRunPage
   ── RequireAuth > RequireOperator ──
   /ops                    → OpsOverviewPage
   /ops/signals            → OpsSignalsPage
   /ops/sources            → OpsSourcesPage
   /ops/outreach           → OpsOutreachPage
   /ops/inbox              → OpsInboxPage
   /ops/audit              → OpsAuditPage
   *                       → <Navigate replace to="/" />
```

### Route guards & their visible output

| Element | Component | Markup / classes | Copy | Lang | Class |
| --- | --- | --- | --- | --- | --- |
| Auth-loading state | `RequireAuth` → `RouteState` | `div.rs-route-state[role=status]` (G) | `Restoring your session…` | EN | (c) |
| Unauthenticated redirect | `RequireAuth` | `<Navigate to="/sign-in?returnTo=…">` — no UI | — | — | (a) |
| Operator check pending | `RequireOperator` | `div.rs-route-state` | `Checking operator access…` | EN | (c) |
| Operator denied panel | `RequireOperator` | `div.rs-route-state.rs-route-state--panel` + `span.type.t-scout` + `h1` + `p` + `Link.btn.btn-p` | eyebrow `Protected workspace`; h1 `Operator access required`; body `Your account can use the musician workspace. The Ops cockpit is restricted server-side.`; CTA `Open your Scout` → `/app/scout` | EN | (c) — prototype Operator surface is gated by a nav item („Betreiberansicht“ / „Nur für Betreiber“), not by a denial page |
| Auth-route session restore | `AuthRoute` | `div.rs-route-state[role=status]` | `Restoring your session…` | EN | (c) |

`src/app/returnTo.ts` sanitizes the `returnTo` query param (no UI): `safeReturnTo` keeps the value only when
it starts with a single `/` (`value.startsWith("/") && !value.startsWith("//")`) and otherwise returns the
default **`/app/scout`**. So an unauthenticated visit to *any* `/app/*` route ends up back at `/app/scout`
after sign-in unless the redirect carried a valid relative path (see §5.6).
`src/app/providers.tsx` wraps everything in `ConvexAuthProvider`; throws at boot if
`VITE_CONVEX_URL` is missing (no UI, hard crash).

---

## 2. Global chrome

### 2.1 `PublicHeader` — `src/components/navigation/PublicHeader.tsx`
Used by: `/explore`, `/signals/:id`, `/map` (public), `/sign-in`, `/sign-up`.
**Not** used by `/` (Landing has its own header).

Styling: **G** `.pubhead` (sticky, 68 px min-height, `rgb(6 6 5 / 78%)` + `blur(18px)`, bottom border
`--gray-800`) + **D** `.rs-public-header` (overrides to `background: transparent; border-bottom: 0; padding: 24px 48px`, pill buttons).

| Item | Element | Copy | Lang | Class |
| --- | --- | --- | --- | --- |
| Wordmark | `Link.brand[aria-label="RoomScout home"]` → `/`, `b.rs-wordmark` | `roomscout` | — | (a) |
| Burger (≤650 px) | `button.rs-public-header__menu.xbtn`, lucide `Menu`/`X` | aria `Open navigation` / `Close navigation` | EN | (a) |
| Nav link | `NavLink` → `/explore` | `Explore` | EN | **(b)** |
| Nav link | `NavLink` → `/map` | `Map` | EN | **(b)** |
| Nav link | `Link` → `/#how` | `How it works` | EN | (a) — prototype landing nav is „So funktioniert’s“ |
| Nav wrapper | `nav[aria-label="Public navigation"]` (`.open` when the burger is toggled) | — | EN | (a) |
| Nav link | `NavLink` → `/sign-in` | `Sign in` | EN | (a) |
| CTA | `Link.btn.btn-p` → `/app/scout` | `Start my search` | EN | (a) — prototype CTA is „Demo starten“ |

Mobile nav (`@media max-width:650px`) collapses into an absolutely positioned panel `.pubhead nav.open`.

### 2.2 `WorkspaceShell` — `src/components/navigation/WorkspaceShell.tsx`
Two completely different layouts driven by `mode: "musician" | "ops"`.

#### Musician layout (`mode="musician"`)
```
div.rs-consumer-workspace[.rs-consumer-workspace--scout]
├─ header.rs-consumer-header
│   ├─ Link.rs-consumer-wordmark → home            "roomscout"
│   └─ details.rs-account-menu   (key={pathname} → closes on navigation)
│       ├─ summary  → circular 44 px avatar with initials
│       └─ nav.rs-account-menu__panel  (280 px, radius 20, #201d19, border #675747)
└─ main.rs-consumer-main   (max-width 1440, padding 24/48/80; padding-top 0 on /app/scout)
```
Styling: **D** only (`design-system.css`). No sidebar, no mobile tab bar in this mode.

Account-menu contents (all **DE**):

| Row | Target | Copy | Count badge source |
| --- | --- | --- | --- |
| Identity block | — | `<strong>{displayName}</strong>` + `Dein persönlicher Scout` | `api.users.current` → `displayName ?? username ?? "Dein Konto"` |
| Nav | `/app/scout` (icon `Radar`) | `Scout` | `api.outreach.listMine {status:"awaiting_approval", limit:50}` length |
| Nav | `/app/explore` (icon `Search`) | `Anzeigen entdecken` | — |
| Nav | `/app/search` (icon `SlidersHorizontal`) | `Euer Suchauftrag` | `api.matches.listMine {status:"new", limit:50}` length |
| Nav | `/app/inbox` (icon `Mail`) | `Nachrichten` | `api.inbox.listThreadsMine {limit:50}` filtered `status==="replied"` — note `/app/inbox` itself reads a **different** endpoint, `api.communications.listThreadsMine` (§6.3) |
| Link | `/app/map` (icon `Map`) | `Karte` | — |
| `<hr>` | | | |
| Link | `/app/settings/sources` (icon `CircleUser`) | `Einstellungen` | — |
| Link (operators only) | `/ops` (icon `ArrowLeftRight`) | `Betreiberansicht` | `currentUser.role === "operator"` |
| Button | `signOut()` then `navigate("/")` (icon `LogOut`) | `Abmelden` | — |

Nav aria-labels: summary `Profilmenü`, nav `RoomScout und Konto`, wordmark `RoomScout home` (EN).
Count badges are rendered by the shared `NavigationItems` helper as `<span class="cnt">{count}</span>` and are
omitted entirely when the count is `0` or `undefined` (`{count ? … : null}`) — a still-loading query shows no
badge rather than a zero.

Classification: shell + wordmark + avatar menu = **(a)** (prototype „Persönlicher Bereich“, „Einstellungen“,
„Betreiberansicht“). The `Anzeigen entdecken` and `Karte` rows = **(b)** (no prototype surface behind them).
`Nachrichten` = **(c)** (prototype has no standalone inbox page; the word appears only in Settings/Operator).

#### Ops layout (`mode="ops"`)
```
div.shell.rs-workspace.rs-workspace--ops
├─ aside.side.rs-sidebar          230 px sticky, blur(16px)
│   ├─ Link.brand → /ops          "roomscout" + span.rs-brand-accent "ops"
│   ├─ nav.nav  (Overview / Signals / Sources / Outreach / Inbox)
│   ├─ div.grow + <hr>
│   └─ nav.nav  (Audit log · Switch to RoomScout · identity)
├─ main.main.rs-workspace__main
└─ nav.rs-mobile-tabs             (only ≤820 px, first 4 nav items)
```
Styling: **G** `.shell/.side/.nav/.main` + **D** `.rs-workspace--ops` (background tint, 10 px radius nav
items, `#ff692616` active pill) + **O** `OpsWorkspace.css` (main radial gradient, card/table/filter skins).

| Item | Copy | Count source | Lang | Class |
| --- | --- | --- | --- | --- |
| Nav `Activity` icon | `Overview` → `/ops` (`end`) | — | EN | (a) |
| Nav `Radio` | `Signals` → `/ops/signals` | `api.ops.navCounts.signalReview` | EN | (c) |
| Nav `Database` | `Sources` → `/ops/sources` | — | EN | (a) — prototype „Quellen“ |
| Nav `Send` | `Outreach` → `/ops/outreach` | `navCounts.outreach` | EN | (c) |
| Nav `Mail` | `Inbox` → `/ops/inbox` | `navCounts.inbox` | EN | (c) |
| Nav `ScrollText` | `Audit log` → `/ops/audit` | — | EN | (a) — prototype „Ereignisfolge“ |
| Link `ArrowLeftRight` | `Switch to RoomScout` → `/app/scout` | — | EN | (a) — prototype „Zur App“ |
| Identity | `span.rs-nav-identity` | `displayName ?? username ?? "Operator"` | EN | (a) |

Ops-mode aria-labels: brand `RoomScout Ops home`, primary `nav` `Operations`, secondary `nav` `Account`,
bottom tab bar `nav[aria-label="Mobile workspace navigation"]` (renders `items.slice(0, 4)`).
In musician mode the same helper labels the brand `RoomScout home` and the primary nav `RoomScout`.

Musician-mode sidebar branch (lines 119–125 of the file: `Profile`, `Switch to Ops`, `Sign out`) is
**dead code** — `mode==="musician"` returns before it. Worth deleting.

### 2.3 Ongoing-call bar — `VoiceSessionProvider`
Rendered for every authenticated route when `session.connected && pathname !== "/app/scout"`.
Styling: **D** `.rs-ongoing-call` (fixed bottom-center pill, `#211b16`, border `#9d6846`, shadow `0 12px 45px #0007`).

| Item | Copy | Lang | Class |
| --- | --- | --- | --- |
| aria-label of `<aside>` | `Laufendes Scout-Gespräch` | DE | (a) |
| Link → `/app/scout` | `Gespräch läuft · Zum Scout` (preceded by `span.rs-ongoing-call__dot`) | DE | (a) |
| Mute button | aria `Mikrofon einschalten` / `Mikrofon stummschalten` | DE | (a) |
| Hang-up button (red `#832e25`) | aria `Gespräch beenden` | DE | (a) |

---

## 3. The three stylesheets — roles and conflicts

| File | Lines | Imported by | Role |
| --- | --- | --- | --- |
| `src/styles/app.css` | 754 | `src/main.tsx` (1st) | `@import "tailwindcss"` + the whole original "ledger" design system: tokens, `.btn*`, `.lcard*`, `.type`, `.chip/.pill/.fchip`, `.input/.select`, `.seg`, landing-ish `.hero/.section/.grid3`, workspace `.shell/.side/.nav/.main`, scout `.msgs/.msg/.composer`, ops `.metrics/.q/.drawer/.stream`, inbox `.threepane/.mail/.ctx`, modal `.overlay/.modal`, auth `.center/.authcard`, plus ~30 `rs-*` feature blocks. |
| `src/styles/design-system.css` | 297 | `src/main.tsx` (2nd) | The **new** skin ported from the Claude Design export. Redefines `:root` font + `--signal`/`--ink`/`--muted`/`--panel`, repaints `body`, and adds the consumer shell (`.rs-consumer-*`, `.rs-account-menu*`), ops overrides, `.rs-ongoing-call`, auth-page overrides, inbox radius overrides. |
| `src/styles/landing.css` | 1158 | `src/routes/public/LandingPage.tsx` only | Self-contained landing system scoped to `.landing-shell` (own `--ink/--muted/--dim/--orange`), scroll-story, bento, FAQ, footer, orb keyframes. Loaded lazily-by-route but **globally scoped once imported** (no CSS-module scoping) — after visiting `/`, its rules stay in the document for the whole SPA session. |

### Documented conflicts

1. **Fonts.** `app.css:5` sets `font-family: "Inter Variable", Inter, …` and `--font-sans` to Inter.
   `design-system.css:4` overrides both to `"Geist Variable", Geist, …`. `main.tsx` imports **only**
   `@fontsource-variable/geist`; `@fontsource-variable/inter` is in `package.json` but never imported,
   so every Inter reference silently falls back. `landing.css:9` first sets `GeistVariable, Geist, system-ui`
   (a non-existent family name — no `@font-face` uses `GeistVariable`), then re-declares at line 885 with the
   correct `"Geist Variable"`. Net: Geist everywhere, two dead font declarations.
2. **`--signal`.** `app.css` `#ff6b2c`, `--signal-hover` `#ff814d`, plus `--signal-soft` / `--signal-border`.
   `design-system.css` overrides `--signal` → `#ff6926`, `--signal-hover` → `#ff834b`, but does **not**
   redefine `--signal-soft` / `--signal-border`, which stay derived from the *old* `#ff6b2c`. Result: two
   oranges coexist in one component (solid fills `#ff6926`, tinted backgrounds `rgb(255 107 44 / 10%)`).
   `landing.css` adds a third scope-local `--orange: #ff6926`. Module CSS hard-codes `#ff6926` in
   `ScoutPage.module.css`, `ScoutBlob.module.css`, `ScoutConversation.module.css`, and `#ff8a4e`/`#ff9b65`
   accents in `SettingsFrame.module.css` / `OpsPageHeader.module.css`.
3. **Backgrounds.** `app.css` paints `html { background:#090908 }` and
   `body { linear-gradient(rgb(0 0 0 /76%), rgb(0 0 0 /88%)), url("../assets/room-background.jpg") center/cover fixed }`.
   `design-system.css` then replaces it entirely with `#0a100f url("/design/bg.jpg") center / cover fixed`
   (no darkening gradient). So `src/assets/room-background.jpg` is bundled but **never visible**; the visible
   background is the public asset `/design/bg.jpg` (3.5 MB, unoptimized, `background-attachment: fixed`).
   `landing.css` adds a third: `.landing-backdrop` fixed layer with gradient + `/design/grain.svg` + `/design/bg.jpg`
   at `center 30%` and `filter: saturate(.78)`.
4. **Ink/muted.** `app.css` `--ink:#f7f7f5`, `--muted:#aaa9a4`; `design-system.css` `--ink:#f5ece2`
   (warm), `--muted:#b8aea3`. All `--gray-*` tokens remain the cool `app.css` values, so warm text sits on
   cool borders throughout.
5. **Radii/shape.** `app.css` uses 6–12 px radii; `design-system.css` re-rounds inside
   `.rs-consumer-workspace` (`.btn` → 999 px, cards → 22 px, `.input` → 12 px) **and** on the two public
   surfaces it skins: `.rs-public-header .btn` → 999 px (design-system.css:220–222) and
   `.rs-auth-page .btn` → 999 px / `.rs-auth-page .input` → 12 px / `.rs-auth-page .authcard` → 26 px
   (design-system.css:227–238). Everything else (`/explore`, `/signals/:id`, `/map`, all of Ops) keeps the
   square `app.css` radii, so identical components look different on `/explore` vs `/app/explore`.
6. **Unstyled class names in use.** `rs-empty-state`, `rs-form-error`, `rs-signal-grid`, `rs-event-stream`,
   `rs-metrics-grid`, `rs-signal-detail`, `rs-signal-detail__columns`, `rs-search-page__layout`,
   `rs-page-header__meta`, `rs-freshness`, `badges`, `checks` (MandatePanel `Always human`,
   `OpportunityHandoff` Confirmed/Still-unresolved, OpsInboxPage parsed facts), `frow` (every
   `SearchProfileCard` field row), `visible` (the AuthPage error is `p.err.visible`; `.visible` is a no-op,
   so the styling comes from `.err` alone), `rs-dialog-overlay` (on `ActionDialog`'s Radix Overlay),
   `rs-ledger-card__header` / `rs-ledger-card__body` / `rs-ledger-card__footer` (emitted by every
   `LedgerCard`, see §4), bare `rs-explore` (only `.rs-explore__tools` and `.rs-explore__save` have rules),
   and `rs-outreach-layout`/`rs-ops-inbox-layout` (styled **only** under `.rs-workspace--ops` in
   `OpsWorkspace.css`) have **no CSS rule at all** in the three sheets. In particular `EmptyState` and every
   `p.rs-form-error` alert render with browser defaults.
7. **Dead CSS.** `.demo-trigger` (4 rules incl. a media query) has no consumer in `src/`. Same for
   `.rs-brand-mark`, `.rs-memory-*` blocks that survive only through `ProfilePage`'s knowledge section,
   `MarketGlobe.module.css .marker/.markerSelected` (markers were replaced by GL layers), and in
   `ScoutPage.module.css` the never-referenced `.factsStage` (lines 115–121 plus a media-query override at
   444), `.fact` / `.fact span` / `.fact strong` (122–144), `.voiceOverlay` (302–311) and `.voiceClose`
   (312–320) — `ScoutPage.tsx` uses only 34 of the module's classes.
8. **Undefined token `--gray-100`.** It is consumed by `app.css:614` (`.rs-mandate-summary b`),
   `ActionLifecyclePanel.module.css:41` and `MailboxVerificationPanel.module.css:47`, but no stylesheet
   defines it — the ladder in `app.css` runs `--gray-200` (`#deded9`) … `--gray-900` (`#1b1a18`) only.
   Those three rules therefore resolve to `color: inherit`.
9. **`.rs-wordmark` is declared twice.** `app.css:82` sets `color:#fff; font-size:20px; font-weight:650;
   letter-spacing:-.045em`; `design-system.css:22–26` re-declares `.rs-wordmark, .rs-consumer-wordmark`
   with `font-weight:500; letter-spacing:0.035em`. The design-system values win (later import), so the
   `app.css` weight/tracking is dead.
10. `OpsWorkspace.css` is a **global** stylesheet imported from a component (`OpsPageHeader.tsx`), i.e. it
    loads on the first Ops render and then applies globally for the session (harmless only because every
    selector is prefixed `.rs-workspace--ops`).

---

## 4. UI primitives — `src/components/ui/`

| File | Exports | Implementation | Styling | Class |
| --- | --- | --- | --- | --- |
| `LedgerCard.tsx` | `LedgerCard`, `PageHeader`, `EmptyState` | `LedgerCard` = `section.lcard.rs-ledger-card[.rs-ledger-card--accent][ {className}]` + optional `header.lcard-top.rs-ledger-card__header` / `footer.lcard-foot.rs-ledger-card__footer`, body `div.lcard-body.rs-ledger-card__body`. The three `rs-ledger-card__*` BEM classes are emitted on every card but have **no CSS rule** (see §3.6). `PageHeader` = `header.pagehead.rs-page-header` with optional `.eyebrow`, `h1`, `.rs-page-header__meta`. `EmptyState` = `div.rs-empty-state > h2 + p` (**unstyled**). | G + D | (c) — the prototype uses flat sections/dividers, not bordered "ledger" cards; only Operator has card-ish tiles |
| `ActionDialog.tsx` | `ActionDialog` | Radix `Dialog` — `Overlay.overlay.open.rs-dialog-overlay` (the `rs-` class is unstyled) + `Content.modal.rs-dialog-content` (fixed, centered via transform), `.modal-top` (Title + optional Description `.mono` + `Dialog.Close.xbtn` with `aria-label="Close dialog"`), `.modal-body`, optional `.modal-foot`. | G | (a) — prototype uses dialogs/sheets for approvals |
| `SelectField.tsx` | `SelectField` | Radix `Select` — `.rs-select-trigger` (190 px, chevron), portalled `.rs-select-content` (popper, `#11110f`, `rs-select-in` 140 ms), `.rs-select-item` with left check indicator, scroll buttons. | G | (c) |
| `table.tsx` | `Table*` (shadcn-style) | The **only Tailwind-utility** file. `Table` wraps in `div.relative.w-full.overflow-x-auto[data-slot=table-container]`; head/body/row/cell add `border-b`, `p-2`, `h-10 px-2 text-left align-middle font-medium` etc. Callers always add a legacy class (`className="facts"` or `className="q rs-review-table"`) so Tailwind + global rules fight over padding/borders. Also exports an **unused** `TableCaption` (`caption.mt-4.text-sm[data-slot=table-caption]`) — no importer in `src/`. | T + G | (c) |

`src/lib/utils.ts` — single export:
```ts
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
```
Used **only** by `table.tsx`. `clsx` + `tailwind-merge` are dependencies for that one file. The path alias
`@/lib/utils` is used in `table.tsx` while every other import is relative.

---

## 5. Public routes

### 5.1 `/` — Landing — `src/routes/public/LandingPage.tsx`
Root: `div.landing-shell` + `div.landing-backdrop`. Styling: **L** exclusively (plus one **I**: the
scroll handler writes `previewRef.current.style.transform`). The exact hero-preview formula
(`LandingPage.tsx:13–19`, run on `scroll` (passive) and `resize`, and once on mount):

```js
const progress = Math.min(1, Math.max(0,
  (window.innerHeight * 0.92 - rect.top) / (window.innerHeight * 0.55)));
previewRef.current.style.transform =
  `rotateX(${14 * (1 - progress)}deg) scale(${0.96 + 0.04 * progress})`;
```

`rect` is the preview's `getBoundingClientRect()`. Under `prefers-reduced-motion: reduce` the transform is
**never written at all** (the element keeps its CSS default); only `setScrolled(window.scrollY > 40)` still runs.
Copy: **DE throughout.** Classification: **(a)** — this is the closest thing in the repo to a prototype port.

| # | Section | Elements | Verbatim copy | Data |
| --- | --- | --- | --- | --- |
| 1 | `header.landing-header` (`.is-scrolled` after `scrollY > 40`; 80→64 px, blur 12 px) | wordmark, nav, pill | `roomscout` · nav `So funktioniert’s`, `Dein Scout` · CTA `Demo starten` → `/app/scout` | static |
| 2 | `section.landing-hero#top` | kicker, h1, sub, actions, note, preview | kicker `Euer persönlicher Proberaum-Scout`; h1 `Ihr macht Musik.` + `<br/>` + `<span>Der Scout sucht den Raum.</span>`; p `Erzählt, was ihr sucht. RoomScout bündelt die Recherche und hilft, offene Fragen mit Anbietern zu klären.`; buttons `Demo ausprobieren` → `/app/scout` and `So funktioniert’s ↓`; note `Früher Prototyp · Kontrollierte Demo`; preview badge `Beispielansicht`; img alt `Beispielansicht der RoomScout-App: Der Scout arbeitet und wartet auf eine Antwort.` (`/design/hero-preview.png`) | static |
| 3 | `section.landing-intro#how` | overline, h2, p+link | `So funktioniert RoomScout`; `Ein Gespräch.` + `<br/>` + `Dann übernimmt euer Scout.`; `Von euren Wünschen bis zum konkreten Angebot.` + `<br/>` + `Weiter zu den Funktionen ↓` | static |
| 4 | `LandingStory` (see below) | scroll story | | static model |
| 5 | `LandingBento` | 4 bento articles | | static |
| 6 | `LandingFaq` | 3 accordions | | static |
| 7 | `section.landing-closing` + `footer.landing-footer` | note, orb, h2, actions, footer | note `Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter.`; h2 `Bereit für euren nächsten Proberaum?`; CTAs `Demo ausprobieren` → `/app/scout`, `Öffentlichen Markt ansehen →` → `/explore`; footer `roomscout` + `Ein persönlicher Scout für eure Proberaumsuche.` + link `Karte` → `/map` + `Entstanden beim Convex All Gas Hackathon.` | static |

Landing footer link `Karte` → `/map` and closing CTA `Öffentlichen Markt ansehen →` → `/explore` are the only
two places where the legacy tools are advertised from the prototype-aligned surface → **(c)**.

#### `LandingStory` — `src/components/landing/LandingStory.tsx` (+ `landingStoryModel.ts`)
Scroll-driven, three chained sections. All **DE**, all **(a)**.

Reduced motion changes three things: `.landing-story` and `.landing-work` additionally get the modifier
class **`.is-linear`**, all `storyLines` are shown at once (`visibleLines = storyLines.length`), and the work
status jumps straight to the last entry.

- `section.landing-story` (`min-height:320vh`) → `.landing-story-sticky` (grid `0.7fr 1.6fr 0.9fr`), toggles
  `.is-brief` when `progress > 0.72` or reduced motion.
  - `.landing-listener`: `.landing-orb` + `<p><i/> Ich höre zu</p>`
  - `.landing-conversation`: 4 lines revealed by `Math.floor(progress*5.2)+1`, each `<small>Du</small>` + text + chips:
    1. `Wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart.` → chips `Stuttgart & Umgebung`, `Geteilter Raum · 4 Personen`
    2. `Bis 400 Euro im Monat. Unser Schlagzeug soll dort bleiben können.` → `Bis 400 € / Monat`, `Schlagzeug darf im Raum bleiben`
    3. `Am liebsten donnerstags ab 19 Uhr.` → `Donnerstags ab 19 Uhr`
    4. `Eigentlich lieber maximal 350 Euro.` → `Bis 350 € / Monat` (replaces the `budget` id)
  - `aside.landing-facts.landing-shared-brief`: h3 `Euer Suchauftrag` → `So suche ich für euch.` when brief;
    fact rows; `<em>Korrekturen ersetzen den alten Wert.</em>`; brief actions `Scout losschicken` (→ `#work`) +
    `Illustrativer Demo-Ablauf. Eine verbindliche Zusage gebt nur ihr.`
  - section aria-label `Illustrierter Demo-Ablauf: Suchauftrag`
- `section.landing-work#work` (`min-height:200vh`): orb, h3 `Ich kümmere mich darum.`, rotating status
  (`Ich suche passende Räume.` / `Ich prüfe Quellen und offene Fragen.` / `Die Demo-Anfrage ist vorbereitet.`),
  selected by `Math.min(2, Math.floor(workProgress * 3))` — under reduced motion always the last one —
  pill `Stuttgart · bis 350 €` (lucide `Search`), small
  `Ihr könnt die App schließen. Der Scout meldet sich, wenn eine Entscheidung nötig ist.`;
  aria-label `Illustrierter Demo-Ablauf: Recherche`
- `section.landing-decision`: h3 `Nur echte Entscheidungen kommen zu euch.`; card `.landing-question` with
  `Dein Scout · Demo` and `Ein Beispielraum passt. Donnerstag ist schon belegt — wäre Mittwoch ab 19 Uhr auch möglich?`;
  buttons `Mittwoch passt` / `Donnerstag bleibt wichtig`; answer bubble `Mittwoch passt auch.` /
  `Donnerstag bleibt wichtig.` plus `Alles klar. Ich kläre den Rest im Demo-Ablauf.` /
  `Verstanden. Dieses Beispiel passt nicht mehr – der Scout setzt die Suche mit Donnerstag als fester Vorgabe fort.`
- Branch A (`wednesday`) `section.landing-offer`: h3 `Ein Raum, der zu euch passt.`; card image `/design/proberaum.png`
  alt `Beispielhafter Proberaum mit Schlagzeug und Akustikpaneelen`; `Illustratives Beispielangebot`;
  `Stuttgart-West · Geteilter Proberaum`; `280 € <span>/ Monat</span>`; `inklusive Nebenkosten`;
  list `Mittwochs, 19–22 Uhr`, `Schlagzeug kann im Raum bleiben`; CTA `Demo öffnen`;
  `Keine echte Anzeige. Eine verbindliche Zusage gebt nur ihr.`; footer `Beispielsuche · Ablauf verkürzt dargestellt`
- Branch B (`thursday`) `section.landing-continued-search`: `Demo-Suche angepasst`; h3 `Donnerstag bleibt gesetzt.`;
  p `Der Beispielraum in Stuttgart-West ist verworfen. Der Scout sucht weiter und meldet sich erst wieder mit einem passenden Treffer oder einer neuen Rückfrage.`;
  pill `Stuttgart · Donnerstag ab 19 Uhr · bis 350 €`; CTA `Echten Scout öffnen`;
  replay `Alternativen Demo-Ausgang mit Mittwoch ansehen`

#### `LandingBento` — `#features`
Overline `Mehr als eine Trefferliste`; h2 `Ein Scout, der euch versteht.` + `<br/>` + `Und dranbleibt.`;
p `Eure Wünsche, eure Gespräche und eure Suche bleiben zusammen.` Four articles (**DE**, **(a)**):

1. `.landing-bento-memory` — h3 `Merkt sich, was euch wichtig ist.`, p `Auch wenn sich eure Wünsche ändern.`,
   memory box `Eure Wünsche` / `Aktualisiert · gerade eben`, rows `Geteilter Raum · 4 Personen`,
   `🥁 Schlagzeug darf bleiben`, `€ <del>400 €</del> <strong>350 € / Monat</strong>`; image `/design/proberaum.png` (empty alt)
2. h3 `Bleibt an Antworten dran.`, p `Ihr müsst nicht jedes Portal selbst prüfen.`, replies
   `Anbieter · Demo` / `Mittwoch wäre noch frei.` and `RoomScout` / `Passt Mittwoch für euch?`
3. h3 `Behält eure Quellen im Blick.`, p `Passende öffentliche Signale an einem Ort.`, stack
   `Angebot · Stuttgart-West`, `Gesuch · Band sucht Raum`, `Stuttgart`
4. `.landing-bento-control` — orb + h3 `Übernimmt Arbeit. Nicht eure Entscheidung.`,
   p `Nicht-bindende Anfragen können im erlaubten Rahmen laufen. Verbindliche Zusagen bleiben bei euch.`,
   permissions `Anbieter kontaktieren` / `Nur nach Freigabe oder aktivem Mandat.` and
   `Verbindlich zusagen` / `Bleibt immer bei euch.`, link `So behaltet ihr die Kontrolle ↓` → `#control`

#### `LandingFaq` — `#control`
Overline `Klar geregelt`; h2 `Euer Scout übernimmt.` + `<br/>` + `Ihr behaltet das letzte Wort.`;
p `Ihr bestimmt, wo gesucht wird, was der Scout übernehmen darf und was er sich merkt.`
Accordion (first open, `-1` closes all):
1. `Was darf der Scout selbstständig tun?` → `Er recherchiert und kann nicht-bindende Anfragen innerhalb einer genau freigegebenen Aktion oder eines aktiven, begrenzten Mandats übernehmen. Zusagen, Buchungen und Zahlungen benötigen immer eure exakte Freigabe.`
2. `Muss ich mit dem Scout sprechen?` → `Nein. Ihr könnt sprechen oder schreiben. Beides gehört zur selben Suche.`
3. `Funktioniert das schon auf allen Portalen?` → `Noch nicht. Die aktuelle kontrollierte Demo zeigt einen begrenzten Ablauf. Öffentliche Quellen und Kontaktwege werden einzeln geprüft; die illustrative Geschichte auf dieser Seite kontaktiert niemanden.`

---

### 5.2 `/explore` — Market explorer — `src/routes/public/ExplorePage.tsx` (`ExploreContent`)
Wrapper: `<PublicHeader/> <main><ExploreContent/></main>`. Root `div.wrap.rs-explore`. Styling **G** (+ **D**
only in the `/app/explore` variant). Copy: **EN throughout.**
**Classification: (b) for the whole route** — no explorer surface exists in the prototype.

| Panel | Component / markup | Controls | Copy | Data |
| --- | --- | --- | --- | --- |
| Page header | `PageHeader` | — | title `Market explorer`; meta `Live index` (pulsing dot) + `{n} indexed signals` | `api.signals.list` length |
| Coverage notice | `CoverageTrustNotice compact` | — | **Observed online coverage, not total market availability.** ` Offline offers and sources that require an unconnected account may be missing.` | static |
| Tools bar `.tools.rs-explore__tools` | `input.input#explore-location` (sr-only label `Location`, placeholder `City`, default from `?city=` else `Stuttgart`); `div.seg[role=group]` aria `Signal side` with `All`/`Supply`/`Demand`; `SelectField` aria `Sort signals` (`Most relevant`, `Newest`); `button.btn.btn-s.rs-explore__save` | 4 | `Save this search` (Bookmark icon) | **server**: the location input and the side segment are query args — `api.signals.list {city: location.trim() \|\| undefined, side: side === "all" ? undefined : side, limit: 50}` — so changing either refetches. Only the sort is local state. |
| Filter chips `.fchips[aria-label="Search filters"]` | 6 × `button.fchip` with `aria-pressed` | 6 | `Fixed monthly`, `Hourly`, `≤ €250/month`, `Evenings`, `Storage`, `Fresh this week` | client-side filter over the fetched `signals` |
| Result count `.rescount` | — | — | `<b>{n}</b> signals in {location or "all indexed locations"}` and `Public, provenance-linked observations` | derived |
| Loading empty state | `EmptyState` | — | `Loading signals…` / `RoomScout is loading the current public index.` | `signals === undefined` |
| Empty state | `EmptyState` | — | `No matching signals yet` / `No indexed signal currently matches this location and filter combination. Try removing a filter or searching another city.` | — |
| Result grid | `div.list.rs-signal-grid` → `SignalCard` per signal | card links + footer | see §8 `SignalCard` | `publicSignalToMarketSignal(...)` |
| Save gate dialog | `ActionDialog` | `Not now`; unauth: `Create account` → `/sign-up`, `Sign in` → `/sign-in`; auth: `Save draft search` / `Saving…` | title unauth `Save it to your account` / auth `Review before saving`; body unauth `Sign in so RoomScout can preserve this search and alert you. Browsing remains public.` / auth `The current city and supported filters will become an editable draft search. Your Scout can refine it with you before activation.` | `api.savedNeeds.create` |
| Save error | `p.rs-form-error[role=alert]` (unstyled) | — | `Add a city before saving this search.` or `The search could not be saved.` | — |

Client-side filter semantics (`Fixed monthly` ⇒ arrangement `permanent`/`shared`; `Hourly` ⇒ arrangement
`hourly`; `≤ €250/month` ⇒ `pricePeriod==="month" && priceEur<=250`; `Evenings` ⇒ `/evening|abend/i` and
`Storage` ⇒ `/storage|lager/i` over `requirements`; `Fresh this week` ⇒ `lastSeenAt` within 7 days).
Sorting: `relevant` = verified first, then recency; `newest` = `lastSeenAt` descending.

Save flow (`saveSearch`, authenticated branch): `api.savedNeeds.create` is called with
`title: \`Rehearsal-room search in ${city}\``, `city`, `districts: []`,
`arrangement: [...(Fixed monthly ? ["permanent","shared"] : []), ...(Hourly ? ["hourly"] : [])]`,
`schedule: Evenings ? ["Evenings"] : []`, `requirements: Storage ? ["Storage"] : []`,
`maxBudgetEur: ≤ €250/month ? 250 : undefined`. The other two chips (`Fresh this week`, and the sort) are
**not** carried into the draft. On success the dialog closes and the page **navigates to `/app/search`**.

### 5.3 `/app/explore` — `AppExplorePage`
Identical `ExploreContent` with `authenticated` inside `<WorkspaceShell mode="musician">`.
Visual delta comes only from **D** overrides (pill buttons, 22 px cards, 12 px inputs). **(b)**.

---

### 5.4 `/signals/:signalId` — Signal detail — `src/routes/public/SignalDetailPage.tsx`
`<PublicHeader/>` + `main.wrap.rs-signal-detail`. Styling **G**. Copy **EN**. **Classification: (b)** —
no signal-detail screen exists in the prototype (the prototype's room detail is the offer card inside Scout).

| Panel | Markup | Copy / data |
| --- | --- | --- |
| Loading | `EmptyState` | `Loading signal…` / `RoomScout is loading the current record and its provenance.` |
| Not found | `Link.back` + `EmptyState` | `Back to explorer`; `Signal not found` / `This signal is not public, no longer available, or the link is invalid.` |
| Back link | `Link.back` → `/explore` | `Back to explorer` (ArrowLeft) |
| Badge row | `SignalBadge` | `Supply`/`Demand` ` · ` + `Observed`/`Source verified`/`User verified`/`Conflicting sources`; extra chip `Controlled demo` when `isDemo` |
| Head row | `.headrow` `h1` + `Freshness` | signal title; freshness label e.g. `Checked 3 h ago`, `Last seen 2 d ago` |
| Location line | `.lloc` | `{city · district}` + ` · {arrangement}` |
| Known facts card | `LedgerCard` header `span.type.t-{side}` `Known facts` | `Table.facts` rows Price / Arrangement / Requirements (`Not stated` italic when unknown) + summary `<p>` |
| Unknowns card | `LedgerCard` header `Unknown or unclear` | `ul.rs-unknown-list` of `li.check` with `HelpCircle`, else `No unresolved fields were recorded during normalization.` |
| Freshness section | `h2.sub#freshness-heading` + `.timeline` (3 cells) | `Freshness`; `First observed`, `Last checked`, `Index status` (`Possibly stale` / `Published`) |
| Fit card | `LedgerCard accent` header `Fit — sign in for yours` | `Create or activate a saved search to see structured match reasons and uncertainties for this signal.` |
| Provenance card | `LedgerCard` header `Provenance` | `Table.facts`: `Source`, `Evidence records`, `Verification`; `p.evidence` excerpt; `a.btn.btn-s.btn-sm` `Open source` (ExternalLink, new tab) or `No public evidence excerpt is attached to this record yet.` |
| Actions | `.actions` | `Ask Room Scout about this` → `/app/scout?mode=signal_advisor&signalId=…`; `Save` (Bookmark) opens gate |
| Boundary note | `p.mono` | `Exact recipient and message approval is required before any inquiry is sent.` |
| Sign-in gate | `ActionDialog` | title `Continue with your Scout`; body `Sign in so RoomScout can keep your search, Scout thread, saved signal, and approvals together.`; footer `Not now` / `Create account` / `Sign in` (with `returnTo`) |

Note: the `Ask Room Scout about this` deep link is the only consumer of `mode=signal_advisor` → **(c)**
(the prototype Scout has no "advise me about this listing" entry point).

---

### 5.5 `/map` and `/app/map` — `src/routes/MapPage.tsx`
Public variant `<PublicHeader/> <main>{content}</main>`; workspace variant `<WorkspaceShell mode="musician">`.
Root `section.wrap.rs-explore`. Styling **G** + **M** (`MarketGlobe.module.css`). Copy **EN**.
**Classification: (b)** — no map surface in the prototype (only the word „Karte“ as a Landing-v2 footer link).

| Element | Markup | Copy / data |
| --- | --- | --- |
| Page header | `PageHeader` | eyebrow `Observed public coverage`; title `RoomScout coverage map`; meta `{n} positioned signals` when a city is selected, otherwise `{n} positioned markets` |
| Coverage notice | `CoverageTrustNotice` (full) | as above |
| Tools | `SelectField` aria `Market city` (`All market areas` + one option per `api.map.listAreas`); `.seg` `All/Supply/Demand`; `button.fchip` `Fresh only`; `button.fchip` `Verified only` | filters feed `api.map.listPins` |
| Loading | `div.rs-route-state` | `Loading the live market index…` |
| Empty | `div.rs-route-state.rs-route-state--panel` | `No geocoded signals match these filters yet. Signals remain usable even when a location cannot be positioned.` |
| Suspense fallback | `div.rs-route-state` | `Loading the interactive map…` |
| Globe | lazy `MarketGlobe` | see §8 |

**Two modes.** `api.map.listPins` is `"skip"`ped until a city is chosen, so the default view is an *area* view:
one aggregate marker per market from `api.map.listAreas`. Choosing a city switches to per-signal pins
(`{city, side, freshOnly, verifiedOnly, limit: 250}`). The props passed to `MarketGlobe` follow the same
condition: `autoRotate={!city}`, `initialZoom={city ? 9 : undefined}` (component default `2.5`),
`initialCenter={city && mapSignals[0] ? mapSignals[0].coordinates : undefined}` (component default
`GERMANY_CENTER = [10.4515, 51.1657]`). The header meta switches `signals`/`markets` on the same condition.

Derived strings produced by `MapPage` itself (all EN):

| Field | Pin view (a city is selected) | Area view (default) |
| --- | --- | --- |
| `title` | `pin.title` | `{city} market area` |
| `locationLabel` | `{district}, {city}` (empty parts dropped) | `{city}` |
| `source` | `Public source` when `pin.sourceUrl` exists, else `Indexed source` | `RoomScout market index` |
| `freshnessLabel` | `freshnessLabel(lastSeenAt, status==="stale")` | same helper on `area.lastSignalAt`, or `No freshness data` when absent |
| `summary` | `{verification} · {arrangement} · published exact location` \| `… · approximate {precision} location` (`precision.replace("_"," ")`) | `{n} supply · {n} demand · {n} verified` |

`freshnessLabel(lastSeenAt, stale)` → `Possibly stale` (stale) · `Checked within the hour` (< 1 h) ·
`Checked {n} h ago` (< 24 h) · `Checked {n} d ago`.

---

### 5.6 `/sign-in` and `/sign-up` — `AuthRoute` → `src/routes/public/AuthPage.tsx`
`<PublicHeader/>` + `main.center.rs-auth-page` + `LedgerCard.authcard`. Styling **G** + **D**
(`.rs-auth-page` 26 px radius, `rgb(24 20 17 / 82%)`, pill buttons; `.rs-auth-intro` 34 px h1).
Copy: **MIXED** — the intro block is German, the whole form is English.
**Classification: (c)** — the prototype has „Demo-Login“ / „Demo-Anmeldung“ inside Settings, but no
dedicated sign-in page; the German intro copy is prototype-flavoured, the English form is legacy.

| Element | Markup | Copy | Lang |
| --- | --- | --- | --- |
| Card eyebrow | `span.type.t-scout` | `Dein persönlicher RoomScout` | DE |
| Intro h1 | `.rs-auth-intro h1` | sign-up `Euer nächster Raum beginnt hier.` / sign-in `Schön, dass du wieder da bist.` | DE |
| Intro p | | sign-up `Ein Gespräch. Ein Suchauftrag. Dein Scout bleibt dran.` / sign-in `Deine Suche und eure Gespräche warten auf dich.` | DE |
| Context strip | `.ctx` + Bookmark | `Your current search can continue after authentication.` | EN |
| Username field | `label.flabel` + `input.input[autoComplete="username"]` | `Username`, placeholder `e.g. vierteltakt` | EN |
| Password field | `.pwrow` + `.pwtoggle` (Eye/EyeOff); `input[minLength=10][maxLength=100]`, `autoComplete="new-password"` (sign-up) / `"current-password"` (sign-in) | `Password`; aria `Show password` / `Hide password`; hint rendered as `{MIN_PASSWORD_LENGTH}–{MAX_PASSWORD_LENGTH} characters. No spaces at the beginning or end.` ⇒ literally **`10–100 characters. No spaces at the beginning or end.`** | EN |
| Confirm (sign-up only) | `input[autoComplete="new-password"]` | `Confirm password` | EN |
| Errors | `p.err.visible[aria-live=polite]` (`.visible` has no CSS rule — see §3.6) | `Enter a username.`, `Use at least {n} characters.`, `Use no more than {n} characters.`, `The passwords do not match.`, `Authentication is not connected in this presentation-only route yet.`, or the mapped Convex error from `features/auth/errors.ts` (full list below) | EN |
| Submit | `button.btn.btn-p` | `Please wait…` / `Create account` / `Sign in` | EN |
| Mode swap | `p.swap` + `button.rs-link-button` | `Already have an account? ` / `New here? ` + `Sign in` / `Create an account` | EN |
| Escape hatch | `Link.mono.rs-auth-page__back` → `/explore` | `Continue browsing without an account` | EN |

Mode is inferred from the pathname (`…sign-up` ⇒ sign-up) and can be toggled in place without navigating —
so `/sign-in` can render the sign-up form.

#### `features/auth/errors.ts` — constants and the complete error dictionary (all **EN**)
`MIN_PASSWORD_LENGTH = 10`, `MAX_PASSWORD_LENGTH = 100`. `authErrorMessage(userError)` maps a Convex
`userError.error` code to exactly one string:

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
| `RATE_LIMITED` | `Too many attempts. Try again in {n} second.` / `… {n} seconds.` (`n = max(1, ceil(retryAfterMs/1000))`, singular only at 1) |
| `INVALID_PASSWORD` | `Choose a valid password.` |
| `INVALID_USERNAME` | `Choose a valid username.` |
| `OTHER_ERROR` | `An unexpected authentication error occurred. Please try again.` |
| (default) | `Authentication failed. Please try again.` |

---

## 6. Musician (authenticated) routes

### 6.1 `/app/scout` — `src/routes/musician/ScoutPage.tsx` (749 lines)
Inside `<WorkspaceShell mode="musician">`; the shell adds `--scout` modifier so `main` loses top padding.
Root `section` uses **M** `ScoutPage.module.css` (own radial-gradient `:before`, centered flex stages).
Copy: **MIXED** — the shell/stage copy is German, the results/attention/activity blocks are English.
**Classification: (a)** for the German stages, **(c)** for the English result cards and the activity `<details>`.

The page renders one of **three exclusive stages** driven by
`getScoutWorkspaceMode(need, matches, opportunities)` (`src/features/scout/viewModel.ts`):
`discovery` (need is draft) → `paused` → `attention` (open opportunity uncertainty) → `results` (matches) → `waiting`.
A local override promotes `waiting` → `results` when a provider conversation has an `offer`.

#### Stage 0 — no need yet
`div.center` with `ScoutBlob active={!error}`, `p.greeting` rendering `{error || "Dein Scout macht sich
bereit …"}` — i.e. an error **replaces** the greeting rather than being added below it — plus, only when an
error exists, `button.ghost` `Erneut versuchen` (retries `savedNeeds.getOrCreateDraft`). **(a)**

#### Topline (all stages except voice) `header.topline`
- `span.status` with `i.dot`: `Wir lernen euch kennen` (discovery) / `Suche pausiert` (paused) /
  `Autopilot aktiv` (mandate is outreach/negotiation autopilot) / `Begleitete Suche` — **DE**, **(a)**
- `nav.topActions` → `Link.ghost` → `/app/settings` with `Settings2` icon, label `Einstellungen` — **DE**, **(a)**

#### Stage 1 — `discovery`
| Element | Copy | Lang | Class |
| --- | --- | --- | --- |
| `ScoutBlob` (animated orb, `active` while sending, `compact` in review) | — | — | (a) |
| `p.greeting` | `Hey {name}.` → in review `Aus unserem Gespräch`. `name = currentUser.displayName ?? currentUser.username ?? "there"` — with neither set the German line reads **`Hey there.`** | DE (with an EN fallback name) | (a) |
| `h1.title` | `Euer Proberaum beginnt mit einem Gespräch.` → in review `So suche ich für euch.` | DE | (a) |
| `p.subtitle` | `Erzählt mir, was euch wichtig ist. Ich kümmere mich um die Suche.` | DE | (a) |
| Entry buttons `.entryActions` | `Mit Scout sprechen` (Mic, disabled until thread exists) · `Lieber schreiben` (MessageSquare) | DE | (a) |
| Text mode | `ScoutConversation` with 3 EN starters: `We need a permanent room for our band`, `We are open to sharing with a compatible band`, `Help me work out what matters before we search`. The starters are passed as `starters={paginatedMessages.results.length ? [] : starters}`, so they are visible **only while the thread has no persisted messages** and never come back. | EN | (c) — prototype starters are German |
| Fact rail / collapsed brief | `ScoutFactList` (rail, when text open) or `ScoutBrief` (collapsed pill; both in §8) — the whole block, including the review trigger below, renders **only when `facts.length > 0`** | DE | (a) |
| Review trigger | `button.ghost` `Suchauftrag ansehen` (same `facts.length` guard) | DE | (a) |
| Import trigger | `button.quietButton` `Musik-Kontext aus ChatGPT oder Claude mitbringen` | DE | (a) — prototype „Kontext importieren“ |
| Review card `.reviewCard` | `ScoutFactList expanded` + `button.primary` `Scout losschicken` / `Scout startet …` (disabled while working or `!need.city.trim()`) + `p.hint` `Ich suche und frage im Rahmen eures Auftrags selbstständig an. Eine verbindliche Zusage gebt nur ihr.` + `button.quietButton` `Noch etwas ändern` | DE | (a) |
| Error | `p.error[role=alert]` | DE (see below) | (a) |

`readableError()` produces exactly two strings:
`Kurz durchatmen: Bitte versuche es in einer Minute noch einmal.` (rate limit) and
`Der Scout konnte diesen Schritt gerade nicht abschließen. Bitte versuche es erneut. Dein Suchauftrag bleibt gespeichert.`

#### Stage 2 — `paused` / `attention` / `results` / `waiting` (`div.workspace`)
| Element | Copy | Lang | Class |
| --- | --- | --- | --- |
| `ScoutBlob active={sending \|\| working} compact` — first child of the workspace in **every** non-discovery stage | — | — | (a) |
| `h1.workspaceTitle` | paused `Eure Suche macht eine Pause.` · attention `Eine kurze Rückfrage an euch.` · results `Diese Räume könnten passen.` · waiting `Ich kümmere mich darum.` | DE | (a) |
| `p.workspaceText` | paused `Euer Suchauftrag bleibt gespeichert. Macht weiter, wenn ihr bereit seid.` · waiting `Ich behalte passende Räume in {need.city oder "eurer Gegend"} im Blick. Ihr könnt die App schließen.` · results `Hier findet ihr die aktuellen Treffer und Antworten zu eurem Suchauftrag.` · attention `Ein Detail ist noch offen. Sagt mir, was für euch passt.` | DE | (a) |
| Attention card `section.attention` | label `Open question`; `h2` = `attention.uncertainties[0]`; `p` = `attention.reasons[0] ?? "Scout needs your preference before proceeding."`; up to 2 buttons all labelled `Discuss this with Scout` (sends `About the current opportunity: {question}`) | **EN** | (c) — prototype uses German „Passt das für euch?“ + concrete Ja/Nein buttons |
| Results grid `.results` | up to 2 `ProviderOfferPanel` + up to 6 `article.result` cards | EN | (c) |
| Result card | meta = `{verification}` + `{n} source(s)`; `h2` title; `p` `{district, city}`; facts chips `€{price} / {period}` + up to 2 `match.reasons`; `p` summary; buttons `Ask Scout to inquire`, `Dismiss` | **EN** | (c) |
| Waiting/paused quiet line | `Your search is paused. Resume it to refresh your matches.` / `No current matches for {need.city} yet.` — with an empty `need.city` this reads `No current matches for this search yet.` | **EN** | (c) |
| Activity `<details class=activity>` | summary `What Scout is doing`; items `Subscribed to live matches for this search`, `Reading the current index…` / `{n} current matches`, `Checking opportunities…` / `{n} open opportunities` | **EN** | **(b)** — debug affordance, no prototype counterpart |
| Entry actions | `Mit Scout sprechen` · `Nachricht schreiben` / `Chat schließen` | DE | (a) |
| Conversation | `ScoutConversation compact` (no starters) — rendered only when `textOpen` | — | (a) |
| Error (no conversation open) | when `textOpen` is **false** and `error` is set, a `p.error[role=alert]` renders in the conversation's place with the same two `readableError()` strings as the discovery stage | DE | (a) |
| Brief | `ScoutBrief` collapsed pill | DE | (a) |
| Bottom `.topActions` | `Aktualisieren` (RefreshCw, only when `need.status==="active"`, calls `api.matches.recomputeMine`) · `Fortsetzen`/`Pausieren` (Pause icon) | DE | (a) for pause/resume; (c) for the manual refresh |

#### Stage 3 — `voiceStage`
Full-bleed `RealtimeVoiceScout` (see §8). Ending it calls `finishVoice()` → closes voice, opens the review card
if facts exist.

#### Dialogs mounted on this page
- `ContextImportDialog` (see §8) — **EN**, **(a)** (prototype „Kontext importieren“ exists in Settings)
- `ApprovalComposer` — rendered only when a `draftSignal` + matching outreach draft exist — **EN**, **(c)**

#### Data reads/writes
Queries (with their exact arguments): `users.current`, `savedNeeds.listMine {limit: 10}`, `scout.getMine`,
`memory.listMine`, `scout.listMessages {threadId}` via `usePaginatedQuery` with `{initialNumItems: 60}`,
`matches.listMine {savedNeedId, limit: 30}`, `opportunities.listMine {savedNeedId, limit: 20}`,
`providerConversations.listMine {limit: 30}` (then filtered **client-side** to `row.savedNeedId === need._id`),
`outreach.listMine {limit: 50}`, `mandates.getActiveMine {savedNeedId}`. Every `savedNeedId`-scoped query is
`"skip"`ped until `need` exists.
Mutations/actions: `savedNeeds.getOrCreateDraft`, `scout.getOrCreateThread`, `savedNeeds.setStatus`,
`mandates.enableDefaultAutopilot`, `scout.setFocus`, `matches.updateStatus`, `scout.sendMessage`,
`matches.recomputeMine`.

How `need` is chosen: the row whose `_id === scoutContext.activeNeedId` **and** `status !== "archived"`,
else the first row with `status !== "archived"`. A `useEffect` calls `savedNeeds.getOrCreateDraft()` (once,
guarded by `initDraftRef`) when `needs` has loaded and **every** row is archived; a second effect calls
`scout.getOrCreateThread({activeNeedId: need._id})` whenever the active need differs from `scoutContext`.
`threadId` is read from `scoutContext.threadId` only while `scoutContext.activeNeedId === need._id`.

Local state rules worth reproducing:
- `voiceOpen` is initialised to `voice.connected`, so navigating to `/app/scout` **during an ongoing call
  opens the voice stage immediately**.
- `textOpen`, `reviewOpen`, `contextImportOpen`, `draftSignal` all start closed/undefined.

URL params consumed: `?mode=search_discovery|signal_advisor|outreach_drafting` and `?signalId=`.
Fallback intro message (English): `I have your saved music context. Tell me what kind of rehearsal situation you want now.`
or `Tell me about your band and the room you need. I’ll turn the useful details into a search you can review.`

Message sent to the Scout thread by `Ask Scout to inquire` (`prepareOutreach`) — appears verbatim as a **user**
message in the conversation, note the typographic quotes:
`Handle the next appropriate inquiry about “{signal.title}”. Use only the active persisted mandate for eligible non-binding outreach. Any commitment or human-only step must come back to me.`
(The attention card's send string is the shorter `About the current opportunity: {question}`.)

#### `ScoutPage`'s own `marketSignal()` — a second signal-display vocabulary
`ScoutPage.tsx:281–330` converts a `match` into the `MarketSignal` that feeds the result cards and
`ApprovalComposer`. It does **not** reuse `convexAdapters.publicSignalToMarketSignal` (§8) and produces
different strings for the same data:

| Field | `ScoutPage.marketSignal()` | `convexAdapters.publicSignalToMarketSignal()` |
| --- | --- | --- |
| freshness label | `Possibly stale` (stale) · `Checked within the hour` (< 1 h) · `Checked {n} h ago` | `Checked {n} min\|h\|d ago` / `Last seen …` / `Checked just now` |
| arrangement | `Fixed monthly` (permanent) · `Shared` · `Hourly` · `undefined` when unknown | `Permanent` · `Shared` · `Hourly` · `Arrangement unknown` |
| source | `{n} public source(s)` | `{n} indexed source(s)` |
| firstSeen | `First seen {toLocaleDateString()}` (absolute) | `First seen {n} min\|h\|d ago` (relative) |
| facts | `[]` when no price, else one `Price` row `€{n} / {period ?? "unknown"}` | always `Price` (`Not stated` when unknown), `Arrangement`, `Requirements` (`Not stated` when empty) |
| fit | `[...match.reasons, ...match.uncertainties.map(u => \`Uncertain: ${u}\`)].join(" · ")` | passed in by the caller |

---

### 6.2 `/app/search` — "My search" — `src/routes/musician/MySearchPage.tsx`
Inside musician shell. Styling **G** + **D**. Copy: **EN throughout** (the shell nav calls it „Euer Suchauftrag“).
**Classification: (c)** — the prototype has „Euer Suchauftrag“ as a *card inside Scout* and „Handlungsspielraum“
inside Settings, not a separate ledger page. Almost every panel here has a prototype home elsewhere.

| Panel | Component | Controls | Copy | Data |
| --- | --- | --- | --- | --- |
| Loading | `PageHeader` + `EmptyState` | — | `My search`; `Loading your search…` / `RoomScout is loading your saved criteria and current matches.` | — |
| No search | `EmptyState` + `Link.btn.btn-p` | 1 | `No saved search yet` / `Talk to your Scout to turn your rehearsal-room needs into an editable search.`; `Start with your Scout` | — |
| Page header | `PageHeader` | pause/resume `btn.btn-g.btn-sm` | title `My search`; meta `Convex live query` + `Pause`/`Resume`/`Updating…` | `savedNeeds.setStatus` |
| Tabs | `div.rs-page-tabs[aria-label="Search sections"][role=tablist]` | 3 buttons | `overview`, `sources` (+ ` · {n}` indexed signals), `activity` — lowercase, CSS `text-transform: capitalize` | `?tab=` |
| Error | `p.rs-form-error[role=alert]` | — | the complete set: `The search status could not be changed.` (toggle pause/resume), `The match could not be updated.`, `The source preference could not be saved.`, `The mandate could not be updated.` (`changeMandateStatus` — on/off/emergency stop), `The mandate could not be saved and activated.` (`saveMandate` — also re-thrown so `MandatePanel` shows it inside the dialog) | — |
| **overview** left | `SearchProfileCard search={search}` — **only** that prop, so its pencil `Edit {label}` buttons never render and its draft `Confirm search` button has no `onConfirm` handler (it renders for drafts but does nothing) | none reachable | see §8 | `savedNeedToSearch(need)` |
| | `Link.btn.btn-s` | 1 | `Edit with Scout` → `/app/scout?mode=search_discovery` | — |
| | `MandatePanel` (or `EmptyState` `Loading Scout mandate…` / `Loading the active version and authorization limits.`) | many | see §8 | `mandates.getActiveMine` |
| | `LedgerCard` `Updates` | — | rows `Channel`→`In-app notifications`, `Cadence`→`As matches and replies arrive`, `Decision point`→`Agreements, bookings, or money` | static |
| **overview** right | `LedgerCard accent` `Current matches` + `{n} live` | — | `Matches use structured constraints plus semantic compatibility. Unknown facts remain visible as uncertainty.` | `matches.listMine` |
| | draft state | — | `Search is still a draft` / `Finish and activate the draft with your Scout before RoomScout starts matching it.` | — |
| | empty | — | `No matches yet` / `No indexed signal currently clears this search's match threshold. RoomScout will update this page when the index changes.` | — |
| | match card `LedgerCard` | 3 buttons | header `{side} · {status}` + city; footer `{n}% match` + `Room signal` / `Potential band connection`; reasons `ul`; `Still unclear: …`; actions `Open detail` → `/signals/{id}`, `Save`, `Dismiss` | `matches.updateStatus` |
| **sources** | `SearchSourcesPanel` (or `EmptyState` title `Loading source coverage…` / body `Loading reviewed source coverage and your saved source preferences.`) | include/exclude toggles | see §8 | `searchSources.listForNeed {savedNeedId, limit:100}`, `signals.list {city, limit:50}` |
| **activity** | `LedgerCard` `Search activity` + `Persisted search + match events` | — | `ol.stream.rs-event-stream` rows `Search updated — {title}` + status pill, then per match `New match` / `Match updated` — `{signalTitle}` + `{n}%` pill; times via `Intl.DateTimeFormat` medium/short | derived |

Mandate mapping (page-local): UI modes `guided/research/outreach/negotiation` ↔ backend
`guided/research_autopilot/outreach_autopilot/negotiation_autopilot`; `propose_visit` ↔ `propose_visit_time`;
default draft mandate = negotiation, 10 contacts/day, 30 browser min/day, 30-day expiry,
`allowedActionTypes: ["send_email","submit_webform","send_platform_dm","create_portal_account","publish_listing","propose_visit"]`,
`dataScopes: ["band_name","reply_email","availability","budget","music_profile"]`.

**`stopConditions` strings** (rendered as the `Stop conditions` list inside `MandatePanel`'s advanced
dialog, §8 — they are user-visible copy, not backend values). Two producers build them, and their draft
defaults differ by one string:

| Case | Strings |
| --- | --- |
| Active persisted mandate (both producers, identical) | `A complaint is received` when `stopOnComplaint`, else `Complaint stop disabled`; and `A suitable room is confirmed` when `stopWhenSuitableRoomConfirmed`, else `Confirmation stop disabled` |
| Draft default — `MySearchPage.tsx:184` | `Search is paused`, **`A login or human-only step is required`**, `A suitable room reaches agreement handoff` |
| Draft default — `SearchControlSettings.tsx:222–226` | `Search is paused`, **`A human-only step is required`**, `A suitable room reaches agreement handoff` |

Two more strings diverge between the same pair of producers and must be unified in the port:

| String | `MySearchPage` | `SearchControlSettings` |
| --- | --- | --- |
| Source-note coverage fallback | `` `${states.join(" + ") \|\| "Coverage status unavailable"} · {n}% confidence` `` | `Coverage unavailable` in the same position |
| Sources-tab save error | `The source preference could not be saved.` | `The source preference could not be saved. Your previous setting is still in effect.` |
| `lastCheckedLabel` formatting | `Intl.DateTimeFormat(undefined, {dateStyle:"medium", timeStyle:"short"})` | `new Date(...).toLocaleString()` |

---

### 6.3 `/app/inbox` — `src/routes/musician/MusicianInboxPage.tsx`
Inside musician shell. Layout `div.threepane.rs-inbox` (245 px | 1fr | 270 px). Styling **G** + **D**
(`.rs-consumer-workspace .rs-inbox` rounds it to 22 px, `.titem` to 14 px with 6 px margin).
Copy: **MIXED** — headers/empty states German, everything functional English.
**Classification: (b)** for the three-pane tool and its advanced ledger; **(c)** for the German framing copy
(„Nachrichten“, „Du hast das letzte Wort.“) which does echo the prototype's tone.

| Region | Element | Copy | Lang |
| --- | --- | --- | --- |
| Filter bar `.rs-inbox-filterbar` | `h1` + `p` | `Nachrichten` / `Alle Gespräche zu eurer Suche. Dein Scout bleibt für euch dran.` | DE |
| | `.fchips[aria-label="Inbox channel"][role=tablist]` 5 chips | `all`, `needs action`, `email`, `webform`, `platform dm` (rendered via `replaceAll("_"," ")`) | EN |
| Pane 1 `.pane.rs-inbox__threads` | `header.phead` | `Gespräche` + count | DE |
| | loading hint | `Loading your communication threads…` | EN |
| | thread `button.titem` | `.who` subject + status; `.prev` icon + `Email`/`Platform DM`/`Web form` + participants or `participants not exposed`; timestamp | EN |
| | empty | `Hier ist es noch ruhig. Sobald ein Gespräch beginnt, erscheint es hier.` | DE |
| Pane 2 email thread | `header.phead` | `{subject}`; `Email · {status}`; `Live thread` | EN |
| | `article.mail(.out/.in)` | `You → {to}` / `{from} → You` (+ ` · {deliveryStatus}`); body prefixed `Subject: …\n\n` | EN |
| | delivery event | `Delivery update · {status}` | EN |
| | parsed block `section.parsed` | `Scout · Parsed reply`; `AI interpretation · original stays above`; facts list; `p.fitline` summary | EN |
| | `.cactions` | `Draft reply with Scout` → `/app/scout?mode=outreach_drafting`, `Ask Scout`, `Update search` | EN |
| Pane 2 platform thread | header | `{subject ?? "Platform conversation"}`; `Platform DM · {status}`; `Synced thread`; empty `No messages in this thread` / `The platform thread exists, but no persisted messages were returned.` | EN |
| | `.cactions` | `Draft platform reply`, `Ask Scout` | EN |
| Pane 2 web-form action | header | subject field or `Web-form outreach`; `Web form · {status}`; `Persisted action`; the single `article.mail.out` carries the header `Prepared for {hostname of payload.targetUrl}`; body = `{label ?? name}: {value}` pairs joined by blank lines; `Action state · {status}` (+ ` · {error}` when set) | EN |
| | `.cactions` | `Review exact form` (only when `awaiting_approval`), `Ask Scout` | EN |
| Pane 2 empty | `EmptyState` | title `Platz für gute Nachrichten.` / body `Wähle links ein Gespräch. Hier findest du den Verlauf und neue Antworten.` | DE |
| Pane 2 loading | `EmptyState` | `Loading conversation…` / `Fetching persisted messages from the selected channel.` | EN |
| Pane 3 `.pane.ctx.rs-inbox__context` (hidden ≤1050 px) | `ProviderOfferPanel` when a provider conversation matches | see §8 | EN |
| | mailbox section | `Scout mailbox`; `mailbox.emailAddress` or `Provisioning…` (status `provisioning`) / `Created on first outreach`; status chip `span.mono.rs-brand-accent` = `mailbox.status ?? "Not provisioned"` | EN |
| | boundary section | `Du hast das letzte Wort.` / `Dein Scout kümmert sich um unverbindliche Gespräche. Zusagen, Buchungen und Zahlungen bleiben bei dir.` | DE |
| | `<details class=rs-inbox-advanced>` | summary `Advanced activity`; sections `Selected channel` (Type/Storage table, both cells `—` with no selection; Storage values `AgentMail thread` / `Platform thread` / `External action ledger`), `Account & verification mail` → `MailboxVerificationPanel`, `External action ledger` → `ActionLifecyclePanel` (`actionRows.slice(0,10)`), `Opportunities` → `Loading…` while `opportunityRows === undefined`, then up to 3 `OpportunityHandoff` or `No persisted opportunity is ready for handoff.` | EN |
| Dialog | `ActionApprovalSheet` | see §8 — the page always passes `authorization: {mode:"approve_once"}` and no `onPauseMandate`, so the sheet's standing-mandate branch is unreachable here | EN |

Errors surfaced as `p.rs-form-error[role=alert]`: `The handoff could not be persisted.`,
`The exact action decision could not be persisted.`, `The approved provider action could not be started.`,
`The human completion state could not be saved.`, `The mailbox message status could not be saved.`,
`This action does not have a supported provider executor.`

Web-form "threads" are synthesized client-side from `externalActions.listMine` rows whose payload kind is
`contact_form` — a channel that exists only in this page. Their `subject` is the first field whose `name`
contains `subject`, else `Web-form outreach`; their `participants` is `[hostname of payload.targetUrl]`.

#### `needs action` filter semantics and thread selection
`needs_action` is not a channel — it is a per-channel status test (`MusicianInboxPage.tsx:76–85`):

| Channel | Passes `needs action` when `status` is |
| --- | --- |
| webform | `awaiting_approval`, `failed`, or `executing` |
| email | `replied` or `failed` |
| platform | `open` |

The other four chips are plain channel filters (`all`, `email` ⇒ `channel==="email"`, `webform`,
`platform dm` ⇒ `channel==="platform"`). Threads from all three channels are merged and sorted by
`lastMessageAt` descending before filtering.

Selection: there is no "nothing selected" state once threads exist. `effectiveThread` is the explicit
`selectedThread` **only while it is still in `visibleThreads`**; otherwise it falls back to
`visibleThreads[0]`. Clicking any filter chip also calls `setSelectedThread(undefined)`, so changing a
filter always jumps to the first visible thread.

#### Derived / user-visible strings the page generates
| Source | Strings |
| --- | --- |
| `opportunityTitle(kind)` | `Room opportunity` (`supply_match`) · `Potential band collaboration` (`demand_collaboration`) · `Source lead` (`source_lead`) |
| `counterparty` (constant) | `Counterparty identity is not exposed by the opportunity API` |
| `recommendedNextStep` | `The opportunity has been handed off for a human decision.` (status `converted`) · `Review the evidence and unresolved facts before preparing a human handoff.` |
| handoff `summary` sent to `opportunities.createHandoff` | `[opportunityTitle, ...reasons, ...uncertainties.map(i => \`Unresolved: ${i}\`)].join("\n")` |
| `approvalRequest.destination` | recipient email · target URL · `payload.recipients.join(", ")` or `Existing platform thread` · `Portal connection {connectionId}` |
| `approvalRequest.actingAs` | `mailbox.emailAddress ?? "Personal Scout mailbox"` (email) · `Connected portal identity` (all other kinds) |
| `approvalRequest.effect` | `` `${payload.operation} the selected portal account.` `` (portal ops) · `Execute the exact displayed external action once.` |
| `approvalRequest.fields` | email: `Recipient`/`Subject`/`Body` · contact form: one row per field (`label ?? name`) · platform: `Recipients` (or `Existing thread`), optional `Subject`, `Body` · portal op: `Operation`, `Account` (`accountLabel ?? "No account label supplied"`) |

#### Data reads/writes
Queries: `communications.listThreadsMine {limit:50}`, `mailboxes.getMine`,
`providerConversations.listMine {limit:50}`, `opportunities.listMine {limit:20}`,
`externalActions.listMine {limit:30}`, `inbox.listMailboxMessagesMine {limit:10}`, plus one selection-scoped
read: `inbox.getThreadMine {threadId, limit:100}` (email) or `platformInbox.getThreadMine {threadId,
messageLimit:100}` (platform); the web-form "thread" is found inside the already-loaded `actionRows`.
Mutations: `opportunities.createHandoff`, `opportunities.updateStatus`, `externalActions.decide`,
`inbox.updateMailboxMessageStatus`, `externalActions.confirmHumanCompleted`.
Actions: `firecrawlInteract.executeApproved`, `firecrawlInteract.completeApprovedHumanStep`,
`browserbasePortal.executeApprovedWrite`, `browserbasePortal.getApprovedWriteLiveView`,
`browserbasePortal.completeApprovedWriteHumanStep`.

⚠ The shell's `Nachrichten` badge counts `api.inbox.listThreadsMine` while this page lists
`api.communications.listThreadsMine` — **two different endpoints**, so the badge and the list can disagree.

---

### 6.4 `/app/profile` and `/app/settings/:section?` — `src/routes/musician/ProfilePage.tsx` (875 lines)
Both routes render the same component. Section resolution (read):
`params.section ?? ?section= ?? legacy ?tab=` (`connections`→`sources`, `memory`→`knowledge`), default
`sources`; any value outside the seven known ids also falls back to `sources`.
Section **write-back** differs per route (`ProfilePage.tsx:176–180`):
```ts
const setSection = (next) => {
  if (location.pathname.startsWith("/app/settings")) navigate(`/app/settings/${next}`);
  else setSearchParams({ section: next });
};
```
So the same rail navigates on `/app/settings/*` but only writes a `?section=` query param on `/app/profile`
— the two routes behave differently in the URL bar and in browser history.
Frame: `SettingsFrame` (**M** `SettingsFrame.module.css`) inside the musician shell; the frame uses negative
margins (`-24px -48px -80px`) to bleed edge-to-edge.
**Classification: (a)** for the frame + all seven sections (this is the closest thing to `Settings.dc.html`),
with per-panel exceptions noted.

#### `SettingsFrame` chrome (**EN**)
Left rail 248 px, `nav[aria-label="Settings"]`, active item carries `aria-current="page"`, `h2` `Settings`,
two labelled groups:
- `Scout`: `Sources & access` (Database), `Autonomy` (SlidersHorizontal), `What Scout knows` (Brain)
- `Account`: `Profile` (UserRound), `Notifications` (Bell), `Plan & usage` (CreditCard), `Privacy` (Shield)

Content header pairs (`h1` / `p`):
| Section | Title | Description |
| --- | --- | --- |
| sources | `Sources & access` | `Manage the private identities and reviewed portal access RoomScout may use for you.` |
| autonomy | `Autonomy` | `Review what your Scout may do, what still needs approval, and where it must stop.` |
| knowledge | `What your Scout knows` | `Inspect remembered facts and the working context used for your search.` |
| profile | `Your profile` | `The account identity attached to this private RoomScout workspace.` |
| notifications | `Notifications` | `See which product events can currently reach you.` |
| usage | `Plan & usage` | `Availability of billing and metered usage for this workspace.` |
| privacy | `Privacy` | `Understand what is stored, what is not, and which services perform product work.` |

#### Section `sources` — **(a)** frame, **(c)** portal workshop
- `SearchControlSettings view="sources"`. **Both guard states below run before the `view` switch**
  (`SearchControlSettings.tsx:66–88`, the `view === "sources"` branch only starts at line 110), so this
  section shows them too: `Loading search controls…` / `Reading your active search and its live
  authorization state.`, and `Create a search first` / `Source preferences and mandates belong to a
  concrete search, so RoomScout will not create global permissions without one.` +
  `Start with your Scout` (→ `/app/scout?mode=search_discovery`).
- Then `SearchSourcesPanel` (see §8), whose `disclosure` prop is built as
  `` `${coverage?.disclosure ?? "Coverage is based on reviewed sources."} Signal totals are a bounded sample of up to 50 city results; evidence sources is the largest source count attached to one result, not a market-wide total.` ``
  — the literal fallback `Coverage is based on reviewed sources.` is part of the shipped copy.
- Sources-tab save error here is the longer variant `The source preference could not be saved. Your previous
  setting is still in effect.` (see the divergence table in §6.2), and `workingSourceId` is passed, so the
  include/exclude button can show `Saving…` — on `/app/search` it cannot.
- `PortalConnectionsWorkspace` (see §8)
- Confirm dialog `Disable this portal connection?` / description `This affects only the selected portal. Other connected sites keep their own Contexts.` /
  body `RoomScout will stop using this portal and ask Browserbase to delete its persisted Context. This removes the reusable portal session; it does not delete the account on the third-party website.` /
  buttons `Keep connected`, `Disable & delete Context`
- Errors: `The secure portal session could not be started.`, `The controlled portal registration could not be started.`,
  `The portal connection could not be paused.`, `The portal inbox could not be synchronized.`,
  `The portal connection could not be created.`, `The RoomScout email address could not be created.`,
  `The portal connection could not be disabled.`

#### Section `autonomy` — **(a)**
`SearchControlSettings view="autonomy"` → `MandatePanel`, preceded by the same two shared guard states
documented under `sources` above (`Loading search controls…` / `Reading your active search and its live
authorization state.`; `Create a search first` / `Source preferences and mandates belong to a concrete
search, so RoomScout will not create global permissions without one.` + `Start with your Scout`).
Unlike `/app/search`, there is **no** `EmptyState` for a still-loading mandate and no page-level
`p.rs-form-error`: `MandatePanel` surfaces its own `The Autopilot settings could not be saved.` /
`Autopilot could not be updated.` because `SearchControlSettings` does not catch those rejections.

#### Section `knowledge` — **(a)** (prototype „Gespeicherte Angaben“ / „Kontext importieren“)
- Action row `Import music context` (Download icon)
- Status notice `div.rs-memory-notice[role=status]`: `{n} reviewed fact(s) added. Your Scout is rebuilding its working context.`
- Left column
  - `LedgerCard accent` `Working context` + `Version {n}` or spinner + `Learning`; renders
    `rs-memory-summary` + three sections `Musical identity`, `Practical context`, `People + relationships`
    (fallback `Not enough context yet.`), or `EmptyState` `Your Scout is ready to learn` /
    `Tell the Scout about your project, or import context from an assistant that already knows your music life.`
    plus `Build working context now`
  - `grid3.rs-memory-layers`: `Hard constraints`, `Soft preferences`, `Worth asking`
  - `LedgerCard` `Fact memory` + `{n} active facts`; grouped by subject with `chip` = subjectKind; each row shows
    `{predicate} · {category}`, `{value}` (+ ` → {objectName}`), `{verification} · {source} · {n}% confidence`,
    and a `xbtn` `Forget {value}` (Trash2). Empty: `Nothing remembered yet` /
    `Facts you state or approve will appear here. Inferences stay visibly marked.`
- Right column
  - `LedgerCard` `Account` + `Private workspace`: `Username`, `Role`, `Raw import`→`Analyzed, never stored`,
    `Autopilot`→`Non-binding outreach only · commitments stay with you`, `Semantic index`→`{n} / {n} facts ready`;
    conditional `Build semantic index` button (+ `Set OPENAI_API_KEY in this Convex deployment first.` /
    `Semantic memory is up to date.`) — **(b)** developer affordance
  - `LedgerCard` `Memory activity` (Network icon): `ul.stream.rs-memory-events` of `{HH:MM}` + summary + eventType chip,
    else `The event ledger will show what changed and when.` — **(c)**
- Dialogs: `ContextImportDialog`; `Forget this fact?` / `The original memory event remains in the audit trail.` /
  `RoomScout will stop using this fact and rebuild the working context without it.` / `Keep it` · `Forget fact`

#### Section `profile` — **(a)**
`LedgerCard` `Account` + `Private workspace` with rows `Display name` (`Not set`), `Username` (`Loading…`), `Role` (`Musician`).

#### Section `notifications` — **(a)**
`div.plainCard`: h2 `In-app decisions stay visible`; p `Matches, replies, approvals, and required handoffs appear in RoomScout as they arrive. User-configurable email, push, and browser notification preferences are not available yet; RoomScout will not claim permission or delivery it has not implemented.`;
action `Open inbox` → `/app/inbox`.

#### Section `usage` — **(a)**
`div.plainCard`: h2 `Billing is not available`; p `This workspace has no connected billing system, purchasable plan, or user-facing metering ledger. No prices, quotas, or usage totals are shown because RoomScout cannot currently verify them.`

#### Section `privacy` — **(a)**
Two `plainCard`s: `Storage boundaries` (`Reviewed memory facts, searches, approvals, and event metadata may be persisted in Convex. Raw context imports are analyzed but not stored. Raw voice audio, passwords, 2FA values, CAPTCHA answers, cookies, and ephemeral Live View URLs are not stored.`) and
`Services involved` (`Convex stores application state. Firecrawl performs public-web discovery and monitoring. AgentMail handles approved email. Browserbase provides isolated portal contexts. OpenAI performs text reasoning, embeddings, and the approved realtime voice flow.`)

Missing vs prototype Settings: „Demo-Daten exportieren“ / „Export“, „Konto löschen“, „Aktivität im September“,
„Gesprächsverlauf“, „Anzeigename“ editing, „Deine Scout-Adresse“ as its own block.

---

### 6.5 `/app/runs/:runId` — Browser run — `src/routes/musician/BrowserRunPage.tsx`
Inside musician shell, `div.wrap.rs-browser-run-page`. Styling **G** + **M** (`PortalAuthenticationGuide.module.css`).
Copy **EN**. **Classification: (b)** — no Live-View/browser-run screen exists in the prototype.

| Element | Component | Copy / data |
| --- | --- | --- |
| Error | `p.rs-form-error` | `Live View is not available.`, `The authenticated context could not be finalized.`, `The browser run could not be stopped.`, `The browser run could not be restarted.`, `The RoomScout registration address could not be created.` |
| Loading | `p.mono` | `Loading persisted browser run…` |
| Login guide | `PortalAuthenticationGuide` | see §8 |
| Workspace | `BrowserRunWorkspace` | see §8 |
| Footer | `p.mono` + `Link.btn.btn-s` | `Requested run: {runId ?? "none"}`; `Back to connections` → `/app/profile?tab=connections` (legacy query form) |

Run-step labels rendered in the rail (registration flow): `Open isolated Browserbase Context`,
`Register with personal AgentMail address`, `Receive and parse Clerk verification mail`,
`Inject code and persist authenticated session`. Human-login flow: `Session reserved`,
`Human authentication`, `Persist authenticated Browserbase context`.
Run titles: `Scout-assisted portal registration`, `Connect portal account`, `Sync portal inbox`, `Review portal source`;
mandate label `Policy-reviewed portal run`; human prompt
`The controlled automation stopped before an ambiguous or human-only step. Open Live View to review it; RoomScout will not accept terms, solve CAPTCHA, or guess a code.`

---

## 7. Operator routes (`/ops/*`)

All six pages share: `<WorkspaceShell mode="ops">` + `OpsPageHeader` + `OpsWorkspace.css` (**O**).
Copy: **EN throughout** (prototype Operator surface is German).
Header eyebrow on every page: `Internal operator workspace`; per-title descriptions:

| Title | Description |
| --- | --- |
| `Operations overview` | `Provider health, source coverage, and work that needs attention.` |
| `Sources & portals` | `Technical source and portal operations, independent of musician preferences.` |
| `Signal review` | `Inspect the live normalization pipeline and retry bounded failures.` |
| `Outreach control` | `Review external-action state without bypassing a musician’s approval boundary.` |
| `Inbox routing` | `Follow delivery and reply state across approved communication.` |
| `Audit log` | `A bounded, human-readable ledger of approvals and provider events.` |
| (fallback) | `Live operational state from the protected RoomScout backend.` |

Shared formatting helpers `src/routes/ops/opsFormat.ts`: `formatAge` (Intl.RelativeTimeFormat "en", `Never`
when undefined), `formatDuration` (`{n} min` / `{n} hr` / `{n} hr {n} min`), `toneForStatus` → `new` / `warn` / `""`,
`titleCase` (underscores → spaces, Title Case).

### 7.1 `/ops` — `OpsOverviewPage` — **(a)** (prototype „Betrieb im Blick“)
- Loading: `Loading operations…` / `Reading the live Convex operations state.`
- Header meta: chip `Live Convex data` + `Reactive` (pulsing dot)
- Metric grid `div.metrics.rs-metrics-grid` (**M** `OpsOverviewPage.module.css` — 4-col 1 px-gap tile grid) with 12
  `LedgerCard.metric` tiles: `Published signals`, `Stale signals`, `Detail backlog`, `Detail failures`,
  `Pending approvals`, `Replies`, `Unhealthy sources`, `Active voice`, `AgentMail inboxes`,
  `Source platforms`, `New source candidates`, `My portal connections` — from `api.ops.overview.metrics`,
  `sourceIntelligence.listPlatforms`, `sourceIntelligence.listCandidates {status:"new"}`, `portalConnections.listMine`.
  Only **four** of them can take the `warning` tone, and only when their value is `> 0`: `Stale signals`,
  `Detail failures`, `Unhealthy sources`, `New source candidates`. The other eight tiles are always
  untoned, whatever their value.
- `ProviderReadinessPanel` errors bubble up here as `Provider readiness check failed.` (the fallback when the
  `opsActions.providerReadiness` action rejects with a non-`Error`); it is rendered by the panel as `p.err[role=alert]`.
- `LedgerCard` `Work queues` + `Counts capped at {boundedSample}` — six `.qrow` rows each with an `Open` link:
  `Signal detail queue` (`{n} waiting · {n} failed` → `/ops/signals`), `Outreach awaiting approval`
  (`{n} user-controlled drafts` → `/ops/outreach`), `Mail threads with replies` (`{n} live threads` → `/ops/inbox`),
  `Source health` (`{n} degraded or failing` → `/ops/sources`), `Source intelligence`
  (`{n} loaded candidates need review` → `/ops/sources`), `Browserbase portal operations`
  (`{n} of {n} operator-owned connections active` → `/ops/sources`)
- `LedgerCard` `Live activity` + `Firecrawl · AgentMail · Realtime` → `ol.stream.rs-event-stream`, empty state
  `No operations events yet` / `Provider and workflow events will appear after the first controlled run.`
- `ProviderReadinessPanel` (see §8) — **(a)** (prototype „Integrationen“, „Bereit“, „OpenAI direkt“)

### 7.2 `/ops/signals` — `OpsSignalsPage` — **(c)**
Prototype Operator has „Aufgaben“/„Vorgang“/„Diagnose-Sheet“, but not this normalization table.
- Header meta: chip `Live detail pipeline` + `Contact values remain private`
- Filter chips: `All`, `Failed`, `Queued`, `Fetching`, `Processed`, `Not queued` (the `none` filter is relabelled)
- States: `Loading signal queue…` / `Reading the normalized source-entry pipeline.`; `Queue is empty` /
  `The selected pipeline state currently contains no entries.`
- Table `Table.q.rs-review-table` in `div.lcard.rs-review-table-wrap`; columns
  `Entry` (title + city or `Location not extracted`), `Side`, `Source`, `Detail state`, `Last seen`
- Right drawer `aside[aria-label="Signal review detail"].drawer[.open]` (fixed 510 px; bottom sheet ≤650 px),
  heading `{selected.title ?? "Source entry"}` + `Close review drawer` `xbtn`. **The drawer is always mounted**
  (translated off-screen by `.drawer`) and **opens by default**: `selected` is
  `selectedId === null ? undefined : entries?.find(…) ?? entries?.[0]`, so with `selectedId` still `undefined`
  the first queue row's drawer is open on first render; only the close button (which sets `selectedId` to
  `null`) closes it. The same "fall back to the first row" pattern governs `OpsOutreachPage` (`drafts?.[0]`),
  `OpsInboxPage` (`threads?.[0]`) and `OpsAuditPage`'s connection chips (`connections?.[0]`), which therefore
  also start with a row pre-selected.
  - `Pipeline state` table: `Source`, `Entry status`, `Detail state`, `Attempts`,
    `Private contacts` → `Extracted into restricted storage` / `None detected`; optional `p.fitline` error
  - `Redacted source excerpt` → `blockquote.evidence` or `No retained excerpt.`
  - `Canonical signal` table (`Title`, `Arrangement`, `Price` — `Unknown` when `priceEur` is undefined, else
    `€{n} / {pricePeriod ?? "unknown"}` —, `Verification`, `Requirements` /
    `None extracted`, `Unknowns` / `None recorded`) + summary; else `No canonical signal yet` /
    `Normalization has not produced a canonical signal for this entry.`
  - Footer: `Open public source` (new tab) and, when failed, `Retry entry` / `Queuing…` with status
    `Retry queued with the bounded detail worker.` or `Retry failed.`

### 7.3 `/ops/sources` — `OpsSourcesPage` — **(a)** frame / **(c)** legacy registry
- Header meta: chip `Live source graph` + `Discovery → policy → adapter → run`
- `SourceIntelligencePanel` (see §8)
- `PortalOperationsPanel` (see §8)
- `LedgerCard` `Legacy monitor registry` + `Firecrawl Native Monitoring` — explicitly labelled legacy → **(b)**
  - Buttons `Seed review sources`, `Sync monitors`, `Continue bounded backlog`; status
    `{label} queued successfully.` / `{label} failed.` in `p.rs-memory-notice[role=status]`.
    **The `label` passed to `run()` is not the button text** — only `Seed review sources` matches. The full
    label set (`OpsSourcesPage.tsx`) and the message each produces:

    | Trigger | `label` | Success message |
    | --- | --- | --- |
    | button `Seed review sources` | `Seed review sources` | `Seed review sources queued successfully.` |
    | button `Sync monitors` | `Monitor sync` | `Monitor sync queued successfully.` |
    | button `Continue bounded backlog` | `Backlog continuation` | `Backlog continuation queued successfully.` |
    | button `Approve automation review` | `Source review` | `Source review queued successfully.` |
    | button `Pause source` | `Pause source` | `Pause source queued successfully.` |
    | button `Activate reviewed source` | `Activate source` | `Activate source queued successfully.` |
    | target button `Run once` | `Manual monitor check` | `Manual monitor check queued successfully.` |

    A rejection shows the thrown `Error.message`, falling back to `{label} failed.`
  - States `Loading source registry…` / `Reading sources, targets, and Firecrawl monitor state.`;
    `No sources registered` / `Seed or review a source before starting a controlled monitor run.`
  - Per source `LedgerCard`: header name + health pill; facts `Scope` (`Not defined`), `Side`, `Lifecycle`,
    `Automation review` (`Pending metadata`), `Access`, `Last source check`; optional `policyNotes` fitline
  - Action row: `Approve automation review` (writes one of two canned policy notes:
    `Authenticated portal connection scope, terms, and permitted actions reviewed by operator.` /
    `Public access, terms, robots policy, and extraction quality reviewed by operator.`),
    or pill `Available for reviewed portal connections`, or `Pause source` / `Activate reviewed source`
  - Targets table: `Target` (hostname + `{n} snapshots`), `Monitor` (state pill + error + `Run once`),
    `Cadence` (+ `Paused`/`Scheduled`), `Backlog`, `Last event`; empty `No monitor target` /
    `This registry record has no Firecrawl target.`

### 7.4 `/ops/outreach` — `OpsOutreachPage` — **(c)**
- Header meta: chip `Live approval ledger` + `Operators cannot approve for users`
- Filters: `All`, `Awaiting Approval`, `Approved`, `Sending`, `Sent`, `Replied`, `Failed`, `Rejected`
- States `Loading outreach…` / `Reading approval, sending, and delivery state.`; `No outreach records` /
  `No outreach drafts match this status. RoomScout never creates a send from this operator screen.`
- Left `LedgerCard` `Approval and delivery queue` + `{n} records`; rows `qrow.rs-queue-button` with subject,
  `{owner} · {status} · {age}` and a delivery pill
- Right `LedgerCard accent` `Approval invariant` + `Version {n}`: `div.mailbox` `{recipientName} <{masked}>`;
  facts `Owner`, `From` (`Mailbox not provisioned`), `Search`, `Signal`, `Subject`, `Status`, `Delivery`
  (`Not sent`), `Content fingerprint` (`{prefix}…`), `Approved`, `Sent`; optional error fitline; closing note
  `The exact recipient, subject, body, content version, and hash are rechecked by the backend before an approved send. Message bodies stay out of this aggregate Ops query.`

### 7.5 `/ops/inbox` — `OpsInboxPage` — **(c)**
- Header meta: chip `Real channel state` + `Mail aggregate · own portal test accounts`
- Channel chips `AgentMail routing` (Mail) / `Platform inbox` (MessagesSquare)
- **AgentMail branch**: states `Loading inbox routing…` / `Reading AgentMail threads and parsed reply metadata.`;
  `No mail threads yet` / `Threads appear after a user approves an outreach, AgentMail sends it, and delivery or reply events arrive.`
  Left `Mail threads` + `{n} recent`; each row is `{subject}` + `{ownerName} · {age}` + a third line that is
  `thread.parsedSummary` when present, else the generated fallback
  `{Titlecased status} · {latestDirection} message` — or `{Titlecased status} · no stored message` when no
  direction is stored; right `LedgerCard accent` `Routing context` (Bot icon) with facts
  `Owner`, `Recipient`, `Search`, `Signal`, `Thread`, `Delivery` (`No provider update`), `Latest direction` (`No message`),
  optional parsed summary fitline + `ul.checks` parsed facts + last error, closing
  `This aggregate exposes routing metadata and parsed facts only; raw private message bodies remain omitted.`
- **Platform branch**: `LedgerCard accent` `Portal privacy boundary` (ShieldCheck) with
  `This is not a cross-user operator mailbox. It reads only platform accounts explicitly connected by the currently signed-in operator, using reviewed read-only inbox adapters.`;
  empty states `Loading portal inboxes…` / `Reading operator-owned portal connections.` and
  `No connected portal inbox` / `Connect an authenticated source from Profile, then complete the human login through Browserbase before any portal inbox can be read.`;
  a `LedgerCard` headed `Portal connection` + `Read-only sync` holding the connection chips
  (`{connection.label} · {Titlecased status}`) and, when `allowInboxPolling`, `Sync now`; its
  `p.rs-memory-notice[role=status]` shows `Syncing the reviewed portal inbox…` while the action runs, then
  `{n} threads and {n} messages added.` or the error fallback `The inbox operation failed.`;
  platform-threads loading state `Loading platform messages…` / `Reading normalized portal threads.`;
  `Platform threads` list (`Untitled platform thread`, `Participants not exposed`) and
  `Read-only transcript` + `{n} messages` (`ol.rs-platform-transcript`, `Loading messages…`,
  `Thread unavailable` / `The selected thread is no longer available.`, empty
  `No platform threads` / `The selected portal has not produced a reviewed inbox snapshot. No placeholder conversation is shown.`)

### 7.6 `/ops/audit` — `OpsAuditPage` — **(a)** (prototype „Ereignisfolge“)
- Header meta: chip `Live safeguards` + `No raw mail or audio`
- `LedgerCard` `Approval and provider events` + `Bounded recent history` → event stream; states
  `Loading audit events…` / `Reading approvals, verified provider events, and voice-session lifecycle records.`;
  `No audit events yet` / `Approval decisions and provider lifecycle events will appear here once those flows run.`
- `LedgerCard` `Browserbase run ledger` + `Signed-in operator only` → connection chips + run stream
  (`{kind} — {n} normalized items` / `No result payload stored`); states `Loading browser run ledger…`,
  `No portal run history` / `No persistent Browserbase context or browser run exists for this operator.`,
  `No runs for this connection` / `This connection has no reserved Browserbase sessions.`, `Loading runs…` — **(c)**

---

## 8. Shared component inventory

### Scout surface
| Component | Styling | What it renders | Copy | Class |
| --- | --- | --- | --- | --- |
| `scout/ScoutBlob.tsx` | **M** | `span` orb, `clamp(7.5rem,14vw,10.5rem)`, radial `#ffd2b0→#d94716`, `float 7s` + `morph 9s`; `.active` speeds to 3.2 s/5 s; `.compact` 3.6 rem; disabled under reduced motion | — | (a) |
| `scout/ScoutConversation.tsx` | **M** | `section[aria-label="Scout conversation"]`, `div.messages[aria-live="polite"]` (max-height 38vh / 25vh compact), bubbles `.scout/.user/.system`, `**bold**` mini-parser, thinking row, starter pills in `div[aria-label="Conversation starters"]` (rendered only when `starters.length`), pill composer with `Mic` + orange `Send`, and — after the form — **its own** `p.error[role=alert]` slot fed by the `error` prop (so on `/app/scout` the same error string can appear inside the conversation) | `Scout is thinking…`; sr-only label `Message your Room Scout`; placeholder `Tell Scout what matters…`; aria `Talk to Scout`, `Send message` | (a) shape / **(c)** English copy |
| `scout/ScoutFactList.tsx` | **M** | `section` + `dl` with FLIP-style `element.animate()` per row (enter 650 ms, value-change highlight `rgba(255,105,38,.26)` 1100 ms, move 650 ms); `expanded` variant enlarges heading to 22 px | heading default `Euer Suchauftrag`; empty `Was euch wichtig ist, sammelt sich hier – während wir sprechen.` | (a) DE |
| `scout/ScoutBrief.tsx` | **M** | collapsible pill → card with `dl` | toggle `{n} search facts` else title; default title `Your search brief`; empty `Tell Scout what matters and your brief will form here.` | (c) — EN inside a German stage |
| `scout/SearchProfileCard.tsx` | **G** | `LedgerCard accent.rs-search-profile`; `h2.ltitle` = `search.title`; `dl.rs-search-fields` of `div.frow > dt.k + dd.v` (`frow` is unstyled, §3.6), each value followed by a chip `span.chip.you` reading **`You`** when `field.source === "you"` and `span.chip` reading **`Scout`** otherwise, plus a pencil `button.edit` only when an `onEdit` prop is passed; draft footer `div.meter` of `<i>`/`<i class=on>` + count + optional hint + confirm button | header eyebrow `Draft search` (draft) / `Your search`; header meta `Not active yet` **only for drafts** — a non-draft card renders the raw `search.status` string, i.e. `active` or `paused`; `{n} of {n} high-value fields set` (also the meter's `aria-label`); button `Confirm search` (overridable via `confirmationLabel`) / `Starting…`; aria `Edit {label}`. The pencil and the confirm handler are **props-gated** — the only caller (`MySearchPage:202`) passes neither, so `Edit {label}` never renders and the draft `Confirm search` button is inert. | (c) |
| `features/scout/viewModel.ts` | — | Fact labels: `Location`, `Arrangement` (`Permanent room`/`Shared room`/`Hourly room`), `Budget` (`Up to €{n} / month`), `Radius`, `Schedule`, `Essential`, `Sharing` (`Open to a compatible band` / `Not looking to share` — **differs from `savedNeedToSearch`'s `Open to compatible room-sharing` for the same label**, see below), `Music`, `Instruments`, `Connections` (`Open to band connections` / `Room search only`), plus dynamic facets whose value gets ` · noch zu klären` appended below 0.75 confidence and `Ja`/`Nein` for booleans | MIXED | (c) — English labels feed a German UI |

### Voice
| Component | Styling | Detail | Class |
| --- | --- | --- | --- |
| `voice/VoiceSessionProvider.tsx` | **D** | Owns `useRealtimeVoiceScout`; renders the ongoing-call pill (§2.3) | (a) |
| `voice/RealtimeVoiceScout.tsx` | **M** (327-line module) | Stage with `VoiceVolumeBlob`, live caption (`Du` / `Dein Scout`), connection line, control cluster, optional text composer, modality switch, facts rail (`ScoutFactList heading="Eure Wünsche"`), transcript drawer | (a) |
| — copy (all **DE**) | | statuses: `Bereit, wenn du es bist`, `Warte auf Mikrofonfreigabe …`, `Verbinde …`, `Gespräch wird vorbereitet …`, `Ich höre zu`, `Ich denke kurz nach`, `Dein Scout spricht`, `Gespräch beendet`, `Verbindung unterbrochen`; suffix ` · Mikro aus`; default title `Erzähl mir, was ihr sucht.`; idle caption `Sag einfach, was bei eurem Proberaum wichtig ist.`; aria `Gespräch mit deinem Room Scout`, `Gesprächssteuerung`, `Gespräch starten`, `Gespräch erneut starten`, `Verbindungsaufbau abbrechen`, `Mikrofon einschalten`/`Mikrofon ausschalten`, `Scout unterbrechen`, `Gespräch beenden`, `Mitschrift öffnen`/`Mitschrift schließen`, `Texteingabe schließen`/`Per Text schreiben`, `Nachricht an deinen Scout`, `Nachricht senden`; placeholders `Schreib deinem Scout …` / `Starte zuerst das Gespräch`; toggle `Antworten als Text` / `Antworten mit Stimme`; drawer `Mitschrift`, `Noch keine Äußerungen.` | (a) |
| `voice/VoiceVolumeBlob.tsx` | **M** | SVG blob with `feTurbulence` + `feDisplacementMap` whose `scale = 9 + volume*24`, two halos, core; per-state animations (`speaking`, `listening`, `thinking/connecting/creating_session`, `error`, `paused`); `--volume` CSS var; `role="img"` default label `Voice activity` (EN) but callers pass `Sprachaktivität` | (a) |
| — transcript toggle | | The drawer toggle is **not** a lucide icon: it renders a literal `≡` glyph in `span.transcriptIcon` (`RealtimeVoiceScout.tsx:177`), with `aria-pressed` and the aria-labels above. | (a) |
| `hooks/useRealtimeVoiceScout.ts`, `hooks/useAudioVolume.ts`, `features/voice/realtimeRuntime.ts` | — | WebRTC/session logic, no markup — **but they own every voice error string**, and those are English (see below) | (a) shape / **(c)** English copy on a German surface |

#### The voice surface is **not** DE-only: the error set is English
`RealtimeVoiceScout.tsx:102` renders the connection line as `{voice.error ?? statusCopy[voice.status]}`.
Whenever an error is set it **replaces** the German status text with one of these strings (all EN):

| Origin | String |
| --- | --- |
| `useRealtimeVoiceScout.ts:354` | `Sign in before starting a private voice session.` |
| `useRealtimeVoiceScout.ts:359` | `This browser does not support microphone capture.` |
| `useRealtimeVoiceScout.ts:400` | `The realtime peer connection failed.` |
| `useRealtimeVoiceScout.ts:446` | `The Realtime event channel failed.` |
| `useRealtimeVoiceScout.ts:454` | `Received an unreadable Realtime event.` |
| `useRealtimeVoiceScout.ts:462` (thrown, then surfaced through `safeVoiceError`) | `The browser did not create a WebRTC offer.` |
| `realtimeRuntime.ts` `safeVoiceError` default | `Could not start the Realtime session.` |
| `safeVoiceError` — `NotAllowedError` | `Microphone access was not allowed.` |
| `safeVoiceError` — `NotFoundError` | `No microphone was found.` |
| `safeVoiceError` — `TypeError` | `The voice service could not be reached. Check your connection and try again.` |
| `safeVoiceError` — `/browser did not create/i` | `The browser could not create a voice connection.` |
| `realtimeRuntime.ts` `safeProviderError` — `/rate_limit/i` | `The voice service is busy. Please wait a moment and try again.` |
| `safeProviderError` — `/audio\|microphone/i` | `The voice service could not process the microphone audio.` |
| `safeProviderError` — default | `The Realtime session reported an error.` |

Plus one string that reaches the model rather than the screen: a failing tool call posts
`{"error":"The Scout could not complete that action."}` back as the `function_call_output`
(`useRealtimeVoiceScout.ts:263`), which the Scout may then paraphrase aloud.
The German ` · Mikro aus` suffix is appended after whichever of the two the line shows.

### Autonomy / approval
| Component | Styling | Detail | Copy highlights | Class |
| --- | --- | --- | --- | --- |
| `mandate/MandatePanel.tsx` | **G** | `LedgerCard accent` `Scout Autopilot` + `On`/`Off` pill; head strong/p; boundary strip; summary chips (`{n} platforms`, `{n} contacts/day`, `active until {date}`); `ActionDialog` `Autopilot settings` with radio pair, boundary strip, `<details class=rs-advanced-settings>` (Goal, Public research scope, Platform allowlist, Allowed non-binding actions, Personal data scopes, 4 numeric/date limits, Stop conditions, Always human, Emergency stop) | `RoomScout is working for you` / `Put your room search on Autopilot`; `Let the Scout research, contact suitable leads, and follow up without asking about every message.`; `You stay in control of the consequential decision: agreements, bookings, contracts, and money always come back to you.`; `Autopilot covers only non-binding actions on reviewed sources. Any commitment, payment, credential, 2FA, or CAPTCHA stops for you.`; buttons `Turn on Autopilot`/`Turn off`/`Advanced`/`Cancel`/`Save settings`/`Emergency stop`; `Saving creates a new immutable mandate version. Existing provider gates re-check that version immediately before execution.`; fallback `Autopilot persistence is unavailable. Manual review remains enforced.` | (a) — prototype „Handlungsspielraum“ / „Grenzen“; copy is EN |
| — `MandatePanel.actionLabels` | | `Browse public sources`, `Browse connected portals`, `Read connected messages`, `Extract and compare facts`, `Send email`, `Submit web form`, `Send platform message`, `Create a portal account`, `Publish a search listing`, `Share contact details`, `Propose a visit time`, `Accept terms`, `Accept or sign a contract`, `Confirm a booking`, `Make a payment`, `Pay a deposit`, `Enter a password`, `Complete two-factor authentication`, `Solve a CAPTCHA`. **Do not reuse this map in the approval dialog** — `ActionApprovalSheet` has its own, differently worded `kindLabels` (below). | EN | (a) |
| `actions/ActionApprovalSheet.tsx` | **G** | `ActionDialog` with authorization strip, effect strip, facts table, exact-payload fields, acknowledgement checkbox, hard-boundary note | see the full copy list below | (a), EN |
| `actions/ActionLifecyclePanel.tsx` | **M** | Card list with `data-state`, status pills (`Draft`, `Approval needed`, `Approved`, `Rejected`, `Queued`, `Executing`, `Executed`, `Failed`, `Cancelled`, `Expired`), execute/resume controls, human-boundary block with ephemeral Live-View link. Card title = `requestedActionType.replaceAll("_"," ")` (so `send email`, `submit webform`, …, lowercased). The status pill is **overridden** by the provider execution state when present: `Outcome unknown` (`execution.status === "unknown"`) and `Provider running` (`"running"` or `"claimed"`) replace the status label entirely. Meta line = `{action.executor ?? "No executor"}` · `{updatedAt.toLocaleString()}`. Destination line = recipient email · target URL · `payload.recipients.join(", ")` or `Existing platform thread` · `payload.accountLabel ?? \`Portal connection ${connectionId}\`` | `Review exact action`, `Execute approved action`/`Resume provider`/`Starting…`, `This approved action has no supported provider executor.`, `The provider paused at a human-only step. Open the ephemeral Live View, then explicitly tell RoomScout whether you submitted.`, `Open ephemeral Live View`, `I submitted it`, `Cancel action`, `Loading action ledger…`, `No persisted external actions yet.` | **(b)** |
| `actions/MailboxVerificationPanel.tsx` | **M** | Collapsible message list with auto-linked plain text, unread pill, archive control. Only messages whose `status !== "archived"` are counted, and at most the **first 6** of those are rendered (`visible.slice(0, 6)`); each carries a meta line `{kind.replaceAll("_"," ")} · {from} · {receivedAt.toLocaleString()}` (kind is `portal verification` or `general`) | `{n} message(s)`, `{n} unread`, `Message without subject`, `Archive`, `Loading personal mailbox…`, `No unmatched account or verification mail.`, `Verification links are opened only by you. RoomScout never follows them automatically.` | **(b)** |
| `outreach/ApprovalComposer.tsx` | **G** | `ActionDialog` `Manual send review` with From/To mailbox blocks, editable Subject/Message, acknowledgement | `Linked to “{search}” and “{signal}” · version {n}`; button ladder `Lock exact version for review` → `Approve & send once` → `Send approved message`; `This fallback lets you review wording when a source is not covered by Autopilot.`; `I approve this exact recipient, subject, and message. RoomScout may send this version once.`; flow messages `Changes saved. Review the refreshed version, then approve it.`, `The exact message is ready. Confirm it once more to approve and send.`, `The Scout has not produced a sendable draft with a recipient yet.`. Also: the button ladder has a **fourth** state `Approve exact message` (any draft status outside `drafted`/`awaiting_approval`/`approved`) and a busy label `Working…`; a `Cancel` button sits left of it; From placeholder `Your AgentMail inbox is being prepared`; To placeholder `Waiting for the persisted draft and recipient…`; errors `` `This draft cannot be sent while it is ${status.replace("_"," ")}.` `` and the catch-all `The draft could not be approved.` | (c) |
| `opportunities/OfferAcceptanceDialog.tsx` (+ `OfferAcceptanceFlow`) | **G** | `ActionDialog` `Review offer acceptance` with terms `dl`, Sending as / Destination / Subject / Exact message, acknowledgement | see the full copy list below | (a) — prototype „Angebot annehmen“ / „Angaben prüfen“; copy is EN |
| `opportunities/ProviderOfferPanel.tsx` | **G** (`.rs-provider-offer`) | `section[aria-label="Scout offer assessment"]`; **no-offer branch** = heading + one status line; offer branch = revision line, summary, `dl` (Availability, Monthly total, terms), blockers, suggested-reply `<details>`, evidence `<details>` with blockquotes, acceptance CTA and notices | see the full copy list below | (a) — prototype „Mein Vorschlag“ / „Angebot prüfen“; copy is EN |
| `opportunities/OpportunityHandoff.tsx` | **G** | `LedgerCard accent` `Opportunity ready for handoff` + meta `opportunity.status.replaceAll("_"," ")` + `h2.ltitle` title + counterparty `p` + two-column `ul.checks` Confirmed / Still unresolved + `p.fitline` recommended step; `ActionDialog` `Human agreement handoff` with warning strip, `<pre>` brief and copy button | `Prepare handoff`, dialog description `A structured summary for the human next step. This is not an accepted agreement.`, buttons `Close` / `Copy brief` → `Copied` (never resets) / `Mark handed off`, warning `RoomScout has not accepted, signed, booked, or paid for anything. Review the counterparty and all unresolved terms yourself.`, and — when no `onMarkHandedOff` prop is passed — the hint `Persisted handoff state is not available yet; copying the brief is safe and local.` The `<pre>` brief (also what `Copy brief` writes to the clipboard) is built line-by-line: `{title}` · `Counterparty: {counterparty}` · *(blank)* · `Confirmed:` · `- {item}` per confirmed fact · *(blank)* · `Still unresolved:` · `- {item}` per unresolved fact · *(blank)* · `Recommended next step: {step}` · *(blank)* · `RoomScout has not accepted any agreement.` | **(b)** |
| `memory/ContextImportDialog.tsx` | **G** | `ActionDialog` `Import your music context`; phase `collect` = read-only prompt `textarea.rs-import-prompt` (verbatim `MUSIC_CONTEXT_IMPORT_PROMPT`, quoted below) + paste `textarea.rs-import-source` (sr-only label `External assistant context`); phase `review` (entered as soon as `facts.length > 0`) = summary + checkbox fact list with category/sensitivity chips | `01 · Ask your current assistant`, `Copy this prompt into ChatGPT, Claude, or another assistant that already knows your music life.`, `Copy prompt`/`Copied` (auto-resets after **1800 ms**), `02 · Paste the result here`, `RoomScout extracts candidates with the AI Gateway. Nothing is stored until you review and confirm it.`, placeholder `Paste your music context export…`, `Analyze for review` (**disabled until the pasted text is ≥ 20 characters** after trim, and while busy), `Scout readout`, `{n} candidates across {n} entities · no raw export stored`, `Remember {n} fact` / `Remember {n} facts`, `Back`, dialog description `Bring useful context. Keep control.` in the collect phase and `{n} of {n} facts selected` in the review phase, error `The context could not be processed. Please try again.` (Convex errors are shown with the `…ConvexError: ` prefix stripped). Facts whose `sensitivity === "sensitive"` start **unchecked**; all others start checked. | (a), EN |

#### `MandatePanel` — complete copy (all **EN**)
Card: eyebrow `Scout Autopilot`; pill `On` / `Off`.
`autopilotOn` requires **all** of `persisted && version && status === "active" && killSwitchEnabled &&
mode !== "guided" && mode !== "research"`.

| Slot | On | Off |
| --- | --- | --- |
| `strong` | `RoomScout is working for you` | `Put your room search on Autopilot` |
| `p` | `The Scout can research, contact suitable leads, and continue non-binding conversations within your limits.` | `Let the Scout research, contact suitable leads, and follow up without asking about every message.` |
| primary button | `Turn off` | `Turn on Autopilot` (busy: `Starting…`) |

Boundary strip (card): `You stay in control of the consequential decision: agreements, bookings, contracts,
and money always come back to you.` · secondary button `Advanced` · summary chips (On only)
`{n} platforms` · `{n} contacts/day` · `active until {YYYY-MM-DD}`.

Dialog `Autopilot settings`, description `Autopilot is the default. Switch to manual review or tune its exact
limits here.`, footer `Cancel` / `Save settings` (busy: `Saving…`).
Radio pair (`div[aria-label="Scout operating mode"][role=radiogroup]`):
`Autopilot` / `Research, outreach, and non-binding follow-up happen automatically.` and
`Review every action` / `The Scout prepares work but waits before every external action.`
Dialog boundary strip: `Autopilot covers only non-binding actions on reviewed sources. Any commitment,
payment, credential, 2FA, or CAPTCHA stops for you.`
`<details class="rs-advanced-settings">` summary `Advanced controls`, body field labels in order:
`Goal` (value = `draft.goal`), `Public research scope` (value = `sourceAllowlist.join(", ")` or the fallback
`Reviewed sources for this search`), `Platform allowlist` (checkbox per platform, or the hint
`Active reviewed platforms are added automatically when Autopilot starts.` when no options are passed),
`Allowed non-binding actions` (7 checkboxes labelled from `actionLabels`), `Personal data scopes`,
`Contacts / day`, `Browser min / day`, `Max monthly price €`, `Expires`, `Stop conditions`, `Always human`.
Data-scope checkbox labels are rendered as `scope.replaceAll("_", " ")`, i.e. **`band name`,
`member first names`, `reply email`, `phone`, `precise location`, `availability`, `budget`,
`music profile`**. Emergency stop button `Emergency stop` renders only while `mandate.status === "active"`.
Footer notes: `Saving creates a new immutable mandate version. Existing provider gates re-check that version
immediately before execution.` — replaced by `Autopilot persistence is unavailable. Manual review remains
enforced.` when no `onSave` prop is passed.
Errors (`p.rs-form-error[role=alert]`, in the card when the dialog is closed, otherwise inside it):
`The Autopilot settings could not be saved.` (save) and `Autopilot could not be updated.` (status change) —
both only as fallbacks; a thrown `Error.message` wins.
Every input except the mode radios is `disabled` while the draft mode is `guided`.

#### `ActionApprovalSheet` — complete copy (all **EN**)
`kindLabels` — **a different map from `MandatePanel.actionLabels`**, used for both the dialog description and
the `Action` fact row:

| kind | `ActionApprovalSheet.kindLabels` | (`MandatePanel.actionLabels` for contrast) |
| --- | --- | --- |
| `send_email` | `Send email` | `Send email` |
| `submit_webform` | `Submit web form` | `Submit web form` |
| `send_platform_dm` | `Send platform message` | `Send platform message` |
| `create_portal_account` | **`Create portal account`** | `Create a portal account` |
| `publish_listing` | **`Publish listing`** | `Publish a search listing` |
| `share_contact_details` | `Share contact details` | `Share contact details` |
| `propose_visit_time` | **`Propose visit time`** | `Propose a visit time` (key `propose_visit`) |

- Title: `This step needs you` when a one-time approval is required, else `Handled by Autopilot`.
  (`needsOneTimeApproval = !standingAuthorization?.executionAllowed`, so anything other than an
  `authorization.mode === "standing_mandate"` request with `executionAllowed` takes the first branch.)
- Description: `` `${kindLabels[kind]} · exact payload version ${contentVersion}` ``.
- Authorization strip — standing-mandate branch (`div.rs-action-authorization[.is-authorized]`):
  `Covered by Autopilot` / `Outside the current Autopilot boundary` as the `strong`, then
  `{mandateLabel} · version {n}` followed by ` allows this non-binding action.` or
  ` does not cover this exact action, so your decision is required.`
- Authorization strip — one-time branch: `One-time approval:` + ` nothing executes until you approve this
  exact destination and payload.`
- Effect strip: `What will happen:` + ` {request.effect}`.
- Facts table: `Destination` · `Acting as` · `Action` (= `kindLabels[kind]`) · `Authorization`
  (`Autopilot v{n}` with a standing mandate, else `Your decision`).
- Section label `Exact payload`, then one `span.mono` + `p` per `request.fields` entry.
- Acknowledgement (one-time branch only): `I approve this exact destination and payload for one execution.`
- Buttons: one-time `Reject` / `Approve once` (busy `Saving…`, `Approve once` disabled until the checkbox is
  ticked); standing `Close` / `Pause mandate` (busy `Pausing…`).
- Errors: `The exact action could not be approved.` and `The action could not be rejected.` (fallbacks).
- Hard-boundary note: `Autopilot never authorizes terms, contracts, bookings, payments, deposits, passwords,
  2FA, or CAPTCHA.`
- **Reachability:** the only caller (`MusicianInboxPage`) hard-codes `authorization: {mode:"approve_once"}`
  and passes no `onPauseMandate`, so `Handled by Autopilot`, `Covered by Autopilot`, `Outside the current
  Autopilot boundary`, `Close`, `Pause mandate`, `Pausing…` and the `Autopilot v{n}` fact are **currently
  unreachable in the running app**.

#### `ProviderOfferPanel` — complete copy (all **EN**)
- **No-offer branch** (`!conversation.offer`): `h2` `Scout assessment` plus one `p[role=status]` —
  `The provider update could not be assessed yet. No reply has been sent.` when `conversation.errorCode` is
  set, otherwise `Your Scout is reviewing the provider's message against your search.`
- Header meta: `Revision {n} · ` + `Accepted offer` / `Needs reassessment` (`!offer.current`) /
  `Ready for review` (`offer.ready`) / `Open questions`.
- Stale notice (when `!offer.current` and not accepted): `This assessment is out of date because the
  conversation, listing or your search changed.`
- `dl`: `Availability` = `assessment.availability.status`; `Monthly total` = `Not confirmed` or `€{n}`,
  then ` · ` + `All recurring costs stated` / `Additional costs may be unresolved`; then one row per
  `assessment.terms` entry.
- Blockers block heading `Still to resolve` (hidden once the acceptance was sent).
- Suggested-reply `<details>` summary = the reply label ladder `Reply · sent` / `Reply · delivery being
  checked` / `Reply · checking final text` / `Reply · authorized, awaiting delivery` / `Reply · needs your
  review` / `Reply · failed; not confirmed sent` / `Suggested reply · not sent`.
- Evidence `<details>` summary `Evidence behind this assessment`.
- Acceptance notices (`p.rs-provider-offer__notice[role=status]`): `Acceptance sent · search paused. This
  does not confirm a booking, signature, or payment.` · `Acceptance approved. Delivery is still being
  checked; it is not yet confirmed sent.` · `Acceptance failed and is not confirmed sent.`
- CTA `Review acceptance` — shown only when `offer.current && offer.ready && conversation.platformThreadId`
  and nothing is pending or already sent; it mounts `OfferAcceptanceFlow`.
- Closing note: `An assessment is not a booking or acceptance. Any final commitment needs your exact approval.`

#### `OfferAcceptanceDialog` / `OfferAcceptanceFlow` — complete copy (all **EN**)
Title `Review offer acceptance`. Description `Offer revision {n} · exact-once platform message`, or
`Preparing an exact acceptance for review` while no descriptor exists.
Footer `Cancel` / `Approve and send acceptance` (busy `Approving…`; enabled only when the acknowledgement is
ticked **for the current snapshot** and `descriptor.current && status === "awaiting_approval"` and it has not
expired).

| State | String |
| --- | --- |
| loading | `Preparing the exact acceptance…` |
| prepare failed | `The acceptance could not be prepared. Nothing was sent.` (fallback) |
| no descriptor | `This acceptance request is unavailable. Nothing was sent.` |
| stale (`!descriptor.current`) | `This review is stale because the offer, search, or conversation changed. Nothing was sent.` |
| server rejected with `OFFER_CHANGED` / `ACCEPTANCE_CONTENT_CHANGED` | `The offer or acceptance message changed. Nothing was sent. Close this review and start again from the current offer.` |
| expired (at open, or `EXPIRED` from the server) | `This approval request expired. Nothing was sent.` |
| failed | `The acceptance failed and is not confirmed sent. This exact request cannot be approved again.` |
| pending (`approved`/`executing`) | `Acceptance approved. Delivery is still being checked; this does not yet confirm it was sent.` |
| executed | `Acceptance sent.` |
| approve rejected | `The acceptance could not be approved. Nothing was sent.` (fallback) |

Body: `section[aria-label="Offer terms"]` with `h3` `Offer being accepted`, the assessment summary, and a
`dl` whose first row is `Monthly total` (`Not confirmed` / `€{n}`, then ` · All recurring costs stated` or
` · Additional costs may be unresolved`) followed by the terms rows; then `Sending as`, `Destination`,
`Subject` (`descriptor.subject || "(No subject)"`), `Exact message`; then
`Controlled roomscout.dev platform message only. This does not sign an agreement, book a room, or make a
payment.` and the acknowledgement `I reviewed these exact terms, sender, destination, subject, and message.
RoomScout may send this acceptance once.` The acknowledgement is keyed to
`{requestId}:{contentVersion}:{contentHash}:{reviewContextHash}` and silently un-ticks itself whenever any of
those change.

#### `MUSIC_CONTEXT_IMPORT_PROMPT` — the verbatim prompt rendered in `ContextImportDialog`
Shown read-only in `textarea.rs-import-prompt` and copied by `Copy prompt`. It is user-visible copy
(`src/features/memory/contextImportPrompt.ts`):

```text
I am setting up RoomScout, an assistant that helps musicians and bands find rehearsal rooms and compatible room-sharing partners.

Based only on things I have explicitly told you in our previous conversations, create a concise context export about my music life. Include useful facts such as:
- bands, projects, members, roles, and instruments
- genres, influences, sound, working style, and musical direction
- rehearsal habits, schedules, locations, mobility, and travel limits
- instruments, equipment, storage, noise, access, and technical needs
- room budget, room type, preferred districts, and deal-breakers
- openness to sharing a room and what would make another band compatible
- current goals and relevant unresolved questions

Keep distinctions between me, other people, and bands clear. Mark uncertain or outdated information as uncertain. Do not guess. Do not include passwords, authentication details, financial account data, health information, exact home addresses, private contact details, or unrelated personal information.

Return plain text with clear headings and bullet points. I will review the result before RoomScout stores any extracted facts.
```

### Sources / connections
| Component | Styling | Detail | Class |
| --- | --- | --- | --- |
| `coverage/CoverageTrustNotice.tsx` | **G** | `div.rs-coverage-trust[role=note]` + Info icon; `compact` variant | (c) |
| `search/SearchSourcesPanel.tsx` | **G** | **Renders `<CoverageTrustNotice />` (full variant) as its own first child** — so the coverage notice also appears on `/app/search?tab=sources` and `/app/settings/sources`, not only on `/explore` and `/map`. Then the coverage card `Coverage for {city}` — with `city` empty the header reads **`Coverage for this search`** — + `Live index evidence` with 4 metrics (`observed signals` = `indexedSignalCount`, `evidence sources` = `indexedSourceCount`, `watching this search` = sources with status `watching`, `known gaps` = all other sources), the **fixed** hint `Source inclusion is a search preference. Global monitoring, policy review, and extraction health remain operator-controlled.`, then the caller's `disclosure` hint when provided. Then one `LedgerCard` per source: header `{name}` + status pill (`Watching`, `Partial coverage`, `Connection required`, `Under review`, `Unavailable`; tone `new` for watching, `warn` for unavailable), body = domain link + `{source.note}` or the fallback `` `${side} · ${access} access` `` (e.g. `both · public access`), and a footer of two `span.mono`: `{lastCheckedLabel ?? "No successful check recorded"}` and `{signalCount ?? 0} relevant signals` — **no caller passes `signalCount`, so this footer always reads `0 relevant signals`**. Actions: `Connect` (only for status `connection_required`) and the include toggle `Included` / `Excluded` / `Saving…` (disabled for `unavailable`). Empty `Source-level coverage is not available yet` / `RoomScout has indexed market evidence for this search, but no user-visible source coverage records are available yet. It will not invent a source list from aggregate counts.` **Reachability:** both producers (`MySearchPage`, `SearchControlSettings`) hard-code `access: "public"` and never emit `connection_required`, so the `Connection required` pill and the `Connect` button are unreachable today. | (a) — prototype „Deine Quellen“; copy EN |
| `connections/PortalConnectionsWorkspace.tsx` | **M** + **G** | Mail-identity card `Registration & reply address`, safety block `One isolated Browserbase Context per portal identity`, `Your portal identities` list with per-status copy, scope chips, and action row (`Let Scout register`, `Open secure setup`, `Reconnect portal`/`Reauthenticate`, `Sync inbox`, `Pause`, `Disable & delete Context`), plus `Available portals` list with `Prepare connection` | (c) — prototype has „Anmeldung öffnen“/„Demo-Anmeldung“ but far simpler |
| — status copy | | `Not connected` / `RoomScout has created the connection record, but its reviewed login flow is not ready yet.`; `Login / registration needed` / `Open a private Live View to log in or register once. RoomScout never sees or stores what you type there.`; `Connected` / `The saved Browserbase Context can be reused for allowed searches and inbox checks on this portal.`; `Reauthentication required` / `This portal ended or invalidated its login. Reconnect in Live View to refresh only this portal Context.`; `Paused` / `RoomScout will not use this portal until you reconnect it. Other portal connections are unaffected.`; `Disabled` / `The remote Browserbase Context was deleted and this portal identity can no longer be used.` (all **EN**) | (c) |
| `connections/PortalAuthenticationGuide.tsx` | **M** | `section[aria-label="Portal login instructions"]`: head strip (ShieldCheck) `You control this one-time {portalName} setup` + `The Live View is a direct window into an isolated Browserbase session. Type passwords, OTPs and 2FA only there. RoomScout does not ask for, receive or store them, and Browserbase CAPTCHA solving is disabled.`; numbered `ol` — 1. `Open Live View, then log in—or create the portal account yourself.` 2. `Complete email verification, 2FA or CAPTCHA manually if the site requires it.` 3. `Once the portal visibly shows you as signed in, confirm below and return control.`; mail block `{mailboxAddress}` or `RoomScout registration address not created` + `Use this email for a new portal account so confirmation and future replies reach your RoomScout inbox.` + button `Copy address` → `Copied` (never resets) when an address exists, else `Create address` / `Creating…`; checkbox `I can see that {portalName} is signed in` (bold) + `This confirmation saves the authenticated Context for later approved runs. It does not authorize RoomScout to send messages, accept terms, book, or pay.` — **disabled until `liveViewOpen`**, in which case the hint `Open the Live View before confirming the portal session.` is shown below | **(b)** |
| `connections/ConnectionsPanel.tsx` | **G** | **UNUSED** — no importer anywhere in `src/`. Dead file (superseded by `PortalConnectionsWorkspace`). | **(b)** delete |
| `browser/BrowserRunWorkspace.tsx` | **G** | Run bar `header.rs-browser-run__bar`: eyebrow `Scout run · {run.sourceName}`, `h1` = `run.searchTitle`, `span.mono` = `{sourceDomain} · {mandateLabel}` (domain omitted when absent); right side a state pill rendering `run.state.replaceAll("_", " ")` (so `human required`, `human controlling`, `failed`, …; tone `warn` for `human_required`/`failed`, else `new`) and a `Stop run` button. Human-takeover banner (`human_required` or `human_controlling`): `Scout needs you` / `You have control` + `run.humanPrompt` or the fallback `Complete the human-only step. The Scout remains paused until you explicitly return control.` Live View `iframe title="Live browser session for {sourceName}"`, else `Live View not connected` / `The run exists, but no provider Live View URL is available. The Scout remains unable to claim browser progress visually.` Rail `LedgerCard` header `Run plan` → `ol` of `run.steps` + controls `Take control` (human_required) / `Return control to Scout` (human_controlling) / `Retry safely` (failed) + hint `Returning control is explicit. The Scout may not resume merely because the browser becomes idle.` No-run state: `Browser run unavailable` / `No authorized browser session was found. RoomScout does not create a fake Live View when no provider session exists.` | **(b)** |

#### `PortalConnectionsWorkspace` — complete copy (all **EN**)
1. **Mail-identity card** `LedgerCard accent`: eyebrow `Registration & reply address`; pill =
   `mailbox.status ?? "Not created"` (tone `new` when `active`, `warn` when `failed`);
   `strong` = `mailbox.emailAddress` or `Create your private RoomScout email address`; paragraph
   `Use this address when a portal asks for an email during registration. Verification mails and replies can
   then arrive in your RoomScout inbox.`; button = `Copy address` → `Copied` (never resets) when the mailbox
   is `active` **with** an address, otherwise — and only while the status is not `disabled` —
   `Creating…` (`provisioning`) / `Retry address` (`failed`) / `Create address`. `mailbox.lastError` renders
   below as `p.rs-form-error[role=alert]`.
2. **Safety block** `strong` `One isolated Browserbase Context per portal identity` + the full paragraph
   `Browserbase persists each site's cookies/session in its own Context. On the controlled roomscout.dev demo
   portal, the Scout may create an account with its AgentMail address and inject the received email code.
   Passwords are ephemeral; CAPTCHA, terms and ambiguous verification always hand control to you.`
3. **Caller error** `p.rs-form-error[role=alert]` (the `error` prop).
4. **`Your portal identities`** `LedgerCard`, meta `Independent connection state`. States:
   `Loading connections…` / `Loading your persisted portal connections and policy state.`; and
   `No portal identities yet` / `Choose a reviewed portal below. Public RoomScout sources continue to work
   without a portal login.` Each portal `article`: name, optional domain link, the status **description**
   (table below), a status pill with the status **label** (tone `new` when connected, `warn` when the status
   is a warning one); then a Context block whose `strong` is `Persistent Context ready` (connected) /
   `Persistent Context deleted` (disabled) / `Persistent Context scoped to this portal`, and whose paragraph
   is `` `Portal identity: ${identityLabel}. ` `` (only when an identity label exists) +
   `This Context is not shared with your other connected sites.` + `` ` ${note}` `` (only when a note exists);
   then a meta row of the scope chips, `Checked {lastVerifiedLabel}` and `Policy review pending`
   (when `!policyReady`); then the action row `Let Scout register` + `Open secure setup` (`login_needed`),
   `Reconnect portal` (`paused`) / `Reauthenticate` (`reauth_required`), `Sync inbox` (connected + `canSync`),
   `Pause` (connected), `Disable & delete Context` (any status but `disabled`).
5. **`Available portals`** `LedgerCard` (only when the caller passes any), meta `Reviewed login surfaces`;
   per row the platform name, a domain link (+ ` · {source.name}` when it differs), and `Prepare connection`;
   closing hint `Preparing creates an isolated connection record. Authentication opens only after RoomScout's
   platform policy is approved.`

Values supplied by `ProfilePage` (`ProfilePage.tsx:195–216`), not by the component:
- `scopes` chips: `Read-only research` (when `allowReadOnlyRecon`) and `Inbox sync` (when `allowInboxPolling`).
- `lastVerifiedLabel`: `new Date(lastSuccessAt).toLocaleString()`.
- `note`, first match wins: `` `Platform policy: ${policyDecision}.` `` when the policy is not `allowed`;
  else `` `Last connection error: ${lastErrorCode}.` ``; else `` `Reviewed source: ${sourceName}.` ``.

### Signals / map
| Component | Styling | Detail | Class |
| --- | --- | --- | --- |
| `signals/SignalCard.tsx` | **G** | `article.lcard.hov.rs-signal-card--{side}` with badge row, title link, location, facts table, fit line, optional action row (`Draft inquiry`, `Open detail`, `Save`, `Dismiss`), footer `SRC {source}` + `{firstSeen}`. **Reachability:** the only caller (`ExplorePage:139`) passes just `signal`, so the action row and the `compact` variant never render in the running app. | **(b)** |
| `signals/SignalBadge.tsx` | **G** (`.badges` has no CSS) | `Supply`/`Demand` + verification label, `Controlled demo` chip; `Freshness` = dot + label, `.rs-freshness*` unstyled | **(b)** |
| `map/MarketGlobe.tsx` | **M** | Mapbox GL globe: `mapbox://styles/mapbox/dark-v11`, `projection:"globe"`, custom fog (`high-color rgba(255,107,44,.18)`, `star-intensity .38`), orange country-boundary line layer, clustered GeoJSON source (`clusterMaxZoom 7`, `clusterRadius 48`), auto-spin (360°/240 s, stops ≥ zoom 5 or on interaction or reduced motion), scroll-zoom only with ⌘/Ctrl. Root is `section[aria-label="RoomScout market map"]`. Side panel `Signals in view` + `{n} visible`, detail card (side chip, a `Controlled demo` pill when `signal.isDemo`, title, `button[aria-label="Close signal detail"]`, summary or the fallback `{locationLabel} · {source}`, then pills for location / price / freshness), list cards, `Back to overview`. Hint `Hold ⌘ or Ctrl while scrolling to zoom. Drag the globe to explore current market signals.`; empty `No geocoded signals in this view. Zoom out to widen the market window.`; errors in `div[role=alert]`: `VITE_MAPBOX_ACCESS_TOKEN is required to render the market globe.` (no token — this one wins over any other error), `The map could not load.` (fallback for a Mapbox `error` event without a message) and `Mapbox GL could not be loaded.` (the dynamic `import()` of `mapbox-gl` rejected). Defaults: `initialCenter = GERMANY_CENTER = [10.4515, 51.1657]`, `initialZoom = 2.5`, `autoRotate = true`. | **(b)** |

### Ops-only components
| Component | Styling | Detail | Class |
| --- | --- | --- | --- |
| `ops/OpsPageHeader.tsx` | **M** + imports **O** | eyebrow/title/description/meta header | (a) |
| `ops/ProviderReadinessPanel.tsx` | **G** | `Provider readiness` + `Presence and shape checks only`; six provider blocks each with a status pill rendering `status.replaceAll("_", " ")` (tone: `configured` → `new`, `client_only` → untoned, anything else → `warn`), a row of `{Label}: set` / `{Label}: missing` check pills, and one `p.hint` per backend reason string; `Refresh`/`Checking…`; while the first check is still running, `Reading deployment configuration through the operator-only backend check…`; summary `{n} of {n} server providers configured. The browser Mapbox token is evaluated separately in this deployed frontend.`; `Secrets never leave Convex. A configured badge proves configuration presence and basic shape—not provider acceptance or a successful live run.`; error `p.err[role=alert]` (see §7.1). Check-pill labels per block: **Firecrawl** `Key`, `Crawl HMAC`, `Monitor bearer`, `Webhook URL`, `Monitors` · **AgentMail** `Key`, `Webhook secret`, `Address salt`, `Custom domain` · **Browserbase** `Key presence` · **Mapbox server** `Geocoding token` · **OpenAI direct** `Key`, `Realtime origins` · **Mapbox browser** `Build-time token`. The Mapbox-browser block is evaluated in the frontend (`status` is `configured` / `incomplete`) and always appends one of two reasons: `This frontend build contains a public browser token; domain restriction and provider acceptance still need a live proof.` or `This frontend build does not contain the browser token, so the globe and map cannot render.` | (a) — prototype „Integrationen“ |
| `ops/PortalOperationsPanel.tsx` | **G** | `LedgerCard` header `Browserbase portal operations` + `Operator-owned test connections only`; boundary note `This surface shows only portals connected by the signed-in operator. Live View URLs are short-lived bearer links; they remain local to this screen and are never stored. Passwords, 2FA, CAPTCHA, terms, contracts, bookings, and payments stay human-only.`; states `Loading portal connections…` / `Reading user-owned Browserbase contexts and runs.` and `No portal connections` / `Create a portal connection from Profile after a source has passed review. No Browserbase context is implied when this list is empty.`; connection queue rows `{label}` + `{Titlecased policyDecision} · {age}` + status pill; facts table `Status`, `Policy`, `Read-only recon` (`Allowed` / `Disabled`), `Inbox polling` (`{n} min` / `Disabled`), `Next poll` (`formatAge`, `Never` when unset), `Circuit breaker` (`Recorded until {toLocaleTimeString()} ({age})` / `Closed`); action row `Run recon`, `Start human login`, `Sync inbox`, `Pause`, `Delete context & disable`; `h3` `Recent browser runs` with `Loading runs…` / `No Browserbase run has been reserved for this connection.` and a table `Kind` / `Status` / `Result` (`resultCount ?? errorCode ?? "—"`) / `Created` / (actions `Live View`, `Confirm complete`, a stop button); `A short-lived Live View link is ready. It is not persisted in Convex.` and the link `Open short-lived Browserbase Live View`. The status notice is `p.rs-memory-notice[role=status]` reading `{label} completed.` or the error fallback `The Browserbase operation failed.`, where `label` is one of `Read-only recon`, `Authentication session`, `Inbox sync`, `Connection pause`, `Connection disable`, `Authentication confirmation`, `Run stop`, `Live View` — **again not the button text** (e.g. `Run recon` → `Read-only recon completed.`). | (c) |
| `ops/SourceIntelligencePanel.tsx` | **G** | See the full copy list below. Contains two **hard-coded `bandnet.hamburg` special cases** (`Bind reviewed form`, `Create Bandnet review draft — verify evidence`). | (c) frame / **(b)** the Bandnet-specific buttons |

#### `SourceIntelligencePanel` — complete copy (all **EN**)
- **Command bar card**: eyebrow `Source intelligence`, meta `Firecrawl discovery · reviewed promotion`;
  `strong` `Germany source-discovery cursor {n}`; paragraph `Runs exactly one search query with at most five
  results. Candidates stay in review and never become live sources automatically.`; button
  `Run next bounded slice`. Notice `p.rs-memory-notice[role=status]`: on success
  `{result.queriesAttempted} query · {result.candidatesSeen} candidates observed · {result.candidatesCreated}
  new.` for the discovery slice (internal label `Bounded Germany discovery`), `{label} completed.` for every
  other operation, and the error fallback `The operation failed.` `label` values used by `run()`:
  `Candidate promotion`, `Source definition`, `Policy approval`, `Bandnet contact adapter`,
  `Bandnet contact policy draft`.
- **`Platform directory`** card, meta `{n} loaded`. States `Loading platforms…` / `Reading the canonical
  platform directory.` and `No platforms yet` / `Promote reviewed discovery candidates to establish the
  platform directory.` Rows carry a `titleCase(platform.status)` pill; pagination button
  `Load more platforms` (loads 30).
- **`Candidate review`** card, meta `{n} loaded`; filter chips `New`, `Reviewing`, `Promoted`, `Ignored`,
  `Merged`. States `Loading candidates…` / `Reading discovered domains from Convex.` and
  `Candidate queue is empty` / `No source candidates match this review state.` Each row shows the name, the
  snippet or `No retained discovery snippet.`, an external link `button[aria-label="Open {name}"]`, and —
  for `new`/`reviewing` — `Promote to reviewing`. Pagination `Load more candidates`.
- **`Platform transaction map`** card, meta = the selected platform's name or `Select a platform`. Empty
  state `No platform selected` / `Select a platform above to inspect its versioned policies and executable
  adapter bindings.` Otherwise: `Create its reviewed source definition` + `Public sources can feed monitors.
  Authenticated sources become independently connectable Browserbase contexts after operator review.`,
  toggle chips `Public` / `Authenticated portal`, button `Create/reuse source`; then three columns —
  `Approved policies` (empty `No approved flow policy.`), `Draft policies` (empty `No policy awaits
  approval.`, each row linking `Review evidence` per evidence URL plus an `Approve` button),
  `Active adapter bindings` (empty `No listing, contact, or auth adapter is active.`).
- **`Read-only flow probes`** card, meta `Stored run outcomes`; status filter chips (`Queued` … `Succeeded`,
  all `titleCase`d). States `Loading probe runs…` / `Reading bounded, read-only source probes.` and
  `Probe queue is empty` / `No stored probe run matches this state.` Table columns `Run` (last 8 chars of the
  id), `Trigger`, `Observed` (`itemsObserved ?? "—"`), `Result` (status pill + optional error), `Updated`.

### Data-shaping modules (no markup, but they define visible strings)
- `src/data/convexAdapters.ts`
  - `relativeTime(ts, prefix)` — **four** branches, not three: `{prefix} just now` (< 1 min),
    `{prefix} {n} min ago`, `{prefix} {n} h ago`, `{prefix} {n} d ago`. Used with the prefixes `Checked`
    (fresh/current), `Last seen` (status `stale`) and `First seen`.
  - `publicSignalToMarketSignal` — `Not stated` (unknown price / empty requirements), arrangement labels
    `Permanent` / `Shared` / `Hourly` / `Arrangement unknown`, `{n} indexed source` / `{n} indexed sources`,
    fact labels `Price`, `Arrangement`, `Requirements`.
  - `savedNeedToSearch` — labels `Location`, `Radius` (`{n} km`), `Arrangement`, `Budget` (`≤ €{n} / month`),
    `Schedule`, `Essential`, `Music`, `Instruments`, `Sharing` with the values
    **`Open to compatible room-sharing`** / `Not looking to share`. ⚠ `features/scout/viewModel.ts` renders a
    *different* value under the same `Sharing` label (`Open to a compatible band` / `Not looking to share`),
    so the same field reads differently on `/app/search` (adapter) and inside the Scout fact list (viewModel).
    Every field is also hard-coded `source: "you"`, which is why `SearchProfileCard`'s `Scout` chip is
    unreachable from this producer.
  - `formatMessageTime` — `Intl.DateTimeFormat(undefined, {dateStyle:"medium", timeStyle:"short"})`.
- `src/mocks/demoData.ts` — 344 lines, but only **types** are imported anywhere
  (`MarketSignal`, `SavedSearch`, `SearchField`, `SignalSide`). The mock data itself is dead → **(b)**;
  the types should move to a real module if `SignalCard`/`SearchProfileCard` survive.
- `src/features/agentOperations/types.ts`, `mandatePolicy.ts` — mandate/action vocabulary shared by the
  approval UIs. `hardHumanActionTypes` drives the `Always human` list.
- `src/features/memory/contextImportPrompt.ts` — the literal prompt shown (read-only) in
  `ContextImportDialog`; quoted verbatim under **Autonomy / approval** above. It is shipped copy.
- `src/features/auth/errors.ts` — `MIN_PASSWORD_LENGTH = 10` / `MAX_PASSWORD_LENGTH = 100` + the 15-entry
  error dictionary for `AuthPage`, enumerated in §5.6.
- `src/app/returnTo.ts` — `safeReturnTo` with the default `/app/scout` (§1).

---

## 9. Roll-up: what survives, what does not

### (a) Has a prototype home
Landing (`/`) in full · WorkspaceShell consumer header + account menu · ongoing-call pill · Scout discovery /
working / paused stages, blob, fact list, brief, voice surface · `Scout losschicken` review card ·
context import · Settings frame and all seven sections · Autopilot/mandate panel and its dialog ·
one-time action approval · offer assessment + acceptance · source coverage panel ·
Ops overview + provider readiness + audit log.

### (b) Legacy, no prototype counterpart
`/explore` and `/app/explore` (whole route, incl. filter chips, `SignalCard`, `SignalBadge`, save-gate dialog) ·
`/signals/:id` (whole route) · `/map` and `/app/map` (whole route, `MarketGlobe`, `mapbox-gl` dependency) ·
`/app/runs/:runId` (whole route, `BrowserRunWorkspace`, `PortalAuthenticationGuide`) ·
`/app/inbox` three-pane tool incl. web-form pseudo-channel, `ActionLifecyclePanel`, `MailboxVerificationPanel`,
`OpportunityHandoff` · Scout `What Scout is doing` debug `<details>` · `Build semantic index` control ·
Ops "Legacy monitor registry" card · `bandnet.hamburg` hard-coded buttons · unused `ConnectionsPanel.tsx` ·
dead musician branch inside `WorkspaceShell` · `src/mocks/demoData.ts` payload · `.demo-trigger` CSS ·
`ScoutPage.module.css` `.factsStage`/`.fact`/`.voiceOverlay`/`.voiceClose` · unused `TableCaption` export ·
`src/assets/room-background.jpg`.

### (c) Unclear / needs a decision
`/app/search` as a standalone page (its three tabs map to Scout + Settings in the prototype) ·
`Nachrichten` nav entry (prototype mentions the word only in Settings/Operator) ·
`AuthPage` (German intro, English form; prototype only has a demo login inside Settings) ·
`LedgerCard`/`PageHeader`/`EmptyState` primitives (prototype uses flat sections) ·
`SelectField`, shadcn `table.tsx` + `cn()` · Ops signal-review drawer, outreach ledger, inbox routing,
portal operations, source intelligence · `CoverageTrustNotice` · `ScoutBrief` English copy ·
`mode=signal_advisor` deep link · manual `Aktualisieren` button.

### Controls documented above that are unreachable in the running app
A builder must decide per item whether to port it, wire it up, or drop it:

| Component | Unreachable surface | Why |
| --- | --- | --- |
| `SignalCard` | action row `Draft inquiry` / `Open detail` / `Save` / `Dismiss`, and the `compact` variant | the only caller (`ExplorePage:139`) passes just `signal` |
| `SearchProfileCard` | pencil `Edit {label}` buttons; the draft `Confirm search` button is rendered but inert | `MySearchPage:202` passes only `search` (no `onEdit`, no `onConfirm`) |
| `ActionApprovalSheet` | the whole `standing_mandate` branch — `Handled by Autopilot`, `Covered by Autopilot`, `Outside the current Autopilot boundary`, `Close`, `Pause mandate`, `Pausing…`, `Autopilot v{n}` | `MusicianInboxPage:129` always sets `{mode:"approve_once"}` and never passes `onPauseMandate` |
| `SearchSourcesPanel` | status `Connection required` and its `Connect` button | both source producers hard-code `access:"public"` and never emit `connection_required` |
| `SearchSourcesPanel` | a non-zero `{n} relevant signals` footer | no caller passes `signalCount`, so it always renders `0 relevant signals` |
| `SearchProfileCard` | the per-field `Scout` chip | `savedNeedToSearch` hard-codes `source:"you"` for every field |

### Language split (today)
| Surface | Language |
| --- | --- |
| Landing, Scout stages, fact list, ongoing call, account menu, inbox framing | DE |
| Voice surface | **MIXED** — every status, caption, aria-label and placeholder is German, but the whole error set that replaces the status line is English (14 strings from `realtimeRuntime.ts` / `useRealtimeVoiceScout.ts`, listed in §8) |
| Scout page | **MIXED** — German stages and German `readableError()` strings around English starters, result cards, attention card, activity `<details>`, and an English `there` fallback in `Hey {name}.` |
| Everything else — Explore, signal detail, map, auth form, My search, Settings, all approval dialogs, all of Ops | EN |

There is **no i18n layer**: every string is a hard-coded JSX literal or a module-level constant
(`statusCopy`, `STATUS_COPY`, `statusLabels`, `actionLabels`, `kindLabels`, `channelLabels`, `copy`,
`descriptions`, `filterChips`, `sortOptions`, `starters`, `faqs`, `storyLines`, `statuses`).
A DE/EN toggle requires extracting **all** of them.

---

## 10. Open questions for the port

1. Does the prototype cover any market-browsing surface at all, or do `/explore`, `/signals/:id` and `/map`
   get deleted outright (and with them `mapbox-gl`, `SignalCard`, `SignalBadge`, `convexAdapters.publicSignalToMarketSignal`)?
2. Is there a prototype home for the three-pane inbox, or does „Nachrichten“ collapse into the Scout thread?
3. Where does the portal-login flow live in the prototype (`Settings.dc.html` has „Demo-Anmeldung“ /
   „Anmeldung öffnen“)? Is a full Live-View run page (`/app/runs/:runId`) still needed, or is it replaced by
   an in-Settings simulation?
4. Does `/app/search` survive as its own route, or do its three tabs fold into Scout (brief) + Settings
   (sources, autonomy) + an activity view?
5. Which `--signal` wins — `#ff6926` (design-system / prototype) or `#ff6b2c` (app.css tokens that still
   feed `--signal-soft` / `--signal-border`)? All derived tokens must be re-derived from the winner.
6. Does the ported UI keep the "ledger card" language (`.lcard` border + header/footer strips) or move to the
   prototype's flat sections with hairline dividers?
7. Prototype Settings shows „Export“, „Konto löschen“, „Aktivität im September“ and „Gesprächsverlauf“, which
   the app does not implement. Build them, or ship the surface with those rows omitted?
8. Prototype Operator is German and uses „Aufgaben“/„Vorgänge“/„Feature-Flags“/„Diagnose-Sheet“; today's Ops is
   English and organized around Firecrawl/AgentMail/Browserbase internals. Is Ops re-modelled to the prototype's
   information architecture, or kept as-is behind the operator gate?
9. For the DE/EN toggle: is German the source language (prototype) with English as translation, and do
   operator screens get translated at all?
10. Which shadcn primitives replace which globals — does `.btn/.btn-p/.btn-s/.btn-g` become `Button`,
    `.fchip` become `Toggle`, `.seg` become `ToggleGroup`, `.q` become the existing `Table`, `.drawer` become
    `Sheet`, `.pill` become `Badge`? And do Settings/Operator use the `sidebar-13` dialog-with-sidebar block as
    a **route** (as today) or as an actual modal dialog (as the block does)?
