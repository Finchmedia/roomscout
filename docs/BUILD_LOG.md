# RoomScout — Build Log

## 2026-09-19 — Browser Workpool cutover (trimmed)

Approved controlled-portal writes now enter the existing `browserWorkpool`
(concurrency 1) through one admission helper, `enqueueApprovedPortalWrite`,
instead of being scheduled beside the inbox reads. The pool no longer retries
by default: inbox reads opt in with `retry: true`, writes pass `retry: false`
so a browser write is never replayed automatically, and the write completion
hook only logs a failed or canceled pool result because that result does not
prove the message was not sent. `dispatchApproved`, `redispatchApproved`
(now carrying `busyAttempt`) and the exact acceptance path all use the helper;
the worker busy chains re-enter the pool through `redispatchApproved` rather
than scheduling the worker directly. Verified by the new
`portalWriteQueue.integration.test.ts`, which reads the pool component's
`work` table and asserts nothing for the worker lands in `_scheduled_functions`.

The production incident left a request stuck in `executing` with its
connection write-locked for eight minutes after the Firecrawl worker threw
between the transactional claim and the first provider call; the reaper then
marked it unknown. `executeWriteForOwner` now wraps that pre-provider region
and hands a stranded fresh claim to `releaseUnstartedClaim`, which closes the
execution under a rewritten idempotency key, returns the request to `approved`
with its gate intact, clears the connection lock and writes an
`action.execution_released` audit event; it refuses once a provider id or a
write proof generation is attached. The release reason stays on
`request.error` (`EXECUTION_RELEASED_BEFORE_PROVIDER:<code>`) so a parked
approved request is distinguishable from a fresh one, and the next fresh claim
clears it; the claimed audit key now carries the execution id because a
released request is re-claimed under the same content version. Only
`BROWSER_CONTEXT_BUSY` is rescheduled, and only when that release succeeded;
any other pre-provider code parks the request as approved with its reason
until it is re-dispatched. The exact production error code was not
recoverable from the logs. Verified by the release, refusal, re-claim and
non-busy (`PORTAL_REAUTH_REQUIRED`) cases in the new integration test and the
updated `firecrawlWriteWorker.test.ts`.

Writes no longer wait on a merely queued inbox lease: `browserSessionBusy` and
`claimWriteSession` drop the `inboxSyncActiveGeneration` condition because that
lease is taken at enqueue time, a running read stays visible through its
`browserRuns` row and `context.activeRunId`, and the pool serializes both. The
gate's browser-busy wait dropped from two minutes to thirty seconds. The
existing `autonomyGate` claim-time test that made the browser busy with an
inbox lease now uses a running `browserRuns` row. The new test file runs on
fake timers like its neighbours, because convex-test executes pool items
through a real `setTimeout` and a leaked worker from an earlier case otherwise
hits the shared provider spy. Verified with `npx convex codegen`, a clean
`npx tsc -p convex/tsconfig.json --noEmit --pretty false`, and `npx vitest run`
on the ten touched files (`firecrawlWriteWorker.test.ts`,
`externalActions.integration.test.ts`, `autonomyGate.integration.test.ts`,
`decisions.integration.test.ts`, `messageSafety.integration.test.ts`,
`conversations.integration.test.ts`, `offerAcceptance.integration.test.ts`,
`portalInboxSync.integration.test.ts`, `lib/autonomyGate.test.ts`,
`portalWriteQueue.integration.test.ts`): 4, 11, 14, 22, 19, 12, 34, 11, 55 and
11 tests passed respectively, 193 in total (182 on the nine baseline files that
had 181 before, plus the new file, which passed 11/11 on three consecutive
whole-file runs).

## 2026-09-18 — Voice layout and provider follow-up corrections

Centered the primary voice stage, enlarged its scrollable transcript and bounded
question cards to 720 px. Widened candidate cards and added an EN/DE above-budget
visibility switch; existing conversations and decisions remain visible. Removed
per-listing simulation badges while retaining the central portal disclosure and
real-listing contact restrictions. Known assistant delivery cues such as
`[chuckle]` are omitted from captions and newly persisted voice transcripts.

Production metadata identified two provider responses rejected before commit:
one invalid price and one locale mismatch. The portal provider prompt now uses a
natural provider role, exact locale and permitted prices; those validation
failures receive bounded Workpool retries. Historical failed jobs were not
replayed; the existing participant retry action remains available.

Fixed Scout progress and background context to distinguish latest outbound
questions from inbound replies, scope details to the selected room and stop
showing a stale provider-replied stage. Decision questions/options now follow
the saved conversation locale. Answering an accidentally wrong-language prompt
does not authorize a language switch.

A subsequent multi-room retest exposed a separate text-chat gap: the no-argument
candidate inspector omitted persisted provider conversations, and typed chat
inherited the single focused-room context. It now reads all bounded candidate
conversations for the current search and requires a fresh inspection for status
questions. A read-only production call returned both tested conversations as
awaiting a new reply. Provider assessment also receives the last eight sent
inquiries as context separate from provider evidence, preventing repeated
questions and speaker confusion.

Installed the official AI Elements Shimmer from the shadcn registry, including
its Motion dependency. Text and voice now share one pending indicator in the
conversation; active tool text replaces the thinking label. Voice initialization
uses the same narrow transparent layout, the persistent discovery title is
removed, and the blob wrapper no longer clips its glow. Scoped UI tests and
TypeScript passed; microphone testing remains with the maintainer.

Voice connection and active-call surfaces, text chat, candidate conversations,
room details and question cards share the existing 720 px width token. Candidate
threads keep their own tall scroll area. Scout updates use short, collapsible
headings with wrapped details and hide internal next-action names. Answered
Scout questions and their answers appear together as private Q&A; a persisted
decision ID suppresses only the matching duplicate answer bubble.

Candidate selection now opens the same photo-and-facts room card for indexed
rooms and existing provider conversations. An explicit “Open conversation”
action opens the thread, with a return action to the room card. Over-budget
rooms retain the global budget action. Reading the room card alone does not
mark provider messages read or send an inquiry.

A multi-room retest exposed a schedule assessment whose satisfied verdict
contradicted its own explanation. Explicit requested weekdays now require
compatible weekday evidence before a satisfied result is accepted; changed
prompt versions invalidate older assessment caches on recomputation. Initial
listing-only declines or stops dismiss the candidate without staging contact.
A separate staging check requires a real delivered exchange before a decline,
and a recorded executed decline makes subsequent acknowledgments terminal.
Automatic initial no-fit expires the opportunity rather than permanently
dismissing it: a later eligible search/listing revision can reopen the untouched
conversation. Same-revision retries and conversations with action or delivery
history remain closed.

Message-review questions now use the saved EN/DE locale. Existing code-owned
questions are localized without rewriting model-authored questions or confusing
unclear content with a binding commitment. Newly generated review details show
the exact subject and body separately; legacy text preserves paragraph breaks.
Safety review now receives the saved musical and typed search facts used by the
initial inquiry and distinguishes requested topics from claims of availability.
Unsupported assertions still require review. Focused regression tests passed;
no model was switched, historical message was resent, or failed job replayed.

A read-only check of the warning identified a candidate-specific concession in
global memory conflicting with the active search. Provider-decision answers now
stay in their own conversation and cannot run the global-memory absorption step,
including previously queued jobs. Safety review treats the active search as the
authority for current requirements and limits concessions to their own provider
conversation. Existing historical memory was not deleted.

Aligned candidate-thread contact hints with the actual message state. A staged
first inquiry no longer appears beside a generic never-contacted message; the
known delivery channel is visible before its remote thread is attached without
enabling replies prematurely. Uncertain submit outcomes are exposed explicitly
instead of appearing to send indefinitely. Targeted backend and UI checks,
TypeScript and the production build passed. Published backend and frontend and
verified the served bundle against the local build. Historical messages were not
retried.

Portal inbox reads now retain a completed batch under a unique key in the
short-lived browser sandbox. If Interact returns an intermediate scalar, one
read-only lookup can retrieve that completed batch without repeating the browser
workflow; an absent or invalid result remains a failure. A read-only live probe
successfully traversed multiple threads. Write preflight now expires stale
browser runs, and the worker retries only contention detected before execution
claim. Unknown submission outcomes and post-claim errors are not retried.
Focused regressions and backend typechecking passed; backend deployed. The
read-only live probe passed, while a post-deployment scheduled sync is still
unobserved.

Initial provider inquiries now focus on practical fit. Unconfirmed minor
contract details can be deferred to a viewing decision without marking them
confirmed or relaxing binding-offer checks. All 24 Berlin scenarios have private
start, minimum-term, notice and viewing knowledge; the existing Stuttgart listing
now has an idempotently bound provider scenario too (25 enabled providers).

Both backends and the main static frontend were deployed. Scoped UI/backend
tests, typechecking and the production build passed. The final served frontend
bundle matches the checked build byte for byte. An earlier live browser check
confirmed candidate rendering and the budget filter; browser timeouts prevented
a second visual check of the final thread layout. No new microphone test or
provider inquiry was initiated. Earlier conversation history was preserved.

Provider clarification now collects independent choices as a persisted question
round. The UI shows one question at a time, with progress, options and free text;
each step is saved, but the provider conversation resumes only after the round
is complete. Question IDs prevent a delayed answer from answering the next
question, and changed offer/search revisions invalidate stale choices.

Formulation receives the full per-constraint assessment instead of only a short
summary. Every known conflicting non-budget constraint must be represented.
Answers retain their question and room scope; accepting a schedule alternative
does not waive equipment restrictions. Explicit keep-requirement options remain
blockers even when another question for that same requirement was accepted.
Free-text interpretation remains model-based. Existing budget approval rules
and the original global search remain unchanged.

Text and voice tools share this path; voice reports an incomplete round as open
and needs a fresh claim for the next answer. The thread groups completed Q&A
pairs privately. The question form remounts between steps so reused option IDs
do not retain old selections. Targeted behavioral tests, frontend and backend
TypeScript checks, scoped lint and production build passed. Backend and frontend
are deployed, and the served frontend bundle matches the local build. Live
microphone acceptance remains untested; historical provider jobs were not
replayed.

Switched bounded early voice fact capture, decision-question formulation,
source/index/detail extraction, memory compression/import and simulated portal
providers to `openai/gpt-5.6-luna` through the Convex AI Gateway. Core Scout
conversation, full voice delegation, provider assessment, matching and outgoing
message safety retain Terra. Model selection is per call on the existing Agent;
it does not create another agent or change the shared context.

Both production backends are deployed. Verification was deliberately limited:
four focused local tests passed (model routing, question persistence, extraction,
provider reply persistence), plus two real Luna calls with synthetic inputs.
The live checks preserved a budget correction from 250 to 400 and returned
separate schedule/drum questions. No full test suite, microphone test, provider
inquiry or historical-job replay was run. The fixed internal smoke action is
`convex/aiModelSmoke.ts`; it performs no database writes.

Candidate navigation now separates rooms still in play, above-budget rooms and
rooms that no longer fit, with group counts and reason-specific badges. Current
structured assessment data controls exclusion, separately from message delivery
progress. Confirmed unavailability and terminal incompatibility override an old
reply label; pending musician alternatives remain active. Search/listing revision
checks avoid treating outdated assessments as current decisions. The scoped
query includes closed conversations, preserving their room details and history.
The detail card also suppresses a stale positive-fit heading for excluded rooms.

Four targeted functional tests passed, covering unavailable/current/stale states,
private search access, grouping, closed history and the existing budget toggle.
Frontend/backend typechecking, scoped lint and build passed. Both backend and
frontend are deployed; a read-only authenticated production query verified the
reported unavailable candidate's new disposition, and the served frontend bundle
matches the local build. No new model call or provider message was needed.

The [browser Workpool audit and plan](BROWSER_WORKPOOL_PLAN.md) distinguishes
existing queued inbox reads from separately scheduled writes and direct manual
refreshes. It proposes common admission per connection, explicit read/write
retry policies, persisted WorkIds and reactive business status. The installed
0.4.11 client uses `status(ctx, id)` and `state`, with no `statusTtl` option;
completed work alone does not establish successful delivery. This is a
documentation-only proposal, not a runtime change or deployment. No tests or
provider actions were run for the audit.

## 2026-09-17 — Self-service demo providers and Berlin catalog

Deployed the [portal provider engine](DEMO_PROVIDER_ENGINE_PLAN.md) using the
Convex Agent Component with an isolated thread per portal conversation. Seeded
24 fictional Berlin listings idempotently and processed all 24 public detail
pages through Firecrawl. A fresh account completed registration, an initial
provider inquiry, a real AI reply, notification and RoomScout assessment.
All 24 Berlin provider mappings are now enabled; the live round-trip proof
covers BER01. English and German model responses were checked separately.

Added the agreed musician onboarding and confirmed provider-facing identity.
The orange Mapbox landing map is deployed, with no fabricated real-market pins.
The listing seed now uses actual Berlin street names without house numbers and
normal room descriptions; repeated demo disclaimers and visible coordinate
pairs are removed. The portal discloses the simulation centrally.

Published 25 distinct OpenAI-generated room photos (24 Berlin and the existing
Stuttgart room), optimized to 1200×800 WebP at about 2.32 MB total. Literal
public images and Open Graph metadata make the assets crawlable. Firecrawl's
normal source refresh populated all 25 production signals with distinct image
URLs; candidate previews, detail panels and provider offers consume that field.
Both applications are deployed. Follow-up checks were scoped to the changed
portal, image-ingestion and candidate UI paths, without another full-suite run.

Earlier verification: main suite 1,323 passed with one skip; portal 57;
coordinate checks 10. The subsequent portal listing update passed 19 focused
checks and typecheck. Microphone acceptance, human binding acceptance and final
recording/submission remain with the maintainer. Evalite remains deferred.

## 2026-09-16 — Landing actions follow the signed-in session

The public landing route previously supplied fixed sign-in and registration
links despite the app-wide auth provider. It now reads the existing Convex
session: authenticated visitors see the localized Scout link in the desktop
header/mobile menu and closing CTA. Guests retain sign-in and registration.
While session restoration is pending, the header does not flash a sign-in
action and the closing link uses the neutral Scout destination. The synthetic
demo links remain distinct from the real application entry.

Verification: 17 targeted landing/routing tests and seven public desktop/mobile
browser checks passed, with one mobile-only skip on desktop. Tests exercise
loading → authenticated → guest and the signed-in mobile menu using an auth
state stub; public browser checks use simulated transport. TypeScript,
production build, scoped lint and diff checks passed. No account was created or
signed into for verification.

Published the checked build to Fleet; the landing URL returned 200 and its
served application bundle matches the checked local build byte for byte.

## 2026-09-16 — Scout as the musician entry point

Removed Explore and Map from public and musician navigation, including mobile
menus, the landing-page secondary action and the sign-in browsing escape.
Old `/explore`, `/map`, `/app/explore` and `/app/map` links redirect to the
authenticated Scout, preserving Scout as the destination through sign-in.
Individual room evidence pages remain readable and link back to the Scout.
The index, matching, geocoding and operator tools are unchanged.

Removed the retired page exports from the application entry graph; the build
no longer emits the browser globe or Mapbox chunks. Voice and text share the
existing Scout flow. Historical implementation files remain outside production
routing rather than deleting the backend capabilities they once presented.

Verification: 19 targeted route/navigation/auth tests and seven isolated
desktop/mobile browser checks passed; the mobile-only case is skipped on
desktop. The retired-route tests failed before the redirects were added.
TypeScript, production build, scoped lint and diff checks passed. Browser
checks exercise real UI with simulated Convex transport; no user signup,
microphone session or provider inquiry was initiated.

Published to the existing Fleet deployment. Landing, the old Map URL, Scout
and health return 200; the served SPA script is byte-identical to the verified
production build. Client redirects are covered by the routing/browser checks.

## 2026-09-16 — Consistent EN/DE settings and a bounded GT experiment

Connected the live knowledge, account, privacy and import surfaces, plus the
musician navigation and account menu, to the existing English/German copy
catalogs. Derived search labels and dates follow the active locale; stored
facts and original imported content keep their original text. Fixed the import
review counters so selected facts, total facts and entity counts stay distinct.
Settings route tests now render the real locale provider instead of a
translation-key stub. Removed the unused old import-prompt module.

Added `npm run test:gt`: the pinned General Translation CLI discovers a small
public-copy JSON sample in a dry run, followed by placeholder/plural validation
and a test through RoomScout's actual dictionary provider. EN → DE → EN retains
the mounted conversation draft. This proves the local exchange and UI boundary,
not hosted translation quality. The optional `--translate` mode requires locally
configured GT credentials and tests fresh API output without substituting our
existing German dictionary. No GT browser runtime, new language, market,
subscription or account was added; no private content was sent to GT.

Prepared the [demo/submission checklist](DEMO_SUBMISSION_READINESS.md) against
the official event requirements, including a shorter English video outline and
a repeatable controlled-portal path. Berlin and the Bay Area remain future
validation cases. Video recording, public posting and final submission remain
outstanding; the GT experiment is separate from the core demo.

Verification: 1,273 Vitest cases passed with one skipped, plus the separate GT
UI proof and CLI dry run. Typecheck, production build, scoped lint and diff
checks passed. The earlier five public Playwright checks were not rerun for
this copy change. Real microphone and provider acceptance remain with the user.
See [GT scope and reproduction](GT_COMPATIBILITY.md).

Published the checked build and backend to Fleet. Read-only post-deploy checks
returned 200 for landing, Settings, Scout and health. The served application
script is byte-identical to the checked production build, targets Fleet and
contains neither sandbox deployment URL. No real voice call or provider inquiry
was initiated during this change.

## 2026-09-16 — Candidate recovery, budget review and Scout presentation

The production listing was already indexed and became a candidate after the
budget increase. Its first provider assessment failed because the generated
evidence combined noncontiguous source excerpts; later attempts did not record
a valid assessment. No first inquiry had been staged. This identifies the
failed transition, but does not establish that the GPT-Live migration caused it.

Kept strict evidence validation and added one bounded, structured repair
attempt. Exhausted semantic failures now end with a truthful failure status
instead of repeating the same turn. An eligible failed initial assessment can
be retried from its candidate panel. Current need revisions re-evaluate known
listings and can recover an eligible uncontacted opportunity; existing threads,
action records and deduplication guards prevent duplicate initial inquiries.

