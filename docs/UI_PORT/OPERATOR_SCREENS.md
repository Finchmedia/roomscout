# Operator surface — port specification

Source of truth: `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype/Operator.dc.html`
(296 lines; template `<x-dc>` lines 9–212, script `<script type="text/x-dc">` lines 213–294).
Host wiring read from `Roomscout.dc.html` (lines 33–62, 64–71, 72–76, 78, 606–643, 737, 748, 777–801,
1065–1071, 1115) and `Settings.dc.html` (lines 448, 540–545, 593–600) for the cross-surface incident
flow.

> All line references in this document are 1-based and point at the **opening** tag / statement, and
> a range includes the closing tag. They were re-verified against the prototype files; if a reference
> and the source disagree, the source wins.

This document is complete enough to rebuild the surface without opening the prototype. Every inline
style string is transcribed verbatim from the prototype. All German copy is quoted verbatim including
typography („ “, ·, →, &, —).

**Target implementation:** shadcn block **`sidebar-13`** — a `Sidebar` mounted inside a `Dialog`, with a
breadcrumb header and a close button in the header. See §16 for the full mapping.

---

## 0. Contents

1. Framing and host embedding
2. Design tokens and shared style vocabulary
3. Global shell (header, card, sidebar, content, footer)
4. Sidebar navigation
5. Page — Betrieb im Blick (`page = "overview"`)
6. Page — Quellen (`page = "sources"`)
7. Page — Aufträge (`page = "tasks"`)
8. Page — Integrationen (`page = "integrations"`)
9. Page — Feature-Flags (`page = "flags"`)
10. Page — Diagnose (`page = "diag"`)
11. Diagnose sheet (overlay dialog)
12. Incident flow end-to-end (operator ↔ scout ↔ settings)
13. Feature flags and their effects
14. Sample data (illustrative)
15. Complete state model and state-dependent variants
16. shadcn `sidebar-13` mapping plan
17. Copy dictionary (DE)

---

## 1. Framing and host embedding

### 1.1 How the surface is mounted

In the prototype the Operator is **not** a dialog — it is a full-bleed view that replaces the whole
product UI. The host swaps views with four sibling `sc-if` blocks inside one fixed-position root
(`Roomscout.dc.html:27`):

| Host lines | Guard | What it wraps |
| --- | --- | --- |
| 33–62 | `<sc-if value="{{ notOperator }}">` | **only** the app `<header>` (34–61: wordmark, scout badge, pause button, profile menu) |
| 64–71 | `<sc-if value="{{ isSettingsView }}">` | the Settings `dc-import` + the caption `Designprototyp · Beispieldaten` |
| 72–76 | `<sc-if value="{{ isOperatorView }}">` | the Operator `dc-import` |
| 78–… | `<sc-if value="{{ isScoutView }}">` | the Scout `<main>` |

So when `view === 'operator'` the app header is unmounted (`notOperator` is false) and the Scout
`<main>` is unmounted (`isScoutView` is false); the Operator supplies its own header (§3.2) and its own
caption line (§3.6). **There is no `<footer>` element anywhere in `Roomscout.dc.html`** (grep count 0) —
each view renders its caption as a plain `div`. Lines 72–76:

```
<sc-if value="{{ isOperatorView }}" hint-placeholder-val="{{ false }}">
  <div style="position:relative;z-index:2;flex:1;min-height:0;display:flex;flex-direction:column;animation:rsFadeUp .35s ease both">
    <dc-import name="Operator" data="{{ opData }}" actions="{{ opActions }}" page="{{ opPage }}" hint-size="100%,100%" style="height:100%;display:block"></dc-import>
  </div>
</sc-if>
```

The three background layers of the host (`assets/bg.jpg` with
`filter:saturate(.62) brightness(.5);transform:scaleX(-1)`, a dark gradient overlay
`linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)`, and a grain
overlay `assets/grain.svg` at `opacity:.28;mix-blend-mode:overlay`) sit **outside** the `notOperator`
condition, so they remain visible behind the Operator. The Operator root is transparent; its own card
is `rgba(13,10,8,.82)`. Entry animation is the host's `rsFadeUp .35s ease both`.

**Port decision:** in the RoomScout port the Operator becomes a `Dialog` (per `sidebar-13`). Keep the
translucent card look by giving `DialogContent` the same background/border/radius/shadow, and keep the
app content visible (blurred/dimmed) behind the overlay so the "internal view over the product"
feeling survives.

### 1.2 Props (`data-props` on the script tag, line 213)

| Prop | Editor | Default | TS type | Purpose |
| --- | --- | --- | --- | --- |
| `$preview` | — | `{width:1440,height:900}` | — | Canvas preview size. **The Operator has no `mobile` prop — this surface is desktop-only in the prototype.** |
| `data` | none | `null` | `object` | The operational data object (`opData` from the host). |
| `actions` | none | `null` | `object` | The action bag (`opActions` from the host). |
| `page` | `enum` | `"overview"` | `string` | Options: `overview`, `sources`, `tasks`, `integrations`, `flags`, `diag`. |

### 1.3 `data` shape (host `opData`, `Roomscout.dc.html:1065`)

```js
const opData = {
  sources: s.sources,                 // [{ id, name, region, enabled, access, kind, lastAccess }]
  flags: s.flags,                     // { voice: boolean, publicSearch: boolean }
  incident: s.incident,               // boolean
  incidentResolved: s.incidentResolved,
  contacted: s.activity.some(a => a === ACT.contacted),
  stage,                              // ignored by the Operator — see note
};
```

**`stage` is dead data for this surface.** The host passes the current demo chapter id, but
`renderVals()` (Operator lines 239–291) never dereferences `d.stage`; the token `stage` occurs exactly
once in the whole Operator file, as `stage: 'waiting'` inside the standalone `DEMO` fallback
(line 219). The port can drop the field entirely, or keep it only as a debug breadcrumb.

### 1.4 `actions` shape (host `opActions`, `Roomscout.dc.html:1066–1071`)

```js
const opActions = {
  back: () => this.backToScout(),
  setPage: p => this.setState({ opPage: p }),
  setFlags: f => this.setState({ flags: f }),
  loadIncident: () => this.loadIncident(),   // declared but never called from Operator
  renewLogin: () => this.setAccess('roomscout', 'connected'),
};
```

### 1.5 Standalone fallback (`renderVals`, lines 239–240)

```js
const standalone = !this.props.actions;
const d = this.props.data || DEMO;
const NOOP = new Proxy({}, { get: () => () => ({}) });
const A = standalone
  ? Object.assign({}, NOOP, { setPage: p => this.setState({ localPage: p }), back: () => {}, setFlags: () => {}, renewLogin: () => {} })
  : this.props.actions;
const page = standalone ? (s.localPage || this.props.page || 'overview') : (this.props.page || 'overview');
```

Consequences for a builder previewing the file alone: navigation works via local state, `Zur App`,
`Lokal speichern` and `Anmeldung als erneuert simulieren` are **no-ops**, and the fallback `DEMO`
object already has `incident: true`, so the standalone default view shows the incident state.

### 1.6 Global CSS injected by the surface (`<helmet>`, lines 10–17)

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
button:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
@keyframes opFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
</style>
```

`opFade` is used at `.2s`, `.25s` (ease, both) on: attention banner, task detail rows, integration
detail panels, the flags dirty panel, the flags-saved status, the diag scrim and the diag panel.

---

## 2. Design tokens and shared style vocabulary

### 2.1 Colors (all literal in the prototype — no CSS variables)

| Token (proposed) | Value | Used for |
| --- | --- | --- |
| `--op-fg` | `#f5ece2` | Primary text, button text |
| `--op-fg-muted` | `#cbb9a8` | Secondary text, subtitles, values in key/value rows |
| `--op-fg-soft` | `#e2d3c3` | Status text next to dots, list items in the dirty panel, icon color |
| `--op-fg-dim` | `#a89684` | Section eyebrows, table headers, key labels, notes, footer |
| `--op-accent` | `#ff6926` | Primary button background, focus ring |
| `--op-accent-hover` | `#ff7a3d` | Primary button hover |
| `--op-accent-text` | `#ff8a4e` | INTERN badge text, active nav icon, link hover, "Simulation" eyebrow |
| `--op-green` (`GREEN`) | `#4fbf7a` | OK dots |
| `--op-amber` (`AMBER`) | `#e0a13a` | Attention dots, attention banner |
| `--op-grey` (`GREY`) | `rgba(255,255,255,.3)` | Neutral/inactive dots |
| `--op-card` | `rgba(13,10,8,.82)` | Main card background |
| `--op-panel` | `rgba(18,14,11,.98)` | Diagnose sheet background |
| `--op-scrim` | `rgba(6,4,3,.55)` | Diagnose scrim |
| `--op-surface` | `rgba(255,255,255,.03)` | 5 uses: calm banner (58), overview tile (62), flags dirty panel (162), no-incident card (174), dashed Simulation box (199) |
| `--op-surface-2` | `rgba(255,255,255,.04)` | Env pill (22), avatar (23), outline/table-action buttons (78, 118, 179), inactive filter chip (`fAllBg`/`fAttBg`). **Not** the `Abbrechen` button — that one is `background:none` (165) |
| `--op-hover` | `rgba(255,255,255,.06)` | Back-button hover (29), nav-item hover (32), sheet close-button **background** (187) |
| `--op-hover-row` | `rgba(255,255,255,.04)` | Integrationen row-header hover (132) — same literal as `--op-surface-2`, but used as a hover here |
| `--op-hover-tile` | `rgba(255,255,255,.07)` | Overview tile hover (62) |
| `--op-hover-outline` | `rgba(255,255,255,.1)` | Hover of the **outline/table-action** buttons: `Diagnose` (78, 118) and `Diagnose-Sheet öffnen` (179) — all three sit on `background:rgba(255,255,255,.04)` |
| `--op-hover-ghost` | `rgba(255,255,255,.08)` | Hover of the **secondary** button `Abbrechen` (165), which has `background:none` |
| `--op-hover-close` | `rgba(255,255,255,.12)` | Sheet close-button hover (187) |
| `--op-avatar-border` | `rgba(255,220,190,.22)` | Operator avatar border (23) |
| `--op-nav-active-bg` | `rgba(120,58,22,.45)` | Active nav item |
| `--op-nav-active-border` | `rgba(255,140,90,.35)` | Active nav item border |
| `--op-chip-active` | `rgba(255,105,38,.3)` | Active filter chip |
| `--op-border-strong` | `rgba(255,220,190,.28)` | Secondary button borders |
| `--op-border` | `rgba(255,220,190,.2)` | Filter chip border |
| `--op-border-soft` | `rgba(255,220,190,.18)` | Env pill border |
| `--op-rule` | `rgba(255,220,190,.1)` | Table header rule, section dividers, sheet key/value rules |
| `--op-rule-faint` | `rgba(255,220,190,.08)` | Row separators, nav divider is `.1` |
| `--op-rule-hair` | `rgba(255,220,190,.06)` | Event rows inside the sheet |
| `--op-card-border` | `rgba(255,190,140,.16)` | Main card border |
| `--op-tile-border` | `rgba(255,200,160,.14)` | Tiles, dirty panel |
| `--op-tile-border-2` | `rgba(255,200,160,.12)` | Calm banner, no-incident card |
| `--op-sheet-border` | `rgba(255,200,160,.16)` | Sheet left border |
| `--op-dashed` | `rgba(255,200,160,.35)` | Simulation box dashed border |
| `--op-underline` | `rgba(255,220,190,.4)` | `text-decoration-color` on text links (4 uses: 55, 79, 92, 119) |
| `--op-badge-border` | `rgba(255,140,90,.6)` | `INTERN` badge border (20) |
| `--op-switch-off` | `rgba(255,255,255,.14)` | Feature-flag switch track when off (`SW(false)`, line 221) |
| `--op-switch-knob-shadow` | `0 1px 3px rgba(0,0,0,.3)` | Feature-flag switch knob (156) |
| `--op-card-shadow` | `0 30px 90px rgba(0,0,0,.35)` | Main card (27) |
| `--op-amber-tint` | `rgba(224,161,58,.1)` bg / `rgba(224,161,58,.45)` border / `rgba(224,161,58,.06)` row tint | Attention banner and expired task row |

### 2.2 Typography

- Family: `'Geist',system-ui,sans-serif` on the root; every button uses `font:inherit`.
- Weights loaded: 300, 400, 500, 600.
- Complete scale used on this surface (every size, with the line it comes from):

