# RoomScout Landing — UI Port Spec (source: `Landing v2.dc.html`)

**Source of truth:** `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/Roomscout UI Interactive Prototype/Landing v2.dc.html` (349 lines, template + `<script type="text/x-dc" data-dc-script>`).
**Compared against:** `Landing.dc.html` (v1) — see “What v2 changed”.
**Target:** React 19 + Vite + Tailwind v4 + shadcn/ui, bilingual DE/EN with a toggle. Every German string in this document is verbatim (typography included: `’`, `„ “`, `·`, `–`, `—`, `↓`, `↗`, `€`).

> The v2 script tag carries **no `data-props`** — there is no editor-side `mobile` prop on this surface. The only layout switch is the runtime-derived `narrow` flag (`window.innerWidth < 880`). All other variance is scroll-driven or click-driven state.

---

## 0. What v2 changed vs. v1 (one paragraph)

v1 was a pure scroll poem: a full-viewport hero with the blob as the only visual (no screenshot), a "Mit Scout sprechen" button that toggled a 4.5 s speech bubble („Hey! Erzählt mir kurz, wo ihr sucht und was euch wichtig ist.“), a `rsSpeak` keyframe, 7 scroll sections (`data-sec` 0–6 assigned by DOM index, not by attribute value), a 3-item conversation, 4 status lines, a numbered "Kontrolle" list (01/02/03) instead of an FAQ, a waitlist e-mail form with `joined` state, and a minimal footer (“roomscout · Designstudie”, Prototyp/Impressum/Datenschutz). v2 turns the page into a marketing landing page: it adds a fixed header that shrinks/blurs on scroll (nav "So funktioniert’s" / "Dein Scout" + "Demo starten" CTA), replaces the blob hero with a headline/sub/CTA hero plus a 3-D-tilted `hero-preview.png` app screenshot that un-tilts on scroll, adds a "So funktioniert RoomScout" intro block, rewrites the conversation to 4 lines with a *correcting* fact (400 € → 350 €) and a live "Euer Suchauftrag" fact list with a highlight-on-overwrite animation, adds a new Beat 2 "Suchauftrag" summary card that scales in over the conversation, makes the Rückfrage **interactive** (two buttons + branching answer/reply text + a "Beispiel fortsetzen" escape hatch that dims the offer card on the alternative path), reworks the offer into a "Beispielangebot" with `inklusive Nebenkosten` and an "Angebot prüfen" CTA, adds a 4-card feature bento (`#features`), replaces the control list with a 3-item accordion FAQ (`#control`, first item open by default), adds a closing CTA section and a real footer with GitHub link and hackathon credit, drops the waitlist form entirely, switches `data-sec` to explicit attribute values (0–5), adds sticky-section progress math (`(-r.top)/(height-vh)` for sections taller than 1.5 vh), a `data-blob-lag` mechanism for the shared blob, `memSeen` viewport latching, and a `scrolled` header state; `rsSpeak` is removed, `narrow` breakpoint moves 900 → 880 and background parallax factor −0.04 → −0.03.

---

## 1. Global shell

### 1.1 Fonts & `<helmet>`

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&display=swap" rel="stylesheet">
```

Root font stack: `font-family:'Geist',system-ui,sans-serif`. Weights used: 300, 400, 500, 600.

### 1.2 Global CSS (verbatim)

```css
html,body{margin:0;padding:0;background:#0b0a09;scroll-behavior:smooth}
*{box-sizing:border-box}
a{color:#f5ece2}a:hover{color:#ff6926}
button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #ff6926;outline-offset:2px}
@keyframes rsBreathe{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.04) rotate(-4deg);border-radius:54% 46% 58% 42%/50% 44% 56% 50%}}
@keyframes rsListen{0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.02) rotate(8deg);border-radius:56% 44% 52% 48%/56% 46% 54% 44%}}
@keyframes lpDot{0%,100%{opacity:.4}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}
```

### 1.3 Design tokens extracted from the inline styles

| Token | Value | Used for |
| --- | --- | --- |
| `--bg` | `#0b0a09` | page background |
| `--fg` | `#f5ece2` | primary text |
| `--fg-muted` | `#e2d3c3` | secondary text, nav links |
| `--fg-dim` | `#cbb9a8` | body copy |
| `--fg-faint` | `#a89684` | labels, meta, footer |
| `--accent` | `#ff6926` | CTA background, dots, focus ring, link hover |
| `--accent-hover` | `#ff7a3d` | CTA hover |
| `--accent-light` | `#ff8a4e` | eyebrows, bullets, blob mid-stop |
| `--accent-deep` | `#e9511a` | blob outer stop |
| `--accent-tint` | `#ffd9c4` / `#ffe0cf` | chip text / primary choice button text |
| `--surface` | see the **complete** surface inventory below — the page uses far more than the four `rgba(18,14,12,…)` card tints | cards, panels, pills, bubbles |
| `--hairline` | `rgba(255,200,160,.14)` (card border), `rgba(255,220,190,.08)` (row divider), `rgba(255,220,190,.12)` (footer/list divider) | |
| radius | `999px` pills · `26px` bento/card · `24px` offer · `22px` hero preview + clarify card · `18px` FAQ + chat bubble · `16px` inner panel · `14px` mini cards · `8px` fact row | |

**Complete surface (background) inventory — every `background:rgba(…)` in the file, by source line.** A token file generated from the four `rgba(18,14,12,…)` values alone is short of half the surfaces.

| Value | Source line | Surface |
| --- | --- | --- |
| `rgba(18,14,12,.5)` | 90 | live „Euer Suchauftrag“ fact panel (Beat 1, right column) |
| `rgba(18,14,12,.6)` | 222 | FAQ accordion item |
| `rgba(18,14,12,.66)` | 130, 175, 186, 195, 204 | clarify card (Beat 4) + all four bento cards |
| `rgba(18,14,12,.72)` | 150 | offer card (Beat 5) |
| `rgba(18,14,12,.78)` | 101 | Suchauftrag summary card (Beat 2) |
| `rgba(0,0,0,.25)` | 177 | bento card A inner „Eure Wünsche“ panel |
| `rgba(0,0,0,.3)` | 207 | bento card D permission panel |
| `rgba(0,0,0,.35)` | 198 | bento card C listing card |
| `rgba(10,8,7,.9)` | 199 | bento card C „Gesuch“ card |
| `rgba(10,8,7,.85)` | 200 | bento card C „Geteilter Raum“ card |
| `rgba(20,14,10,.5)` | 121 | Beat 3 context pill `Stuttgart · bis 350 €` |
| `rgba(20,14,10,.7)` | 201 | bento card C location pill `Stuttgart` |
| `rgba(11,10,9,.55)` | 56 | hero preview corner badge `Beispielansicht` |
| `rgba(11,10,9,.72)` | script `hdrBg` | header background when `scrolled` |
| `rgba(120,58,22,.75)` | 141 | user answer bubble (Beat 4) |
| `rgba(120,58,22,.35)` | 190 | RoomScout bubble (bento card B) |
| `rgba(255,255,255,.05)` | 136, 189 | secondary choice button · provider bubble |
| `rgba(255,255,255,.06)` | 189 | provider avatar circle |
| `rgba(255,255,255,.1)` | 136 (`style-hover`) | secondary choice button hover |
| `rgba(255,255,255,.12)` | 198, 199, 200 | skeleton bars in bento card C |
| `rgba(255,105,38,.14)` | 135 | primary choice button `Mittwoch passt` |
| `rgba(255,105,38,.16)` | 83 | conversation chip |
| `rgba(255,105,38,.26)` | 135 (`style-hover`) | primary choice button hover |
| `rgba(255,105,38,.2)` | script (`f.bg`) | fact row highlight while `changed` |
| `rgba(255,220,190,.2)` | 242 | footer vertical divider (1 px span) |
| `transparent` | script `hdrBg` / `hdrLine` / `f.bg` | header at top of page, un-highlighted fact row |

There is **no** `rgba(20,14,10,.6)` on this page (that value belongs to the v1 waitlist form, `Landing.dc.html:154`).

### 1.4 Root wrapper

```html
<div ref="{{ rootRef }}" style="font-family:'Geist',system-ui,sans-serif;color:#f5ece2;background:#0b0a09;-webkit-font-smoothing:antialiased;position:relative">
```

### 1.5 Fixed background stack (3 layers, `z-index:0`, `pointer-events:none`, `position:fixed;inset:0;overflow:hidden`)

1. **Photo layer** — `ref="{{ bgRef }}"`
   `position:absolute;inset:-6% -2%;background-image:url('assets/bg.jpg');background-size:cover;background-position:50% 30%;filter:saturate(.62) brightness(.5);transform:scaleX(-1);will-change:transform`
   Parallax: JS sets `transform: scaleX(-1) translateY(<scrollY * -0.03>px)` on every scroll frame — **skipped entirely when `prefers-reduced-motion: reduce`** (then the mirrored base transform stays).
   Asset: `assets/bg.jpg` (3856×5152 JPEG, 3.4 MB — must be re-encoded/responsive for the port).
2. **Gradient scrim** — `position:absolute;inset:0;background:linear-gradient(180deg,rgba(30,16,6,.28) 0%,rgba(12,9,7,.62) 45%,rgba(5,7,9,.92) 100%)`
3. **Grain** — `position:absolute;inset:0;opacity:.28;mix-blend-mode:overlay;background-image:url('assets/grain.svg')` (220×220 tiling SVG noise).

**shadcn candidate:** custom (decorative fixed layers; no shadcn primitive).

### 1.6 The travelling blob (shared element)

```html
<div ref="{{ blobRef }}" aria-hidden="true"
     style="position:fixed;z-index:3;pointer-events:none;opacity:0;transition:opacity .4s">
  <div style="width:100%;height:100%;border-radius:62% 38% 46% 54%/44% 58% 42% 56%;
              background:radial-gradient(circle at 42% 38%,#ffc39a 0%,#ff8a4e 28%,#ff6926 58%,#e9511a 100%);
              box-shadow:0 0 34px 6px rgba(255,120,50,.35),0 0 110px 20px rgba(255,105,38,.18);
              animation:{{ blobAnim }}"></div>
</div>
```

One single fixed-position blob is teleported between **anchor boxes** (`data-blob-anchor="<sectionIndex>"`) — an FLIP-style shared element. `syncBlob()` runs on every `componentDidUpdate` and on every scroll frame where state did not change:

```js
// constructor: this.lastAnchor = -1;   ← initial value matters, see below
const a = root.querySelector('[data-blob-anchor="' + this.state.active + '"]');
if (!a) { blob.style.opacity = '0'; return; }          // section 5 (bento) → blob fades out
const r = a.getBoundingClientRect();
const changed = this.lastAnchor !== this.state.active; this.lastAnchor = this.state.active;
const free = a.getAttribute('data-blob-lag') === '1';
const ease = (changed || free) && !this.rm.matches;     // reduced motion → no positional easing
const dur = changed ? '.55s' : '.9s';
blob.style.transition = ease
  ? 'left '+dur+' cubic-bezier(.22,.8,.2,1),top '+dur+' cubic-bezier(.22,.8,.2,1),width .55s cubic-bezier(.22,.8,.2,1),height .55s cubic-bezier(.22,.8,.2,1),opacity .4s'
  : 'opacity .4s';
blob.style.left = r.left+'px'; blob.style.top = r.top+'px';
blob.style.width = r.width+'px'; blob.style.height = r.height+'px'; blob.style.opacity = '1';
```

**Anchor inventory**

| `data-blob-anchor` | Section | Box style | `data-blob-lag` |
| --- | --- | --- | --- |
| `0` | inside hero preview card | `position:absolute;left:44.7%;top:19.5%;width:10.6%;aspect-ratio:1` | – |
| `1` | Beat 1 conversation column | `width:clamp(90px,min(14vw,18vh),160px);height:clamp(90px,min(14vw,18vh),160px)` | `1` |
| `2` | Beat 3 “Ich kümmere mich darum.” | `width:clamp(100px,min(15vw,20vh),170px);height:clamp(100px,min(15vw,20vh),170px);margin-bottom:min(44px,5vh)` | – |
| `3` | Beat 4 Rückfrage | `width:clamp(80px,9vw,110px);height:clamp(80px,9vw,110px);margin-bottom:32px` | – |
| `4` | below Beat 5 offer | `width:44px;height:44px;margin-top:20px` | `1` |
| *(none)* | `data-sec="5"` bento | — blob hidden (`opacity:0`) | – |

**`this.lastAnchor` starts at `-1`** (`constructor`, source line 266) — *not* `0` and *not* `null`. Because `active` starts at `0`, the very first `syncBlob()` therefore sees `changed === true` and gives the blob the `.55s` positional transition **plus** `opacity:1` for its first placement on anchor 0. A port that initialises it to `0` would take the `free`/no-easing branch on the first frame and render a visibly different first paint.

**Paint order:** the blob div is a **sibling of the sections**, not a child of any card, and carries `z-index:3` while every section carries `z-index:2`. It therefore always paints **above** the hero preview card (and above every other section content), no matter where the anchor box lives in the DOM.

`blobAnim`: `'rsListen 4.2s ease-in-out infinite'` when `mode === 'listening'` (i.e. `active === 1 && !cardOn`), otherwise `'rsBreathe 5.2s ease-in-out infinite'`.

**shadcn candidate:** custom (no equivalent; implement as a portal-rendered fixed `<div>` driven by anchor `getBoundingClientRect()`, or Framer Motion `layoutId` — but note the prototype uses raw rects, which survives sticky sections better).