Otherwise plausible monthly listings over budget are retained with a visible
overage and an action to edit the global search budget. They cannot trigger
contact while over budget. Saving a higher budget re-evaluates the same
candidate. The text and voice Scout can inspect indexed rooms and open a
candidate panel; manual inquiry/retry starts only there, without forwarding
general Scout-chat text. Existing automatic search orchestration remains.

Conversation labels now distinguish assessment failure, first-message
preparation, actual dispatch and actual inbound replies. Public listing cards
expose stored capacity/equipment facts. Candidate and requirement rails are
centered; the voice surface is narrower and transparent around the existing
blob and bubbles. Navbars include the existing logo, and the login header no
longer exposes Explore/Map. English/German Live prompts allow more room for
hesitations, with a slightly longer quiet interval for background announcements;
Marin is unchanged. This is prompt/relay tuning, not a new API VAD setting.

Verification: 1,267 Vitest cases passed, one skipped; five public Playwright
checks passed, with the mobile-only case skipped on desktop. Backend TypeScript,
production build and scoped lint passed; full lint has zero errors and 29
existing warnings. Desktop/mobile Scout states were visually checked with
synthetic data and the real UI components. The final presentation adjustment
also passed 40 targeted tests. The Fleet backend and 23-file static frontend
were deployed together from this working tree. Real microphone acceptance and
the provider round trip remain with the user; no live retry or inquiry was
triggered during verification. Existing failed candidates need an explicit
panel retry or an eligible subsequent search revision to resume.

Post-deploy read-only checks: health, landing, login and direct Scout routes
return 200; the removed Realtime endpoint returns 404. The served script matches
the verified production build and contains the Fleet backend URL, without
either sandbox deployment URL.

## 2026-09-16 — Test cleanup and deterministic public browser checks

Applied the test-quality review using Matt Pocock's TDD criteria: preserve
observable behavior and remove checks tied to obsolete components or incidental
implementation details. Deleted the two unimported ScoutConversation/ScoutFactList
component bundles; moved Firecrawl test helpers out of the empty test file;
removed historical dictionary-shape and duplicate landing assertions. Legacy
profile tests now use the actual profile route. Voice UI checks retain captions,
controls and session continuity while dropping exact CSS/pixel expectations;
prompt-construction tests retain phase, locale, consent and evidence boundaries.
Active application behavior and production prompts were not changed.

The old public browser test first failed on its obsolete landing heading. The
replacement uses the real app with fixed Convex transport responses and checks
landing-to-explorer navigation, location changes and empty results, supply
filtering, newest-first sorting, provenance details and mobile navigation.
Playwright builds into a separate ignored cache directory with synthetic
deployment URLs; external HTTP is blocked, all WebSockets are simulated, and
unexpected queries or writes fail. These tests do not prove a deployed Convex
backend or real provider compatibility.

Verification: 1,240 Vitest cases passed in 152 files, with the existing provider
proof skipped; five Playwright runs passed and the mobile-only navigation case
was skipped on desktop. Project TypeScript, explicit browser-test TypeScript and
production build passed. Lint has zero errors and 29 pre-existing warnings.
No deployment, real audio call or live provider action was performed. Broader
Voice-to-backend composition and additional public authorization coverage remain
recommendations in the [review](reviews/test-quality-review-2026-09-16.md).

## 2026-09-16 — GPT-Live deployed to the existing production app

Release `415f27d` now runs on the existing Fleet production deployment and is
on both remotely secured branches. The six untracked main-checkout collisions
were backed up before fast-forward. Static Hosting published 23 files after
the backend accepted the additive schema and transcript index. A first
noninteractive deploy stopped at the CLI confirmation before modifying the
backend; the retry used the same checked build with `--skip-build` and an
explicitly confirmed production target.

Post-deploy checks: Health and direct Scout/Settings routes return 200;
Realtime POST returns 404; Live preflight returns 204 for the exact production
origin and 403 for an unrelated origin. The served application script points
to Fleet, without sandbox URLs. The operator action reports 5/5 providers
configured. An existing authenticated account retained its search and chat;
the new English text reply read the correct saved location and radius. Chat
closure and budget-editor controls worked. The existing test account's portal
connection reports failed registration, so the new controlled portal round trip
has not passed. No inquiry was sent to an uncontrolled provider and no data was
reset. User-owned voice tests and the ten full demo runs remain open. Old env
settings are retained for checkpoint M until user acceptance; the Live-only
code does not consult them.

## 2026-09-16 — Live-only production integration prepared

Secured both branches and the annotated `prod-pre-gpt-live` tag remotely before
merging the latest production demo documents. Merge `d37a465` is the additive,
schema-compatible recovery checkpoint. Subsequent commits share typed Live
contracts, update operator readiness, and remove Realtime transport, routes,
provider selection and isolated seed fixtures. Session lifecycle functions and
historical optional schema fields remain compatible. Canonical transcript
lookups tolerate duplicate markers; frontend endpoint selection derives the
production Site URL from its Cloud URL before considering an explicit override.

The integrated code `b19d12b` passed 1,260 tests in 155 files, with one skipped
file/test, codegen, TypeScript and production build. Global lint has no errors
and 29 pre-existing UI directive warnings. Production Live model, Marin and the
exact production origin are configured; existing provider credentials were
checked by presence without exposing values. Old environment values remain for
the manual recovery checkpoint until user acceptance. Deployment and the
non-voice production checks are the next step. No data reset, import, or real
voice/audio test was performed. See [move plan](GPT_LIVE_PRODUCTION_MOVE_PLAN.md).

## 2026-09-16 — Reliable hangup and proactive ready-brief handoff

After the improved human voice test, two bounded follow-ups were completed. A
validated end-call result for the current session now begins closure despite
later speech; queued capture work cannot delay it, and the existing farewell
fallback is capped at five seconds. Unsent typed input remains recoverable.
Quiet discovery capture can reuse the claim-fenced readiness tool after saving
a useful, unambiguous draft. The reactive relay offers a search start once the
current saved revision is ready, at a conversation pause, and clears stale
offers. Starting still requires explicit user intent. Marin and the approved
tone remain unchanged. Evidence: [voice adapter](../convex/voiceLive.ts),
[browser Live runtime](../src/hooks/useGptLiveVoiceScout.ts),
[reactive Scout surface](../src/routes/musician/ScoutPage.tsx), and
[Live prompt](../convex/prompts/roomScoutLive.ts).

Targeted backend, prompt, hook and page tests passed, along with TypeScript,
scoped ESLint, frontend build and diff check. Before these two follow-ups, the
maintainer reported improved discovery, successful search activation and a later
successful hangup, and considered that baseline ready for the demo. The earlier
intermittent hangup and missing proactive next step motivated these final fixes.
No new browser/audio run was part of their verification; they await the user's
next microphone test. The earlier human result is qualitative product evidence,
not an additional automated test count.

## 2026-09-16 — Human discovery regressions corrected for retest

A human test exposed late first-fact admission, pauses after short answers,
incomplete voice-to-text history, an incorrect returning-user greeting and a
conversation view that could not be closed. The isolated branch now records
actual Live user and assistant speech in the existing Agent thread independently
of tool turns, admits short contextual answers at conversation boundaries,
binds quiet results to their delegation and explicitly triggers the opening.
Blank drafts receive a first-call introduction. End-call and text-close controls
return to the normal Scout surface. Marin is restored and the explicit
Australian persona direction is removed. Evidence: [voice adapter](../convex/voiceLive.ts),
[browser Live runtime](../src/hooks/useGptLiveVoiceScout.ts),
[Scout surface](../src/routes/musician/ScoutPage.tsx),
[Live prompt](../convex/prompts/roomScoutLive.ts), and
[personality prompt](../convex/prompts/roomScoutPersonality.ts).

The isolated backend was updated. Verification: 37 focused backend/prompt/chat
tests and 86 frontend runtime/hook/page tests passed, along with the integrated
TypeScript check and diff check. At this checkpoint, the user had chosen to run
the next live microphone test themselves, so this correction did not yet claim
a new passing live-audio result. The later entry above records the subsequent
human result.

## 2026-09-16 — Live-led discovery, Ripple and quiet persistence

Option B now lets GPT-Live choose independent discovery questions while the existing Terra Scout stores search facts and durable musician memory. A shared English/German persona provides a practical, attentive musician-facing tone with occasional dry humour. New Live calls use Ripple. Canonical saved values feed both session bootstrap and quiet updates; authoritative phase instructions stop discovery when the conversation moves to search, pause or a candidate.

The same existing Terra turn returns a structured silent/spoken delivery result. Routine saves remain quiet; explicit answers and action outcomes remain spoken. Internal result JSON never becomes chat prose. An empty successful Agent completion keeps silent turns from leaving the later text view busy. Start/pause speech uses the committed tool result, and request-owned language changes preserve their answer without a configuration echo invalidating it. A valid call-ending farewell no longer requires a separate summary.

Real synthetic-audio checks reached GPT-Live and the Scout/Gateway. The first radius question began 7.74 seconds before the full backend result in one run. Short radius and schedule answers, a budget correction and durable memory persisted. Pause remained usable during the call, and a subsequent pause request correctly reported the already-paused state. The final DE-to-EN and EN-to-DE questions both produced actual commentary appends and spoken factual answers; the equipment answer did not invent provider confirmation. A spoken farewell then produced session.closed. The test search remained paused, with no new external-provider completion claimed.

Validation: 1,257 tests passed with one skip, plus typecheck, scoped ESLint and production build. Repeated questions about already covered discovery details still appeared in some real samples; the prompt was tightened, but a human microphone review of tone and repetition remains open. Implementation and remaining limits are recorded in GPT_LIVE_DISCOVERY_PLAN.md and GPT_LIVE_IMPLEMENTATION_STATUS.md. Work remains on the isolated migration branch and development deployment.

## 2026-09-16 — Voice call closure and inactivity handling

The Live Scout now has a voice-only `endVoiceCall` tool for an explicit hangup request or a genuine farewell. The tool returns a localized close directive through the existing delegation result; completed search edits and action receipts remain independent of closing audio. Quoted, negated and hypothetical farewells are rejected, and stale results cannot end the current conversation. Ending voice does not pause an active search or cancel provider work.

The browser checks for presence after two minutes without user activity and allows another thirty seconds for a response. Speech, active delegated work and meaningful UI input participate in the timer. The closing path gives the farewell time to play, requests the documented Live session close, releases microphone and transport resources, records the ended session through the existing authenticated mutation, and leaves voice mode for the normal Scout surface.

Verification: 49 backend and 41 frontend focused tests passed, along with typecheck, scoped lint and the production build. A synthetic-audio run through real GPT-Live and the real Scout/Gateway requested hangup, received the spoken farewell and terminal `session.closed`, and returned to the ready search view. A second real session asked whether the musician was still present after approximately 120 seconds, announced its departure thirty seconds later, and finalized after the farewell at approximately 155 seconds. The search remained a draft throughout; a separate backend regression verifies that ending a call leaves an already active search unchanged. Idle cancellation on new activity, stale/failed close directives and playback-aware cleanup are covered by focused regressions.

That single explicit-hangup run also exposed coarse latency: 1.362 seconds from synthetic speech ending to native delegation, 5.584 seconds from delegation to the application's result append, and 0.834 seconds from append to the first farewell transcript fragment. These event timings are illustrative rather than a benchmark; transcript timestamps do not establish exact audible playback timing. There is still no complete per-stage latency trace for context retrieval, embeddings, Gateway generation and tools. Ordinary conversation behavior, model routing and reasoning settings remain unchanged apart from call-ending instructions.

## 2026-09-16 — Voice follow-up: activation readiness and one conversation surface

A human voice review exposed a draft that was labelled ready even though its normalized location had no search radius. Scout readiness, activation and the UI now share the same location/radius check. Old readiness stamps no longer make incomplete drafts appear ready; the Scout receives the missing field and a focused English or German clarification. Supplying a radius remains a user choice rather than an invented default.

Voice uses the existing Scout blob and streaming captions as its primary conversation. The duplicate persisted chat is hidden in voice mode. An explicit switch to typing keeps the call and its controls available while showing only the text conversation; candidates, decisions and the saved-facts panel remain accessible.

Verification: the final combined five-file regression run passed 65 tests; the broader agent checks, typecheck, scoped lint and production build also passed. A fresh browser run through the real Scout and GPT-Live kept the radius unset, asked a focused radius question on a spoken start request, and displayed an explicit missing-radius explanation beside the disabled start control. Supplying five kilometres through the text composer while the call stayed connected made the draft ready and enabled the start control. Voice/text toggling showed one conversation at a time with call controls retained. The default voice layout was visually inspected. The initial pre-fix test had already saved an inferred radius; the tool guidance now explicitly rejects inferred/default radii, and the final fresh run verified the stored missing value before attempting start. Test searches were left draft or paused; no external-provider completion is claimed by this UI and readiness fix.

## 2026-09-15 — GPT-Live isolated review: real Brain, saved facts during speech, persistent conversation

Astra coordinated the implementation; GPT-5.6-Sol agents implemented the backend adapter, browser runtime and product/English workstreams in isolated branches. The integrated branch is `codex/gpt-live-migration`, frontend port `5174`, with its own expiring Convex development deployment. The original checkout and production remain unchanged.

Two real API runs now show saved facts appearing during a 36.84-second English description: the first rows arrived after 10.96 seconds, and after 9.16 seconds in a fresh follow-up run. Native delegation arrived around one second after speech ended, so the mid-speech effect is correctly attributed to the bounded application-owned capture path through the same Scout Brain. The fresh run preserved a 300→280 euro and Tuesday→Wednesday correction, kept own-gear storage distinct from supplied equipment, and avoided duplicate instrument roles and a stale budget repeated in free text.

In one continuous real Live session, explicit EN→DE→EN changed speech and UI, voice started the search, a synthetic incoming offer/question appeared during ongoing speech, a nonbinding question was answered, and voice paused the search with an offer panel open. The background relay stayed silent throughout 27.35 seconds of input and mentioned the offer after the turn settled. A spoken acceptance request was referred to UI review; read-only inspection found zero action requests, approvals, executions or acceptance receipts. Inline editing stayed connected.

The checks also found and fixed fragment loss, transcription joining, premature/stale summaries, incorrect optional tool defaults, candidate-focus mismatches, and overlapping chat/decision layout. Canonical facts remain authoritative. Raw captions stay local; no persistent voice outbox or general coordinator was added. Final verification and limitations are recorded in [GPT_LIVE_IMPLEMENTATION_STATUS.md](GPT_LIVE_IMPLEMENTATION_STATUS.md); a reproducible human demo is in [GPT_LIVE_REVIEW_GUIDE.md](GPT_LIVE_REVIEW_GUIDE.md). Human microphone/tone review and a connected external-provider journey remain separate acceptance steps.

## 2026-09-15 — GPT-Live integration: real transport proof, full product proof pending

GPT-Live is being integrated on an isolated branch and worktree while the original checkout remains untouched. The implemented architecture keeps audio and Live events in the browser over WebRTC, sends client delegations through a small authenticated adapter, and runs them through the existing Convex Scout and `openai/gpt-5.6-terra` on the Convex AI Gateway. Voice and ordinary text therefore share the same Scout brain, search state, tools and business rules. A serial input path coordinates voice and text work; the reactive saved-need query remains the authority for facts shown in the UI. English is the default UI and conversation language, with an explicit persisted German switch. The earlier Realtime provider remains an explicit fallback while migration acceptance is incomplete.

The integration uses the isolated cloud development deployment `descriptive-kookabura-886`; the local Convex backend cannot exercise the AI Gateway. An ordinary text Scout turn on that cloud deployment reached the real Gateway and returned a ready reply, confirming the existing Brain/Gateway path independently of Live. A real GPT-Live session also completed its WebRTC handshake and produced captions plus acknowledged client events. In one synthetic uninterrupted English speech run, 95 transcript deltas arrived over 36.84 seconds; the first native client delegation arrived about 1.0 second after the audio ended. This proves the transport and native delegation path, but does not prove that native delegation alone updates saved facts during speech.

The bounded application-owned early-fact path is now wired for reversible search facts only. It remains distinct from native delegation, runs through the same Scout and serial queue, and cannot start or pause a search, answer decisions, contact providers or perform a binding action. Validation of early saved-fact updates, a correction made while speech continues, language switching and the complete uncut Live journey is still running; none is recorded as passed here. Before the latest runtime work, the full repository suite passed 1,151 tests with one skip. That count is baseline evidence, not a substitute for rerunning the changed runtime and live-browser cases.

No provider message, offer acceptance or other external action was sent during these GPT-Live checks, and no production rollout is claimed. The fallback remains available, and provider selection is deliberate rather than an automatic retry chain. Detailed product criteria and the evolving proof checklist remain in `GPT_LIVE_MIGRATION_PLAN_2026-09-15.md` and `GPT_LIVE_IMPLEMENTATION_STATUS.md`; those documents must be updated from the final observed runs rather than from this interim narrative.

## 2026-09-10 — First completed controlled happy path checkpoint

The user verified the complete core flow against their landlord listing in the
controlled portal: a band described its need in chat; Scout found a candidate,
sent a browser-based inquiry, read the landlord replies, asked follow-up questions,
and produced a current, ready offer with the confirmed terms. The user then
observed the final acceptance message in the portal thread. This proves the
interactive demo communication path, not a payment, signed contract, or an
unattended repeatability benchmark. No raw conversation or account identifiers
are included in this public log.

The checkpoint includes signup inbox provisioning and controlled-portal bootstrap,
the simplified Stagehand v4 browser path, inbox scheduling improvements, removal
of obstructive application throttles, developer reset utilities, radius-based
matching, and match-assessment retry/recovery. The last UI fix prioritizes the
current provider assessment over stale listing uncertainties and completed
outreach actions. Ready offers show their terms; partial replies remain distinct
from ready offers; stale assessments and paused searches cannot claim success.

Verification at this checkpoint: 664 tests passed across 106 passing test files;
one opt-in test file/test was skipped. TypeScript, Vite build, and focused Scout
ESLint passed. The updated frontend was published to the development static host
at https://perceptive-antelope-445.eu-west-1.convex.site. The user also observed
the corrected offer panel on the local Vite app. This final UI checkpoint does
not claim a new production-backend deployment.

Parallel Claude Code UI/design ports are preserved as part of the current
baseline. No chat-UI rewrite is included in this checkpoint. Next discussion:
review the existing chat UI and the supplied design ports, including whether a
simpler shadcn implementation is worthwhile. A fresh run without repair actions
is still needed to establish repeatability; long-lived portal reauthentication
and broader monitoring reliability are not established by this one success.

