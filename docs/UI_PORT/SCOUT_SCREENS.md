# RoomScout — Scout surface (Roomscout.dc.html)

Source of truth: `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype/Roomscout.dc.html`
Template: lines 1–645. Logic/props: lines 646–1230 (class `Component extends DCLogic`, method `renderVals()`).
This document describes the **Scout shell** — the global chrome plus all ten stage views. The two imported sub-surfaces (`Settings.dc.html`, `Operator.dc.html`) are documented separately; here only their mount points and the data/actions contracts are described.

Everything below is verbatim from the prototype. German copy is quoted exactly, including `„ “`, `·`, `–`, `—`, `€`, `…` and `<br>` line breaks. Never paraphrase.

---

## 0. Format primer (how to read the bindings)

- `<x-dc>` holds one HTML template. `{{ expr }}` is a binding into the object returned by `renderVals()`.
- `<sc-if value="{{ cond }}">…</sc-if>` — conditional block. `hint-placeholder-val="{{ true|false }}"` is an **editor-only** hint (what the Claude Design canvas shows when nothing is running). It has no runtime meaning; ignore it when porting.
- `<sc-for list="{{ facts }}" as="f" hint-placeholder-count="0">…</sc-for>` — list render; inside the block `{{ f.x }}` addresses the item. `hint-placeholder-count` is again editor-only.
- `<dc-import name="Settings" data="…" actions="…" page="…" back-req="…" hint-size="100%,100%">` — mounts another `.dc.html` surface as a child component with props.
- `style-hover="…"` — hover style string. In the port these become CSS `:hover` rules / Tailwind `hover:` variants.
- `<helmet>` — head injection: the Geist webfont and a `<style>` block with global resets and all `@keyframes`.
- All styling is **inline**; no classes, no CSS variables. Every value below is literal.
- `data-props` on the script tag: `{"$preview":{"width":1440,"height":900},"mobile":{"editor":"boolean","default":false,"tsType":"boolean","section":"Vorschau"}}` → one editor prop **`mobile`** (boolean, default `false`, editor section „Vorschau“), and a 1440×900 design canvas.

### The two responsive switches

```
mobile = state.mobile !== undefined ? state.mobile : !!props.mobile     // editor prop / demo-bar toggle
narrow = state.narrow || mobile
state.narrow = window.matchMedia('(max-width: 959px)').matches          // live, listened via 'change'
```

- **`mobile`** simulates a phone by shrinking the *stage frame* to a 390×844 rounded rectangle in the middle of the viewport. It is a prototype device-frame, not a media query.
- **`narrow`** is what actually drives layout values. It is true when the real viewport is ≤ 959px **or** when the `mobile` device frame is on.
- Port rule: implement every `narrow ? A : B` value as the `< 960px` breakpoint. Implement the `mobile` device frame only if a device-preview mode is wanted; otherwise `stL/stT/stW/stH/stTf/stR/stB` collapse to the desktop branch.

Also read from the environment: `window.matchMedia('(prefers-reduced-motion: reduce)')` (`this.rm`) — when it matches, word-by-word utterance reveal is instant, the capsule flight animation and the fade-ins are skipped.

---

## 1. Design tokens (from `<helmet>`, lines 10–26)

**Font**: Google Fonts `Geist`, weights `300;400;500;600`, `display=swap`; preconnect to `fonts.googleapis.com`.
Root stack: `font-family:'Geist',system-ui,sans-serif`. Monospace (demo bar, "Foto folgt" placeholders): `ui-monospace,Menlo,monospace`.

**Global CSS**

```css
html,body{margin:0;padding:0;background:#0b0a09;}
*{box-sizing:border-box}
a{color:#f5ece2}a:hover{color:#ff6926}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
input::placeholder{color:#9c8b7b}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

**Palette — complete literal inventory**

This is the *exhaustive* list. Counts are occurrences in the template (lines 27–644); values marked **(script)** never appear in the template because `renderVals()` binds them (`listBg`, `listBorder`, `listShadow`, `f.bg`, `micShadow`, `mobileBtnBg`, transcript bubble `bg`), and `#9c8b7b` appears only in the `<helmet>` CSS. Building a token set requires all of them — the earlier short table was not sufficient.

*Foreground / text*

| Token (suggested) | Value | × | Used for |
|---|---|---|---|
| `fg` | `#f5ece2` | 48 | primary text, most icon strokes, `a{color}` |
| `on-accent` | `#fff` | 32 | label on every orange/red filled control; the `color:#fff` hover lift (15 hover rules) |
| `fg-utter` | `#f8f0e7` | 1 | **only** the discovery utterance `<p data-utter>` |
| `fg-2` | `#e2d3c3` | 23 | secondary text, fact-icon stroke, activity/blocker rows |
| `fg-3` | `#cbb9a8` | 16 | tertiary text, captions, sublines, „inklusive Nebenkosten“ |
| `fg-4` | `#d8c8b8` | 10 | quiet/underlined text buttons |
| `muted` | `#a89684` | 28 | meta text, eyebrows, paused dot, „Foto folgt“ placeholder, demo bar |
| `muted-welcome` | `#b3a291` | 1 | **only** the welcome footnote „Du erzählst. Dein Scout kümmert sich.“ |
| `muted-sep` | `#8f7e6e` | 1 | **only** the `·` separator in the discovery speaker line |
| `placeholder` | `#9c8b7b` | helmet | `input::placeholder` |

*Accent / semantic*

| Token (suggested) | Value | × | Used for |
|---|---|---|---|
| `bg` | `#0b0a09` | 2 | root + stage background (also `html,body` in the helmet) |
| `accent` | `#ff6926` | 26 | primary orange: buttons, dots, checks, best-candidate border/CTA |
| `accent-hover` | `#ff7a3d` | 12 | primary button hover (11 plain + 1 with `translateY(-1px)`) |
| `accent-light` | `#ff8a4e` | 5 | eyebrow labels („Freigabe nötig“, „Angebot eingegangen“), 2 link hovers, blob gradient stop |
| `accent-tint` | `#ffd9c4` | 3 | fact capsule + suggestion chip + QA chip text |
| `accent-tint-2` | `#ffe0cf` | 1 | **only** the clarification „Ja, Mittwoch passt“ label |
| `accent-glow` | `#ffc39a` | 1 | blob radial-gradient start |
| `accent-deep` | `#e9511a` | 1 | blob radial-gradient end |
| `warn` | `#e0a13a` | 3 | stale banner dot, expired-access dot, candidate amber X + `budgetColor` |
| `danger` | `#b8382a` | 1 | „Gespräch beenden“ circle |
| `danger-hover` | `#c9463a` | 1 | its hover |

*Surfaces (all opaque-over-photo, so they must stay `rgba`)*

| Value | × | Used for |
|---|---|---|
| `rgba(18,14,12,.72)` | 8 | offer card, review card, approval card, all three brief panels, inline (dead) brief panel |
| `rgba(18,14,12,.66)` | 2 | clarification card, dead-end card |
| `rgba(18,14,12,.6)` | 1 | activity panel |
| `rgba(18,14,12,.92)` | 1 | mobile bottom sheet (`backdrop-filter:blur(10px)`) |
| `rgba(18,14,12,.74)` | (script) | fact list in **card** mode (`listBg`) |
| `rgba(18,14,12,.42)` | (script) | fact list in **float** mode (`listBg`) |
| `rgba(20,14,10,.6)` | 4 | every pill composer (discovery, side-note, clarification, QA) |
| `rgba(20,14,10,.55)` | 3 | autopilot brief pill, complete summary pill, (dead) discovery summary chip |
| `rgba(20,14,10,.5)` | 2 | offer brief pill, candidates brief pill |
| `rgba(30,22,16,.7)` | 1 | **hover** of the autopilot brief pill (the only non-white hover wash) |
| `rgba(20,15,12,.96)` | 1 | profile menu panel |
| `rgba(24,17,13,.96)` | 1 | toast |
| `rgba(28,20,14,.92)` | 1 | hint |
| `rgba(14,11,9,.94)` | 1 | transcript sheet |
| `rgba(10,8,7,.88)` | 1 | demo bar, open state (prototype only) |
| `rgba(10,8,7,.8)` | 1 | demo bar, closed pill (prototype only) |
| `rgba(120,58,22,.75)` | 2 | user bubble: clarification answer, QA question |
| `rgba(120,58,22,.6)` | (script) | user bubble in the transcript sheet |

*White washes (fills and hovers)*

| Value | × | Used for |
|---|---|---|
| `rgba(255,255,255,.02)` | 2 | „Foto folgt“ stripe, low stop |
| `rgba(255,255,255,.04)` | 8 | header buttons, message body, full-terms block, dead-end options, „Mit Scout sprechen“, stripe |
| `rgba(255,255,255,.05)` | 6 | outline-ish buttons („Nein, Donnerstag…“, „Sprechen“, „Suchauftrag ansehen“) |
| `rgba(255,255,255,.06)` | 11 | circle icon buttons, non-best candidate CTA, „Foto folgt“ stripe high stop, fact-edit input, demo buttons |
| `rgba(255,255,255,.07)` | 3 | mic-off circle, transcript circle, profile-menu item hover |
| `rgba(255,255,255,.08)` | 6 | send buttons, edit-button hover, „Abbrechen“ hover |
| `rgba(255,255,255,.09)` | 3 | **hover only** — dead-end option rows |
| `rgba(255,255,255,.1)` | 9 | hovers (header buttons, outline buttons) + demo bar borders |
| `rgba(255,255,255,.12)` | 3 | transcript close hover, voice-transcript circle hover, demo bar separator |
| `rgba(255,255,255,.14)` | 10 | **hover only** — send buttons, demo buttons |

*Hairlines / borders*

| Value | × | Used for |
|---|---|---|
| `rgba(255,200,160,.25)` | 2 | fact-edit input border (desktop list + sheet) |
| `rgba(255,200,160,.2)` | 1 | hint border |
| `rgba(255,200,160,.18)` | 3 | autopilot brief pill, complete summary pill, (dead) summary chip |
| `rgba(255,200,160,.16)` | 11 | composer pills, sheet, profile menu, dead-end options, candidates/offer brief pills |
| `rgba(255,200,160,.14)` | 8 | card border (offer, review, clarification, dead-end, brief panels) |
| `rgba(255,200,160,.12)` | 2 | activity panel border, transcript sheet `border-left` |
| `rgba(255,200,160,.10)` | (script) | fact list in **float** mode (`listBorder`) |
| `rgba(255,200,160,.16)` | (script) | fact list in **card** mode (`listBorder`) |
| `rgba(255,220,190,.35)` | 7 | `text-decoration-color` on every underlined text button |
| `rgba(255,220,190,.3)` | 3 | outline buttons („Suchauftrag ansehen“, „Mit Scout sprechen“) |
| `rgba(255,220,190,.28)` | 3 | „Abbrechen“, „Sprechen“, non-best candidate CTA border |
| `rgba(255,220,190,.22)` | 3 | header circle buttons, „Nein, Donnerstag ist wichtig“ |
| `rgba(255,220,190,.2)` | 1 | **mobile device-frame border** (`stB`) |
| `rgba(255,220,190,.16)` | 2 | mic-off circle border, side-note composer divider |
| `rgba(255,220,190,.1)` | 3 | profile-menu divider, candidate spec-list + note `border-top` |

*Orange washes*

| Value | × | Used for |
|---|---|---|
| `rgba(255,140,90,.5)` | 1 | fact capsule border |
| `rgba(255,140,90,.45)` | 1 | „Ja, Mittwoch passt“ border |
| `rgba(255,140,90,.4)` | 2 | suggestion chip + QA chip border |
| `rgba(255,140,90,.35)` | 3 | toast border, clarification + QA user bubble border |
| `rgba(255,140,90,.3)` | 1 | approval card border |
| `rgba(255,140,90,.5)` | (script) | best-candidate card `border` |
| `rgba(255,105,38,.26)` | 1 | „Ja, Mittwoch passt“ hover |
| `rgba(255,105,38,.22)` | 2 | suggestion + QA chip hover |
| `rgba(255,105,38,.16)` | 1 | fact capsule background |
| `rgba(255,105,38,.14)` | 1 | „Ja, Mittwoch passt“ background |
| `rgba(255,105,38,.12)` | 2 | suggestion + QA chip background |
| `rgba(255,105,38,.2)` | (script) | fact row `changed` flash (`f.bg`) |
| `rgba(255,105,38,.35)` | (script) | demo bar „Mobil“ pressed (`mobileBtnBg`) |

*Warn washes (stale banner only)*

| Value | × | Used for |
|---|---|---|
| `rgba(224,161,58,.12)` | 1 | stale banner background |
| `rgba(224,161,58,.35)` | 1 | stale banner border |

*Shadows and glows (colour + full box-shadow string)*

| Box-shadow | Where |
|---|---|
| `0 0 34px 6px rgba(255,120,50,.35),0 0 110px 20px rgba(255,105,38,.18)` | the blob (inner div) |
| `0 0 8px rgba(255,105,38,.5)` | candidate mini-blob dot |
| `0 8px 32px rgba(255,105,38,.28)` | welcome primary CTA |
| `0 8px 28px rgba(255,105,38,.25)` | „Scout losschicken“ (card + sheet), „Angebot prüfen“, „Angebot annehmen“ |
| `0 6px 24px rgba(255,105,38,.3)` | mic circle when `micOn` **(script, `micShadow`)** |
| `0 16px 40px rgba(0,0,0,.4)` | toast |
| `0 -20px 60px rgba(0,0,0,.4)` | mobile bottom sheet |
| `0 20px 50px rgba(0,0,0,.45)` | profile menu |
| `0 30px 80px rgba(0,0,0,.35)` | fact list in **card** mode **(script, `listShadow`)** |

*Gradients*

| Value | Where |
|---|---|
| `linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)` | background scrim (§2.3) |
| `radial-gradient(circle at 42% 38%,#ffc39a 0%,#ff8a4e 28%,#ff6926 58%,#e9511a 100%)` | the blob |
| `repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px)` | „Foto folgt vom Anbieter“ placeholder (offer + candidates) |

**Keyframes (verbatim)**

```css
@keyframes rsBreathe{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.04) rotate(-4deg);border-radius:54% 46% 58% 42%/50% 44% 56% 50%}}
@keyframes rsSpeak{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}30%{transform:scale(1.07) rotate(4deg);border-radius:46% 54% 60% 40%/58% 40% 60% 42%}65%{transform:scale(.97) rotate(-3deg);border-radius:56% 44% 40% 60%/48% 62% 38% 52%}}
@keyframes rsListen{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.02) rotate(8deg);border-radius:56% 44% 52% 48%/56% 46% 54% 44%}}
@keyframes rsFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes rsDot{0%,100%{opacity:.4}50%{opacity:1}}
```

`rsFadeUp` is the universal entrance: used as `animation:rsFadeUp <dur> [<delay>] ease both` on almost every card, panel, toast and hint.

**Assets** (`assets/` next to the .dc.html): `bg.jpg` (3.5 MB photo), `grain.svg` (220×220 tiling noise), `proberaum.png` (rehearsal-room photo used for the offer/review/candidate „west“), plus logos not used on this surface.

---

## 2. Global chrome

### 2.1 Root container (line 27)

```
position:fixed;inset:0;overflow:hidden;
font-family:'Geist',system-ui,sans-serif;color:#f5ece2;background:#0b0a09;
-webkit-font-smoothing:antialiased
```

Role: the app viewport. Everything (stage frame, toast, hint, transcript, demo bar) lives inside it.
**shadcn candidate:** custom (app shell `<div>`).

### 2.2 Stage frame — `data-stage="1"` (line 28)

```
position:absolute;left:{{ stL }};top:{{ stT }};width:{{ stW }};height:{{ stH }};
transform:{{ stTf }};border-radius:{{ stR }};border:{{ stB }};
overflow:hidden;display:flex;flex-direction:column;background:#0b0a09;
transition:width .4s,height .4s,border-radius .4s
```

| Binding | `mobile = false` (desktop) | `mobile = true` (phone frame) |
|---|---|---|
| `stL` | `0` | `50%` |
| `stT` | `0` | `50%` |
| `stW` | `100%` | `390px` |
| `stH` | `100%` | `min(844px, calc(100% - 32px))` |
| `stTf` | `none` | `translate(-50%,-50%)` |
| `stR` | `0` | `44px` |
| `stB` | `0` | `1px solid rgba(255,220,190,.2)` |

Note the frame animates between the two (`transition:width .4s,height .4s,border-radius .4s`) when the demo bar's „Mobil“ button is pressed.
**shadcn candidate:** custom.

### 2.3 Background layers (lines 29–31) — three absolutely positioned siblings inside the stage frame

1. **Photo layer**
   `position:absolute;inset:-2%;background-image:url('assets/bg.jpg');background-size:cover;background-position:50% 30%;filter:saturate(.62) brightness(.5);transform:scaleX(-1)`
   (`inset:-2%` bleeds the image so the mirrored/filtered edges never show.)
2. **Gradient scrim**
   `position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)`
3. **Grain overlay**
   `position:absolute;inset:0;opacity:.28;mix-blend-mode:overlay;background-image:url('assets/grain.svg')`

All three are non-interactive and sit below every `z-index` used by content (content starts at `z-index:2`).
**shadcn candidate:** custom (three `<div>` layers; do not try to fold into one).

### 2.4 Header (lines 33–62)

Wrapped in `<sc-if value="{{ notOperator }}">` → rendered whenever `state.view !== 'operator'`. The Operator surface brings its own chrome.

```
position:relative;z-index:12;height:{{ hdrH }}px;
display:flex;align-items:center;justify-content:space-between;
padding:{{ hdrPad }};flex:none
```

| Binding | desktop | narrow |
|---|---|---|
| `hdrH` | `84` | `64` |
| `hdrPad` | `0 36px` | `0 18px` |
| `markSize` | `20` | `17` |
| `hdrBtn` | `42` | `38` |
| `hdrGap` | `14` | `10` |
| `badgeTextVisible` | `true` | `false` |

**Wordmark** — text `roomscout`, `font-size:{{ markSize }}px;font-weight:500;letter-spacing:.04em`. Not a link, no click handler.
*shadcn candidate:* custom.

**Right cluster** — `display:flex;align-items:center;gap:{{ hdrGap }}px`.

#### 2.4.1 Scout badge — `<sc-if value="{{ showScoutBadge }}">`

Visible only while `isAutopilot` (`stage ∈ {scouting, waiting, following_up}`).

Wrapper: `title="{{ badgeText }}" aria-label="{{ badgeText }}"`, `display:flex;align-items:center;gap:10px;font-size:14px;color:#cbb9a8;white-space:nowrap`.

Dot: `width:8px;height:8px;border-radius:50%;background:{{ badgeDotColor }};animation:{{ badgeDotAnim }}`.

| state | `badgeText` | `badgeDotColor` | `badgeDotAnim` |
|---|---|---|---|
| running | `"Scout ist unterwegs"` | `#ff6926` | `rsDot 2.4s ease-in-out infinite` |
| `searchPaused` | `"Suche pausiert"` | `#a89684` | `none` |

Label `<span>{{ badgeText }}</span>` is wrapped in `<sc-if value="{{ badgeTextVisible }}">` → **hidden when narrow** (dot only; the text survives as `title`/`aria-label`).
*shadcn candidate:* Badge (variant secondary) with a custom pulsing dot; the aria-label must survive the narrow collapse.

#### 2.4.2 Pause button (same `sc-if`, i.e. autopilot only)

```
width:{{ hdrBtn }}px;height:{{ hdrBtn }}px;border-radius:50%;
border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.04);
color:#f5ece2;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0
hover → background:rgba(255,255,255,.1)
```
`aria-label` / `title` = `pauseLabel` = `"Suche pausieren"` when running, `"Suche fortsetzen"` when paused.
Icon: `searchPaused` → play triangle `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5.5v13l10-6.5z"/></svg>`; `notSearchPaused` → pause bars `<svg … fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6v12M15 6v12"/></svg>`.
Handler `toggleSearchPause`: flips `state.searchPaused`; on pause calls `sched.pause()`, on resume `sched.resume()` **unless** `demoPaused`.
*shadcn candidate:* Button (variant outline, size icon) + Tooltip.

#### 2.4.3 Avatar button + profile menu (lines 47–59)

Wrapper `position:relative`.
Button: same circle geometry as the pause button, plus `font:inherit;font-size:13px;font-weight:500`; content = `{{ initials }}`.
`aria-label="Profilmenü"`, `aria-haspopup="menu"`, `aria-expanded="{{ menuOpen }}"`.
`initials` derivation: if `name.trim() === 'Herzbuben'` → `"HB"`; else the first letters of each word (max 2) uppercased, or the first two characters of a single word, fallback `"HB"`.
Handler `toggleMenu` → `menuOpen = !menuOpen`.
*shadcn candidate:* Avatar (fallback initials) inside a DropdownMenu trigger Button.

**Menu panel** — `<sc-if value="{{ menuOpen }}">`, `role="menu"`:

```
position:absolute;right:0;top:52px;min-width:240px;padding:8px;border-radius:16px;
background:rgba(20,15,12,.96);border:1px solid rgba(255,200,160,.16);
box-shadow:0 20px 50px rgba(0,0,0,.45);
display:flex;flex-direction:column;gap:2px;animation:rsFadeUp .18s ease both
```

- Header block `padding:10px 12px 8px`: name `font-size:15px;font-weight:500` → `{{ name }}` (`"Herzbuben"`); subtitle `font-size:12.5px;color:#a89684` → `"Persönlicher Bereich"`.
- Divider: `height:1px;background:rgba(255,220,190,.1);margin:2px 4px 6px`.
- Item **„Einstellungen“** (`role="menuitem"`, handler `openSettings`) — `text-align:left;border:0;background:none;color:#f5ece2;font:inherit;font-size:15px;padding:10px 12px;border-radius:10px;cursor:pointer;display:flex;align-items:center;gap:10px`, hover `background:rgba(255,255,255,.07)`. Icon: sliders, `17×17`, `stroke-width:1.7`, `<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`.
- Item **„Zurück zum Scout“** — only inside `<sc-if value="{{ isSettingsView }}">`. Same styling. Icon: arrow-left `17×17`, `stroke-width:1.8`, `<path d="M19 12H5M11 6l-6 6 6 6"/>`. Handler `backToScout` (the props-level one) increments `backReq` and closes the menu; the actual navigation only happens if the Settings child is not dirty (`settingsDirty`) — i.e. Settings may veto and show its own confirm.
- Any click on `<main>` or on the Settings wrapper calls `closeMenu`.
*shadcn candidate:* DropdownMenu + DropdownMenuLabel + DropdownMenuSeparator + DropdownMenuItem.

