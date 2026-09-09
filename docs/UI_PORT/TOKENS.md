# RoomScout UI Port — Design Tokens

**Source of truth:** `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype`
**Files scanned:** `Roomscout.dc.html`, `Settings.dc.html`, `Operator.dc.html`, `Landing v2.dc.html`
**Fifth file, deliberately out of scope:** `Landing.dc.html` (23 KB) is **v1 of the landing page and is superseded by `Landing v2.dc.html`** — see `LANDING_SCREENS.md` §0 "What v2 changed" and §17.12 for the full v1/v2 diff. None of its tokens are in scope for the port. Two things exist only in v1 and are *not* to be carried over: the `@keyframes rsSpeak` block (v2 removed the speech-bubble animation) and the `input::placeholder{color:#9c8b7b}` rule (v2 dropped it — see §F18). Its `narrow` breakpoint is also different (`window.innerWidth < 900` vs. v2's `< 880`) and its background parallax factor is `−0.04` vs. v2's `−0.03`.
**Companion file:** [`tokens.proposed.css`](./tokens.proposed.css) — ready-to-paste `:root`, `@theme inline`, keyframes and background recipe.

> **This document contains no copy.** It is a *token* reference; every German string lives verbatim in the sibling screen specs — [`SCOUT_SCREENS.md`](./SCOUT_SCREENS.md), [`SETTINGS_SCREENS.md`](./SETTINGS_SCREENS.md), [`OPERATOR_SCREENS.md`](./OPERATOR_SCREENS.md), [`LANDING_SCREENS.md`](./LANDING_SCREENS.md). Where a token is only identifiable by the text that sits on it (the photo-placeholder hatch, the welcome tagline), the string is quoted here **verbatim from the source** and cross-checked against those docs. Never invent a German label to describe a token.

> Everything in Part A was produced mechanically from the four `.dc.html` files by splitting every inline `style` / `style-hover` attribute on `;` and grouping the resulting declarations; the `<style>` blocks and the `data-dc-script` React source are inventoried separately (§A0, §A2, §A2b). Counts are exact and were re-verified with `grep -o` per file. Parts B–F are curated on top of that inventory.

---

## 0 · Method & legend

The prototype ships **no classes and no CSS variables**. All styling is either

1. an inline `style="…"` attribute — **1 017** across the four files (R:322 S:339 O:162 L:194),
2. a `style-hover="…"` attribute — **143** (R:65 S:51 O:15 L:12); the Claude-Design runtime turns it into a `:hover` rule,
3. one small `<style>` block per file inside `<helmet>` (resets, focus ring, placeholder, `@keyframes`), or
4. a colour string inside the React source in `<script type="text/x-dc" data-dc-script>` — bound into the template through `{{ … }}` props (e.g. `badgeDotColor`, `micShadow`, `autoCardBorder`). **These JS-only literals are part of the token system** and are inventoried in §A2; the non-colour `{{ … }}` values (sizes, radii, paddings, grid tracks) are resolved in **§A2b**.

Together that is 1 160 style attributes — 1 017 `style` + 143 `style-hover`. Splitting them on `;` yields **5 899 declarations**, which is what every count in Part A is drawn from.

Template elements seen (relevant to the port, not to tokens): `<sc-if value="{{ … }}">` (**209×** — R:92 S:78 O:36 L:3), `<sc-for list="{{ … }}" as="…" hint-placeholder-count="n">` (**37×** — R:9 S:11 O:11 L:6), `<dc-import name="Settings|Operator" …>` (2×, both in Roomscout — it embeds the two shells as children, which is why Settings/Operator have no background of their own).

**File legend used in every table:** `R` = Roomscout · `S` = Settings · `O` = Operator · `L` = Landing v2.
`R:49 S:49 O:16 L:10` means 49 occurrences in Roomscout, 49 in Settings, and so on.

### 0.1 · Breakpoints — the definition of `narrow`

Every `narrow`-conditional token in this document (§A2b, §C5, §D4) depends on these three switches. They are **JS-derived, not CSS media queries** (except the one `matchMedia` below), so the port must reproduce them as state, not as `@media` alone.

| File | Definition | Source |
|---|---|---|
| **Roomscout** | `this.mq = window.matchMedia('(max-width: 959px)')` → `this.setState({ narrow: this.mq.matches })` on mount and on `change`; the render then uses `const narrow = s.narrow \|\| mobile` | `Roomscout.dc.html:829` and `:1014` |
| **Roomscout `mobile`** | editor prop declared in `data-props`: `{"mobile":{"editor":"boolean","default":false,"tsType":"boolean","section":"Vorschau"}}`. When true it *also* forces `narrow` **and** wraps the app in the 390 × `min(844px, calc(100% - 32px))` phone frame (§A2b). Preview size `1440 × 900`. | `data-props` on the `data-dc-script` tag |
| **Landing v2** | `const narrow = window.innerWidth < 880, scrolled = window.scrollY > 40;` — recomputed in the scroll handler | `Landing v2.dc.html:284` |
| **Landing v2 `scrolled`** | drives `hdrH` (80 → 64), `hdrBg` (`transparent` → `rgba(11,10,9,.72)`), `hdrBlur` (`none` → `blur(12px)`), `hdrLine` (`transparent` → `rgba(255,220,190,.1)`) | `Landing v2.dc.html:327` |
| **Settings / Operator** | no breakpoint of their own — they inherit the width they are given by the Roomscout host (`max-width:1380px`). Settings' `data-props` preview size is `1360 × 820`, Operator's `1440 × 900`. | — |

Landing v2 also runs a background parallax in the same handler: `bgRef.style.transform = 'scaleX(-1) translateY(' + (window.scrollY * -0.03) + 'px)'`, and un-tilts the hero card from `rotateX(14deg) scale(.96)` to `rotateX(0) scale(1)` over `(vh*0.92 − cardTop) / (vh*0.55)`. Both are skipped when `prefers-reduced-motion` matches.

---

## Part A — Raw inventory

### A0 · Global CSS, fonts and keyframes (verbatim)

#### Google Fonts

```html
<!-- Roomscout only -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<!-- all four files -->
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
```

One family, four weights: **Geist 300 / 400 / 500 / 600**. Stack used everywhere:
`font-family:'Geist',system-ui,sans-serif` (declared once per root element; every `<button>` then inherits it through `font:inherit`, which appears **146×**).
One secondary stack, Roomscout only: `font-family:ui-monospace,Menlo,monospace` (4×). **Two of the four are shipped, user-facing UI — not dev chrome:**

| # | Line | Declaration (verbatim) | What it is |
|---|---|---|---|
| 1 | `Roomscout.dc.html:316` | `min-height:{{ offerImgMin }}px;height:100%;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#a89684` | **offer-card photo placeholder** over the hatch; the only text on it is „Foto folgt vom Anbieter“ |
| 2 | `Roomscout.dc.html:455` | `height:150px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:#a89684` | **candidate-card photo placeholder**, same copy „Foto folgt vom Anbieter“ |
| 3 | `Roomscout.dc.html:609` | `display:flex;align-items:center;gap:6px;padding:6px 8px 6px 12px;border-radius:12px;background:rgba(10,8,7,.88);border:1px solid rgba(255,255,255,.1);font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#a89684;flex-wrap:wrap;backdrop-filter:blur(8px)` | dev bar (prototype-only, **do not ship**) |
| 4 | `Roomscout.dc.html:641` | `height:28px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(10,8,7,.8);color:#a89684;font-family:ui-monospace,Menlo,monospace;font-size:11px;cursor:pointer` + `style-hover="color:#fff"` | dev-bar re-open button (**do not ship**) |

So the port **does** need a monospace stack, at `13px` / `12.5px`, for the two photo placeholders.

#### `<style>` blocks, verbatim

**Roomscout.dc.html**

```css
html,body{margin:0;padding:0;background:#0b0a09;}
*{box-sizing:border-box}
a{color:#f5ece2}a:hover{color:#ff6926}
button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
input::placeholder{color:#9c8b7b}
@keyframes rsBreathe{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.04) rotate(-4deg);border-radius:54% 46% 58% 42%/50% 44% 56% 50%}}
@keyframes rsSpeak{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}30%{transform:scale(1.07) rotate(4deg);border-radius:46% 54% 60% 40%/58% 40% 60% 42%}65%{transform:scale(.97) rotate(-3deg);border-radius:56% 44% 40% 60%/48% 62% 38% 52%}}
@keyframes rsListen{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.02) rotate(8deg);border-radius:56% 44% 52% 48%/56% 46% 54% 44%}}
@keyframes rsFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes rsDot{0%,100%{opacity:.4}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

**Settings.dc.html**

```css
button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
input::placeholder,textarea::placeholder{color:#9c8b7b}
@keyframes stFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

**Operator.dc.html**

```css
button:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
@keyframes opFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

**Landing v2.dc.html**

```css
html,body{margin:0;padding:0;background:#0b0a09;scroll-behavior:smooth}
*{box-sizing:border-box}
a{color:#f5ece2}a:hover{color:#ff6926}
button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
@keyframes rsBreathe{…identical to Roomscout…}
@keyframes rsListen{…identical to Roomscout…}
@keyframes lpDot{0%,100%{opacity:.4}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

#### All `@keyframes`, full bodies

| Name | Files | Identical across files | Body |
|---|---|---|---|
| `rsBreathe` | R, L | yes | `0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.04) rotate(-4deg);border-radius:54% 46% 58% 42%/50% 44% 56% 50%}` |
| `rsSpeak` | R | — | `0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}30%{transform:scale(1.07) rotate(4deg);border-radius:46% 54% 60% 40%/58% 40% 60% 42%}65%{transform:scale(.97) rotate(-3deg);border-radius:56% 44% 40% 60%/48% 62% 38% 52%}` |
| `rsListen` | R, L | yes | `0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.02) rotate(8deg);border-radius:56% 44% 52% 48%/56% 46% 54% 44%}` |
| `rsFadeUp` | R | — | `from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}` |
| `stFade` | S | — | `from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}` |
| `opFade` | O | — | `from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}` |
| `rsDot` | R | — | `0%,100%{opacity:.4}50%{opacity:1}` |
| `lpDot` | L | — | `0%,100%{opacity:.4}50%{opacity:1}` |

`stFade`, `opFade` are byte-identical; `rsDot`, `lpDot` are byte-identical; `rsFadeUp` differs from `stFade`/`opFade` only in the travel distance (8px vs 6px). → **4 unique keyframes** are enough for the port (see §F).

**Blob animation map** (Roomscout JS, prop `blobAnim`):

```js
blobAnim: { speaking:  'rsSpeak 1.7s ease-in-out infinite',
            listening: 'rsListen 4.2s ease-in-out infinite',
            thinking:  'rsBreathe 2.4s ease-in-out infinite',
            idle:      'rsBreathe 5.2s ease-in-out infinite' }
```

Landing v2 uses `mode === 'listening' ? 'rsListen 4.2s ease-in-out infinite' : 'rsBreathe 5.2s ease-in-out infinite'`, plus two hard-coded `rsBreathe 6s ease-in-out infinite` / `rsBreathe 5.2s ease-in-out infinite` decorations.

**Live-dot animation** (Roomscout JS, prop `badgeDotAnim`): `s.searchPaused ? 'none' : 'rsDot 2.4s ease-in-out infinite'`. Landing: `lpDot 2.4s ease-in-out infinite`.

#### A1 · Colours — every literal found in inline styles (128 distinct: 127 in `style`/`style-hover`, plus `#9c8b7b`, which exists only in the `<style>` blocks)

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `#f5ece2` | 124 | R:49 S:49 O:16 L:10 | Primary ink. `color:` on every default text node; also `a{color}`. |
| `#a89684` | 113 | R:26 S:44 O:27 L:16 | Hint ink — captions, uppercase eyebrows, footnotes, disabled button label. |
| `#cbb9a8` | 98 | R:16 S:45 O:24 L:13 | Muted ink — sub-headlines (19px), secondary rows, badge label. |
| `#ffffff` | 68 | R:32 S:21 O:3 L:12 | `color:#fff` on orange/red filled buttons; hover ink on landing links. |
| `#e2d3c3` | 49 | R:20 S:14 O:7 L:8 | Secondary ink — body copy in panels, inactive nav icon. |
| `#ff6926` | 47 | R:19 S:11 O:3 L:14 | Signal orange. Filled CTA bg, focus-ring outline, live dot, mic-on bg, active ring. |
| `rgba(255,220,190,.1)` | 44 | R:3 S:28 O:12 L:1 | Hairline divider — `border-bottom` of list rows / section separators. |
| `rgba(255,255,255,.04)` | 34 | R:8 S:20 O:6 | Quiet panel & ghost-control fill (most common surface). |
| `#ff8a4e` | 29 | R:5 S:9 O:6 L:9 | Accent ink — active nav icon, uppercase eyebrows, quiet links; blob gradient stop 2. |
| `#ff7a3d` | 27 | R:12 S:8 O:2 L:5 | Primary hover — appears ONLY inside `style-hover` on `#ff6926` buttons. |
| `rgba(255,220,190,.28)` | 26 | R:3 S:19 O:4 | Strong control outline — pill buttons, selects, secondary buttons. |
| `rgba(255,255,255,.1)` | 25 | R:9 S:12 O:3 L:1 | Hover fill for ghost controls (most common `style-hover` value). |
| `rgba(255,200,160,.14)` | 23 | R:8 S:4 O:2 L:9 | Card / panel border (default). |
| `rgba(255,200,160,.16)` | 21 | R:11 S:6 O:1 L:3 | Card border, emphasised: search pill, sheet, menu, shell inner panels. |
| `rgba(255,255,255,.06)` | 20 | R:11 S:5 O:3 L:1 | Input fill, 40px icon buttons, Scout chat bubble. |
| `rgba(255,220,190,.08)` | 18 | S:4 O:9 L:5 | Sidebar / nav hairline (`border-right`, `border-bottom`). |
| `rgba(255,255,255,.08)` | 18 | R:6 S:11 O:1 | 42–44px icon buttons; menu-item hover. |
| `rgba(255,255,255,.12)` | 13 | R:3 S:4 O:1 L:5 | Hover fill (stronger) + 1px vertical rules. |
| `rgba(255,200,160,.12)` | 12 | R:2 S:6 O:2 L:2 | Inner card border in Settings sections. |
| `rgba(255,255,255,.03)` | 12 | S:7 O:5 | Settings inner card fill (quietest surface). |
| `#d8c8b8` | 11 | R:10 L:1 | Tertiary ink — quiet underlined text-buttons. R:10 under the stage; **L:1 is the same treatment** — `Landing v2.dc.html:143` `align-self:flex-start;border:0;background:none;color:#d8c8b8;font:inherit;font-size:14.5px;cursor:pointer;padding:6px 4px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35)` + `style-hover="color:#fff"`. Not Roomscout-only. |
| `rgba(255,255,255,.05)` | 11 | R:6 S:3 L:2 | Diagonal hatch stripe A; faint fill. |
| `rgba(255,220,190,.4)` | 10 | S:6 O:4 | `text-decoration-color` of underlined text-buttons (Settings/Operator). |
| `rgba(255,255,255,.14)` | 10 | R:10 | Strongest ghost hover. **All 10 are `style-hover="background:rgba(255,255,255,.14)"`** — R:169/294 (44px & 42px round submit buttons) and R:611/615/616/631/633/634/635/636 (dev bar). It is *not* the toggle-on colour — see §A2. |
| `rgba(18,14,12,.72)` | 9 | R:8 L:1 | Stage card / offer panel fill (the main translucent card). |
| `rgba(255,220,190,.22)` | 8 | R:3 S:2 O:1 L:2 | Round icon-button border on the stage. |
| `rgba(255,220,190,.35)` | 8 | R:7 L:1 | `text-decoration-color` (Roomscout) and inactive activity dot. |
| `rgba(0,0,0,.3)` | 7 | S:5 O:1 L:1 | Toggle-knob shadow `0 1px 3px`. |
| `rgba(18,14,12,.66)` | 7 | R:2 L:5 | Landing card fill. |
| `#e0a13a` | 6 | R:2 S:3 O:1 | Warning amber — status dot, warning text, amber badge bg. |
| `rgba(255,220,190,.16)` | 6 | R:2 S:4 | Mic-off border; quiet control border. |
| `rgba(255,220,190,.2)` | 6 | S:3 O:2 L:1 | Mobile-frame border; quiet control border. |
| `rgba(255,255,255,.07)` | 6 | R:3 S:2 O:1 | **Two different roles.** 5× as `style-hover`: menu-item hover (R:53, R:55, S:256, S:257) and Operator task-card hover (O:62). 1× as a *resting* fill: `Roomscout.dc.html:148` — the mic button in its **off** state, `width:{{ ctrl }}px;height:{{ ctrl }}px;border-radius:50%;background:rgba(255,255,255,.07);border:1px solid rgba(255,220,190,.16)` with `style-hover="background:rgba(255,255,255,.12)"`. Same value in JS (§A2) as `micBg` when `!micOn`. |
| `#0b0a09` | 5 | R:3 L:2 | Page ground — declared **three** times in Roomscout: `html,body{background:#0b0a09}` in the `<style>` block, the fixed root `<div>`, **and the `data-stage="1"` frame** (§E). L: the `<style>` block and the root `<div>`. |
| `#ffc39a` | 5 | R:1 L:4 | Blob gradient stop 1 (highlight). |
| `#ffd9c4` | 5 | R:3 S:1 L:1 | Ink inside soft-orange chips. |
| `rgba(0,0,0,.25)` | 5 | S:4 L:1 | Scrim / image darkener. |
| `rgba(255,105,38,.25)` | 5 | R:4 L:1 | Primary CTA glow `0 8px 28px`. |
| `#e9511a` | 4 | R:1 L:3 | Blob gradient stop 4 (deep). |
| `rgba(0,0,0,.35)` | 4 | S:1 O:1 L:2 | Shell shadow `0 30px 90px`. |
| `rgba(18,14,11,.98)` | 4 | S:3 O:1 | Drawer / modal fill (Settings + Operator). |
| `rgba(20,14,10,.6)` | 4 | R:4 | Search / side-note input pill fill (with `backdrop-filter:blur(6px)`). |
| `rgba(255,105,38,.12)` | 4 | R:2 S:1 L:1 | Soft-orange chip fill. |
| `rgba(255,140,90,.35)` | 4 | R:3 L:1 | Accent border — user chat bubble, active sidebar item, toast. |
| `rgba(255,200,160,.18)` | 4 | R:3 L:1 | Pill-button border (stage chips). |
| `rgba(255,220,190,.3)` | 4 | R:3 L:1 | Secondary pill button border. |
| `#4fbf7a` | 3 | O:3 | Success green — status dots (Operator env pill, connected sources). |
| `rgba(0,0,0,.5)` | 3 | S:2 L:1 | Deep modal shadow `0 30px 80px`. |
| `rgba(120,58,22,.75)` | 3 | R:2 L:1 | User chat bubble fill. |
| `rgba(20,14,10,.5)` | 3 | R:2 L:1 | Pill fill variant (quietest). |
| `rgba(20,14,10,.55)` | 3 | R:3 | Pill fill variant. |
| `rgba(255,105,38,.18)` | 3 | R:1 L:2 | Blob outer glow. |
| `rgba(255,105,38,.28)` | 3 | R:1 L:2 | CTA glow (landing, larger). |
| `rgba(255,120,50,.35)` | 3 | R:1 L:2 | Blob inner glow. |
| `rgba(255,140,90,.5)` | 3 | R:1 S:1 L:1 | Accent border, strong — selected candidate card, chips. |
| `rgba(255,220,190,.12)` | 3 | S:2 L:1 | Side-panel `border-left`, landing `border-top`. |
| `rgba(255,255,255,.09)` | 3 | R:3 | Ghost hover variant. |
| `#1a120c` | 2 | L:2 | Landing radial vignette colour. |
| `#9c8b7b` | 2 | R:1 S:1 | `::placeholder` ink (declared in the `<style>` block). |
| `#b8382a` | 2 | R:1 S:1 | Danger red — destructive button bg, stop-recording button. |
| `#c9463a` | 2 | R:1 S:1 | Danger red hover (`style-hover` only). |
| `#ffe0cf` | 2 | R:1 L:1 | Ink on outline-orange buttons. |
| `rgba(0,0,0,.4)` | 2 | R:2 | Sheet shadow `0 -20px 60px`; toast shadow `0 16px 40px`. |
| `rgba(0,0,0,.45)` | 2 | R:1 S:1 | Menu shadow `0 20px 50px` / `0 16px 40px`. |
| `rgba(12,9,7,.62)` | 2 | R:1 L:1 | Background scrim gradient stop 2. |
| `rgba(18,14,12,.6)` | 2 | R:1 L:1 | Landing panel fill. |
| `rgba(224,161,58,.1)` | 2 | S:1 O:1 | Amber notice fill. |
| `rgba(224,161,58,.35)` | 2 | R:1 S:1 | Amber notice border. |
| `rgba(255,105,38,.14)` | 2 | R:1 L:1 | Outline-orange button fill. |
| `rgba(255,105,38,.16)` | 2 | R:1 L:1 | Orange chip fill (stronger). |
| `rgba(255,105,38,.22)` | 2 | R:2 | Orange chip hover fill. |
| `rgba(255,105,38,.26)` | 2 | R:1 L:1 | Orange chip hover fill (landing). |
| `rgba(255,140,90,.3)` | 2 | R:1 L:1 | Accent border, soft — big stage card. |
| `rgba(255,140,90,.4)` | 2 | R:2 | Accent border on soft-orange chip buttons. |
| `rgba(255,140,90,.45)` | 2 | R:1 L:1 | Accent border on outline-orange buttons. |
| `rgba(255,140,90,.6)` | 2 | O:1 L:1 | **Two roles.** O:1 = INTERN badge border, `Operator.dc.html:20` `padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,90,.6);color:#ff8a4e;font-size:12px;letter-spacing:.12em;font-weight:600`. L:1 = a **third `text-decoration-color`**, `Landing v2.dc.html:211` `display:inline-block;margin-top:18px;font-size:15px;color:#f5ece2;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,140,90,.6)` on the link „So behaltet ihr die Kontrolle ↓“. See §F7. |
| `rgba(255,190,140,.16)` | 2 | S:1 O:1 | Settings/Operator **shell** border (unique 3rd border hue). |
| `rgba(255,200,160,.25)` | 2 | R:2 | Inline text-input border. |
| `rgba(255,200,160,.35)` | 2 | S:1 O:1 | `1px dashed` empty-state border. |
| `rgba(255,220,190,.18)` | 2 | S:1 O:1 | Quiet control border (shell). |
| `rgba(255,255,255,.02)` | 2 | R:2 | Diagonal hatch stripe B. |
| `rgba(30,16,6,.28)` | 2 | R:1 L:1 | Background scrim gradient stop 1. |
| `rgba(5,7,9,.92)` | 2 | R:1 L:1 | Background scrim gradient stop 3. |
| `rgba(6,4,3,.55)` | 2 | S:1 O:1 | Modal scrim inside the Settings/Operator shell. |
| `rgba(6,4,3,.6)` | 2 | S:2 | Modal scrim, stronger (Settings only). |
| `#1a1208` | 1 | O:1 | Ink on amber badge (Operator). |
| `#8f7e6e` | 1 | R:1 | One-off faintest ink. |
| `#b3a291` | 1 | R:1 | Welcome-screen tagline, **not** a scroll hint: `Roomscout.dc.html:99` `margin-top:min(12vh,110px);font-size:15px;color:#b3a291` — „Du erzählst. Dein Scout kümmert sich.“ (`margin-top:min(12vh,110px)` is the only viewport-relative top margin in the app; see §C4.) |
| `#f8f0e7` | 1 | R:1 | Brightest ink — the big Scout utterance only. |
| `#ff8a6a` | 1 | S:1 | Error ink (Settings validation message). |
| `rgba(0,0,0,.2)` | 1 | S:1 | Soft inner scrim. |
| `rgba(10,8,7,.8)` | 1 | R:1 | Dev-bar button fill. |
| `rgba(10,8,7,.85)` | 1 | L:1 | Landing dark panel. |
| `rgba(10,8,7,.88)` | 1 | R:1 | Dev bar fill (`ui-monospace`). |
| `rgba(10,8,7,.9)` | 1 | L:1 | Landing dark panel. |
| `rgba(11,10,9,.35)` | 1 | L:1 | Landing bottom-fade end stop. |
| `rgba(11,10,9,.55)` | 1 | L:1 | Landing pill fill. |
| `rgba(11,10,9,0)` | 1 | L:1 | Landing bottom-fade start stop. |
| `rgba(120,58,22,.22)` | 1 | S:1 | Selected-state warm fill (Settings). |
| `rgba(120,58,22,.35)` | 1 | L:1 | Landing warm fill. |
| `rgba(13,10,8,.8)` | 1 | S:1 | **Settings shell** fill. |
| `rgba(13,10,8,.82)` | 1 | O:1 | **Operator shell** fill. |
| `rgba(14,11,9,.94)` | 1 | R:1 | Transcript side panel fill. |
| `rgba(18,14,12,.5)` | 1 | L:1 | Landing panel fill (light). |
| `rgba(18,14,12,.78)` | 1 | L:1 | Landing panel fill (heavy). |
| `rgba(18,14,12,.92)` | 1 | R:1 | Bottom sheet fill + `backdrop-filter:blur(10px)`. |
| `rgba(20,14,10,.7)` | 1 | L:1 | Landing pill fill. |
| `rgba(20,15,12,.96)` | 1 | R:1 | Header dropdown menu fill (Roomscout). |
| `rgba(20,15,12,.97)` | 1 | S:1 | Settings popup menu fill. |
| `rgba(224,161,58,.12)` | 1 | R:1 | Amber notice fill (Roomscout). |
| `rgba(224,161,58,.45)` | 1 | O:1 | Amber notice border (Operator). |
| `rgba(24,17,13,.96)` | 1 | R:1 | Toast fill (Roomscout). |
| `rgba(255,105,38,.35)` | 1 | L:1 | Landing blob glow `0 0 60px 10px`; mobile CTA fill (JS). |
| `rgba(255,105,38,.4)` | 1 | L:1 | Landing blob glow `0 0 18px`; disabled primary fill (JS). |
| `rgba(255,105,38,.5)` | 1 | R:1 | Live-dot glow `0 0 8px`. |
| `rgba(255,140,90,.22)` | 1 | S:1 | Quiet accent border. |
| `rgba(255,140,90,.55)` | 1 | L:1 | Accent border (landing). |
| `rgba(255,190,140,.26)` | 1 | L:1 | Landing card border (3rd hue again). |
| `rgba(255,200,160,.2)` | 1 | R:1 | Tooltip border. |
| `rgba(255,200,160,.22)` | 1 | S:1 | Toast border (Settings). |
| `rgba(255,200,160,.3)` | 1 | S:1 | Focused input border. |
| `rgba(255,220,190,.06)` | 1 | O:1 | Faintest hairline (Operator table head). |
| `rgba(255,220,190,.14)` | 1 | L:1 | Landing quiet border. |
| `rgba(255,220,190,.25)` | 1 | L:1 | Landing control border. |
| `rgba(26,18,12,0)` | 1 | L:1 | Landing vignette fade-out stop. |
| `rgba(28,20,14,.92)` | 1 | R:1 | Tooltip / hint bar fill (Roomscout). |
| `rgba(28,20,14,.96)` | 1 | S:1 | Toast fill (Settings). |
| `rgba(30,22,16,.7)` | 1 | R:1 | Hover fill on a stage pill. |

#### A2 · Colours that live only in the React source (`data-dc-script`)

These are bound into the template through `{{ … }}` props. A builder must reproduce them as conditional class/style logic.

| Value | n | Files | Bound to (prop → meaning) |
|---|---:|---|---|
| `#ff6926` | 17 | R:6 S:10 O:1 | `badgeDotColor` (Scout live), `micBg`/`micBorder` (mic on), `c.btnBg`/`c.btnBorder` (best candidate), `saveBg`/`checkBg`/`applyBg`/`nameSaveBg` (enabled primary), `autoRing`/`revRing` (**ring** of the selected autonomy card), `autoDotBg`/`revDotBg` (**12px inner dot** of the selected autonomy radio; `'transparent'` when unselected), `t.line` (**active Settings tab underline**, `border-bottom:2px solid`; `'transparent'` when inactive — `Settings.dc.html:618`), last activity dot, **and — via `const SW`, `Settings.dc.html:475` / `Operator.dc.html:221` — the `on` fill of every toggle track** |
| `#e0a13a` | 5 | R:1 S:3 O:1 | `budgetColor` (budget missed), source `dot` (portal expired), `connDot` (`expired`) |
| `#f5ece2` | 5 | R:1 S:2 L:2 | `listHeadColor` (card mode), sidebar item `color`, `btnColor`, landing `color` |
| `rgba(255,255,255,.3)` | 5 | S:4 O:1 | inactive/neutral status dot (`!enabled`, `Noch nicht verfügbar`) |
| `#4fbf7a` | 4 | S:3 O:1 | `dot`/`connDot` connected; `GREEN` constant in Operator |
| `#a89684` | 4 | R:3 S:1 | `badgeDotColor` (search paused), `budgetColor` (fits), `listHeadColor` (list mode), `btnColor` (disabled) |
| `#ff8a4e` | 4 | S:2 O:1 L:1 | active sidebar `icon`, active tab `color`, `memNewColor` |
| `rgba(255,105,38,.4)` | 4 | S:4 | disabled primary button fill (`saveBg`, `checkBg`, `applyBg`, `nameSaveBg`) |
| `rgba(255,105,38,.3)` | 3 | R:1 O:2 | `micShadow` `0 6px 24px …`; Operator filter-pill active fill (`fAllBg`, `fAttBg`) |
| `rgba(255,105,38,.35)` | 3 | R:1 S:2 | `mobileBtnBg` (mobile toggle on); notification channel active fill (`chAppBg`, `chMailBg`) |
| `rgba(255,200,160,.14)` | 3 | R:1 S:1 L:1 | R = non-best candidate card border (`c.border`); S = **expanded** source-row border (`rowBorder`, see the `rgba(255,255,255,.035)` row below); L = **closed** FAQ row border |
| `rgba(255,220,190,.35)` | 3 | R:1 S:2 | past activity dot; unselected autonomy card ring |
| `rgba(255,255,255,.06)` | 3 | R:3 | non-best candidate button fill; mobile toggle off; **Scout** chat bubble |
| `#e2d3c3` | 2 | S:1 O:1 | inactive sidebar `icon` |
| `rgba(120,58,22,.28)` | 2 | S:2 | selected autonomy card fill (`autoCardBg`, `revCardBg`) |
| `rgba(120,58,22,.45)` | 2 | S:1 O:1 | **active sidebar item fill** (both shells) |
| `rgba(255,105,38,.2)` | 2 | R:1 L:1 | changed search-profile field highlight |
| `rgba(255,105,38,.75)` | 2 | S:2 | selected autonomy card border |
| `rgba(255,140,90,.35)` | 2 | S:1 O:1 | **active sidebar item border** (both shells) |
| `rgba(255,220,190,.14)` | 2 | S:2 | unselected autonomy card border |
| `rgba(255,255,255,.03)` | 2 | S:2 | unselected autonomy card fill |
| `rgba(255,255,255,.14)` | 2 | S:1 O:1 | **toggle track "OFF" fill** — `const SW = on => ({ on, bg: on ? '#ff6926' : 'rgba(255,255,255,.14)', knob: on ? 'translateX(24px)' : 'none' });` (`Settings.dc.html:475`, `Operator.dc.html:221`, byte-identical). The **ON** fill is `#ff6926`. |
| `rgba(18,14,12,.74)` | 1 | R:1 | `listBg` — transcript list, card mode |
| `rgba(18,14,12,.42)` | 1 | R:1 | `listBg` — transcript list, list mode |
| `rgba(255,200,160,.10)` | 1 | R:1 | `listBorder` — transcript list, list mode |
| `rgba(120,58,22,.6)` | 1 | R:1 | **user** chat bubble fill in the transcript list |
| `rgba(0,0,0,.35)` | 1 | R:1 | `listShadow` |
| `rgba(255,105,38,.18)` | 1 | S:1 | quiet orange fill |
| `rgba(255,255,255,.035)` | 1 | S:1 | **expanded source-row fill** (Settings has no FAQ). `Settings.dc.html:544` — `rowBg: open ? 'rgba(255,255,255,.035)' : 'transparent', rowBorder: open ? 'rgba(255,200,160,.14)' : 'transparent', mb: open ? 8 : 0`. Template `Settings.dc.html:80`: `border-radius:18px;background:{{ s.rowBg }};border:1px solid {{ s.rowBorder }};margin-bottom:{{ s.mb }}px;transition:background .25s,border-color .25s`. |
| `rgba(255,105,38,.7)` | 1 | L:1 | open FAQ row border — **Landing v2 only** (`Landing v2.dc.html:343`: `border: open ? 'rgba(255,105,38,.7)' : 'rgba(255,200,160,.14)'`) |
| `rgba(224,161,58,.06)` | 1 | O:1 | amber row tint |
| `rgba(11,10,9,.72)` | 1 | L:1 | `hdrBg` when scrolled |
| `rgba(255,220,190,.1)` | 1 | L:1 | `hdrLine` when scrolled |
| `#ffd9c4` | 1 | L:1 | changed-field ink |
| `#cbb9a8` | 1 | S:1 | inactive tab colour |
| `rgba(255,220,190,.16)` | 1 | R:1 | `micBorder` when mic off |
| `rgba(255,220,190,.2)` | 1 | R:1 | mobile-frame border `stB` |
| `rgba(255,220,190,.28)` | 1 | R:1 | non-best candidate button border |
| `rgba(255,255,255,.07)` | 1 | R:1 | **`micBg` when the mic is OFF** — `Roomscout.dc.html:1140`: `micBg: s.micOn ? '#ff6926' : 'rgba(255,255,255,.07)', micBorder: s.micOn ? '#ff6926' : 'rgba(255,220,190,.16)', micShadow: s.micOn ? '0 6px 24px rgba(255,105,38,.3)' : 'none'`. Not a hover token. |
| `rgba(255,140,90,.5)` | 1 | R:1 | best candidate card border |
| `rgba(255,200,160,.16)` | 1 | R:1 | **`listBorder` — transcript/fact list, *card* mode.** `Roomscout.dc.html:1165`: `listBorder: card ? 'rgba(255,200,160,.16)' : 'rgba(255,200,160,.10)'` (paired with the `listBg` rows above; §A2b has the full list geometry). |
| `rgba(255,255,255,.04)` | 2 | O:2 | **inactive Operator filter-pill fill.** `Operator.dc.html:283`: `fAllBg: s.filter === 'all' ? 'rgba(255,105,38,.3)' : 'rgba(255,255,255,.04)', fAttBg: s.filter === 'attention' ? 'rgba(255,105,38,.3)' : 'rgba(255,255,255,.04)'`. The pill itself is `height:38px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,220,190,.2);font-size:14.5px` (`Operator.dc.html:110–111`). |

#### A2b · Every non-colour `{{ … }}` binding, resolved

Part A's tables show these as literal placeholder rows (`height:{{ ctrl }}px`, `font-size:{{ utterSize }}`, …). **A builder cannot use those rows without this table.** Every value below is copied verbatim from the `data-dc-script` source. `narrow` is defined in §0.1.

**Roomscout — mobile stage frame** (`Roomscout.dc.html:1089`; the element is `data-stage="1"`, see §E)

```js
stL: mobile ? '50%' : '0',   stT: mobile ? '50%' : '0',
stW: mobile ? '390px' : '100%',
stH: mobile ? 'min(844px, calc(100% - 32px))' : '100%',
stTf: mobile ? 'translate(-50%,-50%)' : 'none',
stR: mobile ? '44px' : '0',
stB: mobile ? '1px solid rgba(255,220,190,.2)' : '0',
```

**Roomscout — responsive chrome & hero** (`Roomscout.dc.html:1090–1091`, `:1130`, `:1134–1135`)

| Binding | narrow (`≤959px` or `mobile`) | wide | Applied to |
|---|---|---|---|
| `hdrPad` | `'0 18px'` | `'0 36px'` | `<header style="padding:{{ hdrPad }}">` |
| `hdrH` | `64` | `84` | `<header style="height:{{ hdrH }}px">` |
| `hdrGap` | `10` | `14` | header flex `gap` |
| `markSize` | `17` | `20` | the `roomscout` wordmark `font-size` |
| `hdrBtn` | `38` | `42` | header icon buttons & avatar, `width`/`height` |
| `badgeTextVisible` | `false` | `true` | hides the live-badge label when narrow |
| `autoBlob` | `112` | `160` | autopilot-screen blob `width`/`height` |
| `autoBlobMb` | `30` | `48` | its `margin-bottom` |
| `autoH1` | `'34px'` | `'clamp(36px,5vw,58px)'` | autopilot `<h1>` `font-size` |
| `welcomeBlob` | `128` | `168` | welcome-screen blob `width`/`height` |
| `welcomeBlobMb` | `36` | `56` | its `margin-bottom` |
| `discoveryBlob` | `textMode ? 88 : 120` | `textMode ? 104 : 160` | discovery blob; `transition:width .6s,height .6s,margin .6s`, `margin-bottom:28px` |
| `ctrl` | `60` | `76` | mic / voice control `width` **and** `height` (`border-radius:50%`) |
| `ctrlGap` | `20` | `34` | gap between the voice controls |
| `ctrlFont` | `12.5` | `14` | label under the voice controls |
| `discoveryPadBottom` | `sheetVisible ? 96 : 32` | same expression | bottom padding of the discovery scroll area |
| `candCols` | `'1fr'` | `'repeat(3, minmax(0,1fr))'` | candidates grid |
| `offerCols` | `'1fr'` | `'minmax(0,1fr) minmax(0,1.05fr)'` | offer card grid |
| `offerImgMin` | `200` | `380` | offer `<img>` / hatch placeholder `min-height` |
| `offerImgMax` | `240` | `470` | offer `<img>` `max-height` |
| `briefSpacerHeight` | `40` | `60 + facts.length * 56 + 240` | scroll spacer |

**Roomscout — the Scout utterance** (`Roomscout.dc.html:113`, `:1134–1135`) — the largest type in the app:

```html
<p data-utter="1" aria-live="polite"
   style="margin:12px 0 0;font-size:{{ utterSize }};line-height:1.16;font-weight:300;
          letter-spacing:-.015em;max-width:{{ utterMaxWidth }};text-wrap:balance;color:#f8f0e7">
```

```js
utterSize: narrow ? (textMode ? '24px' : '28px')
                  : (textMode ? 'clamp(24px,3vw,36px)' : 'clamp(28px,3.6vw,46px)'),
utterMaxWidth: (!narrow && s.facts.length) ? 'min(760px, calc(100vw - 660px))' : '760px',
```

**Roomscout — the fact list ("Euer Suchauftrag")**, `card` = `listMode === 'card' || 'leaving'` (`Roomscout.dc.html:1163–1169`, template `:525–533`)

| Binding | card mode | list mode |
|---|---|---|
| `listLeft` | `'calc(50% - ' + cardW/2 + 'px)'` | `'calc(100% - 312px)'` |
| `listTop` | `236` (`cardTop`) | `20` |
| `listWidth` | `cardW` = `Math.min(540, Math.max(280, mainWidth − 32))` | `288` |
| `listPad` | `'26px 28px 28px'` | `'12px 14px 12px'` |
| `listRadius` | `26` | `16` |
| `listBg` | `rgba(18,14,12,.74)` | `rgba(18,14,12,.42)` |
| `listBorder` | `rgba(255,200,160,.16)` | `rgba(255,200,160,.10)` |
| `listShadow` | `'0 30px 80px rgba(0,0,0,.35)'` | `'none'` |
| `listGap` | `6` | `2` |
| `listHeadMb` | `10` | `4` |
| `listHeadFont` | `22` | `11.5` |
| `listHeadWeight` | `400` | `500` |
| `listHeadSpacing` | `'-.01em'` | `'.09em'` |
| `listHeadTransform` | `'none'` | `'uppercase'` |
| `listHeadColor` | `#f5ece2` | `#a89684` |
| `rowGap` | `16` | `10` |
| `rowFont` | `17` | `13.5` |
| `f.h` (per row) | `arriving ? 0 : 44` | `arriving ? 0 : 34` |
| `f.pad` (per row) | `arriving ? '0 6px' : '0 8px'` | `arriving ? '0 6px' : '0 6px'` |
| `f.bg` (per row) | `changed ? 'rgba(255,105,38,.2)' : 'transparent'` | same |
| `f.opacity` | `arriving ? 0 : 1` | same |
| `listOpacity` / `listTransform` | `leaving ? 0 : 1` / `leaving ? 'scale(.94) translateY(10px)' : 'none'` | same |

Row element: `display:flex;align-items:center;gap:{{ rowGap }}px;height:{{ f.h }}px;padding:{{ f.pad }};border-radius:10px;font-size:{{ rowFont }}px;opacity:{{ f.opacity }};background:{{ f.bg }};overflow:hidden;transition:padding .9s,font-size .9s,gap .9s,height .9s,opacity .35s,background .5s`

**Roomscout — the narrow bottom sheet**, `sheetCard` variant (`Roomscout.dc.html:1093–1095`, template `:485`)

| Binding | sheetCard | compact |
|---|---|---|
| `shSide` | `0` | `12` |
| `shBottom` | `0` | `12` |
| `shRadius` | `'26px 26px 0 0'` | `'20px'` |
| `shPad` | `'22px 22px 26px'` | `'8px 14px 8px'` |
| `shTitleSize` | `22` | `15` |
| `shTitleWeight` | `400` | `500` |

Sheet element: `position:absolute;z-index:6;left:{{ shSide }}px;right:{{ shSide }}px;bottom:{{ shBottom }}px;border-radius:{{ shRadius }};background:rgba(18,14,12,.92);…` + `backdrop-filter:blur(10px)`, `box-shadow:0 -20px 60px rgba(0,0,0,.4)`.

**Roomscout — misc bound values**

`mobileBtnBg: mobile ? 'rgba(255,105,38,.35)' : 'rgba(255,255,255,.06)'` ·
`micShadow: s.micOn ? '0 6px 24px rgba(255,105,38,.3)' : 'none'` ·
`badgeDotAnim: s.searchPaused ? 'none' : 'rsDot 2.4s ease-in-out infinite'` ·
transcript bubble `radius: m.who === 'scout' ? '14px 14px 14px 4px' : '14px 14px 4px 14px'`, `bg: m.who === 'scout' ? 'rgba(255,255,255,.06)' : 'rgba(120,58,22,.6)'`, `align: m.who === 'scout' ? 'flex-start' : 'flex-end'`, `who: m.who === 'scout' ? 'Dein Scout' : 'Du'` ·
`a.dot: i === activity.length - 1 ? '#ff6926' : 'rgba(255,220,190,.35)'`.

**Settings / Operator — bound values**

`SW(on) → { bg: on ? '#ff6926' : 'rgba(255,255,255,.14)', knob: on ? 'translateX(24px)' : 'none' }` (both files, identical) ·
`s.rows / q.rows: open ? '1fr' : '0fr'` (accordion `grid-template-rows`) ·
`s.chev / rot: open ? 'rotate(180deg)' : 'none'` ·
`it.bg: cur ? 'rgba(120,58,22,.45)' : 'transparent'`, `it.border: cur ? 'rgba(255,140,90,.35)' : 'transparent'`, `it.icon: cur ? '#ff8a4e' : '#e2d3c3'` (sidebar item, both shells) ·
`t.color / t.line` (Settings tabs) = `'#ff8a4e' / '#ff6926'` when active, `'#cbb9a8' / 'transparent'` when not ·
`t.underline: s.openTask === id ? 'underline' : 'none'` (Operator) ·
`fAllBg / fAttBg: active ? 'rgba(255,105,38,.3)' : 'rgba(255,255,255,.04)'` (Operator filter pills).

**Landing v2 — bound values** (`Landing v2.dc.html:327–343`)

| Binding | narrow (`<880px`) / state | wide / other state |
|---|---|---|
| `hdrH` | `scrolled ? 64 : 80` | — |
| `hdrBg` | `scrolled ? 'rgba(11,10,9,.72)' : 'transparent'` | — |
| `hdrBlur` | `scrolled ? 'blur(12px)' : 'none'` | — |
| `hdrLine` | `scrolled ? 'rgba(255,220,190,.1)' : 'transparent'` | — |
| `introCols` | `'1fr'` | `'minmax(0,1.6fr) minmax(260px,.8fr)'` |
| `convoCols` | `'minmax(90px,.4fr) minmax(0,1.6fr)'` | `'minmax(140px,.7fr) minmax(0,1.6fr) minmax(220px,.9fr)'` |
| `offerCols` | `'1fr'` | `'minmax(0,1fr) minmax(0,1.05fr)'` |
| `offerImgMin` | `220` | `360` (`max-height:440px` is literal) |
| `bentoTop` | `'1fr'` | `'minmax(0,1.5fr) minmax(0,1fr)'` |
| `bentoBottom` | `'1fr'` | `'minmax(0,1fr) minmax(0,1.5fr)'` |
| `memCols` | `'1fr'` | `'minmax(0,1.1fr) minmax(0,.9fr)'` |
| `faqCols` | `'1fr'` | `'minmax(0,.9fr) minmax(0,1.1fr)'` |
| `f.deco` | `'line-through'` on an overwritten fact | `'none'` |
| `q.border` | `open ? 'rgba(255,105,38,.7)' : 'rgba(255,200,160,.14)'` | — |

#### A3 · `font-size`

> Every `{{ … }}` row below is resolved in **§A2b**. In particular `{{ utterSize }}` — the largest and most prominent type in the app — is
> `narrow ? (textMode ? '24px' : '28px') : (textMode ? 'clamp(24px,3vw,36px)' : 'clamp(28px,3.6vw,46px)')`.

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `font-size: 15px` | 107 | R:36 S:51 O:13 L:7 | Default body / control label. |
| `font-size: 14.5px` | 62 | R:4 S:35 O:17 L:6 | Dense body (Settings rows, Operator tables). |
| `font-size: 14px` | 52 | R:23 S:18 O:4 L:7 | Small body / meta. |
| `font-size: 16px` | 52 | R:17 S:11 O:13 L:11 | Comfortable body; menu items; list rows. |
| `font-size: 17px` | 43 | R:12 S:23 O:2 L:6 | Lead body; chat bubbles; primary button label. |
| `font-size: 12.5px` | 36 | R:10 S:12 O:6 L:8 | Uppercase eyebrow (with `letter-spacing:.14em`). |
| `font-size: 19px` | 23 | R:5 S:10 O:6 L:2 | Sub-headline under a page title (`color:#cbb9a8`). |
| `font-size: 13px` | 21 | R:3 S:8 O:7 L:3 | Caption / footnote. |
| `font-size: 13.5px` | 19 | R:4 S:10 O:1 L:4 | Caption (slightly larger). |
| `font-size: 44px` | 13 | S:7 O:6 | Settings/Operator page title (`w500 / ls -.02em / lh 1.1`). |
| `font-size: 12px` | 10 | R:4 S:2 O:2 L:2 | Micro eyebrow / badge. |
| `font-size: 18px` | 10 | R:4 S:6 | Section heading inside a panel. |
| `font-size: 15.5px` | 9 | S:1 O:1 L:7 | Landing body. |
| `font-size: 22px` | 6 | R:1 S:5 | Card / dialog title. |
| `font-size: clamp(22px,1.9vw,27px)` | 4 | L:4 | `font-size` on `<div>` |
| `font-size: clamp(34px,4.6vw,52px)` | 4 | R:4 | `font-size` on `<h1>` |
| `font-size: 20px` | 3 | S:2 O:1 | `font-size` on `<div>` |
| `font-size: 26px` | 3 | R:1 S:1 O:1 | `font-size` on `<div>` |
| `font-size: {{ ctrlFont }}px` | 3 | R:3 | `font-size` on `<button>` |
| `font-size: .6em` | 2 | R:1 L:1 | `font-size` on `<span>` |
| `font-size: 11.5px` | 2 | R:1 L:1 | **Two unrelated roles.** R:1 = dev bar (monospace, `Roomscout.dc.html:609`). L:1 = an **uppercase eyebrow, not monospace** (`Landing v2.dc.html:91`): `font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:#a89684;margin-bottom:6px` on „Euer Suchauftrag“. |
| `font-size: 40px` | 2 | S:2 | `font-size` on `<div>` |
| `font-size: clamp(17px,1.4vw,20px)` | 2 | L:2 | `font-size` on `<div>` |
| `font-size: clamp(17px,1.6vw,22px)` | 2 | R:1 L:1 | `font-size` on `<p>` |
| `font-size: clamp(32px,4.6vw,52px)` | 2 | R:2 | `font-size` on `<h1>` |
| `font-size: clamp(32px,4.6vw,58px)` | 2 | L:2 | `font-size` on `<h3>` |
| `font-size: 11px` | 1 | R:1 | dev-bar re-open button (monospace, `Roomscout.dc.html:641`) |
| `font-size: 16.5px` | 1 | O:1 | `font-size` on `<div>` |
| `font-size: 21px` | 1 | L:1 | `font-size` on `<div>` |
| `font-size: 24px` | 1 | S:1 | `font-size` on `<h2>` |
| `font-size: 30px` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: clamp(14px,2.2vh,17px)` | 1 | L:1 | `font-size` on `<div>` |
| `font-size: clamp(17px,1.5vw,21px)` | 1 | L:1 | `font-size` on `<p>` |
| `font-size: clamp(17px,min(2.2vw,3.4vh),30px)` | 1 | L:1 | `font-size` on `<div>` |
| `font-size: clamp(18px,1.5vw,22px)` | 1 | L:1 | `font-size` on `<button>` |
| `font-size: clamp(19px,2vw,24px)` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: clamp(21px,2.3vw,29px)` | 1 | L:1 | `font-size` on `<div>` |
| `font-size: clamp(22px,2.2vw,30px)` | 1 | L:1 | `font-size` on `<div>` |
| `font-size: clamp(24px,2.4vw,32px)` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: clamp(24px,2.6vw,34px)` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: clamp(26px,min(3.6vw,5vh),46px)` | 1 | L:1 | `font-size` on `<div>` |
| `font-size: clamp(32px,3.8vw,54px)` | 1 | L:1 | `font-size` on `<h2>` |
| `font-size: clamp(34px,5vw,64px)` | 1 | L:1 | `font-size` on `<h3>` |
| `font-size: clamp(36px,3.6vw,50px)` | 1 | L:1 | `font-size` on `<div>` |
| `font-size: clamp(36px,5.4vw,74px)` | 1 | L:1 | `font-size` on `<h2>` |
| `font-size: clamp(36px,5vw,58px)` | 1 | R:1 | `font-size` on `<h1>` |
| `font-size: clamp(36px,5vw,66px)` | 1 | L:1 | `font-size` on `<h2>` |
| `font-size: clamp(36px,5vw,68px)` | 1 | L:1 | `font-size` on `<h2>` |
| `font-size: clamp(38px,3.8vw,52px)` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: clamp(38px,6vw,64px)` | 1 | R:1 | `font-size` on `<h1>` |
| `font-size: clamp(42px,6.2vw,84px)` | 1 | L:1 | `font-size` on `<h1>` |
| `font-size: {{ autoH1 }}` | 1 | R:1 | `font-size` on `<h1>` |
| `font-size: {{ listHeadFont }}px` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: {{ markSize }}px` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: {{ rowFont }}px` | 1 | R:1 | `font-size` on `<div>` |
| `font-size: {{ shTitleSize }}px` | 1 | R:1 | `font-size` on `<button>` |
| `font-size: {{ utterSize }}` | 1 | R:1 | **the Scout utterance** — `narrow ? (textMode ? '24px' : '28px') : (textMode ? 'clamp(24px,3vw,36px)' : 'clamp(28px,3.6vw,46px)')`; companions `w300 · lh 1.16 · ls -.015em · text-wrap:balance · color:#f8f0e7 · max-width:{{ utterMaxWidth }}` (§A2b) |

#### A4 · `font-weight`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `font-weight: 500` | 56 | R:11 S:20 O:12 L:13 | Default emphasis (titles, buttons, nav). |
| `font-weight: 600` | 34 | R:13 S:13 O:3 L:5 | Filled-button label, strong badge. |
| `font-weight: 300` | 20 | R:13 L:7 | Display / hero weight (Roomscout + Landing only). |
| `font-weight: 400` | 10 | R:5 S:1 L:4 | Explicit normal on large text. |
| `font-weight: 700` | 1 | O:1 | `font-weight` on `<span>` |
| `font-weight: {{ listHeadWeight }}` | 1 | R:1 | `font-weight` on `<div>` |
| `font-weight: {{ shTitleWeight }}` | 1 | R:1 | `font-weight` on `<button>` |

#### A5 · `letter-spacing`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `letter-spacing: -.02em` | 28 | R:11 S:9 O:6 L:2 | Large titles (≥26px). |
| `letter-spacing: .14em` | 25 | R:4 S:13 O:7 L:1 | Uppercase eyebrow. |
| `letter-spacing: -.01em` | 8 | R:3 S:1 L:4 | Medium titles. |
| `letter-spacing: -.03em` | 5 | L:5 | Landing display headline. |
| `letter-spacing: .04em` | 5 | R:2 O:1 L:2 | The `roomscout` wordmark. |
| `letter-spacing: .12em` | 5 | O:5 | Uppercase eyebrow (Operator variant). |
| `letter-spacing: -.025em` | 3 | L:3 | `letter-spacing` on `<h3>` |
| `letter-spacing: .08em` | 3 | R:3 | `letter-spacing` on `<div>` |
| `letter-spacing: .18em` | 3 | L:3 | `letter-spacing` on `<div>` |
| `letter-spacing: -.015em` | 2 | R:1 L:1 | `letter-spacing` on `<p>` |
| `letter-spacing: .16em` | 2 | R:1 L:1 | `letter-spacing` on `<div>` |
| `letter-spacing: .09em` | 1 | L:1 | `letter-spacing` on `<div>` |
| `letter-spacing: .1em` | 1 | L:1 | `letter-spacing` on `<div>` |
| `letter-spacing: 0` | 1 | L:1 | `letter-spacing` on `<span>` |
| `letter-spacing: {{ listHeadSpacing }}` | 1 | R:1 | `letter-spacing` on `<div>` |

#### A6 · `line-height`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `line-height: 1.1` | 21 | R:7 S:7 O:6 L:1 | `line-height` on `<h1>` |
| `line-height: 1.6` | 16 | R:1 S:8 O:4 L:3 | `line-height` on `<div>` |
| `line-height: 1.5` | 13 | R:4 S:4 O:1 L:4 | `line-height` on `<div>` |
| `line-height: 1.55` | 6 | R:2 S:3 O:1 | `line-height` on `<div>` |
| `line-height: 1.05` | 3 | L:3 | `line-height` on `<h3>` |
| `line-height: 1.08` | 3 | R:3 | `line-height` on `<h1>` |
| `line-height: 1.45` | 3 | R:2 S:1 | `line-height` on `<p>` |
| `line-height: 1` | 2 | R:2 | `line-height` on `<span>` |
| `line-height: 1.02` | 2 | L:2 | `line-height` on `<h1>` |
| `line-height: 1.04` | 2 | L:2 | `line-height` on `<h2>` |
| `line-height: 1.2` | 2 | R:1 L:1 | `line-height` on `<div>` |
| `line-height: 1.7` | 2 | S:1 O:1 | `line-height` on `<div>` |
| `line-height: 1.06` | 1 | L:1 | `line-height` on `<h2>` |
| `line-height: 1.16` | 1 | R:1 | `line-height` on `<p>` |
| `line-height: 1.25` | 1 | L:1 | `line-height` on `<div>` |
| `line-height: 1.35` | 1 | R:1 | `line-height` on `<div>` |
| `line-height: 1.4` | 1 | S:1 | `line-height` on `<div>` |

#### A7 · `font-family` / `font`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `font: inherit` | 146 | R:65 S:61 O:16 L:4 | `font` on `<button>` |
| `font-family: 'Geist',system-ui,sans-serif` | 4 | R:1 S:1 O:1 L:1 | `font-family` on `<div>` |
| `font-family: ui-monospace,Menlo,monospace` | 4 | R:4 | `font-family` on `<div>` |

#### A8 · `border-radius`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `border-radius: 50%` | 62 | R:19 S:22 O:14 L:7 | Dots, avatars, round icon buttons. |
| `border-radius: 999px` | 56 | R:33 S:8 O:3 L:12 | Pills, search bar, CTA buttons. |
| `border-radius: 12px` | 46 | R:5 S:36 O:5 | Default card / menu / toast radius (Settings). |
| `border-radius: 14px` | 24 | R:5 S:10 O:4 L:5 | Card radius (chat bubbles, toasts). |
| `border-radius: 16px` | 21 | R:6 S:9 O:3 L:3 | Panel radius. |
| `border-radius: 8px` | 20 | R:15 S:2 O:1 L:2 | Small control (inputs, text buttons). |
| `border-radius: 10px` | 14 | R:4 S:4 O:6 | Menu item / small button. |
| `border-radius: 62% 38% 46% 54%/44% 58% 42% 56%` | 10 | R:4 L:6 | The Scout **blob** rest shape. |
| `border-radius: 18px` | 6 | S:4 L:2 | `border-radius` on `<div>` |
| `border-radius: 22px` | 6 | R:3 S:1 L:2 | `border-radius` on `<div>` |
| `border-radius: 26px` | 5 | L:5 | `border-radius` on `<div>` |
| `border-radius: 3px` | 5 | L:5 | `border-radius` on `<div>` |
| `border-radius: 6px` | 4 | R:3 O:1 | `border-radius` on `<button>` |
| `border-radius: 18px 18px 4px 18px` | 3 | R:2 L:1 | `border-radius` on `<div>` |
| `border-radius: 24px` | 3 | R:2 L:1 | `border-radius` on `<div>` |
| `border-radius: 20px` | 2 | R:1 S:1 | `border-radius` on `<div>` |
| `border-radius: 28px` | 2 | S:1 O:1 | `border-radius` on `<div>` |
| `border-radius: 54% 46% 58% 42%/50% 44% 56% 50%` | 2 | R:1 L:1 | `border-radius` on `<<style>>` |
| `border-radius: 56% 44% 52% 48%/56% 46% 54% 44%` | 2 | R:1 L:1 | `border-radius` on `<<style>>` |
| `border-radius: 5px` | 2 | O:2 | `border-radius` on `<img>` |
| `border-radius: 9px` | 2 | S:2 | `border-radius` on `<button>` |
| `border-radius: 46% 54% 52% 48%/55% 45% 55% 45%` | 1 | R:1 | `border-radius` on `<span>` |
| `border-radius: 46% 54% 60% 40%/58% 40% 60% 42%` | 1 | R:1 | `border-radius` on `<<style>>` |
| `border-radius: 56% 44% 40% 60%/48% 62% 38% 52%` | 1 | R:1 | `border-radius` on `<<style>>` |
| `border-radius: {{ listRadius }}px` | 1 | R:1 | fact list — `card ? 26 : 16` |
| `border-radius: {{ m.radius }}` | 1 | R:1 | transcript bubble — `scout ? '14px 14px 14px 4px' : '14px 14px 4px 14px'` |
| `border-radius: {{ shRadius }}` | 1 | R:1 | bottom sheet — `sheetCard ? '26px 26px 0 0' : '20px'` |
| `border-radius: {{ stR }}` | 1 | R:1 | mobile stage frame — `mobile ? '44px' : '0'` |

**Radius values that exist only as bound values** and therefore appear in no literal row above: `26px 26px 0 0` (sheet, card variant) and `26` / `16` (fact list). Add both to the radius scale (§C2).

#### A9 · Border & outline definitions

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `border: 0` | 113 | R:57 S:44 O:10 L:2 | Reset on `<button>` (146 of them inherit `font:inherit` too). |
| `border-bottom: 1px solid rgba(255,220,190,.1)` | 30 | S:21 O:9 | `border-bottom` on `<div>` |
| `border: 1px solid rgba(255,220,190,.28)` | 26 | R:3 S:19 O:4 | `border` on `<button>` |
| `border: 1px solid rgba(255,200,160,.14)` | 23 | R:8 S:4 O:2 L:9 | `border` on `<div>` |
| `border: 1px solid rgba(255,200,160,.16)` | 19 | R:11 S:5 L:3 | `border` on `<div>` |
| `border-bottom: 1px solid rgba(255,220,190,.08)` | 13 | S:3 O:8 L:2 | `border-bottom` on `<div>` |
| `border: 1px solid rgba(255,200,160,.12)` | 11 | R:1 S:6 O:2 L:2 | `border` on `<div>` |
| `border-top: 1px solid rgba(255,220,190,.1)` | 9 | R:2 S:6 O:1 | `border-top` on `<div>` |
| `border: 1px solid rgba(255,220,190,.22)` | 8 | R:3 S:2 O:1 L:2 | `border` on `<button>` |
| `outline: none` | 6 | R:6 | `outline` on `<input>` |
| `border: 1px solid rgba(255,220,190,.16)` | 5 | R:1 S:4 | `border` on `<span>` |
| `border: 1px solid rgba(255,220,190,.2)` | 5 | S:3 O:2 | `border` on `<div>` |
| `border: 1px solid rgba(255,140,90,.35)` | 4 | R:3 L:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,200,160,.18)` | 4 | R:3 L:1 | `border` on `<button>` |
| `border: 1px solid rgba(255,220,190,.3)` | 4 | R:3 L:1 | `border` on `<button>` |
| `outline: 2px solid #ff6926` | 4 | R:1 S:1 O:1 L:1 | `outline` on `<<style>>` |
| `border-top: 1px solid rgba(255,220,190,.08)` | 3 | L:3 | `border-top` on `<div>` |
| `border: 1px solid rgba(255,140,90,.5)` | 3 | R:1 S:1 L:1 | `border` on `<span>` |
| `border: 1px solid {{ it.border }}` | 3 | S:2 O:1 | `border` on `<button>` |
| `border-left: 1px solid rgba(255,200,160,.16)` | 2 | S:1 O:1 | `border-left` on `<div>` |
| `border-left: 1px solid rgba(255,220,190,.12)` | 2 | S:2 | `border-left` on `<div>` |
| `border-right: 1px solid rgba(255,220,190,.08)` | 2 | S:1 O:1 | `border-right` on `<nav>` |
| `border: 1px dashed rgba(255,200,160,.35)` | 2 | S:1 O:1 | `border` on `<div>` |
| `border: 1px solid rgba(224,161,58,.35)` | 2 | R:1 S:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,140,90,.3)` | 2 | R:1 L:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,140,90,.4)` | 2 | R:2 | `border` on `<button>` |
| `border: 1px solid rgba(255,140,90,.45)` | 2 | R:1 L:1 | `border` on `<button>` |
| `border: 1px solid rgba(255,190,140,.16)` | 2 | S:1 O:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,200,160,.25)` | 2 | R:2 | `border` on `<input>` |
| `border: 1px solid rgba(255,220,190,.18)` | 2 | S:1 O:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,255,255,.1)` | 2 | R:2 | `border` on `<div>` |
| `border-bottom: 1px solid rgba(255,220,190,.06)` | 1 | O:1 | `border-bottom` on `<div>` |
| `border-bottom: 1px solid {{ hdrLine }}` | 1 | L:1 | `border-bottom` on `<header>` |
| `border-bottom: 2px solid {{ t.line }}` | 1 | S:1 | `border-bottom` on `<button>` |
| `border-left: 1px solid rgba(255,200,160,.12)` | 1 | R:1 | `border-left` on `<div>` |
| `border-left: 1px solid rgba(255,220,190,.1)` | 1 | O:1 | `border-left` on `<div>` |
| `border-top: 1px solid rgba(255,220,190,.12)` | 1 | L:1 | `border-top` on `<footer>` |
| `border: 1px solid rgba(224,161,58,.45)` | 1 | O:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,140,90,.22)` | 1 | S:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,140,90,.55)` | 1 | L:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,140,90,.6)` | 1 | O:1 | `border` on `<span>` |
| `border: 1px solid rgba(255,190,140,.26)` | 1 | L:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,200,160,.2)` | 1 | R:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,200,160,.22)` | 1 | S:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,200,160,.3)` | 1 | S:1 | `border` on `<input>` |
| `border: 1px solid rgba(255,220,190,.1)` | 1 | L:1 | `border` on `<div>` |
| `border: 1px solid rgba(255,220,190,.14)` | 1 | L:1 | `border` on `<span>` |
| `border: 1px solid rgba(255,220,190,.25)` | 1 | L:1 | `border` on `<span>` |
| `border: 1px solid {{ autoCardBorder }}` | 1 | S:1 | `autopilot ? 'rgba(255,105,38,.75)' : 'rgba(255,220,190,.14)'` |
| `border: 1px solid {{ c.border }}` | 1 | R:1 | `best ? 'rgba(255,140,90,.5)' : 'rgba(255,200,160,.14)'` |
| `border: 1px solid {{ c.btnBorder }}` | 1 | R:1 | `best ? '#ff6926' : 'rgba(255,220,190,.28)'` |
| `border: 1px solid {{ listBorder }}` | 1 | R:1 | `card ? 'rgba(255,200,160,.16)' : 'rgba(255,200,160,.10)'` |
| `border: 1px solid {{ micBorder }}` | 1 | R:1 | `micOn ? '#ff6926' : 'rgba(255,220,190,.16)'` |
| `border: 1px solid {{ q.border }}` | 1 | L:1 | FAQ row — `open ? 'rgba(255,105,38,.7)' : 'rgba(255,200,160,.14)'` |
| `border: 1px solid {{ revCardBorder }}` | 1 | S:1 | `review ? 'rgba(255,105,38,.75)' : 'rgba(255,220,190,.14)'` |
| `border: 1px solid {{ s.rowBorder }}` | 1 | S:1 | expanded source row — `open ? 'rgba(255,200,160,.14)' : 'transparent'` |
| `border: 2px solid {{ autoRing }}` | 1 | S:1 | autonomy radio ring — `autopilot ? '#ff6926' : 'rgba(255,220,190,.35)'` |
| `border: 2px solid {{ revRing }}` | 1 | S:1 | autonomy radio ring — `review ? '#ff6926' : 'rgba(255,220,190,.35)'` |
| `border: {{ stB }}` | 1 | R:1 | mobile stage frame — `mobile ? '1px solid rgba(255,220,190,.2)' : '0'` |
| `border: 1px solid {{ it.border }}` (see above, 3×) | — | S:2 O:1 | sidebar item — `cur ? 'rgba(255,140,90,.35)' : 'transparent'` |
| `border-bottom: 2px solid {{ t.line }}` (see above) | — | S:1 | Settings tab underline — `active ? '#ff6926' : 'transparent'` |
| `border-bottom: 1px solid {{ hdrLine }}` (see above) | — | L:1 | Landing header — `scrolled ? 'rgba(255,220,190,.1)' : 'transparent'` |

