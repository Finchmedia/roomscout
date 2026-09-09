# RoomScout UI port — maintainer decisions

**Decided: 2026-09-09.** This document answers all 68 open questions in `README.md` §3, one entry
per number, in the README's own order and sub-section grouping.

## How to read this document

Four things frame every decision below:

1. **The design system is the binding visual spec.** The Claude Design system mirrored at
   `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/design-system/` — its tokens
   (`design-system/tokens/`) and its component specs (`design-system/components/`) — is now the
   source of truth for colour, type, spacing, radii, control sizing, hover/focus treatment and
   component anatomy. Where the design system carries no value for something the prototype does,
   the prototype value applies verbatim.
2. **The screen docs stay binding for layout, copy and state.** `SCOUT_SCREENS.md`,
   `SCOUT_STATE.md`, `SETTINGS_SCREENS.md`, `OPERATOR_SCREENS.md` and `LANDING_SCREENS.md` remain
   the authority on what is on screen, in which order, with which German string, in which state.
   The design system restyles them; it does not re-specify them.
3. **Fix, don't reproduce prototype defects.** This is the blanket rule behind roughly a third of
   the answers below. Where the prototype throws, swallows an event, mislabels a state or shows the
   wrong asset, the port fixes it. Fidelity is owed to the design, not to the bugs.
4. **shadcn accessibility behaviours stand.** Focus trapping, outside-click close, focus restore,
   roving focus and `inert` come with the Radix primitives and are kept even where the prototype
   lacks them.

Each entry carries the question in one line, the decision, one consequence line naming the document
or file a builder has to change, and a status tag. `[decided]` needs no further sign-off.
`[decided, maintainer review pending]` means the build proceeds now and the maintainer reviews the
authored copy afterwards; it never blocks a builder.

Sibling documents are named by filename, as in `README.md`. Paths into the repository are absolute,
per the house rules in `README.md` §4.

---

## 3.1 Cross-cutting policy

**1. Is "rebuild 1:1" binding, or is `TOKENS.md` Part F advisory where the prototype's alpha ladders
and font sizes are inconsistent?** [decided]

- **Decision.** The design system tokens
  (`/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/design-system/tokens/*.css`, mirrored
  into `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/styles/tokens.css`) are
  binding. The `TOKENS.md` Part F collapse proposals are superseded by the design system. Where the
  design system has no value, the prototype value applies verbatim.
- **Consequence.** `TOKENS.md` Part F becomes historical record, not instruction; `COMPONENT_MAP.md`
  Part 7 step 1 copies the design-system tokens rather than the Part F ladder.

**2. Does 1:1 include reproducing affordances the prototype is missing — Operator's active nav item
and filter chips, Landing's seven text anchors, all of which lack hover?** [decided]

- **Decision.** Add the missing hover states using the design-system hover rules; shadcn defaults
  stand.
- **Consequence.** `OPERATOR_SCREENS.md` §4 (sidebar nav) and §6 (source filter chips) and
  `LANDING_SCREENS.md` §3 (header/nav anchors) gain hover rows sourced from the design system; log
  them as deltas in `COMPONENT_MAP.md` §8.2.

**3. Do shadcn's accessibility behaviours (focus trap, outside-click close, focus restore) override
strict fidelity?** [decided]

- **Decision.** Yes. The shadcn accessibility behaviours stand over strict fidelity.
- **Consequence.** `SETTINGS_SCREENS.md` §7.5 (knowledge kebab), §12 (connection sheet) and §6
  (discard dialog, outside-click dismissal deliberately off) are built as the docs specify; the
  delta table in `COMPONENT_MAP.md` §8.2 is now confirmed rather than proposed.

**4. Keep or drop the dead fields in the surface data contracts (`d.usableCount`, `d.initials`,
`d.stage`, `d.hasFacts`, `d.incident`, `d.offerStale`, `flags.voice`, `opData.stage`)?** [decided]

- **Decision.** Drop the dead fields from the port's surface contracts.
- **Consequence.** `SETTINGS_SCREENS.md` §0 (contract) and `OPERATOR_SCREENS.md` §1 (framing and
  host embedding) lose those props; the TypeScript surface props in
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/settings/` and
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/operator/` are narrowed
  accordingly.

---

## 3.2 Responsive & mobile

**5. Is the 390×844 `mobile` device frame in scope for the port at all?** [decided]

