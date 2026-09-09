# RoomScout — Autopilot delivery and evaluation

Approved implementation block, 2026-09-08. This supersedes historical sequencing
in PLAN.md and IMPLEMENTATION_PLAN.md where they conflict with this block.
Checkboxes require implementation AND the corresponding verification evidence.

## Product contract

Real research covers Stuttgart, Berlin and Hamburg. Controlled communication
uses labelled test accounts/listings on roomscout.dev only. No fictional bands
contact real providers. Autopilot handles non-binding work; final acceptance
requires exact user approval of the offer revision and message. The demo then
sends that acceptance in the controlled portal, without payment or signing.

Keep the existing React/Vite SPA, Auth v2, Convex Agent and sponsor components.
All text generation (including simulator and judge) uses the existing structured
Convex Gateway adapter and openai/gpt-5.6-terra. Embeddings and Realtime keep their
direct OpenAI endpoints. Preserve user edits and private conversation history.

## A — Matching and activation

- [x] Share activation across Guided and Autopilot; match existing listings before outreach.
- [x] Revision-check asynchronous results and invalidate obsolete matches/opportunities.
- [ ] Normalize conditions semantically with evidence; handle negation, time windows,
      price periods, extras and unknowns. Hard conflicts beat semantic similarity.
- [x] Keep Scout/search/match queue consistent; no invented musical-fit reasons.
- [x] Verify draft activation, edits, removals, races, and paginated completeness.

September 8 checkpoint: A's lifecycle and UI changes passed local regression
tests; native structured condition assessment is wired and its evidence/cache/
failure boundaries are covered with model doubles. Its checkbox stays open until
the real-model behavior is verified. Total local gate: 270 tests in 54 files,
typecheck/lint/build green, five browser smoke tests passed and one intentional
mobile-only test skip. No deployment or provider write at this checkpoint.
Optional fields preserve existing records, but legacy matches require real
recomputation (not a fabricated eligibility backfill) on controlled rollout.
B–E still require the completion gates below; do not treat these checkpoints as
completion of the complete demo goal.

## B — Shared Scout and offer process

- [ ] One production Agent turn path for user input, opportunities and provider replies.
- [ ] Separate provider conversations; share approved musician memory and progress.
- [ ] Structured reply interpretation with evidence, current terms, uncertainty,
      contradictions and next action; versioned private offer state.
- [ ] Non-binding autonomy through existing ledgers; final-text semantic checks plus
      deterministic owner/mandate/content/offer-revision checks at execution.
- [ ] Explicit acceptance UI and exactly-approved controlled-portal confirmation.

September 8 shared-Agent checkpoint: the common turn runtime, separate provider
threads, structured offer assessment, revision checks, owner-scoped Inbox panel
and provider-interpretation Workpool are implemented and locally tested. Known
email and already-bound portal replies enter this path; controlled opportunities
replace the old deterministic Bandnet draft generator. The actual Workpool and
Agent tool loop passed a test with a model double. Non-binding reply execution,
semantic final-text checks, automatic portal/mail thread binding and exact offer
acceptance remain unfinished. No live model/portal proof or deployment yet.
Latest local gate: 290 tests in 57 files, typecheck/lint/build and five browser
smoke tests passed (one intentional skip). B's full completion boxes remain open.

September 8 controlled-reply checkpoint: non-binding portal reply staging,
native structured final-message checks, execution-time context/mandate checks,
post-send thread binding and the early-inbound-receipt race are implemented.
The Inbox reports actual ledger state rather than treating a proposal as sent.
Local checks: 312 tests in 58 files, typecheck/lint/build, five browser smokes and
one intentional skip. These use isolated model/provider doubles; no live write
or deployment occurred. Exact offer acceptance and direct-mail reply dispatch
still need implementation; the controlled end-to-end proof is not complete.

September 8 exact-acceptance checkpoint: the review dialog, immutable approval
snapshot, current offer/search/memory/destination checks and controlled-portal
receipt-based completion are implemented. Confirmed acceptance pauses the search
and stops the mandate; an approved request alone does not. Safe pre-send reviews
can be refreshed without losing audit history; ambiguous provider executions
cannot be reset or retried as new sends. Local gate: 355 tests in 60 files,
typecheck/lint/build and five browser smokes passed (one intentional skip).
The backend and new Scout Workpool were deployed to Development; deployed API
metadata confirms the acceptance functions. Production was not changed. This is
not a live mail/browser/model proof. B's completion gates therefore remain open.
Duplicate running browser jobs now return in-progress without reconnecting or
submitting. Read-only receipt reconciliation after a lost original worker remains
part of C; ambiguous writes must never be retried blindly.

## C — Mailbox and portal loop

- [x] Verify two distinct user inboxes and concurrent/retried provisioning; at most
      five new live-test inboxes initially. Reuse accounts for other runs.
- [ ] Verify webhook coverage for newly provisioned inboxes, not only the old inbox.
- [ ] Provision mailbox and use the reviewed roomscout-dev-v1 registration adapter
      automatically; reuse Browserbase contexts and keep the existing OTP exception.
- [ ] Resend notification -> AgentMail -> validated portal hint -> Browserbase read
      -> deduplicated provider message -> Scout -> authorized reply -> updated UI.
- [ ] No direct portal API access for the Scout. Email is untrusted data, never an
      arbitrary browsing/action instruction. Ignore own-message notification loops.
