# `docs/UI_PORT/` — implementation map for the prototype-derived UI rebuild

This folder is the complete, self-contained specification for rebuilding the RoomScout app UI 1:1
from the Claude Design prototype. It exists so that a builder can implement any screen **without
opening the prototype files** and without reading the old React code: every inline style string,
every German copy string, every state transition, every backend binding and every open decision has
been transcribed into these documents.

**Prototype (source of truth):**
`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype/`
— `Roomscout.dc.html` (Scout shell + all ten stage views), `Settings.dc.html`, `Operator.dc.html`,
`Landing v2.dc.html`, and `Landing.dc.html` (**v1, superseded — out of scope**, see `TOKENS.md` §0
and `LANDING_SCREENS.md` §0).

**Target:** React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui (`components.json`: style
`new-york`, base `neutral`, `cssVariables: true`, ui alias `@/components/ui`) on branch `ui-port`,
against the existing Convex backend. Settings and Operator are both built from the shadcn block
**`sidebar-13`** (a `Sidebar` inside a `Dialog`, breadcrumb header, close button). The UI ships
**bilingual DE/EN with a toggle**, so every copy string in these docs is quoted verbatim —
including `„ “`, `·`, `–`, `—`, `€`, `…`, `’`, `↓`, `↗` and `<br>` line breaks. **Never paraphrase a
quoted string.**

---

## 0. The eleven documents at a glance

| File | Lines | Kind | Answers |
|---|---:|---|---|
| [`TOKENS.md`](./TOKENS.md) | 2253 | prototype → design system | What every colour, size, radius, shadow, font and easing is |
| [`tokens.proposed.css`](./tokens.proposed.css) | 898 | artefact | Paste-ready `:root` / `@theme inline` / keyframes / background recipe |
| [`SCOUT_SCREENS.md`](./SCOUT_SCREENS.md) | 2043 | prototype spec | What the Scout surface looks like, per stage |
| [`SCOUT_STATE.md`](./SCOUT_STATE.md) | 1916 | prototype spec | How the Scout surface behaves — state machine, timers, demo script |
| [`SETTINGS_SCREENS.md`](./SETTINGS_SCREENS.md) | 1648 | prototype spec | The whole Settings surface (7 sections + 2 overlays) |
| [`OPERATOR_SCREENS.md`](./OPERATOR_SCREENS.md) | 1656 | prototype spec | The whole Operator surface (6 pages + diagnose sheet) |
| [`LANDING_SCREENS.md`](./LANDING_SCREENS.md) | 1332 | prototype spec | The marketing landing page and its scroll engine |
| [`COMPONENT_MAP.md`](./COMPONENT_MAP.md) | 1273 | build plan | Which shadcn primitive, which file, which motion, which i18n key |
| [`DATA_MAP.md`](./DATA_MAP.md) | 2265 | backend reference | What the Convex backend actually serves today |
| [`DATA_BINDING_PLAN.md`](./DATA_BINDING_PLAN.md) | 2065 | build plan | Which query/mutation backs each prototype control |
| [`APP_UI_INVENTORY.md`](./APP_UI_INVENTORY.md) | 1494 | pre-port baseline | What the current app renders today, classified (a)/(b)/(c) |
| [`BACKLOG.md`](./BACKLOG.md) | 621 | gap list | The two-way gap: app-without-prototype, prototype-without-backend |

Two families: **prototype specs** (`*_SCREENS.md`, `SCOUT_STATE.md`, `TOKENS.md`) describe the target
and are normative for pixels and copy; **repo-facing docs** (`APP_UI_INVENTORY.md`, `DATA_MAP.md`,
`DATA_BINDING_PLAN.md`, `BACKLOG.md`, `COMPONENT_MAP.md`) describe what exists and how to get from
here to there.

---

## 1. What each document contains, and when you need it

### `TOKENS.md`
A mechanically produced inventory of every styling value in the four in-scope `.dc.html` files
(1 017 inline `style` attributes and 143 `style-hover` attributes, split on `;` and grouped, plus the
per-file `<helmet>` `<style>` blocks and the `data-dc-script` sources), followed by a curated design
system built on top of it. **Part A** is the raw inventory with exact occurrence counts per surface
(`R` Roomscout · `S` Settings · `O` Operator · `L` Landing v2); **Part B** is the curated semantic
palette; **Part C** the scales (spacing, radii, type, dot sizes, control heights); **Part D** the
mapping onto shadcn/ui's CSS-variable schema as a single dark theme; **Part E** the background recipe
(the layered gradient stack every surface sits on); **Part F** the inconsistencies found across
surfaces with a proposed canonical value for each. The prototype ships **no classes and no CSS
variables**, so this file is the only place where the raw values become a system. It contains **no
copy**. Read it before writing a single line of CSS; return to Part F whenever two surfaces disagree
about a value, and to Part E before building the shell.

### `tokens.proposed.css`
The executable companion to `TOKENS.md`: a ready-to-paste stylesheet with the `:root` token block,
the Tailwind v4 `@theme inline` bridge, the six shipped keyframes and the background recipe. Step 1
of the build order copies it to `src/styles/tokens.css`. Every `--rs-*` name used in
`COMPONENT_MAP.md` is declared here; anything not in this file is flagged there as **NEW TOKEN**.

