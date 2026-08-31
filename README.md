# RoomScout <sub>(working title)</sub>

**Find a rehearsal room for your band — without the email marathon.**

Built for the Convex **"All Gas"** hackathon (Aug 25 – Sep 22, 2026).

**Live prototype:** https://fleet-jackal-83.eu-west-1.convex.site

## Current product baseline

RoomScout explores a continuously updated discovery layer for a fragmented,
supply-constrained rehearsal-room market. Firecrawl works in the background to
discover and refresh public supply and demand sources; a musician searches the
shared index instead of repeating the same search across many sites.

The current leading product loop is:

1. maintain an operational registry of reviewed market sources,
2. let Firecrawl Native Monitors detect page changes while Convex reconciles
   monitor health and processes webhooks,
3. expand changed index pages into individual listings and use OpenAI to
   normalize the findings,
4. redact public evidence, separate private contact candidates, deduplicate,
   geocode, match, and store canonical state in Convex,
5. let musicians search the live index and save a room need,
6. let the text or voice Scout apply durable musician context to that search,
7. choose which reviewed sources and connected portals participate in a search,
8. prepare exact outreach actions for one-time approval or authorize a narrowly
   scoped, versioned standing mandate, and
9. stream email and platform replies into one channel-aware Inbox.

Guided mode never communicates automatically. Outreach and Negotiation modes can
act only under an explicit standing mandate that limits portals, action types,
personal data, daily contacts/browser time, price, and expiry. Contracts,
bookings, payments, passwords, 2FA, CAPTCHAs, and terms acceptance always stop
for the user.

## Product exploration

The final scope is deliberately open. One promising extension is to help bands
with compatible locations, schedules, budgets, equipment, or musical interests
find each other. They might share a room, coordinate equipment, or form a demand
pool that gives room owners a stronger signal.

The exploration also considers an admin-seeded demand map: Firecrawl could find
public room-wanted posts so RoomScout has useful market context before it reaches
organic critical mass. Scraped observations would remain visibly distinct from
user-verified needs, and all matching would stay consent-based.

Neither extension is a committed MVP. The room-discovery flow remains valuable
on its own, while demand aggregation may address a structural blind spot in a
market where desirable supply often moves through offline networks. The project
may stay room-first, become demand-first, become a hybrid, or evolve further.
The reasoning is recorded in
[`docs/PRODUCT_EXPLORATION.md`](docs/PRODUCT_EXPLORATION.md).

## Technical direction

The application is a React + Vite + TypeScript SPA prepared for deployment with
Convex Static Hosting to `convex.site`. It uses Convex Auth v2 Alpha, the Agent,
Rate Limiter, and Static Hosting components, and the Convex AI Gateway with
`openai/gpt-5.6-terra`. Direct OpenAI calls are limited to embeddings and the
Realtime WebRTC session endpoint.

| Sponsor | Intended role |
|---|---|
| **Convex** | Source Registry, canonical market state, webhooks, realtime search, matching, approvals, rate limits, and reconciliation jobs |
| **Firecrawl** | bounded Germany source discovery, Native Monitoring, public-page extraction, and reviewed public-form execution with Interact |
| **AgentMail** | personal user inboxes, approved outreach, delivery events, and replies |
| **OpenAI** | `gpt-5.6-terra` generation through Convex AI Gateway, `text-embedding-3-small` semantic retrieval, and `gpt-realtime-2.1` voice through WebRTC |
| **Mapbox** | cached server-side geocoding and the public rehearsal-room globe/map |
| **Browserbase** | isolated persistent user/portal login contexts, short-lived human Live Views, reviewed recon/Inbox sync, and code-owned approved portal actions |

## Relationship to Jumper

RoomScout grows from domain knowledge gained while building Jumper, a platform
for music spaces. RoomScout is a separate public-web discovery experiment. All
reuse from maintainer-owned visual work is disclosed in the build log; internal
strategy and private project data are not part of this repository.

## Status

The authenticated Scout conversation, reactive search card, durable musician
memory, reviewed context import, semantic retrieval, and exact outreach approval
run against Convex. The backend now includes Firecrawl Native Monitor ingestion,
canonical signal matching, personal AgentMail inboxes, Realtime Voice session
setup, Mapbox geocoding, Germany source discovery, Firecrawl Interact execution,
per-portal Browserbase contexts, read-only source probes, source preferences,
standing-mandate orchestration, unified communications, portal verification
mail, and opportunity handoffs. Firecrawl form writes and Browserbase portal
writes pass the same final policy/adapter/approval/mandate gate; unknown
post-click outcomes are never retried automatically. No broad crawl or real
provider-backed portal action has been run; those remain controlled live proofs.
Only the reviewed Bandnet public-form workflow is production-shaped today;
authenticated portal writes still require a reviewed real-source adapter.
Translation is a later step.

The Ops cockpit includes a provider-readiness preflight that never returns
environment values. Known sources may also be explicitly restricted: for
example, Kleinanzeigen is visible to operators but unavailable to musician
searches because its current terms prohibit automated access without written
permission. A read-only live Bandnet form-contract check can be rerun with
`npm run verify:bandnet-form`.

## Local development

```sh
npm install
npx @convex-dev/auth
npx convex dev
npm run dev
```

Run the Auth CLI once for each new development deployment so it can create that
deployment's `AUTH_PRIVATE_KEY` and `AUTH_JWKS`; never copy those values into the
repository. `npx convex dev` creates the local Convex values in `.env.local`;
`.env.example` documents the additional provider configuration. Provider
secrets belong in the Convex deployment environment, not in source files.
Useful checks are `npm run typecheck`, `npm run lint`, `npm test`,
`npm run test:e2e`, and `npm run build`.

Firecrawl monitors are inert unless `FIRECRAWL_MONITORS_ENABLED=true`. Keep the
flag off until the listed pilot sources pass policy review. AgentMail provisions
a personal inbox lazily at the first outreach draft; it does not use a shared
global inbox. Voice session setup is handled by the authenticated
`POST /api/realtime/session` endpoint and never stores raw audio.
Browserbase uses only `BROWSERBASE_API_KEY`; do not configure a project ID or
store credentials/cookies in Convex. Rotate any credential ever pasted into a
chat before enabling a live proof.

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) — decisions, hypotheses, and open questions
- [`docs/PRODUCT_EXPLORATION.md`](docs/PRODUCT_EXPLORATION.md) — reasoning behind the demand-radar hypothesis
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — provisional phased build plan and exit gates
- [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) — narrative build log
- [`hackathon.md`](hackathon.md) — concise evidence-based hackathon history
- [`docs/KICKOFF_CONVERSATION.md`](docs/KICKOFF_CONVERSATION.md) — historical discovery context
