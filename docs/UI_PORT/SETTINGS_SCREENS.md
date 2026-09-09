# Settings surface — 1:1 port spec

Source of truth: `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype/Settings.dc.html`
(653 lines; `<x-dc>` template + `<script type="text/x-dc" data-dc-script>` React class `Component extends DCLogic`).

Host embed: `Roomscout.dc.html` line 67 — `<dc-import name="Settings" data="{{ settingsData }}" actions="{{ settingsActions }}" page="{{ settingsPage }}" back-req="{{ backReq }}" hint-size="100%,100%" style="height:100%;display:block">`.

This document is exhaustive: a builder must be able to reproduce the whole surface from it without opening the prototype.

---

## 0. Contract, tokens, global CSS

### 0.1 Editor props (`data-props` on the script tag)

| prop | editor | default | tsType | notes |
| --- | --- | --- | --- | --- |
| `data` | null | null | object | the whole settings data blob (see §0.4). Falls back to the internal `DEMO` object when absent. |
| `actions` | null | null | object | handler bag (see §0.5). When absent → "standalone" mode: `A` becomes a plain object holding **only** `setPage` (which writes local state `localPage`); every other action is `undefined` and throws on first use. See §0.5 → "Standalone mode (no `actions`) — what really happens". |
| `page` | enum | `'sources'` | string | one of `sources`, `autonomy`, `knowledge`, `profile`, `notifications`, `billing`, `privacy` |
| `backReq` | null | `0` | number | a change of this number triggers `tryNav(() => actions.back())` |

`$preview`: `{ width: 1360, height: 820 }`.

**There is no `mobile` prop on this file**, and no width-based branching inside it: the only responsive behaviour is CSS `flex-wrap` / `minmax()` / `repeat(auto-fit,minmax(280px,1fr))`, and the 296px sidebar column stays 296px at every width.

The **host does have one**, though, so the Settings surface *does* have an observable mobile rendering in the prototype. `Roomscout.dc.html`'s script tag declares `"mobile":{"editor":"boolean","default":false,"tsType":"boolean","section":"Vorschau"}` and shrinks the whole stage — including the `<dc-import name="Settings">` embed — into a 390px phone frame. See the "Mobile variant" subsection at the end of §15 for the measured result and the required mobile plan in the port.

### 0.2 Constants from the script

```js
const PAGES = { sources: 'Quellen & Zugänge', autonomy: 'Handlungsspielraum', knowledge: 'Was dein Scout weiß', profile: 'Profil', notifications: 'Benachrichtigungen', billing: 'Tarif & Nutzung', privacy: 'Datenschutz' };
const CATS  = { band: 'Eure Band', alltag: 'Alltag & Wege', ausstattung: 'Ausstattung' };
const NOOP  = new Proxy({}, { get: () => () => ({}) });
const SW = on => ({ on, bg: on ? '#ff6926' : 'rgba(255,255,255,.14)', knob: on ? 'translateX(24px)' : 'none' });
```

`IMPORT_PROMPT` and `EXAMPLE` are quoted verbatim in §13.2 / §13.3.

`NOOP` is listed here because it appears in the source, but note that it is effectively **dead code**: it is only ever used as `Object.assign({}, NOOP, { setPage })`, and `Object.assign` copies own enumerable keys — the `Proxy`'s target is `{}` and there is no `ownKeys` trap, so nothing is copied and the `get` trap never fires. See §0.5.

### 0.3 Color + type tokens (derived from the inline styles; there are **no** CSS variables in the prototype)

| token | value | used for |
| --- | --- | --- |
| `--panel-bg` | `rgba(13,10,8,.8)` | outer panel |
| `--panel-border` | `rgba(255,190,140,.16)` | outer panel border |
| `--overlay-bg` | `rgba(18,14,11,.98)` | sheet + dialogs |
| `--overlay-border` | `rgba(255,200,160,.16)` | sheet + dialogs |
| `--text` | `#f5ece2` | primary text |
| `--text-2` | `#cbb9a8` | secondary/lead text |
| `--text-3` | `#e2d3c3` | tertiary (row body, icons) |
| `--muted` | `#a89684` | labels, captions, uppercase group labels |
| `--placeholder` | `#9c8b7b` | `input/textarea::placeholder` |
| `--accent` | `#ff6926` | primary buttons, active toggle, focus ring |
| `--accent-hover` | `#ff7a3d` | primary button hover |
| `--accent-link` | `#ff8a4e` | link hover, active tab color, active nav icon |
| `--accent-soft` | `rgba(255,105,38,.4)` | disabled primary button |
| `--ok` | `#4fbf7a` | connected/available dot |
| `--warn` | `#e0a13a` | expired/needs-login dot, conflict text, copy-failure hint |
| `--danger` | `#b8382a` (hover `#c9463a`) | "Verbindung trennen" confirm button |
| `--error-text` | `#ff8a6a` | perDay validation message |
| `--badge-text` | `#ffd9c4` | "Noch zu bestätigen" pill text |
| `--divider` | `rgba(255,220,190,.1)` | most hairlines |
| `--divider-soft` | `rgba(255,220,190,.08)` | list rows inside panels |
| `--surface-1` | `rgba(255,255,255,.03)` | inset panels |
| `--surface-2` | `rgba(255,255,255,.04)` | cards, ghost buttons, avatar bg |
| `--surface-3` | `rgba(255,255,255,.05)` | undo bar, stepper buttons |
| `--hover-1` | `rgba(255,255,255,.06)` | nav/button hover |
| `--hover-2` | `rgba(255,255,255,.08)` | icon-button hover |
| `--hover-3` | `rgba(255,255,255,.1)` | ghost button hover |
| `--input-bg` | `rgba(0,0,0,.25)` | inputs + textareas only (more-sources search, knowledge inline-edit input, profile name input, import textarea) |
| `--segment-bg` | `rgba(0,0,0,.2)` | Kanal segmented-control group **only** — it is `.2`, *not* `.25`; see §9.3 |
| `--nav-active-bg` | `rgba(120,58,22,.45)` | active sidebar item |
| `--nav-active-border` | `rgba(255,140,90,.35)` | active sidebar item |
| `--radio-active-bg` | `rgba(120,58,22,.28)` | selected mode card |
| `--radio-active-border` | `rgba(255,105,38,.75)` | selected mode card |
| `--lock-bg` | `rgba(120,58,22,.22)` / border `rgba(255,140,90,.22)` | "Verbindliche Entscheidungen" card |
| `--switch-off` | `rgba(255,255,255,.14)` | toggle track, off |
| `--flash-bg` | `rgba(255,105,38,.18)` | knowledge row flash after edit/confirm |

Font family everywhere: `'Geist', system-ui, sans-serif` (Google Fonts `Geist` weights 300;400;500;600).

### 0.4 `data` shape (the `DEMO` fallback verbatim)

```js
const DEMO = {
  name: 'Herzbuben', initials: 'HB', stage: 'waiting', hasOrder: true, hasFacts: true, ort: 'Stuttgart',
  facts: [{ id:'ort', label:'Stuttgart' }, { id:'budget', label:'Bis 350 € / Monat' },
          { id:'band', label:'Geteilter Raum · 4 Personen' }, { id:'zeit', label:'Donnerstags ab 19 Uhr' },
          { id:'equip', label:'Schlagzeug darf im Raum bleiben' }],
  sources: [
    { id:'roomscout', name:'roomscout.dev', desc:'Kontrolliertes Demo-Portal', region:'Stuttgart',
      enabled:true, access:'connected', profile:'Herzbuben', lastAccess:null, kind:'portal' },
    { id:'musiker', name:'Musiker in deiner Stadt', desc:'Stuttgart · Öffentliche Anzeigen',
      region:'Stuttgart', enabled:true, access:'public', kind:'public' },
    { id:'bandnet', name:'Bandnet Hamburg', desc:'Hamburg · Andere Region',
      region:'Hamburg', enabled:false, access:'public', kind:'public' }],
  autoSources: true, usableCount: 1,
  rules: { mode:'autopilot', contact:true, viewings:true, publishAd:false, shareProfile:true, sharePrivate:false, perDay:5 },
  knowledge: [ … 8 items, see §7.5 … ],
  summary: 'Ihr seid eine vierköpfige Band aus Stuttgart. Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen.',
  knowledgeLog: [{ text:'Budget korrigiert: 400 → 350 €', when:'Heute' }],
  notif: { decision:true, offer:true, digest:false, channel:'app' },
  flags: { voice:true, publicSearch:false }, incident:false,
  usage: { searches:1, contacted:1, talk:'Noch nicht erfasst' },
  session: 'Scout ist unterwegs', offerStale:false,
};
```

#### Which of these fields are actually required

The component is defensively coded for *almost* every field, but **two are dereferenced with no guard at all**. The port's data contract must mark them required.

| field | guarded? | what happens when missing |
| --- | --- | --- |
| **`rules`** | **no** | `rules()` returns `this.state.draft \|\| this.data().rules`, and `renderVals` runs `const R = this.rules(); const perDayNum = Number(R.perDay)` **unconditionally**, on every render, on every page. A `data` object without `rules` therefore throws `TypeError: Cannot read properties of undefined (reading 'perDay')` and the **whole Settings surface fails to render** — not just the Handlungsspielraum page. |
| **`facts`** | **no** | `candidates()` opens with `const d = this.data(), band = d.facts.find(…)`. Reached lazily from `checkImport` ("Angaben prüfen"), `useExampleAndCheck` ("Beispiel verwenden") and from the `cands` line whenever `state.picks` is set. A `data` object without `facts` renders fine until the user presses "Angaben prüfen", then throws. |
| `sources` | `d.sources \|\| []` | empty source list |
| `knowledge` | `(d.knowledge \|\| [])` | empty knowledge list, `knowledgeCount: 0` |
| `knowledgeLog` | `(d.knowledgeLog \|\| [])` | `logEmpty` true |
| `notif` | `d.notif \|\| {}` | all switches off, channel falls back to "In der App" (`channel !== 'mail'`) |
| `usage` | `(d.usage \|\| {})` | `0` / `0` / `'Noch nicht erfasst'` |
| `name` | `d.name \|\| ''` (in `nameDraft`) | empty name field, initials `–`; note the sidebar footer binds raw `d.name` and would render empty |
| `flags` | `d.flags && d.flags.publicSearch` | treated as `publicSearch: false` |
| `ort` | `d.ort \|\| 'eurer Stadt'` | lead text "Quellen für eure Suche in eurer Stadt." |
| `hasOrder`, `autoSources`, `session`, `summary` | plain truthiness / direct binding | falsy → empty state / empty text, no crash |

#### Fields present in `DEMO` that the component never reads

`initials`, `stage`, `hasFacts`, `incident`, `offerStale`, `usableCount`, and `flags.voice` (only `flags.publicSearch` is used) are **passed but never consumed** by this component.

`initials` is the one that can actually mislead a builder: the profile avatar does **not** use `data.initials`. It recomputes initials from the *live, possibly unsaved* `nameDraft` on every render, with the `'Herzbuben' → 'HB'` special case and the en-dash `–` fallback (§8.2). Wiring `data.initials` into the avatar produces different output as soon as the name field is edited but not yet saved.

### 0.5 `actions` bag (as implemented by the host, `Roomscout.dc.html` lines 1050–1064)

| action | host implementation | consumed by |
| --- | --- | --- |
| `back()` | `this.backToScout()` | sidebar "Zurück zum Scout", "Zum Scout", "Suchauftrag bearbeiten", `backReq` prop |
| `setPage(p)` | `setState({ settingsPage: p })` | every nav item, "Gespeicherte Informationen verwalten", privacy cross-links |
| `setDirty(d)` | `setState({ settingsDirty: d })` if changed | called from `componentDidUpdate` whenever `!!state.draft` flips |
| `toggleSource(id)` | `this.toggleSource(id)` | source row switch, "Weitere Quellen" row buttons, `pickSource` |
| `setAutoSources(v)` | `setState({ autoSources: v })` | "Passende Quellen automatisch auswählen" |
| `setAccess(id, a)` | `this.setAccess(id, a)` | sheet disconnect (`'none'`) / finish login (`'connected'`) |
| `saveRules(r)` | `setState({ rules: r })` + `logChange('Handlungsspielraum aktualisiert')` | "Änderungen speichern" |
| `setName(n)` | `setState({ name: n, … })` | profile "Speichern" |
| `updateFact(id, label)` | `this.updateFact(id, label)` | knowledge inline save when the row has a `factId` |
| `updateKnowledge(id, patch, logText)` | patches item + `logChange(logText)` | inline save, retire, confirm, dismiss, undo |
| `addKnowledge(items)` | concat + `logChange(n + ' Angaben aus Beispiel-Kontext übernommen')` | import "Ausgewählte Angaben übernehmen" |
| `setNotif(n)` | `setState({ notif: n })` | notification switches + channel radios |
| `exportData()` | returns `{ name, facts, knowledge, sources[{id,enabled,access}], rules, notif, hinweis:'Lokale Demo-Daten des Designprototyps' }` | privacy export |

#### Standalone mode (no `actions`) — what really happens

`renderVals` opens with:

```js
const standalone = !this.props.actions;
const A = standalone ? Object.assign({}, NOOP, { setPage: p => this.setState({ localPage: p }) })
                     : this.props.actions;
```

This does **not** produce a no-op bag. `NOOP` is `new Proxy({}, { get: () => () => ({}) })` over an **empty target**, and `Object.assign` copies only *own enumerable keys*; the proxy has none (no `ownKeys` trap), so its `get` trap is never consulted. `A` ends up as a plain object with exactly one key:

```js
A === { setPage: p => this.setState({ localPage: p }) }
```

Consequently `back`, `toggleSource`, `setAutoSources`, `setAccess`, `saveRules`, `setName`, `updateFact`, `updateKnowledge`, `addKnowledge`, `setNotif` and `exportData` are all `undefined` in standalone mode, and the first click on any control that calls one throws, e.g. `TypeError: A.toggleSource is not a function`.

What still works vs. what throws, since the split is not obvious:

- **Works** — everything driven by local `setState`: section navigation, row expand/collapse, the "Weitere Quellen" toggle and its search field, the knowledge tabs, opening/cancelling an inline edit, the kebab menu and "Herkunft ansehen", the change-log / Details / Weitere-Grenzen / Tarife / Zahlungsdaten panels, the whole import dialog up to (but not including) "Ausgewählte Angaben übernehmen", typing in the name field, all autonomy mode cards / toggles / the per-day stepper (they write `state.draft` via `setRule`), and "Abbrechen" in the save bar.
- **Throws** — every source switch and the `pickSource` button, the auto-sources switch, all sheet actions, "Änderungen speichern", profile "Speichern", every knowledge mutation (inline save, "Nicht mehr verwenden" on a non-fact row, "Stimmt", "Nicht wichtig", "Rückgängig"), "Ausgewählte Angaben übernehmen", all notification switches and channel radios, and the sidebar's "Zurück zum Scout" (`back: () => this.tryNav(() => A.back())` — immediately when clean, or deferred to the discard dialog's "Verwerfen" button when `state.draft` is set).
- **Fails softly** — `exportData` alone: `A.exportData()` is called *inside* a `try/catch`, so the `TypeError` is swallowed and the user sees the toast `"Export war nicht möglich."`.

> **This is a prototype bug, not a behaviour to reproduce.** The port must implement standalone/storybook mode as a genuine no-op bag (or supply a local reducer), and must **not** implement a silently-swallowing proxy either — that would be a third behaviour, matching neither the doc's old claim nor the source. Where the port needs the prototype's exact runtime behaviour for comparison, note that clicks throw.

Two further effects are gated on `this.props.actions` being present, so **neither fires in standalone mode**:

- `if (pp.backReq !== this.props.backReq && this.props.backReq && this.props.actions) this.tryNav(…)` — the `backReq` prop is inert.
- `if (dirty !== !!ps.draft && this.props.actions) this.props.actions.setDirty(dirty)` — no dirty broadcast.

Also note `state.localPage` is **not** in the initial state object (§0.8); it materialises on the first standalone `setPage` call, and until then `page` falls back to `this.props.page || 'sources'`.

### 0.6 Global CSS injected via `<helmet>`