### `SCOUT_SCREENS.md`
The visual specification of the Scout shell (`Roomscout.dc.html` template, lines 1–645). §0 is the
`.dc.html` format primer (`{{ }}` bindings, `<sc-if>`, `<sc-for>`, `<dc-import>`, `style-hover`,
editor-only `hint-*` attributes). §1 the surface's own token block, §2 the global chrome, §3 the
voice blob (the Scout avatar), §4 the search brief in its two presentations. §§5–14 are one section
per stage — Willkommen, Gespräch, Suchauftrag, Autopilot, Rückfrage, Angebot, Prüfung, Abschluss,
Sackgasse, Kandidaten — each with the full DOM, verbatim inline styles and hover styles. §15 the
state machine, timings and demo script as the template sees them; §16 the responsive matrix (every
binding that changes with `narrow` / `mobile`); §17 the state-dependent variant index; §18 the
complete German copy dictionary; §19 porting notes. This is the primary document for anyone
building a Scout stage.

### `SCOUT_STATE.md`
The behavioural twin of the above: the React class in `Roomscout.dc.html`'s
`<script type="text/x-dc" data-dc-script>` block (lines 646–1230), re-expressed as a typed state
machine. §0 is a port summary table; §§1–6 runtime primitives, state model, verbatim constants
(`STAGES`, `SCRIPT`, `STATUS`, `ACT`), the fact model, derived helpers and the stage machine; §7 the
word-by-word discovery engine; §8 the branch flows; §§9–11 voice vs. text mode, pause/hold/resume and
the autonomy gating in `attemptContact()`; §§12–13 the state this file owns on behalf of Settings and
Operator; §§14–16 toast/hint/transcript, responsive values carried in script, and the five
notification strings; §17 the demo controls (**not to be built**); §18 the binding index — every key
the props object exposes; §19 a typed skeleton for the port plus the catalogued prototype defects;
§20 the copy dictionary. Read it alongside `SCOUT_SCREENS.md`, never instead of it: the screens doc
tells you what to render, this one tells you when.

### `SETTINGS_SCREENS.md`
Exhaustive spec for `Settings.dc.html` (653 lines), which the Scout shell mounts via `<dc-import>`
at `Roomscout.dc.html` line 67 with `data` / `actions` / `page` / `back-req` props. §0 documents the
contract — editor props, the `DEMO` data blob, the `A` handler bag, and what happens in "standalone"
mode when no `actions` are passed. §1 the outer dialog framing, §2 the sidebar, §3 the content
column, then one section each for **Quellen & Zugänge**, **Handlungsspielraum**, **Was dein Scout
weiß**, **Profil**, **Benachrichtigungen**, **Tarif & Nutzung** and **Datenschutz**, plus the
discard-changes dialog (§6), the „Verbindung zu roomscout.dev“ sheet (§12), the three-step „Kontext
importieren“ dialog (§13) and the toast (§14). §15 is the state-variant checklist, §16 the
`sidebar-13` assembly plan, §17 the German copy dictionary. Needed whenever you touch Settings, and
consulted from the Scout build for the `settingsData` / `settingsActions` contract.

### `OPERATOR_SCREENS.md`
Same treatment for `Operator.dc.html` (296 lines), including the host wiring that makes the
cross-surface incident flow work (the exact `Roomscout.dc.html` and `Settings.dc.html` line ranges are
cited in the header). §1 framing and host embedding, §2 the shared style vocabulary, §3 the global
shell, §4 the sidebar, then one section per page — **Betrieb im Blick**, **Quellen**, **Aufträge**,
**Integrationen**, **Feature-Flags**, **Diagnose** — plus the diagnose sheet (§11), the end-to-end
incident flow (§12), the feature flags and their effects (§13), the illustrative sample data (§14),
the complete state model (§15), the `sidebar-13` mapping (§16), the German copy dictionary (§17) and
the referenced assets (§18). Note that the Operator surface has **no `mobile` prop and no
breakpoints** — it is desktop-only in the prototype (§15.3).

### `LANDING_SCREENS.md`
Spec for `Landing v2.dc.html` (349 lines). §0 is a one-paragraph v1→v2 diff (useful because
`TOKENS.md` deliberately excludes v1 and two v1-only rules must not be carried over). §1 the global
shell, fonts and `<helmet>`; §2 the scroll engine, state model and reduced-motion handling — the part
most likely to be got wrong; §3 header/navigation; §§4–12 one section per beat: hero, „So funktioniert
RoomScout“, Gespräch → Suchauftrag, „Der Scout arbeitet“, the interactive Rückfrage branch, the
Angebot, the four-card feature bento, Kontrolle & FAQ, and the closing CTA + footer. §13 the `narrow`
(`window.innerWidth < 880`) variant table, §14 the complete state-dependent variant list, §15 assets,
§16 the shadcn mapping summary, §17 the German copy dictionary, §18 the link targets to re-map. The
landing page is self-contained: it depends only on the primitives and the blob recipe, which is why
the build order puts it last.