- **Decision.** The mobile phone frame is a prototype-preview affordance only and is not built. The
  port implements the narrow (≤ 959 px) breakpoint; the stage-frame bindings collapse to the desktop
  branch.
- **Consequence.** `SCOUT_SCREENS.md` §16 loses its `mobile` column and `stL/stT/stW/stH/stTf/stR/stB`
  collapse to one branch; `COMPONENT_MAP.md` §8.1 question 2 is closed.

**6. Settings below 900 px is invented, not measured — does the fallback plan stand?** [decided]

- **Decision.** Adopt the proposal: below 900 px the `PanelDialog` sidebar becomes a page picker
  (`Sheet`), rows stack, billing stats go single column, and the connection panel becomes a bottom
  sheet. Validate it in the browser during the Settings build.
- **Consequence.** `SETTINGS_SCREENS.md` §15 turns from proposal into specification; the browser
  check happens inside `COMPONENT_MAP.md` Part 7 step 7.

**7. Does Operator get a mobile layout, and what happens to the ≤ 820 px `/ops` tab bar?** [decided]

- **Decision.** Operator is desktop-first. Below 900 px it gets the same `PanelDialog` page-picker
  fallback as Settings. The legacy `/ops` tab bar is not carried over.
- **Consequence.** `OPERATOR_SCREENS.md` §4 and §16 inherit the Settings narrow pattern; the legacy
  tab bar in `APP_UI_INVENTORY.md` §7 is recorded as not ported in `BACKLOG.md` §1.

**8. Landing's narrow gaps: uncollapsed header nav below 880 px and bento card D's `max-width: 66 %`.**
[decided]

- **Decision.** Landing gets `Sheet`-based navigation below 880 px, and bento card D takes
  `max-width: 100 %`.
- **Consequence.** `LANDING_SCREENS.md` §3 (header), §10 (feature bento, card D) and §13 (responsive
  table) are updated to the collapsed layout.

**9. Unify the two `narrow` breakpoints (959 px app, 880 px landing), or keep both?** [decided]

- **Decision.** Keep two named breakpoints: `--bp-app-narrow: 959px` and `--bp-landing-narrow: 880px`.
- **Consequence.** Both tokens are declared in
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/styles/tokens.css`; `TOKENS.md`
  Part C records them as two distinct scale entries, not one.

---

## 3.3 Bilingual copy (DE/EN)

**10. No English strings exist anywhere, and the German `Du`/`ihr` register split has no English
equivalent.** [decided, maintainer review pending]

- **Decision.** English is drafted by an Opus agent from `de.ts`, following the design-system tone
  rules (sentence case, calm register, verb-first buttons); "you" and "your band" carry the du/ihr
  distinction. The build is not blocked on this; the maintainer reviews `en.ts` afterwards.
- **Consequence.** `COMPONENT_MAP.md` Part 7 step 5 proceeds on `de.ts` alone, and step 9 (`en.ts`
  plus the parity test) is unblocked; `en.ts` review is a separate gate after the surfaces exist.

**11. `summary()` builds German sentences by concatenation; English needs sentence-level templates.**
[decided]

- **Decision.** Use per-case sentence templates in both dictionaries for `summary()`.
- **Consequence.** `SCOUT_STATE.md` §5 (derived model helpers) and §20 (copy dictionary) replace the
  fragment list with one template per case; `COMPONENT_MAP.md` §6.2 gains the corresponding key
  shape.

**12. `factsFromNeed` bilingual strategy — fixed labels, value templates, and model-authored facet
labels.** [decided]

- **Decision.** Translate the fixed `factsFromNeed` label and value set client-side; render
  model-authored facet labels as-is. Asking the Scout to author facets in the active language goes
  to the backlog.
- **Consequence.** `DATA_BINDING_PLAN.md` §4 (fact list bindings) fixes the client-side set; the
  language-aware facet authoring item is added to `BACKLOG.md` §3.

**13. How are server-authored strings translated (search-source disclosures, blocker prefixes,
notification titles and bodies, model output)?** [decided]

- **Decision.** Server-authored strings render as-is — they are English today. Server-side
  localisation goes to the backlog.
- **Consequence.** `DATA_MAP.md` §8 marks those rows as pass-through, not dictionary keys; the
  localisation item is added to `BACKLOG.md` §3.

**14. Error copy has no German: ~30 English fallbacks, the ConvexError code map, 14 voice error
strings.** [decided]

- **Decision.** Introduce an error code map with DE and EN entries in the dictionary; unknown codes
  fall back to one generic DE/EN line.
- **Consequence.** `COMPONENT_MAP.md` §6.2 gains a `common.errors.*` namespace, `DATA_MAP.md` §0
  records the ConvexError code plumbing, and `DATA_BINDING_PLAN.md` §7 (loading/empty/error
  contract) points at the map instead of raw fallbacks.

**15. ~20 new German strings need authoring — who writes them?** [decided, maintainer review pending]

- **Decision.** The Opus agent proposes the ~20 new German strings with English pairs in
  design-system tone; they are listed in `docs/UI_PORT/REVIEW_COPY.md` for maintainer review.
- **Consequence.** A new document, `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/docs/UI_PORT/REVIEW_COPY.md`,
  collects the pairs; the states in `DATA_BINDING_PLAN.md` §5 (portal status, mailbox, pending
  connection) and §4.4.2 (outcome strings) get real copy from it.

**16. Competing vocabularies for the same concepts — which wording is canonical?** [decided]

- **Decision.** Canonical wording is the prototype/design-system wording where it exists; otherwise
  the Settings (`MandatePanel`) wording. Record the mapping in the copy layer.
- **Consequence.** `APP_UI_INVENTORY.md` §8 (shared component inventory) and `DATA_MAP.md` §8 note
  the winner per pair; the mapping lives as comments beside the keys in
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/copy/de.ts`.

