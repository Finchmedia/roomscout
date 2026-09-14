# Hackathon log

## Latest: Autopilot policy, first production autopilot run, proven webhook chain

The per-search mandate is gone. Each musician has one Handlungsspielraum
(Autopilot by default, no daily limits) and one Freigabeprüfung decides every
outgoing action with a persisted outcome. The first production autopilot run
reached the demo listing without a human step. The AgentMail account had no
webhook for the Scout deployment; it exists now and a provider reply flows
webhook, sync and assessment in about ninety seconds. The Scout's own question
back to the musician (Entscheidung im Chat) is being built.

## Latest: autonomy settings fidelity

Restored the designed mode cards, permission rows, limit control and commitment
notice with actual mandate data and explicit draft/save behavior. Nine focused
tests and build passed; live browser appearance verified without changing any
standing permission.

## Latest: sources settings fidelity

Live sources now reuse the designed expandable rows with actual portal state,
mailbox copy and separate connection management. Per-search exclusions also
apply to existing-match visibility and new outreach under existing mandates.
Dev-only backend deployment and signed-in browser check completed; eight UI
and 23 backend focused tests passed. Global automatic source selection remains
read-only. No production rollout or external messages in this verification.

- **Project:** RoomScout
- **Event:** Convex All Gas Hackathon
- **What it does:** Indexes public rehearsal-room supply and demand and gives musicians a context-aware text/voice Scout that runs on Autopilot within a per-user Handlungsspielraum, checked by one Freigabeprüfung, with binding commitments left to the musician.
- **Live app:** https://fleet-jackal-83.eu-west-1.convex.site
- **Repo:** https://github.com/Finchmedia/roomscout
- **Frontend:** Convex static hosting
- **Convex deployment:** https://fleet-jackal-83.eu-west-1.convex.cloud
- **Components:** @convex-dev/agent, @convex-dev/auth, @convex-dev/static-hosting, @convex-dev/workpool, @agentmail/convex, local Firecrawl and Stagehand components
- **Convex features:** schema, tables, indexes, vector search, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries, paginated queries
- **Auth:** Convex Auth
- **AI models:** `openai/gpt-5.6-terra` through Convex AI Gateway, `text-embedding-3-small`, `gpt-realtime-2.1`
- **Started:** 2026-08-26T13:55:26Z
- **Last updated:** 2026-09-14T20:02:18Z

## Log

### 2026-09-10 — live Settings, operator and landing design integration

Three parallel Sol implementation slices connected the Claude Code UI port to
the live routes. Settings uses the sidebar panel with real profile, mailbox,
portal, memory and mandate operations. Operator uses the same ported panel
anatomy with role-gated data, explicit provider configuration checks and links
to existing operational tools. The public landing preserves the design and
separates the synthetic demonstration from real signup.

Unsupported billing, notification preferences and privacy self-service are
identified rather than simulated. Added profile-menu navigation, safe route
error recovery, auth/routing regressions and corrected legacy anchor colors
that hid primary button labels. No messages, approvals or account changes were
submitted during browser verification. See BUILD_LOG for validation details.

### 2026-09-10 — live Scout design integration and explicit brief readiness

Connected the Claude Code design primitives to the real Scout route, preserving
Convex conversations, voice sessions and exact user-approved offer acceptance.
The chat uses shadcn's message-scroller primitives with Markdown rendering,
history loading and a multiline composer. Active searches retain access to chat
and their brief without restoring the old diagnostic dashboard.

Text and voice now have an explicit draft-readiness tool: the current search
revision opens its brief for review; only the musician's activation click starts
Autopilot. Activity queries are scoped to the chosen search before applying their
result limit. Provider offers and confirmed acceptance take precedence over stale
outreach status. The acceptance dialog uses the design system and German copy
while retaining the existing snapshot, acknowledgement and send semantics.