### `COMPONENT_MAP.md`
The bridge from the four screen specs to actual files. **Part 1** inventories every cross-surface
atom and molecule — chrome atoms, buttons, form controls, surfaces/containers, data-display
molecules — each with its verbatim style signature, its `--rs-*` tokens, its build class and its
shadcn origin. **Part 2** covers the surface-specific molecules (R/S/O/L). **Part 3** is the shadcn
CLI install list, what is deliberately *not* installed, and what stays custom. **Part 4** the file
layout under `src/` and the runtime component tree. **Part 5** the motion inventory: six keyframes to
ship, the complete CSS-transition list, the scripted/WAAPI animations that must stay JS, the
UI-visible timer inventory and reduced-motion handling. **Part 6** the DE/EN copy architecture —
mandatory namespacing (the four screen docs collide), dictionary shape, interpolation/plurals/dates,
provider + hook + toggle, and a mechanical extraction plan. **Part 7** the nine-step build order
(tokens → shadcn install + icons → primitives → chrome → copy layer → Scout → Settings → Operator →
Landing → `en.ts` + parity test). **Part 8** the open questions and the deltas already decided.
Read Parts 3, 4 and 7 before writing any code; read Part 6 before writing any string.

### `DATA_MAP.md`
What the existing Convex backend serves, read from the working tree on `ui-port`. §0 client wiring
and conventions; §1 a per-route/surface walk-through of every query, mutation and action currently
called; §2 the shared surfaces; §3 the Scout domain model as the frontend sees it; §4 a proposed
mapping from prototype stages to backend state; §5 auth and the user/role model; §6 the tests that
pin these contracts; §7 the gaps the new UI will hit; §8 a DE/EN copy inventory of server-authored
strings. Use it as the reference manual behind `DATA_BINDING_PLAN.md` — when the plan names a
function, this file tells you its arguments and return shape.

### `DATA_BINDING_PLAN.md`
The prescriptive counterpart: for every prototype stage, view, section and control it names the
backend state that derives it, the mutation or action each control calls, the required loading /
empty / error treatment, what is **purely demo-simulated and must not be faked** (§8), and what has
no backend counterpart today and how to treat it (§9). §1 lists the settled product rules that
constrain every binding; §2 the one data layer; §3 the Scout stage derivation from backend state;
§4 the Scout surface control by control; §5 Settings section by section; §6 Operator page by page;
§7 the loading/empty/error contract; §10 the minimal backend additions in priority order; §11 the
open questions. Where a claim contradicts `DATA_MAP.md` the repo was re-read and the difference is
marked ⚠. This is the document that stops a builder from wiring a demo animation to a real mutation.

### `APP_UI_INVENTORY.md`
A purely descriptive snapshot of everything the running app rendered before the port, so each existing
element can be matched against the prototype. Every panel and control row is classified **(a)** has a
prototype counterpart, **(b)** legacy with no counterpart, **(c)** unclear — backed by a keyword scan
across the five `.dc.html` files which establishes that the prototype has **no** Explore/market
surface, **no** signal-detail page, **no** map/globe screen, **no** standalone three-pane inbox and
**no** Browserbase Live-View page. §1 the route map, §2 global chrome, §3 the three stylesheets and
their conflicts, §4 the existing `src/components/ui/` primitives, §5 public routes, §6 musician
routes, §7 `/ops/*`, §8 the shared component inventory, §9 the roll-up of what survives, §10 open
questions. Needed when deciding whether an existing component can be kept, restyled or deleted.

### `BACKLOG.md`
The two-way gap, in two tables. **Table 1**: current-app UI with no prototype home (delete, hide, or
find a home). **Table 2**: prototype elements the app cannot back yet. §3 covers cross-cutting items
that are not single elements; §4 enumerates verbatim every string set that a table row could only
name by count — so no string anywhere in this folder is left as a `…` range (the one exception,
`MUSIC_CONTEXT_IMPORT_PROMPT`, is cross-referenced to `APP_UI_INVENTORY.md` §8). Read it when
scoping the port and again before deleting anything.

---

## 2. Recommended reading order

**Always first, for every surface** (the shared prologue):
1. `TOKENS.md` §0 (method), Part D (shadcn mapping), Part E (background recipe), Part F (canonical values)
2. `tokens.proposed.css` — skim the declared `--rs-*` names
3. `COMPONENT_MAP.md` Part 0 (legend), Part 3 (install list), Part 4 (file layout), Part 6 (copy architecture), Part 7 (build order)
4. `DATA_BINDING_PLAN.md` §0 (reading key), §1 (settled product rules), §2 (the one data layer), §7 (loading/empty/error contract), §8 (what must not be faked)

