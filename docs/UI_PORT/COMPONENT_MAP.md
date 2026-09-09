# RoomScout — Component map (prototype → shadcn/ui → `src/`)

**Inputs:** [`SCOUT_SCREENS.md`](./SCOUT_SCREENS.md) · [`SETTINGS_SCREENS.md`](./SETTINGS_SCREENS.md) · [`OPERATOR_SCREENS.md`](./OPERATOR_SCREENS.md) · [`LANDING_SCREENS.md`](./LANDING_SCREENS.md) · [`TOKENS.md`](./TOKENS.md) + [`tokens.proposed.css`](./tokens.proposed.css)
**Target:** React 19 + Vite + TS + Tailwind v4 + shadcn/ui (`components.json`: style `new-york`, base `neutral`, cssVariables `true`, ui alias `@/components/ui`), branch `ui-port`.
**Purpose:** one consolidated list of every recurring UI atom/molecule in the prototype, what to build it from, what to install, where the files go, how it moves, and how DE/EN copy is wired.

> This document does **not** restate screen layouts or copy. Every German string lives verbatim in the four screen docs; where a string is quoted here it is quoted verbatim as an identifier for the element, never paraphrased.

---

## 0 · Legend & conventions

**Surface legend** (same as TOKENS.md): `R` = Roomscout (Scout shell) · `S` = Settings · `O` = Operator · `L` = Landing v2.

**Signature** = the verbatim inline style string from the prototype, with `{{ … }}` bindings kept where the value is state-driven. Where two surfaces differ by a hair, both values are given and the canonical one (per TOKENS.md Part F) is marked **→ adopt**.

**Token names** are the ones already declared in `tokens.proposed.css` (`--rs-*` plus the shadcn contract). Nothing in this document introduces a new token name that is not in that file; where a token is missing it is called out explicitly as **NEW TOKEN**.

**Three build classes** used throughout:

| Class | Meaning |
|---|---|
| **shadcn** | use the primitive as generated; restyle through tokens/classNames only |
| **shadcn + wrapper** | generated primitive wrapped in a RoomScout component that fixes the recipe (sizes, tokens, aria) so call sites never re-specify it |
| **custom** | no shadcn primitive fits; hand-built (measurement, morph, scroll, or geometry the prototype defines) |

**Port deltas** (behaviour the port adds/changes vs. the prototype) are marked **Δ**. They come from the screen docs' own "Port delta / Port decision" notes and are collected in §9.2.

---

# Part 1 · Cross-surface atoms

Atoms that appear on two or more surfaces, or that are used enough on one surface to deserve a component.

---

## 1.1 Chrome atoms

### A1 · Wordmark — `<Wordmark>`
- **Surfaces:** R header · O header · L header · L footer
- **Signature:** `font-size:{{ markSize }}px;font-weight:500;letter-spacing:.04em` — R `markSize` = `20` / narrow `17`; O `20px`; L header `19px` (inside `<a href="#top">`, `text-decoration:none;justify-self:start`, **no inline `color`**); L footer `17px;font-weight:500;letter-spacing:.04em;color:#f5ece2`
- **Note:** the L header wordmark is the *only* anchor on the landing page that inherits `a{color:#f5ece2}a:hover{color:#ff6926}` — every other link sets `color` inline and therefore has no hover.
- **shadcn:** none — custom `<span>` / `<a>`
- **File:** `src/ui/chrome/Wordmark.tsx`

### A2 · Status dot — `<StatusDot>`
- **Surfaces:** R (badge, warn rows, activity) · S (session, source status, sheet state, more-sources row state, import conflict) · O (10 instances) · L (listening dot, fact bullets)
- **Signature:** `width:{n}px;height:{n}px;border-radius:50%;background:{color}` — **five real sizes, do not canonicalise**: `12px` (S autonomy radio inner dot) · `9px` (S/O status dots) · `8px` (R badge/warn/activity, O env pill + calm banner, S mandate, **S „Weitere Quellen“ panel row state**) · `7px` (S sidebar session, S import conflict line, L live dot) · `6px` (L fact bullets)
- **Tones:** live `#ff6926` + `animation:rsDot 2.4s ease-in-out infinite` · ok `#4fbf7a` · warn `#e0a13a` · idle `rgba(255,255,255,.3)` · past `rgba(255,220,190,.35)` · paused `#a89684` + `animation:none`
- **S „Weitere Quellen“ row state dot — 8 px, not 9:** `width:8px;height:8px;border-radius:50%;background:{{ m.dot }}` with `#4fbf7a` (Verfügbar) / `#e0a13a` (Anmeldung nötig) / `rgba(255,255,255,.3)` (Noch nicht verfügbar) — `SETTINGS_SCREENS.md` §4.9. Do **not** reach for the 9 px source-row dot here.
- **NOT a status dot — the R candidate-card „mini blob“:** `margin-top:5px;width:10px;height:10px;border-radius:46% 54% 52% 48%/55% 45% 55% 45%;background:#ff6926;flex:none;box-shadow:0 0 8px rgba(255,105,38,.5)` (`SCOUT_SCREENS.md` §14, `Roomscout.dc.html:464`). It is a **10 px organic blob shape with no animation**: `10px` is not one of A2's five sizes and its border-radius is not `50%`. Building it as `<StatusDot tone="live">` ships a pulsing round dot at the wrong size. Give it its own tiny `<MiniBlob>` (or `<ScoutBlob size={10} anim="none">`) next to S1.
- **shadcn:** none — a `Badge` is too heavy; the prototype never boxes the status
- **API:** `<StatusDot tone="live|ok|warn|idle|past|paused" size={6|7|8|9|12} />`
- **File:** `src/ui/primitives/StatusDot.tsx` (CSS already in `tokens.proposed.css` as `.rs-dot`)

### A3 · Eyebrow label — `<Eyebrow>`
- **Surfaces:** all four (36 occurrences)
- **Signature (default):** `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684`
- **Variants:** accent `color:#ff8a4e;font-weight:500` (R „Freigabe nötig“ / „Angebot eingegangen“; S „Demo-Anmeldesimulation“; O „Simulation“) · wide-accent `letter-spacing:.18em` (L only) · offer `letter-spacing:.16em` (**both** offer cards — R „Angebot eingegangen“ *and* L „Beispielangebot“, byte-identical: `font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#ff8a4e;font-weight:500`) · sheet-label `font-size:13px;letter-spacing:.12em` (O diag sheet block labels) · brief-label `font-size:12px;letter-spacing:.08em` (R brief panels) · landing-panel `font-size:11.5px;letter-spacing:.09em;margin-bottom:6px` (L live fact panel)
- **shadcn:** none — custom `<div>`; `.rs-eyebrow` / `.rs-eyebrow--accent` already exist in `tokens.proposed.css`
- **File:** `src/ui/primitives/Eyebrow.tsx`

### A4 · Page header (title + lead) — `<PageHeader>`
- **Surfaces:** S (7 pages) · O (6 pages)
- **Signature:** h1 `margin:0;font-size:44px;line-height:1.1;font-weight:500;letter-spacing:-.02em` · lead `margin:10px 0 0;font-size:19px;color:#cbb9a8`
- **Δ mobile:** `< 900px` → h1 ~`30–32px`, lead `16px` (not in the prototype)
- **shadcn:** none — plain `<h1>`/`<p>`; do **not** map to `DialogTitle`/`DialogDescription` (the breadcrumb header owns those, §3.2)
- **File:** `src/ui/primitives/PageHeader.tsx`

### A5 · Section label (uppercase, in-page) — reuses `<Eyebrow>`
- **Surfaces:** S (`Deine Quellen`, `Was ich selbstständig erledigen darf`, `Grenzen`, `Kanal`, `Dein Zugang`, `Aktivität im September`, `Rechnungen`) · O (`Integrationen`, `Aufgaben`, `Betriebsregeln`, `Feature-Flags`, `Wirkung vor dem Speichern`)
- **Signature:** `font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:#a89684` with a per-position top margin of `22–30px`
- **File:** same as A3

### A6 · Footer caption — `<SurfaceCaption>`
- **Surfaces:** S host wrapper · O body wrapper
- **Signature:** `text-align:center;font-size:13px;color:#a89684;padding:14px 0 12px` — identical in both
- **shadcn:** none
- **File:** `src/ui/chrome/SurfaceCaption.tsx`

---

## 1.2 Buttons

All buttons inherit `font:inherit` (146×). Every focus ring is the same: `outline:2px solid #ff6926;outline-offset:2px` on `:focus-visible` — **Δ** ship one global rule for all interactive elements (F17).

### B1 · Primary pill — `<Button variant="primary" shape="pill">`
- **Surfaces:** R (dominant), L (all five orange CTAs), S (`Zum Scout`, `Quelle auswählen`)
- **Signature:** `height:{h}px;padding:0 {p}px;border-radius:999px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:{fs}px;font-weight:600;cursor:pointer` + hover `background:#ff7a3d`
- **Height/padding/size matrix (verbatim):** `60/0 34/19` welcome „Mit Scout sprechen“ (+ `box-shadow:0 8px 32px rgba(255,105,38,.28)`, `transition:transform .2s,background .2s`, hover adds `transform:translateY(-1px)` — **the only hover in the app that moves an element**) · `58/100%/18` „Scout losschicken“ (card) · `56/100%/17` „Scout losschicken“ (sheet) + L `Scout losschicken` · `56/—/17` „Angebot annehmen“ · `54/0 40/17` „Angebot prüfen“ · `56/0 32/17` L hero CTA · `58/0 34/17` L closing CTA · `50/0 30/16` L offer CTA · `50/0 24/16` „Gespräch fortsetzen“ · `46/0 22/15` „Nachricht freigeben“, „Übernehmen“ · `44/0 22/15` L header CTA · `44/0 20/15` „Fortsetzen“ · `42/0 16/14` S knowledge inline-edit submit „Speichern“ (`border-radius:999px;border:0;background:#ff6926;color:#fff;font-size:14px;font-weight:600` + hover `#ff7a3d`, SETTINGS §7.5 a) · `38/0 16/14` S `Quelle auswählen` · `34/0 14/13.5` R toast „Zum Scout“
- **Settings pill ladder is `38 | 42 | 46` (SETTINGS §3.5)** — all three must exist in the wrapper; the matrix above carries all three.
- **Glows:** `--rs-glow-primary` `0 8px 28px rgba(255,105,38,.25)` (5×: „Scout losschicken“ card + sheet, „Angebot prüfen“, „Angebot annehmen“, L Scout losschicken) · `--rs-glow-primary-lg` `0 8px 32px rgba(255,105,38,.28)` (3×: welcome CTA, L hero + closing CTA)
- **shadcn:** `Button` + wrapper enforcing the pill recipe and the two glow tiers
- **File:** `src/ui/primitives/RsButton.tsx` (variant `primary`, prop `shape="pill"`, `glow="sm|lg|none"`)

### B2 · Primary rect (r12) — `<Button variant="primary" shape="rect">`
- **Surfaces:** S · O
- **Signature:** `height:46px|48px;padding:0 22px;border-radius:12px;border:0;background:#ff6926;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer` + hover `#ff7a3d`; O primary is `height:44px;padding:0 20px`
- **Disabled:** `background:rgba(255,105,38,.4);cursor:not-allowed` + `disabled` attribute (S: „Änderungen speichern“ when `perDayInvalid`, profile „Speichern“ when unchanged, „Angaben prüfen“ when empty, „Ausgewählte Angaben übernehmen“ when `noPick`)
- **shadcn:** `Button` + wrapper
- **File:** same as B1

### B3 · Ghost / outline rect — `<Button variant="outline">`
- **Surfaces:** S (7×) · O (`Diagnose`, `Diagnose-Sheet öffnen`)
- **Signature:** `height:46px;padding:0 22px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:15px;cursor:pointer` + hover `background:rgba(255,255,255,.1)`
- **Exceptions that must not be folded:** `padding:0 20px` for S import „Prompt kopieren“/„Kopiert“ (+`min-width:150px`) and „Beispiel einsetzen“ · compact variants `height:42px;padding:0 18px;font-size:14.5px` (privacy rows) and `height:44px;padding:0 20px` (billing rows) · **two distinct O outline buttons, do not fold them together** (OPERATOR §2.4): the per-row table action `Diagnose` is `height:40px;padding:0 18px;border-radius:10px`, while the Diagnose-page sheet trigger „Diagnose-Sheet öffnen“ is the *same* recipe at `height:44px;padding:0 20px;border-radius:12px;margin-top:20px` (OPERATOR §10.3) · S autonomy save-bar „Abbrechen“ `height:48px;padding:0 22px;border-radius:12px` + `animation:stFade .2s ease both` (SETTINGS §5.10) — this is a **B3, not a B5**, and `48px` belongs in this ladder
- **shadcn:** `Button variant="outline"` + wrapper
- **File:** same as B1

### B4 · Outline pill — `<Button variant="outline" shape="pill">`
- **Surfaces:** R only
- **Signature:** `height:{58|52|50|44}px;padding:0 {24|22|20}px;border-radius:999px;border:1px solid rgba(255,220,190,{.3|.28});background:rgba(255,255,255,.05)|rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:{16|15}px` + hover `background:rgba(255,255,255,.1)`
- **Border alpha — keep both:** `.3` on the three brief/offer pills, **`.28`** on the clarification „Sprechen“ button.
- **Instances:** „Suchauftrag ansehen“ (50/0 24/16, `.05`, border `.3`) · „Mit Scout sprechen“ offer talk (52/0 24/16, `.04`, border `.3`, `font-weight:500`, `gap:10px` + mic 18×18) · „Quelle auswählen“ blocked (44/0 20/15, `.05`, border `.3`) · **„Sprechen“ (clarification composer row)** — `height:58px;padding:0 22px;border-radius:999px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:15px;font-weight:500;display:flex;align-items:center;gap:10px;cursor:pointer` + hover `background:rgba(255,255,255,.1)` + mic icon `18×18 stroke-width:1.9` (`SCOUT_SCREENS.md` §9, `Roomscout.dc.html:296`). This is the **tallest** outline pill in the app; it is neither a B4 `.3`-border pill nor a B5 (it has a `.05` fill).
- **File:** same as B1

### B5 · Secondary (no fill) — `<Button variant="secondary-outline">`
- **Surfaces:** R („Abbrechen“) · S („Abbrechen“, „Weiter bearbeiten“, „Zurück“, „Verbunden bleiben“) · O („Abbrechen“)
- **Signature:** `height:{46|44|42}px;padding:0 {22|18|16}px;border-radius:{999px|12px};border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font:inherit;font-size:{15|14}px` + hover `background:rgba(255,255,255,.08)`
- **Note:** distinguish from B3 by `background:none` vs `rgba(255,255,255,.04)` — the hover differs too (`.08` vs `.1`)
- **Not every S „Abbrechen“ is a B5 — two exceptions:**
  1. **Autonomy save bar** (SETTINGS §5.10) is a **B3**: `height:48px;padding:0 22px;border-radius:12px;border:1px solid rgba(255,220,190,.28);background:rgba(255,255,255,.04);color:#f5ece2;font-size:15px;cursor:pointer;animation:stFade .2s ease both` + hover `rgba(255,255,255,.1)`.
  2. **Knowledge inline edit** (SETTINGS §7.5 a) *is* a B5, but at a size the old signature did not carry: `height:42px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,220,190,.28);background:none;color:#f5ece2;font-size:14px` + hover `rgba(255,255,255,.08)` — hence the `42` / `0 16px` / `14px` entries above.
- **File:** same as B1

### B6 · Destructive — `<Button variant="destructive">`
- **Surfaces:** S („Verbindung trennen“ confirm) · R (the „Gespräch beenden“ circle)
- **Signature:** `height:44px;padding:0 18px;border-radius:12px;border:0;background:#b8382a;color:#fff;font-size:15px;font-weight:600` + hover `#c9463a`; R circle: `width/height:{{ ctrl }}px;border-radius:50%;background:#b8382a;color:#fff` + hover `#c9463a`
- **File:** same as B1

### B7 · Underlined text button — `<LinkButton>`
- **Surfaces:** all four (22 instances; all share `text-underline-offset:4px`)
- **Signature:** `border:0;background:none;color:{#d8c8b8|#f5ece2};font:inherit;font-size:{15|14.5|14}px;cursor:pointer;padding:{6px 8px|8px 12px|6px 0|4px 6px};text-decoration:underline;text-underline-offset:4px;text-decoration-color:{color}`
- **Three underline colours — keep three:** `rgba(255,220,190,.35)` (R:7 L:1) **→ adopt for the neutral variant**; `rgba(255,220,190,.4)` (S:6 O:4) folds into it; `rgba(255,140,90,.6)` (L:1, „So behaltet ihr die Kontrolle ↓“) **stays as `--rs-underline-accent`**
- **Three hover families:** `color:#fff` (R, 15×; plus L's single hovering link „Beispiel fortsetzen (Mittwoch-Pfad)“, `Landing v2.dc.html:143`) · `color:#ff8a4e` (S/O, and R's „Angaben ansehen“ / „Zu den Zugängen“) · **no hover at all (L)** — see the rule below.
- **Landing page-wide hover rule (LANDING §3.1, §16) — reproduce it, do not let shadcn add one:** the stylesheet declares `a{color:#f5ece2}a:hover{color:#ff6926}`, but every anchor except the header wordmark sets `color` **inline**, and an inline style beats `a:hover`. So in the source these seven anchors have **no hover state**: „So funktioniert’s ↓“ (`#f5ece2`), „Weiter zu den Funktionen ↓“ (`#a89684`), „So behaltet ihr die Kontrolle ↓“ (`#f5ece2`, the `--rs-underline-accent` one), „Projekt ansehen ↗“ (`#f5ece2`), the two header nav links „So funktioniert’s“ / „Dein Scout“ (`#e2d3c3`), and the footer „GitHub“ (`#e2d3c3`). Mapping them to `Button variant="link"` silently adds an underline/colour hover — either strip it (`hover:no-underline hover:text-inherit`) or record the addition as a deliberate Δ (§8.2). Only the five orange CTAs and the bare wordmark change on hover on Landing.
- **shadcn:** `Button variant="link"` + wrapper that **strips** the variant's default underline/colour hover and applies the recipe
- **File:** `src/ui/primitives/LinkButton.tsx` (`.rs-link-button` exists in `tokens.proposed.css`)

### B8 · Quiet text button (no underline) — `<QuietButton>`
- **Surfaces:** R („Zurück zum Gespräch“, „Zum Schreiben wechseln“, discovery link row, „Details“ toggles) · S („Details“) · O
- **Signature (muted variant, `#a89684`):** `border:0;background:none;color:#a89684;font:inherit;font-size:{15|14|13.5}px;cursor:pointer;padding:{6px 8px|6px 10px|2px 4px};border-radius:{6px|8px}` + hover `color:{#f5ece2|#fff}`
- **Signature (warm variant, `#d8c8b8`) — a second family, keep it:** `border:0;background:none;color:#d8c8b8;font:inherit;font-size:{16|15}px;cursor:pointer;padding:8px 12px;border-radius:8px;display:flex;align-items:center;gap:10px` + hover `color:#fff`. Instances: R welcome secondary CTA **„Lieber schreiben“** (`font-size:16px`, `margin-top:22px`, `animation:rsFadeUp .7s .3s ease both`, keyboard icon `20×20 stroke-width:1.7` `<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>`, `SCOUT_SCREENS.md` §5 row 5) and R autopilot **„Aktivität ansehen“ / „Aktivität ausblenden“** (`font-size:15px`, `margin-top:22px`, `gap:9px`, clock icon `18×18 stroke-width:1.7`, §8.7). Neither is a B7 (no underline) nor the muted B8 (wrong colour, size and padding).
- **shadcn:** `Button variant="ghost" size="sm"` + wrapper with a `tone="muted|warm"` prop
- **File:** same as B7

