# GPT-Live Review Guide

Status: isolated development review on 2026-09-15. This guide is a reproducible review path, not a production release claim. The evolving evidence record remains in [GPT_LIVE_IMPLEMENTATION_STATUS.md](GPT_LIVE_IMPLEMENTATION_STATUS.md).

## Review environment

| Layer | Review target |
|---|---|
| Source | Branch `codex/gpt-live-migration` in `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout-gpt-live` |
| Frontend | `http://localhost:5174` |
| Convex branch | `dev/gpt-live-migration-20260915` |
| Convex cloud development deployment | `descriptive-kookaburra-886` in `eu-west-1` |
| Known working CLI runtime | Bundled Node `v24.19.0`, Convex CLI `1.45.0` |

The frontend on port `5174` uses the isolated cloud development deployment for the real Scout Brain. A local Convex deployment can establish the direct Live handshake, but it cannot issue the AI Gateway service token used by the Scout. Do not count a localhost frontend as proof that the Brain ran locally.

The original checkout at `/Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout`, its branch, the existing personal development deployment, and production are outside this review. They were not switched to GPT-Live. Do not copy deployment configuration between those checkouts.

## Reproduce the isolated app

The following command syntax was checked against the installed Vite `8.2.2` and Convex CLI `1.45.0` help before this guide was written.

```bash
export PATH="/Users/danielfinke/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"
cd /Users/danielfinke/Documents/STARTUPS/ROOMSCOUT/roomscout-gpt-live
node --version
npx convex dev --help
npm run dev -- --help
```

`node --version` should print `v24.19.0`. This is the runtime used by the successful cloud-development watch and pushes. A different host Node version may also print CLI help, but that alone does not prove it can run the same deployment workflow.

Run the checks from the isolated worktree:

```bash
npm test
npm run typecheck
npm run build
```

Start the already-configured cloud-development watch in one terminal. Confirm that its startup output names `descriptive-kookaburra-886`; stop if it names another deployment. This command writes code only to the configured development deployment.

```bash
npx convex dev --typecheck enable --tail-logs disable
```

Start the frontend in a second terminal:

```bash
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

Open `http://localhost:5174`. Use the existing isolated reviewer account and local configuration. Do not paste passwords, API keys, session IDs, raw transcripts, or environment-file contents into commands, screenshots, logs, or this repository.

## Provider selection and manual fallback

`VOICE_PROVIDER` is a server-side choice for a newly connected call:

```bash
npx convex env set --deployment descriptive-kookaburra-886 VOICE_PROVIDER live
```

To exercise the existing fallback deliberately:

```bash
npx convex env set --deployment descriptive-kookaburra-886 VOICE_PROVIDER realtime
```

After either change, end the current call and start a new one. An active call keeps the provider selected when it connected. There is no automatic provider switch, reconnect, retry chain, or replay. A network/provider failure ends the old call and offers a manual restart from current saved state. Never add `--prod` to these review commands.

## Manual English demo

Use a fresh isolated reviewer profile with no stored language choice to verify that English is the default. If the profile was used for the German-switch check, select English explicitly before repeating the default-language review.

### 1. Long brief and visible saved facts

Start **Talk to Scout** and say this naturally, without waiting between every sentence:

> Hi, we're a four-piece post-punk band in Berlin. We need a room in Kreuzberg or Neukölln, up to 300 euros a month. Tuesday evenings work. We bring our own PA and want to leave our drum kit and amps there. We're open to sharing. Please save those requirements.

Check while speaking and when the turn settles:

- The voice card and controls remain visible. In a companion or offer view, the compact card stays at or below `220px`, with a short scrollable caption area.
- The right-hand **Your search** box stays visible and scrolls independently when the fact list grows.
- A row animates only after that exact fact exists in the canonical saved search. An unfinished transcript fragment does not appear as a saved fact.
- Early partial saves do not make the Scout declare the whole utterance complete. The final explicit save request still reaches the Scout Brain.
- The Scout does not recap the right-hand list, re-ask whether sharing is acceptable, turn storage into a security questionnaire, or ask for optional fields merely because they are empty.
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

Keep the call active while opening inline budget/schedule editing, candidate details, and the prepared isolated offer. The same voice session and controls should remain mounted and usable on desktop and mobile; long facts, chat history, and detail content should scroll without covering their composers or buttons.

With the prepared offer still open, say:

> Start the search now using my saved requirements.

Then say:

> Pause the search.

Check the canonical search status after each completed Scout result. Opening the offer or editing the brief must not disconnect voice. Neither an early fact capture nor a partial transcript may start or pause the search.

Finally say:

> Accept this offer for us.

Voice may explain or open the current review, but it must not accept. Verify that the binding step remains in the UI and presents the current room/provider, terms, and final action. Do not submit the final binding action as part of this review.

### 5. Important update at a suitable pause

Use an already-prepared, verified provider-update record in the isolated development data. While the musician is speaking, make that record current for the open candidate/decision.

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