### 1.7 `sc-*` constructs and editor-hint attributes (complete inventory)

Landing v2 uses exactly two `sc-*` elements — there is no `sc-else`, `sc-slot`, `sc-text` or any other variant on this surface:

- **`<sc-for list="{{ … }}" as="<name>">`** — repeats its children once per array item; the item is bound as `{{ <name>.… }}`. Six occurrences.
- **`<sc-if value="{{ … }}">`** — renders its children only while the bound value is truthy. There is **no `else` branch anywhere**; the three conditionals simply disappear. Three occurrences.

Both carry `hint-placeholder-*` attributes. These are **editor-preview hints only** — the Claude Design canvas uses them to draw N placeholder rows (or to pick a branch) when no live props are bound. **They have no runtime effect and must not be ported**; they are documented here only because `hint-placeholder-val` records which branch the designer treats as the default state.

| Line | Construct | Hint | Meaning |
| --- | --- | --- | --- |
| 77 | `<sc-for list="{{ lines }}" as="l">` | `hint-placeholder-count="4"` | 4 conversation lines |
| 82 | `<sc-for list="{{ l.caps }}" as="c">` | `hint-placeholder-count="0"` | chips drawn only from live data |
| 92 | `<sc-for list="{{ facts }}" as="f">` | `hint-placeholder-count="0"` | fact rows drawn only from live data |
| 103 | `<sc-for list="{{ cardRows }}" as="r">` | `hint-placeholder-count="5"` | 5 Suchauftrag rows |
| 117 | `<sc-for list="{{ statuses }}" as="st">` | `hint-placeholder-count="3"` | 3 status lines |
| 221 | `<sc-for list="{{ faqs }}" as="q">` | `hint-placeholder-count="3"` | 3 FAQ items |
| 133 | `<sc-if value="{{ clarOpen }}">` | `hint-placeholder-val="{{ true }}"` | default = choice buttons **visible** |
| 143 | `<sc-if value="{{ altPath }}">` | `hint-placeholder-val="{{ false }}"` | default = reset link **hidden** |
| 184 | `<sc-if value="{{ memPhoto }}">` | `hint-placeholder-val="{{ true }}"` | default = bento card A photo **shown** |

The other prototype-only attributes to strip on port: `ref="{{ … }}"` (maps to a React ref), `onClick="{{ … }}"` / `onChange` / `onSubmit` (map to React handlers), and `style-hover="…"` (maps to a CSS `:hover` rule / Tailwind `hover:` utility).

### 1.8 Heading census (document outline)

Landing v2 contains exactly **one `h1`, four `h2`, three `h3` — and nothing else**. Every other title-looking string is a `<div>` or a `<span>`. Reproduce this outline exactly; do not “upgrade” panel titles to headings, and do not downgrade these.

| Element | Line | Text |
| --- | --- | --- |
| `h1` | 43 | `Ihr macht Musik.` `<br>` `Der Scout sucht den Raum.` |
| `h2` | 64 | `Ein Gespräch.` `<br>` `Dann übernimmt euer Scout.` (`#how`) |
| `h2` | 172 | `Ein Scout, der euch versteht.` `<br>` `Und dranbleibt.` (`#features`) |
| `h2` | 219 | `Euer Scout übernimmt.` `<br>` `Ihr behaltet das letzte Wort.` (`#control`) |
| `h2` | 236 | `Bereit für euren nächsten Proberaum?` (closing) |
| `h3` | 115 | `Ich kümmere mich darum.` (Beat 3) |
| `h3` | 129 | `Nur echte Entscheidungen kommen zu euch.` (Beat 4) |
| `h3` | 149 | `Ein Raum, der zu euch passt.` (Beat 5) |

**Explicitly *not* headings** (all plain `<div>`, except where noted): the Beat 2 title `So suche ich für euch.` (line 100) and card heading `Euer Suchauftrag` (line 102); the Beat 1 panel title `Euer Suchauftrag` (line 91); all four bento card titles and subtitles (lines 176, 187, 196, 206); the offer card title `Stuttgart-West · Geteilter Proberaum` (line 154); the clarify kicker/question (lines 131/132); every eyebrow. The FAQ question is a **`<span>` inside the `<button>`** (line 224) and the FAQ answer is a **`<div>`** (line 226).

---

## 2. Scroll engine, state model, reduced motion

### 2.1 Component state

```js
this.state = { active: 0, p: 0, scrolled: false, narrow: false, clar: null, faq: 0, memSeen: false };
```

| Key | Type | Meaning |
| --- | --- | --- |
| `active` | 0–5 | value of `data-sec` of the last section whose top passed the viewport middle |
| `p` | 0–1, rounded to 2 decimals | progress inside `active` |
| `scrolled` | bool | `window.scrollY > 40` → header shrink |
| `narrow` | bool | `window.innerWidth < 880` |
| `clar` | `null \| 'mi' \| 'do'` | user’s Rückfrage choice |
| `faq` | index or `-1` | open FAQ item; **starts at `0`** (first item open) |
| `memSeen` | bool, latched | true once the bento section top < `vh * 0.7` |

### 2.2 Lifecycle + `measure()`

`measure()` runs in a rAF-throttled `scroll` + `resize` listener (`{passive:true}` on scroll) **and once synchronously at mount**:

```js
componentDidMount() {
  this.rm = matchMedia('(prefers-reduced-motion: reduce)');
  this.onScroll = () => { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = null; this.measure(); }); };
  window.addEventListener('scroll', this.onScroll, { passive: true });
  window.addEventListener('resize', this.onScroll);
  this.measure();                       // ← load-bearing, see below
}
componentWillUnmount() {
  window.removeEventListener('scroll', this.onScroll);
  window.removeEventListener('resize', this.onScroll);
  if (this.raf) cancelAnimationFrame(this.raf);
}
componentDidUpdate() { this.syncBlob(); }
```

The synchronous `this.measure()` in `componentDidMount` is **load-bearing** and must be reproduced (a `useLayoutEffect`, or a `useEffect` that calls the measure function once before subscribing):

- it sets `narrow` and `scrolled` from the real viewport before first paint — without it a reload at `scrollY > 40` or below 880 px flashes the wrong header height and the wrong grid columns;
- it overwrites the hero card’s inline `transform:rotateX(14deg) scale(.96)` with the computed value — on a reload deep in the page the card would otherwise stay tilted until the first scroll event;
- it seeds `memSeen` and places the blob for the first time.

`componentWillUnmount` removes both listeners **and** cancels the pending rAF; the React port needs the same cleanup in its effect’s teardown.

```js
const secs = root.querySelectorAll('[data-sec]');
const vh = window.innerHeight, mid = vh * 0.5;
let active = 0, p = 0;
secs.forEach(el => {
  const r = el.getBoundingClientRect();
  if (r.top <= mid) {
    active = Number(el.getAttribute('data-sec'));
    const sticky = r.height > vh * 1.5;
    p = Math.min(1, Math.max(0, sticky
      ? (-r.top) / Math.max(1, r.height - vh)
      : (mid - r.top) / Math.max(1, r.height)));
  }
});
const narrow = window.innerWidth < 880, scrolled = window.scrollY > 40;
let memSeen = this.state.memSeen;
const b = this.bentoRef.current;
if (!memSeen && b && b.getBoundingClientRect().top < vh * 0.7) memSeen = true;
// hero card un-tilt
const hc = this.heroCardRef.current;
if (hc) {
  const hr = hc.getBoundingClientRect();
  const t = this.rm.matches ? 1 : Math.min(1, Math.max(0, (vh * 0.92 - hr.top) / (vh * 0.55)));
  hc.style.transform = 'rotateX(' + (14 * (1 - t)).toFixed(2) + 'deg) scale(' + (0.96 + 0.04 * t).toFixed(3) + ')';
}
if (this.bgRef.current && !this.rm.matches)
  this.bgRef.current.style.transform = 'scaleX(-1) translateY(' + (window.scrollY * -0.03) + 'px)';
const q = Math.round(p * 100) / 100;
if (active !== …|| q !== …|| narrow !== …|| scrolled !== …|| memSeen !== …) this.setState({…}); else this.syncBlob();
```

### 2.3 Section map (`data-sec`)

| `data-sec` | Section | Source line | Height | Which branch in practice |
| --- | --- | --- | --- | --- |
| `0` | Hero (`#top`) | 41 | auto (`padding:130px 24px 40px`) — ≈ 1340–1400 px with the 1120 px preview card | **either** (see below) |
| `1` | Beat 1+2 Gespräch → Suchauftrag | 70 | `min-height:320vh`, inner `position:sticky;top:0;height:100vh` | sticky |
| `2` | Beat 3 „Der Scout arbeitet“ (`#work`) | 112 | `min-height:200vh`, inner sticky 100vh | sticky |
| `3` | Beat 4 Rückfrage | 127 | `min-height:100vh` | non-sticky (unless content grows past 150 vh) |
| `4` | Beat 5 Angebot | 148 | `min-height:100vh` | non-sticky (unless content grows past 150 vh) |
| `5` | Feature-Bento (`#features`) | 170 | auto | non-sticky when the cards sit side by side; sticky on narrow, where all four stack |

**“sticky” is not a property of the section — it is decided per frame** from the measured rect:

```js
const sticky = r.height > vh * 1.5;
p = clamp01(sticky ? (-r.top) / max(1, r.height - vh)
                   : (mid - r.top) / max(1, r.height));
```

So the same section can flip branches on resize. Two concrete cases: the hero is ~1340–1400 px tall (1120 px preview card at aspect 992/1586 ≈ 700 px, plus 130 px/40 px padding and the copy stack), so **on any viewport shorter than ≈ 900 px the hero takes the sticky branch**; the bento (auto height) takes the sticky branch on narrow layouts. This is visually harmless in the prototype only because `renderVals()` never reads `p` while `active` is `0` or `5` — but a port that hard-codes “section 1 and 2 are sticky, the rest are not” has diverged from the source and will break the moment content heights change. Implement the per-frame comparison.

**Sections without `data-sec`** (intro `#how` line 62, FAQ/`#control` line 218, closing CTA + footer line 233) do **not** get their own `active` value — `measure()` keeps the last `[data-sec]` whose `top <= mid`:

| While this is on screen… | `active` | Blob |
| --- | --- | --- |
| `#how` (sits in the DOM **between** `data-sec="0"` and `data-sec="1"`) | **`0`** — the hero is still the last section whose top passed the middle | **visible.** `syncBlob()` finds `[data-blob-anchor="0"]` inside the hero preview card and sets `opacity:'1'`. The blob is `position:fixed` but positioned from `getBoundingClientRect()`, so it keeps tracking that box as the hero scrolls up: it **flies upward out of view**, then flies back down into anchor 1 the moment section 1 crosses the middle. |
| `#control` | `5` | hidden (`opacity:0`) — no `[data-blob-anchor="5"]` exists |
| closing CTA + footer | `5` | hidden |

Do **not** implement “blob hidden while `#how` is on screen”: that would change the hand-off into Beat 1 into a fade instead of the long upward flight the source performs.

### 2.4 Reduced-motion behaviour (complete list)

1. Global CSS clamps every `animation-duration` and `transition-duration` to `.01ms !important` — so all opacity/transform reveals become instant cuts, and `rsBreathe` / `rsListen` / `lpDot` effectively freeze.
2. `this.rm = matchMedia('(prefers-reduced-motion: reduce)')` — background parallax is **not applied at all**.
3. Hero card un-tilt: `t` is forced to `1` → the card renders flat (`rotateX(0deg) scale(1)`) immediately, no tilt-on-scroll.
4. Blob: `ease = (changed || free) && !rm.matches` → the blob jumps between anchors with no positional easing (only `opacity .4s`, itself clamped by the CSS rule).
5. Scroll-progress reveals still happen (they are opacity/transform values driven by scroll position, not time) — they simply snap rather than tween. Nothing in the story is gated behind an animation completing, so the content stays fully reachable.
6. **The media query is captured once and never subscribed to.** `componentDidMount` does `this.rm = matchMedia('(prefers-reduced-motion: reduce)')` (source line 271) and adds **no `change` listener**; every consumer reads `this.rm.matches` live inside `measure()` / `syncBlob()`. Consequence: toggling the OS setting at runtime does not re-render anything by itself — the parallax skip (2), the hero-tilt `t = 1` shortcut (3) and the blob `ease` branch (4) only pick up the new value on the next `measure()` call, i.e. the next scroll or resize frame, and the CSS `@media` rule in §1.2 is the only part that reacts immediately. A port built on a `useReducedMotion()` hook that subscribes to `change` and re-renders will therefore behave *differently* (better, but differently) from the source; if 1:1 fidelity matters, read `matchMedia(...).matches` inside the scroll handler instead of subscribing.

---

## 3. Header / navigation

```html
<header style="position:fixed;z-index:10;top:0;left:0;right:0;height:{{ hdrH }}px;display:grid;
               grid-template-columns:1fr auto 1fr;align-items:center;padding:0 clamp(20px,4vw,48px);
               background:{{ hdrBg }};backdrop-filter:{{ hdrBlur }};border-bottom:1px solid {{ hdrLine }};
               transition:height .3s,background .3s,border-color .3s">
```

| Binding | `scrolled === false` | `scrolled === true` (`scrollY > 40`) |
| --- | --- | --- |
| `hdrH` | `80` | `64` |
| `hdrBg` | `transparent` | `rgba(11,10,9,.72)` |
| `hdrBlur` | `none` | `blur(12px)` |
| `hdrLine` | `transparent` | `rgba(255,220,190,.1)` |

**Elements**