### B9 · Icon circle button — `<IconCircleButton>`
- **Surfaces:** all four
- **Size ladder (verbatim, keep all):**
  | Ø | fill | border | hover | Where |
  |---|---|---|---|---|
  | `30` | `rgba(255,255,255,.06)` r8 | — | `.14` | dev bar (**do not ship**) |
  | `36` | `none` | — | `rgba(255,255,255,.08)` | R brief-card pencil, S source chevron |
  | `40` | `none` | — | `rgba(255,255,255,.08)` | S knowledge pencil + kebab, S summary edit |
  | `40` | `rgba(255,255,255,.06)` | — | `rgba(255,255,255,.12)` | R transcript close, S sheet close, O sheet close |
  | `42` | `rgba(255,255,255,.04)` | `rgba(255,220,190,.22)` | `rgba(255,255,255,.1)` | R header pause + avatar (narrow `38`) |
  | `44` | `rgba(255,255,255,.08)` | — | `rgba(255,255,255,.14)` | R send buttons |
  | `44` | `#ff6926` | — | `#ff7a3d` | R voice-switch button |
  | `46` | `#ff6926` | — | `#ff7a3d` | R side-note mic |
  | `42` | `rgba(255,255,255,.08)` | — | `rgba(255,255,255,.14)` | R clarification send (`Roomscout.dc.html:294` — it **does** declare a hover) |
  | `40` | `rgba(255,255,255,.08)` | — | — | R QA send — **the only send button with no hover** (`Roomscout.dc.html:407`) |
  | `76`/`60` | see C7 | | | R voice controls |
- **Base:** `border-radius:50%;border:0;color:#f5ece2;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0`
- **shadcn:** `Button variant="ghost|outline" size="icon"` + wrapper with a `size` prop taking the raw px
- **File:** `src/ui/primitives/IconCircleButton.tsx`

### B10 · Accent chip (clickable) — `<Chip>`
- **Surfaces:** R (discovery suggestion, QA prepared question)
- **Signature:** `border:1px solid rgba(255,140,90,.4);background:rgba(255,105,38,.12);color:#ffd9c4;font:inherit;font-size:14px;padding:8px 14px;border-radius:999px;cursor:pointer;animation:rsFadeUp .3s ease both;text-align:left` + hover `background:rgba(255,105,38,.22)`
- **shadcn:** `Button` + wrapper (not `Badge` — it is interactive)
- **File:** `src/ui/primitives/Chip.tsx`

### B11 · Choice buttons (clarification) — `<ChoiceButton>`
- **Surfaces:** R clarification · L clarify beat (identical recipe)
- **Signature (primary choice):** `height:{46|44}px;padding:0 {20|18}px;border-radius:999px;border:1px solid rgba(255,140,90,.45);background:rgba(255,105,38,.14);color:#ffe0cf;font:inherit;font-size:15px;font-weight:500;cursor:pointer` + hover `background:rgba(255,105,38,.26)`
- **Signature (secondary choice):** `…;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.05);color:#f5ece2;font-size:15px` + hover `background:rgba(255,255,255,.1)`
- **shadcn:** `Button` ×2 variants + wrapper
- **File:** `src/ui/primitives/ChoiceButton.tsx`

### B12 · Filter chip (pressed toggle) — `<FilterChip>`
- **Surfaces:** O Aufträge
- **Signature:** `height:38px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,220,190,.2);background:{{ active ? 'rgba(255,105,38,.3)' : 'rgba(255,255,255,.04)' }};color:#f5ece2;font:inherit;font-size:14.5px;cursor:pointer` + `aria-pressed`
- **Δ:** the prototype ships **no hover** on either chip — add one via `ToggleGroupItem`, keeping the active background at `rgba(255,105,38,.3)` on hover
- **shadcn:** `ToggleGroup type="single"` + `ToggleGroupItem`
- **File:** `src/ui/operator/TaskFilter.tsx`

### B13 · Segmented control — `<Segmented>`
- **Surfaces:** S Benachrichtigungen → Kanal
- **Signature:** group `role="radiogroup" aria-label="Kanal"` `margin-top:12px;display:inline-flex;padding:4px;border-radius:12px;border:1px solid rgba(255,220,190,.16);background:rgba(0,0,0,.2)` (note `.2`, **not** the `.25` input fill) · item `role="radio"` `height:40px;padding:0 18px;border-radius:9px;border:0;background:{{ selected ? 'rgba(255,105,38,.35)' : 'transparent' }};color:#f5ece2;font:inherit;font-size:15px;cursor:pointer;transition:background .15s`
- **shadcn:** `ToggleGroup type="single"` (or `Tabs` list-only) + wrapper
- **Reuse:** this is the recipe the **DE/EN language toggle** should adopt (§8.4)
- **File:** `src/ui/primitives/Segmented.tsx`

### B14 · Stepper — `<Stepper>`
- **Surfaces:** S Handlungsspielraum → „Neue Anbieter pro Tag“
- **Signature:** wrapper `display:flex;align-items:center;border:1px solid rgba(255,220,190,.2);border-radius:10px;overflow:hidden` · minus/plus `width:42px;height:40px;border:0;background:rgba(255,255,255,.05);color:#f5ece2;font:inherit;font-size:18px;cursor:pointer` + hover `background:rgba(255,255,255,.12)`; glyphs are literally `−` (U+2212) and `+` · input `width:56px;height:40px;text-align:center;border:0;background:none;color:#f5ece2;font:inherit;font-size:17px` with `inputmode="numeric"` and `aria-invalid`
- **Validation:** value is written **raw as a string**; `perDayInvalid = !(Number.isInteger(n) && n > 0 && String(v).trim() !== '')` → `role="alert"` line `margin-top:8px;font-size:14px;color:#ff8a6a`
- **shadcn:** `Input` + two `Button variant="ghost" size="icon"` inside a bordered group (custom composition)
- **File:** `src/ui/settings/PerDayStepper.tsx`

---

## 1.3 Form controls

### C1 · Switch — `<RsSwitch>`
- **Surfaces:** S (5×) · O (1×) — **byte-identical markup**
- **Signature:** track `role="switch" aria-checked aria-label` `width:56px;height:32px;border-radius:16px;border:0;padding:0;background:{{ bg }};position:relative;cursor:pointer;transition:background .2s;flex:none` · knob `position:absolute;top:3px;left:3px;width:26px;height:26px;border-radius:50%;background:#fff;transform:{{ knob }};transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.3)`
- **States:** on `background:#ff6926` + `transform:translateX(24px)`; off `background:rgba(255,255,255,.14)` + `transform:none`
- **shadcn:** `Switch` with a size override (default is 36×20 with a 16px thumb — must be re-sized to 56×32/26/24)
- **File:** `src/ui/primitives/RsSwitch.tsx` (`.rs-switch` exists in `tokens.proposed.css`)

### C2 · Toggle row — `<ToggleRow>`
- **Surfaces:** S Handlungsspielraum (3 action + 2 share rows) · S Benachrichtigungen (3 rows) · O Feature-Flags (2 rows)
- **Signature:** S autonomy `display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px 0;border-bottom:1px solid rgba(255,220,190,.1);font-size:17px` · S notif `padding:16px 0` + sub `margin-top:2px;font-size:14px;color:#a89684` · O flags `padding:18px 0` + effect `margin-top:3px;font-size:14.5px;color:#cbb9a8`
- **Composition:** `<label>` (title + optional sub) · `<RsSwitch aria-label={title}>`
- **shadcn:** `Label` + `Switch` (+ `Separator` if the border is replaced)
- **File:** `src/ui/primitives/ToggleRow.tsx`

### C3 · Radio card — `<RadioCard>`
- **Surfaces:** S Handlungsspielraum (Autopilot / Mit Rücksprache)
- **Signature:** group `role="radiogroup" aria-label="Arbeitsmodus"` `margin-top:26px;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px` · card `role="radio" aria-checked` `display:flex;align-items:center;gap:18px;padding:20px 22px;border-radius:16px;border:1px solid {{ border }};background:{{ bg }};color:#f5ece2;font:inherit;text-align:left;cursor:pointer;transition:background .2s,border-color .2s` · ring `width:26px;height:26px;border-radius:50%;border:2px solid {{ ring }};display:flex;align-items:center;justify-content:center;flex:none` · dot `width:12px;height:12px;border-radius:50%;background:{{ dotBg }}`
- **States:** selected → border `rgba(255,105,38,.75)`, bg `rgba(120,58,22,.28)`, ring `#ff6926`, dot `#ff6926`; unselected → border `rgba(255,220,190,.14)`, bg `rgba(255,255,255,.03)`, ring `rgba(255,220,190,.35)`, dot `transparent`
- **shadcn:** `RadioGroup` + `RadioGroupItem` inside `Label`-wrapped `Card`s (the shadcn "card radio" pattern); the ring/dot geometry is custom (`.rs-radio`)
- **File:** `src/ui/settings/AutonomyModeCards.tsx`

### C4 · Checkbox — shadcn `Checkbox`
- **Surfaces:** S import step 3b
- **Signature:** native `type="checkbox"` `margin-top:4px;width:18px;height:18px;accent-color:#ff6926`; row `<label>` `display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px;align-items:start;padding:12px 6px;border-bottom:1px solid rgba(255,220,190,.08);cursor:pointer`
- **shadcn:** `Checkbox` + `Label` (size to 18px, checked fill `--rs-signal`)
- **File:** `src/ui/settings/ImportDialog.tsx`

### C5 · Text input (rect) — shadcn `Input`
- **Surfaces:** S
- **Signatures (three, keep distinct):** more-sources search `width:100%;height:46px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,220,190,.16);background:rgba(0,0,0,.25);color:#f5ece2;font:inherit;font-size:15px` · profile name `height:48px;padding:0 16px;border-radius:12px;border:1px solid rgba(255,220,190,.2);background:rgba(0,0,0,.25);font-size:17px` · knowledge inline edit `flex:1;min-width:220px;height:42px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,200,160,.3);background:rgba(0,0,0,.25);font-size:16px`
- **Placeholder:** `#9c8b7b` — **Δ** ship one global `::placeholder` rule (F18; L v2 lost it only because it has no inputs left)
- **File:** `src/components/ui/input.tsx` (generated) + call-site classes

### C5b · Textarea — shadcn `Textarea`
- **Surfaces:** S only — **exactly one call site**: import dialog step 2 (`SETTINGS_SCREENS.md` §13.3)
- **Signature:** `id="st-import-text" rows="6" placeholder="Zusammenfassung hier einfügen …"` — `margin-top:6px;width:100%;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,220,190,.2);background:rgba(0,0,0,.25);color:#f5ece2;font:inherit;font-size:15px;line-height:1.55;resize:vertical`
- **Label above it:** `for="st-import-text"` — `display:block;margin-top:18px;font-size:14px;color:#a89684`, copy „Musik-Kontext einfügen“; hint below `margin-top:8px;font-size:13.5px;color:#a89684`
- **Note:** the `rgba(0,0,0,.25)` fill matches C5's inputs, but the radius (`14px`) and padding are its own — do **not** fold it into C5's three input signatures. `resize:vertical` is the only resize declaration in the prototype.
- **shadcn:** `Textarea` + `Label` (this is why `textarea` is on the install list, §3.1)
- **File:** `src/ui/settings/ImportDialog.tsx`

