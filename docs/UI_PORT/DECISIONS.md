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

---

## Copy-layer decisions (2026-09-09, afternoon)

**Decided: 2026-09-09, afternoon.** The German copy extraction (five surface dictionaries plus the
`common.*` bag, `src/ui/copy/de/*.ts`) and the copy runtime (`types.ts`, `format.ts`,
`LocaleProvider.tsx`, `useCopy.ts`, `LanguageToggle.tsx`, `copy.test.ts`) raised open questions that
items 1–68 above do not answer. This section answers them, numbering on from 68, one entry per
distinct question, deduplicated across the eleven agents that raised them. `Raised by` names the
agent and surface so a question can be traced back.

Three rules decide most of them, and they are worth stating once:

- **Verbatim wins.** A source string's placeholder name and value shape are part of the string.
  `{count}` on one surface and `{n}` on another are not unified, and `{budget}` keeps whichever
  value shape its own key expects. Both names stay in the `CopyVars` union; each key's expected
  shape is documented in a comment beside it when the surface is built.
- **One key per visible variant.** Two keys carrying the same German string are not a bug and are
  not hoisted. English may legitimately diverge between them.
- **No invented copy.** A string the prototype never contained is proposed in
  `docs/UI_PORT/REVIEW_COPY.md`, never written straight into a dictionary.

---

### Key shape and naming

**69. `hero.cta.secondary` is both a leaf („So funktioniert’s“) and a namespace (`.arrow` = „↓“) in
`LANDING_SCREENS.md` §17.2 — which shape ships?** [decided]

- **Raised by** extract:landing, fix:landing.
- **Decision.** The shipped shape stands: `landing.hero.cta.secondary.label` plus
  `landing.hero.cta.secondary.arrow`. The alternative sibling-leaf spelling `secondaryArrow` is
  rejected, because `.label` + `.arrow` is the pattern `operator.flags.preview.arrow` already uses.
- **Consequence.** `en.ts` and `LANDING_SCREENS.md` §17.2 mirror the `.label` sub-key; the alias
  `doc hero.cta.secondary → dictionary hero.cta.secondary.label` is recorded in
  `COMPONENT_MAP.md` §6.1 as the third hand-edit, so a doc-driven key checker does not report a
  false failure.

**70. Eleven Scout doc keys are both a leaf and a namespace; the bare value moved to `.text`. Is
that the sanctioned resolution?** [decided]

- **Raised by** extract:scout.
- **Decision.** Yes. The `.text` sub-key is the standing resolution for every leaf/branch collision,
  on every surface. No string changed; eleven paths gained a segment.
- **Consequence.** `COMPONENT_MAP.md` §6.1 records all eleven renames — `discovery.ended`,
  `facts.ort`, `activity.found`, `activity.found2`, `clarification.yes`, `clarification.no`,
  `offer.prompt`, `review.accept`, `data.knowledge.genre`, `data.knowledge.mates`,
  `data.knowledge.amps` — and `SCOUT_SCREENS.md` §18 mirrors them, so `en.ts` and the parity test
  agree.

**71. The two Settings plural folds rename four doc keys — is the fold accepted?** [decided]

- **Raised by** extract:settings.
- **Decision.** Accepted. `billing.usage.searchesOne`/`searchesMany` fold into
  `settings.billing.usage.searches.{one,other}`, and `knowledge.import.doneOne`/`doneMany` into
  `settings.knowledge.import.done.{one,other}`. The values are verbatim; only the key shape changed.
- **Consequence.** `SETTINGS_SCREENS.md` §17.6 and §17.9 are amended to the object shape so a
  doc↔dictionary diff needs no special case, and `COMPONENT_MAP.md` §6.1 lists the four renames.

**72. `settings.import.title` uses the doc's numeric keys `1`/`2`/`3` — rename them?** [decided]

- **Raised by** extract:settings (twice).
- **Decision.** No rename. The quoted `"1"`/`"2"`/`"3"` keys stay, because `step1`/`step2`/`step3`
  are already taken by the sibling `import.step1.*` blocks and any other renaming invents a
  vocabulary the docs do not have. `DeepLeafPaths` handles them.
- **Consequence.** `settings.import.title.1` is a valid `CopyKey`; no document changes.

**73. Adding the expired detail string forces `operator.tasks.t2.detail` from a leaf into an object
— which shape?** [decided]