1. **Wordmark** — `<a href="#top">` · copy `roomscout` · `font-size:19px;font-weight:500;letter-spacing:.04em;text-decoration:none;justify-self:start`. It sets **no inline `color`**, so it is the only anchor on the page that actually inherits `a{color:#f5ece2}` / `a:hover{color:#ff6926}` (see the hover-state note below).
   *shadcn candidate:* custom (plain anchor) — or `Button variant="link"`.
2. **Nav** — `<nav style="display:flex;gap:34px;font-size:15px">`, two anchors, each `color:#e2d3c3;text-decoration:none`:
   - `#how` → `So funktioniert’s`
   - `#features` → `Dein Scout`
   *shadcn candidate:* `NavigationMenu` (or a plain flex row; the design has no dropdowns). On `narrow` the nav is **not** hidden in the prototype — it stays in the middle grid column; the port should collapse it into a `Sheet` below 880 px (documented gap, see §12).
3. **CTA** — `<a href="Roomscout.dc.html">` · copy `Demo starten` · `justify-self:end;height:44px;padding:0 22px;border-radius:999px;background:#ff6926;color:#fff;font-size:15px;font-weight:600;text-decoration:none;display:flex;align-items:center`, `style-hover="background:#ff7a3d;color:#fff"`.
   *shadcn candidate:* `Button` (`size` custom h-11, `rounded-full`, `asChild` around a router `<Link>`), variant = brand/primary.

*Interaction:* anchors only; smooth scroll comes from `html{scroll-behavior:smooth}` plus per-section `scroll-margin-top` (`#how` 60 px, `#features` 70 px, `#control` 70 px, `#work` 0).

### 3.1 Hover states — page-wide rule (read before mapping any link to a component)

The stylesheet declares `a{color:#f5ece2}a:hover{color:#ff6926}`, but **an inline `style="color:…"` beats any stylesheet selector**, including `:hover`. Every anchor except the header wordmark sets `color` inline, so in the source those links have **no hover state at all** — only the five orange CTAs (which carry an explicit `style-hover`) and the bare wordmark change on hover.

| Anchor | Line | Inline colour | Hover in the source |
| --- | --- | --- | --- |
| Wordmark `roomscout` | 35 | *(none)* | `#f5ece2 → #ff6926` (stylesheet) |
| Nav `So funktioniert’s` / `Dein Scout` | 36 | `#e2d3c3` | **none** |
| Header CTA `Demo starten` | 37 | `#fff` | `background:#ff7a3d;color:#fff` |
| Hero CTA `Demo ausprobieren` | 46 | `#fff` | `background:#ff7a3d;color:#fff` |
| Hero secondary `So funktioniert’s ↓` | 47 | `#f5ece2` | **none** |
| `Weiter zu den Funktionen ↓` | 65 | `#a89684` | **none** |
| `Scout losschicken` | 104 | `#fff` | `background:#ff7a3d;color:#fff` |
| `Angebot prüfen` | 161 | `#fff` | `background:#ff7a3d;color:#fff` |
| Card D `So behaltet ihr die Kontrolle ↓` | 211 | `#f5ece2` | **none** |
| Closing CTA `Demo ausprobieren` | 238 | `#fff` | `background:#ff7a3d;color:#fff` |
| Closing `Projekt ansehen ↗` | 239 | `#f5ece2` | **none** |
| Footer `GitHub` | 243 | `#e2d3c3` | **none** |

The complete `style-hover` inventory of the page (12 elements): lines 37/46/104/161/238 `background:#ff7a3d;color:#fff` (the five orange CTAs), line 135 `background:rgba(255,105,38,.26)`, line 136 `background:rgba(255,255,255,.1)`, line 143 `color:#fff`, lines 175/186/195/204 `transform:translateY(-3px)` (the four bento cards).

**Port consequence:** §16 maps four of the hover-less text links to `Button variant="link"`, which ships an underline/colour hover. Either strip that hover (`hover:no-underline hover:text-inherit`) to stay 1:1, or make a deliberate decision to add hover affordances — but do not let it happen by accident. (Focus rings are unaffected: `button:focus-visible,input:focus-visible,a:focus-visible{outline:2px solid #ff6926;outline-offset:2px}` applies to every one of them.)

---

## 4. Hero (`#top`, `data-sec="0"`)

```html
<section id="top" data-sec="0" style="position:relative;z-index:2;padding:130px 24px 40px;
         display:flex;flex-direction:column;align-items:center;text-align:center">
```

### 4.1 Eyebrow pill

- Copy: `Euer persönlicher Proberaum-Scout`
- Style: `height:38px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,140,90,.55);display:flex;align-items:center;font-size:14.5px;color:#f5ece2`
- *shadcn candidate:* `Badge` (`variant="outline"`, custom border colour, `h-[38px] rounded-full`).

### 4.2 Headline

```html
<h1 style="margin:26px 0 0;font-size:clamp(42px,6.2vw,84px);line-height:1.02;font-weight:400;
           letter-spacing:-.03em;text-wrap:balance">Ihr macht Musik.<br><span style="color:#ff6926">Der Scout sucht den Raum.</span></h1>
```

- Line 1: `Ihr macht Musik.` — Line 2 (accent `#ff6926`): `Der Scout sucht den Raum.`
- Hard `<br>` between the lines (keep it; do not rely on balancing alone).
- *shadcn candidate:* custom (typography).

### 4.3 Sub-copy

- Copy: `Erzählt, was ihr sucht. RoomScout übernimmt die Suche und klärt mit Anbietern, ob der Raum zu euch passt.`
- Style: `margin:24px 0 0;font-size:clamp(17px,1.5vw,21px);line-height:1.5;color:#cbb9a8;max-width:600px;text-wrap:pretty`

### 4.4 CTA row

`margin-top:34px;display:flex;align-items:center;gap:26px;flex-wrap:wrap;justify-content:center`

1. **Primary** `<a href="Roomscout.dc.html">` copy `Demo ausprobieren`
   `height:56px;padding:0 32px;border-radius:999px;background:#ff6926;color:#fff;font-size:17px;font-weight:600;text-decoration:none;display:flex;align-items:center;box-shadow:0 8px 32px rgba(255,105,38,.28)`; hover `background:#ff7a3d;color:#fff`.
   *shadcn candidate:* `Button size="lg"` `asChild`.
2. **Secondary** `<a href="#how">` copy `So funktioniert’s ` + `<span aria-hidden="true">↓</span>`
   `font-size:16px;color:#f5ece2;text-decoration:none;display:flex;align-items:center;gap:8px`.
   *shadcn candidate:* `Button variant="link"` (or plain anchor).

### 4.5 Disclaimer line

- Copy: `Früher Prototyp · Kontrollierte Demo`
- Style: `margin-top:20px;font-size:13.5px;color:#a89684`

### 4.6 Hero preview (the 3-D screenshot)

Wrapper: `margin-top:44px;width:min(1120px,100%);perspective:1600px;perspective-origin:50% 0%`

Card (`ref="{{ heroCardRef }}"`):
`position:relative;border-radius:22px;border:1px solid rgba(255,190,140,.26);overflow:hidden;box-shadow:0 -10px 60px rgba(255,105,38,.12),0 40px 100px rgba(0,0,0,.5);transform:rotateX(14deg) scale(.96);transform-origin:50% 0%;will-change:transform`

Children, in order:

1. **Screenshot** — `<img src="assets/hero-preview.png" alt="Beispielansicht der RoomScout-App: Der Scout arbeitet und wartet auf eine Antwort." style="display:block;width:100%;height:auto">`
   Asset: `assets/hero-preview.png`, 1586×992 PNG, 1.5 MB. Content of the screenshot (for reference when re-shooting it from the real app): dark room background, header `roomscout` left, right `● Scout ist unterwegs` + a pause icon button + avatar `HB`; centred blob; headline `Ich kümmere mich darum.`; two status lines `Ich habe beim Raum in Stuttgart-West angefragt.` / `Jetzt warte ich auf eine Antwort.`; a pill `⌕ Stuttgart · bis 400 € ⌄`; a link `🕐 Aktivität ansehen`; a composer input `Möchtest du mir noch etwas sagen?` with a keyboard glyph and an orange mic button; footnote `Du kannst die App schließen. Ich melde mich.`
2. **Blob knock-out mask** — full verbatim tag (note `aria-hidden="true"`, which the mask must keep):
   `<div aria-hidden="true" style="position:absolute;left:37%;top:12%;width:26%;height:30%;background:radial-gradient(ellipse at 50% 50%,#1a120c 0%,#1a120c 42%,rgba(26,18,12,0) 72%);pointer-events:none"></div>`
   It paints over the blob baked into the PNG so the *live* blob can sit there. It comes **before** the anchor div in DOM order (mask → anchor → bottom fade → badge), but that order is irrelevant to the blob itself: the travelling blob is not a child of this card at all — it is a `position:fixed;z-index:3` sibling of the sections (§1.6) and therefore paints above the whole card regardless.
3. **Blob anchor 0** — `position:absolute;left:44.7%;top:19.5%;width:10.6%;aspect-ratio:1` (empty div, no `aria-hidden`; it is a pure measurement box).
4. **Bottom fade** — `position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,10,9,0) 70%,rgba(11,10,9,.35) 100%);pointer-events:none`
5. **Corner badge** — copy `Beispielansicht` · `position:absolute;right:18px;bottom:14px;font-size:12px;color:#e2d3c3;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,220,190,.22);background:rgba(11,10,9,.55)`
   *shadcn candidate:* `Badge variant="outline"`.

**Scroll animation:** on every frame,
`t = clamp01((vh*0.92 - cardTop) / (vh*0.55))`, `transform = rotateX(14*(1-t) deg) scale(0.96 + 0.04*t)`.
Reduced motion → `t = 1` (flat, unscaled) permanently.

*shadcn candidate (whole block):* `Card` for the frame + custom for the perspective/parallax wrapper.

---

## 5. Intro block “So funktioniert RoomScout” (`#how`, no `data-sec`)

```html
<section id="how" style="position:relative;z-index:2;scroll-margin-top:60px;
         padding:120px clamp(20px,5vw,80px) 0;max-width:1400px;margin:0 auto">
  <div style="display:grid;grid-template-columns:{{ introCols }};gap:40px;align-items:end">
```

`introCols` = `narrow ? '1fr' : 'minmax(0,1.6fr) minmax(260px,.8fr)'`

This section has **no `data-sec`** and sits in the DOM *between* `data-sec="0"` and `data-sec="1"`, so while it fills the viewport the scroll engine still reports `active === 0` and the travelling blob keeps tracking the hero-preview anchor as it flies off the top of the screen (§2.3). Nothing in this section is scroll-animated; both columns are static.

Element types: eyebrow `<div>`, headline `<h2>` (one of only four on the page, §1.8), right column `<div>` with an inline `<a>`.

**Left column**

- Eyebrow: `So funktioniert RoomScout` — `font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;color:#ff8a4e;font-weight:500`
- H2 (`margin:18px 0 0;font-size:clamp(36px,5.4vw,74px);line-height:1.02;font-weight:400;letter-spacing:-.03em;text-wrap:balance`):
  `Ein Gespräch.` `<br>` `Dann übernimmt euer Scout.`

**Right column** — `font-size:clamp(17px,1.4vw,20px);color:#cbb9a8;line-height:1.5;padding-bottom:10px`

- `Von euren Wünschen bis zum konkreten Angebot.` `<br>`
- Link `<a href="#features" style="display:inline-block;margin-top:14px;font-size:14.5px;color:#a89684;text-decoration:none">` copy `Weiter zu den Funktionen ↓`

*shadcn candidates:* eyebrow → `Badge variant="ghost"`/custom label; heading → custom; link → `Button variant="link"`.

---

## 6. Beat 1 + 2 — “Gespräch → Suchauftrag” (`data-sec="1"`)

```html
<section data-sec="1" style="position:relative;z-index:2;min-height:320vh">
  <div style="position:sticky;top:0;height:100vh;padding:min(90px,10vh) clamp(20px,5vw,80px) 4vh;
              max-width:1400px;margin:0 auto;display:grid;grid-template-columns:{{ convoCols }};
              gap:clamp(24px,4vw,60px);align-items:center;overflow:hidden">
```

`convoCols` = `narrow ? 'minmax(90px,.4fr) minmax(0,1.6fr)' : 'minmax(140px,.7fr) minmax(0,1.6fr) minmax(220px,.9fr)'`
Progress formula for this section: its measured height (`min-height:320vh`) is always > `1.5 × vh`, so the per-frame `sticky` test in §2.3 always picks the sticky branch here — `p = clamp01(-r.top / (r.height - vh))`.

### 6.1 Timing constants

```js
const convoEnd = 0.62;
const seg = convoEnd / (LINES.length + 0.3);   // 0.62 / 4.3 = 0.144186
```

Per line `i` (0-based). **`p` is quantised before every comparison** — `measure()` stores `q = Math.round(p * 100) / 100`, so the value tested here only ever takes 2-decimal steps. The right-hand column is what a builder should hard-code / assert against: the first 2-decimal `p` at which the flag flips.

| Line | `start = i*seg + .04` | `capOn = start + seg*.35` | `moved = start + seg*.72` | effective `p` steps (quantised) |
| --- | --- | --- | --- | --- |
| 0 | `0.040000` | `0.090465` | `0.143814` | start `0.04` · cap `0.10` · moved `0.15` |
| 1 | `0.184186` | `0.234651` | `0.288000` | start `0.19` · cap `0.24` · moved `0.29` |
| 2 | `0.328372` | `0.378837` | `0.432186` | start `0.33` · cap `0.38` · moved `0.44` |
| 3 | `0.472558` | `0.523023` | `0.576372` | start `0.48` · cap `0.53` · moved `0.58` |