**17. Should `common.*` be widened beyond the seven source keys?** [decided]

- **Decision.** Widen `common.*` with „Speichern“, „Übernehmen“, „Verwerfen“, „Weiter“,
  „Schließen“-style shared strings, and record each key's origin document and section in a comment.
- **Consequence.** `COMPONENT_MAP.md` §6.2 (dictionary shape) grows the `common` bag; this unblocks
  Part 7 step 5.

**18. Locale default, and where the toggle lives.** [decided]

- **Decision.** The locale default is German, unconditionally. The toggle lives in the profile menu
  and in the landing header.
- **Consequence.** `COMPONENT_MAP.md` §6.4 (provider, hook, toggle) drops the `navigator.language`
  probe; `LANDING_SCREENS.md` §3 gains the header toggle.

**19. Is Operator translated at all?** [decided]

- **Decision.** Operator is translated too, and the parity test covers all namespaces. Operator
  English is the last translation batch.
- **Consequence.** `COMPONENT_MAP.md` §6.5 keeps all 871 keys in scope, and Part 7 step 9 sequences
  Operator English last.

**20. Confirm the three excluded/hoisted key blocks — SCOUT `demo.*`, LANDING `v1.*`, SETTINGS
`common.*`.** [decided]

- **Decision.** Confirmed: Scout `demo.*` and Landing `v1.*` are excluded from the product
  dictionary, and Settings `common.*` is hoisted. Dev-only demo strings live in a separate
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/copy/dev.ts` if a dev stage
  picker needs them.
- **Consequence.** `COMPONENT_MAP.md` §6.2 records the exclusions; `SCOUT_SCREENS.md` §18.18 and
  `SCOUT_STATE.md` §17 stay "not to be built" for the product surface.

---

## 3.4 Scout surface

**21. `backToConvo` crashes the prototype because „Ja, leg los.“ sets `stepIndex = SCRIPT.length`.**
[decided]

- **Decision.** Resolution (a): „Ja, leg los.“ is a synthetic user utterance that goes straight to
  the brief morph. This applies to the demo/gallery flow only; the real app is backend-driven.
- **Consequence.** `SCOUT_STATE.md` §8 (branch flows, defect #1) and `SCOUT_SCREENS.md` §7 record the
  synthetic utterance; `COMPONENT_MAP.md` §8.1 question 5 is closed.

**22. `Sched.paused` survives `go()` — derive it, or clear it in the stage reset?** [decided]

- **Decision.** Derive `paused` from `searchPaused || sessionHeld`. There is no `demoPaused` in the
  app.
- **Consequence.** `SCOUT_STATE.md` §10 (pause/hold/resume) drops the stored flag;
  `DATA_BINDING_PLAN.md` §3 derives it from backend state.

**23. `arriveReply` swallows the reply while `waitingFor` is set and never re-arms.** [decided]

- **Decision.** Re-arm the reply after unblocking, in the demo flow. In the app the reply is
  backend-driven.
- **Consequence.** `SCOUT_STATE.md` §7 and §8 (defect #10) specify the re-arm for the demo engine
  only.

**24. `keepSearching` / `keepWaiting` park the flow with no timer.** [decided]

- **Decision.** In the app, `keepSearching` and `keepWaiting` only change status copy. The stage
  stays backend-derived, and there are no timers.
- **Consequence.** `SCOUT_SCREENS.md` §8 (autopilot stage) and `DATA_BINDING_PLAN.md` §4 bind those
  controls to copy, not to state transitions.

**25. Three unreachable UI paths — the §8.3 approval card, §8.4 `waitingSource`, §8.5
`waitingAccess`.** [decided]

- **Decision.** Build all three. In the app they are reachable through the `ScoutBlockers` overlays.
- **Consequence.** `SCOUT_SCREENS.md` §8.3–§8.5 stay in the build; `DATA_BINDING_PLAN.md` §4 wires
  them to the blocker source.

**26. Two computed variants are never rendered — the amber over-budget line and the out-of-area
marker.** [decided]

- **Decision.** Build both variants (the amber over-budget line and the out-of-area marker) with DE
  and EN copy. Real matches can be over budget or outside the area.
- **Consequence.** `SCOUT_SCREENS.md` §14 (candidates) keeps both computed fields; the two new copy
  pairs go into `docs/UI_PORT/REVIEW_COPY.md`.

**27. Dead-end budget line — the hard-coded „Budget bis 400 €“ or the dynamic `deadBudget`?**
[decided]

- **Decision.** Use the dynamic dead-end budget line.
- **Consequence.** `SCOUT_SCREENS.md` §13 binds the line to `deadBudget` instead of the literal.

**28. Review-card photo always renders `assets/proberaum.png`, even for candidates without one.**
[decided]

- **Decision.** Use the „Foto folgt vom Anbieter“ placeholder whenever a candidate has no photo.
- **Consequence.** `SCOUT_SCREENS.md` §11 (review) adopts the placeholder that §10.2 and §14 already
  define.

**29. The toast never auto-dismisses — keep that, or give it a duration?** [decided]

- **Decision.** The toast is manual-dismiss only (Sonner `duration: Infinity`).
- **Consequence.** `SCOUT_SCREENS.md` §15 and `SCOUT_STATE.md` §14 (toast, hint, transcript) keep the
  manual dismissal; `COMPONENT_MAP.md` §8.1 question 6 is closed on the Sonner anchor.

**30. The complete stage's subline („keine echte Zusage versendet“) is false in the real app.**
[decided, maintainer review pending]

- **Decision.** Replace the false subline with honest wording. Proposed German: „Deine Zusage ist
  unterwegs zum Anbieter. Ich schicke euch die Bestätigung, sobald sie da ist.“
- **Consequence.** `SCOUT_SCREENS.md` §12 (complete) takes the new subline, the English pair goes
  into `docs/UI_PORT/REVIEW_COPY.md`, and the `BACKLOG.md` §2 entry closes.

**31. „Mein Vorschlag“ — the prototype's cheapest-fitting-candidate rule, or `match.score`?**
[decided]

- **Decision.** „Mein Vorschlag“ uses the backend match assessment score. The prototype rule is the
  fallback when no score exists.
- **Consequence.** `SCOUT_SCREENS.md` §14 and `DATA_BINDING_PLAN.md` §4 bind the badge to the
  assessment score with the prototype rule as fallback.

**32. Voice 15-minute cap UX — countdown, warning, or silent end?** [decided]

- **Decision.** Voice cap: a warning in the last minute, then a graceful end landing on the
  „Gespräch beendet“ state with one DE/EN line.
- **Consequence.** `DATA_BINDING_PLAN.md` §4 (voice bindings) specifies the warning and the terminal
  state; the copy pair goes into `docs/UI_PORT/REVIEW_COPY.md`.

**33. Clarification trigger — does `providerAssessment.nextAction === "ask_musician"` replace or
supplement `opportunity.uncertainties.length > 0`?** [decided]

- **Decision.** Supplement: `providerAssessment.nextAction === "ask_musician"` OR
  `opportunity.uncertainties.length > 0` triggers clarification.
- **Consequence.** `DATA_BINDING_PLAN.md` §3.1 step 6 takes the disjunction.

**34. Outcome-card lifetime — per-session or persisted?** [decided]

- **Decision.** Outcome cards are dismissed in per-session local state. A persisted `dismissedAt`
  goes to the backlog.
- **Consequence.** `DATA_BINDING_PLAN.md` §4.4.2 binds dismissal to component state; the schema
  field is added to `BACKLOG.md` §3.

---

## 3.5 Settings

**35. Standalone mode throws on almost every click (`A.toggleSource is not a function`).** [decided]

- **Decision.** Confirmed: a no-op action bag for gallery/preview mode, instead of reproducing the
  throw.
- **Consequence.** `SETTINGS_SCREENS.md` §0 (contract) defines the no-op bag used by the gallery
  route under `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/gallery/`.

**36. The connection sheet is hard-wired to the `roomscout` source.** [decided]

- **Decision.** Parameterise the connection sheet by source id.
- **Consequence.** `SETTINGS_SCREENS.md` §12 (connection sheet) takes a source id prop; the delta is
  already listed in `COMPONENT_MAP.md` §8.2.

**37. „Weitere Quellen“ duplicates listed rows, and the „Gespeichert“ flash lands on the wrong row.**
[decided]

- **Decision.** Fix both: filter already-listed sources out of „Weitere Quellen“, and scope the
  „Gespeichert“ flash to the clicked row.
- **Consequence.** `SETTINGS_SCREENS.md` §4 (Quellen & Zugänge) records both fixes as deltas.

**38. `state.originId` („Herkunft: … Verwendet für: …“) has no close control and never clears.**
[decided]

- **Decision.** Add dismissal for the origin popover: Escape, outside click, and a close affordance.
- **Consequence.** `SETTINGS_SCREENS.md` §7.5 (knowledge row controls) specifies the popover
  dismissal; `COMPONENT_MAP.md` §8.2 already carries the delta.

**39. Does the app adopt the prototype's fact/knowledge split (no retire for `factId` rows, 6 s undo
for the rest)?** [decided]

- **Decision.** Adopt the split: rows carrying a `factId` cannot be retired (toast); other knowledge
  items get the 6 s undo.
- **Consequence.** `SETTINGS_SCREENS.md` §7 (Was dein Scout weiß) keeps both branches;
  `DATA_BINDING_PLAN.md` §5 binds them to `deleteFact` versus the memory retire path.

**40. Source preference shape — is `prefer` meant to gain an effect?** [decided]

- **Decision.** A two-state switch (include/exclude). `prefer` is not surfaced until
  `enableDefaultAutopilot` reads it.
- **Consequence.** `SETTINGS_SCREENS.md` §4 renders two states; `DATA_BINDING_PLAN.md` §5 records
  that the enum keeps four values while the UI exposes two.

**41. Mandate already in `research_autopilot` / `outreach_autopilot` — two radios, four backend
modes.** [decided]

- **Decision.** Confirmed: a read-only third state naming the actual backend mode, plus an explicit
  switch action.
- **Consequence.** `SETTINGS_SCREENS.md` §5 (Handlungsspielraum) gains the third state;
  `DATA_BINDING_PLAN.md` §5 binds it to the live mandate mode.

---

## 3.6 Operator

**42. Empty `t2` detail text — write real expired-state copy, hide the row, or clear `openTask`?**
[decided]

- **Decision.** Write the real copy, and draft English from the sheet's Ursache/Auswirkung lines.
- **Consequence.** `OPERATOR_SCREENS.md` §7 (Aufträge) gets the detail copy, sourced from §11 (the
  Diagnose sheet); both strings land in §17 (copy dictionary) and in `docs/UI_PORT/REVIEW_COPY.md`
  for the English pair.

**43. Diagnose sheet reachability after resolution — gate on `hasIncident` instead of
`incidentOpen`?** [decided]

- **Decision.** Confirmed: gate the Diagnose sheet on `hasIncident`, so the resolved state stays
  inspectable.
- **Consequence.** `OPERATOR_SCREENS.md` §10 (Diagnose) and §11 (sheet) change the trigger
  condition; §12 (incident flow) records the deviation.

**44. „Letzter Demo-Check“ in English — 12-hour or 24-hour time?** [decided]

- **Decision.** 24-hour time in both languages, via `Intl` with `hour12: false`: „Heute, 9:41“ and
  "Today, 9:41".
- **Consequence.** `OPERATOR_SCREENS.md` §5 (Betrieb im Blick) uses one formatter for both locales;
  `COMPONENT_MAP.md` §6.3 (interpolation, plurals, dates) records the option.

**45. The calm banner and the no-incident Diagnose card both end by pointing at the demo control
bar.** [decided]

- **Decision.** Drop the sentence pointing at the demo bar. No replacement.
- **Consequence.** `OPERATOR_SCREENS.md` §5 and §10 truncate to the first sentence; §17 drops the
  second-sentence keys.

**46. „Betreiberansicht“ has no product-UI entry — menu row or URL only?** [decided]

- **Decision.** Betreiberansicht gets an operator-only row in the profile menu and stays behind
  `RequireOperator` by URL.
- **Consequence.** `OPERATOR_SCREENS.md` §1 (framing) and the `ProfileMenu` spec under
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/chrome/` add the gated row; the
  `BACKLOG.md` §1 entry closes.