- **Raised by** extract:operator (twice), fix:operator.
- **Decision.** `{ default, expired }`, mirroring the `t3.detail` shape that already ships. The
  rename and the new string land in one edit, never separately.
- **Consequence.** Listed under *Deferred to the surface build* below with the exact paths;
  `OPERATOR_SCREENS.md` §17.4 takes the object shape.

---

### Placeholders and value shapes

**74. `scout.brief.sheet.count` uses `{count}` and `settings.knowledge.import.done` uses `{n}` for
structurally identical plurals — unify?** [decided]

- **Raised by** fix:scout, extract:scout.
- **Decision.** No unification. Both spellings are verbatim source, both stay in `COPY_VAR_NAMES`,
  and no file renames unilaterally. The same holds for `scout.data.log.knowledgeImported` (`{count}`)
  against its Settings twin (`{n}`).
- **Consequence.** `COMPONENT_MAP.md` §6.3 records the split as intentional rather than as a defect
  to be fixed later.

**75. `{budget}` carries three different value shapes across four verbatim keys — disambiguate the
token?** [decided]

- **Raised by** fix:scout.
- **Decision.** The token name stays `{budget}` everywhere; renaming it would edit verbatim §18
  values. The resolved forms are named keys (`scout.facts.budget.lower.*`,
  `scout.facts.budget.compact.*`), so a caller never transforms a translated string. Each key's
  expected shape is documented in a comment beside it.
- **Consequence.** The wiring contract — full label for `autopilot.approval.message`, compact label
  for `autopilot.brief.pill.compact`, bare number for `candidates.budget.over` and
  `deadEnd.option.budget.title` — is confirmed when those components are built.

**76. `SCOUT_STATE.md` §20.6 names the over-budget placeholder `{budgetNum}`; `SCOUT_SCREENS.md`
§18.17 says `{budget}`.** [decided]

- **Raised by** extract:scout, fix:scout.
- **Decision.** `SCOUT_SCREENS.md` is canonical. `{budget}` is correct; `{budgetNum}` is a document
  error and appears in no shipped value.
- **Consequence.** `SCOUT_STATE.md` line 1650 is corrected. Listed under *Doc patches pending*.

**77. `{time}` exists in no source dictionary — is the port-only placeholder sanctioned?** [decided]

- **Raised by** extract:operator (twice), fix:scout.
- **Decision.** Yes. `operator.sources.check.renewed` and `scout.data.time.today` both ship
  „Heute, {time}“, per item 44 and `COMPONENT_MAP.md` §6.3, and `{time}` joins the interpolation
  union. The prototype's `"Heute, {h}:{mm}"` survives only as a comment.
- **Consequence.** `COMPONENT_MAP.md` §6.3's placeholder union gains `{time}`.

**78. With `check.renewed` now `Intl`-formatted, nothing consumes `operator.host.now.format`
(„{prefix}, {h}:{mm}“) and `host.now.prefix` — keep or drop?** [decided]

- **Raised by** extract:operator (twice), fix:scout.
- **Decision.** Keep both, verbatim, as documented dead keys. They are §17.12 source copy and the
  only carriers of `{prefix}`; deleting source strings to tidy a dictionary is the wrong direction.
  No component may consume them. They are removed in the same change that ports the host's `now()`
  helper to `Intl`, not before.
- **Consequence.** `OPERATOR_SCREENS.md` §17.12 marks the pair dead-but-catalogued; `en.ts`
  translates them.

**79. Arrow glyphs are split inconsistently in the source: only the hero CTA breaks its „↓“ into its
own key.** [decided]

- **Raised by** extract:landing.
- **Decision.** Leave all four as the source has them. `how.link.features`,
  `features.autopilot.link` and `closing.cta.secondary` keep the arrow baked into the string;
  `hero.cta.secondary` keeps its split, which item 69 already forced. No further splitting.
- **Consequence.** No document changes; `en.ts` mirrors the same four shapes.

---

### Strings the prototype never contained

**80. The DE/EN language toggle has no strings anywhere — labels and `aria-label`.** [decided,
maintainer review pending]

- **Raised by** extract:landing (twice), extract:settings, runtime.
- **Decision.** The strings are the ones already proposed in `REVIEW_COPY.md` §7:
  `common.language.toggleAria`, `.shortDe`, `.shortEn` for the control that the landing header and
  the profile menu share, plus `settings.profile.language.label|de|en|aria` for the Settings row.
  One control, one key set — landing does not get its own toggle keys. Nothing is written into
  `de/common.ts` before the maintainer accepts §7, so `LanguageToggle.tsx` keeps its hard-coded
  `Record<Locale, string>` map and ships `role="group"` with no `aria-label` until then.