Development backend and static frontend updated. Verification: 678 tests passed,
one opt-in test skipped; TypeScript, production build, scoped lint and diff check
passed. The hosted development route serves the new built assets. Browser inspection used the existing signed-in
session without sending a message or accepting an offer. This is UI integration
evidence, not another fresh-account end-to-end run. Settings, Inbox and operator
routes remain outside this first live design slice; their demo ports are not
substitutes for live data. Desktop and 390px mobile offer/chat views were checked.

### 2026-09-10 - first successful controlled end-to-end happy path

Completed the first user-observed band-to-landlord flow on the controlled portal:
conversational search, matching, browser outreach, provider replies, autonomous
follow-up questions, a fully assessed offer, and a final acceptance message
visible in the portal. This is a controlled demo, not a payment or signed contract.
Removed obstructive app-level throttles and shortened due inbox scheduling;
fixed match-assessment recovery and made current provider offers take precedence
over stale listing questions and old outreach status in the Scout UI.

The development frontend is deployed. Verification: 664 tests passed, one opt-in
test skipped, TypeScript and production build passed. This is the first completed
interactive run after fixes, not yet a repeatability claim for unattended fresh
runs. This checkpoint preserves the parallel Claude Code design-port work;
chat-UI simplification and further UI-port decisions remain for a separate review.
Detailed evidence and limitations: `docs/BUILD_LOG.md`.

### 2026-08-26 - de10b22
Defined RoomScout as a shared index of rehearsal-room supply and demand with
approval-gated outreach. Captured the initial product and architecture evidence
in `README.md`, `docs/PLAN.md`, and `docs/BUILD_LOG.md`.

### 2026-08-26 - 79b7e75
Selected React and Vite for a SPA on Convex static hosting, with Convex as the
realtime backend and OpenAI for in-product intelligence. Added repository-level
agent guidance and kept deployment outside the setup task (`AGENTS.md`,
`docs/PLAN.md`).

### 2026-08-28 - 31c9b82
Built and deployed the musician and operator SPA with Convex Auth, reactive
search and matching, a persistent Agent thread, structured memory with vector
search, approval-gated mail, Firecrawl ingestion, Mapbox views, and Realtime
voice. Added the tested Structured Outputs adapter workaround for
`openai/gpt-5.6-terra`; pilot sources remained paused and no live mail was sent
(`convex/convex.config.ts`, `convex/schema.ts`, `convex/scout.ts`, `src/`).

### 2026-08-31 - 6bb06a0
Added a source-intelligence registry, bounded Firecrawl discovery and Interact
flows, persistent Browserbase portal contexts, source preferences, external
action approvals, and revocable standing mandates. Automated writes remain
restricted to reviewed adapters and stop for credentials, CAPTCHAs, terms,
contracts, bookings, or payments (`convex/sourceIntelligence.ts`,
`convex/firecrawlInteract.ts`, `convex/browserbasePortal.ts`, `convex/mandates.ts`).

### 2026-08-31 - 91a8967
Added operator-visible provider readiness without exposing environment values.
Verified the public Bandnet contact-form contract read-only and recorded
Kleinanzeigen as unavailable for automation under its documented access policy
(`convex/integrations/providerReadiness.ts`, `scripts/verify-bandnet-form.mjs`,
`convex/migrations.ts`).

### 2026-08-31 - 31ef3aa
Recorded the production Realtime WebRTC proof: authenticated session setup,
synthetic microphone permission, real model connection, and clean teardown with
no raw-audio persistence. Hardened the documented Firecrawl webhook and
Realtime endpoint configuration while keeping native monitors disabled pending
reviewed activation (`docs/BUILD_LOG.md`).

### 2026-09-01 - be3ac9c
Replaced direct provider SDK calls with Components. AgentMail now owns durable
inbox transport, sending, status tracking, and signed webhook dispatch behind
RoomScout's exact-content approval gate. Vendored the complete official
Firecrawl component locally and added Native Monitoring plus Interact without
removing its durable crawl API. Deployed both Components and the SPA to
production; Health, Landing, and Explore returned HTTP 200
(`convex/convex.config.ts`, `convex/components/`, `convex/agentmailComponent.ts`).