| Size | Extras | Used by |
| --- | --- | --- |
| `44px` | `line-height:1.1;font-weight:500;letter-spacing:-.02em` | all six page `h1`s (50, 97, 107, 127, 150, 172) |
| `26px` | `font-weight:500` | sheet title `h2#op-diag-title` (187) |
| `20px` | `font-weight:500;letter-spacing:.04em` | wordmark (20) |
| `19px` | `color:#cbb9a8` | all six page subtitles (51, 98, 108, 128, 151, 173) |
| `17px` | — | attention-banner left group (54), flag label (155) |
| `16.5px` | `font-weight:500` | tile name (66) |
| `16px` | — | `Zur App` (29), nav item (32), `Ansehen` (55), OpenAI static row (71), task rows (75, 115), Betriebsregeln rows (85, 86), flag mirror rows (90), Quellen rows (101), Integrationen row header (132), no-incident card (174), sheet body incl. key/value rows (188) |
| `15.5px` | — | Diagnose-page event row (177) |
| `15px` | — | attention exclamation badge (54, `font-weight:700`), sidebar note `Nur für Betreiber` (45), calm banner (58), `Diagnose` button (78, 118), `Details` link (79, 119), Aufträge empty state (123), dirty-panel `<li>`s (164), `Abbrechen` + `Lokal speichern` (165, the latter `font-weight:600`), `Diagnose-Sheet öffnen` (179), `Anmeldung als erneuert simulieren` (202, `font-weight:600`) |
| `14.5px` | — | env pill (22), tile status row (67), OpenAI status group (71), task detail row (81), flag-mirror state group (90), `Flags bearbeiten` (92), **Quellen footnote (103)**, filter chips (110, 111), task detail row (121), Integrationen expanded panel (138), flag effect text (155), flags scope note (160), flags-saved status (168), sheet `Ereignisfolge` rows (195), Simulation body (201), resolved status (205) |
| `14px` | — | all table header rows (73, 99, 113), tile role (66) |
| `13.5px` | — | flag-mirror sub-label (90) |
| `13px` | — | avatar (23, `font-weight:500`), **Betriebsregeln note (87)**, sheet block eyebrows `Ursache`/`Auswirkung`/`Nächster Schritt`/`Ereignisfolge` (192–195, `letter-spacing:.12em;text-transform:uppercase`), footer caption (209) |
| `12.5px` | `letter-spacing:.14em;text-transform:uppercase` | section eyebrows `Integrationen` (59), `Aufgaben` (72), `Betriebsregeln` (84), `Feature-Flags` (88), `Wirkung vor dem Speichern` (163) — **and** the sheet's `Simulation` eyebrow (200), which is the same size but adds `font-weight:500;color:#ff8a4e` instead of `#a89684` |
| `12px` | `letter-spacing:.14em;text-transform:uppercase` | sidebar section label `Betrieb` (30) |
| `12px` | `letter-spacing:.12em;font-weight:600` | `INTERN` badge (20) |

### 2.3 Status-dot atom (10 instances: 8× at 9×9, 2× at 8×8)

`<span style="width:9px;height:9px;border-radius:50%;background:{color}"></span>` — exhaustive list:

| Size | Line | Where | Color source |
| --- | --- | --- | --- |
| 8×8 | 22 | header env pill `Entwicklung` | literal `#4fbf7a` |
| 8×8 | 58 | calm banner (`noAttention`) | literal `#4fbf7a` |
| 9×9 | 67 | overview integration tile status row | `{{ t.dot }}` |
| 9×9 | 71 | **OpenAI static row** on the overview | literal `#4fbf7a` |
| 9×9 | 77 | overview task table, Status cell | `{{ t.dot }}` |
| 9×9 | 90 | **overview read-only Feature-Flags mirror** | `{{ f.dot }}` |
| 9×9 | 101 | Quellen table, Anbindung cell | `{{ s.dot }}` |
| 9×9 | 117 | Aufträge task table, Status cell | `{{ t.dot }}` |
| 9×9 | 134 | Integrationen row header, Status cell | `{{ i.dot }}` |
| 9×9 | 191 | Diagnose sheet, `Zustand` row | `{{ diagDot }}` |

Colors: `#4fbf7a` (`GREEN`) ok, `#e0a13a` (`AMBER`) attention, `rgba(255,255,255,.3)` (`GREY`) neutral.
**shadcn candidate:** custom `<StatusDot tone="ok|warn|idle" />` (a `Badge` is too heavy — the
prototype never boxes the status).

### 2.4 Shared button recipes

| Recipe | Style string | shadcn candidate |
| --- | --- | --- |
| Primary | `height:44px;padding:0 20px;border-radius:12px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer` + hover `background:#ff7a3d` | `Button` (default variant, `size="lg"`) |
| Primary full-width (sheet) | same but `width:100%;height:46px` | `Button className="w-full"` |
| Secondary (`Abbrechen`, 165) | `height:44px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font:inherit;font-size:15px;cursor:pointer` + hover `background:rgba(255,255,255,.08)` | `Button variant="outline"` |
| Outline / table action (`Diagnose` 78+118, `Diagnose-Sheet öffnen` 179) | `height:40px;padding:0 18px;border-radius:10px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer` + hover `background:rgba(255,255,255,.1)` — the sheet trigger (179) is the same recipe at `height:44px;padding:0 20px;border-radius:12px;margin-top:20px` | `Button variant="outline" size="sm"` |
| Text link | `border:0;background:none;color:#f5ece2;font:inherit;cursor:pointer;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.4)` + hover `color:#ff8a4e` | `Button variant="link"` |
| Filter chip | `height:38px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,220,190,.2);background:{active?rgba(255,105,38,.3):rgba(255,255,255,.04)};color:#f5ece2;font:inherit;font-size:14.5px;cursor:pointer` — **no `style-hover` at all** (lines 110–111): neither the active nor the inactive chip gives hover feedback. See §7.1 for the port decision. | `ToggleGroup` + `ToggleGroupItem` (or `Tabs` with pill styling) |
| Focus ring (global) | `outline:2px solid #ff6926;outline-offset:2px` on `:focus-visible` | Tailwind `focus-visible:ring-2 ring-[#ff6926] ring-offset-2` |

---

## 3. Global shell

### 3.1 Root (line 18)

- Role: surface root, holds the ref used for focus restoration.
- `ref="{{ rootRef }}"`
- Style: `height:100%;display:flex;flex-direction:column;font-family:'Geist',system-ui,sans-serif;color:#f5ece2`
- **shadcn candidate:** `DialogContent` wrapper (in the port), otherwise plain `div`.

### 3.2 Header bar (`<header>`, lines 19–25)

- Role: internal-environment chrome. **Not part of `sidebar-13`** — see §16 for where it goes.
- Container style: `height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 36px;flex:none`
- **shadcn candidate:** custom header row; children map to `Badge`, `Badge`, `Avatar`.

**Left cluster** — `display:flex;align-items:center;gap:14px`

| Element | Copy | Style |
| --- | --- | --- |
| Wordmark | `roomscout` | `font-size:20px;font-weight:500;letter-spacing:.04em` |
| Internal badge | `INTERN` | `padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,90,.6);color:#ff8a4e;font-size:12px;letter-spacing:.12em;font-weight:600` — **shadcn candidate:** `Badge variant="outline"` |

**Right cluster** — `display:flex;align-items:center;gap:14px`

| Element | Copy | Style |
| --- | --- | --- |
| Environment pill | `Entwicklung` (preceded by an 8×8 green dot) | `height:42px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,220,190,.18);background:rgba(255,255,255,.04);display:flex;align-items:center;gap:10px;font-size:14.5px`; dot `width:8px;height:8px;border-radius:50%;background:#4fbf7a` — **shadcn candidate:** `Badge variant="secondary"` with a `StatusDot` |
| Operator avatar | `OP`, `aria-label="Operator"` | `width:42px;height:42px;border-radius:50%;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:500` — **shadcn candidate:** `Avatar` + `AvatarFallback` |

The environment pill and avatar are **static** in the prototype — no binding, no handler, no hover.

### 3.3 Body wrapper (line 26)

`flex:1;min-height:0;padding:4px 36px 0;display:flex;flex-direction:column`

### 3.4 The card (line 27)

```
flex:1;min-height:0;max-width:1380px;width:100%;margin:0 auto;position:relative;display:grid;
grid-template-columns:296px minmax(0,1fr);border-radius:28px;background:rgba(13,10,8,.82);
border:1px solid rgba(255,190,140,.16);overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.35)
```

`position:relative` matters: the Diagnose sheet and its scrim are absolutely positioned **inside this
card**, not over the viewport. `overflow:hidden` clips the sheet to the 28px radius.

**shadcn candidate:** `DialogContent` with `SidebarProvider` inside; sidebar width token `296px`
(`--sidebar-width: 18.5rem`).

### 3.5 Content column (`<section>`, line 47)

Verbatim opening tag:

```html
<section ref="{{ contentRef }}" style="min-height:0;overflow:auto;padding:42px 46px 40px;scrollbar-width:thin">
```

It is a `<section>` (not a `div`), it is the second grid child of the card (the `<nav>` closes on
line 46), and **the six page bodies are direct children of this one element** — each page is a bare
`<sc-if>` block (49–94, 96–104, 106–124, 126–147, 149–169, 171–181) with no per-page wrapper element.
That matters for the port: the WAAPI fade and the scroll reset below are applied to `contentRef`
itself, i.e. to the scroll container that holds *all* pages, not to a per-page node.

Page-change behavior (`componentDidUpdate`, line 233):

```js
if (pp.page !== this.props.page && this.contentRef.current) {
  this.contentRef.current.scrollTop = 0;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
    this.contentRef.current.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 200, easing: 'ease-out' });
}
```

Note the guard reads `this.props.page`, so in **standalone** mode (where page lives in local state) the
scroll-reset/animation does not fire. In the port, run it on every page change.

**shadcn candidate:** `SidebarInset` + `ScrollArea`.

### 3.6 Footer line (line 209)

- Copy: `Interner Status · Darstellung mit Beispieldaten`
- Style: `text-align:center;font-size:13px;color:#a89684;padding:14px 0 12px`
- Sits **outside** the card, inside the body wrapper.
- **shadcn candidate:** plain `<p className="text-muted-foreground">`.

---

## 4. Sidebar navigation

### 4.1 Container (line 28)

`<nav aria-label="Betrieb" style="padding:36px 26px 30px;border-right:1px solid rgba(255,220,190,.08);display:flex;flex-direction:column;min-height:0;overflow:auto;scrollbar-width:none">`

**shadcn candidate:** `Sidebar` + `SidebarContent`.

### 4.2 Back button (line 29)

- Copy: `Zur App`
- Icon: arrow-left, `viewBox 0 0 24 24`, `20×20`, `fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round`, path `M19 12H5M11 6l-6 6 6 6` (lucide `ArrowLeft`).
- Style: `display:flex;align-items:center;gap:12px;border:0;background:none;color:#f5ece2;font:inherit;font-size:16px;cursor:pointer;padding:8px 10px;border-radius:10px;text-align:left`
- Hover: `background:rgba(255,255,255,.06)`
- Handler: `back` → `A.back()` → host `backToScout()` (returns to `view:'scout'`, clears `sessionHeld`, `toast`, `settingsDirty`, and resumes a paused conversation if one was held).
- **shadcn candidate:** `SidebarMenuButton` — but in `sidebar-13` this action doubles as the dialog close button in the header (`DialogClose`). Keep both.

### 4.3 Section label (line 30)

- Copy: `Betrieb`
- Style: `margin:34px 10px 10px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
- **shadcn candidate:** `SidebarGroupLabel`.

### 4.4 Nav items (`sc-for list="{{ nav }}" as="it"`, lines 31–42)

Built from `PAGES` (line 214) in key order:

```js
const PAGES = { overview: 'Übersicht', sources: 'Quellen', tasks: 'Aufträge',
                integrations: 'Integrationen', flags: 'Feature-Flags', diag: 'Diagnose' };
```

Per-item bindings (`const nav = …`, line 243):

```js
{ id, label: PAGES[id], current: id === page, go: () => A.setPage(id),
  bg:     current ? 'rgba(120,58,22,.45)' : 'transparent',
  border: current ? 'rgba(255,140,90,.35)' : 'transparent',
  icon:   current ? '#ff8a4e' : '#e2d3c3',
  isOverview|isSources|isTasks|isIntegrations|isFlags|isDiag }
```

Button style:

```
display:flex;align-items:center;gap:14px;height:50px;padding:0 14px;border-radius:12px;
border:1px solid {{ it.border }};background:{{ it.bg }};color:#f5ece2;font:inherit;font-size:16px;
cursor:pointer;text-align:left;margin-bottom:4px;transition:background .15s
```
Hover `background:rgba(255,255,255,.06)`. `aria-current="{{ it.current }}"` (boolean).
Icon slot: `width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:{{ it.icon }}`.

**Hover on the active item — resolved.** In the prototype the `style-hover` on line 32 is
unconditional and is written *after* the inline `background:{{ it.bg }}`, so hovering the **active**
item replaces its `rgba(120,58,22,.45)` with `rgba(255,255,255,.06)` — the active item visibly loses
its highlight under the cursor. Only the border (`rgba(255,140,90,.35)`) and the icon color
(`#ff8a4e`) survive the hover. shadcn's `SidebarMenuButton isActive` does the opposite (it keeps the
active background on hover). **Port decision: follow shadcn, not the prototype** — this is an
artifact of inline-style ordering in the prototype runtime, not a design intent, and losing the active
highlight on hover is a regression. Keep `hover:bg-[rgba(255,255,255,.06)]` for inactive items only.

**Note:** the sidebar label for the first page is **`Übersicht`**, while the page's own `h1` reads
**`Betrieb im Blick`**. Both strings must exist in the dictionary.

