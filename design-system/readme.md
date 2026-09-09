# RoomScout Design System

RoomScout ist ein voice-first Assistent, der für eine Band einen passenden Proberaum sucht, Anbieter kontaktiert und Rückfragen klärt. Die Band erzählt, was sie sucht; der "Scout" übernimmt Suche und Kommunikation. Nur echte Entscheidungen (Suchauftrag starten, Terminabweichung, Angebot annehmen) kommen zum Nutzer zurück. Demo-Band: **Herzbuben**, vier Personen, geteilter Raum in Stuttgart, bis 350 €/Monat, Schlagzeug muss bleiben. Entstanden beim Convex All Gas Hackathon (Finchmedia).

## Sources

- Claude Design project "Roomscout UI Interactive Prototype": https://claude.ai/design/p/75db0334-0651-4429-8798-ee25330daa1d?via=share
- Attached codebase (read-only mount) `Roomscout UI Interactive Prototype/` — `Roomscout.dc.html` (app, 1231 lines, state machine + all screens), `Landing v2.dc.html` (marketing page), `Settings.dc.html`, `Operator.dc.html` (internal ops view), `assets/` (bg, grain, logos, room photo), `uploads/CLAUDE_DESIGN_PROMPT.md` (full German product/interaction brief), `uploads/0X-*.png` (six app renders + landing renders).
- GitHub (referenced in the landing footer, not read): https://github.com/Finchmedia/roomscout

## Products / surfaces

1. **RoomScout App** (band-facing) — one adaptive surface: Willkommen → Gespräch (Voice/Text) → Suchauftrag → Autopilot → Rückfrage → Angebot → Prüfung → Abschluss, plus a Settings panel (Quellen & Zugänge, Handlungsspielraum, Was dein Scout weiß). → `ui_kits/roomscout-app/`
2. **Landing page** — dark marketing page with hero, scrollytelling "So funktioniert's", feature bento, FAQ, footer. → `ui_kits/landing/`
3. **Operator view** ("Betreiberansicht", INTERN) — provider/source/task tables for operators. → `ui_kits/roomscout-app/Operator.jsx` (reachable via the demo bar).

## Content fundamentals

- **Language:** German only. Informal **du** for the individual user, **ihr/euch** when addressing the band ("Finden wir euren Proberaum.", "Eine verbindliche Zusage gibst nur du."). The Scout speaks in first person **ich** ("Ich kümmere mich darum.", "Ich melde mich, wenn ich euch brauche.").
- **Tone:** calm, competent personal scout — never an automation dashboard. Short declarative sentences, one thought per screen. Reassurance over feature lists. Honesty about the demo: "Interaktiver Prototyp · Beispieldaten", "In dieser Demo wird nichts versendet."
- **Casing:** sentence case everywhere. Headlines end with a period ("So suche ich für euch."). Overlines are UPPERCASE with wide tracking ("ANGEBOT EINGEGANGEN", "RAUM IN STUTTGART-WEST"). Wordmark always lowercase `roomscout`.
- **Buttons:** verb-first imperatives, 2–3 words: "Mit Scout sprechen", "Scout losschicken", "Angebot prüfen", "Angebot annehmen". Secondary actions are gentle: "Lieber schreiben", "Noch etwas ändern", "Zurück zum Gespräch".
- **Answer chips** are full replies in the user's voice: "Ja, Mittwoch passt" / "Nein, Donnerstag ist wichtig".
- **Data formatting:** middle dot separators "Stuttgart · bis 350 €", "Geteilter Raum · 4 Personen"; prices "280 € / Monat"; times "Mittwochs, 19–22 Uhr" (en dash); dates "1. Oktober 2026".
- **No emoji, no exclamation marks** except the Scout's greeting ("Hey Herzbuben!"). No percentages, counters, model names, IDs or technical logs in the band-facing flow.
- **Status lines** are human progress, not telemetry: "Ich habe angefragt, ob euer Schlagzeug im Raum bleiben kann und Donnerstag frei ist."

## Visual foundations

