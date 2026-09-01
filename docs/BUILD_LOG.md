# RoomScout — Build Log

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
recorded separate durable facts about Glass Teeth, Marc, mobility, rehearsal
times, equipment, and compatible room-sharing bands. A later turn correctly
recalled the band's genres, equipment, and schedule without the user repeating
them. Search activation now persists in Convex.

Added an event-based entity/fact memory, fact supersession and deletion,
versioned three-part context compression, and a user-visible memory ledger.
Added the external-assistant import flow: copy a privacy-aware prompt to
ChatGPT/Claude, paste its export, analyze it with the Gateway, review every
candidate, and confirm only selected facts. The raw export is not stored. A live
test extracted and reviewed 12 facts across Daniel and Glass Teeth, then rebuilt
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

Verification passed with Convex component discovery/codegen and a successful
development function upload, 192 application tests, 54 preserved/upstream and
extension Firecrawl tests, full TypeScript, ESLint, and the production Vite
build. These checks prove the component graph and application contracts; they
do not claim a live monitor run or AgentMail delivery round trip.
