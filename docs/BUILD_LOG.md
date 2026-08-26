# RoomScout — Build Log

Convex **"All Gas"** hackathon · Aug 25 – Sep 22, 2026 (submission deadline Sep 22, 12:00 PM PT)

- **Live URL:** _tbd (convex.site)_
- **Demo video:** _tbd (< 3 min)_
- **Social post:** _tbd (X / LinkedIn)_

---

## 2026-08-26 — Day 1: Idea & kickoff

**Why this app.** My main side project is [Jumper](docs/KICKOFF_CONVERSATION.md), a booking platform for music studio spaces. Building it taught me the supply side of a scattered market. RoomScout is the aggregator take on the same structural problem, from the demand side: bands don't fail at *booking* rehearsal rooms — they fail at *finding* them. The market lives in classifieds, forum posts and hand-made studio websites, and every single inquiry is a hand-written email into the void. That's the "email marathon" every band knows.

**The shape.** A band enters its profile (city, nights per week, budget, gear needs). The app checks a shared public room directory first; on a miss or stale data it crawls the local market with Firecrawl, normalizes listings with OpenAI, and reaches out to studios through AgentMail. Replies come back into a per-search inbox, get parsed, and land in a live results board — powered by Convex live queries, so results stream in as they happen.

**Key design decision: shared directory, not private searches.** Every search improves the public directory. The second band searching Stuttgart gets instant results from the cache instead of triggering a fresh crawl; a TTL + cron keeps entries fresh. This saves crawl credits, makes the app faster with every user, and turns it into a growing public good rather than a per-user gadget.

**Two-tier email design.** Base-data enrichment ("what do you charge, what's in the room?") happens **once per room** and lands in the shared directory. The **individual inquiry** ("Tuesday + Thursday evenings from October?") is per band, through that band's AgentMail inbox. Studios never get duplicate spam because two bands searched the same city.

**Honest reuse disclosure.** All app code is new (started Aug 26, per hackathon rules). I'm porting the design system (CSS design tokens) and a hero-video component from my own main project so hackathon time goes into the product, not into re-inventing buttons.

**Today's output:** repo + docs skeleton, architecture plan ([PLAN.md](PLAN.md)), kickoff conversation distilled ([KICKOFF_CONVERSATION.md](KICKOFF_CONVERSATION.md)).

**Next:** scaffold (Next.js + Convex), schema, crawl pipeline for city #1 (Stuttgart).