**47. Does the ops cockpit keep its sidebar layout, or does `sidebar-13` replace it?** [decided]

- **Decision.** The `sidebar-13` `PanelDialog` replaces the ops layout. This is a maintainer decision.
- **Consequence.** `OPERATOR_SCREENS.md` §16 (`sidebar-13` mapping plan) becomes the layout, not an
  alternative; `DATA_MAP.md` §1 route notes for `/ops/*` follow the dialog contract.

---

## 3.7 Landing

**48. Reduced motion — the source's one-shot `matchMedia` capture, or a subscribing hook?** [decided]

- **Decision.** Use a subscribing `useReducedMotion` hook. Accessibility over 1:1.
- **Consequence.** `LANDING_SCREENS.md` §2 (scroll engine, reduced motion) and `COMPONENT_MAP.md`
  §5.5 specify the hook, which lives under
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/motion/`.

**49. Heading outline — reproduce the source's outline, or improve the accessibility tree?**
[decided]

- **Decision.** Improve the outline: bento card titles become `h3`, and accordion triggers keep
  shadcn's `h3` wrapper.
- **Consequence.** `LANDING_SCREENS.md` §10 (feature bento) and §11 (Kontrolle & FAQ) change their
  element rows; the delta is logged in `COMPONENT_MAP.md` §8.2.

**50. Sticky-branch flip point — the ≈900 px threshold derived from the current hero screenshot.**
[decided]

- **Decision.** Keep the flip threshold as one token, and re-measure it when the hero screenshot is
  re-shot from the real app.
- **Consequence.** `LANDING_SCREENS.md` §4 (hero) references the token rather than a literal; the
  token is declared in
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/styles/tokens.css`.