(Exact values, 6 dp — earlier drafts of this doc mis-rounded line 1 `moved` to `0.2879` (it is exactly `0.288`), line 2 `moved` to `0.4321` (`0.43219` → `0.4322`) and line 3 `moved` to `0.5763` (`0.57637` → `0.5764`).)

`cardOn = pastConvo || (inConvo && p >= convoEnd + 0.07)` → **`p ≥ 0.69`** (in IEEE doubles `0.62 + 0.07 === 0.69` exactly, so the quantised `q = 0.69` does satisfy it).
Fact-highlight window: `p < convoEnd + 0.06`. Careful: `0.62 + 0.06 === 0.6799999999999999` in doubles, so `q = 0.68` is **not** `< ` the threshold — the highlight is on for **`q ≤ 0.67`** and off from `0.68`.
`inConvo = active === 1`, `pastConvo = active > 1` (everything is force-shown once you scroll past).

### 6.2 Left column — “listening” indicator

`display:flex;flex-direction:column;align-items:{{ convoAlign }};gap:22px;opacity:{{ convoOp }};transition:opacity .5s`
`convoAlign` = `narrow ? 'flex-start' : 'center'`; `convoOp` = `cardOn ? 0 : 1`.

- Blob anchor 1 (see §1.6), `data-blob-lag="1"`.
- Label row: `font-size:14px;color:#a89684;display:flex;align-items:center;gap:8px`
  - pulsing dot: `width:7px;height:7px;border-radius:50%;background:#ff6926;animation:lpDot 2.4s ease-in-out infinite`
  - copy (`convoLabel`, constant): `Ich höre zu`

*shadcn candidate:* custom (blob) + `Badge`-like inline status; the dot is a plain span.

### 6.3 Middle column — the conversation

Container: `display:flex;flex-direction:column;gap:min(22px,2.2vh);min-width:0;opacity:{{ convoOp }};transform:{{ convoTf }};transition:opacity .5s,transform .6s`
`convoTf` = `cardOn ? 'translateY(-16px)' : 'none'`.

`<sc-for list="{{ lines }}" as="l" hint-placeholder-count="4">` — one block per line:

```html
<div style="opacity:{{ l.op }};transform:{{ l.tf }};transition:opacity .6s,transform .6s cubic-bezier(.22,.8,.2,1)">
  <div style="font-size:12.5px;color:#a89684;margin-bottom:4px">Du</div>
  <div style="font-size:clamp(17px,min(2.2vw,3.4vh),30px);line-height:1.2;font-weight:300;letter-spacing:-.015em;text-wrap:balance">{{ l.text }}</div>
  <div style="height:min(34px,5vh);margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
    <sc-for list="{{ l.caps }}" as="c" hint-placeholder-count="0">
      <span style="display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:999px;
                   background:rgba(255,105,38,.16);border:1px solid rgba(255,140,90,.5);color:#ffd9c4;
                   font-size:13px;font-weight:500;white-space:nowrap;opacity:{{ c.op }};transform:{{ c.tf }};
                   transition:opacity .45s,transform .55s cubic-bezier(.3,.7,.2,1)">{{ c.label }}</span>
    </sc-for>
  </div>
</div>
```

Reveal values: `l.op = shown ? 1 : 0`, `l.tf = shown ? 'none' : 'translateY(18px)'`.
Chip values: `c.op = capOn && !moved ? 1 : 0`; `c.tf = moved ? 'translate(40px,-10px) scale(.9)' : (capOn ? 'none' : 'translateY(8px)')` — i.e. the chip **flies up-right and shrinks** as it “lands” in the fact list.

**LINES (verbatim, with the facts each one extracts)**

| # | `l.text` | chips (`id` → label) |
| --- | --- | --- |
| 0 | `Wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart.` | `ort` → `Stuttgart & Umgebung`; `band` → `Geteilter Raum · 4 Personen` |
| 1 | `Bis 400 Euro im Monat. Unser Schlagzeug soll dort bleiben können.` | `budget` → `Bis 400 € / Monat`; `equip` → `Schlagzeug darf im Raum bleiben` |
| 2 | `Am liebsten donnerstags ab 19 Uhr.` | `zeit` → `Donnerstags ab 19 Uhr` |
| 3 | `Eigentlich lieber maximal 350 Euro.` | `budget` → `Bis 350 € / Monat` **(overwrites line 1’s budget)** |

Speaker label above every line: `Du`.

*shadcn candidate:* chips → `Badge`; lines → custom typography.

### 6.4 Right column — live “Euer Suchauftrag” list

Wrapper: `align-self:center;min-width:0;display:{{ listDisplay }};opacity:{{ listOp }};transform:{{ listTf }};transition:opacity .5s,transform .6s cubic-bezier(.22,.8,.2,1)`

- `listDisplay` = `narrow ? 'none' : 'block'` → **hidden below 880 px**.
- `listOp` = `cardOn ? 0 : ((inConvo && p > 0.1) || pastConvo ? 1 : 0)`
- `listTf` = `cardOn ? 'translate(-30%,10px) scale(.92)' : 'none'` → the panel slides toward the incoming summary card.

Panel: `padding:14px 16px;border-radius:16px;background:rgba(18,14,12,.5);border:1px solid rgba(255,200,160,.12)`
Panel title: `Euer Suchauftrag` — `font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:#a89684;margin-bottom:6px`

Panel title element type: a plain **`<div>`**, not a heading (source line 91).

Rows (`<sc-for list="{{ facts }}" as="f" hint-placeholder-count="0">`), fixed order `ORDER = ['ort','budget','band','zeit','equip']`:

```html
<div style="display:flex;align-items:center;gap:10px;height:34px;font-size:14px;border-radius:8px;padding:0 6px;
            background:{{ f.bg }};opacity:{{ f.op }};transform:{{ f.tf }};
            transition:opacity .4s,transform .5s cubic-bezier(.22,.8,.2,1),background .6s">
  <span style="width:6px;height:6px;border-radius:50%;background:#ff8a4e;flex:none"></span>
  <span style="text-decoration:{{ f.deco }};color:{{ f.color }};transition:color .4s">{{ f.label }}</span>
</div>
```

| Value | Rule |
| --- | --- |
| `f.label` | `factState[id].label` if that id has landed, else `''` (empty row keeps its 34 px height) |
| `f.op` | `1` once the corresponding chip has `moved`, else `0` |
| `f.tf` | `'none'` / `'translateY(-8px)'` |
| `f.bg` | `'rgba(255,105,38,.2)'` while `f.changed && inConvo && p < 0.68` (i.e. `q ≤ 0.67`), else `'transparent'` |
| `f.color` | `'#ffd9c4'` while `f.changed && inConvo`, else `'#f5ece2'` |
| `f.deco` | always `'none'` (strike-through slot exists but is unused in v2) |

**The fact accumulator — reimplement this exactly.** `factState` is a plain object rebuilt **from scratch on every render** by walking `LINES` in order inside the same `.map()` that produces the chips:

```js
const factState = {};                       // id -> {label, changed} | null
const lines = LINES.map((l, i) => {
  const start = i * seg + 0.04,
        shown = pastConvo || (inConvo && p >= start),
        capOn = pastConvo || (inConvo && p >= start + seg * 0.35),
        moved = pastConvo || (inConvo && p >= start + seg * 0.72);
  const caps = l.facts.map(([id, label]) => {
    if (moved) { factState[id] = { label, changed: factState[id] ? true : false }; }
    else if (!factState[id]) factState[id] = null;
    return { label, op: capOn && !moved ? 1 : 0,
             tf: moved ? 'translate(40px,-10px) scale(.9)' : (capOn ? 'none' : 'translateY(8px)') };
  });
  return Object.assign({ text: l.text, caps }, reveal(shown, 18));
});
const facts = ORDER.map(id => { const f = factState[id]; return { label: f ? f.label : '', … }; });
```

Three semantics a builder must not lose:

1. **`changed` is derived, never hard-coded.** It means only “an entry already existed under this id when this line landed”. Because the whole accumulator is recomputed every render, scrolling back up correctly *un-sets* it — there is no latch, no flag on the budget row, and no `useState`. A port that stores `changed` in state will get it stuck.
2. **The `else if (!factState[id]) factState[id] = null` branch is what preserves an already-landed value.** Without it, a later line that references the same id would wipe the earlier label while its own `moved` is still false. With it, `null` is only written when the id has never landed (and `null` is falsy, so the next `changed` computation still yields `false`).
3. **The budget row therefore has an on-screen timeline, not just an “overwrite”:**

| `p` window (quantised) | `budget` row shows | `changed` |
| --- | --- | --- |
| `q < 0.29` | *(empty row, `opacity:0`)* | – |
| `0.29 ≤ q < 0.58` | `Bis 400 € / Monat` | `false` → normal `#f5ece2`, transparent background |
| `q ≥ 0.58` | `Bis 350 € / Monat` | `true` → `#ffd9c4` text; background `rgba(255,105,38,.2)` while `q ≤ 0.67`, transparent from `0.68` |
| `active > 1` (`pastConvo`) | `Bis 350 € / Monat` | `true`, but `inConvo` is false → text back to `#f5ece2`, no highlight |

`budget` is the only id that is ever `changed:true` in v2 (line 3 overwrites line 1); the other four (`ort`, `band`, `zeit`, `equip`) land once and never move.

Caption below the panel: `Während ihr sprecht, merke ich mir, was zählt. Korrekturen ersetzen den alten Wert.` — `margin-top:14px;font-size:14px;color:#a89684;line-height:1.5`

*shadcn candidate:* `Card` + list rows (custom) — or `Table` is overkill; use `Separator`-free flex rows.

### 6.5 Beat 2 — “Suchauftrag” summary card (absolutely positioned over the same sticky viewport)

```html
<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) {{ cardScale }};
            width:min(520px,calc(100% - 48px));opacity:{{ cardOp }};visibility:{{ cardVis }};
            pointer-events:{{ cardPe }};transition:opacity .6s,transform .7s cubic-bezier(.22,.8,.2,1),visibility .6s;
            text-align:center">
```

`cardOp` `1/0`, `cardVis` `visible/hidden`, `cardPe` `auto/none`, `cardScale` `scale(1)` / `scale(.92)` — all driven by `cardOn` (`p ≥ 0.69`).

- Title: `So suche ich für euch.` — a plain **`<div>`**, *not* a heading (line 100) — `font-size:clamp(26px,min(3.6vw,5vh),46px);font-weight:300;letter-spacing:-.02em;margin-bottom:min(22px,2.5vh)`
- Card: `background:rgba(18,14,12,.78);border:1px solid rgba(255,200,160,.16);border-radius:26px;padding:26px 28px 28px;text-align:left;box-shadow:0 30px 80px rgba(0,0,0,.35)`
  - Card heading: `Euer Suchauftrag` — also a plain **`<div>`** (line 102) — `font-size:21px;margin-bottom:10px`
  - Rows (`<sc-for list="{{ cardRows }}" as="r" hint-placeholder-count="5">`, static array of 5), each
    `display:flex;align-items:center;gap:14px;height:min(44px,5.6vh);font-size:clamp(14px,2.2vh,17px);border-bottom:1px solid rgba(255,220,190,.08)` with a leading `6px` dot `background:#ff8a4e`:
    1. `Stuttgart & Umgebung`
    2. `Bis 350 € / Monat`
    3. `Geteilter Raum · 4 Personen`
    4. `Donnerstags ab 19 Uhr`
    5. `Schlagzeug darf im Raum bleiben`
  - CTA `<a href="#work">` copy `Scout losschicken` —
    `margin-top:18px;height:56px;border-radius:999px;background:#ff6926;color:#fff;font-size:17px;font-weight:600;display:flex;align-items:center;justify-content:center;text-decoration:none;box-shadow:0 8px 28px rgba(255,105,38,.25)`, hover `background:#ff7a3d;color:#fff`
  - Footnote (centred): `Ich suche und frage selbstständig an.` `<br>` `Eine verbindliche Zusage gebt nur ihr.` — `margin-top:12px;font-size:14px;line-height:1.5;color:#cbb9a8;text-align:center`

*shadcn candidate:* `Card` (+ `CardHeader`/`CardContent`), rows custom, CTA `Button size="lg"` full-width `asChild`.

---

## 7. Beat 3 — “Der Scout arbeitet” (`#work`, `data-sec="2"`)

```html
<section id="work" data-sec="2" style="position:relative;z-index:2;min-height:200vh;scroll-margin-top:0">
  <div style="position:sticky;top:0;height:100vh;display:flex;flex-direction:column;align-items:center;
              justify-content:center;text-align:center;padding:min(90px,10vh) 24px 4vh;overflow:hidden">
```