### 2.5 View switches (lines 64–79)

Three mutually exclusive branches inside the stage frame, below the header:

- `<sc-if value="{{ isSettingsView }}">` (`view === 'settings'`)
  Wrapper: `onClick={{ closeMenu }}`, `position:relative;z-index:2;flex:1;min-height:0;display:flex;flex-direction:column;padding:4px 36px 0;animation:rsFadeUp .35s ease both`.
  Inner: `flex:1;min-height:0;max-width:1380px;width:100%;margin:0 auto` wrapping
  `<dc-import name="Settings" data="{{ settingsData }}" actions="{{ settingsActions }}" page="{{ settingsPage }}" back-req="{{ backReq }}" hint-size="100%,100%" style="height:100%;display:block">`.
  Footer line: `text-align:center;font-size:13px;color:#a89684;padding:14px 0 12px` → **„Designprototyp · Beispieldaten“**.
- `<sc-if value="{{ isOperatorView }}">` (`view === 'operator'`)
  Wrapper `position:relative;z-index:2;flex:1;min-height:0;display:flex;flex-direction:column;animation:rsFadeUp .35s ease both`, containing
  `<dc-import name="Operator" data="{{ opData }}" actions="{{ opActions }}" page="{{ opPage }}" hint-size="100%,100%" style="height:100%;display:block">`. No footer, no header (see `notOperator`).
- `<sc-if value="{{ isScoutView }}">` (`view === 'scout'`, the default) → `<main>` with every stage view.

**`settingsData`** (contract for the Settings surface): `{ name, initials, stage, hasOrder, hasFacts, ort, facts[{id,label}], sources, autoSources, usableCount, rules, knowledge, summary, knowledgeLog, notif, flags, incident, usage{searches,contacted,talk}, session, offerStale }`.
`session` is `"Gespräch pausiert · läuft weiter, wenn du zurückkehrst"` when a discovery session was held, else `"Suche pausiert"` / `"Scout ist unterwegs"` during autopilot, else `null`.
`usage.talk` is the literal `"Noch nicht erfasst"`.
**`settingsActions`**: `back, setPage, setDirty, toggleSource, setAutoSources, setAccess, saveRules, setName, updateFact, updateKnowledge, addKnowledge, setNotif, exportData`.
`exportData()` returns `{ name, facts, knowledge, sources, rules, notif, hinweis: 'Lokale Demo-Daten des Designprototyps' }`.
**`opData`**: `{ sources, flags, incident, incidentResolved, contacted, stage }`. **`opActions`**: `{ back, setPage, setFlags, loadIncident, renewLogin }`.
*shadcn candidate:* Dialog + Sidebar (shadcn block `sidebar-13`) for both child surfaces.

### 2.6 `<main>` (line 79)

```
position:relative;z-index:2;flex:1;min-height:0;overflow:auto;overflow-x:hidden;scrollbar-width:none
```
`ref={{ mainRef }}`, `onClick={{ closeMenu }}`. It is the positioning context for the blob, the desktop fact list and the mobile sheet, and its `scrollTop` is added when the blob is placed.
*shadcn candidate:* ScrollArea (but keep the hidden scrollbar; `scrollbar-width:none` only, no `::-webkit-scrollbar` rule is present).

### 2.7 Toast — `<sc-if value="{{ toast }}">` (lines 571–578)

Fires only when an event happens **while the user is not on the Scout view** (`notify()` no-ops when `view === 'scout'`).

```
role="status"
position:absolute;z-index:14;right:24px;top:96px;
display:flex;align-items:center;gap:14px;padding:12px 12px 12px 16px;border-radius:14px;
background:rgba(24,17,13,.96);border:1px solid rgba(255,140,90,.35);
box-shadow:0 16px 40px rgba(0,0,0,.4);animation:rsFadeUp .25s ease both
```
- Dot `width:8px;height:8px;border-radius:50%;background:#ff6926;flex:none`
- Message `font-size:14.5px` → `{{ toast }}`
- Primary button **„Zum Scout“** — `height:34px;padding:0 14px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer`, hover `background:#ff7a3d`; handler `toastGo` → `backToScout()`.
- Close button `aria-label="Schließen"` — `width:30px;height:30px;border-radius:50%;border:0;background:none;color:#a89684`, hover `color:#fff`; X icon `14×14`, `stroke-width:2`, `<path d="M6 6l12 12M18 6L6 18"/>`. Handler `dismissToast`.

Toast texts (all from `notify()`): `"Dein Scout wartet auf deine Freigabe"`, `"Dein Scout hat eine Rückfrage"`, `"Dein Scout braucht eine Entscheidung"`, `"Dein Scout hat Räume zum Vergleichen"`, `"Ein Angebot ist eingegangen"`.
**No auto-dismiss.** `notify(text)` only sets `state.toast`; there is no timer. The toast survives until `dismissToast` (the X), `toastGo` („Zum Scout“) or any `backToScout()` — which is also why it can never be seen on the Scout view itself.
*shadcn candidate:* a custom fixed card (the exact position right 24 / top 96 and the persistence both matter). If Sonner is used, it must be configured with `duration: Infinity` and a manual dismiss.

### 2.8 Hint — `<sc-if value="{{ hint }}">` (lines 581–583)

Transient bottom-centre status line, auto-dismissed after **4200 ms** (`showHint`).

```
role="status"
position:absolute;z-index:8;left:50%;bottom:22px;transform:translateX(-50%);
max-width:min(560px,calc(100% - 32px));padding:10px 16px;border-radius:12px;
background:rgba(28,20,14,.92);border:1px solid rgba(255,200,160,.2);
font-size:13.5px;color:#e2d3c3;text-align:center;animation:rsFadeUp .3s ease both
```
See the copy dictionary for all eight hint strings.
*shadcn candidate:* Sonner (bottom-center, no action) or custom.

### 2.9 Transcript sheet — `<sc-if value="{{ transcriptOpen }}">` (lines 586–604)

Right-edge panel over the whole stage.

```
position:absolute;z-index:9;top:0;right:0;bottom:0;width:min(420px,100%);
background:rgba(14,11,9,.94);border-left:1px solid rgba(255,200,160,.12);
display:flex;flex-direction:column;animation:rsFadeUp .3s ease both
```
- Header row `height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 24px;flex:none`; title `font-size:17px;font-weight:500` → **„Mitschrift“**; close button `aria-label="Mitschrift schließen"`, `width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.06);color:#f5ece2`, hover `background:rgba(255,255,255,.12)`, X icon `18×18` `stroke-width:2`. Handler `toggleTranscript`.
- Body `flex:1;overflow:auto;padding:4px 24px 24px;display:flex;flex-direction:column;gap:14px`.
- Empty state `<sc-if value="{{ transcriptEmpty }}">` → `font-size:14px;color:#a89684` → **„Noch keine Äußerungen.“**
- `<sc-for list="{{ transcript }}" as="m">`: column `display:flex;flex-direction:column;gap:4px;align-items:{{ m.align }}`; who line `font-size:12px;color:#a89684` → `{{ m.who }}`; bubble `max-width:88%;padding:10px 14px;border-radius:{{ m.radius }};background:{{ m.bg }};font-size:15px;line-height:1.45;text-align:left` → `{{ m.text }}`.

| item field | scout | user |
|---|---|---|
| `m.who` | `"Dein Scout"` | `"Du"` |
| `m.align` | `flex-start` | `flex-end` |
| `m.radius` | `14px 14px 14px 4px` | `14px 14px 4px 14px` |
| `m.bg` | `rgba(255,255,255,.06)` | `rgba(120,58,22,.6)` |

The transcript is appended to on every `showUtterance`, on every clarification answer/reply, and on `START_LINE` when scouting begins. Opening Settings or the Operator view force-closes it (`transcriptOpen:false`).
*shadcn candidate:* Sheet (side="right") + ScrollArea.

### 2.10 Demo control bar — **NOT to be built** (lines 606–644)

Prototype-only chrome, outside the product UI (it sits outside the `data-stage` frame). Documented for completeness; the ported app must not ship it.

Container: `position:absolute;z-index:10;left:16px;bottom:16px;display:flex;flex-direction:column;align-items:flex-start;gap:8px`.

**Open state** `<sc-if value="{{ demoOpen }}">` — `display:flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;border-radius:12px;background:rgba(10,8,7,.88);border:1px solid rgba(255,255,255,.1);font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#a89684;flex-wrap:wrap;backdrop-filter:blur(8px)`. Contents in order:

1. Label `margin-right:6px` → **„Prototyp · Beispieldaten“**
2. Play/pause `30×30`, `border-radius:8px`, `background:rgba(255,255,255,.06)`, hover `rgba(255,255,255,.14)`; `aria-label`/`title` = `demoPauseLabel` (`"Pausieren"` / `"Abspielen"`); icon swaps on `demoPaused` / `demoRunning`. Handler `toggleDemoPause` — pauses the scheduler and the word reveal; on resume completes the current utterance instantly.
3. Step button, `aria-label`/`title` **„Nächster Schritt“**; handler `demoNext` (finishes the reveal, else fires the earliest pending timer via `Sched.skip()`, else advances `STAGES`).
4. Restart button, `aria-label`/`title` **„Zurück zum Anfang“**; handler `restart` → `go('welcome')`.
5. `<select value="{{ stage }}" onChange="{{ onChapter }}" aria-label="Kapitel">` `height:30px;border-radius:8px;border:0;background:rgba(255,255,255,.06);color:#f5ece2;font:inherit;padding:0 6px;cursor:pointer` with options:
   `welcome` → „1 · Willkommen“, `discovery` → „2 · Gespräch“, `brief_review` → „3 · Suchauftrag“, `scouting` → „4 · Autopilot“, `waiting` → „5 · Warten“, `clarification` → „6 · Rückfrage“, `following_up` → „7 · Klärung“, `dead_end` → „7b · Sackgasse“, `candidates` → „7c · Kandidaten“, `offer` → „8 · Angebot“, `offer_review` → „9 · Prüfung“, `complete` → „10 · Abschluss“.
6. Speed toggle, `aria-label`/`title` **„Tempo“**, label `speedLabel` = `"1×"` / `"1.6×"`.
7. Separator `width:1px;height:18px;background:rgba(255,255,255,.12);margin:0 2px`.
8. **„Mobil“** toggle, `aria-pressed="{{ mobile }}"`, background `{{ mobileBtnBg }}` = `rgba(255,105,38,.35)` when on, else `rgba(255,255,255,.06)`.
9. **„Einstellungen“** → `openSettings()`; **„Betreiberansicht“** → `openOperator()`; **„Beispielstörung laden“** → `loadIncident()` (sets `incident:true`, expires the roomscout.dev access, jumps to the Operator overview).
10. Hide button `aria-label="Steuerung ausblenden" title="Ausblenden"`, X icon; handler `toggleDemo`.

**Closed state** `<sc-if value="{{ demoClosed }}">` — a single pill `height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(10,8,7,.8);color:#a89684;font-family:ui-monospace,Menlo,monospace;font-size:11px`, hover `color:#fff`, label **„Prototyp · Demo-Steuerung“**.
*shadcn candidate:* n/a — do not build.

---

## 3. The voice blob (the Scout avatar)

One single DOM node lives inside `<main>` and is **teleported** between stage-specific anchors. It is never re-created, so it appears to glide between screens.

### 3.1 The element (lines 81–83)

Outer (`ref={{ blobRef }}`, `aria-hidden="true"`):
```
position:absolute;z-index:3;pointer-events:none;opacity:0;
transition:left .9s cubic-bezier(.22,.8,.2,1),top .9s cubic-bezier(.22,.8,.2,1),
           width .9s cubic-bezier(.22,.8,.2,1),height .9s cubic-bezier(.22,.8,.2,1),opacity .6s
```
Inner:
```
width:100%;height:100%;
border-radius:62% 38% 46% 54%/44% 58% 42% 56%;
background:radial-gradient(circle at 42% 38%,#ffc39a 0%,#ff8a4e 28%,#ff6926 58%,#e9511a 100%);
box-shadow:0 0 34px 6px rgba(255,120,50,.35),0 0 110px 20px rgba(255,105,38,.18);
animation:{{ blobAnim }};transition:box-shadow .6s
```

### 3.2 Positioning (`syncBlob()`, called in `componentDidMount`, `componentDidUpdate` and on `window.resize`)

```
a = main.querySelector('[data-blob-anchor]')
if (!a) { blob.style.opacity = '0'; return }
blob.left  = a.rect.left - main.rect.left
blob.top   = a.rect.top  - main.rect.top + main.scrollTop
blob.width = a.rect.width ; blob.height = a.rect.height ; blob.opacity = '1'
```
Each stage view renders exactly **one** invisible `div[data-blob-anchor="1"]` that reserves the space; the blob copies its box. When a stage has no anchor (`offer_review` has one, `offer` has one only in the lower "explain" row — see below) the blob fades out.

### 3.3 Anchor geometry per stage

| Stage | Anchor style | Notes |
|---|---|---|
| `welcome` | `width:{{ welcomeBlob }}px;height:{{ welcomeBlob }}px;margin-bottom:{{ welcomeBlobMb }}px` | `welcomeBlob` = 168 desktop / **128 narrow**; `welcomeBlobMb` = 56 / **36** |
| `discovery` | `width:{{ discoveryBlob }}px;height:{{ discoveryBlob }}px;margin-bottom:28px;transition:width .6s,height .6s,margin .6s` | `discoveryBlob` = voice 160 / text 104 (desktop), voice **120** / text **88** (narrow) |
| `brief_review` | `width:96px;height:96px` | fixed |
| autopilot (`scouting`/`waiting`/`following_up`) | `width:{{ autoBlob }}px;height:{{ autoBlob }}px;margin-bottom:{{ autoBlobMb }}px` | `autoBlob` = 160 / **112**; `autoBlobMb` = 48 / **30** |
| `clarification` | `width:118px;height:118px;margin-bottom:34px` | fixed |
| `offer` | `width:58px;height:58px` | **not** at the top — it sits in the „Soll ich euch das Angebot erklären?“ row *below* the offer card, so the blob visibly travels down |
| `offer_review` | `width:64px;height:64px;margin-bottom:22px` | fixed |
| `complete` | `width:96px;height:96px;margin-bottom:40px` | fixed |
| `dead_end` | `width:110px;height:110px;margin-bottom:30px` | fixed |
| `candidates` | `width:72px;height:72px;margin-bottom:22px` | fixed |

### 3.4 State animation — `blobAnim` from `state.scoutState`

| `scoutState` | `blobAnim` | set when |
|---|---|---|
| `speaking` | `rsSpeak 1.7s ease-in-out infinite` | a scout utterance is playing; scout reply in clarification; `START_LINE`; compromise line; `talkOffer`; `askQa` |
| `listening` | `rsListen 4.2s ease-in-out infinite` | a user utterance is playing **and** `micOn`; text mode waiting for the user |
| `thinking` | `rsBreathe 2.4s ease-in-out infinite` | right after a user utterance, while facts are being extracted |
| `idle` | `rsBreathe 5.2s ease-in-out infinite` | everything else (incl. mic off) |

**shadcn candidate:** custom (no shadcn primitive; a single `<div>` + CSS keyframes + a measuring hook).

---

## 4. The search brief („Euer Suchauftrag“) — two presentations of the same data

`state.facts` is the model. Each fact: `{ id, label, arriving?, changed? }`. Ids and their final labels (`FINAL_FACTS`):

| id | label |
|---|---|
| `ort` | `"Stuttgart"` |
| `budget` | `"Bis 350 € / Monat"` |
| `band` | `"Geteilter Raum · 4 Personen"` |
| `zeit` | `"Donnerstags ab 19 Uhr"` |
| `equip` | `"Schlagzeug darf im Raum bleiben"` |

`renderVals()` maps each fact to a render item:
```
id, label,
isOrt/isBudget/isBand/isZeit/isEquip  → f.id === '<id>'
opacity : f.arriving ? 0 : 1
bg      : f.changed  ? 'rgba(255,105,38,.2)' : 'transparent'
h       : f.arriving ? 0 : (card ? 44 : 34)
pad     : f.arriving ? '0 6px' : (card ? '0 8px' : '0 6px')
editing / notEditing : state.editing
draft   : editDraft[f.id] ?? f.label
onEdit  : writes editDraft[f.id]
```

**Who sets `changed` (the orange row flash).** `changed` is *not* set by every commit or edit. This table is exhaustive:

| Call site | sets `changed`? | cleared after | also does |
|---|---|---|---|
| `commitFact(f)` (§4.3, discovery) | `changed: !x.arriving` → **`false` for a newly arriving fact**, `true` only when the row already existed | 1100 ms | fades `[data-fact-label]` in over 350 ms |
| `updateFact(id,label)` — the **Settings** action `settingsActions.updateFact` | **`true`** | 1200 ms | `logChange("Angabe korrigiert: " + label)` **and** sets `offerStale` when `stage ∈ {offer, offer_review}` |
| `answerClar(true, …)` | **`true`** on `zeit` | cleared at the 2300 ms stage switch | rewrites `zeit` → „Mittwoch oder Donnerstag ab 19 Uhr“ |
| `compromise(kind)` | **`true`** on the touched fact | 1200 ms | `logChange("Suchauftrag angepasst: " + label)` + activity entry |
| `saveEdit()` — the „Übernehmen“ button of the brief card **and** the mobile sheet | **no** | — | *only* rewrites `label` from `editDraft` and clears `editing`/`editDraft`. **No flash, no knowledge-log entry, no `offerStale`.** |
| `processFacts` push (`arriving:true`) | no | — | see §4.3 |

Consequence for the port: the in-product edit UI (§4.2 / §4.4) is silent — it neither flashes nor logs nor invalidates an offer. The stale-offer banner (§10.1) is reachable **only** through the Settings surface's `updateFact`.

In the scripted discovery flow the flash therefore fires **exactly once**: on the `budget` correction in `SCRIPT[6]` („Und beim Budget lieber maximal 350 Euro.“), because that row already exists from `SCRIPT[1]`. Every other fact arrives new and commits with `changed:false`.

### 4.1 Fact icons (identical set in both presentations, differing only in svg size)

Rendered inside `<span style="width:22px;height:22px;flex:none;display:flex;align-items:center;justify-content:center;color:#e2d3c3">`.

| condition | icon (viewBox `0 0 24 24`, `fill:none`, `stroke:currentColor`) |
|---|---|
| `f.isOrt` | map pin — `stroke-width:1.6;stroke-linejoin:round`, `<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>` |
| `f.isBudget` | text glyph `€` — desktop list: `<span style="font-size:19px;line-height:1;font-weight:400">€</span>`; mobile sheet: `<span style="font-size:18px;line-height:1">€</span>` |
| `f.isBand` | two people — `stroke-width:1.6;stroke-linecap:round`, `<circle cx="9" cy="8" r="3.2"/><circle cx="16.5" cy="9" r="2.6"/><path d="M3.5 19c.5-3.3 2.6-5 5.5-5s5 1.7 5.5 5"/><path d="M15 14.4c2.6 0 4.3 1.5 4.8 4.4"/>` |
| `f.isZeit` | clock — `stroke-width:1.6;stroke-linecap:round`, `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>` |
| `f.isEquip` | drum — `stroke-width:1.6;stroke-linecap:round`, `<ellipse cx="12" cy="8" rx="8" ry="3"/><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"/><path d="M8 10.5v8M16 10.5v8"/>` |

Icon svg size: **20×20** in the desktop fact list, **19×19** in the mobile sheet.

### 4.2 Desktop fact list — `<sc-if value="{{ listVisible }}">` (lines 524–566)

`listVisible = !narrow && listMode !== 'hidden' && (listMode !== 'float' || facts.length > 0)`.
`state.listMode ∈ { hidden, float, card, leaving }`; `card = listMode === 'card' || listMode === 'leaving'`.

The **same element** morphs from a small floating panel (top-right of `<main>`, during discovery) into a large centred card (during `brief_review`), then scales away (`leaving`).

Container (`data-fact-list="1"`):
```
position:absolute;z-index:4;left:{{ listLeft }};top:{{ listTop }}px;width:{{ listWidth }}px;
padding:{{ listPad }};border-radius:{{ listRadius }}px;background:{{ listBg }};
border:1px solid {{ listBorder }};box-shadow:{{ listShadow }};
opacity:{{ listOpacity }};transform:{{ listTransform }};
text-align:left;display:flex;flex-direction:column;gap:{{ listGap }}px;
transition:left .9s cubic-bezier(.22,.8,.2,1),top .9s cubic-bezier(.22,.8,.2,1),
           width .9s cubic-bezier(.22,.8,.2,1),padding .9s cubic-bezier(.22,.8,.2,1),
           border-radius .9s,background .9s,border-color .9s,gap .9s,opacity .5s,transform .5s
```