### (a) Scout surface
1. `SCOUT_SCREENS.md` §0 — the `.dc.html` format primer. Do not skip; every other screen doc assumes it.
2. `SCOUT_SCREENS.md` §§1–4 — surface tokens, global chrome, the voice blob, the search brief.
3. `SCOUT_STATE.md` §0 (port summary), §§1–6 (primitives, state model, verbatim constants, fact model, derived helpers, stage machine).
4. `SCOUT_STATE.md` §7 (discovery engine) + `SCOUT_SCREENS.md` §6 (Gespräch) — build these together; they are the two hardest motions and the build order puts them first.
5. `SCOUT_SCREENS.md` §§5, 7–14 with `SCOUT_STATE.md` §8 (branch flows) beside them — one stage at a time.
6. `SCOUT_STATE.md` §§9–11 — voice mode, pause/hold/resume, autonomy gating.
7. `DATA_BINDING_PLAN.md` §3 (stage derivation) and §4 (per-control bindings), then `DATA_MAP.md` §3 (domain model) and §4 (stage ↔ backend state) for the shapes.
8. `SCOUT_SCREENS.md` §16 + `SCOUT_STATE.md` §15 — responsive; `COMPONENT_MAP.md` Part 5 — motion and timers.
9. `SCOUT_SCREENS.md` §18 + `SCOUT_STATE.md` §20 — copy dictionaries, last.
   *Skip `SCOUT_STATE.md` §17 (demo controls) — explicitly not to be built.*

### (b) Settings
1. `SETTINGS_SCREENS.md` §0 — the data/actions contract and the `DEMO` blob. Everything else depends on it.
2. `SCOUT_STATE.md` §12 — the Settings-owned state that actually lives in the Scout script.
3. `SETTINGS_SCREENS.md` §16 (`sidebar-13` assembly) + `COMPONENT_MAP.md` §2.2 — build the shell before any section.
4. `SETTINGS_SCREENS.md` §§1–3 (framing, sidebar, content column), then §§4–11 section by section, then the overlays §§6, 12, 13 and the toast §14.
5. `DATA_BINDING_PLAN.md` §5 — the per-section bindings; `DATA_MAP.md` §2 for the shapes.
6. `SETTINGS_SCREENS.md` §15 — the state-variant checklist, as an acceptance list.
7. `SETTINGS_SCREENS.md` §17 — copy dictionary.

### (c) Operator
1. `OPERATOR_SCREENS.md` §1 — framing and host embedding (this surface only exists inside the Scout shell).
2. `SCOUT_STATE.md` §13 — the Operator bridge and the incident flow as the host drives it.
3. `OPERATOR_SCREENS.md` §16 (`sidebar-13` mapping) + §§2–4 (style vocabulary, shell, sidebar) — reuse the `SidebarShell` built for Settings.
4. `OPERATOR_SCREENS.md` §§5–10 — one page at a time; then §11 (diagnose sheet).
5. `OPERATOR_SCREENS.md` §12 (incident flow end-to-end) and §13 (feature flags and their effects) — these two are what make the surface more than a static dashboard.
6. `DATA_BINDING_PLAN.md` §6 — per-page bindings; `APP_UI_INVENTORY.md` §7 for what `/ops/*` renders today.
7. `OPERATOR_SCREENS.md` §14 (sample data — illustrative only), §15 (state model), §17 (copy dictionary).

### (d) Landing
1. `LANDING_SCREENS.md` §0 — the v1→v2 diff, so you never pull a value from `Landing.dc.html`.
2. `LANDING_SCREENS.md` §1 (global shell, fonts, `<helmet>`) and §2 (scroll engine, state model, reduced motion) — §2 is the whole page's engine; build and verify it before any section.
3. `LANDING_SCREENS.md` §3 (header), then §§4–12 in document order — the beats are sequential by design.
4. `LANDING_SCREENS.md` §13 (`narrow` < 880 px) and §14 (state-dependent variants).
5. `COMPONENT_MAP.md` §2.4 + Part 5 — the landing-specific molecules and the motion inventory.
6. `LANDING_SCREENS.md` §15 (assets), §16 (shadcn mapping), §17 (copy), §18 (link targets to re-map).
   *Landing needs no backend reading at all; it is scroll- and click-driven only.*

---

## 3. Open questions for the maintainer

Consolidated from the eleven per-document lists, deduplicated and grouped. Each item names the
document(s) that raised it. Items marked **blocks build** must be answered before the corresponding
step of `COMPONENT_MAP.md` Part 7.

### 3.1 Cross-cutting policy

1. **Is "rebuild 1:1" binding, or advisory where the prototype is inconsistent?** `TOKENS.md` Part F
   recommends collapsing alpha ladders and font sizes (F8/F9/F10/F19/F20/F25), but with the corrected
   inventory several of those values turn out to be load-bearing (`rgba(255,255,255,.07)` and `.14`
   are resting states, not only hovers; the three underline colours are three roles). Decide whether
   Part F is advisory or binding before a builder starts. **blocks build**
   *(TOKENS)*
2. **Does 1:1 include reproducing missing affordances?** Several surfaces lack hover states purely as
   an artefact of inline-style ordering: Operator's active nav item, Operator's filter chips, and
   Landing's seven text anchors (inline `color` beats `a:hover`). The docs recommend adding hovers
   and letting shadcn's defaults stand. Confirm, or flip to strict replication.
   *(OPERATOR, LANDING, COMPONENT_MAP)*
3. **Accessibility over strict fidelity?** Adopting shadcn `Dialog` / `AlertDialog` / `Sheet` /
   `DropdownMenu` adds focus trapping, outside-click close and focus restore that the prototype
   lacks. The most visible case is the Settings knowledge-row kebab, which currently stays open on
   outside click. Confirm the deltas stand.
   *(SETTINGS)*
