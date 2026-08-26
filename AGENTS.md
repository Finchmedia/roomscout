# RoomScout — Agent Context

Hackathon entry for Convex "All Gas" (deadline: Sep 22, 2026, 12:00 PM PT).
Read `docs/PLAN.md` before writing code. Log daily progress in `docs/BUILD_LOG.md`.

## Hard rules

- **All in-product LLM calls use the OpenAI API.** This is a judging criterion ("OpenAI does real work in your product"). No other LLM provider in app code. Use a small/cheap model for bulk extraction — there are no OpenAI credits, costs are out of pocket.
- **Firecrawl for all crawling, AgentMail for all email.** Sponsors must do real work, not sit in the README.
- **Shared directory architecture:** a search reads the `rooms` cache first; crawl only on miss or stale data (TTL ~14 days). Every search improves the public directory.
- **Two-tier email design:** base-data enrichment happens once per room (shared); individual availability inquiries are per band via that search's AgentMail inbox. Never email the same studio twice for the same purpose.
- **This repo is public.** No secrets, no `.env` values, no business-internal strategy in code, comments, or docs.
- Convex: new function syntax, argument validators on every function, indexes instead of `.filter()` on queries.

## Stack

Next.js (App Router) + Convex. Deploy target: convex.site.
Design tokens are ported from the maintainer's own design system (`app/globals.css`, Tailwind v4); hero uses a Vimeo background embed component. Market focus: Germany (city order in `docs/PLAN.md`).
