# RoomScout <sub>(working title)</sub>

**Find a rehearsal room for your band — without the email marathon.**

Built for the Convex **"All Gas"** hackathon (Aug 25 – Sep 22, 2026).

## Current product baseline

RoomScout explores a continuously updated discovery layer for a fragmented,
supply-constrained rehearsal-room market. Firecrawl works in the background to
discover and refresh public supply and demand sources; a musician searches the
shared index instead of repeating the same search across many sites.

The current leading product loop is:

1. maintain an operational registry of reviewed market sources,
2. use scheduled Firecrawl scrapes with change tracking to detect new and
   changed public supply and demand signals,
3. use OpenAI to normalize and deduplicate the findings,
4. store provenance, freshness, and canonical state in Convex,
5. let musicians search the live index and save a room need,
6. prepare relevant alert or outreach drafts for explicit approval,
7. send approved communication through AgentMail, and
8. stream replies and status changes into the live Convex interface.

No external communication is automatic. Every message remains a draft until the
user approves its recipients and final content.

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
Convex Static Hosting to `convex.site`. The current scaffold includes Convex
Auth v2 Alpha, the Convex Agent and Static Hosting components, the Convex AI
Gateway using `openai/gpt-5.6-terra`, realtime-ready feature functions, and
guarded Firecrawl and AgentMail integration seams.

| Sponsor | Intended role |
|---|---|
| **Convex** | Source Registry, canonical market state, webhooks, realtime search, approvals, and application-level jobs |
| **Firecrawl** | public source discovery, extraction, recurring change-tracked retrieval, and change detection |
| **AgentMail** | user-approved outreach and reply handling |
| **OpenAI** | `gpt-5.6-terra` generation through Convex AI Gateway plus `text-embedding-3-small` semantic memory through the embeddings endpoint |

## Relationship to Jumper

RoomScout grows from domain knowledge gained while building Jumper, a platform
for booking recording studios and rehearsal spaces. Jumper approaches the market
through managed supply and booking. RoomScout currently explores demand-side
discovery, public aggregation, and coordinated outreach. All RoomScout application
code will be new; any reused visual assets will be disclosed in the build log.

## Status

The authenticated Scout conversation, reactive search card, durable musician
memory, context import/review, and memory-management UI now run against Convex.
Market cards remain visibly labelled examples until live ingestion is connected.
Live URL, demo video, and social links will be recorded in
[`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) when they exist.

## Local development

```sh
npm install
npx convex dev
npm run dev
```

`npx convex dev` creates the local Convex values in `.env.local`;
`.env.example` documents the additional provider configuration. Provider
secrets belong in the Convex deployment environment, not in source files.
Useful checks are `npm run typecheck`, `npm run lint`, `npm test`,
`npm run test:e2e`, and `npm run build`.

## Docs

- [`docs/PLAN.md`](docs/PLAN.md) — decisions, hypotheses, and open questions
- [`docs/PRODUCT_EXPLORATION.md`](docs/PRODUCT_EXPLORATION.md) — reasoning behind the demand-radar hypothesis
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — provisional phased build plan and exit gates
- [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) — narrative build log
- [`hackathon.md`](hackathon.md) — concise evidence-based hackathon history
- [`docs/KICKOFF_CONVERSATION.md`](docs/KICKOFF_CONVERSATION.md) — historical discovery context
