# Hackathon log

- **Project:** RoomScout
- **Event:** Convex All Gas Hackathon
- **What it does:** Continuously indexes public rehearsal-room supply and demand, gives musicians a context-aware text/voice Scout, and keeps external actions approval-gated.
- **Live app:** https://fleet-jackal-83.eu-west-1.convex.site
- **Repo:** https://github.com/Finchmedia/roomscout
- **Frontend:** Convex static hosting
- **Convex deployment:** https://perceptive-antelope-445.eu-west-1.convex.cloud
- **Components:** @convex-dev/agent, @convex-dev/auth, @convex-dev/rate-limiter, @convex-dev/static-hosting, @agentmail/convex, firecrawlRoomScout (vendored local extension of @firecrawl/firecrawl-convex)
- **Convex features:** schema, tables, indexes, vector search, queries, mutations, actions, HTTP actions, crons, scheduled functions, realtime queries, paginated queries
- **Auth:** Convex Auth
- **AI models:** `openai/gpt-5.6-terra` through Convex AI Gateway, `text-embedding-3-small`, `gpt-realtime-2.1`
- **Started:** 2026-08-26T13:55:26Z
- **Last updated:** 2026-09-01T12:04:42Z

## Log

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
Browserbase signup/message or AgentMail send/reply round trip; inbound mail
still needs a provider webhook and secret, and per-user Inbox creation needs
broader provider scope (`docs/BUILD_LOG.md`).
