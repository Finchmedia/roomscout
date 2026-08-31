# RoomScout — Product Exploration & Technical Direction

Status: active product direction as of 2026-08-31 · Deadline: 2026-09-22, 12:00 PM PT

This document keeps decisions separate from hypotheses. Product ideas discussed
in conversation are not requirements until explicitly adopted.

## Settled decisions

### Technical foundation

- React + Vite + TypeScript SPA.
- Convex backend and official Convex Static Hosting at
  `https://<deployment>.convex.site`.
- Static frontend at `/`; Convex HTTP endpoints such as AgentMail webhooks under
  `/api`.
- Tailwind CSS v4 as the preferred styling layer.
- No Next.js runtime, SSR, server components, or server actions.

### Product boundaries

- Guided mode requires explicit approval of the exact destination and final
  content. A user may separately activate a versioned, scoped, expiring
  standing mandate for approved outreach actions. Contracts, terms acceptance,
  bookings, payments, deposits, passwords, 2FA, and CAPTCHAs always require the
  user.
- OpenAI is the only in-product model provider. Text generation uses the Convex
  AI Gateway with `openai/gpt-5.6-terra`; embeddings and Realtime WebRTC use the
  direct OpenAI endpoints because the Gateway does not provide those endpoints.
- Firecrawl performs web discovery and crawling; AgentMail handles approved
  email and replies.
- Firecrawl Interact executes exact reviewed public-form workflows after a final
  approval/mandate and policy check. CAPTCHA or uncertain completion pauses for
  the user in Live View. Browserbase maintains one user-owned persistent context
  per approved authenticated portal and may execute only code-owned reviewed
  actions; RoomScout never stores portal credentials, cookies, or Live View
  URLs.
- Private band information and contact details cannot be exposed without the
  necessary consent.

## Current baseline: room discovery

The original RoomScout concept remains a strong standalone product hypothesis.
A band describes its room requirements; RoomScout researches a fragmented market,
compares the available supply, and helps the band conduct approved outreach.

### Possible baseline loop

1. Capture location, schedule, budget, equipment, and room constraints.
2. Check a shared Convex directory before spending crawl or model resources.
3. Use Firecrawl when local supply is missing, stale, or incomplete.
4. Use OpenAI to turn inconsistent pages into comparable room records.
5. Show sources, confidence, gaps, and freshness to the user.
6. Draft selected room inquiries and wait for explicit approval.
7. Send approved messages with AgentMail and show parsed replies live.
8. Reuse public room knowledge for later searches.

This direction has immediate utility without an existing user network and makes
Firecrawl's contribution visible in the core demo.

## Leading implementation hypothesis: continuously updated market index

The latest synthesis broadens the shared directory into a continuously updated
index of the online-visible rehearsal-room market. Firecrawl would discover and
monitor both public supply and public demand sources independently of individual
user searches. Convex would maintain the Source Registry, canonical records,
provenance, freshness, realtime queries, saved needs, and application workflows.

The direct user promise is “search once across the fragmented web and get alerted
when something relevant appears.” Aggregate market intelligence is a possible
community benefit rather than the frontstage pitch.

This is the direction used by the provisional
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). It remains a hypothesis with
exit gates, not a final declaration that every planned phase belongs in the MVP.

## Open hypothesis: band matching and shared demand

Finding supply may not be the only way to solve the room problem. Compatible
bands might share cost, time slots, or equipment, making an otherwise unsuitable
room viable. RoomScout could potentially:

- learn a band's practical and musical preferences,
- suggest opted-in bands with overlapping needs,
- help bands form a room-sharing group or demand pool,
- summarize aggregate demand without revealing private profiles, and
- draft a stronger, jointly approved room-owner inquiry.

This is an exploration, not committed scope. General musical collaboration
matching may be a separate product from room-sharing coordination and should not
be bundled into the MVP without a clear reason.

## Open hypothesis: admin-seeded demand radar

The supply-constrained market may make public demand more visible than useful
supply. Bands have an incentive to publish room-wanted posts, while full room
operators can rely on personal networks and have little reason to advertise.
RoomScout could therefore use Firecrawl to discover public demand signals and
build local aggregate context before it has organic critical mass.