#### A10 · `box-shadow`, `filter`, `backdrop-filter`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `box-shadow: 0 1px 3px rgba(0,0,0,.3)` | 6 | S:5 O:1 | Toggle knob. |
| `box-shadow: 0 8px 28px rgba(255,105,38,.25)` | 5 | R:4 L:1 | Primary CTA glow. |
| `box-shadow: 0 8px 32px rgba(255,105,38,.28)` | 3 | R:1 L:2 | `box-shadow` on `<button>` |
| `backdrop-filter: blur(6px)` | 2 | R:2 | `backdrop-filter` on `<form>` |
| `box-shadow: 0 0 34px 6px rgba(255,120,50,.35),0 0 110px 20px rgba(255,105,38,.18)` | 2 | R:1 L:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 30px 80px rgba(0,0,0,.5)` | 2 | S:2 | `box-shadow` on `<div>` |
| `box-shadow: 0 30px 90px rgba(0,0,0,.35)` | 2 | S:1 O:1 | Settings/Operator shell. |
| `filter: saturate(.62) brightness(.5)` | 2 | R:1 L:1 | `filter` on `<div>` |
| `backdrop-filter: blur(10px)` | 1 | R:1 | `backdrop-filter` on `<div>` |
| `backdrop-filter: blur(8px)` | 1 | R:1 | `backdrop-filter` on `<div>` |
| `backdrop-filter: {{ hdrBlur }}` | 1 | L:1 | `backdrop-filter` on `<header>` |
| `box-shadow: 0 -10px 60px rgba(255,105,38,.12),0 40px 100px rgba(0,0,0,.5)` | 1 | L:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 -20px 60px rgba(0,0,0,.4)` | 1 | R:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 0 18px rgba(255,105,38,.4)` | 1 | L:1 | `box-shadow` on `<span>` |
| `box-shadow: 0 0 30px 6px rgba(255,120,50,.35),0 0 90px 16px rgba(255,105,38,.18)` | 1 | L:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 0 60px 10px rgba(255,105,38,.35)` | 1 | L:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 0 8px rgba(255,105,38,.5)` | 1 | R:1 | `box-shadow` on `<span>` |
| `box-shadow: 0 16px 40px rgba(0,0,0,.4)` | 1 | R:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 16px 40px rgba(0,0,0,.45)` | 1 | S:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 20px 50px rgba(0,0,0,.45)` | 1 | R:1 | `box-shadow` on `<div>` |
| `box-shadow: 0 30px 80px rgba(0,0,0,.35)` | 1 | L:1 | `box-shadow` on `<div>` |
| `box-shadow: {{ listShadow }}` | 1 | R:1 | `box-shadow` on `<div>` |
| `box-shadow: {{ micShadow }}` | 1 | R:1 | `box-shadow` on `<span>` |
| `filter: brightness(1.1)` | 1 | R:1 | `filter` on `<button>` |

#### A11 · `padding` / `margin` / `gap` / `inset` — **all 235 distinct declarations**

The 70 most frequent are annotated below; the remaining 165 follow in **§A11b**, unannotated but complete. (Counts in this first table include the four `<style>` blocks — that is why `margin: 0` reads 25 here and 23 in §A11b's basis, which is inline `style` + `style-hover` only.)

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `gap: 12px` | 44 | R:18 S:3 O:13 L:10 | Default row gap. |
| `gap: 10px` | 41 | R:25 S:10 O:2 L:4 | Icon+label gap. |
| `margin-top: 2px` | 29 | R:11 S:17 O:1 | `margin-top` on `<div>` |
| `margin-top: 6px` | 29 | R:5 S:13 O:3 L:8 | Label→value rhythm. |
| `gap: 8px` | 27 | R:11 S:6 O:3 L:7 | Tight gap. |
| `margin: 0` | 25 | R:6 S:9 O:7 L:3 | `margin` on `<<style>>` |
| `margin-top: 26px` | 24 | R:4 S:11 O:7 L:2 | Section rhythm (large). |
| `gap: 20px` | 23 | S:21 O:1 L:1 | `gap` on `<div>` |
| `padding: 0 18px` | 23 | R:1 S:14 O:4 L:4 | Pill/button horizontal padding (h=44–46px). |
| `gap: 14px` | 22 | R:5 S:6 O:8 L:3 | `gap` on `<div>` |
| `margin-top: 14px` | 22 | R:7 S:9 O:3 L:3 | Section rhythm (medium). |
| `gap: 16px` | 20 | R:4 S:7 O:8 L:1 | `gap` on `<div>` |
| `margin-top: 22px` | 18 | R:8 S:5 O:2 L:3 | `margin-top` on `<button>` |
| `padding: 0 22px` | 18 | R:6 S:11 L:1 | `padding` on `<button>` |
| `margin-top: 24px` | 17 | R:2 S:6 O:5 L:4 | `margin-top` on `<div>` |
| `margin-top: 4px` | 16 | R:1 S:9 O:3 L:3 | `margin-top` on `<div>` |
| `margin-top: 18px` | 15 | R:3 S:9 L:3 | `margin-top` on `<div>` |
| `margin-top: 8px` | 15 | R:4 S:7 L:4 | `margin-top` on `<button>` |
| `margin-top: 10px` | 14 | R:6 S:5 O:3 | `margin-top` on `<div>` |
| `margin-top: 16px` | 14 | R:4 S:4 O:4 L:2 | `margin-top` on `<button>` |
| `margin: 10px 0 0` | 14 | S:7 O:7 | `margin` on `<p>` |
| `padding: 0` | 14 | R:6 S:6 O:1 L:1 | `padding` on `<<style>>` |
| `gap: 9px` | 13 | R:5 S:2 O:5 L:1 | `gap` on `<div>` |
| `padding: 0 20px` | 13 | R:6 S:5 O:2 | `padding` on `<button>` |
| `margin-top: 12px` | 12 | R:3 S:6 O:1 L:2 | `margin-top` on `<div>` |
| `gap: 18px` | 11 | R:5 S:3 L:3 | `gap` on `<div>` |
| `inset: 0` | 11 | R:3 S:3 O:1 L:4 | `inset` on `<div>` |
| `padding: 0 14px` | 9 | R:3 S:5 O:1 | `padding` on `<span>` |
| `padding: 0 16px` | 9 | R:1 S:5 O:2 L:1 | `padding` on `<button>` |
| `gap: 6px` | 8 | R:1 S:3 O:4 | `gap` on `<div>` |
| `margin-top: 20px` | 8 | R:2 S:1 O:2 L:3 | `margin-top` on `<button>` |
| `margin-top: 28px` | 8 | R:4 S:4 | `margin-top` on `<div>` |
| `padding: 6px 0` | 8 | R:1 S:4 O:3 | `padding` on `<button>` |
| `padding: 14px 16px` | 7 | R:5 S:1 L:1 | `padding` on `<div>` |
| `padding: 14px 18px` | 7 | R:3 S:1 O:2 L:1 | `padding` on `<div>` |
| `padding: 18px 0` | 7 | S:6 O:1 | `padding` on `<div>` |
| `margin-top: 1px` | 6 | R:5 O:1 | `margin-top` on `<svg>` |
| `margin: 0 auto` | 6 | R:1 O:1 L:4 | `margin` on `<div>` |
| `padding-bottom: 12px` | 6 | S:3 O:3 | `padding-bottom` on `<div>` |
| `padding: 6px 8px` | 6 | R:6 | `padding` on `<button>` |
| `padding: 8px 12px` | 6 | R:6 | `padding` on `<button>` |
| `margin-top: 30px` | 5 | R:2 S:3 | `margin-top` on `<div>` |
| `margin-top: 34px` | 5 | R:2 L:3 | `margin-top` on `<button>` |
| `margin-top: 3px` | 5 | S:4 O:1 | `margin-top` on `<span>` |
| `padding: 0 8px` | 5 | R:5 | `padding` on `<button>` |
| `margin-bottom: 4px` | 4 | S:2 O:1 L:1 | `margin-bottom` on `<button>` |
| `padding: 0 24px` | 4 | R:4 | `padding` on `<button>` |
| `padding: 0 6px` | 4 | R:3 L:1 | `padding` on `<input>` |
| `padding: 10px 14px` | 4 | R:1 O:3 | `padding` on `<div>` |
| `padding: 12px 14px` | 4 | O:2 L:2 | `padding` on `<div>` |
| `padding: 16px 18px` | 4 | R:1 S:2 O:1 | `padding` on `<div>` |
| `padding: 32px 34px` | 4 | L:4 | `padding` on `<div>` |
| `padding: 6px 4px` | 4 | R:2 S:1 L:1 | `padding` on `<div>` |
| `padding: 8px 10px` | 4 | R:2 S:1 O:1 | `padding` on `<button>` |
| `gap: 0` | 3 | R:2 O:1 | `gap` on `<div>` |
| `gap: 22px` | 3 | R:1 S:1 L:1 | `gap` on `<div>` |
| `gap: 4px` | 3 | R:2 S:1 | `gap` on `<div>` |
| `margin: 18px 0 0` | 3 | L:3 | `margin` on `<h2>` |
| `margin: 22px 0 0` | 3 | R:2 L:1 | `margin` on `<h1>` |
| `padding-top: 22px` | 3 | S:2 O:1 | `padding-top` on `<div>` |
| `padding: 0 10px` | 3 | R:1 S:1 O:1 | `padding` on `<button>` |
| `padding: 0 8px 0 18px` | 3 | R:3 | `padding` on `<form>` |
| `padding: 10px 0` | 3 | O:3 | `padding` on `<div>` |
| `padding: 12px 0` | 3 | O:1 L:2 | `padding` on `<div>` |
| `padding: 12px 16px` | 3 | S:1 L:2 | `padding` on `<div>` |
| `padding: 14px 0` | 3 | S:3 | `padding` on `<div>` |
| `padding: 16px 24px 32px` | 3 | R:3 | `padding` on `<div>` |
| `padding: 18px 22px` | 3 | S:2 O:1 | `padding` on `<div>` |
| `padding: 20px 22px` | 3 | S:3 | `padding` on `<div>` |
| `padding: 20px 24px 32px` | 3 | R:3 | `padding` on `<div>` |


#### A11b · The remaining 165 `padding` / `margin` / `gap` / `inset` declarations

Complete tail of §A11, same sort (count desc, then value). Basis: inline `style` + `style-hover` only.

| Value | n | Files |
|---|---:|---|
| `padding: 22px 0` | 3 | S:3 |
| `padding: 2px 4px` | 3 | R:1 S:2 |
| `gap: 10px 24px` | 2 | R:1 O:1 |
| `gap: 26px` | 2 | L:2 |
| `gap: 2px` | 2 | R:2 |
| `margin-bottom: 22px` | 2 | R:2 |
| `margin-bottom: 6px` | 2 | S:1 L:1 |
| `margin-left: 8px` | 2 | S:1 O:1 |
| `margin-top: 40px` | 2 | R:1 L:1 |
| `margin-top: 44px` | 2 | L:2 |
| `margin-top: 5px` | 2 | R:1 S:1 |
| `margin: 0 0 30px` | 2 | R:1 L:1 |
| `margin: 12px 0 0` | 2 | R:2 |
| `margin: 24px 0 0` | 2 | R:1 L:1 |
| `margin: 24px 0 20px` | 2 | S:1 O:1 |
| `margin: 34px 10px 10px` | 2 | S:1 O:1 |
| `padding-bottom: 22px` | 2 | S:2 |
| `padding-top: 12px` | 2 | R:1 S:1 |
| `padding: 0 12px` | 2 | S:1 L:1 |
| `padding: 0 34px` | 2 | R:1 L:1 |
| `padding: 10px 12px` | 2 | R:2 |
| `padding: 10px 14px 14px` | 2 | O:2 |
| `padding: 10px 16px` | 2 | R:2 |
| `padding: 14px 0 12px` | 2 | R:1 O:1 |
| `padding: 14px 20px` | 2 | R:1 S:1 |
| `padding: 14px 4px` | 2 | S:2 |
| `padding: 16px 20px` | 2 | R:1 S:1 |
| `padding: 18px 20px` | 2 | S:1 O:1 |
| `padding: 20px 0` | 2 | S:2 |
| `padding: 20px 24px` | 2 | S:2 |
| `padding: 22px 24px` | 2 | S:1 O:1 |
| `padding: 24px 24px 40px` | 2 | R:2 |
| `padding: 24px 26px` | 2 | R:1 S:1 |
| `padding: 30px 32px` | 2 | S:1 L:1 |
| `padding: 36px 26px 30px` | 2 | S:1 O:1 |
| `padding: 42px 46px 40px` | 2 | S:1 O:1 |
| `padding: 4px` | 2 | S:1 L:1 |
| `padding: 4px 0` | 2 | S:1 O:1 |
| `padding: 4px 36px 0` | 2 | R:1 O:1 |
| `padding: 4px 6px` | 2 | R:2 |
| `padding: 5px 11px` | 2 | R:1 L:1 |
| `padding: 6px 0 6px 28px` | 2 | S:2 |
| `padding: 6px 10px` | 2 | R:2 |
| `padding: 8px 14px` | 2 | R:2 |
| `padding: 9px 12px` | 2 | S:2 |
| `gap: {{ ctrlGap }}px` | 1 | R:1 |
| `gap: {{ hdrGap }}px` | 1 | R:1 |
| `gap: {{ listGap }}px` | 1 | R:1 |
| `gap: {{ rowGap }}px` | 1 | R:1 |
| `gap: 0 40px` | 1 | O:1 |
| `gap: 24px` | 1 | S:1 |
| `gap: 34px` | 1 | L:1 |
| `gap: 40px` | 1 | L:1 |
| `gap: clamp(24px,4vw,60px)` | 1 | L:1 |
| `gap: clamp(30px,5vw,80px)` | 1 | L:1 |
| `gap: min(22px,2.2vh)` | 1 | L:1 |
| `inset: -2%` | 1 | R:1 |
| `inset: -6% -2%` | 1 | L:1 |
| `margin-bottom: -1px` | 1 | S:1 |
| `margin-bottom: {{ autoBlobMb }}px` | 1 | R:1 |
| `margin-bottom: {{ listHeadMb }}px` | 1 | R:1 |
| `margin-bottom: {{ s.mb }}px` | 1 | S:1 |
| `margin-bottom: {{ welcomeBlobMb }}px` | 1 | R:1 |
| `margin-bottom: 10px` | 1 | L:1 |
| `margin-bottom: 28px` | 1 | R:1 |
| `margin-bottom: 30px` | 1 | R:1 |
| `margin-bottom: 32px` | 1 | L:1 |
| `margin-bottom: 34px` | 1 | R:1 |
| `margin-bottom: 40px` | 1 | R:1 |
| `margin-bottom: min(22px,2.5vh)` | 1 | L:1 |
| `margin-bottom: min(44px,5vh)` | 1 | L:1 |
| `margin-right: 6px` | 1 | R:1 |
| `margin-right: auto` | 1 | S:1 |
| `margin-top: {{ offerPillTop }}px` | 1 | R:1 |
| `margin-top: 36px` | 1 | R:1 |
| `margin-top: 42px` | 1 | R:1 |
| `margin-top: 48px` | 1 | R:1 |
| `margin-top: 50px` | 1 | L:1 |
| `margin-top: 90px` | 1 | L:1 |
| `margin-top: min(12vh,110px)` | 1 | R:1 |
| `margin: -12px 0 22px` | 1 | R:1 |
| `margin: 0 0 26px` | 1 | R:1 |
| `margin: 0 16px` | 1 | S:1 |
| `margin: 0 2px` | 1 | R:1 |
| `margin: 14px 0 0` | 1 | R:1 |
| `margin: 14px 10px 0` | 1 | S:1 |
| `margin: 16px 0 0` | 1 | L:1 |
| `margin: 26px 0 0` | 1 | L:1 |
| `margin: 28px 10px 10px` | 1 | S:1 |
| `margin: 2px 4px 6px` | 1 | R:1 |
| `margin: 34px 0 0` | 1 | L:1 |
| `margin: 6px 0 0` | 1 | S:1 |
| `padding-bottom: 10px` | 1 | L:1 |
| `padding-bottom: 18px` | 1 | O:1 |
| `padding-bottom: 26px` | 1 | S:1 |
| `padding-left: 18px` | 1 | O:1 |
| `padding-left: 30px` | 1 | O:1 |
| `padding-top: 10px` | 1 | R:1 |
| `padding-top: 24px` | 1 | S:1 |
| `padding-top: 6px` | 1 | R:1 |
| `padding: {{ f.pad }}` | 1 | R:1 |
| `padding: {{ hdrPad }}` | 1 | R:1 |
| `padding: {{ listPad }}` | 1 | R:1 |
| `padding: {{ shPad }}` | 1 | R:1 |
| `padding: 0 26px 24px` | 1 | L:1 |
| `padding: 0 30px` | 1 | L:1 |
| `padding: 0 32px` | 1 | L:1 |
| `padding: 0 36px` | 1 | O:1 |
| `padding: 0 40px` | 1 | R:1 |
| `padding: 0 8px 0 20px` | 1 | R:1 |
| `padding: 0 clamp(20px,4vw,48px)` | 1 | L:1 |
| `padding: 100px 24px 0` | 1 | L:1 |
| `padding: 100px 24px 100px` | 1 | L:1 |
| `padding: 100px 24px 80px` | 1 | L:1 |
| `padding: 10px` | 1 | L:1 |
| `padding: 10px 12px 8px` | 1 | R:1 |
| `padding: 10px 18px` | 1 | S:1 |
| `padding: 110px clamp(20px,5vw,80px) 40px` | 1 | L:1 |
| `padding: 120px clamp(20px,5vw,80px) 0` | 1 | L:1 |
| `padding: 12px 12px 12px 16px` | 1 | R:1 |
| `padding: 12px 18px` | 1 | R:1 |
| `padding: 12px 6px` | 1 | S:1 |
| `padding: 130px 24px 40px` | 1 | L:1 |
| `padding: 13px 18px` | 1 | L:1 |
| `padding: 14px` | 1 | O:1 |
| `padding: 14px 8px` | 1 | S:1 |
| `padding: 16px 0` | 1 | S:1 |
| `padding: 16px 10px` | 1 | O:1 |
| `padding: 16px 16px 16px 14px` | 1 | S:1 |
| `padding: 16px 24px {{ discoveryPadBottom }}px` | 1 | R:1 |
| `padding: 16px 8px 18px` | 1 | S:1 |
| `padding: 18px 14px` | 1 | O:1 |
| `padding: 20px` | 1 | S:1 |
| `padding: 20px 22px 22px` | 1 | R:1 |
| `padding: 22px 26px` | 1 | L:1 |
| `padding: 26px 28px` | 1 | S:1 |
| `padding: 26px 28px 28px` | 1 | L:1 |
| `padding: 26px clamp(20px,5vw,80px) 30px` | 1 | L:1 |
| `padding: 28px 30px` | 1 | R:1 |
| `padding: 28px clamp(22px,3vw,36px) 30px` | 1 | R:1 |
| `padding: 2px 0` | 1 | R:1 |
| `padding: 30px 24px 40px` | 1 | R:1 |
| `padding: 34px` | 1 | O:1 |
| `padding: 34px 34px 30px` | 1 | S:1 |
| `padding: 34px 36px 30px` | 1 | R:1 |
| `padding: 3px 10px` | 1 | S:1 |
| `padding: 4px 10px` | 1 | S:1 |
| `padding: 4px 10px 18px` | 1 | O:1 |
| `padding: 4px 24px 24px` | 1 | R:1 |
| `padding: 4px 4px` | 1 | R:1 |
| `padding: 4px 8px` | 1 | S:1 |
| `padding: 5px 10px` | 1 | O:1 |
| `padding: 5px 12px` | 1 | S:1 |
| `padding: 60px clamp(20px,5vw,80px) 40px` | 1 | L:1 |
| `padding: 6px` | 1 | S:1 |
| `padding: 6px 18px` | 1 | L:1 |
| `padding: 6px 2px` | 1 | S:1 |
| `padding: 6px 8px 6px 12px` | 1 | R:1 |
| `padding: 7px 0` | 1 | R:1 |
| `padding: 8px` | 1 | R:1 |
| `padding: 8px 0` | 1 | S:1 |
| `padding: clamp(24px,3vw,44px) clamp(24px,3.4vw,52px)` | 1 | L:1 |
| `padding: clamp(24px,3vw,44px) clamp(24px,3.4vw,56px)` | 1 | R:1 |
| `padding: min(90px,10vh) 24px 4vh` | 1 | L:1 |
| `padding: min(90px,10vh) clamp(20px,5vw,80px) 4vh` | 1 | L:1 |
#### A12 · `opacity` / `mix-blend-mode`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `opacity: 0` | 6 | R:3 S:1 O:1 L:1 | `opacity` on `<<style>>` |
| `opacity: 1` | 5 | R:2 S:1 O:1 L:1 | `opacity` on `<<style>>` |
| `mix-blend-mode: overlay` | 2 | R:1 L:1 | `mix-blend-mode` on `<div>` |
| `opacity: .28` | 2 | R:1 L:1 | `opacity` on `<div>` |
| `opacity: .4` | 2 | R:1 L:1 | `opacity` on `<<style>>` |
| `opacity: {{ convoOp }}` | 2 | L:2 | `opacity` on `<div>` |
| `opacity: {{ f.opacity }}` | 2 | R:2 | `opacity` on `<div>` |
| `opacity: .9` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ ansOp }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ c.op }}` | 1 | L:1 | `opacity` on `<span>` |
| `opacity: {{ cardOp }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ clarOp }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ f.op }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ headlineOpacity }}` | 1 | R:1 | `opacity` on `<h1>` |
| `opacity: {{ l.op }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ listOp }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ listOpacity }}` | 1 | R:1 | `opacity` on `<div>` |
| `opacity: {{ memOldOp }}` | 1 | L:1 | `opacity` on `<span>` |
| `opacity: {{ offerOp }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ q.plusOp }}` | 1 | L:1 | `opacity` on `<path>` |
| `opacity: {{ repOp }}` | 1 | L:1 | `opacity` on `<div>` |
| `opacity: {{ st.op }}` | 1 | L:1 | `opacity` on `<div>` |