| Item | Label | Icon (all `viewBox 0 0 24 24`, 20×20) | lucide equivalent |
| --- | --- | --- | --- |
| `overview` | `Übersicht` | `fill="currentColor"`; `<rect x=4 y=13 w=4 h=7 rx=1>`, `<rect x=10 y=8 w=4 h=12 rx=1>`, `<rect x=16 y=4 w=4 h=16 rx=1>` | `BarChart3` |
| `sources` | `Quellen` | `fill:none;stroke-width:1.6`; `<ellipse cx=12 cy=6 rx=8 ry=3>`, path `M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3` | `Database` |
| `tasks` | `Aufträge` | `fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round`; `<rect x=5 y=4 w=14 h=17 rx=2>`, `M9 4h6v3H9z`, `M8.5 13l2 2 4-4` | `ClipboardCheck` |
| `integrations` | `Integrationen` | `fill:none;stroke-width:1.6;stroke-linecap:round`; `M9 3v4M15 3v4`, `M6 7h12v4a6 6 0 0 1-12 0z`, `M12 17v4` | `Plug` |
| `flags` | `Feature-Flags` | `fill:none;stroke-width:1.6;stroke-linejoin:round`; `M5 21V4h11l-1.5 3.5L16 11H5` | `Flag` |
| `diag` | `Diagnose` | `fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round`; `M3 12h4l3-7 4 14 3-7h4` | `Activity` |

**shadcn candidate:** `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton isActive={current}`.

### 4.5 Footer of the sidebar (lines 43–45)

- Spacer (line 43): `<div style="flex:1"></div>`
- Divider: `height:1px;background:rgba(255,220,190,.1);margin:24px 0 20px` — **shadcn candidate:** `Separator`.
- Note: `Nur für Betreiber` — `padding:0 10px;font-size:15px;color:#cbb9a8` — **shadcn candidate:** `SidebarFooter`.

---

## 5. Page — Betrieb im Blick (`pOverview`)

Visible when `pOverview` (`page === 'overview'`). Lines 49–94.

### 5.1 Title block

| Element | Copy | Style | shadcn candidate |
| --- | --- | --- | --- |
| `h1` | `Betrieb im Blick` | `margin:0;font-size:44px;line-height:1.1;font-weight:500;letter-spacing:-.02em` | plain `h1` |
| `p` | `Provider, Quellen und wartende Aufgaben.` | `margin:10px 0 0;font-size:19px;color:#cbb9a8` | plain `p` |

### 5.2 Attention banner — conditional `attention` (= `open`, i.e. `incident && !incidentResolved`)

- Container: `margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-radius:14px;background:rgba(224,161,58,.1);border:1px solid rgba(224,161,58,.45);animation:opFade .25s ease both`
- Left group: `display:flex;align-items:center;gap:14px;font-size:17px`
  - Exclamation badge: copy `!`, style `width:24px;height:24px;border-radius:50%;background:#e0a13a;color:#1a1208;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px`
  - Text: `1 Aufgabe braucht Aufmerksamkeit` (hard-coded count — not derived from the task list)
- Right button: copy `Ansehen` + chevron-right `16×16` (`stroke-width:2;stroke-linecap:round`, path `M9 6l6 6-6 6`)
  - Style: `border:0;background:none;color:#f5ece2;font:inherit;font-size:16px;cursor:pointer;display:flex;align-items:center;gap:6px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.4)`; hover `color:#ff8a4e`
  - Handler `viewAttention`: `this.setState({ filter: 'attention' }); A.setPage('tasks');`
- **shadcn candidate:** `Alert` (destructive/warning tone) with `AlertTitle` + a `Button variant="link"` action.

### 5.3 Calm banner — conditional `noAttention` (= `!open`)

- Style: `margin-top:24px;display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);font-size:15px;color:#cbb9a8`
- Dot: `width:8px;height:8px;border-radius:50%;background:#4fbf7a`
- Copy: `Keine Aufgabe braucht Aufmerksamkeit. Beispielstörung über die Demo-Steuerung laden.`
- **shadcn candidate:** `Alert` (default tone).

### 5.4 Section eyebrow "Integrationen"

- Copy: `Integrationen`
- Style: `margin-top:26px;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
- **shadcn candidate:** plain `<h2>` styled as an eyebrow.

### 5.5 Integration tiles (`sc-for list="{{ tiles }}" as="t"`, 4 items)

`tiles = integrations.slice(0, 4).map(t => Object.assign({}, t, { open: t.openTile }))` — **watch out:**
on a tile, `t.open` is the **click handler**, not the expanded flag (naming collision with the
Integrationen page where `i.open` is a boolean).

- Grid: `margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px`
- Tile button: `text-align:left;padding:18px 20px;border-radius:16px;border:1px solid rgba(255,200,160,.14);background:rgba(255,255,255,.03);color:#f5ece2;font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:14px;transition:background .15s`; hover `background:rgba(255,255,255,.07)`
- Handler `openTile`: `A.setPage('integrations'); this.setState({ openInt: id });` — navigates to the Integrationen page **and** expands that provider's row.
- Head row: `display:flex;align-items:center;gap:12px`
  - Logo slot: `width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#e2d3c3;flex:none`
    - `t.logo` truthy → `<img src="{{ t.logo }}" alt="" style="width:28px;height:28px;object-fit:contain;border-radius:6px">`
    - `t.noLogo` → fallback SVG `24×24`, `fill:none;stroke:currentColor;stroke-width:1.6`, `<rect x=3 y=4 w=18 h=16 rx=2.5>` + `M3 9h18` (a browser-window glyph; never rendered with the shipped data because all five ids have logos)
  - Name: `{{ t.name }}` — `font-size:16.5px;font-weight:500`
  - Role: `{{ t.role }}` — `font-size:14px;color:#cbb9a8;margin-top:1px`
- Status row: `display:flex;align-items:center;gap:9px;font-size:14.5px;color:#e2d3c3` + 9×9 dot `{{ t.dot }}` + `{{ t.status }}`
- **shadcn candidate:** `Card` rendered as a button (`asChild`) — `CardHeader` + `CardContent`; the four tiles in a responsive grid.

Tile contents (see §14 for the full integration table): `Convex AI Gateway`, `Firecrawl`, `AgentMail`,
`Browserbase`.

### 5.6 OpenAI static row (line 71)

Not a tile — a plain rule-bounded row directly under the grid.

- Style: `margin-top:14px;padding-bottom:18px;border-bottom:1px solid rgba(255,220,190,.1);display:flex;align-items:center;gap:14px;font-size:16px`
- `<img src="assets/logo-openai.svg" alt="" style="width:22px;height:22px;object-fit:contain">`
- Copy sequence: `OpenAI direkt` · separator `·` (`color:#a89684`) · `Voice & Embeddings` (`color:#cbb9a8`) · status group (`display:flex;align-items:center;gap:8px;margin-left:8px;font-size:14.5px;color:#e2d3c3`) with a 9×9 `#4fbf7a` dot and `Bereit`.
- **Static** — no binding, no handler. (OpenAI is `integrations[4]`, deliberately excluded from
  `slice(0,4)` so that only four tiles are rendered. It is *not* excluded from the Integrationen page:
  there it reappears as a normal, expandable accordion row — see §8.)
- **shadcn candidate:** custom row; `Separator` for the rule.

### 5.7 Section eyebrow "Aufgaben"

- Copy: `Aufgaben`
- Style: `margin-top:24px;font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`

### 5.8 Task table

Header row: `margin-top:10px;display:grid;grid-template-columns:1.3fr 1fr 1.2fr 1fr;gap:12px;padding:10px 14px;font-size:14px;color:#a89684;border-bottom:1px solid rgba(255,220,190,.1)`
Columns: `Vorgang` · `Quelle` · `Status` · `Nächster Schritt`.

Data row (`sc-for list="{{ tasks }}" as="t"`):
`display:grid;grid-template-columns:1.3fr 1fr 1.2fr 1fr;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid rgba(255,220,190,.08);font-size:16px;background:{{ t.bg }};border-radius:10px`

| Cell | Content | Style |
| --- | --- | --- |
| Vorgang | `{{ t.name }}` | inherits `16px` |
| Quelle | `{{ t.src }}` — always `roomscout.dev` | `color:#cbb9a8` |
| Status | 9×9 dot `{{ t.dot }}` + `{{ t.status }}` | `display:flex;align-items:center;gap:9px` |
| Nächster Schritt | `t.diag` → `Diagnose` button; `t.notDiag` → `Details` link | see below |

- `Diagnose` button (only when `status === 'expired'`): `data-diag-trigger="1"`, handler `openDiag`
  (`this.setState({ diag: true })`), style `height:40px;padding:0 18px;border-radius:10px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer`, hover `background:rgba(255,255,255,.1)`.
  **shadcn candidate:** `Button variant="outline" size="sm"` acting as `DialogTrigger`/`SheetTrigger`.
- `Details` link: chevron-right `14×14` (`stroke-width:2;stroke-linecap:round`, `M9 6l6 6-6 6`);
  style `border:0;background:none;color:#f5ece2;font:inherit;font-size:15px;cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 0;text-decoration:{{ t.underline }};text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.4)`, hover `color:#ff8a4e`.
  Handler `t.details`: `this.setState(st => ({ openTask: st.openTask === id ? null : id }))` (accordion of one).
  `t.underline` = `'underline'` while open, `'none'` while closed.
  **shadcn candidate:** `Collapsible` + `CollapsibleTrigger` (`Button variant="link"`).
- Expanded detail row (`t.open`): `padding:10px 14px 14px;font-size:14.5px;color:#cbb9a8;line-height:1.6;border-bottom:1px solid rgba(255,220,190,.08);animation:opFade .2s ease both` containing `{{ t.detailText }}`.
  **shadcn candidate:** `CollapsibleContent`.

Row tint `t.bg`: `rgba(224,161,58,.06)` when `status === 'expired'`, otherwise `transparent`.

**shadcn candidate for the whole block:** `Table` (`TableHeader`/`TableRow`/`TableHead`/`TableBody`/`TableCell`)
— but the prototype uses CSS grid with `border-radius:10px` per row; if fidelity matters, keep a
grid-based custom table and use `Table` only for semantics.
`openTask` is shared between this table and the Aufträge page (same ids, same state key) and is
**never reset** — not on page change, not when the incident state flips. See §15.1 and §14.3 for the
consequences (an expanded row survives navigation between the two tables and can end up expanded on a
row whose action cell has meanwhile become a `Diagnose` button).

### 5.9 Bottom two-column block (lines 83–93)

Container: `margin-top:26px;padding-top:22px;border-top:1px solid rgba(255,220,190,.1);display:grid;grid-template-columns:1fr 1fr;gap:0 40px`

**Left column — Betriebsregeln** (all values hard-coded, no bindings)

| Element | Copy | Style |
| --- | --- | --- |
| Eyebrow | `Betriebsregeln` | `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684` |
| Row 1 | `Parallele Browser-Sessions` / `2` | `margin-top:10px;display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid rgba(255,220,190,.08);font-size:16px`; value `color:#cbb9a8` |
| Row 2 | `Erneute Versuche` / `Mit zunehmendem Abstand` | `display:flex;justify-content:space-between;gap:16px;padding:10px 0;font-size:16px` (no bottom rule); value `color:#cbb9a8` |
| Note | `Illustrative Betriebsregeln, keine echten Worker-Pools.` | `margin-top:6px;font-size:13px;color:#a89684` |

**shadcn candidate:** `Card` with a small `Table`-less definition list; `Separator` between rows.

**Right column — Feature-Flags (read-only mirror)**

Container: `border-left:1px solid rgba(255,220,190,.1);padding-left:30px`

- Eyebrow `Feature-Flags` (same eyebrow style).
- `sc-for list="{{ flagRowsRO }}" as="f"` — built from the **saved** `flags`, never from `flagDraft`:
  ```js
  flagRowsRO: ['voice','publicSearch'].map(k => ({
    label: flagLabel[k],
    sub: k === 'publicSearch' ? 'Demo auf roomscout.dev begrenzt' : null,
    state: flags[k] ? 'An' : 'Aus',
    dot: flags[k] ? GREEN : GREY }))
  ```
  Row style: `display:flex;justify-content:space-between;align-items:center;gap:16px;padding:10px 0;border-bottom:1px solid rgba(255,220,190,.08);font-size:16px`
  Sub-label (`f.sub`, conditional): `font-size:13.5px;color:#a89684;margin-top:2px`
  State group: `display:flex;align-items:center;gap:8px;font-size:14.5px;color:#e2d3c3` + 9×9 dot.
- Link button `Flags bearbeiten`: `margin-top:10px;border:0;background:none;color:#f5ece2;font:inherit;font-size:14.5px;cursor:pointer;padding:4px 0;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.4)`, hover `color:#ff8a4e`; handler `goFlags` → `A.setPage('flags')`.
- **shadcn candidate:** `Card` + rows; state as `StatusDot` + text (deliberately **not** a `Switch`
  here — this mirror is read-only).

---

## 6. Page — Quellen (`pSources`)

Lines 96–104.

| Element | Copy | Style |
| --- | --- | --- |
| `h1` | `Quellen` | `margin:0;font-size:44px;line-height:1.1;font-weight:500;letter-spacing:-.02em` |
| `p` | `Technische Anbindung der Demo-Quellen, unabhängig von Nutzerpräferenzen.` | `margin:10px 0 0;font-size:19px;color:#cbb9a8` |