- **Consequence.** `LANDING_SCREENS.md` §3 and §17.1 gain the toggle once §7 is accepted; the
  `LanguageToggle` map move is listed under *Deferred to the surface build*.

**81. The narrow-viewport navigation sheets have no trigger, close or `aria-label` strings.**
[decided, maintainer review pending]

- **Raised by** extract:landing, fix:landing.
- **Decision.** `REVIEW_COPY.md` §8 already proposes all four —
  `landing.header.nav.openAria`, `landing.header.nav.closeAria`, `settings.nav.pickerAria`,
  `operator.nav.pickerAria`. They stand. Reusing `common.close` („Schließen“) for the landing sheet
  is rejected: an icon-only close in a navigation sheet wants „Menü schließen“, and the two keys can
  legitimately diverge in English.
- **Consequence.** Landing gains two keys once §8 is accepted, moving its count from 123 to 125.

**82. „{n} Angaben aus Beispiel-Kontext übernommen“ is a hard plural with no singular — n=1 renders
„1 Angaben …“.** [decided, maintainer review pending]

- **Raised by** fix:settings, fix:scout.
- **Decision.** A German singular is authored through `REVIEW_COPY.md` (new §12) rather than
  invented in an extraction: „{n} Angabe aus Beispiel-Kontext übernommen“, and its Scout twin with
  `{count}`. Both keys then become `{ one, other }`. This is the fifth plural case, which
  `COMPONENT_MAP.md` §6.3 does not list.
- **Consequence.** `settings.knowledge.log.entry.imported` and `scout.data.log.knowledgeImported`
  convert in one change — see *Deferred to the surface build*. §6.3's plural inventory gains a fifth
  row.

**83. `settings.privacy.portals.sub.other` is a `REVIEW_COPY.md` §10 proposal that already ships
inside the dictionary.** [decided, maintainer review pending]

- **Raised by** fix:settings, runtime.
- **Decision.** It stays shipped. `COMPONENT_MAP.md` §6.3 orders the plural form, so a singular-only
  node would be the larger deviation. If the maintainer rejects the wording, only that one value
  changes; if `DATA_BINDING_PLAN.md` §5.7's drop of „simuliert“ is taken, both forms lose the word
  together.
- **Consequence.** The plural-leaf assertion in `copy.test.ts` depends on the path existing; a
  rejection shrinks the expected list.

**84. `operator.tasks.t2.detail.expired` has no source string — the one key of 174 not shipped.**
[decided, maintainer review pending]

- **Raised by** extract:operator (twice), fix:operator.
- **Decision.** Item 42 stands, and the copy is the `REVIEW_COPY.md` §9 row, assembled verbatim from
  the Diagnose sheet's Ursache and Auswirkung lines so the two surfaces cannot drift. It lands
  together with the item 73 shape change.
- **Consequence.** Until it lands, the expanded Aufträge row renders a blank detail stripe in the
  incident state. That is accepted, not worked around.

**85. `scout.review.accept.disclaimer` and `scout.review.question.answer` end with the same false
demo sentence as the complete subline, and nothing replaces them.** [decided, maintainer review
pending]

- **Raised by** fix:scout.
- **Decision.** They get the same treatment as item 30. „In dieser Demo wird nichts versendet.“ is
  false in the real app and is dropped from both; the disclaimer's subjunctive („würde … zusagen“)
  becomes indicative, since the acceptance really is sent. Replacements are proposed in
  `REVIEW_COPY.md` §12 rather than edited in place.
- **Consequence.** `SCOUT_SCREENS.md` §11 takes the two new values; both are listed under *Deferred
  to the surface build*.

**86. Item 30's replacement subline is written down but `scout.complete.subline` still ships the
false one.** [decided, maintainer review pending]

- **Raised by** fix:scout.
- **Decision.** The `REVIEW_COPY.md` §5 wording is the value. The extraction was right to leave the
  swap to a separate edit; that edit is now scheduled.
- **Consequence.** `SCOUT_SCREENS.md` §12 line 1197 is patched in the same change.

**87. The complete headline („Euer nächster Proberaum steht bereit.“) overstates a sent
acceptance.** [decided, maintainer review pending]