#### A13 · `transition`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `transition: transform .3s` | 10 | R:5 L:5 | Chevron / knob. |
| `transition: transform .2s` | 7 | S:5 O:2 | `transition` on `<span>` |
| `transition: background .15s` | 6 | S:4 O:2 | Ghost hover. |
| `transition: background .2s` | 6 | S:5 O:1 | `transition` on `<button>` |
| `transition-duration: .01ms!important` | 4 | R:1 S:1 O:1 L:1 | `transition-duration` on `<<style>>` |
| `transition: background .5s` | 3 | R:2 S:1 | `transition` on `<div>` |
| `transition: background .2s,border-color .2s` | 2 | S:2 | `transition` on `<button>` |
| `transition: opacity .5s` | 2 | R:1 L:1 | `transition` on `<h1>` |
| `transition: opacity .5s,transform .5s` | 2 | L:2 | `transition` on `<div>` |
| `transition: transform .25s` | 2 | S:2 | `transition` on `<svg>` |
| `transition: background .25s,border-color .25s` | 1 | S:1 | `transition` on `<div>` |
| `transition: background .3s` | 1 | R:1 | `transition` on `<span>` |
| `transition: border-color .3s` | 1 | L:1 | `transition` on `<div>` |
| `transition: box-shadow .6s` | 1 | R:1 | `transition` on `<div>` |
| `transition: color .15s` | 1 | S:1 | `transition` on `<button>` |
| `transition: color .4s` | 1 | L:1 | `transition` on `<span>` |
| `transition: color .6s` | 1 | L:1 | `transition` on `<span>` |
| `transition: font-size .4s` | 1 | R:1 | `transition` on `<button>` |
| `transition: font-size .9s,color .9s` | 1 | R:1 | `transition` on `<div>` |
| `transition: grid-template-rows .26s cubic-bezier(.3,.7,.2,1)` | 1 | S:1 | `transition` on `<div>` |
| `transition: grid-template-rows .32s cubic-bezier(.3,.7,.2,1)` | 1 | L:1 | `transition` on `<div>` |
| `transition: height .3s,background .3s,border-color .3s` | 1 | L:1 | `transition` on `<header>` |
| `transition: left .6s cubic-bezier(.22,.8,.2,1),right .6s cubic-bezier(.22,.8,.2,1),bottom .6s cubic-bezier(.22,.8,.2,1),border-radius .6s,padding .6s` | 1 | R:1 | `transition` on `<div>` |
| `transition: left .9s cubic-bezier(.22,.8,.2,1),top .9s cubic-bezier(.22,.8,.2,1),width .9s cubic-bezier(.22,.8,.2,1),height .9s cubic-bezier(.22,.8,.2,1),opacity .6s` | 1 | R:1 | `transition` on `<div>` |
| `transition: left .9s cubic-bezier(.22,.8,.2,1),top .9s cubic-bezier(.22,.8,.2,1),width .9s cubic-bezier(.22,.8,.2,1),padding .9s cubic-bezier(.22,.8,.2,1),border-radius .9s,background .9s,border-color .9s,gap .9s,opacity .5s,transform .5s` | 1 | R:1 | `transition` on `<div>` |
| `transition: margin .9s` | 1 | R:1 | `transition` on `<div>` |
| `transition: opacity .35s,background .5s` | 1 | R:1 | `transition` on `<div>` |
| `transition: opacity .45s,transform .55s cubic-bezier(.3,.7,.2,1)` | 1 | L:1 | `transition` on `<span>` |
| `transition: opacity .4s` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .4s,transform .5s cubic-bezier(.22,.8,.2,1),background .6s` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .5s .1s` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .5s,transform .6s` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .5s,transform .6s cubic-bezier(.22,.8,.2,1)` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .6s` | 1 | L:1 | `transition` on `<span>` |
| `transition: opacity .6s,transform .6s cubic-bezier(.22,.8,.2,1)` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .6s,transform .6s cubic-bezier(.22,.8,.2,1),visibility .6s` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .6s,transform .7s cubic-bezier(.22,.8,.2,1),visibility .6s` | 1 | L:1 | `transition` on `<div>` |
| `transition: opacity .7s,transform .7s cubic-bezier(.22,.8,.2,1),visibility .7s` | 1 | L:1 | `transition` on `<div>` |
| `transition: padding .9s,font-size .9s,gap .9s,height .9s,opacity .35s,background .5s` | 1 | R:1 | `transition` on `<div>` |
| `transition: transform .2s,background .2s` | 1 | R:1 | `transition` on `<button>` |
| `transition: width .4s,height .4s,border-radius .4s` | 1 | R:1 | `transition` on `<div>` |
| `transition: width .6s,height .6s,margin .6s` | 1 | R:1 | `transition` on `<div>` |

#### A14 · `animation`

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `animation: stFade .2s ease both` | 23 | S:23 | Settings mount animation. |
| `animation: rsFadeUp .3s ease both` | 13 | R:13 | Roomscout mount animation. |
| `animation: opFade .2s ease both` | 6 | O:6 | Operator mount animation. |
| `animation-duration: .01ms!important` | 4 | R:1 S:1 O:1 L:1 | `animation-duration` on `<<style>>` |
| `animation: rsFadeUp .35s ease both` | 4 | R:4 | `animation` on `<div>` |
| `animation: rsFadeUp .5s ease both` | 3 | R:3 | `animation` on `<div>` |
| `animation: rsFadeUp .6s ease both` | 3 | R:3 | `animation` on `<div>` |
| `animation: stFade .25s ease both` | 3 | S:3 | `animation` on `<div>` |
| `animation: opFade .25s ease both` | 2 | O:2 | `animation` on `<div>` |
| `animation: rsFadeUp .25s ease both` | 2 | R:2 | `animation` on `<div>` |
| `animation: rsFadeUp .45s ease both` | 2 | R:2 | `animation` on `<div>` |
| `animation: rsFadeUp .4s ease both` | 2 | R:2 | `animation` on `<div>` |
| `animation: rsFadeUp .6s .1s ease both` | 2 | R:2 | `animation` on `<div>` |
| `animation: rsFadeUp .7s .1s ease both` | 2 | R:2 | `animation` on `<h1>` |
| `animation: {{ blobAnim }}` | 2 | R:1 L:1 | `animation` on `<div>` |
| `animation: lpDot 2.4s ease-in-out infinite` | 1 | L:1 | `animation` on `<span>` |
| `animation: rsBreathe 5.2s ease-in-out infinite` | 1 | L:1 | `animation` on `<div>` |
| `animation: rsBreathe 6s ease-in-out infinite` | 1 | L:1 | `animation` on `<div>` |
| `animation: rsFadeUp .18s ease both` | 1 | R:1 | `animation` on `<div>` |
| `animation: rsFadeUp .6s .2s ease both` | 1 | R:1 | `animation` on `<div>` |
| `animation: rsFadeUp .6s .3s ease both` | 1 | R:1 | `animation` on `<button>` |
| `animation: rsFadeUp .7s .2s ease both` | 1 | R:1 | `animation` on `<button>` |
| `animation: rsFadeUp .7s .3s ease both` | 1 | R:1 | `animation` on `<button>` |
| `animation: stFade .15s ease both` | 1 | S:1 | `animation` on `<div>` |
| `animation: {{ badgeDotAnim }}` | 1 | R:1 | `animation` on `<span>` |

#### A15 · Sizing — control heights & widths — **all 171 distinct declarations**

The 50 most frequent are annotated below; the remaining 121 follow in **§A15b**.

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `height: 46px` | 27 | R:9 S:14 O:1 L:3 | **The dominant primary-control height, in Roomscout too.** R: stage CTA pills (`0 22px`/`0 20px`, r999), the 46 × 46 round voice button, the `{{ completeSummary }}` status pill (`:420`), save/cancel. S: primary + secondary buttons (r999 and r12), the search input. O: the single full-width button „Anmeldung als erneuert simulieren“ (`:202`). L: **not** a control — three `border-top` list rows in the bento. |
| `height: 44px` | 23 | R:5 S:9 O:3 L:6 | **Not a per-file twin of 46px — a different component set.** R: 44 × 44 round icon buttons (send / switch-to-voice) and two secondary stage pills. S: the tab bar (`height:44px;padding:0 20px;border-bottom:2px solid {{ t.line }}`) and dialog buttons. O: dialog buttons. L: the header CTA, the two Rückfrage buttons, a 44px blob anchor and two 44 × 44 avatars. See §F23. |
| `width: 100%` | 20 | R:10 S:2 O:3 L:5 | `width` on `<div>` |
| `height: 40px` | 17 | R:3 S:10 O:3 L:1 | Compact control height. |
| `height: 30px` | 13 | R:11 S:1 L:1 | `height` on `<button>` |
| `min-height: 0` | 13 | R:5 S:3 O:4 L:1 | `min-height` on `<div>` |
| `min-width: 0` | 13 | R:7 S:2 L:4 | `min-width` on `<input>` |
| `height: 100%` | 10 | R:5 S:1 O:1 L:3 | `height` on `<dc-import>` |
| `height: 26px` | 10 | S:8 O:2 | `height` on `<span>` |
| `height: 42px` | 10 | R:1 S:6 O:2 L:1 | `height` on `<button>` |
| `height: 9px` | 10 | S:2 O:8 | `height` on `<span>` |
| `width: 26px` | 10 | S:8 O:2 | `width` on `<span>` |
| `width: 9px` | 10 | S:2 O:8 | `width` on `<span>` |
| `min-height: 100%` | 9 | R:9 | `min-height` on `<div>` |
| `height: 48px` | 8 | R:2 S:6 | `height` on `<div>` |
| `height: 8px` | 8 | R:5 S:1 O:2 | `height` on `<span>` |
| `width: 40px` | 8 | R:2 S:5 O:1 | `width` on `<button>` |
| `width: 8px` | 8 | R:5 S:1 O:2 | `width` on `<span>` |
| `height: 22px` | 7 | R:3 S:2 O:2 | `height` on `<span>` |
| `height: 32px` | 7 | S:5 O:2 | `height` on `<button>` |
| `height: 50px` | 7 | R:3 S:2 O:1 L:1 | `height` on `<button>` |
| `height: 6px` | 7 | L:7 | `height` on `<span>` |
| `width: 56px` | 7 | S:6 O:1 | `width` on `<button>` |
| `height: 36px` | 6 | R:3 S:2 L:1 | `height` on `<button>` |
| `height: 38px` | 6 | S:3 O:2 L:1 | `height` on `<button>` |
| `width: 22px` | 6 | R:2 S:2 O:2 | `width` on `<span>` |
| `width: 30px` | 6 | R:5 S:1 | `width` on `<button>` |
| `height: 34px` | 5 | R:2 L:3 | `height` on `<span>` |
| `height: 56px` | 5 | R:3 L:2 | `height` on `<button>` |
| `height: 58px` | 5 | R:4 L:1 | `height` on `<form>` |
| `width: 44px` | 5 | R:2 L:3 | `width` on `<button>` |
| `max-width: 1400px` | 4 | L:4 | `max-width` on `<section>` |
| `width: 36px` | 4 | R:2 S:1 L:1 | `width` on `<button>` |
| `width: 42px` | 4 | R:1 S:2 O:1 | `width` on `<button>` |
| `height: 18px` | 3 | R:1 S:1 L:1 | `height` on `<span>` |
| `height: 1px` | 3 | R:1 S:1 O:1 | `height` on `<div>` |
| `height: 24px` | 3 | O:3 | `height` on `<span>` |
| `height: 7px` | 3 | S:2 L:1 | `height` on `<span>` |
| `height: 84px` | 3 | R:2 O:1 | **Three unrelated things, none of them the app header.** (a) `Roomscout.dc.html:364` the 112 × 84 offer thumbnail `<img style="width:112px;height:84px;object-fit:cover;border-radius:12px;flex:none">`; (b) `Roomscout.dc.html:588` the transcript-drawer header `height:84px;…;padding:0 24px;flex:none`; (c) `Operator.dc.html:19` the Operator **page** header `height:84px;…;padding:0 36px;flex:none`. The Roomscout app header uses the binding `height:{{ hdrH }}px` (`84` wide / `64` narrow); Landing's header is `hdrH: scrolled ? 64 : 80` — **80px**, not 84. |
| `height: {{ ctrl }}px` | 3 | R:3 | `height` on `<span>` |
| `max-width: 80%` | 3 | R:3 | `max-width` on `<div>` |
| `min-height: {{ offerImgMin }}px` | 3 | R:2 L:1 | `min-height` on `<img>` |
| `width: 1px` | 3 | R:2 L:1 | `width` on `<span>` |
| `width: 24px` | 3 | O:3 | `width` on `<span>` |
| `width: 7px` | 3 | S:2 L:1 | `width` on `<span>` |
| `width: 96px` | 3 | R:2 L:1 | `width` on `<div>` |
| `width: min(380px,100%)` | 3 | R:3 | `width` on `<div>` |
| `width: min(680px,100%)` | 3 | R:1 L:2 | `width` on `<div>` |
| `width: min(740px,100%)` | 3 | R:3 | `width` on `<div>` |
| `width: {{ ctrl }}px` | 3 | R:3 | `width` on `<span>` |


#### A15b · The remaining 121 sizing declarations

Complete tail of §A15, same sort. Basis: inline `style` + `style-hover` only. Every `{{ … }}` row is resolved in §A2b.

| Value | n | Files |
|---|---:|---|
| `height: {{ hdrBtn }}px` | 2 | R:2 |
| `height: {{ hdrH }}px` | 2 | R:1 L:1 |
| `height: 100vh` | 2 | L:2 |
| `height: 12px` | 2 | S:2 |
| `height: 150px` | 2 | R:2 |
| `height: 28px` | 2 | R:1 O:1 |
| `height: 52px` | 2 | R:1 S:1 |
| `height: 60px` | 2 | R:2 |
| `height: 72px` | 2 | R:1 S:1 |
| `height: 96px` | 2 | R:2 |
| `max-width: 1380px` | 2 | R:1 O:1 |
| `max-width: 460px` | 2 | L:2 |
| `max-width: 560px` | 2 | R:1 L:1 |
| `min-height: 100vh` | 2 | L:2 |
| `min-width: 220px` | 2 | S:2 |
| `min-width: 240px` | 2 | R:2 |
| `width: {{ hdrBtn }}px` | 2 | R:2 |
| `width: 12px` | 2 | S:2 |
| `width: 34px` | 2 | L:2 |
| `width: 6px` | 2 | L:2 |
| `width: 72px` | 2 | R:1 S:1 |
| `width: min(420px,100%)` | 2 | R:2 |
| `width: min(720px,100%)` | 2 | R:2 |
| `height: {{ autoBlob }}px` | 1 | R:1 |
| `height: {{ briefSpacerHeight }}px` | 1 | R:1 |
| `height: {{ discoveryBlob }}px` | 1 | R:1 |
| `height: {{ f.h }}px` | 1 | R:1 |
| `height: {{ stH }}` | 1 | R:1 |
| `height: {{ welcomeBlob }}px` | 1 | R:1 |
| `height: 10px` | 1 | R:1 |
| `height: 110px` | 1 | R:1 |
| `height: 118px` | 1 | R:1 |
| `height: 170px` | 1 | L:1 |
| `height: 220px` | 1 | L:1 |
| `height: 30%` | 1 | L:1 |
| `height: 54px` | 1 | R:1 |
| `height: 62px` | 1 | R:1 |
| `height: 64px` | 1 | R:1 |
| `height: 78px` | 1 | L:1 |
| `height: 86px` | 1 | L:1 |
| `height: auto` | 1 | L:1 |
| `height: clamp(100px,min(15vw,20vh),170px)` | 1 | L:1 |
| `height: clamp(80px,9vw,110px)` | 1 | L:1 |
| `height: clamp(90px,min(14vw,18vh),160px)` | 1 | L:1 |
| `height: min(34px,5vh)` | 1 | L:1 |
| `height: min(44px,5.6vh)` | 1 | L:1 |
| `max-height: {{ offerImgMax }}px` | 1 | R:1 |
| `max-height: 440px` | 1 | L:1 |
| `max-height: 78%` | 1 | R:1 |
| `max-height: calc(100% - 48px)` | 1 | S:1 |
| `max-width: {{ utterMaxWidth }}` | 1 | R:1 |
| `max-width: 520px` | 1 | R:1 |
| `max-width: 600px` | 1 | L:1 |
| `max-width: 620px` | 1 | R:1 |
| `max-width: 640px` | 1 | R:1 |
| `max-width: 66%` | 1 | L:1 |
| `max-width: 720px` | 1 | R:1 |
| `max-width: 85%` | 1 | R:1 |
| `max-width: 88%` | 1 | R:1 |
| `max-width: min(560px,calc(100% - 32px))` | 1 | R:1 |
| `min-height: 110px` | 1 | L:1 |
| `min-height: 170px` | 1 | R:1 |
| `min-height: 200vh` | 1 | L:1 |
| `min-height: 22px` | 1 | R:1 |
| `min-height: 280px` | 1 | L:1 |
| `min-height: 320vh` | 1 | L:1 |
| `min-height: 32px` | 1 | R:1 |
| `min-height: 40px` | 1 | R:1 |
| `min-height: 52px` | 1 | S:1 |
| `min-height: 560px` | 1 | S:1 |
| `min-height: 64px` | 1 | L:1 |
| `min-width: 120px` | 1 | S:1 |
| `min-width: 130px` | 1 | S:1 |
| `min-width: 150px` | 1 | S:1 |
| `min-width: 210px` | 1 | S:1 |
| `width: {{ autoBlob }}px` | 1 | R:1 |
| `width: {{ discoveryBlob }}px` | 1 | R:1 |
| `width: {{ listWidth }}px` | 1 | R:1 |
| `width: {{ stW }}` | 1 | R:1 |
| `width: {{ welcomeBlob }}px` | 1 | R:1 |
| `width: 10.6%` | 1 | L:1 |
| `width: 10px` | 1 | R:1 |
| `width: 110px` | 1 | R:1 |
| `width: 112px` | 1 | R:1 |
| `width: 118px` | 1 | R:1 |
| `width: 150px` | 1 | L:1 |
| `width: 18px` | 1 | S:1 |
| `width: 20px` | 1 | L:1 |
| `width: 220px` | 1 | L:1 |
| `width: 26%` | 1 | L:1 |
| `width: 28px` | 1 | O:1 |
| `width: 32px` | 1 | O:1 |
| `width: 46px` | 1 | R:1 |
| `width: 50%` | 1 | L:1 |
| `width: 52px` | 1 | S:1 |
| `width: 58px` | 1 | R:1 |
| `width: 60%` | 1 | L:1 |
| `width: 64px` | 1 | R:1 |
| `width: 70%` | 1 | L:1 |
| `width: 75%` | 1 | L:1 |
| `width: 80%` | 1 | L:1 |
| `width: 86px` | 1 | L:1 |
| `width: clamp(100px,min(15vw,20vh),170px)` | 1 | L:1 |
| `width: clamp(80px,9vw,110px)` | 1 | L:1 |
| `width: clamp(90px,min(14vw,18vh),160px)` | 1 | L:1 |
| `width: min(1100px,100%)` | 1 | L:1 |
| `width: min(1120px,100%)` | 1 | L:1 |
| `width: min(1180px,100%)` | 1 | R:1 |
| `width: min(1190px,100%)` | 1 | R:1 |
| `width: min(1400px,100%)` | 1 | L:1 |
| `width: min(240px,62%)` | 1 | L:1 |
| `width: min(300px,78%)` | 1 | L:1 |
| `width: min(360px,100%)` | 1 | R:1 |
| `width: min(440px,calc(100% - 48px))` | 1 | S:1 |
| `width: min(480px,100%)` | 1 | S:1 |
| `width: min(500px,100%)` | 1 | O:1 |
| `width: min(520px,calc(100% - 48px))` | 1 | L:1 |
| `width: min(640px,100%)` | 1 | R:1 |
| `width: min(640px,calc(100% - 48px))` | 1 | S:1 |
| `width: min(660px,100%)` | 1 | R:1 |
| `width: min(700px,100%)` | 1 | R:1 |
#### A16 · Background, gradient & transform declarations — **all 142 distinct declarations**

The 60 most frequent are annotated below; the remaining 86 follow in **§A16b**.

| Value | n | Files | Typical usage |
|---|---:|---|---|
| `background: none` | 69 | R:33 S:27 O:7 L:2 | `background` on `<button>` |
| `background: #ff6926` | 34 | R:16 S:9 O:2 L:7 | `background` on `<button>` |
| `background: rgba(255,255,255,.04)` | 34 | R:8 S:20 O:6 | `background` on `<button>` |
| `background: #ff7a3d` | 27 | R:12 S:8 O:2 L:5 | `background` on `<button>` |
| `background: rgba(255,255,255,.1)` | 23 | R:7 S:12 O:3 L:1 | `background` on `<button>` |
| `background: rgba(255,255,255,.06)` | 20 | R:11 S:5 O:3 L:1 | `background` on `<input>` |
| `background: rgba(255,255,255,.08)` | 18 | R:6 S:11 O:1 | `background` on `<button>` |
| `background: rgba(255,255,255,.12)` | 13 | R:3 S:4 O:1 L:5 | `background` on `<span>` |
| `background: rgba(255,255,255,.03)` | 12 | S:7 O:5 | `background` on `<div>` |
| `background: rgba(255,255,255,.14)` | 10 | R:10 | `background` on `<button>` |
| `background: rgba(18,14,12,.72)` | 9 | R:8 L:1 | `background` on `<div>` |
| `background: rgba(255,255,255,.05)` | 9 | R:4 S:3 L:2 | `background` on `<button>` |
| `background: rgba(18,14,12,.66)` | 7 | R:2 L:5 | `background` on `<div>` |
| `background: #fff` | 6 | S:5 O:1 | `background` on `<span>` |
| `background: rgba(255,255,255,.07)` | 6 | R:3 S:2 O:1 | `background` on `<button>` |
| `background: {{ f.bg }}` | 6 | R:4 O:1 L:1 | `background` on `<div>` |
| `background: #0b0a09` | 5 | R:3 L:2 | `background` on `<<style>>` |
| `background: rgba(0,0,0,.25)` | 5 | S:4 L:1 | `background` on `<input>` |
| `transform: scale(1) rotate(0deg)` | 5 | R:3 L:2 | `transform` on `<<style>>` |
| `background: #e0a13a` | 4 | R:2 S:1 O:1 | `background` on `<span>` |
| `background: rgba(18,14,11,.98)` | 4 | S:3 O:1 | `background` on `<div>` |
| `background: rgba(20,14,10,.6)` | 4 | R:4 | `background` on `<form>` |
| `transform: translateY(-3px)` | 4 | L:4 | `transform` on `<div>` |
| `background: #4fbf7a` | 3 | O:3 | `background` on `<span>` |
| `background: radial-gradient(circle at 42% 38%,#ffc39a 0%,#ff8a4e 28%,#ff6926 58%,#e9511a 100%)` | 3 | R:1 L:2 | `background` on `<div>` |
| `background: rgba(120,58,22,.75)` | 3 | R:2 L:1 | `background` on `<div>` |
| `background: rgba(20,14,10,.5)` | 3 | R:2 L:1 | `background` on `<button>` |
| `background: rgba(20,14,10,.55)` | 3 | R:3 | `background` on `<button>` |
| `background: rgba(255,105,38,.12)` | 3 | R:2 S:1 | `background` on `<button>` |
| `background: rgba(255,220,190,.1)` | 3 | R:1 S:1 O:1 | `background` on `<div>` |
| `background: rgba(255,255,255,.09)` | 3 | R:3 | `background` on `<button>` |
| `background: {{ it.bg }}` | 3 | S:2 O:1 | `background` on `<button>` |
| `background: {{ r.bg }}` | 3 | S:3 | `background` on `<button>` |
| `background: {{ t.dot }}` | 3 | O:3 | `background` on `<span>` |
| `transform: none` | 3 | R:1 S:1 O:1 | `transform` on `<<style>>` |
| `transform: {{ r.knob }}` | 3 | S:3 | `transform` on `<span>` |
| `background-image: url('assets/bg.jpg')` | 2 | R:1 L:1 | `background-image` on `<div>` |
| `background-image: url('assets/grain.svg')` | 2 | R:1 L:1 | `background-image` on `<div>` |
| `background-position: 50% 30%` | 2 | R:1 L:1 | `background-position` on `<div>` |
| `background-size: cover` | 2 | R:1 L:1 | `background-size` on `<div>` |
| `background: #b8382a` | 2 | R:1 S:1 | `background` on `<span>` |
| `background: #c9463a` | 2 | R:1 S:1 | `background` on `<span>` |
| `background: #ff8a4e` | 2 | L:2 | `background` on `<span>` |
| `background: linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)` | 2 | R:1 L:1 | `background` on `<div>` |
| `background: repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px)` | 2 | R:2 | `background` on `<div>` |
| `background: rgba(18,14,12,.6)` | 2 | R:1 L:1 | `background` on `<div>` |
| `background: rgba(224,161,58,.1)` | 2 | S:1 O:1 | `background` on `<div>` |
| `background: rgba(255,105,38,.14)` | 2 | R:1 L:1 | `background` on `<button>` |
| `background: rgba(255,105,38,.16)` | 2 | R:1 L:1 | `background` on `<span>` |
| `background: rgba(255,105,38,.22)` | 2 | R:2 | `background` on `<button>` |
| `background: rgba(255,105,38,.26)` | 2 | R:1 L:1 | `background` on `<button>` |
| `background: rgba(6,4,3,.55)` | 2 | S:1 O:1 | `background` on `<div>` |
| `background: rgba(6,4,3,.6)` | 2 | S:2 | `background` on `<div>` |
| `background: {{ s.dot }}` | 2 | S:1 O:1 | `background` on `<span>` |
| `background: {{ t.bg }}` | 2 | O:2 | `background` on `<div>` |
| `transform: scale(1.02) rotate(8deg)` | 2 | R:1 L:1 | `transform` on `<<style>>` |
| `transform: scale(1.04) rotate(-4deg)` | 2 | R:1 L:1 | `transform` on `<<style>>` |
| `transform: scaleX(-1)` | 2 | R:1 L:1 | `transform` on `<div>` |
| `transform: translate(-50%,-50%)` | 2 | S:2 | `transform` on `<div>` |
| `transform: translateX(-50%)` | 2 | R:1 S:1 | `transform` on `<div>` |