- **Background:** one continuous dark grain stage on every screen. Stack = photo `assets/bg.jpg` (mirrored, `saturate(.62) brightness(.5)`) → protection gradient (warm amber rgba(30,16,6,.28) at top → near-black petrol rgba(5,7,9,.92) at bottom) → `assets/grain.svg` overlay at .28 with `mix-blend-mode: overlay`. Position never changes between states. Page color `#0b0a09`.
- **Color:** a single accent, RoomScout orange `#ff6926` (hover `#ff7a3d`, light `#ff8a4e` for overlines/checks, deep `#e9511a`, pale `#ffc39a` for the blob highlight). Text is warm white `#f5ece2` stepping down through beige/taupe (`#e2d3c3`, `#cbb9a8`, `#a89684`) — never neutral grey. Semantic: danger `#b8382a` (end-call), warning amber `#e0a13a`, success `#4fbf7a`. User chat bubble is rust `rgba(120,58,22,.75)`. No gradients on UI except the blob and the bg protection.
- **Type:** Geist only, weights 300/400/500/600. Headlines are **light (300)** with `-.02em` tracking and 1.08 leading; the landing hero is 400 at `-.03em`; settings titles 44px/500. Body 15–17px, captions 14px, overline 12.5px/.14em uppercase. Mono (ui-monospace) appears only in the demo controls, never in product UI.
- **Cards:** dark translucent `rgba(18,14,12,.72)` (.66/.6 softer), 1px warm border `rgba(255,200,160,.14)`, radius 16–26px (28 for the settings panel). No blur on cards (blur only on the composer .6 → 6px, the mobile sheet 10px, the landing header). No milky glass, no neon, no glowing frames.
- **Shape:** pills everywhere for actions (999px), circles for icon buttons/avatars (42px), 10–12px for settings controls, 8px chips, chat bubble 18/18/4/18.
- **Shadows:** two glows only — the orange button glow `0 8px 32px rgba(255,105,38,.28)` on big CTAs and the blob glow. Floating surfaces (menu, toast, panel) use deep black shadows `0 20–30px 50–90px rgba(0,0,0,.35–.45)`. Switch knob `0 1px 3px rgba(0,0,0,.3)`.
- **Borders:** always alpha over peach (`rgba(255,220,190,x)` / `rgba(255,200,160,x)`), hairline dividers at .08–.1. Accent borders `rgba(255,140,90,.3–.5)` mark orange-tinted chips and the user bubble.
- **The Scout blob:** organic radial-gradient blob (`border-radius: 62% 38% 46% 54%/44% 58% 42% 56%`), free on the stage, never boxed. Breathes at rest (5.2s), livelier when speaking (1.6s), calmer rotation when listening (3.2s). Shrinks as decisions grow in importance: 168 → 160 → 96 → 58 → 44px. No rings, no waveforms.
- **Motion:** soft ease-out `cubic-bezier(.22,.8,.2,1)` for layout morphs (.9s list→card), `cubic-bezier(.3,.7,.2,1)` for capsule flights and accordions; content enters with `rsFadeUp` (8px, .3–.7s). Fact corrections crossfade in place with a 1s orange highlight. `prefers-reduced-motion` collapses everything to instant.
- **Hover:** background lightens (`rgba(255,255,255,.04 → .1)`), primary orange → `#ff7a3d`, ghost text → white, large CTA lifts 1px. Bento cards lift 3px. **Press:** no shrink; focus = 2px orange outline, 2px offset.
- **Layout:** centered single column, generous negative space, no sidebar in the main flow (sidebar 296px only inside the settings/operator panel). Header 84px (64 narrow) with wordmark left, status + profile right. Content widths 380 / 720 / 740 / 1190 / 1380. Fact list floats right of the conversation on desktop, becomes a bottom sheet on mobile.
- **Imagery:** one warm, real photo — a cozy rehearsal room with drums, amps, acoustic panels, tungsten light (`assets/proberaum.png`). No luxury studios, no stock smiles. Photos sit inside the offer card, never full-bleed behind text.
- **Transparency & blur:** surfaces are translucent so the grain shows through; blur is reserved for the composer, mobile sheet and landing header.

## Iconography

- The prototype uses its **own inline stroke SVGs** (24×24 viewBox, `stroke-width` 1.6 for facts/nav, 1.7–1.9 for controls, 2–2.2 for chevrons/checks, round caps and joins, `currentColor`). All 40 glyphs are lifted verbatim into `components/core/Icon.jsx` (see `guidelines/icons.html`). No icon font, no CDN set.
- Fact icons: pin (Ort), plain "€" glyph (Budget), users (Band), clock (Zeit), drum (Ausstattung). Offer checkmarks are orange, stroke 2.2.
- Emoji: never. Unicode used as glyphs: "€", "·" separators, "↓"/"↗" in landing links, "−"/"+" in the stepper, "!" in the operator attention badge.
- Brand marks: lowercase text wordmark in product; `assets/logo-roomscout.png` (white isometric RS cube) appears only as the roomscout.dev source avatar. Partner logos (`assets/partners/`) appear only in the operator integrations grid.

## Components

Inventory is the prototype's own UI; nothing invented beyond `Icon` (a wrapper for the source's inline SVGs, listed under Intentional additions).

- **core/** — `ScoutBlob`, `Wordmark`, `Icon`, `Button`, `IconButton`, `Avatar`, `Badge`, `Overline`, `StatusDot`, `Card`, `Capsule`, `SummaryPill`
- **forms/** — `Switch`, `RadioCard`, `TextInput`, `Stepper`, `Composer`, `VoiceControl`
- **feedback/** — `Toast`, `Hint`, `Notice`, `ChatBubble`
- **navigation/** — `AppHeader`, `NavItem` (+ `NavGroupLabel`), `ProfileMenu`, `Accordion`
- **data/** — `FactList`, `DataTable`

Intentional additions: `Icon` — the source draws icons inline per element; a named wrapper keeps the exact paths reusable.

## Index

- `styles.css` — entry; imports `tokens/fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `effects.css`, `base.css` (`.rs-bg` / `.rs-grain` background stack, keyframes `rsBreathe`, `rsSpeak`, `rsListen`, `rsFadeUp`, `rsDot`).
- `assets/` — `bg.jpg`, `grain.svg`, `proberaum.png`, `hero-preview.png`, `room-page-background.jpg`, `logo-roomscout.png`, `partners/` (agentmail, browserbase, convex, firecrawl, openai), `renders/` (six app renders + landing hero).
- `guidelines/` — 21 specimen cards (Colors, Type, Spacing, Brand).
- `components/<group>/<name>/` — one directory per component: JSX + `.d.ts` + `.prompt.md` + its own `*.card.html`.
- `ui_kits/roomscout-app/` — interactive app recreation (10 chapters incl. Sackgasse/Kandidaten, settings with 7 pages, operator view with 6 pages, mobile frame). `ui_kits/landing/` — marketing page.
- `thumbnail.html`, `SKILL.md`.

## Fonts

Geist is loaded from Google Fonts (`tokens/fonts.css`), exactly as the source prototype does. No font binaries were shipped with the prototype.
