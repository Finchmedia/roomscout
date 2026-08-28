# RoomScout — Product Exploration

Status: working product reasoning as of 2026-08-27. This is not a final MVP,
schema, roadmap, or commitment to build every concept described below.

## Starting point: finding affordable rehearsal space

The durable user problem is simple to state and difficult to solve: musicians
struggle to find affordable rehearsal rooms. RoomScout initially approached this
as a fragmented-supply problem. A band would describe its requirements, the app
would search public listings and studio sites, normalize the results, and help
the band send approved inquiries.

This remains a useful product hypothesis. It gives a musician an immediate job
to do and makes Firecrawl central to the experience. The exploration became more
complicated after comparing that model with domain experience from Jumper and
the findings in the Stuttgart rehearsal-room study.

## Structural challenge: useful supply is often invisible

The market appears strongly supply-constrained. Attractive rooms can remain full
for long periods, and allocation often happens through personal relationships or
word of mouth. Providers with sufficient demand have little incentive to publish
accurate availability, maintain listings, or join another marketplace.

That creates a blind spot for a pure supply crawler:

- Firecrawl can find digitally visible market traces, but not rooms that never
  become public.
- Visible offers may overrepresent expensive, temporary, stale, distant, or
  otherwise less desirable supply.
- A missing listing does not mean a room does not exist; an unanswered message
  does not reliably mean a room is unavailable.
- Better extraction and realtime state can organize known information, but they
  cannot create provider incentives or physical capacity by themselves.

An existing booking marketplace is structurally better placed to work directly
on supply through booking, availability management, granular time-slot usage,
and peer-to-peer sharing. This raised a new question: what could RoomScout
observe or coordinate that a supply marketplace normally misses?

## Reversal: demand may be more visible than supply

When supply is scarce, seekers have to make themselves visible. Bands publish
“rehearsal room wanted” posts across classifieds, musician forums, social pages,
and local communities. Providers can remain quiet; demand cannot.

This suggests a different use of Firecrawl: discover fragmented public demand
signals rather than assuming that the web contains a complete inventory of
available rooms. OpenAI could extract location, radius, schedule, budget,
equipment, duration, flexibility, and other constraints from inconsistent posts.
Convex could retain source provenance, timestamps, confidence, and expiry while
supporting a live local demand map.

The resulting data could reveal:

- neighborhoods with persistent unmet demand,
- recurring combinations of budget, equipment, and schedule,
- groups that might jointly support a lease,
- places where managed sharing could unlock existing capacity, and
- locations where the community could benefit from additional supply.

This is more strategically useful than counting successful bookings alone: a
failed search can become a qualified signal about the supply-demand gap.

## Solving the network cold start without pretending it is solved

An admin-seeded crawl could give RoomScout information density before the app is
well known. A new user would not necessarily arrive at an empty map. However,
scraped posts are observations, not members of a live community. Treating them as
equivalent would create misleading liquidity and undermine trust.

The emerging hypothesis separates three layers:

| Layer | Meaning | Trigger |
|---|---|---|
| Observed demand | A recent public room-seeking signal with source, freshness, and confidence | RoomScout research |
| Verified demand | A person claims or creates the need, confirms it is active, and controls visibility | User opt-in |
| Coordination | Matching, pools, introductions, and outreach around verified needs | Explicit participant approval |

A public interface might therefore show “34 recent public search signals, nine
verified on RoomScout” rather than claiming that 34 bands are available to meet.
Public views should remain aggregate or anonymized; scraped identities and
contact details are not directory content.

## Similar demand is not always compatible demand

Semantic clustering and embeddings could identify posts describing comparable
needs. That is useful for market heatmaps and supply-side evidence, but it is not
enough for room-sharing recommendations.

Two bands that both need Tuesday at 19:00 may compete for the same scarce slot.
Two bands with similar location, budget, and equipment needs but complementary
days may be strong co-tenants. A useful system should distinguish:

- **market similarity:** needs that demonstrate concentrated demand,
- **sharing compatibility:** practical constraints that make joint use viable,
- **outreach compatibility:** participants who can credibly approach a provider
  as a group, and
- **musical compatibility:** genre or collaboration interests, which may be a
  separate job from finding a room.

The matching value would come from structured constraints and consent, not from
embeddings alone.

## Candidate user loop

One possible loop, still subject to validation, is:

1. RoomScout continuously discovers and refreshes public demand signals.
2. A musician enters a need or provides an existing public search post.
3. The app distinguishes unverified observations from active RoomScout members.
4. It shows local demand context and explains potential matches.
5. The musician can claim or verify a need and opt into specific coordination.
6. Compatible participants independently approve an introduction.
7. A group may approve a shared inquiry to a room owner or potential space.
8. Replies, outcomes, and expiry update the shared demand picture.

