# GPT-Live Review Guide

Status: release `415f27d` deployed to production on 2026-09-16. The isolated
development evidence below remains historical; the real voice review belongs
to the user. The controlled portal round trip remains open because the existing
test account reports a failed portal registration. The integrated Live-only code `b19d12b` passed 1,260
tests (one skipped), generated API typechecking and the production build. Global
lint has zero errors and 29 existing UI warnings. Detailed evidence is in
[GPT_LIVE_IMPLEMENTATION_STATUS.md](GPT_LIVE_IMPLEMENTATION_STATUS.md).

## Current integration review

| Layer | Review target |
|---|---|
| Source | Main checkout `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout`, branch `autopilot-policy`; merge checkpoint `d37a465` before Live-only cleanup |
| Production | `https://fleet-jackal-83.eu-west-1.convex.site/app/scout`, release `415f27d` |
| Real voice review | Performed later by the user; not part of migration execution |
| Known working CLI runtime | Bundled Node `v24.19.0`, Convex CLI `1.45.0` |

The final automated checks passed on the integrated Live-only code. To repeat them deliberately, use the main checkout. They verify source integration; they do not prove a deployment, a real
microphone path or the ten consecutive demo runs.

```bash
export PATH="/Users/danielfinke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd /Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout
node --version
npm test
npm run typecheck
npm run build
npm run lint
```

Do not copy `.env.local` between worktrees. Deployment configuration remains
specific to its target. The production move and deployment sequence is recorded
in [GPT_LIVE_PRODUCTION_MOVE_PLAN.md](GPT_LIVE_PRODUCTION_MOVE_PLAN.md).

## Historical isolated evidence environment

The real API and synthetic-audio evidence was collected before production
integration from branch `codex/gpt-live-migration`, frontend
`http://localhost:5174`, and isolated Convex development deployment
`descriptive-kookabura-886` (`dev/gpt-live-migration-20260915`, `eu-west-1`).
The starting code commit was `3184f73`. A local Convex deployment could establish
the direct Live handshake but could not issue the AI Gateway service token used
by the Scout, so full Brain proofs used that isolated cloud development target.

These details establish provenance only. Do not push code or configuration to
that target merely to repeat the migration. The production handoff is complete
only with one GPT-Live path and no selectable Realtime fallback. A
network/provider failure ends the call and offers a manual restart from current
saved state.

For user testing, open the production URL and reload old tabs. Local Vite uses
its checkout-specific development deployment; the personal development backend
was not silently replaced or rebound by this production release.

## Post-migration manual English demo

The user performs this section after migration; it is not a migration gate or
an instruction for an agent to run audio. Use a fresh reviewer profile with no
stored language choice to verify that English is the default. If the profile
was used for the German-switch check, select English explicitly before repeating
the default-language review.

### 1. Long brief and visible saved facts

Start **Talk to Scout** and say this naturally, without waiting between every sentence:

> Hi, we're a four-piece post-punk band in Berlin. We need a room in Kreuzberg or Neukölln, up to 300 euros a month. Tuesday evenings work. We bring our own PA and want to leave our drum kit and amps there. We're open to sharing. Please save those requirements.

Check while speaking and when the turn settles:

- The voice card and controls remain visible. A connected call uses the compact card (at most `220px`) with a short scrollable caption area. The large orb remains before connection.
- The right-hand **Your room search** box stays visible and scrolls independently when the fact list grows.
- A row animates only after that exact fact exists in the canonical saved search. An unfinished transcript fragment does not appear as a saved fact.
- Early partial saves do not make the Scout declare the whole utterance complete. The final explicit save request still reaches the Scout Brain.
- A returning call greets the musician without repeating onboarding. The Scout does not recap the right-hand list, re-ask whether sharing is acceptable, turn storage into a security questionnaire, or ask for optional fields merely because they are empty.
- Own drums, amps, and PA remain user equipment or storage requirements. They do not become claims that a room supplies backline.

### 2. Narrow correction

Say:

> Correction: make that 280 euros and Wednesday evenings.

Check that `300`/Tuesday are replaced by `280`/Wednesday. The old values must not reappear after the final delegation. A short acknowledgement of the corrected values is acceptable; a full brief recap is not.

### 3. Explicit German switch and persistence

Say:

> Bitte sprich jetzt Deutsch.

Continue with:

> Welches Budget und welchen Probentag hast du gespeichert?

The voice answer and live UI should switch to German and answer from the saved `280 Euro`/Wednesday state without translating or rewriting unrelated free-text facts. End the call, reload, and start another call: the explicit German choice should persist. Say **“Please switch back to English”** to finish the English journey and verify the second explicit switch.

### 4. Voice beside editing, search, and offer review

Keep the call active while opening inline budget/schedule editing, candidate details, and a prepared controlled offer. The same voice session and controls should remain mounted and usable on desktop and mobile; long facts, chat history, and detail content should scroll without covering their composers or buttons.

With the prepared offer still open, say:

> Start the search now using my saved requirements.

Then say:

> Pause the search.

Check the canonical search status after each completed Scout result. Opening the offer or editing the brief must not disconnect voice. Neither an early fact capture nor a partial transcript may start or pause the search.

Finally say:

> Accept this offer for us.

Voice may explain or open the current review, but it must not accept. Verify that the binding step remains in the UI and presents the current room/provider, terms, and final action. Do not submit the final binding action as part of this review.

### 5. Important update at a suitable pause

Use an already-prepared, verified provider-update record in the chosen review environment. While the musician is speaking, make that record current for the open candidate/decision.

- The verified update should appear in the UI immediately.
- Voice should wait for a suitable pause before mentioning an important update.
- If the selected candidate, decision version, answer state, or UI focus changes before speech, the relay must re-check it and discard stale wording.
- Routine progress and quiet early-fact context should remain silent.

This fixture-based review does not prove that an external provider reply travelled through the complete production ingestion path.
If no prepared record is available, mark this case as not run. Do not create an external provider send merely to manufacture the update.

## Evidence boundaries

| Evidence class | What it supports | What it does not support |
|---|---|---|
| Deterministic automated tests | Queue ordering, fragment bounds, deduplication, claims, state guards, locale/copy behavior, UI mounting and control behavior | Microphone capture, audible speech, natural pause timing, human conversation quality |
| Synthetic audio through the real GPT-Live API | Real WebRTC handshake, captions, protocol acknowledgements, Live output, cloud Scout/Gateway execution, and canonical fact writes in the isolated deployment | Human microphone acoustics, headphones, room noise, natural interruption, warmth, timing, or dry humour |
| Recorded native-delegation spike | A 36.84-second uninterrupted synthetic English brief produced 95 input-transcript deltas; the first native client delegation arrived about 1.0 second after audio ended | Any API guarantee of mid-speech native delegation |
| Human listening review still required | Real microphone/headphones, background noise, echo, barge-in, conversational warmth, music awareness, restrained humour, and whether important updates arrive at a natural pause | Automated pass/fail evidence |
| External-provider journey still required | Provider reply ingestion, evaluation, current UI update, pause-aware voice mention, offer review, and the final binding UI boundary as one connected journey | This guide makes no claim that such an end-to-end provider run has passed |

No provider message or binding acceptance is required to complete the checks above. Keep synthetic/API evidence, human listening judgement, and the external-provider end-to-end result as separate review outcomes.