Convex **"All Gas"** hackathon · Aug 25 – Sep 22, 2026 (submission deadline Sep 22, 12:00 PM PT)

- **Live URL:** https://fleet-jackal-83.eu-west-1.convex.site
- **Demo video:** _tbd (< 3 min)_
- **Social post:** _tbd (X / LinkedIn)_

---

## 2026-08-26 — Day 1: Idea & kickoff

**Why this app.** My main side project is [Jumper](KICKOFF_CONVERSATION.md), a booking platform for music studio spaces. Building it taught me the supply side of a scattered market. RoomScout is the aggregator take on the same structural problem, from the demand side: bands don't fail at *booking* rehearsal rooms — they fail at *finding* them. The market lives in classifieds, forum posts and hand-made studio websites, and every single inquiry is a hand-written email into the void. That's the "email marathon" every band knows.

**The initial shape.** A band enters its profile (city, nights per week, budget, gear needs). The app checks a shared public room directory first; on a miss or stale data it crawls the local market with Firecrawl, normalizes listings with OpenAI, and drafts studio outreach for the user to approve. Approved messages go through AgentMail; replies return to a per-search inbox, get parsed, and land in a live results board powered by Convex live queries.

**Key design decision: shared directory, not private searches.** Every search improves the public directory. The second band searching Stuttgart gets instant results from the cache instead of triggering a fresh crawl; a TTL + cron keeps entries fresh. This saves crawl credits, makes the app faster with every user, and turns it into a growing public good rather than a per-user gadget.

**Two-tier email design.** Base-data enrichment ("what do you charge, what's in the room?") happens **once per room** and lands in the shared directory. The **individual inquiry** ("Tuesday + Thursday evenings from October?") is per band, through that band's AgentMail inbox. Both remain drafts until a user approves them. Studios never get duplicate spam because two bands searched the same city.

**Honest reuse disclosure.** All app code is new (started Aug 26, per hackathon rules). The visual direction was explored in a separate Claude Design handoff. The implementation reuses one room-background photograph from my own design assets; the React components, responsive styles, routing, and RoomScout mark are new in this repository.

**Today's output:** repo + docs skeleton, architecture plan ([PLAN.md](PLAN.md)), kickoff conversation distilled ([KICKOFF_CONVERSATION.md](KICKOFF_CONVERSATION.md)).

**Next at kickoff:** choose the final frontend architecture, scaffold the app, and prove the first city workflow.

## 2026-08-26 — Product exploration: room discovery and network effects

Explored a possible extension to the room finder: opted-in bands with compatible
locations, schedules, budgets, equipment, or musical interests might share a
room or form a stronger demand signal for room owners. This could create network
effects, but it also introduces cold-start, consent, privacy, and scope costs.

No product shape was selected. The original room-discovery and aggregation idea
remains valuable on its own and gives Firecrawl the clearest role. A room-first
product, a broader superconnector, and a hybrid where matching helps unlock an
otherwise unsuitable room remain open hypotheses.

Two constraints did settle during the discussion: use React + Vite + TypeScript
with Convex Static Hosting rather than Next.js, and require explicit user approval
before every external message or introduction.

**Next:** continue comparing the room-first and hybrid journeys before locking an
MVP, schema, or implementation sequence.

## 2026-08-27 — Product exploration: from supply crawler to demand radar

The room-first idea was tested against a structural market constraint: desirable
rehearsal-room supply is often full, quiet, and allocated through personal
networks. A web crawler can organize visible supply but may miss the rooms that
matter most. Bands searching for rooms have a stronger incentive to publish, so
public demand signals may be more discoverable than current availability.

This led to a new, still-open hypothesis: RoomScout could seed an aggregate
demand map from public room-wanted posts, then let musicians claim and verify
their needs before any private matching or coordination. Observed demand,
verified demand, and approved action would remain separate states. Similar
searches could support market heatmaps, while actual room-sharing suggestions
would also require complementary schedules and other practical compatibility.

The discussion also identified an important boundary: scraped contact details do
not imply permission for bulk outreach. AgentMail remains relevant for opt-in
verification, approved introductions, approved inquiries, and reply handling.
No MVP decision was made. The full reasoning and open questions are captured in
[`PRODUCT_EXPLORATION.md`](PRODUCT_EXPLORATION.md).

## 2026-08-27 — Provisional implementation plan

The current exploration was translated into a gated implementation plan for a
continuously updated, two-sided market index. Firecrawl owns recurring public-web
discovery and monitoring; Convex owns the operational Source Registry,
idempotent webhook processing, canonical supply/demand state, freshness,
realtime search, and application-level maintenance. OpenAI normalizes and
deduplicates changed signals, while AgentMail remains behind explicit message
approval.

The plan deliberately begins with one pilot geography and a small reviewed
public source cohort. It requires the source-to-realtime-UI vertical slice to
work before adding maps, embeddings, authenticated source automation, or
band-to-band coordination. See
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for phases, exit gates,
candidate data boundaries, testing, and the definition of done.

## 2026-08-27 — Runnable scaffold and Claude Design port

Built the first runnable RoomScout application rather than extending the
planning layer. The frontend is now a responsive React/Vite/TypeScript SPA with
the Signal Ledger visual language, public landing/explorer/signal views, a
focused Scout onboarding and dashboard, an external-mail Inbox, and a thin Ops
cockpit. Synthetic records are visibly labelled as prototype data; all demo
actions remain deterministic and send nothing.

Convex Auth v2 Alpha now provides working Username/Password sign-up, sign-in,
session restore, sign-out, and server-side musician/operator gates. The local
compatibility spike proved Auth v2, the Agent component, and Static Hosting can
compile together. The Scout backend uses three explicit Case Card modes:
search discovery, signal advice, and outreach drafting.

The backend walking skeleton includes indexed public signal queries, owned saved
needs, versioned outreach drafts, and an exact approval snapshot. Approval
compares the client-visible version, hash, recipient, subject, and body before a
separate send command may claim it. Firecrawl change-tracking runs are bounded
by a Convex cron and feed idempotent ingestion plus OpenAI normalization.
AgentMail sending is internal-only, idempotent, and accepts replies through a
Svix-verified webhook before they appear in the private Inbox.

Validation completed locally: Convex codegen/function push, TypeScript, ESLint,
Vitest (7 tests), production build, desktop/mobile Playwright flows (5 passing,
1 intentionally skipped per project), and a live Auth v2 smoke test covering
sign-up, reload/session restore, role denial, and sign-out. Provider calls were
not executed because external credentials have not been configured, and no
production deployment was made.

## 2026-08-28 — Convex AI Gateway migration

Moved all implemented model calls to the Convex AI Gateway with
`openai/gpt-5.6-terra`: the durable Scout Agent, structured Firecrawl
normalization, and structured inbound-reply parsing now share one Gateway model
definition. The direct OpenAI SDK dependency and `OPENAI_API_KEY` /
`OPENAI_MODEL` deployment configuration were removed.

The migration was verified against the RoomScout cloud Development deployment.
A temporary fixed-prompt smoke action returned the expected response from
`openai/gpt-5.6-terra`; the public test action was then deleted and the cleaned
function set pushed again. This validates real model routing through Convex,
while the musician-facing Scout UI itself remains fixture-backed until the next
frontend/backend integration slice.

## 2026-08-28 — Persistent Room Scout and musician memory

Replaced the fixture Scout onboarding with the real Convex Agent thread and a
reactive `savedNeeds` search card. In a live German-language browser test, one
message created the Stuttgart search, updated six visible constraints, and
recorded separate durable facts about the fictional test band Glass Teeth, its
fictional member Marc, mobility, rehearsal
times, equipment, and compatible room-sharing bands. A later turn correctly
recalled the band's genres, equipment, and schedule without the user repeating
them. Search activation now persists in Convex.

Added an event-based entity/fact memory, fact supersession and deletion,
versioned three-part context compression, and a user-visible memory ledger.
Added the external-assistant import flow: copy a privacy-aware prompt to
ChatGPT/Claude, paste its export, analyze it with the Gateway, review every
candidate, and confirm only selected facts. The raw export is not stored. A live
test extracted and reviewed 12 facts across Daniel and the fictional Glass
Teeth persona, then rebuilt
the working context to version 6.

Generation remains on Convex AI Gateway with `openai/gpt-5.6-terra`. At this
checkpoint, the native AI SDK structured-output option returned a provider
error in the live Gateway path, so normalization, reply parsing, memory
compression, and imports temporarily used strict JSON instructions plus Zod
validation.

Implemented owner-filtered semantic fact retrieval with the regular OpenAI
embeddings endpoint using `text-embedding-3-small` at 512 dimensions. New facts
are indexed asynchronously and existing facts can be backfilled from Profile.
At this checkpoint, the Development deployment did not yet contain
`OPENAI_API_KEY`; the feature therefore degraded safely to deterministic facts
and compressed context.

Validation: cloud Development push, TypeScript, ESLint, 20 Vitest tests,
production build, five Playwright checks (one responsive-case skip), plus live
Auth, Agent, search activation, context import, context compression, memory
recall, and console-error-free browser checks. No production deployment or
external communication occurred.

## 2026-08-28 — Finding and fixing the Structured Outputs adapter gap

Turned the earlier provider error into a controlled debugging experiment. The
official `@convex-dev/ai-sdk-provider@0.1.0` failed with HTTP 400, and an
instrumented equivalent showed that AI SDK had downgraded `Output.object` to
`json_object` and dropped its JSON Schema. A raw request proved that the Convex
AI Gateway and `openai/gpt-5.6-terra` accepted `json_schema`. Recreating the
small adapter with the same Gateway URL and `getServiceToken("ai-gateway")`
authentication, but adding only `supportsStructuredOutputs: true`, produced a
native strict schema request and succeeded without warnings.

Promoted the tested workaround into a deliberately small local adapter and
migrated Firecrawl normalization, inbound-email parsing, memory compression,
and context import from prompt-shaped JSON to native AI SDK `Output.object`
with final Zod validation. A production-shaped smoke test also exposed a useful
strict-schema rule: optional object properties must instead be required and
nullable. RoomScout now converts those `null` values to omitted Convex fields
after validation.

The newly configured `OPENAI_API_KEY` was verified independently with a real
`text-embedding-3-small` call returning 512 dimensions. No credential was read,
returned, or logged. The temporary public probe was removed after verification.

## 2026-08-28 — YOLO vertical architecture: monitor, mail, voice, and map

Expanded the walking skeleton into the full RoomScout vertical architecture
without starting a broad crawl or sending real mail.

**Firecrawl Native Monitoring.** Replaced the earlier Convex-owned repeated
scrape schedule with Firecrawl Native Monitors. Convex now owns the Source
Registry, monitor mapping, authenticated/idempotent webhook receipt, processing
backlog, two-snapshot stale rule, and reconciliation watchdog. A changed index
page expands into individual source entries; only new or changed detail pages
are fetched. The pilot is capped at five new details per target and two
concurrent Firecrawl requests. Stuttgart, Berlin, and Hamburg targets are seeded
as paused `reviewing` sources, and monitor activation remains hard-gated behind
`FIRECRAWL_MONITORS_ENABLED=true`. No broad or live pilot run occurred in this
implementation pass.

**Canonical index and matching.** Added PII redaction before public evidence is
stored, a private contact-candidate boundary, deterministic deduplication,
signal/need embeddings, persistent supply and consent-aware demand matching,
notifications, migration helpers, and rate limits. External source text and
email are explicitly delimited as untrusted prompt data. Mapbox geocoding is
server-side and cached; exact, district, and city precision stay visible rather
than implying an address that the source did not publish.

**Personal AgentMail inboxes.** Replaced the global-from-address assumption with
one deterministic mailbox per user, provisioned lazily on first outreach.
Provisioning and provider webhooks are idempotent. The approval invariant remains
unchanged: recipient, subject, body, content version, and hash must still match
the persisted approval immediately before the internal send action. Received,
sent, delivered, bounced, rejected, and complained events update the private
thread and notifications. No mailbox was provisioned and no live message was
sent during this implementation pass.

**Realtime Voice Scout.** Added an authenticated, origin-restricted
`POST /api/realtime/session` endpoint that posts browser SDP and a session
definition to OpenAI `/v1/realtime/calls` as multipart text fields. The default
model is `gpt-realtime-2.1` with the `marin` voice. The WebRTC client reuses one
microphone stream for model audio and an orange RoomScout volume blob. Voice
uses the same Case Cards, search state, signal focus, outreach drafts, and memory
as text; it has no tool that can approve or send. Final transcript events can be
deduplicated into the existing Scout thread, while raw audio is never stored.
The Realtime path has not yet completed its controlled deployed-browser proof.

**Globe and map.** Adapted the globe physics, fog, boundary, rotation, and fly-to
behavior from the maintainer-owned Jumper studio map, removed its Next.js and
Jumper-specific dependencies, and restyled it for RoomScout. The landing globe
uses aggregate market areas, while `/map` is designed for precision-labelled
signal pins, filtering, clustering, and provenance cards. This is disclosed
reuse of maintainer-owned visual interaction work; private Jumper product data
or strategy was not copied.

**Scope boundary.** UI translation, authenticated third-party sources, login
automation, automatic replies, automatic introductions, and web-scale backfills
remain later work. The controlled live proofs still outstanding are one bounded
monitor run per pilot city, one user-controlled approved AgentMail round trip,
and a deployed voice/map smoke test.

## 2026-08-28 — Production deployment and full vertical wiring

Connected the previously separate tracks into the user-facing product. Public
Explore, Signal Detail, saved searches, persisted matches, Inbox, Approval
Composer, navigation badges, and the Ops cockpit now use reactive Convex data
with honest loading and empty states instead of production fixtures. Voice now
executes its allowed tools through authenticated Convex actions, returns tool
results to Realtime, refreshes its Case Card when focus changes, and
deduplicates finalized transcripts into the shared Scout thread.

The map now uses real market-area and signal queries, precision-labelled pins,
and low-zoom clustering. Firecrawl detail normalization preserves genres,
instruments, flexible facets, and private contact candidates; contacts never
enter public queries and reach only the server-side outreach context as
untrusted data. Operator actions keep review separate from activation, sync
native monitors, run one reviewed monitor, continue the bounded backlog, and
retry one failed entry.

Generated separate Production Auth v2 keys and deployed the backend plus SPA to
Convex Static Hosting. Production has the OpenAI key and an explicit Realtime
origin allowlist. Four pilot sources were seeded in Development and Production
as paused `reviewing` records; no monitor, crawl, mailbox, or email was
triggered. Validation passed with 43 unit tests, TypeScript, ESLint, production
build, five Playwright desktop/mobile flows (one expected skip), the live
Landing and Sign-up routes without console errors, and `/api/health`.

## 2026-08-31 — Source Intelligence, portal contexts, and scoped autopilot

Turned the question “how does RoomScout contact listings whose address is hidden
behind a form or portal?” into an explicit product layer. The Source Registry is
now complemented by Germany-wide discovery batches, canonical platform
candidates, geographic coverage, evidence facts, versioned flow policies,
code-first adapter bindings, checkpoints, and read-only probes. Firecrawl Search
runs only bounded operator slices and persists candidates for review; it does
not start a web-scale crawl. The Stuttgart, Berlin, and Hamburg pilot platforms
were linked to conservative inferred coverage in Development.

Added a safe public-form path with Firecrawl Interact. An exact, persisted action
payload is approved once or authorized by a valid standing mandate; Interact
fills the reviewed fields and returns an ephemeral Live View. It never submits
in the preparation step, so the user can inspect the destination, solve any
CAPTCHA themselves, and perform the final click. The action and execution ledgers
retain hashes and provider job IDs, but never Live View URLs or raw page data.

Added Browserbase as the authenticated-portal path. Each user/portal pair owns a
separate persistent Context; short-lived Sessions reuse its login state. Human
login and reauthentication happen in an on-demand Live View. Read-only recon and
bounded Inbox polling have domain/path allowlists, TTLs, global concurrency one,
rate limits, circuit breaking, and reviewed adapters. Cookies, passwords, DOM,
screenshots, recordings, and Live View URLs never enter Convex. CAPTCHA solving,
automatic credential entry, registration, and writes have no backend tool.

Added versioned Guided/Research/Outreach/Negotiation mandates, source preferences,
a unified email/platform Inbox, opportunity records, explicit handoffs, and an
external-action ledger with payload snapshots and idempotency keys. Standing
authorization is limited by platforms, action types, personal-data scopes, daily
contacts, browser minutes, optional price ceiling, expiry, source policy, and
connection state. Terms, contracts, bookings, payments, deposits, passwords,
2FA, and CAPTCHAs remain irreducibly human. AgentMail replies and persisted
matches now create traceable opportunities rather than disappearing into an
unstructured Inbox.

The browser and source-intelligence code was implemented without using a live
Browserbase or Firecrawl credential. A Browserbase credential pasted during
development was treated as compromised and was not stored or used. Provider
live proofs therefore remain blocked until rotated/configured credentials are
added to the Convex deployment.

Validation finished with 80 unit/integration tests, full TypeScript and ESLint,
the production bundle, and five Desktop/Mobile Playwright flows. Backend and SPA
were deployed together to `fleet-jackal-83.eu-west-1.convex.site`; the production
health endpoint, Landing, SPA fallback, and live Explore page returned 200 with
no browser console errors. Three canonical pilot platforms, four geo areas, and
five conservative coverage links were seeded in both Development and Production.

## 2026-08-31 — Approved execution, persistent portal UX, and bounded autopilot

Completed the external-action path that the earlier foundation intentionally
left disabled. Firecrawl Interact now has a code-owned Bandnet contact-form
workflow that may perform the exact approved submit when the current source
policy permits non-HITL execution. CAPTCHA, missing fields, ambiguous success,
or any other human boundary returns an ephemeral Live View; RoomScout stops the
provider job when the user records the outcome and never automatically retries
an uncertain post-click state.

Added the generic Browserbase approved-write executor. It mounts the user's
portal-specific persistent Context into a short-lived Session and applies only a
reviewed code-owned adapter. The current automated adapter coverage is fixtures,
not an invented production adapter for Kleinanzeigen or another authenticated
portal. Real authenticated writes therefore remain fail-closed until recon,
policy approval, and a tested adapter exist for that exact portal flow.