1. **Blob anchor 2** — `width:clamp(100px,min(15vw,20vh),170px);height:…;margin-bottom:min(44px,5vh)`
2. **H3**: `Ich kümmere mich darum.` — `margin:0;font-size:clamp(34px,5vw,64px);line-height:1.05;font-weight:300;letter-spacing:-.025em`
3. **Status cross-fader** — `margin-top:22px;min-height:64px;display:grid;place-items:center`; all three lines stack in `grid-area:1/1`:
   `font-size:clamp(17px,1.6vw,22px);color:#e2d3c3;max-width:560px;text-wrap:balance;opacity:{{ st.op }};transform:{{ st.tf }};transition:opacity .5s,transform .5s`
   `stIdx = active > 2 ? 2 : min(2, floor(p * 3))` → thresholds `p < 1/3` → 0, `1/3 ≤ p < 2/3` → 1, `p ≥ 2/3` → 2.
   `st.op = (active >= 2 && i === stIdx) ? 1 : 0`; `st.tf = i === stIdx ? 'none' : (i < stIdx ? 'translateY(-10px)' : 'translateY(10px)')`.
   **STATUSES (verbatim):**
   1. `Ich suche passende Räume.`
   2. `Ich kläre die offenen Fragen mit dem Anbieter.`
   3. `Die Anfrage ist raus. Ich warte auf eine Antwort.`
   *Note:* because the condition is `active >= 2`, status 3 remains visible (opacity 1) for every later section too — it is simply scrolled out of view.
4. **Context pill** (static copy): `Stuttgart · bis 350 €` —
   `margin-top:26px;height:42px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,200,160,.16);background:rgba(20,14,10,.5);display:flex;align-items:center;gap:10px;font-size:14px;color:#e2d3c3`
   *shadcn candidate:* `Badge variant="outline"` (h-[42px]).
5. **Reassurance**: `Ihr könnt die App schließen. Ich melde mich, wenn ich euch brauche.` —
   `margin-top:50px;font-size:15px;color:#a89684;max-width:460px;line-height:1.6;text-wrap:pretty`

*shadcn candidate (block):* custom; the cross-fade is a stacked grid, not `Tabs`.

---

## 8. Beat 4 — Rückfrage / interactive branch (`data-sec="3"`)

```html
<section data-sec="3" style="position:relative;z-index:2;min-height:100vh;display:flex;flex-direction:column;
         align-items:center;justify-content:center;text-align:center;padding:100px 24px 80px">
```

Scroll gates (non-sticky formula `p = (mid - top)/height`):

| Flag | Condition |
| --- | --- |
| `clarShown` | `active > 3 \|\| (active === 3 && p > 0.22)` |
| `ansShown` | `active > 3 \|\| (active === 3 && p > 0.45)` |
| `repShown` | `active > 3 \|\| (active === 3 && p > 0.6)` |

1. **Blob anchor 3** — `width:clamp(80px,9vw,110px);height:…;margin-bottom:32px`
2. **H3**: `Nur echte Entscheidungen kommen zu euch.` —
   `margin:0;font-size:clamp(32px,4.6vw,58px);line-height:1.05;font-weight:300;letter-spacing:-.025em;text-wrap:balance`
   (single line in the markup — v1 had a `<br>` here, v2 does not)
3. **Clarify card**
   `margin-top:34px;width:min(680px,100%);background:rgba(18,14,12,.66);border:1px solid rgba(255,200,160,.14);border-radius:22px;padding:30px 32px;opacity:{{ clarOp }};visibility:{{ clarVis }};transform:{{ clarTf }};transition:opacity .6s,transform .6s cubic-bezier(.22,.8,.2,1),visibility .6s`
   (`clarTf` = `'none'` / `'translateY(18px)'`)
   - Kicker: `Dein Scout` — `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
   - Question: `Ein Raum passt zu euch. Donnerstag ist schon belegt — wäre Mittwoch ab 19 Uhr auch möglich?` —
     `margin-top:12px;font-size:clamp(21px,2.3vw,29px);line-height:1.25;font-weight:300;text-wrap:balance`
   - **`<sc-if value="{{ clarOpen }}">`** — `clarOpen = !state.clar && !ansShown` (buttons disappear once the user picks *or* once the scroll auto-answer fires):
     Row `margin-top:22px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap`
     - **Primary choice** `onClick={{ pickMi }}` copy `Mittwoch passt` —
       `height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,140,90,.45);background:rgba(255,105,38,.14);color:#ffe0cf;font:inherit;font-size:15px;font-weight:500;cursor:pointer`, hover `background:rgba(255,105,38,.26)` → `setState({clar:'mi'})`
     - **Secondary choice** `onClick={{ pickDo }}` copy `Donnerstag bleibt wichtig` —
       `height:44px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer`, hover `background:rgba(255,255,255,.1)` → `setState({clar:'do'})`
     *shadcn candidate:* `Button variant="secondary"` / `Button variant="outline"`, both `rounded-full h-11`.
4. **Answer + reply thread**
   Container: `width:min(680px,100%);display:flex;flex-direction:column;gap:12px;margin-top:16px;min-height:110px`
   - **User bubble** (`align-self:flex-end`): `padding:13px 18px;border-radius:18px 18px 4px 18px;background:rgba(120,58,22,.75);border:1px solid rgba(255,140,90,.35);font-size:16px;opacity:{{ ansOp }};transform:{{ ansTf }};transition:opacity .5s,transform .5s`
     `ansOp = (ansShown || state.clar) ? 1 : 0`; `ansTf` `'none'` / `'translateY(10px)'`
     `ansText` = `alt ? 'Donnerstag bleibt wichtig.' : 'Mittwoch passt auch.'`
   - **Scout reply** (`align-self:flex-start`): `font-size:17px;padding:4px;text-align:left;opacity:{{ repOp }};transition:opacity .5s .1s`
     `repOp = (repShown || state.clar) ? 1 : 0`
     `repText` = `alt ? 'Alles klar. Ich suche weiter nach Donnerstag.' : 'Alles klar, Mittwoch geht also auch. Ich kläre den Rest.'`
   - **`<sc-if value="{{ altPath }}">`** (`altPath = state.clar === 'do'`) — reset link, `onClick={{ resumeStory }}` → `setState({clar:'mi'})`
     copy `Beispiel fortsetzen (Mittwoch-Pfad)` —
     `align-self:flex-start;border:0;background:none;color:#d8c8b8;font:inherit;font-size:14.5px;cursor:pointer;padding:6px 4px;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,220,190,.35)`, hover `color:#fff`
     *shadcn candidate:* `Button variant="link"`.

*shadcn candidate (card):* `Card` + `CardHeader`(kicker)/`CardTitle`(question)/`CardFooter`(buttons); bubbles custom.

---

## 9. Beat 5 — Angebot (`data-sec="4"`)

```html
<section data-sec="4" style="position:relative;z-index:2;min-height:100vh;display:flex;flex-direction:column;
         align-items:center;justify-content:center;text-align:center;padding:100px 24px 100px">
```

- **H3**: `Ein Raum, der zu euch passt.` — `margin:0 0 30px;font-size:clamp(32px,4.6vw,58px);line-height:1.05;font-weight:300;letter-spacing:-.025em`
- **Offer card**
  `width:min(1100px,100%);display:grid;grid-template-columns:{{ offerCols }};background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:24px;overflow:hidden;text-align:left;opacity:{{ offerOp }};visibility:{{ offerVis }};transform:{{ offerTf }};transition:opacity .7s,transform .7s cubic-bezier(.22,.8,.2,1),visibility .7s`
  - `offerCols` = `narrow ? '1fr' : 'minmax(0,1fr) minmax(0,1.05fr)'`
  - **Reveal:** `shown = active > 4 || (active === 4 && p > 0.15)`; `offerVis` and `offerTf` (`'none'` / `'translateY(24px)'`) follow `shown`.
  - **Branch:** `offerOp = alt ? 0.35 : (shown ? 1 : 0)` — on the “Donnerstag bleibt wichtig” path the offer card stays **permanently dimmed to 0.35** (the promise was “I keep looking for Thursday”), and only the `Beispiel fortsetzen (Mittwoch-Pfad)` reset restores it.
  - **Image**: `<img src="assets/proberaum.png" alt="Proberaum mit Schlagzeug und Akustikpaneelen" style="display:block;width:100%;height:100%;min-height:{{ offerImgMin }}px;max-height:440px;object-fit:cover">`; `offerImgMin` = `narrow ? 220 : 360`. Asset 1096×880 PNG.
  - **Body**: `padding:clamp(24px,3vw,44px) clamp(24px,3.4vw,52px);display:flex;flex-direction:column;justify-content:center;min-width:0`
    - Eyebrow `Beispielangebot` — `font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#ff8a4e;font-weight:500`
    - Title `Stuttgart-West · Geteilter Proberaum` — `margin-top:16px;font-size:clamp(22px,2.2vw,30px)`
    - Price `280 €` + `<span style="font-size:.6em;color:#e2d3c3">/ Monat</span>` — `margin-top:6px;font-size:clamp(36px,3.6vw,50px);letter-spacing:-.02em;line-height:1.1`
    - Price note `inklusive Nebenkosten` — `margin-top:4px;font-size:16px;color:#cbb9a8`
    - Check list — `margin-top:20px;display:flex;flex-direction:column;gap:9px;font-size:16px`; each row `display:flex;align-items:center;gap:12px` with an 18×18 check SVG `stroke="#ff6926" stroke-width="2.2"` (`<path d="M5 12.5l4.5 4.5L19 7.5">`):
      1. `Mittwochs, 19–22 Uhr` (en dash)
      2. `Schlagzeug kann im Raum bleiben`
    - CTA `<a href="Roomscout.dc.html">` copy `Angebot prüfen` —
      `margin-top:26px;align-self:flex-start;height:50px;padding:0 30px;border-radius:999px;background:#ff6926;color:#fff;font-size:16px;font-weight:600;text-decoration:none;display:flex;align-items:center`, hover `background:#ff7a3d;color:#fff`
    - Footnote `Eine verbindliche Zusage gebt nur ihr.` — `margin-top:14px;font-size:14.5px;color:#cbb9a8`
- **Section footnote**: `Beispielsuche · Ablauf verkürzt dargestellt` — `margin-top:22px;font-size:13px;color:#a89684`
- **Blob anchor 4** — `width:44px;height:44px;margin-top:20px`, `data-blob-lag="1"`

*shadcn candidate:* `Card` (2-column grid with a media half) + `Button` + `Badge` for the eyebrow; check rows custom (or `lucide-react` `Check` icon).

---

## 10. Feature bento (`#features`, `data-sec="5"`, `ref="{{ bentoRef }}"`)

```html
<section id="features" data-sec="5" ref="{{ bentoRef }}"
         style="position:relative;z-index:2;scroll-margin-top:70px;padding:60px clamp(20px,5vw,80px) 40px;
                max-width:1400px;margin:0 auto">
```

**Header**

- Eyebrow `Mehr als eine Trefferliste` — `font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;color:#ff8a4e;font-weight:500`
- H2 `Ein Scout, der euch versteht.` `<br>` `Und dranbleibt.` — `margin:18px 0 0;font-size:clamp(36px,5vw,68px);line-height:1.04;font-weight:400;letter-spacing:-.03em;text-wrap:balance`
- P `Eure Wünsche, eure Gespräche und eure Suche bleiben zusammen.` — `margin:16px 0 0;font-size:clamp(17px,1.4vw,20px);color:#cbb9a8`

**Grids**

- Top row: `margin-top:40px;display:grid;grid-template-columns:{{ bentoTop }};gap:18px` — `bentoTop` = `narrow ? '1fr' : 'minmax(0,1.5fr) minmax(0,1fr)'`
- Bottom row: `margin-top:18px;display:grid;grid-template-columns:{{ bentoBottom }};gap:18px` — `bentoBottom` = `narrow ? '1fr' : 'minmax(0,1fr) minmax(0,1.5fr)'`

All four cards share: `background:rgba(18,14,12,.66);border:1px solid rgba(255,200,160,.14);border-radius:26px;transition:transform .3s` and `style-hover="transform:translateY(-3px)"`. Card padding `32px 34px` (card A puts it on its inner text column instead, which is `padding:32px 34px;min-width:0` — the `min-width:0` is required, it is a grid child of `memCols`).
Card titles: `font-size:clamp(22px,1.9vw,27px);font-weight:500;letter-spacing:-.01em`; card subtitles: `margin-top:6px;font-size:16px;color:#cbb9a8`.
**All eight of these title/subtitle elements are plain `<div>`s** (lines 176, 187, 196, 206) — there is no `h3`/`p` anywhere in the bento. Keep them as `<div>`s (or map them to `CardTitle`/`CardDescription` configured to render a `div`) so the document outline in §1.8 stays intact.

**shadcn candidate for all four:** `Card` with `CardHeader`/`CardTitle`/`CardDescription`/`CardContent`; hover lift via a utility class.

### 10.1 Card A — “Merkt sich, was euch wichtig ist.” (top-left, wide)

Card shell adds `overflow:hidden;display:grid;grid-template-columns:{{ memCols }}` — `memCols` = `narrow ? '1fr' : 'minmax(0,1.1fr) minmax(0,.9fr)'`.

Text column (first grid child): `padding:32px 34px;min-width:0`.