```css
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
input::placeholder,textarea::placeholder{color:#9c8b7b}
@keyframes stFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

`animation:stFade .2s ease both` (sometimes `.15s` or `.25s`) is the single entrance animation used across all revealed blocks.

### 0.7 Component-level lifecycle

- **Escape key** (`document.addEventListener('keydown')`), strictly in this priority order:
  1. `discardNext` → clear it (keep editing)
  2. `importStep` → `closeImport()`
  3. `sheet` → `closeSheet()`
  4. `menuId` → close row menu
  5. `editId` → cancel inline edit
- **Page change** (`props.page` changed): `contentRef.current.scrollTop = 0`, then WAAPI `animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}], {duration:200, easing:'ease-out'})` — skipped when `matchMedia('(prefers-reduced-motion: reduce)').matches`. **That is the entire page-change effect: no local state is reset.** See "Section navigation resets nothing" below.
- **`backReq` change** (and truthy **and `this.props.actions` present**) → `tryNav(() => actions.back())`. In standalone mode the prop is inert (§0.5).
- **Focus moves**: sheet opened → `sheetCloseRef.focus()`; import opened → `importCloseRef.focus()`; discard opened → `discardKeepRef.focus()`; inline edit opened → `rootRef.querySelector('[data-edit-input]').focus()`; sheet closed → `rootRef.querySelector('[data-conn-trigger]').focus()` (deferred by `later(0, …)`).
- **No focus trap anywhere.** `componentDidUpdate` moves *initial* focus into the sheet / import dialog / discard dialog and `closeSheet` restores focus to a `[data-conn-trigger]` button — and that is all. There is no focus trap, no `inert`, no `aria-hidden` on the background, and no focus-return for the import or discard dialogs. Tab walks straight out of any overlay into the sidebar and the content column behind it. See the "Port delta: overlay semantics" note at the end of this section.
- **Dirty broadcast**: `const dirty = !!this.state.draft; if (dirty !== !!prevState.draft && this.props.actions) this.props.actions.setDirty(dirty)` — also gated on `actions`, so it never fires in standalone mode.
- **`tryNav(fn)`**: `if (state.draft) setState({ discardNext: fn }) else fn()` — this is the single gate that makes every navigation out of "Handlungsspielraum" open the discard dialog.
- **Timers**: all `setTimeout` handles are collected in `this.timers` and cleared on unmount.
- **`flash(key, val, ms=1600)`**: sets `state[key]=val`, then after `ms` clears it if unchanged.
- **`toast(t)`**: `flash('toast', t, 2400)`.
- **`copy(text, key, failKey)`**:
  ```js
  const ok = () => this.flash(key, 'ok', 1600),
        fail = () => { if (failKey) this.flash(failKey, true, 4000);
                       else this.toast('Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
  else fail();
  ```
  So the failure path has **two** entry points: a rejected write *and* a synchronous "no Clipboard API" branch. The amber `"Kopieren war nicht möglich…"` hint (§4.7) / the toast (§13.2) therefore also appear **immediately, before any await**, whenever the API is unavailable — insecure (non-HTTPS) context, older browser, or a sandboxed iframe without clipboard permission. The port must keep the synchronous branch; a promise-only implementation silently does nothing in those environments.

**Section navigation resets nothing.** A `props.page` change only scrolls the content pane to top and re-runs the fade-in (above). Every piece of local UI state survives leaving and returning to a section: `expanded`, `tab`, `search`, `moreOpen`, `logOpen`, `limitsOpen`, `detailsA`, `detailsB`, `tariffOpen`, `payOpen`, `originId`, `sheet`, `sheetMsg` and `nameDraft`. A section is restored exactly as it was left — e.g. a half-typed, unsaved `nameDraft` survives a trip to Datenschutz and back, and (unlike the autonomy `draft`) never triggers the discard dialog (§8.2). Only the autonomy `draft` participates in `tryNav`.

**Port delta: overlay semantics.** §1.2, §6, §12.1 and §13.1 recommend shadcn `Dialog` / `AlertDialog` / `Sheet`. Those primitives add behaviour the prototype does **not** have, so "1:1" is deliberately relaxed here:

| behaviour | prototype | shadcn primitive |
| --- | --- | --- |
| focus trap inside the overlay | **none** | yes |
| background `inert` / `aria-hidden` | **none** | yes |
| Escape to close | yes, via one global `keydown` handler with a fixed priority order (see above) | yes, per-overlay |
| outside click closes | sheet **yes** (`onClick=closeSheet` on the scrim), import **yes** (`onClick=closeImport`), discard **no** (its scrim has no handler) | yes by default — must be **disabled** on the discard `AlertDialog` |
| focus restore on close | **sheet only**, and it restores to the *first* `[data-conn-trigger]` in the DOM, not the trigger that opened it (§12) | yes, to the actual trigger |

Adopting the primitives is the right call (the prototype's overlays are not accessible), but a builder must know these are *additions*, not reproductions — and must explicitly turn **off** outside-click dismissal on the discard dialog to keep it modal.

### 0.8 Initial component state

```js
{ expanded:'roomscout', savedId:null, savedAuto:false, sheet:null, sheetMsg:null, moreOpen:false, search:'',
  copyState:null, copyFail:false, toast:null, draft:null, detailsA:false, detailsB:false, limitsOpen:false,
  rulesSaved:false, discardNext:null, tab:'band', editId:null, editText:'', menuId:null, originId:null,
  flashId:null, retired:null, logOpen:false, importStep:0, importText:'', importFree:false, picks:null,
  copyPromptState:null, importDone:null, nameDraft:null, nameSaved:false, tariffOpen:false, payOpen:false }
```

Note `expanded:'roomscout'` — the first source row is **expanded on first render**.

---

## 1. Outer panel / dialog framing

### 1.1 How it sits on the grain background (from the host)

The host page (`Roomscout.dc.html`) paints, inside a `position:fixed;inset:0;background:#0b0a09` shell:

1. `position:absolute;inset:-2%;background-image:url('assets/bg.jpg');background-size:cover;background-position:50% 30%;filter:saturate(.62) brightness(.5);transform:scaleX(-1)`
2. `position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)`
3. `position:absolute;inset:0;opacity:.28;mix-blend-mode:overlay;background-image:url('assets/grain.svg')` ← **the grain layer**

Above the header (height `84px` desktop / `64px` narrow, padding `0 36px` / `0 18px`) the settings view is wrapped in:

```html
<div style="position:relative;z-index:2;flex:1;min-height:0;display:flex;flex-direction:column;padding:4px 36px 0;animation:rsFadeUp .35s ease both">
  <div style="flex:1;min-height:0;max-width:1380px;width:100%;margin:0 auto">
    <dc-import name="Settings" … style="height:100%;display:block">
  </div>
  <div style="text-align:center;font-size:13px;color:#a89684;padding:14px 0 12px">Designprototyp · Beispieldaten</div>
</div>
```

So: the panel is **translucent glass over the grain image**, max width 1380px, 36px horizontal gutters, 4px top gap under the header, and a centered caption `„Designprototyp · Beispieldaten“` below it. The wrapper's `onClick` closes the host profile menu.

### 1.2 The panel itself

- **Role**: the settings shell (root element, `ref={rootRef}`).
- **Exact style**:
  `position:relative;height:100%;min-height:560px;display:grid;grid-template-columns:296px minmax(0,1fr);border-radius:28px;background:rgba(13,10,8,.8);border:1px solid rgba(255,190,140,.16);overflow:hidden;font-family:'Geist',system-ui,sans-serif;color:#f5ece2;box-shadow:0 30px 90px rgba(0,0,0,.35)`
- **Conditional visibility**: rendered whenever the host view is `settings`.
- **Interaction**: none itself; it is the positioning context (`position:relative`) for the sheet, both dialogs and the toast — all overlays are `position:absolute` **inside the panel**, not viewport-fixed.
- **shadcn candidate**: `Dialog` + `DialogContent` (sidebar-13 pattern) styled with `p-0 gap-0 overflow-hidden rounded-[28px] max-w-[1380px] h-[calc(100dvh-120px)] min-h-[560px] border-[rgba(255,190,140,.16)] bg-[rgba(13,10,8,.8)] backdrop-blur shadow-[0_30px_90px_rgba(0,0,0,.35)]`, containing `SidebarProvider` (`className="items-start"`) + `Sidebar collapsible="none"` + `<main class="flex-1 min-w-0">`.

> **Port delta vs. sidebar-13**: the prototype panel has **no breadcrumb header and no close (×) button** in the content column. Closing happens through the sidebar's "Zurück zum Scout" button and through the host's profile menu. When adopting sidebar-13, add a `Breadcrumb` header reading `Einstellungen / {PAGES[page]}` plus a `DialogClose` × button, and keep "Zurück zum Scout" as the sidebar's top item (it must run through `tryNav`, i.e. it must be able to open the discard dialog).

---

## 2. Sidebar (`<nav aria-label="Einstellungen">`)

- **Role**: navigation column, grid track `296px`.
- **Exact style**: `padding:36px 26px 30px;border-right:1px solid rgba(255,220,190,.08);display:flex;flex-direction:column;min-height:0;overflow:auto;scrollbar-width:none`
- **shadcn candidate**: `Sidebar collapsible="none"` + `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarFooter`, `SidebarSeparator`.

### 2.1 "Zurück zum Scout"

- **Role**: back button, first element in the nav.
- **Copy**: `"Zurück zum Scout"`
- **Icon**: inline SVG `viewBox="0 0 24 24" width=20 height=20 fill=none stroke=currentColor stroke-width=1.8 stroke-linecap=round stroke-linejoin=round`, path `M19 12H5M11 6l-6 6 6 6` (arrow-left).
- **Style**: `display:flex;align-items:center;gap:12px;border:0;background:none;color:#f5ece2;font:inherit;font-size:16px;cursor:pointer;padding:8px 10px;border-radius:10px;text-align:left`
- **Hover** (`style-hover`): `background:rgba(255,255,255,.06)`
- **Interaction**: `back` → `tryNav(() => A.back())`. With unsaved autonomy changes this opens the discard dialog instead of navigating.
- **shadcn candidate**: `Button variant="ghost"` with `ArrowLeft` (lucide), or `SidebarMenuButton`.

### 2.2 Session line (conditional)

- **Visibility**: `sc-if value="{{ session }}"` — truthy only when the host supplies `data.session`. Host values: `'Gespräch pausiert · läuft weiter, wenn du zurückkehrst'` (when the conversation is held), `'Scout ist unterwegs'` (autopilot stages, not paused), `'Suche pausiert'` (autopilot stages, paused), otherwise `null`.
- **Style**: container `margin:14px 10px 0;display:flex;align-items:flex-start;gap:9px;font-size:12.5px;line-height:1.4;color:#cbb9a8`; dot `margin-top:5px;width:7px;height:7px;border-radius:50%;background:#ff6926;flex:none`.
- **shadcn candidate**: custom (small status line) — or `Badge variant="outline"` restyled; a plain `<div>` with a dot is closer to the original.

### 2.3 Group label "DEIN SCOUT"

- **Copy in markup**: `"Dein Scout"` — rendered uppercase by CSS, so it reads `DEIN SCOUT`.
- **Style**: `margin:34px 10px 10px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
- **shadcn candidate**: `SidebarGroupLabel`.

### 2.4 Nav items (`sc-for list="{{ navScout }}"`, 3 items; `navAccount`, 4 items)

Built by `nav(ids)`:

```js
const nav = ids => ids.map(id => { const cur = id === page; return {
  id, label: PAGES[id], current: cur, go: () => this.tryNav(() => A.setPage(id)),
  bg:  cur ? 'rgba(120,58,22,.45)' : 'transparent',
  border: cur ? 'rgba(255,140,90,.35)' : 'transparent',
  color: '#f5ece2',
  icon: cur ? '#ff8a4e' : '#e2d3c3',
  isSources:…, isAutonomy:…, isKnowledge:…, isProfile:…, isNotif:…, isBilling:…, isPrivacy:… }; });
navScout   = nav(['sources','autonomy','knowledge'])
navAccount = nav(['profile','notifications','billing','privacy'])
```

- **Button style**: `display:flex;align-items:center;gap:14px;height:50px;padding:0 14px;border-radius:12px;border:1px solid {{ it.border }};background:{{ it.bg }};color:{{ it.color }};font:inherit;font-size:16px;cursor:pointer;text-align:left;margin-bottom:4px;transition:background .15s`
- **Hover**: `background:rgba(255,255,255,.06)`
- **Active state**: `background:rgba(120,58,22,.45)`, `border-color:rgba(255,140,90,.35)`, icon color `#ff8a4e`; `aria-current={{ it.current }}`.
- **Icon wrapper**: `width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:{{ it.icon }}`; each SVG is 20×20 `fill=none stroke=currentColor`.
- **Interaction**: `it.go` → `tryNav(() => A.setPage(id))`.

| item id | label (verbatim) | icon SVG (stroke-width 1.6) | lucide equivalent |
| --- | --- | --- | --- |
| `sources` | `"Quellen & Zugänge"` | `<circle cx=12 cy=12 r=8.5/><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17"/>` | `Globe` |
| `autonomy` | `"Handlungsspielraum"` | `stroke-linecap=round` `<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx=16 cy=7 r=2/><circle cx=8 cy=12 r=2/><circle cx=18 cy=17 r=2/>` | `SlidersHorizontal` |
| `knowledge` | `"Was dein Scout weiß"` | `stroke-linecap=round stroke-linejoin=round` `<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6"/>` | `FileText` |
| `profile` | `"Profil"` | `stroke-linecap=round` `<circle cx=12 cy=8.5 r=3.8/><path d="M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6"/>` | `User` |
| `notifications` | `"Benachrichtigungen"` | `stroke-linecap=round stroke-linejoin=round` `<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5z"/><path d="M10 20a2 2 0 0 0 4 0"/>` | `Bell` |
| `billing` | `"Tarif & Nutzung"` | `<rect x=3 y=6 width=18 height=12 rx=2.5/><path d="M3 10h18"/>` | `CreditCard` |
| `privacy` | `"Datenschutz"` | `stroke-linejoin=round` `<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/>` | `Shield` |

- **shadcn candidate**: `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton isActive={current}` with lucide icons.

### 2.5 Group label "DEIN KONTO"

- **Copy**: `"Dein Konto"` (uppercase via CSS).
- **Style**: `margin:28px 10px 10px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
- **shadcn candidate**: `SidebarGroupLabel`.

### 2.6 Footer

- Spacer: `<div style="flex:1"></div>`
- Divider: `height:1px;background:rgba(255,220,190,.1);margin:24px 0 20px` → **shadcn candidate**: `SidebarSeparator` / `Separator`.
- Block: `padding:0 10px`
  - Name: `{{ name }}` (demo `"Herzbuben"`) — `font-size:16px;font-weight:500`
  - Subtitle: `"Persönlicher Bereich"` — `font-size:14px;color:#a89684;margin-top:2px`
- **shadcn candidate**: `SidebarFooter` (+ optional `Avatar` — the prototype shows no avatar here).

---

## 3. Content column

- **Role**: scrolling content pane, `ref={contentRef}`.
- **Style**: `min-height:0;overflow:auto;padding:42px 46px 40px;scrollbar-width:thin`
- **Behaviour**: scrolled to top and fade-up-animated on every page change (§0.7).
- **shadcn candidate**: `ScrollArea` (or plain `<main class="overflow-y-auto">`); in sidebar-13 this is the `<main>` column beneath the breadcrumb header.

### 3.1 Shared page header pattern (all 7 sections)

- **H1**: `margin:0;font-size:44px;line-height:1.1;font-weight:500;letter-spacing:-.02em`
- **Lead paragraph**: `margin:10px 0 0;font-size:19px;color:#cbb9a8`
- **shadcn candidate**: custom (`<h1>` + `<p>`), or `DialogTitle`/`DialogDescription` if the breadcrumb header is used instead.

### 3.2 Shared uppercase section label

`font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684` (top margin 22–30px depending on position).
**shadcn candidate**: custom `<div>` / `Label` with `uppercase tracking-[.14em]`.

### 3.3 Shared toggle switch (used in 4 places)

- Track button: `role="switch" aria-checked="{{ on }}" aria-label="…"` — `width:56px;height:32px;border-radius:16px;border:0;padding:0;background:{{ bg }};position:relative;cursor:pointer;transition:background .2s;flex:none`
- Knob span: `position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;transform:{{ knob }};transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)`
- `bg` = `#ff6926` when on, `rgba(255,255,255,.14)` when off. `knob` = `translateX(24px)` when on, `none` when off.
- **shadcn candidate**: `Switch` (needs size override to 56×32 with a 26px thumb and 24px travel).

### 3.4 Shared ghost button

`height:46px;padding:0 22px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer` — hover `background:rgba(255,255,255,.1)`. (Compact variant: `height:42px|44px;padding:0 18px|20px;font-size:14.5px|15px`.)

**Two 46px ghost buttons are *not* `0 22px` and must not be folded into this shorthand:** the import dialog's `"Prompt kopieren"` / `"Kopiert"` (§13.2) and `"Beispiel einsetzen"` (§13.3) both use **`padding:0 20px`**. Every other 46px ghost button on the surface — `"Kopieren"` (§4.7), `"Kontext importieren"` (§7.8), `"Tarife ansehen"` (§10.2) — really is `0 22px`.

**shadcn candidate**: `Button variant="outline"`.

### 3.5 Shared primary button

`height:46px|48px;padding:0 22px;border-radius:12px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer` — hover `background:#ff7a3d`; disabled variant `background:rgba(255,105,38,.4);cursor:not-allowed`. Pill variants use `border-radius:999px` and `height:38px|42px|46px`.
**shadcn candidate**: `Button` (default).

### 3.6 Shared underline link-button

`border:0;background:none;color:#f5ece2;font:inherit;font-size:15px;cursor:pointer;padding:6px 0;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.4)` — hover `color:#ff8a4e`.
**shadcn candidate**: `Button variant="link"`.

---

## 4. Section — Quellen & Zugänge (`pSources`, `page === 'sources'`)

Visibility binding: `sc-if value="{{ pSources }}"` (editor placeholder `true`).

### 4.1 Header

- H1: `"Wo darf dein Scout suchen?"`
- Lead `{{ sourcesSub }}`:
  - `hasOrder` → `'Quellen für eure Suche in ' + (d.ort || 'eurer Stadt').replace(' & Umgebung','') + '.'` → demo: `"Quellen für eure Suche in Stuttgart."`
  - else → `"Quellen gelten für einen konkreten Suchauftrag."`

### 4.2 Empty state "kein Suchauftrag" (`sc-if noOrder`, i.e. `!d.hasOrder`)

- **Card**: `margin-top:28px;padding:24px 26px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,200,160,.14);display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap`
- Title `"Lege zuerst einen Suchauftrag an."` — `font-size:18px`
- Body `"Quellen gelten immer für eine konkrete Suche. Deine Portalzugänge bleiben davon unabhängig."` — `margin-top:4px;font-size:14.5px;color:#cbb9a8`
- Button `"Zum Scout"` — `height:46px;padding:0 22px;border-radius:999px;border:0;background:#ff6926;color:#fff;font-size:15px;font-weight:600`; hover `#ff7a3d`; handler `back` (→ `tryNav`).
- **shadcn candidate**: `Card` + `Button` (pill via `rounded-full`).

Everything from §4.3 on is wrapped in `sc-if value="{{ hasOrder }}"`.

### 4.3 "Passende Quellen automatisch auswählen" row

- **Container**: `margin-top:26px;padding:22px 0;border-top:1px solid rgba(255,220,190,.1);border-bottom:1px solid rgba(255,220,190,.1);display:flex;align-items:center;justify-content:space-between;gap:20px`
- Title `"Passende Quellen automatisch auswählen"` — `font-size:20px`
- Sub `"Deine Ausschlüsse bleiben erhalten."` — `margin-top:4px;font-size:15px;color:#cbb9a8`
- **Right-hand wrapper** grouping the next two items into one flex cell opposite the text block: `display:flex;align-items:center;gap:12px`
- Saved flash `"Gespeichert"` (`sc-if savedAuto`) — `font-size:13px;color:#a89684;animation:stFade .2s ease both`, lives 1500 ms.
- Switch: `autoOn` = `!!d.autoSources`; `aria-label="Passende Quellen automatisch auswählen"`; handler `toggleAuto` → `A.setAutoSources(!d.autoSources)` + `flash('savedAuto', true, 1500)`.
- The `gap:12px` is what separates the flash text from the 56×32 switch; when the flash is absent the switch simply sits alone in that cell (no layout shift, because the flash is `sc-if`-mounted with no reserved width — the switch does move right by the flash's width + 12px while it is visible).
- **shadcn candidate**: `Switch` + `Label`; the "Gespeichert" flash → inline text (or `Sonner` toast in the port, but keep it inline to match).

### 4.4 List header

- Left: `"Deine Quellen"` (uppercase label style, `font-size:12.5px`)
- Right: `"Für diese Suche"` — `font-size:14px;color:#a89684`
- Container: `margin-top:26px;display:flex;justify-content:space-between;align-items:baseline`

### 4.5 Warning "keine nutzbare Quelle" (`sc-if noUsable`)

`noUsable = d.hasOrder && !sources.some(x => x.enabled && (x.kind === 'portal' || (d.flags && d.flags.publicSearch)))`

- **Banner**: `margin-top:14px;padding:14px 18px;border-radius:14px;background:rgba(224,161,58,.1);border:1px solid rgba(224,161,58,.35);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:14.5px`
- Text: `"Aktuell ist keine nutzbare Quelle ausgewählt. Dein Scout kann so nicht weitersuchen."`
- Button `"Quelle auswählen"` — `height:38px;padding:0 16px;border-radius:999px;border:0;background:#ff6926;color:#fff;font-size:14px;font-weight:600`; hover `#ff7a3d`.
- Handler `pickSource`: `if (!room.enabled) A.toggleSource('roomscout'); setState({ expanded:'roomscout' }); flash('savedId','roomscout',1500)`.
- **shadcn candidate**: `Alert variant="warning"` (custom amber tokens) + `Button`.

### 4.6 Source rows (`sc-for list="{{ sourceRows }}"`)

Row model (per source `x`):

```js
const open = s.expanded === x.id; const conn = x.access === 'connected';
statusText = !x.enabled ? 'Nicht einbezogen'
           : x.kind === 'portal' ? (conn ? 'Verbunden' : 'Anmeldung erneut nötig')
           : 'Ohne Anmeldung';
dot = !x.enabled ? 'rgba(255,255,255,.3)'
    : x.kind === 'portal' ? (conn ? '#4fbf7a' : '#e0a13a')
    : 'rgba(255,255,255,.3)';
chev = open ? 'rotate(180deg)' : 'none';  rows = open ? '1fr' : '0fr';
rowBg = open ? 'rgba(255,255,255,.035)' : 'transparent';
rowBorder = open ? 'rgba(255,200,160,.14)' : 'transparent';  mb = open ? 8 : 0;
switchLabel = x.name + ' für diese Suche verwenden';
connLabel = conn ? 'Verbindung verwalten' : 'Anmeldung öffnen';
saved = s.savedId === x.id;
isPortal = x.kind === 'portal'; isMusiker = x.id === 'musiker'; isBandnet = x.id === 'bandnet';
demoInactive = x.kind === 'public' && !(d.flags && d.flags.publicSearch);
offHint = !x.enabled;
toggle = () => { A.toggleSource(x.id); flash('savedId', x.id, 1500); };
expand = () => setState(st => ({ expanded: st.expanded === x.id ? null : x.id }));
```

**List container** (wraps the whole `sc-for`, sets the rhythm below the §4.4 header / §4.5 banner): `margin-top:12px;display:flex;flex-direction:column`

**Row wrapper**: `border-radius:18px;background:{{ s.rowBg }};border:1px solid {{ s.rowBorder }};margin-bottom:{{ s.mb }}px;transition:background .25s,border-color .25s`

**Row head grid**: `display:grid;grid-template-columns:56px minmax(0,1fr) auto auto auto;align-items:center;gap:18px;padding:16px 16px 16px 14px`

1. **Avatar** — `width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,220,190,.18);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:500;color:#f5ece2`
   - `isPortal` → `<img src="assets/logo-roomscout.png" alt="" style="width:30px;height:30px;object-fit:contain">`
   - `isMusiker` → SVG 22×22 sw 1.6 linecap round: `<circle cx=9 cy=8 r=3.2/><circle cx=16.5 cy=9 r=2.6/><path d="M3.5 19c.5-3.3 2.6-5 5.5-5s5 1.7 5.5 5"/><path d="M15 14.4c2.6 0 4.3 1.5 4.8 4.4"/>` (users)
   - `isBandnet` → SVG 22×22 sw 1.6: `<path d="M9 18V6l10-2v12"/><circle cx=6.5 cy=18 r=2.5/><circle cx=16.5 cy=16 r=2.5/>` (music)
   - **shadcn candidate**: `Avatar` + `AvatarImage`/`AvatarFallback`.
2. **Name + desc** (`min-width:0`): name `font-size:19px`; desc `margin-top:2px;font-size:14.5px;color:#cbb9a8`.
3. **Status**: `display:flex;align-items:center;gap:9px;font-size:14.5px;color:#e2d3c3;white-space:nowrap`; dot `width:9px;height:9px;border-radius:50%;background:{{ s.dot }}`; then `{{ s.statusText }}`; then `sc-if s.saved` → `"Gespeichert"` (`margin-left:8px;font-size:13px;color:#a89684;animation:stFade .2s ease both`).
   - **shadcn candidate**: `Badge variant="outline"` or custom dot+text (custom is closer).
4. **Switch** (§3.3), `aria-label="{{ s.switchLabel }}"`, handler `s.toggle`.
5. **Expand chevron button**: `aria-expanded="{{ s.open }}" aria-label="Details"` — `width:36px;height:36px;border-radius:50%;border:0;background:none;color:#e2d3c3;cursor:pointer;display:flex;align-items:center;justify-content:center`; hover `background:rgba(255,255,255,.08)`; SVG 18×18 sw 2 linecap round `<path d="M6 9l6 6 6-6"/>` with `transform:{{ s.chev }};transition:transform .25s`.

**Expandable body**: outer `display:grid;grid-template-rows:{{ s.rows }};transition:grid-template-rows .26s cubic-bezier(.3,.7,.2,1)`; inner `overflow:hidden;min-height:0`; content `margin:0 16px;padding:16px 8px 18px;border-top:1px solid rgba(255,220,190,.1);display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap`.

Left text block `font-size:15px;line-height:1.6;color:#e2d3c3`:

| condition | copy |
| --- | --- |
| `s.isPortal` line 1 (`color:#f5ece2`) | `"Portalprofil: "` + `{{ s.profile }}` → demo `"Portalprofil: Herzbuben"` |
| `s.isPortal` line 2 | `"Anzeigen lesen und Nachrichten austauschen"` |
| `s.isMusiker` | `"Öffentliche Anzeigen können berücksichtigt werden. Der Kontaktweg hängt von der Anzeige ab."` |
| `s.isMusiker && s.demoInactive` (pill) | `"In dieser Demo nicht aktiv"` — `margin-top:6px;display:inline-flex;align-items:center;gap:8px;font-size:13px;color:#a89684;padding:4px 10px;border-radius:999px;border:1px solid rgba(255,220,190,.16)` → **shadcn candidate**: `Badge variant="outline"` |
| `s.isBandnet` | `"Hamburg liegt außerhalb eurer Suche. Eine Anmeldung ist dafür nicht nötig."` |
| `s.offHint` (source off) | `"Keine neuen Anfragen über diese Quelle. Vorhandene Gespräche bleiben sichtbar."` — `margin-top:6px;color:#a89684` |

Right action (rendered by `sc-if value="{{ s.isPortal }}"`, i.e. on **every** source whose `kind === 'portal'` — not only `roomscout`; in the demo data there happens to be exactly one): button `data-conn-trigger="1"` with copy `{{ s.connLabel }}` (`"Verbindung verwalten"` when connected, `"Anmeldung öffnen"` otherwise) — style `border:0;background:none;color:#f5ece2;font:inherit;font-size:15px;cursor:pointer;padding:6px 4px;display:flex;align-items:center;gap:6px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.4)`, hover `color:#ff8a4e`; trailing SVG 14×14 sw 2 `<path d="M7 17L17 7M9 7h8v8"/>` (external-link arrow). Handler `openConnection` → `setState({ sheet: 'info', sheetMsg: null })` (the ternary in the source resolves to `'info'` either way).

> **Prototype bug the port must fix.** `openConnection` is a *single shared handler* on the `props` object — it carries no source id. The sheet it opens is hard-wired to `room = sources.find(x => x.id === 'roomscout') || {}` and its title is the literal string `"Verbindung zu roomscout.dev"`. With a second `kind:'portal'` source in the data, clicking *that* row's trigger would still show roomscout's profile / state / lastAccess, and `disconnect` / `finishLogin` would call `A.setAccess('roomscout', …)` regardless of which row was clicked. Related: `closeSheet` restores focus with `rootRef.querySelector('[data-conn-trigger]')` — always the **first** portal row's button in DOM order, not the one that opened the sheet. The port must pass the source id into the sheet and restore focus to the actual trigger. See §12.

- **shadcn candidate for the whole list**: `Accordion type="single" collapsible` with `AccordionItem`/`AccordionTrigger`/`AccordionContent`, each item rendered as a `Card`; `Switch` inside the trigger row must stop propagation.

### 4.7 Scout address block

- **Grid**: `margin-top:22px;padding-top:22px;border-top:1px solid rgba(255,220,190,.1);display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:start`
- Icon: SVG 26×26 `stroke="#f5ece2" stroke-width=1.5 stroke-linejoin=round` `<rect x=3 y=5 width=18 height=14 rx=2/><path d="M3 7l9 6 9-6"/>` (mail), `margin-top:4px`
- Title `"Deine Scout-Adresse"` — `font-size:18px`
- Address `{{ scoutAddress }}` = `'herzbuben@scout.example'` — `data-scout-address="1";margin-top:4px;font-size:17px;color:#f5ece2;user-select:all`
- Hint `"Für Portal-Anmeldungen und Antworten an deinen Scout."` — `margin-top:6px;font-size:14.5px;color:#cbb9a8`
- `sc-if copyFail` → `"Kopieren war nicht möglich. Du kannst die Adresse markieren und selbst kopieren."` — `margin-top:6px;font-size:13.5px;color:#e0a13a` (lives 4000 ms)
- Button `{{ copyLabel }}` = `"Kopiert"` when `copyState === 'ok'` else `"Kopieren"` — ghost button style + `min-width:120px`. Handler `copyAddress` → `copy('herzbuben@scout.example','copyState','copyFail')`; success flash 1600 ms.
- **shadcn candidate**: `Card`-less row; `Button variant="outline"`; optionally `Tooltip` on the copy button.

### 4.8 "Weitere Quellen" toggle row

- Container: `margin-top:26px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap`
- Link-button `{{ moreLabel }}` = `"Weitere Quellen ausblenden"` when open, else `"Weitere Quellen ansehen"`. Handler `toggleMore`.
- Right note: `"Eine Quelle auszuschließen löscht keinen Portal-Account."` — `font-size:14px;color:#a89684`
- **shadcn candidate**: `Collapsible` + `CollapsibleTrigger` (`Button variant="link"`).

### 4.9 "Weitere Quellen" panel (`sc-if moreOpen`)

- Panel: `margin-top:16px;padding:20px 22px;border-radius:18px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);animation:stFade .2s ease both`
- **Search input**: `placeholder="Quelle oder Region suchen …"` `aria-label="Quellen durchsuchen"` — `width:100%;height:46px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,220,190,.16);background:rgba(0,0,0,.25);color:#f5ece2;font:inherit;font-size:15px`. Handler `onSearch` → `setState({ search: e.target.value })`. Filter: `moreAll.filter(m => !q || (m.name+' '+m.region).toLowerCase().includes(q))` with `q = search.trim().toLowerCase()`.
  - **shadcn candidate**: `Input` (optionally `Command`/`CommandInput`).
- **Row list container** (between the search input and the rows): `margin-top:8px;display:flex;flex-direction:column`. The `moreEmpty` line lives inside this container too, after the `sc-for`.
- **Rows** (`sc-for moreRows`): `display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:16px;align-items:center;padding:14px 4px;border-bottom:1px solid rgba(255,220,190,.08)`
  - Name `font-size:16px`; region `font-size:13.5px;color:#a89684;margin-top:2px`
  - State: dot `width:8px;height:8px;border-radius:50%;background:{{ m.dot }}` + `{{ m.state }}` — `font-size:14px;color:#e2d3c3`
  - Action button: `height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.04);color:{{ m.btnColor }};font:inherit;font-size:14px;cursor:{{ m.cursor }};min-width:130px`, `disabled="{{ m.disabled }}"`, `title="{{ m.title }}"`
  - Model: every real source maps to `{ name, region, state: kind==='portal' ? (access==='connected' ? 'Verfügbar' : 'Anmeldung nötig') : 'Verfügbar', dot: (portal && !connected) ? '#e0a13a' : '#4fbf7a', btn: enabled ? 'Ausschließen' : 'Einbeziehen', disabled:false, cursor:'pointer', btnColor:'#f5ece2', title:'', action: () => { A.toggleSource(id); flash('savedId', id, 1500); } }`
  - Plus one hard-coded unavailable row: `{ name:'Proberaumbörse Süd (Beispiel)', region:'Baden-Württemberg', state:'Noch nicht verfügbar', dot:'rgba(255,255,255,.3)', btn:'Nicht verfügbar', disabled:true, cursor:'not-allowed', btnColor:'#a89684', title:'Diese Beispielquelle ist im Prototyp nicht angebunden.', action: () => {} }`
  - **shadcn candidate**: `Table` (or a plain grid list) + `Button variant="outline" size="sm"` + `Tooltip` for the `title`.

> **This list is not a list of *other* sources — it duplicates the list above.** `moreAll` is built from `sources.map(…)`, i.e. **every** source already rendered as a row in §4.6, plus the one hard-coded "Proberaumbörse Süd (Beispiel)" entry. With the demo data the panel shows 4 rows: roomscout.dev, Musiker in deiner Stadt, Bandnet Hamburg, Proberaumbörse Süd (Beispiel). The label "Weitere Quellen ansehen" is therefore aspirational copy, not a description of the contents. Reproduce it as-is for the 1:1 port, but flag it — a product fix would filter out the already-listed sources.

> **The flash lands on the wrong row.** A more-list row's `action` is `A.toggleSource(id); flash('savedId', id, 1500)` — and `savedId` is the *same state slot* the main source list reads (`saved: s.savedId === x.id`, §4.6). The more-list rows never render `saved` at all. So toggling a source from inside this panel makes the `"Gespeichert"` flash appear on the corresponding **main source row above**, while the more-list row that was actually clicked shows no confirmation. Scoping the flash to the clicked row would diverge from the prototype; if the port fixes this, do it deliberately and note it.

- **Empty state** (`sc-if moreEmpty`, i.e. `moreRows.length === 0`): `"Keine Quelle gefunden. Die Liste zeigt nur die vorhandenen Demo-Quellen."` — `padding:14px 4px;font-size:14.5px;color:#a89684`
  - **Reachability**: because the hard-coded "Proberaumbörse Süd (Beispiel)" row is always in `moreAll`, this empty state can only appear for a query that also fails to match that row. Any query that is a substring of `"Proberaumbörse Süd (Beispiel) Baden-Württemberg"` (case-insensitively) keeps at least one row and hides the empty state — e.g. `"süd"`, `"baden"`, `"beispiel"` never reach it, while `"hamburgx"` does.
- **Footnote**: `"Demo-Quellen. Keine vollständige Liste aller Portale."` — `margin-top:10px;font-size:13px;color:#a89684`

---

## 5. Section — Handlungsspielraum (`pAutonomy`, `page === 'autonomy'`)

All controls here write to a **draft**: `setRule(k,v)` → `setState({ draft: {...(draft || data.rules), [k]: v}, rulesSaved: false })`. `rules()` returns `state.draft || data().rules`. `dirty = !!state.draft`.

### 5.1 Header

- H1 `"So arbeitet dein Scout"`
- Lead `"Du bestimmst, wie selbstständig ich vorgehe."`

### 5.2 Mode radio cards

- Group: `role="radiogroup" aria-label="Arbeitsmodus"` — `margin-top:26px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px`
- Card button: `role="radio" aria-checked="{{ modeAuto|modeReview }}"` — `display:flex;align-items:center;gap:18px;padding:20px 22px;border-radius:16px;border:1px solid {{ border }};background:{{ bg }};color:#f5ece2;font:inherit;text-align:left;cursor:pointer;transition:background .2s,border-color .2s`
  - selected: `border:rgba(255,105,38,.75)`, `background:rgba(120,58,22,.28)`, ring `#ff6926`, dot `#ff6926`
  - unselected: `border:rgba(255,220,190,.14)`, `background:rgba(255,255,255,.03)`, ring `rgba(255,220,190,.35)`, dot `transparent`
- Radio ring: `width:26px;height:26px;border-radius:50%;border:2px solid {{ ring }};display:flex;align-items:center;justify-content:center;flex:none`; inner dot `width:12px;height:12px;border-radius:50%;background:{{ dotBg }}`
- Card 1: title `"Autopilot"` (`display:block;font-size:19px;font-weight:500`), sub `"Suchen, anfragen und Details klären."` (`margin-top:3px;font-size:15px;color:#cbb9a8`). Handler `setModeAuto` → `setRule('mode','autopilot')`.
- Card 2: title `"Mit Rücksprache"`, sub `"Nachrichten vor dem Versand prüfen."`. Handler `setModeReview` → `setRule('mode','review')`.
- **shadcn candidate**: `RadioGroup` + `RadioGroupItem` inside `Label`-wrapped `Card`s (shadcn "card radio" pattern).

### 5.3 "WAS ICH SELBSTSTÄNDIG ERLEDIGEN DARF" + Details

- Header row: `margin-top:30px;display:flex;justify-content:space-between;align-items:baseline`; label copy `"Was ich selbstständig erledigen darf"` (uppercase style); button `"Details"` — `border:0;background:none;color:#a89684;font:inherit;font-size:13.5px;cursor:pointer;padding:2px 4px`, hover `color:#fff`. Handler `toggleDetailsA`.
- `sc-if detailsA` body — `margin-top:8px;font-size:14px;color:#cbb9a8;line-height:1.6;animation:stFade .2s ease both`:
  `"Anschreiben umfasst Erstanfragen und Nachfragen zu Verfügbarkeit, Preis und Ausstattung. Besichtigungen werden nur vorgeschlagen, nie verbindlich zugesagt. Eine eigene Suchanzeige wäre öffentlich sichtbar und enthält nur freigegebene Informationen."`
- **shadcn candidate**: `Collapsible` (or `Accordion`), trigger as `Button variant="ghost" size="sm"`.

### 5.4 Action toggle rows (`actionRows`)

Row style: `display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid rgba(255,220,190,.1);font-size:17px` + shared switch.

| rule key | label (verbatim) | demo default |
| --- | --- | --- |
| `contact` | `"Anbieter anschreiben und nachfassen"` | on |
| `viewings` | `"Besichtigungstermine vorschlagen"` | on |
| `publishAd` | `"Eigene Suchanzeige veröffentlichen"` | off |

Handler: `toggle: () => this.setRule(k, !R[k])` → marks the page dirty.
**shadcn candidate**: `Switch` + `Label` per row, `Separator` between rows.

### 5.5 "WAS ICH TEILEN DARF" + Details

- Same header pattern; label `"Was ich teilen darf"`, button `"Details"` → `toggleDetailsB`.
- `sc-if detailsB` body: `"Bandprofil: Bandname, Besetzung, Musikrichtung, gewünschte Probezeiten und die Scout-Adresse. Privat: persönliche Telefonnummern und genaue Wohnadressen. Diese Freigabe gilt unabhängig vom Arbeitsmodus."`

### 5.6 Share toggle rows (`shareRows`)

| rule key | label (verbatim) | demo default |
| --- | --- | --- |
| `shareProfile` | `"Bandprofil, Verfügbarkeit und Scout-Adresse"` | on |
| `sharePrivate` | `"Private Telefonnummer und genaue Adresse"` | off |

### 5.7 "GRENZEN" — per-day stepper

- Label `"Grenzen"` — `margin-top:30px` + uppercase style.
- Row: `display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid rgba(255,220,190,.1);font-size:17px;flex-wrap:wrap`
- Left copy: `"Neue Anbieter pro Tag"`
- **Right-hand wrapper** — the stepper group and the "Weitere Grenzen" link are **siblings inside one shared wrapper**, not two independent children of the row: `display:flex;align-items:center;gap:22px;flex-wrap:wrap`. The `gap:22px` sets the horizontal distance between the bordered stepper and the link; the inner `flex-wrap:wrap` (in addition to the row's own) lets the link drop under the stepper on narrow widths before the whole right side drops under the label.
- Stepper wrapper: `display:flex;align-items:center;border:1px solid rgba(255,220,190,.2);border-radius:10px;overflow:hidden`
  - Minus button: glyph `"−"` (U+2212), `aria-label="Weniger"` — `width:42px;height:40px;border:0;background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:18px;cursor:pointer`, hover `background:rgba(255,255,255,.12)`. Handler `decPerDay` → `setRule('perDay', Math.max(1, (Number.isInteger(perDayNum) ? perDayNum : 1) - 1))`
  - Input: `value="{{ perDay }}"` (`String(R.perDay)`), `inputmode="numeric"`, `aria-label="Neue Anbieter pro Tag"`, `aria-invalid="{{ perDayInvalid }}"` — `width:56px;height:40px;text-align:center;border:0;background:none;color:#f5ece2;font:inherit;font-size:17px`. Handler `onPerDay` → `setRule('perDay', e.target.value)` (**raw string**, hence validation).
  - Plus button: glyph `"+"`, `aria-label="Mehr"`, same style. Handler `incPerDay` → `setRule('perDay', (Number.isInteger(perDayNum) && perDayNum > 0 ? perDayNum : 0) + 1)`
- "Weitere Grenzen" link-button, `font-size:15px;padding:6px 2px;display:flex;align-items:center;gap:8px` + underline decoration; hover `#ff8a4e`; trailing chevron SVG 14×14 sw 2 `<path d="M9 6l6 6-6 6"/>` with `transform:{{ limitsRot }}` (`rotate(90deg)` when open) `transition:transform .25s`. Handler `toggleLimits`.
- **Validation**: `perDayNum = Number(R.perDay)`; `perDayInvalid = !(Number.isInteger(perDayNum) && perDayNum > 0 && String(R.perDay).trim() !== '')`.
  - `sc-if perDayInvalid` → `role="alert"` `"Bitte eine ganze Zahl größer als 0 eingeben."` — `margin-top:8px;font-size:14px;color:#ff8a6a`
- Caption: `"Gemeint sind neue kontaktierte Anbieter, nicht die Nachrichten in einer laufenden Unterhaltung."` — `margin-top:6px;font-size:13.5px;color:#a89684`
- **shadcn candidate**: `Input` + two `Button variant="ghost" size="icon"` in a bordered group (custom stepper); alert text = `<p role="alert">` or `FormMessage`.

### 5.8 "Weitere Grenzen" panel (`sc-if limitsOpen`)

- Panel: `margin-top:12px;padding:16px 20px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);font-size:15px;line-height:1.7;color:#e2d3c3;animation:stFade .2s ease both`
- Line 1: label `"Suchzeitraum:"` (`color:#a89684`) + `" bis ihr den Suchauftrag beendet oder ein Angebot annehmt."`
- Line 2: label `"Geltende Stopps:"` + `" Suche jederzeit im Hauptbereich pausierbar; verbindliche Zusagen nie automatisch."`
- Line 3: label `"Budget:"` + `" gehört zum Suchauftrag. "` + inline link-button `"Suchauftrag bearbeiten"` (`border:0;background:none;color:#f5ece2;font-size:15px;padding:0;text-decoration:underline;text-underline-offset:4px`, hover `#ff8a4e`) → handler `back` (`tryNav`).
- **shadcn candidate**: `Collapsible` + `Card` + `Button variant="link"`.

### 5.9 Lock reassurance card

- Card: `margin-top:26px;display:flex;align-items:center;gap:20px;padding:20px 24px;border-radius:18px;background:rgba(120,58,22,.22);border:1px solid rgba(255,140,90,.22)`
- Icon: SVG 26×26 `stroke="#ff8a4e" stroke-width=1.6 stroke-linejoin=round` `<rect x=5 y=11 width=14 height=10 rx=2/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>` (lock), `flex:none`
- Title `"Verbindliche Entscheidungen bleiben bei dir."` — `font-size:17px;font-weight:500`
- Sub `"Verträge, Buchungen und Zahlungen brauchen immer deine Freigabe."` — `margin-top:3px;font-size:14.5px;color:#cbb9a8`
- **shadcn candidate**: `Alert` (custom accent variant).

### 5.10 Save / discard bar (dirty state)

- Bar: `margin-top:22px;min-height:52px;display:flex;justify-content:flex-end;align-items:center;gap:12px` — the `min-height` reserves the space so the layout does not jump.
- `sc-if rulesSavedMsg` → `"Handlungsspielraum aktualisiert"` — `font-size:14.5px;color:#cbb9a8;margin-right:auto;animation:stFade .2s ease both`, lives 2600 ms.
- `sc-if dirty`:
  - `"Abbrechen"` — `height:48px;padding:0 22px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font-size:15px;cursor:pointer;animation:stFade .2s ease both`; hover `rgba(255,255,255,.1)`. Handler `cancelRules` → `setState({ draft: null })` (and via `componentDidUpdate` → `actions.setDirty(false)`).
  - `"Änderungen speichern"` — `height:48px;padding:0 22px;border-radius:12px;border:0;background:{{ saveBg }};color:#fff;font-size:15px;font-weight:600;cursor:{{ saveCursor }};animation:stFade .2s ease both`, `disabled="{{ perDayInvalid }}"`; `saveBg` = `#ff6926` or `rgba(255,105,38,.4)` when invalid; `saveCursor` = `pointer` / `not-allowed`. Handler `saveRules` → `if (perDayInvalid) return; A.saveRules({...R, perDay: perDayNum}); setState({ draft: null }); flash('rulesSaved', true, 2600)`.
- **shadcn candidate**: sticky footer bar with `Button variant="outline"` + `Button`; the "Gespeichert" line as inline muted text (not a toast, to match).

---

## 6. Discard-changes dialog (global, driven by `discardNext`)

Rendered at the panel root, `sc-if value="{{ discardOpen }}"` where `discardOpen = !!state.discardNext`.

- Scrim: `position:absolute;inset:0;z-index:30;background:rgba(6,4,3,.6);animation:stFade .2s ease both` (no click handler — modal).
- Dialog: `role="alertdialog" aria-modal="true" aria-labelledby="st-discard-title"` — `position:absolute;z-index:31;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 48px));background:rgba(18,14,11,.98);border:1px solid rgba(255,200,160,.16);border-radius:20px;padding:26px 28px;animation:stFade .25s ease both;box-shadow:0 30px 80px rgba(0,0,0,.5)`
- Title `"Änderungen verwerfen?"` — `margin:0;font-size:22px;font-weight:500`
- Body `"Dein Handlungsspielraum hat ungespeicherte Änderungen."` — `margin-top:8px;font-size:15px;color:#cbb9a8;line-height:1.5`
- Buttons row: `margin-top:20px;display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap`
  - `"Weiter bearbeiten"` (`ref=discardKeepRef`, autofocused) — `height:44px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font-size:15px`; hover `rgba(255,255,255,.08)`. Handler `keepEditing` → `setState({ discardNext: null })`.
  - `"Verwerfen"` — `height:44px;padding:0 18px;border-radius:12px;border:0;background:#ff6926;color:#fff;font-size:15px;font-weight:600`; hover `#ff7a3d`. Handler `discardAndGo` → `setState({ draft:null, discardNext:null }, () => fn && fn())` — drops the draft, then performs the queued navigation.
- Escape closes it (highest priority) with the same effect as "Weiter bearbeiten".
- **Triggered by**: any `tryNav` call while `state.draft` is set — sidebar items, "Zurück zum Scout", "Zum Scout", "Suchauftrag bearbeiten", "Gespeicherte Informationen verwalten", privacy cross-links, and the host's `backReq` (the last only in host mode, §0.5).
- **Accessibility gap in the prototype**: focus is moved once to `discardKeepRef`, but there is **no focus trap**, no `inert`/`aria-hidden` on the panel behind it, and no focus restore on close. Tab walks out of the dialog into the sidebar and content underneath. See the "Port delta: overlay semantics" table in §0.7.
- **shadcn candidate**: `AlertDialog` (`AlertDialogCancel` = "Weiter bearbeiten", `AlertDialogAction` = "Verwerfen"). It adds the focus trap and focus restore the prototype lacks — keep those. But `AlertDialog`'s outside-click/overlay behaviour must stay **non-dismissing** to match: the prototype's scrim here deliberately has no click handler (unlike the sheet's and the import dialog's, which both close on scrim click).

---

## 7. Section — Was dein Scout weiß (`pKnowledge`, `page === 'knowledge'`)

### 7.1 Header

- H1 `"Was ich über euch weiß"`
- Lead `"Korrigiere mich jederzeit. Ihr bestimmt, was ich mir merke."`

### 7.2 Summary card

- Card: `margin-top:26px;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:20px 24px;border-radius:16px;border:1px solid rgba(255,200,160,.16);background:rgba(255,255,255,.03)`
- Text `{{ summary }}` — `font-size:18px;line-height:1.45`; demo: `"Ihr seid eine vierköpfige Band aus Stuttgart. Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen."`
- Edit button: `aria-label="Zugrunde liegende Angaben bearbeiten"` — `width:40px;height:40px;border-radius:50%;border:0;background:none;color:#f5ece2;cursor:pointer;display:flex;align-items:center;justify-content:center;flex:none`; hover `rgba(255,255,255,.08)`; SVG 20×20 sw 1.6 linejoin round `<path d="M4 20l4-.8L19.5 7.7a1.8 1.8 0 0 0-2.6-2.6L5.3 16.6z"/>` (pencil).
- Handler `editSummary`: picks `know.find(k => k.factId && k.cat === 'band') || know.find(k => k.factId) || know[0]`; if found → `setState({ tab: first.cat, editId: first.id, editText: first.text })` (switches tab and opens that row's inline edit); if none → `toast('Noch keine Angaben vorhanden.')`.
- **shadcn candidate**: `Card` + `Button variant="ghost" size="icon"` + `Tooltip`.

### 7.3 Tabs

- Tablist: `role="tablist"` — `margin-top:22px;display:flex;gap:6px;border-bottom:1px solid rgba(255,220,190,.1)`
- Tab button: `role="tab" aria-selected="{{ t.active }}"` — `height:44px;padding:0 20px;border:0;background:none;color:{{ t.color }};font:inherit;font-size:17px;cursor:pointer;border-bottom:2px solid {{ t.line }};margin-bottom:-1px;transition:color .15s`
  - active: `color:#ff8a4e`, `border-bottom-color:#ff6926`
  - inactive: `color:#cbb9a8`, `border-bottom-color:transparent`
- Tabs (order fixed): `band` → `"Eure Band"`, `alltag` → `"Alltag & Wege"`, `ausstattung` → `"Ausstattung"`
- Handler `t.go` → `setState({ tab: t, editId: null, menuId: null })` — switching a tab cancels an open inline edit and closes the row menu, and **nothing else**. In particular `originId` is *not* cleared (§7.5): an open "Herkunft: …" line is merely unmounted while its tab is hidden and reappears when you come back to that tab.
- Below the tablist: section label `{{ tabTitle }}` = `CATS[tab]` (same three strings) — `margin-top:22px` + uppercase label style.
- **shadcn candidate**: `Tabs` + `TabsList` + `TabsTrigger` (underline variant).

### 7.4 Empty state per tab (`sc-if tabEmpty`, when the active tab has no non-retired items)

- Card: `margin-top:14px;padding:22px 24px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);font-size:17px;line-height:1.5;color:#e2d3c3`
- Copy by tab:
  - `band` → `"Über eure Band weiß ich noch nichts. Erzähl es mir beim nächsten Gespräch."`
  - `alltag` → `"Zu euren Wegen weiß ich noch nichts. Du kannst es mir beim nächsten Gespräch erzählen."`
  - `ausstattung` → `"Zu eurer Ausstattung weiß ich noch nichts. Du kannst es mir beim nächsten Gespräch erzählen."`
- **shadcn candidate**: `Card` (empty-state).

### 7.5 Fact rows (`sc-for list="{{ rows }}"`)

Source data (`d.knowledge`, filtered `status !== 'retired'`, then by `cat === state.tab`):

| id | factId | cat | text | origin | status |
| --- | --- | --- | --- | --- | --- |
| `f_band` | `band` | `band` | `"Geteilter Raum · 4 Personen"` | `"Aus dem Gespräch · Teil eures Suchauftrags"` | `confirmed` |
| `f_budget` | `budget` | `band` | `"Bis 350 € / Monat"` | `"Aus dem Gespräch · Teil eures Suchauftrags"` | `confirmed` |
| `f_ort` | `ort` | `alltag` | `"Stuttgart"` | `"Aus dem Gespräch · Teil eures Suchauftrags"` | `confirmed` |
| `f_zeit` | `zeit` | `alltag` | `"Donnerstags ab 19 Uhr"` | `"Aus dem Gespräch · Teil eures Suchauftrags"` | `confirmed` |
| `f_equip` | `equip` | `ausstattung` | `"Schlagzeug darf im Raum bleiben"` | `"Aus dem Gespräch · Teil eures Suchauftrags"` | `confirmed` |
| `k_genre` | — | `band` | `"Hardrock und Alternative"` | `"Demo-Bandprofil"` | `confirmed` |
| `k_mates` | — | `band` | `"Ähnliche Musikrichtung bei Mitnutzern wichtig"` | `"Annahme deines Scouts"` | `assumed` |
| `k_amps` | — | `ausstattung` | `"Verstärker bringt ihr selbst mit"` | `"Aus dem Gespräch"` | `confirmed` |

**List container** (wraps the whole `sc-for`, and follows the `sc-if tabEmpty` card of §7.4): `margin-top:6px;display:flex;flex-direction:column`

**Row container**: `display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px 8px;border-bottom:1px solid rgba(255,220,190,.1);border-radius:10px;background:{{ k.bg }};transition:background .5s;position:relative`
`k.bg` = `rgba(255,105,38,.18)` while `state.flashId === k.id`, else `transparent` (flash lasts 1200 ms after edit-save or confirm).

**Icon cell**: `width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:#e2d3c3`. Selection function:

```js
iconFor = k => k.factId === 'ort'   ? 'iPin'
             : k.factId === 'zeit'  ? 'iClock'
             : k.factId === 'budget'? 'iEuro'
             : k.factId === 'equip' ? 'iDrum'
             : k.factId === 'band'  ? 'iHome'
             : k.id === 'k_genre'   ? 'iMusic'
             : k.id === 'k_mates'   ? 'iBand'
             : k.cat === 'ausstattung' ? 'iDrum'
             : k.cat === 'alltag'   ? 'iClock'
             : 'iNote';
```

| flag | SVG (22×22, `fill=none stroke=currentColor stroke-width=1.5`) | lucide |
| --- | --- | --- |
| `iBand` | `linecap=round` `<circle cx=9 cy=8 r=3.2/><circle cx=16.5 cy=9 r=2.6/><path d="M3.5 19c.5-3.3 2.6-5 5.5-5s5 1.7 5.5 5"/><path d="M15 14.4c2.6 0 4.3 1.5 4.8 4.4"/>` | `Users` |
| `iMusic` | `linecap+linejoin round` `<path d="M9 18V6l10-2v12"/><circle cx=6.5 cy=18 r=2.5/><circle cx=16.5 cy=16 r=2.5/>` | `Music` |
| `iHome` | `linejoin=round` `<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>` | `Home` |
| `iPin` | `linejoin=round` `<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx=12 cy=11 r=2/>` | `MapPin` |
| `iClock` | `linecap=round` `<circle cx=12 cy=12 r=8.5/><path d="M12 7.5V12l3 2"/>` | `Clock` |
| `iEuro` | `<span style="font-size:20px">€</span>` (text glyph, not an SVG) | `Euro` |
| `iDrum` | `linecap=round` `<ellipse cx=12 cy=8 rx=8 ry=3/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"/><path d="M8 10.5v8M16 10.5v8"/>` | custom (drum) |
| `iNote` | `linecap+linejoin round` `<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6"/>` | `FileText` |

**Middle cell** (`min-width:0`) — two mutually exclusive states:

*(a) `k.editing` (`state.editId === k.id`)*
- `<form onSubmit="{{ k.save }}" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">`
- Input `value="{{ editText }}" aria-label="Angabe bearbeiten" data-edit-input="1"` — `flex:1;min-width:220px;height:42px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,200,160,.3);background:rgba(0,0,0,.25);color:#f5ece2;font:inherit;font-size:16px`; handler `onEditText` → `setState({ editText: e.target.value })`. Auto-focused when the edit opens.
- Submit `"Speichern"` — `height:42px;padding:0 16px;border-radius:999px;border:0;background:#ff6926;color:#fff;font-size:14px;font-weight:600`; hover `#ff7a3d`
- `"Abbrechen"` (`type=button`) — `height:42px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font-size:14px`; hover `rgba(255,255,255,.08)`; handler `cancelEdit` → `setState({ editId: null })`
- `sc-if k.isFact` hint (`margin-top:6px;font-size:13px;color:#a89684`): `"Diese Angabe ist Teil eures Suchauftrags und wird dort ebenfalls aktualisiert."`
- **Save handler**: `e.preventDefault(); const t = editText.trim(); if (!t) return; if (k.factId) A.updateFact(k.factId, t); else A.updateKnowledge(k.id, { text: t }, 'Angabe korrigiert: ' + t); setState({ editId: null }); flash('flashId', k.id, 1200);`
- **shadcn candidate**: `Input` + `Button` + `Button variant="outline"` inside a `<form>`.

*(b) `k.notEditing`*
- Text `{{ k.text }}` — `font-size:17px`
- `sc-if k.isAssumed` → pill `"Noch zu bestätigen"` — `display:inline-flex;margin-top:6px;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,140,90,.5);background:rgba(255,105,38,.12);font-size:13px;color:#ffd9c4` → **shadcn candidate**: `Badge variant="outline"` with accent tokens.
- `sc-if k.notAssumed` → origin line `{{ k.origin }}` — `margin-top:2px;font-size:13.5px;color:#a89684`
- `sc-if k.originOpen` (`state.originId === k.id`) → `"Herkunft: "` + `{{ k.origin }}` + `". Verwendet für: "` + `{{ k.usage }}` + `"."` — `margin-top:6px;font-size:13.5px;color:#cbb9a8;animation:stFade .2s ease both`
  - `k.usage` = `'Suchauftrag und Anfragen'` when the row has a `factId`, else `'Einordnung von Räumen und Mitnutzern, kein harter Filter'`
  - **`originId` has no dismissal path.** There is no close control on this line, and it is **not** cleared by Escape, by switching tabs, by closing the kebab menu, by clicking elsewhere, or by any timeout. It is only ever *displaced* — by `showOrigin` on a different row (`setState({ originId: k.id, menuId: null })`) — or cleared as a side effect of `edit` on any row (`setState({ …, originId: null })`). So once opened it stays visible indefinitely for the rest of the session. The port should decide explicitly whether to keep that (1:1) or add a dismissal; either way it must not be left to chance.

**Right cell** — two mutually exclusive control groups:

*(a) `k.isAssumed`* → `display:flex;gap:6px;align-items:center`
- `"Stimmt"` — `height:38px;padding:0 14px;border:0;background:none;color:#f5ece2;font-size:15px;cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.4)`; hover `color:#ff8a4e`.
  Handler `confirm` → `A.updateKnowledge(k.id, { status:'confirmed', origin:'Von euch bestätigt · Präferenz, kein Ausschluss' }, 'Präferenz bestätigt: ' + k.text)` + `flash('flashId', k.id, 1200)`.
- `"Nicht wichtig"` — `height:38px;padding:0 14px;border:0;background:none;color:#e2d3c3;font-size:15px;cursor:pointer`; hover `color:#fff`.
  Handler `dismiss` → `A.updateKnowledge(k.id, { status:'retired' }, 'Annahme verworfen: ' + k.text)` + `toast('Nicht mehr in den aktiven Präferenzen. Andere Musikangaben bleiben erhalten.')`. **Note: `dismiss` does NOT set the undo bar** — only the menu's "Nicht mehr verwenden" does.
- **shadcn candidate**: `Button variant="link"` + `Button variant="ghost"`.

*(b) `k.showTools`* (`!assumed && !editing`) → `display:flex;gap:4px;align-items:center;position:relative`
- Pencil button `aria-label="Bearbeiten"` — `width:40px;height:40px;border-radius:50%;border:0;background:none;color:#e2d3c3;cursor:pointer;display:flex;align-items:center;justify-content:center`; hover `rgba(255,255,255,.08)`; SVG 18×18 sw 1.6 linejoin round `<path d="M4 20l4-.8L19.5 7.7a1.8 1.8 0 0 0-2.6-2.6L5.3 16.6z"/>`. Handler `edit` → `setState({ editId: k.id, editText: k.text, menuId: null, originId: null })`.
- Kebab button `aria-label="Mehr" aria-haspopup="menu" aria-expanded="{{ k.menuOpen }}"` — same 40×40 style; SVG 18×18 `fill=currentColor` three circles at cx 6/12/18, cy 12, r 1.7. Handler `menu` → toggles `menuId`.
- `sc-if k.menuOpen` → menu `role="menu"` — `position:absolute;right:0;top:44px;z-index:5;min-width:210px;padding:6px;border-radius:12px;background:rgba(20,15,12,.97);border:1px solid rgba(255,200,160,.16);box-shadow:0 16px 40px rgba(0,0,0,.45);display:flex;flex-direction:column;animation:stFade .15s ease both`
  - Item style: `text-align:left;border:0;background:none;color:#f5ece2;font:inherit;font-size:14.5px;padding:9px 12px;border-radius:8px;cursor:pointer`; hover `rgba(255,255,255,.07)`
  - `"Nicht mehr verwenden"` → handler `retire`:
    - if `k.factId` → `setState({ menuId: null })` + `toast('Diese Angabe gehört zum Suchauftrag. Bearbeite sie dort oder korrigiere sie hier.')` — **facts cannot be retired**
    - else → `A.updateKnowledge(k.id, { status:'retired' }, 'Angabe nicht mehr verwenden: ' + k.text)`, `setState({ menuId:null, retired:k })`, and after **6000 ms** the undo bar clears itself.
  - `"Herkunft ansehen"` → handler `showOrigin` → `setState({ originId: k.id, menuId: null })`
  - **The menu has no outside-click dismissal.** It closes on exactly five paths: Escape (priority 4 in the global keydown handler, §0.7), re-clicking the same kebab (`menu` toggles `menuId`), choosing either of the two items, switching tabs (`t.go` sets `menuId: null`), or opening an inline edit on any row (`edit` sets `menuId: null`). Clicking anywhere else on the surface — including another row, the tab strip's surrounding chrome, or the page background — leaves it open. Nor does it return focus to the kebab when it closes, and there is no roving/arrow-key focus inside it.
  - **shadcn candidate**: `DropdownMenu` + `DropdownMenuItem` — but note this is a **port delta, not a reproduction**: Radix's `DropdownMenu` adds outside-click close, Escape-to-close-with-focus-return to the trigger, and arrow-key roving focus, none of which the prototype has. Adopting it is the right accessibility call; just don't record it as "1:1".

### 7.6 Undo bar (`sc-if undo`, i.e. `!!state.retired`)

- Bar: `role="status"` — `margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,200,160,.14);font-size:14.5px;animation:stFade .2s ease both`
- Text: `„` + `{{ undoText }}` + `“ wird nicht mehr verwendet.` — note the **German typographic quotes „ “** are literal characters in the markup.
- Button `"Rückgängig"` — `border:0;background:none;color:#ff8a4e;font-size:14.5px;font-weight:500;cursor:pointer;padding:4px 8px`. Handler `undoRetire` → `A.updateKnowledge(k.id, { status: k.status }, 'Rückgängig: ' + k.text)` + `setState({ retired: null })`.
- **shadcn candidate**: `Alert` with an action `Button variant="link"` (a `Sonner` toast with an action is the idiomatic alternative, but the prototype pins it inline under the list).

### 7.7 Änderungsverlauf

- Toggle link-button `{{ logLabel }}` = `"Änderungsverlauf ausblenden"` when open, else `"Änderungsverlauf ansehen"` — `margin-top:16px` + shared link style. Handler `toggleLog`.
- `sc-if logOpen` panel: `margin-top:10px;padding:14px 20px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);animation:stFade .2s ease both`
  - `sc-if logEmpty` → `"Noch keine Änderungen in dieser Demo."` — `font-size:14.5px;color:#a89684;padding:4px 0`
  - Entries (`log = (d.knowledgeLog || []).slice().reverse()` → newest first): `display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid rgba(255,220,190,.08);font-size:14.5px`; left `{{ l.text }}`, right `{{ l.when }}` (`color:#a89684;white-space:nowrap`)
  - Demo entry: text `"Budget korrigiert: 400 → 350 €"`, when `"Heute"`
  - Generated log texts (all written into `knowledgeLog` by the host): `"Angabe korrigiert: {text}"`, `"Angabe nicht mehr verwenden: {text}"`, `"Präferenz bestätigt: {text}"`, `"Annahme verworfen: {text}"`, `"Rückgängig: {text}"`, `"{n} Angaben aus Beispiel-Kontext übernommen"`, `"Handlungsspielraum aktualisiert"`.
- **shadcn candidate**: `Collapsible` + `Table` (or a definition list).

### 7.8 "Kontext importieren" row

- Grid: `margin-top:26px;padding-top:24px;border-top:1px solid rgba(255,220,190,.1);display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:center`
- Icon: SVG 26×26 `stroke="#f5ece2" sw 1.5 linecap+linejoin round` `<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/>` (download).
- Title `"Dein bisheriger Kontext kann mitkommen"` — `font-size:18px`
- Sub `"Musik-Kontext aus ChatGPT oder Claude übernehmen."` — `margin-top:4px;font-size:14.5px;color:#cbb9a8`
- Button `"Kontext importieren"` — shared ghost button (46px). Handler `openImport` → `setState({ importStep:1, importText:'', importFree:false, picks:null, importDone:null })`.
- `sc-if importDone` (`role="status"`, `margin-top:14px;font-size:14.5px;color:#cbb9a8;animation:stFade .2s ease both`, lives 5000 ms): text is `n + ' Angabe übernommen.'` for n === 1, else `n + ' Angaben übernommen.'`
- **shadcn candidate**: `Card`-less row + `Button variant="outline"`; the confirmation line stays inline text.

### 7.9 "Gespeicherte Informationen verwalten"

- Link-button, `margin-top:22px` + shared link style. Copy: `"Gespeicherte Informationen verwalten"`. Handler `goPrivacy` → `tryNav(() => A.setPage('privacy'))`.
- **shadcn candidate**: `Button variant="link"`.

---

## 8. Section — Profil (`pProfile`, `page === 'profile'`)

### 8.1 Header

- H1 `"Dein Profil"`
- Lead `"Wie soll dein Scout euch ansprechen?"`

### 8.2 Name form

- Form: `onSubmit="{{ saveName }}"` — `margin-top:28px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:24px;align-items:center;padding-bottom:26px;border-bottom:1px solid rgba(255,220,190,.1)`
- **Initials avatar**: `width:72px;height:72px;border-radius:50%;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:500` showing `{{ draftInitials }}`.
  Initials logic: `nameDraft.trim() === 'Herzbuben' ? 'HB' : words.length ? (words.length > 1 ? words.map(w => w[0]).join('').slice(0,2) : words[0].slice(0,2)).toUpperCase() : '–'` (the fallback is an **en dash** `–`).
  **shadcn candidate**: `Avatar` + `AvatarFallback`.
- Label `"Anzeigename"` — `display:block;font-size:13px;color:#a89684;margin-bottom:6px` → **shadcn candidate**: `Label`.
- Input `aria-label="Anzeigename"` — `flex:1;min-width:220px;height:48px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,220,190,.2);background:rgba(0,0,0,.25);color:#f5ece2;font:inherit;font-size:17px`; value `{{ nameDraft }}` (`state.nameDraft === null ? d.name || '' : state.nameDraft`); handler `onNameDraft` → `setState({ nameDraft: e.target.value, nameSaved: false })` → **shadcn candidate**: `Input`.
- Submit `"Speichern"` — `height:48px;padding:0 22px;border-radius:12px;border:0;background:{{ nameSaveBg }};color:#fff;font-size:15px;font-weight:600;cursor:{{ nameSaveCursor }}`, `disabled="{{ nameUnchanged }}"`.
  `nameUnchanged = !nameDraft.trim() || nameDraft.trim() === d.name`; `nameSaveBg` = `rgba(255,105,38,.4)` when unchanged, `#ff6926` otherwise; `nameSaveCursor` = `not-allowed` / `pointer`.
  Handler `saveName`: `e.preventDefault(); const n = nameDraft.trim(); if (!n || n === d.name) return; A.setName(n); setState({ nameDraft: null }); flash('nameSaved', true, 3000);`
- `sc-if nameSaved` → `"Name gespeichert. Ansprache und Initialen sind aktualisiert."` — `margin-top:8px;font-size:14px;color:#cbb9a8;animation:stFade .2s ease both`
- Wrapper for input+button: `display:flex;gap:10px;flex-wrap:wrap`
- **Note**: the name field is *not* part of the autonomy `draft`; leaving the page with an unsaved name does **not** trigger the discard dialog.

### 8.3 Demo-Login row

- Row: `padding:22px 0;border-bottom:1px solid rgba(255,220,190,.1);display:flex;justify-content:space-between;gap:20px;align-items:center`
- Title `"Demo-Login"` — `font-size:17px`
- Sub `"Lokale Beispielidentität „herzbuben“ · keine echte Anmeldung"` — `margin-top:3px;font-size:14.5px;color:#cbb9a8` (literal German quotes „ “ around *herzbuben*, middle dot `·`)
- Badge `"Designprototyp"` — `font-size:13.5px;color:#a89684;padding:5px 12px;border-radius:999px;border:1px solid rgba(255,220,190,.16)` → **shadcn candidate**: `Badge variant="outline"`.

### 8.4 Footnote

`"Externe Portal-Accounts und deine Scout-Adresse werden bei einer Namensänderung nicht umbenannt."` — `padding:22px 0;font-size:14.5px;color:#cbb9a8;line-height:1.6`

---

## 9. Section — Benachrichtigungen (`pNotif`, `page === 'notifications'`)

### 9.1 Header

- H1 `"Wann soll ich mich melden?"`
- Lead `"Wichtiges erreicht dich immer in der App."`

### 9.2 Notification toggle rows (`notifRows`)

Row: `display:flex;align-items:center;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid rgba(255,220,190,.1)`; label `font-size:17px`; sub `margin-top:2px;font-size:14px;color:#a89684`; container `margin-top:26px;display:flex;flex-direction:column`.

| notif key | label (verbatim) | sub (verbatim) | demo default |
| --- | --- | --- | --- |
| `decision` | `"Wenn deine Entscheidung nötig ist"` | `"Rückfragen, Freigaben und Angebote, die du prüfen sollst"` | on |
| `offer` | `"Wenn ein Angebot eingeht"` | `"Konkrete Angebote mit Konditionen"` | on |
| `digest` | `"Allgemeine Fortschritte als Zusammenfassung"` | `"Gelegentlicher Überblick über Suche und Anfragen"` | off |

Handler per row: `A.setNotif({ ...notif, [k]: !notif[k] })` **and** `toast('Gespeichert')` (2400 ms). Switch `aria-label` = the row label.
**shadcn candidate**: `Switch` + `Label` + `Separator`; the confirmation is a `Sonner` toast in the port (matches the prototype's toast).

### 9.3 Kanal segmented control

- Label `"Kanal"` — `margin-top:28px` + uppercase style.
- Group: `role="radiogroup" aria-label="Kanal"` — `margin-top:12px;display:inline-flex;padding:4px;border-radius:12px;border:1px solid rgba(255,220,190,.16);background:rgba(0,0,0,.2)`
- Segment button: `role="radio" aria-checked="…"` — `height:40px;padding:0 18px;border-radius:9px;border:0;background:{{ bg }};color:#f5ece2;font:inherit;font-size:15px;cursor:pointer;transition:background .15s`; selected `background:rgba(255,105,38,.35)`, otherwise `transparent`.
- Option A: `"In der App"` — `chApp = notif.channel !== 'mail'`; handler `setChApp` → `A.setNotif({ ...notif, channel:'app' })` (**no toast**).
- Option B: `"Scout-Adresse (simuliert)"` — `chMail = notif.channel === 'mail'`; handler `setChMail` → `A.setNotif({ ...notif, channel:'mail' })` (**no toast**).
- **shadcn candidate**: `Tabs` (list-only) or `ToggleGroup type="single"`.

### 9.4 Footnote

`"Präferenzen werden lokal gespeichert. Es wird keine Browser-Berechtigung angefragt und keine echte E-Mail versendet. Notwendige Entscheidungen bleiben in der App sichtbar, auch wenn Benachrichtigungen aus sind."` — `margin-top:18px;font-size:14.5px;color:#cbb9a8;line-height:1.6`

---

## 10. Section — Tarif & Nutzung (`pBilling`, `page === 'billing'`)

### 10.1 Header

- H1 `"Tarif & Nutzung"` (in markup: `Tarif &amp; Nutzung`)
- Lead `"Dein Zugang, deine Aktivität und deine Abrechnung."`

### 10.2 "DEIN ZUGANG"

- Label `"Dein Zugang"` — `margin-top:26px;padding-top:22px;border-top:1px solid rgba(255,220,190,.1)` + uppercase style.
- Row: `margin-top:10px;display:flex;justify-content:space-between;align-items:center;gap:20px;padding-bottom:22px;border-bottom:1px solid rgba(255,220,190,.1)`
  - Title `"Demo-Zugang"` — `font-size:22px`
  - Sub `"Kein kostenpflichtiges Abonnement aktiv."` — `margin-top:4px;font-size:15px;color:#cbb9a8`
  - Button `"Tarife ansehen"` — shared ghost button (46px). Handler `toggleTariff`.
- `sc-if tariffOpen` panel: `margin-top:14px;padding:18px 22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);animation:stFade .2s ease both`
  - `"Tarife sind noch nicht festgelegt."` — `font-size:17px`
  - `"In diesem Prototyp kannst du RoomScout ausprobieren. Es wird nichts berechnet."` — `margin-top:4px;font-size:14.5px;color:#cbb9a8`
- **shadcn candidate**: row + `Button variant="outline"` + `Collapsible`/`Card`.

### 10.3 "AKTIVITÄT IM SEPTEMBER"

- Label `"Aktivität im September"` — `margin-top:24px` + uppercase style. **Hard-coded month** — no date binding in the prototype.
- Stat grid: `margin-top:14px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))`
  1. `padding:6px 0` — value `{{ usageSearches }}` (`d.usage.searches || 0`) `font-size:40px;font-weight:500;letter-spacing:-.02em`; label `{{ usageSearchesLabel }}` = `"Aktive Suche"` when the value is exactly 1, else `"Aktive Suchen"` — `margin-top:2px;font-size:16px;color:#cbb9a8`
  2. `padding:6px 0 6px 28px;border-left:1px solid rgba(255,220,190,.12)` — value `{{ usageContacted }}`; label `"Anbieter kontaktiert"`
  3. `padding:6px 0 6px 28px;border-left:1px solid rgba(255,220,190,.12)` — value `{{ usageTalk }}` (`d.usage.talk || 'Noch nicht erfasst'`, demo: `"Noch nicht erfasst"`) rendered as `font-size:22px;font-weight:400;padding-top:12px;color:#e2d3c3`; label `"Gespräche mit Scout"` — `margin-top:6px;font-size:16px;color:#cbb9a8`
- Footnote `"Aktivitätsübersicht, keine Abrechnungseinheiten."` — `margin-top:10px;font-size:14px;color:#a89684;padding-bottom:22px;border-bottom:1px solid rgba(255,220,190,.1)`
- **shadcn candidate**: three `Card`-less stat cells inside a grid (`Separator orientation="vertical"` between); no `Progress` here.

### 10.4 Payment rows

Both rows share `display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:center;padding:20px 0;border-bottom:1px solid rgba(255,220,190,.1)`; buttons are `height:44px;padding:0 20px` ghost buttons.

| icon | title | sub | button | handler |
| --- | --- | --- | --- | --- |
| SVG 26×26 sw 1.5 `<rect x=3 y=6 width=18 height=12 rx=2.5/><path d="M3 10h18"/>` (card) | `"Zahlungsdaten"` (17px) | `"Keine Zahlungsmethode hinterlegt"` (14.5px, `#cbb9a8`) | `"Verwalten"` | `togglePay` |
| SVG 26×26 sw 1.5 linejoin round `<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>` (home) | `"Rechnungsadresse"` | `"Noch nicht hinterlegt"` | `"Hinzufügen"` | `togglePay` |

- `sc-if payOpen` panel (same style as the tariff panel):
  - `"Zahlungsverwaltung ist noch nicht eingerichtet."` — `font-size:17px`
  - `"Hier würdest du später deine Zahlungs- und Rechnungsdaten verwalten."` — `margin-top:4px;font-size:14.5px;color:#cbb9a8`
- **shadcn candidate**: rows + `Button variant="outline"`; the panel as a `Collapsible`/`Alert`.

### 10.5 "RECHNUNGEN"

- Label `"Rechnungen"` — `margin-top:24px` + uppercase style.
- Empty row: `margin-top:14px;display:grid;grid-template-columns:auto minmax(0,1fr);gap:20px;align-items:center`; icon SVG 26×26 sw 1.5 linejoin round `<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6"/>`; title `"Noch keine Rechnungen"` (17px); sub `"Hier findest du später deine Belege."` (14.5px, `#cbb9a8`)
- Footer note: `"Produktkonzept · Noch keine Zahlungsintegration"` — `margin-top:28px;text-align:right;font-size:14px;color:#a89684`
- **shadcn candidate**: `Table` with an empty state, or the simple grid row shown here.

---

## 11. Section — Datenschutz (`pPrivacy`, `page === 'privacy'`)

### 11.1 Header

- H1 `"Deine Daten, deine Kontrolle"`
- Lead `"Was RoomScout in dieser Demo lokal speichert."`

### 11.2 Rows

Container `margin-top:26px;display:flex;flex-direction:column`. Row 1 gets `border-top` + `border-bottom`, rows 2–5 only `border-bottom` (the last row has none); all `padding:18px 0`, layout `display:flex;justify-content:space-between;align-items:center;gap:20px` (rows 5 & 6 are text-only blocks without the flex row). Titles `font-size:17px`; subs `margin-top:2px;font-size:14.5px;color:#cbb9a8` (rows 5 & 6 add `line-height:1.6`). Buttons: `height:42px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font-size:14.5px`; hover `rgba(255,255,255,.1)`.

| # | title | sub | button | handler |
| --- | --- | --- | --- | --- |
| 1 | `"Gespeicherte Angaben"` | `{{ knowledgeCount }}` + `" Angaben über eure Band und Suche"` (`knowledgeCount` = non-retired knowledge items; demo **8**) | `"Gespeicherte Angaben ansehen"` | `goKnowledge` → `tryNav(() => A.setPage('knowledge'))` |
| 2 | `"Gesprächsverlauf"` | `"Mitschrift eurer Gespräche mit dem Scout, in der App einsehbar"` | — | — |
| 3 | `"Portalzugänge"` | `{{ connectedCount }}` + `" verbundener Portalzugang, simuliert"` (`connectedCount` = `sources.filter(x => x.access === 'connected').length`; demo **1**) | `"Portalzugänge verwalten"` | `goSources` → `tryNav(() => A.setPage('sources'))` |
| 4 | `"Export"` | `"Exportiert ausschließlich die lokalen Demo-Daten dieses Prototyps als JSON."` | `"Demo-Daten exportieren"` | `exportData` |
| 5 | `"Konto löschen"` | `"Im späteren Produkt würde hier die endgültige Löschung aller Kontodaten angestoßen. In dieser Demo gibt es dafür noch keine Funktion; der Demo-Neustart ersetzt sie nicht."` | — | — |
| 6 | `"Beteiligte Dienstleister"` | `"Für Text und Auswertung, Quellenbeobachtung, Scout-Postfächer, Portal-Zugänge sowie Sprache: Convex, Firecrawl, AgentMail, Browserbase und OpenAI. Welche Daten dabei verarbeitet werden, hängt von der konkreten Funktion ab und wäre im Produkt einzeln erklärt."` | — | — |

**Note**: the `connectedCount` sub-line is grammatically singular and not pluralised in the prototype.

**`exportData` handler**:
```js
try {
  const blob = new Blob([JSON.stringify(A.exportData(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'roomscout-demo-daten.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  this.toast('Lokale Demo-Daten exportiert.');
} catch (e) { this.toast('Export war nicht möglich.'); }
```
Host payload: `{ name, facts, knowledge, sources:[{id,enabled,access}], rules, notif, hinweis:'Lokale Demo-Daten des Designprototyps' }`.

- **shadcn candidate**: list of rows with `Separator`; `Button variant="outline"` each; export confirmation via `Sonner`. Row 5 would become an `AlertDialog`-gated destructive action in the real product (not implemented in the prototype).

---

## 12. Overlay — "Verbindung zu roomscout.dev" sheet

Visibility: `sc-if value="{{ sheetOpen }}"` where `sheetOpen = !!state.sheet`; `state.sheet ∈ { 'info', 'confirm', 'login' }`.
Opened from the `data-conn-trigger` button of **any** portal source row — the trigger is rendered by `sc-if value="{{ s.isPortal }}"`, i.e. for every source with `kind === 'portal'` (§4.6), not only the one with `id === 'roomscout'`. In the demo data only roomscout.dev is a portal, so in practice there is exactly one trigger.

The sheet's *contents*, however, are hard-wired to roomscout regardless of which row was clicked: `const room = sources.find(x => x.id === 'roomscout') || {}` (the `|| {}` means a data set with no `roomscout` source opens an empty sheet rather than crashing), the title is the literal string `"Verbindung zu roomscout.dev"`, and `disconnect` / `finishLogin` call `A.setAccess('roomscout', …)`. Two consequences a builder must know:

- With a second portal source in the data, its trigger opens **roomscout's** profile / state / lastAccess and its buttons mutate **roomscout's** access.
- `closeSheet()` restores focus via `rootRef.querySelector('[data-conn-trigger]')` — the **first** portal row's button in DOM order, not the trigger that opened the sheet.

**The port must parameterise the sheet by source id** (title, `room`, and both `setAccess` calls) and restore focus to the actual trigger element. Everything below describes the prototype's single-portal behaviour verbatim.

### 12.1 Framing

- Scrim: `position:absolute;inset:0;z-index:20;background:rgba(6,4,3,.55);animation:stFade .2s ease both`, `onClick = closeSheet`.
- Panel: `role="dialog" aria-modal="true" aria-labelledby="st-sheet-title"` — `position:absolute;z-index:21;top:0;right:0;bottom:0;width:min(480px,100%);background:rgba(18,14,11,.98);border-left:1px solid rgba(255,200,160,.16);padding:34px 34px 30px;overflow:auto;animation:stFade .25s ease both;display:flex;flex-direction:column`
- **shadcn candidate**: `Sheet` + `SheetContent side="right"` — but it must be constrained to the panel, not the viewport (`Sheet` with a custom portal container, or a plain absolutely positioned `<aside>`). Note `Sheet` adds a focus trap, background `inert` and focus restore-to-trigger that the prototype does not have; the prototype only moves initial focus to the close button and restores to the *first* `[data-conn-trigger]`. Keep the primitive's behaviour — it is strictly better — but record it as a delta, not as 1:1. See the "Port delta: overlay semantics" table in §0.7.

### 12.2 Header

- Row: `display:flex;justify-content:space-between;align-items:center`
- Title `"Verbindung zu roomscout.dev"` (`id="st-sheet-title"`) — `margin:0;font-size:26px;font-weight:500;letter-spacing:-.01em`
- Close button `aria-label="Schließen"` (`ref=sheetCloseRef`, autofocused) — `width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#f5ece2;cursor:pointer;display:flex;align-items:center;justify-content:center`; hover `rgba(255,255,255,.12)`; SVG 18×18 sw 2 linecap round `<path d="M6 6l12 12M18 6L6 18"/>`. Handler `closeSheet` → clears `sheet` + `sheetMsg`, then refocuses `[data-conn-trigger]`.

### 12.3 Detail list

Container `margin-top:26px;display:flex;flex-direction:column;gap:14px;font-size:16px;line-height:1.5`; each row `display:flex;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,220,190,.1)`; the left term is `color:#a89684`.

| term | value binding | values |
| --- | --- | --- |
| `"Portalprofil"` | `{{ portalProfile }}` = `room.profile \|\| d.name` | demo `"Herzbuben"` |
| `"Zustand"` | `{{ connState }}` + dot `width:9px;height:9px;border-radius:50%;background:{{ connDot }}` | `access==='connected'` → `"Verbunden"` / `#4fbf7a`; `access==='expired'` → `"Anmeldung erneut nötig"` / `#e0a13a`; else → `"Nicht verbunden"` / `rgba(255,255,255,.3)` |
| `"Letzter erfolgreicher Zugriff"` | `{{ lastAccess }}` = `room.lastAccess \|\| (connected ? 'In dieser Demo noch kein Zugriff' : 'Noch kein Zugriff')` | demo `"In dieser Demo noch kein Zugriff"` |

Explanation paragraph (`color:#cbb9a8;font-size:15px`), `{{ connExplain }}` (constant):
`"Mit diesem Zugang kann dein Scout Anzeigen auf roomscout.dev lesen, Anbieter anschreiben und Antworten im Portal abrufen. Zugangsdaten werden im Prototyp nicht gespeichert."`

Then a `flex:1` spacer pushes the action area to the bottom.

**shadcn candidate**: definition rows → simple flex rows or `Table`; state chip → custom dot + text (or `Badge`).

### 12.4 Action states (mutually exclusive)

**(a) `sheetInfoConnected` = `sheet === 'info' && room.access === 'connected'`**
- Button `"Verbindung trennen"` — `margin-top:24px;height:48px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font-size:15px`; hover `rgba(255,255,255,.1)`; full width (no explicit width → stretches in the column). Handler `askDisconnect` → `setState({ sheet: 'confirm' })`.
- **shadcn candidate**: `Button variant="outline"`.

**(b) `sheetConfirm` = `sheet === 'confirm'`**
- Card: `margin-top:24px;padding:18px 20px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,200,160,.16);animation:stFade .2s ease both`
- Text `"RoomScout verliert den gespeicherten Zugang. Dein Account auf dem Portal bleibt bestehen."` — `font-size:15.5px;line-height:1.5`
- Buttons `margin-top:16px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap`:
  - `"Verbunden bleiben"` — `height:44px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font-size:15px`; hover `rgba(255,255,255,.08)`. Handler `stayConnected` → `setState({ sheet: 'info' })`.
  - `"Verbindung trennen"` — `height:44px;padding:0 18px;border-radius:12px;border:0;background:#b8382a;color:#fff;font-size:15px;font-weight:600`; hover `#c9463a`. Handler `disconnect` → `A.setAccess('roomscout','none')` + `setState({ sheet:'info', sheetMsg:'Zugang entfernt. Dein Account auf dem Portal bleibt bestehen.' })`.
- **shadcn candidate**: inline confirmation `Card` with `Button variant="outline"` + `Button variant="destructive"` (kept inline rather than a nested `AlertDialog`, to match).

**(c) `sheetInfoDisconnected` = `sheet === 'info' && room.access !== 'connected'`**
- Text `"Zum Lesen oder Senden privater Nachrichten musst du dich verbinden."` — `margin-top:24px;font-size:15px;color:#e2d3c3`
- Button `"Anmeldung öffnen"` — `margin-top:14px;height:48px;border-radius:12px;border:0;background:#ff6926;color:#fff;font-size:15px;font-weight:600`; hover `#ff7a3d`. Handler `openLogin` → `setState({ sheet:'login', sheetMsg:null })`.

**(d) `sheetLogin` = `sheet === 'login'`**
- Card: `margin-top:24px;padding:20px;border-radius:14px;background:rgba(255,255,255,.04);border:1px dashed rgba(255,200,160,.35);animation:stFade .2s ease both` — note the **dashed** border, marking the simulation.
- Eyebrow `"Demo-Anmeldesimulation"` — `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#ff8a4e;font-weight:500`
- Body `"Dies ist keine echte Login-Seite von roomscout.dev. Es werden keine Zugangsdaten abgefragt oder gespeichert. Die Anmeldung wird lokal simuliert."` — `margin-top:10px;font-size:15px;line-height:1.55;color:#e2d3c3`
- Buttons `margin-top:16px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap`:
  - `"Abbrechen"` — outline 44px. Handler `cancelLogin` → `setState({ sheet: 'info' })`.
  - `"Demo-Anmeldung abschließen"` — primary 44px. Handler `finishLogin` → `A.setAccess('roomscout','connected')` + `setState({ sheet:'info', sheetMsg:'Zugang gespeichert. Dein Scout kann weitermachen.' })`.

**(e) `sheetMsg` (any state)**
- `role="status"` — `margin-top:14px;font-size:14.5px;color:#cbb9a8;animation:stFade .2s ease both`. Values: `"Zugang entfernt. Dein Account auf dem Portal bleibt bestehen."` or `"Zugang gespeichert. Dein Scout kann weitermachen."` It is cleared by `closeSheet`, `openLogin`, and by opening the sheet.

---

## 13. Overlay — "Kontext importieren" 3-step dialog

Visibility: `sc-if value="{{ importOpen }}"` where `importOpen = state.importStep > 0`.

### 13.1 Framing

- Scrim: `position:absolute;inset:0;z-index:20;background:rgba(6,4,3,.6);animation:stFade .2s ease both`, `onClick = closeImport`.
- Dialog: `role="dialog" aria-modal="true" aria-labelledby="st-import-title"` — `position:absolute;z-index:21;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100% - 48px));max-height:calc(100% - 48px);overflow:auto;background:rgba(18,14,11,.98);border:1px solid rgba(255,200,160,.16);border-radius:22px;padding:30px 32px;animation:stFade .25s ease both;box-shadow:0 30px 80px rgba(0,0,0,.5)`
- Header row: `display:flex;justify-content:space-between;align-items:center`
  - Eyebrow: `"Schritt "` + `{{ importStep }}` + `" von 3"` — uppercase label style (`font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`)
  - Title `{{ importTitle }}` (`id="st-import-title"`) — `margin:6px 0 0;font-size:24px;font-weight:500`; values by step: `['', 'Kontext vorbereiten', 'Ergebnis einfügen', 'Vor Übernahme prüfen'][step]`
  - Close button `aria-label="Schließen"` (`ref=importCloseRef`, autofocused) — identical to the sheet's close button. Handler `closeImport` → `setState({ importStep:0, importText:'', importFree:false, picks:null })`.
- **shadcn candidate**: `Dialog` + `DialogContent` + `DialogHeader`/`DialogTitle` + `DialogDescription`; the step eyebrow as a small uppercase `<div>`; consider `Progress`/step dots only if the port wants them (the prototype has none). As with the sheet, `Dialog` contributes a focus trap, background `inert` and focus restore that the prototype lacks (it only focuses the close button on open, and restores nothing on close) — keep them, but see the "Port delta: overlay semantics" table in §0.7.

### 13.2 Step 1 — "Kontext vorbereiten" (`imp1`)

- Intro `"Kopiere diesen Prompt in ChatGPT oder Claude und lass dir den musikbezogenen Kontext zusammenfassen."` — `margin-top:18px;font-size:15px;color:#cbb9a8`
- Prompt box (`data-import-prompt="1"`): `margin-top:12px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,200,160,.14);font-size:14.5px;line-height:1.6;color:#f5ece2;user-select:all` containing `IMPORT_PROMPT` verbatim:

  > `"Fasse ausschließlich den musikbezogenen Kontext zusammen, den du tatsächlich über mich und meine Band kennst: Besetzung, Instrumente, Musikrichtung, Proberaumwünsche, Budget, Verfügbarkeit und relevante Wege. Erfinde nichts, kennzeichne Unsicheres und lasse Passwörter, Kontaktdaten und sachfremde persönliche Informationen weg. Falls dir kein solcher Kontext vorliegt, sage das ausdrücklich."`

- Footer: `margin-top:18px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap`
  - `{{ copyPromptLabel }}` = `"Kopiert"` when `copyPromptState === 'ok'` else `"Prompt kopieren"` — ghost button, but **`padding:0 20px`, not the shared `0 22px`** of §3.4: `height:46px;padding:0 20px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer;min-width:150px`; hover `rgba(255,255,255,.1)`. Handler `copyPrompt` → `copy(IMPORT_PROMPT, 'copyPromptState')` (no fail key → failure shows the toast `"Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst."`, including synchronously when the Clipboard API is unavailable — §0.7).
  - `"Weiter"` — primary 46px. Handler `impNext` → `setState({ importStep: 2 })`.

### 13.3 Step 2 — "Ergebnis einfügen" (`imp2`)

- Label `"Musik-Kontext einfügen"` (`for="st-import-text"`) — `display:block;margin-top:18px;font-size:14px;color:#a89684`
- Textarea `id="st-import-text" rows="6" placeholder="Zusammenfassung hier einfügen …"` — `margin-top:6px;width:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,220,190,.2);background:rgba(0,0,0,.25);color:#f5ece2;font:inherit;font-size:15px;line-height:1.55;resize:vertical`. Handler `onImportText` → `setState({ importText: e.target.value })`.
- Hint `"Bitte keine Zugangsdaten oder sensiblen Informationen einfügen. Der Text wird nach dem Import nicht gespeichert."` — `margin-top:8px;font-size:13.5px;color:#a89684`
- Footer: `margin-top:18px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap`
  - `"Beispiel einsetzen"` — ghost 46px, again with **`padding:0 20px`, not `0 22px`**: `height:46px;padding:0 20px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer`; hover `rgba(255,255,255,.1)`. Handler `useExample` → `setState({ importText: EXAMPLE })` where `EXAMPLE` is:

    > `"Wir sind eine fünfköpfige Band aus Stuttgart (zwei Gitarren, Bass, Schlagzeug, Gesang) und spielen Hardrock und Alternative. Wir proben meist abends nach 19 Uhr und kommen mit dem Auto, ein Parkplatz wäre hilfreich. Beim Budget bin ich unsicher, vermutlich bis 300 € im Monat."`

  - Right group `display:flex;gap:10px`:
    - `"Zurück"` — `height:46px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font-size:15px`; hover `rgba(255,255,255,.08)`. Handler `impBack` → `setState({ importStep: Math.max(1, step-1), importFree: false })`.
    - `"Angaben prüfen"` — `height:46px;padding:0 22px;border-radius:12px;border:0;background:{{ checkBg }};color:#fff;font-size:15px;font-weight:600;cursor:{{ checkCursor }}`, `disabled="{{ importTextEmpty }}"`; `checkBg` = `#ff6926` when text is non-empty else `rgba(255,105,38,.4)`; `checkCursor` = `pointer` / `not-allowed`.
      Handler `checkImport`: `if (!importText.trim()) return; const isEx = importText.trim() === EXAMPLE; const picks = {}; candidates().forEach(c => picks[c.id] = c.def); setState({ importStep: 3, importFree: !isEx, picks: isEx ? picks : null })` — **only the exact example text yields the candidate list**; anything else goes to the free-text branch.
- **shadcn candidate**: `Textarea` + `Label` + `Button`s.

### 13.4 Step 3a — free text (`imp3 && importFree`)

- Card: `margin-top:18px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,200,160,.14);font-size:15px;line-height:1.55;color:#e2d3c3` — text:
  `"Freitext wird in diesem Prototyp nicht automatisch ausgewertet. Für die Demo steht das vorbereitete Beispiel bereit; eigene Angaben kannst du im Gespräch oder direkt in der Wissensliste ergänzen."`
- Footer `margin-top:18px;display:flex;justify-content:flex-end;gap:10px`:
  - `"Zurück"` (outline 46px) → `impBack`
  - `"Beispiel verwenden"` (primary 46px) → `useExampleAndCheck` → `setState({ importText: EXAMPLE, importFree: false, picks: defaults })` (stays on step 3, now showing the candidate list).

### 13.5 Step 3b — candidate list (`imp3 && importCands`, i.e. `!importFree && !!picks`)

- Intro `"Simulierte Auswertung des Beispiels. Wähle, was dein Scout sich merken soll."` — `margin-top:18px;font-size:15px;color:#cbb9a8`
- List container `margin-top:12px;display:flex;flex-direction:column`
- Item `<label>`: `display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:start;padding:12px 6px;border-bottom:1px solid rgba(255,220,190,.08);cursor:pointer`
  - Checkbox: `type="checkbox" checked="{{ c.checked }}"` — `margin-top:4px;width:18px;height:18px;accent-color:#ff6926`. Handler `c.toggle` → flips `picks[c.id]`.
  - Text `{{ c.text }}` — `font-size:16px`
  - Category `{{ c.catLabel }}` = `CATS[c.cat]` — `font-size:13px;color:#a89684;margin-top:2px`
  - `sc-if c.conflict` → `margin-top:6px;display:flex;gap:8px;align-items:flex-start;font-size:13.5px;color:#e0a13a` with a leading dot `margin-top:6px;width:7px;height:7px;border-radius:50%;background:#e0a13a;flex:none`
- **Candidates** (`candidates()`), computed against the current facts (`band` = `"Geteilter Raum · 4 Personen"`, `budget` = `"Bis 350 € / Monat"`):

| id | text | cat → label | default checked (`def`) | conflict text |
| --- | --- | --- | --- | --- |
| `i1` | `"Fünf Bandmitglieder"` | `band` → `"Eure Band"` | `!band` → **false** in the demo | `'Widerspricht „' + band.label + '“ im aktuellen Suchauftrag. Der Suchauftrag wird nicht überschrieben.'` → `"Widerspricht „Geteilter Raum · 4 Personen“ im aktuellen Suchauftrag. Der Suchauftrag wird nicht überschrieben."` (null when no `band` fact) |
| `i2` | `"Besetzung: zwei Gitarren, Bass, Schlagzeug, Gesang"` | `ausstattung` → `"Ausstattung"` | true | — |
| `i3` | `"Proben meist abends nach 19 Uhr"` | `alltag` → `"Alltag & Wege"` | true | — |
| `i4` | `"Anreise mit dem Auto, Parkplatz hilfreich"` | `alltag` → `"Alltag & Wege"` | true | — |
| `i5` | `"Budget bis 300 € (unsicher)"` | `band` → `"Eure Band"` | false | `'Als unsicher gekennzeichnet' + (budget ? ' und abweichend vom Suchauftrag (' + budget.label + ')' : '') + '.'` → `"Als unsicher gekennzeichnet und abweichend vom Suchauftrag (Bis 350 € / Monat)."` |

- Footer: `margin-top:18px;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap`
  - Left: `{{ pickCount }}` + `" ausgewählt"` — `font-size:14px;color:#a89684`
  - Right group: `"Zurück"` (outline 46px → `impBack`) and `"Ausgewählte Angaben übernehmen"` — `height:46px;padding:0 22px;border-radius:12px;border:0;background:{{ applyBg }};color:#fff;font-size:15px;font-weight:600;cursor:{{ applyCursor }}`, `disabled="{{ noPick }}"`; `applyBg` = `#ff6926` / `rgba(255,105,38,.4)`; `applyCursor` = `pointer` / `not-allowed`.
    Handler `applyImport`: opens with the guard **`if (!pickCount) return;`** (belt-and-braces alongside `disabled="{{ noPick }}"`, exactly like `checkImport`'s `if (!importText.trim()) return;` in §13.3), then builds `{ id: 'imp_' + c.id + '_' + Date.now(), cat: c.cat, text: c.text, origin: 'Importiert aus Beispiel-Kontext', status: 'confirmed' }` for each checked candidate, calls `A.addKnowledge(items)`, `closeImport()`, then `flash('importDone', n + (n===1 ? ' Angabe übernommen.' : ' Angaben übernommen.'), 5000)`.
- **shadcn candidate**: `Checkbox` + `Label` rows inside a `ScrollArea`; conflict line as an inline warning (custom) or `Badge variant="outline"`.

---

## 14. Toast

- Visibility: `sc-if value="{{ toast }}"`.
- Style: `role="status"` — `position:absolute;z-index:40;left:50%;bottom:22px;transform:translateX(-50%);padding:10px 18px;border-radius:12px;background:rgba(28,20,14,.96);border:1px solid rgba(255,200,160,.22);font-size:14px;color:#f5ece2;white-space:nowrap;animation:stFade .2s ease both`
- Duration: 2400 ms (single toast slot — a new toast replaces the current one).
- **All toast strings on this surface**:
  - `"Gespeichert"` (any notification switch)
  - `"Diese Angabe gehört zum Suchauftrag. Bearbeite sie dort oder korrigiere sie hier."` (retire attempted on a fact row)
  - `"Nicht mehr in den aktiven Präferenzen. Andere Musikangaben bleiben erhalten."` (assumed row dismissed)
  - `"Noch keine Angaben vorhanden."` (summary edit with an empty knowledge list)
  - `"Lokale Demo-Daten exportiert."` / `"Export war nicht möglich."` (privacy export)
  - `"Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst."` (clipboard failure without a `failKey` — i.e. the import prompt copy)
- **shadcn candidate**: `Sonner` (`toast()`), positioned bottom-center, scoped to the dialog.

---

## 15. State-dependent variants (checklist for the port)

| variant axis | values | affected UI |
| --- | --- | --- |
| `page` prop | `sources` \| `autonomy` \| `knowledge` \| `profile` \| `notifications` \| `billing` \| `privacy` | which `sc-if pXxx` block renders; sidebar active item; content scroll reset + fade-in |
| `actions` present | host mode / standalone mode | in standalone **only** `setPage` exists (writes `state.localPage`); every other action is `undefined` and throws on click, and `setDirty` / `backReq` are skipped entirely. The `DEMO` object supplies data. Prototype bug — see §0.5 |
| section navigation | any → any | **resets nothing.** `expanded`, `tab`, `search`, `moreOpen`, `logOpen`, `limitsOpen`, `detailsA`, `detailsB`, `tariffOpen`, `payOpen`, `originId`, `sheet`, `sheetMsg`, `nameDraft` all survive leaving and returning; only scroll position and the fade-in are re-applied (§0.7). An unsaved `nameDraft` in particular survives and never triggers the discard dialog |
| `hasOrder` | true / false | §4.2 empty card vs. the whole source management block; lead paragraph text |
| `noUsable` | true / false | amber warning banner §4.5 |
| source `enabled` | on / off | `statusText` `"Nicht einbezogen"`, grey dot, `offHint` line, switch state, "Ausschließen"/"Einbeziehen" in the more-list |
| source `kind` | `portal` / `public` | avatar glyph, status text (`"Verbunden"`/`"Anmeldung erneut nötig"` vs `"Ohne Anmeldung"`), connection link visible only for portals, usability |
| source `access` | `connected` / `expired` / `none` / `public` | dot color (`#4fbf7a` / `#e0a13a` / grey), `connLabel`, sheet body variant, `connState`, `lastAccess`, `connectedCount` |
| `flags.publicSearch` | true / false | `demoInactive` pill `"In dieser Demo nicht aktiv"` on public sources; usability of public sources for `noUsable` |
| row `expanded` | id / null | chevron rotation, `grid-template-rows 0fr↔1fr`, row background + border, `margin-bottom:8px` |
| `moreOpen` | true / false | more-sources panel + link label |
| `search` | any string | filtered `moreRows`, `moreEmpty` state — note `moreAll` duplicates the main source list and always contains the hard-coded example row, so `moreEmpty` is unreachable for any query matching it (§4.9) |
| `copyState` / `copyFail` | ok / null / true | `"Kopiert"` label; amber copy-failure hint |
| `rules.mode` | `autopilot` / `review` | selected radio card styling |
| `draft` (dirty) | set / null | save+cancel bar visible, `actions.setDirty`, discard dialog on any navigation |
| `perDayInvalid` | true / false | `aria-invalid`, red alert line, save button disabled + dimmed |
| `detailsA` / `detailsB` / `limitsOpen` | open / closed | the three autonomy explainer blocks; chevron rotation for `limitsOpen` |
| `rulesSaved` | true / null | `"Handlungsspielraum aktualisiert"` line (2600 ms) |
| knowledge `tab` | `band` / `alltag` / `ausstattung` | tab styling, `tabTitle`, row set, empty text |
| knowledge item `status` | `confirmed` / `assumed` / `retired` | `"Noch zu bestätigen"` badge + Stimmt/Nicht-wichtig actions vs. pencil+kebab tools; retired items are filtered out entirely |
| knowledge item `factId` | set / unset | inline-edit hint line, `usage` string, retire blocked with a toast, `updateFact` vs `updateKnowledge` |
| `editId` | id / null | inline edit form vs. read-only row; input autofocus |
| `menuId` / `originId` / `flashId` | id / null | dropdown menu; "Herkunft:" line; 1200 ms orange row flash |
| `retired` | item / null | undo bar (6000 ms window) |
| `logOpen` | true / false | change-log panel + link label |
| `importStep` | 0 / 1 / 2 / 3 | dialog closed / prepare / paste / review |
| `importFree` | true / false | step 3 free-text card vs. candidate list |
| `picks` | object / null | candidate checkboxes; `pickCount`; apply button enabled |
| `nameUnchanged` | true / false | profile save button enabled + color |
| `nameSaved` | true / null | `"Name gespeichert. …"` (3000 ms) |
| `notif.channel` | `app` / `mail` | segmented control selection |
| `tariffOpen` / `payOpen` | true / false | billing explainer panels |
| `sheet` | `null` / `info` / `confirm` / `login` | connection sheet body |
| `discardNext` | fn / null | discard alert dialog |
| `toast` | string / null | bottom toast |
| `prefers-reduced-motion` | reduce | all animations/transitions clamped to 0.01 ms; page-change WAAPI animation skipped |

### Mobile variant

The Settings file itself exposes **no `mobile` prop** and contains **no width-based branching**. The only fluid behaviour comes from:

- `grid-template-columns:repeat(auto-fit,minmax(280px,1fr))` on the autonomy mode cards (stacks below ~600px content width)
- `flex-wrap:wrap` on the per-day row (both the row *and* its `gap:22px` right-hand wrapper, §5.7), the source warning banner, the noOrder card, all dialog footers, the profile input row
- `width:min(480px,100%)` (sheet), `width:min(640px,calc(100% - 48px))` (import), `width:min(440px,calc(100% - 48px))` (discard)
- Source rows and the payment/privacy rows use fixed `auto`/`minmax(0,1fr)` grids that do **not** wrap.

#### But the prototype *does* have an observable mobile rendering — via the host

`Roomscout.dc.html` declares a `mobile` editor prop on its script tag (`{"editor":"boolean","default":false,"tsType":"boolean","section":"Vorschau"}`), toggled in the preview chrome by a `"Mobil"` button (`aria-pressed`, active background `rgba(255,105,38,.35)`). It drives two independent things:

1. **The stage frame.** The host's `data-stage` element switches to a phone shell: `left:50%;top:50%;width:390px;height:min(844px, calc(100% - 32px));transform:translate(-50%,-50%);border-radius:44px;border:1px solid rgba(255,220,190,.2)` (desktop values: `0/0/100%/100%/none/0/0`), with `transition:width .4s,height .4s,border-radius .4s`.
2. **`narrow`.** `const narrow = s.narrow || mobile`, where `s.narrow` is a live `matchMedia('(max-width: 959px)')`. `narrow` shrinks the host header to `hdrH:64` / `hdrPad:'0 18px'` (desktop `84` / `'0 36px'`). Nothing else on the Settings path depends on it.

The Settings embed sits inside `padding:4px 36px 0` and a `max-width:1380px` centring wrapper (§1.1), which is **not** relaxed in mobile. So with `mobile: true` the measured chain is:

| | value |
| --- | --- |
| stage width | `390px` |
| − host wrapper padding | `2 × 36px` |
| **usable width for the Settings panel** | **`318px`** |
| − panel border | `2 × 1px` → `316px` |
| − fixed sidebar track | `296px` |
| **remaining content column** | **`~20px`** |
| panel height | `min(844px, calc(100% − 32px))` − 64px header − 4px gap − footer caption (`~39px`) |

In other words the prototype's own mobile preview is **visually broken for this surface**: the 296px sidebar consumes essentially the entire 318px frame and the content column collapses to a ~20px sliver (its own `padding:42px 46px 40px` alone exceeds the available width, so text overflows or wraps to single characters). This is a preview artefact of embedding a fixed-sidebar desktop layout in a phone frame, **not a design to reproduce**. Treat the mobile layout as unspecified by the prototype and build it from the plan below.

For the port, add these (not present in the prototype, but required):

- `< 900px`: collapse the 296px sidebar. sidebar-13 pattern → render the `Sidebar` as a `Sheet` (`Sidebar` in mobile mode already does this) triggered from the breadcrumb header, or convert the nav into a horizontal `Tabs`/`Select` above the content.
- `< 900px`: content padding `42px 46px 40px` → ~`24px 18px 28px`; H1 `44px` → ~`30–32px`; lead `19px` → `16px`.
- Source row grid `56px minmax(0,1fr) auto auto auto` → two rows (avatar+name / status+switch+chevron).
- Billing stat grid `repeat(3,minmax(0,1fr))` → single column, drop the `border-left` dividers.
- The connection sheet becomes a full-width bottom `Sheet` on mobile.

---

## 16. shadcn assembly summary (sidebar-13)

```tsx
<Dialog open={open} onOpenChange={requestClose}>            {/* requestClose → tryNav */}
  <DialogContent className="p-0 gap-0 overflow-hidden rounded-[28px] max-w-[1380px] h-[min(820px,calc(100dvh-140px))] min-h-[560px]">
    <SidebarProvider className="items-start min-h-0">
      <Sidebar collapsible="none" className="w-[296px] hidden md:flex">
        <SidebarHeader>  {/* "Zurück zum Scout" + session line */}
        <SidebarContent>
          <SidebarGroup><SidebarGroupLabel>DEIN SCOUT</SidebarGroupLabel>
            <SidebarMenu>{navScout}</SidebarMenu></SidebarGroup>
          <SidebarGroup><SidebarGroupLabel>DEIN KONTO</SidebarGroupLabel>
            <SidebarMenu>{navAccount}</SidebarMenu></SidebarGroup>
        </SidebarContent>
        <SidebarFooter>  {/* name + "Persönlicher Bereich" */}
      </Sidebar>
      <main className="flex flex-1 min-w-0 flex-col">
        <header>  {/* Breadcrumb: Einstellungen / {PAGES[page]}  +  DialogClose */}
        <ScrollArea className="flex-1">{sectionForPage(page)}</ScrollArea>
      </main>
    </SidebarProvider>
    <ConnectionSheet />   {/* absolutely positioned inside DialogContent */}
    <ImportDialog />      {/* nested Dialog */}
    <DiscardAlert />      {/* AlertDialog */}
    <Toaster />           {/* Sonner, bottom-center, scoped */}
  </DialogContent>
</Dialog>
```

Component map at a glance: `Dialog`/`DialogContent` (panel) · `Sidebar` family (nav) · `Breadcrumb` (header) · `ScrollArea` (content) · `Switch` (all toggles) · `RadioGroup`+`Card` (modes) · `Accordion`+`Card` (source rows) · `Avatar` (source + profile) · `Badge` (status pills) · `Input`/`Textarea`/`Label` (forms) · `Button` (default/outline/ghost/link/destructive) · `Tabs` (knowledge categories, channel segmented) · `DropdownMenu` (row kebab) · `Collapsible` (details/limits/log/more/tariff/pay) · `Alert` (warnings, lock card, undo bar) · `AlertDialog` (discard) · `Sheet` (connection) · `Checkbox` (import candidates) · `Separator` (dividers) · `Sonner` (toasts) · `Tooltip` (icon buttons, disabled more-list button) · `Table` (optional for the more-sources list and change log). No `Progress`, `Skeleton` or `Select` is needed by the prototype.

---

## 17. Copy dictionary (DE)

All user-visible strings on this surface, verbatim (including „ “ · – − € … typography). Keys are stable and grouped by section. `{n}`, `{name}`, `{text}`, `{origin}`, `{usage}`, `{city}`, `{profile}` are interpolations.

### 17.1 Navigation & shell

```
settings.nav.back: "Zurück zum Scout"
settings.nav.aria: "Einstellungen"
settings.nav.groupScout: "Dein Scout"
settings.nav.groupAccount: "Dein Konto"
settings.nav.item.sources: "Quellen & Zugänge"
settings.nav.item.autonomy: "Handlungsspielraum"
settings.nav.item.knowledge: "Was dein Scout weiß"
settings.nav.item.profile: "Profil"
settings.nav.item.notifications: "Benachrichtigungen"
settings.nav.item.billing: "Tarif & Nutzung"
settings.nav.item.privacy: "Datenschutz"
settings.nav.footer.role: "Persönlicher Bereich"
settings.session.working: "Scout ist unterwegs"
settings.session.paused: "Suche pausiert"
settings.session.held: "Gespräch pausiert · läuft weiter, wenn du zurückkehrst"
settings.host.caption: "Designprototyp · Beispieldaten"
```

### 17.2 Quellen & Zugänge

```
sources.title: "Wo darf dein Scout suchen?"
sources.subtitle.withOrder: "Quellen für eure Suche in {city}."
sources.subtitle.noOrder: "Quellen gelten für einen konkreten Suchauftrag."
sources.noOrder.title: "Lege zuerst einen Suchauftrag an."
sources.noOrder.body: "Quellen gelten immer für eine konkrete Suche. Deine Portalzugänge bleiben davon unabhängig."
sources.noOrder.cta: "Zum Scout"
sources.auto.title: "Passende Quellen automatisch auswählen"
sources.auto.sub: "Deine Ausschlüsse bleiben erhalten."
sources.auto.saved: "Gespeichert"
sources.list.label: "Deine Quellen"
sources.list.scope: "Für diese Suche"
sources.noUsable.text: "Aktuell ist keine nutzbare Quelle ausgewählt. Dein Scout kann so nicht weitersuchen."
sources.noUsable.cta: "Quelle auswählen"
sources.status.excluded: "Nicht einbezogen"
sources.status.connected: "Verbunden"
sources.status.expired: "Anmeldung erneut nötig"
sources.status.public: "Ohne Anmeldung"
sources.row.saved: "Gespeichert"
sources.row.switchAria: "{name} für diese Suche verwenden"
sources.row.detailsAria: "Details"
sources.detail.portalProfile: "Portalprofil: {profile}"
sources.detail.portalScope: "Anzeigen lesen und Nachrichten austauschen"
sources.detail.publicListings: "Öffentliche Anzeigen können berücksichtigt werden. Der Kontaktweg hängt von der Anzeige ab."
sources.detail.demoInactive: "In dieser Demo nicht aktiv"
sources.detail.outOfRegion: "Hamburg liegt außerhalb eurer Suche. Eine Anmeldung ist dafür nicht nötig."
sources.detail.offHint: "Keine neuen Anfragen über diese Quelle. Vorhandene Gespräche bleiben sichtbar."
sources.detail.manageConnection: "Verbindung verwalten"
sources.detail.openLogin: "Anmeldung öffnen"
sources.address.title: "Deine Scout-Adresse"
sources.address.value: "herzbuben@scout.example"
sources.address.hint: "Für Portal-Anmeldungen und Antworten an deinen Scout."
sources.address.copy: "Kopieren"
sources.address.copied: "Kopiert"
sources.address.copyFail: "Kopieren war nicht möglich. Du kannst die Adresse markieren und selbst kopieren."
sources.more.show: "Weitere Quellen ansehen"
sources.more.hide: "Weitere Quellen ausblenden"
sources.more.note: "Eine Quelle auszuschließen löscht keinen Portal-Account."
sources.more.searchPlaceholder: "Quelle oder Region suchen …"
sources.more.searchAria: "Quellen durchsuchen"
sources.more.state.available: "Verfügbar"
sources.more.state.loginNeeded: "Anmeldung nötig"
sources.more.state.unavailable: "Noch nicht verfügbar"
sources.more.action.exclude: "Ausschließen"
sources.more.action.include: "Einbeziehen"
sources.more.action.unavailable: "Nicht verfügbar"
sources.more.example.name: "Proberaumbörse Süd (Beispiel)"
sources.more.example.region: "Baden-Württemberg"
sources.more.example.title: "Diese Beispielquelle ist im Prototyp nicht angebunden."
sources.more.empty: "Keine Quelle gefunden. Die Liste zeigt nur die vorhandenen Demo-Quellen."
sources.more.footnote: "Demo-Quellen. Keine vollständige Liste aller Portale."
```

Demo source data (also user-visible):

```
sources.demo.roomscout.name: "roomscout.dev"
sources.demo.roomscout.desc: "Kontrolliertes Demo-Portal"
sources.demo.roomscout.profile: "Herzbuben"
sources.demo.musiker.name: "Musiker in deiner Stadt"
sources.demo.musiker.desc: "Stuttgart · Öffentliche Anzeigen"
sources.demo.bandnet.name: "Bandnet Hamburg"
sources.demo.bandnet.desc: "Hamburg · Andere Region"
```

### 17.3 Verbindung zu roomscout.dev (sheet)

```
connection.title: "Verbindung zu roomscout.dev"
connection.closeAria: "Schließen"
connection.field.profile: "Portalprofil"
connection.field.state: "Zustand"
connection.field.lastAccess: "Letzter erfolgreicher Zugriff"
connection.state.connected: "Verbunden"
connection.state.expired: "Anmeldung erneut nötig"
connection.state.disconnected: "Nicht verbunden"
connection.lastAccess.connectedNone: "In dieser Demo noch kein Zugriff"
connection.lastAccess.none: "Noch kein Zugriff"
connection.explain: "Mit diesem Zugang kann dein Scout Anzeigen auf roomscout.dev lesen, Anbieter anschreiben und Antworten im Portal abrufen. Zugangsdaten werden im Prototyp nicht gespeichert."
connection.disconnect: "Verbindung trennen"
connection.confirm.body: "RoomScout verliert den gespeicherten Zugang. Dein Account auf dem Portal bleibt bestehen."
connection.confirm.stay: "Verbunden bleiben"
connection.confirm.disconnect: "Verbindung trennen"
connection.disconnected.hint: "Zum Lesen oder Senden privater Nachrichten musst du dich verbinden."
connection.disconnected.cta: "Anmeldung öffnen"
connection.login.eyebrow: "Demo-Anmeldesimulation"
connection.login.body: "Dies ist keine echte Login-Seite von roomscout.dev. Es werden keine Zugangsdaten abgefragt oder gespeichert. Die Anmeldung wird lokal simuliert."
connection.login.cancel: "Abbrechen"
connection.login.finish: "Demo-Anmeldung abschließen"
connection.msg.removed: "Zugang entfernt. Dein Account auf dem Portal bleibt bestehen."
connection.msg.saved: "Zugang gespeichert. Dein Scout kann weitermachen."
```

### 17.4 Handlungsspielraum

```
autonomy.title: "So arbeitet dein Scout"
autonomy.subtitle: "Du bestimmst, wie selbstständig ich vorgehe."
autonomy.modeGroupAria: "Arbeitsmodus"
autonomy.mode.autopilot.title: "Autopilot"
autonomy.mode.autopilot.sub: "Suchen, anfragen und Details klären."
autonomy.mode.review.title: "Mit Rücksprache"
autonomy.mode.review.sub: "Nachrichten vor dem Versand prüfen."
autonomy.actions.label: "Was ich selbstständig erledigen darf"
autonomy.details.toggle: "Details"
autonomy.actions.details: "Anschreiben umfasst Erstanfragen und Nachfragen zu Verfügbarkeit, Preis und Ausstattung. Besichtigungen werden nur vorgeschlagen, nie verbindlich zugesagt. Eine eigene Suchanzeige wäre öffentlich sichtbar und enthält nur freigegebene Informationen."
autonomy.action.contact: "Anbieter anschreiben und nachfassen"
autonomy.action.viewings: "Besichtigungstermine vorschlagen"
autonomy.action.publishAd: "Eigene Suchanzeige veröffentlichen"
autonomy.share.label: "Was ich teilen darf"
autonomy.share.details: "Bandprofil: Bandname, Besetzung, Musikrichtung, gewünschte Probezeiten und die Scout-Adresse. Privat: persönliche Telefonnummern und genaue Wohnadressen. Diese Freigabe gilt unabhängig vom Arbeitsmodus."
autonomy.share.profile: "Bandprofil, Verfügbarkeit und Scout-Adresse"
autonomy.share.private: "Private Telefonnummer und genaue Adresse"
autonomy.limits.label: "Grenzen"
autonomy.limits.perDay: "Neue Anbieter pro Tag"
autonomy.limits.decAria: "Weniger"
autonomy.limits.incAria: "Mehr"
autonomy.limits.more: "Weitere Grenzen"
autonomy.limits.invalid: "Bitte eine ganze Zahl größer als 0 eingeben."
autonomy.limits.caption: "Gemeint sind neue kontaktierte Anbieter, nicht die Nachrichten in einer laufenden Unterhaltung."
autonomy.limits.periodLabel: "Suchzeitraum:"
autonomy.limits.periodValue: "bis ihr den Suchauftrag beendet oder ein Angebot annehmt."
autonomy.limits.stopsLabel: "Geltende Stopps:"
autonomy.limits.stopsValue: "Suche jederzeit im Hauptbereich pausierbar; verbindliche Zusagen nie automatisch."
autonomy.limits.budgetLabel: "Budget:"
autonomy.limits.budgetValue: "gehört zum Suchauftrag."
autonomy.limits.budgetLink: "Suchauftrag bearbeiten"
autonomy.lock.title: "Verbindliche Entscheidungen bleiben bei dir."
autonomy.lock.sub: "Verträge, Buchungen und Zahlungen brauchen immer deine Freigabe."
autonomy.saved: "Handlungsspielraum aktualisiert"
autonomy.cancel: "Abbrechen"
autonomy.save: "Änderungen speichern"
```

### 17.5 Änderungen verwerfen (dialog)

```
discard.title: "Änderungen verwerfen?"
discard.body: "Dein Handlungsspielraum hat ungespeicherte Änderungen."
discard.keep: "Weiter bearbeiten"
discard.discard: "Verwerfen"
```

### 17.6 Was dein Scout weiß

```
knowledge.title: "Was ich über euch weiß"
knowledge.subtitle: "Korrigiere mich jederzeit. Ihr bestimmt, was ich mir merke."
knowledge.summary.demo: "Ihr seid eine vierköpfige Band aus Stuttgart. Ihr sucht einen geteilten Proberaum und möchtet euer Schlagzeug dort lassen."
knowledge.summary.editAria: "Zugrunde liegende Angaben bearbeiten"
knowledge.tab.band: "Eure Band"
knowledge.tab.alltag: "Alltag & Wege"
knowledge.tab.ausstattung: "Ausstattung"
knowledge.empty.band: "Über eure Band weiß ich noch nichts. Erzähl es mir beim nächsten Gespräch."
knowledge.empty.alltag: "Zu euren Wegen weiß ich noch nichts. Du kannst es mir beim nächsten Gespräch erzählen."
knowledge.empty.ausstattung: "Zu eurer Ausstattung weiß ich noch nichts. Du kannst es mir beim nächsten Gespräch erzählen."
knowledge.edit.inputAria: "Angabe bearbeiten"
knowledge.edit.save: "Speichern"
knowledge.edit.cancel: "Abbrechen"
knowledge.edit.factHint: "Diese Angabe ist Teil eures Suchauftrags und wird dort ebenfalls aktualisiert."
knowledge.badge.assumed: "Noch zu bestätigen"
knowledge.origin.line: "Herkunft: {origin}. Verwendet für: {usage}."
knowledge.usage.fact: "Suchauftrag und Anfragen"
knowledge.usage.preference: "Einordnung von Räumen und Mitnutzern, kein harter Filter"
knowledge.action.confirm: "Stimmt"
knowledge.action.dismiss: "Nicht wichtig"
knowledge.action.editAria: "Bearbeiten"
knowledge.action.menuAria: "Mehr"
knowledge.menu.retire: "Nicht mehr verwenden"
knowledge.menu.origin: "Herkunft ansehen"
knowledge.undo.text: "„{text}“ wird nicht mehr verwendet."
knowledge.undo.action: "Rückgängig"
knowledge.log.show: "Änderungsverlauf ansehen"
knowledge.log.hide: "Änderungsverlauf ausblenden"
knowledge.log.empty: "Noch keine Änderungen in dieser Demo."
knowledge.log.demoEntry: "Budget korrigiert: 400 → 350 €"
knowledge.log.demoWhen: "Heute"
knowledge.log.entry.corrected: "Angabe korrigiert: {text}"
knowledge.log.entry.retired: "Angabe nicht mehr verwenden: {text}"
knowledge.log.entry.confirmed: "Präferenz bestätigt: {text}"
knowledge.log.entry.dismissed: "Annahme verworfen: {text}"
knowledge.log.entry.undo: "Rückgängig: {text}"
knowledge.log.entry.imported: "{n} Angaben aus Beispiel-Kontext übernommen"
knowledge.log.entry.rulesUpdated: "Handlungsspielraum aktualisiert"
knowledge.import.title: "Dein bisheriger Kontext kann mitkommen"
knowledge.import.sub: "Musik-Kontext aus ChatGPT oder Claude übernehmen."
knowledge.import.cta: "Kontext importieren"
knowledge.import.doneOne: "{n} Angabe übernommen."
knowledge.import.doneMany: "{n} Angaben übernommen."
knowledge.managePrivacy: "Gespeicherte Informationen verwalten"
knowledge.toast.factRetire: "Diese Angabe gehört zum Suchauftrag. Bearbeite sie dort oder korrigiere sie hier."
knowledge.toast.dismissed: "Nicht mehr in den aktiven Präferenzen. Andere Musikangaben bleiben erhalten."
knowledge.toast.noItems: "Noch keine Angaben vorhanden."
knowledge.origin.confirmedByYou: "Von euch bestätigt · Präferenz, kein Ausschluss"
knowledge.origin.imported: "Importiert aus Beispiel-Kontext"
```

Demo knowledge items and their origins (user-visible):

```
knowledge.demo.f_band.text: "Geteilter Raum · 4 Personen"
knowledge.demo.f_budget.text: "Bis 350 € / Monat"
knowledge.demo.f_ort.text: "Stuttgart"
knowledge.demo.f_zeit.text: "Donnerstags ab 19 Uhr"
knowledge.demo.f_equip.text: "Schlagzeug darf im Raum bleiben"
knowledge.demo.k_genre.text: "Hardrock und Alternative"
knowledge.demo.k_mates.text: "Ähnliche Musikrichtung bei Mitnutzern wichtig"
knowledge.demo.k_amps.text: "Verstärker bringt ihr selbst mit"
knowledge.demo.origin.fact: "Aus dem Gespräch · Teil eures Suchauftrags"
knowledge.demo.origin.bandprofile: "Demo-Bandprofil"
knowledge.demo.origin.assumption: "Annahme deines Scouts"
knowledge.demo.origin.conversation: "Aus dem Gespräch"
```

### 17.7 Kontext importieren (dialog)

```
import.step: "Schritt {n} von 3"
import.closeAria: "Schließen"
import.title.1: "Kontext vorbereiten"
import.title.2: "Ergebnis einfügen"
import.title.3: "Vor Übernahme prüfen"
import.step1.intro: "Kopiere diesen Prompt in ChatGPT oder Claude und lass dir den musikbezogenen Kontext zusammenfassen."
import.step1.prompt: "Fasse ausschließlich den musikbezogenen Kontext zusammen, den du tatsächlich über mich und meine Band kennst: Besetzung, Instrumente, Musikrichtung, Proberaumwünsche, Budget, Verfügbarkeit und relevante Wege. Erfinde nichts, kennzeichne Unsicheres und lasse Passwörter, Kontaktdaten und sachfremde persönliche Informationen weg. Falls dir kein solcher Kontext vorliegt, sage das ausdrücklich."
import.step1.copy: "Prompt kopieren"
import.step1.copied: "Kopiert"
import.step1.next: "Weiter"
import.step2.label: "Musik-Kontext einfügen"
import.step2.placeholder: "Zusammenfassung hier einfügen …"
import.step2.hint: "Bitte keine Zugangsdaten oder sensiblen Informationen einfügen. Der Text wird nach dem Import nicht gespeichert."
import.step2.useExample: "Beispiel einsetzen"
import.step2.back: "Zurück"
import.step2.check: "Angaben prüfen"
import.example: "Wir sind eine fünfköpfige Band aus Stuttgart (zwei Gitarren, Bass, Schlagzeug, Gesang) und spielen Hardrock und Alternative. Wir proben meist abends nach 19 Uhr und kommen mit dem Auto, ein Parkplatz wäre hilfreich. Beim Budget bin ich unsicher, vermutlich bis 300 € im Monat."
import.step3.free: "Freitext wird in diesem Prototyp nicht automatisch ausgewertet. Für die Demo steht das vorbereitete Beispiel bereit; eigene Angaben kannst du im Gespräch oder direkt in der Wissensliste ergänzen."
import.step3.useExample: "Beispiel verwenden"
import.step3.intro: "Simulierte Auswertung des Beispiels. Wähle, was dein Scout sich merken soll."
import.cand.i1: "Fünf Bandmitglieder"
import.cand.i2: "Besetzung: zwei Gitarren, Bass, Schlagzeug, Gesang"
import.cand.i3: "Proben meist abends nach 19 Uhr"
import.cand.i4: "Anreise mit dem Auto, Parkplatz hilfreich"
import.cand.i5: "Budget bis 300 € (unsicher)"
import.conflict.band: "Widerspricht „{text}“ im aktuellen Suchauftrag. Der Suchauftrag wird nicht überschrieben."
import.conflict.budget: "Als unsicher gekennzeichnet und abweichend vom Suchauftrag ({text})."
import.conflict.budgetPlain: "Als unsicher gekennzeichnet."
import.pickCount: "{n} ausgewählt"
import.back: "Zurück"
import.apply: "Ausgewählte Angaben übernehmen"
```

### 17.8 Profil

```
profile.title: "Dein Profil"
profile.subtitle: "Wie soll dein Scout euch ansprechen?"
profile.nameLabel: "Anzeigename"
profile.save: "Speichern"
profile.saved: "Name gespeichert. Ansprache und Initialen sind aktualisiert."
profile.login.title: "Demo-Login"
profile.login.sub: "Lokale Beispielidentität „herzbuben“ · keine echte Anmeldung"
profile.login.badge: "Designprototyp"
profile.footnote: "Externe Portal-Accounts und deine Scout-Adresse werden bei einer Namensänderung nicht umbenannt."
profile.initialsFallback: "–"
```

### 17.9 Benachrichtigungen

```
notif.title: "Wann soll ich mich melden?"
notif.subtitle: "Wichtiges erreicht dich immer in der App."
notif.decision.label: "Wenn deine Entscheidung nötig ist"
notif.decision.sub: "Rückfragen, Freigaben und Angebote, die du prüfen sollst"
notif.offer.label: "Wenn ein Angebot eingeht"
notif.offer.sub: "Konkrete Angebote mit Konditionen"
notif.digest.label: "Allgemeine Fortschritte als Zusammenfassung"
notif.digest.sub: "Gelegentlicher Überblick über Suche und Anfragen"
notif.channel.label: "Kanal"
notif.channel.aria: "Kanal"
notif.channel.app: "In der App"
notif.channel.mail: "Scout-Adresse (simuliert)"
notif.footnote: "Präferenzen werden lokal gespeichert. Es wird keine Browser-Berechtigung angefragt und keine echte E-Mail versendet. Notwendige Entscheidungen bleiben in der App sichtbar, auch wenn Benachrichtigungen aus sind."
notif.toast.saved: "Gespeichert"
```

### 17.10 Tarif & Nutzung

```
billing.title: "Tarif & Nutzung"
billing.subtitle: "Dein Zugang, deine Aktivität und deine Abrechnung."
billing.access.label: "Dein Zugang"
billing.access.plan: "Demo-Zugang"
billing.access.sub: "Kein kostenpflichtiges Abonnement aktiv."
billing.access.cta: "Tarife ansehen"
billing.tariff.title: "Tarife sind noch nicht festgelegt."
billing.tariff.body: "In diesem Prototyp kannst du RoomScout ausprobieren. Es wird nichts berechnet."
billing.usage.label: "Aktivität im September"
billing.usage.searchesOne: "Aktive Suche"
billing.usage.searchesMany: "Aktive Suchen"
billing.usage.contacted: "Anbieter kontaktiert"
billing.usage.talk: "Gespräche mit Scout"
billing.usage.talkNone: "Noch nicht erfasst"
billing.usage.footnote: "Aktivitätsübersicht, keine Abrechnungseinheiten."
billing.payment.title: "Zahlungsdaten"
billing.payment.sub: "Keine Zahlungsmethode hinterlegt"
billing.payment.cta: "Verwalten"
billing.address.title: "Rechnungsadresse"
billing.address.sub: "Noch nicht hinterlegt"
billing.address.cta: "Hinzufügen"
billing.pay.title: "Zahlungsverwaltung ist noch nicht eingerichtet."
billing.pay.body: "Hier würdest du später deine Zahlungs- und Rechnungsdaten verwalten."
billing.invoices.label: "Rechnungen"
billing.invoices.emptyTitle: "Noch keine Rechnungen"
billing.invoices.emptySub: "Hier findest du später deine Belege."
billing.footnote: "Produktkonzept · Noch keine Zahlungsintegration"
```

### 17.11 Datenschutz

```
privacy.title: "Deine Daten, deine Kontrolle"
privacy.subtitle: "Was RoomScout in dieser Demo lokal speichert."
privacy.stored.title: "Gespeicherte Angaben"
privacy.stored.sub: "{n} Angaben über eure Band und Suche"
privacy.stored.cta: "Gespeicherte Angaben ansehen"
privacy.transcript.title: "Gesprächsverlauf"
privacy.transcript.sub: "Mitschrift eurer Gespräche mit dem Scout, in der App einsehbar"
privacy.portals.title: "Portalzugänge"
privacy.portals.sub: "{n} verbundener Portalzugang, simuliert"
privacy.portals.cta: "Portalzugänge verwalten"
privacy.export.title: "Export"
privacy.export.sub: "Exportiert ausschließlich die lokalen Demo-Daten dieses Prototyps als JSON."
privacy.export.cta: "Demo-Daten exportieren"
privacy.delete.title: "Konto löschen"
privacy.delete.body: "Im späteren Produkt würde hier die endgültige Löschung aller Kontodaten angestoßen. In dieser Demo gibt es dafür noch keine Funktion; der Demo-Neustart ersetzt sie nicht."
privacy.vendors.title: "Beteiligte Dienstleister"
privacy.vendors.body: "Für Text und Auswertung, Quellenbeobachtung, Scout-Postfächer, Portal-Zugänge sowie Sprache: Convex, Firecrawl, AgentMail, Browserbase und OpenAI. Welche Daten dabei verarbeitet werden, hängt von der konkreten Funktion ab und wäre im Produkt einzeln erklärt."
privacy.toast.exported: "Lokale Demo-Daten exportiert."
privacy.toast.exportFailed: "Export war nicht möglich."
privacy.export.filename: "roomscout-demo-daten.json"
privacy.export.note: "Lokale Demo-Daten des Designprototyps"
```

### 17.12 Global toasts / misc

```
common.copyFailedToast: "Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst."
common.saved: "Gespeichert"
common.cancel: "Abbrechen"
common.back: "Zurück"
common.close: "Schließen"
common.details: "Details"
common.demoName: "Herzbuben"
```