---


#### A16b · The remaining 86 background / transform declarations

Complete tail of §A16, same sort. Basis: inline `style` + `style-hover` only (the four `<style>` blocks contribute the `@keyframes` `transform:` / `background:#0b0a09` rows already listed in §A16). Every `{{ … }}` row is resolved in §A2 or §A2b.

| Value | n | Files |
|---|---:|---|
| `transform: {{ chevRot }}` | 2 | R:2 |
| `background: {{ a.dot }}` | 1 | R:1 |
| `background: {{ applyBg }}` | 1 | S:1 |
| `background: {{ autoBg }}` | 1 | S:1 |
| `background: {{ autoCardBg }}` | 1 | S:1 |
| `background: {{ autoDotBg }}` | 1 | S:1 |
| `background: {{ badgeDotColor }}` | 1 | R:1 |
| `background: {{ c.btnBg }}` | 1 | R:1 |
| `background: {{ chAppBg }}` | 1 | S:1 |
| `background: {{ checkBg }}` | 1 | S:1 |
| `background: {{ chMailBg }}` | 1 | S:1 |
| `background: {{ connDot }}` | 1 | S:1 |
| `background: {{ diagDot }}` | 1 | O:1 |
| `background: {{ f.dot }}` | 1 | O:1 |
| `background: {{ fAllBg }}` | 1 | O:1 |
| `background: {{ fAttBg }}` | 1 | O:1 |
| `background: {{ hdrBg }}` | 1 | L:1 |
| `background: {{ i.dot }}` | 1 | O:1 |
| `background: {{ k.bg }}` | 1 | S:1 |
| `background: {{ listBg }}` | 1 | R:1 |
| `background: {{ m.bg }}` | 1 | R:1 |
| `background: {{ m.dot }}` | 1 | S:1 |
| `background: {{ micBg }}` | 1 | R:1 |
| `background: {{ mobileBtnBg }}` | 1 | R:1 |
| `background: {{ nameSaveBg }}` | 1 | S:1 |
| `background: {{ revCardBg }}` | 1 | S:1 |
| `background: {{ revDotBg }}` | 1 | S:1 |
| `background: {{ s.bg }}` | 1 | S:1 |
| `background: {{ s.rowBg }}` | 1 | S:1 |
| `background: {{ saveBg }}` | 1 | S:1 |
| `background: linear-gradient(180deg,rgba(11,10,9,0) 70%,rgba(11,10,9,.35) 100%)` | 1 | L:1 |
| `background: radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 58%,#e9511a)` | 1 | L:1 |
| `background: radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 60%)` | 1 | L:1 |
| `background: radial-gradient(ellipse at 50% 50%,#1a120c 0%,#1a120c 42%,rgba(26,18,12,0) 72%)` | 1 | L:1 |
| `background: rgba(0,0,0,.2)` | 1 | S:1 |
| `background: rgba(0,0,0,.3)` | 1 | L:1 |
| `background: rgba(0,0,0,.35)` | 1 | L:1 |
| `background: rgba(10,8,7,.8)` | 1 | R:1 |
| `background: rgba(10,8,7,.85)` | 1 | L:1 |
| `background: rgba(10,8,7,.88)` | 1 | R:1 |
| `background: rgba(10,8,7,.9)` | 1 | L:1 |
| `background: rgba(11,10,9,.55)` | 1 | L:1 |
| `background: rgba(120,58,22,.22)` | 1 | S:1 |
| `background: rgba(120,58,22,.35)` | 1 | L:1 |
| `background: rgba(13,10,8,.8)` | 1 | S:1 |
| `background: rgba(13,10,8,.82)` | 1 | O:1 |
| `background: rgba(14,11,9,.94)` | 1 | R:1 |
| `background: rgba(18,14,12,.5)` | 1 | L:1 |
| `background: rgba(18,14,12,.78)` | 1 | L:1 |
| `background: rgba(18,14,12,.92)` | 1 | R:1 |
| `background: rgba(20,14,10,.7)` | 1 | L:1 |
| `background: rgba(20,15,12,.96)` | 1 | R:1 |
| `background: rgba(20,15,12,.97)` | 1 | S:1 |
| `background: rgba(224,161,58,.12)` | 1 | R:1 |
| `background: rgba(24,17,13,.96)` | 1 | R:1 |
| `background: rgba(255,220,190,.16)` | 1 | R:1 |
| `background: rgba(255,220,190,.2)` | 1 | L:1 |
| `background: rgba(28,20,14,.92)` | 1 | R:1 |
| `background: rgba(28,20,14,.96)` | 1 | S:1 |
| `background: rgba(30,22,16,.7)` | 1 | R:1 |
| `transform-origin: 50% 0%` | 1 | L:1 |
| `transform: {{ ansTf }}` | 1 | L:1 |
| `transform: {{ autoKnob }}` | 1 | S:1 |
| `transform: {{ c.tf }}` | 1 | L:1 |
| `transform: {{ chevRotUp }}` | 1 | R:1 |
| `transform: {{ clarTf }}` | 1 | L:1 |
| `transform: {{ convoTf }}` | 1 | L:1 |
| `transform: {{ f.knob }}` | 1 | O:1 |
| `transform: {{ f.tf }}` | 1 | L:1 |
| `transform: {{ i.chev }}` | 1 | O:1 |
| `transform: {{ l.tf }}` | 1 | L:1 |
| `transform: {{ limitsRot }}` | 1 | S:1 |
| `transform: {{ listTf }}` | 1 | L:1 |
| `transform: {{ listTransform }}` | 1 | R:1 |
| `transform: {{ offerTf }}` | 1 | L:1 |
| `transform: {{ q.rot }}` | 1 | L:1 |
| `transform: {{ s.chev }}` | 1 | S:1 |
| `transform: {{ s.knob }}` | 1 | S:1 |
| `transform: {{ shChevRot }}` | 1 | R:1 |
| `transform: {{ st.tf }}` | 1 | L:1 |
| `transform: {{ stTf }}` | 1 | R:1 |
| `transform: {{ termsRot }}` | 1 | R:1 |
| `transform: rotateX(14deg) scale(.96)` | 1 | L:1 |
| `transform: translate(-50%,-50%) {{ cardScale }}` | 1 | L:1 |
| `transform: translateY(-1px)` | 1 | R:1 |
| `transform: translateY(-50%)` | 1 | L:1 |