- Title `Merkt sich, was euch wichtig ist.`
- Subtitle `Auch wenn sich eure Wünsche ändern.`
- Inner panel: `margin-top:24px;border:1px solid rgba(255,200,160,.14);border-radius:16px;background:rgba(0,0,0,.25);padding:14px 18px`
  - Header row `display:flex;justify-content:space-between;font-size:12px;color:#a89684;letter-spacing:.1em;text-transform:uppercase`:
    left `Eure Wünsche`, right `{{ memStamp }}` (`letter-spacing:0;text-transform:none`)
    `memStamp` = `memSeen ? 'Aktualisiert · gerade eben' : 'Aktualisiert'`
  - **Row 1 only** carries `margin-top:8px` (it separates the panel header from the list):
    `margin-top:8px;display:flex;align-items:center;gap:12px;height:46px;border-top:1px solid rgba(255,220,190,.08);font-size:15.5px`
    20×20 “people” SVG, verbatim:
    ```html
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e2d3c3" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"></circle><circle cx="16.5" cy="9" r="2.6"></circle><path d="M3.5 19c.5-3.3 2.6-5 5.5-5s5 1.7 5.5 5"></path><path d="M15 14.4c2.6 0 4.3 1.5 4.8 4.4"></path></svg>
    ```
    → `Geteilter Raum · 4 Personen`
  - **Rows 2 and 3 have NO `margin-top`.** Their style is exactly
    `display:flex;align-items:center;gap:12px;height:46px;border-top:1px solid rgba(255,220,190,.08);font-size:15.5px`
    (adding `margin-top:8px` to them, as an earlier draft of this doc implied, inserts 16 px of unintended vertical space into the panel).
  - Row 2 — 20×20 “drum” SVG, verbatim:
    ```html
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#e2d3c3" stroke-width="1.6" stroke-linecap="round"><ellipse cx="12" cy="8" rx="8" ry="3"></ellipse><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8"></path><path d="M8 10.5v8M16 10.5v8"></path></svg>
    ```
    → `Schlagzeug darf bleiben`
  - Row 3 — `€` glyph span (`font-size:19px;width:20px;text-align:center`), then
    - old value `400 €` — `color:#a89684;text-decoration:line-through;opacity:{{ memOldOp }};transition:opacity .6s`
    - new value `350 € / Monat` — `color:{{ memNewColor }};font-weight:500;transition:color .6s`
    `memOldOp` = `memSeen ? 1 : 0`; `memNewColor` = `memSeen ? '#ff8a4e' : '#f5ece2'`
    **Trigger:** `memSeen` latches `true` the first time the bento section’s top is above `vh * 0.7`; it never resets. So the “400 € struck through, 350 € turns orange” correction plays exactly once, on first scroll-in.
- **`<sc-if value="{{ memPhoto }}">`** (`memPhoto = !narrow`): `<img src="assets/proberaum.png" alt="" style="display:block;width:100%;height:100%;object-fit:cover;min-height:280px">`

### 10.2 Card B — “Bleibt an Antworten dran.” (top-right)

- Title `Bleibt an Antworten dran.` · Subtitle `Ihr müsst nicht jedes Portal selbst prüfen.`
- Thread: `margin-top:24px;display:flex;flex-direction:column;gap:10px`
  - **Provider message** — grid `44px 1fr`, gap 12, `align-items:start`
    - avatar: `width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,220,190,.14);display:flex;align-items:center;justify-content:center;color:#e2d3c3` + 18×18 “building” SVG, verbatim (note: `stroke-linejoin` only, **no** `stroke-linecap`):
      ```html
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 21V5h9v16M13 9h7v12"></path><path d="M7 9h3M7 13h3M7 17h3M16 13h1M16 17h1"></path></svg>
      ```
    - bubble: `padding:12px 16px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,220,190,.1)`
      meta row `display:flex;justify-content:space-between;font-size:12.5px;color:#a89684` → `Anbieter` / `Heute, 14:27`
      body `margin-top:4px;font-size:15.5px` → `Mittwoch wäre noch frei.`
  - **Scout message**
    - avatar = mini blob: `width:44px;height:44px;border-radius:62% 38% 46% 54%/44% 58% 42% 56%;background:radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 60%);box-shadow:0 0 18px rgba(255,105,38,.4);display:block`
    - bubble: `padding:12px 16px;border-radius:14px;background:rgba(120,58,22,.35);border:1px solid rgba(255,140,90,.3)`
      meta `RoomScout` (`color:#ff8a4e`) / `Heute, 14:28` (`color:#a89684`), font-size 12.5px
      body `Passt Mittwoch für euch?` (15.5px)
- *shadcn candidate:* `Avatar` for the provider circle; bubbles custom.

### 10.3 Card C — “Behält eure Quellen im Blick.” (bottom-left)

Card shell adds `overflow:hidden`.

- Title `Behält eure Quellen im Blick.` · Subtitle `Passende Anzeigen an einem Ort.`
- Collage stage: `margin-top:24px;position:relative;height:170px`, four absolutely positioned pieces (all `position:absolute`).

  **Stacking:** *no* piece sets a `z-index` anywhere in this block, so painting order **is DOM order** — listing card (bottom), wanted card, shared-room card, location pill (top). This matters: the shared-room card at `left:min(300px,70%);top:24px` overlaps the wanted card at `left:min(150px,40%);top:58px`, and the pill overlaps the listing card’s bottom edge. Reordering the JSX changes the composition. The stage is clipped by the **card shell’s own `overflow:hidden`** (there is no `overflow` on the stage itself) — that is what cuts the shared-room card off at the card edge on narrow widths.

  1. **Listing card** `left:0;top:0;width:min(300px,78%);display:grid;grid-template-columns:96px 1fr;gap:12px;padding:10px;border-radius:14px;background:rgba(0,0,0,.35);border:1px solid rgba(255,200,160,.16)`
     - thumb `<img src="assets/proberaum.png" alt="" style="width:96px;height:78px;object-fit:cover;border-radius:8px">`
     - label `<div style="font-size:14.5px">Angebot · Stuttgart-West</div>` — **no icon, no flex** (the only one of the three labels without them)
     - two skeleton bars `height:6px;border-radius:3px;background:rgba(255,255,255,.12)` at `width:80%` (`margin-top:8px`) and `60%` (`margin-top:6px`)
     *shadcn candidate:* `Skeleton` for the bars.
  2. **Wanted card** `left:min(150px,40%);top:58px;width:min(240px,62%);padding:12px 14px;border-radius:14px;background:rgba(10,8,7,.9);border:1px solid rgba(255,200,160,.14)`
     - label row `<div style="font-size:14.5px;display:flex;align-items:center;gap:8px">` + 16×16 document SVG + `Gesuch · Band sucht Raum`:
       ```html
       <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"></path></svg>
       ```
     - bars at `width:70%` (`margin-top:8px`) / `width:50%` (`margin-top:6px`)
  3. **Shared-room card** `left:min(300px,70%);top:24px;width:150px;padding:12px 14px;border-radius:14px;background:rgba(10,8,7,.85);border:1px solid rgba(255,200,160,.12)`
     - label row `<div style="font-size:13.5px;display:flex;align-items:center;gap:8px">` + 15×15 house SVG + `Geteilter Raum`:
       ```html
       <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"></path></svg>
       ```
     - one bar at `width:75%` (`margin-top:8px`)
  4. **Location pill** `left:0;bottom:0;height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,200,160,.18);background:rgba(20,14,10,.7);display:flex;align-items:center;gap:8px;font-size:14px` (the flex/gap live on the pill itself) with a 16×16 map-pin SVG → `Stuttgart`:
     ```html
     <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"></path><circle cx="12" cy="11" r="2"></circle></svg>
     ```
     *shadcn candidate:* `Badge variant="outline"`.
  *(No animation on this collage — it is a static composition.)*

### 10.4 Card D — “Übernimmt Arbeit. Nicht eure Entscheidung.” (bottom-right, wide)

Card shell adds `position:relative;overflow:hidden`.

- **Decorative blob** `position:absolute;right:-40px;top:50%;transform:translateY(-50%);width:220px;height:220px;border-radius:62% 38% 46% 54%/44% 58% 42% 56%;background:radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 58%,#e9511a);box-shadow:0 0 60px 10px rgba(255,105,38,.35);opacity:.9;animation:rsBreathe 6s ease-in-out infinite`
- Content wrapper `position:relative;max-width:66%`
  - Title `Übernimmt Arbeit. Nicht eure Entscheidung.`
  - Subtitle `Anfragen laufen im Autopilot. Verbindliche Zusagen bleiben bei euch.`
  - Permission panel `margin-top:24px;border:1px solid rgba(255,200,160,.14);border-radius:16px;background:rgba(0,0,0,.3);padding:6px 18px`
    - Row 1 `display:grid;grid-template-columns:36px 1fr;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,220,190,.08)`
      icon: filled orange circle `width:34px;height:34px;border-radius:50%;background:#ff6926;display:flex;align-items:center;justify-content:center;color:#fff` with a 16×16 check SVG — same `d` as the offer check but `currentColor` and heavier stroke:
      ```html
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>
      ```
      title `Anbieter kontaktieren` (15.5px) · sub `Darf RoomScout für euch übernehmen.` (13.5px, `#a89684`)
    - Row 2 `display:grid;grid-template-columns:36px 1fr;gap:14px;align-items:center;padding:12px 0` (no border-bottom)
      icon: outlined circle `width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,220,190,.25);display:flex;align-items:center;justify-content:center;color:#f5ece2` with a 15×15 padlock SVG:
      ```html
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>
      ```
      title `Verbindlich zusagen` · sub `Bleibt immer bei euch.`
    *shadcn candidate:* rows resemble a `Switch`-less permission list — use `Card` + `Separator`; the check/lock circles are custom (icons from `lucide-react`).
  - Link `<a href="#control" style="display:inline-block;margin-top:18px;font-size:15px;color:#f5ece2;text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(255,140,90,.6)">` copy `So behaltet ihr die Kontrolle ↓`

---

## 11. Kontrolle & FAQ (`#control`, no `data-sec`)

```html
<section id="control" style="position:relative;z-index:2;scroll-margin-top:70px;
         padding:110px clamp(20px,5vw,80px) 40px;max-width:1400px;margin:0 auto;
         display:grid;grid-template-columns:{{ faqCols }};gap:clamp(30px,5vw,80px);align-items:start">
```

`faqCols` = `narrow ? '1fr' : 'minmax(0,.9fr) minmax(0,1.1fr)'`

**Left column**

- Eyebrow `Klar geregelt` — `font-size:12.5px;letter-spacing:.18em;text-transform:uppercase;color:#ff8a4e;font-weight:500`
- H2 `Euer Scout übernimmt.` `<br>` `Ihr behaltet das letzte Wort.` — `margin:18px 0 0;font-size:clamp(32px,3.8vw,54px);line-height:1.06;font-weight:400;letter-spacing:-.03em;text-wrap:balance`
- P `Ihr bestimmt, wo gesucht wird, was der Scout übernehmen darf und was er sich merkt.` — `margin:22px 0 0;font-size:17px;line-height:1.6;color:#cbb9a8;max-width:460px;text-wrap:pretty`

**Right column — accordion** (`display:flex;flex-direction:column;gap:12px`, `<sc-for list="{{ faqs }}" as="q" hint-placeholder-count="3">`). The question is a **`<span>` inside the `<button>`** and the answer a **`<div>`** — neither is a heading (see §1.8); shadcn’s `AccordionTrigger` wraps its child in a `<h3>` by default, so override that if the outline must match.

```html
<div style="border-radius:18px;border:1px solid {{ q.border }};background:rgba(18,14,12,.6);transition:border-color .3s">
  <button onClick="{{ q.toggle }}" aria-expanded="{{ q.open }}"
          style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;
                 border:0;background:none;color:#f5ece2;font:inherit;font-size:clamp(18px,1.5vw,22px);
                 text-align:left;cursor:pointer;border-radius:18px">
    <span>{{ q.q }}</span>
    <span style="width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,220,190,.3);
                 display:flex;align-items:center;justify-content:center;flex:none;
                 transition:transform .3s;transform:{{ q.rot }}">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M5 12h14"></path><path d="M12 5v14" style="opacity:{{ q.plusOp }}"></path>
      </svg>
    </span>
  </button>
  <div style="display:grid;grid-template-rows:{{ q.rows }};transition:grid-template-rows .32s cubic-bezier(.3,.7,.2,1)">
    <div style="overflow:hidden;min-height:0">
      <div style="padding:0 26px 24px;font-size:16px;line-height:1.6;color:#cbb9a8">{{ q.a }}</div>
    </div>
  </div>
</div>
```

| Binding | open | closed |
| --- | --- | --- |
| `q.rows` | `1fr` | `0fr` |
| `q.border` | `rgba(255,105,38,.7)` | `rgba(255,200,160,.14)` |
| `q.rot` | `rotate(180deg)` | `none` |
| `q.plusOp` | `0` (icon becomes a minus) | `1` (plus) |

`toggle: () => this.setState(st => ({ faq: st.faq === i ? -1 : i }))` — single-open accordion, **item 0 open on load** (`faq: 0` in the initial state).

**FAQ items (verbatim)**

1. **Q** `Was darf der Scout selbstständig tun?`
   **A** `Er recherchiert und fragt unverbindlich an — innerhalb eures Suchauftrags. Verbindliche Zusagen, Buchungen und Zahlungen entscheidet ihr selbst. Quellen, Handlungsspielraum und Erinnerungen könnt ihr in den Einstellungen prüfen und ändern.`
2. **Q** `Muss ich mit dem Scout sprechen?`
   **A** `Nein. Ihr könnt sprechen oder schreiben. Beides gehört zur selben Suche.`
3. **Q** `Funktioniert das schon auf allen Portalen?`
   **A** `Noch nicht. Die aktuelle Demo zeigt den Ablauf auf einem von uns kontrollierten Testportal. Öffentliche Quellen und ihre Kontaktwege werden schrittweise geprüft und angebunden. In dieser Demo kontaktieren wir keine fremden Anbieter.`

*shadcn candidate:* `Accordion` (`type="single"`, `collapsible`, `defaultValue="item-0"`) with a custom `AccordionTrigger` icon (the circled plus/minus with 180° rotation replaces the default chevron). Note the prototype animates `grid-template-rows` 0fr→1fr; shadcn’s Radix accordion uses a height keyframe — either is acceptable, but keep the `.32s cubic-bezier(.3,.7,.2,1)` timing.