### 2026-09-01 - 27dca06
Proved the deployed Firecrawl Component transport with one bounded, read-only
Bandnet Hamburg scrape: HTTP 200, 3,647 Markdown characters, 23 links, and one
credit. Deployed the separate controlled portal at `roomscout.dev` with Clerk,
its own Convex deployment, public listings, and auth-gated reactive message
threads. Then proved one bounded Native Monitor path against the first-party
controlled portal: one new page, webhook HTTP 204, a redacted published Signal
with evidence, and a duplicate replay producing no new entry. Added a
reproducible compatibility patch for the official AgentMail Component under
Convex 1.45; read-only Component access to the single scoped Inbox now succeeds
without creating or sending anything. This checkpoint does not claim a
Browserbase signup/message or AgentMail send/reply round trip. A narrowly scoped
production webhook is now configured, its signing secret was transferred
without disclosure, and unsigned requests return HTTP 401; per-user Inbox
creation still needs broader provider scope (`docs/BUILD_LOG.md`).

### 2026-09-02 - 2d23689
Added and deployed an internal proof runner that accepts only the first-party
`roomscout.dev` source and refuses to run beside an unrelated active source.
One bounded Production monitor check produced one redacted public Signal; a
replay produced zero new entries, all third-party sources remained paused, and
the monitor was paused again afterward. No message or browser action occurred
(`convex/controlledSourceProof.ts`,
`convex/controlledSourceProofActions.ts`, `docs/BUILD_LOG.md`).

### 2026-09-02 - bafc29e
Made non-binding Autopilot the simple search default, moved detailed mandate
controls into Advanced, and replaced the logo with a wordmark. Added portal
signup authentication checks and thread-aware browser message handling, with
authorization regressions. This records implemented paths, not a complete live
provider round trip (`convex/mandates.ts`, `convex/browserbasePortal.ts`, `src/`).

### 2026-09-08 - working tree
Fixed activation, paginated matching, and stale-result/first-contact guards.
Added shared Convex Agent turns, private versioned offers, controlled-portal
replies and exact receipt-based offer acceptance. Workpools coordinate semantic
checks and coalesced portal reads; email hints cannot authorize arbitrary browsing.
Duplicate browser claims return in-progress before launch (`convex/portalInboxSync.ts`,
`convex/offerAcceptance.ts`, `convex/browserbasePortal.ts`). Development backend is
deployed; its pod-wide AgentMail webhook has a verified signing secret. Two labelled
Development test actors now have distinct real personal inboxes; concurrent calls
and a repeated run reused them without duplicates. New-inbox event coverage and
the full mail/browser round trip remain open. Local checkpoint: 397 tests,
TypeScript, lint/build and five browser smokes passed (one intentional skip).
Two six-case native Gateway runs each passed five cases: tightening the per-person
price rule fixed that failure; a targeted repeat identified the extras failure as
an ungrounded price quote. Evalite's framework smoke and isolated fifteen-case
catalogue pass tests, but the real Agent evaluation is unfinished.
Browserbase launch is now proven: externalizing Stagehand preserves its required
extension asset, and `proxies: false` fixes a provider HTTP 402 caused by the prior
no-proxy array. A read-only signup probe then identified missing Stagehand v4
context initialization; that fix is locally tested, not yet live-proven.
The real-Agent Evalite spike now reaches Terra and records an offer assessment;
its first-turn readiness criteria fail, so no benchmark pass is claimed.
The controlled portal's run-scoped provider simulator
shares the UI message/Resend path and passes 15 local portal tests, typechecks,
lint and build; that portal change is not deployed yet.
Production is unchanged. Details and remaining gates: `docs/BUILD_LOG.md`.

### 2026-09-09 - working tree
Ported the supplied interactive design into the real React app: voice-first Scout,
live fact cards, brief review, settings, operator styling and a labelled landing
story (`src/routes/musician/ScoutPage.tsx`, `src/components/landing/`). Existing
Convex subscriptions and mandate/acceptance boundaries remain authoritative.
Voice survives authenticated route changes; transcript ordering, cancellation and
stale tool results have regression coverage. Local test/build and public-browser
checks are recorded in `docs/UI_DESIGN_PORT_2026-09-09.md`; authenticated visual and
live provider verification remain open. No deployment, commit or push occurred.