---


#### A17 · Properties in active use that Part A previously omitted

These are load-bearing declarations that no §A1–§A16 table covered. All counts are inline `style` + `style-hover` across the four files.

**Typography treatments**

| Value | n | Files | Role |
|---|---:|---|---|
| `text-wrap: balance` | 17 | R:8 L:9 | on **every** hero / utterance / section headline — including the Scout utterance (`Roomscout.dc.html:113`). Without it the port's headlines break differently from the mock. |
| `text-wrap: pretty` | 3 | L:3 | Landing body paragraphs |
| `text-transform: uppercase` | 39 | R:8 S:13 O:11 L:7 | the eyebrow treatment (with `letter-spacing:.14em` / `.12em` / `.09em` / `.18em`) |
| `text-transform: none` | 1 | L:1 | one override |
| `text-transform: {{ listHeadTransform }}` | 1 | R:1 | fact-list head — `card ? 'none' : 'uppercase'` |
| `text-decoration: underline` | 20 | R:9 S:7 O:2 L:2 | the signature quiet text-button |
| `text-decoration: none` | 12 | L:12 | on `<a>` (Landing is the only file with real links) |
| `text-decoration: line-through` | 1 | L:1 | the overwritten fact in the Landing conversation |
| `text-decoration: {{ t.underline }}` | 2 | O:2 | Operator open-task title — `open ? 'underline' : 'none'` |
| `text-decoration: {{ f.deco }}` | 1 | L:1 | `'line-through'` on an overwritten fact, else `'none'` |
| `text-underline-offset: 4px` | 22 | R:9 S:7 O:4 L:2 | **the only offset value in the system** — always paired with the underline above |
| `white-space: nowrap` | 7 | R:3 S:3 L:1 | status labels, table cells |

`text-decoration-color` (19×, already partly in §A1) has **three** values, not two: `rgba(255,220,190,.35)` (R:7 L:1), `rgba(255,220,190,.4)` (S:6 O:4), `rgba(255,140,90,.6)` (L:1). See §F7.

**Form / media / scrolling**

| Value | n | Files | Role |
|---|---:|---|---|
| `accent-color: #ff6926` | 1 | S:1 | the one native checkbox: `Settings.dc.html:421` `<input type="checkbox" style="margin-top:4px;width:18px;height:18px;accent-color:#ff6926">` |
| `object-fit: cover` | 6 | R:3 L:3 | photos (offer, candidate, thumbnail, Landing offer/memory) |
| `object-fit: contain` | 5 | S:1 O:4 | logos (24–30px) |
| `scrollbar-width: none` | 3 | R:1 S:1 O:1 | Roomscout `<main>`, and the `<nav>` of both shells |
| `scrollbar-width: thin` | 2 | S:1 O:1 | the scrolling content column of both shells |
| `scroll-margin-top: 70px` | 2 | L:2 | `#features`, `#control` anchors |
| `scroll-margin-top: 60px` | 1 | L:1 | `#how` anchor |
| `scroll-margin-top: 0` | 1 | L:1 | the sticky section that must land flush |
| `user-select: all` | 2 | S:2 | the Scout address (`Settings.dc.html:112`) and the import prompt block (`:402`) — click-to-select-all |
| `will-change: transform` | 2 | L:2 | the parallax background layer and the tilting hero card |
| `aspect-ratio: 1` | 1 | L:1 | the percentage-sized blob anchor inside the hero card |
| `perspective: 1600px` + `perspective-origin: 50% 0%` | 1 + 1 | L:1 | the hero-card 3-D wrapper |
| `pointer-events: none` | 5 | R:1 L:4 | background layers, blob, vignette, bottom fade |
| `overflow: hidden` / `overflow: auto` | 19 / 10 | R:6 S:3 O:1 L:9 / R:3 S:4 O:3 | — |
| `flex: none` / `flex: 1` | 40 / 23 | R:22 S:11 O:4 L:3 / R:15 S:4 O:4 | — |

**`grid-template-columns` — all 30 distinct values (43 uses)**

| Value | n | Files | Role |
|---|---:|---|---|
| `1.3fr 1fr 1.2fr 1fr` | 4 | O:4 | Operator table row |
| `auto minmax(0,1fr) auto` | 4 | S:4 | Settings list row (icon · text · control) |
| `auto minmax(0,1fr)` | 3 | S:3 | Settings list row without trailing control |
| `{{ offerCols }}` | 2 | R:1 L:1 | `narrow ? '1fr' : 'minmax(0,1fr) minmax(0,1.05fr)'` |
| `1.3fr 1fr 1.3fr 1fr` | 2 | O:2 | Operator table header |
| **`296px minmax(0,1fr)`** | 2 | S:1 O:1 | **the sidebar-13 shell** (both) |
| `36px 1fr` | 2 | L:2 | Landing icon row |
| `44px 1fr` | 2 | L:2 | Landing avatar row |
| `1.2fr 1.3fr 1fr auto` | 1 | O:1 | — |
| `100px 1fr` | 1 | O:1 | — |
| `110px 1fr` | 1 | O:1 | — |
| `14px 1fr` | 1 | R:1 | activity timeline (dot column) |
| `1fr 1fr` | 1 | O:1 | — |
| `1fr auto 1fr` | 1 | L:1 | Landing header (left · nav · CTA) |
| `44px minmax(0,1fr) auto` | 1 | S:1 | — |
| `56px minmax(0,1fr) auto auto auto` | 1 | S:1 | — |
| `96px 1fr` | 1 | L:1 | — |
| `minmax(0,1fr) auto auto` | 1 | S:1 | — |
| `repeat(3,minmax(0,1fr))` | 1 | S:1 | — |
| `repeat(auto-fit,minmax(210px,1fr))` | 1 | O:1 | — |
| `repeat(auto-fit,minmax(220px,1fr))` | 1 | O:1 | — |
| `repeat(auto-fit,minmax(260px,1fr))` | 1 | R:1 | — |
| `repeat(auto-fit,minmax(280px,1fr))` | 1 | S:1 | — |
| `{{ bentoTop }}` / `{{ bentoBottom }}` / `{{ memCols }}` / `{{ faqCols }}` / `{{ introCols }}` / `{{ convoCols }}` | 1 each | L:6 | resolved in §A2b |
| `{{ candCols }}` | 1 | R:1 | `narrow ? '1fr' : 'repeat(3, minmax(0,1fr))'` |

Also `grid-template-rows: {{ s.rows }}` (S:1) and `{{ q.rows }}` (L:1) — both `open ? '1fr' : '0fr'`, the accordion mechanism (paired with `transition:grid-template-rows .26s cubic-bezier(.3,.7,.2,1)` in Settings, `.32s` in Landing, and an inner `overflow:hidden` wrapper). Plus `grid-column:1/-1` (O:1), `justify-self: center|start|end` (R:1 L:2), `align-self: flex-start|flex-end|center` (R:5 L:5).

**The z-index scale — 16 levels, 34 uses**

This is the layering contract of the whole app and appeared nowhere in Part A.

| z | n | Files | What sits there |
|---:|---:|---|---|
| `0` | 1 | L:1 | Landing's fixed background layer wrapper |
| `2` | 13 | R:4 L:9 | **content plane** — everything above the photo/scrim/grain (`position:relative;z-index:2`); also the „Mein Vorschlag“ ribbon on a candidate card (`Roomscout.dc.html:453`) |
| `3` | 2 | R:1 L:1 | the Scout **blob** (it floats over content) |
| `4` | 1 | R:1 | the fact list `data-fact-list="1"` |
| `5` | 1 | S:1 | Settings row popup menu |
| `6` | 1 | R:1 | the narrow bottom sheet `data-sheet="1"` |
| `8` | 1 | R:1 | the hint bar (`role="status"`, bottom-centred) |
| `9` | 1 | R:1 | the transcript side drawer |
| `10` | 2 | R:1 L:1 | Roomscout dev bar · Landing fixed header |
| `12` | 1 | R:1 | Roomscout app header |
| `14` | 1 | R:1 | Roomscout toast (`role="status"`, top-right) |
| `20` | 3 | S:2 O:1 | modal / drawer **scrim** inside a shell |
| `21` | 3 | S:2 O:1 | modal / drawer **panel** inside a shell |
| `30` | 1 | S:1 | discard-alert scrim (over an open dialog) |
| `31` | 1 | S:1 | discard-alert panel |
| `40` | 1 | S:1 | Settings toast — above everything |