4. **Dead fields in the surface data contracts.** Settings is passed `d.usableCount`, `d.initials`,
   `d.stage`, `d.hasFacts`, `d.incident`, `d.offerStale` and `flags.voice` but reads none of them;
   Operator is passed `opData.stage` and never reads it. Keep them in the port's contract (other
   surfaces may consume them) or drop them?
   *(SETTINGS, OPERATOR)*

### 3.2 Responsive & mobile

5. **Is the `mobile` device frame in scope at all?** `Roomscout.dc.html`'s `mobile` editor prop draws
   a 390×844 phone frame (44 px radius, 0.4 s transition on the `data-stage` element). Is that a
   prototype-preview affordance only — in which case the port implements only the `narrow` ≤ 959 px
   breakpoint and collapses `stL/stT/stW/stH/stTf/stR/stB` to the desktop branch — or does the port
   need it? **blocks build**
   *(SCOUT_SCREENS, TOKENS)*
6. **Settings below 900 px is invented, not measured.** The prototype's own mobile preview collapses
   the Settings content column to ~20 px. The fallback plan (sidebar as a `Sheet` below 900 px,
   reduced paddings, stacked source rows, single-column billing stats, bottom sheet for the
   connection panel) is a proposal that has never been validated against a real render. Needs a
   design decision.
   *(SETTINGS, BACKLOG)*
7. **Does Operator get a mobile layout at all?** The Operator surface has no `mobile` prop and no
   breakpoints. If it stays desktop-only, what happens to today's ≤ 820 px `/ops` tab bar?
   *(OPERATOR, BACKLOG)*
8. **Landing's unresolved narrow gaps.** The header nav is not collapsed below 880 px (three anchors
   + CTA in a 3-column grid overflows at 320 px) and bento card D keeps `max-width: 66 %` plus a
   220 px decorative blob. Sheet-based mobile nav and `max-width: 100 %` on card D are proposals the
   prototype does not answer.
   *(LANDING)*
9. **Two `narrow` breakpoints exist** — 959 px (app) and 880 px (landing). Unify, or keep as two
   named breakpoints?
   *(TOKENS)*

### 3.3 Bilingual copy (DE/EN)

10. **No English strings exist anywhere.** Both prototype files are German-only; every EN string still
    has to be written and approved. Included in that: whether the `Du` / `ihr` register split in the
    German copy (`Dein Scout` in the nav vs. `Euer Suchauftrag`) is normalised in English.
    **blocks build** — the copy layer is step 5 of the build order, before any screen.
    *(LANDING, COMPONENT_MAP)*
11. **`summary()` builds sentences by concatenation** (`'Ihr seid eine '`, `' und '`,
    `'vierköpfige '`). The EN dictionary needs sentence-level templates per case; those English
    strings have not been authored anywhere.
    *(SCOUT_STATE)*
12. **`factsFromNeed` bilingual strategy:** 10 English labels + 9 value templates, plus a facet
    renderer that emits a model-authored English label with a German „Ja“/„Nein“ value. Translate the
    fixed set client-side and leave facet labels as-is, ask the Scout to write facet labels in the
    active language, or render them verbatim with a language marker?
    *(DATA_BINDING_PLAN)*
13. **How are server-authored strings translated?** The two `searchSources` disclosures, the
    provider-conversation blocker prefix, all `notifications` titles/bodies, and model output
    (`assessment.summary`, blockers, uncertainties). Translate server-side, or render as-is with a
    language marker?
    *(DATA_MAP)*
14. **Error copy has no German.** ~30 English error fallbacks, the ConvexError code map the port must
    introduce, and the voice surface's 14 error strings (German everywhere else). Is English the
    source language for all error copy, or do these get German wording?
    *(DATA_MAP, APP_UI_INVENTORY)*
15. **~20 new German strings need authoring:** the four unnamed `portalUiStatus` states, the
    pending-connection state after „Einbeziehen“, the five mailbox states, the five §4.4.2 outcome
    strings, `scout.status.awaitingSubmit`, and the `contactEligible === false` reason. Maintainer
    writes them, or shall the port propose DE/EN pairs?
    *(DATA_BINDING_PLAN)*