Added a safe source-probe queue and worker for read-only or prepare-only checks,
including domain/path/policy/binding/context validation, hashed evidence, health
updates, and idempotent retries. Probes cannot click, fill, submit, register,
authenticate, or solve CAPTCHAs. The musician UI now exposes an independent
connection state per portal, provisions/copies the personal AgentMail address,
and supports human registration/login, reconnect, pause, sync, and disable.
Portal verification messages are routed into the private Inbox, but RoomScout
does not automatically follow verification links or use OTPs.

Implemented the standing-mandate orchestrator as a bounded ten-minute Convex
cron plus a user-triggered run. It considers only new supply opportunities and
active Outreach/Negotiation mandates, creates at most one outbound contact per
owner/run, and rechecks the exact payload hash, owner, domain, current policy,
adapter binding, mailbox, mandate version/limits, complaints, and stop conditions
immediately before the provider write. Guided/Research modes, revoked or expired
mandates, unknown adapters, and human-only policies remain non-executable.

The final security pass found no `v.any()` in Convex functions and no committed
provider credentials. Sensitive public functions use authenticated owner or
operator checks; provider secrets remain action-side environment variables.
Validation passed with 126 tests across 28 files, Convex and application
TypeScript, ESLint, production build, and five Playwright flows (one expected
mobile skip). The integrated backend and SPA were redeployed to
`fleet-jackal-83.eu-west-1.convex.site`; Health, Landing, Explore, and Map return
HTTP 200. No live Firecrawl, AgentMail, or Browserbase write was performed: a
fresh Browserbase key and the remaining provider configuration are still
required for controlled proofs.

## 2026-08-31 — Provider preflight and evidence-backed negative capabilities

Added an operator-only Provider Readiness panel. It reports safe booleans and
reasons for Firecrawl, AgentMail, Browserbase, Mapbox, OpenAI Direct/Realtime,
and the browser Mapbox token without returning any environment value. Presence
is deliberately not labelled provider acceptance; the panel distinguishes
configuration readiness from a completed live proof.

Ran a read-only live contract check against the current Bandnet contact form.
The labels `Dein Name`, `Deine E-Mail-Adresse`, `Betreff`, and `Nachricht`, their
control IDs, the `E-Mail senden` submit label, and the `/kontaktieren` form action
match the reviewed Firecrawl workflow. The verifier filled and clicked nothing,
and is available as `npm run verify:bandnet-form` for future drift checks.

Recorded Kleinanzeigen as a negative capability rather than creating an unsafe
Browserbase adapter. Its current official terms require registration for
messages and prohibit automated crawlers/scrapers or other automated access
mechanisms without written consent. The idempotent migration stores the public
evidence URLs and restricted policies for discovery, listing, contact, reply,
and auth. Pilot-city source coverage shows it as unavailable and excluded rather
than silently pretending the source does not exist.

The expanded validation suite now passes 133 tests across 32 files plus
TypeScript. No provider credential was introduced and no external write was
performed.

## 2026-08-31 — Deployed Realtime proof and hardened webhook configuration

Completed the previously outstanding deployed Voice proof through the production
SPA. A dedicated test identity signed up through Convex Auth v2, opened the Scout,
granted a synthetic browser microphone stream, established the real OpenAI
Realtime WebRTC session, reached `Listening`, and closed cleanly at `Ended`.
There were no browser console or page errors. Raw audio was not persisted.

Generated independent strong Firecrawl webhook bearer secrets for Development
and Production, configured the correct deployment-specific webhook URLs, kept
Native Monitors explicitly disabled, and generated stable AgentMail mailbox
address salts. Unauthenticated production calls to the Firecrawl webhook and
Realtime endpoint return HTTP 401. AgentMail intentionally reports unavailable
until its actual API key and provider-issued Svix signing secret are configured.

## 2026-08-31 — Provider Components as the transport boundary

Replaced the direct Firecrawl SDK integration with a source-preserving local
fork of the official `@firecrawl/firecrawl-convex@0.1.1` component. The fork
keeps the upstream durable crawl schema, page storage, webhook and polling
lifecycle, signed callback handling, cancellation, resumption, and full client
surface. RoomScout adds the documented Native Monitoring and Interact APIs,
including zero transport retries for monitor mutations and mutating Interact
programs. The upstream commit, exact extension delta, MIT license, update
procedure, and ownership boundary are recorded beside the component source.

All RoomScout Firecrawl paths now use that single component: bounded source
discovery, read-only source probes, detail-page ingestion, Native Monitor
reconciliation/manual runs, and approval-gated contact-form Interact. The app
layer still owns operator authorization, source policy, exact approval hashes,
rate limits, audit events, private Live View handling, and fail-closed outcomes.
No broad crawl or mutating provider run was started during this migration.

Mounted the official `@agentmail/convex@0.1.0` component and removed the direct
AgentMail SDK. The component now provisions and looks up per-user inboxes,
queues outbound mail durably, exposes transport status, fetches full messages,
verifies signed webhooks, and dispatches provider events. RoomScout retains the
user/mailbox ownership model, exact recipient and content approval, rate limits,
thread projection, private Inbox, delivery notifications, and AI reply parsing.
The component outbound ID is persisted separately so a stuck RoomScout send
reconciles the existing component job rather than enqueueing another one.

The official AgentMail component currently does not pass RoomScout's former
provider idempotency header through its internal HTTP retry. App-level reuse of
one component outbound ID prevents duplicate enqueueing, but an exceptionally
narrow accepted-response-lost retry remains a provider-component limitation and
is documented rather than hidden.

Verification passed with Convex component discovery/codegen, 192 application
tests, 54 preserved/upstream and extension Firecrawl tests, full TypeScript,
ESLint, and the production Vite build. The production deployment installed the
AgentMail component, its two Workpools, the local Firecrawl component, the
backend functions, and 14 static files. Health, Landing, and Explore returned
HTTP 200. These checks prove the deployed component graph and application
contracts; they do not claim a live monitor run or AgentMail delivery round
trip.

## 2026-09-01 — Approve / YOLO boundary and real corroboration

Made the two authorization experiences explicit. Approve mode remains exact and
per-message. YOLO uses a persisted, versioned standing mandate only for
allowlisted, non-binding communication. A deterministic commitment boundary
now escalates obvious agreements, bookings, contracts, deposits and acceptance
language to exact approval across email, web forms and platform messages. The
same boundary is rechecked immediately before a provider claim. Expired action
requests cannot be claimed; a scheduled reaper fails abandoned pre-provider
claims and marks stale in-flight provider outcomes `unknown` so RoomScout never
retries a possibly completed external side effect. Kill-switch revocations now
have one audit event per mandate, while retries count once per action request
against the daily cap.

Implemented conservative cross-source corroboration instead of treating the
verification enum as decorative. Signals are linked only when side and city
match and their meaningful title tokens are highly similar. Independent sources
raise the source count and verification state; strong identity evidence with
incompatible district, arrangement or price becomes `conflicting`. Every source
keeps its own structured evidence snapshot and provenance. A stale source does
not hide a signal while another independent source is still fresh.

Also separated the official Firecrawl component's signed callback secret from
the Native Monitor bearer header, added fixed-work comparison for the monitor
credential, rate-limited context parsing and refresh, fixed late AgentMail
delivery events overwriting `replied`, exposed persisted web-form actions in the
unified Inbox, removed remaining fixture/dead integration adapters, and aligned
the judge-facing Component list with the actual mounted graph. This entry records
implemented and locally tested behavior only; it does not claim the still-open
live Firecrawl Monitor or AgentMail round-trip proofs.

## 2026-09-01 — Controlled portal and multi-provider onboarding loop

Built `roomscout-dev` as a separate Next.js 16, Clerk, and Convex application
instead of faking an authenticated third-party portal inside RoomScout. Its
public supply and demand listings are server-rendered for Firecrawl; posting,
native threads, and messages require a real Clerk identity. Public listing
projections exclude the owner subject and Convex creation metadata, while thread
queries enforce membership for both listing owners and participants.

Added a reviewed `roomscout-dev-v1` Browserbase adapter and operator-only setup
path in RoomScout. The Source Registry can idempotently create the controlled
platform, public and authenticated sources, monitor target, first-party contact
policy, and adapter binding. A connection can be approved only for that exact
controlled source. Browserbase then provisions or reuses a user/portal Context,
starts Clerk registration with the user's personal AgentMail address, waits for
the verification message, extracts one unambiguous code, and types it into the
same browser session. Ambiguous mail, CAPTCHA, terms, payment, password, or other
human-only boundaries stop in a takeover state. The controlled first-time signup
may use a generated ephemeral password; existing-credential prompts and password
changes do not. Verification codes and generated ephemeral passwords are never
persisted or logged.

The same reviewed adapter can open one public listing, submit an exact approved
platform message, and later poll the authenticated portal Inbox into RoomScout's
unified private Inbox. Stable first-party DOM markers make this an honest,
deterministic integration harness rather than a brittle production-site adapter.
The public source is seeded paused, and the setup path neither starts a crawl nor
sends a message.

Initialized shadcn's local conventions and migrated all application table
surfaces to one shared accessible Table primitive without reskinning RoomScout's
custom interface. Final local verification passed 210 tests across 42 files,
TypeScript, ESLint, and the Vite production build. The separate portal passed its
authorization tests, TypeScript, ESLint, and Next.js production build. Read-only
queries against both current Convex deployments still returned an empty public
signal list. The portal has not yet been assigned its separate Clerk, Convex,
Vercel, or domain configuration; no live provider action is claimed here.

The configured AgentMail credential was reported as scoped to one existing
Inbox. AgentMail documents that Inbox-scoped keys cannot gain organization-level
`inbox_create`, so it cannot prove RoomScout's one-Inbox-per-user architecture.
The readiness panel now states that requirement explicitly. RoomScout does not
silently collapse users into a shared Inbox; the live proof needs an
organization- or pod-scoped key with Inbox creation permission.

## 2026-09-01 — Live Firecrawl transport proof and roomscout.dev deployment

Ran the first real Firecrawl provider call through the deployed, locally
extended Firecrawl Convex Component against the reviewed Bandnet Hamburg supply
index. The provider returned HTTP 200, 3,647 Markdown characters and 23 links
for one credit. Repeating the same bounded call from the Development deployment
returned the same document from Firecrawl's cache, proving that the authorized
Production provider credentials were copied into Development without exposing
their values. No contact text was printed or persisted as part of this proof.
This proves the Component transport and credential wiring.

Then ran one bounded Native Monitor check against the first-party controlled
`roomscout.dev` listing rather than a real third-party publisher. Firecrawl
reported exactly one new page and charged five credits; its webhook reached
Convex with HTTP 204. Reconciliation recovered the current scrape artifact,
created one source entry, normalized it into one published observed Signal and
stored its evidence. Public projection replaced the listing phone number with
`[phone redacted]`. Reprocessing the same provider result created zero entries
and queued zero detail jobs, proving the idempotency boundary. All third-party
monitor targets remained paused.

Deployed the separate controlled portal to https://roomscout.dev. Vercel owns
and verifies the domain, the Next.js application runs in its own `roomscout-dev`
project, and its data lives in the separate Convex Production deployment
`sensible-ladybug-38`. Clerk uses a dedicated application; its publishable
configuration and secret are stored in Vercel, while Convex stores only the
Clerk issuer domain. Public Listings, Sign in, and Sign up returned HTTP 200;
anonymous requests to Post listing and Inbox returned 307 redirects to the
correct Clerk sign-in route. A real browser rendered the Clerk sign-up form,
and the post-deploy Vercel log scan contained no runtime errors. The deployed
authenticated Inbox and thread pages are server-rendered first, then subscribe
to owner-scoped Convex queries so new messages update reactively without a
reload. This records the deployed messaging surface; no live portal message is
claimed.

Convex 1.45 isolates Component environment variables. The published
`@agentmail/convex@0.1.0` package still read `AGENTMAIL_API_KEY` internally
without declaring or binding it and exposed several remote Component actions
with the wrong visibility. Added a reproducible `patch-package` compatibility
patch that declares and binds the typed environment and corrects those action
exports while continuing to run the official Component code. A deployed,
read-only Component call now sees exactly the single Inbox allowed by the
configured inbox-scoped key; it did not create an Inbox or send mail. An
internal-only, fingerprint-confirmed and collision-safe bootstrap can map that
one Inbox to a selected controlled test owner without changing the normal
one-Inbox-per-user provisioning architecture.

The deployment followed a full green local gate: 225 RoomScout tests across 45
files plus TypeScript, ESLint, and the Vite production build; the portal passed
its authorization tests, TypeScript, ESLint, Next.js production build, Convex
Development push, and Convex Production deployment. The remaining controlled
proof is intentionally stated precisely: no Clerk verification email has yet
been consumed through AgentMail, no persisted Browserbase signup/message has
yet run, and no AgentMail send/reply round trip is claimed. The inbox-scoped key
is sufficient for one controlled account, but per-user provisioning still
requires an organization- or pod-scoped key with Inbox creation permission.

Configured one Inbox-scoped AgentMail webhook for the controlled account through
an internal-only, confirmation-gated bootstrap. It targets only the Production
Convex webhook endpoint and subscribes to received, sent, delivered, bounced,
rejected, and complained message events. The returned signing secret was piped
directly into the Production deployment without being displayed or written to
the repository. An unsigned request now returns HTTP 401. No Inbox was created
and no email was sent. A live inbound event still requires the explicitly
approved controlled send/reply proof described above.

## 2026-09-02 — RoomScout-only Production ingestion proof

Added an internal, confirmation-gated proof runner that can activate and run
only the exact first-party source `https://roomscout.dev`. It refuses to start
if any unrelated source is active, while the global recurring-monitor switch
remains disabled. The deployed runner created one Native Monitor and initiated
one bounded Production check against the portal's server-rendered listing
index.

Firecrawl reported one new page. The authenticated webhook and reconciliation
pipeline produced exactly one `sourceEntry`, processed its detail page, and
published one observed Stuttgart supply Signal. Contact detection was true,
while the public Evidence projection replaced the detected phone-like value
with `[phone redacted]`. The public `signals.list` query exposes the structured
listing without contact data. Replaying the same provider check returned one
page but zero new entries and zero queued detail jobs; the database remained at
one entry and one Signal.

After verification, the source target and its provider monitor were paused
again. `FIRECRAWL_MONITORS_ENABLED` remained `false`, all four third-party pilot
sources remained `reviewing` and paused, and no Browserbase action, AgentMail
action, form submission, or external communication occurred. The change passed
239 tests across 49 files, TypeScript, ESLint, and the Vite production build
before deployment. Firecrawl's check-status endpoint still labelled the manual
check `running` after its only page result had been delivered and fully
processed; re-enabling the monitor briefly did not change that provider status,
so it was returned to `paused`. This is retained as a provider-state follow-up,
not reported as a completed-check event.

## 2026-09-08 — Reconciled Autopilot history and matching lifecycle

Backfilled the unlogged `bafc29e` checkpoint from September 2: the musician flow
now starts with a revocable non-binding Autopilot mandate, advanced controls are
collapsed, and the brand uses a wordmark. Browserbase registration verifies the
authenticated inbox contract before marking a connection active; portal writes
carry the existing provider thread identifier. These are implemented paths with
regression coverage, not evidence of a complete live signup/send/reply loop.
The main app continues to mount the official AgentMail Component and the locally
extended Firecrawl Component; the hackathon header follows the skill's narrower
`@convex-dev/*` component listing convention.

Started the next delivery block with tests that reproduced stale matches after
search edits, late asynchronous writes and candidate cutoff errors. Activation
now shares the saved-need lifecycle across Guided and Autopilot and schedules
matching before orchestration. Matching processes bounded pages rather than a
fixed candidate prefix, retires obsolete opportunities without deleting history,
and checks the saved-need revision plus a digest of the actual signal content.
Queries and first-contact execution reject obsolete matches immediately. Cached
embeddings contribute ranking without making their availability a prerequisite
for exact-constraint matching. A known over-budget monthly supply quote is now
a hard exclusion; unknown or non-comparable prices remain explicit uncertainty.
Free-text equipment overlap no longer claims that a mentioned instrument is
allowed. Added a native structured-output assessment through the existing
Convex AI Gateway adapter for requirements, schedule, supported monthly cost
including extras, and explicit sharing intent. Application validation rejects
invented evidence quotes and incomplete requirement coverage. These checks
establish grounding and shape, not infallible semantic understanding: real-model
quality remains to be measured in the planned evaluation milestone.

Assessments are privately cached by search revision, signal-content revision,
model and prompt version. Failed assessments retain visible uncertainty and
hold automatic first contact rather than silently treating unknown conditions
as satisfied. Each matching page permits at most two concurrent assessment
calls; the cross-user Workpool concurrency layer remains pending. Cached
embeddings cannot overrule hard equipment, schedule or price conflicts.
Prepared first contacts also retain their own search/signal snapshots, so an
old draft cannot inherit the validity of a newly recomputed match.

Scout now renders the same owner-scoped, current-need match projection as My
Search rather than all city listings. Dismissals persist, paused searches have
honest empty states, and an explicitly rate-limited Refresh matches control
allows legacy searches or temporarily failed assessments to be recomputed.
The schema additions are optional for existing records. Legacy match rows are
not marked valid by a synthetic backfill: they need an actual recomputation
during the later controlled Development rollout.

Final local verification: 270 tests across 54 files, TypeScript, ESLint and the
Vite production build passed. Existing browser smoke flows passed five tests
with one intentional desktop skip for a mobile-only navigation test. The new
authenticated Scout UI and semantic boundaries were tested with isolated data
and model doubles; these are not live agent evaluations. Convex code generation
refreshed bindings, but no deployment, provider crawl, inbox provisioning or
outgoing message was performed. The approved complete scope is tracked in
`docs/AUTOPILOT_DELIVERY_PLAN.md`; private motivations and private drafts are not
part of public project artifacts.

## 2026-09-08 — Shared Scout turns and private provider offers

Extracted the existing Convex Agent invocation into one runtime shared by the
musician chat, matched opportunities and provider updates. The same Gateway model,
case cards, durable musician facts and compressed memory remain in use. A failed
semantic-memory lookup no longer aborts a turn that still has structured memory.
Only musician turns receive memory-write and search-edit tools. Provider threads
get read-only musician context and a structured assessment tool; their statements
cannot redefine the musician's preferences. Recent private provider progress is
available to the musician's Scout without mixing different providers' histories.