---

## 12. Closing CTA + footer (one `<section>`, no `data-sec`)

```html
<section style="position:relative;z-index:2;padding:100px 24px 0;display:flex;flex-direction:column;
         align-items:center;text-align:center">
```

1. **Demo disclaimer**: `Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter.` — `font-size:15px;color:#cbb9a8`
2. **Static blob** (`aria-hidden="true"`, not the travelling one):
   `margin-top:44px;width:86px;height:86px;border-radius:62% 38% 46% 54%/44% 58% 42% 56%;background:radial-gradient(circle at 42% 38%,#ffc39a 0%,#ff8a4e 28%,#ff6926 58%,#e9511a 100%);box-shadow:0 0 30px 6px rgba(255,120,50,.35),0 0 90px 16px rgba(255,105,38,.18);animation:rsBreathe 5.2s ease-in-out infinite`
3. **H2**: `Bereit für euren nächsten Proberaum?` — `margin:34px 0 0;font-size:clamp(36px,5vw,66px);line-height:1.04;font-weight:300;letter-spacing:-.03em;text-wrap:balance`
4. **CTA row** `margin-top:34px;display:flex;align-items:center;gap:26px;flex-wrap:wrap;justify-content:center`
   - Primary `<a href="Roomscout.dc.html">` copy `Demo ausprobieren` —
     `height:58px;padding:0 34px;border-radius:999px;background:#ff6926;color:#fff;font-size:17px;font-weight:600;text-decoration:none;display:flex;align-items:center;box-shadow:0 8px 32px rgba(255,105,38,.28)`, hover `background:#ff7a3d;color:#fff`
   - Secondary `<a href="https://github.com/Finchmedia/roomscout" target="_blank" rel="noopener">` copy `Projekt ansehen ↗` — `font-size:16px;color:#f5ece2;text-decoration:none`
5. **Footer** (`<footer>` nested inside the same section)
   `margin-top:90px;width:min(1400px,100%);padding:26px clamp(20px,5vw,80px) 30px;border-top:1px solid rgba(255,220,190,.12);display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;font-size:14px;color:#a89684`
   - **Left group** `display:flex;align-items:center;gap:18px`
     - wordmark `roomscout` — `font-size:17px;font-weight:500;letter-spacing:.04em;color:#f5ece2`
     - divider `width:1px;height:18px;background:rgba(255,220,190,.2)` → *shadcn candidate:* `Separator orientation="vertical"`
     - tagline `Ein persönlicher Scout für eure Proberaumsuche.`
   - **Right group** `display:flex;flex-direction:column;align-items:flex-end;gap:8px`
     - link `<a href="https://github.com/Finchmedia/roomscout" target="_blank" rel="noopener" style="color:#e2d3c3;text-decoration:none">` copy `GitHub`
     - credit `Entstanden beim Convex All Gas Hackathon.` — `font-size:13px`

> **There is no sponsor/logo strip on Landing v2.** No `assets/logo-*` and no `uploads/*` file is referenced anywhere in `Landing v2.dc.html` (verified by grep). The sponsor logos that exist in the prototype folder are used by **`Operator.dc.html`** (`assets/logo-openai.svg`, `logo-convex.svg`, `logo-firecrawl.svg`, `logo-browserbase.png`, `logo-agentmail.png`, `logo-roomscout.png`) and `Settings.dc.html` (`assets/logo-roomscout.png`). If a partner strip is wanted on the landing page it must be designed — it is **not** in this source. See “Open questions”.

---

## 13. Responsive / `narrow` (`window.innerWidth < 880`) variant table

| Binding | wide (≥ 880 px) | narrow (< 880 px) |
| --- | --- | --- |
| `introCols` | `minmax(0,1.6fr) minmax(260px,.8fr)` | `1fr` |
| `convoCols` | `minmax(140px,.7fr) minmax(0,1.6fr) minmax(220px,.9fr)` | `minmax(90px,.4fr) minmax(0,1.6fr)` |
| `convoAlign` | `center` | `flex-start` |
| `listDisplay` (live fact list) | `block` | `none` |
| `offerCols` | `minmax(0,1fr) minmax(0,1.05fr)` | `1fr` |
| `offerImgMin` | `360` px | `220` px |
| `bentoTop` | `minmax(0,1.5fr) minmax(0,1fr)` | `1fr` |
| `bentoBottom` | `minmax(0,1fr) minmax(0,1.5fr)` | `1fr` |
| `memCols` (card A) | `minmax(0,1.1fr) minmax(0,.9fr)` | `1fr` |
| `memPhoto` (card A image) | shown | hidden |
| `faqCols` | `minmax(0,.9fr) minmax(0,1.1fr)` | `1fr` |

Everything else scales purely through `clamp()` / `min()` / `vw` / `vh` units — no media queries other than the reduced-motion one. **Gaps to resolve in the port:** the header nav is not collapsed on narrow (three anchors + CTA in a 3-column grid at 320 px will overflow) and card D’s `max-width:66%` text column is not relaxed on narrow (the decorative blob keeps its `220px` size). Recommend a `Sheet`-based mobile nav and `max-width:100%` for card D below 880 px.

---

## 14. Complete state-dependent variant list

| Variant | Trigger | Affects |
| --- | --- | --- |
| **Header compact** | `scrollY > 40` | `hdrH 80→64`, `hdrBg transparent→rgba(11,10,9,.72)`, `hdrBlur none→blur(12px)`, `hdrLine transparent→rgba(255,220,190,.1)` |
| **Narrow layout** | `innerWidth < 880` | see §13 |
| **Blob mode: listening** | `active === 1 && !cardOn` | `animation:rsListen 4.2s ease-in-out infinite` |
| **Blob mode: idle** | everything else | `animation:rsBreathe 5.2s ease-in-out infinite` |
| **Blob hidden** | `active === 5` — i.e. the bento **and** everything after it (`#control`, closing CTA, footer), because no `[data-blob-anchor="5"]` exists | `opacity:0`. Note `#how` is **not** in this list: it runs with `active === 0`, so the blob stays visible and tracks the hero-preview anchor off the top of the screen (§2.3) |
| **Blob lag/free-follow** | anchor has `data-blob-lag="1"` (anchors 1 and 4) | blob keeps easing (`.9s`) while scrolling *within* the section instead of only on section change |
| **Line revealed / chip shown / chip moved** | `p` thresholds in §6.1 | per-line opacity/transform, chip flight |
| **Fact overwritten** | `budget` written twice | row background `rgba(255,105,38,.2)` + colour `#ffd9c4` while `inConvo && p < 0.68` |
| **Suchauftrag card in** | `p ≥ 0.69` in section 1 | conversation + fact list fade out & shift; card scales `.92 → 1` |
| **Status 1/2/3** | `floor(p*3)` in section 2 | vertical cross-fade `±10px` |
| **Rückfrage revealed** | `p > 0.22` in section 3 | clarify card in |
| **Rückfrage answered by scroll** | `p > 0.45` / `p > 0.6` | user bubble, then scout reply; choice buttons disappear (`clarOpen` false) |
| **Rückfrage answered by click — Mittwoch** | `clar === 'mi'` | `ansText` `Mittwoch passt auch.`, `repText` `Alles klar, Mittwoch geht also auch. Ich kläre den Rest.`, offer card normal |
| **Rückfrage answered by click — Donnerstag (alt path)** | `clar === 'do'` | `ansText` `Donnerstag bleibt wichtig.`, `repText` `Alles klar. Ich suche weiter nach Donnerstag.`, reset link appears, **offer card opacity locked at 0.35** |
| **Reset to main path** | click `Beispiel fortsetzen (Mittwoch-Pfad)` | `clar = 'mi'` → alt UI disappears, offer card returns to full opacity |
| **Offer revealed** | `p > 0.15` in section 4 | opacity/visibility/`translateY(24px)→none` |
| **Memory correction played** | `memSeen` latched when bento top `< vh*0.7` | `memStamp` `Aktualisiert` → `Aktualisiert · gerade eben`; `400 €` strikethrough fades in (`opacity 0→1`); `350 € / Monat` `#f5ece2 → #ff8a4e` |
| **FAQ open item** | `faq === i` (init `0`), toggle sets `-1` when re-clicking | border, icon rotation, plus→minus, `grid-template-rows 0fr→1fr` |
| **Reduced motion** | `prefers-reduced-motion: reduce` | see §2.4 |

There is **no** voice-vs-text variant, no paused state, no editing state and no `mobile` editor prop on this surface (those live in `Roomscout.dc.html` / `Settings.dc.html` / `Operator.dc.html`).

---

## 15. Assets referenced by Landing v2

| Path in prototype | Type / size | Used by | Port note |
| --- | --- | --- | --- |
| `assets/bg.jpg` | JPEG 3856×5152, 3.4 MB | fixed background layer (mirrored, desaturated, darkened, parallaxed) | must be resized + `.avif/.webp` with `srcset`; identical file also at `uploads/room-page-background.jpg` |
| `assets/grain.svg` | SVG 220×220 noise tile, 8 KB | grain overlay, `mix-blend-mode:overlay`, `opacity:.28` | ship as-is (strip the C2PA metadata block) |
| `assets/hero-preview.png` | PNG 1586×992, 1.5 MB | hero screenshot | re-shoot from the real app once the workspace UI is ported; the blob region is masked over at `left:37%/top:12%/26%×30%` and re-drawn live, so keep the blob roughly centred at `~50% / ~24%` |
| `assets/proberaum.png` | PNG 1096×880, 1.4 MB | offer card image, bento card A image, bento card C thumbnail | needs alt text per usage: offer → `Proberaum mit Schlagzeug und Akustikpaneelen`; the two bento usages are decorative (`alt=""`) |
| `assets/logo-*.svg/.png` | — | **not used on this page** (Operator/Settings only) | see §12 |
| `uploads/*` | — | **not used on this page** | `uploads/01-hero.png`, `04-autopilot.png`, `03-bento.png` etc. are design references, not shipped assets |

Font: Geist via Google Fonts (`wght 300;400;500;600`). Port should self-host (`@fontsource/geist-sans` or local woff2) rather than hit `fonts.googleapis.com`.

---

## 16. shadcn mapping summary

| Landing element | shadcn component |
| --- | --- |
| Header CTA `Demo starten`, hero CTA, `Scout losschicken`, `Angebot prüfen`, closing CTA | `Button` (`asChild` + `rounded-full`, brand variant) |
| Text links `So funktioniert’s ↓`, `Weiter zu den Funktionen ↓`, `So behaltet ihr die Kontrolle ↓`, `Projekt ansehen ↗` | `Button variant="link"` — **but** these four have *no* hover state in the source (inline `color` beats `a:hover`, §3.1); strip the variant’s hover or accept a deliberate deviation |
| `Beispiel fortsetzen (Mittwoch-Pfad)` | `Button variant="link"` — this one *does* have a hover (`style-hover="color:#fff"`) |
| Header nav | `NavigationMenu` (desktop) + `Sheet` (mobile, to be added) |
| Hero eyebrow pill, `Beispielansicht`, `Stuttgart · bis 350 €`, `Stuttgart` pill, chips in the conversation | `Badge` (`variant="outline"` / brand tint) |
| Hero preview frame, Suchauftrag card, clarify card, offer card, all bento cards, permission panel | `Card` (+ `CardHeader` / `CardTitle` / `CardDescription` / `CardContent` / `CardFooter`) |
| FAQ | `Accordion type="single" collapsible defaultValue="item-0"` with a custom trigger icon |
| Footer vertical rule, bento panel row dividers | `Separator` |
| Provider avatar in bento card B | `Avatar` (`AvatarFallback` with the building icon) |
| Skeleton bars in bento card C | `Skeleton` |
| Rückfrage choice buttons | `Button variant="secondary"` / `variant="outline"` |
| Travelling blob, background layers, hero 3-D tilt, chip-flight, status cross-fader, bento collage, memory strike-through | **custom** |

---

## 17. Copy dictionary (DE)

> Keys are stable semantic identifiers grouped by section. `landing.` prefix assumed for the whole surface. Strings are verbatim from `Landing v2.dc.html`, including `’`, `·`, `–`, `—`, `↓`, `↗`, `€`, and `&`.

### 17.1 Header

```
header.wordmark:               "roomscout"
header.nav.how:                "So funktioniert’s"
header.nav.features:           "Dein Scout"
header.cta.demo:               "Demo starten"
```

### 17.2 Hero

```
hero.eyebrow:                  "Euer persönlicher Proberaum-Scout"
hero.headline.line1:           "Ihr macht Musik."
hero.headline.line2:           "Der Scout sucht den Raum."
hero.subline:                  "Erzählt, was ihr sucht. RoomScout übernimmt die Suche und klärt mit Anbietern, ob der Raum zu euch passt."
hero.cta.primary:              "Demo ausprobieren"
hero.cta.secondary:            "So funktioniert’s"
hero.cta.secondary.arrow:      "↓"
hero.disclaimer:               "Früher Prototyp · Kontrollierte Demo"
hero.preview.alt:              "Beispielansicht der RoomScout-App: Der Scout arbeitet und wartet auf eine Antwort."
hero.preview.badge:            "Beispielansicht"
```

### 17.3 Intro „So funktioniert RoomScout“

```
how.eyebrow:                   "So funktioniert RoomScout"
how.headline.line1:            "Ein Gespräch."
how.headline.line2:            "Dann übernimmt euer Scout."
how.lead:                      "Von euren Wünschen bis zum konkreten Angebot."
how.link.features:             "Weiter zu den Funktionen ↓"
```