16. **Competing vocabularies for the same concepts.** `ActionApprovalSheet.kindLabels` and
    `MandatePanel.actionLabels` describe the same action types with different phrasing — two
    vocabularies (dialog vs. settings) or one? Likewise the three different wordings of the same
    search facts (`factsFromNeed` on `/app/scout`, `savedNeedToSearch` on `/app/search`, ScoutPage's
    local `marketSignal`), the draft mandate's stop condition (`A login or human-only step is
    required` vs. `A human-only step is required`) and the `Sharing` field (`Open to compatible
    room-sharing` vs. `Open to a compatible band`). Which wording is canonical?
    *(APP_UI_INVENTORY, DATA_MAP)*
17. **Should `common.*` be widened beyond the 7 source keys?** The docs contain no shared bag for
    „Speichern“ / „Übernehmen“ — they live under per-surface prefixes. Widening is a port decision to
    be logged before `de.ts` is written. **blocks build**
    *(COMPONENT_MAP)*
18. **Locale default.** Currently recorded as DE unconditionally, with the no-op `navigator.language`
    probe removed. If EN is wanted for non-German browsers, one line in `COMPONENT_MAP.md` §6.4 and
    one row in §8.2 change.
    *(COMPONENT_MAP)*
19. **Is the Operator surface translated at all?** If not, its 174 keys drop out of the 871 total and
    the `en.ts` parity test must be scoped to `scout` / `settings` / `landing` / `common` only; the
    §6.5 table currently assumes it is translated.
    *(COMPONENT_MAP)*
20. **Confirm the three excluded/hoisted key blocks** — SCOUT `demo.*` (28), LANDING `v1.*` (43),
    SETTINGS `common.*` (7, hoisted). `demo.*` in particular: `SCOUT_SCREENS.md` §18.18 says "NOT to
    be built", but if any dev-bar affordance survives into the port those keys come back.
    *(COMPONENT_MAP)*

### 3.4 Scout surface

21. **`backToConvo` crashes the prototype.** „Ja, leg los.“ sets `stepIndex = SCRIPT.length`, so
    `SCRIPT[8]` is undefined and four call paths throw. Two resolutions are on the table: (a) play it
    as a synthetic user utterance that goes straight to `morphToBrief()` — recommended — or (b) add
    a synthetic terminal `SCRIPT` step (which needs new German copy, e.g. a scout confirmation line
    with `then: 'brief'`) or guards at all four call sites. **blocks build**
    *(SCOUT_SCREENS §7, SCOUT_STATE defect #1)*
22. **`Sched.paused` survives `go()`** (defect #9): derive `paused` from
    `searchPaused || sessionHeld || demoPaused`, or clear it in the stage-reset action?
    *(SCOUT_STATE)*
23. **`arriveReply` swallows the reply** while `waitingFor` is set and never re-arms (defect #10).
    Re-arm the reply timer after unblocking, or keep the prototype's one-shot behaviour?
    *(SCOUT_STATE)*
24. **`keepSearching` / `keepWaiting` park the flow with no timer** (§19.1 #6). Same question for the
    port.
    *(SCOUT_STATE)*
25. **Three UI paths are unreachable from the default state** and were built but never exercised: the
    §8.3 approval card (`rules.mode: 'review'` / `contact: false`), §8.4 `waitingSource`, §8.5
    `waitingAccess`. Do they ship, or only once Settings/Operator can toggle the flags that reach
    them?
    *(SCOUT_SCREENS)*
26. **Two computed variants are never rendered:** the amber budget variant („Über eurem Budget
    (350 €)“ / `#e0a13a`) and the `outside` / `inArea` out-of-area marker. Build them (the copy string
    still needs a DE+EN pair) or drop them and remove the computed fields?
    *(SCOUT_SCREENS)*
27. **Dead-end budget line:** §13 hard-codes „Budget bis 400 €“ while `renderVals()` exposes the
    dynamic `deadBudget = 'Bis ' + (budgetNum + 50) + ' €'`. They agree only at the default budget.
    Literal or dynamic?
    *(SCOUT_SCREENS)*
28. **Review-card photo:** the `<img>` always renders `assets/proberaum.png`, so a candidate picked
    without a photo (Esslingen, Stuttgart-Ost) shows the wrong room. Keep the prototype behaviour, or
    use the „Foto folgt vom Anbieter“ placeholder that §10.2 and §14 already define?
    *(SCOUT_SCREENS)*
29. **The toast never auto-dismisses** in the source. Keep it manual-dismiss-only (recommended — it
    is the only signal that something happened while the user was in Settings or Operator), or give
    it a duration?
    *(SCOUT_SCREENS)*
30. **The complete stage's subline is false in the real app:** „Demo abgeschlossen — es wurde keine
    echte Zusage versendet.“ — an acceptance *is* sent. Replacement wording is a maintainer call.
    *(BACKLOG)*
31. **„Mein Vorschlag“ selection rule:** port the prototype's exact rule (cheapest candidate that fits
    budget, keeps the drum kit, and is in area) or substitute `match.score`?
    *(BACKLOG)*
32. **Voice 15-minute cap UX:** the session disconnects unconditionally 15 min after `connectedAt` and
    the prototype has no copy for it. Visible countdown from the start, warning only in the last
    minute, or a silent end landing on „Gespräch beendet …“?
    *(DATA_BINDING_PLAN)*
33. **Clarification trigger:** should `providerAssessment.nextAction === "ask_musician"` — a
    persisted, model-made decision the user must answer — replace or supplement
    `opportunity.uncertainties.length > 0` in the §3.1 step-6 derivation? Recommendation is to
    supplement; not changed without a decision.
    *(DATA_BINDING_PLAN)*
34. **Outcome-card lifetime (§4.4.2):** an outcome belongs to the request, not the stage, and should
    persist until dismissed — but there is no `dismissedAt` on `actionRequests`, so it is per-session
    local state unless a field is added.
    *(DATA_BINDING_PLAN)*

### 3.5 Settings

35. **Standalone mode throws on almost every click** (`A.toggleSource is not a function`). Recorded
    as a prototype bug, with a genuine no-op bag prescribed for the port's storybook/preview mode.
    Confirm, rather than reproducing the throw for fidelity.
    *(SETTINGS)*
