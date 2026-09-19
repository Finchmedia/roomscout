# Demo and Submission Readiness

Status: preparation artifact, updated 2026-09-17. One controlled BER01 provider
round trip is now proven; final recording, microphone acceptance, binding human
acceptance, and submission have not been completed.

Implemented extension, 2026-09-17: [portal AI providers and 24 fictional Berlin
rooms](DEMO_PROVIDER_ENGINE_PLAN.md). The portal and its separate backend are
live; 24 listings were seeded idempotently and all 24 were processed by the
main Firecrawl path as distinct AI-simulated signals. A fresh account completed
the normal path through BER01 inquiry, real AI reply, portal notification and
main-app assessment. Evalite integration remains deferred. All 24 Berlin provider
mappings are enabled; the recorded end-to-end proof covers BER01.

## Official requirements summary

Submissions close September 22 at 12:00 PM PT (2026-09-22 21:00 in Berlin).
RoomScout must provide a public GitHub repository with `hackathon.md` at its
root, an invite-free `convex.site` or `chatgpt.site` app, and a video under three
minutes, then submit the repository, live URL, and video through the official
Vibe Apps link. The project must use Convex and partner integrations for real
product work. A public X or LinkedIn post must tag Convex, OpenAI, Firecrawl,
and AgentMail; social engagement is part of judging. Judges prioritize a useful
everyday app, Convex depth, real sponsor work, an accessible live URL, social
proof, and a product-led demo. Source: [official Convex All Gas Hackathon page](https://www.convex.dev/hackathons/all-gas).
Submission: [official Vibe Apps form](https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit).

## Submission story

RoomScout turns a band's spoken rehearsal-room needs into a durable search,
matches those needs against reviewed public signals, and coordinates
non-binding outreach while leaving any booking, payment, contract, or acceptance
with the musician.

Keep the submission focused on the implemented controlled demo:

- English is the default UI and conversation language; one explicit switch to
  German demonstrates persisted language coordination.
- Voice and text Scout are the musician interface. Explore and Map are removed
  from navigation and their old URLs redirect to the Scout; individual room
  evidence and operator tools remain available.
- The controlled demo catalog contains 24 fictional Berlin rooms on
  `roomscout.dev`. These are interactive demo data, not a claim of real Berlin
  market coverage. The public-research map currently shows zero real pins.
- General Translation is a bounded EN/DE dictionary-workflow experiment. It
  does not add another supported language, another market, or new source and
  portal capabilities.

## Evidence boundary

### Verified in the repository or recorded deployment checks

- The verified production build has been deployed. The app, direct Scout route,
  landing page, login page, and health route returned HTTP 200 after the current
  release; the served bundle pointed to the Fleet production backend.
- The text and GPT-Live paths share the saved search and Scout tools. English is
  the default and an explicit German switch is persisted.
- The current code supports spoken fact capture, correction, radius collection,
  voice-triggered search, candidate inspection, and a human-reviewed acceptance
  step.
- The controlled portal separates public listings from authenticated messaging,
  and binding commitments remain exact-approval actions.
- A fresh production account completed normal auth, profile and saved-need setup,
  Firecrawl portal registration, the BER01 initial inquiry, a real AI provider
  reply, portal notification and main-app assessment. The reply was not injected
  directly into RoomScout.
- The latest recorded full main-app Vitest run is 1,323 passing cases and one
  skip. The portal suite passed 57 tests, and the coordinate reconciliation
  passed 10 focused tests. A separate General Translation proof passed once and
  its local CLI dry run succeeded; hosted translation is still pending credentials. The subsequent
  Scout-entry change passed 19 targeted cases and seven desktop/mobile browser
  checks covering navigation, sign-in redirects and room evidence. Those
  browser checks use simulated transport and do not prove deployed provider
  compatibility.

### Must be verified by the maintainer before recording or submission

- A production microphone run and spoken update through the exact recording
  browser and audio setup.
- A complete human binding-acceptance step and receipt after the proven
  non-binding BER01 provider round trip.
- Ten consecutive successful runs of the shortened demo reset to a known state.
- English copy throughout the recorded path and the final EN-to-DE switch,
  including portal and provider-response text.
- Participant eligibility and ownership/IP assertions, which only the entrant
  can confirm even though the official requirements are now linked above.

The BER01 production round trip is direct evidence for that controlled path.
Automated tests and public browser checks still do not prove microphone quality,
human binding acceptance, repeatability, or the other 23 provider mappings.

## Recommended short English demo

Target 2:45 to 2:55, leaving five seconds of upload/editing margin under the
official three-minute limit. The existing 3:00–3:30 creative script in
`docs/DEMO_VIDEO_SCRIPT.md` needs compression, while its demolition cold open,
voice correction, controlled portal, human commitment, and language-switch
premise can remain. Prefer one continuous product take; use a clearly labelled
time cut only while waiting for the controlled provider reply.

1. **Problem and voice brief (0:00–0:35).** “We are a four-piece band in
   Berlin. Wednesday evenings, up to 300 euros a month, and the drum kit must
   stay.” Show the brief filling in, then say, “Wait, make that 400 euros a
   month,” and give a 15 km radius. Confirm the visible budget is €400 before
   starting the search; the controlled listing costs €350.
2. **Start the search (0:35–0:48).** Ask the Scout to search. Show the saved
   brief and candidate state changing from real application state.
3. **Explain the controlled system (0:48–1:30).** While work runs, show the
   source/run view and label `roomscout.dev` as a controlled portal that avoids
   contacting real musicians. Explain Convex state and orchestration, Firecrawl
   browser work, AgentMail verification/replies, OpenAI voice and reasoning,
   and the release check in plain language.
4. **Provider reply and decision (1:30–2:08).** Show the real imported reply and
   the Scout's grounded update. Answer one non-binding scheduling or term
   question.
5. **Human commitment (2:08–2:35).** Open the offer review and perform the final
   acceptance manually. State: “The Scout handled the search and conversation;
   I make the commitment.”
6. **Language close (2:35–2:50).** Explicitly ask the Scout to switch to German
   and show the UI and conversation switch. Keep General Translation as an
   optional, separately labelled EN/DE experiment rather than part of the core
   success path.

The BER01 inquiry and reply loop is proven. Record a fresh run and show its
visible receipt before describing it as the take used in the submission. Do not
describe microphone behavior or binding acceptance as proven until those
separate checks pass.

## Juror repeatability runbook

### Before sharing access

- Use a dedicated demo account and controlled portal records. Remove or reset
  stale decisions, failed runs, and prior conversation state through existing
  product controls; do not expose credentials, tokens, cookies, private inbox
  contents, contact details, raw transcripts, or internal provider payloads.
- Confirm the production URL and repository link, the English default, the
  controlled-source badge, and a healthy provider-readiness summary that reveals
  no environment values.
- Confirm the demo listing is within budget, has the intended schedule and
  equipment evidence, and produces one predictable non-binding question.
- Keep unrelated third-party sources and monitors paused. The demo must never
  send to an outside musician or room owner.

### Juror path

1. Open the live app and sign in with the prepared demo account.
2. Open Scout, start or reset the controlled Berlin search, and enter the
   short English brief above by voice or text.
3. Confirm the correction persisted as a €400 monthly budget and the radius is
   15 km before starting the search. A €300 budget excludes the €350 controlled
   listing from the happy path.
4. Open the resulting controlled candidate and inspect its progress. The active
   search may already have started the initial inquiry automatically; any
   manual start or retry is performed only from the candidate panel. Do not
   forward a general Scout-chat message as provider text.
5. Follow the visible run state; wait for the controlled reply or use the
   documented reset if the run reaches a truthful failure state.
6. Answer the non-binding question, review the offer, and make the final
   acceptance manually.
7. Switch explicitly to German to show persisted EN/DE behavior.

Record the exact reset procedure and expected duration only after the maintainer
has completed the production rehearsal. Do not put shared passwords or recovery
codes in this repository or the submission text.

## Sponsor contributions to show honestly

| Sponsor | Demonstrable contribution | Do not overclaim |
|---|---|---|
| Convex | Canonical search, signal, conversation and approval state; reactive UI; Agent, Auth, Workpool, HTTP actions, scheduling, and static hosting | Automated tests alone do not prove external services |
| Firecrawl | Reviewed public extraction and the controlled portal browser workflow | Do not imply broad web coverage or unrestricted portal automation |
| AgentMail | Per-user mailbox, verification-code intake, delivery/reply events, and unified conversation input in the proven BER01 path | Do not generalize one controlled path to every provider |
| OpenAI | `gpt-5.6-terra` and `gpt-5.6-luna` through Convex AI Gateway, semantic embeddings, and `gpt-live-1` voice | Do not describe scripted portal behavior as an AI provider |
| Mapbox | Server-side cached geocoding and map coordinates | Current geocoding and source coverage are Germany-scoped |

Browserbase is an alternative portal engine in the codebase, not part of the
current Firecrawl demo path or sponsor headline.

## Separate General Translation experiment

General Translation is not a gate for the core video or provider demo. One
focused proof passes and the local CLI dry run succeeds. The hosted translation
run remains pending credentials, so do not claim hosted translation or place it
on the critical recording path. If credentials become available, evaluate only
the existing English/German dictionary workflow and report the result
separately; this experiment adds no language or geographic coverage.

## Submission description draft

RoomScout is a voice-first assistant for bands searching for rehearsal space.
A musician describes the location, budget, schedule, equipment, and sharing
needs in natural conversation; RoomScout saves a structured brief, matches it
against reviewed public signals, and coordinates non-binding questions through
a controlled portal. Convex holds the reactive product state and orchestration,
OpenAI powers the text and live voice Scout, Firecrawl performs reviewed web and
portal work, and AgentMail receives verification and replies. The Scout can
prepare and carry routine communication under the user's rules, but any booking,
payment, contract, or acceptance stays with the musician. The current submission demonstrates a controlled fictional Berlin flow in
English with an explicit German switch; it does not claim broad real-world
source or portal coverage.

## Go/no-go checklist

### Product demo

- [ ] Current production account starts cleanly in English.
- [ ] Real microphone and captions work with the recording setup.
- [ ] The €300 to €400 correction and 15 km radius persist before search start.
- [ ] Controlled candidate appears and opens from the Scout.
- [x] One non-binding BER01 provider round trip succeeded through normal
      registration, messaging, notification and assessment without a direct
      database shortcut.
- [ ] Provider reply appears and is spoken only after a pause.
- [ ] Binding acceptance requires the musician's explicit action.
- [ ] Explicit German switch persists and does not lose the active context.
- [ ] Ten consecutive shortened rehearsals pass.

### Submission package

- [x] Official requirements verified against the Convex event page: deadline,
      public repository, root `hackathon.md`, accessible hosted app, sub-three-
      minute video, social post tags, and Vibe Apps submission path.
- [ ] Public GitHub repository is accessible while signed out.
- [x] Root `hackathon.md` exists locally.
- [ ] Live `convex.site` app is accessible while signed out or through a clearly
      usable public demo path without an invitation.
- [ ] Final title, one-sentence description, longer description, repository URL,
      live URL, and team information prepared.
- [ ] Video duration and public visibility meet the official requirements.
- [ ] Public X or LinkedIn post published, tagging Convex, OpenAI, Firecrawl,
      and AgentMail.
- [ ] Repository, live URL, and video submitted through the official Vibe Apps
      [form](https://vibeapps.dev/judging/convex-all-gas-hackathon-openai/submit)
      before 2026-09-22 21:00 Berlin.
- [ ] Sponsor descriptions match the observed take and this evidence boundary.
- [ ] Controlled demo data is labelled; no private data or secrets appear.
- [ ] README, hackathon log, build log, video, and submission make the same claims.
- [ ] Final links work in a signed-out browser.

## Current blockers and choices

1. **Blocker:** production microphone acceptance and human binding acceptance
   remain maintainer-owned live checks. **Choice:** the video may show the proven
   BER01 non-binding round trip, but must not claim those remaining steps.
2. **Blocker:** repeatability has not reached ten consecutive runs. **Choice:**
   shorten the core take and remove any optional beat that increases failure
   risk.
3. **Choice:** use the fictional Berlin catalog as controlled demo content.
   Keep real-market coverage at the observed zero-pin state and make no Berlin
   supply claim.
4. **Choice:** treat General Translation as an optional EN/DE experiment after
   copy fixes, separate from the core video gate. Its focused proof and local
   dry run pass, while hosted translation remains blocked on credentials. It
   cannot stand in for product locale, voice, geocoding, currency, source, or
   portal support.
5. **Blocker:** the video, social post, and Vibe Apps submission do not yet
   exist. **Choice:** prepare them only from the observed final take and keep
   every URL public and signed-out-accessible.