This would not make scraped people automatic network members. The product would
need to distinguish observed public signals from claimed, current, opted-in
needs, and then require consent before any match or introduction. See
[`PRODUCT_EXPLORATION.md`](PRODUCT_EXPLORATION.md) for the reasoning path,
candidate loop, and unresolved risks.

## Candidate product shapes

| Shape | Primary promise | Strength | Main risk |
|---|---|---|---|
| Living market index | Search current public supply and demand across fragmented sources | Immediate single-player utility, compounding data, and strongest Firecrawl usage | Cannot see offline supply; source maintenance, terms, and freshness are hard |
| Room-first | Find and contact suitable rehearsal rooms | Immediate utility and strongest Firecrawl story | Could feel like a one-off research tool |
| Superconnector | Find compatible bands and coordinate shared demand | Network effects and broader long-term vision | Cold start, privacy, and a diffuse MVP |
| Demand radar | Turn scattered public room searches into verified local demand pools | Seeds market context before organic adoption and exposes unmet demand | Scraped signals can be stale, legally sensitive, or mistaken for real liquidity |
| Hybrid | Find a room; when supply does not fit, help compatible bands unlock one together | Preserves the concrete core with a differentiated extension | More states and consent flows to build |

No candidate is final. Earlier exploration leaned toward keeping room discovery
as the spine. The demand-radar idea is now an equally serious hypothesis because
it may fit the market's visible data better. That change in emphasis is itself
part of the exploration, not a locked product decision.

## Relationship to Jumper

The project comes from domain experience gained while building Jumper for music
spaces. RoomScout is a separate public-web discovery experiment. This public
repository documents RoomScout's product behavior and disclosed visual reuse,
not private strategy or data from another project.

## Concepts under consideration

These are vocabulary for discussion, not a schema commitment:

| Concept | Possible purpose |
|---|---|
| Room directory | public facts, source provenance, freshness, and known availability |
| Room search | one band's location, schedule, budget, and equipment requirements |
| Outreach draft | selected recipients, purpose, content, and approval state |
| Mail thread | approved delivery, replies, and parsed availability |
| Band profile | reviewed preferences and optional matching consent |
| Room-sharing match | practical compatibility around a room or local search |
| Demand pool | an explicitly joined group coordinating a shared room inquiry |

The Convex schema, Auth v2 provider, bounded TTL/rate policies, matching model,
and Stuttgart/Berlin/Hamburg pilot are implemented. Wider German coverage is a
source-discovery program whose candidates remain untrusted until reviewed.

## Communication boundary

Research and drafting are not permission to send in Guided mode. Every action
uses a visible state transition and an immutable payload hash:

```text
drafted -> awaiting approval | authorized by standing mandate -> executing -> replied -> parsed
```

Standing mandates are versioned and constrain portals, action types, personal
data, daily contact/browser limits, price ceiling, expiry, and stop conditions.
Editing a mandate creates a new version; revocation is an immediate kill switch.
For a band introduction, matching remains opt-in and private details stay hidden
until the consent flow is complete.

## Questions to explore before locking the MVP

- Is the sharpest promise “find a room,” “unlock a room together,” or both?
- Which fragmented German sources can Firecrawl access reliably and responsibly?
- Can public demand signals seed an honest map without overstating verified
  participation or relying on unsolicited bulk outreach?
- What makes two needs merely similar, and what makes two bands practically
  compatible as co-tenants?
- Is conversational onboarding better than a short structured form for this job?
- Does room-sharing solve a frequent enough problem to justify matching scope?
- What information would make a multi-band inquiry genuinely more useful to a
  room owner?
- Can the core demo work with one city and controlled outreach?
- What minimum identity and auth model is necessary for private searches and
  approval records?
- Which parts of the maintainer's existing visual language help RoomScout while
  preserving a clear standalone identity?

## Possible next steps—not a locked schedule

1. Select one pilot geography based on real source coverage.
2. Qualify a small public source cohort covering different page patterns.
3. Prove one Firecrawl-monitor-to-Convex-realtime vertical slice.
4. Validate the musician-facing search and alert moment.
5. Only then decide whether matching or broader outreach belongs in the MVP.

The detailed sequence, data candidates, safeguards, test plan, and decision gates
are in [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md). The build log should
record decisions when they are actually made.
