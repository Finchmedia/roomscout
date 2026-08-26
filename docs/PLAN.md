# RoomScout — Architecture & Plan

Stand: 2026-08-26 · Deadline: 2026-09-22, 12:00 PM PT

## Product in one sentence

A band enters its profile once; RoomScout finds the rehearsal rooms, emails the studios, and streams parsed answers into a live board — while every search grows a shared public room directory.

## Schema draft (`convex/schema.ts`)

```
rooms         city, name, sourceUrl, contactEmail?, priceHour?, priceMonth?,
              equipment[], sizeSqm?, address?, description?,
              lastCrawledAt, enrichmentStatus ("none" | "emailed" | "answered")
              index: by_city

searches      bandProfile { city, nightsPerWeek, budget, needs[] },
              status ("checking" | "crawling" | "ready"), createdAt
              index: by_city          // doubles as demand log

crawlJobs     city, source, status ("queued" | "running" | "done" | "failed"),
              startedAt, roomsFound

inquiries     searchId, roomId, inboxId (AgentMail), status
              ("drafted" | "sent" | "replied" | "parsed"),
              parsedReply? { available?, price?, notes }
              index: by_search, by_room
```

## Function groups

### 1. Crawl pipeline (actions + crons) — Firecrawl + OpenAI
- `search.start` (mutation): create search → check `rooms.by_city` freshness (TTL ~14 days) → schedule crawl only on miss/stale
- `crawl.city` (action): Firecrawl map/crawl over listing sites, classifieds, studio pages → raw pages
- `crawl.normalize` (action): OpenAI extracts structured room profiles → upsert into `rooms` (dedupe by sourceUrl/name)
- cron: re-crawl stale cities, low frequency after the credits window

### 2. Mail agent (two tiers) — AgentMail + OpenAI
- **Tier 1, enrichment (once per room):** rooms without pricing get one polite data inquiry; reply parsed → shared `rooms` record
- **Tier 2, band inquiry (per search):** each search gets an AgentMail inbox; OpenAI drafts personalized availability inquiries; webhook receives replies → OpenAI parses → `inquiries.parsedReply` → live board updates
- Guardrail: never email the same studio twice for the same purpose (dedupe on `enrichmentStatus` / `inquiries.by_room`)

### 3. Live board + public directory — Convex live queries
- Search results board: rooms stream in while crawling, inquiry statuses update live
- Public directory pages per city (`/city/stuttgart`): the shared dataset, browsable without a search
- Small demand counter per city ("X bands searched here")

## Reuse (disclosed in build log)

- Design tokens: port `app/globals.css` (Tailwind v4 tokens) from jumper-v2
- Hero: port `components/landing/hero-section.tsx` (Vimeo background embed — only needs a `videoId`, no video file in the repo)

## Milestones

| Week | Until | Goal |
|---|---|---|
| 1 | Aug 31 | Scaffold (Next.js + Convex), schema, crawl pipeline for Stuttgart, first directory page live on convex.site |
| 2 | Sep 7 | AgentMail loop (both tiers) + live results board end-to-end |
| 3 | Sep 14 | Design-system port, hero, auth, **wide crawl of remaining cities (credits window!)** |
| 4 | Sep 21 | Demo video, build-log polish, social post, submission with 1 day buffer |

City order: Stuttgart → Berlin → Hamburg → München → Köln → Leipzig (+ surroundings as credits allow).

## Demo video script (< 3 min, talk less, click more)

1. **0:00–0:15** — the problem: a band, five browser tabs, a hand-written email into the void
2. **0:15–1:15** — live flow: enter band profile → results stream into the board → inquiry emails go out → a studio reply lands, parsed, in the board
3. **1:15–1:45** — the kicker: second search, same city → instant results (shared directory)
4. **1:45–2:15** — public city directory page + demand counter
5. **2:15–2:45** — stack slide: Convex runs it, Firecrawl feeds it, AgentMail is its inbox, OpenAI generates

## Judging checklist

- [ ] Everyday app, domain I know (music rooms) — not a dev tool
- [ ] Convex depth: live queries, mutations, actions, crons, auth, scheduled functions
- [ ] Sponsors do real work: Firecrawl crawls, AgentMail sends/receives, OpenAI extracts/drafts
- [ ] Live URL on convex.site
- [ ] Public GitHub repo
- [ ] Build log complete (this repo)
- [ ] Demo video < 3 min
- [ ] Social post (X/LinkedIn), tag @convex @OpenAI @firecrawl @agentmail
- [ ] Registered on Luma (→ Firecrawl credits)