Subsequently mounted a local MIT-derived Stagehand REST component, retaining
RoomScout's authorization and send ledger. Fixed Zod 4 JSON Schema transport
across Convex boundaries and added deterministic DOM receipt checks
(`convex/components/stagehandRoomScout/`, `convex/browserbasePortal.ts`).
The Development component passes live navigation, extraction, observation and
exact variable-backed form filling; the prop portal's reviewed demo-terms gate
is deployed and live-tested. Signup was not submitted. Local checks pass 522 tests,
build, backend typecheck and scoped lint; unrelated UI lint findings remain.
Registration and the mail/browser round trip remain pending shared acceptance.
Details, test evidence and remaining gates: `docs/BROWSERBASE_COMPONENT_MIGRATION.md`.

### 2026-09-09 - deployable band acceptance flow

The complete test path is deployed to production: readable personal AgentMail
inboxes at signup, automatic controlled `roomscout.dev` connection bootstrap,
radius-based matching, global public-source monitoring and idempotent portal
account registration from an explicitly scoped autopilot mandate. Outreach waits
for an active portal connection. Production data migration and source/monitor
reconciliation completed; the hosted frontend returns the current production
asset manifest. Local and deployment checks pass 581 tests, TypeScript and build.
The remaining item is user-driven acceptance with a fresh band account,
including provider OTP, first portal message and landlord reply.

### 2026-09-10 - working tree
Replaced the controlled portal's hosted REST execution with actual Stagehand v4
Node actions; the local component retains session metadata only. Form fields
are validated and read back together before submission. Both backend deployments,
622 tests, TypeScript, build and scoped lint pass. Provider quota exhaustion was
confirmed; after capacity was restored, real v4 read and exact-fill form smokes
passed. Added owner-initiated, once-per-day failed-start recovery and readable
cooldowns. Live signup and the message round trip remain unproven
(`docs/BROWSERBASE_COMPONENT_MIGRATION.md`).

### 2026-09-10 — Account settings UI

Implemented the billing and privacy design layouts in the live settings routes.
Unavailable actions are visibly disabled; real navigation remains available.
No invented usage figures, payment integration or account deletion. Twelve
focused tests, scoped lint and frontend build pass; local change only.

### 2026-09-10 — Operator UI alignment

Aligned the live operator UI with the design reference across six sections.
Real data remains operator-gated; unknown states and unavailable controls are
explicit. Existing advanced tools remain accessible. Visual comparison used an
isolated fixture, not an authenticated admin session. All 27 focused tests,
frontend build and scoped lint pass. Working-tree changes only; no deployment
or role changes.

### 2026-09-11 — Release verification

Verified the combined Scout, settings, landing and operator UI changes with the
backend compatibility updates: 753 tests pass, one opt-in test is skipped.
The earlier worker-start timeouts did not recur with two workers. Frontend build
passes. Full-repository lint still reports pre-existing browser-script globals;
these scripts are unchanged. Public-facing architecture and migration docs were
sanitized before release. Production rollout follows this checkpoint.

### 2026-09-11 — c2e802a production release

Pushed the combined UI and backend release to the ui-port branch. Deployed
Convex functions and the production-built SPA through Convex Static Hosting.
Hosted landing, Scout, settings and operator routes return the current build;
referenced entry assets are available. App/backend lint passes. This HTTP smoke
does not replace authenticated operator checks or a fresh-band end-to-end run.

### 2026-09-11 — working tree: exclusive portal-engine decision

Decided to evaluate Firecrawl as an alternative portal browser engine, motivated
by its sponsor role. Each deployment selects Firecrawl OR Browserbase for the
controlled portal; no automatic provider fallback or mixed browser flow.
Firecrawl must prove registration, persisted login, outbound evidence and reply
import end to end before activation. If it cannot, retain Browserbase as the
selected engine. AgentMail remains the email provider. Three Sol subagents have
locally integrated provider selection, registration, profile proof, messaging,
inbox reads and maintenance guards. Combined verification passes 835 tests with
one skipped; build and app/backend lint pass. Cleanup/reconciliation fixes are
locally verified; live acceptance remains open. A code-generation command attempted a dev upload;
a subsequent read-only function listing showed no new portal-engine functions.
No provider switch or live message was performed; this is not a proven live release.