### 17.4 Beat 1 — Gespräch

```
convo.status.listening:        "Ich höre zu"
convo.speaker.user:            "Du"
convo.line1:                   "Wir sind zu viert und suchen einen geteilten Proberaum in Stuttgart."
convo.line2:                   "Bis 400 Euro im Monat. Unser Schlagzeug soll dort bleiben können."
convo.line3:                   "Am liebsten donnerstags ab 19 Uhr."
convo.line4:                   "Eigentlich lieber maximal 350 Euro."
fact.ort:                      "Stuttgart & Umgebung"
fact.band:                     "Geteilter Raum · 4 Personen"
fact.budget.initial:           "Bis 400 € / Monat"
fact.budget.corrected:         "Bis 350 € / Monat"
fact.zeit:                     "Donnerstags ab 19 Uhr"
fact.equip:                    "Schlagzeug darf im Raum bleiben"
brief.panel.title:             "Euer Suchauftrag"
brief.panel.caption:           "Während ihr sprecht, merke ich mir, was zählt. Korrekturen ersetzen den alten Wert."
```

### 17.5 Beat 2 — Suchauftrag-Karte

```
brief.card.title:              "So suche ich für euch."
brief.card.heading:            "Euer Suchauftrag"
brief.card.row1:               "Stuttgart & Umgebung"
brief.card.row2:               "Bis 350 € / Monat"
brief.card.row3:               "Geteilter Raum · 4 Personen"
brief.card.row4:               "Donnerstags ab 19 Uhr"
brief.card.row5:               "Schlagzeug darf im Raum bleiben"
brief.card.cta:                "Scout losschicken"
brief.card.note.line1:         "Ich suche und frage selbstständig an."
brief.card.note.line2:         "Eine verbindliche Zusage gebt nur ihr."
```

### 17.6 Beat 3 — Der Scout arbeitet

```
work.headline:                 "Ich kümmere mich darum."
work.status1:                  "Ich suche passende Räume."
work.status2:                  "Ich kläre die offenen Fragen mit dem Anbieter."
work.status3:                  "Die Anfrage ist raus. Ich warte auf eine Antwort."
work.context.pill:             "Stuttgart · bis 350 €"
work.reassurance:              "Ihr könnt die App schließen. Ich melde mich, wenn ich euch brauche."
```

### 17.7 Beat 4 — Rückfrage

```
clarify.headline:              "Nur echte Entscheidungen kommen zu euch."
clarify.card.kicker:           "Dein Scout"
clarify.card.question:         "Ein Raum passt zu euch. Donnerstag ist schon belegt — wäre Mittwoch ab 19 Uhr auch möglich?"
clarify.choice.wednesday:      "Mittwoch passt"
clarify.choice.thursday:       "Donnerstag bleibt wichtig"
clarify.answer.wednesday:      "Mittwoch passt auch."
clarify.answer.thursday:       "Donnerstag bleibt wichtig."
clarify.reply.wednesday:       "Alles klar, Mittwoch geht also auch. Ich kläre den Rest."
clarify.reply.thursday:        "Alles klar. Ich suche weiter nach Donnerstag."
clarify.resume:                "Beispiel fortsetzen (Mittwoch-Pfad)"
```

### 17.8 Beat 5 — Angebot

```
offer.headline:                "Ein Raum, der zu euch passt."
offer.image.alt:               "Proberaum mit Schlagzeug und Akustikpaneelen"
offer.eyebrow:                 "Beispielangebot"
offer.title:                   "Stuttgart-West · Geteilter Proberaum"
offer.price.amount:            "280 €"
offer.price.period:            "/ Monat"
offer.price.note:              "inklusive Nebenkosten"
offer.feature1:                "Mittwochs, 19–22 Uhr"
offer.feature2:                "Schlagzeug kann im Raum bleiben"
offer.cta:                     "Angebot prüfen"
offer.note:                    "Eine verbindliche Zusage gebt nur ihr."
offer.footnote:                "Beispielsuche · Ablauf verkürzt dargestellt"
```

### 17.9 Feature-Bento

```
features.eyebrow:              "Mehr als eine Trefferliste"
features.headline.line1:       "Ein Scout, der euch versteht."
features.headline.line2:       "Und dranbleibt."
features.lead:                 "Eure Wünsche, eure Gespräche und eure Suche bleiben zusammen."

features.memory.title:         "Merkt sich, was euch wichtig ist."
features.memory.subtitle:      "Auch wenn sich eure Wünsche ändern."
features.memory.panel.label:   "Eure Wünsche"
features.memory.stamp.idle:    "Aktualisiert"
features.memory.stamp.updated: "Aktualisiert · gerade eben"
features.memory.row.band:      "Geteilter Raum · 4 Personen"
features.memory.row.equip:     "Schlagzeug darf bleiben"
features.memory.row.budget.old:"400 €"
features.memory.row.budget.new:"350 € / Monat"

features.followup.title:       "Bleibt an Antworten dran."
features.followup.subtitle:    "Ihr müsst nicht jedes Portal selbst prüfen."
features.followup.msg1.sender: "Anbieter"
features.followup.msg1.time:   "Heute, 14:27"
features.followup.msg1.body:   "Mittwoch wäre noch frei."
features.followup.msg2.sender: "RoomScout"
features.followup.msg2.time:   "Heute, 14:28"
features.followup.msg2.body:   "Passt Mittwoch für euch?"

features.sources.title:        "Behält eure Quellen im Blick."
features.sources.subtitle:     "Passende Anzeigen an einem Ort."
features.sources.card.listing: "Angebot · Stuttgart-West"
features.sources.card.wanted:  "Gesuch · Band sucht Raum"
features.sources.card.shared:  "Geteilter Raum"
features.sources.pill.city:    "Stuttgart"

features.autopilot.title:      "Übernimmt Arbeit. Nicht eure Entscheidung."
features.autopilot.subtitle:   "Anfragen laufen im Autopilot. Verbindliche Zusagen bleiben bei euch."
features.autopilot.row1.title: "Anbieter kontaktieren"
features.autopilot.row1.sub:   "Darf RoomScout für euch übernehmen."
features.autopilot.row2.title: "Verbindlich zusagen"
features.autopilot.row2.sub:   "Bleibt immer bei euch."
features.autopilot.link:       "So behaltet ihr die Kontrolle ↓"
```

### 17.10 Kontrolle & FAQ

```
control.eyebrow:               "Klar geregelt"
control.headline.line1:        "Euer Scout übernimmt."
control.headline.line2:        "Ihr behaltet das letzte Wort."
control.lead:                  "Ihr bestimmt, wo gesucht wird, was der Scout übernehmen darf und was er sich merkt."
faq.q1:                        "Was darf der Scout selbstständig tun?"
faq.a1:                        "Er recherchiert und fragt unverbindlich an — innerhalb eures Suchauftrags. Verbindliche Zusagen, Buchungen und Zahlungen entscheidet ihr selbst. Quellen, Handlungsspielraum und Erinnerungen könnt ihr in den Einstellungen prüfen und ändern."
faq.q2:                        "Muss ich mit dem Scout sprechen?"
faq.a2:                        "Nein. Ihr könnt sprechen oder schreiben. Beides gehört zur selben Suche."
faq.q3:                        "Funktioniert das schon auf allen Portalen?"
faq.a3:                        "Noch nicht. Die aktuelle Demo zeigt den Ablauf auf einem von uns kontrollierten Testportal. Öffentliche Quellen und ihre Kontaktwege werden schrittweise geprüft und angebunden. In dieser Demo kontaktieren wir keine fremden Anbieter."
```

### 17.11 Abschluss & Footer

```
closing.disclaimer:            "Aktuell: kontrollierte Demo. Keine Anfragen an fremde Anbieter."
closing.headline:              "Bereit für euren nächsten Proberaum?"
closing.cta.primary:           "Demo ausprobieren"
closing.cta.secondary:         "Projekt ansehen ↗"
footer.wordmark:               "roomscout"
footer.tagline:                "Ein persönlicher Scout für eure Proberaumsuche."
footer.link.github:            "GitHub"
footer.credit:                 "Entstanden beim Convex All Gas Hackathon."
```

### 17.12 Strings that exist only in v1 (`Landing.dc.html`) — kept for reference, **not** part of v2

Complete list (every string that appears in `Landing.dc.html` but not in `Landing v2.dc.html`), verbatim:

```
v1.header.cta:                 "Prototyp ansehen"

v1.hero.talkBubble:            "„Hey! Erzählt mir kurz, wo ihr sucht und was euch wichtig ist.“"
v1.hero.headline:              "Du erzählst.\nDein Scout kümmert sich."
v1.hero.subline:               "Ein persönlicher Scout, der für eure Band den Proberaum findet, Anbieter anfragt und nur mit echten Entscheidungen zu euch zurückkommt."
v1.hero.cta:                   "Mit Scout sprechen"
v1.hero.scrollHint:            "Scrollen"

v1.convo.line1:                "Wir sind zu viert und suchen einen geteilten Raum in Stuttgart. Bis 350 Euro im Monat."
v1.convo.line2:                "Donnerstags ab 19 Uhr wäre gut."
v1.convo.line3:                "Unser Schlagzeug muss dort stehen bleiben können."
v1.fact.ort:                   "Stuttgart"                       # v2 says "Stuttgart & Umgebung"
v1.brief.panel.caption:        "Während ihr sprecht, merke ich mir, was zählt. Ihr seht es sofort."

v1.work.status1:               "Ich suche nach passenden Räumen in Stuttgart."
v1.work.status2:               "Ein Raum in Stuttgart-West könnte passen. Ich prüfe die Details."
v1.work.status3:               "Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann."
v1.work.status4:               "Jetzt warte ich auf eine Antwort."
v1.work.reassurance:           "Keine Ergebnislisten, kein Dashboard. Ihr könnt die App schließen. Ich melde mich, wenn ich euch brauche."

v1.clarify.headline:           "Nur echte Entscheidungen\nkommen zu euch."     # v1 has a <br>, v2 does not
v1.clarify.card.kicker:        "Raum in Stuttgart-West"
v1.clarify.card.question:      "Donnerstag ist leider belegt. Wäre Mittwoch ab 19 Uhr auch möglich?"
v1.clarify.card.detail:        "280 € inklusive Nebenkosten. Euer Schlagzeug kann im Raum bleiben."
v1.clarify.answer:             "Ja, Mittwoch passt auch."                     # v1 is non-interactive: one fixed answer
v1.clarify.reply:              "Alles klar, Mittwoch geht also auch. Ich kläre den Rest."   # identical string in v2

v1.offer.eyebrow:              "Angebot eingegangen"
v1.offer.title:                "Euer Raum in Stuttgart-West"
v1.offer.note:                 "Ich frage an, kläre Details und hole das Angebot ein. Eine verbindliche Zusage gibst nur du."

v1.control.headline:           "Wenn ihr genauer hinschauen wollt, findet ihr verständliche Kontrolle."
v1.control.01.num:             "01"
v1.control.01.title:           "Wo darf dein Scout suchen?"
v1.control.01.text:            "Quellen und Portalzugänge wählt ihr selbst. Eine Quelle auszuschließen löscht keinen Account."
v1.control.02.num:             "02"
v1.control.02.title:           "Wie selbstständig geht er vor?"
v1.control.02.text:            "Autopilot oder mit Rücksprache. Verträge, Buchungen und Zahlungen brauchen immer eure Freigabe."
v1.control.03.num:             "03"
v1.control.03.title:           "Was merkt er sich?"
v1.control.03.text:            "Alles, was der Scout über euch weiß, ist lesbar, korrigierbar und lässt sich zurücknehmen."

v1.closing.headline:           "Finden wir euren Proberaum."
v1.waitlist.placeholder:       "E-Mail für die Warteliste"      # also the input's aria-label
v1.waitlist.submit.idle:       "Eintragen"
v1.waitlist.submit.done:       "Eingetragen"
v1.waitlist.note.idle:         "Kein Newsletter. Nur eine Nachricht, wenn RoomScout startet."
v1.waitlist.note.done:         "Designstudie: Es wurde nichts gesendet. Danke fürs Ausprobieren."
v1.footer.left:                "roomscout · Designstudie"
v1.footer.links:               "Prototyp" | "Impressum" | "Datenschutz"
```

Strings that are **identical in both versions** (so they are *not* “v1-only”): `Ich höre zu`, `Du`, `Euer Suchauftrag`, `Donnerstags ab 19 Uhr`, `Schlagzeug darf im Raum bleiben`, `Geteilter Raum · 4 Personen`, `Bis 350 € / Monat`, `Ich kümmere mich darum.`, `Ein Raum, der zu euch passt.`, `280 €` / `/ Monat`, `Mittwochs, 19–22 Uhr`, `Schlagzeug kann im Raum bleiben`, `Proberaum mit Schlagzeug und Akustikpaneelen` (offer image alt), `roomscout`, and `Alles klar, Mittwoch geht also auch. Ich kläre den Rest.`

---

## 18. Link targets to re-map in the port

| Prototype href | Port target |
| --- | --- |
| `Roomscout.dc.html` (header CTA, hero CTA, offer CTA, closing CTA) | the app workspace route (e.g. `/app` / `/scout`) |
| `#top`, `#how`, `#work`, `#features`, `#control` | in-page anchors — keep IDs and the `scroll-margin-top` values (60 / 0 / 70 / 70) |
| `https://github.com/Finchmedia/roomscout` (closing secondary + footer) | unchanged, `target="_blank" rel="noopener"` |
