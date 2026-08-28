# RoomScout — Build Log

Convex **"All Gas"** hackathon · Aug 25 – Sep 22, 2026 (submission deadline Sep 22, 12:00 PM PT)

- **Live URL:** _tbd (convex.site)_
- **Demo video:** _tbd (< 3 min)_
- **Social post:** _tbd (X / LinkedIn)_

---

## 2026-08-26 — Day 1: Idea & kickoff

**Why this app.** My main side project is [Jumper](KICKOFF_CONVERSATION.md), a booking platform for music studio spaces. Building it taught me the supply side of a scattered market. RoomScout is the aggregator take on the same structural problem, from the demand side: bands don't fail at *booking* rehearsal rooms — they fail at *finding* them. The market lives in classifieds, forum posts and hand-made studio websites, and every single inquiry is a hand-written email into the void. That's the "email marathon" every band knows.

**The initial shape.** A band enters its profile (city, nights per week, budget, gear needs). The app checks a shared public room directory first; on a miss or stale data it crawls the local market with Firecrawl, normalizes listings with OpenAI, and drafts studio outreach for the user to approve. Approved messages go through AgentMail; replies return to a per-search inbox, get parsed, and land in a live results board powered by Convex live queries.

**Key design decision: shared directory, not private searches.** Every search improves the public directory. The second band searching Stuttgart gets instant results from the cache instead of triggering a fresh crawl; a TTL + cron keeps entries fresh. This saves crawl credits, makes the app faster with every user, and turns it into a growing public good rather than a per-user gadget.

**Two-tier email design.** Base-data enrichment ("what do you charge, what's in the room?") happens **once per room** and lands in the shared directory. The **individual inquiry** ("Tuesday + Thursday evenings from October?") is per band, through that band's AgentMail inbox. Both remain drafts until a user approves them. Studios never get duplicate spam because two bands searched the same city.

**Honest reuse disclosure.** All app code is new (started Aug 26, per hackathon rules). The visual direction was explored in a separate Claude Design handoff. The implementation reuses one room-background photograph from my own design assets; the React components, responsive styles, routing, and RoomScout mark are new in this repository.

**Today's output:** repo + docs skeleton, architecture plan ([PLAN.md](PLAN.md)), kickoff conversation distilled ([KICKOFF_CONVERSATION.md](KICKOFF_CONVERSATION.md)).

**Next at kickoff:** choose the final frontend architecture, scaffold the app, and prove the first city workflow.

## 2026-08-26 — Product exploration: room discovery and network effects

Explored a possible extension to the room finder: opted-in bands with compatible
locations, schedules, budgets, equipment, or musical interests might share a
room or form a stronger demand signal for room owners. This could create network
effects, but it also introduces cold-start, consent, privacy, and scope costs.

No product shape was selected. The original room-discovery and aggregation idea
remains valuable on its own and gives Firecrawl the clearest role. A room-first
product, a broader superconnector, and a hybrid where matching helps unlock an
otherwise unsuitable room remain open hypotheses.

Two constraints did settle during the discussion: use React + Vite + TypeScript
with Convex Static Hosting rather than Next.js, and require explicit user approval
before every external message or introduction.

**Next:** continue comparing the room-first and hybrid journeys before locking an
MVP, schema, or implementation sequence.

## 2026-08-27 — Product exploration: from supply crawler to demand radar

The room-first idea was tested against a structural market constraint: desirable
rehearsal-room supply is often full, quiet, and allocated through personal
networks. A web crawler can organize visible supply but may miss the rooms that
matter most. Bands searching for rooms have a stronger incentive to publish, so
public demand signals may be more discoverable than current availability.

This led to a new, still-open hypothesis: RoomScout could seed an aggregate
demand map from public room-wanted posts, then let musicians claim and verify
their needs before any private matching or coordination. Observed demand,
verified demand, and approved action would remain separate states. Similar
searches could support market heatmaps, while actual room-sharing suggestions
would also require complementary schedules and other practical compatibility.

The discussion also identified an important boundary: scraped contact details do
not imply permission for bulk outreach. AgentMail remains relevant for opt-in
verification, approved introductions, approved inquiries, and reply handling.
No MVP decision was made. The full reasoning and open questions are captured in
[`PRODUCT_EXPLORATION.md`](PRODUCT_EXPLORATION.md).

## 2026-08-27 — Provisional implementation plan

The current exploration was translated into a gated implementation plan for a
continuously updated, two-sided market index. Firecrawl owns recurring public-web
discovery and monitoring; Convex owns the operational Source Registry,
idempotent webhook processing, canonical supply/demand state, freshness,
realtime search, and application-level maintenance. OpenAI normalizes and
deduplicates changed signals, while AgentMail remains behind explicit message
approval.

The plan deliberately begins with one pilot geography and a small reviewed
public source cohort. It requires the source-to-realtime-UI vertical slice to
work before adding maps, embeddings, authenticated source automation, or
band-to-band coordination. See
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) for phases, exit gates,
candidate data boundaries, testing, and the definition of done.

## 2026-08-27 — Runnable scaffold and Claude Design port