36. **The connection sheet is hard-wired to the `roomscout` source** while its trigger renders on
    every `kind: 'portal'` row. Parameterise the sheet by source id (the demo data has only one
    portal, so a strict 1:1 port would be observationally identical) — confirm the fix.
    *(SETTINGS)*
37. **The „Weitere Quellen“ panel duplicates every row already in the main list,** and the
    „Gespeichert“ flash from a more-list toggle lands on the main row, not the clicked one. Reproduce
    both, or fix (filter already-listed sources; scope the flash to the clicked row)?
    *(SETTINGS)*
38. **`state.originId` („Herkunft: … Verwendet für: …“) has no close control and never clears.** Keep
    that, or add a dismissal (Escape / outside click / a close affordance)?
    *(SETTINGS)*
39. **Does the app adopt the prototype's fact/knowledge split,** where rows carrying a `factId` cannot
    be retired (toast „Diese Angabe gehört zum Suchauftrag…“) and only non-fact items get the 6000 ms
    undo? Today's `deleteFact` makes no such distinction.
    *(BACKLOG)*
40. **Source preference shape:** the enum is `include | prefer | neutral | exclude`, the default is
    `neutral`, and only `exclude` changes behaviour (the sole value `enableDefaultAutopilot` reads).
    An honest two-state switch is specified. Is `prefer` meant to gain an effect — in which case
    `enableDefaultAutopilot` needs one first?
    *(DATA_BINDING_PLAN)*
41. **Mandate already in `research_autopilot` / `outreach_autopilot`:** two prototype radios, four
    backend modes. A read-only third state naming the actual mode plus an explicit switch action is
    specified, because both collapses are dishonest (one widens authorization, one misreports it).
    Confirm.
    *(DATA_BINDING_PLAN)*

### 3.6 Operator

42. **Empty `t2` detail text.** Three fixes offered — write real expired-state copy (recommended),
    hide empty detail rows, or clear `openTask` on incident change. If real copy is chosen, DE **and**
    EN strings must be authored; suggested source is the sheet's Ursache/Auswirkung lines.
    *(OPERATOR)*
43. **Diagnose sheet reachability after resolution:** gate the trigger on `hasIncident` instead of
    `incidentOpen` so the resolved state stays inspectable. A deliberate deviation that needs sign-off.
    *(OPERATOR)*
44. **„Letzter Demo-Check“ in English:** proposed `Today, {time}` via `Intl` with en-US 12-hour output
    (`Today, 9:41 AM`). Or should EN use 24-hour time to stay visually consistent with the DE column?
    *(OPERATOR)*
45. **The calm banner and the Diagnose no-incident card both end with a sentence pointing at the demo
    control bar.** Truncating to the first sentence is suggested; the replacement second sentence (if
    any) is undecided.
    *(BACKLOG)*
46. **„Betreiberansicht“ has no product-UI entry in the prototype at all.** Does it become an
    operator-only row in the ported avatar menu, or stay reachable only by URL behind
    `RequireOperator`?
    *(BACKLOG)*
47. **Does the ops cockpit keep its sidebar layout, or does `sidebar-13` replace it?** The musician
    shell has no sidebar at all today, so "Settings and Operator follow `sidebar-13`" implies a new
    layout for ops, not a restyle.
    *(DATA_MAP)*

### 3.7 Landing

48. **Reduced motion:** reproduce the source's one-shot `matchMedia` capture (no runtime
    re-evaluation until the next scroll frame), or use a subscribing `useReducedMotion()` hook —
    better a11y, not 1:1?
    *(LANDING)*
49. **Heading outline:** keep the source's exact outline (one `h1`, four `h2`, three `h3`, bento card
    titles as plain `<div>`s, the FAQ question as a `<span>`), or improve the a11y tree by promoting
    bento card titles to `h3` and letting shadcn's `AccordionTrigger` keep its default `h3` wrapper?
    The doc currently specifies 1:1.
    *(LANDING)*
50. **Sticky-branch flip point:** the ≈900 px viewport-height threshold for the hero is derived from
    the current 1586×992 `hero-preview.png` at a 1120 px card width. When the screenshot is re-shot
    from the real app at a different aspect ratio, the threshold moves — re-measure rather than
    hard-coding it.
    *(LANDING)*
51. **Where does the German/English toggle live on the landing page,** and what is its hover
    treatment? It has no prototype precedent at all.
    *(LANDING)*

### 3.8 Tokens & assets

52. **Primary control height:** the corrected counts say 46 px (27 uses vs. 23), and
    `--rs-control-h: 46px` is set. If a 44 px touch-target baseline is wanted instead, that is a
    deliberate deviation and should be recorded as such rather than silently applied.
    *(TOKENS)*
53. **Dot sizes:** all five (6/7/8/9/12 px) are kept as separate tokens. If a single status-dot
    component is wanted, someone must decide whether Settings' 9 px or Roomscout's 8 px wins.
    *(TOKENS)*
54. **`--gray-100` is consumed in three places but never defined** (elements fall back to `inherit`).
    Define it in the new token ladder, or replace the three usages?
    *(APP_UI_INVENTORY)*