- **Raised by** fix:scout, `REVIEW_COPY.md` §5.
- **Decision.** Left open deliberately. This is `DATA_BINDING_PLAN.md` §11 Q5, a product call about
  what the app claims at that moment, not a copy-layer question. No replacement is invented; the
  headline ships as it is until Q5 is answered.
- **Consequence.** `BACKLOG.md` §2 keeps the headline open after item 30 closes.

**88. `data.summary.pattern` shipped as bracket notation that `interpolate()` cannot render.**
[decided]

- **Raised by** extract:scout.
- **Decision.** Resolved in the dictionary as item 11 requires: `scout.data.summary` is now a set of
  per-case sentence templates (`empty`, `band.{fourFromOrt,four,fromOrt,plain}`,
  `seeks.{sharedAndStorage,shared,roomAndStorage,room,storage}`), every word taken from the §20.13
  fragment it replaces, with the default case rendering byte-for-byte as the doc's own example
  sentence. The nine concatenation fragments are not shipped.
- **Consequence.** `SCOUT_STATE.md` §5.3 and §20.13 replace the fragment bag with the template set;
  `en.ts` writes one English sentence per case rather than translating fragments.

**89. Three `SCOUT_STATE.md` §20 strings have no `SCOUT_SCREENS.md` §18 counterpart and were not
shipped.** [decided]

- **Raised by** extract:scout.
- **Decision.** Superseded. `scout.autopilot.brief.pill.compact` and `.budget.fallback` now ship as
  port keys replacing §18.10's pre-resolved `autopilot.briefPill` literal, and the release-budget
  fallback is covered by `scout.facts.budget.lower.*`. Nothing from §20 is missing after that.
- **Consequence.** `COMPONENT_MAP.md` §6.2's Scout block counts are re-measured — see item 112.

---

### Duplicates, and what stays out of `common.*`

**90. Roughly forty values are duplicated verbatim across distinct keys on all four surfaces — are
the duplicates deliberate?** [decided]

- **Raised by** extract:landing (twice), extract:settings (twice), extract:operator (twice).
- **Decision.** Deliberate, and confirmed: one key per visible variant. This covers Landing's eleven
  duplicate values, Settings' „Gespeichert“/„Abbrechen“/„Zurück“/„Schließen“/„Details“/„Speichern“
  clusters, and Operator's „Bereit“, „Konfiguriert“, „Diagnose“, „Anmeldung abgelaufen“ and
  „Nächster Schritt“. No further hoisting into `common.*`.
- **Consequence.** `COMPONENT_MAP.md` §6.1 records the confirmation, so the next reader does not
  re-open it as a de-duplication task.

**91. Should `common.*` be widened further — „Kopiert“, „Kopieren“, „Zurück zum Scout“?** [decided]

- **Raised by** extract:settings, fix:settings.
- **Decision.** No. `common.*` stays at eleven keys: the seven source keys plus `save`, `apply`,
  `discard`, `next` from item 17. „Kopiert“/„Kopieren“ stay per-surface, and „Zurück zum Scout“ is
  explicitly not hoisted — `COMPONENT_MAP.md` §D14 gives the sidebar back label two per-surface keys
  on purpose, and a third alias would let them drift. The item 17 widening covers generic action
  verbs, not navigation labels.
- **Consequence.** `COMPONENT_MAP.md` §6.2's `common` bag is closed at eleven keys. A component that
  needs a shared back label picks `settings.nav.back` or `scout.chrome.menu.backToScout` explicitly.

**92. Two near-identical clipboard-failure strings coexist.** [decided]

- **Raised by** extract:settings.
- **Decision.** Both stay. `settings.sources.address.copyFail` and `common.copyFailedToast` are
  verbatim from the docs, sit on different affordances (an address field versus a global toast), and
  may legitimately diverge in English.
- **Consequence.** No change; the near-duplicate is annotated so it does not read as a bug.

**93. `scout.data.name.default` duplicates `common.demoName` („Herzbuben“).** [decided]

- **Raised by** extract:scout.
- **Decision.** Both stay. Both source docs list them, and demo-data naming is not a shared concept
  worth a single origin.
- **Consequence.** No change.

**94. 21 of the 27 `scout.data.*` keys duplicate a `settings.*` string verbatim — should Settings
read the Scout keys instead?** [decided]

- **Raised by** fix:scout.
- **Decision.** No cross-surface refactor. Both dictionaries keep their keys, the origin comments
  from item 16 stay, and the runtime test that asserts the pairs are in sync stays. `en.ts`
  translating each string twice is the accepted cost of surface-owned namespaces.