Built the first runnable RoomScout application rather than extending the
planning layer. The frontend is now a responsive React/Vite/TypeScript SPA with
the Signal Ledger visual language, public landing/explorer/signal views, a
focused Scout onboarding and dashboard, an external-mail Inbox, and a thin Ops
cockpit. Synthetic records are visibly labelled as prototype data; all demo
actions remain deterministic and send nothing.

Convex Auth v2 Alpha now provides working Username/Password sign-up, sign-in,
session restore, sign-out, and server-side musician/operator gates. The local
compatibility spike proved Auth v2, the Agent component, and Static Hosting can
compile together. The Scout backend uses three explicit Case Card modes:
search discovery, signal advice, and outreach drafting.

The backend walking skeleton includes indexed public signal queries, owned saved
needs, versioned outreach drafts, and an exact approval snapshot. Approval
compares the client-visible version, hash, recipient, subject, and body before a
separate send command may claim it. Firecrawl change-tracking runs are bounded
by a Convex cron and feed idempotent ingestion plus OpenAI normalization.
AgentMail sending is internal-only, idempotent, and accepts replies through a
Svix-verified webhook before they appear in the private Inbox.

Validation completed locally: Convex codegen/function push, TypeScript, ESLint,
Vitest (7 tests), production build, desktop/mobile Playwright flows (5 passing,
1 intentionally skipped per project), and a live Auth v2 smoke test covering
sign-up, reload/session restore, role denial, and sign-out. Provider calls were
not executed because external credentials have not been configured, and no
production deployment was made.

## 2026-08-28 — Convex AI Gateway migration

Moved all implemented model calls to the Convex AI Gateway with
`openai/gpt-5.6-terra`: the durable Scout Agent, structured Firecrawl
normalization, and structured inbound-reply parsing now share one Gateway model
definition. The direct OpenAI SDK dependency and `OPENAI_API_KEY` /
`OPENAI_MODEL` deployment configuration were removed.

The migration was verified against the RoomScout cloud Development deployment.
A temporary fixed-prompt smoke action returned the expected response from
`openai/gpt-5.6-terra`; the public test action was then deleted and the cleaned
function set pushed again. This validates real model routing through Convex,
while the musician-facing Scout UI itself remains fixture-backed until the next
frontend/backend integration slice.

## 2026-08-28 — Persistent Room Scout and musician memory

Replaced the fixture Scout onboarding with the real Convex Agent thread and a
reactive `savedNeeds` search card. In a live German-language browser test, one
message created the Stuttgart search, updated six visible constraints, and
recorded separate durable facts about Glass Teeth, Marc, mobility, rehearsal
times, equipment, and compatible room-sharing bands. A later turn correctly
recalled the band's genres, equipment, and schedule without the user repeating
them. Search activation now persists in Convex.

Added an event-based entity/fact memory, fact supersession and deletion,
versioned three-part context compression, and a user-visible memory ledger.
Added the external-assistant import flow: copy a privacy-aware prompt to
ChatGPT/Claude, paste its export, analyze it with the Gateway, review every
candidate, and confirm only selected facts. The raw export is not stored. A live
test extracted and reviewed 12 facts across Daniel and Glass Teeth, then rebuilt
the working context to version 6.

Generation remains on Convex AI Gateway with `openai/gpt-5.6-terra`. At this
checkpoint, the native AI SDK structured-output option returned a provider
error in the live Gateway path, so normalization, reply parsing, memory
compression, and imports temporarily used strict JSON instructions plus Zod
validation.

Implemented owner-filtered semantic fact retrieval with the regular OpenAI
embeddings endpoint using `text-embedding-3-small` at 512 dimensions. New facts
are indexed asynchronously and existing facts can be backfilled from Profile.
At this checkpoint, the Development deployment did not yet contain
`OPENAI_API_KEY`; the feature therefore degraded safely to deterministic facts
and compressed context.

Validation: cloud Development push, TypeScript, ESLint, 20 Vitest tests,
production build, five Playwright checks (one responsive-case skip), plus live
Auth, Agent, search activation, context import, context compression, memory
recall, and console-error-free browser checks. No production deployment or
external communication occurred.

## 2026-08-28 — Finding and fixing the Structured Outputs adapter gap

Turned the earlier provider error into a controlled debugging experiment. The
official `@convex-dev/ai-sdk-provider@0.1.0` failed with HTTP 400, and an
instrumented equivalent showed that AI SDK had downgraded `Output.object` to
`json_object` and dropped its JSON Schema. A raw request proved that the Convex
AI Gateway and `openai/gpt-5.6-terra` accepted `json_schema`. Recreating the
small adapter with the same Gateway URL and `getServiceToken("ai-gateway")`
authentication, but adding only `supportsStructuredOutputs: true`, produced a
native strict schema request and succeeded without warnings.

Promoted the tested workaround into a deliberately small local adapter and
migrated Firecrawl normalization, inbound-email parsing, memory compression,
and context import from prompt-shaped JSON to native AI SDK `Output.object`
with final Zod validation. A production-shaped smoke test also exposed a useful
strict-schema rule: optional object properties must instead be required and
nullable. RoomScout now converts those `null` values to omitted Convex fields
after validation.

The newly configured `OPENAI_API_KEY` was verified independently with a real
`text-embedding-3-small` call returning 512 dimensions. No credential was read,
returned, or logged. The temporary public probe was removed after verification.