Port it as a named scale; do not renumber ad hoc.

---

## Part B — Curated semantic palette

One theme only. The prototype is **dark‑only**; there is no light variant anywhere in the four files. Every surface above the page ground is *translucent* — either a warm black at 50–98 % alpha or white at 2–14 % alpha — so the photographic background reads through. **Do not flatten these to opaque hexes**; the alpha is the design.

### B1 · Ground & background stack

| Role | Value | n | Where |
|---|---|---:|---|
| Page ground | `#0b0a09` | 5 | `html,body`, root `<div>`, the stage element |
| Stage photo | `assets/bg.jpg` | 2 | `background-size:cover; background-position:50% 30%` |
| Stage photo treatment | `filter:saturate(.62) brightness(.5); transform:scaleX(-1)` | 2 | R `inset:-2%` · L `inset:-6% -2%` + `will-change:transform` (parallax) |
| Scrim gradient | `linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)` | 2 | full-bleed layer over the photo |
| Grain | `assets/grain.svg`, `opacity:.28`, `mix-blend-mode:overlay` | 2 | full-bleed layer over the scrim |

**Not part of this stack:** the Landing vignette `radial-gradient(ellipse at 50% 50%,#1a120c 0%,#1a120c 42%,rgba(26,18,12,0) 72%)` and the bottom fade `linear-gradient(180deg,rgba(11,10,9,0) 70%,rgba(11,10,9,.35) 100%)`. Both are `position:absolute` overlays **inside the hero preview card**, on top of `<img src="assets/hero-preview.png">` — not page-background layers. Putting them on the page ground reproduces a different screen. See §E.

Full CSS in **Part E**.

### B2 · Ink

| Role | Value | n | Notes |
|---|---|---:|---|
| `ink-strong` | `#f8f0e7` | 1 | only the giant Scout utterance (`font-weight:300`, `line-height:1.16`) |
| **`ink`** (default) | `#f5ece2` | 124 | body, headings, `a{color}`, button labels |
| `ink-2` | `#e2d3c3` | 49 | secondary body copy, inactive sidebar icon |
| `ink-3` | `#d8c8b8` | 11 | quiet **underlined** text buttons — R:10, L:1 (not Roomscout-only; see §A1) |
| **`ink-muted`** | `#cbb9a8` | 98 | sub-headline (19px), secondary list text, badge label |
| **`ink-hint`** | `#a89684` | 113 | captions, uppercase eyebrows, footnotes, disabled labels |
| `ink-faint` | `#b3a291` (1), `#8f7e6e` (1) | 2 | two one-offs, fold into `ink-hint`. `#b3a291` is the welcome tagline („Du erzählst. Dein Scout kümmert sich.“, `margin-top:min(12vh,110px);font-size:15px`) |
| `ink-placeholder` | `#9c8b7b` | 2 | `input::placeholder`, `textarea::placeholder` |
| `ink-on-signal` | `#ffffff` / `#fff` | 68 | ink on orange and red filled buttons; hover ink on Landing links |

### B3 · Signal orange (the single brand accent)

| Role | Value | n (inline + JS) | Notes |
|---|---|---:|---|
| **`signal`** | `#ff6926` = `rgb(255,105,38)` | 47 + 17 | filled CTA, focus ring (`outline:2px solid #ff6926;outline-offset:2px`), `a:hover`, live dot, mic-on, active ring |
| **`signal-hover`** | `#ff7a3d` | 27 | appears **only** inside `style-hover` |
| `signal-ink` | `#ff8a4e` | 29 + 4 | orange *text*: active nav icon, uppercase eyebrows, quiet links |
| `signal-ink-soft` | `#ffd9c4` | 5 + 1 | ink inside `rgba(255,105,38,.12)` chips |
| `signal-ink-softer` | `#ffe0cf` | 2 | ink inside `rgba(255,105,38,.14)` outline buttons |
| `signal-deep` | `#e9511a` | 4 | blob gradient terminal stop |
| `signal-light` | `#ffc39a` | 5 | blob gradient highlight stop |
| `signal-disabled` | `rgba(255,105,38,.4)` | 4 (JS) | disabled primary button fill (Settings) |

Orange **tint ladder** (`rgb(255,105,38)` at α): `.12` chip fill · `.14` outline-button fill · `.16` chip fill strong · `.18` blob outer glow · `.2` changed-field highlight · `.22` chip hover · `.25` CTA glow · `.26` chip hover (L) · `.28` CTA glow (L) · `.3` mic glow / Operator filter pill · `.35` mobile toggle / notification channel / L blob glow · `.4` disabled primary / L blob glow · `.5` live-dot glow · `.7` open FAQ border · `.75` selected autonomy card border.

Warm-brown fills derived from the same hue, `rgb(120,58,22)`:
`.22` (S one-off) · `.28` selected autonomy card · `.35` (L) · **`.45` active sidebar item (S + O)** · **`.6` user bubble in the transcript list** · **`.75` user chat bubble**.

### B4 · Borders — three warm-white families + one accent family

This is the most fragmented part of the system. Full raw list in §A9; consolidated here.

| Family | Base RGB | Alphas found | Role |
|---|---|---|---|
| **Line** | `rgb(255,220,190)` = `#ffdcbe` | `.06 .08 .10 .12 .14 .16 .18 .20 .22 .25 .28 .30` (+ `.35 .40` for `text-decoration-color`) | dividers, nav hairlines, control outlines |
| **Card** | `rgb(255,200,160)` = `#ffc8a0` | `.10 .12 .14 .16 .18 .20 .22 .25 .30 .35` | card / panel / input borders |
| **Shell** | `rgb(255,190,140)` = `#ffbe8c` | `.16 .26` | *only* the Settings + Operator shell border and one Landing card |
| **Accent** | `rgb(255,140,90)` = `#ff8c5a` | `.22 .30 .35 .40 .45 .50 .55 .60` | active / selected / warm-emphasis borders |

Canonical set recommended for the port (justification in **Part F**):

| Token | Value | Replaces |
|---|---|---|
| `border-hair` | `rgba(255,220,190,.08)` | `.06`, `.08` |
| **`border`** | `rgba(255,220,190,.10)` | `.10`, `.12`, `.14` (Line family) |
| `border-strong` | `rgba(255,220,190,.28)` | `.16 .18 .20 .22 .25 .28 .30` (Line family) |
| **`border-card`** | `rgba(255,200,160,.14)` | `.10 .12 .14` (Card family) |
| `border-card-strong` | `rgba(255,200,160,.16)` | `.16 .18 .20 .22`, and the Shell family `rgba(255,190,140,.16)` |
| `border-input-focus` | `rgba(255,200,160,.25)` | `.25 .30` |
| `border-dashed` | `1px dashed rgba(255,200,160,.35)` | empty states (S, O) |
| **`border-accent`** | `rgba(255,140,90,.35)` | `.22 .30 .35` |
| `border-accent-strong` | `rgba(255,140,90,.50)` | `.40 .45 .50 .55 .60` |
| `underline` | `rgba(255,220,190,.35)` | `.35` (R:7 L:1) and `.40` (S:6 O:4) `text-decoration-color` |
| `underline-accent` | `rgba(255,140,90,.6)` | **kept, not folded** — the third `text-decoration-color`, L:1 only, on the „So behaltet ihr die Kontrolle ↓“ link. It is an *accent* underline, visibly warmer than the two neutral ones. See §F7/§F10. |

### B5 · Panel & surface fills

**White-on-dark ladder** (ghost controls, inline panels):

| Token | Value | n | Role |
|---|---|---:|---|
| `surface-1` | `rgba(255,255,255,.03)` | 12 | quietest inner card (Settings sections) |
| **`surface-2`** | `rgba(255,255,255,.04)` | 34 | default quiet panel / ghost control fill |
| `surface-3` | `rgba(255,255,255,.06)` | 20 + 3 | inputs, 40px icon buttons, **Scout chat bubble** |
| `surface-4` | `rgba(255,255,255,.08)` | 18 | 42–44px icon buttons |
| `hover-1` | `rgba(255,255,255,.07)` | 5 | menu-item / task-card hover |
| **`hover-2`** | `rgba(255,255,255,.10)` | 25 | default ghost hover (23 of 25 are `style-hover`) |
| `hover-3` | `rgba(255,255,255,.12)` | 13 | stronger hover; also 1px vertical rules |
| `hover-4` | `rgba(255,255,255,.14)` | 10 | **strongest hover only** — all 10 are `style-hover` |
| `mic-off` | `rgba(255,255,255,.07)` | 1 + 1 (JS) | **resting** fill of the mic button when the mic is off (border `rgba(255,220,190,.16)`, hover `rgba(255,255,255,.12)`). Same literal as `hover-1` but a different role — give it its own token or the mic-off state has none. |
| `switch-off` | `rgba(255,255,255,.14)` | 2 (JS) | **toggle track when OFF** (`SW`). The ON track is `#ff6926`. Same literal as `hover-4`, different role. |
| `hatch` | `repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px)` | 2 | photo-placeholder texture; the only copy on it is „Foto folgt vom Anbieter“ (13px in the offer card, 12.5px in the candidate card, `ui-monospace,Menlo,monospace`, `color:#a89684`) |
| `row-open` | `rgba(255,255,255,.035)` | 1 (JS) | expanded Settings source row (`border-radius:18px`, border `rgba(255,200,160,.14)`, `margin-bottom:8px`, `transition:background .25s,border-color .25s`) |

**Warm-black glass ladder** (floating surfaces over the photo):

| Token | Value | n | Role |
|---|---|---:|---|
| `pill` | `rgba(20,14,10,.50)` / `.55` / **`.60`** | 3 / 3 / 4 | stage pills; `.60` = the search & side-note input pill, with `backdrop-filter:blur(6px)` |
| `panel-l` | `rgba(18,14,12,.50)` (L), `.60` (R/L), `.66` (R/L) | 1 / 2 / 7 | Landing cards |
| **`card`** | `rgba(18,14,12,.72)` | 9 | the main stage card / offer panel |
| `card-list` | `rgba(18,14,12,.74)` card-mode / `rgba(18,14,12,.42)` list-mode | 1 + 1 (JS) | transcript list |
| `sheet` | `rgba(18,14,12,.92)` + `backdrop-filter:blur(10px)` | 1 | bottom sheet |
| `side-panel` | `rgba(14,11,9,.94)` | 1 | transcript drawer (Roomscout) |
| **`popover`** | `rgba(20,15,12,.96)` (R) / `rgba(20,15,12,.97)` (S) | 1 / 1 | dropdown menus |
| `toast` | `rgba(24,17,13,.96)` (R) / `rgba(28,20,14,.96)` (S) / `rgba(28,20,14,.92)` (R hint bar) | 1 / 1 / 1 | toasts & tooltips |
| **`dialog`** | `rgba(18,14,11,.98)` | 4 | drawers + modals inside both shells |
| `scrim` | `rgba(6,4,3,.55)` (R + O) / `rgba(6,4,3,.60)` (S) | 2 / 2 | modal backdrop *inside* the shell |
| **`shell`** | `rgba(13,10,8,.80)` (Settings) / `rgba(13,10,8,.82)` (Operator) | 1 / 1 | the sidebar-in-dialog shell |
| `devbar` | `rgba(10,8,7,.88)`, buttons `rgba(10,8,7,.80)` | 2 | Roomscout dev bar (monospace) |
| `landing-header` | `rgba(11,10,9,.72)` + `blur(12px)` when scrolled | 1 (JS) | Landing sticky header |

### B6 · Chat bubbles

There are **two distinct bubble systems**, with different geometry. Do not merge them.

**1 · Transcript drawer** (`Roomscout.dc.html:593–597`) — the only place a *Scout* bubble exists. Both speakers share one geometry; only fill and radius differ.

```html
<sc-for list="{{ transcript }}" as="m">
  <div style="display:flex;flex-direction:column;gap:4px;align-items:{{ m.align }}">
    <div style="font-size:12px;color:#a89684">{{ m.who }}</div>
    <div style="max-width:88%;padding:10px 14px;border-radius:{{ m.radius }};background:{{ m.bg }};font-size:15px;line-height:1.45;text-align:left">{{ m.text }}</div>
  </div>
</sc-for>
```

| | Scout | User |
|---|---|---|
| `align` | `flex-start` | `flex-end` |
| speaker label | „Dein Scout“ | „Du“ — 12px, `#a89684`, `gap:4px` above the bubble |
| `bg` | `rgba(255,255,255,.06)` | `rgba(120,58,22,.6)` |
| `radius` | `14px 14px 14px 4px` | `14px 14px 4px 14px` |
| geometry | `max-width:88%` · `padding:10px 14px` · `font-size:15px` · `line-height:1.45` — **identical for both** | ↰ |
| border | none | **none** (the border belongs to the *stage* bubble only) |

**2 · Stage bubbles** — user only, one per screen, each with its own size:

| Where | Declaration (verbatim) |
|---|---|
| Roomscout clarification (`:284`) | `align-self:flex-end;max-width:80%;padding:14px 20px;border-radius:18px 18px 4px 18px;background:rgba(120,58,22,.75);border:1px solid rgba(255,140,90,.35);font-size:17px;text-align:left;animation:rsFadeUp .35s ease both` |
| Roomscout offer Q&A (`:401`) | `align-self:flex-end;max-width:80%;padding:12px 18px;border-radius:18px 18px 4px 18px;background:rgba(120,58,22,.75);border:1px solid rgba(255,140,90,.35);font-size:16px` |
| Landing v2 answer (`:141`) | `align-self:flex-end;padding:13px 18px;border-radius:18px 18px 4px 18px;background:rgba(120,58,22,.75);border:1px solid rgba(255,140,90,.35);font-size:16px;opacity:{{ ansOp }};transform:{{ ansTf }};transition:opacity .5s,transform .5s` — **no `max-width`** |

**There is no `18px 18px 18px 4px` (Scout) radius anywhere in the prototype.** The scout corner is only ever `14px 14px 14px 4px`.

### B7 · Status / semantic colours

| Role | Value | n | Usage |
|---|---|---:|---|
| **`success`** | `#4fbf7a` | 3 + 4 | 8–9px status dots: Operator env pill, connected source, `GREEN` constant |
| **`warning`** | `#e0a13a` = `rgb(224,161,58)` | 6 + 5 | amber dot, warning text (13.5px), amber avatar badge; `AMBER` constant |
| `warning-bg` | `rgba(224,161,58,.10)` (S/O), `.12` (R), `.06` (O row tint) | 4 | notice panel fill |
| `warning-border` | `rgba(224,161,58,.35)` (R/S), `.45` (O) | 3 | notice panel border |
| `warning-ink` | `#1a1208` | 1 | ink on the amber badge |
| **`danger`** | `#b8382a` | 2 | destructive button, stop-recording button |
| `danger-hover` | `#c9463a` | 2 | `style-hover` only |
| `danger-ink` | `#ff8a6a` | 1 | Settings inline validation message |
| `neutral-dot` | `rgba(255,255,255,.3)` | 5 (JS) | "not enabled / not available yet" dot |
| `dot-live` | `#ff6926` + `rsDot 2.4s ease-in-out infinite` + `0 0 8px rgba(255,105,38,.5)` | — | Scout live badge, latest activity |
| `dot-past` | `rgba(255,220,190,.35)` | 3 | earlier activity entries |
| `dot-paused` | `#a89684` + `animation:none` | — | Scout paused |

**Dot geometry — five sizes, and the split is not per file.** All are `width:Npx;height:Npx;border-radius:50%`.

| Size | n | Files | Where |
|---:|---:|---|---|
| `12px` | 2 | S:2 | the inner dot of the 26px autonomy **radio** (`background:{{ autoDotBg }}` / `{{ revDotBg }}` — `#ff6926` selected, `transparent` otherwise) |
| `9px` | 10 | S:2 O:8 | source status dot (`{{ s.dot }}`, `Settings.dc.html:88`), Settings „Zustand“ row, and **all** Operator status dots (`{{ t.dot }}`) |
| `8px` | 8 | R:5 O:2 S:1 | Roomscout live badge / warnings / activity timeline (`{{ a.dot }}`) · Operator env pill `#4fbf7a` (`:22`) and the empty-state row „Keine Aufgabe braucht Aufmerksamkeit. Beispielstörung über die Demo-Steuerung laden.“ (`:58`) · Settings mandate state dot (`{{ m.dot }}`, `:126`) |
| `7px` | 3 | S:2 L:1 | Settings sidebar session dot (`Settings.dc.html:25` — `margin-top:5px;width:7px;height:7px;border-radius:50%;background:#ff6926;flex:none`) and one conflict marker; Landing live dot (`:74` — `background:#ff6926;animation:lpDot 2.4s ease-in-out infinite`) |
| `6px` | 2 | L:2 | Landing fact-row bullets |

**Do not canonicalise to one size** — 12/9/8/7/6 are five different components. If a single token is wanted, expose `--rs-dot-size-{xs..lg}`; the earlier "canonical 8px" would silently resize four of them.

### B8 · Blob (the Scout avatar)

```css
background: radial-gradient(circle at 42% 38%, #ffc39a 0%, #ff8a4e 28%, #ff6926 58%, #e9511a 100%);
border-radius: 62% 38% 46% 54%/44% 58% 42% 56%;
box-shadow: 0 0 34px 6px rgba(255,120,50,.35), 0 0 110px 20px rgba(255,105,38,.18);
transition: box-shadow .6s;
```

**The glow is a size tier, not a file difference.** Landing v2 uses *both* glows:

| Glow | Where |
|---|---|
| `0 0 34px 6px rgba(255,120,50,.35), 0 0 110px 20px rgba(255,105,38,.18)` | the large, anchor-following blob — `Roomscout.dc.html:81` **and** `Landing v2.dc.html:31` (identical markup: `border-radius:62% 38% 46% 54%/44% 58% 42% 56%` + the 4-stop gradient + `animation:{{ blobAnim }}`) |
| `0 0 30px 6px rgba(255,120,50,.35), 0 0 90px 16px rgba(255,105,38,.18)` | the **86px** static section blob only — `Landing v2.dc.html:235`, `animation:rsBreathe 5.2s ease-in-out infinite` |
| `0 0 18px rgba(255,105,38,.4)` | the **44px** avatar chip — 2-stop gradient `radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 60%)`, `Landing v2.dc.html:190` |
| `0 0 60px 10px rgba(255,105,38,.35)` | the **220px** decorative hero blob — 3-stop `radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 58%,#e9511a)`, `opacity:.9`, `animation:rsBreathe 6s ease-in-out infinite`, `Landing v2.dc.html:205` |

**All blob sizes.** Roomscout drives the blob from JS (§A2b); Landing sizes each anchor in CSS and the fixed blob copies the anchor's box.

| File | Value | Source |
|---|---|---|
| R welcome | `narrow ? 128 : 168` px, `margin-bottom: narrow ? 36 : 56` | `welcomeBlob` / `welcomeBlobMb`, `:1090` |
| R autopilot | `narrow ? 112 : 160` px, `margin-bottom: narrow ? 30 : 48` | `autoBlob` / `autoBlobMb`, `:1090` |
| R discovery | `narrow ? (textMode ? 88 : 120) : (textMode ? 104 : 160)` px, `margin-bottom:28px`, `transition:width .6s,height .6s,margin .6s` | `discoveryBlob`, `:1130` |
| L anchor 0 | `width:10.6%;aspect-ratio:1` inside the 1120px hero card (≈119px) | `:54` |
| L anchor 1 | `clamp(90px,min(14vw,18vh),160px)`, `data-blob-lag="1"` | `:73` |
| L anchor 2 | `clamp(100px,min(15vw,20vh),170px)`, `margin-bottom:min(44px,5vh)` | `:114` |
| L anchor 3 | `clamp(80px,9vw,110px)`, `margin-bottom:32px` | `:128` |
| L anchor 4 | `44px`, `data-blob-lag="1"`, `margin-top:20px` | `:166` |
| L static | `86px` (section) · `220px` (hero decoration) · `44px` (avatar chip) | `:235` · `:205` · `:190` |

Discrete pixel sizes in the source: **44 · 86 · 88 · 104 · 112 · 120 · 128 · 160 · 168 · 220**, plus the four Landing `clamp()` ramps and the one percentage anchor.

---

## Part C — Scales

### C1 · Type scale

Family: **Geist** 300/400/500/600, `system-ui, sans-serif` fallback, `-webkit-font-smoothing:antialiased` on the root.

| Token | Size | n | Canonical companions | Role |
|---|---|---:|---|---|
| `text-display` | `clamp(42px,6.2vw,84px)` | 1 | `w300 · ls -.03em · lh 1.02` | Landing hero |
| `text-h1` | `clamp(36px,5vw,58px)` | 2 | `w300 · ls -.02em · lh 1.05` | stage headline (Roomscout `autoH1`; narrow → `34px`) |
| `text-h1-page` | `44px` | 13 | `w500 · ls -.02em · lh 1.1` | **Settings / Operator page title** (uniform across both) |
| `text-h2` | `40px` | 2 | `w500 · ls -.02em` | Settings large stat |
| `text-h3` | `26px` | 3 | `w400/500 · ls -.01em` | dialog / section title |
| `text-h4` | `22px` | 6 | `w300–500` | card title |
| `text-lead` | `19px` | 23 | `color:#cbb9a8` | sub-headline under a page title |
| `text-lg` | `18px` | 10 | `w500/600` | in-panel heading |
| `text-md` | `17px` | 43 | — | lead body, chat bubble, primary button label (`w600 · #fff`) |
| `text-base` | `16px` | 52 | — | comfortable body, menu item, list row |
| **`text-sm`** | `15px` | **107** | — | **default body / control label** (`w600 · #fff` on filled buttons) |
| `text-sm-dense` | `14.5px` | 62 | `color:#cbb9a8` | dense rows — Settings/Operator only |
| `text-xs` | `14px` | 52 | `color:#a89684 / #cbb9a8` | small body, meta |
| `text-2xs` | `13.5px` | 19 | `color:#a89684` | caption |
| `text-3xs` | `13px` | 21 | `color:#a89684` | footnote |
| **`text-eyebrow`** | `12.5px` | 36 | `ls .14em · uppercase · #a89684` (accent variant: `#ff8a4e · w500`) | section eyebrow — the signature label style |
| `text-micro` | `12px` | 10 | `ls .08em/.12em/.14em · uppercase` | badge; also the transcript speaker label („Dein Scout“ / „Du“, `#a89684`) |
| `text-eyebrow-sm` | `11.5px` | 1 | `ls .09em · uppercase · #a89684 · margin-bottom:6px` | **Landing eyebrow** („Euer Suchauftrag“) — *not* monospace |
| **`text-mono`** | `13px` / `12.5px` | 2 | `ui-monospace,Menlo,monospace · #a89684` | **shipped**: the two photo placeholders („Foto folgt vom Anbieter“) — 13px in the offer card, 12.5px in the candidate card |
| `text-mono-dev` | `11.5px` / `11px` | 2 | `ui-monospace,Menlo,monospace · #a89684` | dev bar + its re-open button — **prototype only, do not ship** |
| `text-utterance` | `narrow ? (textMode ? 24px : 28px) : (textMode ? clamp(24px,3vw,36px) : clamp(28px,3.6vw,46px))` | 1 | `w300 · lh 1.16 · ls -.015em · text-wrap:balance · #f8f0e7 · max-width min(760px, calc(100vw − 660px)) \| 760px` | **the Scout utterance — the largest, most prominent type in the app** |

Landing v2 additionally uses fluid ramps: `clamp(36px,5.4vw,74px)`, `clamp(36px,5vw,68px)`, `clamp(36px,5vw,66px)`, `clamp(34px,5vw,64px)`, `clamp(32px,3.8vw,54px)`, `clamp(36px,3.6vw,50px)`, `clamp(26px,min(3.6vw,5vh),46px)`, `clamp(22px,2.2vw,30px)`, `clamp(21px,2.3vw,29px)`, `clamp(22px,1.9vw,27px)`, `clamp(17px,min(2.2vw,3.4vh),30px)`, `clamp(18px,1.5vw,22px)`, `clamp(17px,1.5vw,21px)`, `clamp(17px,1.4vw,20px)`, `clamp(14px,2.2vh,17px)`.
Roomscout hero ramps: `clamp(38px,6vw,64px)`, `clamp(36px,5vw,58px)` (= `autoH1` wide; narrow `34px`), `clamp(38px,3.8vw,52px)`, `clamp(34px,4.6vw,52px)`, `clamp(32px,4.6vw,52px)`, **`clamp(28px,3.6vw,46px)` and `clamp(24px,3vw,36px)` (the two `utterSize` wide ramps; narrow `28px` / `24px`)**, `clamp(24px,2.6vw,34px)`, `clamp(24px,2.4vw,32px)`, `clamp(19px,2vw,24px)`, `clamp(17px,1.6vw,22px)`.

**Typography treatments that are part of the type scale** (see §A17 for counts): `text-wrap:balance` on every headline and on the utterance; `text-wrap:pretty` on Landing body copy; the text-button treatment is always `text-decoration:underline` + `text-underline-offset:4px` + one of the three `text-decoration-color`s.

**Weights:** `300` (20× — display/hero only, R + L), `400` (10×), **`500` (56× — default emphasis)**, `600` (34× — filled-button labels, strong badges), `700` (1× — Operator amber avatar badge; fold into 600).