- **Consequence.** `COMPONENT_MAP.md` §6.1 notes the sync test as the guard against drift.

**95. `operator.settings.*` and `operator.scout.*` are quoted copies of strings the Settings and
Scout dictionaries own.** [decided]

- **Raised by** extract:operator.
- **Decision.** Operator keeps its own copies, as `OPERATOR_SCREENS.md` §17.12 frames them. Operator
  is an internal surface and must not break when a musician-facing string is reworded.
- **Consequence.** The assembled `de` nests `operatorDe` under `operator`; it is never spread, or
  those blocks would silently merge into the real Scout and Settings namespaces.

**96. Three Operator keys duplicate `common.*` values — should call sites read `common.*`?**
[decided]

- **Raised by** fix:operator.
- **Decision.** Call sites read the Operator keys (`flags.action.cancel`, `tasks.action.details`,
  `diagSheet.close.aria`). `COMPONENT_MAP.md` §6.2 counts them inside Operator's 174, and mixing the
  two dictionaries at the call site is what would let them drift.
- **Consequence.** No change.

---

### Literals, counts and time

**97. Landing's hard-coded times and currency literals — tokenise them?** [decided]

- **Raised by** extract:landing (twice), fix:landing.
- **Decision.** They stay literal. `features.followup.msg1.time` („Heute, 14:27“), `.msg2.time` and
  every currency literal (`offer.price.amount`, `features.memory.row.budget.*`, `fact.budget.*`,
  `work.context.pill`) are landing demo data, not bound values. **Correction to the warning left in
  `landing.ts`:** the English pair is "Today, 14:27", not "Today, 2:27 PM". Item 44 fixes 24-hour
  time in both languages and outranks the note in the file.
- **Consequence.** `en.ts` writes 24-hour English for both stamps; the in-file comment is corrected
  when the landing surface is built.

**98. `operator.events.time.0941` / `.0942` are hard-coded clock strings under quoted numeric
keys.** [decided]

- **Raised by** extract:operator (twice).
- **Decision.** They stay as literals under their quoted keys. They are demo timeline content, and
  `en.ts` carries them over unchanged rather than transliterating them.
- **Consequence.** When the event log is fed from real data they take the same `Intl` treatment as
  `sources.check.renewed`; recorded in `BACKLOG.md` §3.

**99. `overview.attention.text` and `integrations.browserbase.test.incident` hard-code the count
1.** [decided]

- **Raised by** extract:operator, fix:operator.
- **Decision.** They ship as plain strings, verbatim. No plural is invented for a count that is not
  bound to anything. If either is ever bound to a live count, the `{ one, other }` pair is authored
  through `REVIEW_COPY.md` first.
- **Consequence.** `BACKLOG.md` §3 records the conditional; §6.3's plural inventory stays free of an
  Operator case for now.

**100. `scout.brief.sheet.count.one` hard-codes the numeral („1 Wunsch gemerkt“) while
`SCOUT_STATE.md` §20.11 parametrises it.** [decided]

- **Raised by** fix:scout.
- **Decision.** `SCOUT_SCREENS.md` §18.9 is canonical, so the hard-coded numeral stays. It is
  correct for German and English, which are the only two locales in scope.
- **Consequence.** `SCOUT_STATE.md` §20.11 is annotated rather than followed; a third locale whose
  `one` category also covers 21 and 31 would re-open it.

**101. Item 44 gives the English example „Today, 9:41“, but `Intl` with the `en` tag pads it to
"09:41".** [decided]

- **Raised by** runtime.
- **Decision.** Resolve the `en` locale to `en-GB` inside `formatTime`. Item 44's literal example is
  the specification, `hour12: false` stays, and `en-GB` renders "9:41" the way `de` renders „9:41“.
  Accepting "Today, 09:41" would silently contradict a decision that was written with an example.
- **Consequence.** `format.ts` maps the locale tag; the test's `/^0?9:41$/` tightens to `9:41`.
  Listed under *Deferred to the surface build*.

---

### Contradictions between documents

Where an agent found a document contradicting `DECISIONS.md`, this document wins and the document is
patched. The patches are collected under *Doc patches pending* below.

**102. Item 45 drops the demo-bar sentence, but `OPERATOR_SCREENS.md` still carries both sentences
at four line positions, so `operator.ts` shipped them doc-verbatim.** [decided]

