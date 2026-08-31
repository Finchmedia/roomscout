# Hackathon log

- **Project:** RoomScout
- **Event:** Convex All Gas Hackathon
- **What it does:** Builds a continuously updated index of public rehearsal-room supply and demand so musicians can search current listings, work with a context-aware text/voice Scout, and approve follow-up communication.
- **Live app:** https://fleet-jackal-83.eu-west-1.convex.site
- **Repo:** https://github.com/Finchmedia/roomscout
- **Frontend:** React + Vite SPA prepared for Convex Static Hosting
- **Convex deployment:** Development and Production active; SPA on Convex Static Hosting
- **Components:** Auth v2 Alpha, Agent, Static Hosting, Password, Username, Rate Limiter
- **Convex features:** schema, indexed queries, mutations, actions, HTTP actions, scheduler, cron jobs, reactive subscriptions
- **Auth:** Convex Auth v2 Alpha, Username + Password
- **AI models:** OpenAI `gpt-5.6-terra` through Convex AI Gateway; `text-embedding-3-small` semantic retrieval and `gpt-realtime-2.1` voice through direct OpenAI endpoints
- **Started:** 2026-08-26T13:55:26Z
- **Last updated:** 2026-08-31T00:00:00Z

## Log

### 2026-08-26 - 79b7e75
Defined RoomScout's shared rehearsal-room directory and two-tier studio outreach
flow. Documented the planned Convex, Firecrawl, AgentMail, and OpenAI architecture,
selected Convex static hosting, and added project guidance (`README.md`,
`docs/PLAN.md`, `docs/BUILD_LOG.md`, `AGENTS.md`).

### 2026-08-27 - working tree
Expanded the leading product hypothesis into a continuously updated public
supply-and-demand index instead of per-search crawling. Planned Firecrawl
page/site/web monitoring feeding idempotent Convex ingestion, OpenAI
normalization and deduplication, and approval-gated AgentMail actions. Added
source-policy boundaries and a phased implementation plan with exit gates; no
application code or Convex features exist yet (`docs/PRODUCT_EXPLORATION.md`,
`docs/IMPLEMENTATION_PLAN.md`, `docs/PLAN.md`, `README.md`, `AGENTS.md`).

### 2026-08-27 - working tree
Scaffolded the React/Vite application, ported the RoomScout-only Claude Design
surfaces into responsive components, and connected real Convex Auth v2
Username/Password flows with protected musician/operator routes. Added the
Convex Agent and Static Hosting components, indexed signal and saved-need APIs,
three focused Scout Case Card modes, exact versioned outreach approvals,
idempotent AgentMail send/reply handling, and Svix webhook verification.

Implemented scheduled Firecrawl `changeTracking` scrapes, idempotent ingestion,
OpenAI structured normalization, and signal freshness transitions. Validated
Convex locally plus TypeScript, ESLint, seven unit tests, production build, five
desktop/mobile browser checks, and a live Auth session smoke test. No provider
call or production deployment was made because credentials are not configured.

### 2026-08-27 - cloud Development deployment
Linked the scaffold to the RoomScout cloud Development deployment and generated
deployment-specific Convex Auth v2 RS256 signing keys through the official Auth
CLI. The complete component graph, schema, functions, cron jobs, and HTTP routes
then passed `npx convex dev --once` against the cloud deployment. Verified the
deployed `/api/health` HTTP action successfully. Auth keys remain in the Convex
deployment environment and were not written to the repository. Production and
the static frontend remain undeployed.

### 2026-08-28 - Convex AI Gateway
Migrated every implemented LLM path—Scout Agent generation and tools,
Firecrawl-result normalization, and inbound-email parsing—from a direct OpenAI
provider key to the Convex AI Gateway using `openai/gpt-5.6-terra`. Removed the
direct OpenAI SDK dependency and provider environment variables. Verified the
Gateway against the cloud Development deployment with a temporary smoke action;
the model returned the expected sentinel response. The test action was removed
and the cleaned function set was pushed afterward.

### 2026-08-28 - Persistent Room Scout memory
Connected the musician-facing Scout to its real Convex Agent thread and reactive
saved search. Added flexible entity/fact memory with verification, confidence,
sensitivity, supersession, deletion, event history, and versioned working-context
compression. Added a reviewed ChatGPT/Claude context-import flow whose raw input
is never persisted, plus a Profile UI for inspecting and forgetting memories.

Live German-language tests proved search extraction, five conversational facts,
a 12-fact reviewed import, context compression, durable follow-up recall, and
search activation. Implemented owner-filtered `text-embedding-3-small` vector
retrieval; at this checkpoint the code degraded safely because the Development
deployment did not yet have `OPENAI_API_KEY`. Gateway-native `Output.object`
formatting initially returned a provider error, so structured Gateway tasks
temporarily used explicit JSON plus strict Zod validation. Passed cloud push,
TypeScript, ESLint, 20 unit tests, build, and five Playwright checks; no
production deployment or external message was made.

### 2026-08-28 - Structured Outputs adapter investigation
Converted an opaque AI Gateway error into a reproducible adapter finding while
building the real Scout. The official Convex AI SDK adapter and an instrumented
copy without capability metadata both sent only `json_object`, dropped the
requested schema, and returned HTTP 400. The same schema succeeded when sent
directly to the Gateway. Adding exactly
`supportsStructuredOutputs: true` to the otherwise identical local adapter made
AI SDK send native strict `json_schema`; both a minimal schema and a
RoomScout-shaped schema succeeded without warnings.