### C6 · Composer pill — `<ComposerPill>`
- **Surfaces:** R discovery, side-note, clarification, QA
- **Shared signature:** `display:flex;align-items:center;gap:8px;border-radius:999px;background:rgba(20,14,10,.6);border:1px solid rgba(255,200,160,.16)` — plus, per call site:

  | Call site | Width | Height / padding | `backdrop-filter` | Leading keyboard icon | Divider | Trailing |
  |---|---|---|---|---|---|---|
  | Discovery (§6.7) | **`width:100%`** (the *column* around it is `margin-top:22px;width:min(640px,100%);display:flex;flex-direction:column;align-items:center;gap:12px` — that width is **not** the composer's) | `60` / `0 8px 0 18px` | `blur(6px)` | ✅ | — | send B9 44 + voice B9 44 orange |
  | Side-note (§8.8) | `margin-top:42px;width:min(660px,100%)` | `62` / `0 8px 0 20px` | `blur(6px)` | ✅ | ✅ `width:1px;height:22px;background:rgba(255,220,190,.16)` | mic B9 46 orange |
  | Clarification (§9) | `flex:1;min-width:240px` (a flex child next to the „Sprechen“ B4) | `58` / `0 8px 0 18px` | — | **✗ none** | — | send B9 42 |
  | QA (§11.1) | `width:100%` | `56` / `0 8px 0 18px` | — | **✗ none** | — | send B9 40 |

- **Inner input:** `flex:1;min-width:0;background:none;border:0;color:#f5ece2;font:inherit;font-size:16px;outline:none;padding:0 6px` — clarification/QA omit the `padding`
- **Slots:** the leading keyboard icon (20×20 `stroke:#a89684;stroke-width:1.7`) is **discovery + side-note only**, exactly like `backdrop-filter` — the clarification and QA composers are input + send button and nothing else. Make it an optional slot, not a default.
- **shadcn:** `Input` (unstyled) inside a custom rounded shell + `Button` ×2
- **File:** `src/ui/primitives/ComposerPill.tsx` (`.rs-input-pill` exists)

### C7 · Voice control stack — `<VoiceControl>`
- **Surfaces:** R discovery (mic / Mitschrift / Gespräch beenden)
- **Signature:** row `margin-top:36px;display:flex;gap:{{ ctrlGap }}px;align-items:flex-start` (`34` / narrow `20`) · button `display:flex;flex-direction:column;align-items:center;gap:10px;border:0;background:none;color:#e2d3c3;font:inherit;font-size:{{ ctrlFont }}px;cursor:pointer;padding:0` (`14` / `12.5`) · circle `width/height:{{ ctrl }}px` (`76` / `60`) `border-radius:50%`
- **Mic circle base (do not drop):** `display:flex;align-items:center;justify-content:center;color:#fff;transition:background .3s` — the `color:#fff` is mic-only (the other two circles are `#f5ece2` / `#fff` from their own fills) and the `transition:background .3s` is a real declaration missing from §5.2's list.
- **Mic states:** on → `background:#ff6926;border:1px solid #ff6926;box-shadow:0 6px 24px rgba(255,105,38,.3)`; off → `background:rgba(255,255,255,.07);border:1px solid rgba(255,220,190,.16);box-shadow:none` — note `.07` here is a **resting fill**, not a hover
- **shadcn:** `Button variant="ghost" size="icon"` + custom label-under-icon wrapper; `Toggle` for the mic if a pressed state is wanted
- **File:** `src/ui/scout/discovery/VoiceControls.tsx`

---

## 1.4 Surfaces & containers

### D1 · Glass card — `<GlassCard>`
- **Surfaces:** R (offer, review, approval, brief panels, activity, clarification, dead-end) · L (all beats + bento)
- **Fill ladder:** `rgba(18,14,12,.72)` (8× R, L offer) **= `--card`** · `.66` (R clarification + dead-end, L clarify + 4 bento) · `.6` (R activity panel, L FAQ item) · `.78` (L summary card) · `.5` (L live fact panel) · `.74`/`.42` (R fact list card/float mode)
- **Border:** `1px solid rgba(255,200,160,.14)` default; `.12` (R activity, L fact panel); `.16` (L summary card)
- **Radius:** `16` (brief panels) · `20` (approval) · `22` (clarification, dead-end, L hero preview) · `24` (offer, review, L offer) · `26` (L bento + summary + fact card mode)
- **shadcn:** `Card` + wrapper exposing `fill`/`radius` props
- **File:** `src/ui/primitives/GlassCard.tsx`

### D2 · Pill panel / summary pill — `<Pill>`
- **Surfaces:** R (autopilot brief pill, offer brief pill, candidates brief pill, complete summary pill, context pills) · L (context pill, location pill)
- **Signature:** `height:{50|46|44|42|40}px;padding:0 {20|18|16}px;border-radius:999px;border:1px solid rgba(255,200,160,{.18|.16});background:rgba(20,14,10,{.55|.5});color:{#f5ece2|#d8c8b8};font:inherit;font-size:{16|15|14}px;display:flex;align-items:center;gap:{10|8}px`
- **Two L pills that do NOT fit this signature — build them separately:**
  - **Hero-preview corner badge „Beispielansicht“** (LANDING §4.6 item 5): `position:absolute;right:18px;bottom:14px;font-size:12px;color:#e2d3c3;padding:5px 11px;border-radius:999px;border:1px solid rgba(255,220,190,.22);background:rgba(11,10,9,.55)` — **no height** (padding-sized), a `rgba(255,220,190,…)` border and a `rgba(11,10,9,…)` background, i.e. a different border/background family from D2's `rgba(255,200,160,…)` / `rgba(20,14,10,…)`.
  - **Hero eyebrow pill „Euer persönlicher Proberaum-Scout“** (LANDING §4.1): `height:38px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,140,90,.55);display:flex;align-items:center;font-size:14.5px;color:#f5ece2` — **no background at all**, and the only `rgba(255,140,90,.55)` border in the app. Neither height `38` nor that border is anywhere else in D2.
- **Hovers:** `background:rgba(30,22,16,.7)` (autopilot brief pill — the only non-white hover wash in the app) · `color:#fff` (offer + candidates pills)
- **shadcn:** `Badge variant="outline"` for static pills; `Button` for the three that toggle a panel
- **File:** `src/ui/primitives/Pill.tsx`

### D3 · Popover menu — shadcn `DropdownMenu`
- **Surfaces:** R profile menu · S knowledge kebab menu
- **Signature (R):** `position:absolute;right:0;top:52px;min-width:240px;padding:8px;border-radius:16px;background:rgba(20,15,12,.96);border:1px solid rgba(255,200,160,.16);box-shadow:0 20px 50px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:2px;animation:rsFadeUp .18s ease both`
- **Signature (S):** `position:absolute;right:0;top:44px;z-index:5;min-width:210px;padding:6px;border-radius:12px;background:rgba(20,15,12,.97) → adopt .96;border:1px solid rgba(255,200,160,.16);box-shadow:0 16px 40px rgba(0,0,0,.45);animation:stFade .15s ease both`
- **Item:** `text-align:left;border:0;background:none;color:#f5ece2;font:inherit;font-size:{15|14.5}px;padding:{10px 12px|9px 12px};border-radius:{10px|8px};cursor:pointer;display:flex;align-items:center;gap:10px` + hover `rgba(255,255,255,.07)`
- **Label/divider (R only):** header block `padding:10px 12px 8px` (name `15px/500`, subtitle `12.5px;color:#a89684`) · divider `height:1px;background:rgba(255,220,190,.1);margin:2px 4px 6px`
- **shadcn:** `DropdownMenu` + `DropdownMenuTrigger|Content|Label|Separator|Item`
- **Δ:** Radix adds outside-click close, Escape-with-focus-return and roving focus — the S kebab has **none** of these. Adopt the primitive; record as a delta, not a reproduction.
- **Files:** `src/ui/chrome/ProfileMenu.tsx` · `src/ui/settings/KnowledgeRowMenu.tsx`

### D4 · Toast — `<Toast>` / Sonner
- **Surfaces:** R (persistent, action) · S (transient, plain)
- **R signature:** `role="status"` `position:absolute;z-index:14;right:24px;top:96px;display:flex;align-items:center;gap:14px;padding:12px 12px 12px 16px;border-radius:14px;background:rgba(24,17,13,.96);border:1px solid rgba(255,140,90,.35);box-shadow:0 16px 40px rgba(0,0,0,.4);animation:rsFadeUp .25s ease both` + 8px `#ff6926` dot + `font-size:14.5px` message + B1(34) action + B9(30, `color:#a89684`, hover `#fff`) close
- **S signature:** `role="status"` `position:absolute;z-index:40;left:50%;bottom:22px;transform:translateX(-50%);padding:10px 18px;border-radius:12px;background:rgba(28,20,14,.96) → adopt rgba(24,17,13,.96);border:1px solid rgba(255,200,160,.22);font-size:14px;color:#f5ece2;white-space:nowrap;animation:stFade .2s ease both`
- **Durations:** R **no timer at all** — survives until the X, „Zum Scout“, or any `backToScout()`; S single slot, 2400 ms, a new toast replaces the current one
- **shadcn:** `Sonner` for both — R toast configured `duration: Infinity` + a manual dismiss + `position="top-right"` with `offset` matching `right:24px;top:96px`; S toaster `position="bottom-center"`, `duration: 2400`, scoped inside the dialog
- **Files:** `src/ui/chrome/ScoutToast.tsx` · `src/ui/chrome/Toaster.tsx`

### D5 · Hint bar — `<HintBar>`
- **Surfaces:** R only (8 strings, all in `SCOUT_SCREENS.md` §18.3)
- **Signature:** `role="status"` `position:absolute;z-index:8;left:50%;bottom:22px;transform:translateX(-50%);max-width:min(560px,calc(100% - 32px));padding:10px 16px;border-radius:12px;background:rgba(28,20,14,.92);border:1px solid rgba(255,200,160,.2);font-size:13.5px;color:#e2d3c3;text-align:center;animation:rsFadeUp .3s ease both`
- **Timing:** auto-clears after **4200 ms**, and only if `state.hint` is still the same string (a newer hint is not clobbered)
- **shadcn:** `Sonner` bottom-center with `duration: 4200` and no action — or custom; keep it a *separate* toaster instance from D4 so the two never stack
- **File:** `src/ui/chrome/HintBar.tsx`

### D6 · Alert / banner — shadcn `Alert`
| Instance | Surfaces | Signature |
|---|---|---|
| Offer stale (warn) | R | `margin:-12px 0 22px;display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:12px;background:rgba(224,161,58,.12);border:1px solid rgba(224,161,58,.35);font-size:14px;color:#f5ece2` + 8px `#e0a13a` dot + B7 link |
| No usable source (warn) | S | `margin-top:14px;padding:14px 18px;border-radius:14px;background:rgba(224,161,58,.1);border:1px solid rgba(224,161,58,.35);display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:14.5px` + B1(38) |
| Attention (warn) | O | `margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border-radius:14px;background:rgba(224,161,58,.1);border:1px solid rgba(224,161,58,.45);animation:opFade .25s ease both` + `!` badge `width:24px;height:24px;border-radius:50%;background:#e0a13a;color:#1a1208;font-weight:700 → adopt 600;font-size:15px` + B7 |
| Calm (neutral) | O | `margin-top:24px;display:flex;align-items:center;gap:12px;padding:14px 18px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.12);font-size:15px;color:#cbb9a8` + 8px `#4fbf7a` dot |
| Lock reassurance (accent) | S | `margin-top:26px;display:flex;align-items:center;gap:20px;padding:20px 24px;border-radius:18px;background:rgba(120,58,22,.22);border:1px solid rgba(255,140,90,.22)` + 26px lock icon `stroke:#ff8a4e` |
| Blocked access row | R | `margin-top:14px;display:flex;align-items:center;gap:10px;font-size:14px;color:#e2d3c3;flex-wrap:wrap;justify-content:center` + 8px `#e0a13a` dot + B7 (`hover:color:#ff8a4e`) — **no box**, an inline row |
| Undo bar | S | `role="status"` `margin-top:12px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,200,160,.14);font-size:14.5px;animation:stFade .2s ease both` + action `color:#ff8a4e;font-weight:500;padding:4px 8px` |
| Saved / resolved status | O | `role="status"` `margin-top:{16|20}px;font-size:14.5px;color:#cbb9a8` (+`animation:opFade .2s ease both` on the flags one only) |
- **shadcn:** `Alert` (+ custom `warning`/`accent` tones); the last two are plain `role="status"` text, keep them inline
- **File:** `src/ui/primitives/RsAlert.tsx` + call sites

### D7 · Right-edge sheet — shadcn `Sheet`
| Instance | Signature |
|---|---|
| R transcript | `position:absolute;z-index:9;top:0;right:0;bottom:0;width:min(420px,100%);background:rgba(14,11,9,.94);border-left:1px solid rgba(255,200,160,.12);display:flex;flex-direction:column;animation:rsFadeUp .3s ease both`; header `height:84px;padding:0 24px`, title `17px/500`; body `flex:1;overflow:auto;padding:4px 24px 24px;display:flex;flex-direction:column;gap:14px` |
| S connection | `role="dialog" aria-modal="true"` `position:absolute;z-index:21;top:0;right:0;bottom:0;width:min(480px,100%);background:rgba(18,14,11,.98);border-left:1px solid rgba(255,200,160,.16);padding:34px 34px 30px;overflow:auto;animation:stFade .25s ease both;display:flex;flex-direction:column`; scrim `position:absolute;inset:0;z-index:20;background:rgba(6,4,3,.55);animation:stFade .2s ease both` with `onClick=closeSheet` — **`.55` is the source value, not a canonicalisation** (SETTINGS §12.1); only S's *import* and *discard* scrims are `.6` and get pulled to `.55` (D13) |
| O diagnostics | same as S but `width:min(500px,100%);padding:34px`, scrim `rgba(6,4,3,.55)`, `animation:opFade` |
- **Critical:** the S and O sheets are `position:absolute` **inside the shell card** and are clipped by its `border-radius:28px` — they must **not** portal to `body`. Use a `SheetPortal container={shellRef.current}` or a plain absolutely-positioned `<aside>` styled like `SheetContent`.
- **shadcn:** `Sheet` + `SheetContent side="right"` (+ `ScrollArea` for R)
- **Files:** `src/ui/chrome/TranscriptSheet.tsx` · `src/ui/settings/ConnectionSheet.tsx` · `src/ui/operator/DiagnosticsSheet.tsx`

### D8 · Bottom sheet (mobile) — `Drawer` (vaul)
- **Surfaces:** R narrow discovery/brief
- **Signature:** `position:absolute;z-index:6;left:{{ shSide }}px;right:{{ shSide }}px;bottom:{{ shBottom }}px;border-radius:{{ shRadius }};background:rgba(18,14,12,.92);border:1px solid rgba(255,200,160,.16);backdrop-filter:blur(10px);padding:{{ shPad }};display:flex;flex-direction:column;gap:4px;max-height:78%;overflow:auto;box-shadow:0 -20px 60px rgba(0,0,0,.4);transition:left .6s cubic-bezier(.22,.8,.2,1),right .6s cubic-bezier(.22,.8,.2,1),bottom .6s cubic-bezier(.22,.8,.2,1),border-radius .6s,padding .6s`
- **Two geometries:** discovery `shSide:12, shBottom:12, shRadius:20px, shPad:8px 14px 8px` → brief `0, 0, 26px 26px 0 0, 22px 22px 26px`
- **The sheet's rows are NOT `<FactRow>` (S5) — do not reuse it here.** They use **fixed** geometry, not the morph bindings: row `display:flex;align-items:center;gap:12px;min-height:40px;padding:4px 6px;border-radius:10px;font-size:16px;opacity:{{ f.opacity }};background:{{ f.bg }};transition:opacity .35s,background .5s` — i.e. **no `rowGap` / `rowFont` / `f.h` / `f.pad`**, and the inline editing input uses `padding:8px 10px` where the desktop list uses `6px 10px`. The row list container is `display:flex;flex-direction:column;gap:2px;padding-top:6px;animation:rsFadeUp .25s ease both` (`SCOUT_SCREENS.md` §4.4). Reusing `<FactRow>` reproduces the wrong sheet.
- **Sheet header bindings:** title button `data-fact-summary="1"` `flex:1;display:flex;justify-content:space-between;align-items:center;border:0;background:none;color:#f5ece2;font:inherit;font-size:{{ shTitleSize }}px;font-weight:{{ shTitleWeight }};padding:6px 4px;cursor:pointer;text-align:left;transition:font-size .4s` (`15/500` discovery → `22/400` brief) + chevron `16×16 stroke-width:2` `M18 15l-6-6-6 6` with `transform:{{ shChevRot }};transition:transform .3s`. Actions block `<sc-if shActions>` `margin-top:14px;…;animation:rsFadeUp .45s ease both`.
- **shadcn:** `Drawer` is the wrong fit here — it is a *morphing* panel, not a dismissible drawer. **Build custom** and keep the 0.6 s transition; use `Collapsible` only for the row list (the `toggleBrief` disclosure — see E11 call site 14).
- **File:** `src/ui/scout/brief/BriefSheet.tsx`

### D9 · Modal dialog — shadcn `Dialog` / `AlertDialog`
| Instance | Signature |
|---|---|
| S import (3 steps) | scrim `position:absolute;inset:0;z-index:20;background:rgba(6,4,3,.6);animation:stFade .2s ease both`, `onClick=closeImport` · dialog `position:absolute;z-index:21;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,calc(100% - 48px));max-height:calc(100% - 48px);overflow:auto;background:rgba(18,14,11,.98);border:1px solid rgba(255,200,160,.16);border-radius:22px;padding:30px 32px;animation:stFade .25s ease both;box-shadow:0 30px 80px rgba(0,0,0,.5)` |
| S discard | scrim identical but **no click handler** (modal) · dialog `role="alertdialog"` `width:min(440px,calc(100% - 48px));border-radius:20px;padding:26px 28px` + same bg/border/shadow |
- **Δ:** `AlertDialog` must have outside-click dismissal **disabled** to match the discard dialog's scrim; `Dialog` keeps it for the import dialog.
- **Files:** `src/ui/settings/ImportDialog.tsx` · `src/ui/settings/DiscardDialog.tsx`

### D10 · Sidebar shell — `<SidebarShell>` (the `sidebar-13` block)
- **Surfaces:** S root · O nested card
- **Shared signature:** `display:grid;grid-template-columns:296px minmax(0,1fr);border-radius:28px;background:rgba(13,10,8,.8|.82 → adopt .8);border:1px solid rgba(255,190,140,.16 → adopt rgba(255,200,160,.16));overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.35)`
- **Shared `<nav>` (byte-identical):** `padding:36px 26px 30px;border-right:1px solid rgba(255,220,190,.08);display:flex;flex-direction:column;min-height:0;overflow:auto;scrollbar-width:none`
- **Shared content column:** `min-height:0;overflow:auto;padding:42px 46px 40px;scrollbar-width:thin`
- **Differs:** S adds `position:relative;height:100%;min-height:560px` and *is* the component root; O adds `flex:1;max-width:1380px;width:100%;margin:0 auto;position:relative`, has **no** `min-height`, and sits under its own `height:84px;padding:0 36px` header inside `padding:4px 36px 0`
- **shadcn:** `Dialog` → `DialogContent` (p-0 gap-0 overflow-hidden) → `SidebarProvider` (`--sidebar-width: 296px`, `className="items-start"`) → `Sidebar collapsible="none"` + `<main>` with a `Breadcrumb` header + `DialogClose`
- **Δ:** the prototype has **no breadcrumb and no × button**; `sidebar-13` adds both. Breadcrumb text = `Einstellungen / {PAGES[page]}` and `Betrieb / {PAGES[page]}` — use the **nav labels**, not the h1s (O: `Übersicht`, not `Betrieb im Blick`).
- **File:** `src/ui/chrome/SidebarShell.tsx` (props: `minHeight`, `maxWidth`, `header`, `sidebar`, `children`, `overlays`)

### D11 · Sidebar nav item — `<SidebarNavItem>`
- **Surfaces:** S (7) · O (6) — identical recipe
- **Signature:** `display:flex;align-items:center;gap:14px;height:50px;padding:0 14px;border-radius:12px;border:1px solid {{ border }};background:{{ bg }};color:#f5ece2;font:inherit;font-size:16px;cursor:pointer;text-align:left;margin-bottom:4px;transition:background .15s` + hover `background:rgba(255,255,255,.06)` + `aria-current`
- **Active:** `background:rgba(120,58,22,.45)`, `border-color:rgba(255,140,90,.35)`, icon `#ff8a4e` (label stays `#f5ece2`)
- **Icon slot:** `width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:{{ icon }}` around a 20×20 SVG
- **Δ:** in the prototype hovering the **active** item replaces its background with `rgba(255,255,255,.06)` (inline-style ordering artefact). Follow shadcn instead — keep the active background on hover.
- **shadcn:** `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton isActive`
- **File:** `src/ui/chrome/SidebarNavItem.tsx`

### D12 · Sidebar group label & footer
- **Signature (label):** `margin:{34|28}px 10px 10px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a89684` — S „Dein Scout“ / „Dein Konto“; O „Betrieb“
- **Signature (footer):** spacer `flex:1` · divider `height:1px;background:rgba(255,220,190,.1);margin:24px 0 20px` · block `padding:0 10px` with S name `16px/500` + „Persönlicher Bereich“ `14px;color:#a89684`, O „Nur für Betreiber“ `15px;color:#cbb9a8`
- **shadcn:** `SidebarGroupLabel` · `SidebarSeparator` · `SidebarFooter`
- **File:** same as D11

### D13 · Modal scrim — `<Scrim>`
- **Signature:** `position:absolute;inset:0;z-index:{20|30};background:rgba(6,4,3,.55);animation:{stFade|opFade} .2s ease both`
- **The four source scrims, so `.55` is never mistaken for a blanket rewrite:** S connection sheet `rgba(6,4,3,.55)` (SETTINGS §12.1 — **already `.55`, unchanged**) · O diagnostics `rgba(6,4,3,.55)` (OPERATOR, `--op-scrim`, **already `.55`**) · S import dialog `rgba(6,4,3,.6)` (SETTINGS §13.1) · S discard dialog `rgba(6,4,3,.6)` (SETTINGS §6). **Δ:** only the last two move, `.6 → .55`.
- **Click behaviour:** sheet ✅ closes · import ✅ closes · discard ❌ modal
- **shadcn:** `DialogOverlay` / `SheetOverlay` with a `container` prop so it stays inside the shell card
- **File:** folded into D7/D9

### D14 · Sidebar back button — `<SidebarBackButton>`
- **Surfaces:** S (first element in the nav) · O (first element in the nav) — **byte-identical style, different copy**
- **Signature:** `display:flex;align-items:center;gap:12px;border:0;background:none;color:#f5ece2;font:inherit;font-size:16px;cursor:pointer;padding:8px 10px;border-radius:10px;text-align:left` + hover `background:rgba(255,255,255,.06)`
- **Icon:** arrow-left, `viewBox="0 0 24 24" width=20 height=20 fill=none stroke=currentColor stroke-width=1.8 stroke-linecap=round stroke-linejoin=round`, path `M19 12H5M11 6l-6 6 6 6` (lucide `ArrowLeft`)
- **Copy differs per surface:** S „Zurück zum Scout“ (SETTINGS §2.1) · O „Zur App“ (OPERATOR §4.2) — two dictionary keys, `settings.nav.back` and `operator.nav.back`
- **Handlers:** S `back` → `tryNav(() => A.back())` (opens the discard dialog when the autonomy draft is dirty) · O `back` → `A.back()` directly
- **Why it needs its own entry:** it matches **neither B7** (no underline) **nor B8** (B8 is `color:#a89684`, `font-size ≤ 15`, `padding ≤ 6px 10px`, `border-radius 6|8`), and D11/D12 cover only nav items, group labels and the footer. It is the primary exit from both shells.
- **Δ (sidebar-13):** the block also puts a `DialogClose` × in the header — keep **both**; this button stays where the prototype has it.
- **shadcn:** `SidebarMenuButton` (or `Button variant="ghost"`) + wrapper
- **File:** `src/ui/chrome/SidebarBackButton.tsx`

---

## 1.5 Data-display molecules

### E1 · Key/value row — `<KeyValueRow>`
- **Surfaces:** S connection sheet (3 rows) · O diag sheet (3 rows) · O Betriebsregeln (2 rows)
- **Signature:** `display:flex;justify-content:space-between;gap:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,220,190,.1)` with key `color:#a89684`; O Betriebsregeln variant `padding:10px 0;border-bottom:1px solid rgba(255,220,190,.08);font-size:16px` with value `color:#cbb9a8`
- **shadcn:** none (a `Table` is heavier than the markup); optional `<dl>`
- **File:** `src/ui/primitives/KeyValueRow.tsx`

### E2 · Grid table — `<DataGrid>`
- **Surfaces:** O only (3 tables)
- **Header:** `display:grid;grid-template-columns:{cols};gap:12px;padding:10px 14px;font-size:14px;color:#a89684;border-bottom:1px solid rgba(255,220,190,.1)`
- **Row:** `display:grid;grid-template-columns:{cols};gap:12px;align-items:center;padding:{12px 14px|14px};border-bottom:1px solid rgba(255,220,190,.08);font-size:16px` (+ `background:{{ t.bg }};border-radius:10px` on task rows)
- **Column sets:** tasks `1.3fr 1fr 1.2fr 1fr` (`Vorgang · Quelle · Status · Nächster Schritt`) · sources `1.3fr 1fr 1.3fr 1fr` (`Quelle · Region · Anbindung · Letzter Demo-Check`)
- **shadcn:** `Table` for semantics only; **keep CSS grid for layout** (per-row `border-radius:10px` and the amber row tint `rgba(224,161,58,.06)` do not survive a `<table>` cleanly). Build `DataGrid` on `Table` with `display:grid` overrides, or use `role="table"` divs.
- **Δ mobile:** `< 900px` → stacked cards
- **File:** `src/ui/primitives/DataGrid.tsx`

### E3 · Activity timeline (R) — `<ActivityList>`
- **Signature:** panel `width:min(420px,100%);text-align:left;background:rgba(18,14,12,.6);border:1px solid rgba(255,200,160,.12);border-radius:16px;padding:16px 20px;display:flex;flex-direction:column;gap:0;animation:rsFadeUp .3s ease both` · entry `display:grid;grid-template-columns:14px 1fr;gap:12px;align-items:start;padding:7px 0` · dot `margin-top:6px;width:8px;height:8px;border-radius:50%;background:{{ a.dot }};justify-self:center` (`#ff6926` for the **last** entry, `rgba(255,220,190,.35)` for all earlier) · text `font-size:15px;color:#f5ece2` · meta `font-size:12.5px;color:#a89684;margin-top:2px`
- **shadcn:** `Collapsible` for the toggle + custom list (**not** a `Table`)
- **File:** `src/ui/scout/autopilot/ActivityList.tsx`

### E4 · Event timeline (O) — `<EventTimeline>`
- **Signature (page):** `display:grid;grid-template-columns:110px 1fr;gap:16px;padding:12px 0;border-bottom:1px solid rgba(255,220,190,.08);font-size:15.5px`, time cell `color:#a89684`
- **Signature (sheet):** `display:grid;grid-template-columns:100px 1fr;gap:12px;padding:6px 0;border-bottom:1px solid rgba(255,220,190,.06);font-size:14.5px`
- **shadcn:** none — same custom timeline in both places, `size` prop
- **File:** `src/ui/operator/EventTimeline.tsx`

### E5 · Stat cell — `<StatCell>`
- **Surfaces:** S Tarif & Nutzung (3 cells)
- **Signature:** grid `display:grid;grid-template-columns:repeat(3,minmax(0,1fr))` · cell 1 `padding:6px 0`, cells 2–3 `padding:6px 0 6px 28px;border-left:1px solid rgba(255,220,190,.12)` · value `font-size:40px;font-weight:500;letter-spacing:-.02em` · label `margin-top:2px;font-size:16px;color:#cbb9a8` · the third cell's value is text: `font-size:22px;font-weight:400;padding-top:12px;color:#e2d3c3` + label `margin-top:6px`
- **Δ mobile:** single column, drop the `border-left`
- **shadcn:** none (no `Progress`, no chart)
- **File:** `src/ui/settings/UsageStats.tsx`

### E6 · Photo placeholder — `<PhotoPlaceholder>`
- **Surfaces:** R offer card, R candidate cards
- **Signature:** `min-height:{{ offerImgMin }}px;height:100%|height:150px;background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 10px,rgba(255,255,255,.02) 10px 20px);display:flex;align-items:center;justify-content:center;font-family:ui-monospace,Menlo,monospace;font-size:{13|12.5}px;color:#a89684`
- **Note:** the monospace here is **shipped product UI**, not dev chrome — the port needs a mono stack
- **shadcn:** none (`Skeleton` is animated and the wrong texture)
- **File:** `src/ui/primitives/PhotoPlaceholder.tsx` (`.rs-photo-placeholder` exists)

### E7 · Skeleton bar — shadcn `Skeleton`
- **Surfaces:** L bento card C only
- **Signature:** `height:6px;border-radius:3px;background:rgba(255,255,255,.12)` at `width:80%|70%|60%|50%|75%`, `margin-top:8px` on the first bar of each card, `6px` on the second
- **Note:** static, no shimmer — disable `Skeleton`'s pulse animation
- **File:** `src/ui/landing/bento/SourcesCard.tsx`

### E8 · Chat bubble — `<Bubble>`
Two systems; **do not merge** (TOKENS.md §B6).
- **Transcript (R, both speakers):** `max-width:88%;padding:10px 14px;border-radius:{{ m.radius }};background:{{ m.bg }};font-size:15px;line-height:1.45;text-align:left`, speaker label above `font-size:12px;color:#a89684;gap:4px` — scout `rgba(255,255,255,.06)` / `14px 14px 14px 4px` / `align-items:flex-start`; user `rgba(120,58,22,.6)` / `14px 14px 4px 14px` / `flex-end`
- **Stage (user only, 3 sizes):** R clarification `align-self:flex-end;max-width:80%;padding:14px 20px;border-radius:18px 18px 4px 18px;background:rgba(120,58,22,.75);border:1px solid rgba(255,140,90,.35);font-size:17px;text-align:left;animation:rsFadeUp .35s ease both` · R QA `padding:12px 18px;font-size:16px` · L answer `padding:13px 18px;font-size:16px`, **no `max-width`**
- **Scout reply (stage):** no bubble at all — `align-self:flex-start;max-width:{80%|85%};font-size:{18|17|16}px;text-align:left;padding:{6px 4px|4px|4px 4px}`. Per call site: R clarification `max-width:80%;font-size:18px;padding:6px 4px` · L answer `max-width:80%;font-size:17px;padding:4px` · **R offer-review QA answer `align-self:flex-start;max-width:85%;font-size:16px;line-height:1.5;padding:4px 4px`** — `85%`, *not* 80 % (`SCOUT_SCREENS.md` §11.1, `Roomscout.dc.html:402`)
- **L bento card B** adds a third, boxed variant: provider `padding:12px 16px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,220,190,.1)`; scout `background:rgba(120,58,22,.35);border:1px solid rgba(255,140,90,.3)`, both with a `12.5px` meta row
- **There is no `18px 18px 18px 4px` anywhere** — the scout corner is only ever the 14px set
- **shadcn:** none — custom; `Avatar` only for the L provider circle
- **File:** `src/ui/primitives/Bubble.tsx`

### E9 · Accordion row (three flavours)
| Flavour | Surfaces | Signature |
|---|---|---|
| Source row | S | wrapper `border-radius:18px;background:{{ rowBg }};border:1px solid {{ rowBorder }};margin-bottom:{{ mb }}px;transition:background .25s,border-color .25s` (open → `rgba(255,255,255,.035)` / `rgba(255,200,160,.14)` / `8`) · head `display:grid;grid-template-columns:56px minmax(0,1fr) auto auto auto;align-items:center;gap:18px;padding:16px 16px 16px 14px` · body `display:grid;grid-template-rows:{{ rows }};transition:grid-template-rows .26s cubic-bezier(.3,.7,.2,1)` → inner `overflow:hidden;min-height:0` → content `margin:0 16px;padding:16px 8px 18px;border-top:1px solid rgba(255,220,190,.1);display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap` |
| Integration row | O | container `border-bottom:1px solid rgba(255,220,190,.1)` · trigger `width:100%;display:grid;grid-template-columns:1.2fr 1.3fr 1fr auto;gap:14px;align-items:center;padding:16px 10px;border:0;background:none;color:#f5ece2;font:inherit;font-size:16px;text-align:left;cursor:pointer;border-radius:10px` + hover `rgba(255,255,255,.04)` · panel `padding:4px 10px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 24px;font-size:14.5px;line-height:1.6;animation:opFade .2s ease both` |
| FAQ item | L | `border-radius:18px;border:1px solid {{ q.border }};background:rgba(18,14,12,.6);transition:border-color .3s` · button `width:100%;display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;border:0;background:none;color:#f5ece2;font:inherit;font-size:clamp(18px,1.5vw,22px);text-align:left;cursor:pointer;border-radius:18px` · body `display:grid;grid-template-rows:{{ q.rows }};transition:grid-template-rows .32s cubic-bezier(.3,.7,.2,1)` → `padding:0 26px 24px;font-size:16px;line-height:1.6;color:#cbb9a8` |
- **Chevron:** S `18×18 sw2` `M6 9l6 6 6-6` `transform:{{ chev }};transition:transform .25s` · O `16×16 sw2` same path, `.2s` · L a circled **plus→minus**: `width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,220,190,.3);transition:transform .3s;transform:{{ q.rot }}` wrapping `<path d="M5 12h14"/><path d="M12 5v14" style="opacity:{{ q.plusOp }}"/>`
- **L FAQ binding values (LANDING §11) — all four, or the open state cannot be built:** `q.border` open `rgba(255,105,38,.7)` / closed `rgba(255,200,160,.14)` · `q.rows` open `1fr` / closed `0fr` · `q.rot` open `rotate(180deg)` / closed `none` · `q.plusOp` open `0` (the vertical stroke disappears → minus) / closed `1` (plus). Single-open accordion; `toggle: () => setState(st => ({ faq: st.faq === i ? -1 : i }))`, and **item 0 is open on load** (`faq: 0` in the initial state) → `Accordion defaultValue="item-0"`.
- **shadcn:** `Accordion type="single" collapsible` for all three; the S/O accordions must be **controlled** (`openInt` is written by the overview tiles too). Keep the `grid-template-rows: 0fr↔1fr` technique or accept Radix's height keyframes — but keep the timings (`.26s` / `.32s` `cubic-bezier(.3,.7,.2,1)`).
- **Files:** `src/ui/settings/SourceRow.tsx` · `src/ui/operator/IntegrationRow.tsx` · `src/ui/landing/FaqSection.tsx`

### E10 · Tabs — shadcn `Tabs`
- **Surfaces:** S knowledge (`Eure Band` / `Alltag & Wege` / `Ausstattung`)
- **Signature:** tablist `role="tablist"` `margin-top:22px;display:flex;gap:6px;border-bottom:1px solid rgba(255,220,190,.1)` · trigger `role="tab" aria-selected` `height:44px;padding:0 20px;border:0;background:none;color:{{ t.color }};font:inherit;font-size:17px;cursor:pointer;border-bottom:2px solid {{ t.line }};margin-bottom:-1px;transition:color .15s` — active `color:#ff8a4e`, `border-bottom-color:#ff6926`; inactive `color:#cbb9a8`, `transparent`
- **Side effect to preserve:** switching a tab sets `editId:null` and `menuId:null` and **nothing else** — `originId` survives
- **shadcn:** `Tabs` + `TabsList` + `TabsTrigger` (underline variant)
- **File:** `src/ui/settings/KnowledgeTabs.tsx`

### E11 · Collapsible disclosure — shadcn `Collapsible`
Same primitive, **fourteen** call sites: (1–3) R brief pill+panel — autopilot, offer, candidates · (4) R activity · (5) R full terms · (6) R QA panel · (7) **R mobile brief sheet** — the `toggleBrief` disclosure on `data-fact-summary="1"`, where `shRowsVisible = briefOpen` during discovery and the chevron rotates 180° (`SCOUT_SCREENS.md` §4.4; the only disclosure that is *always open* in the brief geometry) · (8) S details A/B · (9) S Weitere Grenzen · (10) S Weitere Quellen · (11) S Änderungsverlauf · (12) S Tarife · (13) S Zahlungsdaten · (14) O task detail row.
- **Common trigger label pattern:** the label itself flips (`Aktivität ansehen` ↔ `Aktivität ausblenden`, `Weitere Quellen ansehen` ↔ `…ausblenden`, `Vollständige Bedingungen anzeigen` ↔ `…ausblenden`, `Änderungsverlauf ansehen` ↔ `…ausblenden`) — two dictionary keys per toggle, never a computed string.
- **File:** call sites; no shared wrapper needed beyond `LinkButton`/`QuietButton`.

### E12 · Avatar — shadcn `Avatar`
| Instance | Signature |
|---|---|
| R header initials | `width:{{ hdrBtn }}px;height:{{ hdrBtn }}px;border-radius:50%;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;font-size:13px;font-weight:500` |
| O operator `OP` | `width:42px;height:42px` + same border/background, `font-size:13px;font-weight:500`, `aria-label="Operator"` |
| S profile initials | `width:72px;height:72px;border-radius:50%;border:1px solid rgba(255,220,190,.22);background:rgba(255,255,255,.04);font-size:22px;font-weight:500` — computed from the **live, unsaved** `nameDraft`, not `data.initials` |
| S source avatar | `width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,220,190,.18);background:rgba(255,255,255,.04);font-size:22px;font-weight:500` + a 30×30 logo `object-fit:contain` or a 22×22 stroked SVG |
| L provider circle (bento B) | `width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.06);border:1px solid rgba(255,220,190,.14);display:flex;align-items:center;justify-content:center;color:#e2d3c3` + an 18×18 building SVG `stroke-width:1.6`, **`stroke-linejoin` only, no `stroke-linecap`**: `<path d="M4 21V5h9v16M13 9h7v12"/><path d="M7 9h3M7 13h3M7 17h3M16 13h1M16 17h1"/>` |
| L **scout avatar chip** (bento B, the reply) | **not a circle** — `width:44px;height:44px;border-radius:62% 38% 46% 54%/44% 58% 42% 56%;background:radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 60%);box-shadow:0 0 18px rgba(255,105,38,.4);display:block`. A **2-stop** gradient (the blob's is 4-stop) and the small `.4` glow tier; **no animation**. Build it from the `<MiniBlob>` recipe (see A2 / V6), not from `Avatar` |
- **Initials rule (shared):** `name.trim() === 'Herzbuben' ? 'HB' : words.length > 1 ? first letters ×2 : first two chars`, uppercased; fallback `HB` (R) / `–` en-dash (S)
- **File:** `src/ui/primitives/RsAvatar.tsx` + `src/lib/initials.ts`

---

# Part 2 · Surface-specific molecules

## 2.1 Scout (R)

### S1 · Voice blob — `<ScoutBlob>` **(custom, the single most load-bearing component)**
- **Element:** outer `position:absolute;z-index:3;pointer-events:none;opacity:0;transition:left .9s cubic-bezier(.22,.8,.2,1),top .9s cubic-bezier(.22,.8,.2,1),width .9s cubic-bezier(.22,.8,.2,1),height .9s cubic-bezier(.22,.8,.2,1),opacity .6s` · inner `width:100%;height:100%;border-radius:62% 38% 46% 54%/44% 58% 42% 56%;background:radial-gradient(circle at 42% 38%,#ffc39a 0%,#ff8a4e 28%,#ff6926 58%,#e9511a 100%);box-shadow:0 0 34px 6px rgba(255,120,50,.35),0 0 110px 20px rgba(255,105,38,.18);animation:{{ blobAnim }};transition:box-shadow .6s`
- **Mechanism:** one DOM node inside `<main>`, teleported between per-stage `div[data-blob-anchor="1"]` boxes. `syncBlob()` runs on mount, on every update and on `window.resize` (`SCOUT_SCREENS.md` §3.2):
  ```
  a = main.querySelector('[data-blob-anchor]')
  if (!a) { blob.style.opacity = '0'; return }
  blob.left  = a.rect.left - main.rect.left                    // no scroll term
  blob.top   = a.rect.top  - main.rect.top + main.scrollTop    // scrollTop only here
  blob.width = a.rect.width ; blob.height = a.rect.height ; blob.opacity = '1'
  ```
  **`main.scrollTop` is added to `top` only** — `left` is a plain rect delta. No anchor → `opacity:0`.
- **Anchor sizes:** welcome `168/128` (+mb `56/36`) · discovery `voice 160/120, text 104/88` (+mb 28, `transition:width .6s,height .6s,margin .6s`) · brief `96` · autopilot `160/112` (+mb `48/30`) · clarification `118` (+mb 34) · offer `58` (**below** the offer card, in the „Soll ich euch das Angebot erklären?“ row) · offer_review `64` (+mb 22) · complete `96` (+mb 40) · dead_end `110` (+mb 30) · candidates `72` (+mb 22)
- **`blobAnim` by `scoutState`:** `speaking → rsSpeak 1.7s ease-in-out infinite` · `listening → rsListen 4.2s` · `thinking → rsBreathe 2.4s` · `idle → rsBreathe 5.2s`
- **shadcn:** none. Implement as `<div>` + CSS keyframes + a `useAnchorBox(activeStageKey)` hook (ResizeObserver + scroll listener on the scroll container).
- **Files:** `src/ui/scout/blob/ScoutBlob.tsx`, `src/ui/scout/blob/useBlobAnchor.ts`, `src/ui/scout/blob/BlobAnchor.tsx`

### S2 · Utterance — `<Utterance>`
- **Signature:** `<p data-utter aria-live="polite">` `margin:12px 0 0;font-size:{{ utterSize }};line-height:1.16;font-weight:300;letter-spacing:-.015em;max-width:{{ utterMaxWidth }};text-wrap:balance;color:#f8f0e7` — `#f8f0e7` is used **nowhere else**
- **Sizes:** desktop voice `clamp(28px,3.6vw,46px)`, desktop text `clamp(24px,3vw,36px)`; narrow `28px` / `24px`
- **Max width:** `min(760px, calc(100vw - 660px))` when `!narrow && facts.length > 0`, else `760px`
- **Reveal:** rendered as `{revealedWords}` + `<span style="opacity:0">{hiddenRemainder}</span>` — the hidden span **reserves layout width so the paragraph never reflows**. Per-word interval `(scout ? 78 : 96) / speed` ms. Text mode or reduced motion → instant.
- **shadcn:** none (live region)
- **File:** `src/ui/scout/discovery/Utterance.tsx`

### S3 · Speaker line — `<SpeakerLine>`
- **Signature:** `display:flex;align-items:center;gap:10px;font-size:15px;color:#cbb9a8;min-height:22px` · name `font-weight:500;color:#e2d3c3` · separator `<span style="color:#8f7e6e">·</span>` (`#8f7e6e` used **only** here) · state text
- **File:** same as S2

### S4 · Fact capsule — `<FactCapsule>` + `useCapsuleFlight()`
- **Signature:** `data-capsule="1"` `display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;border-radius:999px;background:rgba(255,105,38,.16);border:1px solid rgba(255,140,90,.5);color:#ffd9c4;font-size:14px;font-weight:500;white-space:nowrap;animation:rsFadeUp .3s ease both` inside a `height:48px;display:flex;align-items:center;justify-content:center;margin-top:6px` row
- **Flight (WAAPI, must be JS):** clone the capsule node into `<main>` at `position:absolute;margin:0;z-index:20;pointer-events:none;will-change:transform`, strip `animation` and `data-capsule`; animate `translate(0,0) scale(1) opacity 1` → offset `.5` `translate(dx*.55, dy*.5-46) scale(.96)` → `translate(dx,dy) scale(.9) opacity 0`; `duration:580, easing:cubic-bezier(.3,.7,.2,1), fill:forwards`. `dx = targetLeft + 8 − capsuleLeft`, `dy = targetTop + (targetH − capsuleH)/2 − capsuleTop`. Target `[data-fact-row="<id>"]`, fallback `[data-fact-summary]`.
- **Timing:** capsule shown → 650 ms → flight starts; 400 ms into the flight → `commitFact` (row grows, label fades 350 ms); on finish → 300 ms → next fact; after the last fact → 600 ms → next script step.
- **Reduced motion / missing node:** commit immediately, no clone.
- **shadcn:** `Badge` for the static chip; the flight is custom
- **Files:** `src/ui/scout/brief/FactCapsule.tsx`, `src/ui/scout/brief/useCapsuleFlight.ts`

### S5 · Fact list (float ⇄ card morph) — `<FactList>`
- **Container:** `data-fact-list="1"` `position:absolute;z-index:4;left:{{ listLeft }};top:{{ listTop }}px;width:{{ listWidth }}px;padding:{{ listPad }};border-radius:{{ listRadius }}px;background:{{ listBg }};border:1px solid {{ listBorder }};box-shadow:{{ listShadow }};opacity:{{ listOpacity }};transform:{{ listTransform }};text-align:left;display:flex;flex-direction:column;gap:{{ listGap }}px;transition:left .9s cubic-bezier(.22,.8,.2,1),top .9s cubic-bezier(.22,.8,.2,1),width .9s cubic-bezier(.22,.8,.2,1),padding .9s cubic-bezier(.22,.8,.2,1),border-radius .9s,background .9s,border-color .9s,gap .9s,opacity .5s,transform .5s`
- **Two value sets (float → card):** left `calc(100% - 312px)` → `calc(50% - cardW/2 px)` · top `20` → `236` · width `288` → `Math.min(540, Math.max(280, mainWidth - 32))` · pad `12px 14px 12px` → `26px 28px 28px` · radius `16` → `26` · bg `rgba(18,14,12,.42)` → `rgba(18,14,12,.74)` · border `rgba(255,200,160,.10)` → `.16` · shadow `none` → `0 30px 80px rgba(0,0,0,.35)` · gap `2` → `6` · head margin `4` → `10` · head font `11.5` → `22` · head weight `500` → `400` · head tracking `.09em` → `-.01em` · head transform `uppercase` → `none` · head colour `#a89684` → `#f5ece2` · row gap `10` → `16` · row font `13.5` → `17`; `leaving` adds `opacity:0;transform:scale(.94) translateY(10px)`
- **Row:** `data-fact-row="{{ f.id }}"` `display:flex;align-items:center;gap:{{ rowGap }}px;height:{{ f.h }}px;padding:{{ f.pad }};border-radius:10px;font-size:{{ rowFont }}px;opacity:{{ f.opacity }};background:{{ f.bg }};overflow:hidden;transition:padding .9s,font-size .9s,gap .9s,height .9s,opacity .35s,background .5s` — `f.h` `0` arriving / `34` float / `44` card; `f.bg` `rgba(255,105,38,.2)` while `changed`
- **State that gates the container and its controls (do not leave it out — it is the brief stage's entrance):**
  - `state.listMode ∈ { hidden, float, card, leaving }`; `card = listMode === 'card' || listMode === 'leaving'`; `listVisible = !narrow && listMode !== 'hidden' && (listMode !== 'float' || facts.length > 0)`
  - `state.headlineShown` (boolean) → `headlineOpacity` on the brief headline (`transition:opacity .5s`)
  - `state.cardArrived` (boolean) → `showEditBtn = card && cardArrived && !editing` (the 36 px pencil) and `cardActions = card && cardArrived && !editing && stage === 'brief_review'` (the **whole** „Scout losschicken“ action block). On narrow the same flag drives `shEditBtn`/`shActions` in the sheet (D8).
  - Timing: `morphToBrief()` sets `headlineShown` at **450 ms** and `cardArrived` at **950 ms**; `startScouting()` sets `listMode:'leaving'` immediately and `listMode:'hidden'` at **600 ms**. Entering `brief_review` directly (`viewBrief`, „Suchauftrag ansehen“) sets `listMode:'card'`, `headlineShown:true`, `cardArrived:true` in one go — no entrance animation. `backToConvo` resets both to `false`.
- **shadcn:** `Card` + `Input` + `Button` for the actions; **the morph itself is custom** — float and card must be the *same element* or the 0.9 s transition is lost
- **File:** `src/ui/scout/brief/FactList.tsx`, `FactRow.tsx`

### S6 · Brief pill + panel — `<BriefDisclosure>`
- **Pill (3 variants):** autopilot `height:50px;padding:0 20px;font-size:16px;background:rgba(20,14,10,.55);border:1px solid rgba(255,200,160,.18)` + hover `rgba(30,22,16,.7)` + magnifier 18×18 + chevron **down** · offer `height:44px;padding:0 18px;font-size:15px;background:rgba(20,14,10,.5);border:1px solid rgba(255,200,160,.16);color:#d8c8b8` + hover `color:#fff` + list icon 16×16 + chevron **up** · candidates `height:40px;padding:0 16px;font-size:14px` same fills + chevron down
- **Panel:** `margin-top:10px;width:min(380px,100%);text-align:left;background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:16px;padding:14px 18px;display:flex;flex-direction:column;gap:9px;animation:rsFadeUp .3s ease both`
- **Panel rows (own recipe — not `<FactRow>`, no icons):** `font-size:15px;color:#f5ece2;padding:2px 0;border-radius:6px;background:{{ f.bg }};transition:background .5s` (`SCOUT_SCREENS.md` §8.6). The `background .5s` is a real transition missing from earlier drafts of §5.2.
- **Three different bodies:** autopilot + offer render the label „Euer Suchauftrag“ then rows; **candidates renders rows only, no label**, and the panel is a **sibling below** the footer flex row, not a third child of it
- **Offer ordering is inverted:** panel *above* the pill, and `offerPillTop` = `10` when open / `34` when closed
- **shadcn:** `Collapsible` + `Button` + `Card`
- **File:** `src/ui/scout/brief/BriefDisclosure.tsx`

### S7 · Offer card — `<OfferCard>`
- **Signature:** `width:min(1190px,100%);display:grid;grid-template-columns:{{ offerCols }};background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:24px;overflow:hidden;text-align:left;animation:rsFadeUp .7s .1s ease both` — `offerCols` `minmax(0,1fr) minmax(0,1.05fr)` / narrow `1fr`
- **Media:** `<img …style="display:block;width:100%;height:100%;min-height:{{ offerImgMin }}px;max-height:{{ offerImgMax }}px;object-fit:cover">` (`380/470` desktop, `200/240` narrow) or E6
- **Body:** `padding:clamp(24px,3vw,44px) clamp(24px,3.4vw,56px);display:flex;flex-direction:column;justify-content:center;min-width:0` · eyebrow (A3 accent, `letter-spacing:.16em`) · title `margin-top:18px;font-size:clamp(24px,2.4vw,32px);font-weight:400;letter-spacing:-.01em` · price `margin-top:6px;font-size:clamp(38px,3.8vw,52px);font-weight:400;letter-spacing:-.02em;line-height:1.1` + `<span style="font-size:.6em;color:#e2d3c3">` · note `margin-top:6px;font-size:18px;color:#cbb9a8` · terms `margin-top:24px;display:flex;flex-direction:column;gap:10px;font-size:17px`, row `display:flex;align-items:center;gap:12px` + check `18×18 stroke:#ff6926 stroke-width:2.2 linecap/linejoin round` `M5 12.5l4.5 4.5L19 7.5` · CTA B1(54) · footnote `margin-top:16px;font-size:14px;color:#a89684`
- **shadcn:** `Card` + `AspectRatio` (media) + `Badge` (eyebrow) + `Button`
- **File:** `src/ui/scout/offer/OfferCard.tsx`

### S8 · Review card + terms — `<ReviewCard>` / `<TermsGrid>`
- **Card:** `width:min(720px,100%);background:rgba(18,14,12,.72);border:1px solid rgba(255,200,160,.14);border-radius:24px;padding:28px clamp(22px,3vw,36px) 30px;text-align:left;animation:rsFadeUp .5s ease both`
- **Head row — exactly two flex children:** `<div style="display:flex;align-items:center;gap:18px">` containing the `112×84` image (`object-fit:cover;border-radius:12px;flex:none`, **always rendered**) and an **unstyled `<div>`** stacking the eyebrow above the price line. Laying eyebrow and price out as siblings of the flex row is wrong.
- **Terms grid:** `margin:24px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px 24px;font-size:16px`, item `display:flex;gap:12px;align-items:flex-start` + check `flex:none;margin-top:2px`
- **Full terms block:** `margin-top:8px;padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.04);font-size:14.5px;line-height:1.6;color:#e2d3c3;animation:rsFadeUp .3s ease both` + footnote `margin-top:8px;font-size:12.5px;color:#a89684`
- **shadcn:** `Card` + `Collapsible` + `Button` + `Separator`
- **File:** `src/ui/scout/offer/ReviewCard.tsx`

### S9 · Candidate card — `<CandidateCard>`
- **Card:** `display:flex;flex-direction:column;background:rgba(18,14,12,.72);border:1px solid {{ c.border }};border-radius:22px;overflow:hidden;position:relative` in a grid `margin-top:28px;width:min(1180px,100%);display:grid;grid-template-columns:{{ candCols }};gap:14px;text-align:left;animation:rsFadeUp .6s .1s ease both`
- **Best badge:** `position:absolute;top:14px;left:14px;z-index:2;padding:5px 11px;border-radius:999px;background:#ff6926;color:#fff;font-size:12.5px;font-weight:600;letter-spacing:.04em`
- **Media:** `<img style="display:block;width:100%;height:150px;object-fit:cover">` or E6 at `height:150px`
- **Body:** `padding:20px 22px 22px;display:flex;flex-direction:column;gap:14px;flex:1` · name `19px` · price `margin-top:4px;font-size:30px;font-weight:400;letter-spacing:-.02em` · budget note `margin-top:2px;font-size:13.5px;color:{{ c.budgetColor }}` · spec list `display:flex;flex-direction:column;gap:9px;font-size:15px;padding-top:12px;border-top:1px solid rgba(255,220,190,.1)` (clock / check-or-amber-X / pin / house, all 18×18 `flex:none;margin-top:1px`) · scout note row `display:flex;gap:10px;align-items:flex-start;font-size:14.5px;color:#e2d3c3;padding-top:10px;border-top:1px solid rgba(255,220,190,.1)` with a **mini blob** `margin-top:5px;width:10px;height:10px;border-radius:46% 54% 52% 48%/55% 45% 55% 45%;background:#ff6926;flex:none;box-shadow:0 0 8px rgba(255,105,38,.5)` — a flat `#ff6926` fill (**no gradient**) and **no animation**; build it from `<MiniBlob>` (A2 / V6), **not** from `<StatusDot>` · spacer `flex:1` · CTA `height:48px;border-radius:999px;border:1px solid {{ c.btnBorder }};background:{{ c.btnBg }};color:#fff;font:inherit;font-size:15px;font-weight:600` + hover **`filter:brightness(1.1)`** (applies to both the orange and the translucent variant, so the effect differs per card)
- **Derived styling:** best → border `rgba(255,140,90,.5)`, btn `#ff6926`/`#ff6926`; others → `rgba(255,200,160,.14)`, `rgba(255,255,255,.06)`/`rgba(255,220,190,.28)`
- **shadcn:** `Card` + `Badge` + `Button`
- **File:** `src/ui/scout/offer/CandidateCard.tsx`

### S10 · Clarification card — `<ClarificationCard>`
- **Card:** `margin-top:28px;width:min(740px,100%);background:rgba(18,14,12,.66);border:1px solid rgba(255,200,160,.14);border-radius:22px;padding:34px 36px 30px;animation:rsFadeUp .5s ease both` · eyebrow A3 · question `margin-top:14px;font-size:clamp(24px,2.6vw,34px);line-height:1.2;font-weight:300;letter-spacing:-.01em;text-wrap:balance` · detail `margin-top:16px;font-size:16px;color:#cbb9a8` · answers `margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;justify-content:center` (B11 ×2)
- **Conversation strip:** `width:min(740px,100%);display:flex;flex-direction:column;gap:12px;margin-top:18px;min-height:0` (E8)
- **shadcn:** `Card` + `Button` ×2 + `ComposerPill`
- **File:** `src/ui/scout/offer/ClarificationCard.tsx`

### S11 · Dead-end option row — `<OptionRow>`
- **Signature:** `display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 16px;border-radius:14px;border:1px solid rgba(255,200,160,.16);background:rgba(255,255,255,.04);color:#f5ece2;font:inherit;text-align:left;cursor:pointer` + hover `background:rgba(255,255,255,.09)` + chevron-right `18×18 sw2` `M9 6l6 6-6 6` `flex:none`; title `display:block;font-size:17px`, subtitle `display:block;margin-top:2px;font-size:14px;color:#cbb9a8`
- **shadcn:** `Button variant="outline"` full-width `justify-between`
- **File:** `src/ui/scout/offer/DeadEndCard.tsx`

### S12 · Approval card — `<ApprovalCard>`
- **Signature:** `margin-top:26px;width:min(680px,100%);text-align:left;background:rgba(18,14,12,.72);border:1px solid rgba(255,140,90,.3);border-radius:20px;padding:24px 26px;animation:rsFadeUp .4s ease both` · eyebrow A3 accent · recipient `margin-top:10px;font-size:14px;color:#a89684` + `<span style="color:#e2d3c3">` · body `margin-top:12px;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,.04);font-size:15px;line-height:1.55;color:#f5ece2` · optional note `margin-top:10px;font-size:13.5px;color:#cbb9a8` · actions `margin-top:16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap` (B2-pill 46 + B7)
- **Reachability:** unreachable in the default flow (`RULES0.mode='autopilot'`, `contact:true`) — only after Settings → Autonomie changes
- **shadcn:** `Card` + `Badge` + `Button` + `LinkButton`
- **File:** `src/ui/scout/autopilot/ApprovalCard.tsx`

### S13 · QA panel — `<QaPanel>`
- **Signature:** `margin-top:8px;width:min(720px,100%);display:flex;flex-direction:column;align-items:center;gap:12px;animation:rsFadeUp .3s ease both` + B10 chip + E8 bubbles + C6 composer (56, send 40, **no hover declared**)
- **File:** `src/ui/scout/offer/QaPanel.tsx`

---

## 2.2 Settings (S)

### T1 · Session line — `<SessionLine>`
`margin:14px 10px 0;display:flex;align-items:flex-start;gap:9px;font-size:12.5px;line-height:1.4;color:#cbb9a8` + dot `margin-top:5px;width:7px;height:7px;border-radius:50%;background:#ff6926;flex:none` → `src/ui/settings/SessionLine.tsx`

### T2 · Settings row (generic) — `<SettingsRow>`
Four shapes, all in `src/ui/settings/SettingsRow.tsx`:
| Shape | Signature |
|---|---|
| Split row (title/sub ↔ control) | `display:flex;align-items:center;justify-content:space-between;gap:20px;padding:{14|16|18|20|22}px 0;border-bottom:1px solid rgba(255,220,190,.1)` |
| Bordered block (auto-sources) | `margin-top:26px;padding:22px 0;border-top:…;border-bottom:1px solid rgba(255,220,190,.1);display:flex;align-items:center;justify-content:space-between;gap:20px` |
| Icon grid row (address, import, payment) | `display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:{start|center}` + a 26×26 SVG at `stroke-width:1.5` |
| Text-only block (privacy 5 & 6) | title `font-size:17px` + body `margin-top:2px;font-size:14.5px;color:#cbb9a8;line-height:1.6` |

### T3 · Knowledge row — `<KnowledgeRow>`
- **Signature:** `display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:14px;align-items:center;padding:14px 8px;border-bottom:1px solid rgba(255,220,190,.1);border-radius:10px;background:{{ k.bg }};transition:background .5s;position:relative` — `k.bg` `rgba(255,105,38,.18)` for 1200 ms after edit/confirm
- **Icon cell:** `width:26px;height:26px;display:flex;align-items:center;justify-content:center;color:#e2d3c3` around a 22×22 `stroke-width:1.5` SVG (or a `20px` `€` glyph — the Euro "icon" is text, not SVG)
- **Right cell A (assumed):** `Stimmt` (B7, hover `#ff8a4e`) + `Nicht wichtig` (B8, hover `#fff`), both `height:38px;padding:0 14px`
- **Right cell B (tools):** two 40px B9 (pencil, kebab) + D3 menu
- **Badge:** `display:inline-flex;margin-top:6px;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,140,90,.5);background:rgba(255,105,38,.12);font-size:13px;color:#ffd9c4`
- **shadcn:** `Badge` + `DropdownMenu` + `Input`/`Button` for the inline form
- **File:** `src/ui/settings/KnowledgeRow.tsx`

### T4 · Scout address block — `<ScoutAddress>`
`display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:20px;align-items:start` + mail icon 26×26 + address `data-scout-address="1";margin-top:4px;font-size:17px;color:#f5ece2;user-select:all` + copy B3(46) whose label flips `Kopieren` ↔ `Kopiert` (1600 ms) + amber fail line `margin-top:6px;font-size:13.5px;color:#e0a13a` (4000 ms).
**Keep the synchronous no-Clipboard-API branch** — a promise-only implementation silently does nothing on http/older browsers/sandboxed iframes. → `src/ui/settings/ScoutAddress.tsx`, `src/lib/copy.ts`

### T5 · Save/discard bar — `<SaveBar>`
`margin-top:22px;min-height:52px;display:flex;justify-content:flex-end;align-items:center;gap:12px` — the `min-height` reserves the space so nothing jumps; saved message `font-size:14.5px;color:#cbb9a8;margin-right:auto;animation:stFade .2s ease both` (2600 ms) → `src/ui/settings/SaveBar.tsx`

### T6 · Import dialog steps — `<ImportDialog>`
Header row `display:flex;justify-content:space-between;align-items:center` with eyebrow `Schritt {n} von 3` + title `margin:6px 0 0;font-size:24px;font-weight:500` + 40px close. Prompt box `padding:16px 18px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,200,160,.14);font-size:14.5px;line-height:1.6;color:#f5ece2;user-select:all`. Textarea on step 2 = **C5b**.

**Footers — three different recipes, not one** (`SETTINGS_SCREENS.md` §13.2–13.5), all sharing `margin-top:18px;display:flex;gap:10px`:

| Step | Footer |
|---|---|
| 1 „Kontext vorbereiten“ and 2 „Ergebnis einfügen“ | `justify-content:space-between;flex-wrap:wrap` (step 2's right group is its own `display:flex;gap:10px`) |
| 3a free text | `justify-content:flex-end` — **right-aligned, no `flex-wrap`** |
| 3b candidate list | `justify-content:space-between;align-items:center;flex-wrap:wrap` (the left cell is the „{n} ausgewählt“ counter) |

→ `src/ui/settings/ImportDialog.tsx`

### T7 · Connection sheet states — `<ConnectionSheet>`
Four mutually exclusive bodies (`info+connected`, `confirm`, `info+disconnected`, `login`) + a `role="status"` message line. The login card is the only **dashed** border in Settings: `border:1px dashed rgba(255,200,160,.35)`.
**Δ:** parameterise by source id — the prototype hard-wires `roomscout` regardless of which portal row opened it, and restores focus to the *first* `[data-conn-trigger]`. → `src/ui/settings/ConnectionSheet.tsx`

---

## 2.3 Operator (O)

### U1 · Operator header — `<OperatorHeader>`
`height:84px;display:flex;align-items:center;justify-content:space-between;padding:0 36px;flex:none`; left `gap:14px` = A1 + INTERN badge; right `gap:14px` = env pill (D2 recipe at `height:42px;padding:0 18px;border:1px solid rgba(255,220,190,.18);background:rgba(255,255,255,.04);font-size:14.5px` + 8px green dot) + 42px avatar. Static, no handlers.
**`INTERN` badge (OPERATOR §3.2) — a static text badge, no atom in Part 1 covers it:** `padding:5px 10px;border-radius:8px;border:1px solid rgba(255,140,90,.6);color:#ff8a4e;font-size:12px;letter-spacing:.12em;font-weight:600`. Padding-sized (no `height`), `border-radius:8px` (not a pill), and the only use of the `rgba(255,140,90,.6)` border alpha outside the L „So behaltet ihr die Kontrolle ↓“ underline. → `Badge variant="outline"` with these exact values; do **not** route it through D2 (`<Pill>`).
**Δ (sidebar-13):** move `roomscout` + `INTERN` into `SidebarHeader`; put the breadcrumb left and env `Badge` + `Avatar` + `DialogClose` right in the dialog header row. → `src/ui/operator/OperatorHeader.tsx`

### U2 · Integration tile — `<IntegrationTile>`
`text-align:left;padding:18px 20px;border-radius:16px;border:1px solid rgba(255,200,160,.14);background:rgba(255,255,255,.03);color:#f5ece2;font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:14px;transition:background .15s` + hover `rgba(255,255,255,.07)`, in a grid `display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px`. Head `display:flex;align-items:center;gap:12px` + 32px logo slot (img 28×28 `object-fit:contain;border-radius:6px`) + name `16.5px/500` + role `14px;color:#cbb9a8;margin-top:1px`; status row `display:flex;align-items:center;gap:9px;font-size:14.5px;color:#e2d3c3` + 9px dot.
**Watch out:** on a tile `t.open` is the **click handler**, not the expanded flag. Clicking sets `openInt` and navigates — so the Integrationen accordion must be controlled. → `src/ui/operator/IntegrationTile.tsx`

### U3 · Task row + expander — `<TaskRow>`
E2 row + action cell (`Diagnose` B3(40) when `status === 'expired'`, else `Details` B7 with `text-decoration:{{ t.underline }}` flipping `underline`/`none`) + detail stripe `padding:10px 14px 14px;font-size:14.5px;color:#cbb9a8;line-height:1.6;border-bottom:1px solid rgba(255,220,190,.08);animation:opFade .2s ease both`.
**Δ (required):** `openTask` is never reset, and `t2`'s expired `detailText` is `''` — that renders an empty ~24px stripe with a rule under it. Fix by rendering the stripe only when `detailText` is non-empty **and** supplying real copy for the expired state. → `src/ui/operator/TaskRow.tsx`

### U4 · Flags dirty panel — `<FlagDirtyPanel>`
`margin-top:22px;padding:18px 22px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,200,160,.14);animation:opFade .2s ease both` + eyebrow + `ul` `margin:10px 0 0;padding-left:18px;font-size:15px;line-height:1.7;color:#e2d3c3` + actions `margin-top:16px;display:flex;justify-content:flex-end;gap:10px` (B5 + O-primary 44).
Visible only when `flagDraft` exists **and** at least one flag differs — toggling twice hides the panel while the draft stays non-null. → `src/ui/operator/FlagDirtyPanel.tsx`

### U5 · Diagnostics sheet — `<DiagnosticsSheet>`
D7 panel + header (`h2` `margin:0;font-size:26px;font-weight:500` + 40px close) + body `margin-top:24px;display:flex;flex-direction:column;gap:14px;font-size:16px;line-height:1.5` (E1 rows + labelled blocks `font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#a89684` with `margin-top:4px` bodies + E4 timeline) + spacer `flex:1` + simulation box `padding:16px 18px;border-radius:14px;border:1px dashed rgba(255,200,160,.35);background:rgba(255,255,255,.03)` + full-width primary 46.
**Δ:** keep a permanent entry point — render the trigger whenever `hasIncident`, not only while `incidentOpen`, otherwise the resolved state is unreachable and `closeDiag` loses focus. → `src/ui/operator/DiagnosticsSheet.tsx`

---

## 2.4 Landing (L)

### V1 · Sticky header — `<LandingHeader>`
`position:fixed;z-index:10;top:0;left:0;right:0;height:{{ hdrH }}px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 clamp(20px,4vw,48px);background:{{ hdrBg }};backdrop-filter:{{ hdrBlur }};border-bottom:1px solid {{ hdrLine }};transition:height .3s,background .3s,border-color .3s` — not scrolled `80 / transparent / none / transparent`, scrolled (`scrollY > 40`) `64 / rgba(11,10,9,.72) / blur(12px) / rgba(255,220,190,.1)`.
**Δ:** the nav is **not** collapsed below 880 px in the source (3 anchors + CTA overflow at 320 px) — add a `Sheet` mobile nav.
**shadcn:** `NavigationMenu` (desktop) + `Sheet` (mobile) + `Button asChild` (CTA). → `src/ui/landing/LandingHeader.tsx`

### V2 · Hero preview (3-D tilt) — `<HeroPreview>`
Wrapper `margin-top:44px;width:min(1120px,100%);perspective:1600px;perspective-origin:50% 0%`; card `position:relative;border-radius:22px;border:1px solid rgba(255,190,140,.26);overflow:hidden;box-shadow:0 -10px 60px rgba(255,105,38,.12),0 40px 100px rgba(0,0,0,.5);transform:rotateX(14deg) scale(.96);transform-origin:50% 0%;will-change:transform`.
**Child order matters:** img → vignette mask (`left:37%;top:12%;width:26%;height:30%;background:radial-gradient(ellipse at 50% 50%,#1a120c 0%,#1a120c 42%,rgba(26,18,12,0) 72%)`, `aria-hidden`) → blob anchor 0 (`left:44.7%;top:19.5%;width:10.6%;aspect-ratio:1`) → bottom fade → corner badge `Beispielansicht`.
**Scroll:** `t = clamp01((vh*0.92 − cardTop) / (vh*0.55))`, `transform = rotateX(14*(1−t)deg) scale(0.96+0.04*t)`; reduced motion → `t = 1`. → `src/ui/landing/HeroPreview.tsx`

### V3 · Travelling blob (Landing) — `<TravellingBlob>`
Same visual as S1 but `position:fixed;z-index:3;transition:opacity .4s` and FLIP-positioned from `[data-blob-anchor="{active}"]`. Easing: `changed || data-blob-lag="1"` → `left/top` `{.55s|.9s}` + `width/height .55s`, all `cubic-bezier(.22,.8,.2,1)`; otherwise only `opacity .4s`. `lastAnchor` **starts at `-1`**, so the very first paint takes the eased branch. No anchor 5 → the blob hides on the bento and everything after it. → `src/ui/landing/useTravellingBlob.ts`

### V4 · Scroll stage engine — `useScrollStage()`
rAF-throttled `scroll` (`{passive:true}`) + `resize`, plus **one synchronous call at mount** (load-bearing: seeds `narrow`, `scrolled`, `memSeen`, the hero transform and the first blob placement). Per frame: pick the last `[data-sec]` whose `top <= vh*0.5`; `sticky = r.height > vh*1.5` decided **per frame, never hard-coded**; `p = clamp01(sticky ? -r.top/(r.height−vh) : (mid−r.top)/r.height)`, quantised `q = Math.round(p*100)/100`. → `src/ui/landing/useScrollStage.ts`

### V5 · Bento card — `<BentoCard>`
Shared: `background:rgba(18,14,12,.66);border:1px solid rgba(255,200,160,.14);border-radius:26px;transition:transform .3s` + hover `transform:translateY(-3px)`; padding `32px 34px` (card A puts it on its inner text column, which also needs `min-width:0`). Titles `font-size:clamp(22px,1.9vw,27px);font-weight:500;letter-spacing:-.01em`, subtitles `margin-top:6px;font-size:16px;color:#cbb9a8` — **all eight are plain `<div>`s**; map to `CardTitle`/`CardDescription` only with `asChild`/`div` rendering so the document outline (1 h1, 4 h2, 3 h3) survives. → `src/ui/landing/bento/*`

### V6 · Static blobs (Landing) — `<StaticBlob>` / `<MiniBlob>`
V3 covers only the *travelling* blob. Landing has **three further blobs that never move and are not `<TravellingBlob>`** (TOKENS §B8; LANDING §10.2, §10.4, §12). All three share the blob border-radius `62% 38% 46% 54%/44% 58% 42% 56%`; the gradient stop count and the glow tier differ.

| # | Ø | Where | Recipe |
|---|---|---|---|
| 1 | `86` | closing section, above the H2 (`aria-hidden="true"`) | `margin-top:44px;width:86px;height:86px;border-radius:62% 38% 46% 54%/44% 58% 42% 56%;background:radial-gradient(circle at 42% 38%,#ffc39a 0%,#ff8a4e 28%,#ff6926 58%,#e9511a 100%);box-shadow:0 0 30px 6px rgba(255,120,50,.35),0 0 90px 16px rgba(255,105,38,.18);animation:rsBreathe 5.2s ease-in-out infinite` — the **4-stop** gradient, a *smaller* glow tier than S1's `34px/110px` |
| 2 | `220` | bento card D decoration | `position:absolute;right:-40px;top:50%;transform:translateY(-50%);width:220px;height:220px;border-radius:…;background:radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 58%,#e9511a)` (**3-stop**) `;box-shadow:0 0 60px 10px rgba(255,105,38,.35);opacity:.9;animation:rsBreathe 6s ease-in-out infinite` — **Δ F-token: `6s` → adopt `5.2s`** (§5.1) |
| 3 | `44` | bento card B, the scout reply's avatar chip | `width:44px;height:44px;border-radius:…;background:radial-gradient(circle at 42% 38%,#ffc39a,#ff6926 60%)` (**2-stop**) `;box-shadow:0 0 18px rgba(255,105,38,.4);display:block` — **no animation**; also listed in E12 |

Plus the R candidate-card 10 px mini blob (A2) — same family, a *different* border-radius (`46% 54% 52% 48%/55% 45% 55% 45%`) and no animation.
**API:** `<StaticBlob size={86|220|44|10} stops={4|3|2} glow="lg|md|sm|xs" anim="breathe-5.2s|breathe-6s|none" />` — one component, four presets. → `src/ui/landing/StaticBlob.tsx` (shared with `src/ui/scout/blob/`)

### V7 · Permission panel (bento card D) — `<PermissionPanel>`
A two-row molecule with no equivalent anywhere else (LANDING §10.4); it is not a D6 alert, not an E1 key/value row and not a `ToggleRow`.
- **Panel:** `margin-top:24px;border:1px solid rgba(255,200,160,.14);border-radius:16px;background:rgba(0,0,0,.3);padding:6px 18px`
- **Rows:** `display:grid;grid-template-columns:36px 1fr;gap:14px;align-items:center;padding:12px 0` — row 1 adds `border-bottom:1px solid rgba(255,220,190,.08)`, row 2 has none
- **Row 1 icon (allowed):** filled circle `width:34px;height:34px;border-radius:50%;background:#ff6926;display:flex;align-items:center;justify-content:center;color:#fff` + a 16×16 check `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>` — same `d` as the offer check but `currentColor` and a heavier stroke
- **Row 2 icon (reserved):** outlined circle `width:34px;height:34px;border-radius:50%;border:1px solid rgba(255,220,190,.25);display:flex;align-items:center;justify-content:center;color:#f5ece2` + a 15×15 padlock `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`
- **Text:** title `15.5px` · sub `13.5px;color:#a89684`
- **shadcn:** `Card` + `Separator`; the two 34 px circles are custom. → `src/ui/landing/bento/PermissionPanel.tsx`

---

# Part 3 · shadcn install list

## 3.1 CLI

```bash
# primitives (one call; the CLI de-dupes shared deps)
npx shadcn@latest add \
  accordion alert alert-dialog avatar badge breadcrumb button card checkbox \
  collapsible dialog dropdown-menu input label navigation-menu radio-group \
  scroll-area separator sheet sidebar skeleton sonner switch table tabs \
  textarea toggle toggle-group tooltip

# the block both shells are built from
npx shadcn@latest add sidebar-13
```

**Notes**
- `sidebar` transitively installs/updates `button`, `input`, `separator`, `sheet`, `skeleton`, `tooltip` and adds `use-mobile` — install it in the same call so nothing is overwritten twice.
- `src/components/ui/table.tsx` **already exists** (hand-written, shadcn-shaped). Diff before accepting the CLI's version; either keep the existing file or take the generated one and re-check `DataGrid`.
- `sonner` pulls the `sonner` npm package; `sidebar` needs `@radix-ui/react-slot` (already present) and `class-variance-authority` (**not currently installed** — the CLI will add it).
- `textarea` has **exactly one call site** — the import dialog's step 2 (**C5b**, `SETTINGS_SCREENS.md` §13.3). It is on the list for that one field; do not drop it, and do not restyle C5's `<input>`s from it.
- Already installed and reused as-is: `@radix-ui/react-dialog`, `@radix-ui/react-select`, `lucide-react`, `clsx`, `tailwind-merge`.
- `sidebar-13` lands as a page-level example; harvest its structure into `SidebarShell` (D10) and delete the example file.

## 3.2 Deliberately **not** installed

| Component | Why not |
|---|---|
| `drawer` (vaul) | the R bottom sheet is a *morphing* panel with a 0.6 s geometry transition, not a dismissible drawer (D8) |
| `select` | the only `<select>` in the prototype is the dev bar's chapter picker — not shipped |
| `command` | the more-sources search is a plain `Input` + `filter()` |
| `progress` | no progress affordance anywhere; the import dialog has no step dots |
| `calendar` / `popover` / `form` / `carousel` / `chart` | no call site |
| `toast` (deprecated) | `sonner` is the current recommendation and matches the two toast behaviours |

## 3.3 What stays custom (no shadcn primitive)

| Custom | Why |
|---|---|
| `ScoutBlob` + `useBlobAnchor` (S1) · `TravellingBlob` (V3) | measured element teleportation; no primitive |
| `StaticBlob` / `MiniBlob` (V6, A2) | organic `border-radius` + gradient + glow tiers; `Avatar` cannot carry any of it |
| `PermissionPanel` (V7) | a two-row icon/label grid with mixed filled/outlined 34 px circles |
| `SidebarBackButton` (D14) | matches neither B7 nor B8; its own recipe |
| `FactCapsule` flight (S4) | WAAPI clone against a measured target |
| `FactList` float⇄card morph (S5) | one element, two style sets, 0.9 s multi-property transition |
| `BriefSheet` (D8) | morphing bottom sheet |
| `Utterance` word reveal (S2) | layout-reserving hidden span + interval |
| `StatusDot` (A2) · `Eyebrow` (A3) · `PhotoPlaceholder` (E6) | too small for `Badge`/`Skeleton`; the prototype never boxes them |
| `Stepper` (B14) · `VoiceControl` stack (C7) · `ComposerPill` (C6) | compositions with fixed geometry |
| Background stack + stage frame (Part 4 `AppShell`) | three/four fixed layers, `mix-blend-mode` needs its own element |
| `HeroPreview` tilt (V2) · `useScrollStage` (V4) · status cross-fader · bento collage · memory strike-through | scroll-driven, frame-computed |
| `DataGrid` (E2) | per-row radius + conditional tint on a CSS grid |
| `EventTimeline` (E4) · `ActivityList` (E3) | timelines, not tables |

---

# Part 4 · File layout & component tree

## 4.1 Layout under `src/`

```
src/
├─ components/ui/                 # shadcn-generated primitives ONLY (alias @/components/ui)
│                                 # accordion, alert, alert-dialog, avatar, badge, breadcrumb,
│                                 # button, card, checkbox, collapsible, dialog, dropdown-menu,
│                                 # input, label, navigation-menu, radio-group, scroll-area,
│                                 # separator, sheet, sidebar, skeleton, sonner, switch, table,
│                                 # tabs, textarea, toggle, toggle-group, tooltip
├─ ui/                            # RoomScout composed UI (the port lives here)
│  ├─ primitives/                 # cross-surface atoms — Part 1
│  │  ├─ RsButton.tsx             # B1 B2 B3 B4 B5 B6
│  │  ├─ LinkButton.tsx           # B7 B8
│  │  ├─ IconCircleButton.tsx     # B9
│  │  ├─ Chip.tsx  ChoiceButton.tsx  Segmented.tsx
│  │  ├─ RsSwitch.tsx  ToggleRow.tsx
│  │  ├─ ComposerPill.tsx
│  │  ├─ StatusDot.tsx  MiniBlob.tsx  Eyebrow.tsx  Pill.tsx  RsAvatar.tsx
│  │  ├─ GlassCard.tsx  RsAlert.tsx  PageHeader.tsx
│  │  ├─ KeyValueRow.tsx  DataGrid.tsx  StatCell.tsx
│  │  ├─ Bubble.tsx  PhotoPlaceholder.tsx
│  │  └─ index.ts
│  ├─ chrome/                     # app shell shared by Scout/Settings/Operator
│  │  ├─ AppShell.tsx             # fixed root + <StageFrame> + <StageBackground>
│  │  ├─ StageFrame.tsx           # data-stage, the mobile phone frame (dev-only prop)
│  │  ├─ StageBackground.tsx      # photo / scrim / grain
│  │  ├─ AppHeader.tsx  Wordmark.tsx  ScoutBadge.tsx  PauseButton.tsx  ProfileMenu.tsx
│  │  ├─ SidebarShell.tsx  SidebarNavItem.tsx  SidebarBackButton.tsx  SurfaceCaption.tsx
│  │  ├─ TranscriptSheet.tsx  ScoutToast.tsx  HintBar.tsx  Toaster.tsx
│  │  └─ index.ts
│  ├─ scout/
│  │  ├─ ScoutSurface.tsx         # <main>, stage switch, blob mount
│  │  ├─ blob/{ScoutBlob,BlobAnchor}.tsx  useBlobAnchor.ts
│  │  ├─ stages/{Welcome,Discovery,Brief,Autopilot,Clarification,Offer,Review,Complete,DeadEnd,Candidates}Stage.tsx
│  │  ├─ discovery/{Utterance,SpeakerLine,VoiceControls,TextComposer,SuggestionChip}.tsx
│  │  ├─ brief/{FactList,FactRow,FactCapsule,BriefSheet,BriefDisclosure}.tsx  useCapsuleFlight.ts
│  │  ├─ autopilot/{StatusLine,ActivityList,ApprovalCard,BlockedRow,SideNoteComposer}.tsx
│  │  ├─ offer/{OfferCard,ReviewCard,TermsGrid,QaPanel,CandidateCard,DeadEndCard,ClarificationCard}.tsx
│  │  └─ state/{machine.ts,stages.ts,script.ts,sched.ts,facts.ts,useScoutMachine.ts}
│  ├─ settings/
│  │  ├─ SettingsDialog.tsx  SettingsSidebar.tsx  SessionLine.tsx
│  │  ├─ pages/{Sources,Autonomy,Knowledge,Profile,Notifications,Billing,Privacy}Page.tsx
│  │  ├─ SourceRow.tsx  MoreSourcesPanel.tsx  ScoutAddress.tsx  ConnectionSheet.tsx
│  │  ├─ AutonomyModeCards.tsx  PerDayStepper.tsx  SaveBar.tsx  DiscardDialog.tsx
│  │  ├─ KnowledgeRow.tsx  KnowledgeRowMenu.tsx  KnowledgeTabs.tsx  UndoBar.tsx
│  │  ├─ ChangeLog.tsx  ImportDialog.tsx  UsageStats.tsx  SettingsRow.tsx
│  │  └─ state/useSettingsState.ts
│  ├─ operator/
│  │  ├─ OperatorDialog.tsx  OperatorSidebar.tsx  OperatorHeader.tsx
│  │  ├─ pages/{Overview,Sources,Tasks,Integrations,Flags,Diagnostics}Page.tsx
│  │  ├─ IntegrationTile.tsx  IntegrationRow.tsx  TaskRow.tsx  TaskFilter.tsx
│  │  ├─ FlagRow.tsx  FlagDirtyPanel.tsx  EventTimeline.tsx  DiagnosticsSheet.tsx
│  │  └─ state/useOperatorState.ts
│  ├─ landing/
│  │  ├─ LandingPage.tsx  LandingHeader.tsx  Hero.tsx  HeroPreview.tsx  IntroBlock.tsx
│  │  ├─ beats/{ConversationBeat,BriefCardBeat,WorkBeat,ClarifyBeat,OfferBeat}.tsx
│  │  ├─ bento/{BentoGrid,MemoryCard,FollowUpCard,SourcesCard,AutopilotCard,PermissionPanel}.tsx
│  │  ├─ StaticBlob.tsx   # V6 — the 86/220/44 px static blobs + the R 10 px mini blob
│  │  ├─ FaqSection.tsx  ClosingCta.tsx  LandingFooter.tsx
│  │  └─ {useScrollStage,useTravellingBlob,useMemSeen}.ts
│  ├─ copy/
│  │  ├─ types.ts      # Dict shape derived from de.ts
│  │  ├─ de.ts  en.ts  # the two dictionaries
│  │  ├─ LocaleProvider.tsx  useCopy.ts  format.ts  LanguageToggle.tsx
│  │  └─ index.ts
│  ├─ motion/
│  │  ├─ motion.css    # the 6 keyframes + the reduced-motion clamp
│  │  ├─ useReducedMotion.ts   # subscribing hook
│  │  ├─ prefersReducedMotion.ts # sync reader, for scroll frames (1:1 with Landing)
│  │  ├─ useFadeUpOnChange.ts  # the 420 ms WAAPI utterance/status fade
│  │  └─ usePageFade.ts        # the 200 ms WAAPI page-change fade (S + O)
│  └─ icons/
│     └─ index.tsx     # the ~30 inline SVGs the prototype defines by path, not by lucide name
├─ hooks/useNarrow.ts            # matchMedia('(max-width: 959px)')  → app `narrow`
├─ hooks/useLandingNarrow.ts     # window.innerWidth < 880           → landing `narrow`
├─ lib/{utils.ts,initials.ts,copy.ts,clamp.ts}
└─ styles/{app.css,tokens.css}   # tokens.css := docs/UI_PORT/tokens.proposed.css
```

**Rule:** nothing under `src/ui/**` imports from `src/components/**` except `@/components/ui/*`. Everything under `src/components/ui` stays CLI-regenerable — RoomScout recipes live in `src/ui/primitives`.

## 4.2 Component tree (runtime)

```
<LocaleProvider>                                   ui/copy
  <BrowserRouter>
    /                        <LandingPage>                       ui/landing
                               <LandingHeader/> <Hero><HeroPreview/></Hero>
                               <IntroBlock/>
                               <ConversationBeat/> ⟶ <BriefCardBeat/>   (data-sec=1, sticky)
                               <WorkBeat/>                              (data-sec=2, sticky)
                               <ClarifyBeat/> <OfferBeat/>              (data-sec=3,4)
                               <BentoGrid> A B C D </BentoGrid>         (data-sec=5)
                               <FaqSection/> <ClosingCta/> <LandingFooter/>
                               <TravellingBlob/>                        (fixed, z-3)
    /app/*                   <AppShell>                                ui/chrome
                               <StageFrame>                             (data-stage)
                                 <StageBackground/>                     (photo·scrim·grain)
                                 <AppHeader>                            (hidden on operator)
                                   <Wordmark/> <ScoutBadge/> <PauseButton/> <ProfileMenu/>
                                 </AppHeader>
                                 ├ view=scout     <ScoutSurface>
                                 │                   <ScoutBlob/>       (teleported)
                                 │                   <{Stage}Stage/>    (10 stages)
                                 │                   <FactList/> | <BriefSheet/>
                                 │                 </ScoutSurface>
                                 ├ view=settings  <SettingsDialog>      → <SidebarShell>
                                 │                   <SettingsSidebar/> + <{Page}/>
                                 │                   <ConnectionSheet/> <ImportDialog/>
                                 │                   <DiscardDialog/>   <Toaster/>
                                 │                 </SettingsDialog>  + <SurfaceCaption/>
                                 └ view=operator  <OperatorDialog>      → <OperatorHeader/> +
                                                    <SidebarShell> <OperatorSidebar/> + <{Page}/>
                                                    <DiagnosticsSheet/> </SidebarShell>
                                                  + <SurfaceCaption/>
                                 <ScoutToast/> <HintBar/> <TranscriptSheet/>
                               </StageFrame>
                             </AppShell>
```

**Two structural decisions to make explicitly (see §9.1):** (a) are Settings/Operator **routes** (as in today's app) or real modal `Dialog`s over the Scout (as `sidebar-13` and the prototype's view switch imply)? (b) does the mobile phone frame ship at all, or is `data-stage` collapsed to the desktop branch?

---

# Part 5 · Motion inventory

## 5.1 Keyframes — ship six

| Ship as | Prototype names | Body | Used by |
|---|---|---|---|
| `rs-breathe` | `rsBreathe` (R, L) | `0%,100%{transform:scale(1) rotate(0deg);border-radius:62% 38% 46% 54%/44% 58% 42% 56%}50%{transform:scale(1.04) rotate(-4deg);border-radius:54% 46% 58% 42%/50% 44% 56% 50%}` | blob `idle` (5.2s) + `thinking` (2.4s); L decorative blob (6s **→ adopt 5.2s**) |
| `rs-speak` | `rsSpeak` (R only) | `0%,100%{…62% 38% 46% 54%/44% 58% 42% 56%}30%{transform:scale(1.07) rotate(4deg);border-radius:46% 54% 60% 40%/58% 40% 60% 42%}65%{transform:scale(.97) rotate(-3deg);border-radius:56% 44% 40% 60%/48% 62% 38% 52%}` | blob `speaking` (1.7s) |
| `rs-listen` | `rsListen` (R, L) | `0%,100%{…}50%{transform:scale(1.02) rotate(8deg);border-radius:56% 44% 52% 48%/56% 46% 54% 44%}` | blob `listening` (4.2s) |
| `rs-fade-up` | `stFade` (S) = `opFade` (O) | `from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}` | every S/O mount (`.15s` / `.2s` / `.25s`) |
| `rs-fade-up-8` | `rsFadeUp` (R) | `from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}` | every R mount |
| `rs-dot` | `rsDot` (R) = `lpDot` (L) | `0%,100%{opacity:.4}50%{opacity:1}` | live dot (2.4s ease-in-out infinite) |

**Δ F15:** `stFade` and `opFade` are byte-identical → one name. Keep the 8 px travel only where the prototype uses it (the whole Scout surface).

**`rs-fade-up-8` delay/duration matrix (R, verbatim):** `.18s` profile menu · `.25s` toast, **mobile brief-sheet row list** (`animation:rsFadeUp .25s ease both`, §4.4 — *not* `.3s`) · `.3s` hint, brief panels, activity panel, edit actions, transcript sheet, QA panel, suggestion chip, capsule · `.35s` settings/operator view wrapper, clarification bubbles · `.4s` approval card, offer talk · `.45s` card + sheet actions · `.5s` clarification card, review card, dead-end card · `.6s` welcome greeting, offer h1, complete h1 · `.6s .1s` complete subline · `.6s .2s` complete pill · `.6s .3s` complete restart · `.6s .1s` candidates grid · `.7s .1s` offer card · `.7s .1s / .2s / .3s` welcome h1 / primary CTA / secondary CTA.

## 5.2 CSS transitions — the complete list

| Where | Declaration |
|---|---|
| Blob (R) | `left .9s cubic-bezier(.22,.8,.2,1),top .9s …,width .9s …,height .9s …,opacity .6s` + inner `box-shadow .6s` |
| Blob (L) | changed/lag → `left/top {.55s|.9s},width/height .55s` all `cubic-bezier(.22,.8,.2,1)`, `opacity .4s`; else `opacity .4s` only |
| Fact list morph | `left/top/width/padding .9s cubic-bezier(.22,.8,.2,1),border-radius .9s,background .9s,border-color .9s,gap .9s,opacity .5s,transform .5s` |
| Fact row | `padding .9s,font-size .9s,gap .9s,height .9s,opacity .35s,background .5s` |
| Fact list head | `margin .9s` (row) · `font-size .9s,color .9s` (title) |
| Mobile sheet | `left .6s cubic-bezier(.22,.8,.2,1),right .6s …,bottom .6s …,border-radius .6s,padding .6s` |
| Discovery blob anchor | `width .6s,height .6s,margin .6s` |
| Stage frame | `width .4s,height .4s,border-radius .4s` |
| Sheet title | `font-size .4s` |
| Chevrons | `transform .3s` (R) · `.25s` (S) · `.2s` (O) |
| Accordion body | `grid-template-rows .26s cubic-bezier(.3,.7,.2,1)` (S) · `.32s cubic-bezier(.3,.7,.2,1)` (L) |
| Switch | `background .2s` (track) + `transform .2s` (knob) |
| Sidebar nav item | `background .15s` |
| Source row | `background .25s,border-color .25s` |
| Discovery mic circle | `background .3s` (C7 — the mic is the only voice control that transitions its fill) |
| Brief panel fact rows (R) | `background .5s` — autopilot / offer / candidates disclosure panels, row `font-size:15px;color:#f5ece2;padding:2px 0;border-radius:6px;background:{{ f.bg }}` (§8.6) |
| Mobile brief-sheet rows (R) | `opacity .35s,background .5s` (§4.4 — fixed geometry, see D8) |
| Mobile brief-sheet title | `font-size .4s` |
| Knowledge flash | `background .5s` |
| Tab trigger | `color .15s` |
| Autonomy mode card | `background .2s,border-color .2s` |
| Segment button | `background .15s` |
| Welcome CTA | `transform .2s,background .2s` (the only hover with a transform) |
| Brief headline | `opacity .5s` |
| Integration tile | `background .15s` |
| L header | `height .3s,background .3s,border-color .3s` |
| L reveals | `opacity {.4|.5|.6|.7}s`, `transform {.5|.6|.7}s cubic-bezier(.22,.8,.2,1)`, `visibility {.6|.7}s` |
| L chips | `opacity .45s,transform .55s cubic-bezier(.3,.7,.2,1)` |
| L fact rows | `opacity .4s,transform .5s cubic-bezier(.22,.8,.2,1),background .6s` + label `color .4s` |
| L status cross-fade | `opacity .5s,transform .5s` |
| L memory row | `opacity .6s` (old value) · `color .6s` (new value) |
| L bento hover | `transform .3s` |
| L FAQ | `border-color .3s` + icon `transform .3s` |

**Two easings only:** `--rs-ease` `cubic-bezier(.22,.8,.2,1)` (21×, the signature) and `--rs-ease-snap` `cubic-bezier(.3,.7,.2,1)` (4×, accordions + the capsule flight).

## 5.3 Scripted / WAAPI animation — must stay JS

| # | What | Spec |
|---|---|---|
| 1 | Capsule flight (R) | 3-keyframe `element.animate(...)`, `duration:580, easing:cubic-bezier(.3,.7,.2,1), fill:'forwards'` against a measured target (S4) |
| 2 | Utterance / status fade (R) | 420 ms `opacity 0→1` + `translateY(6px)→none` replayed on every new `utter` id and every `status` change |
| 3 | Page-change fade (S, O) | `contentRef.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'none'}],{duration:200,easing:'ease-out'})` **after** `scrollTop = 0`; guarded by an explicit `matchMedia` check (the CSS clamp cannot reach a `.animate()` call) |
| 4 | Word-by-word reveal (R) | `setInterval` at `(scout ? 78 : 96) / speed` ms; hold `700 ms` (user) / `min(5200, max(1800, words*260))` ms (scout) |
| 5 | Label fade after commit (R) | `[data-fact-label]` `opacity 0→1` over 350 ms, fired 400 ms into the flight |
| 6 | Blob placement (R, L) | not an animation — a per-frame rect copy; the *transition* does the work |
| 7 | Hero un-tilt (L) | per-frame inline `transform`, no transition |
| 8 | Background parallax (L) | per-frame `scaleX(-1) translateY(scrollY * -0.03)` |

**Implementation rule:** CSS keyframes for anything looping or mount-triggered; state-driven `data-*` attributes + CSS transitions for anything with two known end states (blob mode, switch, accordion, morph); WAAPI only for 1–3 and 5, which measure. **Do not add Framer Motion** — the blob and the fact list rely on raw rects, and `layoutId` fights sticky sections.

## 5.4 Timer inventory (UI-visible, not the demo script)

**Status / flash timers.** `hint` 4200 ms (only if unchanged) · S `toast` 2400 ms (single slot, replaced) · S `savedId`/`savedAuto` 1500 ms · S `copyState` 1600 ms · S `copyFail` 4000 ms · S `flashId` 1200 ms · S `rulesSaved` 2600 ms · S `nameSaved` 3000 ms · S `retired` (undo) 6000 ms · S `importDone` 5000 ms · O `flagsSaved` 2600 ms · R `changed` 1100 ms (`commitFact`, existing rows only) / 1200 ms (`updateFact`, `compromise`) — **and cleared, for the clarification path, by the 2300 ms stage switch in `answerClar`, not by a 1100/1200 ms timer** · R toast **no timer at all**.

**Stage-entrance / component-visibility timers the components above depend on** (`SCOUT_SCREENS.md` §15.3; every delay is divided by `sched.speed`):

| Timer | Delay | Effect | Component |
|---|---|---|---|
| `morphToBrief` | 450 ms | `headlineShown:true` → the brief headline fades in (`transition:opacity .5s`) | S5/S6 |
| `morphToBrief` | 950 ms | `cardArrived:true` → the pencil (`showEditBtn`) and the whole „Scout losschicken“ action block (`cardActions`) mount | S5/S6, D8 |
| `startScouting` | 600 ms | `listMode:'hidden'` — the card has finished its `leaving` scale-away | S5 |
| `answerClar` | 650 ms | scout reply appears in the clarification strip (`scoutState:'speaking'`) | E8/S10 |
| `answerClar` | 2300 ms | stage switch + **all `changed` flags cleared** | S5/S10 |
| `talkOffer` | 6500 ms | back to `scoutState:'idle'` (only if still on `offer`) — drives the blob animation on the offer stage | S1/S7 |
| `switchToVoice` (while `awaitingUser`) | 400 ms | the pending scripted user line auto-plays | C6/S2 |
| `resumeConvo` (no frozen utterance, not `awaitingUser`) | 300 ms | `runStep(stepIndex)` | S2 |

All timer handles must be collected and cleared on unmount (the prototype's `this.timers` pattern).

## 5.5 Reduced motion

| Layer | Behaviour |
|---|---|
| Global CSS (all four files) | `@media (prefers-reduced-motion: reduce){*{animation-duration:.01ms!important;transition-duration:.01ms!important}}` — ship verbatim |
| R | instant word reveal (`revealMs = 0`), **no capsule flight** (commit + continue immediately), no utterance/status WAAPI |
| S, O | skip the 200 ms page-change WAAPI (explicit `matchMedia` guard — the CSS rule cannot reach it) |
| L | no background parallax; hero tilt `t = 1` (flat); blob positional easing off (`opacity .4s` only) |
| L caveat | the prototype captures `matchMedia(...)` **once and never subscribes**, so an OS toggle only takes effect on the next scroll frame. **Δ decision:** subscribe (`useReducedMotion`) for correctness, and expose a synchronous `prefersReducedMotion()` reader for the scroll handler so the per-frame path stays allocation-free. |

---

# Part 6 · DE/EN copy architecture

The prototype is **German-only and has no language switch** — the whole bilingual layer is new. German is the **source language**; every key already exists verbatim in the four screen docs' copy dictionaries.

## 6.1 Namespacing (mandatory — the four docs collide)

The screen docs each use bare top-level keys, and **four prefixes are occupied by two surfaces at once**:

| Key | SCOUT | SETTINGS | OPERATOR | LANDING |
|---|---|---|---|---|
| `sources.*` | — | 57 keys — `sources.title = "Wo darf dein Scout suchen?"` | 20 keys — `sources.title = "Quellen"` | — |
| `offer.*` | 17 keys — `offer.headline = "Ein Raum, der zu euch passt."` | — | — | 12 keys — `offer.title = "Stuttgart-West · Geteilter Proberaum"` |
| `brief.*` | 13 keys — `brief.headline`, `brief.title`, `brief.cta`, `brief.sheet.count.*` | — | — | 12 keys — `brief.panel.title`, `brief.card.title`, `brief.card.row1…row5` |
| `settings.*` | — | 16 keys — `settings.nav.back`, `settings.session.working`, `settings.host.caption` | 4 keys — `settings.page.sources.title`, `settings.sources.state.expired`, `…action.openLogin`, `…saved` | — |

**Near-misses that are *not* collisions** (do not "fix" them into one key): SCOUT `facts.*` (8, fact **labels**) vs LANDING `fact.*` (6, singular, fact **values**) · SCOUT `clarification.*` vs LANDING `clarify.*` · SCOUT `chrome.*` vs LANDING `header.*` vs OPERATOR `operator.*`. And `tasks.*` is **OPERATOR-only** — it is not a clash.

**One more hazard the table cannot show:** OPERATOR's dictionary contains a bare `scout.*` block (3 keys, §17.12) whose prefix is the *surface namespace name* of the Scout surface. `operator.scout.waitingAccess.text` is correct; dropping the `operator.` prefix would silently merge it into `scout.*`.

**Therefore:** the shipped dictionary is namespaced by surface — `scout.*`, `settings.*`, `operator.*`, `landing.*`, `common.*`.

**Migration is mechanical with exactly two hand-edits** (do not run a blind `"surface." + key` over all four docs):

1. **Two docs are already half-prefixed with their own surface name — strip it before nesting.**
   - `SETTINGS_SCREENS.md` §17.1 ships `settings.nav.*`, `settings.session.*`, `settings.host.caption` **with** the `settings.` prefix, while §17.2–§17.12 use bare prefixes (`sources.`, `connection.`, `autonomy.`, `knowledge.`, `import.`, `profile.`, `notif.`, `billing.`, `privacy.`, `discard.`, `common.`). Blind prefixing yields `settings.settings.nav.back`.
   - `OPERATOR_SCREENS.md` §17.1–§17.2 ship 16 keys under `operator.` (`operator.brand`, `operator.badge.internal`, `operator.env.development`, `operator.avatar.*`, `operator.footer.note`, `operator.nav.*`), while §17.3–§17.11 use bare prefixes (`overview.`, `tasks.`, `sources.`, `orders.`, `integrations.`, `flags.`, `diag.`, `diagSheet.`, `events.`). Blind prefixing yields `operator.operator.nav.back`.
   **Rule: strip a leading occurrence of the doc's *own* surface name before prefixing.** The result is `settings.nav.back` and `operator.nav.back` (the two keys D14 needs). Do **not** strip OPERATOR §17.12's `settings.*` block — that is a *different* surface's namespace quoted for coordination and correctly becomes `operator.settings.*`.
2. **Two blocks are excluded, not translated** (a blind concatenation pulls them in): SCOUT §18.18 `demo.*` (28 keys — prototype dev bar, explicitly *not to be built*) and LANDING §17.12 `v1.*` (43 keys — superseded `Landing.dc.html` copy kept for reference only). `942 − 71 = 871` shippable keys.
3. **SETTINGS §17.12's `common.*` block (7 keys) is hoisted, not prefixed** — it becomes the top-level `common.*` namespace, not `settings.common.*`. It is the only source of `common.*` in the four docs.

`common.*` — **the source bag has exactly 7 keys** (`SETTINGS_SCREENS.md` §17.12), and `common.save` is **not** one of them: `common.copyFailedToast` („Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst.“) · `common.saved` („Gespeichert“) · `common.cancel` („Abbrechen“) · `common.back` („Zurück“) · `common.close` („Schließen“) · `common.details` („Details“) · `common.demoName` („Herzbuben“). Note the clipboard key's real name is `common.copyFailedToast`, not `common.copyFailed`. Promoting further strings („Speichern“, „Übernehmen“, …) into `common.*` is a **port decision**, not a source fact — if you do it, record it here and keep the source key as the value's origin.

## 6.2 Dictionary shape

```ts
// src/ui/copy/de.ts  — the source of truth, nested, `as const`
export const de = {
  // the 7 source keys of SETTINGS §17.12, verbatim — no invented members
  common: { copyFailedToast: "Kopieren war nicht möglich. Markiere den Text und kopiere ihn selbst.",
            saved: "Gespeichert", cancel: "Abbrechen", back: "Zurück", close: "Schließen",
            details: "Details", demoName: "Herzbuben" },
  scout: {
    chrome:  { wordmark: "roomscout", badge: { running: "Scout ist unterwegs", paused: "Suche pausiert" }, /* … */ },
    welcome: { greeting: "Hey {name}.", headline: "Finden wir euren Proberaum.", /* … */ },
    brief:   { sheet: { count: { one: "1 Wunsch gemerkt", other: "{count} Wünsche gemerkt" } } },
    /* … discovery, script, facts, autopilot, activity, clarification, offer, review,
         complete, deadEnd, candidates, transcript, toast, hint, data …
         NOT `demo` — SCOUT §18.18 is prototype-only and is not shipped (§6.1 rule 2) */
  },
  // SETTINGS §17.1 keys already carry a `settings.` prefix — strip it before nesting (§6.1 rule 1);
  // §17.12's `common.*` is hoisted to the top level above, not nested here (§6.1 rule 3).
  settings: { settings: {}, sources: {}, connection: {}, autonomy: {}, discard: {},
              knowledge: {}, import: {}, profile: {}, notif: {}, billing: {}, privacy: {} },
  // brand/badge/env/avatar/footer/nav come from OPERATOR §17.1–17.2 after stripping their own
  // `operator.` prefix (§6.1 rule 1) — there is no `chrome` block, `brand` is a bare leaf.
  // host/scout/settings are §17.12's cross-surface block and keep their prefixes as-is.
  operator: { brand: "", badge: {}, env: {}, avatar: {}, footer: {}, nav: {},
              overview: {}, tasks: {}, sources: {}, orders: {},
              integrations: {}, flags: {}, diag: {}, diagSheet: {}, events: {},
              host: {}, scout: {}, settings: {} },
  // singular `fact`, not `facts` (that is SCOUT's label bag); `v1.*` is NOT shipped (§6.1 rule 2).
  landing:  { header: {}, hero: {}, how: {}, convo: {}, fact: {}, brief: {}, work: {},
              clarify: {}, offer: {}, features: {}, control: {}, faq: {}, closing: {}, footer: {} },
} as const;

// The exact sub-namespace lists, verbatim from the four docs (counts = source keys):
//   scout    (295, 19 blocks): candidates 35 · autopilot 34 · demo 28 (NOT shipped) · data 27 ·
//                              discovery 21 · review 19 · offer 17 · activity 16 · clarification 14 ·
//                              deadEnd 14 · brief 13 · chrome 10 · script 10 · hint 8 · facts 8 ·
//                              toast 7 · transcript 5 · welcome 5 · complete 4
//   settings (307, 12 blocks): knowledge 61 · sources 57 · autonomy 36 · import 31 · billing 27 ·
//                              connection 23 · privacy 21 · settings 16 · notif 14 · profile 10 ·
//                              common 7 · discard 4
//   operator (174, 13 doc blocks): integrations 27 · overview 21 · tasks 21 · sources 20 · flags 20 ·
//                              diagSheet 20 · operator 16 (→ brand/badge/env/avatar/footer/nav after
//                              the rule-1 strip) · events 9 · orders 5 · diag 4 · settings 4 ·
//                              host 4 · scout 3
//   landing  (166, 15 blocks): v1 43 (NOT shipped) · features 34 · brief 12 · offer 12 · hero 10 ·
//                              clarify 10 · convo 6 · fact 6 · work 6 · faq 6 · how 5 · header 4 ·
//                              control 4 · closing 4 · footer 4

// src/ui/copy/types.ts
export type Dict = typeof de;                    // DE is the shape
export type CopyKey = DeepLeafPaths<Dict>;       // "scout.welcome.headline" | …

// src/ui/copy/en.ts
import type { Dict } from "./types";
export const en: Dict = { /* same tree, English values — a missing key is a TS error */ };
```

**Rules**
1. **DE defines the shape.** `en: Dict` makes a missing/extra English key a compile error. No runtime fallback needed, and none is added (a silent fallback would ship German into an English UI unnoticed).
2. **Verbatim.** German values are copy-pasted from the screen docs including `„ “ · – — € … ↓ ↗ ’ →`. Never re-typed.
3. **One key per visible variant**, never a computed string: `activity.show` / `activity.hide`, `sources.more.show` / `sources.more.hide`, `review.terms.show` / `review.terms.hide`, `log.show` / `log.hide`, `chrome.pause.pause` / `chrome.pause.resume`, `discovery.controls.micOn` / `micOff`, `flags.state.on` / `off`.
4. **Composed strings stay composed in the dictionary**, with the parts named. Two that matter:
   - Operator flag preview: `{flags.<k>.label} + " " + flags.preview.arrow + " " + {flags.preview.on|off} + ". " + {flags.preview.<k>.<on|off>}` — the arrow `→` is its own key so an RTL/EN variant can re-order.
   - Autopilot approval message: `scout.autopilot.approval.message` with `{name}` (twice) and `{budget}`.
5. **Line breaks are keys, not `<br>` in a string:** `welcome`/`brief`/`features`/`control` headlines and captions ship as `.line1` / `.line2` and are rendered with an explicit `<br/>` between two `<span>`s. Same for `brief.caption.line1|line2` and `brief.card.note.line1|line2`.
6. **Data-shaped copy stays in the dictionary too** — candidate names/prices/notes, source names/descriptions, knowledge items and their origins, integration names/roles/notes, the incident event log. They are user-visible strings, and in the port they will be replaced by Convex data whose German values must still have an English counterpart.

## 6.3 Interpolation, plurals, dates

```ts
// src/ui/copy/format.ts
export function interpolate(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s;
}
```

- **Placeholders in use — 18, the complete set** (scanned across all four dictionaries):
  `{budget}` · `{city}` · `{count}` · `{h}` · `{label}` · `{mm}` · `{n}` · `{name}` · `{origin}` · **`{ort}`** · `{price}` · **`{prefix}`** · `{profile}` · `{roomName}` · `{short}` · `{text}` · `{timeLower}` · `{usage}`.
  Two are easy to miss and were absent from earlier drafts: **`{ort}`** appears only in `scout.data.summary.pattern` (`"Ihr seid eine [vierköpfige ]Band[ aus {ort}]. …"`, SCOUT §18.19) and **`{prefix}`** only in `operator.host.now.format` (`"{prefix}, {h}:{mm}"`, OPERATOR §17.12 — `h` unpadded, `mm` zero-padded). Generate the interpolation-variable union from this list, not from a sample.
  One further placeholder, **`{time}`**, is **introduced by the port** (the `Intl` date recommendation below) and does not exist in any source dictionary — add it to the union deliberately.
- **Plurals** — four real cases, all handled with an explicit `{ one, other }` sub-object resolved through `Intl.PluralRules(locale)`:
  `scout.brief.sheet.count` („1 Wunsch gemerkt“ / „{count} Wünsche gemerkt“) · `settings.billing.usage.searches` („Aktive Suche“ / „Aktive Suchen“, switching at exactly 1) · `settings.knowledge.import.done` („{n} Angabe übernommen.“ / „{n} Angaben übernommen.“) · `settings.privacy.portals.sub` (**singular-only in the prototype** — „{n} verbundener Portalzugang, simuliert“; give it a plural form in the port and note the change).
- **Dates/times** — the prototype hard-codes `'Heute, ' + h + ':' + String(m).padStart(2,'0')`. Ship a token plus `Intl`:
  `operator.sources.check.renewed = "Heute, {time}"` / `"Today, {time}"` with `time = new Intl.DateTimeFormat(locale, {hour:'numeric', minute:'2-digit'}).format(d)` → `Heute, 9:41` / `Today, 9:41 AM`. Keep `check.demoRun` („Heute · Demo-Lauf“) and `check.none` („—“) as plain strings.
- **Currency** — every price is a literal string in the prototype (`„280 € / Monat“`). Keep them literal for the demo data; if they become dynamic, format with `Intl.NumberFormat(locale, {style:'currency', currency:'EUR'})` and keep `/ Monat` as its own key.
- **`aria-label`s and placeholders are dictionary keys too** — they are already listed in every screen doc (`…​.aria`, `…​.placeholder`).

## 6.4 Provider, hook, toggle

**Decision recorded here so the snippet is unambiguous:** with no stored preference the app opens in **German, unconditionally** — DE is the source language and the demo copy is German. The browser-language probe is therefore **not** used. (If a later product decision wants `navigator.language` to pick EN for non-German browsers, change the fallback line to `return navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";` and note it in §8.2 — do not ship a ternary whose branches are both `"de"`.)

```tsx
// src/ui/copy/LocaleProvider.tsx
import React from "react";
import { de } from "./de";
import { en } from "./en";
import { interpolate } from "./format";

export type Locale = "de" | "en";
const DICTS = { de, en } as const;
const KEY = "roomscout.locale";

export const LocaleCtx = React.createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  dict: (typeof DICTS)[Locale];
}>({ locale: "de", setLocale: () => {}, dict: de });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = React.useState<Locale>(() => {
    try { const s = localStorage.getItem(KEY); if (s === "de" || s === "en") return s; } catch {}
    return "de";                                    // DE is the unconditional default
  });
  React.useEffect(() => {
    document.documentElement.lang = locale;
    try { localStorage.setItem(KEY, locale); } catch {}
  }, [locale]);
  const value = React.useMemo(() => ({ locale, setLocale, dict: DICTS[locale] }), [locale]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

// src/ui/copy/format.ts (rest) — the two helpers the hook below uses
//   get(dict, "scout.welcome.headline")  → walks the nested object by dotted path
//   pickPlural(node, count, locale)      → node is either a string (returned as-is) or
//                                          { one, other, … }; resolves via Intl.PluralRules(locale)
export function get(dict: unknown, key: string): any {
  return key.split(".").reduce<any>((o, k) => (o == null ? o : o[k]), dict);
}
export function pickPlural(node: any, count: number, locale: Locale): string {
  if (typeof node === "string") return node;
  const cat = new Intl.PluralRules(locale).select(count);
  return node[cat] ?? node.other;
}

// src/ui/copy/useCopy.ts
import { LocaleCtx } from "./LocaleProvider";
import { get, pickPlural, interpolate } from "./format";
import type { CopyKey } from "./types";

export function useCopy() {
  const { dict, locale, setLocale } = React.useContext(LocaleCtx);
  const t = React.useCallback(
    (key: CopyKey, vars?: Record<string, string | number>) => interpolate(get(dict, key), vars),
    [dict],
  );
  const tp = React.useCallback(                                   // plural
    (key: CopyKey, count: number, vars?: Record<string, string | number>) =>
      interpolate(pickPlural(get(dict, key), count, locale), { count, ...vars }),
    [dict, locale],
  );
  return { t, tp, locale, setLocale, dict };
}
```

**Usage convention:** components take `t` from `useCopy()`; a component may also take the already-resolved string as a prop when it is a pure presentational primitive (`<Eyebrow>{t("scout.offer.eyebrow")}</Eyebrow>`). **No component hard-codes a visible string** — that rule is what makes the toggle complete.

**Toggle locations (both, Δ — new):**
1. **Settings → Profil**, as a new row above „Demo-Login“, using the **Kanal segmented recipe verbatim** (B13): label „Sprache“ / "Language" (uppercase section label), options `Deutsch` / `English`. This is the canonical place — it is where a signed-in user changes preferences.
2. **Landing header**, a compact two-item toggle placed **left of the „Demo starten“ CTA** inside the `1fr auto 1fr` grid's right cell (`justify-self:end`, `gap:18px`): `DE` / `EN`, `height:32px;padding:0 10px;border-radius:999px;border:1px solid rgba(255,220,190,.2);font-size:13px`, active `background:rgba(255,105,38,.3)`. Visitors must be able to switch before they ever sign in. On narrow it moves into the mobile-nav `Sheet`.

**Not** in the Operator surface — Operator inherits the app locale (§9.1 has the open question of whether it is translated at all).

## 6.5 Extraction plan (mechanical, in this order)

1. `de.ts` ← concatenate the four docs' dictionaries under their surface namespaces, applying the **three hand-edits from §6.1** (strip SETTINGS §17.1's `settings.` and OPERATOR §17.1–17.2's `operator.` self-prefixes; exclude SCOUT `demo.*` and LANDING `v1.*`; hoist SETTINGS §17.12's `common.*` to the top level).
   **Exact source key counts — measured, not estimated:**

   | Surface | Doc section | Keys in the doc | Excluded | Shipped |
   |---|---|---|---|---|
   | `scout.*` | `SCOUT_SCREENS.md` §18 | **295** | `demo.*` 28 (§18.18, prototype-only) | **267** |
   | `settings.*` | `SETTINGS_SCREENS.md` §17 | **307** | — | **300** under `settings.*` + **7** hoisted to `common.*` |
   | `operator.*` | `OPERATOR_SCREENS.md` §17 | **174** | — | **174** (incl. the §17.12 cross-surface block: `host.*` 4, `scout.*` 3, `settings.*` 4) |
   | `landing.*` | `LANDING_SCREENS.md` §17 | **166** | `v1.*` 43 (§17.12, superseded v1 copy) | **123** |
   | **Total** | | **942** | **71** | **871** |

   Size the copy layer, the translation budget and the `en.ts` parity test from **871**, not from a round number. (The earlier "~470 keys" figure in this document was wrong by roughly a factor of two and has been replaced.)
2. Generate `types.ts` (`DeepLeafPaths`) and let `tsc` enumerate the key union.
3. `en.ts` ← same tree, English values. Translate **product copy** in full; leave `common.demoName` („Herzbuben“), source/portal names (`roomscout.dev`, `Bandnet Hamburg`), integration names and the wordmark untranslated.
4. Add an ESLint rule (`no-literal-jsx-text` or a custom rule) scoped to `src/ui/**` so a raw German string in JSX fails lint.
5. Add a unit test asserting `Object.keys` parity DE↔EN recursively (belt-and-braces on top of the TS type) and that no value is an empty string.

---

# Part 7 · Build order

1. **Tokens** — copy `tokens.proposed.css` → `src/styles/tokens.css`, import into `app.css`, verify `--radius: 0.75rem` and the sidebar variables reach the shadcn primitives.
2. **shadcn install** (§3.1) + `src/ui/motion/motion.css` (§5.1) + `src/ui/icons` (the ~30 inline SVGs — they are defined by path, not by lucide name; extract them once, verbatim, before any screen work).
3. **Primitives** (Part 1) with a visual harness — these carry 80 % of the pixel risk.
4. **Chrome** — `AppShell` + background stack + `AppHeader` + `SidebarShell`. Get the background recipe (TOKENS.md Part E) exactly right first; every surface sits on it.
5. **Copy layer** — `de.ts` + provider + `useCopy` *before* the screens, so no screen is ever written with literals.
6. **Scout** — blob + fact list + discovery first (the two hardest motions), then the linear stages.
7. **Settings**, then **Operator** (they share `SidebarShell`; Operator is the smaller of the two).
8. **Landing** last — it is self-contained and depends only on primitives + the blob recipe.
9. **`en.ts`** + the parity test + the two toggles.

---

# Part 8 · Open questions & recorded deltas

## 8.1 Open questions (need a product decision before the corresponding step)

1. **Routes or dialogs?** `sidebar-13` is a dialog; today's app has `/app/settings/:section` and `/ops/*` as routes; the prototype swaps a `view` inside one shell. Pick one — it changes `SettingsDialog`/`OperatorDialog`'s outer element, the URL contract and the back-button semantics.
2. **Does the mobile phone frame (`data-stage`, 390 × `min(844px, calc(100% - 32px))`, r44) ship**, or does `StageFrame` collapse to the desktop branch and `mobile` become a dev-only prop?
3. **Settings/Operator mobile layout is unspecified by the prototype** (its own 390 px preview is visually broken: 296 px sidebar inside a 318 px frame leaves a ~20 px content column). The plan in `SETTINGS_SCREENS.md` §15 is a proposal, not a source — confirm it.
4. **Is the Operator surface translated at all**, or English-only / DE-only for internal users?
5. **`backToConvo` script-index hazard** (`stepIndex = SCRIPT.length` with `SCRIPT` 0–7 → every consumer throws). Recommended resolution (a): treat `stepIndex >= SCRIPT.length` as end-of-script and play „Ja, leg los.“ as a synthetic user utterance that goes straight to `morphToBrief()`.
6. **Toast placement in the port** — R's toast is `absolute` inside the stage at `right:24px;top:96px` and never auto-dismisses. Sonner with `duration: Infinity` matches the behaviour but not the exact anchor; confirm the anchor may become the Sonner offset.
7. **`Landing v2` link targets** — `Roomscout.dc.html` → which route (`/app` or `/app/scout`)?

## 8.2 Deltas already decided by the screen docs (reproduce these, not the prototype)

| Δ | Source |
|---|---|
| Overlays gain focus trap / `inert` / focus restore (Radix) | SETTINGS §0.7 |
| Discard `AlertDialog` must have outside-click dismissal **off** | SETTINGS §6 |
| Connection sheet parameterised by source id; focus restored to the actual trigger | SETTINGS §12 |
| Knowledge kebab gains outside-click close + roving focus | SETTINGS §7.5 |
| `originId` („Herkunft: …“) needs a dismissal path | SETTINGS §7.5 |
| Standalone/storybook mode must be a real no-op bag, not the prototype's throwing proxy | SETTINGS §0.5 |
| Active sidebar item keeps its background on hover | OPERATOR §4.4 |
| Operator filter chips gain a hover state | OPERATOR §7.1 |
| Diagnose sheet keeps an entry point after the incident is resolved | OPERATOR §10.3 |
| Task detail stripe never renders empty | OPERATOR §14.3 |
| Landing mobile nav collapses into a `Sheet` below 880 px; card D's `max-width:66%` relaxes | LANDING §13 |
| Landing's seven hover-less anchors (inline `color` beats `a:hover`): either strip `Button variant="link"`'s hover to stay 1:1, or add hover affordances **deliberately** — never by accident (B7) | LANDING §3.1, §16 |
| Copy migration: strip SETTINGS §17.1's own `settings.` prefix; exclude SCOUT `demo.*` (28) and LANDING `v1.*` (43) — 871 of 942 documented keys ship | this document §6.1, §6.5 |
| Locale default is DE **unconditionally**; `navigator.language` is not probed | this document §6.4 |
| `useReducedMotion` subscribes to `change` (the prototype captures the query once) | LANDING §2.4 |
| One global `:focus-visible` rule and one global `::placeholder` rule | TOKENS F17, F18 |
| Token canonicalisation F1–F27 (shell fill `.8`, scrim `.55`, popover `.96`, toast `rgba(24,17,13,.96)`, weight `700→600`, `rsBreathe 6s→5.2s`, one `rs-fade-up`) | TOKENS Part F |
| Bilingual layer, language toggle in Settings → Profil and the landing header | this document §6.4 |
