# RoomScout — Agent Context

Hackathon entry for Convex "All Gas" (deadline: Sep 22, 2026, 12:00 PM PT).
Read `docs/PLAN.md` and `docs/IMPLEMENTATION_PLAN.md` before writing code. Treat
`docs/KICKOFF_CONVERSATION.md` as historical discovery context, not a
specification. Run `/hackathon` after meaningful progress; use
`docs/BUILD_LOG.md` for longer narrative notes.

## Working mode

The product is still in exploration. Do not turn conversational ideas into
requirements, schemas, milestones, or documentation unless the user explicitly
says to lock them in or asks for a file update.

- **Current baseline:** explore a continuously updated index of public rehearsal-
  room supply and demand, with provenance, freshness, structured results, saved
  needs, and approved communication.
- **Open hypotheses:** conversational onboarding, compatible-band discovery,
  room-sharing groups, an admin-seeded demand radar, demand pools, and broader
  superconnector behavior.
- `docs/PLAN.md` distinguishes settled constraints from ideas under evaluation.
  `docs/PRODUCT_EXPLORATION.md` records how the current hypotheses emerged.
  `docs/IMPLEMENTATION_PLAN.md` is provisional and contains explicit exit gates;
  later phases are not automatically committed scope.

## Settled constraints

- **All external communication requires approval.** The product may research,
  recommend, and draft, but it must not send an email or make an introduction
  until the relevant user approves the final recipients and message.
- **Text generation uses OpenAI through the Convex AI Gateway.**
  `openai/gpt-5.6-terra` is the shared text-generation model. The regular OpenAI
  endpoint may use `OPENAI_API_KEY` only for semantic embeddings and the
  approved Realtime WebRTC voice flow; do not use that key for a second text
  chat or normalization path.
- **Firecrawl handles web discovery and crawling; AgentMail handles email.** Each
  sponsor must perform genuine product work.
- **Matching is consent-based if built.** Never expose a private band profile or
  contact details without the required opt-in and introduction approval.
- **This repo is public.** No secrets, `.env` values, private profile data, raw
  conversations, contact information, or internal business strategy in code,
  comments, logs, or docs.
- **Convex conventions:** use the new function syntax, argument and return
  validators, indexes instead of `.filter()` on database queries, and internal
  functions for non-public backend operations.

## Technical direction

Use a React + Vite + TypeScript SPA with a Convex backend. Deploy the built
`dist/` through the official Convex Static Hosting component to `convex.site`;
do not introduce Next.js, SSR, server components, or server actions. Mount the
static frontend at `/` and reserve `/api` for Convex HTTP endpoints such as
AgentMail webhooks.

Tailwind CSS v4 is the preferred styling layer. Existing visual assets from the
maintainer's own work may be adapted with reuse documented when it happens.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
