# RoomScout <sub>(working title)</sub>

**Find a rehearsal room for your band — without the email marathon.**

Built for the Convex **"All Gas"** hackathon (Aug 25 – Sep 22, 2026).

## What it does

A band describes what it needs — city, nights per week, budget, gear. RoomScout:

1. checks a **shared public directory** of rehearsal rooms first,
2. **crawls** the local market (listing sites, classifieds, studio websites) when the directory has gaps,
3. **normalizes** the scattered results into comparable room profiles,
4. **emails** the studios on the band's behalf — availability and pricing answers land, parsed, in a live results board.

Every search makes the public directory better: the second band searching the same city gets instant results instead of a fresh crawl.

## Stack

| Sponsor | Role |
|---|---|
| **Convex** | runs it — database, live queries, crons, agent orchestration |
| **Firecrawl** | feeds it data — crawling listing sites & studio pages |
| **AgentMail** | gives it an inbox — per-search inboxes, studio outreach, reply parsing |
| **OpenAI** | generates — listing normalization, inquiry drafting, reply extraction |

## Status

Hackathon build, started **2026-08-26**. Live URL, demo video and social links land in [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) as they exist.

## Docs

- [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md) — the build log (start here)
- [`docs/PLAN.md`](docs/PLAN.md) — architecture, schema draft, milestones
- [`docs/KICKOFF_CONVERSATION.md`](docs/KICKOFF_CONVERSATION.md) — distilled kickoff conversation (German, with English TL;DR)