- **Raised by** fix:operator.
- **Decision.** Item 45 stands and is not reversed. `operator.overview.calm.text` truncates to
  „Keine Aufgabe braucht Aufmerksamkeit.“ and `operator.diag.empty` to „Keine offenen Störungen.“
  The extraction was right not to re-type a source string on its own authority; the truncation is
  now authorised, and both values appear in `REVIEW_COPY.md` §12 so the exact result is visible
  before it lands.
- **Consequence.** `OPERATOR_SCREENS.md` lines 462, 835, 1402 and 1575 are patched; the two value
  edits are listed under *Deferred to the surface build*.

**103. Item 27 versus `SCOUT_SCREENS.md` lines 1229 and 2014, which still say to keep the literal
„Budget bis 400 €“.** [decided]

- **Raised by** fix:scout.
- **Decision.** The applied reading is correct: item 27 makes the *number* dynamic, so
  `deadEnd.option.budget.title` is „Budget bis {budget} €“ and renders identically at the default.
  Item 27 does not authorise dropping the word „Budget“; a `deadBudget` string reading „Bis 400 €“
  would be a copy edit, and none is wanted.
- **Consequence.** `SCOUT_SCREENS.md` §13 is patched to the dynamic line at both positions.

**104. Item 44 mandates `hour12: false`, but `OPERATOR_SCREENS.md` §17.5 and `COMPONENT_MAP.md` §6.3
still print `{ hour: 'numeric', minute: '2-digit' }` and the example "Today, 9:41 AM".** [decided]

- **Raised by** fix:operator, `REVIEW_COPY.md` §9.
- **Decision.** Item 44 wins. Both option lists gain `hour12: false` and both examples lose the
  meridiem. `REVIEW_COPY.md` §9's second correction also stands: „Letzter Demo-Check“ is a column on
  the Quellen page (`OPERATOR_SCREENS.md` §6), not on Betrieb im Blick, so item 44's consequence line
  cites the wrong section.
- **Consequence.** Three document patches, listed below.

**105. `DECISIONS.md` item 28 keeps the „Foto folgt vom Anbieter“ placeholder while
`DATA_BINDING_PLAN.md` §4.7 says to hide the media cell.** [decided]

- **Raised by** `REVIEW_COPY.md` §4.
- **Decision.** Both, on different surfaces. The review card and the offer card use the placeholder
  (item 28), because the user has committed attention to one room and an empty cell reads as a
  broken image. Candidate list cards hide the media cell (§4.7), because a wall of placeholders
  implies photos are coming for every room.
- **Consequence.** `SCOUT_SCREENS.md` §11 keeps the placeholder, §14 hides the cell;
  `DATA_BINDING_PLAN.md` §4.7 is narrowed to the list surface.

**106. `autopilot.approval.toLabel` = „An: “ carries a load-bearing trailing space.** [decided]

- **Raised by** extract:scout, fix:scout.
- **Decision.** It stays verbatim for now, and the durable fix is scheduled: when the approval card
  is built, the gap moves into markup and the value becomes „An:“ in both locales. An invisible
  trailing space is not something every future translator will preserve.
- **Consequence.** The change must land before `en.ts` is authored, or English inherits the space.
  Listed under *Deferred to the surface build*; `SCOUT_STATE.md` §20.12 already has the spaceless
  value and needs no patch.

---

### Copy runtime and assembly

**107. Two assemblies of the German root now exist: `src/ui/copy/de.ts` and
`src/ui/copy/de/index.ts`.** [decided]

- **Raised by** runtime, fix:settings, fix:landing.
- **Decision.** Collapse onto `src/ui/copy/de/index.ts`. A `de.ts` file sitting beside a `de/`
  directory is a module-resolution hazard for a path (`./de`) that both satisfy, and the per-surface
  split already lives under `de/`. `de.ts`'s negative-guarantee types and its mutual-assignability
  assertion move into `de/index.ts`; `de.ts` is deleted. English mirrors the shape as
  `src/ui/copy/en/index.ts`.
- **Consequence.** `COMPONENT_MAP.md` §6.2's `src/ui/copy/de.ts` path is corrected to the directory
  form. Listed under *Deferred to the surface build*.

**108. Is `dev.ts` composed into the shipped dictionary?** [decided]

- **Raised by** fix:landing.
- **Decision.** No. The assembled root composes five bags — `common`, `scout`, `settings`,
  `operator`, `landing`. `dev.ts` is imported directly by the gallery route only and is excluded
  from the DE↔EN parity test, which is what items 20 and 56 already imply.