**Letter-spacing:** `-.03em` (L display) · `-.025em` · `-.02em` (28× — titles ≥26px) · `-.015em` · `-.01em` (8×) · `0` · `.04em` (5× — the `roomscout` wordmark) · `.08em` · `.09em` · `.1em` · `.12em` (5× — O eyebrow) · **`.14em` (25× — the eyebrow default)** · `.16em` · `.18em` (3× — L accent eyebrow).

**Line-height:** `1` · `1.02` · `1.04` · `1.05` · `1.06` · `1.08` · **`1.1` (21× — big titles)** · `1.16` · `1.2` · `1.25` · `1.35` · `1.4` · `1.45` · **`1.5` (13×)** · `1.55` (6×) · **`1.6` (16× — dense body)** · `1.7`.
Canonical three: **`1.1` tight (titles) · `1.5` normal (body) · `1.6` relaxed (dense body / help text)**.

### C2 · Radius scale

| Token | Value | n | Role |
|---|---|---:|---|
| `radius-xs` | `6px` | 4 | tiny text button |
| **`radius-sm`** | `8px` | 20 | inline input, small button |
| `radius-md` | `10px` | 14 | menu item, small pill button |
| **`radius-lg`** *(base)* | `12px` | 46 | default card / menu / toast |
| `radius-lg+` | `14px` | 24 | chat bubble, toast, notice |
| **`radius-xl`** | `16px` | 21 | panel, dropdown menu |
| `radius-2xl` | `18px` | 6 | Settings card |
| `radius-3xl` | `22px` | 6 | modal |
| `radius-4xl` | `26px` | 5 | Landing card |
| **`radius-shell`** | `28px` | 2 | Settings / Operator shell |
| `radius-pill` | `999px` | 56 | pills, search bar, CTA |
| `radius-round` | `50%` | 62 | dots, avatars, round icon buttons |
| `radius-hair` | `3px` (5×, L), `5px` (2×, O), `9px` (2×, S), `20px` (2×), `24px` (3×) | — | one-offs |
| `radius-bubble-scout` | `14px 14px 14px 4px` | 1 (JS) | transcript **Scout** bubble — the only Scout radius in the system |
| `radius-bubble-user` | `18px 18px 4px 18px` (stage, 3×) / `14px 14px 4px 14px` (transcript, JS) | 3 + 1 | **User** bubbles |
| `radius-sheet-card` | `26px 26px 0 0` | 1 (JS) | bottom sheet in its full-card variant (`shRadius`; compact variant `20px`) |
| `radius-fact-list` | `26px` (card) / `16px` (list) | 1 (JS) | `listRadius` |
| `radius-blob` | `62% 38% 46% 54%/44% 58% 42% 56%` | 10 | blob rest shape |
| `radius-mobile-frame` | `44px` | — | Roomscout mobile stage (`stR`) |

### C3 · Shadow scale

| Token | Value | n | Role |
|---|---|---:|---|
| `shadow-xs` | `0 1px 3px rgba(0,0,0,.3)` | 6 | toggle knob |
| `shadow-md` | `0 16px 40px rgba(0,0,0,.4)` / `…,.45` | 2 | toast, Settings popup menu |
| `shadow-lg` | `0 20px 50px rgba(0,0,0,.45)` | 1 | header dropdown menu |
| `shadow-sheet` | `0 -20px 60px rgba(0,0,0,.4)` | 1 | bottom sheet (upward) |
| **`shadow-shell`** | `0 30px 90px rgba(0,0,0,.35)` | 2 | Settings + Operator shell |
| `shadow-modal` | `0 30px 80px rgba(0,0,0,.5)` (S), `0 30px 80px rgba(0,0,0,.35)` (L) | 3 | modal / big card |
| **`glow-primary`** | `0 8px 28px rgba(255,105,38,.25)` | 5 | CTA button |
| `glow-primary-lg` | `0 8px 32px rgba(255,105,38,.28)` | 3 | CTA (Landing) |
| `glow-mic` | `0 6px 24px rgba(255,105,38,.3)` | 1 (JS) | mic button when recording |
| `glow-dot` | `0 0 8px rgba(255,105,38,.5)` | 1 | live dot |
| `glow-blob` | `0 0 34px 6px rgba(255,120,50,.35), 0 0 110px 20px rgba(255,105,38,.18)` | 2 | Scout blob |
| `glow-offer` | `0 -10px 60px rgba(255,105,38,.12), 0 40px 100px rgba(0,0,0,.5)` | 1 | Landing offer card |

Blur: `backdrop-filter: blur(6px)` (search pill), `blur(8px)` (dev bar), `blur(10px)` (sheet), `blur(12px)` (Landing header when scrolled).

### C4 · Spacing scale

A strict **2px grid**, 2 → 40, with a few large layout values. Frequency across all `padding`/`margin`/`gap`:

`2` (38) · `4` (47) · `5` (6) · `6` (79) · `8` (78) · `9` (15) · **`10` (111)** · `11` (2) · **`12` (98)** · `13` (1) · **`14` (96)** · **`16` (74)** · **`18` (87)** · **`20` (71)** · **`22` (67)** · **`24` (60)** · `26` (38) · `28` (17) · `30` (21) · `32` (14) · `34` (20) · `36` (8) · `40` (14) · `42` · `44` · `46` · `48` · `50` · `52` · `56` · `60` · `80` (7) · `90` · `100` · `110` · `120` · `130`.

Canonical steps to expose: **2 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 26 · 28 · 30 · 32 · 34 · 36 · 40**.

Recurring composites:

| Pattern | n | Role |
|---|---:|---|
| `gap:12px` / `gap:10px` / `gap:8px` | 44 / 41 / 27 | row gaps; `10px` is the icon+label gap |
| `gap:14px` / `16px` / `20px` | 22 / 20 / 23 | section gaps (`20px` almost entirely Settings) |
| `margin-top:6px` / `2px` / `4px` | 29 / 29 / 16 | label→value rhythm |
| `margin-top:14px` / `16px` / `18px` | 22 / 14 / 15 | block rhythm |
| `margin-top:22px` / `24px` / `26px` | 18 / 17 / 24 | section rhythm |
| `margin:10px 0 0` | 14 | Settings/Operator list-item rhythm |
| `padding:0 18px` / `0 22px` / `0 20px` | 23 / 18 / 13 | horizontal padding of 44–48px pills |
| `padding:14px 16px` / `14px 18px` / `16px 18px` | 7 / 7 / 4 | card padding (small) |
| `padding:20px 22px` (S:3) / `24px 26px` (R:1 S:1) / `30px 32px` (S:1 L:1) | 3 / 2 / 2 | card padding (large). `30px 32px` is the **Settings import dialog** and the **Landing Rückfrage card** |
| `padding:32px 34px` | 4 | Landing card |
| **`padding:36px 26px 30px`** | **2** | the `<nav>` of **both** shells — `Settings.dc.html:20` **and** `Operator.dc.html:28`, each with `border-right:1px solid rgba(255,220,190,.08);display:flex;flex-direction:column;min-height:0;overflow:auto;scrollbar-width:none`. Shared sidebar-13 chrome, not Settings-specific. |
| `padding:34px 34px 30px` (S:1) / `padding:34px` (O:1) | 1 / 1 | Settings drawer / Operator drawer |
| `padding:6px 0` / `18px 0` / `22px 0` | 8 / 7 / 3 | list-row vertical padding |
| `padding:0 36px` (`0 18px` narrow) | — | header/page gutter (`hdrPad`); Operator's own header is the literal `padding:0 36px` |
| `padding:28px clamp(22px,3vw,36px) 30px` | 1 | **the Roomscout offer card** (`:362`, with `width:min(720px,100%)`, `border-radius:24px`) |
| `padding:26px clamp(20px,5vw,80px) 30px` | 1 | Landing footer |
| `padding:min(90px,10vh) clamp(20px,5vw,80px) 4vh` / `…24px 4vh` | 1 / 1 | Landing sticky sections |
| `padding:clamp(24px,3vw,44px) clamp(24px,3.4vw,56px)` | 1 | Roomscout large card |
| `margin-top:min(12vh,110px)` | 1 | the welcome tagline — the only viewport-relative margin in the app |

### C5 · Control sizes

| Height | n | Role |
|---:|---:|---|
| `26px` | 10 | **the switch knob** (S:8 O:2) and 26px icon boxes — **not** the switch track; see the switch spec below |
| `30px` | 13 | Roomscout dev-bar button, mini pill |
| `32px` | 7 | **the switch track** (S:5 O:2, always `width:56px`) |
| `34px` | 5 | compact chip; fact row in list mode (`f.h`) |
| `36px` / `38px` | 6 / 6 | small button; header icon button when narrow (`hdrBtn:38`); Operator filter pills are `38px` |
| `40px` | 17 | compact control / icon button |
| `42px` | 10 | header icon button & avatar (desktop, `hdrBtn:42`); Operator env pill |
| `44px` | 23 | round icon buttons (44 × 44), Settings tab bar, dialog buttons, Landing CTA & Rückfrage buttons; fact row in card mode (`f.h`) |
| **`46px`** | 27 | **the primary control height, including in Roomscout** (R:9 S:14 O:1; L:3 are list rows, not controls) |
| `48px` / `50px` | 8 / 7 | large button; the shell nav item is `height:50px` |
| `56px` / `58px` / `62px` | 5 / 5 / 1 | Landing hero CTA (`56px`); Roomscout search pill (`58px`); side-note pill (`62px`) |
| `60px` / `76px` | — | the mic / voice control (`{{ ctrl }}` — `narrow ? 60 : 76`, square, `border-radius:50%`) |
| `64px` / `80px` / `84px` | — / — / 3 | header heights — see the `height:84px` row in §A15 for what is and is not a header |

#### The switch (Settings + Operator, byte-identical, 6 instances)

Track and knob are two elements; **26px is the knob**.

```html
<button role="switch" aria-checked="{{ on }}" aria-label="…" onClick="{{ toggle }}"
        style="width:56px;height:32px;border-radius:16px;border:0;padding:0;background:{{ bg }};
               position:relative;cursor:pointer;transition:background .2s;flex:none">
  <span style="position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;
               background:#fff;transform:{{ knob }};transition:transform .2s;
               box-shadow:0 1px 3px rgba(0,0,0,.3)"></span>
</button>
```

```js
const SW = on => ({ on, bg: on ? '#ff6926' : 'rgba(255,255,255,.14)',
                        knob: on ? 'translateX(24px)' : 'none' });
```

Track **56 × 32, r16**; knob **26 × 26 inset 3px**, travel **24px**; ON `#ff6926`, OFF `rgba(255,255,255,.14)`.
Instances: `Settings.dc.html:69, 89, 156, 163, 307` · `Operator.dc.html:156`.

#### The autonomy radio (Settings, 2 instances)

`width:26px;height:26px;border-radius:50%;border:2px solid {{ autoRing }};display:flex;align-items:center;justify-content:center;flex:none` wrapping `width:12px;height:12px;border-radius:50%;background:{{ autoDotBg }}`.
Selected → ring `#ff6926`, dot `#ff6926`; unselected → ring `rgba(255,220,190,.35)`, dot `transparent`.
Its card: `border:1px solid {{ autoCardBorder }}` (`rgba(255,105,38,.75)` / `rgba(255,220,190,.14)`), `background:{{ autoCardBg }}` (`rgba(120,58,22,.28)` / `rgba(255,255,255,.03)`).

#### The two shells are **not** identical

| | Settings | Operator |
|---|---|---|
| Position in the tree | **is** the component root | nested two levels inside its own page |
| Root style | `position:relative;height:100%;min-height:560px;display:grid;grid-template-columns:296px minmax(0,1fr);border-radius:28px;background:rgba(13,10,8,.8);border:1px solid rgba(255,190,140,.16);overflow:hidden;font-family:'Geist',system-ui,sans-serif;color:#f5ece2;box-shadow:0 30px 90px rgba(0,0,0,.35)` (`:19`) | `height:100%;display:flex;flex-direction:column;font-family:'Geist',system-ui,sans-serif;color:#f5ece2` (`:18`) |
| Shell element | — (same as root) | `flex:1;min-height:0;max-width:1380px;width:100%;margin:0 auto;position:relative;display:grid;grid-template-columns:296px minmax(0,1fr);border-radius:28px;background:rgba(13,10,8,.82);border:1px solid rgba(255,190,140,.16);overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.35)` (`:27`) — **no `min-height:560px`**, and it carries its own max-width + centring |
| Above the shell | nothing | `<header style="height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 36px;flex:none">` (`:19`) then `<div style="flex:1;min-height:0;padding:4px 36px 0;display:flex;flex-direction:column">` (`:26`) |
| `<nav>` | `padding:36px 26px 30px;border-right:1px solid rgba(255,220,190,.08);display:flex;flex-direction:column;min-height:0;overflow:auto;scrollbar-width:none` | **identical** |
| Back button | „Zurück zum Scout“ | „Zur App“ |

**Operator's outer header** (not documented anywhere else): left — the wordmark `font-size:20px;font-weight:500;letter-spacing:.04em` plus the INTERN badge `padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,90,.6);color:#ff8a4e;font-size:12px;letter-spacing:.12em;font-weight:600`; right — an env pill `height:42px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,220,190,.18);background:rgba(255,255,255,.04);display:flex;align-items:center;gap:10px;font-size:14.5px` with an 8px `#4fbf7a` dot, and a 42px round avatar `border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.04);font-size:13px;font-weight:500`. Row `gap:14px` on both sides.

#### All 21 `width:min(…)` values

| Value | n | Where |
|---|---:|---|
| `min(240px,62%)` | 1 | L floating memory chip |
| `min(300px,78%)` | 1 | L floating memory card |
| `min(360px,100%)` | 1 | R small stage card |
| `min(380px,100%)` | 3 | R stage cards |
| `min(420px,100%)` | 2 | **R transcript drawer** (`:587`) + one stage card |
| `min(440px,calc(100% - 48px))` | 1 | **Settings discard alert** — full style: `position:absolute;z-index:31;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 48px));background:rgba(18,14,11,.98);border:1px solid rgba(255,200,160,.16);border-radius:20px;padding:26px 28px;animation:stFade .25s ease both;box-shadow:0 30px 80px rgba(0,0,0,.5)` |
| `min(480px,100%)` | 1 | **Settings drawer** |
| `min(500px,100%)` | 1 | **Operator diagnostics drawer** |
| `min(520px,calc(100% - 48px))` | 1 | L summary card („So suche ich für euch.“ / „Euer Suchauftrag“) |
| `min(560px,calc(100% - 32px))` | 1 | R hint bar (`max-width`, `:582`) |
| `min(640px,100%)` | 1 | R stage column |
| `min(640px,calc(100% - 48px))` | 1 | **Settings import dialog** — `position:absolute;z-index:21;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100% - 48px));max-height:calc(100% - 48px);overflow:auto;background:rgba(18,14,11,.98);border:1px solid rgba(255,200,160,.16);border-radius:22px;padding:30px 32px;animation:stFade .25s ease both;box-shadow:0 30px 80px rgba(0,0,0,.5)` |
| `min(660px,100%)` | 1 | R side-note form |
| `min(680px,100%)` | 3 | R + L body cards |
| `min(700px,100%)` | 1 | R card |
| `min(720px,100%)` | 2 | **R offer card** (`border-radius:24px`, `padding:28px clamp(22px,3vw,36px) 30px`) |
| `min(740px,100%)` | 3 | R stage column (widest) |
| `min(1100px,100%)` | 1 | L offer card |
| `min(1120px,100%)` | 1 | L hero-card wrapper (`perspective:1600px;perspective-origin:50% 0%`) |
| `min(1180px,100%)` | 1 | R candidates grid |
| `min(1190px,100%)` | 1 | R offer grid |
| `min(1400px,100%)` | 1 | L footer / sections (`max-width:1400px` 4× as well) |

Other layout constants: both shells `grid-template-columns:296px minmax(0,1fr)`; Settings root also `min-height:560px`; the Roomscout host wrapper for the Settings import is `max-width:1380px` (`Roomscout.dc.html:66`), which is also Operator's own shell max-width; Landing sections `max-width:1400px` (4×).

### C6 · Motion

| Token | Value | n | Role |
|---|---|---:|---|
| `ease-out-soft` | `cubic-bezier(.22,.8,.2,1)` | **21** (R:11 L:10) | the signature stage/landing easing |
| `ease-out-snap` | `cubic-bezier(.3,.7,.2,1)` | **4** (R:1 S:1 L:2) | accordion `grid-template-rows` (`.26s` S, `.32s` L) and two Landing reveals |
| `dur-fast` | `.15s` / `.2s` | 6 / 13 | hover fills, mount animations |
| `dur-base` | `.25s` / `.3s` | 5 / 12 | transforms, chevrons |
| `dur-slow` | `.4s` / `.5s` / `.6s` | 4 / 8 / 12 | opacity / layout |
| `dur-stage` | `.9s` | 5 | the Roomscout stage morph |
| `enter-fade-up` | `rsFadeUp .3s ease both` (R) · `stFade .2s ease both` (S) · `opFade .2s ease both` (O) | 13 / 23 / 6 | element mount |
| `pulse-dot` | `rsDot 2.4s ease-in-out infinite` | — | live dot |

Reduced motion is honoured globally in all four files:
`@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}`

---

## Part D — Mapping onto the shadcn/ui variable schema (single dark theme)

The port targets **Tailwind v4 + shadcn/ui**. shadcn's default palette is opaque; RoomScout's is translucent glass over a photo. The mapping below keeps shadcn's *contract* (so `Button`, `Card`, `DropdownMenu`, `Dialog`, `Sidebar` work unmodified) and adds `--rs-*` variables for everything the mock needs beyond it.

Values are given verbatim from the prototype. **Do not convert to `oklch()`** — `rgba()` with alpha is load-bearing, and Tailwind v4's `/opacity` modifier still works on them via `color-mix()`.

### D1 · Core shadcn variables