Known-thread AgentMail receipts now enqueue interpretation transactionally with
message storage. Bound portal-thread receipts use the same entry path. Separate
provider threads remain separate even when they relate to the same indexed room.
Assessments preserve evidence quotes, recurring cost, flexible additional terms,
constraint verdicts, unresolved questions, contradictions and a proposed next
step. Private immutable offer revisions are tied to the conversation, search and
listing-content revisions. New incoming messages invalidate the previous offer
immediately; late AI results cannot restore its eligibility. Public listing data
and musician memory are not rewritten from a private reply. The old email parser
entry point is retained for in-flight-job compatibility, but now forwards to the
shared Agent; its legacy completion hook no longer fabricates scored opportunities.

Mounted the official Workpool component for provider interpretation with two
concurrent jobs and up to three attempts with exponential backoff. Each provider
conversation allows one active turn. Receipt deduplication and reuse of the
persisted Agent prompt avoid duplicate incoming events and prompt entries.
The pool retries interpretation only, not external writes. This does not yet
provide the separate browser pool or global matching-normalization concurrency.

Removed the deterministic Bandnet outreach generator from mandate orchestration.
Controlled opportunities now enter the actual Scout instead of immediately
creating an approved text template. Automatic opportunity handling is restricted
to the exact first-party portal origin; real third-party listings remain a
research/indexing path in this delivery block. The orchestration pages active
mandates and opportunities, with separate internal function executions for their
paginated reads. No inference in this milestone grants approval or sends mail.

The existing Inbox displays the private assessment, known terms, unresolved
conditions, evidence and explicitly unsent reply proposal. An outdated assessment
is labelled as requiring reassessment rather than shown as a ready offer. Exact
offer acceptance and automatic execution of the proposed non-binding reply are
still to be connected through the action ledger and semantic final-text gate.
Portal notification triggering, thread binding after sends, live mailbox/portal
proofs, broader read-only source research and the Evalite harness remain pending.

Verification: 290 tests across 57 files, TypeScript, ESLint and the Vite production
build passed. Five existing public-browser smoke tests passed with one intentional
mobile-only-test skip on desktop. New tests exercise quote validation, unknown and
conditional constraints, numeric budget conflicts, receipt deduplication, stale
results, owner isolation, provider-thread isolation and Inbox rendering. One test
runs the registered Workpool through the real Convex Agent tool loop and its
completion callback, replacing only the language model with a test double. That
proves application wiring, not real-model quality. Bindings were regenerated;
no deployment, real message, inbox creation or provider crawl occurred.

## 2026-09-08 — Controlled replies, final-message checks and receipt binding

Connected the Scout's proposed non-binding reply to the existing action ledger.
The server resolves the exact controlled listing or private portal thread and
uses its reviewed messaging adapter. Public listing sources and authenticated
messaging sources can be separate registry records for the same platform; the
connection is selected from the messaging binding rather than assumed to belong
to the public index. One offer revision creates at most one reply request.
Missing connections remain an explicit attention state, not a claimed send.

The final outgoing message now receives an independent native structured-output
assessment through the existing Convex AI Gateway adapter. The check evaluates
non-binding versus binding meaning, uncertainty, disclosures, unsupported claims
and proposed price in the current search, musician-memory and provider context.
Its persisted result is bound to the exact payload, content version and context
snapshot. Workpool retries interpretation, not browser writes. A failed or unsafe
assessment holds the message; there is no silent regex fallback to authorization.
Semantic classification is still a model judgement, not a guarantee. Real-model
quality and adversarial behavior remain part of the planned evaluations.

Deterministic owner, policy, mandate, limit and revision checks still decide
whether execution is allowed. They run again immediately before the reviewed
browser adapter clicks Send. Changes to the search, provider conversation,
musician memory or message invalidate the previous semantic clearance. Payload
hashes now use canonical JSON because Convex serialization can reorder object
keys; equivalent stored objects no longer fail approval checks accidentally.
Repeated submission reports the persisted approval decision rather than
labelling an exact human approval as autonomous just because Autopilot is selected.

A provider-confirmed portal receipt binds the resulting thread to the private
Scout conversation. A bounded, deduplicated backfill also handles an incoming
reply that arrived before this binding. Persistence failures after a possible
submit keep an unknown outcome instead of blindly resending. The Inbox shows
checking, authorized, delivery-checking and sent states from the action ledger;
an Agent-generated proposal alone is never displayed as sent.

Verification: 312 tests across 58 files, TypeScript, ESLint and the Vite production
build passed. Five public Playwright smokes passed with one intentional desktop
skip for the mobile-only navigation test. Added coverage includes initial and
reply destinations, distinct source records, owner isolation, semantic holds,
detected disclosures, stale context, idempotency, pre-click cancellation and the
early-receipt binding race. Tests use model and provider doubles; the existing
real Agent/Workpool test still exercises component wiring, not live model quality.
No deployment, inbox provisioning, real message or provider crawl occurred.
Exact offer acceptance, automatic signup/notification recovery, direct-mail reply
dispatch, live portal proofs and Evalite remain open in the delivery plan.

## 2026-09-08 — Exact offer acceptance and Development rollout

Added a musician-facing review of the exact current offer, sender, destination,
subject and acceptance text. Approval snapshots include the offer revision,
payload version/hash, current search/memory context and the controlled portal
thread and participants. Changed conditions or an in-progress provider turn make
the review unavailable. Generic action approval cannot bypass this acceptance
path; the browser executor revalidates the snapshot immediately before sending.

Confirmation is based on a persisted outbound portal message whose thread and
body match the approved payload. Only that receipt closes the provider
conversation, pauses the search and stops the active mandate. Pending approval
or execution is not displayed as delivery. The controlled message does not
perform payment or contract signing. Competing acceptance requests for the same
search are held while one is approved or executing.

Expired or changed pre-send reviews can be prepared again under the same request
with a new content version, preserving prior approval history. A cancelled or
failed request with a running, unknown or provider-started execution cannot be
reset this way. Reviewing actual browser cancellation paths exposed this case.
A repeated browser worker now returns in-progress before connecting or clicking;
recovery must inspect a receipt rather than submit the message again.

Verification: 355 tests across 60 files passed, including exact acceptance,
changed recipients/thread identifiers, competing offers, missing receipts,
cross-owner access, safe review renewal and ambiguous cancellation cases.
TypeScript, ESLint and production build passed. Five public Playwright smoke
tests passed; the mobile-only navigation test remains intentionally skipped on
desktop. These tests use isolated model/provider doubles, not live conversations.

Deployed the backend to the Development deployment and installed the registered
Scout Workpool and its batch worker. Deployment metadata confirms the three
acceptance APIs. Production and its hosted frontend were not changed; no inbox
was created and no real message or new crawl was initiated for this milestone.
The real mailbox/browser round trip, semantic model quality checks, direct-mail
reply dispatch and full evaluations remain open. This is an implementation and
Development deployment checkpoint, not completion of the demo goal.

## 2026-09-08 — Notification coordination, live model checks and Evalite foundation

Unmatched AgentMail messages can now request a controlled portal inbox read only
after matching the owned mailbox, reviewed connection, exact notification format
and allowed origin. The email URL is not forwarded to a browser; the worker opens
the fixed reviewed inbox. Browser Workpool coalesces replayed and concurrent hints,
checks ownership/policy/session state again when running, and paginates due polls.
Read/write session claims are coordinated transactionally. Bounded retries apply
to pre-claim busy sessions and safe reads, never ambiguous sends. Even a duplicate
worker arriving before the first provider session is attached returns in-progress.

Deployed the backend to Development, including the browser Workpool. A management
API call created one deterministic AgentMail webhook. Its creation response was
smaller than expected, so the first local attempt failed after remote creation.
Read-only reconciliation found that hook; a retry reused it rather than creating
another. The provider materialized a pod filter, so coverage is **pod-wide**, not
account-wide. Its signing secret was recovered from an exact configuration-matched
detail response and transferred directly into Development environment settings.
Both local and deployed read-only diagnostics confirm one hook, no configuration
drift/collisions and a matching secret. No personal inbox was created at this
checkpoint; coverage of two newly created inboxes still needs a real event proof.

Ran six fixed synthetic matching cases through native structured outputs on the
Convex Gateway with `openai/gpt-5.6-terra`. Version `constraints-v1` passed five:
the per-person case incorrectly returned the unit price as a monthly band-cost
lower bound. Version `constraints-v2` explicitly forbids such conversion without
band size or monthly hours. It fixed that case, but the repeat still passed only
five because the mandatory-extras case failed generation or strict grounding
validation. The current probe does not distinguish those stages yet. Validation
was not weakened and no regex substitute was added. These bounded checks are
evidence of both progress and remaining model variability, not an overall quality
score. No application records were written by the probes.

Installed Evalite 0.19.0 as development tooling without upgrading AI SDK 7 or the
Agent component. Its isolated framework smoke passes; fifteen scenario identifiers,
five critical-case repetitions and strict result contracts are scaffolded. The
real Convex Agent/simulator/judge backend is not yet connected. Evalite's built-in
AI SDK provider tracing targets an older provider interface, so the runner uses
manual action-boundary traces rather than replacing the production Gateway.
Dependency audit reports one high and two moderate transitive development-tool
advisories. The runner uses in-memory storage and run-once mode; no Evalite server
is exposed. This limits exposure but does not resolve those advisories.

Local checkpoint: 381 tests across 63 files, frontend and explicit Convex
TypeScript checks, ESLint, build and evaluation-tooling typecheck passed. Five
public browser smokes passed with one intentional desktop skip. The subsequent
pre-session replay regression and Convex typecheck passed separately. Production
and hosted frontends were not changed. No new crawl, browser session or message
was initiated for this checkpoint; the webhook creation above was a real provider
configuration write. Two-inbox provisioning, registration/notification round trips,
direct-mail reply dispatch and the actual agent evaluations remain open.

## 2026-09-08 — Two real personal inboxes provisioned

Created exactly two labelled, backend-owned Development test actors; existing
users were not repurposed and no public-auth signup is claimed. The bounded proof
calls the normal `mailboxes.ensureForOwner` path twice concurrently for each
actor. Both received distinct local mailbox records and distinct real AgentMail
inboxes. A second complete invocation reported two reused inboxes and no errors.
The read-only provider diagnostic now sees two accessible inboxes and the same
single pod-wide webhook with a verified signing secret. No messages or portal
registrations were initiated in this proof; live signed-event coverage remains
unproven. Only two of the initial five permitted live-test inboxes were consumed.

The public registration API now shares its actual Browserbase/OTP/mailbox logic
with a Development-only proof entry that resolves a fixed test actor server-side.
Foreign connections, unreviewed sources and non-Development execution are rejected
before provider calls. It is ready for the next controlled registration step,
not evidence that registration already succeeded.

The fifteen server-side evaluation scenarios now match the Evalite runner IDs.
The five repeated critical cases cover price changes, acceptance pressure,
deposit requests, prompt injection and changed requirements/revoked authority.
Typed test-controller events, not provider text, perform user-side changes.
Hidden provider truth, Scout-visible input and judge rubrics are separated; these
are catalogue/contract tests, not an executed real-Agent benchmark.

Latest full local gate: 397 tests across 65 files plus frontend/Convex TypeScript,
ESLint, build and evaluation-tooling typecheck passed. Development deployment
succeeded after coordinated integration. One earlier push attempt encountered a
subagent's unfinished module and failed typecheck; it was not a successful rollout.
Subsequent pushes wait for an explicit shared-worktree write pause. The targeted
Gateway extras case reproduced `UNGROUNDED_MONTHLY_PRICE`, so the remaining failure
is a non-verbatim evidence quote rather than rejected native structured outputs.
The validator remains strict. No Production deployment, commit or push occurred.

## 2026-09-08 — Registration diagnosis and controlled provider simulator

Prepared the two Development actors' connections through the shared reviewed
connection helpers. The first real registration attempt failed before attaching
a provider browser session. Stage-specific diagnostics and one controlled retry
narrowed this to browser launch: Browserbase context creation succeeds, but the
registration browser does not start. No signup page submission or verification
email is proven. Diagnostics expose fixed codes rather than provider payloads.
The updated backend passed explicit Convex TypeScript checks and deployed to
Development. Investigation continues without repeating account registrations.

The separate portal now has a local, internal-only provider-simulation controller.
Each short-lived run owns a clearly labelled synthetic listing and an exact
expected test participant. Replies use the same message-storage helper and Resend
notification schedule as the authenticated UI. Replayed requests are idempotent,
changed payloads are rejected, and a run is limited to eight replies. Closing a
run hides its own listing without deleting history. Other listings/participants
cannot be targeted. All 15 portal tests, explicit backend/frontend TypeScript,
ESLint and Next.js build passed. This portal code is not deployed or live-proven.

For fast evaluations, selected local in-memory `convex-test` isolation with the
real Scout/domain functions and a Development-only fixed-model Gateway bridge.
This avoids synthetic data in deployed tables; simulator/judge and complete
scenario scores remain implementation work. Real mail/browser proofs are still
separate. A later targeted extras-model retry passed without a prompt change;
the earlier grounding failure therefore remains evidence of variability, not a
resolved bug. No Production/static frontend deployment, commit or push occurred.

## 2026-09-08 — Browserbase launch and real-Agent evaluation diagnostics

Traced three distinct integration failures rather than treating them as missing
credentials. Convex's bundled Stagehand package lacked its extension ZIP; declaring
Stagehand as a Node external package preserves that asset. Session creation then
returned HTTP 402 because the previous `[{ type: "none" }]` proxy configuration
was treated as requiring the paid proxy capability. With `proxies: false`, both
the direct SDK session probe and the normal Stagehand launcher succeeded in
Development. The probes release their own sessions and contexts.

A subsequent controlled registration attempt failed after attaching the browser,
before the page could be accessed. A separate fixed-URL, read-only signup probe
identified Stagehand v4's required `Stagehand.create({ browser })` initialization.
All launch/reconnect paths now initialize the DOM driver and explicitly reject
implicit Stagehand model inference; text interpretation remains on the existing
Convex Gateway. Twelve focused tests pass; this last initialization change still
needs its live proof. No additional signup submission is claimed.

The first real Evalite bridge invocation rejected the SDK's string-valued system
message at our input validator. After fixing that contract and sanitizing CLI
errors, two one-turn happy-path spikes reached the real Terra-backed Agent and
persisted an offer assessment locally. Both reported no observed external-action
violation but did not reach offer readiness: constraints and availability still
needed confirmation. The displayed aggregate score is not a completion metric;
the simulator/Judge and full multi-round scenarios remain unfinished. Synthetic
state stays in local convex-test, not the deployed application database.

## 2026-09-09 — Interactive design port onto the live-data frontend

Rebuilt the maintainer's Claude Design export as React application components,
with three Sol implementation agents and main-agent integration/review. Shared
Geist typography, the supplied grain artwork, orange organic presence and compact
navigation replace the dense default consumer shell. The landing now combines a
SaaS hero with the scroll-driven conversation, progressive/correctable facts,
a shared fact-card-to-brief transition, a branching illustrative decision, bento
sections and FAQ. A rejected weekday does not lead to an incompatible offer.
Reduced-motion users receive a readable linear sequence.

The authenticated Scout is voice-first, with opt-in chat/transcript, a real saved
search projection, collapsible context and explicit brief review before Autopilot
activation. Matches, questions, drafts and offers use existing Convex data and
exact acceptance controls. Flexible facets remain visible. Settings link real
source toggles, portal identities, mandate controls and memory operations. Billing,
notification preferences and account export/deletion have no newly invented
backend: their limitations are explicit. Operator tools keep their real queries
and permissions under the new card/table treatment. Existing Inbox/search/map
functions remain available rather than being replaced with prototype fixtures.

Integration review caught and fixed route-param settings navigation, wrong-search
selection when multiple needs exist, source-toggle error handling and voice
unmounting when visiting the map. Voice now lives above authenticated routes.
One response continuation follows a completed function-call batch; speech slots
preserve transcript order. Startup cancellation, allocated-session cleanup and
late tool results are generation/session/channel-scoped. Raw provider bodies and
request identifiers are not shown in the voice/Scout error UI.

Local verification: all 476 tests across 83 files passed, including the final
draft-retention regression; TypeScript, ESLint and the production build passed.
The landing, fact progression, centered brief, both decision branches and real
login redirect were inspected in the browser. Authenticated visual inspection
and live microphone/provider checks remain pending a signed-in browser session.
No external outreach, new provider account, backend/static deployment, commit or
push was performed. Implementation map: `docs/UI_DESIGN_PORT_2026-09-09.md`.

## 2026-09-09 — Browserbase component migration and acceptance preparation

Three Sol implementation agents worked on the local Stagehand component,
controlled portal flow, and exact browser evidence; the main agent integrated
and tested the actual Development deployment. We retained the upstream MIT
provenance and hosted REST protocol instead of adding a nested component or
rewriting a browser agent. RoomScout still decides and composes messages; the
browser layer executes the authorized exact content.

Live testing caught a real boundary issue: Zod 4 JSON Schema contains `$schema`
and potentially `$defs`/`$ref`, but Convex rejects reserved object keys crossing
function boundaries. Schemas and dynamic results now travel as bounded JSON
strings, with concrete Convex envelope validators and caller-side Zod validation.
Session documents use their local schema validator; the client uses generated
component types. Raw provider errors and credentials are not exposed.

Another API mismatch was important: Stagehand's model extraction does not promise
arbitrary hidden HTML attributes. Actual URLs, rendered terms fingerprints,
authentication markers, composer contents and sent receipts are therefore read
through a small fixed, read-only CDP bridge. AI handles navigation interpretation,
not authority to send. The final claim is adjacent to submission, and uncertain
results remain unknown rather than triggering a blind resend. OTP continuation
keeps its existing page, while new-account registration explicitly selects signup.

The user requested a realistic terms test fixture. The prop portal now has a
required, nonbinding, versioned demo-terms gate before Clerk. It was deployed to
roomscout.dev and checked live through to the account form without creating an
account. Native CAPTCHA handling remains bounded and provider-owned. Unknown
terms and binding commitments still stop.

Development component install and read-only live start/navigation/extract/observe
passed. Local checkpoint: 522 tests across 91 files, backend TypeScript, build,
and targeted backend lint passed. Portal: 17 tests, typecheck, lint and build
passed. Repository-wide lint still includes unrelated design-system/UI findings;
this is not a blanket clean-repository claim. The extended live form smoke also
passed: accepted only the pinned demo terms, observed a variable-backed fill,
filled a reserved test value exactly, and cleaned up without submitting signup.
It exposed unsupported hosted session options and extra fields in successful act
responses, both now normalized at the component boundary. Empty CAPTCHA containers
no longer falsely block the form. Convex minification also injected references
into serialized DOM callbacks; static read-only expression strings and an actual
minified-build regression now cover that failure.