The intended product moment is more actionable than a heatmap:

> We found several similar searches nearby. Three verified bands may be viable
> co-tenants because your practical requirements align and your schedules are
> complementary. Would you like to explore a private introduction?

This could provide direct musician value while also making aggregate unmet
demand easier for participating communities to understand.

## Sponsor roles in this hypothesis

| Technology | Genuine product work |
|---|---|
| Firecrawl | discover and refresh fragmented public demand and possible latent-space sources |
| OpenAI | structure messy posts, resolve likely duplicates, identify missing information, and explain matches |
| Convex | maintain the live signal graph, provenance, freshness, verification, consent, approvals, and realtime updates |
| AgentMail | handle opt-in verification, onboarding, alerts, mutually approved introductions, approved outreach, and replies |

AgentMail should not imply an automatic bulk cold-email loop. The existing rule
still applies: every external message and introduction requires approval of its
recipients and final content. A responsible product also needs a clear legal and
trust analysis before retaining scraped contact details or initiating contact.

## Current synthesis: a continuously updated two-sided market index

The demand-radar exploration led back to a broader but sharper product core.
RoomScout does not need to choose between crawling visible supply and observing
public demand. Both are fragmented market signals that can be discovered,
normalized, refreshed, and searched through one shared system.

The problem has two causes that should not be confused:

- physical rehearsal-room supply is genuinely scarce, and
- the part of the market that does reach the web is scattered across many
  listings, forums, studio sites, local communities, and municipal pages.

RoomScout cannot make the first problem disappear. It can reduce the search loss
created by the second. The leading product promise is therefore becoming:

> Search once across the fragmented online rehearsal-room market, understand
> how fresh each result is, and be notified when something relevant appears.

Firecrawl would work continuously rather than only after an individual search.
RoomScout would first research and qualify useful sources, store them in an
operational Source Registry, create a baseline, and then use the appropriate
monitoring mode:

- page monitoring for stable listing pages,
- website monitoring when new or removed detail pages must be discovered, and
- web-scale monitoring for recurring discovery beyond known sources.

Firecrawl owns recurring web retrieval and change detection. Convex receives
monitor webhooks and owns the durable application state: source health,
idempotent ingestion, normalized records, provenance, freshness, saved needs,
approvals, and the realtime interface. Convex cron jobs handle application-level
maintenance such as stale-state transitions, retries, expiry, and derived market
summaries rather than duplicating Firecrawl's retrieval schedule.

The product then has three reinforcing loops:

```text
Index: source -> monitor -> change -> normalize -> deduplicate -> market index
User: search -> result -> save need -> alert -> approved action
Learning: reply or feedback -> verify state -> improve shared market memory
```

The immediate musician value is not “aggregated market data” in the abstract. It
is less repeated searching, more current comparable results, visible provenance,
and relevant alerts. Aggregate supply-demand data and gap analysis may later
help local participants understand where sharing or additional capacity would
have the greatest value.

This synthesis is now detailed as a provisional build sequence in
[`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md).

## Current working conclusion

The strongest current framing is not “crawl the web and find every hidden room.”
It is “maintain a living index of the online-visible rehearsal-room market, then
turn its fragmented supply and demand signals into current, comparable, and
actionable information.” Firecrawl can create useful context before users arrive;
Convex can preserve it as shared market memory; users improve it through verified
needs, feedback, and consent-based action.

This direction may become:

- a continuously updated search and alert product for musicians,
- a standalone demand commons for musicians,
- a demand-intelligence and supply-activation layer for the wider market, or
- a hybrid RoomScout that still searches visible supply but switches to shared
  demand coordination when no suitable room is found.

No option is selected yet.

## Questions still open

- What is useful to one musician this week before a dense verified network
  exists?
- Which combination of page, crawl, and web-scale monitoring provides useful
  coverage at a sustainable cost?
- Which public sources are responsible and reliable enough to ingest?
- How should people discover and claim observed needs without bulk unsolicited
  outreach?
- What verification and expiry rules make a need trustworthy?
- Which fields distinguish a promising co-tenant from a competing searcher?
- Is one city sufficient for the first proof, with a shared ontology designed
  for later German or European expansion?
- Does the best demo prove room discovery, demand coordination, or the transition
  between them?
- Where should RoomScout end and Jumper begin?

These questions should be tested before the MVP, schema, or implementation order
is locked.