**Table header:** `margin-top:26px;display:grid;grid-template-columns:1.3fr 1fr 1.3fr 1fr;gap:12px;padding:10px 14px;font-size:14px;color:#a89684;border-bottom:1px solid rgba(255,220,190,.1)`
Columns: `Quelle` · `Region` · `Anbindung` · `Letzter Demo-Check`.

**Row** (`sc-for list="{{ opSources }}" as="s"`): `display:grid;grid-template-columns:1.3fr 1fr 1.3fr 1fr;gap:12px;align-items:center;padding:14px;border-bottom:1px solid rgba(255,220,190,.08);font-size:16px`

| Cell | Binding | Style |
| --- | --- | --- |
| Quelle | optional `<img src="{{ s.logo }}" alt="" style="width:24px;height:24px;object-fit:contain;border-radius:5px">` + `{{ s.name }}` | `display:flex;align-items:center;gap:12px` |
| Region | `{{ s.region }}` | `color:#cbb9a8` |
| Anbindung | 9×9 dot `{{ s.dot }}` + `{{ s.tech }}` | `display:flex;align-items:center;gap:9px` |
| Letzter Demo-Check | `{{ s.check }}` | `color:#cbb9a8` |

Derivation (`opSources`, line 282):

```js
opSources: (d.sources || []).map(x => ({
  logo: x.id === 'roomscout' ? 'assets/logo-roomscout.png' : null,
  name: x.name, region: x.region,
  tech: x.kind === 'portal'
    ? (x.access === 'connected' ? 'Angebunden · Demo-Zugang' : 'Angebunden · Zugang braucht Anmeldung')
    : (flags.publicSearch ? 'Öffentliche Anzeigen · Demo-Daten' : 'Nicht aktiv (Flag aus)'),
  dot: x.kind === 'portal'
    ? (x.access === 'connected' ? GREEN : AMBER)
    : (flags.publicSearch ? GREEN : GREY),
  check: x.kind === 'portal' ? (x.lastAccess || 'Heute · Demo-Lauf') : '—',
}))
```

**Key semantics:** the per-user `enabled` flag is deliberately **not** reflected here — the operator
sees technical connectivity only.