Main RoomScout production is unchanged. The Stagehand rollout remains gated;
no agent portal account or outreach was created during these probes. The shared
test will cover personal inbox provisioning, registration/OTP, a portal message,
the owner's reply and the Resend → AgentMail → Browserbase → Scout return path.
No commit or push occurred. Checklist: `BROWSERBASE_COMPONENT_MIGRATION.md`.

## 2026-09-09 — RoomScout band-flow production checkpoint

The end-to-end band flow is now deployed to Convex production. Password signup
schedules a personal AgentMail inbox with a readable username-first address and
bootstraps the controlled `roomscout.dev` connection in the truthful
`needs_auth` state. The mandate orchestrator now reserves one idempotent portal
authentication run when an active outreach/negotiation mandate explicitly allows
account creation on the controlled platform; outreach stays blocked until that
connection becomes active. Mandate and policy are revalidated immediately before
provider access.

Saved-need geography now uses a geocoded center and radius for hard eligibility.
The production migration processed all three existing needs. The global public
`roomscout.dev` source, controlled authenticated source, policies and bindings
were reconciled, and Firecrawl confirmed monitor
`01a0616d-d362-726a-8768-996fe2d346c1` as updated.

Verification: 581 tests across 98 files, project TypeScript, Vite production build,
focused orchestration test, Convex deployment typecheck, production function spec,
and an HTTP 200/current-asset check passed. Backend and static frontend are live at
`fleet-jackal-83`; no portal account or outbound message was created during this
checkpoint. The next action is the shared acceptance run with a fresh band account.

## 2026-09-10 — Actual Stagehand v4 runtime deployed

Replaced the controlled portal's hosted REST execution with the installed
Stagehand 4.0.2 SDK inside Node actions. The local component now stores session
metadata only. Registration, OTP continuation, inbox reads and message writes
share a runtime with explicit credentials, disabled model caching/logging and
bounded operations. Waiting for AgentMail disconnects SDK handles while keeping
the provider session available; terminal paths explicitly request its release.

Form handling checks actual field semantics and reads exact values back, then
rechecks all filled fields together before the submit. A regression proves that
a password step overwriting the email causes no submit. Existing mandate gates,
the single-send claim and deterministic receipt/message evidence remain intact.

Verification: 605 tests across 100 files pass; one opt-in local-browser probe is
skipped in the regular suite. TypeScript, production build, scoped lint and
diff-check pass. Development and production backend deployment succeeded. No
frontend change was required for this migration, and no commit or push occurred.

The development provider smoke failed at session creation. The v4 SDK hides the
underlying status behind `BrowserbaseSessionError`; the preceding direct check
reported quota exhaustion (HTTP 402). A credential-free local SDK probe timed
out. No successful real portal registration or message round trip is claimed.

## 2026-09-10 — Browser capacity restored and failed-start recovery

A direct SDK check reconfirmed HTTP 402 from the exhausted free browser-minute
budget. After the user restored capacity, both deployed Development Stagehand v4
smokes succeeded: public navigation/extraction/observation, then reviewed demo
terms and exact email-field filling. No signup, OTP or outbound message was
submitted by these probes.

Registration limits now cross the app boundary as structured cooldown errors.
An explicit owner mutation can reset only the reviewed controlled connection
after its latest authentication run failed before provider-session attachment.
It rejects other owners, other hosts, unreviewed sources and active sessions;
recovery is limited to once per daily window. The UI separates this reset from
the subsequent registration click. Normal attempt and global browser budgets
remain configured and no existing user or inbox is removed.

Verification: 622 tests pass across 101 files, with one opt-in local probe skipped;
TypeScript, production build and scoped ESLint pass. Signup/OTP and the full
provider-message round trip are still acceptance steps, not claimed successes.

## 2026-09-10 — Live Scout UI connected to the Claude design port

Replaced the live Scout dashboard with state-driven design-system scenes, not
the scripted demo state machine. Current offer assessment and confirmed sent
acceptance outrank stale outreach status. Search-scoped activity queries apply
their indexes before result limits. No legacy telemetry panels were restored.

Added shadcn message scrolling and message/bubble primitives, safe Markdown/GFM,
older-history loading, multiline/IME-safe entry and draft preservation on failure.
Voice uses the existing session engine with visible connection/mute/end controls;
switching mode and leaving Scout disconnect the session. The offer acceptance
dialog is restyled in German without changing its reviewed snapshot or approval
contract. Exact message, recipient and conditions remain available before consent.

Draft readiness is persisted against the search revision and exposed reactively.
Text and voice can mark a useful draft ready; the UI opens the brief automatically
and never activates it on the model's behalf. Editing invalidates readiness until
the updated revision is marked ready again.

The first local browser check exposed a frontend/backend deployment mismatch:
the old deployed query rejected the new savedNeedId argument. Updating the
development backend resolved the black screen. The signed-in browser then
rendered the actual offer and chat history. No message or approval was submitted
during these UI checks. The separate design previews remain untouched. Live
Settings/Inbox/operator integration is not claimed by this checkpoint.

Final verification: 678 tests passed across 112 passing test files, one opt-in
test skipped; TypeScript, production build, scoped ESLint and diff check passed.
Development backend and static frontend were updated at perceptive-antelope-445.
The hosted Scout route serves the current compiled assets. Desktop and 390px
mobile offer/chat layouts were checked in the existing authenticated browser;
temporary viewport changes were reset. No production deployment or new
fresh-account/provider round trip is claimed.

## 2026-09-10 — Settings, operator and public landing connected

Integrated three parallel Sol slices using the Claude Code design port as the
visual authority. `/app/settings/:section?` now renders the live sidebar panel;
`/ops/:section?` uses its operator equivalent. Legacy operator tools remain
reachable under `/ops/tools/*` and their prior URLs. Existing `/app/profile`
and the separate inbox remain available; they are not claimed as redesigned.

Settings reads current user/search data and supports existing source, portal,
AgentMail, mandate and memory operations. A narrowly scoped authenticated
mutation persists only the display name. Unsaved profile navigation prompts
before discarding. Missing notification preferences, billing and privacy
self-service are explicitly unavailable, never simulated switches or saves.

Operator checks distinguish configured, incomplete, disabled and client-only
providers. Checks are explicit, not triggered on mount; queries skip unauthorized
users. The profile menu exposes operator navigation only for the actual role.
Unexpected render/query failures have a safe recovery view instead of black UI.

The live landing reuses the ported composition, with separate demo/start/login
destinations and synthetic-example disclosure. Browser inspection found the
legacy unlayered anchor rule overriding button text; putting those defaults in
the base layer restores the design-system cascade. CTA contrast was visually
rechecked. Live profile, source and mandate panels loaded for the existing
signed-in user; the operator route correctly denied that musician account.
No profile save, provider probe, outbound message or approval was performed in
the browser. Operator authorized rendering is covered by isolated tests.

### 2026-09-10 — Sources design fidelity correction

Replaced the simplified live sources cards with the original SourceRow layout,
extracted as a data-independent surface shared with the design prototype.
Restored title, source icon/status/switch/detail hierarchy, mailbox copy row,
and separate connection management sheet. Only real sources are rendered.
The global automatic-selection switch is explicitly read-only; individual
source exclusions persist and now affect matches and new mandate outreach.
Verified the signed-in live page visually and opened the management sheet
without performing any external action. Eight focused UI tests, 23 source/
orchestration tests, frontend build and backend typecheck passed. Dev backend
deployed; production untouched. Initial HMR/backend rollout mismatch resolved
by successful deployment and reload; both new public functions verified.

### 2026-09-10 — Autonomy settings design fidelity

Replaced the single mandate summary card with the original autonomy layout:
mode radio cards, grouped permission switches, daily-limit stepper, expandable
details and commitment boundary notice. Values are derived from the actual
mandate, not design fixtures. Explicit save uses existing draft/activation APIs;
review mode revokes standing permission. Unchanged permission subsets and
scope are preserved. Parent navigation protects unsaved drafts. Nine focused
tests and frontend build passed; signed-in browser screenshot reviewed against
the supplied design. No live permissions were changed during verification.

### 2026-09-10 — Billing and privacy settings surfaces

Ported the account settings layouts using the existing Claude design tokens and
settings primitives. Billing shows access, activity placeholders, payment/address
rows and invoices. Privacy links to live knowledge, sources and Scout routes.
Unavailable billing, export and deletion controls are native-disabled and dimmed;
no payment or deletion backend was added. Missing usage totals are not fabricated.
Added responsive stacking and truthful cloud-storage wording. Twelve focused tests,
scoped ESLint and the frontend build pass. No live-route visual verification or
deployment was performed for this change.

### 2026-09-10 — Operator design alignment

Aligned the live operator surface with the Claude reference: six navigation
sections, provider identity tiles, activity tables, source rows, integrations,
disabled feature-flag controls and diagnostics. Existing advanced tools remain
reachable separately. Real source data uses the existing operator-gated query;
unknown readiness and unavailable controls are explicit, not simulated.
Compared the rendered surface with the reference using an isolated visual fixture.
All 27 focused tests, frontend build and scoped ESLint pass. No backend deployment,
role changes or authenticated live-admin verification were performed.

### 2026-09-11 — Combined UI/backend production release

Committed and pushed c2e802a on ui-port. All 753 tests pass with two workers;
one opt-in test is skipped. Production build and app/backend ESLint pass.
Full-repository lint retains 45 pre-existing no-undef errors in unchanged local
browser scripts. Published Convex backend and 23 frontend files using the
official Static Hosting deployment command. Hosted route HTML matches the local
production build and entry assets return HTTP 200. No user data was deleted,
roles changed, messages sent or approvals exercised during release checks.
Authenticated user/admin and fresh-band round-trip acceptance remain separate.

### 2026-09-11 — Explicit Firecrawl OR Browserbase decision

The user chose one portal browser provider per deployment, not a fallback chain.
Firecrawl is preferred for sponsor alignment only if the complete controlled
portal flow is reliable with Clerk bot protection disabled. Browserbase remains
the separately selectable implementation; failures must never silently switch
providers. The choice covers registration, writes, reads and live-view/resume
behavior; Firecrawl discovery and AgentMail email remain independent services.
No per-connection override in v1. Provider profiles are not transferable; existing
connections with the other provider must stop until explicitly reconnected.
The revised implementation plan addresses profile-readiness proof, closed-session
timeouts, scheduled registration reservations and sanitized diagnostics. Code
implementation is assigned to GPT-5.6-Sol slices with integration review and
end-to-end acceptance gates. No integration, deployment or provider setting was
changed by recording this decision.

Implementation checkpoint: three GPT-5.6-Sol slices locally integrated sanitized
code-only transport, exclusive provider selection, registration and OTP lifecycle,
fresh-session authentication proof, approved writes, bounded inbox reads and
maintenance/drain guards. Combined verification passes 835 tests with one skipped;
production build and scoped app/backend ESLint pass. Final review added tested
durable cleanup of write/probe sessions and uncertain first-contact reconciliation.
Live provider acceptance remains open; automated tests do not prove Clerk/profile
persistence or a real message round trip. No provider setting or live message was
changed. A subagent's code-generation command attempted a dev function upload;
the subsequent read-only dev function listing contained no new portal-engine
functions. No production rollout was performed in this block.

### 2026-09-13 — Firecrawl manual-test deployment and clean app state

At the maintainer's explicit request, committed and pushed e7a0cee on ui-port,
deployed both Convex backends, and uploaded environment-specific frontend builds
through Static Hosting. Both deployments now select PORTAL_BROWSER_ENGINE=firecrawl.
Function-spec inspection confirms the new portal and maintenance functions in
both deployments. Local verification again passed 835 tests with one skipped,
build, and app/backend lint. Four local exploratory scripts remain uncommitted.

Created full local snapshots including file storage before resetting root and
component tables through deployment-specific snapshot imports. Authentication,
password/username mappings, Agent chat history, queues, mailbox mappings and
browser state were cleared; Static Hosting was retained. Post-reset exports
confirm 132 empty non-hosting tables per deployment. Backups remain outside the
public repository. Root pending/running scheduled work was checked before reset.
Crons remain installed and may rebuild public source catalog state; the temporary
dev monitor pause was restored to its previous value. Production monitor settings
were unchanged. The separate roomscout.dev portal, listings, external inboxes and
remote authentication profiles were untouched. Use a fresh band identity for the
manual test. No registration, provider message or binding acceptance was sent by
this release procedure; live end-to-end acceptance remains unproved.

### 2026-09-13 — Fix inconsistent portal runtime and authentication status

The first manual test revealed that the imported generated environment object
could be stale in Node actions. The registration action defaulted to Browserbase
while V8 reservations labelled its run and context Firecrawl. Stagehand component
execution logs confirmed the actual provider; Clerk verification alone did not
prove a reusable Firecrawl profile.

Provider selection now reads the current runtime environment. Browserbase callers
explicitly pin reservations and attachments, rejecting disagreement before browser
allocation. Firecrawl authentication cannot complete without same-run fresh-session
proof. Completed-but-unverified UI offers the existing profile inspection/recovery,
not signup, and returns to `/app/settings/sources`. Existing accounts are preserved.
Three Sol agents implemented the runtime, state and UI slices. The final full suite
passes 843 tests with one skipped; build and app/backend lint pass. The new internal
sanitized Node probe confirms Firecrawl on dev. Live profile recovery and release
checks follow; no new signup or external message has been sent by this fix.
The maintainer chose a fresh-band manual test, so recovery of the existing
account was deliberately skipped and its data remains unchanged.

Released as 255a820 on ui-port. Both backends and environment-specific static
frontends are deployed. Live Node probes select Firecrawl on dev and production;
HTTP checks confirm current assets, correct backend URLs and the recovery UI.
The initial production asset upload failed at the network layer and was cleaned
up by the hosting tool; a retry published all 23 files successfully. No existing
account, connection, search, listing or message was modified by the rollout.

### 2026-09-13 — Firecrawl registration lifecycle and real-time progress

The next manual test did schedule automatic registration, but its first Interact
call failed with HTTP 409 and cleanup returned 404. Portal scrapes now disable
cache reads and writes, read-only Interact calls have bounded conflict retries,
and stop treats an already-missing session as idempotent success. A destroyed
dashboard session alone does not prove the original 409 cause.

A read-only production preflight creates an isolated temporary browser profile,
reads the signup page and stops without filling forms, polling email or creating
an account. Comparing revisions isolated a separate structured-result transport
mismatch: the unmodified result-only decoder failed at get_url, whereas the
explicitly awaited result program and controlled output marker passed that probe.
Final verification is recorded below when complete; this is not an OTP or
authenticated-profile persistence acceptance test.

Sources now subscribe to sanitized latest authentication-run metadata and show
registration/verification progress. Unsupported Firecrawl manual login is not
offered. OTP continuation emits submitting progress before provider execution and
records terminal failure if the driver or proof fails. Mandate activation also
directly schedules the idempotent registration orchestrator independently of
matching. No Browserbase fallback was introduced.

Final unchanged-source verification: 865 tests passed and one skipped, with build,
TypeScript and app/backend lint clean. Both backends are deployed; both published
frontends serve the progress copy and point to their matching backend. A fresh
production preflight with this exact source returned ready/sign_up. The final
transport explicitly awaits the program and accepts valid structured results or
only its own JSON marker; raw provider output and stderr do not cross the component
boundary. No live signup, OTP submission or external message was sent during this
release verification. The maintainer's manual end-to-end test remains outstanding.

### 2026-09-14 — Automatic roomscout.dev source check after activation

The first successful Firecrawl registration on production completed, but the
Scout stayed idle: no roomscout.dev listing had been ingested since the reset.
The daily Firecrawl monitor for the public source had never run (no checks,
`lastRunAt` null), and the working stage shown to the musician is derived from
the need status alone. One operator click on "Jetzt Quellen prüfen" carried the
chain through ingestion, matching, three opportunities, provider assessments
and a drafted non-binding platform message that now awaits the musician's
approval because the safety check flagged a personal-data scope outside the
default mandate.

`demoSourceChecks.requestAutomatic` is the internal counterpart of the manual
check. Default Autopilot activation, explicit mandate activation and a
completed registration with a ready portal context now schedule it with an
idempotent request id per mandate or run. It reuses the bounded manual run
(one check, five detail pages), never interrupts an active run, skips when the
last run completed within fifteen minutes, and skips silently without a
Firecrawl key. Full suite: 877 tests passed, one skipped; typecheck clean.

Diagnosed but deliberately left open at the maintainer's request: the global
monitor reconciliation compares `schedule.text` while Firecrawl returns only
`schedule.cron`, so the 15-minute cron rewrites the monitor on every tick and
the nightly run keeps being skipped; two orphaned monitors from before the
reset still post nightly into the webhook; portal Interact requests carry no
headroom between HTTP deadline and sandbox timeout (the logged `status: 0`
during the profile proof was such an abort, swallowed and retried
successfully); the 45-second registration session cannot survive a slow OTP.
The production test account was promoted to operator so the manual check is
reachable. Nothing is committed or deployed by this entry.

### 2026-09-14 — Mandate removed, per-user autonomy rules

The per-search mandate is gone (ADR 0001). The `searchMandates` table,
`convex/mandates.ts` and `convex/lib/mandateAuthorization.ts` are deleted; the
shared types `ExternalActionType` and `PersonalDataScope` now live in
`convex/lib/autonomy.ts`. Opportunities, handoffs, requests and approvals no
longer carry a `mandateId`; approvals only record `autonomyVersion` and
`autonomyHash`. The literals are now `autopilot` (instead of `standing_mandate`)
and `authorized_by_autonomy` (instead of `authorized_by_mandate`), and the
result of `submit` reports `authorizedByAutonomy`. No data migration: the
maintainer clears the test rows before the deploy.

"Search active" is now `savedNeed.status === "active"` and nothing else. The new
`savedNeeds.activate` mutation checks ownership and a complete location
(`INCOMPLETE_NEED`), sets the status, writes `search.activated` and schedules
matching, the orchestrator and the automatic roomscout.dev check. Pause and
resume stay on `savedNeeds.setStatus`. The platform scope of a search is every
active platform minus the user's source exclusions; there is no `platformIds`
list anywhere any more.