### 2026-09-13 — e7a0cee manual-test rollout

Pushed the exclusive portal engine to ui-port and deployed backend and frontend
to dev and production at the maintainer's request. Both select Firecrawl without
fallback. Reverified 835 tests, build and app/backend lint. Backed up and reset
app and component data, including authentication, chat and queues; post-reset
exports show 132 non-hosting tables empty in each environment. The separate
controlled portal and external provider accounts were not changed. Live
registration and message round-trip acceptance remain for the manual test.

### 2026-09-13 — working tree: portal runtime selection correction

The manual test exposed a stale Node environment reference: Browserbase ran
while the database labelled the registration Firecrawl. Read the selector at
invocation time and explicitly pin Browserbase reservations and attachments.
Authentication completion now requires fresh profile proof; unverified runs offer
profile recovery and return to current settings. All 843 tests pass, with one
skipped; build and app/backend lint pass. Dev runtime selection confirms Firecrawl.
Existing provider sessions are not transferable; this is not a live Firecrawl
registration or message round-trip proof.

### 2026-09-13 — 255a820 runtime fix rollout

Pushed the fix and deployed functions and frontend to dev and production.
Both live Node probes select Firecrawl; hosted bundles point to their matching
backend and contain the recovery UI. Retried a failed production asset upload
successfully. The maintainer will test with a fresh band; existing accounts and
data remain unchanged, and no registration or message was sent during rollout.

### 2026-09-13 — 5e12b5f Firecrawl registration diagnostics and progress

Confirmed automatic registration was scheduled during the manual test. Fresh
uncached browser sessions, bounded read-only retries and idempotent cleanup now
address session lifecycle failures. Live preflight isolated an additional result
decoding mismatch; structured output handling is being verified independently of
signup. Sources expose persisted registration and verification phases, and OTP
errors terminate the run rather than leaving it running. Final verification: 865
tests passed, one skipped; build and lint passed. Dev and production functions
and progress UI are deployed; production preflight returned ready/sign_up using
the final unchanged source. No new account or message was created by these
diagnostics; complete registration acceptance remains open.

### 2026-09-14 — d2a0356 Firecrawl rate limits and automatic source check

Activating a search now schedules an automatic check of the controlled demo
portal with a fifteen-minute cooldown, skipped when the portal is unconfigured
or a browser run is busy, so the Scout no longer waits for an operator click or
the hourly poll. Firecrawl rate-limit responses are surfaced as typed errors
with their retry hint instead of anonymous transport failures, and idle
Interact sessions are cleaned up after such failures. Convex features:
scheduled functions, internal mutations, internal actions
(`convex/demoSourceChecks.ts`, `convex/firecrawlPortal.ts`,
`convex/integrations/firecrawlPortalRuntime.ts`,
`convex/components/firecrawlRoomScout/api.ts`).

### 2026-09-14 — 14804cf Autopilot policy: Handlungsspielraum, Freigabeprüfung, production run

Groups 4fe7225 through 14804cf on branch autopilot-policy. Replaced the
per-search mandate with a per-user Handlungsspielraum (`scoutAutonomy`: mode,
contact, viewings, publishAd, shareProfile, sharePrivate; versioned and hashed)
and one Freigabeprüfung that returns proceed, wait, ask_user or stop with a
reason for every outgoing action. The outcome is persisted on the request and a
single `recordOutcome` writes approvals, audit events and follow-up scheduling.
Autopilot has no daily limits; only binding commitments stay with the musician
(ADR 0001 and 0002, glossary in `CONTEXT.md`). The message-safety review
learned that the search area is not the musician's private data.