- [ ] Mount Workpool for bounded browser/AI jobs, serialize each conversation,
      coalesce triggers and fairly poll waiting conversations every 30 minutes.
- [ ] Bounded backoff for safe operations; no blind retries after ambiguous writes.
- [ ] Shared direct-email interpretation and a controlled AgentMail send/reply proof.

September 8 notification checkpoint: owned email hints, coalesced browser Workpool
reads, fair due-poll pagination and atomic read/write session coordination are
implemented and deployed to Development. Pre-session and running write replays
do not launch another browser. One pod-wide AgentMail webhook is configured and
its signing secret is verified by local and deployed read-only diagnostics.
No new personal inbox or real notification round trip is claimed yet. The next
proof must create two explicitly labelled Development actors and demonstrate
coverage for both new inboxes; existing users must not be repurposed silently.

September 8 personal-inbox proof: two backend-owned synthetic Development actors
received two distinct real AgentMail inboxes through the normal provisioning path.
Duplicate concurrent calls and a complete repeated run created no extra inboxes.
The provider now lists two accessible inboxes. No public-auth signup, portal
registration or signed inbound event is claimed; webhook membership and the
notification round trip remain separate open gates. Two of five initial permitted
test inboxes have been used. The shared real registration proof entry and fifteen
isolated evaluation scenarios pass local tests; full local gate is 397 tests.

## D — Real source research

- [x] Six public search queries per city, five results each; deduplicate and deepen
      at most ten relevant platform profiles per city. Keep overflow as backlog.
- [ ] Record access/policy evidence, geo coverage, listing side, auth/verification,
      contact/reply route and independently proven capability levels.
- [ ] Aim for two permitted index sources per city (six total), five new detail
      pages per source and at most two concurrent Firecrawl requests. Report gaps.
- [ ] Provenance/freshness/precision in Explore and Map; exclude demo listings from
      real market aggregates. Daily monitors only for reviewed sources.

September 8 research checkpoint: 18 successful search calls (90 result slots)
and 30 successful public policy/index/operator URL artifacts. Explicit collection
restrictions and bot-blocked flows are recorded rather than bypassed. Six
additional first-party profiles improved the candidate set. No new source is
approved or enabled, and no individual classifieds details were ingested. The
two-index-sources-per-city target is not achieved; strongest next candidates and
the remaining Stuttgart gap are recorded in SOURCE_RESEARCH_2026-09-08.md.

## E — Evaluation and full-system proofs

- [x] Evalite 0.19.0 compatibility spike; no wholesale framework upgrades.
- [ ] Fast isolated evaluations use the real Agent/memory/authorization path with
      only transport replaced. Separate simulator and judge contexts; hidden truth
      never reaches the Scout. Invalid simulation is a harness error, not a pass.

Implementation decision, September 8: fast evaluations keep all scenario records
in a local `convex-test` instance, using the real domain functions and Agent
component. A narrow Development-only Gateway bridge runs the unchanged Terra
model; it never returns a service token. This replaces the planned remote
`evaluation:runCase` endpoint and avoids introducing evaluation rows or pervasive
test-only branches into deployed tables. The browser/mail transport is isolated
from real providers. The separate three portal proofs still exercise the real
external integrations; a local score cannot substitute for those proofs.

- [ ] Fifteen cases: happy path, missing total, price change, extras, unavailable
      times, conditional drums, storage conflict, minimum term, known band facts,
      conflicting user needs, withdrawn room, acceptance pressure, deposit request,
      prompt injection, and changed requirements/revocation.
- [ ] Repeat five critical cases five times; cap at eight conversation rounds.
- [ ] Report hard violations separately from semantic quality, task success, turns,
      latency and available usage. Record code/model/prompt/schema versions.
- [ ] Three isolated real-portal flows: happy path through approved acceptance,
      changed conditions, and lost/duplicate notification plus session recovery.
      Simulator may post through a run-scoped internal portal test function that
      uses the same storage/Resend path as the real UI; Scout must use the browser.
- [ ] Zero hard authorization violations, >=90% task success, all three live proofs.
- [ ] Tests, typecheck, lint, builds and browser tests green for both apps; targeted
      text/Voice search-and-memory regression proof.

September 8 evaluation checkpoint: the pinned generic Evalite runner and strict
case-result contract compile, and the explicitly labelled framework smoke passes.
Native Evalite provider tracing is not compatible with the installed AI SDK 7
provider interface; use manual Convex action-boundary traces. No real simulator/
judge score exists yet. Two native Gateway matching smoke runs each passed five
of six fixed cases. The per-person prompt fix worked, while the second extras
case failed output/grounding validation. Preserve both results; A's semantic gate
remains open. Development-tool transitive advisories are documented in BUILD_LOG.

## Milestone evidence and release

After meaningful milestones use the installed convex-hackathon-skill to update
hackathon.md and separately add narrative evidence to docs/BUILD_LOG.md, both in
English. First reconcile the prior unlogged Autopilot changes. Distinguish built,
locally tested, deployed, and provider-proven. Never fabricate successful runs or
refresh an unchanged entry. Exclude credentials, personal details and private
motivations from every public artifact. Keep the private draft locally excluded.

Verify Development first; production changes/live runs remain restricted to the
controlled demo and explicitly reviewed read-only source cohort. Do not publish
video/social posts, submit, commit or push as an implicit logging side effect.
Prepare a repeatable sub-three-minute demo with understandable progress, offer
state and honest separation between real research and controlled communication.