`convex/mandateOrchestrator.ts` is now `convex/scoutOrchestrator.ts` and runs
over active search briefs instead of mandates. Controlled registration and
queueing an opportunity both require that "contact" is switched on in the
per-user autonomy rules (Handlungsspielraum); both modes run through the
orchestrator, and review mode only takes effect in the gate (release check) at
send time. The scheduled registration carries `savedNeedId` instead of
`mandateId` and stops with `REGISTRATION_SEARCH_NO_LONGER_ACTIVE`. Two additions
from the gate: self-drafted messages become a decision with the reason
`user_draft`, and a portal connection with the wrong browser provider stops with
`provider_mismatch` instead of a raw patch.

In the shell frontend `MandatePanel`, `SearchControlSettings` and
`mandatePolicy` are deleted; "Meine Suche" (my search) gets "Schick mich los"
(send me off), pause and resume, and the Scout screen activates through
`savedNeeds.activate`. The mandate tests are replaced: the orchestrator test
works with active search briefs and stored rules, and the remaining suites no
longer seed a mandate row but toggle the rules instead. Nothing is committed or
deployed.

Deployed 2026-09-14 evening from branch autopilot-policy: production tables
searchMandates, opportunities and actionRequests (five, three and one row of
the same day's manual test) were cleared with the maintainer's consent because
the mandate-free schema rejects them; the backend was pushed to production and
dev, the frontend rebuilt and uploaded to both. Signals, listings, portal
connections and the registered Firecrawl profile were left untouched.

Same evening: the first autopilot run on production reached the demo listing
without a human step (opportunity, Scout assessment, gate "proceed", Firecrawl
write, portal thread within about seventy seconds). Two follow-ups: matching
now recreates an opportunity for a still-current match whose row was removed,
and the roomscout.dev portal (separate project, ../roomscout-dev) received the
AgentMail component env mapping plus the patch-package patch so provider-reply
notifications reach the musician's Scout address again.

Later that evening the reason for the slow reply loop was found: the AgentMail
account had webhooks for the portal deployments only; the Scout's production
site had none, so "new message" notifications from the portal never reached the
Scout and replies surfaced only through the hourly Firecrawl poll. The Scout's
production webhook is now created by agentmailComponent.bootstrapAccountWebhook
(pod-scoped, secret stored in the deployment), the controlled portal is polled
every five minutes as a fallback, the inbox sync retries the first Interact call,
and the Scout surface shows an interim-state card until an offer is ready.

Webhook chain proven the same evening: provider reply in the portal at 20:04,
AgentMail event on the Scout's production webhook at 20:04:25, mailbox message
stored. The hint that turns that mail into an immediate inbox sync rejected it
because AgentMail appends a plain-text footer to the portal template; the hint
now strips that footer. The replayed hint scheduled the sync, the reply was
imported and assessed within about ninety seconds. The Scout then chose
ask_musician (Stuttgart-West instead of Mitte? Tuesday or Wednesday?), which
today reaches nobody: no chat question, no decision. That is the gap candidate B
(decisions in the chat) closes; it is the next piece of work.

### 2026-09-14 — Decisions in the chat (candidate B): contract and build

Starting point: the gate (release check) returns `ask_user`, the provider
assessment returns `ask_musician`, registration reports `humanRequired`, and a
finished offer waits in a notification. None of these reach the musician in the
Scout chat; the conversation with the demo landlord has been stuck since
revision 4 on a follow-up question (Stuttgart-West instead of Mitte? Tuesday or
Wednesday?) that nobody sees.

Contract after two grilling rounds with the maintainer: a new `decisions` table
(owner, search brief, conversation, kind `scout_question` | `review_message` |
`private_data` | `binding_content` | `unsupported_claims` |
`safety_unavailable` | `offer_ready` | `human_step`, status
open/answered/superseded, question, detail, options, references to
request/offer/run, answer). Exactly one open
decision per conversation; a new one supersedes the old one. It is raised in
`recordOutcome` (ask_user), in `recordAssessment` (ask_musician and ready) and
on `humanRequired` from registration. For `ask_musician` the Scout formulates
the question in its own model round inside the musician's chat thread and
stores it through a tool; the notification line for that is dropped.

Answer paths: a card in the Scout chat with buttons plus free text. "Yes"
approves the exact message and sends it immediately; "No" rejects it and the
Scout asks what should be different; own text is sent through the gate as a
`humanDraft` request, which treats it as approved by the user. Answers to a
Scout question are recorded as a trusted musician statement in a new
`providerTurns` entry `musician_input`, the assessment runs again, and the next
provider message follows. Text answers additionally run as a chat round with
the existing memory and search tools, so facts land in memory and in the search
brief. Chat and voice gain the tools `answerDecision` and `replyToProvider`. The
Scout stage shows "Hier brauche ich kurz deine Hilfe." (I need your help for a
moment) with the question as a subtitle and opens the chat; the activity panel
becomes pure history without approval buttons.

Build: a workflow with four steps (backend, check, frontend, check) on branch
autopilot-policy, started 2026-09-14 around 18:20Z. Result and live check
against the waiting production conversation follow below.

Result (2026-09-14, commit 2cfe436): the workflow completed all four steps.
Backend: the `decisions` table with three indexes, `convex/decisions.ts` and
`convex/lib/decisions.ts`, raise points in `recordOutcome`, `recordAssessment`,
`markAgentOnboardingState`, `attachProviderRun` and `finishRun`; `providerTurns`
knows `musician_input`; requests carry `humanDraft`; the gate now evaluates
`userApproved` in both phases (submit and claim), otherwise a dictated text
would hang in the safety wait state at `prepareClaim`. Frontend: `DecisionCard`
as the last element in the Scout chat, the stage showing "Hier brauche ich kurz
deine Hilfe." with the question as its status, the chat opening automatically
without a voice session; `ActionApprovalSheet` deleted, the activity panel is
pure history. Checks: typecheck, ESLint on all changed files and the full suite
green (139 files, 979 tests, 1 skipped). Known gaps: a failed answer shows the
generic send error in the chat; without an accessible offer row "Angebot
prüfen" (review offer) degrades to a link into Messages; for a search still in
draft the blocked stage still carries the "Scout unterwegs" (Scout on its way)
item. Not deployed; the maintainer will check in the portal later, then roll it
out together with the inbox.

### 2026-09-14 — Messages (Nachrichten, candidate C): contract and build

Starting point: `/app/inbox` is the old three-pane page on the legacy shell
(English copy, no composer, a handoff button with no user, verification mails
from the Scout mailbox, web-form threads synthesised from requests). The
maintainer wants Messages as its own menu item, not as a tab of the settings,
but in the same panel style: conversations on the left, the thread on the
right, own messages possible.

Contract: route `/app/inbox/:conversationId?` with `LiveInboxPage` in the same
chrome as the settings (`PanelDialog`, breadcrumb "Nachrichten", "Zurück zum
Scout" = back to the Scout). The nav row of `PanelDialog` gains an optional
`meta` (avatar, preview, time, status, dot) and uses it to render two-line
conversation rows in both placements (sidebar and sheet below 900 px). On the
right the thread with the vocabulary of the Scout chat: provider on the left,
"Dein Scout" (your Scout) and "Du" (you) on the right, answers to the Scout on
the right as "Du an deinen Scout" (you to your Scout), assessments as collapsed
marker lines, open decisions as the same `DecisionCard` as in the Scout chat,
pending messages as a bubble with a status line (sending, waiting for approval,
blocked with a reason). When an offer is ready the existing offer card
including its acceptance sits at the top. The composer from the Scout chat is
extracted as `ChatComposer` and used on both surfaces; it is locked while the
Scout is assessing, when the conversation has ended or when the channel is not
ready.

Backend: a new deep module `convex/conversations.ts` that hides the mail and
portal channel behind one interface: `listMine` (title from the listing,
preview of the newest message, unread, open decision, pending request),
`getMine` (chronological entries: provider message, sent message with its
author through `actionExecutions`, pending request with gate text, Scout note,
musician answer, decision; composer state), `reply` (with an open message
decision it runs through `answerDecision` with own text, otherwise through
`stageCustomReplyForOwner`; it never claims "sent") and `markRead`. Schema:
`providerConversations.lastReadAt` and an index on
`actionRequests.providerConversationId`.

Deliberately left out: verification mails from the Scout mailbox (registration
reads them server-side and otherwise raises a `human_step` decision), the
handoff flow (half broken, no other user; the backend functions stay),
web-form pseudo threads. The old page and its four only-there components are
deleted together with their tests. Built as a workflow in four steps on
autopilot-policy, started 2026-09-14 around 19:40Z; the result follows below.

Result (2026-09-14): the workflow completed all four steps. Backend:
`convex/conversations.ts` with `listMine`, `getMine`, `reply`, `markRead`;
`replyChannelReady` is extracted from `draftReplyRequest` as a pure
precondition and used by both; validators are derived from the schema instead
of declared again; ten integration tests. Frontend: `LiveInboxPage` under
`/app/inbox/:conversationId?`, `PanelDialog` rows with `meta` in both
placements, `ConversationThread` with the vocabulary of the Scout chat,
`ChatComposer` extracted from the Scout chat (whose tests stay green
unchanged), copy namespace `liveInbox`, `formatMessageStamp` with a test, and
the offer card without its own Messages link inside the inbox. The old page,
four only-there components, their tests and the dead inbox selectors in
`app.css` and `design-system.css` are deleted. Re-check by the maintainer
agent: `getMine` read the oldest instead of the newest hundred messages (no
`order("desc")`), the list was not sorted by last activity, a dictated text
lost its paragraphs on the decision path, and the composer's error card did not
know the codes of that path; all fixed. Checks afterwards: typecheck, ESLint,
the full suite (141 files, 1000 tests, 1 skipped) and the Vite build green.
Open and noted: the offer card fetches the acceptance fields through a second
list query; `markRead` runs per incoming message without throttling;
`docs/UI_PORT/DATA_MAP.md` and `docs/SCAFFOLD_PORT_PLAN.md` still describe the
old page; orphaned neighbouring selectors in `app.css` (`.pane`, `.convo`,
`.rs-handoff-sheet` among others) are waiting for a sweep;
`api.opportunities.createHandoff/updateStatus/listMine` have no UI caller any
more.

The maintainer's first look at production (22:10): the Scout messages appeared
to be missing and the provider bubbles ran off the right edge of the panel.
Cause, reproduced with the real production data in a local Playwright test
page: the `SidebarProvider` is the grid item of the dialog; without `min-w-0`
the implicit column grows to the length of a non-wrapping line, and the
collapsed Scout note with `truncate` was exactly such a line (600 characters).
The whole panel became 3900 px wide and everything right-aligned sat outside
the viewport. Fixed with `min-w-0` on the grid item and `line-clamp-1` instead
of `truncate` on the note (commit c0011a0); the frontend was rebuilt from a
clean worktree and uploaded to production and dev, because the working tree at
that point contained the half-finished changes of candidate K.

### 2026-09-14 — Scout chat (candidate K): streaming and one bubble system

Finding: the live chat answers through `generateText`, so the reply only
appears after the whole round; the client calls an action and waits, the user's
own message only lands in the history after it is saved, and "Nachricht wird
gesendet" (message is being sent) is a local flag; `scout.listMessages` uses
`listUIMessages` without `syncStreams`, and the client uses `usePaginatedQuery`
instead of `useUIMessages`. Alongside that, two bubble systems (`ChatBubble`
from the design kit in stages, transcript, voice and landing; shadcn's
`Message`/`Bubble`/`Marker` in the Scout chat and the decision card) and two
composers.

Contract: `scout.send` becomes a mutation that stores the musician's message
through `saveMessage` and schedules `internal.scout.reply`; the action builds
the tools as it does today and calls `streamText` with `saveStreamDeltas`
(word by word, throttled). `scout.listMessages` accepts `streamArgs` and
returns `syncStreams` with it; the client uses `useUIMessages` with
`stream: true`, `useSmoothText` for answers in progress and
`optimisticallySendMessage`, so the user's own message is there immediately.
States come from the last Scout message: `pending` without text shows "Dein
Scout denkt nach …" (your Scout is thinking) as a marker with a shimmer, tool
parts show German marker lines (Merkt sich etwas = remembers something,
Aktualisiert deinen Suchauftrag = updates your search brief, Übernimmt deine
Entscheidung = applies your decision, Schreibt dem Anbieter = writes to the
provider), and `failed` shows an error line with a retry. The stage reads "Ich
denke kurz nach" (thinking for a moment) from the same state instead of from
the action's promise. `ChatBubble` is deleted; stages, transcript, voice chat,
landing and gallery switch to `Message`/`Bubble`. Chat surfaces use the
`ChatComposer` extracted from the inbox; the pill composer stays on the stage
only. Voice stays unchanged. Start after the inbox is finished, because both
touch the Scout chat and the composer.

Result (2026-09-14, commit 9a0d507): the workflow completed the
backend, the check, two parallel frontend steps and the final check. Backend:
`scout.send` is a mutation (ownership check through `scoutContexts`, 1 to 4000
characters, `saveMessage`, schedules `internal.scout.reply`); the action builds
the tools as before and streams through `streamText` with `saveStreamDeltas`
(word by word, 250 ms); `runScoutTurn` keeps the `generateText` path for
provider rounds and decision questions. `scout.listMessages` accepts
`streamArgs`, returns `syncStreams` with it and reduces tool parts to type,
call id and state; tool inputs and outputs never leave the server. An error in
the round marks the pending Scout message as `failed` (checked in the Agent
source and tested). Frontend: `useUIMessages` with `stream: true`,
`optimisticallySendMessage`, `useSmoothText` for answers in progress, a
thinking marker with a shimmer, German marker lines per tool while the round
runs, an error line with "Erneut senden" (send again); the local send flag and
the pseudo row "Nachricht wird gesendet" are gone, and the composer blocks only
sending, not typing. `ChatBubble` is deleted, `ChatTurn` on `Message`/`Bubble`
replaces it in stages, transcript, voice chat, landing and gallery; where the
two systems disagreed, `Bubble` wins (the Scout row now always with a bubble,
88 percent width, one type step). Checks: typecheck, ESLint, the full suite
(143 files, 1017 tests, 1 skipped) and the build green. Known points: a type
bridge at the hook, because the reduced tool parts do not structurally match
`UIMessage`; `createdAt` stays as an alias in the page for now;
`internal.scout.reply` rethrows after logging and so produces a visible error
entry in the Convex logs; the stages now show the Scout with a bubble and the
user bubble one step smaller, which is a visible change for the maintainer's
eye.

### 2026-09-14 — Small UI changes after the maintainer's first look

After A, B, C and K the mode changes: small, direct changes without review
rounds. Four decisions taken by asking back with an ASCII preview: the stage in
three fixed columns (candidates on the left, blob and headline in the middle,
search brief on the right, as sheets below 1100 px), an open decision as
buttons directly under the question on the stage (the card in the chat stays),
the sources table in the operator panel with a live toggle and an "Erweiterte
Ansicht" (advanced view) link to the old page, and a candidate row with title,
location, state and time that clicks through into Messages. On top of that the
integrations in the order Convex, AgentMail, OpenAI, Firecrawl as four tiles,
with Browserbase only as a greyed-out alternative in an engine menu of the
Firecrawl tile. Implemented by two parallel agents (operator, stage); the
result follows.

Result: operator (commit c8534f2): four tiles in the order Convex AI Gateway,
AgentMail, OpenAI direct, Firecrawl; Browserbase only as a greyed-out
alternative in an engine menu of the Firecrawl tile, without its own readiness
indicator; the sources page is the table from the mock with connection copy
from status and health, timestamps through `formatMessageStamp`, the toggle on
`sourceRegistry.setSourceActive`, the button "Jetzt Quellen prüfen" (check
sources now) on `demoSourceChecks.requestNow` and the link "Erweiterte Ansicht"
to the old page. Stage (commit 44fabad): `decisionSlot`, `asideSlot`
and `railSlot` on the live stage; decision buttons without a frame under the
question, no automatic opening of the chat any more; three columns from 1100 px
(candidates 260 px, middle, search brief 300 px), two sheets below that;
`CandidateList` from `conversations.listMine` filtered to the active search
brief, a click opens the conversation. Full suite 1031 tests green, build
green, frontend on production and dev.

In between, the finding from the running demo: `present_offer` with only one
internal open point (Tuesday or Wednesday) was parked as an interim state,
because only `ask_musician` and `ready` raise a decision. The readiness check
now separates provider-side blockers from the model's own open points;
`present_offer` without a provider blocker raises a Scout question, and the
prompt requires `ask_musician` in that case (commit 2db65d9, backend on
production and dev). The question for the running conversation was pulled
through by hand.

### 2026-09-15 — Firecrawl hardening: plan and build

After the acceptance message (which went through after two failed attempts),
the maintainer did not want another point fix but a plan that brings the Convex
path into the shape of the local proof. Three parallel analyses (local scripts,
the Convex path, the seams to Browserbase) found: 16 to 46 round trips per
message instead of 7 locally, errors flattened three times over, a decoding
that prefers Firecrawl's `result` field over our own marker (which makes the
evening's fix 0abe076 ineffective in production), a self-made 409 class caused
by the second proof session, and one budget for everything. The plan is in
`docs/FIRECRAWL_HARDENING_PLAN.md` (commit fccd2da), slices S0 to S7, with a
Browserbase guard fence including a file and test list. Decisions taken by
asking back: everything in one go, `saveChanges:false` behind a switch, delete
the old path, turn the poll off entirely. Built as a six-stage workflow (three
build steps, three check steps, each with `git diff --stat` over the protected
files).

Result (2026-09-15, 01:55): all eight slices (S0 to S7) built, six workflow steps through,
the protected Browserbase and driver files and their tests byte for byte
unchanged (`git diff --stat` empty), the seven delegation points untouched. A
message now costs scrape, prepare, send, stop (four round trips, previously 16
to 46), a registration costs scrape, signup, verify, stop (four instead of
about 33, keepalives separate), and the inbox sync stays at three. Our own
result marker is read first at the component boundary, Firecrawl's `result`
field is only a fallback, and the shape of an unexpected response is logged.
Sandbox errors come back in-band with a cleaned message and page diagnostics;
the execution record carries the inner code. Writing opens the profile
read-only by default (`FIRECRAWL_WRITE_SAVE_CHANGES`), the proof runs inside
the send program, and the second proof session and `retryWriteProfileProof` are
deleted. The poll of the demo portal is off (interval 0,
`disableAutomaticPolling` for existing connections); a failed webhook sync may
take exactly one backoff attempt. The Firecrawl primitives adapter is deleted
and `firecrawlPortal.ts` no longer imports the driver; a parity test counts the
round trips per operation at the transport boundary and checks the receipt
fields against the local script. The isolation test had to follow in two places
(spies on the engine instead of the driver, one session instead of two); its 21
cases are green. Pulled through afterwards: the failure reason after the click
is logged, and two tests that depend on the time of day and on the rules were
corrected. Full suite 1083 tests green, build green. Still open is the live
proof of the first real message without a write lock; the first real
registration is to be watched as well, because the profile proof is now the
live observed sign-in.

### 2026-09-15 — Seven fixes from the maintainer's live run

The maintainer ran the whole loop on production and came back with seven
findings: the thinking state was a frozen label, the captured facts arrived in
the chat instead of the Suchauftrag aside, facets showed raw keys such as
`equipment.storage`, the Scout kept talking about the search after it was
already live, the stage hung from the top of the viewport, a decision could
only be answered with the offered chips, and reviewing an offer took two
clicks with vague acceptance states. A four-phase workflow (backend, chat and
decisions, facts and stage, verify) built the fix; the orchestrator's brief
named the exact shadcn primitives after an earlier "like shadcn" phrasing had
produced a custom rebuild.

Result (commit 61797c3): the chat shows one rotating verb in shadcn's
`shimmer` utility, installed the documented way (`npm install shadcn`,
`@import "shadcn/tailwind.css"`, `<MarkerContent className="shimmer">`); the
hand-rolled text sweep is deleted. Facts render through an allowlist of
namespace/key pairs with German labels, band details fuse into one row,
duplicates are dropped, and a new fact flies as a capsule from the chat into
the aside, which now also shows during discovery. The case card forbids
recapping the facts and tells the Scout when the search is live; the centre
column is vertically centred; "Scout losschicken" closes chat and voice first.
Decisions render the shadcn Questionnaire with chips and an own text field;
typed text becomes an instruction to the Scout through `decisions.answer`
(choice `custom`), never a provider message. The stage decision slot is the
same card, so "Angebot prüfen" opens the acceptance flow in one click, and the
acceptance reads pending, confirming, unconfirmed, failed or "Zusage gesendet"
with a timestamp. The `updateSearchDraft` tool description names the twelve
facet keys the brief can show.

Open: `npx shadcn@latest add questionnaire` fails with a registry 404 (the
item is not in the `@shadcn` registry yet), so `src/components/ui/questionnaire.tsx`
is a labelled temporary stand-in over the real `@shadcn/react/questionnaire`
primitive; the maintainer runs the CLI himself once the item is published.
Typecheck, 1116 tests and the build are green; deployed to production and dev.

### 2026-09-15 — Chat parts from the shadcn registry, not hand-written

Asked whether the chat UI used "the real thing", the check showed a split:
`message-scroller.tsx` was the real headless primitive with a tokenised layer,
but `message.tsx`, `bubble.tsx` and `marker.tsx` were 13 to 21 line reductions
written during the UI port with shadcn's slot vocabulary and none of its
anatomy (no `MessageGroup`, `MessageAvatar`, `BubbleGroup`, `BubbleReactions`,
`MarkerIcon`, no variants, no `asChild`). The maintainer chose the CLI files
verbatim with the look expressed through variants.

Result: `npx shadcn@latest add message bubble marker message-scroller spinner`
wrote the five files; the CLI also overwrote `button.tsx` as a registry
dependency and it was restored from git. Musician bubbles are `tinted`, Scout
and provider bubbles `secondary`, day and system lines `Marker
variant="separator"`, the thinking line is `MarkerIcon` + `Spinner` next to
`MarkerContent className="shimmer"` as the docs show, and running tool calls
use the same icon marker. The scroller's jump button gets its German
accessible name from the dictionary. `index.html` now sets `class="dark"` on
the root, because the app is dark-only and the verbatim files otherwise render
their light formulas. The fast-refresh export lint rule is off for the shadcn
folder. Typecheck, 1116 tests and build green; frontend deployed to production
and dev.

Questionnaire: the item exists only under the v4 styles (`radix-nova`,
`base-nova`, …), not under `new-york-v4`, which the project's
`components.json` still targets. Adding it by registry URL stops at an
interactive prompt (overwrite `button.tsx`?), which a non-interactive run
cannot answer, so the labelled stand-in stays until the maintainer runs the
command in a terminal.

### 2026-09-15 — Questionnaire from the registry

The maintainer ran the CLI in a terminal with the radix-nova registry URL,
declined the overwrite of `button.tsx`, and the CLI wrote
`src/components/ui/questionnaire.tsx` as the registry's styled layer over
`@shadcn/react/questionnaire`. The hand-composed stand-in is gone. The file
exports the ten parts DecisionCard already used plus Next, Previous, Progress,
Skip and ChoiceDescription, so no call site changed. Typecheck, 1116 tests and
build green; frontend deployed to production and dev. Every shadcn part in
the chat and the decision card is now CLI output.

## 2026-09-17 — Fictional Berlin provider engine and controlled round trip

The separate `roomscout.dev` frontend and `sensible-ladybug-38` backend now run
one shared AI-provider engine with a distinct Convex Agent Component thread for
each portal conversation. The guarded production seed inserted 24 fictional
Berlin listings; its immediate replay reported 24 unchanged and preserved the
older Stuttgart listing. The main app processed all 24 public detail pages
through the normal Firecrawl path into distinct AI-simulated signals. A deployed
coordinate correction then reconciled the public location facets for all 24.

A fresh main-app account used normal authentication, profile and saved-need
flows, completed Firecrawl portal registration, sent the BER01 initial message,
received a real AI-provider reply through the portal notification path, and
produced the resulting main-app assessment. This proves the controlled,
non-binding BER01 round trip without a direct database shortcut. Separate EN
and DE model threads answered in about 3.55 and 3.52 seconds; a follow-up took
about 2.99 seconds. Only BER01 is enabled while the remaining scenario mappings
are checked. No microphone acceptance or complete human binding acceptance is
claimed.

Verification: the main suite passed 1,323 tests with one skip, the portal suite
passed 57 tests, and 10 focused coordinate checks passed. The deployed orange
Mapbox landing was visually checked in EN and DE with no browser errors; its
real-research layer truthfully contains zero pins. No broad real-market coverage
is claimed.

## 2026-09-19 — MCP and delegated OAuth implementation plan

Created [MCP_IMPLEMENTATION_PLAN.md](MCP_IMPLEMENTATION_PLAN.md) for a portable
RoomScout MCP interface using both Codefox OAuth Provider and Convex MCP Gateway.
The design preserves Convex Auth v2, account-level autonomy and first-party
approval, with explicit tools over shared domain helpers and existing Workpools.

Inspected the published component APIs and current backend seams. The first
implementation gate must prove that a delegated bearer reaches the gateway's
custom resolver without adding global OAuth trust. The plan also covers atomic
grant generations, indexed token lookup/cleanup, ownership and scope checks,
idempotency, asynchronous provenance and disconnect behavior.

Two bounded architecture reviews corrected routing, private-question scope and
search-adoption details. At that planning stage only documentation was changed; components were not
installed, functional tests were not run, and no deployment or provider contact
was performed. The implementation plan calls for focused functional checks,
not the full historical test suite.

Following the voice discussion, added the bounded
[hello-world companion](MCP_HELLO_WORLD_PLAN.md) and linked it from Phase 0.
It uses a separate minimal deployment, synthetic users, stock components and
one authenticated tool connected through ChatGPT. The result separates a
working client connection from authorization and revocation findings. Its
explicit stopping point is a report; component rewrites, real tools and changes
to existing deployments require a separate instruction. That step was planning
only; the subsequently authorized execution is recorded below.

### Isolated companion execution

Executed the companion in a separate sibling project and seven-day Convex
deployment `precise-chinchilla-292`. Stock Codefox OAuth Provider 0.4.2 and
Convex MCP Gateway 2.0.0 work with Auth 2.0.0-alpha.1: an actual ChatGPT
connection completed new-account signup, consent and PKCE, then invoked the
authenticated hello tool. No manual band onboarding was needed. The main
plan now reserves a scoped profile tool for later confirmed band details.

Standalone build/typecheck passed; the focused functional smoke passed 19/20
checks. The failing reconnect check, corroborated by the Gateway audit, showed
that a pre-revocation access token became usable after regrant. Recorded this
stock grant-existence limitation and disabled MCP access, verifying HTTP 503;
also revoked the actual ChatGPT synthetic account's grant. No component patch,
real RoomScout tool, provider contact or change to existing dev/prod was made.
The companion ends here with [execution results](MCP_HELLO_WORLD_RESULTS.md),
not an automatic continuation into production integration.

## 2026-09-20 — Isolated OAuth revocation follow-up

Implemented the separately authorized revocation fix in `roomscout-mcp-proof`.
A local Codefox 0.4.2 component extension binds codes/tokens to immutable grant
IDs, resolves exact hashed tokens, and rejects revoked generations after reconnect.
Published the OAuth revocation endpoint and discovery metadata. The proof account
can also revoke access directly. No existing RoomScout dev/prod runtime changed.

The narrow revocation smoke passed 21/21; typecheck/build and isolated deployment
passed. A freshly registered ChatGPT app called the endpoint on Trennen; the
server confirmed revocation and the account page showed no grant. An older app
produced no observed callback, possibly because of cached metadata. Earlier
immediate post-click observations were premature; the later callback is recorded
in the [updated report](MCP_HELLO_WORLD_RESULTS.md). The hello-only endpoint is
enabled again. No broad suite, production integration or provider contact ran.


## 2026-09-20 — Claude Code demo flow, provider replies and self-service reset

Backfilled the recent main-app and companion-portal commits. Their commit
messages credit Claude Fable 5.1 as co-author; these are Claude Code changes
alongside the Codex regression work recorded below. Dates here use UTC.
The September 19 bundle (`12e8190`) and browser Workpool cutover (`e2520b8`)
are already covered by the earlier entries.

Live voice now opens only once per session, avoids a queue label for ordinary
single-turn waiting, and keeps unanswered decisions visible after reload even
without an active call (`72799b8`). Demo buttons lead into sign-in and the real
Scout flow with disclosure; explicit budget and other search corrections update
active or paused searches. Candidate state reflects exclusions and availability,
and voice/card layouts are steadier (`b6c6a28`). Evidence:
`src/ui/chat/LiveVoiceChat.tsx`, `src/routes/musician/ScoutPage.tsx`,
`src/routes/public/LandingPage.tsx`, `convex/scout.ts`.

Band-owned equipment and urgency no longer become provider requirements or
unnecessary questions to the musician (`c43e3e1`). One offered date and time
is enough to proceed with a viewing choice (`9102edf`). Evidence:
`convex/lib/providerAssessment.ts`, `convex/decisions.ts`.

The companion portal now attempts one repair for a rejected simulated-provider
reply, then uses a neutral reply in the participant's locale instead of silently
dropping the turn (`6606bef`). Providers can agree to a musician-proposed viewing,
and three demo rooms support an immediate-start path (`c83c431`). Practical
parking and facility facts were added to those scenarios (`b44f982`). Canonical
price and scenario constraints still govern the replies. Evidence in
`roomscout-dev`: `convex/providerScenarioEngine.ts`,
`convex/simulatedProviderActions.ts`, `providerScenarios/berlin.ts`.

Settings gained a self-service reset that pauses the search and deletes the
owner's search, candidate, conversation, decision, voice, memory and Scout-thread
state in resumable pages, preserving the account, profile, portal registration,
mailbox and settings (`06df746`). The app requests a scoped portal reset before
local deletion (`9e4f28c`); the portal authenticates that request and removes the
participant's conversations and provider-agent state while keeping users and
listings (`9306cf1`). Portal cleanup failures are recorded without blocking the
local reset. Evidence: `convex/demoReset.ts`, `convex/lib/portalReset.ts`,
`src/routes/musician/LiveSettingsPage.tsx`; portal `convex/participantReset.ts`.

Commit-reported validation: the main demo-flow changes passed 195 tests across
12 files and both typechecks; the Settings reset passed 108 tests across nine
files and both typechecks; its portal-reset follow-up passed 10 integration
tests and backend typechecking. The companion portal reset commit reports
82 tests, TypeScript and ESLint passing. These are recorded historical results,
not tests rerun during this documentation update.

## 2026-09-21 — Conversational decisions and arranged viewings

Live voice announces an open Scout question once in the saved locale and accepts a natural-language
answer through the shared decision tool. Explicit delivery envelopes distinguish
results that should be spoken from silent updates; uncertain write outcomes
direct the musician to the panel instead of inviting a repeated send
(`ae878b9`). Messages requiring exact approval still use the panel.

Trusted listing location and computed distance avoid needless questions about
whether to ask for an address. Missing provider facts are the Scout's follow-up
work; musician questions concern actual choices (`d1a8156`). The companion
portal gives each Berlin provider a private precise-location fact to share on
request or for an agreed viewing, without changing public listing detail
(`4894c54`). The brief review card was also centered beneath its headline
(`16b35a5`). Evidence: `convex/lib/providerAssessment.ts`, `convex/decisions.ts`,
`convex/providerConversations.ts`, `convex/scoutRuntime.ts`,
`src/hooks/useGptLiveVoiceScout.ts`; portal `providerScenarios/berlin.ts`.

The latest main commit, `4e0bbc0`, makes an arranged viewing a durable outcome.
Provider assessment must cite the provider's own message with an explicit
agreed time; relative dates resolve against the current Berlin date. One
viewing is stored per conversation with owner/date and conversation indexes.
Candidate rows, room cards and conversation threads display the appointment,
and Scout can inspect upcoming viewings and answer schedule questions by voice.
Live congratulates once per viewing and avoids a duplicate generic reply
announcement. Retired rooms are not announced, and demo reset removes viewing
rows. Evidence: `convex/schema.ts`, `convex/providerConversations.ts`,
`convex/scoutCandidates.ts`, `src/features/viewings/formatViewing.ts`.

These commits credit Claude Fable 5.1 as co-author. Commit-reported validation:
the voice-decision work passed 259 tests across 14 files and both typechecks;
the provider-fact correction passed 98 tests across six files and backend
typechecking; the viewing milestone passed 277 backend tests across 18 files,
196 frontend tests across nine files, and both typechecks. These overlapping
historical runs are not a new aggregate test run. Arranged viewings do not
constitute a rental contract, payment, or completed binding acceptance.

## 2026-09-21 — Public-web discovery and landing research coverage

The current working tree extends source gathering into a bounded pipeline:
600 city-scoped queries across 150 German cities, named-venue resolution,
domain-level AI triage from saved search evidence, candidate promotion,
explicit source activation, and one-time page/detail ingestion. Search and
social hosts are filtered; restricted marketplaces carry a terms-review
marker. Scheduled batches retain their remaining query budget, and a persisted
stop flag prevents a running worker from scheduling another batch after stop.
Promotion creates paused targets, and ordinary activation keeps recurring
monitoring off unless it is explicitly requested.

The maintainer confirmed that Firecrawl gathered real public-room data for the
landing map. The local public snapshot records 496 indexed listings at
`2026-09-21T15:44:08Z`, with source-domain attribution and a separate city/pin
projection. This is a dated source artifact, not a fresh production count or
proof that every listing is still available. The snapshot query excludes demo
signals and applies placeholder and location checks; the suppression helper
preserves provenance and skips authored demo signals.

The demo candidate filter now checks `isDemo` while controlled-portal mode is
active. Real public-web results stay available to the map; seeded portal rooms
remain eligible for the controlled demo. The `Indexed fit` label describes a
match state and does not determine provenance. This replaces the older CLI
note's workaround of deactivating real Berlin sources for recording.

Evidence: `convex/sourceDiscoveryActions.ts`, `convex/sourcePipeline.ts`,
`convex/sourcePipelineActions.ts`, `convex/sourceTriage.ts`,
`convex/lib/sourceHostPolicy.ts`, `convex/lib/listingQuality.ts`,
`convex/matches.ts`, and `src/ui/landing/researchCoverageSnapshot.ts`.
These additions are uncommitted working-tree evidence. No new crawl,
production data query, or frontend deployment was performed for this log update.

## 2026-09-22 — Demo regression investigation

The September 19 inbox recovery handled an intermediate Firecrawl result with
one immediate read-back. Read-only live probing reproduced a successful
provider response containing an intermediate number before the original async
program had finished. The new runtime correlates each invocation with a unique
completion slot, waits with bounded read-only polls, and never replays the
original program to recover its result. Completed slots are cleaned in the next
program or when the session closes, preserving normal HTTP round-trip counts.
The component also preserves a complete native result when the marker line
has been truncated.

Inbox navigation now waits for terminal owned DOM state instead of interpreting
a streaming shell as a missing thread. A final authorization rejection before
click is an unsent failure with its safe error code; failures after that gate
remain uncertain. Portal/profile setup failures now project as needs-attention
instead of claiming a completed room assessment failed.

The existing public-room filter operates on demo provenance, independently of
the Indexed fit label. Added a mixed-source regression proving real rooms stay
on the landing map while only controlled-demo rooms reach demo candidates.
Sharing normalization now makes an open-to-sharing brief accept permanent and
shared rooms in every writer. Behavioral tests cover all three writers,
separate field updates, and the Scout-to-permanent-room matching path.

Validation: 172 tests in 16 focused files passed; application and explicit
Convex backend typechecks, scoped ESLint, and diff whitespace checks passed.
The patched runtime recovered the live early-result case through pending
states to a complete inbox result. The investigation performed no production
data repair or provider inquiry; the authorized deployment followed below.

### Authorized production deployment

At the user's request, deployed the tested backend changes to production
`fleet-jackal-83`. The dry run and final push passed schema validation and
backend typechecking, with no index deletions. The deployed
`firecrawlPortal:registrationPreflight` returned ready after a read-only
Firecrawl page inspection. A separate saved-profile inbox probe using the
deployed source recovered a real intermediate response into a complete batch
with no missing/failed threads. Both public app routes returned HTTP 200.

No static frontend deployment was needed for these backend fixes, and no
provider message was sent or retried. Existing unknown deliveries were not
replayed.

### Demo recorded and documentation handoff

After the deployment, the maintainer confirmed that the demo recording is
complete and requested no further code changes. Updated this build log and
`hackathon.md` to include the latest Claude Code commits, the public discovery
work, the deployed regression fixes, and the recorded-demo milestone. The
recording itself has not been inspected here, and no publication or hackathon
submission is claimed. This follow-up changes documentation only.