- **Consequence.** `COMPONENT_MAP.md` §6.2 states the five-bag composition explicitly.

**109. The demo/`v1` exclusion test cannot assert "no key path contains 'demo' or 'v1'" — 21
legitimate product leaves carry a `demo` segment.** [decided]

- **Raised by** runtime.
- **Decision.** The implemented reading is correct and is the contract: no path starts with
  `scout.demo.` or `landing.v1.`, plus `'demo' in de.scout === false` and `'v1' in de.landing ===
  false`. `settings.sources.demo.*`, `settings.knowledge.demo.*` and `landing.header.cta.demo` are
  product copy about demo data, which is a different thing from prototype-only copy.
- **Consequence.** `COMPONENT_MAP.md` §6.1 rule 2 is restated in those terms so the test and the
  rule read the same.

**110. `t` is typed to `StringCopyKey` and `tp` to `PluralCopyKey`, not both to `CopyKey` as the
§6.4 snippet has it.** [decided]

- **Raised by** runtime.
- **Decision.** The narrower typing stands. Rendering a plural object with `t` would print
  `[object Object]`, and pointing `tp` at a plain string is equally a bug; both are now compile
  errors. `CopyKey` stays exported as the union of all leaves.
- **Consequence.** `COMPONENT_MAP.md` §6.4's snippet is updated to the two-key-type signature.

**111. `COPY_VAR_NAMES` is derived from today's dictionaries and asserted in both directions, so
removing the last use of a placeholder breaks the suite.** [decided]

- **Raised by** runtime.
- **Decision.** Keep the bidirectional assertion. It is a deliberate canary: `{city}`, `{profile}`,
  `{usage}`, `{origin}` and `{price}` each have exactly one occurrence, and a copy edit that
  silently drops one is exactly what the test should catch. Re-deriving the list is a one-line
  change made knowingly.
- **Consequence.** No change; the canary is documented in `copy.test.ts`.

**112. The leaf count is 885 against `COMPONENT_MAP.md` §6.5's measured 871 source keys.**
[decided]

- **Raised by** runtime, fix:scout.
- **Decision.** Neither number is wrong; they count different things. A `{ one, other }` object is
  one leaf and two doc keys, and the documented hand-edits move the rest. §6.5 stops quoting a
  single total and instead carries both figures with the reconciliation: source keys, shipped
  leaves, and the per-surface delta (scout +13, settings −2, operator −1, landing 0, common +4).
  `en.ts` parity is sized from the shipped leaf count, never from 871.
- **Consequence.** `COMPONENT_MAP.md` §6.2 per-block counts and §6.5 are re-measured before either
  number is quoted again.

**113. `LocaleProvider` is not mounted anywhere.** [decided]

- **Raised by** runtime.
- **Decision.** Mounting it is app wiring, not copy-layer work, and it belongs to the first surface
  build that calls `useCopy()`. It wraps the router in `src/main.tsx`.
- **Consequence.** Listed under *Deferred to the surface build*; no screen may call `useCopy()`
  before it lands.

**114. `scout.discovery.inlineBrief.label` is a confirmed dead binding — keep or drop?** [decided]

- **Raised by** extract:scout, fix:scout.
- **Decision.** Keep it, annotated as dead. It is §18.6 source copy, and dropping it would make the
  block's key count disagree with the document for no gain. It costs one English translation.
- **Consequence.** `SCOUT_SCREENS.md` §18.6 marks it dead; wiring the inline brief stays a
  `BACKLOG.md` item rather than a reason to delete the key.

**115. Is Operator translated at all — does `en/operator.ts` have to exist?** [decided]

- **Raised by** extract:operator.
- **Decision.** Yes, unchanged from item 19. Operator is translated, `en.ts` covers all five
  namespaces, and the parity test covers all of them. Operator English is still the last batch.
- **Consequence.** The DE tree is already shaped for it; no change.

---

### Deferred to the surface build

These are the changes this section authorises but does not make. Each names the exact key paths, so
the Scout, Settings, Operator and foundation builders can pick them up without re-reading the
reasoning above.

1. **`operator.tasks.t2.detail` → `{ default, expired }`** (items 73, 84). Rename
   `operator.tasks.t2.detail` to `operator.tasks.t2.detail.default`, add
   `operator.tasks.t2.detail.expired` with the `REVIEW_COPY.md` §9 value. One edit, both halves.