Integrated that narrow workaround into RoomScout and replaced prompt-generated
JSON with native `Output.object` plus application-side Zod validation for
Firecrawl normalization, inbound-reply parsing, memory compression, and context
imports. A further cloud test revealed that OpenAI strict schemas require every
property, so optional AI fields are now required-but-nullable and converted to
omitted Convex values after validation. Finally, verified the newly configured
OpenAI embeddings key with a real 512-dimensional `text-embedding-3-small`
response. The probe exposed no secret and was deleted after the test.

### 2026-08-28 - YOLO vertical architecture and live deployment
Implemented Firecrawl Native Monitor synchronization and webhooks, multi-entry
index extraction, bounded detail processing, two-snapshot stale safeguards, PII
redaction, matching, geocoding, notifications, and reconciliation. Stuttgart,
Berlin, and Hamburg pilot sources remain paused in `reviewing`; monitor creation
is disabled unless `FIRECRAWL_MONITORS_ENABLED=true`. No broad crawl was run.

Added one deterministic AgentMail inbox per user, lazy/idempotent provisioning,
delivery and reply event handling, send recovery, and daily rate limits. Exact
recipient/content approval remains mandatory, and no live mailbox or message was
created in this pass.

Added an authenticated OpenAI Realtime WebRTC session endpoint using
`gpt-realtime-2.1`, shared Scout tools/memory, transcript deduplication, and a
RoomScout-orange voice UI; audio is never stored and Voice cannot approve or send
mail. Added cached Mapbox geocoding and adapted the maintainer-owned Jumper globe
interaction for RoomScout aggregate areas and precision-labelled signal pins.
Translation remains deferred. Controlled monitor, mail round-trip, deployed
voice, and deployed map proofs are still outstanding.

Wired productive musician and operator surfaces to real Convex data, completed
the Realtime function-tool loop and shared transcript persistence, added private
contact candidates plus open-ended musical facets to ingestion, and clustered
the precision-labelled Mapbox view. Passed 43 unit tests, TypeScript, ESLint,
production build, and five desktop/mobile browser flows. Generated separate
Production Auth v2 keys and deployed backend plus SPA to
https://fleet-jackal-83.eu-west-1.convex.site. Live Landing, Sign-up, and Health
smokes pass without console errors. Four pilot sources are seeded but remain
paused in `reviewing`, so no crawl or external send occurred.

### 2026-08-31 - Source Intelligence and portal autopilot foundation

Expanded RoomScout from a four-source index into a policy-aware source
intelligence system. A bounded Germany query matrix can discover portal
candidates with Firecrawl Search; Convex stores canonical platforms, geographic
coverage, facts, adapters, checkpoints, policies, probe runs, and per-search
source preferences. This pass seeded only conservative pilot coverage and did
not launch a broad crawl.

Implemented two honest interaction paths. Firecrawl Interact fills an approved
public contact form and exposes an ephemeral preview for the user to submit.
Browserbase uses a separate persistent Context for each user/portal pair, with
short-lived Sessions for human login, reauthentication, read-only recon, and
bounded platform-Inbox sync. RoomScout stores neither credentials/cookies nor
Live View URLs, DOM snapshots, screenshots, recordings, or CAPTCHA solutions.

Added versioned Research/Outreach/Negotiation standing mandates, an immediate
kill switch, immutable action payload approvals, idempotent execution records,
unified email/platform conversations, opportunities, and handoffs. Platform,
action, personal-data, contact/browser, price, expiry, source-policy, complaint,
and connection limits are rechecked. Contracts, terms acceptance, bookings,
payments, deposits, passwords, 2FA, and CAPTCHAs always stop for the user.

The implementation used no live Browserbase or Firecrawl credential and made no
provider call. The pasted Browserbase key was considered compromised and must be
rotated before a controlled provider proof.

All 80 unit/integration tests, TypeScript, ESLint, production build, and five
Desktop/Mobile Playwright flows passed. The backend and SPA were deployed to the
existing Convex production URL. Health, Landing, SPA fallback, and Explore
returned 200 without browser console errors; conservative pilot source coverage
was seeded in Development and Production.

### 2026-08-31 - Approved provider execution and portal connection UX

Completed the guarded write layer. Firecrawl Interact can now execute the exact
approved Bandnet public-form workflow when its current policy permits it, while
CAPTCHA or ambiguous completion pauses for a user-controlled Live View. Added a
Browserbase write executor that accepts only reviewed code-owned adapters and a
separate persistent Context per user/portal; real authenticated portals remain
fail-closed until their concrete adapters are reviewed. Portal login,
reauthentication, pause/sync/disable, AgentMail registration address, and private
verification-message handling are now visible in the musician UI.

Added read-only source probes and a bounded standing-mandate orchestrator. The
orchestrator handles at most one eligible Bandnet supply contact per owner/run
and repeats owner, payload-hash, policy, adapter, mailbox, mandate, rate, and stop
checks immediately before execution. It never handles passwords, 2FA, CAPTCHAs,
terms, contracts, booking completion, or payment.

The integrated deployment passed 126 tests in 28 files, TypeScript, ESLint,
production build, and five Playwright flows with one expected responsive skip.
Backend and SPA were redeployed successfully; live Health, Landing, Explore, and
Map return HTTP 200. No provider-backed write was claimed: controlled Firecrawl,
AgentMail, and Browserbase proofs still require fresh configured credentials,
including rotation of the Browserbase key that appeared in chat.