| Variable | Value | Justification |
|---|---|---|
| `--background` | `#0b0a09` | `html,body{background:#0b0a09}` in R and L; the root stage `<div>` repeats it. Only true opaque ground in the system. |
| `--foreground` | `#f5ece2` | 124 occurrences of `color:#f5ece2` plus `a{color:#f5ece2}`. Unambiguous default ink. |
| `--card` | `rgba(18,14,12,.72)` | The stage card / offer panel fill (9×) — what "a card floating on the photo" looks like. Note it is *translucent*; a `Card` on an opaque parent will look slightly lighter than the mock unless the background stack is behind it. |
| `--card-foreground` | `#f5ece2` | Same ink inside cards. |
| `--popover` | `rgba(20,15,12,.96)` | The Roomscout header dropdown. Settings' menu is `.97` — see §F4, canonicalised to `.96`. |
| `--popover-foreground` | `#f5ece2` | Menu items are `color:#f5ece2;font-size:15px`. |
| `--primary` | `#ff6926` | The one brand colour: filled CTA background, 47 inline + 17 JS occurrences. |
| `--primary-foreground` | `#ffffff` | Every `#ff6926` button carries `color:#fff` (`w600`). |
| `--secondary` | `rgba(255,255,255,.06)` | The "secondary button" fill: 40px icon buttons, inputs, Scout bubble. |
| `--secondary-foreground` | `#f5ece2` | Those controls all use default ink. |
| `--muted` | `rgba(255,255,255,.04)` | The most common quiet surface (34×) — shadcn uses `--muted` exactly for quiet panels. |
| `--muted-foreground` | `#a89684` | 113× on captions, eyebrows, footnotes, disabled labels — shadcn's `--muted-foreground` role precisely. (`#cbb9a8`, 98×, sits one step brighter; exposed as `--rs-ink-muted`.) |
| `--accent` | `rgba(255,255,255,.10)` | shadcn's `--accent` is the *hover/active surface* for menu items and nav, not a brand colour. `rgba(255,255,255,.1)` is the prototype's dominant `style-hover` fill (23 of 25 uses). |
| `--accent-foreground` | `#f5ece2` | Hover keeps default ink (Landing's `color:#fff` hover is a Landing-only flourish → `--rs-ink-on-signal`). |
| `--destructive` | `#b8382a` | Destructive button + stop-recording button. |
| `--destructive-foreground` | `#ffffff` | Both carry `color:#fff`. |
| `--border` | `rgba(255,220,190,.10)` | The hairline divider, 44× — the highest-count border in the system and the one shadcn's `border-border` default should produce. |
| `--input` | `rgba(255,200,160,.16)` | shadcn uses `--input` for form-control borders. The search pill, sheet and menu use `rgba(255,200,160,.16)`; inline text inputs use `.25` → exposed as `--rs-border-input-focus`. |
| `--ring` | `#ff6926` | Verbatim: `button:focus-visible{outline:2px solid #ff6926;outline-offset:2px}` in all four files. |
| `--radius` | `0.75rem` (12px) | 12px is the most frequent non-circular radius (46×); shadcn's derived ladder then yields `sm 8px` (20×), `md 10px` (14×), `lg 12px` (46×), `xl 16px` (21×) — i.e. four of the five most common radii for free. 14px, 18px, 22px, 26px, 28px are added as `--rs-radius-*`. |

### D2 · Sidebar variables (the `sidebar-13` block used by Settings + Operator)

Both shells share `display:grid;grid-template-columns:296px minmax(0,1fr);border-radius:28px;border:1px solid rgba(255,190,140,.16);box-shadow:0 30px 90px rgba(0,0,0,.35);overflow:hidden` and a byte-identical `<nav>` (`padding:36px 26px 30px;border-right:1px solid rgba(255,220,190,.08);display:flex;flex-direction:column;min-height:0;overflow:auto;scrollbar-width:none`). **Everything around that differs** — Settings' shell is the component root, Operator's is nested under its own 84px page header with `max-width:1380px;margin:0 auto` and no `min-height`. See §C5 "The two shells are not identical" and §F26.

| Variable | Value | Justification |
|---|---|---|
| `--sidebar` | `rgba(13,10,8,.80)` | The shell fill; the nav column has no fill of its own, only a right border. (Operator uses `.82` — see §F1.) |
| `--sidebar-foreground` | `#f5ece2` | Nav item label colour. |
| `--sidebar-primary` | `rgba(120,58,22,.45)` | Active nav item background — identical in Settings and Operator (`bg: cur ? 'rgba(120,58,22,.45)' : 'transparent'`). |
| `--sidebar-primary-foreground` | `#f5ece2` | Active item keeps default ink; only the **icon** turns orange → `--rs-sidebar-active-icon: #ff8a4e`. |
| `--sidebar-accent` | `rgba(255,255,255,.06)` | Nav hover fill (`style-hover="background:rgba(255,255,255,.06)"`, S + O). |
| `--sidebar-accent-foreground` | `#f5ece2` | Unchanged on hover. |
| `--sidebar-border` | `rgba(255,220,190,.08)` | `border-right:1px solid rgba(255,220,190,.08)` on the `<nav>`. |
| `--sidebar-ring` | `#ff6926` | Same focus ring. |

Extra, because shadcn has no slot for it: `--rs-sidebar-active-border: rgba(255,140,90,.35)` (the active item's 1px border) and `--rs-sidebar-width: 296px`.

### D3 · Chart variables

The prototype has no charts, only status colours (Operator status rows, source health). Seed shadcn's five chart slots from the status palette so any future chart is on-brand:

| Variable | Value | Source |
|---|---|---|
| `--chart-1` | `#ff6926` | signal |
| `--chart-2` | `#e0a13a` | warning amber |
| `--chart-3` | `#4fbf7a` | success green |
| `--chart-4` | `#cbb9a8` | muted ink |
| `--chart-5` | `#b8382a` | danger |

### D4 · Extra `--rs-*` variables the mock needs beyond shadcn's set

shadcn cannot express: a five-step ink ramp, four warm-glass elevation levels, two hover ladders, orange tints, the photographic background stack, or the blob. These are required:

**Ink** — `--rs-ink-strong #f8f0e7` · `--rs-ink-2 #e2d3c3` · `--rs-ink-3 #d8c8b8` · `--rs-ink-muted #cbb9a8` · `--rs-ink-hint #a89684` (= `--muted-foreground`) · `--rs-ink-placeholder #9c8b7b` · `--rs-ink-on-signal #ffffff`

**Signal** — `--rs-signal #ff6926` · `--rs-signal-hover #ff7a3d` · `--rs-signal-ink #ff8a4e` · `--rs-signal-ink-soft #ffd9c4` · `--rs-signal-ink-softer #ffe0cf` · `--rs-signal-deep #e9511a` · `--rs-signal-light #ffc39a` · `--rs-signal-disabled rgba(255,105,38,.4)` · tint ladder `--rs-signal-a12 / a14 / a20 / a22 / a30 / a35`

**Warm fills** — `--rs-warm-28 rgba(120,58,22,.28)` · `--rs-warm-45 rgba(120,58,22,.45)` · `--rs-warm-75 rgba(120,58,22,.75)`

**Surfaces** — `--rs-surface-1…4` (white α .03/.04/.06/.08) · `--rs-hover-1…4` (white α .07/.10/.12/.14) · `--rs-pill rgba(20,14,10,.6)` · `--rs-card rgba(18,14,12,.72)` · `--rs-sheet rgba(18,14,12,.92)` · `--rs-side-panel rgba(14,11,9,.94)` · `--rs-toast rgba(24,17,13,.96)` · `--rs-dialog rgba(18,14,11,.98)` · `--rs-scrim rgba(6,4,3,.55)` · `--rs-shell rgba(13,10,8,.8)` · `--rs-devbar rgba(10,8,7,.88)` · `--rs-hatch` (the repeating-linear-gradient)

**Borders** — `--rs-border-hair` · `--rs-border-strong` · `--rs-border-card` · `--rs-border-card-strong` · `--rs-border-input-focus` · `--rs-border-accent` · `--rs-border-accent-strong` · `--rs-underline`

**Status** — `--rs-success #4fbf7a` · `--rs-warning #e0a13a` · `--rs-warning-bg` · `--rs-warning-border` · `--rs-warning-ink #1a1208` · `--rs-danger-hover #c9463a` · `--rs-danger-ink #ff8a6a` · **`--rs-signal-dot #ff6926`** · `--rs-dot-past rgba(255,220,190,.35)` · `--rs-dot-idle rgba(255,255,255,.3)` · `--rs-dot-6 6px` / `--rs-dot-7 7px` / `--rs-dot-8 8px` / `--rs-dot-9 9px` / `--rs-dot-radio 12px` (five real sizes — §B7)

**Switch** — `--rs-switch-w 56px` · `--rs-switch-h 32px` · `--rs-switch-r 16px` · `--rs-switch-knob 26px` · `--rs-switch-inset 3px` · `--rs-switch-travel 24px` · `--rs-switch-on #ff6926` · `--rs-switch-off rgba(255,255,255,.14)` · `--rs-switch-knob-shadow 0 1px 3px rgba(0,0,0,.3)`

**Text-button** — `--rs-underline-offset 4px` · `--rs-underline rgba(255,220,190,.35)` · `--rs-underline-strong rgba(255,220,190,.4)` · `--rs-underline-accent rgba(255,140,90,.6)`

**Layering** — `--rs-z-content 2` · `--rs-z-blob 3` · `--rs-z-factlist 4` · `--rs-z-menu 5` · `--rs-z-sheet 6` · `--rs-z-hint 8` · `--rs-z-drawer 9` · `--rs-z-header 12` · `--rs-z-toast 14` · `--rs-z-scrim 20` · `--rs-z-modal 21` · `--rs-z-scrim-2 30` · `--rs-z-modal-2 31` · `--rs-z-toast-top 40` (§A17)

**Chat** — `--rs-bubble-scout rgba(255,255,255,.06)` · `--rs-bubble-user rgba(120,58,22,.75)` · `--rs-bubble-user-transcript rgba(120,58,22,.6)` · `--rs-bubble-user-border rgba(255,140,90,.35)` · `--rs-bubble-radius-scout 14px 14px 14px 4px` · `--rs-bubble-radius-user 14px 14px 4px 14px` · `--rs-bubble-radius-user-stage 18px 18px 4px 18px`
There is **no** `18px 18px 18px 4px` in the prototype — the Scout corner is only ever the 14px set (§B6).

**Background stack** — `--rs-bg-image url("/bg.jpg")` · `--rs-bg-filter saturate(.62) brightness(.5)` · `--rs-bg-transform scaleX(-1)` · `--rs-bg-position 50% 30%` · `--rs-bg-scrim` (the 3-stop gradient) · `--rs-grain-image` · **`--rs-grain-opacity .28`** · `--rs-grain-blend overlay`

**Blob** — `--rs-blob-1 #ffc39a` · `--rs-blob-2 #ff8a4e` · `--rs-blob-3 #ff6926` · `--rs-blob-4 #e9511a` · `--rs-blob-gradient` · `--rs-blob-radius` · `--rs-blob-glow`

**Elevation** — `--rs-shadow-xs / md / lg / sheet / shell / modal` · `--rs-glow-primary / -mic / -dot / -blob`

**Motion** — `--rs-ease cubic-bezier(.22,.8,.2,1)` · `--rs-ease-snap cubic-bezier(.3,.7,.2,1)` · `--rs-dur-fast .2s` · `--rs-dur-base .3s` · `--rs-dur-slow .6s` · `--rs-dur-stage .9s`

**Layout** — `--rs-sidebar-width 296px` · `--rs-shell-radius 28px` · `--rs-shell-min-h 560px` (Settings root only) · `--rs-shell-max-w 1380px` · `--rs-header-h 84px` / `--rs-header-h-narrow 64px` (Roomscout + Operator) · `--rs-header-h-landing 80px` / `--rs-header-h-landing-scrolled 64px` · `--rs-gutter 36px` / `--rs-gutter-narrow 18px` · **`--rs-control-h 46px`** (primary) / `--rs-control-h-sm 44px` / `--rs-control-h-xs 40px` · `--rs-page-max-w 1400px` (Landing)

**Breakpoints** (§0.1 — JS state, not only media queries) — `--rs-bp-app 959px` (`matchMedia('(max-width: 959px)')`, Roomscout) · `--rs-bp-landing 880px` (`window.innerWidth < 880`) · Landing `scrolled` threshold `window.scrollY > 40`. Every `*-narrow` token above is selected by these.

All of these are declared in [`tokens.proposed.css`](./tokens.proposed.css).

---

## Part E — The background recipe

**Four** stacked elements, not three: an outer fixed root, then a `data-stage="1"` frame element that carries the mobile-phone geometry **and a second `#0b0a09`**, then the photo / scrim / grain layers inside it.

Original markup, verbatim, `Roomscout.dc.html` lines 27–31 (nothing elided):

```html
<div style="position:fixed;inset:0;overflow:hidden;font-family:'Geist',system-ui,sans-serif;color:#f5ece2;background:#0b0a09;-webkit-font-smoothing:antialiased">
  <div data-stage="1" style="position:absolute;left:{{ stL }};top:{{ stT }};width:{{ stW }};height:{{ stH }};transform:{{ stTf }};border-radius:{{ stR }};border:{{ stB }};overflow:hidden;display:flex;flex-direction:column;background:#0b0a09;transition:width .4s,height .4s,border-radius .4s">
  <div style="position:absolute;inset:-2%;background-image:url('assets/bg.jpg');background-size:cover;background-position:50% 30%;filter:saturate(.62) brightness(.5);transform:scaleX(-1)"></div>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)"></div>
  <div style="position:absolute;inset:0;opacity:.28;mix-blend-mode:overlay;background-image:url('assets/grain.svg')"></div>
  …header (z-index:12) and content (position:relative;z-index:2)…
```

`data-stage="1"` is the layer the `mobile` editor prop drives (§A2b): desktop `left:0;top:0;width:100%;height:100%;transform:none;border-radius:0;border:0`; mobile `left:50%;top:50%;width:390px;height:min(844px, calc(100% - 32px));transform:translate(-50%,-50%);border-radius:44px;border:1px solid rgba(255,220,190,.2)`. The `transition:width .4s,height .4s,border-radius .4s` on it is what animates the phone frame in and out. Landing v2 has **no** stage element — its equivalent is `<div style="position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none">` (`:24`) wrapping the same three layers, with `inset:-6% -2%` and `will-change:transform` on the photo for the scroll parallax.

Ready-to-use CSS (also in `tokens.proposed.css`):

```css
/* .rs-root is the outer fixed layer: position:fixed;inset:0;overflow:hidden;background:var(--background) */
.rs-root { position: fixed; inset: 0; overflow: hidden; background: var(--background); }

/* .rs-stage is the data-stage="1" frame — it repeats the ground and owns the phone-frame geometry */
.rs-stage {
  position: absolute; left: 0; top: 0; width: 100%; height: 100%;
  transform: none; border-radius: 0; border: 0;
  overflow: hidden; display: flex; flex-direction: column;
  background: var(--background);
  transition: width .4s, height .4s, border-radius .4s;
}
.rs-stage[data-mobile="true"] {
  left: 50%; top: 50%; width: 390px; height: min(844px, calc(100% - 32px));
  transform: translate(-50%, -50%);
  border-radius: var(--rs-radius-mobile-frame);      /* 44px */
  border: 1px solid rgba(255, 220, 190, .2);
}

.rs-stage::before,            /* photo */
.rs-stage::after {            /* scrim */
  content: ""; position: absolute; pointer-events: none;
}
.rs-stage::before {
  inset: -2%;                                     /* Landing uses  -6% -2%  for parallax */
  background-image: var(--rs-bg-image);
  background-size: cover;
  background-position: var(--rs-bg-position);     /* 50% 30% */
  filter: var(--rs-bg-filter);                    /* saturate(.62) brightness(.5) */
  transform: var(--rs-bg-transform);              /* scaleX(-1) — the photo is mirrored */
  z-index: 0;
}
.rs-stage::after {
  inset: 0;
  background: var(--rs-bg-scrim);
  z-index: 1;
}
/* grain must be its own element: mix-blend-mode + opacity cannot share ::after */
.rs-grain {
  position: absolute; inset: 0; z-index: 1; pointer-events: none;
  opacity: var(--rs-grain-opacity);               /* .28 */
  mix-blend-mode: var(--rs-grain-blend);          /* overlay */
  background-image: var(--rs-grain-image);        /* 220×220 tile, repeats */
}
.rs-stage > :not(.rs-grain) { position: relative; z-index: 2; }
```

**Assets — all eight the prototype ships and references.** `assets/` contains exactly these files; every one of them is referenced from the four in-scope `.dc.html` files and must be carried into the port.

| File | Size | Dimensions | Referenced from | Port note |
|---|---:|---|---|---|
| `bg.jpg` | 3.4 MB | 3856 × 5152 | `background-image:url('assets/bg.jpg')` in R:28 and L:25 | **re-encode** — AVIF/WebP ≈1920px wide + a blurred LQIP |
| `grain.svg` | 8 KB | 220 × 220 tile | `background-image:url('assets/grain.svg')` in R:30 and L:27 | inline as a data URI (below) |
| `hero-preview.png` | 1.5 MB | 1586 × 992 | `<img src="assets/hero-preview.png">`, `Landing v2.dc.html:51` — the tilted hero screenshot | **re-encode**, same problem as `bg.jpg`; it is above the fold, so also give it `width`/`height` and a LQIP |
| `proberaum.png` | 1.4 MB | 1096 × 880 | 3 × `<img src="assets/proberaum.png">` (L:151 offer, L:184 memory card, L:198 floating card) **and** `photo: 'assets/proberaum.png'` on the `west` candidate in Roomscout (`:698`), reaching the template through `{{ offerPhoto }}` (R:315, R:364) and `{{ c.photo }}` (R:454) | **re-encode**; used at 112 × 84, 150px-tall, and full-bleed — ship 2–3 sizes |
| `logo-roomscout.png` | 51 KB | 256 × 256 | `<img src="assets/logo-roomscout.png">` `Settings.dc.html:83` (30 × 30, `object-fit:contain`) and via `opSources[].logo` in `Operator.dc.html:282` | — |
| `logo-openai.svg` | 9 KB | — | `<img src="assets/logo-openai.svg">` `Operator.dc.html:71` (22 × 22) and via `LOGOS` (`:253`) | — |
| `logo-agentmail.png` | 14 KB | 150 × 107 | `LOGOS` map, `Operator.dc.html:253` → `{{ i.logo }}` / `{{ t.logo }}` | — |
| `logo-browserbase.png` | 7 KB | 280 × 280 | `LOGOS` map | — |
| `logo-convex.svg` | 9 KB | — | `LOGOS` map | — |
| `logo-firecrawl.svg` | 9 KB | — | `LOGOS` map | — |

Logo render sizes: `width:28px;height:28px;object-fit:contain;border-radius:5px` (`{{ t.logo }}`, O:64), `width:24px;height:24px;object-fit:contain;border-radius:5px` (`{{ i.logo }}`, O:133), `width:22px;height:22px;object-fit:contain` (O:71), `width:30px;height:30px;object-fit:contain` (S:83). Fallback when there is no logo is a 22 × 22 stroked `<svg>` rectangle at `color:#e2d3c3` inside a 26 × 26 box.

`assets/grain.svg` is a 220 × 220 `feTurbulence` tile; ship it inline as a data URI instead of a file:

```
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="220">
  <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" stitchTiles="stitch"/>
  <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .6 0"/></filter>
  <rect width="220" height="220" filter="url(#n)"/>
</svg>
```

### E1 · The Landing hero preview card (**not** part of the background stack)

The vignette and the bottom fade are `position:absolute` children of the hero card, layered over `<img src="assets/hero-preview.png">`. Reproduced verbatim, `Landing v2.dc.html:50–56`:

```html
<div style="margin-top:44px;width:min(1120px,100%);perspective:1600px;perspective-origin:50% 0%">
  <div ref="{{ heroCardRef }}" style="position:relative;border-radius:22px;border:1px solid rgba(255,190,140,.26);overflow:hidden;box-shadow:0 -10px 60px rgba(255,105,38,.12),0 40px 100px rgba(0,0,0,.5);transform:rotateX(14deg) scale(.96);transform-origin:50% 0%;will-change:transform">
    <img src="assets/hero-preview.png" alt="Beispielansicht der RoomScout-App: Der Scout arbeitet und wartet auf eine Antwort." style="display:block;width:100%;height:auto">
    <div aria-hidden="true" style="position:absolute;left:37%;top:12%;width:26%;height:30%;background:radial-gradient(ellipse at 50% 50%,#1a120c 0%,#1a120c 42%,rgba(26,18,12,0) 72%);pointer-events:none"></div>
    <div data-blob-anchor="0" style="position:absolute;left:44.7%;top:19.5%;width:10.6%;aspect-ratio:1"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,10,9,0) 70%,rgba(11,10,9,.35) 100%);pointer-events:none"></div>
    <div style="position:absolute;right:18px;bottom:14px;font-size:12px;color:#e2d3c3;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,220,190,.22);background:rgba(11,10,9,.55)">Beispielansicht</div>
  </div>
</div>
```

The vignette **masks the screenshot's own blob** so the live cursor-following blob (anchor `0`) can sit in its place. The card un-tilts on scroll — JS sets `transform: rotateX(<14·(1−t)>deg) scale(<0.96+0.04·t>)` with `t = clamp((vh*0.92 − cardTop) / (vh*0.55), 0, 1)`, forced to `1` under `prefers-reduced-motion`. Putting either gradient on the page background reproduces a different screen.

Settings and Operator have **no background of their own** — Roomscout embeds them via `<dc-import>` inside the same stage, so the shell is only `background:rgba(13,10,8,.8)` glass on top of the photo.

---

## Part F — Inconsistencies found, and the canonical value to adopt

Each item is a genuine divergence between files (or between the template and the JS) for the *same visual role*. Adopt the **bold** value.

| # | Role | Divergence | Adopt | Why |
|---|---|---|---|---|
| F1 | Settings/Operator shell fill | S `rgba(13,10,8,.8)` vs O `rgba(13,10,8,.82)` | **`rgba(13,10,8,.8)`** | Same component; `.02` is invisible. Settings is the larger surface and defines the look. |
| F2 | Shell border | `rgba(255,190,140,.16)` — a **third** border hue used nowhere else except one Landing card (`rgba(255,190,140,.26)`) | **`rgba(255,200,160,.16)`** | Collapses the border palette from 3 warm-white hues to 2. ΔE between `#ffbe8c` and `#ffc8a0` at 16 % alpha over a dark ground is imperceptible. |
| F3 | User chat bubble | template `rgba(120,58,22,.75)` vs transcript JS `rgba(120,58,22,.6)` | **`rgba(120,58,22,.75)`** | The `.6` variant appears once, in the compact transcript list; unify so a single `Bubble` component works in both places. |
| F4 | Dropdown menu fill | R `rgba(20,15,12,.96)` vs S `rgba(20,15,12,.97)` | **`rgba(20,15,12,.96)`** | Same component (`--popover`). |
| F5 | Toast / tooltip fill | R toast `rgba(24,17,13,.96)`, R hint bar `rgba(28,20,14,.92)`, S toast `rgba(28,20,14,.96)` | **`rgba(24,17,13,.96)`** | Three near-identical surfaces for one role. Border likewise: R `rgba(255,140,90,.35)` / `rgba(255,200,160,.2)` vs S `rgba(255,200,160,.22)` → adopt **`rgba(255,200,160,.22)`**. |
| F6 | Modal scrim | R+O `rgba(6,4,3,.55)` vs S `rgba(6,4,3,.6)` | **`rgba(6,4,3,.55)`** | Majority; S uses both values itself. |
| F7 | Underline colour | **three** values: R:7 L:1 `rgba(255,220,190,.35)` · S:6 O:4 `rgba(255,220,190,.4)` · L:1 `rgba(255,140,90,.6)` | **`rgba(255,220,190,.35)` for the neutral text-button; keep `rgba(255,140,90,.6)` as a separate accent underline** | The two warm-white values are drift. The `255,140,90` one is a different hue and reads as an accent link („So behaltet ihr die Kontrolle ↓“) — folding it away loses a deliberate emphasis. All 22 underlines share `text-underline-offset:4px`. |
| F8 | Hairline divider alpha | `.06` (O, 1×), `.08` (18×), `.10` (44×), `.12` (3×), `.14` (1×) in the `255,220,190` family | **`.10` for content dividers, `.08` for nav/sidebar edges** | Two levels are meaningful (content vs chrome); `.06`, `.12`, `.14` are drift. |
| F9 | Card border alpha | `.10 .12 .14 .16 .18 .20 .22 .25 .30` in the `255,200,160` family, used interchangeably | **`.14` default card, `.16` interactive/emphasised, `.25` focused input, `.35` dashed empty state** | Reduces 9 values to 4 with no visible change. |
| F10 | Accent border alpha | `.22 .30 .35 .40 .45 .50 .55 .60` in the `255,140,90` family | **`.35` default accent, `.50` strong accent — but `.60` is *not* only a border** | `.22/.30` read identical to `.35`; `.40–.55` read identical to `.50`. `.60` has two uses: the Operator INTERN badge border (fold into `.50`) **and** a `text-decoration-color` on Landing (keep, see F7). |
| F11 | Orange hues | `#ff6926` (signal), `#ff7a3d` (hover), `#ff8a4e` (accent ink), `rgb(255,140,90)` (accent border), `rgb(255,120,50)` (blob glow) | **Keep all five, name them distinctly** | They are *not* alpha variants of each other. `rgb(255,140,90)`=`#ff8c5a` ≠ `#ff8a4e`, and `rgb(255,120,50)`=`#ff7832` ≠ `#ff7a3d`. Flagged so a builder does not "tidy" them into one. |
| F12 | Amber notation | `#e0a13a` and `rgba(224,161,58,α)` | **Consistent** — `224,161,58` *is* `#e0a13a` | No action; just don't invent a second amber. |
| F13 | Blob glow | **Not a file divergence.** Landing v2 uses *both*: the anchor-following blob (`Landing v2.dc.html:31`) carries the same `0 0 34px 6px …, 0 0 110px 20px …` as Roomscout; only the static 86px section blob (`:235`) uses `0 0 30px 6px …, 0 0 90px 16px …` | **Keep two size tiers** — `glow-blob` (≥112px) and `glow-blob-sm` (86px), plus `0 0 18px rgba(255,105,38,.4)` at 44px and `0 0 60px 10px rgba(255,105,38,.35)` at 220px | The glow scales with the blob; there is nothing to canonicalise away. See §B8. |
| F14 | Blob idle duration | `rsBreathe 5.2s` (R idle, L default) vs `rsBreathe 6s` (L decoration) | **`5.2s`** | One idle rhythm. |
| F15 | Mount animation | `rsFadeUp` (8px, R) vs `stFade` (6px, S) vs `opFade` (6px, O) — `stFade` and `opFade` are byte-identical | **One `rs-fade-up` at `translateY(6px)`, `.2s ease both`** | Three names, two behaviours, one role. Keep `.3s` only for the Roomscout stage where it is deliberately slower. |
| F16 | Dot size | **five sizes, not two**: `12px` (S:2, radio inner dot) · `9px` (S:2 O:8) · `8px` (R:5 O:2 S:1) · `7px` (S:2 L:1) · `6px` (L:2). Both Settings and Operator use 8px *and* 9px. | **`9px` for the source/task status dot (S+O), `8px` for the Roomscout badge & activity dots, `7px` for the sidebar/live dot, `6px` for Landing fact bullets, `12px` for the radio** | These are five components, not one drifting one. A blanket "8px" would resize four of them. |
| F17 | Focus-ring selector | R `button,input,select` · S `button,input,textarea` · O `button` · L `button,input,a` | **One global rule for `:focus-visible` on all interactive elements** | Same declaration everywhere: `outline:2px solid #ff6926;outline-offset:2px`. |
| F18 | Placeholder rule | R `input::placeholder`; S `input,textarea`; O none; **L (v2) none — it was dropped from v1, which had `input::placeholder{color:#9c8b7b}`** | **One global `::placeholder{color:#9c8b7b}`** | v2 has no text input left on the page (the v1 waitlist form was removed), which is why the rule disappeared — not a design decision. Reinstate it globally. |
| F19 | Body font size | R/L lean on `15px`+`14px`; S on `15px`+`14.5px`+`17px`; O on `14.5px` | **`15px` body everywhere; `14.5px` reserved for Operator's dense tables** | `.5px` differences between two screens for the same text role is drift, not design. |
| F20 | Eyebrow tracking | `.14em` (25×, all files) vs `.12em` (5×, Operator) vs `.18em`/`.16em` (L accent eyebrow) | **`.14em`**, with `.18em` kept only for Landing's orange accent eyebrow | — |
| F21 | Sub-headline size | S/O `19px` + `#cbb9a8` (13×) vs R `19px` sometimes `#e2d3c3` | **`19px` + `#cbb9a8`** | — |
| F22 | Font weight `700` | Operator amber badge only (1×) | **`600`** | Geist is loaded at 300/400/500/600 — `700` is being synthesised by the browser. |
| F23 | Primary control height | **Not a per-file split.** `height:46px` = R:9 S:14 O:1 L:3 (27) · `height:44px` = R:5 S:9 O:3 L:6 (23). Roomscout uses 46px almost twice as often as 44px. | **`46px` is the primary control height app-wide** (`--rs-control-h`); `44px` is a *second, smaller* control used for round icon buttons (44 × 44), tab bars and dialog buttons (`--rs-control-h-sm`) | Both sizes appear in every file. Roomscout's stage CTAs, its round voice button and Settings' primary buttons are all 46px; Roomscout's send/voice icon buttons and Settings' tab bar are 44px. Landing's three `46px` are list rows, not controls — its buttons are 44px and 56px. An "adopt 44px app-wide" rule would resize the majority of Roomscout's own controls. |
| F24 | Landing card border | `rgba(255,190,140,.26)` (1×) | **`rgba(255,200,160,.25)`** | Folds into F2 + F9. |
| F25 | Ghost hover fill | `.07 .09 .10 .12 .14` white alphas for the same hover | **`.10` default; `.14` only for controls that already sit on `rgba(255,255,255,.08)`** | Preserves the two-step contrast, drops the drift. **Caveat:** `rgba(255,255,255,.07)` and `rgba(255,255,255,.14)` are *also* resting-state fills (mic-off, switch-off) — see §B5. Give those two their own tokens before touching the hover ladder. |
| F26 | Shell composition | Settings' shell **is** the component root (`height:100%;min-height:560px`, no header); Operator's is nested inside its own page under an `84px` header and a `padding:4px 36px 0` wrapper, with `max-width:1380px;margin:0 auto` and no `min-height` | **Extract one `<SidebarShell>`** carrying `grid-template-columns:296px minmax(0,1fr)`, `border-radius:28px`, `border:1px solid rgba(255,190,140,.16)`, `box-shadow:0 30px 90px rgba(0,0,0,.35)`, `overflow:hidden` and the shared `<nav>` (`padding:36px 26px 30px;border-right:1px solid rgba(255,220,190,.08);overflow:auto;scrollbar-width:none`); pass `minHeight`, `maxWidth` and the optional page header as props | The `<nav>` is byte-identical in both files; everything else around it is not. See §C5. |
| F27 | Switch state colours | none — but the mapping is easy to invert | **ON `#ff6926`, OFF `rgba(255,255,255,.14)`** | Recorded here because both values also appear elsewhere with other meanings (`#ff6926` = brand, `.14` = strongest hover). `const SW = on => ({ bg: on ? '#ff6926' : 'rgba(255,255,255,.14)', knob: on ? 'translateX(24px)' : 'none' })`. |

---

## Appendix · How to regenerate

Every Part A table can be rebuilt from the four `.dc.html` files with shell tools only — no script file to keep in sync:

```bash
cd "/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype"

# 1. one declaration per line, tagged with its file (R/S/O/L)
: > decls.txt
for f in Roomscout.dc.html Settings.dc.html Operator.dc.html "Landing v2.dc.html"; do
  case "$f" in Roomscout*) k=R;; Settings*) k=S;; Operator*) k=O;; *) k=L;; esac
  { grep -o 'style="[^"]*"'       "$f" | sed 's/^style="//;       s/"$//'
    grep -o 'style-hover="[^"]*"' "$f" | sed 's/^style-hover="//; s/"$//' ; } |
  awk -v k="$k" '{n=split($0,a,";");for(i=1;i<=n;i++){d=a[i];gsub(/^[ \t]+|[ \t]+$/,"",d);if(d!="")print k"\t"d}}'
done >> decls.txt          # → 5 899 lines

# 2. any table: count, per-file breakdown, sorted
awk -F'\t' '$2 ~ /^(padding|margin|gap|inset)/ {c[$2]++; f[$2","$1]++}
  END{for(k in c){b="";split("R S O L",fl," ");
      for(i=1;i<=4;i++){n=f[k","fl[i]]+0; if(n) b=b (b==""?"":" ") fl[i]":"n}
      printf "| `%s` | %d | %s |\n", k, c[k], b}}' decls.txt | sort -t'|' -k3 -nr
```

Swap the regex for `^(width|height|min-|max-)` (§A15), `^(background|transform)` (§A16), `^color:|^background:` (§A1), `^font-size:` (§A3), and so on. The `<style>` blocks (§A0) and the `data-dc-script` React source (§A2, §A2b) are read directly — they are small enough to inspect by hand and their values are quoted verbatim above.

Headline sanity checks (must still hold after any prototype edit):

```bash
for p in 'style="' 'style-hover="' '<sc-if' '<sc-for'; do
  printf '%-16s' "$p"
  for f in Roomscout.dc.html Settings.dc.html Operator.dc.html "Landing v2.dc.html"; do
    printf '%5s' "$(grep -o -F "$p" "$f" | wc -l)"; done; echo
done
# expected:  style="  322 339 162 194  (1017)
#      style-hover="   65  51  15  12  (143)
#            <sc-if    92  78  36   3  (209)
#           <sc-for     9  11  11   6  (37)
```