| Binding | float (`listMode:'float'`) | card (`'card'`/`'leaving'`) |
|---|---|---|
| `listLeft` | `calc(100% - 312px)` | `calc(50% - <cardW/2>px)` |
| `listTop` | `20` | `236` (`cardTop`) |
| `listWidth` | `288` | `cardW` = `Math.min(540, Math.max(280, mainWidth - 32))`, `mainWidth` falls back to `600` before the first measure |
| `listPad` | `12px 14px 12px` | `26px 28px 28px` |
| `listRadius` | `16` | `26` |
| `listBg` | `rgba(18,14,12,.42)` | `rgba(18,14,12,.74)` |
| `listBorder` | `rgba(255,200,160,.10)` | `rgba(255,200,160,.16)` |
| `listShadow` | `none` | `0 30px 80px rgba(0,0,0,.35)` |
| `listGap` | `2` | `6` |
| `listHeadMb` | `4` | `10` |
| `listHeadFont` | `11.5` | `22` |
| `listHeadWeight` | `500` | `400` |
| `listHeadSpacing` | `.09em` | `-.01em` |
| `listHeadTransform` | `uppercase` | `none` |
| `listHeadColor` | `#a89684` | `#f5ece2` |
| `rowGap` | `10` | `16` |
| `rowFont` | `13.5` | `17` |
| `listOpacity` | `1` | `0` when `leaving` |
| `listTransform` | `none` | `scale(.94) translateY(10px)` when `leaving` |

**Header row** `display:flex;align-items:center;justify-content:space-between;margin-bottom:{{ listHeadMb }}px;transition:margin .9s`
- Title `font-size:{{ listHeadFont }}px;font-weight:{{ listHeadWeight }};letter-spacing:{{ listHeadSpacing }};text-transform:{{ listHeadTransform }};color:{{ listHeadColor }};transition:font-size .9s,color .9s` → **„Euer Suchauftrag“**
- Edit button `<sc-if value="{{ showEditBtn }}">` (`card && cardArrived && !editing`), `aria-label="Suchauftrag bearbeiten"`, `width:36px;height:36px;border-radius:50%;border:0;background:none;color:#e2d3c3;cursor:pointer;display:flex;align-items:center;justify-content:center;animation:rsFadeUp .3s ease both`, hover `background:rgba(255,255,255,.08)`; pencil icon `18×18`, `stroke-width:1.7;stroke-linejoin:round`, `<path d="M4 20l4-.8L19.5 7.7a1.8 1.8 0 0 0-2.6-2.6L5.3 16.6z"/>`. Handler `startEdit`.

**Rows** `<sc-for list="{{ facts }}" as="f">`, `data-fact-row="{{ f.id }}"`:
```
display:flex;align-items:center;gap:{{ rowGap }}px;height:{{ f.h }}px;padding:{{ f.pad }};
border-radius:10px;font-size:{{ rowFont }}px;opacity:{{ f.opacity }};background:{{ f.bg }};overflow:hidden;
transition:padding .9s,font-size .9s,gap .9s,height .9s,opacity .35s,background .5s
```
- editing: `<input value="{{ f.draft }}" onChange="{{ f.onEdit }}" aria-label="Kriterium bearbeiten" style="flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,200,160,.25);border-radius:8px;color:#f5ece2;font:inherit;font-size:16px;padding:6px 10px;outline:none">`
- not editing: `<span data-fact-label="{{ f.id }}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ f.label }}</span>`

**Card actions** `<sc-if value="{{ cardActions }}">` (`card && cardArrived && !editing && stage === 'brief_review'`):
`margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:14px;animation:rsFadeUp .45s ease both`
- Primary **„Scout losschicken“** — `width:100%;height:58px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:18px;font-weight:600;cursor:pointer;box-shadow:0 8px 28px rgba(255,105,38,.25)`, hover `background:#ff7a3d`. Handler `startScouting`.
- Caption `font-size:14.5px;line-height:1.55;color:#cbb9a8;text-align:center` → **„Ich suche und frage selbstständig an.“** `<br>` **„Eine verbindliche Zusage gibst nur du.“**
- Row `display:flex;gap:18px`: **„Noch etwas ändern“** (`color:#e2d3c3;font-size:15px;padding:6px 8px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35)`, hover `color:#fff`, handler `startEdit`) and **„Zurück zum Gespräch“** (`color:#a89684;font-size:15px;padding:6px 8px`, hover `color:#fff`, handler `backToConvo`).

**Edit actions** `<sc-if value="{{ editing }}">`: `margin-top:14px;display:flex;gap:10px;justify-content:center;animation:rsFadeUp .3s ease both`
- **„Übernehmen“** `height:46px;padding:0 22px;border-radius:999px;border:0;background:#ff6926;color:#fff;font-size:15px;font-weight:600`, hover `#ff7a3d`; handler `saveEdit`:
  ```js
  saveEdit: () => this.setState(st => ({ editing: false,
    facts: st.facts.map(f => st.editDraft[f.id] !== undefined && st.editDraft[f.id].trim()
      ? Object.assign({}, f, { label: st.editDraft[f.id].trim() }) : f),
    editDraft: {} }))
  ```
  It commits every non-empty trimmed `editDraft` and clears `editing`/`editDraft` — **and nothing else**: no `changed` flash, no `knowledgeLog` entry, no `offerStale`. Same handler for the mobile sheet (§4.4). See the table in §4.
- **„Abbrechen“** `height:46px;padding:0 22px;border-radius:999px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font-size:15px`, hover `background:rgba(255,255,255,.08)`; handler `cancelEdit`.

*shadcn candidate:* Card + (rows) custom list + Input + Button. The float→card morph is a custom animated container, not a shadcn primitive.

### 4.3 Fact arrival choreography (discovery only)

`processFacts(list, k, done)` walks the utterance's `facts` array **one at a time**, recursively:

1. `processFacts` sets `capsule = fact` and pushes a placeholder row with `arriving:true` (height 0, opacity 0) — **but only if the id is not already in `state.facts`**:
   ```js
   const exists = st.facts.some(x => x.id === f.id);
   return { capsule: f, facts: exists ? st.facts : st.facts.concat([{ id: f.id, label: f.label, arriving: true }]) };
   ```
   So the second `budget` fact („Bis 350 € / Monat“, `SCRIPT[6]`) adds **no** row — the capsule flies to the existing `budget` row and overwrites its label. A port that appends unconditionally would render two budget rows.
2. After 650 ms `flyCapsule` clones the visible capsule chip, absolutely positions the clone inside `<main>`, and animates it to the target row (`[data-fact-row="<id>"]`, falling back to `[data-fact-summary]`):
   keyframes `translate(0,0) scale(1) opacity 1` → at `offset .5` `translate(dx*.55, dy*.5-46) scale(.96)` → `translate(dx,dy) scale(.9) opacity 0`; `duration:580, easing:cubic-bezier(.3,.7,.2,1), fill:forwards`.
   `dx = targetLeft + 8 - capsuleLeft`, `dy = targetTop + (targetHeight - capsuleHeight)/2 - capsuleTop` (fallback `+8` when the target has no height).
   The clone gets `animation:none`, `data-capsule` removed, `position:absolute`, `margin:0`, `zIndex:20`, `pointerEvents:none`, `willChange:transform`, and `state.capsule` is cleared immediately so the original chip disappears.
3. 400 ms into the flight `commitFact` sets `arriving:false` (row grows to full height) and fades the label in (`opacity 0→1`, 350 ms). It sets **`changed: !x.arriving`** — i.e. `false` for the newly arriving row (no orange flash) and `true` only when the row already existed (the budget correction). When `changed` is `true` it is cleared 1100 ms later. See the table in §4 above.
4. `a.onfinish` (≈580 ms) removes the clone and calls `done`, which is `() => this.sched.after(300, () => this.processFacts(list, k + 1, done))` — **300 ms gap between two facts of the same utterance**.
5. When the whole list is done, `done()` at the top level is `() => this.sched.after(600, () => this.runStep(i + 1))` — see §6.3.
6. Reduced motion, a missing capsule node or a missing target → `capsule:null`, `commitFact(f)` and `done()` fire immediately (no 400 ms offset, no 580 ms flight).

### 4.4 Mobile bottom sheet — `<sc-if value="{{ sheetVisible }}">` (lines 484–521)

```
sheetVisible = narrow && facts.length > 0 && (stage === 'discovery' || stage === 'brief_review') && listMode !== 'hidden'
sheetCard    = narrow && stage === 'brief_review'
```
It replaces the desktop fact list entirely on narrow (`listVisible` requires `!narrow`), and it also morphs: a compact pill during discovery, a full-bleed bottom card in `brief_review`.

Container (`data-sheet="1"`):
```
position:absolute;z-index:6;left:{{ shSide }}px;right:{{ shSide }}px;bottom:{{ shBottom }}px;
border-radius:{{ shRadius }};background:rgba(18,14,12,.92);border:1px solid rgba(255,200,160,.16);
backdrop-filter:blur(10px);padding:{{ shPad }};display:flex;flex-direction:column;gap:4px;
max-height:78%;overflow:auto;box-shadow:0 -20px 60px rgba(0,0,0,.4);
transition:left .6s cubic-bezier(.22,.8,.2,1),right .6s cubic-bezier(.22,.8,.2,1),
           bottom .6s cubic-bezier(.22,.8,.2,1),border-radius .6s,padding .6s
```

| Binding | discovery (`sheetCard=false`) | brief (`sheetCard=true`) |
|---|---|---|
| `shSide` | `12` | `0` |
| `shBottom` | `12` | `0` |
| `shRadius` | `20px` | `26px 26px 0 0` |
| `shPad` | `8px 14px 8px` | `22px 22px 26px` |
| `shTitleSize` | `15` | `22` |
| `shTitleWeight` | `500` | `400` |
| `shTitle` | `facts.length + (length === 1 ? " Wunsch gemerkt" : " Wünsche gemerkt")` → e.g. **„3 Wünsche gemerkt“**, **„1 Wunsch gemerkt“** | **„Euer Suchauftrag“** |
| `shRowsVisible` | `briefOpen` | always `true` |
| `shChevron` | `true` | `false` |
| `shActions` / `shEditBtn` | `false` | `cardArrived && !editing` |
| `shEditing` | `false` | `editing` |

- Title button `data-fact-summary="1"`, `aria-expanded="{{ briefOpen }}"`, handler `toggleBrief`: `flex:1;display:flex;justify-content:space-between;align-items:center;border:0;background:none;color:#f5ece2;font:inherit;font-size:{{ shTitleSize }}px;font-weight:{{ shTitleWeight }};padding:6px 4px;cursor:pointer;text-align:left;transition:font-size .4s`. Chevron (up-pointing `<path d="M18 15l-6-6-6 6"/>`, `16×16`, `stroke-width:2`) with `transform:{{ shChevRot }};transition:transform .3s`, `shChevRot = briefOpen ? 'rotate(180deg)' : 'none'`.
- Edit button `<sc-if value="{{ shEditBtn }}">` — same pencil button as the desktop list (`36×36`, `aria-label="Suchauftrag bearbeiten"`), handler `startEdit`.
- Rows `<sc-if value="{{ shRowsVisible }}">` → `display:flex;flex-direction:column;gap:2px;padding-top:6px;animation:rsFadeUp .25s ease both`, each row `data-fact-row="{{ f.id }}"`:
  `display:flex;align-items:center;gap:12px;min-height:40px;padding:4px 6px;border-radius:10px;font-size:16px;opacity:{{ f.opacity }};background:{{ f.bg }};transition:opacity .35s,background .5s`
  (Note: fixed `gap:12px` / `min-height:40px` / `font-size:16px` here — the sheet does **not** use `rowGap`/`rowFont`/`f.h`/`f.pad`.)
  Editing input: same as desktop but `padding:8px 10px`. Label span: `data-fact-label="{{ f.id }}"`, no ellipsis styling.
- Actions `<sc-if value="{{ shActions }}">` — `margin-top:14px;display:flex;flex-direction:column;align-items:center;gap:12px;animation:rsFadeUp .45s ease both`:
  **„Scout losschicken“** `width:100%;height:56px;border-radius:999px;border:0;background:#ff6926;color:#fff;font-size:17px;font-weight:600;box-shadow:0 8px 28px rgba(255,105,38,.25)`, hover `#ff7a3d`;
  caption `font-size:14px;line-height:1.5;color:#cbb9a8;text-align:center` → **„Ich suche und frage selbstständig an.“**`<br>`**„Eine verbindliche Zusage gibst nur du.“**;
  row `display:flex;gap:18px` → **„Noch etwas ändern“** / **„Zurück zum Gespräch“** (no hover style declared on the first one here).
- Edit actions `<sc-if value="{{ shEditing }}">` — `margin-top:14px;display:flex;gap:10px;justify-content:center` → **„Übernehmen“** / **„Abbrechen“**, same styles as the desktop card (no hover declared).

*shadcn candidate:* Drawer (vaul) or Sheet (side="bottom") + Collapsible for the row list; Button/Input for actions.

---

## 5. Stage A — Willkommen (`isWelcome`, `stage === 'welcome'`, lines 86–101)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 24px 40px;gap:0`

| # | Element | Copy | Style | Interaction |
|---|---|---|---|---|
| 1 | Blob anchor | — | `width/height:{{ welcomeBlob }}px` (168 / **128**), `margin-bottom:{{ welcomeBlobMb }}px` (56 / **36**) | — |
| 2 | Greeting | **„Hey {{ name }}.“** → „Hey Herzbuben.“ | `font-size:19px;color:#e2d3c3;animation:rsFadeUp .6s ease both` | — |
| 3 | Headline `h1` | **„Finden wir euren Proberaum.“** | `margin:14px 0 0;font-size:clamp(38px,6vw,64px);line-height:1.08;font-weight:300;letter-spacing:-.02em;max-width:640px;text-wrap:balance;animation:rsFadeUp .7s .1s ease both` | — |
| 4 | Primary CTA | **„Mit Scout sprechen“** | `margin-top:48px;height:60px;padding:0 34px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:19px;font-weight:600;display:flex;align-items:center;gap:12px;cursor:pointer;box-shadow:0 8px 32px rgba(255,105,38,.28);animation:rsFadeUp .7s .2s ease both;transition:transform .2s,background .2s`; hover `background:#ff7a3d;transform:translateY(-1px)`. Mic icon `20×20`, `stroke-width:1.9;stroke-linecap:round`, `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>` | `startVoice` → if `flags.voice` is false: `go('discovery',{mode:'text'})` **and** `showHint("Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus.")`; else `go('discovery',{mode:'voice',micOn:true})` |
| 5 | Secondary CTA | **„Lieber schreiben“** | `margin-top:22px;border:0;background:none;color:#d8c8b8;font:inherit;font-size:16px;display:flex;align-items:center;gap:10px;cursor:pointer;padding:8px 12px;border-radius:8px;animation:rsFadeUp .7s .3s ease both`; hover `color:#fff`. Keyboard icon `20×20`, `stroke-width:1.7`, `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>` | `startText` → `go('discovery',{mode:'text'})` |
| 6 | Footnote | **„Du erzählst. Dein Scout kümmert sich.“** | `margin-top:min(12vh,110px);font-size:15px;color:#b3a291` | — |

Note `#b3a291` is used only here.
**shadcn candidate:** Button (default, size lg, rounded-full) + Button (ghost) + custom typography block.

---

## 6. Stage B — Gespräch / Discovery (`isDiscovery`, lines 104–188)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 24px {{ discoveryPadBottom }}px`
`discoveryPadBottom = sheetVisible ? 96 : 32` — makes room for the mobile bottom sheet.

### 6.1 Blob anchor
`width/height:{{ discoveryBlob }}px;margin-bottom:28px;transition:width .6s,height .6s,margin .6s`
`discoveryBlob`: desktop voice `160`, desktop text `104`; **narrow** voice `120`, narrow text `88`. (`textMode = state.mode === 'text'`.)

### 6.2 Speaker line
`display:flex;align-items:center;gap:10px;font-size:15px;color:#cbb9a8;min-height:22px`
- `<span style="font-weight:500;color:#e2d3c3">{{ utterLabel }}</span>` — `"Dein Scout"` or `"Du"`; `""` once `convoEnded`.
- `<sc-if value="{{ scoutStateText }}">` → `<span style="color:#8f7e6e">·</span><span>{{ scoutStateText }}</span>`

`scoutStateText` (null while `convoEnded`) maps from `scoutState`: `speaking → null`, `listening → "Ich höre zu"` (or **„Mikro aus“** when `micOn === false`), `thinking → "Ich denke kurz nach"`, `idle → null`.
*shadcn candidate:* custom (or Badge for the state word).

### 6.3 Utterance area
Wrapper `min-height:170px;display:flex;align-items:center;justify-content:center;width:100%`.

**Utterance** `<sc-if value="{{ utter }}">` (`!!state.utter && !convoEnded`), `<p data-utter="1" aria-live="polite">`:
```
margin:12px 0 0;font-size:{{ utterSize }};line-height:1.16;font-weight:300;
letter-spacing:-.015em;max-width:{{ utterMaxWidth }};text-wrap:balance;color:#f8f0e7
```
Content: `{{ utterText }}` (the revealed words) followed by `<span style="opacity:0">{{ utterHidden }}</span>` — the not-yet-revealed remainder, invisible but **reserving layout width so the paragraph does not reflow** while typing.
`utterText = words.slice(0, shown).join(' ')`; `utterHidden = shown < words.length ? ' ' + words.slice(shown).join(' ') : ''`.

| `utterSize` | voice | text |
|---|---|---|
| desktop | `clamp(28px,3.6vw,46px)` | `clamp(24px,3vw,36px)` |
| **narrow** | `28px` | `24px` |

`utterMaxWidth` = `min(760px, calc(100vw - 660px))` when `!narrow && facts.length > 0` (keeps clear of the floating fact list), otherwise `760px`.

Reveal timing: per word `(scout ? 78 : 96) / sched.speed` ms via `setInterval`; hold after the reveal = `700 ms` for user lines, `min(5200, max(1800, words*260))` ms for scout lines. In text mode or reduced motion the whole line appears at once (`instant`, `revealMs = 0`). Each new utterance id triggers a 420 ms `opacity 0→1 / translateY(6px)→none` web-animation on `[data-utter]`.

**The full pacing chain (`runStep` → `showUtterance` → `afterUtterance` → `processFacts` → `runStep`)** — a builder needs all four hops, not just the reveal:

```
enter('discovery')                     → sched.after(500)   → runStep(0)

runStep(i):
  s = SCRIPT[i]; if (!s) return                         // no-op past the end of SCRIPT
  if (s.who === 'user' && mode === 'text')
      → { awaitingUser:true, suggestion:s.text, stepIndex:i, scoutState:'listening' }   // STOP, wait for the user
  else showUtterance(s, i, s.text)

showUtterance → sets utter/scoutState/stepIndex, appends to transcript,
                starts the word interval,
                sched.after(revealMs + hold) → afterUtterance(s, i)

afterUtterance(s, i):
  s.who === 'user'   → scoutState:'thinking'
                       processFacts(s.facts || [], 0, done)
                       done = () => sched.after(600) → runStep(i + 1)
  s.then === 'brief' → sched.after(500) → morphToBrief()
  otherwise (scout)  → sched.after(500) → runStep(i + 1)
```

So the gaps are: **500 ms** after a scout line before the next step; **500 ms** after the `then:'brief'` line before `morphToBrief()`; **600 ms** after a user line's facts have all landed before the next step; **300 ms** between two facts of the same utterance (§4.3 step 4). `scoutState` goes to `'thinking'` (`rsBreathe 2.4s`) for the whole fact-extraction window after every user line.

Note `runStep` returns silently when `SCRIPT[i]` is undefined — but `showUtterance`, `useSuggestion`, `submitDiscovery` and `demoNext` all dereference `SCRIPT[stepIndex].text` without that guard; see the `backToConvo` hazard in §7.

**Ended state** `<sc-if value="{{ convoEnded }}">` → `margin-top:12px;font-size:22px;font-weight:300;color:#e2d3c3;max-width:520px` → **„Gespräch beendet. Eure Wünsche bleiben als Entwurf gespeichert.“**
*shadcn candidate:* custom (live region).

### 6.4 Fact capsule
Row `height:48px;display:flex;align-items:center;justify-content:center;margin-top:6px`; inside, `<sc-if value="{{ capsule }}">`:
```
data-capsule="1"
display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;border-radius:999px;
background:rgba(255,105,38,.16);border:1px solid rgba(255,140,90,.5);color:#ffd9c4;
font-size:14px;font-weight:500;white-space:nowrap;animation:rsFadeUp .3s ease both
```
Content `{{ capsuleLabel }}` — the label of the fact currently flying (e.g. „Stuttgart“, „Bis 400 € / Monat“, „Geteilter Raum · 4 Personen“, „Donnerstags ab 19 Uhr“, „Schlagzeug darf im Raum bleiben“, „Bis 350 € / Monat“).
*shadcn candidate:* Badge (custom colours) — but the flight animation needs a real DOM clone, see §4.3.

### 6.5 Dead bindings (present in the template, permanently off)
`showSummaryChip` is hard-coded `false`, `summaryText` `''`, `briefOpenInline` `false`. Therefore the summary chip button (`data-fact-summary`, `margin-top:8px;height:36px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,200,160,.18);background:rgba(20,14,10,.55);color:#e2d3c3;font-size:14px` + chevron `14×14`) and the inline brief panel (`margin-top:10px;width:min(360px,100%);…;background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:16px;padding:14px 16px;gap:8px` with the uppercase label **„Euer Suchauftrag“** and one `font-size:15px;color:#f5ece2` row per fact) **never render**. Port them only if the summary chip is wanted back.

### 6.6 Voice controls — `<sc-if value="{{ voiceControls }}">` (`!textMode && !convoEnded`)

Row: `margin-top:36px;display:flex;gap:{{ ctrlGap }}px;align-items:flex-start` (`ctrlGap` 34 / **20**).
Each control is a column button: `display:flex;flex-direction:column;align-items:center;gap:10px;border:0;background:none;color:#e2d3c3;font:inherit;font-size:{{ ctrlFont }}px;cursor:pointer;padding:0` (`ctrlFont` 14 / **12.5**). Circle: `width/height:{{ ctrl }}px` (76 / **60**), `border-radius:50%`.