**51. Where does the German/English toggle live on the landing page, and how does it hover?**
[decided]

- **Decision.** The landing language toggle sits in the header next to the CTA, in ghost button
  style with the design-system ghost hover.
- **Consequence.** `LANDING_SCREENS.md` §3 (header/navigation) adds the control; it uses the `Button`
  ghost variant from the design system.

---

## 3.8 Tokens & assets

**52. Primary control height — 46 px as measured, or a 44 px touch-target baseline?** [decided]

- **Decision.** Control heights follow the design-system button sizes (base 50, sm 46, xs 44). There
  is no 44 px baseline override.
- **Consequence.** `TOKENS.md` Part C and the `--rs-control-h` usage give way to the design-system
  size scale in
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/styles/tokens.css`.

**53. Dot sizes — keep all five tokens, or one component?** [decided]

- **Decision.** One `StatusDot` component with a `size` prop, defaulting to 8 px.
- **Consequence.** `COMPONENT_MAP.md` §1.1 (chrome atoms) collapses the five dot tokens into one
  component; `TOKENS.md` Part C keeps the raw values as sizes the prop can take.

**54. `--gray-100` is consumed three times but never defined.** [decided]

- **Decision.** Define `--gray-100: var(--rs-ink-2)` in the legacy alias block of `tokens.css`.
- **Consequence.** `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/styles/tokens.css`
  gains the alias; `APP_UI_INVENTORY.md` §3 (stylesheets) records that the three usages now resolve.

**55. Asset lifecycle for `hero-preview.png` and `proberaum.png`.** [decided]

- **Decision.** `hero-preview.png` is replaced by a real app screenshot once the app exists.
  `proberaum.png` stays demo content.
- **Consequence.** `LANDING_SCREENS.md` §15 (assets) notes the pending re-shoot, which also triggers
  the item 50 re-measure; `SCOUT_SCREENS.md` §11 keeps `proberaum.png` as demo content only.

**56. The dev bar — prototype-only, or a wanted debug affordance?** [decided]

- **Decision.** The dev bar is prototype-only and is not shipped in product UI. A dev-only stage
  picker may exist on the gallery route (`/design`) for review, using the `dev.ts` strings.
- **Consequence.** `TOKENS.md` Part A drops the dev-bar values from the product surface;
  `SCOUT_STATE.md` §17 stays "not to be built"; the gallery picker lives under
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/gallery/` with copy from
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/copy/dev.ts`. This also settles
  item 20.

---

## 3.9 Backend additions & app behaviour

**57. `api.notifications.listMine` plus a read mutation — add it, or synthesise activity
client-side?** [decided]

- **Decision.** Add `api.notifications.listMine` and `markRead` after the Scout surface first pass.
  This is backend addition #1.
- **Consequence.** `DATA_BINDING_PLAN.md` §10 (minimal backend additions) keeps it as priority 1,
  sequenced after `COMPONENT_MAP.md` Part 7 step 6; `DATA_MAP.md` §7 (gaps) closes on it.

**58. `offerAcceptance.canPrepare` — build the query, or accept the optimistic failure?** [decided]

- **Decision.** Add `offerAcceptance.canPrepare` after the Scout surface first pass. This is backend
  addition #2.
- **Consequence.** `DATA_BINDING_PLAN.md` §10.8 keeps it as priority 2; the „Angebot prüfen“ binding
  in §4 gates on it once it exists.

**59. `memory.countMine` — add the counter, or keep the label numberless?** [decided]

- **Decision.** Keep the label numberless for now. `countMine` goes to the backlog.
- **Consequence.** `DATA_BINDING_PLAN.md` §10.9 and `SETTINGS_SCREENS.md` §7 drop the „{n} Angaben“
  interpolation; the counter is added to `BACKLOG.md` §3.

**60. `signal.isDemo` — badge, filter, or operator-only toggle?** [decided]

- **Decision.** Badge „Kontrollierte Demo-Quelle“ on the musician surface for demo-provenance
  signals.
- **Consequence.** `DATA_BINDING_PLAN.md` §4 (signal rendering) adds the badge; the German string
  and its English pair go into `docs/UI_PORT/REVIEW_COPY.md`.

**61. Four documented but unreachable controls — port them, port them dormant, or delete them?**
[decided]

- **Decision.** Not ported. The four unreachable legacy controls stay in the legacy components and
  in the backlog.
- **Consequence.** `APP_UI_INVENTORY.md` §8 marks them legacy-only; `BACKLOG.md` §1 keeps the
  `SignalCard` action row, `SearchProfileCard` edit/confirm, `ActionApprovalSheet` standing-mandate
  branch and `SearchSourcesPanel` `connection_required` control as open items.

**62. `ApprovalComposer`'s acknowledgement checkbox on Subject/Message edits.** [decided]

- **Decision.** Clear the acknowledgement checkbox on Subject or Message edits.
- **Consequence.** `DATA_MAP.md` §2 (shared surfaces) records the behaviour change from today's
  save-branch catch.

**63. The shell's „Nachrichten“ badge and `/app/inbox` read different endpoints.** [decided]

- **Decision.** Use `api.communications.listThreadsMine` for both the badge and the list when the
  inbox is next touched. This is legacy work and stays on the backlog.
- **Consequence.** `APP_UI_INVENTORY.md` §2 (global chrome) notes the intended endpoint;
  `BACKLOG.md` §1 keeps the reconciliation as a legacy item.

---

## 3.10 Documentation housekeeping

**64. `SCOUT_SCREENS.md` §15.0 documents constructor state consumed by Settings and Operator.**
[decided]

- **Decision.** Leave the constructor-state documentation where it is, and cross-reference only.
- **Consequence.** `SCOUT_SCREENS.md` §15 keeps `notif`, `autoSources`, `knowledge`/`KNOW0` and
  `incident`; `SETTINGS_SCREENS.md` and `OPERATOR_SCREENS.md` point at it rather than duplicating.

**65. Line references will drift if the prototype is re-exported.** [decided]

- **Decision.** Accepted: line references are pinned to the 2026-09-09 export and are re-verified on
  re-export.
- **Consequence.** Every screen doc's line ranges, including `SCOUT_STATE.md`'s "lines 646–1230"
  header, are valid against that export only; a re-export triggers a verification pass.

**66. Unverified test-pin claims in `DATA_BINDING_PLAN.md`.** [decided]

- **Decision.** Verify the remaining test-pin claims when the affected tests are rewritten.
- **Consequence.** `DATA_BINDING_PLAN.md` §11 keeps the `ScoutPage`, `ActionLifecyclePanel`,
  `ProviderOfferPanel`, `PortalAuthenticationGuide` and `mandatePolicy` pins flagged as unaudited
  until then.

**67. `MUSIC_CONTEXT_IMPORT_PROMPT` is cross-referenced rather than reproduced in `BACKLOG.md` §4.**
[decided]

- **Decision.** Leave the cross-reference. Do not copy the block.
- **Consequence.** `BACKLOG.md` §4 keeps pointing at `APP_UI_INVENTORY.md` §8 for those 14 lines.

**68. `tokens.proposed.css` was edited alongside `TOKENS.md` — revert it?** [decided]

- **Decision.** The `tokens.proposed.css` edits stand. The file is superseded by the design-system
  tokens anyway.
- **Consequence.** `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/docs/UI_PORT/tokens.proposed.css`
  stays as edited and becomes historical; the scratchpad backup `tokens.bak.css` is not needed.

---

## Naming and layout reconciliation

The design-system names are canonical. Where `COMPONENT_MAP.md` uses a prototype-derived name, the
alias table below gives the name and file a builder actually writes against. All component files
live under `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/`.

| `COMPONENT_MAP.md` name | Canonical name | File |
|---|---|---|
| Eyebrow | Overline | `src/components/ui/overline.tsx` |
| GlassCard | Card | `src/components/ui/card.tsx` (tone/size per `Card.d.ts`) |
| Pill | SummaryPill | `src/components/ui/summary-pill.tsx` |
| RsSwitch | Switch | `src/components/ui/switch.tsx` (restyled shadcn) |
| RsButton / B1–B6 | Button variants `primary` \| `secondary` \| `tint` \| `ghost` \| `link` \| `danger` | `src/components/ui/button.tsx` |
| IconCircleButton | IconButton | `src/components/ui/icon-button.tsx` |
| ComposerPill | Composer | `src/components/ui/composer.tsx` |
| Bubble | ChatBubble | `src/components/ui/chat-bubble.tsx` |
| HintBar | Hint | `src/components/ui/hint.tsx` |
| RsAlert / D6 | Notice | `src/components/ui/notice.tsx` |
| SidebarShell / D10 | PanelDialog | `src/ui/chrome/PanelDialog.tsx` (the `sidebar-13` pattern) |
| SidebarNavItem | shadcn `SidebarMenuButton`, restyled | shadcn sidebar block |
| DataGrid | Table / DataTable | `src/components/ui/table.tsx` |
| the ~30 inline SVGs | Icon | `src/components/ui/icon.tsx` |

`StatusDot`, `Wordmark`, `Stepper`, `RadioCard`, `VoiceControl`, `ScoutBlob`, `FactList` and
`Capsule` keep their names.

### Layout

- `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/components/ui/` holds **both** the
  restyled shadcn primitives and the design-system atoms, in kebab-case files. There is no
  `src/ui/primitives` directory.
- `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/` holds composed UI: `chrome/`
  (`StageBackground`, `AppHeader`, `PanelDialog`, `ProfileMenu`, …), `scout/`, `settings/`,
  `operator/`, `landing/`, `copy/`, `gallery/`.
- Keyframes and the reduced-motion clamp live in
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/styles/tokens.css`, not in
  `src/ui/motion/motion.css`. Motion hooks still go to
  `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout/src/ui/motion/`.
- The `COMPONENT_MAP.md` rule stands: nothing under `src/ui` imports from `src/components` except
  `@/components/ui`.