Deployed to production and dev the same evening after clearing three tables of
the day's manual-test rows with the maintainer's consent. The first production
autopilot run went opportunity, assessment, gate proceed, Firecrawl write and
portal thread in about seventy seconds. Matching now recreates a missing
opportunity for a still-current match. The roomscout.dev portal (separate
project) received the AgentMail component env mapping so its provider-reply
notifications reach the Scout again.

The slow reply loop had one cause: the AgentMail account had webhooks for the
portal deployments only and none for the Scout's production site. An internal
action now creates or reuses the pod-scoped account webhook, the notification
hint tolerates AgentMail's plain-text footer, the inbox sync retries the first
Interact call, the controlled portal is polled every five minutes as fallback
and the Scout surface shows a Zwischenstand card until an offer is ready. Chain
proven at 18:04Z: provider reply in the portal, webhook event on the Scout
deployment within 25 seconds, import and assessment within about ninety
seconds. The assessment then chose ask_musician, which today reaches nobody;
candidate B (Entscheidung im Chat) closes that gap next. Convex features:
schema, indexes, mutations, internal actions, scheduled functions, HTTP actions
(`convex/schema.ts`, `convex/lib/autonomy.ts`, `convex/lib/autonomyGate.ts`,
`convex/autonomyGate.ts`, `convex/externalActions.ts`,
`convex/scoutOrchestrator.ts`, `convex/agentmailComponent.ts`,
`convex/portalNotifications.ts`, `convex/matches.ts`,
`src/ui/settings/pages/AutonomyPage.tsx`).

### 2026-09-14 — 2cfe436 Entscheidung im Chat

The Scout's questions to the musician now exist as data instead of dead ends.
A `decisions` table holds one open Entscheidung per provider conversation
(message review, private data, binding content, unsupported claims, safety
unavailable, the Scout's own question, offer ready, portal human step); the
Freigabeprüfung, the provider assessment and portal registration raise them,
and a newer one supersedes the older. For ask_musician the Scout formulates the
question in one model round inside the musician's chat thread and records it
through a tool. The Scout chat renders the open decision as a card with buttons
and free text: yes sends the exact message immediately, no rejects and asks what
should change, own text becomes a human-drafted request the gate treats as
user-approved. Answers to a Scout question are stored as trusted musician
statements in a new provider-turn kind and re-run the assessment, so the next
provider message follows without a human step. Chat and voice gained the tools
to answer a decision or dictate a provider reply; the inbox activity panel lost
its approval buttons. Full suite green (979 tests). Not yet deployed. Convex
features: schema, indexes, queries, mutations, internal actions, scheduled
functions (`convex/schema.ts`, `convex/decisions.ts`, `convex/lib/decisions.ts`,
`convex/autonomyGate.ts`, `convex/providerConversations.ts`,
`convex/providerActions.ts`, `convex/scout.ts`, `convex/voice.ts`,
`src/components/scout/DecisionCard.tsx`, `src/ui/chat/ScoutChat.tsx`).

### 2026-09-14 — 8fc8e2c Nachrichten in the settings panel chrome

The musician inbox is its own menu item again, rebuilt as a two-column panel
in the same chrome as the settings: conversation rows on the left with a
preview, time and unread dot, the provider thread on the right, a composer at
the bottom. One deep module, `convex/conversations.ts`, hides the mail and
portal channels behind four functions (list, thread, reply, mark read) and
derives its validators from the schema; the thread merges provider messages,
the Scout's and the musician's sent messages (attributed through the execution
ledger), pending requests with their gate status, assessment notes, the
musician's answers and decisions in one chronological list. The musician's own
reply goes through the same Freigabeprüfung as the Scout's and is never shown
as sent before the message exists. The legacy three-pane page, its four
only-there components and their dead CSS are gone. Full suite green (1000
tests), Vite build green. Convex features: schema, indexes, queries, mutations,
realtime queries (`convex/conversations.ts`, `convex/schema.ts`,
`convex/providerActions.ts`, `src/routes/musician/LiveInboxPage.tsx`,
`src/ui/inbox/ConversationThread.tsx`, `src/ui/chrome/PanelDialog.tsx`,
`src/ui/chat/ChatComposer.tsx`).