**`Letzter Demo-Check` has two shapes, and one of them is a host-generated German literal.**
`x.lastAccess` starts as `null`, so the cell falls back to the static string `Heute · Demo-Lauf`. As
soon as a login is renewed (from the Operator's Simulation button *or* from Settings), the host writes
`now()` into it (`Roomscout.dc.html:737`):

```js
now() { const d = new Date(); return 'Heute, ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
```

i.e. `Heute, 9:41` — hour **unpadded**, minute zero-padded to two digits, comma + space separator, and
the word `Heute` hard-coded in German. For the DE/EN port this needs its own dictionary key plus a
formatting rule, not a literal: see `sources.check.renewed` in §17.5 and `host.now.format` in §17.12.

**Footnote:** `margin-top:16px;font-size:14.5px;color:#a89684;line-height:1.6`
Copy: `Der Demo-Lauf ist auf roomscout.dev begrenzt. Persönliche Quellenpräferenzen der Nutzer (z. B. „Bandnet für meine Suche ausschließen“) verändern diesen Status nicht.`

**shadcn candidate:** `Table` for the grid, `Avatar`/`img` for the logo cell, `StatusDot` for
Anbindung, plain `<p className="text-muted-foreground">` for the footnote.

---

## 7. Page — Aufträge (`pTasks`)

Lines 106–124.

| Element | Copy | Style |
| --- | --- | --- |
| `h1` | `Aufträge` | same 44px title recipe |
| `p` | `Vorgänge des laufenden Demo-Auftrags.` | `margin:10px 0 0;font-size:19px;color:#cbb9a8` |

### 7.1 Filter chips

- Container: `margin-top:22px;display:flex;gap:6px`
- Chip style: `height:38px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,220,190,.2);background:{{ fAllBg | fAttBg }};color:#f5ece2;font:inherit;font-size:14.5px;cursor:pointer`
- `aria-pressed="{{ fAll }}"` / `aria-pressed="{{ fAtt }}"`
- Active background `rgba(255,105,38,.3)`, inactive `rgba(255,255,255,.04)`
- Chip 1: copy `Alle`, handler `filterAll` → `this.setState({ filter: 'all' })`
- Chip 2: copy `Braucht Aufmerksamkeit`, handler `filterAttention` → `this.setState({ filter: 'attention' })`
- **No hover state.** Neither chip carries a `style-hover` attribute (lines 110–111), so in the
  prototype the chips give no pointer feedback at all — the only visual change is the active/inactive
  background driven by state. **Port decision: add a hover** (`ToggleGroupItem` supplies one), because
  the absence here is an omission in a hand-written inline-style prototype, not a considered choice —
  every other interactive control on this surface has a `style-hover`. Keep the *active* background at
  `rgba(255,105,38,.3)` on hover so the pressed state stays legible.
- **shadcn candidate:** `ToggleGroup type="single"` with two `ToggleGroupItem`s (pill variant).

`filter` is component state that **persists across page switches** and is preselected to `attention`
when the user arrived via the overview's `Ansehen` button.

### 7.2 Table

- Header row: `margin-top:16px;` then identical to §5.8 (`1.3fr 1fr 1.2fr 1fr`, same columns
  `Vorgang` · `Quelle` · `Status` · `Nächster Schritt`).
- Rows: **byte-identical markup to the overview task rows** (same styles, same `Diagnose`/`Details`
  behavior, same expanded detail row with `opFade .2s`). List binding is `tasksFiltered`.
- `tasksFiltered = filter === 'attention' ? tasks.filter(t => t.attention) : tasks`
  (`t.attention === (status === 'expired')`).

### 7.3 Empty state — conditional `tasksEmpty` (`tasksFiltered.length === 0`)

- Copy: `Keine Aufgabe braucht Aufmerksamkeit.`
- Style: `padding:18px 14px;font-size:15px;color:#a89684`
- Reachable only with `filter === 'attention'` and no expired task (i.e. no incident, or resolved).
- **shadcn candidate:** `TableCaption` or a plain empty-state `div`; `Skeleton` is not applicable.

---

## 8. Page — Integrationen (`pIntegrations`)

Lines 126–147.

| Element | Copy | Style |
| --- | --- | --- |
| `h1` | `Integrationen` | 44px title recipe |
| `p` | `Rolle und lokaler Demo-Status je Provider. Keine Schlüssel, keine Secrets.` | `margin:10px 0 0;font-size:19px;color:#cbb9a8` |

List container (line 129): `margin-top:26px;display:flex;flex-direction:column`

**List binding — all five providers, including OpenAI** (line 130):

```html
<sc-for list="{{ integrations }}" as="i" hint-placeholder-count="5">
```

The list is the full `integrations` array (lines 255–261), so this page renders **five** rows in this
order: `Convex AI Gateway`, `Firecrawl`, `AgentMail`, `Browserbase`, `OpenAI direkt`. The `slice(0, 4)`
that drops OpenAI applies **only** to the overview tiles (`tiles`, line 262) — on the overview OpenAI
gets the static, non-interactive row described in §5.6, but here it is an ordinary expandable row with
the same header cells and the same `Konfiguration:` / `Letzter Demo-Test:` / note panel as the other
four. Do not render four rows here.

Row container (line 131): `border-bottom:1px solid rgba(255,220,190,.1)`

### 8.1 Row header button

```
width:100%;display:grid;grid-template-columns:1.2fr 1.3fr 1fr auto;gap:14px;align-items:center;
padding:16px 10px;border:0;background:none;color:#f5ece2;font:inherit;font-size:16px;
text-align:left;cursor:pointer;border-radius:10px
```
Hover `background:rgba(255,255,255,.04)`. `aria-expanded="{{ i.open }}"`.
Handler `i.toggle`: `this.setState(st => ({ openInt: st.openInt === id ? null : id }))` (accordion of one).

| Cell | Content | Style |
| --- | --- | --- |
| Name | logo slot `width:26px;height:26px;display:flex;align-items:center;justify-content:center;flex:none;color:#e2d3c3` (img `24×24`, `object-fit:contain;border-radius:5px`; fallback SVG `22×22` rect+line) + `{{ i.name }}` | `display:flex;align-items:center;gap:12px;font-weight:500` |
| Rolle | `{{ i.role }}` | `color:#cbb9a8` |
| Status | 9×9 dot `{{ i.dot }}` + `{{ i.status }}` | `display:flex;align-items:center;gap:9px` |
| Chevron | `16×16`, `fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round`, path `M6 9l6 6 6-6` | `transform:{{ i.chev }};transition:transform .2s` — `rotate(180deg)` when open, else `none` |

### 8.2 Expanded panel — conditional `i.open`

```
padding:4px 10px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
gap:10px 24px;font-size:14.5px;line-height:1.6;animation:opFade .2s ease both
```
- Cell 1: label `Konfiguration:` (`color:#a89684`) + space + `{{ i.config }}`
- Cell 2: label `Letzter Demo-Test:` (`color:#a89684`) + space + `{{ i.test }}`
- Cell 3: `{{ i.note }}` — `grid-column:1/-1;color:#cbb9a8`

**shadcn candidate:** `Accordion type="single" collapsible` with `AccordionItem`/`AccordionTrigger`
(4-column grid inside the trigger) / `AccordionContent`. `openInt` is also written by the overview
tiles (`openTile`), so the accordion's open item must be controlled state, not internal.

`openInt` is **never reset** — not on page change, not on incident changes (it is only ever set by
`i.toggle` or `openTile`, and cleared only by toggling the same row again). So an expanded provider
stays expanded when you leave the Integrationen page and come back, and arriving here through a tile
always lands with exactly that provider expanded. See §15.1.

Data: see §14.2.

---

## 9. Page — Feature-Flags (`pFlags`)

Lines 149–169.

| Element | Copy | Style |
| --- | --- | --- |
| `h1` | `Feature-Flags` | 44px title recipe |
| `p` | `Lokale Demo-Änderungen, keine Deployments.` | `margin:10px 0 0;font-size:19px;color:#cbb9a8` |

### 9.1 Flag rows (`sc-for list="{{ flagRows }}" as="f"`)

- Container: `margin-top:26px;display:flex;flex-direction:column`
- Row: `display:flex;justify-content:space-between;align-items:center;gap:20px;padding:18px 0;border-bottom:1px solid rgba(255,220,190,.1)`
- Label: `{{ f.label }}` — `font-size:17px`
- Effect text: `{{ f.effect }}` — `margin-top:3px;font-size:14.5px;color:#cbb9a8`
- Switch: `role="switch" aria-checked="{{ f.on }}" aria-label="{{ f.label }}"`
  ```
  width:56px;height:32px;border-radius:16px;border:0;padding:0;background:{{ f.bg }};
  position:relative;cursor:pointer;transition:background .2s;flex:none
  ```
  Knob: `position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;transform:{{ f.knob }};transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)`
  From `SW(on)` (line 221): `bg = on ? '#ff6926' : 'rgba(255,255,255,.14)'`, `knob = on ? 'translateX(24px)' : 'none'`.
  Handler `f.toggle`:
  ```js
  () => this.setState(st => ({
    flagDraft: Object.assign({}, st.flagDraft || flags, { [k]: !F[k] }),
    flagsSaved: false }))
  ```
  where `F = s.flagDraft || flags` (rows always render the **draft** value once one exists).
- **shadcn candidate:** `Switch` (with `data-[state=checked]:bg-[#ff6926]`), wrapped in a `Label`;
  rows separated by `Separator`.

### 9.2 Scope note

- Copy: `Demo auf roomscout.dev begrenzt. Es startet kein echter Crawl.`
- Style: `margin-top:14px;font-size:14.5px;color:#a89684`

### 9.3 Dirty panel — conditional `flagsDirty`

`flagsDirty = !!s.flagDraft && flagEffects.length > 0` — i.e. a draft exists **and** at least one flag
differs from the saved value. Toggling a flag twice back to its saved value hides the panel while
`flagDraft` stays non-null (harmless, but note it: `Abbrechen` disappears with the panel).

- Container: `margin-top:22px;padding:18px 22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.14);animation:opFade .2s ease both`
- Eyebrow: `Wirkung vor dem Speichern` — `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
- List `ul`: `margin:10px 0 0;padding-left:18px;font-size:15px;line-height:1.7;color:#e2d3c3`; items from `flagEffects` (see §13.2)
- Action row: `margin-top:16px;display:flex;justify-content:flex-end;gap:10px`
  - `Abbrechen` — secondary recipe (`height:44px;padding:0 18px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font:inherit;font-size:15px;cursor:pointer`, hover `rgba(255,255,255,.08)`); handler `cancelFlags` → `this.setState({ flagDraft: null })`
  - `Lokal speichern` — primary recipe (`height:44px;padding:0 20px;border-radius:12px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer`, hover `#ff7a3d`); handler `saveFlags`:
    ```js
    A.setFlags(Object.assign({}, F));
    this.setState({ flagDraft: null, flagsSaved: true });
    this.timers.push(setTimeout(() => this.setState({ flagsSaved: false }), 2600));
    ```
- **shadcn candidate:** `Card` + `CardContent` with a `ul`; `Button variant="outline"` + `Button`.
  (An `AlertDialog` is wrong here — this is an inline preview-before-save, not a modal confirm.)

### 9.4 Saved status — conditional `flagsSaved`

- `role="status"`, style `margin-top:16px;font-size:14.5px;color:#cbb9a8;animation:opFade .2s ease both`
- Copy: `Flags lokal gespeichert.`
- Auto-clears after **2600 ms** (timer registered in `this.timers`, cleared on unmount).
- **shadcn candidate:** `Sonner` toast would be the idiomatic port, but the prototype renders it
  inline; keep it inline (an `Alert` with `role="status"`) to preserve the layout, or use `Sonner`
  with a 2600 ms duration if a toaster already exists in the shell.

---

## 10. Page — Diagnose (`pDiag`)

Lines 171–181.

| Element | Copy | Style |
| --- | --- | --- |
| `h1` | `Diagnose` | 44px title recipe |
| `p` | `Verständliche Ereignisse aus den lokalen Demo-Daten.` | `margin:10px 0 0;font-size:19px;color:#cbb9a8` |

### 10.1 No-incident card — conditional `noIncident` (`!incident`)

- Style: `margin-top:26px;padding:22px 24px;border-radius:16px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);font-size:16px;color:#e2d3c3`
- Copy: `Keine offenen Störungen. Über die Demo-Steuerung lässt sich eine Beispielstörung laden.`
- **shadcn candidate:** `Card` / `Alert`.

### 10.2 Event timeline — conditional `hasIncident` (`incident`)

- Container: `margin-top:26px;display:flex;flex-direction:column;gap:0`
- Row (`sc-for list="{{ events }}" as="e"`): `display:grid;grid-template-columns:110px 1fr;gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,220,190,.08);font-size:15.5px`
  - Time cell `{{ e.when }}` — `color:#a89684`
  - Text cell `{{ e.text }}`
- **shadcn candidate:** `Table` with two columns, or a custom definition-list timeline; `Separator`
  per row.

### 10.3 Sheet trigger — conditional `incidentOpen` (`incident && !incidentResolved`)

- Copy: `Diagnose-Sheet öffnen`
- `data-diag-trigger="1"`, handler `openDiag`
- Style: `margin-top:20px;height:44px;padding:0 20px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer`, hover `background:rgba(255,255,255,.1)`
- **shadcn candidate:** `Button variant="outline"` as `SheetTrigger`.

After the incident is resolved the timeline stays (with the extra `Jetzt` event) but the trigger
disappears (`incidentOpen` is false).

**In the resolved state the sheet has zero entry points anywhere on the surface.** There are only two
triggers in the whole file: this button (179, gated on `incidentOpen`) and the per-row `Diagnose`
button (78 and 118, gated on `t.diag`, which is `status === 'expired'` — a status that only exists
while the incident is open). So once `incidentResolved` is true, nothing can open the sheet again; its
resolved content (`Zustand: Verbunden (erneuert)`, the `Zugang erneuert. …` status line, the final
`Jetzt` event) is only ever visible to someone who already had the sheet open when the resolution
happened. Combined with §11.7 (`closeDiag` focuses the first `[data-diag-trigger]`, of which there is
now none), closing the sheet in that moment both loses focus and ends the state permanently.
**Port decision:** keep a permanent entry point on the Diagnose page — render the trigger whenever
`hasIncident` is true and let the sheet show the resolved state, rather than gating it on
`incidentOpen`.

---

## 11. Diagnose sheet (overlay dialog)

Lines 184–207, rendered as a **sibling of the sidebar+content grid inside the card**, so it is clipped
by the card's `border-radius:28px` and covers only the card, not the viewport.

Visible when `diagOpen` (`state.diag === true`).

### 11.1 Scrim

- `position:absolute;inset:0;z-index:20;background:rgba(6,4,3,.55);animation:opFade .2s ease both`
- `onClick` → `closeDiag`
- **shadcn candidate:** `SheetOverlay`.

### 11.2 Panel

```
role="dialog" aria-modal="true" aria-labelledby="op-diag-title"
position:absolute;z-index:21;top:0;right:0;bottom:0;width:min(500px,100%);
background:rgba(18,14,11,.98);border-left:1px solid rgba(255,200,160,.16);padding:34px;
overflow:auto;animation:opFade .25s ease both;display:flex;flex-direction:column
```
**shadcn candidate:** `Sheet` + `SheetContent side="right"` — but note it must be *scoped to the
dialog*, not the viewport. If the port renders the Operator inside a `Dialog`, nest the sheet as an
absolutely-positioned panel inside `DialogContent` rather than a portal-ed `Sheet`.

### 11.3 Sheet header

- Row: `display:flex;justify-content:space-between;align-items:center`
- `h2#op-diag-title`: copy `Diagnose`, style `margin:0;font-size:26px;font-weight:500` — **shadcn candidate:** `SheetTitle`
- Close button: `ref="{{ diagCloseRef }}"`, `aria-label="Schließen"`, style `width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#f5ece2;cursor:pointer;display:flex;align-items:center;justify-content:center`, hover `background:rgba(255,255,255,.12)`; icon `18×18`, `stroke-width:2;stroke-linecap:round`, paths `M6 6l12 12M18 6L6 18` (lucide `X`) — **shadcn candidate:** `SheetClose` wrapping `Button variant="ghost" size="icon"`

### 11.4 Sheet body

Container: `margin-top:24px;display:flex;flex-direction:column;gap:14px;font-size:16px;line-height:1.5`

**Key/value rows** — each `display:flex;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,220,190,.1)`, key `color:#a89684`:

| Key | Value | Notes |
| --- | --- | --- |
| `Vorgang` | `Portal-Nachrichten lesen` | hard-coded in the template |
| `Portal` | `roomscout.dev · Profil Herzbuben` | hard-coded, includes the band name |
| `Zustand` | 9×9 dot `{{ diagDot }}` + `{{ diagState }}` | `diagState = open ? 'Anmeldung abgelaufen' : 'Verbunden (erneuert)'`; `diagDot = open ? AMBER : GREEN` |

**Labelled blocks** — label `font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#a89684`, body `margin-top:4px`:

| Label | Body (hard-coded) |
| --- | --- |
| `Ursache` | `Die gespeicherte Anmeldung ist abgelaufen.` |
| `Auswirkung` | `Private Portalnachrichten können momentan nicht gelesen werden. Die Suche nach Anzeigen läuft weiter.` |
| `Nächster Schritt` | `Portalzugang erneut verbinden. Die Band sieht dazu einen Hinweis in ihren Zugängen.` |
| `Ereignisfolge` | list, `margin-top:6px;display:flex;flex-direction:column` |

`Ereignisfolge` rows (`sc-for list="{{ events }}"`, the same `events` array as the Diagnose page):
`display:grid;grid-template-columns:100px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,220,190,.06);font-size:14.5px`; time cell `color:#a89684`.

**shadcn candidate:** the key/value rows → a small `Table` or a `dl`; the labelled blocks → plain
sections with an eyebrow `<h3>`; the event list → the same custom timeline as §10.2.

Spacer: `<div style="flex:1"></div>` pushes the simulation box to the bottom.

### 11.5 Simulation box — conditional `incidentOpen`

- Container: `margin-top:24px;padding:16px 18px;border-radius:14px;border:1px dashed rgba(255,200,160,.35);background:rgba(255,255,255,.03)`
- Eyebrow: `Simulation` — `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#ff8a4e;font-weight:500`
- Body: `margin-top:6px;font-size:14.5px;color:#cbb9a8;line-height:1.55`
  Copy: `Setzt den Beispielzugang lokal auf „Verbunden“ und gibt die wartende Demo-Aufgabe einmalig frei. Bereits abgeschlossene Anfragen werden nicht erneut ausgelöst.`
- Button: `Anmeldung als erneuert simulieren` — `margin-top:14px;width:100%;height:46px;border-radius:12px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer`, hover `background:#ff7a3d`
  Handler `renew`: `() => { if (!open) return; A.renewLogin(); }` — guarded, idempotent, and it does
  **not** touch local state; the resolution comes back down through `data.incidentResolved`.
- **shadcn candidate:** `Card` with `border-dashed` + `Button` (full width). This is a demo affordance —
  in the production port it should sit behind a dev-only flag or be replaced with a real
  "reconnect portal" action.

### 11.6 Resolved status — conditional `incidentResolved`

- `role="status"`, style `margin-top:20px;font-size:14.5px;color:#cbb9a8`
- Copy: `Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt.`
- No animation on this one (unlike the flags-saved status).
- **shadcn candidate:** `Alert` with `role="status"`.

### 11.7 Sheet accessibility & focus behavior

- `componentDidMount` (line 231) attaches the key handler to **`document`**, not to `rootRef`:
  ```js
  componentDidMount() {
    this.onKey = e => { if (e.key === 'Escape' && this.state.diag) this.closeDiag(); };
    document.addEventListener('keydown', this.onKey);
  }
  ```
  So `Escape` closes the sheet from anywhere in the page, including from focus outside the Operator.
- `componentWillUnmount` (line 232) is the matching teardown — **both halves matter**:
  ```js
  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKey);
    this.timers.forEach(clearTimeout);
  }
  ```
  It removes the document-level listener and clears the pending `flagsSaved` timer (§9.4). A port that
  keeps the Operator mounted — e.g. inside a `Dialog` that stays in the React tree while closed — must
  reproduce both: detach the `keydown` listener (or gate it on the dialog being open, otherwise a
  hidden Operator swallows `Escape` from the surface underneath) and clear the 2600 ms timer so it
  cannot `setState` after teardown.
- `componentDidUpdate` (line 236): when the sheet transitions to open, `diagCloseRef.current.focus()`.
- `closeDiag()` (line 238): sets `diag: false`, then on the next tick focuses the **first**
  `[data-diag-trigger]` element inside `rootRef` — i.e. focus returns to whichever `Diagnose` /
  `Diagnose-Sheet öffnen` button is currently in the DOM. If none is present (incident just resolved,
  the expired row is gone — see §10.3), focus is silently lost — **fix this in the port** by falling
  back to the content container.
- No focus trap is implemented in the prototype. `Sheet`/`Dialog` from shadcn provide one for free.

---

## 12. Incident flow end-to-end

### 12.1 How an incident appears

1. The operator/presenter clicks **`Beispielstörung laden`** in the host's Demo-Steuerung strip
   (`Roomscout.dc.html:636`; the strip is the block at 606–643, a monospace dev bar at
   `left:16px;bottom:16px`, outside the product UI). **That strip sits outside the `notOperator`
   `sc-if` (33–62)**, so it stays mounted and clickable while the Operator is on screen — an incident
   can therefore be loaded *while* the Operator is already open, without the component remounting.
   See §14.3 for the state combination that produces.
2. Host `loadIncident()` (`Roomscout.dc.html:780`):
   ```js
   this.setState(st => ({
     incident: true, incidentResolved: false,
     sources: st.sources.map(s => s.id === 'roomscout' ? { ...s, access: 'expired' } : s),
     view: 'operator', opPage: 'overview', menuOpen: false }));
   ```
   → it **switches the app into the Operator view on the overview page**.
3. In the Operator, `open = incident && !incidentResolved` becomes true, which cascades:
   - Overview: amber attention banner `1 Aufgabe braucht Aufmerksamkeit` replaces the calm banner.
   - Tasks (overview + Aufträge): `t2 Portal-Nachrichten lesen` → status `Anmeldung abgelaufen`
     (amber dot), row tinted `rgba(224,161,58,.06)`, action becomes the `Diagnose` button;
     `t3 Anfrage vorbereiten` → `Wartet auf Zugang` (grey dot) with detail text
     `Wartet, bis der Portalzugang erneut verbunden ist. Es wird keine Anfrage doppelt gesendet.`
   - Quellen: `roomscout.dev` row → `Angebunden · Zugang braucht Anmeldung`, amber dot.
   - Integrationen: `Browserbase` → status `Prüfen` (amber), `Letzter Demo-Test:`
     `1 Portalzugang braucht eine neue Anmeldung`, note
     `Ein abgelaufener Portal-Login ist kein Ausfall von Browserbase insgesamt.`
     (The overview tile for Browserbase changes the same way.)
   - Diagnose: the no-incident card is replaced by the 5-row event timeline plus the
     `Diagnose-Sheet öffnen` button.

### 12.2 How it is resolved (from the Operator)

1. Open the sheet: `Diagnose` on the expired task row, or `Diagnose-Sheet öffnen` on the Diagnose page.
2. Press **`Anmeldung als erneuert simulieren`** → `A.renewLogin()` →
   host `setAccess('roomscout', 'connected')` (`Roomscout.dc.html:777`):
   ```js
   this.setState(st => ({
     sources: st.sources.map(s => s.id === id
       ? { ...s, access, lastAccess: access === 'connected' ? this.now() : s.lastAccess } : s),
     incidentResolved: st.incident && access === 'connected' ? true : st.incidentResolved,
   }), () => { if (this.state.waitingFor === 'access' && access === 'connected') this.attemptContact(); });
   ```
   `this.now()` produces `'Heute, ' + H + ':' + MM`.
3. What changes in the Operator (`resolved = incident && incidentResolved`, `open` becomes false):
   - Sheet: `Zustand` flips to `Verbunden (erneuert)` with a green dot; the dashed Simulation box
     disappears; the status line `Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt.`
     appears. The sheet stays open.
   - Events gain a final row: `Jetzt` / `Anmeldung erneuert (Simulation) · wartende Aufgabe einmalig fortgesetzt`.
   - Overview: calm banner returns.
   - Tasks: `t2` → `Abgeschlossen` (green) with detail
     `Antworten im Portal werden über den verbundenen Demo-Zugang gelesen.`;
     `t3` → `Fortgesetzt (einmalig)` (green) with detail
     `Nach der erneuerten Anmeldung einmalig fortgesetzt.`
     Both rows lose the amber tint and the `Diagnose` button, and get `Details` links instead.
   - Quellen: `roomscout.dev` → `Angebunden · Demo-Zugang` (green), `Letzter Demo-Check` shows the new
     `Heute, H:MM`.
   - Integrationen/tile: `Browserbase` → `Bereit` (green), `Erfolgreich (Demo)`, note
     `Hält die Portal-Sitzungen für Lesen und Senden von Nachrichten.`
   - Aufträge with `filter === 'attention'` → the empty state `Keine Aufgabe braucht Aufmerksamkeit.`

### 12.3 What changes in the Scout view

While `access !== 'connected'` during an autopilot stage, the host sets
`waitingAccess: s.waitingFor === 'access' || (AUTOPILOT.includes(stage) && roomSrc.access !== 'connected')`
(`Roomscout.dc.html:1115`), which renders under the scout status (the `sc-if` spans 223–228; the
`div` quoted below is 224–227):

```
<div style="margin-top:14px;display:flex;align-items:center;gap:10px;font-size:14px;color:#e2d3c3;flex-wrap:wrap;justify-content:center">
  <span style="width:8px;height:8px;border-radius:50%;background:#e0a13a"></span>Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.
  <button …>Zu den Zugängen</button>
</div>
```

- Scout banner copy: `Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.` + link
  `Zu den Zugängen` (line 226). **`Zu den Zugängen` is only the link's label** — the Settings page it
  opens is titled **`Quellen & Zugänge`** (`Settings.dc.html:448`,
  `const PAGES = { sources: 'Quellen & Zugänge', … }`). Wire the cross-surface navigation to the
  `sources` page id and label it `Quellen & Zugänge` in the Settings sidebar/breadcrumb; there is no
  page called "Zugänge".
- Scout status line when the autopilot actually tries to contact
  (`attemptContact`, `Roomscout.dc.html:783`; the access branch is line 787):
  `Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.` with
  `waitingFor: 'access'`.
- On Settings → `Quellen & Zugänge` the source status reads `Anmeldung erneut nötig` with dot
  `#e0a13a`, and the action is `Anmeldung öffnen` (`Settings.dc.html:540, 545, 593`).
- **The band can resolve it too:** `Demo-Anmeldung abschließen` in Settings calls the same
  `A.setAccess('roomscout','connected')` and shows `Zugang gespeichert. Dein Scout kann weitermachen.`
  This clears the Operator incident as well — the Operator is a *view* of shared state, not an owner
  of it.
- Because `setAccess` runs `attemptContact()` in its callback when `waitingFor === 'access'`, the
  autopilot resumes exactly once — this is what "einmalig fortgesetzt" refers to. It cannot double-send
  (`attemptContact` returns early when `activity` already contains `ACT.contacted`).

### 12.4 Event log (rendered on the Diagnose page and inside the sheet)

Only present when `incident` is true. Order is fixed:

| `when` | `text` |
| --- | --- |
| `09:41` | `Portal-Benachrichtigung über neue Nachricht erhalten` |
| `09:41` | `Öffnen der Portal-Nachricht fehlgeschlagen: Anmeldung abgelaufen` |
| `09:42` | `Aufgabe „Portal-Nachrichten lesen“ als „Anmeldung abgelaufen“ markiert` |
| `09:42` | `Aufgabe „Anfrage vorbereiten“ wartet auf Zugang` |
| `09:42` | `Hinweis in den Zugängen der Band angezeigt` |
| `Jetzt` *(only when resolved)* | `Anmeldung erneuert (Simulation) · wartende Aufgabe einmalig fortgesetzt` |

Timestamps are **illustrative literals**, not computed.

---

## 13. Feature flags and their effects

### 13.1 Definitions

```js
const flagLabel = { voice: 'Voice Scout', publicSearch: 'Öffentliche Quellensuche' };
const flagEffect = {
  voice: 'Aus: keine neuen Demo-Voice-Sessions. Laufende Gespräche werden nicht abgeschnitten, Text bleibt nutzbar.',
  publicSearch: 'An: nur vorhandene fiktive Demo-Daten. Aus: öffentliche Quellen bleiben als Präferenz gespeichert, gelten aber als „In dieser Demo nicht aktiv“.',
};
```

Default values (both in `DEMO` and in the host state): `{ voice: true, publicSearch: false }`.

### 13.2 Pre-save effect lines (`flagEffects`)

Computed only for flags whose draft value differs from the saved value:

`flagLabel[k] + ' → ' + (F[k] ? 'an' : 'aus') + '. ' + <specific sentence>`

| Flag | Direction | Resulting line |
| --- | --- | --- |
| `voice` | on | `Voice Scout → an. Neue Demo-Voice-Sessions sind wieder möglich.` |
| `voice` | off | `Voice Scout → aus. Keine neuen Demo-Voice-Sessions; Suchwissen und laufende Gespräche bleiben erhalten.` |
| `publicSearch` | on | `Öffentliche Quellensuche → an. Öffentliche Demo-Quellen werden für Nutzer aktiv. Kein Zugriff auf echte Portale.` |
| `publicSearch` | off | `Öffentliche Quellensuche → aus. Öffentliche Quellen werden in den Nutzereinstellungen als nicht aktiv gekennzeichnet.` |

(The arrow is U+2192 `→`, surrounded by regular spaces.)

### 13.3 Real effects of `publicSearch` inside the Operator

On the **Quellen** page, every non-portal source is recomputed:

| `publicSearch` | `tech` | `dot` |
| --- | --- | --- |
| `true` | `Öffentliche Anzeigen · Demo-Daten` | `#4fbf7a` |
| `false` | `Nicht aktiv (Flag aus)` | `rgba(255,255,255,.3)` |

On the **overview** read-only mirror, both flags render as `An`/`Aus` with green/grey dots.

Effects outside the Operator (host, for completeness): `usableSources()` filters to
`s.enabled && (s.kind === 'portal' || flags.publicSearch)`, which gates whether the autopilot has a
usable source at all. `voice` gates the voice UI in the Scout surface.

### 13.4 Save semantics

- Changes are held in `flagDraft` (local, unsaved) and only pushed up on `Lokal speichern`
  via `A.setFlags({...F})`.
- `flagDraft` **persists across page navigation** (component state is not reset), so leaving the
  Feature-Flags page and returning keeps unsaved edits — but the overview mirror keeps showing the
  saved values in the meantime. Consider surfacing an unsaved-changes indicator in the port.
- No confirmation dialog, no server call; the note `Lokale Demo-Änderungen, keine Deployments.`
  is the whole promise.

---

## 14. Sample data (all illustrative)

> Everything below is prototype demo data. It must be treated as **illustrative** and replaced by
> real Convex-backed data in the port. The prototype states this in its own copy
> (`Interner Status · Darstellung mit Beispieldaten`, `Illustrative Betriebsregeln, keine echten
> Worker-Pools.`, `Demo auf roomscout.dev begrenzt. Es startet kein echter Crawl.`).

### 14.1 Sources (`DEMO.sources`, lines 215–218; identical to the host's `SOURCES0`)

| id | name | region | enabled | access | kind | lastAccess |
| --- | --- | --- | --- | --- | --- | --- |
| `roomscout` | `roomscout.dev` | `Stuttgart` | `true` | `expired` (in `DEMO`) / `connected` in the host's clean start | `portal` | `null` |
| `musiker` | `Musiker in deiner Stadt` | `Stuttgart` | `true` | `public` | `public` | — |
| `bandnet` | `Bandnet Hamburg` | `Hamburg` | `false` | `public` | `public` | — |

Rendered rows (with `publicSearch: false`, incident open):

| Quelle | Region | Anbindung | Letzter Demo-Check |
| --- | --- | --- | --- |
| `roomscout.dev` (logo `assets/logo-roomscout.png`) | `Stuttgart` | ● amber `Angebunden · Zugang braucht Anmeldung` | `Heute · Demo-Lauf` |
| `Musiker in deiner Stadt` | `Stuttgart` | ● grey `Nicht aktiv (Flag aus)` | `—` |
| `Bandnet Hamburg` | `Hamburg` | ● grey `Nicht aktiv (Flag aus)` | `—` |

### 14.2 Integrations (factory `tile()` line 254, array lines 255–261; **all five** render on the Integrationen page, the first four also become overview tiles via `slice(0, 4)` on line 262)

| id | name | Rolle | Status (calm) | dot | Konfiguration | Letzter Demo-Test | Note | Logo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `convex` | `Convex AI Gateway` | `Text & Auswertung` | `Bereit` | green | `Konfiguriert` | `Erfolgreich (Demo)` | `Verarbeitet Gesprächstext und Faktenextraktion im Demo-Lauf.` | `assets/logo-convex.svg` |
| `firecrawl` | `Firecrawl` | `Quellen beobachten` | `Konfiguriert` | **grey** | `Konfiguriert` | `Noch kein Demo-Test` | `Eine konfigurierte Integration ist kein Nachweis für einen erfolgreichen Live-Test.` | `assets/logo-firecrawl.svg` |
| `agentmail` | `AgentMail` | `Scout-Postfächer` | `Bereit` | green | `Konfiguriert` | `Erfolgreich (Demo)` | `Stellt die Scout-Adressen bereit, über die Portal-Benachrichtigungen ankommen.` | `assets/logo-agentmail.png` |
| `browserbase` | `Browserbase` | `Portal-Zugänge` | `Bereit` / **`Prüfen`** when incident open | green / amber | `Konfiguriert` | `Erfolgreich (Demo)` / `1 Portalzugang braucht eine neue Anmeldung` | `Hält die Portal-Sitzungen für Lesen und Senden von Nachrichten.` / `Ein abgelaufener Portal-Login ist kein Ausfall von Browserbase insgesamt.` | `assets/logo-browserbase.png` |
| `openai` | `OpenAI direkt` | `Voice & Embeddings` | `Bereit` | green | `Konfiguriert` | `Erfolgreich (Demo)` | `Sprachein- und -ausgabe sowie Embeddings für die Einordnung von Anzeigen.` | `assets/logo-openai.svg` |

`Browserbase` is the only integration with an incident-dependent variant. `Firecrawl` is deliberately
grey/`Konfiguriert` (not green/`Bereit`) — the note explains why; keep that distinction in the port.

The `iconKey` argument (`'iText' | 'iWatch' | 'iMail' | 'iWindow'`) sets an unused boolean on the
object; the template renders the logo image instead. Ignore it.

### 14.3 Tasks (`const tasks = [ … ]`, lines 248–252; factory `mk()` lines 244–247)

| id | Vorgang | Quelle | Status (calm / incident open / resolved) | Detail text |
| --- | --- | --- | --- | --- |
| `t1` | `Neue Anzeigen prüfen` | `roomscout.dev` | `Abgeschlossen` in all states | `Öffentliche Anzeigen auf roomscout.dev wurden im Demo-Lauf geprüft. Ein passender Raum in Stuttgart-West wurde markiert.` |
| `t2` | `Portal-Nachrichten lesen` | `roomscout.dev` | `Abgeschlossen` (when `incident || contacted`) / `Anmeldung abgelaufen` / `Abgeschlossen`; `Geplant` when neither | `Antworten im Portal werden über den verbundenen Demo-Zugang gelesen.` (empty string while the incident is open) |
| `t3` | `Anfrage vorbereiten` | `roomscout.dev` | `Abgeschlossen`/`Geplant` / `Wartet auf Zugang` / `Fortgesetzt (einmalig)` | open: `Wartet, bis der Portalzugang erneut verbunden ist. Es wird keine Anfrage doppelt gesendet.` · resolved: `Nach der erneuerten Anmeldung einmalig fortgesetzt.` · otherwise: `Anfrage an den Anbieter im Rahmen des Handlungsspielraums der Band.` |

Status → label/color map (inside `mk`, line 245):

| key | label | dot |
| --- | --- | --- |
| `done` | `Abgeschlossen` | `#4fbf7a` |
| `expired` | `Anmeldung abgelaufen` | `#e0a13a` |
| `blocked` | `Wartet auf Zugang` | `rgba(255,255,255,.3)` |
| `planned` | `Geplant` | `rgba(255,255,255,.3)` |
| `resumed` | `Fortgesetzt (einmalig)` | `#4fbf7a` |

**Edge case to fix in the port — the empty detail stripe IS reachable.**

The two `sc-if`s on a task row are independent:

- the **action cell** picks between the `Diagnose` button (`t.diag`, line 78/118) and the `Details`
  link (`t.notDiag`, line 79/119), driven by `diag: status === 'expired'` (line 246);
- the **expanded detail row** below it (line 81/121) is gated only by `t.open`, i.e.
  `open: s.openTask === id` (line 246). It knows nothing about `t.diag`.

Because `openTask` is never reset (§15.1), an expanded row survives a status change. Reachable
sequence, entirely inside the prototype:

1. With no incident (calm state, `t2` = `Abgeschlossen`), click `Details` on `Portal-Nachrichten lesen`
   → `openTask = 't2'`, the row expands with its normal text.
2. Click **`Beispielstörung laden`** in the host's Demo-Steuerung. That strip lives at
   `Roomscout.dc.html:606–643`, **outside** the `notOperator` `sc-if` (33–62), so it is clickable while
   the Operator is mounted, and the Operator is **not** remounted — `openTask` stays `'t2'`.
3. `open` becomes true → `t2` flips to `expired`, `detailText` becomes `''`.

Result: the row now renders the `Diagnose` button **and**, underneath it, an empty detail stripe —
`padding:10px 14px 14px` + `border-bottom:1px solid rgba(255,220,190,.08)` + `animation:opFade .2s ease both`
with no text: a ~24px blank band with a rule under it. The same thing happens in reverse (expand while
expired is impossible, but resolving an incident while `t3` is expanded swaps its text mid-animation).

**Port requirement:** either (a) give `t2` real text for the `expired` state instead of `''` (preferred
— e.g. reuse the `Ursache`/`Auswirkung` line from the sheet), or (b) render the detail row only when
`t.detailText` is non-empty, or (c) clear `openTask` whenever the incident state changes. Do not port
the current behavior verbatim.

### 14.4 Operating rules (overview, hard-coded)

| Label | Value |
| --- | --- |
| `Parallele Browser-Sessions` | `2` |
| `Erneute Versuche` | `Mit zunehmendem Abstand` |

Disclaimer: `Illustrative Betriebsregeln, keine echten Worker-Pools.`

### 14.5 Fallback `DEMO` object (standalone preview, lines 215–219)

```js
const DEMO = {
  sources: [ …see §14.1… ],
  flags: { voice: true, publicSearch: false },
  incident: true, incidentResolved: false, contacted: true, stage: 'waiting',
};
```

`stage: 'waiting'` is the only occurrence of the token `stage` in the whole Operator file — it is never
read back (§1.3).

---

## 15. Complete state model and state-dependent variants

### 15.1 Component state

```js
// constructor, line 228
this.state = { diag: false, filter: 'all', openTask: null, openInt: null,
               flagDraft: null, flagsSaved: false };
// plus `localPage` when standalone
this.timers = [];          // cleared in componentWillUnmount (line 232)
this.rootRef, this.contentRef, this.diagCloseRef;
```

**Nothing in this component is ever reset on navigation.** There is no `componentDidUpdate` branch and
no `setPage` side effect that clears state; `componentDidUpdate` only scrolls and animates
`contentRef`. Every key below therefore survives page switches and incident-state changes for the whole
lifetime of the mounted Operator, and the "Cleared by" column is exhaustive.

| Key | Values | Written by | Read by | Cleared by |
| --- | --- | --- | --- | --- |
| `diag` | bool | `openDiag`, `closeDiag`, Escape key | sheet visibility | `closeDiag` only |
| `filter` | `'all'` \| `'attention'` | `filterAll`, `filterAttention`, `viewAttention` | Aufträge chips + `tasksFiltered` | **never** — persists across page switches (§7.1) |
| `openTask` | task id \| `null` | `t.details` (line 246) | task detail row on **both** the overview and the Aufträge table | **never** — only by toggling the same row again. The expanded row is therefore shared between the two tables and survives navigation *and* an incident state change (§14.3) |
| `openInt` | integration id \| `null` | `i.toggle` and tile `openTile` (line 254) | Integrationen accordion | **never** — only by toggling the same row again. An expanded provider is still expanded when you leave and return; two writers mean the accordion must be controlled (§8.2) |
| `flagDraft` | `{voice,publicSearch}` \| `null` | `f.toggle`, `cancelFlags`, `saveFlags` | flag switches, dirty panel | `cancelFlags`, `saveFlags` — **not** by navigation (§13.4) |
| `flagsSaved` | bool | `saveFlags` (+ 2600 ms timer), `f.toggle` | saved status line | the 2600 ms timer, or the next `f.toggle` |
| `localPage` | page id | `A.setPage` in standalone | page routing | never |

### 15.2 Derived booleans

```js
const inc      = !!d.incident;
const open     = inc && !d.incidentResolved;   // "incident open"
const resolved = inc && !!d.incidentResolved;
const F        = s.flagDraft || flags;         // effective flag values on the flags page
```

### 15.3 Variant matrix

| Variant driver | States | Affected elements |
| --- | --- | --- |
| `page` | 6 pages | content column; nav `bg`/`border`/`icon`/`aria-current`; scroll reset + 200 ms fade |
| incident (`open`) | none / open / resolved | overview banner, task statuses + row tint + action button, Quellen `roomscout.dev` row, Browserbase status/test/note, Diagnose page body, sheet `Zustand`, Simulation box, resolved status |
| `filter` | `all` / `attention` | chip backgrounds + `aria-pressed`, row list, empty state |
| `openTask` | null / id | one detail row, `Details` underline |
| `openInt` | null / id | one accordion panel, chevron rotation |
| `flagDraft` | null / dirty / dirty-but-equal | switch positions, dirty panel visibility |
| `flagsSaved` | bool (auto-off 2600 ms) | saved status line |
| `diag` | bool | scrim + sheet, focus move, Escape handler |
| `publicSearch` | on/off | Quellen `tech`/`dot` for public sources, overview mirror |
| `voice` | on/off | overview mirror only (real effect lives in the Scout surface) |
| standalone (`!actions`) | bool | navigation source, no-op `back`/`setFlags`/`renewLogin` |
| **mobile** | **not implemented** | The Operator has no `mobile` prop and no responsive breakpoints. The only fluid parts are the tile grid (`auto-fit,minmax(210px,1fr)`), the integration detail grid (`auto-fit,minmax(220px,1fr)`) and the sheet width (`min(500px,100%)`). Everything else (296px sidebar, 4-column tables, 1380px card) is fixed. **The port must define the mobile layout itself** — recommendation: `Sidebar` collapses to `SidebarTrigger` + off-canvas sheet, tables become stacked cards, the Diagnose sheet becomes a full-width `Drawer`. |

### 15.4 Keyboard & a11y inventory

| Concern | Prototype behavior | Port requirement |
| --- | --- | --- |
| Focus ring | `button:focus-visible{outline:2px solid #ff6926;outline-offset:2px}` | keep, map to a ring token |
| Nav semantics | `<nav aria-label="Betrieb">` + `aria-current` per button | `Sidebar` + `SidebarMenuButton isActive` |
| Filter chips | `aria-pressed` | `ToggleGroupItem` provides `aria-pressed` |
| Accordions | `aria-expanded` on the integration row button | `AccordionTrigger` |
| Switches | `role="switch" aria-checked aria-label="{label}"` | `Switch` + `Label` |
| Sheet | `role="dialog" aria-modal="true" aria-labelledby="op-diag-title"`; Escape closes (listener on `document`, removed in `componentWillUnmount`); focus moves to close button; focus returns to `[data-diag-trigger]` | `Sheet`/`Dialog` handles all of it; add an explicit fallback focus target and make sure the Escape handler is inert while the surface is closed |
| Status regions | `role="status"` on `Flags lokal gespeichert.` and `Zugang erneuert. …` | keep |
| Reduced motion | Two layers, **both already present**: the global media query at line 15 kills CSS animations/transitions (`animation-duration:.01ms!important;transition-duration:.01ms!important`), and the WAAPI page-change animation is separately guarded at line 235 with `if (!matchMedia('(prefers-reduced-motion: reduce)').matches)` (quoted in §3.5) — the media query cannot reach a `.animate()` call, hence the explicit check | keep both; if the port replaces the WAAPI call with a CSS/Framer transition, the JS guard is still needed for anything scripted |

---

## 16. shadcn `sidebar-13` mapping plan

`sidebar-13` = `Dialog` → `DialogContent` (padded to 0) → `SidebarProvider` → `Sidebar` +
main area with a header (`SidebarTrigger`, `Separator`, `Breadcrumb`) and a close button.

| Prototype element | `sidebar-13` slot | Notes |
| --- | --- | --- |
| Card (`296px minmax(0,1fr)` grid, radius 28px) | `DialogContent` + `SidebarProvider style={{'--sidebar-width':'296px'}}` | `overflow-hidden`, `max-w-[1380px]`, `h-[calc(100vh-…)]`, shadow `0 30px 90px rgba(0,0,0,.35)` |
| `<nav aria-label="Betrieb">` | `Sidebar` / `SidebarContent` | `border-r` = `rgba(255,220,190,.08)` |
| `Zur App` button | `SidebarHeader` `SidebarMenuButton` **and** the header `DialogClose` | prototype has it only in the sidebar; `sidebar-13` puts a close button in the header — ship both, same handler |
| `Betrieb` eyebrow | `SidebarGroupLabel` | |
| 6 nav buttons | `SidebarGroup` → `SidebarMenu` → `SidebarMenuItem` → `SidebarMenuButton isActive` | active styles per §4.4 |
| sidebar divider + `Nur für Betreiber` | `SidebarFooter` + `Separator` | |
| Header bar (`roomscout` / `INTERN` / `Entwicklung` / `OP`) | **not** in `sidebar-13` — put it in the `SidebarInset` header row, or above the sidebar as a full-width dialog header | recommended: dialog header row = `Breadcrumb` (`Betrieb` › current page label) on the left, env `Badge` + `Avatar` + `DialogClose` on the right; keep `roomscout` + `INTERN` in the `SidebarHeader` |
| Breadcrumb (new) | `Breadcrumb` / `BreadcrumbList` / `BreadcrumbItem` / `BreadcrumbSeparator` / `BreadcrumbPage` | `Betrieb` › `Übersicht` \| `Quellen` \| `Aufträge` \| `Integrationen` \| `Feature-Flags` \| `Diagnose`. **Use the nav labels, not the h1** (`Übersicht`, not `Betrieb im Blick`) |
| Content column | `SidebarInset` + `ScrollArea` | `padding:42px 46px 40px` |
| Attention / calm banners | `Alert` | warning tone uses the amber tint set |
| Integration tiles | `Card asChild` (button) in a grid | |
| Task / source tables | `Table` for semantics, grid layout for fidelity | rows keep `border-radius:10px` + conditional tint |
| Task expander | `Collapsible` | |
| Integrations list | `Accordion type="single" collapsible` (controlled by `openInt`) | |
| Filter chips | `ToggleGroup` | |
| Flag rows | `Switch` + `Label` + `Separator` | |
| Dirty panel | `Card` + `Button`s | |
| Saved / resolved status | `Alert role="status"` (or `Sonner` for the flags toast) | |
| Diagnose sheet | absolutely positioned panel inside `DialogContent`, styled as `SheetContent side="right"` | must not portal to `body` — it is scoped to the card in the prototype |
| Footer line | plain `<p>` below `DialogContent`'s card, or inside as a bottom bar | |
| Status dots | custom `StatusDot` | |
| Demo-Steuerung `Beispielstörung laden` | lives in the host shell, not here | keep it dev-only |

---

## 17. Copy dictionary (DE)

Stable semantic keys, grouped by section. Every user-visible string on the Operator surface is listed
(including strings that are only reachable in one incident state). Values are verbatim.

### 17.1 Chrome

```
operator.brand:                       "roomscout"
operator.badge.internal:              "INTERN"
operator.env.development:             "Entwicklung"
operator.avatar.initials:             "OP"
operator.avatar.aria:                 "Operator"
operator.footer.note:                 "Interner Status · Darstellung mit Beispieldaten"
```

### 17.2 Sidebar

```
operator.nav.aria:                    "Betrieb"
operator.nav.back:                    "Zur App"
operator.nav.groupLabel:              "Betrieb"
operator.nav.overview:                "Übersicht"
operator.nav.sources:                 "Quellen"
operator.nav.tasks:                   "Aufträge"
operator.nav.integrations:            "Integrationen"
operator.nav.flags:                   "Feature-Flags"
operator.nav.diag:                    "Diagnose"
operator.nav.footerNote:              "Nur für Betreiber"
```

### 17.3 Overview — Betrieb im Blick

```
overview.title:                       "Betrieb im Blick"
overview.subtitle:                    "Provider, Quellen und wartende Aufgaben."
overview.attention.icon:              "!"
overview.attention.text:              "1 Aufgabe braucht Aufmerksamkeit"
overview.attention.cta:               "Ansehen"
overview.calm.text:                   "Keine Aufgabe braucht Aufmerksamkeit. Beispielstörung über die Demo-Steuerung laden."
overview.section.integrations:        "Integrationen"
overview.section.tasks:               "Aufgaben"
overview.openai.name:                 "OpenAI direkt"
overview.openai.separator:            "·"
overview.openai.role:                 "Voice & Embeddings"
overview.openai.status:               "Bereit"
overview.rules.label:                 "Betriebsregeln"
overview.rules.sessions.label:        "Parallele Browser-Sessions"
overview.rules.sessions.value:        "2"
overview.rules.retries.label:         "Erneute Versuche"
overview.rules.retries.value:         "Mit zunehmendem Abstand"
overview.rules.note:                  "Illustrative Betriebsregeln, keine echten Worker-Pools."
overview.flags.label:                 "Feature-Flags"
overview.flags.edit:                  "Flags bearbeiten"
overview.flags.publicSearch.sub:      "Demo auf roomscout.dev begrenzt"
```

### 17.4 Shared — task table

```
tasks.column.process:                 "Vorgang"
tasks.column.source:                  "Quelle"
tasks.column.status:                  "Status"
tasks.column.next:                    "Nächster Schritt"
tasks.action.diagnose:                "Diagnose"
tasks.action.details:                 "Details"
tasks.source.roomscout:               "roomscout.dev"

tasks.status.done:                    "Abgeschlossen"
tasks.status.expired:                 "Anmeldung abgelaufen"
tasks.status.blocked:                 "Wartet auf Zugang"
tasks.status.planned:                 "Geplant"
tasks.status.resumed:                 "Fortgesetzt (einmalig)"

tasks.t1.name:                        "Neue Anzeigen prüfen"
tasks.t1.detail:                      "Öffentliche Anzeigen auf roomscout.dev wurden im Demo-Lauf geprüft. Ein passender Raum in Stuttgart-West wurde markiert."
tasks.t2.name:                        "Portal-Nachrichten lesen"
tasks.t2.detail:                      "Antworten im Portal werden über den verbundenen Demo-Zugang gelesen."
tasks.t2.detail.expired:              ""                        # prototype ships an empty string — supply real copy, see §14.3
tasks.t3.name:                        "Anfrage vorbereiten"
tasks.t3.detail.blocked:              "Wartet, bis der Portalzugang erneut verbunden ist. Es wird keine Anfrage doppelt gesendet."
tasks.t3.detail.resumed:              "Nach der erneuerten Anmeldung einmalig fortgesetzt."
tasks.t3.detail.default:              "Anfrage an den Anbieter im Rahmen des Handlungsspielraums der Band."
```

### 17.5 Quellen

```
sources.title:                        "Quellen"
sources.subtitle:                     "Technische Anbindung der Demo-Quellen, unabhängig von Nutzerpräferenzen."
sources.column.source:                "Quelle"
sources.column.region:                "Region"
sources.column.connection:            "Anbindung"
sources.column.lastCheck:             "Letzter Demo-Check"
sources.tech.portal.connected:        "Angebunden · Demo-Zugang"
sources.tech.portal.expired:          "Angebunden · Zugang braucht Anmeldung"
sources.tech.public.active:           "Öffentliche Anzeigen · Demo-Daten"
sources.tech.public.inactive:         "Nicht aktiv (Flag aus)"
sources.check.demoRun:                "Heute · Demo-Lauf"
sources.check.renewed:                "Heute, {h}:{mm}"          # see formatting rule below
sources.check.none:                   "—"
sources.footnote:                     "Der Demo-Lauf ist auf roomscout.dev begrenzt. Persönliche Quellenpräferenzen der Nutzer (z. B. „Bandnet für meine Suche ausschließen“) verändern diesen Status nicht."

sources.item.roomscout.name:          "roomscout.dev"
sources.item.roomscout.region:        "Stuttgart"
sources.item.musiker.name:            "Musiker in deiner Stadt"
sources.item.musiker.region:          "Stuttgart"
sources.item.bandnet.name:            "Bandnet Hamburg"
sources.item.bandnet.region:          "Hamburg"
```

**Formatting rule for `sources.check.renewed`.** This cell is not a fixed string: after a login is
renewed the host writes `now()` into `lastAccess` (`Roomscout.dc.html:737`) and the Operator renders it
raw (`check: x.lastAccess || 'Heute · Demo-Lauf'`, line 282). The prototype's format is German-only and
hand-rolled:

```js
'Heute, ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0')   // → "Heute, 9:41"
```

For the DE/EN port do **not** ship the literal. Store a relative-day token plus a locale-formatted
time:

| Locale | Pattern | Example |
| --- | --- | --- |
| `de` | `Heute, {time}` with `time = Intl.DateTimeFormat('de-DE',{hour:'numeric',minute:'2-digit'})` | `Heute, 9:41` |
| `en` | `Today, {time}` with `time = Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'})` | `Today, 9:41 AM` |

(Keep `sources.check.demoRun` and `sources.check.none` as plain strings; only the renewed variant is
interpolated. If the timestamp is older than today, the port should switch to a date format — the
prototype never reaches that case because the demo state is per-session.)

### 17.6 Aufträge

```
orders.title:                         "Aufträge"
orders.subtitle:                      "Vorgänge des laufenden Demo-Auftrags."
orders.filter.all:                    "Alle"
orders.filter.attention:              "Braucht Aufmerksamkeit"
orders.empty:                         "Keine Aufgabe braucht Aufmerksamkeit."
```

### 17.7 Integrationen

```
integrations.title:                   "Integrationen"
integrations.subtitle:                "Rolle und lokaler Demo-Status je Provider. Keine Schlüssel, keine Secrets."
integrations.field.config:            "Konfiguration:"
integrations.field.lastTest:          "Letzter Demo-Test:"

integrations.status.ready:            "Bereit"
integrations.status.configured:       "Konfiguriert"
integrations.status.check:            "Prüfen"
integrations.test.success:            "Erfolgreich (Demo)"
integrations.test.none:               "Noch kein Demo-Test"
integrations.config.configured:       "Konfiguriert"

integrations.convex.name:             "Convex AI Gateway"
integrations.convex.role:             "Text & Auswertung"
integrations.convex.note:             "Verarbeitet Gesprächstext und Faktenextraktion im Demo-Lauf."

integrations.firecrawl.name:          "Firecrawl"
integrations.firecrawl.role:          "Quellen beobachten"
integrations.firecrawl.note:          "Eine konfigurierte Integration ist kein Nachweis für einen erfolgreichen Live-Test."

integrations.agentmail.name:          "AgentMail"
integrations.agentmail.role:          "Scout-Postfächer"
integrations.agentmail.note:          "Stellt die Scout-Adressen bereit, über die Portal-Benachrichtigungen ankommen."

integrations.browserbase.name:        "Browserbase"
integrations.browserbase.role:        "Portal-Zugänge"
integrations.browserbase.note.ok:     "Hält die Portal-Sitzungen für Lesen und Senden von Nachrichten."
integrations.browserbase.note.incident: "Ein abgelaufener Portal-Login ist kein Ausfall von Browserbase insgesamt."
integrations.browserbase.test.incident: "1 Portalzugang braucht eine neue Anmeldung"

integrations.openai.name:             "OpenAI direkt"
integrations.openai.role:             "Voice & Embeddings"
integrations.openai.note:             "Sprachein- und -ausgabe sowie Embeddings für die Einordnung von Anzeigen."
```

### 17.8 Feature-Flags

```
flags.title:                          "Feature-Flags"
flags.subtitle:                       "Lokale Demo-Änderungen, keine Deployments."
flags.voice.label:                    "Voice Scout"
flags.voice.effect:                   "Aus: keine neuen Demo-Voice-Sessions. Laufende Gespräche werden nicht abgeschnitten, Text bleibt nutzbar."
flags.publicSearch.label:             "Öffentliche Quellensuche"
flags.publicSearch.effect:            "An: nur vorhandene fiktive Demo-Daten. Aus: öffentliche Quellen bleiben als Präferenz gespeichert, gelten aber als „In dieser Demo nicht aktiv“."
flags.scopeNote:                      "Demo auf roomscout.dev begrenzt. Es startet kein echter Crawl."
flags.preview.label:                  "Wirkung vor dem Speichern"
flags.preview.arrow:                  "→"
flags.preview.on:                     "an"
flags.preview.off:                    "aus"
flags.preview.voice.on:               "Neue Demo-Voice-Sessions sind wieder möglich."
flags.preview.voice.off:              "Keine neuen Demo-Voice-Sessions; Suchwissen und laufende Gespräche bleiben erhalten."
flags.preview.publicSearch.on:        "Öffentliche Demo-Quellen werden für Nutzer aktiv. Kein Zugriff auf echte Portale."
flags.preview.publicSearch.off:       "Öffentliche Quellen werden in den Nutzereinstellungen als nicht aktiv gekennzeichnet."
flags.action.cancel:                  "Abbrechen"
flags.action.save:                    "Lokal speichern"
flags.saved:                          "Flags lokal gespeichert."
flags.state.on:                       "An"
flags.state.off:                      "Aus"
```

Composed preview line (for translators): `{flags.<key>.label} + " " + flags.preview.arrow + " " + {flags.preview.on|off} + ". " + {flags.preview.<key>.<on|off>}`

### 17.9 Diagnose (page)

```
diag.title:                           "Diagnose"
diag.subtitle:                        "Verständliche Ereignisse aus den lokalen Demo-Daten."
diag.empty:                           "Keine offenen Störungen. Über die Demo-Steuerung lässt sich eine Beispielstörung laden."
diag.openSheet:                       "Diagnose-Sheet öffnen"
```

### 17.10 Diagnose sheet

```
diagSheet.title:                      "Diagnose"
diagSheet.close.aria:                 "Schließen"
diagSheet.field.process:              "Vorgang"
diagSheet.value.process:              "Portal-Nachrichten lesen"
diagSheet.field.portal:               "Portal"
diagSheet.value.portal:               "roomscout.dev · Profil Herzbuben"
diagSheet.field.state:                "Zustand"
diagSheet.state.expired:              "Anmeldung abgelaufen"
diagSheet.state.renewed:              "Verbunden (erneuert)"
diagSheet.label.cause:                "Ursache"
diagSheet.text.cause:                 "Die gespeicherte Anmeldung ist abgelaufen."
diagSheet.label.impact:               "Auswirkung"
diagSheet.text.impact:                "Private Portalnachrichten können momentan nicht gelesen werden. Die Suche nach Anzeigen läuft weiter."
diagSheet.label.next:                 "Nächster Schritt"
diagSheet.text.next:                  "Portalzugang erneut verbinden. Die Band sieht dazu einen Hinweis in ihren Zugängen."
diagSheet.label.timeline:             "Ereignisfolge"
diagSheet.simulation.label:           "Simulation"
diagSheet.simulation.text:            "Setzt den Beispielzugang lokal auf „Verbunden“ und gibt die wartende Demo-Aufgabe einmalig frei. Bereits abgeschlossene Anfragen werden nicht erneut ausgelöst."
diagSheet.simulation.action:          "Anmeldung als erneuert simulieren"
diagSheet.resolved:                   "Zugang erneuert. Die wartende Aufgabe wurde einmalig fortgesetzt."
```

### 17.11 Incident events

```
events.time.0941:                     "09:41"
events.time.0942:                     "09:42"
events.time.now:                      "Jetzt"
events.notificationReceived:          "Portal-Benachrichtigung über neue Nachricht erhalten"
events.openFailed:                    "Öffnen der Portal-Nachricht fehlgeschlagen: Anmeldung abgelaufen"
events.taskMarkedExpired:             "Aufgabe „Portal-Nachrichten lesen“ als „Anmeldung abgelaufen“ markiert"
events.taskWaitingAccess:             "Aufgabe „Anfrage vorbereiten“ wartet auf Zugang"
events.userHintShown:                 "Hinweis in den Zugängen der Band angezeigt"
events.loginRenewed:                  "Anmeldung erneuert (Simulation) · wartende Aufgabe einmalig fortgesetzt"
```

### 17.12 Cross-surface strings referenced by the incident flow (owned by other surfaces, listed for coordination)

```
scout.waitingAccess.text:             "Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung."
scout.waitingAccess.cta:              "Zu den Zugängen"
scout.status.needsLogin:              "Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann."
settings.page.sources.title:          "Quellen & Zugänge"      # Settings.dc.html:448 — the page `Zu den Zugängen` opens
settings.sources.state.expired:       "Anmeldung erneut nötig"
settings.sources.action.openLogin:    "Anmeldung öffnen"
settings.sources.saved:               "Zugang gespeichert. Dein Scout kann weitermachen."
host.demoControls.loadIncident:       "Beispielstörung laden"
host.demoControls.openOperator:       "Betreiberansicht"
host.now.prefix:                      "Heute"                  # Roomscout.dc.html:737, `now()`
host.now.format:                      "{prefix}, {h}:{mm}"     # h unpadded, mm zero-padded; feeds sources.check.renewed (§17.5)
```

`settings.page.sources.title` is owned by the Settings surface but listed here because the Operator's
incident copy (`diagSheet.text.next`, `events.userHintShown`) and the Scout's `scout.waitingAccess.cta`
all point the user at it; the link label (`Zu den Zugängen`) and the page title
(`Quellen & Zugänge`) are **different strings** and both must exist.

`host.now.*` is listed here because the string it produces is rendered **inside** the Operator, in the
Quellen table's `Letzter Demo-Check` column (§6, §17.5).

---

## 18. Assets referenced

| Path | Used by | Rendered size |
| --- | --- | --- |
| `assets/logo-convex.svg` | Convex tile + row | 28×28 / 24×24 |
| `assets/logo-firecrawl.svg` | Firecrawl tile + row | 28×28 / 24×24 |
| `assets/logo-agentmail.png` | AgentMail tile + row | 28×28 / 24×24 |
| `assets/logo-browserbase.png` | Browserbase tile + row | 28×28 / 24×24 |
| `assets/logo-openai.svg` | OpenAI static row (22×22) + Integrationen row (24×24) | 22×22 / 24×24 |
| `assets/logo-roomscout.png` | Quellen table, `roomscout.dev` row | 24×24 |

All are `object-fit:contain`; tiles use `border-radius:6px`, table/row logos use `border-radius:5px`.
Copy them into the app's asset pipeline before porting.