55. **Asset lifecycle:** `hero-preview.png` (1.5 MB) is a screenshot of the app itself — once the real
    app exists, is it replaced by a live render, or re-shot and re-encoded? Same question for
    `proberaum.png`, which is demo content, not chrome.
    *(TOKENS)*
56. **The dev bar** (2 of the 4 monospace uses, `z-index: 10`, `rgba(10,8,7,.88)`) is marked "do not
    ship". Confirm it is prototype-only and not a wanted debug affordance — this also settles the
    `demo.*` copy keys in item 20.
    *(TOKENS, COMPONENT_MAP)*

### 3.9 Backend additions & app behaviour

57. **`api.notifications.listMine` (+ a read mutation):** add it so the prototype's
    activity/notification ledger has real backing, or stay read-free and keep synthesising activity
    client-side?
    *(DATA_MAP)*
58. **`offerAcceptance.canPrepare` (§10.8):** without it, „Angebot prüfen“ can only be optimistic —
    the button opens a dialog that then fails at prepare time whenever the adapter binding, flow
    policy or connection is not active. Build the query, or accept the optimistic failure with
    in-place copy?
    *(DATA_BINDING_PLAN)*
59. **`memory.countMine` (§10.9):** §5.7's „{n} Angaben“ is unreachable truthfully while `listMine` is
    `take(100)`-capped. Add the counter, or keep the label numberless?
    *(DATA_BINDING_PLAN)*
60. **`signal.isDemo`:** demo-provenance signals are today indistinguishable from real ones in every
    list. Badge („Kontrollierte Demo-Quelle“), filter out of the musician surface entirely, or make it
    an operator-only toggle? The plan mandates "badge or filter" without picking one.
    *(DATA_BINDING_PLAN)*
61. **Four controls are documented but unreachable today:** the `SignalCard` action row,
    `SearchProfileCard` edit/confirm, `ActionApprovalSheet`'s standing-mandate branch, and
    `SearchSourcesPanel`'s `connection_required` status / `Connect` control — the last of which also
    makes every card footer read `0 relevant signals` because no caller passes `signalCount`. Port
    them as-is and wire them up, port them dormant, or delete them (and drop the footer metric / add a
    real per-source signal count to the coverage query)?
    *(APP_UI_INVENTORY, DATA_MAP)*
62. **`ApprovalComposer`'s acknowledgement checkbox:** clear it on Subject/Message edits in the new
    UI, or preserve today's behaviour (box stays ticked, the edit is caught by the save branch)?
    *(DATA_MAP)*
63. **The shell's „Nachrichten“ badge counts `api.inbox.listThreadsMine` while `/app/inbox` lists
    `api.communications.listThreadsMine`.** Intentional? Which endpoint should the ported inbox use?
    *(APP_UI_INVENTORY)*

### 3.10 Documentation housekeeping

64. **`SCOUT_SCREENS.md` §15.0 documents `notif`, `autoSources`, `knowledge`/`KNOW0` and `incident`**
    because they are constructor state, but they are consumed by Settings and Operator. Confirm they
    belong in `SETTINGS_SCREENS.md` / `OPERATOR_SCREENS.md` rather than being duplicated.
    *(SCOUT_SCREENS)*
65. **Line references will drift** if the prototype is re-exported — `SCOUT_STATE.md`'s header still
    reads "lines 646–1230" for the script block (correct today). Every screen doc carries similar
    ranges; if the prototype is re-exported they all need re-verification.
    *(SCOUT_STATE)*
66. **Unverified test-pin claims:** `DATA_BINDING_PLAN.md`'s statements about `ScoutPage.test.tsx`,
    `ActionLifecyclePanel.test.tsx`, `ProviderOfferPanel.test.tsx`, `PortalAuthenticationGuide.test.tsx`
    and `mandatePolicy.test.ts` were left as-is. Only the `ProfilePage` and `ScoutConversation` pins
    were audited (one was false and is corrected); the others may warrant the same pass.
    *(DATA_BINDING_PLAN)*
67. **`MUSIC_CONTEXT_IMPORT_PROMPT` (14 lines) is the one string set `BACKLOG.md` §4 does not
    reproduce;** it is cross-referenced to `APP_UI_INVENTORY.md` §8. If `BACKLOG.md` must be
    standalone for i18n extraction, that block needs copying in.
    *(BACKLOG)*
68. **`tokens.proposed.css` was edited alongside `TOKENS.md`** because a finding named a specific line
    in it. If that file was meant to stay untouched, revert it — the backup is at the scratchpad path
    `tokens.bak.css`.
    *(TOKENS)*

---

## 4. House rules for anyone adding to this folder

- All paths in these documents are **absolute**. Keep it that way.
- German copy is **verbatim**, typography included. If a string cannot be quoted exactly, it does not
  go in.
- No document paraphrases another. Copy lives in the screen docs; tokens live in `TOKENS.md`;
  backend shapes live in `DATA_MAP.md`. Cross-reference rather than duplicate.
- When a claim about the repo and the repo disagree, the repo wins — re-read it and mark the
  correction ⚠, as `DATA_BINDING_PLAN.md` already does.
- New open questions go into the raising document's own list **and** into §3 above.