2. **`settings.knowledge.log.entry.imported` → `{ one, other }`** (item 82). `one` from
   `REVIEW_COPY.md` §12, `other` is today's value. Placeholder stays `{n}`.
3. **`scout.data.log.knowledgeImported` → `{ one, other }`** (item 82). Same change, placeholder
   stays `{count}`. Lands in the same commit as item 2 above, never alone.
4. **`scout.complete.subline`** (item 86) takes the `REVIEW_COPY.md` §5 value.
5. **`scout.review.accept.disclaimer` and `scout.review.question.answer`** (item 85) take the
   `REVIEW_COPY.md` §12 values.
6. **`operator.overview.calm.text` and `operator.diag.empty`** (item 102) truncate to their first
   sentence, per `REVIEW_COPY.md` §12.
7. **`scout.autopilot.approval.toLabel`** (item 106) becomes „An:“ and the gap moves into markup.
   Must land before `en.ts` is authored.
8. **Collapse `src/ui/copy/de.ts` into `src/ui/copy/de/index.ts`** (item 107) and delete `de.ts`,
   carrying over its negative-guarantee types.
9. **`formatTime` resolves the `en` tag to `en-GB`** (item 101), and `copy.test.ts` tightens its
   expectation to `9:41`.
10. **Mount `LocaleProvider`** around the router in `src/main.tsx` (item 113).
11. **`LanguageToggle.tsx` moves its hard-coded label map onto `common.language.shortDe|shortEn`**
    and gains the `toggleAria` group label, once `REVIEW_COPY.md` §7 is accepted (item 80).
12. **`settings.privacy.portals.sub`** reverts to a plain string, and the plural-leaf list in
    `copy.test.ts` shrinks, if `REVIEW_COPY.md` §10 is rejected (item 83).

### Doc patches pending

1. `COMPONENT_MAP.md` §6.1 — record the third hand-edit (`hero.cta.secondary` → `.label`), the
   eleven Scout `.text` moves, the four Settings plural-fold renames, the duplicate-value
   confirmation from item 90, and the restated demo/`v1` rule from item 109.
2. `COMPONENT_MAP.md` §6.2 — the assembly path is `src/ui/copy/de/index.ts`, the composition is five
   bags, the `common` bag is closed at eleven keys, and the per-block counts are re-measured.
3. `COMPONENT_MAP.md` §6.3 — add `{time}` to the placeholder union, add the fifth plural case, add
   `hour12: false` and drop the "Today, 9:41 AM" example, and record the `{n}`/`{count}` and
   `{budget}` shape splits as intentional.
4. `COMPONENT_MAP.md` §6.4 — the `t` / `tp` signatures take `StringCopyKey` and `PluralCopyKey`.
5. `COMPONENT_MAP.md` §6.5 — carry source keys and shipped leaves as two figures with the
   per-surface delta, instead of one 871 total.
6. `OPERATOR_SCREENS.md` §17.5 — `hour12: false` in the option list, and „Letzter Demo-Check“ is a
   §6 Quellen column, not §5.
7. `OPERATOR_SCREENS.md` §5, §10 and §17 — lines 462, 835, 1402 and 1575 truncate to the first
   sentence per item 45.
8. `OPERATOR_SCREENS.md` §17.4 — `tasks.t2.detail` takes the `{ default, expired }` shape.
9. `OPERATOR_SCREENS.md` §17.12 — mark `host.now.format` / `.prefix` dead-but-catalogued.
10. `SCOUT_SCREENS.md` §12 line 1197 — the item 30 subline.
11. `SCOUT_SCREENS.md` §13 lines 1229 and 2014 — the dynamic dead-end budget line.
12. `SCOUT_SCREENS.md` §18 — the eleven `.text` paths, and §18.6's dead `inlineBrief.label`.
13. `SCOUT_STATE.md` §20.6 line 1650 — `{budgetNum}` → `{budget}`.
14. `SCOUT_STATE.md` §20.11 — annotate the `brief.sheet.count.one` numeral as §18.9's, deliberately.
15. `SCOUT_STATE.md` §5.3 and §20.13 — replace the nine `summary()` fragments with the per-case
    templates.
16. `SETTINGS_SCREENS.md` §17.6 and §17.9 — the two plural objects.
17. `LANDING_SCREENS.md` §3 and §17.1 — the header language toggle and the two navigation-sheet
    keys, once `REVIEW_COPY.md` §7 and §8 are accepted.