1. **Mic** — circle `background:{{ micBg }};border:1px solid {{ micBorder }};display:flex;align-items:center;justify-content:center;color:#fff;transition:background .3s;box-shadow:{{ micShadow }}`.
   `micOn` → `micBg:#ff6926`, `micBorder:#ff6926`, `micShadow:0 6px 24px rgba(255,105,38,.3)`; `micOn=false` → `rgba(255,255,255,.07)`, `rgba(255,220,190,.16)`, `none`.
   Icon `26×26`, `stroke-width:1.8;stroke-linecap:round`, `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>` plus, when `micOff`, the strike `<path d="M4 4l16 16"/>`.
   Label `{{ micLabel }}` = **„Mikro an“** / **„Mikro aus“**. Handler `toggleMic` (also flips `scoutState` between `listening` and `idle` when a user line is playing).
2. **Transcript** — circle `background:rgba(255,255,255,.07);border:1px solid rgba(255,220,190,.16);color:#f5ece2`, hover `background:rgba(255,255,255,.12)`; icon `24×24`, `stroke-width:1.7`, `<rect x="4" y="5" width="16" height="12" rx="3"/><path d="M8 10h8M8 13h5"/><path d="M9 17l-2 3"/>`. Label **„Mitschrift“**. Handler `toggleTranscript`.
3. **End** — circle `background:#b8382a;color:#fff`, hover `background:#c9463a`; X icon `24×24`, `stroke-width:2`. Label **„Gespräch beenden“**. Handler `endConvo` → pauses the scheduler, stops the reveal, sets `convoEnded:true`, `scoutState:'idle'`, `capsule:null`.

Below the row: **„Zum Schreiben wechseln“** — `margin-top:26px;border:0;background:none;color:#a89684;font:inherit;font-size:14px;cursor:pointer;padding:6px 10px;border-radius:6px`, hover `color:#f5ece2`; handler `switchToText` → `mode:'text'`.
*shadcn candidate:* Button (variant ghost, size icon, rounded-full) ×3 with a label underneath — a small custom `IconStack` wrapper; Toggle for the mic if a pressed state is wanted.

### 6.7 Text controls — `<sc-if value="{{ textControls }}">` (`textMode && !convoEnded`)

Column: `margin-top:22px;width:min(640px,100%);display:flex;flex-direction:column;align-items:center;gap:12px`.

- **Suggestion chip** `<sc-if value="{{ suggestion }}">` (only while `awaitingUser`; the value is the scripted user line):
  `border:1px solid rgba(255,140,90,.4);background:rgba(255,105,38,.12);color:#ffd9c4;font:inherit;font-size:14px;padding:8px 14px;border-radius:999px;cursor:pointer;animation:rsFadeUp .3s ease both;text-align:left`, hover `background:rgba(255,105,38,.22)`. Handler `useSuggestion` → plays the scripted line.
  Possible values, from the four `who:'user'` entries of `SCRIPT` (indices 1, 3, 5, 6): **„Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat.“**, **„Donnerstags ab 19 Uhr wäre gut.“**, **„Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit.“**, **„Und beim Budget lieber maximal 350 Euro.“** — plus one value that is **not** from `SCRIPT`: **„Ja, leg los.“**, set literally by `backToConvo` (§7). On that path `stepIndex` is `SCRIPT.length` (= 8) while `SCRIPT` has only indices 0–7, so `useSuggestion` / `submitDiscovery` / `demoNext` all throw. See the hazard note in §7 for the resolution the port must take.
- **Composer** `<form onSubmit="{{ submitDiscovery }}">`:
  `width:100%;display:flex;align-items:center;gap:8px;height:60px;padding:0 8px 0 18px;border-radius:999px;background:rgba(20,14,10,.6);border:1px solid rgba(255,200,160,.16);backdrop-filter:blur(6px)`
  - leading keyboard icon `20×20`, `stroke:#a89684`, `stroke-width:1.7`
  - `<input value="{{ draft }}" onChange="{{ onDraft }}" placeholder="{{ discoveryPlaceholder }}" aria-label="Nachricht an deinen Scout" style="flex:1;min-width:0;background:none;border:0;color:#f5ece2;font:inherit;font-size:16px;outline:none;padding:0 6px">`
    `discoveryPlaceholder` = **„Antwort an deinen Scout …“** while `awaitingUser`, otherwise **„Dein Scout spricht …“**
  - send button `type="submit" aria-label="Senden"` `width:44px;height:44px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#f5ece2`, hover `background:rgba(255,255,255,.14)`; paper-plane `18×18`, `stroke-width:1.8;stroke-linejoin:round`, `<path d="M4 12l16-8-6 16-2.5-6.5z"/>`
  - voice button `type="button" aria-label="Zum Sprechen wechseln" title="Zum Sprechen wechseln"` `width:44px;height:44px;border-radius:50%;border:0;background:#ff6926;color:#fff`, hover `#ff7a3d`; mic icon `18×18`, `stroke-width:1.9`. Handler `switchToVoice`:
    ```js
    this.setState({ mode: 'voice', micOn: true });
    if (s.awaitingUser) S.after(400, () => {
      const st = this.state;
      if (st.awaitingUser) this.showUtterance(SCRIPT[st.stepIndex], st.stepIndex, SCRIPT[st.stepIndex].text);
    });
    ```
    i.e. it does three things, not one: switches the mode, **force-enables the mic** (`micOn:true`, regardless of its previous value), and — if the dialogue was parked waiting for a typed answer — **auto-plays the pending scripted user line after 400 ms**, so switching to voice resumes the conversation by itself. (`awaitingUser` is re-checked inside the timer, so a user who answers within those 400 ms is not double-played.)
  `submitDiscovery`: empty → ignore; not `awaitingUser` → `showHint("Der Scout ist noch nicht fertig. Gleich kannst du antworten.")`; text loosely matching the scripted line (≥2 shared words >3 chars, or 1 shared word plus the reference number) → the typed text is played as the user utterance; otherwise `showHint("Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich.")`.
- **Link row** `display:flex;gap:18px;font-size:14px`, each `border:0;background:none;color:#a89684;font:inherit;cursor:pointer;padding:6px 8px`, hover `color:#f5ece2`: **„Mitschrift“** (`toggleTranscript`) and **„Gespräch beenden“** (`endConvo`).

*shadcn candidate:* Input inside a custom rounded composer, Button (icon) ×2, Badge/Button (chip) for the suggestion.

### 6.8 Ended actions — `<sc-if value="{{ convoEnded }}">`
`margin-top:30px;display:flex;gap:12px;flex-wrap:wrap;justify-content:center`
- **„Gespräch fortsetzen“** `height:50px;padding:0 24px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:16px;font-weight:600`, hover `#ff7a3d`; handler `resumeConvo`:
  ```js
  this.setState({ convoEnded: false,
                  scoutState: s.utter ? (s.utter.who === 'scout' ? 'speaking' : 'listening') : 'idle' });
  if (!s.demoPaused) S.resume();
  if (s.awaitingUser === false && !s.utter) S.after(300, () => this.runStep(s.stepIndex));
  ```
  So it (a) restores `scoutState` from the **speaker of the frozen utterance** — `speaking` for a scout line, `listening` for a user line, `idle` when nothing was mid-flight; (b) resumes the scheduler only when the demo bar has not paused it; and (c) re-arms `runStep(stepIndex)` after **300 ms only** when there is no frozen utterance *and* the flow was not parked on `awaitingUser` (in text mode the suggestion chip is already on screen and the user drives the next step). Note `endConvo` pauses the scheduler and stops the reveal but does **not** clear pending timers, so a mid-reveal utterance resumes exactly where it stopped.
- **„Suchauftrag ansehen“** `<sc-if value="{{ hasFacts }}">` `height:50px;padding:0 24px;border-radius:999px;border:1px solid rgba(255,220,190,.3);background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:16px`, hover `background:rgba(255,255,255,.1)`; handler `viewBrief` → jumps straight to `brief_review` with `listMode:'card'`, `headlineShown:true`, `cardArrived:true`.

*shadcn candidate:* Button (default) + Button (outline).

---

## 7. Stage C — Suchauftrag / Brief (`isBrief`, `stage === 'brief_review'`, lines 191–197)

The stage view itself is deliberately almost empty — the content is the morphed fact **card** (desktop, §4.2) or the **bottom sheet** (narrow, §4.4). The stage only supplies the blob anchor, the headline and a spacer that reserves the card's footprint in the scroll flow.

Container: `display:flex;flex-direction:column;align-items:center;text-align:center;padding:30px 24px 40px` (no `min-height:100%` here).

| Element | Copy | Style |
|---|---|---|
| Blob anchor | — | `width:96px;height:96px` |
| Headline `h1` | **„So suche ich für euch.“** | `margin:22px 0 0;font-size:clamp(34px,4.6vw,52px);line-height:1.1;font-weight:300;letter-spacing:-.02em;opacity:{{ headlineOpacity }};transition:opacity .5s` |
| Spacer | — | `height:{{ briefSpacerHeight }}px` |

- `headlineOpacity` = `1` once `state.headlineShown`, else `0`. `morphToBrief()` sets `headlineShown` after **450 ms** and `cardArrived` after **950 ms**.
- `briefSpacerHeight` = **narrow: `40`**; desktop: `60 + facts.length * 56 + 240` (with the five final facts → `580`).

Entry paths: the scripted scout line with `then:'brief'` (via `morphToBrief`), the „Suchauftrag ansehen“ button (`viewBrief`), or the demo chapter select.

Exit paths:
- `startScouting` → `scouting`. **Guarded**: `if (this.state.stage !== 'brief_review') return;` — it is a no-op from any other stage. Then `sched.clear()`, `listMode:'leaving'` (→ `'hidden'` after 600 ms), `status = START_LINE`, `scoutState:'speaking'`, the line pushed to the transcript, `activity = [ACT.start]`, `editing:false`, and `scheduleScouting(3800)`.
- `backToConvo` → `discovery`: `sched.clear()`, then `{ stage:'discovery', listMode:'float', cardArrived:false, headlineShown:false, editing:false, utter:null, scoutState:'listening', awaitingUser:true, suggestion:'Ja, leg los.', stepIndex: SCRIPT.length }`.

