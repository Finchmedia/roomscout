# Hackathon log

- **Project:** RoomScout
- **Event:** Convex All Gas Hackathon
- **What it does:** Builds a continuously updated index of public rehearsal-room supply and demand so musicians can search current listings, save needs, and approve follow-up communication.
- **Live app:** not deployed
- **Repo:** https://github.com/Finchmedia/roomscout
- **Frontend:** React + Vite SPA prepared for Convex Static Hosting
- **Convex deployment:** cloud Development deployment active; production not deployed
- **Components:** Auth v2 Alpha, Agent, Static Hosting, Password, Username, Rate Limiter
- **Convex features:** schema, indexed queries, mutations, actions, HTTP actions, scheduler, cron jobs, reactive subscriptions
- **Auth:** Convex Auth v2 Alpha, Username + Password
- **AI models:** OpenAI `gpt-5.6-terra` through Convex AI Gateway; `text-embedding-3-small` semantic memory through the OpenAI embeddings endpoint
- **Started:** 2026-08-26T13:55:26Z
- **Last updated:** 2026-08-28T12:19:28Z

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