> **Hazard — `backToConvo` leaves the script index out of range.** `SCRIPT.length` is **8** and `SCRIPT` has indices **0–7**. Every consumer of `stepIndex` dereferences `SCRIPT[stepIndex].text` **without a guard** — `useSuggestion()`, `submitDiscovery()` (`const ref = SCRIPT[s.stepIndex].text`) and `demoNext()` (its `awaitingUser` branch). So in the prototype, „Zurück zum Gespräch“ followed by clicking the „Ja, leg los.“ chip, typing an answer, or pressing the demo bar's step button throws a `TypeError` and the surface stops. The source has no recovery path; the doc must not describe this as working behaviour.
>
> **Resolution for the port** (choose one, deliberately — the prototype does not define it):
> a. treat `stepIndex >= SCRIPT.length` as „end of script“: the chip „Ja, leg los.“ plays as a *synthetic* user utterance (`{ who:'user', text:'Ja, leg los.' }`, no `facts`) and `afterUtterance` goes straight to `morphToBrief()` — this matches the intent (the user is re-confirming the brief); or
> b. make „Zurück zum Gespräch“ a pure view switch that re-parks on the last real step (`stepIndex: SCRIPT.length - 1`, suggestion „Ja, leg los.“ replaced by that step's own text).
> Option (a) preserves the visible copy „Ja, leg los.“ and is the recommended one. Whichever is chosen, guard every `SCRIPT[i]` read.

**shadcn candidate:** custom (headline) — the interactive part is the Card in §4.2.

---

## 8. Stage D — Autopilot (`isAutopilot`, `stage ∈ {scouting, waiting, following_up}`, lines 200–264)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 24px 32px`

### 8.1 Head
- Blob anchor `width/height:{{ autoBlob }}px` (160 / **112**), `margin-bottom:{{ autoBlobMb }}px` (48 / **30**).
- `h1` **„Ich kümmere mich darum.“** — `margin:0;font-size:{{ autoH1 }};line-height:1.08;font-weight:300;letter-spacing:-.02em;text-wrap:balance`. `autoH1` = `clamp(36px,5vw,58px)` desktop, **`34px`** narrow.
- Status `<p data-status="1" aria-live="polite">` — `margin:22px 0 0;font-size:clamp(17px,1.6vw,22px);line-height:1.45;color:#e2d3c3;max-width:560px;min-height:32px;text-wrap:balance` → `{{ status }}`. Every status change replays a 420 ms fade-up on `[data-status]`.

`status` values (all German copy, see dictionary): `START_LINE`, `STATUS[0..3]`, `FOLLOW_STATUS`, `ALT_STATUS`, the three `attemptContact` blockers, the compromise lines, `"Ich suche erneut mit den neuen Kriterien."`, `"Ich frage beim <Raumname> nach einem Angebot und kläre die Details."`, `"Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt."`, `"Alles klar, ich suche im Hintergrund weiter und melde mich."`.
*shadcn candidate:* custom (live region) — optionally Skeleton/Progress if a progress affordance is wanted; the prototype has none.

### 8.2 Resume button — `<sc-if value="{{ searchPaused }}">`
**„Fortsetzen“** — `margin-top:16px;height:44px;padding:0 20px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer`, hover `#ff7a3d`. Handler `toggleSearchPause`.
*shadcn candidate:* Button.

### 8.3 Approval card — `<sc-if value="{{ pending }}">`

Shown when `rules.mode === 'review'` or `rules.contact === false`, i.e. the Scout drafted an outreach message and needs a release.

> **Not reachable in the default flow.** `RULES0 = { mode:'autopilot', contact:true, … }` (§15.0), so `attemptContact()` falls straight through to `contactAndWait()`. This card, `state.pending`, `waitingFor:'release'` and the toast „Dein Scout wartet auf deine Freigabe“ only appear after the user switches the Handlungsspielraum in Settings → Autonomie (`mode:'review'`, or `contact:false`).

`attemptContact()` — the single gate in front of this card — runs in this exact order (see §15 for the timeline position):

```js
attemptContact() {
  const st = this.state;
  if (!AUTOPILOT.includes(st.stage) || st.activity.some(a => a === ACT.contacted)) return;   // guard
  const src = st.sources.find(s => s.id === 'roomscout');
  if (!this.usableSources(st).length || !src.enabled) {          // → §8.4
    setState({ status: 'Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen.',
               waitingFor: 'source', pending: null }); return; }
  if (src.access !== 'connected') {                              // → §8.5
    setState({ status: 'Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann.',
               waitingFor: 'access', pending: null }); return; }
  if (st.rules.mode === 'review' || !st.rules.contact) {         // → this card
    setState({ pending: { to, text, reason: !st.rules.contact ? 'contact' : 'review' },
               status: 'Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst.',
               waitingFor: 'release' });
    this.notify('Dein Scout wartet auf deine Freigabe'); return; }
  this.contactAndWait();
}
```

Note the two guards: it is a no-op outside `AUTOPILOT` **and** a no-op once `ACT.contacted` is already in the activity log (so it cannot fire twice). `usableSources(st) = sources.filter(s => s.enabled && (s.kind === 'portal' || flags.publicSearch))`.

Releasing (`releaseMessage` → `contactAndWait()`) applies **four immediate state changes before any timer**:
`status = STATUS[2]` (**„Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.“**), `pending: null`, `waitingFor: null`, and `activity + ACT.contacted` (**„Anbieter über das Portal kontaktiert“**). Only then the 3000 ms → `waiting`/`STATUS[3]` and 10000 ms → `arriveReply()` timers are armed.

`toggleSource` and `setAccess` (both Settings actions) call `attemptContact()` again in their `setState` callback when `waitingFor` is `'source'` / `'access'` — so fixing the blocker in Settings resumes the flow without returning to the Scout view.

```
margin-top:26px;width:min(680px,100%);text-align:left;
background:rgba(18,14,12,.72);border:1px solid rgba(255,140,90,.3);border-radius:20px;
padding:24px 26px;animation:rsFadeUp .4s ease both
```
- Eyebrow **„Freigabe nötig“** — `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#ff8a4e;font-weight:500`
- Recipient line `margin-top:10px;font-size:14px;color:#a89684` → **„An: “** + `<span style="color:#e2d3c3">{{ pendingTo }}</span>`; `pendingTo` = **„Anbieter · Raum in Stuttgart-West · roomscout.dev“**
- Message body `margin-top:12px;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,.04);font-size:15px;line-height:1.55;color:#f5ece2` → `{{ pendingText }}`, generated as:
  `"Hallo, wir sind " + name + ", eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, " + budget.replace('Bis','bis') + ", donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, " + name + " (über RoomScout)"`
- `<sc-if value="{{ pendingContactOff }}">` (`pending.reason === 'contact'`) → `margin-top:10px;font-size:13.5px;color:#cbb9a8` → **„Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe raus.“**
- Actions `margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap`:
  **„Nachricht freigeben“** `height:46px;padding:0 22px;border-radius:999px;border:0;background:#ff6926;color:#fff;font-size:15px;font-weight:600`, hover `#ff7a3d`; handler `releaseMessage` → `contactAndWait()`.
  **„Handlungsspielraum ändern“** `border:0;background:none;color:#d8c8b8;font-size:14px;padding:8px 10px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35)`, hover `color:#fff`; handler `openAutonomy` → `openSettings('autonomy')`.

*shadcn candidate:* Card + CardHeader (eyebrow as Badge) + Button + Button(link).

### 8.4 Blocked-source button — `<sc-if value="{{ waitingSource }}">` (`waitingFor === 'source'`)
**„Quelle auswählen“** — `margin-top:14px;height:44px;padding:0 20px;border-radius:999px;border:1px solid rgba(255,220,190,.3);background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:15px`, hover `background:rgba(255,255,255,.1)`; handler `openSources` → `openSettings('sources')`.
*shadcn candidate:* Button (outline).

### 8.5 Blocked-access row — `<sc-if value="{{ waitingAccess }}">`
`waitingAccess = waitingFor === 'access' || (isAutopilot && sources.roomscout.access !== 'connected')`.
```
margin-top:14px;display:flex;align-items:center;gap:10px;font-size:14px;color:#e2d3c3;flex-wrap:wrap;justify-content:center
```
- Dot `width:8px;height:8px;border-radius:50%;background:#e0a13a`
- Text **„Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung.“**
- Link **„Zu den Zugängen“** — `border:0;background:none;color:#f5ece2;font-size:14px;padding:4px 6px;text-decoration:underline;text-underline-offset:4px`, hover `color:#ff8a4e`; handler `openSources`.
*shadcn candidate:* Alert (variant warning) — or custom inline row.

### 8.6 Brief pill + panel
Button `data-fact-summary="1"`, handler `toggleBrief`:
```
margin-top:34px;height:50px;padding:0 20px;border-radius:999px;
border:1px solid rgba(255,200,160,.18);background:rgba(20,14,10,.55);color:#f5ece2;
font:inherit;font-size:16px;display:flex;align-items:center;gap:10px;cursor:pointer
hover → background:rgba(30,22,16,.7)
```
Content: magnifier `18×18` `stroke-width:1.8` `<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>`, then `{{ compactBrief }}`, then chevron-down `14×14` `stroke-width:2` with `transform:{{ chevRot }};transition:transform .3s` (`chevRot = briefOpen ? 'rotate(180deg)' : 'none'`).

`compactBrief = "Stuttgart · " + budgetLabel.replace('Bis ','bis ').replace(' / Monat','')` → normally **„Stuttgart · bis 350 €“** (after the „Budget bis 400 €“ compromise: **„Stuttgart · bis 400 €“**).

Panel `<sc-if value="{{ briefOpen }}">`:
```
margin-top:10px;width:min(380px,100%);text-align:left;background:rgba(18,14,12,.72);
border:1px solid rgba(255,200,160,.14);border-radius:16px;padding:14px 18px;
display:flex;flex-direction:column;gap:9px;animation:rsFadeUp .3s ease both
```
- Label **„Euer Suchauftrag“** — `font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a89684`
- One row per fact: `font-size:15px;color:#f5ece2;padding:2px 0;border-radius:6px;background:{{ f.bg }};transition:background .5s` → `{{ f.label }}` (icons are **not** rendered here)
*shadcn candidate:* Collapsible + CollapsibleTrigger(Button) + Card.

### 8.7 Activity list
Toggle button: `margin-top:22px;border:0;background:none;color:#d8c8b8;font:inherit;font-size:15px;display:flex;align-items:center;gap:9px;cursor:pointer;padding:8px 12px;border-radius:8px`, hover `color:#fff`; clock icon `18×18` `stroke-width:1.7` `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`; label `{{ activityLabel }}` = **„Aktivität ansehen“** / **„Aktivität ausblenden“**. Handler `toggleActivity`.

Panel `<sc-if value="{{ activityOpen }}">`:
```
width:min(420px,100%);text-align:left;background:rgba(18,14,12,.6);
border:1px solid rgba(255,200,160,.12);border-radius:16px;padding:16px 20px;
display:flex;flex-direction:column;gap:0;animation:rsFadeUp .3s ease both
```
Each entry `<sc-for list="{{ activity }}" as="a">`:
`display:grid;grid-template-columns:14px 1fr;gap:12px;align-items:start;padding:7px 0`
- dot `margin-top:6px;width:8px;height:8px;border-radius:50%;background:{{ a.dot }};justify-self:center` — `a.dot` is `#ff6926` for the **last** entry, `rgba(255,220,190,.35)` for all earlier ones
- `{{ a.text }}` `font-size:15px;color:#f5ece2`; optional `{{ a.meta }}` `font-size:12.5px;color:#a89684;margin-top:2px`

Activity texts (`ACT` / `ACT2` / dynamic):
`"Suchauftrag gestartet"`, `"Raum in Stuttgart-West gefunden"` (meta `"roomscout.dev · Demo-Portal"`), `"Anbieter über das Portal kontaktiert"`, `"Warte auf Antwort"`, `"Benachrichtigung aus dem Portal erhalten"`, `"Neue Nachricht im Portal gelesen"`, `"Mittwoch bestätigt, Angebot angefragt"`, `"Alternative zu Mittwoch angefragt"`, `"Angebot eingegangen"`, `"Anbieter hat abgesagt: Donnerstag nicht möglich"`, `"Kein weiterer passender Raum in Stuttgart gefunden"`, `"Drei Räume zum Vergleich zusammengestellt"` (meta `"roomscout.dev · Demo-Portal"`), `"Suchauftrag angepasst: <label>"`, `"Angebot angefragt: <short>"`.
*shadcn candidate:* Collapsible + a custom timeline list (Separator optional). Not a Table.

### 8.8 Side-note composer
`<form onSubmit="{{ submitSideNote }}">`:
```
margin-top:42px;width:min(660px,100%);display:flex;align-items:center;gap:8px;height:62px;
padding:0 8px 0 20px;border-radius:999px;background:rgba(20,14,10,.6);
border:1px solid rgba(255,200,160,.16);backdrop-filter:blur(6px)
```
- keyboard icon `20×20`, `stroke:#a89684`, `stroke-width:1.7`
- divider `width:1px;height:22px;background:rgba(255,220,190,.16)`
- `<input value="{{ sideDraft }}" onChange="{{ onSideDraft }}" placeholder="Möchtest du mir noch etwas sagen?" aria-label="Nachricht an deinen Scout" style="flex:1;min-width:0;background:none;border:0;color:#f5ece2;font:inherit;font-size:16px;outline:none;padding:0 6px">`
- mic button `type="button" aria-label="Mit Scout sprechen"` `width:46px;height:46px;border-radius:50%;border:0;background:#ff6926;color:#fff`, hover `#ff7a3d`; icon `18×18` `stroke-width:1.9`. Handler `sideVoice` → `showHint("Prototyp: Das Mikrofon ist simuliert. Die Demo läuft ohne Spracheingabe weiter.")`.
- `submitSideNote`: non-empty → clears the draft and `showHint("Prototyp: Zusätzliche Hinweise werden hier nicht interpretiert. Der Scout arbeitet mit dem Suchauftrag weiter.")`.

Footer line `margin-top:22px;font-size:14px;color:#a89684` → **„Du kannst die App schließen. Ich melde mich.“**
*shadcn candidate:* Input + Button (icon) in a custom rounded composer.

---

## 9. Stage E — Rückfrage / Clarification (`isClarification`, lines 267–302)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 24px 32px`

- Blob anchor `width:118px;height:118px;margin-bottom:34px`
- `h1` **„Eine kurze Rückfrage.“** — `margin:0;font-size:clamp(34px,4.6vw,52px);line-height:1.1;font-weight:300;letter-spacing:-.02em`

**Question card**
```
margin-top:28px;width:min(740px,100%);background:rgba(18,14,12,.66);
border:1px solid rgba(255,200,160,.14);border-radius:22px;padding:34px 36px 30px;
animation:rsFadeUp .5s ease both
```
- Eyebrow **„Raum in Stuttgart-West“** — `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684` (hard-coded, not bound to the offer)
- Question **„Donnerstag ist leider belegt. Wäre Mittwoch ab 19 Uhr auch möglich?“** — `margin-top:14px;font-size:clamp(24px,2.6vw,34px);line-height:1.2;font-weight:300;letter-spacing:-.01em;text-wrap:balance`
- Detail **„280 € inklusive Nebenkosten. Euer Schlagzeug kann im Raum bleiben.“** — `margin-top:16px;font-size:16px;color:#cbb9a8`
- Answer buttons `<sc-if value="{{ clarUnanswered }}">` (`!clar.userText`) — `margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center`
  - **„Ja, Mittwoch passt“** `height:46px;padding:0 20px;border-radius:999px;border:1px solid rgba(255,140,90,.45);background:rgba(255,105,38,.14);color:#ffe0cf;font:inherit;font-size:15px;font-weight:500`, hover `background:rgba(255,105,38,.26)`; handler `clarYes` → `answerClar(true, "Ja, Mittwoch passt auch.")`
  - **„Nein, Donnerstag ist wichtig“** `height:46px;padding:0 20px;border-radius:999px;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:15px`, hover `background:rgba(255,255,255,.1)`; handler `clarNo` → `answerClar(false, "Nein, Donnerstag ist wichtig.")`

**Conversation strip** `width:min(740px,100%);display:flex;flex-direction:column;gap:12px;margin-top:18px;min-height:0`
- `<sc-if value="{{ clarUserText }}">` bubble: `align-self:flex-end;max-width:80%;padding:14px 20px;border-radius:18px 18px 4px 18px;background:rgba(120,58,22,.75);border:1px solid rgba(255,140,90,.35);font-size:17px;text-align:left;animation:rsFadeUp .35s ease both`
- `<sc-if value="{{ clarScoutText }}">` reply (no bubble): `align-self:flex-start;max-width:80%;font-size:18px;text-align:left;padding:6px 4px;animation:rsFadeUp .35s ease both`
  Replies: yes → **„Alles klar, Mittwoch geht also auch. Ich kläre den Rest.“**; no → **„Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter.“** (appears 650 ms after the answer).

**Reply composer** `<sc-if value="{{ clarUnanswered }}">` — `margin-top:22px;width:min(740px,100%);display:flex;gap:10px;align-items:center;flex-wrap:wrap`
- `<form onSubmit="{{ submitClar }}">` `flex:1;min-width:240px;display:flex;align-items:center;gap:8px;height:58px;padding:0 8px 0 18px;border-radius:999px;background:rgba(20,14,10,.6);border:1px solid rgba(255,200,160,.16)`
  - `<input value="{{ clarDraft }}" onChange="{{ onClarDraft }}" placeholder="Nachricht an deinen Scout …" aria-label="Antwort an deinen Scout" style="flex:1;min-width:0;background:none;border:0;color:#f5ece2;font:inherit;font-size:16px;outline:none">`
  - send button `aria-label="Senden"` `width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.08)`, hover `rgba(255,255,255,.14)`, paper-plane `18×18`
  `submitClar`: matches `/\bnein\b|nicht|donnerstag ist wichtig/` → no; matches `/mittwoch|\bja\b|passt|ok|gern|klar/` → yes; otherwise `showHint("Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“.")`
- **„Sprechen“** button `height:58px;padding:0 22px;border-radius:999px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:15px;font-weight:500;display:flex;align-items:center;gap:10px`, hover `background:rgba(255,255,255,.1)`; mic icon `18×18` `stroke-width:1.9`. Handler `clarVoice` → `showHint("Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text.")`.

**After the answer** (2300 ms): yes → `following_up` with `FOLLOW_STATUS` and the `zeit` fact rewritten to **„Mittwoch oder Donnerstag ab 19 Uhr“** (flashed `changed`), offer arrives after another 5000 ms; no → `waiting` with `ALT_STATUS`, dead end after another 6000 ms.

*shadcn candidate:* Card + Button ×2 + Input + Button — the chat bubbles are custom.

---

## 10. Stage F — Angebot / Offer (`isOffer`, lines 305–355)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px 24px 32px`

- `h1` **„Ein Raum, der zu euch passt.“** — `margin:0 0 30px;font-size:clamp(34px,4.6vw,52px);line-height:1.1;font-weight:300;letter-spacing:-.02em;animation:rsFadeUp .6s ease both`

### 10.1 Stale banner — `<sc-if value="{{ offerStale }}">`

`offerStale` is set in exactly **one** place: `updateFact(id, label)`, which is exposed only as `settingsActions.updateFact` — the Settings surface's fact editor.
```js
offerStale: st.offerStale || ['offer', 'offer_review'].includes(st.stage)
```
It is therefore reachable **only** by correcting a fact in **Settings** while the stage is `offer` or `offer_review`. The brief card's / bottom sheet's own „Übernehmen“ (`saveEdit`) does **not** set it (see the table in §4), and neither do `answerClar` or `compromise`. It is cleared only by `baseFor()`, i.e. by a stage jump through `go()`.
```
margin:-12px 0 22px;display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:12px;
background:rgba(224,161,58,.12);border:1px solid rgba(224,161,58,.35);font-size:14px;color:#f5ece2
```
Dot `width:8px;height:8px;border-radius:50%;background:#e0a13a;flex:none`; text **„Nach deiner Änderung muss das Angebot erneut geprüft werden.“**; link **„Angaben ansehen“** `border:0;background:none;color:#f5ece2;font-size:14px;padding:2px 4px;text-decoration:underline;text-underline-offset:4px`, hover `color:#ff8a4e`, handler `openKnowledge` → `openSettings('knowledge')`.
*shadcn candidate:* Alert.

### 10.2 Offer card
```
width:min(1190px,100%);display:grid;grid-template-columns:{{ offerCols }};
background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:24px;
overflow:hidden;text-align:left;animation:rsFadeUp .7s .1s ease both
```
`offerCols` = `minmax(0,1fr) minmax(0,1.05fr)` desktop, **`1fr`** narrow.

**Media cell**
- `<sc-if value="{{ offerHasPhoto }}">` → `<img src="{{ offerPhoto }}" alt="Proberaum mit Schlagzeug und Akustikpaneelen" style="display:block;width:100%;height:100%;min-height:{{ offerImgMin }}px;max-height:{{ offerImgMax }}px;object-fit:cover">`
  `offerImgMin` = 380 / **200**, `offerImgMax` = 470 / **240**. `offerPhoto` = `offer.photo || 'assets/proberaum.png'`.
- `<sc-if value="{{ offerNoPhoto }}">` → `min-height:{{ offerImgMin }}px;height:100%;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#a89684` → **„Foto folgt vom Anbieter“**

**Body cell** `padding:clamp(24px,3vw,44px) clamp(24px,3.4vw,56px);display:flex;flex-direction:column;justify-content:center;min-width:0`
| Element | Copy | Style |
|---|---|---|
| Eyebrow | **„Angebot eingegangen“** | `font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#ff8a4e;font-weight:500` |
| Title | `{{ offerTitle }}` = `"Euer " + offer.name` → **„Euer Raum in Stuttgart-West“** | `margin-top:18px;font-size:clamp(24px,2.4vw,32px);font-weight:400;letter-spacing:-.01em` |
| Price | `{{ offerPriceNum }}` (= `offer.price.split(' ')[0] + ' €'` → **„280 €“**) + `<span style="font-size:.6em;color:#e2d3c3">/ Monat</span>` | `margin-top:6px;font-size:clamp(38px,3.8vw,52px);font-weight:400;letter-spacing:-.02em;line-height:1.1` |
| Price note | **„inklusive Nebenkosten“** | `margin-top:6px;font-size:18px;color:#cbb9a8` |
| Terms list | 2 rows: `{{ offerTime }}` (**„Mittwochs, 19–22 Uhr“**) and `{{ offerStorage }}` (**„Schlagzeug kann im Raum bleiben“**) | wrapper `margin-top:24px;display:flex;flex-direction:column;gap:10px;font-size:17px`; each row `display:flex;align-items:center;gap:12px` with a check `18×18` `stroke:#ff6926;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round` `<path d="M5 12.5l4.5 4.5L19 7.5"/>` |
| CTA | **„Angebot prüfen“** | `margin-top:30px;align-self:flex-start;height:54px;padding:0 40px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:17px;font-weight:600;cursor:pointer;box-shadow:0 8px 28px rgba(255,105,38,.25)`, hover `#ff7a3d`; handler `reviewOffer` → clears the scheduler, `stage:'offer_review'`, `offerTalk:null`, `briefOpen:false` |
| Footnote | **„Vor einer Zusage schauen wir uns alle Konditionen an.“** | `margin-top:16px;font-size:14px;color:#a89684` |

*shadcn candidate:* Card (grid layout) + AspectRatio for the image + Button + Badge for the eyebrow.

### 10.3 Explain row (this is where the blob lives on this stage)
`margin-top:34px;display:flex;flex-direction:column;align-items:center;gap:16px`
- Row `display:flex;align-items:center;gap:22px;flex-wrap:wrap;justify-content:center`: blob anchor `width:58px;height:58px` + `{{ offerPrompt }}` `font-size:19px`.
  `offerPrompt` = **„Soll ich euch das Angebot erklären?“** before, **„Dein Scout“** once `offerTalk` is set.
- `<sc-if value="{{ offerTalk }}">` → `max-width:620px;font-size:17px;line-height:1.5;color:#f5ece2;animation:rsFadeUp .4s ease both` → `OFFER_TALK` (**„Das Angebot liegt bei 280 Euro inklusive Nebenkosten. …“**)
- `<sc-if value="{{ offerTalkHidden }}">` → **„Mit Scout sprechen“** button `height:52px;padding:0 24px;border-radius:999px;border:1px solid rgba(255,220,190,.3);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:16px;font-weight:500;display:flex;align-items:center;gap:10px`, hover `background:rgba(255,255,255,.1)`; mic icon `18×18`. Handler `talkOffer` → sets `offerTalk` + `scoutState:'speaking'`, back to `idle` after 6500 ms.
*shadcn candidate:* Button (outline) + custom text block.

### 10.4 Brief panel + pill (order is inverted here: panel above the pill)
- `<sc-if value="{{ briefOpen }}">` panel — `margin-top:28px;width:min(380px,100%);text-align:left;background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:16px;padding:14px 18px;display:flex;flex-direction:column;gap:9px;animation:rsFadeUp .3s ease both`; label **„Euer Suchauftrag“** (`font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#a89684`); rows `font-size:15px` → `{{ f.label }}`.
- Pill `data-fact-summary="1"` — `margin-top:{{ offerPillTop }}px;height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,200,160,.16);background:rgba(20,14,10,.5);color:#d8c8b8;font:inherit;font-size:15px;display:flex;align-items:center;gap:10px;cursor:pointer`, hover `color:#fff`. `offerPillTop` = `10` when `briefOpen`, else `34`.
  Content: list icon `16×16` `stroke-width:1.8` `<path d="M5 7h14M5 12h14M5 17h9"/>`, label **„Suchauftrag“**, chevron-**up** `14×14` `stroke-width:2` `<path d="M6 15l6-6 6 6"/>` with `transform:{{ chevRotUp }}` (`rotate(180deg)` when open). Handler `toggleBrief`.
*shadcn candidate:* Collapsible + Button.

---

## 11. Stage G — Prüfung / Review (`isReview`, `stage === 'offer_review'`, lines 358–412)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px 24px 32px`

- Blob anchor `width:64px;height:64px;margin-bottom:22px`
- `h1` **„Passt das für euch?“** — `margin:0 0 26px;font-size:clamp(34px,4.6vw,52px);line-height:1.1;font-weight:300;letter-spacing:-.02em`

**Review card**
```
width:min(720px,100%);background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);
border-radius:24px;padding:28px clamp(22px,3vw,36px) 30px;text-align:left;
animation:rsFadeUp .5s ease both
```
- Head row `display:flex;align-items:center;gap:18px` — it has exactly **two** flex children, not three: the image, and an **unstyled `<div>`** that stacks the eyebrow above the price line. Structure verbatim:
  ```html
  <div style="display:flex;align-items:center;gap:18px">
    <img src="{{ offerPhoto }}" alt="" style="width:112px;height:84px;object-fit:cover;border-radius:12px;flex:none">
    <div>
      <div style="font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684">{{ reviewTitle }}</div>
      <div style="margin-top:6px;font-size:26px;font-weight:400;letter-spacing:-.01em">{{ reviewPrice }} <span style="font-size:16px;color:#cbb9a8">inklusive Nebenkosten</span></div>
    </div>
  </div>
  ```
  - Image: **always** rendered, even for a candidate without a photo (`offerPhoto` falls back to `assets/proberaum.png`).
  - Eyebrow `{{ reviewTitle }}` = `offer.name`, e.g. **„Raum in Stuttgart-West“**.
  - Price line → `{{ reviewPrice }}` = `offer.price`, **„280 € / Monat“**, then a literal space and the inline span **„inklusive Nebenkosten“**.
  The text block is a plain `<div>` with no style attribute — laying the three pieces out as siblings of the flex row (image · eyebrow · price side by side) is wrong.
- Terms grid `margin:24px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px 24px;font-size:16px`; each item `display:flex;gap:12px;align-items:flex-start` with the orange check (`18×18`, `stroke:#ff6926`, `stroke-width:2.2`, `flex:none;margin-top:2px`). Six items, five hard-coded:
  1. **„Geteilter Raum · 4 Personen“**
  2. `{{ offerTime }}` → **„Mittwochs, 19–22 Uhr“**
  3. **„Schlagzeug-Lagerung bestätigt“**
  4. **„Beginn: 1. Oktober 2026“**
  5. **„Keine Kaution“**
  6. **„Kündigungsfrist: ein Monat zum Monatsende“**
- Terms toggle: `margin-top:18px;border:0;background:none;color:#d8c8b8;font:inherit;font-size:14px;cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:8px`, hover `color:#fff`; label `{{ termsLabel }}` = **„Vollständige Bedingungen anzeigen“** / **„Vollständige Bedingungen ausblenden“**; chevron `14×14` `stroke-width:2` with `transform:{{ termsRot }};transition:transform .3s`. Handler `toggleTerms`.
- `<sc-if value="{{ fullTerms }}">` block — `margin-top:8px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.04);font-size:14.5px;line-height:1.6;color:#e2d3c3;animation:rsFadeUp .3s ease both`
  Body: **„Geteilte Nutzung des Raums in Stuttgart-West durch vier Bandmitglieder, mittwochs 19–22 Uhr. Miete 280 € monatlich inklusive Nebenkosten, Beginn 1. Oktober 2026. Keine Kaution. Kündigungsfrist ein Monat zum Monatsende. Das eigene Schlagzeug darf dauerhaft im Raum gelagert werden. Verstärker werden von der Band mitgebracht.“**
  Footnote `margin-top:8px;font-size:12.5px;color:#a89684` → **„Demo-Bedingungen. Im echten Produkt wäre hier das vollständige Angebot des Anbieters einsehbar.“**
- Accept block `margin-top:26px;display:flex;flex-direction:column;gap:12px`
  - **„Angebot annehmen“** `height:56px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:17px;font-weight:600;box-shadow:0 8px 28px rgba(255,105,38,.25)`, hover `#ff7a3d`; handler `acceptOffer` → clears the scheduler, `stage:'complete'`, `questionOpen:false`
  - Disclaimer `font-size:14px;line-height:1.5;color:#cbb9a8;text-align:center` → **„Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet.“**

*shadcn candidate:* Card + Collapsible (terms) + Button + Separator.

### 11.1 Question / QA panel
Trigger **„Noch eine Frage klären“** — `margin-top:20px;border:0;background:none;color:#d8c8b8;font:inherit;font-size:15px;cursor:pointer;padding:8px 12px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35)`, hover `color:#fff`. Handler `toggleQuestion`.

Panel `<sc-if value="{{ questionOpen }}">` — `margin-top:8px;width:min(720px,100%);display:flex;flex-direction:column;align-items:center;gap:12px;animation:rsFadeUp .3s ease both`
- `<sc-if value="{{ qaHidden }}">` prepared question chip **„Was passiert nach der Zusage?“** — `border:1px solid rgba(255,140,90,.4);background:rgba(255,105,38,.12);color:#ffd9c4;font:inherit;font-size:14px;padding:8px 14px;border-radius:999px;cursor:pointer`, hover `background:rgba(255,105,38,.22)`; handler `askQa` → sets `qa` and `scoutState:'speaking'`.
- `<sc-if value="{{ qa }}">` — `width:100%;display:flex;flex-direction:column;gap:10px;text-align:left`
  - question bubble `align-self:flex-end;max-width:80%;padding:12px 18px;border-radius:18px 18px 4px 18px;background:rgba(120,58,22,.75);border:1px solid rgba(255,140,90,.35);font-size:16px` → `{{ qa.q }}`
  - answer `align-self:flex-start;max-width:85%;font-size:16px;line-height:1.5;padding:4px 4px` → `{{ qa.a }}` = **„Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. In dieser Demo wird nichts versendet.“**
- `<form onSubmit="{{ submitQa }}">` — `width:100%;display:flex;align-items:center;gap:8px;height:56px;padding:0 8px 0 18px;border-radius:999px;background:rgba(20,14,10,.6);border:1px solid rgba(255,200,160,.16)`
  - `<input value="{{ qaDraft }}" onChange="{{ onQaDraft }}" placeholder="Frage an deinen Scout …" aria-label="Frage an deinen Scout" style="flex:1;min-width:0;background:none;border:0;color:#f5ece2;font:inherit;font-size:16px;outline:none">`
  - send button `aria-label="Senden"` `width:40px;height:40px;border-radius:50%;border:0;background:rgba(255,255,255,.08);color:#f5ece2` (no hover declared), paper-plane `18×18`
  `submitQa`: text matching `/zusage|danach|passiert|dann/` → the same canned answer with the typed question; otherwise `showHint("Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage.")`.
*shadcn candidate:* Collapsible + Badge/Button (chip) + Input + Button.

---

## 12. Abschluss / Complete (`isComplete`, lines 415–423)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 24px 40px`

| Element | Copy | Style |
|---|---|---|
| Blob anchor | — | `width:96px;height:96px;margin-bottom:40px` |
| `h1` | **„Euer nächster Proberaum steht bereit.“** | `margin:0;font-size:clamp(36px,5vw,58px);line-height:1.08;font-weight:300;letter-spacing:-.02em;max-width:720px;text-wrap:balance;animation:rsFadeUp .6s ease both` |
| Subline | **„Demo abgeschlossen — es wurde keine echte Zusage versendet.“** (em dash) | `margin-top:22px;font-size:17px;color:#cbb9a8;animation:rsFadeUp .6s .1s ease both` |
| Summary pill | `{{ completeSummary }}` = `offer.short + " · " + offer.price + " · " + offer.timeLower` → **„Stuttgart-West · 280 € / Monat · mittwochs 19–22 Uhr“** | `margin-top:28px;height:46px;padding:0 20px;border-radius:999px;border:1px solid rgba(255,200,160,.18);background:rgba(20,14,10,.55);display:flex;align-items:center;font-size:15px;animation:rsFadeUp .6s .2s ease both` |
| Restart link | **„Demo erneut ansehen“** | `margin-top:40px;border:0;background:none;color:#d8c8b8;font:inherit;font-size:15px;cursor:pointer;padding:8px 12px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35);animation:rsFadeUp .6s .3s ease both`, hover `color:#fff`; handler `restart` → `go('welcome')` |

Alternative `completeSummary` values follow the picked candidate: **„Esslingen · 320 € / Monat · donnerstags 19–23 Uhr“**, **„Stuttgart-Ost · 350 € / Monat · donnerstags ab 20 Uhr“**.
**shadcn candidate:** Badge (pill) + Button (link) + custom typography.

---

## 13. Sackgasse / Dead end (`isDeadEnd`, `stage === 'dead_end'`, lines 426–442)

Reached 6000 ms after a „Nein, Donnerstag ist wichtig“ answer (via `waiting`).
Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px 24px 32px`

- Blob anchor `width:110px;height:110px;margin-bottom:30px`
- `h1` **„Da komme ich gerade nicht weiter.“** — `margin:0;font-size:clamp(32px,4.6vw,52px);line-height:1.1;font-weight:300;letter-spacing:-.02em;text-wrap:balance`

**Card** `margin-top:26px;width:min(700px,100%);background:rgba(18,14,12,.66);border:1px solid rgba(255,200,160,.14);border-radius:22px;padding:28px 30px;text-align:left;animation:rsFadeUp .5s ease both`
- Eyebrow **„Raum in Stuttgart-West“** `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
- Body **„Der Anbieter kann Donnerstag nicht anbieten. Weitere Räume in Stuttgart, die zu eurem Suchauftrag passen, habe ich aktuell nicht gefunden.“** — `margin-top:10px;font-size:clamp(19px,2vw,24px);line-height:1.35;font-weight:300`
- Prompt **„Was wäre für euch denkbar? Ich passe den Suchauftrag nur an, wenn ihr es sagt.“** — `margin-top:22px;font-size:15px;color:#cbb9a8`
- Option list `margin-top:12px;display:flex;flex-direction:column;gap:8px`; every option button:
  `display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,200,160,.16);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;text-align:left;cursor:pointer`, hover `background:rgba(255,255,255,.09)`; trailing chevron-right `18×18` `stroke-width:2` `<path d="M9 6l6 6-6 6"/>` with `flex:none`. Title `display:block;font-size:17px`, subtitle `display:block;margin-top:2px;font-size:14px;color:#cbb9a8`.

  | Handler | Title | Subtitle |
  |---|---|---|
  | `compBudget` → `compromise('budget')` | **„Budget bis 400 €“** | **„Erweitert die Suche in Stuttgart um weitere Räume.“** |
  | `compUmland` → `compromise('umland')` | **„Umland einbeziehen“** | **„Esslingen, Ludwigsburg, Fellbach · 20 bis 30 Minuten Weg.“** |
  | `compZeit` → `compromise('zeit')` | **„Mittwoch doch erlauben“** | **„Der Raum in Stuttgart-West wäre dann verfügbar. Donnerstag bleibt gemerkt.“** |

  Note: the „Budget bis 400 €“ title is **hard-coded in the template**. `renderVals()` also exposes `deadBudget = "Bis " + (budgetNum + 50) + " €"` which the template never uses — keep the literal, or wire the dynamic value deliberately.

- Footer link **„Nichts ändern, weiter suchen lassen“** — `margin-top:20px;border:0;background:none;color:#d8c8b8;font:inherit;font-size:15px;cursor:pointer;padding:8px 12px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35)`, hover `color:#fff`; handler `keepWaiting` → `stage:'waiting'`, `status:"Alles klar, ich suche im Hintergrund weiter und melde mich."`

**Compromise effects** (`compromise(kind)` → `stage:'scouting'`, fact updated + flashed for 1200 ms, scout line spoken and pushed to the transcript, activity entry `"Suchauftrag angepasst: <label>"`, knowledge log entry with the same text):

| kind | fact | new label | spoken line | follow-up |
|---|---|---|---|---|
| `budget` | `budget` | **„Bis 400 € / Monat“** | **„Alles klar, bis 400 Euro. Ich suche erneut in Stuttgart.“** | after 3500 ms `"Ich suche erneut mit den neuen Kriterien."`, after 7000 ms → `candidates` |
| `umland` | `ort` | **„Stuttgart & Umland“** | **„Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach.“** | same as budget |
| `zeit` | `zeit` | **„Mittwoch oder Donnerstag ab 19 Uhr“** | **„Alles klar, Mittwoch geht also auch. Ich frage den Raum in Stuttgart-West erneut an.“** | after 3500 ms → `following_up` + `FOLLOW_STATUS`, after 8500 ms → `offer` |

**shadcn candidate:** Card + a list of Button (variant outline, full width, `justify-between`) for the three options; Separator not used.

---

## 14. Kandidaten / Candidates (`isCandidates`, `stage === 'candidates'`, lines 445–481)

Container: `min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px 24px 32px`

- Blob anchor `width:72px;height:72px;margin-bottom:22px`
- `h1` `{{ candHeadline }}` = **„Drei Räume, die in Frage kommen.“** — `margin:0;font-size:clamp(32px,4.6vw,52px);line-height:1.1;font-weight:300;letter-spacing:-.02em;text-wrap:balance`
- Subline **„Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage.“** — `margin:12px 0 0;font-size:17px;color:#cbb9a8`

**Grid** `margin-top:28px;width:min(1180px,100%);display:grid;grid-template-columns:{{ candCols }};gap:14px;text-align:left;animation:rsFadeUp .6s .1s ease both`
`candCols` = `repeat(3, minmax(0,1fr))` desktop, **`1fr`** narrow.

**Card** `<sc-for list="{{ cands }}" as="c">`:
```
display:flex;flex-direction:column;background:rgba(18,14,12,.72);
border:1px solid {{ c.border }};border-radius:22px;overflow:hidden;position:relative
```
- `<sc-if value="{{ c.best }}">` badge **„Mein Vorschlag“** — `position:absolute;top:14px;left:14px;z-index:2;padding:5px 11px;border-radius:999px;background:#ff6926;color:#fff;font-size:12.5px;font-weight:600;letter-spacing:.04em`
- `<sc-if value="{{ c.hasPhoto }}">` → `<img src="{{ c.photo }}" alt="" style="display:block;width:100%;height:150px;object-fit:cover">`
- `<sc-if value="{{ c.noPhoto }}">` → `height:150px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:#a89684` → **„Foto folgt vom Anbieter“**
- Body `padding:20px 22px 22px;display:flex;flex-direction:column;gap:14px;flex:1`
  - Name `font-size:19px` → `{{ c.name }}`; price `margin-top:4px;font-size:30px;font-weight:400;letter-spacing:-.02em` → `{{ c.price }}`; budget note `margin-top:2px;font-size:13.5px;color:{{ c.budgetColor }}` → `{{ c.budgetText }}`
  - Spec list `display:flex;flex-direction:column;gap:9px;font-size:15px;padding-top:12px;border-top:1px solid rgba(255,220,190,.1)`, each row `display:flex;gap:10px;align-items:flex-start` with an `18×18` icon (`flex:none;margin-top:1px`):
    1. clock (`stroke:#e2d3c3;stroke-width:1.6`) + `{{ c.time }}`
    2. storage: `c.storageOk` → orange check (`stroke:#ff6926;stroke-width:2.2`), `c.storageNo` → amber X (`stroke:#e0a13a;stroke-width:2`, `<path d="M6 6l12 12M18 6L6 18"/>`), then `{{ c.storage }}`
    3. map pin (`stroke:#e2d3c3;stroke-width:1.6;stroke-linejoin:round`) + `{{ c.way }}`
    4. house (`stroke:#e2d3c3;stroke-width:1.6;stroke-linejoin:round`, `<path d="M4 11l8-7 8 7v9H4z"/>`) + `{{ c.size }}`, row colour `#cbb9a8`
  - Scout note row `display:flex;gap:10px;align-items:flex-start;font-size:14.5px;color:#e2d3c3;padding-top:10px;border-top:1px solid rgba(255,220,190,.1)`; leading mini-blob `margin-top:5px;width:10px;height:10px;border-radius:46% 54% 52% 48%/55% 45% 55% 45%;background:#ff6926;flex:none;box-shadow:0 0 8px rgba(255,105,38,.5)`; then `{{ c.note }}`
  - Spacer `flex:1`
  - CTA **„Diesen Raum anfragen“** — `height:48px;border-radius:999px;border:1px solid {{ c.btnBorder }};background:{{ c.btnBg }};color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer`, hover `filter:brightness(1.1)`; handler `c.pick` → `pickCandidate(id)`

**Candidate data (`CANDS`) and the derived render fields**

| field | `west` | `esslingen` | `ost` |
|---|---|---|---|
| `name` | „Raum in Stuttgart-West“ | „Raum in Esslingen“ | „Raum in Stuttgart-Ost“ |
| `short` | „Stuttgart-West“ | „Esslingen“ | „Stuttgart-Ost“ |
| `price` | „280 € / Monat“ | „320 € / Monat“ | „350 € / Monat“ |
| `priceNum` | 280 | 320 | 350 |
| `time` | „Mittwochs, 19–22 Uhr“ | „Donnerstags, 19–23 Uhr“ | „Donnerstags, ab 20 Uhr“ |
| `timeLower` | „mittwochs 19–22 Uhr“ | „donnerstags 19–23 Uhr“ | „donnerstags ab 20 Uhr“ |
| `storage` | „Schlagzeug kann im Raum bleiben“ | „Schlagzeug kann im Raum bleiben“ | „Schlagzeug müsste abgebaut werden“ |
| `storageOk` | true | true | **false** |
| `way` | „12 Min. mit der Stadtbahn“ | „25 Min. mit der S-Bahn“ | „18 Min. mit der Stadtbahn“ |
| `size` | „ca. 28 m² · geteilt mit einer Band“ | „ca. 35 m² · geteilt mit zwei Bands“ | „ca. 22 m² · geteilt mit drei Bands“ |
| `note` | „Günstigster Raum, aber nur mittwochs frei.“ | „Euer Wunschtag, dafür im Umland.“ | „Am Budgetlimit, und das Schlagzeug kann nicht bleiben.“ |
| `photo` | `assets/proberaum.png` | `null` | `null` |

Derived per card:
```
fits        = priceNum <= budgetNum          // budgetNum parsed from the budget fact label, default 350
inArea      = id !== 'esslingen' || /Umland/.test(ortLabel)
best        = candList.filter(c => c.fits && c.storageOk && c.inArea)
                      .sort((a, b) => a.priceNum - b.priceNum)[0]   // the CHEAPEST qualifying card
budgetText  = fits ? 'Im Budget' : 'Über eurem Budget (' + budgetNum + ' €)'
budgetColor = fits ? '#a89684' : '#e0a13a'
border      = best ? 'rgba(255,140,90,.5)' : 'rgba(255,200,160,.14)'
btnBg       = best ? '#ff6926'  : 'rgba(255,255,255,.06)'
btnBorder   = best ? '#ff6926'  : 'rgba(255,220,190,.28)'
outside     = !inArea            // computed but never referenced in the template (0 occurrences)
fits / over = also exposed per card and never referenced in the template
```

**What actually renders — do not derive this from the formulas by hand.**

- **`best` is always `west`.** `west` (280 €) satisfies `fits` for every budget ≥ 280, and its `storageOk` and `inArea` are unconditionally true; the sort is **ascending by price**, so it is picked first. Every reachable configuration:

  | Entry path | `budgetNum` | `ortLabel` | qualifying set (sorted ↑) | `best` |
  |---|---|---|---|---|
  | demo chapter select → `candidates` | 350 | „Stuttgart“ | [west 280] | **west** |
  | „Budget bis 400 €“ compromise | 400 | „Stuttgart“ | [west 280] | **west** |
  | „Umland einbeziehen“ compromise | 350 | „Stuttgart & Umland“ | [west 280, esslingen 320] | **west** |

  `esslingen` can **never** win the badge — the Umland compromise only adds it to the qualifying set, it does not make it cheaper than 280 €. `ost` is excluded by `storageOk:false` in every case. So the „Mein Vorschlag“ badge, the `rgba(255,140,90,.5)` card border and the orange `btnBg`/`btnBorder` are always on the **first** card.
  The only way to render **no** badge is `budgetNum < 280` (reachable only by correcting the budget fact in Settings) — then `best` is `undefined` and all three cards get the neutral border and CTA.

- **All three cards read „Im Budget“ in every scripted flow.** `fits` depends on **price only**; `inArea` has no influence on it. `esslingen` is 320 ≤ 350 and `ost` is 350 ≤ 350, so with the default budget every card shows `budgetText = "Im Budget"` in `budgetColor:#a89684`. The amber variant **„Über eurem Budget (350 €)“** / `#e0a13a` is **unreachable in the scripted flow** — it appears only if the budget fact is edited below a candidate price (Settings → `updateFact`, or the brief card's „Übernehmen“).

- **`outside` / `inArea` are never rendered.** `inArea` only feeds `best`; the out-of-area marker `outside` is computed and dropped. The Esslingen card is therefore visually indistinguishable from an in-area one — its only cue is the copy in `note`: **„Euer Wunschtag, dafür im Umland.“**

**Footer** — one flex row `margin-top:22px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center` with exactly **two** children:
- **„Keiner passt, weiter suchen“** — `border:0;background:none;color:#d8c8b8;font:inherit;font-size:15px;padding:8px 12px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35)`, hover `color:#fff`; handler `keepSearching` → `stage:'waiting'`, `status:"Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt."`
- Brief pill `data-fact-summary="1"` — `height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,200,160,.16);background:rgba(20,14,10,.5);color:#d8c8b8;font:inherit;font-size:14px;display:flex;align-items:center;gap:8px`, hover `color:#fff`; label `{{ compactBrief }}` + chevron-down `14×14` `stroke-width:2` `<path d="M6 9l6 6 6-6"/>` with `transform:{{ chevRot }};transition:transform .3s`. Handler `toggleBrief`.

**Brief panel** — `<sc-if value="{{ briefOpen }}">` is a **sibling that follows the footer div**, not a third child of it. It sits in the stage container's column flow, so it renders **below** the two buttons, centred:
```html
<div style="margin-top:22px;display:flex;gap:18px;align-items:center;flex-wrap:wrap;justify-content:center"> … </div>
<sc-if value="{{ briefOpen }}">
  <div style="margin-top:10px;width:min(380px,100%);text-align:left;background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:16px;padding:14px 18px;display:flex;flex-direction:column;gap:9px;animation:rsFadeUp .3s ease both">
    <sc-for list="{{ facts }}" as="f"><div style="font-size:15px;border-radius:6px;background:{{ f.bg }};transition:background .5s">{{ f.label }}</div></sc-for>
  </div>
</sc-if>
```
Rows only — **no** „Euer Suchauftrag“ label on this stage (unlike §8.6 and §10.4). Putting the panel inside the flex row would place it beside the two buttons instead of under them.

`pickCandidate` → `stage:'following_up'`, `offer = candidate`, `status = "Ich frage beim " + c.name + " nach einem Angebot und kläre die Details."`, activity `"Angebot angefragt: " + c.short`, offer after 5000 ms.

**shadcn candidate:** Card ×3 in a grid + Badge („Mein Vorschlag“, „Im Budget“) + Button (default for the best, outline for the rest) + Collapsible for the brief pill.

---

## 15. State machine, timings and the demo script

`STAGES = ['welcome','discovery','brief_review','scouting','waiting','clarification','following_up','offer','offer_review','complete']`

`AUTOPILOT = ['scouting','waiting','following_up']` — **exactly those three**. `dead_end` and `candidates` are two extra stages that exist outside `STAGES` **and outside `AUTOPILOT`**; they are reachable only through the demo chapter select, `deadEnd()` and `showCandidates()`.

That distinction is load-bearing UI, not bookkeeping. `AUTOPILOT` gates:
`showScoutBadge` (header „Scout ist unterwegs“ badge **and** the pause button, §2.4.1/§2.4.2), `waitingAccess` (§8.5), `settingsData.session`, and the entry guards of `attemptContact`, `arriveReply` and `showCandidates`.
So on `dead_end` and on `candidates` the header shows **no** Scout badge and **no** pause button.

### 15.0 Initial state (the constructor) — several values gate Scout-surface UI

```js
this.state = Object.assign({
  mode: 'voice', micOn: true, draft: '', sideDraft: '', clarDraft: '', qaDraft: '', editDraft: {},
  demoPaused: false, demoOpen: true, speed: 1, narrow: false, stepIndex: 0,
  view: 'scout', settingsPage: 'sources', opPage: 'overview', menuOpen: false, toast: null,
  sessionHeld: false, settingsDirty: false, backReq: 0,
  name: 'Herzbuben', sources: SOURCES0.map(s => ({...s})), autoSources: true, rules: {...RULES0},
  knowledge: KNOW0.map(k => ({...k})), knowledgeLog: [],
  notif: { decision: true, offer: true, digest: false, channel: 'app' },
  flags: { voice: true, publicSearch: false },
  incident: false, incidentResolved: false, offerStale: false,
}, this.baseFor('welcome'));
```

`RULES0 = { mode:'autopilot', contact:true, viewings:true, publishAd:false, shareProfile:true, sharePrivate:false, perDay:5 }`

`SOURCES0` (order as rendered):

| id | `name` | `desc` | `region` | `enabled` | `access` | `kind` | extras |
|---|---|---|---|---|---|---|---|
| `roomscout` | „roomscout.dev“ | „Kontrolliertes Demo-Portal“ | „Stuttgart“ | `true` | `connected` | `portal` | `profile:'Herzbuben'`, `lastAccess:null` |
| `musiker` | „Musiker in deiner Stadt“ | „Stuttgart · Öffentliche Anzeigen“ | „Stuttgart“ | `true` | `public` | `public` | — |
| `bandnet` | „Bandnet Hamburg“ | „Hamburg · Andere Region“ | „Hamburg“ | **`false`** | `public` | `public` | — |

**What these defaults mean for the Scout surface** (all of it invisible unless the user changes something in Settings/Operator):

- `rules.mode === 'autopilot'` **and** `rules.contact === true` ⇒ the §8.3 approval card, `state.pending`, `waitingFor:'release'` and the toast „Dein Scout wartet auf deine Freigabe“ **never appear in the default flow**.
- `flags.voice === true` ⇒ `startVoice` (§5) never falls back to text mode, and the hint „Voice Scout ist in dieser Demo deaktiviert…“ never fires. `flags.publicSearch === false` ⇒ `usableSources` keeps only `kind:'portal'` sources, i.e. **roomscout.dev is the only usable source**; `musiker` and `bandnet` are inert on this surface.
- `roomscout.access === 'connected'` and `enabled === true` ⇒ neither §8.4 (`waitingSource`) nor §8.5 (`waitingAccess`) fires by default. `waitingAccess` also flips on when the Operator's „Beispielstörung laden“ (`loadIncident`) sets that source to `access:'expired'`.
- `mode:'voice'` + `micOn:true` ⇒ discovery starts with the voice controls (§6.6) and `scoutState:'listening'` on user lines.
- `view:'scout'` ⇒ `notify()` is a no-op until the user opens Settings or the Operator view, so **no toast is possible while the user is watching the Scout**.
- `demoOpen:true` ⇒ the demo bar starts expanded (prototype only). `speed:1`, `narrow:false` (corrected on mount), `settingsPage:'sources'`, `opPage:'overview'`, `incident:false`, `autoSources:true`.

### 15.1 `baseFor(stage)` — the reset **and** the per-stage seeding

`baseFor` is the only place state is reset, and it is also what makes every chapter directly enterable (demo select, deep link, `go()`), so a port must reproduce it exactly.

Common reset for **every** stage:
`stage, utter:null, capsule:null, awaitingUser:false, suggestion:null, hint:null, transcriptOpen:false, briefOpen:false, editing:false, convoEnded:false, cardArrived:false, headlineShown:false, activityOpen:false, searchPaused:false, offerTalk:null, fullTerms:false, questionOpen:false, qa:null, scoutState:'idle', status:'', listMode:'hidden', facts:[], transcript:[], activity:[], clar:{userText:null,scoutText:null}, pending:null, waitingFor:null, offerStale:false, offer:OFFER0`

Then, **cumulatively** (each row inherits everything above it unless it `return`s first):

| Stage | Additional seeding (on top of the reset) |
|---|---|
| `welcome` | nothing — returns immediately |
| `discovery` | `listMode:'float'` — returns |
| *(all later stages)* | `facts = FINAL_FACTS` (the five final labels, §4); `transcript = SCRIPT.map(s => ({who, text}))` (all 8 scripted lines) |
| `brief_review` | `listMode:'card'`, `cardArrived:true`, `headlineShown:true` — returns |
| *(all later stages)* | `transcript + { who:'scout', text: START_LINE }`; `activity = [ACT.start]` |
| `scouting` | `status = STATUS[0]` (**„Ich suche nach passenden Räumen in Stuttgart.“**) — returns |
| *(all later stages)* | `activity + [ACT.found, ACT.contacted, ACT.waiting]` |
| `waiting` | `status = STATUS[3]` (**„Jetzt warte ich auf eine Antwort.“**) — returns |
| *(all later stages)* | `activity + [ACT.notif, ACT.read]` |
| `clarification` | nothing further (`status` stays `''`) — returns |
| `dead_end` | `transcript + [{user, NO_TEXT}, {scout, NO_REPLY}]`; `activity + [ACT.alt, ACT2.declined, ACT2.noMatch]` — returns |
| `candidates` | `activity + [ACT2.found2]` — returns |
| *(the remaining "yes" branch)* | `facts`: the `zeit` row rewritten to **„Mittwoch oder Donnerstag ab 19 Uhr“**; `transcript + [{user, YES_TEXT}, {scout, YES_REPLY}]`; `activity + [ACT.confirmed]` |
| `following_up` | `status = FOLLOW_STATUS` (**„Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben.“**) — returns |
| `offer` / `offer_review` / `complete` | `activity + [ACT.offer]` (`status` stays `''`) |

Note `dead_end` and `candidates` branch **before** the `zeit` rewrite, so entering them directly keeps `zeit = "Donnerstags ab 19 Uhr"`. `offer_review` and `complete` are seeded identically to `offer`; the difference is only which `<sc-if>` renders. `offer` is always reset to `OFFER0` (= `CANDS[0]`, west) — a candidate picked in a previous run does not survive a stage jump.

`go(stage, extra)` = `sched.clear()` + `stopReveal()` + `setState(Object.assign(baseFor(stage), extra))` + `enter(stage)`.

### 15.2 Entry guards — most transition methods are no-ops from the wrong stage

Timers in §15.3 are **not** unconditional; each target method re-checks the stage (and sometimes more) when it fires:

| Method | Guard | Consequence |
|---|---|---|
| `startScouting()` | `stage === 'brief_review'` | — |
| `attemptContact()` | `AUTOPILOT.includes(stage)` **and** `ACT.contacted` not already in `activity` | cannot contact twice |
| `arriveReply()` | `AUTOPILOT.includes(stage)` **and** `!state.waitingFor` | **while the Scout is blocked on a source / access / release, the scripted 7000 ms and 10000 ms reply never arrives and `clarification` is unreachable.** The flow stays parked until the user resolves the blocker in Settings (which re-fires `attemptContact` → `contactAndWait` → a fresh 10000 ms timer). |
| `answerClar(yes, text)` | `stage === 'clarification'` **and** `!clar.userText` | one answer only |
| `deadEnd()` | `stage === 'waiting'` | — |
| `showCandidates()` | `AUTOPILOT.includes(stage)` | not reachable from `dead_end` itself — `compromise()` first moves to `scouting` |
| `showOffer()` | `stage === 'following_up'` | — |
| `pickCandidate(id)` | `stage === 'candidates'` and the id exists | — |
| `keepWaiting()` | `stage === 'dead_end'` | — |
| `talkOffer()`'s 6500 ms reset | `stage === 'offer'` (checked in the timer) | — |
| `showHint(t)`'s 4200 ms clear | `state.hint === t` (checked in the timer) | a newer hint is not clobbered |

**`SCRIPT`** (the discovery dialogue; `who`, `text`, optional `facts`, `memory`, `then`):
1. scout — „Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?“
2. user — „Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat.“ → facts `ort:"Stuttgart"`, `budget:"Bis 400 € / Monat"`, `band:"Geteilter Raum · 4 Personen"`
3. scout — „Welche Tage passen euch zum Proben?“
4. user — „Donnerstags ab 19 Uhr wäre gut.“ → fact `zeit:"Donnerstags ab 19 Uhr"`
5. scout — „Gibt es etwas, das im Raum vorhanden sein oder dort bleiben muss?“
6. user — „Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit.“ → fact `equip:"Schlagzeug darf im Raum bleiben"`, memory `"Verstärker bringt die Band mit"`
7. user — „Und beim Budget lieber maximal 350 Euro.“ → fact `budget:"Bis 350 € / Monat"`
8. scout — „Alles klar, maximal 350 Euro. So würde ich für euch suchen. Soll ich loslegen?“ → `then:'brief'`

### 15.3 Timeline

`enter(stage)` — what `go()` arms after the reset:

| `enter(stage)` | arms |
|---|---|
| `discovery` | `sched.after(500) → runStep(0)` |
| `scouting` | **`scheduleScouting(0)` — offset 0, not 3800.** Entering `scouting` from the chapter select therefore reaches `STATUS[0]` immediately, `STATUS[1]` at 4000 ms and `attemptContact()` at 8000 ms. The 3800 ms offset exists **only** on the `startScouting()` path, where it covers the spoken `START_LINE`. |
| `waiting` | `sched.after(7000) → arriveReply()` |
| `following_up` | `sched.after(5000) → showOffer()` |
| every other stage | nothing (static) |

Full timeline (every delay is divided by `sched.speed`):

| From | Delay | To |
|---|---|---|
| enter `discovery` | 500 ms | `runStep(0)` |
| after a **scout** line's reveal + hold | 500 ms | `runStep(i+1)` |
| after the `then:'brief'` scout line | 500 ms | `morphToBrief()` |
| after a **user** line's reveal + hold | 0 | `scoutState:'thinking'`, then `processFacts` |
| per fact: capsule shown | 650 ms | `flyCapsule` starts (580 ms flight) |
| 400 ms into each flight | | `commitFact` (row grows, label fades in 350 ms) |
| after each flight finishes | 300 ms | next fact of the same utterance |
| after the last fact of a user line | 600 ms | `runStep(i+1)` |
| `morphToBrief` | 450 ms | `headlineShown:true` |
| `morphToBrief` | 950 ms | `cardArrived:true` |
| `startScouting` (immediate) | 0 | `stage:'scouting'`, `listMode:'leaving'`, `status = START_LINE`, `scoutState:'speaking'`, transcript + `START_LINE`, `activity = [ACT.start]` |
| `startScouting` | 600 ms | `listMode:'hidden'` |
| `startScouting` | 3800 ms | `STATUS[0]`, `scoutState:'idle'` |
| enter `scouting` directly | **0 ms** | `STATUS[0]`, `scoutState:'idle'` |
| *(offset)* +4000 ms | | `STATUS[1]` (**„Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details.“**) + activity `ACT.found` |
| *(offset)* +8000 ms | | `attemptContact()` — see the branch table in §8.3 |
| `attemptContact` → blocked | 0 | one of the two blocker statuses + `waitingFor:'source'`/`'access'` — **the flow stops here** (see the `arriveReply` guard in §15.2) |
| `attemptContact` → needs release | 0 | `pending` object, `status:"Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst."`, `waitingFor:'release'`, toast „Dein Scout wartet auf deine Freigabe“ — **the flow stops here** |
| `contactAndWait` (immediate) | 0 | `status = STATUS[2]` (**„Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist.“**), `pending:null`, `waitingFor:null`, `activity + ACT.contacted` (**„Anbieter über das Portal kontaktiert“**) |
| `contactAndWait` | 3000 ms | `stage:'waiting'`, `STATUS[3]`, `activity + ACT.waiting` |
| `contactAndWait` | 10000 ms | `arriveReply()` → `clarification` + activity `ACT.notif`, `ACT.read` + toast „Dein Scout hat eine Rückfrage“ |
| enter `waiting` directly | 7000 ms | `arriveReply()` |
| `answerClar` | 650 ms | scout reply (`scoutState:'speaking'`, transcript + reply, on *yes* the `zeit` fact rewritten with `changed:true`) |
| `answerClar` | 2300 ms | `following_up` + `FOLLOW_STATUS` / `waiting` + `ALT_STATUS`; all `changed` flags cleared; `activity + ACT.confirmed` / `ACT.alt` |
| … yes | +5000 ms | `showOffer()` |
| … no | +6000 ms | `deadEnd()` → toast „Dein Scout braucht eine Entscheidung“ |
| enter `following_up` directly | 5000 ms | `showOffer()` → toast „Ein Angebot ist eingegangen“ |
| `compromise('budget'\|'umland')` | 1200 ms | fact flash cleared |
| `compromise('budget'\|'umland')` | 3500 ms | `status:"Ich suche erneut mit den neuen Kriterien."`, `scoutState:'idle'` |
| `compromise('budget'\|'umland')` | 7000 ms | `showCandidates()` → toast „Dein Scout hat Räume zum Vergleichen“ |
| `compromise('zeit')` | 3500 ms | `following_up` + `FOLLOW_STATUS` |
| `compromise('zeit')` | 8500 ms | `showOffer()` |
| `pickCandidate` | 5000 ms | `showOffer()` |
| `talkOffer` | 6500 ms | `scoutState:'idle'` (only if still on `offer`) |
| `switchToVoice` while `awaitingUser` | 400 ms | the pending scripted user line is auto-played |
| `resumeConvo` (no frozen utterance, not `awaitingUser`) | 300 ms | `runStep(stepIndex)` |
| `showHint` | 4200 ms | hint cleared (only if it is still the same hint) |
| `commitFact` on an existing row | 1100 ms | `changed:false` |
| `updateFact` (Settings) | 1200 ms | `changed:false` |
| **toast** | — | **no timer.** `notify()` only sets `state.toast`; it stays until `dismissToast` (X) or `toastGo`/`backToScout` clears it. Do not port it as an auto-dismissing Sonner toast. |

All timers run through `Sched`, which divides every delay by `speed` (1 or 1.6) and supports `pause/resume/clear/skip`. `searchPaused` and `demoPaused` both pause it; resume requires the other one to be off.

### 15.4 Holding and resuming the session across views

```js
holdSession() {
  const hold = stage === 'discovery' && !convoEnded && !demoPaused && !sched.paused;
  if (hold) { sched.pause(); this.stopReveal(); }
  return hold;                         // caller ORs it into state.sessionHeld
}
openSettings(page) { const hold = this.holdSession();
  setState({ view:'settings', settingsPage: page || settingsPage, menuOpen:false,
             sessionHeld: hold || sessionHeld, transcriptOpen:false }); }
openOperator()     { const hold = this.holdSession();
  setState({ view:'operator', menuOpen:false, sessionHeld: hold || sessionHeld, transcriptOpen:false }); }

backToScout() {                                   // the CLASS method
  if (sessionHeld && !demoPaused && !searchPaused) {
    sched.resume();
    if (utter && utter.shown < utter.words.length) setState({ utter: {...utter, shown: utter.words.length} });
  }
  setState({ view:'scout', sessionHeld:false, menuOpen:false, toast:null, settingsDirty:false });
}
```

- `holdSession` pauses **only** a live discovery conversation — on every other stage the autopilot timers keep running while the user is in Settings or the Operator view (which is what produces the toasts).
- Returning **snaps an in-flight utterance to fully revealed** rather than continuing the word-by-word reveal, and clears the toast and `settingsDirty`.
- Opening either sub-surface force-closes the transcript sheet.
- The props-level `backToScout` (§2.4.3) is a different function: it bumps `backReq` and closes the menu, then calls the class method **only** when `view !== 'settings' || !settingsDirty` — Settings may veto and show its own confirm.

---

## 16. Responsive matrix — every binding that changes with `narrow` / `mobile`

`narrow = matchMedia('(max-width: 959px)').matches || mobile`

| Binding | desktop (`narrow=false`) | narrow (`narrow=true`) | Where |
|---|---|---|---|
| `hdrH` | `84` | `64` | header height (px) |
| `hdrPad` | `0 36px` | `0 18px` | header padding |
| `markSize` | `20` | `17` | wordmark font-size |
| `hdrBtn` | `42` | `38` | header circle buttons |
| `hdrGap` | `14` | `10` | header right-cluster gap |
| `badgeTextVisible` | `true` | `false` | scout badge label |
| `welcomeBlob` / `welcomeBlobMb` | `168` / `56` | `128` / `36` | welcome |
| `discoveryBlob` | voice `160`, text `104` | voice `120`, text `88` | discovery |
| `utterSize` | voice `clamp(28px,3.6vw,46px)`, text `clamp(24px,3vw,36px)` | voice `28px`, text `24px` | discovery |
| `utterMaxWidth` | `min(760px, calc(100vw - 660px))` when facts exist, else `760px` | always `760px` | discovery |
| `ctrl` / `ctrlGap` / `ctrlFont` | `76` / `34` / `14` | `60` / `20` / `12.5` | voice controls |
| `discoveryPadBottom` | `32` (sheet never visible) | `96` when `sheetVisible`, else `32` | discovery |
| `briefSpacerHeight` | `60 + facts.length*56 + 240` | `40` | brief |
| `autoBlob` / `autoBlobMb` / `autoH1` | `160` / `48` / `clamp(36px,5vw,58px)` | `112` / `30` / `34px` | autopilot |
| `candCols` | `repeat(3, minmax(0,1fr))` | `1fr` | candidates |
| `offerCols` | `minmax(0,1fr) minmax(0,1.05fr)` | `1fr` | offer |
| `offerImgMin` / `offerImgMax` | `380` / `470` | `200` / `240` | offer image |
| `listVisible` | may be true | **always false** | desktop fact list |
| `sheetVisible` | **always false** | true on discovery/brief when facts exist | mobile sheet |

`mobile`-only (device frame): `stL, stT, stW, stH, stTf, stR, stB` (§2.2) and `mobileBtnBg` in the demo bar.

---

## 17. State-dependent variant index

| State | Type | Affects |
|---|---|---|
| `view` | `'scout' \| 'settings' \| 'operator'` | which branch renders; `notOperator` hides the header in operator |
| `stage` | 12 values (10 in `STAGES` + `dead_end` + `candidates`) | the stage view; `isAutopilot` groups **exactly** `scouting`/`waiting`/`following_up` — `dead_end` and `candidates` are **not** autopilot stages, so the header badge and pause button are hidden there |
| `mobile` (prop/demo) | boolean | device frame + forces `narrow` |
| `narrow` (media query) | boolean | see §16 |
| `mode` | `'voice' \| 'text'` | `voiceControls` vs `textControls`, `discoveryBlob`, `utterSize`, instant vs word-by-word reveal |
| `micOn` | boolean | mic button colour/shadow/label, strike icon, `scoutState` listening vs idle, „Mikro aus“ state text |
| `scoutState` | `speaking\|listening\|thinking\|idle` | `blobAnim`, `scoutStateText` |
| `searchPaused` | boolean | badge text/colour/animation, pause icon, „Fortsetzen“ button, scheduler |
| `demoPaused` | boolean | demo bar icon + scheduler (prototype only) |
| `convoEnded` | boolean | hides utterance + controls, shows the ended message and the two resume buttons |
| `awaitingUser` | boolean | suggestion chip, `discoveryPlaceholder`, whether typed text is accepted |
| `listMode` | `hidden\|float\|card\|leaving` | the whole desktop fact-list geometry (§4.2) |
| `cardArrived` | boolean | card/sheet action block + edit button |
| `headlineShown` | boolean | `headlineOpacity` on the brief headline |
| `editing` | boolean | fact rows become inputs; „Übernehmen“/„Abbrechen“ replace the actions |
| `briefOpen` | boolean | brief panels + chevron rotation (`chevRot`, `chevRotUp`, `shChevRot`), `offerPillTop`, `shRowsVisible` |
| `activityOpen` | boolean | activity panel + `activityLabel` |
| `transcriptOpen` | boolean | transcript sheet |
| `menuOpen` | boolean | profile menu + `aria-expanded` |
| `pending` / `waitingFor` | object / `'source'\|'access'\|'release'\|null` | approval card, „Quelle auswählen“, access row. **All `null` in the default flow** (§15.0). A non-null `waitingFor` also blocks `arriveReply`, i.e. it halts the whole autopilot timeline (§15.2) |
| `pending.reason` | `'contact'\|'review'` | the extra „Anschreiben ist … deaktiviert“ line |
| `offerStale` | boolean | offer stale banner. Set **only** by the Settings action `updateFact` while `stage ∈ {offer, offer_review}` (§10.1) |
| `offerTalk` | string\|null | `offerPrompt` label, explanation text vs „Mit Scout sprechen“ button |
| `fullTerms` | boolean | terms block + `termsLabel` + `termsRot` |
| `questionOpen` / `qa` | boolean / object | QA panel, chip vs bubbles |
| `clar.userText` / `clar.scoutText` | string\|null | `clarUnanswered` hides the answer buttons and composer; bubbles appear |
| `f.arriving` | boolean | row height/padding/opacity 0 |
| `f.changed` | boolean | row background `rgba(255,105,38,.2)` for 1100 ms (`commitFact`, existing rows only) / 1200 ms (`updateFact`, `compromise`). **Not** set by a newly arriving fact and **not** by the in-card `saveEdit` — see the table in §4 |
| `offer` | one of `CANDS` | `offerTitle`, `offerPriceNum`, `offerTime`, `offerStorage`, `offerPhoto`/`offerHasPhoto`, `reviewTitle`, `reviewPrice`, `completeSummary` |
| `facts` (budget/ort) | labels | `compactBrief`, `budgetNum`, candidate `fits`/`best`/`budgetText`, `pendingText` |
| `flags.voice` | boolean | `startVoice` falls back to text mode + hint (`voiceOff` is exposed but unused in the template). **Default `true`**, so the fallback never fires unless Operator turns it off |
| `rules.mode` / `rules.contact` | `'autopilot'\|'review'` / boolean | whether `attemptContact` produces a `pending` approval card. **Defaults `'autopilot'` / `true`**, so §8.3 is unreachable until Settings → Autonomie is changed |
| `sources[].enabled` / `.access` | booleans / `'connected'\|'public'\|'expired'` | `waitingSource`, `waitingAccess`, the two blocker statuses. **Defaults** put roomscout.dev at `enabled:true, access:'connected'`, so neither fires; with `flags.publicSearch:false` it is also the *only* usable source (§15.0) |
| `prefers-reduced-motion` | media query | instant reveal, no capsule flight, no fade animations |

---

## 18. Copy dictionary (DE)

Every user-visible string on the Scout surface, verbatim. Keys are stable and semantic; nesting is by stage/section. Typography is part of the string („ “ · – — € … ). `{name}` is the only interpolation on this surface unless noted.

### 18.1 `chrome`

```
chrome.wordmark:                    "roomscout"
chrome.badge.running:               "Scout ist unterwegs"
chrome.badge.paused:                "Suche pausiert"
chrome.pause.pause:                 "Suche pausieren"
chrome.pause.resume:                "Suche fortsetzen"
chrome.avatar.aria:                 "Profilmenü"
chrome.menu.subtitle:               "Persönlicher Bereich"
chrome.menu.settings:               "Einstellungen"
chrome.menu.backToScout:            "Zurück zum Scout"
chrome.settingsFooter:              "Designprototyp · Beispieldaten"
```

### 18.2 `toast`

```
toast.action:                       "Zum Scout"
toast.dismiss.aria:                 "Schließen"
toast.approval:                     "Dein Scout wartet auf deine Freigabe"
toast.clarification:                "Dein Scout hat eine Rückfrage"
toast.decision:                     "Dein Scout braucht eine Entscheidung"
toast.candidates:                   "Dein Scout hat Räume zum Vergleichen"
toast.offer:                        "Ein Angebot ist eingegangen"
```

### 18.3 `hint`

```
hint.voiceDisabled:                 "Voice Scout ist in dieser Demo deaktiviert. Das Gespräch läuft im Textmodus."
hint.scoutNotDone:                  "Der Scout ist noch nicht fertig. Gleich kannst du antworten."
hint.freeTextDiscovery:             "Prototyp: Freitext wird hier nicht interpretiert. Nutze den vorbereiteten Antwortvorschlag oder formuliere ihn ähnlich."
hint.sideNote:                      "Prototyp: Zusätzliche Hinweise werden hier nicht interpretiert. Der Scout arbeitet mit dem Suchauftrag weiter."
hint.micSimulatedAutopilot:         "Prototyp: Das Mikrofon ist simuliert. Die Demo läuft ohne Spracheingabe weiter."
hint.clarificationNotUnderstood:    "Prototyp: Diese Antwort wird nicht interpretiert. Antworte mit „Ja, Mittwoch passt“ oder „Nein, Donnerstag ist wichtig“."
hint.micSimulatedClarification:     "Prototyp: Das Mikrofon ist simuliert. Antworte per Klick oder Text."
hint.freeQuestion:                  "Prototyp: Freie Fragen werden hier nicht interpretiert. Nutze die vorbereitete Frage."
```

### 18.4 `transcript`

```
transcript.title:                   "Mitschrift"
transcript.close.aria:              "Mitschrift schließen"
transcript.empty:                   "Noch keine Äußerungen."
transcript.who.scout:               "Dein Scout"
transcript.who.user:                "Du"
```

### 18.5 `welcome`

```
welcome.greeting:                   "Hey {name}."
welcome.headline:                   "Finden wir euren Proberaum."
welcome.cta.voice:                  "Mit Scout sprechen"
welcome.cta.text:                   "Lieber schreiben"
welcome.footnote:                   "Du erzählst. Dein Scout kümmert sich."
```

### 18.6 `discovery`

```
discovery.speaker.scout:            "Dein Scout"
discovery.speaker.user:             "Du"
discovery.state.listening:          "Ich höre zu"
discovery.state.micOff:             "Mikro aus"
discovery.state.thinking:           "Ich denke kurz nach"
discovery.ended:                    "Gespräch beendet. Eure Wünsche bleiben als Entwurf gespeichert."
discovery.controls.micOn:           "Mikro an"
discovery.controls.micOff:          "Mikro aus"
discovery.controls.transcript:      "Mitschrift"
discovery.controls.end:             "Gespräch beenden"
discovery.controls.switchToText:    "Zum Schreiben wechseln"
discovery.input.aria:               "Nachricht an deinen Scout"
discovery.input.placeholder.awaiting:"Antwort an deinen Scout …"
discovery.input.placeholder.busy:   "Dein Scout spricht …"
discovery.send.aria:                "Senden"
discovery.switchToVoice.aria:       "Zum Sprechen wechseln"
discovery.links.transcript:         "Mitschrift"
discovery.links.end:                "Gespräch beenden"
discovery.ended.resume:             "Gespräch fortsetzen"
discovery.ended.viewBrief:          "Suchauftrag ansehen"
discovery.inlineBrief.label:        "Euer Suchauftrag"          # dead binding, never rendered
```

### 18.7 `script` — the scripted dialogue (also the transcript content and the text-mode suggestions)

```
script.s1.scout:                    "Hey Herzbuben! Erzählt mir kurz: Wo sucht ihr und was ist euch wichtig?"
script.s2.user:                     "Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 400 Euro im Monat."
script.s3.scout:                    "Welche Tage passen euch zum Proben?"
script.s4.user:                     "Donnerstags ab 19 Uhr wäre gut."
script.s5.scout:                    "Gibt es etwas, das im Raum vorhanden sein oder dort bleiben muss?"
script.s6.user:                     "Unser eigenes Schlagzeug muss dort stehen bleiben können. Verstärker bringen wir mit."
script.s7.user:                     "Und beim Budget lieber maximal 350 Euro."
script.s8.scout:                    "Alles klar, maximal 350 Euro. So würde ich für euch suchen. Soll ich loslegen?"
script.memory.amps:                 "Verstärker bringt die Band mit"
script.resumeSuggestion:            "Ja, leg los."
```

### 18.8 `facts` — fact labels

```
facts.ort:                          "Stuttgart"
facts.ort.umland:                   "Stuttgart & Umland"
facts.budget.400:                   "Bis 400 € / Monat"
facts.budget.350:                   "Bis 350 € / Monat"
facts.band:                         "Geteilter Raum · 4 Personen"
facts.zeit.donnerstag:              "Donnerstags ab 19 Uhr"
facts.zeit.mittwochOderDonnerstag:  "Mittwoch oder Donnerstag ab 19 Uhr"
facts.equip:                        "Schlagzeug darf im Raum bleiben"
```

### 18.9 `brief` (fact card, mobile sheet, brief stage)

```
brief.headline:                     "So suche ich für euch."
brief.title:                        "Euer Suchauftrag"
brief.edit.aria:                    "Suchauftrag bearbeiten"
brief.editRow.aria:                 "Kriterium bearbeiten"
brief.cta:                          "Scout losschicken"
brief.caption.line1:                "Ich suche und frage selbstständig an."
brief.caption.line2:                "Eine verbindliche Zusage gibst nur du."
brief.changeMore:                   "Noch etwas ändern"
brief.backToConvo:                  "Zurück zum Gespräch"
brief.save:                         "Übernehmen"
brief.cancel:                       "Abbrechen"
brief.sheet.count.one:              "1 Wunsch gemerkt"
brief.sheet.count.other:            "{count} Wünsche gemerkt"
```

### 18.10 `autopilot`

```
autopilot.headline:                 "Ich kümmere mich darum."
autopilot.resume:                   "Fortsetzen"
autopilot.status.start:             "Alles klar. Ich suche passende Räume und kläre die Details. Ich melde mich, wenn ich euch brauche."
autopilot.status.searching:         "Ich suche nach passenden Räumen in Stuttgart."
autopilot.status.found:             "Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details."
autopilot.status.asked:             "Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist."
autopilot.status.waiting:           "Jetzt warte ich auf eine Antwort."
autopilot.status.followUp:          "Ich bestätige, dass Mittwoch für euch möglich ist, und lasse mir das Angebot geben."
autopilot.status.alternative:       "Ich frage nach einer Alternative zu Mittwoch und suche weiter."
autopilot.status.noSource:          "Aktuell ist keine nutzbare Quelle für Anfragen ausgewählt. Wähle eine Quelle in den Einstellungen."
autopilot.status.noAccess:          "Mein Zugang zu roomscout.dev braucht eine neue Anmeldung, bevor ich anfragen kann."
autopilot.status.prepared:          "Ich habe eine Anfrage vorbereitet. Sie geht erst raus, wenn du sie freigibst."
autopilot.status.searchAgain:       "Ich suche erneut mit den neuen Kriterien."
autopilot.status.requestOffer:      "Ich frage beim {roomName} nach einem Angebot und kläre die Details."
autopilot.status.keepSearching:     "Alles klar, ich suche weiter und melde mich, sobald sich etwas Neues ergibt."
autopilot.status.keepWaiting:       "Alles klar, ich suche im Hintergrund weiter und melde mich."
autopilot.approval.eyebrow:         "Freigabe nötig"
autopilot.approval.toLabel:         "An: "
autopilot.approval.to:              "Anbieter · Raum in Stuttgart-West · roomscout.dev"
autopilot.approval.message:         "Hallo, wir sind {name}, eine vierköpfige Band aus Stuttgart. Wir suchen einen geteilten Proberaum, {budget}, donnerstags ab 19 Uhr. Wichtig wäre, dass unser Schlagzeug im Raum bleiben kann. Ist der Raum in Stuttgart-West noch verfügbar? Viele Grüße, {name} (über RoomScout)"
autopilot.approval.contactOff:      "Anschreiben ist in deinem Handlungsspielraum deaktiviert. Diese Nachricht geht nur mit deiner ausdrücklichen Freigabe raus."
autopilot.approval.release:         "Nachricht freigeben"
autopilot.approval.changeAutonomy:  "Handlungsspielraum ändern"
autopilot.blocked.chooseSource:     "Quelle auswählen"
autopilot.blocked.accessText:       "Dein Portalzugang zu roomscout.dev braucht eine neue Anmeldung."
autopilot.blocked.accessLink:       "Zu den Zugängen"
autopilot.briefPill:                "Stuttgart · bis 350 €"   # = "Stuttgart · " + budget without "Bis "/" / Monat"
autopilot.brief.title:              "Euer Suchauftrag"
autopilot.activity.show:            "Aktivität ansehen"
autopilot.activity.hide:            "Aktivität ausblenden"
autopilot.sideNote.placeholder:     "Möchtest du mir noch etwas sagen?"
autopilot.sideNote.aria:            "Nachricht an deinen Scout"
autopilot.sideNote.voice.aria:      "Mit Scout sprechen"
autopilot.footnote:                 "Du kannst die App schließen. Ich melde mich."
```

### 18.11 `activity` — activity-list entries

```
activity.start:                     "Suchauftrag gestartet"
activity.found:                     "Raum in Stuttgart-West gefunden"
activity.found.meta:                "roomscout.dev · Demo-Portal"
activity.contacted:                 "Anbieter über das Portal kontaktiert"
activity.waiting:                   "Warte auf Antwort"
activity.notif:                     "Benachrichtigung aus dem Portal erhalten"
activity.read:                      "Neue Nachricht im Portal gelesen"
activity.confirmed:                 "Mittwoch bestätigt, Angebot angefragt"
activity.alt:                       "Alternative zu Mittwoch angefragt"
activity.offer:                     "Angebot eingegangen"
activity.declined:                  "Anbieter hat abgesagt: Donnerstag nicht möglich"
activity.noMatch:                   "Kein weiterer passender Raum in Stuttgart gefunden"
activity.found2:                    "Drei Räume zum Vergleich zusammengestellt"
activity.found2.meta:               "roomscout.dev · Demo-Portal"
activity.briefAdjusted:             "Suchauftrag angepasst: {label}"
activity.offerRequested:            "Angebot angefragt: {short}"
```

### 18.12 `clarification`

```
clarification.headline:             "Eine kurze Rückfrage."
clarification.eyebrow:              "Raum in Stuttgart-West"
clarification.question:             "Donnerstag ist leider belegt. Wäre Mittwoch ab 19 Uhr auch möglich?"
clarification.detail:               "280 € inklusive Nebenkosten. Euer Schlagzeug kann im Raum bleiben."
clarification.yes:                  "Ja, Mittwoch passt"
clarification.no:                   "Nein, Donnerstag ist wichtig"
clarification.yes.userText:         "Ja, Mittwoch passt auch."
clarification.no.userText:          "Nein, Donnerstag ist wichtig."
clarification.yes.reply:            "Alles klar, Mittwoch geht also auch. Ich kläre den Rest."
clarification.no.reply:             "Verstanden. Donnerstag bleibt gesetzt. Ich frage nach einer passenden Alternative und suche weiter."
clarification.input.placeholder:    "Nachricht an deinen Scout …"
clarification.input.aria:           "Antwort an deinen Scout"
clarification.send.aria:            "Senden"
clarification.voice:                "Sprechen"
```

### 18.13 `offer`

```
offer.headline:                     "Ein Raum, der zu euch passt."
offer.stale.text:                   "Nach deiner Änderung muss das Angebot erneut geprüft werden."
offer.stale.link:                   "Angaben ansehen"
offer.photo.alt:                    "Proberaum mit Schlagzeug und Akustikpaneelen"
offer.photo.pending:                "Foto folgt vom Anbieter"
offer.eyebrow:                      "Angebot eingegangen"
offer.title:                        "Euer {roomName}"                # → "Euer Raum in Stuttgart-West"
offer.price.perMonth:               "/ Monat"
offer.price.note:                   "inklusive Nebenkosten"
offer.cta:                          "Angebot prüfen"
offer.footnote:                     "Vor einer Zusage schauen wir uns alle Konditionen an."
offer.prompt:                       "Soll ich euch das Angebot erklären?"
offer.prompt.speaking:              "Dein Scout"
offer.talk:                         "Das Angebot liegt bei 280 Euro inklusive Nebenkosten. Ihr könnt mittwochs von 19 bis 22 Uhr proben, und euer Schlagzeug darf bleiben. Soll ich euch die übrigen Konditionen erklären?"
offer.talkCta:                      "Mit Scout sprechen"
offer.brief.title:                  "Euer Suchauftrag"
offer.briefPill:                    "Suchauftrag"
```

### 18.14 `review`

```
review.headline:                    "Passt das für euch?"
review.price.note:                  "inklusive Nebenkosten"
review.terms.shared:                "Geteilter Raum · 4 Personen"
review.terms.storage:               "Schlagzeug-Lagerung bestätigt"
review.terms.start:                 "Beginn: 1. Oktober 2026"
review.terms.deposit:               "Keine Kaution"
review.terms.notice:                "Kündigungsfrist: ein Monat zum Monatsende"
review.terms.show:                  "Vollständige Bedingungen anzeigen"
review.terms.hide:                  "Vollständige Bedingungen ausblenden"
review.terms.full:                  "Geteilte Nutzung des Raums in Stuttgart-West durch vier Bandmitglieder, mittwochs 19–22 Uhr. Miete 280 € monatlich inklusive Nebenkosten, Beginn 1. Oktober 2026. Keine Kaution. Kündigungsfrist ein Monat zum Monatsende. Das eigene Schlagzeug darf dauerhaft im Raum gelagert werden. Verstärker werden von der Band mitgebracht."
review.terms.demoNote:              "Demo-Bedingungen. Im echten Produkt wäre hier das vollständige Angebot des Anbieters einsehbar."
review.accept:                      "Angebot annehmen"
review.accept.disclaimer:           "Mit deiner Bestätigung würde der Scout dem Anbieter verbindlich zusagen. In dieser Demo wird nichts versendet."
review.question.toggle:             "Noch eine Frage klären"
review.question.prepared:           "Was passiert nach der Zusage?"
review.question.answer:             "Ich sage dem Anbieter verbindlich zu und schicke euch die Bestätigung mit allen Bedingungen. Ihr könnt ab dem 1. Oktober proben. In dieser Demo wird nichts versendet."
review.question.placeholder:        "Frage an deinen Scout …"
review.question.aria:               "Frage an deinen Scout"
review.question.send.aria:          "Senden"
```

### 18.15 `complete`

```
complete.headline:                  "Euer nächster Proberaum steht bereit."
complete.subline:                   "Demo abgeschlossen — es wurde keine echte Zusage versendet."
complete.summary:                   "{short} · {price} · {timeLower}"   # z. B. "Stuttgart-West · 280 € / Monat · mittwochs 19–22 Uhr"
complete.restart:                   "Demo erneut ansehen"
```

### 18.16 `deadEnd`

```
deadEnd.headline:                   "Da komme ich gerade nicht weiter."
deadEnd.eyebrow:                    "Raum in Stuttgart-West"
deadEnd.body:                       "Der Anbieter kann Donnerstag nicht anbieten. Weitere Räume in Stuttgart, die zu eurem Suchauftrag passen, habe ich aktuell nicht gefunden."
deadEnd.prompt:                     "Was wäre für euch denkbar? Ich passe den Suchauftrag nur an, wenn ihr es sagt."
deadEnd.option.budget.title:        "Budget bis 400 €"
deadEnd.option.budget.sub:          "Erweitert die Suche in Stuttgart um weitere Räume."
deadEnd.option.umland.title:        "Umland einbeziehen"
deadEnd.option.umland.sub:          "Esslingen, Ludwigsburg, Fellbach · 20 bis 30 Minuten Weg."
deadEnd.option.zeit.title:          "Mittwoch doch erlauben"
deadEnd.option.zeit.sub:            "Der Raum in Stuttgart-West wäre dann verfügbar. Donnerstag bleibt gemerkt."
deadEnd.keepWaiting:                "Nichts ändern, weiter suchen lassen"
deadEnd.reply.budget:               "Alles klar, bis 400 Euro. Ich suche erneut in Stuttgart."
deadEnd.reply.umland:               "Alles klar, ich beziehe das Umland ein: Esslingen, Ludwigsburg und Fellbach."
deadEnd.reply.zeit:                 "Alles klar, Mittwoch geht also auch. Ich frage den Raum in Stuttgart-West erneut an."
```

### 18.17 `candidates`

```
candidates.headline:                "Drei Räume, die in Frage kommen."
candidates.subline:                 "Ich habe die Unterschiede nebeneinander gelegt. Ihr entscheidet, wo ich anfrage."
candidates.badge.best:              "Mein Vorschlag"
candidates.photo.pending:           "Foto folgt vom Anbieter"
candidates.budget.ok:               "Im Budget"
candidates.budget.over:             "Über eurem Budget ({budget} €)"
candidates.cta:                     "Diesen Raum anfragen"
candidates.keepSearching:           "Keiner passt, weiter suchen"
candidates.west.name:               "Raum in Stuttgart-West"
candidates.west.short:              "Stuttgart-West"
candidates.west.price:              "280 € / Monat"
candidates.west.time:               "Mittwochs, 19–22 Uhr"
candidates.west.timeLower:          "mittwochs 19–22 Uhr"
candidates.west.storage:            "Schlagzeug kann im Raum bleiben"
candidates.west.way:                "12 Min. mit der Stadtbahn"
candidates.west.size:               "ca. 28 m² · geteilt mit einer Band"
candidates.west.note:               "Günstigster Raum, aber nur mittwochs frei."
candidates.esslingen.name:          "Raum in Esslingen"
candidates.esslingen.short:         "Esslingen"
candidates.esslingen.price:         "320 € / Monat"
candidates.esslingen.time:          "Donnerstags, 19–23 Uhr"
candidates.esslingen.timeLower:     "donnerstags 19–23 Uhr"
candidates.esslingen.storage:       "Schlagzeug kann im Raum bleiben"
candidates.esslingen.way:           "25 Min. mit der S-Bahn"
candidates.esslingen.size:          "ca. 35 m² · geteilt mit zwei Bands"
candidates.esslingen.note:          "Euer Wunschtag, dafür im Umland."
candidates.ost.name:                "Raum in Stuttgart-Ost"
candidates.ost.short:               "Stuttgart-Ost"
candidates.ost.price:               "350 € / Monat"
candidates.ost.time:                "Donnerstags, ab 20 Uhr"
candidates.ost.timeLower:           "donnerstags ab 20 Uhr"
candidates.ost.storage:             "Schlagzeug müsste abgebaut werden"
candidates.ost.way:                 "18 Min. mit der Stadtbahn"
candidates.ost.size:                "ca. 22 m² · geteilt mit drei Bands"
candidates.ost.note:                "Am Budgetlimit, und das Schlagzeug kann nicht bleiben."
```

### 18.18 `demo` — prototype-only, **NOT to be built** (kept for completeness)

```
demo.label:                         "Prototyp · Beispieldaten"
demo.collapsed:                     "Prototyp · Demo-Steuerung"
demo.play:                          "Abspielen"
demo.pause:                         "Pausieren"
demo.next:                          "Nächster Schritt"
demo.restart:                       "Zurück zum Anfang"
demo.chapter.aria:                  "Kapitel"
demo.chapter.welcome:               "1 · Willkommen"
demo.chapter.discovery:             "2 · Gespräch"
demo.chapter.brief_review:          "3 · Suchauftrag"
demo.chapter.scouting:              "4 · Autopilot"
demo.chapter.waiting:               "5 · Warten"
demo.chapter.clarification:         "6 · Rückfrage"
demo.chapter.following_up:          "7 · Klärung"
demo.chapter.dead_end:              "7b · Sackgasse"
demo.chapter.candidates:            "7c · Kandidaten"
demo.chapter.offer:                 "8 · Angebot"
demo.chapter.offer_review:          "9 · Prüfung"
demo.chapter.complete:              "10 · Abschluss"
demo.speed.aria:                    "Tempo"
demo.speed.1x:                      "1×"
demo.speed.1_6x:                    "1.6×"
demo.mobile:                        "Mobil"
demo.settings:                      "Einstellungen"
demo.operator:                      "Betreiberansicht"
demo.incident:                      "Beispielstörung laden"
demo.hide.aria:                     "Steuerung ausblenden"
demo.hide.title:                    "Ausblenden"
```

### 18.19 Strings produced here but consumed by the Settings surface

```
data.name.default:                  "Herzbuben"
data.initials.default:              "HB"
data.session.held:                  "Gespräch pausiert · läuft weiter, wenn du zurückkehrst"
data.session.paused:                "Suche pausiert"
data.session.running:               "Scout ist unterwegs"
data.usage.talk:                    "Noch nicht erfasst"
data.export.hinweis:                "Lokale Demo-Daten des Designprototyps"
data.knowledge.origin.conversation: "Aus dem Gespräch · Teil eures Suchauftrags"
data.log.factCorrected:             "Angabe korrigiert: {label}"
data.log.briefAdjusted:             "Suchauftrag angepasst: {label}"
data.log.rulesUpdated:              "Handlungsspielraum aktualisiert"
data.log.knowledgeImported:         "{count} Angaben aus Beispiel-Kontext übernommen"
data.summary.empty:                 "Ich weiß noch nichts über euch. Erzähl es mir beim nächsten Gespräch."
data.summary.pattern:               "Ihr seid eine [vierköpfige ]Band[ aus {ort}]. Ihr sucht einen [geteilten ]Proberaum[ und möchtet euer Schlagzeug dort lassen]."
data.knowledge.genre:               "Hardrock und Alternative"
data.knowledge.genre.origin:        "Demo-Bandprofil"
data.knowledge.mates:               "Ähnliche Musikrichtung bei Mitnutzern wichtig"
data.knowledge.mates.origin:        "Annahme deines Scouts"
data.knowledge.amps:                "Verstärker bringt ihr selbst mit"
data.knowledge.amps.origin:         "Aus dem Gespräch"
data.source.roomscout.name:         "roomscout.dev"
data.source.roomscout.desc:         "Kontrolliertes Demo-Portal"
data.source.musiker.name:           "Musiker in deiner Stadt"
data.source.musiker.desc:           "Stuttgart · Öffentliche Anzeigen"
data.source.bandnet.name:           "Bandnet Hamburg"
data.source.bandnet.desc:           "Hamburg · Andere Region"
data.time.today:                    "Heute, {h}:{mm}"
```

---

## 19. Porting notes / open items

1. **Dead bindings** to decide on — the complete list, verified as 0 references in template lines 1–645:

   | Binding | Value in `renderVals()` | Note |
   |---|---|---|
   | `showSummaryChip` | hard-coded `false` | gates the discovery summary chip; the markup exists but never renders (§6.5) |
   | `summaryText` | hard-coded `''` | its label |
   | `briefOpenInline` | hard-coded `false` | gates the inline discovery brief panel (§6.5) |
   | `deadBudget` | `"Bis " + (budgetNum + 50) + " €"` → „Bis 400 €“ | §13 hard-codes „Budget bis 400 €“ in the template, so the two only agree by coincidence |
   | `voiceOff` | `!flags.voice` | the fallback is handled inside `startVoice` instead |
   | `cands[].outside` | `!inArea` | the out-of-area marker was never built (§14) |
   | `cands[].fits` / `.over` | price test | only `budgetText`/`budgetColor` are rendered |
   | **`offerShort`** | `offer.short` → „Stuttgart-West“ | exposed but unused; `completeSummary` builds its own string from `offer.short` |
2. **The blob is measured, not laid out.** Porting it needs a ref-based hook that reads the active `[data-blob-anchor]` on every render and on resize, adding the scroll offset of the scroll container.
3. **Two brief presentations must stay one component** with two style sets (`float` / `card` on desktop, pill / bottom card on narrow), otherwise the 0.9 s morph is lost.
4. **`narrow` is `≤ 959px`**, not a Tailwind default breakpoint (`md` = 768, `lg` = 1024). Define a custom `narrow` screen at `max-width: 959px` or a `min-width: 960px` `wide` screen.
5. Card radii cluster on 12/14/16/20/22/24/26 px and pills are all `999px`; the shadcn `--radius` scale should be extended rather than rounded to the nearest default.
6. **Hover styles — all 16 distinct `style-hover` values.** Fourteen are pure background/colour lifts (no shadow ever changes on hover; the primary buttons' glow is static). **Two are not**, and must not be flattened into a colour change:

   | `style-hover` | × | Where |
   |---|---|---|
   | `color:#fff` | 15 | every quiet/underlined text button, brief pills, demo-bar close |
   | `background:#ff7a3d` | 11 | primary orange buttons |
   | `background:rgba(255,255,255,.14)` | 10 | send buttons, demo-bar buttons |
   | `background:rgba(255,255,255,.1)` | 7 | header buttons, outline buttons |
   | `color:#f5ece2` | 3 | „Zum Schreiben wechseln“, discovery link row |
   | `background:rgba(255,255,255,.09)` | 3 | dead-end option rows |
   | `background:rgba(255,255,255,.08)` | 3 | edit (pencil) button, „Abbrechen“ |
   | `color:#ff8a4e` | 2 | „Angaben ansehen“ (stale banner), „Zu den Zugängen“ |
   | `background:rgba(255,255,255,.12)` | 2 | transcript circle + transcript-sheet close |
   | `background:rgba(255,255,255,.07)` | 2 | profile-menu items |
   | `background:rgba(255,105,38,.22)` | 2 | suggestion chip, QA chip |
   | `background:rgba(255,105,38,.26)` | 1 | „Ja, Mittwoch passt“ |
   | `background:rgba(30,22,16,.7)` | 1 | autopilot brief pill |
   | `background:#c9463a` | 1 | „Gespräch beenden“ circle |
   | **`background:#ff7a3d;transform:translateY(-1px)`** | 1 | **welcome primary CTA „Mit Scout sprechen“** — the only hover that moves an element (paired with `transition:transform .2s,background .2s` on the base style) |
   | **`filter:brightness(1.1)`** | 1 | **candidate CTA „Diesen Raum anfragen“** — a filter, applied to *both* the orange best-card variant and the translucent non-best variant, so the effect differs per card |
7. The `<img>` in the review card always renders `assets/proberaum.png` even for photo-less candidates; keep or fix deliberately.
